/**
 * Auto-Discovery for the EXP ROI.
 *
 * Strategy: Search-and-Validate.
 *   1. Capture the full game view.
 *   2. Mask white-ish text pixels (HSV V>=180, S<=70).
 *   3. Horizontal-dilate so adjacent letters merge into text-line components.
 *   4. Connected-components → bounding boxes; filter by shape, size, density.
 *   5. OCR-probe each candidate with the existing EXP pipeline.
 *   6. Regex-match `\d+[.,]\d+%?` → that candidate is the EXP bar.
 *
 * Cost: one full-frame mask + dilate + CC + up to N OCR probes (~1.5–2 s).
 * Runs only on-demand: when a profile has no EXP ROI in store, or when an
 * existing ROI starts failing OCR consistently.
 *
 * Returns a HudRoi in normalized 0..1 coordinates relative to the captured
 * frame so the caller can store it directly via roiStore.
 */

import * as fs from "fs";
import * as path from "path";
import { type RawImage, bgrToHsv, hsvInRange, dilate } from "./pixelOps";
import { decodePng, toPng, cropBgr } from "./imagePreprocessor";
import type { NativeOcrWorker } from "./nativeWorker";
import { logWarn } from "../../shared/logger";

export interface BBox {
    x: number;
    y: number;
    w: number;
    h: number;
    pixelCount: number;
}

export interface DiscoveredRoi {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface DiscoveryResult {
    roi: DiscoveredRoi;
    rawSample: string;
    sourceBox: BBox;
}

/**
 * Detailed outcome of a single discovery attempt.
 * - matched: EXP bar found and regex confirmed → caller persists ROI.
 * - frame-blank: captured PNG has effectively no bright pixels (game tab
 *   in background, still loading, char-select screen). Transient — retry soon.
 * - no-shape-valid: HSV mask had pixels but no candidate matched size/aspect
 *   filters. Permanent until view content changes.
 * - no-text-match: candidates went through OCR but none matched EXP regex.
 *   Permanent until view content changes.
 */
export type DiscoveryOutcomeKind = "matched" | "frame-blank" | "no-shape-valid" | "no-text-match";

export type DiscoveryOutcome =
    | { kind: "matched"; result: DiscoveryResult }
    | { kind: "frame-blank"; maskFg: number }
    | { kind: "no-shape-valid"; maskFg: number; componentsScanned: number }
    | { kind: "no-text-match"; maskFg: number; candidatesScanned: number };

/** Optional debug dump directory. Set by caller (ocrSystem) when a failure
 *  should write the input PNG + generated mask to disk for inspection. */
let debugDumpDir: string | null = null;
export function setDiscoveryDebugDumpDir(dir: string | null): void {
    debugDumpDir = dir;
}

async function dumpDebug(profileId: string, originalPng: Buffer, mask: RawImage): Promise<void> {
    if (!debugDumpDir) return;
    try {
        fs.mkdirSync(debugDumpDir, { recursive: true });
        const stamp = `${profileId}-${Date.now()}`;
        const pngPath = path.join(debugDumpDir, `${stamp}-input.png`);
        const maskPath = path.join(debugDumpDir, `${stamp}-mask.png`);
        fs.writeFileSync(pngPath, originalPng);
        const maskPng = await toPng(mask);
        fs.writeFileSync(maskPath, maskPng);
        console.log(`[OCR Discovery] dumped debug PNGs to ${pngPath} and ${maskPath}`);
    } catch (err) {
        console.error("[OCR Discovery] debug dump failed:", err);
    }
}

export const EXP_REGEX = /^\s*\d{1,3}[.,]\d{1,4}\s*%?\s*$/;

export function isExpPercentMatch(raw: string): boolean {
    if (!raw) return false;
    return EXP_REGEX.test(raw.trim());
}

/**
 * 4-connectivity flood-fill connected components on a single-channel binary
 * mask. Pixels ≥128 are foreground. Returns one bounding box per component.
 *
 * Implementation uses an explicit queue (Int32Array) instead of recursion to
 * avoid stack overflow on large components. Visited tracking is a Uint8Array.
 */
export function findConnectedComponents(mask: RawImage): BBox[] {
    if (mask.channels !== 1) {
        throw new Error("findConnectedComponents requires a 1-channel mask");
    }
    const { width, height, data } = mask;
    const total = width * height;
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    const boxes: BBox[] = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (visited[idx]) continue;
            if (data[idx]! < 128) continue;

            let head = 0;
            let tail = 0;
            queue[tail++] = idx;
            visited[idx] = 1;
            let minX = x, maxX = x, minY = y, maxY = y, count = 0;

            while (head < tail) {
                const cur = queue[head++]!;
                const cx = cur % width;
                const cy = (cur / width) | 0;
                count++;
                if (cx < minX) minX = cx;
                else if (cx > maxX) maxX = cx;
                if (cy < minY) minY = cy;
                else if (cy > maxY) maxY = cy;

                // 4-neighbors
                if (cx + 1 < width) {
                    const n = cur + 1;
                    if (!visited[n] && data[n]! >= 128) { visited[n] = 1; queue[tail++] = n; }
                }
                if (cx > 0) {
                    const n = cur - 1;
                    if (!visited[n] && data[n]! >= 128) { visited[n] = 1; queue[tail++] = n; }
                }
                if (cy + 1 < height) {
                    const n = cur + width;
                    if (!visited[n] && data[n]! >= 128) { visited[n] = 1; queue[tail++] = n; }
                }
                if (cy > 0) {
                    const n = cur - width;
                    if (!visited[n] && data[n]! >= 128) { visited[n] = 1; queue[tail++] = n; }
                }
            }

            boxes.push({
                x: minX,
                y: minY,
                w: maxX - minX + 1,
                h: maxY - minY + 1,
                pixelCount: count,
            });
        }
    }
    return boxes;
}

export interface DiscoveryOptions {
    /** Min / max bounding-box width in source pixels. */
    minWidth?: number;
    maxWidth?: number;
    /** Min / max bounding-box height in source pixels. */
    minHeight?: number;
    maxHeight?: number;
    /** Min aspect ratio (width / height) — EXP bar is horizontal text. */
    minAspectRatio?: number;
    /** Min / max foreground-pixel density inside bbox. Text has 15-85 %. */
    minDensity?: number;
    maxDensity?: number;
    /** Maximum candidates to OCR-probe (in priority order). */
    maxCandidates?: number;
    /** Pad the resulting ROI by this many source pixels per side. */
    paddingPx?: number;
}

const DEFAULTS: Required<DiscoveryOptions> = {
    minWidth: 40,
    maxWidth: 400,
    minHeight: 8,
    maxHeight: 40,
    minAspectRatio: 3,
    minDensity: 0.15,
    maxDensity: 0.85,
    maxCandidates: 10,
    paddingPx: 2,
};

/**
 * Tighten a candidate bbox to the rightmost dense text run inside the
 * un-dilated mask. Removes left-side noise (yellow "Exp" label edges, avatar
 * reflections, snow particles) that horizontal dilation may have joined into
 * the same component.
 *
 * Strategy: column histogram → scan right→left for contiguous columns with
 * sum ≥ minColSum, allowing small gaps (decimal point spacing). The resulting
 * run is the digits+% block. Then trim Y the same way using row sums.
 *
 * Returns the original bbox unchanged if no dense column run is found
 * (failsafe — won't make things worse).
 */
export function tightenToTextBlock(
    mask: RawImage,
    bbox: BBox,
    opts: { minColSum: number; maxColGap: number; paddingPx: number },
): BBox {
    if (mask.channels !== 1) {
        throw new Error("tightenToTextBlock requires a 1-channel mask");
    }
    const maskW = mask.width;
    const maskH = mask.height;
    const { x: bx, y: by, w: bw, h: bh } = bbox;

    if (bw <= 0 || bh <= 0) return bbox;

    // Column-wise foreground sums within the bbox.
    const colSums = new Uint32Array(bw);
    for (let dy = 0; dy < bh; dy++) {
        const rowOff = (by + dy) * maskW + bx;
        for (let dx = 0; dx < bw; dx++) {
            if (mask.data[rowOff + dx]! >= 128) colSums[dx]!++;
        }
    }

    // Scan right→left for the rightmost dense run. Tolerate up to maxColGap
    // empty columns inside the run (covers the period in "65.4264").
    let rightEdge = -1;
    let leftEdge = -1;
    let gap = 0;
    for (let dx = bw - 1; dx >= 0; dx--) {
        if (colSums[dx]! >= opts.minColSum) {
            if (rightEdge === -1) rightEdge = dx;
            leftEdge = dx;
            gap = 0;
        } else if (rightEdge !== -1) {
            gap++;
            if (gap > opts.maxColGap) break;
        }
    }
    if (rightEdge < 0 || leftEdge < 0) return bbox;

    // Row sums within the kept column range to tighten Y too.
    const rowSums = new Uint32Array(bh);
    for (let dy = 0; dy < bh; dy++) {
        const rowOff = (by + dy) * maskW + bx;
        for (let dx = leftEdge; dx <= rightEdge; dx++) {
            if (mask.data[rowOff + dx]! >= 128) rowSums[dy]!++;
        }
    }
    let topEdge = -1;
    let botEdge = -1;
    for (let dy = 0; dy < bh; dy++) {
        if (rowSums[dy]! > 0) {
            if (topEdge === -1) topEdge = dy;
            botEdge = dy;
        }
    }
    if (topEdge < 0) topEdge = 0;
    if (botEdge < 0) botEdge = bh - 1;

    const pad = Math.max(0, opts.paddingPx);
    const newX = Math.max(0, bx + leftEdge - pad);
    const newY = Math.max(0, by + topEdge - pad);
    const newW = Math.min(maskW - newX, (rightEdge - leftEdge + 1) + pad * 2);
    const newH = Math.min(maskH - newY, (botEdge - topEdge + 1) + pad * 2);
    if (newW <= 0 || newH <= 0) return bbox;

    // Count pixels in the trimmed bbox so callers using pixelCount stay correct.
    let count = 0;
    for (let dy = 0; dy < newH; dy++) {
        const rowOff = (newY + dy) * maskW + newX;
        for (let dx = 0; dx < newW; dx++) {
            if (mask.data[rowOff + dx]! >= 128) count++;
        }
    }
    return { x: newX, y: newY, w: newW, h: newH, pixelCount: count };
}

/** Filter and rank bounding boxes by EXP-bar-likeness. */
export function rankCandidates(
    boxes: BBox[],
    frameWidth: number,
    frameHeight: number,
    opts: Required<DiscoveryOptions>,
): BBox[] {
    return boxes
        .filter((b) => {
            if (b.w < opts.minWidth || b.w > opts.maxWidth) return false;
            if (b.h < opts.minHeight || b.h > opts.maxHeight) return false;
            const aspect = b.w / b.h;
            if (aspect < opts.minAspectRatio) return false;
            const density = b.pixelCount / (b.w * b.h);
            if (density < opts.minDensity || density > opts.maxDensity) return false;
            return true;
        })
        .sort((a, b) => {
            // Prefer lower-half of frame (typical HUD position), then larger width.
            const aLower = a.y > frameHeight * 0.4 ? 1 : 0;
            const bLower = b.y > frameHeight * 0.4 ? 1 : 0;
            if (aLower !== bLower) return bLower - aLower;
            return b.w - a.w;
        })
        .slice(0, opts.maxCandidates);
}

/**
 * Run the full discovery pipeline on a captured PNG.
 * Returns null if no candidate matches the EXP regex.
 */
/** Minimum white-text pixels required before we even try Connected Components.
 *  Below this the captured frame is treated as "blank" (transient, retry soon)
 *  rather than as a permanent "no match" failure. 50 px is more than enough
 *  to contain a single OCR character, so anything less means there's no text
 *  on screen at all (background WebGL tab, loading screen, char select). */
const MIN_MASK_FG_FOR_REAL_FRAME = 50;

export async function discoverExpRoi(args: {
    capturePng: Buffer;
    ocrWorker: NativeOcrWorker;
    profileId?: string;
    options?: DiscoveryOptions;
}): Promise<DiscoveryOutcome> {
    const opts: Required<DiscoveryOptions> = { ...DEFAULTS, ...(args.options ?? {}) };
    const bgr = await decodePng(args.capturePng);

    // 1. White-text HSV mask
    const hsv = bgrToHsv(bgr);
    const mask = hsvInRange(hsv, [0, 0, 180], [179, 70, 255]);

    let maskFg = 0;
    const maskData = mask.data;
    for (let i = 0; i < maskData.length; i++) if (maskData[i]! >= 128) maskFg++;
    const maskPct = (maskFg / maskData.length) * 100;
    console.log(`[OCR Discovery] HSV mask: ${maskFg}/${maskData.length} foreground pixels (${maskPct.toFixed(2)}%)`);

    if (maskFg < MIN_MASK_FG_FOR_REAL_FRAME) {
        if (args.profileId) await dumpDebug(args.profileId, args.capturePng, mask);
        return { kind: "frame-blank", maskFg };
    }

    // 2. Horizontal dilate — connect adjacent letters into one text-line blob.
    const lined = dilate(mask, 5, 1, 2);

    // 3. Connected components → bounding boxes
    const allBoxes = findConnectedComponents(lined);
    const candidates = rankCandidates(allBoxes, bgr.width, bgr.height, opts);

    console.log(`[OCR Discovery] CC found ${allBoxes.length} components → ${candidates.length} shape-valid candidates`);
    if (candidates.length === 0) {
        if (args.profileId) await dumpDebug(args.profileId, args.capturePng, mask);
        logWarn(`AutoDiscover: no shape-valid candidates (scanned ${allBoxes.length} components, ${maskFg} mask px)`, "OCR Discovery");
        return { kind: "no-shape-valid", maskFg, componentsScanned: allBoxes.length };
    }

    // 4. OCR-probe each candidate against the EXP pipeline
    for (const box of candidates) {
        // Apply padding (clamped to frame bounds)
        const padX = Math.max(0, box.x - opts.paddingPx);
        const padY = Math.max(0, box.y - opts.paddingPx);
        const padW = Math.min(bgr.width - padX, box.w + opts.paddingPx * 2);
        const padH = Math.min(bgr.height - padY, box.h + opts.paddingPx * 2);
        if (padW <= 0 || padH <= 0) continue;

        const cropped = cropBgr(bgr, padX, padY, padW, padH);
        let png: Buffer;
        try {
            png = await toPng(cropped);
        } catch {
            continue;
        }

        let response;
        try {
            response = await args.ocrWorker.recognizePng(png, { kind: "exp" });
        } catch {
            continue;
        }

        const rawRaw = typeof response?.raw === "string" ? response.raw.trim() : "";
        console.log(`[OCR Discovery] probe box=${box.x},${box.y} ${box.w}x${box.h} → ok=${response?.ok} raw="${rawRaw.slice(0, 30)}" match=${isExpPercentMatch(rawRaw)}`);
        if (!response.ok) continue;
        const raw = rawRaw;
        if (!isExpPercentMatch(raw)) continue;

        // Tighten the matched bbox to just the digit-block. Horizontal dilation
        // may have stretched the component across a yellow "Exp" label or
        // unrelated white noise; OCR-scanning the trimmed crop is much more
        // robust because nothing outside the percentage text is captured.
        const tightened = tightenToTextBlock(mask, box, {
            minColSum: Math.max(2, Math.floor(box.h * 0.25)),
            maxColGap: Math.max(3, Math.ceil(box.h * 0.4)),
            paddingPx: opts.paddingPx,
        });

        // Verify the tightened crop still OCRs as an EXP percent. Fall back to
        // the original padded bbox if it doesn't (failsafe).
        let finalX = padX, finalY = padY, finalW = padW, finalH = padH;
        let finalSample = raw;
        let finalPixelCount = box.pixelCount;
        const tightenedShrank = tightened.x !== box.x || tightened.y !== box.y
            || tightened.w !== box.w || tightened.h !== box.h;
        if (tightenedShrank) {
            try {
                const tightCrop = cropBgr(bgr, tightened.x, tightened.y, tightened.w, tightened.h);
                const tightPng = await toPng(tightCrop);
                const tightResp = await args.ocrWorker.recognizePng(tightPng, { kind: "exp" });
                const tightRaw = typeof tightResp?.raw === "string" ? tightResp.raw.trim() : "";
                const tightOk = tightResp?.ok && isExpPercentMatch(tightRaw);
                console.log(`[OCR Discovery] tightened box=${tightened.x},${tightened.y} ${tightened.w}x${tightened.h} → ok=${tightResp?.ok} raw="${tightRaw.slice(0, 30)}" match=${isExpPercentMatch(tightRaw)}`);
                if (tightOk) {
                    finalX = tightened.x;
                    finalY = tightened.y;
                    finalW = tightened.w;
                    finalH = tightened.h;
                    finalSample = tightRaw;
                    finalPixelCount = tightened.pixelCount;
                }
            } catch (err) {
                console.log(`[OCR Discovery] tightened probe failed, keeping original bbox: ${(err as Error).message}`);
            }
        }

        return {
            kind: "matched",
            result: {
                roi: {
                    x: finalX / bgr.width,
                    y: finalY / bgr.height,
                    w: finalW / bgr.width,
                    h: finalH / bgr.height,
                },
                rawSample: finalSample,
                sourceBox: { x: finalX, y: finalY, w: finalW, h: finalH, pixelCount: finalPixelCount },
            },
        };
    }

    if (args.profileId) await dumpDebug(args.profileId, args.capturePng, mask);
    logWarn(`AutoDiscover: ${candidates.length} candidates scanned, no EXP regex match`, "OCR Discovery");
    return { kind: "no-text-match", maskFg, candidatesScanned: candidates.length };
}

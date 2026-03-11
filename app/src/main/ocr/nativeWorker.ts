/**
 * Native OCR Worker – drop-in replacement for PythonOcrWorker.
 *
 * Same API: start(), stop(), isRunning(), recognizePng(png, {kind}).
 * Internally uses sharp + pixelOps + tesseractCli instead of Python subprocess.
 */

import * as path from "path";
import * as fs from "fs";
import { app } from "electron";
import { TesseractCli } from "./tesseractCli";
import type { OcrKind, OcrResponse } from "./ocrTypes";
import {
    decodePng,
    toPng,
    prepGray,
    extractGoldTextMask,
    extractGoldTextMaskWide,
    extractWhiteTextMask,
    extractBrightTextMask,
    cropBgr,
    thresholdOtsu,
    thresholdBinary,
    clahe,
    dilate,
    morphClose,
    invert,
    extractChannel,
    bgrToGray,
    resizeGray,
} from "./imagePreprocessor";
import type { RawImage } from "./pixelOps";
import { parseExpPercent, fixOcrConfusions, parseLevel } from "./ocrPostProcess";
import { debugLog } from "../debugConfig";

const FLOAT_RE = /\d+(?:[.,]\d+)?/g;

// ---------------------------------------------------------------------------
// Debug helpers
// ---------------------------------------------------------------------------

let debugMode = false;
let debugDir = "";
let debugCounter = 0;

function resolveDebugDir(customDir?: string): string {
    if (customDir) return customDir;
    try {
        return path.join(app.getPath("userData"), "user", "logs", "ocr");
    } catch {
        const fallback = process.platform === "win32"
            ? (process.env.APPDATA || process.env.LOCALAPPDATA || "")
            : (process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || "/tmp", ".config"));
        return path.join(fallback, "Flyff-U-Launcher", "ocr-debug");
    }
}

async function saveDebug(name: string, img: RawImage): Promise<void> {
    if (!debugMode) return;
    try {
        fs.mkdirSync(debugDir, { recursive: true });
        debugCounter++;
        const png = await toPng(img);
        fs.writeFileSync(path.join(debugDir, `${String(debugCounter).padStart(4, "0")}_${name}.png`), png);
    } catch { /* best effort */ }
}

// ---------------------------------------------------------------------------
// NativeOcrWorker
// ---------------------------------------------------------------------------

export class NativeOcrWorker {
    private tess: TesseractCli | null = null;
    private running = false;
    private nextId = 0;
    private pending = 0;
    private static readonly MAX_PENDING = 2;
    /** Last accepted EXP value for continuity guard (rejects impossible drops). */
    private lastExpVal: number | null = null;
    private lastExpTs = 0;

    constructor(private opts: {
        tesseractExe?: string;
        tessdata?: string;
        timeoutMs?: number;
        debugDir?: string;
    }) {}

    async start(): Promise<void> {
        if (this.running) return;

        const tesseractExe = this.opts.tesseractExe || process.env.TESSERACT_EXE || "tesseract";
        const tessdata = this.opts.tessdata || process.env.TESSDATA_PREFIX;

        this.tess = new TesseractCli({ tesseractExe, tessdata });

        // Verify tesseract is available
        try {
            const version = await this.tess.getVersion();
            debugLog("ocr", `[NativeOcrWorker] Tesseract version: ${version}`);
        } catch (err) {
            throw new Error(`Tesseract not available: ${err instanceof Error ? err.message : String(err)}`);
        }

        // Configure debug mode
        debugMode = process.env.FLYFF_OCR_DEBUG === "1";
        debugDir = resolveDebugDir(this.opts.debugDir);

        this.running = true;
        debugLog("ocr", "[NativeOcrWorker] Started");
    }

    async stop(): Promise<void> {
        this.running = false;
        this.tess = null;
    }

    isRunning(): boolean {
        return this.running;
    }

    async recognizePng(png: Buffer, opts?: { kind?: OcrKind; fontWeight?: number }): Promise<OcrResponse> {
        if (!this.running || !this.tess) {
            throw new Error("Native OCR worker not started");
        }

        if (this.pending >= NativeOcrWorker.MAX_PENDING) {
            debugLog("ocr", `[NativeOcrWorker] REJECTED - worker busy (pending=${this.pending})`);
            return { id: -1, ok: false, error: "worker_busy" };
        }

        this.pending++;
        const id = ++this.nextId;
        const kind = opts?.kind ?? "digits";

        try {
            const bgr = await decodePng(png);
            const result = await this.process(bgr, kind, opts?.fontWeight);
            result.id = id;
            return result;
        } catch (err) {
            return {
                id,
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            };
        } finally {
            this.pending--;
        }
    }

    // -----------------------------------------------------------------------
    // Main dispatch (= Python process())
    // -----------------------------------------------------------------------

    private async process(bgr: RawImage, kind: string, fontWeight?: number): Promise<OcrResponse> {
        kind = (kind || "exp").toLowerCase();

        if (kind === "exp" || kind === "digits") {
            let [val, raw] = await this.ocrExp(bgr);
            console.log(`[OCR-EXP-DEBUG] raw="${raw}" val=${val} lastExp=${this.lastExpVal}`);

            // Continuity guard: EXP only increases (or resets to ~0 on level-up).
            // Reject readings that drop significantly but aren't near zero.
            if (val !== null && this.lastExpVal !== null) {
                const drop = this.lastExpVal - val;
                const elapsed = Date.now() - this.lastExpTs;
                // Large drop (>8%) and recent (<30s): almost certainly a mis-read.
                // Level-up resets go to ~0%, so only allow drops to values < 1%.
                if (drop > 8 && val > 1 && elapsed < 30_000) {
                    // Try recovering the dropped leading digit: "4.6751" → "74.6751"
                    const recovered = this.tryRecoverLeadingDigit(val, this.lastExpVal);
                    if (recovered !== null) {
                        console.log(`[OCR-EXP-GUARD] Recovered ${val.toFixed(4)}→${recovered.toFixed(4)} (leading digit restored)`);
                        val = recovered;
                    } else {
                        console.log(`[OCR-EXP-GUARD] Rejected drop ${this.lastExpVal.toFixed(2)}→${val.toFixed(2)}, keeping last`);
                        val = this.lastExpVal;
                    }
                }
            }

            if (val !== null) {
                this.lastExpVal = val;
                this.lastExpTs = Date.now();
            }

            if (val === null) {
                if (raw) return { id: 0, ok: true, raw, value: raw, unit: "%" };
                return { id: 0, ok: false, raw, value: null, unit: "%" };
            }
            return { id: 0, ok: true, raw, value: val.toFixed(4), unit: "%" };
        }

        if (kind === "namelevel" || kind === "line") {
            const raw = await this.ocrNameLevel(bgr);
            return { id: 0, ok: true, raw, value: null, unit: null };
        }

        if (kind === "lvl") {
            const [val, raw] = await this.ocrLvl(bgr, fontWeight);
            if (val === null) return { id: 0, ok: true, raw, value: null, unit: null };
            return { id: 0, ok: true, raw, value: String(val), unit: null };
        }

        if (kind === "charname") {
            return await this.ocrCharname(bgr);
        }

        if (kind === "enemyhp") {
            const raw = await this.ocrHp(bgr);
            return { id: 0, ok: !!raw, raw, value: raw || null, unit: null };
        }

        if (kind === "enemyname") {
            return await this.ocrEnemyName(bgr);
        }

        if (kind === "lauftext") {
            return await this.ocrLauftext(bgr);
        }

        // Default fallback
        const gray = await prepGray(bgr, 3.0);
        const raw = await this.ocrLine(gray, undefined, 1.0);
        return { id: 0, ok: true, raw, value: null, unit: null };
    }

    // -----------------------------------------------------------------------
    // Tesseract call wrapper
    // -----------------------------------------------------------------------

    private async ocrLine(img: RawImage, whitelist?: string, timeout = 1.5): Promise<string> {
        if (!this.tess) return "";
        try {
            const png = await toPng(img);
            return await this.tess.recognize(png, {
                psm: 7,
                oem: 3,
                whitelist,
                timeoutMs: Math.round(timeout * 1000),
            });
        } catch (err) {
            debugLog("ocr", `[NativeOcrWorker] Tesseract error: ${err instanceof Error ? err.message : String(err)}`);
            await saveDebug("tess_error", img);
            return "";
        }
    }

    // -----------------------------------------------------------------------
    // OCR EXP (= Python ocr_exp)
    // -----------------------------------------------------------------------

    private async ocrExp(bgr: RawImage): Promise<[number | null, string]> {
        // estimateExpFillRatio disabled: unreliable (detects green game
        // environment as EXP bar), all fill-ratio-based corrections removed.
        const { width: w, height: h } = bgr;

        await saveDebug("00_input", bgr);

        const whitelist = "0123456789.,%";
        let fallbackRaw = "";

        // Crop: remove top cell border + left bar bleed-in, keep text area.
        // The white mask on this slice reliably reads "74.3795%" etc.
        // Occasional dropped leading digit is handled by continuity guard.
        const bandTop = Math.max(0, Math.floor(h * 0.1));
        const bandBottom = Math.max(bandTop + 1, Math.floor(h * 0.9));
        const textX = Math.max(0, Math.floor(w * 0.25));
        const textSlice = cropBgr(bgr, textX, bandTop, w - textX, bandBottom - bandTop);

        const tryImg = async (img: RawImage, name: string): Promise<[number | null, string]> => {
            await saveDebug(name, img);
            let raw = await this.ocrLine(img, whitelist, 1.0);
            if (raw && !fallbackRaw) fallbackRaw = raw;
            if (!raw) return [null, raw];

            let v = parseExpPercent(raw);
            const digitsOnly = raw.replace(/[^0-9]/g, "");
            console.log(`[OCR-EXP-PIPE] name="${name}" raw="${raw}" digits="${digitsOnly}" parsed=${v}`);
            if (digitsOnly.length < 4) return [null, raw];

            // Handle spaces in OCR output
            if ((v === null || v < 0.1) && raw.includes(" ")) {
                const compact = raw.replace(/ /g, "");
                let dotGuess: string | null = null;
                if (compact.length >= 6 && /^\d+$/.test(compact)) {
                    dotGuess = compact.slice(0, 2) + "." + compact.slice(2);
                }
                const candidates = dotGuess ? [compact, dotGuess] : [compact];
                for (const cand of candidates) {
                    const vCompact = parseExpPercent(cand);
                    if (vCompact !== null) {
                        v = vCompact;
                        raw = cand;
                        break;
                    }
                }
            }

            // maybePrefer5 disabled: relies on unreliable fillRatio
            if (v === null) return [null, raw];

            return [v, raw];
        };

        const tryWithBoldening = async (img: RawImage, baseName: string): Promise<[number | null, string]> => {
            const candidates: [number | null, string][] = [];

            const [valBase, rawBase] = await tryImg(img, baseName);
            candidates.push([valBase, rawBase]);

            const bold = dilate(img, 2, 2, 1);
            const [valBold, rawBold] = await tryImg(bold, baseName + "_bold");
            candidates.push([valBold, rawBold]);

            const { morphOpen } = await import("./pixelOps");
            const opened = morphOpen(img, 2, 2, 1);
            const [valOpen, rawOpen] = await tryImg(opened, baseName + "_open");
            candidates.push([valOpen, rawOpen]);

            let chosenVal: number | null = null;
            let chosenRaw = "";
            for (const [val, raw] of candidates) {
                if (val === null) continue;
                if (chosenVal === null) {
                    chosenVal = val;
                    chosenRaw = raw;
                    continue;
                }
                const prefer = this.prefer59(chosenRaw, raw);
                if (prefer === raw) {
                    chosenVal = val;
                    chosenRaw = raw;
                }
            }
            return [chosenVal, chosenRaw];
        };

        // fillRatio-based snap disabled: estimateExpFillRatio is unreliable
        // (detects green game environment as EXP bar fill).
        // OCR text is trusted directly; fixOcrConfusions handles digit errors.
        const maybeSnapToFill = (val: number | null, raw: string): [number | null, string] => {
            if (val !== null && val < 0.001) return [0.0, raw];
            return [val, raw];
        };

        const runPipeline = async (
            target: RawImage, suffix: string,
        ): Promise<[number | null, string]> => {
            // White text first: Flyff EXP text is white on green bar.
            // The vertical textBand crop removes the top cell border that
            // previously caused white mask to pick up HP/FP numbers.
            for (const scale of [5.0, 7.0]) {
                let whiteMask = await extractWhiteTextMask(target, scale);
                whiteMask = dilate(whiteMask, 2, 2, 1);
                let [val, raw] = await tryImg(whiteMask, `white_${scale}${suffix}`);
                if (val !== null) return [val, raw];
                [val, raw] = await tryImg(invert(whiteMask), `white_${scale}_inv${suffix}`);
                if (val !== null) return [val, raw];
            }

            // Grayscale fallback
            const grayLocal = bgrToGray(target);
            for (const scale of [5.0, 7.0]) {
                const scaled = await resizeGray(grayLocal, scale);
                const [, th1] = thresholdOtsu(scaled);
                let [val, raw] = await tryImg(th1, `gray_otsu_${scale}${suffix}`);
                if (val !== null) return [val, raw];
                [val, raw] = await tryImg(invert(th1), `gray_otsu_${scale}_inv${suffix}`);
                if (val !== null) return [val, raw];

                const enhanced = clahe(scaled);
                const [, th2] = thresholdOtsu(enhanced);
                [val, raw] = await tryImg(th2, `gray_clahe_${scale}${suffix}`);
                if (val !== null) return [val, raw];
                [val, raw] = await tryImg(invert(th2), `gray_clahe_${scale}_inv${suffix}`);
                if (val !== null) return [val, raw];
            }

            // Gold text fallback
            for (const scale of [5.0, 7.0]) {
                const goldMask = await extractGoldTextMaskWide(target, scale);
                let [val, raw] = await tryImg(goldMask, `gold_${scale}${suffix}`);
                if (val !== null) return [val, raw];
                const bold = dilate(goldMask, 2, 2, 1);
                [val, raw] = await tryImg(bold, `gold_${scale}_bold${suffix}`);
                if (val !== null) return [val, raw];
                [val, raw] = await tryImg(invert(goldMask), `gold_${scale}_inv${suffix}`);
                if (val !== null) return [val, raw];
            }

            return [null, ""];
        };

        // Single pipeline on textSlice (horizontally + vertically cropped).
        // white_5_txt consistently reads correct values (74.3795, 75.1185 etc.)
        // Occasional dropped leading digit handled by continuity guard.
        const [val, raw] = await runPipeline(textSlice, "");
        if (val !== null) return [val, raw];
        return [null, fallbackRaw];
    }

    // -----------------------------------------------------------------------
    // OCR Level (= Python ocr_lvl)
    // -----------------------------------------------------------------------

    private async ocrLvl(bgr: RawImage, fontWeight?: number): Promise<[number | null, string]> {
        let { width: w, height: h } = bgr;

        // Upscale small ROIs
        if (h < 20 || w < 20) {
            const scale = Math.max(4.0, 40.0 / Math.max(h, 1));
            const { resizeBgr } = await import("./imagePreprocessor");
            bgr = await resizeBgr(bgr, scale);
        }

        await saveDebug("lvl_00_input", bgr);

        const whitelist = "0123456789";
        let fallbackRaw = "";

        // Light/Thin fonts produce thin strokes that break up after thresholding.
        // Dilate the binary mask before OCR to thicken strokes back to readable width.
        const lightFont = typeof fontWeight === "number" && fontWeight < 400;

        const tryImg = async (img: RawImage, name: string): Promise<[number | null, string]> => {
            await saveDebug(`lvl_${name}`, img);
            const processImg = lightFont ? dilate(img, 2, 2, 1) : img;
            const raw = await this.ocrLine(processImg, whitelist, 1.0);
            if (raw && !fallbackRaw) fallbackRaw = raw;
            if (!raw) return [null, raw];
            const val = parseLevel(raw);
            return [val, raw];
        };

        // Method 1: Bright text extraction
        for (const scale of [4.0, 6.0]) {
            const brightMask = await extractBrightTextMask(bgr, scale);
            let [val, raw] = await tryImg(brightMask, `bright_${scale}`);
            if (val !== null) return [val, raw];
            [val, raw] = await tryImg(invert(brightMask), `bright_${scale}_inv`);
            if (val !== null) return [val, raw];
        }

        // Method 2: White text HSV
        for (const scale of [4.0, 6.0]) {
            const whiteMask = await extractWhiteTextMask(bgr, scale);
            let [val, raw] = await tryImg(whiteMask, `white_${scale}`);
            if (val !== null) return [val, raw];
            [val, raw] = await tryImg(invert(whiteMask), `white_${scale}_inv`);
            if (val !== null) return [val, raw];
        }

        // Method 3: Grayscale with Otsu
        const gray = bgrToGray(bgr);
        for (const scale of [4.0, 6.0]) {
            const scaled = await resizeGray(gray, scale);

            const [, thOtsu] = thresholdOtsu(scaled);
            let [val, raw] = await tryImg(thOtsu, `gray_otsu_${scale}`);
            if (val !== null) return [val, raw];
            [val, raw] = await tryImg(invert(thOtsu), `gray_otsu_${scale}_inv`);
            if (val !== null) return [val, raw];

            const thBright = thresholdBinary(scaled, 180);
            [val, raw] = await tryImg(thBright, `gray_bright_${scale}`);
            if (val !== null) return [val, raw];
        }

        return [null, fallbackRaw];
    }

    // -----------------------------------------------------------------------
    // OCR Charname (= Python charname)
    // -----------------------------------------------------------------------

    private async ocrCharname(bgr: RawImage): Promise<OcrResponse> {
        const sharp = await prepGray(bgr, 4.0);
        const [, thOtsu] = thresholdOtsu(sharp);
        const whitelist = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ";

        let raw = await this.ocrLine(thOtsu, whitelist, 1.0);
        if (!raw) {
            raw = await this.ocrLine(invert(thOtsu), whitelist, 1.0);
        }

        return { id: 0, ok: true, raw, value: raw ? raw.trim() : null, unit: null };
    }

    // -----------------------------------------------------------------------
    // OCR HP (= Python ocr_hp)
    // -----------------------------------------------------------------------

    private async ocrHp(bgr: RawImage): Promise<string> {
        await saveDebug("hp_00_input", bgr);
        const whitelist = "0123456789/";

        const tryImg = async (img: RawImage, name: string): Promise<string> => {
            await saveDebug(`hp_${name}`, img);
            return await this.ocrLine(img, whitelist, 1.0);
        };

        // Method 1: White text via HSV
        for (const scale of [5.0, 7.0]) {
            let whiteMask = await extractWhiteTextMask(bgr, scale);
            whiteMask = dilate(whiteMask, 2, 2, 1);
            let raw = await tryImg(whiteMask, `white_${scale}`);
            if (raw && raw.includes("/")) return raw;
            raw = await tryImg(invert(whiteMask), `white_${scale}_inv`);
            if (raw && raw.includes("/")) return raw;
        }

        // Method 2: Bright text extraction
        for (const scale of [5.0, 7.0]) {
            const brightMask = await extractBrightTextMask(bgr, scale);
            let raw = await tryImg(brightMask, `bright_${scale}`);
            if (raw && raw.includes("/")) return raw;
            raw = await tryImg(invert(brightMask), `bright_${scale}_inv`);
            if (raw && raw.includes("/")) return raw;
        }

        // Method 3: Per-channel approach
        const chNames = ["blue", "green", "red"] as const;
        for (let chIdx = 0; chIdx < 3; chIdx++) {
            const channel = extractChannel(bgr, chIdx as 0 | 1 | 2);
            for (const scale of [5.0, 7.0]) {
                const scaled = await resizeGray(channel, scale);
                const [, th] = thresholdOtsu(scaled);
                let raw = await tryImg(th, `ch_${chNames[chIdx]}_${scale}`);
                if (raw && raw.includes("/")) return raw;
                raw = await tryImg(invert(th), `ch_${chNames[chIdx]}_${scale}_inv`);
                if (raw && raw.includes("/")) return raw;
            }
        }

        // Method 4: Grayscale fallback
        const gray = bgrToGray(bgr);
        for (const scale of [5.0, 7.0]) {
            const scaled = await resizeGray(gray, scale);
            const [, th] = thresholdOtsu(scaled);
            let raw = await tryImg(th, `gray_otsu_${scale}`);
            if (raw && raw.includes("/")) return raw;
            raw = await tryImg(invert(th), `gray_otsu_${scale}_inv`);
            if (raw && raw.includes("/")) return raw;
        }

        return "";
    }

    // -----------------------------------------------------------------------
    // OCR EnemyName (= Python enemyname)
    // -----------------------------------------------------------------------

    private async ocrEnemyName(bgr: RawImage): Promise<OcrResponse> {
        const sharp = await prepGray(bgr, 4.0);
        const [, thBin] = thresholdOtsu(sharp);
        const whitelist = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz -";

        for (const img of [thBin, invert(thBin)]) {
            const raw = await this.ocrLine(img, whitelist, 1.0);
            if (raw) {
                const cleaned = raw.replace(/[^A-Za-z -]/g, "").trim();
                return { id: 0, ok: true, raw, value: cleaned || raw.trim(), unit: null };
            }
        }

        const raw = await this.ocrLine(sharp, whitelist, 1.0);
        const cleaned = (raw || "").replace(/[^A-Za-z -]/g, "").trim();
        return { id: 0, ok: true, raw, value: cleaned || (raw ? raw.trim() : null), unit: null };
    }

    // -----------------------------------------------------------------------
    // OCR Lauftext (= Python lauftext)
    // -----------------------------------------------------------------------

    private async ocrLauftext(bgr: RawImage): Promise<OcrResponse> {
        const sharp = await prepGray(bgr, 3.0);
        const [, thOtsu] = thresholdOtsu(sharp);

        let raw = await this.ocrLine(thOtsu, undefined, 1.0);
        if (!raw) {
            raw = await this.ocrLine(invert(thOtsu), undefined, 1.0);
        }

        return { id: 0, ok: true, raw, value: null, unit: null };
    }

    // -----------------------------------------------------------------------
    // OCR NameLevel (= Python ocr_namelevel)
    // -----------------------------------------------------------------------

    private async ocrNameLevel(bgr: RawImage): Promise<string> {
        const sharp = await prepGray(bgr, 3.0);
        const [, thOtsu] = thresholdOtsu(sharp);
        const inv = invert(thOtsu);
        const whitelist = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789Lv ";

        const raw1 = await this.ocrLine(thOtsu, whitelist, 1.0);
        const raw2 = await this.ocrLine(inv, whitelist, 1.0);

        return raw1.length >= raw2.length ? raw1 : raw2;
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /**
     * Try to recover a dropped leading digit.
     * e.g. "4.6751" should be "74.6751" if lastExp was ~74%.
     * Tries prepending digits 1-9 and picks the one closest to lastExp.
     */
    private tryRecoverLeadingDigit(val: number, lastExp: number): number | null {
        const valStr = val.toFixed(4);
        let best: number | null = null;
        let bestDist = Infinity;
        for (let d = 1; d <= 9; d++) {
            const candidate = parseFloat(`${d}${valStr}`);
            if (!Number.isFinite(candidate) || candidate > 100) continue;
            const dist = Math.abs(candidate - lastExp);
            if (dist < bestDist) {
                bestDist = dist;
                best = candidate;
            }
        }
        // Only accept if recovered value is within 3% of lastExp (plausible EXP gain)
        if (best !== null && bestDist <= 3 && best >= lastExp - 0.5) return best;
        return null;
    }

    private maybePrefer5(
        value: number | null, raw: string, fillRatio: number | null,
    ): [number | null, string] {
        if (value === null || fillRatio === null || !raw.includes("9")) return [value, raw];
        const target = fillRatio * 100;
        if (Math.abs(value - target) < 0.5) return [value, raw];

        const idx = raw.indexOf("9");
        const altRaw = raw.slice(0, idx) + "5" + raw.slice(idx + 1);
        const altVal = parseExpPercent(altRaw);
        if (altVal === null) return [value, raw];

        const improvement = Math.abs(value - target) - Math.abs(altVal - target);
        if (improvement >= 0.5) return [altVal, altRaw];
        return [value, raw];
    }

    private prefer59(rawA: string, rawB: string): string | null {
        const digitsA = (rawA || "").replace(/[^0-9]/g, "");
        const digitsB = (rawB || "").replace(/[^0-9]/g, "");
        if (!digitsA || !digitsB || digitsA.length !== digitsB.length) return null;

        const diffs: [string, string][] = [];
        for (let i = 0; i < digitsA.length; i++) {
            if (digitsA[i] !== digitsB[i]) diffs.push([digitsA[i]!, digitsB[i]!]);
        }

        if (diffs.length === 1) {
            const set = new Set([diffs[0]![0], diffs[0]![1]]);
            if (set.has("5") && set.has("9")) {
                return diffs[0]![0] === "5" ? rawA : rawB;
            }
        }
        return null;
    }
}

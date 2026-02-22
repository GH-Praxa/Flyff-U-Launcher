/**
 * Image preprocessing for OCR – combines sharp (resize/grayscale) with pixelOps.
 * 1:1 replacement for the Python OpenCV preprocessing pipeline.
 */

import sharp from "sharp";
import type { RawImage } from "./pixelOps";
import {
    bgrToHsv,
    hsvInRange,
    morphClose,
    dilate,
    normalize,
    thresholdOtsu,
    thresholdBinary,
    clahe as claheOp,
    bitwiseOr,
    clearBorder,
    extractChannel,
    invert,
} from "./pixelOps";

// ---------------------------------------------------------------------------
// Decode / encode
// ---------------------------------------------------------------------------

/** Decode PNG to RawImage (BGR, 3 channels). */
export async function decodePng(png: Buffer): Promise<RawImage> {
    const img = sharp(png).removeAlpha();
    const { width, height } = await img.metadata() as { width: number; height: number };
    // sharp outputs RGB; we need BGR for OpenCV-compatible pipeline
    const rgb = await img.raw().toBuffer();
    const total = width * height;
    const bgr = Buffer.allocUnsafe(total * 3);
    for (let i = 0; i < total; i++) {
        bgr[i * 3] = rgb[i * 3 + 2]!;     // B
        bgr[i * 3 + 1] = rgb[i * 3 + 1]!; // G
        bgr[i * 3 + 2] = rgb[i * 3]!;       // R
    }
    return { data: bgr, width, height, channels: 3 };
}

/** Encode RawImage (grayscale) to PNG buffer for Tesseract. */
export async function toPng(src: RawImage): Promise<Buffer> {
    if (src.channels === 1) {
        return sharp(src.data, {
            raw: { width: src.width, height: src.height, channels: 1 },
        }).png().toBuffer();
    }
    // BGR -> RGB for sharp
    const { width, height, data } = src;
    const total = width * height;
    const rgb = Buffer.allocUnsafe(total * 3);
    for (let i = 0; i < total; i++) {
        rgb[i * 3] = data[i * 3 + 2]!;     // R
        rgb[i * 3 + 1] = data[i * 3 + 1]!; // G
        rgb[i * 3 + 2] = data[i * 3]!;       // B
    }
    return sharp(rgb, {
        raw: { width, height, channels: 3 },
    }).png().toBuffer();
}

// ---------------------------------------------------------------------------
// Resize helpers using sharp
// ---------------------------------------------------------------------------

/** Resize a grayscale RawImage using cubic interpolation. */
async function resizeGray(src: RawImage, scale: number): Promise<RawImage> {
    const newW = Math.round(src.width * scale);
    const newH = Math.round(src.height * scale);
    const buf = await sharp(src.data, {
        raw: { width: src.width, height: src.height, channels: 1 },
    }).resize(newW, newH, { kernel: "cubic" }).raw().toBuffer();
    return { data: buf, width: newW, height: newH, channels: 1 };
}

/** Resize a BGR RawImage. */
async function resizeBgr(src: RawImage, scale: number): Promise<RawImage> {
    const newW = Math.round(src.width * scale);
    const newH = Math.round(src.height * scale);
    // sharp expects RGB
    const { width, height, data } = src;
    const total = width * height;
    const rgb = Buffer.allocUnsafe(total * 3);
    for (let i = 0; i < total; i++) {
        rgb[i * 3] = data[i * 3 + 2]!;
        rgb[i * 3 + 1] = data[i * 3 + 1]!;
        rgb[i * 3 + 2] = data[i * 3]!;
    }
    const resizedRgb = await sharp(rgb, {
        raw: { width, height, channels: 3 },
    }).resize(newW, newH, { kernel: "cubic" }).raw().toBuffer();
    // Back to BGR
    const resizedTotal = newW * newH;
    const bgr = Buffer.allocUnsafe(resizedTotal * 3);
    for (let i = 0; i < resizedTotal; i++) {
        bgr[i * 3] = resizedRgb[i * 3 + 2]!;
        bgr[i * 3 + 1] = resizedRgb[i * 3 + 1]!;
        bgr[i * 3 + 2] = resizedRgb[i * 3]!;
    }
    return { data: bgr, width: newW, height: newH, channels: 3 };
}

// ---------------------------------------------------------------------------
// BGR → Grayscale
// ---------------------------------------------------------------------------

function bgrToGray(src: RawImage): RawImage {
    if (src.channels !== 3) throw new Error("bgrToGray requires 3-channel image");
    const { width, height, data } = src;
    const total = width * height;
    const out = Buffer.allocUnsafe(total);
    for (let i = 0; i < total; i++) {
        const off = i * 3;
        // OpenCV: gray = 0.114*B + 0.587*G + 0.299*R
        out[i] = Math.round(0.114 * data[off]! + 0.587 * data[off + 1]! + 0.299 * data[off + 2]!);
    }
    return { data: out, width, height, channels: 1 };
}

// ---------------------------------------------------------------------------
// Preprocessing pipelines (matching Python ocr_worker.py)
// ---------------------------------------------------------------------------

/**
 * _prep_gray equivalent: BGR → grayscale → resize(scale) → normalize.
 */
export async function prepGray(bgr: RawImage, scale = 4.0): Promise<RawImage> {
    const gray = bgrToGray(bgr);
    const scaled = await resizeGray(gray, scale);
    return normalize(scaled);
}

/**
 * Extract gold/amber text mask using HSV filtering (= Python _extract_gold_text_mask).
 */
export async function extractGoldTextMask(bgr: RawImage, scale = 5.0): Promise<RawImage> {
    const hsv = bgrToHsv(bgr);
    // Resize in HSV space (same as Python: resize after conversion)
    const scaledHsv = await resizeHsv(hsv, scale);
    // Gold/amber range: H 15-42, S 90-255, V 120-255
    const mask = hsvInRange(scaledHsv, [15, 90, 120], [42, 255, 255]);
    return morphClose(mask, 3, 3, 2);
}

/**
 * Wide gold text mask (wider thresholds for faint digits).
 */
export async function extractGoldTextMaskWide(bgr: RawImage, scale = 5.0): Promise<RawImage> {
    const hsv = bgrToHsv(bgr);
    const scaledHsv = await resizeHsv(hsv, scale);
    // Wider range: H 12-48, S 60-255, V 100-255
    const mask = hsvInRange(scaledHsv, [12, 60, 100], [48, 255, 255]);
    return morphClose(mask, 3, 3, 2);
}

/**
 * Extract white/light text mask (= Python _extract_white_text_mask).
 */
export async function extractWhiteTextMask(bgr: RawImage, scale = 6.0): Promise<RawImage> {
    const hsv = bgrToHsv(bgr);
    const scaledHsv = await resizeHsv(hsv, scale);
    // White/light: H 0-179, S 0-70, V 180-255
    const mask = hsvInRange(scaledHsv, [0, 0, 180], [179, 70, 255]);
    return morphClose(mask, 2, 2, 2);
}

/**
 * Extract bright text mask (= Python _extract_bright_text_mask).
 */
export async function extractBrightTextMask(bgr: RawImage, scale = 6.0): Promise<RawImage> {
    const gray = bgrToGray(bgr);
    const scaled = await resizeGray(gray, scale);
    // Simple threshold at 180
    const mask = thresholdBinary(scaled, 180);
    // Clear border artifacts
    const border = Math.round(scale * 2);
    return clearBorder(mask, border);
}

// ---------------------------------------------------------------------------
// EXP fill ratio estimation (= Python _estimate_exp_fill_ratio)
// ---------------------------------------------------------------------------

export function estimateExpFillRatio(bgr: RawImage): number | null {
    const { width: w, height: h, data } = bgr;
    if (h < 6 || w < 10) return null;

    function buildMask(
        bandData: Buffer, bandW: number, bandH: number, tight: boolean,
    ): Uint8Array {
        const total = bandW * bandH;
        const mask = new Uint8Array(total);

        // Convert band to HSV
        const hsvBuf = Buffer.allocUnsafe(total * 3);
        for (let i = 0; i < total; i++) {
            const off = i * 3;
            const b = bandData[off]!;
            const g = bandData[off + 1]!;
            const r = bandData[off + 2]!;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const d = max - min;
            let hVal = 0;
            if (d !== 0) {
                if (max === r) hVal = 30 * ((g - b) / d + (g < b ? 6 : 0));
                else if (max === g) hVal = 30 * ((b - r) / d + 2);
                else hVal = 30 * ((r - g) / d + 4);
            }
            hVal = Math.round(hVal);
            if (hVal < 0) hVal += 180;
            if (hVal >= 180) hVal -= 180;
            hsvBuf[off] = hVal;
            hsvBuf[off + 1] = max === 0 ? 0 : Math.round((d / max) * 255);
            hsvBuf[off + 2] = max;
        }

        const [hLow, sLow, vLow] = tight ? [75, 40, 90] : [60, 25, 70];
        const [hHigh, sHigh, vHigh] = tight ? [125, 255, 255] : [140, 255, 255];

        for (let i = 0; i < total; i++) {
            const off = i * 3;
            const hv = hsvBuf[off]!;
            const sv = hsvBuf[off + 1]!;
            const vv = hsvBuf[off + 2]!;
            if (hv >= hLow && hv <= hHigh && sv >= sLow && sv <= sHigh && vv >= vLow && vv <= vHigh) {
                mask[i] = 255;
            }
        }

        // Supplemental BGR heuristic
        for (let i = 0; i < total; i++) {
            const off = i * 3;
            const b = bandData[off]!;
            const g = bandData[off + 1]!;
            const r = bandData[off + 2]!;
            if ((b - r > 40) && (b - g > 10) && b > 90) {
                mask[i] = 255;
            }
        }

        // Horizontal morph close (3,1) – simplified: dilate then erode horizontally
        const closed = new Uint8Array(total);
        for (let y = 0; y < bandH; y++) {
            for (let x = 0; x < bandW; x++) {
                let maxV = 0;
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx;
                    if (nx >= 0 && nx < bandW) maxV = Math.max(maxV, mask[y * bandW + nx]!);
                }
                closed[y * bandW + x] = maxV;
            }
        }
        const result = new Uint8Array(total);
        for (let y = 0; y < bandH; y++) {
            for (let x = 0; x < bandW; x++) {
                let minV = 255;
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx;
                    if (nx >= 0 && nx < bandW) minV = Math.min(minV, closed[y * bandW + nx]!);
                }
                result[y * bandW + x] = minV;
            }
        }

        if (!tight) {
            // Light dilation (5,1) to merge split bar segments
            const dilated = new Uint8Array(total);
            for (let y = 0; y < bandH; y++) {
                for (let x = 0; x < bandW; x++) {
                    let maxV = 0;
                    for (let dx = -2; dx <= 2; dx++) {
                        const nx = x + dx;
                        if (nx >= 0 && nx < bandW) maxV = Math.max(maxV, result[y * bandW + nx]!);
                    }
                    dilated[y * bandW + x] = maxV;
                }
            }
            return dilated;
        }
        return result;
    }

    // Sample central band
    const top = Math.max(0, Math.floor(h * 0.2));
    const bottom = Math.max(top + 1, Math.floor(h * 0.8));
    const bandH = bottom - top;
    const bandData = Buffer.allocUnsafe(w * bandH * 3);
    for (let y = 0; y < bandH; y++) {
        data.copy(bandData, y * w * 3, (y + top) * w * 3, (y + top + 1) * w * 3);
    }

    let mask = buildMask(bandData, w, bandH, true);

    // If missed, retry with wider thresholds on lower half
    if (!mask.some((v) => v > 0)) {
        const lowerTop = Math.floor(h * 0.45);
        const lowerH = h - lowerTop;
        const lowerData = Buffer.allocUnsafe(w * lowerH * 3);
        for (let y = 0; y < lowerH; y++) {
            data.copy(lowerData, y * w * 3, (y + lowerTop) * w * 3, (y + lowerTop + 1) * w * 3);
        }
        mask = buildMask(lowerData, w, lowerH, false);
        if (!mask.some((v) => v > 0)) return 0.0;
    }

    const maskW = w;
    const maskH = mask.length / maskW;

    // Check minimal fill
    const nonZero = mask.reduce((a, v) => a + (v > 0 ? 1 : 0), 0);
    if (nonZero / mask.length < 0.02) return 0.0;

    // Find fill columns (ignoring right-most 10%)
    const cutoff = Math.floor(w * 0.9);
    let minCol = w, maxCol = 0;
    for (let y = 0; y < maskH; y++) {
        for (let x = 0; x < cutoff; x++) {
            if (mask[y * maskW + x]! > 0) {
                if (x < minCol) minCol = x;
                if (x > maxCol) maxCol = x;
            }
        }
    }
    if (minCol > maxCol) return null;

    let span = maxCol - minCol + 1;

    // Small padding for gradient fade-out
    if (span / w > 0.1 && span / w < 0.9) {
        span = Math.min(w - minCol, span + 6);
    }

    // Guard against tiny stray hits
    if (span < Math.max(4, Math.floor(w * 0.03))) return null;

    // Require fill to start near the left edge
    if (minCol > w * 0.45) return null;

    const denom = Math.max(1, w - minCol);
    return Math.max(0, Math.min(1, span / denom));
}

// ---------------------------------------------------------------------------
// Crop helpers
// ---------------------------------------------------------------------------

/** Crop a BGR RawImage. */
export function cropBgr(src: RawImage, x: number, y: number, w: number, h: number): RawImage {
    const out = Buffer.allocUnsafe(w * h * 3);
    for (let row = 0; row < h; row++) {
        src.data.copy(out, row * w * 3, ((y + row) * src.width + x) * 3, ((y + row) * src.width + x + w) * 3);
    }
    return { data: out, width: w, height: h, channels: 3 };
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/** Resize a 3-channel HSV image (reuse BGR resize path since it's just 3 channels). */
async function resizeHsv(hsv: RawImage, scale: number): Promise<RawImage> {
    if (scale === 1) return hsv;
    const newW = Math.round(hsv.width * scale);
    const newH = Math.round(hsv.height * scale);
    // Treat HSV channels as raw 3-channel data for resizing
    const resized = await sharp(hsv.data, {
        raw: { width: hsv.width, height: hsv.height, channels: 3 },
    }).resize(newW, newH, { kernel: "cubic" }).raw().toBuffer();
    return { data: resized, width: newW, height: newH, channels: 3 };
}

// Re-export pixelOps functions used by nativeWorker
export {
    thresholdOtsu,
    thresholdBinary,
    claheOp as clahe,
    dilate,
    morphClose,
    bitwiseOr,
    invert,
    extractChannel,
    normalize,
    bgrToGray,
    resizeGray,
    resizeBgr,
};

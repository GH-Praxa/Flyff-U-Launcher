/**
 * Pixel-level image operations in pure TypeScript.
 * Replaces OpenCV functions used by the Python OCR worker.
 *
 * All images use the RawImage format with interleaved channel data.
 * Grayscale images have channels=1, color images channels=3 (BGR order).
 */

export interface RawImage {
    data: Buffer;
    width: number;
    height: number;
    channels: 1 | 3;
}

// ---------------------------------------------------------------------------
// Color conversion
// ---------------------------------------------------------------------------

/** Convert BGR image to HSV (OpenCV convention: H 0-180, S 0-255, V 0-255). */
export function bgrToHsv(src: RawImage): RawImage {
    if (src.channels !== 3) throw new Error("bgrToHsv requires 3-channel image");
    const { width, height, data } = src;
    const total = width * height;
    const out = Buffer.allocUnsafe(total * 3);

    for (let i = 0; i < total; i++) {
        const off = i * 3;
        const b = data[off]!;
        const g = data[off + 1]!;
        const r = data[off + 2]!;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;

        // V
        const v = max;

        // S
        const s = max === 0 ? 0 : Math.round((d / max) * 255);

        // H (OpenCV: 0-180)
        let h = 0;
        if (d !== 0) {
            if (max === r) {
                h = 30 * ((g - b) / d + (g < b ? 6 : 0)); // 60/2 = 30
            } else if (max === g) {
                h = 30 * ((b - r) / d + 2);
            } else {
                h = 30 * ((r - g) / d + 4);
            }
        }
        h = Math.round(h);
        if (h < 0) h += 180;
        if (h >= 180) h -= 180;

        out[off] = h;
        out[off + 1] = s;
        out[off + 2] = v;
    }

    return { data: out, width, height, channels: 3 };
}

// ---------------------------------------------------------------------------
// Range filtering
// ---------------------------------------------------------------------------

/**
 * HSV in-range filter (like cv2.inRange).
 * lower/upper are [H, S, V] tuples. Returns single-channel mask (0 or 255).
 */
export function hsvInRange(
    hsv: RawImage,
    lower: [number, number, number],
    upper: [number, number, number],
): RawImage {
    if (hsv.channels !== 3) throw new Error("hsvInRange requires 3-channel HSV image");
    const { width, height, data } = hsv;
    const total = width * height;
    const out = Buffer.allocUnsafe(total);

    for (let i = 0; i < total; i++) {
        const off = i * 3;
        const h = data[off]!;
        const s = data[off + 1]!;
        const v = data[off + 2]!;
        out[i] = (h >= lower[0] && h <= upper[0] &&
            s >= lower[1] && s <= upper[1] &&
            v >= lower[2] && v <= upper[2]) ? 255 : 0;
    }

    return { data: out, width, height, channels: 1 };
}

// ---------------------------------------------------------------------------
// CLAHE (Contrast Limited Adaptive Histogram Equalization)
// ---------------------------------------------------------------------------

export function clahe(
    src: RawImage,
    clipLimit = 2.0,
    tileGridW = 8,
    tileGridH = 8,
): RawImage {
    if (src.channels !== 1) throw new Error("clahe requires grayscale image");
    const { width, height, data } = src;
    const out = Buffer.allocUnsafe(width * height);

    const tileW = Math.ceil(width / tileGridW);
    const tileH = Math.ceil(height / tileGridH);
    const clipCount = Math.max(1, Math.round(clipLimit * tileW * tileH / 256));

    // Build histogram for each tile
    const histograms: number[][] = [];
    const cdfs: number[][] = [];
    const tileCounts: number[] = [];

    for (let ty = 0; ty < tileGridH; ty++) {
        for (let tx = 0; tx < tileGridW; tx++) {
            const x0 = tx * tileW;
            const y0 = ty * tileH;
            const x1 = Math.min(x0 + tileW, width);
            const y1 = Math.min(y0 + tileH, height);

            const hist = new Array<number>(256).fill(0);
            let count = 0;
            for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                    hist[data[y * width + x]!]++;
                    count++;
                }
            }

            // Clip histogram
            let excess = 0;
            for (let i = 0; i < 256; i++) {
                if (hist[i]! > clipCount) {
                    excess += hist[i]! - clipCount;
                    hist[i] = clipCount;
                }
            }
            const avgAdd = Math.floor(excess / 256);
            const remainder = excess - avgAdd * 256;
            for (let i = 0; i < 256; i++) {
                hist[i]! += avgAdd;
            }
            // Distribute remainder evenly
            const step = Math.max(1, Math.floor(256 / (remainder + 1)));
            for (let i = 0, r = remainder; i < 256 && r > 0; i += step, r--) {
                hist[i]!++;
            }

            // CDF
            const cdf = new Array<number>(256);
            cdf[0] = hist[0]!;
            for (let i = 1; i < 256; i++) {
                cdf[i] = cdf[i - 1]! + hist[i]!;
            }

            histograms.push(hist);
            cdfs.push(cdf);
            tileCounts.push(count);
        }
    }

    // Map each pixel using bilinear interpolation of surrounding tile CDFs
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const px = data[y * width + x]!;

            // Find tile center coordinates
            const fTx = (x + 0.5) / tileW - 0.5;
            const fTy = (y + 0.5) / tileH - 0.5;

            const tx0 = Math.max(0, Math.floor(fTx));
            const ty0 = Math.max(0, Math.floor(fTy));
            const tx1 = Math.min(tileGridW - 1, tx0 + 1);
            const ty1 = Math.min(tileGridH - 1, ty0 + 1);

            const ax = Math.max(0, Math.min(1, fTx - tx0));
            const ay = Math.max(0, Math.min(1, fTy - ty0));

            const mapVal = (txi: number, tyi: number): number => {
                const idx = tyi * tileGridW + txi;
                const cdf = cdfs[idx]!;
                const count = tileCounts[idx]!;
                if (count === 0) return px;
                return Math.round((cdf[px]! / count) * 255);
            };

            const v00 = mapVal(tx0, ty0);
            const v10 = mapVal(tx1, ty0);
            const v01 = mapVal(tx0, ty1);
            const v11 = mapVal(tx1, ty1);

            const top = v00 * (1 - ax) + v10 * ax;
            const bottom = v01 * (1 - ax) + v11 * ax;
            const val = Math.round(top * (1 - ay) + bottom * ay);

            out[y * width + x] = Math.max(0, Math.min(255, val));
        }
    }

    return { data: out, width, height, channels: 1 };
}

// ---------------------------------------------------------------------------
// Morphological operations
// ---------------------------------------------------------------------------

/** Dilate a single-channel image with a rectangular kernel. */
export function dilate(src: RawImage, kw: number, kh: number, iterations = 1): RawImage {
    if (src.channels !== 1) throw new Error("dilate requires grayscale image");
    let current = src;
    for (let iter = 0; iter < iterations; iter++) {
        const { width, height, data } = current;
        const out = Buffer.allocUnsafe(width * height);
        const hw = Math.floor(kw / 2);
        const hh = Math.floor(kh / 2);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let maxVal = 0;
                for (let dy = -hh; dy <= hh; dy++) {
                    const ny = y + dy;
                    if (ny < 0 || ny >= height) continue;
                    for (let dx = -hw; dx <= hw; dx++) {
                        const nx = x + dx;
                        if (nx < 0 || nx >= width) continue;
                        const v = data[ny * width + nx]!;
                        if (v > maxVal) maxVal = v;
                    }
                }
                out[y * width + x] = maxVal;
            }
        }
        current = { data: out, width, height, channels: 1 };
    }
    return current;
}

/** Erode a single-channel image with a rectangular kernel. */
export function erode(src: RawImage, kw: number, kh: number, iterations = 1): RawImage {
    if (src.channels !== 1) throw new Error("erode requires grayscale image");
    let current = src;
    for (let iter = 0; iter < iterations; iter++) {
        const { width, height, data } = current;
        const out = Buffer.allocUnsafe(width * height);
        const hw = Math.floor(kw / 2);
        const hh = Math.floor(kh / 2);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let minVal = 255;
                for (let dy = -hh; dy <= hh; dy++) {
                    const ny = y + dy;
                    if (ny < 0 || ny >= height) continue;
                    for (let dx = -hw; dx <= hw; dx++) {
                        const nx = x + dx;
                        if (nx < 0 || nx >= width) continue;
                        const v = data[ny * width + nx]!;
                        if (v < minVal) minVal = v;
                    }
                }
                out[y * width + x] = minVal;
            }
        }
        current = { data: out, width, height, channels: 1 };
    }
    return current;
}

/** Morphological close: dilate then erode. */
export function morphClose(src: RawImage, kw: number, kh: number, iterations = 1): RawImage {
    return erode(dilate(src, kw, kh, iterations), kw, kh, iterations);
}

/** Morphological open: erode then dilate. */
export function morphOpen(src: RawImage, kw: number, kh: number, iterations = 1): RawImage {
    return dilate(erode(src, kw, kh, iterations), kw, kh, iterations);
}

// ---------------------------------------------------------------------------
// Thresholding
// ---------------------------------------------------------------------------

/** Otsu's method threshold on grayscale image. Returns [threshold, binaryImage]. */
export function thresholdOtsu(src: RawImage): [number, RawImage] {
    if (src.channels !== 1) throw new Error("thresholdOtsu requires grayscale image");
    const { width, height, data } = src;
    const total = width * height;

    // Build histogram
    const hist = new Array<number>(256).fill(0);
    for (let i = 0; i < total; i++) {
        hist[data[i]!]++;
    }

    // Otsu's algorithm
    let sumAll = 0;
    for (let i = 0; i < 256; i++) sumAll += i * hist[i]!;

    let sumBg = 0;
    let wBg = 0;
    let maxVariance = -1;
    let bestT = 0;

    for (let t = 0; t < 256; t++) {
        wBg += hist[t]!;
        if (wBg === 0) continue;
        const wFg = total - wBg;
        if (wFg === 0) break;
        sumBg += t * hist[t]!;
        const meanBg = sumBg / wBg;
        const meanFg = (sumAll - sumBg) / wFg;
        const variance = wBg * wFg * (meanBg - meanFg) * (meanBg - meanFg);
        if (variance > maxVariance) {
            maxVariance = variance;
            bestT = t;
        }
    }

    // Apply threshold
    const out = Buffer.allocUnsafe(total);
    for (let i = 0; i < total; i++) {
        out[i] = data[i]! > bestT ? 255 : 0;
    }

    return [bestT, { data: out, width, height, channels: 1 }];
}

/** Fixed binary threshold. */
export function thresholdBinary(src: RawImage, thresh: number): RawImage {
    if (src.channels !== 1) throw new Error("thresholdBinary requires grayscale image");
    const { width, height, data } = src;
    const total = width * height;
    const out = Buffer.allocUnsafe(total);
    for (let i = 0; i < total; i++) {
        out[i] = data[i]! > thresh ? 255 : 0;
    }
    return { data: out, width, height, channels: 1 };
}

/** Adaptive threshold (Gaussian-weighted mean of local neighborhood). */
export function adaptiveThresholdGaussian(
    src: RawImage,
    maxVal: number,
    blockSize: number,
    C: number,
): RawImage {
    if (src.channels !== 1) throw new Error("adaptiveThresholdGaussian requires grayscale image");
    const { width, height, data } = src;
    const total = width * height;
    const out = Buffer.allocUnsafe(total);
    const half = Math.floor(blockSize / 2);

    // Precompute Gaussian kernel weights
    const sigma = blockSize * 0.5;
    const kernel: number[] = new Array(blockSize);
    let kSum = 0;
    for (let i = 0; i < blockSize; i++) {
        const d = i - half;
        kernel[i] = Math.exp(-(d * d) / (2 * sigma * sigma));
        kSum += kernel[i]!;
    }
    for (let i = 0; i < blockSize; i++) kernel[i]! /= kSum;

    // Separable Gaussian blur for speed: horizontal pass
    const tmp = new Float32Array(total);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            let wt = 0;
            for (let k = -half; k <= half; k++) {
                const nx = x + k;
                if (nx < 0 || nx >= width) continue;
                const w = kernel[k + half]!;
                sum += data[y * width + nx]! * w;
                wt += w;
            }
            tmp[y * width + x] = sum / wt;
        }
    }

    // Vertical pass + threshold
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            let wt = 0;
            for (let k = -half; k <= half; k++) {
                const ny = y + k;
                if (ny < 0 || ny >= height) continue;
                const w = kernel[k + half]!;
                sum += tmp[ny * width + x]! * w;
                wt += w;
            }
            const localMean = sum / wt;
            out[y * width + x] = data[y * width + x]! > (localMean - C) ? maxVal : 0;
        }
    }

    return { data: out, width, height, channels: 1 };
}

// ---------------------------------------------------------------------------
// Basic pixel operations
// ---------------------------------------------------------------------------

/** Invert a single-channel image. */
export function invert(src: RawImage): RawImage {
    if (src.channels !== 1) throw new Error("invert requires grayscale image");
    const { width, height, data } = src;
    const total = width * height;
    const out = Buffer.allocUnsafe(total);
    for (let i = 0; i < total; i++) {
        out[i] = 255 - data[i]!;
    }
    return { data: out, width, height, channels: 1 };
}

/** Bitwise OR of two single-channel images. */
export function bitwiseOr(a: RawImage, b: RawImage): RawImage {
    if (a.channels !== 1 || b.channels !== 1) throw new Error("bitwiseOr requires grayscale images");
    if (a.width !== b.width || a.height !== b.height) throw new Error("bitwiseOr: size mismatch");
    const total = a.width * a.height;
    const out = Buffer.allocUnsafe(total);
    for (let i = 0; i < total; i++) {
        out[i] = a.data[i]! | b.data[i]!;
    }
    return { data: out, width: a.width, height: a.height, channels: 1 };
}

/** Normalize grayscale image to 0-255 range. */
export function normalize(src: RawImage): RawImage {
    if (src.channels !== 1) throw new Error("normalize requires grayscale image");
    const { width, height, data } = src;
    const total = width * height;

    let min = 255, max = 0;
    for (let i = 0; i < total; i++) {
        const v = data[i]!;
        if (v < min) min = v;
        if (v > max) max = v;
    }

    const out = Buffer.allocUnsafe(total);
    const range = max - min;
    if (range === 0) {
        out.fill(0);
    } else {
        for (let i = 0; i < total; i++) {
            out[i] = Math.round(((data[i]! - min) / range) * 255);
        }
    }
    return { data: out, width, height, channels: 1 };
}

/** Extract a single channel from a 3-channel BGR image. ch: 0=B, 1=G, 2=R */
export function extractChannel(src: RawImage, ch: 0 | 1 | 2): RawImage {
    if (src.channels !== 3) throw new Error("extractChannel requires 3-channel image");
    const { width, height, data } = src;
    const total = width * height;
    const out = Buffer.allocUnsafe(total);
    for (let i = 0; i < total; i++) {
        out[i] = data[i * 3 + ch]!;
    }
    return { data: out, width, height, channels: 1 };
}

/** Clear border pixels (set to 0) on a single-channel image. */
export function clearBorder(src: RawImage, border: number): RawImage {
    const { width, height, data } = src;
    const out = Buffer.from(data);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (y < border || y >= height - border || x < border || x >= width - border) {
                out[y * width + x] = 0;
            }
        }
    }
    return { data: out, width, height, channels: 1 };
}

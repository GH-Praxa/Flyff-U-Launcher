/**
 * OCR post-processing – 1:1 port of the Python ocr_worker.py post-processing logic.
 */

const FLOAT_RE = /\d+(?:[.,]\d+)?/g;

/**
 * Fix common OCR character confusions for EXP values.
 * Handles 7↔1 and 5↔9 confusion near decimal boundary.
 */
export function fixOcrConfusions(text: string): string {
    if (!text || text.length < 5) return text;

    // Normalize
    let t = text.replace(/,/g, ".").replace(/ /g, "");
    const result = [...t];

    // Case 1: With decimal point (X7.1XXX -> X7.7XXX)
    const dotPos = t.indexOf(".");
    if (dotPos > 0 && dotPos + 1 < result.length) {
        const digitBefore = result[dotPos - 1]!;
        const digitAfter = result[dotPos + 1]!;

        if (digitBefore === "7" && digitAfter === "1") {
            result[dotPos + 1] = "7";
        } else if (
            (digitBefore === "5" || digitBefore === "9") &&
            (digitAfter === "5" || digitAfter === "9") &&
            digitBefore !== digitAfter
        ) {
            result[dotPos + 1] = digitBefore;
        }

        return result.join("");
    }

    // Case 2: Without decimal point (OCR dropped it)
    const digitsOnly = t.replace(/[^0-9]/g, "");
    if (digitsOnly.length >= 5 && digitsOnly.length <= 7) {
        const dr = [...digitsOnly];

        let boundaryIdx: number | null = null;
        if (dr.length === 5) boundaryIdx = 0;
        else if (dr.length === 6) boundaryIdx = 1;
        else if (dr.length === 7) boundaryIdx = 2;

        if (boundaryIdx !== null && boundaryIdx < dr.length - 1) {
            const digitBefore = dr[boundaryIdx]!;
            const digitAfter = dr[boundaryIdx + 1]!;

            if (digitBefore === "7" && digitAfter === "1") {
                dr[boundaryIdx + 1] = "7";
            } else if (
                (digitBefore === "5" || digitBefore === "9") &&
                (digitAfter === "5" || digitAfter === "9") &&
                digitBefore !== digitAfter
            ) {
                dr[boundaryIdx + 1] = digitBefore;
            }
        }

        return dr.join("");
    }

    return result.join("");
}

/**
 * Parse EXP percent from OCR text.
 * Handles implied decimal point (e.g. "850000" -> 85.0000%).
 */
export function parseExpPercent(text: string): number | null {
    if (!text) return null;

    let t = text.trim().replace(/\n/g, "").replace(/ /g, "");

    // Fix common OCR confusions
    t = fixOcrConfusions(t);

    // Cheap fixes for rare OCR confusions
    t = t.replace(/[Oo]/g, "0");
    t = t.replace(/,/g, ".").replace(/%/g, "");

    const matches = t.match(FLOAT_RE);
    if (!matches) return null;

    const vals: number[] = [];

    for (const token of matches) {
        const tok = token.replace(/,/g, ".");

        // Implied 4 decimals if OCR dropped the dot
        if (!tok.includes(".") && /^\d+$/.test(tok) && tok.length >= 5 && tok.length <= 7) {
            const v = parseInt(tok, 10) / 10000.0;
            if (v >= 0 && v <= 100) {
                vals.push(v);
            }
            continue;
        }

        const v = parseFloat(tok);
        if (Number.isFinite(v) && v >= 0 && v <= 100) {
            vals.push(v);
        }
    }

    if (vals.length === 0) return null;

    // Return most common value (Counter.most_common(1))
    const counts = new Map<number, number>();
    for (const v of vals) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    let best: number | null = null;
    let bestCount = 0;
    for (const [v, c] of counts) {
        if (c > bestCount) {
            bestCount = c;
            best = v;
        }
    }
    return best;
}

/**
 * Parse level from OCR text (digits only, 1-999).
 */
export function parseLevel(text: string): number | null {
    if (!text) return null;
    const digits = text.replace(/[^0-9]/g, "");
    if (!digits) return null;
    const val = parseInt(digits, 10);
    if (val >= 1 && val <= 999) return val;
    return null;
}

/**
 * Parse HP format "current/max" from OCR text.
 */
export function parseHp(text: string): string {
    if (!text) return "";
    const match = text.match(/(\d[\d.,]*)\s*[/|]\s*(\d[\d.,]*)/);
    if (match) return `${match[1]}/${match[2]}`;
    return text;
}

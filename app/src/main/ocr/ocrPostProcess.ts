/**
 * OCR post-processing – 1:1 port of the Python ocr_worker.py post-processing logic.
 */

const FLOAT_RE = /\d+(?:[.,]\d+)?/g;

/**
 * Fix common OCR character confusions for EXP values.
 * Disabled: the 5↔9 and 7↔1 heuristics near the decimal boundary caused
 * more harm than good (e.g. "75.9125" → "75.5125"). The continuity guard
 * in nativeWorker.ts now handles mis-reads instead.
 */
export function fixOcrConfusions(text: string): string {
    return text;
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
            // Reject implausible values: below 5% is almost always OCR garbage
            // (e.g. "20000" → 2.0, "10000" → 1.0). Real exp text with 5+ digits
            // like "719373" → 71.9373 always produces values >= 5.
            if (v >= 5 && v <= 100) {
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
 *
 * Tesseract liest am ROI-Rand gelegentlich Artefakte als fuehrende Ziffer
 * mit (z. B. das "v" von "Lv142" wird zu einer "1" → "1142" statt "142",
 * oder ein Border-Stueck wird als "1" missinterpretiert). Wuerden wir
 * solche >999-Werte ohne Korrektur als null abweisen, faellt der ocrLvl-
 * Pipeline-Reaktor auf die Bright/White/Otsu-Methoden zurueck — die fuer
 * cyan-farbene Ziffern fast leere Masken liefern und aus Bildrauschen
 * dann ein einzelnes "2" oder "7" hallucinieren (live verifiziert
 * 2026-05-21). Pragmatik: Flyff-Level sind dreistellig, also bei >3
 * gelesenen Ziffern die letzten drei als wahre Lesung behandeln.
 */
export function parseLevel(text: string): number | null {
    if (!text) return null;
    let digits = text.replace(/[^0-9]/g, "");
    if (!digits) return null;
    if (digits.length > 3) digits = digits.slice(-3);
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

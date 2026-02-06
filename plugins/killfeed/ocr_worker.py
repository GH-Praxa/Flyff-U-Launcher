#!/usr/bin/env python3
"""
stdin JSONL -> stdout JSONL

Input:
  {"id": 1, "png_b64": "...", "kind": "exp"|"namelevel"|"lvl"|"charname"|"lauftext"}

Output:
  {"id":1, "ok":true, "raw":"...", "value":"75.0000", "unit":"%"}
"""
import sys, json, base64, re, os
from collections import Counter
from typing import Optional, Tuple
from pathlib import Path

import numpy as np
import cv2
import pytesseract

TESSERACT_EXE = os.environ.get("TESSERACT_EXE")
if TESSERACT_EXE and os.path.isfile(TESSERACT_EXE):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_EXE
    _tess_dir = str(Path(TESSERACT_EXE).parent)
    if _tess_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = _tess_dir + os.pathsep + os.environ.get("PATH", "")
    candidate = Path(_tess_dir) / "tessdata"
    if candidate.exists():
        os.environ["TESSDATA_PREFIX"] = str(candidate)

# Debug mode: set FLYFF_OCR_DEBUG=1 to save debug images
DEBUG_MODE = os.environ.get("FLYFF_OCR_DEBUG", "0") == "1"
DEBUG_DIR = os.environ.get("FLYFF_OCR_DEBUG_DIR", os.path.join(os.path.dirname(__file__), "debug"))
_debug_counter = 0

def _save_debug(name: str, img: np.ndarray) -> None:
    global _debug_counter
    if not DEBUG_MODE:
        return
    try:
        os.makedirs(DEBUG_DIR, exist_ok=True)
        _debug_counter += 1
        path = os.path.join(DEBUG_DIR, f"{_debug_counter:04d}_{name}.png")
        cv2.imwrite(path, img)
    except Exception:
        pass

FLOAT_RE = re.compile(r"\d+(?:[.,]\d+)?")


def _as_bgr(png_bytes: bytes) -> Optional[np.ndarray]:
    arr = np.frombuffer(png_bytes, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def _ocr_line(img: np.ndarray, whitelist: Optional[str] = None, psm: int = 7, oem: int = 3) -> str:
    cfg = f"--oem {oem} --psm {psm}"
    if whitelist:
        cfg += f" -c tessedit_char_whitelist={whitelist}"
    txt = pytesseract.image_to_string(img, config=cfg) or ""
    return txt.strip()


def _ocr_line_multi_oem(img: np.ndarray, whitelist: Optional[str] = None, psm: int = 7) -> list[str]:
    """Try multiple OEM modes and return all results."""
    results = []
    for oem in [3, 1]:  # 3=default, 1=LSTM only
        txt = _ocr_line(img, whitelist=whitelist, psm=psm, oem=oem)
        if txt:
            results.append(txt)
    return results


def _extract_gold_text(bgr: np.ndarray, scale: float = 4.0, preserve_dots: bool = False) -> Optional[np.ndarray]:
    """
    Extract gold/yellow/white text - optimized for transparent overlays.
    Set preserve_dots=True to avoid morphology that can destroy decimal points.
    """
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    # Gold/yellow text - wider range to catch more variations
    lower_gold = np.array([10, 60, 140])
    upper_gold = np.array([40, 255, 255])
    mask_gold = cv2.inRange(hsv, lower_gold, upper_gold)

    # White/bright text
    lower_white = np.array([0, 0, 190])
    upper_white = np.array([180, 50, 255])
    mask_white = cv2.inRange(hsv, lower_white, upper_white)

    combined = cv2.bitwise_or(mask_gold, mask_white)

    # Scale up
    scaled = cv2.resize(combined, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)

    # Only apply morphology if not preserving dots
    if not preserve_dots:
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        scaled = cv2.morphologyEx(scaled, cv2.MORPH_CLOSE, kernel)

    return np.ascontiguousarray(scaled, dtype=np.uint8)


def _extract_text_by_brightness(bgr: np.ndarray, scale: float = 4.0) -> np.ndarray:
    """
    Extract bright text from transparent overlay by isolating high-luminance pixels.
    Works by finding pixels that are significantly brighter than their surroundings.
    """
    # Convert to LAB color space - L channel is perceptual brightness
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l_channel = lab[:, :, 0]

    # Scale up first for better detail
    l_scaled = cv2.resize(l_channel, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # Apply strong CLAHE to maximize text contrast
    clahe = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(4, 4))
    l_enhanced = clahe.apply(l_scaled)

    # High threshold to isolate only the brightest pixels (the text)
    _, mask = cv2.threshold(l_enhanced, 200, 255, cv2.THRESH_BINARY)

    # Clean up noise
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    return mask


def _extract_warm_colors(bgr: np.ndarray, scale: float = 4.0) -> np.ndarray:
    """
    Extract warm-colored text (gold, yellow, orange, white) while rejecting
    cool colors (cyan trees, green grass, blue sky) from transparent overlays.
    """
    # Split into channels
    b, g, r = cv2.split(bgr)

    # Gold/yellow/white text has HIGH red, HIGH green, LOW blue ratio
    # Cyan trees have HIGH blue, HIGH green, LOW red
    # Green grass has HIGH green, moderate others

    # Create mask where R and G are high, and R >= B (rejects cyan/blue)
    r_float = r.astype(np.float32)
    g_float = g.astype(np.float32)
    b_float = b.astype(np.float32)

    # Warm color detection: R channel dominant or equal to others
    warm_mask = ((r_float >= b_float * 0.9) &
                 (r_float >= 120) &
                 (g_float >= 100) &
                 ((r_float + g_float) > (b_float * 1.5 + 100)))

    mask = (warm_mask * 255).astype(np.uint8)

    # Scale up
    scaled = cv2.resize(mask, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)

    # Denoise and connect characters
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    scaled = cv2.morphologyEx(scaled, cv2.MORPH_CLOSE, kernel)
    scaled = cv2.morphologyEx(scaled, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2)))

    return scaled


def _extract_high_saturation_warm(bgr: np.ndarray, scale: float = 4.0) -> np.ndarray:
    """
    Extract saturated warm colors (gold UI text) while rejecting
    desaturated background bleed-through.
    """
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)

    # Gold text: Hue 15-40, Saturation > 80, Value > 150
    gold_mask = ((h >= 10) & (h <= 45) & (s >= 60) & (v >= 140))

    # Also catch bright white/cream text
    white_mask = ((s <= 50) & (v >= 200))

    combined = ((gold_mask | white_mask) * 255).astype(np.uint8)

    scaled = cv2.resize(combined, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    scaled = cv2.morphologyEx(scaled, cv2.MORPH_CLOSE, kernel)

    return scaled


def _sharpen(img: np.ndarray, strength: float = 1.5) -> np.ndarray:
    """Apply unsharp masking to sharpen text edges."""
    blurred = cv2.GaussianBlur(img, (0, 0), 2)
    sharpened = cv2.addWeighted(img, 1 + strength, blurred, -strength, 0)
    return np.clip(sharpened, 0, 255).astype(np.uint8)


def _compute_scale(bgr: np.ndarray, target_height: int = 80) -> float:
    """Compute scale factor to reach a reasonable height for OCR."""
    h = bgr.shape[0]
    if h <= 0:
        return 6.0
    # Scale small images more aggressively - target 80px height for good digit recognition
    scale = max(3.0, target_height / h)
    return min(scale, 12.0)  # Cap at 12x


def _single_mask(bgr: np.ndarray, scale: float = None) -> np.ndarray:
    """Generate a single optimized mask for fast OCR."""
    if scale is None:
        scale = _compute_scale(bgr, target_height=60)

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # Apply CLAHE for better contrast on game UI text
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    # Otsu thresholding
    _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    th = cv2.morphologyEx(th, cv2.MORPH_CLOSE, kernel)

    return th


def _adaptive_mask(bgr: np.ndarray, scale: float = None) -> np.ndarray:
    """Generate mask using adaptive thresholding for uneven lighting."""
    if scale is None:
        scale = _compute_scale(bgr, target_height=60)

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # Adaptive threshold works better for text on varying backgrounds
    block_size = max(11, int(gray.shape[0] / 4) | 1)  # Must be odd
    th = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, block_size, 2
    )

    # Close small gaps in characters
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    th = cv2.morphologyEx(th, cv2.MORPH_CLOSE, kernel)

    return th


def _mask_preserve_dots(bgr: np.ndarray, scale: float = None) -> np.ndarray:
    """
    Mask that preserves small dots (decimal points).
    Uses minimal morphology to avoid destroying the decimal separator.
    """
    if scale is None:
        scale = _compute_scale(bgr, target_height=70)

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # Strong CLAHE for contrast
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(4, 4))
    gray = clahe.apply(gray)

    # Otsu thresholding - NO morphological operations to preserve dots
    _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return th


def _text_mask_sharp(bgr: np.ndarray, target_height: int = 60) -> np.ndarray:
    """Sharper mask tuned for small UI fonts."""
    scale = _compute_scale(bgr, target_height=target_height)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_LINEAR)
    gray = _sharpen(gray, strength=1.1)
    _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return th


def _score_numeric(raw: str, prefer_percent: bool = False) -> int:
    """
    Score OCR result for quality. Higher = better.
    Strongly prefers results with detected decimal points.
    """
    if not raw:
        return 0
    raw_clean = raw.strip()
    score = 0

    # Base score for having digits
    digit_count = sum(1 for c in raw_clean if c.isdigit())
    score += digit_count * 10

    # STRONG bonus for detected decimal point (means OCR saw the dot)
    if "." in raw_clean or "," in raw_clean:
        score += 100  # Much higher weight

    # Bonus for expected XP format (e.g., "4.9798" or "75.1234%")
    if re.match(r"^\d{1,3}[.,]\d{2,4}%?$", raw_clean):
        score += 80

    # Extra bonus for single-digit before decimal (e.g., "4.9798")
    if re.match(r"^\d[.,]\d{3,4}%?$", raw_clean):
        score += 30

    # Bonus for percent sign
    if prefer_percent and "%" in raw:
        score += 20

    # Penalty for unexpected characters
    unexpected = sum(1 for c in raw_clean if c not in "0123456789.,% ")
    score -= unexpected * 15

    # Bonus for plausible XP values (0-100 range with decimals)
    try:
        clean = raw_clean.replace(",", ".").replace("%", "").strip()
        val = float(clean)
        if 0 <= val <= 100:
            score += 30
    except ValueError:
        pass

    return max(0, score)


def _extract_digits(text: str) -> str:
    """Extract only digits from text."""
    return "".join(c for c in text if c.isdigit())


def _best_digit_line(bgr: np.ndarray, whitelist: str, prefer_percent: bool = False) -> str:
    """Fast single-mask digit line OCR."""
    mask = _single_mask(bgr)

    raw = _ocr_line(mask, whitelist=whitelist, psm=7)
    if raw:
        return raw

    return _ocr_line(255 - mask, whitelist=whitelist, psm=7)


def _fix_ocr_confusions(text: str) -> str:
    """Fix common OCR confusions for EXP values (7/1, 5/9, 6/8 near decimal)."""
    if not text or len(text) < 5:
        return text

    t = text.replace(",", ".").replace(" ", "")
    result = list(t)

    # With decimal point: use digit before dot as anchor
    dot_pos = t.find(".")
    if dot_pos > 0 and dot_pos + 1 < len(result):
        digit_before = result[dot_pos - 1]
        digit_after = result[dot_pos + 1]

        if digit_before == "7" and digit_after == "1":
            result[dot_pos + 1] = "7"
        elif digit_before in ("5", "9") and digit_after in ("5", "9") and digit_before != digit_after:
            result[dot_pos + 1] = digit_before
        elif digit_before in ("6", "8") and digit_after in ("6", "8") and digit_before != digit_after:
            result[dot_pos + 1] = digit_before

        return "".join(result)

    # Without decimal: infer boundary (5-7 digits, 1-2 digit integer part)
    digits_only = "".join(c for c in t if c.isdigit())
    if 5 <= len(digits_only) <= 7:
        res = list(digits_only)
        boundary_idx = {5: 0, 6: 1, 7: 2}.get(len(res))
        if boundary_idx is not None and boundary_idx < len(res) - 1:
            db, da = res[boundary_idx], res[boundary_idx + 1]
            if db == "7" and da == "1":
                res[boundary_idx + 1] = "7"
            elif db in ("5", "9") and da in ("5", "9") and db != da:
                res[boundary_idx + 1] = db
            elif db in ("6", "8") and da in ("6", "8") and db != da:
                res[boundary_idx + 1] = db
        return "".join(res)

    return "".join(result)


def _parse_exp_percent(text: str) -> Optional[float]:
    """
    Parse EXP percentage from OCR text.
    Handles cases where decimal point may be missing or misread.
    Returns value in range 0.0 - 100.0
    """
    if not text:
        return None
    t = (text or "").strip().replace("\n", "").replace(" ", "")
    t = _fix_ocr_confusions(t)
    t = t.translate(str.maketrans({"O": "0", "o": "0"}))
    t = t.replace(",", ".").replace("%", "")

    matches = FLOAT_RE.findall(t)
    vals: list[float] = []

    for token in matches:
        tok = token.replace(",", ".")

        # If decimal point is present, use it directly
        if "." in tok:
            try:
                v = float(tok)
                if 0.0 <= v <= 100.0:
                    vals.append(v)
            except ValueError:
                pass
            continue

        # No decimal point - try multiple interpretations
        if tok.isdigit():
            n = len(tok)

            # Try inserting decimal after position 1 (for 0-9.xxxx range)
            # E.g., "49798" -> "4.9798"
            if n >= 4:
                try:
                    v = float(tok[:1] + "." + tok[1:])
                    if 0.0 <= v <= 100.0:
                        vals.append(v)
                except ValueError:
                    pass

            # Try inserting decimal after position 2 (for 10-99.xxxx range)
            # E.g., "49798" -> "49.798"
            if n >= 3:
                try:
                    v = float(tok[:2] + "." + tok[2:])
                    if 0.0 <= v <= 100.0:
                        vals.append(v)
                except ValueError:
                    pass

            # Try inserting decimal after position 3 (for 100.xxxx - edge case)
            if n >= 4:
                try:
                    v = float(tok[:3] + "." + tok[3:])
                    if 0.0 <= v <= 100.0:
                        vals.append(v)
                except ValueError:
                    pass

            # Also try as-is for small integers
            try:
                v = float(tok)
                if 0.0 <= v <= 100.0:
                    vals.append(v)
            except ValueError:
                pass

    if not vals:
        return None

    # Return the most common value (voting across interpretations)
    return Counter(vals).most_common(1)[0][0]


def _estimate_exp_fill_ratio(bgr: np.ndarray) -> Optional[float]:
    """Estimate EXP bar fill (0-1) based on the cyan fill area."""
    h, w = bgr.shape[:2]
    if h < 6 or w < 10:
        return None

    top = max(0, int(h * 0.2))
    bottom = max(top + 1, int(h * 0.8))
    hsv = cv2.cvtColor(bgr[top:bottom], cv2.COLOR_BGR2HSV)

    lower = np.array([80, 70, 110])
    upper = np.array([110, 255, 255])
    mask = cv2.inRange(hsv, lower, upper)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 1))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)

    cols = np.where(mask.max(axis=0) > 0)[0]
    if cols.size == 0:
        return None

    fill_ratio = float(cols.max() + 1) / float(w)
    return max(0.0, min(1.0, fill_ratio))


def ocr_exp(bgr: np.ndarray) -> Tuple[Optional[float], str]:
    """
    EXP OCR optimized for transparent game overlays.

    The overlay is semi-transparent with gold/white text on top of
    game scenery (cyan trees, green grass, blue sky). We use multiple
    color-isolation strategies to extract text while rejecting background.
    """
    fill_ratio = _estimate_exp_fill_ratio(bgr)
    _save_debug("input", bgr)

    candidates: list[Tuple[str, Optional[float]]] = []
    whitelist = "0123456789.,%"

    def try_mask(m: np.ndarray, psm: int = 7, name: str = "") -> None:
        if m is None or m.size == 0:
            return
        _save_debug(name, m)
        raw_local = _ocr_line(m, whitelist=whitelist, psm=psm)
        candidates.append((raw_local, _parse_exp_percent(raw_local)))
        raw_inv = _ocr_line(255 - m, whitelist=whitelist, psm=psm)
        candidates.append((raw_inv, _parse_exp_percent(raw_inv)))

    # === PRIMARY: Color-based extraction (best for transparent overlays) ===

    # 1. Warm color extraction - rejects cyan/green/blue background
    for scale in [5.0, 6.0, 8.0]:
        mask_warm = _extract_warm_colors(bgr, scale=scale)
        try_mask(mask_warm, psm=7, name=f"warm_{scale}")
        try_mask(mask_warm, psm=8, name=f"warm_{scale}_psm8")

    # 2. HSV-based gold/white extraction
    for scale in [5.0, 6.0]:
        mask_hsv = _extract_high_saturation_warm(bgr, scale=scale)
        try_mask(mask_hsv, psm=7, name=f"hsv_warm_{scale}")

    # 3. Brightness-based (LAB L-channel)
    for scale in [5.0, 6.0]:
        mask_bright = _extract_text_by_brightness(bgr, scale=scale)
        try_mask(mask_bright, psm=7, name=f"bright_{scale}")

    # 4. Classic gold extraction
    for scale in [5.0, 6.0]:
        mask_gold = _extract_gold_text(bgr, scale=scale)
        if mask_gold is not None:
            try_mask(mask_gold, psm=7, name=f"gold_{scale}")

    # 5. Gold extraction WITHOUT morphology (preserves decimal points)
    for scale in [6.0, 8.0]:
        mask_gold_dots = _extract_gold_text(bgr, scale=scale, preserve_dots=True)
        if mask_gold_dots is not None:
            try_mask(mask_gold_dots, psm=7, name=f"gold_dots_{scale}")

    # === IMPORTANT: Mask that preserves decimal points ===
    # This is critical for values like "4.9798" where the dot might be lost
    for scale in [6.0, 8.0, 10.0]:
        mask_dots = _mask_preserve_dots(bgr, scale=scale)
        try_mask(mask_dots, psm=7, name=f"preserve_dots_{scale}")

    # === FALLBACK: Traditional grayscale methods ===
    mask_otsu = _single_mask(bgr)
    mask_sharp = _text_mask_sharp(bgr, target_height=80)

    try_mask(mask_otsu, psm=7, name="otsu")
    try_mask(mask_sharp, psm=7, name="sharp")

    # Pick best parsed value with highest score
    best_val = None
    best_raw = ""
    best_score = -1
    for raw, val in candidates:
        score = _score_numeric(raw, prefer_percent=True)
        if val is None:
            continue
        if score > best_score:
            best_score = score
            best_val = val
            best_raw = raw

    # If the OCR value is implausibly below the measured bar fill, snap to the fill estimate.
    if best_val is not None and fill_ratio is not None:
        target = fill_ratio * 100.0
        if target >= 25.0 and best_val + 8.0 < target:
            best_val = round(target, 4)

    if best_val is not None:
        return best_val, best_raw

    # Fallback: return last raw even if unparsable
    return None, candidates[-1][0] if candidates else ""


def ocr_namelevel(bgr: np.ndarray) -> str:
    """Name/level OCR optimized for transparent overlays."""
    wl = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789Lv "
    candidates: list[str] = []

    def try_mask(m: np.ndarray) -> None:
        if m is None or m.size == 0:
            return
        raw = _ocr_line(m, whitelist=wl, psm=7)
        if raw:
            candidates.append(raw)
        raw = _ocr_line(255 - m, whitelist=wl, psm=7)
        if raw:
            candidates.append(raw)

    # Color-based extraction (primary for transparent overlays)
    for scale in [5.0, 6.0]:
        try_mask(_extract_warm_colors(bgr, scale=scale))
        try_mask(_extract_high_saturation_warm(bgr, scale=scale))
        try_mask(_extract_gold_text(bgr, scale=scale))

    # Fallback grayscale
    try_mask(_single_mask(bgr))
    try_mask(_text_mask_sharp(bgr, target_height=80))

    if not candidates:
        return ""

    return max(candidates, key=len)


def ocr_level(bgr: np.ndarray) -> str:
    """Level OCR optimized for transparent overlays."""
    wl = "0123456789Lv. "
    candidates: list[str] = []

    def try_mask(m: np.ndarray) -> None:
        if m is None or m.size == 0:
            return
        raw = _ocr_line(m, whitelist=wl, psm=7)
        if _extract_digits(raw):
            candidates.append(raw)
        raw = _ocr_line(255 - m, whitelist=wl, psm=7)
        if _extract_digits(raw):
            candidates.append(raw)

    # Color-based extraction (primary for transparent overlays)
    for scale in [5.0, 6.0, 8.0]:
        try_mask(_extract_warm_colors(bgr, scale=scale))
        try_mask(_extract_high_saturation_warm(bgr, scale=scale))
        try_mask(_extract_gold_text(bgr, scale=scale))

    # Fallback grayscale
    try_mask(_single_mask(bgr))
    try_mask(_text_mask_sharp(bgr, target_height=80))

    if not candidates:
        return ""

    return max(candidates, key=lambda x: len(_extract_digits(x)))


def ocr_charname(bgr: np.ndarray) -> str:
    """Character name OCR optimized for transparent overlays."""
    wl = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 "
    candidates: list[str] = []

    def try_mask(m: np.ndarray) -> None:
        if m is None or m.size == 0:
            return
        raw = _ocr_line(m, whitelist=wl, psm=7, oem=3)
        if raw:
            candidates.append(raw.strip())
        raw = _ocr_line(255 - m, whitelist=wl, psm=7, oem=3)
        if raw:
            candidates.append(raw.strip())

    # Color-based extraction (primary for transparent overlays)
    for scale in [5.0, 6.0]:
        try_mask(_extract_warm_colors(bgr, scale=scale))
        try_mask(_extract_high_saturation_warm(bgr, scale=scale))
        try_mask(_extract_gold_text(bgr, scale=scale))

    # Fallback grayscale
    try_mask(_text_mask_sharp(bgr, target_height=80))
    try_mask(_single_mask(bgr))

    if not candidates:
        return ""

    # Return candidate with most alphanumeric chars
    return max(candidates, key=lambda t: sum(1 for c in t if c.isalnum()))


def process(png_bytes: bytes, kind: str) -> dict:
    bgr = _as_bgr(png_bytes)
    if bgr is None:
        return {"ok": False, "error": "decode_failed"}

    kind = (kind or "exp").lower()

    if kind in ("exp", "digits"):
        val, raw = ocr_exp(bgr)
        if val is None:
            return {"ok": False, "raw": raw, "value": None, "unit": "%"}
        return {"ok": True, "raw": raw, "value": f"{val:.4f}", "unit": "%"}

    if kind in ("namelevel", "line"):
        raw = ocr_namelevel(bgr)
        return {"ok": True, "raw": raw, "value": None, "unit": None}

    if kind == "lvl":
        raw = ocr_level(bgr)
        return {"ok": True, "raw": raw, "value": None, "unit": None}

    if kind == "charname":
        raw = ocr_charname(bgr)
        return {"ok": True, "raw": raw, "value": None, "unit": None}

    if kind == "lauftext":
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        raw = _ocr_line(gray, psm=6)
        return {"ok": True, "raw": raw, "value": None, "unit": None}

    raw = _ocr_line(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY))
    return {"ok": True, "raw": raw, "value": None, "unit": None}


def main() -> int:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        msg = None
        try:
            msg = json.loads(line)
            png_b64 = msg.get("png_b64")
            kind = msg.get("kind", "exp")
            rid = msg.get("id")

            png_bytes = base64.b64decode(png_b64) if png_b64 else b""
            out = process(png_bytes, kind)
            out["id"] = rid

            sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
            sys.stdout.flush()
        except Exception as e:
            sys.stdout.write(json.dumps({
                "ok": False,
                "error": str(e),
                "id": (msg.get("id") if isinstance(msg, dict) else None)
            }, ensure_ascii=False) + "\n")
            sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

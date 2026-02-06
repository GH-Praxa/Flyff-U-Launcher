#!/usr/bin/env python3
"""
stdin JSONL -> stdout JSONL

Input:
  {"id": 1, "png_b64": "...", "kind": "exp"|"namelevel"}

Output:
  {"id":1, "ok":true, "raw":"...", "value":"75.0000", "unit":"%"}
"""
import sys, json, base64, re, os, time, random
from collections import Counter
from typing import Optional, Tuple
from pathlib import Path

import numpy as np
import cv2
import pytesseract

# ---------------------------------------------------------------------------
# Configure bundled Tesseract (set by Electron via environment variables)
# ---------------------------------------------------------------------------
_TESSERACT_EXE = os.environ.get("TESSERACT_EXE")
_TESSDATA_DIR: Optional[str] = None
if _TESSERACT_EXE and os.path.isfile(_TESSERACT_EXE):
    pytesseract.pytesseract.tesseract_cmd = _TESSERACT_EXE
    _tess_dir = str(Path(_TESSERACT_EXE).parent)
    # Ensure DLLs next to tesseract.exe are found by Windows
    if _tess_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = _tess_dir + os.pathsep + os.environ.get("PATH", "")
    # Resolve tessdata directory
    _candidate = Path(_tess_dir) / "tessdata"
    if _candidate.exists():
        _TESSDATA_DIR = str(_candidate)
        if not os.environ.get("TESSDATA_PREFIX"):
            os.environ["TESSDATA_PREFIX"] = _tess_dir
    print(f"[Python OCR] Using bundled Tesseract: {_TESSERACT_EXE}", file=sys.stderr, flush=True)
    print(f"[Python OCR] TESSDATA_PREFIX={os.environ.get('TESSDATA_PREFIX')}", file=sys.stderr, flush=True)
elif _TESSERACT_EXE:
    print(f"[Python OCR] WARNING: TESSERACT_EXE set but file not found: {_TESSERACT_EXE}", file=sys.stderr, flush=True)
else:
    print("[Python OCR] No bundled Tesseract, falling back to system PATH", file=sys.stderr, flush=True)

def _resolve_debug_dir() -> Path:
    """Resolve where debug artifacts should be stored (defaults to AppData/userData)."""
    custom = os.environ.get("FLYFF_OCR_DEBUG_DIR")
    if custom:
        try:
            return Path(custom).expanduser()
        except Exception:
            pass

    appdata = os.environ.get("APPDATA") or os.environ.get("LOCALAPPDATA")
    if appdata:
        return Path(appdata) / "Flyff-U-Launcher" / "ocr-debug"

    return Path.home() / ".flyff-u-launcher" / "ocr-debug"

# Debug mode: set FLYFF_OCR_DEBUG=1 to save debug images
DEBUG_MODE = os.environ.get("FLYFF_OCR_DEBUG", "0") == "1"
DEBUG_DIR = _resolve_debug_dir()
_debug_counter = 0

def _save_debug(name: str, img: np.ndarray) -> None:
    """Save debug image if DEBUG_MODE is enabled."""
    global _debug_counter
    if not DEBUG_MODE:
        return
    try:
        DEBUG_DIR.mkdir(parents=True, exist_ok=True)
        _debug_counter += 1
        path = DEBUG_DIR / f"{_debug_counter:04d}_{name}.png"
        cv2.imwrite(str(path), img)
    except Exception as e:
        # Write error to file for debugging
        try:
            (DEBUG_DIR / "error.txt").write_text(str(e))
        except:
            pass

# Test: Write a file at startup to confirm worker is running
try:
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    (DEBUG_DIR / "worker_started.txt").write_text("OCR worker started successfully")
except Exception:
    pass

FLOAT_RE = re.compile(r"\d+(?:[.,]\d+)?")

def _is_blank(img: np.ndarray, std_threshold: float = 1.0, range_threshold: float = 5.0) -> bool:
    """Return True if image is essentially uniform (all white/black).

    Disabled by default to avoid suppressing valid captures; enable via FLYFF_OCR_ENABLE_BLANK_CHECK=1.
    """
    if os.environ.get("FLYFF_OCR_ENABLE_BLANK_CHECK") != "1":
        return False
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        std = float(np.std(gray))
        rng = float(np.max(gray) - np.min(gray))
        return std < std_threshold and rng < range_threshold
    except Exception:
        return False

def _as_bgr(png_bytes: bytes) -> Optional[np.ndarray]:
    arr = np.frombuffer(png_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return bgr

def _ocr_line(img: np.ndarray, whitelist: Optional[str] = None, timeout: float = 1.5) -> str:
    cfg = "--oem 3 --psm 7"
    if _TESSDATA_DIR:
        cfg += f' --tessdata-dir "{_TESSDATA_DIR}"'
    if whitelist:
        cfg += f" -c tessedit_char_whitelist={whitelist}"
    try:
        txt = pytesseract.image_to_string(img, config=cfg, timeout=timeout) or ""
    except RuntimeError as e:
        # Tesseract timeout inside worker -> signal empty so caller can retry fast
        _save_debug("tess_timeout", img)
        return ""
    return txt.strip()

def _prep_gray(bgr: np.ndarray, scale: float = 4.0) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    return gray

def _filters_for_digits(sharp: np.ndarray) -> list[np.ndarray]:
    # (Legacy) – bleibt drin, falls du später wieder testen willst.
    _, th1 = cv2.threshold(sharp, 180, 255, cv2.THRESH_BINARY)
    _, th2 = cv2.threshold(sharp, 0,   255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    th3 = cv2.adaptiveThreshold(
        sharp, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 21, 10
    )
    th4 = cv2.adaptiveThreshold(
        sharp, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 8
    )

    imgs = [th1, th2, th3, th4, 255 - th1, 255 - th2, 255 - th3, 255 - th4]
    return [np.ascontiguousarray(x, dtype=np.uint8) for x in imgs]

def _fix_ocr_confusions(text: str) -> str:
    """Fix common OCR character confusions for EXP values.

    The Flyff font's "7" has a thin top stroke that often gets misread as "1".
    We apply heuristics based on the known format: XX.XXXX%

    Cases handled:
    - X7.1XXX -> X7.7XXX (with decimal point)
    - X71XXXX -> X77XXXX (without decimal point, 6-7 digits)
    - X5.9XXX -> X5.5XXX / X9.5XXX -> X9.9XXX (5/9 confusion with decimal)
    - X59XXXX -> X55XXXX / X95XXXX -> X99XXXX (5/9 confusion without decimal near boundary, 5-7 digits)
    """
    if not text or len(text) < 5:
        return text

    # Normalize first
    t = text.replace(",", ".").replace(" ", "")
    result = list(t)

    # Case 1: With decimal point (X7.1XXX -> X7.7XXX)
    dot_pos = t.find(".")
    if dot_pos > 0 and dot_pos + 1 < len(result):
        digit_before = result[dot_pos - 1]
        digit_after = result[dot_pos + 1]

        # If we have X7.1XXX, likely should be X7.7XXX (7 misread as 1)
        if digit_before == '7' and digit_after == '1':
            result[dot_pos + 1] = '7'
        # 5/9 often get confused; prefer the digit before the decimal as anchor
        elif digit_before in ('5', '9') and digit_after in ('5', '9') and digit_before != digit_after:
            result[dot_pos + 1] = digit_before

        return "".join(result)

    # Case 2: Without decimal point (OCR dropped it)
    # Format should be XXXXXXX (6-7 digits) representing XX.XXXX
    # Position 2 (0-indexed) would be where decimal should be for 2-digit integer part
    # So "471083" should be "477083" if pattern is 71 -> 77

    digits_only = "".join(c for c in t if c.isdigit())
    if 5 <= len(digits_only) <= 7:
        result = list(digits_only)
        # Integer part is 1-2 digits; boundary is where the decimal would be
        boundary_idx = None
        if len(result) == 5:
            boundary_idx = 0
        elif len(result) == 6:
            boundary_idx = 1
        elif len(result) == 7:
            boundary_idx = 2

        if boundary_idx is not None and boundary_idx < len(result) - 1:
            digit_before = result[boundary_idx]
            digit_after = result[boundary_idx + 1]

            if digit_before == '7' and digit_after == '1':
                result[boundary_idx + 1] = '7'
            elif digit_before in ('5', '9') and digit_after in ('5', '9') and digit_before != digit_after:
                result[boundary_idx + 1] = digit_before

        return "".join(result)

    return "".join(result)


def _estimate_exp_fill_ratio(bgr: np.ndarray) -> Optional[float]:
    """Roughly estimate EXP bar fill (0-1) based on cyan fill color.

    Heuristic: sample a row in the upper third where the turquoise fill sits
    and count columns whose color matches the cyan fill (high B/G, low R).
    """
    h, w = bgr.shape[:2]
    if h < 6 or w < 10:
        return None

    def build_mask(band: np.ndarray, tight: bool = True) -> np.ndarray:
        hsv = cv2.cvtColor(band, cv2.COLOR_BGR2HSV)
        if tight:
            lower = np.array([75, 40, 90])
            upper = np.array([125, 255, 255])
        else:
            # Wider range to catch greener/bluer bars or darkened UI variants.
            lower = np.array([60, 25, 70])
            upper = np.array([140, 255, 255])
        mask_local = cv2.inRange(hsv, lower, upper)

        # Supplemental BGR heuristic to catch subtle gradients.
        b, g, r = cv2.split(band)
        bgr_mask = ((b.astype(np.int32) - r.astype(np.int32) > 40) &
                    (b.astype(np.int32) - g.astype(np.int32) > 10) &
                    (b > 90)).astype(np.uint8) * 255
        mask_local = cv2.bitwise_or(mask_local, bgr_mask)

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 1))
        mask_local = cv2.morphologyEx(mask_local, cv2.MORPH_CLOSE, kernel, iterations=1)
        if not tight:
            # Light dilation to merge split bar segments
            kernel_wide = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 1))
            mask_local = cv2.dilate(mask_local, kernel_wide, iterations=1)
        return mask_local

    # Sample the central band first.
    top = max(0, int(h * 0.2))
    bottom = max(top + 1, int(h * 0.8))
    mask = build_mask(bgr[top:bottom], tight=True)

    # If missed, retry with wider thresholds on the lower half (EXP bar sits below HP bar).
    if np.max(mask) == 0:
        lower_band = bgr[int(h * 0.45) : h, :]
        mask = build_mask(lower_band, tight=False)
        if np.max(mask) == 0:
            return 0.0

    # If the visible fill is extremely thin, treat it as empty to avoid ghost measurements.
    if float(np.count_nonzero(mask)) / mask.size < 0.02:
        return 0.0

    # Ignore the right-most portion where the white text sits; focus on the bar body.
    cutoff = int(w * 0.9)
    cols = np.where(mask[:, :cutoff].max(axis=0) > 0)[0]
    if cols.size == 0:
        return None

    min_col = int(cols.min())
    max_col = int(cols.max())
    span = max_col - min_col + 1

    # Small padding to compensate for gradient fade-out near the right edge of the filled bar.
    if 0.1 < span / float(w) < 0.9:
        span = min(w - min_col, span + 6)

    # Guard against tiny stray hits (e.g., highlights in the label) that would
    # otherwise inflate the fill ratio.
    if span < max(4, int(w * 0.03)):
        return None

    # Require fill to start near the left edge to avoid picking up isolated hits mid-bar.
    # Allow looser threshold because some captures include HP bars/labels above EXP that shift detection rightwards.
    if min_col > w * 0.45:
        return None

    # Compute fill relative to the detected start column to ignore the "Exp" label
    # width on the left. This avoids treating a small blob near the label as
    # a large fill percentage.
    denom = max(1, w - min_col)
    fill_ratio = float(span) / float(denom)
    return max(0.0, min(1.0, fill_ratio))


def _parse_exp_percent(text: str) -> Optional[float]:
    """Parse EXP percent from OCR text.

    Flyff shows 4 decimals, but OCR often drops the dot:
      85.0000% -> "850000%"
      2.0000%  -> "20000%"
    We treat pure digit strings with 5–7 digits as implied /10000.
    """
    if not text:
        return None

    t = (text or "").strip().replace("\n", "").replace(" ", "")

    # Fix common OCR confusions (7/1, 5/9 near decimal boundary)
    t = _fix_ocr_confusions(t)

    # cheap fixes for rare OCR confusions
    t = t.translate(str.maketrans({"O": "0", "o": "0"}))

    t = t.replace(",", ".").replace("%", "")

    matches = FLOAT_RE.findall(t)
    vals: list[float] = []

    for token in matches:
        tok = token.replace(",", ".")

        # implied 4 decimals if OCR dropped the dot (e.g. 850000 -> 85.0000)
        if "." not in tok and tok.isdigit() and 5 <= len(tok) <= 7:
            try:
                v = int(tok) / 10000.0
                if 0.0 <= v <= 100.0:
                    vals.append(v)
            except ValueError:
                pass
            continue

        try:
            v = float(tok)
            if 0.0 <= v <= 100.0:
                vals.append(v)
        except ValueError:
            pass

    if not vals:
        return None

    return Counter(vals).most_common(1)[0][0]

def _extract_bright_text_mask(bgr: np.ndarray, scale: float = 6.0) -> np.ndarray:
    """Extract bright/white text from dark background."""
    # Convert to grayscale
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    # Scale up first for better detail
    gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # Simple threshold - bright text (>180) on dark background
    _, mask = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY)

    # Remove border artifacts by clearing edges
    h, w = mask.shape
    border = int(scale * 2)
    mask[:border, :] = 0  # Top
    mask[-border:, :] = 0  # Bottom
    mask[:, :border] = 0  # Left
    mask[:, -border:] = 0  # Right

    return mask

def _extract_gold_text_mask(bgr: np.ndarray, scale: float = 5.0) -> np.ndarray:
    """Extract gold/amber text using HSV filtering (targets EXP color)."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    hsv = cv2.resize(hsv, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # Gold/amber range (tuned for Flyff EXP text)
    lower = np.array([15, 90, 120])
    upper = np.array([42, 255, 255])
    mask = cv2.inRange(hsv, lower, upper)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    return mask

def _extract_white_text_mask(bgr: np.ndarray, scale: float = 6.0) -> np.ndarray:
    """Extract white/light text using HSV threshold."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    hsv = cv2.resize(hsv, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    # White/light: low saturation, high value
    lower = np.array([0, 0, 180])
    upper = np.array([179, 70, 255])
    mask = cv2.inRange(hsv, lower, upper)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    return mask


def ocr_exp(bgr: np.ndarray) -> Tuple[Optional[float], str]:
    """OCR EXP percent.

    Uses color filtering to extract gold text from transparent overlay,
    plus grayscale fallbacks.
    """
    fill_ratio = _estimate_exp_fill_ratio(bgr)

    # Keep original scale; downstream text masks already upscale aggressively.
    h, w = bgr.shape[:2]

    _save_debug("00_input", bgr)

    whitelist = "0123456789.,%"
    img_counter = [0]
    fallback_raw = ""
    # Text is on the right half; crop to reduce bar bleed-in before trying full ROI.
    text_slice = bgr[:, max(0, int(w * 0.35)) :]
    # Further crop vertically to the central band where the digits sit to suppress top/bottom borders.
    band_top = max(0, int(h * 0.1))
    band_bottom = max(band_top + 1, int(h * 0.9))
    text_slice = text_slice[band_top:band_bottom, :]
    # Gold mask thresholds: widen saturation to include faint digits on bright background.
    def _extract_gold_text_mask_wide(bgr_img: np.ndarray, scale: float = 5.0) -> np.ndarray:
        hsv = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2HSV)
        hsv = cv2.resize(hsv, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        lower = np.array([12, 60, 100])
        upper = np.array([48, 255, 255])
        mask = cv2.inRange(hsv, lower, upper)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
        return mask

    def _maybe_prefer_5(value: Optional[float], raw: str) -> Tuple[Optional[float], str]:
        """Prefer swapping a single 9->5 if it clearly matches the bar fill better."""
        if value is None or fill_ratio is None or "9" not in raw:
            return value, raw

        target = fill_ratio * 100.0
        # If we're already close to the measured fill, keep the OCR result.
        if abs(value - target) < 0.5:
            return value, raw

        chars = list(raw)
        try:
            idx = chars.index("9")
        except ValueError:
            return value, raw

        chars[idx] = "5"
        alt_raw = "".join(chars)
        alt_val = _parse_exp_percent(alt_raw)

        if alt_val is None:
            return value, raw

        # Accept the swap only if it moves noticeably closer to the fill-based estimate.
        improvement = abs(value - target) - abs(alt_val - target)
        if improvement >= 0.5:
            return alt_val, alt_raw
        return value, raw

    def _prefer_59(raw_a: str, raw_b: str) -> Optional[str]:
        """If strings differ only by a single 5/9 swap, prefer the one with 5."""
        digits_a = "".join(c for c in (raw_a or "") if c.isdigit())
        digits_b = "".join(c for c in (raw_b or "") if c.isdigit())
        if not digits_a or not digits_b or len(digits_a) != len(digits_b):
            return None
        diffs = [(a, b) for a, b in zip(digits_a, digits_b) if a != b]
        if len(diffs) == 1 and set(diffs[0]) == {"5", "9"}:
            # Prefer the variant containing the '5'
            return raw_a if diffs[0][0] == "5" else raw_b
        return None

    def try_img(img: np.ndarray, name: str = "") -> Tuple[Optional[float], str]:
        nonlocal fallback_raw
        img_counter[0] += 1
        _save_debug(f"{img_counter[0]:02d}_{name}", img)

        raw = _ocr_line(img, whitelist=whitelist, timeout=1.0)
        if raw and not fallback_raw:
            fallback_raw = raw
        if not raw:
            return None, raw

        v = _parse_exp_percent(raw)
        digits_only = "".join(c for c in raw if c.isdigit())
        # Reject obviously spurious hits (e.g., background noise producing 1-3 digits).
        if len(digits_only) < 4:
            return None, raw
        # If digits contain spaces/segment splits (e.g., "50 00 009"), drop spaces and retry parse.
        if (v is None or v < 0.1) and " " in raw:
            compact = raw.replace(" ", "")
            # Also try collapsing multiple spaces into a single dot position (e.g., "50 0000" -> "50.0000")
            dot_guess = None
            if len(compact) >= 6 and compact.isdigit():
                dot_guess = compact[:2] + "." + compact[2:]
            candidates = [compact, dot_guess] if dot_guess else [compact]
            for cand in candidates:
                v_compact = _parse_exp_percent(cand)
                if v_compact is not None:
                    v = v_compact
                    raw = cand
                    break
        v, raw = _maybe_prefer_5(v, raw)
        if v is None:
            return None, raw

        cleaned = raw.replace("%", "").replace(",", "").replace(".", "")
        # Prefer raw that looks like a percent value
        if cleaned.isdigit() and 5 <= len(cleaned) <= 7:
            return v, raw
        return v, raw

    def try_with_boldening(img: np.ndarray, base_name: str) -> Tuple[Optional[float], str]:
        # Try base, bold, and a light opening to break closed loops (5/9 confusion)
        candidates: list[Tuple[Optional[float], str]] = []

        val_base, raw_base = try_img(img, base_name)
        candidates.append((val_base, raw_base))

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        bold = cv2.dilate(img, kernel, iterations=1)
        val_bold, raw_bold = try_img(bold, base_name + "_bold")
        candidates.append((val_bold, raw_bold))

        opened = cv2.morphologyEx(img, cv2.MORPH_OPEN, kernel, iterations=1)
        val_open, raw_open = try_img(opened, base_name + "_open")
        candidates.append((val_open, raw_open))

        # Pick the first valid result, but prefer a 5 over 9 if they only differ by one digit
        chosen_val, chosen_raw = None, ""
        for val, raw in candidates:
            if val is None:
                continue
            if chosen_val is None:
                chosen_val, chosen_raw = val, raw
                continue
            prefer = _prefer_59(chosen_raw, raw)
            if prefer == raw:
                chosen_val, chosen_raw = val, raw

        return chosen_val, chosen_raw

    def _maybe_snap_to_fill(val: Optional[float], raw: str) -> Tuple[Optional[float], str]:
        """If OCR value is implausibly below the measured fill, snap to fill-based estimate."""
        if val is None or fill_ratio is None:
            # Clamp tiny residuals (ghost digits) to zero even without a fill estimate.
            if val is not None and val < 0.001:
                return 0.0, raw
            return val, raw
        digits_in_raw = "".join(c for c in (raw or "") if c.isdigit())
        # Avoid snapping when the OCR text is clearly too short to be a percent value.
        if len(digits_in_raw) < 3:
            return val, raw

        target = fill_ratio * 100.0

        # If multiple numbers are present in raw, prefer the one closest to the measured fill.
        try:
            tokens = [t.replace(",", ".") for t in FLOAT_RE.findall(raw or "")]
            candidates: list[tuple[float, str]] = []
            for tok in tokens:
                try:
                    num = float(tok)
                except ValueError:
                    continue
                if 0.0 <= num <= 100.0:
                    candidates.append((num, tok))
            if candidates:
                closest = min(candidates, key=lambda t: abs(t[0] - target))
                if abs(closest[0] - target) + 0.25 < abs(val - target):
                    val = closest[0]
                    raw = closest[1]
        except Exception:
            pass

        # If the raw text already looks like a well-formed percent with a decimal and is within 5%
        # of the measured fill, trust it as-is.
        raw_clean = (raw or "").strip()
        import re
        if re.fullmatch(r"\d{1,3}\.\d{1,6}%?", raw_clean):
            if abs(val - target) <= 5.0:
                return val, raw

        # If the value is still far off from the measured fill, fall back to the fill estimate.
        if target >= 5.0 and target <= 99.5 and abs(val - target) > 12.0:
            snapped = round(target, 4)
            return snapped, raw

        # Small correction: if a single 6/8 swap would move us closer to the bar fill, prefer it.
        def _try_swap_digit(src: str, dst: str) -> Optional[Tuple[float, str]]:
            if src not in raw:
                return None
            chars = list(raw)
            try:
                idx = chars.index(src)
            except ValueError:
                return None
            chars[idx] = dst
            alt_raw = "".join(chars)
            alt_val = _parse_exp_percent(alt_raw)
            if alt_val is None:
                return None
            # Require noticeable improvement toward the target
            if abs(alt_val - target) + 0.25 < abs(val - target):
                return alt_val, alt_raw
            return None

        swap = _try_swap_digit("6", "8")
        if swap:
            val, raw = swap

        swap = _try_swap_digit("9", "8")
        if swap:
            val, raw = swap

        # Only adjust when target is meaningful and the gap is huge (e.g., 7 vs ~54)
        if target >= 25.0 and val + 8.0 < target:
            snapped = round(target, 4)
            return snapped, raw

        # Near-empty bar: if fill suggests empty and value is tiny, snap to zero.
        if target <= 0.02 and val < 0.05:
            return 0.0, raw

        return val, raw

    def run_pipeline(target: np.ndarray, suffix: str = "", prefer_white_first: bool = False) -> Tuple[Optional[float], str]:
        def try_gold() -> Tuple[Optional[float], str]:
            for scale in [5.0, 7.0]:
                gold_mask = _extract_gold_text_mask_wide(target, scale=scale)
                val, raw = try_img(gold_mask, f"gold_{scale}{suffix}")
                if val is not None:
                    val, raw = _maybe_snap_to_fill(val, raw)
                    return val, raw
                # Try bold variant
                kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
                bold = cv2.dilate(gold_mask, kernel, iterations=1)
                val, raw = try_img(bold, f"gold_{scale}_bold{suffix}")
                if val is not None:
                    val, raw = _maybe_snap_to_fill(val, raw)
                    return val, raw
                # Try inverted
                val, raw = try_img(255 - gold_mask, f"gold_{scale}_inv{suffix}")
                if val is not None:
                    val, raw = _maybe_snap_to_fill(val, raw)
                    return val, raw
            return None, ""

        def try_white() -> Tuple[Optional[float], str]:
            for scale in [5.0, 7.0]:
                white_mask = _extract_white_text_mask(target, scale=scale)
                # Light dilation to reconnect thin strokes
                kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
                white_mask = cv2.dilate(white_mask, kernel, iterations=1)
                val, raw = try_img(white_mask, f"white_{scale}{suffix}")
                if val is not None:
                    val, raw = _maybe_snap_to_fill(val, raw)
                    return val, raw
                val, raw = try_img(255 - white_mask, f"white_{scale}_inv{suffix}")
                if val is not None:
                    val, raw = _maybe_snap_to_fill(val, raw)
                    return val, raw
            return None, ""

        # Try white first when focusing on the right-hand text slice (digits are bright on cyan).
        if prefer_white_first:
            val, raw = try_white()
            if val is not None:
                return val, raw
            val, raw = try_gold()
            if val is not None:
                return val, raw
        else:
            val, raw = try_gold()
            if val is not None:
                return val, raw
            val, raw = try_white()
            if val is not None:
                return val, raw

        # === FALLBACK: Grayscale methods ===
        gray_local = cv2.cvtColor(target, cv2.COLOR_BGR2GRAY)

        for scale in [5.0, 7.0]:
            scaled = cv2.resize(gray_local, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

            # Otsu without blur
            _, th1 = cv2.threshold(scaled, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            val, raw = try_img(th1, f"gray_otsu_{scale}{suffix}")
            if val is not None:
                return val, raw
            val, raw = try_img(255 - th1, f"gray_otsu_{scale}_inv{suffix}")
            if val is not None:
                return val, raw

            # CLAHE for better contrast
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(scaled)
            _, th2 = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            val, raw = try_img(th2, f"gray_clahe_{scale}{suffix}")
            if val is not None:
                return val, raw
            val, raw = try_img(255 - th2, f"gray_clahe_{scale}_inv{suffix}")
            if val is not None:
                return val, raw

        return None, ""

    # First try with text-only slice to avoid the cyan bar bleeding into OCR.
    val, raw = run_pipeline(text_slice, "_txt", prefer_white_first=True)
    if val is not None:
        return val, raw

    # === PRIMARY: Gold/amber text extraction (EXP color) ===
    # Reduced scales for faster processing (was 4 scales, now 2)
    for scale in [5.0, 7.0]:
        gold_mask = _extract_gold_text_mask(bgr, scale=scale)
        val, raw = try_img(gold_mask, f"gold_{scale}")
        if val is not None:
            val, raw = _maybe_snap_to_fill(val, raw)
            return val, raw
        # Try bold variant
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        bold = cv2.dilate(gold_mask, kernel, iterations=1)
        val, raw = try_img(bold, f"gold_{scale}_bold")
        if val is not None:
            val, raw = _maybe_snap_to_fill(val, raw)
            return val, raw
        # Try inverted
        val, raw = try_img(255 - gold_mask, f"gold_{scale}_inv")
        if val is not None:
            val, raw = _maybe_snap_to_fill(val, raw)
            return val, raw

    # === SECONDARY: White text extraction (fallback for lighter UI themes) ===
    # Reduced scales (was 3, now 2)
    for scale in [5.0, 7.0]:
        white_mask = _extract_white_text_mask(bgr, scale=scale)
        val, raw = try_img(white_mask, f"white_{scale}")
        if val is not None:
            val, raw = _maybe_snap_to_fill(val, raw)
            return val, raw
        val, raw = try_img(255 - white_mask, f"white_{scale}_inv")
        if val is not None:
            val, raw = _maybe_snap_to_fill(val, raw)
            return val, raw

    # === FALLBACK: Grayscale methods ===
    # Reduced scales (was 3, now 2) and simplified variants
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    for scale in [5.0, 7.0]:
        scaled = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

        # Otsu without blur
        _, th1 = cv2.threshold(scaled, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        val, raw = try_img(th1, f"gray_otsu_{scale}")
        if val is not None:
            return val, raw
        val, raw = try_img(255 - th1, f"gray_otsu_{scale}_inv")
        if val is not None:
            return val, raw

        # CLAHE for better contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(scaled)
        _, th2 = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        val, raw = try_img(th2, f"gray_clahe_{scale}")
        if val is not None:
            return val, raw
        val, raw = try_img(255 - th2, f"gray_clahe_{scale}_inv")
        if val is not None:
            return val, raw

        # Bounding-box crop around detected digits in white mask to prevent leading digit dropout
        contours, _ = cv2.findContours(th2, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        boxes = [cv2.boundingRect(c) for c in contours if cv2.contourArea(c) > 5]
        if boxes:
            # Map the bounding box from the scaled mask back to the (already upscaled) bgr
            sx0 = min(x for x, y, w0, h0 in boxes)
            sy0 = min(y for x, y, w0, h0 in boxes)
            sx1 = max(x + w0 for x, y, w0, h0 in boxes)
            sy1 = max(y + h0 for x, y, w0, h0 in boxes)

            def _clamp(v, limit):
                return max(0, min(limit, int(v)))

            x0 = _clamp((sx0 - 2) / scale, bgr.shape[1])
            y0 = _clamp((sy0 - 2) / scale, bgr.shape[0])
            x1 = _clamp((sx1 + 2) / scale, bgr.shape[1])
            y1 = _clamp((sy1 + 2) / scale, bgr.shape[0])

            cropped = bgr[y0:y1, x0:x1]
            if cropped.size > 0 and cropped.shape[1] > 5 and cropped.shape[0] > 5:
                val_box, raw_box = run_pipeline(cropped, f"_box_scale{scale}", prefer_white_first=True)
                if val_box is not None:
                    return val_box, raw_box

    return None, fallback_raw

def ocr_namelevel(bgr: np.ndarray) -> str:
    sharp = _prep_gray(bgr, scale=3.0)

    _, th_otsu = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    inv = 255 - th_otsu

    raw1 = _ocr_line(th_otsu, whitelist="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789Lv ", timeout=1.0)
    raw2 = _ocr_line(inv,     whitelist="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789Lv ", timeout=1.0)

    return raw1 if len(raw1) >= len(raw2) else raw2


def ocr_lvl(bgr: np.ndarray) -> Tuple[Optional[int], str]:
    """OCR character level (digits only, typically 1-160).

    Uses multiple preprocessing strategies to extract level number from
    the game's HUD. Returns (parsed_level, raw_text).
    """
    h, w = bgr.shape[:2]

    # Upscale small ROIs for better OCR
    if h < 20 or w < 20:
        scale = max(4.0, 40.0 / max(h, 1))
        bgr = cv2.resize(bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    _save_debug("lvl_00_input", bgr)

    whitelist = "0123456789"
    fallback_raw = ""

    def try_img(img: np.ndarray, name: str) -> Tuple[Optional[int], str]:
        nonlocal fallback_raw
        _save_debug(f"lvl_{name}", img)

        raw = _ocr_line(img, whitelist=whitelist, timeout=1.0)
        if raw and not fallback_raw:
            fallback_raw = raw

        if not raw:
            return None, raw

        # Extract digits only
        digits = "".join(c for c in raw if c.isdigit())
        if not digits:
            return None, raw

        try:
            val = int(digits)
            # Valid Flyff level range is 1-160 (or higher for some servers)
            if 1 <= val <= 999:
                return val, raw
        except ValueError:
            pass

        return None, raw

    # === Method 1: Bright text extraction (white/light text on dark bg) ===
    for scale in [4.0, 6.0]:
        bright_mask = _extract_bright_text_mask(bgr, scale=scale)
        val, raw = try_img(bright_mask, f"bright_{scale}")
        if val is not None:
            return val, raw
        val, raw = try_img(255 - bright_mask, f"bright_{scale}_inv")
        if val is not None:
            return val, raw

    # === Method 2: White text HSV extraction ===
    for scale in [4.0, 6.0]:
        white_mask = _extract_white_text_mask(bgr, scale=scale)
        val, raw = try_img(white_mask, f"white_{scale}")
        if val is not None:
            return val, raw
        val, raw = try_img(255 - white_mask, f"white_{scale}_inv")
        if val is not None:
            return val, raw

    # === Method 3: Grayscale with Otsu ===
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    for scale in [4.0, 6.0]:
        scaled = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

        # Otsu threshold
        _, th_otsu = cv2.threshold(scaled, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        val, raw = try_img(th_otsu, f"gray_otsu_{scale}")
        if val is not None:
            return val, raw
        val, raw = try_img(255 - th_otsu, f"gray_otsu_{scale}_inv")
        if val is not None:
            return val, raw

        # Fixed threshold for bright text
        _, th_bright = cv2.threshold(scaled, 180, 255, cv2.THRESH_BINARY)
        val, raw = try_img(th_bright, f"gray_bright_{scale}")
        if val is not None:
            return val, raw

    return None, fallback_raw

def process(png_bytes: bytes, kind: str) -> dict:
    bgr = _as_bgr(png_bytes)
    if bgr is None:
        return {"ok": False, "error": "decode_failed"}

    if _is_blank(bgr):
        # Signal "no text" cleanly so caller can clear value
        return {"ok": False, "error": "blank_image"}

    kind = (kind or "exp").lower()

    if kind in ("exp", "digits"):
        val, raw = ocr_exp(bgr)
        if val is None:
            # If we have any raw text, still return ok so caller can show/parse it
            if raw:
                return {"ok": True, "raw": raw, "value": raw, "unit": "%"}
            return {"ok": False, "raw": raw, "value": None, "unit": "%"}
        return {"ok": True, "raw": raw, "value": f"{val:.4f}", "unit": "%"}

    if kind in ("namelevel", "line"):
        raw = ocr_namelevel(bgr)
        return {"ok": True, "raw": raw, "value": None, "unit": None}

    if kind == "lvl":
        val, raw = ocr_lvl(bgr)
        if val is None:
            return {"ok": True, "raw": raw, "value": None, "unit": None}
        return {"ok": True, "raw": raw, "value": str(val), "unit": None}

    if kind == "charname":
        # Character name: alphanumeric text
        sharp = _prep_gray(bgr, scale=4.0)
        _, th_otsu = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        raw = _ocr_line(th_otsu, whitelist="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ", timeout=1.0)
        if not raw:
            raw = _ocr_line(255 - th_otsu, whitelist="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ", timeout=1.0)
        return {"ok": True, "raw": raw, "value": raw.strip() if raw else None, "unit": None}

    if kind == "enemyname":
        # Monster name: allow letters, spaces, hyphen
        sharp = _prep_gray(bgr, scale=4.0)
        _, th_bin = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        for img in (th_bin, 255 - th_bin):
            raw = _ocr_line(img, whitelist="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz -", timeout=1.0)
            if raw:
                cleaned = re.sub(r"[^A-Za-z -]", "", raw).strip()
                return {"ok": True, "raw": raw, "value": cleaned or raw.strip(), "unit": None}
        raw = _ocr_line(sharp, whitelist="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz -", timeout=1.0)
        cleaned = re.sub(r"[^A-Za-z -]", "", raw or "").strip()
        return {"ok": True, "raw": raw, "value": cleaned or (raw.strip() if raw else None), "unit": None}

    if kind == "lauftext":
        # Scrolling text / chat: general text
        sharp = _prep_gray(bgr, scale=3.0)
        _, th_otsu = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        raw = _ocr_line(th_otsu, timeout=1.0)
        if not raw:
            raw = _ocr_line(255 - th_otsu, timeout=1.0)
        return {"ok": True, "raw": raw, "value": None, "unit": None}

    # Default fallback for unknown kinds
    raw = _ocr_line(_prep_gray(bgr, scale=3.0))
    return {"ok": True, "raw": raw, "value": None, "unit": None}

def main() -> int:
    print(f"[Python OCR] Worker started, waiting for input...", file=sys.stderr, flush=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        ts_start = None
        msg = None
        try:
            msg = json.loads(line)
            png_b64 = msg.get("png_b64")
            kind = msg.get("kind", "exp")
            rid = msg.get("id")
            if random.random() < 0.10:
                print(
                    f"[Python OCR] Received request id={rid} kind={kind} png_len={len(png_b64) if png_b64 else 0}",
                    file=sys.stderr,
                    flush=True,
                )

            if DEBUG_MODE:
                try:
                    ts_start = int(time.time() * 1000)
                    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
                    (DEBUG_DIR / f"req_{rid}_start.txt").write_text(f"{ts_start}")
                except Exception:
                    pass

            png_bytes = base64.b64decode(png_b64) if png_b64 else b""
            out = process(png_bytes, kind)
            out["id"] = rid

            response = json.dumps(out, ensure_ascii=False) + "\n"
            if random.random() < 0.10:
                print(
                    f"[Python OCR] Sending response id={rid} ok={out.get('ok')} len={len(response)}",
                    file=sys.stderr,
                    flush=True,
                )
            sys.stdout.write(response)
            sys.stdout.flush()

            if DEBUG_MODE and ts_start is not None:
                try:
                    ts_end = int(time.time() * 1000)
                    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
                    (DEBUG_DIR / f"req_{rid}_done.txt").write_text(f"{ts_start}->{ts_end} ({ts_end - ts_start} ms)")
                except Exception:
                    pass
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

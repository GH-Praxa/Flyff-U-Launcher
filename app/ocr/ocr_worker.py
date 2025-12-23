#!/usr/bin/env python3
"""
stdin JSONL -> stdout JSONL

Input:
  {"id": 1, "png_b64": "...", "kind": "exp"|"namelevel"}

Output:
  {"id":1, "ok":true, "raw":"...", "value":"75.0000", "unit":"%"}
"""
import sys, json, base64, re
from collections import Counter
from typing import Optional, Tuple

import numpy as np
import cv2
import pytesseract

# Optional (Windows): set env TESSERACT_CMD or hardcode:
# import os
# pytesseract.pytesseract.tesseract_cmd = os.environ.get("TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe")

FLOAT_RE = re.compile(r"\d+(?:[.,]\d+)?")

def _as_bgr(png_bytes: bytes) -> Optional[np.ndarray]:
    arr = np.frombuffer(png_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return bgr

def _ocr_line(img: np.ndarray, whitelist: Optional[str] = None) -> str:
    cfg = "--oem 3 --psm 7"
    if whitelist:
        cfg += f" -c tessedit_char_whitelist={whitelist}"
    txt = pytesseract.image_to_string(img, config=cfg) or ""
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

def ocr_exp(bgr: np.ndarray) -> Tuple[Optional[float], str]:
    """OCR EXP percent (stabil).

    Der alte Multi-Threshold-Vote ist auf der EXP-Bar zu noisy.
    Diese Variante ist absichtlich simpel:
    - Upscale
    - leichter Blur
    - Otsu Threshold + invert
    - Whitelist digits/./,/%
    """
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=8.0, fy=8.0, interpolation=cv2.INTER_CUBIC)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)

    _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    inv = 255 - th

    imgs = [th, inv]

    raw_best = ""
    best_val: Optional[float] = None
    best_score = -10_000

    for img in imgs:
        raw = _ocr_line(img, whitelist="0123456789.,%")
        if len(raw) > len(raw_best):
            raw_best = raw

        v = _parse_exp_percent(raw)
        if v is None:
            continue

        cleaned = raw.replace("%", "").replace(",", "").replace(".", "")
        score = 100
        if "%" in raw:
            score += 10
        if "." in raw or "," in raw:
            score += 3
        if cleaned.isdigit() and 5 <= len(cleaned) <= 7:
            score += 8
        score += min(len(raw), 20)

        # vermeidet, dass Müll wie "0.263" gewinnt
        if v < 1.0:
            score -= 10

        if score > best_score:
            best_score = score
            best_val = v
            raw_best = raw

    if best_val is None:
        return None, raw_best

    return best_val, raw_best

def ocr_namelevel(bgr: np.ndarray) -> str:
    sharp = _prep_gray(bgr, scale=3.0)

    _, th_otsu = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    inv = 255 - th_otsu

    raw1 = _ocr_line(th_otsu, whitelist="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789Lv ")
    raw2 = _ocr_line(inv,     whitelist="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789Lv ")

    return raw1 if len(raw1) >= len(raw2) else raw2

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

    raw = _ocr_line(_prep_gray(bgr, scale=3.0))
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

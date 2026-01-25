e#!/usr/bin/env python3
"""Test OCR directly on an image file."""
import sys
import cv2
import numpy as np
from pathlib import Path

# Add parent to path to import ocr_worker
sys.path.insert(0, str(Path(__file__).parent))

from ocr_worker import ocr_exp, _extract_gold_text_mask

def test_image(image_path: str):
    print(f"Loading: {image_path}")
    bgr = cv2.imread(image_path)
    if bgr is None:
        print("ERROR: Could not load image")
        return

    print(f"Image size: {bgr.shape}")

    # Save input
    debug_dir = Path(__file__).parent / "debug"
    debug_dir.mkdir(exist_ok=True)

    cv2.imwrite(str(debug_dir / "test_input.png"), bgr)
    print(f"Saved input to: {debug_dir / 'test_input.png'}")

    # Test gold mask extraction
    for scale in [6.0, 8.0, 10.0]:
        mask = _extract_gold_text_mask(bgr, scale=scale)
        cv2.imwrite(str(debug_dir / f"test_gold_{scale}.png"), mask)
        cv2.imwrite(str(debug_dir / f"test_gold_{scale}_inv.png"), 255 - mask)
        print(f"Saved gold mask at scale {scale}")

    # Test grayscale
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    for scale in [6.0, 8.0, 10.0]:
        scaled = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        _, th = cv2.threshold(scaled, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        cv2.imwrite(str(debug_dir / f"test_gray_{scale}.png"), th)
        cv2.imwrite(str(debug_dir / f"test_gray_{scale}_inv.png"), 255 - th)
        print(f"Saved grayscale at scale {scale}")

    # Run OCR
    print("\nRunning OCR...")
    val, raw = ocr_exp(bgr)
    print(f"Result: value={val}, raw='{raw}'")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_ocr.py <image_path>")
        print("Example: python test_ocr.py debug/test_input.png")
        sys.exit(1)

    test_image(sys.argv[1])

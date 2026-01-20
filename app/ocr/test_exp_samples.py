#!/usr/bin/env python3
"""Lightweight regression check for EXP OCR on stored debug samples."""
from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2

# Ensure we can import the worker from the same folder
sys.path.insert(0, str(Path(__file__).parent))
from ocr_worker import ocr_exp  # noqa: E402

ROOT = Path(__file__).parent


@dataclass(frozen=True)
class Sample:
    path: Path
    expected: Optional[float]  # None means we expect "no value"
    tolerance: float = 0.25


# Current curated samples (keep small to avoid bloat)
SAMPLES: list[Sample] = [
    # Post-level-up mid fill (should parse ~50%, not 2%)
    Sample(ROOT / "debug" / "roi_exp_1768517513407.png", expected=50.0, tolerance=3.0),
    # Blank/invalid captures should not return a value
    Sample(ROOT / "debug" / "roi_exp_1768517504968.png", expected=None),
    Sample(ROOT / "debug" / "roi_exp_1768517505299.png", expected=None),
]


def run_sample(sample: Sample) -> tuple[bool, Optional[float], str]:
    bgr = cv2.imread(str(sample.path))
    if bgr is None:
        # Treat missing images as OK only when we expect no value.
        if sample.expected is None:
            return True, None, f"missing image: {sample.path}"
        return False, None, f"missing image: {sample.path}"

    val, raw = ocr_exp(bgr)

    if sample.expected is None:
        ok = val is None
    else:
        ok = val is not None and abs(val - sample.expected) <= sample.tolerance

    return ok, val, raw


def main() -> int:
    failures: list[str] = []

    for sample in SAMPLES:
        ok, val, raw = run_sample(sample)
        status = "OK " if ok else "FAIL"
        expected_str = "None" if sample.expected is None else f"{sample.expected:.4f}+/-{sample.tolerance}"
        print(f"{status} {sample.path.name}: got={val} raw='{raw}' expected={expected_str}")
        if not ok:
            failures.append(sample.path.name)

    if failures:
        print(f"\nFailed samples: {', '.join(failures)}")
        return 1

    print("\nAll sample EXP OCR checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

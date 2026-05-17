import { describe, it, expect } from "vitest";
import {
    findConnectedComponents,
    isExpPercentMatch,
    rankCandidates,
    tightenToTextBlock,
    EXP_REGEX,
    type BBox,
} from "./autoDiscoverRoi";
import type { RawImage } from "./pixelOps";

function makeMask(width: number, height: number, draw: (x: number, y: number) => boolean): RawImage {
    const data = Buffer.alloc(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            data[y * width + x] = draw(x, y) ? 255 : 0;
        }
    }
    return { data, width, height, channels: 1 };
}

describe("isExpPercentMatch", () => {
    it("matches Flyff EXP format", () => {
        expect(isExpPercentMatch("68.0749%")).toBe(true);
        expect(isExpPercentMatch("68.0749")).toBe(true);
        expect(isExpPercentMatch("0.0001%")).toBe(true);
        expect(isExpPercentMatch("99.9999%")).toBe(true);
        expect(isExpPercentMatch("100.0%")).toBe(true);
    });
    it("accepts comma decimal separator", () => {
        expect(isExpPercentMatch("68,0749%")).toBe(true);
    });
    it("rejects non-EXP strings", () => {
        expect(isExpPercentMatch("")).toBe(false);
        expect(isExpPercentMatch("HP 1234/5678")).toBe(false);
        expect(isExpPercentMatch("level 105")).toBe(false);
        expect(isExpPercentMatch("68")).toBe(false);
        expect(isExpPercentMatch("68%")).toBe(false);
        expect(isExpPercentMatch("12345.6789")).toBe(false); // too many integer digits
    });
    it("EXP_REGEX is anchored", () => {
        expect(EXP_REGEX.test("prefix 68.0749% suffix")).toBe(false);
    });
});

describe("findConnectedComponents", () => {
    it("returns empty for blank mask", () => {
        const mask = makeMask(100, 100, () => false);
        expect(findConnectedComponents(mask)).toEqual([]);
    });

    it("finds a single rectangle as one component", () => {
        const mask = makeMask(100, 100, (x, y) => x >= 20 && x < 40 && y >= 30 && y < 50);
        const boxes = findConnectedComponents(mask);
        expect(boxes).toHaveLength(1);
        expect(boxes[0]).toEqual({ x: 20, y: 30, w: 20, h: 20, pixelCount: 400 });
    });

    it("separates two disjoint components", () => {
        const mask = makeMask(100, 100, (x, y) =>
            (x >= 10 && x < 20 && y >= 10 && y < 20) ||
            (x >= 50 && x < 60 && y >= 50 && y < 60)
        );
        const boxes = findConnectedComponents(mask);
        expect(boxes).toHaveLength(2);
        boxes.sort((a, b) => a.x - b.x);
        expect(boxes[0]!.x).toBe(10);
        expect(boxes[1]!.x).toBe(50);
    });

    it("connects diagonal-only neighbors as separate components (4-conn)", () => {
        const mask = makeMask(10, 10, (x, y) => (x === 2 && y === 2) || (x === 3 && y === 3));
        const boxes = findConnectedComponents(mask);
        expect(boxes).toHaveLength(2);
    });

    it("handles a thin horizontal line", () => {
        const mask = makeMask(100, 20, (x, y) => y === 10 && x >= 10 && x < 90);
        const boxes = findConnectedComponents(mask);
        expect(boxes).toHaveLength(1);
        expect(boxes[0]).toMatchObject({ x: 10, y: 10, w: 80, h: 1, pixelCount: 80 });
    });

    it("does not stack-overflow on a large filled rectangle", () => {
        const mask = makeMask(500, 500, () => true);
        const boxes = findConnectedComponents(mask);
        expect(boxes).toHaveLength(1);
        expect(boxes[0]!.pixelCount).toBe(500 * 500);
    });
});

describe("rankCandidates", () => {
    const opts = {
        minWidth: 40, maxWidth: 400,
        minHeight: 8, maxHeight: 40,
        minAspectRatio: 3,
        minDensity: 0.15, maxDensity: 0.85,
        maxCandidates: 10,
        paddingPx: 2,
    };

    function bb(x: number, y: number, w: number, h: number, fill = 0.5): BBox {
        return { x, y, w, h, pixelCount: Math.round(w * h * fill) };
    }

    it("rejects too-small boxes", () => {
        const out = rankCandidates([bb(0, 0, 30, 10)], 1000, 800, opts);
        expect(out).toHaveLength(0);
    });

    it("rejects boxes with wrong aspect ratio", () => {
        // 50 × 20 → aspect 2.5, below min 3
        const out = rankCandidates([bb(0, 0, 50, 20)], 1000, 800, opts);
        expect(out).toHaveLength(0);
    });

    it("rejects boxes with extreme density", () => {
        // 0.05 density (too sparse)
        const out = rankCandidates([bb(0, 0, 100, 20, 0.05)], 1000, 800, opts);
        expect(out).toHaveLength(0);
    });

    it("accepts EXP-bar-shaped box", () => {
        const out = rankCandidates([bb(800, 700, 115, 22, 0.4)], 1920, 1080, opts);
        expect(out).toHaveLength(1);
    });

    it("ranks lower-half candidates before upper-half ones", () => {
        const upper = bb(100, 100, 115, 22, 0.4); // y=100, frameH=1080 → upper
        const lower = bb(100, 800, 100, 22, 0.4); // y=800 → lower (>40% mark)
        const out = rankCandidates([upper, lower], 1920, 1080, opts);
        expect(out[0]).toBe(lower);
        expect(out[1]).toBe(upper);
    });

    it("prefers wider candidates within the same vertical half", () => {
        const narrow = bb(100, 800, 50, 12, 0.4);
        const wide = bb(200, 800, 150, 20, 0.4);
        const out = rankCandidates([narrow, wide], 1920, 1080, opts);
        expect(out[0]).toBe(wide);
    });

    it("caps to maxCandidates", () => {
        const many: BBox[] = [];
        for (let i = 0; i < 20; i++) many.push(bb(i * 10, 800, 60 + i, 12, 0.4));
        const out = rankCandidates(many, 1920, 1080, opts);
        expect(out).toHaveLength(10);
    });
});

describe("tightenToTextBlock", () => {
    const trimOpts = { minColSum: 5, maxColGap: 3, paddingPx: 0 };

    it("trims to the rightmost dense block, ignoring left-side noise", () => {
        // 200×20 mask. Left: thin noise column at x=10 (only 2 px tall).
        // Right: dense "digits" block columns 100..160 (full-height fill).
        const mask = makeMask(200, 20, (x, y) => {
            if (x === 10 && y >= 8 && y <= 9) return true; // 2-px sparse noise
            if (x >= 100 && x <= 160 && y >= 5 && y <= 14) return true; // dense
            return false;
        });
        const bbox: BBox = { x: 0, y: 0, w: 200, h: 20, pixelCount: 0 };
        const out = tightenToTextBlock(mask, bbox, trimOpts);
        expect(out.x).toBe(100);
        expect(out.w).toBe(61);
        expect(out.y).toBe(5);
        expect(out.h).toBe(10);
    });

    it("tolerates a small gap (e.g. decimal point spacing) inside the run", () => {
        // Two dense clusters separated by a 2-column gap — should be merged.
        const mask = makeMask(80, 16, (x, y) => {
            const inLeft = x >= 10 && x <= 30 && y >= 3 && y <= 12;
            const inRight = x >= 33 && x <= 50 && y >= 3 && y <= 12;
            return inLeft || inRight;
        });
        const bbox: BBox = { x: 0, y: 0, w: 80, h: 16, pixelCount: 0 };
        const out = tightenToTextBlock(mask, bbox, trimOpts);
        expect(out.x).toBe(10);
        expect(out.w).toBe(41); // 10..50 inclusive
    });

    it("stops scanning past a large gap (separates label from digits)", () => {
        // Left block (cols 5..15) and right block (cols 60..70) separated by
        // 44 empty cols. Right block alone should be kept.
        const mask = makeMask(100, 20, (x, y) => {
            const leftBlock = x >= 5 && x <= 15 && y >= 3 && y <= 12;
            const rightBlock = x >= 60 && x <= 70 && y >= 3 && y <= 12;
            return leftBlock || rightBlock;
        });
        const bbox: BBox = { x: 0, y: 0, w: 100, h: 20, pixelCount: 0 };
        const out = tightenToTextBlock(mask, bbox, trimOpts);
        expect(out.x).toBe(60);
        expect(out.w).toBe(11);
    });

    it("returns bbox unchanged when no dense column meets threshold", () => {
        const mask = makeMask(50, 20, (x, y) => x === 25 && y === 10);
        const bbox: BBox = { x: 0, y: 0, w: 50, h: 20, pixelCount: 1 };
        const out = tightenToTextBlock(mask, bbox, trimOpts);
        expect(out).toEqual(bbox);
    });

    it("applies padding, clamped to mask bounds", () => {
        const mask = makeMask(50, 20, (x, y) => x >= 20 && x <= 30 && y >= 6 && y <= 13);
        const bbox: BBox = { x: 0, y: 0, w: 50, h: 20, pixelCount: 0 };
        const out = tightenToTextBlock(mask, bbox, { ...trimOpts, paddingPx: 3 });
        expect(out.x).toBe(17);
        expect(out.w).toBe(17); // 11 px digit + 6 padding
        expect(out.y).toBe(3);
        expect(out.h).toBe(14);
    });

    it("does not exceed the parent bbox even with padding at the edge", () => {
        const mask = makeMask(20, 10, (x, y) => x >= 15 && x <= 19 && y >= 4 && y <= 9);
        const bbox: BBox = { x: 0, y: 0, w: 20, h: 10, pixelCount: 0 };
        const out = tightenToTextBlock(mask, bbox, { ...trimOpts, paddingPx: 5 });
        expect(out.x + out.w).toBeLessThanOrEqual(mask.width);
        expect(out.y + out.h).toBeLessThanOrEqual(mask.height);
    });

    it("recomputes pixelCount for the trimmed bbox", () => {
        const mask = makeMask(60, 20, (x, y) =>
            (x >= 5 && x <= 8 && y >= 8 && y <= 11) || // sparse noise (16 px)
            (x >= 30 && x <= 40 && y >= 5 && y <= 14)  // dense (110 px)
        );
        const bbox: BBox = { x: 0, y: 0, w: 60, h: 20, pixelCount: 999 };
        const out = tightenToTextBlock(mask, bbox, trimOpts);
        expect(out.x).toBe(30);
        expect(out.pixelCount).toBe(11 * 10);
    });
});

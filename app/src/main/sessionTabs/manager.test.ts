/**
 * Tests for SessionTabsManager grid/split helpers.
 * These are lightweight functional checks mirroring the layout maths.
 */
import { describe, it, expect } from 'vitest';
import { GRID_CONFIGS, LAYOUT } from '../../shared/constants';

type ViewBounds = { x: number; y: number; width: number; height: number };
type LayoutType = keyof typeof GRID_CONFIGS;
type LayoutCell = { id: string; position: number };
type MultiLayout = { type: LayoutType; cells: LayoutCell[]; ratio?: number };

function clampSplitRatio(
    ratio: number,
    min = LAYOUT.MIN_SPLIT_RATIO,
    max = LAYOUT.MAX_SPLIT_RATIO,
    current = LAYOUT.DEFAULT_SPLIT_RATIO
): number {
    if (!Number.isFinite(ratio)) return current;
    return Math.min(max, Math.max(min, ratio));
}

function computeSplit2Bounds(bounds: ViewBounds, layout: MultiLayout, gap: number) {
    const ratio = clampSplitRatio(layout.ratio ?? LAYOUT.DEFAULT_SPLIT_RATIO);
    const left = layout.cells.find((c) => c.position === 0) ?? layout.cells[0];
    const right = layout.cells.find((c) => c.position === 1) ?? layout.cells[1];
    const hasRight = !!right;
    const totalGap = hasRight ? gap : 0;
    const leftWidth = hasRight ? Math.max(1, Math.floor((bounds.width - totalGap) * ratio)) : bounds.width;
    const rightWidth = hasRight ? Math.max(1, bounds.width - totalGap - leftWidth) : 0;
    const result = [];
    if (left) {
        result.push({
            id: left.id,
            bounds: { x: bounds.x, y: bounds.y, width: leftWidth, height: bounds.height },
        });
    }
    if (right) {
        result.push({
            id: right.id,
            bounds: { x: bounds.x + leftWidth + totalGap, y: bounds.y, width: rightWidth, height: bounds.height },
        });
    }
    return result;
}

function computeGridLayoutBounds(bounds: ViewBounds, layout: MultiLayout, gap: number) {
    const config = GRID_CONFIGS[layout.type];
    const { rows, cols } = config;
    const totalGapX = gap * (cols - 1);
    const totalGapY = gap * (rows - 1);
    const cellWidth = Math.floor((bounds.width - totalGapX) / cols);
    const cellHeight = Math.floor((bounds.height - totalGapY) / rows);
    return layout.cells.map((cell) => {
        const row = Math.floor(cell.position / cols);
        const col = cell.position % cols;
        return {
            id: cell.id,
            bounds: {
                x: bounds.x + col * (cellWidth + gap),
                y: bounds.y + row * (cellHeight + gap),
                width: cellWidth,
                height: cellHeight,
            },
        };
    });
}

describe('SessionTabsManager Logic', () => {
    describe('clampSplitRatio', () => {
        it('returns current ratio for non-finite values', () => {
            expect(clampSplitRatio(NaN)).toBe(LAYOUT.DEFAULT_SPLIT_RATIO);
            expect(clampSplitRatio(Infinity)).toBe(LAYOUT.DEFAULT_SPLIT_RATIO);
        });

        it('clamps outside bounds', () => {
            expect(clampSplitRatio(0)).toBe(LAYOUT.MIN_SPLIT_RATIO);
            expect(clampSplitRatio(1)).toBe(LAYOUT.MAX_SPLIT_RATIO);
        });

        it('keeps valid ratio unchanged', () => {
            expect(clampSplitRatio(0.5)).toBe(0.5);
        });
    });

    describe('computeSplit2Bounds', () => {
        const baseBounds: ViewBounds = { x: 0, y: 60, width: 1200, height: 700 };
        const layout: MultiLayout = {
            type: 'split-2',
            cells: [
                { id: 'left', position: 0 },
                { id: 'right', position: 1 },
            ],
            ratio: 0.5,
        };
        it('splits width according to ratio and gap', () => {
            const result = computeSplit2Bounds(baseBounds, layout, LAYOUT.SPLIT_GAP);
            expect(result).toHaveLength(2);
            const totalWidth = result[0].bounds.width + result[1].bounds.width + LAYOUT.SPLIT_GAP;
            expect(totalWidth).toBe(baseBounds.width);
        });

        it('respects ratio skew', () => {
            const widerLeft = computeSplit2Bounds(baseBounds, { ...layout, ratio: 0.7 }, LAYOUT.SPLIT_GAP);
            expect(widerLeft[0].bounds.width).toBeGreaterThan(widerLeft[1].bounds.width);
        });
    });

    describe('computeGridLayoutBounds', () => {
        const baseBounds: ViewBounds = { x: 0, y: 0, width: 800, height: 600 };
        const layout: MultiLayout = {
            type: 'grid-4',
            cells: [
                { id: 'p1', position: 0 },
                { id: 'p2', position: 1 },
                { id: 'p3', position: 2 },
                { id: 'p4', position: 3 },
            ],
        };

        it('creates one cell per entry with grid spacing', () => {
            const result = computeGridLayoutBounds(baseBounds, layout, LAYOUT.GRID_GAP);
            expect(result).toHaveLength(4);
            // top-left cell starts at origin
            expect(result[0].bounds.x).toBe(0);
            expect(result[0].bounds.y).toBe(0);
            // bottom-right cell has max x/y among cells
            const maxX = Math.max(...result.map((r) => r.bounds.x));
            const maxY = Math.max(...result.map((r) => r.bounds.y));
            expect(maxX).toBeGreaterThan(0);
            expect(maxY).toBeGreaterThan(0);
        });
    });
});

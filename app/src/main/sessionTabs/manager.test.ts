/**
 * Tests for SessionTabsManager helper functions.
 * Note: Full integration tests require Electron runtime.
 * These tests cover the pure logic functions that can be unit tested.
 */
import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../../shared/constants';

// Test the clampSplitRatio logic (extracted for testing)
function clampSplitRatio(ratio: number, min = LAYOUT.MIN_SPLIT_RATIO, max = LAYOUT.MAX_SPLIT_RATIO, current = LAYOUT.DEFAULT_SPLIT_RATIO): number {
    if (!Number.isFinite(ratio)) return current;
    return Math.min(max, Math.max(min, ratio));
}

// Test the computeLayoutBounds logic (extracted for testing)
type ViewBounds = { x: number; y: number; width: number; height: number };
function computeLayoutBounds(
    sessionBounds: ViewBounds,
    ids: string[],
    hasSplit: boolean,
    splitRatio: number,
    splitGap: number
): Array<{ id: string; bounds: ViewBounds }> {
    if (ids.length === 0) return [];

    const gap = hasSplit && ids.length > 1 ? splitGap : 0;
    const leftWidth = hasSplit && ids.length > 1
        ? Math.max(1, Math.floor((sessionBounds.width - gap) * clampSplitRatio(splitRatio)))
        : sessionBounds.width;
    const rightWidth = hasSplit && ids.length > 1
        ? Math.max(1, sessionBounds.width - gap - leftWidth)
        : sessionBounds.width;

    return ids.map((id, idx) => {
        const isLeft = idx === 0;
        const width = hasSplit && ids.length > 1 ? (isLeft ? leftWidth : rightWidth) : sessionBounds.width;
        const x = hasSplit && ids.length > 1 && !isLeft ? sessionBounds.x + leftWidth + gap : sessionBounds.x;
        return {
            id,
            bounds: { x, y: sessionBounds.y, width, height: sessionBounds.height },
        };
    });
}

describe('SessionTabsManager Logic', () => {
    describe('clampSplitRatio', () => {
        it('should return current ratio for non-finite values', () => {
            expect(clampSplitRatio(NaN)).toBe(LAYOUT.DEFAULT_SPLIT_RATIO);
            expect(clampSplitRatio(Infinity)).toBe(LAYOUT.DEFAULT_SPLIT_RATIO);
            expect(clampSplitRatio(-Infinity)).toBe(LAYOUT.DEFAULT_SPLIT_RATIO);
        });

        it('should clamp values below minimum', () => {
            expect(clampSplitRatio(0)).toBe(LAYOUT.MIN_SPLIT_RATIO);
            expect(clampSplitRatio(0.1)).toBe(LAYOUT.MIN_SPLIT_RATIO);
        });

        it('should clamp values above maximum', () => {
            expect(clampSplitRatio(1)).toBe(LAYOUT.MAX_SPLIT_RATIO);
            expect(clampSplitRatio(0.95)).toBe(LAYOUT.MAX_SPLIT_RATIO);
        });

        it('should return valid ratio within range', () => {
            expect(clampSplitRatio(0.5)).toBe(0.5);
            expect(clampSplitRatio(0.3)).toBe(0.3);
            expect(clampSplitRatio(0.7)).toBe(0.7);
        });
    });

    describe('computeLayoutBounds', () => {
        const baseBounds: ViewBounds = { x: 0, y: 60, width: 1200, height: 700 };
        const splitGap = LAYOUT.SPLIT_GAP;

        it('should return empty array for no ids', () => {
            const result = computeLayoutBounds(baseBounds, [], false, 0.5, splitGap);
            expect(result).toEqual([]);
        });

        it('should return full bounds for single tab without split', () => {
            const result = computeLayoutBounds(baseBounds, ['profile1'], false, 0.5, splitGap);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('profile1');
            expect(result[0].bounds).toEqual(baseBounds);
        });

        it('should split bounds equally for two tabs with 0.5 ratio', () => {
            const result = computeLayoutBounds(baseBounds, ['left', 'right'], true, 0.5, splitGap);

            expect(result).toHaveLength(2);

            // Left pane
            expect(result[0].id).toBe('left');
            expect(result[0].bounds.x).toBe(0);
            expect(result[0].bounds.width).toBeLessThan(baseBounds.width);

            // Right pane
            expect(result[1].id).toBe('right');
            expect(result[1].bounds.x).toBeGreaterThan(0);
            expect(result[1].bounds.width).toBeLessThan(baseBounds.width);

            // Total width should account for gap
            expect(result[0].bounds.width + splitGap + result[1].bounds.width).toBe(baseBounds.width);
        });

        it('should respect split ratio', () => {
            const result70 = computeLayoutBounds(baseBounds, ['left', 'right'], true, 0.7, splitGap);
            const result30 = computeLayoutBounds(baseBounds, ['left', 'right'], true, 0.3, splitGap);

            // 70% ratio should give left pane more width
            expect(result70[0].bounds.width).toBeGreaterThan(result70[1].bounds.width);

            // 30% ratio should give left pane less width
            expect(result30[0].bounds.width).toBeLessThan(result30[1].bounds.width);
        });

        it('should preserve y position and height for all panes', () => {
            const result = computeLayoutBounds(baseBounds, ['left', 'right'], true, 0.5, splitGap);

            expect(result[0].bounds.y).toBe(baseBounds.y);
            expect(result[0].bounds.height).toBe(baseBounds.height);
            expect(result[1].bounds.y).toBe(baseBounds.y);
            expect(result[1].bounds.height).toBe(baseBounds.height);
        });

        it('should not apply gap when split is false', () => {
            const result = computeLayoutBounds(baseBounds, ['profile1'], false, 0.5, splitGap);

            expect(result[0].bounds.width).toBe(baseBounds.width);
        });

        it('should handle single tab even when split is true', () => {
            const result = computeLayoutBounds(baseBounds, ['profile1'], true, 0.5, splitGap);

            // With only one tab, no gap is applied
            expect(result[0].bounds.width).toBe(baseBounds.width);
        });
    });
});

/**
 * Tests for shared constants.
 * Validates that constant values are within expected ranges and formats.
 */
import { describe, it, expect } from 'vitest';
import { URLS, TIMINGS, LAYOUT, LIMITS } from './constants';

describe('Constants', () => {
    // =========================================================================
    // URLS
    // =========================================================================

    describe('URLS', () => {
        it('should have valid HTTPS URLs', () => {
            expect(URLS.FLYFF_PLAY).toMatch(/^https:\/\//);
            expect(URLS.FLYFF_NEWS).toMatch(/^https:\/\//);
            expect(URLS.FLYFF_BASE).toMatch(/^https:\/\//);
            expect(URLS.GITHUB_REPO).toMatch(/^https:\/\//);
            expect(URLS.GITHUB_PACKAGE).toMatch(/^https:\/\//);
        });

        it('should point to flyff universe domain', () => {
            expect(URLS.FLYFF_PLAY).toContain('universe.flyff.com');
            expect(URLS.FLYFF_NEWS).toContain('universe.flyff.com');
            expect(URLS.FLYFF_BASE).toContain('universe.flyff.com');
        });

        it('should have play URL ending with /play', () => {
            expect(URLS.FLYFF_PLAY).toMatch(/\/play$/);
        });

        it('should have news URL ending with /news', () => {
            expect(URLS.FLYFF_NEWS).toMatch(/\/news$/);
        });

        it('should point GitHub to correct repository', () => {
            expect(URLS.GITHUB_REPO).toContain('github.com');
            expect(URLS.GITHUB_REPO).toContain('Flyff-U-Launcher');
        });

        it('should point to raw GitHub for package.json', () => {
            expect(URLS.GITHUB_PACKAGE).toContain('raw.githubusercontent.com');
            expect(URLS.GITHUB_PACKAGE).toContain('package.json');
        });
    });

    // =========================================================================
    // TIMINGS
    // =========================================================================

    describe('TIMINGS', () => {
        it('should have positive timing values', () => {
            expect(TIMINGS.OCR_POLL_MS).toBeGreaterThan(0);
            expect(TIMINGS.NAME_LEVEL_CHECK_MS).toBeGreaterThan(0);
            expect(TIMINGS.HOVER_POLL_MS).toBeGreaterThan(0);
            expect(TIMINGS.OVERLAY_FOLLOW_MS).toBeGreaterThan(0);
            expect(TIMINGS.INVALIDATE_DEBOUNCE_MS).toBeGreaterThan(0);
            expect(TIMINGS.VIEW_LOAD_TIMEOUT_MS).toBeGreaterThan(0);
            expect(TIMINGS.FETCH_TIMEOUT_MS).toBeGreaterThan(0);
            expect(TIMINGS.TIP_ROTATION_MS).toBeGreaterThan(0);
            expect(TIMINGS.BOUNDS_PUSH_DELAY_MS).toBeGreaterThan(0);
            expect(TIMINGS.BOUNDS_PUSH_DELAY_SECONDARY_MS).toBeGreaterThan(0);
            expect(TIMINGS.STARTUP_DELAY_MS).toBeGreaterThan(0);
        });

        it('should have OCR poll at reasonable interval (500-2000ms)', () => {
            expect(TIMINGS.OCR_POLL_MS).toBeGreaterThanOrEqual(500);
            expect(TIMINGS.OCR_POLL_MS).toBeLessThanOrEqual(2000);
        });

        it('should have name/level check less frequent than OCR poll', () => {
            expect(TIMINGS.NAME_LEVEL_CHECK_MS).toBeGreaterThan(TIMINGS.OCR_POLL_MS);
        });

        it('should have invalidate debounce at ~60fps frame time', () => {
            // 60fps = ~16.67ms per frame
            expect(TIMINGS.INVALIDATE_DEBOUNCE_MS).toBeGreaterThanOrEqual(10);
            expect(TIMINGS.INVALIDATE_DEBOUNCE_MS).toBeLessThanOrEqual(20);
        });

        it('should have reasonable timeout values', () => {
            // Timeouts should be at least 5 seconds
            expect(TIMINGS.VIEW_LOAD_TIMEOUT_MS).toBeGreaterThanOrEqual(5000);
            expect(TIMINGS.FETCH_TIMEOUT_MS).toBeGreaterThanOrEqual(5000);
        });

        it('should have secondary bounds delay greater than primary', () => {
            expect(TIMINGS.BOUNDS_PUSH_DELAY_SECONDARY_MS).toBeGreaterThan(
                TIMINGS.BOUNDS_PUSH_DELAY_MS
            );
        });
    });

    // =========================================================================
    // LAYOUT
    // =========================================================================

    describe('LAYOUT', () => {
        it('should have positive dimension values', () => {
            expect(LAYOUT.LAUNCHER_WIDTH).toBeGreaterThan(0);
            expect(LAYOUT.LAUNCHER_HEIGHT).toBeGreaterThan(0);
            expect(LAYOUT.INSTANCE_WIDTH).toBeGreaterThan(0);
            expect(LAYOUT.INSTANCE_HEIGHT).toBeGreaterThan(0);
            expect(LAYOUT.PANEL_WIDTH).toBeGreaterThan(0);
        });

        it('should have reasonable launcher dimensions', () => {
            // Launcher should fit on most screens
            expect(LAYOUT.LAUNCHER_WIDTH).toBeLessThanOrEqual(1920);
            expect(LAYOUT.LAUNCHER_HEIGHT).toBeLessThanOrEqual(1080);
        });

        it('should have reasonable instance dimensions', () => {
            // Instance should be usable size
            expect(LAYOUT.INSTANCE_WIDTH).toBeGreaterThanOrEqual(800);
            expect(LAYOUT.INSTANCE_HEIGHT).toBeGreaterThanOrEqual(600);
        });

        it('should have split gap as positive small value', () => {
            expect(LAYOUT.SPLIT_GAP).toBeGreaterThan(0);
            expect(LAYOUT.SPLIT_GAP).toBeLessThanOrEqual(20);
        });

        it('should have valid split ratio range', () => {
            expect(LAYOUT.MIN_SPLIT_RATIO).toBeGreaterThan(0);
            expect(LAYOUT.MIN_SPLIT_RATIO).toBeLessThan(0.5);

            expect(LAYOUT.MAX_SPLIT_RATIO).toBeGreaterThan(0.5);
            expect(LAYOUT.MAX_SPLIT_RATIO).toBeLessThan(1);

            expect(LAYOUT.DEFAULT_SPLIT_RATIO).toBe(0.5);
        });

        it('should have symmetric min/max split ratios', () => {
            // MIN + MAX should equal 1 (symmetric around 0.5)
            expect(LAYOUT.MIN_SPLIT_RATIO + LAYOUT.MAX_SPLIT_RATIO).toBe(1);
        });

        it('should have default ratio between min and max', () => {
            expect(LAYOUT.DEFAULT_SPLIT_RATIO).toBeGreaterThanOrEqual(LAYOUT.MIN_SPLIT_RATIO);
            expect(LAYOUT.DEFAULT_SPLIT_RATIO).toBeLessThanOrEqual(LAYOUT.MAX_SPLIT_RATIO);
        });
    });

    // =========================================================================
    // LIMITS
    // =========================================================================

    describe('LIMITS', () => {
        it('should have positive limit values', () => {
            expect(LIMITS.MAX_ID_LENGTH).toBeGreaterThan(0);
            expect(LIMITS.MAX_NAME_LENGTH).toBeGreaterThan(0);
            expect(LIMITS.PYTHON_VERIFY_TIMEOUT_MS).toBeGreaterThan(0);
            expect(LIMITS.OCR_TIMEOUT_MS).toBeGreaterThan(0);
        });

        it('should have reasonable ID length limit', () => {
            // ID should be long enough for UUIDs but not excessive
            expect(LIMITS.MAX_ID_LENGTH).toBeGreaterThanOrEqual(32);
            expect(LIMITS.MAX_ID_LENGTH).toBeLessThanOrEqual(128);
        });

        it('should have reasonable name length limit', () => {
            // Name should allow for typical profile names
            expect(LIMITS.MAX_NAME_LENGTH).toBeGreaterThanOrEqual(50);
            expect(LIMITS.MAX_NAME_LENGTH).toBeLessThanOrEqual(512);
        });

        it('should have reasonable OCR timeout for complex image processing', () => {
            // OCR timeout needs to be long enough for multiple Tesseract attempts
            expect(LIMITS.OCR_TIMEOUT_MS).toBeGreaterThanOrEqual(5000);
            expect(LIMITS.OCR_TIMEOUT_MS).toBeLessThanOrEqual(30000);
        });

        it('should have name limit greater than ID limit', () => {
            // Names are typically longer than IDs
            expect(LIMITS.MAX_NAME_LENGTH).toBeGreaterThan(LIMITS.MAX_ID_LENGTH);
        });
    });

    // =========================================================================
    // Type safety (as const provides compile-time immutability)
    // =========================================================================

    describe('type safety', () => {
        it('should export URLS as object', () => {
            expect(typeof URLS).toBe('object');
            expect(URLS).not.toBeNull();
        });

        it('should export TIMINGS as object', () => {
            expect(typeof TIMINGS).toBe('object');
            expect(TIMINGS).not.toBeNull();
        });

        it('should export LAYOUT as object', () => {
            expect(typeof LAYOUT).toBe('object');
            expect(LAYOUT).not.toBeNull();
        });

        it('should export LIMITS as object', () => {
            expect(typeof LIMITS).toBe('object');
            expect(LIMITS).not.toBeNull();
        });

        it('should have all expected URLS keys', () => {
            expect(URLS).toHaveProperty('FLYFF_PLAY');
            expect(URLS).toHaveProperty('FLYFF_NEWS');
            expect(URLS).toHaveProperty('FLYFF_BASE');
            expect(URLS).toHaveProperty('GITHUB_REPO');
            expect(URLS).toHaveProperty('GITHUB_PACKAGE');
        });

        it('should have all expected TIMINGS keys', () => {
            expect(TIMINGS).toHaveProperty('OCR_POLL_MS');
            expect(TIMINGS).toHaveProperty('NAME_LEVEL_CHECK_MS');
            expect(TIMINGS).toHaveProperty('HOVER_POLL_MS');
            expect(TIMINGS).toHaveProperty('OVERLAY_FOLLOW_MS');
            expect(TIMINGS).toHaveProperty('VIEW_LOAD_TIMEOUT_MS');
            expect(TIMINGS).toHaveProperty('FETCH_TIMEOUT_MS');
        });

        it('should have all expected LAYOUT keys', () => {
            expect(LAYOUT).toHaveProperty('LAUNCHER_WIDTH');
            expect(LAYOUT).toHaveProperty('LAUNCHER_HEIGHT');
            expect(LAYOUT).toHaveProperty('INSTANCE_WIDTH');
            expect(LAYOUT).toHaveProperty('INSTANCE_HEIGHT');
            expect(LAYOUT).toHaveProperty('SPLIT_GAP');
            expect(LAYOUT).toHaveProperty('MIN_SPLIT_RATIO');
            expect(LAYOUT).toHaveProperty('MAX_SPLIT_RATIO');
            expect(LAYOUT).toHaveProperty('DEFAULT_SPLIT_RATIO');
        });

        it('should have all expected LIMITS keys', () => {
            expect(LIMITS).toHaveProperty('MAX_ID_LENGTH');
            expect(LIMITS).toHaveProperty('MAX_NAME_LENGTH');
            expect(LIMITS).toHaveProperty('PYTHON_VERIFY_TIMEOUT_MS');
            expect(LIMITS).toHaveProperty('OCR_TIMEOUT_MS');
        });
    });
});

/**
 * Shared constants used across the application.
 * Centralizes magic numbers and configuration values.
 */

// ============================================================================
// URLs
// ============================================================================

export const URLS = {
    /** Main game URL */
    FLYFF_PLAY: "https://universe.flyff.com/play",
    /** News page URL */
    FLYFF_NEWS: "https://universe.flyff.com/news",
    /** Base domain */
    FLYFF_BASE: "https://universe.flyff.com",
    /** GitHub repository */
    GITHUB_REPO: "https://github.com/Sparx94/Flyff-U-Launcher",
    /** Package.json for version check */
    GITHUB_PACKAGE: "https://raw.githubusercontent.com/Sparx94/Flyff-U-Launcher/1.0/app/package.json",
} as const;

// ============================================================================
// Timings (in milliseconds)
// ============================================================================

export const TIMINGS = {
    /** OCR polling interval - how often to read exp/level from screen */
    OCR_POLL_MS: 2000,
    /** Name/Level OCR check interval */
    NAME_LEVEL_CHECK_MS: 8000,
    /** Hover activation check interval for split view */
    HOVER_POLL_MS: 120,
    /** Overlay follow/position update interval */
    OVERLAY_FOLLOW_MS: 80,
    /** Window invalidate debounce (60 FPS frame time) */
    INVALIDATE_DEBOUNCE_MS: 16,
    /** View load timeout */
    VIEW_LOAD_TIMEOUT_MS: 30000,
    /** HTTP fetch timeout */
    FETCH_TIMEOUT_MS: 10000,
    /** Tip rotation interval in launcher */
    TIP_ROTATION_MS: 6000,
    /** Delay for bounds push after resize */
    BOUNDS_PUSH_DELAY_MS: 120,
    /** Secondary bounds push delay */
    BOUNDS_PUSH_DELAY_SECONDARY_MS: 280,
    /** Startup delay before overlay refresh */
    STARTUP_DELAY_MS: 200,
} as const;

// ============================================================================
// Layout dimensions
// ============================================================================

export const LAYOUT = {
    /** Launcher window width */
    LAUNCHER_WIDTH: 980,
    /** Launcher window height */
    LAUNCHER_HEIGHT: 640,
    /** Instance window width */
    INSTANCE_WIDTH: 1280,
    /** Instance window height */
    INSTANCE_HEIGHT: 720,
    /** Side panel width */
    PANEL_WIDTH: 420,
    /** Split view gap in pixels */
    SPLIT_GAP: 8,
    /** Minimum split ratio (20%) */
    MIN_SPLIT_RATIO: 0.2,
    /** Maximum split ratio (80%) */
    MAX_SPLIT_RATIO: 0.8,
    /** Default split ratio (50%) */
    DEFAULT_SPLIT_RATIO: 0.5,
} as const;

// ============================================================================
// Validation limits
// ============================================================================

export const LIMITS = {
    /** Maximum ID length */
    MAX_ID_LENGTH: 64,
    /** Maximum name length */
    MAX_NAME_LENGTH: 256,
    /** Python verification timeout */
    PYTHON_VERIFY_TIMEOUT_MS: 5000,
    /** OCR request timeout - 10s to handle complex exp image processing */
    OCR_TIMEOUT_MS: 10000,
} as const;

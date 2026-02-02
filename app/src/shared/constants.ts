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
    GITHUB_REPO: "https://github.com/GH-Praxa/Flyff-U-Launcher/releases",
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
    LAUNCHER_WIDTH: 1200,
    /** Launcher window height */
    LAUNCHER_HEIGHT: 970,
    /** Minimum launcher window width */
    LAUNCHER_MIN_WIDTH: 880,
    /** Minimum launcher window height */
    LAUNCHER_MIN_HEIGHT: 540,
    /** Maximum launcher window width */
    LAUNCHER_MAX_WIDTH: 2560,
    /** Maximum launcher window height */
    LAUNCHER_MAX_HEIGHT: 1440,
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
    /** Grid gap zwischen BrowserViews (gleich SPLIT_GAP) */
    GRID_GAP: 8,
    /** Mindestbreite einer Grid-Zelle */
    MIN_CELL_WIDTH: 200,
    /** Mindesth\u00f6he einer Grid-Zelle */
    MIN_CELL_HEIGHT: 150,
} as const;

// Grid Konfigurationen f\u00fcr Multi-View Layouts
export const GRID_CONFIGS = {
    "single": { rows: 1, cols: 1, maxViews: 1 },
    "split-2": { rows: 1, cols: 2, maxViews: 2 },
    "row-3": { rows: 1, cols: 3, maxViews: 3 },
    "row-4": { rows: 1, cols: 4, maxViews: 4 },
    "grid-4": { rows: 2, cols: 2, maxViews: 4 },
    "grid-5": { rows: 2, cols: 3, maxViews: 5 },
    "grid-6": { rows: 2, cols: 3, maxViews: 6 },
    "grid-7": { rows: 2, cols: 4, maxViews: 7 },
    "grid-8": { rows: 2, cols: 4, maxViews: 8 },
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

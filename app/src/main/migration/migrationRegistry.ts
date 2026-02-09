/**
 * Migration Registry – ordered list of version-gated migration batches.
 *
 * To add a new migration set for a future version, simply append a new entry
 * to the MIGRATION_SETS array. The runner executes them in order, skipping
 * sets whose version is <= the last completed migration version.
 */
import type { MigrationEntry } from "./appDataMigration";

export interface MigrationSet {
    /** Semver version that introduced this migration batch */
    version: string;
    /** Human-readable label shown in the migration UI */
    label: string;
    /** Ordered list of file/dir moves */
    entries: MigrationEntry[];
}

/** Sentinel files that indicate an existing (non-fresh) install.
 *  Includes both original legacy paths AND intermediate paths from
 *  earlier migration versions (e.g. v2.3.0 moved files to config/ etc.)
 */
export const LEGACY_SENTINEL_FILES = [
    // Original legacy flat paths
    "client-settings.json",
    "profiles.json",
    "features.json",
    // Intermediate paths from earlier migrations (pre-user/ refactor)
    "config/settings.json",
    "config/features.json",
    "profiles/profiles.json",
    // Old migration version file
    "config/.migration-version",
];

export const MIGRATION_SETS: MigrationSet[] = [
    {
        version: "2.4.3",
        label: "Reorganizing app data...",
        entries: [
            // ── From original legacy flat layout (pre-2.3.0) ──────────
            // user/config/
            { oldRel: "client-settings.json",    newRel: "user/config/settings.json",            type: "file" },
            { oldRel: "features.json",           newRel: "user/config/features.json",            type: "file" },
            { oldRel: "debug/debugConfig.json",  newRel: "user/config/debug.json",               type: "file" },
            // user/profiles/
            { oldRel: "profiles.json",           newRel: "user/profiles/profiles.json",          type: "file" },
            { oldRel: "rois.json",              newRel: "user/profiles/rois.json",              type: "file" },
            { oldRel: "roi-visibility.json",    newRel: "user/profiles/roi-visibility.json",    type: "file" },
            { oldRel: "ocr-timers.json",        newRel: "user/profiles/ocr-timers.json",        type: "file" },
            { oldRel: "manual-levels.json",     newRel: "user/profiles/manual-levels.json",     type: "file" },
            { oldRel: "sidepanel-button.json",  newRel: "user/profiles/ui-positions.json",      type: "file" },
            // user/ui/
            { oldRel: "themes.json",            newRel: "user/ui/themes.json",                  type: "file" },
            { oldRel: "themeSnapshot.json",     newRel: "user/ui/theme-snapshot.json",          type: "file" },
            { oldRel: "tabActiveColor.json",    newRel: "user/ui/tab-active-color.json",        type: "file" },
            { oldRel: "tabLayouts.json",        newRel: "user/ui/tab-layouts.json",             type: "file" },
            // user/shopping/
            { oldRel: "item-prices.json",       newRel: "user/shopping/item-prices.json",       type: "file" },
            // user/plugin-data/
            { oldRel: "plugin-states.json",     newRel: "user/plugin-data/_states.json",        type: "file" },
            // user/cache/ (entire api_fetch directory)
            { oldRel: "api_fetch",              newRel: "user/cache",                           type: "dir" },
            // user/logs/
            { oldRel: "ocr-debug",             newRel: "user/logs/ocr",                        type: "dir" },

            // ── From intermediate layout (v2.3.0 migration) ───────────
            // These cover users who already ran the v2.3.0 migration
            // (executeEntry skips if source doesn't exist or dest already exists)
            { oldRel: "config/settings.json",       newRel: "user/config/settings.json",        type: "file" },
            { oldRel: "config/features.json",       newRel: "user/config/features.json",        type: "file" },
            { oldRel: "config/debug.json",          newRel: "user/config/debug.json",           type: "file" },
            { oldRel: "profiles/profiles.json",     newRel: "user/profiles/profiles.json",      type: "file" },
            { oldRel: "profiles/rois.json",         newRel: "user/profiles/rois.json",          type: "file" },
            { oldRel: "profiles/roi-visibility.json", newRel: "user/profiles/roi-visibility.json", type: "file" },
            { oldRel: "profiles/ocr-timers.json",   newRel: "user/profiles/ocr-timers.json",    type: "file" },
            { oldRel: "profiles/manual-levels.json", newRel: "user/profiles/manual-levels.json", type: "file" },
            { oldRel: "profiles/ui-positions.json", newRel: "user/profiles/ui-positions.json",  type: "file" },
            { oldRel: "ui/themes.json",             newRel: "user/ui/themes.json",              type: "file" },
            { oldRel: "ui/theme-snapshot.json",     newRel: "user/ui/theme-snapshot.json",      type: "file" },
            { oldRel: "ui/tab-active-color.json",   newRel: "user/ui/tab-active-color.json",    type: "file" },
            { oldRel: "ui/tab-layouts.json",        newRel: "user/ui/tab-layouts.json",         type: "file" },
            { oldRel: "shopping/item-prices.json",  newRel: "user/shopping/item-prices.json",   type: "file" },
            { oldRel: "plugin-data",                newRel: "user/plugin-data",                 type: "dir" },
            { oldRel: "cache",                      newRel: "user/cache",                       type: "dir" },
            { oldRel: "logs/ocr",                   newRel: "user/logs/ocr",                    type: "dir" },
        ],
    },
];

/**
 * Static data files for the Flyff-U-Launcher.
 *
 * These JSON files contain reference data for game elements:
 * - monster_reference.json: Monster data including names, levels, and exp values
 * - buff_icon_buffname.json: Buff icon to name mappings
 * - skill_icon_skillname.json: Skill icon to name mappings
 *
 * Note: Plugins may generate/update these files at runtime via the api-fetch plugin.
 * The files here serve as reference/fallback data.
 */

import path from "path";
import { app } from "electron";

/**
 * Get the path to a data file.
 * In development, returns the path in src/data.
 * In production, returns the path in resources/data (if packaged).
 */
export function getDataPath(filename: string): string {
    if (app.isPackaged) {
        // Production: look in resources folder
        return path.join(process.resourcesPath, "data", filename);
    }
    // Development: __dirname points to .vite/build/ after Vite bundling,
    // so use app.getAppPath() which reliably returns the app root directory.
    return path.join(app.getAppPath(), "src", "data", filename);
}

export const DATA_FILES = {
    MONSTER_REFERENCE: "monster_reference.json",
    BUFF_ICON_BUFFNAME: "buff_icon_buffname.json",
    SKILL_ICON_SKILLNAME: "skill_icon_skillname.json",
} as const;

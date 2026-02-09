/**
 * Debug configuration store.
 * Controls which debug messages are logged to console.
 */
import fs from "fs/promises";
import path from "path";
import { app } from "electron";

export interface DebugConfig {
    /** General startup info (userData path, plugins dir) */
    startup: boolean;
    /** ROI overlay sync messages */
    roiOverlaySync: boolean;
    /** Overlay host resolution messages */
    resolveOverlayHost: boolean;
    /** OCR processing messages */
    ocr: boolean;
    /** IPC handler messages */
    ipc: boolean;
    /** Plugin system messages */
    plugins: boolean;
    /** Theme system messages */
    themes: boolean;
    /** Session/tab management messages */
    sessions: boolean;
}

const DEFAULT_CONFIG: DebugConfig = {
    startup: false,
    roiOverlaySync: false,
    resolveOverlayHost: false,
    ocr: false,
    ipc: false,
    plugins: false,
    themes: false,
    sessions: false,
};

let cachedConfig: DebugConfig | null = null;

function getConfigDir(): string {
    // Write to the user's data directory so packaged apps aren't trying to write inside the asar.
    try {
        return path.join(app.getPath("userData"), "user", "config");
    } catch (_err) {
        // Fallback for tests or non-Electron environments
        return path.join(process.cwd(), "debug");
    }
}

function getConfigPath(): string {
    return path.join(getConfigDir(), "debug.json");
}

export async function loadDebugConfig(): Promise<DebugConfig> {
    if (cachedConfig) return cachedConfig;

    try {
        const raw = await fs.readFile(getConfigPath(), "utf-8");
        const parsed = JSON.parse(raw);
        cachedConfig = { ...DEFAULT_CONFIG, ...parsed };
        return cachedConfig;
    } catch (err) {
        // File doesn't exist - create it with defaults
        const code = err && typeof err === "object" && "code" in err ? (err as NodeJS.ErrnoException).code : null;
        if (code === "ENOENT") {
            await saveDebugConfig(DEFAULT_CONFIG);
        } else {
            // Keep running with defaults; log to console for visibility
            // eslint-disable-next-line no-console
            console.warn("[DebugConfig] load failed, using defaults", err);
        }
        cachedConfig = { ...DEFAULT_CONFIG };
        return cachedConfig;
    }
}

export async function saveDebugConfig(config: DebugConfig): Promise<void> {
    cachedConfig = config;
    const filePath = getConfigPath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(config, null, 2));
}

export function getDebugConfig(): DebugConfig {
    return cachedConfig ?? DEFAULT_CONFIG;
}

/** Debug log helper - only logs if the category is enabled */
export function debugLog(category: keyof DebugConfig, ...args: unknown[]): void {
    const config = getDebugConfig();
    if (config[category]) {
        console.log(...args);
    }
}

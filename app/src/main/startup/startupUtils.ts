/**
 * Startup utilities: resource path resolution, Tesseract configuration,
 * default plugin deployment and startup telemetry.
 *
 * Extracted from main.ts to keep the entry point lean.
 */

import { app } from "electron";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import { execFileSync } from "child_process";
import { randomBytes } from "crypto";
import { logWarn, logErr } from "../../shared/logger";
import { TELEMETRY } from "../../shared/constants";
import { debugLog } from "../debugConfig";

// ============================================================================
// Resource path resolution
// ============================================================================

/**
 * Resolves a path relative to the app's resource root.
 * Uses `process.resourcesPath` in packaged builds, the repo root in dev.
 */
export function resolveResourcePath(...segments: string[]): string {
    const base = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");
    return path.join(base, ...segments);
}

// ============================================================================
// Startup telemetry
// ============================================================================

const STARTUP_ID_FILE = "startup-id";

async function getOrCreateStartupId(): Promise<string> {
    const idPath = path.join(app.getPath("userData"), "user", "config", STARTUP_ID_FILE);
    try {
        const existing = (await fsp.readFile(idPath, "utf-8")).trim();
        if (existing) return existing;
    } catch {
        // File does not exist yet or cannot be read; generate a new ID.
    }

    const generated = randomBytes(16).toString("hex");
    try {
        await fsp.mkdir(path.dirname(idPath), { recursive: true });
        await fsp.writeFile(idPath, generated, "utf-8");
    } catch (err) {
        logWarn(`Failed to persist startup id: ${err instanceof Error ? err.message : String(err)}`, "StartupId");
    }

    return generated;
}

export async function postLauncherStartupToDiscord(): Promise<void> {
    // process.env.TELEMETRY_WEBHOOK_URL is replaced at build time by vite define (main-process only)
    const webhookUrl = process.env.TELEMETRY_WEBHOOK_URL || TELEMETRY.STARTUP_WEBHOOK_URL;
    if (!webhookUrl) {
        debugLog("startup", "Startup webhook not configured, skipping telemetry");
        return;
    }
    const startupId = await getOrCreateStartupId();
    if (TELEMETRY.BLOCKED_STARTUP_IDS.has(startupId)) {
        debugLog("startup", "Startup ID blocked:", startupId);
        return;
    }

    const payload = {
        content: `Startup ID: ${startupId} - v${app.getVersion()}`,
        allowed_mentions: { parse: [] as string[] },
    };

    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errText = await response.text().catch(() => "");
            logWarn(`Startup ID post failed: ${response.status}${errText ? ` ${errText}` : ""}`, "StartupId");
            return;
        }
        debugLog("startup", "Startup ID sent:", startupId);
    } catch (err) {
        logWarn(`Startup ID post error: ${err instanceof Error ? err.message : String(err)}`, "StartupId");
    }
}

// ============================================================================
// Default plugin deployment
// ============================================================================

export async function copyDefaultPlugins(targetDir: string): Promise<void> {
    const readManifestVersion = async (dir: string): Promise<string | null> => {
        try {
            const raw = await fsp.readFile(path.join(dir, "manifest.json"), "utf-8");
            const data = JSON.parse(raw);
            return typeof data?.version === "string" ? data.version : null;
        } catch {
            return null;
        }
    };

    const isVersionNewer = (source: string, target: string): boolean => {
        const toParts = (v: string) => v.split(".").map((n) => Number.parseInt(n, 10) || 0);
        const a = toParts(source);
        const b = toParts(target);
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i += 1) {
            const av = a[i] ?? 0;
            const bv = b[i] ?? 0;
            if (av === bv) continue;
            return av > bv;
        }
        return false;
    };

    const allowedPlugins = new Set(["api-fetch", "cd-timer", "killfeed"]);
    const candidateRoots = [
        resolveResourcePath("plugins"),
        resolveResourcePath(),
        // Fallback for development: repo root plugins folder
        path.resolve(__dirname, "..", "..", "plugins"),
    ];
    try {
        await fsp.mkdir(targetDir, { recursive: true });
        for (const pluginId of allowedPlugins) {
            const from = candidateRoots
                .map((root) => path.join(root, pluginId))
                .find((p) => fs.existsSync(p));
            if (!from) continue;
            const to = path.join(targetDir, pluginId);

            // Copy if the plugin is missing or the source manifest version is newer
            const forceUpdate = process.env.FORCE_COPY_DEFAULT_PLUGINS === "1";
            const targetExists = fs.existsSync(to);
            const [sourceVersion, targetVersion] = await Promise.all([
                readManifestVersion(from),
                targetExists ? readManifestVersion(to) : Promise.resolve(null),
            ]);
            const versionNewer =
                sourceVersion && targetVersion ? isVersionNewer(sourceVersion, targetVersion) : !!sourceVersion && !targetVersion;

            if (!forceUpdate && targetExists && !versionNewer) {
                continue;
            }

            await fsp.rm(to, { recursive: true, force: true });
            await fsp.cp(from, to, { recursive: true, force: true });
        }
    } catch (err) {
        logErr(err, "DefaultPluginsCopy");
    }
}

// ============================================================================
// Tesseract OCR configuration
// ============================================================================

export function configureBundledTesseract(): void {
    const exeName = process.platform === "win32" ? "tesseract.exe" : "tesseract";
    const candidates = [
        resolveResourcePath("tesseract", process.platform),
        resolveResourcePath("tesseract"),
        path.resolve(__dirname, "..", "resources", "tesseract", process.platform),
        path.resolve(__dirname, "..", "resources", "tesseract"),
        path.resolve(__dirname, "..", "..", "resources", "tesseract", process.platform),
        path.resolve(__dirname, "..", "..", "resources", "tesseract"),
    ];
    const tesseractDir = candidates.find((dir) => fs.existsSync(path.join(dir, exeName)));
    if (tesseractDir) {
        const tesseractExePath = path.join(tesseractDir, exeName);
        process.env.TESSERACT_EXE = tesseractExePath;
        process.env.PATH = tesseractDir + path.delimiter + (process.env.PATH || "");
        if (process.platform === "darwin") {
            process.env.DYLD_LIBRARY_PATH = tesseractDir + path.delimiter + (process.env.DYLD_LIBRARY_PATH || "");
        } else if (process.platform === "linux") {
            process.env.LD_LIBRARY_PATH = tesseractDir + path.delimiter + (process.env.LD_LIBRARY_PATH || "");
        }
        const tessdata = path.join(tesseractDir, "tessdata");
        if (fs.existsSync(tessdata)) {
            process.env.TESSDATA_PREFIX = tessdata;
        }
        if (process.platform !== "win32") {
            try { fs.chmodSync(tesseractExePath, 0o755); } catch { /* ignore */ }
        }
        console.log("[Tesseract] Bundled tesseract configured:", process.env.TESSERACT_EXE);
    } else {
        process.env.TESSERACT_EXE = exeName;
        console.warn("[Tesseract] Bundled tesseract not found, falling back to system-installed:", exeName);
    }
}

export function writeTesseractDiagnostic(): void {
    try {
        const diagDir = path.join(app.getPath("userData"), "user", "logs", "ocr");
        fs.mkdirSync(diagDir, { recursive: true });
        const lines: string[] = [
            `timestamp=${new Date().toISOString()}`,
            `isPackaged=${app.isPackaged}`,
            `resourcesPath=${process.resourcesPath}`,
            `TESSERACT_EXE=${process.env.TESSERACT_EXE ?? "<not set>"}`,
            `TESSERACT_EXE_exists=${process.env.TESSERACT_EXE ? fs.existsSync(process.env.TESSERACT_EXE) : "N/A"}`,
            `TESSDATA_PREFIX=${process.env.TESSDATA_PREFIX ?? "<not set>"}`,
            `TESSDATA_PREFIX_exists=${process.env.TESSDATA_PREFIX ? fs.existsSync(path.join(process.env.TESSDATA_PREFIX, "tessdata")) : "N/A"}`,
        ];
        try {
            const tessExe = process.env.TESSERACT_EXE ?? "tesseract";
            const tessResult = execFileSync(tessExe, ["--version"], { timeout: 5000, encoding: "utf-8" });
            lines.push(`tesseract_version=${tessResult.trim().split("\n")[0]}`);
        } catch (e: unknown) {
            lines.push(`tesseract_version=FAILED: ${e instanceof Error ? e.message : String(e)}`);
        }
        fs.writeFileSync(path.join(diagDir, "electron_diagnostic.txt"), lines.join("\n"), "utf-8");
    } catch {
        // Best-effort diagnostic
    }
}

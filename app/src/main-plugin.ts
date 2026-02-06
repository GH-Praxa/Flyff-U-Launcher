/**
 * Main Entry Point (Plugin Architecture)
 *
 * Simplified entry point that uses the plugin system for features.
 * Core functionality only - EXP-Tracker, Questlog, Buff-Wecker loaded as plugins.
 */

import { app, BrowserWindow, session, ipcMain, globalShortcut, screen } from "electron";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import squirrelStartup from "electron-squirrel-startup";

// Handle Squirrel startup (Windows installer)
if (squirrelStartup) {
    app.quit();
}

// Fix Windows DWM flicker/ghost window issue
if (process.platform === "win32") {
    app.commandLine.appendSwitch("disable-direct-composition");
}

import { createViewLoader } from "./main/viewLoader";
import { registerMainIpc } from "./main/ipc/registerMainIpc";
import { registerPluginHandlers } from "./main/ipc/handlers/plugins";
import { createSafeHandler } from "./main/ipc/common";
import { applyCSP } from "./main/security/harden";
import { logWarn, logErr } from "./shared/logger";
import { createCoreServices, createPluginServiceAdapters } from "./main/coreServices";
import { createPluginHost } from "./main/plugin";
import { URLS, TIMINGS, LAYOUT } from "./shared/constants";
import { createSidePanelButtonController } from "./main/windows/sidePanelButtonController";
import { createSidePanelWindow } from "./main/windows/sidePanelWindow";
import { createRoiVisibilityStore } from "./main/roi/roiVisibilityStore";
import { DEFAULT_LOCALE, type ClientSettings, type Locale } from "./shared/schemas";
import { DEFAULT_HOTKEYS, chordToAccelerator, normalizeHotkeySettings } from "./shared/hotkeys";
import { fitLauncherSizeToWorkArea, normalizeLauncherSize } from "./shared/launcherSize";

// Vite declarations
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

app.setAppUserModelId("Flyff-U-Launcher");

// ============================================================================
// Global State
// ============================================================================

let launcherWindow: BrowserWindow | null = null;
let pluginHost: ReturnType<typeof createPluginHost> | null = null;
let sidePanelButton: ReturnType<typeof createSidePanelButtonController> | null = null;
let sidePanelWindow: BrowserWindow | null = null;
const registeredHotkeys: string[] = [];
const SCREENSHOT_DIR = path.join(app.getPath("pictures"), "Flyff-U-Launcher");
let toastDurationMs = 5000;
let launcherSize = normalizeLauncherSize();

// ============================================================================
// App Ready
// ============================================================================

function resolveResourcePath(...segments: string[]): string {
    const base = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");
    return path.join(base, ...segments);
}

async function copyDefaultPlugins(targetDir: string): Promise<void> {
    const readManifestVersion = async (dir: string): Promise<string | null> => {
        try {
            const raw = await fsp.readFile(path.join(dir, "manifest.json"), "utf-8");
            const data = JSON.parse(raw);
            return typeof data?.version === "string" ? data.version : null;
        } catch (_err) {
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

    const candidates = [
        resolveResourcePath("plugins"),
        // Fallback for development: repo root plugins folder
        path.resolve(__dirname, "..", "..", "plugins"),
    ];
    const source = candidates.find((p) => fs.existsSync(p));
    if (!source) return;
    try {
        await fsp.mkdir(targetDir, { recursive: true });
        const entries = await fsp.readdir(source, { withFileTypes: true });
        for (const entry of entries) {
            const from = path.join(source, entry.name);
            const to = path.join(targetDir, entry.name);

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

function configureBundledTesseract(): void {
    const exePath = resolveResourcePath("tesseract", "tesseract.exe");
    if (fs.existsSync(exePath)) {
        process.env.TESSERACT_EXE = exePath;
        const tessdata = resolveResourcePath("tesseract", "tessdata");
        if (fs.existsSync(tessdata)) {
            // Tesseract expects TESSDATA_PREFIX to be the *parent* of the tessdata/ folder
            process.env.TESSDATA_PREFIX = resolveResourcePath("tesseract");
        }
    }
}

app.whenReady().then(async () => {
    // Apply Content Security Policy
    applyCSP(session.defaultSession);

    const preloadPath = path.join(__dirname, "preload.js");
    console.log("userData:", app.getPath("userData"));

    // Prepare bundled assets (Tesseract, default plugins)
    configureBundledTesseract();
    const pluginsDir = path.join(app.getPath("userData"), "plugins");
    await copyDefaultPlugins(pluginsDir);

    // Create view loader
    const loadView = createViewLoader({
        devServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL,
        rendererName: MAIN_WINDOW_VITE_NAME,
        baseDir: __dirname,
    });

    // Create core services
    const services = createCoreServices({
        preloadPath,
        loadView,
        flyffUrl: URLS.FLYFF_PLAY,
        followIntervalMs: TIMINGS.OVERLAY_FOLLOW_MS,
        onInstanceOpened: () => {
            // Plugins will be notified via event bus
            logWarn("Instance window opened", "Main");
        },
    });
    const roiVisibilityStore = createRoiVisibilityStore();

    // Create plugin service adapters
    const pythonExe = process.env.FLYFF_OCR_PYTHON ?? "python";
    const pluginServices = createPluginServiceAdapters(services, pythonExe);

    let overlayClickThrough = false;
    let clientLocale: Locale = DEFAULT_LOCALE;
    let overlayHotkeys = normalizeHotkeySettings(DEFAULT_HOTKEYS, DEFAULT_HOTKEYS);
    try {
        const clientSettingsSnap = await services.clientSettings.get();
        overlayClickThrough = !!clientSettingsSnap.overlayButtonPassthrough;
        clientLocale = clientSettingsSnap.locale ?? DEFAULT_LOCALE;
        overlayHotkeys = normalizeHotkeySettings(clientSettingsSnap.hotkeys, DEFAULT_HOTKEYS);
        toastDurationMs = Math.min(60, Math.max(1, clientSettingsSnap.toastDurationSeconds ?? 5)) * 1000;
        launcherSize = normalizeLauncherSize({
            width: clientSettingsSnap.launcherWidth,
            height: clientSettingsSnap.launcherHeight,
        });
        services.sessionTabs.setActiveGridBorderEnabled?.(clientSettingsSnap.gridActiveBorder ?? false);
    } catch (err) {
        logErr(err, "ClientSettings");
    }
    const onClientSettingsChanged = (settings: ClientSettings) => {
        sidePanelButton?.setClickThrough?.(settings.overlayButtonPassthrough);
        if (settings.locale) {
            clientLocale = settings.locale;
        }
        overlayHotkeys = normalizeHotkeySettings(settings.hotkeys, DEFAULT_HOTKEYS);
        toastDurationMs = Math.min(60, Math.max(1, settings.toastDurationSeconds ?? 5)) * 1000;
        launcherSize = normalizeLauncherSize({
            width: settings.launcherWidth,
            height: settings.launcherHeight,
        });
        services.sessionTabs.setActiveGridBorderEnabled?.(settings.gridActiveBorder ?? false);
        if (launcherWindow && !launcherWindow.isDestroyed()) {
            const display = screen.getDisplayMatching(launcherWindow.getBounds()) ?? screen.getPrimaryDisplay();
            const nextSize = fitLauncherSizeToWorkArea(launcherSize, display?.workAreaSize);
            const minWidth = Math.min(display.workAreaSize.width, LAYOUT.LAUNCHER_MIN_WIDTH);
            const minHeight = Math.min(display.workAreaSize.height, LAYOUT.LAUNCHER_MIN_HEIGHT);
            launcherWindow.setMinimumSize(minWidth, minHeight);
            launcherWindow.setSize(nextSize.width, nextSize.height);
        }
        registerHotkeys();
    };

    sidePanelButton = createSidePanelButtonController({
        sessionWindow: services.sessionWindow,
        sessionTabs: services.sessionTabs,
        profiles: services.profiles,
        preloadPath,
        clickThrough: overlayClickThrough,
    });
    await sidePanelButton.start();

    const toggleSidePanel = async (payload?: { focusTab?: string; profileId?: string }) => {
        const parent = services.sessionWindow.get();
        if (!parent || parent.isDestroyed())
            return;
        if (!sidePanelWindow || sidePanelWindow.isDestroyed()) {
            sidePanelWindow = createSidePanelWindow(parent, { preloadPath, locale: clientLocale });
            sidePanelWindow.on("show", () => { void sidePanelButton?.stop(); });
            sidePanelWindow.on("hide", () => { void sidePanelButton?.start(); });
            sidePanelWindow.on("closed", () => { sidePanelWindow = null; void sidePanelButton?.start(); });
        }
        const overlayTargetId = (typeof payload?.profileId === "string" && payload.profileId)
            ? payload.profileId
            : sidePanelButton?.getActiveProfileId?.()
                ?? (await services.profiles.getOverlayTargetId())
                ?? services.sessionTabs.getActiveId();
        if (!overlayTargetId || !services.sessionTabs.isActive(overlayTargetId)) {
            return;
        }
        const viewBounds = services.sessionTabs.getBounds(overlayTargetId);
        const content = parent.getContentBounds();
        const margin = 12;
        const hostX = content.x + viewBounds.x;
        const hostY = content.y + viewBounds.y;
        const availableWidth = Math.max(120, viewBounds.width - margin * 2);
        const minAllowedWidth = Math.min(260, availableWidth);
        const width = Math.max(minAllowedWidth, Math.min(420, availableWidth));
        const finalWidth = Math.min(width, Math.max(80, viewBounds.width - margin));
        const availableHeight = Math.max(180, viewBounds.height - margin * 2);
        const minAllowedHeight = Math.min(360, availableHeight);
        const height = Math.max(minAllowedHeight, Math.min(720, availableHeight));
        const finalHeight = Math.min(height, Math.max(140, viewBounds.height - margin));
        const x = hostX + Math.max(0, viewBounds.width - finalWidth - margin);
        const y = hostY + margin;
        sidePanelWindow.setBounds({ x, y, width: finalWidth, height: finalHeight });
        if (payload?.focusTab) {
            sidePanelWindow.webContents.send("sidepanel:focusTab", { tab: payload.focusTab });
        }
        const willShow = !sidePanelWindow.isVisible();
        if (willShow) {
            await sidePanelButton?.stop();
            sidePanelWindow.show();
            sidePanelWindow.focus();
        } else {
            sidePanelWindow.hide();
            await sidePanelButton?.start();
        }
    };

    ipcMain.on("sidepanel:toggle", (_e, payload) => {
        void toggleSidePanel(payload as { focusTab?: string; profileId?: string });
    });

    const clearRegisteredHotkeys = () => {
        for (const acc of registeredHotkeys) {
            globalShortcut.unregister(acc);
        }
        registeredHotkeys.length = 0;
    };

    const captureFocusedWindowScreenshot = async () => {
        const target = BrowserWindow.getFocusedWindow();
        if (!target)
            return;
        try {
            const settingsSnap = await services.clientSettings.get().catch(() => null);
            const effectiveTtlMs = Math.min(60, Math.max(1, settingsSnap?.toastDurationSeconds ?? toastDurationMs / 1000)) * 1000;
            const image = await target.webContents.capturePage();
            const buffer = image.toPNG();
            await fsp.mkdir(SCREENSHOT_DIR, { recursive: true });
            const file = path.join(SCREENSHOT_DIR, `screenshot-${Date.now()}.png`);
            await fsp.writeFile(file, buffer);
            logWarn(`Screenshot saved: ${file}`, "Hotkey:screenshotWindow");
            const payload = {
                message: translations[clientLocale]["toast.screenshot.saved"],
                tone: "success",
                ttlMs: effectiveTtlMs,
            } as const;
            try {
                target.webContents.send("toast:show", payload);
            } catch {
                /* ignore */
            }
            const sessionWin = services.sessionWindow.get();
            if (sessionWin && !sessionWin.isDestroyed() && sessionWin.webContents.id !== target.webContents.id) {
                sessionWin.webContents.send("toast:show", payload);
            }
        }
        catch (err) {
            logErr(err, "Hotkey:screenshotWindow");
        }
    };

    const registerHotkeys = () => {
        clearRegisteredHotkeys();
        const register = (chord: ReturnType<typeof normalizeHotkeySettings>["sidePanelToggle"], handler: () => void, label: string) => {
            const accel = chordToAccelerator(chord ?? null);
            if (!accel)
                return;
            const ok = globalShortcut.register(accel, handler);
            if (ok) {
                registeredHotkeys.push(accel);
            }
            else {
                logWarn(`Global shortcut ${accel} could not be registered`, `Hotkey:${label}`);
            }
        };
        register(overlayHotkeys.sidePanelToggle ?? null, () => {
            const focused = BrowserWindow.getFocusedWindow();
            const sessionWin = services.sessionWindow.get();
            if (!sessionWin || sessionWin.isDestroyed())
                return;
            if (!focused)
                return;
            const sideWin = sidePanelWindow && !sidePanelWindow.isDestroyed() ? sidePanelWindow : null;
            if (focused.id !== sessionWin.id && (!sideWin || focused.id !== sideWin.id)) {
                return;
            }
            void toggleSidePanel({ profileId: sidePanelButton?.getActiveProfileId?.() ?? undefined, focusTab: "roi" });
        }, "sidePanelToggle");
        register(overlayHotkeys.screenshotWindow ?? null, () => { void captureFocusedWindowScreenshot(); }, "screenshotWindow");
    };

    registerHotkeys();

    // IPC handlers to pause/resume hotkeys during recording
    ipcMain.handle("hotkeys:pause", () => {
        clearRegisteredHotkeys();
        return { ok: true };
    });
    ipcMain.handle("hotkeys:resume", () => {
        registerHotkeys();
        return { ok: true };
    });

    // Get launcher version from package.json
    const launcherVersion = app.getVersion();

    // Create plugin host
    const pluginsDir = path.join(app.getPath("userData"), "plugins");
    pluginHost = createPluginHost({
        pluginsDir,
        services: pluginServices,
        launcherVersion,
        // enabledPlugins: undefined means all discovered plugins are loaded
    });

    // Subscribe to plugin events for logging
    pluginHost.on("plugin:loaded", ({ pluginId }) => {
        logWarn(`Plugin loaded: ${pluginId}`, "Main");
    });

    pluginHost.on("plugin:started", ({ pluginId }) => {
        logWarn(`Plugin started: ${pluginId}`, "Main");
    });

    pluginHost.on("plugin:error", ({ pluginId, error }) => {
        logErr(`Plugin error in ${pluginId}: ${error?.message}`, "Main");
    });

    // Register core IPC handlers
    // Type casts needed because CoreServices types differ slightly from IPC handler types
    registerMainIpc({
        profiles: services.profiles,
        sessionTabs: services.sessionTabs as unknown as Parameters<typeof registerMainIpc>[0]["sessionTabs"],
        sessionWindow: services.sessionWindow as unknown as Parameters<typeof registerMainIpc>[0]["sessionWindow"],
        tabLayouts: services.tabLayouts,
        themes: services.themes,
        features: services.features,
        clientSettings: services.clientSettings,
        onClientSettingsChanged,
        loadView,
        createInstanceWindow: services.createInstanceWindow,
        roiOpen: services.roiController.open,
        roiLoad: async (profileId) => {
            const rois = await services.roiStore.get(profileId);
            if (!rois) return null;
            return {
                lvl: rois.lvl ? { x: rois.lvl.x, y: rois.lvl.y, width: rois.lvl.w, height: rois.lvl.h } : undefined,
                charname: (rois.charname ?? rois.nameLevel)
                    ? {
                        x: (rois.charname ?? rois.nameLevel)!.x,
                        y: (rois.charname ?? rois.nameLevel)!.y,
                        width: (rois.charname ?? rois.nameLevel)!.w,
                        height: (rois.charname ?? rois.nameLevel)!.h,
                    }
                    : undefined,
                exp: (rois.exp ?? rois.expPercent)
                    ? {
                        x: (rois.exp ?? rois.expPercent)!.x,
                        y: (rois.exp ?? rois.expPercent)!.y,
                        width: (rois.exp ?? rois.expPercent)!.w,
                        height: (rois.exp ?? rois.expPercent)!.h,
                    }
                    : undefined,
                lauftext: rois.lauftext ? { x: rois.lauftext.x, y: rois.lauftext.y, width: rois.lauftext.w, height: rois.lauftext.h } : undefined,
            };
        },
        roiSave: async (profileId, rois) => {
            await services.roiStore.set(profileId, {
                lvl: rois.lvl
                    ? { x: rois.lvl.x, y: rois.lvl.y, w: rois.lvl.width, h: rois.lvl.height }
                    : undefined,
                charname: (rois.charname ?? rois.nameLevel)
                    ? {
                        x: (rois.charname ?? rois.nameLevel)!.x,
                        y: (rois.charname ?? rois.nameLevel)!.y,
                        w: (rois.charname ?? rois.nameLevel)!.width,
                        h: (rois.charname ?? rois.nameLevel)!.height,
                    }
                    : undefined,
                exp: (rois.exp ?? rois.expPercent)
                    ? {
                        x: (rois.exp ?? rois.expPercent)!.x,
                        y: (rois.exp ?? rois.expPercent)!.y,
                        w: (rois.exp ?? rois.expPercent)!.width,
                        h: (rois.exp ?? rois.expPercent)!.height,
                    }
                    : undefined,
                lauftext: rois.lauftext
                    ? { x: rois.lauftext.x, y: rois.lauftext.y, w: rois.lauftext.width, h: rois.lauftext.height }
                    : undefined,
            });
            return true;
        },
        roiStatus: async (profileId) => {
            const rois = await services.roiStore.get(profileId);
            return {
                lvl: !!rois?.lvl,
                charname: !!(rois?.charname ?? rois?.nameLevel),
                exp: !!(rois?.exp ?? rois?.expPercent),
                lauftext: !!rois?.lauftext,
                rmExp: !!rois?.rmExp,
                enemyName: !!rois?.enemyName,
                enemyHp: !!rois?.enemyHp,
            };
        },
        roiVisibilityGet: async (profileId) => roiVisibilityStore.get(profileId),
        roiVisibilitySet: async (profileId, key, visible) => roiVisibilityStore.set(profileId, { [key]: visible }),
        showToast: (message, tone = "info") => {
            const target = launcherWindow;
            if (!target || target.isDestroyed()) return;
            try {
                target.webContents.send("toast:show", { message, tone, ttlMs: toastDurationMs });
            } catch {
                /* ignore */
            }
        },
    });

    // Register plugin management IPC handlers
    const ipcLogErr = (msg: unknown) => logErr(msg, "IPC");
    const safeHandle = createSafeHandler(ipcLogErr);
    registerPluginHandlers(safeHandle, { pluginHost }, ipcLogErr);

    // Start all plugins
    try {
        await pluginHost.startAll();
        logWarn(`Plugins started: ${pluginHost.getLoadedPluginIds().join(", ") || "none"}`, "Main");
    } catch (err) {
        logErr(err, "PluginHost");
    }

    // Create launcher window
    launcherWindow = services.createLauncherWindow({
        preloadPath,
        loadView,
        width: launcherSize.width,
        height: launcherSize.height,
        onClosed: () => (launcherWindow = null),
    });

    // macOS: Re-create window when dock icon is clicked
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            launcherWindow = services.createLauncherWindow({
                preloadPath,
                loadView,
                width: launcherSize.width,
                height: launcherSize.height,
                onClosed: () => (launcherWindow = null),
            });
        }
    });
});

// ============================================================================
// App Lifecycle
// ============================================================================

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
});

app.on("before-quit", async () => {
    // Stop all plugins first
    if (pluginHost) {
        try {
            await pluginHost.stopAll();
            logWarn("All plugins stopped", "Main");
        } catch (err) {
            logErr(err, "PluginHost");
        }
    }
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("before-quit", async () => {
    try {
        await sidePanelButton?.stop();
    } catch {
        // ignore
    }
    try {
        if (sidePanelWindow && !sidePanelWindow.isDestroyed()) {
            sidePanelWindow.destroy();
        }
    } catch {
        // ignore
    }
});

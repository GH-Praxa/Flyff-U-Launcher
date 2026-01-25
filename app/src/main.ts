/**
 * Main Entry Point (Unified with Plugin System)
 *
 * Core functionality with integrated plugin system.
 * EXP-Tracker, Questlog, Buff-Wecker are loaded as plugins from userData/plugins/
 */

import { app, BrowserWindow, session, ipcMain, globalShortcut, dialog, type NativeImage } from "electron";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import squirrelStartup from "electron-squirrel-startup";
import { autoUpdater } from "electron-updater";

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
import { createCoreServices } from "./main/coreServices";
import { createServiceRegistry } from "./main/plugin/serviceRegistry";
import { createPluginHost } from "./main/plugin/pluginHost";
import { createPluginStateStore } from "./main/plugin/pluginStateStore";
import { invokePluginHandler, hasPluginHandler } from "./main/plugin/pluginIpc";
import { URLS, TIMINGS } from "./shared/constants";
import { createSidePanelButtonController } from "./main/windows/sidePanelButtonController";
import { createSidePanelWindow } from "./main/windows/sidePanelWindow";
import { createRoiVisibilityStore } from "./main/roi/roiVisibilityStore";
import { createOverlayWindow } from "./main/windows/overlayWindow";
import { acquireSharedOcrWorker, releaseAllOcrWorkers } from "./main/ocr/workerPool";
import { OcrTimerScheduler } from "./main/ocr/timerScheduler";
import type { OcrKind, PythonOcrWorker } from "./main/ocr/pythonWorker";
import { DEFAULT_LOCALE, type ClientSettings, type Locale } from "./shared/schemas";
import { translations, type TranslationKey } from "./i18n/translations";
import {
    getDefaultOcrTimers,
    loadAllOcrTimers,
    persistOcrTimerSettings,
    OCR_TIMER_KEYS,
    type OcrTimerKey,
    type OcrTimerSettings,
} from "./main/ocr/timerStore";
import {
    clampManualLevel,
    loadManualLevelOverrides,
    persistManualLevelOverride,
    type ManualLevelOverrideRow,
} from "./main/ocr/manualLevelStore";
import { loadDebugConfig, debugLog } from "./main/debugConfig";

// Vite declarations
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

app.setAppUserModelId("Flyff-U-Launcher");

// ============================================================================
// Global State
// ============================================================================

let launcherWindow: BrowserWindow | null = null;
let pluginHost: ReturnType<typeof createPluginHost> | null = null;
let sessionWindowController: ReturnType<typeof createCoreServices>["sessionWindow"] | null = null;
let sidePanelButton: ReturnType<typeof createSidePanelButtonController> | null = null;
let sidePanelWindow: BrowserWindow | null = null;
let sidePanelSyncInterval: NodeJS.Timeout | null = null;
let roiOverlayWindow: BrowserWindow | null = null;
let roiSupportOverlayWindow: BrowserWindow | null = null;
let scheduleTimersForProfile: (profileId: string) => void = () => {};

// Track overlay visibility state for focus management
let overlaysWereVisible = {
    roiOverlay: false,
    roiSupportOverlay: false,
    sidePanelButton: false,
    sidePanel: false,
};

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

function configureBundledTesseract(): void {
    const exePath = resolveResourcePath("tesseract", "tesseract.exe");
    if (fs.existsSync(exePath)) {
        process.env.TESSERACT_EXE = exePath;
        const tessdata = resolveResourcePath("tesseract", "tessdata");
        if (fs.existsSync(tessdata)) {
            process.env.TESSDATA_PREFIX = tessdata;
        }
    }
}

app.whenReady().then(async () => {
    // Apply Content Security Policy
    applyCSP(session.defaultSession);

    const preloadPath = path.join(__dirname, "preload.js");
    const pluginsDir = path.join(app.getPath("userData"), "plugins");
    const launcherVersion = app.getVersion();

    // Prepare bundled assets (Tesseract, default plugins)
    configureBundledTesseract();
    await copyDefaultPlugins(pluginsDir);

    // Load debug configuration
    await loadDebugConfig();

    debugLog("startup", "userData:", app.getPath("userData"));
    debugLog("startup", "pluginsDir:", pluginsDir);

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

    sessionWindowController = services.sessionWindow;
    let overlayClickThrough = false;
    let clientLocale: Locale = DEFAULT_LOCALE;
    try {
        const clientSettingsSnap = await services.clientSettings.get();
        overlayClickThrough = !!clientSettingsSnap.overlayButtonPassthrough;
        clientLocale = clientSettingsSnap.locale ?? DEFAULT_LOCALE;
    } catch (err) {
        logErr(err, "ClientSettings");
    }
    sidePanelButton = createSidePanelButtonController({
        sessionWindow: services.sessionWindow,
        sessionTabs: services.sessionTabs,
        profiles: services.profiles,
        preloadPath,
        clickThrough: overlayClickThrough,
    });
    await sidePanelButton.start();
    const onClientSettingsChanged = (settings: ClientSettings) => {
        sidePanelButton?.setClickThrough?.(settings.overlayButtonPassthrough);
        if (settings.locale) {
            clientLocale = settings.locale;
        }
    };

    // =========================================================================
    // Global overlay visibility management - hide when app loses focus
    // =========================================================================
    const hideAllOverlays = () => {
        // ROI Overlay
        if (roiOverlayWindow && !roiOverlayWindow.isDestroyed()) {
            overlaysWereVisible.roiOverlay = roiOverlayWindow.isVisible();
            if (overlaysWereVisible.roiOverlay) {
                roiOverlayWindow.hide();
            }
        }
        // Support ROI Overlay
        if (roiSupportOverlayWindow && !roiSupportOverlayWindow.isDestroyed()) {
            overlaysWereVisible.roiSupportOverlay = roiSupportOverlayWindow.isVisible();
            if (overlaysWereVisible.roiSupportOverlay) {
                roiSupportOverlayWindow.hide();
            }
        }
        // Sidepanel Button
        if (sidePanelButton) {
            overlaysWereVisible.sidePanelButton = sidePanelButton.isVisible();
            if (overlaysWereVisible.sidePanelButton) {
                sidePanelButton.hide();
            }
        }
        // Sidepanel
        if (sidePanelWindow && !sidePanelWindow.isDestroyed()) {
            overlaysWereVisible.sidePanel = sidePanelWindow.isVisible();
            if (overlaysWereVisible.sidePanel) {
                sidePanelWindow.hide();
            }
        }
    };

    const showAllOverlays = () => {
        // ROI Overlay
        if (roiOverlayWindow && !roiOverlayWindow.isDestroyed() && overlaysWereVisible.roiOverlay) {
            roiOverlayWindow.show();
        }
        // Support ROI Overlay
        if (roiSupportOverlayWindow && !roiSupportOverlayWindow.isDestroyed() && overlaysWereVisible.roiSupportOverlay) {
            roiSupportOverlayWindow.show();
        }
        // Sidepanel Button
        if (sidePanelButton && overlaysWereVisible.sidePanelButton) {
            sidePanelButton.show();
        }
        // Sidepanel
        if (sidePanelWindow && !sidePanelWindow.isDestroyed() && overlaysWereVisible.sidePanel) {
            sidePanelWindow.show();
        }
    };

    const stopSidePanelSync = () => {
        if (sidePanelSyncInterval) {
            clearInterval(sidePanelSyncInterval);
            sidePanelSyncInterval = null;
        }
    };

    const hideSidePanelWindow = () => {
        stopSidePanelSync();
        if (sidePanelWindow && !sidePanelWindow.isDestroyed()) {
            if (sidePanelWindow.isVisible()) {
                sidePanelWindow.hide();
            } else {
                void sidePanelButton?.start();
            }
        } else {
            void sidePanelButton?.start();
        }
    };

    // Listen for when ANY window in our app gets/loses focus
    app.on("browser-window-blur", () => {
        // Small delay to check if focus moved to another of our windows
        setTimeout(() => {
            const focusedWin = BrowserWindow.getFocusedWindow();
            // If no window in our app has focus, hide overlays
            if (!focusedWin) {
                hideAllOverlays();
            }
        }, 100);
    });

    app.on("browser-window-focus", (_, win) => {
        const sessionWin = services.sessionWindow.get();
        // Show overlays when session window gains focus
        if (sessionWin && win.id === sessionWin.id) {
            showAllOverlays();
        }
    });

    // Helper function to compute and apply sidepanel bounds within BrowserView
    const syncSidePanelBounds = async () => {
        const parent = services.sessionWindow.get();
        if (!parent || parent.isDestroyed()) return;
        if (!sidePanelWindow || sidePanelWindow.isDestroyed()) return;

        const overlayTargetId = sidePanelButton?.getActiveProfileId?.()
            ?? (await services.profiles.getOverlayTargetId());
        const hasActiveTarget = Boolean(overlayTargetId && services.sessionTabs.isActive(overlayTargetId));
        if (!hasActiveTarget) {
            hideSidePanelWindow();
            return;
        }

        if (!sidePanelWindow.isVisible()) return;

        const content = parent.getContentBounds();
        const viewBounds = services.sessionTabs.getBounds(overlayTargetId!);

        const marginX = 12;
        const hostX = content.x + viewBounds.x;
        const hostY = content.y + viewBounds.y;
        const currentBounds = sidePanelWindow.getBounds();

        // Keep current width if user resized, but clamp to view bounds
        const availableWidth = Math.max(120, viewBounds.width - marginX * 2);
        const minAllowedWidth = Math.min(260, availableWidth);
        const maxWidth = Math.min(420, availableWidth);
        const finalWidth = Math.min(Math.max(currentBounds.width, minAllowedWidth), maxWidth);

        // Height should fill the full view bounds (no vertical margin)
        const finalHeight = Math.max(180, viewBounds.height);

        // Position at right edge of view bounds, full height
        const x = hostX + Math.max(0, viewBounds.width - finalWidth - marginX);
        const y = hostY;

        try {
            sidePanelWindow.setBounds({ x, y, width: finalWidth, height: finalHeight });
        } catch (err) {
            logErr(err, "SidePanelBoundsSync");
        }
    };

    const toggleSidePanel = async (payload?: { focusTab?: string; profileId?: string }) => {
        const parent = services.sessionWindow.get();
        if (!parent || parent.isDestroyed())
            return;
        if (!sidePanelWindow || sidePanelWindow.isDestroyed()) {
            sidePanelWindow = createSidePanelWindow(parent, { preloadPath, locale: clientLocale });
            sidePanelWindow.on("show", () => { void sidePanelButton?.stop(); });
            sidePanelWindow.on("hide", () => {
                void sidePanelButton?.start();
                // Stop sync when hidden
                stopSidePanelSync();
            });
            sidePanelWindow.on("closed", () => {
                sidePanelWindow = null;
                void sidePanelButton?.start();
                // Clean up sync interval
                stopSidePanelSync();
            });

            // Sync bounds when parent window moves or resizes
            const onParentChange = () => syncSidePanelBounds();
            parent.on("move", onParentChange);
            parent.on("resize", onParentChange);
            sidePanelWindow.on("closed", () => {
                parent.off("move", onParentChange);
                parent.off("resize", onParentChange);
            });
        }
        const panel = sidePanelWindow;
        if (!panel || panel.isDestroyed()) {
            return;
        }
        const overlayTargetId = (typeof payload?.profileId === "string" && payload.profileId)
            ? payload.profileId
            : sidePanelButton?.getActiveProfileId?.()
                ?? (await services.profiles.getOverlayTargetId());
        const hasActiveTarget = Boolean(overlayTargetId && services.sessionTabs.isActive(overlayTargetId));
        if (!hasActiveTarget) {
            hideSidePanelWindow();
            return;
        }
        const content = parent.getContentBounds();
        const viewBounds = services.sessionTabs.getBounds(overlayTargetId!);
        const marginX = 12;
        const hostX = content.x + viewBounds.x;
        const hostY = content.y + viewBounds.y;
        const availableWidth = Math.max(120, viewBounds.width - marginX * 2);
        const minAllowedWidth = Math.min(260, availableWidth);
        const width = Math.max(minAllowedWidth, Math.min(420, availableWidth));
        const finalWidth = Math.min(width, Math.max(80, viewBounds.width - marginX));
        // Height should fill the full view bounds (no vertical margin)
        const finalHeight = Math.max(180, viewBounds.height);
        const x = hostX + Math.max(0, viewBounds.width - finalWidth - marginX);
        const y = hostY;
        panel.setBounds({ x, y, width: finalWidth, height: finalHeight });
        if (payload?.focusTab) {
            panel.webContents.send("sidepanel:focusTab", { tab: payload.focusTab });
        }
        const willShow = !panel.isVisible();
        if (willShow) {
            await sidePanelButton?.stop();
            if (panel.isDestroyed()) {
                return;
            }
            panel.show();
            panel.focus();
            // Start periodic sync to follow tab switches
            if (!sidePanelSyncInterval) {
                sidePanelSyncInterval = setInterval(() => syncSidePanelBounds(), 500);
            }
        } else {
            hideSidePanelWindow();
        }
    };

    ipcMain.on("sidepanel:toggle", (_e, payload) => {
        void toggleSidePanel(payload as { focusTab?: string; profileId?: string });
    });

    const overlayShortcut = "Control+Shift+O";
    const shortcutRegistered = globalShortcut.register(overlayShortcut, () => {
        const focused = BrowserWindow.getFocusedWindow();
        const sessionWin = services.sessionWindow.get();
        if (!sessionWin || sessionWin.isDestroyed())
            return;
        if (!focused)
            return;
        const sideWin = sidePanelWindow && !sidePanelWindow.isDestroyed() ? sidePanelWindow : null;
        const roiWin = roiOverlayWindow && !roiOverlayWindow.isDestroyed() ? roiOverlayWindow : null;
        if (focused &&
            focused.id !== sessionWin.id &&
            (!sideWin || focused.id !== sideWin.id) &&
            (!roiWin || focused.id !== roiWin.id)) {
            return;
        }
        void toggleSidePanel({ profileId: sidePanelButton?.getActiveProfileId?.() ?? undefined, focusTab: "roi" });
    });
    if (!shortcutRegistered) {
        logWarn("Global shortcut Ctrl+Shift+O could not be registered", "Main");
    }

    // ROI Overlay - shows calibrated ROI boxes over the active tab or instance window
    let roiOverlaySyncInterval: NodeJS.Timeout | null = null;
    let roiOverlayParent: BrowserWindow | null = null;
    let roiSupportOverlaySyncInterval: NodeJS.Timeout | null = null;
    let roiSupportOverlayParent: BrowserWindow | null = null;

    const resolveOverlayHost = (profileId: string) => {
        const sessionWin = services.sessionWindow.get();
        const isActive = services.sessionTabs.isActive(profileId);
        debugLog("resolveOverlayHost", "[resolveOverlayHost] profileId:", profileId, "sessionWin:", !!sessionWin, "isActive:", isActive);

        if (sessionWin && !sessionWin.isDestroyed() && isActive) {
            const contentBounds = sessionWin.getContentBounds();
            const viewBounds = services.sessionTabs.getBounds(profileId);
            debugLog("resolveOverlayHost", "[resolveOverlayHost] Using session tab - contentBounds:", contentBounds, "viewBounds:", viewBounds);
            return {
                parent: sessionWin,
                bounds: {
                    x: contentBounds.x + viewBounds.x,
                    y: contentBounds.y + viewBounds.y,
                    width: viewBounds.width,
                    height: viewBounds.height,
                },
            };
        }

        const inst = services.instances.get(profileId);
        debugLog("resolveOverlayHost", "[resolveOverlayHost] Instance window:", !!inst);
        if (inst && !inst.isDestroyed()) {
            const bounds = inst.getContentBounds();
            debugLog("resolveOverlayHost", "[resolveOverlayHost] Using instance window - bounds:", bounds);
            return { parent: inst, bounds };
        }

        debugLog("resolveOverlayHost", "[resolveOverlayHost] No valid host found");
        return null;
    };

    const syncRoiOverlay = async () => {
        try {
            const profileId = await services.profiles.getOverlayTargetId();
            debugLog("roiOverlaySync", "[ROI Overlay Sync] profileId:", profileId);
            if (!profileId) {
                debugLog("roiOverlaySync", "[ROI Overlay Sync] No overlay target set - hiding overlay");
                if (roiOverlayWindow && !roiOverlayWindow.isDestroyed()) {
                    roiOverlayWindow.hide();
                }
                return;
            }

            const host = resolveOverlayHost(profileId);
            debugLog("roiOverlaySync", "[ROI Overlay Sync] host:", host ? { parentId: host.parent.id, bounds: host.bounds } : null);
            if (!host || host.bounds.width <= 0 || host.bounds.height <= 0) {
                debugLog("roiOverlaySync", "[ROI Overlay Sync] No valid host - hiding overlay");
                if (roiOverlayWindow && !roiOverlayWindow.isDestroyed()) {
                    roiOverlayWindow.hide();
                }
                return;
            }

            if (!roiOverlayWindow || roiOverlayWindow.isDestroyed()) {
                roiOverlayWindow = createOverlayWindow(host.parent, { preloadPath, locale: clientLocale });
                roiOverlayWindow.on("closed", () => {
                    if (roiOverlaySyncInterval) {
                        clearInterval(roiOverlaySyncInterval);
                        roiOverlaySyncInterval = null;
                    }
                    roiOverlayWindow = null;
                    roiOverlayParent = null;
                });
            } else if (!roiOverlayParent || roiOverlayParent.id !== host.parent.id) {
                roiOverlayWindow.setParentWindow(host.parent);
            }

            roiOverlayParent = host.parent;
            scheduleTimersForProfile(profileId);
            roiOverlayWindow.setBounds(host.bounds);
            roiOverlayWindow.show();
        } catch (err) {
            logErr(err, "ROI Overlay Sync");
        }
    };

    const ensureRoiOverlay = () => {
        if (roiOverlaySyncInterval) return roiOverlayWindow;
        roiOverlaySyncInterval = setInterval(() => void syncRoiOverlay(), 500);
        void syncRoiOverlay();
        return roiOverlayWindow;
    };

    const syncRoiSupportOverlay = async () => {
        try {
            const profileId = await services.profiles.getOverlaySupportTargetId();
            debugLog("roiOverlaySync", "[ROI Support Overlay Sync] profileId:", profileId);
            if (!profileId) {
                if (roiSupportOverlayWindow && !roiSupportOverlayWindow.isDestroyed()) {
                    roiSupportOverlayWindow.hide();
                }
                return;
            }

            const host = resolveOverlayHost(profileId);
            debugLog("roiOverlaySync", "[ROI Support Overlay Sync] host:", host ? { parentId: host.parent.id, bounds: host.bounds } : null);
            if (!host || host.bounds.width <= 0 || host.bounds.height <= 0) {
                if (roiSupportOverlayWindow && !roiSupportOverlayWindow.isDestroyed()) {
                    roiSupportOverlayWindow.hide();
                }
                return;
            }

            if (!roiSupportOverlayWindow || roiSupportOverlayWindow.isDestroyed()) {
                roiSupportOverlayWindow = createOverlayWindow(host.parent, { preloadPath, role: "support", locale: clientLocale });
                roiSupportOverlayWindow.on("closed", () => {
                    if (roiSupportOverlaySyncInterval) {
                        clearInterval(roiSupportOverlaySyncInterval);
                        roiSupportOverlaySyncInterval = null;
                    }
                    roiSupportOverlayWindow = null;
                    roiSupportOverlayParent = null;
                });
            } else if (!roiSupportOverlayParent || roiSupportOverlayParent.id !== host.parent.id) {
                roiSupportOverlayWindow.setParentWindow(host.parent);
            }

            roiSupportOverlayParent = host.parent;
            scheduleTimersForProfile(profileId);
            roiSupportOverlayWindow.setBounds(host.bounds);
            roiSupportOverlayWindow.show();
        } catch (err) {
            logErr(err, "ROI Support Overlay Sync");
        }
    };

    const ensureRoiSupportOverlay = () => {
        if (roiSupportOverlaySyncInterval) return roiSupportOverlayWindow;
        roiSupportOverlaySyncInterval = setInterval(() => void syncRoiSupportOverlay(), 500);
        void syncRoiSupportOverlay();
        return roiSupportOverlayWindow;
    };

    // Create service registry for plugins
    const pythonExe = process.env.FLYFF_OCR_PYTHON ?? "python";
    const ocrWorkerPromises = new Map<OcrKind, Promise<PythonOcrWorker>>();
    const ocrWorkerBackoff = new Map<OcrKind, number>();
    const WORKER_BACKOFF_MS = 5000;

    async function ensureOcrWorker(kind: OcrKind): Promise<PythonOcrWorker> {
        const until = ocrWorkerBackoff.get(kind) ?? 0;
        if (Date.now() < until) {
            throw new Error("ocr_worker_backoff");
        }
        if (!ocrWorkerPromises.has(kind)) {
            ocrWorkerPromises.set(kind, acquireSharedOcrWorker(pythonExe, undefined, kind));
        }
        try {
            const worker = await ocrWorkerPromises.get(kind)!;
            if (!worker.isRunning()) {
                ocrWorkerPromises.set(kind, acquireSharedOcrWorker(pythonExe, undefined, kind));
                return await ocrWorkerPromises.get(kind)!;
            }
            ocrWorkerBackoff.delete(kind);
            return worker;
        } catch (err) {
            ocrWorkerPromises.delete(kind);
            ocrWorkerBackoff.set(kind, Date.now() + WORKER_BACKOFF_MS);
            throw err;
        }
    }
    const serviceRegistry = createServiceRegistry({
        core: services,
        pythonExe,
    });

    // Prewarm EXP OCR worker so first scan doesn't block on startup verification
    void ensureOcrWorker("exp").catch((err) => logErr(err, "OCR prewarm exp"));

    // Create plugin state store (for enabled/disabled persistence)
    const pluginStateStore = createPluginStateStore();

    // Get enabled plugins from state store
    const enabledPluginIds = await pluginStateStore.getEnabledIds();

    // Create plugin host
    pluginHost = createPluginHost({
        pluginsDir,
        // Build per-plugin services via the registry so requires/permissions are respected
        services: (manifest, pluginId) => serviceRegistry.getServicesForPlugin(manifest, pluginId),
        launcherVersion,
        enabledPlugins: enabledPluginIds.length > 0 ? enabledPluginIds : undefined,
    });
    const pluginEventBus = pluginHost.getEventBus();

    // Subscribe to plugin events for logging
    pluginHost.on("plugin:loaded", ({ pluginId }) => {
        logWarn(`Plugin loaded: ${pluginId}`, "Main");
    });

    pluginHost.on("plugin:started", ({ pluginId }) => {
        logWarn(`Plugin started: ${pluginId}`, "Main");
    });

    pluginHost.on("plugin:stopped", ({ pluginId }) => {
        logWarn(`Plugin stopped: ${pluginId}`, "Main");
    });

    pluginHost.on("plugin:error", ({ pluginId, error }) => {
        logErr(`Plugin error in ${pluginId}: ${error?.message}`, "Main");
        // Record error in state store
        pluginStateStore.recordError(pluginId, error?.message ?? "Unknown error");
    });

    // Register core IPC handlers
    registerMainIpc({
        profiles: services.profiles,
        sessionTabs: services.sessionTabs as Parameters<typeof registerMainIpc>[0]["sessionTabs"],
        sessionWindow: services.sessionWindow as Parameters<typeof registerMainIpc>[0]["sessionWindow"],
        tabLayouts: services.tabLayouts,
        themes: services.themes,
        features: services.features,
    loadView,
    createInstanceWindow: services.createInstanceWindow,
    clientSettings: services.clientSettings,
    onClientSettingsChanged,
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
                rmExp: rois.rmExp ? { x: rois.rmExp.x, y: rois.rmExp.y, width: rois.rmExp.w, height: rois.rmExp.h } : undefined,
                enemyName: rois.enemyName ? { x: rois.enemyName.x, y: rois.enemyName.y, width: rois.enemyName.w, height: rois.enemyName.h } : undefined,
                enemyHp: rois.enemyHp ? { x: rois.enemyHp.x, y: rois.enemyHp.y, width: rois.enemyHp.w, height: rois.enemyHp.h } : undefined,
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
                rmExp: rois.rmExp
                    ? { x: rois.rmExp.x, y: rois.rmExp.y, w: rois.rmExp.width, h: rois.rmExp.height }
                    : undefined,
                enemyName: rois.enemyName
                    ? { x: rois.enemyName.x, y: rois.enemyName.y, w: rois.enemyName.width, h: rois.enemyName.height }
                    : undefined,
                enemyHp: rois.enemyHp
                    ? { x: rois.enemyHp.x, y: rois.enemyHp.y, w: rois.enemyHp.width, h: rois.enemyHp.height }
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
        roiVisibilityGet: async (profileId) => {
            return await roiVisibilityStore.get(profileId);
        },
        roiVisibilitySet: async (profileId, key, visible) => {
            return await roiVisibilityStore.set(profileId, { [key]: visible });
        },
    });

    // Register plugin management IPC handlers
    const ipcLogErr = (msg: unknown) => logErr(msg, "IPC");
    const safeHandle = createSafeHandler(ipcLogErr);
    registerPluginHandlers(safeHandle, { pluginHost, pluginStateStore }, ipcLogErr);

    // OCR System
    const ocrCache = new Map<string, {
        lvl?: string;
        exp?: string;
        rmExp?: string;
        charname?: string;
        lauftext?: string;
        enemyName?: string;
        enemyHp?: string;
        monsterName?: string;
        updatedAt: number;
    }>();
    const manualLevelOverrides = new Map<string, ManualLevelOverrideRow>();
    const loadManualLevelOverridesIntoMemory = async () => {
        const rows = await loadManualLevelOverrides();
        manualLevelOverrides.clear();
        rows.forEach((row) => manualLevelOverrides.set(row.profileId, row));
    };
    const getManualLevelOverride = (profileId: string) => manualLevelOverrides.get(profileId) ?? null;
    const saveManualLevelOverride = async (
        profileId: string,
        patch: Partial<Pick<ManualLevelOverrideRow, "value" | "enabled">>
    ) => {
        const updated = await persistManualLevelOverride(profileId, patch);
        if (updated) {
            manualLevelOverrides.set(profileId, updated);
            return updated;
        }
        manualLevelOverrides.delete(profileId);
        return null;
    };
    const ocrTimers = new Map<string, OcrTimerSettings>();
    const OCR_KEYS = OCR_TIMER_KEYS;
    const STALE_CLEAR_MS = 900; // Clear stale values if no fresh OCR within this window
    const KEY_TO_OCR_KIND: Record<OcrTimerKey, OcrKind> = {
        lvl: "lvl",
        exp: "exp",
        rmExp: "exp",
        charname: "charname",
        lauftext: "lauftext",
        enemyName: "lvl",
        enemyHp: "enemyHp",
    };
    const getEffectiveOcrSnapshot = (profileId: string) => {
        const base = ocrCache.get(profileId) ?? null;
        const manual = getManualLevelOverride(profileId);
        if (!base && !manual) return null;
        const snapshot = base ? { ...base } : { updatedAt: 0 };
        if (manual?.enabled) {
            snapshot.lvl = String(manual.value);
            snapshot.updatedAt = Math.max(snapshot.updatedAt ?? 0, manual.updatedAt ?? Date.now());
        }
        if (snapshot.enemyName && !snapshot.monsterName) {
            snapshot.monsterName = snapshot.enemyName;
        }
        return snapshot;
    };
    const getEffectiveOcrValue = (profileId: string, key: OcrTimerKey, rawValue: string | null) => {
        if (key === "lvl") {
            const manual = getManualLevelOverride(profileId);
            if (manual?.enabled) return String(manual.value);
        }
        return rawValue;
    };
    const broadcastManualLevelOverride = (profileId: string) => {
        const manual = getManualLevelOverride(profileId);
        if (manual?.enabled) {
            const existing = ocrCache.get(profileId) ?? { updatedAt: 0 };
            existing.updatedAt = Math.max(existing.updatedAt || 0, manual.updatedAt ?? Date.now());
            ocrCache.set(profileId, existing);
        }
        const snapshot = getEffectiveOcrSnapshot(profileId);
        if (!snapshot) return;
        pluginEventBus.emit("ocr:update", {
            profileId,
            key: "lvl",
            value: snapshot.lvl ?? "",
            values: snapshot,
        }, "core");
    };

    const clampExpPercent = (val: unknown): number | null => {
        const str = typeof val === "string" ? val : String(val ?? "");
        const parsed = parseFloat(str.replace(/[^0-9.,]/g, "").replace(",", "."));
        if (!Number.isFinite(parsed)) return null;
        const clamped = Math.min(100, Math.max(0, parsed));
        return clamped;
    };

    const EXP_MAX_DROP_PER_TICK = 0.3;
    const EXP_LEVEL_DROP_GRACE_MS = 6000;
    const EXP_LEVELUP_THRESHOLD = 99.9999;
    const EXP_LEVELUP_RESET_THRESHOLD = 10;
    const EXP_LEVELUP_DROP_MIN = 10;
    const EXP_LEVELUP_LOCK_MS = 2500;
    const lastLevelChangeAt = new Map<string, number>();
    const expLevelUpLocks = new Map<string, number>();
    const lastEnemyMeta = new Map<string, { level: number | null; element: string | null; updatedAt: number }>();

    const handleExpLevelUp = (
        profileId: string,
        prevExp: unknown,
        nextExp: unknown,
        now: number
    ) => {
        const lastLockAt = expLevelUpLocks.get(profileId) ?? 0;
        const lockActive = lastLockAt && (now - lastLockAt) < EXP_LEVELUP_LOCK_MS;
        const prevPct = clampExpPercent(prevExp);
        const nextPct = clampExpPercent(nextExp);
        if (nextPct !== null && nextPct < EXP_LEVELUP_RESET_THRESHOLD && !lockActive) {
            expLevelUpLocks.delete(profileId);
        }
        const levelUpByThreshold = (
            nextPct !== null
            && nextPct >= EXP_LEVELUP_THRESHOLD
            && (prevPct ?? 0) < EXP_LEVELUP_THRESHOLD
            && !lockActive
        );
        const levelUpByDrop = (
            prevPct !== null
            && nextPct !== null
            && prevPct - nextPct >= EXP_LEVELUP_DROP_MIN
            && nextPct <= EXP_LEVELUP_RESET_THRESHOLD
            && !lockActive
        );
        if (levelUpByThreshold || levelUpByDrop) {
            expLevelUpLocks.set(profileId, now);
            lastLevelChangeAt.set(profileId, now);
        }
    };

    // Default timer values in ms (0 = disabled)
    const getOcrTimers = (profileId: string): OcrTimerSettings => {
        const existing = ocrTimers.get(profileId);
        if (existing) {
            const allZero = OCR_KEYS.every((k) => (existing as Record<string, number>)[k] <= 0);
            if (!allZero) return existing;
        }
        return getDefaultOcrTimers();
    };

    const isImageNearlyUniform = (img: NativeImage): boolean => {
        try {
            const { width, height } = img.getSize();
            if (width === 0 || height === 0) return true;
            const buf = img.getBitmap();
            if (!buf || buf.length < 4) return true;
            const totalPixels = width * height;
            let minLum = 255;
            let maxLum = 0;
            for (let i = 0; i < totalPixels; i++) {
                const offset = i * 4;
                const b = buf[offset]!;
                const g = buf[offset + 1]!;
                const r = buf[offset + 2]!;
                // Integer approximation of luminance
                const lum = (299 * r + 587 * g + 114 * b) / 1000;
                if (lum < minLum) minLum = lum;
                if (lum > maxLum) maxLum = lum;
                if (maxLum - minLum > 8) return false;
            }
            return (maxLum - minLum) <= 8;
        } catch {
            return false;
        }
    };

    const ELEMENT_COLORS: Record<string, [number, number, number]> = {
        fire: [121, 94, 85],
        water: [130, 141, 149],
        wind: [83, 105, 68],
        earth: [96, 74, 79],
        electricity: [125, 114, 72],
    };

    const rgbToHsv = (r: number, g: number, b: number) => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;
        if (d !== 0) {
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
                case g: h = ((b - r) / d + 2); break;
                case b: h = ((r - g) / d + 4); break;
            }
            h *= 60;
        }
        const s = max === 0 ? 0 : d / max;
        const v = max;
        return { h, s, v };
    };

    const detectElement = (img: NativeImage): string | null => {
        try {
            const { width, height } = img.getSize();
            if (width <= 0 || height <= 0) return null;
            const buf = img.getBitmap();
            if (!buf || buf.length < 4) return null;
            let sumR = 0;
            let sumG = 0;
            let sumB = 0;
            let count = 0;
            const startX = Math.floor(width * 0.25);
            const endX = Math.ceil(width * 0.75);
            const startY = Math.floor(height * 0.25);
            const endY = Math.ceil(height * 0.75);
            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    const idx = (y * width + x) * 4;
                    const b = buf[idx] ?? 0;
                    const g = buf[idx + 1] ?? 0;
                    const r = buf[idx + 2] ?? 0;
                    sumR += r;
                    sumG += g;
                    sumB += b;
                    count++;
                }
            }
            if (count === 0) return null;
            const avgR = sumR / count;
            const avgG = sumG / count;
            const avgB = sumB / count;
            const { h, s, v } = rgbToHsv(avgR, avgG, avgB);
            if (s > 0.12 && v > 0.25) {
                if ((h >= 0 && h < 30) || h >= 330) return "fire";
                if (h >= 30 && h < 70) return "electricity";
                if (h >= 70 && h < 170) return "wind";
                if (h >= 170 && h < 250) return "water";
                if (h >= 250 && h < 330) return "earth";
            }
            let best: { name: string; dist: number } | null = null;
            for (const [name, [r, g, b]] of Object.entries(ELEMENT_COLORS)) {
                const dist = Math.sqrt(
                    Math.pow(avgR - r, 2) +
                    Math.pow(avgG - g, 2) +
                    Math.pow(avgB - b, 2)
                );
                if (!best || dist < best.dist) {
                    best = { name, dist };
                }
            }
            if (best && best.dist <= 90) {
                return best.name;
            }
            return null;
        } catch {
            return null;
        }
    };

    const parseLevelElement = (token: string | null): { level: number | null; element: string | null } => {
        if (!token) return { level: null, element: null };
        const cleaned = token.trim();
        let level: number | null = null;
        const lvMatch = cleaned.match(/lv?\.?\s*(\d{1,3})/i);
        if (lvMatch) {
            level = Number(lvMatch[1]);
        } else {
            const numMatch = cleaned.match(/\b(\d{1,3})\b/);
            if (numMatch) level = Number(numMatch[1]);
        }
        const parts = cleaned.toLowerCase().split(/[-\s]/).filter(Boolean);
        const elements = ["earth", "fire", "water", "wind", "electricity", "electric"];
        let element: string | null = null;
        for (const p of parts) {
            if (elements.includes(p)) {
                element = p === "electric" ? "electricity" : p;
                break;
            }
        }
        return { level: Number.isFinite(level) ? level! : null, element };
    };

    const debugSaveRoi = async (profileId: string, key: OcrTimerKey): Promise<string> => {
        const rois = await services.roiStore.get(profileId);
        const roi = rois?.[key];
        if (!roi || roi.w <= 0 || roi.h <= 0) {
            throw new Error("ROI nicht gesetzt");
        }

        const captureCtx = (() => {
            const view = services.sessionTabs.getViewByProfile(profileId);
            if (view) {
                const hostWin = services.sessionWindow.get();
                const attached = !!hostWin && !hostWin.isDestroyed() && hostWin.getBrowserViews().includes(view);
                if (!hostWin || hostWin.isDestroyed() || hostWin.isMinimized() || !hostWin.isVisible() || !attached) {
                    return null;
                }
                const liveBounds = view.getBounds();
                const viewBounds = services.sessionTabs.getBounds(profileId);
                if (liveBounds.width <= 0 || liveBounds.height <= 0 || viewBounds.width <= 0 || viewBounds.height <= 0) return null;
                return {
                    win: hostWin,
                    width: Math.min(viewBounds.width, liveBounds.width),
                    height: Math.min(viewBounds.height, liveBounds.height),
                    offsetX: viewBounds.x,
                    offsetY: viewBounds.y,
                    grab: (rect: { x: number; y: number; width: number; height: number }) => view.webContents.capturePage(rect),
                };
            }
            const inst = services.instances.get(profileId);
            if (inst && !inst.isDestroyed() && inst.isVisible() && !inst.isMinimized()) {
                const bounds = inst.getBounds();
                const content = inst.getContentBounds();
                if (bounds.width <= 0 || bounds.height <= 0) return null;
                return {
                    win: inst,
                    width: content.width,
                    height: content.height,
                    offsetX: 0,
                    offsetY: 0,
                    grab: (rect: { x: number; y: number; width: number; height: number }) => inst.webContents.capturePage(rect),
                };
            }
            return null;
        })();

        if (!captureCtx || captureCtx.width <= 0 || captureCtx.height <= 0) {
            throw new Error("Kein sichtbarer Host für ROI");
        }

        const x = Math.round(roi.x * captureCtx.width);
        const y = Math.round(roi.y * captureCtx.height);
        let width = Math.max(1, Math.round(roi.w * captureCtx.width));
        let height = Math.max(1, Math.round(roi.h * captureCtx.height));

        const isExpLike = key === "exp" || key === "rmExp";
        if (isExpLike) {
            const minW = 80;
            const minH = 22;
            if (width < minW) {
                const delta = minW - width;
                const leftPad = Math.floor(delta / 2);
                const rightPad = delta - leftPad;
                const newX = Math.max(0, x - leftPad);
                const maxX = captureCtx.width;
                const newW = Math.min(maxX - newX, width + delta);
                width = Math.max(width, newW);
            }
            if (height < minH) {
                const delta = minH - height;
                const topPad = Math.floor(delta / 2);
                const bottomPad = delta - topPad;
                const newY = Math.max(0, y - topPad);
                const maxY = captureCtx.height;
                const newH = Math.min(maxY - newY, height + delta);
                height = Math.max(height, newH);
            }
        }

        let screenshot;
        try {
            screenshot = await captureCtx.grab({ x, y, width, height });
        } catch (err) {
            logErr(err, `ROI debug grab ${key}`);
            if (captureCtx.win && !captureCtx.win.isDestroyed()) {
                const fallbackRect = {
                    x: Math.max(0, Math.round((captureCtx.offsetX ?? 0) + x)),
                    y: Math.max(0, Math.round((captureCtx.offsetY ?? 0) + y)),
                    width,
                    height,
                };
                screenshot = await captureCtx.win.webContents.capturePage(fallbackRect);
            } else {
                throw err;
            }
        }

        const png = screenshot.toPNG();
        const debugDir = path.join(app.getAppPath(), "ocr", "debug");
        await fsp.mkdir(debugDir, { recursive: true });
        const timestamp = Date.now();
        const baseName = `roi_debug_${profileId}_${key}_${timestamp}`;
        const filePath = path.join(debugDir, `${baseName}.png`);
        await fsp.writeFile(filePath, png);

        // Save live OCR value to JSON
        const cached = ocrCache.get(profileId);
        const liveValue = cached?.[key as keyof typeof cached] ?? null;
        const ocrExp = cached?.exp ?? null;

        // Try to get computed stats from killfeed plugin (badge currentExp)
        let killfeedStats: { currentExp?: number; expTotal?: number; expSession?: number } | null = null;
        try {
            if (hasPluginHandler("killfeed:overlay:request:state")) {
                const result = await invokePluginHandler("killfeed:overlay:request:state", profileId);
                // Response is wrapped: {ok: true, data: {stats: {...}, layout: {...}}}
                const outer = result as { ok?: boolean; data?: unknown } | null;
                if (outer?.ok) {
                    const inner = outer.data as { stats?: Record<string, unknown> } | null;
                    if (inner?.stats) {
                        killfeedStats = {
                            currentExp: typeof inner.stats.currentExp === "number" ? inner.stats.currentExp : undefined,
                            expTotal: typeof inner.stats.expTotal === "number" ? inner.stats.expTotal : undefined,
                            expSession: typeof inner.stats.expSession === "number" ? inner.stats.expSession : undefined,
                        };
                    }
                }
            }
        } catch (err) {
            console.error("[Debug ROI] Failed to get killfeed stats:", err);
        }

        const jsonData = {
            profileId,
            key,
            liveValue,
            currentExp: ocrExp,
            killfeedCurrentExp: killfeedStats?.currentExp ?? null,
            expTotal: killfeedStats?.expTotal ?? null,
            expSession: killfeedStats?.expSession ?? null,
            allOcrValues: cached ? { ...cached } : null,
            timestamp,
            roi: { x: roi.x, y: roi.y, w: roi.w, h: roi.h },
            captureSize: { width, height },
        };
        const jsonPath = path.join(debugDir, `${baseName}.json`);
        await fsp.writeFile(jsonPath, JSON.stringify(jsonData, null, 2));

        return filePath;
    };

    // Return type: string (valid result), "" (empty/no text), or null (error/not ready)
    const scanRoiKey = async (profileId: string, key: OcrTimerKey): Promise<string | null> => {
        try {
            const tStart = Date.now();
            const rois = await services.roiStore.get(profileId);
            const roi = rois?.[key];
            if (!roi || roi.w <= 0 || roi.h <= 0) {
                // No ROI configured - return empty string to clear cache
                return "";
            }

            const captureCtx = (() => {
                const view = services.sessionTabs.getViewByProfile(profileId);
                if (view) {
                    const hostWin = services.sessionWindow.get();
                    const attached = !!hostWin && !hostWin.isDestroyed() && hostWin.getBrowserViews().includes(view);
                    if (!hostWin || hostWin.isDestroyed() || hostWin.isMinimized() || !hostWin.isVisible() || !attached) {
                        return null;
                    }
                    const liveBounds = view.getBounds();
                    const viewBounds = services.sessionTabs.getBounds(profileId);
                    if (liveBounds.width <= 0 || liveBounds.height <= 0 || viewBounds.width <= 0 || viewBounds.height <= 0) return null;
                    return {
                        win: hostWin,
                        width: Math.min(viewBounds.width, liveBounds.width),
                        height: Math.min(viewBounds.height, liveBounds.height),
                        offsetX: viewBounds.x,
                        offsetY: viewBounds.y,
                        grab: (rect: { x: number; y: number; width: number; height: number }) => view.webContents.capturePage(rect),
                    };
                }
                const inst = services.instances.get(profileId);
                if (inst && !inst.isDestroyed() && inst.isVisible() && !inst.isMinimized()) {
                    const bounds = inst.getBounds();
                    const content = inst.getContentBounds();
                    if (bounds.width <= 0 || bounds.height <= 0) return null;
                    return {
                        win: inst,
                        width: content.width,
                        height: content.height,
                        offsetX: 0,
                        offsetY: 0,
                        grab: (rect: { x: number; y: number; width: number; height: number }) => inst.webContents.capturePage(rect),
                    };
                }
                return null;
            })();

            if (!captureCtx || captureCtx.width <= 0 || captureCtx.height <= 0) {
                return null;
            }

            const x = Math.round(roi.x * captureCtx.width);
            const y = Math.round(roi.y * captureCtx.height);
            let width = Math.max(1, Math.round(roi.w * captureCtx.width));
            let height = Math.max(1, Math.round(roi.h * captureCtx.height));

            const isExpLike = key === "exp" || key === "rmExp";
            // Ensure minimal readable size, especially for tiny EXP-like ROIs that only cover the bar edge
            if (isExpLike) {
                const minW = 80;
                const minH = 22;
                if (width < minW) {
                    const delta = minW - width;
                    const leftPad = Math.floor(delta / 2);
                    const rightPad = delta - leftPad;
                    const newX = Math.max(0, x - leftPad);
                    const maxX = captureCtx.width;
                    const newW = Math.min(maxX - newX, width + delta);
                    width = Math.max(width, newW);
                }
                if (height < minH) {
                    const delta = minH - height;
                    const topPad = Math.floor(delta / 2);
                    const bottomPad = delta - topPad;
                    const newY = Math.max(0, y - topPad);
                    const maxY = captureCtx.height;
                    const newH = Math.min(maxY - newY, height + delta);
                    height = Math.max(height, newH);
                }
            }

            let screenshot;
            try {
                screenshot = await captureCtx.grab({ x, y, width, height });
            } catch (err) {
                logErr(err, `OCR grab primary ${key}`);
                // Fallback: capture from host window if available
                if (captureCtx.win && !captureCtx.win.isDestroyed()) {
                    const fallbackRect = {
                        x: Math.max(0, Math.round((captureCtx.offsetX ?? 0) + x)),
                        y: Math.max(0, Math.round((captureCtx.offsetY ?? 0) + y)),
                        width,
                        height,
                    };
                    try {
                        screenshot = await captureCtx.win.webContents.capturePage(fallbackRect);
                    } catch (err2) {
                        logErr(err2, `OCR grab fallback ${key}`);
                        return null;
                    }
                } else {
                    return null;
                }
            }
            // Fast-path: if the captured image is essentially blank (non-EXP), clear immediately
            if (!isExpLike && isImageNearlyUniform(screenshot)) {
                return "";
            }
            const tGrab = Date.now();
            const png = screenshot.toPNG();

            const elementHint = key === "enemyName" ? detectElement(screenshot) : null;

            // DEBUG: Save ROI screenshot (opt-in)
            if (process.env.FLYFF_OCR_SAVE_ROI === "1") {
                try {
                    const fs = await import("fs");
                    const debugPath = require("path").join(app.getAppPath(), "ocr", "debug");
                    await fs.promises.mkdir(debugPath, { recursive: true });
                    await fs.promises.writeFile(
                        require("path").join(debugPath, `roi_${key}_${Date.now()}.png`),
                        png
                    );
                } catch (_e) { /* ignore */ }
            }

            const kind = KEY_TO_OCR_KIND[key];
            const worker = await ensureOcrWorker(kind);
            const tBeforeOcr = Date.now();
            const response = await worker.recognizePng(png, { kind });
            const tAfterOcr = Date.now();
            const durGrab = tGrab - tStart;
            const durOcr = tAfterOcr - tBeforeOcr;
            const durTotal = tAfterOcr - tStart;
            if (durTotal > 500) {
                logWarn(`OCR slow (${key}) grab=${durGrab}ms ocr=${durOcr}ms total=${durTotal}ms`, "OCR");
            }

            if (!response.ok) {
                // Soft failures (no value parsed) should clear immediately to avoid stale data.
                const rawText = typeof response.raw === "string" ? response.raw.trim() : "";
                if (!response.error && rawText) {
                    return rawText;
                }
                if (!response.error || response.error === "blank_image") {
                    return elementHint ?? "";
                }
                // Worker error/timeouts: keep previous value
                return elementHint ?? null;
            }

            const raw = typeof response.raw === "string" ? response.raw.trim() : "";
            const fallback = typeof response.value === "string" ? response.value.trim() : "";
            const candidate = fallback || raw;

            if (isExpLike) {
                if (!candidate) {
                    // Nothing detected - clear value
                    return "";
                }
                if (typeof response.value === "string" && response.value.trim()) {
                    const num = Number(response.value.replace(",", "."));
                    if (Number.isFinite(num) && num >= 0 && num <= 100) {
                        return `${num.toFixed(4)}%`;
                    }
                }
                // Use raw fallback text
                return candidate;
            }

            if (key === "enemyName") {
                let lvlNum: number | null = null;
                if (typeof response.value === "string") {
                    const parsed = parseFloat(response.value.replace(/[^0-9.,]/g, "").replace(",", "."));
                    if (Number.isFinite(parsed)) {
                        lvlNum = Math.min(300, Math.max(1, Math.round(parsed)));
                    }
                }
                if (!lvlNum && raw) {
                    const parsed = parseFloat(raw.replace(/[^0-9.,]/g, "").replace(",", "."));
                    if (Number.isFinite(parsed)) {
                        lvlNum = Math.min(300, Math.max(1, Math.round(parsed)));
                    }
                }
                const parts = [];
                if (lvlNum) parts.push(`Lv${lvlNum}`);
                if (elementHint) parts.push(elementHint);
                const composite = parts.join("-");
                return composite || elementHint || "";
            }

            // Non-EXP: return text or clear
            const text = raw || fallback;
            return text || "";
        } catch (err) {
            logErr(err, `OCR scan ${key}`);
            // On error, return null to avoid overwriting valid cached data
            return null;
        }
    };

    const pendingOcrTicks = new Map<string, number>();
    // Keep only one in-flight request GLOBALLY per OCR kind to avoid queue buildup
    // (all profiles share the same Python worker per kind)
    const MAX_INFLIGHT_PER_KIND = 1;
    const ocrErrorCounts = new Map<string, number>();
    const ocrErrorThrottle = new Map<string, number>();

    const resetOcrWorker = (kind?: OcrKind) => {
        if (kind) {
            ocrWorkerPromises.delete(kind);
        } else {
            ocrWorkerPromises.clear();
        }
    };

    async function handleScheduledOcr(profileId: string, key: OcrTimerKey) {
        // Throttle per OCR kind AND profile so exp/rmExp on different profiles can run in parallel
        const globalToken = `${KEY_TO_OCR_KIND[key]}:${profileId}`;
        const inflight = pendingOcrTicks.get(globalToken) ?? 0;
        if (inflight >= MAX_INFLIGHT_PER_KIND) {
            // Already have a request in flight for this OCR kind - skip to avoid queue buildup
            ocrTimerScheduler.ack(profileId, key);
            return;
        }
        pendingOcrTicks.set(globalToken, inflight + 1);
        try {
            const timers = getOcrTimers(profileId);
            if (timers[key] <= 0) {
                return;
            }
            let result: string | null = null;
            try {
                result = await scanRoiKey(profileId, key);
            } catch (err) {
                const isTimeout = err instanceof Error && err.message.toLowerCase().includes("timeout");
                const isNotStarted = err instanceof Error && err.message.includes("Python OCR worker not started");
                const isBackoff = err instanceof Error && err.message.includes("ocr_worker_backoff");
                if (isTimeout || isNotStarted) {
                    // Reset and retry once immediately
                    resetOcrWorker(KEY_TO_OCR_KIND[key]);
                    ocrWorkerBackoff.set(KEY_TO_OCR_KIND[key], Date.now() + WORKER_BACKOFF_MS);
                    result = await scanRoiKey(profileId, key);
                } else if (isBackoff) {
                    return;
                } else {
                    throw err;
                }
            }

            // null = error/not ready, keep previous value
            // "" = OCR ran but found nothing, clear the value
            // string = valid OCR result
            if (result === null) {
                const now = Date.now();
                const cached = ocrCache.get(profileId) ?? { updatedAt: 0 };
                const age = now - (cached.updatedAt || 0);
                // If we haven't had a good read recently, clear the value to reflect the empty ROI
                if (age >= STALE_CLEAR_MS) {
                    (cached as Record<string, unknown>)[key] = "";
                    if (key === "enemyName") {
                        (cached as Record<string, unknown>).monsterName = "";
                    }
                    cached.updatedAt = now;
                    ocrCache.set(profileId, cached);
                    const snapshot = getEffectiveOcrSnapshot(profileId);
                    if (snapshot) {
                        const effectiveValue = getEffectiveOcrValue(profileId, key, "");
                        pluginEventBus.emit("ocr:update", {
                            profileId,
                            key,
                            value: effectiveValue ?? "",
                            values: snapshot,
                        }, "core");
                        if (key === "exp") {
                            const payload = { profileId, value: "", updatedAt: cached.updatedAt };
                            for (const win of BrowserWindow.getAllWindows()) {
                                try {
                                    win.webContents.send("exp:update", payload);
                                } catch (err) {
                                    logErr(err, "OCR IPC");
                                }
                            }
                            pluginEventBus.emit("exp:update", payload, "core");
                        }
                    }
                } else {
                    // Track consecutive errors; if they continue past the stale window, we will clear.
                    const errKey = `${profileId}:${key}`;
                    const nextErr = (ocrErrorCounts.get(errKey) ?? 0) + 1;
                    ocrErrorCounts.set(errKey, nextErr);
                }
                return;
            }

            // reset error counter on success/clear
            ocrErrorCounts.set(`${profileId}:${key}`, 0);

            applyOcrResult(profileId, key, result);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const now = Date.now();
            const token = msg.includes("Python OCR worker not started")
                ? "worker:not_started"
                : msg.includes("ocr_worker_backoff")
                    ? "worker:backoff"
                    : `other:${key}`;
            const lastLog = ocrErrorThrottle.get(token) ?? 0;
            if (now - lastLog > 3000) {
                ocrErrorThrottle.set(token, now);
                logErr(err, `OCR scheduled scan ${key}`);
            }
        } finally {
            const current = pendingOcrTicks.get(globalToken) ?? 1;
            if (current <= 1) {
                pendingOcrTicks.delete(globalToken);
            } else {
                pendingOcrTicks.set(globalToken, current - 1);
            }
            ocrTimerScheduler.ack(profileId, key);
        }
    }

    ipcMain.handle("roi:debug:save", async (_event, arg: unknown) => {
        try {
            const obj = arg && typeof arg === "object" ? arg as Record<string, unknown> : {};
            const profileId = typeof obj.profileId === "string" ? obj.profileId : null;
            const key = typeof obj.key === "string" ? obj.key as OcrTimerKey : null;
            if (!profileId) throw new Error("profileId fehlt");
            if (!key || !OCR_KEYS.includes(key)) throw new Error("ungültiger key");
            const filePath = await debugSaveRoi(profileId, key);
            return { ok: true, data: filePath };
        } catch (err) {
            logErr(err, "ROI Debug Save");
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
    });

    let ocrTimerScheduler: OcrTimerScheduler | null = null;
    const primedProfiles = new Set<string>();

    const restartOcrScheduler = () => {
        if (ocrTimerScheduler) {
            void ocrTimerScheduler.stop().catch((err) => logErr(err, "OCR Timer Scheduler stop"));
            ocrTimerScheduler = null;
        }
        ocrTimerScheduler = new OcrTimerScheduler(handleScheduledOcr, (err) => {
            logErr(err, "OCR Timer Scheduler");
            // Recreate on crash and reschedule all known profiles
            restartOcrScheduler();
            for (const [profileId] of ocrTimers.entries()) {
                scheduleTimersForProfile(profileId);
            }
        });
    };

    restartOcrScheduler();

    scheduleTimersForProfile = (profileId: string) => {
        if (!ocrTimerScheduler) {
            restartOcrScheduler();
        }
        ocrTimerScheduler?.update(profileId, getOcrTimers(profileId));
        // Run an immediate scan once per profile so first values appear without waiting for the timer delay
        if (!primedProfiles.has(profileId)) {
            primedProfiles.add(profileId);
            for (const key of OCR_KEYS) {
                void handleScheduledOcr(profileId, key);
            }
        }
    };

    const emitOcrUpdate = (
        profileId: string,
        key: OcrTimerKey,
        value: string,
        snapshot: ReturnType<typeof getEffectiveOcrSnapshot>,
        meta?: Record<string, unknown>
    ) => {
        if (!snapshot) return;
        const payload: Record<string, unknown> = {
            profileId,
            key,
            value,
            values: snapshot,
        };
        if (meta && Object.keys(meta).length > 0) {
            payload.meta = meta;
        }
        pluginEventBus.emit("ocr:update", payload, "core");

        if (key === "exp") {
            const expPayload: Record<string, unknown> = {
                profileId,
                value,
                updatedAt: snapshot.updatedAt,
            };
            if (meta && Object.keys(meta).length > 0) {
                expPayload.meta = meta;
            }
            for (const win of BrowserWindow.getAllWindows()) {
                try {
                    win.webContents.send("exp:update", expPayload);
                } catch (err) {
                    logErr(err, "OCR IPC");
                }
            }
            pluginEventBus.emit("exp:update", expPayload, "core");
        }
    };

    const applyOcrResult = (profileId: string, key: OcrTimerKey, result: string) => {
        const cached = ocrCache.get(profileId) ?? { updatedAt: 0 };
        const prevValue = (cached as Record<string, unknown>)[key];
        const now = Date.now();
        let shouldUpdate = true;
        const lastEnemyLog = (applyOcrResult as unknown as { _enemyLog?: Map<string, number> })._enemyLog
            || new Map<string, number>();
        (applyOcrResult as unknown as { _enemyLog?: Map<string, number> })._enemyLog = lastEnemyLog;

        const isExpLike = key === "exp" || key === "rmExp";
        // EXP plausibility guard: allow normal movement, only reject extreme spikes
        if (isExpLike && result !== "" && typeof result === "string") {
            if (typeof prevValue === "string" && prevValue !== "") {
                const prevVal = parseFloat(prevValue.replace(/[^0-9.,]/g, "").replace(",", "."));
                const newVal = parseFloat(result.replace(/[^0-9.,]/g, "").replace(",", "."));
                if (!isNaN(prevVal) && !isNaN(newVal)) {
                    const drop = prevVal - newVal;
                    const rise = newVal - prevVal;
                    const lastLvlChange = lastLevelChangeAt.get(profileId) ?? 0;
                    const isLevelUpDrop = drop >= EXP_LEVELUP_DROP_MIN && newVal <= EXP_LEVELUP_RESET_THRESHOLD && prevVal >= EXP_LEVELUP_DROP_MIN;
                    const allowDrop = (lastLvlChange > 0 && (now - lastLvlChange) <= EXP_LEVEL_DROP_GRACE_MS) || isLevelUpDrop;

                    if (!allowDrop && drop > EXP_MAX_DROP_PER_TICK) {
                        shouldUpdate = false;
                    }
                    // If we were in 90-99% range, ignore a sudden drop into 80-89% (common OCR mixup of 9x -> 8x)
                    if (key === "exp" && prevVal >= 90 && prevVal < 100 && newVal >= 80 && newVal < 90) {
                        shouldUpdate = false;
                    }
                    // Reject only very large spikes that are clearly impossible in one tick
                    if (rise > 20 || (!allowDrop && drop > 60)) {
                        shouldUpdate = false;
                    }
                }
            }
        }

        if (shouldUpdate) {
            if (key === "exp") {
                handleExpLevelUp(profileId, prevValue, result, now);
            }
            (cached as Record<string, unknown>)[key] = result;
            if (key === "lvl") {
                const prevLvlNum = typeof prevValue === "string"
                    ? parseFloat(prevValue.replace(/[^0-9.,]/g, "").replace(",", "."))
                    : NaN;
                const nextLvlNum = parseFloat(result.replace(/[^0-9.,]/g, "").replace(",", "."));
                if (!isNaN(nextLvlNum) && (isNaN(prevLvlNum) || nextLvlNum !== prevLvlNum)) {
                    lastLevelChangeAt.set(profileId, now);
                }
            }
            if (key === "enemyName") {
                const parsed = typeof result === "string" ? parseLevelElement(result) : { level: null, element: null };
                const prevMeta = lastEnemyMeta.get(profileId) ?? { level: null, element: null, updatedAt: 0 };
                let nextResult = result;
                if (!parsed.level && prevMeta.level) {
                    const el = parsed.element ?? prevMeta.element;
                    const parts = [`Lv${prevMeta.level}`];
                    if (el) parts.push(el);
                    nextResult = parts.join("-");
                }
                if (typeof nextResult === "string" && nextResult !== result) {
                    (cached as Record<string, unknown>)[key] = nextResult;
                    result = nextResult;
                }
                lastEnemyMeta.set(profileId, {
                    level: parsed.level ?? prevMeta.level ?? null,
                    element: parsed.element ?? prevMeta.element ?? null,
                    updatedAt: now,
                });
                (cached as Record<string, unknown>).monsterName = result;
                const token = `${profileId}:${result || ""}`;
                const last = lastEnemyLog.get(token) ?? 0;
                if (result && now - last > 3000) {
                    logWarn(`Enemy erkannt: ${result}`, "OCR");
                    lastEnemyLog.set(token, now);
                }
            }
            cached.updatedAt = now;
            ocrCache.set(profileId, cached);

            // Broadcast OCR update to plugins via the global event bus
            const snapshot = getEffectiveOcrSnapshot(profileId);
            if (snapshot) {
                const effectiveValue = getEffectiveOcrValue(profileId, key, result);
                emitOcrUpdate(profileId, key, effectiveValue ?? result, snapshot);
            }
        }
    };

    const runImmediateOcr = async (profileId: string) => {
        const timers = getOcrTimers(profileId);
        for (const key of OCR_KEYS) {
            if ((timers as Record<string, number>)[key] <= 0) continue;
            try {
                const result = await scanRoiKey(profileId, key);
                if (result === null) continue;
                applyOcrResult(profileId, key, result);
            } catch (err) {
                logErr(err, `OCR immediate scan ${key}`);
            }
        }
    };

    app.on("will-quit", () => {
        void ocrTimerScheduler.stop().catch((err) => logErr(err, "OCR Timer Scheduler"));
        releaseAllOcrWorkers().catch((err) => logErr(err, "OCR"));
    });

    // Register OCR handlers
    safeHandle("ocr:getLatest", async (_e: unknown, arg: unknown) => {
        const profileId = typeof arg === "string" ? arg : null;
        if (!profileId) return null;

        const maybeRefresh = async () => {
            try {
                await runImmediateOcr(profileId);
            } catch (err) {
                logErr(err, "OCR on-demand refresh");
            }
        };

        const cached = getEffectiveOcrSnapshot(profileId);
        const now = Date.now();
        const isStale = !cached || (now - (cached.updatedAt || 0) > 1200);
        if (isStale) {
            await maybeRefresh();
        }
        const next = getEffectiveOcrSnapshot(profileId);
        if (next) {
            return {
                lvl: next.lvl,
                exp: next.exp,
                rmExp: next.rmExp,
                charname: next.charname,
                lauftext: next.lauftext,
                enemyName: next.enemyName,
                enemyHp: next.enemyHp,
                monsterName: next.monsterName,
                updatedAt: next.updatedAt,
            };
        }
        return null;
    });

    safeHandle("ocr:getTimers", async (_e: unknown, arg: unknown) => {
        const profileId = typeof arg === "string" ? arg : null;
        if (!profileId) return getDefaultOcrTimers();
        return getOcrTimers(profileId);
    });

    safeHandle("ocr:setTimer", async (_e: unknown, arg: unknown) => {
        const obj = arg && typeof arg === "object" ? (arg as Record<string, unknown>) : null;
        const profileId = obj?.profileId as string | undefined;
        const key = obj?.key as OcrTimerKey | undefined;
        const ms = typeof obj?.ms === "number" ? obj.ms : undefined;

        if (!profileId || !key || !OCR_KEYS.includes(key) || ms === undefined) return false;

        const patch: Partial<OcrTimerSettings> = {};
        patch[key] = ms;

        try {
            const stored = await persistOcrTimerSettings(profileId, patch);
            if (stored) {
                ocrTimers.set(profileId, {
                    lvl: stored.lvl,
                    exp: stored.exp,
                    charname: stored.charname,
                    lauftext: stored.lauftext,
                    rmExp: stored.rmExp,
                });
            } else {
                ocrTimers.delete(profileId);
            }
        } catch (err) {
            logErr(err, "OCR Timer");
            return false;
        }

        scheduleTimersForProfile(profileId);
        return true;
    });

    safeHandle("ocr:manualLevel:get", async (_e: unknown, arg: unknown) => {
        const profileId = typeof arg === "string" ? arg : null;
        if (!profileId) return null;
        const entry = getManualLevelOverride(profileId);
        if (!entry) return null;
        return { value: entry.value, enabled: entry.enabled, updatedAt: entry.updatedAt };
    });

    safeHandle("ocr:manualLevel:set", async (_e: unknown, arg: unknown) => {
        const obj = arg && typeof arg === "object" ? (arg as Record<string, unknown>) : null;
        const profileIdRaw = typeof obj?.profileId === "string" ? obj.profileId : null;
        const profileId = profileIdRaw?.trim() ?? "";
        if (!profileId) return false;
        const patch: Partial<Pick<ManualLevelOverrideRow, "value" | "enabled">> = {};
        if (obj && "value" in obj) patch.value = clampManualLevel(obj?.value);
        if (typeof obj?.enabled === "boolean") patch.enabled = obj.enabled;
        const updated = await saveManualLevelOverride(profileId, patch);
        if (!updated) return false;

        const cached = ocrCache.get(profileId) ?? { updatedAt: 0 };
        cached.updatedAt = Math.max(cached.updatedAt || 0, updated.updatedAt ?? Date.now());
        ocrCache.set(profileId, cached);

        broadcastManualLevelOverride(profileId);

        // When manual override is disabled, kick off an immediate OCR read to refresh quickly.
        if (patch.enabled === false || updated.enabled === false) {
            void runImmediateOcr(profileId).catch((err) => logErr(err, "OCR manual level refresh"));
        }

        return true;
    });

    safeHandle("ocr:manualExp:set", async (_e: unknown, arg: unknown) => {
        const obj = arg && typeof arg === "object" ? (arg as Record<string, unknown>) : null;
        const profileIdRaw = typeof obj?.profileId === "string" ? obj.profileId : null;
        const profileId = profileIdRaw?.trim() ?? "";
        if (!profileId) return false;
        const parsed = clampExpPercent(obj?.value ?? obj?.exp ?? null);
        if (parsed === null) return false;
        const formatted = `${parsed.toFixed(4)}%`;

        const cached = ocrCache.get(profileId) ?? { updatedAt: 0 };
        const prevExp = (cached as Record<string, unknown>).exp;
        const now = Date.now();
        handleExpLevelUp(profileId, prevExp, formatted, now);
        (cached as Record<string, unknown>).exp = formatted;
        cached.updatedAt = now;
        ocrCache.set(profileId, cached);

        const snapshot = getEffectiveOcrSnapshot(profileId);
        if (snapshot) {
            emitOcrUpdate(profileId, "exp", formatted, snapshot, { manualExp: true });
        }

        return true;
    });

    safeHandle("ocr:update", async (_e: unknown, arg: unknown) => {
        const obj = arg && typeof arg === "object" ? (arg as Record<string, unknown>) : null;
        const profileId = obj?.profileId as string | undefined;
        if (!profileId) return false;
        ocrCache.set(profileId, {
            lvl: typeof obj?.lvl === "string" ? obj.lvl : undefined,
            exp: typeof obj?.exp === "string" ? obj.exp : undefined,
            rmExp: typeof obj?.rmExp === "string" ? obj.rmExp : undefined,
            charname: typeof obj?.charname === "string" ? obj.charname : undefined,
            lauftext: typeof obj?.lauftext === "string" ? obj.lauftext : undefined,
            enemyName: typeof obj?.enemyName === "string" ? obj.enemyName : undefined,
            enemyHp: typeof obj?.enemyHp === "string" ? obj.enemyHp : undefined,
            monsterName: typeof obj?.monsterName === "string" ? obj.monsterName : undefined,
            updatedAt: Date.now(),
        });
        return true;
    });

    await loadManualLevelOverridesIntoMemory();
    const persistedTimers = await loadAllOcrTimers();
    for (const row of persistedTimers) {
        const timers: OcrTimerSettings = {
            lvl: row.lvl,
            exp: row.exp,
            charname: row.charname,
            lauftext: row.lauftext,
            rmExp: row.rmExp,
            enemyName: row.enemyName,
            enemyHp: row.enemyHp,
        };
        ocrTimers.set(row.profileId, timers);
        scheduleTimersForProfile(row.profileId);
    }

    // Start all enabled plugins
    let pluginsStarted = false;
    try {
        await pluginHost.startAll();
        const loadedIds = pluginHost.getLoadedPluginIds();
        logWarn(`Plugins started: ${loadedIds.join(", ") || "none"}`, "Main");
        pluginsStarted = true;
    } catch (err) {
        logErr(err, "PluginHost");
    }
    if (pluginsStarted) {
        manualLevelOverrides.forEach((entry, profileId) => {
            if (!entry.enabled) return;
            const cached = ocrCache.get(profileId) ?? { updatedAt: entry.updatedAt ?? Date.now() };
            cached.updatedAt = Math.max(cached.updatedAt || 0, entry.updatedAt ?? Date.now());
            ocrCache.set(profileId, cached);
            broadcastManualLevelOverride(profileId);
        });
    }

    // Start overlay sync now that all plugin IPC handlers are registered
    ensureRoiOverlay();
    ensureRoiSupportOverlay();
    const originalEnsure = services.sessionWindow.ensure.bind(services.sessionWindow);
    services.sessionWindow.ensure = async () => {
        const win = await originalEnsure();
        ensureRoiOverlay();
        ensureRoiSupportOverlay();
        return win;
    };

    // Create launcher window
    launcherWindow = services.createLauncherWindow({
        preloadPath,
        loadView,
        onClosed: () => (launcherWindow = null),
    });

    // macOS: Re-create window when dock icon is clicked
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            launcherWindow = services.createLauncherWindow({
                preloadPath,
                loadView,
                onClosed: () => (launcherWindow = null),
            });
        }
    });

    // =========================================================================
    // Auto-Update (only in Production)
    // =========================================================================
    if (app.isPackaged) {
        const t = (key: TranslationKey, replacements?: Record<string, string>): string => {
            let text = translations[clientLocale]?.[key] ?? translations.en[key] ?? key;
            if (replacements) {
                for (const [k, v] of Object.entries(replacements)) {
                    text = text.replace(`{${k}}`, v);
                }
            }
            return text;
        };

        const feedConfig = {
            provider: "github",
            owner: "GH-Praxa",
            repo: "Flyff-U-Launcher",
        };
        if (process.env.GH_TOKEN) {
            // Allows private repo updates without baking a token into the app
            (feedConfig as Record<string, string>).token = process.env.GH_TOKEN;
        }
        autoUpdater.setFeedURL(feedConfig);

        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.disableDifferentialDownload = true; // our artifacts do not ship blockmaps

        autoUpdater.on("update-available", async (info) => {
            const result = await dialog.showMessageBox({
                type: "info",
                title: t("update.available.title"),
                message: t("update.available.message", { version: info.version }),
                detail: t("update.available.detail"),
                buttons: [t("update.available.yes"), t("update.later")],
                defaultId: 0,
                cancelId: 1,
            });

            if (result.response === 0) {
                await dialog.showMessageBox({
                    type: "info",
                    title: t("update.available.title"),
                    message: t("update.available.detail"),
                    detail: t("update.ready.detail"),
                    buttons: [t("update.later")],
                    defaultId: 0,
                });
                autoUpdater
                    .downloadUpdate()
                    .catch((err) => {
                        logErr(err, "AutoUpdater");
                        dialog.showErrorBox(t("update.error.title"), `${t("update.error.detail")} (${String(err)})`);
                    });
            }
        });

        autoUpdater.on("download-progress", (progress) => {
            const percent = Math.round(progress.percent);
            logWarn(`Download progress: ${percent}%`, "AutoUpdater");
        });

        autoUpdater.on("update-downloaded", async () => {
            const result = await dialog.showMessageBox({
                type: "info",
                title: t("update.ready.title"),
                message: t("update.ready.message"),
                detail: t("update.ready.detail"),
                buttons: [t("update.ready.restart"), t("update.later")],
                defaultId: 0,
                cancelId: 1,
            });

            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });

        autoUpdater.on("error", (err) => {
            logErr(err, "AutoUpdater");
        });

        // Check for updates on startup
        autoUpdater.checkForUpdates().catch((err) => {
            logErr(err, "AutoUpdater");
        });
    }
});

// ============================================================================
// App Lifecycle
// ============================================================================

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
});

app.on("before-quit", async () => {
    // Stop side panel button follow loop
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
    // Allow session window to close without prompt
    sessionWindowController?.allowCloseWithoutPrompt();

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

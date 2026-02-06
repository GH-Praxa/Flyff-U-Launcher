/**
 * Main Entry Point (Unified with Plugin System)
 *
 * Core functionality with integrated plugin system.
 * EXP-Tracker, Questlog, Buff-Wecker are loaded as plugins from userData/plugins/
 */

import { app, BrowserWindow, session, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import squirrelStartup from "electron-squirrel-startup";

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
import { URLS, TIMINGS } from "./shared/constants";
import { createSidePanelButtonController } from "./main/windows/sidePanelButtonController";
import { createSidePanelWindow } from "./main/windows/sidePanelWindow";
import { createRoiVisibilityStore } from "./main/roi/roiVisibilityStore";
import { createOverlayWindow } from "./main/windows/overlayWindow";
import { acquireSharedOcrWorker, releaseSharedOcrWorker } from "./main/ocr/workerPool";
import { OcrTimerScheduler } from "./main/ocr/timerScheduler";
import type { OcrKind, PythonOcrWorker } from "./main/ocr/pythonWorker";
import {
    getDefaultOcrTimers,
    loadAllOcrTimers,
    persistOcrTimerSettings,
    OCR_TIMER_KEYS,
    type OcrTimerKey,
    type OcrTimerSettings,
} from "./main/ocr/timerStore";

// Vite declarations
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Handle Squirrel startup (Windows installer)
if (squirrelStartup) {
    app.quit();
}

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

// Track overlay visibility state for focus management
let overlaysWereVisible = {
    roiOverlay: false,
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
            if (fs.existsSync(to)) continue; // Preserve existing user plugins
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
    const pluginsDir = path.join(app.getPath("userData"), "plugins");
    const launcherVersion = app.getVersion();

    // Prepare bundled assets (Tesseract, default plugins)
    configureBundledTesseract();
    await copyDefaultPlugins(pluginsDir);

    console.log("userData:", app.getPath("userData"));
    console.log("pluginsDir:", pluginsDir);

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

    // Reset all ROI visibility to false on startup
    (async () => {
        try {
            const allProfiles = await services.profiles.list();
            for (const profile of allProfiles) {
                await roiVisibilityStore.set(profile.id, { lvl: false, charname: false, exp: false, lauftext: false });
            }
        } catch (err) {
            logErr(err, "ROI Visibility Reset");
        }
    })();

    sessionWindowController = services.sessionWindow;
    sidePanelButton = createSidePanelButtonController({
        sessionWindow: services.sessionWindow,
        sessionTabs: services.sessionTabs,
        profiles: services.profiles,
        preloadPath,
    });
    await sidePanelButton.start();

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
        // Sidepanel Button
        if (sidePanelButton && overlaysWereVisible.sidePanelButton) {
            sidePanelButton.show();
        }
        // Sidepanel
        if (sidePanelWindow && !sidePanelWindow.isDestroyed() && overlaysWereVisible.sidePanel) {
            sidePanelWindow.show();
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
        if (!sidePanelWindow.isVisible()) return;

        const overlayTargetId = sidePanelButton?.getActiveProfileId?.()
            ?? (await services.profiles.getOverlayTargetId())
            ?? services.sessionTabs.getActiveId();

        const content = parent.getContentBounds();
        const hasActiveTarget = Boolean(overlayTargetId && services.sessionTabs.isActive(overlayTargetId));
        const viewBounds = hasActiveTarget
            ? services.sessionTabs.getBounds(overlayTargetId!)
            : {
                x: 0,
                y: 0,
                width: Math.max(320, content.width),
                height: Math.max(240, content.height),
            };

        const margin = 12;
        const hostX = content.x + viewBounds.x;
        const hostY = content.y + viewBounds.y;
        const currentBounds = sidePanelWindow.getBounds();

        // Keep current width if user resized, but clamp to view bounds
        const availableWidth = Math.max(120, viewBounds.width - margin * 2);
        const minAllowedWidth = Math.min(260, availableWidth);
        const maxWidth = Math.min(420, availableWidth);
        const finalWidth = Math.min(Math.max(currentBounds.width, minAllowedWidth), maxWidth);

        // Height should fill the view bounds
        const availableHeight = Math.max(180, viewBounds.height - margin * 2);
        const minAllowedHeight = Math.min(360, availableHeight);
        const height = Math.max(minAllowedHeight, Math.min(720, availableHeight));
        const finalHeight = Math.min(height, Math.max(140, viewBounds.height - margin));

        // Position at right edge of view bounds
        const x = hostX + Math.max(0, viewBounds.width - finalWidth - margin);
        const y = hostY + margin;

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
            sidePanelWindow = createSidePanelWindow(parent, { preloadPath });
            sidePanelWindow.on("show", () => { void sidePanelButton?.stop(); });
            sidePanelWindow.on("hide", () => {
                void sidePanelButton?.start();
                // Stop sync when hidden
                if (sidePanelSyncInterval) {
                    clearInterval(sidePanelSyncInterval);
                    sidePanelSyncInterval = null;
                }
            });
            sidePanelWindow.on("closed", () => {
                sidePanelWindow = null;
                void sidePanelButton?.start();
                // Clean up sync interval
                if (sidePanelSyncInterval) {
                    clearInterval(sidePanelSyncInterval);
                    sidePanelSyncInterval = null;
                }
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
                ?? (await services.profiles.getOverlayTargetId())
                ?? services.sessionTabs.getActiveId();
        const content = parent.getContentBounds();
        const hasActiveTarget = Boolean(overlayTargetId && services.sessionTabs.isActive(overlayTargetId));
        const viewBounds = hasActiveTarget
            ? services.sessionTabs.getBounds(overlayTargetId!)
            : {
                x: 0,
                y: 0,
                width: Math.max(320, content.width),
                height: Math.max(240, content.height),
            };
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
            panel.hide();
            await sidePanelButton?.start();
            // Stop sync when hidden
            if (sidePanelSyncInterval) {
                clearInterval(sidePanelSyncInterval);
                sidePanelSyncInterval = null;
            }
        }
    };

    ipcMain.on("sidepanel:toggle", (_e, payload) => {
        void toggleSidePanel(payload as { focusTab?: string; profileId?: string });
    });

    // ROI Overlay - shows calibrated ROI boxes over the active tab
    let roiOverlaySyncInterval: NodeJS.Timeout | null = null;
    const ensureRoiOverlay = () => {
        const parent = services.sessionWindow.get();
        if (!parent || parent.isDestroyed()) return null;

        if (!roiOverlayWindow || roiOverlayWindow.isDestroyed()) {
            roiOverlayWindow = createOverlayWindow(parent, { preloadPath });

            // Sync overlay bounds with active tab
            const syncBounds = async () => {
                if (!parent || parent.isDestroyed()) return;
                if (!roiOverlayWindow || roiOverlayWindow.isDestroyed()) return;

                const profileId = await services.profiles.getOverlayTargetId();
                if (!profileId) {
                    roiOverlayWindow.hide();
                    return;
                }
                // Ensure OCR timers are scheduled for the active overlay target
                scheduleTimersForProfile(profileId);

                const contentBounds = parent.getContentBounds();
                const viewBounds = services.sessionTabs.getBounds(profileId);

                // Position overlay over the tab view
                roiOverlayWindow.setBounds({
                    x: contentBounds.x + viewBounds.x,
                    y: contentBounds.y + viewBounds.y,
                    width: viewBounds.width,
                    height: viewBounds.height,
                });
                roiOverlayWindow.show();
            };

            // Named handlers for proper cleanup
            const onMove = () => syncBounds();
            const onResize = () => syncBounds();
            const onClose = () => {
                // Clean up interval
                if (roiOverlaySyncInterval) {
                    clearInterval(roiOverlaySyncInterval);
                    roiOverlaySyncInterval = null;
                }
                // Remove parent listeners
                parent.off("move", onMove);
                parent.off("resize", onResize);
                // Destroy overlay window
                if (roiOverlayWindow && !roiOverlayWindow.isDestroyed()) {
                    roiOverlayWindow.destroy();
                    roiOverlayWindow = null;
                }
            };

            parent.on("move", onMove);
            parent.on("resize", onResize);
            parent.on("close", onClose);

            // Clean up when overlay window itself is closed
            roiOverlayWindow.on("closed", () => {
                if (roiOverlaySyncInterval) {
                    clearInterval(roiOverlaySyncInterval);
                    roiOverlaySyncInterval = null;
                }
                parent.off("move", onMove);
                parent.off("resize", onResize);
                parent.off("close", onClose);
            });

            // Sync periodically to follow tab switches (store interval for cleanup)
            roiOverlaySyncInterval = setInterval(() => syncBounds(), 500);
            syncBounds();
        }
        return roiOverlayWindow;
    };

    // Create overlay when session window is accessed
    const originalEnsure = services.sessionWindow.ensure.bind(services.sessionWindow);
    services.sessionWindow.ensure = async () => {
        const win = await originalEnsure();
        ensureRoiOverlay();
        return win;
    };

    // Create service registry for plugins
    const pythonExe = process.env.FLYFF_OCR_PYTHON ?? "python";
    let ocrWorkerPromise: Promise<PythonOcrWorker> | null = null;

    async function ensureOcrWorker(): Promise<PythonOcrWorker> {
        if (!ocrWorkerPromise) {
            ocrWorkerPromise = acquireSharedOcrWorker(pythonExe);
        }
        try {
            return await ocrWorkerPromise;
        } catch (err) {
            ocrWorkerPromise = null;
            throw err;
        }
    }
    const serviceRegistry = createServiceRegistry({
        core: services,
        pythonExe,
    });

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
    const ocrCache = new Map<string, { lvl?: string; exp?: string; charname?: string; lauftext?: string; updatedAt: number }>();
    const ocrTimers = new Map<string, OcrTimerSettings>();
    const OCR_KEYS = OCR_TIMER_KEYS;
    const KEY_TO_OCR_KIND: Record<OcrTimerKey, OcrKind> = {
        lvl: "lvl",
        exp: "exp",
        charname: "charname",
        lauftext: "lauftext",
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

    const scanRoiKey = async (profileId: string, key: OcrTimerKey) => {
        try {
            const rois = await services.roiStore.get(profileId);
            const roi = rois?.[key];
            if (!roi || roi.w <= 0 || roi.h <= 0) return null;

            const view = services.sessionTabs.getViewByProfile(profileId);
            if (!view) return null;

            const viewBounds = services.sessionTabs.getBounds(profileId);
            if (viewBounds.width <= 0 || viewBounds.height <= 0) return null;

            const x = Math.round(roi.x * viewBounds.width);
            const y = Math.round(roi.y * viewBounds.height);
            const width = Math.max(1, Math.round(roi.w * viewBounds.width));
            const height = Math.max(1, Math.round(roi.h * viewBounds.height));

            const screenshot = await view.webContents.capturePage({ x, y, width, height });
            const png = screenshot.toPNG();

            const worker = await ensureOcrWorker();
            const kind = KEY_TO_OCR_KIND[key];
            const response = await worker.recognizePng(png, { kind });

            if (!response.ok) {
                return null;
            }

            const raw = typeof response.raw === "string" ? response.raw.trim() : "";
            const fallback = typeof response.value === "string" ? response.value.trim() : "";

            if (key === "exp") {
                if (typeof response.value === "string") {
                    const num = Number(response.value.replace(",", "."));
                    if (Number.isFinite(num)) {
                        return `${num.toFixed(4)}%`;
                    }
                }
                return raw || fallback || null;
            }

            return raw || fallback || null;
        } catch (err) {
            logErr(err, `OCR scan ${key}`);
            return null;
        }
    };

    const pendingOcrTicks = new Map<string, number>();
    const MAX_INFLIGHT_PER_KEY = 2;

    async function handleScheduledOcr(profileId: string, key: OcrTimerKey) {
        const token = `${profileId}:${key}`;
        const inflight = pendingOcrTicks.get(token) ?? 0;
        if (inflight >= MAX_INFLIGHT_PER_KEY) {
            return;
        }
        pendingOcrTicks.set(token, inflight + 1);
        try {
            const timers = getOcrTimers(profileId);
            if (timers[key] <= 0) {
                return;
            }
            const result = await scanRoiKey(profileId, key);
            if (result !== null) {
                const cached = ocrCache.get(profileId) ?? { updatedAt: 0 };
                let shouldUpdate = true;

                // EXP stabilization: reject suspicious drops (4-50%) as OCR errors
                // Large drops (>50%) are allowed as they indicate level-up (e.g., 99% -> 0.5%)
                if (key === "exp" && typeof result === "string") {
                    const prevExp = cached.exp;
                    if (typeof prevExp === "string") {
                        const prevVal = parseFloat(prevExp.replace(/[^0-9.,]/g, "").replace(",", "."));
                        const newVal = parseFloat(result.replace(/[^0-9.,]/g, "").replace(",", "."));
                        if (!isNaN(prevVal) && !isNaN(newVal)) {
                            const drop = prevVal - newVal;
                            const rise = newVal - prevVal;
                            // Reject drops between 4% and 50% (likely OCR error)
                            // Allow drops > 50% (level-up) or increases (normal XP gain)
                            if (drop > 4 && drop < 50) {
                                shouldUpdate = false;
                            }
                            // Reject rises > 8% in one tick (XP gains are small; big jumps are usually OCR errors)
                            if (rise > 8) {
                                shouldUpdate = false;
                            }
                        }
                    }
                }

                if (shouldUpdate) {
                    (cached as Record<string, unknown>)[key] = result;
                    cached.updatedAt = Date.now();
                    ocrCache.set(profileId, cached);

                    // Broadcast OCR update to plugins via the global event bus
                    const snapshot = ocrCache.get(profileId);
                    if (snapshot) {
                        pluginEventBus.emit("ocr:update", {
                            profileId,
                            key,
                            value: result,
                            values: snapshot,
                        }, "core");
                    }
                }
            }
        } catch (err) {
            logErr(err, `OCR scheduled scan ${key}`);
        } finally {
            const current = pendingOcrTicks.get(token) ?? 1;
            if (current <= 1) {
                pendingOcrTicks.delete(token);
            } else {
                pendingOcrTicks.set(token, current - 1);
            }
            ocrTimerScheduler.ack(profileId, key);
        }
    }

    const ocrTimerScheduler = new OcrTimerScheduler(handleScheduledOcr, (err) => logErr(err, "OCR Timer Scheduler"));
    const scheduleTimersForProfile = (profileId: string) => {
        ocrTimerScheduler.update(profileId, getOcrTimers(profileId));
    };

    app.on("will-quit", () => {
        void ocrTimerScheduler.stop().catch((err) => logErr(err, "OCR Timer Scheduler"));
        if (ocrWorkerPromise) {
            releaseSharedOcrWorker().catch((err) => logErr(err, "OCR"));
        }
    });

    // Register OCR handlers
    safeHandle("ocr:getLatest", async (_e: unknown, arg: unknown) => {
        const profileId = typeof arg === "string" ? arg : null;
        if (!profileId) return null;
        const cached = ocrCache.get(profileId);
        if (cached) {
            return { lvl: cached.lvl, exp: cached.exp, charname: cached.charname, lauftext: cached.lauftext };
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

    safeHandle("ocr:update", async (_e: unknown, arg: unknown) => {
        const obj = arg && typeof arg === "object" ? (arg as Record<string, unknown>) : null;
        const profileId = obj?.profileId as string | undefined;
        if (!profileId) return false;
        ocrCache.set(profileId, {
            lvl: typeof obj?.lvl === "string" ? obj.lvl : undefined,
            exp: typeof obj?.exp === "string" ? obj.exp : undefined,
            charname: typeof obj?.charname === "string" ? obj.charname : undefined,
            lauftext: typeof obj?.lauftext === "string" ? obj.lauftext : undefined,
            updatedAt: Date.now(),
        });
        return true;
    });

    const persistedTimers = await loadAllOcrTimers();
    for (const row of persistedTimers) {
        const timers: OcrTimerSettings = {
            lvl: row.lvl,
            exp: row.exp,
            charname: row.charname,
            lauftext: row.lauftext,
        };
        ocrTimers.set(row.profileId, timers);
        scheduleTimersForProfile(row.profileId);
    }

    // Start all enabled plugins
    try {
        await pluginHost.startAll();
        const loadedIds = pluginHost.getLoadedPluginIds();
        logWarn(`Plugins started: ${loadedIds.join(", ") || "none"}`, "Main");
    } catch (err) {
        logErr(err, "PluginHost");
    }

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
});

// ============================================================================
// App Lifecycle
// ============================================================================

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

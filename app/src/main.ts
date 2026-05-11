/**
 * Main Entry Point (Unified with Plugin System)
 *
 * Core functionality with integrated plugin system.
 * EXP-Tracker, Questlog, Buff-Wecker are loaded as plugins from userData/plugins/
 */

import { app, BrowserWindow, Menu, session, ipcMain, globalShortcut, screen, webContents } from "electron";
import path from "path";
import { execSync } from "child_process";
import squirrelStartup from "electron-squirrel-startup";

// Handle Squirrel startup (Windows installer)
if (squirrelStartup) {
    app.quit();
}

// Fix Windows registry version display after Squirrel updates
if (process.platform === "win32" && app.isPackaged) {
    try {
        const appVersion = app.getVersion();
        const regKey = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\FlyffULauncher";
        execSync(`reg add "${regKey}" /v DisplayVersion /t REG_SZ /d "${appVersion}" /f`, { stdio: "ignore" });
    } catch {
        // Ignore registry update errors
    }
}

// Fix Windows DWM flicker/ghost window issue
if (process.platform === "win32") {
    app.commandLine.appendSwitch("disable-direct-composition");
}

// Suppress noisy GLib/GTK g_object_ref/unref assertions from Chromium on Linux.
// These are harmless Chromium-internal warnings triggered by GTK theme interactions.
if (process.platform === "linux") {
    app.commandLine.appendSwitch("log-level", "3");
    // Suppress GLib critical/warning messages (g_object_ref/unref assertions)
    process.env.G_DEBUG = "none";
    process.env.G_MESSAGES_DEBUG = "";

    // Electron 40 / Chromium 130 Ozone: the shared GPU process composites
    // ALL windows (game WebGL + transparent overlays).  Alpha-blending two
    // 2560×1292 transparent overlay surfaces every frame stalls the game's
    // WebGL rendering → periodic freeze + mouse block.
}

import { createViewLoader } from "./main/viewLoader";
import { registerMainIpc } from "./main/ipc/registerMainIpc";
import type { ExtraWindowInfo, ExtraRowInfo } from "./main/ipc/handlers/memory";
import { registerPluginHandlers } from "./main/ipc/handlers/plugins";
import { registerControllerHandlers } from "./main/ipc/handlers/controller";
import { createControllerInputRouter, DEFAULT_BUTTON_MAPPING, resolveButtonMapping, type ControllerButtonMapping, type ModifierSlot } from "./main/controller/inputRouter";
import { createSafeHandler } from "./main/ipc/common";
import { applyCSP, getCSPNonce } from "./main/security/harden";
import { logInfo, logErr, logWarn, setLogListener } from "./shared/logger";
import { createCoreServices } from "./main/coreServices";
import { createClientSettingsStore } from "./main/clientSettings/store";
import { createServiceRegistry } from "./main/plugin/serviceRegistry";
import { createPluginHost } from "./main/plugin/pluginHost";
import { createPluginStateStore } from "./main/plugin/pluginStateStore";
import { invokePluginHandler, hasPluginHandler } from "./main/plugin/pluginIpc";
import { URLS, TIMINGS, LAYOUT } from "./shared/constants";
import { createSidePanelButtonController } from "./main/windows/sidePanelButtonController";
import { createRoiVisibilityStore } from "./main/roi/roiVisibilityStore";
import { DEFAULT_LOCALE, type ClientSettings, type Locale } from "./shared/schemas";
import { DEFAULT_HOTKEYS, normalizeHotkeySettings } from "./shared/hotkeys";
import { loadDebugConfig, debugLog } from "./main/debugConfig";
import { hasPendingMigrations, runMigrations } from "./main/migration/migrationRunner";
import { createMigrationWindow, updateMigrationProgress, closeMigrationWindow } from "./main/migration/migrationWindow";
import { fitLauncherSizeToWorkArea, normalizeLauncherSize } from "./shared/launcherSize";

// Extracted modules
import { setupAutoUpdater } from "./main/autoUpdater";
import { createSidePanelManager } from "./main/sidePanel";
import { createOverlaysManager } from "./main/overlays";
import { createHotkeysManager } from "./main/hotkeys";
import { createOcrSystem } from "./main/ocr/ocrSystem";
import {
    postLauncherStartupToDiscord,
    copyDefaultPlugins,
    configureBundledTesseract,
    writeTesseractDiagnostic,
} from "./main/startup/startupUtils";
import { registerLogsHandlers } from "./main/ipc/handlers/logs";

// Vite declarations
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

app.setAppUserModelId("Flyff-U-Launcher");

// ─── Event-Loop lag monitor (Linux freeze diagnostics) ───────────────
// Measures how long the Node.js event loop is blocked. If we see high lag,
// the main process is stuck. If no lag but the app freezes anyway, the GPU
// process is hung (transparent overlay compositor issue).
if (process.platform === "linux") {
    let elLastTick = Date.now();
    setInterval(() => {
        const now = Date.now();
        const lag = now - elLastTick - 500;
        if (lag > 30) {
            console.log(`[FREEZE DIAG] Event loop blocked for ${lag + 500}ms (lag=${lag}ms)`);
        }
        elLastTick = now;
    }, 500).unref();
}

// ============================================================================
// Global State
// ============================================================================

let launcherWindow: BrowserWindow | null = null;
let pluginHost: ReturnType<typeof createPluginHost> | null = null;
let sessionWindowController: ReturnType<typeof createCoreServices>["sessionWindow"] | null = null;
let sidePanelButton: ReturnType<typeof createSidePanelButtonController> | null = null;
let sidePanelMgr: ReturnType<typeof createSidePanelManager> | null = null;
let toastDurationMs = 5000;
let launcherSize = normalizeLauncherSize();

// ============================================================================
// App Ready
// ============================================================================

app.whenReady().then(async () => {
    setLogListener((entry) => {
        for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
                win.webContents.send("logs:new", entry);
            }
        }
    });

    // Remove default application menu (File, Edit, View, Window, Help)
    Menu.setApplicationMenu(null);

    // Apply Content Security Policy
    applyCSP(session.defaultSession);

    // Expose CSP nonce to preload scripts (synchronous IPC so preload can read
    // it before any renderer code runs and attach it to <style> elements)
    ipcMain.on("csp:nonce", (event) => {
        event.returnValue = getCSPNonce();
    });

    // Run version-gated data migrations (with UI if needed)
    const userData = app.getPath("userData");
    if (await hasPendingMigrations(userData)) {
        const migWin = createMigrationWindow();
        await runMigrations(userData, (progress) => {
            updateMigrationProgress(migWin, progress);
        });
        closeMigrationWindow(migWin);
    }

    const preloadPath = path.join(__dirname, "preload.js");
    const pluginsDir = path.join(app.getPath("userData"), "plugins");
    const launcherVersion = app.getVersion();

    // Prepare bundled assets (Tesseract, default plugins)
    configureBundledTesseract();
    writeTesseractDiagnostic();
    await copyDefaultPlugins(pluginsDir);

    // Load debug configuration
    await loadDebugConfig();

    if (app.isPackaged) {
        try {
            const telemetrySettings = await createClientSettingsStore().get();
            if (telemetrySettings.sendTelemetry) {
                void postLauncherStartupToDiscord();
            }
        } catch {
            // If settings can't be read, skip telemetry silently
        }
    }

    debugLog("startup", "userData:", app.getPath("userData"));
    debugLog("startup", "pluginsDir:", pluginsDir);

    // Create view loader
    const loadView = createViewLoader({
        devServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL,
        rendererName: MAIN_WINDOW_VITE_NAME,
        baseDir: __dirname,
    });

    // Controller-Support: Mapping webContents.id → profileId, fuer pro-Profil-
    // Action-Pad-Anker und Kalibrierung. Wird vom sessionTabsManager und
    // instanceWindow ueber Callbacks gepflegt. Cache fuer Action-Pad-Anker
    // beschleunigt den synchronen Lookup im Router (vermeidet async Profil-Load
    // pro Frame).
    const webContentsToProfile = new Map<number, string>();
    const actionPadAnchors = new Map<string, import("./main/controller/inputRouter").ActionPadAnchor>();

    // Create core services
    const services = createCoreServices({
        preloadPath,
        loadView,
        flyffUrl: URLS.FLYFF_PLAY,
        followIntervalMs: TIMINGS.OVERLAY_FOLLOW_MS,
        onInstanceOpened: () => {
            logWarn("Instance window opened", "Main");
        },
        registerWebContentsProfile: (wcId, profileId) => {
            webContentsToProfile.set(wcId, profileId);
        },
        unregisterWebContentsProfile: (wcId) => {
            webContentsToProfile.delete(wcId);
        },
    });

    // Initial-Befuellung der Caches aus den persistenten Profilen — beim ersten
    // Frame-Eingang sind Anker und Mapping dann sofort verfuegbar.
    void services.profiles.list().then((profiles) => {
        for (const p of profiles) {
            // Cast via unknown — reloadModifierMappingsForProfile macht
            // selber Format-Detection (alt vs. neuer Layer-Wrapper).
            const c = (p as unknown as {
                controller?: {
                    actionPad?: {
                        hAnchor: "left" | "center" | "right";
                        vAnchor: "top" | "middle" | "bottom";
                        offsetX: number;
                        offsetY: number;
                    } | null;
                    buttons?: Record<string, string | null | undefined>;
                    modifiers?: Record<string, unknown>;
                };
            }).controller;
            if (c?.actionPad) actionPadAnchors.set(p.id, c.actionPad);
            if (c?.buttons) reloadButtonMappingsForProfile(p.id, c.buttons);
            if (c?.modifiers) reloadModifierMappingsForProfile(p.id, c.modifiers);
            reloadIconsForProfile(p.id, c);
            reloadBufferTargetForProfile(p.id, (c as { bufferTargetProfileId?: unknown } | undefined)?.bufferTargetProfileId);
        }
    }).catch(() => { /* ignore */ });
    const roiVisibilityStore = createRoiVisibilityStore();

    sessionWindowController = services.sessionWindow;
    startupComplete = true;
    let overlayClickThrough = false;
    let clientLocale: Locale = DEFAULT_LOCALE;
    let overlayHotkeys = normalizeHotkeySettings(DEFAULT_HOTKEYS, DEFAULT_HOTKEYS);
    let currentGameFont: string | null = null;
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
        services.sessionTabs.setGameFont?.(clientSettingsSnap.gameFont ?? null);
        currentGameFont = clientSettingsSnap.gameFont ?? null;
        const uiPosEnabled = clientSettingsSnap.persistGameUiPositions ?? false;
        services.sessionTabs.setUiPositionPersistenceEnabled?.(uiPosEnabled);
    } catch (err) {
        logErr(err, "ClientSettings");
    }
    // Side panel button is now rendered in the session tab bar (renderer),
    // the overlay button controller is no longer needed.
    sidePanelButton = null;

    // =========================================================================
    // Side Panel Manager
    // =========================================================================
    sidePanelMgr = createSidePanelManager({
        getSessionWindow: () => services.sessionWindow.get(),
        getSessionTabs: () => services.sessionTabs,
        getRegistryEntries: () => services.sessionRegistry.list().map((e) => ({
            window: e.window,
            tabsManager: e.tabsManager,
        })),
        getOverlayTargetId: () => services.profiles.getOverlayTargetId(),
        getSidePanelButton: () => sidePanelButton,
        preloadPath,
        getLocale: () => clientLocale,
        getOverlaysHiddenByHotkey: () => overlaysMgr.state.overlaysHiddenByHotkey,
    });

    // =========================================================================
    // Overlays Manager
    // =========================================================================
    const overlaysMgr = createOverlaysManager({
        getSessionWindow: () => services.sessionWindow.get(),
        getSessionTabs: () => services.sessionTabs,
        getInstances: () => ({
            get: (id: string) => {
                const inst = services.instances.get(id);
                return (inst && !inst.isDestroyed()) ? inst : null;
            },
        }),
        getRegistryEntries: () => services.sessionRegistry.list().map((e) => ({
            window: e.window,
            tabsManager: e.tabsManager,
        })),
        getOverlayTargetId: () => services.profiles.getOverlayTargetId(),
        getOverlaySupportTargetId: () => services.profiles.getOverlaySupportTargetId(),
        getSidePanelButton: () => sidePanelButton,
        getSidePanelWindow: () => sidePanelMgr.state.window,
        getSidePanelSyncInterval: () => sidePanelMgr.state.syncInterval,
        setSidePanelSyncInterval: (val) => { (sidePanelMgr.state as { syncInterval: NodeJS.Timeout | null }).syncInterval = val; },
        syncSidePanelBounds: () => void sidePanelMgr.syncBounds(),
        preloadPath,
        getLocale: () => clientLocale,
        scheduleTimersForProfile: (profileId) => ocrSystem.scheduleTimersForProfile(profileId),
    });

    // =========================================================================
    // Hotkeys Manager
    // =========================================================================
    const hotkeysMgr = createHotkeysManager({
        getSessionWindow: () => services.sessionWindow.get(),
        getLauncherWindow: () => launcherWindow,
        getInstances: () => services.instances,
        getRegistryWindows: () => services.sessionRegistry.list().map((e) => e.window),
        isFlyffWindowFocused: () => {
            const focused = BrowserWindow.getFocusedWindow();
            if (!focused) return false;
            const sessionWin = services.sessionWindow.get();
            if (sessionWin && !sessionWin.isDestroyed() && focused.id === sessionWin.id) return true;
            const instanceIds = new Set(services.instances.all().map((e) => e.win.id));
            if (instanceIds.has(focused.id)) return true;
            return services.sessionRegistry.list().some((e) => !e.window.isDestroyed() && e.window.id === focused.id);
        },
        toggleAllOverlaysVisibility: () => overlaysMgr.toggleVisibility(),
        toggleSidePanel: (payload) => void sidePanelMgr.toggle(payload),
        getSidePanelActiveProfileId: () => {
            // Check legacy singleton first, then multi-window registry
            const legacyId = services.sessionTabs.getActiveId?.();
            if (legacyId) return legacyId;
            for (const entry of services.sessionRegistry.list()) {
                const id = entry.tabsManager.getActiveId?.();
                if (id) return id;
            }
            return undefined;
        },
        getSidePanelWindow: () => sidePanelMgr.state.window,
        getRoiOverlayWindow: () => overlaysMgr.state.roiOverlayWindow,
        getLocale: () => clientLocale,
        getToastDurationMs: () => toastDurationMs,
        getClientSettings: () => services.clientSettings.get().catch((): null => null),
        hasPluginHandler,
        invokePluginHandler,
    });

    // =========================================================================
    // OCR System
    // =========================================================================
    const ipcLogErr = (msg: unknown) => logErr(msg, "IPC");
    const safeHandle = createSafeHandler(ipcLogErr);

    const ocrSystem = createOcrSystem({
        services: {
            roiStore: services.roiStore,
            sessionTabs: services.sessionTabs,
            sessionWindow: services.sessionWindow,
            sessionRegistry: services.sessionRegistry,
            instances: {
                get: (id: string) => {
                    const inst = services.instances.get(id);
                    return (inst && !inst.isDestroyed()) ? inst : null;
                },
            },
        },
        getPluginEventBus: () => pluginHost?.getEventBus?.() ?? null,
        hasPluginHandler,
        invokePluginHandler,
        safeHandle,
        getGameFont: () => currentGameFont,
    });

    // =========================================================================
    // Overlay Dialog Visibility IPC
    // =========================================================================
    safeHandle("overlays:hideForDialog", async () => {
        overlaysMgr.hideForDialog();
        return { ok: true, data: true };
    });
    safeHandle("overlays:showAfterDialog", async () => {
        overlaysMgr.showAfterDialog();
        return { ok: true, data: true };
    });

    // =========================================================================
    // Logs IPC
    // =========================================================================
    registerLogsHandlers(safeHandle, services.clientSettings, {
        preloadPath,
        getLocale: () => clientLocale,
    });

    // =========================================================================
    // Client Settings Change Handler
    // =========================================================================
    const onClientSettingsChanged = (settings: ClientSettings) => {
        // sidePanelButton overlay removed — button is now in the tab bar
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
        services.sessionTabs.setGameFont?.(settings.gameFont ?? null);
        currentGameFont = settings.gameFont ?? null;
        services.sessionTabs.setUiPositionPersistenceEnabled?.(settings.persistGameUiPositions ?? false);
        // Also propagate to all multi-window tab managers
        for (const entry of services.sessionRegistry.list()) {
            entry.tabsManager.setGameFont?.(settings.gameFont ?? null);
            entry.tabsManager.setUiPositionPersistenceEnabled?.(settings.persistGameUiPositions ?? false);
        }
        // Propagate font to instance windows
        services.setInstanceFont(settings.gameFont ?? null);
        if (launcherWindow && !launcherWindow.isDestroyed()) {
            const display = screen.getDisplayMatching(launcherWindow.getBounds()) ?? screen.getPrimaryDisplay();
            const nextSize = fitLauncherSizeToWorkArea(launcherSize, display?.workAreaSize);
            const minWidth = Math.min(display.workAreaSize.width, LAYOUT.LAUNCHER_MIN_WIDTH);
            const minHeight = Math.min(display.workAreaSize.height, LAYOUT.LAUNCHER_MIN_HEIGHT);
            launcherWindow.setMinimumSize(minWidth, minHeight);
            launcherWindow.setSize(nextSize.width, nextSize.height);
        }
        hotkeysMgr.register(overlayHotkeys);
        // Broadcast settings change to session windows
        const sessionWin = services.sessionWindow.get?.();
        if (sessionWin && !sessionWin.isDestroyed()) {
            sessionWin.webContents.send("clientSettings:changed", settings);
        }
        for (const entry of services.sessionRegistry.list()) {
            const win = entry.window;
            if (win && !win.isDestroyed()) {
                win.webContents.send("clientSettings:changed", settings);
            }
        }
    };

    // Register hotkeys
    hotkeysMgr.register(overlayHotkeys);

    // IPC: Side Panel toggle
    ipcMain.on("sidepanel:toggle", (_e, payload) => {
        void sidePanelMgr.toggle(payload as { focusTab?: string; profileId?: string });
    });

    // IPC: Hotkey pause/resume during recording
    ipcMain.handle("hotkeys:pause", () => {
        hotkeysMgr.clearRegistered();
        return { ok: true };
    });
    ipcMain.handle("hotkeys:resume", () => {
        hotkeysMgr.register(overlayHotkeys);
        return { ok: true };
    });

    // =========================================================================
    // Plugin System
    // =========================================================================
    const serviceRegistry = createServiceRegistry({
        core: services,
    });

    const pluginStateStore = createPluginStateStore();
    const enabledPluginIds = await pluginStateStore.getEnabledIds();

    pluginHost = createPluginHost({
        pluginsDir,
        services: (manifest, pluginId) => serviceRegistry.getServicesForPlugin(manifest, pluginId),
        launcherVersion,
        enabledPlugins: enabledPluginIds.length > 0 ? enabledPluginIds : undefined,
    });

    pluginHost.on("plugin:loaded", ({ pluginId }) => {
        logInfo(`Plugin loaded: ${pluginId}`, "Main");
    });

    pluginHost.on("plugin:started", ({ pluginId }) => {
        logInfo(`Plugin started: ${pluginId}`, "Main");
    });

    pluginHost.on("plugin:stopped", ({ pluginId }) => {
        logInfo(`Plugin stopped: ${pluginId}`, "Main");
    });

    pluginHost.on("plugin:error", ({ pluginId, error }) => {
        logErr(`Plugin error in ${pluginId}: ${error?.message}`, "Main");
        pluginStateStore.recordError(pluginId, error?.message ?? "Unknown error");
    });

    // =========================================================================
    // Register Core IPC
    // =========================================================================
    registerMainIpc({
        profiles: services.profiles,
        sessionTabs: services.sessionTabs as unknown as Parameters<typeof registerMainIpc>[0]["sessionTabs"],
        sessionWindow: services.sessionWindow as unknown as Parameters<typeof registerMainIpc>[0]["sessionWindow"],
        sessionRegistry: services.sessionRegistry,
        tabLayouts: services.tabLayouts,
        themes: services.themes,
        features: services.features,
        loadView,
        createInstanceWindow: services.createInstanceWindow,
        createTabWindow: services.createTabWindow,
        clientSettings: services.clientSettings,
        onClientSettingsChanged,
        flyffUrl: URLS.FLYFF_PLAY,
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
        showToast: (message, tone = "info") => {
            const target = launcherWindow;
            if (!target || target.isDestroyed()) return;
            try {
                target.webContents.send("toast:show", { message, tone, ttlMs: toastDurationMs });
            } catch {
                /* ignore */
            }
        },
        getExtraWindows: () => {
            const extras: ExtraWindowInfo[] = [];

            // ROI Overlay windows (system)
            const roiOverlay = overlaysMgr.state.roiOverlayWindow;
            if (roiOverlay && !roiOverlay.isDestroyed()) {
                extras.push({ label: "Overlay", window: roiOverlay, category: "system" });
            }
            const roiSupportOverlay = overlaysMgr.state.roiSupportOverlayWindow;
            if (roiSupportOverlay && !roiSupportOverlay.isDestroyed()) {
                extras.push({ label: "Support Overlay", window: roiSupportOverlay, category: "system" });
            }

            // Plugin settings windows + other plugin-created windows:
            // Collect all known non-plugin window IDs, then attribute the rest to plugins.
            const spWin = sidePanelMgr?.state.window;
            const knownWindowIds = new Set<number>();
            if (launcherWindow && !launcherWindow.isDestroyed()) knownWindowIds.add(launcherWindow.id);
            if (spWin && !spWin.isDestroyed()) knownWindowIds.add(spWin.id);
            if (roiOverlay && !roiOverlay.isDestroyed()) knownWindowIds.add(roiOverlay.id);
            if (roiSupportOverlay && !roiSupportOverlay.isDestroyed()) knownWindowIds.add(roiSupportOverlay.id);
            const sessionWin = services.sessionWindow.get();
            if (sessionWin && !sessionWin.isDestroyed()) knownWindowIds.add(sessionWin.id);
            for (const entry of services.sessionRegistry.list()) {
                if (!entry.window.isDestroyed()) knownWindowIds.add(entry.window.id);
            }

            for (const win of BrowserWindow.getAllWindows()) {
                if (win.isDestroyed() || knownWindowIds.has(win.id)) continue;
                const title = win.getTitle() || "Plugin";
                extras.push({ label: title, window: win, category: "plugin" });
            }

            return extras;
        },
        getExtraRows: () => {
            const rows: ExtraRowInfo[] = [];

            // ── Sidepanel plugin tabs ──
            // The sidepanel is one BrowserWindow with multiple plugin iframes inside.
            // List each plugin tab individually, all sharing the sidepanel process memory.
            const spWin = sidePanelMgr?.state.window;
            if (spWin && !spWin.isDestroyed()) {
                const spPid = spWin.webContents.getOSProcessId();
                const spMetrics = app.getAppMetrics().find((m) => m.pid === spPid);
                let spMemMB = spMetrics ? Math.round(spMetrics.memory.workingSetSize / 1024) : 0;
                if (spMemMB <= 0 && process.platform === "linux") {
                    try {
                        const data = require("fs").readFileSync(`/proc/${spPid}/statm`, "utf-8");
                        const resident = parseInt(data.trim().split(/\s+/)[1], 10);
                        if (Number.isFinite(resident)) spMemMB = Math.round((resident * 4096) / (1024 * 1024));
                    } catch { /* ignore */ }
                }

                // Find which plugins have sidepanel tabs loaded
                const loadedIds = pluginHost.getLoadedPluginIds();
                const spPlugins: string[] = [];
                for (const id of loadedIds) {
                    const p = pluginHost.getPlugin(id);
                    if (!p) continue;
                    const ui = p.manifest.ui as { sidepanelTab?: { label?: string } } | undefined;
                    if (ui?.sidepanelTab) {
                        spPlugins.push(p.manifest.name || id);
                    }
                }

                if (spPlugins.length > 0) {
                    // Show each plugin tab as a shared row
                    for (const name of spPlugins) {
                        rows.push({
                            label: `${name} (Side Panel)`,
                            memoryMB: spMemMB,
                            category: "plugin",
                            shared: true,
                        });
                    }
                } else {
                    // No plugin tabs, just show "Side Panel"
                    rows.push({
                        label: "Side Panel",
                        memoryMB: spMemMB,
                        category: "plugin",
                        shared: false,
                    });
                }
            }

            // ── Main process (OCR, Plugin-Host, IPC) ──
            const mainMem = process.memoryUsage();
            const mainMB = Math.round(mainMem.rss / (1024 * 1024));
            rows.push({
                label: "Main Process inkl. OCR",
                memoryMB: mainMB,
                category: "system",
                shared: false,
            });

            return rows;
        },
    });

    // Register plugin management IPC handlers
    registerPluginHandlers(safeHandle, { pluginHost, pluginStateStore, preloadPath }, ipcLogErr);

    // ====================================================================
    // Controller-Support (v3.5.0): Gamepad-Polling im Preload, Event-
    // Injection am Chromium-Input-Layer DIREKT in der Sender-WebContents.
    // Pre2: pro-Profil-Action-Pad-Anker + Lehrmodus via Strg+Shift+F1.
    // ====================================================================
    const controllerToast = (msg: string, tone: "info" | "success" | "error" = "info") => {
        try {
            launcherWindow?.webContents.send("toast:show", { message: msg, tone, ttlMs: toastDurationMs });
        } catch { /* ignore */ }
    };
    // Cache fuer Per-Profil-Button-Mapping (Override → vollstaendiges Mapping).
    // Wird beim Start aus den Profilen befuellt und bei jedem Profil-Update
    // aktualisiert.
    const buttonMappings = new Map<string, ControllerButtonMapping>();

    // Buffer-Forward-Ziele pro Profil: profileId → Ziel-profileId. Wird vom
    // Router via getBufferTarget(sender) konsumiert wenn @forwardHold aktiv.
    // Update bei jedem Profil-Save analog zu buttonMappings.
    const bufferTargets = new Map<string, string>();
    const reloadBufferTargetForProfile = (profileId: string, targetId: unknown) => {
        if (typeof targetId === "string" && targetId.length > 0 && targetId !== profileId) {
            bufferTargets.set(profileId, targetId);
        } else {
            bufferTargets.delete(profileId);
        }
    };
    const reloadButtonMappingsForProfile = (profileId: string, override: unknown) => {
        if (override && typeof override === "object") {
            buttonMappings.set(profileId, resolveButtonMapping(override as Record<string, string | null | undefined>));
        }
        else {
            buttonMappings.delete(profileId);
        }
    };

    // Modifier-Mappings: profileId → slot → resolved mapping. Wird parallel
    // zu buttonMappings gepflegt; ist eine Schulter im Modifier-Modus, kommt
    // beim Halten ihr Layer statt des Defaults zum Einsatz.
    const modifierMappings = new Map<string, Map<ModifierSlot, ControllerButtonMapping>>();
    // Symbol-Name → Button-Index. Modifier-Mappings haben Symbol-Namen als
    // Keys (a, b, x, y, ...) wie auch das Default-Mapping; der Router will
    // aber numerische Indizes als Keys, weil er buttons[i] adressiert.
    const SYM_TO_IDX: Record<string, number> = {
        a: 0, b: 1, x: 2, y: 3,
        l1: 4, r1: 5, l2: 6, r2: 7,
        select: 8, start: 9, l3: 10, r3: 11,
        dpadUp: 12, dpadDown: 13, dpadLeft: 14, dpadRight: 15,
    };
    const reloadModifierMappingsForProfile = (profileId: string, modifiers: unknown) => {
        if (!modifiers || typeof modifiers !== "object") {
            modifierMappings.delete(profileId);
            return;
        }
        const obj = modifiers as Record<string, unknown>;
        const slotMap = new Map<ModifierSlot, ControllerButtonMapping>();
        for (const slot of ["l1", "r1", "l2", "r2"] as const) {
            const raw = obj[slot];
            if (!raw || typeof raw !== "object") continue;
            // Layer kann das neue Format { enabled, buttons } oder das alte
            // flache Format (direkt ButtonMapping) haben. Detection wie in
            // store.normalizeController.
            const slotObj = raw as Record<string, unknown>;
            const hasLayerShape = "enabled" in slotObj || "buttons" in slotObj;
            let buttons: Record<string, unknown> | null = null;
            if (hasLayerShape) {
                if (slotObj.enabled === false) continue; // disabled → uebergehen
                if (slotObj.buttons && typeof slotObj.buttons === "object") {
                    buttons = slotObj.buttons as Record<string, unknown>;
                }
            }
            else {
                buttons = slotObj;
            }
            if (!buttons) continue;
            const sparse: ControllerButtonMapping = {};
            for (const [sym, val] of Object.entries(buttons)) {
                const idx = SYM_TO_IDX[sym];
                if (idx === undefined) continue;
                if (val === null) sparse[idx] = null;
                else if (typeof val === "string" && val.length > 0) sparse[idx] = val;
            }
            if (Object.keys(sparse).length > 0) slotMap.set(slot, sparse);
        }
        if (slotMap.size > 0) modifierMappings.set(profileId, slotMap);
        else modifierMappings.delete(profileId);
    };

    const controllerRouter = createControllerInputRouter({
        getActionPadAnchor: (sender) => {
            const profileId = webContentsToProfile.get(sender.id);
            if (!profileId) return null;
            return actionPadAnchors.get(profileId) ?? null;
        },
        getButtonMapping: (sender) => {
            const profileId = webContentsToProfile.get(sender.id);
            if (!profileId) return DEFAULT_BUTTON_MAPPING;
            return buttonMappings.get(profileId) ?? DEFAULT_BUTTON_MAPPING;
        },
        getModifierMapping: (sender, slot) => {
            const profileId = webContentsToProfile.get(sender.id);
            if (!profileId) return null;
            return modifierMappings.get(profileId)?.get(slot) ?? null;
        },
        getBufferTarget: (sender) => {
            // Buffer-Forward-Ziel aufloesen: vom sender → Profil-ID →
            // Profil's `controller.bufferTargetProfileId` → Ziel-Profil-ID →
            // dessen aktive WebContents (BrowserView im selben SessionWindow,
            // oder in einem anderen Window). Wenn nicht konfiguriert oder
            // Ziel nicht offen: null → Hold-Action no-op.
            const senderProfileId = webContentsToProfile.get(sender.id);
            if (!senderProfileId) return null;
            const targetId = bufferTargets.get(senderProfileId);
            if (!targetId) return null;
            // Ziel-WebContents in der Reverse-Map suchen.
            for (const [wcId, profId] of webContentsToProfile.entries()) {
                if (profId !== targetId) continue;
                const wc = webContents.fromId(wcId);
                if (wc && !wc.isDestroyed()) return wc;
            }
            return null;
        },
        onLauncherAction: (action, sender) => {
            // Findet das Session-Window, in dem der Sender lebt, und dispatcht
            // die `@<action>` direkt. Fallback: an die parent-WebContents senden,
            // damit ein Renderer-seitiges Mapping (z.B. Open-Config) reagieren
            // kann.
            try {
                const senderProfileId = webContentsToProfile.get(sender.id) ?? null;
                let entry = null as null | { window: BrowserWindow; tabsManager: { getLoadedProfileIds(): string[]; getActiveId(): string | null; switchTo(id: string): void } };
                for (const e of services.sessionRegistry.list()) {
                    const tm = e.tabsManager;
                    if (typeof tm.getLoadedProfileIds !== "function") continue;
                    const ids = tm.getLoadedProfileIds();
                    if (senderProfileId && ids.includes(senderProfileId)) {
                        entry = e as typeof entry;
                        break;
                    }
                }
                if (action === "@nextTab" || action === "@prevTab") {
                    if (!entry) return;
                    const ids = entry.tabsManager.getLoadedProfileIds();
                    if (ids.length < 2) return;
                    const activeId = entry.tabsManager.getActiveId() ?? senderProfileId ?? ids[0];
                    let idx = ids.indexOf(activeId);
                    if (idx < 0) idx = 0;
                    const next = action === "@nextTab"
                        ? ids[(idx + 1) % ids.length]
                        : ids[(idx - 1 + ids.length) % ids.length];
                    entry.tabsManager.switchTo(next);
                    return;
                }
                if (action === "@reloadView") {
                    if (!sender.isDestroyed()) sender.reload();
                    return;
                }
                if (action === "@toggleFullscreen") {
                    const win = entry?.window ?? BrowserWindow.fromWebContents(sender);
                    if (win && !win.isDestroyed()) win.setFullScreen(!win.isFullScreen());
                    return;
                }
                // Unbekannte Aktion → an Renderer (Launcher-Window) durchreichen,
                // dort kann ein Listener (z.B. fuer @openConfig) reagieren.
                BrowserWindow.fromWebContents(sender)?.webContents
                    .send("controller:launcherAction", { action });
            }
            catch (err) {
                logErr(err, "controller:launcherAction");
            }
        },
        notify: (msg) => controllerToast(msg, "info"),
    });
    // Belegungs-Overlay: kleine in-DOM-Anzeige in der Spiel-View, gefuettert vom
    // Hauptprozess. Wir liefern fertig aufgeloeste Face-Button-Labels (y/b/a/x)
    // fuer Base + jeden Modifier-Layer; der Preload entscheidet client-seitig
    // welcher Layer gerade gehalten wird. Ergaenzend dazu pro Face optional ein
    // Icon-Data-URI (vom Click-to-Capture-Lehrmodus erfasst).
    type OverlayFaceLabels = { y: string | null; b: string | null; a: string | null; x: string | null };
    type OverlayFaceIcons = { y?: string; b?: string; a?: string; x?: string };
    const facesFromMapping = (m: ControllerButtonMapping): OverlayFaceLabels => ({
        y: (m[3] ?? null),  // Triangle / Y
        b: (m[1] ?? null),  // Circle / B
        a: (m[0] ?? null),  // Cross / A
        x: (m[2] ?? null),  // Square / X
    });

    // Parallele Icon-Caches zu buttonMappings/modifierMappings — werden vom
    // Click-to-Capture-Lehrmodus befuellt und parallel zum Mapping persistiert.
    const controllerIcons = new Map<string, OverlayFaceIcons>();
    const modifierIcons = new Map<string, Map<ModifierSlot, OverlayFaceIcons>>();
    const sanitizeIcons = (raw: unknown): OverlayFaceIcons => {
        const out: OverlayFaceIcons = {};
        if (!raw || typeof raw !== "object") return out;
        const o = raw as Record<string, unknown>;
        for (const k of ["a", "b", "x", "y"] as const) {
            const v = o[k];
            if (typeof v === "string" && v.startsWith("data:image/")) out[k] = v;
        }
        return out;
    };
    const reloadIconsForProfile = (profileId: string, controllerObj: unknown) => {
        const c = (controllerObj && typeof controllerObj === "object")
            ? controllerObj as Record<string, unknown>
            : null;
        const baseIcons = sanitizeIcons(c?.icons);
        if (Object.keys(baseIcons).length > 0) controllerIcons.set(profileId, baseIcons);
        else controllerIcons.delete(profileId);

        const modMap = new Map<ModifierSlot, OverlayFaceIcons>();
        const mods = (c?.modifiers && typeof c.modifiers === "object")
            ? c.modifiers as Record<string, unknown>
            : null;
        if (mods) {
            for (const slot of ["l1", "r1", "l2", "r2"] as const) {
                const layer = mods[slot];
                if (!layer || typeof layer !== "object") continue;
                const icons = sanitizeIcons((layer as Record<string, unknown>).icons);
                if (Object.keys(icons).length > 0) modMap.set(slot, icons);
            }
        }
        if (modMap.size > 0) modifierIcons.set(profileId, modMap);
        else modifierIcons.delete(profileId);
    };

    const buildOverlayPayload = (profileId: string) => {
        const base = buttonMappings.get(profileId) ?? DEFAULT_BUTTON_MAPPING;
        const mod = modifierMappings.get(profileId);
        const baseIc = controllerIcons.get(profileId) ?? {};
        const modIc = modifierIcons.get(profileId);
        return {
            enabled: true,
            base: facesFromMapping(base),
            baseIcons: baseIc,
            modifiers: {
                l1: mod?.has("l1") ? facesFromMapping(mod.get("l1")!) : undefined,
                r1: mod?.has("r1") ? facesFromMapping(mod.get("r1")!) : undefined,
                r2: mod?.has("r2") ? facesFromMapping(mod.get("r2")!) : undefined,
            },
            modifierIcons: {
                l1: modIc?.get("l1"),
                r1: modIc?.get("r1"),
                r2: modIc?.get("r2"),
            },
        };
    };
    const pushOverlayToProfile = (profileId: string) => {
        for (const [wcId, pid] of webContentsToProfile) {
            if (pid !== profileId) continue;
            const wc = webContents.fromId(wcId);
            if (!wc || wc.isDestroyed()) continue;
            try { wc.send("controller:overlay:update", buildOverlayPayload(profileId)); }
            catch (err) { logErr(err, "controller:overlay:update"); }
        }
    };
    // Initial-Pull aus dem Preload (sendet sobald die WebContents laeuft).
    ipcMain.on("controller:overlay:request", (event) => {
        const profileId = webContentsToProfile.get(event.sender.id);
        if (!profileId) return;
        try { event.sender.send("controller:overlay:update", buildOverlayPayload(profileId)); }
        catch (err) { logErr(err, "controller:overlay:request reply"); }
    });

    // ---- Icon-Capture (Click-to-Capture aus dem laufenden Spiel) -------------
    // Renderer (Config-Tab) ruft `controller:icon:capture` mit Profil/Face/Layer
    // auf → wir schicken `start`-Hinweis an die Spiel-View, der Preload erfasst
    // den naechsten Mausklick und meldet die Position. Wir capturen 40x40 px
    // um diesen Punkt herum, speichern als Data-URI ins Profil und pushen das
    // Overlay neu. Globaler Single-Slot-State — gleichzeitige Captures werden
    // gestapelt (alter wird verworfen).
    type FaceKey = "a" | "b" | "x" | "y";
    type LayerKey = "l1" | "r1" | "r2" | null;
    type CaptureResult = { ok: true; dataUri: string } | { ok: false; reason: string };
    let pendingCapture: {
        profileId: string;
        face: FaceKey;
        layer: LayerKey;
        wcId: number;
        resolve: (r: CaptureResult) => void;
        timer: NodeJS.Timeout;
    } | null = null;

    const findGameWebContentsForProfile = (profileId: string): import("electron").WebContents | null => {
        // Primary: sessionRegistry — die kanonische Quelle fuer aktive Spiel-
        // Views ueber alle Session-Fenster hinweg.
        try {
            for (const entry of services.sessionRegistry.list()) {
                const tm = entry.tabsManager as unknown as {
                    getViewByProfile?: (id: string) => import("electron").BrowserView | null;
                };
                if (typeof tm.getViewByProfile !== "function") continue;
                const view = tm.getViewByProfile(profileId);
                const wc = view?.webContents;
                if (wc && !wc.isDestroyed()) return wc;
            }
        }
        catch (err) { logErr(err, "findGameWebContentsForProfile sessionRegistry"); }
        // Fallback: reverse-lookup im webContentsToProfile-Cache (instanceWindow-
        // Mode oder wenn die Registry-Methode nicht verfuegbar ist).
        for (const [wcId, pid] of webContentsToProfile) {
            if (pid !== profileId) continue;
            const wc = webContents.fromId(wcId);
            if (wc && !wc.isDestroyed()) return wc;
        }
        return null;
    };

    const cancelPendingCapture = (reason: string) => {
        if (!pendingCapture) return;
        clearTimeout(pendingCapture.timer);
        const wc = webContents.fromId(pendingCapture.wcId);
        if (wc && !wc.isDestroyed()) {
            try { wc.send("controller:icon:capture:cancel"); } catch { /* ignore */ }
        }
        pendingCapture.resolve({ ok: false, reason });
        pendingCapture = null;
    };

    const persistIcon = async (profileId: string, face: FaceKey, layer: LayerKey, dataUri: string | null) => {
        const list = await services.profiles.list();
        const p = list.find((x) => x.id === profileId);
        if (!p) return;
        const existing = ((p as unknown) as { controller?: Record<string, unknown> }).controller ?? {};
        const e = existing as Record<string, unknown>;
        if (!layer) {
            const baseIcons = { ...((e.icons as Record<string, unknown> | undefined) ?? {}) };
            if (dataUri == null) delete baseIcons[face]; else baseIcons[face] = dataUri;
            await services.profiles.update({
                id: profileId,
                controller: { ...existing, icons: baseIcons },
            } as Parameters<typeof services.profiles.update>[0]);
        }
        else {
            const existingMods = { ...((e.modifiers as Record<string, unknown> | undefined) ?? {}) };
            const existingLayer = { ...((existingMods[layer] as Record<string, unknown> | undefined) ?? {}) };
            const layerIcons = { ...((existingLayer.icons as Record<string, unknown> | undefined) ?? {}) };
            if (dataUri == null) delete layerIcons[face]; else layerIcons[face] = dataUri;
            existingLayer.icons = layerIcons;
            existingMods[layer] = existingLayer;
            await services.profiles.update({
                id: profileId,
                controller: { ...existing, modifiers: existingMods },
            } as Parameters<typeof services.profiles.update>[0]);
        }
        // Caches aktualisieren + Overlay pushen
        const refreshed = await services.profiles.list();
        const c = (refreshed.find((x) => x.id === profileId) as unknown as { controller?: unknown } | undefined)?.controller;
        reloadIconsForProfile(profileId, c);
        pushOverlayToProfile(profileId);
    };

    ipcMain.handle("controller:icon:capture", async (_event, payload: unknown): Promise<CaptureResult> => {
        if (!payload || typeof payload !== "object") return { ok: false, reason: "invalid_payload" };
        const p = payload as Record<string, unknown>;
        const profileId = typeof p.profileId === "string" ? p.profileId : null;
        const face = (p.face === "a" || p.face === "b" || p.face === "x" || p.face === "y") ? p.face : null;
        const layer = (p.layer === "l1" || p.layer === "r1" || p.layer === "r2") ? p.layer : null;
        if (!profileId || !face) return { ok: false, reason: "invalid_payload" };

        cancelPendingCapture("superseded");

        const wc = findGameWebContentsForProfile(profileId);
        if (!wc) {
            controllerToast("Icon-Capture: Spiel-Fenster nicht offen", "error");
            return { ok: false, reason: "no_view" };
        }

        return await new Promise<CaptureResult>((resolve) => {
            const timer = setTimeout(() => {
                if (pendingCapture && pendingCapture.resolve === resolve) {
                    cancelPendingCapture("timeout");
                }
            }, 10000);
            pendingCapture = { profileId, face, layer, wcId: wc.id, resolve, timer };
            try {
                wc.send("controller:icon:capture:start", { face, layer });
                controllerToast("Klicke im Spiel auf das Icon (10s)", "info");
            }
            catch (err) {
                clearTimeout(timer);
                pendingCapture = null;
                logErr(err, "controller:icon:capture:start");
                resolve({ ok: false, reason: "send_failed" });
            }
        });
    });

    ipcMain.on("controller:icon:capture:done", async (event, payload: unknown) => {
        if (!pendingCapture) return;
        if (event.sender.id !== pendingCapture.wcId) return;
        if (!payload || typeof payload !== "object") return;
        const p = payload as Record<string, unknown>;
        const x = typeof p.x === "number" ? p.x : NaN;
        const y = typeof p.y === "number" ? p.y : NaN;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        const ctx = pendingCapture;
        clearTimeout(ctx.timer);
        pendingCapture = null;

        try {
            const SIZE = 40;
            const rect = {
                x: Math.max(0, Math.round(x - SIZE / 2)),
                y: Math.max(0, Math.round(y - SIZE / 2)),
                width: SIZE,
                height: SIZE,
            };
            const img = await event.sender.capturePage(rect);
            const dataUri = `data:image/png;base64,${img.toPNG().toString("base64")}`;
            await persistIcon(ctx.profileId, ctx.face, ctx.layer, dataUri);
            controllerToast("Icon erfasst", "success");
            ctx.resolve({ ok: true, dataUri });
        }
        catch (err) {
            logErr(err, "controller:icon:capture:done");
            controllerToast("Icon-Capture fehlgeschlagen", "error");
            ctx.resolve({ ok: false, reason: "capture_failed" });
        }
    });

    ipcMain.on("controller:icon:capture:cancel", () => {
        cancelPendingCapture("user_cancel");
    });

    ipcMain.handle("controller:icon:clear", async (_event, payload: unknown): Promise<{ ok: boolean }> => {
        if (!payload || typeof payload !== "object") return { ok: false };
        const p = payload as Record<string, unknown>;
        const profileId = typeof p.profileId === "string" ? p.profileId : null;
        const face = (p.face === "a" || p.face === "b" || p.face === "x" || p.face === "y") ? p.face : null;
        const layer = (p.layer === "l1" || p.layer === "r1" || p.layer === "r2") ? p.layer : null;
        if (!profileId || !face) return { ok: false };
        try { await persistIcon(profileId, face, layer, null); return { ok: true }; }
        catch (err) { logErr(err, "controller:icon:clear"); return { ok: false }; }
    });

    // Direktes Setzen eines Icons aus dem Game-Icon-Picker (statt
    // Click-to-Capture aus dem Spiel). Payload enthaelt eine fertige
    // data:image-URI vom IPC-Picker; wir reichen sie nur durch persistIcon.
    ipcMain.handle("controller:icon:set", async (_event, payload: unknown): Promise<{ ok: boolean; dataUri?: string }> => {
        if (!payload || typeof payload !== "object") return { ok: false };
        const p = payload as Record<string, unknown>;
        const profileId = typeof p.profileId === "string" ? p.profileId : null;
        const face = (p.face === "a" || p.face === "b" || p.face === "x" || p.face === "y") ? p.face : null;
        const layer = (p.layer === "l1" || p.layer === "r1" || p.layer === "r2") ? p.layer : null;
        if (!profileId || !face) return { ok: false };
        // Zwei Quellen unterstuetzen:
        //   - dataUri: fertige `data:image/...` URI (vom alten Click-to-Capture)
        //   - path: relativer Cache-Pfad (vom neuen Game-Icon-Picker, z.B.
        //     "user/cache/skill/icons/colored/foo.png"). Wir lesen die Datei
        //     und konvertieren zu data: — die Game-View-CSP erlaubt nur
        //     data:/blob: fuer img-src, file:// wuerde geblockt.
        let dataUri = typeof p.dataUri === "string" ? p.dataUri : null;
        const relPath = typeof p.path === "string" ? p.path : null;
        if (!dataUri && relPath) {
            // Pfad-Traversal-Schutz: relPath darf keine ".." Segmente enthalten
            if (relPath.includes("..")) return { ok: false };
            try {
                const fs = await import("fs/promises");
                const path = await import("path");
                const userData = app.getPath("userData");
                const absPath = path.join(userData, relPath);
                // Sicherstellen dass abs unter userData liegt (Symlink-Schutz)
                if (!absPath.startsWith(userData + path.sep) && absPath !== userData) return { ok: false };
                const buf = await fs.readFile(absPath);
                const ext = path.extname(absPath).toLowerCase();
                const mime = ext === ".png" ? "image/png"
                    : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
                    : ext === ".webp" ? "image/webp"
                    : ext === ".bmp" ? "image/bmp"
                    : null;
                if (!mime) return { ok: false };
                dataUri = `data:${mime};base64,${buf.toString("base64")}`;
            } catch (err) {
                logErr(err, "controller:icon:set:fileRead");
                return { ok: false };
            }
        }
        if (!dataUri || !dataUri.startsWith("data:image/")) return { ok: false };
        try { await persistIcon(profileId, face, layer, dataUri); return { ok: true, dataUri }; }
        catch (err) { logErr(err, "controller:icon:set"); return { ok: false }; }
    });

    // Direkter Cache-Update fuer Ringmaster-Buffer-Target — umgeht die
    // Disk-Read-Race im normalen controller:reloadMapping-Pfad (der via
    // services.profiles.list() neu von Platte liest und bei noch nicht
    // geflushtem Atomic-Write den stale Wert sieht). Renderer ruft das
    // sofort beim Dropdown-Change — Cache ist innerhalb von ms aktualisiert,
    // kein Wartezeit auf den "Speichern"-Button.
    ipcMain.handle("controller:setBufferTarget", async (_event, payload: unknown): Promise<{ ok: boolean }> => {
        if (!payload || typeof payload !== "object") return { ok: false };
        const p = payload as Record<string, unknown>;
        const profileId = typeof p.profileId === "string" ? p.profileId : null;
        const targetId = typeof p.targetId === "string" && p.targetId.length > 0 ? p.targetId : null;
        if (!profileId) return { ok: false };
        reloadBufferTargetForProfile(profileId, targetId);
        return { ok: true };
    });

    registerControllerHandlers({
        router: controllerRouter,
        onControllerConnected: (info) => {
            controllerToast(`Controller verbunden: ${info.id} (${info.mapping})`, "success");
        },
        getProfileForWebContents: (wc) => webContentsToProfile.get(wc.id) ?? null,
        setActionPadAnchor: async (profileId, anchor) => {
            actionPadAnchors.set(profileId, anchor);
            await services.profiles.update({
                id: profileId,
                controller: { actionPad: anchor },
            } as Parameters<typeof services.profiles.update>[0]);
        },
        reloadButtonMapping: async (profileId) => {
            const list = await services.profiles.list();
            const p = list.find((x) => x.id === profileId);
            const c = (p as unknown as {
                controller?: {
                    buttons?: Record<string, string | null | undefined>;
                    modifiers?: Record<string, unknown>;
                    icons?: unknown;
                    bufferTargetProfileId?: string | null;
                };
            } | undefined)?.controller;
            reloadButtonMappingsForProfile(profileId, c?.buttons);
            reloadModifierMappingsForProfile(profileId, c?.modifiers);
            reloadIconsForProfile(profileId, c);
            reloadBufferTargetForProfile(profileId, c?.bufferTargetProfileId);
            // Overlay aktualisieren — laufende Spiel-Views sehen die neuen
            // Bindings sofort, kein Reload noetig.
            pushOverlayToProfile(profileId);
        },
        notify: (msg, tone) => controllerToast(msg, tone),
    });

    // Lehrmodus-Trigger: Strg+Shift+F1 schickt allen aktuell fokussierten
    // Flyff-WebContents ein controller:calibrate:start; der Preload fängt
    // den naechsten Maus-Klick ab und meldet die Position zurueck. Nur die
    // fokussierte WebContents reagiert (via webContents.isFocused()) — falls
    // keine, kommt eine Toast-Fehlermeldung.
    try {
        const ok = globalShortcut.register("Control+Shift+F1", () => {
            if (webContentsToProfile.size === 0) {
                controllerToast("Action-Pad-Lehrmodus: kein Spiel-Fenster offen", "error");
                return;
            }
            let dispatched = 0;
            for (const [wcId] of webContentsToProfile) {
                const wc = webContents.fromId(wcId);
                if (!wc || wc.isDestroyed()) continue;
                if (!wc.isFocused()) continue;
                wc.send("controller:calibrate:start");
                dispatched++;
            }
            if (dispatched === 0) {
                controllerToast("Lehrmodus: bitte zuerst das Spiel-Fenster anklicken", "error");
                return;
            }
            controllerToast("Lehrmodus aktiv — klicke auf das Action-Pad im Spiel (10 s)", "info");
        });
        if (!ok) logWarn("Failed to register Ctrl+Shift+F1 for action-pad calibration", "Controller");
    } catch (err) {
        logWarn(`globalShortcut.register failed: ${(err as Error).message}`, "Controller");
    }

    // Initialize OCR system (load persisted timers, manual overrides)
    await ocrSystem.init();

    // Start all enabled plugins
    let pluginsStarted = false;
    try {
        await pluginHost.startAll();
        const loadedIds = pluginHost.getLoadedPluginIds();
        logInfo(`Plugins started: ${loadedIds.join(", ") || "none"}`, "Main");
        pluginsStarted = true;
    } catch (err) {
        logErr(err, "PluginHost");
    }
    if (pluginsStarted) {
        ocrSystem.getManualLevelOverrides().forEach((entry, profileId) => {
            if (!entry.enabled) return;
            const cached = ocrSystem.getOcrCache().get(profileId) ?? { updatedAt: entry.updatedAt ?? Date.now() };
            cached.updatedAt = Math.max(cached.updatedAt || 0, entry.updatedAt ?? Date.now());
            ocrSystem.getOcrCache().set(profileId, cached);
            ocrSystem.broadcastManualLevelOverride(profileId);
        });
    }

    // Start overlay sync now that all plugin IPC handlers are registered.
    overlaysMgr.ensureRoiOverlay();
    overlaysMgr.ensureRoiSupportOverlay();
    const originalEnsure = services.sessionWindow.ensure.bind(services.sessionWindow);
    services.sessionWindow.ensure = async () => {
        const win = await originalEnsure();
        overlaysMgr.ensureRoiOverlay();
        overlaysMgr.ensureRoiSupportOverlay();
        return win;
    };

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

    // =========================================================================
    // Auto-Update (only in Production)
    // =========================================================================
    if (app.isPackaged) {
        try {
            const updateSettings = await createClientSettingsStore().get();
            setupAutoUpdater({
                getLocale: () => clientLocale,
                checkOnStart: updateSettings.checkForUpdatesOnStart ?? true,
            });
        } catch {
            setupAutoUpdater({
                getLocale: () => clientLocale,
                checkOnStart: true,
            });
        }
    } else {
        // Dev mode: register stubs so the renderer doesn't crash
        ipcMain.handle("app:checkForUpdates", async () => {
            return { ok: false, error: "Update check is not available in development mode." };
        });
        ipcMain.handle("app:listReleases", async () => {
            return { ok: false, error: "Not available in development mode." };
        });
        ipcMain.handle("app:installVersion", async () => {
            return { ok: false, error: "Not available in development mode." };
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
    // Allow session window to close without prompt
    sessionWindowController?.allowCloseWithoutPrompt();
    // Destroy side panel window
    const spWin = sidePanelMgr?.state.window;
    if (spWin && !spWin.isDestroyed()) {
        spWin.destroy();
    }

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

let startupComplete = false;
app.on("window-all-closed", () => {
    if (process.platform !== "darwin" && startupComplete) {
        app.quit();
    }
});

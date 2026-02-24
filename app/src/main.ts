/**
 * Main Entry Point (Unified with Plugin System)
 *
 * Core functionality with integrated plugin system.
 * EXP-Tracker, Questlog, Buff-Wecker are loaded as plugins from userData/plugins/
 */

import { app, BrowserWindow, Menu, session, ipcMain, globalShortcut, screen } from "electron";
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

import { createViewLoader } from "./main/viewLoader";
import { registerMainIpc } from "./main/ipc/registerMainIpc";
import { registerPluginHandlers } from "./main/ipc/handlers/plugins";
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

    // Create core services
    const services = createCoreServices({
        preloadPath,
        loadView,
        flyffUrl: URLS.FLYFF_PLAY,
        followIntervalMs: TIMINGS.OVERLAY_FOLLOW_MS,
        onInstanceOpened: () => {
            logWarn("Instance window opened", "Main");
        },
    });
    const roiVisibilityStore = createRoiVisibilityStore();

    sessionWindowController = services.sessionWindow;
    startupComplete = true;
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
        services.sessionTabs.setGameFont?.(clientSettingsSnap.gameFont ?? null);
        const uiPosEnabled = clientSettingsSnap.persistGameUiPositions ?? false;
        services.sessionTabs.setUiPositionPersistenceEnabled?.(uiPosEnabled);
    } catch (err) {
        logErr(err, "ClientSettings");
    }
    sidePanelButton = createSidePanelButtonController({
        sessionWindow: services.sessionWindow,
        sessionTabs: services.sessionTabs,
        getRegistryEntries: () => services.sessionRegistry.list().map((e) => ({
            window: e.window,
            tabsManager: e.tabsManager,
        })),
        profiles: services.profiles,
        preloadPath,
        clickThrough: overlayClickThrough,
    });
    await sidePanelButton.start();

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
        getSidePanelActiveProfileId: () => sidePanelButton?.getActiveProfileId?.() ?? undefined,
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
        services.sessionTabs.setGameFont?.(settings.gameFont ?? null);
        services.sessionTabs.setUiPositionPersistenceEnabled?.(settings.persistGameUiPositions ?? false);
        // Also propagate to all multi-window tab managers
        for (const entry of services.sessionRegistry.list()) {
            entry.tabsManager.setGameFont?.(settings.gameFont ?? null);
            entry.tabsManager.setUiPositionPersistenceEnabled?.(settings.persistGameUiPositions ?? false);
        }
        if (launcherWindow && !launcherWindow.isDestroyed()) {
            const display = screen.getDisplayMatching(launcherWindow.getBounds()) ?? screen.getPrimaryDisplay();
            const nextSize = fitLauncherSizeToWorkArea(launcherSize, display?.workAreaSize);
            const minWidth = Math.min(display.workAreaSize.width, LAYOUT.LAUNCHER_MIN_WIDTH);
            const minHeight = Math.min(display.workAreaSize.height, LAYOUT.LAUNCHER_MIN_HEIGHT);
            launcherWindow.setMinimumSize(minWidth, minHeight);
            launcherWindow.setSize(nextSize.width, nextSize.height);
        }
        hotkeysMgr.register(overlayHotkeys);
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
    });

    // Register plugin management IPC handlers
    registerPluginHandlers(safeHandle, { pluginHost, pluginStateStore, preloadPath }, ipcLogErr);

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

    // Start overlay sync now that all plugin IPC handlers are registered
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
        setupAutoUpdater({
            getLocale: () => clientLocale,
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

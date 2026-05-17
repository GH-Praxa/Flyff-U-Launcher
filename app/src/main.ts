/**
 * Main Entry Point (Unified with Plugin System)
 *
 * Core functionality with integrated plugin system.
 * EXP-Tracker, Questlog, Buff-Wecker are loaded as plugins from userData/plugins/
 */

import { app, BrowserWindow, Menu, session, ipcMain, globalShortcut, screen, webContents, type WebContents } from "electron";
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
import { createControllerInputRouter, DEFAULT_BUTTON_MAPPING, STEAMDECK_BUTTON_MAPPING, resolveButtonMapping, type ControllerButtonMapping, type ModifierSlot } from "./main/controller/inputRouter";
import { createSafeHandler } from "./main/ipc/common";
import { applyCSP, getCSPNonce } from "./main/security/harden";
import { logInfo, logErr, logWarn, setLogListener, initFileLogging } from "./shared/logger";
import { startLinuxGamepadReader } from "./main/controller/linuxGamepadReader";
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
import { translate } from "./i18n/translations";
import { injectToast } from "./main/ui/toastInjector";
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
    // Persistente Logs: alles unter <userData>/launcher.log, frisch pro Start.
    // Nuetzlich fuer Bug-Reports — User schickt das File statt Terminal copy/paste.
    try {
        const logPath = `${app.getPath("userData")}/launcher.log`;
        initFileLogging(logPath);
        logInfo(`File-Logging aktiv: ${logPath}`, "Main");
    } catch (err) {
        // Wenn File-Logging nicht startet, weiter ohne — kein Hard-Fail.
        console.error("initFileLogging failed:", err);
    }

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
    /** Pro Profil ein Array fuer die 8 Name-Slot-Anker (Index = Slot 0..7).
     *  `null` an Position = Slot nicht kalibriert. Wird beim Initial-Load und
     *  beim Calibrate-IPC gepflegt. */
    const nameSlotAnchors = new Map<string, Array<import("./main/controller/inputRouter").ActionPadAnchor | null>>();

    // Create core services
    // Buffer-Forward-Ziele pro Profil — wird unten gefuellt. Vorgezogen,
    // damit der `getInputActiveProfile`-Closure unten die Map referenzieren
    // kann (Lazy-Lookup zur Call-Zeit).
    const bufferTargets = new Map<string, string>();

    /**
     * Liefert das fuer Gamepad-Input "primaere" Profil. Aktuell einfach
     * sessionActiveId durchreichen — der User soll explizit kontrollieren
     * koennen, welcher Tab Gamepad-Input bekommt (per Tab-Switch oder Klick).
     *
     * Frueher: hier wurde Buffer-Target zu Source umgemappt, damit Klicks auf
     * den RM-Tab den Forward-Workflow nicht zerstoeren. Das hat aber den
     * legitimen Use-Case "User will RM direkt mit dem Gamepad steuern"
     * unmoeglich gemacht. Spurious-Polling vom CDP-Attach-Focus-Event wird
     * bereits durch das Preload-Polling-Gate (session:setActive) verhindert
     * — nur der active Tab pollt. Diese hier zusaetzliche Schicht ist
     * dadurch redundant.
     */
    const getInputActiveProfile = (sessionActiveId: string | null): string | null => {
        return sessionActiveId;
    };

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
        getInputActiveProfile,
    });

    // ACHTUNG: Initial-Befuellung der Profile-Caches (actionPadAnchors,
    // buttonMappings, modifierMappings, iconCache, bufferTargets) wurde nach
    // unten verschoben — direkt nach den jeweiligen const-Definitionen.
    // Frueher hatte das Promise hier eine TDZ-Race: wenn services.profiles.list()
    // schneller resolved als der erste `await` weiter unten, lief der .then()-
    // Callback BEVOR die `bufferTargets`-Map (und die reload*-Funktionen)
    // ueberhaupt deklariert waren → ReferenceError → vom .catch() verschluckt
    // → bufferTargets blieb leer bis zum ersten manuellen "Speichern" im
    // Controller-Menue. Symptom: Ringmaster-Forward greift erst nach Save.
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

    // IPC: Launcher-Settings auf eine bestimmte Section oeffnen. Wird zB vom
    // Controller-Button in der Session-Window-Tab-Leiste benutzt — der User
    // ist im Game-Tab und will direkt zur Controller-Belegung.
    ipcMain.on("launcher:openConfigSection", (_e, payload) => {
        try {
            const section = (payload as { section?: unknown })?.section;
            const compact = (payload as { compact?: unknown })?.compact === true;
            if (!launcherWindow || launcherWindow.isDestroyed()) {
                logWarn("launcher:openConfigSection: launcherWindow nicht verfuegbar", "Main");
                return;
            }
            // Launcher in den Vordergrund holen — sonst hat der User keine
            // Sichtbarkeit auf das gerade geoeffnete Modal.
            if (launcherWindow.isMinimized()) launcherWindow.restore();
            launcherWindow.show();
            launcherWindow.focus();
            // WICHTIG: compact-Flag mit durchreichen — sonst oeffnet sich das
            // volle Settings-Modal mit Sidebar statt einer fokussierten
            // Controller-Ansicht.
            launcherWindow.webContents.send("launcher:openConfigSection", { section, compact });
        } catch (err) {
            logErr(err, "launcher:openConfigSection");
        }
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
    // Zeigt einen Toast auf ALLEN aktiven Fenstern an: Launcher, Session-Fenster
    // und Instance-/Spiel-Fenster. Pro Fenster genau eine WebContents — bei
    // Session-Fenstern der sichtbare aktive Tab (nicht jeder BrowserView).
    // Side-Panel und transparente ROI-Overlays sind bewusst ausgenommen.
    // Injektion via executeJavaScript, damit der Toast auch auf der
    // Flyff-Spielseite erscheint, die keinen eigenen Renderer/Toast besitzt.
    const broadcastToast = (msg: string, tone: "info" | "success" | "error" = "info") => {
        const seen = new Set<number>();
        const send = (wc: WebContents | null | undefined) => {
            if (!wc || wc.isDestroyed() || seen.has(wc.id)) return;
            seen.add(wc.id);
            injectToast(wc, msg, tone, toastDurationMs);
        };

        // Launcher-Hauptfenster
        if (launcherWindow && !launcherWindow.isDestroyed()) send(launcherWindow.webContents);

        // Session-Fenster: aktiver Tab → genau 1× pro Fenster
        const sessionWindowIds = new Set<number>();
        const visitSession = (
            win: BrowserWindow | null | undefined,
            activeView: { webContents: WebContents } | null,
        ) => {
            if (!win || win.isDestroyed()) return;
            sessionWindowIds.add(win.id);
            if (activeView && !activeView.webContents.isDestroyed()) send(activeView.webContents);
            else send(win.webContents);
        };
        try {
            visitSession(services.sessionWindow.get?.(), services.sessionTabs.getActiveView?.() ?? null);
        } catch (err) { logErr(err, "broadcastToast.primarySession"); }
        try {
            for (const entry of services.sessionRegistry.list()) {
                visitSession(entry.window, entry.tabsManager.getActiveView?.() ?? null);
            }
        } catch (err) { logErr(err, "broadcastToast.sessionRegistry"); }

        // Uebrige Top-Level-Fenster = Instance-/Spiel-Fenster.
        // Ausgeschlossen: Launcher, Session-Fenster, Side-Panel, ROI-Overlays.
        const excluded = new Set<number>(sessionWindowIds);
        if (launcherWindow && !launcherWindow.isDestroyed()) excluded.add(launcherWindow.id);
        const spWin = sidePanelMgr?.state.window;
        if (spWin && !spWin.isDestroyed()) excluded.add(spWin.id);
        const roiOverlay = overlaysMgr.state.roiOverlayWindow;
        if (roiOverlay && !roiOverlay.isDestroyed()) excluded.add(roiOverlay.id);
        const roiSupportOverlay = overlaysMgr.state.roiSupportOverlayWindow;
        if (roiSupportOverlay && !roiSupportOverlay.isDestroyed()) excluded.add(roiSupportOverlay.id);
        for (const win of BrowserWindow.getAllWindows()) {
            if (win.isDestroyed() || excluded.has(win.id)) continue;
            send(win.webContents);
        }
    };

    // Controller-Meldungen werden auf allen aktiven Fenstern angezeigt.
    const controllerToast = (msg: string, tone: "info" | "success" | "error" = "info") => {
        broadcastToast(msg, tone);
    };
    // Cache fuer Per-Profil-Button-Mapping (Override → vollstaendiges Mapping).
    // Wird beim Start aus den Profilen befuellt und bei jedem Profil-Update
    // aktualisiert.
    const buttonMappings = new Map<string, ControllerButtonMapping>();

    // `bufferTargets` ist OBEN (vor createCoreServices) bereits deklariert,
    // damit der `getInputActiveProfile`-Closure dort drauf zugreifen kann.
    // Hier nur noch die Reload-Logik.
    const reloadBufferTargetForProfile = (profileId: string, targetId: unknown) => {
        if (typeof targetId === "string" && targetId.length > 0 && targetId !== profileId) {
            bufferTargets.set(profileId, targetId);
        } else {
            bufferTargets.delete(profileId);
        }
    };

    // Bevorzugter Controller pro Profil: profileId → gamepad.id. Wird im
    // Overlay-Payload (`preferredGamepadId`) an den Preload gepusht, der dann
    // gezielt diesen Pad pollt statt blind den ersten verbundenen. Leerer/
    // fehlender Eintrag = Automatik (erster Pad). Update bei jedem Profil-Save.
    const gamepadIds = new Map<string, string>();
    const reloadGamepadIdForProfile = (profileId: string, gamepadId: unknown) => {
        if (typeof gamepadId === "string" && gamepadId.length > 0) {
            gamepadIds.set(profileId, gamepadId);
        } else {
            gamepadIds.delete(profileId);
        }
    };
    /**
     * Style bestimmt die Default-Belegung: "steamdeck" → STEAMDECK_BUTTON_MAPPING
     * (Paddles auf Skill-Slots 4–7 vorbelegt), alles andere → DEFAULT_BUTTON_MAPPING.
     * Ohne Override muss trotzdem ein Eintrag in buttonMappings stehen, damit
     * Deck-User die Paddle-Defaults bekommen, auch wenn sie nichts manuell
     * belegt haben.
     */
    const baseMappingForStyle = (style: unknown): ControllerButtonMapping => {
        return style === "steamdeck" ? STEAMDECK_BUTTON_MAPPING : DEFAULT_BUTTON_MAPPING;
    };
    const reloadButtonMappingsForProfile = (profileId: string, override: unknown, style: unknown) => {
        const base = baseMappingForStyle(style);
        if (override && typeof override === "object") {
            buttonMappings.set(profileId, resolveButtonMapping(override as Record<string, string | null | undefined>, base));
        }
        else if (style === "steamdeck") {
            buttonMappings.set(profileId, { ...base });
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
        getNameSlotAnchor: (sender, slot) => {
            const profileId = webContentsToProfile.get(sender.id);
            if (!profileId) return null;
            const slots = nameSlotAnchors.get(profileId);
            if (!slots) return null;
            return slots[slot] ?? null;
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
        getViewportFor: (wc) => {
            // Liefert die echte Viewport-Groesse einer WebContents (= die
            // BrowserView-Bounds des entsprechenden Profils). Wird vom Router
            // benoetigt damit Camera-Drag-Events an Forward-Target-Tabs mit
            // korrekten Koordinaten dispatchen — sonst nutzt der Router die
            // Frame-Viewport-Groesse des SENDERS, die in Split-Layouts vom
            // Target abweichen kann.
            const profileId = webContentsToProfile.get(wc.id);
            if (!profileId) return null;
            for (const entry of services.sessionRegistry.list()) {
                const tm = entry.tabsManager as unknown as {
                    hasLoadedProfile?: (id: string) => boolean;
                    getBounds?: (id: string) => { width: number; height: number };
                };
                if (typeof tm.hasLoadedProfile === "function" && !tm.hasLoadedProfile(profileId)) continue;
                if (typeof tm.getBounds !== "function") continue;
                const bounds = tm.getBounds(profileId);
                if (bounds && bounds.width > 0 && bounds.height > 0) {
                    return { width: bounds.width, height: bounds.height };
                }
            }
            return null;
        },
        isActiveSender: (sender) => {
            // Frame-Filter: nur Frames vom input-active Profil akzeptieren.
            // Wird via `getInputActiveProfile` aufgeloest — wenn sessionActiveId
            // ein Buffer-Target ist (User-Klick auf RM in Multi-Layout o.ae.),
            // mapped das auf den Source-Profile zurueck. Damit bleibt Main
            // input-active auch wenn der User auf RM klickt.
            const profileId = webContentsToProfile.get(sender.id);
            if (!profileId) return false;
            for (const entry of services.sessionRegistry.list()) {
                const tm = entry.tabsManager as unknown as {
                    getActiveId?: () => string | null;
                };
                if (typeof tm.getActiveId !== "function") continue;
                const inputActive = getInputActiveProfile(tm.getActiveId() ?? null);
                if (inputActive === profileId) return true;
            }
            return false;
        },
        getBufferTarget: (sender) => {
            // Buffer-Forward-Ziel aufloesen: vom sender → Profil-ID →
            // Profil's `controller.bufferTargetProfileId` → Ziel-Profil-ID →
            // dessen aktive WebContents (BrowserView im selben SessionWindow,
            // oder in einem anderen Window). Wenn nicht konfiguriert oder
            // Ziel nicht offen: null → Hold-Action no-op.
            const senderProfileId = webContentsToProfile.get(sender.id);
            if (!senderProfileId) {
                logWarn(`getBufferTarget: sender wcId=${sender.id} not in webContentsToProfile (registered=${webContentsToProfile.size})`, "Controller");
                return null;
            }
            const targetId = bufferTargets.get(senderProfileId);
            if (!targetId) {
                logWarn(`getBufferTarget: profile ${senderProfileId} has no buffer target (cache size=${bufferTargets.size})`, "Controller");
                return null;
            }
            // Ziel-WebContents in der Reverse-Map suchen.
            for (const [wcId, profId] of webContentsToProfile.entries()) {
                if (profId !== targetId) continue;
                const wc = webContents.fromId(wcId);
                if (wc && !wc.isDestroyed()) {
                    logInfo(`getBufferTarget: ${senderProfileId} → ${targetId} (wcId=${wcId})`, "Controller");
                    return wc;
                }
            }
            logWarn(`getBufferTarget: target profile ${targetId} has no live WebContents (registered=${webContentsToProfile.size})`, "Controller");
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

    // Initial-Befuellung der Profile-Caches — JETZT nach allen reload-Funktionen
    // und Map-Definitionen (actionPadAnchors, buttonMappings, modifierMappings,
    // controllerIcons, modifierIcons, bufferTargets). Frueher stand das Promise
    // weiter oben → TDZ-Race wenn services.profiles.list() vor dem ersten
    // await resolved → ReferenceError vom .catch() verschluckt → bufferTargets
    // blieb leer bis "Speichern" im Controller-Menue → Ringmaster-Forward
    // greift erst nach Save (Bug 1, v3.7.8 Fix).
    void services.profiles.list().then((profiles) => {
        logInfo(`Initial profile cache fill: ${profiles.length} profiles`, "Main");
        for (const p of profiles) {
            type AnchorShape = {
                hAnchor: "left" | "center" | "right";
                vAnchor: "top" | "middle" | "bottom";
                offsetX: number;
                offsetY: number;
            };
            const c = (p as unknown as {
                controller?: {
                    actionPad?: AnchorShape | null;
                    nameSlots?: Array<AnchorShape | null>;
                    buttons?: Record<string, string | null | undefined>;
                    modifiers?: Record<string, unknown>;
                    bufferTargetProfileId?: string | null;
                    style?: string;
                    gamepadId?: string | null;
                };
            }).controller;
            if (c?.actionPad) actionPadAnchors.set(p.id, c.actionPad);
            if (Array.isArray(c?.nameSlots) && c.nameSlots.length > 0) {
                nameSlotAnchors.set(p.id, c.nameSlots.slice());
            }
            // Steam-Deck-Profile bekommen auch ohne expliziten Override ein
            // Mapping (Paddle-Defaults). Daher unbedingt aufrufen, nicht nur
            // wenn c?.buttons gesetzt ist.
            reloadButtonMappingsForProfile(p.id, c?.buttons, c?.style);
            if (c?.modifiers) reloadModifierMappingsForProfile(p.id, c.modifiers);
            reloadIconsForProfile(p.id, c);
            reloadBufferTargetForProfile(p.id, c?.bufferTargetProfileId);
            reloadGamepadIdForProfile(p.id, c?.gamepadId);
        }
    }).catch((err) => {
        logErr(err, "Profile cache init");
    });

    const buildOverlayPayload = (profileId: string) => {
        const base = buttonMappings.get(profileId) ?? DEFAULT_BUTTON_MAPPING;
        const mod = modifierMappings.get(profileId);
        const baseIc = controllerIcons.get(profileId) ?? {};
        const modIc = modifierIcons.get(profileId);
        return {
            enabled: true,
            // Bevorzugter Controller fuer dieses Profil — der Preload-Polling-
            // Loop waehlt gezielt den Pad mit diesem `gamepad.id`. null =
            // Automatik (erster verbundener Pad).
            preferredGamepadId: gamepadIds.get(profileId) ?? null,
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
    // Overlay-Event-Relay: Mains Preload meldet Modifier-Wechsel und Face-
    // Presses an Main. Bei aktivem Forward leiten wir das an die forwardTarget-
    // WC weiter, damit RM's Overlay ebenfalls den Modifier-Layer zeigt und
    // den gedrueckten Face-Slot blitzt — passend zu der Tatsache dass RM
    // gerade die Inputs verarbeitet.
    ipcMain.on("controller:overlayEvent", (event, payload) => {
        try {
            const target = controllerRouter.getActiveForwardTarget();
            if (!target || target.isDestroyed()) return;
            if (target.id === event.sender.id) return; // gleicher WC, kein Relay noetig
            target.send("controller:overlayEvent:relay", payload);
        } catch (err) {
            logErr(err, "controller:overlayEvent");
        }
    });

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
        if (!payload || typeof payload !== "object") {
            logWarn("controller:setBufferTarget: invalid payload", "Main");
            return { ok: false };
        }
        const p = payload as Record<string, unknown>;
        const profileId = typeof p.profileId === "string" ? p.profileId : null;
        const targetId = typeof p.targetId === "string" && p.targetId.length > 0 ? p.targetId : null;
        if (!profileId) {
            logWarn("controller:setBufferTarget: missing profileId", "Main");
            return { ok: false };
        }
        reloadBufferTargetForProfile(profileId, targetId);
        logInfo(`controller:setBufferTarget profile=${profileId} target=${targetId ?? "null"} (cache size=${bufferTargets.size})`, "Main");
        return { ok: true };
    });

    registerControllerHandlers({
        router: controllerRouter,
        onControllerConnected: (info) => {
            controllerToast(
                translate(clientLocale, "controller.toast.connected")
                    .replace("{id}", info.id)
                    .replace("{mapping}", info.mapping),
                "success",
            );
        },
        getProfileForWebContents: (wc) => webContentsToProfile.get(wc.id) ?? null,
        setActionPadAnchor: async (profileId, anchor) => {
            actionPadAnchors.set(profileId, anchor);
            await services.profiles.update({
                id: profileId,
                controller: { actionPad: anchor },
            } as Parameters<typeof services.profiles.update>[0]);
        },
        setNameSlotAnchor: async (profileId, slot, anchor) => {
            const existing = nameSlotAnchors.get(profileId)?.slice() ?? [];
            while (existing.length <= slot) existing.push(null);
            existing[slot] = anchor;
            nameSlotAnchors.set(profileId, existing);
            await services.profiles.update({
                id: profileId,
                controller: { nameSlots: existing },
            } as Parameters<typeof services.profiles.update>[0]);
            // Renderer (Launcher + ggf. Session-Window) ueber den neuen Anker
            // informieren, damit die Slot-Card-UI sofort aktualisiert.
            try {
                if (launcherWindow && !launcherWindow.isDestroyed()) {
                    launcherWindow.webContents.send("controller:nameSlot:updated", { profileId, slot, anchor });
                }
            } catch { /* ignore */ }
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
                    style?: string;
                    gamepadId?: string | null;
                };
            } | undefined)?.controller;
            reloadButtonMappingsForProfile(profileId, c?.buttons, c?.style);
            reloadModifierMappingsForProfile(profileId, c?.modifiers);
            reloadIconsForProfile(profileId, c);
            reloadBufferTargetForProfile(profileId, c?.bufferTargetProfileId);
            reloadGamepadIdForProfile(profileId, c?.gamepadId);
            // Overlay aktualisieren — laufende Spiel-Views sehen die neuen
            // Bindings sofort, kein Reload noetig.
            pushOverlayToProfile(profileId);
        },
        notify: (msg, tone) => controllerToast(msg, tone),
    });

    /**
     * Trigger Action-Pad-/Name-Slot-Kalibrierung. Zwei Modi:
     *   - `profileId === null`: an alle aktuell fokussierten Spiel-WCs (Global-
     *     Shortcut-Pfad — User hat das Spiel im Vordergrund).
     *   - `profileId` gesetzt: an alle Spiel-WCs, kein Fokus-Filter. Der
     *     `profileId` wird im Start-Payload mitgeschickt; der Preload echot ihn
     *     bei der erfassten Mauspositon zurueck. Damit ist es egal, in welcher
     *     Profil-View der User klickt — Anker geht immer ans gewuenschte
     *     Profil. Loest UX-Stolperfalle, wenn das Modal-Profil nicht das
     *     gerade im Session-Window aktive Profil ist.
     */
    const dispatchCalibrate = (slot: number | null, profileId: string | null = null): number => {
        if (webContentsToProfile.size === 0) {
            controllerToast(
                slot === null
                    ? "Action-Pad-Lehrmodus: kein Spiel-Fenster offen"
                    : `Slot-${slot + 1}-Lehrmodus: kein Spiel-Fenster offen`,
                "error",
            );
            return 0;
        }
        let dispatched = 0;
        for (const [wcId] of webContentsToProfile) {
            const wc = webContents.fromId(wcId);
            if (!wc || wc.isDestroyed()) continue;
            if (profileId === null && !wc.isFocused()) continue;
            const payload: Record<string, number | string> = {};
            if (slot !== null) payload.slot = slot;
            if (profileId !== null) payload.profileId = profileId;
            wc.send("controller:calibrate:start", Object.keys(payload).length > 0 ? payload : undefined);
            dispatched++;
        }
        if (dispatched === 0) {
            controllerToast(
                profileId !== null
                    ? "Kalibrierung: kein Spiel-Fenster offen"
                    : "Lehrmodus: bitte zuerst das Spiel-Fenster anklicken",
                "error",
            );
            return 0;
        }
        controllerToast(
            slot === null
                ? "Lehrmodus aktiv — klicke auf das Action-Pad im Spiel (10 s)"
                : `Lehrmodus aktiv — wechsle ins Spielfenster und klicke auf den Namen für Slot ${slot + 1} (10 s)`,
            "info",
        );
        return dispatched;
    };

    // Lehrmodus-Trigger: Strg+Shift+F1 schickt allen aktuell fokussierten
    // Flyff-WebContents ein controller:calibrate:start; der Preload fängt
    // den naechsten Maus-Klick ab und meldet die Position zurueck. Nur die
    // fokussierte WebContents reagiert (via webContents.isFocused()) — falls
    // keine, kommt eine Toast-Fehlermeldung.
    try {
        const ok = globalShortcut.register("Control+Shift+F1", () => {
            dispatchCalibrate(null);
        });
        if (!ok) logWarn("Failed to register Ctrl+Shift+F1 for action-pad calibration", "Controller");
    } catch (err) {
        logWarn(`globalShortcut.register failed: ${(err as Error).message}`, "Controller");
    }

    // UI-Trigger fuer Slot-Kalibrierung (Renderer ruft per ipcRenderer.send).
    // Payload: { slot?: 0..7, profileId?: string }.
    // - `slot` fehlt = Action-Pad-Kalibrierung
    // - `profileId` gesetzt = Ziel-WCs ueber Profil-Filter statt Fokus
    // Linux-Native-Gamepad-Reader: liest `/dev/input/jsX` direkt im Main-
    // Prozess, umgeht das Chromium-User-Activation-Gate fuer `navigator.
    // getGamepads()`. Schon-gesteckte Controller sind dadurch sofort nach
    // Launcher-Start verfuegbar, ohne Replug oder "Aufweck-Klick".
    //
    // Sender-WC-Strategie: jeder Frame braucht eine Ziel-WebContents. Wir
    // nehmen den aktuell input-aktiven Session-Tab (wie bei Preload-Frames
    // auch). Wenn kein Spiel-Tab offen ist → frame droppen.
    if (process.platform === "linux") {
        const findActiveSessionWc = (): Electron.WebContents | null => {
            for (const entry of services.sessionRegistry.list()) {
                const tm = entry.tabsManager as unknown as { getActiveId?: () => string | null };
                if (typeof tm.getActiveId !== "function") continue;
                const activeId = tm.getActiveId();
                if (!activeId) continue;
                for (const [wcId, pid] of webContentsToProfile) {
                    if (pid !== activeId) continue;
                    const wc = webContents.fromId(wcId);
                    if (wc && !wc.isDestroyed()) return wc;
                }
            }
            return null;
        };
        const stopReader = startLinuxGamepadReader({
            onFrame: (frame) => {
                const wc = findActiveSessionWc();
                if (!wc) return; // kein Spiel-Tab → ignorieren
                try {
                    controllerRouter.handleFrame(frame, wc);
                } catch (err) {
                    logErr(err, "LinuxGamepad.handleFrame");
                }
            },
            onConnected: (info) => {
                controllerToast(
                    translate(clientLocale, "controller.toast.connected")
                        .replace("{id}", info.id)
                        .replace("{mapping}", info.mapping),
                    "success",
                );
            },
            onDisconnected: () => {
                logInfo("[LinuxGamepad] disconnected", "controller");
            },
            getViewportSize: () => {
                // Router zieht die echten Bounds via getViewportFor, das hier
                // ist nur Fallback. 1920×1080 ist ein vernuenftiger Default.
                return { width: 1920, height: 1080 };
            },
        });
        app.on("before-quit", () => { try { stopReader(); } catch { /* ignore */ } });
    }

    ipcMain.on("controller:requestCalibrate", (_event, payload) => {
        try {
            let slot: number | null = null;
            let profileId: string | null = null;
            if (payload && typeof payload === "object") {
                const obj = payload as Record<string, unknown>;
                if (typeof obj.slot === "number" && Number.isInteger(obj.slot) && obj.slot >= 0 && obj.slot < 8) {
                    slot = obj.slot;
                }
                if (typeof obj.profileId === "string" && obj.profileId.length > 0) {
                    profileId = obj.profileId;
                }
            }
            dispatchCalibrate(slot, profileId);
        } catch (err) {
            logWarn(`controller:requestCalibrate failed: ${(err as Error).message}`, "Controller");
        }
    });

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

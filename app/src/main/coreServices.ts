/**
 * Core Services Factory
 *
 * Creates only the essential core services needed for the launcher.
 * Feature services (EXP-Tracker, Questlog, Buff-Wecker) are loaded as plugins.
 */

import { createProfilesStore } from "./profiles/store";
import { createLauncherWindow } from "./windows/launcherWindow";
import { createSessionWindowController, createSessionWindow } from "./windows/sessionWindow";
import { createInstanceWindow } from "./windows/instanceWindow";
import { registerUiPositionInjection } from "./sessionTabs/uiPositionInjector";
import { createInstanceRegistry } from "./windows/instanceRegistry";
import { createSessionRegistry } from "./windows/sessionRegistry";
import { createSessionTabsManager } from "./sessionTabs/manager";
import { createTabLayoutsStore } from "./sessionTabs/layoutStore";
import { createThemeStore } from "./themeStore";
import { createRoiStore } from "./roi/roiStore";
import { createRoiController } from "./roi/roiController";
import type { LoadView } from "./viewLoader";
import { logErr } from "../shared/logger";
import { createFeatureStore } from "./features/store";
import { createClientSettingsStore } from "./clientSettings/store";

// ============================================================================
// Types
// ============================================================================

export type CoreServices = {
    profiles: ReturnType<typeof createProfilesStore>;
    tabLayouts: ReturnType<typeof createTabLayoutsStore>;
    themes: ReturnType<typeof createThemeStore>;
    features: ReturnType<typeof createFeatureStore>;
    clientSettings: ReturnType<typeof createClientSettingsStore>;
    sessionWindow: ReturnType<typeof createSessionWindowController>; // Legacy singleton
    sessionTabs: ReturnType<typeof createSessionTabsManager>; // Legacy singleton manager
    sessionRegistry: ReturnType<typeof createSessionRegistry>; // Multi-window registry
    instances: ReturnType<typeof createInstanceRegistry>;
    roiStore: ReturnType<typeof createRoiStore>;
    roiController: ReturnType<typeof createRoiController>;
    createInstanceWindow: (profileId: string) => Promise<void>;
    createTabWindow: (opts?: { name?: string }) => Promise<string>; // Returns windowId
    createLauncherWindow: typeof createLauncherWindow;
};

export type CreateCoreServicesOptions = {
    preloadPath: string;
    loadView: LoadView;
    flyffUrl: string;
    followIntervalMs?: number;
    /** Optional callback when instance window is opened (for plugin refresh) */
    onInstanceOpened?: () => void;
};

// ============================================================================
// Factory
// ============================================================================

/**
 * Creates all core services for the launcher.
 * Does NOT include feature services (EXP-Tracker, Questlog) - those are loaded as plugins.
 */
export function createCoreServices(opts: CreateCoreServicesOptions): CoreServices {
    // Independent stores
    const profiles = createProfilesStore();
    const tabLayouts = createTabLayoutsStore();
    const themes = createThemeStore();
    const features = createFeatureStore();
    const clientSettings = createClientSettingsStore();
    const roiStore = createRoiStore();

    // Session window and tabs (with dependencies)
    const sessionWindow = createSessionWindowController({
        preloadPath: opts.preloadPath,
        loadView: opts.loadView,
        shouldMaximize: async () => {
            const settings = await clientSettings.get();
            return settings.startFullscreen;
        },
    });

    const sessionTabs = createSessionTabsManager({
        sessionWindow,
        flyffUrl: opts.flyffUrl,
    });

    // Reset tabs when session window is closed and restore visibility for next launch
    sessionWindow.onClosed(() => {
        sessionTabs.setVisible(true);
        sessionTabs.reset();
    });

    // Instance registry
    const instances = createInstanceRegistry();
    const activeInstances = new Map<string, number>();
    const instanceIdCounters = new Map<string, number>();

    // Session window registry for multi-window support
    const sessionRegistry = createSessionRegistry();
    const allocateInstancePartition = (profileId: string) => {
        const active = activeInstances.get(profileId) ?? 0;
        activeInstances.set(profileId, active + 1);
        const release = () => {
            const current = activeInstances.get(profileId) ?? 1;
            const next = Math.max(0, current - 1);
            if (next === 0) {
                activeInstances.delete(profileId);
            }
            else {
                activeInstances.set(profileId, next);
            }
        };
        // First instance keeps the stable partition so saved logins continue to work.
        if (active === 0) {
            instanceIdCounters.set(profileId, 1);
            return { partition: `persist:${profileId}`, release };
        }
        const nextId = (instanceIdCounters.get(profileId) ?? 1) + 1;
        instanceIdCounters.set(profileId, nextId);
        return {
            partition: `persist:${profileId}-instance-${nextId}`,
            release,
        };
    };

    // ROI controller (without overlayTarget dependency - plugins will subscribe to events)
    const roiController = createRoiController({
        instances,
        sessionWindowController: sessionWindow,
        sessionTabs,
        roiStore,
        overlayTarget: null, // No direct overlay dependency in core
        preloadPath: opts.preloadPath,
        followIntervalMs: opts.followIntervalMs,
        sessionRegistry,
    });

    // Tab window factory for multi-window support
    const createTabWindowBound = async (windowOpts?: { name?: string }): Promise<string> => {
        const settings = await clientSettings.get();
        const windowId = `session-${Date.now()}`;

        const win = await createSessionWindow({
            preloadPath: opts.preloadPath,
            loadView: opts.loadView,
            shouldMaximize: async () => settings.startFullscreen,
            windowId,
            params: { windowId }, // Pass windowId as URL parameter
        });

        // Create a window-specific SessionWindowController wrapper
        const windowController = {
            ensure: async () => win,
            get: () => win.isDestroyed() ? null : win,
        };

        const tabsManager = createSessionTabsManager({
            sessionWindow: windowController,
            flyffUrl: opts.flyffUrl,
            windowId,
        });

        // Inherit UI position persistence setting from client settings
        tabsManager.setUiPositionPersistenceEnabled(settings.persistGameUiPositions ?? false);

        // Reset tabs when window is closed
        win.on("closed", () => {
            tabsManager.setVisible(true);
            tabsManager.reset();
        });

        // Register in registry
        const id = sessionRegistry.register(win, tabsManager, { name: windowOpts?.name });

        return id;
    };

    // Instance window factory
    const createInstanceWindowBound = async (profileId: string) => {
        const settings = await clientSettings.get();
        const { partition, release } = allocateInstancePartition(profileId);
        const existingForProfile = instances.list(profileId).length;
        const existingTotal = instances.all().length;
        const win = createInstanceWindow(profileId, {
            flyffUrl: opts.flyffUrl,
            startFullscreen: settings.startFullscreen,
            partition,
        });
        try {
            win.setTitle(`Flyff - ${profileId}${existingForProfile > 0 ? ` (${existingForProfile + 1})` : ""}`);
        }
        catch (err) {
            logErr(err, "InstanceTitle");
        }
        if (!settings.startFullscreen && existingTotal > 0) {
            const step = 28;
            const offset = Math.min(existingTotal, 6); // avoid drifting off-screen
            try {
                win.setPosition(80 + step * offset, 80 + step * offset);
            } catch (err) {
                logErr(err, "InstancePosition");
            }
        }
        // Register UI position injection for instance windows
        registerUiPositionInjection(
            win.webContents,
            () => sessionTabs.getUiPositionPersistenceEnabled(),
        );
        win.on("closed", release);
        instances.register(profileId, win);

        // Notify plugins through optional callback
        if (opts.onInstanceOpened) {
            try {
                opts.onInstanceOpened();
            } catch (err) {
                logErr(err, "CoreServices");
            }
        }
    };

    return {
        profiles,
        tabLayouts,
        themes,
        features,
        clientSettings,
        sessionWindow,
        sessionTabs,
        sessionRegistry,
        instances,
        roiStore,
        roiController,
        createInstanceWindow: createInstanceWindowBound,
        createTabWindow: createTabWindowBound,
        createLauncherWindow,
    };
}

// ============================================================================
// Plugin Service Adapters
// ============================================================================

/**
 * Creates service adapters for plugins from core services.
 * These adapters provide the PluginServices interface expected by plugins.
 */
export function createPluginServiceAdapters(
    core: CoreServices,
    pythonExe: string = "python"
): import("../shared/pluginApi").PluginServices {
    return {
        profiles: {
            list: async () => core.profiles.list() as Promise<import("../shared/pluginApi").ProfileData[]>,
            get: async (id: string) => {
                const all = await core.profiles.list();
                const found = all.find((p) => p.id === id);
                return (found ?? null) as import("../shared/pluginApi").ProfileData | null;
            },
            getOverlayTargetId: async () => core.profiles.getOverlayTargetId(),
            getOverlaySupportTargetId: async () => core.profiles.getOverlaySupportTargetId(),
            onProfileChanged: (cb: (profiles: import("../shared/pluginApi").ProfileData[]) => void) => {
                // Profiles store doesn't have built-in change notification yet
                // This would need to be added or polled
                return () => {};
            },
        },

        sessionTabs: {
            getActiveId: () => core.sessionTabs.getActiveId(),
            isActive: (profileId: string) => core.sessionTabs.isActive(profileId),
            getViewByProfile: (profileId: string) => core.sessionTabs.getViewByProfile(profileId),
            getOpenProfileIds: () => {
                // Not directly available, return empty array for now
                // Plugins can track this themselves via onTabOpened/onTabClosed
                return [] as string[];
            },
            onActiveChanged: (cb: (profileId: string | null) => void) => {
                // Would need event system in sessionTabs
                return () => {};
            },
            onTabOpened: (cb: (profileId: string) => void) => {
                return () => {};
            },
            onTabClosed: (cb: (profileId: string) => void) => {
                return () => {};
            },
        },

        sessionWindow: {
            get: () => core.sessionWindow.get(),
            ensure: () => {
                // Note: the real ensure() is async, but the interface expects sync
                // We return the existing window or create synchronously
                const existing = core.sessionWindow.get();
                if (existing) return existing;
                // For the sync case, trigger async creation but return null
                // Plugins should use get() after onReady()
                core.sessionWindow.ensure();
                return core.sessionWindow.get()!;
            },
            getBounds: () => {
                const win = core.sessionWindow.get();
                return win ? win.getBounds() : null;
            },
            onReady: (cb: () => void) => {
                return () => {};
            },
            onClosed: (cb: () => void) => {
                core.sessionWindow.onClosed(cb);
                return () => {}; // Can't unsubscribe from onClosed
            },
        },

        instances: {
            get: (profileId: string) => core.instances.get(profileId) ?? null,
            list: (profileId: string) => core.instances.list(profileId),
            all: () => core.instances.all(),
            getFirst: () => core.instances.getFirst(),
            getAll: () => core.instances.getAllLatest(),
            onRegistered: (cb: (profileId: string, win: Electron.BrowserWindow) => void) => {
                return () => {};
            },
            onClosed: (cb: (profileId: string) => void) => {
                return () => {};
            },
        },

        roiStore: {
            get: async (profileId: string) => {
                const rois = await core.roiStore.get(profileId);
                if (!rois) return null;
                return {
                    lvl: rois.lvl ? {
                        x: rois.lvl.x,
                        y: rois.lvl.y,
                        width: rois.lvl.w,
                        height: rois.lvl.h,
                    } : undefined,
                    charname: (rois.charname ?? rois.nameLevel) ? {
                        x: (rois.charname ?? rois.nameLevel)!.x,
                        y: (rois.charname ?? rois.nameLevel)!.y,
                        width: (rois.charname ?? rois.nameLevel)!.w,
                        height: (rois.charname ?? rois.nameLevel)!.h,
                    } : undefined,
                    exp: (rois.exp ?? rois.expPercent) ? {
                        x: (rois.exp ?? rois.expPercent)!.x,
                        y: (rois.exp ?? rois.expPercent)!.y,
                        width: (rois.exp ?? rois.expPercent)!.w,
                        height: (rois.exp ?? rois.expPercent)!.h,
                    } : undefined,
                    lauftext: rois.lauftext ? {
                        x: rois.lauftext.x,
                        y: rois.lauftext.y,
                        width: rois.lauftext.w,
                        height: rois.lauftext.h,
                    } : undefined,
                    rmExp: rois.rmExp ? {
                        x: rois.rmExp.x,
                        y: rois.rmExp.y,
                        width: rois.rmExp.w,
                        height: rois.rmExp.h,
                    } : undefined,
                    enemyName: rois.enemyName ? {
                        x: rois.enemyName.x,
                        y: rois.enemyName.y,
                        width: rois.enemyName.w,
                        height: rois.enemyName.h,
                    } : undefined,
                    enemyHp: rois.enemyHp ? {
                        x: rois.enemyHp.x,
                        y: rois.enemyHp.y,
                        width: rois.enemyHp.w,
                        height: rois.enemyHp.h,
                    } : undefined,
                };
            },
            set: async (profileId: string, rois: import("../shared/pluginApi").RoiData) => {
                await core.roiStore.set(profileId, {
                    lvl: rois.lvl ? {
                        x: rois.lvl.x,
                        y: rois.lvl.y,
                        w: rois.lvl.width,
                        h: rois.lvl.height,
                    } : undefined,
                    charname: (rois.charname ?? rois.nameLevel) ? {
                        x: (rois.charname ?? rois.nameLevel)!.x,
                        y: (rois.charname ?? rois.nameLevel)!.y,
                        w: (rois.charname ?? rois.nameLevel)!.width,
                        h: (rois.charname ?? rois.nameLevel)!.height,
                    } : undefined,
                    exp: (rois.exp ?? rois.expPercent) ? {
                        x: (rois.exp ?? rois.expPercent)!.x,
                        y: (rois.exp ?? rois.expPercent)!.y,
                        w: (rois.exp ?? rois.expPercent)!.width,
                        h: (rois.exp ?? rois.expPercent)!.height,
                    } : undefined,
                    lauftext: rois.lauftext ? {
                        x: rois.lauftext.x,
                        y: rois.lauftext.y,
                        w: rois.lauftext.width,
                        h: rois.lauftext.height,
                    } : undefined,
                    rmExp: rois.rmExp ? {
                        x: rois.rmExp.x,
                        y: rois.rmExp.y,
                        w: rois.rmExp.width,
                        h: rois.rmExp.height,
                    } : undefined,
                    enemyName: rois.enemyName ? {
                        x: rois.enemyName.x,
                        y: rois.enemyName.y,
                        w: rois.enemyName.width,
                        h: rois.enemyName.height,
                    } : undefined,
                    enemyHp: rois.enemyHp ? {
                        x: rois.enemyHp.x,
                        y: rois.enemyHp.y,
                        w: rois.enemyHp.width,
                        h: rois.enemyHp.height,
                    } : undefined,
                });
            },
            onRoiChanged: (cb: (profileId: string, rois: import("../shared/pluginApi").RoiData) => void) => {
                return () => {};
            },
        },

        pythonOcr: {
            acquireWorker: async () => {
                // Dynamic import to avoid loading OCR if not needed
                const { acquireSharedOcrWorker } = await import("./ocr/workerPool");
                return acquireSharedOcrWorker(pythonExe);
            },
            releaseWorker: async () => {
                const { releaseSharedOcrWorker } = await import("./ocr/workerPool");
                return releaseSharedOcrWorker();
            },
        },
    };
}

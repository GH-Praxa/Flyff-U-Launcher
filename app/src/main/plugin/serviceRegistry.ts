/**
 * Service Registry
 *
 * Centralized DI container for plugin services.
 * Provides enhanced service adapters with event subscriptions.
 */

import { app, BrowserWindow, BrowserView, net } from "electron";
import path from "path";
import fs from "fs/promises";
import type { CoreServices } from "../coreServices";
import type {
    PluginServices,
    ProfilesService,
    SessionTabsService,
    SessionWindowService,
    InstancesService,
    ThemesService,
    FeaturesService,
    RoiStoreService,
    PythonOcrService,
    DataCacheService,
    ProfileData,
    RoiData,
    ThemeData,
    FeatureFlagsData,
    PluginManifest,
    PluginPermission,
} from "../../shared/pluginApi";
import { logErr } from "../../shared/logger";

// ============================================================================
// Extended Service Types (with event support)
// ============================================================================

export interface StorageService {
    /** Read data from plugin storage */
    read<T = unknown>(key: string): Promise<T | undefined>;
    /** Write data to plugin storage */
    write<T>(key: string, data: T): Promise<void>;
    /** Delete data from plugin storage */
    delete(key: string): Promise<boolean>;
    /** List all keys in plugin storage */
    keys(): Promise<string[]>;
    /** Clear all plugin storage */
    clear(): Promise<void>;
}

export interface NotificationsService {
    /** Show a toast notification */
    toast(message: string, options?: ToastOptions): void;
    /** Show a system notification */
    system(title: string, body: string, options?: SystemNotificationOptions): void;
}

export interface ToastOptions {
    type?: "info" | "success" | "warning" | "error";
    duration?: number; // ms, default 3000
    action?: { label: string; callback: () => void };
}

export interface SystemNotificationOptions {
    icon?: string;
    silent?: boolean;
    urgency?: "normal" | "critical" | "low";
}

export interface HttpService {
    /** Fetch a URL (bypasses CORS restrictions) */
    fetch(url: string, options?: HttpFetchOptions): Promise<HttpResponse>;
    /** Fetch JSON from a URL */
    fetchJson<T = unknown>(url: string, options?: HttpFetchOptions): Promise<T>;
}

export interface HttpFetchOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    headers?: Record<string, string>;
    body?: string | Record<string, unknown>;
    timeout?: number; // ms
}

export interface HttpResponse {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    text(): Promise<string>;
    json<T = unknown>(): Promise<T>;
}

// ============================================================================
// Extended Plugin Services
// ============================================================================

export interface ExtendedPluginServices extends PluginServices {
    storage?: StorageService;
    notifications?: NotificationsService;
    http?: HttpService;
}

// ============================================================================
// Event Emitter Registry
// ============================================================================

type EventCallback<T = unknown> = (data: T) => void;

interface EventRegistry {
    profileChanged: Set<EventCallback<ProfileData[]>>;
    activeTabChanged: Set<EventCallback<string | null>>;
    tabOpened: Set<EventCallback<string>>;
    tabClosed: Set<EventCallback<string>>;
    sessionWindowReady: Set<EventCallback<void>>;
    sessionWindowClosed: Set<EventCallback<void>>;
    instanceRegistered: Set<EventCallback<{ profileId: string; win: BrowserWindow }>>;
    instanceClosed: Set<EventCallback<string>>;
    themeChanged: Set<EventCallback<ThemeData>>;
    featuresChanged: Set<EventCallback<FeatureFlagsData>>;
    roiChanged: Set<EventCallback<{ profileId: string; rois: RoiData }>>;
}

function createEventRegistry(): EventRegistry {
    return {
        profileChanged: new Set(),
        activeTabChanged: new Set(),
        tabOpened: new Set(),
        tabClosed: new Set(),
        sessionWindowReady: new Set(),
        sessionWindowClosed: new Set(),
        instanceRegistered: new Set(),
        instanceClosed: new Set(),
        themeChanged: new Set(),
        featuresChanged: new Set(),
        roiChanged: new Set(),
    };
}

// ============================================================================
// Service Registry Factory
// ============================================================================

export interface ServiceRegistryOptions {
    core: CoreServices;
    pythonExe?: string;
}

export function createServiceRegistry(opts: ServiceRegistryOptions) {
    const { core, pythonExe = "python" } = opts;
    const events = createEventRegistry();

    // Track open tabs (sessionTabs doesn't expose this)
    const openTabs = new Map<string, BrowserView>();
    let currentActiveTab: string | null = null;

    // ========================================================================
    // Event Emission Helpers
    // ========================================================================

    function emitProfileChanged(profiles: ProfileData[]): void {
        for (const cb of events.profileChanged) {
            try {
                cb(profiles);
            } catch (err) {
                logErr(err, "ServiceRegistry");
            }
        }
    }

    function emitActiveTabChanged(profileId: string | null): void {
        currentActiveTab = profileId;
        for (const cb of events.activeTabChanged) {
            try {
                cb(profileId);
            } catch (err) {
                logErr(err, "ServiceRegistry");
            }
        }
    }

    function emitTabOpened(profileId: string): void {
        for (const cb of events.tabOpened) {
            try {
                cb(profileId);
            } catch (err) {
                logErr(err, "ServiceRegistry");
            }
        }
    }

    function emitTabClosed(profileId: string): void {
        openTabs.delete(profileId);
        for (const cb of events.tabClosed) {
            try {
                cb(profileId);
            } catch (err) {
                logErr(err, "ServiceRegistry");
            }
        }
    }

    // ========================================================================
    // Service Adapters
    // ========================================================================

    function createProfilesAdapter(): ProfilesService {
        return {
            list: async () => core.profiles.list() as Promise<ProfileData[]>,
            get: async (id: string) => {
                const all = await core.profiles.list();
                const found = all.find((p) => p.id === id);
                return (found ?? null) as ProfileData | null;
            },
            getOverlayTargetId: async () => core.profiles.getOverlayTargetId(),
            getOverlaySupportTargetId: async () => core.profiles.getOverlaySupportTargetId(),
            onProfileChanged: (cb: (profiles: ProfileData[]) => void) => {
                events.profileChanged.add(cb);
                return () => events.profileChanged.delete(cb);
            },
        };
    }

    function createSessionTabsAdapter(): SessionTabsService {
        return {
            getActiveId: () => core.sessionTabs.getActiveId(),
            isActive: (profileId: string) => core.sessionTabs.isActive(profileId),
            getViewByProfile: (profileId: string) => core.sessionTabs.getViewByProfile(profileId),
            getOpenProfileIds: () => Array.from(openTabs.keys()),
            onActiveChanged: (cb: (profileId: string | null) => void) => {
                events.activeTabChanged.add(cb);
                return () => events.activeTabChanged.delete(cb);
            },
            onTabOpened: (cb: (profileId: string) => void) => {
                events.tabOpened.add(cb);
                return () => events.tabOpened.delete(cb);
            },
            onTabClosed: (cb: (profileId: string) => void) => {
                events.tabClosed.add(cb);
                return () => events.tabClosed.delete(cb);
            },
        };
    }

    function createSessionWindowAdapter(): SessionWindowService {
        return {
            get: () => core.sessionWindow.get(),
            ensure: () => {
                const existing = core.sessionWindow.get();
                if (existing) return existing;
                core.sessionWindow.ensure();
                return core.sessionWindow.get()!;
            },
            getBounds: () => {
                const win = core.sessionWindow.get();
                return win ? win.getBounds() : null;
            },
            onReady: (cb: () => void) => {
                events.sessionWindowReady.add(cb);
                return () => events.sessionWindowReady.delete(cb);
            },
            onClosed: (cb: () => void) => {
                events.sessionWindowClosed.add(cb);
                core.sessionWindow.onClosed(cb);
                return () => events.sessionWindowClosed.delete(cb);
            },
        };
    }

    function createInstancesAdapter(): InstancesService {
        return {
            get: (profileId: string) => core.instances.get(profileId) ?? null,
            list: (profileId: string) => core.instances.list(profileId),
            all: () => core.instances.all(),
            getFirst: () => core.instances.getFirst(),
            getAll: () => core.instances.getAllLatest(),
            onRegistered: (cb: (profileId: string, win: BrowserWindow) => void) => {
                const wrapper = (data: { profileId: string; win: BrowserWindow }) => {
                    cb(data.profileId, data.win);
                };
                events.instanceRegistered.add(wrapper);
                return () => events.instanceRegistered.delete(wrapper);
            },
            onClosed: (cb: (profileId: string) => void) => {
                events.instanceClosed.add(cb);
                return () => events.instanceClosed.delete(cb);
            },
        };
    }

    function createThemesAdapter(): ThemesService {
        return {
            getCurrent: async () => {
                // Themes store returns list, get first or default
                const themes = await core.themes.list();
                if (themes.length === 0) return null;
                const first = themes[0];
                return {
                    id: first.id,
                    name: first.name,
                    colors: first.colors as Record<string, string>,
                } as ThemeData;
            },
            onThemeChanged: (cb: (theme: ThemeData) => void) => {
                events.themeChanged.add(cb);
                return () => events.themeChanged.delete(cb);
            },
        };
    }

    function createFeaturesAdapter(): FeaturesService {
        return {
            get: async () => {
                const flags = await core.features.get();
                return flags as FeatureFlagsData;
            },
            isEnabled: async (featurePath: string) => {
                const flags = await core.features.get();
                const parts = featurePath.split(".");
                let current: Record<string, unknown> = flags as Record<string, unknown>;
                for (const part of parts) {
                    if (current && typeof current === "object" && part in current) {
                        current = current[part] as Record<string, unknown>;
                    } else {
                        return false;
                    }
                }
                return (current as { enabled?: boolean })?.enabled === true;
            },
            onFlagsChanged: (cb: (flags: FeatureFlagsData) => void) => {
                events.featuresChanged.add(cb);
                return () => events.featuresChanged.delete(cb);
            },
        };
    }

    function createRoiStoreAdapter(): RoiStoreService {
        return {
            get: async (profileId: string) => {
                const rois = await core.roiStore.get(profileId);
                if (!rois) return null;
                return {
                    lvl: rois.lvl
                        ? {
                              x: rois.lvl.x,
                              y: rois.lvl.y,
                              width: rois.lvl.w,
                              height: rois.lvl.h,
                          }
                        : undefined,
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
                    lauftext: rois.lauftext
                        ? {
                              x: rois.lauftext.x,
                              y: rois.lauftext.y,
                              width: rois.lauftext.w,
                              height: rois.lauftext.h,
                          }
                        : undefined,
                    rmExp: rois.rmExp
                        ? {
                              x: rois.rmExp.x,
                              y: rois.rmExp.y,
                              width: rois.rmExp.w,
                              height: rois.rmExp.h,
                          }
                        : undefined,
                    enemyName: rois.enemyName
                        ? {
                              x: rois.enemyName.x,
                              y: rois.enemyName.y,
                              width: rois.enemyName.w,
                              height: rois.enemyName.h,
                          }
                        : undefined,
                    enemyHp: rois.enemyHp
                        ? {
                              x: rois.enemyHp.x,
                              y: rois.enemyHp.y,
                              width: rois.enemyHp.w,
                              height: rois.enemyHp.h,
                          }
                        : undefined,
                };
            },
            set: async (profileId: string, rois: RoiData) => {
                await core.roiStore.set(profileId, {
                    lvl: rois.lvl
                        ? {
                              x: rois.lvl.x,
                              y: rois.lvl.y,
                              w: rois.lvl.width,
                              h: rois.lvl.height,
                          }
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
                        ? {
                              x: rois.lauftext.x,
                              y: rois.lauftext.y,
                              w: rois.lauftext.width,
                              h: rois.lauftext.height,
                          }
                        : undefined,
                    rmExp: rois.rmExp
                        ? {
                              x: rois.rmExp.x,
                              y: rois.rmExp.y,
                              w: rois.rmExp.width,
                              h: rois.rmExp.height,
                          }
                        : undefined,
                    enemyName: rois.enemyName
                        ? {
                              x: rois.enemyName.x,
                              y: rois.enemyName.y,
                              w: rois.enemyName.width,
                              h: rois.enemyName.height,
                          }
                        : undefined,
                    enemyHp: rois.enemyHp
                        ? {
                              x: rois.enemyHp.x,
                              y: rois.enemyHp.y,
                              w: rois.enemyHp.width,
                              h: rois.enemyHp.height,
                          }
                        : undefined,
                });

                // Emit change event
                for (const cb of events.roiChanged) {
                    try {
                        cb({ profileId, rois });
                    } catch (err) {
                        logErr(err, "ServiceRegistry");
                    }
                }
            },
            onRoiChanged: (cb: (profileId: string, rois: RoiData) => void) => {
                const wrapper = (data: { profileId: string; rois: RoiData }) => {
                    cb(data.profileId, data.rois);
                };
                events.roiChanged.add(wrapper);
                return () => events.roiChanged.delete(wrapper);
            },
        };
    }

    function createPythonOcrAdapter(): PythonOcrService {
        return {
            acquireWorker: async () => {
                const { acquireSharedOcrWorker } = await import("../ocr/workerPool");
                return acquireSharedOcrWorker(pythonExe);
            },
            releaseWorker: async () => {
                const { releaseSharedOcrWorker } = await import("../ocr/workerPool");
                return releaseSharedOcrWorker();
            },
        };
    }

    function createStorageAdapter(pluginId: string): StorageService {
        const dataDir = path.join(app.getPath("userData"), "user", "plugin-data", pluginId);

        async function ensureDir(): Promise<void> {
            await fs.mkdir(dataDir, { recursive: true });
        }

        function getFilePath(key: string): string {
            // Sanitize key to prevent path traversal
            const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
            return path.join(dataDir, `${safeKey}.json`);
        }

        return {
            read: async <T = unknown>(key: string): Promise<T | undefined> => {
                try {
                    const filePath = getFilePath(key);
                    const raw = await fs.readFile(filePath, "utf-8");
                    return JSON.parse(raw) as T;
                } catch {
                    return undefined;
                }
            },
            write: async <T>(key: string, data: T): Promise<void> => {
                await ensureDir();
                const filePath = getFilePath(key);
                await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
            },
            delete: async (key: string): Promise<boolean> => {
                try {
                    const filePath = getFilePath(key);
                    await fs.unlink(filePath);
                    return true;
                } catch {
                    return false;
                }
            },
            keys: async (): Promise<string[]> => {
                try {
                    await ensureDir();
                    const files = await fs.readdir(dataDir);
                    return files
                        .filter((f) => f.endsWith(".json"))
                        .map((f) => f.replace(/\.json$/, ""));
                } catch {
                    return [];
                }
            },
            clear: async (): Promise<void> => {
                try {
                    const files = await fs.readdir(dataDir);
                    for (const file of files) {
                        if (file.endsWith(".json")) {
                            await fs.unlink(path.join(dataDir, file));
                        }
                    }
                } catch {
                    // Ignore errors
                }
            },
        };
    }

    function createNotificationsAdapter(pluginId: string): NotificationsService {
        return {
            toast: (message: string, options?: ToastOptions) => {
                // Send to all browser windows
                const windows = BrowserWindow.getAllWindows();
                for (const win of windows) {
                    win.webContents.send("plugin:toast", {
                        pluginId,
                        message,
                        type: options?.type ?? "info",
                        duration: options?.duration ?? 3000,
                    });
                }
            },
            system: (title: string, body: string, options?: SystemNotificationOptions) => {
                // Use Electron's Notification API
                const { Notification } = require("electron");
                new Notification({
                    title: `[${pluginId}] ${title}`,
                    body,
                    icon: options?.icon,
                    silent: options?.silent,
                    urgency: options?.urgency,
                }).show();
            },
        };
    }

    function createHttpAdapter(): HttpService {
        return {
            fetch: async (url: string, options?: HttpFetchOptions): Promise<HttpResponse> => {
                return new Promise((resolve, reject) => {
                    const request = net.request({
                        method: options?.method ?? "GET",
                        url,
                    });

                    // Set headers
                    if (options?.headers) {
                        for (const [key, value] of Object.entries(options.headers)) {
                            request.setHeader(key, value);
                        }
                    }

                    // Set timeout
                    const timeout = options?.timeout ?? 30000;
                    const timeoutId = setTimeout(() => {
                        request.abort();
                        reject(new Error(`Request timeout after ${timeout}ms`));
                    }, timeout);

                    let responseData = "";
                    let responseHeaders: Record<string, string> = {};
                    let responseStatus = 0;
                    let responseStatusText = "";

                    request.on("response", (response) => {
                        clearTimeout(timeoutId);
                        responseStatus = response.statusCode;
                        responseStatusText = response.statusMessage;

                        // Convert headers
                        for (const [key, value] of Object.entries(response.headers)) {
                            if (Array.isArray(value)) {
                                responseHeaders[key] = value.join(", ");
                            } else if (value) {
                                responseHeaders[key] = value;
                            }
                        }

                        response.on("data", (chunk) => {
                            responseData += chunk.toString();
                        });

                        response.on("end", () => {
                            resolve({
                                ok: responseStatus >= 200 && responseStatus < 300,
                                status: responseStatus,
                                statusText: responseStatusText,
                                headers: responseHeaders,
                                text: async () => responseData,
                                json: async <T = unknown>() => JSON.parse(responseData) as T,
                            });
                        });
                    });

                    request.on("error", (err) => {
                        clearTimeout(timeoutId);
                        reject(err);
                    });

                    // Send body if present
                    if (options?.body) {
                        const bodyStr =
                            typeof options.body === "string"
                                ? options.body
                                : JSON.stringify(options.body);
                        request.write(bodyStr);
                    }

                    request.end();
                });
            },
            fetchJson: async <T = unknown>(url: string, options?: HttpFetchOptions): Promise<T> => {
                const response = await createHttpAdapter().fetch(url, {
                    ...options,
                    headers: {
                        Accept: "application/json",
                        ...options?.headers,
                    },
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.json<T>();
            },
        };
    }

    // ========================================================================
    // Service Builder for Plugins
    // ========================================================================

    /**
     * Builds the services object for a specific plugin based on its manifest.
     */
    function getServicesForPlugin(
        manifest: PluginManifest,
        pluginId: string
    ): ExtendedPluginServices {
        const services: ExtendedPluginServices = {};

        for (const req of manifest.requires) {
            switch (req) {
                case "profiles":
                    services.profiles = createProfilesAdapter();
                    break;
                case "sessionTabs":
                    services.sessionTabs = createSessionTabsAdapter();
                    break;
                case "sessionWindow":
                    services.sessionWindow = createSessionWindowAdapter();
                    break;
                case "instances":
                    services.instances = createInstancesAdapter();
                    break;
                case "themes":
                    services.themes = createThemesAdapter();
                    break;
                case "features":
                    services.features = createFeaturesAdapter();
                    break;
                case "roiStore":
                    services.roiStore = createRoiStoreAdapter();
                    break;
                case "pythonOcr":
                    services.pythonOcr = createPythonOcrAdapter();
                    break;
                case "storage":
                    services.storage = createStorageAdapter(pluginId);
                    break;
                case "notifications":
                    services.notifications = createNotificationsAdapter(pluginId);
                    break;
                case "http":
                    services.http = createHttpAdapter();
                    break;
                default:
                    logErr(`Plugin ${pluginId} requested unknown service: ${req}`, "ServiceRegistry");
            }
        }

        return services;
    }

    /**
     * Checks if a plugin has a specific permission.
     */
    function hasPermission(manifest: PluginManifest, permission: PluginPermission): boolean {
        return manifest.permissions.includes(permission);
    }

    // ========================================================================
    // Event Triggers (called by core when events occur)
    // ========================================================================

    return {
        // Service creation
        getServicesForPlugin,
        hasPermission,

        // Event emitters (called by PluginManager or core)
        emitProfileChanged,
        emitActiveTabChanged,
        emitTabOpened,
        emitTabClosed,

        // Track open tabs
        trackTabOpened: (profileId: string, view: BrowserView) => {
            openTabs.set(profileId, view);
            emitTabOpened(profileId);
        },
        trackTabClosed: (profileId: string) => {
            emitTabClosed(profileId);
        },

        // Individual adapters for direct use
        adapters: {
            profiles: createProfilesAdapter,
            sessionTabs: createSessionTabsAdapter,
            sessionWindow: createSessionWindowAdapter,
            instances: createInstancesAdapter,
            themes: createThemesAdapter,
            features: createFeaturesAdapter,
            roiStore: createRoiStoreAdapter,
            pythonOcr: createPythonOcrAdapter,
            storage: createStorageAdapter,
            notifications: createNotificationsAdapter,
            http: createHttpAdapter,
        },
    };
}

export type ServiceRegistry = ReturnType<typeof createServiceRegistry>;

/**
 * Plugin API Type Definitions (V2)
 *
 * This file defines the contract between the Core and Plugins.
 * Plugins implement PluginModule and receive PluginContext for access to services.
 */

import type { IpcMainInvokeEvent, IpcMainEvent, BrowserWindow, BrowserView } from "electron";

// Re-export PluginState from pluginStates.ts
export type { PluginState } from "./pluginStates";

// ============================================================================
// Plugin Manifest (V2)
// ============================================================================

/**
 * Plugin manifest.json schema (V2)
 */
export interface PluginManifest {
    // === Core Metadata ===
    /** Unique plugin identifier (lowercase, hyphens allowed, 3-32 chars) */
    id: string;
    /** Human-readable plugin name (max 64 chars) */
    name: string;
    /** Semantic version (e.g., "1.0.0") */
    version: string;
    /** Minimum launcher version required */
    minLauncherVersion: string;
    /** Plugin author (max 128 chars) */
    author?: string;
    /** Plugin description (max 512 chars) */
    description?: string;
    /** URL to plugin homepage */
    homepage?: string;
    /** License identifier (MIT, GPL, etc.) */
    license?: string;

    // === Entry Points ===
    /** Main entry point relative to plugin directory */
    main: string;
    /** Preload script relative to plugin directory (optional) */
    preload?: string;
    /** Settings UI configuration (optional) */
    settingsUI?: PluginSettingsUI;

    // === IPC & Communication ===
    /** IPC channel prefixes this plugin will use (supports wildcards) */
    ipcChannels: string[];
    /** Event subscriptions */
    events?: PluginEventConfig;

    // === Service Requirements ===
    /** Required core services */
    requires: PluginRequirement[];
    /** Plugin permissions */
    permissions: PluginPermission[];

    // === Plugin Configuration ===
    /** JSON Schema for settings validation */
    configSchema?: PluginConfigSchema;
    /** Default configuration values */
    configDefaults?: Record<string, unknown>;
    /** Legacy: Optional plugin-specific configuration defaults */
    config?: Record<string, unknown>;

    // === UI Registration ===
    /** UI elements this plugin registers */
    ui?: PluginUIConfig;

    // === Dependencies ===
    /** Other plugins required (pluginId: version range) */
    dependencies?: Record<string, string>;
}

/**
 * Settings UI configuration
 */
export interface PluginSettingsUI {
    /** HTML file path relative to plugin directory */
    entry: string;
    /** Preferred panel width in pixels (default: 400) */
    width?: number;
    /** Preferred panel height in pixels (default: 300) */
    height?: number;
}

/**
 * Event subscription configuration
 */
export interface PluginEventConfig {
    /** Events this plugin wants to receive (e.g., "*:level-up", "core:session-started") */
    subscribe?: string[];
    /** Events this plugin may emit (for documentation) */
    emit?: string[];
}

/**
 * UI registration configuration
 */
export interface PluginUIConfig {
    /** Register a tab in the launcher settings */
    launcherTab?: {
        label: string;
        icon?: string;
    };
    /** Register an overlay panel */
    overlayPanel?: {
        position?: "left" | "right" | "bottom";
    };
    /** Context menu items */
    menuItems?: Array<{
        label: string;
        action: string;
    }>;
}

/**
 * JSON Schema for plugin configuration
 */
export interface PluginConfigSchema {
    type: "object";
    properties: Record<string, PluginConfigProperty>;
    required?: string[];
}

export interface PluginConfigProperty {
    type: "string" | "number" | "boolean" | "array" | "object";
    title?: string;
    description?: string;
    default?: unknown;
    enum?: unknown[];
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    items?: PluginConfigProperty;
}

export type PluginRequirement =
    | "profiles"
    | "sessionTabs"
    | "sessionWindow"
    | "instances"
    | "themes"
    | "features"
    | "roiStore"
    | "pythonOcr"
    | "dataCache"
    | "storage"       // NEW: Plugin-scoped storage API
    | "notifications" // NEW: Toast/notification system
    | "http";         // NEW: HTTP fetch with CORS bypass

export type PluginPermission =
    | "window:create"    // Can create overlay windows
    | "window:capture"   // Can capture screenshots
    | "ipc:register"     // Can register IPC handlers
    | "storage:read"     // Can read from userData
    | "storage:write"    // Can write to userData
    | "ocr:access"       // Can use OCR worker pool
    | "settings:ui"      // NEW: Can render settings UI
    | "ui:overlay"       // NEW: Can create overlay elements
    | "ui:launcher"      // NEW: Can add launcher UI elements
    | "network:fetch"    // NEW: Can make HTTP requests
    | "clipboard:read"   // NEW: Can read clipboard
    | "clipboard:write"; // NEW: Can write to clipboard

// ============================================================================
// Plugin Context (passed to plugins)
// ============================================================================

export interface PluginContext {
    /** Plugin manifest */
    manifest: PluginManifest;
    /** Plugin directory path (absolute) */
    pluginDir: string;
    /** Plugin-specific data directory (for plugin's own storage) */
    dataDir: string;
    /** Logger scoped to this plugin */
    logger: PluginLogger;
    /** IPC registration helper (namespaced to plugin) */
    ipc: PluginIpcBridge;
    /** Access to requested core services */
    services: PluginServices;
    /** Event bus for plugin-to-plugin communication */
    eventBus: PluginEventBus;
}

// ============================================================================
// Plugin Logger
// ============================================================================

export interface PluginLogger {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string | Error, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
}

// ============================================================================
// Plugin IPC Bridge
// ============================================================================

export interface PluginIpcBridge {
    /**
     * Register an IPC handler (channel will be prefixed with plugin ID)
     * @param channel Channel name (e.g., "overlay:toggle" becomes "exp-tracker:overlay:toggle")
     * @param handler Handler function
     */
    handle<T>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<T> | T
    ): void;

    /**
     * Register an IPC listener (channel will be prefixed with plugin ID)
     */
    on(
        channel: string,
        listener: (event: IpcMainEvent, ...args: unknown[]) => void
    ): void;

    /**
     * Send a message to a specific window
     */
    send(window: BrowserWindow, channel: string, ...args: unknown[]): void;

    /**
     * Broadcast a message to all windows
     */
    broadcast(channel: string, ...args: unknown[]): void;

    /**
     * Invoke a core IPC channel (for accessing core functionality)
     */
    invokeCore(channel: string, ...args: unknown[]): Promise<unknown>;

    /**
     * Subscribe to core events
     */
    subscribeCore(channel: string, handler: (data: unknown) => void): () => void;

    /** Remove an IPC handler */
    removeHandler(channel: string): void;

    /** Remove an IPC listener */
    removeListener(
        channel: string,
        listener: (...args: unknown[]) => void
    ): void;
}

// ============================================================================
// Plugin Event Bus (Plugin-to-Plugin Communication)
// ============================================================================

export interface PluginEventBus {
    /**
     * Emit an event to all listeners
     * @param event Event name (will be prefixed with emitting plugin ID)
     * @param data Event data
     */
    emit(event: string, data: unknown): void;

    /**
     * Listen for an event from any plugin
     * @param event Event pattern (e.g., "*:level-changed" or "questlog:quest-completed")
     * @param handler Handler receiving (data, fromPluginId)
     * @returns Unsubscribe function
     */
    on(event: string, handler: (data: unknown, from: string) => void): () => void;

    /**
     * Listen for an event once
     */
    once(event: string, handler: (data: unknown, from: string) => void): () => void;
}

// ============================================================================
// Core Services Exposed to Plugins
// ============================================================================

export interface PluginServices {
    profiles?: ProfilesService;
    sessionTabs?: SessionTabsService;
    sessionWindow?: SessionWindowService;
    instances?: InstancesService;
    themes?: ThemesService;
    features?: FeaturesService;
    roiStore?: RoiStoreService;
    pythonOcr?: PythonOcrService;
    dataCache?: DataCacheService;
    storage?: StorageService;
    notifications?: NotificationsService;
    http?: HttpService;
}

// ---- Profiles Service ----

export interface ProfilesService {
    /** Get all profiles */
    list(): Promise<ProfileData[]>;
    /** Get a specific profile by ID */
    get(id: string): Promise<ProfileData | null>;
    /** Get the current overlay target profile ID */
    getOverlayTargetId(): Promise<string | null>;
    /** Get the current supporter overlay target profile ID */
    getOverlaySupportTargetId(): Promise<string | null>;
    /** Subscribe to profile changes */
    onProfileChanged(cb: (profiles: ProfileData[]) => void): () => void;
}

export interface ProfileData {
    id: string;
    name: string;
    createdAt: string;
    job?: string;
    launchMode: "tabs" | "window";
    overlayTarget?: boolean;
    overlaySupportTarget?: boolean;
    overlayIconKey?: string;
    overlaySupportIconKey?: string;
    overlaySettings?: OverlaySettings;
    overlayHud?: OverlayHudBounds;
    features?: Record<string, { enabled?: boolean }>;
}

export interface OverlaySettings {
    showExp?: boolean;
    showDeltaExp?: boolean;
    showTotalExp?: boolean;
    showKillsSession?: boolean;
    showKillsHour?: boolean;
    showTimer?: boolean;
    showExpPerHour?: boolean;
    showExpPerKill?: boolean;
}

export interface OverlayHudBounds {
    offsetX?: number;
    offsetY?: number;
    width?: number;
    height?: number;
}

// ---- Session Tabs Service ----

export interface SessionTabsService {
    /** Get the currently active profile ID */
    getActiveId(): string | null;
    /** Check if a profile is currently active */
    isActive(profileId: string): boolean;
    /** Get the BrowserView for a profile (if open in tabs mode) */
    getViewByProfile(profileId: string): BrowserView | null;
    /** Get all currently open profile IDs */
    getOpenProfileIds(): string[];
    /** Subscribe to active tab changes */
    onActiveChanged(cb: (profileId: string | null) => void): () => void;
    /** Subscribe to tab opened events */
    onTabOpened(cb: (profileId: string) => void): () => void;
    /** Subscribe to tab closed events */
    onTabClosed(cb: (profileId: string) => void): () => void;
}

// ---- Session Window Service ----

export interface SessionWindowService {
    /** Get the session window (may be null if not created) */
    get(): BrowserWindow | null;
    /** Ensure the session window exists, creating if needed */
    ensure(): BrowserWindow;
    /** Get window bounds */
    getBounds(): { x: number; y: number; width: number; height: number } | null;
    /** Subscribe to window ready event */
    onReady(cb: () => void): () => void;
    /** Subscribe to window closed event */
    onClosed(cb: () => void): () => void;
}

// ---- Instances Service ----

export interface InstancesService {
    /** Get instance window for a profile */
    get(profileId: string): BrowserWindow | null;
    /** Get all instance windows for a profile */
    list(profileId: string): BrowserWindow[];
    /** Get all instance windows for all profiles */
    all(): { profileId: string; win: BrowserWindow }[];
    /** Get the first available instance */
    getFirst(): { profileId: string; win: BrowserWindow } | null;
    /** Get the latest instance per profile (compat helper) */
    getAll(): Map<string, BrowserWindow>;
    /** Subscribe to instance registered event */
    onRegistered(
        cb: (profileId: string, win: BrowserWindow) => void
    ): () => void;
    /** Subscribe to instance closed event */
    onClosed(cb: (profileId: string) => void): () => void;
}

// ---- Themes Service ----

export interface ThemesService {
    /** Get current theme */
    getCurrent(): Promise<ThemeData | null>;
    /** Subscribe to theme changes */
    onThemeChanged(cb: (theme: ThemeData) => void): () => void;
}

export interface ThemeData {
    id: string;
    name: string;
    colors: Record<string, string>;
}

// ---- Features Service ----

export interface FeaturesService {
    /** Get all feature flags */
    get(): Promise<FeatureFlagsData>;
    /** Check if a specific feature is enabled */
    isEnabled(featurePath: string): Promise<boolean>;
    /** Subscribe to feature flag changes */
    onFlagsChanged(cb: (flags: FeatureFlagsData) => void): () => void;
}

export interface FeatureFlagsData {
    [key: string]: { enabled: boolean } | FeatureFlagsData;
}

// ---- ROI Store Service ----

export interface RoiStoreService {
    /** Get ROI data for a profile */
    get(profileId: string): Promise<RoiData | null>;
    /** Set ROI data for a profile */
    set(profileId: string, rois: RoiData): Promise<void>;
    /** Subscribe to ROI changes */
    onRoiChanged(cb: (profileId: string, rois: RoiData) => void): () => void;
}

export interface RoiData {
    lvl?: RoiRect;
    charname?: RoiRect;
    exp?: RoiRect;
    lauftext?: RoiRect;
    rmExp?: RoiRect;
    enemyName?: RoiRect;
    enemyHp?: RoiRect;
    // Legacy optional keys for migration
    nameLevel?: RoiRect;
    expPercent?: RoiRect;
}

export interface RoiRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

// ---- Python OCR Service ----

export interface PythonOcrService {
    /** Acquire a shared OCR worker */
    acquireWorker(): Promise<OcrWorker>;
    /** Release the shared OCR worker */
    releaseWorker(): Promise<void>;
}

export interface OcrWorker {
    /** Recognize text from a PNG buffer */
    recognizePng(
        buffer: Buffer,
        opts?: { kind?: string }
    ): Promise<OcrResult>;
}

export interface OcrResult {
    ok: boolean;
    raw?: string;
    value?: string | null;
    error?: string;
}

// ---- Data Cache Service ----

export interface DataCacheService {
    /** Read cached data by key */
    read<T>(key: string): Promise<CachedData<T> | null>;
    /** Check if cache is fresh */
    isFresh(key: string, maxAgeMs?: number): Promise<boolean>;
    /** Subscribe to cache updates (triggered when external fetcher updates files) */
    onCacheUpdated(key: string, cb: (data: unknown) => void): () => void;
}

export interface CachedData<T> {
    data: T;
    fetchedAt: number;
    stale: boolean;
    source: "cache" | "fallback";
}

// ============================================================================
// Plugin Module Interface (implemented by plugins)
// ============================================================================

export interface PluginModule {
    /**
     * Called when plugin is loaded - perform initialization
     * Register IPC handlers, prepare resources
     */
    init(context: PluginContext): Promise<void> | void;

    /**
     * Called when plugin should start running
     * Begin active operations (polling, UI, etc.)
     */
    start(context: PluginContext): Promise<void> | void;

    /**
     * Called when plugin should stop - cleanup resources
     * Deregister IPC handlers, close windows, stop timers
     */
    stop(): Promise<void> | void;
}

// ============================================================================
// Plugin Host Types (used internally by core)
// ============================================================================

export interface LoadedPlugin {
    manifest: PluginManifest;
    module: PluginModule;
    context: PluginContext;
    state: import("./pluginStates").PluginState;
    error?: Error;
}

export interface PluginHostEvents {
    "plugin:loaded": { pluginId: string };
    "plugin:started": { pluginId: string };
    "plugin:stopped": { pluginId: string };
    "plugin:error": { pluginId: string; error: Error };
    "plugin:stateChanged": { pluginId: string; state: import("./pluginStates").PluginState };
}

export interface PluginStateInfo {
    id: string;
    name: string;
    version: string;
    state: import("./pluginStates").PluginState;
    enabled: boolean;
    error?: string;
    errorTime?: string;
    author?: string;
    description?: string;
    /** True if manifest declares a settings UI entry */
    hasSettingsUI?: boolean;
    /** Optional declared settings UI configuration */
    settingsUI?: PluginSettingsUI;
    /** Manifest permissions (for renderer display) */
    permissions?: PluginPermission[];
    /** Manifest requirements (for renderer display) */
    requires?: PluginRequirement[];
}

// ============================================================================
// Storage Service
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

// ============================================================================
// Notifications Service
// ============================================================================

export interface NotificationsService {
    /** Show a toast notification in the launcher UI */
    toast(message: string, options?: ToastOptions): void;
    /** Show a system notification */
    system(title: string, body: string, options?: SystemNotificationOptions): void;
}

export interface ToastOptions {
    type?: "info" | "success" | "warning" | "error";
    duration?: number;
    action?: {
        label: string;
        callback: () => void;
    };
}

export interface SystemNotificationOptions {
    icon?: string;
    silent?: boolean;
    urgency?: "normal" | "critical" | "low";
}

// ============================================================================
// HTTP Service
// ============================================================================

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
    timeout?: number;
}

export interface HttpResponse {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    text(): Promise<string>;
    json<T = unknown>(): Promise<T>;
}

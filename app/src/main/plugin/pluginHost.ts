/**
 * Plugin Host
 *
 * Manages the full plugin lifecycle: discovery, validation, loading,
 * initialization, starting, stopping, and unloading of plugins.
 */

import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import { pathToFileURL } from "url";
import type {
    PluginManifest,
    PluginModule,
    PluginContext,
    PluginState,
    PluginServices,
    LoadedPlugin,
    PluginStateInfo,
} from "../../shared/pluginApi";
import { validateManifest, validateMainEntry, logManifestWarnings } from "./pluginValidator";
import { createPluginLogger } from "./pluginLogger";
import { createPluginIpcBridge, PluginIpcBridgeInternal } from "./pluginIpc";
import { createEventBus, createScopedEventBus, GlobalEventBus } from "./eventBus";
import { logErr, logWarn } from "../../shared/logger";

// ============================================================================
// Types
// ============================================================================

export interface PluginHostOptions {
    /** Directory containing plugin folders */
    pluginsDir: string;
    /** Services to expose to plugins, or a factory that builds them per plugin */
    services: PluginServices | ((manifest: PluginManifest, pluginId: string) => PluginServices);
    /** Current launcher version for compatibility checks */
    launcherVersion: string;
    /** List of plugin IDs to enable (if undefined, all discovered plugins are enabled) */
    enabledPlugins?: string[];
}

interface InternalLoadedPlugin extends LoadedPlugin {
    ipcBridge: PluginIpcBridgeInternal;
}

type PluginHostEventType =
    | "plugin:loaded"
    | "plugin:started"
    | "plugin:stopped"
    | "plugin:error"
    | "plugin:stateChanged";

type PluginHostEventHandler = (data: { pluginId: string; state?: PluginState; error?: Error }) => void;

// ============================================================================
// Plugin Host Factory
// ============================================================================

/**
 * Creates a plugin host that manages the plugin lifecycle.
 */
export function createPluginHost(opts: PluginHostOptions) {
    const plugins = new Map<string, InternalLoadedPlugin>();
    const eventBus: GlobalEventBus = createEventBus();
    const eventHandlers = new Map<PluginHostEventType, Set<PluginHostEventHandler>>();

    // ========================================================================
    // Event Emission
    // ========================================================================

    function emit(event: PluginHostEventType, data: { pluginId: string; state?: PluginState; error?: Error }): void {
        const handlers = eventHandlers.get(event);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(data);
                } catch (err) {
                    logErr(err, "PluginHost");
                }
            }
        }
    }

    function on(event: PluginHostEventType, handler: PluginHostEventHandler): () => void {
        if (!eventHandlers.has(event)) {
            eventHandlers.set(event, new Set());
        }
        eventHandlers.get(event)!.add(handler);
        return () => eventHandlers.get(event)?.delete(handler);
    }

    // ========================================================================
    // Discovery
    // ========================================================================

    /**
     * Discovers all valid plugins in the plugins directory.
     */
    async function discoverPlugins(): Promise<PluginManifest[]> {
        const manifests: PluginManifest[] = [];

        try {
            await fs.mkdir(opts.pluginsDir, { recursive: true });
        } catch {
            // Directory may already exist
        }

        let entries: string[];
        try {
            entries = await fs.readdir(opts.pluginsDir);
        } catch (err) {
            logWarn(`Failed to read plugins directory: ${opts.pluginsDir}`, "PluginHost");
            return manifests;
        }

        for (const entryName of entries) {
            // Check if entry is a directory
            const entryPath = path.join(opts.pluginsDir, entryName);
            try {
                const stats = await fs.stat(entryPath);
                if (!stats.isDirectory()) continue;
            } catch {
                continue;
            }

            const manifestPath = path.join(opts.pluginsDir, entryName, "manifest.json");

            try {
                const raw = await fs.readFile(manifestPath, "utf-8");
                const data = JSON.parse(raw);

                const result = validateManifest(data, opts.launcherVersion);

                if (result.valid && result.manifest) {
                    // Verify the manifest ID matches the directory name
                    if (result.manifest.id !== entryName) {
                        logWarn(
                            `Plugin directory name '${entryName}' doesn't match manifest ID '${result.manifest.id}'`,
                            "PluginHost"
                        );
                        continue;
                    }

                    if (result.warnings) {
                        logManifestWarnings(result.manifest.id, result.warnings);
                    }

                    manifests.push(result.manifest);
                } else if (result.errors) {
                    logWarn(
                        `Invalid manifest in ${entryName}: ${result.errors.join(", ")}`,
                        "PluginHost"
                    );
                }
            } catch (err) {
                // Skip directories without valid manifest.json
                if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
                    logWarn(`Error reading manifest in ${entryName}: ${err}`, "PluginHost");
                }
            }
        }

        return manifests;
    }

    // ========================================================================
    // Loading
    // ========================================================================

    /**
     * Loads a plugin from its manifest.
     */
    async function loadPlugin(manifest: PluginManifest): Promise<void> {
        const pluginId = manifest.id;

        if (plugins.has(pluginId)) {
            logWarn(`Plugin already loaded: ${pluginId}`, "PluginHost");
            return;
        }

        const pluginDir = path.join(opts.pluginsDir, pluginId);

        // Validate main entry point
        const entryValidation = validateMainEntry(pluginDir, manifest.main);
        if (!entryValidation.valid) {
            throw new Error(`Plugin ${pluginId}: ${entryValidation.error}`);
        }

        const mainPath = path.join(pluginDir, manifest.main);

        // Dynamic import of the plugin module
        let mod: unknown;
        try {
            mod = await import(pathToFileURL(mainPath).href);
        } catch (err) {
            throw new Error(`Failed to import plugin ${pluginId}: ${err}`);
        }

        // Extract the plugin module (supports default export or named 'plugin' export)
        const moduleRecord = mod as Record<string, unknown>;
        const pluginModule: PluginModule | undefined =
            (moduleRecord.plugin as PluginModule) ||
            (moduleRecord.default as PluginModule);

        if (!pluginModule || typeof pluginModule.init !== "function") {
            throw new Error(`Plugin ${pluginId} does not export a valid PluginModule`);
        }

        // Create plugin data directory
        const dataDir = path.join(app.getPath("userData"), "user", "plugin-data", pluginId);
        await fs.mkdir(dataDir, { recursive: true });

        // Create IPC bridge
        const ipcBridge = createPluginIpcBridge(pluginId, manifest.ipcChannels);

        // Build services for this plugin
        const services = buildServicesForPlugin(manifest, pluginId);

        // Create context
        const context: PluginContext = {
            manifest,
            pluginDir,
            dataDir,
            logger: createPluginLogger(pluginId),
            ipc: ipcBridge,
            services,
            eventBus: createScopedEventBus(eventBus, pluginId),
        };

        const loaded: InternalLoadedPlugin = {
            manifest,
            module: pluginModule,
            context,
            state: "loaded",
            ipcBridge,
        };

        plugins.set(pluginId, loaded);
        emit("plugin:loaded", { pluginId });
        emit("plugin:stateChanged", { pluginId, state: "loaded" });

        logWarn(`Plugin loaded: ${pluginId} v${manifest.version}`, "PluginHost");
    }

    /**
     * Builds the services object for a plugin based on its requirements.
     */
    function buildServicesForPlugin(manifest: PluginManifest, pluginId: string): PluginServices {
        if (typeof opts.services === "function") {
            // Allow callers to construct per-plugin services (e.g., via ServiceRegistry)
            return opts.services(manifest, pluginId);
        }

        const services: PluginServices = {};

        for (const req of manifest.requires) {
            const service = (opts.services as Record<string, unknown>)[req];
            if (service) {
                (services as Record<string, unknown>)[req] = service;
            } else {
                logWarn(`Plugin requested unavailable service: ${req}`, "PluginHost");
            }
        }

        return services;
    }

    // ========================================================================
    // Starting / Stopping
    // ========================================================================

    /**
     * Starts a loaded plugin.
     */
    async function startPlugin(pluginId: string): Promise<void> {
        const plugin = plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin not loaded: ${pluginId}`);
        }

        if (plugin.state === "running") {
            return; // Already running
        }

        plugin.state = "starting";
        emit("plugin:stateChanged", { pluginId, state: "starting" });

        try {
            // Call init first (if not already called)
            await plugin.module.init(plugin.context);

            // Then start
            await plugin.module.start(plugin.context);

            plugin.state = "running";
            emit("plugin:started", { pluginId });
            emit("plugin:stateChanged", { pluginId, state: "running" });

            logWarn(`Plugin started: ${pluginId}`, "PluginHost");
        } catch (err) {
            plugin.state = "error";
            plugin.error = err instanceof Error ? err : new Error(String(err));
            emit("plugin:error", { pluginId, error: plugin.error });
            emit("plugin:stateChanged", { pluginId, state: "error" });
            throw err;
        }
    }

    /**
     * Stops a running plugin.
     */
    async function stopPlugin(pluginId: string): Promise<void> {
        const plugin = plugins.get(pluginId);
        if (!plugin) return;

        if (plugin.state !== "running") return;

        plugin.state = "stopping";
        emit("plugin:stateChanged", { pluginId, state: "stopping" });

        try {
            await plugin.module.stop();
        } catch (err) {
            logErr(err, `Plugin:${pluginId}`);
        }

        plugin.state = "stopped";
        emit("plugin:stopped", { pluginId });
        emit("plugin:stateChanged", { pluginId, state: "stopped" });

        logWarn(`Plugin stopped: ${pluginId}`, "PluginHost");
    }

    /**
     * Unloads a plugin completely.
     */
    async function unloadPlugin(pluginId: string): Promise<void> {
        await stopPlugin(pluginId);

        const plugin = plugins.get(pluginId);
        if (plugin) {
            // Cleanup IPC handlers
            plugin.ipcBridge.removeAllHandlers();
        }

        plugins.delete(pluginId);
        emit("plugin:stateChanged", { pluginId, state: "unloaded" });

        logWarn(`Plugin unloaded: ${pluginId}`, "PluginHost");
    }

    // ========================================================================
    // Bulk Operations
    // ========================================================================

    /**
     * Discovers, loads, and starts all enabled plugins.
     */
    async function startAll(): Promise<void> {
        const manifests = await discoverPlugins();

        // Filter to enabled plugins if specified
        const toLoad = opts.enabledPlugins
            ? manifests.filter((m) => opts.enabledPlugins!.includes(m.id))
            : manifests;

        logWarn(`Discovered ${manifests.length} plugins, loading ${toLoad.length}`, "PluginHost");

        // Load all plugins
        for (const manifest of toLoad) {
            try {
                await loadPlugin(manifest);
            } catch (err) {
                logErr(err, `PluginHost:${manifest.id}`);
            }
        }

        // Start all loaded plugins
        for (const pluginId of plugins.keys()) {
            try {
                await startPlugin(pluginId);
            } catch (err) {
                logErr(err, `PluginHost:${pluginId}`);
            }
        }
    }

    /**
     * Stops all running plugins.
     */
    async function stopAll(): Promise<void> {
        // Stop in reverse order of loading (LIFO)
        const pluginIds = Array.from(plugins.keys()).reverse();

        for (const pluginId of pluginIds) {
            try {
                await stopPlugin(pluginId);
            } catch (err) {
                logErr(err, `PluginHost:${pluginId}`);
            }
        }
    }

    /**
     * Unloads all plugins.
     */
    async function unloadAll(): Promise<void> {
        const pluginIds = Array.from(plugins.keys()).reverse();

        for (const pluginId of pluginIds) {
            try {
                await unloadPlugin(pluginId);
            } catch (err) {
                logErr(err, `PluginHost:${pluginId}`);
            }
        }

        eventBus.clear();
    }

    // ========================================================================
    // Queries
    // ========================================================================

    /**
     * Gets information about a specific plugin.
     */
    function getPlugin(pluginId: string): LoadedPlugin | undefined {
        return plugins.get(pluginId);
    }

    /**
     * Gets the state of a specific plugin.
     */
    function getPluginState(pluginId: string): PluginState {
        return plugins.get(pluginId)?.state ?? "unloaded";
    }

    /**
     * Gets a list of all loaded plugin IDs.
     */
    function getLoadedPluginIds(): string[] {
        return Array.from(plugins.keys());
    }

    /**
     * Gets state information for all loaded plugins.
     */
    function getAllPluginStates(): PluginStateInfo[] {
        return Array.from(plugins.values()).map((p) => ({
            id: p.manifest.id,
            name: p.manifest.name,
            version: p.manifest.version,
            state: p.state,
            enabled: true, // Loaded plugins are enabled by definition
            error: p.error?.message,
            hasSettingsUI: !!p.manifest.settingsUI,
            settingsUI: p.manifest.settingsUI,
            permissions: p.manifest.permissions,
            requires: p.manifest.requires,
        }));
    }

    // ========================================================================
    // Public API
    // ========================================================================

    return {
        // Discovery
        discoverPlugins,

        // Lifecycle
        loadPlugin,
        startPlugin,
        stopPlugin,
        unloadPlugin,

        // Bulk operations
        startAll,
        stopAll,
        unloadAll,

        // Queries
        getPlugin,
        getPluginState,
        getLoadedPluginIds,
        getAllPluginStates,

        // Events
        on,

        // Event bus access (for advanced use cases)
        getEventBus: () => eventBus,
    };
}

export type PluginHost = ReturnType<typeof createPluginHost>;

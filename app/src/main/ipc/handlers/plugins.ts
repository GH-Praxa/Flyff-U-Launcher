/**
 * IPC handlers for plugin management operations.
 */
import { SafeHandle, IpcEvent, assertValidId } from "../common";
import { app } from "electron";
import { pathToFileURL } from "url";
import type { PluginHost } from "../../plugin";
import type { PluginStateStore } from "../../plugin/pluginStateStore";
import type { PluginStateInfo, PluginManifest } from "../../../shared/pluginApi";
import { invokePluginHandler } from "../../plugin/pluginIpc";

export type PluginHandlerOptions = {
    pluginHost: PluginHost;
    pluginStateStore?: PluginStateStore;
};

/**
 * Registers IPC handlers for plugin management.
 * Provides endpoints for listing, enabling, disabling, and querying plugins.
 */
export function registerPluginHandlers(
    safeHandle: SafeHandle,
    opts: PluginHandlerOptions,
    logErr: (msg: unknown) => void
): void {
    /**
     * List all loaded plugins with their states.
     */
    safeHandle("plugins:list", async (): Promise<PluginStateInfo[]> => {
        return opts.pluginHost.getAllPluginStates();
    });

    /**
     * Discover available plugins (without loading them).
     */
    safeHandle("plugins:discover", async (): Promise<PluginManifest[]> => {
        return await opts.pluginHost.discoverPlugins();
    });

    /**
     * Get the state of a specific plugin.
     */
    safeHandle("plugins:getState", async (_e: IpcEvent, pluginId: string) => {
        assertValidId(pluginId, "pluginId");
        return opts.pluginHost.getPluginState(pluginId);
    });

    /**
     * Start a loaded plugin.
     */
    safeHandle("plugins:start", async (_e: IpcEvent, pluginId: string) => {
        assertValidId(pluginId, "pluginId");
        try {
            await opts.pluginHost.startPlugin(pluginId);
            return { success: true };
        } catch (err) {
            logErr(err);
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    });

    /**
     * Stop a running plugin.
     */
    safeHandle("plugins:stop", async (_e: IpcEvent, pluginId: string) => {
        assertValidId(pluginId, "pluginId");
        try {
            await opts.pluginHost.stopPlugin(pluginId);
            return { success: true };
        } catch (err) {
            logErr(err);
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    });

    /**
     * Reload a plugin (stop, unload, load, start).
     */
    safeHandle("plugins:reload", async (_e: IpcEvent, pluginId: string) => {
        assertValidId(pluginId, "pluginId");

        try {
            // Get manifest before unloading
            const plugin = opts.pluginHost.getPlugin(pluginId);
            if (!plugin) {
                throw new Error(`Plugin not loaded: ${pluginId}`);
            }
            const manifest = plugin.manifest;

            // Unload
            await opts.pluginHost.unloadPlugin(pluginId);

            // Load and start again
            await opts.pluginHost.loadPlugin(manifest);
            await opts.pluginHost.startPlugin(pluginId);

            return { success: true };
        } catch (err) {
            logErr(err);
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    });

    /**
     * Get detailed info about a plugin.
     */
    safeHandle("plugins:getInfo", async (_e: IpcEvent, pluginId: string) => {
        assertValidId(pluginId, "pluginId");

        const plugin = opts.pluginHost.getPlugin(pluginId);
        if (!plugin) {
            return null;
        }

        const stateData = opts.pluginStateStore
            ? await opts.pluginStateStore.get(pluginId)
            : null;

        return {
            id: plugin.manifest.id,
            name: plugin.manifest.name,
            version: plugin.manifest.version,
            author: plugin.manifest.author,
            description: plugin.manifest.description,
            requires: plugin.manifest.requires,
            permissions: plugin.manifest.permissions,
            hasSettingsUI: !!plugin.manifest.settingsUI,
            settingsUI: plugin.manifest.settingsUI,
            state: plugin.state,
            enabled: stateData?.enabled ?? true,
            error: plugin.error?.message,
            errorTime: stateData?.lastErrorTime,
        };
    });

    /**
     * Enable a plugin (will be loaded on next start or immediately if discovered).
     */
    safeHandle("plugins:enable", async (_e: IpcEvent, pluginId: string) => {
        assertValidId(pluginId, "pluginId");

        if (!opts.pluginStateStore) {
            return { success: false, error: "Plugin state store not available" };
        }

        try {
            await opts.pluginStateStore.enable(pluginId);

            // Try to load and start the plugin immediately if discovered
            const manifests = await opts.pluginHost.discoverPlugins();
            const manifest = manifests.find((m) => m.id === pluginId);
            if (manifest) {
                await opts.pluginHost.loadPlugin(manifest);
                await opts.pluginHost.startPlugin(pluginId);
            }

            return { success: true };
        } catch (err) {
            logErr(err);
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    });

    /**
     * Disable a plugin (will be stopped and not loaded on next start).
     */
    safeHandle("plugins:disable", async (_e: IpcEvent, pluginId: string) => {
        assertValidId(pluginId, "pluginId");

        if (!opts.pluginStateStore) {
            return { success: false, error: "Plugin state store not available" };
        }

        try {
            await opts.pluginStateStore.disable(pluginId);

            // Stop and unload the plugin if currently loaded
            const plugin = opts.pluginHost.getPlugin(pluginId);
            if (plugin) {
                await opts.pluginHost.unloadPlugin(pluginId);
            }

            return { success: true };
        } catch (err) {
            logErr(err);
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    });

    /**
     * Check if a plugin is enabled.
     */
    safeHandle("plugins:isEnabled", async (_e: IpcEvent, pluginId: string) => {
        assertValidId(pluginId, "pluginId");

        if (!opts.pluginStateStore) {
            return true; // Default to enabled if no state store
        }

        return opts.pluginStateStore.isEnabled(pluginId);
    });

    /**
     * List all discovered plugins with their states (including not-loaded ones).
     */
    safeHandle("plugins:listAll", async (): Promise<PluginStateInfo[]> => {
        const manifests = await opts.pluginHost.discoverPlugins();
        const loadedStates = opts.pluginHost.getAllPluginStates();
        const stateMap = new Map(loadedStates.map((s) => [s.id, s]));

        const result: PluginStateInfo[] = [];

        for (const manifest of manifests) {
            const loaded = stateMap.get(manifest.id);
            const stateData = opts.pluginStateStore
                ? await opts.pluginStateStore.get(manifest.id)
                : null;

            result.push({
                id: manifest.id,
                name: manifest.name,
                version: manifest.version,
                state: loaded?.state ?? "discovered",
                enabled: stateData?.enabled ?? true,
                error: loaded?.error ?? stateData?.lastError,
                errorTime: stateData?.lastErrorTime,
                author: manifest.author,
                description: manifest.description,
                hasSettingsUI: !!manifest.settingsUI,
                settingsUI: manifest.settingsUI,
                permissions: manifest.permissions,
                requires: manifest.requires,
            });
        }

        return result;
    });

    /**
     * Resolve settings UI URL for a plugin (file:// path into plugin directory).
     * Requires the plugin to declare settingsUI and the settings:ui permission.
     */
    safeHandle("plugins:getSettingsUI", async (_e: IpcEvent, pluginId: string) => {
        assertValidId(pluginId, "pluginId");

        // Prefer loaded plugin, fallback to discovered manifest for disabled/not-yet-loaded plugins
        let plugin = opts.pluginHost.getPlugin(pluginId);
        let manifest = plugin?.manifest;

        if (!manifest) {
            const manifests = await opts.pluginHost.discoverPlugins();
            manifest = manifests.find((m) => m.id === pluginId);
        }

        if (!manifest) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }
        if (!manifest.settingsUI) {
            throw new Error("Plugin has no settings UI");
        }
        if (!manifest.permissions.includes("settings:ui")) {
            throw new Error("Plugin missing settings:ui permission");
        }

        const path = require("path");
        const fs = require("fs");
        const fallbackDir = path.join(app.getPath("userData"), "plugins", pluginId);
        const pluginDir = plugin?.context?.pluginDir ?? fallbackDir;
        const entryPath = path.resolve(pluginDir, manifest.settingsUI.entry);
        if (!entryPath.startsWith(path.resolve(pluginDir) + path.sep)) {
            throw new Error("Invalid settings UI path");
        }
        if (!fs.existsSync(entryPath)) {
            throw new Error("Settings UI entry not found");
        }

        const html = fs.readFileSync(entryPath, "utf-8");
        const baseHref = pathToFileURL(path.dirname(entryPath) + path.sep).href;

        return {
            url: pathToFileURL(entryPath).href,
            width: manifest.settingsUI.width,
            height: manifest.settingsUI.height,
            html,
            baseHref,
        };
    });

    /**
     * Invoke a plugin IPC handler from the renderer (used by plugin UI iframe).
     * Channel must be declared in manifest.ipcChannels.
     */
    safeHandle("plugins:invokeChannel", async (_e: IpcEvent, pluginId: string, channel: string, ...args: unknown[]) => {
        assertValidId(pluginId, "pluginId");
        if (!channel || typeof channel !== "string") {
            throw new Error("Invalid channel");
        }

        const plugin = opts.pluginHost.getPlugin(pluginId);
        if (!plugin) {
            throw new Error(`Plugin not loaded: ${pluginId}`);
        }

        const allowed = plugin.manifest.ipcChannels ?? [];
        const prefixed = channel.startsWith(`${pluginId}:`) ? channel : `${pluginId}:${channel}`;
        const isAllowed = allowed.some((pattern) => {
            if (pattern.endsWith("*")) {
                return prefixed.startsWith(`${pattern.slice(0, -1)}`);
            }
            return prefixed === pattern || channel === pattern;
        });
        if (!isAllowed) {
            throw new Error("Channel not allowed by manifest");
        }

        try {
            // Use the plugin handler registry instead of internal Electron APIs
            const result = await invokePluginHandler(prefixed, ...args);
            if (result && typeof result === "object" && "ok" in result) {
                return result as { ok: boolean; data?: unknown; error?: string };
            }
            return result;
        } catch (err) {
            logErr(err);
            throw err instanceof Error ? err : new Error(String(err));
        }
    });

     /**
     * Get all plugin sidepanel tabs (for plugins that declare ui.sidepanelTab).
     * Returns array of { pluginId, label, entry, url, html, baseHref, css, js }
     */
    safeHandle("plugins:getSidepanelTabs", async () => {
        const path = require("path");
        const fs = require("fs");

        const manifests = await opts.pluginHost.discoverPlugins();
        const tabs: Array<{
            pluginId: string;
            label: string;
            entry: string;
            url: string;
            html: string;
            baseHref: string;
        }> = [];

        for (const manifest of manifests) {
            // Check if plugin has sidepanelTab UI config
            const ui = manifest.ui as { sidepanelTab?: { label?: string; entry?: string } } | undefined;
            if (!ui?.sidepanelTab?.entry) continue;

            // Check if plugin is enabled
            const stateData = opts.pluginStateStore
                ? await opts.pluginStateStore.get(manifest.id)
                : null;
            if (stateData?.enabled === false) continue;

            const plugin = opts.pluginHost.getPlugin(manifest.id);
            const fallbackDir = path.join(app.getPath("userData"), "plugins", manifest.id);
            const pluginDir = plugin?.context?.pluginDir ?? fallbackDir;
            const entryPath = path.resolve(pluginDir, ui.sidepanelTab.entry);

            // Security: ensure path is within plugin directory
            if (!entryPath.startsWith(path.resolve(pluginDir) + path.sep)) {
                logErr(`[Plugins] Invalid sidepanel path for ${manifest.id}`);
                continue;
            }

            if (!fs.existsSync(entryPath)) {
                logErr(`[Plugins] Sidepanel entry not found for ${manifest.id}: ${entryPath}`);
                continue;
            }

            try {
                const html = fs.readFileSync(entryPath, "utf-8");
                const baseHref = pathToFileURL(path.dirname(entryPath) + path.sep).href;
                const baseDir = path.dirname(entryPath);
                const cssPath = path.join(baseDir, "ui_sidepanel.css");
                const jsPath = path.join(baseDir, "ui_sidepanel.js");
                const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf-8") : "";
                const js = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, "utf-8") : "";

                tabs.push({
                    pluginId: manifest.id,
                    label: ui.sidepanelTab.label || manifest.name,
                    entry: ui.sidepanelTab.entry,
                    url: pathToFileURL(entryPath).href,
                    html,
                    baseHref,
                    css,
                    js,
                });
            } catch (err) {
                logErr(`[Plugins] Failed to read sidepanel for ${manifest.id}: ${err}`);
            }
        }

        return tabs;
    });

    /**
     * Get all plugin overlay views (plugins that declare ui.overlay).
     * Returns array of { pluginId, entry, url, html, baseHref, css, js, transparent?, width?, height? }
     */
    safeHandle("plugins:getOverlayViews", async () => {
        const path = require("path");
        const fs = require("fs");

        const manifests = await opts.pluginHost.discoverPlugins();
        const overlays: Array<{
            pluginId: string;
            entry: string;
            url: string;
            html: string;
            baseHref: string;
            css: string;
            js: string;
            transparent?: boolean;
            width?: number;
            height?: number;
        }> = [];

        for (const manifest of manifests) {
            const ui = manifest.ui as { overlay?: { entry?: string; transparent?: boolean; width?: number; height?: number } } | undefined;
            if (!ui?.overlay?.entry) continue;

            const stateData = opts.pluginStateStore ? await opts.pluginStateStore.get(manifest.id) : null;
            if (stateData?.enabled === false) continue;

            const plugin = opts.pluginHost.getPlugin(manifest.id);
            const fallbackDir = path.join(app.getPath("userData"), "plugins", manifest.id);
            const pluginDir = plugin?.context?.pluginDir ?? fallbackDir;
            const entryPath = path.resolve(pluginDir, ui.overlay.entry);

            if (!entryPath.startsWith(path.resolve(pluginDir) + path.sep)) {
                logErr(`[Plugins] Invalid overlay path for ${manifest.id}`);
                continue;
            }
            if (!fs.existsSync(entryPath)) {
                logErr(`[Plugins] Overlay entry not found for ${manifest.id}: ${entryPath}`);
                continue;
            }

            try {
                const html = fs.readFileSync(entryPath, "utf-8");
                const baseDir = path.dirname(entryPath);
                const baseHref = pathToFileURL(baseDir + path.sep).href;
                const cssPath = path.join(baseDir, "ui_overlay.css");
                const jsPath = path.join(baseDir, "ui_overlay.js");
                const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf-8") : "";
                const js = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, "utf-8") : "";

                overlays.push({
                    pluginId: manifest.id,
                    entry: ui.overlay.entry,
                    url: pathToFileURL(entryPath).href,
                    html,
                    baseHref,
                    css,
                    js,
                    transparent: ui.overlay.transparent,
                    width: ui.overlay.width,
                    height: ui.overlay.height,
                });
            } catch (err) {
                logErr(`[Plugins] Failed to read overlay for ${manifest.id}: ${err}`);
            }
        }

        console.log("[Plugins] getOverlayViews count", overlays.length, "ids", overlays.map((o) => o.pluginId));
        return overlays;
    });
}

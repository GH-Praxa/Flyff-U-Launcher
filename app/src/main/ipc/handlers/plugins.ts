/**
 * IPC handlers for plugin management operations.
 */
import { SafeHandle, IpcEvent, assertValidId } from "../common";
import { app, BrowserWindow } from "electron";
import { pathToFileURL } from "url";
import type { PluginHost } from "../../plugin";
import type { PluginStateStore } from "../../plugin/pluginStateStore";
import type { PluginStateInfo, PluginManifest } from "../../../shared/pluginApi";
import { invokePluginHandler } from "../../plugin/pluginIpc";

export type PluginHandlerOptions = {
    pluginHost: PluginHost;
    pluginStateStore?: PluginStateStore;
    preloadPath?: string;
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

        // Read sibling CSS/JS for inline injection (sandbox prevents loading external files)
        const baseDir = path.dirname(entryPath);
        const baseName = path.basename(entryPath, path.extname(entryPath));
        const cssPath = path.join(baseDir, `${baseName}.css`);
        const jsPath = path.join(baseDir, `${baseName}.js`);
        const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf-8") : "";
        const js = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, "utf-8") : "";

        return {
            url: pathToFileURL(entryPath).href,
            width: manifest.settingsUI.width,
            height: manifest.settingsUI.height,
            html,
            baseHref,
            css,
            js,
        };
    });

    /**
     * Open a plugin settings UI in a standalone BrowserWindow.
     * Provides full IPC access via the app preload script.
     */
    const openSettingsWindows = new Map<string, BrowserWindow>();

    safeHandle("plugins:openSettingsWindow", async (_e: IpcEvent, pluginId: string) => {
        assertValidId(pluginId, "pluginId");

        // If window already open for this plugin, focus it
        const existing = openSettingsWindows.get(pluginId);
        if (existing && !existing.isDestroyed()) {
            existing.focus();
            return { alreadyOpen: true };
        }

        let plugin = opts.pluginHost.getPlugin(pluginId);
        let manifest = plugin?.manifest;
        if (!manifest) {
            const manifests = await opts.pluginHost.discoverPlugins();
            manifest = manifests.find((m) => m.id === pluginId);
        }
        if (!manifest) throw new Error(`Plugin not found: ${pluginId}`);
        if (!manifest.settingsUI) throw new Error("Plugin has no settings UI");
        if (!manifest.permissions.includes("settings:ui")) throw new Error("Plugin missing settings:ui permission");

        const path = require("path");
        const fs = require("fs");
        const fallbackDir = path.join(app.getPath("userData"), "plugins", pluginId);
        const pluginDir = plugin?.context?.pluginDir ?? fallbackDir;
        const entryPath = path.resolve(pluginDir, manifest.settingsUI.entry);
        if (!entryPath.startsWith(path.resolve(pluginDir) + path.sep)) throw new Error("Invalid settings UI path");
        if (!fs.existsSync(entryPath)) throw new Error("Settings UI entry not found");

        let html = fs.readFileSync(entryPath, "utf-8");
        const baseDir = path.dirname(entryPath);
        const baseName = path.basename(entryPath, path.extname(entryPath));
        const cssPath = path.join(baseDir, `${baseName}.css`);
        const jsPath = path.join(baseDir, `${baseName}.js`);
        const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf-8") : "";
        const js = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, "utf-8") : "";

        // Build bridge script: IPC bridge + theme application + scrollbar CSS
        const SCRIPT_CLOSE = "</scr" + "ipt>";
        const bridge = `<script>
(function() {
    var pluginId = ${JSON.stringify(pluginId)};

    // --- IPC bridge ---
    window.plugin = {
        ipc: {
            invoke: function(channel) {
                var args = Array.prototype.slice.call(arguments, 1);
                return window.api.pluginsInvokeChannel(pluginId, channel, ...args);
            }
        }
    };

    // --- Theme support ---
    function hexToRgb(hex) {
        var m = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec((hex || "").trim());
        return m ? [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)].join(",") : null;
    }

    function applyTheme(colors) {
        if (!colors || typeof colors !== "object") return;
        var root = document.documentElement;
        Object.keys(colors).forEach(function(key) {
            var val = colors[key];
            if (typeof val === "string" && val.trim()) {
                root.style.setProperty("--" + key, val.trim());
            }
        });
        // Compute RGB variants for rgba() usage
        var pairs = [
            ["accent", "accent-rgb"],
            ["tabActive", "tab-active-rgb"],
            ["danger", "danger-rgb"],
            ["green", "green-rgb"],
            ["blue", "blue-rgb"]
        ];
        pairs.forEach(function(p) {
            var rgb = hexToRgb(colors[p[0]]);
            if (rgb) root.style.setProperty("--" + p[1], rgb);
        });
    }

    // Fetch current theme on load, listen for live updates
    window.addEventListener("DOMContentLoaded", function() {
        if (window.api && window.api.themeCurrent) {
            window.api.themeCurrent().then(function(snap) {
                if (snap && snap.colors) applyTheme(snap.colors);
            }).catch(function() {});
        }
        if (window.api && window.api.onThemeUpdate) {
            window.api.onThemeUpdate(function(payload) {
                if (payload && payload.colors) applyTheme(payload.colors);
            });
        }
    });
})();
${SCRIPT_CLOSE}`;

        // Strip external CSS/JS refs (we inline them)
        const stripCss = new RegExp(`<link[^>]*${baseName}\\.css[^>]*>`, "i");
        const stripJs = new RegExp(`<script[^>]*${baseName}\\.js[^>]*>${SCRIPT_CLOSE}`, "i");
        html = html.replace(stripCss, "");
        html = html.replace(stripJs, "");

        // Standalone window overrides: scrollable body, themed background, styled scrollbars
        const windowCss = `
html, body {
  height: auto;
  overflow-y: auto;
  background: linear-gradient(180deg, var(--panel, #0f1a33), var(--panel2, #0d1830));
}
#app { height: auto; overflow-y: visible; padding: 10px; }
::-webkit-scrollbar { width: 10px; height: 8px; }
::-webkit-scrollbar-track {
  background: rgba(255,255,255,0.02);
  border-radius: 10px;
  border: 1px solid var(--stroke, #1b2b4d);
}
::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(var(--accent-rgb, 46,204,113),0.35), rgba(var(--accent-rgb, 46,204,113),0.18));
  border-radius: 10px;
  border: 1px solid rgba(var(--accent-rgb, 46,204,113),0.45);
}
::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(var(--accent-rgb, 46,204,113),0.45), rgba(var(--accent-rgb, 46,204,113),0.28));
}
`;
        // Inject inline CSS into <head>
        const allCss = css + windowCss;
        if (allCss && html.includes("</head>")) {
            html = html.replace("</head>", `<style>${allCss}</style></head>`);
        } else if (allCss) {
            html = `<style>${allCss}</style>${html}`;
        }

        // Inject bridge + plugin JS before </body>
        const combinedJs = bridge + (js ? `\n<script>${js}${SCRIPT_CLOSE}` : "");
        if (html.includes("</body>")) {
            html = html.replace("</body>", `${combinedJs}</body>`);
        } else {
            html += combinedJs;
        }

        const width = Math.max(400, manifest.settingsUI.width || 520);
        const height = Math.max(300, manifest.settingsUI.height || 600);

        const win = new BrowserWindow({
            width,
            height,
            minWidth: 380,
            minHeight: 280,
            frame: true,
            resizable: true,
            title: manifest.name || pluginId,
            backgroundColor: "#0b1220",
            webPreferences: {
                preload: opts.preloadPath,
                nodeIntegration: false,
                contextIsolation: true,
            },
        });

        win.setMenuBarVisibility(false);
        openSettingsWindows.set(pluginId, win);
        win.on("closed", () => openSettingsWindows.delete(pluginId));

        // Write to temp file so preload script gets loaded (data: URLs skip preload)
        const tempDir = app.getPath("temp");
        const tempHtmlPath = path.join(tempDir, `flyff-plugin-${pluginId}.html`);
        fs.writeFileSync(tempHtmlPath, html, "utf-8");
        win.loadFile(tempHtmlPath);

        return { opened: true };
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
            // Plugin handlers wrap results as { ok, data, error }. Unwrap here
            // so safeHandle doesn't double-wrap. All consumers then get clean data.
            if (result && typeof result === "object" && "ok" in result) {
                const wrapped = result as { ok: boolean; data?: unknown; error?: string };
                if (!wrapped.ok) {
                    throw new Error(wrapped.error || "Plugin handler failed");
                }
                return wrapped.data;
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
            css: string;
            js: string;
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

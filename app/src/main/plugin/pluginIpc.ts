/**
 * Plugin IPC Bridge
 *
 * Creates namespaced IPC bridges for plugins.
 * All channels are automatically prefixed with the plugin ID for isolation.
 */

import { ipcMain, BrowserWindow, IpcMainInvokeEvent, IpcMainEvent } from "electron";
import type { PluginIpcBridge } from "../../shared/pluginApi";
import { logErr, logWarn } from "../../shared/logger";

type HandlerFn = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> | unknown;
type ListenerFn = (event: IpcMainEvent, ...args: unknown[]) => void;

/**
 * Global registry of plugin IPC handlers.
 * Used to invoke handlers directly without relying on internal Electron APIs.
 */
const pluginHandlerRegistry = new Map<string, HandlerFn>();

/**
 * Invokes a registered plugin handler by channel name.
 * Returns the raw result from the handler (already wrapped in { ok, data } format).
 */
export async function invokePluginHandler(
    channel: string,
    ...args: unknown[]
): Promise<unknown> {
    const handler = pluginHandlerRegistry.get(channel);
    if (!handler) {
        throw new Error(`Handler not found for ${channel}`);
    }
    return handler({} as IpcMainInvokeEvent, ...args);
}

/**
 * Checks if a plugin handler is registered for the given channel.
 */
export function hasPluginHandler(channel: string): boolean {
    return pluginHandlerRegistry.has(channel);
}

/**
 * Creates an IPC bridge scoped to a specific plugin.
 * All channels are prefixed with the plugin ID to prevent collisions.
 *
 * @param pluginId The plugin identifier
 * @param allowedChannels Channel patterns declared in manifest (supports wildcards)
 * @returns PluginIpcBridge instance
 */
export function createPluginIpcBridge(
    pluginId: string,
    allowedChannels: string[]
): PluginIpcBridge & { removeAllHandlers(): void } {
    const registeredHandlers = new Set<string>();
    const registeredListeners = new Map<string, Set<ListenerFn>>();

    /**
     * Checks if a channel is allowed based on the manifest declaration.
     */
    function isChannelAllowed(channel: string): boolean {
        // Plugin's own channels are always allowed
        if (channel.startsWith(`${pluginId}:`)) {
            return true;
        }

        for (const allowed of allowedChannels) {
            if (allowed.endsWith("*")) {
                // Wildcard pattern: "exp:*" matches "exp:update", "exp:toggle", etc.
                const prefix = allowed.slice(0, -1);
                if (channel.startsWith(prefix)) {
                    return true;
                }
            } else if (channel === allowed) {
                return true;
            }
        }

        return false;
    }

    /**
     * Prefixes a channel with the plugin ID if not already prefixed.
     */
    function prefixChannel(channel: string): string {
        if (channel.startsWith(`${pluginId}:`)) {
            return channel;
        }
        return `${pluginId}:${channel}`;
    }

    /**
     * Registers an IPC handler (invoke/handle pattern).
     */
    function handle<T>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<T> | T
    ): void {
        const prefixed = prefixChannel(channel);

        if (!isChannelAllowed(channel) && !isChannelAllowed(prefixed)) {
            logWarn(
                `Plugin ${pluginId} attempted to register unauthorized channel: ${channel}`,
                "PluginIpc"
            );
            return;
        }

        // Remove existing handler if any (for hot-reload support)
        try {
            ipcMain.removeHandler(prefixed);
            pluginHandlerRegistry.delete(prefixed);
        } catch {
            // Ignore if no handler exists
        }

        // Create wrapped handler that returns { ok, data } format
        const wrappedHandler: HandlerFn = async (event, ...args) => {
            try {
                const result = await handler(event, ...args);
                return { ok: true, data: result };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                logErr(`[${prefixed}] ${message}`, `Plugin:${pluginId}`);
                return { ok: false, error: message, code: "PLUGIN_ERROR" };
            }
        };

        // Register with Electron IPC
        ipcMain.handle(prefixed, wrappedHandler);

        // Also register in our global registry for direct invocation
        pluginHandlerRegistry.set(prefixed, wrappedHandler);

        registeredHandlers.add(prefixed);
    }

    /**
     * Registers an IPC listener (send/on pattern).
     */
    function on(
        channel: string,
        listener: (event: IpcMainEvent, ...args: unknown[]) => void
    ): void {
        const prefixed = prefixChannel(channel);

        if (!isChannelAllowed(channel) && !isChannelAllowed(prefixed)) {
            logWarn(
                `Plugin ${pluginId} attempted to listen on unauthorized channel: ${channel}`,
                "PluginIpc"
            );
            return;
        }

        ipcMain.on(prefixed, listener);

        if (!registeredListeners.has(prefixed)) {
            registeredListeners.set(prefixed, new Set());
        }
        registeredListeners.get(prefixed)!.add(listener);
    }

    /**
     * Sends a message to a window.
     */
    function send(window: BrowserWindow, channel: string, ...args: unknown[]): void {
        const prefixed = prefixChannel(channel);

        if (!isChannelAllowed(channel) && !isChannelAllowed(prefixed)) {
            logWarn(
                `Plugin ${pluginId} attempted to send on unauthorized channel: ${channel}`,
                "PluginIpc"
            );
            return;
        }

        if (window && !window.isDestroyed()) {
            window.webContents.send(prefixed, ...args);
        }
    }

    /**
     * Broadcasts a message to all windows.
     */
    function broadcast(channel: string, ...args: unknown[]): void {
        const prefixed = prefixChannel(channel);

        if (!isChannelAllowed(channel) && !isChannelAllowed(prefixed)) {
            logWarn(
                `Plugin ${pluginId} attempted to broadcast on unauthorized channel: ${channel}`,
                "PluginIpc"
            );
            return;
        }

        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
            if (!win.isDestroyed()) {
                win.webContents.send(prefixed, ...args);
            }
        }
    }

    /**
     * Invoke a core IPC channel (for accessing core functionality).
     * Note: Core channels must be explicitly allowed.
     */
    async function invokeCore(channel: string, ...args: unknown[]): Promise<unknown> {
        // Only allow specific core channels
        const allowedCoreChannels = [
            "profiles:list",
            "profiles:getOverlayTargetId",
            "profiles:getOverlaySupportTargetId",
            "themes:list",
            "themes:current",
            "features:get",
        ];

        if (!allowedCoreChannels.includes(channel)) {
            throw new Error(`Plugin ${pluginId} is not allowed to invoke core channel: ${channel}`);
        }

        // Create a temporary renderer-like invoke
        // This is a bit hacky but allows plugins to access core IPC
        return new Promise((resolve, reject) => {
            // We need to call the handler directly since we're in main process
            // This is done by checking registered handlers
            const handler = (ipcMain as unknown as { _invokeHandlers?: Map<string, HandlerFn> })._invokeHandlers?.get(channel);
            if (handler) {
                Promise.resolve(handler({} as IpcMainInvokeEvent, ...args))
                    .then(resolve)
                    .catch(reject);
            } else {
                reject(new Error(`Core channel not found: ${channel}`));
            }
        });
    }

    /**
     * Subscribe to core events.
     */
    function subscribeCore(channel: string, handler: (data: unknown) => void): () => void {
        // Core event channels
        const allowedCoreEvents = [
            "core:profileChanged",
            "core:themeChanged",
            "core:sessionStarted",
            "core:sessionEnded",
        ];

        if (!allowedCoreEvents.includes(channel)) {
            logWarn(
                `Plugin ${pluginId} attempted to subscribe to disallowed core event: ${channel}`,
                "PluginIpc"
            );
            return () => {};
        }

        const listener = (_event: IpcMainEvent, data: unknown) => {
            try {
                handler(data);
            } catch (err) {
                logErr(err, `Plugin:${pluginId}`);
            }
        };

        ipcMain.on(channel, listener);

        return () => {
            ipcMain.removeListener(channel, listener);
        };
    }

    /**
     * Removes an IPC handler.
     */
    function removeHandler(channel: string): void {
        const prefixed = prefixChannel(channel);
        try {
            ipcMain.removeHandler(prefixed);
            pluginHandlerRegistry.delete(prefixed);
            registeredHandlers.delete(prefixed);
        } catch {
            // Ignore if no handler exists
        }
    }

    /**
     * Removes an IPC listener.
     */
    function removeListener(channel: string, listener: (...args: unknown[]) => void): void {
        const prefixed = prefixChannel(channel);
        ipcMain.removeListener(prefixed, listener as ListenerFn);
        registeredListeners.get(prefixed)?.delete(listener as ListenerFn);
    }

    /**
     * Removes all handlers and listeners registered by this plugin.
     * Called during plugin unload.
     */
    function removeAllHandlers(): void {
        // Remove all handlers
        for (const channel of registeredHandlers) {
            try {
                ipcMain.removeHandler(channel);
                pluginHandlerRegistry.delete(channel);
            } catch {
                // Ignore errors
            }
        }
        registeredHandlers.clear();

        // Remove all listeners
        for (const [channel, listeners] of registeredListeners) {
            for (const listener of listeners) {
                ipcMain.removeListener(channel, listener);
            }
        }
        registeredListeners.clear();
    }

    return {
        handle,
        on,
        send,
        broadcast,
        invokeCore,
        subscribeCore,
        removeHandler,
        removeListener,
        removeAllHandlers,
    };
}

export type PluginIpcBridgeInternal = ReturnType<typeof createPluginIpcBridge>;

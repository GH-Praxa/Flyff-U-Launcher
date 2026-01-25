/**
 * Plugin Logger
 *
 * Creates scoped loggers for plugins that prefix all messages
 * with the plugin ID for easy identification in logs.
 */

import type { PluginLogger } from "../../shared/pluginApi";

/**
 * Creates a logger scoped to a specific plugin.
 * All log messages will be prefixed with [Plugin:{pluginId}].
 *
 * @param pluginId The plugin identifier
 * @returns A PluginLogger instance
 */
export function createPluginLogger(pluginId: string): PluginLogger {
    const prefix = `Plugin:${pluginId}`;

    return {
        info(message: string, ...args: unknown[]): void {
            console.info(`[${prefix}]`, message, ...args);
        },

        warn(message: string, ...args: unknown[]): void {
            console.warn(`[${prefix}]`, message, ...args);
        },

        error(message: string | Error, ...args: unknown[]): void {
            if (message instanceof Error) {
                console.error(`[${prefix}]`, message.message, message.stack, ...args);
            } else {
                console.error(`[${prefix}]`, message, ...args);
            }
        },

        debug(message: string, ...args: unknown[]): void {
            // Only log debug messages in development
            if (process.env.NODE_ENV !== "production") {
                console.debug(`[${prefix}]`, message, ...args);
            }
        },
    };
}

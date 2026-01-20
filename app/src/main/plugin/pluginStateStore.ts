/**
 * Plugin State Store
 *
 * Persists plugin enabled/disabled state and error history.
 * Uses the FileStore pattern for consistent JSON file handling.
 */

import { app } from "electron";
import path from "path";
import { createFileStore } from "../../shared/fileStore";

// ============================================================================
// Types
// ============================================================================

export interface PluginStateData {
    id: string;
    enabled: boolean;
    lastError?: string;
    lastErrorTime?: string;
    enabledAt?: string;
    disabledAt?: string;
}

// ============================================================================
// Normalization
// ============================================================================

/**
 * Normalizes raw plugin state data from JSON.
 */
function normalizePluginState(raw: unknown): PluginStateData | null {
    if (!raw || typeof raw !== "object") return null;

    const obj = raw as Record<string, unknown>;

    // ID is required
    if (typeof obj.id !== "string" || !obj.id) return null;

    return {
        id: obj.id,
        enabled: obj.enabled !== false, // Default to enabled
        lastError: typeof obj.lastError === "string" ? obj.lastError : undefined,
        lastErrorTime: typeof obj.lastErrorTime === "string" ? obj.lastErrorTime : undefined,
        enabledAt: typeof obj.enabledAt === "string" ? obj.enabledAt : undefined,
        disabledAt: typeof obj.disabledAt === "string" ? obj.disabledAt : undefined,
    };
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Creates a plugin state store for persisting enabled/disabled states.
 */
export function createPluginStateStore() {
    const store = createFileStore<PluginStateData>({
        getPath: () => path.join(app.getPath("userData"), "plugin-states.json"),
        normalize: normalizePluginState,
    });

    /**
     * Checks if a plugin is enabled.
     * Returns true for unknown plugins (default enabled).
     */
    async function isEnabled(pluginId: string): Promise<boolean> {
        const item = await store.findById(pluginId);
        return item?.enabled !== false;
    }

    /**
     * Sets the enabled state for a plugin.
     */
    async function setEnabled(pluginId: string, enabled: boolean): Promise<void> {
        await store.update((items) => {
            const now = new Date().toISOString();
            const existing = items.find((i) => i.id === pluginId);

            if (existing) {
                return items.map((i) =>
                    i.id === pluginId
                        ? {
                              ...i,
                              enabled,
                              [enabled ? "enabledAt" : "disabledAt"]: now,
                          }
                        : i
                );
            } else {
                return [
                    ...items,
                    {
                        id: pluginId,
                        enabled,
                        [enabled ? "enabledAt" : "disabledAt"]: now,
                    },
                ];
            }
        });
    }

    /**
     * Enables a plugin.
     */
    async function enable(pluginId: string): Promise<void> {
        await setEnabled(pluginId, true);
    }

    /**
     * Disables a plugin.
     */
    async function disable(pluginId: string): Promise<void> {
        await setEnabled(pluginId, false);
    }

    /**
     * Records an error for a plugin.
     */
    async function recordError(pluginId: string, error: string): Promise<void> {
        await store.update((items) => {
            const now = new Date().toISOString();
            const existing = items.find((i) => i.id === pluginId);

            if (existing) {
                return items.map((i) =>
                    i.id === pluginId
                        ? { ...i, lastError: error, lastErrorTime: now }
                        : i
                );
            } else {
                return [
                    ...items,
                    {
                        id: pluginId,
                        enabled: true,
                        lastError: error,
                        lastErrorTime: now,
                    },
                ];
            }
        });
    }

    /**
     * Clears the error for a plugin.
     */
    async function clearError(pluginId: string): Promise<void> {
        await store.update((items) =>
            items.map((i) =>
                i.id === pluginId
                    ? { ...i, lastError: undefined, lastErrorTime: undefined }
                    : i
            )
        );
    }

    /**
     * Gets the state data for a specific plugin.
     */
    async function get(pluginId: string): Promise<PluginStateData | null> {
        return store.findById(pluginId);
    }

    /**
     * Gets state data for all plugins.
     */
    async function getAll(): Promise<Map<string, PluginStateData>> {
        const items = await store.read();
        return new Map(items.map((i) => [i.id, i]));
    }

    /**
     * Gets a list of all enabled plugin IDs.
     */
    async function getEnabledIds(): Promise<string[]> {
        const items = await store.read();
        return items.filter((i) => i.enabled).map((i) => i.id);
    }

    /**
     * Gets a list of all disabled plugin IDs.
     */
    async function getDisabledIds(): Promise<string[]> {
        const items = await store.read();
        return items.filter((i) => !i.enabled).map((i) => i.id);
    }

    /**
     * Removes state data for a plugin.
     */
    async function remove(pluginId: string): Promise<void> {
        await store.update((items) => items.filter((i) => i.id !== pluginId));
    }

    return {
        isEnabled,
        setEnabled,
        enable,
        disable,
        recordError,
        clearError,
        get,
        getAll,
        getEnabledIds,
        getDisabledIds,
        remove,
    };
}

export type PluginStateStore = ReturnType<typeof createPluginStateStore>;

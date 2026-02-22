/**
 * Plugin Settings Store
 *
 * Provides persistent settings storage for plugins.
 * Settings are stored in userData/plugin-data/{pluginId}/settings.json
 */

import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import type { PluginConfigSchema, PluginConfigProperty } from "../../shared/pluginApi";
import { logErr } from "../../shared/logger";

// ============================================================================
// Types
// ============================================================================

export interface PluginSettingsStore {
    /** Get a single setting value */
    get<T = unknown>(key: string): Promise<T | undefined>;

    /** Set a single setting value */
    set<T>(key: string, value: T): Promise<void>;

    /** Get all settings */
    getAll(): Promise<Record<string, unknown>>;

    /** Set all settings (replaces existing) */
    setAll(config: Record<string, unknown>): Promise<void>;

    /** Merge settings (partial update) */
    merge(partial: Record<string, unknown>): Promise<void>;

    /** Reset to defaults */
    reset(): Promise<void>;

    /** Validate settings against schema */
    validate(config: Record<string, unknown>): ValidationResult;

    /** Subscribe to changes */
    onChange(cb: (key: string, value: unknown, oldValue: unknown) => void): () => void;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

export interface ValidationError {
    path: string;
    message: string;
    value?: unknown;
}

// ============================================================================
// Factory
// ============================================================================

export interface PluginSettingsOptions {
    pluginId: string;
    schema?: PluginConfigSchema;
    defaults?: Record<string, unknown>;
}

/**
 * Creates a settings store for a plugin.
 */
export function createPluginSettingsStore(opts: PluginSettingsOptions): PluginSettingsStore {
    const { pluginId, schema, defaults = {} } = opts;

    const dataDir = path.join(app.getPath("userData"), "user", "plugin-data", pluginId);
    const settingsPath = path.join(dataDir, "settings.json");

    const changeListeners = new Set<(key: string, value: unknown, oldValue: unknown) => void>();
    let cachedSettings: Record<string, unknown> | null = null;

    /**
     * Ensures the data directory exists.
     */
    async function ensureDir(): Promise<void> {
        await fs.mkdir(dataDir, { recursive: true });
    }

    /**
     * Reads settings from disk.
     */
    async function readSettings(): Promise<Record<string, unknown>> {
        if (cachedSettings !== null) {
            return cachedSettings;
        }

        try {
            const raw = await fs.readFile(settingsPath, "utf-8");
            const parsed = JSON.parse(raw);
            cachedSettings = typeof parsed === "object" && parsed !== null ? parsed : {};
        } catch {
            // File doesn't exist or is invalid - use defaults
            cachedSettings = { ...defaults };
        }

        return cachedSettings;
    }

    /**
     * Writes settings to disk.
     */
    async function writeSettings(settings: Record<string, unknown>): Promise<void> {
        await ensureDir();
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
        cachedSettings = settings;
    }

    /**
     * Emits change events.
     */
    function emitChange(key: string, value: unknown, oldValue: unknown): void {
        for (const listener of changeListeners) {
            try {
                listener(key, value, oldValue);
            } catch (err) {
                logErr(err, `PluginSettings:${pluginId}`);
            }
        }
    }

    /**
     * Gets a single setting value.
     */
    async function get<T = unknown>(key: string): Promise<T | undefined> {
        const settings = await readSettings();
        const value = settings[key];
        return value !== undefined ? (value as T) : (defaults[key] as T | undefined);
    }

    /**
     * Sets a single setting value.
     */
    async function set<T>(key: string, value: T): Promise<void> {
        const settings = await readSettings();
        const oldValue = settings[key];

        if (oldValue !== value) {
            settings[key] = value;
            await writeSettings(settings);
            emitChange(key, value, oldValue);
        }
    }

    /**
     * Gets all settings.
     */
    async function getAll(): Promise<Record<string, unknown>> {
        const settings = await readSettings();
        // Merge with defaults (settings take precedence)
        return { ...defaults, ...settings };
    }

    /**
     * Sets all settings (replaces existing).
     */
    async function setAll(config: Record<string, unknown>): Promise<void> {
        const oldSettings = await readSettings();
        await writeSettings(config);

        // Emit changes for all keys that changed
        const allKeys = new Set([...Object.keys(oldSettings), ...Object.keys(config)]);
        for (const key of allKeys) {
            if (oldSettings[key] !== config[key]) {
                emitChange(key, config[key], oldSettings[key]);
            }
        }
    }

    /**
     * Merges settings (partial update).
     */
    async function merge(partial: Record<string, unknown>): Promise<void> {
        const settings = await readSettings();
        const merged = { ...settings, ...partial };
        await writeSettings(merged);

        // Emit changes for updated keys
        for (const key of Object.keys(partial)) {
            if (settings[key] !== partial[key]) {
                emitChange(key, partial[key], settings[key]);
            }
        }
    }

    /**
     * Resets to defaults.
     */
    async function reset(): Promise<void> {
        const oldSettings = await readSettings();
        await writeSettings({ ...defaults });

        // Emit changes for all keys
        const allKeys = new Set([...Object.keys(oldSettings), ...Object.keys(defaults)]);
        for (const key of allKeys) {
            if (oldSettings[key] !== defaults[key]) {
                emitChange(key, defaults[key], oldSettings[key]);
            }
        }
    }

    /**
     * Validates settings against schema.
     */
    function validate(config: Record<string, unknown>): ValidationResult {
        if (!schema) {
            return { valid: true, errors: [] };
        }

        const errors: ValidationError[] = [];

        // Check required fields
        if (schema.required) {
            for (const required of schema.required) {
                if (!(required in config)) {
                    errors.push({
                        path: required,
                        message: `Required field '${required}' is missing`,
                    });
                }
            }
        }

        // Validate each property
        for (const [key, value] of Object.entries(config)) {
            const propSchema = schema.properties[key];
            if (!propSchema) {
                // Unknown property - could warn but allow for forward compatibility
                continue;
            }

            const propErrors = validateProperty(key, value, propSchema);
            errors.push(...propErrors);
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Validates a single property value.
     */
    function validateProperty(
        path: string,
        value: unknown,
        propSchema: PluginConfigProperty
    ): ValidationError[] {
        const errors: ValidationError[] = [];

        // Type check
        const actualType = getValueType(value);
        if (actualType !== propSchema.type) {
            errors.push({
                path,
                message: `Expected type '${propSchema.type}' but got '${actualType}'`,
                value,
            });
            return errors; // Skip further validation if type is wrong
        }

        // Number constraints
        if (propSchema.type === "number" && typeof value === "number") {
            if (propSchema.minimum !== undefined && value < propSchema.minimum) {
                errors.push({
                    path,
                    message: `Value ${value} is less than minimum ${propSchema.minimum}`,
                    value,
                });
            }
            if (propSchema.maximum !== undefined && value > propSchema.maximum) {
                errors.push({
                    path,
                    message: `Value ${value} is greater than maximum ${propSchema.maximum}`,
                    value,
                });
            }
        }

        // String constraints
        if (propSchema.type === "string" && typeof value === "string") {
            if (propSchema.minLength !== undefined && value.length < propSchema.minLength) {
                errors.push({
                    path,
                    message: `String length ${value.length} is less than minimum ${propSchema.minLength}`,
                    value,
                });
            }
            if (propSchema.maxLength !== undefined && value.length > propSchema.maxLength) {
                errors.push({
                    path,
                    message: `String length ${value.length} is greater than maximum ${propSchema.maxLength}`,
                    value,
                });
            }
        }

        // Enum constraint
        if (propSchema.enum && !propSchema.enum.includes(value)) {
            errors.push({
                path,
                message: `Value must be one of: ${propSchema.enum.join(", ")}`,
                value,
            });
        }

        return errors;
    }

    /**
     * Gets the JSON schema type of a value.
     */
    function getValueType(value: unknown): string {
        if (value === null) return "null";
        if (Array.isArray(value)) return "array";
        return typeof value;
    }

    /**
     * Subscribes to setting changes.
     */
    function onChange(cb: (key: string, value: unknown, oldValue: unknown) => void): () => void {
        changeListeners.add(cb);
        return () => changeListeners.delete(cb);
    }

    return {
        get,
        set,
        getAll,
        setAll,
        merge,
        reset,
        validate,
        onChange,
    };
}

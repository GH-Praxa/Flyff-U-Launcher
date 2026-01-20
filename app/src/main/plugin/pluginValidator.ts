/**
 * Plugin Manifest Validation
 *
 * Uses Zod schemas for runtime validation of plugin manifests.
 * Ensures plugins declare valid metadata, requirements, and permissions.
 */

import { z } from "zod";
import type { PluginManifest, PluginRequirement, PluginPermission } from "../../shared/pluginApi";
import { logWarn } from "../../shared/logger";

// ============================================================================
// Plugin Constants
// ============================================================================

export const PLUGIN_CONSTANTS = {
    /** Minimum plugin ID length */
    MIN_ID_LENGTH: 3,
    /** Maximum plugin ID length */
    MAX_ID_LENGTH: 32,
    /** Maximum plugin name length */
    MAX_NAME_LENGTH: 64,
    /** Maximum description length */
    MAX_DESCRIPTION_LENGTH: 512,
    /** Maximum author length */
    MAX_AUTHOR_LENGTH: 128,
} as const;

// ============================================================================
// Valid Values
// ============================================================================

const VALID_REQUIREMENTS: PluginRequirement[] = [
    "profiles",
    "sessionTabs",
    "sessionWindow",
    "instances",
    "themes",
    "features",
    "roiStore",
    "pythonOcr",
    "dataCache",
    "storage",       // V2: Plugin-scoped storage API
    "notifications", // V2: Toast/notification system
    "http",          // V2: HTTP fetch with CORS bypass
];

const VALID_PERMISSIONS: PluginPermission[] = [
    "window:create",
    "window:capture",
    "ipc:register",
    "storage:read",
    "storage:write",
    "ocr:access",
    "settings:ui",      // V2: Can render settings UI
    "ui:overlay",       // V2: Can create overlay elements
    "ui:launcher",      // V2: Can add launcher UI elements
    "network:fetch",    // V2: Can make HTTP requests
    "clipboard:read",   // V2: Can read clipboard
    "clipboard:write",  // V2: Can write to clipboard
];

function parseVersionParts(input: string): number[] | null {
    const m = input.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
    if (!m)
        return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function isLessThanVersion(v1: string, v2: string): boolean {
    const a = parseVersionParts(v1);
    const b = parseVersionParts(v2);
    if (!a || !b)
        return false;
    for (let i = 0; i < 3; i += 1) {
        if (a[i] === b[i])
            continue;
        return a[i] < b[i];
    }
    return false;
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Plugin ID: lowercase letters, numbers, hyphens only.
 * Must start with a letter, 3-32 characters.
 */
export const PluginIdSchema = z
    .string()
    .min(PLUGIN_CONSTANTS.MIN_ID_LENGTH, `Plugin ID must be at least ${PLUGIN_CONSTANTS.MIN_ID_LENGTH} characters`)
    .max(PLUGIN_CONSTANTS.MAX_ID_LENGTH, `Plugin ID cannot exceed ${PLUGIN_CONSTANTS.MAX_ID_LENGTH} characters`)
    .regex(
        /^[a-z][a-z0-9-]*$/,
        "Plugin ID must start with a letter and contain only lowercase letters, numbers, and hyphens"
    );

/**
 * Semantic version string (e.g., "1.0.0", "2.1.0-beta")
 */
export const SemverSchema = z.string().refine(
    (v) => parseVersionParts(v) !== null,
    { message: "Must be a valid semantic version (e.g., 1.0.0)" }
);

/**
 * IPC channel pattern (lowercase, colons, wildcards allowed)
 */
export const IpcChannelSchema = z
    .string()
    .regex(
        /^[a-z][a-z0-9-]*(:([a-z0-9-]+|\*))*$/,
        "IPC channel must be lowercase with colons as separators (e.g., 'overlay:toggle' or 'exp:*')"
    );

/**
 * Settings UI schema
 */
export const SettingsUISchema = z.object({
    entry: z.string().regex(/\.html$/, "Settings UI entry must be an HTML file"),
    width: z.number().min(200).max(1200).optional(),
    height: z.number().min(100).max(800).optional(),
});

/**
 * Events configuration schema
 */
export const EventsSchema = z.object({
    subscribe: z.array(z.string()).max(50).optional(),
    emit: z.array(z.string()).max(50).optional(),
});

/**
 * UI configuration schema
 */
export const UIConfigSchema = z.object({
    launcherTab: z.object({
        label: z.string().max(32),
        icon: z.string().optional(),
    }).optional(),
    sidepanelTab: z.object({
        label: z.string().max(32).optional(),
        entry: z.string().regex(/\.html$/, "Sidepanel entry must be an HTML file"),
    }).optional(),
    overlay: z.object({
        entry: z.string().regex(/\.html$/, "Overlay entry must be an HTML file"),
        transparent: z.boolean().optional(),
        width: z.number().min(50).max(4000).optional(),
        height: z.number().min(50).max(4000).optional(),
    }).optional(),
    overlayPanel: z.object({
        position: z.enum(["left", "right", "bottom"]).optional(),
    }).optional(),
    menuItems: z.array(z.object({
        label: z.string().max(64),
        action: z.string(),
    })).max(20).optional(),
});

/**
 * Config property schema (for plugin settings)
 */
export const ConfigPropertySchema: z.ZodType<unknown> = z.lazy(() => z.object({
    type: z.enum(["string", "number", "boolean", "array", "object"]),
    title: z.string().max(64).optional(),
    description: z.string().max(256).optional(),
    default: z.unknown().optional(),
    enum: z.array(z.unknown()).optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    items: z.lazy(() => ConfigPropertySchema).optional(),
}));

/**
 * Config schema schema (JSON Schema subset)
 */
export const ConfigSchemaSchema = z.object({
    type: z.literal("object"),
    properties: z.record(z.string(), ConfigPropertySchema),
    required: z.array(z.string()).optional(),
});

/**
 * Full plugin manifest schema (V2)
 */
export const PluginManifestSchema = z.object({
    // Core metadata
    id: PluginIdSchema,
    name: z
        .string()
        .min(1, "Plugin name is required")
        .max(PLUGIN_CONSTANTS.MAX_NAME_LENGTH, `Name cannot exceed ${PLUGIN_CONSTANTS.MAX_NAME_LENGTH} characters`),
    version: SemverSchema,
    minLauncherVersion: SemverSchema,
    author: z
        .string()
        .max(PLUGIN_CONSTANTS.MAX_AUTHOR_LENGTH)
        .optional(),
    description: z
        .string()
        .max(PLUGIN_CONSTANTS.MAX_DESCRIPTION_LENGTH)
        .optional(),
    homepage: z.string().url().optional(),
    license: z.string().max(32).optional(),

    // Entry points
    main: z
        .string()
        .min(1, "Main entry point is required")
        .regex(/\.(js|mjs|cjs)$/, "Main entry point must be a JavaScript file (.js, .mjs, .cjs)"),
    preload: z
        .string()
        .regex(/\.js$/, "Preload script must be a JavaScript file")
        .optional(),
    settingsUI: SettingsUISchema.optional(),

    // IPC & Communication
    ipcChannels: z
        .array(IpcChannelSchema)
        .min(0)
        .max(50, "Too many IPC channels declared"),
    events: EventsSchema.optional(),

    // Requirements & Permissions
    requires: z
        .array(z.enum(VALID_REQUIREMENTS as [PluginRequirement, ...PluginRequirement[]]))
        .min(0)
        .max(20),
    permissions: z
        .array(z.enum(VALID_PERMISSIONS as [PluginPermission, ...PluginPermission[]]))
        .min(0)
        .max(20),

    // Configuration
    configSchema: ConfigSchemaSchema.optional(),
    configDefaults: z.record(z.string(), z.unknown()).optional(),
    config: z.record(z.string(), z.unknown()).optional(), // Legacy

    // UI Registration
    ui: UIConfigSchema.optional(),

    // Dependencies
    dependencies: z.record(z.string(), z.string()).optional(),
});

// ============================================================================
// Validation Functions
// ============================================================================

export interface ManifestValidationResult {
    valid: boolean;
    manifest?: PluginManifest;
    errors?: string[];
    warnings?: string[];
}

/**
 * Validates a plugin manifest object.
 *
 * @param data Raw manifest data (parsed from JSON)
 * @param currentLauncherVersion Current launcher version for compatibility check
 * @returns Validation result with parsed manifest or errors
 */
export function validateManifest(
    data: unknown,
    currentLauncherVersion?: string
): ManifestValidationResult {
    const warnings: string[] = [];

    // Step 1: Schema validation
    const parseResult = PluginManifestSchema.safeParse(data);

    if (!parseResult.success) {
        return {
            valid: false,
            errors: parseResult.error.issues.map(
                (issue) => `${issue.path.join(".")}: ${issue.message}`
            ),
        };
    }

    const manifest = parseResult.data as PluginManifest;

    // Step 2: Version compatibility check
    if (currentLauncherVersion && manifest.minLauncherVersion) {
        if (isLessThanVersion(currentLauncherVersion, manifest.minLauncherVersion)) {
            return {
                valid: false,
                errors: [
                    `Plugin requires launcher version ${manifest.minLauncherVersion} or higher (current: ${currentLauncherVersion})`,
                ],
            };
        }
    }

    // Step 3: Permission warnings
    if (manifest.permissions.includes("window:capture")) {
        warnings.push("Plugin requests window:capture permission - can take screenshots");
    }
    if (manifest.permissions.includes("storage:write")) {
        warnings.push("Plugin requests storage:write permission - can write to userData");
    }

    // Step 4: IPC channel sanity check
    const hasRegisterPermission = manifest.permissions.includes("ipc:register");
    if (manifest.ipcChannels.length > 0 && !hasRegisterPermission) {
        warnings.push("Plugin declares IPC channels but doesn't have 'ipc:register' permission");
    }

    return {
        valid: true,
        manifest,
        warnings: warnings.length > 0 ? warnings : undefined,
    };
}

/**
 * Quick check if data looks like a valid manifest (without full validation).
 * Used for initial filtering during plugin discovery.
 */
export function isManifestLike(data: unknown): data is Partial<PluginManifest> {
    if (!data || typeof data !== "object") return false;

    const obj = data as Record<string, unknown>;
    return (
        typeof obj.id === "string" &&
        typeof obj.name === "string" &&
        typeof obj.version === "string" &&
        typeof obj.main === "string"
    );
}

/**
 * Validates that the main entry point file exists and is within the plugin directory.
 */
export function validateMainEntry(pluginDir: string, mainFile: string): { valid: boolean; error?: string } {
    const path = require("path");
    const fs = require("fs");

    const mainPath = path.resolve(pluginDir, mainFile);
    const resolvedPluginDir = path.resolve(pluginDir);

    // Security: Ensure main file is within plugin directory (no path traversal)
    if (!mainPath.startsWith(resolvedPluginDir + path.sep)) {
        return {
            valid: false,
            error: `Main entry point attempts path traversal: ${mainFile}`,
        };
    }

    // Check file exists
    if (!fs.existsSync(mainPath)) {
        return {
            valid: false,
            error: `Main entry point not found: ${mainFile}`,
        };
    }

    // Check it's a file
    const stats = fs.statSync(mainPath);
    if (!stats.isFile()) {
        return {
            valid: false,
            error: `Main entry point is not a file: ${mainFile}`,
        };
    }

    return { valid: true };
}

/**
 * Logs manifest validation warnings.
 */
export function logManifestWarnings(pluginId: string, warnings: string[]): void {
    for (const warning of warnings) {
        logWarn(`[${pluginId}] ${warning}`, "PluginValidator");
    }
}

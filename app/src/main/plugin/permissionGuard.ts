/**
 * Permission Guard
 *
 * Enforces permission checks for plugin operations.
 * Plugins must declare required permissions in their manifest.
 */

import type { PluginManifest, PluginPermission } from "../../shared/pluginApi";
import { logWarn } from "../../shared/logger";

// ============================================================================
// Permission Mapping
// ============================================================================

/**
 * Maps actions to required permissions.
 */
const PERMISSION_MAP: Record<string, PluginPermission> = {
    // Window operations
    "window:create": "window:create",
    "window:createOverlay": "window:create",
    "window:capture": "window:capture",
    "window:screenshot": "window:capture",

    // IPC operations
    "ipc:register": "ipc:register",
    "ipc:handle": "ipc:register",
    "ipc:on": "ipc:register",

    // Storage operations
    "storage:read": "storage:read",
    "storage:write": "storage:write",
    "storage:delete": "storage:write",
    "storage:clear": "storage:write",

    // OCR operations
    "ocr:acquire": "ocr:access",
    "ocr:recognize": "ocr:access",

    // Settings UI
    "settings:render": "settings:ui",
    "settings:update": "settings:ui",

    // UI operations
    "ui:createOverlay": "ui:overlay",
    "ui:addLauncherTab": "ui:launcher",
    "ui:addMenuItem": "ui:launcher",

    // Network operations
    "network:fetch": "network:fetch",
    "network:request": "network:fetch",

    // Clipboard operations
    "clipboard:read": "clipboard:read",
    "clipboard:write": "clipboard:write",
};

// ============================================================================
// Permission Guard Factory
// ============================================================================

export interface PermissionGuard {
    /** Check if an action is allowed (returns boolean) */
    check(action: string): boolean;

    /** Require permission for an action (throws if denied) */
    require(action: string): void;

    /** Check if a specific permission is granted */
    has(permission: PluginPermission): boolean;

    /** Get all granted permissions */
    getGranted(): PluginPermission[];

    /** Get all permissions that would be needed for an action */
    getRequiredFor(action: string): PluginPermission | null;
}

/**
 * Creates a permission guard for a plugin based on its manifest.
 */
export function createPermissionGuard(manifest: PluginManifest): PermissionGuard {
    const granted = new Set<PluginPermission>(manifest.permissions);
    const pluginId = manifest.id;

    /**
     * Check if an action is allowed.
     */
    function check(action: string): boolean {
        const required = PERMISSION_MAP[action];
        if (!required) {
            // Unknown actions are allowed by default
            return true;
        }
        return granted.has(required);
    }

    /**
     * Require permission for an action (throws if denied).
     */
    function require(action: string): void {
        const required = PERMISSION_MAP[action];
        if (!required) {
            return; // Unknown actions allowed
        }

        if (!granted.has(required)) {
            const error = new PermissionDeniedError(
                pluginId,
                action,
                required
            );
            throw error;
        }
    }

    /**
     * Check if a specific permission is granted.
     */
    function has(permission: PluginPermission): boolean {
        return granted.has(permission);
    }

    /**
     * Get all granted permissions.
     */
    function getGranted(): PluginPermission[] {
        return Array.from(granted);
    }

    /**
     * Get the permission required for an action.
     */
    function getRequiredFor(action: string): PluginPermission | null {
        return PERMISSION_MAP[action] ?? null;
    }

    return {
        check,
        require,
        has,
        getGranted,
        getRequiredFor,
    };
}

// ============================================================================
// Permission Error
// ============================================================================

export class PermissionDeniedError extends Error {
    public readonly pluginId: string;
    public readonly action: string;
    public readonly permission: PluginPermission;

    constructor(pluginId: string, action: string, permission: PluginPermission) {
        super(
            `Plugin '${pluginId}' lacks permission '${permission}' required for action '${action}'`
        );
        this.name = "PermissionDeniedError";
        this.pluginId = pluginId;
        this.action = action;
        this.permission = permission;
    }
}

// ============================================================================
// Permission Utilities
// ============================================================================

/**
 * Logs a warning about a sensitive permission being used.
 */
export function warnSensitivePermission(
    pluginId: string,
    permission: PluginPermission
): void {
    const SENSITIVE_PERMISSIONS: PluginPermission[] = [
        "window:capture",
        "storage:write",
        "network:fetch",
        "clipboard:read",
        "clipboard:write",
    ];

    if (SENSITIVE_PERMISSIONS.includes(permission)) {
        logWarn(
            `Plugin '${pluginId}' is using sensitive permission: ${permission}`,
            "PermissionGuard"
        );
    }
}

/**
 * Validates that a plugin has all required permissions for its declared features.
 */
export function validatePermissionConsistency(manifest: PluginManifest): string[] {
    const warnings: string[] = [];
    const granted = new Set(manifest.permissions);

    // Check IPC channels require ipc:register
    if (manifest.ipcChannels.length > 0 && !granted.has("ipc:register")) {
        warnings.push(
            "Plugin declares IPC channels but doesn't have 'ipc:register' permission"
        );
    }

    // Check settings UI requires settings:ui
    if (manifest.settingsUI && !granted.has("settings:ui")) {
        warnings.push(
            "Plugin has settingsUI but doesn't have 'settings:ui' permission"
        );
    }

    // Check pythonOcr requires ocr:access
    if (manifest.requires.includes("pythonOcr") && !granted.has("ocr:access")) {
        warnings.push(
            "Plugin requires 'pythonOcr' service but doesn't have 'ocr:access' permission"
        );
    }

    // Check http requires network:fetch
    if (manifest.requires.includes("http") && !granted.has("network:fetch")) {
        warnings.push(
            "Plugin requires 'http' service but doesn't have 'network:fetch' permission"
        );
    }

    // Check storage requires storage:read or storage:write
    if (
        manifest.requires.includes("storage") &&
        !granted.has("storage:read") &&
        !granted.has("storage:write")
    ) {
        warnings.push(
            "Plugin requires 'storage' service but doesn't have storage permissions"
        );
    }

    return warnings;
}

/**
 * Describes what a permission allows.
 */
export const PERMISSION_DESCRIPTIONS: Record<PluginPermission, string> = {
    "window:create": "Create new windows (overlays, panels)",
    "window:capture": "Take screenshots of game windows",
    "ipc:register": "Register IPC handlers for communication",
    "storage:read": "Read data from plugin storage",
    "storage:write": "Write data to plugin storage",
    "ocr:access": "Use OCR to read text from screen",
    "settings:ui": "Show custom settings interface",
    "ui:overlay": "Add elements to game overlay",
    "ui:launcher": "Add tabs/menus to launcher",
    "network:fetch": "Make HTTP requests to external servers",
    "clipboard:read": "Read text from clipboard",
    "clipboard:write": "Write text to clipboard",
};

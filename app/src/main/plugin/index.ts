/**
 * Plugin System (V2)
 *
 * Central exports for the plugin infrastructure.
 */

// Plugin Host
export { createPluginHost } from "./pluginHost";
export type { PluginHost } from "./pluginHost";

// Plugin Logger
export { createPluginLogger } from "./pluginLogger";

// Plugin IPC Bridge
export { createPluginIpcBridge } from "./pluginIpc";
export type { PluginIpcBridgeInternal } from "./pluginIpc";

// Event Bus
export { createEventBus, createScopedEventBus } from "./eventBus";
export type { GlobalEventBus, PluginEventBusV2, PluginEvents } from "./eventBus";

// Manifest Validation
export {
    validateManifest,
    validateMainEntry,
    isManifestLike,
    logManifestWarnings,
    PluginManifestSchema,
    PluginIdSchema,
    SemverSchema,
    IpcChannelSchema,
    PLUGIN_CONSTANTS,
} from "./pluginValidator";
export type { ManifestValidationResult } from "./pluginValidator";

// Plugin State Store (persistence)
export { createPluginStateStore } from "./pluginStateStore";
export type { PluginStateStore, PluginStateData } from "./pluginStateStore";

// Service Registry
export { createServiceRegistry } from "./serviceRegistry";
export type { ServiceRegistry, ExtendedPluginServices } from "./serviceRegistry";

// Permission Guard
export {
    createPermissionGuard,
    PermissionDeniedError,
    warnSensitivePermission,
    validatePermissionConsistency,
    PERMISSION_DESCRIPTIONS,
} from "./permissionGuard";
export type { PermissionGuard } from "./permissionGuard";

// Plugin Settings
export { createPluginSettingsStore } from "./pluginSettings";
export type { PluginSettingsStore, ValidationResult, ValidationError } from "./pluginSettings";

// Sandbox (error isolation and security)
export {
    runInSandbox,
    wrapInSandbox,
    safeSandbox,
    SandboxTimeoutError,
    SandboxSecurityError,
    validatePluginPath,
    validatePluginUrl,
    checkRateLimit,
    createRateLimiter,
    clearPluginRateLimits,
} from "./sandbox";
export type { SandboxOptions, SandboxResult } from "./sandbox";

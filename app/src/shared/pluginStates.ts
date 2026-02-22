/**
 * Plugin State Machine Definitions
 *
 * Defines all possible plugin states and valid transitions.
 */

// ============================================================================
// Plugin States
// ============================================================================

export type PluginState =
    | "discovered"    // Manifest found and validated
    | "loading"       // Importing main.js, creating context
    | "loaded"        // Module imported, context created
    | "initializing"  // Running init() lifecycle hook
    | "starting"      // Running start() lifecycle hook
    | "running"       // Plugin is active
    | "paused"        // Temporarily suspended (resource management)
    | "stopping"      // Running stop() lifecycle hook
    | "stopped"       // Plugin stopped but still loaded
    | "unloading"     // Cleaning up resources
    | "unloaded"      // Fully removed from memory
    | "error";        // Error occurred during lifecycle

// ============================================================================
// State Transitions
// ============================================================================

export interface PluginStateTransition {
    from: PluginState[];
    to: PluginState;
    action: string;
}

/**
 * Valid state transitions for plugins.
 * Each transition defines which states can transition to the target state.
 */
export const VALID_TRANSITIONS: PluginStateTransition[] = [
    // Discovery -> Loading
    { from: ["discovered"], to: "loading", action: "load" },

    // Loading outcomes
    { from: ["loading"], to: "loaded", action: "loadComplete" },
    { from: ["loading"], to: "error", action: "loadFailed" },

    // Loaded -> Initializing
    { from: ["loaded"], to: "initializing", action: "init" },

    // Initializing outcomes
    { from: ["initializing"], to: "starting", action: "initComplete" },
    { from: ["initializing"], to: "error", action: "initFailed" },

    // Starting outcomes
    { from: ["starting"], to: "running", action: "start" },
    { from: ["starting"], to: "error", action: "startFailed" },

    // Running <-> Paused
    { from: ["running"], to: "paused", action: "pause" },
    { from: ["paused"], to: "running", action: "resume" },

    // Running/Paused -> Stopping
    { from: ["running", "paused"], to: "stopping", action: "stop" },

    // Stopping outcome
    { from: ["stopping"], to: "stopped", action: "stopComplete" },

    // Stopped/Error -> Unloading
    { from: ["stopped", "error"], to: "unloading", action: "unload" },

    // Unloading outcome
    { from: ["unloading"], to: "unloaded", action: "unloadComplete" },

    // Error recovery
    { from: ["error"], to: "loading", action: "retry" },

    // Direct unload from error
    { from: ["error"], to: "unloaded", action: "forceUnload" },
];

// ============================================================================
// Transition Validation
// ============================================================================

/**
 * Checks if a state transition is valid.
 */
export function isValidTransition(from: PluginState, to: PluginState): boolean {
    return VALID_TRANSITIONS.some(
        (t) => t.from.includes(from) && t.to === to
    );
}

/**
 * Gets the action name for a transition.
 */
export function getTransitionAction(from: PluginState, to: PluginState): string | null {
    const transition = VALID_TRANSITIONS.find(
        (t) => t.from.includes(from) && t.to === to
    );
    return transition?.action ?? null;
}

/**
 * Gets all possible next states from a given state.
 */
export function getNextStates(from: PluginState): PluginState[] {
    return VALID_TRANSITIONS
        .filter((t) => t.from.includes(from))
        .map((t) => t.to);
}

// ============================================================================
// State Categories
// ============================================================================

/**
 * States where the plugin is considered active (using resources).
 */
export const ACTIVE_STATES: PluginState[] = [
    "loading",
    "loaded",
    "initializing",
    "starting",
    "running",
    "paused",
    "stopping",
];

/**
 * States where the plugin is considered inactive.
 */
export const INACTIVE_STATES: PluginState[] = [
    "discovered",
    "stopped",
    "unloading",
    "unloaded",
    "error",
];

/**
 * States where the plugin can be started.
 */
export const STARTABLE_STATES: PluginState[] = [
    "discovered",
    "loaded",
    "stopped",
];

/**
 * States where the plugin can be stopped.
 */
export const STOPPABLE_STATES: PluginState[] = [
    "running",
    "paused",
];

/**
 * Checks if a plugin is in an active state.
 */
export function isActive(state: PluginState): boolean {
    return ACTIVE_STATES.includes(state);
}

/**
 * Checks if a plugin can be started from current state.
 */
export function canStart(state: PluginState): boolean {
    return STARTABLE_STATES.includes(state);
}

/**
 * Checks if a plugin can be stopped from current state.
 */
export function canStop(state: PluginState): boolean {
    return STOPPABLE_STATES.includes(state);
}

// ============================================================================
// State Display
// ============================================================================

/**
 * Human-readable state labels for UI display.
 */
export const STATE_LABELS: Record<PluginState, string> = {
    discovered: "Discovered",
    loading: "Loading...",
    loaded: "Loaded",
    initializing: "Initializing...",
    starting: "Starting...",
    running: "Running",
    paused: "Paused",
    stopping: "Stopping...",
    stopped: "Stopped",
    unloading: "Unloading...",
    unloaded: "Unloaded",
    error: "Error",
};

/**
 * State colors for UI display (CSS color values).
 */
export const STATE_COLORS: Record<PluginState, string> = {
    discovered: "#888888",  // Gray
    loading: "#f0ad4e",     // Yellow/orange
    loaded: "#5bc0de",      // Light blue
    initializing: "#f0ad4e", // Yellow/orange
    starting: "#f0ad4e",     // Yellow/orange
    running: "#5cb85c",      // Green
    paused: "#f0ad4e",       // Yellow/orange
    stopping: "#f0ad4e",     // Yellow/orange
    stopped: "#888888",      // Gray
    unloading: "#888888",    // Gray
    unloaded: "#888888",     // Gray
    error: "#d9534f",        // Red
};

// ============================================================================
// State Info
// ============================================================================

export interface PluginStateInfo {
    id: string;
    name: string;
    version: string;
    state: PluginState;
    enabled: boolean;
    error?: string;
    errorTime?: string;
}

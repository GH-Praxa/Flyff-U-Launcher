/**
 * Shared module barrel exports.
 * Re-exports utilities, schemas, constants, and types for cleaner imports.
 */

// Utilities
export { generateId, suppressError, safeCallback } from "./utils";

// Logger
export { logWarn, logErr, logDebug } from "./logger";

// Constants
export { TIMINGS, LAYOUT, VALIDATION } from "./constants";

// Schemas and types
export {
    ProfileSchema,
    ThemeColorsSchema,
    TabLayoutSchema,
    RoiRectSchema,
    SplitPairSchema,
    safeParse,
    parse,
    validate,
    type Profile,
    type ThemeColors,
    type TabLayout,
    type RoiRect,
    type SplitPair,
    type ValidationResult,
} from "./schemas";

// IPC Channels
export { IPC_CHANNELS } from "./ipcChannels";

// File Store (factory)
export { createFileStore } from "./fileStore";

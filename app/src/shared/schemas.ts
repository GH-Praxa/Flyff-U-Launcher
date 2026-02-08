/**
 * Zod schemas for runtime validation of data structures.
 * Provides type-safe parsing and validation for IPC data, file storage, etc.
 */
import { z } from "zod";
import { LIMITS, LAYOUT } from "./constants";

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * Valid ID format: alphanumeric, hyphens, underscores, max 64 chars.
 */
export const IdSchema = z.string()
    .min(1, "ID cannot be empty")
    .max(LIMITS.MAX_ID_LENGTH, `ID cannot exceed ${LIMITS.MAX_ID_LENGTH} characters`)
    .regex(/^[a-zA-Z0-9_-]+$/, "ID can only contain alphanumeric characters, hyphens, and underscores");

/**
 * Valid name format: non-empty string, max 256 chars.
 */
export const NameSchema = z.string()
    .min(1, "Name cannot be empty")
    .max(LIMITS.MAX_NAME_LENGTH, `Name cannot exceed ${LIMITS.MAX_NAME_LENGTH} characters`);

/**
 * ISO date string format.
 */
export const DateStringSchema = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/));

/**
 * Bounds/Rectangle schema for window positioning.
 */
export const BoundsSchema = z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().nonnegative(),
    height: z.number().finite().nonnegative(),
});
export type Bounds = z.infer<typeof BoundsSchema>;

/**
 * Split ratio between 0 and 1.
 */
export const RatioSchema = z.number().min(0).max(1);

// ============================================================================
// Profile Schemas
// ============================================================================

export const LaunchModeSchema = z.enum(["tabs", "window"]);
export type LaunchMode = z.infer<typeof LaunchModeSchema>;

export const OverlaySettingsSchema = z.object({
    showExp: z.boolean().optional(),
    showDeltaExp: z.boolean().optional(),
    showTotalExp: z.boolean().optional(),
    showKillsSession: z.boolean().optional(),
    showKillsLifetime: z.boolean().optional(),
    showKillsPerMinute: z.boolean().optional(),
    showKillsPerHour: z.boolean().optional(),
    showSessionTime: z.boolean().optional(),
    showLastKill: z.boolean().optional(),
    showAvgExpPerKill: z.boolean().optional(),
    showExpPerMinute: z.boolean().optional(),
    showResetButton: z.boolean().optional(),
});
export type OverlaySettings = z.infer<typeof OverlaySettingsSchema>;

export const OverlayHudLayoutSchema = z.object({
    offsetX: z.number().finite(),
    offsetY: z.number().finite(),
    width: z.number().finite().min(260),
    height: z.number().finite().min(180),
});
export type OverlayHudLayout = z.infer<typeof OverlayHudLayoutSchema>;

export const ProfileQuestlogSettingsSchema = z.object({
    enabled: z.boolean().optional(),
});
export type ProfileQuestlogSettings = z.infer<typeof ProfileQuestlogSettingsSchema>;

export const ProfileFeaturesSchema = z.object({
    questlog: ProfileQuestlogSettingsSchema.optional(),
});
export type ProfileFeatures = z.infer<typeof ProfileFeaturesSchema>;

export const ProfileSchema = z.object({
    id: IdSchema,
    name: NameSchema,
    createdAt: z.string(),
    job: z.string().optional(),
    launchMode: LaunchModeSchema,
    overlayTarget: z.boolean().optional(),
    overlaySupportTarget: z.boolean().optional(),
    overlayIconKey: z.string().optional(),
    overlaySupportIconKey: z.string().optional(),
    overlaySettings: OverlaySettingsSchema.optional(),
    overlayHud: OverlayHudLayoutSchema.optional(),
    features: ProfileFeaturesSchema.optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ProfilePatchSchema = ProfileSchema.partial().extend({
    id: IdSchema,
});
export type ProfilePatch = z.infer<typeof ProfilePatchSchema>;

export const SUPPORTED_LOCALES = ["en", "de", "pl", "fr", "ru", "tr", "cn", "jp"] as const;
export const LocaleSchema = z.enum(SUPPORTED_LOCALES);
export type Locale = z.infer<typeof LocaleSchema>;
export const DEFAULT_LOCALE: Locale = "en";

export const HotkeyChordSchema = z.array(z.string().min(1)).min(2).max(3);
export type HotkeyChord = z.infer<typeof HotkeyChordSchema>;
export const HotkeysSchema = z.object({
    toggleOverlays: HotkeyChordSchema.nullable().optional(),
    sidePanelToggle: HotkeyChordSchema.nullable().optional(),
    tabBarToggle: HotkeyChordSchema.nullable().optional(),
    tabPrev: HotkeyChordSchema.nullable().optional(),
    tabNext: HotkeyChordSchema.nullable().optional(),
    nextInstance: HotkeyChordSchema.nullable().optional(),
    cdTimerExpireAll: HotkeyChordSchema.nullable().optional(),
    screenshotWindow: HotkeyChordSchema.nullable().optional(),
    showFcoinConverter: HotkeyChordSchema.nullable().optional(),
    showShoppingList: HotkeyChordSchema.nullable().optional(),
});
export type Hotkeys = z.infer<typeof HotkeysSchema>;

export const ClientSettingsSchema = z.object({
    startFullscreen: z.boolean(),
    layoutDelaySeconds: z.number().min(0).max(30),
    toastDurationSeconds: z.number().min(1).max(60),
    overlayButtonPassthrough: z.boolean(),
    launcherWidth: z.number().min(LAYOUT.LAUNCHER_MIN_WIDTH).max(LAYOUT.LAUNCHER_MAX_WIDTH),
    launcherHeight: z.number().min(LAYOUT.LAUNCHER_MIN_HEIGHT).max(LAYOUT.LAUNCHER_MAX_HEIGHT),
    locale: LocaleSchema,
    hotkeys: HotkeysSchema.optional(),
    /** Ob Profile innerhalb eines Grid-/Split-Layout-Tabs nacheinander mit Delay geladen werden sollen. */
    seqGridLoad: z.boolean(),
    /** Aktiven BrowserView in Grid-/Split-Layouts mit grünem Rand hervorheben. */
    gridActiveBorder: z.boolean(),
    /** Legt fest, ob Layouts bei Änderungen automatisch gespeichert werden sollen. */
    autoSaveLayouts: z.boolean(),
    /** Speichert die Positionen verschobener In-Game-UI-Elemente persistent per localStorage. */
    persistGameUiPositions: z.boolean(),
    tabLayoutDisplay: z.enum(["compact", "grouped", "separated", "mini-grid"]),
    fcoinRate: z.number().positive(),
});
export type ClientSettings = z.infer<typeof ClientSettingsSchema>;
export const ClientSettingsPatchSchema = ClientSettingsSchema.partial();
export type ClientSettingsPatch = z.infer<typeof ClientSettingsPatchSchema>;

// ============================================================================
// Tab Layout Schemas
// ============================================================================

// Layout-Typen f\u00fcr Multi-View Tabs
export const LayoutTypeSchema = z.enum([
    "single",   // 1x1 - 1 View (Einzelfenster)
    "split-2",  // 1x2 - 2 Views nebeneinander
    "row-3",    // 1x3 - 3 Views nebeneinander
    "row-4",    // 1x4 - 4 Views nebeneinander
    "grid-4",   // 2x2 - 4 Views
    "grid-5",   // 3+2 - 5 Views (3 oben, 2 unten)
    "grid-6",   // 2x3 - 6 Views
    "grid-7",   // 4+3 - 7 Views (4 oben, 3 unten)
    "grid-8",   // 2x4 - 8 Views
]);
export type LayoutType = z.infer<typeof LayoutTypeSchema>;

export const GridCellSchema = z.object({
    id: IdSchema,                              // Profile-ID
    position: z.number().int().min(0).max(7),  // Position 0-7
});
export type GridCell = z.infer<typeof GridCellSchema>;

export const MultiViewLayoutSchema = z.object({
    type: LayoutTypeSchema,
    cells: z.array(GridCellSchema).min(1).max(8),
    ratio: RatioSchema.optional(),                 // F\u00fcr split-2 Kompatibilit\u00e4t
    activePosition: z.number().int().min(0).max(7).optional(),
});
export type MultiViewLayout = z.infer<typeof MultiViewLayoutSchema>;

// Union f\u00fcr Abw\u00e4rtskompatibilit\u00e4t: Legacy Split oder neues Multi-Layout
export const TabLayoutSplitSchema = z.union([
    z.object({
        leftId: IdSchema,
        rightId: IdSchema,
        ratio: RatioSchema.optional(),
    }),
    MultiViewLayoutSchema,
]);
export type TabLayoutSplit = z.infer<typeof TabLayoutSplitSchema>;

// Schema for a saved layout tab (includes name and layout configuration)
export const SavedLayoutTabSchema = z.object({
    name: NameSchema.optional(),
    layout: MultiViewLayoutSchema,
});
export type SavedLayoutTab = z.infer<typeof SavedLayoutTabSchema>;

export const TabLayoutSchema = z.object({
    id: IdSchema,
    name: NameSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    tabs: z.array(IdSchema).min(1, "Layout must have at least one tab"),
    split: TabLayoutSplitSchema.nullable().optional(),
    layouts: z.array(SavedLayoutTabSchema).optional(),
    activeId: IdSchema.nullable().optional(),
    loggedOutChars: z.array(IdSchema).optional(),
});
export type TabLayout = z.infer<typeof TabLayoutSchema>;

export const TabLayoutInputSchema = z.object({
    id: IdSchema.optional(),
    name: NameSchema,
    tabs: z.array(IdSchema).min(1),
    split: TabLayoutSplitSchema.nullable().optional(),
    layouts: z.array(SavedLayoutTabSchema).optional(),
    activeId: IdSchema.nullable().optional(),
    loggedOutChars: z.array(IdSchema).optional(),
});
export type TabLayoutInput = z.infer<typeof TabLayoutInputSchema>;

// ============================================================================
// Theme Schemas
// ============================================================================

export const ThemeColorsSchema = z.object({
    bg: z.string(),
    panel: z.string(),
    panel2: z.string(),
    stroke: z.string(),
    text: z.string(),
    muted: z.string(),
    blue: z.string(),
    blue2: z.string(),
    danger: z.string(),
    green: z.string(),
    accent: z.string(),
    tabActive: z.string(),
});
export type ThemeColors = z.infer<typeof ThemeColorsSchema>;

export const StoredThemeSchema = z.object({
    id: IdSchema,
    name: NameSchema,
    colors: ThemeColorsSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
});
export type StoredTheme = z.infer<typeof StoredThemeSchema>;

export const ThemeInputSchema = z.object({
    id: IdSchema.optional(),
    name: NameSchema.optional(),
    colors: ThemeColorsSchema.partial().optional(),
});
export type ThemeInput = z.infer<typeof ThemeInputSchema>;

// ============================================================================
// ROI Schemas
// ============================================================================

export const RoiRectSchema = z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
});
export type RoiRect = z.infer<typeof RoiRectSchema>;

export const RoiKeySchema = z.enum(["lvl", "charname", "exp", "lauftext", "rmExp", "enemyName", "enemyHp"]);
export type RoiKey = z.infer<typeof RoiKeySchema>;

export const RoiDataSchema = z.object({
    lvl: RoiRectSchema.optional(),
    charname: RoiRectSchema.optional(),
    exp: RoiRectSchema.optional(),
    lauftext: RoiRectSchema.optional(),
    rmExp: RoiRectSchema.optional(),
    enemyName: RoiRectSchema.optional(),
    enemyHp: RoiRectSchema.optional(),
    // Legacy optional keys for migration safety
    nameLevel: RoiRectSchema.optional(),
    expPercent: RoiRectSchema.optional(),
}).refine(
    data => !!(data.lvl || data.charname || data.exp || data.lauftext || data.rmExp || data.enemyName || data.enemyHp || data.nameLevel || data.expPercent),
    { message: "At least one ROI must be provided" }
);
export type RoiData = z.infer<typeof RoiDataSchema>;

// ============================================================================
// Session Tab Schemas
// ============================================================================

export const SplitPairSchema = z.object({
    primary: IdSchema,
    secondary: IdSchema,
    ratio: RatioSchema.optional(),
});
export type SplitPair = z.infer<typeof SplitPairSchema>;

// ============================================================================
// Multi-Window Schemas
// ============================================================================

/**
 * Schema for a tab-capable session window.
 */
export const TabWindowSchema = z.object({
    id: IdSchema,
    name: NameSchema.optional(),
    createdAt: DateStringSchema,
});
export type TabWindow = z.infer<typeof TabWindowSchema>;

/**
 * Schema for tab window metadata (returned by list operations).
 */
export const TabWindowMetadataSchema = TabWindowSchema.extend({
    tabCount: z.number().int().min(0),
    isOpen: z.boolean(),
    /** Current native window title, e.g. \"Test 2 - 1x2 - 1x3 - 1 - 1\" */
    title: z.string().optional(),
});
export type TabWindowMetadata = z.infer<typeof TabWindowMetadataSchema>;

// ----------------------------------------------------------------------------
// Layout Migration Helpers
// ----------------------------------------------------------------------------

export function isLegacySplit(split: unknown): split is { leftId: string; rightId: string; ratio?: number } {
    return !!split && typeof split === "object" && "leftId" in split && !("type" in split);
}

export function migrateToMultiView(legacy: { leftId: string; rightId: string; ratio?: number }): MultiViewLayout {
    return {
        type: "split-2",
        cells: [
            { id: legacy.leftId, position: 0 },
            { id: legacy.rightId, position: 1 },
        ],
        ratio: legacy.ratio,
        activePosition: 0,
    };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Safely parses data with a schema, returning null on failure.
 */
export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown): T | null {
    const result = schema.safeParse(data);
    return result.success ? result.data : null;
}

/**
 * Parses data with a schema, throwing a descriptive error on failure.
 */
export function parse<T>(schema: z.ZodSchema<T>, data: unknown): T {
    return schema.parse(data);
}

/**
 * Validates data against a schema, returning validation errors if any.
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return {
        success: false,
        errors: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`),
    };
}

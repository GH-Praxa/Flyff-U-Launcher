import { DEFAULT_LOCALE, type Locale } from "../i18n/translations";
import type { ClientSettings } from "../shared/schemas";
import { DEFAULT_HOTKEYS, normalizeHotkeySettings } from "../shared/hotkeys";
import { LAYOUT as LAYOUT_CONST } from "../shared/constants";
import { clampLauncherHeight, clampLauncherWidth, normalizeLauncherSize } from "../shared/launcherSize";
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from "../shared/featureFlags";
import { logErr } from "../shared/logger";
import { applyLocale, currentLocale } from "./i18n";

// ── Feature Flags ────────────────────────────────────────────────────

export let featureFlags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };

export async function loadFeatureFlags() {

    if (!window.api?.featuresGet)

        return;

    try {

        featureFlags = await window.api.featuresGet();

    }

    catch (err) {

        logErr(err, "renderer");

        featureFlags = { ...DEFAULT_FEATURE_FLAGS };

    }

}

// ── Default Client Settings ──────────────────────────────────────────

export const DEFAULT_CLIENT_SETTINGS: ClientSettings = {

    startFullscreen: false,

    layoutDelaySeconds: 2,

    toastDurationSeconds: 5,

    overlayButtonPassthrough: false,

    locale: DEFAULT_LOCALE,

    hotkeys: DEFAULT_HOTKEYS,

    launcherWidth: LAYOUT_CONST.LAUNCHER_WIDTH,

    launcherHeight: LAYOUT_CONST.LAUNCHER_HEIGHT,

    seqGridLoad: false,

    gridActiveBorder: false,

    autoSaveLayouts: true,

    persistGameUiPositions: false,

    tabLayoutDisplay: "compact",

    fcoinRate: 200_000_000,

};

// ── Clamping Helpers ─────────────────────────────────────────────────

export const clampLayoutDelaySeconds = (input: unknown) => {

    const n = Number(input);

    if (!Number.isFinite(n))

        return DEFAULT_CLIENT_SETTINGS.layoutDelaySeconds;

    return Math.round(Math.min(30, Math.max(0, n)));

};

export const clampToastDurationSeconds = (input: unknown) => {

    const n = Number(input);

    if (!Number.isFinite(n))

        return DEFAULT_CLIENT_SETTINGS.toastDurationSeconds;

    return Math.round(Math.min(60, Math.max(1, n)));

};

export const clampLauncherWidthPx = (input: unknown) => clampLauncherWidth(input, DEFAULT_CLIENT_SETTINGS.launcherWidth);

export const clampLauncherHeightPx = (input: unknown) => clampLauncherHeight(input, DEFAULT_CLIENT_SETTINGS.launcherHeight);

// ── Layout Delay ─────────────────────────────────────────────────────

export let layoutDelayBaseMs = clampLayoutDelaySeconds(DEFAULT_CLIENT_SETTINGS.layoutDelaySeconds) * 1000;

export function setLayoutDelaySeconds(value: number) {

    layoutDelayBaseMs = clampLayoutDelaySeconds(value) * 1000;

}

export function getLayoutDelayMs() {

    const base = Math.max(0, layoutDelayBaseMs);

    if (base <= 0)

        return 0;

    return base + Math.random() * 50;

}

// ── Toast Duration ───────────────────────────────────────────────────

export let toastBaseTtlMs = DEFAULT_CLIENT_SETTINGS.toastDurationSeconds * 1000;

export function setToastDurationSeconds(value: number) {

    toastBaseTtlMs = clampToastDurationSeconds(value) * 1000;

}

// ── Layout Tab Display ───────────────────────────────────────────────

const TAB_LAYOUT_DISPLAY_VALUES: ClientSettings["tabLayoutDisplay"][] = ["compact", "grouped", "separated", "mini-grid"];

export const normalizeTabLayoutDisplay = (value: unknown): ClientSettings["tabLayoutDisplay"] =>

    TAB_LAYOUT_DISPLAY_VALUES.includes(value as ClientSettings["tabLayoutDisplay"])

        ? (value as ClientSettings["tabLayoutDisplay"])

        : DEFAULT_CLIENT_SETTINGS.tabLayoutDisplay;

export let layoutTabDisplay: ClientSettings["tabLayoutDisplay"] = DEFAULT_CLIENT_SETTINGS.tabLayoutDisplay;

export const layoutTabDisplayListeners = new Set<() => void>();

export function setLayoutTabDisplay(value: ClientSettings["tabLayoutDisplay"]) {

    layoutTabDisplay = normalizeTabLayoutDisplay(value);

    for (const fn of layoutTabDisplayListeners) {

        try {

            fn();

        }

        catch (err) {

            console.error("[layoutTabDisplay] listener failed", err);

        }

    }

}

export function onLayoutTabDisplayChange(fn: () => void): () => void {

    layoutTabDisplayListeners.add(fn);

    return () => layoutTabDisplayListeners.delete(fn);

}

// ── Session Views Visibility ─────────────────────────────────────────

export let sessionViewsHideDepth = 0;

export async function hideSessionViews(): Promise<void> {

    sessionViewsHideDepth += 1;

    if (!window.api?.sessionTabsSetVisible)

        return;

    try {

        await window.api.sessionTabsSetVisible(false);

    }

    catch (err) {

        logErr(err, "renderer");

    }

    try {

        await window.api.overlaysHideForDialog?.();

    }

    catch (err) {

        logErr(err, "renderer");

    }

}

export async function showSessionViews(force = false): Promise<void> {

    if (sessionViewsHideDepth > 0 && !force) {

        sessionViewsHideDepth -= 1;

    }

    else if (force) {

        sessionViewsHideDepth = 0;

    }

    if (sessionViewsHideDepth > 0)

        return;

    if (!window.api?.sessionTabsSetVisible)

        return;

    try {

        await window.api.sessionTabsSetVisible(true);

    }

    catch (err) {

        logErr(err, "renderer");

    }

    try {

        await window.api.overlaysShowAfterDialog?.();

    }

    catch (err) {

        logErr(err, "renderer");

    }

}

// ── Sequential Grid / Auto-Save ──────────────────────────────────────

export let sequentialGridLoad = DEFAULT_CLIENT_SETTINGS.seqGridLoad;

export let autoSaveLayouts = DEFAULT_CLIENT_SETTINGS.autoSaveLayouts;

export let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

export function setAutoSaveTimeout(v: ReturnType<typeof setTimeout> | null) { autoSaveTimeout = v; }

export function setSequentialGridLoad(value: boolean) {

    sequentialGridLoad = !!value;

}

export function setAutoSaveLayouts(value: boolean) {

    autoSaveLayouts = !!value;

    if (!autoSaveLayouts && autoSaveTimeout) {

        clearTimeout(autoSaveTimeout);

        autoSaveTimeout = null;

    }

}

// ── Load / Patch Client Settings ─────────────────────────────────────

export async function loadClientSettings(): Promise<ClientSettings> {

    if (!window.api?.clientSettingsGet) {

        return { ...DEFAULT_CLIENT_SETTINGS };

    }

    try {

        const settings = await window.api.clientSettingsGet();

        const size = normalizeLauncherSize({

            width: settings.launcherWidth,

            height: settings.launcherHeight,

        });

        const normalized = {

            startFullscreen: !!settings.startFullscreen,

            layoutDelaySeconds: clampLayoutDelaySeconds(settings.layoutDelaySeconds),

            toastDurationSeconds: clampToastDurationSeconds(settings.toastDurationSeconds),

            overlayButtonPassthrough: !!settings.overlayButtonPassthrough,

            locale: settings.locale ?? DEFAULT_LOCALE,

            hotkeys: normalizeHotkeySettings(settings.hotkeys, DEFAULT_HOTKEYS),

            launcherWidth: clampLauncherWidthPx(size.width),

            launcherHeight: clampLauncherHeightPx(size.height),

            seqGridLoad: !!settings.seqGridLoad,

            gridActiveBorder: !!settings.gridActiveBorder,

            autoSaveLayouts: settings.autoSaveLayouts ?? DEFAULT_CLIENT_SETTINGS.autoSaveLayouts,

            persistGameUiPositions: !!settings.persistGameUiPositions,

            tabLayoutDisplay: normalizeTabLayoutDisplay(settings.tabLayoutDisplay),

            fcoinRate: typeof settings.fcoinRate === "number" && settings.fcoinRate > 0 ? settings.fcoinRate : DEFAULT_CLIENT_SETTINGS.fcoinRate,

        };

        setLayoutDelaySeconds(normalized.layoutDelaySeconds);

        setToastDurationSeconds(normalized.toastDurationSeconds);

        setSequentialGridLoad(normalized.seqGridLoad);

        setAutoSaveLayouts(normalized.autoSaveLayouts);

        setLayoutTabDisplay(normalized.tabLayoutDisplay);

        applyLocale(normalized.locale);

        return normalized;

    }

    catch (err) {

        logErr(err, "renderer");

        return { ...DEFAULT_CLIENT_SETTINGS };

    }

}

// Sync locale for this renderer in case another window (e.g., the launcher)

// changed the language after this window was created.

export async function syncLocaleFromSettings(): Promise<void> {

    if (!window.api?.clientSettingsGet)

        return;

    try {

        const settings = await window.api.clientSettingsGet();

        const nextLocale = settings?.locale ?? DEFAULT_LOCALE;

        if (nextLocale !== currentLocale) {

            applyLocale(nextLocale);

        }

    }

    catch (err) {

        logErr(err, "renderer");

    }

}

export async function patchClientSettings(patch: Partial<ClientSettings>): Promise<ClientSettings | null> {

    if (!window.api?.clientSettingsPatch)

        return null;

    return await window.api.clientSettingsPatch(patch);

}

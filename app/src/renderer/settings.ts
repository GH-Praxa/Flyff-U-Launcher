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

        featureFlags = await window.api.featuresGet() as FeatureFlags;

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

    gameFont: null,

    sendTelemetry: false,

    showAnnouncements: true,

    collapsibleOpenProfiles: true,

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

// ── Launcher UI Font ──────────────────────────────────────────────────
//
// Applies a font-family override to the launcher window itself by injecting
// a <style> element. For bundled fonts (Josefin Sans, Roboto, …) the Google
// Fonts stylesheet is loaded so the font is available in the launcher renderer
// even before the config modal has been opened.

const LAUNCHER_BUNDLED_FONTS = [
    "Josefin Sans","Roboto","Open Sans","Lato",
    "Montserrat","Raleway","Nunito","Ubuntu","Cinzel",
];
const LAUNCHER_FONTS_URL =
    "https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@400;700" +
    "&family=Roboto:wght@400;700&family=Open+Sans:wght@400;700" +
    "&family=Lato:wght@400;700&family=Montserrat:wght@400;700" +
    "&family=Raleway:wght@400;700&family=Nunito:wght@400;700" +
    "&family=Ubuntu:wght@400;700&family=Cinzel:wght@400;700&display=swap";

export function applyLauncherFontSize(size: number | null): void {
    const existing = document.getElementById("__lch_launcher_font_size__");
    if (existing) existing.remove();
    if (!size || size === 100) return;
    const style = document.createElement("style");
    style.id = "__lch_launcher_font_size__";
    style.textContent = `html { font-size: ${size}% !important; }`;
    if (window.__cspNonce) style.setAttribute("nonce", window.__cspNonce);
    document.head.appendChild(style);
}

export function applyLauncherFont(font: string | null): void {
    const existing = document.getElementById("__lch_launcher_font__");
    if (existing) existing.remove();
    if (!font) return;
    // Ensure Google Fonts is present for bundled fonts.
    if (LAUNCHER_BUNDLED_FONTS.includes(font) &&
        !document.querySelector(`link[href="${LAUNCHER_FONTS_URL}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = LAUNCHER_FONTS_URL;
        document.head.appendChild(link);
    }
    const style = document.createElement("style");
    style.id = "__lch_launcher_font__";
    style.textContent = `*, *::before, *::after { font-family: ${JSON.stringify(font)}, sans-serif !important; }`;
    if (window.__cspNonce) style.setAttribute("nonce", window.__cspNonce);
    document.head.appendChild(style);
}

// ── Load / Patch Client Settings ─────────────────────────────────────

export async function loadClientSettings(): Promise<ClientSettings> {

    if (!window.api?.clientSettingsGet) {

        return { ...DEFAULT_CLIENT_SETTINGS };

    }

    try {

        const settings = await window.api.clientSettingsGet() as ClientSettings;

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

            gameFont: typeof settings.gameFont === "string" ? settings.gameFont : null,

            launcherFontSize: typeof settings.launcherFontSize === "number" ? settings.launcherFontSize : null,

            sendTelemetry: typeof settings.sendTelemetry === "boolean" ? settings.sendTelemetry : false,

            showAnnouncements: typeof settings.showAnnouncements === "boolean" ? settings.showAnnouncements : true,

            collapsibleOpenProfiles: typeof settings.collapsibleOpenProfiles === "boolean" ? settings.collapsibleOpenProfiles : true,

        };

        setLayoutDelaySeconds(normalized.layoutDelaySeconds);

        setToastDurationSeconds(normalized.toastDurationSeconds);

        setSequentialGridLoad(normalized.seqGridLoad);

        setAutoSaveLayouts(normalized.autoSaveLayouts);

        setLayoutTabDisplay(normalized.tabLayoutDisplay);

        applyLocale(normalized.locale);

        applyLauncherFont(normalized.gameFont);

        applyLauncherFontSize(normalized.launcherFontSize ?? null);

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

        const settings = await window.api.clientSettingsGet() as ClientSettings;

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

    return await window.api.clientSettingsPatch(patch) as ClientSettings | null;

}

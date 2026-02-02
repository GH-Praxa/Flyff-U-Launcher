import { THEMES, type ThemeDefinition } from "../themes";
import { resetThemeEffect, setThemeEffect } from "../themeAnimations";
import { logErr } from "../shared/logger";
import pkg from "../../package.json";
import { STORAGE_THEME_KEY, STORAGE_TAB_ACTIVE_KEY, GITHUB_PACKAGE_URL } from "./constants";

// ── Types ────────────────────────────────────────────────────────────

type ThemeKey = string;

export type ThemeColors = {

    bg: string;

    panel: string;

    panel2: string;

    stroke: string;

    text: string;

    muted: string;

    blue: string;

    blue2: string;

    danger: string;

    green: string;

    accent: string;

    tabActive: string;

};

type SetTabActiveColorOptions = {

    manual?: boolean;

    persist?: boolean;

};

export type ThemeUpdatePayload = {

    id: string;

    name?: string;

    colors?: ThemeColors;

};

// ── Constants ────────────────────────────────────────────────────────

const THEME_MIGRATION_KEY = "launcherThemeMigratedV2";

export const FALLBACK_THEME_COLORS: ThemeColors = {

    bg: "#0b1220",

    panel: "#0f1a33",

    panel2: "#0d1830",

    stroke: "#1b2b4d",

    text: "#e6eefc",

    muted: "#294093",

    blue: "#2c6bff",

    blue2: "#3b7bff",

    danger: "#ff3b4f",

    green: "#2ecc71",

    accent: "#2c6bff",

    tabActive: "#2ecc71",

};

export const colorKeys: (keyof ThemeColors)[] = ["bg", "panel", "panel2", "stroke", "text", "muted", "blue", "blue2", "danger", "green", "accent", "tabActive"];

// ── State ────────────────────────────────────────────────────────────

export let currentTheme: ThemeKey = loadTheme();

export let updateCheckPromise: Promise<boolean> | null = null;

export let cachedUpdateAvailable: boolean | null = null;

export let lastTabActiveHex: string | null = null;

export let isTabActiveColorManual = false;

export let jsonTabActiveOverride: string | null = null;

const themeColorCache: Partial<Record<ThemeKey, ThemeColors>> = {};

export let lastPushedTheme: ThemeUpdatePayload | null = null;

// Setters for state that needs to be modified from other modules
export function setLastTabActiveHex(v: string | null) { lastTabActiveHex = v; }
export function setIsTabActiveColorManual(v: boolean) { isTabActiveColorManual = v; }
export function setJsonTabActiveOverride(v: string | null) { jsonTabActiveOverride = v; }

// ── Theme Key ────────────────────────────────────────────────────────

export function isThemeKey(value: string | null): value is ThemeKey {

    return THEMES.some((t) => t.id === value);

}

export function loadTheme(): ThemeKey {

    try {

        let stored = localStorage.getItem(STORAGE_THEME_KEY);

        if (stored === "flyff-gold" && !localStorage.getItem(THEME_MIGRATION_KEY)) {

            stored = "zimt";

            localStorage.setItem(THEME_MIGRATION_KEY, "1");

            localStorage.setItem(STORAGE_THEME_KEY, stored);

        }

        if (stored && isThemeKey(stored))

            return stored;

    }

    catch (err) {

        logErr(err, "renderer");

    }

    return "toffee";

}

// ── Tab Active Color ─────────────────────────────────────────────────

export function loadTabActiveOverride(): string | null {

    if (jsonTabActiveOverride) {

        lastTabActiveHex = jsonTabActiveOverride;

        isTabActiveColorManual = true;

        return jsonTabActiveOverride;

    }

    try {

        const fromStorage = localStorage.getItem(STORAGE_TAB_ACTIVE_KEY);

        if (fromStorage) {

            lastTabActiveHex = fromStorage;

            isTabActiveColorManual = true;

            return fromStorage;

        }

    }

    catch (err) {

        logErr(err, "renderer");

    }

    return null;

}

export function getManualTabActiveOverride(): string | null {

    const stored = loadTabActiveOverride();

    if (stored)

        return stored;

    return lastTabActiveHex;

}

export function applyStoredTabActiveColor(override?: string) {

    const stored = override ?? loadTabActiveOverride();

    if (!stored)

        return;

    setTabActiveColor(stored, { manual: true, persist: false });

}

export async function hydrateTabActiveJsonOverride() {

    if (!window.api?.tabActiveColorLoad)

        return;

    try {

        const stored = await window.api.tabActiveColorLoad();

        if (stored) {

            jsonTabActiveOverride = stored;

            lastTabActiveHex = stored;

            isTabActiveColorManual = true;

            try {

                localStorage.setItem(STORAGE_TAB_ACTIVE_KEY, stored);

            }

            catch (err) {

                logErr(err, "renderer");

            }

        }

    }

    catch (err) {

        logErr(err, "renderer");

    }

}

// ── Version / Update ─────────────────────────────────────────────────

export function normalizeVersionParts(input: string): number[] {

    return input.split(".").map((part) => {

        const numeric = Number.parseInt(part.replace(/[^0-9].*$/, ""), 10);

        return Number.isFinite(numeric) ? numeric : 0;

    });

}

export function isRemoteVersionNewer(remote: string, local: string): boolean {

    const remoteParts = normalizeVersionParts(remote);

    const localParts = normalizeVersionParts(local);

    const len = Math.max(remoteParts.length, localParts.length);

    for (let i = 0; i < len; i += 1) {

        const r = remoteParts[i] ?? 0;

        const l = localParts[i] ?? 0;

        if (r > l)

            return true;

        if (r < l)

            return false;

    }

    return false;

}

async function loadRemoteLauncherVersion(): Promise<string | null> {

    try {

        const res = await fetch(GITHUB_PACKAGE_URL, { cache: "no-store" });

        if (!res.ok)

            return null;

        const payload = await res.json() as { version?: string };

        return typeof payload?.version === "string" ? payload.version : null;

    }

    catch (err) {

        console.warn("launcher update check failed", err);

        return null;

    }

}

export async function getUpdateAvailable(): Promise<boolean> {

    if (cachedUpdateAvailable !== null)

        return cachedUpdateAvailable;

    if (!updateCheckPromise) {

        updateCheckPromise = (async () => {

            const remote = await loadRemoteLauncherVersion();

            if (!remote)

                return false;

            return isRemoteVersionNewer(remote, pkg.version);

        })().then((available) => {

            cachedUpdateAvailable = available;

            return available;

        });

    }

    return updateCheckPromise;

}

// ── Color Conversion ─────────────────────────────────────────────────

export function hexToRgb(input: string | null | undefined): string | null {

    if (!input || typeof input !== "string")

        return null;

    const raw = input.trim();

    if (!raw)

        return null;

    if (raw.includes(","))

        return raw;

    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(raw);

    if (!match)

        return null;

    const [, r, g, b] = match;

    return `${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)}`;

}

export function rgbToHex(rgb: string): string {

    if (typeof rgb !== "string")

        return "#2ecc71";

    const parts = rgb.split(",").map((p) => parseInt(p.trim(), 10));

    if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {

        const [r, g, b] = parts;

        const hex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");

        return `#${hex(r)}${hex(g)}${hex(b)}`;

    }

    return rgb.startsWith("#") ? rgb : "#2ecc71";

}

export const normalizeHex = (hex: string) => hex.trim().toLowerCase().replace(/^#/, "");

// ── Tab Active Color Setting ─────────────────────────────────────────

export function persistTabActiveColor(hex: string | null) {

    const normalized = hex ? rgbToHex(hex) : null;

    jsonTabActiveOverride = normalized;

    if (!window.api?.tabActiveColorSave)

        return;

    window.api.tabActiveColorSave(normalized).catch(logErr);

}

export function setTabActiveColor(hex: string | null, options?: SetTabActiveColorOptions) {

    const root = document.documentElement;

    const normalized = hex ? rgbToHex(hex) : null;

    if (options?.manual === true) {

        isTabActiveColorManual = true;

    }

    else if (options?.manual === false) {

        isTabActiveColorManual = false;

    }

    if (normalized) {

        lastTabActiveHex = normalized;

    }

    else {

        lastTabActiveHex = null;

    }

    if (hex) {

        const rgb = hexToRgb(normalized);

        if (rgb) {

            root.style.setProperty("--tab-active-rgb", rgb);

            if (options?.manual) {

                try {

                    localStorage.setItem(STORAGE_TAB_ACTIVE_KEY, normalized ?? hex);

                }

                catch (err) {

                    logErr(err, "renderer");

                }

                if (options?.persist) {

                    persistTabActiveColor(normalized);

                }

            }

        }

        return;

    }

    root.style.removeProperty("--tab-active-rgb");

    if (options?.manual === false) {

        try {

            localStorage.removeItem(STORAGE_TAB_ACTIVE_KEY);

        }

        catch (err) {

            logErr(err, "renderer");

        }

    }

}

// ── Theme Colors ─────────────────────────────────────────────────────

export function getActiveThemeColors(): ThemeColors {

    const style = getComputedStyle(document.documentElement);

    const pick = (key: string, fallback: string) => style.getPropertyValue(`--${key}`)?.trim() || fallback;

    const toHex = (v: string, fb: string) => {

        if (!v)

            return fb;

        if (v.startsWith("#"))

            return v;

        const m = v.match(/\d+/g);

        if (m && m.length >= 3) {

            const [r, g, b] = m.map((n) => Math.max(0, Math.min(255, parseInt(n, 10))));

            const hex = (n: number) => n.toString(16).padStart(2, "0");

            return `#${hex(r)}${hex(g)}${hex(b)}`;

        }

        return fb;

    };

    return {

        bg: toHex(pick("bg", "#0f1014"), "#0f1014"),

        panel: toHex(pick("panel", "#181a21"), "#181a21"),

        panel2: toHex(pick("panel2", "#121318"), "#121318"),

        stroke: toHex(pick("stroke", "#3f4046"), "#3f4046"),

        text: toHex(pick("text", "#fae6bc"), "#fae6bc"),

        muted: toHex(pick("muted", "#d8c489"), "#d8c489"),

        blue: toHex(pick("blue", "#f3c65d"), "#f3c65d"),

        blue2: toHex(pick("blue2", "#ffde8b"), "#ffde8b"),

        danger: toHex(pick("danger", "#ff9b4c"), "#ff9b4c"),

        green: toHex(pick("green", "#9fcf7a"), "#9fcf7a"),

        accent: toHex(pick("accent", "#f7ba48"), "#f7ba48"),

        tabActive: toHex(pick("tab-active-rgb", "#9fcf7a"), "#9fcf7a"),

    };

}

export function getThemeColors(themeId: string): ThemeColors {

    if (isThemeKey(themeId) && themeColorCache[themeId])

        return { ...themeColorCache[themeId]! };

    if (isThemeKey(themeId) && currentTheme === themeId) {

        const colors = getActiveThemeColors();

        const builtin = THEMES.find((t) => t.id === themeId);

        if (builtin?.tabActive) {

            colors.tabActive = builtin.tabActive;

        }

        return colors;

    }

    const builtin = THEMES.find((t) => t.id === themeId);

    if (builtin?.tabActive) {

        return { ...FALLBACK_THEME_COLORS, tabActive: builtin.tabActive };

    }

    return { ...FALLBACK_THEME_COLORS };

}

// ── Theme Application ────────────────────────────────────────────────

export function applyTheme(theme: string) {

    const root = document.documentElement;

    const manualOverride = getManualTabActiveOverride();

    const themeId = isThemeKey(theme) ? theme : "toffee";

    const builtin = THEMES.find((t) => t.id === themeId);

    const effect =

        builtin?.id === "hologrid"

            ? "grid"

            : builtin?.id === "rainfall-drift"

                ? "rain"

                : null;

    let tabActiveBase: string | null = null;

    for (const key of colorKeys) {

        root.style.removeProperty(`--${key}`);

    }

    root.style.removeProperty("--accent-rgb");

    root.style.removeProperty("--danger-rgb");

    root.style.removeProperty("--green-rgb");

    for (const t of THEMES) {

        root.classList.remove(`theme-${t.id}`);

    }

    if (builtin) {

        root.classList.add(`theme-${builtin.id}`);

        root.setAttribute("data-theme", builtin.id);

        tabActiveBase = typeof builtin.tabActive === 'string' ? hexToRgb(builtin.tabActive) : hexToRgb(FALLBACK_THEME_COLORS.tabActive);

    }

    else {

        root.setAttribute("data-theme", themeId);

        tabActiveBase = hexToRgb(FALLBACK_THEME_COLORS.tabActive);

    }

    const override = manualOverride;

    let finalTabRgb: string | null = tabActiveBase;

    if (override) {

        const tabOverride = hexToRgb(override);

        if (tabOverride) {

            finalTabRgb = tabOverride;

        }

    }

    if (finalTabRgb) {

        root.style.setProperty("--tab-active-rgb", finalTabRgb);

    }

    currentTheme = builtin ? builtin.id : "toffee";

    if (builtin) {

        const colors = getActiveThemeColors();

        colors.tabActive = builtin.tabActive ?? FALLBACK_THEME_COLORS.tabActive;

        themeColorCache[builtin.id] = colors;

    }

    if (effect) {

        setThemeEffect(effect);

    }

    else {

        resetThemeEffect();

    }

    try {

        localStorage.setItem(STORAGE_THEME_KEY, currentTheme);

        localStorage.setItem(THEME_MIGRATION_KEY, "1");

    }

    catch (err) {

        logErr(err, "renderer");

    }

}

export function pushThemeUpdate(themeId: string, colors?: ThemeColors) {

    try {

        const tabActiveHex = lastTabActiveHex ?? colors?.tabActive ?? colors?.green ?? null;

        const payload: ThemeUpdatePayload = { id: themeId };

        if (colors) {

            payload.colors = { ...colors, tabActive: tabActiveHex ?? colors.tabActive ?? colors.green };

        }

        else {

            const activeColors = getActiveThemeColors();

            payload.colors = {

                ...activeColors,

                tabActive: tabActiveHex ?? activeColors.tabActive,

            };

        }

        if (lastPushedTheme && payload.colors && lastPushedTheme.colors) {

            const sameId = lastPushedTheme.id === payload.id;

            const prevTab = lastPushedTheme.colors.tabActive?.toLowerCase?.();

            const nextTab = payload.colors.tabActive?.toLowerCase?.();

            if (sameId && prevTab === nextTab)

                return;

        }

        lastPushedTheme = payload;

        if (window.api?.themePush)

            window.api.themePush(payload);

    }

    catch (err) {

        logErr(err, "renderer");

    }

}

export async function hydrateThemeFromSnapshot(): Promise<ThemeUpdatePayload | null> {

    if (!window.api?.themeCurrent)

        return null;

    try {

        const snap = await window.api.themeCurrent();

        if (!snap || typeof snap !== "object")

            return null;

        const storedTab = loadTabActiveOverride();

        if (snap.colors && typeof snap.colors.tabActive === "string") {

            const tabSource = storedTab ?? snap.colors.tabActive;

            lastTabActiveHex = tabSource;

            setTabActiveColor(tabSource, { manual: Boolean(storedTab) });

        }

        if (snap.id && typeof snap.id === "string") {

            currentTheme = isThemeKey(snap.id) ? snap.id : "toffee";

        }

        return snap;

    }

    catch (err) {

        logErr(err, "renderer");

        return null;

    }

}

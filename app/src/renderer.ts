import "./index.css";



import { THEMES, type ThemeDefinition } from "./themes";



import aibattGold from "./assets/icons/aibatt_gold.png";



import supporterIcon from "./assets/icons/supporter.png";



import flyffuniverseIcon from "./assets/icons/flyffuniverse.png";



import flyffipediaIcon from "./assets/icons/flyffipedia.png";



import flyffulatorIcon from "./assets/icons/flyffulator.png";



import reskillIcon from "./assets/icons/reskill.png";

import tabLayoutCompact from "./assets/settings/tab_kompakt.png";
import tabLayoutChips1 from "./assets/settings/chips1.png";
import tabLayoutChips2 from "./assets/settings/chips2.png";
import tabLayoutMiniGrid from "./assets/settings/mini_grid.png";


import acrobatIcon from "./assets/icons/classes/acrobat.png";



import arcanistIcon from "./assets/icons/classes/arcanist.png";



import assistIcon from "./assets/icons/classes/assist.png";



import billposterIcon from "./assets/icons/classes/billposter.png";



import bladeIcon from "./assets/icons/classes/blade.png";



import crackshooterIcon from "./assets/icons/classes/crackshooter.png";



import elementorIcon from "./assets/icons/classes/elementor.png";



import forcemasterIcon from "./assets/icons/classes/forcemaster.png";



import harlequinIcon from "./assets/icons/classes/harlequin.png";



import jesterIcon from "./assets/icons/classes/jester.png";



import knightIcon from "./assets/icons/classes/knight.png";



import magicianIcon from "./assets/icons/classes/magician.png";



import mentalistIcon from "./assets/icons/classes/mentalist.png";



import mercenaryIcon from "./assets/icons/classes/mercenary.png";



import psykeeperIcon from "./assets/icons/classes/psychikeeper.png";



import rangerIcon from "./assets/icons/classes/ranger.png";



import ringmasterIcon from "./assets/icons/classes/ringmaster.png";



import seraphIcon from "./assets/icons/classes/seraph.png";



import slayerIcon from "./assets/icons/classes/slayer.png";



import templarIcon from "./assets/icons/classes/templar.png";



import vagrantIcon from "./assets/icons/classes/vagrant.png";



import pkg from "../package.json";



import { DEFAULT_LOCALE, getTips, translate, type Locale, type TranslationKey } from "./i18n/translations";



import { resetThemeEffect, setThemeEffect } from "./themeAnimations";



import type { TabLayout, ClientSettings } from "./shared/schemas";



import { DEFAULT_HOTKEYS, formatHotkey, normalizeHotkeySettings, sanitizeHotkeyChord } from "./shared/hotkeys";



import { logErr } from "./shared/logger";



import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from "./shared/featureFlags";



import { GRID_CONFIGS, LAYOUT as LAYOUT_CONST } from "./shared/constants";



import { clampLauncherHeight, clampLauncherWidth, normalizeLauncherSize } from "./shared/launcherSize";



const discordIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%237289da'/%3E%3Ccircle cx='11' cy='12' r='3' fill='%23fff'/%3E%3Ccircle cx='21' cy='12' r='3' fill='%23fff'/%3E%3Cpath d='M9 22 Q16 26 23 22' stroke='%23fff' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E";



const githubIcon = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">



    <circle cx="12" cy="12" r="12" fill="#0d1117" />



    <path fill-rule="evenodd" clip-rule="evenodd" d="M12 0.3C5.37 0.3 0 5.67 0 12.3c0 5.29 3.44 9.78 8.21 11.37.6.1.82-.26.82-.58 0-.28-.01-1.05-.02-2.05-3.34.72-4.04-1.61-4.04-1.61-.55-1.37-1.34-1.73-1.34-1.73-1.1-.75.08-.74.08-.74 1.22.09 1.86 1.25 1.86 1.25 1.08 1.85 2.84 1.31 3.53 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.48-1.33-5.48-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.58 11.58 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.5 5.91.43.37.81 1.1.81 2.22 0 1.6-.02 2.89-.02 3.29 0 .32.22.69.83.57A12.03 12.03 0 0 0 24 12.3C24 5.67 18.63 0.3 12 0.3Z" fill="#fff"/>



  </svg>`)}`;



const settingsIcon = "⚙";


const GITHUB_REPO_URL = "https://github.com/GH-Praxa/Flyff-U-Launcher/releases";



const GITHUB_PACKAGE_URL = "https://raw.githubusercontent.com/Sparx94/Flyff-U-Launcher/1.0/app/package.json";



const DONATION_URL = "https://ko-fi.com/praxa";



const FLYFF_URL = "https://universe.flyff.com/play";



const NEWS_BASE_URL = "https://universe.flyff.com";



const STORAGE_THEME_KEY = "launcherTheme";



const STORAGE_TAB_ACTIVE_KEY = "launcherTabActiveColor";



let lastTabActiveHex: string | null = null;



let isTabActiveColorManual = false;



let jsonTabActiveOverride: string | null = null;



type SetTabActiveColorOptions = {



    manual?: boolean;



    persist?: boolean;



};







// Global error diagnostics to catch runtime issues in renderer/settings UI



if (typeof window !== "undefined") {



    window.addEventListener("error", (e) => {



        // eslint-disable-next-line no-console



        console.error("[RendererError]", e.message, e.error?.stack || e.error || "(no stack)");



    });



    window.addEventListener("unhandledrejection", (e) => {



        // eslint-disable-next-line no-console



        console.error("[RendererUnhandledRejection]", e.reason?.stack || e.reason || "(no reason)");



    });



}



function applyStoredTabActiveColor(override?: string) {



    const stored = override ?? loadTabActiveOverride();



    if (!stored)



        return;



    setTabActiveColor(stored, { manual: true, persist: false });



}



async function hydrateTabActiveJsonOverride() {



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



const FLAG_ICONS: Record<string, string> = {



    en: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 36">



      <rect width="60" height="36" fill="#012169"/>



      <path d="M0 0 L60 36 M60 0 L0 36" stroke="#fff" stroke-width="6"/>



      <path d="M0 0 L60 36 M60 0 L0 36" stroke="#c8102e" stroke-width="3"/>



      <rect x="24" width="12" height="36" fill="#fff"/>



      <rect y="12" width="60" height="12" fill="#fff"/>



      <rect x="26" width="8" height="36" fill="#c8102e"/>



      <rect y="14" width="60" height="8" fill="#c8102e"/>



    </svg>`)}`,



    fr: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2">



      <rect width="1" height="2" fill="#0055a4"/>



      <rect x="1" width="1" height="2" fill="#fff"/>



      <rect x="2" width="1" height="2" fill="#ef4135"/>



    </svg>`)}`,



    de: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 3">



      <rect width="5" height="3" fill="#ffce00"/>



      <rect width="5" height="2" y="0" fill="#dd0000"/>



      <rect width="5" height="1" y="0" fill="#000"/>



    </svg>`)}`,



    pl: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 3">



      <rect width="5" height="3" fill="#e9e9e9"/>



      <rect width="5" height="1.5" y="1.5" fill="#d4213d"/>



    </svg>`)}`,



    ru: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2">



      <rect width="3" height="2" fill="#d52b1e"/>



      <rect width="3" height="1.333" fill="#0039a6" y="0.667"/>



      <rect width="3" height="0.667" fill="#fff"/>



    </svg>`)}`,



    tr: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2">



      <rect width="3" height="2" fill="#e30a17"/>



      <circle cx="1.1" cy="1" r="0.6" fill="#fff"/>



      <circle cx="1.25" cy="1" r="0.46" fill="#e30a17"/>



      <polygon points="1.7,1 2.4,0.65 2.4,1.35" fill="#fff"/>



    </svg>`)}`,



    cn: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20">



      <rect width="30" height="20" fill="#de2910"/>



      <polygon points="5,2 6,5 9,5 6.5,6.8 7.5,10 5,8.2 2.5,10 3.5,6.8 1,5 4,5" fill="#ffde00"/>



      <polygon points="10,2 11,2.5 10,3 10.2,4 9.4,3.3 8.6,4 8.8,3 8,2.5 9,2.5 9.2,1.5" fill="#ffde00"/>



      <polygon points="11.5,4 12.5,4.5 11.5,5 11.7,6 10.9,5.3 10.1,6 10.3,5 9.5,4.5 10.5,4.5 10.7,3.5" fill="#ffde00"/>



      <polygon points="11,7 12,7.5 11,8 11.2,9 10.4,8.3 9.6,9 9.8,8 9,7.5 10,7.5 10.2,6.5" fill="#ffde00"/>



      <polygon points="9,9 10,9.5 9,10 9.2,11 8.4,10.3 7.6,11 7.8,10 7,9.5 8,9.5 8.2,8.5" fill="#ffde00"/>



    </svg>`)}`,



    jp: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2">



      <rect width="3" height="2" fill="#fff"/>



      <circle cx="1.5" cy="1" r="0.55" fill="#bc002d"/>



    </svg>`)}`,



};



const JOB_ICONS: Record<string, string> = {



    Vagrant: vagrantIcon,



    Assist: assistIcon,



    Acrobat: acrobatIcon,



    Mercenary: mercenaryIcon,



    Magician: magicianIcon,



    Ringmaster: ringmasterIcon,



    Billposter: billposterIcon,



    Blade: bladeIcon,



    Knight: knightIcon,



    Ranger: rangerIcon,



    Jester: jesterIcon,



    Elementor: elementorIcon,



    Psykeeper: psykeeperIcon,



    Templar: templarIcon,



    Forcemaster: forcemasterIcon,



    Seraph: seraphIcon,



    Mentalist: mentalistIcon,



    Slayer: slayerIcon,



    Arcanist: arcanistIcon,



    Harlequin: harlequinIcon,



    Crackshooter: crackshooterIcon,



};



type ThemeKey = string;



type ThemeColors = {



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



function isThemeKey(value: string | null): value is ThemeKey {



    return THEMES.some((t) => t.id === value);



}



const THEME_MIGRATION_KEY = "launcherThemeMigratedV2";



const FALLBACK_THEME_COLORS: ThemeColors = {



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



function loadTheme(): ThemeKey {



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



function loadTabActiveOverride(): string | null {



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



function getManualTabActiveOverride(): string | null {



    const stored = loadTabActiveOverride();



    if (stored)



        return stored;



    return lastTabActiveHex;



}



let currentTheme: ThemeKey = loadTheme();



let updateCheckPromise: Promise<boolean> | null = null;



let cachedUpdateAvailable: boolean | null = null;



function normalizeVersionParts(input: string): number[] {



    return input.split(".").map((part) => {



        const numeric = Number.parseInt(part.replace(/[^0-9].*$/, ""), 10);



        return Number.isFinite(numeric) ? numeric : 0;



    });



}



function isRemoteVersionNewer(remote: string, local: string): boolean {



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



async function getUpdateAvailable(): Promise<boolean> {



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



let currentLocale: Locale = DEFAULT_LOCALE;



document.documentElement.lang = currentLocale;



const colorKeys: (keyof ThemeColors)[] = ["bg", "panel", "panel2", "stroke", "text", "muted", "blue", "blue2", "danger", "green", "accent", "tabActive"];



const themeColorCache: Partial<Record<ThemeKey, ThemeColors>> = {};



type ThemeUpdatePayload = {



    id: string;



    name?: string;



    colors?: ThemeColors;



};



let lastPushedTheme: ThemeUpdatePayload | null = null;



function getActiveThemeColors(): ThemeColors {



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



/**



 * Gets theme colors for a specific theme ID.



 * Used for theme switching and color comparisons.



 */



function getThemeColors(themeId: string): ThemeColors {



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



function hexToRgb(input: string | null | undefined): string | null {



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



function rgbToHex(rgb: string): string {



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



const normalizeHex = (hex: string) => hex.trim().toLowerCase().replace(/^#/, "");



function setTabActiveColor(hex: string | null, options?: SetTabActiveColorOptions) {



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



function persistTabActiveColor(hex: string | null) {



    const normalized = hex ? rgbToHex(hex) : null;



    jsonTabActiveOverride = normalized;



    if (!window.api?.tabActiveColorSave)



        return;



    window.api.tabActiveColorSave(normalized).catch(logErr);



}



function applyTheme(theme: string) {



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



function pushThemeUpdate(themeId: string, colors?: ThemeColors) {



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



async function hydrateThemeFromSnapshot(): Promise<ThemeUpdatePayload | null> {



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



function applyLocale(lang: Locale) {



    currentLocale = lang;



    document.documentElement.lang = lang;



}



function setLocale(lang: Locale) {



    applyLocale(lang);



    // Persist locale in client settings (userData) so it survives updates



    void patchClientSettings({ locale: lang });



}



function t(key: TranslationKey) {



    return translate(currentLocale, key);



}



let langMenuCloser: ((e: MouseEvent) => void) | null = null;



let featureFlags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };



async function loadFeatureFlags() {



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



const DEFAULT_CLIENT_SETTINGS: ClientSettings = {



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



    tabLayoutDisplay: "compact",

    fcoinRate: 200_000_000,

};



const clampLayoutDelaySeconds = (input: unknown) => {



    const n = Number(input);



    if (!Number.isFinite(n))



        return DEFAULT_CLIENT_SETTINGS.layoutDelaySeconds;



    return Math.round(Math.min(30, Math.max(0, n)));



};



const clampToastDurationSeconds = (input: unknown) => {



    const n = Number(input);



    if (!Number.isFinite(n))



        return DEFAULT_CLIENT_SETTINGS.toastDurationSeconds;



    return Math.round(Math.min(60, Math.max(1, n)));



};



const clampLauncherWidthPx = (input: unknown) => clampLauncherWidth(input, DEFAULT_CLIENT_SETTINGS.launcherWidth);



const clampLauncherHeightPx = (input: unknown) => clampLauncherHeight(input, DEFAULT_CLIENT_SETTINGS.launcherHeight);



let layoutDelayBaseMs = clampLayoutDelaySeconds(DEFAULT_CLIENT_SETTINGS.layoutDelaySeconds) * 1000;



function setLayoutDelaySeconds(value: number) {



    layoutDelayBaseMs = clampLayoutDelaySeconds(value) * 1000;



}



function getLayoutDelayMs() {



    const base = Math.max(0, layoutDelayBaseMs);



    if (base <= 0)



        return 0;



    return base + Math.random() * 50;



}



let toastBaseTtlMs = DEFAULT_CLIENT_SETTINGS.toastDurationSeconds * 1000;



function setToastDurationSeconds(value: number) {



    toastBaseTtlMs = clampToastDurationSeconds(value) * 1000;



}







const TAB_LAYOUT_DISPLAY_VALUES: ClientSettings["tabLayoutDisplay"][] = ["compact", "grouped", "separated", "mini-grid"];



const normalizeTabLayoutDisplay = (value: unknown): ClientSettings["tabLayoutDisplay"] =>



    TAB_LAYOUT_DISPLAY_VALUES.includes(value as ClientSettings["tabLayoutDisplay"])



        ? (value as ClientSettings["tabLayoutDisplay"])



        : DEFAULT_CLIENT_SETTINGS.tabLayoutDisplay;



let layoutTabDisplay: ClientSettings["tabLayoutDisplay"] = DEFAULT_CLIENT_SETTINGS.tabLayoutDisplay;



const layoutTabDisplayListeners = new Set<() => void>();



function setLayoutTabDisplay(value: ClientSettings["tabLayoutDisplay"]) {



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



function onLayoutTabDisplayChange(fn: () => void): () => void {



    layoutTabDisplayListeners.add(fn);



    return () => layoutTabDisplayListeners.delete(fn);



}







// Manage BrowserView visibility so in-app modals (close dialog, pickers, etc.)



// reliably sit above the game views. We track a hide "depth": each hide request



// increments, each show request decrements; views are only re-shown when depth



// returns to zero. This prevents stray show calls from other UI flows from



// reattaching views while a modal is open.



let sessionViewsHideDepth = 0;



async function hideSessionViews(): Promise<void> {



    sessionViewsHideDepth += 1;



    if (!window.api?.sessionTabsSetVisible)



        return;



    try {



        await window.api.sessionTabsSetVisible(false);



    }



    catch (err) {



        logErr(err, "renderer");



    }



}



async function showSessionViews(force = false): Promise<void> {



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



}



let sequentialGridLoad = DEFAULT_CLIENT_SETTINGS.seqGridLoad;



let autoSaveLayouts = DEFAULT_CLIENT_SETTINGS.autoSaveLayouts;



let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;



function setSequentialGridLoad(value: boolean) {



    sequentialGridLoad = !!value;



}



function setAutoSaveLayouts(value: boolean) {



    autoSaveLayouts = !!value;



    if (!autoSaveLayouts && autoSaveTimeout) {



        clearTimeout(autoSaveTimeout);



        autoSaveTimeout = null;



    }



}



async function loadClientSettings(): Promise<ClientSettings> {



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



async function syncLocaleFromSettings(): Promise<void> {



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



async function patchClientSettings(patch: Partial<ClientSettings>): Promise<ClientSettings | null> {



    if (!window.api?.clientSettingsPatch)



        return null;



    return await window.api.clientSettingsPatch(patch);



}



type Profile = {



    id: string;



    name: string;



    createdAt: string;



    job?: string;



    launchMode: "tabs" | "window";



    overlayTarget?: boolean;



    overlaySupportTarget?: boolean;



    overlayIconKey?: string;



    overlaySupportIconKey?: string;



};



function qs() {



    const u = new URL(window.location.href);



    return u.searchParams;



}



function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {



    const e = document.createElement(tag);



    if (cls)



        e.className = cls;



    if (text !== undefined)



        e.textContent = text;



    return e;



}



function clear(root: HTMLElement) {



    root.innerHTML = "";



}



function jobIconSrc(job?: string | null): string | null {



    if (!job)



        return null;



    const key = job.trim();



    return JOB_ICONS[key] ?? null;



}



function createJobIcon(job?: string | null, className = "jobIcon"): HTMLImageElement | null {



    const src = jobIconSrc(job);



    if (!src)



        return null;



    const img = document.createElement("img");



    img.src = src;



    img.alt = job ?? "";



    img.className = className;



    return img;



}



function createJobBadge(job?: string | null): HTMLElement | null {



    const label = job?.trim();



    if (!label)



        return null;



    const badge = el("span", "badge jobBadge");



    const icon = createJobIcon(label, "jobBadgeIcon");



    if (icon)



        badge.append(icon);



    const text = document.createElement("span");



    text.textContent = label;



    badge.append(text);



    return badge;



}



function decorateJobSelect(select: HTMLSelectElement) {



    select.classList.add("jobSelect");



    const syncSelectedIcon = () => {



        const icon = jobIconSrc(select.value);



        if (icon) {



            select.style.backgroundImage = `url("${icon}")`;



            select.classList.remove("noIcon");



        }



        else {



            select.style.backgroundImage = "";



            select.classList.add("noIcon");



        }



    };



    select.querySelectorAll("option").forEach((opt) => {



        const icon = jobIconSrc(opt.value);



        if (icon && !opt.disabled && !opt.value.startsWith("__")) {



            opt.style.backgroundImage = `url("${icon}")`;



            opt.style.backgroundRepeat = "no-repeat";



            opt.style.backgroundPosition = "8px center";



            opt.style.backgroundSize = "18px 18px";



            opt.style.paddingLeft = "32px";



            opt.classList.add("hasIcon");



        }



        else {



            opt.style.backgroundImage = "";



            opt.style.paddingLeft = "";



            opt.classList.remove("hasIcon");



        }



    });



    syncSelectedIcon();



    select.addEventListener("change", syncSelectedIcon);



}











function showToast(message: string, tone: "info" | "success" | "error" = "info", ttlMs?: number | string | null) {



    let container = document.querySelector(".toastContainer") as HTMLElement | null;



    if (!container) {



        container = document.createElement("div");



        container.className = "toastContainer";



        document.body.append(container);



    }



    const toast = document.createElement("div");



    toast.className = `toast ${tone}`;



    toast.textContent = message;



    container.append(toast);



    const ttlNum = Number(ttlMs);



    const ttl = Number.isFinite(ttlNum) ? ttlNum : toastBaseTtlMs;



    setTimeout(() => toast.remove(), Math.max(300, ttl));



}



function withTimeout<T>(p: Promise<T>, label: string, ms = 6000): Promise<T> {



    return new Promise<T>((resolve, reject) => {



        const timer = setTimeout(() => reject(new Error(`timeout: ${label}`)), ms);



        p.then((v) => {



            clearTimeout(timer);



            resolve(v);



        }, (err) => {



            clearTimeout(timer);



            reject(err);



        });



    });



}



async function fetchTabLayouts(): Promise<TabLayout[]> {



    try {



        return await window.api.tabLayoutsList();



    }



    catch (err) {



        console.error("[layouts] list failed:", err);



        showToast(t("layout.refresh"), "error", 3000);



        return [];



    }



}



function createWebview(profileId: string): HTMLElement {



    const wv = document.createElement("webview") as HTMLElement;



    wv.className = "webview";



    wv.setAttribute("partition", `persist:${profileId}`);



    wv.setAttribute("src", "about:blank");



    wv.style.position = "absolute";



    wv.style.top = "0";



    wv.style.left = "0";



    wv.style.right = "0";



    wv.style.bottom = "0";



    wv.style.display = "block";



    return wv;



}



function reorderIds(ids: string[], fromId: string, toId: string, after: boolean) {



    const arr = [...ids];



    const from = arr.indexOf(fromId);



    let to = arr.indexOf(toId);



    if (from < 0 || to < 0)



        return arr;



    if (from === to)



        return arr;



    arr.splice(from, 1);



    if (from < to)



        to--;



    if (after)



        to++;



    arr.splice(to, 0, fromId);



    return arr;



}



async function renderLauncher(root: HTMLElement) {



    clear(root);



    root.className = "launcherRoot";



    const overlayDisabled = false;



    let overlayClearedOnce = false;



    if (langMenuCloser) {



        document.removeEventListener("click", langMenuCloser);



        langMenuCloser = null;



    }



    const header = el("div", "topbar");



            type JobOption = {



                value: string;



                label: string;



                disabled?: boolean;



            };



        const jobOptions: JobOption[] = [



        { value: "", label: t("job.choose") },



        { value: "Vagrant", label: "Vagrant" },



        { value: "__sep1", label: "--- 1. Job ---", disabled: true },



        { value: "Assist", label: "Assist" },



        { value: "Acrobat", label: "Acrobat" },



        { value: "Mercenary", label: "Mercenary" },



        { value: "Magician", label: "Magician" },



        { value: "__sep2", label: "--- 2. Job ---", disabled: true },



        { value: "Ringmaster", label: "Ringmaster" },



        { value: "Billposter", label: "Billposter" },



        { value: "Blade", label: "Blade" },



        { value: "Knight", label: "Knight" },



        { value: "Ranger", label: "Ranger" },



        { value: "Jester", label: "Jester" },



        { value: "Elementor", label: "Elementor" },



        { value: "Psykeeper", label: "Psykeeper" },



        { value: "__sep3", label: "--- 3. Job ---", disabled: true },



        { value: "Templar", label: "Templar" },



        { value: "Forcemaster", label: "Forcemaster" },



        { value: "Seraph", label: "Seraph" },



        { value: "Mentalist", label: "Mentalist" },



        { value: "Slayer", label: "Slayer" },



        { value: "Arcanist", label: "Arcanist" },



        { value: "Harlequin", label: "Harlequin" },



        { value: "Crackshooter", label: "Crackshooter" },



    ];



    const tips = getTips(currentLocale);



    function renderJobOptions(select: HTMLSelectElement, selectedValue: string | null = null) {



        select.innerHTML = "";



        for (const j of jobOptions) {



            const opt = document.createElement("option");



            opt.value = j.disabled ? "" : j.value;



            opt.textContent = j.label;



            if (j.disabled)



                opt.disabled = true;



            select.append(opt);



        }



        select.value = selectedValue ?? "";



        decorateJobSelect(select);



    }



    function snapshotThemeVars(): Record<string, string> {



        const colors = getActiveThemeColors();



        const vars: Record<string, string> = {



            "--bg": colors.bg,



            "--panel": colors.panel,



            "--panel2": colors.panel2,



            "--stroke": colors.stroke,



            "--text": colors.text,



            "--muted": colors.muted,



            "--blue": colors.blue,



            "--blue2": colors.blue2,



            "--danger": colors.danger,



            "--green": colors.green,



            "--accent-rgb": hexToRgb(colors.accent) ?? "",



            "--danger-rgb": hexToRgb(colors.danger) ?? "",



            "--green-rgb": hexToRgb(colors.green) ?? "",



            "--tab-active-rgb": hexToRgb(colors.tabActive ?? colors.green) ?? "",



        };



        const computed = getComputedStyle(document.documentElement);



        for (const [key, value] of Object.entries(vars)) {



            if (!value) {



                const fallback = computed.getPropertyValue(key);



                if (fallback) {



                    vars[key] = fallback.trim();



                }



            }



        }



        return vars;



    }



    function applyThemeToIframe(iframe: HTMLIFrameElement): void {



        try {



            const doc = iframe.contentDocument;



            if (!doc)



                return;



            const vars = snapshotThemeVars();



            for (const [key, value] of Object.entries(vars)) {



                if (value) {



                    doc.documentElement.style.setProperty(key, value);



                }



            }



        }



        catch (err) {



            logErr(err, "renderer");



        }



    }



    async function openPluginSettingsUI(plugin: { id: string; name: string; hasSettingsUI?: boolean; enabled?: boolean }): Promise<void> {



        console.log("[PluginUI] open", { id: plugin.id, name: plugin.name, enabled: plugin.enabled, hasSettingsUI: plugin.hasSettingsUI });



        if (!plugin.hasSettingsUI) {



            showToast(t("config.plugins.noUI"), "info");



            return;



        }



        if (plugin.enabled === false) {



            showToast(t("config.plugins.isDisabled"), "warning");



            return;



        }



        const overlay = el("div", "pluginUiOverlay");



        const container = el("div", "pluginUiContainer");



        const header = el("div", "pluginUiHeader");



        const title = el("div", "pluginUiTitle", plugin.name);



        const closeBtn = el("button", "pluginUiClose", "x");



        const frame = document.createElement("iframe");



        frame.className = "pluginUiFrame";



        // Only allow-scripts, not allow-same-origin to prevent sandbox escape



        frame.setAttribute("sandbox", "allow-scripts");



        header.append(title, closeBtn);



        container.append(header, frame);



        overlay.append(container);



        document.body.append(overlay);



        const close = () => {



            window.removeEventListener("message", messageHandler);



            overlay.remove();



        };



        // Handle postMessage from iframe for IPC calls



        const messageHandler = async (evt: MessageEvent) => {



            if (evt.source !== frame.contentWindow) return;



            const { type, id, channel, args } = evt.data || {};



            if (type === "plugin:ipc:invoke" && channel && id) {



                try {



                    const result = await window.api.pluginsInvokeChannel(plugin.id, channel, ...(args || []));



                    frame.contentWindow?.postMessage({ type: "plugin:ipc:result", id, result }, "*");



                } catch (err) {



                    frame.contentWindow?.postMessage({ type: "plugin:ipc:result", id, error: String(err) }, "*");



                }



            } else if (type === "plugin:theme:refresh") {



                applyThemeToIframe(frame);



            } else if (type === "plugin:theme:vars") {



                frame.contentWindow?.postMessage({ type: "plugin:theme:vars:result", vars: snapshotThemeVars() }, "*");



            }



        };



        window.addEventListener("message", messageHandler);



        closeBtn.addEventListener("click", close);



        overlay.addEventListener("click", (evt) => {



            if (evt.target === overlay)



                close();



        });



        frame.addEventListener("load", () => {



            console.log("[PluginUI] iframe loaded", plugin.id);



            applyThemeToIframe(frame);



        });



        try {



            const uiInfo = await window.api.pluginsGetSettingsUI(plugin.id);



            console.log("[PluginUI] settings UI info", uiInfo);



            if (!uiInfo) {



                throw new Error("No UI URL available");



            }



            if (uiInfo.width) {



                container.style.width = `${Math.max(360, uiInfo.width)}px`;



            }



            if (uiInfo.height) {



                container.style.height = `${Math.max(240, uiInfo.height)}px`;



            }



            if (uiInfo.html) {



                // Inject base tag to resolve relative URLs to plugin directory



                const baseTag = uiInfo.baseHref ? `<base href="${uiInfo.baseHref}">` : "";



                // Inject bridge script that provides window.plugin API via postMessage



                const bridgeScript = `<script>



(function() {



    var pending = {};



    var nextId = 1;



    window.addEventListener("message", function(evt) {



        var data = evt.data || {};



        if (data.type === "plugin:ipc:result" && data.id && pending[data.id]) {



            if (data.error) {



                pending[data.id].reject(new Error(data.error));



            } else {



                pending[data.id].resolve(data.result);



            }



            delete pending[data.id];



        } else if (data.type === "plugin:theme:vars:result" && pending["theme:vars"]) {



            pending["theme:vars"].resolve(data.vars);



            delete pending["theme:vars"];



        }



    });



    window.plugin = {



        ipc: {



            invoke: function(channel) {



                var args = Array.prototype.slice.call(arguments, 1);



                var id = nextId++;



                return new Promise(function(resolve, reject) {



                    pending[id] = { resolve: resolve, reject: reject };



                    parent.postMessage({ type: "plugin:ipc:invoke", id: id, channel: channel, args: args }, "*");



                });



            }



        },



        theme: {



            refresh: function() {



                parent.postMessage({ type: "plugin:theme:refresh" }, "*");



            },



            vars: function() {



                return new Promise(function(resolve) {



                    pending["theme:vars"] = { resolve: resolve };



                    parent.postMessage({ type: "plugin:theme:vars" }, "*");



                });



            }



        }



    };



})();



<\/script>`;



                const html = `${baseTag}${bridgeScript}${uiInfo.html}`;



                frame.srcdoc = html;



            } else if (uiInfo.url) {



                frame.src = uiInfo.url;



            } else {



                throw new Error("No UI URL available");



            }



        }



        catch (err) {



            console.error("[PluginUI] failed to load settings UI", plugin.id, err);



            frame.remove();



            const errorEl = el("div", "pluginsError muted", String(err));



            container.append(errorEl);



        }



    }



    function openConfigModal(defaultStyleTab: "theme" | "tabActive" = "theme", defaultTab: "style" | "plugins" | "client" | "patchnotes" | "docs" | "support" = "style") {



        const overlay = el("div", "modalOverlay");



        const modal = el("div", "modal configModal");



        const headerEl = el("div", "modalHeader");



        const headerTitle = el("div", "modalHeaderTitle", t("config.title"));



        const headerClose = document.createElement("button");



        headerClose.type = "button";



        headerClose.className = "modalCloseBtn";



        headerClose.title = "Close";



        headerClose.textContent = "\u00d7";



        headerEl.append(headerTitle, headerClose);



        const body = el("div", "modalBody configBody");



        const tabs = el("div", "configTabs");



        const tabStyle = el("button", "configTab", t("config.tab.style"));



        const tabPlugins = el("button", "configTab", t("config.tab.plugins" as TranslationKey));



        const tabClient = el("button", "configTab", t("config.tab.client" as TranslationKey));



        const tabPatchnotes = el("button", "configTab", t("config.tab.patchnotes" as TranslationKey));



        const tabDocs = el("button", "configTab", t("config.tab.docs" as TranslationKey));



        const tabSupport = el("button", "configTab", t("config.tab.support" as TranslationKey));



        tabs.append(tabStyle, tabPlugins, tabClient, tabPatchnotes, tabDocs, tabSupport);



        const content = el("div", "configContent");



        // Style pane



        const styleTabs = el("div", "configSubTabs");



        const subTabTheme = el("button", "configSubTab", t("config.tab.theme"));



        const subTabTabColor = el("button", "configSubTab", t("config.tab.style.activeTabColor"));



        styleTabs.append(subTabTheme, subTabTabColor);



        const styleContentBody = el("div", "styleContent");



        const stylePane = el("div", "stylePane configPaneCard");



        stylePane.append(styleTabs, styleContentBody);



        // Plugins pane



        const pluginsPane = el("div", "pluginsPane configPaneCard");



        const pluginsTitle = el("div", "pluginsTitle", t("config.plugins.title" as TranslationKey));



        const pluginsList = el("div", "pluginsList");



        const pluginsEmpty = el("div", "pluginsEmpty muted", t("config.plugins.empty" as TranslationKey));



        pluginsPane.append(pluginsTitle, pluginsList, pluginsEmpty);



        const clientPane = el("div", "clientPane configPaneCard");



        const clientSection = el("div", "section clientSection");



        const clientTitle = el("div", "sectionTitle", t("config.tab.client"));



        const clientRow = el("div", "row clientControlRow");



        const fullscreenLabel = document.createElement("label");



        fullscreenLabel.className = "checkbox";



        const fullscreenCheckbox = document.createElement("input");



        fullscreenCheckbox.type = "checkbox";



        const fullscreenText = document.createElement("span");



        fullscreenText.textContent = t("config.client.fullscreen");



        fullscreenLabel.append(fullscreenCheckbox, fullscreenText);



        clientRow.append(fullscreenLabel);



        const delayRow = el("div", "row clientControlRow clientDelayRow");
        const createNudgeButton = (label: string, onClick: () => void) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn";
            btn.style.padding = "6px 10px";
            btn.style.margin = "0 6px";
            btn.textContent = label;
            btn.addEventListener("click", onClick);
            return btn;
        };


        const delayLabelWrap = el("div", "rowLeft");



        const delayLabel = el("div", "rowName", t("config.client.layoutDelay"));



        const delayHint = el("div", "muted", "");


        delayLabelWrap.append(delayLabel, delayHint);



        const delayInputWrap = el("div", "rowActions");



        const delayInput = document.createElement("input");



        delayInput.type = "range";



        delayInput.min = "0";



        delayInput.max = "30";



        delayInput.step = "1";



        delayInput.className = "slider";



        delayInput.style.width = "220px";



        const delayValue = el("div", "sliderValue badge", "");



        const delayDecBtn = createNudgeButton("-1", () => {
            const current = Number.isFinite(delayInput.valueAsNumber) ? delayInput.valueAsNumber : Number(delayInput.value) || 0;
            const next = clampLayoutDelaySeconds(current - 1);
            delayInput.value = String(next);
            delayInput.dispatchEvent(new Event("change"));
        });

        const delayIncBtn = createNudgeButton("+1", () => {
            const current = Number.isFinite(delayInput.valueAsNumber) ? delayInput.valueAsNumber : Number(delayInput.value) || 0;
            const next = clampLayoutDelaySeconds(current + 1);
            delayInput.value = String(next);
            delayInput.dispatchEvent(new Event("change"));
        });

        delayInputWrap.append(delayDecBtn, delayInput, delayIncBtn, delayValue);


        delayRow.append(delayLabelWrap, delayInputWrap);



        // New: toggle sequential loading for grid/layout tabs



        const seqRow = el("div", "row clientControlRow clientSeqRow");



        const seqLabelWrap = el("div", "rowLeft");



        const seqLabel = el("div", "rowName", t("config.client.seqGridLoad"));



        const seqHint = el("div", "muted", t("config.client.seqGridLoad.hint"));



        seqLabelWrap.append(seqLabel, seqHint);



        const seqInputWrap = el("div", "rowActions");



        const seqCheckboxLabel = document.createElement("label");



        seqCheckboxLabel.className = "checkbox";



        const seqCheckbox = document.createElement("input");



        seqCheckbox.type = "checkbox";



        const seqText = document.createElement("span");



        seqText.textContent = t("config.client.seqGridLoad.label");



        seqCheckboxLabel.append(seqCheckbox, seqText);



        seqInputWrap.append(seqCheckboxLabel);



        seqRow.append(seqLabelWrap, seqInputWrap);



        const seqToggle = {



            get: () => seqCheckbox.checked,



            set: (val: boolean) => {



                seqCheckbox.checked = !!val;



            },



        };



        const tabDisplayRow = el("div", "row clientControlRow clientTabDisplayRow");



        const tabDisplayLabelWrap = el("div", "rowLeft");



        const tabDisplayLabel = el("div", "rowName", t("config.client.tabLayoutDisplay" as TranslationKey));



        const tabDisplayHint = el("div", "muted", t("config.client.tabLayoutDisplay.hint" as TranslationKey));



        tabDisplayLabelWrap.append(tabDisplayLabel, tabDisplayHint);



        const tabDisplayActions = el("div", "rowActions tabDisplayActions");


        const tabDisplaySelect = document.createElement("select");



        const tabDisplayPreview = document.createElement("img");



        tabDisplayPreview.className = "tabLayoutPreview";



        tabDisplayPreview.src = tabLayoutCompact;



        tabDisplayPreview.alt = "Compact layout preview";



        tabDisplayPreview.loading = "lazy";



        tabDisplayPreview.decoding = "async";



        const tabDisplayControl = el("div", "tabDisplayControl");


        tabDisplaySelect.className = "select";



        const tabDisplayOptions: Array<{ value: ClientSettings["tabLayoutDisplay"]; label: TranslationKey }> = [



            { value: "compact", label: "config.client.tabLayoutDisplay.compact" as TranslationKey },



            { value: "grouped", label: "config.client.tabLayoutDisplay.grouped" as TranslationKey },



            { value: "separated", label: "config.client.tabLayoutDisplay.separated" as TranslationKey },



            { value: "mini-grid", label: "config.client.tabLayoutDisplay.mini-grid" as TranslationKey },



        ];



        for (const opt of tabDisplayOptions) {



            const optionEl = document.createElement("option");



            optionEl.value = opt.value;



            optionEl.textContent = t(opt.label);



            tabDisplaySelect.append(optionEl);



        }



        tabDisplayControl.append(tabDisplaySelect);



        const TAB_DISPLAY_PREVIEWS: Record<string, string> = {
            "compact": tabLayoutCompact,
            "grouped": tabLayoutChips1,
            "separated": tabLayoutChips2,
            "mini-grid": tabLayoutMiniGrid,
        };

        const renderTabLayoutPreview = () => {
            tabDisplayPreview.src = TAB_DISPLAY_PREVIEWS[layoutTabDisplay] ?? tabLayoutCompact;
            tabDisplayPreview.hidden = false;
        };



        onLayoutTabDisplayChange(renderTabLayoutPreview);



        renderTabLayoutPreview();



        tabDisplayActions.append(tabDisplayControl, tabDisplayPreview);


        tabDisplayRow.append(tabDisplayLabelWrap, tabDisplayActions);


        const gridBorderRow = el("div", "row clientControlRow clientGridBorderRow");



        const gridBorderLabelWrap = el("div", "rowLeft");



        const gridBorderLabel = el("div", "rowName", t("config.client.gridActiveBorder" as TranslationKey));



        const gridBorderHint = el("div", "muted", t("config.client.gridActiveBorder.hint" as TranslationKey));



        gridBorderLabelWrap.append(gridBorderLabel, gridBorderHint);



        const gridBorderInputWrap = el("div", "rowActions");



        const gridBorderCheckboxLabel = document.createElement("label");



        gridBorderCheckboxLabel.className = "checkbox";



        const gridBorderCheckbox = document.createElement("input");



        gridBorderCheckbox.type = "checkbox";



        const gridBorderText = document.createElement("span");



        gridBorderText.textContent = t("config.client.gridActiveBorder.label" as TranslationKey);



        gridBorderCheckboxLabel.append(gridBorderCheckbox, gridBorderText);



        gridBorderInputWrap.append(gridBorderCheckboxLabel);



        gridBorderRow.append(gridBorderLabelWrap, gridBorderInputWrap);



        const gridBorderToggle = {



            get: () => gridBorderCheckbox.checked,



            set: (val: boolean) => {



                gridBorderCheckbox.checked = !!val;



            },



        };



        const autoSaveRow = el("div", "row clientControlRow clientAutoSaveRow");



        const autoSaveLabelWrap = el("div", "rowLeft");



        const autoSaveLabel = el("div", "rowName", t("config.client.layoutAutoSave" as TranslationKey));



        const autoSaveHint = el("div", "muted", t("config.client.layoutAutoSave.hint" as TranslationKey));



        autoSaveLabelWrap.append(autoSaveLabel, autoSaveHint);



        const autoSaveInputWrap = el("div", "rowActions");



        const autoSaveCheckboxLabel = document.createElement("label");



        autoSaveCheckboxLabel.className = "checkbox";



        const autoSaveCheckbox = document.createElement("input");



        autoSaveCheckbox.type = "checkbox";



        const autoSaveText = document.createElement("span");



        autoSaveText.textContent = t("config.client.layoutAutoSave.label" as TranslationKey);



        autoSaveCheckboxLabel.append(autoSaveCheckbox, autoSaveText);



        autoSaveInputWrap.append(autoSaveCheckboxLabel);



        autoSaveRow.append(autoSaveLabelWrap, autoSaveInputWrap);



        const autoSaveToggle = {



            get: () => autoSaveCheckbox.checked,



            set: (val: boolean) => {



                autoSaveCheckbox.checked = !!val;



            },



        };



        const toastRow = el("div", "row clientControlRow clientToastRow");



        const toastLabelWrap = el("div", "rowLeft");



        const toastLabel = el("div", "rowName", t("config.client.toastDuration"));



        const toastHint = el("div", "muted", t("config.client.toastDuration.hint"));



        toastLabelWrap.append(toastLabel, toastHint);



        const toastInputWrap = el("div", "rowActions");



        const toastInput = document.createElement("input");



        toastInput.type = "range";



        toastInput.min = "1";



        toastInput.max = "60";



        toastInput.step = "1";



        toastInput.className = "slider";



        toastInput.style.width = "220px";



        const toastValue = el("div", "sliderValue badge", "");



        toastInputWrap.append(toastInput, toastValue);



        toastRow.append(toastLabelWrap, toastInputWrap);



        const launcherWidthRow = el("div", "row clientControlRow clientLauncherWidthRow");



        const launcherWidthLabelWrap = el("div", "rowLeft");



        const launcherWidthLabel = el("div", "rowName", t("config.client.launcherWidth" as TranslationKey));



        const launcherWidthHint = el("div", "muted", "");


        launcherWidthLabelWrap.append(launcherWidthLabel, launcherWidthHint);



        const launcherWidthInputWrap = el("div", "rowActions");



        const launcherWidthInput = document.createElement("input");



        launcherWidthInput.type = "range";



        launcherWidthInput.min = String(LAYOUT_CONST.LAUNCHER_MIN_WIDTH);



        launcherWidthInput.max = String(LAYOUT_CONST.LAUNCHER_MAX_WIDTH);



        launcherWidthInput.step = "10";



        launcherWidthInput.className = "slider";



        launcherWidthInput.style.width = "220px";



        const launcherWidthValue = el("div", "sliderValue badge", "");



        const launcherWidthDecBtn = createNudgeButton("-10", () => {
            const current = Number.isFinite(launcherWidthInput.valueAsNumber)
                ? launcherWidthInput.valueAsNumber
                : Number(launcherWidthInput.value) || DEFAULT_CLIENT_SETTINGS.launcherWidth;
            const next = clampLauncherWidthPx(current - 10);
            launcherWidthInput.value = String(next);
            launcherWidthInput.dispatchEvent(new Event("change"));
        });

        const launcherWidthIncBtn = createNudgeButton("+10", () => {
            const current = Number.isFinite(launcherWidthInput.valueAsNumber)
                ? launcherWidthInput.valueAsNumber
                : Number(launcherWidthInput.value) || DEFAULT_CLIENT_SETTINGS.launcherWidth;
            const next = clampLauncherWidthPx(current + 10);
            launcherWidthInput.value = String(next);
            launcherWidthInput.dispatchEvent(new Event("change"));
        });

        launcherWidthInputWrap.append(launcherWidthDecBtn, launcherWidthInput, launcherWidthIncBtn, launcherWidthValue);


        launcherWidthRow.append(launcherWidthLabelWrap, launcherWidthInputWrap);



        const launcherHeightRow = el("div", "row clientControlRow clientLauncherHeightRow");



        const launcherHeightLabelWrap = el("div", "rowLeft");



        const launcherHeightLabel = el("div", "rowName", t("config.client.launcherHeight" as TranslationKey));



        const launcherHeightHint = el("div", "muted", "");


        launcherHeightLabelWrap.append(launcherHeightLabel, launcherHeightHint);



        const launcherHeightInputWrap = el("div", "rowActions");



        const launcherHeightInput = document.createElement("input");



        launcherHeightInput.type = "range";



        launcherHeightInput.min = String(LAYOUT_CONST.LAUNCHER_MIN_HEIGHT);



        launcherHeightInput.max = String(LAYOUT_CONST.LAUNCHER_MAX_HEIGHT);



        launcherHeightInput.step = "10";



        launcherHeightInput.className = "slider";



        launcherHeightInput.style.width = "220px";



        const launcherHeightValue = el("div", "sliderValue badge", "");



        const launcherHeightDecBtn = createNudgeButton("-10", () => {
            const current = Number.isFinite(launcherHeightInput.valueAsNumber)
                ? launcherHeightInput.valueAsNumber
                : Number(launcherHeightInput.value) || DEFAULT_CLIENT_SETTINGS.launcherHeight;
            const next = clampLauncherHeightPx(current - 10);
            launcherHeightInput.value = String(next);
            launcherHeightInput.dispatchEvent(new Event("change"));
        });

        const launcherHeightIncBtn = createNudgeButton("+10", () => {
            const current = Number.isFinite(launcherHeightInput.valueAsNumber)
                ? launcherHeightInput.valueAsNumber
                : Number(launcherHeightInput.value) || DEFAULT_CLIENT_SETTINGS.launcherHeight;
            const next = clampLauncherHeightPx(current + 10);
            launcherHeightInput.value = String(next);
            launcherHeightInput.dispatchEvent(new Event("change"));
        });

        launcherHeightInputWrap.append(launcherHeightDecBtn, launcherHeightInput, launcherHeightIncBtn, launcherHeightValue);


        launcherHeightRow.append(launcherHeightLabelWrap, launcherHeightInputWrap);



        const clientGrid = el("div", "clientGrid");



        clientGrid.append(



            clientRow,            // Fullscreen toggle



            launcherWidthRow,     // Launcher width



            launcherHeightRow,    // Launcher height



            delayRow,             // Layout delay / next tab



            seqRow,               // Sequential grid loading



            tabDisplayRow,        // Layout tab display mode



            gridBorderRow,        // Highlight active grid view



            autoSaveRow,          // Layout auto-save



            toastRow              // Toast duration



        );



        clientSection.append(clientTitle, clientGrid);



        const setSliderBadge = (input: HTMLInputElement, badge: HTMLElement, formatter: (v: number) => string) => {



            const val = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : Number(input.value);



            badge.textContent = formatter(val);



        };



        let currentHotkeys = normalizeHotkeySettings(DEFAULT_CLIENT_SETTINGS.hotkeys, DEFAULT_HOTKEYS);



        let hotkeyRevision = 0;



        type HotkeyKey = keyof typeof currentHotkeys;



        const hotkeyDefs: Array<{ key: HotkeyKey; label: TranslationKey; hint: TranslationKey; defaultChord: ReturnType<typeof normalizeHotkeySettings>[HotkeyKey] }> = [



            { key: "toggleOverlays", label: "config.client.hotkeys.toggleOverlays" as TranslationKey, hint: "config.client.hotkeys.toggleOverlays.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.toggleOverlays },



            { key: "sidePanelToggle", label: "config.client.hotkeys.sidePanelToggle" as TranslationKey, hint: "config.client.hotkeys.sidePanelToggle.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.sidePanelToggle },



            { key: "tabBarToggle", label: "config.client.hotkeys.tabBarToggle" as TranslationKey, hint: "config.client.hotkeys.tabBarToggle.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.tabBarToggle },



            { key: "screenshotWindow", label: "config.client.hotkeys.screenshotWindow" as TranslationKey, hint: "config.client.hotkeys.screenshotWindow.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.screenshotWindow },



            { key: "tabPrev", label: "config.client.hotkeys.tabPrev" as TranslationKey, hint: "config.client.hotkeys.tabPrev.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.tabPrev },



            { key: "tabNext", label: "config.client.hotkeys.tabNext" as TranslationKey, hint: "config.client.hotkeys.tabNext.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.tabNext },



            { key: "nextInstance", label: "config.client.hotkeys.nextInstance" as TranslationKey, hint: "config.client.hotkeys.nextInstance.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.nextInstance },



            { key: "cdTimerExpireAll", label: "config.client.hotkeys.cdTimerExpireAll" as TranslationKey, hint: "config.client.hotkeys.cdTimerExpireAll.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.cdTimerExpireAll },

            { key: "showFcoinConverter", label: "config.client.hotkeys.showFcoinConverter" as TranslationKey, hint: "config.client.hotkeys.showFcoinConverter.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.showFcoinConverter },

            { key: "showShoppingList", label: "config.client.hotkeys.showShoppingList" as TranslationKey, hint: "config.client.hotkeys.showShoppingList.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.showShoppingList },

        ];



        const hotkeySection = el("div", "section clientSection hotkeySection");



        const hotkeyTitle = el("div", "sectionTitle", t("config.client.hotkeys.title" as TranslationKey));



        hotkeySection.append(hotkeyTitle);



        const hotkeyRowsContainer = el("div", "hotkeyRows");



        hotkeySection.append(hotkeyRowsContainer);



        clientPane.append(clientSection, hotkeySection);



        type HotkeyRowUi = {



            badge: HTMLDivElement;



            recordBtn: HTMLButtonElement;



            clearBtn: HTMLButtonElement;



        };



        const hotkeyUi: Partial<Record<HotkeyKey, HotkeyRowUi>> = {};



        const setHotkeyBadge = (key: HotkeyKey, chord: ReturnType<typeof normalizeHotkeySettings>[HotkeyKey]) => {



            const ui = hotkeyUi[key];



            if (!ui)



                return;



            const label = chord && Array.isArray(chord) && chord.length



                ? formatHotkey(chord)



                : t("config.client.hotkeys.notSet" as TranslationKey);



            ui.badge.textContent = label;



        };



        const setHotkeyButtonsDisabled = (key: HotkeyKey, disabled: boolean) => {



            const ui = hotkeyUi[key];



            if (!ui)



                return;



            ui.recordBtn.disabled = disabled;



            ui.clearBtn.disabled = disabled;



        };



        const applyHotkeyState = (settings: ClientSettings) => {



            currentHotkeys = normalizeHotkeySettings(settings.hotkeys ?? currentHotkeys, currentHotkeys);



            for (const def of hotkeyDefs) {



                setHotkeyBadge(def.key, currentHotkeys[def.key]);



            }



        };



        async function persistHotkey(key: HotkeyKey, next: ReturnType<typeof normalizeHotkeySettings>[HotkeyKey]) {



            const prevHotkeys = currentHotkeys;



            // Optimistic update so the badge doesn't flicker back to "not set" while saving



            currentHotkeys = normalizeHotkeySettings({ ...currentHotkeys, [key]: next } as ClientSettings["hotkeys"], currentHotkeys);



            // Conflict check (client-side)



            const isSameChord = (a: ReturnType<typeof normalizeHotkeySettings>[HotkeyKey], b: ReturnType<typeof normalizeHotkeySettings>[HotkeyKey]) => {



                if (!a || !b)



                    return false;



                if (a.length !== b.length)



                    return false;



                return a.every((v, i) => v === b[i]);



            };



            const conflict = hotkeyDefs.find((def) => def.key !== key && isSameChord(currentHotkeys[def.key], currentHotkeys[key]));



            if (conflict) {



                showToast(t("config.client.hotkeys.conflict" as TranslationKey), "error");



                currentHotkeys = prevHotkeys;



                applyHotkeyState({ ...DEFAULT_CLIENT_SETTINGS, hotkeys: currentHotkeys });



                return;



            }



            applyHotkeyState({ ...DEFAULT_CLIENT_SETTINGS, hotkeys: currentHotkeys });



            setHotkeyButtonsDisabled(key, true);



            try {



                const updated = await patchClientSettings({ hotkeys: { [key]: next } as ClientSettings["hotkeys"] });



                if (!updated) {



                    throw new Error("Client settings service unavailable (no IPC bridge)");



                }



                // Re-read from disk to be 100% sure we reflect what was persisted



                const verified = await loadClientSettings();



                hotkeyRevision += 1;



                currentHotkeys = normalizeHotkeySettings(verified.hotkeys ?? updated.hotkeys ?? currentHotkeys, currentHotkeys);



                applyHotkeyState({ ...verified, hotkeys: currentHotkeys });



                showToast(t("config.client.hotkeys.saved" as TranslationKey), "success");



            }



            catch (err) {



                // Revert optimistic update on failure



                currentHotkeys = prevHotkeys;



                applyHotkeyState({ ...DEFAULT_CLIENT_SETTINGS, hotkeys: currentHotkeys });



                showToast(String(err), "error");



            }



            finally {



                setHotkeyButtonsDisabled(key, false);



            }



        }



        let captureActive = false;



        let captureKeys = new Set<string>();



        let captureTimer: number | null = null;



        let captureTarget: HotkeyKey | null = null;



        const stopCapture = (restoreBadge: boolean) => {



            if (!captureActive)



                return;



            captureActive = false;



            if (captureTimer) {



                window.clearTimeout(captureTimer);



                captureTimer = null;



            }



            window.removeEventListener("keydown", onCaptureKeyDown, true);



            window.removeEventListener("keyup", onCaptureKeyUp, true);



            if (captureTarget && hotkeyUi[captureTarget]) {



                hotkeyUi[captureTarget]!.recordBtn.textContent = t("config.client.hotkeys.record" as TranslationKey);



                if (restoreBadge) {



                    setHotkeyBadge(captureTarget, currentHotkeys[captureTarget]);



                }



            }



            captureTarget = null;



            // Re-enable global hotkeys after recording



            window.api?.hotkeysResume?.().catch(() => undefined);



        };



        const finalizeCapture = () => {



            if (!captureActive || !captureTarget)



                return;



            const target = captureTarget;



            const rawKeys = Array.from(captureKeys);



            const chord = sanitizeHotkeyChord(rawKeys);



            stopCapture(false);



            if (!chord) {



                showToast(t("config.client.hotkeys.invalid" as TranslationKey), "error");



                captureKeys.clear();



                setHotkeyBadge(target, currentHotkeys[target]);



                return;



            }



            const chordStr = chord.join("+");



            const conflictKey = (Object.keys(currentHotkeys) as HotkeyKey[]).find((k) => {



                if (k === target) return false;



                const existing = currentHotkeys[k];



                return existing && existing.join("+") === chordStr;



            });



            if (conflictKey) {



                showToast(t("config.client.hotkeys.conflict" as TranslationKey), "error");



                captureKeys.clear();



                setHotkeyBadge(target, currentHotkeys[target]);



                return;



            }



            captureKeys.clear();



            void persistHotkey(target, chord);



        };



        const onCaptureKeyDown = (e: KeyboardEvent) => {



            if (!captureActive || !captureTarget)



                return;



            e.preventDefault();



            e.stopPropagation();



            captureKeys.add(e.key);



            const snapshot = Array.from(captureKeys);



            const preview = sanitizeHotkeyChord(snapshot);



            setHotkeyBadge(captureTarget, preview ?? (snapshot.length ? snapshot : null));



            if (captureTimer) {



                window.clearTimeout(captureTimer);



                captureTimer = null;



            }



            captureTimer = window.setTimeout(() => finalizeCapture(), 900);



            if (captureKeys.size >= 3) {



                finalizeCapture();



            }



        };



        const onCaptureKeyUp = (e: KeyboardEvent) => {



            if (!captureActive)



                return;



            if (e.key === "Escape") {



                captureKeys.clear();



                stopCapture(true);



            }



        };



        for (const def of hotkeyDefs) {



            const row = el("div", "row hotkeyRow");



            const left = el("div", "rowLeft");



            const label = el("div", "rowName", t(def.label));



            const hint = el("div", "muted", t(def.hint));



            left.append(label, hint);



            const actions = el("div", "rowActions hotkeyActions");



            const badge = el("div", "badge hotkeyBadge");



            const recordBtn = el("button", "btn primary", t("config.client.hotkeys.record" as TranslationKey));



            const clearBtn = el("button", "btn xBtn", "×");



            clearBtn.title = t("config.client.hotkeys.clear" as TranslationKey);



            clearBtn.setAttribute("aria-label", t("config.client.hotkeys.clear" as TranslationKey));



            actions.append(badge, clearBtn, recordBtn);



            row.append(left, actions);



            hotkeyRowsContainer.append(row);



            hotkeyUi[def.key] = { badge: badge as HTMLDivElement, recordBtn: recordBtn as HTMLButtonElement, clearBtn: clearBtn as HTMLButtonElement };



            recordBtn.addEventListener("click", () => {



                if (captureActive && captureTarget === def.key) {



                    stopCapture(true);



                    return;



                }



                stopCapture(true);



                captureKeys = new Set<string>();



                captureActive = true;



                captureTarget = def.key;



                // Pause global hotkeys so they don't intercept key presses during recording



                window.api?.hotkeysPause?.().catch(() => undefined);



                showToast(t("config.client.hotkeys.recordHint" as TranslationKey), "info");



                recordBtn.textContent = t("config.client.hotkeys.recording" as TranslationKey);



                setHotkeyBadge(def.key, null);



                window.addEventListener("keydown", onCaptureKeyDown, true);



                window.addEventListener("keyup", onCaptureKeyUp, true);



            });



            clearBtn.addEventListener("click", () => {



                stopCapture(true);



                setHotkeyBadge(def.key, null);



                void persistHotkey(def.key, null);



            });



        }



        // Patchnotes pane



        const patchnotesPane = el("div", "patchnotesPane configPaneCard");



        const patchnotesContent = el("div", "patchnotesContent");



        patchnotesPane.append(patchnotesContent);



        // Documentation pane



        const docsPane = el("div", "docsPane configPaneCard");



        const docsContent = el("div", "docsContent");



        docsPane.append(docsContent);



        // Support pane



        const supportPane = el("div", "supportPane configPaneCard");



        const supportTitle = el("div", "sectionTitle", t("config.support.title" as TranslationKey));



        const supportText = el("div", "muted", t("config.support.text" as TranslationKey));



        const supportActions = el("div", "supportActions");



        const supportBtn = document.createElement("a");



        supportBtn.className = "btn primary supportBtn";



        supportBtn.href = DONATION_URL;



        supportBtn.target = "_blank";



        supportBtn.rel = "noreferrer";



        supportBtn.textContent = t("config.support.button" as TranslationKey);



        const supportThanks = el("div", "muted", t("config.support.thanks" as TranslationKey));



        supportActions.append(supportBtn, supportThanks);



        supportPane.append(supportTitle, supportText, supportActions);



        // Tab content



        content.append(stylePane, pluginsPane, clientPane, patchnotesPane, docsPane, supportPane);



        const refreshClientSettings = async () => {



            const revisionAtRequest = hotkeyRevision;



            const settings = await loadClientSettings();



            fullscreenCheckbox.checked = settings.startFullscreen;



            delayInput.value = String(settings.layoutDelaySeconds ?? DEFAULT_CLIENT_SETTINGS.layoutDelaySeconds);



            toastInput.value = String(settings.toastDurationSeconds ?? DEFAULT_CLIENT_SETTINGS.toastDurationSeconds);



            launcherWidthInput.value = String(settings.launcherWidth ?? DEFAULT_CLIENT_SETTINGS.launcherWidth);



            launcherHeightInput.value = String(settings.launcherHeight ?? DEFAULT_CLIENT_SETTINGS.launcherHeight);



            setSliderBadge(delayInput, delayValue, (v) => `${v}s`);



            setSliderBadge(toastInput, toastValue, (v) => `${v}s`);



            setSliderBadge(launcherWidthInput, launcherWidthValue, (v) => `${v}px`);



            setSliderBadge(launcherHeightInput, launcherHeightValue, (v) => `${v}px`);



            setToastDurationSeconds(settings.toastDurationSeconds ?? DEFAULT_CLIENT_SETTINGS.toastDurationSeconds);



            seqToggle.set(settings.seqGridLoad ?? DEFAULT_CLIENT_SETTINGS.seqGridLoad);



            setSequentialGridLoad(settings.seqGridLoad ?? DEFAULT_CLIENT_SETTINGS.seqGridLoad);



            tabDisplaySelect.value = settings.tabLayoutDisplay ?? DEFAULT_CLIENT_SETTINGS.tabLayoutDisplay;



            setLayoutTabDisplay(settings.tabLayoutDisplay ?? DEFAULT_CLIENT_SETTINGS.tabLayoutDisplay);



            gridBorderToggle.set(settings.gridActiveBorder ?? DEFAULT_CLIENT_SETTINGS.gridActiveBorder);



            autoSaveToggle.set(settings.autoSaveLayouts ?? DEFAULT_CLIENT_SETTINGS.autoSaveLayouts);



            setAutoSaveLayouts(settings.autoSaveLayouts ?? DEFAULT_CLIENT_SETTINGS.autoSaveLayouts);



            if (revisionAtRequest === hotkeyRevision) {



                applyHotkeyState(settings);



            }



        };



        refreshClientSettings().catch(() => undefined);



        fullscreenCheckbox.addEventListener("change", async () => {



            const next = fullscreenCheckbox.checked;



            try {



                await patchClientSettings({ startFullscreen: next });



                showToast(t("config.client.fullscreenSaved"), "success");



            }



            catch (err) {



                showToast(String(err), "error");



                const current = await loadClientSettings();



                fullscreenCheckbox.checked = current.startFullscreen;



            }



        });



        tabDisplaySelect.addEventListener("change", async () => {



            const next = normalizeTabLayoutDisplay(tabDisplaySelect.value);



            try {



                await patchClientSettings({ tabLayoutDisplay: next });



                setLayoutTabDisplay(next);



                showToast(t("config.client.tabLayoutDisplay.saved" as TranslationKey), "success");



            }



            catch (err) {



                showToast(String(err), "error");



                const current = await loadClientSettings();



                const fallback = normalizeTabLayoutDisplay(current?.tabLayoutDisplay);



                tabDisplaySelect.value = fallback;



                setLayoutTabDisplay(fallback);



            }



        });



        delayInput.addEventListener("change", async () => {



            const next = clampLayoutDelaySeconds(delayInput.valueAsNumber);



            delayInput.value = String(next);



            setSliderBadge(delayInput, delayValue, (v) => `${v}s`);



            try {



                await patchClientSettings({ layoutDelaySeconds: next });



                setLayoutDelaySeconds(next);



                showToast(t("config.client.layoutDelaySaved"), "success");



            }



            catch (err) {



                showToast(String(err), "error");



                const current = await loadClientSettings();



                const fallback = clampLayoutDelaySeconds(current?.layoutDelaySeconds);



                delayInput.value = String(fallback);



                setSliderBadge(delayInput, delayValue, (v) => `${v}s`);



                setLayoutDelaySeconds(fallback);



            }



        });



        toastInput.addEventListener("change", async () => {



            const next = clampToastDurationSeconds(toastInput.valueAsNumber);



            toastInput.value = String(next);



            setSliderBadge(toastInput, toastValue, (v) => `${v}s`);



            try {



                await patchClientSettings({ toastDurationSeconds: next });



                setToastDurationSeconds(next);



                showToast(t("config.client.toastDurationSaved"), "success");



            }



            catch (err) {



                showToast(String(err), "error");



                const current = await loadClientSettings();



                const fallback = clampToastDurationSeconds(current?.toastDurationSeconds);



                toastInput.value = String(fallback);



                setSliderBadge(toastInput, toastValue, (v) => `${v}s`);



                setToastDurationSeconds(fallback);



            }



        });



        seqCheckbox.addEventListener("change", async () => {



            const next = !!seqCheckbox.checked;



            try {



                await patchClientSettings({ seqGridLoad: next });



                setSequentialGridLoad(next);



                showToast(t("config.client.seqGridLoadSaved"), "success");



            }



            catch (err) {



                showToast(String(err), "error");



                const current = await loadClientSettings();



                seqToggle.set(current?.seqGridLoad ?? DEFAULT_CLIENT_SETTINGS.seqGridLoad);



                setSequentialGridLoad(current?.seqGridLoad ?? DEFAULT_CLIENT_SETTINGS.seqGridLoad);



            }



        });



        gridBorderCheckbox.addEventListener("change", async () => {



            const next = !!gridBorderCheckbox.checked;



            try {



                await patchClientSettings({ gridActiveBorder: next });



                showToast(t("config.client.gridActiveBorderSaved" as TranslationKey), "success");



            }



            catch (err) {



                showToast(String(err), "error");



                const current = await loadClientSettings();



                gridBorderToggle.set(current?.gridActiveBorder ?? DEFAULT_CLIENT_SETTINGS.gridActiveBorder);



            }



        });



        autoSaveCheckbox.addEventListener("change", async () => {



            const next = !!autoSaveCheckbox.checked;



            try {



                await patchClientSettings({ autoSaveLayouts: next });



                setAutoSaveLayouts(next);



                showToast(t("config.client.layoutAutoSaveSaved" as TranslationKey), "success");



            }



            catch (err) {



                showToast(String(err), "error");



                const current = await loadClientSettings();



                const fallback = current?.autoSaveLayouts ?? DEFAULT_CLIENT_SETTINGS.autoSaveLayouts;



                autoSaveToggle.set(fallback);



                setAutoSaveLayouts(fallback);



            }



        });



        launcherWidthInput.addEventListener("change", async () => {



            const next = clampLauncherWidthPx(launcherWidthInput.valueAsNumber);



            launcherWidthInput.value = String(next);



            setSliderBadge(launcherWidthInput, launcherWidthValue, (v) => `${v}px`);



            try {



                await patchClientSettings({ launcherWidth: next });



                showToast(t("config.client.launcherSizeSaved" as TranslationKey), "success");



            }



            catch (err) {



                showToast(String(err), "error");



                const current = await loadClientSettings();



                launcherWidthInput.value = String(current?.launcherWidth ?? DEFAULT_CLIENT_SETTINGS.launcherWidth);



                setSliderBadge(launcherWidthInput, launcherWidthValue, (v) => `${v}px`);



            }



        });



        launcherHeightInput.addEventListener("change", async () => {



            const next = clampLauncherHeightPx(launcherHeightInput.valueAsNumber);



            launcherHeightInput.value = String(next);



            setSliderBadge(launcherHeightInput, launcherHeightValue, (v) => `${v}px`);



            try {



                await patchClientSettings({ launcherHeight: next });



                showToast(t("config.client.launcherSizeSaved" as TranslationKey), "success");



            }



            catch (err) {



                showToast(String(err), "error");



                const current = await loadClientSettings();



                launcherHeightInput.value = String(current?.launcherHeight ?? DEFAULT_CLIENT_SETTINGS.launcherHeight);



                setSliderBadge(launcherHeightInput, launcherHeightValue, (v) => `${v}px`);



            }



        });



        body.append(tabs, content);



        // Simple markdown to HTML converter for patchnotes



        function markdownToHtml(md: string): string {



            return md



                // Escape HTML first



                .replace(/&/g, "&amp;")



                .replace(/</g, "&lt;")



                .replace(/>/g, "&gt;")



                // Headers



                .replace(/^### (.+)$/gm, "<h3>$1</h3>")



                .replace(/^## (.+)$/gm, "<h2>$1</h2>")



                .replace(/^# (.+)$/gm, "<h1>$1</h1>")



                // Bold



                .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")



                // Italic



                .replace(/\*(.+?)\*/g, "<em>$1</em>")



                // Inline code



                .replace(/`([^`]+)`/g, "<code>$1</code>")



                // Horizontal rule



                .replace(/^---$/gm, "<hr>")



                // List items



                .replace(/^- (.+)$/gm, "<li>$1</li>")



                // Wrap consecutive list items in ul



                .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)



                // Paragraphs (lines that are not already wrapped)



                .replace(/^(?!<\/?[h1-6ul]|<li|<hr)(.+)$/gm, "<p>$1</p>")



                // Clean up empty paragraphs



                .replace(/<p><\/p>/g, "")



                // Clean up newlines



                .replace(/\n/g, "");



        }



        // Extended markdown to HTML converter for documentation with accordions, images, videos



        function markdownToHtmlExtended(md: string, assetsPath: string): string {

            // Ensure trailing newline so the last accordion close marker is found
            if (!md.endsWith("\n")) md += "\n";

            // Parse accordions (supports nesting via recursive call)



            const accordionRegex = /(^|\n)(:{3,})accordion\[([^\]]+)\]/g;



            let processed = "";



            let lastPos = 0;



            let hadAccordion = false;



            let match: RegExpExecArray | null;



            while ((match = accordionRegex.exec(md))) {



                const start = match.index + match[1].length; // exclude leading newline (if any)



                const colons = match[2];



                const title = match[3];



                const headerEnd = accordionRegex.lastIndex;



                const closeMarker = `\n${colons}\n`;



                const closeIdx = md.indexOf(closeMarker, headerEnd);



                if (closeIdx === -1) {



                    continue; // unmatched - skip



                }



                const content = md.slice(headerEnd, closeIdx);



                processed += processDocContent(md.slice(lastPos, start), assetsPath);


                const body = markdownToHtmlExtended(content.trim(), assetsPath);



                processed += `<details class="docAccordion"><summary class="docAccordionHeader"><span class="docAccordionTitle">${escapeHtml(title)}</span><span class="docAccordionIcon">&#9654;</span></summary><div class="docAccordionContent">${body}</div></details>`;



                lastPos = closeIdx + closeMarker.length;



                accordionRegex.lastIndex = lastPos;



                hadAccordion = true;



            }



            processed += processDocContent(md.slice(lastPos), assetsPath);


            // Process info boxes



            const beforeInfo = processed;



            processed = processed.replace(



                /:::info\n([\s\S]*?):::/g,



                (_match, content) => `<div class="docInfoBox">${processDocContent(content.trim(), assetsPath)}</div>`



            );



            // Process warning boxes



            const beforeWarn = processed;

            processed = processed.replace(

                /:::warning\n([\s\S]*?):::/g,

                (_match, content) => `<div class="docWarningBox">${processDocContent(content.trim(), assetsPath)}</div>`

            );

            // processed is already normalized via processDocContent above.
            // Returning it directly avoids double-processing (which escaped HTML tags inside accordions).
            return processed;



        }



        function escapeHtml(str: string): string {



            return str



                .replace(/&/g, "&amp;")



                .replace(/</g, "&lt;")



                .replace(/>/g, "&gt;");



        }



        function processDocContent(md: string, assetsPath: string): string {



            let html = md



                // Escape HTML first



                .replace(/&/g, "&amp;")



                .replace(/</g, "&lt;")



                .replace(/>/g, "&gt;");



            // YouTube embeds ::youtube[VIDEO_ID]



            html = html.replace(



                /::youtube\[([^\]]+)\]/g,



                (_match, videoId) => `<div class="docYoutube"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`



            );



            // Helper to convert Windows paths to file:// URLs



            const toFileUrl = (filePath: string) => {



                // Convert backslashes to forward slashes and ensure proper file:// format



                const normalized = filePath.replace(/\\/g, "/");



                // Windows paths need file:/// (three slashes)



                return `file:///${normalized.replace(/^\/+/, "")}`;



            };



            // Local video embeds ::video[path.mp4]



            html = html.replace(



                /::video\[([^\]]+)\]/g,



                (_match, videoPath) => {



                    const fullPath = videoPath.startsWith("http") ? videoPath : toFileUrl(`${assetsPath}/videos/${videoPath}`);



                    return `<div class="docVideo"><video controls><source src="${fullPath}" type="video/mp4">Your browser does not support the video tag.</video></div>`;



                }



            );



            // Images ![alt](src) - supports data: URLs (base64), http(s) URLs, and local files



            html = html.replace(



                /!\[([^\]]*)\]\(([^)]+)\)/g,



                (_match, alt, src) => {



                    // data: URLs and http(s) URLs are used directly



                    const fullSrc = (src.startsWith("data:") || src.startsWith("http"))



                        ? src



                        : toFileUrl(`${assetsPath}/screenshots/${src}`);



                    return `<img class="docImage" src="${fullSrc}" alt="${escapeHtml(alt)}" loading="lazy">`;



                }



            );



            // Links [text](url)



            html = html.replace(



                /\[([^\]]+)\]\(([^)]+)\)/g,



                (_match, text, url) => {
                    if (url.startsWith("action:")) {
                        return `<a href="#" data-action="${escapeHtml(url.slice(7))}" class="docActionLink">${escapeHtml(text)}</a>`;
                    }
                    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
                }



            );



            // Tables (simple markdown tables)



            html = html.replace(/^\|(.+)\|$/gm, (match) => {



                const cells = match.slice(1, -1).split("|").map(c => c.trim());



                const isHeader = cells.every(c => /^-+$/.test(c));



                if (isHeader) return ""; // Skip separator row



                const cellTag = "td";



                const cellsHtml = cells.map(c => `<${cellTag}>${c}</${cellTag}>`).join("");



                return `<tr>${cellsHtml}</tr>`;



            });



            // Wrap table rows



            html = html.replace(/(<tr>.*<\/tr>\n?)+/g, (match) => `<table class="docTable">${match}</table>`);



            // Headers



            html = html



                .replace(/^### (.+)$/gm, "<h3>$1</h3>")



                .replace(/^## (.+)$/gm, "<h2>$1</h2>")



                .replace(/^# (.+)$/gm, "<h1>$1</h1>");



            // Bold



            html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");



            // Italic



            html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");



            // Inline code



            html = html.replace(/`([^`]+)`/g, "<code>$1</code>");



            // Horizontal rule



            html = html.replace(/^---$/gm, "<hr>");



            // List items



            html = html.replace(/^- (.+)$/gm, "<li>$1</li>");



            // Numbered list items



            html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");



            // Wrap consecutive list items in ul



            html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);



            // Paragraphs (lines that are not already wrapped)



            html = html.replace(/^(?!<\/?[h1-6ulotda]|<li|<hr|<img|<div|<table|<tr)(.+)$/gm, "<p>$1</p>");



            // Clean up empty paragraphs



            html = html.replace(/<p><\/p>/g, "");



            // Clean up newlines



            html = html.replace(/\n/g, "");



            return html;



        }



        // Load patchnotes content



        async function loadPatchnotes() {



            patchnotesContent.innerHTML = "<div class='muted'>Loading...</div>";



            try {



                const md = await window.api.patchnotesGet(currentLocale);



                patchnotesContent.innerHTML = markdownToHtml(md);



            } catch (err) {



                patchnotesContent.innerHTML = `<div class='muted'>Error loading patchnotes: ${String(err)}</div>`;



            }



        }



        // Load documentation content



        async function loadDocumentation() {



            docsContent.innerHTML = "<div class='muted'>Loading...</div>";



            try {



                const { content, assetsPath } = await window.api.documentationGet(currentLocale);



                docsContent.innerHTML = markdownToHtmlExtended(content, assetsPath);




                // Add click handlers for action links (e.g. action:openPlugin:api-fetch)
                docsContent.querySelectorAll<HTMLAnchorElement>(".docActionLink").forEach((link) => {
                    link.addEventListener("click", async (e) => {
                        e.preventDefault();
                        const action = link.dataset.action ?? "";
                        if (action.startsWith("openPlugin:")) {
                            const pluginId = action.slice("openPlugin:".length);
                            try {
                                await window.api.pluginsInvokeChannel(pluginId, "ui:launch");
                            } catch (err) {
                                showToast(String(err), "error");
                            }
                        }
                    });
                });



            } catch (err) {



                docsContent.innerHTML = `<div class='muted'>Error loading documentation: ${String(err)}</div>`;



            }



        }



        // Main tab switching



        function selectMainTab(tab: "style" | "plugins" | "client" | "patchnotes" | "docs" | "support") {



            tabStyle.classList.toggle("active", tab === "style");



            tabPlugins.classList.toggle("active", tab === "plugins");



            tabClient.classList.toggle("active", tab === "client");



            tabPatchnotes.classList.toggle("active", tab === "patchnotes");



            tabDocs.classList.toggle("active", tab === "docs");



            tabSupport.classList.toggle("active", tab === "support");



            stylePane.style.display = tab === "style" ? "" : "none";



            pluginsPane.style.display = tab === "plugins" ? "" : "none";



            clientPane.style.display = tab === "client" ? "" : "none";



            patchnotesPane.style.display = tab === "patchnotes" ? "" : "none";



            docsPane.style.display = tab === "docs" ? "" : "none";



            supportPane.style.display = tab === "support" ? "" : "none";



            if (tab === "plugins") {



                loadPluginsList();



            }



            if (tab === "patchnotes") {



                loadPatchnotes();



            }



            if (tab === "docs") {



                loadDocumentation();



            }



        }



        tabStyle.addEventListener("click", () => selectMainTab("style"));



        tabPlugins.addEventListener("click", () => selectMainTab("plugins"));



        tabClient.addEventListener("click", () => selectMainTab("client"));



        tabPatchnotes.addEventListener("click", () => selectMainTab("patchnotes"));



        tabDocs.addEventListener("click", () => selectMainTab("docs"));



        tabSupport.addEventListener("click", () => selectMainTab("support"));



        // Load and render plugins list



        async function loadPluginsList() {



            pluginsList.innerHTML = "";



            pluginsEmpty.style.display = "none";



            const loadingEl = el("div", "pluginsLoading muted", t("config.plugins.status.loading" as TranslationKey));



            pluginsList.append(loadingEl);



            try {



                const plugins = await window.api.pluginsListAll();



                pluginsList.innerHTML = "";



                if (!plugins || plugins.length === 0) {



                    pluginsEmpty.style.display = "";



                    return;



                }



                for (const plugin of plugins) {



                    const isKillfeed = plugin.id === "killfeed";



                    const card = el("div", "pluginCard");



                    const cardHeader = el("div", "pluginCardHeader");



                    const info = el("div", "pluginInfo");



                    const name = el("div", "pluginName", plugin.name);



                    const version = el("span", "pluginVersion", `v${plugin.version}`);



                    name.append(version);



                    if (plugin.author) {



                        const author = el("div", "pluginAuthor muted", plugin.author);



                        info.append(name, author);



                    } else {



                        info.append(name);



                    }



                    const status = el("div", `pluginStatus ${getStatusClass(plugin.state, plugin.enabled)}`,



                        getStatusText(plugin.state, plugin.enabled));



                    cardHeader.append(info, status);



                    // Try to get translated description, fall back to manifest description



                    const descKey = `plugin.${plugin.id}.description` as TranslationKey;



                    const translatedDesc = t(descKey);



                    const descText = translatedDesc !== descKey ? translatedDesc : plugin.description;



                    if (descText) {



                        const desc = el("div", "pluginDescription muted", descText);



                        card.append(cardHeader, desc);



                    } else {



                        card.append(cardHeader);



                    }



                    // Action buttons



                    const actions = el("div", "pluginActions");



                    if (!isKillfeed && plugin.hasSettingsUI && plugin.permissions?.includes("settings:ui") && plugin.enabled) {



                        const uiBtn = el("button", "btn pluginBtn", t("config.plugins.openUI" as TranslationKey));



                        uiBtn.addEventListener("click", async () => {



                            // Directly launch Python UI without dialog



                            uiBtn.disabled = true;



                            status.textContent = t("config.plugins.status.working");



                            status.className = "pluginStatus loading";



                            try {



                                const result = await window.api.pluginsInvokeChannel(plugin.id, "ui:launch");



                                if (result && (result as { ok?: boolean }).ok) {



                                    showToast(t("config.plugins.uiStarted"), "success");



                                } else {



                                    showToast((result as { error?: string })?.error || t("config.plugins.uiError"), "error");



                                }



                            } catch (err) {



                                showToast(String(err), "error");



                            } finally {



                                uiBtn.disabled = false;



                                status.textContent = getStatusText(plugin.state, plugin.enabled);



                                status.className = `pluginStatus ${getStatusClass(plugin.state, plugin.enabled)}`;



                            }



                        });



                        actions.append(uiBtn);



                    }



                    if (plugin.enabled) {



                        const disableBtn = el("button", "btn pluginBtn", t("config.plugins.disable" as TranslationKey));



                        disableBtn.addEventListener("click", async () => {



                            disableBtn.disabled = true;



                            const result = await window.api.pluginsDisable(plugin.id);



                            if (result.success) {



                                showToast(`${plugin.name}: ${t("config.plugins.pluginDisabled" as TranslationKey)}`, "success");



                                loadPluginsList();



                            } else {



                                showToast(result.error || t("config.plugins.pluginError" as TranslationKey), "error");



                                disableBtn.disabled = false;



                            }



                        });



                        actions.append(disableBtn);



                    } else {



                        const enableBtn = el("button", "btn primary pluginBtn", t("config.plugins.enable" as TranslationKey));



                        enableBtn.addEventListener("click", async () => {



                            enableBtn.disabled = true;



                            const result = await window.api.pluginsEnable(plugin.id);



                            if (result.success) {



                                showToast(`${plugin.name}: ${t("config.plugins.pluginEnabled" as TranslationKey)}`, "success");



                                loadPluginsList();



                            } else {



                                showToast(result.error || t("config.plugins.pluginError" as TranslationKey), "error");



                                enableBtn.disabled = false;



                            }



                        });



                        actions.append(enableBtn);



                    }



                    card.append(actions);



                    // Error display



                    if (!isKillfeed && plugin.error) {



                        const errorEl = el("div", "pluginError", plugin.error);



                        card.append(errorEl);



                    }



                    pluginsList.append(card);



                }



            } catch (err) {



                pluginsList.innerHTML = "";



                const errorEl = el("div", "pluginsError muted", String(err));



                pluginsList.append(errorEl);



            }



        }



        function getStatusClass(state: string, enabled: boolean): string {



            if (!enabled) return "disabled";



            if (state === "running") return "running";



            if (state === "error") return "error";



            if (state === "loading" || state === "starting" || state === "initializing") return "loading";



            return "stopped";



        }



        function getStatusText(state: string, enabled: boolean): string {



            if (!enabled) return t("config.plugins.status.disabled");



            if (state === "running") return t("config.plugins.status.ready");



            if (state === "error") return t("config.plugins.status.error");



            if (state === "loading" || state === "starting" || state === "initializing") return t("config.plugins.status.working");



            return t("config.plugins.status.stopped");



        }



        // Initialize tab state



        selectMainTab(defaultTab);



        modal.append(headerEl, body);



        overlay.append(modal);



        const onKey = (e: KeyboardEvent) => {



            if (e.key === "Escape")



                close();



        };



        const close = () => {



            overlay.remove();



            document.removeEventListener("keydown", onKey);



            const currentHex = isTabActiveColorManual ? lastTabActiveHex : null;



            if (currentHex) {



                setTabActiveColor(currentHex, { manual: true, persist: true });



            }



            pushThemeUpdate(currentTheme, {



                ...getActiveThemeColors(),



                tabActive: currentHex ?? getActiveThemeColors().tabActive,



            });



        };



        headerClose.addEventListener("click", () => close());



        overlay.addEventListener("click", (e) => {



            if (e.target === overlay)



                close();



        });



        document.addEventListener("keydown", onKey);



        function getThemeColors(themeId: string): ThemeColors {



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



        let activeStyleSubTab: "theme" | "tabActive" = defaultStyleTab;



        function buildThemeGrid() {



            const grid = el("div", "themeGrid");



            const themeTitle = (theme: ThemeDefinition) => theme.nameKey ? t(theme.nameKey) : theme.name ?? theme.id;



            const themeDescription = (theme: ThemeDefinition) => theme.descriptionKey ? t(theme.descriptionKey) : theme.description ?? "";



            for (const theme of THEMES) {



                const card = el("div", "themeCard");



                const cardHeader = el("div", "themeCardHeader");



                const titleGroup = el("div", "themeCardTitleGroup");



                const title = el("div", "themeName", themeTitle(theme));



                const badge = el("span", "themeBadge", t("config.theme.active"));



                titleGroup.append(title);



                if (theme.id === currentTheme)



                    titleGroup.append(badge);



                const btn = el(



                    "button",



                    "btn primary themeSelectBtn",



                    theme.id === currentTheme ? t("config.theme.active") : t("config.theme.use")



                ) as HTMLButtonElement;



                cardHeader.append(titleGroup, btn);



                const desc = el("div", "themeDescription", themeDescription(theme));



                const swatches = el("div", "themeSwatches");



                for (const color of theme.swatches ?? []) {



                    const sw = el("div", "themeSwatch");



                    sw.style.background = color;



                    swatches.append(sw);



                }



                btn.disabled = theme.id === currentTheme;



                btn.addEventListener("click", () => {



                    if (theme.id === currentTheme)



                        return;



                    applyTheme(theme.id);



                    const colors = getThemeColors(theme.id);



                    pushThemeUpdate(theme.id, colors);



                    selectStyleSubTab("theme");



                    showToast(`${t("config.theme.applied")}: ${themeTitle(theme)}`, "success");



                });



                card.append(cardHeader, desc, swatches);



                grid.append(card);



            }



            return grid;



        }



        function buildTabColorSection() {



            const tabColorSection = el("div", "tabColorSection");



            const tabColorHeader = el("div", "themeName", t("config.tab.style.activeTabColor"));



            const tabColorDesc = el("div", "themeDescription", t("config.theme.customDesc"));



            const colorPalette = el("div", "colorPalette");



            const colorCategories: { name: string; nameKey?: string; colors: string[] }[] = [



                {



                    name: "Greens",



                    nameKey: "config.color.greens",



                    colors: ["#2ecc71", "#27ae60", "#1abc9c", "#16a085", "#00d4aa", "#00e676", "#69f0ae", "#b9f6ca", "#a8e6cf", "#88d498", "#56ab2f", "#a8caba", "#3d9970", "#2d6a4f"]



                },



                {



                    name: "Blues",



                    nameKey: "config.color.blues",



                    colors: ["#3498db", "#2980b9", "#0984e3", "#74b9ff", "#00cec9", "#81ecec", "#48dbfb", "#0abde3", "#54a0ff", "#5f27cd", "#341f97", "#00b4d8", "#0077b6", "#023e8a"]



                },



                {



                    name: "Purples",



                    nameKey: "config.color.purples",



                    colors: ["#9b59b6", "#8e44ad", "#a55eea", "#d63384", "#e056fd", "#be2edd", "#f368e0", "#ff9ff3", "#c44569", "#cf6a87", "#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd"]



                },



                {



                    name: "Pinks & Reds",



                    nameKey: "config.color.pinksReds",



                    colors: ["#e74c3c", "#c0392b", "#ff6b6b", "#ee5a5a", "#fc5c65", "#eb3b5a", "#ff4757", "#ff6348", "#ff7675", "#fab1a0", "#fd79a8", "#f8a5c2", "#e84393", "#b83280"]



                },



                {



                    name: "Oranges & Yellows",



                    nameKey: "config.color.orangesYellows",



                    colors: ["#f39c12", "#e67e22", "#d35400", "#f7ba48", "#f3c65d", "#e0ac3a", "#ffc312", "#f9ca24", "#fdcb6e", "#ffeaa7", "#ff9f43", "#ee5a24", "#fa8231", "#fed330"]



                },



                {



                    name: "Cyans & Teals",



                    nameKey: "config.color.cyansTeal",



                    colors: ["#00bcd4", "#00acc1", "#0097a7", "#26c6da", "#4dd0e1", "#80deea", "#18dcff", "#7efff5", "#00cec9", "#55efc4", "#00b894", "#20bf6b", "#26de81", "#0fb9b1"]



                },



                {



                    name: "Neons",



                    nameKey: "config.color.neons",



                    colors: ["#ff00ff", "#00ffff", "#ff00aa", "#00ff88", "#ffff00", "#ff3366", "#33ff99", "#9933ff", "#ff6600", "#00ff00", "#ff0066", "#66ff00", "#0066ff", "#ff0099"]



                },



                {



                    name: "Pastels",



                    nameKey: "config.color.pastels",



                    colors: ["#dfe6e9", "#b2bec3", "#a29bfe", "#74b9ff", "#55efc4", "#81ecec", "#ffeaa7", "#fab1a0", "#ff7675", "#fd79a8", "#e17055", "#fdcb6e", "#00b894", "#6c5ce7"]



                }



            ];



            const gradients: { name: string; gradient: string; baseColor: string }[] = [



                { name: "Sunset", gradient: "linear-gradient(135deg, #f093fb, #f5576c)", baseColor: "#f5576c" },



                { name: "Ocean", gradient: "linear-gradient(135deg, #4facfe, #00f2fe)", baseColor: "#4facfe" },



                { name: "Aurora", gradient: "linear-gradient(135deg, #43e97b, #38f9d7)", baseColor: "#43e97b" },



                { name: "Neon Pink", gradient: "linear-gradient(135deg, #f953c6, #b91d73)", baseColor: "#f953c6" },



                { name: "Electric", gradient: "linear-gradient(135deg, #0066ff, #00ffcc)", baseColor: "#0066ff" },



                { name: "Fire", gradient: "linear-gradient(135deg, #f12711, #f5af19)", baseColor: "#f5af19" },



                { name: "Purple Haze", gradient: "linear-gradient(135deg, #7f00ff, #e100ff)", baseColor: "#7f00ff" },



                { name: "Lime", gradient: "linear-gradient(135deg, #b4ec51, #429321)", baseColor: "#b4ec51" },



                { name: "Cotton Candy", gradient: "linear-gradient(135deg, #ffecd2, #fcb69f)", baseColor: "#fcb69f" },



                { name: "Midnight", gradient: "linear-gradient(135deg, #232526, #414345)", baseColor: "#414345" },



                { name: "Royal", gradient: "linear-gradient(135deg, #141e30, #243b55)", baseColor: "#243b55" },



                { name: "Peach", gradient: "linear-gradient(135deg, #ffecd2, #fcb69f)", baseColor: "#fcb69f" },



                { name: "Aqua", gradient: "linear-gradient(135deg, #13547a, #80d0c7)", baseColor: "#80d0c7" },



                { name: "Berry", gradient: "linear-gradient(135deg, #8e2de2, #4a00e0)", baseColor: "#8e2de2" },



                { name: "Cyber", gradient: "linear-gradient(135deg, #00d2ff, #3a7bd5)", baseColor: "#00d2ff" },



                { name: "Warm", gradient: "linear-gradient(135deg, #f7971e, #ffd200)", baseColor: "#f7971e" },



                { name: "Cool", gradient: "linear-gradient(135deg, #2193b0, #6dd5ed)", baseColor: "#2193b0" },



                { name: "Emerald", gradient: "linear-gradient(135deg, #11998e, #38ef7d)", baseColor: "#38ef7d" },



                { name: "Rose Gold", gradient: "linear-gradient(135deg, #f4c4f3, #fc67fa)", baseColor: "#fc67fa" },



                { name: "Titanium", gradient: "linear-gradient(135deg, #283048, #859398)", baseColor: "#859398" }



            ];



            const tabColorInput = document.createElement("input");



            tabColorInput.type = "color";



            const setActiveSwatch = (btn: HTMLButtonElement | null, hex: string) => {



                const stroke = getComputedStyle(document.documentElement).getPropertyValue("--stroke")?.trim() || "#3f4046";



                const norm = normalizeHex(hex);



                for (const swatch of Array.from(colorPalette.querySelectorAll(".tabColorSwatch"))) {



                    const elBtn = swatch as HTMLButtonElement;



                    elBtn.classList.remove("active");



                    elBtn.style.borderColor = stroke;



                    elBtn.style.boxShadow = "";



                }



                const target = btn ?? (colorPalette.querySelector(`[data-color="${norm}"]`) as HTMLButtonElement | null);



                if (target) {



                    target.classList.add("active");



                    target.style.borderColor = `rgba(${getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb") || "255,255,255"},0.9)`;



                    target.style.boxShadow = `0 0 0 3px rgba(${getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb") || "255,255,255"},0.6),



                        0 0 0 6px rgba(${getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb") || "255,255,255"},0.16),



                        0 2px 8px rgba(0,0,0,0.3)`;



                }



            };



            const applyTabColor = (hex: string, clicked?: HTMLButtonElement | null) => {



                tabColorHeader.textContent = `${t("config.tab.style.activeTabColor")}: ${hex.toUpperCase()}`;



                setTabActiveColor(hex, { manual: true, persist: true });



                pushThemeUpdate(currentTheme, { ...getActiveThemeColors(), tabActive: hex });



                tabColorInput.value = rgbToHex(hex);



                setActiveSwatch(clicked ?? null, rgbToHex(hex));



                showToast(t("config.theme.applied"), "success");



            };



            const syncSwatchState = () => {



                const currentHex = (isTabActiveColorManual && lastTabActiveHex) ? lastTabActiveHex : rgbToHex(getActiveThemeColors().tabActive);



                tabColorInput.value = currentHex;



                tabColorHeader.textContent = `${t("config.tab.style.activeTabColor")}: ${currentHex.toUpperCase()}`;



                setActiveSwatch(null, currentHex);



            };



            tabColorInput.value = (isTabActiveColorManual && lastTabActiveHex) ? lastTabActiveHex : rgbToHex(getActiveThemeColors().tabActive);



            for (const category of colorCategories) {



                const categorySection = el("div", "colorCategory");



                const categoryHeader = el("div", "colorCategoryHeader", category.nameKey ? t(category.nameKey as TranslationKey) : category.name);



                const swatchRow = el("div", "tabColorSwatches");



                for (const color of category.colors) {



                    const b = el("button", "tabColorSwatch");



                    b.type = "button";



                    b.style.background = color;



                    b.dataset.color = normalizeHex(color);



                    b.addEventListener("click", () => applyTabColor(color, b));



                    swatchRow.append(b);



                }



                categorySection.append(categoryHeader, swatchRow);



                colorPalette.append(categorySection);



            }



            const gradientSection = el("div", "colorCategory gradientCategory");



            const gradientHeader = el("div", "colorCategoryHeader", t("config.color.gradients" as TranslationKey) || "Gradients");



            const gradientRow = el("div", "tabColorSwatches gradientSwatches");



            for (const grad of gradients) {



                const b = el("button", "tabColorSwatch gradientSwatch");



                b.type = "button";



                b.style.background = grad.gradient;



                b.dataset.color = normalizeHex(grad.baseColor);



                b.title = grad.name;



                b.addEventListener("click", () => applyTabColor(grad.baseColor, b));



                gradientRow.append(b);



            }



            gradientSection.append(gradientHeader, gradientRow);



            colorPalette.append(gradientSection);



            tabColorInput.addEventListener("input", () => applyTabColor(tabColorInput.value));



            const resetTabColor = el("button", "btn", t("config.tabActive.reset"));



            resetTabColor.addEventListener("click", () => {



                setTabActiveColor(null, { manual: false });



                persistTabActiveColor(null);



                applyTheme(currentTheme);



                pushThemeUpdate(currentTheme, getActiveThemeColors());



                syncSwatchState();



            });



            const tabColorControls = el("div", "tabColorControls");



            tabColorControls.append(tabColorInput, resetTabColor);



            tabColorSection.append(tabColorHeader, tabColorDesc, colorPalette, tabColorControls);



            syncSwatchState();



            return tabColorSection;



        }



        function renderStyleContent() {



            styleContentBody.innerHTML = "";



            if (activeStyleSubTab === "tabActive") {



                styleContentBody.append(buildTabColorSection());



            }



            else {



                styleContentBody.append(buildThemeGrid());



            }



        }



        function selectStyleSubTab(tab: "theme" | "tabActive") {



            activeStyleSubTab = tab;



            subTabTheme.classList.toggle("active", tab === "theme");



            subTabTabColor.classList.toggle("active", tab === "tabActive");



            renderStyleContent();



        }



        subTabTheme.addEventListener("click", () => selectStyleSubTab("theme"));



        subTabTabColor.addEventListener("click", () => selectStyleSubTab("tabActive"));



        selectStyleSubTab(defaultStyleTab);



        document.body.append(overlay);



    }



    const btnFlyffuniverse = el("button", "btn primary") as HTMLButtonElement;



    btnFlyffuniverse.title = "Flyffuniverse öffnen";



    const flyffuniverseImg = document.createElement("img");



    flyffuniverseImg.src = flyffuniverseIcon;



    flyffuniverseImg.alt = "Flyffuniverse";



    flyffuniverseImg.style.width = "64x";



    flyffuniverseImg.style.height = "32px";



    btnFlyffuniverse.style.width = "128px";



    btnFlyffuniverse.style.height = "32px";



    btnFlyffuniverse.append(flyffuniverseImg);



    btnFlyffuniverse.addEventListener("click", () => {



        window.open("https://universe.flyff.com/", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768");



    });



    header.append(btnFlyffuniverse);



    const btnFlyffipedia = el("button", "btn primary") as HTMLButtonElement;



    btnFlyffipedia.title = "Flyffipedia öffnen";



    const flyffipediaImg = document.createElement("img");



    flyffipediaImg.src = flyffipediaIcon;



    flyffipediaImg.alt = "Flyffipedia";



    flyffipediaImg.style.width = "64x";



    flyffipediaImg.style.height = "32px";



    btnFlyffipedia.style.width = "128px";



    btnFlyffipedia.style.height = "32px";



    btnFlyffipedia.append(flyffipediaImg);



    btnFlyffipedia.addEventListener("click", () => {



        window.open("https://flyffipedia.com/home", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768");



    });



    header.append(btnFlyffipedia);



    const btnFlyffulator = el("button", "btn primary pink-text") as HTMLButtonElement;



    btnFlyffulator.title = "Flyffulator öffnen";



    const flyffulatorImg = document.createElement("img");



    flyffulatorImg.src = flyffulatorIcon;



    flyffulatorImg.alt = "Flyffulator";



    flyffulatorImg.style.width = "32px";



    flyffulatorImg.style.height = "32px";



    flyffulatorImg.style.marginRight = "0px";



    const btnText = document.createElement("span");



    btnText.textContent = "Flyffulator";


    btnFlyffulator.style.display = "flex";



    btnFlyffulator.style.alignItems = "center";



    btnFlyffulator.style.justifyContent = "center";



    btnFlyffulator.style.padding = "8px 12px";



    btnFlyffulator.style.height = "40px";



    btnFlyffulator.append(flyffulatorImg, btnText);



    btnFlyffulator.addEventListener("click", () => {



        window.open("https://flyffulator.com/", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768");



    });



    header.append(btnFlyffulator);



    const btnSkillulator = el("button", "btn primary skillulator") as HTMLButtonElement;



    btnSkillulator.title = "Skillulator öffnen";



    const skillulatorImg = document.createElement("img");



    skillulatorImg.src = reskillIcon;



    skillulatorImg.alt = "Skillulator";



    skillulatorImg.style.width = "32px";



    skillulatorImg.style.height = "32px";



    skillulatorImg.style.marginRight = "0px";



    const btnSkillulatorText = document.createElement("span");



    btnSkillulatorText.textContent = "Skillulator";



    btnSkillulatorText.className = "skillulatorLabel";



    btnSkillulator.style.display = "flex";



    btnSkillulator.style.alignItems = "center";



    btnSkillulator.style.justifyContent = "center";



    btnSkillulator.style.padding = "8px 12px";



    btnSkillulator.style.height = "40px";



    btnSkillulator.append(skillulatorImg, btnSkillulatorText);



    btnSkillulator.addEventListener("click", () => {



        window.open("https://skillulator.lol/", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768");



    });



    header.append(btnSkillulator);



    const btnDiscord = el("button", "btn primary") as HTMLButtonElement;



    btnDiscord.title = "Discord-Server beitreten";



    btnDiscord.style.width = "38px";



    btnDiscord.style.height = "36px";



    const discordImg = document.createElement("img");



    discordImg.src = discordIcon;



    discordImg.alt = "Discord";



    discordImg.style.width = "20px";



    discordImg.style.height = "20px";



    btnDiscord.append(discordImg);



    btnDiscord.addEventListener("click", () => {



        window.open("https://discord.gg/vAPxWYHt", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=900,height=700");



    });



    header.append(btnDiscord);



    const btnGithub = el("button", "btn primary githubBtn") as HTMLButtonElement;



    btnGithub.title = "GitHub öffnen";



    const githubImg = document.createElement("img");



    githubImg.src = githubIcon;



    githubImg.alt = "GitHub";



    githubImg.style.width = "20px";



    githubImg.style.height = "20px";



    btnGithub.append(githubImg);



    btnGithub.addEventListener("click", () => {



        window.open(GITHUB_REPO_URL, "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1200,height=800");



    });



    const updateNotice = el("div", "updateNotice hidden", "Neue Version verfügbar");



    const btnConfig = el("button", "btn primary configBtn") as HTMLButtonElement;
    btnConfig.title = t("config.title");
    btnConfig.setAttribute("aria-label", t("config.title"));
    const configIcon = document.createElement("span");
    configIcon.textContent = settingsIcon;
    configIcon.setAttribute("aria-hidden", "true");
    configIcon.style.fontSize = "18px";
    btnConfig.append(configIcon);


    btnConfig.addEventListener("click", () => openConfigModal());



    header.append(btnGithub, btnConfig, updateNotice);



    const versionLabel = el("div", "versionLabel", `v${pkg.version}`);



    const applyUpdateState = (available: boolean) => {



        btnGithub.classList.toggle("updateAvailable", available);



        updateNotice.classList.toggle("hidden", !available);



    };



    applyUpdateState(cachedUpdateAvailable ?? false);



    getUpdateAvailable()



        .then(applyUpdateState)



        .catch((err) => {



        console.warn("launcher update check failed", err);



        applyUpdateState(false);



    });



    const languages: {



        value: Locale;



        title: string;



        icon: string;



    }[] = [



        { value: "en", title: "English", icon: FLAG_ICONS.en },



        { value: "de", title: "Deutsch", icon: FLAG_ICONS.de },



        { value: "pl", title: "Polski", icon: FLAG_ICONS.pl },



        { value: "fr", title: "Français", icon: FLAG_ICONS.fr },



        { value: "ru", title: "Русский", icon: FLAG_ICONS.ru },



        { value: "tr", title: "Türkçe", icon: FLAG_ICONS.tr },



        { value: "cn", title: "中文", icon: FLAG_ICONS.cn },



        { value: "jp", title: "日本語", icon: FLAG_ICONS.jp },



    ];



    const langPicker = el("div", "langPicker");



    const langButton = document.createElement("button");



    langButton.className = "btn langButton";



    const langIcon = el("div", "langIcon");



    langButton.append(langIcon);



    const langMenu = el("div", "langMenu hidden");



    function syncLangButton() {



        const active = languages.find((l) => l.value === currentLocale) ?? languages[0];



        langButton.title = active.title;



        langIcon.style.backgroundImage = `url("${active.icon}")`;



    }



    for (const l of languages) {



        const btn = document.createElement("button");



        btn.className = "langMenuItem";



        btn.type = "button";



        btn.title = l.title;



        btn.style.backgroundImage = `url("${l.icon}")`;



        btn.onclick = () => {



            setLocale(l.value);



            syncLangButton();



            langMenu.classList.add("hidden");



            if (langMenuCloser) {



                document.removeEventListener("click", langMenuCloser);



                langMenuCloser = null;



            }



            renderLauncher(root);



        };



        langMenu.append(btn);



    }



    syncLangButton();



    langButton.addEventListener("click", (e) => {



        e.stopPropagation();



        langMenu.classList.toggle("hidden");



    });



    langMenuCloser = () => langMenu.classList.add("hidden");



    document.addEventListener("click", langMenuCloser);



    langPicker.append(langButton, langMenu);



    header.append(el("div", "title", ""), el("div", "spacer"), versionLabel, langPicker);



    const btnCreate = el("button", "btn primary", t("header.newProfile"));



    const filterBar = el("div", "filterBar");



    const searchInput = document.createElement("input");



    searchInput.className = "input searchInput";



    searchInput.placeholder = t("filter.searchPlaceholder");



    const jobSelect = document.createElement("select");



    jobSelect.className = "select filterSelect";



    renderJobOptions(jobSelect);



    const btnRefreshLayouts = el("button", "btn", t("layout.refresh"));



    filterBar.append(searchInput, jobSelect, btnCreate, btnRefreshLayouts);



    async function renderLayoutChips(target: HTMLElement) {



        // Replace existing layout card without touching other content (e.g., profile cards)



        target.querySelector(".layoutCard")?.remove();



        const refreshFlag = localStorage.getItem("tabLayoutsRefresh");



        if (refreshFlag)



            localStorage.removeItem("tabLayoutsRefresh");



        const layouts = await fetchTabLayouts();



        const card = el("div", "card layoutCard");



        const layoutBar = el("div", "layoutBar");



        const layoutList = el("div", "layoutList");



        layoutBar.append(layoutList);







        // Localized Labels to avoid ReferenceError before session view is initialised



        const layoutLabel = (type: string): string => {



            const labels: Record<string, string> = {



                single: t("layout.single"),



                "split-2": t("layout.split2"),



                "grid-4": t("layout.grid4"),



                "row-4": t("layout.row4"),



                "grid-6": t("layout.grid6"),



                "grid-8": t("layout.grid8"),



            };



            return labels[type] ?? t("layout.multi");



        };







        let profileNames = new Map<string, string>();



        let profileJobs = new Map<string, string | null>();



        try {



            const profiles = await window.api.profilesList();



            profileNames = new Map(profiles.map((p: Profile) => [p.id, p.name]));



            profileJobs = new Map(profiles.map((p: Profile) => [p.id, p.job?.trim() || null]));



            profiles.forEach((p) => rememberProfileName(p.id, p.name, p.job));



        }



        catch (e) {



            console.warn("profilesList failed", e);



        }



        let activeCloseMenu: (() => void) | null = null;



        if (layouts.length === 0) {



            layoutList.append(el("div", "muted", t("layout.empty")));



        }



        else {



            for (const layout of layouts) {



                const chip = el("div", "layoutChip");



                const handle = el("span", "dragHandle", "=");



                const name = el("span", "layoutName", layout.name);



                const metaParts = [`${layout.tabs.length} Tabs`];



                const shortLabel = (type: string): string => {



                    const map: Record<string, string> = {



                        single: "1x1", "split-2": "1x2", "row-3": "1x3", "row-4": "1x4",



                        "grid-4": "2x2", "grid-6": "2x3", "grid-8": "2x4",



                    };



                    return map[type] ?? type;



                };



                const savedLayouts: Array<{ layout: { type: string } }> = layout.layouts ?? [];



                if (savedLayouts.length > 0) {



                    metaParts.push(savedLayouts.map((g) => shortLabel(g.layout.type)).join(" - "));



                } else if (layout.split) {



                    const typeKey = "type" in layout.split ? (layout.split as { type?: string }).type ?? "split-2" : "split-2";



                    metaParts.push(shortLabel(typeKey));



                }



                const meta = el("span", "layoutMeta", metaParts.join(" | "));



                const actions = el("div", "layoutActions");



                // --- Profiles expand button ---



                let profilesRow: HTMLDivElement | null = null;



                const profilesBtn = el("button", "btn layoutProfilesBtn", "👤");



                profilesBtn.title = "Profiles";



                profilesBtn.onclick = (e) => {



                    e.stopPropagation();



                    if (profilesRow) {



                        profilesRow.remove();



                        profilesRow = null;



                        profilesBtn.classList.remove("active");



                        return;



                    }



                    profilesRow = el("div", "layoutProfilesRow") as HTMLDivElement;



                    // Determine layout grouping from saved layout data



                    const savedLayouts: Array<{ name?: string; layout: { type: string; cells: Array<{ id: string; position: number }> } }> = layout.layouts ?? [];



                    if (savedLayouts.length > 0) {



                        // Show each saved layout group



                        for (const grp of savedLayouts) {



                            const groupEl = el("div", "layoutProfileGroup");



                            const groupTitle = grp.name || layoutLabel(grp.layout.type);



                            const groupLabel = el("span", "layoutProfileGroupLabel", groupTitle);



                            groupEl.append(groupLabel);



                            const groupItems = el("div", "layoutProfileGroupItems");



                            const sortedCells = [...grp.layout.cells].sort((a, b) => a.position - b.position);



                            for (const cell of sortedCells) {



                                const item = el("div", "layoutProfileItem");



                                const job = profileJobs.get(cell.id) ?? null;



                                const icon = createJobIcon(job ?? undefined, "layoutProfileJobIcon");



                                if (icon) item.append(icon);



                                const label = el("span", "layoutProfileLabel", profileNames.get(cell.id) ?? cell.id);



                                item.append(label);



                                groupItems.append(item);



                            }



                            groupEl.append(groupItems);



                            profilesRow.append(groupEl);



                        }



                    } else {



                        // Fallback: flat list (no grouping info available)



                        const groupItems = el("div", "layoutProfileGroupItems");



                        for (const tabId of layout.tabs) {



                            const item = el("div", "layoutProfileItem");



                            const job = profileJobs.get(tabId) ?? null;



                            const icon = createJobIcon(job ?? undefined, "layoutProfileJobIcon");



                            if (icon) item.append(icon);



                            const label = el("span", "layoutProfileLabel", profileNames.get(tabId) ?? tabId);



                            item.append(label);



                            groupItems.append(item);



                        }



                        profilesRow.append(groupItems);



                    }



                    if (layout.tabs.length === 0) {



                        profilesRow.append(el("span", "muted", t("layout.empty")));



                    }



                    chip.append(profilesRow);



                    profilesBtn.classList.add("active");



                };







                const manageBtn = el("button", "btn", "⚙");


                manageBtn.title = "Manage";



                let menu: HTMLDivElement | null = null;



                let closeMenu: (() => void) | null = null;



                const buildMenu = () => {



                    if (menu)



                        return;



                    activeCloseMenu?.();



                    activeCloseMenu = null;



                    menu = el("div", "layoutMenu") as HTMLDivElement;



                    const renameBtn = el("button", "btn", t("layout.rename"));



                    renameBtn.onclick = async () => {



                        closeMenu?.();



                        const requestName = async (initial: string): Promise<string | null> => {



                            if (typeof askLayoutName === "function") {



                                return await askLayoutName(initial);



                            }



                            // Fallback modal (prompt is not available in this environment)



                            return await new Promise<string | null>((resolve) => {



                                void hideSessionViews();



                                const overlay = el("div", "modalOverlay");



                                const modal = el("div", "modal");



                                const header = el("div", "modalHeader");



                                const headerTitle = el("span", "", t("layout.namePrompt"));



                                const headerClose = el("button", "modalCloseBtn", "\u00d7") as HTMLButtonElement;



                                headerClose.type = "button";



                                headerClose.onclick = () => cleanup(null);



                                header.append(headerTitle, headerClose);



                                const body = el("div", "modalBody");



                                const input = document.createElement("input");



                                input.className = "input";



                                input.value = initial;



                                input.placeholder = t("layout.namePrompt");



                                const actions = el("div", "manageActions");



                                const btnSave = el("button", "btn primary", t("profile.save"));



                                const btnCancel = el("button", "btn", t("create.cancel"));



                                actions.append(btnSave, btnCancel);



                                body.append(input, actions);



                                modal.append(header, body);



                                overlay.append(modal);



                                const cleanup = (val: string | null) => {



                                    overlay.remove();



                                    void showSessionViews();



                                    resolve(val);



                                    pushBounds();



                                    kickBounds();



                                };



                                btnSave.onclick = () => cleanup(input.value.trim() || initial);



                                btnCancel.onclick = () => cleanup(null);



                                overlay.addEventListener("click", (e) => {



                                    if (e.target === overlay)



                                        cleanup(null);



                                });



                                input.addEventListener("keydown", (e) => {



                                    if (e.key === "Enter")



                                        cleanup(input.value.trim() || initial);



                                    if (e.key === "Escape")



                                        cleanup(null);



                                });



                                document.body.append(overlay);



                                input.focus();



                                input.select();



                            });



                        };



                        const nextName = await requestName(layout.name || "");



                        if (!nextName)



                            return;



                        try {



                            await window.api.tabLayoutsSave({



                                id: layout.id,



                                name: nextName,



                                tabs: layout.tabs,



                                split: layout.split ?? null,



                                activeId: layout.activeId ?? null,



                                loggedOutChars: layout.loggedOutChars,



                            });



                            showToast(t("layout.saved"), "success");



                            closeMenu?.();



                            await renderLayoutChips(target);



                        }



                        catch (err) {



                            showToast(`${t("layout.saveError")}: ${err instanceof Error ? err.message : String(err)}`, "error");



                        }



                    };



                    const delBtn = el("button", "btn danger", t("layout.delete"));



                    delBtn.onclick = async () => {



                        closeMenu?.();



                        await window.api.tabLayoutsDelete(layout.id);



                        await renderLayoutChips(target);



                    };



                    const menuActions = el("div", "layoutMenuActions");



                    menuActions.append(renameBtn, delBtn);



                    menu.append(menuActions);



                    document.body.append(menu);



                    const positionMenu = () => {



                        if (!menu)



                            return;



                        const margin = 12;



                        const triggerRect = manageBtn.getBoundingClientRect();



                        const menuRect = menu.getBoundingClientRect();



                        const maxLeft = Math.max(margin, window.innerWidth - menuRect.width - margin);



                        const left = Math.min(Math.max(margin, triggerRect.right - menuRect.width), maxLeft);



                        const maxTop = Math.max(margin, window.innerHeight - menuRect.height - margin);



                        const top = Math.min(triggerRect.bottom + margin, maxTop);



                        menu.style.left = `${left}px`;



                        menu.style.top = `${top}px`;



                    };



                    positionMenu();



                    const onDocClick = (e: MouseEvent) => {



                        if (!menu)



                            return;



                        const targetEl = e.target as Node;



                        if (targetEl === manageBtn || menu.contains(targetEl))



                            return;



                        closeMenu?.();



                    };



                    closeMenu = () => {



                        menu?.remove();



                        menu = null;



                        if (activeCloseMenu === closeMenu) activeCloseMenu = null;



                        document.removeEventListener("click", onDocClick);



                        window.removeEventListener("resize", positionMenu);



                    };



                    activeCloseMenu = closeMenu;



                    window.addEventListener("resize", positionMenu);



                    document.addEventListener("click", onDocClick);



                };



                manageBtn.onclick = (e) => {



                    e.stopPropagation();



                    if (menu) {



                        closeMenu?.();



                    }



                    else {



                        buildMenu();



                    }



                };



                const openBtn = el("button", "btn primary", t("profile.play"));



                openBtn.onclick = async () => {



                    showToast(t("layout.apply"), "info");



                    try {



                        await window.api.tabLayoutsApply(layout.id);



                    }



                    catch (err) {



                        showToast(`${t("layout.saveError")}: ${err instanceof Error ? err.message : String(err)}`, "error");



                    }



                };



                actions.append(profilesBtn, manageBtn, openBtn);



                chip.append(handle, name, meta, actions);



                layoutList.append(chip);



            }



        }



        card.append(layoutBar);



        target.prepend(card);



    }



    const body = el("div", "layout");



    const left = el("div", "panel left");



    const right = el("div", "panel right");



    const list = el("div", "list");



    const profilesContainer = el("div", "profilesContainer");



    list.append(profilesContainer);



    const createPanel = el("div", "manage createPanel hidden");



    const createGrid = el("div", "manageGrid");



    const tipsBanner = el("div", "tipsBanner");



    const tipsTitle = el("div", "tipsTitle", t("tips.title"));



    const tipsText = el("div", "tipsText", "");



    tipsBanner.append(tipsTitle, tipsText);



    const createName = document.createElement("input");



    createName.className = "input";



    createName.placeholder = t("create.namePlaceholder");



    createGrid.append(createName);



    const createActions = el("div", "manageActions");



    const btnAdd = el("button", "btn primary", t("create.add"));



    const btnCancel = el("button", "btn", t("create.cancel"));



    // eslint-disable-next-line @typescript-eslint/no-unused-vars



    const btnDel = el("button", "btn danger", t("create.delete")); // Reserved for future delete functionality



    createActions.append(btnAdd, btnCancel);



    createPanel.append(createGrid, createActions);



    left.append(createPanel, list, tipsBanner);



    const newsHeader = el("div", "newsHeader");



    const newsTitle = el("div", "panelTitle", t("news.title"));



    newsHeader.append(newsTitle);



    const newsState = el("div", "newsState muted", t("news.loading"));



    const newsList = el("div", "newsList");



    const openProfilesTitle = el("div", "openProfilesTitle", t("news.openProfiles"));



    const openProfilesList = el("div", "openProfilesList");



    const openProfilesBox = el("div", "openProfiles");



    openProfilesBox.append(openProfilesTitle, openProfilesList);



    right.append(newsHeader, newsState, newsList, openProfilesBox);



    root.append(header, filterBar, body);



    body.append(left, right);



    type NewsItem = {



        title: string;



        url: string;



        excerpt?: string;



        image?: string;



        category?: string;



        date?: string;



        orderIdx?: number;



    };



    const MONTHS: Record<string, number> = {



        jan: 1, january: 1,



        feb: 2, february: 2,



        mar: 3, march: 3,



        apr: 4, april: 4,



        may: 5,



        jun: 6, june: 6,



        jul: 7, july: 7,



        aug: 8, august: 8,



        sep: 9, sept: 9, september: 9,



        oct: 10, october: 10,



        nov: 11, november: 11,



        dec: 12, december: 12,



    };



    function normalizeNewsText(input: string | null | undefined) {



        if (!input)



            return "";



        return input.replace(/\s+/g, " ").trim();



    }



    function absoluteNewsUrl(href: string | null): string | null {



        if (!href)



            return null;



        try {



            return new URL(href, NEWS_BASE_URL).toString();



        }



        catch {



            return null;



        }



    }



    function pad2(n: number) {



        return n.toString().padStart(2, "0");



    }



    function formatDate(parts: {



        year?: number;



        month?: number;



        day?: number;



        raw?: string;



    }) {



        if (parts.year && parts.month && parts.day) {



            return `${pad2(parts.day)}.${pad2(parts.month)}.${parts.year}`;



        }



        if (parts.month && parts.day) {



            return `${pad2(parts.day)}.${pad2(parts.month)}`;



        }



        return parts.raw ?? null;



    }



    function formatDateFromIso(iso: string | null | undefined) {



        if (!iso)



            return null;



        const d = new Date(iso);



        if (Number.isNaN(d.getTime()))



            return null;



        return formatDate({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });



    }



    function parseDateFromText(text: string | null | undefined): string | null {



        if (!text)



            return null;



        const t = text;



        let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);



        if (m)



            return formatDate({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) });



        m = t.match(/\b(\d{4})(\d{2})(\d{2})\b/);



        if (m)



            return formatDate({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) });



        m = t.match(/\b(\d{2})(\d{2})(\d{2})(?!\d)\b/);



        if (m) {



            const month = Number(m[1]);



            const day = Number(m[2]);



            const year = 2000 + Number(m[3]);



            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {



                return formatDate({ year, month, day });



            }



        }



        m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);



        if (m) {



            const month = Number(m[1]);



            const day = Number(m[2]);



            const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;



            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {



                return formatDate({ year, month, day });



            }



        }



        m = t.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s.-]*(\d{1,2})(?:,?\s*(\d{2,4}))?/i);



        if (m) {



            const month = MONTHS[m[1].toLowerCase()];



            const day = Number(m[2]);



            const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;



            if (month) {



                return formatDate({ year, month, day });



            }



        }



        return null;



    }



    function extractDate(candidates: (string | null | undefined)[]) {



        for (const c of candidates) {



            const parsed = parseDateFromText(c);



            if (parsed)



                return parsed;



        }



        return null;



    }



    function renderNewsItem(item: NewsItem) {



        const link = document.createElement("a");



        link.className = "newsItem";



        link.href = item.url;



        link.target = "_blank";



        link.rel = "noreferrer";



        const thumb = el("div", "newsThumb");



        if (item.image) {



            const img = document.createElement("img");



            img.src = item.image;



            img.alt = item.title;



            thumb.append(img);



        }



        else {



            thumb.textContent = "NEWS";



        }



        const content = el("div", "newsContent");



        const title = el("div", "newsTitle", item.title);



        const metaText = item.date ? `${item.category ?? "News"} · ${item.date}` : item.category ?? "News";



        const meta = el("div", "newsMeta", metaText);



        content.append(meta, title);



        link.append(thumb, content);



        return link;



    }



    type NewsNavTarget = {



        path: string;



        category?: string;



    };



    function parseNews(html: string, fallbackCategory?: string, navTargets?: NewsNavTarget[]): NewsItem[] {



        const doc = new DOMParser().parseFromString(html, "text/html");



        const tabNames: Record<string, string> = {};



        doc.querySelectorAll("#news-tabs .nav-link").forEach((btn) => {



            const target = btn.getAttribute("data-bs-target");



            if (!target)



                return;



            const name = normalizeNewsText(btn.textContent) || "News";



            tabNames[target.replace("#", "")] = name;



            const href = btn.getAttribute("href");



            if (href && !href.startsWith("#")) {



                try {



                    const url = new URL(href, NEWS_BASE_URL);



                    if (url.hostname === "universe.flyff.com" && url.pathname.startsWith("/news")) {



                        const path = `${url.pathname}${url.search}`;



                        navTargets?.push({ path, category: name });



                    }



                }



                catch (err) {



                    logErr(err, "renderer");



                }



            }



        });



        const seen = new Set<string>();



        const items: NewsItem[] = [];



        const panes = Array.from(doc.querySelectorAll(".tab-content .tab-pane"));



        const addLinksFrom = (scope: ParentNode, category: string) => {



            const links = Array.from(scope.querySelectorAll(".card a, .list-group-item a, .news-card a, .newsCard a, a[href*='/news/']"));



            for (const link of links) {



                if ((link as HTMLElement).closest("#news-tabs"))



                    continue;



                const href = absoluteNewsUrl(link.getAttribute("href"));



                const title = normalizeNewsText(link.querySelector("h5")?.textContent ?? link.textContent);



                if (!href || !title || title.length < 3)



                    continue;



                if (seen.has(href))



                    continue;



                seen.add(href);



                const excerpt = normalizeNewsText(link.querySelector("h6")?.textContent ?? "");



                const img = link.querySelector("img") as HTMLImageElement | null;



                const image = absoluteNewsUrl(img?.getAttribute("src") ?? null) ?? undefined;



                const altText = normalizeNewsText(img?.getAttribute("alt") ?? "");



                let slug = "";



                try {



                    const url = new URL(href);



                    slug = url.pathname.split("/").filter(Boolean).pop() ?? "";



                }



                catch (err) {



                    logErr(err, "renderer");



                }



                const date = extractDate([altText, title, excerpt, link.textContent, slug]);



                items.push({



                    title,



                    url: href,



                    excerpt: excerpt || undefined,



                    image,



                    category,



                    date: date ?? undefined,



                });



            }



        };



        if (panes.length > 0) {



            for (const pane of panes) {



                const category = tabNames[pane.id] ?? fallbackCategory ?? "News";



                addLinksFrom(pane, category);



            }



        }



        else {



            addLinksFrom(doc.body, fallbackCategory ?? "News");



        }



        return items;



    }



    function parseArticleDate(html: string): string | null {



        const doc = new DOMParser().parseFromString(html, "text/html");



        const ogPublished = formatDateFromIso(doc.querySelector('meta[property="og:article:published_time"]')?.getAttribute("content") ?? undefined);



        if (ogPublished)



            return ogPublished;



        const pMuted = normalizeNewsText(doc.querySelector("p.text-muted")?.textContent ?? "");



        const postedOn = normalizeNewsText(doc.querySelector("p.d-md-inline-block")?.textContent ?? "");



        return extractDate([pMuted, postedOn]) ?? null;



    }



    function dateStringToNumber(input?: string): number {



        if (!input)



            return 0;



        const parsed = Date.parse(input);



        if (!Number.isNaN(parsed))



            return parsed;



        const m = input.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);



        if (m) {



            const day = Number(m[1]);



            const month = Number(m[2]);



            const year = Number(m[3]);



            if (day && month && year) {



                return Date.UTC(year, month - 1, day);



            }



        }



        return 0;



    }



    async function enrichNewsDates(items: NewsItem[]) {



        for (const item of items) {



            try {



                const articleHtml = await window.api.fetchNewsArticle(item.url);



                const date = parseArticleDate(articleHtml);



                if (date)



                    item.date = date;



            }



            catch (err) {



                console.warn("[news] article fetch failed:", err);



            }



        }



    }



    function showNewsState(text: string) {



        newsState.textContent = text;



        newsState.style.display = "block";



    }



    function hideNewsState() {



        newsState.style.display = "none";



    }



    const NEWS_FEED_PAGES: {



        path: string;



        category?: string;



    }[] = [



        { path: "/news", category: "Updates" },



        { path: "/news?category=events", category: "Events" },



        { path: "/news?category=event", category: "Events" },



        { path: "/news?category=item-shop-news", category: "Item Shop News" },



        { path: "/news?category=item-shop", category: "Item Shop News" },



    ];



    async function loadNews() {



        showNewsState(t("news.loading"));



        newsList.innerHTML = "";



        try {



            const combined: NewsItem[] = [];



            const seen = new Set<string>();



            const navTargets: NewsNavTarget[] = [];



            try {



                const baseHtml = await window.api.fetchNewsPage("/news");



                const baseItems = parseNews(baseHtml, "Updates", navTargets);



                for (const item of baseItems) {



                    if (seen.has(item.url))



                        continue;



                    seen.add(item.url);



                    item.orderIdx = combined.length;



                    combined.push(item);



                }



            }



            catch (err) {



                console.warn("[news] fetch base page failed", err);



            }



            const queuedPaths = new Map<string, string | undefined>();



            for (const page of NEWS_FEED_PAGES) {



                queuedPaths.set(page.path, page.category);



            }



            for (const target of navTargets) {



                queuedPaths.set(target.path, target.category ?? queuedPaths.get(target.path));



            }



            for (const [path, category] of queuedPaths.entries()) {



                if (path === "/news")



                    continue;



                try {



                    const html = await window.api.fetchNewsPage(path);



                    const items = parseNews(html, category);



                    for (const item of items) {



                        if (seen.has(item.url))



                            continue;



                        seen.add(item.url);



                        if (!item.category)



                            item.category = category;



                        item.orderIdx = combined.length;



                        combined.push(item);



                    }



                }



                catch (err) {



                    console.warn("[news] fetch page failed", path, err);



                }



            }



            if (combined.length === 0) {



                showNewsState(t("news.none"));



                return;



            }



            const categoryBuckets = new Map<string, NewsItem[]>();



            for (const item of combined) {



                const cat = item.category ?? "News";



                if (!categoryBuckets.has(cat))



                    categoryBuckets.set(cat, []);



                categoryBuckets.get(cat)?.push(item);



            }



            const toEnrich: NewsItem[] = [];



            const preferCategories = ["Updates", "Events", "Item Shop News", "News"];



            for (const cat of preferCategories) {



                const bucket = categoryBuckets.get(cat);



                if (!bucket)



                    continue;



                toEnrich.push(...bucket.slice(0, 8));



            }



            if (toEnrich.length < 24) {



                for (const item of combined) {



                    if (toEnrich.includes(item))



                        continue;



                    toEnrich.push(item);



                    if (toEnrich.length >= 24)



                        break;



                }



            }



            await enrichNewsDates(toEnrich);



            const sortedCombined = combined



                .slice()



                .sort((a, b) => {



                const da = dateStringToNumber(a.date);



                const db = dateStringToNumber(b.date);



                if (db !== da)



                    return db - da;



                const ia = a.orderIdx ?? 0;



                const ib = b.orderIdx ?? 0;



                return ia - ib;



            });



            const subset = sortedCombined.slice(0, 12);



            hideNewsState();



            for (const item of subset) {



                newsList.append(renderNewsItem(item));



            }



        }



        catch (err) {



            console.error("[news] load failed:", err);



            const msg = err instanceof Error && err.message ? ` (${err.message})` : "";



            showNewsState(`${t("news.error")}${msg ? ` ${msg}` : ""}`);



        }



    }



    async function refreshOpenProfilesBadge() {



        openProfilesList.innerHTML = "";



        const getAllOpenProfiles = window.api?.sessionTabsGetAllOpenProfiles;



        const getOpenProfiles = window.api?.sessionTabsGetOpenProfiles;



        if (typeof getAllOpenProfiles !== "function" && typeof getOpenProfiles !== "function") {



            const pill = el("span", "newsBadge empty", t("news.openProfiles.none"));



            openProfilesList.append(pill);



            return;



        }



        try {



            const [openIds, profiles] = await Promise.all([



                (typeof getAllOpenProfiles === "function"



                    ? getAllOpenProfiles()



                    : (getOpenProfiles?.() ?? Promise.resolve([]))) as Promise<string[]>,



                window.api.profilesList() as Promise<Profile[]>,



            ]);



            const orderMap = new Map(profiles.map((p, idx) => [p.id, idx]));



            const nameMap = new Map(profiles.map((p) => [p.id, p.name]));



            const uniqueIds = Array.from(new Set(openIds));



            uniqueIds.sort((a, b) => (orderMap.get(a) ?? 9999) - (orderMap.get(b) ?? 9999));



            const names = uniqueIds.map((id) => nameMap.get(id) ?? id);



            if (names.length === 0) {



                const pill = el("span", "newsBadge empty", t("news.openProfiles.none"));



                openProfilesList.append(pill);



                return;



            }



            for (const name of names) {



                const pill = el("div", "openProfileItem", name);



                openProfilesList.append(pill);



            }



        }



        catch (err) {



            logErr(err, "renderer");



            const pill = el("span", "newsBadge empty", "?");



            openProfilesList.append(pill);



        }



    }







    // Layout selector for launching a profile



    const layoutOptions: LayoutType[] = ["single", "split-2", "row-3", "row-4", "grid-4", "grid-5", "grid-6", "grid-7", "grid-8"];



    const layoutDisplayNames: Record<LayoutType, string> = {



        "single": "1x1",



        "split-2": "1x2",



        "row-3": "1x3",



        "row-4": "1x4",



        "grid-4": "2x2",



        "grid-5": "3+2",



        "grid-6": "2x3",



        "grid-7": "4+3",



        "grid-8": "2x4",



    };







    /**



     * Shows window selector modal for multi-window tab support.



     * Returns the selected windowId or creates a new window.



     */



    async function showWindowSelectorForProfile(profileId: string): Promise<void> {



        const windows = await window.api.listTabWindows();







        // If there are existing windows, show selector



        if (windows.length > 0) {



            return new Promise((resolve) => {



                const overlay = el("div", "modalOverlay");



                const modal = el("div", "modal");



                const header = el("div", "modalHeader", t("multiwindow.selectWindow"));



                const body = el("div", "modalBody");



                const list = el("div", "pickerList windowSelectorList");



                body.append(list);



                modal.append(header, body);



                overlay.append(modal);



                document.body.append(overlay);







                const close = () => {



                    overlay.remove();



                    resolve();



                };







                overlay.addEventListener("click", (e) => {



                    if (e.target === overlay) close();



                });







                // "New Window" option - layout selector BEFORE creating window



                const newWindowItem = el("button", "pickerItem primary", `+ ${t("multiwindow.newWindow")}`) as HTMLButtonElement;



                newWindowItem.onclick = async () => {



                    overlay.remove();



                    // Show layout selector first, THEN create window with layout



                    await showLayoutSelectorForProfile(profileId, null); // null = create new window



                    resolve();



                };



                list.append(newWindowItem);







                // Existing windows



                for (const win of windows) {



                const item = el("button", "pickerItem") as HTMLButtonElement;



                // Prefer live window title, fall back to stored name or translation



                const windowDisplayName = win.title || win.name || t("multiwindow.unnamed");



                const windowName = el("div", "windowSelectorName", windowDisplayName);



                    const tabCount = el("div", "windowSelectorCount muted", t("multiwindow.tabsCount").replace("{count}", String(win.tabCount)));



                    item.append(windowName, tabCount);



                    item.onclick = async () => {



                        overlay.remove();



                        await showLayoutSelectorForProfile(profileId, win.id);



                        resolve();



                    };



                    list.append(item);



                }



            });



        }







        // No existing windows - show layout selector first



        await showLayoutSelectorForProfile(profileId, null);



    }







    async function showLayoutSelectorForProfile(profileId: string, windowId: string | null): Promise<void> {



        return new Promise((resolve) => {



            const overlay = el("div", "modalOverlay");



            const modal = el("div", "modal");



            const header = el("div", "modalHeader", t("layout.select"));



            const body = el("div", "modalBody");



            const list = el("div", "pickerList layoutTypeList");



            body.append(list);



            modal.append(header, body);



            overlay.append(modal);



            document.body.append(overlay);







            const close = () => {



                overlay.remove();



                resolve();



            };







            overlay.addEventListener("click", (e) => {



                if (e.target === overlay) close();



            });







            for (const layoutType of layoutOptions) {



                const item = el("button", "pickerItem", layoutDisplayNames[layoutType]) as HTMLButtonElement;



                item.onclick = async () => {



                    overlay.remove();







                    // Show grid configuration modal to select profiles for cells



                    const layoutConfig = await showGridConfigModal(profileId, layoutType);



                    if (!layoutConfig) {



                        resolve();



                        return;



                    }







                    // If windowId is null, create new window first



                    let targetWindowId = windowId;



                    if (targetWindowId === null) {



                        targetWindowId = await window.api.createTabWindow();



                    }







                    // Now create the full layout with all cells



                    await window.api.createWindowWithLayout(layoutConfig, targetWindowId, profileId);







                    resolve();



                };



                list.append(item);



            }



        });



    }







    /**



     * Shows grid configuration modal where user can assign profiles to cells



     */



    async function showGridConfigModal(initialProfileId: string, layoutType: string): Promise<any | null> {



        const config = GRID_CONFIGS[layoutType];



        if (!config) return null;







        // Get all profiles with tab mode



        const allProfiles = await window.api.profilesList();



        const tabProfiles = allProfiles.filter(p => p.launchMode === "tabs");







        // Get already open profiles from all windows



        const openProfiles = new Set<string>();



        try {



            const allOpen = await window.api.sessionTabsGetAllOpenProfiles();



            allOpen.forEach(id => openProfiles.add(id));



        } catch (err) {



            console.warn("Failed to get open profiles:", err);



        }







        return new Promise((resolve) => {



            const overlay = el("div", "modalOverlay");



            const modal = el("div", "modal");



            const header = el("div", "modalHeader", `${t("layout.select")} - ${layoutDisplayNames[layoutType]}`);



            const body = el("div", "modalBody");



            const hint = el("div", "modalHint", t("layout.gridHint") || "Wählen Sie Profile für die Zellen");



            const grid = el("div", "layoutGrid");



            grid.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;



            grid.style.gridTemplateRows = `repeat(${config.rows}, 1fr)`;



            grid.style.position = "relative"; // For absolute positioning of picker menu







            const actions = el("div", "manageActions");



            const btnSave = el("button", "btn primary", t("create.save")) as HTMLButtonElement;



            const btnCancel = el("button", "btn", t("create.cancel")) as HTMLButtonElement;



            actions.append(btnSave, btnCancel);







            body.append(hint, grid, actions);



            modal.append(header, body);



            overlay.append(modal);



            document.body.append(overlay);







            const cells: Array<{ id: string; position: number }> = [



                { id: initialProfileId, position: 0 }



            ];







            const close = (result: any | null) => {



                overlay.remove();



                resolve(result);



            };







            overlay.addEventListener("click", (e) => {



                if (e.target === overlay) close(null);



            });







            btnCancel.onclick = () => close(null);



            btnSave.onclick = () => {



                if (cells.length === 0) return;



                const layout = {



                    type: layoutType,



                    cells: cells,



                    activePosition: 0,



                };



                close(layout);



            };







            function renderGrid() {



                grid.innerHTML = "";



                const maxCells = Math.min(config.maxViews, config.rows * config.cols);







                for (let pos = 0; pos < maxCells; pos++) {



                    const current = cells.find(c => c.position === pos);



                    const cellBtn = el("button", "gridCellBtn") as HTMLButtonElement;



                    const numSpan = el("span", "cellNum", String(pos + 1));



                    const nameSpan = el("span", "cellName",



                        current ? (tabProfiles.find(p => p.id === current.id)?.name || current.id) : t("layout.emptyCell") || "Leer"



                    );



                    cellBtn.append(numSpan, nameSpan);



                    if (!current) cellBtn.classList.add("empty");







                    cellBtn.onclick = () => {



                        // Close any existing picker menus first



                        grid.querySelectorAll(".cellPickerMenu").forEach((m) => m.remove());







                        // Show profile picker for this cell



                        const pickerMenu = el("div", "cellPickerMenu") as HTMLDivElement;

                        const row = Math.floor(pos / config.cols);
                        if (row === 0) {
                            pickerMenu.style.marginTop = "125px";
                        }





                        // Available profiles (not already used in cells, not open in other windows)



                        const usedInCells = new Set(cells.filter(c => c.position !== pos).map(c => c.id));



                        const available = tabProfiles.filter(p =>



                            !usedInCells.has(p.id) && !openProfiles.has(p.id)



                        );







                        // Add current profile to list if set



                        if (current && !available.some(p => p.id === current.id)) {



                            const currentProf = tabProfiles.find(p => p.id === current.id);



                            if (currentProf) available.unshift(currentProf);



                        }







                        // "Empty" option if cell already has profile



                        if (current) {



                            const emptyBtn = el("button", "pickerItem", t("layout.emptyCell") || "Leer") as HTMLButtonElement;



                            emptyBtn.onclick = () => {



                                // Remove from cells



                                const idx = cells.findIndex(c => c.position === pos);



                                if (idx >= 0) cells.splice(idx, 1);



                                pickerMenu.remove();



                                renderGrid();



                            };



                            pickerMenu.append(emptyBtn);



                        }







                        // Profile options



                        for (const prof of available) {



                            const profBtn = el("button", "pickerItem", prof.name) as HTMLButtonElement;



                            if (current && prof.id === current.id) {



                                profBtn.classList.add("selected");



                            }



                            profBtn.onclick = () => {



                                // Update cells



                                const idx = cells.findIndex(c => c.position === pos);



                                if (idx >= 0) {



                                    cells[idx] = { id: prof.id, position: pos };



                                } else {



                                    cells.push({ id: prof.id, position: pos });



                                }



                                pickerMenu.remove();



                                renderGrid();



                            };



                            pickerMenu.append(profBtn);



                        }







                        if (available.length === 0 && !current) {



                            const noProfiles = el("div", "pickerItem muted", "No profiles available");



                            pickerMenu.append(noProfiles);



                        }







                        // Append to grid and position relative to clicked cell



                        grid.append(pickerMenu);



                        const gridRect = grid.getBoundingClientRect();



                        const btnRect = cellBtn.getBoundingClientRect();



                        pickerMenu.style.position = "absolute";



                        pickerMenu.style.top = `${btnRect.bottom - gridRect.top + 5}px`;



                        pickerMenu.style.left = `${btnRect.left - gridRect.left}px`;



                        pickerMenu.style.zIndex = "1000";







                        // Close on outside click



                        const closeMenu = (e: MouseEvent) => {



                            if (!pickerMenu.contains(e.target as Node) && e.target !== cellBtn) {



                                pickerMenu.remove();



                                document.removeEventListener("click", closeMenu);



                            }



                        };



                        setTimeout(() => document.addEventListener("click", closeMenu), 10);



                    };







                    grid.append(cellBtn);



                }







                btnSave.disabled = cells.length === 0;



            }







            renderGrid();



        });



    }







    async function reload() {



        const prevScroll = list.scrollTop;



        profilesContainer.innerHTML = "";



        try {



            await renderLayoutChips(profilesContainer);



        }



        catch (err) {



            console.error("[layouts] render failed:", err);



            showToast(t("layout.refresh"), "error", 2500);



        }



        if (overlayDisabled && !overlayClearedOnce) {



            try {



                await window.api.profilesSetOverlayTarget(null);



                await window.api.profilesSetOverlaySupportTarget?.(null);



                overlayClearedOnce = true;



            }



            catch (e) {



                console.error("profilesSetOverlayTarget (disabled) failed:", e);



            }



        }



        let profiles: Profile[] = [];



        try {



            profiles = await window.api.profilesList();



        }



        catch (e) {



            console.error(e);



            profilesContainer.append(el("div", "muted", t("list.error")));



            return;



        }



        if (profiles.length === 0) {



            profilesContainer.append(el("div", "muted", t("list.empty")));



            return;



        }



        const searchTerm = searchInput.value.trim().toLowerCase();



        const jobFilter = jobSelect.value;



        const filteredProfiles = profiles.filter((p) => {



            const matchesSearch = p.name.toLowerCase().includes(searchTerm);



            const matchesJob = !jobFilter || (p.job ?? "") === jobFilter;



            return matchesSearch && matchesJob;



        });



        if (filteredProfiles.length === 0) {



            profilesContainer.append(el("div", "muted", t("list.noMatches")));



            return;



        }



        let draggingId: string | null = null;



        for (const p of filteredProfiles) {



            const card = el("div", "card");



            const row = el("div", "row");



            const leftInfo = el("div", "rowLeft");



            const dragHandle = el("span", "dragHandle", "=");



            const name = el("div", "rowName", p.name);



            leftInfo.append(dragHandle);



            dragHandle.setAttribute("draggable", "true");



            dragHandle.addEventListener("dragstart", (e) => {



                draggingId = p.id;



                card.classList.add("dragging");



                e.dataTransfer?.setData("text/plain", p.id);



                e.dataTransfer!.effectAllowed = "move";



                e.dataTransfer?.setDragImage(row, 20, 20);



            });



            dragHandle.addEventListener("dragend", () => {



                draggingId = null;



                card.classList.remove("dragging", "dropBefore", "dropAfter");



            });



            const actions = el("div", "rowActions");



            const btnManage = el("button", "btn", "") as HTMLButtonElement;



            const manageIcon = document.createElement("span");



            manageIcon.textContent = "⚙";


            manageIcon.setAttribute("aria-hidden", "true");



            btnManage.title = t("profile.manage");



            btnManage.setAttribute("aria-label", t("profile.manage"));



            btnManage.append(manageIcon);



            const btnPlay = el("button", "btn primary", t("profile.play"));



            const btnDel = el("button", "btn danger", t("profile.delete"));



            const btnTag = el("button", "btn", "") as HTMLButtonElement;



            btnTag.disabled = overlayDisabled;



            btnTag.title = overlayDisabled



                ? t("profile.overlay.disabled")



                : p.overlayTarget



                    ? t("profile.overlay.on")



                    : t("profile.overlay.off");



            if (!overlayDisabled && p.overlayTarget) {



                btnTag.classList.add("primary");



            }



            const img = document.createElement("img");



            img.src = aibattGold;



            img.alt = "Overlay";



            img.style.width = "100%";



            img.style.height = "100%";



            img.style.display = "block";



            img.style.objectFit = "cover";



            img.style.opacity = overlayDisabled ? "0.35" : p.overlayTarget ? "1" : "0.35";



            img.style.filter = overlayDisabled ? "grayscale(100%)" : p.overlayTarget ? "none" : "grayscale(100%)";



            btnTag.append(img);



            btnTag.style.width = "34px";



            btnTag.style.height = "34px";



            btnTag.style.display = "grid";



            btnTag.style.placeItems = "center";



            btnTag.style.padding = "0";



            btnTag.style.borderRadius = "10px";



            btnTag.style.overflow = "hidden";



            btnTag.onclick = async () => {



                if (overlayDisabled)



                    return;



                try {



                    if (p.overlayTarget) {



                        await window.api.profilesSetOverlayTarget(null);



                    }



                    else {



                        await window.api.profilesSetOverlayTarget(p.id, "aibatt-gold");



                    }



                    await reload();



                }



                catch (e) {



                    console.error("profilesSetOverlayTarget failed:", e);



                }



            };



            const btnSupport = el("button", "btn", "") as HTMLButtonElement;



            btnSupport.disabled = overlayDisabled;



            btnSupport.title = overlayDisabled



                ? t("profile.overlay.disabled")



                : p.overlaySupportTarget



                    ? "Support-Ziel aktiv (klicken zum deaktivieren)"



                    : "Als Support-Ziel markieren";



            if (!overlayDisabled && p.overlaySupportTarget) {



                btnSupport.style.background = "rgba(120,214,196,0.20)";



                btnSupport.style.borderColor = "rgba(120,214,196,0.65)";



            }



            const supportImg = document.createElement("img");



            supportImg.src = supporterIcon;



            supportImg.alt = "Support Overlay";



            supportImg.style.width = "100%";



            supportImg.style.height = "100%";



            supportImg.style.display = "block";



            supportImg.style.objectFit = "cover";



            supportImg.style.opacity = overlayDisabled ? "0.35" : p.overlaySupportTarget ? "1" : "0.35";



            supportImg.style.filter = overlayDisabled ? "grayscale(100%)" : p.overlaySupportTarget ? "none" : "grayscale(100%)";



            btnSupport.append(supportImg);



            btnSupport.style.width = "34px";



            btnSupport.style.height = "34px";



            btnSupport.style.display = "grid";



            btnSupport.style.placeItems = "center";



            btnSupport.style.padding = "0";



            btnSupport.style.borderRadius = "10px";



            btnSupport.style.overflow = "hidden";



            btnSupport.onclick = async () => {



                if (overlayDisabled)



                    return;



                try {



                    if (p.overlaySupportTarget) {



                        await window.api.profilesSetOverlaySupportTarget?.(null);



                    }



                    else {



                        await window.api.profilesSetOverlaySupportTarget?.(p.id, "supporter");



                    }



                    await reload();



                }



                catch (e) {



                    console.error("profilesSetOverlaySupportTarget failed:", e);



                }



            };



            leftInfo.append(btnTag, btnSupport, name);



            const jobBadge = createJobBadge(p.job);



            if (jobBadge)



                leftInfo.append(jobBadge);



            leftInfo.append(el("span", "badge subtle", p.launchMode === "tabs" ? t("profile.mode.tabs") : t("profile.mode.window")));



            btnDel.onclick = async () => {



                await window.api.profilesDelete(p.id);



                await reload();



            };



            actions.append(btnManage, btnPlay);



            row.append(leftInfo, actions);



            const manage = el("div", "manage hidden");



            const nameInput = document.createElement("input");



            nameInput.className = "input";



            nameInput.value = p.name;



            const jobSelect = document.createElement("select");



            jobSelect.className = "select";



            renderJobOptions(jobSelect, p.job ?? "");



            const modeWrap = el("div", "modeWrap");



            const modeLabel = el("label", "checkbox");



            const modeCheck = document.createElement("input");



            modeCheck.type = "checkbox";



            modeCheck.checked = p.launchMode === "tabs";



            modeLabel.append(modeCheck, el("span", "", t("profile.mode.useTabs")));



            modeWrap.append(modeLabel);



            const currentMode = (): "tabs" | "window" => (modeCheck.checked ? "tabs" : "window");



            btnPlay.onclick = async () => {



                await window.api.profilesUpdate({



                    id: p.id,



                    launchMode: currentMode(),



                });



                if (currentMode() === "tabs") {



                    await showWindowSelectorForProfile(p.id);



                }



                else {



                    await window.api.openWindow(p.id);



                }



            };



            const btnSave = el("button", "btn primary", t("profile.save"));



            const btnClone = el("button", "btn", t("profile.clone"));



            const btnClose = el("button", "btn", t("profile.close"));



            const clonePanel = el("div", "clonePanel hidden");



            const cloneInput = document.createElement("input");



            cloneInput.className = "input";



            cloneInput.placeholder = t("profile.clonePlaceholder");



            cloneInput.value = `${p.name} (${t("profile.copySuffix")})`;



            const cloneActions = el("div", "manageActions");



            const btnDoClone = el("button", "btn primary", t("profile.cloneConfirm"));



            const btnCloneCancel = el("button", "btn", t("profile.back"));



            cloneActions.append(btnDoClone, btnCloneCancel);



            clonePanel.append(cloneInput, cloneActions);



            btnSave.onclick = async () => {



                await window.api.profilesUpdate({



                    id: p.id,



                    name: nameInput.value.trim() || p.name,



                    job: jobSelect.value,



                    launchMode: modeCheck.checked ? "tabs" : "window",



                });



                await reload();



            };



            btnClone.onclick = () => {



                clonePanel.classList.toggle("hidden");



                cloneInput.focus();



                cloneInput.select();



            };



            btnCloneCancel.onclick = () => clonePanel.classList.add("hidden");



            btnDoClone.onclick = async () => {



                const newName = cloneInput.value.trim() || `${p.name} (Copy)`;



                await window.api.profilesClone(p.id, newName);



                clonePanel.classList.add("hidden");



                manage.classList.add("hidden");



                await reload();



            };



            btnClose.onclick = () => {



                clonePanel.classList.add("hidden");



                manage.classList.add("hidden");



            };



            const grid = el("div", "manageGrid");



            grid.append(nameInput, jobSelect, modeWrap);



            const actionBar = el("div", "manageActions");



            const actionSpacer = el("div", "spacer");



            actionBar.append(btnSave, btnClone, actionSpacer, btnDel, btnClose);



            manage.append(grid, actionBar, clonePanel);



            btnManage.onclick = () => manage.classList.toggle("hidden");



            card.addEventListener("dragover", (e) => {



                e.preventDefault();



                if (!draggingId || draggingId === p.id)



                    return;



                const rect = card.getBoundingClientRect();



                const after = e.clientY - rect.top > rect.height / 2;



                card.classList.toggle("dropAfter", after);



                card.classList.toggle("dropBefore", !after);



                e.dataTransfer!.dropEffect = "move";



            });



            card.addEventListener("dragleave", () => {



                card.classList.remove("dropBefore", "dropAfter");



            });



            card.addEventListener("drop", async (e) => {



                e.preventDefault();



                card.classList.remove("dropBefore", "dropAfter");



                const fromId = draggingId ?? e.dataTransfer?.getData("text/plain");



                const toId = p.id;



                if (!fromId || fromId === toId)



                    return;



                const rect = card.getBoundingClientRect();



                const after = e.clientY - rect.top > rect.height / 2;



                const orderedIds = reorderIds(profiles.map((x) => x.id), fromId, toId, after);



                await window.api.profilesReorder(orderedIds);



                await reload();



            });



            card.append(row, manage);



            profilesContainer.append(card);



        }



        requestAnimationFrame(() => {



            list.scrollTop = prevScroll;



        });



    }



    btnCreate.onclick = () => {



        createPanel.classList.toggle("hidden");



        createName.focus();



    };



    btnAdd.onclick = async () => {



        const name = createName.value.trim();



        if (!name)



            return;



        await window.api.profilesCreate(name);



        createName.value = "";



        createPanel.classList.add("hidden");



        await reload();



    };



    btnCancel.onclick = () => createPanel.classList.add("hidden");



    searchInput.addEventListener("input", () => {



        reload().catch(console.error);



    });



    jobSelect.addEventListener("change", () => {



        reload().catch(console.error);



    });



    btnRefreshLayouts.onclick = () => {



        reload().catch(console.error);



    };



    // Listen for layout changes from other windows (e.g., session window saving a layout)



    window.api.onLayoutsChanged?.(() => {



        reload().catch(console.error);



    });



    let tipIdx = 0;



    function showNextTip() {



        if (tips.length === 0)



            return;



        tipsText.textContent = tips[tipIdx];



        tipIdx = (tipIdx + 1) % tips.length;



    }



    showNextTip();



    setInterval(showNextTip, 6000);



    const refreshBadge = () => refreshOpenProfilesBadge().catch(console.error);



    refreshBadge();



    setInterval(refreshBadge, 5000);



    window.addEventListener("focus", refreshBadge);



    loadNews().catch(console.error);



    await reload();



}



async function renderSession(root: HTMLElement) {



    clear(root);



    root.className = "sessionRoot";



    const tabsBar = el("div", "tabs");



    // Layout-Progress-Anzeige in der Tab-Leiste



    const tabsProgress = el("button", "tabBtn progressTab");



    const tabsProgressFill = el("div", "progressTabFill");



    const tabsProgressLabel = el("span", "progressTabLabel", "");



    tabsProgress.append(tabsProgressFill, tabsProgressLabel);



    tabsProgress.style.display = "none";



    tabsProgress.tabIndex = -1;



    const initialLayoutId = qs().get("layoutId");



    const initialProfileId = qs().get("openProfileId");



    let initialLayoutPendingId: string | null = initialLayoutId;



    let initialLayoutFallbackTimer: ReturnType<typeof setTimeout> | null = null;



    const markInitialLayoutHandled = (layoutId: string) => {



        if (initialLayoutId && layoutId === initialLayoutId) {



            initialLayoutPendingId = null;



            if (initialLayoutFallbackTimer) {



                clearTimeout(initialLayoutFallbackTimer);



                initialLayoutFallbackTimer = null;



            }



        }



    };



    const setLayoutStatus = (text: string, tone: "info" | "success" | "error" = "info") => {



        // Keep a lightweight log for layout actions (no dedicated UI element yet).



        console.debug("[layout-status]", tone, text);



    };







    type LoadProgress = { active: boolean; total: number; done: number };



    const loadProgress: LoadProgress = { active: false, total: 0, done: 0 };







    function applyProgressDisplay() {



        if (!loadProgress.active || loadProgress.total <= 0) {



            tabsProgress.style.display = "none";



            tabsProgressLabel.textContent = "";



            tabsProgressFill.style.width = "0%";



            return;



        }



        const safeDone = Math.max(0, Math.min(loadProgress.total, Math.round(loadProgress.done)));



        tabsProgress.style.display = "inline-flex";



        tabsProgressLabel.textContent = `${safeDone}/${loadProgress.total}`;



        const pct = loadProgress.total > 0 ? (safeDone / loadProgress.total) * 100 : 0;



        tabsProgressFill.style.width = `${pct}%`;



    }







    let progressHideTimer: ReturnType<typeof setTimeout> | null = null;







    function finishLoadProgress() {



        if (progressHideTimer) {



            clearTimeout(progressHideTimer);



            progressHideTimer = null;



        }



        loadProgress.active = false;



        loadProgress.total = 0;



        loadProgress.done = 0;



        applyProgressDisplay();



    }







    function scheduleProgressHide() {



        if (progressHideTimer) {



            clearTimeout(progressHideTimer);



        }



        progressHideTimer = setTimeout(() => {



            progressHideTimer = null;



            finishLoadProgress();



        }, 3000);



    }







    function startLoadProgress(total: number) {



        // Cancel any pending hide timer when new progress starts



        if (progressHideTimer) {



            clearTimeout(progressHideTimer);



            progressHideTimer = null;



        }



        const nextTotal = Math.max(0, Math.round(total));



        if (loadProgress.active && nextTotal <= loadProgress.total) {



            return;



        }



        loadProgress.active = nextTotal > 0;



        loadProgress.total = nextTotal;



        loadProgress.done = 0;



        applyProgressDisplay();



    }







    function incrementLoadProgress(by = 1) {



        if (!loadProgress.active)



            return;



        loadProgress.done = Math.min(loadProgress.total, loadProgress.done + by);



        applyProgressDisplay();



        // Schedule hide when all items are loaded



        if (loadProgress.done >= loadProgress.total) {



            scheduleProgressHide();



        }



    }







    // Backwards compatible helper used in existing code paths



    function setLayoutProgress(done: number | null, total?: number) {



        if (done === null || total === undefined || total <= 0 || Number.isNaN(done)) {



            finishLoadProgress();



            return;



        }



        // Cancel any pending hide timer when new progress comes in



        if (progressHideTimer) {



            clearTimeout(progressHideTimer);



            progressHideTimer = null;



        }



        // Update/override totals only when an explicit value is passed



        loadProgress.active = true;



        loadProgress.total = Math.max(loadProgress.total, Math.round(total));



        loadProgress.done = Math.max(loadProgress.done, Math.round(done));



        applyProgressDisplay();



        if (loadProgress.done >= loadProgress.total) {



            // Schedule hide after 3 seconds instead of immediate



            scheduleProgressHide();



        }



    }



    let layoutApplyChain: Promise<void> = Promise.resolve();



    function enqueueLayoutApply(task: () => Promise<void>): Promise<void> {



        const run = layoutApplyChain.then(() => task());



        layoutApplyChain = run.catch(() => undefined);



        return run;



    }



    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));



    const content = el("div", "content");



    const loginOverlay = el("div", "sessionLoginOverlay") as HTMLDivElement;



    const loginTitle = el("div", "sessionLoginTitle", t("session.loggedOut"));



    const loginName = el("div", "sessionLoginName", "");



    const loginHint = el("div", "sessionLoginHint", t("session.loginHint"));



    const btnLogin = el("button", "btn primary", t("session.login")) as HTMLButtonElement;



    loginOverlay.append(loginTitle, loginName, loginHint, btnLogin);



    content.append(loginOverlay);



    root.append(tabsBar, content);



        loadClientSettings()



            .then((settings) => {



            setLayoutDelaySeconds(settings.layoutDelaySeconds);



            setToastDurationSeconds(settings.toastDurationSeconds);



            setSequentialGridLoad(settings.seqGridLoad ?? false);



        })



            .catch((err) => logErr(err, "renderer"));



    // Layout types need to be defined before Tab type



    type LayoutType = keyof typeof GRID_CONFIGS;



    type GridCell = { id: string; position: number };



    type LayoutState = {



        type: LayoutType;



        cells: GridCell[];



        ratio?: number;



        activePosition?: number;



    };







    // Tab types - support for single-profile and layout tabs



    type TabKind = "single" | "layout";



    type Tab = {



        id: string;                    // Unique tab ID



        type: TabKind;                 // "single" or "layout"



        profileId?: string;            // Only for type="single"



        layout?: LayoutState;          // Only for type="layout"



        name: string;                  // Display name



        tabBtn: HTMLButtonElement;



        cellButtons?: HTMLElement[];   // Only for type="layout": chip buttons when expanded view is enabled



        loggedOut?: boolean;           // Only for type="single"



    };







    type CloseChoice = "tab" | "dissolve" | "window" | "app" | "cancel";



    type CloseTarget =



        | { kind: "single"; profileId: string; label: string }



        | { kind: "layout"; tabId: string; label: string };



    const defaultSplitRatio = LAYOUT_CONST.DEFAULT_SPLIT_RATIO;



    const minSplitRatio = LAYOUT_CONST.MIN_SPLIT_RATIO;



    const maxSplitRatio = LAYOUT_CONST.MAX_SPLIT_RATIO;







    // Generate unique tab IDs



    let tabIdCounter = 0;



    function generateTabId(): string {



        return `tab-${Date.now()}-${++tabIdCounter}`;



    }







    const tabs: Tab[] = [];



    let activeTabId: string | null = null;     // Current active tab ID (single or layout)



    let activeProfileId: string | null = null; // Current active profile ID within a tab



    let layoutState: LayoutState | null = null; // Current visible layout (for rendering)



    let currentSplitRatio = defaultSplitRatio;







    const refreshLayoutDisplayMode = () => {



        tabsBar.dataset.layoutDisplay = layoutTabDisplay;



        for (const t of tabs) {



            if (t.type === "layout") {



                renderLayoutTabUi(t);



            }



        }



        syncTabClasses();



    };



    onLayoutTabDisplayChange(refreshLayoutDisplayMode);



    refreshLayoutDisplayMode();







    // Helper functions for the new tab architecture



    function findTabById(tabId: string): Tab | null {



        return tabs.find((t) => t.id === tabId) ?? null;



    }







    function findTabByProfileId(profileId: string): Tab | null {



        return tabs.find((t) => t.type === "single" && t.profileId === profileId) ?? null;



    }







    function findLayoutTab(): Tab | null {



        return tabs.find((t) => t.type === "layout") ?? null;



    }







    function getActiveTab(): Tab | null {



        if (!activeTabId) return null;



        return findTabById(activeTabId);



    }







    function isProfileInAnyLayout(profileId: string): boolean {



        return tabs.some((t) => t.type === "layout" && t.layout?.cells.some((c) => c.id === profileId));



    }







    const profileNameCache = new Map<string, string>();



    const profileJobCache = new Map<string, string | null>();







    function rememberProfileName(profileId: string, name?: string | null, job?: string | null): void {



        if (!profileId) return;



        const trimmed = name?.trim();



        if (trimmed) {



            profileNameCache.set(profileId, trimmed);



        }



        if (job !== undefined) {



            profileJobCache.set(profileId, job?.trim() || null);



        }



    }







    function getProfileLabel(profileId: string): string {



        return (



            profileNameCache.get(profileId) ??



            findSingleTab(profileId)?.name ??



            profileId



        );



    }







    function getProfileJob(profileId: string): string | null {



        return profileJobCache.get(profileId) ?? null;



    }







    async function resolveProfileName(profileId: string): Promise<string | null> {



        const cached = profileNameCache.get(profileId);



        if (cached) return cached;



        try {



            const profiles = await window.api.profilesList();



            for (const p of profiles) {



                rememberProfileName(p.id, p.name, p.job as string | null | undefined);



            }



        }



        catch (err) {



            logErr(err, "renderer");



        }



        return profileNameCache.get(profileId) ?? null;



    }







    function isGenericSingleLayoutName(name?: string | null): boolean {



        if (!name) return true;



        const normalized = name.replace(/[×?]/g, "x").toLowerCase().replace(/\s+/g, " ").trim();



        return normalized === "1x1 layout" || normalized === "1 x 1 layout";



    }







    async function deriveLayoutTabName(layout: LayoutState, providedName?: string): Promise<string> {



        const config = GRID_CONFIGS[layout.type];



        const gridDefaultName = `${config?.rows ?? 1}×${config?.cols ?? 1} Layout`;







        const isSingleLayout = layout.type === "single" && layout.cells.length === 1;



        if (!isSingleLayout) {



            return providedName || gridDefaultName;



        }







        const profileId = layout.cells[0].id;



        const profileName = (await resolveProfileName(profileId)) ?? profileId;



        if (!providedName) {



            return profileName;



        }



        if (isGenericSingleLayoutName(providedName) || providedName === gridDefaultName) {



            return profileName;



        }



        return providedName;



    }







    function buildLayoutChips(layout: LayoutState): { group: HTMLElement; chips: HTMLElement[] } {



        const group = el("div", "layoutTabGroup");



        const sortedCells = [...layout.cells].sort((a, b) => a.position - b.position);



        const chips: HTMLElement[] = [];



        const missingJobs: { chip: HTMLElement; cellId: string }[] = [];



        for (const cell of sortedCells) {



            const chip = el("div", "layoutTabChip");



            chip.dataset.profileId = cell.id;



            chip.title = getProfileLabel(cell.id);



            chip.draggable = false;



            const job = getProfileJob(cell.id);



            const jobIcon = createJobIcon(job ?? undefined, "tabJobIcon");



            if (jobIcon)



                chip.append(jobIcon);



            else



                missingJobs.push({ chip, cellId: cell.id });



            chip.append(el("span", "tabLabel", getProfileLabel(cell.id)));



            chips.push(chip);



            group.append(chip);



        }



        // Async refresh: fetch profiles, insert missing job icons, and update labels



        window.api.profilesList().then((profiles: Profile[]) => {



            for (const p of profiles)



                rememberProfileName(p.id, p.name, p.job);



            for (const { chip, cellId } of missingJobs) {



                const job = getProfileJob(cellId);



                const icon = createJobIcon(job ?? undefined, "tabJobIcon");



                if (icon) {



                    const label = chip.querySelector(".tabLabel");



                    if (label) chip.insertBefore(icon, label);



                    else chip.prepend(icon);



                }



            }



            // Update chip labels with resolved profile names



            for (const chip of chips) {



                const pid = chip.dataset.profileId;



                if (!pid) continue;



                const resolved = getProfileLabel(pid);



                const label = chip.querySelector(".tabLabel");



                if (label && label.textContent !== resolved) {



                    label.textContent = resolved;



                }



                chip.title = resolved;



            }



        }).catch(console.error);



        return { group, chips };



    }







    function renderLayoutTabUi(tab: Tab): void {



        if (tab.type !== "layout" || !tab.layout)



            return;



        const mode = layoutTabDisplay;



        (tab.tabBtn as HTMLButtonElement).type = "button";



        tab.cellButtons = undefined;



        tab.tabBtn.className = "tabBtn layoutTab";



        tab.tabBtn.dataset.layoutType = tab.layout.type;



        tab.tabBtn.dataset.display = mode;



        tab.tabBtn.replaceChildren();



        tab.tabBtn.draggable = true;



        if (mode === "compact") {



            const iconSpan = el("span", "layoutTabIcon", "≡");


            const nameSpan = el("span", "tabLabel", tab.name);



            const badge = el("span", "layoutTabBadge", String(tab.layout.cells.length));



            const closeBtn = el("span", "tabClose", "×");



            closeBtn.onclick = (e) => {



                e.stopPropagation();



                handleLayoutCloseClick(tab.id);



            };



            tab.tabBtn.append(iconSpan, nameSpan, badge, closeBtn);



        }



        else if (mode === "mini-grid") {



            tab.tabBtn.classList.add("layoutMode-mini-grid");



            const config = GRID_CONFIGS[tab.layout.type] ?? { rows: 1, cols: 1 };



            const grid = el("div", "miniGrid");



            (grid as HTMLElement).style.setProperty("--mg-rows", String(config.rows));



            (grid as HTMLElement).style.setProperty("--mg-cols", String(config.cols));



            const sortedCells = [...tab.layout.cells].sort((a, b) => a.position - b.position);



            const cellEls: HTMLElement[] = [];



            for (const cell of sortedCells) {



                const cellEl = el("div", "miniGridCell");



                cellEl.dataset.profileId = cell.id;



                cellEl.title = getProfileLabel(cell.id);



                const job = getProfileJob(cell.id);



                const icon = createJobIcon(job ?? undefined, "miniGridIcon");



                if (icon) cellEl.append(icon);



                else cellEl.append(el("span", "miniGridDot", ""));



                grid.append(cellEl);



                cellEls.push(cellEl);



            }



            const closeBtn = el("span", "tabClose", "×");



            closeBtn.onclick = (e) => {



                e.stopPropagation();



                handleLayoutCloseClick(tab.id);



            };



            tab.tabBtn.append(grid, closeBtn);



            tab.cellButtons = cellEls;



        }



        else {



            const { group, chips } = buildLayoutChips(tab.layout);



            if (mode === "grouped")



                group.classList.add("tight");



            if (mode === "separated")



                group.classList.add("separated");



            tab.tabBtn.classList.add(`layoutMode-${mode}`);



            const closeBtn = el("span", "tabClose", "×");



            closeBtn.onclick = (e) => {



                e.stopPropagation();



                handleLayoutCloseClick(tab.id);



            };



            tab.tabBtn.append(group, closeBtn);



            tab.cellButtons = chips;



        }



        tab.tabBtn.onclick = () => {



            switchToTab(tab.id).catch(console.error);



        };



        tab.tabBtn.oncontextmenu = (e) => {



            e.preventDefault();



            showLayoutTabContextMenu(tab.id, e as MouseEvent);



        };



    }







    /**



     * Create a layout tab from a LayoutState.



     * This creates a single tab that represents multiple profiles in a grid/split layout.



     */



    async function createLayoutTab(layout: LayoutState, name?: string): Promise<Tab> {



        const id = generateTabId();



        const displayName = await deriveLayoutTabName(layout, name);







        const tab: Tab = {



            id,



            type: "layout",



            layout,



            name: displayName,



            tabBtn: document.createElement("button"),



        };







        renderLayoutTabUi(tab);



        attachDnd(tab.tabBtn, id);



        return tab;



    }







    /**



     * Dissolve a layout tab back into individual single tabs.



     */



    async function handleLayoutCloseClick(tabId: string) {



        const layoutTab = findTabById(tabId);



        if (!layoutTab || layoutTab.type !== "layout") return;



        // Ensure this layout is active so getCloseTarget picks it up



        if (activeTabId !== tabId) {



            await switchToTab(tabId);



        }



        await handleCloseChoice();



    }







    async function dissolveLayoutTab(tabId: string) {



        const layoutTab = findTabById(tabId);



        if (!layoutTab || layoutTab.type !== "layout" || !layoutTab.layout) return;







        const wasActive = activeTabId === tabId;



        const profiles = layoutTab.layout.cells.map((c) => c.id);







        // Remove the layout tab



        const idx = tabs.findIndex((t) => t.id === tabId);



        if (idx >= 0) {



            tabs[idx].tabBtn.remove();



            tabs.splice(idx, 1);



        }







        // Create single tabs for each profile (BrowserViews already exist)



        for (const profileId of profiles) {



            if (!findSingleTab(profileId)) {



                // Need to create single tab button (view already exists in main)



                const profilesList: Profile[] = await window.api.profilesList();



                const p = profilesList.find((x) => x.id === profileId);



                rememberProfileName(profileId, p?.name, p?.job);



                const title = p?.name ?? profileId;







                const tabBtn = document.createElement("button");



                tabBtn.className = "tabBtn sessionTab";



                tabBtn.dataset.title = title;



                const splitGlyph = el("span", "tabGlyph", "");



                (splitGlyph as HTMLElement).style.display = "none";



                const jobIcon = createJobIcon(p?.job, "tabJobIcon");



                const label = el("span", "tabLabel", title);



                if (p?.job?.trim()) tabBtn.title = p.job;



                const closeBtn = el("span", "tabClose", "×");



                closeBtn.onclick = (e) => {



                    e.stopPropagation();



                    handleCloseChoice(profileId).catch(console.error);



                };



                tabBtn.append(splitGlyph);



                if (jobIcon) tabBtn.append(jobIcon);



                tabBtn.append(label, closeBtn);



                tabBtn.onclick = () => {



                    setActive(profileId, "left").catch(console.error);



                };



                tabBtn.addEventListener("contextmenu", (e) => {



                    e.preventDefault();



                    setActive(profileId, "right").catch(console.error);



                });



                attachDnd(tabBtn, profileId);







                const tab: Tab = {



                    id: generateTabId(),



                    type: "single",



                    profileId,



                    name: title,



                    tabBtn,



                    loggedOut: false,



                };



                tabs.push(tab);



            }



        }







        // Clear layout state



        layoutState = null;







        renderTabsOrder();



        updateSplitButton();



        syncTabClasses();



        updateSplitGlyphs();







        // Activate the first profile if this was the active tab



        if (wasActive && profiles.length > 0) {



            await setActive(profiles[0]);



        }







        scheduleAutoSave();



        updateWindowTitle();



        showToast(t("layout.dissolved") || "Layout aufgelöst", "info");



    }







    /**



     * Show context menu for layout tab (rename, dissolve)



     */



    async function showLayoutTabContextMenu(tabId: string, e: MouseEvent) {



        const tab = findTabById(tabId);



        if (!tab || tab.type !== "layout") return;



        e.preventDefault();



        // Ask main process to show a native context menu (drawn above BrowserViews)



        const choice = await window.api.sessionTabsShowLayoutMenu?.({ x: e.screenX, y: e.screenY });



        if (choice === "rename") {



            const newName = await askLayoutName(tab.name);



            if (newName && newName !== tab.name) {



                tab.name = newName;



                renderLayoutTabUi(tab);



                scheduleAutoSave();



            }



        }



        else if (choice === "dissolve") {



            dissolveLayoutTab(tabId).catch(console.error);



        }



    }







    /**



     * Activate a multi-view layout, creating a layout tab and removing single tabs for those profiles.



     */



    async function activateMultiLayout(layout: LayoutState, name?: string, targetTabId?: string | null) {



        // Remove existing single tabs for profiles that will be in the layout



        for (const cell of layout.cells) {



            const existingSingle = findSingleTab(cell.id);



            if (existingSingle) {



                existingSingle.tabBtn.remove();



                const idx = tabs.indexOf(existingSingle);



                if (idx >= 0) tabs.splice(idx, 1);



            }



        }







        const isSingleLayout = layout.type === "single" && layout.cells.length === 1;



        if (isSingleLayout) {



            const profileId = layout.cells[0].id;



            await openTab(profileId);



            layoutState = null;



            activeProfileId = profileId;



            activeTabId = findSingleTab(profileId)?.id ?? activeTabId;



            currentSplitRatio = defaultSplitRatio;



            return;



        }







        const activeTab = getActiveTab();



        const explicitTarget = targetTabId ? findTabById(targetTabId) : null;



        const targetLayoutTab =



            explicitTarget && explicitTarget.type === "layout"



                ? explicitTarget



                : activeTab?.type === "layout" && activeTab.layout?.type === layout.type



                    ? activeTab



                    : null;







        if (targetLayoutTab) {



            const resolvedName = await deriveLayoutTabName(layout, name ?? targetLayoutTab.name);



            targetLayoutTab.layout = layout;



            targetLayoutTab.name = resolvedName;



            renderLayoutTabUi(targetLayoutTab);







            layoutState = layout;



            activeTabId = targetLayoutTab.id;



        }



        else {



            // Create new layout tab



            const layoutTab = await createLayoutTab(layout, name);



            tabs.push(layoutTab);



            tabsBar.insertBefore(layoutTab.tabBtn, tabsSpacer);







            layoutState = layout;



            activeTabId = layoutTab.id;



        }







        // Set active profile from layout



        const activeCell = layout.cells.find((c) => c.position === layout.activePosition) ?? layout.cells[0];



        activeProfileId = activeCell?.id ?? null;



        currentSplitRatio = layout.ratio ?? currentSplitRatio;







        const startedHere = !loadProgress.active;



        if (!sequentialGridLoad) {



            // Parallel: create all BrowserViews, then push layout once



            const orderedCells = [...layout.cells];



            if (startedHere) startLoadProgress(orderedCells.length);



            await Promise.all(



                orderedCells.map((cell) =>



                    window.api.sessionTabsOpen(cell.id).catch(console.error).then(() => incrementLoadProgress())



                )



            );



            await pushLayoutToMain();



        }



        else {



            // Sequential: push full layout skeleton first, then materialize each cell one by one



            const orderedCells = [...layout.cells].sort((a, b) => a.position - b.position);



            const totalCells = orderedCells.length;



            if (startedHere)



                startLoadProgress(totalCells);



            const skeletonLayout: LayoutState = {



                type: layout.type,



                cells: orderedCells,



                ratio: layout.ratio,



                activePosition: layout.activePosition ?? orderedCells[0].position,



            };



            await window.api.sessionTabsSetMultiLayout(skeletonLayout, { ensureViews: false, allowMissingViews: true }).catch(console.error);



            pushBoundsInternal(true);







            const delayMs = getLayoutDelayMs();



            for (let i = 0; i < orderedCells.length; i += 1) {



                const cell = orderedCells[i];



                await window.api.sessionTabsOpenInCell(cell.position, cell.id, {



                    activate: cell.position === skeletonLayout.activePosition,



                }).catch(console.error);



                pushBoundsInternal(true);



                incrementLoadProgress();



                if (i < orderedCells.length - 1 && delayMs > 0) {



                    await sleep(delayMs);



                }



            }



            // Apply the delay once more after the last view to avoid an immediate tab switch



            if (orderedCells.length > 1 && delayMs > 0) {



                await sleep(delayMs);



            }







            // Finalize layout with correct bounds/ratio and disable missing-view tolerance



            const finalLayoutForMain: LayoutState = {



                type: layout.type,



                cells: orderedCells,



                ratio: layout.ratio ?? currentSplitRatio,



                activePosition: skeletonLayout.activePosition,



            };



            await window.api.sessionTabsSetMultiLayout(finalLayoutForMain, { ensureViews: true, allowMissingViews: false }).catch(console.error);



            // Fortschritt wird nur abgeschlossen, wenn alle geplanten Tabs/Views fertig sind



        }







        if (activeProfileId) {



            await window.api.sessionTabsSwitch(activeProfileId);



        }







        updateSplitButton();



        updateSplitGlyphs();



        syncTabClasses();



        kickBounds();



        scheduleAutoSave();



    }







    let pendingSplitAnchor: string | null = null;



    let closePromptOpen = false;



    let currentLayoutId: string | null = null;



    let isApplyingLayout = false;



    const TAB_HEIGHT_KEY = "sessionTabHeightPx";



    const tabHeightPresets = [28, 32, 36, 40, 44, 48, 52, 56, 60, 64];



    function loadTabHeight() {



        try {



            const raw = localStorage.getItem(TAB_HEIGHT_KEY);



            const num = raw ? Number(raw) : NaN;



            if (Number.isFinite(num))



                return num;



        }



        catch (err) {



            logErr(err, "renderer");



        }



        return tabHeightPresets[1];



    }



    function persistTabHeight(px: number) {



        try {



            localStorage.setItem(TAB_HEIGHT_KEY, String(px));



        }



        catch (err) {



            logErr(err, "renderer");



        }



    }



    function applyTabHeight(px: number) {



        const clamped = Math.max(28, Math.min(64, Math.round(px)));



        document.documentElement.style.setProperty("--session-tab-height", `${clamped}px`);



        persistTabHeight(clamped);



        return clamped;



    }



    let tabHeightPx = applyTabHeight(loadTabHeight());



    function clampSplitRatio(r: number) {



        const value = Number.isFinite(r) ? r : defaultSplitRatio;



        return Math.min(maxSplitRatio, Math.max(minSplitRatio, value));



    }



    function normalizeLayoutState(next: LayoutState | null): LayoutState | null {



        if (!next)



            return null;



        const config = GRID_CONFIGS[next.type];



        if (!config)



            return null;



        const maxPositions = config.rows * config.cols;



        const unique = new Map<number, GridCell>();



        for (const cell of next.cells) {



            const pos = Math.max(0, Math.min(maxPositions - 1, cell.position));



            if (!unique.has(pos)) {



                unique.set(pos, { id: cell.id, position: pos });



            }



        }



        const cells = Array.from(unique.values()).sort((a, b) => a.position - b.position).slice(0, config.maxViews);



        if (cells.length === 0)



            return null;



        const activePosition = next.activePosition !== undefined && cells.some((c) => c.position === next.activePosition)



            ? next.activePosition



            : cells[0].position;



        const ratio = next.type === "split-2" ? clampSplitRatio(next.ratio ?? currentSplitRatio) : undefined;



        return { type: next.type, cells, ratio, activePosition };



    }



    function pruneLayoutState(): void {



        if (!layoutState)



            return;



        // Collect all known profile IDs from single tabs AND layout tabs



        const existing = new Set<string>();



        for (const t of tabs) {



            if (t.type === "single" && t.profileId) {



                existing.add(t.profileId);



            } else if (t.type === "layout" && t.layout) {



                for (const cell of t.layout.cells) {



                    existing.add(cell.id);



                }



            }



        }



        layoutState = normalizeLayoutState({



            ...layoutState,



            cells: layoutState.cells.filter((c) => existing.has(c.id)),



        });



        if (layoutState) {



            const activeCell = layoutState.cells.find((c) => c.position === layoutState!.activePosition) ?? layoutState.cells[0];



            activeProfileId = activeCell?.id ?? activeProfileId;



            currentSplitRatio = layoutState.ratio ?? currentSplitRatio;



        }



    }



    async function pushLayoutToMain(): Promise<void> {



        pruneLayoutState();



        const activeIsLoggedOut = isProfileLoggedOut(activeProfileId);



        if (layoutState) {



            const opts = layoutHasLoggedOut(layoutState)



                ? { ensureViews: false, allowMissingViews: true }



                : undefined;



            await window.api.sessionTabsSetMultiLayout?.(layoutState, opts);



            return;



        }



        if (activeProfileId) {



            if (activeIsLoggedOut) {



                const skeleton: LayoutState = {



                    type: "single",



                    cells: [{ id: activeProfileId, position: 0 }],



                    ratio: currentSplitRatio,



                    activePosition: 0,



                };



                await window.api.sessionTabsSetMultiLayout?.(skeleton, { ensureViews: false, allowMissingViews: true });



                return;



            }



            await window.api.sessionTabsSwitch(activeProfileId).catch((err) => logErr(err, "renderer"));



            return;



        }



        await window.api.sessionTabsSetMultiLayout?.(null);



    }



    const tabsSpacer = el("div", "spacer");



    const btnSplit = el("button", "tabBtn iconBtn plus", "+") as HTMLButtonElement;



    btnSplit.draggable = false;



    const splitControls = el("div", "splitControls") as HTMLDivElement;



    splitControls.style.display = "none";



    const splitSlider = document.createElement("input");



    splitSlider.type = "range";



    splitSlider.className = "splitSlider";



    splitSlider.min = String(Math.round(minSplitRatio * 100));



    splitSlider.max = String(Math.round(maxSplitRatio * 100));



    splitSlider.value = String(Math.round(defaultSplitRatio * 100));



    splitSlider.step = "1";



    splitSlider.title = "Fensteraufteilung anpassen";



    splitSlider.ariaLabel = "Fensteraufteilung anpassen";



    const splitSliderValue = el("span", "splitSliderValue", "50 / 50");



    splitControls.append(splitSlider, splitSliderValue);



    const btnTabHeight = el("button", "tabBtn iconBtn", `${tabHeightPx}↕`) as HTMLButtonElement;



    btnTabHeight.title = `${t("tabHeight.label")}: ${tabHeightPx}px`;



    btnTabHeight.draggable = false;



    btnTabHeight.onclick = () => {



        const idx = tabHeightPresets.findIndex((v) => v === tabHeightPx);



        const nextIdx = (idx + 1) % tabHeightPresets.length;



        tabHeightPx = applyTabHeight(tabHeightPresets[nextIdx]);



        btnTabHeight.textContent = `${tabHeightPx}↕`;



        btnTabHeight.title = `${t("tabHeight.label")}: ${tabHeightPx}px`;



        kickBounds();



    };



    // ── Hotkeys view button ──
    const btnHotkeys = el("button", "tabBtn iconBtn hotkeysToggle") as HTMLButtonElement;
    btnHotkeys.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.4"/><rect x="3.5" y="5.5" width="2" height="2" rx="0.4" fill="currentColor"/><rect x="7" y="5.5" width="2" height="2" rx="0.4" fill="currentColor"/><rect x="10.5" y="5.5" width="2" height="2" rx="0.4" fill="currentColor"/><rect x="4.5" y="9" width="7" height="1.8" rx="0.4" fill="currentColor"/></svg>`;
    btnHotkeys.title = "Hotkeys";
    btnHotkeys.draggable = false;
    btnHotkeys.setAttribute("aria-label", "Hotkeys");

    const hotkeysMenu = el("div", "toolsMenu hotkeysMenu") as HTMLDivElement;
    hotkeysMenu.style.position = "fixed";
    hotkeysMenu.style.zIndex = "99999";
    hotkeysMenu.style.display = "none";
    const hotkeysList = el("div", "toolsMenuList");
    hotkeysMenu.append(hotkeysList);

    let hotkeysMenuOpen = false;

    const handleHotkeysOutsideClick = (e: MouseEvent) => {
        if (!(e.target instanceof Node)) return;
        if (hotkeysMenu.contains(e.target) || btnHotkeys.contains(e.target)) return;
        closeHotkeysMenu();
    };
    const handleHotkeysKeydown = (e: KeyboardEvent) => {
        if (e.key === "Escape") closeHotkeysMenu();
    };

    function closeHotkeysMenu() {
        if (!hotkeysMenuOpen) return;
        hotkeysMenu.classList.remove("show");
        hotkeysMenu.style.display = "none";
        btnHotkeys.setAttribute("aria-expanded", "false");
        hotkeysMenuOpen = false;
        document.removeEventListener("mousedown", handleHotkeysOutsideClick);
        document.removeEventListener("keydown", handleHotkeysKeydown);
        window.removeEventListener("resize", closeHotkeysMenu);
        void showSessionViews();
    }

    function positionHotkeysMenu() {
        const btnRect = btnHotkeys.getBoundingClientRect();
        const menuWidth = hotkeysMenu.offsetWidth || 260;
        const viewportW = window.innerWidth;
        let left = btnRect.left;
        if (left + menuWidth > viewportW - 8) {
            left = Math.max(8, btnRect.right - menuWidth);
        }
        hotkeysMenu.style.left = `${left}px`;
        hotkeysMenu.style.top = `${btnRect.bottom + 6}px`;
    }

    async function openHotkeysMenu() {
        hotkeysList.innerHTML = "";
        try {
            const settings = await window.api.clientSettingsGet();
            const hk = settings?.hotkeys;
            const HOTKEY_LABELS: Record<string, string> = {
                toggleOverlays: t("config.client.hotkeys.toggleOverlays" as TranslationKey),
                sidePanelToggle: t("config.client.hotkeys.sidePanelToggle" as TranslationKey),
                tabBarToggle: t("config.client.hotkeys.tabBarToggle" as TranslationKey),
                screenshotWindow: t("config.client.hotkeys.screenshotWindow" as TranslationKey),
                tabPrev: t("config.client.hotkeys.tabPrev" as TranslationKey),
                tabNext: t("config.client.hotkeys.tabNext" as TranslationKey),
                nextInstance: t("config.client.hotkeys.nextInstance" as TranslationKey),
                cdTimerExpireAll: t("config.client.hotkeys.cdTimerExpireAll" as TranslationKey),
                showFcoinConverter: t("config.client.hotkeys.showFcoinConverter" as TranslationKey),
                showShoppingList: t("config.client.hotkeys.showShoppingList" as TranslationKey),
            };
            let count = 0;
            if (hk) {
                for (const [key, chord] of Object.entries(hk)) {
                    const formatted = formatHotkey(chord);
                    if (!formatted) continue;
                    const item = el("div", "toolsMenuItem hotkeysItem");
                    const label = el("span", "toolsMenuLabel", HOTKEY_LABELS[key] || key);
                    const badge = el("span", "toolsMenuArrow hotkeyBadge", formatted);
                    item.append(label, badge);
                    hotkeysList.append(item);
                    count++;
                }
            }
            if (count === 0) {
                const empty = el("div", "toolsMenuItem muted", t("config.client.hotkeys.tabBarToggle.hint" as TranslationKey) || "No hotkeys set");
                hotkeysList.append(empty);
            }
        } catch (err) {
            logErr(err, "renderer");
            const errItem = el("div", "toolsMenuItem muted", "Error loading hotkeys");
            hotkeysList.append(errItem);
        }
        hotkeysMenu.style.display = "flex";
        hotkeysMenu.classList.add("show");
        positionHotkeysMenu();
        const rect = hotkeysMenu.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            hotkeysMenu.style.left = "12px";
            hotkeysMenu.style.top = "48px";
        } else if (rect.right > window.innerWidth - 8) {
            hotkeysMenu.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`;
        }
        btnHotkeys.setAttribute("aria-expanded", "true");
        hotkeysMenuOpen = true;
        void hideSessionViews();
        document.addEventListener("mousedown", handleHotkeysOutsideClick);
        document.addEventListener("keydown", handleHotkeysKeydown);
        window.addEventListener("resize", closeHotkeysMenu);
    }

    function toggleHotkeysMenu() {
        if (hotkeysMenuOpen) closeHotkeysMenu();
        else void openHotkeysMenu();
    }

    btnHotkeys.onclick = toggleHotkeysMenu;

    const btnTools = el("button", "tabBtn iconBtn toolsToggle", "★") as HTMLButtonElement;



    btnTools.title = "Tools";



    btnTools.draggable = false;



    btnTools.setAttribute("aria-label", "Tools");



    const btnEditMode = el("button", "tabBtn iconBtn lockToggle", "🔒") as HTMLButtonElement;



    btnEditMode.title = "Profile ausloggen";



    btnEditMode.draggable = false;



    const btnSaveLayout = el("button", "tabBtn iconBtn", "💾") as HTMLButtonElement;



    btnSaveLayout.title = t("layout.saveCurrent");



    btnSaveLayout.draggable = false;



    const btnLayouts = el("button", "tabBtn iconBtn", "📂") as HTMLButtonElement;



    btnLayouts.title = t("layout.pick");



    btnLayouts.draggable = false;



    const toolsMenu = el("div", "toolsMenu") as HTMLDivElement;

    // Inline defaults as Fallback, falls CSS nicht greift

    toolsMenu.style.position = "fixed";

    toolsMenu.style.zIndex = "99999";

    toolsMenu.style.display = "none";

    const toolsList = el("div", "toolsMenuList");

    toolsMenu.append(toolsList);

    let toolsMenuOpen = false;

    const handleToolsOutsideClick = (e: MouseEvent) => {



        if (!(e.target instanceof Node))



            return;



        if (toolsMenu.contains(e.target) || btnTools.contains(e.target))



            return;



        closeToolsMenu();



    };



    const handleToolsKeydown = (e: KeyboardEvent) => {



        if (e.key === "Escape") {



            closeToolsMenu();



        }



    };



    function closeToolsMenu() {

        if (!toolsMenuOpen)

            return;

        toolsMenu.classList.remove("show");

        toolsMenu.style.display = "none";

        btnTools.setAttribute("aria-expanded", "false");

        toolsMenuOpen = false;

        document.removeEventListener("mousedown", handleToolsOutsideClick);

        document.removeEventListener("keydown", handleToolsKeydown);

        window.removeEventListener("resize", closeToolsMenu);

        void showSessionViews();

    }

    function positionToolsMenu() {

        const btnRect = btnTools.getBoundingClientRect();

        toolsMenu.style.left = `${btnRect.left}px`;

        toolsMenu.style.top = `${btnRect.bottom + 6}px`;

    }

    function openToolsMenu() {

        positionToolsMenu();

        toolsMenu.style.display = "flex";

        toolsMenu.classList.add("show");

        // Fallback: falls Größe 0 (z.B. CSS nicht geladen), setze Standard-Offset

        const rect = toolsMenu.getBoundingClientRect();

        if (rect.width === 0 || rect.height === 0) {

            toolsMenu.style.left = "12px";

            toolsMenu.style.top = "48px";

        }

        btnTools.setAttribute("aria-expanded", "true");

        toolsMenuOpen = true;

        void hideSessionViews();

        document.addEventListener("mousedown", handleToolsOutsideClick);

        document.addEventListener("keydown", handleToolsKeydown);

        window.addEventListener("resize", closeToolsMenu);

    }



    function toggleToolsMenu() {



        if (toolsMenuOpen) {



            closeToolsMenu();



        }



        else {



            openToolsMenu();



        }



    }



    type ToolEntry = { label: string; icon?: string; action: () => void; group?: "internal" | "external" };

    const showFcoinConverter = async () => {
        closeToolsMenu();
        // Open the popup window BEFORE any async calls so the user-gesture/activation
        // context is still active (Chromium expires it after the first await).
        const win = window.open(
            "",
            "fcoinConverter",
            "width=320,height=420,menubar=no,toolbar=no,location=no,status=no,resizable=yes"
        );
        if (!win) {
            alert("Pop-up could not be opened. Please allow pop-ups.");
            return;
        }
        const settings = await window.api.clientSettingsGet();
        const savedRate = settings.fcoinRate;
        const fmtVal = (n: number) => new Intl.NumberFormat("de-DE").format(n);
        // Read current theme colors from the launcher
        const cs = getComputedStyle(document.documentElement);
        const accentRgb = cs.getPropertyValue("--accent-rgb").trim() || "44,107,255";
        const bg = cs.getPropertyValue("--bg").trim() || "#0b1220";
        const text = cs.getPropertyValue("--text").trim() || "#e6eefc";
        const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8"/>
<title>FCoins ⇄ Penya</title>
<style>
  :root{color-scheme:dark;--ar:${accentRgb};--bg:${bg};--text:${text}}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;overflow:hidden}
  .card{width:100%;max-width:280px;display:flex;flex-direction:column;gap:14px}
  h1{font-size:14px;font-weight:700;letter-spacing:0.02em;text-align:center;color:rgba(var(--ar),0.9)}
  .field{display:flex;flex-direction:column;gap:5px}
  .field label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:rgba(var(--ar),0.6)}
  .field input{width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(var(--ar),0.25);background:rgba(var(--ar),0.06);color:var(--text);font-size:15px;font-variant-numeric:tabular-nums;transition:border-color .15s,box-shadow .15s}
  .field input:focus{outline:none;border-color:rgba(var(--ar),0.7);box-shadow:0 0 0 2px rgba(var(--ar),0.15)}
  .sep{height:1px;background:rgba(var(--ar),0.15);margin:2px 0}
  .result input{font-weight:700;border-color:rgba(var(--ar),0.5);background:rgba(var(--ar),0.1)}
  .hint{color:rgba(var(--ar),0.45);font-size:11px;text-align:center;line-height:1.5}
</style>
</head>
<body>
<div class="card">
  <h1>FCoins ⇄ Penya</h1>
  <div class="field"><label for="rate">Penya / FCoin</label><input id="rate" type="text" inputmode="decimal" value="${fmtVal(savedRate)}"/></div>
  <div class="field"><label for="amount">FCoins</label><input id="amount" type="text" inputmode="decimal" value="60"/></div>
  <div class="sep"></div>
  <div class="field result"><label for="penya">Penya Ergebnis</label><input id="penya" type="text" inputmode="decimal" value="${fmtVal(savedRate * 60)}"/></div>
  <div class="hint">Werte ändern – Berechnung erfolgt automatisch.</div>
</div>
<script>
  const rateInput=document.getElementById('rate');
  const amountInput=document.getElementById('amount');
  const penyaInput=document.getElementById('penya');
  const fmt=new Intl.NumberFormat('de-DE');
  let lock=false;
  const parse=(v)=>Number(v.replace(/\\./g,'').replace(',','.'));
  const fmtN=(n)=>Number.isFinite(n)?fmt.format(n):'';
  function calcForward(){
    if(lock)return;
    const r=parse(rateInput.value),a=parse(amountInput.value);
    if(!Number.isFinite(r)||r<=0||!Number.isFinite(a)||a<0){penyaInput.value='';return}
    lock=true;penyaInput.value=fmtN(r*a);lock=false;
  }
  function calcReverse(){
    if(lock)return;
    const r=parse(rateInput.value),p=parse(penyaInput.value);
    if(!Number.isFinite(r)||r<=0||!Number.isFinite(p)||p<0){amountInput.value='';return}
    lock=true;amountInput.value=fmtN(p/r);lock=false;
  }
  rateInput.addEventListener('input',calcForward);
  amountInput.addEventListener('input',calcForward);
  penyaInput.addEventListener('input',calcReverse);
  rateInput.addEventListener('blur',()=>{const v=parse(rateInput.value);if(Number.isFinite(v)&&v>0){rateInput.value=fmtN(v);window.opener?.api?.clientSettingsPatch({fcoinRate:v})}});
  amountInput.addEventListener('blur',()=>{const v=parse(amountInput.value);if(Number.isFinite(v))amountInput.value=fmtN(v)});
  penyaInput.addEventListener('blur',()=>{const v=parse(penyaInput.value);if(Number.isFinite(v))penyaInput.value=fmtN(v)});
  calcForward();rateInput.focus();rateInput.select();
</script>
</body>
</html>`;
        win.document.open();
        win.document.write(html);
        win.document.close();
    };

    const showShoppingList = () => {
        closeToolsMenu();
        const win = window.open(
            "",
            "premiumShoppingList",
            "width=520,height=650,menubar=no,toolbar=no,location=no,status=no,resizable=yes"
        );
        if (!win) {
            alert("Pop-up could not be opened. Please allow pop-ups.");
            return;
        }
        const cs = getComputedStyle(document.documentElement);
        const accentRgb = cs.getPropertyValue("--accent-rgb").trim() || "44,107,255";
        const bg = cs.getPropertyValue("--bg").trim() || "#0b1220";
        const text = cs.getPropertyValue("--text").trim() || "#e6eefc";
        const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>${t("config.client.hotkeys.showShoppingList" as TranslationKey)}</title>
<style>
:root{color-scheme:dark;--ar:${accentRgb};--bg:${bg};--text:${text}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);display:flex;flex-direction:column;height:100vh;overflow:hidden}
.header{padding:12px 16px 0;flex-shrink:0}
.header h1{font-size:14px;font-weight:700;letter-spacing:.02em;color:rgba(var(--ar),.9);margin-bottom:10px}
#searchInput{width:100%;padding:9px 12px;border-radius:8px;border:1px solid rgba(var(--ar),.25);background:rgba(var(--ar),.06);color:var(--text);font-size:13px}
#searchInput:focus{outline:none;border-color:rgba(var(--ar),.7);box-shadow:0 0 0 2px rgba(var(--ar),.15)}
#searchInput::placeholder{color:rgba(var(--ar),.4)}
.search-results{max-height:180px;overflow-y:auto;margin:6px 16px 0;border-radius:8px}
.search-results::-webkit-scrollbar{width:6px}
.search-results::-webkit-scrollbar-thumb{background:rgba(var(--ar),.25);border-radius:3px}
.sr-item{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid rgba(var(--ar),.08);cursor:default}
.sr-item:hover{background:rgba(var(--ar),.08)}
.sr-icon{width:28px;height:28px;border-radius:4px;background:rgba(var(--ar),.1);flex-shrink:0;object-fit:contain}
.sr-name{flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sr-cat{font-size:10px;color:rgba(var(--ar),.5);margin-left:4px}
.sr-add{padding:3px 10px;border:none;border-radius:6px;background:rgba(var(--ar),.18);color:rgba(var(--ar),.9);font-size:11px;font-weight:700;cursor:pointer}
.sr-add:hover{background:rgba(var(--ar),.3)}
.divider{height:1px;background:rgba(var(--ar),.15);margin:8px 16px}
.list-header{padding:4px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(var(--ar),.5)}
.cart{flex:1;overflow-y:auto;padding:0 16px}
.cart::-webkit-scrollbar{width:6px}
.cart::-webkit-scrollbar-thumb{background:rgba(var(--ar),.25);border-radius:3px}
.cart-empty{text-align:center;color:rgba(var(--ar),.3);font-size:12px;padding:24px 0}
.cart-row{display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(var(--ar),.06)}
.cart-check{width:15px;height:15px;accent-color:rgba(var(--ar),.8);flex-shrink:0;cursor:pointer;margin:0}
.cart-row.checked .cart-name,.cart-row.checked .cart-input{opacity:.4;text-decoration:line-through}
.cart-icon{width:24px;height:24px;border-radius:4px;background:rgba(var(--ar),.1);flex-shrink:0;object-fit:contain}
.cart-name{flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.cart-input{width:72px;padding:4px 6px;border-radius:6px;border:1px solid rgba(var(--ar),.2);background:rgba(var(--ar),.06);color:var(--text);font-size:12px;text-align:right;font-variant-numeric:tabular-nums}
.cart-input:focus{outline:none;border-color:rgba(var(--ar),.6)}
.cart-qty{width:40px}
.cart-del{background:none;border:none;color:rgba(var(--ar),.4);font-size:15px;cursor:pointer;padding:2px 6px}
.cart-del:hover{color:#ff5c5c}
.total-bar{flex-shrink:0;padding:10px 16px;border-top:1px solid rgba(var(--ar),.2);display:flex;justify-content:flex-end;align-items:center;font-size:14px;font-weight:700;color:rgba(var(--ar),.9)}
</style></head><body>
<div class="header"><h1>${t("config.client.hotkeys.showShoppingList" as TranslationKey)}</h1>
<input id="searchInput" type="text" placeholder="Search items..." autocomplete="off"/></div>
<div id="searchResults" class="search-results"></div>
<div class="divider"></div>
<div class="list-header">Shopping List</div>
<div id="cart" class="cart"><div class="cart-empty">Add items from search above</div></div>
<div id="totalBar" class="total-bar">TOTAL: 0 FCoins</div>
<script>
const api=window.opener?.api;
const searchInput=document.getElementById('searchInput');
const searchResults=document.getElementById('searchResults');
const cartEl=document.getElementById('cart');
const totalBar=document.getElementById('totalBar');
const cart=[];
const iconCache=new Map();
let debounceTimer=null;
const locale=(navigator.language||'en').slice(0,2);
const fmt=n=>new Intl.NumberFormat('de-DE').format(n);

async function loadIcon(filename,imgEl){
  if(!filename){return}
  if(iconCache.has(filename)){imgEl.src=iconCache.get(filename);return}
  try{
    const url=await api.shoppingListIcon(filename);
    if(url){iconCache.set(filename,url);imgEl.src=url}
  }catch(e){}
}

async function doSearch(q){
  if(!q||q.length<1){searchResults.innerHTML='';return}
  try{
    const results=await api.shoppingListSearch(q,locale);
    searchResults.innerHTML='';
    if(!results||results.length===0){searchResults.innerHTML='<div style="padding:8px 12px;font-size:11px;color:rgba(var(--ar),.4)">No results</div>';return}
    for(const item of results){
      const row=document.createElement('div');row.className='sr-item';
      const img=document.createElement('img');img.className='sr-icon';img.alt='';row.appendChild(img);
      loadIcon(item.icon,img);
      const name=document.createElement('span');name.className='sr-name';name.textContent=item.name[locale]||item.name['en']||('Item #'+item.id);row.appendChild(name);
      if(item.category){const cat=document.createElement('span');cat.className='sr-cat';cat.textContent=item.category;row.appendChild(cat)}
      const btn=document.createElement('button');btn.className='sr-add';btn.textContent='+ Add';
      btn.onclick=()=>addToCart(item);row.appendChild(btn);
      searchResults.appendChild(row);
    }
  }catch(e){searchResults.innerHTML=''}
}

searchInput.addEventListener('input',()=>{
  clearTimeout(debounceTimer);
  debounceTimer=setTimeout(()=>doSearch(searchInput.value.trim()),300);
});

function addToCart(item){
  const existing=cart.find(c=>c.id===item.id);
  if(existing){existing.qty++;renderCart();return}
  cart.push({id:item.id,name:item.name[locale]||item.name['en']||('Item #'+item.id),icon:item.icon,price:item.savedPrice||0,qty:1,checked:false});
  renderCart();
}

function renderCart(){
  cartEl.innerHTML='';
  if(cart.length===0){cartEl.innerHTML='<div class="cart-empty">Add items from search above</div>';updateTotal();return}
  for(let i=0;i<cart.length;i++){
    const c=cart[i];
    const row=document.createElement('div');row.className='cart-row'+(c.checked?' checked':'');
    const cb=document.createElement('input');cb.type='checkbox';cb.className='cart-check';cb.checked=!!c.checked;
    cb.onchange=()=>{c.checked=cb.checked;row.className='cart-row'+(c.checked?' checked':'')};
    row.appendChild(cb);
    const img=document.createElement('img');img.className='cart-icon';img.alt='';row.appendChild(img);
    loadIcon(c.icon,img);
    const name=document.createElement('span');name.className='cart-name';name.title=c.name;name.textContent=c.name;row.appendChild(name);
    const priceIn=document.createElement('input');priceIn.className='cart-input';priceIn.type='text';priceIn.inputMode='numeric';priceIn.value=c.price?fmt(c.price):'';priceIn.placeholder='FCoins';
    priceIn.addEventListener('input',()=>{const v=Number(priceIn.value.replace(/\\./g,'').replace(',','.'));if(Number.isFinite(v)&&v>=0){c.price=v;updateTotal()}});
    priceIn.addEventListener('blur',()=>{if(c.price>0){priceIn.value=fmt(c.price);try{api.shoppingListSavePrice(c.id,c.price)}catch(e){}}});
    row.appendChild(priceIn);
    const qtyIn=document.createElement('input');qtyIn.className='cart-input cart-qty';qtyIn.type='number';qtyIn.min='1';qtyIn.value=String(c.qty);
    qtyIn.addEventListener('input',()=>{const v=parseInt(qtyIn.value,10);if(v>0){c.qty=v;updateTotal()}});
    row.appendChild(qtyIn);
    const del=document.createElement('button');del.className='cart-del';del.textContent='\\u2715';del.onclick=()=>{cart.splice(i,1);renderCart()};
    row.appendChild(del);
    cartEl.appendChild(row);
  }
  updateTotal();
}

function updateTotal(){
  const total=cart.reduce((s,c)=>s+c.price*c.qty,0);
  totalBar.textContent='TOTAL: '+fmt(total)+' FCoins';
}
searchInput.focus();
</script></body></html>`;
        win.document.open();
        win.document.write(html);
        win.document.close();
    };

    const toolEntries: ToolEntry[] = [

        {

            label: "FCoins ⇄ Penya",
            action: showFcoinConverter,
            group: "internal",

        },

        {
            label: t("config.client.hotkeys.showShoppingList" as TranslationKey),
            action: showShoppingList,
            group: "internal",
        },

        {

            label: "Flyff Universe",

            icon: flyffuniverseIcon,

            action: () => window.open("https://universe.flyff.com/", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768"),

        },

        {



            label: "Flyffipedia",



            icon: flyffipediaIcon,



            action: () => window.open("https://flyffipedia.com/home", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768"),



        },



        {



            label: "Flyffulator",



            icon: flyffulatorIcon,



            action: () => window.open("https://flyffulator.com/", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768"),



        },



        {



            label: "Skillulator",



            icon: reskillIcon,



            action: () => window.open("https://skillulator.lol/", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768"),



        },



        ];



    const internalTools = toolEntries.filter((t) => t.group === "internal");
    const externalTools = toolEntries.filter((t) => t.group !== "internal");

    if (internalTools.length > 0) {
        const header = el("div", "toolsMenuHeader", "Interne Tools");
        toolsList.append(header);
        for (const tool of internalTools) appendToolItem(tool);
    }
    if (externalTools.length > 0) {
        const header = el("div", "toolsMenuHeader", "Externe Links");
        toolsList.append(header);
        for (const tool of externalTools) appendToolItem(tool);
    }

    function appendToolItem(tool: ToolEntry) {
        const item = el("button", "toolsMenuItem") as HTMLButtonElement;
        item.type = "button";
        if (tool.icon) {
            const iconImg = document.createElement("img");
            iconImg.src = tool.icon;
            iconImg.alt = "";
            item.append(iconImg);
        }
        const label = el("span", "toolsMenuLabel", tool.label);
        const arrow = el("span", "toolsMenuArrow", "▸");
        item.append(label, arrow);
        item.onclick = () => {
            closeToolsMenu();
            tool.action();



        };



        toolsList.append(item);



    }



    tabsBar.append(tabsSpacer, tabsProgress, splitControls, btnTabHeight, btnHotkeys, btnTools, btnEditMode, btnSaveLayout, btnLayouts, btnSplit);

    document.body.append(toolsMenu, hotkeysMenu);

    function isOpen(profileId: string) {



        // Check if profile is open as a single tab OR part of a layout tab



        return tabs.some((t) =>



            (t.type === "single" && t.profileId === profileId) ||



            (t.type === "layout" && t.layout?.cells.some((c) => c.id === profileId))



        );



    }



    function findTab(profileId: string): Tab | null {



        // Find a single-type tab by profileId (for backward compatibility)



        return tabs.find((t) => t.type === "single" && t.profileId === profileId) ?? null;



    }



    function findSingleTab(profileId: string): Tab | null {



        return tabs.find((t) => t.type === "single" && t.profileId === profileId) ?? null;



    }



    const layoutLabels: Record<LayoutType, string> = {



        "single": "1x1",



        "split-2": "1x2",



        "row-3": "1x3",



        "row-4": "1x4",



        "grid-4": "2x2",



        "grid-5": "3+2",



        "grid-6": "2x3",



        "grid-7": "4+3",



        "grid-8": "2x4",



    };







    // Helper function to update window title based on current tabs



    async function updateWindowTitle() {



        if (!window.api?.updateWindowTitle) return;







        const layoutTypes: string[] = [];



        for (const tab of tabs) {



            if (tab.type === "single") {



                layoutTypes.push("1");



            } else if (tab.type === "layout" && tab.layout) {



                const label = layoutLabels[tab.layout.type] || tab.layout.type;



                layoutTypes.push(label);



            }



        }







        try {



            await window.api.updateWindowTitle(layoutTypes);



        } catch (err) {



            // Silently ignore errors - this is not critical



        }



    }







    function updateSplitButton() {



        btnSplit.title = t("layout.select");



        syncSplitSlider();



    }



    function updateSplitGlyphs() {



        for (const t of tabs) {



            // Skip layout tabs for glyph updates - they have their own rendering



            if (t.type === "layout") continue;







            const glyph = t.tabBtn.querySelector('.tabGlyph') as HTMLElement | null;



            if (!glyph)



                continue;



            glyph.innerHTML = "";



            glyph.classList.remove("isLeft", "isRight", "isActive");



            const cell = layoutState?.cells.find((c) => c.id === t.profileId) ?? null;



            if (!cell) {



                glyph.style.display = "none";



                continue;



            }



            glyph.style.display = "inline-flex";



            glyph.textContent = String(cell.position + 1);



            if (layoutState?.activePosition === cell.position) {



                glyph.classList.add("isActive");



            }



        }



    }



    function syncTabClasses() {



        for (const t of tabs) {



            if (t.type === "layout") {



                const isActiveTab = t.id === activeTabId;



                t.tabBtn.classList.toggle("active", isActiveTab);



                t.tabBtn.classList.remove("splitPartner", "splitLeft", "splitRight", "loggedOut");



                t.tabBtn.classList.toggle("layoutActive", isActiveTab);



                if (t.cellButtons && t.layout) {



                    for (const chip of t.cellButtons) {



                        const cell = t.layout.cells.find((c) => c.id === chip.dataset.profileId);



                        const isActiveCell = !!(cell && layoutState && layoutState.activePosition === cell.position && t.id === activeTabId);



                        const isLoggedOut = isProfileLoggedOut(cell?.id ?? null);



                        chip.classList.toggle("active", isActiveCell);



                        chip.classList.toggle("loggedOut", isLoggedOut);



                    }



                }



                continue;



            }







            // Single tab handling



            const cell = layoutState?.cells.find((c) => c.id === t.profileId) ?? null;



            const isInLayout = !!cell;



            const isActiveCell = !!(cell && layoutState?.activePosition === cell.position);



            const isLeft = layoutState?.type === "split-2" && cell?.position === 0;



            const isRight = layoutState?.type === "split-2" && cell?.position === 1;



            // Single tab is active if it's the current activeTabId OR activeProfileId matches



            const isActive = t.id === activeTabId || t.profileId === activeProfileId;



            t.tabBtn.classList.toggle("active", isActive);



            t.tabBtn.classList.toggle("splitPartner", isInLayout);



            t.tabBtn.classList.toggle("splitLeft", !!isLeft);



            t.tabBtn.classList.toggle("splitRight", !!isRight);



            t.tabBtn.classList.toggle("layoutActive", isActiveCell);



            t.tabBtn.classList.toggle("loggedOut", !!t.loggedOut);



        }



    }



    function isTabLoggedOut(profileId: string | null): boolean {



        if (!profileId)



            return false;



        return !!findSingleTab(profileId)?.loggedOut;



    }



    function isProfileLoggedOut(profileId: string | null): boolean {



        return !!profileId && isTabLoggedOut(profileId);



    }



    function layoutHasLoggedOut(layout: LayoutState | null | undefined): boolean {



        if (!layout)



            return false;



        return layout.cells.some((c) => isProfileLoggedOut(c.id));



    }



    function updateLoginOverlay() {



        const activeTab = activeProfileId ? findSingleTab(activeProfileId) : null;



        const show = !!(activeTab && activeTab.loggedOut);



        loginOverlay.classList.toggle("show", show);



        loginOverlay.querySelector('.sessionLoginName')



        loginName.textContent = activeTab?.name ?? "";



        btnLogin.disabled = !show;



    }



    function syncSplitSlider() {



        if (!layoutState || layoutState.type !== "split-2") {



            splitControls.style.display = "none";



            splitSlider.disabled = true;



            return;



        }



        splitControls.style.display = "flex";



        splitSlider.disabled = false;



        const ratio = clampSplitRatio(layoutState.ratio ?? currentSplitRatio);



        currentSplitRatio = ratio;



        const pct = Math.round(ratio * 100);



        const pctRight = Math.max(0, 100 - pct);



        splitSlider.value = String(pct);



        splitSliderValue.textContent = `${pct}% / ${pctRight}%`;



    }



    splitSlider.addEventListener("input", () => {



        if (!layoutState || layoutState.type !== "split-2")



            return;



        const pct = Number(splitSlider.value);



        if (!Number.isFinite(pct))



            return;



        const ratio = clampSplitRatio(pct / 100);



        if (Math.abs(ratio - (layoutState.ratio ?? currentSplitRatio)) < 0.001)



            return;



        currentSplitRatio = ratio;



        layoutState = { ...layoutState, ratio };



        // Also update the tab's layout to persist the ratio



        const activeTab = getActiveTab();



        if (activeTab?.type === "layout" && activeTab.layout) {



            activeTab.layout = { ...activeTab.layout, ratio };



        }



        syncSplitSlider();



        window.api.sessionTabsSetSplitRatio?.(ratio).catch(console.error);



        scheduleAutoSave();



        kickBounds();



    });



    function askLayoutName(defaultName: string): Promise<string | null> {



        return new Promise((resolve) => {



            void hideSessionViews();



            const overlay = el("div", "modalOverlay");



            const modal = el("div", "modal");



            const header = el("div", "modalHeader", t("layout.namePrompt"));



            const body = el("div", "modalBody");



            const input = document.createElement("input");



            input.className = "input";



            input.value = defaultName;



            input.placeholder = t("layout.namePrompt");



            const actions = el("div", "manageActions");



            const btnSave = el("button", "btn primary", t("profile.save"));



            const btnCancel = el("button", "btn", t("create.cancel"));



            actions.append(btnSave, btnCancel);



            body.append(input, actions);



            modal.append(header, body);



            overlay.append(modal);



            const cleanup = (val: string | null) => {



                overlay.remove();



                void showSessionViews();



                resolve(val);



                pushBounds();



                kickBounds();



            };



            btnSave.onclick = () => cleanup(input.value.trim() || defaultName);



            btnCancel.onclick = () => cleanup(null);



            overlay.addEventListener("click", (e) => {



                if (e.target === overlay)



                    cleanup(null);



            });



            input.addEventListener("keydown", (e) => {



                if (e.key === "Enter")



                    cleanup(input.value.trim() || defaultName);



                if (e.key === "Escape")



                    cleanup(null);



            });



            document.body.append(overlay);



            input.focus();



            input.select();



        });



    }



    async function saveCurrentLayout() {



        setLayoutStatus("Save clicked", "info");



        if (tabs.length === 0) {



            alert(t("layout.saveError"));



            setLayoutStatus(t("layout.saveError"), "error");



            return;



        }



        if (!window.api.tabLayoutsSave) {



            alert(`${t("layout.saveError")}: tabLayoutsSave not available`);



            setLayoutStatus("tabLayoutsSave not available", "error");



            return;



        }



        setLayoutStatus(`Tabs open: ${tabs.length}`, "info");



        const defaultName = `Layout ${new Date().toLocaleTimeString()}`;



        const name = await askLayoutName(defaultName);



        if (!name) {



            setLayoutStatus("Save cancelled", "info");



            return;



        }



        setLayoutStatus(`Tabs open: ${tabs.length} | Name len=${name.length}`, "info");







        // Collect all profile IDs and layouts from ALL tabs



        const allProfileIds = new Set<string>();



        const loggedOutSet = new Set<string>();



        const layoutsForSave: { name?: string; layout: LayoutState }[] = [];







        for (const tab of tabs) {



            if (tab.type === "single" && tab.profileId) {



                allProfileIds.add(tab.profileId);



                if (tab.loggedOut) loggedOutSet.add(tab.profileId);



            } else if (tab.type === "layout" && tab.layout) {



                layoutsForSave.push({



                    name: tab.name,



                    layout: { ...tab.layout, ratio: tab.layout.ratio ?? currentSplitRatio },



                });



                for (const cell of tab.layout.cells) {



                    allProfileIds.add(cell.id);



                }



            }



        }







        // Use first layout as 'split' for backward compatibility, all layouts in 'layouts' array



        const firstLayout = layoutsForSave[0]?.layout ?? null;



        const payload = {



            name,



            tabs: Array.from(allProfileIds),



            split: firstLayout ? { ...firstLayout } : null,



            layouts: layoutsForSave.length > 0 ? layoutsForSave : undefined,



            activeId: activeProfileId,



            loggedOutChars: Array.from(loggedOutSet),



        };



        const statusMsg = `Saving layout: ${payload.tabs.length} profiles, ${layoutsForSave.length} layout tabs`;



        setLayoutStatus(statusMsg, "info");



        showToast(statusMsg, "info");







        const before = await withTimeout(window.api.tabLayoutsList(), "tabLayoutsList before", 2000);



        const saved = await withTimeout(window.api.tabLayoutsSave(payload), "tabLayoutsSave", 3000);



        const after = saved ?? (await withTimeout(window.api.tabLayoutsList(), "tabLayoutsList after", 2000));



        const beforeCount = before?.length ?? 0;



        const afterCount = after?.length ?? 0;



        const delta = afterCount - beforeCount;



        const deltaMsg = `before=${beforeCount} after=${afterCount} delta=${delta}`;



        showToast(t("layout.saved"), "success");



        alert(`${t("layout.saved")} (${deltaMsg})`);



        setLayoutStatus(`${t("layout.saved")} (${deltaMsg})`, "success");



        localStorage.setItem("tabLayoutsRefresh", "1");



    }



    function scheduleAutoSave() {



        console.log("[autoSave] scheduleAutoSave called, currentLayoutId:", currentLayoutId, "isApplyingLayout:", isApplyingLayout, "autoSaveLayouts:", autoSaveLayouts);



        if (!autoSaveLayouts) {



            if (autoSaveTimeout) clearTimeout(autoSaveTimeout);



            autoSaveTimeout = null;



            return;



        }



        if (!currentLayoutId || isApplyingLayout) return;



        if (autoSaveTimeout) clearTimeout(autoSaveTimeout);



        autoSaveTimeout = setTimeout(() => {



            autoSaveLayout().catch((err) => logErr(err, "renderer"));



        }, 500);



    }



    async function autoSaveLayout() {



        console.log("[autoSave] autoSaveLayout called");



        if (!autoSaveLayouts) return;



        if (!currentLayoutId || tabs.length === 0) return;



        if (!window.api.tabLayoutsSave) return;



        // Collect all profile IDs and layouts from all tabs



        const allProfileIds = new Set<string>();



        const loggedOutSet = new Set<string>();



        const layoutsForSave: { name?: string; layout: LayoutState }[] = [];







        for (const tab of tabs) {



            if (tab.type === "single" && tab.profileId) {



                allProfileIds.add(tab.profileId);



                if (tab.loggedOut) loggedOutSet.add(tab.profileId);



            } else if (tab.type === "layout" && tab.layout) {



                layoutsForSave.push({



                    name: tab.name,



                    layout: { ...tab.layout, ratio: tab.layout.ratio ?? currentSplitRatio },



                });



                for (const cell of tab.layout.cells) {



                    allProfileIds.add(cell.id);



                }



            }



        }



        const loggedOutChars = Array.from(loggedOutSet);



        console.log("[autoSave] loggedOutChars:", loggedOutChars);



        const firstLayout = layoutsForSave[0]?.layout ?? null;



        const payload = {



            id: currentLayoutId,



            name: "", // Will be preserved by the store



            tabs: Array.from(allProfileIds),



            split: firstLayout ? { ...firstLayout } : null,



            layouts: layoutsForSave.length > 0 ? layoutsForSave : undefined,



            activeId: activeProfileId,



            loggedOutChars,



        };



        console.log("[autoSave] Saving payload:", JSON.stringify(payload));



        try {



            await window.api.tabLayoutsSave(payload);



            console.log("[autoSave] Save successful");



        }



        catch (err) {



            console.error("[autoSave] Save failed:", err);



            logErr(err, "renderer");



        }



    }



    async function reattachVisibleViews() {



        const visibleIds = layoutState ? layoutState.cells.map((c) => c.id) : activeProfileId ? [activeProfileId] : [];



        if (visibleIds.length === 0)



            return;



        const hasLoggedOut = visibleIds.some((id) => isProfileLoggedOut(id)) || layoutHasLoggedOut(layoutState);



        // Force bounds push before switching to ensure views have correct dimensions



        pushBoundsInternal(true);



        // Re-apply current layout to ensure all views are attached



        if (layoutState) {



            try {



                await window.api.sessionTabsSetMultiLayout(layoutState, {



                    ensureViews: !hasLoggedOut,



                    allowMissingViews: hasLoggedOut,



                });



            }



            catch (err) {



                logErr(err, "renderer");



            }



        } else if (activeProfileId && isProfileLoggedOut(activeProfileId)) {



            const skeleton: LayoutState = {



                type: "single",



                cells: [{ id: activeProfileId, position: 0 }],



                ratio: currentSplitRatio,



                activePosition: 0,



            };



            await window.api.sessionTabsSetMultiLayout(skeleton, { ensureViews: false, allowMissingViews: true }).catch((err) => logErr(err, "renderer"));



            // No BrowserView should be focused while logged out



            pushBoundsInternal(true);



            return;



        }



        // Switch to each visible view to ensure it's properly activated and rendered



        for (const id of visibleIds) {



            if (isProfileLoggedOut(id))



                continue;



            try {



                await window.api.sessionTabsSwitch(id);



            }



            catch (err) {



                logErr(err, "renderer");



            }



        }



        // Ensure the correct active view is focused last



        if (activeProfileId && !isProfileLoggedOut(activeProfileId) && visibleIds[visibleIds.length - 1] !== activeProfileId) {



            await window.api.sessionTabsSwitch(activeProfileId).catch((err) => logErr(err, "renderer"));



        }



        // Final bounds push to ensure everything is correctly sized



        pushBoundsInternal(true);



    }



    async function applyLayout(layout: TabLayout) {



        return enqueueLayoutApply(async () => {



            // Disable auto-save during layout application



            isApplyingLayout = true;



            // Track current layout for auto-save



            currentLayoutId = layout.id;



            // Brief hide during reset to avoid flicker



            await hideSessionViews();



            let viewsRestored = false;



            try {



                await window.api.sessionTabsReset();



                activeTabId = null;



                activeProfileId = null;



                layoutState = null;



                pendingSplitAnchor = null;



                currentSplitRatio = defaultSplitRatio;



                updateSplitButton();



                updateSplitGlyphs();



                syncTabClasses();



                updateLoginOverlay();



                const profiles = await window.api.profilesList();



                profiles.forEach((p) => rememberProfileName(p.id, p.name, p.job));



                const existingIds = new Set((profiles ?? []).map((p: Profile) => p.id));



                const orderedRaw = layout.tabs ?? [];



                const ordered = (() => {



                    const filtered = orderedRaw.filter((id) => existingIds.has(id));



                    // Fallback: if profiles are not yet loaded, still try to open all tabs



                    return filtered.length > 0 ? filtered : orderedRaw;



                })();



                if (ordered.length === 0) {



                    setLayoutStatus("Layout contains no valid tabs", "error");



                    return;



                }



                for (const t of tabs)



                    t.tabBtn.remove();



                tabs.length = 0;



                syncTabClasses();



                updateSplitGlyphs();



                updateLoginOverlay();



                // Collect all layouts to restore (either from new 'layouts' array or legacy 'split' field)



                const layoutsToRestore: { name?: string; layout: LayoutState }[] = [];



                const allLayoutIds = new Set<string>();







                // Check for new layouts array first (multiple layout tabs)



                if (layout.layouts && layout.layouts.length > 0) {



                    for (const saved of layout.layouts) {



                        const normalized = normalizeLayoutState({



                            type: saved.layout.type as LayoutType,



                            cells: saved.layout.cells,



                            ratio: saved.layout.ratio,



                            activePosition: saved.layout.activePosition,



                        });



                        layoutsToRestore.push({ name: saved.name, layout: normalized });



                        for (const cell of normalized.cells) {



                            allLayoutIds.add(cell.id);



                        }



                    }



                }



                // Fallback to legacy 'split' field for backward compatibility



                else if (layout.split) {



                    let normalizedLayout: LayoutState;



                    if ("type" in layout.split) {



                        normalizedLayout = normalizeLayoutState({



                            type: layout.split.type as LayoutType,



                            cells: (layout.split as { cells: GridCell[] }).cells,



                            ratio: (layout.split as LayoutState).ratio,



                            activePosition: (layout.split as LayoutState).activePosition,



                        });



                    }



                    else {



                        normalizedLayout = normalizeLayoutState({



                            type: "split-2",



                            cells: [



                                { id: (layout.split as { leftId: string }).leftId, position: 0 },



                                { id: (layout.split as { rightId: string }).rightId, position: 1 },



                            ],



                            ratio: (layout.split as { ratio?: number }).ratio ?? currentSplitRatio,



                            activePosition: 0,



                        });



                    }



                    layoutsToRestore.push({ name: layout.name, layout: normalizedLayout });



                    for (const cell of normalizedLayout.cells) {



                        allLayoutIds.add(cell.id);



                    }



                }







                // Re-enable visibility before opening tabs so each tab is immediately visible



                await showSessionViews();



                viewsRestored = true;



                pushBounds();







                // Gesamtanzahl für Progress (alle Tabs im Layout + zusätzliche Single-Tabs)



                const totalToOpen = ordered.length;



                if (totalToOpen > 0) {



                    startLoadProgress(totalToOpen);



                }







                // Load tabs from left to right: create tab with grid skeleton, then load views into cells



                const delayMs = getLayoutDelayMs();



                const createdLayoutTabs: Tab[] = [];







                for (const { name: layoutTabName, layout: layoutForTab } of layoutsToRestore) {



                    const isSingleLayout = layoutForTab.type === "single" && layoutForTab.cells.length === 1;



                    if (isSingleLayout) {



                        const singleId = layoutForTab.cells[0].id;



                        allLayoutIds.add(singleId);



                        await openTab(singleId);



                        incrementLoadProgress();



                        if (delayMs > 0) {



                            await sleep(delayMs);



                        }



                        continue;



                    }



                    // Create tab UI element



                    const layoutTab = await createLayoutTab(layoutForTab, layoutTabName);



                    tabs.push(layoutTab);



                    tabsBar.insertBefore(layoutTab.tabBtn, tabsSpacer);



                    createdLayoutTabs.push(layoutTab);







                    // Activate this tab



                    layoutState = layoutForTab;



                    activeTabId = layoutTab.id;



                    currentSplitRatio = layoutForTab.ratio ?? currentSplitRatio;



                    const activeCell = layoutForTab.cells.find((c) => c.position === layoutForTab.activePosition) ?? layoutForTab.cells[0];



                    activeProfileId = activeCell?.id ?? null;



                    syncTabClasses();







                    // Set up grid skeleton first (empty cells)



                    const sortedCells = [...layoutForTab.cells].sort((a, b) => a.position - b.position);



                    const skeletonLayout: LayoutState = {



                        type: layoutForTab.type,



                        cells: sortedCells,



                        ratio: layoutForTab.ratio,



                        activePosition: layoutForTab.activePosition ?? sortedCells[0].position,



                    };



                    await window.api.sessionTabsSetMultiLayout(skeletonLayout, { ensureViews: false, allowMissingViews: true }).catch(console.error);



                    pushBoundsInternal(true);







                    // Load BrowserViews into their grid cells



                    if (sequentialGridLoad) {



                        // Sequential loading - load into specific cells one by one



                        for (let i = 0; i < sortedCells.length; i++) {



                            const cell = sortedCells[i];



                            try {



                                await window.api.sessionTabsOpenInCell(cell.position, cell.id, {



                                    activate: cell.position === skeletonLayout.activePosition,



                                });



                                pushBoundsInternal(true);



                                incrementLoadProgress();



                            }



                            catch (err) {



                                logErr(`Failed to open layout view ${cell.id}: ${err}`, "renderer");



                            }



                            // Delay between views (except after last one)



                            if (delayMs > 0 && i < sortedCells.length - 1) {



                                await sleep(delayMs);



                            }



                        }



                    } else {



                        // Parallel loading - all views in this grid at once



                        await Promise.all(



                            sortedCells.map((cell) =>



                                window.api.sessionTabsOpenInCell(cell.position, cell.id, {



                                    activate: cell.position === skeletonLayout.activePosition,



                                })



                                    .catch((err) => logErr(`Failed to open layout view ${cell.id}: ${err}`, "renderer"))



                            )



                        );



                        // Increment progress once for all views in this tab



                        for (const _ of sortedCells) {



                            incrementLoadProgress();



                        }



                        pushBoundsInternal(true);



                    }







                    // Finalize layout for this tab



                    await window.api.sessionTabsSetMultiLayout(skeletonLayout, { ensureViews: true, allowMissingViews: false }).catch(console.error);



                    pushBoundsInternal(true);







                    // Delay before next tab (always, if delay is set)



                    if (delayMs > 0) {



                        await sleep(delayMs);



                    }



                }







                // Open single tabs that are not part of any layout



                for (const [idx, id] of ordered.entries()) {



                    if (allLayoutIds.has(id))



                        continue;



                    try {



                        await openTab(id);



                        pushBoundsInternal(true);



                        incrementLoadProgress();



                    }



                    catch (err) {



                        logErr(`Failed to open tab ${id}: ${err}`, "renderer");



                    }



                    // Delay after each single tab (except last)



                    if (delayMs > 0 && idx < ordered.length - 1) {



                        await sleep(delayMs);



                    }



                }







                // Ensure first layout tab is active at the end



                if (createdLayoutTabs.length > 0) {



                    const firstLayoutTab = createdLayoutTabs[0];



                    if (firstLayoutTab.layout) {



                        layoutState = firstLayoutTab.layout;



                        activeTabId = firstLayoutTab.id;



                        currentSplitRatio = firstLayoutTab.layout.ratio ?? currentSplitRatio;



                        const activeCell = firstLayoutTab.layout.cells.find((c) => c.position === firstLayoutTab.layout!.activePosition) ?? firstLayoutTab.layout.cells[0];



                        activeProfileId = activeCell?.id ?? null;



                        await pushLayoutToMain();



                    }



                } else if (createdLayoutTabs.length === 0 && tabs.length > 0) {



                    layoutState = null;



                }







                if (layout.loggedOutChars) {



                    for (const id of layout.loggedOutChars) {



                        await logoutTab(id);



                    }



                }



                pruneLayoutState();



                await pushLayoutToMain();



                if (layout.activeId && ordered.includes(layout.activeId)) {



                    await setActive(layout.activeId);



                }



                if (!activeProfileId) {



                    if (layoutState) {



                        const activeCell = layoutState.cells.find((c) => c.position === layoutState!.activePosition) ?? layoutState.cells[0];



                        activeProfileId = activeCell?.id ?? null;



                    }



                    if (!activeProfileId && tabs[0] && tabs[0].type === "single") {



                        activeProfileId = tabs[0].profileId ?? null;



                        activeTabId = tabs[0].id;



                    }



                    syncTabClasses();



                }



                updateSplitButton();



                syncTabClasses();



                pushBounds();



                setTimeout(pushBounds, 120);



                setTimeout(pushBounds, 280);



            }



            finally {



                if (!viewsRestored) {



                    await showSessionViews();



                }



                pushBounds();



                kickBounds();



            }



            if (!activeProfileId && tabs[0] && tabs[0].type === "single") {



                activeProfileId = tabs[0].profileId ?? null;



                activeTabId = tabs[0].id;



                syncTabClasses();



            }



            await reattachVisibleViews();



            // Schedule additional activation passes to handle any timing issues



            setTimeout(() => {



                reattachVisibleViews().catch((err) => logErr(err, "renderer"));



            }, 200);



            setTimeout(() => {



                pushBoundsInternal(true);



                if (activeProfileId && !isProfileLoggedOut(activeProfileId)) {



                    window.api.sessionTabsSwitch(activeProfileId).catch((err) => logErr(err, "renderer"));



                }



            }, 500);



            // Re-apply user-selected tab active color in case any theme defaults were re-applied during layout load



            setTimeout(() => applyStoredTabActiveColor(), 20);



            // Re-enable auto-save after layout is fully applied



            isApplyingLayout = false;



            scheduleProgressHide();



        }



    );



    }







    async function showLayoutPicker() {



        await hideSessionViews();



        const overlay = el("div", "modalOverlay");



        const modal = el("div", "modal");



        const header = el("div", "modalHeader", t("layout.pick"));



        const body = el("div", "modalBody");



        const list = el("div", "pickerList");



        modal.append(header, body);



        body.append(list);



        overlay.append(modal);



        const onKey = (e: KeyboardEvent) => {



            if (e.key === "Escape")



                close().catch(console.error);



        };



        const close = async () => {



            overlay.remove();



            document.removeEventListener("keydown", onKey);



            await showSessionViews();



            kickBounds();



        };



        overlay.addEventListener("click", (e) => {



            if (e.target === overlay)



                close().catch(console.error);



        });



        document.addEventListener("keydown", onKey);



        document.body.append(overlay);



        const layouts = await fetchTabLayouts();



        if (layouts.length === 0) {



            list.append(el("div", "pickerEmpty", t("layout.empty")));



            return;



        }



        for (const layout of layouts) {



            const metaParts = [`${layout.tabs.length} Tabs`];



            if (layout.split)



                metaParts.push("Split");



            const item = el("button", "pickerItem", `${layout.name} (${metaParts.join(" ? ")})`) as HTMLButtonElement;



            item.onclick = async () => {



                await applyLayout(layout);



                await close();



            };



            list.append(item);



        }



    }



    let lastBounds: { x: number; y: number; width: number; height: number } | null = null;



    let pushTimer = 0;



    function schedulePushBounds() {



        if (pushTimer)



            return;



        pushTimer = window.setTimeout(() => {



            pushTimer = 0;



            pushBoundsInternal();



        }, 50);



    }



    function pushBoundsInternal(force = false) {



        const y = Math.round(tabsBar.getBoundingClientRect().height);



        const width = Math.round(window.innerWidth);



        const height = Math.max(1, Math.round(window.innerHeight - y));



        const next = { x: 0, y, width, height };



        const same = lastBounds &&



            lastBounds.x === next.x &&



            lastBounds.y === next.y &&



            lastBounds.width === next.width &&



            lastBounds.height === next.height;



        if (!force && same)



            return;



        lastBounds = next;



        window.api.sessionTabsSetBounds(next);



    }



    function pushBounds(force = false) {



        if (force) {



            if (pushTimer) clearTimeout(pushTimer);



            pushTimer = 0;



            pushBoundsInternal(true);



            return;



        }



        schedulePushBounds();



    }



    // eslint-disable-next-line @typescript-eslint/no-unused-vars



    function forceBounds() {



        lastBounds = null;



        pushBounds(true);



        void showSessionViews();



    }



    let raf = 0;



    function kickBounds() {



        if (raf)



            return;



        raf = requestAnimationFrame(() => {



            raf = 0;



            pushBounds();



        });



    }



    window.addEventListener("resize", kickBounds);



    new ResizeObserver(kickBounds).observe(tabsBar);



    async function applySplit(next: LayoutState | null) {



        layoutState = normalizeLayoutState(next);



        if (layoutState) {



            currentSplitRatio = layoutState.ratio ?? currentSplitRatio;



            const activeCell = layoutState.cells.find((c) => c.position === layoutState!.activePosition) ?? layoutState.cells[0];



            activeProfileId = activeCell?.id ?? activeProfileId;



        }



        updateSplitButton();



        syncTabClasses();



        updateSplitGlyphs();



        await pushLayoutToMain();



        if (activeProfileId && !isProfileLoggedOut(activeProfileId)) {



            await window.api.sessionTabsSwitch(activeProfileId).catch((err) => logErr(err, "renderer"));



        }



        pushBoundsInternal(true);



        await reattachVisibleViews();



        scheduleAutoSave();



        updateWindowTitle();



    }



    async function clearSplit() {



        if (!layoutState)



            return;



        await applySplit(null);



    }



    /**



     * Activate a tab by ID (can be a tab.id for layout tabs or profileId for single tabs)



     */



    async function switchToTab(tabId: string) {



        const tab = findTabById(tabId);



        if (!tab) return;







        // Save current layout state back to the previous tab before switching



        const previousTab = getActiveTab();



        if (previousTab?.type === "layout" && previousTab.layout && layoutState) {



            previousTab.layout = { ...previousTab.layout, ratio: layoutState.ratio };



        }







        activeTabId = tabId;







        if (tab.type === "layout" && tab.layout) {



            // Activate a layout tab



            layoutState = tab.layout;



            const activeCell = tab.layout.cells.find((c) =>



                c.position === tab.layout!.activePosition



            ) ?? tab.layout.cells[0];







            activeProfileId = activeCell?.id ?? null;



            currentSplitRatio = tab.layout.ratio ?? currentSplitRatio;







            const orderedCells = [...tab.layout.cells].sort((a, b) => a.position - b.position);



            const hasLoggedOutCells = layoutHasLoggedOut(layoutState);







            // Push layout skeleton first so BrowserViews can attach directly into their cells



            await window.api.sessionTabsSetMultiLayout(layoutState, { ensureViews: false, allowMissingViews: true });







            // Materialize all cells in parallel but without changing the active layout type



            await Promise.all(



                orderedCells



                    .filter((cell) => !isProfileLoggedOut(cell.id))



                    .map((cell) =>



                        window.api.sessionTabsOpenInCell(cell.position, cell.id, {



                            activate: cell.position === layoutState?.activePosition,



                        }).catch((err) => logErr(err, "renderer"))



                    )



            );







            // Finalize layout with full bounds



            await window.api.sessionTabsSetMultiLayout(layoutState, {



                ensureViews: !hasLoggedOutCells,



                allowMissingViews: hasLoggedOutCells,



            });







            // Force bounds update to ensure views are correctly sized



            pushBoundsInternal(true);







            // Re-attach visible views to ensure they're displayed



            await reattachVisibleViews();







            if (activeProfileId && !isProfileLoggedOut(activeProfileId)) {



                await window.api.sessionTabsSwitch(activeProfileId);



            }



        } else if (tab.type === "single" && tab.profileId) {



            // Activate a single tab - clear layout in main process



            activeProfileId = tab.profileId;



            layoutState = null;



            const isLoggedOut = !!tab.loggedOut;







            // Important: Push null layout to main so it switches to single-view mode



            await pushLayoutToMain();







            if (!isLoggedOut) {



                await window.api.sessionTabsSwitch(tab.profileId);



            }







            // Force bounds update for single view



            pushBoundsInternal(true);







            // Re-attach visible views to ensure they're displayed (same as layout tabs)



            await reattachVisibleViews();



        }







        updateSplitButton();



        syncTabClasses();



        updateSplitGlyphs();



        applyStoredTabActiveColor();



        kickBounds();



        updateLoginOverlay();



        scheduleAutoSave();



    }







    async function setActive(profileId: string, side: "left" | "right" = "left") {



        // Check if this profile is part of the active layout tab



        const activeTab = getActiveTab();



        if (activeTab?.type === "layout" && activeTab.layout) {



            const cell = activeTab.layout.cells.find((c) => c.id === profileId);



            if (cell) {



                // Profile is in the active layout - just change active position



                activeTab.layout = { ...activeTab.layout, activePosition: cell.position };



                layoutState = activeTab.layout;



                activeProfileId = profileId;



                updateSplitButton();



                syncTabClasses();



                updateSplitGlyphs();



                await pushLayoutToMain();



                if (!isProfileLoggedOut(profileId)) {



                    await window.api.sessionTabsSwitch(profileId);



                }



                applyStoredTabActiveColor();



                kickBounds();



                updateLoginOverlay();



                scheduleAutoSave();



                return;



            }



        }







        // Check if this profile has its own single tab



        const singleTab = findSingleTab(profileId);



        if (singleTab) {



            await switchToTab(singleTab.id);



            return;



        }







        // Check if profile is in ANY layout tab (not just the active one)



        const layoutTabWithProfile = tabs.find((t) =>



            t.type === "layout" && t.layout?.cells.some((c) => c.id === profileId)



        );



        if (layoutTabWithProfile) {



            // Switch to that layout tab and set active position



            const cell = layoutTabWithProfile.layout!.cells.find((c) => c.id === profileId);



            if (cell) {



                layoutTabWithProfile.layout = { ...layoutTabWithProfile.layout!, activePosition: cell.position };



            }



            await switchToTab(layoutTabWithProfile.id);



            return;



        }







        // Profile is not in any tab - this shouldn't happen normally



        // Fallback: directly switch the profile



        activeProfileId = profileId;



        syncTabClasses();



        updateSplitGlyphs();



        if (!isProfileLoggedOut(profileId)) {



            await window.api.sessionTabsSwitch(profileId);



        }



        applyStoredTabActiveColor();



        pushBoundsInternal(true);



        await reattachVisibleViews();



        updateLoginOverlay();



        scheduleAutoSave();



    }



    function renderTabsOrder() {



        for (const t of tabs) {



            tabsBar.insertBefore(t.tabBtn, tabsSpacer);



        }



    }



    const getSideActiveId = (side: "left" | "right"): string | null => {



        if (layoutState && layoutState.type === "split-2") {



            const cell = layoutState.cells.find((c) => c.position === (side === "left" ? 0 : 1));



            return cell?.id ?? null;



        }



        return activeProfileId;



    };



    const getActiveSide = (): "left" | "right" => {



        if (layoutState && layoutState.type === "split-2") {



            return layoutState.activePosition === 1 ? "right" : "left";



        }



        return "left";



    };



    const findNextTabId = (currentId: string | null, dir: "prev" | "next"): string | null => {



        if (!currentId || tabs.length === 0)



            return null;



        // Only consider single tabs for navigation



        const singleTabs = tabs.filter((t) => t.type === "single");



        const idx = singleTabs.findIndex((t) => t.profileId === currentId);



        if (idx < 0)



            return null;



        const delta = dir === "next" ? 1 : -1;



        const nextIdx = (idx + delta + singleTabs.length) % singleTabs.length;



        return singleTabs[nextIdx]?.profileId ?? null;



    };



    async function navigateTab(dir: "prev" | "next", explicitSide?: "left" | "right") {



        const side = explicitSide ?? getActiveSide();



        const current = getSideActiveId(side);



        const next = findNextTabId(current, dir);



        if (!next || next === current)



            return;



        await setActive(next, layoutState?.type === "split-2" ? side : "left");



    }



    window.api.onTabHotkeyNavigate?.((payload) => {



        if (!payload)



            return;



        const dir = payload.dir === "next" ? "next" : "prev";



        const side = payload.side === "right" ? "right" : payload.side === "left" ? "left" : undefined;



        navigateTab(dir, side).catch((err) => logErr(err, "hotkey-nav"));



    });



    window.api.onShowFcoinConverter?.(() => {
        showFcoinConverter();
    });
    // CustomEvent listener for hotkey-triggered calls (executeJavaScript with userGesture=true)
    document.addEventListener("clientHotkey:showFcoinConverter", () => {
        void showFcoinConverter();
    });

    window.api.onShowShoppingList?.(() => {
        showShoppingList();
    });
    document.addEventListener("clientHotkey:showShoppingList", () => {
        showShoppingList();
    });

    window.api.onTabBarToggle?.(() => {



        closeToolsMenu();



        const hidden = tabsBar.classList.toggle("isHidden");



        tabsBar.setAttribute("aria-hidden", hidden ? "true" : "false");



        // When hidden, give content full height; when shown, reflow bounds



        if (hidden) {



            tabsBar.style.display = "none";



        } else {



            tabsBar.style.display = "flex";



        }



        kickBounds();



    });



    function moveTab(fromId: string, toId: string, after: boolean) {



        // Support both profileId (for single tabs) and tab.id (for layout tabs)



        const fromIdx = tabs.findIndex((t) =>



            (t.type === "single" && t.profileId === fromId) || t.id === fromId



        );



        const toIdx = tabs.findIndex((t) =>



            (t.type === "single" && t.profileId === toId) || t.id === toId



        );



        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx)



            return;



        const [item] = tabs.splice(fromIdx, 1);



        let insertIdx = toIdx;



        if (fromIdx < toIdx)



            insertIdx -= 1;



        if (after)



            insertIdx += 1;



        tabs.splice(insertIdx, 0, item);



        renderTabsOrder();



        scheduleAutoSave();



    }



    let draggingId: string | null = null;



    function attachDnd(tabBtn: HTMLButtonElement, profileId: string) {



        tabBtn.draggable = true;



        tabBtn.addEventListener("dragstart", (e) => {



            draggingId = profileId;



            tabBtn.classList.add("dragging");



            e.dataTransfer?.setData("text/plain", profileId);



            e.dataTransfer!.effectAllowed = "move";



        });



        tabBtn.addEventListener("dragend", () => {



            draggingId = null;



            tabBtn.classList.remove("dragging", "dropBefore", "dropAfter");



            for (const t of tabs)



                t.tabBtn.classList.remove("dropBefore", "dropAfter");



        });



        tabBtn.addEventListener("dragover", (e) => {



            e.preventDefault();



            const fromId = draggingId ?? e.dataTransfer?.getData("text/plain");



            if (!fromId || fromId === profileId)



                return;



            const rect = tabBtn.getBoundingClientRect();



            const after = e.clientX - rect.left > rect.width / 2;



            tabBtn.classList.toggle("dropAfter", after);



            tabBtn.classList.toggle("dropBefore", !after);



            e.dataTransfer!.dropEffect = "move";



        });



        tabBtn.addEventListener("dragleave", () => {



            tabBtn.classList.remove("dropBefore", "dropAfter");



        });



        tabBtn.addEventListener("drop", (e) => {



            e.preventDefault();



            const fromId = draggingId ?? e.dataTransfer?.getData("text/plain");



            if (!fromId || fromId === profileId)



                return;



            const rect = tabBtn.getBoundingClientRect();



            const after = e.clientX - rect.left > rect.width / 2;



            tabBtn.classList.remove("dropBefore", "dropAfter");



            moveTab(fromId, profileId, after);



        });



    }



    async function promptCloseChoice(target: CloseTarget | null): Promise<CloseChoice> {



        await hideSessionViews();



        const targetLabel = target?.label ?? null;



        const targetIsLayout = target?.kind === "layout";



        return await new Promise<CloseChoice>((resolve) => {



            const overlay = el("div", "modalOverlay");



            const modal = el("div", "modal");



            const header = el("div", "modalHeader");



            const headerTitle = el("span", "", t("close.title"));



            const headerClose = el("button", "modalCloseBtn", "\u00d7") as HTMLButtonElement;



            headerClose.type = "button";



            headerClose.onclick = () => finish("cancel");



            header.append(headerTitle, headerClose);



            const body = el("div", "modalBody");



            const prompt = el("div", "modalHint", t("close.prompt"));



            const targetHint = targetLabel ? (() => {



                const hint = el("div", "closeTargetBadge");



                const label = el("span", "closeTargetLabel", t("close.target"));



                const name = el("span", "closeTargetName", targetLabel);



                hint.append(label, name);



                return hint;



            })() : null;



            const actions = el("div", "manageActions");



            // All actions except cancel are styled as danger (red) for clear emphasis



            const btnTab = el("button", "btn danger", t((targetIsLayout ? "close.optionLayout" : "close.optionTab") as TranslationKey)) as HTMLButtonElement;



            const btnWindow = el("button", "btn danger", t("close.optionWindow")) as HTMLButtonElement;



            const btnApp = el("button", "btn danger", t("close.optionApp")) as HTMLButtonElement;



            let done = false;



            const finish = (choice: CloseChoice) => {



                if (done)



                    return;



                done = true;



                overlay.remove();



                window.removeEventListener("keydown", onKey);



                resolve(choice);



            };



            const onKey = (e: KeyboardEvent) => {



                if (e.key === "Escape")



                    finish("cancel");



            };



            window.addEventListener("keydown", onKey);



            btnTab.disabled = !target;



            btnTab.onclick = () => finish("tab");



            btnWindow.onclick = () => finish("window");



            btnApp.onclick = () => finish("app");



            if (targetIsLayout) {



                const btnDissolve = el("button", "btn warning", t("layoutClose.optionDissolve" as TranslationKey)) as HTMLButtonElement;



                btnDissolve.onclick = () => finish("dissolve");



                actions.append(btnDissolve, btnTab, btnWindow, btnApp);



            } else {



                actions.append(btnTab, btnWindow, btnApp);



            }



            body.append(prompt);



            if (targetHint)



                body.append(targetHint);



            body.append(actions);



            modal.append(header, body);



            overlay.append(modal);



            overlay.addEventListener("click", (e) => {



                if (e.target === overlay)



                    finish("cancel");



            });



            document.body.append(overlay);



            (btnTab.disabled ? btnWindow : btnTab).focus();



        });



    }



    async function closeTab(profileId: string) {



        pendingSplitAnchor = pendingSplitAnchor === profileId ? null : pendingSplitAnchor;



        await window.api.sessionTabsClose(profileId);



        const idx = tabs.findIndex((t) => t.profileId === profileId);



        if (idx >= 0) {



            const [removed] = tabs.splice(idx, 1);



            removed.tabBtn.remove();



        }



        else {



            const existing = findTab(profileId);



            existing?.tabBtn.remove();



        }



        pruneLayoutState();



        await pushLayoutToMain();



        const next = (() => {



            if (layoutState) {



                const activeCell = layoutState.cells.find((c) => c.position === layoutState!.activePosition) ?? layoutState.cells[0];



                if (activeCell && isOpen(activeCell.id))



                    return findSingleTab(activeCell.id);



            }



            // Only consider single tabs for next tab selection



            const singleTabs = tabs.filter((t) => t.type === "single");



            const singleIdx = singleTabs.findIndex((t) => t.profileId === profileId);



            return singleTabs[singleIdx] ?? singleTabs[singleIdx - 1] ?? singleTabs[0] ?? null;



        })();



        if (next && next.type === "single" && next.profileId) {



            activeProfileId = next.profileId;



            activeTabId = next.id;



            await setActive(next.profileId);



        } else {



            activeProfileId = null;



            activeTabId = null;



        }



        renderTabsOrder();



        updateSplitButton();



        syncTabClasses();



        updateSplitGlyphs();



        updateLoginOverlay();



        scheduleAutoSave();



        updateWindowTitle();



    }



    async function closeLayoutTab(tabId: string) {



        const idx = tabs.findIndex((t) => t.id === tabId && t.type === "layout");



        if (idx < 0)



            return;



        const [removed] = tabs.splice(idx, 1);



        removed.tabBtn.remove();



        const wasActive = activeTabId === tabId;







        if (wasActive) {



            layoutState = null;



            activeTabId = null;



            activeProfileId = null;







            const next = tabs[idx] ?? tabs[idx - 1] ?? tabs[0] ?? null;



            if (next) {



                await switchToTab(next.id);



            }



            else {



                await pushLayoutToMain();



                updateWindowTitle();



            }



        }







        pruneLayoutState();



        renderTabsOrder();



        updateSplitButton();



        syncTabClasses();



        updateSplitGlyphs();



        updateLoginOverlay();



        scheduleAutoSave();



        updateWindowTitle();



    }



    function getCloseTarget(profileId?: string | null): CloseTarget | null {



        if (profileId) {



            return { kind: "single", profileId, label: getProfileLabel(profileId) };



        }



        const activeTab = getActiveTab();



        if (activeTab?.type === "layout") {



            return { kind: "layout", tabId: activeTab.id, label: activeTab.name };



        }



        if (activeProfileId) {



            return { kind: "single", profileId: activeProfileId, label: getProfileLabel(activeProfileId) };



        }



        const firstSingle = tabs.find((t) => t.type === "single" && t.profileId);



        if (firstSingle?.profileId) {



            return { kind: "single", profileId: firstSingle.profileId, label: getProfileLabel(firstSingle.profileId) };



        }



        return null;



    }



    async function handleCloseChoice(profileId?: string | null) {



        if (closePromptOpen)



            return;



        closePromptOpen = true;



        // Ensure we honor the latest language selection from other windows



        await syncLocaleFromSettings();



        const target = getCloseTarget(profileId);



        let restoreTabs = true;



        try {



            const choice = await promptCloseChoice(target);



            restoreTabs = choice === "tab" || choice === "dissolve" || choice === "cancel" || !target;



            if (choice === "dissolve" && target?.kind === "layout") {



                await dissolveLayoutTab(target.tabId);



            }



            else if (choice === "tab") {



                if (target?.kind === "layout") {



                    await closeLayoutTab(target.tabId);



                }



                else if (target?.kind === "single") {



                    await closeTab(target.profileId);



                }



            }



            else if (choice === "window") {



                restoreTabs = false;



                await window.api.sessionWindowClose();



            }



            else if (choice === "app") {



                restoreTabs = false;



                await window.api.appQuit();



            }



        }



        catch (err) {



            logErr(err, "renderer");



            restoreTabs = true;



        }



        finally {



            closePromptOpen = false;



        }



        if (restoreTabs) {



            await showSessionViews();



            await reattachVisibleViews();



            kickBounds();



        }



    }



    async function logoutTab(profileId: string) {



        const tab = findTab(profileId);



        if (!tab || tab.loggedOut)



            return;



        tab.loggedOut = true;



        syncTabClasses();



        updateLoginOverlay();



        try {



            await window.api.sessionTabsLogout(profileId);



            showToast("Tab ausgeloggt", "info");



            scheduleAutoSave();



        }



        catch (err) {



            logErr(err, "renderer");



            tab.loggedOut = false;



            syncTabClasses();



            updateLoginOverlay();



            showToast("Ausloggen fehlgeschlagen", "error");



        }



    }



    async function loginTab(profileId: string) {



        const tab = findTab(profileId);



        if (!tab || !tab.loggedOut)



            return;



        btnLogin.disabled = true;



        try {



            await window.api.sessionTabsLogin(profileId);



            tab.loggedOut = false;



            syncTabClasses();



            updateLoginOverlay();



            await setActive(profileId);



            showToast("Tab eingeloggt", "success");



        }



        catch (err) {



            logErr(err, "renderer");



            tab.loggedOut = true;



            showToast("Einloggen fehlgeschlagen", "error");



        }



        finally {



            btnLogin.disabled = !isTabLoggedOut(profileId);



            updateLoginOverlay();



        }



    }







    async function showProfileManager(): Promise<void> {



        // Collect all profile IDs from both single tabs and layouts



        const allProfileIds = new Set<string>();







        for (const tab of tabs) {



            if (tab.type === "single" && tab.profileId) {



                allProfileIds.add(tab.profileId);



            } else if (tab.type === "layout" && tab.layout) {



                for (const cell of tab.layout.cells) {



                    allProfileIds.add(cell.id);



                }



            }



        }







        if (allProfileIds.size === 0) {



            showToast("No profiles open", "info");



            return;



        }







        // Get currently logged in profiles



        const openProfiles = await window.api.sessionTabsGetOpenProfiles() as string[];



        const loggedInSet = new Set(openProfiles);







        // Hide BrowserViews (required - they render above DOM)



        await hideSessionViews();







        return new Promise((resolve) => {



            const overlay = el("div", "profileManagerOverlay");



            overlay.style.cssText = `



                position: fixed;



                top: 0;



                left: 0;



                right: 0;



                bottom: 0;



                display: flex;



                align-items: center;



                justify-content: center;



                z-index: 10000;



                background: transparent;



            `;







            const modal = el("div", "modal");



            modal.style.cssText = `



                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);



            `;







            const header = el("div", "modalHeader", "Profile verwalten");



            const body = el("div", "modalBody");







            const list = el("div", "profileManagerList");



            list.style.cssText = "display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto;";







            body.append(list);



            modal.append(header, body);



            overlay.append(modal);







            const closeModal = async () => {



                overlay.remove();



                await showSessionViews();



                kickBounds();



                resolve();



            };







            overlay.onclick = (e) => {



                if (e.target === overlay) {



                    closeModal();



                }



            };







            const onKey = (e: KeyboardEvent) => {



                if (e.key === "Escape") {



                    e.preventDefault();



                    window.removeEventListener("keydown", onKey);



                    closeModal();



                }



            };



            window.addEventListener("keydown", onKey);







            document.body.append(overlay);







            // Load profiles to get job icons and names



            window.api.profilesList().then((profiles: Profile[]) => {



                for (const profileId of allProfileIds) {



                    const profile = profiles.find((p) => p.id === profileId);



                    const profileName = profile?.name ?? profileNameCache.get(profileId) ?? profileId;



                    const isLoggedIn = loggedInSet.has(profileId);







                    const item = el("div", "profileManagerItem");



                    item.style.cssText = `



                        display: flex;



                        align-items: center;



                        gap: 12px;



                        padding: 12px 16px;



                        background: var(--panel2);



                        border: 1px solid var(--stroke);



                        border-radius: var(--radius2);



                        color: var(--text);



                        font-size: 14px;



                    `;







                    // Add status indicator (first, on the left)



                    const statusDot = el("span", "statusDot");



                    statusDot.style.cssText = `



                        width: 10px;



                        height: 10px;



                        border-radius: 50%;



                        background: ${isLoggedIn ? '#2ecc71' : '#ff9800'};



                        flex-shrink: 0;



                    `;



                    item.append(statusDot);







                    // Add job icon if available



                    const jobIcon = createJobIcon(profile?.job, "itemJobIcon");



                    if (jobIcon) {



                        jobIcon.style.cssText = "width: 24px; height: 24px; flex-shrink: 0;";



                        item.append(jobIcon);



                    }







                    // Add profile name



                    const nameLabel = el("span", "", profileName);



                    nameLabel.style.cssText = "flex: 1; font-weight: 500;";



                    item.append(nameLabel);







                    // Add login/logout button



                    const actionBtn = el("button", "actionBtn");



                    actionBtn.textContent = isLoggedIn ? "Logout" : "Login";



                    actionBtn.style.cssText = `



                        padding: 6px 16px;



                        background: ${isLoggedIn ? 'var(--danger)' : 'var(--green)'};



                        border: none;



                        border-radius: 6px;



                        color: var(--text);



                        cursor: pointer;



                        font-size: 13px;



                        font-weight: 600;



                        transition: all 0.2s;



                        flex-shrink: 0;



                    `;







                    actionBtn.addEventListener("mouseenter", () => {



                        actionBtn.style.opacity = "0.8";



                        actionBtn.style.transform = "scale(1.05)";



                    });



                    actionBtn.addEventListener("mouseleave", () => {



                        actionBtn.style.opacity = "1";



                        actionBtn.style.transform = "scale(1)";



                    });







                    actionBtn.onclick = async () => {



                        actionBtn.disabled = true;



                        overlay.remove();



                        await showSessionViews();



                        kickBounds();







                        if (isLoggedIn) {



                            // Handle logout



                            const singleTab = findTab(profileId);



                            if (singleTab && !singleTab.loggedOut) {



                                await logoutTab(profileId);



                            } else {



                                try {



                                    await window.api.sessionTabsLogout(profileId);



                                    showToast("Profil ausgeloggt", "info");



                                    scheduleAutoSave();



                                } catch (err) {



                                    logErr(err, "renderer");



                                    showToast("Ausloggen fehlgeschlagen", "error");



                                }



                            }



                        } else {



                            // Handle login



                            const singleTab = findTab(profileId);



                            if (singleTab && singleTab.loggedOut) {



                                await loginTab(profileId);



                            } else {



                                try {



                                    await window.api.sessionTabsLogin(profileId);



                                    showToast("Profil eingeloggt", "success");



                                    scheduleAutoSave();



                                } catch (err) {



                                    logErr(err, "renderer");



                                    showToast("Einloggen fehlgeschlagen", "error");



                                }



                            }



                        }







                        resolve();



                    };







                    item.append(actionBtn);



                    list.append(item);



                }



            }).catch((err) => {



                console.error("Failed to load profiles:", err);



                closeModal();



            });



        });



    }



    async function openTab(profileId: string) {



        // Check if profile already exists as a single tab



        const existingSingle = findSingleTab(profileId);



        if (existingSingle) {



            if (pendingSplitAnchor && pendingSplitAnchor !== profileId && isOpen(pendingSplitAnchor)) {



                const anchor = pendingSplitAnchor;



                pendingSplitAnchor = null;



                await applySplit({



                    type: "split-2",



                    cells: [



                        { id: anchor, position: 0 },



                        { id: profileId, position: 1 },



                    ],



                    ratio: currentSplitRatio,



                    activePosition: 0,



                });



                return;



            }



            pendingSplitAnchor = null;



            return setActive(profileId);



        }







        // Check if profile exists in a layout tab



        if (isProfileInAnyLayout(profileId)) {



            return setActive(profileId);



        }







        const profiles: Profile[] = await window.api.profilesList();



        const p = profiles.find((x) => x.id === profileId);



        rememberProfileName(profileId, p?.name, p?.job);



        const title = p?.name ?? profileId;



        const tabBtn = document.createElement("button");



        tabBtn.className = "tabBtn sessionTab";



        tabBtn.dataset.title = title;



        const splitGlyph = el("span", "tabGlyph", "");



        (splitGlyph as HTMLElement).style.display = "none";



        const jobIcon = createJobIcon(p?.job, "tabJobIcon");



        const label = el("span", "tabLabel", title);



        if (p?.job?.trim())



            tabBtn.title = p.job;



        const closeBtn = el("span", "tabClose", "×");



        closeBtn.onclick = (e) => {



            e.stopPropagation();



            handleCloseChoice(profileId).catch(console.error);



        };



        tabBtn.append(splitGlyph);



        if (jobIcon)



            tabBtn.append(jobIcon);



        tabBtn.append(label, closeBtn);



        tabBtn.onclick = () => {



            setActive(profileId, "left").catch(console.error);



        };



        tabBtn.addEventListener("contextmenu", (e) => {



            e.preventDefault();



            setActive(profileId, "right").catch(console.error);



        });



        attachDnd(tabBtn, profileId);



        // Create single-type tab with unique ID



        const tab: Tab = {



            id: generateTabId(),



            type: "single",



            profileId,



            name: title,



            tabBtn,



            loggedOut: false,



        };



        tabs.push(tab);



        renderTabsOrder();



        await window.api.sessionTabsOpen(profileId);



        if (pendingSplitAnchor && pendingSplitAnchor !== profileId && isOpen(pendingSplitAnchor)) {



            const anchor = pendingSplitAnchor;



            pendingSplitAnchor = null;



            await applySplit({



                type: "split-2",



                cells: [



                    { id: anchor, position: 0 },



                    { id: profileId, position: 1 },



                ],



                ratio: currentSplitRatio,



                activePosition: 0,



            });



            return;



        }



        pendingSplitAnchor = null;



        activeTabId = tab.id;



        await setActive(profileId);



        updateWindowTitle();



    }



    async function showPicker() {



        await hideSessionViews();



        const overlay = el("div", "modalOverlay");



        const modal = el("div", "modal");



        const header = el("div", "modalHeader", t("picker.title"));



        const body = el("div", "modalBody");



        const list = el("div", "pickerList");



        modal.append(header, body);



        body.append(list);



        overlay.append(modal);



        const onKey = (e: KeyboardEvent) => {



            if (e.key === "Escape")



                close().catch(console.error);



        };



        const close = async () => {



            overlay.remove();



            window.removeEventListener("keydown", onKey);



            await showSessionViews();



            kickBounds();



        };



        overlay.addEventListener("click", (e) => {



            if (e.target === overlay)



                close().catch(console.error);



        });



        window.addEventListener("keydown", onKey);



        document.body.append(overlay);



        const profiles: Profile[] = await window.api.profilesList();



        const candidates = profiles.filter((p) => p.launchMode === "tabs" && !isOpen(p.id));



        if (candidates.length === 0) {



            list.append(el("div", "pickerEmpty", t("picker.empty")));



            return;



        }



        for (const p of candidates) {



            const item = el("button", "pickerItem", p.name) as HTMLButtonElement;



            item.onclick = async () => {



                await openTab(p.id);



                await close();



            };



            list.append(item);



        }



    }



    async function showGridConfigModal(type: LayoutType, initial?: LayoutState | null): Promise<LayoutState | null> {



        const config = GRID_CONFIGS[type];



        const overlay = el("div", "modalOverlay");



        const modal = el("div", "modal gridConfigModal");



        const header = el("div", "modalHeader", layoutLabels[type] ?? t("layout.select"));



        const body = el("div", "modalBody");



        const hint = el("div", "modalHint", t("layout.gridHint"));



        const grid = el("div", "layoutGrid") as HTMLDivElement;



        grid.style.gridTemplateColumns = `repeat(${config.cols}, minmax(${LAYOUT_CONST.MIN_CELL_WIDTH}px, 1fr))`;



        grid.style.gridTemplateRows = `repeat(${config.rows}, minmax(${LAYOUT_CONST.MIN_CELL_HEIGHT}px, 1fr))`;



        const actions = el("div", "manageActions");



        const btnSave = el("button", "btn primary", t("create.save")) as HTMLButtonElement;



        const btnCancel = el("button", "btn", t("create.cancel")) as HTMLButtonElement;



        actions.append(btnSave, btnCancel);



        body.append(hint, grid, actions);



        modal.append(header, body);



        overlay.append(modal);



        document.body.append(overlay);







        // Load all available profiles for cell picker



        const allProfiles: Profile[] = await window.api.profilesList();



        const tabModeProfiles = allProfiles.filter((p) => p.launchMode === "tabs");



        tabModeProfiles.forEach((p) => rememberProfileName(p.id, p.name, p.job));







        // Get IDs of profiles already used in other tabs/layouts (excluding current layout being edited)



        const usedProfileIds = new Set<string>();







        // First, add profiles from current window's tabs



        for (const tab of tabs) {



            if (tab.type === "single" && tab.profileId) {



                usedProfileIds.add(tab.profileId);



            } else if (tab.type === "layout" && tab.layout) {



                // Skip the current layout being edited (if initial is set, we're editing)



                if (initial && tab.layout.type === initial.type) continue;



                for (const cell of tab.layout.cells) {



                    usedProfileIds.add(cell.id);



                }



            }



        }







        // Then, add profiles from ALL other windows (multi-window support)



        try {



            if (window.api.sessionTabsGetAllOpenProfiles) {



                const allOpenProfiles = await window.api.sessionTabsGetAllOpenProfiles();



                allOpenProfiles.forEach(id => usedProfileIds.add(id));



            }



        } catch (err) {



            console.warn("Failed to get all open profiles:", err);



        }







        let cells: GridCell[] = initial && initial.type === type ? [...initial.cells] : [];



        let activePosition = initial?.activePosition ?? cells[0]?.position ?? 0;







        let resolvePromise: (layout: LayoutState | null) => void = () => undefined;



        const close = (result: LayoutState | null) => {



            overlay.remove();



            resolvePromise(result);



            kickBounds();



        };







        const done = new Promise<LayoutState | null>((resolve) => {



            resolvePromise = resolve;



        });







        function getProfileName(id: string): string {



            return tabModeProfiles.find((p) => p.id === id)?.name ?? findTab(id)?.name ?? id;



        }







        function renderGrid() {



            grid.innerHTML = "";



            const maxCells = Math.min(config.maxViews, config.rows * config.cols);



            for (let pos = 0; pos < maxCells; pos++) {



                const current = cells.find((c) => c.position === pos);



                // Show only position number, profile name shown on hover/selection



                const cellBtn = el("button", "gridCellBtn") as HTMLButtonElement;



                const numSpan = el("span", "cellNum", String(pos + 1));



                const nameSpan = el("span", "cellName", current ? getProfileName(current.id) : t("layout.emptyCell"));



                cellBtn.append(numSpan, nameSpan);



                if (!current) cellBtn.classList.add("empty");



                cellBtn.dataset.position = String(pos);



                if (activePosition === pos)



                    cellBtn.classList.add("active");



                cellBtn.onclick = () => openCellPicker(pos, current?.id ?? null);



                // Drag & drop reorder



                cellBtn.draggable = true;



                cellBtn.addEventListener("dragstart", (ev) => {



                    ev.dataTransfer?.setData("text/plain", String(pos));



                    cellBtn.classList.add("dragging");



                });



                cellBtn.addEventListener("dragend", () => {



                    cellBtn.classList.remove("dragging");



                    cellBtn.classList.remove("dragOver");



                });



                cellBtn.addEventListener("dragover", (ev) => {



                    ev.preventDefault();



                    cellBtn.classList.add("dragOver");



                });



                cellBtn.addEventListener("dragleave", () => cellBtn.classList.remove("dragOver"));



                cellBtn.addEventListener("drop", (ev) => {



                    ev.preventDefault();



                    cellBtn.classList.remove("dragOver");



                    const from = Number(ev.dataTransfer?.getData("text/plain"));



                    const to = pos;



                    if (!Number.isFinite(from) || from === to)



                        return;



                    const fromIdx = cells.findIndex((c) => c.position === from);



                    const toIdx = cells.findIndex((c) => c.position === to);



                    if (fromIdx < 0)



                        return;



                    // swap positions



                    cells[fromIdx] = { ...cells[fromIdx], position: to };



                    if (toIdx >= 0 && toIdx !== fromIdx) {



                        cells[toIdx] = { ...cells[toIdx], position: from };



                    }



                    cells = cells.sort((a, b) => a.position - b.position);



                    if (activePosition === from)



                        activePosition = to;



                    else if (activePosition === to)



                        activePosition = from;



                    renderGrid();



                });



                grid.append(cellBtn);



            }



            // Disable save button if no cells have profiles assigned



            btnSave.disabled = cells.length === 0;



        }







        function openCellPicker(position: number, currentId: string | null) {



            // Close any existing picker menus first



            grid.querySelectorAll(".cellPickerMenu").forEach((m) => m.remove());



            const menu = el("div", "cellPickerMenu") as HTMLDivElement;

            const row = Math.floor(position / config.cols);
            if (row === 0) {
                menu.style.marginTop = "125px";
            }

            // Get IDs already used in current cells (excluding the current position)



            const usedInCurrentCells = new Set(cells.filter((c) => c.position !== position).map((c) => c.id));



            // Filter profiles: not used elsewhere AND not used in other cells of this layout



            const availableProfiles = tabModeProfiles.filter((p) =>



                !usedProfileIds.has(p.id) && !usedInCurrentCells.has(p.id)



            );



            // Also include the current profile if set (so user can keep it)



            if (currentId) {



                const currentProfile = tabModeProfiles.find((p) => p.id === currentId);



                if (currentProfile && !availableProfiles.some((p) => p.id === currentId)) {



                    availableProfiles.unshift(currentProfile);



                }



            }



            const options: { label: string; value: string }[] = [



                // Only show "empty" option if cell already has a profile assigned



                ...(currentId ? [{ label: t("layout.emptyCell"), value: "" }] : []),



                ...availableProfiles.map((p) => ({ label: p.name, value: p.id })),



            ];



            for (const opt of options) {



                const btn = el("button", "pickerItem", opt.label) as HTMLButtonElement;



                if (opt.value === currentId) {



                    btn.classList.add("selected");



                }



                btn.onclick = () => {



                    cells = cells.filter((c) => c.position !== position);



                    if (opt.value) {



                        cells.push({ id: opt.value, position });



                    }



                    if (activePosition === position && !opt.value) {



                        activePosition = cells[0]?.position ?? 0;



                    }



                    menu.remove();



                    renderGrid();



                };



                menu.append(btn);



            }



            grid.append(menu);



        }







        btnSave.onclick = () => {



            const normalized = normalizeLayoutState({



                type,



                cells,



                ratio: type === "split-2" ? currentSplitRatio : undefined,



                activePosition: activePosition ?? cells[0]?.position ?? 0,



            });



            close(normalized);



        };



        btnCancel.onclick = () => close(null);



        overlay.addEventListener("click", (e) => {



            if (e.target === overlay)



                close(null);



        });



        document.addEventListener("keydown", function escHandler(ev) {



            if (ev.key === "Escape") {



                close(null);



                document.removeEventListener("keydown", escHandler);



            }



        });



        renderGrid();



        return done;



    }



    async function showLayoutSelector() {



        await hideSessionViews();



        const overlay = el("div", "modalOverlay");



        const modal = el("div", "modal");



        const header = el("div", "modalHeader", t("layout.select"));



        const body = el("div", "modalBody");



        const list = el("div", "pickerList layoutTypeList");



        body.append(list);



        modal.append(header, body);



        overlay.append(modal);



        document.body.append(overlay);







        const options: LayoutType[] = ["single", "split-2", "row-3", "row-4", "grid-4", "grid-5", "grid-6", "grid-7", "grid-8"];



        options.forEach((opt) => {



            const item = el("button", "pickerItem", layoutLabels[opt]) as HTMLButtonElement;



            item.onclick = async () => {



                overlay.remove();



                const activeTab = getActiveTab();



                const initial = layoutState?.type === opt ? layoutState : null;



                const targetLayoutTabId = initial && activeTab?.type === "layout" ? activeTab.id : null;



                const configured = await showGridConfigModal(opt, initial);



                await showSessionViews();



                kickBounds();



                if (configured) {



                    // Create a layout tab instead of just setting layoutState



                    await activateMultiLayout(configured, undefined, targetLayoutTabId);



                }



            };



            list.append(item);



        });



        overlay.addEventListener("click", (e) => {



            if (e.target === overlay) {



                overlay.remove();



                void showSessionViews();



                kickBounds();



            }



        });



    }



    async function showSplitPicker(anchorId: string) {



        await hideSessionViews();



        const overlay = el("div", "modalOverlay");



        const modal = el("div", "modal");



        const header = el("div", "modalHeader", t("split.title"));



        const body = el("div", "modalBody");



        const hint = el("div", "modalHint", t("split.subtitle"));



        const list = el("div", "pickerList");



        modal.append(header, body);



        body.append(hint, list);



        overlay.append(modal);



        const onKey = (e: KeyboardEvent) => {



            if (e.key === "Escape")



                close().catch(console.error);



        };



        const close = async (keepAnchor = false) => {



            overlay.remove();



            window.removeEventListener("keydown", onKey);



            await showSessionViews();



            if (!keepAnchor)



                pendingSplitAnchor = null;



            kickBounds();



        };



        overlay.addEventListener("click", (e) => {



            if (e.target === overlay)



                close().catch(console.error);



        });



        window.addEventListener("keydown", onKey);



        document.body.append(overlay);



        // Only show single tabs in split picker (layout tabs don't have profileId)



        const openTabs = tabs.filter((tab) => tab.type === "single" && tab.profileId !== anchorId);



        if (openTabs.length === 0) {



            list.append(el("div", "pickerEmpty", t("split.noOpenTabs")));



        }



        else {



            for (const tab of openTabs) {



                const item = el("button", "pickerItem", tab.name) as HTMLButtonElement;



                item.onclick = async () => {



                    await applySplit({



                        type: "split-2",



                        cells: [



                            { id: anchorId, position: 0 },



                            { id: tab.profileId!, position: 1 },



                        ],



                        ratio: currentSplitRatio,



                        activePosition: 0,



                    });



                    await close();



                };



                list.append(item);



            }



        }



        const addBtn = el("button", "pickerItem secondary", t("split.openOther")) as HTMLButtonElement;



        addBtn.onclick = async () => {



            await close(true);



            pendingSplitAnchor = anchorId;



            await showPicker();



            pendingSplitAnchor = null;



        };



        body.append(addBtn);



    }



    btnTools.onclick = (e) => {



        e.stopPropagation();



        toggleToolsMenu();



    };



    btnEditMode.onclick = () => {



        closeToolsMenu();



        showProfileManager().catch(console.error);



    };



    btnLogin.onclick = () => {



        if (!activeProfileId)



            return;



        loginTab(activeProfileId).catch(console.error);



    };



    btnSplit.onclick = () => {



        showLayoutSelector().catch(console.error);



    };



    btnSaveLayout.onclick = () => {



        showToast(t("layout.saveStart"), "info");



        saveCurrentLayout().catch((err) => {



            logErr(err, "renderer");



            showToast(`${t("layout.saveError")}: ${err instanceof Error ? err.message : String(err)}`, "error");



        });



    };



    btnLayouts.onclick = () => showLayoutPicker().catch(console.error);



    window.api.onOpenTab((profileId: string) => {



        openTab(profileId).catch(console.error);



    });



    window.api.onOpenTabWithLayout?.((profileId: string, layoutType: string) => {



        const validTypes: LayoutType[] = ["single", "split-2", "row-3", "row-4", "grid-4", "grid-5", "grid-6", "grid-7", "grid-8"];



        if (!validTypes.includes(layoutType as LayoutType)) {



            console.error("Invalid layout type:", layoutType);



            openTab(profileId).catch(console.error);



            return;



        }



        // Show grid config modal with profile pre-filled at position 0



        const initialLayout: LayoutState = {



            type: layoutType as LayoutType,



            cells: [{ id: profileId, position: 0 }],



            activePosition: 0,



        };



        showGridConfigModal(layoutType as LayoutType, initialLayout).then((configured) => {



            if (configured) {



                activateMultiLayout(configured).catch(console.error);



            }



        }).catch(console.error);



    });



    window.api.onSessionActiveChanged((profileId: string | null) => {



        if (profileId && !isOpen(profileId))



            return;



        activeProfileId = profileId;



        if (layoutState && profileId) {



            const cell = layoutState.cells.find((c) => c.id === profileId);



            if (cell) {



                layoutState = { ...layoutState, activePosition: cell.position };



            }



        }



        syncTabClasses();



        updateLoginOverlay();



        // Ensure manual tab-active color stays applied when switching tabs



        applyStoredTabActiveColor();



    });



    window.api.onSessionWindowCloseRequested(() => {



        handleCloseChoice().catch(console.error);



    });



    window.api.onApplyLayout((layout: TabLayout) => {



        markInitialLayoutHandled(layout.id);



        applyLayout(layout).catch(console.error);



    });



    async function tryApplyPendingLayout() {



        if (!window.api.tabLayoutsPending)



            return false;



        try {



            const pending = await window.api.tabLayoutsPending();



            if (pending && typeof pending === "object" && pending.id) {



                markInitialLayoutHandled(pending.id);



                await applyLayout(pending);



                return true;



            }



        }



        catch (err) {



            logErr(err, "renderer");



        }



        return false;



    }



    async function applyInitialLayoutById(id: string) {



        try {



            const layout = await window.api.tabLayoutsGet(id);



            if (!layout)



                return;



            markInitialLayoutHandled(layout.id);



            await applyLayout(layout);



        }



        catch (err) {



            logErr(err, "renderer");



        }



    }



    async function startInitialLoad() {



        // First, try to pull any pending layout the main process cached for us



        const appliedPending = await tryApplyPendingLayout();



        if (appliedPending)



            return;



        if (initialLayoutId) {



            window.api



                .tabLayoutsApply(initialLayoutId)



                .catch((err) => {



                logErr(err, "renderer");



                return applyInitialLayoutById(initialLayoutId).catch(() => undefined);



            });



            initialLayoutFallbackTimer = setTimeout(() => {



                if (!initialLayoutPendingId)



                    return;



                applyInitialLayoutById(initialLayoutPendingId).catch(() => undefined);



            }, 800);



            let initialWatchAttempts = 0;



            const initialWatch = window.setInterval(() => {



                if (!initialLayoutId) {



                    window.clearInterval(initialWatch);



                    return;



                }



                if (tabs.length > 0) {



                    window.clearInterval(initialWatch);



                    return;



                }



                if (initialWatchAttempts >= 3) {



                    window.clearInterval(initialWatch);



                    return;



                }



                initialWatchAttempts += 1;



                applyInitialLayoutById(initialLayoutId).catch(() => undefined);



            }, 1200);



            // Kick an immediate watchdog pass as well



            setTimeout(() => {



                if (tabs.length === 0) {



                    initialWatchAttempts += 1;



                    applyInitialLayoutById(initialLayoutId).catch(() => undefined);



                }



            }, 300);



            return;



        }



        if (initialProfileId) {



            openTab(initialProfileId).catch(console.error);



        }



    }



    // Listen for layout creation events (from multi-window support)



    if (window.api?.onLayoutCreated) {



        window.api.onLayoutCreated(async (layout) => {



            try {



                // Create a layout tab from the received layout



                const layoutTab = await createLayoutTab(layout);



                tabs.push(layoutTab);



                tabsBar.insertBefore(layoutTab.tabBtn, tabsSpacer);







                // Set this as the active tab



                layoutState = layout;



                activeTabId = layoutTab.id;







                // Set active profile from layout



                const activeCell = layout.cells.find((c) => c.position === layout.activePosition) ?? layout.cells[0];



                activeProfileId = activeCell?.id ?? null;



                currentSplitRatio = layout.ratio ?? currentSplitRatio;







                // Update UI



                renderTabsOrder();



                syncTabClasses();



                updateSplitButton();



                kickBounds();







                // Update window title



                updateWindowTitle();



            } catch (err) {



                logErr(err, "onLayoutCreated");



            }



        });



    }



    startInitialLoad().catch((err) => logErr(err, "renderer"));



    syncEditModeUi();



    updateLoginOverlay();



    updateSplitButton();



    syncTabClasses();



    kickBounds();



}







async function renderInstance(root: HTMLElement, profileId: string) {



    clear(root);



    root.className = "instanceRoot";



    const wv = createWebview(profileId);



    wv.setAttribute("src", FLYFF_URL);



    root.append(wv);



}



async function main() {



    const root = document.getElementById("app")!;



    window.api?.onToast?.((payload) => {



        if (!payload || typeof payload !== "object")



            return;



        const { message, tone, ttlMs } = payload as { message?: string; tone?: "info" | "success" | "error"; ttlMs?: number };



        if (!message)



            return;



        showToast(message, tone ?? "info", ttlMs);



    });



    await hydrateTabActiveJsonOverride();



    await hydrateThemeFromSnapshot();



    applyTheme(currentTheme);



    applyStoredTabActiveColor();



    setTimeout(applyStoredTabActiveColor, 0);



    pushThemeUpdate(currentTheme, getActiveThemeColors());



    await loadFeatureFlags();



    // Hydrate persisted client settings (incl. locale) before rendering any view



    await loadClientSettings().catch((err) => logErr(err, "renderer"));



    if (window.api?.onThemeUpdate) {



        window.api.onThemeUpdate((payload: ThemeUpdatePayload) => {



            if (!payload || typeof payload.id !== "string")



                return;



            const nextTheme = isThemeKey(payload.id) ? payload.id : currentTheme;



            const manualTabColor = getManualTabActiveOverride();



            if (manualTabColor) {



                isTabActiveColorManual = true;



                lastTabActiveHex = manualTabColor;



                setTabActiveColor(manualTabColor, { manual: true, persist: false });



            }



            else if (payload.colors?.tabActive) {



                const themeDefault = getThemeColors(nextTheme).tabActive;



                const isManualColor = payload.colors.tabActive.toLowerCase() !== themeDefault?.toLowerCase();



                jsonTabActiveOverride = isManualColor ? payload.colors.tabActive : null;



                lastTabActiveHex = payload.colors.tabActive;



                isTabActiveColorManual = isManualColor;



                setTabActiveColor(payload.colors.tabActive, { manual: isManualColor, persist: false });



            }



            if (nextTheme !== currentTheme) {



                applyTheme(nextTheme);



            }



        });



    }



    window.addEventListener("focus", applyStoredTabActiveColor);



    document.addEventListener("visibilitychange", () => {



        if (!document.hidden)



            applyStoredTabActiveColor();



    });



    const view = qs().get("view") ?? "launcher";



    if (view === "launcher")



        return renderLauncher(root);



    if (view === "session")



        return renderSession(root);



    if (view === "instance") {



        const profileId = qs().get("profileId") ?? "";



        return renderInstance(root, profileId);



    }



    return renderLauncher(root);



}



main().catch(console.error);















































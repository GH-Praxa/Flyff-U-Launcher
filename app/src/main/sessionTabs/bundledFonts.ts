/**
 * Bundled font data for game CSS injection.
 *
 * Fonts are read from node_modules at runtime via fs.readFileSync.
 * Data URIs are cached after the first call so disk reads happen only once.
 *
 * The resulting CSS is injected into BrowserViews via insertCSS with
 * cssOrigin:'user', which gives it the highest CSS cascade priority
 * (user !important > author !important).
 *
 * Font loading from data: URIs is allowed via webRequest.onHeadersReceived
 * patching in manager.ts (ensureFontCspForSession).
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { app } from "electron";

type FontData = { w400: string; w700: string };

// Populated on first call — lazy so app.getAppPath() is available.
let _cache: Record<string, FontData> | null = null;

/** Try to find the node_modules directory by probing several candidate roots. */
function findNodeModules(): string | null {
    const candidates = [
        // Standard: app root (works in dev and packaged via app.getAppPath())
        join(app.getAppPath(), "node_modules"),
        // Fallback: parent of the built main.js (__dirname = .vite/build or out/main)
        join(dirname(__dirname), "node_modules"),
        join(dirname(dirname(__dirname)), "node_modules"),
        join(dirname(dirname(dirname(__dirname))), "node_modules"),
    ];
    for (const dir of candidates) {
        if (existsSync(join(dir, "@fontsource"))) return dir;
    }
    return null;
}

function loadDataUri(nodeModules: string, pkg: string, file: string): string {
    const filePath = join(nodeModules, `@fontsource/${pkg}`, "files", file);
    const b64 = readFileSync(filePath).toString("base64");
    return `data:font/woff2;base64,${b64}`;
}

function getCache(): Record<string, FontData> {
    if (_cache) return _cache;

    const nodeModules = findNodeModules();
    if (!nodeModules) {
        console.error("[bundledFonts] Could not locate node_modules/@fontsource. Checked:", [
            join(app.getAppPath(), "node_modules"),
        ]);
        _cache = {};
        return _cache;
    }

    try {
        _cache = {
            "Josefin Sans": {
                w400: loadDataUri(nodeModules, "josefin-sans", "josefin-sans-latin-400-normal.woff2"),
                w700: loadDataUri(nodeModules, "josefin-sans", "josefin-sans-latin-700-normal.woff2"),
            },
            "Roboto": {
                w400: loadDataUri(nodeModules, "roboto", "roboto-latin-400-normal.woff2"),
                w700: loadDataUri(nodeModules, "roboto", "roboto-latin-700-normal.woff2"),
            },
            "Open Sans": {
                w400: loadDataUri(nodeModules, "open-sans", "open-sans-latin-400-normal.woff2"),
                w700: loadDataUri(nodeModules, "open-sans", "open-sans-latin-700-normal.woff2"),
            },
            "Lato": {
                w400: loadDataUri(nodeModules, "lato", "lato-latin-400-normal.woff2"),
                w700: loadDataUri(nodeModules, "lato", "lato-latin-700-normal.woff2"),
            },
            "Montserrat": {
                w400: loadDataUri(nodeModules, "montserrat", "montserrat-latin-400-normal.woff2"),
                w700: loadDataUri(nodeModules, "montserrat", "montserrat-latin-700-normal.woff2"),
            },
            "Raleway": {
                w400: loadDataUri(nodeModules, "raleway", "raleway-latin-400-normal.woff2"),
                w700: loadDataUri(nodeModules, "raleway", "raleway-latin-700-normal.woff2"),
            },
            "Nunito": {
                w400: loadDataUri(nodeModules, "nunito", "nunito-latin-400-normal.woff2"),
                w700: loadDataUri(nodeModules, "nunito", "nunito-latin-700-normal.woff2"),
            },
            "Ubuntu": {
                w400: loadDataUri(nodeModules, "ubuntu", "ubuntu-latin-400-normal.woff2"),
                w700: loadDataUri(nodeModules, "ubuntu", "ubuntu-latin-700-normal.woff2"),
            },
            "Cinzel": {
                w400: loadDataUri(nodeModules, "cinzel", "cinzel-latin-400-normal.woff2"),
                w700: loadDataUri(nodeModules, "cinzel", "cinzel-latin-700-normal.woff2"),
            },
        };
    } catch (err) {
        console.error("[bundledFonts] Failed to load font files:", err);
        _cache = {};
    }
    return _cache;
}

export function hasBundledFont(fontName: string): boolean {
    return fontName in getCache();
}

/**
 * Returns CSS with @font-face declarations (data: URIs) + a global font-family
 * override rule. Returns null for system/custom fonts that are not bundled.
 */
export function getBundledFontFaceCSS(fontName: string): string | null {
    const data = getCache()[fontName];
    if (!data) return null;
    const name = JSON.stringify(fontName);
    return [
        `@font-face { font-family: ${name}; font-weight: 400; font-style: normal; src: url(${JSON.stringify(data.w400)}) format('woff2'); }`,
        `@font-face { font-family: ${name}; font-weight: 700; font-style: normal; src: url(${JSON.stringify(data.w700)}) format('woff2'); }`,
        `*, *::before, *::after { font-family: ${name}, sans-serif !important; }`,
    ].join("\n");
}

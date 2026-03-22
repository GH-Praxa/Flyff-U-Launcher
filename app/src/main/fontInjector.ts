/**
 * Shared font injection utilities for BrowserViews and BrowserWindows.
 *
 * Provides CSS + Canvas 2D font overrides so that bundled / system fonts
 * can be applied to any WebContents.
 *
 * IMPORTANT: Chromium ignores @font-face rules in user-origin stylesheets.
 * Therefore @font-face is injected at author origin (default insertCSS),
 * and only the font-family override uses cssOrigin:'user' for highest
 * cascade priority.
 *
 * CSP patching (allowing data: in font-src) is NOT handled here because
 * each session's onHeadersReceived can only have one handler. The caller
 * is responsible for ensuring the session's CSP allows data: font URIs.
 */

import type { WebContents } from "electron";
import { getBundledFontParts } from "./sessionTabs/bundledFonts";
import { logErr } from "../shared/logger";

// ── CSS key tracking ─────────────────────────────────────────────────

/** Maps each WebContents to the override CSS key (user origin). */
const overrideKeysByWc = new Map<WebContents, string>();
/** Maps each WebContents to the @font-face CSS key (author origin). */
const fontFaceKeysByWc = new Map<WebContents, string>();

// ── Font CSS building ────────────────────────────────────────────────

function buildFontParts(font: string): { fontFace: string | null; override: string } {
    const parts = getBundledFontParts(font);
    if (parts) return { fontFace: parts.fontFace, override: parts.override };
    return {
        fontFace: null,
        override: `*, *::before, *::after { font-family: ${JSON.stringify(font)}, sans-serif !important; }`,
    };
}

/**
 * Builds a JS snippet that intercepts CanvasRenderingContext2D.prototype.font
 * to replace the font-family portion of every canvas font string while
 * preserving size, weight and style. No-op for WebGL games.
 */
function buildCanvasFontInterceptorJS(fontName: string): string {
    const nameJSON = JSON.stringify(fontName);
    return [
        '(function(){',
        'window.__lch_canvas_font__=' + nameJSON + ';',
        'if(document.fonts){',
        '  document.fonts.load("16px "+' + nameJSON + ').catch(function(){});',
        '  document.fonts.load("bold 16px "+' + nameJSON + ').catch(function(){});',
        '}',
        'if(window.__lch_canvas_intercepted__)return;',
        'window.__lch_canvas_intercepted__=true;',
        'var desc=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,"font");',
        'if(!desc||!desc.set)return;',
        'var origSet=desc.set;',
        'var re=/(\\d+(?:\\.\\d+)?(?:px|pt|em|rem|%|vw|vh|vmin|vmax|ex|ch)(?:\\/[\\d.]+(?:px|pt|em|rem|%)?)?)(\\s+).+$/i;',
        'Object.defineProperty(CanvasRenderingContext2D.prototype,"font",{',
        'configurable:true,get:desc.get,',
        'set:function(v){',
        'var f=window.__lch_canvas_font__;',
        'if(!f){origSet.call(this,v);return;}',
        'var m=String(v).replace(re,"$1$2"+f);',
        'origSet.call(this,m);',
        '}});',
        'console.log("[Launcher] Canvas 2D font interceptor installed");',
        '})()',
    ].join('');
}

// ── Remove previous CSS ──────────────────────────────────────────────

function removePreviousCss(wc: WebContents): void {
    for (const [map] of [[overrideKeysByWc], [fontFaceKeysByWc]] as const) {
        const key = map.get(wc);
        if (key) {
            map.delete(wc);
            try {
                const rm = wc.removeInsertedCSS(key);
                if (rm && typeof (rm as Promise<void>).then === "function") {
                    (rm as Promise<void>).catch(() => {});
                }
            } catch { /* destroyed */ }
        }
    }
    wc.executeJavaScript(
        `(function(){var s=document.getElementById('__lch_font__');if(s)s.remove();})()`
    ).catch(() => {});
}

// ── Apply / remove font on a single WebContents ─────────────────────

/**
 * Injects (or removes) the chosen font into a WebContents.
 *
 * - Removes any previously injected CSS first.
 * - For `null`: clears the font and canvas interceptor.
 * - For a font name: injects @font-face at author origin + font-family
 *   override at user origin + canvas 2D interceptor.
 */
export function applyFontToWebContents(wc: WebContents, font: string | null): void {
    if (wc.isDestroyed()) return;

    removePreviousCss(wc);

    if (!font) {
        wc.executeJavaScript(
            '(function(){window.__lch_canvas_font__=null;})()'
        ).catch(() => {});
        return;
    }

    const { fontFace, override } = buildFontParts(font);

    // @font-face at author origin (Chromium ignores @font-face in user stylesheets)
    if (fontFace) {
        try {
            const res = wc.insertCSS(fontFace);
            const setKey = (key: string) => { fontFaceKeysByWc.set(wc, key); };
            if (res && typeof (res as Promise<string>).then === "function") {
                (res as Promise<string>).then(setKey).catch((e) => logErr(e, "FontInjector"));
            } else if (typeof res === "string") {
                setKey(res as string);
            }
        } catch (e) { logErr(e, "FontInjector"); }
    }

    // Font-family override at user origin (highest cascade priority)
    try {
        const res = wc.insertCSS(override, { cssOrigin: "user" });
        const setKey = (key: string) => { overrideKeysByWc.set(wc, key); };
        if (res && typeof (res as Promise<string>).then === "function") {
            (res as Promise<string>).then(setKey).catch((e) => logErr(e, "FontInjector"));
        } else if (typeof res === "string") {
            setKey(res as string);
        }
    } catch (e) { logErr(e, "FontInjector"); }

    // Complementary: <style> element for edge cases
    try {
        const fullCss = fontFace ? `${fontFace}\n${override}` : override;
        const escaped = fullCss.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
        wc.executeJavaScript(`(function(){
            try {
                var s=document.getElementById('__lch_font__');
                if(!s){s=document.createElement('style');s.id='__lch_font__';document.head.appendChild(s);}
                s.textContent=\`${escaped}\`;
            } catch(e){}
        })()`).catch(() => {});
    } catch { /* destroyed */ }

    // Canvas 2D font interceptor
    try {
        wc.executeJavaScript(buildCanvasFontInterceptorJS(font)).catch(() => {});
    } catch { /* destroyed */ }
}

/**
 * Registers a `did-finish-load` listener that re-applies the font after
 * every full page load. Returns a cleanup function.
 */
export function registerFontListener(
    wc: WebContents,
    getFont: () => string | null,
): () => void {
    const onFinishLoad = () => { applyFontToWebContents(wc, getFont()); };
    wc.on("did-finish-load", onFinishLoad);
    return () => {
        try { wc.off("did-finish-load", onFinishLoad); } catch { /* destroyed */ }
    };
}

/**
 * Convenience: removes tracking for a destroyed WebContents.
 */
export function cleanupWebContents(wc: WebContents): void {
    overrideKeysByWc.delete(wc);
    fontFaceKeysByWc.delete(wc);
}

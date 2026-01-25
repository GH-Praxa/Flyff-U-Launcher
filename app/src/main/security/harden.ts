import { app } from "electron";
import type { BrowserWindow, WebContents, Session } from "electron";
import * as crypto from "crypto";

/**
 * Generates a cryptographically secure nonce for CSP.
 */
function generateNonce(): string {
    return crypto.randomBytes(16).toString("base64");
}

// Store current nonce for the session
let currentNonce: string = generateNonce();

/**
 * Gets the current CSP nonce. Call this before each page load.
 */
export function getCSPNonce(): string {
    return currentNonce;
}

/**
 * Regenerates the CSP nonce. Should be called periodically or on navigation.
 */
export function regenerateNonce(): string {
    currentNonce = generateNonce();
    return currentNonce;
}

/**
 * Content Security Policy for the launcher UI.
 *
 * Security notes:
 * - 'unsafe-inline' for styles is required because:
 *   1. Dynamic theme colors are applied via element.style.setProperty()
 *   2. Canvas animations set inline dimensions
 *   3. Some UI components require runtime style calculations
 *
 * - Mitigations in place:
 *   1. All content is local (file://) - no remote injection vector
 *   2. Context isolation is enabled - renderer can't access Node.js
 *   3. No user-generated content is rendered as HTML
 *   4. All external URLs are explicitly whitelisted
 *
 * - Future improvement: Migrate to CSS Custom Properties exclusively
 *   and use a build-time CSS-in-JS solution with hashed styles.
 */
function buildCSP(nonce?: string): string {
    const stylePolicy = nonce
        ? `'self' 'nonce-${nonce}'`
        : "'self' 'unsafe-inline'";

    return [
        "default-src 'self' blob: data:",
        // Allow unsafe-inline for plugin UI iframes (sandboxed, low risk)
        "script-src 'self' 'unsafe-inline'",
        `style-src ${stylePolicy}`,
        "img-src 'self' data: https: blob: file:",
        "font-src 'self' data:",
        "connect-src 'self' https://universe.flyff.com https://*.flyff.com https://raw.githubusercontent.com",
        "frame-src 'self' file: blob: data:",
        "object-src 'none'",
        // Allow file:// base-uri for plugin UI iframes
        "base-uri 'self' file:",
    ].join("; ");
}

// Default CSP with unsafe-inline (for compatibility)
const LAUNCHER_CSP = buildCSP();

/**
 * Applies Content Security Policy to a session.
 * Should be called early in app initialization.
 */
export function applyCSP(session: Session): void {
    session.webRequest.onHeadersReceived((details, callback) => {
        // Only apply CSP to our own pages, not external content
        const url = details.url;
        const isDataUrl = url.startsWith("data:");
        const isAbout = url.startsWith("about:");
        const isBlob = url.startsWith("blob:");
        // Skip CSP for data: URLs (overlay/hud/windows use inline scripts)
        // Skip CSP for about:srcdoc/blank (plugin UI iframes use srcdoc)
        // Skip CSP for blob: URLs (plugin UI blobs)
        if (isDataUrl || isAbout || isBlob) {
            callback({ responseHeaders: details.responseHeaders });
            return;
        }
        // Skip CSP for plugin UIs (allow inline scripts/styles inside iframe srcdoc)
        const pluginDir = app.getPath("userData").replace(/\\/g, "/") + "/plugins/";
        if (url.startsWith("file://") && url.includes("/plugins/")) {
            callback({ responseHeaders: details.responseHeaders });
            return;
        }
        const isLocalContent = url.startsWith("file://") ||
                               url.startsWith("http://localhost");

        if (isLocalContent) {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    "Content-Security-Policy": [LAUNCHER_CSP],
                },
            });
        } else {
            callback({ responseHeaders: details.responseHeaders });
        }
    });
}

export function hardenWebviews(win: BrowserWindow) {
    win.webContents.on("will-attach-webview", (event, webPreferences, params) => {
        const src = params.src || "";
        const allowed = src === "" || src === "about:blank" || src.startsWith("https://universe.flyff.com/");
        if (!allowed)
            event.preventDefault();
        webPreferences.nodeIntegration = false;
        webPreferences.contextIsolation = true;
        delete (webPreferences as Record<string, unknown>).preload;
        delete (webPreferences as Record<string, unknown>).preloadURL;
    });
}
export function hardenGameContents(wc: WebContents) {
    wc.setWindowOpenHandler(() => ({ action: "deny" }));
    wc.on("will-navigate", (e, url) => {
        if (!url.startsWith("https://universe.flyff.com/") && url !== "about:blank") {
            e.preventDefault();
        }
    });
}

import { BrowserWindow, session } from "electron";
import { hardenGameContents } from "../security/harden";

const GOOGLE_FRAME_SOURCES = "https://www.google.com https://accounts.google.com https://recaptcha.net https://www.recaptcha.net";
const patchedCspPartitions = new Set<string>();

/**
 * Patches CSP for font data: URIs and Google login frame-src on instance windows.
 * Only registers a handler for instance-specific partitions (persist:...-instance-N).
 * The base partition (persist:profileId) is already handled by the session tabs manager.
 */
function ensureInstanceCsp(partition: string): void {
    if (patchedCspPartitions.has(partition)) return;
    // Skip base partitions — the session tabs manager already owns their onHeadersReceived.
    if (!partition.includes("-instance-")) return;
    patchedCspPartitions.add(partition);
    const sess = session.fromPartition(partition);
    sess.webRequest.onHeadersReceived((details, callback) => {
        if (!details.responseHeaders) {
            callback({ responseHeaders: details.responseHeaders });
            return;
        }
        const headers: Record<string, string[]> = { ...(details.responseHeaders as Record<string, string[]>) };
        const cspKey = Object.keys(headers).find(k => k.toLowerCase() === "content-security-policy");
        if (cspKey) {
            let csp = Array.isArray(headers[cspKey]) ? headers[cspKey][0] : String(headers[cspKey]);
            if (csp) {
                if (!csp.includes("font-src")) {
                    csp = `${csp}; font-src 'self' data: https://fonts.gstatic.com`;
                } else if (!/font-src[^;]*data:/.test(csp)) {
                    csp = csp.replace(/(font-src[^;]*)/, "$1 data:");
                }
                // Also patch frame-src / child-src for Google login
                const patchDirective = (c: string, directive: string, sources: string): string => {
                    const re = new RegExp(`(${directive}[^;]*)`, "i");
                    if (re.test(c)) return c.replace(re, `$1 ${sources}`);
                    return `${c}; ${directive} 'self' ${sources}`;
                };
                csp = patchDirective(csp, "frame-src", GOOGLE_FRAME_SOURCES);
                csp = patchDirective(csp, "child-src", GOOGLE_FRAME_SOURCES);
                headers[cspKey] = [csp];
            }
        }
        callback({ responseHeaders: headers });
    });
}

export function createInstanceWindow(profileId: string, opts: {
    flyffUrl: string;
    startFullscreen: boolean;
    partition?: string;
}): BrowserWindow {
    const partition = opts.partition ?? `persist:${profileId}`;
    ensureInstanceCsp(partition);
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        show: false,
        backgroundColor: "#0b1220",
        autoHideMenuBar: true,
        title: `Flyff - ${profileId}`,
        webPreferences: {
            partition,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            backgroundThrottling: false,
        },
    });
    hardenGameContents(win.webContents);
    win.webContents.loadURL("about:blank").catch((err) => console.error("[InstanceWindow] load failed", err));
    win.webContents.loadURL(opts.flyffUrl).catch((err) => {
        console.error("Failed to load Flyff URL in instance window:", err);
        if (!win.isDestroyed()) {
            win.close();
        }
    });
    win.once("ready-to-show", () => {
        if (win.isDestroyed())
            return;
        if (opts.startFullscreen) {
            win.maximize();
        }
        win.show();
    });
    return win;
}

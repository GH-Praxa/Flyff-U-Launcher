import type { BrowserWindow, WebContents } from "electron";
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

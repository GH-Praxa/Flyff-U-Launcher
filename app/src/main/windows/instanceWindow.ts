import { BrowserWindow } from "electron";
import { hardenGameContents } from "../security/harden";
export function createInstanceWindow(profileId: string, opts: {
    flyffUrl: string;
    startFullscreen: boolean;
    partition?: string;
}): BrowserWindow {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        show: false,
        backgroundColor: "#0b1220",
        autoHideMenuBar: true,
        title: `Flyff - ${profileId}`,
        webPreferences: {
            partition: opts.partition ?? `persist:${profileId}`,
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

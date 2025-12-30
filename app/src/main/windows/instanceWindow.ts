import { BrowserWindow } from "electron";
import { hardenGameContents } from "../security/harden";
export function createInstanceWindow(profileId: string, opts: {
    flyffUrl: string;
}): BrowserWindow {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        show: false,
        backgroundColor: "#0b1220",
        autoHideMenuBar: true,
        title: `Flyff - ${profileId}`,
        webPreferences: {
            partition: `persist:${profileId}`,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            backgroundThrottling: false,
        },
    });
    hardenGameContents(win.webContents);
    win.webContents.loadURL("about:blank").catch((err) => console.error("[InstanceWindow] load failed", err));
    win.webContents.loadURL(opts.flyffUrl).catch(console.error);
    win.once("ready-to-show", () => {
        if (!win.isDestroyed())
            win.show();
    });
    return win;
}

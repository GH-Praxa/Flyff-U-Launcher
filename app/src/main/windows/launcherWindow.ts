import { BrowserWindow } from "electron";
import { hardenWebviews } from "../security/harden";
import type { LoadView } from "../viewLoader";
import flyffIcon from "../../assets/icons/flyff.png";
export function createLauncherWindow(opts: {
    preloadPath: string;
    loadView: LoadView;
    onClosed?: () => void;
}) {
    const win = new BrowserWindow({
        width: 980,
        height: 640,
        show: false,
        backgroundColor: "#0b1220",
        webPreferences: {
            preload: opts.preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false,
        },
        icon: flyffIcon,
    });
    win.setMenuBarVisibility(false);
    win.setMenu(null);
    hardenWebviews(win);

    // Fix Windows DWM flicker/ghost window during move/resize
    if (process.platform === "win32") {
        let resizeTimeout: NodeJS.Timeout | null = null;
        const scheduleInvalidate = () => {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (!win.isDestroyed()) {
                    win.webContents.invalidate();
                }
            }, 16);
        };
        win.on("will-move", scheduleInvalidate);
        win.on("will-resize", scheduleInvalidate);
    }

    opts.loadView(win, "launcher").catch(console.error);
    win.once("ready-to-show", () => {
        if (!win.isDestroyed())
            win.show();
    });
    win.on("closed", () => opts.onClosed?.());
    return win;
}

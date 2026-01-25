import { app, BrowserWindow } from "electron";
import { hardenWebviews } from "../security/harden";
import type { LoadView } from "../viewLoader";
import flyffIcon from "../../assets/icons/flyff.png";
import { LAYOUT, TIMINGS } from "../../shared/constants";
export function createLauncherWindow(opts: {
    preloadPath: string;
    loadView: LoadView;
    onClosed?: () => void;
}) {
    const win = new BrowserWindow({
        width: LAYOUT.LAUNCHER_WIDTH,
        height: LAYOUT.LAUNCHER_HEIGHT,
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
    // if (!app.isPackaged) {
    //     win.webContents.openDevTools({ mode: "detach" });
    // }

    // Fix Windows DWM flicker/ghost window during move/resize
    if (process.platform === "win32") {
        let resizeTimeout: NodeJS.Timeout | null = null;
        const scheduleInvalidate = () => {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (!win.isDestroyed()) {
                    win.webContents.invalidate();
                }
            }, TIMINGS.INVALIDATE_DEBOUNCE_MS);
        };

        // Cleanup timer on window close to prevent memory leak
        win.on("close", () => {
            if (resizeTimeout) {
                clearTimeout(resizeTimeout);
                resizeTimeout = null;
            }
        });

        win.on("will-move", scheduleInvalidate);
        win.on("will-resize", scheduleInvalidate);
    }

    opts.loadView(win, "launcher").catch((err) => {
        console.error("Failed to load launcher view:", err);
        if (!win.isDestroyed()) {
            win.close();
        }
    });
    win.once("ready-to-show", () => {
        if (!win.isDestroyed())
            win.show();
    });
    win.on("closed", () => opts.onClosed?.());
    return win;
}

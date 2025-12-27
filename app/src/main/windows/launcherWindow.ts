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
        },
        icon: flyffIcon,
    });
    win.setMenuBarVisibility(false);
    win.setMenu(null);
    hardenWebviews(win);
    opts.loadView(win, "launcher").catch(console.error);
    win.once("ready-to-show", () => {
        if (!win.isDestroyed())
            win.show();
    });
    win.on("closed", () => opts.onClosed?.());
    return win;
}

import { BrowserWindow } from "electron";
import type { LoadView } from "../viewLoader";
export function createSessionWindowController(opts: {
    preloadPath: string;
    loadView: LoadView;
}) {
    let sessionWindow: BrowserWindow | null = null;
    const onClosedHandlers: Array<() => void> = [];
    async function ensure() {
        if (sessionWindow && !sessionWindow.isDestroyed())
            return sessionWindow;
        sessionWindow = new BrowserWindow({
            width: 1380,
            height: 860,
            autoHideMenuBar: true,
            webPreferences: {
                preload: opts.preloadPath,
                contextIsolation: true,
                nodeIntegration: false,
            },
        });
        sessionWindow.setMaxListeners(0);
        sessionWindow.setMenuBarVisibility(false);
        sessionWindow.setAutoHideMenuBar(true);
        await opts.loadView(sessionWindow, "session");
        sessionWindow.on("closed", () => {
            sessionWindow = null;
            for (const fn of onClosedHandlers) {
                try {
                    fn();
                }
                catch (err) {
                    console.error("[SessionWindow]", err);
                }
            }
        });
        return sessionWindow;
    }
    function get() {
        return sessionWindow && !sessionWindow.isDestroyed() ? sessionWindow : null;
    }
    function onClosed(fn: () => void) {
        onClosedHandlers.push(fn);
    }
    return { ensure, get, onClosed };
}
export type SessionWindowController = ReturnType<typeof createSessionWindowController>;

import { BrowserWindow } from "electron";
import type { LoadView } from "../viewLoader";
export function createSessionWindowController(opts: {
    preloadPath: string;
    loadView: LoadView;
}) {
    let sessionWindow: BrowserWindow | null = null;
    const onClosedHandlers: Array<() => void> = [];
    let skipClosePrompt = false;
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
        sessionWindow.on("close", (e) => {
            if (!sessionWindow || sessionWindow.isDestroyed())
                return;
            if (skipClosePrompt) {
                skipClosePrompt = false;
                return;
            }
            e.preventDefault();
            try {
                sessionWindow.webContents.send("sessionWindow:closeRequested");
            }
            catch (err) {
                console.error("[SessionWindow]", err);
                skipClosePrompt = true;
                try {
                    sessionWindow.close();
                }
                catch (err2) {
                    console.error("[SessionWindow]", err2);
                }
            }
        });
        await opts.loadView(sessionWindow, "session");
        sessionWindow.on("closed", () => {
            sessionWindow = null;
            skipClosePrompt = false;
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
    function allowCloseWithoutPrompt() {
        skipClosePrompt = true;
    }
    function closeWithoutPrompt() {
        const win = get();
        if (!win)
            return;
        skipClosePrompt = true;
        win.close();
    }
    return { ensure, get, onClosed, allowCloseWithoutPrompt, closeWithoutPrompt };
}
export type SessionWindowController = ReturnType<typeof createSessionWindowController>;

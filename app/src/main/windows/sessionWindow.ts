import { BrowserWindow } from "electron";
import type { LoadView } from "../viewLoader";
export function createSessionWindowController(opts: {
    preloadPath: string;
    loadView: LoadView;
    shouldMaximize?: () => Promise<boolean>;
}) {
    let sessionWindow: BrowserWindow | null = null;
    const onClosedHandlers: Array<() => void> = [];
    let skipClosePrompt = false;
    let windowIsNew = false;
    async function ensure(params?: Record<string, string>): Promise<BrowserWindow> {
        if (sessionWindow && !sessionWindow.isDestroyed()) {
            windowIsNew = false;
            return sessionWindow;
        }
        windowIsNew = true;
        sessionWindow = new BrowserWindow({
            width: 1380,
            height: 860,
            show: false,
            backgroundColor: "#0b1220",
            autoHideMenuBar: true,
            webPreferences: {
                preload: opts.preloadPath,
                contextIsolation: true,
                nodeIntegration: false,
                backgroundThrottling: false,
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
        sessionWindow.once("ready-to-show", async () => {
            if (!sessionWindow || sessionWindow.isDestroyed())
                return;
            if (opts.shouldMaximize) {
                try {
                    if (await opts.shouldMaximize()) {
                        sessionWindow.maximize();
                    }
                }
                catch (err) {
                    console.error("[SessionWindow] maximize failed", err);
                }
            }
            sessionWindow.show();
        });
        await opts.loadView(sessionWindow, "session", params);
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
    function isNew(): boolean {
        return windowIsNew;
    }
    return { ensure, get, onClosed, allowCloseWithoutPrompt, closeWithoutPrompt, isNew };
}
export type SessionWindowController = ReturnType<typeof createSessionWindowController>;

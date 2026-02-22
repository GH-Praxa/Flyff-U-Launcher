import { BrowserWindow } from "electron";
import type { LoadView } from "../viewLoader";

/**
 * Creates a single session window (factory function for multi-window support).
 */
export async function createSessionWindow(opts: {
    preloadPath: string;
    loadView: LoadView;
    shouldMaximize?: () => Promise<boolean>;
    windowId: string;
    params?: Record<string, string>;
}): Promise<BrowserWindow> {
    const win = new BrowserWindow({
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

    win.setMaxListeners(0);
    win.setMenuBarVisibility(false);
    win.setAutoHideMenuBar(true);

    let skipClosePrompt = false;

    win.on("close", (e) => {
        if (win.isDestroyed()) return;
        if (skipClosePrompt) {
            skipClosePrompt = false;
            return;
        }
        e.preventDefault();
        try {
            win.webContents.send("sessionWindow:closeRequested", opts.windowId);
        } catch (err) {
            console.error("[SessionWindow]", err);
            skipClosePrompt = true;
            try {
                win.close();
            } catch (err2) {
                console.error("[SessionWindow]", err2);
            }
        }
    });

    win.once("ready-to-show", async () => {
        if (win.isDestroyed()) return;
        if (opts.shouldMaximize) {
            try {
                if (await opts.shouldMaximize()) {
                    win.maximize();
                }
            } catch (err) {
                console.error("[SessionWindow] maximize failed", err);
            }
        }
        win.show();
    });

    win.webContents.setWindowOpenHandler(() => ({
        action: "allow",
        overrideBrowserWindowOptions: {
            autoHideMenuBar: true,
            menuBarVisible: false,
        },
    }));
    win.webContents.on("did-create-window", (child) => {
        child.setMenu(null);
        child.setMenuBarVisibility(false);
    });

    await opts.loadView(win, "session", opts.params);

    // Expose method to allow closing without prompt
    (win as any).__allowCloseWithoutPrompt = () => {
        skipClosePrompt = true;
    };

    return win;
}

/**
 * Legacy singleton controller for backward compatibility.
 * @deprecated Use createSessionWindow and SessionRegistry instead for multi-window support.
 */
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
        sessionWindow.webContents.setWindowOpenHandler(() => ({
            action: "allow",
            overrideBrowserWindowOptions: {
                autoHideMenuBar: true,
                menuBarVisible: false,
            },
        }));
        sessionWindow.webContents.on("did-create-window", (child) => {
            child.setMenu(null);
            child.setMenuBarVisibility(false);
        });
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

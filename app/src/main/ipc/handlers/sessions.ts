/**
 * IPC handlers for session and tab operations.
 */
import { z } from "zod";
import { app, BrowserWindow, BrowserView } from "electron";
import { SafeHandle, IpcEvent, assertValidId, assertValid } from "../common";
import { BoundsSchema, RatioSchema, SplitPairSchema, type Bounds } from "../../../shared/schemas";

export type SessionWindowController = {
    ensure: (params?: Record<string, string>) => Promise<BrowserWindow>;
    get: () => BrowserWindow | null;
    allowCloseWithoutPrompt: () => void;
    closeWithoutPrompt: () => void;
    isNew: () => boolean;
};

export type SessionTabsManager = {
    open: (profileId: string) => Promise<boolean>;
    switchTo: (profileId: string) => Promise<void> | void;
    login: (profileId: string) => Promise<void> | void;
    logout: (profileId: string) => Promise<void> | void;
    close: (profileId: string) => Promise<void> | void;
    setBounds: (bounds: Bounds) => void;
    setVisible: (visible: boolean) => void;
    setSplit: (pair: { primary: string; secondary: string; ratio?: number } | null) => Promise<void> | void;
    setSplitRatio: (ratio: number) => Promise<void> | void;
    reset: () => void;
    getActiveId?: () => string | null;
    isActive?: (profileId: string) => boolean;
    getViewByProfile?: (profileId: string) => BrowserView | null;
};

export type SessionHandlerOptions = {
    sessionTabs: SessionTabsManager;
    sessionWindow: SessionWindowController;
    createInstanceWindow: (profileId: string) => Promise<void>;
};

// Note: onSessionTabOpened removed - will be handled by plugins

export function registerSessionHandlers(
    safeHandle: SafeHandle,
    opts: SessionHandlerOptions,
    logErr: (msg: unknown) => void
): void {
    safeHandle("session:openTab", async (_e: IpcEvent, profileId: string) => {
        assertValidId(profileId, "profileId");
        const win = await opts.sessionWindow.ensure();
        win.show();
        win.focus();
        await opts.sessionTabs.open(profileId);
        try {
            win.webContents.send("session:openTab", profileId);
            return true;
        } catch (err) {
            logErr(err);
            throw err;
        }
    });

    safeHandle("instance:openWindow", async (_e: IpcEvent, profileId: string) => {
        assertValidId(profileId, "profileId");
        await opts.createInstanceWindow(profileId);
        return true;
    });

    safeHandle("sessionTabs:open", async (_e: IpcEvent, profileId: string) => {
        assertValidId(profileId, "profileId");
        await opts.sessionTabs.open(profileId);
        return true;
    });

    safeHandle("sessionTabs:switch", async (_e: IpcEvent, profileId: string) => {
        assertValidId(profileId, "profileId");
        await opts.sessionTabs.switchTo(profileId);
        return true;
    });

    safeHandle("sessionTabs:logout", async (_e: IpcEvent, profileId: string) => {
        assertValidId(profileId, "profileId");
        await opts.sessionTabs.logout(profileId);
        return true;
    });

    safeHandle("sessionTabs:login", async (_e: IpcEvent, profileId: string) => {
        assertValidId(profileId, "profileId");
        await opts.sessionTabs.login(profileId);
        return true;
    });

    safeHandle("sessionTabs:close", async (_e: IpcEvent, profileId: string) => {
        assertValidId(profileId, "profileId");
        await opts.sessionTabs.close(profileId);
        return true;
    });

    safeHandle("sessionTabs:setBounds", async (_e: IpcEvent, bounds: Bounds) => {
        assertValid(BoundsSchema, bounds, "bounds");
        opts.sessionTabs.setBounds(bounds);
        return true;
    });

    safeHandle("sessionTabs:setVisible", async (_e: IpcEvent, visible: boolean) => {
        assertValid(z.boolean(), visible, "visible");
        opts.sessionTabs.setVisible(visible);
        return true;
    });

    safeHandle("sessionTabs:setSplit", async (_e: IpcEvent, pair: {
        primary: string;
        secondary: string;
        ratio?: number;
    } | null) => {
        if (pair !== null) {
            assertValid(SplitPairSchema, pair, "split pair");
        }
        await opts.sessionTabs.setSplit(pair);
        return true;
    });

    safeHandle("sessionTabs:setSplitRatio", async (_e: IpcEvent, ratio: number) => {
        assertValid(RatioSchema, ratio, "ratio");
        await opts.sessionTabs.setSplitRatio(ratio);
        return true;
    });

    safeHandle("sessionTabs:reset", async () => {
        opts.sessionTabs.reset();
        return true;
    });

    safeHandle("sessionWindow:close", async () => {
        opts.sessionWindow.closeWithoutPrompt();
        return true;
    });

    safeHandle("app:quit", async () => {
        opts.sessionWindow.allowCloseWithoutPrompt();
        app.quit();
        return true;
    });
}

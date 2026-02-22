/**
 * IPC handlers for session and tab operations.
 */
import { z } from "zod";
import { app, BrowserWindow, BrowserView, Menu } from "electron";
import { SafeHandle, IpcEvent, assertValidId, assertValid } from "../common";
import { BoundsSchema, RatioSchema, SplitPairSchema, MultiViewLayoutSchema, NameSchema, type Bounds, type MultiViewLayout, type TabWindowMetadata, DEFAULT_LOCALE, type Locale } from "../../../shared/schemas";
import { translations, type TranslationKey } from "../../../i18n/translations";
import type { SessionRegistry } from "../../windows/sessionRegistry";
import type { ProfilesStore } from "./profiles";

export type SessionWindowController = {
    ensure: (params?: Record<string, string>) => Promise<BrowserWindow>;
    get: () => BrowserWindow | null;
    allowCloseWithoutPrompt: () => void;
    closeWithoutPrompt: () => void;
    isNew: () => boolean;
};

export type SessionTabsManager = {
    open: (profileId: string) => Promise<boolean>;
    openInCell?: (position: number, profileId: string, options?: { activate?: boolean; forceLoad?: boolean }) => Promise<boolean>;
    switchTo: (profileId: string) => Promise<void> | void;
    login: (profileId: string) => Promise<void> | void;
    logout: (profileId: string) => Promise<void> | void;
    close: (profileId: string) => Promise<void> | void;
    setBounds: (bounds: Bounds) => void;
    setVisible: (visible: boolean) => void;
    setMultiLayout: (
        layout: MultiViewLayout | null,
        options?: { ensureViews?: boolean; allowMissingViews?: boolean }
    ) => Promise<void> | void;
    updateCell: (position: number, profileId: string | null) => Promise<void> | void;
    setSplit: (pair: { primary: string; secondary: string; ratio?: number } | null) => Promise<void> | void;
    setSplitRatio: (ratio: number) => Promise<void> | void;
    reset: () => void;
    getActiveId?: () => string | null;
    isActive?: (profileId: string) => boolean;
    getViewByProfile?: (profileId: string) => BrowserView | null;
    getWindow?: () => BrowserWindow | null;
    getLoadedProfileIds?: () => string[];
    hasLoadedProfile?: (profileId: string) => boolean;
};

export type SessionHandlerOptions = {
    sessionTabs: SessionTabsManager;
    sessionWindow: SessionWindowController;
    sessionRegistry: SessionRegistry; // Multi-window registry
    profiles: ProfilesStore;
    createInstanceWindow: (profileId: string) => Promise<void>;
    createTabWindow: (opts?: { name?: string }) => Promise<string>; // Returns windowId
    getLocale?: () => Promise<Locale>;
};

// Note: onSessionTabOpened removed - will be handled by plugins

export function registerSessionHandlers(
    safeHandle: SafeHandle,
    opts: SessionHandlerOptions,
    logErr: (msg: unknown) => void
): void {
    const resolveLocale = async (): Promise<Locale> => {
        try {
            return await (opts.getLocale?.() ?? Promise.resolve(DEFAULT_LOCALE));
        } catch {
            return DEFAULT_LOCALE;
        }
    };
    const tMain = async (key: TranslationKey): Promise<string> => {
        const locale = await resolveLocale();
        return translations[locale]?.[key] ?? translations.en[key] ?? key;
    };
    /**
     * Ensure the registry stores the first profile that opened a window.
     */
    const ensureInitialProfile = (entryId: string, profileId: string) => {
        const current = opts.sessionRegistry.getInitialProfileId(entryId);
        if (!current) {
            opts.sessionRegistry.setInitialProfileId(entryId, profileId);
        }
    };

    /**
     * Helper to find the correct TabsManager and Window from the event sender.
     * Returns the registry entry if found in multi-window mode, otherwise null.
     */
    function findWindowFromSender(e: IpcEvent) {
        const senderWebContents = e.sender;
        for (const entry of opts.sessionRegistry.list()) {
            if (entry.window.webContents === senderWebContents) {
                return entry;
            }
        }
        return null;
    }

    safeHandle("session:openTab", async (_e: IpcEvent, profileId: string, windowId?: string) => {
        assertValidId(profileId, "profileId");
        if (windowId !== undefined) {
            assertValidId(windowId, "windowId");
        }

        // Multi-window mode
        if (windowId && opts.sessionRegistry.has(windowId)) {
            const entry = opts.sessionRegistry.get(windowId);
            if (!entry) {
                throw new Error(`Window ${windowId} not found`);
            }
            ensureInitialProfile(windowId, profileId);
            const win = entry.window;
            win.show();
            win.focus();
            await entry.tabsManager.open(profileId);
            try {
                win.webContents.send("session:openTab", profileId);
                return true;
            } catch (err) {
                logErr(err);
                throw err;
            }
        }

        // Legacy single-window mode
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

    safeHandle("session:createWindowWithLayout", async (_e: IpcEvent, layout: MultiViewLayout, windowId: string, initialProfileId?: string) => {
        assertValid(MultiViewLayoutSchema, layout, "layout");
        assertValidId(windowId, "windowId");
        if (initialProfileId) {
            assertValidId(initialProfileId, "initialProfileId");
        }

        // Multi-window mode - create window with full layout
        if (opts.sessionRegistry.has(windowId)) {
            const entry = opts.sessionRegistry.get(windowId);
            if (!entry) {
                throw new Error(`Window ${windowId} not found`);
            }
            const win = entry.window;
            const tabsManager = entry.tabsManager;

            // Store the initial profile ID
            if (initialProfileId) {
                opts.sessionRegistry.setInitialProfileId(windowId, initialProfileId);
            }

            console.log(`[session:createWindowWithLayout] Creating window ${windowId} with layout:`, JSON.stringify(layout, null, 2));

            // Wait for window to be fully ready
            await new Promise(resolve => setTimeout(resolve, 300));

            win.show();
            win.focus();

            // Set bounds after window is shown
            await new Promise(resolve => setTimeout(resolve, 100));
            const winBounds = win.getContentBounds();
            console.log(`[session:createWindowWithLayout] Window bounds:`, winBounds);

            const viewBounds = {
                x: 0,
                y: 60,
                width: winBounds.width,
                height: winBounds.height - 60,
            };
            console.log(`[session:createWindowWithLayout] Setting view bounds:`, viewBounds);

            tabsManager.setBounds(viewBounds);
            tabsManager.setVisible(true);

            try {
                // Set the full layout with all cells
                console.log(`[session:createWindowWithLayout] Calling setMultiLayout with ${layout.cells.length} cells`);
                await tabsManager.setMultiLayout(layout, { ensureViews: true, allowMissingViews: false });

                // Give BrowserViews time to be created
                await new Promise(resolve => setTimeout(resolve, 500));

                // Now explicitly open each profile to ensure they load
                console.log(`[session:createWindowWithLayout] Opening profiles in cells...`);
                for (const cell of layout.cells) {
                    console.log(`[session:createWindowWithLayout] Opening profile ${cell.id} in cell ${cell.position}`);
                    if (tabsManager.openInCell) {
                        try {
                            await tabsManager.openInCell(cell.position, cell.id, {
                                activate: cell.position === layout.activePosition,
                                forceLoad: true
                            });
                            // Small delay between loads
                            await new Promise(resolve => setTimeout(resolve, 200));
                        } catch (err) {
                            console.error(`[session:createWindowWithLayout] Error opening cell ${cell.position}:`, err);
                        }
                    }
                }

                console.log(`[session:createWindowWithLayout] Layout created successfully with ${layout.cells.length} cells`);

                // Send event to renderer to update the tabs UI
                try {
                    win.webContents.send("session:layoutCreated", layout);
                } catch (err) {
                    console.error(`[session:createWindowWithLayout] Failed to send layoutCreated event:`, err);
                }
            } catch (err) {
                console.error(`[session:createWindowWithLayout] Error:`, err);
                throw err;
            }

            return true;
        }

        throw new Error(`Window ${windowId} not found`);
    });

    safeHandle("session:openTabWithLayout", async (_e: IpcEvent, profileId: string, layoutType: string, windowId?: string) => {
        assertValidId(profileId, "profileId");
        if (windowId !== undefined) {
            assertValidId(windowId, "windowId");
        }

        // Multi-window mode - directly create the layout and open the profile
        if (windowId && opts.sessionRegistry.has(windowId)) {
            const entry = opts.sessionRegistry.get(windowId);
            if (!entry) {
                throw new Error(`Window ${windowId} not found`);
            }
            ensureInitialProfile(windowId, profileId);
            const win = entry.window;
            const tabsManager = entry.tabsManager;

            console.log(`[session:openTabWithLayout] Opening profile ${profileId} with layout ${layoutType} in window ${windowId}`);

            // Wait a bit for window to be fully ready
            await new Promise(resolve => setTimeout(resolve, 300));

            win.show();
            win.focus();

            // Set bounds after window is shown
            await new Promise(resolve => setTimeout(resolve, 100));
            const winBounds = win.getContentBounds();
            console.log(`[session:openTabWithLayout] Window bounds:`, winBounds);

            tabsManager.setBounds({
                x: 0,
                y: 60,
                width: winBounds.width,
                height: winBounds.height - 60,
            });
            tabsManager.setVisible(true);

            // Create the layout structure
            const layout: MultiViewLayout = {
                type: layoutType as any,
                cells: [{ id: profileId, position: 0 }],
                activePosition: 0,
            };

            console.log(`[session:openTabWithLayout] Setting layout:`, layout);

            try {
                // Set the layout structure
                await tabsManager.setMultiLayout(layout, { ensureViews: true, allowMissingViews: false });

                // Give it a moment to create the BrowserViews
                await new Promise(resolve => setTimeout(resolve, 200));

                // Then explicitly open the profile in the first cell to ensure it loads
                if (tabsManager.openInCell) {
                    await tabsManager.openInCell(0, profileId, { activate: true, forceLoad: true });
                }

                console.log(`[session:openTabWithLayout] Layout created and profile opened successfully`);
            } catch (err) {
                console.error(`[session:openTabWithLayout] Error:`, err);
                throw err;
            }

            return true;
        }

        // Legacy single-window mode
        const win = await opts.sessionWindow.ensure();
        win.show();
        win.focus();
        // Send event to trigger layout config modal
        // Use delay for new windows to ensure renderer is fully loaded
        const delay = opts.sessionWindow.isNew() ? 500 : 100;
        setTimeout(() => {
            win.webContents.send("session:openTabWithLayout", profileId, layoutType);
        }, delay);
        return true;
    });

    safeHandle("instance:openWindow", async (_e: IpcEvent, profileId: string) => {
        assertValidId(profileId, "profileId");
        await opts.createInstanceWindow(profileId);
        return true;
    });

    safeHandle("sessionTabs:open", async (e: IpcEvent, profileId: string) => {
        assertValidId(profileId, "profileId");
        const entry = findWindowFromSender(e);
        if (entry) {
            ensureInitialProfile(entry.id, profileId);
            await entry.tabsManager.open(profileId);
            return true;
        }
        await opts.sessionTabs.open(profileId);
        return true;
    });

    safeHandle("sessionTabs:switch", async (e: IpcEvent, profileId: string) => {
        assertValidId(profileId, "profileId");
        const entry = findWindowFromSender(e);
        if (entry) {
            await entry.tabsManager.switchTo(profileId);
            return true;
        }
        await opts.sessionTabs.switchTo(profileId);
        return true;
    });

    safeHandle("sessionTabs:logout", async (e: IpcEvent, profileId: string) => {
        assertValidId(profileId, "profileId");
        const entry = findWindowFromSender(e);
        if (entry) {
            await entry.tabsManager.logout(profileId);
            return true;
        }
        await opts.sessionTabs.logout(profileId);
        return true;
    });

    safeHandle("sessionTabs:login", async (e: IpcEvent, profileId: string) => {
        assertValidId(profileId, "profileId");
        const entry = findWindowFromSender(e);
        if (entry) {
            await entry.tabsManager.login(profileId);
            return true;
        }
        await opts.sessionTabs.login(profileId);
        return true;
    });

    safeHandle("sessionTabs:close", async (e: IpcEvent, profileId: string) => {
        assertValidId(profileId, "profileId");
        const entry = findWindowFromSender(e);
        if (entry) {
            await entry.tabsManager.close(profileId);
            return true;
        }
        await opts.sessionTabs.close(profileId);
        return true;
    });

    safeHandle("sessionTabs:setBounds", async (e: IpcEvent, bounds: Bounds) => {
        assertValid(BoundsSchema, bounds, "bounds");
        const entry = findWindowFromSender(e);
        if (entry) {
            entry.tabsManager.setBounds(bounds);
            return true;
        }
        opts.sessionTabs.setBounds(bounds);
        return true;
    });

    safeHandle("sessionTabs:setVisible", async (e: IpcEvent, visible: boolean) => {
        assertValid(z.boolean(), visible, "visible");
        const entry = findWindowFromSender(e);
        if (entry) {
            entry.tabsManager.setVisible(visible);
            return true;
        }
        opts.sessionTabs.setVisible(visible);
        return true;
    });

    safeHandle("sessionTabs:getOpenProfiles", async (e: IpcEvent) => {
        // Check if this is from a multi-window session
        const entry = findWindowFromSender(e);
        if (entry) {
            if (typeof entry.tabsManager.getLoadedProfileIds !== "function") {
                return [] as string[];
            }
            return entry.tabsManager.getLoadedProfileIds();
        }

        // Legacy single-window mode
        if (typeof opts.sessionTabs.getLoadedProfileIds !== "function") {
            return [] as string[];
        }
        return opts.sessionTabs.getLoadedProfileIds();
    });

    safeHandle("sessionTabs:getAllOpenProfiles", async () => {
        const allProfiles = new Set<string>();

        // Collect from all multi-window sessions
        for (const entry of opts.sessionRegistry.list()) {
            if (typeof entry.tabsManager.getLoadedProfileIds === "function") {
                const profiles = entry.tabsManager.getLoadedProfileIds();
                profiles.forEach(p => allProfiles.add(p));
            }
        }

        // Also collect from legacy single-window
        if (typeof opts.sessionTabs.getLoadedProfileIds === "function") {
            const profiles = opts.sessionTabs.getLoadedProfileIds();
            profiles.forEach(p => allProfiles.add(p));
        }

        return Array.from(allProfiles);
    });

    safeHandle("sessionTabs:setMultiLayout", async (e: IpcEvent, layout: MultiViewLayout | null, options?: {
        ensureViews?: boolean;
        allowMissingViews?: boolean;
    }) => {
        if (layout !== null) {
            assertValid(MultiViewLayoutSchema, layout, "multi-view layout");
        }
        if (options) {
            assertValid(z.object({
                ensureViews: z.boolean().optional(),
                allowMissingViews: z.boolean().optional(),
            }), options, "layout options");
        }

        // Check if this is from a multi-window session
        const entry = findWindowFromSender(e);
        if (entry) {
            await entry.tabsManager.setMultiLayout(layout, options);
            return true;
        }

        // Legacy single-window mode
        await opts.sessionTabs.setMultiLayout(layout, options);
        return true;
    });

    safeHandle("sessionTabs:openInCell", async (e: IpcEvent, position: number, profileId: string, options?: {
        activate?: boolean;
        forceLoad?: boolean;
    }) => {
        assertValid(z.number().int().min(0).max(7), position, "cell position");
        assertValidId(profileId, "profileId");
        if (options) {
            assertValid(z.object({ activate: z.boolean().optional(), forceLoad: z.boolean().optional() }), options, "cell open options");
        }

        // Check if this is from a multi-window session
        const entry = findWindowFromSender(e);
        if (entry) {
            if (!entry.tabsManager.openInCell) {
                await entry.tabsManager.open(profileId);
                return true;
            }
            await entry.tabsManager.openInCell(position, profileId, options);
            return true;
        }

        // Legacy single-window mode
        if (!opts.sessionTabs.openInCell) {
            await opts.sessionTabs.open(profileId);
            return true;
        }
        await opts.sessionTabs.openInCell(position, profileId, options);
        return true;
    });

    safeHandle("sessionTabs:updateCell", async (e: IpcEvent, position: number, profileId: string | null) => {
        assertValid(z.number().int().min(0).max(7), position, "cell position");
        if (profileId !== null) {
            assertValidId(profileId, "profileId");
        }

        // Check if this is from a multi-window session
        const entry = findWindowFromSender(e);
        if (entry) {
            await entry.tabsManager.updateCell(position, profileId);
            return true;
        }

        // Legacy single-window mode
        await opts.sessionTabs.updateCell(position, profileId);
        return true;
    });

    safeHandle("sessionTabs:setSplit", async (e: IpcEvent, pair: {
        primary: string;
        secondary: string;
        ratio?: number;
    } | null) => {
        if (pair !== null) {
            assertValid(SplitPairSchema, pair, "split pair");
        }

        // Check if this is from a multi-window session
        const entry = findWindowFromSender(e);
        if (entry) {
            await entry.tabsManager.setSplit(pair);
            return true;
        }

        // Legacy single-window mode
        await opts.sessionTabs.setSplit(pair);
        return true;
    });

    safeHandle("sessionTabs:setSplitRatio", async (e: IpcEvent, ratio: number) => {
        assertValid(RatioSchema, ratio, "ratio");

        // Check if this is from a multi-window session
        const entry = findWindowFromSender(e);
        if (entry) {
            await entry.tabsManager.setSplitRatio(ratio);
            return true;
        }

        // Legacy single-window mode
        await opts.sessionTabs.setSplitRatio(ratio);
        return true;
    });

    safeHandle("sessionTabs:showLayoutMenu", async (_e: IpcEvent, payload: { x: number; y: number }) => {
        assertValid(z.object({ x: z.number().finite(), y: z.number().finite() }), payload, "menu coordinates");
        const win = opts.sessionWindow.get();
        if (!win || win.isDestroyed()) return null;

        const [labelRename, labelDissolve, labelCancel] = await Promise.all([
            tMain("layout.rename"),
            tMain("layout.dissolve" as TranslationKey),
            tMain("close.optionCancel"),
        ]);

        return await new Promise<"rename" | "dissolve" | null>((resolve) => {
            let done = false;
            const finish = (val: "rename" | "dissolve" | null) => {
                if (done) return;
                done = true;
                resolve(val);
            };
            const menu = Menu.buildFromTemplate([
                {
                    label: labelRename,
                    click: () => finish("rename"),
                },
                {
                    label: labelDissolve,
                    click: () => finish("dissolve"),
                },
                { type: "separator" },
                { label: labelCancel, role: "cancel" },
            ]);
            menu.popup({
                window: win,
                x: Math.round(payload.x),
                y: Math.round(payload.y),
                callback: () => finish(null),
            });
        });
    });

    safeHandle("sessionTabs:reset", async () => {
        opts.sessionTabs.reset();
        return true;
    });

    safeHandle("sessionWindow:close", async (e: IpcEvent) => {
        // Multi-window: close the window that initiated the request
        const entry = findWindowFromSender(e);
        if (entry) {
            const win = entry.window;
            try {
                (win as any).__allowCloseWithoutPrompt?.();
            }
            catch (err) {
                logErr(err);
            }
            try {
                win.close();
            }
            catch (err) {
                logErr(err);
            }
            return true;
        }

        // Legacy single-window fallback
        opts.sessionWindow.closeWithoutPrompt();
        return true;
    });

    safeHandle("app:quit", async () => {
        // Allow all session windows (legacy + multi-window) to bypass the close prompt
        for (const entry of opts.sessionRegistry.list()) {
            const win = entry.window;
            if (win && !win.isDestroyed()) {
                try {
                    (win as any).__allowCloseWithoutPrompt?.();
                }
                catch (err) {
                    logErr(err);
                }
            }
        }

        opts.sessionWindow.allowCloseWithoutPrompt();
        app.quit();
        return true;
    });

    safeHandle("app:getVersion", async () => {
        return app.getVersion();
    });

    // ========================================================================
    // Multi-Window Handlers
    // ========================================================================

    safeHandle("session:createTabWindow", async (_e: IpcEvent, name?: string) => {
        if (name !== undefined) {
            assertValid(NameSchema.optional(), name, "window name");
        }
        const windowId = await opts.createTabWindow({ name });
        return windowId;
    });

    safeHandle("session:listTabWindows", async (): Promise<TabWindowMetadata[]> => {
        return opts.sessionRegistry.listMetadata();
    });

    safeHandle("session:closeTabWindow", async (_e: IpcEvent, windowId: string) => {
        assertValidId(windowId, "windowId");
        const success = opts.sessionRegistry.close(windowId);
        return success;
    });

    safeHandle("session:renameTabWindow", async (_e: IpcEvent, windowId: string, newName: string) => {
        assertValidId(windowId, "windowId");
        assertValid(NameSchema, newName, "window name");
        const success = opts.sessionRegistry.rename(windowId, newName);
        return success;
    });

    safeHandle("session:updateWindowTitle", async (e: IpcEvent, layoutTypes: string[]) => {
        assertValid(z.array(z.string()), layoutTypes, "layout types");

        // Find the window from sender
        const entry = findWindowFromSender(e);
        if (!entry) {
            console.error("[session:updateWindowTitle] Could not find window from sender");
            return false;
        }

        // Resolve initial profile ID (fallback to active/loaded if missing)
        let profileId =
            entry.initialProfileId ??
            opts.sessionRegistry.getInitialProfileId(entry.id) ??
            entry.tabsManager.getActiveId?.() ??
            (typeof entry.tabsManager.getLoadedProfileIds === "function"
                ? entry.tabsManager.getLoadedProfileIds()[0]
                : undefined);
        if (!profileId) {
            console.error("[session:updateWindowTitle] No initial or active profile ID available for window");
            return false;
        }
        // Persist the discovered profile as initial for future updates
        ensureInitialProfile(entry.id, profileId);

        // Get profile name
        try {
            const profiles = await opts.profiles.list();
            const profile = profiles.find(p => p.id === profileId);
            const profileName = profile?.name || profileId;

            // Update window title
            return opts.sessionRegistry.updateWindowTitle(entry.id, profileName, layoutTypes);
        } catch (err) {
            console.error("[session:updateWindowTitle] Error:", err);
            return false;
        }
    });
}

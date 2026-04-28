/**
 * IPC handlers for tab layout operations.
 *
 * tabLayouts:apply opens a NEW session window per layout via the multi-window
 * registry — existing windows stay open. Per-layoutId dedupe prevents rapid
 * double-clicks from spawning duplicate windows.
 */
import type { BrowserWindow } from "electron";
import { BrowserWindow as BW } from "electron";
import { SafeHandle, IpcEvent, assertValidId, NotFoundError, assertValid } from "../common";
import { TabLayout, TabLayoutInput, TabLayoutInputSchema } from "../../../shared/schemas";
import type { SessionRegistry } from "../../windows/sessionRegistry";

export type TabLayoutsStore = {
    list: () => Promise<TabLayout[]>;
    get: (layoutId: string) => Promise<TabLayout | null>;
    save: (input: TabLayoutInput) => Promise<TabLayout[]>;
    delete: (layoutId: string) => Promise<TabLayout[]>;
};

export type SessionWindowController = {
    ensure: (params?: Record<string, string>) => Promise<BrowserWindow>;
    get: () => BrowserWindow | null;
    closeWithoutPrompt: () => void;
    isNew: () => boolean;
};

export type SessionTabsController = {
    hasLoadedProfile: (profileId: string) => boolean;
    getLoadedProfileIds: () => string[];
    reset: () => void;
};

export type LayoutHandlerOptions = {
    tabLayouts: TabLayoutsStore;
    sessionWindow: SessionWindowController;
    sessionTabs: SessionTabsController;
    sessionRegistry: SessionRegistry;
    createTabWindow: (opts?: { name?: string; params?: Record<string, string> }) => Promise<string>;
    /** Send toast to launcher window */
    showToast?: (message: string, tone?: "info" | "success" | "error") => void;
};

function broadcastLayoutsChanged(): void {
    for (const win of BW.getAllWindows()) {
        if (!win.isDestroyed()) {
            win.webContents.send("tabLayouts:changed");
        }
    }
}

export function registerLayoutHandlers(
    safeHandle: SafeHandle,
    opts: LayoutHandlerOptions,
    logErr: (msg: unknown) => void
): void {
    /**
     * Per-layoutId dedupe set. Prevents rapid double-clicks of "Play" on
     * the same layout from spawning multiple windows. Cleared once the
     * window is created (or on failure).
     */
    const inFlightLayoutIds = new Set<string>();

    /**
     * Pending layouts awaiting renderer pickup, keyed by webContents ID.
     * The renderer of a freshly opened session window calls
     * `tabLayouts:pending` during its watchdog cycle if the
     * `session:applyLayout` IPC event was missed (e.g. the listener wasn't
     * registered yet when we dispatched). Acts as a safety net.
     */
    const pendingByWebContentsId = new Map<number, TabLayout>();

    safeHandle("tabLayouts:list", async () => await opts.tabLayouts.list());

    safeHandle("tabLayouts:get", async (_e: IpcEvent, layoutId: string) => {
        assertValidId(layoutId, "layoutId");
        return await opts.tabLayouts.get(layoutId);
    });

    safeHandle("tabLayouts:save", async (_e, input: any) => {
        // Preserve existing name on updates; only default when creating new layouts
        let name = String(input?.name ?? "").trim();
        if (!name && input?.id) {
            const existing = await opts.tabLayouts.get(String(input.id));
            if (existing?.name) {
                name = existing.name;
            }
        }
        const normalized = {
            ...input,
            name: name || `Layout ${new Date().toISOString()}`,
        };

        assertValid(TabLayoutInputSchema, normalized, "tab layout input");
        const result = await opts.tabLayouts.save(normalized);
        broadcastLayoutsChanged();
        return result;
    });

    safeHandle("tabLayouts:delete", async (_e: IpcEvent, layoutId: string) => {
        assertValidId(layoutId, "layoutId");
        const result = await opts.tabLayouts.delete(layoutId);
        broadcastLayoutsChanged();
        return result;
    });

    // Watchdog endpoint: a freshly opened session window's renderer polls
    // this in case the `session:applyLayout` IPC was missed.
    safeHandle("tabLayouts:pending", async (e: IpcEvent): Promise<TabLayout | null> => {
        const wcId = e.sender.id;
        const layout = pendingByWebContentsId.get(wcId) ?? null;
        if (layout) {
            pendingByWebContentsId.delete(wcId);
        }
        return layout;
    });

    safeHandle("tabLayouts:apply", async (_e: IpcEvent, layoutId: string) => {
        assertValidId(layoutId, "layoutId");

        if (inFlightLayoutIds.has(layoutId)) {
            // Same layout already being opened — silently ignore the duplicate click.
            return false;
        }
        // Mark in-flight BEFORE any await so concurrent invocations dedupe.
        inFlightLayoutIds.add(layoutId);
        try {
            const layout = await opts.tabLayouts.get(layoutId);
            if (!layout) {
                throw new NotFoundError("layout not found");
            }

            // Profile conflicts (same profile already open in another window)
            // are NOT blocked here — the renderer detects them via
            // sessionTabsGetAllOpenProfiles() and renders a "jump to window"
            // overlay for those cells instead of opening a second BrowserView.

            // Always create a NEW window — never close existing ones.
            // Pass layoutId as URL param so the renderer's startInitialLoad
            // watchdog can pick up the layout if the IPC event is missed.
            const windowId = await opts.createTabWindow({
                name: layout.name,
                params: { layoutId: layout.id },
            });
            const entry = opts.sessionRegistry.get(windowId);
            if (!entry) {
                throw new Error(`failed to create session window (${windowId})`);
            }
            const win = entry.window;
            // Cache the webContents id BEFORE registering the closed listener.
            // Once the window is destroyed, `win.webContents` access throws.
            const wcId = win.webContents.id;

            // Stash the layout so the renderer's tabLayouts:pending poll resolves
            // it if the dispatched event missed the listener registration window.
            pendingByWebContentsId.set(wcId, layout);
            win.once("closed", () => {
                pendingByWebContentsId.delete(wcId);
            });

            // Track first profile of the layout for downstream title computation.
            const firstProfile = layout.activeId ?? layout.tabs[0];
            if (firstProfile) {
                opts.sessionRegistry.setInitialProfileId(windowId, firstProfile);
            }

            try {
                if (!win.isDestroyed()) {
                    win.show();
                    win.focus();
                    if (layout.name) {
                        win.setTitle(layout.name);
                    }
                }
            } catch (err) {
                logErr(err);
            }

            // Dispatch as a fast path. If the renderer has already consumed
            // pending (via tabLayouts:pending), skip — applyLayout would
            // otherwise run twice and cause a visible re-load.
            const dispatchIfStillPending = () => {
                try {
                    if (win.isDestroyed()) return;
                    if (!pendingByWebContentsId.has(wcId)) return;
                    pendingByWebContentsId.delete(wcId);
                    win.webContents.send("session:applyLayout", layout);
                } catch (err) {
                    logErr(err);
                }
            };

            // Fire-and-forget bonus path; the URL-param + tabLayouts:pending
            // poll in startInitialLoad is the primary mechanism.
            setTimeout(dispatchIfStillPending, 600);
            return true;
        } finally {
            inFlightLayoutIds.delete(layoutId);
        }
    });
}

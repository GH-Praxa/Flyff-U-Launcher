/**
 * IPC handlers for tab layout operations.
 */
import type { BrowserWindow } from "electron";
import { SafeHandle, IpcEvent, assertValidId, NotFoundError, assertValid } from "../common";
import { TabLayout, TabLayoutInput, TabLayoutInputSchema } from "../../../shared/schemas";

export type TabLayoutsStore = {
    list: () => Promise<TabLayout[]>;
    get: (layoutId: string) => Promise<TabLayout | null>;
    save: (input: TabLayoutInput) => Promise<TabLayout[]>;
    delete: (layoutId: string) => Promise<TabLayout[]>;
};

export type SessionWindowController = {
    ensure: (params?: Record<string, string>) => Promise<BrowserWindow>;
    isNew: () => boolean;
};

export type LayoutHandlerOptions = {
    tabLayouts: TabLayoutsStore;
    sessionWindow: SessionWindowController;
};

export function registerLayoutHandlers(
    safeHandle: SafeHandle,
    opts: LayoutHandlerOptions,
    logErr: (msg: unknown) => void
): void {
    // Track pending layouts with timestamps to handle race conditions
    let pendingLayout: TabLayout | null = null;
    let pendingLayoutTimestamp = 0;
    let applyInProgress = false;

    safeHandle("tabLayouts:list", async () => await opts.tabLayouts.list());

    safeHandle("tabLayouts:get", async (_e: IpcEvent, layoutId: string) => {
        assertValidId(layoutId, "layoutId");
        return await opts.tabLayouts.get(layoutId);
    });

    safeHandle("tabLayouts:save", async (_e, input: any) => {
        // Preserve existing name on updates; only default when creating new layouts
        let name = String(input?.name ?? "").trim();
        if (!name && input?.id) {
            // Try to load current layout to reuse its name
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
        return await opts.tabLayouts.save(normalized);
    });



    safeHandle("tabLayouts:delete", async (_e: IpcEvent, layoutId: string) => {
        assertValidId(layoutId, "layoutId");
        return await opts.tabLayouts.delete(layoutId);
    });

    // Allows renderer to pull any pending layout if the apply event was missed (e.g. during startup races)
    safeHandle("tabLayouts:pending", async () => {
        const result = pendingLayout;
        pendingLayout = null;
        pendingLayoutTimestamp = 0;
        return result;
    });

    safeHandle("tabLayouts:apply", async (_e: IpcEvent, layoutId: string) => {
        assertValidId(layoutId, "layoutId");

        // Prevent concurrent applies - wait for previous to complete
        if (applyInProgress) {
            throw new Error("Layout apply already in progress");
        }

        applyInProgress = true;
        const applyTimestamp = Date.now();

        try {
            const layout = await opts.tabLayouts.get(layoutId);
            if (!layout) {
                throw new NotFoundError("layout not found");
            }

            // Only update pending if this is the most recent request
            if (applyTimestamp >= pendingLayoutTimestamp) {
                pendingLayout = layout;
                pendingLayoutTimestamp = applyTimestamp;
            }

            // Ensure window exists (passing layoutId for query params) and focus it
            const win = await opts.sessionWindow.ensure({ layoutId });
            const windowIsNew = opts.sessionWindow.isNew();
            win.show();
            win.focus();

            // Dispatch layout to renderer once it's ready (also for newly created windows)
            const dispatch = () => {
                try {
                    // Only send if window is still valid
                    if (!win.isDestroyed()) {
                        win.webContents.send("session:applyLayout", layout);
                    }
                }
                catch (err) {
                    logErr(err);
                }
            };

            const wc = win.webContents;
            if (wc.isLoading()) {
                await new Promise<void>((resolve) => {
                    const loadHandler = () => {
                        setTimeout(() => {
                            dispatch();
                            resolve();
                        }, windowIsNew ? 420 : 260);
                    };

                    // Handle case where window is closed during load
                    const closeHandler = () => {
                        wc.off("did-finish-load", loadHandler);
                        resolve();
                    };

                    wc.once("did-finish-load", loadHandler);
                    win.once("closed", closeHandler);
                });
            }
            else {
                await new Promise<void>((resolve) => {
                    setTimeout(() => {
                        dispatch();
                        resolve();
                    }, 120);
                });
            }
            return true;
        } finally {
            applyInProgress = false;
        }
    });
}

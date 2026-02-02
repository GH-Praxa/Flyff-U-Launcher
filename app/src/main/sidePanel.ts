import type { BrowserWindow } from "electron";
import { createSidePanelWindow } from "./windows/sidePanelWindow";
import { logErr } from "../shared/logger";
import type { Locale } from "../shared/schemas";

type TabsLike = { isActive(id: string): boolean; getBounds(id: string): { x: number; y: number; width: number; height: number } };

export interface SidePanelDeps {
    getSessionWindow: () => BrowserWindow | null;
    getSessionTabs: () => TabsLike;
    getRegistryEntries: () => Array<{ window: BrowserWindow; tabsManager: TabsLike }>;
    getOverlayTargetId: () => Promise<string | null>;
    getSidePanelButton: () => {
        getActiveProfileId?: () => string | null;
        start: () => Promise<void>;
        stop: () => Promise<void>;
        isVisible?: () => boolean;
        show?: () => void;
        hide?: () => void;
    } | null;
    preloadPath: string;
    getLocale: () => Locale;
    getOverlaysHiddenByHotkey: () => boolean;
}

export interface SidePanelState {
    window: BrowserWindow | null;
    syncInterval: NodeJS.Timeout | null;
}

export function createSidePanelManager(deps: SidePanelDeps) {
    const state: SidePanelState = {
        window: null,
        syncInterval: null,
    };

    /** Resolve the parent window + tabs for a given profile ID. */
    const resolveHost = (profileId: string): { parent: BrowserWindow; tabs: TabsLike } | null => {
        const sessionWin = deps.getSessionWindow();
        const sessionTabs = deps.getSessionTabs();
        if (sessionWin && !sessionWin.isDestroyed() && sessionTabs.isActive(profileId)) {
            return { parent: sessionWin, tabs: sessionTabs };
        }
        for (const entry of deps.getRegistryEntries()) {
            if (entry.window.isDestroyed()) continue;
            if (entry.tabsManager.isActive(profileId)) {
                return { parent: entry.window, tabs: entry.tabsManager };
            }
        }
        return null;
    };

    const stopSync = () => {
        if (state.syncInterval) {
            clearInterval(state.syncInterval);
            state.syncInterval = null;
        }
    };

    const hideWindow = () => {
        stopSync();
        const button = deps.getSidePanelButton();
        if (state.window && !state.window.isDestroyed()) {
            if (state.window.isVisible()) {
                state.window.hide();
            } else {
                void button?.start();
            }
        } else {
            void button?.start();
        }
    };

    const syncBounds = async () => {
        if (!state.window || state.window.isDestroyed()) return;

        const button = deps.getSidePanelButton();
        const overlayTargetId = button?.getActiveProfileId?.()
            ?? (await deps.getOverlayTargetId());
        if (!overlayTargetId) { hideWindow(); return; }

        const host = resolveHost(overlayTargetId);
        if (!host) { hideWindow(); return; }

        if (!state.window.isVisible()) return;

        const content = host.parent.getContentBounds();
        const viewBounds = host.tabs.getBounds(overlayTargetId);

        const marginX = 12;
        const hostX = content.x + viewBounds.x;
        const hostY = content.y + viewBounds.y;
        const currentBounds = state.window.getBounds();

        const availableWidth = Math.max(120, viewBounds.width - marginX * 2);
        const minAllowedWidth = Math.min(260, availableWidth);
        const maxWidth = Math.min(420, availableWidth);
        const finalWidth = Math.min(Math.max(currentBounds.width, minAllowedWidth), maxWidth);
        const finalHeight = Math.max(180, viewBounds.height);
        const x = hostX + Math.max(0, viewBounds.width - finalWidth - marginX);
        const y = hostY;

        // Skip setBounds if nothing changed – calling setBounds unconditionally
        // can cause brief focus interruptions on Windows, blocking keyboard input.
        if (
            currentBounds.x === x &&
            currentBounds.y === y &&
            currentBounds.width === finalWidth &&
            currentBounds.height === finalHeight
        ) {
            return;
        }

        try {
            state.window.setBounds({ x, y, width: finalWidth, height: finalHeight });
        } catch (err) {
            logErr(err, "SidePanelBoundsSync");
        }
    };

    let currentPanelParent: BrowserWindow | null = null;
    let onPanelParentChange: (() => void) | null = null;

    const toggle = async (payload?: { focusTab?: string; profileId?: string }) => {
        if (deps.getOverlaysHiddenByHotkey() && (!state.window || state.window.isDestroyed() || !state.window.isVisible())) {
            return;
        }

        const button = deps.getSidePanelButton();
        const overlayTargetId = (typeof payload?.profileId === "string" && payload.profileId)
            ? payload.profileId
            : button?.getActiveProfileId?.()
                ?? (await deps.getOverlayTargetId());
        if (!overlayTargetId) { hideWindow(); return; }

        const host = resolveHost(overlayTargetId);
        if (!host) { hideWindow(); return; }
        const parent = host.parent;

        if (!state.window || state.window.isDestroyed()) {
            state.window = createSidePanelWindow(parent, { preloadPath: deps.preloadPath, locale: deps.getLocale() });
            state.window.on("show", () => { void button?.stop(); });
            state.window.on("hide", () => {
                void button?.start();
                stopSync();
            });
            state.window.on("closed", () => {
                state.window = null;
                void button?.start();
                stopSync();
                // Detach parent listeners
                if (currentPanelParent && !currentPanelParent.isDestroyed() && onPanelParentChange) {
                    currentPanelParent.off("move", onPanelParentChange);
                    currentPanelParent.off("resize", onPanelParentChange);
                }
                currentPanelParent = null;
                onPanelParentChange = null;
            });
        }

        // Re-attach parent listeners if parent changed
        if (currentPanelParent !== parent) {
            if (currentPanelParent && !currentPanelParent.isDestroyed() && onPanelParentChange) {
                currentPanelParent.off("move", onPanelParentChange);
                currentPanelParent.off("resize", onPanelParentChange);
            }
            onPanelParentChange = () => syncBounds();
            parent.on("move", onPanelParentChange);
            parent.on("resize", onPanelParentChange);
            currentPanelParent = parent;
            state.window.setParentWindow(parent);
        }

        const panel = state.window;
        if (!panel || panel.isDestroyed()) return;

        const content = parent.getContentBounds();
        const viewBounds = host.tabs.getBounds(overlayTargetId!);
        const marginX = 12;
        const hostX = content.x + viewBounds.x;
        const hostY = content.y + viewBounds.y;
        const availableWidth = Math.max(120, viewBounds.width - marginX * 2);
        const minAllowedWidth = Math.min(260, availableWidth);
        const width = Math.max(minAllowedWidth, Math.min(420, availableWidth));
        const finalWidth = Math.min(width, Math.max(80, viewBounds.width - marginX));
        const finalHeight = Math.max(180, viewBounds.height);
        const x = hostX + Math.max(0, viewBounds.width - finalWidth - marginX);
        const y = hostY;
        panel.setBounds({ x, y, width: finalWidth, height: finalHeight });
        if (payload?.focusTab) {
            panel.webContents.send("sidepanel:focusTab", { tab: payload.focusTab });
        }
        const willShow = !panel.isVisible();
        if (willShow) {
            await button?.stop();
            if (panel.isDestroyed()) return;
            panel.show();
            panel.focus();
            if (!state.syncInterval) {
                state.syncInterval = setInterval(() => syncBounds(), 500);
            }
        } else {
            hideWindow();
        }
    };

    return {
        get state() { return state; },
        stopSync,
        hideWindow,
        syncBounds,
        toggle,
    };
}

import { app, BrowserWindow } from "electron";
import { createOverlayWindow, type OverlayWindowHandle } from "./windows/overlayWindow";
import { logErr } from "../shared/logger";
import { debugLog } from "./debugConfig";
import type { Locale } from "../shared/schemas";

export type OverlayVisibilitySnapshot = {
    roiOverlay: boolean;
    roiSupportOverlay: boolean;
    sidePanelButton: boolean;
    sidePanel: boolean;
};

export function createOverlaySnapshot(): OverlayVisibilitySnapshot {
    return {
        roiOverlay: false,
        roiSupportOverlay: false,
        sidePanelButton: false,
        sidePanel: false,
    };
}

type SessionTabsLike = {
    isActive(id: string): boolean;
    getBounds(id: string): { x: number; y: number; width: number; height: number };
};

export interface OverlaysDeps {
    getSessionWindow: () => BrowserWindow | null;
    getSessionTabs: () => SessionTabsLike;
    getInstances: () => { get(id: string): BrowserWindow | null };
    /** Return all session-registry entries so we can search multi-window tabs. */
    getRegistryEntries: () => Array<{ window: BrowserWindow; tabsManager: SessionTabsLike }>;
    getOverlayTargetId: () => Promise<string | null>;
    getOverlaySupportTargetId: () => Promise<string | null>;
    getSidePanelButton: () => {
        isVisible?: () => boolean;
        show?: () => void;
        hide?: () => void;
    } | null;
    getSidePanelWindow: () => BrowserWindow | null;
    getSidePanelSyncInterval: () => NodeJS.Timeout | null;
    setSidePanelSyncInterval: (val: NodeJS.Timeout | null) => void;
    syncSidePanelBounds: () => void;
    preloadPath: string;
    getLocale: () => Locale;
    scheduleTimersForProfile: (profileId: string) => void;
}

export interface OverlaysState {
    roiOverlayWindow: OverlayWindowHandle | null;
    roiSupportOverlayWindow: OverlayWindowHandle | null;
    overlaysWereVisible: OverlayVisibilitySnapshot;
    overlayHotkeySnapshot: OverlayVisibilitySnapshot;
    overlaysHiddenByHotkey: boolean;
    dialogSnapshot: OverlayVisibilitySnapshot;
    overlaysHiddenByDialog: boolean;
    roiOverlaySyncInterval: NodeJS.Timeout | null;
    roiOverlayParent: BrowserWindow | null;
    roiSupportOverlaySyncInterval: NodeJS.Timeout | null;
    roiSupportOverlayParent: BrowserWindow | null;
}

const OVERLAY_SYNC_MS = 500;

export function createOverlaysManager(deps: OverlaysDeps) {
    const state: OverlaysState = {
        roiOverlayWindow: null,
        roiSupportOverlayWindow: null,
        overlaysWereVisible: createOverlaySnapshot(),
        overlayHotkeySnapshot: createOverlaySnapshot(),
        overlaysHiddenByHotkey: false,
        dialogSnapshot: createOverlaySnapshot(),
        overlaysHiddenByDialog: false,
        roiOverlaySyncInterval: null,
        roiOverlayParent: null,
        roiSupportOverlaySyncInterval: null,
        roiSupportOverlayParent: null,
    };

    // Bounds caches – setBounds is skipped when nothing changed to avoid
    // brief focus/GPU interruptions that can freeze the game (same pattern
    // as sidePanel.ts).
    let roiOverlayLastBounds: { x: number; y: number; width: number; height: number } | null = null;
    let roiSupportOverlayLastBounds: { x: number; y: number; width: number; height: number } | null = null;

    // Profile ID caches for scheduleTimersForProfile – only call when the
    // profile actually changes, not every 50 ms tick. Sending 40 Worker
    // postMessage()s per second with the same payload is wasteful.
    let lastScheduledProfileId: string | null = null;
    let lastScheduledSupportProfileId: string | null = null;

    const captureAndHide = (target: OverlayVisibilitySnapshot) => {
        target.roiOverlay = !!(state.roiOverlayWindow && !state.roiOverlayWindow.isDestroyed() && state.roiOverlayWindow.isVisible());
        if (target.roiOverlay) {
            state.roiOverlayWindow!.hide();
        }
        target.roiSupportOverlay = !!(state.roiSupportOverlayWindow && !state.roiSupportOverlayWindow.isDestroyed() && state.roiSupportOverlayWindow.isVisible());
        if (target.roiSupportOverlay) {
            state.roiSupportOverlayWindow!.hide();
        }
        const button = deps.getSidePanelButton();
        target.sidePanelButton = !!button?.isVisible?.();
        if (target.sidePanelButton) {
            button?.hide?.();
        }
        const sidePanelWindow = deps.getSidePanelWindow();
        target.sidePanel = !!(sidePanelWindow && !sidePanelWindow.isDestroyed() && sidePanelWindow.isVisible());
        if (target.sidePanel) {
            sidePanelWindow!.hide();
        }
    };

    const restoreFromSnapshot = (target: OverlayVisibilitySnapshot) => {
        if (target.roiOverlay && state.roiOverlayWindow && !state.roiOverlayWindow.isDestroyed()) {
            state.roiOverlayWindow.show();
        }
        if (target.roiSupportOverlay && state.roiSupportOverlayWindow && !state.roiSupportOverlayWindow.isDestroyed()) {
            state.roiSupportOverlayWindow.show();
        }
        const button = deps.getSidePanelButton();
        if (target.sidePanelButton && button) {
            button.show?.();
        }
        const sidePanelWindow = deps.getSidePanelWindow();
        if (target.sidePanel && sidePanelWindow && !sidePanelWindow.isDestroyed()) {
            sidePanelWindow.show();
            if (!deps.getSidePanelSyncInterval()) {
                deps.setSidePanelSyncInterval(setInterval(() => deps.syncSidePanelBounds(), OVERLAY_SYNC_MS) as unknown as NodeJS.Timeout);
            }
            deps.syncSidePanelBounds();
        }
    };

    const hideAll = () => {
        captureAndHide(state.overlaysWereVisible);
    };

    const showAll = () => {
        if (state.overlaysHiddenByHotkey || state.overlaysHiddenByDialog) return;
        restoreFromSnapshot(state.overlaysWereVisible);
        // Reset the snapshot after restoring so it doesn't keep re-showing
        // elements that the user has since manually closed (e.g. sidepanel
        // toggle while the snapshot still had sidePanel: true).
        state.overlaysWereVisible = createOverlaySnapshot();
    };

    const hideForDialog = () => {
        if (state.overlaysHiddenByDialog) return;
        state.overlaysHiddenByDialog = true;
        captureAndHide(state.dialogSnapshot);
    };

    const showAfterDialog = () => {
        if (!state.overlaysHiddenByDialog) return;
        state.overlaysHiddenByDialog = false;
        restoreFromSnapshot(state.dialogSnapshot);
    };

    const toggleVisibility = () => {
        if (state.overlaysHiddenByHotkey) {
            state.overlaysHiddenByHotkey = false;
            restoreFromSnapshot(state.overlayHotkeySnapshot);
            void syncRoiOverlay();
            void syncRoiSupportOverlay();
            deps.syncSidePanelBounds();
            return;
        }
        state.overlaysHiddenByHotkey = true;
        captureAndHide(state.overlayHotkeySnapshot);
    };

    const resolveOverlayHost = (profileId: string) => {
        // 1. Legacy singleton session window
        const sessionWin = deps.getSessionWindow();
        const tabs = deps.getSessionTabs();
        const isActive = tabs.isActive(profileId);
        debugLog("resolveOverlayHost", "[resolveOverlayHost] profileId:", profileId, "sessionWin:", !!sessionWin, "isActive:", isActive);

        if (sessionWin && !sessionWin.isDestroyed() && isActive) {
            const contentBounds = sessionWin.getContentBounds();
            const viewBounds = tabs.getBounds(profileId);
            debugLog("resolveOverlayHost", "[resolveOverlayHost] Using session tab - contentBounds:", contentBounds, "viewBounds:", viewBounds);
            return {
                parent: sessionWin,
                bounds: {
                    x: contentBounds.x + viewBounds.x,
                    y: contentBounds.y + viewBounds.y,
                    width: viewBounds.width,
                    height: viewBounds.height,
                },
            };
        }

        // 2. Multi-window session registry
        for (const entry of deps.getRegistryEntries()) {
            if (entry.window.isDestroyed()) continue;
            if (!entry.tabsManager.isActive(profileId)) continue;
            const contentBounds = entry.window.getContentBounds();
            const viewBounds = entry.tabsManager.getBounds(profileId);
            debugLog("resolveOverlayHost", "[resolveOverlayHost] Using registry window - contentBounds:", contentBounds, "viewBounds:", viewBounds);
            return {
                parent: entry.window,
                bounds: {
                    x: contentBounds.x + viewBounds.x,
                    y: contentBounds.y + viewBounds.y,
                    width: viewBounds.width,
                    height: viewBounds.height,
                },
            };
        }

        // 3. Standalone instance window
        const inst = deps.getInstances().get(profileId);
        debugLog("resolveOverlayHost", "[resolveOverlayHost] Instance window:", !!inst);
        if (inst && !inst.isDestroyed()) {
            const bounds = inst.getContentBounds();
            debugLog("resolveOverlayHost", "[resolveOverlayHost] Using instance window - bounds:", bounds);
            return { parent: inst, bounds };
        }

        debugLog("resolveOverlayHost", "[resolveOverlayHost] No valid host found");
        return null;
    };

    const syncRoiOverlay = async () => {
        try {
            const profileId = await deps.getOverlayTargetId();
            debugLog("roiOverlaySync", "[ROI Overlay Sync] profileId:", profileId);
            if (state.overlaysHiddenByHotkey || state.overlaysHiddenByDialog) {
                if (state.roiOverlayWindow && !state.roiOverlayWindow.isDestroyed() && state.roiOverlayWindow.isVisible()) {
                    state.roiOverlayWindow.hide();
                }
                return;
            }
            if (!profileId) {
                debugLog("roiOverlaySync", "[ROI Overlay Sync] No overlay target set - hiding overlay");
                if (state.roiOverlayWindow && !state.roiOverlayWindow.isDestroyed() && state.roiOverlayWindow.isVisible()) {
                    state.roiOverlayWindow.hide();
                }
                return;
            }

            const host = resolveOverlayHost(profileId);
            debugLog("roiOverlaySync", "[ROI Overlay Sync] host:", host ? { parentId: host.parent.id, bounds: host.bounds } : null);
            if (!host || host.bounds.width <= 0 || host.bounds.height <= 0) {
                debugLog("roiOverlaySync", "[ROI Overlay Sync] No valid host - hiding overlay");
                if (state.roiOverlayWindow && !state.roiOverlayWindow.isDestroyed() && state.roiOverlayWindow.isVisible()) {
                    state.roiOverlayWindow.hide();
                }
                return;
            }

            if (!state.roiOverlayWindow || state.roiOverlayWindow.isDestroyed()) {
                roiOverlayLastBounds = null;
                state.roiOverlayWindow = createOverlayWindow(host.parent, { preloadPath: deps.preloadPath, locale: deps.getLocale() });
                state.roiOverlayWindow.on("closed", () => {
                    state.roiOverlayWindow = null;
                    state.roiOverlayParent = null;
                });
            } else if (!state.roiOverlayParent || state.roiOverlayParent.id !== host.parent.id) {
                roiOverlayLastBounds = null;
                state.roiOverlayWindow.updateParent(host.parent);
            }

            state.roiOverlayParent = host.parent;
            if (profileId !== lastScheduledProfileId) {
                lastScheduledProfileId = profileId;
                deps.scheduleTimersForProfile(profileId);
            }
            // Skip setBounds if nothing changed – calling it unconditionally
            // can cause brief focus interruptions that freeze the game.
            const nb = host.bounds;
            const lb = roiOverlayLastBounds;
            if (!lb || lb.x !== nb.x || lb.y !== nb.y || lb.width !== nb.width || lb.height !== nb.height) {
                roiOverlayLastBounds = { ...nb };
                state.roiOverlayWindow.setBounds(nb);
            }

            const focusedWindow = BrowserWindow.getFocusedWindow();
            const sidePanelWindow = deps.getSidePanelWindow();
            const hostFocused = focusedWindow && (
                focusedWindow.id === host.parent.id
                || focusedWindow === sidePanelWindow
                || focusedWindow.getParentWindow()?.id === host.parent.id
            );
            if (hostFocused) {
                if (!state.roiOverlayWindow.isVisible()) state.roiOverlayWindow.show();
            } else {
                if (state.roiOverlayWindow.isVisible()) state.roiOverlayWindow.hide();
            }
        } catch (err) {
            logErr(err, "ROI Overlay Sync");
        }
    };

    const ensureRoiOverlay = () => {
        if (state.roiOverlaySyncInterval) return state.roiOverlayWindow;
        state.roiOverlaySyncInterval = setInterval(() => void syncRoiOverlay(), OVERLAY_SYNC_MS);
        void syncRoiOverlay();
        return state.roiOverlayWindow;
    };

    const syncRoiSupportOverlay = async () => {
        try {
            const profileId = await deps.getOverlaySupportTargetId();
            debugLog("roiOverlaySync", "[ROI Support Overlay Sync] profileId:", profileId);
            if (state.overlaysHiddenByHotkey || state.overlaysHiddenByDialog) {
                if (state.roiSupportOverlayWindow && !state.roiSupportOverlayWindow.isDestroyed() && state.roiSupportOverlayWindow.isVisible()) {
                    state.roiSupportOverlayWindow.hide();
                }
                return;
            }
            if (!profileId) {
                if (state.roiSupportOverlayWindow && !state.roiSupportOverlayWindow.isDestroyed() && state.roiSupportOverlayWindow.isVisible()) {
                    state.roiSupportOverlayWindow.hide();
                }
                return;
            }

            const host = resolveOverlayHost(profileId);
            debugLog("roiOverlaySync", "[ROI Support Overlay Sync] host:", host ? { parentId: host.parent.id, bounds: host.bounds } : null);
            if (!host || host.bounds.width <= 0 || host.bounds.height <= 0) {
                if (state.roiSupportOverlayWindow && !state.roiSupportOverlayWindow.isDestroyed() && state.roiSupportOverlayWindow.isVisible()) {
                    state.roiSupportOverlayWindow.hide();
                }
                return;
            }

            if (!state.roiSupportOverlayWindow || state.roiSupportOverlayWindow.isDestroyed()) {
                roiSupportOverlayLastBounds = null;
                state.roiSupportOverlayWindow = createOverlayWindow(host.parent, { preloadPath: deps.preloadPath, role: "support", locale: deps.getLocale() });
                state.roiSupportOverlayWindow.on("closed", () => {
                    state.roiSupportOverlayWindow = null;
                    state.roiSupportOverlayParent = null;
                });
            } else if (!state.roiSupportOverlayParent || state.roiSupportOverlayParent.id !== host.parent.id) {
                roiSupportOverlayLastBounds = null;
                state.roiSupportOverlayWindow.updateParent(host.parent);
            }

            state.roiSupportOverlayParent = host.parent;
            if (profileId !== lastScheduledSupportProfileId) {
                lastScheduledSupportProfileId = profileId;
                deps.scheduleTimersForProfile(profileId);
            }
            const nb = host.bounds;
            const lb = roiSupportOverlayLastBounds;
            if (!lb || lb.x !== nb.x || lb.y !== nb.y || lb.width !== nb.width || lb.height !== nb.height) {
                roiSupportOverlayLastBounds = { ...nb };
                state.roiSupportOverlayWindow.setBounds(nb);
            }

            const focusedWindow = BrowserWindow.getFocusedWindow();
            const sidePanelWindow = deps.getSidePanelWindow();
            const hostFocused = focusedWindow && (
                focusedWindow.id === host.parent.id
                || focusedWindow === sidePanelWindow
                || focusedWindow.getParentWindow()?.id === host.parent.id
            );
            if (hostFocused) {
                if (!state.roiSupportOverlayWindow.isVisible()) state.roiSupportOverlayWindow.show();
            } else {
                if (state.roiSupportOverlayWindow.isVisible()) state.roiSupportOverlayWindow.hide();
            }
        } catch (err) {
            logErr(err, "ROI Support Overlay Sync");
        }
    };

    const ensureRoiSupportOverlay = () => {
        if (state.roiSupportOverlaySyncInterval) return state.roiSupportOverlayWindow;
        state.roiSupportOverlaySyncInterval = setInterval(() => void syncRoiSupportOverlay(), OVERLAY_SYNC_MS);
        void syncRoiSupportOverlay();
        return state.roiSupportOverlayWindow;
    };

    app.on("browser-window-blur", () => {
        setTimeout(() => {
            const focusedWin = BrowserWindow.getFocusedWindow();
            if (!focusedWin) {
                hideAll();
            }
        }, 100);
    });

    app.on("browser-window-focus", () => {
        showAll();
    });

    return {
        get state() { return state; },
        captureAndHide,
        restoreFromSnapshot,
        hideAll,
        showAll,
        hideForDialog,
        showAfterDialog,
        toggleVisibility,
        syncRoiOverlay,
        ensureRoiOverlay,
        syncRoiSupportOverlay,
        ensureRoiSupportOverlay,
    };
}

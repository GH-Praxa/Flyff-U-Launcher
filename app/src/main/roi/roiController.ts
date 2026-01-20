/**
 * ROI (Region of Interest) Controller
 * Handles opening the ROI calibrator window for a profile.
 */
import type { BrowserWindow } from "electron";
import { openRoiCalibratorWindow } from "../windows/roiCalibratorWindow";
import type { RoiStore, HudRois } from "./roiStore";
import { TIMINGS } from "../../shared/constants";
import { debugLog } from "../debugConfig";

/** Map of profile IDs to instance windows */
export type InstanceRegistry = {
    get(profileId: string): BrowserWindow | null;
    list(profileId: string): BrowserWindow[];
};

/** Session window controller interface */
export type SessionWindowController = {
    ensure(): Promise<BrowserWindow>;
    get(): BrowserWindow | null;
};

/** Session tabs manager interface */
export type SessionTabsManager = {
    getViewByProfile(profileId: string): { webContents: Electron.WebContents } | null;
    open(profileId: string): Promise<boolean>;
    switchTo(profileId: string): void;
    getBounds(profileId: string): { x: number; y: number; width: number; height: number };
};

/** Overlay target controller interface */
export type OverlayTargetController = {
    refreshFromStore(): Promise<void>;
};

/** Options for creating the ROI controller */
export interface RoiControllerOptions {
    instances: InstanceRegistry;
    sessionWindowController: SessionWindowController;
    sessionTabs: SessionTabsManager;
    roiStore: RoiStore;
    overlayTarget: OverlayTargetController | null;
    preloadPath: string;
    followIntervalMs?: number;
}

/**
 * Creates a ROI controller for opening calibration windows.
 */
export function createRoiController(options: RoiControllerOptions) {
    const {
        instances,
        sessionWindowController,
        sessionTabs,
        roiStore,
        overlayTarget,
        preloadPath,
        followIntervalMs = TIMINGS.OVERLAY_FOLLOW_MS,
    } = options;

    // When calibrating only a subset (currently rmExp for supporter),
    // merge the new ROI into the existing set so other ROIs are not dropped.
    const persistRois = async (
        profileId: string,
        rois: HudRois,
        roiKey?: "lvl" | "charname" | "exp" | "lauftext" | "rmExp" | "enemyName" | "enemyHp"
    ) => {
        if (roiKey === "rmExp") {
            const existing = await roiStore.get(profileId);
            const merged: HudRois = { ...(existing ?? {}) };
            if (rois.rmExp) {
                merged.rmExp = rois.rmExp;
            } else {
                delete merged.rmExp;
            }
            await roiStore.set(profileId, merged);
            return;
        }
        await roiStore.set(profileId, rois);
    };

    /**
     * Opens the ROI calibrator for a profile.
     * Tries instance window first, falls back to session tab.
     */
    async function open(profileId: string, roiKey?: "lvl" | "charname" | "exp" | "lauftext" | "rmExp" | "enemyName" | "enemyHp"): Promise<boolean> {
        const inst = instances.get(profileId);
        if (inst && !inst.isDestroyed()) {
            return openFromInstance(profileId, inst, roiKey);
        }
        return openFromSessionTab(profileId, roiKey);
    }

    async function openFromInstance(profileId: string, inst: BrowserWindow, roiKey?: "lvl" | "charname" | "exp" | "lauftext" | "rmExp" | "enemyName" | "enemyHp"): Promise<boolean> {
        inst.show();
        inst.focus();
        const [cw, ch] = inst.getContentSize();
        const contentBounds = inst.getContentBounds();
        const screenshot = await inst.webContents.capturePage({ x: 0, y: 0, width: cw, height: ch });
        const existing = await roiStore.get(profileId);

        const getFollowBounds = () => {
            if (!inst || inst.isDestroyed()) return null;
            const b = inst.getContentBounds();
            return { x: b.x, y: b.y, width: b.width, height: b.height };
        };

        // For rmExp (supporter), only show rmExp in the calibrator
        const filteredExisting = roiKey === "rmExp" ? { rmExp: existing?.rmExp } : existing;
        const allowedKeys = roiKey === "rmExp" ? ["rmExp"] as const : undefined;
        debugLog("ocr", "[ROI CONTROLLER] openFromInstance roiKey:", roiKey, "allowedKeys:", allowedKeys, "filteredExisting:", JSON.stringify(filteredExisting));

        await openRoiCalibratorWindow({
            profileId,
            parent: inst,
            bounds: { x: contentBounds.x, y: contentBounds.y, width: contentBounds.width, height: contentBounds.height },
            screenshotPng: screenshot.toPNG(),
            existing: filteredExisting,
            preloadPath,
            activeKey: roiKey,
            allowedKeys,
            onSave: async (rois: HudRois) => {
                debugLog("ocr", "[ROI CALIB MAIN] onSave instance profileId:", profileId, "rois:", JSON.stringify(rois));
                await persistRois(profileId, rois, roiKey);
                debugLog("ocr", "[ROI CALIB MAIN] roiStore.set completed");
                await overlayTarget?.refreshFromStore();
                debugLog("ocr", "[ROI CALIB MAIN] refreshFromStore completed");
            },
            follow: { getBounds: getFollowBounds, intervalMs: followIntervalMs },
        });

        return true;
    }

    async function openFromSessionTab(profileId: string, roiKey?: "lvl" | "charname" | "exp" | "lauftext" | "rmExp" | "enemyName" | "enemyHp"): Promise<boolean> {
        const win = await sessionWindowController.ensure();
        win.show();
        win.focus();

        const view = sessionTabs.getViewByProfile(profileId);
        if (!view) {
            await sessionTabs.open(profileId);
        } else {
            sessionTabs.switchTo(profileId);
        }

        await new Promise((r) => setTimeout(r, 200));

        const v2 = sessionTabs.getViewByProfile(profileId);
        if (!v2) return false;

        const viewBounds = sessionTabs.getBounds(profileId);
        const contentBounds = win.getContentBounds();

        debugLog("ocr", "[ROI CONTROLLER] openFromSessionTab viewBounds:", JSON.stringify(viewBounds));
        debugLog("ocr", "[ROI CONTROLLER] openFromSessionTab contentBounds:", JSON.stringify(contentBounds));
        debugLog("ocr", "[ROI CONTROLLER] openFromSessionTab webContents URL:", v2.webContents.getURL());

        // Try capturing from the BrowserView first
        let screenshot = await v2.webContents.capturePage();

        debugLog("ocr", "[ROI CONTROLLER] openFromSessionTab BrowserView screenshot size:", screenshot.getSize());
        debugLog("ocr", "[ROI CONTROLLER] openFromSessionTab BrowserView screenshot isEmpty:", screenshot.isEmpty());

        // If BrowserView screenshot is empty, try capturing from the window instead
        // and crop to the view bounds
        if (screenshot.isEmpty()) {
            debugLog("ocr", "[ROI CONTROLLER] BrowserView screenshot empty, trying window capture");
            const winScreenshot = await win.webContents.capturePage();
            debugLog("ocr", "[ROI CONTROLLER] Window screenshot size:", winScreenshot.getSize());
            if (!winScreenshot.isEmpty()) {
                // Crop to view bounds
                screenshot = winScreenshot.crop({
                    x: viewBounds.x,
                    y: viewBounds.y,
                    width: viewBounds.width,
                    height: viewBounds.height,
                });
                debugLog("ocr", "[ROI CONTROLLER] Cropped screenshot size:", screenshot.getSize());
            }
        }

        const existing = await roiStore.get(profileId);

        const getFollowBounds = () => {
            const w = sessionWindowController.get();
            if (!w || w.isDestroyed()) return null;
            const vb = sessionTabs.getBounds(profileId);
            const cb = w.getContentBounds();
            return {
                x: cb.x + vb.x,
                y: cb.y + vb.y,
                width: vb.width,
                height: vb.height,
            };
        };

        // For rmExp (supporter), only show rmExp in the calibrator
        const filteredExisting = roiKey === "rmExp" ? { rmExp: existing?.rmExp } : existing;
        const allowedKeys = roiKey === "rmExp" ? ["rmExp"] as const : undefined;
        debugLog("ocr", "[ROI CONTROLLER] openFromSessionTab roiKey:", roiKey, "allowedKeys:", allowedKeys, "filteredExisting:", JSON.stringify(filteredExisting));

        // Don't use parent: win here! BrowserViews are always drawn on top of
        // child windows in Electron, so we create the ROI calibrator as a
        // top-level window to avoid z-order issues.
        await openRoiCalibratorWindow({
            profileId,
            parent: win,
            skipParent: true, // Create as top-level window to avoid BrowserView z-order issue
            bounds: {
                x: contentBounds.x + viewBounds.x,
                y: contentBounds.y + viewBounds.y,
                width: viewBounds.width,
                height: viewBounds.height,
            },
            screenshotPng: screenshot.toPNG(),
            existing: filteredExisting,
            preloadPath,
            activeKey: roiKey,
            allowedKeys,
            onSave: async (rois: HudRois) => {
                debugLog("ocr", "[ROI CALIB MAIN] onSave tab profileId:", profileId, "rois:", JSON.stringify(rois));
                await persistRois(profileId, rois, roiKey);
                debugLog("ocr", "[ROI CALIB MAIN] roiStore.set completed (tab)");
                await overlayTarget?.refreshFromStore();
                debugLog("ocr", "[ROI CALIB MAIN] refreshFromStore completed (tab)");
            },
            follow: { getBounds: getFollowBounds, intervalMs: followIntervalMs },
        });

        return true;
    }

    return { open };
}

export type RoiController = ReturnType<typeof createRoiController>;

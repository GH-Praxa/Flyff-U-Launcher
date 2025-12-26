import { app, BrowserWindow } from "electron";
import path from "path";
import squirrelStartup from "electron-squirrel-startup";
import { createViewLoader } from "./main/viewLoader";
import { createProfilesStore } from "./main/profiles/store";
import { createLauncherWindow } from "./main/windows/launcherWindow";
import { createSessionWindowController } from "./main/windows/sessionWindow";
import { createInstanceWindow } from "./main/windows/instanceWindow";
import { createSessionTabsManager } from "./main/sessionTabs/manager";
import { createTabLayoutsStore } from "./main/sessionTabs/layoutStore";
import { registerMainIpc } from "./main/ipc/registerMainIpc";
import { createInstanceRegistry } from "./main/windows/instanceRegistry";
import { createOverlayTargetController } from "./main/expOverlay/overlayTargetController";
import { createRoiStore, type HudRois } from "./main/roi/roiStore";
import { openRoiCalibratorWindow } from "./main/windows/roiCalibratorWindow";
import { createSidePanelController } from "./main/expOverlay/sidePanelController";
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
const FLYFF_URL = "https://universe.flyff.com/play";
if (squirrelStartup) {
    app.quit();
}
app.setAppUserModelId("Flyff-U-Launcher");
let _launcherWindow: BrowserWindow | null = null;
let overlayTarget: ReturnType<typeof createOverlayTargetController> | null = null;
let sidePanel: ReturnType<typeof createSidePanelController> | null = null;
app.whenReady().then(async () => {
    const preloadPath = path.join(__dirname, "preload.js");
    console.log("userData:", app.getPath("userData"));
    const loadView = createViewLoader({
        devServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL,
        rendererName: MAIN_WINDOW_VITE_NAME,
        baseDir: __dirname,
    });
    const profiles = createProfilesStore();
    const tabLayouts = createTabLayoutsStore();
    const sessionWindow = createSessionWindowController({
        preloadPath,
        loadView,
    });
    const sessionTabs = createSessionTabsManager({
        sessionWindow,
        flyffUrl: FLYFF_URL,
    });
    sessionWindow.onClosed(() => sessionTabs.reset());
    const instances = createInstanceRegistry();
    const roiStore = createRoiStore();
    overlayTarget = createOverlayTargetController({
        profiles,
        roiStore,
        sessionWindow,
        sessionTabs,
        instances,
        pythonExe: process.env.FLYFF_OCR_PYTHON ?? "python",
        intervalMs: 800,
        debugEveryN: 5,
    });
    sidePanel = createSidePanelController({
        profiles,
        sessionWindow,
        sessionTabs,
        instances,
        preloadPath,
        panelWidth: 420,
        followIntervalMs: 80,
    });
    await overlayTarget.refreshFromStore();
    await sidePanel.refreshFromStore();
    async function roiOpen(profileId: string): Promise<boolean> {
        const inst = instances.get(profileId);
        if (inst && !inst.isDestroyed()) {
            inst.show();
            inst.focus();
            const [cw, ch] = inst.getContentSize();
            const contentBounds = inst.getContentBounds();
            const screenshot = await inst.webContents.capturePage({ x: 0, y: 0, width: cw, height: ch });
            const existing = await roiStore.get(profileId);
            const getFollowBounds = () => {
                if (!inst || inst.isDestroyed())
                    return null;
                const b = inst.getContentBounds();
                return { x: b.x, y: b.y, width: b.width, height: b.height };
            };
            await openRoiCalibratorWindow({
                profileId,
                parent: inst,
                bounds: { x: contentBounds.x, y: contentBounds.y, width: contentBounds.width, height: contentBounds.height },
                screenshotPng: screenshot.toPNG(),
                existing,
                preloadPath,
                onSave: async (rois: HudRois) => {
                    await roiStore.set(profileId, rois);
                    await overlayTarget?.refreshFromStore();
                },
                follow: { getBounds: getFollowBounds, intervalMs: 80 },
            });
            return true;
        }
        const win = await sessionWindow.ensure();
        win.show();
        win.focus();
        const view = sessionTabs.getViewByProfile(profileId);
        if (!view) {
            await sessionTabs.open(profileId);
        }
        else {
            sessionTabs.switchTo(profileId);
        }
        await new Promise((r) => setTimeout(r, 200));
        const v2 = sessionTabs.getViewByProfile(profileId);
        if (!v2)
            return false;
        const viewBounds = sessionTabs.getBounds(profileId);
        const contentBounds = win.getContentBounds();
        const screenshot = await v2.webContents.capturePage();
        const existing = await roiStore.get(profileId);
        const getFollowBounds = () => {
            const w = sessionWindow.get();
            if (!w || w.isDestroyed())
                return null;
            const vb = sessionTabs.getBounds(profileId);
            const cb = w.getContentBounds();
            return {
                x: cb.x + vb.x,
                y: cb.y + vb.y,
                width: vb.width,
                height: vb.height,
            };
        };
        await openRoiCalibratorWindow({
            profileId,
            parent: win,
            bounds: {
                x: contentBounds.x + viewBounds.x,
                y: contentBounds.y + viewBounds.y,
                width: viewBounds.width,
                height: viewBounds.height,
            },
            screenshotPng: screenshot.toPNG(),
            existing,
            preloadPath,
            onSave: async (rois: HudRois) => {
                await roiStore.set(profileId, rois);
                await overlayTarget?.refreshFromStore();
            },
            follow: { getBounds: getFollowBounds, intervalMs: 80 },
        });
        return true;
    }
    registerMainIpc({
        profiles,
        sessionTabs,
        sessionWindow,
        tabLayouts,
        loadView,
        createInstanceWindow: (profileId) => {
            const win = createInstanceWindow(profileId, { flyffUrl: FLYFF_URL });
            instances.register(profileId, win);
            overlayTarget?.refreshFromStore().catch((err) => console.error("[overlayTarget] refresh failed", err));
            sidePanel?.refreshFromStore().catch((err) => console.error("[sidePanel] refresh failed", err));
        },
        overlayTargetRefresh: async () => {
            await overlayTarget?.refreshFromStore();
            await sidePanel?.refreshFromStore();
        },
        roiOpen,
        roiLoad: (profileId) => roiStore.get(profileId),
        roiSave: async (profileId, rois) => {
            await roiStore.set(profileId, rois);
            await overlayTarget?.refreshFromStore();
            return true;
        },
    });
    _launcherWindow = createLauncherWindow({
        preloadPath,
        loadView,
        onClosed: () => (_launcherWindow = null),
    });
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            _launcherWindow = createLauncherWindow({
                preloadPath,
                loadView,
                onClosed: () => (_launcherWindow = null),
            });
        }
    });
});
app.on("before-quit", () => {
    overlayTarget?.stop();
    overlayTarget = null;
    sidePanel?.stop();
    sidePanel = null;
});
app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        app.quit();
});

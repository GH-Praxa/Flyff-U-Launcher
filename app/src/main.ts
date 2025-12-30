import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import squirrelStartup from "electron-squirrel-startup";

// Fix Windows DWM flicker/ghost window issue
if (process.platform === "win32") {
    app.commandLine.appendSwitch("disable-direct-composition");
    app.commandLine.appendSwitch("disable-gpu-vsync");
    app.commandLine.appendSwitch("disable-frame-rate-limit");
}

import { createViewLoader } from "./main/viewLoader";
import { createProfilesStore } from "./main/profiles/store";
import { createLauncherWindow } from "./main/windows/launcherWindow";
import { createSessionWindowController } from "./main/windows/sessionWindow";
import { createInstanceWindow } from "./main/windows/instanceWindow";
import { createSessionTabsManager } from "./main/sessionTabs/manager";
import { createTabLayoutsStore } from "./main/sessionTabs/layoutStore";
import { createThemeStore } from "./main/themeStore";
import { registerMainIpc } from "./main/ipc/registerMainIpc";
import { createInstanceRegistry } from "./main/windows/instanceRegistry";
import { createOverlayTargetController } from "./main/expOverlay/overlayTargetController";
import { createRoiStore, type HudRois } from "./main/roi/roiStore";
import { openRoiCalibratorWindow } from "./main/windows/roiCalibratorWindow";
import { createSidePanelController } from "./main/expOverlay/sidePanelController";
import { createThemeStore } from "./main/themeStore";
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
const FLYFF_URL = "https://universe.flyff.com/play";
const BUFF_WECKER_ENABLED = process.env.BUFF_WECKER_ENABLED === "1";
if (squirrelStartup) {
    app.quit();
}
app.setAppUserModelId("Flyff-U-Launcher");
let _launcherWindow: BrowserWindow | null = null;
let overlayTarget: ReturnType<typeof createOverlayTargetController> | null = null;
let sidePanel: ReturnType<typeof createSidePanelController> | null = null;
let sessionWindow: ReturnType<typeof createSessionWindowController> | null = null;
let buffWecker: { stop?: () => void } | null = null;
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
    const themes = createThemeStore();
    sessionWindow = createSessionWindowController({
        preloadPath,
        loadView,
    });
    const sessionWindowController = sessionWindow;
    if (!sessionWindowController) {
        throw new Error("Failed to create session window controller");
    }
    const sessionTabs = createSessionTabsManager({
        sessionWindow: sessionWindowController,
        flyffUrl: FLYFF_URL,
    });
    sessionWindowController.onClosed(() => sessionTabs.reset());
    const instances = createInstanceRegistry();
    const roiStore = createRoiStore();
    overlayTarget = createOverlayTargetController({
        profiles,
        roiStore,
        sessionWindow: sessionWindowController,
        sessionTabs,
        instances,
        pythonExe: process.env.FLYFF_OCR_PYTHON ?? "python",
        intervalMs: 800,
        debugEveryN: 5,
    });
    sidePanel = createSidePanelController({
        profiles,
        sessionWindow: sessionWindowController,
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
        const win = await sessionWindowController.ensure();
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
            const w = sessionWindowController.get();
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
        sessionWindow: sessionWindowController,
        tabLayouts,
        themes,
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
    // Buff-Wecker (lokal, versucht immer zu laden, aber fehlende Dateien/Worker werden einfach geloggt)
    // Buff-Wecker: versuche mehrere Basispfade (Dev: .vite/dev, root/app; Prod: resources/app)
    if (BUFF_WECKER_ENABLED) {
        try {
            const baseCandidates = [
                path.join(process.cwd(), "app", "buff-wecker-local"),
                path.join(process.cwd(), "buff-wecker-local"),
                path.join(app.getAppPath(), "buff-wecker-local"),
                path.join(app.getAppPath(), "..", "buff-wecker-local"),
                path.join(app.getAppPath(), "buff-wecker"),
                app.getAppPath(),
                path.join(app.getAppPath(), ".."),
                path.join(process.cwd(), "app"),
                process.cwd(),
            ];
            let loaderPath: string | null = null;
            for (const base of baseCandidates) {
                const candBundled = path.join(path.resolve(base), "mainLoader.js");
                const candLocal = path.join(path.resolve(base), "mainLoader.js");
                if (fs.existsSync(candBundled)) {
                    loaderPath = candBundled;
                    break;
                }
                if (fs.existsSync(candLocal)) {
                    loaderPath = candLocal;
                    break;
                }
            }
            if (loaderPath) {
                const mod = await import(pathToFileURL(loaderPath).href);
                if (mod?.initBuffWecker) {
                    buffWecker = mod.initBuffWecker({
                        ipcMain,
                        pythonExe: process.env.FLYFF_OCR_PYTHON ?? "python",
                        sessionTabs,
                        sessionWindow: sessionWindowController,
                        profiles,
                    });
                    console.log("[buff-wecker] enabled via", loaderPath);
                }
            }
            else {
                console.warn("[buff-wecker] loader not found in candidates", baseCandidates);
            }
        }
        catch (err) {
            console.warn("[buff-wecker] failed to init", err);
        }
    }
    else {
        console.log("[buff-wecker] disabled via BUFF_WECKER_ENABLED flag");
    }
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
    sessionWindow?.allowCloseWithoutPrompt();
    overlayTarget?.stop();
    overlayTarget = null;
    sidePanel?.stop();
    sidePanel = null;
    buffWecker?.stop?.();
});
app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        app.quit();
});

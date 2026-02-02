import { BrowserWindow, globalShortcut } from "electron";
import path from "path";
import fsp from "fs/promises";
import { app } from "electron";
import { logWarn, logErr } from "../shared/logger";
import { chordToAccelerator, normalizeHotkeySettings } from "../shared/hotkeys";
import { translations, type TranslationKey } from "../i18n/translations";
import type { Locale } from "../shared/schemas";

export interface HotkeysDeps {
    getSessionWindow: () => BrowserWindow | null;
    getLauncherWindow: () => BrowserWindow | null;
    getInstances: () => { all(): Array<{ win: BrowserWindow }> };
    getRegistryWindows: () => BrowserWindow[];
    isFlyffWindowFocused: () => boolean;
    toggleAllOverlaysVisibility: () => void;
    toggleSidePanel: (payload?: { focusTab?: string; profileId?: string }) => void;
    getSidePanelActiveProfileId: () => string | undefined;
    getSidePanelWindow: () => BrowserWindow | null;
    getRoiOverlayWindow: () => BrowserWindow | null;
    getLocale: () => Locale;
    getToastDurationMs: () => number;
    getClientSettings: () => Promise<{ toastDurationSeconds?: number } | null>;
    hasPluginHandler: (channel: string) => boolean;
    invokePluginHandler: (channel: string, ...args: unknown[]) => Promise<unknown>;
}

export function createHotkeysManager(deps: HotkeysDeps) {
    const registeredHotkeys: string[] = [];

    const clearRegistered = () => {
        for (const acc of registeredHotkeys) {
            globalShortcut.unregister(acc);
        }
        registeredHotkeys.length = 0;
    };

    const isFlyffWindowFocused = (): boolean => {
        const focused = BrowserWindow.getFocusedWindow();
        if (!focused) return false;
        const sessionWin = deps.getSessionWindow();
        if (sessionWin && !sessionWin.isDestroyed() && focused.id === sessionWin.id) return true;
        const instanceIds = new Set(deps.getInstances().all().map((e) => e.win.id));
        return instanceIds.has(focused.id);
    };

    /** Returns the best window to receive a tool-popup IPC (session preferred, launcher as fallback). */
    const getToolTargetWindow = (): BrowserWindow | null => {
        const sessionWin = deps.getSessionWindow();
        if (sessionWin && !sessionWin.isDestroyed()) return sessionWin;
        const launcherWin = deps.getLauncherWindow();
        if (launcherWin && !launcherWin.isDestroyed()) return launcherWin;
        return null;
    };

    const sendTabNavigate = (dir: "prev" | "next") => {
        const sessionWin = deps.getSessionWindow();
        if (!sessionWin || sessionWin.isDestroyed()) return;
        if (!isFlyffWindowFocused()) return;
        sessionWin.webContents.send("clientHotkey:navigate", { dir });
    };

    const focusNextInstanceWindow = () => {
        if (!isFlyffWindowFocused()) return;
        const windows: Array<{ id: number; win: BrowserWindow }> = [];
        const sessionWin = deps.getSessionWindow();
        if (sessionWin && !sessionWin.isDestroyed()) {
            windows.push({ id: sessionWin.id, win: sessionWin });
        }
        for (const entry of deps.getInstances().all()) {
            if (entry.win && !entry.win.isDestroyed()) {
                windows.push({ id: entry.win.id, win: entry.win });
            }
        }
        const ordered = windows.sort((a, b) => a.id - b.id);
        if (ordered.length <= 1) return;
        const focusedId = BrowserWindow.getFocusedWindow()?.id ?? null;
        const currentIdx = focusedId ? ordered.findIndex((e) => e.id === focusedId) : -1;
        const next = ordered[(currentIdx + 1) % ordered.length];
        try {
            next.win.show();
            next.win.focus();
        } catch (err) {
            logErr(err, "Hotkey:nextInstance");
        }
    };

    const expireAllCdTimers = () => {
        if (!isFlyffWindowFocused()) return;
        const channel = "cd-timer:badge:expireall";
        if (!deps.hasPluginHandler(channel)) return;
        void deps.invokePluginHandler(channel).catch((err) => logErr(err, "Hotkey:cdTimerExpireAll"));
    };

    const captureFocusedWindowScreenshot = async () => {
        const target = BrowserWindow.getFocusedWindow();
        if (!target) return;
        try {
            const locale = deps.getLocale();
            const settingsSnap = await deps.getClientSettings().catch(() => null);
            const effectiveTtlMs = Math.min(60, Math.max(1, settingsSnap?.toastDurationSeconds ?? deps.getToastDurationMs() / 1000)) * 1000;
            const image = await target.webContents.capturePage();
            const buffer = image.toPNG();
            const picturesDir = path.join(app.getPath("pictures"), "Flyff-U-Launcher");
            await fsp.mkdir(picturesDir, { recursive: true });
            const file = path.join(picturesDir, `screenshot-${Date.now()}.png`);
            await fsp.writeFile(file, buffer);
            logWarn(`Screenshot saved: ${file}`, "Hotkey:screenshotWindow");
            const payload = {
                message: translations[locale]["toast.screenshot.saved"],
                tone: "success",
                ttlMs: effectiveTtlMs,
            } as const;
            try {
                target.webContents.send("toast:show", payload);
            } catch {
                /* ignore */
            }
            const sessionWin = deps.getSessionWindow();
            if (sessionWin && !sessionWin.isDestroyed() && sessionWin.webContents.id !== target.webContents.id) {
                sessionWin.webContents.send("toast:show", payload);
            }
        } catch (err) {
            logErr(err, "Hotkey:screenshotWindow");
        }
    };

    const register = (hotkeys: ReturnType<typeof normalizeHotkeySettings>) => {
        clearRegistered();
        const registerOne = (chord: ReturnType<typeof normalizeHotkeySettings>["toggleOverlays"], handler: () => void, label: string) => {
            const accel = chordToAccelerator(chord);
            if (!accel) return;
            const ok = globalShortcut.register(accel, handler);
            if (ok) {
                registeredHotkeys.push(accel);
                console.log(`[Hotkey] Registered ${label}: ${accel}`);
            } else {
                logWarn(`Global shortcut ${accel} could not be registered`, `Hotkey:${label}`);
            }
        };

        registerOne(hotkeys.toggleOverlays ?? null, () => {
            if (!isFlyffWindowFocused()) return;
            deps.toggleAllOverlaysVisibility();
        }, "toggleOverlays");

        registerOne(hotkeys.sidePanelToggle ?? null, () => {
            const focused = BrowserWindow.getFocusedWindow();
            if (!focused) return;

            // Check if focused window is a game-related window
            const sessionWin = deps.getSessionWindow();
            const sideWin = deps.getSidePanelWindow();
            const roiWin = deps.getRoiOverlayWindow();
            const registryWins = deps.getRegistryWindows();

            const isGameWindow =
                (sessionWin && !sessionWin.isDestroyed() && focused.id === sessionWin.id) ||
                (sideWin && !sideWin.isDestroyed() && focused.id === sideWin.id) ||
                (roiWin && !roiWin.isDestroyed() && focused.id === roiWin.id) ||
                registryWins.some((w) => !w.isDestroyed() && focused.id === w.id);

            if (!isGameWindow) return;
            deps.toggleSidePanel({ profileId: deps.getSidePanelActiveProfileId(), focusTab: "roi" });
        }, "sidePanelToggle");

        registerOne(hotkeys.tabBarToggle ?? null, () => {
            const sessionWin = deps.getSessionWindow();
            if (!sessionWin || sessionWin.isDestroyed()) return;
            if (!isFlyffWindowFocused()) return;
            sessionWin.webContents.send("clientHotkey:toggleTabBar");
        }, "tabBarToggle");

        registerOne(hotkeys.tabPrev ?? null, () => sendTabNavigate("prev"), "tabPrev");
        registerOne(hotkeys.tabNext ?? null, () => sendTabNavigate("next"), "tabNext");
        registerOne(hotkeys.nextInstance ?? null, () => focusNextInstanceWindow(), "nextInstance");
        registerOne(hotkeys.cdTimerExpireAll ?? null, () => expireAllCdTimers(), "cdTimerExpireAll");
        registerOne(hotkeys.screenshotWindow ?? null, () => void captureFocusedWindowScreenshot(), "screenshotWindow");
        registerOne(hotkeys.showFcoinConverter ?? null, () => {
            const target = getToolTargetWindow();
            if (!target) {
                logWarn("showFcoinConverter: no target window", "Hotkey");
                return;
            }
            // Use executeJavaScript with userGesture=true so window.open() is not blocked
            // by Chromium's popup blocker (webContents.send has no user activation).
            target.webContents.executeJavaScript(
                `document.dispatchEvent(new CustomEvent("clientHotkey:showFcoinConverter"))`,
                true,
            ).catch((err) => logWarn(`showFcoinConverter executeJS failed: ${err}`, "Hotkey"));
        }, "showFcoinConverter");
        registerOne(hotkeys.showShoppingList ?? null, () => {
            const target = getToolTargetWindow();
            if (!target) {
                logWarn("showShoppingList: no target window", "Hotkey");
                return;
            }
            target.webContents.executeJavaScript(
                `document.dispatchEvent(new CustomEvent("clientHotkey:showShoppingList"))`,
                true,
            ).catch((err) => logWarn(`showShoppingList executeJS failed: ${err}`, "Hotkey"));
        }, "showShoppingList");
    };

    return {
        clearRegistered,
        isFlyffWindowFocused,
        register,
    };
}

import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import type { ProfilePatch, TabLayoutInput, TabLayout, RoiData, ThemeInput, ClientSettings, ClientSettingsPatch } from "./shared/schemas";
import type { FeatureFlags } from "./shared/featureFlags";
import type { PluginStateInfo, PluginManifest } from "./shared/pluginApi";

// Retrieve the CSP nonce synchronously so the renderer can attach it to
// any <style> elements it creates before the CSP header would block them.
const _cspNonce: string = ipcRenderer.sendSync("csp:nonce");
contextBridge.exposeInMainWorld("__cspNonce", _cspNonce);

/**
 * Unwraps an IpcResult response.
 * If ok is true, returns the data; otherwise throws an error.
 */
type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

async function unwrapIpc<T>(promise: Promise<IpcResult<T>>): Promise<T> {
    const result = await promise;
    if (result && typeof result === "object" && "ok" in result) {
        if (result.ok) {
            return result.data;
        }
        throw new Error((result as { ok: false; error: string }).error || "IPC call failed");
    }
    // Fallback for non-wrapped responses (legacy handlers)
    return result as T;
}

type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

// Theme push payload type
type ThemePushPayload = {
    colors?: Partial<Record<string, string>>;
    builtin?: { tabActive?: string };
};
contextBridge.exposeInMainWorld("api", {
    profilesList: () => unwrapIpc(ipcRenderer.invoke("profiles:list")),
    profilesCreate: (name: string) => unwrapIpc(ipcRenderer.invoke("profiles:create", name)),
    profilesUpdate: (patch: ProfilePatch) => unwrapIpc(ipcRenderer.invoke("profiles:update", patch)),
    profilesDelete: (profileId: string) => unwrapIpc(ipcRenderer.invoke("profiles:delete", profileId)),
    profilesClone: (profileId: string, newName: string) => unwrapIpc(ipcRenderer.invoke("profiles:clone", profileId, newName)),
    profilesReorder: (orderedIds: string[]) => unwrapIpc(ipcRenderer.invoke("profiles:reorder", orderedIds)),
    profilesExport: (profileId: string) => unwrapIpc<string | null>(ipcRenderer.invoke("profiles:export", profileId)),
    profilesImport: () => unwrapIpc<import("./shared/schemas").Profile | null>(ipcRenderer.invoke("profiles:import")),
    profilesGetOverlayTargetId: () => unwrapIpc(ipcRenderer.invoke("profiles:getOverlayTargetId")),
    profilesGetOverlaySupportTargetId: () => unwrapIpc(ipcRenderer.invoke("profiles:getOverlaySupportTargetId")),
    profilesSetOverlayTarget: (profileId: string | null, iconKey?: string) => unwrapIpc(ipcRenderer.invoke("profiles:setOverlayTarget", profileId, iconKey)),
    profilesSetOverlaySupportTarget: (profileId: string | null, iconKey?: string) => unwrapIpc(ipcRenderer.invoke("profiles:setOverlaySupportTarget", profileId, iconKey)),
    openTab: (profileId: string, windowId?: string) => unwrapIpc(ipcRenderer.invoke("session:openTab", profileId, windowId)),
    openTabWithLayout: (profileId: string, layoutType: string, windowId?: string) => unwrapIpc(ipcRenderer.invoke("session:openTabWithLayout", profileId, layoutType, windowId)),
    createWindowWithLayout: (layout: import("./shared/schemas").MultiViewLayout, windowId: string, initialProfileId?: string) => unwrapIpc(ipcRenderer.invoke("session:createWindowWithLayout", layout, windowId, initialProfileId)),
    openWindow: (profileId: string) => unwrapIpc(ipcRenderer.invoke("instance:openWindow", profileId)),
    // Multi-window management
    createTabWindow: (name?: string) => unwrapIpc(ipcRenderer.invoke("session:createTabWindow", name)) as Promise<string>,
    listTabWindows: () => unwrapIpc(ipcRenderer.invoke("session:listTabWindows")) as Promise<import("./shared/schemas").TabWindowMetadata[]>,
    closeTabWindow: (windowId: string) => unwrapIpc(ipcRenderer.invoke("session:closeTabWindow", windowId)),
    renameTabWindow: (windowId: string, newName: string) => unwrapIpc(ipcRenderer.invoke("session:renameTabWindow", windowId, newName)),
    updateWindowTitle: (layoutTypes: string[]) => unwrapIpc(ipcRenderer.invoke("session:updateWindowTitle", layoutTypes)),
    sessionTabsOpen: (profileId: string) => unwrapIpc(ipcRenderer.invoke("sessionTabs:open", profileId)),
    sessionTabsSwitch: (profileId: string) => unwrapIpc(ipcRenderer.invoke("sessionTabs:switch", profileId)),
    sessionTabsLogout: (profileId: string) => unwrapIpc(ipcRenderer.invoke("sessionTabs:logout", profileId)),
    sessionTabsLogin: (profileId: string) => unwrapIpc(ipcRenderer.invoke("sessionTabs:login", profileId)),
    sessionTabsClose: (profileId: string) => unwrapIpc(ipcRenderer.invoke("sessionTabs:close", profileId)),
    sessionTabsSetBounds: (bounds: Rect) => unwrapIpc(ipcRenderer.invoke("sessionTabs:setBounds", bounds)),
    sessionTabsSetVisible: (visible: boolean) => unwrapIpc(ipcRenderer.invoke("sessionTabs:setVisible", visible)),
    sessionTabsGetOpenProfiles: () => unwrapIpc(ipcRenderer.invoke("sessionTabs:getOpenProfiles")) as Promise<string[]>,
    sessionTabsGetAllOpenProfiles: () => unwrapIpc(ipcRenderer.invoke("sessionTabs:getAllOpenProfiles")) as Promise<string[]>,
    sessionFocusProfile: (profileId: string) => unwrapIpc(ipcRenderer.invoke("session:focusProfile", profileId)) as Promise<boolean>,
    sessionTabsGetLayoutBounds: () => unwrapIpc(ipcRenderer.invoke("sessionTabs:getLayoutBounds")) as Promise<Array<{ id: string; position: number; bounds: { x: number; y: number; width: number; height: number } }>>,
    sessionTabsSetSkippedProfiles: (profileIds: string[]) => unwrapIpc(ipcRenderer.invoke("sessionTabs:setSkippedProfiles", profileIds)) as Promise<boolean>,
    sessionTabsSetMultiLayout: (
        layout: import("./shared/schemas").MultiViewLayout | null,
        options?: { ensureViews?: boolean; allowMissingViews?: boolean }
    ) => unwrapIpc(ipcRenderer.invoke("sessionTabs:setMultiLayout", layout, options)),
    sessionTabsOpenInCell: (
        position: number,
        profileId: string,
        options?: { activate?: boolean; forceLoad?: boolean }
    ) => unwrapIpc(ipcRenderer.invoke("sessionTabs:openInCell", position, profileId, options)),
    sessionTabsUpdateCell: (position: number, profileId: string | null) =>
        unwrapIpc(ipcRenderer.invoke("sessionTabs:updateCell", position, profileId)),
    sessionTabsSetSplit: (pair: {
        primary: string;
        secondary: string;
        ratio?: number;
    } | null) => unwrapIpc(ipcRenderer.invoke("sessionTabs:setSplit", pair)),
    sessionTabsSetSplitRatio: (ratio: number) => unwrapIpc(ipcRenderer.invoke("sessionTabs:setSplitRatio", ratio)),
    sessionTabsReset: () => unwrapIpc(ipcRenderer.invoke("sessionTabs:reset")),
    sessionTabsShowLayoutMenu: (coords: { x: number; y: number }) =>
        unwrapIpc(ipcRenderer.invoke("sessionTabs:showLayoutMenu", coords)),
    sessionWindowClose: () => unwrapIpc(ipcRenderer.invoke("sessionWindow:close")),
    overlaysHideForDialog: () => ipcRenderer.invoke("overlays:hideForDialog"),
    overlaysShowAfterDialog: () => ipcRenderer.invoke("overlays:showAfterDialog"),
    appQuit: () => unwrapIpc(ipcRenderer.invoke("app:quit")),
    appGetVersion: () => unwrapIpc<string>(ipcRenderer.invoke("app:getVersion")),
    appCheckForUpdates: () => ipcRenderer.invoke("app:checkForUpdates"),
    appListReleases: () => ipcRenderer.invoke("app:listReleases"),
    appInstallVersion: (version: string) => ipcRenderer.invoke("app:installVersion", version),
    tabLayoutsList: () => unwrapIpc(ipcRenderer.invoke("tabLayouts:list")),
    tabLayoutsGet: (id: string) => unwrapIpc(ipcRenderer.invoke("tabLayouts:get", id)),
    tabLayoutsSave: (input: TabLayoutInput) => unwrapIpc(ipcRenderer.invoke("tabLayouts:save", input)),
    tabLayoutsDelete: (id: string) => unwrapIpc(ipcRenderer.invoke("tabLayouts:delete", id)),
    tabLayoutsPending: () => unwrapIpc(ipcRenderer.invoke("tabLayouts:pending")),
    tabLayoutsApply: (id: string) => unwrapIpc(ipcRenderer.invoke("tabLayouts:apply", id)),
    onApplyLayout: (cb: (layout: TabLayout) => void) => {
        ipcRenderer.on("session:applyLayout", (_e, layout: TabLayout) => cb(layout));
    },
    onOpenTab: (cb: (profileId: string) => void) => {
        ipcRenderer.on("session:openTab", (_e, profileId: string) => cb(profileId));
    },
    onOpenTabWithLayout: (cb: (profileId: string, layoutType: string) => void) => {
        ipcRenderer.on("session:openTabWithLayout", (_e, profileId: string, layoutType: string) => cb(profileId, layoutType));
    },
    onSessionActiveChanged: (cb: (profileId: string | null) => void) => {
        ipcRenderer.on("sessionTabs:activeChanged", (_e, profileId: string | null) => cb(profileId));
    },
    onSessionWindowCloseRequested: (cb: () => void) => {
        ipcRenderer.on("sessionWindow:closeRequested", () => cb());
    },
    onLayoutsChanged: (cb: () => void) => {
        ipcRenderer.on("tabLayouts:changed", () => cb());
    },
    onLayoutCreated: (cb: (layout: import("./shared/schemas").MultiViewLayout) => void) => {
        ipcRenderer.on("session:layoutCreated", (_e, layout: import("./shared/schemas").MultiViewLayout) => cb(layout));
    },
    fetchNewsPage: (path?: string) => unwrapIpc(ipcRenderer.invoke("news:fetch", path)),
    fetchNewsArticle: (url: string) => unwrapIpc(ipcRenderer.invoke("news:fetchArticle", url)),
    fetchAnnouncements: () => unwrapIpc(ipcRenderer.invoke("announcements:fetch")),
    roiOpen: (profileId: string) => unwrapIpc(ipcRenderer.invoke("roi:open", profileId)),
    roiLoad: (profileId: string) => unwrapIpc(ipcRenderer.invoke("roi:load", profileId)),
    roiSave: (profileId: string, rois: RoiData) => unwrapIpc(ipcRenderer.invoke("roi:save", profileId, rois)),
    roiStatus: (profileId: string) => unwrapIpc<Record<string, boolean>>(ipcRenderer.invoke("roi:status", profileId)),
    themesList: () => unwrapIpc(ipcRenderer.invoke("themes:list")),
    themeSave: (input: ThemeInput) => unwrapIpc(ipcRenderer.invoke("themes:save", input)),
    themeDelete: (id: string) => unwrapIpc(ipcRenderer.invoke("themes:delete", id)),
    themePush: (payload: ThemePushPayload) => unwrapIpc(ipcRenderer.invoke("theme:push", payload)),
    themeCurrent: () => unwrapIpc(ipcRenderer.invoke("theme:current")),
    tabActiveColorLoad: () => unwrapIpc(ipcRenderer.invoke("tabActiveColor:load")),
    tabActiveColorSave: (color: string | null) => unwrapIpc(ipcRenderer.invoke("tabActiveColor:save", color)),
    memorySystem: () => unwrapIpc<{ totalMB: number }>(ipcRenderer.invoke("memory:system")),
    memoryDetails: () => unwrapIpc<{ totalMB: number; rows: Array<{ profileName: string; memoryMB: number; category?: "profile" | "plugin" | "system"; shared?: boolean }> }>(ipcRenderer.invoke("memory:details")),
    clientSettingsGet: () => unwrapIpc<ClientSettings>(ipcRenderer.invoke("clientSettings:get")),
    clientSettingsPatch: (patch: ClientSettingsPatch) => unwrapIpc<ClientSettings>(ipcRenderer.invoke("clientSettings:patch", patch)),
    hotkeysPause: () => ipcRenderer.invoke("hotkeys:pause"),
    hotkeysResume: () => ipcRenderer.invoke("hotkeys:resume"),
    featuresGet: () => unwrapIpc(ipcRenderer.invoke("features:get")),
    featuresPatch: (patch: Partial<FeatureFlags>) => unwrapIpc(ipcRenderer.invoke("features:patch", patch)),
    patchnotesGet: (locale: string) => unwrapIpc<string>(ipcRenderer.invoke("patchnotes:get", locale)),
    documentationGet: (locale: string) => unwrapIpc<{ content: string; assetsPath: string }>(ipcRenderer.invoke("documentation:get", locale)),
    onThemeUpdate: (cb: (payload: ThemePushPayload) => void) => {
        ipcRenderer.on("theme:update", (_e, payload: ThemePushPayload) => cb(payload));
    },
    // Plugin management
    pluginsList: () => unwrapIpc<PluginStateInfo[]>(ipcRenderer.invoke("plugins:list")),
    pluginsListAll: () => unwrapIpc<PluginStateInfo[]>(ipcRenderer.invoke("plugins:listAll")),
    pluginsDiscover: () => unwrapIpc<PluginManifest[]>(ipcRenderer.invoke("plugins:discover")),
    pluginsGetState: (pluginId: string) => unwrapIpc(ipcRenderer.invoke("plugins:getState", pluginId)),
    pluginsGetInfo: (pluginId: string) => unwrapIpc(ipcRenderer.invoke("plugins:getInfo", pluginId)),
    pluginsEnable: (pluginId: string) => unwrapIpc<{ success: boolean; error?: string }>(ipcRenderer.invoke("plugins:enable", pluginId)),
    pluginsDisable: (pluginId: string) => unwrapIpc<{ success: boolean; error?: string }>(ipcRenderer.invoke("plugins:disable", pluginId)),
    pluginsStart: (pluginId: string) => unwrapIpc<{ success: boolean; error?: string }>(ipcRenderer.invoke("plugins:start", pluginId)),
    pluginsStop: (pluginId: string) => unwrapIpc<{ success: boolean; error?: string }>(ipcRenderer.invoke("plugins:stop", pluginId)),
    pluginsReload: (pluginId: string) => unwrapIpc<{ success: boolean; error?: string }>(ipcRenderer.invoke("plugins:reload", pluginId)),
    pluginsIsEnabled: (pluginId: string) => unwrapIpc<boolean>(ipcRenderer.invoke("plugins:isEnabled", pluginId)),
    pluginsGetSettingsUI: (pluginId: string) => unwrapIpc<{ url: string; width?: number; height?: number; html?: string; baseHref?: string; css?: string; js?: string }>(ipcRenderer.invoke("plugins:getSettingsUI", pluginId)),
    pluginsOpenSettingsWindow: (pluginId: string) => unwrapIpc<{ opened?: boolean; alreadyOpen?: boolean }>(ipcRenderer.invoke("plugins:openSettingsWindow", pluginId)),
    pluginsInvokeChannel: (pluginId: string, channel: string, ...args: unknown[]) => unwrapIpc<unknown>(ipcRenderer.invoke("plugins:invokeChannel", pluginId, channel, ...args)),
    pluginsGetSidepanelTabs: () => unwrapIpc<Array<{
        pluginId: string;
        label: string;
        entry: string;
        url: string;
        html: string;
        baseHref: string;
        css: string;
        js: string;
    }>>(ipcRenderer.invoke("plugins:getSidepanelTabs")),
    pluginsGetOverlayViews: () => unwrapIpc<Array<{
        pluginId: string;
        entry: string;
        url: string;
        html: string;
        baseHref: string;
        css: string;
        js: string;
        transparent?: boolean;
        width?: number;
        height?: number;
    }>>(ipcRenderer.invoke("plugins:getOverlayViews")),
    onPluginStateChanged: (cb: (state: PluginStateInfo) => void) => {
        const wrapped = (_e: IpcRendererEvent, state: PluginStateInfo) => cb(state);
        ipcRenderer.on("plugins:stateChanged", wrapped);
        return () => ipcRenderer.removeListener("plugins:stateChanged", wrapped);
    },
    onTabHotkeyNavigate: (cb: (payload: { side?: "left" | "right"; dir: "prev" | "next" }) => void) => {
        const wrapped = (_e: IpcRendererEvent, payload: { side?: "left" | "right"; dir: "prev" | "next" }) => cb(payload);
        ipcRenderer.on("clientHotkey:navigate", wrapped);
        return () => ipcRenderer.removeListener("clientHotkey:navigate", wrapped);
    },
    onTabBarToggle: (cb: () => void) => {
        const wrapped = () => cb();
        ipcRenderer.on("clientHotkey:toggleTabBar", wrapped);
        return () => ipcRenderer.removeListener("clientHotkey:toggleTabBar", wrapped);
    },
    onShowFcoinConverter: (cb: () => void) => {
        const wrapped = () => cb();
        ipcRenderer.on("clientHotkey:showFcoinConverter", wrapped);
        return () => ipcRenderer.removeListener("clientHotkey:showFcoinConverter", wrapped);
    },
    onShowShoppingList: (cb: () => void) => {
        const wrapped = () => cb();
        ipcRenderer.on("clientHotkey:showShoppingList", wrapped);
        return () => ipcRenderer.removeListener("clientHotkey:showShoppingList", wrapped);
    },
    // Shopping List
    shoppingListSearch: (query: string, locale: string) => unwrapIpc(ipcRenderer.invoke("shoppingList:search", query, locale)),
    shoppingListIcon: (iconFilename: string) => unwrapIpc<string | null>(ipcRenderer.invoke("shoppingList:icon", iconFilename)),
shoppingListSavePrice: (itemId: number | string, price: number) => unwrapIpc(ipcRenderer.invoke("shoppingList:savePrice", itemId, price)),
    // Upgrade Calculator
    upgradeCalcLoadSettings: () => unwrapIpc<import("./main/ipc/handlers/upgradeCalc").UpgradeCalcSettings>(ipcRenderer.invoke("upgradeCalc:loadSettings")),
    upgradeCalcSaveSettings: (settings: import("./main/ipc/handlers/upgradeCalc").UpgradeCalcSettings) => unwrapIpc<boolean>(ipcRenderer.invoke("upgradeCalc:saveSettings", settings)),
    onToast: (cb: (payload: { message: string; tone?: "info" | "success" | "error"; ttlMs?: number }) => void) => {
        const wrapped = (_e: IpcRendererEvent, payload: { message: string; tone?: "info" | "success" | "error"; ttlMs?: number }) => cb(payload);
        ipcRenderer.on("toast:show", wrapped);
        return () => ipcRenderer.removeListener("toast:show", wrapped);
    },
    // Logs
    logsGet: () => unwrapIpc<Array<{ ts: number; level: string; module: string; message: string }>>(ipcRenderer.invoke("logs:get")),
    logsClear: () => unwrapIpc<boolean>(ipcRenderer.invoke("logs:clear")),
    logsSave: () => unwrapIpc<string>(ipcRenderer.invoke("logs:save")),
    logsSendToDiscord: (userNote: string | null, userName: string | null) => unwrapIpc<{ sent?: boolean; cooldownMs?: number; noWebhook?: boolean; noLogs?: boolean }>(ipcRenderer.invoke("logs:sendToDiscord", userNote, userName)),
    logsOpenWindow: () => unwrapIpc<boolean>(ipcRenderer.invoke("logs:openWindow")),
    onLogsNew: (cb: (entry: { ts: number; level: string; module: string; message: string }) => void) => {
        const wrapped = (_e: IpcRendererEvent, entry: { ts: number; level: string; module: string; message: string }) => cb(entry);
        ipcRenderer.on("logs:new", wrapped);
        return () => ipcRenderer.removeListener("logs:new", wrapped);
    },
});
// Note: overlay/hud/buff-wecker channels removed - will be handled by plugins
const allowedSend = new Set<string>([
    "sidepanel:toggle",
    "hudpanel:toggle",
    "hudpanel:setWidth",
]);
const allowedInvoke = new Set<string>([
    "sidepanel:toggle",
    "roi:open",
    "roi:load",
    "roi:save",
    "roi:status",
    "roi:visibility:get",
    "roi:visibility:set",
    "roi:debug:save",
    "app:getVersion",
    "app:checkForUpdates",
    "profiles:getOverlayTargetId",
    "profiles:getOverlaySupportTargetId",
    "themes:list",
    "themes:save",
    "themes:delete",
    "theme:push",
    "theme:current",
    "tabActiveColor:load",
    "tabActiveColor:save",
    "features:get",
    "features:patch",
    "patchnotes:get",
    "documentation:get",
    "ocr:getLatest",
    "ocr:getTimers",
    "ocr:setTimer",
    "ocr:manualLevel:get",
    "ocr:manualLevel:set",
    "ocr:manualExp:set",
    "ocr:update",
    // Plugin management channels
    "plugins:list",
    "plugins:listAll",
    "plugins:discover",
    "plugins:getState",
    "plugins:getInfo",
    "plugins:enable",
    "plugins:disable",
    "plugins:start",
    "plugins:stop",
    "plugins:reload",
    "plugins:isEnabled",
    "plugins:getSettingsUI",
    "plugins:openSettingsWindow",
    "plugins:invokeChannel",
    "plugins:getSidepanelTabs",
    "plugins:getOverlayViews",
    "profiles:setOverlaySupportTarget",
// Shopping List
    "shoppingList:search",
    "shoppingList:icon",
    "shoppingList:savePrice",
    // Upgrade Calculator
    "upgradeCalc:loadSettings",
    "upgradeCalc:saveSettings",
    // Logs
    "logs:get",
    "logs:clear",
    "logs:save",
    "logs:sendToDiscord",
    "logs:openWindow",
    "clientSettings:get",
    "memory:system",
    "memory:details",
]);
const allowedOn = new Set<string>(["theme:update", "plugins:stateChanged", "toast:show", "logs:new", "clientSettings:changed"]);
contextBridge.exposeInMainWorld("ipc", {
    send: (channel: string, payload?: unknown) => {
        if (!allowedSend.has(channel))
            return;
        ipcRenderer.send(channel, payload);
    },
    invoke: (channel: string, ...args: unknown[]) => {
        if (!allowedInvoke.has(channel)) {
            return Promise.reject(new Error("blocked ipc channel"));
        }
        return ipcRenderer.invoke(channel, ...args);
    },
    on: (channel: string, listener: (...args: unknown[]) => void) => {
        if (!allowedOn.has(channel))
            return (): void => undefined;
        const wrapped = (_e: IpcRendererEvent, ...args: unknown[]) => listener(...args);
        ipcRenderer.on(channel, wrapped);
        return () => ipcRenderer.removeListener(channel, wrapped);
    },
});
const roiChannel = (() => {
    try {
        const raw = decodeURIComponent(window.location.hash?.replace(/^#/, "") ?? "");
        if (raw && /^roi-calib:[a-zA-Z0-9-]+$/.test(raw))
            return raw;
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.warn("roi-calib channel parse failed", err);
    }
    return null;
})();
// ROI calibrator bridge payload type
type RoiCalibPayload = {
    rois: RoiData;
    update?: boolean;
    ok?: boolean;
    done?: boolean;
} | { cancel: true };

type RoiDebugPayload = Record<string, unknown>;

contextBridge.exposeInMainWorld("roiBridge", {
    channel: roiChannel,
    send: (payload: RoiCalibPayload) => {
        if (!roiChannel)
            return;
        ipcRenderer.send(roiChannel, payload);
    },
    sendDebug: (payload: RoiDebugPayload) => {
        if (!roiChannel)
            return;
        ipcRenderer.send(`${roiChannel}:debug`, payload);
    },
});

// =========================================================================
// Controller-Support (v3.5.0): Gamepad-Polling in Session-Windows.
// Aktiviert nur auf Flyff-Domains, damit der Launcher-Renderer keine
// Gamepad-Events empfaengt. Per RAF-Loop, sendet Diff-Frames per IPC an
// Main, der die Events am Chromium-Input-Layer der fokussierten Session-
// WebContents absetzt.
// =========================================================================
(() => {
    const isSessionWindow = (() => {
        try {
            return /(^|\.)flyff\.com$/i.test(window.location.hostname);
        } catch {
            return false;
        }
    })();
    if (!isSessionWindow) return;

    let prevButtons: boolean[] = [];
    let prevAxes: number[] = [];
    let polling = false;
    const announced = new Set<number>();

    const announceConnected = (gp: Gamepad) => {
        if (announced.has(gp.index)) return;
        announced.add(gp.index);
        try {
            ipcRenderer.send("controller:connected", {
                index: gp.index,
                id: gp.id,
                mapping: gp.mapping,
                axesCount: gp.axes.length,
                buttonsCount: gp.buttons.length,
            });
        }
        catch { /* ignore */ }
    };

    const sendFrame = (gp: Gamepad) => {
        const buttons = gp.buttons.map(b => b.pressed === true);
        const axes = Array.from(gp.axes);
        try {
            ipcRenderer.send("controller:frame", {
                index: gp.index,
                timestamp: gp.timestamp ?? performance.now(),
                axes,
                buttons,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
            });
        }
        catch {
            // ignore — IPC channel might not yet be ready
        }
    };

    const tick = () => {
        if (!polling) return;
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        let chosen: Gamepad | null = null;
        for (let i = 0; i < pads.length; i++) {
            const p = pads[i];
            if (p) { chosen = p; break; }
        }
        if (chosen) {
            announceConnected(chosen);
            const buttons = chosen.buttons.map(b => b.pressed === true);
            const axes = Array.from(chosen.axes);
            const buttonsChanged = buttons.some((b, i) => b !== prevButtons[i]) || buttons.length !== prevButtons.length;
            const axesChanged = axes.some((a, i) => Math.abs(a - (prevAxes[i] ?? 0)) > 0.01) || axes.length !== prevAxes.length;
            if (buttonsChanged || axesChanged) {
                sendFrame(chosen);
                prevButtons = buttons;
                prevAxes = axes;

                // Belegungs-Overlay: Layer-Wechsel auf gehaltenen Modifier-Slot.
                // Reihenfolge L1 → R1 → L2 → R2 spiegelt MODIFIER_SLOTS im
                // Router. Seit dem Cursor-Modus-Refactor ist L2 nicht mehr
                // hardcoded fuer Cursor-Mode und kann als regulaerer Modifier
                // genutzt werden. Setter ist ein No-Op falls noch kein Mapping
                // gepushed wurde.
                const heldL1 = buttons[4] === true;
                const heldR1 = buttons[5] === true;
                const heldL2 = buttons[6] === true;
                const heldR2 = buttons[7] === true;
                const newMod: "l1" | "r1" | "l2" | "r2" | null =
                    heldL1 ? "l1" : heldR1 ? "r1" : heldL2 ? "l2" : heldR2 ? "r2" : null;
                (window as unknown as { __flyffuSetActiveModifier?: (m: "l1" | "r1" | "l2" | "r2" | null) => void })
                    .__flyffuSetActiveModifier?.(newMod);
            }
        }
        requestAnimationFrame(tick);
    };

    const start = () => {
        if (polling) return;
        polling = true;
        requestAnimationFrame(tick);
    };
    const stop = () => { polling = false; };

    window.addEventListener("focus", start);
    window.addEventListener("blur", stop);
    window.addEventListener("gamepadconnected", start);
    if (typeof document !== "undefined" && document.hasFocus && document.hasFocus()) {
        start();
    }

    // Action-Pad-Kalibrierung: Main schickt controller:calibrate:start, der
    // naechste mousedown auf der Page wird als Position erfasst und als
    // Bruchteile zurueckgemeldet. Capture-Phase, damit wir's vor Flyff sehen;
    // wir verhindern den Default NICHT — der User klickt absichtlich auf das
    // Action-Pad und sieht so visuell die Bestaetigung dass er die richtige
    // Stelle erwischt hat. 10 s Timeout falls nichts geklickt wird.
    let calibrationHandler: ((e: MouseEvent) => void) | null = null;
    let calibrationTimeout: ReturnType<typeof setTimeout> | null = null;
    const cancelCalibration = () => {
        if (calibrationHandler) {
            document.removeEventListener("mousedown", calibrationHandler, true);
            calibrationHandler = null;
        }
        if (calibrationTimeout) {
            clearTimeout(calibrationTimeout);
            calibrationTimeout = null;
        }
    };
    ipcRenderer.on("controller:calibrate:start", () => {
        cancelCalibration();
        const handler = (e: MouseEvent) => {
            cancelCalibration();
            try {
                ipcRenderer.send("controller:calibrate:done", {
                    x: e.clientX,
                    y: e.clientY,
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight,
                });
            }
            catch { /* ignore */ }
        };
        calibrationHandler = handler;
        document.addEventListener("mousedown", handler, true);
        calibrationTimeout = setTimeout(cancelCalibration, 10000);
    });
    ipcRenderer.on("controller:calibrate:cancel", cancelCalibration);

    // Icon-Capture (Click-to-Capture): Main schickt `start` → naechster Klick
    // wird mit Position gemeldet, Main captured 40x40 px um den Punkt herum.
    // Visueller Hinweis: ein 40x40-Outline-Kreis folgt dem Cursor solange
    // Capture aktiv ist, damit der User sieht was erfasst wird.
    let iconCaptureHandler: ((e: MouseEvent) => void) | null = null;
    let iconCaptureTimeout: ReturnType<typeof setTimeout> | null = null;
    let iconCaptureCursor: HTMLDivElement | null = null;
    let iconCursorMoveHandler: ((e: MouseEvent) => void) | null = null;
    let iconKeyHandler: ((e: KeyboardEvent) => void) | null = null;

    const removeIconCursor = () => {
        if (iconCaptureCursor && iconCaptureCursor.parentNode) {
            iconCaptureCursor.parentNode.removeChild(iconCaptureCursor);
        }
        iconCaptureCursor = null;
        if (iconCursorMoveHandler) {
            document.removeEventListener("mousemove", iconCursorMoveHandler, true);
            iconCursorMoveHandler = null;
        }
    };
    const cancelIconCapture = () => {
        if (iconCaptureHandler) {
            document.removeEventListener("mousedown", iconCaptureHandler, true);
            iconCaptureHandler = null;
        }
        if (iconCaptureTimeout) {
            clearTimeout(iconCaptureTimeout);
            iconCaptureTimeout = null;
        }
        if (iconKeyHandler) {
            document.removeEventListener("keydown", iconKeyHandler, true);
            iconKeyHandler = null;
        }
        removeIconCursor();
    };
    ipcRenderer.on("controller:icon:capture:start", () => {
        cancelIconCapture();
        // Visueller Cursor-Indikator: 40x40 px Goldborder um den Mauszeiger.
        if (document.body) {
            const cursor = document.createElement("div");
            cursor.style.cssText = [
                "position:fixed",
                "width:40px",
                "height:40px",
                "border:2px solid rgba(212,175,55,0.95)",
                "border-radius:6px",
                "box-shadow:0 0 0 1px rgba(0,0,0,0.6),0 2px 8px rgba(0,0,0,0.55)",
                "pointer-events:none",
                "z-index:2147483647",
                "transform:translate(-21px,-21px)",
                "left:-100px",
                "top:-100px",
            ].join(";");
            document.body.appendChild(cursor);
            iconCaptureCursor = cursor;
            iconCursorMoveHandler = (e: MouseEvent) => {
                if (!iconCaptureCursor) return;
                iconCaptureCursor.style.left = `${e.clientX}px`;
                iconCaptureCursor.style.top = `${e.clientY}px`;
            };
            document.addEventListener("mousemove", iconCursorMoveHandler, true);
        }
        const handler = (e: MouseEvent) => {
            cancelIconCapture();
            try {
                ipcRenderer.send("controller:icon:capture:done", {
                    x: e.clientX,
                    y: e.clientY,
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight,
                });
            }
            catch { /* ignore */ }
            // Klick NICHT zum Spiel durchreichen — wir wollen nur den Pixel-Pick,
            // nicht versehentlich den Skill triggern.
            e.preventDefault();
            e.stopPropagation();
        };
        iconCaptureHandler = handler;
        document.addEventListener("mousedown", handler, true);
        // Esc bricht ab (kein DONE-Signal an Main, dort laeuft der 10s-Timeout
        // → Main schickt cancel zurueck wenn der ankommt).
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                cancelIconCapture();
                try { ipcRenderer.send("controller:icon:capture:cancel"); } catch { /* ignore */ }
            }
        };
        iconKeyHandler = onKey;
        document.addEventListener("keydown", onKey, true);
        iconCaptureTimeout = setTimeout(cancelIconCapture, 10000);
    });
    ipcRenderer.on("controller:icon:capture:cancel", cancelIconCapture);
})();

// =====================================================================
// Belegungs-Overlay: kleine in-DOM-Anzeige der 4 Face-Button-Bindings
// (△ ○ ✕ □) ohne Hintergrund, fixiert am rechten unteren Spielfeldrand.
// Beim Halten von L1/R1/R2 wechselt das Overlay auf den jeweiligen
// Modifier-Layer. Source-of-Truth fuer das Mapping ist der Hauptprozess
// — wir empfangen die fertig aufgeloesten Labels via IPC.
// =====================================================================
type OverlayFaceLabels = {
    y?: string | null;
    b?: string | null;
    a?: string | null;
    x?: string | null;
};
type OverlayFaceIcons = {
    y?: string;
    b?: string;
    a?: string;
    x?: string;
};
type OverlayPayload = {
    enabled: boolean;
    base: OverlayFaceLabels;
    baseIcons?: OverlayFaceIcons;
    modifiers: {
        l1?: OverlayFaceLabels;
        r1?: OverlayFaceLabels;
        r2?: OverlayFaceLabels;
    };
    modifierIcons?: {
        l1?: OverlayFaceIcons;
        r1?: OverlayFaceIcons;
        r2?: OverlayFaceIcons;
    };
};

(() => {
    const isSessionWindow = (() => {
        try {
            return /(^|\.)flyff\.com$/i.test(window.location.hostname);
        } catch {
            return false;
        }
    })();
    if (!isSessionWindow) return;

    const POS_STORAGE_KEY = "flyffu_overlay_pos";
    const OVERLAY_W = 160;
    const OVERLAY_H = 120;

    type SlotEls = { sym: HTMLDivElement; lab: HTMLDivElement; img: HTMLImageElement };
    let payload: OverlayPayload | null = null;
    let activeMod: "l1" | "r1" | "r2" | null = null;
    let overlayEl: HTMLDivElement | null = null;
    let slotEls: { y: SlotEls; b: SlotEls; a: SlotEls; x: SlotEls } | null = null;
    let dragModeActive = false;
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const loadPos = (): { x: number; y: number } => {
        const fallback = {
            x: Math.max(0, window.innerWidth - OVERLAY_W - 18),
            y: Math.max(0, window.innerHeight - OVERLAY_H - 18),
        };
        try {
            const raw = localStorage.getItem(POS_STORAGE_KEY);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number") {
                // Clamp gegen Viewport-Resize seit dem letzten Save.
                const x = Math.max(0, Math.min(parsed.x, window.innerWidth - OVERLAY_W));
                const y = Math.max(0, Math.min(parsed.y, window.innerHeight - OVERLAY_H));
                return { x, y };
            }
        }
        catch { /* ignore corrupt JSON */ }
        return fallback;
    };

    const savePos = (x: number, y: number) => {
        try { localStorage.setItem(POS_STORAGE_KEY, JSON.stringify({ x, y })); }
        catch { /* ignore quota / disabled storage */ }
    };

    const ensureOverlay = () => {
        if (overlayEl || !document.body) return;
        const root = document.createElement("div");
        root.id = "flyffu-binding-overlay";
        const pos = loadPos();
        // Kein Hintergrund, keine Border — nur Text mit Shadow fuer Lesbarkeit.
        // pointer-events:none verhindert dass das Overlay Klicks schluckt;
        // bei Ctrl+Shift wird's temporaer auf auto geschaltet (Drag-Modus).
        // left/top statt right/bottom, weil ein Flyff-Vorfahren mit transform
        // das fixed-Positioning ans Element statt ans Viewport bindet —
        // explizite Pixelwerte sind robust.
        root.style.cssText = [
            "position:fixed",
            `left:${pos.x}px`,
            `top:${pos.y}px`,
            "z-index:2147483647",
            "pointer-events:none",
            "user-select:none",
            "font-family:'Inter',system-ui,-apple-system,sans-serif",
            `width:${OVERLAY_W}px`,
            `height:${OVERLAY_H}px`,
            "opacity:0.92",
            // 3x3-Grid: △ oben Mitte, □ links Mitte, ○ rechts Mitte, ✕ unten Mitte.
            // Mittelzelle bleibt leer → echter Diamond, jeder Knopf liegt seinem
            // Pendant exakt gegenueber (△↔✕, □↔○) wie auf dem Pad.
            "display:grid",
            "grid-template-columns:1fr 1fr 1fr",
            "grid-template-rows:1fr 1fr 1fr",
            "transition:outline 80ms linear",
        ].join(";");

        const mkSlot = (
            symbol: string,
            glyphColor: string,
            row: number,
            col: number,
            justify: string,
            align: string,
        ): SlotEls => {
            const slot = document.createElement("div");
            slot.style.cssText = [
                "text-align:center",
                `grid-row:${row}`,
                `grid-column:${col}`,
                `justify-self:${justify}`,
                `align-self:${align}`,
                "display:flex",
                "flex-direction:column",
                "align-items:center",
                "gap:2px",
            ].join(";");
            const sym = document.createElement("div");
            sym.textContent = symbol;
            sym.style.cssText =
                `color:${glyphColor};font-size:15px;font-weight:700;line-height:1;`
                + "text-shadow:0 1px 4px rgba(0,0,0,.95),0 0 2px rgba(0,0,0,.85)";
            const lab = document.createElement("div");
            lab.style.cssText =
                "color:#fff;font-size:11px;font-weight:600;line-height:1;"
                + "text-shadow:0 1px 4px rgba(0,0,0,.95),0 0 2px rgba(0,0,0,.85)";
            // Optional Skill-Icon — wird per Click-to-Capture-Lehrmodus gesetzt.
            // Wenn vorhanden ersetzt es Symbol+Label, sonst hidden.
            const img = document.createElement("img");
            img.style.cssText = [
                "width:26px",
                "height:26px",
                "image-rendering:auto",
                "border-radius:4px",
                "box-shadow:0 1px 3px rgba(0,0,0,.85)",
                "display:none",
            ].join(";");
            slot.appendChild(sym);
            slot.appendChild(lab);
            slot.appendChild(img);
            root.appendChild(slot);
            return { sym, lab, img };
        };

        // Reihenfolge: y=oben, x=links, b=rechts, a=unten — so wie die Knoepfe
        // physisch auf dem Pad liegen.
        const yEl = mkSlot("△", "#5ad15a", 1, 2, "center", "start");
        const xEl = mkSlot("□", "#ec73ff", 2, 1, "start", "center");
        const bEl = mkSlot("○", "#ff6464", 2, 3, "end", "center");
        const aEl = mkSlot("✕", "#73a8ff", 3, 2, "center", "end");

        document.body.appendChild(root);
        overlayEl = root;
        slotEls = { y: yEl, b: bEl, a: aEl, x: xEl };

        // Drag-Modus an/aus auf Ctrl+Shift. Der Modus aktiviert pointer-events
        // und zeigt eine gestrichelte Outline — sonst ist das Overlay komplett
        // transparent fuer Klicks. Maus-Buttons im Spiel werden nicht
        // beeintraechtigt.
        const setDragMode = (active: boolean) => {
            if (active === dragModeActive) return;
            // Mitten in einer Drag-Geste die Modifier loslassen → Drag erst
            // beim mouseup beenden, sonst springt der Cursor weg.
            if (!active && isDragging) return;
            dragModeActive = active;
            if (!overlayEl) return;
            overlayEl.style.pointerEvents = active ? "auto" : "none";
            overlayEl.style.outline = active
                ? "1px dashed rgba(212,175,55,0.85)"
                : "none";
            overlayEl.style.outlineOffset = "4px";
            overlayEl.style.cursor = active ? "move" : "default";
        };

        const onKey = (e: KeyboardEvent) => {
            // Beide Modifier muessen gehalten sein. e.ctrlKey/e.shiftKey
            // reflektiert den Status NACH dem Event, also funktioniert
            // ein einzelner Listener fuer beide keydown- und keyup-Edges.
            setDragMode(e.ctrlKey && e.shiftKey);
        };
        window.addEventListener("keydown", onKey, true);
        window.addEventListener("keyup", onKey, true);
        window.addEventListener("blur", () => setDragMode(false), true);

        const onMouseDown = (e: MouseEvent) => {
            if (!dragModeActive || !overlayEl) return;
            const rect = overlayEl.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            isDragging = true;
            // Klick darf NICHT zum Spiel durchfallen, sonst verliert der
            // Char das Target o.ae.
            e.preventDefault();
            e.stopPropagation();
        };
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging || !overlayEl) return;
            const x = Math.max(0, Math.min(e.clientX - dragOffsetX, window.innerWidth - OVERLAY_W));
            const y = Math.max(0, Math.min(e.clientY - dragOffsetY, window.innerHeight - OVERLAY_H));
            overlayEl.style.left = `${x}px`;
            overlayEl.style.top = `${y}px`;
            e.preventDefault();
            e.stopPropagation();
        };
        const onMouseUp = (e: MouseEvent) => {
            if (!isDragging || !overlayEl) return;
            isDragging = false;
            const rect = overlayEl.getBoundingClientRect();
            savePos(rect.left, rect.top);
            // Wenn Modifier zwischendurch losgelassen wurden, Drag-Modus
            // jetzt sauber abbauen.
            if (!(e.ctrlKey && e.shiftKey)) setDragMode(false);
        };
        root.addEventListener("mousedown", onMouseDown, true);
        window.addEventListener("mousemove", onMouseMove, true);
        window.addEventListener("mouseup", onMouseUp, true);
    };

    const formatLabel = (raw: string | null | undefined): string => {
        if (raw == null || raw === "") return "—";
        if (raw.startsWith("@")) {
            const trimmed = raw.slice(1);
            // CamelCase → erstes Zeichen gross, Rest unveraendert (kompakt).
            return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
        }
        return raw;
    };

    const renderOverlay = () => {
        if (!payload?.enabled) {
            if (overlayEl) overlayEl.style.display = "none";
            return;
        }
        ensureOverlay();
        if (!overlayEl || !slotEls) return;
        overlayEl.style.display = "grid";

        const base = payload.base;
        const baseIcons = payload.baseIcons ?? {};
        const layer = activeMod ? payload.modifiers[activeMod] : undefined;
        const layerIcons = activeMod ? payload.modifierIcons?.[activeMod] : undefined;
        const pickLabel = (face: "y" | "b" | "a" | "x"): string | null | undefined => {
            if (layer && face in layer) return layer[face];
            return base[face];
        };
        const pickIcon = (face: "y" | "b" | "a" | "x"): string | undefined => {
            // Layer-Icon hat Vorrang, sonst Base-Icon, sonst undefined (= Text-Fallback).
            return layerIcons?.[face] ?? baseIcons[face];
        };

        const apply = (face: "y" | "b" | "a" | "x", el: SlotEls) => {
            const icon = pickIcon(face);
            if (icon) {
                el.img.src = icon;
                el.img.style.display = "block";
                el.sym.style.display = "none";
                el.lab.style.display = "none";
            }
            else {
                el.img.style.display = "none";
                el.sym.style.display = "block";
                el.lab.style.display = "block";
                el.lab.textContent = formatLabel(pickLabel(face));
            }
        };
        apply("y", slotEls.y);
        apply("b", slotEls.b);
        apply("a", slotEls.a);
        apply("x", slotEls.x);
    };

    ipcRenderer.on("controller:overlay:update", (_e, p: unknown) => {
        if (!p || typeof p !== "object") {
            payload = null;
        }
        else {
            payload = p as OverlayPayload;
        }
        renderOverlay();
    });

    // Setter fuer den Polling-Loop (siehe oben). Aenderung loest Re-Render aus,
    // gleicher Wert wird ignoriert (kein DOM-Trash).
    (window as unknown as { __flyffuSetActiveModifier?: (m: "l1" | "r1" | "r2" | null) => void })
        .__flyffuSetActiveModifier = (mod) => {
        if (mod === activeMod) return;
        activeMod = mod;
        renderOverlay();
    };

    // Initial-Pull: sobald Preload laeuft, Mapping anfordern. Main antwortet
    // mit `controller:overlay:update`. Falls Profil noch nicht aufgeloest ist,
    // kommt nichts — und das ist OK, weil reloadButtonMapping spaeter pusht.
    try { ipcRenderer.send("controller:overlay:request"); }
    catch { /* ignore */ }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderOverlay, { once: true });
    }
    else {
        renderOverlay();
    }
})();

// Renderer-API fuer das Controller-Settings-Tab (Custom-Mapping-Editor): einmal
// Reload-Trigger schicken, damit Main den Mapping-Cache fuer das Profil neu
// lädt nachdem profilesUpdate gespeichert hat.
contextBridge.exposeInMainWorld("controllerApi", {
    reloadMapping: (profileId: string) => {
        try { ipcRenderer.send("controller:reloadMapping", profileId); }
        catch { /* ignore */ }
    },
    onLauncherAction: (handler: (action: string) => void) => {
        const listener = (_e: unknown, payload: unknown) => {
            try {
                if (payload && typeof payload === "object") {
                    const a = (payload as { action?: unknown }).action;
                    if (typeof a === "string") handler(a);
                }
            }
            catch { /* ignore */ }
        };
        ipcRenderer.on("controller:launcherAction", listener);
        return () => ipcRenderer.removeListener("controller:launcherAction", listener);
    },
    /**
     * Startet den Click-to-Capture-Lehrmodus fuer ein Skill-Icon. Auflöst zu
     * `{ ok: true, dataUri }` sobald der User im Spiel auf das Icon geklickt
     * hat, oder `{ ok: false, reason }` bei Timeout/Abbruch/keine-Spielview.
     */
    captureIcon: (profileId: string, face: "a" | "b" | "x" | "y", layer: "l1" | "r1" | "r2" | null) => {
        return ipcRenderer.invoke("controller:icon:capture", { profileId, face, layer });
    },
    /** Loescht ein gesetztes Icon aus dem Profil. */
    clearIcon: (profileId: string, face: "a" | "b" | "x" | "y", layer: "l1" | "r1" | "r2" | null) => {
        return ipcRenderer.invoke("controller:icon:clear", { profileId, face, layer });
    },
    /** Bricht einen laufenden Icon-Capture-Lehrmodus ab. */
    cancelCaptureIcon: () => {
        try { ipcRenderer.send("controller:icon:capture:cancel"); }
        catch { /* ignore */ }
    },
});

export {};

import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import type { ProfilePatch, TabLayoutInput, TabLayout, RoiData, ThemeInput, ClientSettings, ClientSettingsPatch } from "./shared/schemas";
import type { FeatureFlags } from "./shared/featureFlags";
import type { PluginStateInfo, PluginManifest } from "./shared/pluginApi";

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
        throw new Error(result.error || "IPC call failed");
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
    sessionTabsGetOpenProfiles: () => unwrapIpc(ipcRenderer.invoke("sessionTabs:getOpenProfiles")),
    sessionWindowClose: () => unwrapIpc(ipcRenderer.invoke("sessionWindow:close")),
    overlaysHideForDialog: () => ipcRenderer.invoke("overlays:hideForDialog"),
    overlaysShowAfterDialog: () => ipcRenderer.invoke("overlays:showAfterDialog"),
    appQuit: () => unwrapIpc(ipcRenderer.invoke("app:quit")),
    appGetVersion: () => unwrapIpc<string>(ipcRenderer.invoke("app:getVersion")),
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
    onToast: (cb: (payload: { message: string; tone?: "info" | "success" | "error"; ttlMs?: number }) => void) => {
        const wrapped = (_e: IpcRendererEvent, payload: { message: string; tone?: "info" | "success" | "error"; ttlMs?: number }) => cb(payload);
        ipcRenderer.on("toast:show", wrapped);
        return () => ipcRenderer.removeListener("toast:show", wrapped);
    },
    // Logs
    logsGet: () => unwrapIpc<Array<{ ts: number; level: string; module: string; message: string }>>(ipcRenderer.invoke("logs:get")),
    logsClear: () => unwrapIpc<boolean>(ipcRenderer.invoke("logs:clear")),
    logsSave: () => unwrapIpc<string>(ipcRenderer.invoke("logs:save")),
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
    // Logs
    "logs:get",
    "logs:clear",
    "logs:save",
]);
const allowedOn = new Set<string>(["theme:update", "plugins:stateChanged", "toast:show", "logs:new"]);
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
            return () => undefined;
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
export {};

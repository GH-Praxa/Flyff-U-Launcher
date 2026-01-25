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
    openTab: (profileId: string) => unwrapIpc(ipcRenderer.invoke("session:openTab", profileId)),
    openWindow: (profileId: string) => unwrapIpc(ipcRenderer.invoke("instance:openWindow", profileId)),
    sessionTabsOpen: (profileId: string) => unwrapIpc(ipcRenderer.invoke("sessionTabs:open", profileId)),
    sessionTabsSwitch: (profileId: string) => unwrapIpc(ipcRenderer.invoke("sessionTabs:switch", profileId)),
    sessionTabsLogout: (profileId: string) => unwrapIpc(ipcRenderer.invoke("sessionTabs:logout", profileId)),
    sessionTabsLogin: (profileId: string) => unwrapIpc(ipcRenderer.invoke("sessionTabs:login", profileId)),
    sessionTabsClose: (profileId: string) => unwrapIpc(ipcRenderer.invoke("sessionTabs:close", profileId)),
    sessionTabsSetBounds: (bounds: Rect) => unwrapIpc(ipcRenderer.invoke("sessionTabs:setBounds", bounds)),
    sessionTabsSetVisible: (visible: boolean) => unwrapIpc(ipcRenderer.invoke("sessionTabs:setVisible", visible)),
    sessionTabsSetSplit: (pair: {
        primary: string;
        secondary: string;
        ratio?: number;
    } | null) => unwrapIpc(ipcRenderer.invoke("sessionTabs:setSplit", pair)),
    sessionTabsSetSplitRatio: (ratio: number) => unwrapIpc(ipcRenderer.invoke("sessionTabs:setSplitRatio", ratio)),
    sessionTabsReset: () => unwrapIpc(ipcRenderer.invoke("sessionTabs:reset")),
    sessionWindowClose: () => unwrapIpc(ipcRenderer.invoke("sessionWindow:close")),
    appQuit: () => unwrapIpc(ipcRenderer.invoke("app:quit")),
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
    onSessionActiveChanged: (cb: (profileId: string | null) => void) => {
        ipcRenderer.on("sessionTabs:activeChanged", (_e, profileId: string | null) => cb(profileId));
    },
    onSessionWindowCloseRequested: (cb: () => void) => {
        ipcRenderer.on("sessionWindow:closeRequested", () => cb());
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
    featuresGet: () => unwrapIpc(ipcRenderer.invoke("features:get")),
    featuresPatch: (patch: Partial<FeatureFlags>) => unwrapIpc(ipcRenderer.invoke("features:patch", patch)),
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
    pluginsGetSettingsUI: (pluginId: string) => unwrapIpc<{ url: string; width?: number; height?: number }>(ipcRenderer.invoke("plugins:getSettingsUI", pluginId)),
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
    "plugins:invokeChannel",
    "plugins:getSidepanelTabs",
    "plugins:getOverlayViews",
    "profiles:setOverlaySupportTarget",
]);
const allowedOn = new Set<string>(["theme:update", "plugins:stateChanged"]);
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

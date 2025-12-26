import { contextBridge, ipcRenderer } from "electron";

type Rect = { x: number; y: number; width: number; height: number };

contextBridge.exposeInMainWorld("api", {
  // -------- Profiles --------
  profilesList: () => ipcRenderer.invoke("profiles:list"),
  profilesCreate: (name: string) => ipcRenderer.invoke("profiles:create", name),
  profilesUpdate: (patch: any) => ipcRenderer.invoke("profiles:update", patch),
  profilesDelete: (profileId: string) => ipcRenderer.invoke("profiles:delete", profileId),
  profilesClone: (profileId: string, newName: string) => ipcRenderer.invoke("profiles:clone", profileId, newName),
  profilesReorder: (orderedIds: string[]) => ipcRenderer.invoke("profiles:reorder", orderedIds),

  // Overlay target
  profilesSetOverlayTarget: (profileId: string | null, iconKey?: string) =>
    ipcRenderer.invoke("profiles:setOverlayTarget", profileId, iconKey),

  // -------- Launcher ↔ Session/Instance --------
  openTab: (profileId: string) => ipcRenderer.invoke("session:openTab", profileId),
  openWindow: (profileId: string) => ipcRenderer.invoke("instance:openWindow", profileId),

  // -------- Session Tabs (Renderer Session UI) --------
  sessionTabsOpen: (profileId: string) => ipcRenderer.invoke("sessionTabs:open", profileId),
  sessionTabsSwitch: (profileId: string) => ipcRenderer.invoke("sessionTabs:switch", profileId),
  sessionTabsClose: (profileId: string) => ipcRenderer.invoke("sessionTabs:close", profileId),
  sessionTabsSetBounds: (bounds: Rect) => ipcRenderer.invoke("sessionTabs:setBounds", bounds),
  sessionTabsSetVisible: (visible: boolean) => ipcRenderer.invoke("sessionTabs:setVisible", visible),
  sessionTabsSetSplit: (pair: { primary: string; secondary: string; ratio?: number } | null) =>
    ipcRenderer.invoke("sessionTabs:setSplit", pair),
  sessionTabsSetSplitRatio: (ratio: number) => ipcRenderer.invoke("sessionTabs:setSplitRatio", ratio),
  sessionTabsReset: () => ipcRenderer.invoke("sessionTabs:reset"),

  // -------- Tab Layouts --------
  tabLayoutsList: () => ipcRenderer.invoke("tabLayouts:list"),
  tabLayoutsGet: (id: string) => ipcRenderer.invoke("tabLayouts:get", id),
  tabLayoutsSave: (input: any) => ipcRenderer.invoke("tabLayouts:save", input),
  tabLayoutsDelete: (id: string) => ipcRenderer.invoke("tabLayouts:delete", id),
  tabLayoutsApply: (id: string) => ipcRenderer.invoke("tabLayouts:apply", id),
  onApplyLayout: (cb: (layout: any) => void) => {
    ipcRenderer.on("session:applyLayout", (_e, layout) => cb(layout));
  },

  // Event: main ↔ session renderer
  onOpenTab: (cb: (profileId: string) => void) => {
    ipcRenderer.on("session:openTab", (_e, profileId: string) => cb(profileId));
  },

  onSessionActiveChanged: (cb: (profileId: string | null) => void) => {
    ipcRenderer.on("sessionTabs:activeChanged", (_e, profileId: string | null) => cb(profileId));
  },

  // -------- News feed --------
  fetchNewsPage: () => ipcRenderer.invoke("news:fetch"),
  fetchNewsArticle: (url: string) => ipcRenderer.invoke("news:fetchArticle", url),

  // -------- ROI --------
  roiOpen: (profileId: string) => ipcRenderer.invoke("roi:open", profileId),
  roiLoad: (profileId: string) => ipcRenderer.invoke("roi:load", profileId),
  roiSave: (profileId: string, rois: any) => ipcRenderer.invoke("roi:save", profileId, rois),
});

// Restrictive IPC bridge for overlay/sidepanel windows
const allowedSend = new Set<string>([
  "overlay:toggleEdit",
  "overlay:setBounds",
  "overlay:setSize",
  "hudpanel:toggle",
  "hudpanel:setWidth",
  "sidepanel:toggle",
  "hud:toggleEdit",
]);

const allowedInvoke = new Set<string>(["hud:getBounds", "roi:open", "profiles:getOverlayTargetId"]);
const allowedOn = new Set<string>(["overlay:edit", "exp:update", "hud:edit"]);

contextBridge.exposeInMainWorld("ipc", {
  send: (channel: string, payload?: any) => {
    if (!allowedSend.has(channel)) return;
    ipcRenderer.send(channel, payload);
  },
  invoke: (channel: string, ...args: any[]) => {
    if (!allowedInvoke.has(channel)) {
      return Promise.reject(new Error("blocked ipc channel"));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel: string, listener: (...args: any[]) => void) => {
    if (!allowedOn.has(channel)) return () => undefined;
    const wrapped = (_e: any, ...args: any[]) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
});

// ROI calibrator bridge: channel is passed via location hash
const roiChannel = (() => {
  try {
    const raw = decodeURIComponent(window.location.hash?.replace(/^#/, "") ?? "");
    if (raw && raw.startsWith("roi-calib:")) return raw;
  } catch {
    // ignore
  }
  return null;
})();

contextBridge.exposeInMainWorld("roiBridge", {
  channel: roiChannel,
  send: (payload: any) => {
    if (!roiChannel) return;
    ipcRenderer.send(roiChannel, payload);
  },
  sendDebug: (payload: any) => {
    if (!roiChannel) return;
    ipcRenderer.send(`${roiChannel}:debug`, payload);
  },
});

export {};

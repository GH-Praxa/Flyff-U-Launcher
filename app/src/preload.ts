import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  profilesList: () => ipcRenderer.invoke("profiles:list"),
  profilesCreate: (name: string) => ipcRenderer.invoke("profiles:create", name),
  profilesDelete: (id: string) => ipcRenderer.invoke("profiles:delete", id),

  profilesUpdate: (patch: { id: string; name?: string; job?: string; launchMode?: "tabs" | "window" }) =>
    ipcRenderer.invoke("profiles:update", patch),

  profilesReorder: (orderedIds: string[]) => ipcRenderer.invoke("profiles:reorder", orderedIds),

  // ✅ NEU: Clone
  profilesClone: (sourceId: string, name: string) =>
    ipcRenderer.invoke("profiles:clone", { sourceId, name }),

  openTab: (profileId: string) => ipcRenderer.invoke("open:tab", profileId),
  openWindow: (profileId: string) => ipcRenderer.invoke("open:window", profileId),
  openDefault: (profileId: string) => ipcRenderer.invoke("open:default", profileId),

  // Session Tabs (BrowserView)
  sessionTabsOpen: (profileId: string) => ipcRenderer.invoke("sessionTabs:open", profileId),
  sessionTabsSwitch: (profileId: string) => ipcRenderer.invoke("sessionTabs:switch", profileId),
  sessionTabsClose: (profileId: string) => ipcRenderer.invoke("sessionTabs:close", profileId),
  sessionTabsSetBounds: (b: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke("sessionTabs:setBounds", b),
  sessionTabsSetVisible: (visible: boolean) => ipcRenderer.invoke("sessionTabs:setVisible", visible),

  onOpenTab: (cb: (profileId: string) => void) => {
    ipcRenderer.on("session:openTab", (_e, profileId) => cb(profileId));
  },
});

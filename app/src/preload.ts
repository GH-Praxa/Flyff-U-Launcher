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

  // ✅ Overlay target
  profilesSetOverlayTarget: (profileId: string | null, iconKey?: string) =>
    ipcRenderer.invoke("profiles:setOverlayTarget", profileId, iconKey),

  // -------- Launcher → Session/Instance --------
  openTab: (profileId: string) => ipcRenderer.invoke("session:openTab", profileId),
  openWindow: (profileId: string) => ipcRenderer.invoke("instance:openWindow", profileId),

  // -------- Session Tabs (Renderer Session UI) --------
  sessionTabsOpen: (profileId: string) => ipcRenderer.invoke("sessionTabs:open", profileId),
  sessionTabsSwitch: (profileId: string) => ipcRenderer.invoke("sessionTabs:switch", profileId),
  sessionTabsClose: (profileId: string) => ipcRenderer.invoke("sessionTabs:close", profileId),
  sessionTabsSetBounds: (bounds: Rect) => ipcRenderer.invoke("sessionTabs:setBounds", bounds),
  sessionTabsSetVisible: (visible: boolean) => ipcRenderer.invoke("sessionTabs:setVisible", visible),

  // Event: main → session renderer
  onOpenTab: (cb: (profileId: string) => void) => {
    ipcRenderer.on("session:openTab", (_e, profileId: string) => cb(profileId));
  },

  // -------- ROI --------
  roiOpen: (profileId: string) => ipcRenderer.invoke("roi:open", profileId),
  roiLoad: (profileId: string) => ipcRenderer.invoke("roi:load", profileId),
  roiSave: (profileId: string, rois: any) => ipcRenderer.invoke("roi:save", profileId, rois),
});

export {};

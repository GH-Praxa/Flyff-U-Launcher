import { ipcMain } from "electron";

type Rect = { x: number; y: number; width: number; height: number };

type ProfilesStore = {
  list: () => Promise<any[]>;
  create: (name: string) => Promise<any[]>;
  update: (patch: any) => Promise<any[]>;
  delete: (profileId: string) => Promise<any[]>;
  clone: (profileId: string, newName: string) => Promise<any[]>;
  reorder: (orderedIds: string[]) => Promise<any[]>;
  getOverlayTargetId: () => Promise<string | null>;
  setOverlayTarget: (profileId: string | null, iconKey?: string) => Promise<any[]>;
  getOverlaySettings: (profileId: string) => Promise<any>;
  patchOverlaySettings: (profileId: string, patch: any) => Promise<any>;
};

type SessionWindowController = {
  ensure: () => Promise<any>; // BrowserWindow
  get: () => any | null;     // BrowserWindow | null
};

type SessionTabsManager = {
  open: (profileId: string) => Promise<void> | void;
  switchTo: (profileId: string) => Promise<void> | void;
  close: (profileId: string) => Promise<void> | void;
  setBounds: (bounds: Rect) => void;
  setVisible: (visible: boolean) => void;
};

export function registerMainIpc(opts: {
  profiles: ProfilesStore;
  sessionTabs: SessionTabsManager;
  sessionWindow: SessionWindowController;

  loadView?: any;

  createInstanceWindow: (profileId: string) => void;

  // wird genutzt um Overlay/Panel sofort nachzuführen
  overlayTargetRefresh?: () => Promise<any> | any;

  // ROI
  roiOpen: (profileId: string) => Promise<boolean>;
  roiLoad: (profileId: string) => Promise<any>;
  roiSave: (profileId: string, rois: any) => Promise<boolean>;
}) {
  // -------- Profiles --------
  ipcMain.handle("profiles:list", async () => {
    return await opts.profiles.list();
  });

  ipcMain.handle("profiles:create", async (_e, name: string) => {
    return await opts.profiles.create(name);
  });

  ipcMain.handle("profiles:update", async (_e, patch: any) => {
    return await opts.profiles.update(patch);
  });

  ipcMain.handle("profiles:delete", async (_e, profileId: string) => {
    return await opts.profiles.delete(profileId);
  });

  ipcMain.handle("profiles:clone", async (_e, profileId: string, newName: string) => {
    return await opts.profiles.clone(profileId, newName);
  });

  ipcMain.handle("profiles:reorder", async (_e, orderedIds: string[]) => {
    return await opts.profiles.reorder(orderedIds);
  });

  ipcMain.handle("profiles:setOverlayTarget", async (_e, profileId: string | null, iconKey?: string) => {
    const next = await opts.profiles.setOverlayTarget(profileId, iconKey);
    try {
      await opts.overlayTargetRefresh?.();
    } catch (err) {
      console.error("[IPC] overlayTargetRefresh failed:", err);
    }
    return next;
  });

  // ✅ neu: Overlay-Settings laden
  ipcMain.handle("overlaySettings:get", async (_e, profileId: string) => {
    return await opts.profiles.getOverlaySettings(profileId);
  });

  // ✅ neu: Overlay-Settings patchen
  ipcMain.handle("overlaySettings:patch", async (_e, profileId: string, patch: any) => {
    const next = await opts.profiles.patchOverlaySettings(profileId, patch);
    // optional: Overlay sofort updaten (falls du später Settings im Overlay nutzt)
    try {
      await opts.overlayTargetRefresh?.();
    } catch {}
    return next;
  });

  // -------- Launcher → Session/Instance --------
  ipcMain.handle("session:openTab", async (_e, profileId: string) => {
    const win = await opts.sessionWindow.ensure();
    win.show();
    win.focus();

    await opts.sessionTabs.open(profileId);

    try {
      win.webContents.send("session:openTab", profileId);
    } catch {}

    return true;
  });

  ipcMain.handle("instance:openWindow", async (_e, profileId: string) => {
    opts.createInstanceWindow(profileId);
    return true;
  });

  // -------- Session Tabs (Session Renderer) --------
  ipcMain.handle("sessionTabs:open", async (_e, profileId: string) => {
    await opts.sessionTabs.open(profileId);
    return true;
  });

  ipcMain.handle("sessionTabs:switch", async (_e, profileId: string) => {
    await opts.sessionTabs.switchTo(profileId);
    return true;
  });

  ipcMain.handle("sessionTabs:close", async (_e, profileId: string) => {
    await opts.sessionTabs.close(profileId);
    return true;
  });

  ipcMain.handle("sessionTabs:setBounds", async (_e, bounds: Rect) => {
    opts.sessionTabs.setBounds(bounds);
    return true;
  });

  ipcMain.handle("sessionTabs:setVisible", async (_e, visible: boolean) => {
    opts.sessionTabs.setVisible(visible);
    return true;
  });

  // -------- ROI --------
  ipcMain.handle("roi:open", async (_e, profileId: string) => {
    return await opts.roiOpen(profileId);
  });

  ipcMain.handle("roi:load", async (_e, profileId: string) => {
    return await opts.roiLoad(profileId);
  });

  ipcMain.handle("roi:save", async (_e, a: any, b?: any) => {
    // akzeptiert:
    // 1) invoke("roi:save", profileId, rois)
    // 2) invoke("roi:save", { profileId, rois })
    let profileId: string;
    let rois: any;

    if (a && typeof a === "object" && typeof a.profileId === "string" && a.rois && b === undefined) {
      profileId = a.profileId;
      rois = a.rois;
    } else {
      profileId = a as string;
      rois = b;
    }

    console.log("[ROI SAVE] profileId =", profileId, "payload =", rois);

    const actual = rois?.rois ?? rois;
    if (!actual?.nameLevel || !actual?.expPercent) {
      throw new Error(`[ROI SAVE] invalid payload for ${profileId}: ${JSON.stringify(rois)}`);
    }

    return await opts.roiSave(profileId, actual);
  });
}

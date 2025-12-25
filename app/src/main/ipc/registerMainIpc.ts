import { ipcMain } from "electron";
import https from "https";

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
  ensure: () => Promise<any>;
  get: () => any | null;
};

type SessionTabsManager = {
  open: (profileId: string) => Promise<void> | void;
  switchTo: (profileId: string) => Promise<void> | void;
  close: (profileId: string) => Promise<void> | void;
  setBounds: (bounds: Rect) => void;
  setVisible: (visible: boolean) => void;
  setSplit: (pair: { primary: string; secondary: string; ratio?: number } | null) => Promise<void> | void;
  setSplitRatio: (ratio: number) => Promise<void> | void;
};

export function registerMainIpc(opts: {
  profiles: ProfilesStore;
  sessionTabs: SessionTabsManager;
  sessionWindow: SessionWindowController;

  loadView?: any;

  createInstanceWindow: (profileId: string) => void;

  overlayTargetRefresh?: () => Promise<any> | any;

  roiOpen: (profileId: string) => Promise<boolean>;
  roiLoad: (profileId: string) => Promise<any>;
  roiSave: (profileId: string, rois: any) => Promise<boolean>;
}) {
  function safeHandle(channel: string, handler: any) {
    try {
      ipcMain.removeHandler(channel);
    } catch {}
    ipcMain.handle(channel, handler);
  }

  // -------- Profiles --------
  safeHandle("profiles:list", async () => await opts.profiles.list());
  safeHandle("profiles:create", async (_e, name: string) => await opts.profiles.create(name));
  safeHandle("profiles:update", async (_e, patch: any) => await opts.profiles.update(patch));
  safeHandle("profiles:delete", async (_e, profileId: string) => await opts.profiles.delete(profileId));
  safeHandle("profiles:clone", async (_e, profileId: string, newName: string) => await opts.profiles.clone(profileId, newName));
  safeHandle("profiles:reorder", async (_e, orderedIds: string[]) => await opts.profiles.reorder(orderedIds));

  safeHandle("profiles:getOverlayTargetId", async () => {
    return await opts.profiles.getOverlayTargetId();
  });

  safeHandle("profiles:setOverlayTarget", async (_e, profileId: string | null, iconKey?: string) => {
    const next = await opts.profiles.setOverlayTarget(profileId, iconKey);
    try {
      await opts.overlayTargetRefresh?.();
    } catch (err) {
      console.error("[IPC] overlayTargetRefresh failed:", err);
    }
    return next;
  });

  // optional (wenn dein Renderer das nutzt)
  safeHandle("overlaySettings:get", async (_e, profileId: string) => {
    return await opts.profiles.getOverlaySettings(profileId);
  });

  safeHandle("overlaySettings:patch", async (_e, profileId: string, patch: any) => {
    const next = await opts.profiles.patchOverlaySettings(profileId, patch);
    try {
      await opts.overlayTargetRefresh?.();
    } catch {}
    return next;
  });

  // -------- Launcher → Session/Instance --------
  safeHandle("session:openTab", async (_e, profileId: string) => {
    const win = await opts.sessionWindow.ensure();
    win.show();
    win.focus();
    await opts.sessionTabs.open(profileId);
    try {
      win.webContents.send("session:openTab", profileId);
    } catch {}
    return true;
  });

  safeHandle("instance:openWindow", async (_e, profileId: string) => {
    opts.createInstanceWindow(profileId);
    return true;
  });

  // -------- Session Tabs (Session Renderer) --------
  safeHandle("sessionTabs:open", async (_e, profileId: string) => {
    await opts.sessionTabs.open(profileId);
    return true;
  });

  safeHandle("sessionTabs:switch", async (_e, profileId: string) => {
    await opts.sessionTabs.switchTo(profileId);
    return true;
  });

  safeHandle("sessionTabs:close", async (_e, profileId: string) => {
    await opts.sessionTabs.close(profileId);
    return true;
  });

  safeHandle("sessionTabs:setBounds", async (_e, bounds: Rect) => {
    opts.sessionTabs.setBounds(bounds);
    return true;
  });

  safeHandle("sessionTabs:setVisible", async (_e, visible: boolean) => {
    opts.sessionTabs.setVisible(visible);
    return true;
  });

  safeHandle("sessionTabs:setSplit", async (_e, pair: { primary: string; secondary: string; ratio?: number } | null) => {
    await opts.sessionTabs.setSplit(pair);
    return true;
  });

  safeHandle("sessionTabs:setSplitRatio", async (_e, ratio: number) => {
    await opts.sessionTabs.setSplitRatio(ratio);
    return true;
  });

  async function fetchWithFallback(url: string) {
    const headers = { "User-Agent": "FlyffU-Launcher" };

    try {
      if (typeof fetch === "function") {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timer);

        if (!res.ok) {
          throw new Error(`status ${res.status}`);
        }

        return await res.text();
      }
    } catch (err) {
      console.warn("[news:fetch] fetch failed, fallback to https:", err);
    }

    return await new Promise<string>((resolve, reject) => {
      const req = https.get(url, { headers }, (res) => {
        if ((res.statusCode ?? 0) >= 400) {
          reject(new Error(`status ${res.statusCode}`));
          res.resume();
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      });

      req.on("error", reject);
      req.setTimeout(10000, () => req.destroy(new Error("timeout")));
    });
  }

  // -------- News feed (no CORS in renderer) --------
  safeHandle("news:fetch", async () => {
    const url = "https://universe.flyff.com/news";
    return await fetchWithFallback(url);
  });

  safeHandle("news:fetchArticle", async (_e, rawUrl: string) => {
    if (!rawUrl || typeof rawUrl !== "string") throw new Error("invalid url");

    let target: URL;
    try {
      target = new URL(rawUrl, "https://universe.flyff.com");
    } catch {
      throw new Error("invalid url");
    }

    if (target.hostname !== "universe.flyff.com") {
      throw new Error("blocked host");
    }
    if (!target.pathname.startsWith("/news")) {
      throw new Error("blocked path");
    }

    return await fetchWithFallback(target.toString());
  });

  // -------- ROI --------
  safeHandle("roi:open", async (_e, arg) => {
    const profileId = typeof arg === "string" ? arg : arg?.profileId;
    if (!profileId) throw new Error("roi:open: missing profileId");
    return await opts.roiOpen(profileId);
  });

  safeHandle("roi:load", async (_e, profileId: string) => {
    return await opts.roiLoad(profileId);
  });

  safeHandle("roi:save", async (_e, a: any, b?: any) => {
    let profileId: string;
    let rois: any;

    if (a && typeof a === "object" && typeof a.profileId === "string" && a.rois && b === undefined) {
      profileId = a.profileId;
      rois = a.rois;
    } else {
      profileId = a as string;
      rois = b;
    }

    const actual = rois?.rois ?? rois;
    if (!actual?.nameLevel || !actual?.expPercent) {
      throw new Error(`[ROI SAVE] invalid payload for ${profileId}: ${JSON.stringify(rois)}`);
    }

    return await opts.roiSave(profileId, actual);
  });
}

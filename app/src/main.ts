import { app, BrowserWindow, BrowserView, ipcMain, session } from "electron";
import path from "path";
import fs from "fs/promises";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

type LaunchMode = "tabs" | "window";

type Profile = {
  id: string;
  name: string;
  createdAt: string;
  job?: string;
  launchMode: LaunchMode;
};

let launcherWindow: BrowserWindow | null = null;
let sessionWindow: BrowserWindow | null = null;

type ViewBounds = { x: number; y: number; width: number; height: number };

const sessionViews = new Map<string, BrowserView>();
let sessionActiveId: string | null = null;
let sessionVisible = true;
let sessionBounds: ViewBounds = { x: 0, y: 60, width: 1200, height: 700 };

function hardenGameContents(wc: any) {
  // Keine Popups
  wc.setWindowOpenHandler(() => ({ action: "deny" }));
}

function applyActiveBrowserView() {
  if (!sessionWindow || sessionWindow.isDestroyed()) return;

  // Alles entfernen
  for (const v of sessionWindow.getBrowserViews()) {
    try {
      sessionWindow.removeBrowserView(v);
    } catch {}
  }

  if (!sessionVisible) return;
  if (!sessionActiveId) return;

  const view = sessionViews.get(sessionActiveId);
  if (!view) return;

  sessionWindow.addBrowserView(view);
  view.setBounds(sessionBounds);
  view.setAutoResize({ width: true, height: true });
}

function destroySessionView(profileId: string) {
  const view = sessionViews.get(profileId);
  if (!view) return;

  if (sessionWindow && !sessionWindow.isDestroyed()) {
    try {
      sessionWindow.removeBrowserView(view);
    } catch {}
  }

  try {
    view.webContents.destroy();
  } catch {}

  sessionViews.delete(profileId);
  if (sessionActiveId === profileId) sessionActiveId = null;
}

const FLYFF_URL = "https://universe.flyff.com/play";

// ---------------- Utils ----------------
function id() {
  return Math.random().toString(36).slice(2, 10);
}

function profilesPath() {
  return path.join(app.getPath("userData"), "profiles.json");
}

async function readProfiles(): Promise<Profile[]> {
  try {
    const raw = await fs.readFile(profilesPath(), "utf-8");
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [];

    // Defaults / Migration
    return list.map((p: any) => ({
      id: String(p.id),
      name: String(p.name ?? "Unnamed"),
      createdAt: String(p.createdAt ?? new Date().toISOString()),
      job: typeof p.job === "string" ? p.job : "",
      launchMode: (p.launchMode === "window" || p.launchMode === "tabs") ? p.launchMode : "tabs",
    }));
  } catch {
    return [];
  }
}

async function writeProfiles(profiles: Profile[]) {
  await fs.writeFile(profilesPath(), JSON.stringify(profiles, null, 2), "utf-8");
}

// Clone helper: Storage/Cookies vom alten Profil ins neue kopieren (best effort)
async function cloneProfileStorageAndCookies(sourceId: string, newId: string) {
  const src = session.fromPartition(`persist:${sourceId}`);
  const dst = session.fromPartition(`persist:${newId}`);

  // Cookies klonen
  try {
    const cookies = await src.cookies.get({});
    for (const c of cookies) {
      const url =
        (c.secure ? "https://" : "http://") +
        (c.domain.startsWith(".") ? c.domain.slice(1) : c.domain) +
        (c.path || "/");
      await dst.cookies.set({
        url,
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
        expirationDate: c.expirationDate,
      });
    }
  } catch {}

  // LocalStorage etc.: leider nicht sauber ohne DevTools Protocol / custom pipeline
  // -> wir lassen es weg (best effort), Cookies reichen oft fürs Login.
}

// ---------------- Window creation ----------------

// Optional: Webview härten (Whitelist) – bleibt drin, aber Tabs nutzen jetzt BrowserView (kein <webview> nötig)
function hardenWebviews(win: BrowserWindow) {
  win.webContents.on("will-attach-webview", (event, webPreferences, params) => {
    const src = params.src || "";
    const allowed =
      src === "" ||
      src === "about:blank" ||
      src.startsWith("https://universe.flyff.com/");

    if (!allowed) event.preventDefault();

    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;

    // keine fremden preloads erlauben
    // @ts-ignore
    delete webPreferences.preload;
    // @ts-ignore
    delete webPreferences.preloadURL;
  });
}

function createLauncherWindow() {
  launcherWindow = new BrowserWindow({
    width: 980,
    height: 640,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  hardenWebviews(launcherWindow);
  loadView(launcherWindow, "launcher").catch(console.error);
  launcherWindow.on("closed", () => (launcherWindow = null));
}

async function ensureSessionWindow() {
  if (sessionWindow && !sessionWindow.isDestroyed()) return sessionWindow;

  sessionWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  sessionWindow.setMenuBarVisibility(false);
  sessionWindow.setAutoHideMenuBar(true);
  await loadView(sessionWindow, "session");
  sessionWindow.on("closed", () => {
    for (const id of [...sessionViews.keys()]) destroySessionView(id);
    sessionViews.clear();
    sessionActiveId = null;
    sessionWindow = null;
  });
  return sessionWindow;
}

function createInstanceWindow(profileId: string) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      partition: `persist:${profileId}`, // pro Profil eigene Cookies/Session
    },
  });

  win.loadURL(FLYFF_URL).catch(console.error);
  win.setMenuBarVisibility(false);
  win.setAutoHideMenuBar(true);

  return win;
}

// ---------------- View loader ----------------
async function loadView(win: BrowserWindow, view: string, params: Record<string, string> = {}) {
  const sp = new URLSearchParams({ view, ...params }).toString();

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await win.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}?${sp}`);
  } else {
    await win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), {
      query: Object.fromEntries(new URLSearchParams(sp)),
    });
  }
}

// ---------------- App lifecycle ----------------
app.whenReady().then(() => {
  createLauncherWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createLauncherWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ---------------- IPC: Profiles ----------------
ipcMain.handle("profiles:list", async () => readProfiles());

ipcMain.handle("profiles:create", async (_e, name: string) => {
  const profiles = await readProfiles();
  const p: Profile = {
    id: id(),
    name,
    createdAt: new Date().toISOString(),
    job: "",
    launchMode: "tabs",
  };
  profiles.push(p);
  await writeProfiles(profiles);
  return p;
});

ipcMain.handle("profiles:delete", async (_e, profileId: string) => {
  const profiles = await readProfiles();
  await writeProfiles(profiles.filter((p) => p.id !== profileId));
  return true;
});

ipcMain.handle(
  "profiles:update",
  async (_e, patch: { id: string; name?: string; job?: string; launchMode?: "tabs" | "window" }) => {
    const profiles = await readProfiles();
    const idx = profiles.findIndex((p) => p.id === patch.id);
    if (idx < 0) throw new Error("Profile not found");

    const p = profiles[idx];
    profiles[idx] = {
      ...p,
      name: typeof patch.name === "string" ? patch.name : p.name,
      job: typeof patch.job === "string" ? patch.job : p.job,
      launchMode: patch.launchMode ?? p.launchMode,
    };

    await writeProfiles(profiles);
    return profiles[idx];
  }
);

ipcMain.handle("profiles:reorder", async (_e, orderedIds: string[]) => {
  const profiles = await readProfiles();

  const byId = new Map(profiles.map((p) => [p.id, p]));
  const next: Profile[] = [];

  // in gewünschter Reihenfolge übernehmen
  for (const id of orderedIds) {
    const p = byId.get(id);
    if (p) next.push(p);
  }
  // alle restlichen hinten anhängen
  for (const p of profiles) {
    if (!orderedIds.includes(p.id)) next.push(p);
  }

  await writeProfiles(next);
  return true;
});

ipcMain.handle("profiles:clone", async (_e, payload: { sourceId: string; name: string }) => {
  const { sourceId, name } = payload;
  const profiles = await readProfiles();
  const src = profiles.find((p) => p.id === sourceId);
  if (!src) throw new Error("Source profile not found");

  const newId = id();

  // Storage + Cookies klonen (best effort)
  await cloneProfileStorageAndCookies(sourceId, newId);

  const clone: Profile = {
    id: newId,
    name: String(name ?? "").trim() || `${src.name} (Copy)`,
    createdAt: new Date().toISOString(),
    job: src.job ?? "",
    launchMode: src.launchMode ?? "tabs",
  };

  // direkt nach dem Original einfügen
  const srcIdx = profiles.findIndex((p) => p.id === sourceId);
  const next = [...profiles];
  next.splice(Math.max(0, srcIdx + 1), 0, clone);

  await writeProfiles(next);
  return clone;
});

// ---------------- IPC: Open ----------------
ipcMain.handle("open:tab", async (_e, profileId: string) => {
  const existed = !!(sessionWindow && !sessionWindow.isDestroyed());

  const win = await ensureSessionWindow();

  // wenn Session-Fenster neu ist / gerade lädt: Query-Param statt send
  if (!existed || win.webContents.isLoading()) {
    await loadView(win, "session", { openProfileId: profileId });
  } else {
    win.webContents.send("session:openTab", profileId);
  }

  win.show();
  win.focus();
  return true;
});

ipcMain.handle("open:window", async (_e, profileId: string) => {
  createInstanceWindow(profileId);
  return true;
});

ipcMain.handle("open:default", async (_e, profileId: string) => {
  const profiles = await readProfiles();
  const p = profiles.find((x) => x.id === profileId);
  const mode = p?.launchMode ?? "tabs";

  if (mode === "window") {
    createInstanceWindow(profileId);
    return true;
  }

  const existed = !!(sessionWindow && !sessionWindow.isDestroyed());
  const win = await ensureSessionWindow();

  if (!existed || win.webContents.isLoading()) {
    await loadView(win, "session", { openProfileId: profileId });
  } else {
    win.webContents.send("session:openTab", profileId);
  }

  win.show();
  win.focus();
  return true;
});

// ---------------- IPC: Session Tabs (BrowserView) ----------------
ipcMain.handle("sessionTabs:setBounds", async (_e, b: ViewBounds) => {
  sessionBounds = b;
  applyActiveBrowserView();
  return true;
});

ipcMain.handle("sessionTabs:setVisible", async (_e, visible: boolean) => {
  sessionVisible = !!visible;
  applyActiveBrowserView();
  return true;
});

ipcMain.handle("sessionTabs:open", async (_e, profileId: string) => {
  const win = await ensureSessionWindow();

  if (!sessionViews.has(profileId)) {
    const view = new BrowserView({
      webPreferences: {
        partition: `persist:${profileId}`,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    hardenGameContents(view.webContents);
    sessionViews.set(profileId, view);

    // Erst "leer", dann URL (Unity/WebGL mag das oft lieber)
    view.webContents.loadURL("about:blank").catch(() => {});
    view.webContents.loadURL(FLYFF_URL).catch(console.error);
  }

  sessionActiveId = profileId;
  applyActiveBrowserView();

  win.show();
  win.focus();
  return true;
});

ipcMain.handle("sessionTabs:switch", async (_e, profileId: string) => {
  sessionActiveId = profileId;
  applyActiveBrowserView();
  return true;
});

ipcMain.handle("sessionTabs:close", async (_e, profileId: string) => {
  destroySessionView(profileId);
  applyActiveBrowserView();
  return true;
});

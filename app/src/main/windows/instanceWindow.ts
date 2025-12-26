import { BrowserWindow } from "electron";
import { hardenGameContents } from "../security/harden";

export function createInstanceWindow(profileId: string, opts: { flyffUrl: string }): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    title: `Flyff - ${profileId}`,
    webPreferences: {
      // Wichtig: eigenes persistentes Profil
      partition: `persist:${profileId}`,

      // Security / sane defaults
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,

      // Wenn du später im Game-Window IPC brauchst: preload setzen.
      // preload: path.join(__dirname, "preload.js"),
    },
  });

  // optional: falls du auf Windows bessere GPU/Rendering willst
  // win.setBackgroundColor("#000000");

  hardenGameContents(win.webContents);

  // Unity/WebGL ist oft stabiler mit about:blank “warmup”
  win.webContents.loadURL("about:blank").catch((err) => console.error("[InstanceWindow] load failed", err));
  win.webContents.loadURL(opts.flyffUrl).catch(console.error);

  win.once("ready-to-show", () => {
    if (!win.isDestroyed()) win.show();
  });

  // Optional: Debug
  // win.webContents.on("console-message", (_e, level, message) => console.log("[GAME]", level, message));

  return win;
}

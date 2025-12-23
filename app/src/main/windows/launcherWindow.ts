import { BrowserWindow } from "electron";
import path from "path";
import { hardenWebviews } from "../security/harden";
import type { LoadView } from "../viewLoader";

export function createLauncherWindow(opts: {
  preloadPath: string;
  loadView: LoadView;
  onClosed?: () => void;
}) {
  const win = new BrowserWindow({
    width: 980,
    height: 640,
    webPreferences: {
      preload: opts.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  hardenWebviews(win);
  opts.loadView(win, "launcher").catch(console.error);

  win.on("closed", () => opts.onClosed?.());

  return win;
}

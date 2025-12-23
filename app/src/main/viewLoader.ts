import type { BrowserWindow } from "electron";
import path from "path";

export type LoadView = (win: BrowserWindow, view: string, params?: Record<string, string>) => Promise<void>;

export function createViewLoader(opts: {
  devServerUrl?: string;
  rendererName: string;
  baseDir: string;
}): LoadView {
  const { devServerUrl, rendererName, baseDir } = opts;

  return async (win, view, params = {}) => {
    const sp = new URLSearchParams({ view, ...params }).toString();

    if (devServerUrl) {
      await win.loadURL(`${devServerUrl}?${sp}`);
    } else {
      await win.loadFile(path.join(baseDir, `../renderer/${rendererName}/index.html`), {
        query: Object.fromEntries(new URLSearchParams(sp)),
      });
    }
  };
}

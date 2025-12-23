import type { BrowserWindow } from "electron";

export function createInstanceRegistry() {
  const map = new Map<string, BrowserWindow>();

  function register(profileId: string, win: BrowserWindow) {
    map.set(profileId, win);

    win.on("closed", () => {
      if (map.get(profileId) === win) map.delete(profileId);
    });
  }

  function get(profileId: string): BrowserWindow | null {
    const w = map.get(profileId);
    if (!w || w.isDestroyed()) return null;
    return w;
  }

  return { register, get };
}

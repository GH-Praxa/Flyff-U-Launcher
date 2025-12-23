import { BrowserView } from "electron";
import type { ViewBounds } from "../../shared/types";
import { hardenGameContents } from "../security/harden";
import type { SessionWindowController } from "../windows/sessionWindow";

export function createSessionTabsManager(opts: {
  sessionWindow: Pick<SessionWindowController, "ensure" | "get">;
  flyffUrl: string;
}) {
  const sessionViews = new Map<string, BrowserView>();
  let sessionActiveId: string | null = null;
  let sessionVisible = true;
  let sessionBounds: ViewBounds = { x: 0, y: 60, width: 1200, height: 700 };

  function applyActiveBrowserView() {
    const win = opts.sessionWindow.get();
    if (!win) return;

    for (const v of win.getBrowserViews()) {
      try {
        win.removeBrowserView(v);
      } catch {}
    }

    if (!sessionVisible) return;
    if (!sessionActiveId) return;

    const view = sessionViews.get(sessionActiveId);
    if (!view) return;

    win.addBrowserView(view);
    view.setBounds(sessionBounds);
    view.setAutoResize({ width: true, height: true });
  }

  function destroySessionView(profileId: string) {
    const view = sessionViews.get(profileId);
    if (!view) return;

    const win = opts.sessionWindow.get();
    if (win) {
      try {
        win.removeBrowserView(view);
      } catch {}
    }

    try {
      view.webContents.destroy();
    } catch {}

    sessionViews.delete(profileId);
    if (sessionActiveId === profileId) sessionActiveId = null;
  }

  async function open(profileId: string) {
    const win = await opts.sessionWindow.ensure();

    if (!sessionViews.has(profileId)) {
      const view = new BrowserView({
        webPreferences: {
          partition: `persist:${profileId}`,
          contextIsolation: true,
          nodeIntegration: false,
          // backgroundThrottling: false,
        },
      });

      hardenGameContents(view.webContents);
      sessionViews.set(profileId, view);

      view.webContents.loadURL("about:blank").catch(() => {});
      view.webContents.loadURL(opts.flyffUrl).catch(console.error);
    }

    sessionActiveId = profileId;
    applyActiveBrowserView();

    win.show();
    win.focus();

    return true;
  }

  function switchTo(profileId: string) {
    sessionActiveId = profileId;
    applyActiveBrowserView();
    return true;
  }

  function close(profileId: string) {
    destroySessionView(profileId);
    applyActiveBrowserView();
    return true;
  }

  function setBounds(b: ViewBounds) {
    sessionBounds = b;
    applyActiveBrowserView();
    return true;
  }

  function setVisible(visible: boolean) {
    sessionVisible = !!visible;
    applyActiveBrowserView();
    return true;
  }

  function reset() {
    for (const id of [...sessionViews.keys()]) destroySessionView(id);
    sessionViews.clear();
    sessionActiveId = null;
  }

  function getActiveView(): BrowserView | null {
    if (!sessionActiveId) return null;
    return sessionViews.get(sessionActiveId) ?? null;
  }

  function getViewByProfile(profileId: string): BrowserView | null {
    return sessionViews.get(profileId) ?? null;
  }

  function getActiveId(): string | null {
    return sessionActiveId;
  }

  function isActive(profileId: string): boolean {
    return sessionActiveId === profileId;
  }

  // ✅ NEU: Bounds der View (für ROI Calibrator Position)
  function getBounds(): ViewBounds {
    return sessionBounds;
  }

  return {
    open,
    switchTo,
    close,
    setBounds,
    setVisible,
    reset,
    getActiveView,
    getViewByProfile,
    getActiveId,
    isActive,
    getBounds,
  };
}

export type SessionTabsManager = ReturnType<typeof createSessionTabsManager>;

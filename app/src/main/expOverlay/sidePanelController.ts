import { BrowserWindow, BrowserView, Rectangle, ipcMain } from "electron";
import { createOverlayButtonWindow } from "../windows/overlayButtonWindow";
import { createSidePanelWindow } from "../windows/sidePanelWindow";

type TargetCtx =
  | { mode: "instance"; parent: BrowserWindow; rect: Rectangle }
  | { mode: "tabs"; parent: BrowserWindow; rect: Rectangle; view: BrowserView };

function sameRect(a: Rectangle, b: Rectangle) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
 }
export function createSidePanelController(opts: {
  profiles: { getOverlayTargetId: () => Promise<string | null> };

  sessionWindow: { get: () => BrowserWindow | null };
  sessionTabs: {
    getViewByProfile: (profileId: string) => BrowserView | null;
    isActive: (profileId: string) => boolean;
    getBounds: (profileId?: string) => Rectangle;
  };

  instances: { get: (profileId: string) => BrowserWindow | null };

  preloadPath: string;
  panelWidth?: number;
  followIntervalMs?: number;
}) {
  const panelWidth = opts.panelWidth ?? 420;
  const followIntervalMs = opts.followIntervalMs ?? 80;

  let targetId: string | null = null;

  let btnWin: BrowserWindow | null = null;
  let panelWin: BrowserWindow | null = null;
  let panelOpen = false;

  // Panel state
  let panelProfileId: string | null = null;
  let followTimer: NodeJS.Timeout | null = null;
  let followParentId: number | null = null;
  let parentEventCleanup: (() => void) | null = null;
  let lastCtxRect: Rectangle | null = null;
  let buttonVisible = false;

  const logErr = (err: unknown) => console.error("[SidePanel]", err);

  const onToggle = () => toggle();
  ipcMain.on("sidepanel:toggle", onToggle);
  ipcMain.on("hudpanel:toggle", onToggle);

  function computeCtx(): TargetCtx | null {
    if (!targetId) return null;

    const inst = opts.instances.get(targetId);
    if (inst && !inst.isDestroyed()) {
      const b = inst.getContentBounds();
      return { mode: "instance", parent: inst, rect: { x: b.x, y: b.y, width: b.width, height: b.height } };
    }

    if (!opts.sessionTabs.isActive(targetId)) return null;

    const win = opts.sessionWindow.get();
    if (!win || win.isDestroyed()) return null;

    const view = opts.sessionTabs.getViewByProfile(targetId);
    if (!view || view.webContents.isDestroyed()) return null;

    const cb = win.getContentBounds();
    const vb = opts.sessionTabs.getBounds(targetId);

    const rect = {
      x: cb.x + vb.x,
      y: cb.y + vb.y,
      width: vb.width,
      height: vb.height,
    };

    return { mode: "tabs", parent: win, rect, view };
  }

  function isParentActive(win: BrowserWindow) {
    try {
      const focused = BrowserWindow.getFocusedWindow();
      if (!focused) return false;
      let cur: BrowserWindow | null = focused;
      while (cur) {
        if (cur.id === win.id) return true;
        cur = cur.getParentWindow?.() ?? null;
      }
      return false;
    } catch {
      return false;
    }
  }

  function attachParentEvents(win: BrowserWindow) {
    const pid = win.id;
    if (parentEventCleanup && followParentId === pid) return;

    if (parentEventCleanup) {
      try {
        parentEventCleanup();
      } catch (err) { logErr(err); }
      parentEventCleanup = null;
    }

    const onMove = () => sync();
    const onResize = () => sync();
    const onFocus = () => sync();
    const onBlur = () => sync();
    const onShow = () => sync();
    const onHide = () => sync();
    const onMinimize = () => sync();
    const onRestore = () => sync();

    win.on("move", onMove);
    win.on("resize", onResize);
    win.on("focus", onFocus);
    win.on("blur", onBlur);
    win.on("show", onShow);
    win.on("hide", onHide);
    win.on("minimize", onMinimize);
    win.on("restore", onRestore);

    parentEventCleanup = () => {
      win.removeListener("move", onMove);
      win.removeListener("resize", onResize);
      win.removeListener("focus", onFocus);
      win.removeListener("blur", onBlur);
      win.removeListener("show", onShow);
      win.removeListener("hide", onHide);
      win.removeListener("minimize", onMinimize);
      win.removeListener("restore", onRestore);
    };
    followParentId = pid;
  }

  function ensureButton(ctx: TargetCtx) {
    if (btnWin && btnWin.isDestroyed()) btnWin = null;

    if (btnWin) {
      try {
        btnWin.show();
        btnWin.setIgnoreMouseEvents(false);
        buttonVisible = true;
      } catch (err) { logErr(err); }
      return;
    }

    if (!btnWin) {
      btnWin = createOverlayButtonWindow({ parent: ctx.parent, preloadPath: opts.preloadPath });
      btnWin.on("closed", () => {
        btnWin = null;
      });
      buttonVisible = true;
    }
  }

  function hideButton() {
    if (btnWin && !btnWin.isDestroyed()) {
      try {
        btnWin.hide();
        buttonVisible = false;
      } catch (err) { logErr(err); }
    }
  }

  function positionButton(ctx: TargetCtx) {
    if (!btnWin || btnWin.isDestroyed()) return;

    const size = 36;
    const margin = 10;

    const bx = Math.max(ctx.rect.x + 4, ctx.rect.x + ctx.rect.width - size - margin);
    const by = Math.max(ctx.rect.y + 4, ctx.rect.y + margin);

    const r = { x: bx, y: by, width: size, height: size };
    try {
      btnWin.setBounds(r, false);
    } catch (err) { logErr(err); }
  }

  function ensurePanel(ctx: TargetCtx) {
    if (panelWin && panelWin.isDestroyed()) {
      panelWin = null;
      panelProfileId = null;
    }

    // âœ… wenn das Panel existiert, aber fÃ¼r ein anderes Profil ist -> neu
    if (panelWin && panelProfileId && panelProfileId !== (targetId ?? "")) {
      try {
        panelWin.close();
      } catch (err) { logErr(err); }
      panelWin = null;
      panelProfileId = null;
    }

    if (!panelWin) {
      panelProfileId = targetId ?? "";
      panelWin = createSidePanelWindow(ctx.parent, { preloadPath: opts.preloadPath });

      panelWin.on("closed", () => {
        panelWin = null;
        panelProfileId = null;
        panelOpen = false;
      });
    }
  }

  function positionPanel(ctx: TargetCtx) {
    if (!panelWin || panelWin.isDestroyed()) return;

    const w = Math.min(panelWidth, Math.max(260, ctx.rect.width - 40));
    const r = {
      x: ctx.rect.x + ctx.rect.width - w,
      y: ctx.rect.y,
      width: w,
      height: ctx.rect.height,
    };

    try {
      panelWin.setBounds(r, false);
    } catch (err) { logErr(err); }
  }

  function closePanel() {
    if (panelWin && !panelWin.isDestroyed()) {
      try {
        panelWin.close();
      } catch (err) { logErr(err); }
    }
    panelWin = null;
    panelProfileId = null;
    panelOpen = false;
  }

  function closeButton() {
    if (btnWin && !btnWin.isDestroyed()) {
      try {
        btnWin.close();
      } catch (err) { logErr(err); }
    }
    btnWin = null;
  }

  function sync() {
    const ctx = computeCtx();

    if (!ctx) {
      lastCtxRect = null;
      closePanel();
      closeButton();
      return;
    }

    const parentVisible = ctx.parent.isVisible() && !ctx.parent.isMinimized() && isParentActive(ctx.parent);
    if (!parentVisible) {
      hideButton();
      closePanel();
      return;
    }

    attachParentEvents(ctx.parent);

    if (panelOpen) {
      hideButton();
      ensurePanel(ctx);
      positionPanel(ctx);
    } else {
      if (!buttonVisible) ensureButton(ctx);
      positionButton(ctx);
      if (panelWin) closePanel();
    }

  }

  function startFollow() {
    if (followTimer) return;
    followTimer = setInterval(() => {
      const ctx = computeCtx();
      if (!ctx) {
        if (lastCtxRect) {
          lastCtxRect = null;
          closePanel();
          closeButton();
        }
        return;
      }

      const parentVisible = ctx.parent.isVisible() && !ctx.parent.isMinimized() && isParentActive(ctx.parent);
      if (!parentVisible) {
        hideButton();
        closePanel();
        return;
      }

      attachParentEvents(ctx.parent);

      if (!panelOpen) {
        if (!lastCtxRect || !sameRect(lastCtxRect, ctx.rect)) {
          lastCtxRect = ctx.rect;
        }

        if (!buttonVisible) ensureButton(ctx);
        positionButton(ctx);
      } else {
        hideButton();
        ensurePanel(ctx);
        positionPanel(ctx);
      }

    }, followIntervalMs);
  }

  function stopFollow() {
    if (followTimer) {
      clearInterval(followTimer);
      followTimer = null;
    }
    followParentId = null;
    if (parentEventCleanup) {
      try {
        parentEventCleanup();
      } catch (err) { logErr(err); }
      parentEventCleanup = null;
    }
  }

  async function refreshFromStore() {
    targetId = await opts.profiles.getOverlayTargetId();
    sync();
    startFollow();
  }

  function toggle() {
    panelOpen = !panelOpen;
    sync();
  }

  function stop() {
    stopFollow();
    closePanel();
    closeButton();
    ipcMain.removeListener("sidepanel:toggle", onToggle);
    ipcMain.removeListener("hudpanel:toggle", onToggle);
  }

  return { refreshFromStore, toggle, stop };
}




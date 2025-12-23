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
    getBounds: () => Rectangle;
  };

  instances: { get: (profileId: string) => BrowserWindow | null };

  panelWidth?: number;
  followIntervalMs?: number;
}) {
  const panelWidth = opts.panelWidth ?? 420;
  const followIntervalMs = opts.followIntervalMs ?? 80;

  let targetId: string | null = null;

  let btnWin: BrowserWindow | null = null;
  let panelWin: BrowserWindow | null = null;
  let panelOpen = false;

  // ✅ damit wir bei Target-Wechsel das Panel neu erstellen
  let panelProfileId: string | null = null;

  let followTimer: NodeJS.Timeout | null = null;
  let lastCtxRect: Rectangle | null = null;

  const onToggle = () => toggle();
  ipcMain.on("sidepanel:toggle", onToggle);

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
    const vb = opts.sessionTabs.getBounds();

    const rect = {
      x: cb.x + vb.x,
      y: cb.y + vb.y,
      width: vb.width,
      height: vb.height,
    };

    return { mode: "tabs", parent: win, rect, view };
  }

  function ensureButton(ctx: TargetCtx) {
    if (btnWin && btnWin.isDestroyed()) btnWin = null;

    if (!btnWin) {
      btnWin = createOverlayButtonWindow({ parent: ctx.parent });
      btnWin.on("closed", () => {
        btnWin = null;
      });
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
    } catch {}
  }

  function ensurePanel(ctx: TargetCtx) {
    if (panelWin && panelWin.isDestroyed()) {
      panelWin = null;
      panelProfileId = null;
    }

    // ✅ wenn das Panel existiert, aber für ein anderes Profil ist -> neu
    if (panelWin && panelProfileId && panelProfileId !== (targetId ?? "")) {
      try {
        panelWin.close();
      } catch {}
      panelWin = null;
      panelProfileId = null;
    }

    if (!panelWin) {
      panelProfileId = targetId ?? "";
      panelWin = createSidePanelWindow({
        parent: ctx.parent,
        profileId: panelProfileId,
      });

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
    } catch {}
  }

  function closePanel() {
    if (panelWin && !panelWin.isDestroyed()) {
      try {
        panelWin.close();
      } catch {}
    }
    panelWin = null;
    panelProfileId = null;
    panelOpen = false;
  }

  function closeButton() {
    if (btnWin && !btnWin.isDestroyed()) {
      try {
        btnWin.close();
      } catch {}
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

    ensureButton(ctx);
    positionButton(ctx);

    if (panelOpen) {
      ensurePanel(ctx);
      positionPanel(ctx);
    } else {
      if (panelWin) closePanel();
    }

    try {
      ctx.parent.focus();
    } catch {}
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

      if (!lastCtxRect || !sameRect(lastCtxRect, ctx.rect)) {
        lastCtxRect = ctx.rect;
      }

      ensureButton(ctx);
      positionButton(ctx);

      if (panelOpen) {
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
  }

  return { refreshFromStore, toggle, stop };
}

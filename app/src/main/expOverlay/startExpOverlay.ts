import { app, BrowserView, BrowserWindow, Rectangle, ipcMain } from "electron";
import path from "path";
import fs from "fs/promises";
import { createOverlayWindow } from "../windows/overlayWindow";
import { createHudControlWindow } from "../windows/hudControlWindow";
import { PythonOcrWorker } from "../ocr/pythonWorker";

type OcrResponse = {
  id: number;
  ok: boolean;
  raw?: string;
  value?: string | null;
  unit?: string | null;
  error?: string;
};

type OverlaySettings = {
  showResetButton?: boolean;
  // (deine restlichen Toggles kannst du später hier ergänzen)
};

type OverlayHudLayout = {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export type StartHudOverlayOptions = {
  getSessionWindow: () => BrowserWindow | null;
  getActiveView: () => BrowserView | null;

  getTargetId?: () => string | null;
  getSettings?: () => OverlaySettings | null;

  getHudLayout?: () => OverlayHudLayout | null;
  onHudLayoutChange?: (profileId: string, patch: Partial<OverlayHudLayout>) => void | Promise<void>;

  intervalMs?: number;
  nameLevelEveryMs?: number;

  debugEveryN?: number;

  pythonExe?: string;
  ocrScriptPath?: string;

  getRects?: (size: { width: number; height: number }) => HudRects;
};

type HudRects = {
  nameLevel: Rectangle;
  expPercent: Rectangle;
};

type Controller = { stop: () => void };

// ---------------------------
// Shared Python Worker (Singleton)
// ---------------------------
let sharedWorker: PythonOcrWorker | null = null;
let sharedRefs = 0;

function defaultOcrScriptPath(): string {
  return path.join(app.getAppPath(), "ocr", "ocr_worker.py");
}

async function acquireWorker(pythonExe?: string, scriptPath?: string) {
  if (!sharedWorker) {
    sharedWorker = new PythonOcrWorker({
      pythonExe: pythonExe ?? "python",
      scriptPath: scriptPath ?? defaultOcrScriptPath(),
    });
    await sharedWorker.start();
  }
  sharedRefs += 1;
  return sharedWorker;
}

async function releaseWorker() {
  sharedRefs -= 1;
  if (sharedRefs <= 0) {
    sharedRefs = 0;
    if (sharedWorker) {
      try {
        await sharedWorker.stop();
      } catch {}
      sharedWorker = null;
    }
  }
}

// ---------------------------
// Rects (Fallback Defaults)
// ---------------------------
function clampRect(r: Rectangle, w: number, h: number): Rectangle {
  const x = Math.max(0, Math.min(r.x, w - 1));
  const y = Math.max(0, Math.min(r.y, h - 1));
  const width = Math.max(1, Math.min(r.width, w - x));
  const height = Math.max(1, Math.min(r.height, h - y));
  return { x, y, width, height };
}

function defaultRects(size: { width: number; height: number }): HudRects {
  const { width: w, height: h } = size;

  const nameLevel = clampRect(
    { x: Math.round(w * 0.012), y: Math.round(h * 0.012), width: Math.round(w * 0.24), height: Math.round(h * 0.05) },
    w,
    h
  );

  const expPercent = clampRect(
    { x: Math.round(w * 0.055), y: Math.round(h * 0.078), width: Math.round(w * 0.16), height: Math.round(h * 0.05) },
    w,
    h
  );

  return { nameLevel, expPercent };
}

// ---------------------------
// Parsing Helpers
// ---------------------------
function normalizeOcr(s: string) {
  return (s ?? "").replace(/\r/g, "\n").replace(/[^\S\n]+/g, " ").trim();
}

function parseNameLevel(raw: string): { name: string | null; level: number | null } {
  const s = normalizeOcr(raw).replace(/\n/g, " ").trim();
  const m = s.match(/^(.*?)\s*L\s*[vV]\s*([0-9]{1,3})\b/);
  if (!m) return { name: s || null, level: null };

  const name = (m[1] ?? "").trim() || null;
  const lvl = Number(m[2]);
  return { name, level: Number.isFinite(lvl) ? lvl : null };
}

function parseExpFromResponse(res: OcrResponse): number | null {
  const v = res?.value;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }

  const raw = res?.raw ?? "";
  const s = normalizeOcr(raw).replace(/\s+/g, "").replace(",", ".");
  const m = s.match(/(\d+(?:\.\d+)?)%?/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function defaultHudLayout(): OverlayHudLayout {
  return { offsetX: 12, offsetY: 12, width: 380, height: 320 };
}

// ---------------------------
// Main
// ---------------------------
export function startExpOverlay(opts: StartHudOverlayOptions): Controller {
  const intervalMs = opts.intervalMs ?? 800;
  const nameLevelEveryMs = opts.nameLevelEveryMs ?? 8000;
  const debugEveryN = opts.debugEveryN ?? 0;

  const debugDir = debugEveryN ? path.join(app.getPath("userData"), "ocr_debug") : null;
  if (debugDir) {
    fs.mkdir(debugDir, { recursive: true })
      .then(() => console.log("[OCR DEBUG] dir ready:", debugDir))
      .catch((e) => console.error("[OCR DEBUG] mkdir failed:", e));
  }

  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  let inFlight = false;
  let tickCount = 0;

  let overlay: BrowserWindow | null = null;
  let overlayParentId: number | null = null;

  let control: BrowserWindow | null = null;
  let controlParentId: number | null = null;

  let worker: PythonOcrWorker | null = null;

  // cache
  let lastNameLevelAt = 0;
  let cachedName: string | null = null;
  let cachedLevel: number | null = null;
  let cachedExpPct: number | null = null;

  // smoothing + anti-glitch
  let expHist: number[] = [];
  function pushMedianExp(v: number) {
    expHist.push(v);
    if (expHist.length > 5) expHist.shift();
    const s = [...expHist].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }

  // optional raw debug
  let cachedRawExp: string | null = null;
  let cachedRawNameLevel: string | null = null;

  let lastSentKey = "";

  // --- drag/resize state (über ControlWindow) ---
  type DragKind = "move" | "w" | "h";
  let drag:
    | {
        kind: DragKind;
        startX: number;
        startY: number;
        startBounds: Rectangle;
        gameRect: Rectangle;
        profileId: string;
      }
    | null = null;

  function safeSend(win: BrowserWindow | null, channel: string, payload: any) {
    if (!win || win.isDestroyed()) return;
    const wc = win.webContents;
    if (!wc || wc.isDestroyed()) return;
    try {
      wc.send(channel, payload);
    } catch {}
  }

  function closeOverlay() {
    if (overlay && !overlay.isDestroyed()) {
      try {
        overlay.close();
      } catch {}
    }
    overlay = null;
    overlayParentId = null;
  }

  function closeControl() {
    if (control && !control.isDestroyed()) {
      try {
        control.close();
      } catch {}
    }
    control = null;
    controlParentId = null;
  }

  function ensureOverlayForParent(parent: BrowserWindow) {
    if (overlay && overlay.isDestroyed()) overlay = null;

    const pid = parent.id;
    if (overlay && overlayParentId !== pid) closeOverlay();

    if (!overlay) {
      overlay = createOverlayWindow(parent);
      overlayParentId = pid;

      // ✅ IMMER click-through
      try {
        overlay.setIgnoreMouseEvents(true, { forward: true });
      } catch {}

      overlay.on("closed", () => {
        overlay = null;
        overlayParentId = null;
      });
    }
  }

  function ensureControlForParent(parent: BrowserWindow) {
    if (control && control.isDestroyed()) control = null;

    const pid = parent.id;
    if (control && controlParentId !== pid) closeControl();

    if (!control) {
      control = createHudControlWindow(parent);
      controlParentId = pid;

      control.on("closed", () => {
        control = null;
        controlParentId = null;
      });
    }
  }

  function getCaptureSize(parent: BrowserWindow, view: BrowserView | null) {
    if (view) {
      const b = view.getBounds();
      return { width: Math.max(1, b.width), height: Math.max(1, b.height) };
    }
    const [w, h] = parent.getContentSize();
    return { width: Math.max(1, w), height: Math.max(1, h) };
  }

  function computeGameRect(): Rectangle | null {
    const parent = opts.getSessionWindow();
    if (!parent || parent.isDestroyed()) return null;

    const view = (() => {
      try {
        const v = opts.getActiveView?.() ?? null;
        if (!v) return null;
        if (v.webContents.isDestroyed()) return null;
        return v;
      } catch {
        return null;
      }
    })();

    try {
      const cb = parent.getContentBounds(); // screen coords
      if (view) {
        const vb = view.getBounds(); // content coords
        return { x: cb.x + vb.x, y: cb.y + vb.y, width: vb.width, height: vb.height };
      }
      return { x: cb.x, y: cb.y, width: cb.width, height: cb.height };
    } catch {
      return null;
    }
  }

  function clampToGame(bounds: Rectangle, game: Rectangle): Rectangle {
    const minW = 260;
    const minH = 180;

    const width = Math.max(minW, Math.min(bounds.width, game.width));
    const height = Math.max(minH, Math.min(bounds.height, game.height));

    const maxX = game.x + game.width - width;
    const maxY = game.y + game.height - height;

    const x = Math.max(game.x, Math.min(bounds.x, maxX));
    const y = Math.max(game.y, Math.min(bounds.y, maxY));

    return { x, y, width, height };
  }

  function fitHudBounds() {
    if (!overlay || overlay.isDestroyed()) return;

    // während Drag/Resize nicht überschreiben
    if (drag) return;

    const game = computeGameRect();
    if (!game) return;

    const layout = opts.getHudLayout?.() ?? defaultHudLayout();

    const desired = {
      x: Math.round(game.x + layout.offsetX),
      y: Math.round(game.y + layout.offsetY),
      width: Math.max(260, Math.min(layout.width, game.width)),
      height: Math.max(180, Math.min(layout.height, game.height)),
    };

    try {
      overlay.setBounds(clampToGame(desired, game), false);
    } catch {}
  }

  function fitControlBounds() {
    if (!control || control.isDestroyed()) return;
    if (!overlay || overlay.isDestroyed()) return;

    try {
      const ob = overlay.getBounds();
      const cw = 180;
      const ch = 56;

      const x = ob.x + ob.width - cw - 8;
      const y = ob.y + 8;

      control.setBounds({ x, y, width: cw, height: ch }, false);
    } catch {}
  }

  async function captureCropPng(parent: BrowserWindow, view: BrowserView | null, rect: Rectangle) {
    try {
      if (view) {
        if (view.webContents.isDestroyed()) return null;
        const img = await view.webContents.capturePage(rect);
        return img.toPNG();
      }

      if (parent.webContents.isDestroyed()) return null;
      const img = await parent.webContents.capturePage(rect);
      return img.toPNG();
    } catch (e) {
      console.error("[OCR DEBUG] capture failed", e);
      return null;
    }
  }

  async function maybeDebugWrite(png: Buffer, label: string) {
    if (!debugEveryN) return;
    if (tickCount % debugEveryN !== 0) return;

    try {
      const dir = path.join(app.getPath("userData"), "ocr_debug");
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, `${label}_${Date.now()}.png`);
      await fs.writeFile(file, png);
    } catch (e) {
      console.error("[OCR DEBUG] write failed", e);
    }
  }

  // ---------------------------
  // IPC: Reset + Drag/Resize
  // ---------------------------
  const onReset = (_e: any, payload: any) => {
    // placeholder – du kannst später echte Stats zurücksetzen
    // aktuell nur loggen
    if (!payload?.profileId) return;
    console.log("[HUD] reset for", payload.profileId);
  };

  const onDragStart = (_e: any, payload: any) => {
    if (!overlay || overlay.isDestroyed()) return;

    const profileId = opts.getTargetId?.() ?? null;
    if (!profileId) return;

    const game = computeGameRect();
    if (!game) return;

    const kind = payload?.kind as DragKind;
    const x = Number(payload?.x);
    const y = Number(payload?.y);
    if (!kind || !Number.isFinite(x) || !Number.isFinite(y)) return;

    drag = {
      kind,
      startX: x,
      startY: y,
      startBounds: overlay.getBounds(),
      gameRect: game,
      profileId,
    };
  };

  const onDragMove = (_e: any, payload: any) => {
    if (!drag) return;
    if (!overlay || overlay.isDestroyed()) return;

    const x = Number(payload?.x);
    const y = Number(payload?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const dx = x - drag.startX;
    const dy = y - drag.startY;

    const b0 = drag.startBounds;
    const g = drag.gameRect;

    let next: Rectangle;

    if (drag.kind === "move") {
      next = clampToGame({ x: b0.x + dx, y: b0.y + dy, width: b0.width, height: b0.height }, g);
    } else if (drag.kind === "w") {
      const maxW = g.x + g.width - b0.x;
      const w = Math.max(260, Math.min(b0.width + dx, maxW));
      next = clampToGame({ x: b0.x, y: b0.y, width: w, height: b0.height }, g);
    } else {
      const maxH = g.y + g.height - b0.y;
      const h = Math.max(180, Math.min(b0.height + dy, maxH));
      next = clampToGame({ x: b0.x, y: b0.y, width: b0.width, height: h }, g);
    }

    try {
      overlay.setBounds(next, false);
    } catch {}

    fitControlBounds();
  };

  const onDragEnd = async () => {
    if (!drag) return;
    const d = drag;
    drag = null;

    if (!overlay || overlay.isDestroyed()) return;

    const game = computeGameRect();
    if (!game) return;

    const ob = overlay.getBounds();

    const patch: Partial<OverlayHudLayout> = {
      offsetX: ob.x - game.x,
      offsetY: ob.y - game.y,
      width: ob.width,
      height: ob.height,
    };

    try {
      await opts.onHudLayoutChange?.(d.profileId, patch);
    } catch {}
  };

  ipcMain.on("overlay:reset", onReset);
  ipcMain.on("hud:dragStart", onDragStart);
  ipcMain.on("hud:dragMove", onDragMove);
  ipcMain.on("hud:dragEnd", onDragEnd);

  const tick = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    tickCount += 1;

    try {
      const parent = opts.getSessionWindow();

      if (!parent || parent.isDestroyed()) {
        closeControl();
        closeOverlay();
        return;
      }

      ensureOverlayForParent(parent);
      ensureControlForParent(parent);

      // HUD folgt Fenster/Tab (relativ), aber NICHT während Drag
      fitHudBounds();
      fitControlBounds();

      // Worker lazy-start
      if (!worker) {
        worker = await acquireWorker(opts.pythonExe, opts.ocrScriptPath);
      }

      // Tabs-Mode: BrowserView; Window-Mode: null
      const view = (() => {
        try {
          const v = opts.getActiveView?.() ?? null;
          if (!v) return null;
          if (v.webContents.isDestroyed()) return null;
          return v;
        } catch {
          return null;
        }
      })();

      const size = getCaptureSize(parent, view);
      const rects = (opts.getRects ?? defaultRects)(size);

      // -------- EXP (jedes Tick) --------
      const expPng = await captureCropPng(parent, view, rects.expPercent);
      if (expPng) {
        await maybeDebugWrite(expPng, "hud_exp");

        const res = (await worker.recognizePng(expPng, { kind: "exp" })) as OcrResponse;
        cachedRawExp = res.raw ?? cachedRawExp;

        const exp = parseExpFromResponse(res);

        if (exp !== null && exp >= 0 && exp <= 100) {
          if (cachedExpPct !== null) {
            // keine Drops, keine absurden Sprünge
            if (exp < cachedExpPct - 0.1) {
              // ignore glitch
            } else if (exp > cachedExpPct + 10) {
              // ignore glitch
            } else {
              cachedExpPct = pushMedianExp(exp);
            }
          } else {
            cachedExpPct = pushMedianExp(exp);
          }
        }
      }

      // -------- Name/Level (seltener) --------
      const now = Date.now();
      if (now - lastNameLevelAt > nameLevelEveryMs) {
        const nlPng = await captureCropPng(parent, view, rects.nameLevel);
        if (nlPng) {
          await maybeDebugWrite(nlPng, "hud_namelevel");

          const res = (await worker.recognizePng(nlPng, { kind: "namelevel" })) as OcrResponse;
          cachedRawNameLevel = res.raw ?? cachedRawNameLevel;

          if (res.raw) {
            const parsed = parseNameLevel(res.raw);

            if (cachedLevel !== null && parsed.level !== null && parsed.level !== cachedLevel) {
              expHist = [];
            }

            cachedName = parsed.name ?? cachedName;
            cachedLevel = parsed.level ?? cachedLevel;
          }
        }
        lastNameLevelAt = now;
      }

      const profileId = opts.getTargetId?.() ?? null;
      const settings = opts.getSettings?.() ?? null;

      const key = `${profileId ?? ""}|${cachedName ?? ""}|${cachedLevel ?? ""}|${cachedExpPct ?? ""}|${JSON.stringify(settings ?? {})}`;
      if (key !== lastSentKey) {
        lastSentKey = key;

        const payload = {
          ts: Date.now(),
          profileId,
          name: cachedName,
          level: cachedLevel,
          expPct: cachedExpPct,
          settings,
          rawExp: cachedRawExp,
          rawNameLevel: cachedRawNameLevel,
        };

        safeSend(overlay, "exp:update", payload);
        safeSend(control, "exp:update", payload);
      }
    } catch (e) {
      console.error("[OCR DEBUG] tick error", e);
    } finally {
      inFlight = false;
    }
  };

  timer = setInterval(() => {
    tick().catch(() => {});
  }, intervalMs);

  const stop = () => {
    if (stopped) return;
    stopped = true;

    ipcMain.removeListener("overlay:reset", onReset);
    ipcMain.removeListener("hud:dragStart", onDragStart);
    ipcMain.removeListener("hud:dragMove", onDragMove);
    ipcMain.removeListener("hud:dragEnd", onDragEnd);

    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    closeControl();
    closeOverlay();

    const hadWorker = !!worker;
    worker = null;
    if (hadWorker) {
      releaseWorker().catch(() => {});
    }
  };

  return { stop };
}

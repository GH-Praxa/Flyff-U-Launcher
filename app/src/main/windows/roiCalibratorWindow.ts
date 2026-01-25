import { BrowserWindow, Rectangle, ipcMain, app } from "electron";
import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
export type RoiNorm = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type HudRois = {
    lvl?: RoiNorm;
    charname?: RoiNorm;
    exp?: RoiNorm;
    lauftext?: RoiNorm;
    rmExp?: RoiNorm;
    enemyName?: RoiNorm;
    enemyHp?: RoiNorm;
    // Legacy fuer Migration
    nameLevel?: RoiNorm;
    expPercent?: RoiNorm;
};
import { logErr } from "../../shared/logger"; // Added import
import { TIMINGS } from "../../shared/constants";
export function createRoiCalibratorWindow(opts: {
    parent: BrowserWindow;
    screenRect: Rectangle;
    pngB64: string;
    initialRois?: HudRois;
    channel: string;
    preloadPath?: string;
    activeKey?: "lvl" | "charname" | "exp" | "lauftext" | "rmExp" | "enemyName" | "enemyHp";
    allowedKeys?: readonly ("lvl" | "charname" | "exp" | "lauftext" | "rmExp" | "enemyName" | "enemyHp")[];
    skipParent?: boolean;
}) {
    // When skipParent is true, create as a top-level window to avoid
    // BrowserView z-order issues (BrowserViews are always drawn on top of child windows)
    const win = new BrowserWindow({
        parent: opts.skipParent ? undefined : opts.parent,
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        show: true,
        focusable: true,
        acceptFirstMouse: true,
        skipTaskbar: true,
        hasShadow: false,
        alwaysOnTop: true,
    webPreferences: {
        // Kein Preload noetig - wir bauen die Bridge inline via require("electron").
        preload: undefined,
        // NodeIntegration an, ContextIsolation aus, damit require im Renderer verfuegbar ist.
        nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false,
        },
    });
    win.setIgnoreMouseEvents(false);
    win.setAlwaysOnTop(true, "floating");
    win.setVisibleOnAllWorkspaces(true);
    try {
        win.moveTop();
    }
    catch (err) {
        logErr(err, "RoiCalibratorWindow");
    }
    win.setBounds(opts.screenRect, false);
    win.focus();
    win.webContents.focus();
    win.webContents.on("console-message", ({ level, message, lineNumber, sourceId }) => {
  try {
    console.log("[ROI CALIB CONSOLE]", level, message, `${sourceId}:${lineNumber}`);
  } catch {
    // ignore
  }
});


    const initial = JSON.stringify(opts.initialRois ?? {});
    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body { margin:0; padding:0; background: rgba(0,0,0,0.15); overflow:hidden; }
  #wrap { position:relative; width:100vw; height:100vh; pointer-events:auto; }
  #bg { position:absolute; inset:0; width:100%; height:100%; object-fit:fill; z-index:0; pointer-events:none; }
  #c { position:absolute; inset:0; z-index:1; pointer-events:auto; }
  #bar {
    position:absolute; left:50%; top:12px; transform:translateX(-50%);
    display:flex; gap:8px; z-index:2; pointer-events:auto;
    background: rgba(0,0,0,0.55); padding:10px; border-radius:10px;
    font-family: Segoe UI, Arial; color:white; user-select:none;
  }
  .roiBtn { cursor:pointer; border-radius:8px; border:1px solid rgba(255,255,255,0.15);
            background: rgba(255,255,255,0.08); color:white; padding:6px 10px; min-width:76px; }
  .roiBtn.active { border-color: rgba(255,255,255,0.35); background: rgba(255,255,255,0.18); }
  button { cursor:pointer; border-radius:8px; border:1px solid rgba(255,255,255,0.15);
           background: rgba(255,255,255,0.08); color:white; padding:6px 10px; }
  button.primary { background: rgba(0,0,0,0.25); border-color: rgba(255,255,255,0.25); }
  .hint { opacity:.85; font-size:12px; margin-left:8px; align-self:center; white-space:nowrap; }
</style>
</head>
<body>
<div id="wrap">
  <img id="bg" />
  <canvas id="c"></canvas>
  <div id="bar">
    <button id="btnLvl" class="roiBtn">LVL</button>
    <button id="btnName" class="roiBtn">NAME</button>
    <button id="btnExp" class="roiBtn">EXP%</button>
    <button id="btnLauf" class="roiBtn">LAUFTEXT</button>
    <button id="btnRmExp" class="roiBtn">RM EXP</button>
    <button id="btnEnemyName" class="roiBtn">ENEMY</button>
    <button id="btnEnemyHp" class="roiBtn">ENEMY HP</button>
    <button id="btnSave" class="primary">Schliessen</button>
    <button id="btnCancel">Abbrechen</button>
    <div class="hint">TAB/1-7 wechseln, ESC abbrechen (Speichert automatisch beim Loslassen)</div>
  </div>
</div>

<script>
  window.__ROI_BG__ = undefined;
  window.__ROI_ACTIVE__ = undefined;
  window.__ROI_ALLOWED_KEYS__ = undefined;
  // wird spaeter per file:// Pfad ersetzt
  // Bridge vollstaendig inline: Hash auslesen und ipcRenderer via require nutzen.
  function getBridge() {
    try {
      console.log("[ROI CALIB] script start");
    } catch(_e){}
    if (window.roiBridge) return window.roiBridge;
    const hash = window.location.hash?.replace(/^#/, "") ?? "";
    let channel = null;
    try {
      const raw = decodeURIComponent(hash);
      if (raw && raw.startsWith("roi-calib:")) channel = raw;
    } catch (_e) { /* ignore */ }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { ipcRenderer } = require("electron");
      if (channel && ipcRenderer) {
        const bridgeObj = {
          channel,
          send: (payload) => ipcRenderer.send(channel, payload),
          sendDebug: (payload) => ipcRenderer.send(channel + ":debug", payload),
        };
        // Expose in main world for convenience
        window.roiBridge = bridgeObj;
        return bridgeObj;
      }
    } catch (_e) { /* ignore */ }
    return null;
  }

  const bridge = getBridge();
  const roisRaw = ${initial};
  console.log("[ROI CALIB] roisRaw:", JSON.stringify(roisRaw));
  console.log("[ROI CALIB] __ROI_ALLOWED_KEYS__:", JSON.stringify(window.__ROI_ALLOWED_KEYS__));
  const ALL_ROI_KEYS = ["lvl", "charname", "exp", "lauftext", "rmExp", "enemyName", "enemyHp"];
  const allowedKeys = window.__ROI_ALLOWED_KEYS__ || ALL_ROI_KEYS;
  const ROI_KEYS = ALL_ROI_KEYS.filter(k => allowedKeys.includes(k));
  console.log("[ROI CALIB] ROI_KEYS:", JSON.stringify(ROI_KEYS));
  const ROI_LABELS = { lvl: "LVL", charname: "NAME", exp: "EXP%", lauftext: "LAUFTEXT", rmExp: "RM EXP", enemyName: "ENEMY LVL", enemyHp: "ENEMY HP" };
  const ROI_COLORS = {
    lvl: "rgba(0,150,255,0.9)",
    charname: "rgba(255,215,0,0.9)",
    exp: "rgba(0,255,255,0.9)",
    lauftext: "rgba(0,255,100,0.9)",
    rmExp: "rgba(255,170,80,0.95)",
    enemyName: "rgba(255,100,100,0.9)",
    enemyHp: "rgba(200,50,50,0.9)",
  };
  const ROI_FILLS = {
    lvl: "rgba(0,150,255,0.20)",
    charname: "rgba(255,215,0,0.20)",
    exp: "rgba(0,255,255,0.18)",
    lauftext: "rgba(0,255,100,0.18)",
    rmExp: "rgba(255,170,80,0.18)",
    enemyName: "rgba(255,100,100,0.18)",
    enemyHp: "rgba(200,50,50,0.18)",
  };
  function migrateRois(input) {
    const src = (input && typeof input === "object") ? input : {};
    if (src.lvl || src.charname || src.exp || src.lauftext || src.rmExp || src.enemyName || src.enemyHp) {
      return {
        lvl: src.lvl,
        charname: src.charname,
        exp: src.exp,
        lauftext: src.lauftext,
        rmExp: src.rmExp,
        enemyName: src.enemyName,
        enemyHp: src.enemyHp,
      };
    }
    return {
      charname: src.nameLevel,
      exp: src.expPercent,
    };
  }
  const rois = migrateRois(roisRaw);
  console.log("[ROI CALIB] rois after migrate:", JSON.stringify(rois));

  if(!bridge || !bridge.channel){
    console.error("roi bridge missing");
    alert("ROI-Bridge fehlt - bitte App neu starten und erneut versuchen.");
    throw new Error("roi bridge missing");
  }
  const log = (msg, payload) => {
    try {
      bridge.sendDebug?.({ msg, payload });
    } catch (err) { console.warn(err); }
  };
  log("bridge-ok", { channel: bridge.channel });

  const img = document.getElementById("bg");
  img.src = window.__ROI_BG__ || "";

  const canvas = document.getElementById("c");
  canvas.style.cursor = "crosshair";
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("canvas context missing");
  }
  let drag = false, sx=0, sy=0, cur=null;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
  }
  window.addEventListener("resize", resize);
  resize();
  log("init", { w: canvas.width, h: canvas.height, rois });

  const buttons = {
    lvl: document.getElementById("btnLvl"),
    charname: document.getElementById("btnName"),
    exp: document.getElementById("btnExp"),
    lauftext: document.getElementById("btnLauf"),
    rmExp: document.getElementById("btnRmExp"),
    enemyName: document.getElementById("btnEnemyName"),
    enemyHp: document.getElementById("btnEnemyHp"),
  };

  // Hide buttons that aren't in allowedKeys
  Object.entries(buttons).forEach(([key, btn]) => {
    if (!btn) return;
    if (!ROI_KEYS.includes(key)) {
      btn.style.display = "none";
      return;
    }
    const color = ROI_COLORS[key];
    btn.style.borderColor = color;
    btn.style.color = color;
    btn.onclick = () => { setActive(key); log("btn:" + key); };
  });

  // Update hint text based on allowed keys
  const hintEl = document.querySelector(".hint");
  if (hintEl && ROI_KEYS.length === 1) {
    hintEl.textContent = "ESC abbrechen (Speichert automatisch beim Loslassen)";
  } else if (hintEl) {
    hintEl.textContent = "TAB/1-" + ROI_KEYS.length + " wechseln, ESC abbrechen (Speichert automatisch beim Loslassen)";
  }

  const initialActive = (window.__ROI_ACTIVE__ && ROI_KEYS.includes(window.__ROI_ACTIVE__)) ? window.__ROI_ACTIVE__ : null;
  let activeKey = initialActive || ROI_KEYS.find(k => rois[k]) || ROI_KEYS[0] || "exp";
  function setActive(key){
    if (!ROI_KEYS.includes(key)) return;
    activeKey = key;
    updateActiveButtons();
    draw();
  }

  function cycleActive(){
    const idx = ROI_KEYS.indexOf(activeKey);
    const next = ROI_KEYS[(idx + 1) % ROI_KEYS.length];
    setActive(next);
  }

  function updateActiveButtons(){
    ROI_KEYS.forEach(k => {
      const btn = buttons[k];
      if (btn) btn.classList.toggle("active", k === activeKey);
    });
  }

  updateActiveButtons();

  window.addEventListener("keydown", (e) => {
    if (e.key === "Tab") { e.preventDefault(); cycleActive(); }
    if (e.key === "Escape") cancel();
    const num = parseInt(e.key, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= ROI_KEYS.length) {
      setActive(ROI_KEYS[num - 1]);
    }
  });

  function toNorm(r) {
    return {
      x: Math.max(0, Math.min(1, r.x / canvas.width)),
      y: Math.max(0, Math.min(1, r.y / canvas.height)),
      w: Math.max(0.001, Math.min(1, r.w / canvas.width)),
      h: Math.max(0.001, Math.min(1, r.h / canvas.height)),
    };
  }

  function fromNorm(n) {
    if (!n) return null;
    return {
      x: Math.round(n.x * canvas.width),
      y: Math.round(n.y * canvas.height),
      w: Math.round(n.w * canvas.width),
      h: Math.round(n.h * canvas.height),
    };
  }

  function drawRect(r, stroke, fill, label, opts) {
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    // Draw label slightly above the ROI for better readability
    ctx.fillStyle = "white";
    ctx.font = "14px Segoe UI, Arial";
    ctx.textBaseline = "bottom";
    const isExp = opts?.key === "exp";
    const labelY = isExp ? Math.min(canvas.height - 4, r.y + r.h + 18) : Math.max(10, r.y - 8);
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 4;
    ctx.fillText(label, r.x + 6, labelY);
    ctx.restore();
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);

    ROI_KEYS.forEach(key => {
      const r = fromNorm(rois[key]);
      if (r) drawRect(r, ROI_COLORS[key], ROI_FILLS[key], ROI_LABELS[key], { key });
    });

    if (cur) drawRect(cur, "rgba(255,255,255,0.95)", "rgba(0,0,0,0.0)", ROI_LABELS[activeKey], { key: activeKey, isLive: true });
  }

  function handleDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
    console.log("[ROI CALIB] down x=" + x + " y=" + y);
    drag = true;
    sx = x; sy = y;
    cur = { x:sx, y:sy, w:1, h:1 };
    draw();
    log("mousedown", { x: sx, y: sy });
    e.preventDefault();
  }

  function handleMove(e) {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    console.log("[ROI CALIB] move x=" + x + " y=" + y);
    const rx = Math.min(sx, x), ry = Math.min(sy, y);
    const rw = Math.max(1, Math.abs(x - sx)), rh = Math.max(1, Math.abs(y - sy));
    cur = { x:rx, y:ry, w:rw, h:rh };
    draw();
    e.preventDefault();
  }

  function handleUp(e) {
    if (!drag) return;
    drag = false;
    if (cur) {
      rois[activeKey] = toNorm(cur);
      console.log("[ROI CALIB] handleUp: set rois[" + activeKey + "] =", JSON.stringify(rois[activeKey]));
      console.log("[ROI CALIB] handleUp: ROI_KEYS =", JSON.stringify(ROI_KEYS));
      console.log("[ROI CALIB] handleUp: ALL_ROI_KEYS =", JSON.stringify(ALL_ROI_KEYS));
      cur = null;
      draw();
      const cleaned = {};
      ROI_KEYS.forEach((k) => {
        if (rois[k]) cleaned[k] = rois[k];
      });
      console.log("[ROI CALIB] handleUp: cleaned keys =", JSON.stringify(Object.keys(cleaned)));
      console.log("[ROI CALIB] handleUp: bridge.send exists?", !!bridge.send);
      log("mouseup:save", { activeKey, rois: cleaned });
      console.log("[ROI CALIB] up/save activeKey=" + activeKey);
      bridge.send?.({ update: true, rois: cleaned });
      console.log("[ROI CALIB] handleUp: message sent");
    }
    e.preventDefault();
  }

  function handlePointerDown(e){
    if (e.button !== 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch(_e){}
    handleDown(e);
  }
  function handlePointerMove(e){
    if (drag) {
      handleMove(e);
    }
  }
  function handlePointerUp(e){
    try { canvas.releasePointerCapture(e.pointerId); } catch(_e){}
    handleUp(e);
  }

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointercancel", handlePointerUp);

  function cancel() {
    log("cancel");
    bridge.send?.({ cancel:true });
    window.close();
  }

  document.getElementById("btnCancel").onclick = cancel;

  document.getElementById("btnSave").onclick = () => {
    log("save");
    console.log("[ROI CALIB] save click");
    const cleaned = {};
    ROI_KEYS.forEach((k) => {
      if (rois[k]) cleaned[k] = rois[k];
    });
    console.log("[ROI CALIB] send rois keys=" + Object.keys(cleaned).join(","));
    bridge.send?.({ ok:true, rois: cleaned, done: true });
    window.close();
  };
</script>
</body>
</html>
  `.trim();
    (async () => {
        const baseName = `roi-calib-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const tempDir = app.getPath("temp");
        const htmlPath = path.join(tempDir, `${baseName}.html`);
        const pngPath = path.join(tempDir, `${baseName}.png`);
        const imgUrl = pathToFileURL(pngPath).toString();

        await fs.writeFile(pngPath, Buffer.from(opts.pngB64, "base64"));
        const finalHtml = html
            .replace('window.__ROI_BG__ = undefined;', `window.__ROI_BG__ = ${JSON.stringify(imgUrl)};`)
            .replace('window.__ROI_ACTIVE__ = undefined;', `window.__ROI_ACTIVE__ = ${JSON.stringify(opts.activeKey ?? null)};`)
            .replace('window.__ROI_ALLOWED_KEYS__ = undefined;', `window.__ROI_ALLOWED_KEYS__ = ${JSON.stringify(opts.allowedKeys ?? null)};`);
        await fs.writeFile(htmlPath, finalHtml, "utf-8");

        win.loadURL(pathToFileURL(htmlPath).toString() + `#${encodeURIComponent(opts.channel)}`).catch((err) => console.error("[RoiCalibratorWindow] load failed", err));
        win.on("closed", () => {
            fs.unlink(htmlPath).catch(() => undefined);
            fs.unlink(pngPath).catch(() => undefined);
        });
    })().catch((err) => console.error("[RoiCalibratorWindow] temp write failed", err));
    return win;
}
export async function openRoiCalibratorWindow(opts: {
    profileId: string;
    parent: BrowserWindow;
    bounds: Rectangle;
    screenshotPng: Buffer;
    existing?: HudRois | null;
    onSave: (rois: HudRois) => Promise<void>;
    follow?: {
        getBounds: () => Rectangle | null;
        intervalMs?: number;
    };
    preloadPath?: string;
    activeKey?: "lvl" | "charname" | "exp" | "lauftext" | "rmExp" | "enemyName" | "enemyHp";
    allowedKeys?: readonly ("lvl" | "charname" | "exp" | "lauftext" | "rmExp" | "enemyName" | "enemyHp")[];
    skipParent?: boolean;
}): Promise<boolean> {
    const channel = `roi-calib:${opts.profileId}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    const win = createRoiCalibratorWindow({
        parent: opts.parent,
        screenRect: opts.bounds,
        pngB64: opts.screenshotPng.toString("base64"),
        initialRois: opts.existing ?? undefined,
        channel,
        preloadPath: opts.preloadPath,
        activeKey: opts.activeKey,
        allowedKeys: opts.allowedKeys,
        skipParent: opts.skipParent,
    });
    let followIv: NodeJS.Timeout | null = null;
    if (opts.follow?.getBounds) {
        const intervalMs = opts.follow.intervalMs ?? TIMINGS.OVERLAY_FOLLOW_MS;
        let last: Rectangle | null = null;
        const same = (a: Rectangle, b: Rectangle) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
        const tick = () => {
            if (!win || win.isDestroyed())
                return;
            const b = opts.follow!.getBounds();
            if (!b)
                return;
            if (last && same(last, b))
                return;
            last = b;
            try {
                win.setBounds(b, false);
            }
            catch (err) {
                logErr(err, "RoiCalibratorWindow");
            }
        };
        tick();
        followIv = setInterval(tick, intervalMs);
        win.on("closed", () => {
            if (followIv)
                clearInterval(followIv);
            followIv = null;
        });
    }
    return await new Promise<boolean>((resolve, reject) => {
        let done = false;
        const cleanup = () => {
            if (done)
                return;
            done = true;
            try {
                // Use removeListener with specific handler instead of removeAllListeners
                // to avoid removing handlers from other ROI calibrator windows
                ipcMain.removeListener(channel, onMessage);
                ipcMain.removeListener(channel + ":debug", onDebugMessage);
            }
            catch (err) {
                logErr(err, "RoiCalibratorWindow");
            }
            if (followIv) {
                try {
                    clearInterval(followIv);
                }
                catch (err) {
                    logErr(err, "RoiCalibratorWindow");
                }
                followIv = null;
            }
        };
        type RoiCalibPayload = { ok?: boolean; rois?: HudRois; cancel?: boolean };
        const onMessage = async (_e: Electron.IpcMainEvent, payload: RoiCalibPayload) => {
            try {
                console.log("[ROI CALIB MAIN] received payload", JSON.stringify(payload));
                console.log("[ROI CALIB MAIN] payload.rois keys:", payload?.rois ? Object.keys(payload.rois) : "none");
                if (payload?.rois) {
                    await opts.onSave(payload.rois);
                    console.log("[ROI CALIB MAIN] saved rois keys:", Object.keys(payload.rois));
                }
                if (payload?.cancel) {
                    resolve(false);
                    cleanup();
                    try {
                        if (win && !win.isDestroyed())
                            win.close();
                    }
                    catch (err) {
                        logErr(err, "RoiCalibratorWindow");
                    }
                    return;
                }
                if (payload?.ok || payload?.done) {
                    resolve(true);
                    cleanup();
                    try {
                        if (win && !win.isDestroyed())
                            win.close();
                    }
                    catch (err) {
                        logErr(err, "RoiCalibratorWindow");
                    }
                }
            }
            catch (err) {
                console.error("[ROI CALIB] onSave failed:", err);
                reject(err);
                cleanup();
                try {
                    if (win && !win.isDestroyed())
                        win.close();
                }
                catch (err2) {
                    logErr(err2, "RoiCalibratorWindow");
                }
            }
        };
        const onDebugMessage = (_e: Electron.IpcMainEvent, payload: unknown) => {
            try {
                console.log("[ROI CALIB DEBUG]", payload);
            }
            catch (err) {
                logErr(err, "RoiCalibratorWindow");
            }
        };
        ipcMain.on(channel, onMessage);
        ipcMain.on(channel + ":debug", onDebugMessage);
        win.on("closed", () => {
            if (!done) {
                cleanup();
                resolve(true);
            }
        });
    });
}

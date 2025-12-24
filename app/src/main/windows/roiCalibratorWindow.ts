import { BrowserWindow, Rectangle, ipcMain } from "electron";

export type RoiNorm = { x: number; y: number; w: number; h: number };
export type HudRois = { nameLevel?: RoiNorm; expPercent?: RoiNorm };

export function createRoiCalibratorWindow(opts: {
  parent: BrowserWindow;
  screenRect: Rectangle; // exakt über Game-Fläche (SCREEN coords)
  pngB64: string;
  initialRois?: HudRois;
  channel: string; // eindeutiger IPC channel
}) {
  const win = new BrowserWindow({
    parent: opts.parent,
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
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
  });

  // sicherstellen, dass das Fenster Eingaben annimmt und oben liegt
  win.setIgnoreMouseEvents(false);
  win.setAlwaysOnTop(true, "screen-saver");
  try {
    win.moveTop();
  } catch {}

  win.setBounds(opts.screenRect, false);
  win.focus();
  try {
    win.webContents.openDevTools({ mode: "detach" });
  } catch {}

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
  button { cursor:pointer; border-radius:8px; border:1px solid rgba(255,255,255,0.15);
           background: rgba(255,255,255,0.08); color:white; padding:6px 10px; }
  button.primary { background: rgba(255,215,0,0.18); }
  .hint { opacity:.8; font-size:12px; margin-left:8px; align-self:center; }
</style>
</head>
<body>
<div id="wrap">
  <img id="bg" />
  <canvas id="c"></canvas>
  <div id="bar">
    <button id="btnName">Set Name/Lv</button>
    <button id="btnExp" class="primary">Set EXP%</button>
    <button id="btnSave" class="primary">Save</button>
    <button id="btnCancel">Cancel</button>
    <div class="hint">Zieh ein Rechteck. TAB: Wechsel ROI</div>
  </div>
</div>

<script>
  const { ipcRenderer } = require("electron");
  const channel = ${JSON.stringify(opts.channel)};
  const rois = ${initial};

  const log = (msg, payload) => {
    try {
      ipcRenderer.send(channel + ":debug", { msg, payload });
    } catch {}
  };

  const img = document.getElementById("bg");
  img.src = "data:image/png;base64," + ${JSON.stringify(opts.pngB64)};

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
  }
  window.addEventListener("resize", resize);
  resize();

  let activeKey = "expPercent"; // or nameLevel
  document.getElementById("btnName").onclick = () => { activeKey = "nameLevel"; log("btnName"); draw(); };
  document.getElementById("btnExp").onclick  = () => { activeKey = "expPercent"; log("btnExp"); draw(); };

  window.addEventListener("keydown", (e) => {
    if (e.key === "Tab") { e.preventDefault(); activeKey = (activeKey==="expPercent") ? "nameLevel" : "expPercent"; draw(); }
    if (e.key === "Escape") cancel();
  });

  let drag = false, sx=0, sy=0, cur=null;

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

  function drawRect(r, stroke, fill, label) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "white";
    ctx.font = "14px Segoe UI, Arial";
    ctx.fillText(label, r.x + 6, r.y + 18);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);

    const exp = fromNorm(rois.expPercent);
    const nl  = fromNorm(rois.nameLevel);

    if (exp) drawRect(exp, "rgba(0,255,255,0.9)", "rgba(0,0,0,0.25)", "EXP%");
    if (nl)  drawRect(nl,  "rgba(255,215,0,0.9)", "rgba(0,0,0,0.25)", "NAME/LV");

    if (cur) drawRect(cur, "rgba(255,255,255,0.95)", "rgba(0,0,0,0.0)", activeKey);
  }

  canvas.addEventListener("mousedown", (e) => {
    drag = true;
    sx = e.offsetX; sy = e.offsetY;
    cur = { x:sx, y:sy, w:1, h:1 };
    draw();
    log("mousedown", { x: sx, y: sy });
  });

  window.addEventListener("mousemove", (e) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    const rx = Math.min(sx, x), ry = Math.min(sy, y);
    const rw = Math.max(1, Math.abs(x - sx)), rh = Math.max(1, Math.abs(y - sy));
    cur = { x:rx, y:ry, w:rw, h:rh };
    draw();
  });

  window.addEventListener("mouseup", () => {
    if (!drag) return;
    drag = false;
    if (cur) {
      rois[activeKey] = toNorm(cur);
      cur = null;
      draw();
      log("mouseup:save", { activeKey, rois });
    }
  });

  function cancel() {
    log("cancel");
    ipcRenderer.send(channel, { ok:false });
    window.close();
  }

  document.getElementById("btnCancel").onclick = cancel;

  document.getElementById("btnSave").onclick = () => {
    log("save");
    if (!rois.nameLevel || !rois.expPercent) {
      alert("Bitte beide ROIs setzen (Name/Lv und EXP%).");
      return;
    }
    ipcRenderer.send(channel, { ok:true, rois });
    window.close();
  };
</script>
</body>
</html>
  `.trim();

  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html)).catch(() => {});
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
}): Promise<boolean> {
  const channel = `roi-calib:${opts.profileId}:${Date.now()}:${Math.random().toString(16).slice(2)}`;

  const win = createRoiCalibratorWindow({
    parent: opts.parent,
    screenRect: opts.bounds,
    pngB64: opts.screenshotPng.toString("base64"),
    initialRois: opts.existing ?? undefined,
    channel,
  });

  // FOLLOW: Fenster bewegt/resized mit
  let followIv: NodeJS.Timeout | null = null;
  if (opts.follow?.getBounds) {
    const intervalMs = opts.follow.intervalMs ?? 80;

    let last: Rectangle | null = null;
    const same = (a: Rectangle, b: Rectangle) =>
      a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

    const tick = () => {
      if (!win || win.isDestroyed()) return;
      const b = opts.follow!.getBounds();
      if (!b) return;
      if (last && same(last, b)) return;
      last = b;
      try {
        win.setBounds(b, false);
      } catch {}
    };

    tick();
    followIv = setInterval(tick, intervalMs);
    win.on("closed", () => {
      if (followIv) clearInterval(followIv);
      followIv = null;
    });
  }

  return await new Promise<boolean>((resolve) => {
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      try {
        ipcMain.removeAllListeners(channel);
        ipcMain.removeAllListeners(channel + ":debug");
      } catch {}
      if (followIv) {
        try {
          clearInterval(followIv);
        } catch {}
        followIv = null;
      }
    };

    ipcMain.once(channel, async (_e, payload: any) => {
      try {
        if (payload?.ok && payload?.rois) {
          await opts.onSave(payload.rois as HudRois);
          resolve(true);
        } else {
          resolve(false);
        }
      } catch (err) {
        console.error("[ROI CALIB] onSave failed:", err);
        resolve(false);
      } finally {
        cleanup();
        try {
          if (win && !win.isDestroyed()) win.close();
        } catch {}
      }
    });

    ipcMain.on(channel + ":debug", (_e, payload) => {
      try {
        console.log("[ROI CALIB DEBUG]", payload);
      } catch {}
    });

    win.on("closed", () => {
      if (!done) {
        cleanup();
        resolve(false);
      }
    });
  });
}

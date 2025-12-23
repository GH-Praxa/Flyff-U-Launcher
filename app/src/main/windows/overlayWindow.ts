import { BrowserWindow } from "electron";

export function createOverlayWindow(parent: BrowserWindow) {
  const win = new BrowserWindow({
    parent,
    frame: false,
    transparent: true,
    resizable: false, // wird im Edit-Modus per setResizable(true) aktiviert
    movable: true,
    show: true,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setMinimumSize(260, 180);

  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden;font-family:Segoe UI,Arial}

  #hud{
    position:absolute; inset:0;
    border-radius: 14px;
    border: 1px solid rgba(255,215,0,0.35);
    background: rgba(0,0,0,0.55);
    box-shadow: 0 10px 30px rgba(0,0,0,0.35);
    color:#ddd;
    user-select:none;
    overflow:hidden;
  }

  /* Edit-Mode: sichtbarer Rahmen */
  body.edit #hud{
    outline: 2px solid rgba(255,215,0,0.55);
    box-shadow: 0 0 0 2px rgba(0,0,0,0.35), 0 12px 34px rgba(0,0,0,0.45);
  }

  #top{
    display:flex; align-items:center; justify-content:space-between;
    padding:10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.10);
    background: rgba(0,0,0,0.35);
  }
  body.edit #top{ -webkit-app-region: drag; } /* ✅ Drag nur im Edit-Modus */
  #top *{ -webkit-app-region: no-drag; }

  #title{
    display:flex; gap:10px; align-items:center;
    font-weight:600; color:#ffd700;
  }
  #title .muted{font-weight:500;color:#bbb}
  #kbadge{
    padding:2px 8px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.06);
    color:#ddd;
    font-size:12px;
  }

  #grid{
    padding:10px 12px 12px 12px;
    display:grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap:8px;
  }

  .cell{
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(0,0,0,0.25);
    padding:8px 10px;
    line-height:1.15;
  }
  .lbl{font-size:11px;color:#aaa;margin-bottom:4px}
  .val{font-size:13px;color:#fff}

  .hidden{display:none !important;}

  #editHint{
    position:absolute;
    left:10px; bottom:10px;
    padding:6px 10px;
    border-radius: 999px;
    border:1px solid rgba(255,255,255,0.12);
    background: rgba(0,0,0,0.35);
    color:#ddd;
    font-size:12px;
    display:none;
  }
  body.edit #editHint{ display:block; }
</style>
</head>
<body>
  <div id="hud">
    <div id="top">
      <div id="title">
        <span id="name">—</span>
        <span class="muted">Lv:</span><span id="level">—</span>
      </div>
      <div id="kbadge">Kills: <span id="kills">0</span></div>
    </div>

    <div id="grid">
      <div class="cell" id="rowExp">
        <div class="lbl">EXP</div>
        <div class="val"><span id="exp">—</span></div>
      </div>

      <div class="cell" id="rowDeltaExp">
        <div class="lbl">Delta EXP</div>
        <div class="val"><span id="deltaExp">—</span></div>
      </div>

      <div class="cell" id="rowTotalExp">
        <div class="lbl">Gesamt EXP</div>
        <div class="val"><span id="totalExp">—</span></div>
      </div>

      <div class="cell" id="rowKillsSession">
        <div class="lbl">Kills (Session)</div>
        <div class="val"><span id="killsSession">0</span></div>
      </div>

      <div class="cell" id="rowKillsLifetime">
        <div class="lbl">Kills (Lifetime)</div>
        <div class="val"><span id="killsLifetime">0</span></div>
      </div>

      <div class="cell" id="rowKpm">
        <div class="lbl">KPM</div>
        <div class="val"><span id="kpm">0.0</span></div>
      </div>

      <div class="cell" id="rowKph">
        <div class="lbl">KPH</div>
        <div class="val"><span id="kph">0.0</span></div>
      </div>

      <div class="cell" id="rowSessionTime">
        <div class="lbl">Laufzeit</div>
        <div class="val"><span id="sessionTime">00:00:00</span></div>
      </div>

      <div class="cell" id="rowLastKill">
        <div class="lbl">Last</div>
        <div class="val"><span id="lastKill">—</span></div>
      </div>

      <div class="cell" id="rowAvgExpPerKill">
        <div class="lbl">ØEXP/Kill</div>
        <div class="val"><span id="avgExpKill">0.0000</span></div>
      </div>

      <div class="cell" id="rowExpPerMin">
        <div class="lbl">EXP/min</div>
        <div class="val"><span id="expPerMin">0.0000</span></div>
      </div>
    </div>

    <div id="editHint">Edit-Modus: oben ziehen, Rand ziehen zum Skalieren</div>
  </div>

<script>
  const { ipcRenderer } = require("electron");

  function fmt4(n){ if (typeof n !== "number" || !isFinite(n)) return "—"; return n.toFixed(4); }
  function fmtPct(n){ if (typeof n !== "number" || !isFinite(n)) return "—"; return n.toFixed(4) + "%"; }
  function fmtSigned4(n){
    if (typeof n !== "number" || !isFinite(n)) return "—";
    const s = (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(4);
    return s;
  }
  function fmtTime(ms){
    if (typeof ms !== "number" || !isFinite(ms) || ms < 0) ms = 0;
    const sec = Math.floor(ms/1000);
    const h = String(Math.floor(sec/3600)).padStart(2,"0");
    const m = String(Math.floor((sec%3600)/60)).padStart(2,"0");
    const s = String(sec%60).padStart(2,"0");
    return h+":"+m+":"+s;
  }

  function applySettings(s){
    const on = (k, def=true) => (s && typeof s[k] === "boolean") ? s[k] : def;

    document.getElementById("rowExp").classList.toggle("hidden", !on("showExp", true));
    document.getElementById("rowDeltaExp").classList.toggle("hidden", !on("showDeltaExp", true));
    document.getElementById("rowTotalExp").classList.toggle("hidden", !on("showTotalExp", true));

    document.getElementById("rowKillsSession").classList.toggle("hidden", !on("showKillsSession", false));
    document.getElementById("rowKillsLifetime").classList.toggle("hidden", !on("showKillsLifetime", false));
    document.getElementById("rowKpm").classList.toggle("hidden", !on("showKillsPerMinute", false));
    document.getElementById("rowKph").classList.toggle("hidden", !on("showKillsPerHour", false));

    document.getElementById("rowSessionTime").classList.toggle("hidden", !on("showSessionTime", false));
    document.getElementById("rowLastKill").classList.toggle("hidden", !on("showLastKill", false));
    document.getElementById("rowAvgExpPerKill").classList.toggle("hidden", !on("showAvgExpPerKill", false));
    document.getElementById("rowExpPerMin").classList.toggle("hidden", !on("showExpPerMinute", false));
  }

  ipcRenderer.on("hud:edit", (_e, payload) => {
    const on = !!payload?.on;
    document.body.classList.toggle("edit", on);
  });

  ipcRenderer.on("exp:update", (_e, payload) => {
    if (!payload) return;

    document.getElementById("name").textContent = payload.name ?? "—";
    document.getElementById("level").textContent = (payload.level ?? "—").toString();

    const st = payload.stats || {};
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    setText("exp", fmtPct(payload.expPct));
    setText("deltaExp", fmtSigned4(st.deltaExp));
    setText("totalExp", fmt4(st.totalExp));

    setText("kills", (st.killsSession ?? 0).toString());
    setText("killsSession", (st.killsSession ?? 0).toString());
    setText("killsLifetime", (st.killsLifetime ?? 0).toString());
    setText("kpm", (typeof st.kpm === "number" ? st.kpm.toFixed(1) : "0.0"));
    setText("kph", (typeof st.kph === "number" ? st.kph.toFixed(1) : "0.0"));
    setText("sessionTime", fmtTime(st.sessionMs ?? 0));
    setText("lastKill", st.lastKill ?? "—");
    setText("avgExpKill", (typeof st.avgExpPerKill === "number" ? st.avgExpPerKill.toFixed(4) : "0.0000"));
    setText("expPerMin", (typeof st.expPerMinute === "number" ? st.expPerMinute.toFixed(4) : "0.0000"));

    applySettings(payload.settings || null);
  });
</script>
</body>
</html>
`.trim();

  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html)).catch(() => {});
  return win;
}

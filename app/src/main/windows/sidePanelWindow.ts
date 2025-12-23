import { BrowserWindow } from "electron";

type OverlaySettings = {
  showExp?: boolean;
  showDeltaExp?: boolean;
  showTotalExp?: boolean;

  showKillsSession?: boolean;
  showKillsLifetime?: boolean;
  showKillsPerMinute?: boolean;
  showKillsPerHour?: boolean;

  showSessionTime?: boolean;
  showLastKill?: boolean;
  showAvgExpPerKill?: boolean;
  showExpPerMinute?: boolean;

  showResetButton?: boolean;
};

export function createSidePanelWindow(opts: { parent: BrowserWindow; profileId: string }) {
  const win = new BrowserWindow({
    parent: opts.parent,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    show: true,
    focusable: true,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");

  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden;font-family:Segoe UI,Arial}
  .panel{
    position:absolute; inset:10px;
    border-radius:14px;
    border:1px solid rgba(255,215,0,0.35);
    background:rgba(0,0,0,0.55);
    box-shadow: 0 10px 30px rgba(0,0,0,0.35);
    display:flex;
    flex-direction:column;
    overflow:hidden;
  }
  .top{
    display:flex; gap:8px;
    padding:10px;
    align-items:center;
    border-bottom:1px solid rgba(255,255,255,0.08);
    background:rgba(0,0,0,0.35);
  }
  .tabs{display:flex; gap:8px; flex:1}
  .tab{
    border-radius:10px;
    padding:8px 10px;
    border:1px solid rgba(255,255,255,0.10);
    background:rgba(255,255,255,0.06);
    color:#ddd;
    cursor:pointer;
    user-select:none;
    font-size:13px;
  }
  .tab.active{
    color:#ffd700;
    border-color:rgba(255,215,0,0.35);
    background:rgba(255,215,0,0.10);
  }
  .close{
    border-radius:10px;
    padding:8px 10px;
    border:1px solid rgba(255,255,255,0.10);
    background:rgba(255,255,255,0.06);
    color:#ddd;
    cursor:pointer;
  }
  .meta{
    color:#aaa;
    font-size:12px;
    padding:0 10px 10px 10px;
  }
  .body{
    padding:10px;
    overflow:auto;
    display:flex;
    flex-direction:column;
    gap:10px;
  }
  .row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    padding:10px;
    border-radius:12px;
    border:1px solid rgba(255,255,255,0.08);
    background:rgba(0,0,0,0.25);
    color:#ddd;
    font-size:13px;
  }
  .toggle{
    width:44px;height:24px;border-radius:999px;
    border:1px solid rgba(255,255,255,0.10);
    background:rgba(255,255,255,0.08);
    position:relative;
    cursor:pointer;
    flex:0 0 auto;
  }
  .toggle.on{
    border-color:rgba(255,215,0,0.35);
    background:rgba(255,215,0,0.18);
  }
  .knob{
    position:absolute; top:3px; left:3px;
    width:18px;height:18px;border-radius:50%;
    background:rgba(255,255,255,0.9);
    transition: transform .12s ease;
  }
  .toggle.on .knob{ transform: translateX(20px); }
</style>
</head>
<body>
  <div class="panel">
    <div class="top">
      <div class="tabs">
        <div class="tab active" data-tab="anzeige">Anzeige</div>
        <div class="tab" data-tab="settings">Settings</div>
        <div class="tab" data-tab="version">Version</div>
      </div>
      <button class="close" id="closeBtn">×</button>
    </div>
    <div class="meta">
      Overlay Profil: <b id="pid"></b>
    </div>

    <div class="body" id="body"></div>
  </div>

<script>
  const { ipcRenderer } = require("electron");

  const profileId = ${JSON.stringify(opts.profileId)};
  document.getElementById("pid").textContent = profileId;

  // lokale defaults (Main normalisiert ebenfalls)
  const defaults = {
    showExp: true,
    showDeltaExp: true,
    showTotalExp: false,
    showKillsSession: false,
    showKillsLifetime: false,
    showKillsPerMinute: false,
    showKillsPerHour: false,
    showSessionTime: false,
    showLastKill: false,
    showAvgExpPerKill: false,
    showExpPerMinute: false,
    showResetButton: true,
  };

  const labels = [
    ["showExp", "EXP-Anzeige im Overlay anzeigen"],
    ["showDeltaExp", "Delta EXP im Overlay anzeigen"],
    ["showTotalExp", "Gesamt EXP im Overlay anzeigen"],
    ["showKillsSession", "Kills Session im Overlay anzeigen"],
    ["showKillsLifetime", "Kills Lifetime im Overlay anzeigen"],
    ["showKillsPerMinute", "Kills pro Minute im Overlay anzeigen"],
    ["showKillsPerHour", "Kills pro Stunde im Overlay anzeigen"],
    ["showSessionTime", "Sitzungs-Zeit im Overlay anzeigen"],
    ["showLastKill", "Letzter Kill im Overlay anzeigen"],
    ["showAvgExpPerKill", "Ø EXP pro Kill im Overlay anzeigen"],
    ["showExpPerMinute", "EXP pro Minute im Overlay anzeigen"],
    ["showResetButton", "Reset-Button im Overlay anzeigen"],
  ];

  let settings = { ...defaults };
  let active = "anzeige";

  async function load() {
    try {
      const s = await ipcRenderer.invoke("overlaySettings:get", profileId);
      settings = { ...defaults, ...(s || {}) };
    } catch (e) {
      console.error("overlaySettings:get failed", e);
      settings = { ...defaults };
    }
    render();
  }

  async function patch(key, value) {
    try {
      const res = await ipcRenderer.invoke("overlaySettings:patch", profileId, { [key]: value });
      settings = { ...defaults, ...(res || {}) };
    } catch (e) {
      console.error("overlaySettings:patch failed", e);
      // lokal trotzdem umschalten, damit UI nicht "hängt"
      settings[key] = value;
    }
    render();
  }

  function render() {
    const body = document.getElementById("body");
    body.innerHTML = "";

    if (active !== "anzeige") {
      const row = document.createElement("div");
      row.className = "row";
      row.textContent = active === "settings"
        ? "Hier kommen später globale Einstellungen rein."
        : "Version/Debug kommt später.";
      body.append(row);
      return;
    }

    for (const [key, text] of labels) {
      const row = document.createElement("div");
      row.className = "row";

      const l = document.createElement("div");
      l.textContent = text;

      const on = !!settings[key];

      const t = document.createElement("div");
      t.className = "toggle" + (on ? " on" : "");
      const k = document.createElement("div");
      k.className = "knob";
      t.appendChild(k);

      t.onclick = () => patch(key, !on);

      row.append(l, t);
      body.append(row);
    }
  }

  for (const el of document.querySelectorAll(".tab")) {
    el.onclick = () => {
      for (const t of document.querySelectorAll(".tab")) t.classList.remove("active");
      el.classList.add("active");
      active = el.dataset.tab;
      render();
    };
  }

  document.getElementById("closeBtn").onclick = () => {
    ipcRenderer.send("sidepanel:toggle");
  };

  load();
</script>
</body>
</html>
`.trim();

  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html)).catch(() => {});
  return win;
}

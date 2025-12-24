import { BrowserWindow } from "electron";

export function createHudSideTabWindow(parent: BrowserWindow) {
  const win = new BrowserWindow({
    parent,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    show: true,
    focusable: true,
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

  win.setMenuBarVisibility(false);
  win.setAutoHideMenuBar(true);
  win.setMenu(null);
  win.setAlwaysOnTop(true, "screen-saver");

  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden;font-family:Segoe UI,Arial}
  :root{
    --gold2: rgba(255,215,0,0.25);
    --bg: rgba(0,0,0,0.55);
    --line: rgba(255,255,255,0.10);
    --txt: #e9e9e9;
    --muted: rgba(255,255,255,0.60);
    --brown2: rgba(160,110,60,0.22);
  }
  #root{width:100%;height:100%;display:flex;justify-content:flex-end;pointer-events:auto;}
  #handle{width:44px;height:100%;display:flex;align-items:flex-start;justify-content:center;padding-top:10px;}
  #toggle{width:34px;height:34px;border-radius:12px;border:1px solid var(--gold2);background:var(--bg);color:#ffd700;cursor:pointer;font-size:14px;display:grid;place-items:center;}
  #toggle:hover{background:rgba(0,0,0,0.70);}
  #resizeGrip{position:absolute;left:44px;top:0;width:8px;height:100%;cursor:ew-resize;background:transparent;}
  #panel{
    width: calc(100% - 44px);
    height: 100%;
    border-radius: 16px 0 0 16px;
    border:1px solid var(--gold2);
    border-right:none;
    background: linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.35));
    box-shadow: 0 12px 40px rgba(0,0,0,0.35);
    overflow:hidden;display:flex;flex-direction:column;
  }
  #tabs{display:flex;gap:10px;padding:10px 10px 8px 10px;border-bottom:1px solid var(--line);}
  .tab{border:1px solid var(--line);background:rgba(255,255,255,0.06);color:var(--txt);border-radius:12px;padding:8px 10px;cursor:pointer;font-size:12px;}
  .tab.active{border-color:rgba(255,215,0,0.55);background:rgba(255,215,0,0.12);color:#ffd700;}
  #content{padding:10px;display:flex;flex-direction:column;gap:10px;overflow:auto;}
  .section{border:1px solid var(--line);background:rgba(0,0,0,0.25);border-radius:14px;padding:10px;}
  .sectionTitle{font-size:12px;color:var(--muted);margin-bottom:8px;}
  .row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border-radius:14px;border:1px solid rgba(255,255,255,0.10);background:rgba(0,0,0,0.22);margin-bottom:10px;}
  .row:last-child{margin-bottom:0;}
  .label{font-size:12px;color:var(--txt);}
  .hint{font-size:11px;color:var(--muted);margin-top:6px;}
  .btn{border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.08);color:var(--txt);border-radius:12px;padding:10px 12px;cursor:pointer;font-size:12px;}
  .btn:hover{background:rgba(255,255,255,0.12);}
  .btnBrown{border-color:rgba(160,110,60,0.55);background:var(--brown2);color:#f2d7bf;}
  .btnBrown:hover{background:rgba(160,110,60,0.30);}
  .btnLock{width:42px;height:34px;padding:0;display:grid;place-items:center;border-radius:12px;}
  .pill{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:12px;border:1px solid rgba(255,255,255,0.10);background:rgba(0,0,0,0.22);color:var(--muted);font-size:11px;}
</style>
</head>
<body>
  <div id="root">
    <div id="handle">
      <button id="toggle" title="Panel ein-/ausblenden">X</button>
    </div>

    <div id="resizeGrip" title="Breite ziehen"></div>

    <div id="panel">
      <div id="tabs">
        <button class="tab active" data-tab="display">Anzeige</button>
        <button class="tab" data-tab="settings">Settings</button>
        <button class="tab" data-tab="version">Version</button>
        <button class="tab" data-tab="debug">Debug</button>
      </div>

      <div id="content"></div>
    </div>
  </div>

<script>
  const { ipcRenderer } = require("electron");

  let profileId = null;
  let editOn = false;

  const log = (msg) => ipcRenderer.send("hudpanel:log", msg);

  log("[hudSideTabWindow] loaded");

  document.getElementById("toggle").onclick = () => ipcRenderer.send("hudpanel:toggle");

  const grip = document.getElementById("resizeGrip");
  let resizing = false, startX = 0, startW = 0;

  grip.addEventListener("mousedown", (e) => {
    resizing = true;
    startX = e.clientX;
    startW = window.innerWidth;
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!resizing) return;
    const dx = startX - e.clientX;
    const next = Math.max(240, Math.min(720, startW + dx));
    ipcRenderer.send("hudpanel:setWidth", { width: next });
  });

  window.addEventListener("mouseup", () => { resizing = false; });

  const content = document.getElementById("content");
  const tabs = Array.from(document.querySelectorAll(".tab"));

  function setTab(name){
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    renderTab(name);
  }
  tabs.forEach(t => t.onclick = () => setTab(t.dataset.tab));

  const state = {
    showExp: true, showDelta: true, showTotal: false, showKillsSession: false, showKillsLifetime: false,
  };

  function makeToggleRow(label, key){
    const row = document.createElement("div");
    row.className = "row";

    const l = document.createElement("div");
    l.className = "label";
    l.textContent = label;

    const sw = document.createElement("div");
    sw.className = "switch" + (state[key] ? " on" : "");
    sw.onclick = () => {
      state[key] = !state[key];
      sw.classList.toggle("on", state[key]);
    };

    row.append(l, sw);
    return row;
  }

  async function openRoiCalib(){
    if(!profileId){
      log("roi:open blocked (profileId null)");
      return;
    }
    try{
      log("roi:open invoke => " + profileId);
      await ipcRenderer.invoke("roi:open", profileId);
      return;
    }catch(e1){
      log("roi:open invoke(string) failed: " + (e1?.message || e1));
    }
    try{
      await ipcRenderer.invoke("roi:open", { profileId });
      return;
    }catch(e2){
      log("roi:open invoke(obj) failed: " + (e2?.message || e2));
    }
    try{
      ipcRenderer.send("roi:open", profileId);
      return;
    }catch(e3){
      log("roi:open send(string) failed: " + (e3?.message || e3));
    }
    try{
      ipcRenderer.send("roi:open", { profileId });
    }catch(e4){
      log("roi:open send(obj) failed: " + (e4?.message || e4));
    }
  }

  function renderTab(name){
    content.innerHTML = "";

    if(name === "display"){
      const sec = document.createElement("div");
      sec.className = "section";
      sec.innerHTML = '<div class="sectionTitle">Anzeige (Platzhalter)</div>';
      content.append(sec);
      return;
    }

    if(name === "settings"){
      const sec = document.createElement("div");
      sec.className = "section";
      sec.innerHTML = '<div class="sectionTitle">Settings</div><div class="hint">kommt spÃ¤ter</div>';
      content.append(sec);
      return;
    }

    if(name === "version"){
      const sec = document.createElement("div");
      sec.className = "section";
      sec.innerHTML = '<div class="sectionTitle">Version</div><div class="hint">v0.3</div>';
      content.append(sec);
      return;
    }

    if(name === "debug"){
      const sec = document.createElement("div");
      sec.className = "section";
      sec.innerHTML = '<div class="sectionTitle">Debug</div>';

      const pill = document.createElement("div");
      pill.className = "pill";
      pill.textContent = "Overlay-Profil: " + (profileId ?? "â€”");

      const row1 = document.createElement("div");
      row1.className = "row";
      const l1 = document.createElement("div");
      l1.className = "label";
      l1.textContent = "HUD bearbeiten";
      const lockBtn = document.createElement("button");
      lockBtn.className = "btn btnLock";
      lockBtn.textContent = editOn ? "ðŸ”“" : "ðŸ”’";
      lockBtn.onclick = () => ipcRenderer.send("hud:toggleEdit");
      row1.append(l1, lockBtn);

      const row2 = document.createElement("div");
      row2.className = "row";
      const l2 = document.createElement("div");
      l2.className = "label";
      l2.textContent = "ROI Kalibrierung";
      const calibBtn = document.createElement("button");
      calibBtn.className = "btn btnBrown";
      calibBtn.textContent = "Kalibrieren";
      calibBtn.disabled = !profileId;
      calibBtn.onclick = () => openRoiCalib();
      row2.append(l2, calibBtn);

      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "Kalibrieren nutzt roi:open. Logs erscheinen im Main-Terminal (HUDPANEL).";

      sec.append(pill, row1, row2, hint);
      content.append(sec);
      return;
    }
  }

  renderTab("display");

  ipcRenderer.on("exp:update", (_e, payload) => {
    if(payload && payload.profileId){
      profileId = payload.profileId;
      // wenn debug offen: refresh
      const active = (document.querySelector(".tab.active") || {}).dataset?.tab;
      if(active === "debug") renderTab("debug");
    }
  });

  ipcRenderer.on("hud:edit", (_e, payload) => {
    editOn = !!payload?.on;
    const active = (document.querySelector(".tab.active") || {}).dataset?.tab;
    if(active === "debug") renderTab("debug");
  });
</script>
</body>
</html>
`.trim();

  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html)).catch(() => {});
  return win;
}


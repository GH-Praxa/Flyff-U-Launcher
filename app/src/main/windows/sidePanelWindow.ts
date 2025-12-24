import { BrowserWindow } from "electron";

export function createSidePanelWindow(parent: BrowserWindow) {
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

  // âœ… MenÃ¼leiste weg
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
    --gold: rgba(255,215,0,0.55);
    --gold2: rgba(255,215,0,0.25);
    --line: rgba(255,255,255,0.10);
    --txt: #e9e9e9;
    --muted: rgba(255,255,255,0.60);
    --brown2: rgba(160,110,60,0.22);
  }

  #root{
    width: 100%;
    height: 100%;
    display:flex;
    justify-content:flex-end;
    pointer-events:auto;
  }

  #handle{
    width: 44px;
    height: 100%;
    display:flex;
    align-items:flex-start;
    justify-content:center;
    padding-top: 10px;
  }

  #toggle{
    width: 34px;
    height: 34px;
    border-radius: 12px;
    border:1px solid var(--gold2);
    background: rgba(0,0,0,0.55);
    color: #ffd700;
    cursor:pointer;
    font-size: 14px;
    display:grid;
    place-items:center;
  }
  #toggle:hover{ background: rgba(0,0,0,0.70); }

  #panel{
    width: calc(100% - 44px);
    height: 100%;
    border-radius: 16px 0 0 16px;
    border:1px solid var(--gold2);
    border-right: none;
    background: linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.35));
    box-shadow: 0 12px 40px rgba(0,0,0,0.35);
    overflow:hidden;
    display:flex;
    flex-direction:column;
  }

  #tabs{
    display:flex;
    gap:10px;
    padding: 10px 10px 8px 10px;
    border-bottom: 1px solid var(--line);
  }

  .tab{
    border:1px solid var(--line);
    background: rgba(255,255,255,0.06);
    color: var(--txt);
    border-radius: 12px;
    padding: 8px 10px;
    cursor:pointer;
    font-size: 12px;
  }
  .tab.active{
    border-color: var(--gold);
    background: rgba(255,215,0,0.12);
    color: #ffd700;
  }

  #content{
    padding: 10px;
    display:flex;
    flex-direction:column;
    gap:10px;
    overflow:auto;
  }

  .section{
    border:1px solid var(--line);
    background: rgba(0,0,0,0.25);
    border-radius: 14px;
    padding: 10px;
  }
  .sectionTitle{
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 8px;
  }

  .row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    padding: 10px;
    border-radius: 14px;
    border:1px solid rgba(255,255,255,0.10);
    background: rgba(0,0,0,0.22);
    margin-bottom: 10px;
  }
  .row:last-child{ margin-bottom: 0; }

  .label{ font-size: 12px; color: var(--txt); }
  .hint{ font-size: 11px; color: var(--muted); margin-top: 6px; }

  .switch{
    position:relative;
    width: 44px;
    height: 24px;
    background: rgba(255,255,255,0.10);
    border:1px solid rgba(255,255,255,0.10);
    border-radius: 999px;
    cursor:pointer;
    flex: 0 0 auto;
  }
  .switch::after{
    content:"";
    position:absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: rgba(255,255,255,0.60);
    transition: all 120ms ease;
  }
  .switch.on{
    background: rgba(255,215,0,0.20);
    border-color: var(--gold2);
  }
  .switch.on::after{
    left: 22px;
    background: rgba(255,215,0,0.90);
  }

  .btn{
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.08);
    color: var(--txt);
    border-radius: 12px;
    padding: 10px 12px;
    cursor:pointer;
    font-size: 12px;
  }
  .btn:hover{ background: rgba(255,255,255,0.12); }

  .btnBrown{
    border-color: rgba(160,110,60,0.55);
    background: var(--brown2);
    color: #f2d7bf;
  }
  .btnBrown:hover{ background: rgba(160,110,60,0.30); }

  #resizeGrip{
    position:absolute;
    left: 44px;
    top: 0;
    width: 8px;
    height: 100%;
    cursor: ew-resize;
    background: transparent;
  }
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

  // --- Open/Close ---
  document.getElementById("toggle").onclick = () => {
    ipcRenderer.send("hudpanel:toggle");
  };

  // --- Resize (sends absolute width) ---
  const grip = document.getElementById("resizeGrip");
  let resizing = false;
  let startX = 0;
  let startW = 0;

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

  window.addEventListener("mouseup", () => {
    resizing = false;
  });

  // --- Tabs ---
  const content = document.getElementById("content");
  const tabs = Array.from(document.querySelectorAll(".tab"));

  function setTab(name){
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    renderTab(name);
  }

  tabs.forEach(t => {
    t.onclick = () => setTab(t.dataset.tab);
  });

  // dummy state (nur UI â€“ Funktionen kommen spÃ¤ter)
  const state = {
    showExp: true,
    showDelta: true,
    showTotal: false,
    showKillsSession: false,
    showKillsLifetime: false,
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

  async function getActiveOverlayProfileId(){
    try{
      return await ipcRenderer.invoke("profiles:getOverlayTargetId");
    }catch(e){
      console.error("profiles:getOverlayTargetId failed", e);
      return null;
    }
  }

  function renderTab(name){
    content.innerHTML = "";

    if(name === "display"){
      const sec = document.createElement("div");
      sec.className = "section";
      sec.innerHTML = '<div class="sectionTitle">Anzeige (Platzhalter)</div>';
      sec.append(
        makeToggleRow("EXP-Anzeige im Overlay anzeigen", "showExp"),
        makeToggleRow("Delta EXP im Overlay anzeigen", "showDelta"),
        makeToggleRow("Gesamt EXP im Overlay anzeigen", "showTotal"),
        makeToggleRow("Kills Session im Overlay anzeigen", "showKillsSession"),
        makeToggleRow("Kills Lifetime im Overlay anzeigen", "showKillsLifetime"),
      );
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

      const btn = document.createElement("button");
      btn.className = "btn btnBrown";
      btn.textContent = "Kalibrieren (ROI)";
      btn.onclick = async () => {
        try{
          const pid = await getActiveOverlayProfileId();
          if(!pid) return;
          await ipcRenderer.invoke("roi:open", pid);
        }catch(e){
          console.error("roi:open failed", e);
        }
      };

      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "Ã–ffnet das ROI-Kalibrierfenster fÃ¼r das aktuelle Overlay-Profil.";

      sec.append(btn, hint);
      content.append(sec);
      return;
    }
  }

  renderTab("display");
</script>
</body>
</html>
`.trim();

  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html)).catch(() => {});
  return win;
}


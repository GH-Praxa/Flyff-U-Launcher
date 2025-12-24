import { BrowserWindow } from "electron";

export function createOverlayWindow(parent: BrowserWindow) {
  const win = new BrowserWindow({
    parent,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
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

  // click-through by default, aber Maus an Spiel weiterreichen:
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setAlwaysOnTop(true, "screen-saver");

  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden;font-family:Segoe UI,Arial}
  /* Cursor ausblenden, damit der Spielecursor sichtbar bleibt (außer im Edit-Modus) */
  body{ cursor: none; }
  body.edit{ cursor: default; }
  body:not(.edit) *{ cursor: none; }
  #box{
    position:fixed; left:0; top:0;
    padding:10px 12px;
    border-radius:14px;
    border:1px solid rgba(255,215,0,0.28);
    background: rgba(0,0,0,0.55);
    color:#eaeaea;
    box-shadow: 0 10px 30px rgba(0,0,0,0.35);
    user-select:none;
    cursor: none;
    min-width: 160px;
  }
  #title{font-weight:600;font-size:12px;opacity:0.9;margin-bottom:6px}
  #exp{font-size:22px;font-weight:700;letter-spacing:0.5px}
  #raw{margin-top:6px;font-size:11px;opacity:0.6}

  /* edit mode visuals */
  body.edit #box{
    outline: 1px dashed rgba(255,215,0,0.55);
    cursor: move;
  }
  #resize{
    position:absolute;
    right:6px; bottom:6px;
    width:14px; height:14px;
    border-radius:4px;
    border:1px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.06);
    display:none;
    cursor: nwse-resize;
  }
  body.edit #resize{ display:block; }

  #lockHint{
    position:absolute;
    left:10px; bottom:-18px;
    font-size:10px; opacity:0.55;
    display:none;
  }
  body.edit #lockHint{ display:block; }
</style>
</head>
<body>
  <div id="box">
    <div id="title">—</div>
    <div id="exp">EXP: —</div>
    <div id="raw"></div>
    <div id="resize" title="Resize"></div>
    <div id="lockHint">Edit aktiv (rechte Maus: aus)</div>
  </div>

<script>
  const { ipcRenderer } = require("electron");

  const box = document.getElementById("box");
  const title = document.getElementById("title");
  const expEl = document.getElementById("exp");
  const rawEl = document.getElementById("raw");
  const resize = document.getElementById("resize");

  let edit = false;
  let dragging = false;
  let resizing = false;

  let dragStart = { x:0, y:0, px:0, py:0 };
  let sizeStart = { x:0, y:0, w:0, h:0 };
  let hudPos = { x:0, y:0 };

  function setEdit(on){
    edit = !!on;
    document.body.classList.toggle("edit", edit);
    // in edit mode müssen clicks im overlay bleiben:
    ipcRenderer.send("overlay:toggleEdit", { on: edit });
  }

  // rechte maus toggelt edit (schnell)
  window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    setEdit(!edit);
  });

  // load initial bounds from main (optional)
  async function loadBounds(){
    try{
      const b = await ipcRenderer.invoke("hud:getBounds");
      if(b && typeof b.x==="number"){
        hudPos.x = b.x;
        hudPos.y = b.y;
        if(typeof b.width === "number" && b.width > 0){
          box.style.width = b.width + "px";
          box.style.minWidth = b.width + "px";
        }
        if(typeof b.height === "number" && b.height > 0){
          box.style.height = b.height + "px";
          box.style.minHeight = b.height + "px";
        }
        if(typeof b.editOn === "boolean"){
          setEdit(b.editOn);
        }
      }
    }catch{}
  }
  loadBounds();

  // drag
  box.addEventListener("mousedown", (e) => {
    if(!edit) return;
    // resize handle handled separately
    if(e.target === resize) return;
    dragging = true;
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
    dragStart.px = hudPos.x;
    dragStart.py = hudPos.y;
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if(dragging){
      const nx = dragStart.px + (e.clientX - dragStart.x);
      const ny = dragStart.py + (e.clientY - dragStart.y);
      hudPos.x = nx;
      hudPos.y = ny;
      ipcRenderer.send("overlay:setBounds", { x:nx, y:ny });
    }
    if(resizing){
      const dx = e.clientX - sizeStart.x;
      const dy = e.clientY - sizeStart.y;
      const nw = Math.max(140, sizeStart.w + dx);
      const nh = Math.max(60, sizeStart.h + dy);
      box.style.width = nw + "px";
      box.style.height = nh + "px";
      ipcRenderer.send("overlay:setSize", { width:nw, height:nh });
    }
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
    resizing = false;
  });

  // resize
  resize.addEventListener("mousedown", (e) => {
    if(!edit) return;
    resizing = true;
    sizeStart.x = e.clientX;
    sizeStart.y = e.clientY;
    sizeStart.w = box.getBoundingClientRect().width;
    sizeStart.h = box.getBoundingClientRect().height;
    e.preventDefault();
    e.stopPropagation();
  });

  ipcRenderer.on("overlay:edit", (_e, payload) => {
    edit = !!payload?.on;
    document.body.classList.toggle("edit", edit);
  });

  ipcRenderer.on("exp:update", (_e, payload) => {
    if(!payload) return;
    const nm = payload.name ?? "—";
    const lvl = payload.level != null ? ("Lv " + payload.level) : "";
    title.textContent = (nm + " " + lvl).trim();

    if(payload.expPct != null){
      expEl.textContent = "EXP: " + Number(payload.expPct).toFixed(4) + "%";
    }
    const raw = payload.rawExp ? ("rawExp: " + payload.rawExp) : "";
    rawEl.textContent = raw;
  });
</script>
</body>
</html>
`.trim();

  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html)).catch(() => {});
  return win;
}

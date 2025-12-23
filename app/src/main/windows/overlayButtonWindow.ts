import { BrowserWindow } from "electron";

export function createOverlayButtonWindow(opts: { parent: BrowserWindow }) {
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

  // Wichtig: über dem Game
  win.setAlwaysOnTop(true, "screen-saver");

  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden}
  button{
    width:100vw;height:100vh;border-radius:10px;
    border:1px solid rgba(255,215,0,0.35);
    background:rgba(0,0,0,0.45);
    color:#ffd700;
    display:grid;place-items:center;
    cursor:pointer;
    user-select:none;
  }
  button:hover{background:rgba(0,0,0,0.62)}
  svg{width:18px;height:18px;opacity:.95}
</style>
</head>
<body>
<button id="b" title="Overlay Panel">
  <!-- simple gear icon -->
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/>
    <path d="M19.4 15a7.8 7.8 0 0 0 .1-1l2-1.5-2-3.5-2.4 1a7.2 7.2 0 0 0-1.7-1L15 6h-6l-.4 3a7.2 7.2 0 0 0-1.7 1L4.5 9 2.5 12.5l2 1.5a7.8 7.8 0 0 0 .1 1l-2 1.5 2 3.5 2.4-1a7.2 7.2 0 0 0 1.7 1L9 22h6l.4-3a7.2 7.2 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5Z"/>
  </svg>
</button>

<script>
  const { ipcRenderer } = require("electron");
  document.getElementById("b").onclick = () => {
    ipcRenderer.send("sidepanel:toggle");
  };
</script>
</body>
</html>
`.trim();

  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html)).catch(() => {});
  return win;
}

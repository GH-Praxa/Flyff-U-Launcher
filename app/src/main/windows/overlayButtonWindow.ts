import { BrowserWindow, ipcMain } from "electron";
import type { IpcMainEvent } from "electron";
import { debugLog } from "../debugConfig";

export function createOverlayButtonWindow(opts: {
  parent: BrowserWindow;
  preloadPath?: string;
  onToggle?: () => void;
  profileId?: string | null;
  focusable?: boolean;
  clickThrough?: boolean;
}) {
  const win = new BrowserWindow({
    parent: opts.parent,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    show: false,
    focusable: opts.focusable ?? true,
    acceptFirstMouse: true,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: false,
    width: 36,
    height: 36,
    webPreferences: {
      preload: opts?.preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  // Keep button above the parent view without staying above external windows
  win.setAlwaysOnTop(false);
  win.setMenuBarVisibility(false);
  win.setAutoHideMenuBar(true);

  debugLog("roiOverlaySync", "[OverlayButton] Window created, onToggle defined:", !!opts.onToggle);

  const wcId = win.webContents.id;

  const handleToggle = (payload: any) => {
    // 1) optionaler Callback (dein Wunsch aus dem Log)
    if (opts.onToggle) {
      try {
        opts.onToggle();
      } catch (err) {
        console.error("[OverlayButton] onToggle threw:", err);
      }
    } else {
      console.warn("[OverlayButton] Toggle received but onToggle is not set. Payload:", payload);
    }

    // 2) If you have an additional/alternative central toggle system,
    //    kannst du hier weiterleiten (optional, auskommentiert):
    // opts.parent.webContents.send("sidepanel:toggle", payload);
  };

  // A) Normaler Weg: Renderer sendet IPC (via preload: window.ipc.send)
  const ipcHandler = (e: IpcMainEvent, payload: any) => {
    if (!e?.sender || e.sender.id !== wcId) return; // nur dieses Fenster
    handleToggle(payload);
  };
  ipcMain.on("sidepanel:toggle", ipcHandler);

  // B) Fallback: falls preload fehlt, schreibt die Seite "IPC|{...}" in die Konsole
  // Use new Event-based API for console-message (old arguments are deprecated)
  const consoleHandler = (event: Electron.Event & { message: string }) => {
    const message = event.message;
    if (!message || typeof message !== "string") return;
    if (!message.startsWith("IPC|")) return;

    const raw = message.slice(4);
    try {
      const parsed = JSON.parse(raw) as { channel?: string; payload?: any };
      if (parsed?.channel === "sidepanel:toggle") {
        handleToggle(parsed.payload);
      }
    } catch {
      // absichtlich still – keine Log-Spam-Schleife
    }
  };
  win.webContents.on("console-message", consoleHandler);

  // Cleanup both handlers when window is closed
  win.on("closed", () => {
    ipcMain.removeListener("sidepanel:toggle", ipcHandler);
  });

  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html,body{margin:0;padding:0;overflow:hidden;background:transparent}
  body.ct-none,body.ct-none *{cursor:none}
  #b{
    width:100vw;height:100vh;border-radius:8px;
    border:1px solid rgba(255,215,0,0.4);
    background:rgb(30,30,30);
    color:#ffd700;
    display:grid;place-items:center;
    cursor:pointer;
    user-select:none;
    -webkit-app-region: drag;
  }
  #hotspot{
    -webkit-app-region: no-drag;
    display:grid;
    place-items:center;
    width:24px;
    height:24px;
  }
  #b:hover{background:rgb(50,50,50)}
  svg{width:18px;height:18px;opacity:.9}
</style>
</head>
<body>
<div id="b" title="Overlay Settings">
  <div id="hotspot">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/>
      <path d="M19.4 15a7.8 7.8 0 0 0 .1-1l2-1.5-2-3.5-2.4 1a7.2 7.2 0 0 0-1.7-1L15 6h-6l-.4 3a7.2 7.2 0 0 0-1.7 1L4.5 9 2.5 12.5l2 1.5a7.8 7.8 0 0 0 .1 1l-2 1.5 2 3.5 2.4-1a7.2 7.2 0 0 0 1.7 1L9 22h6l.4-3a7.2 7.2 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5Z"/>
    </svg>
  </div>
</div>
<script>
  const CLICK_THROUGH = ${opts.clickThrough ? "true" : "false"};
  if (CLICK_THROUGH) {
    document.body.classList.add("ct-none");
  }

  // Current profile (set by main process)
  window.__profileId = ${JSON.stringify(opts.profileId ?? "")};

  // Allows later updating of the profile ID by the main process
  window.__setProfileId = function(pid){
    window.__profileId = pid || "";
    const btn = document.getElementById("b");
    if(btn){
      btn.title = pid ? ("Overlay Settings (" + pid + ")") : "Overlay Settings";
    }
  };

  // Click sends toggle to main; if preload missing, via console IPC
  function sendToggle(){
    const payload = { focusTab: "roi", profileId: window.__profileId || undefined };
    if(window.ipc?.send){
      window.ipc.send("sidepanel:toggle", payload);
      return;
    }
    try{
      console.log("IPC|" + JSON.stringify({ channel:"sidepanel:toggle", payload }));
    }catch{
      console.log("IPC|" + JSON.stringify({ channel:"sidepanel:toggle", payload:{error:"serialize_failed", focusTab:"roi", profileId: window.__profileId || undefined} }));
    }
  }

  const btn = document.getElementById("hotspot");
  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    sendToggle();
  });
</script>
</body>
</html>
`.trim();

  win
    .loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html))
    .catch((err) => console.error("[OverlayButtonWindow] load failed", err));

  return win;
}

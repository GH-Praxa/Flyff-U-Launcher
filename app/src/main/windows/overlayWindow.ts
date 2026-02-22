import { BrowserWindow } from "electron";
import { debugLog, getDebugConfig } from "../debugConfig";
import type { Locale } from "../../shared/schemas";
export type OverlayWindowHandle = BrowserWindow & {
    /** Re-bind the move handler to a new parent window. */
    updateParent(newParent: BrowserWindow): void;
};

export function createOverlayWindow(parent: BrowserWindow, opts?: {
    preloadPath?: string;
    role?: "fighter" | "support";
    locale?: Locale;
}): OverlayWindowHandle {
    const overlayLocale = opts?.locale || "en";
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
            preload: opts?.preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
        },
    });
    // Always click-through to the game (no cursor changes)
    win.setIgnoreMouseEvents(true);
    // Keep overlay above the host surface so badges/ROIs stay visible
    win.setAlwaysOnTop(true, "screen-saver");

    // Track move state to hide overlay during drag (prevents flicker)
    let moveTimeout: NodeJS.Timeout | null = null;
    let currentParent: BrowserWindow = parent;

    const onParentMove = () => {
        if (win.isDestroyed()) return;
        win.setOpacity(0);
        if (moveTimeout) clearTimeout(moveTimeout);
        moveTimeout = setTimeout(() => {
            if (win.isDestroyed()) return;
            win.setOpacity(1);
        }, 100);
    };

    currentParent.on("move", onParentMove);

    // Visibility is managed entirely by the sync loop in overlays.ts.
    // This avoids conflicts from stale parent references after setParentWindow.

    const handle = win as OverlayWindowHandle;
    handle.updateParent = (newParent: BrowserWindow) => {
        if (newParent === currentParent) return;
        currentParent.removeListener("move", onParentMove);
        currentParent = newParent;
        currentParent.on("move", onParentMove);
        win.setParentWindow(newParent);
    };
    win.webContents.on("console-message", (_event, level, message) => {
        // Always log overlay console messages for debugging
        console.log(`[OverlayWindow][${level}] ${message}`);
        debugLog("roiOverlaySync", `[OverlayWindow console][${level}] ${message}`);
    });
    // Debug: Open DevTools for overlay window (temporary)
    // if (!require("electron").app.isPackaged) {
    //     win.webContents.openDevTools({ mode: "detach" });
    // }
    const debugOverlay = getDebugConfig().roiOverlaySync;
    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden}
  #roiLayer{
    position:fixed;
    inset:0;
    pointer-events:none;
    z-index: 1;
  }
  .roiBox{
    position:absolute;
    border:2px dashed rgba(0,150,255,0.85);
    background: rgba(0,150,255,0.15);
    border-radius:4px;
    color: white;
    font: 12px Segoe UI, Arial, sans-serif;
    padding: 2px 4px;
  }
  #pluginOverlays{
    position:fixed;
    inset:0;
    pointer-events:none;
    z-index: 2;
  }
  #pluginOverlays iframe{
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    border:none;
    background:transparent;
    pointer-events:none;
  }
</style>
</head>
<body>
  <div id="roiLayer"></div>
  <div id="pluginOverlays"></div>

<script>
  const DEBUG_OVERLAY = ${debugOverlay};
  const OVERLAY_ROLE = ${JSON.stringify(opts?.role ?? "fighter")};
  window.__overlayLocale = "${overlayLocale}";
  const ipcBridge = window.ipc;
  if(!ipcBridge){
    throw new Error("ipc bridge missing");
  }

  // Unwrap IpcResult format {ok, data, error}
  async function invokeMain(channel, ...args) {
    const result = await ipcBridge.invoke(channel, ...args);
    if (result && typeof result === "object" && "ok" in result) {
      if (result.ok) {
        return result.data;
      } else {
        throw new Error(result.error || "IPC call failed");
      }
    }
    return result;
  }

  const roiLayer = document.getElementById("roiLayer");
  const pluginContainer = document.getElementById("pluginOverlays");
  const ROI_KEYS = ["lvl", "charname", "exp", "lauftext", "rmExp", "enemyName", "enemyHp"];
  const showFighter = OVERLAY_ROLE !== "support";
  const showSupport = OVERLAY_ROLE !== "fighter";
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
  let roiData = null;
  let roiVis = null;
  let supportRoiData = null;
  let supportRoiVis = null;
  let currentOverlayProfileId = null;
  let currentSupportProfileId = null;
  const pluginFrames = [];

  // Expose plugin channel invoker for plugin overlays
  window.invokePluginChannel = async function(pluginId, channel, ...args) {
    if (!ipcBridge?.invoke) throw new Error("IPC not available");
    const res = await ipcBridge.invoke("plugins:invokeChannel", pluginId, channel, ...args);
    if (res && typeof res === "object") {
      if ("ok" in res) {
        return res.ok ? (res.data ?? null) : Promise.reject(new Error(res.error || "plugin invoke failed"));
      }
      const inner = res.data;
      if (inner && typeof inner === "object" && "ok" in inner) {
        return inner.ok ? (inner.data ?? null) : Promise.reject(new Error(inner.error || "plugin invoke failed"));
      }
    }
    return res ?? null;
  };

  function renderRois(){
    if(DEBUG_OVERLAY) {
      console.log("[ROI Overlay] renderRois", { roiData, roiVis, supportRoiData, supportRoiVis });
      console.log("[ROI Overlay DEBUG] ROI_KEYS:", ROI_KEYS, "roiData keys:", roiData ? Object.keys(roiData) : null, "roiVis:", roiVis);
    }
    if(!roiLayer) return;
    roiLayer.innerHTML = "";
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Render fighter profile ROIs (all except rmExp)
    if(showFighter && roiData) {
      ROI_KEYS.filter(k => k !== "rmExp").forEach((k) => {
        if(DEBUG_OVERLAY) console.log("[ROI Overlay DEBUG] checking key:", k, "roiVis[k]:", roiVis?.[k], "roiData[k]:", roiData[k]);
        if (roiVis && roiVis[k] === false) return;
        const r = roiData[k];
        if (!r) return;
        const div = document.createElement("div");
        div.className = "roiBox";
        const stroke = ROI_COLORS[k] || "rgba(0,150,255,0.85)";
        const fill = ROI_FILLS[k] || "rgba(0,150,255,0.15)";
        div.style.left = (r.x * w) + "px";
        div.style.top = (r.y * h) + "px";
        div.style.width = ((r.width ?? r.w) * w) + "px";
        div.style.height = ((r.height ?? r.h) * h) + "px";
        div.style.borderColor = stroke;
        div.style.background = fill;
        div.style.boxShadow = "0 0 10px " + stroke.replace("0.", "0.35");
        const label = document.createElement("div");
        label.textContent = k.toUpperCase();
        label.style.position = "absolute";
        label.style.left = "4px";
        label.style.top = k === "exp" ? "auto" : "-16px";
        label.style.bottom = k === "exp" ? "-16px" : "auto";
        label.style.fontSize = "12px";
        label.style.fontFamily = "'Segoe UI', Arial, sans-serif";
        label.style.color = "white";
        label.style.textShadow = "0 0 6px rgba(0,0,0,0.55)";
        label.style.pointerEvents = "none";
        div.appendChild(label);
        if(DEBUG_OVERLAY) console.log("[ROI Overlay] added box", k);
        roiLayer.append(div);
      });
    }

    // Render support profile's rmExp ROI separately
    if(showSupport && supportRoiData && (!supportRoiVis || supportRoiVis.rmExp !== false)) {
      const r = supportRoiData.rmExp;
      if (r) {
        const div = document.createElement("div");
        div.className = "roiBox";
        const stroke = ROI_COLORS.rmExp;
        const fill = ROI_FILLS.rmExp;
        div.style.left = (r.x * w) + "px";
        div.style.top = (r.y * h) + "px";
        div.style.width = ((r.width ?? r.w) * w) + "px";
        div.style.height = ((r.height ?? r.h) * h) + "px";
        div.style.borderColor = stroke;
        div.style.background = fill;
        div.style.boxShadow = "0 0 10px " + stroke.replace("0.", "0.35");
        const label = document.createElement("div");
        label.textContent = "RM EXP";
        label.style.position = "absolute";
        label.style.left = "4px";
        label.style.top = "auto";
        label.style.bottom = "-16px";
        label.style.fontSize = "12px";
        label.style.fontFamily = "'Segoe UI', Arial, sans-serif";
        label.style.color = "white";
        label.style.textShadow = "0 0 6px rgba(0,0,0,0.55)";
        label.style.pointerEvents = "none";
        div.appendChild(label);
        if(DEBUG_OVERLAY) console.log("[ROI Overlay] added support rmExp box");
        roiLayer.append(div);
      }
    }
  }

  async function refreshRois(){
    try{
      const pid = showFighter ? await invokeMain("profiles:getOverlayTargetId") : null;
      const shouldLoadSupport = showSupport;
      const supportPid = shouldLoadSupport ? await invokeMain("profiles:getOverlaySupportTargetId") : null;
      if(DEBUG_OVERLAY) console.log("[ROI Overlay] refreshRois profileId:", pid, "supportPid:", supportPid);

      // Handle fighter profile change
      if (!showFighter) {
        currentOverlayProfileId = null;
        roiData = null;
        roiVis = null;
        rebindPluginOverlays();
      } else if (pid !== currentOverlayProfileId) {
        currentOverlayProfileId = pid;
        roiData = null;
        roiVis = null;
        rebindPluginOverlays();
      }

      // Handle support profile change
      if (!shouldLoadSupport) {
        currentSupportProfileId = null;
        supportRoiData = null;
        supportRoiVis = null;
      } else if (supportPid !== currentSupportProfileId) {
        currentSupportProfileId = supportPid;
        supportRoiData = null;
        supportRoiVis = null;
      }

      // Load fighter profile ROIs
      if(!showFighter || !pid){
        roiData = null;
        roiVis = null;
      } else {
        const data = await invokeMain("roi:load", pid);
        const vis = await invokeMain("roi:visibility:get", pid);
        if(DEBUG_OVERLAY) console.log("[ROI Overlay] loaded fighter data:", JSON.stringify(data), "vis:", JSON.stringify(vis));
        roiData = data;
        roiVis = vis || {};
      }

      // Load support profile ROIs (only rmExp)
      if(!shouldLoadSupport || !supportPid){
        supportRoiData = null;
        supportRoiVis = null;
      } else {
        const data = await invokeMain("roi:load", supportPid);
        const vis = await invokeMain("roi:visibility:get", supportPid);
        if(DEBUG_OVERLAY) console.log("[ROI Overlay] loaded support data:", data, "vis:", vis);
        supportRoiData = data;
        supportRoiVis = vis || {};
      }

      renderRois();
    }catch(err){
      console.error("[ROI Overlay] refreshRois failed", err);
    }
  }

  function rebindPluginFrame(frame){
    try{
      const targetId = currentOverlayProfileId || "default";
      const win = frame?.contentWindow;
      if (win && typeof win.KillfeedOverlay?.bind === "function") {
        win.KillfeedOverlay.bind("overlay-host", targetId);
      }
    }catch(err){
      console.warn("[OverlayWindow] plugin rebind failed", err);
    }
  }

  function rebindPluginOverlays(){
    pluginFrames.forEach(rebindPluginFrame);
  }

  async function loadPluginOverlays(){
    if (OVERLAY_ROLE === "support") return;
    if(!pluginContainer) return;
    let views = [];
    try{
      const result = await invokeMain("plugins:getOverlayViews");
      views = Array.isArray(result) ? result : [];
      if(DEBUG_OVERLAY) console.log("[OverlayWindow] plugin overlay views", views.length, views.map(v => v.pluginId));
    }catch(err){
      console.warn("[OverlayWindow] load plugin overlays failed", err);
      return;
    }

    pluginFrames.length = 0;
    pluginContainer.innerHTML = "";

    const scriptCloseTag = "</scr" + "ipt>";
    views.forEach((view) => {
      try{
        let html = view.html;
        const stripCss = new RegExp("<link[^>]*ui_overlay\\.css[^>]*>", "i");
        const stripJs = new RegExp("<script[^>]*ui_overlay\\.js[^>]*>" + scriptCloseTag, "i");
        html = html.replace(stripCss, "");
        html = html.replace(stripJs, "");
        if (view.baseHref && html.includes("<head>") && !/<base\\s/i.test(html)) {
          html = html.replace("<head>", "<head><base href='" + view.baseHref + "'>");
        }
        if (view.css) {
          html = html.replace("</head>", "<style>" + view.css + "</style></head>");
        }
        const pluginIdLiteral = JSON.stringify(view.pluginId);
        const bridgeCode =
          "window.__pluginLocale=(parent&&parent.__overlayLocale)||'en';" +
          "window.__pluginId=" + pluginIdLiteral + ";" +
          "window.plugin=window.plugin||{};" +
          "if(!window.plugin.ipc){" +
          "window.plugin.ipc={" +
          "invoke:function(channel){" +
          "var args=Array.prototype.slice.call(arguments,1);" +
          "return parent.invokePluginChannel(" + pluginIdLiteral + ",channel,...args);" +
          "}" +
          "};" +
          "}";
        // Inject bridge code BEFORE plugin JS to ensure locale is available
        if (view.js) {
          html = html.replace("</body>", "<script>" + bridgeCode + "\\n" + view.js + scriptCloseTag + "</body>");
        } else {
          html = html.replace("</body>", "<script>" + bridgeCode + scriptCloseTag + "</body>");
        }

        const iframe = document.createElement("iframe");
        iframe.sandbox = "allow-scripts allow-same-origin";
        iframe.srcdoc = html;
        iframe.dataset.pluginId = view.pluginId;
        iframe.addEventListener("load", () => rebindPluginFrame(iframe));
        pluginContainer.appendChild(iframe);
        pluginFrames.push(iframe);
        if(DEBUG_OVERLAY) console.log("[OverlayWindow] plugin overlay injected", view.pluginId);
      }catch(err){
        console.warn("[OverlayWindow] failed to inline plugin overlay", err);
      }
    });

    if(DEBUG_OVERLAY) console.log("[OverlayWindow] pluginFrames count", pluginFrames.length);
    rebindPluginOverlays();
  }

  window.addEventListener("resize", renderRois);
  const refreshInterval = setInterval(refreshRois, 200);

  // Clean up interval when window is closed
  window.addEventListener("beforeunload", () => {
    clearInterval(refreshInterval);
  });

  loadPluginOverlays().catch((err) => console.warn("[OverlayWindow] plugin overlays init failed", err));
  refreshRois();
</script>
</body>
</html>
`.trim();
    // Use loadURL with data URI - ensure proper encoding
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).then(() => {
        if(debugOverlay) console.log("[OverlayWindow] HTML loaded successfully");
    }).catch((err) => {
        console.error("[OverlayWindow] load failed", err);
    });

    win.webContents.on("did-finish-load", () => {
        if(debugOverlay) console.log("[OverlayWindow] did-finish-load event fired");
    });

    win.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
        console.error("[OverlayWindow] did-fail-load:", errorCode, errorDescription);
    });

    return handle;
}

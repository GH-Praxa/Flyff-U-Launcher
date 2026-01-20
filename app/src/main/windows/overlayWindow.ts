import { BrowserWindow } from "electron";
import { debugLog, getDebugConfig } from "../debugConfig";
export function createOverlayWindow(parent: BrowserWindow, opts?: {
    preloadPath?: string;
    role?: "fighter" | "support";
}) {
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
    const syncVisibility = () => {
        if (win.isDestroyed())
            return;
        const shouldShow = parent.isVisible() && parent.isFocused();
        if (shouldShow) {
            if (!win.isVisible()) {
                win.showInactive();
            }
            win.setAlwaysOnTop(true, "screen-saver");
        }
        else {
            win.hide();
        }
    };
    parent.on("focus", syncVisibility);
    parent.on("blur", syncVisibility);
    parent.on("show", syncVisibility);
    parent.on("hide", syncVisibility);
    parent.on("minimize", syncVisibility);
    parent.on("restore", syncVisibility);
    syncVisibility();
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
  #supportExpBadge{
    position:fixed;
    top:12px;
    right:12px;
    padding:6px 10px;
    border-radius:10px;
    background:rgba(0,0,0,0.55);
    color:white;
    font: 13px 'Segoe UI', Arial, sans-serif;
    box-shadow:0 6px 18px rgba(0,0,0,0.45);
    border:1px solid rgba(255,170,80,0.65);
    min-width:120px;
    text-align:right;
    pointer-events:none;
    z-index:3;
    opacity:0.85;
    transition:opacity 0.2s ease;
  }
  #supportExpBadge.stale{
    opacity:0.55;
  }
  #supportExpBadge.empty{
    opacity:0.35;
  }
</style>
</head>
<body>
  <div id="roiLayer"></div>
  <div id="pluginOverlays"></div>
  <div id="supportExpBadge" aria-live="polite"></div>

<script>
  const DEBUG_OVERLAY = ${debugOverlay};
  const OVERLAY_ROLE = ${JSON.stringify(opts?.role ?? "fighter")};
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
  const showSupportBadge = OVERLAY_ROLE === "fighter";
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
  let supportExpValue = null;
  let supportExpUpdatedAt = 0;
  let lastSupportExpFetch = 0;
  const pluginFrames = [];
  const supportBadge = document.getElementById("supportExpBadge");
  if (supportBadge && !showSupportBadge) {
    supportBadge.style.display = "none";
  }

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

  function renderSupportBadge(){
    if (!showSupportBadge || !supportBadge) return;
    if (!supportExpValue) {
      supportBadge.textContent = "RM EXP: --";
      supportBadge.classList.add("empty");
      supportBadge.classList.remove("stale");
      return;
    }
    const stale = (Date.now() - supportExpUpdatedAt) > 1500;
    supportBadge.textContent = "RM EXP: " + supportExpValue;
    supportBadge.classList.toggle("stale", stale);
    supportBadge.classList.remove("empty");
  }

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
    renderSupportBadge();
  }

  async function refreshRois(){
    try{
      const pid = showFighter ? await invokeMain("profiles:getOverlayTargetId") : null;
      const shouldLoadSupport = showSupport || showSupportBadge;
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
        supportExpValue = null;
        supportExpUpdatedAt = 0;
        lastSupportExpFetch = 0;
      } else if (supportPid !== currentSupportProfileId) {
        currentSupportProfileId = supportPid;
        supportRoiData = null;
        supportRoiVis = null;
        supportExpValue = null;
        supportExpUpdatedAt = 0;
        lastSupportExpFetch = 0;
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
        if (showSupportBadge && supportPid) {
          const now = Date.now();
          if (now - lastSupportExpFetch > 350) {
            lastSupportExpFetch = now;
            try{
              const ocr = await invokeMain("ocr:getLatest", supportPid);
              const val = (ocr && typeof ocr.rmExp === "string" && ocr.rmExp.trim())
                ? ocr.rmExp.trim()
                : (ocr && typeof ocr.exp === "string" ? ocr.exp.trim() : "");
              supportExpValue = val || null;
              supportExpUpdatedAt = ocr?.updatedAt || Date.now();
            }catch(_err){
              supportExpValue = null;
            }
          }
        } else {
          supportExpValue = null;
          supportExpUpdatedAt = 0;
          lastSupportExpFetch = 0;
        }
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
        if (view.js) {
          html = html.replace("</body>", "<script>" + view.js + scriptCloseTag + "</body>");
        }
        const pluginIdLiteral = JSON.stringify(view.pluginId);
        const bridgeScript =
          "<script>" +
          "window.plugin=window.plugin||{};" +
          "if(!window.plugin.ipc){" +
          "window.plugin.ipc={" +
          "invoke:function(channel){" +
          "var args=Array.prototype.slice.call(arguments,1);" +
          "return parent.invokePluginChannel(" + pluginIdLiteral + ",channel,...args);" +
          "}" +
          "};" +
          "}" +
          scriptCloseTag;
        if (html.includes("</head>")) {
          html = html.replace("</head>", bridgeScript + "</head>");
        } else {
          html = bridgeScript + html;
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

    return win;
}

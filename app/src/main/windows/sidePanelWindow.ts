import { BrowserWindow, app } from "electron";
import path from "path";
import fs from "fs";
import { getDebugConfig } from "../debugConfig";
import { translate, DEFAULT_LOCALE, type TranslationKey } from "../../i18n/translations";
import { SUPPORTED_LOCALES, type Locale } from "../../shared/schemas";

type SidePanelStrings = ReturnType<typeof buildSidePanelStrings>;

function normalizeLocale(locale?: Locale): Locale {
    return (locale && SUPPORTED_LOCALES.includes(locale)) ? locale : DEFAULT_LOCALE;
}

function buildSidePanelStrings(locale: Locale) {
    const t = (key: TranslationKey) => translate(locale, key);
    return {
        locale,
        toggleTitle: t("sidePanel.toggle"),
        resizeTitle: t("sidePanel.resize"),
        tabOcr: t("sidePanel.tab.ocr"),
        ocrTitle: t("sidePanel.ocr.title"),
        ocrFields: {
            lvl: t("sidePanel.ocr.level"),
            exp: t("sidePanel.ocr.exp"),
            charname: t("sidePanel.ocr.charname"),
            lauftext: t("sidePanel.ocr.lauftext"),
            rmExp: t("sidePanel.ocr.rmExp"),
            enemyName: t("sidePanel.ocr.enemyName"),
            enemyHp: t("sidePanel.ocr.enemyHp"),
        },
        timerLabel: t("sidePanel.ocr.timerLabel"),
        timerUnit: t("sidePanel.ocr.timerUnit"),
        timerHint: t("sidePanel.ocr.timerHint"),
        active: t("sidePanel.ocr.active"),
        manual: t("sidePanel.ocr.manual"),
        manualLevel: t("sidePanel.ocr.manualLevel"),
        manualLevelPlaceholder: t("sidePanel.ocr.manualLevel.placeholder"),
        manualExp: t("sidePanel.ocr.manualExp"),
        manualExpPlaceholder: t("sidePanel.ocr.manualExp.placeholder"),
        manualSet: t("sidePanel.ocr.set"),
        noTarget: t("sidePanel.ocr.noTarget"),
        unavailable: t("sidePanel.ocr.unavailable"),
        profileLabel: t("sidePanel.ocr.profileLabel"),
        supportLabel: t("sidePanel.ocr.supportLabel"),
        stale: t("sidePanel.ocr.stale"),
        roi: {
            title: t("sidePanel.roi.title"),
            all: t("sidePanel.roi.all"),
            showAll: t("sidePanel.roi.showAll"),
            notSet: t("sidePanel.roi.notSet"),
            set: t("sidePanel.roi.set"),
            debug: t("sidePanel.roi.debug"),
            show: t("sidePanel.roi.show"),
            field: t("sidePanel.roi.field"),
            remove: t("sidePanel.roi.remove"),
            manualTitle: t("sidePanel.roi.manualTitle"),
            axis: {
                x: t("sidePanel.roi.axis.x"),
                y: t("sidePanel.roi.axis.y"),
                w: t("sidePanel.roi.axis.w"),
                h: t("sidePanel.roi.axis.h"),
            },
            manual: {
                hint: t("sidePanel.roi.manual.hint"),
                valuesAdjusted: t("sidePanel.roi.manual.valuesAdjusted"),
                noProfile: t("sidePanel.roi.manual.noProfile"),
                invalid: t("sidePanel.roi.manual.invalid"),
                updated: t("sidePanel.roi.manual.updated"),
                saved: t("sidePanel.roi.manual.saved"),
                saveError: t("sidePanel.roi.manual.saveError"),
                noneToRemove: t("sidePanel.roi.manual.noneToRemove"),
                removed: t("sidePanel.roi.manual.removed"),
                removeError: t("sidePanel.roi.manual.removeError"),
            },
            status: {
                loading: t("sidePanel.roi.status.loading"),
                error: t("sidePanel.roi.status.error"),
            },
            overlayProfile: t("sidePanel.roi.overlayProfile"),
            supportProfile: t("sidePanel.roi.supportProfile"),
            debugSaving: t("sidePanel.roi.debug.saving"),
            debugSaved: t("sidePanel.roi.debug.saved"),
            debugFailed: t("sidePanel.roi.debug.failed"),
            alertNoOverlay: t("sidePanel.roi.alert.noOverlay"),
            alertNoSupport: t("sidePanel.roi.alert.noSupport"),
            alertStartFailed: t("sidePanel.roi.alert.startFailed"),
            alertFailed: t("sidePanel.roi.alert.failed"),
            alertNoProfile: t("sidePanel.roi.alert.noProfile"),
            noProfileLabel: t("sidePanel.roi.noProfile"),
        },
        pluginTabMissing: t("sidePanel.plugin.tabMissing"),
    };
}

export function createSidePanelWindow(parent: BrowserWindow, opts?: {
    preloadPath?: string;
    locale?: Locale;
}) {
    const locale = normalizeLocale(opts?.locale);
    const strings: SidePanelStrings = buildSidePanelStrings(locale);
    const stringsJson = JSON.stringify(strings);
    // Avoid embedding raw </script> in the template string so bundlers don't escape it to <\/script>,
    // which can confuse the HTML parser of the data URL.
    const HTML_SCRIPT_CLOSE = "</scr" + "ipt>";
    const debugSidePanel = getDebugConfig().sessions;
    const win = new BrowserWindow({
        parent,
        frame: false,
        transparent: false,
        resizable: false,
        movable: false,
        show: false,
        focusable: true,
        useContentSize: true,
        acceptFirstMouse: true,
        skipTaskbar: true,
        hasShadow: false,
        alwaysOnTop: false,
        backgroundColor: "#0b1220",
        webPreferences: {
            preload: opts?.preloadPath,
            // Preload nutzt contextBridge -> Isolation bleibt an.
            // NodeIntegration off for better security - preload bridge is used.
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
        },
    });
    const syncToParentBounds = () => {
        try {
            const parentBounds = parent.getContentBounds();
            const current = win.getContentSize();
            const currentWidth = Array.isArray(current) ? current[0] : win.getBounds().width;
            const width = Math.max(260, Math.min(620, currentWidth || 420));
            win.setContentSize(width, parentBounds.height);
            win.setPosition(parentBounds.x + parentBounds.width - width, parentBounds.y);
        } catch (_err) {
            /* ignore resize errors */
        }
    };
    syncToParentBounds();
    parent.on("resize", syncToParentBounds);
    parent.on("move", syncToParentBounds);
    win.on("closed", () => {
        parent.removeListener("resize", syncToParentBounds);
        parent.removeListener("move", syncToParentBounds);
    });
    win.setMenu(null);
    // Pipe renderer console output to main log for easier debugging of blank panel issues
    win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
        // eslint-disable-next-line no-console
        console.log(`[SidePanel][${level}] ${message} (${sourceId ?? "unknown"}:${line ?? 0})`);
    });
    win.webContents.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL) => {
        // eslint-disable-next-line no-console
        console.error("[SidePanel] did-fail-load", errorCode, errorDescription, validatedURL);
    });
    // Only open DevTools in development mode
    // if (!require("electron").app.isPackaged) {
    //     win.webContents.openDevTools({ mode: 'detach' });
    // }
    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  :root{
    --bg: #0b1220;
    --panel: #0f1a33;
    --panel2: #0d1830;
    --stroke: #1b2b4d;
    --text: #e6eefc;
    --muted: #294093;
    --blue: #2ecc71;
    --blue2: #32d17f;
    --danger: #ff3b4f;
    --green: #2ecc71;
    --accent: #2ecc71;
    --accent-rgb: 46,204,113;
    --danger-rgb: 255,59,79;
    --green-rgb: 46,204,113;
    --tab-active-rgb: 46,204,113;
    --shadow: 0 8px 30px rgba(0,0,0,0.35);
  }

  *{ box-sizing: border-box; }

  html,body{
    margin:0;
    padding:0;
    width:100%;
    height:100%;
    background: var(--bg);
    color: var(--text);
    overflow:hidden;
    font-family: Segoe UI, Arial, sans-serif;
  }

  #root{
    width: 100%;
    height: 100%;
    display:flex;
    justify-content:flex-end;
    pointer-events:auto;
    background:
      linear-gradient(180deg, rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.10), transparent 46%),
      var(--bg);
  }

  #handle{
    width: 44px;
    height: 100%;
    display:flex;
    align-items:flex-start;
    justify-content:center;
    padding-top: 10px;
    background: linear-gradient(180deg, rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.14), rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.04));
    border-right: 1px solid var(--stroke);
  }

  #toggle{
    width: 34px;
    height: 34px;
    border-radius: 12px;
    border:1px solid rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.45);
    background: rgba(255,255,255,0.04);
    color: var(--text);
    cursor:pointer;
    font-size: 14px;
    display:grid;
    place-items:center;
    box-shadow: 0 6px 18px rgba(0,0,0,0.35);
  }
  #toggle:hover{
    background: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.16);
    border-color: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.70);
  }

  #panel{
    width: calc(100% - 44px);
    height: 100%;
    border-radius: 16px 0 0 16px;
    border:1px solid var(--stroke);
    border-right: none;
    background: linear-gradient(180deg, var(--panel), var(--panel2));
    box-shadow: var(--shadow);
    overflow:hidden;
    display:flex;
    flex-direction:column;
  }

  #tabs{
    display:flex;
    gap:10px;
    padding: 10px 10px 8px 10px;
    border-bottom: 1px solid var(--stroke);
    background: linear-gradient(180deg, rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.16), rgba(0,0,0,0.35));
  }

  .tab{
    border:1px solid var(--stroke);
    background: rgba(255,255,255,0.03);
    color: var(--text);
    border-radius: 12px;
    padding: 8px 10px;
    cursor:pointer;
    font-size: 12px;
    transition: 120ms ease;
  }
  .tab:hover{
    border-color: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.70);
  }
  .tab.active{
    border-color: rgba(var(--tab-active-rgb,46,204,113),0.90);
    background: linear-gradient(180deg, rgba(var(--tab-active-rgb,46,204,113),0.26), rgba(0,0,0,0.25));
    color: var(--text);
    box-shadow:
      0 0 0 1px rgba(var(--tab-active-rgb,46,204,113),0.25),
      0 8px 18px rgba(0,0,0,0.35);
  }

  #content{
    padding: 10px;
    display:flex;
    flex-direction:column;
    gap:10px;
    overflow:auto;
    background: linear-gradient(180deg, rgba(255,255,255,0.01), rgba(0,0,0,0.12));
    flex: 1;
    min-height: 0;
  }
  #content.plugin-mode{
    padding: 0;
    gap: 0;
  }

  .section{
    border:1px solid var(--stroke);
    background: rgba(255,255,255,0.02);
    border-radius: 14px;
    padding: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.22);
  }
  .sectionTitle{
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 8px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    padding: 10px;
    border-radius: 14px;
    border:1px solid var(--stroke);
    background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(0,0,0,0.18));
    margin-bottom: 10px;
  }
  .row:last-child{ margin-bottom: 0; }

  .label{ font-size: 12px; color: var(--text); }
  .hint{ font-size: 11px; color: var(--muted); margin-top: 6px; }

  .roiList{ display:flex; flex-direction:column; gap:8px; margin-top:8px; }
  .roiRow{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px; border-radius:12px; border:1px solid var(--stroke); background: rgba(255,255,255,0.03); flex-wrap:wrap; }
  .roiRow.accent{ background: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.10); border-color: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.45); }
  .roiRow.support{ border-color: rgba(255,170,80,0.55); }
  .roiLeft{ display:flex; align-items:center; gap:8px; min-width: 120px; }
  .roiLabel{ font-size:12px; color: var(--text); white-space:nowrap; }
  .roiStatus{ display:flex; align-items:center; gap:6px; font-size:12px; color: var(--muted); white-space:nowrap; }
  .roiStatus.on{ color: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.9); }
  .roiDot{ width:10px; height:10px; border-radius:50%; border:1px solid var(--muted); background: transparent; }
  .roiDot.support{ border-color: rgba(255,170,80,0.9); box-shadow: 0 0 6px rgba(255,170,80,0.3); }
  .roiDot.support.on{ background: rgba(255,170,80,0.85); border-color: rgba(255,170,80,0.95); box-shadow: 0 0 6px rgba(255,170,80,0.7); }
  .roiDot.on{ background: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.85); border-color: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.85); box-shadow: 0 0 6px rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.6); }
  .roiActions{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .roiToggle{ display:flex; align-items:center; gap:4px; font-size:12px; color: var(--text); position:relative; z-index:10; }
  .roiToggle input[type="checkbox"]{ cursor:pointer; pointer-events:auto !important; width:16px; height:16px; margin:0; position:relative; z-index:11; accent-color: rgb(var(--accent-rgb, var(--tab-active-rgb,46,204,113))); }
  .roiToggle label{ cursor:pointer; user-select:none; }
  .roiManual{
    margin-top: 10px;
    border:1px solid var(--stroke);
    border-radius: 12px;
    background: rgba(255,255,255,0.02);
    padding: 12px;
    display:flex;
    flex-direction:column;
    gap:10px;
  }
  .roiManualTitle{
    font-size: 12px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .roiManualField{
    display:flex;
    flex-direction:column;
    gap:4px;
  }
  .roiManualLabel{
    font-size: 11px;
    color: var(--text);
  }
  .roiManualControl{
    border-radius: 10px;
    border:1px solid var(--stroke);
    background: rgba(255,255,255,0.04);
    color: var(--text);
    padding: 5px 8px;
    font-size: 12px;
  }
  .roiManualControl:disabled{
    opacity: 0.5;
  }
  .roiManualSliderGroup{
    display:flex;
    flex-direction:column;
    gap:10px;
  }
  .roiManualSlider{
    display:flex;
    align-items:center;
    gap:8px;
  }
  .roiManualRange{
    flex:1;
    accent-color: rgb(var(--accent-rgb, var(--tab-active-rgb,46,204,113)));
  }
  .roiManualValue{
    width: 58px;
    font-family: "Consolas", "Monaco", monospace;
    font-size: 12px;
    color: var(--text);
    text-align: right;
  }
  .roiManualSelect{
    background: rgba(15,26,51,0.8);
  }
  .roiManualStepper{
    display:flex;
    flex-direction:column;
    gap:4px;
  }
  .roiManualStepperBtn{
    border-radius: 6px;
    border:1px solid var(--stroke);
    background: rgba(255,255,255,0.06);
    color: var(--text);
    padding:2px 6px;
    font-size: 11px;
    cursor:pointer;
    transition:120ms ease;
  }
  .roiManualStepperBtn:hover{
    background: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.18);
    border-color: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.6);
  }
  .roiManualActions{
    display:flex;
    gap:8px;
    flex-wrap:wrap;
  }
  .roiManualFeedback{
    font-size:11px;
    color: var(--muted);
  }
  .roiManualFeedback[data-state="success"]{
    color: var(--green);
  }
  .roiManualFeedback[data-state="error"]{
    color: var(--danger);
  }

  .ocrList{ display:flex; flex-direction:column; gap:10px; margin-top:10px; }
  .ocrRow{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border-radius:10px; border:1px solid var(--stroke); background: rgba(255,255,255,0.04); }
  .ocrLabel{ font-size:13px; color: var(--muted); font-weight:500; min-width:80px; }
  .ocrValue{ font-size:15px; color: var(--text); font-weight:600; font-family: "Consolas", "Monaco", monospace; }
  .ocrRowExpanded{ flex-wrap:wrap; gap:12px; }
  .ocrLabelWrap{ display:flex; flex:0 0 auto; align-items:center; gap:6px; }
  .ocrTimerWrap{ display:flex; align-items:center; gap:6px; flex:0 0 auto; }
  .ocrTimerLabel{ font-size:11px; color: var(--muted); text-transform:uppercase; letter-spacing:0.03em; }
  .ocrTimerInput{ width:90px; border-radius:10px; border:1px solid var(--stroke); background: rgba(255,255,255,0.05); color: var(--text); padding:6px 10px; font-size:13px; }
  .ocrTimerInput:focus{ outline:none; border-color: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.9); box-shadow: 0 0 0 2px rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.22); }
  .ocrTimerUnit{ font-size:11px; color: var(--muted); }

  .switch{
    position:relative;
    width: 44px;
    height: 24px;
    background: rgba(255,255,255,0.08);
    border:1px solid var(--stroke);
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
    background: rgba(255,255,255,0.65);
    transition: all 120ms ease;
  }
  .switch.on{
    background: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.20);
    border-color: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.55);
  }
  .switch.on::after{
    left: 22px;
    background: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.95);
    box-shadow: 0 0 8px rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.35);
  }

  .btn{
    border: 1px solid var(--stroke);
    background: rgba(255,255,255,0.05);
    color: var(--text);
    border-radius: 12px;
    padding: 10px 12px;
    cursor:pointer;
    font-size: 12px;
    transition: 120ms ease;
  }
  .btn:hover{ background: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.12); border-color: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.5); }

  .btnBrown{
    border-color: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.65);
    background: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.12);
    color: var(--text);
  }
  .btnBrown:hover{ background: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.20); }

  #resizeGrip{
    position:absolute;
    left: 44px;
    top: 0;
    width: 8px;
    height: 100%;
    cursor: ew-resize;
    background: transparent;
    z-index: -1;
  }
</style>
</head>
<body>
  <div id="root">
    <div id="handle">
      <button id="toggle" title="Toggle panel">X</button>
    </div>

    <div id="resizeGrip" title="Drag to resize"></div>

      <div id="panel">
      <div id="tabs">
        <button class="tab active" data-tab="ocr">OCR / ROI</button>
      </div>
      <div id="content"></div>
    </div>
  </div>

<script>
  const STR = ${stringsJson};
  const fmt = (text, params = {}) => typeof text === "string"
    ? text.replace(/\\{(\\w+)\\}/g, (_m, k) => Object.prototype.hasOwnProperty.call(params, k) ? String(params[k]) : "")
    : "";
  const DEBUG_SIDEPANEL = ${debugSidePanel};
  if(DEBUG_SIDEPANEL) if(DEBUG_SIDEPANEL) console.log("[HudPanel] script start");
  window.addEventListener("error", (e) => {
    if(DEBUG_SIDEPANEL) console.log("[HudPanel] error", String(e?.error || e?.message || e));
  });
  // Note: data: URLs don't load preload scripts, so window.ipc may be undefined
  // Use console messages to communicate with main process instead

  function getIpc(){
    if (window.ipc) return window.ipc;
    try{
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require("electron").ipcRenderer;
    }catch(_e){
      return null;
    }
  }

  function sendToMain(channel, payload) {
    const ipc = getIpc();
    if (ipc?.send) {
      ipc.send(channel, payload);
    } else {
      // Fallback: use console message (main process listens via webContents)
      // Use a JSON payload to avoid issues with ":" in channel names
      try{
        console.log("IPC|" + JSON.stringify({ channel, payload: payload ?? {} }));
      }catch(e){
        console.log("IPC|" + JSON.stringify({ channel, payload: { error: "serialize_failed" } }));
      }
    }
  }

  async function invokeMain(channel, ...args) {
    const ipc = getIpc();
    if (!ipc?.invoke) {
      throw new Error("ipc not available");
    }
    const result = await ipc.invoke(channel, ...args);
    // Unwrap IpcResult format {ok, data, error}
    if (result && typeof result === "object" && "ok" in result) {
      if (result.ok) {
        return result.data;
      } else {
        throw new Error(result.error || "IPC call failed");
      }
    }
    return result;
  }

  const pluginFrames = new Map();
  const toggleBtn = document.getElementById("toggle");
  if (toggleBtn) toggleBtn.title = STR.toggleTitle;
  const resizeGripEl = document.getElementById("resizeGrip");
  if (resizeGripEl) resizeGripEl.title = STR.resizeTitle;
  const defaultTabBtn = document.querySelector(".tab[data-tab='ocr']");
  if (defaultTabBtn) defaultTabBtn.textContent = STR.tabOcr;

  const DEFAULT_THEME_COLORS = {
    bg: "#0b1220",
    panel: "#0f1a33",
    panel2: "#0d1830",
    stroke: "#1b2b4d",
    text: "#e6eefc",
    muted: "#294093",
    blue: "#2ecc71",
    blue2: "#32d17f",
    danger: "#ff3b4f",
    green: "#2ecc71",
    accent: "#2ecc71",
    tabActive: "#2ecc71",
  };

  let activeThemeColors = { ...DEFAULT_THEME_COLORS };

  function hexToRgb(input) {
    const raw = (input || "").trim();
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(raw);
    if (!match) return null;
    const toDec = (v) => parseInt(v, 16);
    return [toDec(match[1]), toDec(match[2]), toDec(match[3])].join(",");
  }

  function buildPluginThemeCss() {
    const vars = Object.entries(activeThemeColors)
      .map(([key, value]) => (typeof value === "string" && value.trim() ? "--" + key + ": " + value.trim() + ";" : ""))
      .join("");
    const accentRgb = hexToRgb(activeThemeColors.accent) || hexToRgb(activeThemeColors.blue);
    const tabRgb = hexToRgb(activeThemeColors.tabActive) || accentRgb;
    const dangerRgb = hexToRgb(activeThemeColors.danger);
    const greenRgb = hexToRgb(activeThemeColors.green);
    const extraVars = [
      accentRgb ? "--accent-rgb: " + accentRgb + ";" : "",
      tabRgb ? "--tab-active-rgb: " + tabRgb + ";" : "",
      dangerRgb ? "--danger-rgb: " + dangerRgb + ";" : "",
      greenRgb ? "--green-rgb: " + greenRgb + ";" : "",
    ].join("");
    return [
      ":root{" + vars + extraVars + "}",
      "*{box-sizing:border-box;}",
      "html,body{",
      "  margin:0;",
      "  padding:0;",
      "  min-height:100%;",
      "  background: linear-gradient(180deg, var(--panel), var(--panel2));",
      "  color: var(--text);",
      "  font-family: Segoe UI, Arial, sans-serif;",
      "}",
      "a{ color: var(--accent); }",
      "button,input,select,textarea{",
      "  background: rgba(255,255,255,0.05);",
      "  border:1px solid var(--stroke);",
      "  color: var(--text);",
      "  border-radius: 10px;",
      "  padding: 8px 10px;",
      "}",
      "button:hover{",
      "  border-color: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.6);",
      "  background: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.12);",
      "}",
      ".card{",
      "  background: rgba(255,255,255,0.04);",
      "  border:1px solid var(--stroke);",
      "  border-radius: 12px;",
      "  padding: 12px;",
      "  box-shadow: 0 8px 22px rgba(0,0,0,0.2);",
      "}",
    ].join("\\n");
  }

  function applyThemeToPluginDocument(doc) {
    if (!doc) return;
    const STYLE_ID = "plugin-theme-vars";
    let style = doc.getElementById(STYLE_ID);
    if (!style) {
      style = doc.createElement("style");
      style.id = STYLE_ID;
      (doc.head || doc.documentElement || doc.body).appendChild(style);
    }
    style.textContent = buildPluginThemeCss();
  }

  function applyThemeToPluginFrames() {
    pluginFrames.forEach((frame) => {
      try {
        applyThemeToPluginDocument(frame.contentDocument || frame.contentWindow?.document);
      } catch (err) {
        console.warn("[HudPanel] Failed to apply theme to plugin frame", err);
      }
    });
  }

  function resolveThemeColors(colors, tabActiveOverride) {
    const next = Object.assign({}, DEFAULT_THEME_COLORS, colors || {});
    if (tabActiveOverride) {
      next.tabActive = tabActiveOverride;
    }
    if (!next.accent) {
      next.accent = next.tabActive || next.blue || DEFAULT_THEME_COLORS.accent;
    }
    if (!next.blue) {
      next.blue = next.accent;
    }
    if (!next.blue2) {
      next.blue2 = next.blue;
    }
    if (!next.green) {
      next.green = next.tabActive || DEFAULT_THEME_COLORS.green;
    }
    return next;
  }

  function applyThemeColors(colors, tabActiveOverride) {
    const next = resolveThemeColors(colors, tabActiveOverride);
    activeThemeColors = next;
    const style = document.documentElement.style;
    Object.entries(next).forEach(([key, value]) => {
      if (typeof value === "string" && value.trim()) {
        style.setProperty("--" + key, value.trim());
      }
    });
    const accentRgb = hexToRgb(next.accent) || hexToRgb(next.blue) || hexToRgb(next.tabActive);
    if (accentRgb) {
      style.setProperty("--accent-rgb", accentRgb);
    }
    const tabRgb = hexToRgb(next.tabActive) || accentRgb;
    if (tabRgb) {
      style.setProperty("--tab-active-rgb", tabRgb);
    }
    const dangerRgb = hexToRgb(next.danger);
    if (dangerRgb) {
      style.setProperty("--danger-rgb", dangerRgb);
    }
    const greenRgb = hexToRgb(next.green);
    if (greenRgb) {
      style.setProperty("--green-rgb", greenRgb);
    }
    applyThemeToPluginFrames();
  }

  async function syncTheme() {
    applyThemeColors(DEFAULT_THEME_COLORS);
    try{
      const ipc = getIpc();
      const snap = window.api?.themeCurrent
        ? await window.api.themeCurrent()
        : (ipc?.invoke ? await ipc.invoke("theme:current") : null);
      const snapTab = snap?.colors?.tabActive || snap?.builtin?.tabActive || null;
      if (snap?.colors) {
        applyThemeColors(snap.colors, snapTab);
      } else if (snapTab) {
        applyThemeColors({ tabActive: snapTab }, snapTab);
      }
      const onThemeUpdate = (payload) => {
        if (payload && payload.colors) {
          const tabActive = payload.colors.tabActive || payload.builtin?.tabActive || null;
          applyThemeColors(payload.colors, tabActive);
        } else if (payload?.builtin?.tabActive) {
          applyThemeColors({ tabActive: payload.builtin.tabActive }, payload.builtin.tabActive);
        }
      };
      if (window.ipc?.on) {
        window.ipc.on("theme:update", onThemeUpdate);
      } else if (ipc?.on) {
        ipc.on("theme:update", (_e, payload) => onThemeUpdate(payload));
      }
    }catch(err){
      console.warn("[HudPanel] theme sync failed", err);
    }
  }

  syncTheme();

  document.getElementById("toggle").onclick = () => {
    if(DEBUG_SIDEPANEL) console.log("[HudPanel] toggle click");
    sendToMain("sidepanel:toggle");
  };

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
    sendToMain("hudpanel:setWidth", { width: next });
  });

  window.addEventListener("mouseup", () => {
    resizing = false;
  });

  const content = document.getElementById("content");
  const setPluginMode = (enabled) => {
    content.classList.toggle("plugin-mode", Boolean(enabled));
  };
  const tabs = Array.from(document.querySelectorAll(".tab"));
  let currentTab = "ocr";

  const SUPPORT_COLOR = "rgba(255,170,80,0.95)";
  const ROI_ITEMS = [
    { key: "lvl", label: STR.ocrFields.lvl, target: "fighter" },
    { key: "charname", label: STR.ocrFields.charname, target: "fighter" },
    { key: "exp", label: STR.ocrFields.exp, target: "fighter" },
    { key: "lauftext", label: STR.ocrFields.lauftext, target: "fighter" },
    { key: "rmExp", label: STR.ocrFields.rmExp, target: "support" },
    { key: "enemyName", label: STR.ocrFields.enemyName, target: "fighter" },
    { key: "enemyHp", label: STR.ocrFields.enemyHp, target: "fighter" },
  ];

  async function getActiveOverlayProfileId(){
    try{
      return await invokeMain("profiles:getOverlayTargetId");
    }catch(e){
      console.error("profiles:getOverlayTargetId failed", e);
      return null;
    }
  }

  async function getSupportOverlayProfileId(){
    try{
      return await invokeMain("profiles:getOverlaySupportTargetId");
    }catch(e){
      console.error("profiles:getOverlaySupportTargetId failed", e);
      return null;
    }
  }

  async function openRoiCalibrator(){
    return openRoiCalibratorFor(null);
  }

  function renderRoiPanel(){
    // Re-render OCR/ROI tab to refresh status/visibility after calibration
    setTab("ocr");
  }

  async function openRoiCalibratorFor(key){
    try{
      const pid = key === "rmExp" ? await getSupportOverlayProfileId() : await getActiveOverlayProfileId();
      if(!pid) {
        console.warn("[HudPanel] roi:open skipped - no overlay/support target set");
        alert(key === "rmExp" ? STR.roi.alertNoSupport : STR.roi.alertNoOverlay);
        return;
      }
      const ok = await invokeMain("roi:open", key ? { profileId: pid, roiKey: key } : pid);
      if (!ok) {
        alert(STR.roi.alertStartFailed);
      }
      renderRoiPanel();
    }catch(e){
      console.error("roi:open failed", e);
      alert(fmt(STR.roi.alertFailed, { error: e?.message || e }));
    }
  }

  async function loadRoiStatus(){
    const profileId = await getActiveOverlayProfileId();
    if(!profileId){
      return { profileId: null, status: null };
    }
    try{
      const status = await invokeMain("roi:status", profileId);
      return { profileId, status: status ?? null };
    }catch(e){
      console.error("roi:status failed", e);
      return { profileId, status: null };
    }
  }

  async function loadRoiVisibility(profileId){
    if(!profileId) return null;
    try{
      const vis = await invokeMain("roi:visibility:get", profileId);
      return vis ?? null;
    }catch(e){
      console.error("roi:visibility:get failed", e);
      return null;
    }
  }

  async function loadRoiData(profileId){
    if(!profileId) return null;
    try{
      const rois = await invokeMain("roi:load", profileId);
      return rois ?? null;
    }catch(e){
      console.error("roi:load failed", e);
      return null;
    }
  }

  async function setRoiVisibility(profileId, key, visible){
    try{
      await invokeMain("roi:visibility:set", { profileId, key, visible });
    }catch(e){
      console.error("roi:visibility:set failed", e);
    }
  }

  function renderCoreTab(name) {
    content.innerHTML = "";

    if (name !== "ocr") {
      return;
    }

    const cleanups = [];

    const buildOcrSection = () => {
      const sec = document.createElement("div");
      sec.className = "section";

      const heading = document.createElement("div");
      heading.className = "sectionTitle";
      heading.textContent = STR.ocrTitle;

      const ocrItems = [
        { key: "lvl", label: STR.ocrFields.lvl, format: v => (v === null || v === undefined || v === "" ? "-" : String(v)), unit: STR.timerUnit },
        { key: "exp", label: STR.ocrFields.exp, format: v => (v === null || v === undefined || v === "" ? "-" : String(v)), unit: STR.timerUnit },
        { key: "charname", label: STR.ocrFields.charname, format: v => (v === null || v === undefined || v === "" ? "-" : String(v)), unit: STR.timerUnit },
        { key: "lauftext", label: STR.ocrFields.lauftext, format: v => (v === null || v === undefined || v === "" ? "-" : String(v)), unit: STR.timerUnit },
        { key: "rmExp", label: STR.ocrFields.rmExp, format: v => (v === null || v === undefined || v === "" ? "-" : String(v)), unit: STR.timerUnit, target: "support" },
        { key: "enemyName", label: STR.ocrFields.enemyName, format: v => (v === null || v === undefined || v === "" ? "-" : String(v)), unit: STR.timerUnit },
        { key: "enemyHp", label: STR.ocrFields.enemyHp, format: v => (v === null || v === undefined || v === "" ? "-" : String(v)), unit: STR.timerUnit },
      ];
      const defaultTimers = { lvl: 200, exp: 200, charname: 300, lauftext: 400, rmExp: 200, enemyName: 300, enemyHp: 200 };
      const ocrTargets = ocrItems.reduce((acc, item) => {
        acc[item.key] = item.target === "support" ? "support" : "fighter";
        return acc;
      }, {});

      const valueEls = {};
      const timerInputs = {};
      const enableChecks = {};
      const list = document.createElement("div");
      list.className = "ocrList";

      let manualLevelInput = null;
      let manualLevelToggle = null;
      let manualLevelProfileId = null;
      let manualExpInput = null;
      let manualExpButton = null;
      let manualExpProfileId = null;
      const clampManualLevelValue = (val) => {
        const n = Number(val);
        if (!Number.isFinite(n)) return 1;
        return Math.min(300, Math.max(1, Math.round(n)));
      };
      const disableManualLevelControls = () => {
        manualLevelProfileId = null;
        if (manualLevelInput) {
          manualLevelInput.value = "";
          manualLevelInput.disabled = true;
        }
        if (manualLevelToggle) {
          manualLevelToggle.checked = false;
          manualLevelToggle.disabled = true;
        }
      };
      const disableManualExpControls = () => {
        manualExpProfileId = null;
        if (manualExpInput) {
          manualExpInput.value = "";
          manualExpInput.disabled = true;
        }
        if (manualExpButton) {
          manualExpButton.disabled = true;
        }
      };
      const updateManualLevelDisplay = (val) => {
        if (!manualLevelInput) return;
        if (document.activeElement === manualLevelInput) return;
        if (val === null || val === undefined || val === "") return;
        const next = clampManualLevelValue(val);
        const nextStr = String(next);
        if (manualLevelInput.value !== nextStr) {
          manualLevelInput.value = nextStr;
        }
      };
      const setManualExpProfile = (profileId) => {
        manualExpProfileId = profileId;
        if (manualExpInput) {
          manualExpInput.value = "";
          manualExpInput.disabled = !profileId;
        }
        if (manualExpButton) {
          manualExpButton.disabled = !profileId;
        }
      };
      const syncManualLevelState = async (profileId, fallbackValue) => {
        manualLevelProfileId = profileId;
        if (!manualLevelInput || !manualLevelToggle) return;
        if (!profileId) {
          disableManualLevelControls();
          return;
        }
        try{
          const state = await invokeMain("ocr:manualLevel:get", profileId);
          const value = (state && typeof state.value === "number") ? state.value : fallbackValue;
          if (value !== undefined && value !== null) {
            updateManualLevelDisplay(value);
          }
          manualLevelToggle.checked = !!(state && state.enabled);
          manualLevelToggle.disabled = false;
          manualLevelInput.disabled = !manualLevelToggle.checked;
        }catch(err){
          console.error("ocr:manualLevel:get failed", err);
          disableManualLevelControls();
        }
      };

      let currentProfileId = null;
      let currentSupportProfileId = null;
      const getProfileIdForKey = (key) => (ocrTargets[key] === "support" ? currentSupportProfileId : currentProfileId);

      ocrItems.forEach(item => {
        const row = document.createElement("div");
        row.className = "ocrRow ocrRowExpanded";
        const manualWraps = [];

        const labelWrap = document.createElement("div");
        labelWrap.className = "ocrLabelWrap";
        const labelEl = document.createElement("div");
        labelEl.className = "ocrLabel";
        labelEl.textContent = item.label;
        labelWrap.append(labelEl);

        const value = document.createElement("div");
        value.className = "ocrValue";
        value.textContent = "-";
        valueEls[item.key] = { el: value, format: item.format };

        const timerWrap = document.createElement("div");
        timerWrap.className = "ocrTimerWrap";
        const timerLabel = document.createElement("span");
        timerLabel.className = "ocrTimerLabel";
        timerLabel.textContent = STR.timerLabel;
        const timerInput = document.createElement("input");
        timerInput.type = "number";
        timerInput.className = "ocrTimerInput";
        timerInput.min = "0";
        timerInput.max = "60000";
        timerInput.step = "100";
        timerInput.value = "0";
        timerInput.placeholder = "0";
        const timerUnit = document.createElement("span");
        timerUnit.className = "ocrTimerUnit";
        timerUnit.textContent = STR.timerUnit;

        const enableWrap = document.createElement("label");
        enableWrap.className = "ocrTimerLabel";
        enableWrap.style.display = "flex";
        enableWrap.style.alignItems = "center";
        enableWrap.style.gap = "4px";
        enableWrap.textContent = "";
        const enableCheck = document.createElement("input");
        enableCheck.type = "checkbox";
        enableCheck.checked = true;
        const enableText = document.createElement("span");
        enableText.textContent = STR.active;
        enableWrap.append(enableCheck, enableText);

        enableChecks[item.key] = enableCheck;

        timerInput.addEventListener("change", async () => {
          const profileId = getProfileIdForKey(item.key);
          if (!profileId) return;
          const ms = parseInt(timerInput.value, 10) || 0;
          enableCheck.checked = ms > 0;
          timerInput.disabled = !enableCheck.checked;
          await invokeMain("ocr:setTimer", { profileId, key: item.key, ms });
        });

        enableCheck.addEventListener("change", async () => {
          const profileId = getProfileIdForKey(item.key);
          if (!profileId) return;
          if (!enableCheck.checked) {
            timerInput.disabled = true;
            timerInput.value = "0";
            await invokeMain("ocr:setTimer", { profileId, key: item.key, ms: 0 });
          } else {
            timerInput.disabled = false;
            const fallback = defaultTimers[item.key] ?? 0;
            const ms = parseInt(timerInput.value, 10) || fallback;
            timerInput.value = String(ms);
            await invokeMain("ocr:setTimer", { profileId, key: item.key, ms });
          }
        });

        if (item.key === "lvl") {
          const manualWrap = document.createElement("div");
          manualWrap.style.display = "flex";
          manualWrap.style.alignItems = "center";
          manualWrap.style.gap = "8px";
          manualWrap.style.flexBasis = "100%";
          manualWrap.style.marginTop = "6px";

          const manualLabel = document.createElement("span");
          manualLabel.className = "ocrTimerLabel";
          manualLabel.textContent = STR.manualLevel;

          manualLevelInput = document.createElement("input");
          manualLevelInput.type = "number";
          manualLevelInput.className = "ocrTimerInput";
          manualLevelInput.min = "1";
          manualLevelInput.max = "300";
          manualLevelInput.step = "1";
          manualLevelInput.placeholder = STR.manualLevelPlaceholder;
          manualLevelInput.value = "";
          manualLevelInput.disabled = true;

          const pushManualUpdate = async (enabledOverride) => {
            if (!manualLevelProfileId) return;
            const enabled = typeof enabledOverride === "boolean" ? enabledOverride : (manualLevelToggle?.checked ?? false);
            const fallbackVal = value.textContent && value.textContent.trim() ? value.textContent : "1";
            const nextVal = clampManualLevelValue(manualLevelInput.value || fallbackVal);
            manualLevelInput.value = String(nextVal);
            try{
              await invokeMain("ocr:manualLevel:set", {
                profileId: manualLevelProfileId,
                value: nextVal,
                enabled,
              });
            }catch(err){
              console.error("ocr:manualLevel:set failed", err);
            }
          };

          manualLevelInput.addEventListener("change", () => {
            void pushManualUpdate();
          });

          const manualToggleWrap = document.createElement("label");
          manualToggleWrap.className = "ocrTimerLabel";
          manualToggleWrap.style.display = "flex";
          manualToggleWrap.style.alignItems = "center";
          manualToggleWrap.style.gap = "4px";
          manualToggleWrap.textContent = "";
          manualLevelToggle = document.createElement("input");
          manualLevelToggle.type = "checkbox";
          manualLevelToggle.checked = false;
          manualLevelToggle.disabled = true;
          const manualToggleText = document.createElement("span");
          manualToggleText.textContent = STR.manual;
          manualToggleWrap.append(manualLevelToggle, manualToggleText);

          manualLevelToggle.addEventListener("change", () => {
            if (manualLevelInput) manualLevelInput.disabled = !manualLevelToggle.checked;
            void pushManualUpdate(manualLevelToggle.checked);
          });

          manualWrap.append(manualLabel, manualLevelInput, manualToggleWrap);
          manualWraps.push(manualWrap);
        }

        if (item.key === "exp") {
          const manualExpWrap = document.createElement("div");
          manualExpWrap.style.display = "flex";
          manualExpWrap.style.alignItems = "center";
          manualExpWrap.style.gap = "8px";
          manualExpWrap.style.flexBasis = "100%";
          manualExpWrap.style.marginTop = "6px";

          const manualExpLabel = document.createElement("span");
          manualExpLabel.className = "ocrTimerLabel";
          manualExpLabel.textContent = STR.manualExp;

          manualExpInput = document.createElement("input");
          manualExpInput.type = "text";
          manualExpInput.className = "ocrTimerInput";
          manualExpInput.placeholder = STR.manualExpPlaceholder;
          manualExpInput.value = "";
          manualExpInput.disabled = true;
          manualExpInput.inputMode = "decimal";

          manualExpButton = document.createElement("button");
          manualExpButton.className = "btn";
          manualExpButton.textContent = STR.manualSet;
          manualExpButton.disabled = true;

          const pushManualExp = async () => {
            if (!manualExpProfileId) return;
            const rawVal = manualExpInput?.value ?? "";
            const trimmed = rawVal.trim();
            if (!trimmed) {
              manualExpInput.value = "";
              return;
            }
            manualExpButton.disabled = true;
            try{
              await invokeMain("ocr:manualExp:set", {
                profileId: manualExpProfileId,
                value: trimmed,
              });
            }catch(err){
              console.error("ocr:manualExp:set failed", err);
            }finally{
              manualExpInput.value = "";
              manualExpButton.disabled = !manualExpProfileId;
            }
          };

          manualExpInput.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              void pushManualExp();
            }
          });
          manualExpButton.addEventListener("click", () => {
            void pushManualExp();
          });

          manualExpWrap.append(manualExpLabel, manualExpInput, manualExpButton);
          manualWraps.push(manualExpWrap);
        }

        timerInputs[item.key] = timerInput;
        timerWrap.append(timerLabel, timerInput, timerUnit, enableWrap);

        row.append(labelWrap, value, timerWrap);
        if (manualWraps.length) {
          manualWraps.forEach((wrap) => row.append(wrap));
        }
        list.append(row);
      });

      const note = document.createElement("div");
      note.className = "hint";
      note.textContent = STR.timerHint;

      let ocrInterval = null;

      const loadTimers = async (profileId, target) => {
        if (!profileId) return;
        try {
          const timers = await invokeMain("ocr:getTimers", profileId);
          for (const key of Object.keys(timerInputs)) {
            if (ocrTargets[key] !== target) continue;
            const val = timers && typeof timers[key] === "number" ? timers[key] : 0;
            timerInputs[key].value = String(val);
            const enabled = val > 0;
            timerInputs[key].disabled = !enabled;
            if (enableChecks[key]) {
              enableChecks[key].checked = enabled;
              enableChecks[key].disabled = false;
            }
          }
        } catch (err) {
          console.error("Failed to load OCR timers", err);
        }
      };

      const applyTimerAvailability = () => {
        ocrItems.forEach((item) => {
          const timer = timerInputs[item.key];
          const check = enableChecks[item.key];
          const hasProfile = !!getProfileIdForKey(item.key);
          if (check) {
            if (!hasProfile) {
              check.checked = false;
            }
            check.disabled = !hasProfile;
          }
          if (timer) {
            const enabled = (check ? check.checked : true) && hasProfile;
            timer.disabled = !enabled;
          }
        });
      };

      const STALE_THRESHOLD_MS = 1500; // 1.5 seconds

      const refreshOcr = async () => {
        try {
          const profileId = await getActiveOverlayProfileId();
          const supportProfileId = await getSupportOverlayProfileId();
          if (!profileId && !supportProfileId) {
            note.textContent = STR.noTarget;
            ocrItems.forEach((item) => {
              if (timerInputs[item.key]) {
                timerInputs[item.key].disabled = true;
              }
              if (enableChecks[item.key]) {
                enableChecks[item.key].disabled = true;
                enableChecks[item.key].checked = false;
              }
            });
            Object.keys(valueEls).forEach((k) => {
              valueEls[k].el.textContent = valueEls[k].format(null);
              valueEls[k].el.style.opacity = "1";
            });
            currentProfileId = null;
            currentSupportProfileId = null;
            disableManualLevelControls();
            disableManualExpControls();
            return;
          }

          const fighterChanged = profileId !== currentProfileId;
          const supportChanged = supportProfileId !== currentSupportProfileId;
          currentProfileId = profileId;
          currentSupportProfileId = supportProfileId;
          if (fighterChanged) {
            setManualExpProfile(profileId);
          }
          if (fighterChanged && profileId) {
            await loadTimers(profileId, "fighter");
          }
          if (supportChanged && supportProfileId) {
            await loadTimers(supportProfileId, "support");
          }

          applyTimerAvailability();

          const dataFighter = profileId ? await invokeMain("ocr:getLatest", profileId) : null;
          const dataSupport = supportProfileId ? await invokeMain("ocr:getLatest", supportProfileId) : null;
          if (profileId && manualLevelProfileId !== profileId) {
            await syncManualLevelState(profileId, dataFighter?.lvl ?? null);
          } else if (!profileId) {
            disableManualLevelControls();
          } else {
            updateManualLevelDisplay(dataFighter?.lvl ?? null);
          }
          if (!profileId) {
            disableManualExpControls();
          }
          const now = Date.now();
          const updatedAtFighter = dataFighter?.updatedAt ?? 0;
          const updatedAtSupport = dataSupport?.updatedAt ?? 0;
          const isStaleFighter = updatedAtFighter > 0 && (now - updatedAtFighter) > STALE_THRESHOLD_MS;
          const isStaleSupport = updatedAtSupport > 0 && (now - updatedAtSupport) > STALE_THRESHOLD_MS;

          ["lvl", "exp", "charname", "lauftext", "enemyName", "enemyHp"].forEach((k) => {
            const v = dataFighter ? dataFighter[k] : null;
            valueEls[k].el.textContent = valueEls[k].format(v);
            valueEls[k].el.style.opacity = isStaleFighter ? "0.5" : "1";
          });
          const rmVal = dataSupport ? (dataSupport.rmExp ?? dataSupport.exp ?? null) : null;
          if (valueEls.rmExp) {
            valueEls.rmExp.el.textContent = valueEls.rmExp.format(rmVal);
            valueEls.rmExp.el.style.opacity = isStaleSupport ? "0.5" : "1";
          }

          const noteParts = [
            profileId ? STR.roi.overlayProfile + ": " + profileId + (isStaleFighter ? " " + STR.stale : "") : null,
            supportProfileId ? STR.roi.supportProfile + ": " + supportProfileId + (isStaleSupport ? " " + STR.stale : "") : null,
          ].filter(Boolean);
          note.textContent = noteParts.join(" | ") || STR.noTarget;
        } catch (err) {
          note.textContent = STR.unavailable;
        }
      };

      ocrInterval = setInterval(refreshOcr, 250);
      refreshOcr();

      const cleanup = () => {
        if (ocrInterval) clearInterval(ocrInterval);
      };

      sec.append(heading, list, note);
      return { section: sec, cleanup };
    };

    const buildRoiSection = () => {
      const sec = document.createElement("div");
      sec.className = "section";

      const heading = document.createElement("div");
      heading.className = "sectionTitle";
      heading.textContent = STR.roi.title;

      const list = document.createElement("div");
      list.className = "roiList";

      const allRow = document.createElement("div");
      allRow.className = "roiRow accent";
      const allLeft = document.createElement("div");
      allLeft.className = "roiLeft";
      const allLabel = document.createElement("div");
      allLabel.className = "roiLabel";
      allLabel.textContent = STR.roi.all;
      allLeft.append(allLabel);
      const allActions = document.createElement("div");
      allActions.className = "roiActions";
      const allToggle = document.createElement("div");
      allToggle.className = "roiToggle";
      const allCb = document.createElement("input");
      allCb.type = "checkbox";
      allCb.id = "roi-cb-all";
      allCb.checked = false;
      allCb.disabled = true;
      const allToggleLabel = document.createElement("label");
      allToggleLabel.htmlFor = "roi-cb-all";
      allToggleLabel.textContent = STR.roi.showAll;
      allToggleLabel.style.cursor = "pointer";
      allToggle.append(allCb, allToggleLabel);
      allActions.append(allToggle);
      allRow.append(allLeft, allActions);
      list.append(allRow);

      const rows = ROI_ITEMS.map(item => {
        const row = document.createElement("div");
        row.className = "roiRow";
        if (item.target === "support") {
          row.classList.add("support");
        }

        const left = document.createElement("div");
        left.className = "roiLeft";
        const labelEl = document.createElement("div");
        labelEl.className = "roiLabel";
        labelEl.textContent = item.label;
        left.append(labelEl);

        const statusWrap = document.createElement("div");
        statusWrap.className = "roiStatus";
        const dot = document.createElement("div");
        dot.className = "roiDot";
        if (item.target === "support") {
          dot.classList.add("support");
        }
        const text = document.createElement("div");
        text.textContent = STR.roi.notSet;
        statusWrap.append(dot, text);

        const actions = document.createElement("div");
        actions.className = "roiActions";

        const btnSet = document.createElement("button");
        btnSet.className = "btn btnBrown";
        btnSet.textContent = STR.roi.set;
        btnSet.onclick = () => openRoiCalibratorFor(item.key);

        const btnDebug = document.createElement("button");
        btnDebug.className = "btn";
        btnDebug.textContent = STR.roi.debug;
        btnDebug.onclick = async () => {
          const pid = profileIdForKey(item.key);
          if (!pid) {
            alert(STR.roi.alertNoProfile);
            return;
          }
          btnDebug.disabled = true;
          btnDebug.textContent = STR.roi.debugSaving;
          try{
            const filePath = await invokeMain("roi:debug:save", { profileId: pid, key: item.key });
            alert(fmt(STR.roi.debugSaved, { path: filePath || "" }));
          }catch(err){
            console.error("roi:debug:save failed", err);
            alert(fmt(STR.roi.debugFailed, { error: err?.message || err }));
          }finally{
            btnDebug.disabled = false;
            btnDebug.textContent = STR.roi.debug;
          }
        };

        const toggle = document.createElement("div");
        toggle.className = "roiToggle";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = false;
        cb.id = "roi-cb-" + item.key;
        if (item.target === "support") {
          cb.style.accentColor = "rgb(255,170,80)";
        }
        cb.addEventListener("change", () => {
          const pid = profileIdForKey(item.key);
          if(DEBUG_SIDEPANEL) console.log("[ROI] checkbox change", item.key, cb.checked, "profileId:", pid);
          if (!pid) {
            if(DEBUG_SIDEPANEL) console.log("[ROI] no profileId, skipping save");
            return;
          }
          setRoiVisibility(pid, item.key, cb.checked).then(() => {
            updateAllCheckbox();
            refresh();
          });
        });
        const toggleLabel = document.createElement("label");
        toggleLabel.htmlFor = "roi-cb-" + item.key;
        toggleLabel.textContent = STR.roi.show;
        toggleLabel.style.cursor = "pointer";
        toggle.append(cb, toggleLabel);

        actions.append(btnSet, btnDebug, toggle);

        row.append(left, statusWrap, actions);
        list.append(row);
        return { key: item.key, dot, text, statusWrap, checkbox: cb, btnSet, btnDebug, target: item.target };
      });
      const manualWrapper = document.createElement("div");
      manualWrapper.className = "roiManual";

      const manualTitle = document.createElement("div");
      manualTitle.className = "roiManualTitle";
      manualTitle.textContent = STR.roi.manualTitle;
      manualWrapper.append(manualTitle);

      const manualSelectWrap = document.createElement("div");
      manualSelectWrap.className = "roiManualField";
      const manualSelectLabel = document.createElement("div");
      manualSelectLabel.className = "roiManualLabel";
      manualSelectLabel.textContent = STR.roi.field;
      const manualSelect = document.createElement("select");
      manualSelect.classList.add("roiManualControl", "roiManualSelect");
      manualSelectWrap.append(manualSelectLabel, manualSelect);
      manualWrapper.append(manualSelectWrap);

      ROI_ITEMS.forEach(item => {
        const option = document.createElement("option");
        option.value = item.key;
        option.textContent = item.label;
        manualSelect.append(option);
      });

      const manualSliderGroup = document.createElement("div");
      manualSliderGroup.className = "roiManualSliderGroup";
      const manualSliders = {};
      ([
        { key: "x", label: STR.roi.axis.x },
        { key: "y", label: STR.roi.axis.y },
        { key: "w", label: STR.roi.axis.w },
        { key: "h", label: STR.roi.axis.h },
      ]).forEach(field => {
        const fieldWrap = document.createElement("div");
        fieldWrap.className = "roiManualField";
        const fieldLabel = document.createElement("div");
        fieldLabel.className = "roiManualLabel";
        fieldLabel.textContent = field.label;
        const sliderWrap = document.createElement("div");
        sliderWrap.className = "roiManualSlider";
        const slider = document.createElement("input");
        slider.type = "range";
        slider.classList.add("roiManualControl", "roiManualRange");
        slider.min = "0";
        slider.max = "1";
        slider.step = "0.001";
        slider.value = "0";
        const valueDisplay = document.createElement("div");
        valueDisplay.className = "roiManualValue";
        valueDisplay.textContent = "0.000";
        sliderWrap.append(slider, valueDisplay);
        const stepBox = document.createElement("div");
        stepBox.className = "roiManualStepper";
        const minus = document.createElement("button");
        minus.type = "button";
        minus.className = "roiManualStepperBtn";
        minus.textContent = "-";
        const plus = document.createElement("button");
        plus.type = "button";
        plus.className = "roiManualStepperBtn";
        plus.textContent = "+";
        const adjust = (delta) => {
          const next = Math.max(0, Math.min(1, slider.valueAsNumber + delta));
          slider.value = String(next);
          slider.dispatchEvent(new Event("input"));
        };
        minus.addEventListener("click", (e) => {
          e.preventDefault();
          adjust(-0.001);
        });
        plus.addEventListener("click", (e) => {
          e.preventDefault();
          adjust(0.001);
        });
        stepBox.append(minus, plus);
        sliderWrap.append(stepBox);
        fieldWrap.append(fieldLabel, sliderWrap);
        manualSliderGroup.append(fieldWrap);
        manualSliders[field.key] = { slider, display: valueDisplay };
        slider.addEventListener("input", () => {
          valueDisplay.textContent = slider.valueAsNumber.toFixed(3);
          scheduleManualApply();
        });
      });
      manualWrapper.append(manualSliderGroup);

      const manualActions = document.createElement("div");
      manualActions.className = "roiManualActions";
      const manualDeleteBtn = document.createElement("button");
      manualDeleteBtn.className = "btn";
      manualDeleteBtn.textContent = STR.roi.remove;
      manualActions.append(manualDeleteBtn);
      manualWrapper.append(manualActions);

      const manualFeedback = document.createElement("div");
      manualFeedback.className = "hint roiManualFeedback";
      manualFeedback.dataset.state = "info";
      manualFeedback.textContent = STR.roi.manual.hint;
      manualWrapper.append(manualFeedback);
      let fighterProfileId = null;
      let supportProfileId = null;
      let currentRoiData = { fighter: {}, support: {} };
      let currentVis = { fighter: {}, support: {} };
      let manualActiveKey = manualSelect.value || ROI_ITEMS[0]?.key || "exp";
      manualSelect.value = manualActiveKey;
      let manualControlsEnabled = false;
      let manualSuppressApply = false;
      let lastApplied = null;
      let lastAppliedKey = null;
      const profileIdForKey = (key) => key === "rmExp" ? supportProfileId : fighterProfileId;
      const roisForKey = (key) => key === "rmExp" ? currentRoiData.support : currentRoiData.fighter;
      const visForKey = (key) => key === "rmExp" ? currentVis.support : currentVis.fighter;

      const getManualLabel = () => ROI_ITEMS.find(item => item.key === manualActiveKey)?.label ?? manualActiveKey;

      function scheduleManualApply() {
        if (!manualControlsEnabled || manualSuppressApply) return;
        applyManualValues({ silent: true });
      }

      async function applyManualValues({ silent = false } = {}) {
        const pid = profileIdForKey(manualActiveKey);
        if (!pid) {
          if (!silent) notifyManual(STR.roi.manual.noProfile, "error");
          return false;
        }
        const normalized = gatherManualValues();
        if (!normalized) {
          notifyManual(STR.roi.manual.invalid, "error");
          return false;
        }
        const label = getManualLabel();
        const payload = {
          x: normalized.x,
          y: normalized.y,
          width: normalized.w,
          height: normalized.h,
        };
        if (lastAppliedKey === manualActiveKey &&
          lastApplied &&
          lastApplied.x === payload.x &&
          lastApplied.y === payload.y &&
          lastApplied.width === payload.width &&
          lastApplied.height === payload.height
        ) {
          return true;
        }
        lastApplied = { ...payload };
        lastAppliedKey = manualActiveKey;
        const base = roisForKey(manualActiveKey) || {};
        const updated = { ...base, [manualActiveKey]: payload };
        try {
          await invokeMain("roi:save", { profileId: pid, rois: updated });
          if (manualActiveKey === "rmExp") {
            currentRoiData = { ...currentRoiData, support: updated };
          } else {
            currentRoiData = { ...currentRoiData, fighter: updated };
          }
          const message = silent ? STR.roi.manual.updated : fmt(STR.roi.manual.saved, { label });
          notifyManual(message, silent ? "info" : "success");
          return true;
        } catch (err) {
          console.error("[ROI] manual save failed", err);
          const reason = err && typeof err === "object" && "message" in err ? err.message : String(err);
          notifyManual(fmt(STR.roi.manual.saveError, { reason: reason || "" }), "error");
          return false;
        }
      }

      const clamp01 = (n) => Math.max(0, Math.min(1, n));
      const formatDecimal = (value) => typeof value === "number" ? value.toFixed(3) : "";
      function notifyManual(message, state = "info") {
        manualFeedback.textContent = message;
        manualFeedback.dataset.state = state;
      }
      function updateManualInputs() {
        const region = roisForKey(manualActiveKey)?.[manualActiveKey];
        const fallback = { x: 0.05, y: 0.05, w: 0.25, h: 0.08 };
        const base = {
          x: typeof region?.x === "number" ? region.x : fallback.x,
          y: typeof region?.y === "number" ? region.y : fallback.y,
          w: typeof region?.width === "number"
            ? region.width
            : typeof region?.w === "number"
              ? region.w
              : fallback.w,
          h: typeof region?.height === "number"
            ? region.height
            : typeof region?.h === "number"
              ? region.h
              : fallback.h,
        };
        manualSuppressApply = true;
        Object.entries(manualSliders).forEach(([axis, { slider, display }]) => {
          const value = base[axis];
          slider.value = String(value);
          display.textContent = value.toFixed(3);
          slider.dispatchEvent(new Event("input"));
        });
        manualSuppressApply = false;
        manualDeleteBtn.disabled = !manualControlsEnabled || !roisForKey(manualActiveKey)?.[manualActiveKey];
      }
      function setManualControlsEnabled(enabled) {
        manualControlsEnabled = enabled;
        manualSelect.disabled = !enabled;
        Object.values(manualSliders).forEach(({ slider }) => {
          slider.disabled = !enabled;
        });
        const hasRoi = !!(roisForKey(manualActiveKey)?.[manualActiveKey]);
        manualDeleteBtn.disabled = !enabled || !hasRoi;
      }
      function gatherManualValues() {
        const result = {};
        for (const key of ["x", "y", "w", "h"]) {
          const slider = manualSliders[key]?.slider;
          if (!slider) return null;
          const parsed = slider.valueAsNumber;
          if (Number.isNaN(parsed)) {
            return null;
          }
          result[key] = clamp01(parsed);
        }
        result.w = Math.max(0.001, result.w);
        result.h = Math.max(0.001, result.h);
        return result;
      }
      manualSelect.addEventListener("change", () => {
        manualActiveKey = manualSelect.value;
        lastApplied = null;
        lastAppliedKey = null;
        setManualControlsEnabled(!!profileIdForKey(manualActiveKey));
        updateManualInputs();
        notifyManual(STR.roi.manual.valuesAdjusted, "info");
      });
      setManualControlsEnabled(false);
      updateManualInputs();

      manualDeleteBtn.addEventListener("click", async () => {
        const pid = profileIdForKey(manualActiveKey);
        if (!pid) {
          notifyManual(STR.roi.manual.noProfile, "error");
          return;
        }
        if (!roisForKey(manualActiveKey)?.[manualActiveKey]) {
          notifyManual(STR.roi.manual.noneToRemove, "error");
          return;
        }
        const label = ROI_ITEMS.find(item => item.key === manualActiveKey)?.label ?? manualActiveKey;
        const current = { ...(roisForKey(manualActiveKey) || {}) };
        delete current[manualActiveKey];
        manualDeleteBtn.disabled = true;
        try {
          await invokeMain("roi:save", { profileId: pid, rois: current });
          if (manualActiveKey === "rmExp") {
            currentRoiData = { ...currentRoiData, support: current };
          } else {
            currentRoiData = { ...currentRoiData, fighter: current };
          }
          notifyManual(fmt(STR.roi.manual.removed, { label }), "success");
        } catch (err) {
          console.error("[ROI] manual delete failed", err);
          notifyManual(STR.roi.manual.removeError, "error");
        } finally {
          manualDeleteBtn.disabled = false;
          await refresh();
        }
      });

      const updateAllCheckbox = () => {
        const relevant = rows.filter(r => profileIdForKey(r.key));
        const allChecked = relevant.length > 0 && relevant.every(r => r.checkbox?.checked);
        allCb.checked = allChecked;
        allCb.disabled = relevant.length === 0;
      };

      allCb.addEventListener("change", async () => {
        if(DEBUG_SIDEPANEL) console.log("[ROI] ALL checkbox change", allCb.checked);
        const checked = allCb.checked;
        for (const r of rows) {
          const pid = profileIdForKey(r.key);
          if (r.checkbox && pid) {
            r.checkbox.checked = checked;
            await setRoiVisibility(pid, r.key, checked);
          }
        }
        refresh();
      });

      const note = document.createElement("div");
      note.className = "hint";
      note.textContent = STR.roi.status.loading;

      const applyStatus = (roisFighter, roisSupport, visFighter, visSupport, fighterId, supportId) => {
        fighterProfileId = fighterId;
        supportProfileId = supportId;
        currentRoiData = { fighter: roisFighter || {}, support: roisSupport || {} };
        currentVis = { fighter: visFighter || {}, support: visSupport || {} };
        lastApplied = null;
        lastAppliedKey = null;
        rows.forEach(r => {
          const pid = profileIdForKey(r.key);
          const rois = r.target === "support" ? currentRoiData.support : currentRoiData.fighter;
          const vis = r.target === "support" ? currentVis.support : currentVis.fighter;
          const on = !!(rois && rois[r.key]);
          r.dot.classList.toggle("on", on);
          r.statusWrap.classList.toggle("on", on);
          r.text.textContent = pid ? "" : STR.roi.noProfileLabel;
          if (r.checkbox) {
            const v = vis && typeof vis[r.key] === "boolean" ? vis[r.key] : false;
            r.checkbox.checked = !!v;
            r.checkbox.disabled = !pid;
          }
          if (r.btnSet) {
            r.btnSet.disabled = !pid;
          }
          if (r.btnDebug) {
            r.btnDebug.disabled = !pid;
          }
        });
        updateAllCheckbox();
        setManualControlsEnabled(!!profileIdForKey(manualActiveKey));
        updateManualInputs();
      };

      applyStatus({}, {}, {}, {}, null, null);

      async function refresh() {
        try{
          const [fighterId, supportId] = await Promise.all([
            getActiveOverlayProfileId(),
            getSupportOverlayProfileId(),
          ]);
          const [fighterRois, fighterVis] = fighterId ? await Promise.all([
            loadRoiData(fighterId),
            loadRoiVisibility(fighterId),
          ]) : [null, null];
          const [supportRois, supportVis] = supportId ? await Promise.all([
            loadRoiData(supportId),
            loadRoiVisibility(supportId),
          ]) : [null, null];
          if (!fighterId && !supportId) {
            note.textContent = STR.noTarget;
            applyStatus({}, {}, {}, {}, null, null);
            return;
          }
          const noteText = [
            fighterId ? STR.roi.overlayProfile + ": " + fighterId : null,
            supportId ? STR.roi.supportProfile + ": " + supportId : null,
          ].filter(Boolean).join(" | ");
          note.textContent = noteText || STR.noTarget;
          applyStatus(fighterRois || {}, supportRois || {}, fighterVis || {}, supportVis || {}, fighterId, supportId);
        }catch(_err){
          note.textContent = STR.roi.status.error;
        }
      }

      refresh();

      sec.append(heading, list, manualWrapper, note);
      return { section: sec, cleanup: null };
    };

    const ocrSection = buildOcrSection();
    if (ocrSection?.section) {
      content.append(ocrSection.section);
    }
    if (ocrSection?.cleanup) {
      cleanups.push(ocrSection.cleanup);
    }

    const roiSection = buildRoiSection();
    if (roiSection?.section) {
      content.append(roiSection.section);
    }
    if (roiSection?.cleanup) {
      cleanups.push(roiSection.cleanup);
    }

    content._cleanup = () => {
      cleanups.forEach(fn => {
        try {
          if (typeof fn === "function") fn();
        } catch (err) {
          console.warn("[HudPanel] cleanup failed", err);
        }
      });
    };
  }

  // Cleanup old tab before rendering new
  function setTab(name) {
    if (content._cleanup) {
      content._cleanup();
      content._cleanup = null;
    }
    currentTab = name;
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    renderTab(name);
  }

  // Tab click handlers
  tabs.forEach(t => {
    t.onclick = () => setTab(t.dataset.tab);
  });

  // Plugin tabs support
  const pluginTabs = [];
  const tabsContainer = document.getElementById("tabs");

  async function loadPluginTabs() {
    try {
      const ipc = getIpc();
      if (!ipc?.invoke) {
        if (DEBUG_SIDEPANEL) console.log("[HudPanel] No IPC for plugin tabs");
        return;
      }
      const result = await ipc.invoke("plugins:getSidepanelTabs");
      const tabsData = result?.data ?? result ?? [];
      if (DEBUG_SIDEPANEL) console.log("[HudPanel] Plugin tabs:", tabsData);

      for (const tab of tabsData) {
        const btn = document.createElement("button");
        btn.className = "tab";
        btn.dataset.tab = "plugin:" + tab.pluginId;
        btn.textContent = tab.label;
        btn.onclick = () => setTab("plugin:" + tab.pluginId);
        tabsContainer.appendChild(btn);
        tabs.push(btn);
        pluginTabs.push(tab);
      }
    } catch (err) {
      console.error("[HudPanel] Failed to load plugin tabs:", err);
    }
  }

  async function renderTab(name) {
    if (name && name.startsWith("plugin:")) {
      setPluginMode(true);
      const pluginId = name.replace("plugin:", "");
      const pluginTab = pluginTabs.find(t => t.pluginId === pluginId);
      if (!pluginTab) {
        content.innerHTML = "<div class='section'><div class='hint'>" + STR.pluginTabMissing + "</div></div>";
        return;
      }

      if (content._cleanup) {
        content._cleanup();
        content._cleanup = null;
      }

      content.innerHTML = "";
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "width:100%;height:100%;border:none;background:transparent;display:block;flex:1 1 auto;";
      iframe.sandbox = "allow-scripts allow-same-origin";
      pluginFrames.set(pluginId, iframe);

      // Inline the plugin sidepanel HTML so we can inject the IPC bridge BEFORE plugin JS runs.
      const SCRIPT_CLOSE = "</scr" + "ipt>";
      const bridge = [
        "window.__pluginId = " + JSON.stringify(pluginId) + ";",
        "window.__pluginLocale = \\"" + locale + "\\";",
        "window.plugin = window.plugin || {};",
        "if (!window.plugin.ipc) {",
        "  window.plugin.ipc = {",
        "    invoke: function(channel, ...args) {",
        "      return parent.invokePluginChannel(" + JSON.stringify(pluginId) + ", channel, ...args);",
        "    }",
        "  };",
        "}",
      ].join("\\n"); // use escaped newline so the outer template literal doesn't break the string

      // Build srcdoc from manifest payload
      let html = pluginTab.html;
      // Ensure base href so relative assets work
      if (pluginTab.baseHref && html.includes("<head>") && !/<base\\s/i.test(html)) {
        html = html.replace("<head>", '<head><base href="' + pluginTab.baseHref + '">');
      }
      // Strip external css/js (we inline below)
      const stripCss = new RegExp("<link[^>]*ui_sidepanel\\\\.css[^>]*>", "i");
      const stripJs = new RegExp("<script[^>]*ui_sidepanel\\\\.js[^>]*>" + SCRIPT_CLOSE, "i");
      html = html.replace(stripCss, "");
      html = html.replace(stripJs, "");
      if (pluginTab.css) {
        html = html.replace("</head>", "<style>" + pluginTab.css + "</style></head>");
      }
      const combinedJs = bridge + "\\n" + (pluginTab.js || "");
      const OPEN_SCRIPT = "<scr" + "ipt>";
      const CLOSE_SCRIPT = "</scr" + "ipt>";
      if (html.includes("</body>")) {
        html = html.replace("</body>", OPEN_SCRIPT + combinedJs + CLOSE_SCRIPT + "</body>");
      } else {
        html += OPEN_SCRIPT + combinedJs + CLOSE_SCRIPT;
      }

      iframe.srcdoc = html;

      iframe.addEventListener("load", async () => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (doc) applyThemeToPluginDocument(doc);
          const overlayTargetId = await getActiveOverlayProfileId().catch(() => null);
          const win = iframe.contentWindow;
          if (win) {
            win.__overlayTargetId = overlayTargetId;
            if (doc?.documentElement) doc.documentElement.lang = locale;
          }
        } catch (err) {
          console.error("[HudPanel] Failed to init plugin frame", err);
        }
      });

      content.appendChild(iframe);

      content._cleanup = () => {
        pluginFrames.delete(pluginId);
        iframe.srcdoc = "about:blank";
      };
      return;
    }

    // Original tab rendering for ROI/OCR
    setPluginMode(false);
    renderCoreTab(name);
  }

  // Expose plugin channel invoker for iframe
  window.invokePluginChannel = async function(pluginId, channel, ...args) {
    const ipc = getIpc();
    if (!ipc?.invoke) throw new Error("IPC not available");
    const res = await ipc.invoke("plugins:invokeChannel", pluginId, channel, ...args);
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

  loadPluginTabs();
  setTab("ocr");
${HTML_SCRIPT_CLOSE}
</body>
</html>
`.trim();
    // Write HTML to a temp file so the preload script gets loaded.
    // data: URLs don't load preload scripts in Electron.
    const tempDir = app.getPath("temp");
    const tempHtmlPath = path.join(tempDir, "flyff-sidepanel.html");
    try {
        fs.writeFileSync(tempHtmlPath, html, "utf-8");
        win.loadFile(tempHtmlPath).catch((err) => console.error("[SidePanelWindow] load failed", err));
    } catch (err) {
        console.error("[SidePanelWindow] failed to write temp HTML", err);
        // Fallback to data URL (IPC won't work but at least UI shows)
        win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html)).catch((e) => console.error("[SidePanelWindow] fallback load failed", e));
    }
    return win;
}

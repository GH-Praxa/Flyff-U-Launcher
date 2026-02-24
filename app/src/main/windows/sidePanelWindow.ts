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
        tabLogs: t("sidePanel.tab.logs"),
        logsTitle: t("sidePanel.logs.title"),
        logsClear: t("sidePanel.logs.clear"),
        logsSave: t("sidePanel.logs.save"),
        logsEmpty: t("sidePanel.logs.empty"),
        logsSendDiscord: t("sidePanel.logs.sendDiscord"),
        logsSendDiscordCooldown: t("sidePanel.logs.sendDiscordCooldown"),
        logsReportTitle: t("sidePanel.logs.reportTitle"),
        logsReportWhen: t("sidePanel.logs.reportWhen"),
        logsReportWhenHint: t("sidePanel.logs.reportWhenHint"),
        logsReportName: t("sidePanel.logs.reportName"),
        logsReportSend: t("sidePanel.logs.reportSend"),
        logsReportCancel: t("sidePanel.logs.reportCancel"),
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
    // Track move state to hide panel during drag (prevents flicker)
    let moveTimeout: NodeJS.Timeout | null = null;

    const syncToParentBounds = () => {
        try {
            const parentBounds = parent.getContentBounds();
            const current = win.getContentSize();
            const currentWidth = Array.isArray(current) ? current[0] : win.getBounds().width;
            const width = Math.max(260, Math.min(620, currentWidth || 420));
            const height = parentBounds.height;
            const x = parentBounds.x + parentBounds.width - width;
            const y = parentBounds.y;

            // Skip if nothing changed to avoid focus interruptions on Windows
            const curBounds = win.getBounds();
            if (curBounds.x === x && curBounds.y === y && curBounds.width === width && curBounds.height === height) {
                return;
            }

            win.setContentSize(width, height);
            win.setPosition(x, y);
        } catch (_err) {
            /* ignore resize errors */
        }
    };

    const onParentMove = () => {
        if (win.isDestroyed()) return;
        // Hide during movement
        win.setOpacity(0);
        // Clear previous timeout
        if (moveTimeout) clearTimeout(moveTimeout);
        // Show again after movement stops
        moveTimeout = setTimeout(() => {
            if (win.isDestroyed()) return;
            syncToParentBounds();
            win.setOpacity(1);
        }, 100);
    };

    syncToParentBounds();
    parent.on("resize", syncToParentBounds);
    parent.on("move", onParentMove);
    win.on("closed", () => {
        if (moveTimeout) clearTimeout(moveTimeout);
        parent.removeListener("resize", syncToParentBounds);
        parent.removeListener("move", onParentMove);
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
    --scrollbar-size: 10px;
    --scroll-track: rgba(255,255,255,0.05);
    --scroll-track-border: rgba(255,255,255,0.08);
    --scroll-thumb-border: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.55);
    --scroll-thumb-top: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.42);
    --scroll-thumb-bottom: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.22);
    --scroll-thumb-top-hover: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.58);
    --scroll-thumb-bottom-hover: rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.30);
  }

  *,
  *::before,
  *::after{
    box-sizing: border-box;
    scrollbar-width: thin !important;
    scrollbar-color: var(--scroll-thumb-border) var(--scroll-track) !important;
  }
  html::-webkit-scrollbar,
  body::-webkit-scrollbar,
  *::-webkit-scrollbar{
    width: var(--scrollbar-size) !important;
    height: var(--scrollbar-size) !important;
  }
  *::-webkit-scrollbar-track{
    background: var(--scroll-track) !important;
    border-radius: 999px;
    border: 1px solid var(--scroll-track-border) !important;
  }
  *::-webkit-scrollbar-thumb{
    background: linear-gradient(180deg, var(--scroll-thumb-top), var(--scroll-thumb-bottom)) !important;
    border-radius: 999px;
    border: 1px solid var(--scroll-thumb-border) !important;
  }
  *::-webkit-scrollbar-thumb:hover{
    background: linear-gradient(180deg, var(--scroll-thumb-top-hover), var(--scroll-thumb-bottom-hover)) !important;
  }
  *::-webkit-scrollbar-corner{
    background: transparent !important;
  }

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

  .collapsible{ border:1px solid var(--stroke); border-radius:12px; background:rgba(255,255,255,0.02); overflow:hidden; margin-top:8px; }
  .collapsibleHeader{ display:flex; align-items:center; justify-content:space-between; padding:10px 12px; cursor:pointer; background:rgba(255,255,255,0.03); transition:background 120ms ease; user-select:none; }
  .collapsibleHeader:hover{ background:rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.10); }
  .collapsibleHeaderTitle{ font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:0.04em; }
  .collapsibleArrow{ font-size:10px; color:var(--muted); transition:transform 200ms ease; }
  .collapsible.open .collapsibleArrow{ transform:rotate(90deg); }
  .collapsibleContent{ display:none; padding:10px 12px; border-top:1px solid var(--stroke); }
  .collapsible.open .collapsibleContent{ display:block; }

  .ocrPrimary{ display:flex; flex-direction:column; gap:6px; }
  .ocrCompactRow{ display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-radius:8px; background:rgba(255,255,255,0.04); gap:8px; }
  .ocrCompactLabel{ font-size:12px; color:var(--muted); min-width:50px; }
  .ocrCompactValue{ font-size:14px; color:var(--text); font-weight:600; font-family:"Consolas","Monaco",monospace; flex:1; }
  .ocrCompactValue.stale{ opacity:0.5; }
  .ocrStatusDot{ width:8px; height:8px; border-radius:50%; background:var(--muted); flex-shrink:0; }
  .ocrStatusDot.active{ background:rgba(var(--accent-rgb,var(--tab-active-rgb,46,204,113)),0.9); box-shadow:0 0 6px rgba(var(--accent-rgb,var(--tab-active-rgb,46,204,113)),0.5); }
  .ocrStatusDot.inactive{ background:var(--muted); }
  .ocrSettingsBtn{ width:24px; height:24px; border-radius:6px; border:1px solid var(--stroke); background:transparent; color:var(--muted); cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center; transition:all 120ms ease; flex-shrink:0; }
  .ocrSettingsBtn:hover{ background:rgba(var(--accent-rgb),0.15); color:var(--text); border-color:rgba(var(--accent-rgb),0.5); }
  .ocrSettingsBtn:disabled{ opacity:0.3; cursor:not-allowed; }
  .ocrFooter{ display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 0 0 0; margin-top:8px; border-top:1px solid var(--stroke); }
  .ocrFooterText{ font-size:11px; color:var(--muted); }
  .ocrFooterStatus{ display:flex; align-items:center; gap:6px; font-size:11px; }
  .ocrFooterStatus.ok{ color:rgba(var(--green-rgb),0.9); }
  .ocrFooterStatus.warn{ color:rgba(255,170,80,0.9); }
  .ocrFooterStatus.error{ color:rgba(var(--danger-rgb),0.9); }

  .settingsOverlay{ position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); display:none; align-items:center; justify-content:center; z-index:1000; }
  .settingsOverlay.open{ display:flex; }
  .settingsModal{ background:var(--panel); border:1px solid var(--stroke); border-radius:14px; width:90%; max-width:320px; max-height:85%; overflow:auto; box-shadow:0 20px 60px rgba(0,0,0,0.5); }
  .settingsModalHeader{ display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid var(--stroke); background:linear-gradient(180deg, rgba(var(--accent-rgb),0.12), transparent); }
  .settingsModalTitle{ font-size:13px; font-weight:600; color:var(--text); }
  .settingsModalClose{ width:26px; height:26px; border-radius:8px; border:1px solid var(--stroke); background:transparent; color:var(--muted); cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; }
  .settingsModalClose:hover{ background:rgba(var(--danger-rgb),0.2); color:var(--text); border-color:rgba(var(--danger-rgb),0.5); }
  .settingsModalBody{ padding:12px 14px; display:flex; flex-direction:column; gap:14px; }
  .settingsSection{ display:flex; flex-direction:column; gap:8px; }
  .settingsSectionTitle{ font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:0.05em; }
  .settingsRow{ display:flex; align-items:center; gap:8px; }
  .settingsRow label{ font-size:11px; color:var(--text); display:flex; align-items:center; gap:4px; cursor:pointer; }
  .settingsRow input[type="number"]{ width:70px; padding:6px 8px; border-radius:8px; border:1px solid var(--stroke); background:rgba(255,255,255,0.05); color:var(--text); font-size:12px; }
  .settingsRow input[type="checkbox"]{ width:16px; height:16px; accent-color:var(--accent); }
  .settingsRow .btn{ padding:6px 10px; font-size:11px; }
  .settingsSliderGroup{ display:flex; flex-direction:column; gap:6px; }
  .settingsSliderRow{ display:flex; align-items:center; gap:8px; }
  .settingsSliderRow span:first-child{ width:20px; font-size:10px; color:var(--muted); }
  .settingsSliderRow input[type="range"]{ flex:1; height:4px; accent-color:var(--accent); }
  .settingsSliderRow span:last-child{ width:40px; font-size:10px; text-align:right; font-family:monospace; color:var(--text); }
  .settingsHint{ font-size:10px; color:var(--muted); margin-top:4px; }
  .settingsError{ font-size:10px; color:var(--danger); }

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
        <button class="tab" data-tab="logs">Logs</button>
      </div>
      <div id="content"></div>
    </div>
  </div>

<script>
  const STR = ${stringsJson};
  // Locale shortcut so later script sections (plugin iframe bridge, lang attribute) can use it safely
  const locale = STR.locale;
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
  const pluginBroadcastSubs = new Map(); // "pluginId:channel" -> ipc listener fn
  const ERROR_LOG_MAX = 500;
  const errorLogState = {
    initialized: false,
    entries: [],
    listeners: new Set(),
    unsubscribeLive: null,
  };

  function normalizeErrorLogEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    const level = String(entry.level || "").toLowerCase();
    if (level !== "error") return null;
    const ts = Number(entry.ts);
    return {
      ts: Number.isFinite(ts) ? ts : Date.now(),
      level: "error",
      module: entry.module ? String(entry.module) : "App",
      message: entry.message ? String(entry.message) : "",
    };
  }

  function notifyErrorLogListeners() {
    for (const listener of errorLogState.listeners) {
      try {
        if (typeof listener === "function") listener();
      } catch (_err) { /* ignore listener errors */ }
    }
  }

  function setErrorLogEntries(entries) {
    const next = [];
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        const normalized = normalizeErrorLogEntry(entry);
        if (normalized) next.push(normalized);
      }
    }
    if (next.length > ERROR_LOG_MAX) {
      next.splice(0, next.length - ERROR_LOG_MAX);
    }
    errorLogState.entries = next;
    notifyErrorLogListeners();
  }

  function pushErrorLogEntry(entry) {
    const normalized = normalizeErrorLogEntry(entry);
    if (!normalized) return;
    errorLogState.entries.push(normalized);
    if (errorLogState.entries.length > ERROR_LOG_MAX) {
      errorLogState.entries.splice(0, errorLogState.entries.length - ERROR_LOG_MAX);
    }
    notifyErrorLogListeners();
  }

  function clearErrorLogEntriesLocal() {
    errorLogState.entries = [];
    notifyErrorLogListeners();
  }

  function onErrorLogStateChange(listener) {
    errorLogState.listeners.add(listener);
    return () => {
      errorLogState.listeners.delete(listener);
    };
  }

  async function ensureErrorLogCapture() {
    if (errorLogState.initialized) return;
    errorLogState.initialized = true;

    try {
      const entries = await invokeMain("logs:get");
      setErrorLogEntries(entries);
    } catch (err) {
      console.error("[LogsTab] Failed to initialize error logs", err);
    }

    const ipc = getIpc();
    if (ipc && ipc.on) {
      const removeLiveListener = ipc.on("logs:new", function() {
        const args = Array.prototype.slice.call(arguments);
        const entry = args.length > 1 ? args[1] : args[0];
        pushErrorLogEntry(entry);
      });
      if (typeof removeLiveListener === "function") {
        errorLogState.unsubscribeLive = removeLiveListener;
      }
    }
  }

  // Start capturing error logs globally, independent of active tab/focus.
  void ensureErrorLogCapture();

  window.addEventListener("beforeunload", () => {
    if (typeof errorLogState.unsubscribeLive === "function") {
      errorLogState.unsubscribeLive();
      errorLogState.unsubscribeLive = null;
    }
  });

  // Relay plugin broadcasts from main process to plugin iframes via postMessage.
  window.addEventListener("message", function(e) {
    if (!e.data || e.data.type !== "plugin:subscribe") return;
    var pid = e.data.pluginId;
    var ch = e.data.channel;
    if (!pid || !ch) return;
    var prefixed = pid + ":" + ch;
    if (pluginBroadcastSubs.has(prefixed)) return; // already subscribed
    var ipc = getIpc();
    if (!ipc || !ipc.on) return;
    // window.ipc.on (preload bridge) strips the event arg and passes (payload) directly.
    // ipcRenderer.on passes (event, payload). Handle both via rest args.
    var handler = function() {
      var args = Array.prototype.slice.call(arguments);
      // Preload bridge: args = [payload]; ipcRenderer: args = [event, payload]
      var payload = args.length > 1 ? args[1] : args[0];
      var frame = pluginFrames.get(pid);
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: "plugin:broadcast", channel: ch, payload: payload != null ? payload : null }, "*");
      }
    };
    ipc.on(prefixed, handler);
    pluginBroadcastSubs.set(prefixed, handler);
  });
  const toggleBtn = document.getElementById("toggle");
  if (toggleBtn) toggleBtn.title = STR.toggleTitle;
  const resizeGripEl = document.getElementById("resizeGrip");
  if (resizeGripEl) resizeGripEl.title = STR.resizeTitle;
  const defaultTabBtn = document.querySelector(".tab[data-tab='ocr']");
  if (defaultTabBtn) defaultTabBtn.textContent = STR.tabOcr;
  const logsTabBtn = document.querySelector(".tab[data-tab='logs']");
  if (logsTabBtn) logsTabBtn.textContent = STR.tabLogs;

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
      ":root{" + vars + extraVars + "--scrollbar-size:10px;--scroll-track:rgba(255,255,255,0.05);--scroll-track-border:rgba(255,255,255,0.08);--scroll-thumb-border:rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.55);--scroll-thumb-top:rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.42);--scroll-thumb-bottom:rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.22);--scroll-thumb-top-hover:rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.58);--scroll-thumb-bottom-hover:rgba(var(--accent-rgb, var(--tab-active-rgb,46,204,113)),0.30);}",
      "*,*::before,*::after{box-sizing:border-box;scrollbar-width:thin !important;scrollbar-color:var(--scroll-thumb-border) var(--scroll-track) !important;}",
      "html::-webkit-scrollbar,body::-webkit-scrollbar,*::-webkit-scrollbar{width:var(--scrollbar-size) !important;height:var(--scrollbar-size) !important;}",
      "*::-webkit-scrollbar-track{background:var(--scroll-track) !important;border-radius:999px;border:1px solid var(--scroll-track-border) !important;}",
      "*::-webkit-scrollbar-thumb{background:linear-gradient(180deg, var(--scroll-thumb-top), var(--scroll-thumb-bottom)) !important;border-radius:999px;border:1px solid var(--scroll-thumb-border) !important;}",
      "*::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg, var(--scroll-thumb-top-hover), var(--scroll-thumb-bottom-hover)) !important;}",
      "*::-webkit-scrollbar-corner{background:transparent !important;}",
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

  // OCR keep-alive: ensure ocr:getLatest is called periodically even when a plugin
  // tab is active.  Without this, OCR scanning stalls because ocr:getLatest triggers
  // runImmediateOcr() when data is stale (>1200ms), and no other caller keeps it fresh
  // while the built-in OCR tab is not visible.
  setInterval(async () => {
    if (currentTab === "ocr") return; // OCR tab has its own 250ms refresh
    try {
      const pid = await getActiveOverlayProfileId();
      if (pid) await invokeMain("ocr:getLatest", pid);
      const spid = await getSupportOverlayProfileId();
      if (spid && spid !== pid) await invokeMain("ocr:getLatest", spid);
    } catch (_) { /* non-critical */ }
  }, 500);

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

  function renderLogsTab() {
    const sec = document.createElement("div");
    sec.className = "section";
    sec.style.cssText = "display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;";

    // Header row
    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;";
    const title = document.createElement("div");
    title.className = "sectionTitle";
    title.style.marginBottom = "0";
    title.textContent = STR.logsTitle;
    header.appendChild(title);

    const btnGroup = document.createElement("div");
    btnGroup.style.cssText = "display:flex;gap:6px;";

    const clearBtn = document.createElement("button");
    clearBtn.textContent = STR.logsClear;
    clearBtn.style.cssText = "border:1px solid var(--stroke);background:rgba(var(--danger-rgb),0.15);color:var(--text);border-radius:8px;padding:4px 10px;cursor:pointer;font-size:11px;";
    clearBtn.onmouseenter = () => { clearBtn.style.borderColor = "rgba(var(--danger-rgb),0.7)"; };
    clearBtn.onmouseleave = () => { clearBtn.style.borderColor = "var(--stroke)"; };

    const saveBtn = document.createElement("button");
    saveBtn.textContent = STR.logsSave;
    saveBtn.style.cssText = "border:1px solid var(--stroke);background:rgba(var(--accent-rgb),0.15);color:var(--text);border-radius:8px;padding:4px 10px;cursor:pointer;font-size:11px;";
    saveBtn.onmouseenter = () => { saveBtn.style.borderColor = "rgba(var(--accent-rgb),0.7)"; };
    saveBtn.onmouseleave = () => { saveBtn.style.borderColor = "var(--stroke)"; };

    const discordBtn = document.createElement("button");
    discordBtn.textContent = STR.logsSendDiscord;
    discordBtn.disabled = true;
    discordBtn.style.cssText = "border:1px solid var(--stroke);background:rgba(88,101,242,0.15);color:var(--text);border-radius:8px;padding:4px 10px;cursor:not-allowed;font-size:11px;opacity:0.45;";
    discordBtn.onmouseenter = () => { if (!discordBtn.disabled) discordBtn.style.borderColor = "rgba(88,101,242,0.7)"; };
    discordBtn.onmouseleave = () => { discordBtn.style.borderColor = "var(--stroke)"; };
    let discordCooldownTimer = null;

    // Enable Discord button only when telemetry (Discord communication) is permitted
    invokeMain("clientSettings:get").then((s) => {
      if (s?.sendTelemetry) {
        discordBtn.disabled = false;
        discordBtn.style.opacity = "";
        discordBtn.style.cursor = "pointer";
      }
    }).catch(() => { /* ignore */ });

    btnGroup.appendChild(clearBtn);
    btnGroup.appendChild(saveBtn);
    btnGroup.appendChild(discordBtn);
    header.appendChild(btnGroup);
    sec.appendChild(header);

    // Log container
    const logContainer = document.createElement("div");
    logContainer.style.cssText = "flex:1;min-height:0;overflow:auto;font-family:'Cascadia Mono','Fira Code','Consolas',monospace;font-size:11px;line-height:1.5;padding:6px;border:1px solid var(--stroke);border-radius:8px;background:rgba(0,0,0,0.25);white-space:pre-wrap;word-break:break-all;";

    const emptyMsg = document.createElement("div");
    emptyMsg.className = "hint";
    emptyMsg.textContent = STR.logsEmpty;
    emptyMsg.style.padding = "10px";

    function pad2(n) { return String(n).padStart(2, "0"); }

    function formatEntry(e) {
      const d = new Date(e.ts);
      const time = pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
      return "[" + time + "] [" + e.level.toUpperCase() + "] [" + e.module + "] " + e.message;
    }

    function renderEntries(stickToBottom) {
      const wasNearBottom = stickToBottom || (logContainer.scrollHeight - logContainer.scrollTop - logContainer.clientHeight < 30);
      logContainer.innerHTML = "";
      if (!errorLogState.entries.length) {
        logContainer.appendChild(emptyMsg);
        return;
      }
      const frag = document.createDocumentFragment();
      for (const e of errorLogState.entries) {
        const line = document.createElement("div");
        line.textContent = formatEntry(e);
        line.style.color = "rgba(var(--danger-rgb),0.9)";
        frag.appendChild(line);
      }
      logContainer.appendChild(frag);
      if (wasNearBottom) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    }

    // Render existing entries and keep updating from global state.
    renderEntries(true);
    const removeStateListener = onErrorLogStateChange(() => renderEntries(false));
    void ensureErrorLogCapture();

    // Clear button
    clearBtn.onclick = async () => {
      try {
        await invokeMain("logs:clear");
        clearErrorLogEntriesLocal();
      } catch (err) {
        console.error("[LogsTab] Clear failed", err);
      }
    };

    // Save button
    saveBtn.onclick = async () => {
      try {
        const filePath = await invokeMain("logs:save");
        saveBtn.textContent = filePath ? "OK" : STR.logsSave;
        setTimeout(() => { saveBtn.textContent = STR.logsSave; }, 2000);
      } catch (err) {
        console.error("[LogsTab] Save failed", err);
      }
    };

    // Discord button
    function startDiscordCooldown(remainingMs) {
      discordBtn.disabled = true;
      discordBtn.style.opacity = "0.55";
      discordBtn.style.cursor = "not-allowed";
      const endTs = Date.now() + remainingMs;
      function tick() {
        const left = Math.ceil((endTs - Date.now()) / 1000);
        if (left <= 0) {
          discordBtn.textContent = STR.logsSendDiscord;
          discordBtn.disabled = false;
          discordBtn.style.opacity = "";
          discordBtn.style.cursor = "pointer";
          if (discordCooldownTimer !== null) { clearInterval(discordCooldownTimer); discordCooldownTimer = null; }
          return;
        }
        discordBtn.textContent = STR.logsSendDiscordCooldown.replace("{s}", String(left));
      }
      tick();
      discordCooldownTimer = setInterval(tick, 500);
    }
    discordBtn.onclick = () => {
      if (discordBtn.disabled) return;

      // Build report dialog overlay
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;";

      const dialog = document.createElement("div");
      dialog.style.cssText = "background:var(--panel,#0d1926);border:1px solid var(--stroke,rgba(255,255,255,0.12));border-radius:14px;padding:20px;width:320px;display:flex;flex-direction:column;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);";

      const titleEl = document.createElement("div");
      titleEl.textContent = STR.logsReportTitle;
      titleEl.style.cssText = "font-size:14px;font-weight:600;color:var(--text,#e0e8f0);";

      const whenLabel = document.createElement("label");
      whenLabel.style.cssText = "display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-muted,rgba(224,232,240,0.6));";
      whenLabel.textContent = STR.logsReportWhen;
      const whenArea = document.createElement("textarea");
      whenArea.placeholder = STR.logsReportWhenHint;
      whenArea.rows = 3;
      whenArea.style.cssText = "resize:vertical;background:rgba(0,0,0,0.25);border:1px solid var(--stroke,rgba(255,255,255,0.12));border-radius:8px;color:var(--text,#e0e8f0);font-size:12px;padding:6px 8px;font-family:inherit;min-height:60px;";
      whenLabel.appendChild(whenArea);

      const nameLabel = document.createElement("label");
      nameLabel.style.cssText = "display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-muted,rgba(224,232,240,0.6));";
      nameLabel.textContent = STR.logsReportName;
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.style.cssText = "background:rgba(0,0,0,0.25);border:1px solid var(--stroke,rgba(255,255,255,0.12));border-radius:8px;color:var(--text,#e0e8f0);font-size:12px;padding:6px 8px;font-family:inherit;";
      nameLabel.appendChild(nameInput);

      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:4px;";

      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = STR.logsReportCancel;
      cancelBtn.style.cssText = "border:1px solid var(--stroke,rgba(255,255,255,0.12));background:transparent;color:var(--text,#e0e8f0);border-radius:8px;padding:6px 14px;cursor:pointer;font-size:12px;";

      const sendBtn = document.createElement("button");
      sendBtn.textContent = STR.logsReportSend;
      sendBtn.style.cssText = "border:1px solid rgba(88,101,242,0.5);background:rgba(88,101,242,0.2);color:var(--text,#e0e8f0);border-radius:8px;padding:6px 14px;cursor:pointer;font-size:12px;";

      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(sendBtn);
      dialog.appendChild(titleEl);
      dialog.appendChild(whenLabel);
      dialog.appendChild(nameLabel);
      dialog.appendChild(btnRow);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      whenArea.focus();

      const close = () => overlay.remove();
      cancelBtn.onclick = close;
      overlay.onclick = (e) => { if (e.target === overlay) close(); };

      sendBtn.onclick = async () => {
        close();
        try {
          const userNote = whenArea.value.trim();
          const userName = nameInput.value.trim();
          const result = await invokeMain("logs:sendToDiscord", userNote || null, userName || null);
          if (result.cooldownMs) {
            startDiscordCooldown(result.cooldownMs);
          } else if (result.sent) {
            discordBtn.textContent = "OK";
            startDiscordCooldown(60_000);
          }
          // noWebhook / noLogs: silently ignore
        } catch (err) {
          console.error("[LogsTab] sendToDiscord failed", err);
        }
      };
    };

    sec.appendChild(logContainer);
    content.appendChild(sec);

    // Cleanup when tab switches
    content._cleanup = () => {
      if (typeof removeStateListener === "function") {
        removeStateListener();
      }
      if (discordCooldownTimer !== null) {
        clearInterval(discordCooldownTimer);
        discordCooldownTimer = null;
      }
    };
  }

  function renderCoreTab(name) {
    content.innerHTML = "";

    if (name === "logs") {
      renderLogsTab();
      return;
    }

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

      const formatVal = (v) => (v === null || v === undefined || v === "" ? "-" : String(v));

      const primaryList = document.createElement("div");
      primaryList.className = "ocrPrimary";

      const allFields = [
        { key: "lvl", label: STR.ocrFields.lvl, target: "fighter", isPrimary: true },
        { key: "exp", label: STR.ocrFields.exp, target: "fighter", isPrimary: true },
        { key: "charname", label: STR.ocrFields.charname, target: "fighter", isPrimary: false },
        { key: "lauftext", label: STR.ocrFields.lauftext, target: "fighter", isPrimary: false },
        { key: "rmExp", label: STR.ocrFields.rmExp, target: "support", isPrimary: false },
        { key: "enemyName", label: STR.ocrFields.enemyName, target: "fighter", isPrimary: true },
        { key: "enemyHp", label: STR.ocrFields.enemyHp, target: "fighter", isPrimary: true },
      ];
      const defaultTimers = { lvl: 200, exp: 200, charname: 300, lauftext: 400, rmExp: 200, enemyName: 300, enemyHp: 200 };
      const ocrTargets = allFields.reduce((acc, item) => {
        acc[item.key] = item.target;
        return acc;
      }, {});

      const valueEls = {};
      const dots = {};
      const settingsBtns = {};

      const createRow = (field) => {
        const row = document.createElement("div");
        row.className = "ocrCompactRow";

        const label = document.createElement("div");
        label.className = "ocrCompactLabel";
        label.textContent = field.label;

        const value = document.createElement("div");
        value.className = "ocrCompactValue";
        value.textContent = "-";
        valueEls[field.key] = value;

        const dot = document.createElement("div");
        dot.className = "ocrStatusDot";
        dots[field.key] = dot;

        const btn = document.createElement("button");
        btn.className = "ocrSettingsBtn";
        btn.innerHTML = "\u2699";
        btn.title = STR.timerLabel.replace(":", "") + " / ROI";
        btn.disabled = true;
        settingsBtns[field.key] = btn;

        row.append(label, value, dot, btn);
        return row;
      };

      const lvlRow = createRow(allFields.find(f => f.key === "lvl"));
      const expRow = createRow(allFields.find(f => f.key === "exp"));
      const enemyRow = createRow(allFields.find(f => f.key === "enemyName"));
      const enemyHpRow = createRow(allFields.find(f => f.key === "enemyHp"));

      primaryList.append(lvlRow, expRow, enemyRow, enemyHpRow);

      const footer = document.createElement("div");
      footer.className = "ocrFooter";
      const footerText = document.createElement("div");
      footerText.className = "ocrFooterText";
      footerText.textContent = "-";
      const footerStatus = document.createElement("div");
      footerStatus.className = "ocrFooterStatus";
      const statusIcon = document.createElement("span");
      statusIcon.textContent = "\u2713";
      const statusText = document.createElement("span");
      statusText.textContent = "OK";
      footerStatus.append(statusIcon, statusText);
      footer.append(footerText, footerStatus);
      primaryList.append(footer);

      const settingsOverlay = document.createElement("div");
      settingsOverlay.className = "settingsOverlay";

      const settingsModal = document.createElement("div");
      settingsModal.className = "settingsModal";

      const modalHeader = document.createElement("div");
      modalHeader.className = "settingsModalHeader";
      const modalTitle = document.createElement("div");
      modalTitle.className = "settingsModalTitle";
      modalTitle.textContent = "";
      const modalClose = document.createElement("button");
      modalClose.className = "settingsModalClose";
      modalClose.textContent = "\u00D7";
      modalHeader.append(modalTitle, modalClose);
      settingsModal.append(modalHeader);

      const modalBody = document.createElement("div");
      modalBody.className = "settingsModalBody";

      const timerSection = document.createElement("div");
      timerSection.className = "settingsSection";
      const timerSectionTitle = document.createElement("div");
      timerSectionTitle.className = "settingsSectionTitle";
      timerSectionTitle.textContent = STR.timerLabel.replace(":", "");
      const timerRow = document.createElement("div");
      timerRow.className = "settingsRow";
      const timerInput = document.createElement("input");
      timerInput.type = "number";
      timerInput.min = "0";
      timerInput.max = "60000";
      timerInput.step = "100";
      timerInput.value = "0";
      const timerUnit = document.createElement("span");
      timerUnit.style.fontSize = "11px";
      timerUnit.style.color = "var(--muted)";
      timerUnit.textContent = STR.timerUnit;
      const timerActiveLabel = document.createElement("label");
      const timerActiveCheck = document.createElement("input");
      timerActiveCheck.type = "checkbox";
      timerActiveLabel.append(timerActiveCheck, document.createTextNode(" " + STR.active));
      timerRow.append(timerInput, timerUnit, timerActiveLabel);
      timerSection.append(timerSectionTitle, timerRow);

      const roiSection = document.createElement("div");
      roiSection.className = "settingsSection";
      const roiSectionTitle = document.createElement("div");
      roiSectionTitle.className = "settingsSectionTitle";
      roiSectionTitle.textContent = "ROI";
      const roiRow = document.createElement("div");
      roiRow.className = "settingsRow";
      const roiSetBtn = document.createElement("button");
      roiSetBtn.className = "btn";
      roiSetBtn.textContent = STR.roi.set;
      const roiShowLabel = document.createElement("label");
      const roiShowCheck = document.createElement("input");
      roiShowCheck.type = "checkbox";
      roiShowLabel.append(roiShowCheck, document.createTextNode(" " + STR.roi.show));
      roiRow.append(roiSetBtn, roiShowLabel);
      roiSection.append(roiSectionTitle, roiRow);

      const roiManualSection = document.createElement("div");
      roiManualSection.className = "settingsSection";
      const roiManualTitle = document.createElement("div");
      roiManualTitle.className = "settingsSectionTitle";
      roiManualTitle.textContent = STR.roi.manualTitle;
      const sliderGroup = document.createElement("div");
      sliderGroup.className = "settingsSliderGroup";
      const sliders = {};
      ["x", "y", "w", "h"].forEach(axis => {
        const row = document.createElement("div");
        row.className = "settingsSliderRow";
        const label = document.createElement("span");
        label.textContent = axis.toUpperCase();
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "1";
        slider.step = "0.001";
        slider.value = "0";
        const display = document.createElement("span");
        display.textContent = "0.000";
        row.append(label, slider, display);
        sliderGroup.append(row);
        sliders[axis] = { slider, display };
        slider.addEventListener("input", () => {
          display.textContent = slider.valueAsNumber.toFixed(3);
        });
      });
      roiManualSection.append(roiManualTitle, sliderGroup);

      const hintDiv = document.createElement("div");
      hintDiv.className = "settingsHint";
      hintDiv.textContent = STR.timerHint;

      const manualSection = document.createElement("div");
      manualSection.className = "settingsSection";
      const manualSectionTitle = document.createElement("div");
      manualSectionTitle.className = "settingsSectionTitle";
      manualSectionTitle.textContent = STR.manual;
      const manualRow = document.createElement("div");
      manualRow.className = "settingsRow";
      const manualInput = document.createElement("input");
      manualInput.type = "number";
      manualInput.min = "0";
      manualInput.max = "999999";
      manualInput.step = "1";
      manualInput.placeholder = "";
      manualInput.style.width = "90px";
      const manualActiveLabel = document.createElement("label");
      const manualActiveCheck = document.createElement("input");
      manualActiveCheck.type = "checkbox";
      manualActiveLabel.append(manualActiveCheck, document.createTextNode(" " + STR.active));
      const manualSetBtn = document.createElement("button");
      manualSetBtn.className = "btn";
      manualSetBtn.textContent = STR.manualSet;
      manualRow.append(manualInput, manualActiveLabel, manualSetBtn);
      manualSection.append(manualSectionTitle, manualRow);

      modalBody.append(manualSection, timerSection, roiSection, roiManualSection, hintDiv);
      settingsModal.append(modalBody);
      settingsOverlay.append(settingsModal);

      sec.append(heading, primaryList, settingsOverlay);

      let currentProfileId = null;
      let currentSupportProfileId = null;
      let currentFieldKey = null;
      let currentTimers = {};
      let currentRoiData = { fighter: {}, support: {} };
      let currentVis = { fighter: {}, support: {} };

      const getProfileIdForKey = (key) => (ocrTargets[key] === "support" ? currentSupportProfileId : currentProfileId);
      const roisForKey = (key) => key === "rmExp" ? currentRoiData.support : currentRoiData.fighter;
      const visForKey = (key) => key === "rmExp" ? currentVis.support : currentVis.fighter;

      const openSettings = async (key) => {
        const field = allFields.find(f => f.key === key);
        if (!field) return;
        currentFieldKey = key;
        const profileId = getProfileIdForKey(key);
        if (!profileId) return;

        modalTitle.textContent = field.label + " " + STR.timerLabel.replace(":", "").toLowerCase();

        const timerVal = currentTimers[key] ?? defaultTimers[key] ?? 0;
        timerInput.value = String(timerVal);
        timerActiveCheck.checked = timerVal > 0;
        timerInput.disabled = timerVal === 0;

        const rois = roisForKey(key);
        const roi = rois?.[key];
        const hasRoi = !!roi;

        if (hasRoi) {
          sliders.x.slider.value = String(roi.x ?? 0.05);
          sliders.y.slider.value = String(roi.y ?? 0.05);
          sliders.w.slider.value = String(roi.width ?? roi.w ?? 0.25);
          sliders.h.slider.value = String(roi.height ?? roi.h ?? 0.08);
        } else {
          sliders.x.slider.value = "0.05";
          sliders.y.slider.value = "0.05";
          sliders.w.slider.value = "0.25";
          sliders.h.slider.value = "0.08";
        }
        Object.values(sliders).forEach(({ slider, display }) => {
          display.textContent = slider.valueAsNumber.toFixed(3);
        });

        const vis = visForKey(key);
        roiShowCheck.checked = !!(vis && vis[key]);
        roiShowCheck.disabled = !hasRoi;

        if (key === "lvl") {
          manualSection.style.display = "";
          manualActiveLabel.style.display = "";
          manualInput.placeholder = STR.manualLevelPlaceholder;
          manualInput.max = "200";
          const manualEntry = await invokeMain("ocr:manualLevel:get", profileId).catch(() => null);
          manualInput.value = manualEntry?.value != null ? String(manualEntry.value) : "";
          manualActiveCheck.checked = !!manualEntry?.enabled;
          if (manualEntry?.enabled) {
            timerActiveCheck.checked = false;
            timerInput.disabled = true;
          }
        } else if (key === "exp") {
          manualSection.style.display = "";
          manualActiveLabel.style.display = "none";
          manualInput.placeholder = STR.manualExpPlaceholder;
          manualInput.max = "100";
          manualInput.value = "";
        } else {
          manualSection.style.display = "none";
        }

        settingsOverlay.classList.add("open");
      };

      const closeSettings = () => {
        settingsOverlay.classList.remove("open");
        currentFieldKey = null;
      };

      manualSection.style.display = "none";

      manualSetBtn.addEventListener("click", async () => {
        if (!currentFieldKey) return;
        const profileId = getProfileIdForKey(currentFieldKey);
        if (!profileId) return;
        const val = parseFloat(manualInput.value);
        if (Number.isNaN(val)) return;
        if (currentFieldKey === "lvl") {
          await invokeMain("ocr:manualLevel:set", { profileId, value: Math.round(val), enabled: manualActiveCheck.checked }).catch(() => {});
        } else if (currentFieldKey === "exp") {
          await invokeMain("ocr:manualExp:set", { profileId, value: val }).catch(() => {});
        }
      });

      manualActiveCheck.addEventListener("change", async () => {
        if (currentFieldKey !== "lvl") return;
        const profileId = getProfileIdForKey(currentFieldKey);
        if (!profileId) return;
        await invokeMain("ocr:manualLevel:set", { profileId, enabled: manualActiveCheck.checked }).catch(() => {});
        if (manualActiveCheck.checked) {
          timerActiveCheck.checked = false;
          timerInput.disabled = true;
          timerInput.value = "0";
          currentTimers[currentFieldKey] = 0;
          await invokeMain("ocr:setTimer", { profileId, key: currentFieldKey, ms: 0 }).catch(() => {});
        }
      });

      modalClose.addEventListener("click", closeSettings);
      settingsOverlay.addEventListener("click", (e) => {
        if (e.target === settingsOverlay) closeSettings();
      });

      Object.entries(settingsBtns).forEach(([key, btn]) => {
        btn.addEventListener("click", () => openSettings(key));
      });

      timerInput.addEventListener("change", async () => {
        if (!currentFieldKey) return;
        const profileId = getProfileIdForKey(currentFieldKey);
        if (!profileId) return;
        const ms = parseInt(timerInput.value, 10) || 0;
        timerActiveCheck.checked = ms > 0;
        timerInput.disabled = ms === 0;
        currentTimers[currentFieldKey] = ms;
        await invokeMain("ocr:setTimer", { profileId, key: currentFieldKey, ms });
      });

      timerActiveCheck.addEventListener("change", async () => {
        if (!currentFieldKey) return;
        const profileId = getProfileIdForKey(currentFieldKey);
        if (!profileId) return;
        if (!timerActiveCheck.checked) {
          timerInput.disabled = true;
          timerInput.value = "0";
          currentTimers[currentFieldKey] = 0;
          await invokeMain("ocr:setTimer", { profileId, key: currentFieldKey, ms: 0 });
        } else {
          timerInput.disabled = false;
          const fallback = defaultTimers[currentFieldKey] ?? 200;
          timerInput.value = String(fallback);
          currentTimers[currentFieldKey] = fallback;
          await invokeMain("ocr:setTimer", { profileId, key: currentFieldKey, ms: fallback });
          if (currentFieldKey === "lvl" && manualActiveCheck.checked) {
            manualActiveCheck.checked = false;
            await invokeMain("ocr:manualLevel:set", { profileId, enabled: false }).catch(() => {});
          }
        }
      });

      roiSetBtn.addEventListener("click", async () => {
        if (!currentFieldKey) return;
        const key = currentFieldKey;
        closeSettings();
        await openRoiCalibratorFor(key);
      });

      roiShowCheck.addEventListener("change", async () => {
        if (!currentFieldKey) return;
        const profileId = getProfileIdForKey(currentFieldKey);
        if (!profileId) return;
        const vis = visForKey(currentFieldKey);
        vis[currentFieldKey] = roiShowCheck.checked;
        await setRoiVisibility(profileId, currentFieldKey, roiShowCheck.checked);
      });

      const applyRoiFromSliders = async () => {
        if (!currentFieldKey) return false;
        const profileId = getProfileIdForKey(currentFieldKey);
        if (!profileId) return false;

        const payload = {
          x: Math.max(0, Math.min(1, sliders.x.slider.valueAsNumber)),
          y: Math.max(0, Math.min(1, sliders.y.slider.valueAsNumber)),
          width: Math.max(0.001, Math.min(1, sliders.w.slider.valueAsNumber)),
          height: Math.max(0.001, Math.min(1, sliders.h.slider.valueAsNumber)),
        };

        const rois = roisForKey(currentFieldKey) || {};
        const updated = { ...rois, [currentFieldKey]: payload };

        try {
          await invokeMain("roi:save", { profileId, rois: updated });
          if (currentFieldKey === "rmExp") {
            currentRoiData.support = updated;
          } else {
            currentRoiData.fighter = updated;
          }
          roiShowCheck.disabled = false;
          return true;
        } catch (err) {
          console.error("[ROI] save failed", err);
          return false;
        }
      };

      Object.values(sliders).forEach(({ slider }) => {
        slider.addEventListener("change", () => {
          void applyRoiFromSliders();
        });
      });


      const loadTimers = async (profileId, target) => {
        if (!profileId) return;
        try {
          const timers = await invokeMain("ocr:getTimers", profileId);
          allFields.forEach(field => {
            if (ocrTargets[field.key] !== target) return;
            currentTimers[field.key] = timers && typeof timers[field.key] === "number" ? timers[field.key] : 0;
          });
        } catch (err) {
          console.error("Failed to load OCR timers", err);
        }
      };

      const loadRoiData = async () => {
        try {
          const fighterId = currentProfileId;
          const supportId = currentSupportProfileId;

          if (fighterId) {
            const [rois, vis] = await Promise.all([
              invokeMain("roi:load", fighterId),
              invokeMain("roi:visibility:get", fighterId),
            ]);
            currentRoiData.fighter = rois || {};
            currentVis.fighter = vis || {};
          } else {
            currentRoiData.fighter = {};
            currentVis.fighter = {};
          }

          if (supportId) {
            const [rois, vis] = await Promise.all([
              invokeMain("roi:load", supportId),
              invokeMain("roi:visibility:get", supportId),
            ]);
            currentRoiData.support = rois || {};
            currentVis.support = vis || {};
          } else {
            currentRoiData.support = {};
            currentVis.support = {};
          }
        } catch (err) {
          console.error("Failed to load ROI data", err);
        }
      };

      const STALE_THRESHOLD_MS = 1500;
      let ocrInterval = null;

      const refreshOcr = async () => {
        try {
          const profileId = await getActiveOverlayProfileId();
          const supportProfileId = await getSupportOverlayProfileId();

          const fighterChanged = profileId !== currentProfileId;
          const supportChanged = supportProfileId !== currentSupportProfileId;
          currentProfileId = profileId;
          currentSupportProfileId = supportProfileId;

          if (!profileId && !supportProfileId) {
            valueEls.lvl.textContent = "-";
            valueEls.exp.textContent = "-";
            valueEls.enemyName.textContent = "-";
            valueEls.enemyHp.textContent = "-";
            Object.values(dots).forEach(dot => dot.className = "ocrStatusDot inactive");
            Object.values(settingsBtns).forEach(btn => btn.disabled = true);
            footerText.textContent = STR.noTarget;
            footerStatus.className = "ocrFooterStatus warn";
            statusIcon.textContent = "\u26A0";
            statusText.textContent = STR.noTarget.split(" ")[0];
            return;
          }

          if (fighterChanged && profileId) await loadTimers(profileId, "fighter");
          if (supportChanged && supportProfileId) await loadTimers(supportProfileId, "support");
          if (fighterChanged || supportChanged) await loadRoiData();

          const dataFighter = profileId ? await invokeMain("ocr:getLatest", profileId) : null;
          const dataSupport = supportProfileId ? await invokeMain("ocr:getLatest", supportProfileId) : null;

          const now = Date.now();
          const updatedAtFighter = dataFighter?.updatedAt ?? 0;
          const updatedAtSupport = dataSupport?.updatedAt ?? 0;
          const isStaleFighter = updatedAtFighter > 0 && (now - updatedAtFighter) > STALE_THRESHOLD_MS;
          const isStaleSupport = updatedAtSupport > 0 && (now - updatedAtSupport) > STALE_THRESHOLD_MS;

          valueEls.lvl.textContent = formatVal(dataFighter?.lvl);
          valueEls.exp.textContent = formatVal(dataFighter?.exp);
          valueEls.enemyName.textContent = formatVal(dataFighter?.enemyName);
          valueEls.enemyHp.textContent = formatVal(dataFighter?.enemyHp);

          const fOk = !isStaleFighter;
          dots.lvl.className       = "ocrStatusDot " + (dataFighter?.lvl       && fOk ? "active" : "inactive");
          dots.exp.className       = "ocrStatusDot " + (dataFighter?.exp       && fOk ? "active" : "inactive");
          dots.enemyName.className = "ocrStatusDot " + (dataFighter?.enemyName && fOk ? "active" : "inactive");
          dots.enemyHp.className   = "ocrStatusDot " + (dataFighter?.enemyHp   && fOk ? "active" : "inactive");

          allFields.forEach(field => {
            const btn = settingsBtns[field.key];
            if (!btn) return;
            btn.disabled = !getProfileIdForKey(field.key);
          });

          const noteParts = [];
          if (profileId) noteParts.push(profileId + (isStaleFighter ? " " + STR.stale : ""));
          if (supportProfileId) noteParts.push(STR.supportLabel + ": " + supportProfileId + (isStaleSupport ? " " + STR.stale : ""));
          footerText.textContent = noteParts.join(" | ") || STR.noTarget;

          if (isStaleFighter || isStaleSupport) {
            footerStatus.className = "ocrFooterStatus warn";
            statusIcon.textContent = "\u26A0";
            statusText.textContent = STR.stale.replace(/[()]/g, "");
          } else {
            footerStatus.className = "ocrFooterStatus ok";
            statusIcon.textContent = "\u2713";
            statusText.textContent = "OK";
          }
        } catch (err) {
          footerText.textContent = STR.unavailable;
          footerStatus.className = "ocrFooterStatus error";
          statusIcon.textContent = "\u2717";
          statusText.textContent = "Error";
        }
      };

      ocrInterval = setInterval(refreshOcr, 250);
      refreshOcr();

      const cleanup = () => {
        if (ocrInterval) clearInterval(ocrInterval);
      };

      return { section: sec, cleanup };
    };

    const ocrSection = buildOcrSection();
    if (ocrSection?.section) {
      content.append(ocrSection.section);
    }
    if (ocrSection?.cleanup) {
      cleanups.push(ocrSection.cleanup);
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

  // Cleanup old tab when rendering new
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

      // Pre-fetch overlay target ID so it's available when the plugin script runs.
      // Setting it in the iframe "load" handler is too late because the plugin's
      // own init() fires on the same "load" event and misses the value.
      const overlayTargetId = await getActiveOverlayProfileId().catch(() => null);

      // Inline the plugin sidepanel HTML so we can inject the IPC bridge BEFORE plugin JS runs.
      const SCRIPT_CLOSE = "</scr" + "ipt>";
      const bridge = [
        "window.__pluginId = " + JSON.stringify(pluginId) + ";",
        "window.__pluginLocale = \\"" + locale + "\\";",
        "window.__overlayTargetId = " + JSON.stringify(overlayTargetId) + ";",
        "window.plugin = window.plugin || {};",
        "if (!window.plugin.ipc) {",
        "  var __ipcListeners = {};",
        "  window.plugin.ipc = {",
        "    invoke: function(channel) {",
        "      var a = Array.prototype.slice.call(arguments, 1);",
        "      return parent.invokePluginChannel(" + JSON.stringify(pluginId) + ", channel, ...a);",
        "    },",
        "    on: function(channel, cb) {",
        "      if (!__ipcListeners[channel]) __ipcListeners[channel] = [];",
        "      __ipcListeners[channel].push(cb);",
        "      try { parent.postMessage({ type: 'plugin:subscribe', pluginId: " + JSON.stringify(pluginId) + ", channel: channel }, '*'); } catch(_e){}",
        "    },",
        "    off: function(channel, cb) {",
        "      if (!__ipcListeners[channel]) return;",
        "      __ipcListeners[channel] = __ipcListeners[channel].filter(function(f){ return f !== cb; });",
        "    }",
        "  };",
        "  window.addEventListener('message', function(e) {",
        "    if (e.data && e.data.type === 'plugin:broadcast' && e.data.channel) {",
        "      var cbs = __ipcListeners[e.data.channel];",
        "      if (cbs) { for (var i = 0; i < cbs.length; i++) { try { cbs[i](e.data.payload); } catch(err) { console.error('[plugin:bridge]', err); } } }",
        "    }",
        "  });",
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

      iframe.addEventListener("load", () => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (doc) applyThemeToPluginDocument(doc);
          // __overlayTargetId is already injected via bridge script above
          if (doc?.documentElement) doc.documentElement.lang = locale;
        } catch (err) {
          console.error("[HudPanel] Failed to init plugin frame", err);
        }
      });

      content.appendChild(iframe);

      content._cleanup = () => {
        pluginFrames.delete(pluginId);
        // Remove broadcast subscriptions for this plugin
        var ipc = getIpc();
        var prefix = pluginId + ":";
        for (var [key, handler] of pluginBroadcastSubs) {
          if (key.startsWith(prefix)) {
            if (ipc && ipc.removeListener) ipc.removeListener(key, handler);
            pluginBroadcastSubs.delete(key);
          }
        }
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

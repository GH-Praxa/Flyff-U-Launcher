import { BrowserWindow } from "electron";
import { translate, DEFAULT_LOCALE, type TranslationKey } from "../../i18n/translations";
import { SUPPORTED_LOCALES, type Locale } from "../../shared/schemas";

let instance: BrowserWindow | null = null;

function normalizeLocale(locale?: Locale): Locale {
    return (locale && SUPPORTED_LOCALES.includes(locale)) ? locale : DEFAULT_LOCALE;
}

function buildLogsStrings(locale: Locale) {
    const t = (key: TranslationKey) => translate(locale, key);
    return {
        windowTitle: t("sidePanel.logs.title"),
        logsTitle: t("sidePanel.logs.title"),
        logsClear: t("sidePanel.logs.clear"),
        logsSave: t("sidePanel.logs.save"),
        logsEmpty: t("sidePanel.logs.empty"),
        logsSendDiscord: t("sidePanel.logs.sendDiscord"),
        logsSendDiscordCooldown: t("sidePanel.logs.sendDiscordCooldown"),
        logsReportTitle: t("sidePanel.logs.reportTitle"),
        logsReportWhenHint: t("sidePanel.logs.reportWhenHint"),
        logsReportName: t("sidePanel.logs.reportName"),
        logsReportSend: t("sidePanel.logs.reportSend"),
        logsReportCancel: t("sidePanel.logs.reportCancel"),
        logsSendError: t("sidePanel.logs.sendError"),
    };
}

export function openLogsWindow(opts: { preloadPath: string; locale?: Locale }): BrowserWindow {
    if (instance && !instance.isDestroyed()) {
        if (instance.isMinimized()) instance.restore();
        instance.focus();
        return instance;
    }

    const locale = normalizeLocale(opts.locale);
    const strings = buildLogsStrings(locale);
    const stringsJson = JSON.stringify(strings);
    const HTML_SCRIPT_CLOSE = "</scr" + "ipt>";

    const win = new BrowserWindow({
        width: 760,
        height: 600,
        minWidth: 420,
        minHeight: 380,
        backgroundColor: "#0b1220",
        title: strings.windowTitle,
        webPreferences: {
            preload: opts.preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false,
        },
    });

    instance = win;
    win.on("closed", () => { instance = null; });
    win.setMenu(null);

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
  :root{
    --bg: #0b1220;
    --panel: #0f1a33;
    --panel2: #0d1830;
    --stroke: #1b2b4d;
    --text: #e6eefc;
    --danger: #ff3b4f;
    --accent: #2ecc71;
    --accent-rgb: 46,204,113;
    --danger-rgb: 255,59,79;
    --tab-active-rgb: 46,204,113;
    --scrollbar-size: 10px;
    --scroll-track: rgba(255,255,255,0.05);
    --scroll-track-border: rgba(255,255,255,0.08);
    --scroll-thumb-border: rgba(var(--accent-rgb),0.55);
    --scroll-thumb-top: rgba(var(--accent-rgb),0.42);
    --scroll-thumb-bottom: rgba(var(--accent-rgb),0.22);
    --scroll-thumb-top-hover: rgba(var(--accent-rgb),0.58);
    --scroll-thumb-bottom-hover: rgba(var(--accent-rgb),0.30);
  }
  *,*::before,*::after{
    box-sizing:border-box;
    scrollbar-width:thin !important;
    scrollbar-color:var(--scroll-thumb-border) var(--scroll-track) !important;
  }
  *::-webkit-scrollbar{ width:var(--scrollbar-size) !important; height:var(--scrollbar-size) !important; }
  *::-webkit-scrollbar-track{ background:var(--scroll-track) !important; border-radius:999px; border:1px solid var(--scroll-track-border) !important; }
  *::-webkit-scrollbar-thumb{ background:linear-gradient(180deg,var(--scroll-thumb-top),var(--scroll-thumb-bottom)) !important; border-radius:999px; border:1px solid var(--scroll-thumb-border) !important; }
  *::-webkit-scrollbar-thumb:hover{ background:linear-gradient(180deg,var(--scroll-thumb-top-hover),var(--scroll-thumb-bottom-hover)) !important; }
  *::-webkit-scrollbar-corner{ background:transparent !important; }
  html,body{
    margin:0; padding:0; width:100%; height:100%;
    background: linear-gradient(160deg, var(--panel) 0%, var(--bg) 100%);
    color: var(--text);
    font-family: Segoe UI, Arial, sans-serif;
    overflow: hidden;
  }
  #root{
    display:flex; flex-direction:column; height:100%; padding:12px; gap:10px;
  }
  #toolbar{
    display:flex; align-items:center; gap:8px; flex-shrink:0;
  }
  #title{
    font-size:13px; font-weight:600; color:var(--text); flex:1;
  }
  button.action{
    border:1px solid var(--stroke);
    background:rgba(255,255,255,0.04);
    color:var(--text);
    border-radius:8px;
    padding:5px 12px;
    cursor:pointer;
    font-size:11px;
    transition:120ms ease;
    font-family:inherit;
  }
  button.action:hover{ border-color:rgba(var(--accent-rgb),0.65); background:rgba(var(--accent-rgb),0.10); }
  button.action.danger{ background:rgba(var(--danger-rgb),0.12); }
  button.action.danger:hover{ border-color:rgba(var(--danger-rgb),0.65); }
  button.action.discord{ background:rgba(88,101,242,0.12); }
  button.action.discord:hover{ border-color:rgba(88,101,242,0.65); }
  button.action:disabled{ opacity:0.4; cursor:not-allowed; }
  #logContainer{
    flex:0 1 45%; min-height:80px; overflow:auto;
    font-family:'Cascadia Mono','Fira Code','Consolas',monospace;
    font-size:11px; line-height:1.6;
    padding:8px 10px;
    border:1px solid var(--stroke);
    border-radius:10px;
    background:rgba(0,0,0,0.28);
    white-space:pre-wrap; word-break:break-all;
  }
  .logLine{ color:rgba(var(--danger-rgb),0.9); }
  .hint{ color:rgba(255,255,255,0.35); font-size:12px; padding:8px 0; }

  /* ── Report form (always visible below logs) ── */
  #reportSection{
    flex:0 0 auto;
    border:1px solid var(--stroke);
    border-radius:10px;
    background:rgba(0,0,0,0.18);
    padding:12px 14px;
    display:flex; flex-direction:column; gap:10px;
  }
  #reportSection h3{
    margin:0; font-size:13px; font-weight:600; color:var(--text);
  }
  #reportSection label{
    display:flex; flex-direction:column; gap:3px;
    font-size:11px; color:rgba(230,238,252,0.6);
  }
  #reportSection textarea,
  #reportSection input[type=text]{
    resize:vertical;
    background:rgba(0,0,0,0.25);
    border:1px solid var(--stroke);
    border-radius:8px;
    color:var(--text);
    font-size:12px;
    padding:6px 8px;
    font-family:inherit;
  }
  #reportSection textarea{ min-height:48px; max-height:120px; }
  #reportSection .reportBtnRow{
    display:flex; gap:8px; justify-content:flex-end;
  }
</style>
</head>
<body>
<div id="root">
  <div id="toolbar">
    <div id="title"></div>
    <button class="action danger" id="clearBtn"></button>
    <button class="action" id="saveBtn"></button>
  </div>
  <div id="logContainer"></div>

  <div id="reportSection">
    <h3 id="reportTitle"></h3>
    <label id="whenLabel"><textarea id="whenArea" rows="2" maxlength="1500"></textarea></label>
    <label id="nameLabel"><input type="text" id="nameInput" maxlength="100" /></label>
    <div class="reportBtnRow">
      <button class="action discord" id="sendBtn" disabled></button>
    </div>
  </div>
</div>

<script>
  var STR = ${stringsJson};

  // ── Theme handling ───────────────────────────────────────────────────────────
  function hexToRgb(h) {
    var m = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec((h||'').trim());
    if (!m) return null;
    return [parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)].join(',');
  }
  function applyTheme(colors) {
    var s = document.documentElement.style;
    var c = Object.assign({bg:'#0b1220',panel:'#0f1a33',panel2:'#0d1830',stroke:'#1b2b4d',
      text:'#e6eefc',danger:'#ff3b4f',accent:'#2ecc71',tabActive:'#2ecc71'}, colors||{});
    if (!c.accent) c.accent = c.tabActive || c.blue || '#2ecc71';
    Object.entries(c).forEach(function(kv) { if (kv[1]) s.setProperty('--'+kv[0], kv[1]); });
    var ar = hexToRgb(c.accent)||hexToRgb(c.tabActive);
    if (ar) { s.setProperty('--accent-rgb', ar); s.setProperty('--tab-active-rgb', ar); }
    var dr = hexToRgb(c.danger);
    if (dr) s.setProperty('--danger-rgb', dr);
  }
  (function() {
    try {
      if (window.api && window.api.themeCurrent) {
        window.api.themeCurrent().then(function(snap) {
          var col = snap && snap.colors ? snap.colors : (snap && snap.builtin && snap.builtin.tabActive ? {tabActive:snap.builtin.tabActive} : null);
          if (col) applyTheme(col);
        });
      }
      if (window.ipc && window.ipc.on) {
        window.ipc.on('theme:update', function(p) {
          if (p && p.colors) applyTheme(p.colors);
          else if (p && p.builtin && p.builtin.tabActive) applyTheme({tabActive:p.builtin.tabActive});
        });
      }
    } catch(e) { /* ignore */ }
  })();

  // ── Strings ──────────────────────────────────────────────────────────────────
  document.getElementById('title').textContent = STR.logsTitle;
  document.getElementById('clearBtn').textContent = STR.logsClear;
  document.getElementById('saveBtn').textContent = STR.logsSave;
  document.getElementById('reportTitle').textContent = STR.logsReportTitle;
  document.getElementById('whenArea').placeholder = STR.logsReportWhenHint;
  document.getElementById('nameInput').placeholder = STR.logsReportName;
  document.getElementById('sendBtn').textContent = STR.logsSendDiscord;

  // ── Sanitize: strip anything that could be interpreted as markup/code ───────
  function sanitizeText(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/[<>&"']/g, '').trim();
  }

  // ── Log state ──────────────────────────────────────────────────────────────
  var entries = [];
  var logContainer = document.getElementById('logContainer');

  function pad2(n) { return String(n).padStart(2,'0'); }
  function formatEntry(e) {
    var d = new Date(e.ts);
    var t = pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds());
    return '['+t+'] ['+e.level.toUpperCase()+'] ['+e.module+'] '+e.message;
  }

  function renderEntries(stick) {
    var near = stick || (logContainer.scrollHeight - logContainer.scrollTop - logContainer.clientHeight < 40);
    logContainer.innerHTML = '';
    if (!entries.length) {
      var hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = STR.logsEmpty;
      logContainer.appendChild(hint);
      return;
    }
    var frag = document.createDocumentFragment();
    for (var i = 0; i < entries.length; i++) {
      var line = document.createElement('div');
      line.className = 'logLine';
      line.textContent = formatEntry(entries[i]);
      frag.appendChild(line);
    }
    logContainer.appendChild(frag);
    if (near) logContainer.scrollTop = logContainer.scrollHeight;
  }

  // ── Init: fetch existing entries ─────────────────────────────────────────────
  (function() {
    try {
      window.api.logsGet().then(function(data) {
        entries = Array.isArray(data) ? data.filter(function(e) { return e && e.level === 'error'; }) : [];
        renderEntries(true);
      });
    } catch(e) { renderEntries(true); }
  })();

  // ── Live updates ─────────────────────────────────────────────────────────────
  if (window.api && window.api.onLogsNew) {
    window.api.onLogsNew(function(entry) {
      if (!entry || entry.level !== 'error') return;
      entries.push(entry);
      if (entries.length > 500) entries.splice(0, entries.length - 500);
      renderEntries(false);
    });
  }

  // ── Clear button ─────────────────────────────────────────────────────────────
  document.getElementById('clearBtn').onclick = function() {
    try {
      window.api.logsClear().then(function() {
        entries = [];
        renderEntries(true);
      });
    } catch(e) { console.error('[LogsWindow] clear failed', e); }
  };

  // ── Save button ──────────────────────────────────────────────────────────────
  var saveBtn = document.getElementById('saveBtn');
  saveBtn.onclick = function() {
    try {
      window.api.logsSave().then(function(path) {
        saveBtn.textContent = path ? 'OK' : STR.logsSave;
        setTimeout(function() { saveBtn.textContent = STR.logsSave; }, 2000);
      });
    } catch(e) { console.error('[LogsWindow] save failed', e); }
  };

  // ── Send button with cooldown ────────────────────────────────────────────────
  var sendBtn = document.getElementById('sendBtn');
  var cooldownTimer = null;

  // Log reporting is independent of telemetry — always enabled
  sendBtn.disabled = false;

  function startCooldown(ms) {
    sendBtn.disabled = true;
    var end = Date.now() + ms;
    function tick() {
      var left = Math.ceil((end - Date.now()) / 1000);
      if (left <= 0) {
        sendBtn.textContent = STR.logsSendDiscord;
        sendBtn.disabled = false;
        if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
        return;
      }
      sendBtn.textContent = STR.logsSendDiscordCooldown.replace('{s}', String(left));
    }
    tick();
    cooldownTimer = setInterval(tick, 500);
  }

  sendBtn.onclick = function() {
    if (sendBtn.disabled) return;
    var note = sanitizeText(document.getElementById('whenArea').value).substring(0, 1500);
    var name = sanitizeText(document.getElementById('nameInput').value).substring(0, 100);
    sendBtn.disabled = true;
    window.api.logsSendToDiscord(note || null, name || null).then(function(result) {
      if (result && result.cooldownMs) {
        startCooldown(result.cooldownMs);
      } else if (result && result.sent) {
        sendBtn.textContent = 'OK';
        startCooldown(60000);
        document.getElementById('whenArea').value = '';
        document.getElementById('nameInput').value = '';
      } else {
        sendBtn.textContent = STR.logsSendError;
        sendBtn.disabled = false;
        setTimeout(function() { sendBtn.textContent = STR.logsSendDiscord; }, 3000);
      }
    }).catch(function(e) {
      console.error('[LogsWindow] sendToDiscord failed', e);
      sendBtn.textContent = STR.logsSendError;
      sendBtn.disabled = false;
      setTimeout(function() { sendBtn.textContent = STR.logsSendDiscord; }, 3000);
    });
  };

${HTML_SCRIPT_CLOSE}
</body>
</html>`;

    const encoded = Buffer.from(html).toString("base64");
    void win.loadURL(`data:text/html;base64,${encoded}`);

    return win;
}

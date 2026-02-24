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
        logsReportWhen: t("sidePanel.logs.reportWhen"),
        logsReportWhenHint: t("sidePanel.logs.reportWhenHint"),
        logsReportName: t("sidePanel.logs.reportName"),
        logsReportSend: t("sidePanel.logs.reportSend"),
        logsReportCancel: t("sidePanel.logs.reportCancel"),
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
        height: 520,
        minWidth: 420,
        minHeight: 280,
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
    flex:1; min-height:0; overflow:auto;
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
  /* Dialog overlay */
  #dialogOverlay{
    display:none; position:fixed; inset:0;
    background:rgba(0,0,0,0.6);
    align-items:center; justify-content:center; z-index:9999;
  }
  #dialogOverlay.show{ display:flex; }
  #dialog{
    background:var(--panel);
    border:1px solid var(--stroke);
    border-radius:14px; padding:20px; width:340px;
    display:flex; flex-direction:column; gap:12px;
    box-shadow:0 8px 32px rgba(0,0,0,0.5);
  }
  #dialog h3{ margin:0; font-size:14px; font-weight:600; }
  #dialog label{ display:flex; flex-direction:column; gap:4px; font-size:12px; color:rgba(230,238,252,0.6); }
  #dialog textarea,#dialog input[type=text]{
    resize:vertical; background:rgba(0,0,0,0.25);
    border:1px solid var(--stroke); border-radius:8px;
    color:var(--text); font-size:12px; padding:6px 8px;
    font-family:inherit;
  }
  #dialog .btnRow{ display:flex; gap:8px; justify-content:flex-end; margin-top:4px; }
</style>
</head>
<body>
<div id="root">
  <div id="toolbar">
    <div id="title"></div>
    <button class="action danger" id="clearBtn"></button>
    <button class="action" id="saveBtn"></button>
    <button class="action discord" id="discordBtn" disabled></button>
  </div>
  <div id="logContainer"></div>
</div>

<div id="dialogOverlay">
  <div id="dialog">
    <h3 id="dialogTitle"></h3>
    <label id="whenLabel"><textarea id="whenArea" rows="3"></textarea></label>
    <label id="nameLabel"><input type="text" id="nameInput" /></label>
    <div class="btnRow">
      <button class="action" id="cancelBtn"></button>
      <button class="action discord" id="sendBtn"></button>
    </div>
  </div>
</div>

<script>
  const STR = ${stringsJson};

  // ── Theme handling ───────────────────────────────────────────────────────────
  function hexToRgb(h) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((h||'').trim());
    if (!m) return null;
    return [parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)].join(',');
  }
  function applyTheme(colors) {
    const s = document.documentElement.style;
    const c = Object.assign({bg:'#0b1220',panel:'#0f1a33',panel2:'#0d1830',stroke:'#1b2b4d',
      text:'#e6eefc',danger:'#ff3b4f',accent:'#2ecc71',tabActive:'#2ecc71'}, colors||{});
    if (!c.accent) c.accent = c.tabActive || c.blue || '#2ecc71';
    Object.entries(c).forEach(([k,v]) => { if (v) s.setProperty('--'+k, v); });
    const ar = hexToRgb(c.accent)||hexToRgb(c.tabActive);
    if (ar) { s.setProperty('--accent-rgb', ar); s.setProperty('--tab-active-rgb', ar); }
    const dr = hexToRgb(c.danger);
    if (dr) s.setProperty('--danger-rgb', dr);
  }
  (async () => {
    try {
      if (window.api?.themeCurrent) {
        const snap = await window.api.themeCurrent();
        const col = snap?.colors || (snap?.builtin?.tabActive ? {tabActive:snap.builtin.tabActive} : null);
        if (col) applyTheme(col);
      }
      if (window.ipc?.on) {
        window.ipc.on('theme:update', (p) => {
          if (p?.colors) applyTheme(p.colors);
          else if (p?.builtin?.tabActive) applyTheme({tabActive:p.builtin.tabActive});
        });
      }
    } catch(e) { /* ignore */ }
  })();

  // ── Strings ──────────────────────────────────────────────────────────────────
  document.getElementById('title').textContent = STR.logsTitle;
  document.getElementById('clearBtn').textContent = STR.logsClear;
  document.getElementById('saveBtn').textContent = STR.logsSave;
  document.getElementById('discordBtn').textContent = STR.logsSendDiscord;
  document.getElementById('dialogTitle').textContent = STR.logsReportTitle;
  document.getElementById('whenLabel').childNodes[0].textContent = STR.logsReportWhen;
  document.getElementById('whenArea').placeholder = STR.logsReportWhenHint;
  document.getElementById('nameLabel').childNodes[0].textContent = STR.logsReportName;
  document.getElementById('cancelBtn').textContent = STR.logsReportCancel;
  document.getElementById('sendBtn').textContent = STR.logsReportSend;

  // ── Log state ────────────────────────────────────────────────────────────────
  let entries = [];
  const logContainer = document.getElementById('logContainer');

  function pad2(n) { return String(n).padStart(2,'0'); }
  function formatEntry(e) {
    const d = new Date(e.ts);
    const t = pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds());
    return '['+t+'] ['+e.level.toUpperCase()+'] ['+e.module+'] '+e.message;
  }

  function renderEntries(stick) {
    const near = stick || (logContainer.scrollHeight - logContainer.scrollTop - logContainer.clientHeight < 40);
    logContainer.innerHTML = '';
    if (!entries.length) {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = STR.logsEmpty;
      logContainer.appendChild(hint);
      return;
    }
    const frag = document.createDocumentFragment();
    for (const e of entries) {
      const line = document.createElement('div');
      line.className = 'logLine';
      line.textContent = formatEntry(e);
      frag.appendChild(line);
    }
    logContainer.appendChild(frag);
    if (near) logContainer.scrollTop = logContainer.scrollHeight;
  }

  // ── Init: fetch existing entries ─────────────────────────────────────────────
  (async () => {
    try {
      const data = await window.api.logsGet();
      entries = Array.isArray(data) ? data.filter(e => e && e.level === 'error') : [];
      renderEntries(true);
    } catch(e) { renderEntries(true); }
  })();

  // ── Live updates ─────────────────────────────────────────────────────────────
  if (window.api?.onLogsNew) {
    window.api.onLogsNew((entry) => {
      if (!entry || entry.level !== 'error') return;
      entries.push(entry);
      if (entries.length > 500) entries.splice(0, entries.length - 500);
      renderEntries(false);
    });
  }

  // ── Clear button ─────────────────────────────────────────────────────────────
  document.getElementById('clearBtn').onclick = async () => {
    try {
      await window.api.logsClear();
      entries = [];
      renderEntries(true);
    } catch(e) { console.error('[LogsWindow] clear failed', e); }
  };

  // ── Save button ──────────────────────────────────────────────────────────────
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.onclick = async () => {
    try {
      const path = await window.api.logsSave();
      saveBtn.textContent = path ? 'OK' : STR.logsSave;
      setTimeout(() => { saveBtn.textContent = STR.logsSave; }, 2000);
    } catch(e) { console.error('[LogsWindow] save failed', e); }
  };

  // ── Discord cooldown ─────────────────────────────────────────────────────────
  const discordBtn = document.getElementById('discordBtn');
  let cooldownTimer = null;
  function startCooldown(ms) {
    discordBtn.disabled = true;
    const end = Date.now() + ms;
    function tick() {
      const left = Math.ceil((end - Date.now()) / 1000);
      if (left <= 0) {
        discordBtn.textContent = STR.logsSendDiscord;
        discordBtn.disabled = false;
        if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
        return;
      }
      discordBtn.textContent = STR.logsSendDiscordCooldown.replace('{s}', String(left));
    }
    tick();
    cooldownTimer = setInterval(tick, 500);
  }

  // Enable discord button if telemetry is allowed
  (async () => {
    try {
      const s = await window.api.clientSettingsGet();
      if (s?.sendTelemetry) discordBtn.disabled = false;
    } catch(e) { /* ignore */ }
  })();

  // ── Discord dialog ───────────────────────────────────────────────────────────
  const overlay = document.getElementById('dialogOverlay');
  const whenArea = document.getElementById('whenArea');
  const nameInput = document.getElementById('nameInput');

  discordBtn.onclick = () => {
    if (discordBtn.disabled) return;
    overlay.classList.add('show');
    whenArea.value = '';
    nameInput.value = '';
    whenArea.focus();
  };
  document.getElementById('cancelBtn').onclick = () => overlay.classList.remove('show');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });
  document.getElementById('sendBtn').onclick = async () => {
    overlay.classList.remove('show');
    try {
      const result = await window.api.logsSendToDiscord(whenArea.value.trim()||null, nameInput.value.trim()||null);
      if (result?.cooldownMs) {
        startCooldown(result.cooldownMs);
      } else if (result?.sent) {
        discordBtn.textContent = 'OK';
        startCooldown(60_000);
      }
    } catch(e) { console.error('[LogsWindow] sendToDiscord failed', e); }
  };

${HTML_SCRIPT_CLOSE}
</body>
</html>`;

    const encoded = Buffer.from(html).toString("base64");
    void win.loadURL(`data:text/html;base64,${encoded}`);

    return win;
}

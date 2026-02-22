(function () {
  "use strict";

  // --------------------------------------------------------------------------
  // Localization
  // --------------------------------------------------------------------------
  function detectLocale() {
    try {
      const qs = new URLSearchParams(window.location.search || "");
      const fromQuery = qs.get("locale");
      const fromAttr = document.documentElement?.lang;
      const raw = (window.__pluginLocale || fromQuery || fromAttr || navigator.language || "en")
        .slice(0, 2)
        .toLowerCase();
      return raw === "zh" ? "cn" : raw === "ja" ? "jp" : raw;
    } catch (_e) {
      return "en";
    }
  }

  const locale = detectLocale();

  const translations = {
    en: {
      title: "API Fetch",
      start: "Start",
      cancel: "Cancel",
      openFolder: "Open output folder",
      all: "All",
      filter: "Filter...",
      status: "Status",
      errors: "Errors",
      log: "Log",
      endpoint: "Endpoint",
      statusCol: "Status",
      ready: "Ready",
      running: "Running",
      ok: "OK",
      error: "Error",
      cancelled: "Cancelled",
      done: "Done",
      idle: "Idle",
      rate: "{window}/{max} req/min",
      progress: "{done} / {total}",
    },
    de: {
      title: "API Fetch",
      start: "Start",
      cancel: "Abbrechen",
      openFolder: "Ausgabeordner öffnen",
      all: "Alle",
      filter: "Filter...",
      status: "Status",
      errors: "Fehler",
      log: "Log",
      endpoint: "Endpunkt",
      statusCol: "Status",
      ready: "Bereit",
      running: "Läuft",
      ok: "OK",
      error: "Fehler",
      cancelled: "Abgebrochen",
      done: "Fertig",
      idle: "Bereit",
      rate: "{window}/{max} Req/Min",
      progress: "{done} / {total}",
    },
    fr: {
      title: "API Fetch",
      start: "Démarrer",
      cancel: "Annuler",
      openFolder: "Ouvrir le dossier",
      all: "Tous",
      filter: "Filtrer...",
      status: "Statut",
      errors: "Erreurs",
      log: "Journal",
      endpoint: "Endpoint",
      statusCol: "Statut",
      ready: "Prêt",
      running: "En cours",
      ok: "OK",
      error: "Erreur",
      cancelled: "Annulé",
      done: "Terminé",
      idle: "Inactif",
      rate: "{window}/{max} req/min",
      progress: "{done} / {total}",
    },
    pl: {
      title: "API Fetch",
      start: "Start",
      cancel: "Anuluj",
      openFolder: "Otwórz folder",
      all: "Wszystko",
      filter: "Filtr...",
      status: "Status",
      errors: "Błędy",
      log: "Dziennik",
      endpoint: "Endpoint",
      statusCol: "Status",
      ready: "Gotowy",
      running: "W toku",
      ok: "OK",
      error: "Błąd",
      cancelled: "Anulowano",
      done: "Gotowe",
      idle: "Bezczynny",
      rate: "{window}/{max} req/min",
      progress: "{done} / {total}",
    },
    ru: {
      title: "API Fetch",
      start: "Старт",
      cancel: "Отмена",
      openFolder: "Открыть папку",
      all: "Все",
      filter: "Фильтр...",
      status: "Статус",
      errors: "Ошибки",
      log: "Журнал",
      endpoint: "Конечная точка",
      statusCol: "Статус",
      ready: "Готов",
      running: "Выполняется",
      ok: "OK",
      error: "Ошибка",
      cancelled: "Отменено",
      done: "Готово",
      idle: "Ожидание",
      rate: "{window}/{max} зап/мин",
      progress: "{done} / {total}",
    },
    tr: {
      title: "API Fetch",
      start: "Başlat",
      cancel: "İptal",
      openFolder: "Klasörü aç",
      all: "Tümü",
      filter: "Filtre...",
      status: "Durum",
      errors: "Hatalar",
      log: "Günlük",
      endpoint: "Endpoint",
      statusCol: "Durum",
      ready: "Hazır",
      running: "Çalışıyor",
      ok: "OK",
      error: "Hata",
      cancelled: "İptal edildi",
      done: "Tamamlandı",
      idle: "Boşta",
      rate: "{window}/{max} istek/dk",
      progress: "{done} / {total}",
    },
    cn: {
      title: "API Fetch",
      start: "开始",
      cancel: "取消",
      openFolder: "打开文件夹",
      all: "全部",
      filter: "筛选...",
      status: "状态",
      errors: "错误",
      log: "日志",
      endpoint: "端点",
      statusCol: "状态",
      ready: "就绪",
      running: "运行中",
      ok: "完成",
      error: "错误",
      cancelled: "已取消",
      done: "完成",
      idle: "空闲",
      rate: "{window}/{max} 请求/分",
      progress: "{done} / {total}",
    },
    jp: {
      title: "API Fetch",
      start: "開始",
      cancel: "キャンセル",
      openFolder: "フォルダを開く",
      all: "すべて",
      filter: "フィルター...",
      status: "ステータス",
      errors: "エラー",
      log: "ログ",
      endpoint: "エンドポイント",
      statusCol: "ステータス",
      ready: "準備完了",
      running: "実行中",
      ok: "完了",
      error: "エラー",
      cancelled: "キャンセル済み",
      done: "完了",
      idle: "待機中",
      rate: "{window}/{max} リクエスト/分",
      progress: "{done} / {total}",
    },
  };

  const L = translations[locale] || translations.en;
  const fmt = (s, params) =>
    (s || "").replace(/\{(\w+)\}/g, (_m, k) => (params && k in params ? String(params[k]) : ""));

  // --------------------------------------------------------------------------
  // DOM references
  // --------------------------------------------------------------------------
  const statusDot = document.getElementById("statusDot");
  const titleLabel = document.getElementById("titleLabel");
  const openFolderBtn = document.getElementById("openFolderBtn");
  const startBtn = document.getElementById("startBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  const rateInfo = document.getElementById("rateInfo");
  const filterInput = document.getElementById("filterInput");
  const selectAllCb = document.getElementById("selectAllCb");
  const selectAllLabel = document.getElementById("selectAllLabel");
  const endpointListEl = document.getElementById("endpointList");
  const statusSummary = document.getElementById("statusSummary");
  const statusBody = document.getElementById("statusBody");
  const thEndpoint = document.getElementById("thEndpoint");
  const thStatus = document.getElementById("thStatus");
  const errorsSummary = document.getElementById("errorsSummary");
  const errorBadge = document.getElementById("errorBadge");
  const errorList = document.getElementById("errorList");
  const logSummary = document.getElementById("logSummary");
  const logPre = document.getElementById("logPre");

  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------
  const state = {
    endpoints: [],
    selectedNames: new Set(),
    jobRunning: false,
  };
  let pollTimer = null;

  // --------------------------------------------------------------------------
  // IPC helper
  // --------------------------------------------------------------------------
  async function ipc(channel, ...args) {
    if (window.plugin?.ipc?.invoke) return window.plugin.ipc.invoke(channel, ...args);
    if (window.parent?.invokePluginChannel && window.__pluginId) {
      return window.parent.invokePluginChannel(window.__pluginId, channel, ...args);
    }
    throw new Error("IPC unavailable");
  }

  // --------------------------------------------------------------------------
  // Static translations
  // --------------------------------------------------------------------------
  function applyTranslations() {
    if (titleLabel) titleLabel.textContent = L.title;
    if (openFolderBtn) openFolderBtn.title = L.openFolder;
    if (startBtn) startBtn.textContent = L.start;
    if (cancelBtn) cancelBtn.textContent = L.cancel;
    if (filterInput) filterInput.placeholder = L.filter;
    if (selectAllLabel) selectAllLabel.textContent = L.all;
    if (statusSummary) statusSummary.textContent = L.status;
    if (errorsSummary) errorsSummary.textContent = L.errors;
    if (logSummary) logSummary.textContent = L.log;
    if (thEndpoint) thEndpoint.textContent = L.endpoint;
    if (thStatus) thStatus.textContent = L.statusCol;
  }

  // --------------------------------------------------------------------------
  // Load config & render endpoints
  // --------------------------------------------------------------------------
  async function loadConfig() {
    try {
      const config = await ipc("load:config");
      state.endpoints = config.endpoints || [];
      state.selectedNames.clear();
      state.endpoints.forEach((ep) => {
        if (ep.enabled) state.selectedNames.add(ep.name);
      });
      renderEndpoints();
    } catch (err) {
      console.error("[api-fetch] load:config failed", err);
    }
  }

  function renderEndpoints() {
    endpointListEl.innerHTML = "";
    const term = (filterInput?.value || "").trim().toLowerCase();

    state.endpoints.forEach((ep) => {
      const div = document.createElement("div");
      div.className = "endpoint-item";
      if (term && !ep.name.toLowerCase().includes(term)) {
        div.classList.add("hidden");
      }

      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = state.selectedNames.has(ep.name);
      cb.addEventListener("change", () => {
        if (cb.checked) {
          state.selectedNames.add(ep.name);
        } else {
          state.selectedNames.delete(ep.name);
        }
        syncSelectAll();
      });

      const nameSpan = document.createElement("span");
      nameSpan.className = "ep-name";
      nameSpan.textContent = ep.name;

      label.append(cb, nameSpan);
      div.appendChild(label);
      endpointListEl.appendChild(div);
    });

    syncSelectAll();
  }

  function syncSelectAll() {
    if (!selectAllCb) return;
    const visible = getVisibleEndpointNames();
    const allChecked = visible.length > 0 && visible.every((n) => state.selectedNames.has(n));
    selectAllCb.checked = allChecked;
  }

  function getVisibleEndpointNames() {
    const term = (filterInput?.value || "").trim().toLowerCase();
    return state.endpoints
      .filter((ep) => !term || ep.name.toLowerCase().includes(term))
      .map((ep) => ep.name);
  }

  // --------------------------------------------------------------------------
  // Start / Cancel
  // --------------------------------------------------------------------------
  async function startJob() {
    const selected = Array.from(state.selectedNames);
    if (!selected.length) return;

    try {
      await ipc("selection:set", selected);
      await ipc("job:start", { endpoints: selected });
      state.jobRunning = true;
      updateControls();
      startPolling();
    } catch (err) {
      console.error("[api-fetch] job:start failed", err);
    }
  }

  async function cancelJob() {
    try {
      await ipc("job:cancel");
    } catch (err) {
      console.error("[api-fetch] job:cancel failed", err);
    }
  }

  // --------------------------------------------------------------------------
  // Polling
  // --------------------------------------------------------------------------
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(pollStatus, 500);
    pollStatus();
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function pollStatus() {
    try {
      const s = await ipc("job:status");
      updateProgress(s);
      updateStatusTable(s.statuses || []);
      updateErrors(s.errors || []);
      updateLog(s.log || []);
      updateDot(s);

      if (!s.running && state.jobRunning) {
        state.jobRunning = false;
        updateControls();
        stopPolling();
      }
    } catch (err) {
      console.error("[api-fetch] job:status failed", err);
    }
  }

  // --------------------------------------------------------------------------
  // UI updates
  // --------------------------------------------------------------------------
  function updateControls() {
    if (startBtn) startBtn.disabled = state.jobRunning;
    if (cancelBtn) cancelBtn.disabled = !state.jobRunning;
  }

  function updateProgress(s) {
    const done = s.progress?.done || 0;
    const total = s.progress?.total || 0;
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

    if (progressFill) progressFill.style.width = pct + "%";
    if (progressText) progressText.textContent = fmt(L.progress, { done, total });

    if (rateInfo && s.requests) {
      rateInfo.textContent = fmt(L.rate, {
        window: s.requests.window || 0,
        max: s.requests.windowMax || 0,
      });
    }
  }

  function updateDot(s) {
    if (!statusDot) return;
    statusDot.className = "dot";
    if (s.running) {
      statusDot.classList.add("running");
    } else if (s.cancelled) {
      statusDot.classList.add("error");
    } else if (s.failures > 0 && !s.running) {
      statusDot.classList.add("done");
    } else if (s.successes > 0 && !s.running) {
      statusDot.classList.add("done");
    } else {
      statusDot.classList.add("idle");
    }
  }

  function statusLabel(raw) {
    const map = {
      "Bereit": L.ready,
      "Läuft": L.running,
      "OK": L.ok,
      "Fehler": L.error,
      "Abgebrochen": L.cancelled,
      "Fertig": L.done,
    };
    return map[raw] || raw;
  }

  function statusClass(raw) {
    switch (raw) {
      case "OK": return "st-ok";
      case "Läuft": return "st-running";
      case "Fehler": return "st-error";
      default: return "st-ready";
    }
  }

  function updateStatusTable(statuses) {
    if (!statusBody) return;
    statusBody.innerHTML = "";
    statuses.forEach((entry) => {
      const tr = document.createElement("tr");
      const tdName = document.createElement("td");
      tdName.textContent = entry.name;
      const tdStatus = document.createElement("td");
      tdStatus.textContent = statusLabel(entry.status);
      tdStatus.className = statusClass(entry.status);
      tr.append(tdName, tdStatus);
      statusBody.appendChild(tr);
    });
  }

  function updateErrors(errors) {
    if (errorBadge) {
      errorBadge.textContent = String(errors.length);
      errorBadge.className = errors.length > 0 ? "badge" : "badge zero";
    }
    if (!errorList) return;
    errorList.innerHTML = "";
    errors.forEach((msg) => {
      const li = document.createElement("li");
      li.textContent = msg;
      errorList.appendChild(li);
    });
  }

  function updateLog(lines) {
    if (!logPre) return;
    const wasAtBottom = logPre.scrollHeight - logPre.scrollTop - logPre.clientHeight < 30;
    logPre.textContent = lines.join("\n");
    if (wasAtBottom) {
      logPre.scrollTop = logPre.scrollHeight;
    }
  }

  // --------------------------------------------------------------------------
  // Events
  // --------------------------------------------------------------------------
  function attachEvents() {
    startBtn?.addEventListener("click", startJob);
    cancelBtn?.addEventListener("click", cancelJob);
    openFolderBtn?.addEventListener("click", () => {
      ipc("output:open").catch((err) => console.error("[api-fetch] output:open failed", err));
    });

    filterInput?.addEventListener("input", () => {
      const term = (filterInput.value || "").trim().toLowerCase();
      const items = endpointListEl.querySelectorAll(".endpoint-item");
      items.forEach((item) => {
        const name = item.querySelector(".ep-name")?.textContent?.toLowerCase() || "";
        item.classList.toggle("hidden", term !== "" && !name.includes(term));
      });
      syncSelectAll();
    });

    selectAllCb?.addEventListener("change", () => {
      const visible = getVisibleEndpointNames();
      const checked = selectAllCb.checked;
      visible.forEach((name) => {
        if (checked) {
          state.selectedNames.add(name);
        } else {
          state.selectedNames.delete(name);
        }
      });
      const items = endpointListEl.querySelectorAll(".endpoint-item");
      items.forEach((item) => {
        const name = item.querySelector(".ep-name")?.textContent || "";
        const cb = item.querySelector("input[type=checkbox]");
        if (cb && visible.includes(name)) {
          cb.checked = checked;
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // Init
  // --------------------------------------------------------------------------
  async function init() {
    applyTranslations();
    attachEvents();
    updateControls();
    await loadConfig();

    // Check if a job is already running
    try {
      const s = await ipc("job:status");
      if (s.running) {
        state.jobRunning = true;
        updateControls();
        startPolling();
      } else if (s.successes > 0 || s.failures > 0) {
        updateProgress(s);
        updateStatusTable(s.statuses || []);
        updateErrors(s.errors || []);
        updateLog(s.log || []);
        updateDot(s);
      }
    } catch (_) {
      // no previous job
    }
  }

  window.addEventListener("load", init);
})();

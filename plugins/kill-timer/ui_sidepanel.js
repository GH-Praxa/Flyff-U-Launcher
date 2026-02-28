(function () {
  "use strict";

  // ── Localization ────────────────────────────────────────────────────────────

  function detectLocale() {
    try {
      const qs = new URLSearchParams(window.location.search || "");
      const fromQuery = qs.get("locale");
      const fromAttr = document.documentElement?.lang;
      const raw = (window.__pluginLocale || fromQuery || fromAttr || navigator.language || "en")
        .slice(0, 2).toLowerCase();
      return raw === "zh" ? "cn" : raw === "ja" ? "jp" : raw === "pt" ? "en" : raw;
    } catch (_e) {
      return "en";
    }
  }

  const locale = detectLocale();

  const translations = {
    en: {
      title: "Kill Timer",
      enable: "Enable",
      overlayPos: "Overlay Position",
      posX: "X (%)",
      posY: "Y (%)",
      alertThreshold: "Alert Threshold",
      alertLabel: "Alert HP% \u2264",
      thresholdHint: "Widget flashes red when enemy HP reaches this level.",
      reset: "Reset Timer",
      timerHint: "Timer starts on first HP loss. Resets automatically on target change.",
    },
    de: {
      title: "Kill Timer",
      enable: "Aktiv",
      overlayPos: "Overlay-Position",
      posX: "X (%)",
      posY: "Y (%)",
      alertThreshold: "Alert-Schwellenwert",
      alertLabel: "Alert HP% \u2264",
      thresholdHint: "Widget blinkt rot, wenn Gegner-HP diesen Wert erreicht.",
      reset: "Timer zur\u00fccksetzen",
      timerHint: "Timer startet beim ersten HP-Verlust. Reset bei Zielwechsel.",
    },
    pl: {
      title: "Kill Timer",
      enable: "W\u0142\u0105cz",
      overlayPos: "Pozycja Overlay",
      posX: "X (%)",
      posY: "Y (%)",
      alertThreshold: "Pr\u00f3g Alertu",
      alertLabel: "Alert HP% \u2264",
      thresholdHint: "Widget mruga na czerwono, gdy HP wroga osi\u0105gnie ten poziom.",
      reset: "Resetuj Timer",
      timerHint: "Timer startuje przy pierwszej utracie HP. Reset przy zmianie celu.",
    },
    fr: {
      title: "Kill Timer",
      enable: "Activer",
      overlayPos: "Position Overlay",
      posX: "X (%)",
      posY: "Y (%)",
      alertThreshold: "Seuil d'Alerte",
      alertLabel: "Alerte HP% \u2264",
      thresholdHint: "Le widget clignote en rouge quand les PV de l'ennemi atteignent ce seuil.",
      reset: "R\u00e9initialiser",
      timerHint: "Le timer d\u00e9marre \u00e0 la premi\u00e8re perte de PV. Reset lors du changement de cible.",
    },
    ru: {
      title: "Kill Timer",
      enable: "\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c",
      overlayPos: "\u041f\u043e\u0437\u0438\u0446\u0438\u044f \u041e\u0432\u0435\u0440\u043b\u0435\u044f",
      posX: "X (%)",
      posY: "Y (%)",
      alertThreshold: "\u041f\u043e\u0440\u043e\u0433 \u0410\u043b\u0435\u0440\u0442\u0430",
      alertLabel: "\u0410\u043b\u0435\u0440\u0442 HP% \u2264",
      thresholdHint: "\u0412\u0438\u0434\u0436\u0435\u0442 \u043c\u0438\u0433\u0430\u0435\u0442 \u043a\u0440\u0430\u0441\u043d\u044b\u043c, \u043a\u043e\u0433\u0434\u0430 HP \u0432\u0440\u0430\u0433\u0430 \u0434\u043e\u0441\u0442\u0438\u0433\u0430\u0435\u0442 \u044d\u0442\u043e\u0433\u043e \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u044f.",
      reset: "\u0421\u0431\u0440\u043e\u0441 \u0422\u0430\u0439\u043c\u0435\u0440\u0430",
      timerHint: "\u0422\u0430\u0439\u043c\u0435\u0440 \u0441\u0442\u0430\u0440\u0442\u0443\u0435\u0442 \u043f\u0440\u0438 \u043f\u0435\u0440\u0432\u043e\u0439 \u043f\u043e\u0442\u0435\u0440\u0435 HP. \u0421\u0431\u0440\u0430\u0441\u044b\u0432\u0430\u0435\u0442\u0441\u044f \u043f\u0440\u0438 \u0441\u043c\u0435\u043d\u0435 \u0446\u0435\u043b\u0438.",
    },
    tr: {
      title: "Kill Timer",
      enable: "Etkinle\u015ftir",
      overlayPos: "Overlay Konumu",
      posX: "X (%)",
      posY: "Y (%)",
      alertThreshold: "Uyar\u0131 E\u015fi\u011fi",
      alertLabel: "Uyar\u0131 HP% \u2264",
      thresholdHint: "D\u00fc\u015fman HP bu de\u011fere ula\u015f\u0131nca widget k\u0131rm\u0131z\u0131 yan\u0131p s\u00f6ner.",
      reset: "Timer S\u0131f\u0131rla",
      timerHint: "Timer ilk HP kayb\u0131nda ba\u015flar. Hedef de\u011fi\u015fince otomatik s\u0131f\u0131rlan\u0131r.",
    },
    cn: {
      title: "Kill Timer",
      enable: "\u542f\u7528",
      overlayPos: "\u8986\u76d6\u5c42\u4f4d\u7f6e",
      posX: "X (%)",
      posY: "Y (%)",
      alertThreshold: "\u8b66\u544a\u9608\u503c",
      alertLabel: "\u8b66\u544a HP% \u2264",
      thresholdHint: "\u5f53\u654c\u4eba HP \u8fbe\u5230\u6b64\u7ea7\u522b\u65f6\uff0c\u63a7\u4ef6\u95ea\u70c1\u7ea2\u8272\u3002",
      reset: "\u91cd\u7f6e\u8ba1\u65f6\u5668",
      timerHint: "\u8ba1\u65f6\u5668\u5728\u9996\u6b21 HP \u635f\u5931\u65f6\u542f\u52a8\uff0c\u66f4\u6362\u76ee\u6807\u65f6\u81ea\u52a8\u91cd\u7f6e\u3002",
    },
    jp: {
      title: "Kill Timer",
      enable: "\u6709\u52b9",
      overlayPos: "\u30aa\u30fc\u30d0\u30fc\u30ec\u30a4\u4f4d\u7f6e",
      posX: "X (%)",
      posY: "Y (%)",
      alertThreshold: "\u30a2\u30e9\u30fc\u30c8\u95be\u5024",
      alertLabel: "\u30a2\u30e9\u30fc\u30c8 HP% \u2264",
      thresholdHint: "\u6575\u306e HP \u304c\u3053\u306e\u5024\u306b\u9054\u3059\u308b\u3068\u30a6\u30a3\u30b8\u30a7\u30c3\u30c8\u304c\u8d64\u304f\u70b9\u6ec5\u3057\u307e\u3059\u3002",
      reset: "\u30bf\u30a4\u30de\u30fc\u30ea\u30bb\u30c3\u30c8",
      timerHint: "\u6700\u521d\u306e HP \u6e1b\u5c11\u3067\u30bf\u30a4\u30de\u30fc\u30b9\u30bf\u30fc\u30c8\u3002\u30bf\u30fc\u30b2\u30c3\u30c8\u5909\u66f4\u6642\u306b\u81ea\u52d5\u30ea\u30bb\u30c3\u30c8\u3002",
    },
  };

  const L = translations[locale] || translations.en;

  // ── DOM refs ────────────────────────────────────────────────────────────────

  const enabledToggle = document.getElementById("enabledToggle");
  const overlayPosXInput = document.getElementById("overlayPosX");
  const overlayPosYInput = document.getElementById("overlayPosY");
  const overlayPosXVal = document.getElementById("overlayPosXVal");
  const overlayPosYVal = document.getElementById("overlayPosYVal");
  const thresholdInput = document.getElementById("thresholdSlider");
  const thresholdVal = document.getElementById("thresholdVal");
  const resetBtn = document.getElementById("resetBtn");
  const stepButtons = Array.from(document.querySelectorAll(".step-btn"));

  // ── IPC helpers ─────────────────────────────────────────────────────────────

  function unwrap(result) {
    if (result && typeof result === "object" && "ok" in result) {
      if (result.ok) return result.data;
      throw new Error(result.error || "IPC call failed");
    }
    return result;
  }

  async function ipcInvoke(channel, ...args) {
    if (window.plugin?.ipc?.invoke) return window.plugin.ipc.invoke(channel, ...args);
    if (window.parent?.invokePluginChannel && window.__pluginId) {
      return window.parent.invokePluginChannel(window.__pluginId, channel, ...args);
    }
    throw new Error("IPC unavailable");
  }

  // ── Clamping ─────────────────────────────────────────────────────────────────

  function clampPercent(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, Math.round(n)));
  }

  function clampThreshold(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 20;
    return Math.min(50, Math.max(5, Math.round(n / 5) * 5));
  }

  // ── State ────────────────────────────────────────────────────────────────────

  let settings = { threshold: 20, x: 0.5, y: 0.05, enabled: true };

  function applySettingsToUI() {
    if (enabledToggle) enabledToggle.checked = settings.enabled;
    const posX = clampPercent(settings.x * 100);
    const posY = clampPercent(settings.y * 100);
    if (overlayPosXInput) overlayPosXInput.value = String(posX);
    if (overlayPosXVal) overlayPosXVal.textContent = String(posX);
    if (overlayPosYInput) overlayPosYInput.value = String(posY);
    if (overlayPosYVal) overlayPosYVal.textContent = String(posY);
    if (thresholdInput) thresholdInput.value = String(settings.threshold);
    if (thresholdVal) thresholdVal.textContent = `${settings.threshold}%`;
  }

  async function updateSettings(updates) {
    try {
      const result = unwrap(await ipcInvoke("settings:update", updates));
      if (result) settings = result;
      applySettingsToUI();
    } catch (err) {
      console.error("[kill-timer] settings:update failed", err);
    }
  }

  async function loadSettings() {
    try {
      const result = unwrap(await ipcInvoke("settings:get"));
      if (result) settings = result;
      applySettingsToUI();
    } catch (err) {
      console.error("[kill-timer] settings:get failed", err);
    }
  }

  // ── i18n ─────────────────────────────────────────────────────────────────────

  function applyTranslations() {
    const titleEl = document.querySelector(".panel-header .title span:last-child");
    if (titleEl) titleEl.textContent = L.title;

    const enableLabel = document.querySelector("#enabledToggle + span");
    if (enableLabel) enableLabel.textContent = L.enable;

    const overlayPosLabel = document.querySelector(".settings-card:first-of-type .section-label");
    if (overlayPosLabel) overlayPosLabel.textContent = L.overlayPos;

    const thresholdCard = document.querySelector(".settings-card:nth-of-type(2)");
    if (thresholdCard) {
      const sectionLabel = thresholdCard.querySelector(".section-label");
      if (sectionLabel) sectionLabel.textContent = L.alertThreshold;
      const threshLabel = thresholdCard.querySelector("#thresholdLabel");
      if (threshLabel) threshLabel.textContent = L.alertLabel;
      const threshHint = thresholdCard.querySelector("#thresholdHint");
      if (threshHint) threshHint.textContent = L.thresholdHint;
    }

    if (resetBtn) resetBtn.textContent = L.reset;
    const timerHint = document.getElementById("timerHint");
    if (timerHint) timerHint.textContent = L.timerHint;

    // Slider labels
    const xLabel = overlayPosXInput?.parentElement?.querySelector("span");
    if (xLabel) xLabel.textContent = L.posX;
    const yLabel = overlayPosYInput?.parentElement?.querySelector("span");
    if (yLabel) yLabel.textContent = L.posY;
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  async function init() {
    applyTranslations();

    enabledToggle?.addEventListener("change", (e) => {
      updateSettings({ enabled: !!e.target.checked });
    });

    overlayPosXInput?.addEventListener("input", (e) => {
      const next = clampPercent(e.target.value);
      if (overlayPosXVal) overlayPosXVal.textContent = String(next);
      updateSettings({ x: next / 100 });
    });

    overlayPosYInput?.addEventListener("input", (e) => {
      const next = clampPercent(e.target.value);
      if (overlayPosYVal) overlayPosYVal.textContent = String(next);
      updateSettings({ y: next / 100 });
    });

    thresholdInput?.addEventListener("input", (e) => {
      const next = clampThreshold(e.target.value);
      thresholdInput.value = String(next);
      if (thresholdVal) thresholdVal.textContent = `${next}%`;
      updateSettings({ threshold: next });
    });

    stepButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.target;
        const dir = Number(btn.dataset.dir) || 0;
        if (!targetId || !dir) return;
        const input = document.getElementById(targetId);
        if (!input) return;

        const isThreshold = targetId === "thresholdSlider";
        const step = isThreshold ? 5 : 1;

        if (isThreshold) {
          const current = clampThreshold(input.value);
          const next = Math.min(50, Math.max(5, current + dir * step));
          input.value = String(next);
          if (thresholdVal) thresholdVal.textContent = `${next}%`;
          updateSettings({ threshold: next });
        } else if (targetId === "overlayPosX") {
          const next = clampPercent(Number(input.value) + dir);
          input.value = String(next);
          if (overlayPosXVal) overlayPosXVal.textContent = String(next);
          updateSettings({ x: next / 100 });
        } else if (targetId === "overlayPosY") {
          const next = clampPercent(Number(input.value) + dir);
          input.value = String(next);
          if (overlayPosYVal) overlayPosYVal.textContent = String(next);
          updateSettings({ y: next / 100 });
        }
      });
    });

    resetBtn?.addEventListener("click", async () => {
      try {
        await ipcInvoke("timer:reset");
      } catch (err) {
        console.error("[kill-timer] timer:reset failed", err);
      }
    });

    await loadSettings();
  }

  window.addEventListener("load", init);
})();

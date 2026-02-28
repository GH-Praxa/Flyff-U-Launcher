(function () {
  "use strict";

  const widget = document.getElementById("widget");
  const timerEl = document.getElementById("timerDisplay");
  const hpBarEl = document.getElementById("hpBar");
  const hpPercentEl = document.getElementById("hpPercent");

  let currentProfileId = "default";
  let pollHandle = null;

  function unwrap(result) {
    if (result && typeof result === "object" && "ok" in result) {
      if (result.ok) return result.data;
      throw new Error(result.error || "IPC call failed");
    }
    return result;
  }

  function pad2(n) {
    return String(Math.floor(n)).padStart(2, "0");
  }

  // Format elapsed milliseconds as "SS.cc" (seconds.centiseconds)
  function formatTimer(elapsedMs) {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) elapsedMs = 0;
    const totalCs = Math.floor(elapsedMs / 10);
    const ss = Math.floor(totalCs / 100);
    const cc = totalCs % 100;
    return `\u23F1 ${pad2(ss)}.${pad2(cc)}`;
  }

  function applyPlacement(x, y) {
    widget.style.left = `${(x || 0) * window.innerWidth}px`;
    widget.style.top = `${(y || 0) * window.innerHeight}px`;
  }

  function render(state) {
    if (!state || !state.hasTarget || !state.enabled || !state.running) {
      widget.style.display = "none";
      return;
    }

    widget.style.display = "block";
    applyPlacement(state.x, state.y);

    // Timer
    timerEl.textContent = formatTimer(state.elapsed);

    // HP bar
    const hp = (state.hpPercent !== null && state.hpPercent !== undefined)
      ? Math.max(0, Math.min(100, state.hpPercent))
      : 100;
    hpBarEl.style.width = `${hp}%`;
    hpPercentEl.textContent = state.hpPercent !== null ? `${state.hpPercent}%` : "\u2014";

    // Alert mode when HP is at or below threshold
    const alertMode = state.hpPercent !== null && state.hpPercent <= state.threshold;
    widget.classList.toggle("alert", alertMode);
  }

  async function poll() {
    try {
      const data = unwrap(await window.plugin.ipc.invoke("state:get", currentProfileId));
      render(data);
    } catch (err) {
      console.error("[kill-timer overlay] state:get failed", err);
    }
  }

  async function bind(_browserViewId, profileId) {
    currentProfileId = profileId || "default";
    await poll();
  }

  function init() {
    if (pollHandle) clearInterval(pollHandle);
    pollHandle = setInterval(poll, 100);
    poll();
  }

  window.addEventListener("load", init);

  // Overlay host expects this global
  window.KillTimerOverlay = { bind, poll };
})();

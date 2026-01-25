(function() {
  "use strict";

  const grid = document.getElementById("iconGrid");
  const DEFAULT_OVERLAY = { x: 0.75, y: 0.05, columns: 5, hidden: false };
  const MAX_COLUMNS = 12;

  let currentProfileId = "default";
  let state = { overlay: { ...DEFAULT_OVERLAY }, expired: [] };
  let pollHandle = null;

  function unwrap(result) {
    if (result && typeof result === "object" && "ok" in result) {
      if (result.ok) return result.data;
      throw new Error(result.error || "IPC call failed");
    }
    return result;
  }

  function clampColumns(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_OVERLAY.columns;
    return Math.min(MAX_COLUMNS, Math.max(1, Math.round(num)));
  }

  function clampPositionPx(value, size, maxSize) {
    if (!Number.isFinite(value)) return 0;
    const max = Math.max(0, maxSize - size);
    if (value < 0) return 0;
    if (value > max) return max;
    return value;
  }

  function applyOverlayPlacement() {
    const cfg = state.overlay || DEFAULT_OVERLAY;
    const columns = clampColumns(cfg.columns);
    grid.style.setProperty("--cols", columns);
    const size = Math.max(24, Math.min(96, Number(cfg.iconSize ?? DEFAULT_OVERLAY.iconSize) || DEFAULT_OVERLAY.iconSize));
    const px = size;
    grid.style.setProperty("--icon-size", `${px}px`);
    grid.style.setProperty("--icon-gap", `${Math.round(px * 0.16)}px`);

    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const rect = grid.getBoundingClientRect();
    const width = Math.max(rect.width || px, px * 1.5);
    const height = Math.max(rect.height || px, px * 1.5);
    const left = clampPositionPx((cfg.x || 0) * w, width, w);
    const top = clampPositionPx((cfg.y || 0) * h, height, h);
    grid.style.left = `${left}px`;
    grid.style.top = `${top}px`;
  }

  function renderIcons() {
    const items = Array.isArray(state.expired) ? state.expired : [];
    grid.innerHTML = "";
    if (state.overlay?.hidden) {
      grid.style.display = "none";
      return;
    }

    grid.style.display = "inline-grid";

    items.forEach((item) => {
      const tile = document.createElement("div");
      tile.className = "icon";
      const iconSrc = item.iconDataUrl || item.iconUrl;
      if (iconSrc) {
        const img = document.createElement("img");
        img.src = iconSrc;
        img.alt = item.name || "Icon";
        tile.appendChild(img);
      } else {
        tile.textContent = item.name?.slice(0, 2) || "CD";
      }
      const label = document.createElement("div");
      label.className = "label";
      label.textContent = item.name || "";
      tile.appendChild(label);
      grid.appendChild(tile);
    });
    applyOverlayPlacement();
  }

  async function requestState() {
    try {
      const data = unwrap(await window.plugin.ipc.invoke("overlay:state", currentProfileId));
      if (!data) return;
      state.overlay = data.overlay || state.overlay || DEFAULT_OVERLAY;
      state.expired = data.expired || [];
      applyOverlayPlacement();
      renderIcons();
    } catch (err) {
      console.error("[cd-timer overlay] overlay:state failed", err);
    }
  }

  async function bind(_browserViewId, profileId) {
    currentProfileId = profileId || "default";
    await requestState();
  }

  function init() {
    if (pollHandle) clearInterval(pollHandle);
    pollHandle = setInterval(requestState, 400);
    requestState();
  }

  window.addEventListener("resize", applyOverlayPlacement);
  window.addEventListener("load", init);

  // Overlay host expects this global
  window.KillfeedOverlay = {
    bind,
    requestState,
  };
})();

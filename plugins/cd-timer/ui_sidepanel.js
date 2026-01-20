(function() {
  "use strict";

  const badgeListEl = document.getElementById("badgeList");
  const addBtn = document.getElementById("addBtn");
  const expireAllBtn = document.getElementById("expireAllBtn");
  const allActiveToggle = document.getElementById("allActiveToggle");
  const overlayColumnsInput = document.getElementById("overlayColumns");
  const overlayPosXInput = document.getElementById("overlayPosX");
  const overlayPosYInput = document.getElementById("overlayPosY");
  const badgeCountEl = document.getElementById("badgeCount");
  const overlayPosXVal = document.getElementById("overlayPosXVal");
  const overlayPosYVal = document.getElementById("overlayPosYVal");
  const overlayHideToggle = document.getElementById("overlayHideToggle");
  const iconSizeInput = document.getElementById("iconSize");
  const iconSizeVal = document.getElementById("iconSizeVal");
  const stepButtons = Array.from(document.querySelectorAll(".step-btn"));
  const overlayResetBtn = document.getElementById("overlayReset");

  // Icon picker elements
  const iconPickerEl = document.getElementById("iconPicker");
  const iconGridEl = document.getElementById("iconGrid");
  const iconTabsEl = document.getElementById("iconTabs");
  const iconSearchInput = document.getElementById("iconSearch");
  const closePickerBtn = document.getElementById("closePicker");
  const clearIconBtn = document.getElementById("clearIcon");

  const state = {
    badges: [],
    timers: { active: {}, expired: {} },
    overlay: null,
    icons: [],
  };

  const refs = new Map(); // badgeId -> { card, lcd, hotkeyBtn }
  let pollInterval = null;
  let hotkeyCapture = null;
  let iconTargetBadge = null;
  let iconTab = "items";
  let iconSearchTerm = "";
  const collapsed = new Map(); // badgeId -> boolean

  function unwrap(result) {
    if (result && typeof result === "object" && "ok" in result) {
      if (result.ok) return result.data;
      throw new Error(result.error || "IPC call failed");
    }
    return result;
  }

  function pad(num) {
    return String(num).padStart(2, "0");
  }

  function formatMs(ms) {
    if (!Number.isFinite(ms) || ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function splitDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return { h, m, s };
  }

  function clampColumns(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 5;
    return Math.min(12, Math.max(1, Math.round(num)));
  }

  function clampIconSize(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 52;
    return Math.min(96, Math.max(24, Math.round(num)));
  }

  function clampPercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.min(100, Math.max(0, Math.round(num)));
  }

  async function loadState() {
    const data = unwrap(await window.plugin.ipc.invoke("badge:list"));
    state.badges = data?.badges || [];
    state.timers = data?.timers || { active: {}, expired: {} };
    state.overlay = data?.overlay || state.overlay || null;
    if (data?.badges) {
      data.badges.forEach((b) => {
        if (b && b.id) {
          collapsed.set(b.id, !!b.collapsed);
        }
      });
    }
    renderBadgeCount();
    renderOverlaySettings();
    renderBadges();
    updateTimersDisplay();
  }

  async function refreshTimers() {
    try {
      const timers = unwrap(await window.plugin.ipc.invoke("timer:state"));
      state.timers = timers || { active: {}, expired: {} };
      updateTimersDisplay();
    } catch (err) {
      console.error("[cd-timer] timer:state failed", err);
    }
  }

  function renderBadgeCount() {
    if (!badgeCountEl) return;
    const total = state.badges.length;
    const active = state.badges.filter((b) => b.enabled !== false).length;
    badgeCountEl.textContent = `${active}/${total || 0} aktiv`;
  }

  async function createBadge() {
    try {
      await window.plugin.ipc.invoke("badge:create");
      await loadState();
    } catch (err) {
      console.error("[cd-timer] badge:create failed", err);
    }
  }

  async function updateBadge(id, updates) {
    try {
      await window.plugin.ipc.invoke("badge:update", id, updates);
      await loadState();
    } catch (err) {
      console.error("[cd-timer] badge:update failed", err);
    }
  }

  async function deleteBadge(id) {
    try {
      await window.plugin.ipc.invoke("badge:delete", id);
      await loadState();
    } catch (err) {
      console.error("[cd-timer] badge:delete failed", err);
    }
  }

  function buildDurationFromInputs(hInput, mInput, sInput) {
    const h = Math.max(0, Math.floor(Number(hInput.value) || 0));
    const m = Math.min(59, Math.max(0, Math.floor(Number(mInput.value) || 0)));
    const s = Math.min(59, Math.max(0, Math.floor(Number(sInput.value) || 0)));
    hInput.value = h;
    mInput.value = pad(m);
    sInput.value = pad(s);
    return ((h * 3600) + (m * 60) + s) * 1000;
  }

  function renderBadges() {
    badgeListEl.innerHTML = "";
    refs.clear();

    const visibleIds = new Set(state.badges.map((b) => b.id));
    for (const key of Array.from(collapsed.keys())) {
      if (!visibleIds.has(key)) {
        collapsed.delete(key);
      }
    }

    if (!state.badges.length) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "Noch keine Timer. Mit + hinzufuegen.";
      badgeListEl.appendChild(empty);
      return;
    }

    state.badges.forEach((badge) => {
      const isCollapsed = collapsed.get(badge.id) === true;
      const isSupport = badge.target === "support";
      const card = document.createElement("div");
      card.className = "badge-card" + (isCollapsed ? " collapsed" : "") + (isSupport ? " target-support" : "");
      card.dataset.badgeId = badge.id;

      // Top row: checkbox, icon, name, delete
      const rowTop = document.createElement("div");
      rowTop.className = "row top";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = badge.enabled !== false;
      checkbox.addEventListener("change", () => {
        updateBadge(badge.id, { enabled: checkbox.checked });
      });
      const checkboxWrap = document.createElement("label");
      checkboxWrap.className = "checkbox";
      checkboxWrap.append(checkbox, document.createTextNode("Aktiv"));

      const iconBtn = document.createElement("button");
      iconBtn.className = "icon-btn";
      iconBtn.title = "Icon auswaehlen";
      const iconSrc = badge.iconDataUrl || badge.iconUrl || badge.iconPath;
      if (iconSrc) {
        const img = document.createElement("img");
        img.src = iconSrc;
        img.alt = "Icon";
        iconBtn.appendChild(img);
      } else {
        iconBtn.textContent = "Icon";
      }
      iconBtn.addEventListener("click", () => openIconPicker(badge.id));

      const nameInput = document.createElement("input");
      nameInput.className = "name-input";
      nameInput.value = badge.name || "Timer";
      nameInput.placeholder = "Timer Name";
      nameInput.addEventListener("change", () => {
        updateBadge(badge.id, { name: nameInput.value });
      });

      const collapseBtn = document.createElement("button");
      collapseBtn.className = "collapse-btn";
      collapseBtn.title = isCollapsed ? "Maximieren" : "Minimieren";
      collapseBtn.textContent = isCollapsed ? "+" : "-";
      collapseBtn.addEventListener("click", async () => {
        const next = !isCollapsed;
        collapsed.set(badge.id, next);
        renderBadges();
        try {
          await window.plugin.ipc.invoke("collapse:set", badge.id, next);
        } catch (err) {
          console.error("[cd-timer] collapse:set failed", err);
        }
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.textContent = "X";
      deleteBtn.title = "Loeschen";
      deleteBtn.addEventListener("click", () => deleteBadge(badge.id));

      rowTop.append(checkboxWrap, iconBtn, nameInput, collapseBtn);

      // Duration row
      const durationRow = document.createElement("div");
      durationRow.className = "row duration";
      const timeInputs = document.createElement("div");
      timeInputs.className = "time-inputs";
      const split = splitDuration(badge.durationMs);

      const hhWrap = document.createElement("label");
      hhWrap.className = "time-input";
      hhWrap.textContent = "HH";
      const hhInput = document.createElement("input");
      hhInput.type = "number";
      hhInput.min = "0";
      hhInput.max = "999";
      hhInput.value = split.h;
      hhInput.addEventListener("change", () => {
        const ms = buildDurationFromInputs(hhInput, mmInput, ssInput);
        updateBadge(badge.id, { durationMs: ms });
      });
      hhWrap.appendChild(hhInput);

      const mmWrap = document.createElement("label");
      mmWrap.className = "time-input";
      mmWrap.textContent = "MM";
      const mmInput = document.createElement("input");
      mmInput.type = "number";
      mmInput.min = "0";
      mmInput.max = "59";
      mmInput.value = pad(split.m);
      mmInput.addEventListener("change", () => {
        const ms = buildDurationFromInputs(hhInput, mmInput, ssInput);
        updateBadge(badge.id, { durationMs: ms });
      });
      mmWrap.appendChild(mmInput);

      const ssWrap = document.createElement("label");
      ssWrap.className = "time-input";
      ssWrap.textContent = "SS";
      const ssInput = document.createElement("input");
      ssInput.type = "number";
      ssInput.min = "0";
      ssInput.max = "59";
      ssInput.value = pad(split.s);
      ssInput.addEventListener("change", () => {
        const ms = buildDurationFromInputs(hhInput, mmInput, ssInput);
        updateBadge(badge.id, { durationMs: ms });
      });
      ssWrap.appendChild(ssInput);

      timeInputs.append(hhWrap, mmWrap, ssWrap);

      const lcd = document.createElement("div");
      lcd.className = "lcd";
      lcd.textContent = formatMs(badge.durationMs);

      durationRow.append(timeInputs, lcd);

      // Hotkey row
      const hotkeyRow = document.createElement("div");
      hotkeyRow.className = "hotkey row";
      const hotkeyLabel = document.createElement("div");
      hotkeyLabel.className = "hint";
      hotkeyLabel.textContent = "Hotkey";
      const hotkeyBtn = document.createElement("button");
      hotkeyBtn.className = "hotkey-btn";
      hotkeyBtn.textContent = badge.hotkey || "Aufnehmen...";
      hotkeyBtn.addEventListener("click", () => startHotkeyCapture(badge.id, hotkeyBtn));

      hotkeyRow.append(hotkeyLabel, hotkeyBtn);

      // Target row
      const targetRow = document.createElement("div");
      targetRow.className = "row target-row";
      const targetLabel = document.createElement("div");
      targetLabel.className = "hint";
      targetLabel.textContent = "Ziel";

      const radioGroup = document.createElement("div");
      radioGroup.className = "radio-group";

      const createRadio = (value, label) => {
        const wrap = document.createElement("label");
        wrap.className = "radio-pill";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = `target-${badge.id}`;
        input.value = value;
        const dot = document.createElement("span");
        dot.className = "radio-dot";
        const text = document.createElement("span");
        text.textContent = label;
        wrap.append(input, dot, text);

        const doSelect = () => {
          // Deactivate all siblings first
          radioGroup.querySelectorAll(".radio-pill").forEach((el) => {
            el.classList.remove("active");
          });
          radioGroup.querySelectorAll("input[type=radio]").forEach((el) => {
            el.checked = false;
          });
          // Activate this one
          input.checked = true;
          wrap.classList.add("active");
          // Save to backend
          updateBadge(badge.id, { target: value });
        };

        input.addEventListener("change", () => {
          if (input.checked) {
            doSelect();
          }
        });

        wrap.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          doSelect();
        });

        return { wrap, input };
      };

      const mainRadio = createRadio("main", "Main-RM");
      const supportRadio = createRadio("support", "Support-View");

      radioGroup.append(mainRadio.wrap, supportRadio.wrap);
      targetRow.append(targetLabel, radioGroup);

      if (badge.target === "support") {
        supportRadio.input.checked = true;
        supportRadio.wrap.classList.add("active");
      } else {
        mainRadio.input.checked = true;
        mainRadio.wrap.classList.add("active");
      }

      targetRow.append(deleteBtn);
      card.append(rowTop, durationRow, hotkeyRow, targetRow);
      badgeListEl.appendChild(card);

      refs.set(badge.id, { card, lcd, hotkeyBtn, iconBtn });

      if (isCollapsed) {
        durationRow.style.display = "none";
        hotkeyRow.style.display = "none";
        targetRow.style.display = "none";
      }
    });

    updateTimersDisplay();
  }

  function updateTimersDisplay() {
    state.badges.forEach((badge) => {
      const ref = refs.get(badge.id);
      if (!ref) return;
      const active = state.timers.active?.[badge.id];
      const expired = state.timers.expired?.[badge.id];
      const lcd = ref.lcd;

      if (active) {
        lcd.textContent = formatMs(active.remainingMs);
        lcd.classList.add("running");
        lcd.classList.remove("expired");
      } else if (expired) {
        lcd.textContent = "00:00:00";
        lcd.classList.add("expired");
        lcd.classList.remove("running");
      } else {
        lcd.textContent = formatMs(badge.durationMs);
        lcd.classList.remove("running");
        lcd.classList.remove("expired");
      }
    });
  }

  function buildAccelerator(evt) {
    const parts = [];
    if (evt.ctrlKey) parts.push("Control");
    if (evt.altKey) parts.push("Alt");
    if (evt.shiftKey) parts.push("Shift");
    if (evt.metaKey) parts.push("Super");
    const key = evt.key;
    if (!key) return null;
    const specials = {
      " ": "Space",
      "ArrowLeft": "Left",
      "ArrowRight": "Right",
      "ArrowUp": "Up",
      "ArrowDown": "Down",
      "Escape": "Esc",
    };
    if (specials[key]) {
      parts.push(specials[key]);
    } else if (key.length === 1) {
      parts.push(key.toUpperCase());
    } else if (!["Control", "Shift", "Alt", "Meta"].includes(key)) {
      parts.push(key);
    }
    if (!parts.length) return null;
    return parts.join("+");
  }

  function stopHotkeyCapture() {
    if (!hotkeyCapture) return;
    hotkeyCapture.btn.classList.remove("recording");
    hotkeyCapture = null;
    window.plugin?.ipc?.invoke?.("hotkeys:resume").catch((err) => {
      console.error("[cd-timer] hotkeys:resume failed", err);
    });
  }

  async function startHotkeyCapture(badgeId, btn) {
    stopHotkeyCapture();
    window.plugin?.ipc?.invoke?.("hotkeys:pause").catch((err) => {
      console.error("[cd-timer] hotkeys:pause failed", err);
    });
    hotkeyCapture = { badgeId, btn };
    btn.classList.add("recording");
    btn.textContent = "Taste druecken...";
  }

  window.addEventListener("keydown", async (e) => {
    if (!hotkeyCapture) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      await updateBadge(hotkeyCapture.badgeId, { hotkey: null });
      stopHotkeyCapture();
      return;
    }
    const accel = buildAccelerator(e);
    if (accel) {
      await updateBadge(hotkeyCapture.badgeId, { hotkey: accel });
    }
    stopHotkeyCapture();
  });

  async function openIconPicker(badgeId) {
    iconTargetBadge = badgeId;
    iconSearchTerm = "";
    if (iconSearchInput) iconSearchInput.value = "";
    await ensureIconsLoaded();
    renderIconTabs();
    renderIconGrid();
    iconPickerEl.classList.remove("hidden");
  }

  function closeIconPicker() {
    iconTargetBadge = null;
    iconPickerEl.classList.add("hidden");
  }

  async function ensureIconsLoaded() {
    if (state.icons && state.icons.length) return;
    try {
      const result = unwrap(await window.plugin.ipc.invoke("icons:list"));
      const icons = result?.icons || [];
      icons.sort((a, b) => {
        const nameA = (a.name || a.path || "").toLowerCase();
        const nameB = (b.name || b.path || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
      state.icons = icons;
    } catch (err) {
      console.error("[cd-timer] icons:list failed", err);
      state.icons = [];
    }
  }

  function renderIconTabs() {
    const categories = [
      { id: "items", label: "Items" },
      { id: "all", label: "Alle" },
      { id: "buffs", label: "Buffs" },
      { id: "skills", label: "Skills" },
    ];
    iconTabsEl.innerHTML = "";
    categories.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "tab-btn" + (iconTab === cat.id ? " active" : "");
      btn.textContent = cat.label;
      btn.addEventListener("click", () => {
        iconTab = cat.id;
        renderIconTabs();
        renderIconGrid();
      });
      iconTabsEl.appendChild(btn);
    });
  }

  function renderIconGrid() {
    iconGridEl.innerHTML = "";
    const term = (iconSearchTerm || "").trim().toLowerCase();
    const filtered = state.icons.filter((icon) => {
      const inCategory = iconTab === "all" || icon.category === iconTab;
      if (!inCategory) return false;
      if (!term) return true;
      const haystack = `${icon.name || ""} ${icon.path || ""}`.toLowerCase();
      return haystack.includes(term);
    });
    if (!filtered.length) {
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = term
        ? "Keine Icons gefunden. Suchbegriff oder Tab pruefen."
        : "Keine Icons in diesem Ordner gefunden.";
      iconGridEl.appendChild(hint);
      return;
    }
    filtered.forEach((icon) => {
      const tile = document.createElement("div");
      tile.className = "icon-tile";
      const iconSrc = icon.dataUrl || icon.url || icon.path;
      if (iconSrc) {
        const img = document.createElement("img");
        img.src = iconSrc;
        img.alt = icon.name;
        img.loading = "lazy";
        img.addEventListener("error", () => {
          img.remove();
          const ph = document.createElement("div");
          ph.className = "icon-missing";
          ph.textContent = "Kein Icon";
          tile.insertBefore(ph, tile.firstChild);
        });
        tile.appendChild(img);
      } else {
        const ph = document.createElement("div");
        ph.className = "icon-missing";
        ph.textContent = "Kein Icon";
        tile.appendChild(ph);
      }
      const label = document.createElement("div");
      label.className = "icon-name";
      label.textContent = icon.name || icon.path;
      label.title = icon.name || icon.path;
      tile.appendChild(label);
      tile.title = icon.name || icon.path;
      tile.addEventListener("click", async () => {
        if (!iconTargetBadge) return;
        await updateBadge(iconTargetBadge, { iconPath: icon.path });
        closeIconPicker();
      });
      iconGridEl.appendChild(tile);
    });
  }

  function attachPickerEvents() {
    closePickerBtn?.addEventListener("click", closeIconPicker);
    clearIconBtn?.addEventListener("click", async () => {
      if (!iconTargetBadge) return;
      await updateBadge(iconTargetBadge, { iconPath: null });
      closeIconPicker();
    });
    iconSearchInput?.addEventListener("input", (e) => {
      iconSearchTerm = e.target?.value || "";
      renderIconGrid();
    });
    iconPickerEl?.addEventListener("click", (e) => {
      if (e.target === iconPickerEl || e.target === iconPickerEl.querySelector(".modal-backdrop")) {
        closeIconPicker();
      }
    });
  }

  async function updateOverlayConfig(updates) {
    try {
      const overlay = unwrap(await window.plugin.ipc.invoke("overlay:update", updates));
      state.overlay = overlay || state.overlay;
      renderOverlaySettings();
    } catch (err) {
      console.error("[cd-timer] overlay:update failed", err);
    }
  }

  function renderOverlaySettings() {
    const columns = clampColumns(state.overlay?.columns ?? 5);
    const posX = clampPercent((state.overlay?.x ?? 0.75) * 100);
    const posY = clampPercent((state.overlay?.y ?? 0.05) * 100);
    const iconSize = clampIconSize(state.overlay?.iconSize ?? 52);
    const allActive = state.badges.length > 0 && state.badges.every((b) => b.enabled !== false);
    const hidden = !!state.overlay?.hidden;
    if (overlayColumnsInput) {
      overlayColumnsInput.value = String(columns);
    }
    if (overlayPosXInput) overlayPosXInput.value = String(posX);
    if (overlayPosYInput) overlayPosYInput.value = String(posY);
    if (overlayPosXVal) overlayPosXVal.textContent = String(posX);
    if (overlayPosYVal) overlayPosYVal.textContent = String(posY);
    if (iconSizeInput) iconSizeInput.value = String(iconSize);
    if (iconSizeVal) iconSizeVal.textContent = String(iconSize);
    if (allActiveToggle) allActiveToggle.checked = allActive;
    if (overlayHideToggle) overlayHideToggle.checked = hidden;
  }

  async function expireAll() {
    try {
      await window.plugin.ipc.invoke("badge:expireall");
      await loadState();
    } catch (err) {
      console.error("[cd-timer] badge:expireall failed", err);
    }
  }

  async function setAllActive(enabled) {
    try {
      await window.plugin.ipc.invoke("badge:enableall", !!enabled);
      await loadState();
    } catch (err) {
      console.error("[cd-timer] badge:enableall failed", err);
    }
  }

  async function init() {
    attachPickerEvents();
    addBtn?.addEventListener("click", createBadge);
    expireAllBtn?.addEventListener("click", expireAll);
    allActiveToggle?.addEventListener("change", (e) => {
      setAllActive(!!e.target?.checked);
    });
    overlayHideToggle?.addEventListener("change", (e) => {
      updateOverlayConfig({ hidden: !!e.target?.checked });
    });
    overlayColumnsInput?.addEventListener("change", (e) => {
      const next = clampColumns(e.target?.value);
      overlayColumnsInput.value = String(next);
      updateOverlayConfig({ columns: next });
    });
    iconSizeInput?.addEventListener("change", (e) => {
      const next = clampIconSize(e.target?.value);
      iconSizeInput.value = String(next);
      if (iconSizeVal) iconSizeVal.textContent = String(next);
      updateOverlayConfig({ iconSize: next });
    });
    overlayPosXInput?.addEventListener("change", (e) => {
      const next = clampPercent(e.target?.value);
      overlayPosXInput.value = String(next);
      if (overlayPosXVal) overlayPosXVal.textContent = String(next);
      updateOverlayConfig({ x: next / 100 });
    });
    overlayPosYInput?.addEventListener("change", (e) => {
      const next = clampPercent(e.target?.value);
      overlayPosYInput.value = String(next);
      if (overlayPosYVal) overlayPosYVal.textContent = String(next);
      updateOverlayConfig({ y: next / 100 });
    });
    stepButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.target;
        const dir = Number(btn.dataset.dir) || 0;
        if (!targetId || !dir) return;
        const input = document.getElementById(targetId);
        if (!input) return;
        const isIcon = targetId === "iconSize";
        const current = isIcon ? clampIconSize(input.value) : clampPercent(input.value);
        const next = isIcon ? clampIconSize(current + dir) : clampPercent(current + dir);
        input.value = String(next);
        if (targetId === "overlayPosX") {
          if (overlayPosXVal) overlayPosXVal.textContent = String(next);
          updateOverlayConfig({ x: next / 100 });
        } else if (targetId === "overlayPosY") {
          if (overlayPosYVal) overlayPosYVal.textContent = String(next);
          updateOverlayConfig({ y: next / 100 });
        } else if (targetId === "iconSize") {
          if (iconSizeVal) iconSizeVal.textContent = String(next);
          updateOverlayConfig({ iconSize: next });
        }
      });
    });
    overlayResetBtn?.addEventListener("click", () => {
      updateOverlayConfig({ reset: true });
    });

    await loadState();

    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(refreshTimers, 350);
  }

  window.addEventListener("load", init);
})();

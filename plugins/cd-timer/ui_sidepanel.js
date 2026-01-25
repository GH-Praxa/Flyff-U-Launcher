(function() {
  "use strict";

  // ----------------------------------------------------------------------------
  // Localization
  // ----------------------------------------------------------------------------
  function detectLocale() {
    try {
      const qs = new URLSearchParams(window.location.search || "");
      const fromQuery = qs.get("locale");
      const fromAttr = document.documentElement?.lang;
      const raw = (window.__pluginLocale || fromQuery || fromAttr || navigator.language || "en").slice(0, 2).toLowerCase();
      return raw === "zh" ? "cn"
        : raw === "ja" ? "jp"
        : raw === "pt" ? "en" // fallback
        : raw;
    } catch (_e) {
      return "en";
    }
  }
  const locale = detectLocale();

  const translations = {
    en: {
      title: "CD-Timer",
      allActive: "All active",
      expireAll: "Expire all",
      add: "+",
      overlayPos: "Overlay position",
      overlayHint: "X/Y in % from top-left. Columns control width.",
      overlayHide: "Hide overlay",
      posX: "X (%)",
      posY: "Y (%)",
      icon: "Icon",
      columns: "Columns",
      reset: "Reset",
      badgeCountSuffix: "active",
      emptyList: "No timers yet. Add with +.",
      active: "Active",
      pickIcon: "Choose icon",
      iconLabel: "Icon",
      timerDefault: "Timer",
      timerName: "Timer name",
      expand: "Expand",
      collapse: "Collapse",
      delete: "Delete",
      hotkey: "Hotkey",
      recordHotkey: "Press key...",
      target: "Target",
      targetMain: "Main",
      targetSupport: "Support view",
      items: "Items",
      all: "All",
      buffs: "Buffs",
      skills: "Skills",
      noIconsSearch: "No icons found. Check search or tab.",
      noIconsFolder: "No icons found in this folder.",
      noIcon: "No icon",
      modalTitle: "Choose icon",
      modalSub: "Buffs, items, skills from the icons folder",
      clearIcon: "No icon",
      searchPlaceholder: "Search buff name...",
    },
    de: {
      title: "CD-Timer",
      allActive: "Alle aktiv",
      expireAll: "Alle abgelaufen",
      add: "+",
      overlayPos: "Overlay-Position",
      overlayHint: "X/Y in % vom oberen linken Rand. Spalten steuern die Breite.",
      overlayHide: "Overlay ausblenden",
      posX: "X (%)",
      posY: "Y (%)",
      icon: "Icon",
      columns: "Spalten",
      reset: "Reset",
      badgeCountSuffix: "aktiv",
      emptyList: "Noch keine Timer. Mit + hinzufügen.",
      active: "Aktiv",
      pickIcon: "Icon auswählen",
      iconLabel: "Icon",
      timerDefault: "Timer",
      timerName: "Timer-Name",
      expand: "Maximieren",
      collapse: "Minimieren",
      delete: "Löschen",
      hotkey: "Hotkey",
      recordHotkey: "Taste drücken...",
      target: "Ziel",
      targetMain: "Main",
      targetSupport: "Support-View",
      items: "Items",
      all: "Alle",
      buffs: "Buffs",
      skills: "Skills",
      noIconsSearch: "Keine Icons gefunden. Suchbegriff oder Tab prüfen.",
      noIconsFolder: "Keine Icons in diesem Ordner gefunden.",
      noIcon: "Kein Icon",
      modalTitle: "Icon auswählen",
      modalSub: "Buffs, Items, Skills aus dem Icons-Ordner",
      clearIcon: "Kein Icon",
      searchPlaceholder: "Buff-Name suchen...",
    },
    pl: {
      title: "CD-Timer",
      allActive: "Wszystkie aktywne",
      expireAll: "Wygaś wszystkie",
      add: "+",
      overlayPos: "Pozycja overlay",
      overlayHint: "X/Y w % od lewego górnego rogu. Kolumny sterują szerokością.",
      overlayHide: "Ukryj overlay",
      posX: "X (%)",
      posY: "Y (%)",
      icon: "Ikona",
      columns: "Kolumny",
      reset: "Reset",
      badgeCountSuffix: "aktywne",
      emptyList: "Brak timerów. Dodaj przyciskiem +.",
      active: "Aktywny",
      pickIcon: "Wybierz ikonę",
      iconLabel: "Ikona",
      timerDefault: "Timer",
      timerName: "Nazwa timera",
      expand: "Rozwiń",
      collapse: "Zwiń",
      delete: "Usuń",
      hotkey: "Hotkey",
      recordHotkey: "Naciśnij klawisz...",
      target: "Cel",
      targetMain: "Główny",
      targetSupport: "Widok wsparcia",
      items: "Przedmioty",
      all: "Wszystko",
      buffs: "Buffy",
      skills: "Umiejętności",
      noIconsSearch: "Brak ikon. Sprawdź filtr lub kartę.",
      noIconsFolder: "Brak ikon w tym folderze.",
      noIcon: "Brak ikony",
      modalTitle: "Wybierz ikonę",
      modalSub: "Buffy, przedmioty, umiejętności z folderu icons",
      clearIcon: "Brak ikony",
      searchPlaceholder: "Szukaj buffa...",
    },
    fr: {
      title: "CD-Timer",
      allActive: "Tous actifs",
      expireAll: "Tous expirés",
      add: "+",
      overlayPos: "Position overlay",
      overlayHint: "X/Y en % depuis le coin haut gauche. Les colonnes règlent la largeur.",
      overlayHide: "Masquer l'overlay",
      posX: "X (%)",
      posY: "Y (%)",
      icon: "Icône",
      columns: "Colonnes",
      reset: "Réinitialiser",
      badgeCountSuffix: "actifs",
      emptyList: "Aucun timer. Ajoute avec +.",
      active: "Actif",
      pickIcon: "Choisir une icône",
      iconLabel: "Icône",
      timerDefault: "Timer",
      timerName: "Nom du timer",
      expand: "Agrandir",
      collapse: "Réduire",
      delete: "Supprimer",
      hotkey: "Raccourci",
      recordHotkey: "Appuie sur une touche...",
      target: "Cible",
      targetMain: "Principal",
      targetSupport: "Vue support",
      items: "Objets",
      all: "Tous",
      buffs: "Buffs",
      skills: "Compétences",
      noIconsSearch: "Aucune icône trouvée. Vérifie la recherche ou l'onglet.",
      noIconsFolder: "Aucune icône dans ce dossier.",
      noIcon: "Pas d'icône",
      modalTitle: "Choisir une icône",
      modalSub: "Buffs, objets, compétences du dossier icons",
      clearIcon: "Pas d'icône",
      searchPlaceholder: "Chercher un buff...",
    },
    ru: {
      title: "CD-Timer",
      allActive: "Все активны",
      expireAll: "Все истекшие",
      add: "+",
      overlayPos: "Позиция оверлея",
      overlayHint: "X/Y в % от левого верхнего угла. Колонки задают ширину.",
      overlayHide: "Скрыть оверлей",
      posX: "X (%)",
      posY: "Y (%)",
      icon: "Иконка",
      columns: "Колонки",
      reset: "Сброс",
      badgeCountSuffix: "активны",
      emptyList: "Нет таймеров. Добавьте через +.",
      active: "Активно",
      pickIcon: "Выбрать иконку",
      iconLabel: "Иконка",
      timerDefault: "Таймер",
      timerName: "Имя таймера",
      expand: "Развернуть",
      collapse: "Свернуть",
      delete: "Удалить",
      hotkey: "Хоткей",
      recordHotkey: "Нажмите клавишу...",
      target: "Цель",
      targetMain: "Основной",
      targetSupport: "Поддержка",
      items: "Предметы",
      all: "Все",
      buffs: "Баффы",
      skills: "Умения",
      noIconsSearch: "Иконки не найдены. Проверьте поиск или вкладку.",
      noIconsFolder: "В этой папке нет иконок.",
      noIcon: "Нет иконки",
      modalTitle: "Выбрать иконку",
      modalSub: "Баффы, предметы, умения из папки icons",
      clearIcon: "Нет иконки",
      searchPlaceholder: "Поиск баффа...",
    },
    tr: {
      title: "CD-Timer",
      allActive: "Tümü aktif",
      expireAll: "Hepsi süresi doldu",
      add: "+",
      overlayPos: "Overlay konumu",
      overlayHint: "X/Y sol üstten % olarak. Sütunlar genişliği belirler.",
      overlayHide: "Overlay gizle",
      posX: "X (%)",
      posY: "Y (%)",
      icon: "Simge",
      columns: "Sütun",
      reset: "Sıfırla",
      badgeCountSuffix: "aktif",
      emptyList: "Henüz timer yok. + ile ekle.",
      active: "Aktif",
      pickIcon: "Simge seç",
      iconLabel: "Simge",
      timerDefault: "Zamanlayıcı",
      timerName: "Zamanlayıcı adı",
      expand: "Genişlet",
      collapse: "Daralt",
      delete: "Sil",
      hotkey: "Kısayol",
      recordHotkey: "Tuşa bas...",
      target: "Hedef",
      targetMain: "Ana",
      targetSupport: "Destek görünümü",
      items: "Eşyalar",
      all: "Tümü",
      buffs: "Bufflar",
      skills: "Yetenekler",
      noIconsSearch: "Simge bulunamadı. Aramayı veya sekmeyi kontrol et.",
      noIconsFolder: "Bu klasörde simge yok.",
      noIcon: "Simge yok",
      modalTitle: "Simge seç",
      modalSub: "icons klasöründeki buff, eşya, yetenekler",
      clearIcon: "Simge yok",
      searchPlaceholder: "Buff adı ara...",
    },
    cn: {
      title: "冷却计时器",
      allActive: "全部激活",
      expireAll: "全部过期",
      add: "+",
      overlayPos: "覆盖层位置",
      overlayHint: "相对左上角的百分比。列数控制宽度。",
      overlayHide: "隐藏覆盖层",
      posX: "X (%)",
      posY: "Y (%)",
      icon: "图标",
      columns: "列数",
      reset: "重置",
      badgeCountSuffix: "激活",
      emptyList: "暂无计时器。点击 + 添加。",
      active: "有效",
      pickIcon: "选择图标",
      iconLabel: "图标",
      timerDefault: "计时器",
      timerName: "计时器名称",
      expand: "展开",
      collapse: "折叠",
      delete: "删除",
      hotkey: "快捷键",
      recordHotkey: "按下按键...",
      target: "目标",
      targetMain: "主界面",
      targetSupport: "辅助视图",
      items: "物品",
      all: "全部",
      buffs: "增益",
      skills: "技能",
      noIconsSearch: "未找到图标。检查搜索或标签。",
      noIconsFolder: "此文件夹中没有图标。",
      noIcon: "无图标",
      modalTitle: "选择图标",
      modalSub: "来自 icons 文件夹的增益、物品、技能",
      clearIcon: "无图标",
      searchPlaceholder: "搜索增益名称...",
    },
    jp: {
      title: "CDタイマー",
      allActive: "すべて有効",
      expireAll: "すべて期限切れ",
      add: "+",
      overlayPos: "オーバーレイ位置",
      overlayHint: "左上からの割合（%）。列数で幅を調整。",
      overlayHide: "オーバーレイを隠す",
      posX: "X (%)",
      posY: "Y (%)",
      icon: "アイコン",
      columns: "列",
      reset: "リセット",
      badgeCountSuffix: "有効",
      emptyList: "タイマーがありません。＋で追加。",
      active: "有効",
      pickIcon: "アイコンを選択",
      iconLabel: "アイコン",
      timerDefault: "タイマー",
      timerName: "タイマー名",
      expand: "展開",
      collapse: "折りたたむ",
      delete: "削除",
      hotkey: "ホットキー",
      recordHotkey: "キーを押してください...",
      target: "ターゲット",
      targetMain: "メイン",
      targetSupport: "サポート表示",
      items: "アイテム",
      all: "すべて",
      buffs: "バフ",
      skills: "スキル",
      noIconsSearch: "アイコンが見つかりません。検索またはタブを確認。",
      noIconsFolder: "このフォルダーにアイコンがありません。",
      noIcon: "アイコンなし",
      modalTitle: "アイコンを選択",
      modalSub: "icons フォルダーのバフ・アイテム・スキル",
      clearIcon: "アイコンなし",
      searchPlaceholder: "バフ名で検索...",
    },
  };

  const L = translations[locale] || translations.en;
  const fmt = (s, params) => (s || "").replace(/\{(\w+)\}/g, (_m, k) => (params && k in params ? String(params[k]) : ""));

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

  function applyStaticTranslations() {
    const titleEl = document.querySelector(".panel-header .title span:last-child");
    if (titleEl) titleEl.textContent = L.title;
    if (badgeCountEl) badgeCountEl.textContent = `0/0 ${L.badgeCountSuffix}`;
    const allActiveLabel = document.querySelector(".checkbox.all-active span");
    if (allActiveLabel) allActiveLabel.textContent = L.allActive;
    if (expireAllBtn) expireAllBtn.textContent = L.expireAll;
    if (addBtn) addBtn.textContent = L.add;

    const overlayLabel = document.querySelector(".overlay-text .label");
    if (overlayLabel) overlayLabel.textContent = L.overlayPos;
    const overlayHint = document.querySelector(".overlay-text .muted");
    if (overlayHint) overlayHint.textContent = L.overlayHint;
    const overlayHideLabel = document.querySelector("#overlayHideToggle")?.parentElement?.querySelector("span");
    if (overlayHideLabel) overlayHideLabel.textContent = L.overlayHide;

    const posXLabel = document.getElementById("overlayPosX")?.parentElement?.querySelector("span");
    if (posXLabel) posXLabel.textContent = L.posX;
    const posYLabel = document.getElementById("overlayPosY")?.parentElement?.querySelector("span");
    if (posYLabel) posYLabel.textContent = L.posY;
    const iconSizeLabel = document.getElementById("iconSize")?.parentElement?.querySelector("span");
    if (iconSizeLabel) iconSizeLabel.textContent = L.icon;
    const colsLabel = document.getElementById("overlayColumns")?.parentElement?.querySelector("span");
    if (colsLabel) colsLabel.textContent = L.columns;
    if (overlayResetBtn) overlayResetBtn.textContent = L.reset;

    const modalTitle = document.querySelector(".modal-title");
    if (modalTitle) modalTitle.textContent = L.modalTitle;
    const modalSub = document.querySelector(".modal-sub");
    if (modalSub) modalSub.textContent = L.modalSub;
    if (clearIconBtn) clearIconBtn.textContent = L.clearIcon;
    if (iconSearchInput) iconSearchInput.placeholder = L.searchPlaceholder;
  }

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

  async function ipcInvoke(channel, ...args) {
    if (window.plugin?.ipc?.invoke) return window.plugin.ipc.invoke(channel, ...args);
    if (window.parent?.invokePluginChannel && window.__pluginId) {
      return window.parent.invokePluginChannel(window.__pluginId, channel, ...args);
    }
    throw new Error("IPC unavailable");
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
    const data = unwrap(await ipcInvoke("badge:list"));
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
      const timers = unwrap(await ipcInvoke("timer:state"));
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
    badgeCountEl.textContent = `${active}/${total || 0} ${L.badgeCountSuffix}`;
  }

  async function createBadge() {
    try {
      await ipcInvoke("badge:create");
      await loadState();
    } catch (err) {
      console.error("[cd-timer] badge:create failed", err);
    }
  }

  async function updateBadge(id, updates) {
    try {
      await ipcInvoke("badge:update", id, updates);
      await loadState();
    } catch (err) {
      console.error("[cd-timer] badge:update failed", err);
    }
  }

  async function deleteBadge(id) {
    try {
      await ipcInvoke("badge:delete", id);
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
      empty.textContent = L.emptyList;
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
      checkboxWrap.append(checkbox, document.createTextNode(L.active));

      const iconBtn = document.createElement("button");
      iconBtn.className = "icon-btn";
      iconBtn.title = L.pickIcon;
      const iconSrc = badge.iconDataUrl || badge.iconUrl || badge.iconPath;
      if (iconSrc) {
        const img = document.createElement("img");
        img.src = iconSrc;
        img.alt = L.iconLabel;
        iconBtn.appendChild(img);
      } else {
        iconBtn.textContent = L.iconLabel;
      }
      iconBtn.addEventListener("click", () => openIconPicker(badge.id));

      const nameInput = document.createElement("input");
      nameInput.className = "name-input";
      nameInput.value = badge.name || L.timerDefault;
      nameInput.placeholder = L.timerName;
      nameInput.addEventListener("change", () => {
        updateBadge(badge.id, { name: nameInput.value });
      });

      const collapseBtn = document.createElement("button");
      collapseBtn.className = "collapse-btn";
      collapseBtn.title = isCollapsed ? L.expand : L.collapse;
      collapseBtn.textContent = isCollapsed ? "+" : "-";
      collapseBtn.addEventListener("click", async () => {
        const next = !isCollapsed;
        collapsed.set(badge.id, next);
        renderBadges();
        try {
          await ipcInvoke("collapse:set", badge.id, next);
        } catch (err) {
          console.error("[cd-timer] collapse:set failed", err);
        }
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.textContent = "X";
      deleteBtn.title = L.delete;
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
      hotkeyLabel.textContent = L.hotkey;
      const hotkeyBtn = document.createElement("button");
      hotkeyBtn.className = "hotkey-btn";
      hotkeyBtn.textContent = badge.hotkey || L.recordHotkey;
      hotkeyBtn.addEventListener("click", () => startHotkeyCapture(badge.id, hotkeyBtn));

      hotkeyRow.append(hotkeyLabel, hotkeyBtn);

      // Target row
      const targetRow = document.createElement("div");
      targetRow.className = "row target-row";
      const targetLabel = document.createElement("div");
      targetLabel.className = "hint";
      targetLabel.textContent = L.target;

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

      const mainRadio = createRadio("main", L.targetMain);
      const supportRadio = createRadio("support", L.targetSupport);

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
    btn.textContent = L.recordHotkey;
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
      const result = unwrap(await ipcInvoke("icons:list"));
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
      { id: "items", label: L.items },
      { id: "all", label: L.all },
      { id: "buffs", label: L.buffs },
      { id: "skills", label: L.skills },
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
        ? L.noIconsSearch
        : L.noIconsFolder;
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
          ph.textContent = L.noIcon;
          tile.insertBefore(ph, tile.firstChild);
        });
        tile.appendChild(img);
      } else {
        const ph = document.createElement("div");
        ph.className = "icon-missing";
        ph.textContent = L.noIcon;
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
      const overlay = unwrap(await ipcInvoke("overlay:update", updates));
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
      await ipcInvoke("badge:expireall");
      await loadState();
    } catch (err) {
      console.error("[cd-timer] badge:expireall failed", err);
    }
  }

  async function setAllActive(enabled) {
    try {
      await ipcInvoke("badge:enableall", !!enabled);
      await loadState();
    } catch (err) {
      console.error("[cd-timer] badge:enableall failed", err);
    }
  }

  async function init() {
    applyStaticTranslations();
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


/**
 * Killfeed Plugin - Sidepanel UI Script
 */

(function() {
  'use strict';

  // Localization --------------------------------------------------------------
  function detectLocale() {
    try {
      const qs = new URLSearchParams(window.location.search || "");
      const fromQuery = qs.get("locale");
      const fromAttr = document.documentElement?.lang;
      const raw = (window.__pluginLocale || fromQuery || fromAttr || navigator.language || "en").slice(0, 2).toLowerCase();
      return raw === "zh" ? "cn"
        : raw === "ja" ? "jp"
        : raw;
    } catch (_e) {
      return "en";
    }
  }
  const locale = detectLocale();

  const translations = {
    en: {
      title: "Killfeed",
      selectProfile: "Select Profile...",
      defaultProfile: "Default Profile",
      rows: "Rows",
      scale: "Overlay size",
      scaleHint: "0.6x - 1.6x",
      character: "Character",
      charName: "Character name",
      charPlaceholder: "Enter character name",
      charSaved: "Saved",
      charNotSaved: "Not saved yet",
      charLoadError: "Could not load character name",
      charSaveError: "Save failed",
      badgeVisibility: "Badge visibility",
      monsters: "Monster tracking",
      monstersEmpty: "No monsters yet",
      sessionNoData: "No data",
      sessionInfo: "Session: {duration} | {kills} kills",
      resetSession: "Reset Session",
      hideAll: "Hide All",
      showAll: "Show All",
      rowsInputMin: "Rows",
      badgesAll: "All",
      badgeOn: "On",
      badgeOff: "Off",
      badgeMixed: "Mixed",
      profileBound: "Select Profile...",
      badges: {
        killsSession: "Kills (Session)",
        killsTotal: "Kills (Total)",
        killsPerHour: "Kills/Hour",
        killsPerMin: "Kills/Min",
        expLastKill: "EXP Last Kill",
        expTotal: "EXP Today",
        expPerHour: "EXP/Hour",
        expPerMin: "EXP/Min",
        currentExp: "EXP Current",
        killsToLevel: "Kills to Level",
        sessionDuration: "Session Time",
        expSession: "EXP (Session)",
        avgTimePerKill: "Avg Time/Kill",
        timeSinceLastKill: "Since Last Kill",
        rmExp: "RM EXP",
        last3Kills: "Last 3 Kills",
        resetSession: "Reset Session",
      },
      ranks: {
        normal: "Normal",
        giant: "Giants",
        violet: "Violets",
        boss: "Bosses",
        unknown: "Unknown",
      },
      killHistory: {
        open: "Kills",
        title: "{rank} Kills",
        loading: "Loading...",
        empty: "No kills for this rank",
        close: "Close",
        colTime: "Time",
        colMonster: "Monster",
        colExp: "EXP",
        colAction: "Action",
        delete: "Delete",
        confirmAction: "Confirm",
        deleteFailed: "Kill could not be deleted",
      },
    },
    de: {
      title: "Killfeed",
      selectProfile: "Profil wählen...",
      defaultProfile: "Standardprofil",
      rows: "Zeilen",
      scale: "Overlay-Größe",
      scaleHint: "0,6x - 1,6x",
      character: "Charakter",
      charName: "Charaktername",
      charPlaceholder: "Charaktername eingeben",
      charSaved: "Gespeichert",
      charNotSaved: "Noch nicht gespeichert",
      charLoadError: "Charaktername konnte nicht geladen werden",
      charSaveError: "Speichern fehlgeschlagen",
      badgeVisibility: "Badge-Sichtbarkeit",
      monsters: "Monster-Tracking",
      monstersEmpty: "Noch keine Monster",
      sessionNoData: "Keine Daten",
      sessionInfo: "Session: {duration} | {kills} Kills",
      resetSession: "Session zurücksetzen",
      hideAll: "Alles ausblenden",
      showAll: "Alles einblenden",
      rowsInputMin: "Zeilen",
      badgesAll: "Alle",
      badgeOn: "An",
      badgeOff: "Aus",
      badgeMixed: "Gemischt",
      profileBound: "Profil wählen...",
      badges: {
        killsSession: "Kills (Session)",
        killsTotal: "Kills (Total)",
        killsPerHour: "Kills/Stunde",
        killsPerMin: "Kills/Min",
        expLastKill: "EXP letzter Kill",
        expTotal: "EXP heute",
        expPerHour: "EXP/Stunde",
        expPerMin: "EXP/Min",
        currentExp: "Aktuelle EXP",
        killsToLevel: "Kills bis Level",
        sessionDuration: "Session-Zeit",
        expSession: "EXP (Session)",
        avgTimePerKill: "Ø Zeit/Kill",
        timeSinceLastKill: "Seit letztem Kill",
        rmExp: "RM EXP",
        last3Kills: "Letzte 3 Kills",
        resetSession: "Session reset",
      },
      ranks: {
        normal: "Normal",
        giant: "Riesen",
        violet: "Violette",
        boss: "Bosse",
        unknown: "Unbekannt",
      },
      killHistory: {
        open: "Kills",
        title: "{rank} Kills",
        loading: "Lade...",
        empty: "Keine Kills fuer diesen Rang",
        close: "Schliessen",
        colTime: "Zeit",
        colMonster: "Monster",
        colExp: "EXP",
        colAction: "Aktion",
        delete: "Loeschen",
        confirmAction: "Sicher",
        deleteFailed: "Kill konnte nicht geloescht werden",
      },
    },
    pl: {
      title: "Killfeed",
      selectProfile: "Wybierz profil...",
      defaultProfile: "Domyślny profil",
      rows: "Wiersze",
      scale: "Rozmiar overlay",
      scaleHint: "0.6x - 1.6x",
      character: "Postać",
      charName: "Nazwa postaci",
      charPlaceholder: "Wpisz nazwę postaci",
      charSaved: "Zapisano",
      charNotSaved: "Jeszcze nie zapisano",
      charLoadError: "Nie udało się wczytać nazwy postaci",
      charSaveError: "Nie udało się zapisać",
      badgeVisibility: "Widoczność odznak",
      monsters: "Śledzenie potworów",
      monstersEmpty: "Brak potworów",
      sessionNoData: "Brak danych",
      sessionInfo: "Sesja: {duration} | {kills} zabójstw",
      resetSession: "Resetuj sesję",
      hideAll: "Ukryj wszystkie",
      showAll: "Pokaż wszystkie",
      rowsInputMin: "Wiersze",
      badgesAll: "Wszystkie",
      badgeOn: "Wł.",
      badgeOff: "Wył.",
      badgeMixed: "Mieszane",
      profileBound: "Wybierz profil...",
      badges: {
        killsSession: "Zabójstwa (sesja)",
        killsTotal: "Zabójstwa (łącznie)",
        killsPerHour: "Zab./godz.",
        killsPerMin: "Zab./min",
        expLastKill: "EXP ostatni kill",
        expTotal: "EXP dziś",
        expPerHour: "EXP/godz.",
        expPerMin: "EXP/min",
        currentExp: "Bieżące EXP",
        killsToLevel: "Zabójstwa do poziomu",
        sessionDuration: "Czas sesji",
        expSession: "EXP (sesja)",
        avgTimePerKill: "Śr. czas/kill",
        timeSinceLastKill: "Od ostatniego kill",
        rmExp: "RM EXP",
        last3Kills: "Ostatnie 3 kille",
        resetSession: "Reset sesji",
      },
      ranks: {
        normal: "Normalne",
        giant: "Giganty",
        violet: "Fiolety",
        boss: "Bossy",
        unknown: "Nieznane",
      },
    },
    fr: {
      title: "Killfeed",
      selectProfile: "Sélectionner un profil...",
      defaultProfile: "Profil par défaut",
      rows: "Lignes",
      scale: "Taille de l'overlay",
      scaleHint: "0.6x - 1.6x",
      character: "Personnage",
      charName: "Nom du personnage",
      charPlaceholder: "Saisir le nom",
      charSaved: "Enregistré",
      charNotSaved: "Pas encore enregistré",
      charLoadError: "Impossible de charger le nom du personnage",
      charSaveError: "Échec de l'enregistrement",
      badgeVisibility: "Visibilité des badges",
      monsters: "Suivi des monstres",
      monstersEmpty: "Aucun monstre",
      sessionNoData: "Aucune donnée",
      sessionInfo: "Session : {duration} | {kills} kills",
      resetSession: "Réinitialiser la session",
      hideAll: "Tout masquer",
      showAll: "Tout afficher",
      rowsInputMin: "Lignes",
      badgesAll: "Tous",
      badgeOn: "Activé",
      badgeOff: "Désactivé",
      badgeMixed: "Mixte",
      profileBound: "Sélectionner un profil...",
      badges: {
        killsSession: "Kills (Session)",
        killsTotal: "Kills (Total)",
        killsPerHour: "Kills/Heure",
        killsPerMin: "Kills/Min",
        expLastKill: "EXP dernier kill",
        expTotal: "EXP aujourd'hui",
        expPerHour: "EXP/Heure",
        expPerMin: "EXP/Min",
        currentExp: "EXP actuelle",
        killsToLevel: "Kills pour niveau",
        sessionDuration: "Temps de session",
        expSession: "EXP (Session)",
        avgTimePerKill: "Temps moy./kill",
        timeSinceLastKill: "Depuis le dernier kill",
        rmExp: "RM EXP",
        last3Kills: "3 derniers kills",
        resetSession: "Reset session",
      },
      ranks: {
        normal: "Normaux",
        giant: "Géants",
        violet: "Violets",
        boss: "Boss",
        unknown: "Inconnu",
      },
    },
    ru: {
      title: "Killfeed",
      selectProfile: "Выберите профиль...",
      defaultProfile: "Профиль по умолчанию",
      rows: "Ряды",
      scale: "Размер оверлея",
      scaleHint: "0.6x - 1.6x",
      character: "Персонаж",
      charName: "Имя персонажа",
      charPlaceholder: "Введите имя персонажа",
      charSaved: "Сохранено",
      charNotSaved: "Еще не сохранено",
      charLoadError: "Не удалось загрузить имя персонажа",
      charSaveError: "Ошибка сохранения",
      badgeVisibility: "Видимость бейджей",
      monsters: "Отслеживание монстров",
      monstersEmpty: "Монстров пока нет",
      sessionNoData: "Нет данных",
      sessionInfo: "Сессия: {duration} | {kills} убийств",
      resetSession: "Сбросить сессию",
      hideAll: "Скрыть все",
      showAll: "Показать все",
      rowsInputMin: "Ряды",
      badgesAll: "Все",
      badgeOn: "Вкл",
      badgeOff: "Выкл",
      badgeMixed: "Смешано",
      profileBound: "Выберите профиль...",
      badges: {
        killsSession: "Убийства (сессия)",
        killsTotal: "Убийства (всего)",
        killsPerHour: "Убийства/час",
        killsPerMin: "Убийства/мин",
        expLastKill: "EXP за последний килл",
        expTotal: "EXP сегодня",
        expPerHour: "EXP/час",
        expPerMin: "EXP/мин",
        currentExp: "Текущая EXP",
        killsToLevel: "Убийств до уровня",
        sessionDuration: "Время сессии",
        expSession: "EXP (сессия)",
        avgTimePerKill: "Сред. время/килл",
        timeSinceLastKill: "С момента последнего килла",
        rmExp: "RM EXP",
        last3Kills: "Последние 3 килла",
        resetSession: "Сбросить сессию",
      },
      ranks: {
        normal: "Обычные",
        giant: "Гиганты",
        violet: "Фиолетовые",
        boss: "Боссы",
        unknown: "Неизв.",
      },
    },
    tr: {
      title: "Killfeed",
      selectProfile: "Profil seç...",
      defaultProfile: "Varsayılan profil",
      rows: "Satır",
      scale: "Overlay boyutu",
      scaleHint: "0.6x - 1.6x",
      character: "Karakter",
      charName: "Karakter adı",
      charPlaceholder: "Karakter adını gir",
      charSaved: "Kaydedildi",
      charNotSaved: "Henüz kaydedilmedi",
      charLoadError: "Karakter adı yüklenemedi",
      charSaveError: "Kaydetme başarısız",
      badgeVisibility: "Rozet görünürlüğü",
      monsters: "Canavar takibi",
      monstersEmpty: "Henüz canavar yok",
      sessionNoData: "Veri yok",
      sessionInfo: "Oturum: {duration} | {kills} öldürme",
      resetSession: "Oturumu sıfırla",
      hideAll: "Hepsini gizle",
      showAll: "Hepsini göster",
      rowsInputMin: "Satır",
      badgesAll: "Hepsi",
      badgeOn: "Açık",
      badgeOff: "Kapalı",
      badgeMixed: "Karışık",
      profileBound: "Profil seç...",
      badges: {
        killsSession: "Öldürme (Oturum)",
        killsTotal: "Öldürme (Toplam)",
        killsPerHour: "Öldürme/Saat",
        killsPerMin: "Öldürme/Dak",
        expLastKill: "Son öldürme EXP",
        expTotal: "EXP bugün",
        expPerHour: "EXP/Saat",
        expPerMin: "EXP/Dak",
        currentExp: "Güncel EXP",
        killsToLevel: "Seviyeye kalan öldürme",
        sessionDuration: "Oturum süresi",
        expSession: "EXP (Oturum)",
        avgTimePerKill: "Ort. süre/öldürme",
        timeSinceLastKill: "Son öldürmeden beri",
        rmExp: "RM EXP",
        last3Kills: "Son 3 öldürme",
        resetSession: "Oturum reset",
      },
      ranks: {
        normal: "Normal",
        giant: "Devler",
        violet: "Morlar",
        boss: "Bosslar",
        unknown: "Bilinmiyor",
      },
    },
    cn: {
      title: "击杀记录",
      selectProfile: "选择配置...",
      defaultProfile: "默认配置",
      rows: "行数",
      scale: "覆盖层大小",
      scaleHint: "0.6x - 1.6x",
      character: "角色",
      charName: "角色名",
      charPlaceholder: "输入角色名",
      charSaved: "已保存",
      charNotSaved: "尚未保存",
      charLoadError: "无法加载角色名",
      charSaveError: "保存失败",
      badgeVisibility: "徽章可见性",
      monsters: "怪物追踪",
      monstersEmpty: "暂无怪物",
      sessionNoData: "无数据",
      sessionInfo: "会话: {duration} | {kills} 次击杀",
      resetSession: "重置会话",
      hideAll: "全部隐藏",
      showAll: "全部显示",
      rowsInputMin: "行数",
      badgesAll: "全部",
      badgeOn: "开",
      badgeOff: "关",
      badgeMixed: "混合",
      profileBound: "选择配置...",
      badges: {
        killsSession: "击杀（本次）",
        killsTotal: "击杀（总计）",
        killsPerHour: "击杀/小时",
        killsPerMin: "击杀/分钟",
        expLastKill: "上次击杀经验",
        expTotal: "今日经验",
        expPerHour: "经验/小时",
        expPerMin: "经验/分钟",
        currentExp: "当前经验",
        killsToLevel: "升级所需击杀",
        sessionDuration: "会话时长",
        expSession: "经验（本次）",
        avgTimePerKill: "平均时间/击杀",
        timeSinceLastKill: "距上次击杀",
        rmExp: "RM 经验",
        last3Kills: "最近 3 次击杀",
        resetSession: "重置会话",
      },
      ranks: {
        normal: "普通",
        giant: "巨人",
        violet: "紫色",
        boss: "首领",
        unknown: "未知",
      },
    },
    jp: {
      title: "キルフィード",
      selectProfile: "プロフィールを選択...",
      defaultProfile: "デフォルトプロフィール",
      rows: "行数",
      scale: "オーバーレイサイズ",
      scaleHint: "0.6x - 1.6x",
      character: "キャラクター",
      charName: "キャラクター名",
      charPlaceholder: "キャラ名を入力",
      charSaved: "保存しました",
      charNotSaved: "まだ保存されていません",
      charLoadError: "キャラ名を読み込めませんでした",
      charSaveError: "保存に失敗しました",
      badgeVisibility: "バッジ表示",
      monsters: "モンスター追跡",
      monstersEmpty: "モンスターがまだありません",
      sessionNoData: "データなし",
      sessionInfo: "セッション: {duration} | {kills} キル",
      resetSession: "セッションをリセット",
      hideAll: "すべて非表示",
      showAll: "すべて表示",
      rowsInputMin: "行数",
      badgesAll: "すべて",
      badgeOn: "オン",
      badgeOff: "オフ",
      badgeMixed: "混在",
      profileBound: "プロフィールを選択...",
      badges: {
        killsSession: "キル（セッション）",
        killsTotal: "キル（合計）",
        killsPerHour: "キル/時",
        killsPerMin: "キル/分",
        expLastKill: "最後のキル EXP",
        expTotal: "今日の EXP",
        expPerHour: "EXP/時",
        expPerMin: "EXP/分",
        currentExp: "現在の EXP",
        killsToLevel: "レベルまでのキル数",
        sessionDuration: "セッション時間",
        expSession: "EXP（セッション）",
        avgTimePerKill: "平均時間/キル",
        timeSinceLastKill: "最後のキルから",
        rmExp: "RM EXP",
        last3Kills: "直近3キル",
        resetSession: "セッションリセット",
      },
      ranks: {
        normal: "ノーマル",
        giant: "ジャイアント",
        violet: "バイオレット",
        boss: "ボス",
        unknown: "不明",
      },
    },
  };

  const STR = translations[locale] || translations.en;
  const tBadge = (key) => STR.badges?.[key] || translations.en.badges[key] || key;
  const tRank = (key) => STR.ranks?.[key] || translations.en.ranks[key] || key;
  const tHistory = (key) => STR.killHistory?.[key] || translations.en.killHistory?.[key] || key;
  const fmt = (s, params) => (s || "").replace(/\{(\w+)\}/g, (_m, k) => (params && k in params ? String(params[k]) : ""));

  function unwrap(result) {
    if (result && typeof result === 'object' && 'ok' in result) {
      if (result.ok) return result.data;
      throw new Error(result.error || 'IPC call failed');
    }
    return result;
  }

  async function ipcInvoke(channel, ...args) {
    if (window.plugin?.ipc?.invoke) return window.plugin.ipc.invoke(channel, ...args);
    if (window.parent?.invokePluginChannel && window.__pluginId) {
      return window.parent.invokePluginChannel(window.__pluginId, channel, ...args);
    }
    throw new Error('IPC unavailable');
  }

  // Schema constants (mirrored from shared/schema.js for browser)
  const BADGE_KEYS = [
    'killsSession', 'killsTotal', 'killsPerHour', 'killsPerMin',
    'expLastKill', 'expTotal', 'expPerHour', 'expPerMin',
    'killsToLevel', 'sessionDuration', 'expSession', 'currentExp', 'rmExp',
    'avgTimePerKill', 'timeSinceLastKill', 'last3Kills',
    'resetSession'
  ];

  const BADGE_LABELS = {
    killsSession: tBadge('killsSession'),
    killsTotal: tBadge('killsTotal'),
    killsPerHour: tBadge('killsPerHour'),
    killsPerMin: tBadge('killsPerMin'),
    expLastKill: tBadge('expLastKill'),
    expTotal: tBadge('expTotal'),
    expPerHour: tBadge('expPerHour'),
    expPerMin: tBadge('expPerMin'),
    currentExp: tBadge('currentExp'),
    killsToLevel: tBadge('killsToLevel'),
    sessionDuration: tBadge('sessionDuration'),
    expSession: tBadge('expSession'),
    avgTimePerKill: tBadge('avgTimePerKill'),
    timeSinceLastKill: tBadge('timeSinceLastKill'),
    rmExp: tBadge('rmExp'),
    last3Kills: tBadge('last3Kills'),
    resetSession: tBadge('resetSession'),
  };

  const MONSTER_RANKS = {
    normal: tRank('normal'),
    giant: tRank('giant'),
    violet: tRank('violet'),
    boss: tRank('boss'),
    unknown: tRank('unknown'),
  };

  // DOM elements
  const profileSelector = document.getElementById('profileSelector');
  const badgeListEl = document.getElementById('badgeList');
  const monstersContainer = document.getElementById('monstersContainer');
  const toggleAllBtn = document.getElementById('toggleAllBtn');
  const resetSessionBtn = document.getElementById('resetSessionBtn');
  const rowsInput = document.getElementById('rowsInput');
  const sessionInfoEl = document.getElementById('sessionInfo');
  const scaleInput = document.getElementById('scaleInput');
  const scaleValue = document.getElementById('scaleValue');
  const charNameInput = document.getElementById('charNameInput');
  const charNameStatus = document.getElementById('charNameStatus');
  const killHistoryModal = document.getElementById('killHistoryModal');
  const killHistoryTitle = document.getElementById('killHistoryTitle');
  const killHistoryCloseBtn = document.getElementById('killHistoryCloseBtn');
  const killHistoryColumns = document.getElementById('killHistoryColumns');
  const killHistoryStatus = document.getElementById('killHistoryStatus');
  const killHistoryList = document.getElementById('killHistoryList');

  // State
  let currentProfileId = null;
  let currentStats = null;
  let currentLayout = null;
  let charNameDebounce = null;
  let pollSuppressedUntil = 0;
  const accordionUserState = new Map(); // rank -> boolean (user-toggled open/closed)
  let canonicalRefreshInFlight = false;
  let canonicalRefreshQueued = false;
  let canonicalRefreshTimer = null;
  let killHistoryRank = null;
  let killHistoryLoading = false;
  let armedDeleteButton = null;
  let armedDeleteTimer = null;

  function asFiniteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function getStatsTimestamp(stats) {
    if (!stats || typeof stats !== 'object') return null;
    return asFiniteNumber(stats.lastUpdateTime);
  }

  function getMonsterTypeCount(stats) {
    const monstersByRank = stats && typeof stats === 'object' ? stats.monstersByRank : null;
    if (!monstersByRank || typeof monstersByRank !== 'object') return 0;
    return ['normal', 'giant', 'violet', 'boss', 'unknown']
      .reduce((sum, rank) => sum + (Array.isArray(monstersByRank[rank]) ? monstersByRank[rank].length : 0), 0);
  }

  function normalizeIncomingStats(nextStats) {
    if (!nextStats || typeof nextStats !== 'object') {
      return currentStats;
    }

    const prevStats = currentStats;
    if (prevStats && typeof prevStats === 'object') {
      const prevTs = getStatsTimestamp(prevStats);
      const nextTs = getStatsTimestamp(nextStats);
      if (prevTs !== null && nextTs !== null && nextTs < prevTs) {
        const prevKillsTotal = asFiniteNumber(prevStats.killsTotal) ?? 0;
        const nextKillsTotal = asFiniteNumber(nextStats.killsTotal) ?? 0;
        const prevKillsSession = asFiniteNumber(prevStats.killsSession) ?? 0;
        const nextKillsSession = asFiniteNumber(nextStats.killsSession) ?? 0;
        const prevExpTotal = asFiniteNumber(prevStats.expTotal) ?? 0;
        const nextExpTotal = asFiniteNumber(nextStats.expTotal) ?? 0;
        const prevMonsterTypes = getMonsterTypeCount(prevStats);
        const nextMonsterTypes = getMonsterTypeCount(nextStats);
        const hasForwardProgress = (
          nextKillsTotal > prevKillsTotal ||
          nextKillsSession > prevKillsSession ||
          nextExpTotal > prevExpTotal ||
          nextMonsterTypes > prevMonsterTypes
        );
        if (!hasForwardProgress) {
          return prevStats;
        }
      }

      const prevMonsterTypes = getMonsterTypeCount(prevStats);
      const nextMonsterTypes = getMonsterTypeCount(nextStats);
      if (prevMonsterTypes > 0 && nextMonsterTypes === 0) {
        const prevKillsTotal = asFiniteNumber(prevStats.killsTotal) ?? 0;
        const nextKillsTotal = asFiniteNumber(nextStats.killsTotal) ?? 0;
        const prevKillsSession = asFiniteNumber(prevStats.killsSession) ?? 0;
        const nextKillsSession = asFiniteNumber(nextStats.killsSession) ?? 0;
        const killsDidNotDrop = nextKillsTotal >= prevKillsTotal && nextKillsSession >= prevKillsSession;
        if (killsDidNotDrop) {
          return {
            ...nextStats,
            monstersByRank: prevStats.monstersByRank
          };
        }
      }
    }

    return nextStats;
  }

  function applyIncomingState(data) {
    const normalizedStats = normalizeIncomingStats(data?.stats);
    if (normalizedStats) {
      currentStats = normalizedStats;
    }
    if (data?.layout) {
      currentLayout = data.layout;
    }
    if (typeof data?.charName === 'string' && charNameInput) {
      charNameInput.value = data.charName;
      const statusText = data.charName ? STR.charSaved : STR.charNotSaved;
      setCharStatus(statusText, data.charName ? 'ok' : 'info');
    }
  }

  function applyStaticTranslations() {
    document.title = STR.title;
    const headerTitle = document.querySelector(".panel-header h1");
    if (headerTitle) headerTitle.textContent = STR.title;
    if (toggleAllBtn) toggleAllBtn.textContent = STR.hideAll;
    if (resetSessionBtn) resetSessionBtn.textContent = STR.resetSession;
    if (sessionInfoEl) sessionInfoEl.textContent = STR.sessionNoData;

    const profilePlaceholder = profileSelector?.querySelector("option[value='']");
    if (profilePlaceholder) profilePlaceholder.textContent = STR.selectProfile;

    const rowsLabel = document.querySelector("label[for='rowsInput']");
    if (rowsLabel) rowsLabel.textContent = STR.rows;
    const scaleLabel = document.querySelector(".scale-label");
    if (scaleLabel) scaleLabel.textContent = STR.scale;
    const scaleHint = document.querySelector(".scale-hint");
    if (scaleHint) scaleHint.textContent = STR.scaleHint;

    const charSectionTitle = document.querySelector(".scroll-section .section-title");
    if (charSectionTitle) charSectionTitle.textContent = STR.character;
    const charNameLabel = document.querySelector("label[for='charNameInput']");
    if (charNameLabel) charNameLabel.textContent = STR.charName;
    if (charNameInput) charNameInput.placeholder = STR.charPlaceholder;
    if (charNameStatus) charNameStatus.textContent = STR.charNotSaved;

    const sections = document.querySelectorAll(".scroll-section .section-title");
    if (sections[1]) sections[1].textContent = STR.badgeVisibility;
    if (sections[2]) sections[2].textContent = STR.monsters;

    if (killHistoryCloseBtn) {
      killHistoryCloseBtn.setAttribute('aria-label', tHistory('close'));
      killHistoryCloseBtn.title = tHistory('close');
    }
    renderKillHistoryColumns();
    if (killHistoryRank && killHistoryTitle) {
      killHistoryTitle.textContent = fmt(tHistory('title'), { rank: MONSTER_RANKS[killHistoryRank] || killHistoryRank });
    }
  }

  /**
   * Format value for display
   */
  function formatValue(key, stats) {
    if (!stats) return '-';

    switch (key) {
      case 'killsSession':
      case 'killsTotal':
      case 'killsToLevel':
        return stats[key]?.toLocaleString() || '0';

      case 'killsPerHour':
        return (stats[key] || 0).toFixed(1);

      case 'killsPerMin':
        return (stats[key] || 0).toFixed(2);

      case 'expLastKill':
        return stats.expLastKillFormatted || '0.0000%';

      case 'expTotal':
      case 'expSession':
      case 'expPerHour':
      case 'expPerMin':
      case 'currentExp':
        return (stats[key] || 0).toFixed(4) + '%';

      case 'rmExp':
        if (stats.rmExp === null || stats.rmExp === undefined || stats.rmExp === '') return '-';
        if (typeof stats.rmExp === 'number') return stats.rmExp.toFixed(4) + '%';
        return String(stats.rmExp);

      case 'sessionDuration':
        return stats.sessionDurationFormatted || '0:00';

      case 'avgTimePerKill':
        return stats.avgTimePerKillFormatted || '0:00';

      case 'timeSinceLastKill':
        return stats.timeSinceLastKillFormatted || '-';

      case 'last3Kills':
        if (!stats.last3Kills || stats.last3Kills.length === 0) return '-';
        return stats.last3Kills.map(k => k.monsterName).join(', ');

      case 'resetSession':
        return STR.badges?.resetSession || translations.en.badges.resetSession || 'Reset';

      default:
        return String(stats[key] || '-');
    }
  }

  /**
   * Render badge visibility list
   */
  function renderBadgeList() {
    const visibility = currentLayout?.visibility || {};
    const allVisible = BADGE_KEYS.every(k => visibility[k] !== false);
    const anyVisible = BADGE_KEYS.some(k => visibility[k] !== false);

    let html = `
      <div class="badge-item">
        <input type="checkbox" id="vis-all" data-key="__all__" ${allVisible ? 'checked' : ''}>
        <label for="vis-all">${STR.badgesAll}</label>
        <span class="badge-value">${allVisible ? STR.badgeOn : anyVisible ? STR.badgeMixed : STR.badgeOff}</span>
      </div>
    `;

    html += BADGE_KEYS.map(key => {
      const isVisible = visibility[key] !== false;
      const value = formatValue(key, currentStats);

      return `
        <div class="badge-item">
          <input type="checkbox" id="vis-${key}" data-key="${key}" ${isVisible ? 'checked' : ''}>
          <label for="vis-${key}">${BADGE_LABELS[key]}</label>
          <span class="badge-value">${value}</span>
        </div>
      `;
    }).join('');

    badgeListEl.innerHTML = html;

    // Add event listeners
    badgeListEl.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const key = e.target.dataset.key;
        const visible = e.target.checked;
        if (key === '__all__') {
          setAllVisibility(visible);
        } else {
          setVisibility(key, visible);
        }
      });
    });

    // Set indeterminate state
    const allCb = document.getElementById('vis-all');
    if (allCb) {
      allCb.indeterminate = !allVisible && anyVisible;
    }
  }

  /**
   * Incrementally update only badge value texts (no DOM rebuild)
   */
  function updateBadgeListValues() {
    const visibility = currentLayout?.visibility || {};
    BADGE_KEYS.forEach(key => {
      const cb = document.getElementById(`vis-${key}`);
      if (cb) {
        const valueEl = cb.closest('.badge-item')?.querySelector('.badge-value');
        if (valueEl) valueEl.textContent = formatValue(key, currentStats);
      }
    });
    // Update "All" row status text
    const allVisible = BADGE_KEYS.every(k => visibility[k] !== false);
    const anyVisible = BADGE_KEYS.some(k => visibility[k] !== false);
    const allEl = document.getElementById('vis-all');
    if (allEl) {
      const valueEl = allEl.closest('.badge-item')?.querySelector('.badge-value');
      if (valueEl) valueEl.textContent = allVisible ? STR.badgeOn : anyVisible ? STR.badgeMixed : STR.badgeOff;
    }
  }

  /**
   * Sync checkbox checked states without rebuilding DOM
   */
  function syncBadgeCheckboxes() {
    const visibility = currentLayout?.visibility || {};
    BADGE_KEYS.forEach(key => {
      const cb = document.getElementById(`vis-${key}`);
      if (cb) cb.checked = visibility[key] !== false;
    });
    const allVisible = BADGE_KEYS.every(k => visibility[k] !== false);
    const anyVisible = BADGE_KEYS.some(k => visibility[k] !== false);
    const allCb = document.getElementById('vis-all');
    if (allCb) {
      allCb.checked = allVisible;
      allCb.indeterminate = !allVisible && anyVisible;
    }
  }

  /**
   * Render monster accordions
   */
  function renderMonsters() {
    const monstersByRank = currentStats?.monstersByRank || {};

    // Debug info - shows current profile and data state
    const totalMonsters = Object.values(monstersByRank).reduce((sum, arr) => sum + (arr?.length || 0), 0);
    const debugInfo = `<div style="font-size:10px;color:#888;padding:2px 4px;">P: ${currentProfileId || 'none'} | M: ${totalMonsters} | ${_debugLastRaw || 'no-poll'}</div>`;

    const ranks = ['normal', 'giant', 'violet', 'boss', 'unknown'];

    const trackerBtnHtml = `<button class="giant-tracker-btn" onclick="openGiantTracker()">Giant Tracker</button>`;

    monstersContainer.innerHTML = debugInfo + trackerBtnHtml + ranks.map(rank => {
      const monsters = monstersByRank[rank] || [];
      const count = monsters.length;
      const isOpen = accordionUserState.has(rank) ? accordionUserState.get(rank) : count > 0;

      const monsterListHtml = monsters.length > 0
        ? monsters.map(m => `
            <div class="monster-item">
              <span class="name" title="${m.name}">${m.name}</span>
              <span class="kill-count">${m.count}</span>
            </div>
          `).join('')
        : `<div class="empty-state">${STR.monstersEmpty}</div>`;

      return `
        <div class="accordion" data-rank="${rank}">
          <div class="accordion-header ${isOpen ? 'open' : ''}" onclick="toggleAccordion('${rank}')">
            <span class="title">
              <span class="rank-${rank}">${MONSTER_RANKS[rank]}</span>
              <span class="count">${count}</span>
            </span>
            <span class="accordion-tools">
              <button type="button" class="accordion-history-btn" onclick="openKillHistory('${rank}', event)">${tHistory('open')}</button>
              <span class="chevron">&#9660;</span>
            </span>
          </div>
          <div class="accordion-content ${isOpen ? 'open' : ''}">
            <div class="monster-list">
              ${monsterListHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatKillHistoryDateTime(entry) {
    if (entry && typeof entry.dateTime === 'string' && entry.dateTime.trim()) {
      return entry.dateTime.trim();
    }
    const ts = Number(entry?.timestamp);
    if (!Number.isFinite(ts)) return '-';
    const d = new Date(ts);
    const datePart = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    return `${datePart} ${timePart}`;
  }

  function formatKillHistoryExp(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    return `${num.toFixed(4)}%`;
  }

  function renderKillHistoryColumns() {
    if (!killHistoryColumns) return;
    killHistoryColumns.innerHTML = `
      <span>${escapeHtml(tHistory('colTime'))}</span>
      <span>${escapeHtml(tHistory('colMonster'))}</span>
      <span style="text-align:right;">${escapeHtml(tHistory('colExp'))}</span>
      <span style="text-align:right;">${escapeHtml(tHistory('colAction'))}</span>
    `;
  }

  function setKillHistoryStatus(text = '', type = '') {
    if (!killHistoryStatus) return;
    killHistoryStatus.textContent = text;
    killHistoryStatus.className = 'kill-history-status';
    if (text && type) {
      killHistoryStatus.classList.add(type);
    }
  }

  function disarmDeleteButton(button) {
    if (!button) return;
    button.dataset.armed = '0';
    button.classList.remove('armed');
    button.textContent = tHistory('delete');
    if (armedDeleteButton === button) {
      armedDeleteButton = null;
    }
    if (armedDeleteTimer) {
      clearTimeout(armedDeleteTimer);
      armedDeleteTimer = null;
    }
  }

  function armDeleteButton(button) {
    if (!button) return;
    if (armedDeleteButton && armedDeleteButton !== button) {
      disarmDeleteButton(armedDeleteButton);
    }
    button.dataset.armed = '1';
    button.classList.add('armed');
    button.textContent = tHistory('confirmAction');
    armedDeleteButton = button;
    if (armedDeleteTimer) {
      clearTimeout(armedDeleteTimer);
    }
    armedDeleteTimer = setTimeout(() => {
      if (armedDeleteButton === button) {
        disarmDeleteButton(button);
      }
    }, 1800);
  }

  function renderKillHistoryRows(rows) {
    if (!killHistoryList) return;
    if (armedDeleteButton) {
      disarmDeleteButton(armedDeleteButton);
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      killHistoryList.innerHTML = `<div class="kill-history-empty">${escapeHtml(tHistory('empty'))}</div>`;
      return;
    }

    killHistoryList.innerHTML = rows.map((row) => `
      <div class="kill-history-row">
        <span class="time">${escapeHtml(formatKillHistoryDateTime(row))}</span>
        <span class="monster" title="${escapeHtml(row.monsterName || '-')}">${escapeHtml(row.monsterName || '-')}</span>
        <span class="exp">${escapeHtml(formatKillHistoryExp(row.deltaExp))}</span>
        <span style="text-align:right;">
          <button
            type="button"
            class="kill-history-delete-btn"
            data-file-date="${escapeHtml(row.fileDate || '')}"
            data-row-index="${Number.isFinite(Number(row.rowIndex)) ? Number(row.rowIndex) : -1}"
            data-signature="${escapeHtml(row.signature || '')}"
          >${escapeHtml(tHistory('delete'))}</button>
        </span>
      </div>
    `).join('');

    killHistoryList.querySelectorAll('.kill-history-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (killHistoryLoading) return;
        if (btn.dataset.armed !== '1') {
          armDeleteButton(btn);
          return;
        }
        disarmDeleteButton(btn);
        const fileDate = btn.getAttribute('data-file-date') || '';
        const rowIndex = Number(btn.getAttribute('data-row-index'));
        const signature = btn.getAttribute('data-signature') || '';
        void deleteHistoryKill({ fileDate, rowIndex, signature });
      });
    });
  }

  function closeKillHistoryModal() {
    killHistoryRank = null;
    if (armedDeleteButton) {
      disarmDeleteButton(armedDeleteButton);
    }
    setKillHistoryStatus('');
    if (killHistoryModal) {
      killHistoryModal.classList.remove('open');
      killHistoryModal.setAttribute('aria-hidden', 'true');
    }
  }

  async function loadKillHistory(rank) {
    if (!killHistoryList) return;
    setKillHistoryStatus('');
    if (!currentProfileId || !rank) {
      killHistoryList.innerHTML = `<div class="kill-history-empty">${escapeHtml(tHistory('empty'))}</div>`;
      return;
    }

    killHistoryLoading = true;
    killHistoryList.innerHTML = `<div class="kill-history-loading">${escapeHtml(tHistory('loading'))}</div>`;
    try {
      const result = unwrap(await ipcInvoke('history:list:kills', currentProfileId, rank));
      const rows = Array.isArray(result?.kills) ? result.kills : [];
      renderKillHistoryRows(rows);
    } catch (err) {
      console.error('Failed to load kill history:', err);
      killHistoryList.innerHTML = `<div class="kill-history-empty">${escapeHtml(tHistory('empty'))}</div>`;
      setKillHistoryStatus(tHistory('deleteFailed'), 'error');
    } finally {
      killHistoryLoading = false;
    }
  }

  async function deleteHistoryKill(payload) {
    if (!currentProfileId) return;
    setKillHistoryStatus('');

    killHistoryLoading = true;
    try {
      const result = unwrap(await ipcInvoke('history:delete:kill', currentProfileId, payload));
      if (!result?.success) {
        throw new Error(result?.error || 'delete-failed');
      }
      await loadKillHistory(killHistoryRank);
      await requestState();
    } catch (err) {
      console.error('Failed to delete history kill:', err);
      setKillHistoryStatus(tHistory('deleteFailed'), 'error');
    } finally {
      killHistoryLoading = false;
    }
  }

  async function openKillHistoryForRank(rank) {
    killHistoryRank = rank;
    if (killHistoryTitle) {
      killHistoryTitle.textContent = fmt(tHistory('title'), { rank: MONSTER_RANKS[rank] || rank });
    }
    renderKillHistoryColumns();
    if (killHistoryModal) {
      killHistoryModal.classList.add('open');
      killHistoryModal.setAttribute('aria-hidden', 'false');
    }
    await loadKillHistory(rank);
  }

  window.openGiantTracker = function() {
    ipcInvoke('gt:open').catch(err => {
      console.error('Failed to open Giant Tracker:', err);
    });
  };

  window.openKillHistory = function(rank, event) {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    void openKillHistoryForRank(rank);
  };

  /**
   * Toggle accordion open/closed
   */
  window.toggleAccordion = function(rank) {
    const accordion = monstersContainer.querySelector(`.accordion[data-rank="${rank}"]`);
    if (!accordion) return;

    const header = accordion.querySelector('.accordion-header');
    const content = accordion.querySelector('.accordion-content');

    header.classList.toggle('open');
    content.classList.toggle('open');

    // Persist user preference so re-renders don't reset accordion state
    accordionUserState.set(rank, header.classList.contains('open'));
  };

  /**
   * Update session info display
   */
  function updateSessionInfo() {
    if (!currentStats) {
      if (sessionInfoEl) sessionInfoEl.textContent = STR.sessionNoData;
      return;
    }

    const duration = currentStats.sessionDurationFormatted || '0:00';
    const kills = currentStats.killsSession || 0;
    if (sessionInfoEl) {
      const template = STR.sessionInfo || translations.en.sessionInfo;
      sessionInfoEl.textContent = fmt(template, { duration, kills });
    }
  }

  function setCharStatus(text, state = 'info') {
    if (!charNameStatus) return;
    charNameStatus.textContent = text;
    charNameStatus.classList.remove('ok', 'error');
    if (state === 'ok') {
      charNameStatus.classList.add('ok');
    } else if (state === 'error') {
      charNameStatus.classList.add('error');
    }
  }

  async function loadCharName() {
    if (!currentProfileId) return;
    try {
      const result = unwrap(await ipcInvoke('char:get', currentProfileId));
      if (charNameInput && typeof result?.charName === 'string') {
        charNameInput.value = result.charName;
        const statusText = result.charName ? STR.charSaved : STR.charNotSaved;
        setCharStatus(statusText, result.charName ? 'ok' : 'info');
      }
    } catch (err) {
      setCharStatus(STR.charLoadError, 'error');
    }
  }

  async function saveCharName() {
    if (!currentProfileId) return;
    const value = (charNameInput?.value || '').trim();
    try {
      const result = unwrap(await ipcInvoke('char:set', currentProfileId, value));
      const statusText = result?.charName ? STR.charSaved : STR.charNotSaved;
      setCharStatus(statusText, result?.charName ? 'ok' : 'info');
    } catch (err) {
      setCharStatus(STR.charSaveError, 'error');
    }
  }

  /**
   * Set visibility for a badge
   */
  async function setVisibility(badgeKey, visible) {
    if (!currentProfileId) return;

    // Suppress poll while IPC is in flight to prevent race condition
    pollSuppressedUntil = Date.now() + 2000;

    // Optimistic local update
    if (currentLayout && currentLayout.visibility) {
      currentLayout.visibility[badgeKey] = visible;
    }

    try {
      unwrap(await ipcInvoke('vis:set', currentProfileId, badgeKey, visible));
      await requestState();
    } catch (err) {
      console.error('Failed to set visibility:', err);
    } finally {
      pollSuppressedUntil = 0;
    }
  }

  /**
   * Toggle all badges visibility
   */
  async function toggleAll() {
    if (!currentProfileId) return;

    try {
      const result = unwrap(await ipcInvoke('overlay:toggle:all', currentProfileId));
      if (result?.success) {
        currentLayout.overlayVisible = result.overlayVisible;
        updateToggleButton();
      }
    } catch (err) {
      console.error('Failed to toggle all:', err);
    }
  }

  /**
   * Update toggle all button text
   */
  function updateToggleButton() {
    const isVisible = currentLayout?.overlayVisible !== false;
    if (toggleAllBtn) {
      toggleAllBtn.textContent = isVisible ? STR.hideAll : STR.showAll;
    }
  }

  /**
   * Update rows input from layout
   */
  function updateRowsInput() {
    const rows = currentLayout?.rows ? Math.max(1, Math.floor(currentLayout.rows)) : 1;
    if (rowsInput) {
      rowsInput.value = String(rows);
    }
  }

  /**
   * Clamp scale to supported range
   */
  function clampScale(val) {
    const n = Number(val);
    if (!Number.isFinite(n)) return 1;
    return Math.min(1.6, Math.max(0.6, n));
  }

  /**
   * Update scale slider from layout
   */
  function updateScaleInput() {
    const scale = clampScale(currentLayout?.scale ?? 1);
    if (scaleInput) {
      scaleInput.value = String(scale);
    }
    if (scaleValue) {
      scaleValue.textContent = scale.toFixed(2) + 'x';
    }
  }

  /**
   * Reset session counters (keeps lifetime totals)
   */
  async function resetSession() {
    if (!currentProfileId) return;
    try {
      unwrap(await ipcInvoke('session:reset', currentProfileId));
      await requestState();
    } catch (err) {
      console.error('Failed to reset session:', err);
    }
  }

  /**
   * Set all badge visibility at once
   */
  async function setAllVisibility(visible) {
    if (!currentProfileId) return;
    const visibilityMap = {};
    BADGE_KEYS.forEach(k => { visibilityMap[k] = visible; });

    // Suppress poll while IPC is in flight
    pollSuppressedUntil = Date.now() + 2000;

    // Optimistic local update
    if (currentLayout) {
      currentLayout.visibility = { ...visibilityMap };
    }

    try {
      unwrap(await ipcInvoke('layout:set', currentProfileId, { visibility: visibilityMap }));
      await requestState();
    } catch (err) {
      console.error('Failed to set all visibility:', err);
    } finally {
      pollSuppressedUntil = 0;
    }
  }

  /**
   * Bind to a profile
   */
  async function bindProfile(profileId) {
    if (!profileId) return;

    closeKillHistoryModal();
    currentProfileId = profileId;

    try {
      unwrap(await ipcInvoke('panel:bind:profile', profileId));
      await requestState();
    } catch (err) {
      console.error('Failed to bind profile:', err);
    }
  }

  /**
   * Request current state
   */
  let _debugLastRaw = '';
  async function requestState() {
    if (!currentProfileId) return;

    try {
      const raw = await ipcInvoke('panel:request:state', currentProfileId);
      const data = unwrap(raw);
      // Debug: capture raw IPC response shape
      const mbr = data?.stats?.monstersByRank;
      const mc = mbr ? Object.values(mbr).reduce((s, a) => s + (a?.length || 0), 0) : -1;
      _debugLastRaw = `raw:${typeof raw}|ok:${raw?.ok}|mc:${mc}|kills:${data?.stats?.killsTotal ?? '?'}`;
      applyIncomingState(data);
      render();
      updateRowsInput();
      updateScaleInput();
    } catch (err) {
      console.error('Failed to request state:', err);
    }
  }

  async function runCanonicalRefresh() {
    if (canonicalRefreshInFlight) {
      canonicalRefreshQueued = true;
      return;
    }
    canonicalRefreshInFlight = true;
    try {
      await requestState();
    } finally {
      canonicalRefreshInFlight = false;
      if (canonicalRefreshQueued) {
        canonicalRefreshQueued = false;
        setTimeout(() => {
          void runCanonicalRefresh();
        }, 0);
      }
    }
  }

  function scheduleCanonicalRefresh(delayMs = 0) {
    if (canonicalRefreshTimer) return;
    canonicalRefreshTimer = setTimeout(() => {
      canonicalRefreshTimer = null;
      void runCanonicalRefresh();
    }, Math.max(0, Number(delayMs) || 0));
  }

  /**
   * Render all UI components
   */
  function render() {
    renderBadgeList();
    renderMonsters();
    updateSessionInfo();
    updateToggleButton();
    updateRowsInput();
    updateScaleInput();
  }

  /**
   * Handle state update broadcast
   * Uses incremental DOM updates instead of full render() to avoid
   * destroying checkbox elements mid-click (OCR broadcasts fire ~5x/sec).
   */
  function handleStateUpdate(payload) {
    if (payload.profileId !== currentProfileId) return;
    // Always re-sync via canonical request to avoid out-of-order/partial broadcast payloads.
    scheduleCanonicalRefresh(0);
  }

  /**
   * Handle visibility update broadcast
   */
  function handleVisibilityUpdate(payload) {
    if (payload.profileId !== currentProfileId) return;

    if (currentLayout) {
      currentLayout.visibility = payload.visibility;
      currentLayout.overlayVisible = payload.overlayVisible;
    }
    render();
  }

  /**
   * Handle layout update broadcast
   */
  function handleLayoutUpdate(payload) {
    if (payload.profileId !== currentProfileId) return;

    currentLayout = payload.layout;
    updateScaleInput();
    render();
  }

  /**
   * Persist rows setting
   */
  async function setRowsFromInput() {
    if (!currentProfileId || !rowsInput) return;
    const rows = Math.max(1, Math.floor(Number(rowsInput.value) || 1));
    try {
      unwrap(await ipcInvoke('layout:set', currentProfileId, { rows }));
    } catch (err) {
      console.error('Failed to set rows:', err);
    }
  }

  /**
   * Persist scale setting from slider
   */
  async function setScaleFromInput() {
    if (!currentProfileId || !scaleInput) return;
    const scale = clampScale(scaleInput.value);
    try {
      unwrap(await ipcInvoke('layout:set', currentProfileId, { scale }));
      if (currentLayout) {
        currentLayout.scale = scale;
      }
    } catch (err) {
      console.error('Failed to set scale:', err);
    } finally {
      if (scaleValue) scaleValue.textContent = scale.toFixed(2) + 'x';
    }
  }

  /**
   * Initialize the panel
   */
  async function init() {
    applyStaticTranslations();
    // Setup event listeners
    toggleAllBtn.addEventListener('click', toggleAll);
    resetSessionBtn.addEventListener('click', resetSession);
    if (rowsInput) {
      rowsInput.addEventListener('change', setRowsFromInput);
    }
    if (scaleInput) {
      scaleInput.addEventListener('input', () => {
        const scale = clampScale(scaleInput.value);
        if (scaleValue) scaleValue.textContent = scale.toFixed(2) + 'x';
      });
      scaleInput.addEventListener('change', setScaleFromInput);
    }
    if (charNameInput) {
      const scheduleSave = () => {
        if (charNameDebounce) clearTimeout(charNameDebounce);
        charNameDebounce = setTimeout(() => {
          void saveCharName();
        }, 300);
      };
      charNameInput.addEventListener('input', scheduleSave);
      charNameInput.addEventListener('change', scheduleSave);
    }

    if (killHistoryCloseBtn) {
      killHistoryCloseBtn.addEventListener('click', () => {
        closeKillHistoryModal();
      });
    }
    if (killHistoryModal) {
      killHistoryModal.addEventListener('click', (event) => {
        if (event.target === killHistoryModal) {
          closeKillHistoryModal();
        }
      });
    }
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && killHistoryModal?.classList.contains('open')) {
        closeKillHistoryModal();
      }
    });

    profileSelector.addEventListener('change', (e) => {
      bindProfile(e.target.value);
    });

    // Helper: populate profile selector from backend profile list
    async function syncProfiles() {
      try {
        const res = unwrap(await ipcInvoke('panel:get:active-profile'));
        const best = res?.profileId && typeof res.profileId === 'string' ? res.profileId : null;
        const rawProfiles = Array.isArray(res?.profiles) ? res.profiles : [];
        const profiles = Array.from(new Set(
          rawProfiles.filter((pid) => typeof pid === 'string' && pid)
        ));
        if (best && !profiles.includes(best)) {
          profiles.unshift(best);
        }
        const previous = profileSelector.value || currentProfileId || '';
        profileSelector.innerHTML = `<option value="">${STR.selectProfile}</option>`;
        for (const pid of profiles) {
          const opt = document.createElement('option');
          opt.value = pid;
          opt.textContent = pid;
          profileSelector.appendChild(opt);
        }
        if (best && profiles.includes(best)) {
          profileSelector.value = best;
        } else if (previous && profiles.includes(previous)) {
          profileSelector.value = previous;
        } else if (profiles.length > 0) {
          profileSelector.value = profiles[0];
        } else {
          profileSelector.value = '';
        }
        return best;
      } catch (_) { return null; }
    }

    // Determine initial profile: try host injection, then ask backend
    let initialProfile = typeof window.__overlayTargetId === 'string' && window.__overlayTargetId
      ? window.__overlayTargetId
      : null;

    const discoveredProfile = await syncProfiles();
    const defaultProfileId = initialProfile || discoveredProfile || profileSelector.value || 'default';
    if (defaultProfileId && !Array.from(profileSelector.options).some(o => o.value === defaultProfileId)) {
      const opt = document.createElement('option');
      opt.value = defaultProfileId;
      opt.textContent = defaultProfileId === 'default' ? STR.defaultProfile : defaultProfileId;
      profileSelector.appendChild(opt);
    }
    profileSelector.value = defaultProfileId;

    await bindProfile(defaultProfileId);
    await loadCharName();

    // Poll for updates and keep profile synced to overlay target.
    let pollInFlight = false;
    setInterval(async () => {
      // Guard: skip tick if previous poll is still in-flight (prevents stacking)
      if (pollInFlight) return;
      pollInFlight = true;
      try {
        let best = null;
        try {
          best = await syncProfiles();
          if (best && best !== currentProfileId) {
            profileSelector.value = best;
            await bindProfile(best);
            await loadCharName();
          }
        } catch (_) { /* ignore sync errors */ }

        if (!best && currentProfileId && !Array.from(profileSelector.options).some(o => o.value === currentProfileId)) {
          currentProfileId = null;
        }

        if (currentProfileId && Date.now() >= pollSuppressedUntil) {
          await runCanonicalRefresh();
        }
      } finally {
        pollInFlight = false;
      }
    }, 1000);
  }

  // Register IPC broadcast listeners (if available) so real-time updates
  // don't depend solely on polling.
  function registerBroadcastListeners() {
    const ipc = window.plugin?.ipc;
    if (ipc && typeof ipc.on === 'function') {
      ipc.on('state:update', handleStateUpdate);
      ipc.on('vis:update', handleVisibilityUpdate);
      ipc.on('layout:update', handleLayoutUpdate);
    }
  }

  // Initialize on load
  window.addEventListener('load', () => {
    registerBroadcastListeners();
    init();
  });
})();

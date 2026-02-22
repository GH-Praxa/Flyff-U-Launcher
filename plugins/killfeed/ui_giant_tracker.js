(function() {
  'use strict';

  // ── Localization ──────────────────────────────────────────────────────
  function detectLocale() {
    try {
      const raw = (navigator.language || 'en').slice(0, 2).toLowerCase();
      return raw === 'zh' ? 'cn' : raw === 'ja' ? 'jp' : raw;
    } catch (_) { return 'en'; }
  }
  const locale = detectLocale();

  const translations = {
    en: {
      title: 'Giant Tracker',
      profile: 'Profile',
      all: 'All',
      giants: 'Giants',
      violets: 'Violets',
      bosses: 'Bosses',
      boss: 'Boss',
      search: 'Search...',
      killsDesc: 'Kills \u2193',
      killsAsc: 'Kills \u2191',
      nameAsc: 'Name A-Z',
      nameDesc: 'Name Z-A',
      levelAsc: 'Level \u2191',
      levelDesc: 'Level \u2193',
      today: 'Today',
      week: 'Week',
      month: 'Month',
      year: 'Year',
      total: 'Total',
      drops: 'Drops',
      avg: 'Avg',
      killsPerDrop: 'kills/drop',
      sinceLast: 'Since last',
      logDrop: 'Log Drop',
      dropsLogged: 'drops logged',
      dropLogged: 'drop logged',
      lastKill: 'Last kill',
      expand: 'Details',
      collapse: 'Collapse',
      empty: 'No monsters tracked yet.',
      dropsEmpty: 'No drops logged yet.',
      logDropTitle: 'Log Drop',
      searchItems: 'Search items...',
      noLootPool: 'No loot pool data available',
      noMatch: 'No matching items',
      giant: 'Giant',
      violet: 'Violet',
      hp: 'HP',
      atk: 'ATK',
      allRarity: 'All',
      common: 'Common',
      uncommon: 'Uncommon',
      rare: 'Rare',
      veryrare: 'Very Rare',
      unique: 'Unique',
      ultimate: 'Ultimate',
      ttk: 'TTK',
      avgTtk: 'Avg. TTK',
      lastTtk: 'Last TTK',
      fastest: 'Fastest',
    },
    de: {
      title: 'Giant Tracker',
      profile: 'Profil',
      all: 'Alle',
      giants: 'Riesen',
      violets: 'Violette',
      bosses: 'Bosse',
      boss: 'Boss',
      search: 'Suchen...',
      killsDesc: 'Kills \u2193',
      killsAsc: 'Kills \u2191',
      nameAsc: 'Name A-Z',
      nameDesc: 'Name Z-A',
      levelAsc: 'Level \u2191',
      levelDesc: 'Level \u2193',
      today: 'Heute',
      week: 'Woche',
      month: 'Monat',
      year: 'Jahr',
      total: 'Gesamt',
      drops: 'Drops',
      avg: '\u00d8',
      killsPerDrop: 'Kills/Drop',
      sinceLast: 'Seit letztem',
      logDrop: 'Drop loggen',
      dropsLogged: 'Drops geloggt',
      dropLogged: 'Drop geloggt',
      lastKill: 'Letzter Kill',
      expand: 'Details',
      collapse: 'Einklappen',
      empty: 'Noch keine Monster getrackt.',
      dropsEmpty: 'Noch keine Drops geloggt.',
      logDropTitle: 'Drop loggen',
      searchItems: 'Items suchen...',
      noLootPool: 'Keine Lootpool-Daten verfuegbar',
      noMatch: 'Keine passenden Items',
      giant: 'Riese',
      violet: 'Violett',
      hp: 'HP',
      atk: 'ATK',
      allRarity: 'Alle',
      common: 'Gewoehnlich',
      uncommon: 'Ungewoehnlich',
      rare: 'Selten',
      veryrare: 'Sehr Selten',
      unique: 'Einzigartig',
      ultimate: 'Ultimativ',
      ttk: 'TTK',
      avgTtk: '\u00d8 TTK',
      lastTtk: 'Letzter TTK',
      fastest: 'Schnellster',
    },
    fr: {
      title: 'Giant Tracker',
      profile: 'Profil',
      all: 'Tous',
      giants: 'G\u00e9ants',
      violets: 'Violets',
      bosses: 'Boss',
      boss: 'Boss',
      search: 'Rechercher...',
      killsDesc: 'Kills \u2193',
      killsAsc: 'Kills \u2191',
      nameAsc: 'Nom A-Z',
      nameDesc: 'Nom Z-A',
      levelAsc: 'Niveau \u2191',
      levelDesc: 'Niveau \u2193',
      today: "Aujourd'hui",
      week: 'Semaine',
      month: 'Mois',
      year: 'Ann\u00e9e',
      total: 'Total',
      drops: 'Drops',
      avg: 'Moy',
      killsPerDrop: 'kills/drop',
      sinceLast: 'Depuis dernier',
      logDrop: 'Enr. drop',
      dropsLogged: 'drops enregistr\u00e9s',
      dropLogged: 'drop enregistr\u00e9',
      lastKill: 'Dernier kill',
      expand: 'D\u00e9tails',
      collapse: 'R\u00e9duire',
      empty: 'Aucun g\u00e9ant ou violet suivi.',
      logDropTitle: 'Enregistrer drop',
      searchItems: 'Rechercher items...',
      noLootPool: 'Aucune donn\u00e9e de loot',
      noMatch: 'Aucun item correspondant',
      giant: 'G\u00e9ant',
      violet: 'Violet',
      hp: 'PV',
      atk: 'ATQ',
      allRarity: 'Tous',
      common: 'Commun',
      uncommon: 'Peu commun',
      rare: 'Rare',
      veryrare: 'Tr\u00e8s rare',
      unique: 'Unique',
      ultimate: 'Ultime',
      ttk: 'TTK',
      avgTtk: 'Moy. TTK',
      lastTtk: 'Dernier TTK',
      fastest: 'Plus rapide',
    },
    pl: {
      title: 'Giant Tracker',
      profile: 'Profil',
      all: 'Wszystkie',
      giants: 'Giganty',
      violets: 'Fiolety',
      bosses: 'Bossy',
      boss: 'Boss',
      search: 'Szukaj...',
      killsDesc: 'Zab. \u2193',
      killsAsc: 'Zab. \u2191',
      nameAsc: 'Nazwa A-Z',
      nameDesc: 'Nazwa Z-A',
      levelAsc: 'Poziom \u2191',
      levelDesc: 'Poziom \u2193',
      today: 'Dzi\u015b',
      week: 'Tydzie\u0144',
      month: 'Miesi\u0105c',
      year: 'Rok',
      total: '\u0141\u0105cznie',
      drops: 'Dropy',
      avg: '\u015ar',
      killsPerDrop: 'zab./drop',
      sinceLast: 'Od ostatniego',
      logDrop: 'Zapisz drop',
      dropsLogged: 'drop\u00f3w zapisanych',
      dropLogged: 'drop zapisany',
      lastKill: 'Ostatni kill',
      expand: 'Szczeg\u00f3\u0142y',
      collapse: 'Zwi\u0144',
      empty: 'Brak \u015bledzonych gigant\u00f3w lub fiolet\u00f3w.',
      logDropTitle: 'Zapisz drop',
      searchItems: 'Szukaj item\u00f3w...',
      noLootPool: 'Brak danych o loot',
      noMatch: 'Brak pasuj\u0105cych item\u00f3w',
      giant: 'Gigant',
      violet: 'Fiolet',
      hp: 'HP',
      atk: 'ATK',
      allRarity: 'Wszystkie',
      common: 'Pospolity',
      uncommon: 'Niepospolity',
      rare: 'Rzadki',
      veryrare: 'Bardzo rzadki',
      unique: 'Unikalny',
      ultimate: 'Ostateczny',
      ttk: 'TTK',
      avgTtk: '\u015ar. TTK',
      lastTtk: 'Ostatni TTK',
      fastest: 'Najszybszy',
    },
    ru: {
      title: '\u0422\u0440\u0435\u043a\u0435\u0440 \u0433\u0438\u0433\u0430\u043d\u0442\u043e\u0432',
      profile: '\u041f\u0440\u043e\u0444\u0438\u043b\u044c',
      all: '\u0412\u0441\u0435',
      giants: '\u0413\u0438\u0433\u0430\u043d\u0442\u044b',
      violets: '\u0424\u0438\u043e\u043b\u0435\u0442\u043e\u0432\u044b\u0435',
      bosses: '\u0411\u043e\u0441\u0441\u044b',
      boss: '\u0411\u043e\u0441\u0441',
      search: '\u041f\u043e\u0438\u0441\u043a...',
      killsDesc: '\u0423\u0431\u0438\u0439\u0441\u0442\u0432\u0430 \u2193',
      killsAsc: '\u0423\u0431\u0438\u0439\u0441\u0442\u0432\u0430 \u2191',
      nameAsc: '\u0418\u043c\u044f A-Z',
      nameDesc: '\u0418\u043c\u044f Z-A',
      levelAsc: '\u0423\u0440\u043e\u0432\u0435\u043d\u044c \u2191',
      levelDesc: '\u0423\u0440\u043e\u0432\u0435\u043d\u044c \u2193',
      today: '\u0421\u0435\u0433\u043e\u0434\u043d\u044f',
      week: '\u041d\u0435\u0434\u0435\u043b\u044f',
      month: '\u041c\u0435\u0441\u044f\u0446',
      year: '\u0413\u043e\u0434',
      total: '\u0412\u0441\u0435\u0433\u043e',
      drops: '\u0414\u0440\u043e\u043f\u044b',
      avg: '\u0421\u0440',
      killsPerDrop: '\u0443\u0431./\u0434\u0440\u043e\u043f',
      sinceLast: '\u0421 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0433\u043e',
      logDrop: '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c',
      dropsLogged: '\u0434\u0440\u043e\u043f\u043e\u0432',
      dropLogged: '\u0434\u0440\u043e\u043f',
      lastKill: '\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u043a\u0438\u043b\u043b',
      expand: '\u041f\u043e\u0434\u0440\u043e\u0431\u043d\u0435\u0435',
      collapse: '\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c',
      empty: '\u041d\u0435\u0442 \u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0435\u043c\u044b\u0445 \u0433\u0438\u0433\u0430\u043d\u0442\u043e\u0432.',
      logDropTitle: '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0434\u0440\u043e\u043f',
      searchItems: '\u041f\u043e\u0438\u0441\u043a \u043f\u0440\u0435\u0434\u043c\u0435\u0442\u043e\u0432...',
      noLootPool: '\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u043e \u043b\u0443\u0442\u0435',
      noMatch: '\u041d\u0435\u0442 \u043f\u043e\u0434\u0445\u043e\u0434\u044f\u0449\u0438\u0445 \u043f\u0440\u0435\u0434\u043c\u0435\u0442\u043e\u0432',
      giant: '\u0413\u0438\u0433\u0430\u043d\u0442',
      violet: '\u0424\u0438\u043e\u043b\u0435\u0442\u043e\u0432\u044b\u0439',
      hp: '\u0417\u0434\u043e\u0440\u043e\u0432\u044c\u0435',
      atk: '\u0410\u0422\u041a',
      allRarity: '\u0412\u0441\u0435',
      common: '\u041e\u0431\u044b\u0447\u043d\u044b\u0439',
      uncommon: '\u041d\u0435\u043e\u0431\u044b\u0447\u043d\u044b\u0439',
      rare: '\u0420\u0435\u0434\u043a\u0438\u0439',
      veryrare: '\u041e\u0447\u0435\u043d\u044c \u0440\u0435\u0434\u043a\u0438\u0439',
      unique: '\u0423\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u0439',
      ultimate: '\u0423\u043b\u044c\u0442\u0438\u043c\u0430\u0442\u0438\u0432\u043d\u044b\u0439',
      ttk: 'TTK',
      avgTtk: '\u0421\u0440. TTK',
      lastTtk: '\u041f\u043e\u0441\u043b. TTK',
      fastest: '\u0411\u044b\u0441\u0442\u0440\u0435\u0439\u0448\u0438\u0439',
    },
    tr: {
      title: 'Giant Tracker',
      profile: 'Profil',
      all: 'Hepsi',
      giants: 'Devler',
      violets: 'Morlar',
      bosses: 'Patronlar',
      boss: 'Patron',
      search: 'Ara...',
      killsDesc: '\u00d6ld. \u2193',
      killsAsc: '\u00d6ld. \u2191',
      nameAsc: 'Ad A-Z',
      nameDesc: 'Ad Z-A',
      levelAsc: 'Seviye \u2191',
      levelDesc: 'Seviye \u2193',
      today: 'Bug\u00fcn',
      week: 'Hafta',
      month: 'Ay',
      year: 'Y\u0131l',
      total: 'Toplam',
      drops: 'Droplar',
      avg: 'Ort',
      killsPerDrop: '\u00f6ld\u00fcrme/drop',
      sinceLast: 'Son drop\u2019dan beri',
      logDrop: 'Drop kaydet',
      dropsLogged: 'drop kaydedildi',
      dropLogged: 'drop kaydedildi',
      lastKill: 'Son \u00f6ld\u00fcrme',
      expand: 'Detaylar',
      collapse: 'Daralt',
      empty: 'Hen\u00fcz takip edilen dev veya mor yok.',
      logDropTitle: 'Drop kaydet',
      searchItems: 'E\u015fya ara...',
      noLootPool: 'Loot verisi yok',
      noMatch: 'E\u015fle\u015fen e\u015fya yok',
      giant: 'Dev',
      violet: 'Mor',
      hp: 'HP',
      atk: 'ATK',
      allRarity: 'Hepsi',
      common: 'S\u0131radan',
      uncommon: 'S\u0131ra d\u0131\u015f\u0131',
      rare: 'Nadir',
      veryrare: '\u00c7ok nadir',
      unique: 'E\u015fsiz',
      ultimate: 'Nihai',
      ttk: 'TTK',
      avgTtk: 'Ort. TTK',
      lastTtk: 'Son TTK',
      fastest: 'En h\u0131zl\u0131',
    },
    cn: {
      title: '\u5de8\u4eba\u8ffd\u8e2a\u5668',
      profile: '\u914d\u7f6e',
      all: '\u5168\u90e8',
      giants: '\u5de8\u4eba',
      violets: '\u7d2b\u8272',
      bosses: 'Boss',
      boss: 'Boss',
      search: '\u641c\u7d22...',
      killsDesc: '\u51fb\u6740 \u2193',
      killsAsc: '\u51fb\u6740 \u2191',
      nameAsc: '\u540d\u79f0 A-Z',
      nameDesc: '\u540d\u79f0 Z-A',
      levelAsc: '\u7b49\u7ea7 \u2191',
      levelDesc: '\u7b49\u7ea7 \u2193',
      today: '\u4eca\u5929',
      week: '\u672c\u5468',
      month: '\u672c\u6708',
      year: '\u672c\u5e74',
      total: '\u603b\u8ba1',
      drops: '\u6389\u843d',
      avg: '\u5e73\u5747',
      killsPerDrop: '\u6b21\u51fb\u6740/\u6389\u843d',
      sinceLast: '\u4e0a\u6b21\u4ee5\u6765',
      logDrop: '\u8bb0\u5f55\u6389\u843d',
      dropsLogged: '\u6b21\u6389\u843d\u5df2\u8bb0\u5f55',
      dropLogged: '\u6b21\u6389\u843d\u5df2\u8bb0\u5f55',
      lastKill: '\u4e0a\u6b21\u51fb\u6740',
      expand: '\u8be6\u60c5',
      collapse: '\u6536\u8d77',
      empty: '\u5c1a\u65e0\u8ddf\u8e2a\u7684\u5de8\u4eba\u6216\u7d2b\u8272\u602a\u7269\u3002',
      logDropTitle: '\u8bb0\u5f55\u6389\u843d',
      searchItems: '\u641c\u7d22\u7269\u54c1...',
      noLootPool: '\u65e0\u6389\u843d\u6570\u636e',
      noMatch: '\u65e0\u5339\u914d\u7269\u54c1',
      giant: '\u5de8\u4eba',
      violet: '\u7d2b\u8272',
      hp: 'HP',
      atk: '\u653b\u6483',
      allRarity: '\u5168\u90e8',
      common: '\u666e\u901a',
      uncommon: '\u7a00\u6709',
      rare: '\u7a00\u5c11',
      veryrare: '\u975e\u5e38\u7a00\u5c11',
      unique: '\u552f\u4e00',
      ultimate: '\u7a76\u6781',
      ttk: 'TTK',
      avgTtk: '\u5e73\u5747 TTK',
      lastTtk: '\u6700\u540e TTK',
      fastest: '\u6700\u5feb',
    },
    jp: {
      title: '\u30b8\u30e3\u30a4\u30a2\u30f3\u30c8\u30c8\u30e9\u30c3\u30ab\u30fc',
      profile: '\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb',
      all: '\u3059\u3079\u3066',
      giants: '\u30b8\u30e3\u30a4\u30a2\u30f3\u30c8',
      violets: '\u30d0\u30a4\u30aa\u30ec\u30c3\u30c8',
      bosses: '\u30dc\u30b9',
      boss: '\u30dc\u30b9',
      search: '\u691c\u7d22...',
      killsDesc: '\u30ad\u30eb \u2193',
      killsAsc: '\u30ad\u30eb \u2191',
      nameAsc: '\u540d\u524d A-Z',
      nameDesc: '\u540d\u524d Z-A',
      levelAsc: '\u30ec\u30d9\u30eb \u2191',
      levelDesc: '\u30ec\u30d9\u30eb \u2193',
      today: '\u4eca\u65e5',
      week: '\u4eca\u9031',
      month: '\u4eca\u6708',
      year: '\u4eca\u5e74',
      total: '\u5408\u8a08',
      drops: '\u30c9\u30ed\u30c3\u30d7',
      avg: '\u5e73\u5747',
      killsPerDrop: '\u30ad\u30eb/\u30c9\u30ed\u30c3\u30d7',
      sinceLast: '\u524d\u56de\u304b\u3089',
      logDrop: '\u30c9\u30ed\u30c3\u30d7\u8a18\u9332',
      dropsLogged: '\u30c9\u30ed\u30c3\u30d7\u8a18\u9332\u6e08',
      dropLogged: '\u30c9\u30ed\u30c3\u30d7\u8a18\u9332\u6e08',
      lastKill: '\u6700\u5f8c\u306e\u30ad\u30eb',
      expand: '\u8a73\u7d30',
      collapse: '\u305f\u305f\u3080',
      empty: '\u30b8\u30e3\u30a4\u30a2\u30f3\u30c8/\u30d0\u30a4\u30aa\u30ec\u30c3\u30c8\u304c\u307e\u3060\u3042\u308a\u307e\u305b\u3093\u3002',
      logDropTitle: '\u30c9\u30ed\u30c3\u30d7\u8a18\u9332',
      searchItems: '\u30a2\u30a4\u30c6\u30e0\u691c\u7d22...',
      noLootPool: '\u30eb\u30fc\u30c8\u30c7\u30fc\u30bf\u306a\u3057',
      noMatch: '\u4e00\u81f4\u3059\u308b\u30a2\u30a4\u30c6\u30e0\u306a\u3057',
      giant: '\u30b8\u30e3\u30a4\u30a2\u30f3\u30c8',
      violet: '\u30d0\u30a4\u30aa\u30ec\u30c3\u30c8',
      hp: 'HP',
      atk: '\u653b\u6483\u529b',
      allRarity: '\u3059\u3079\u3066',
      common: '\u30b3\u30e2\u30f3',
      uncommon: '\u30a2\u30f3\u30b3\u30e2\u30f3',
      rare: '\u30ec\u30a2',
      veryrare: '\u30d9\u30ea\u30fc\u30ec\u30a2',
      unique: '\u30e6\u30cb\u30fc\u30af',
      ultimate: '\u30a2\u30eb\u30c6\u30a3\u30e1\u30c3\u30c8',
      ttk: 'TTK',
      avgTtk: '\u5e73\u5747 TTK',
      lastTtk: '\u6700\u5f8c TTK',
      fastest: '\u6700\u901f',
    },
  };

  const T = translations[locale] || translations.en;
  const t = (key) => T[key] || translations.en[key] || key;

  // State
  let profileId = null;
  let trackerData = null;
  let currentFilter = 'all';
  let currentSort = 'kills-desc';
  let searchQuery = '';
  let dropDialogMonster = null;
  let currentRarityFilter = 'all';
  const dropListOpen = new Set();
  const expandedCards = new Set();

  function formatBigNumber(n) {
    if (n == null || !Number.isFinite(n)) return '-';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  function formatTtk(ms) {
    if (ms == null || !Number.isFinite(ms) || ms <= 0) return '-';
    if (ms < 1000) return ms + 'ms';
    const s = ms / 1000;
    if (s < 60) return s.toFixed(1) + 's';
    const m = Math.floor(s / 60);
    const rs = Math.round(s % 60);
    return m + ':' + String(rs).padStart(2, '0');
  }

  // DOM
  const profileEl = document.getElementById('gtProfile');
  const cardsEl = document.getElementById('gtCards');
  const rankFilterEl = document.getElementById('gtRankFilter');
  const sortEl = document.getElementById('gtSort');
  const searchEl = document.getElementById('gtSearch');
  const dropModal = document.getElementById('gtDropModal');
  const dropTitle = document.getElementById('gtDropTitle');
  const dropClose = document.getElementById('gtDropClose');
  const dropSearch = document.getElementById('gtDropSearch');
  const lootGrid = document.getElementById('gtLootGrid');
  const rarityFilterEl = document.getElementById('gtRarityFilter');

  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function unwrap(result) {
    if (result && typeof result === 'object' && 'ok' in result) {
      if (result.ok) return result.data;
      throw new Error(result.error || 'IPC call failed');
    }
    return result;
  }

  function timeAgo(timestamp) {
    if (!timestamp || !Number.isFinite(timestamp)) return '-';
    const diff = Date.now() - timestamp;
    if (diff < 0) return 'just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function formatDate(timestamp) {
    if (!timestamp || !Number.isFinite(timestamp)) return '-';
    const d = new Date(timestamp);
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  // ── Theme ──────────────────────────────────────────────────────────────

  function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null;
    const c = hex.replace('#', '');
    if (c.length !== 6 && c.length !== 3) return null;
    const f = c.length === 3 ? c[0]+c[0]+c[1]+c[1]+c[2]+c[2] : c;
    const r = parseInt(f.slice(0,2),16), g = parseInt(f.slice(2,4),16), b = parseInt(f.slice(4,6),16);
    return isNaN(r)||isNaN(g)||isNaN(b) ? null : `${r},${g},${b}`;
  }

  function applyThemeColors(colors, tabOverride) {
    if (!colors || typeof colors !== 'object') return;
    const s = document.documentElement.style;
    const entries = { bg: colors.bg, panel: colors.panel, panel2: colors.panel2, stroke: colors.stroke, text: colors.text, muted: colors.muted, accent: colors.accent, danger: colors.danger, green: colors.green };
    for (const [k, v] of Object.entries(entries)) { if (typeof v === 'string' && v.trim()) s.setProperty('--'+k, v.trim()); }
    const tab = tabOverride || colors.tabActive || colors.accent;
    const pairs = [['--tab-active-rgb', tab], ['--accent-rgb', colors.accent], ['--danger-rgb', colors.danger], ['--green-rgb', colors.green]];
    for (const [prop, hex] of pairs) { const rgb = hexToRgb(hex); if (rgb) s.setProperty(prop, rgb); }
  }

  async function syncTheme() {
    try {
      if (window.themeIpc?.getCurrent) {
        const raw = await window.themeIpc.getCurrent();
        // safeHandle wraps in {ok, data} — unwrap if needed
        const snap = (raw && typeof raw === 'object' && 'ok' in raw && raw.ok) ? raw.data : raw;
        if (snap?.colors) applyThemeColors(snap.colors, snap.colors?.tabActive || snap.builtin?.tabActive);
      }
    } catch (e) { console.warn('Theme sync failed:', e); }
    if (window.themeIpc?.onUpdate) {
      window.themeIpc.onUpdate((p) => {
        const snap = (p && typeof p === 'object' && 'ok' in p && p.ok) ? p.data : p;
        if (snap?.colors) applyThemeColors(snap.colors, snap.colors?.tabActive || snap.builtin?.tabActive);
      });
    }
  }

  // ── Demo data (standalone / development fallback) ────────────────────

  function getDemoData() {
    const now = Date.now();
    return {
      itemIconsBasePath: '',
      giants: [
        {
          name: 'Mushpang', rank: 'giant', level: 20, element: 'earth',
          hp: 48000, minAttack: 120, maxAttack: 180, iconUrl: '',
          kills: { today: 3, week: 12, month: 45, year: 210, total: 210 },
          lastKillTime: now - 3600000,
          drops: [
            { itemName: 'Guardian Knuckle', itemId: 3001, killCountAtDrop: 85, timestamp: now - 86400000 * 3 },
            { itemName: 'Vigor Ring', itemId: 3002, killCountAtDrop: 190, timestamp: now - 86400000 }
          ],
          avgKillsPerDrop: 95, killsSinceLastDrop: 20,
          ttk: { avgMs: 12000, lastMs: 11200, minMs: 9800 },
          lootPool: [
            { itemId: 3001, name: 'Guardian Knuckle', icon: '', prob: '0.5%', rarity: 'unique' },
            { itemId: 3002, name: 'Vigor Ring', icon: '', prob: '1.2%', rarity: 'rare' },
            { itemId: 3003, name: 'Scroll of SProtect', icon: '', prob: '3.0%', rarity: 'uncommon' },
            { itemId: 3004, name: 'Sunstone', icon: '', prob: '8.0%', rarity: 'common' },
            { itemId: 3005, name: 'Moonstone', icon: '', prob: '8.0%', rarity: 'common' },
            { itemId: 3006, name: 'Sparkle', icon: '', prob: '0.1%', rarity: 'ultimate' },
          ]
        },
        {
          name: 'Cardpuppet', rank: 'giant', level: 57, element: 'wind',
          hp: 380000, minAttack: 800, maxAttack: 1200, iconUrl: '',
          kills: { today: 1, week: 5, month: 18, year: 92, total: 92 },
          lastKillTime: now - 7200000,
          drops: [],
          avgKillsPerDrop: null, killsSinceLastDrop: null,
          ttk: { avgMs: 45000, lastMs: 42000, minMs: 38000 },
          lootPool: [
            { itemId: 4001, name: 'Historic Sword', icon: '', prob: '0.3%', rarity: 'unique' },
            { itemId: 4002, name: 'Angel Bow', icon: '', prob: '0.8%', rarity: 'rare' },
            { itemId: 4003, name: 'Crystal', icon: '', prob: '5.0%', rarity: 'uncommon' },
          ]
        },
        {
          name: 'Syliaca', rank: 'violet', level: 43, element: 'water',
          hp: 95000, minAttack: 350, maxAttack: 520, iconUrl: '',
          kills: { today: 5, week: 28, month: 95, year: 430, total: 430 },
          lastKillTime: now - 1800000,
          drops: [
            { itemName: 'Lusaka Crystal', itemId: 5001, killCountAtDrop: 120, timestamp: now - 86400000 * 7 },
          ],
          avgKillsPerDrop: 120, killsSinceLastDrop: 310,
          ttk: { avgMs: 22000, lastMs: 19500, minMs: 17000 },
          lootPool: [
            { itemId: 5001, name: 'Lusaka Crystal', icon: '', prob: '0.8%', rarity: 'veryrare' },
            { itemId: 5002, name: 'Scroll of XProtect', icon: '', prob: '2.5%', rarity: 'rare' },
            { itemId: 5003, name: 'Bead', icon: '', prob: '10.0%', rarity: 'common' },
          ]
        },
        {
          name: 'Clockworks', rank: 'boss', level: 120, element: 'fire',
          hp: 52000000, minAttack: 8500, maxAttack: 14000, iconUrl: '',
          kills: { today: 0, week: 2, month: 6, year: 28, total: 28 },
          lastKillTime: now - 86400000,
          drops: [
            { itemName: 'Demol Earring', itemId: 6001, killCountAtDrop: 12, timestamp: now - 86400000 * 14 },
            { itemName: 'Crystal Sword', itemId: 6002, killCountAtDrop: 25, timestamp: now - 86400000 * 2 },
          ],
          avgKillsPerDrop: 13, killsSinceLastDrop: 3,
          ttk: { avgMs: 320000, lastMs: 295000, minMs: 270000 },
          lootPool: [
            { itemId: 6001, name: 'Demol Earring', icon: '', prob: '0.05%', rarity: 'ultimate' },
            { itemId: 6002, name: 'Crystal Sword', icon: '', prob: '0.2%', rarity: 'unique' },
            { itemId: 6003, name: 'Angel Suit (M)', icon: '', prob: '0.3%', rarity: 'unique' },
            { itemId: 6004, name: 'Scroll of GProtect', icon: '', prob: '1.5%', rarity: 'veryrare' },
            { itemId: 6005, name: 'Diamond', icon: '', prob: '3.0%', rarity: 'rare' },
            { itemId: 6006, name: 'Gold Ore', icon: '', prob: '12.0%', rarity: 'common' },
            { itemId: 6007, name: 'Silver Ore', icon: '', prob: '15.0%', rarity: 'common' },
          ]
        },
        {
          name: 'Meteonyker', rank: 'boss', level: 140, element: 'electricity',
          hp: 98000000, minAttack: 12000, maxAttack: 20000, iconUrl: '',
          kills: { today: 0, week: 1, month: 3, year: 15, total: 15 },
          lastKillTime: now - 172800000,
          drops: [
            { itemName: 'Ancient Emerald', itemId: 7001, killCountAtDrop: 8, timestamp: now - 86400000 * 20 },
          ],
          avgKillsPerDrop: 8, killsSinceLastDrop: 7,
          ttk: { avgMs: 480000, lastMs: 510000, minMs: 420000 },
          lootPool: [
            { itemId: 7001, name: 'Ancient Emerald', icon: '', prob: '0.02%', rarity: 'ultimate' },
            { itemId: 7002, name: 'Bloody Sword', icon: '', prob: '0.1%', rarity: 'unique' },
            { itemId: 7003, name: 'Platinum Ore', icon: '', prob: '2.0%', rarity: 'rare' },
            { itemId: 7004, name: 'Mithril', icon: '', prob: '5.0%', rarity: 'uncommon' },
          ]
        },
        {
          name: 'Shade', rank: 'violet', level: 78, element: null,
          hp: 210000, minAttack: 650, maxAttack: 980, iconUrl: '',
          kills: { today: 2, week: 9, month: 34, year: 156, total: 156 },
          lastKillTime: now - 5400000,
          drops: [],
          avgKillsPerDrop: null, killsSinceLastDrop: null,
          ttk: { avgMs: 35000, lastMs: 31000, minMs: 28000 },
          lootPool: [
            { itemId: 8001, name: 'Shadow Cloak', icon: '', prob: '0.4%', rarity: 'veryrare' },
            { itemId: 8002, name: 'Dark Stone', icon: '', prob: '4.0%', rarity: 'uncommon' },
          ]
        },
      ]
    };
  }

  // ── Data loading ──────────────────────────────────────────────────────

  async function discoverProfile() {
    if (!window.gtIpc) return 'demo';
    try {
      const res = unwrap(await window.gtIpc.invoke('panel:get:active-profile'));
      const pid = res?.profileId;
      if (pid && typeof pid === 'string' && pid !== 'default') return pid;
      if (Array.isArray(res?.profiles)) {
        for (const p of res.profiles) { if (typeof p === 'string' && p && p !== 'default') return p; }
      }
      return pid || 'default';
    } catch (_) { return 'default'; }
  }

  async function loadData() {
    if (!profileId) return;
    try {
      trackerData = unwrap(await window.gtIpc.invoke('gt:request:state', profileId));
    } catch (err) {
      console.error('Failed to load giant tracker state:', err);
      trackerData = { giants: [] };
    }
    if (!trackerData?.giants?.length && !window.gtIpc) trackerData = getDemoData();
    renderCards();
  }

  // ── Filtering / Sorting ───────────────────────────────────────────────

  function getFilteredGiants() {
    if (!trackerData?.giants) return [];
    let list = trackerData.giants;
    if (currentFilter === 'drops') list = list.filter(g => g.drops && g.drops.length > 0);
    else if (currentFilter !== 'all') list = list.filter(g => g.rank === currentFilter);
    if (searchQuery) { const q = searchQuery.toLowerCase(); list = list.filter(g => g.name.toLowerCase().includes(q)); }
    list = [...list];
    switch (currentSort) {
      case 'kills-desc': list.sort((a,b) => b.kills.total - a.kills.total); break;
      case 'kills-asc': list.sort((a,b) => a.kills.total - b.kills.total); break;
      case 'name-asc': list.sort((a,b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': list.sort((a,b) => b.name.localeCompare(a.name)); break;
      case 'level-asc': list.sort((a,b) => (a.level||0)-(b.level||0)); break;
      case 'level-desc': list.sort((a,b) => (b.level||0)-(a.level||0)); break;
    }
    return list;
  }

  // ── Rendering ─────────────────────────────────────────────────────────

  function renderMonsterIcon(g) {
    const ri = g.rank === 'giant' ? 'G' : g.rank === 'boss' ? 'B' : 'V';
    const rc = `rank-${g.rank}`;
    if (g.iconUrl) {
      return `<img class="gt-monster-icon" src="${escapeHtml(g.iconUrl)}" alt="${escapeHtml(g.name)}" loading="lazy"
                onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
              <div class="gt-icon-placeholder ${rc}" style="display:none">${ri}</div>`;
    }
    return `<div class="gt-icon-placeholder ${rc}">${ri}</div>`;
  }

  function renderDropHistory(g) {
    if (!g.drops || g.drops.length === 0) return '';
    const isOpen = dropListOpen.has(g.name);
    const items = g.drops.map((drop, idx) => `
      <div class="gt-drop-item">
        <span class="gt-drop-item-name" title="${escapeHtml(drop.itemName)}">${escapeHtml(drop.itemName)}</span>
        <span class="gt-drop-item-kills">@ ${drop.killCountAtDrop || 0} kills</span>
        <span class="gt-drop-item-time">${formatDate(drop.timestamp)}</span>
        <button class="gt-drop-delete-btn" data-monster="${escapeHtml(g.name)}" data-index="${idx}">x</button>
      </div>
    `).join('');
    const label = g.drops.length === 1 ? t('dropLogged') : t('dropsLogged');
    return `
      <div class="gt-drop-history">
        <button class="gt-drop-toggle" data-monster="${escapeHtml(g.name)}">${isOpen ? '&#9660;' : '&#9654;'} ${g.drops.length} ${label}</button>
        <div class="gt-drop-list ${isOpen ? 'open' : ''}">${items}</div>
      </div>`;
  }

  function renderCombatStats(g) {
    const parts = [];
    if (g.hp != null) parts.push(`<span class="gt-combat-stat" title="${t('hp')}: ${g.hp.toLocaleString()}">${t('hp')}: ${formatBigNumber(g.hp)}</span>`);
    if (g.minAttack != null && g.maxAttack != null) parts.push(`<span class="gt-combat-stat" title="${t('atk')}: ${g.minAttack.toLocaleString()} - ${g.maxAttack.toLocaleString()}">${t('atk')}: ${formatBigNumber(g.minAttack)}-${formatBigNumber(g.maxAttack)}</span>`);
    return parts.length > 0 ? `<div class="gt-card-combat">${parts.join('')}</div>` : '';
  }

  function renderLootPoolPreview(g) {
    if (!g.lootPool || g.lootPool.length === 0) return '';
    const basePath = trackerData?.itemIconsBasePath || '';
    const sorted = [...g.lootPool].sort((a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0));
    const top = sorted.slice(0, 5);
    const items = top.map(item => {
      const iconSrc = item.icon ? `${basePath}${item.icon}` : '';
      const iconHtml = iconSrc ? `<img src="${escapeHtml(iconSrc)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '';
      const rarityClass = item.rarity ? `rarity-${escapeHtml(item.rarity)}` : '';
      return `<span class="gt-loot-pool-preview-item ${rarityClass}" title="${escapeHtml(item.name)}">${iconHtml}${escapeHtml(item.name)}</span>`;
    }).join('');
    const more = g.lootPool.length > 5 ? ` <span style="font-size:10px;color:var(--muted,#888)">+${g.lootPool.length - 5}</span>` : '';
    return `<div class="gt-loot-pool-preview">
      <div class="gt-loot-pool-preview-title">Loot Pool</div>
      <div class="gt-loot-pool-preview-items">${items}${more}</div>
    </div>`;
  }

  function renderCard(g) {
    const isExpanded = expandedCards.has(g.name) || currentFilter !== 'all';
    const isDropsView = currentFilter === 'drops';
    const elBadge = g.element ? `<span class="gt-element-badge ${escapeHtml(g.element)}">${escapeHtml(g.element)}</span>` : '';
    const dc = g.drops ? g.drops.length : 0;
    const avg = g.avgKillsPerDrop !== null ? `${g.avgKillsPerDrop}` : '-';
    const since = g.killsSinceLastDrop !== null ? g.killsSinceLastDrop : '-';
    const rankLabel = g.rank === 'giant' ? t('giant') : g.rank === 'boss' ? t('boss') : t('violet');
    const rankColor = g.rank === 'giant' ? '#fbbf24' : g.rank === 'boss' ? '#ef4444' : '#a855f7';

    // TTK compact text
    const ttkCompact = g.ttk && g.ttk.lastMs ? `<div class="gt-ttk-compact">${t('ttk')}: ${formatTtk(g.ttk.lastMs)}${g.ttk.avgMs ? ` (${t('avg')} ${formatTtk(g.ttk.avgMs)})` : ''}</div>` : '';

    // Compact: Today + Total + expand button
    if (!isExpanded) {
      return `
        <div class="gt-card rank-${escapeHtml(g.rank)}">
          <div class="gt-card-header">
            ${renderMonsterIcon(g)}
            <div class="gt-card-info">
              <div class="gt-card-name" title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</div>
              <div class="gt-card-meta">
                ${g.level ? `<span>Lv. ${g.level}</span>` : ''}
                ${elBadge}
                <span style="color:${rankColor}">${rankLabel}</span>
              </div>
              ${renderCombatStats(g)}
            </div>
            <div class="gt-card-quick">
              <div class="gt-quick-stat"><span class="gt-kills-label">${t('today')}</span><span class="gt-kills-value">${g.kills.today.toLocaleString()}</span></div>
              <div class="gt-quick-stat"><span class="gt-kills-label">${t('total')}</span><span class="gt-kills-value">${g.kills.total.toLocaleString()}</span></div>
              ${ttkCompact}
            </div>
          </div>
          <div class="gt-card-actions">
            <span class="gt-card-last-kill">${t('lastKill')}: ${timeAgo(g.lastKillTime)}</span>
            <span class="gt-card-drop-summary">${t('drops')}: ${dc}</span>
            <button class="gt-expand-btn" data-monster="${escapeHtml(g.name)}">${t('expand')}</button>
          </div>
        </div>`;
    }

    // Expanded: Full detail
    return `
      <div class="gt-card rank-${escapeHtml(g.rank)} expanded">
        <div class="gt-card-header">
          ${renderMonsterIcon(g)}
          <div class="gt-card-info">
            <div class="gt-card-name" title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</div>
            <div class="gt-card-meta">
              ${g.level ? `<span>Lv. ${g.level}</span>` : ''}
              ${elBadge}
              <span style="color:${rankColor}">${rankLabel}</span>
            </div>
            ${renderCombatStats(g)}
          </div>
        </div>
        <div class="gt-kills-table">
          <div class="gt-kills-row"><span class="gt-kills-label">${t('today')}</span><span class="gt-kills-value">${g.kills.today.toLocaleString()}</span></div>
          <div class="gt-kills-row"><span class="gt-kills-label">${t('week')}</span><span class="gt-kills-value">${g.kills.week.toLocaleString()}</span></div>
          <div class="gt-kills-row"><span class="gt-kills-label">${t('month')}</span><span class="gt-kills-value">${g.kills.month.toLocaleString()}</span></div>
          <div class="gt-kills-row"><span class="gt-kills-label">${t('year')}</span><span class="gt-kills-value">${g.kills.year.toLocaleString()}</span></div>
          <div class="gt-kills-row"><span class="gt-kills-label">${t('total')}</span><span class="gt-kills-value">${g.kills.total.toLocaleString()}</span></div>
          ${g.ttk ? `
          <div class="gt-kills-row gt-ttk-row"><span class="gt-kills-label">${t('avgTtk')}</span><span class="gt-kills-value">${formatTtk(g.ttk.avgMs)}</span></div>
          <div class="gt-kills-row gt-ttk-row"><span class="gt-kills-label">${t('lastTtk')}</span><span class="gt-kills-value">${formatTtk(g.ttk.lastMs)}</span></div>
          <div class="gt-kills-row gt-ttk-row"><span class="gt-kills-label">${t('fastest')}</span><span class="gt-kills-value">${formatTtk(g.ttk.minMs)}</span></div>
          ` : ''}
        </div>
        <div class="gt-drops">
          <div class="gt-drops-summary">
            <span class="gt-drops-summary-text">${t('drops')}: ${dc} | ${t('avg')}: ${avg} ${t('killsPerDrop')} | ${t('sinceLast')}: ${since}</span>
            <button class="gt-log-drop-btn" data-monster="${escapeHtml(g.name)}">${t('logDrop')}</button>
          </div>
          ${renderDropHistory(g)}
        </div>
        ${isDropsView ? renderLootPoolPreview(g) : ''}
        <div class="gt-card-actions">
          <span class="gt-card-last-kill">${t('lastKill')}: ${timeAgo(g.lastKillTime)}</span>
          ${currentFilter === 'all' ? `<button class="gt-expand-btn" data-monster="${escapeHtml(g.name)}">${t('collapse')}</button>` : ''}
        </div>
      </div>`;
  }

  function renderCards() {
    const giants = getFilteredGiants();
    if (giants.length === 0) {
      const emptyMsg = currentFilter === 'drops' ? t('dropsEmpty') : t('empty');
      cardsEl.innerHTML = `<div class="gt-empty">${emptyMsg}</div>`;
      return;
    }
    cardsEl.innerHTML = giants.map(renderCard).join('');
    attachCardListeners();
  }

  function attachCardListeners() {
    cardsEl.querySelectorAll('.gt-log-drop-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const g = trackerData?.giants?.find(g => g.name === btn.dataset.monster);
        if (g) openDropDialog(g);
      });
    });
    cardsEl.querySelectorAll('.gt-drop-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const n = btn.dataset.monster;
        dropListOpen.has(n) ? dropListOpen.delete(n) : dropListOpen.add(n);
        renderCards();
      });
    });
    cardsEl.querySelectorAll('.gt-drop-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const res = unwrap(await window.gtIpc.invoke('gt:delete:drop', profileId, btn.dataset.monster, parseInt(btn.dataset.index,10)));
          if (res?.success) await loadData();
        } catch (err) { console.error('Failed to delete drop:', err); }
      });
    });
    cardsEl.querySelectorAll('.gt-expand-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const n = btn.dataset.monster;
        expandedCards.has(n) ? expandedCards.delete(n) : expandedCards.add(n);
        renderCards();
      });
    });
  }

  // ── Drop dialog ───────────────────────────────────────────────────────

  function openDropDialog(giant) {
    dropDialogMonster = { name: giant.name, lootPool: giant.lootPool || [] };
    dropTitle.textContent = `${t('logDropTitle')} - ${giant.name}`;
    dropSearch.value = '';
    currentRarityFilter = 'all';
    applyRarityFilterUI();
    renderLootGrid(dropDialogMonster.lootPool);
    dropModal.classList.add('open');
    dropSearch.focus();
  }

  function closeDropDialog() { dropModal.classList.remove('open'); dropDialogMonster = null; }

  function applyRarityFilterUI() {
    if (!rarityFilterEl) return;
    rarityFilterEl.querySelectorAll('.gt-rarity-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.rarity === currentRarityFilter);
    });
  }

  const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, veryrare: 3, unique: 4, ultimate: 5 };
  const RARITY_KEYS = ['common', 'uncommon', 'rare', 'veryrare', 'unique', 'ultimate'];

  function renderLootGrid(items) {
    const basePath = trackerData?.itemIconsBasePath || '';
    const query = (dropSearch.value || '').toLowerCase();
    let filtered = items;
    if (currentRarityFilter !== 'all') filtered = filtered.filter(it => it.rarity === currentRarityFilter);
    if (query) filtered = filtered.filter(it => it.name.toLowerCase().includes(query));
    if (filtered.length === 0) {
      lootGrid.innerHTML = `<div class="gt-loot-empty">${items.length === 0 ? t('noLootPool') : t('noMatch')}</div>`;
      return;
    }
    lootGrid.innerHTML = filtered.map(item => {
      const iconSrc = item.icon ? `${basePath}${item.icon}` : '';
      const iconHtml = iconSrc ? `<img class="gt-loot-item-icon" src="${escapeHtml(iconSrc)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '';
      const rarityClass = item.rarity ? `rarity-${escapeHtml(item.rarity)}` : '';
      return `<div class="gt-loot-item ${rarityClass}" data-item-id="${item.itemId}" data-item-name="${escapeHtml(item.name)}">
          ${iconHtml}
          <div class="gt-loot-item-info">
            <div class="gt-loot-item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
            <div class="gt-loot-item-prob">${escapeHtml(item.prob)}${item.rarity && item.rarity !== 'common' ? ` <span class="gt-rarity-tag ${rarityClass}">${t(item.rarity) || item.rarity}</span>` : ''}</div>
          </div></div>`;
    }).join('');
    lootGrid.querySelectorAll('.gt-loot-item').forEach(el => {
      el.addEventListener('click', async () => {
        if (!dropDialogMonster) return;
        try {
          const res = unwrap(await window.gtIpc.invoke('gt:log:drop', profileId, dropDialogMonster.name, parseInt(el.dataset.itemId,10), el.dataset.itemName));
          if (res?.success) { closeDropDialog(); await loadData(); }
        } catch (err) { console.error('Failed to log drop:', err); }
      });
    });
  }

  // ── Static translations ───────────────────────────────────────────────

  function applyTranslations() {
    document.title = t('title');
    const h1 = document.querySelector('.gt-header h1');
    if (h1) h1.textContent = t('title');
    const btns = rankFilterEl.querySelectorAll('.gt-filter-btn');
    if (btns[0]) btns[0].textContent = t('all');
    if (btns[1]) btns[1].textContent = t('giants');
    if (btns[2]) btns[2].textContent = t('violets');
    if (btns[3]) btns[3].textContent = t('bosses');
    if (btns[4]) btns[4].textContent = t('drops');
    if (searchEl) searchEl.placeholder = t('search');
    if (dropSearch) dropSearch.placeholder = t('searchItems');
    // Sort options
    const opts = sortEl?.options;
    if (opts && opts.length >= 6) {
      opts[0].textContent = t('killsDesc');
      opts[1].textContent = t('killsAsc');
      opts[2].textContent = t('nameAsc');
      opts[3].textContent = t('nameDesc');
      opts[4].textContent = t('levelAsc');
      opts[5].textContent = t('levelDesc');
    }
    // Rarity filter buttons
    if (rarityFilterEl) {
      const rbtns = rarityFilterEl.querySelectorAll('.gt-rarity-btn');
      rbtns.forEach(btn => {
        const r = btn.dataset.rarity;
        btn.textContent = r === 'all' ? t('allRarity') : (t(r) || r);
      });
    }
  }

  // ── Event handlers ────────────────────────────────────────────────────

  rankFilterEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.gt-filter-btn');
    if (!btn) return;
    rankFilterEl.querySelectorAll('.gt-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.rank;
    renderCards();
  });
  sortEl.addEventListener('change', () => { currentSort = sortEl.value; renderCards(); });
  searchEl.addEventListener('input', () => { searchQuery = searchEl.value.trim(); renderCards(); });
  dropClose.addEventListener('click', closeDropDialog);
  dropModal.addEventListener('click', (e) => { if (e.target === dropModal) closeDropDialog(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dropModal.classList.contains('open')) closeDropDialog(); });
  dropSearch.addEventListener('input', () => { if (dropDialogMonster) renderLootGrid(dropDialogMonster.lootPool); });
  if (rarityFilterEl) {
    rarityFilterEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.gt-rarity-btn');
      if (!btn) return;
      currentRarityFilter = btn.dataset.rarity;
      applyRarityFilterUI();
      if (dropDialogMonster) renderLootGrid(dropDialogMonster.lootPool);
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────

  async function init() {
    applyTranslations();
    await syncTheme();
    profileId = await discoverProfile();
    if (profileEl) profileEl.textContent = `${t('profile')}: ${profileId}`;
    await loadData();
    setInterval(async () => {
      const np = await discoverProfile();
      if (np && np !== profileId) { profileId = np; if (profileEl) profileEl.textContent = `${t('profile')}: ${profileId}`; }
      await loadData();
    }, 5000);
  }

  window.addEventListener('load', init);
})();

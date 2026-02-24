(function() {
    'use strict';

    // ─── Locale Detection ───────────────────────────────────────────────────

    function detectLocale() {
        try {
            const qs = new URLSearchParams(window.location.search || '');
            const fromQuery = qs.get('locale');
            const fromAttr = document.documentElement?.lang;
            const raw = (window.__pluginLocale || fromQuery || fromAttr || navigator.language || 'en')
                .slice(0, 2).toLowerCase();
            return raw === 'zh' ? 'cn' : raw === 'ja' ? 'jp' : raw;
        } catch (_) { return 'en'; }
    }

    const locale = detectLocale();

    // ─── Translations ───────────────────────────────────────────────────────

    const translations = {
        en: {
            title: 'Quest Guide',
            searchPlaceholder: 'Search quests, NPCs, items...',
            level: 'Lv:',
            region: 'Region:',
            regionAll: 'All',
            typeAll: 'All',
            typeChain: 'Chain',
            typeDaily: 'Daily',
            typeRepeat: 'Repeat',
            typeCategory: 'Special',
            subcategoryAll: 'All',
            subcategoryRaisingPet: 'Raising Pet',
            subcategoryCollection: 'Collection',
            subcategoryMonsterHunt: 'Monster Hunt',
            subcategoryDelivery: 'Delivery',
            subcategoryOther: 'Other',
            showCompleted: 'Completed',
            showUnavailable: 'Unavailable',
            total: 'Total',
            available: 'Avail',
            completed: 'Done',
            loading: 'Loading quests...',
            noData: 'No data. Run API-Fetch: Quest, NPC, Monster, Item',
            noResults: 'No quests match your filters.',
            error: 'Error',
            startNpc: 'Start NPC',
            turnInNpc: 'Turn in NPC',
            world: 'World',
            unknownPos: 'Pos unknown',
            monsterObjectives: 'Monster Objectives',
            itemObjectives: 'Item Objectives',
            prerequisites: 'Prerequisites',
            followUpQuests: 'Follow-up Quests',
            rewards: 'Rewards',
            gold: 'Penya',
            experience: 'EXP',
            description: 'Description',
            kill: 'Kill',
            collect: 'Collect',
            markComplete: 'Mark Complete',
            markIncomplete: 'Mark Incomplete',
            from: 'From',
            chain: 'Chain',
            chainProgress: 'Chain ({n}/{total})',
            levelRange: 'Level',
            minLevel: 'Min:',
            maxLevel: 'Max:',
            range: '±',
            ocrLevel: 'OCR Lv:',
            modeOcr: 'OCR ±',
            modeFixed: 'Min-Max:',
            ocrNotActive: 'OCR not active',
            resetProgress: 'Reset Progress',
            resetConfirm: 'Reset all quest progress for this profile?',
            resetDone: 'Progress reset',
            savedFeedback: 'Saved'
        },
        de: {
            title: 'Quest Guide',
            searchPlaceholder: 'Quests, NPCs, Items suchen...',
            level: 'Lv:',
            region: 'Region:',
            regionAll: 'Alle',
            typeAll: 'Alle',
            typeChain: 'Kette',
            typeDaily: 'Daily',
            typeRepeat: 'Wiederholbar',
            typeCategory: 'Spezial',
            subcategoryAll: 'Alle',
            subcategoryRaisingPet: 'Pet-Aufzucht',
            subcategoryCollection: 'Sammeln',
            subcategoryMonsterHunt: 'Monsterjagd',
            subcategoryDelivery: 'Lieferung',
            subcategoryOther: 'Sonstige',
            showCompleted: 'Erledigte',
            showUnavailable: 'Gesperrte',
            total: 'Gesamt',
            available: 'Verf',
            completed: 'Erled',
            loading: 'Lade Quests...',
            noData: 'Keine Daten. API-Fetch ausfuehren: Quest, NPC, Monster, Item',
            noResults: 'Keine Quests entsprechen deinen Filtern.',
            error: 'Fehler',
            startNpc: 'Start-NPC',
            turnInNpc: 'Abgabe-NPC',
            world: 'Welt',
            unknownPos: 'Pos unbekannt',
            monsterObjectives: 'Monster-Ziele',
            itemObjectives: 'Gegenstands-Ziele',
            prerequisites: 'Voraussetzungen',
            followUpQuests: 'Folge-Quests',
            rewards: 'Belohnungen',
            gold: 'Penya',
            experience: 'EXP',
            description: 'Beschreibung',
            kill: 'Besiege',
            collect: 'Sammle',
            markComplete: 'Erledigt',
            markIncomplete: 'Nicht erledigt',
            from: 'Von',
            chain: 'Kette',
            chainProgress: 'Kette ({n}/{total})',
            levelRange: 'Level',
            minLevel: 'Min:',
            maxLevel: 'Max:',
            range: '±',
            ocrLevel: 'OCR Lv:',
            modeOcr: 'OCR ±',
            modeFixed: 'Min-Max:',
            ocrNotActive: 'OCR nicht aktiv',
            resetProgress: 'Fortschritt zurücksetzen',
            resetConfirm: 'Gesamten Questfortschritt für dieses Profil zurücksetzen?',
            resetDone: 'Fortschritt zurückgesetzt',
            savedFeedback: 'Gespeichert'
        },
        fr: {
            title: 'Guide de quêtes',
            searchPlaceholder: 'Rechercher quêtes, PNJ, objets...',
            level: 'Nv:',
            region: 'Région:',
            regionAll: 'Toutes',
            typeAll: 'Tout',
            typeChain: 'Chaîne',
            typeDaily: 'Quotidienne',
            typeRepeat: 'Répétable',
            typeCategory: 'Spéciale',
            subcategoryAll: 'Tout',
            subcategoryRaisingPet: 'Élevage',
            subcategoryCollection: 'Collection',
            subcategoryMonsterHunt: 'Chasse',
            subcategoryDelivery: 'Livraison',
            subcategoryOther: 'Autre',
            showCompleted: 'Terminées',
            showUnavailable: 'Non dispo.',
            total: 'Total',
            available: 'Dispo.',
            completed: 'Faites',
            loading: 'Chargement...',
            noData: 'Aucune donnée. Lancez API-Fetch: Quête, PNJ, Monstre, Objet',
            noResults: 'Aucune quête trouvée',
            error: 'Erreur',
            startNpc: 'Départ',
            turnInNpc: 'Fin',
            world: 'Monde',
            unknownPos: 'Pos inconnue',
            monsterObjectives: 'Objectifs Monstres',
            itemObjectives: 'Objectifs Objets',
            prerequisites: 'Prérequis',
            followUpQuests: 'Suite',
            rewards: 'Récompenses',
            gold: 'Or',
            experience: 'EXP',
            description: 'Description',
            kill: 'Tuer',
            collect: 'Collecter',
            markComplete: 'Marquer terminée',
            markIncomplete: 'Marquer non terminée',
            from: 'De',
            chain: 'Chaîne',
            chainProgress: 'Chaîne ({n}/{total})',
            levelRange: 'Niveau',
            minLevel: 'Min:',
            maxLevel: 'Max:',
            range: '±',
            ocrLevel: 'OCR Nv:',
            modeOcr: 'OCR ±',
            modeFixed: 'Min-Max:',
            ocrNotActive: 'OCR inactif',
            resetProgress: 'Réinitialiser la progression',
            resetConfirm: 'Réinitialiser toute la progression des quêtes pour ce profil ?',
            resetDone: 'Progression réinitialisée',
            savedFeedback: 'Sauvegardé'
        },
        pl: {
            title: 'Przewodnik po questach',
            searchPlaceholder: 'Szukaj questów, NPC, przedmiotów...',
            level: 'Poz:',
            region: 'Region:',
            regionAll: 'Wszystkie',
            typeAll: 'Wszystkie',
            typeChain: 'Łańcuch',
            typeDaily: 'Dzienne',
            typeRepeat: 'Powtarzalne',
            typeCategory: 'Specjalne',
            subcategoryAll: 'Wszystkie',
            subcategoryRaisingPet: 'Hodowla',
            subcategoryCollection: 'Kolekcja',
            subcategoryMonsterHunt: 'Polowanie',
            subcategoryDelivery: 'Dostawa',
            subcategoryOther: 'Inne',
            showCompleted: 'Ukończone',
            showUnavailable: 'Niedostępne',
            total: 'Łącznie',
            available: 'Dostępne',
            completed: 'Zrobione',
            loading: 'Ładowanie...',
            noData: 'Brak danych. Uruchom API-Fetch: Quest, NPC, Monster, Item',
            noResults: 'Nie znaleziono questów',
            error: 'Błąd',
            startNpc: 'Start',
            turnInNpc: 'Koniec',
            world: 'Świat',
            unknownPos: 'Poz nieznana',
            monsterObjectives: 'Cele Potwory',
            itemObjectives: 'Cele Przedmioty',
            prerequisites: 'Wymagania',
            followUpQuests: 'Następny',
            rewards: 'Nagrody',
            gold: 'Złoto',
            experience: 'EXP',
            description: 'Opis',
            kill: 'Zabij',
            collect: 'Zbierz',
            markComplete: 'Oznacz jako ukończony',
            markIncomplete: 'Oznacz jako nieukończony',
            from: 'Od',
            chain: 'Łańcuch',
            chainProgress: 'Łańcuch ({n}/{total})',
            levelRange: 'Poziom',
            minLevel: 'Min:',
            maxLevel: 'Max:',
            range: '±',
            ocrLevel: 'OCR Poz:',
            modeOcr: 'OCR ±',
            modeFixed: 'Min-Max:',
            ocrNotActive: 'OCR nieaktywny',
            resetProgress: 'Resetuj postęp',
            resetConfirm: 'Zresetować cały postęp questów dla tego profilu?',
            resetDone: 'Postęp zresetowany',
            savedFeedback: 'Zapisano'
        },
        ru: {
            title: 'Гайд по квестам',
            searchPlaceholder: 'Поиск квестов, NPC, предметов...',
            level: 'Ур:',
            region: 'Регион:',
            regionAll: 'Все',
            typeAll: 'Все',
            typeChain: 'Цепочка',
            typeDaily: 'Ежедневные',
            typeRepeat: 'Повторяемые',
            typeCategory: 'Особые',
            subcategoryAll: 'Все',
            subcategoryRaisingPet: 'Питомец',
            subcategoryCollection: 'Сбор',
            subcategoryMonsterHunt: 'Охота',
            subcategoryDelivery: 'Доставка',
            subcategoryOther: 'Другое',
            showCompleted: 'Завершённые',
            showUnavailable: 'Недоступные',
            total: 'Всего',
            available: 'Доступно',
            completed: 'Готово',
            loading: 'Загрузка...',
            noData: 'Нет данных. Запустите API-Fetch: Quest, NPC, Monster, Item',
            noResults: 'Квесты не найдены',
            error: 'Ошибка',
            startNpc: 'Начало',
            turnInNpc: 'Конец',
            world: 'Мир',
            unknownPos: 'Поз неизвестна',
            monsterObjectives: 'Цели Монстры',
            itemObjectives: 'Цели Предметы',
            prerequisites: 'Требования',
            followUpQuests: 'Далее',
            rewards: 'Награды',
            gold: 'Золото',
            experience: 'Опыт',
            description: 'Описание',
            kill: 'Убить',
            collect: 'Собрать',
            markComplete: 'Отметить выполненным',
            markIncomplete: 'Отметить невыполненным',
            from: 'От',
            chain: 'Цепочка',
            chainProgress: 'Цепочка ({n}/{total})',
            levelRange: 'Уровень',
            minLevel: 'Мин:',
            maxLevel: 'Макс:',
            range: '±',
            ocrLevel: 'OCR Ур:',
            modeOcr: 'OCR ±',
            modeFixed: 'Мин-Макс:',
            ocrNotActive: 'OCR неактивен',
            resetProgress: 'Сбросить прогресс',
            resetConfirm: 'Сбросить весь прогресс квестов для этого профиля?',
            resetDone: 'Прогресс сброшен',
            savedFeedback: 'Сохранено'
        },
        tr: {
            title: 'Görev Rehberi',
            searchPlaceholder: 'Görev, NPC, eşya ara...',
            level: 'Sv:',
            region: 'Bölge:',
            regionAll: 'Tümü',
            typeAll: 'Tümü',
            typeChain: 'Zincir',
            typeDaily: 'Günlük',
            typeRepeat: 'Tekrarlanabilir',
            typeCategory: 'Özel',
            subcategoryAll: 'Tümü',
            subcategoryRaisingPet: 'Evcil Hayvan',
            subcategoryCollection: 'Koleksiyon',
            subcategoryMonsterHunt: 'Canavar Avı',
            subcategoryDelivery: 'Teslimat',
            subcategoryOther: 'Diğer',
            showCompleted: 'Tamamlananlar',
            showUnavailable: 'Kullanılamaz',
            total: 'Toplam',
            available: 'Mevcut',
            completed: 'Bitti',
            loading: 'Yükleniyor...',
            noData: 'Veri yok. API-Fetch çalıştırın: Quest, NPC, Monster, Item',
            noResults: 'Görev bulunamadı',
            error: 'Hata',
            startNpc: 'Başlangıç',
            turnInNpc: 'Bitiş',
            world: 'Dünya',
            unknownPos: 'Poz bilinmiyor',
            monsterObjectives: 'Canavar Hedefleri',
            itemObjectives: 'Eşya Hedefleri',
            prerequisites: 'Gereksinimler',
            followUpQuests: 'Sonraki',
            rewards: 'Ödüller',
            gold: 'Altın',
            experience: 'EXP',
            description: 'Açıklama',
            kill: 'Öldür',
            collect: 'Topla',
            markComplete: 'Tamamlandı olarak işaretle',
            markIncomplete: 'Tamamlanmadı olarak işaretle',
            from: 'Dan',
            chain: 'Zincir',
            chainProgress: 'Zincir ({n}/{total})',
            levelRange: 'Seviye',
            minLevel: 'Min:',
            maxLevel: 'Max:',
            range: '±',
            ocrLevel: 'OCR Sv:',
            modeOcr: 'OCR ±',
            modeFixed: 'Min-Maks:',
            ocrNotActive: 'OCR etkin değil',
            resetProgress: 'İlerlemeyi sıfırla',
            resetConfirm: 'Bu profil için tüm görev ilerlemesi sıfırlansın mı?',
            resetDone: 'İlerleme sıfırlandı',
            savedFeedback: 'Kaydedildi'
        },
        cn: {
            title: '任务指南',
            searchPlaceholder: '搜索任务、NPC、物品...',
            level: '等级:',
            region: '地区:',
            regionAll: '全部',
            typeAll: '全部',
            typeChain: '链式',
            typeDaily: '每日',
            typeRepeat: '重复',
            typeCategory: '特殊',
            subcategoryAll: '全部',
            subcategoryRaisingPet: '养宠',
            subcategoryCollection: '收集',
            subcategoryMonsterHunt: '猎怪',
            subcategoryDelivery: '配送',
            subcategoryOther: '其他',
            showCompleted: '已完成',
            showUnavailable: '不可用',
            total: '总计',
            available: '可用',
            completed: '完成',
            loading: '加载中...',
            noData: '无数据。请运行 API-Fetch: Quest, NPC, Monster, Item',
            noResults: '未找到任务',
            error: '错误',
            startNpc: '起始',
            turnInNpc: '结束',
            world: '世界',
            unknownPos: '位置未知',
            monsterObjectives: '怪物目标',
            itemObjectives: '物品目标',
            prerequisites: '前提',
            followUpQuests: '后续',
            rewards: '奖励',
            gold: '金币',
            experience: '经验',
            description: '描述',
            kill: '击杀',
            collect: '收集',
            markComplete: '标记为已完成',
            markIncomplete: '标记为未完成',
            from: '从',
            chain: '链式',
            chainProgress: '链式 ({n}/{total})',
            levelRange: '等级',
            minLevel: '最小:',
            maxLevel: '最大:',
            range: '±',
            ocrLevel: 'OCR 等级:',
            modeOcr: 'OCR ±',
            modeFixed: '最小-最大:',
            ocrNotActive: 'OCR 未激活',
            resetProgress: '重置进度',
            resetConfirm: '重置此配置文件的所有任务进度？',
            resetDone: '进度已重置',
            savedFeedback: '已保存'
        },
        jp: {
            title: 'クエストガイド',
            searchPlaceholder: 'クエスト、NPC、アイテムを検索...',
            level: 'Lv:',
            region: 'リージョン:',
            regionAll: 'すべて',
            typeAll: 'すべて',
            typeChain: 'チェーン',
            typeDaily: 'デイリー',
            typeRepeat: '繰り返し',
            typeCategory: '特殊',
            subcategoryAll: 'すべて',
            subcategoryRaisingPet: 'ペット育成',
            subcategoryCollection: 'コレクション',
            subcategoryMonsterHunt: 'モンスター狩り',
            subcategoryDelivery: '配達',
            subcategoryOther: 'その他',
            showCompleted: '完了済み',
            showUnavailable: '利用不可',
            total: '合計',
            available: '利用可',
            completed: '完了',
            loading: '読み込み中...',
            noData: 'データなし。API-Fetchを実行してください: Quest, NPC, Monster, Item',
            noResults: 'クエストが見つかりません',
            error: 'エラー',
            startNpc: '開始',
            turnInNpc: '終了',
            world: 'ワールド',
            unknownPos: '位置不明',
            monsterObjectives: 'モンスター目標',
            itemObjectives: 'アイテム目標',
            prerequisites: '前提条件',
            followUpQuests: '次のクエスト',
            rewards: '報酬',
            gold: 'ゴールド',
            experience: 'EXP',
            description: '説明',
            kill: '討伐',
            collect: '収集',
            markComplete: '完了としてマーク',
            markIncomplete: '未完了としてマーク',
            from: 'から',
            chain: 'チェーン',
            chainProgress: 'チェーン ({n}/{total})',
            levelRange: 'レベル',
            minLevel: '最小:',
            maxLevel: '最大:',
            range: '±',
            ocrLevel: 'OCR Lv:',
            modeOcr: 'OCR ±',
            modeFixed: '最小-最大:',
            ocrNotActive: 'OCR 非アクティブ',
            resetProgress: '進捗をリセット',
            resetConfirm: 'このプロファイルのすべてのクエスト進捗をリセットしますか？',
            resetDone: '進捗がリセットされました',
            savedFeedback: '保存済み'
        }
    };

    const L = translations[locale] || translations.en;

    // ─── IPC Helper ─────────────────────────────────────────────────────────

    async function ipc(channel, ...args) {
        if (window.plugin?.ipc?.invoke) {
            return await window.plugin.ipc.invoke(channel, ...args);
        }
        if (window.parent?.invokePluginChannel && window.__pluginId) {
            return await window.parent.invokePluginChannel(window.__pluginId, channel, ...args);
        }
        throw new Error('IPC unavailable');
    }

    // ─── State ──────────────────────────────────────────────────────────────

    const state = {
        quests: [],
        stats: { total: 0, available: 0, completed: 0, chains: 0 },
        profileId: null,
        expandedQuestId: null,
        detailCache: {},
        settings: { 
            levelMode: 'ocr', 
            ocrRange: 5, 
            manualLevel: 1, 
            manualRange: 5,
            minLevel: 1, 
            maxLevel: 30, 
            showCompleted: false, 
            showUnavailable: false, 
            language: locale 
        },
        currentTypeFilter: 'all',
        currentSubcategoryFilter: null,
        availableSubcategories: [],
        searchDebounceTimer: null,
        regions: [],
        isLoading: false
    };

    // ─── DOM References ─────────────────────────────────────────────────────

    const el = {};
    var ocrLevel = null;

    function saveFilterState() {
        try {
            var filterState = {
                search: el.searchInput ? el.searchInput.value : '',
                currentTypeFilter: state.currentTypeFilter,
                currentSubcategoryFilter: state.currentSubcategoryFilter,
                selectedRegion: el.regionSelect ? el.regionSelect.value : ''
            };
            sessionStorage.setItem('questguide_filter_state', JSON.stringify(filterState));
        } catch (_) {}
    }

    function loadFilterState() {
        try {
            var raw = sessionStorage.getItem('questguide_filter_state');
            if (!raw) return;
            var fs = JSON.parse(raw);
            if (fs.search && el.searchInput) el.searchInput.value = fs.search;
            if (fs.currentTypeFilter) {
                state.currentTypeFilter = fs.currentTypeFilter;
                if (el.typeToggle) {
                    el.typeToggle.querySelectorAll('.type-btn').forEach(function(b) {
                        b.classList.toggle('active', b.dataset.type === fs.currentTypeFilter);
                    });
                }
            }
            if (fs.currentSubcategoryFilter !== undefined) state.currentSubcategoryFilter = fs.currentSubcategoryFilter;
            if (fs.selectedRegion && el.regionSelect) el.regionSelect.value = fs.selectedRegion;
        } catch (_) {}
    }

    function init() {
        try {
            el.headerTitle = document.getElementById('headerTitle');
            el.searchInput = document.getElementById('searchInput');
            el.ocrLevelDisplay = document.getElementById('ocrLevelDisplay');
            el.ocrIndicator = document.getElementById('ocrIndicator');
            el.regionSelect = document.getElementById('regionSelect');
            el.showCompleted = document.getElementById('showCompleted');
            el.showUnavailable = document.getElementById('showUnavailable');
            el.statsBar = document.getElementById('statsBar');
            el.statTotal = document.getElementById('statTotal');
            el.statAvailable = document.getElementById('statAvailable');
            el.statCompleted = document.getElementById('statCompleted');
            el.questList = document.getElementById('questList');
            el.loadingMsg = document.getElementById('loadingMsg');
            el.typeToggle = document.getElementById('typeToggle');
            el.subcategoryToggle = document.getElementById('subcategoryToggle');
            el.resetProgressBtn = document.getElementById('resetProgressBtn');
            
            // Level mode elements
            el.modeOcr = document.getElementById('modeOcr');
            el.modeManual = document.getElementById('modeManual');
            el.modeFixed = document.getElementById('modeFixed');
            el.ocrRangeInput = document.getElementById('ocrRangeInput');
            el.manualLevelInput = document.getElementById('manualLevelInput');
            el.manualRangeInput = document.getElementById('manualRangeInput');
            el.minLevelInput = document.getElementById('minLevelInput');
            el.maxLevelInput = document.getElementById('maxLevelInput');

            // Localize UI
            el.headerTitle.textContent = L.title;
            el.searchInput.placeholder = L.searchPlaceholder;
            
            var labelOcrLevel = document.getElementById('labelOcrLevel');
            var labelRegion = document.getElementById('labelRegion');
            var labelModeOcr = document.getElementById('labelModeOcr');
            var labelModeManual = document.getElementById('labelModeManual');
            var labelModeFixed = document.getElementById('labelModeFixed');
            var btnAll = document.getElementById('btnAll');
            var btnChain = document.getElementById('btnChain');
            var btnRepeat = document.getElementById('btnRepeat');
            var btnCategory = document.getElementById('btnCategory');
            var labelCompleted = document.getElementById('labelCompleted');
            var labelUnavailable = document.getElementById('labelUnavailable');
            
            if (labelOcrLevel) labelOcrLevel.textContent = L.ocrLevel || 'OCR Level:';
            if (labelRegion) labelRegion.textContent = L.region;
            if (labelModeOcr) labelModeOcr.textContent = L.modeOcr || 'OCR ±';
            if (labelModeManual) labelModeManual.textContent = L.level;
            if (labelModeFixed) labelModeFixed.textContent = L.modeFixed || 'Min-Max:';
            if (btnAll) btnAll.textContent = L.typeAll;
            if (btnChain) btnChain.textContent = L.typeChain;
            if (btnRepeat) btnRepeat.textContent = L.typeRepeat;
            if (btnCategory) btnCategory.textContent = L.typeCategory;
            if (labelCompleted) labelCompleted.textContent = L.showCompleted;
            if (labelUnavailable) labelUnavailable.textContent = L.showUnavailable;
            if (el.loadingMsg) el.loadingMsg.textContent = L.loading;

            // Set OCR tooltip when no level detected yet
            if (el.ocrLevelDisplay) el.ocrLevelDisplay.title = L.ocrNotActive || 'OCR not active';

            bindEvents();
            bindOcrEvents();
            loadSettingsAndRegions();
        } catch (err) {
            console.error('[QuestGuide] Init error:', err);
        }
    }

    // ─── Events ─────────────────────────────────────────────────────────────

    function bindEvents() {
        // Search with debounce
        if (el.searchInput) {
            el.searchInput.addEventListener('input', function() {
                clearTimeout(state.searchDebounceTimer);
                state.searchDebounceTimer = setTimeout(function() { saveFilterState(); loadQuests(); }, 300);
            });
        }

        // Level mode radio buttons
        if (el.modeOcr) el.modeOcr.addEventListener('change', function() { onLevelModeChange('ocr'); });
        if (el.modeManual) el.modeManual.addEventListener('change', function() { onLevelModeChange('manual'); });
        if (el.modeFixed) el.modeFixed.addEventListener('change', function() { onLevelModeChange('fixed'); });

        // Level range inputs - use 'change' to avoid rapid firing
        if (el.ocrRangeInput) el.ocrRangeInput.addEventListener('change', onLevelInputChange);
        if (el.manualLevelInput) el.manualLevelInput.addEventListener('change', onLevelInputChange);
        if (el.manualRangeInput) el.manualRangeInput.addEventListener('change', onLevelInputChange);
        if (el.minLevelInput) el.minLevelInput.addEventListener('change', onLevelInputChange);
        if (el.maxLevelInput) el.maxLevelInput.addEventListener('change', onLevelInputChange);

        // Region
        if (el.regionSelect) el.regionSelect.addEventListener('change', function() { saveFilterState(); loadQuests(); });

        // Type toggle
        if (el.typeToggle) {
            el.typeToggle.addEventListener('click', function(e) {
                var btn = e.target.closest('.type-btn');
                if (!btn) return;
                el.typeToggle.querySelectorAll('.type-btn').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                state.currentTypeFilter = btn.dataset.type;
                state.currentSubcategoryFilter = null;
                updateSubcategoryToggle();
                saveFilterState();
                loadQuests();
            });
        }

        // Subcategory toggle
        if (el.subcategoryToggle) {
            el.subcategoryToggle.addEventListener('click', function(e) {
                var btn = e.target.closest('.subcategory-btn');
                if (!btn) return;
                el.subcategoryToggle.querySelectorAll('.subcategory-btn').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                state.currentSubcategoryFilter = btn.dataset.subcategory || null;
                saveFilterState();
                loadQuests();
            });
        }

        // Checkboxes
        if (el.showCompleted) {
            el.showCompleted.addEventListener('change', function() {
                state.settings.showCompleted = el.showCompleted.checked;
                saveSettings();
                loadQuests();
            });
        }
        if (el.showUnavailable) {
            el.showUnavailable.addEventListener('change', function() {
                state.settings.showUnavailable = el.showUnavailable.checked;
                saveSettings();
                loadQuests();
            });
        }

        if (el.resetProgressBtn) {
            el.resetProgressBtn.addEventListener('click', async function() {
                var confirmed = confirm(L.resetConfirm || 'Reset all quest progress for this profile?');
                if (!confirmed) return;
                try {
                    await ipc('quest:progress:reset', { profileId: state.profileId });
                    state.detailCache = {};
                    var btn = el.resetProgressBtn;
                    var origTitle = btn.title;
                    btn.title = L.resetDone || 'Progress reset';
                    btn.classList.add('feedback');
                    setTimeout(function() {
                        btn.title = origTitle;
                        btn.classList.remove('feedback');
                    }, 2000);
                    loadQuests();
                } catch (err) {
                    console.error('[QuestGuide] Progress reset error:', err);
                }
            });
        }
    }

    function onLevelModeChange(mode) {
        state.settings.levelMode = mode;
        saveSettings();
        state.detailCache = {};
        loadQuests();
    }

    function onLevelInputChange() {
        state.settings.ocrRange = parseInt(el.ocrRangeInput.value) || 5;
        state.settings.manualLevel = parseInt(el.manualLevelInput.value) || 1;
        state.settings.manualRange = parseInt(el.manualRangeInput.value) || 5;
        state.settings.minLevel = parseInt(el.minLevelInput.value) || 1;
        state.settings.maxLevel = parseInt(el.maxLevelInput.value) || 30;
        saveSettings();
        state.detailCache = {};
        loadQuests();
    }

    function updateTypeBtnCounts() {
        if (!el.typeToggle || !state.quests) return;
        var counts = { all: state.quests.length, chain: 0, daily: 0, repeat: 0, category: 0 };
        for (var i = 0; i < state.quests.length; i++) {
            var t = state.quests[i].type;
            if (t === 'chain') counts.chain++;
            else if (t === 'daily') counts.daily++;
            else if (t === 'repeat') counts.repeat++;
            else if (t === 'category') counts.category++;
        }
        var btnLabels = {
            'all': L.typeAll,
            'chain': L.typeChain,
            'daily': L.typeDaily,
            'repeat': L.typeRepeat,
            'category': L.typeCategory
        };
        el.typeToggle.querySelectorAll('.type-btn').forEach(function(btn) {
            var type = btn.dataset.type;
            var label = btnLabels[type] || type;
            var count = counts[type] !== undefined ? counts[type] : 0;
            btn.textContent = label + ' (' + count + ')';
        });
    }

    function updateSubcategoryToggle() {
        if (state.currentTypeFilter !== 'repeat' || state.availableSubcategories.length === 0) {
            el.subcategoryToggle.style.display = 'none';
            return;
        }
        el.subcategoryToggle.style.display = 'flex';
        var html = '<button class="subcategory-btn active" data-subcategory="">' + L.subcategoryAll + '</button>';
        var subcategoryLabels = {
            'raising_pet': L.subcategoryRaisingPet,
            'collection': L.subcategoryCollection,
            'monster_hunt': L.subcategoryMonsterHunt,
            'delivery': L.subcategoryDelivery,
            'other': L.subcategoryOther
        };
        state.availableSubcategories.forEach(function(sub) {
            var label = subcategoryLabels[sub] || sub;
            html += '<button class="subcategory-btn" data-subcategory="' + sub + '">' + label + '</button>';
        });
        el.subcategoryToggle.innerHTML = html;
    }

    // ─── OCR Level Sync ──────────────────────────────────────────────────────

    function bindOcrEvents() {
        var ipcObj = window.plugin && window.plugin.ipc;
        if (!ipcObj || typeof ipcObj.on !== 'function') return;
        ipcObj.on('quest:level:update', function(data) {
            if (!data || !data.level) return;
            // Only update if the profile matches (or we don't have a profile yet)
            if (state.profileId && data.profileId && data.profileId !== state.profileId) return;
            var lvl = parseInt(data.level, 10);
            if (isNaN(lvl) || lvl <= 0) return;
            // Show OCR indicator and update display
            if (el.ocrIndicator) el.ocrIndicator.style.display = '';
            // Don't reload if the level hasn't changed
            if (ocrLevel === lvl) return;
            ocrLevel = lvl;
            el.ocrLevelDisplay.textContent = lvl;
            if (el.ocrLevelDisplay) el.ocrLevelDisplay.removeAttribute('title');
            state.detailCache = {};
            // Only auto-reload quests in OCR mode
            if (state.settings.levelMode === 'ocr') {
                loadQuests();
            }
        });
        ipcObj.on('quest:profile:changed', function(data) {
            // Clear the detail cache when the active profile changes
            state.detailCache = {};
            loadQuests();
        });
    }

    // ─── Settings & Regions ─────────────────────────────────────────────────

    async function loadSettingsAndRegions() {
        try {
            var result = await ipc('quest:settings:get');
            if (result && result.settings) {
                // Merge settings, ensuring levelMode has a valid default
                var loadedSettings = result.settings;
                state.settings.showCompleted = loadedSettings.showCompleted || false;
                state.settings.showUnavailable = loadedSettings.showUnavailable || false;
                state.settings.ocrRange = loadedSettings.ocrRange || 5;
                state.settings.manualLevel = loadedSettings.manualLevel || 1;
                state.settings.manualRange = loadedSettings.manualRange || 5;
                state.settings.minLevel = loadedSettings.minLevel || 1;
                state.settings.maxLevel = loadedSettings.maxLevel || 30;
                // Map old 'range' mode to 'ocr'
                var mode = loadedSettings.levelMode || 'ocr';
                if (mode === 'range') mode = 'ocr';
                state.settings.levelMode = mode;
                
                el.showCompleted.checked = state.settings.showCompleted;
                el.showUnavailable.checked = state.settings.showUnavailable;
                el.ocrRangeInput.value = state.settings.ocrRange;
                el.manualLevelInput.value = state.settings.manualLevel;
                el.manualRangeInput.value = state.settings.manualRange;
                el.minLevelInput.value = state.settings.minLevel;
                el.maxLevelInput.value = state.settings.maxLevel;
                
                // Update level mode radio
                if (mode === 'ocr') el.modeOcr.checked = true;
                else if (mode === 'manual') el.modeManual.checked = true;
                else el.modeFixed.checked = true;
            }
        } catch (err) {
            console.error('[QuestGuide] Settings load error:', err);
        }

        try {
            var regResult = await ipc('quest:regions');
            if (regResult && regResult.regions) {
                state.regions = regResult.regions;
                populateRegions(regResult.regions);
            }
        } catch (err) {
            console.error('[QuestGuide] Regions load error:', err);
        }

        // Query the last known OCR level so the input is correct even when
        // the level hasn't changed since the sidepanel was opened.
        try {
            var ocrResult = await ipc('quest:ocr:level');
            if (ocrResult && ocrResult.level) {
                var ocrLvl = parseInt(ocrResult.level, 10);
                if (!isNaN(ocrLvl) && ocrLvl > 0) {
                    ocrLevel = ocrLvl;
                    el.ocrLevelDisplay.textContent = ocrLvl;
                    el.ocrLevelDisplay.removeAttribute('title');
                    if (el.ocrIndicator) el.ocrIndicator.style.display = '';
                }
            }
        } catch (err) {
            // OCR level not available yet – that's fine
        }

        // Restore filter state from sessionStorage before loading quests
        loadFilterState();
        loadQuests();
    }

    function populateRegions(regions) {
        var html = '<option value="">' + esc(L.regionAll) + '</option>';
        for (var i = 0; i < regions.length; i++) {
            var r = regions[i];
            var id = typeof r === 'object' ? r.id : r;
            var name = typeof r === 'object' ? r.name : r;
            html += '<option value="' + esc(id) + '">' + esc(name) + '</option>';
        }
        el.regionSelect.innerHTML = html;
    }

    async function saveSettings() {
        try {
            await ipc('quest:settings:set', state.settings);
        } catch (err) {
            console.error('[QuestGuide] Settings save error:', err);
        }
    }

    // ─── Load Quests ────────────────────────────────────────────────────────

    async function loadQuests() {
        if (state.isLoading) return;
        state.isLoading = true;
        
        var minLevel = 1, maxLevel = 190, playerLevel = 1;
        var mode = state.settings.levelMode || 'ocr';
        
        if (mode === 'fixed') {
            minLevel = parseInt(el.minLevelInput.value) || 1;
            maxLevel = parseInt(el.maxLevelInput.value) || 190;
            playerLevel = maxLevel; // Use maxLevel so quests in range are available
        } else if (mode === 'manual') {
            var level = parseInt(el.manualLevelInput.value) || 1;
            var range = parseInt(el.manualRangeInput.value) || 5;
            minLevel = Math.max(1, level - range);
            maxLevel = Math.min(190, level + range);
            playerLevel = level;
        } else {
            // OCR mode (default)
            var level = ocrLevel || 1;
            var range = parseInt(el.ocrRangeInput.value) || 5;
            minLevel = Math.max(1, level - range);
            maxLevel = Math.min(190, level + range);
            playerLevel = level;
        }

        showLoading();

        try {
            var result = await ipc('quest:list', {
                minLevel: minLevel,
                maxLevel: maxLevel,
                playerLevel: playerLevel,
                showCompleted: el.showCompleted ? el.showCompleted.checked : false,
                showUnavailable: el.showUnavailable ? el.showUnavailable.checked : false,
                search: el.searchInput ? el.searchInput.value.trim() : '',
                region: el.regionSelect ? el.regionSelect.value : '',
                type: state.currentTypeFilter,
                subcategory: state.currentSubcategoryFilter
            });

            if (result && result.error) {
                showError(result.error);
                return;
            }

            if (result && result.noData) {
                state.quests = [];
                state.stats = { total: 0, available: 0, completed: 0, chains: 0 };
                state.profileId = result.profileId;
                el.questList.innerHTML = '<div class="empty-state no-data-hint">' + esc(L.noData) + '</div>';
                updateStats();
                return;
            }

            state.quests = (result && result.quests) || [];
            state.stats = (result && result.stats) || { total: 0, available: 0, completed: 0, chains: 0 };
            state.profileId = result && result.profileId;

            if (result && result.subcategories) {
                state.availableSubcategories = result.subcategories;
                updateSubcategoryToggle();
            }

            renderQuestList();
            updateStats();
            updateTypeBtnCounts();
        } catch (err) {
            console.error('[QuestGuide] loadQuests error:', err);
            showError(err.message || 'Failed to load quests');
        } finally {
            state.isLoading = false;
        }
    }

    // ─── Render Quest List ──────────────────────────────────────────────────

    function getGroupKey(quest) {
        if (quest.subcategory) return 'sub_' + quest.subcategory;
        if (quest.type === 'chain') return 'type_chain';
        if (quest.type === 'category') return 'type_category';
        if (quest.type === 'daily') return 'type_daily';
        if (quest.type === 'repeat') return 'type_repeat';
        return 'type_other';
    }

    function getGroupLabel(key) {
        var labels = {
            'sub_raising_pet': L.subcategoryRaisingPet || 'Raising Pet',
            'sub_collection': L.subcategoryCollection || 'Collection',
            'sub_monster_hunt': L.subcategoryMonsterHunt || 'Monster Hunt',
            'sub_delivery': L.subcategoryDelivery || 'Delivery',
            'sub_other': L.subcategoryOther || 'Other',
            'type_chain': L.typeChain || 'Chain',
            'type_category': L.typeCategory || 'Category',
            'type_daily': L.typeDaily || 'Daily',
            'type_repeat': L.typeRepeat || 'Repeatable',
            'type_other': 'Other'
        };
        return labels[key] || key;
    }

    function getGroupOrder(key) {
        var order = {
            'sub_raising_pet': 1,
            'sub_collection': 2,
            'sub_monster_hunt': 3,
            'sub_delivery': 4,
            'sub_other': 5,
            'type_chain': 10,
            'type_category': 11,
            'type_daily': 12,
            'type_repeat': 13,
            'type_other': 99
        };
        return order[key] || 50;
    }

    function renderQuestList() {
        if (state.quests.length === 0) {
            var msg = el.searchInput.value.trim() || el.regionSelect.value || state.currentTypeFilter !== 'all'
                ? L.noResults
                : L.noData;
            el.questList.innerHTML = '<div class="empty-state">' + esc(msg) + '</div>';
            return;
        }

        var grouped = {};
        for (var i = 0; i < state.quests.length; i++) {
            var q = state.quests[i];
            var key = getGroupKey(q);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(q);
        }

        var sortedGroups = Object.keys(grouped).sort(function(a, b) {
            return getGroupOrder(a) - getGroupOrder(b);
        });

        var html = '';
        for (var g = 0; g < sortedGroups.length; g++) {
            var groupKey = sortedGroups[g];
            var groupQuests = grouped[groupKey];
            var groupLabel = getGroupLabel(groupKey);
            var groupCount = groupQuests.length;
            var groupCompleted = groupQuests.filter(function(q) { return q.completed; }).length;

            html += '<div class="quest-group">';
            html += '<div class="quest-group-header">';
            html += '<span class="quest-group-label">' + esc(groupLabel) + '</span>';
            html += '<span class="quest-group-count">' + groupCompleted + '/' + groupCount + '</span>';
            html += '</div>';
            html += '<div class="quest-group-items">';

            for (var i = 0; i < groupQuests.length; i++) {
                var q = groupQuests[i];
                var isExpanded = state.expandedQuestId === q.id;
                var cls = 'quest-item';
                if (q.completed) cls += ' completed';
                if (!q.available) cls += ' unavailable';
                if (isExpanded) cls += ' expanded';

                var typeClass = q.type === 'chain' ? 'chain' : q.type === 'category' ? 'category' : 'normal';
                var typeLabel = q.type === 'chain' ? L.typeChain : q.type === 'category' ? L.typeCategory : q.type || '';

                html += '<div class="' + cls + '" data-id="' + q.id + '">';

                // Header
                html += '<div class="quest-item-header" data-id="' + q.id + '">';
                html += '<div class="quest-checkbox"><input type="checkbox" ' + (q.completed ? 'checked' : '') + ' data-quest-id="' + q.id + '"></div>';
                html += '<div class="quest-info">';
                html += '<div class="quest-name">' + esc(q.name) + '</div>';
                html += '<div class="quest-meta">';
                html += '<span class="quest-level">Lv.' + (q.minLevel != null ? q.minLevel : '?') + '-' + (q.maxLevel != null ? q.maxLevel : '?') + '</span>';
                html += '<span class="quest-npc">' + esc(q.beginNPCName) + '</span>';
                if (q.subcategory) {
                    var subcatLabel = getGroupLabel('sub_' + q.subcategory);
                    html += '<span class="quest-subcategory-badge">' + esc(subcatLabel) + '</span>';
                }
                if (typeLabel && !q.subcategory) {
                    html += '<span class="quest-type-tag ' + typeClass + '">' + esc(typeLabel) + '</span>';
                }
                if (q.chainInfo && q.chainInfo.isChain) {
                    html += '<span class="quest-chain-badge">&#x1f517;</span>';
                }
                html += '</div>';
                if (q.unavailableReason) {
                    html += '<div class="quest-unavailable-reason">' + esc(q.unavailableReason) + '</div>';
                }
                html += '</div>';
                html += '<button class="quest-quick-complete ' + (q.completed ? 'done' : '') + '" data-quick-id="' + q.id + '" data-completed="' + (q.completed ? '1' : '0') + '" title="' + esc(q.completed ? L.markIncomplete : L.markComplete) + '">&#x2713;</button>';
                html += '<div class="quest-expand-arrow">&#x25B8;</div>';
                html += '</div>';

                // Detail panel (accordion)
                html += '<div class="quest-detail-panel" id="detail-' + q.id + '">';
                if (isExpanded && state.detailCache[q.id]) {
                    html += renderDetailContent(state.detailCache[q.id], q);
                } else if (isExpanded) {
                    html += '<div class="detail-loading">' + esc(L.loading) + '</div>';
                }
                html += '</div>';

                html += '</div>';
            }

            html += '</div></div>';
        }

        el.questList.innerHTML = html;
        bindQuestEvents();

        // Scroll to expanded quest
        if (state.expandedQuestId) {
            var expandedEl = el.questList.querySelector('.quest-item.expanded');
            if (expandedEl) {
                expandedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    function bindQuestEvents() {
        // Header click → toggle accordion
        var headers = el.questList.querySelectorAll('.quest-item-header');
        headers.forEach(function(header) {
            header.addEventListener('click', function(e) {
                if (e.target.type === 'checkbox') return;
                if (e.target.classList.contains('quest-quick-complete') || e.target.closest('.quest-quick-complete')) return;
                var questId = parseInt(this.dataset.id);
                toggleAccordion(questId);
            });
        });

        // Checkbox → toggle progress
        var checkboxes = el.questList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(function(cb) {
            cb.addEventListener('change', function(e) {
                e.stopPropagation();
                var questId = parseInt(this.dataset.questId);
                toggleComplete(questId, this.checked);
            });
        });

        // Quick-complete button in list row
        var quickBtns = el.questList.querySelectorAll('.quest-quick-complete');
        quickBtns.forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var questId = parseInt(this.dataset.quickId);
                var newCompleted = this.dataset.completed !== '1';
                var self = this;
                toggleComplete(questId, newCompleted, self);
            });
        });
    }

    // ─── Accordion ──────────────────────────────────────────────────────────

    function getPlayerLevel() {
        if (state.settings.levelMode === 'fixed') {
            return parseInt(el.minLevelInput.value) || 1;
        } else if (state.settings.levelMode === 'manual') {
            return parseInt(el.manualLevelInput.value) || 1;
        } else {
            return ocrLevel || 1;
        }
    }

    async function toggleAccordion(questId) {
        if (state.expandedQuestId === questId) {
            state.expandedQuestId = null;
            renderQuestList();
            return;
        }

        state.expandedQuestId = questId;
        renderQuestList(); // Re-render to show loading state

        // Load detail
        if (!state.detailCache[questId]) {
            try {
                var playerLevel = getPlayerLevel();
                var result = await ipc('quest:detail', { questId: questId, profileId: state.profileId, playerLevel: playerLevel });
                if (result && result.detail) {
                    state.detailCache[questId] = result.detail;
                }
            } catch (err) {
                console.error('[QuestGuide] Detail load error:', err);
            }
        }

        // Re-render with detail data
        if (state.expandedQuestId === questId) {
            var panel = document.getElementById('detail-' + questId);
            if (panel && state.detailCache[questId]) {
                var questItem = state.quests.find(function(q) { return q.id === questId; });
                panel.innerHTML = renderDetailContent(state.detailCache[questId], questItem);
                bindDetailEvents(panel, questId);
            } else if (panel) {
                panel.innerHTML = '<div class="detail-loading">' + esc(L.error) + '</div>';
            }
        }
    }

    // ─── Render Detail Content ──────────────────────────────────────────────

    function renderDetailContent(detail, questItem) {
        var html = '';

        // Level info
        html += '<div class="detail-section">';
        html += '<div class="detail-section-title">' + esc(L.levelRange) + '</div>';
        html += '<div class="level-info">';
        html += '<div class="level-box"><div class="level-box-value">' + (detail.minLevel != null ? detail.minLevel : '?') + '</div><div class="level-box-label">Min</div></div>';
        html += '<div class="level-box"><div class="level-box-value">' + (detail.maxLevel != null ? detail.maxLevel : '?') + '</div><div class="level-box-label">Max</div></div>';
        html += '</div></div>';

        // NPCs
        html += '<div class="detail-section">';
        html += '<div class="detail-section-title">NPCs</div>';
        html += '<div class="npc-cards">';

        // Start NPC
        html += '<div class="npc-card"><div class="npc-card-label">' + esc(L.startNpc) + '</div>';
        if (detail.beginNPC) {
            if (detail.beginNPC.icon) {
                html += '<img class="npc-card-portrait" src="file:///' + esc(detail.beginNPC.icon.replace(/\\/g, '/')) + '" alt="">';
            }
            html += '<div class="npc-card-name">' + esc(detail.beginNPC.name) + '</div>';
            if (detail.beginNPC.x != null) {
                html += '<div class="npc-card-pos-row">';
                html += '<div class="npc-card-pos">X:' + Math.round(detail.beginNPC.x) + ' Z:' + Math.round(detail.beginNPC.z);
                if (detail.beginNPC.world != null) html += ' | ' + esc(String(detail.beginNPC.world));
                html += '</div>';
                if (detail.beginNPC.world != null) {
                    html += '<button class="btn-map"'
                        + ' data-world-id="' + esc(String(detail.beginNPC.world)) + '"'
                        + ' data-x="' + Math.round(detail.beginNPC.x) + '"'
                        + ' data-z="' + Math.round(detail.beginNPC.z) + '"'
                        + ' data-npc-name="' + esc(detail.beginNPC.name) + '"'
                        + ' data-npc-icon="' + esc(detail.beginNPC.icon || '') + '"'
                        + ' title="Open map">&#x1F5FA;</button>';
                }
                html += '</div>';
            } else {
                html += '<div class="npc-card-pos">' + esc(L.unknownPos) + '</div>';
            }
        } else {
            html += '<div class="npc-card-name">Unknown</div>';
        }
        html += '</div>';

        // End NPC
        html += '<div class="npc-card"><div class="npc-card-label">' + esc(L.turnInNpc) + '</div>';
        if (detail.endNPC) {
            if (detail.endNPC.icon) {
                html += '<img class="npc-card-portrait" src="file:///' + esc(detail.endNPC.icon.replace(/\\/g, '/')) + '" alt="">';
            }
            html += '<div class="npc-card-name">' + esc(detail.endNPC.name) + '</div>';
            if (detail.endNPC.x != null) {
                html += '<div class="npc-card-pos-row">';
                html += '<div class="npc-card-pos">X:' + Math.round(detail.endNPC.x) + ' Z:' + Math.round(detail.endNPC.z);
                if (detail.endNPC.world != null) html += ' | ' + esc(String(detail.endNPC.world));
                html += '</div>';
                if (detail.endNPC.world != null) {
                    html += '<button class="btn-map"'
                        + ' data-world-id="' + esc(String(detail.endNPC.world)) + '"'
                        + ' data-x="' + Math.round(detail.endNPC.x) + '"'
                        + ' data-z="' + Math.round(detail.endNPC.z) + '"'
                        + ' data-npc-name="' + esc(detail.endNPC.name) + '"'
                        + ' data-npc-icon="' + esc(detail.endNPC.icon || '') + '"'
                        + ' title="Open map">&#x1F5FA;</button>';
                }
                html += '</div>';
            } else {
                html += '<div class="npc-card-pos">' + esc(L.unknownPos) + '</div>';
            }
        } else {
            html += '<div class="npc-card-name">Unknown</div>';
        }
        html += '</div>';

        html += '</div></div>';

        // Monster Objectives
        if (detail.monsters && detail.monsters.length > 0) {
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">' + esc(L.monsterObjectives) + '</div>';
            for (var i = 0; i < detail.monsters.length; i++) {
                var mg = detail.monsters[i];
                for (var j = 0; j < mg.monsters.length; j++) {
                    var m = mg.monsters[j];
                    html += '<div class="objective-row">';
                    if (m.icon) {
                        html += '<img class="objective-icon monster-icon" src="file:///' + esc(m.icon.replace(/\\/g, '/')) + '" alt="">';
                    } else {
                        html += '<div class="objective-icon-placeholder monster-placeholder">&#x2694;</div>';
                    }
                    html += '<div class="objective-info">';
                    html += '<div class="objective-name">' + esc(m.name);
                    if (m.level) html += ' <span class="monster-level">(Lv.' + m.level + ')</span>';
                    if (m.aggressivity != null && m.aggressivity > 0) {
                        var aggroClass = m.aggressivity >= 100 ? 'aggro-high' : m.aggressivity >= 50 ? 'aggro-medium' : 'aggro-low';
                        html += ' <span class="monster-aggro ' + aggroClass + '">' + m.aggressivity + '% Aggro</span>';
                    }
                    html += '</div>';
                    html += '<div class="objective-count">' + esc(L.kill) + ' ' + mg.count + 'x</div>';
                    html += '</div>';
                    if (m.world != null && m.x != null) {
                        var spawnsEncoded = m.spawns ? encodeURIComponent(JSON.stringify(m.spawns)) : '';
                        html += '<button class="btn-map"'
                            + ' data-world-id="' + esc(String(m.world)) + '"'
                            + ' data-x="' + Math.round(m.x) + '"'
                            + ' data-z="' + Math.round(m.z || 0) + '"'
                            + ' data-npc-name="' + esc(m.name) + '"'
                            + ' data-npc-icon="' + esc(m.icon || '') + '"'
                            + ' data-spawns="' + spawnsEncoded + '"'
                            + ' title="Open map">&#x1F5FA;</button>';
                    }
                    html += '</div>';
                }
            }
            html += '</div>';
        }

        // Item Objectives
        if (detail.neededItems && detail.neededItems.length > 0) {
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">' + esc(L.itemObjectives) + '</div>';
            for (var i = 0; i < detail.neededItems.length; i++) {
                var item = detail.neededItems[i];
                html += '<div class="objective-row">';
                if (item.icon) {
                    html += '<img class="objective-icon" src="file:///' + esc(item.icon.replace(/\\/g, '/')) + '" alt="">';
                } else {
                    html += '<div class="objective-icon-placeholder">&#x1F4E6;</div>';
                }
                html += '<div class="objective-info">';
                html += '<div class="objective-name">' + esc(item.name) + '</div>';
                html += '<div class="objective-count">' + esc(L.collect) + ' ' + item.count + 'x</div>';
                html += '</div></div>';
            }
            html += '</div>';
        }

        // Prerequisites
        if (detail.prerequisites && detail.prerequisites.length > 0) {
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">' + esc(L.prerequisites) + '</div>';
            html += '<div class="prereq-list">';
            for (var i = 0; i < detail.prerequisites.length; i++) {
                var pr = detail.prerequisites[i];
                html += '<div class="prereq-item">';
                html += '<span class="prereq-dot ' + (pr.completed ? 'done' : '') + '"></span>';
                html += '<span class="prereq-name">' + esc(pr.name) + '</span>';
                html += '</div>';
            }
            html += '</div></div>';
        }

        // Rewards
        var hasRewards = detail.gold > 0 || detail.totalExp > 0 || (detail.rewardItems && detail.rewardItems.length > 0);
        if (hasRewards) {
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">' + esc(L.rewards) + '</div>';
            html += '<div class="reward-grid">';

            if (detail.gold > 0) {
                html += '<div class="reward-card gold">';
                html += '<div class="reward-icon-placeholder" style="color:#fbbf24;">&#x1F4B0;</div>';
                html += '<div><div class="reward-amount" style="color:#fbbf24;">' + detail.gold.toLocaleString() + '</div>';
                html += '<div class="reward-label">' + esc(L.gold) + '</div></div></div>';
            }

            if (detail.totalExp > 0) {
                html += '<div class="reward-card exp">';
                html += '<div class="reward-icon-placeholder" style="color:#4ade80;">&#x2B50;</div>';
                html += '<div><div class="reward-amount" style="color:#4ade80;">' + detail.totalExp.toLocaleString() + '</div>';
                if (detail.maxExp > 0 && detail.maxExp !== detail.totalExp) {
                    html += '<div class="reward-label">' + esc(L.experience) + ' <span class="exp-max">(max: ' + detail.maxExp.toLocaleString() + ')</span></div></div></div>';
                } else {
                    html += '<div class="reward-label">' + esc(L.experience) + '</div></div></div>';
                }
            }

            if (detail.rewardItems) {
                for (var i = 0; i < detail.rewardItems.length; i++) {
                    var ri = detail.rewardItems[i];
                    html += '<div class="reward-card item">';
                    if (ri.icon) {
                        html += '<img class="reward-icon" src="file:///' + esc(ri.icon.replace(/\\/g, '/')) + '" alt="">';
                    } else {
                        html += '<div class="reward-icon-placeholder" style="color:#818cf8;">&#x1F392;</div>';
                    }
                    html += '<div><div class="reward-amount" style="color:#818cf8;">' + esc(ri.name) + '</div>';
                    html += '<div class="reward-label">x' + ri.count + '</div></div></div>';
                }
            }

            html += '</div></div>';
        }

        // Chain visualization
        if (detail.chain && detail.chain.chain && detail.chain.chain.length > 1) {
            var chain = detail.chain.chain;
            var completedInChain = chain.filter(function(c) { return c.completed; }).length;
            var chainLabel = L.chainProgress.replace('{n}', completedInChain).replace('{total}', chain.length);

            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">' + esc(L.chain) + '</div>';
            html += '<div class="chain-name">' + esc(detail.chain.chainName) + ' - ' + esc(chainLabel) + '</div>';
            html += '<div class="chain-bar" style="flex-wrap:wrap;row-gap:8px;max-width:100%;overflow:hidden;">';

            for (var i = 0; i < chain.length; i++) {
                var c = chain[i];
                var dotClass = 'chain-dot';
                if (c.completed) dotClass += ' done';
                if (c.current) dotClass += ' current';
                var labelClass = 'chain-label' + (c.current ? ' current' : '');

                html += '<div class="chain-node" data-chain-id="' + c.id + '" title="' + esc(c.name) + '">';
                html += '<div class="' + dotClass + '"></div>';
                html += '<div class="' + labelClass + '">' + esc(truncate(c.name, 8)) + '</div>';
                html += '</div>';
            }

            html += '</div></div>';
        }

        // Follow-up quests
        if (detail.followUpQuests && detail.followUpQuests.length > 0) {
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">' + esc(L.followUpQuests) + '</div>';
            html += '<div class="followup-list">';
            for (var i = 0; i < detail.followUpQuests.length; i++) {
                var fu = detail.followUpQuests[i];
                html += '<div class="followup-item" data-followup-id="' + fu.id + '">&#x2192; ' + esc(fu.name) + '</div>';
            }
            html += '</div></div>';
        }

        // Description
        if (detail.description) {
            var desc = localizedName(detail.description);
            if (desc && desc !== 'Unknown') {
                html += '<div class="detail-section">';
                html += '<div class="detail-section-title">' + esc(L.description) + '</div>';
                html += '<div class="description-text">' + esc(desc) + '</div>';
                html += '</div>';
            }
        }

        // Mark complete button
        var isCompleted = questItem ? questItem.completed : false;
        html += '<button class="btn-mark-complete ' + (isCompleted ? 'done' : '') + '" data-toggle-id="' + detail.id + '">';
        html += esc(isCompleted ? L.markIncomplete : L.markComplete);
        html += '</button>';

        return html;
    }

    function bindDetailEvents(panel, questId) {
        // Map buttons – open the NPC location map window
        var mapBtns = panel.querySelectorAll('.btn-map');
        mapBtns.forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var rawWorldId = this.dataset.worldId;
                // World IDs are numeric; try to parse, fall back to string
                var worldId = parseInt(rawWorldId, 10);
                if (isNaN(worldId)) worldId = rawWorldId;
                var x       = parseInt(this.dataset.x,   10) || 0;
                var z       = parseInt(this.dataset.z,   10) || 0;
                var npcName = this.dataset.npcName || '';
                var npcIcon = this.dataset.npcIcon || '';
                var spawns  = null;
                if (this.dataset.spawns) {
                    try { spawns = JSON.parse(decodeURIComponent(this.dataset.spawns)); } catch(err) {}
                }
                ipc('quest:map:open', { worldId: worldId, x: x, z: z, npcName: npcName, npcIcon: npcIcon, spawns: spawns })
                    .catch(function(err) {
                        console.error('[QuestGuide] Map open error:', err);
                    });
            });
        });

        // Mark complete button
        var toggleBtn = panel.querySelector('.btn-mark-complete');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function() {
                var qId = parseInt(this.dataset.toggleId);
                var quest = state.quests.find(function(q) { return q.id === qId; });
                var newCompleted = quest ? !quest.completed : true;
                toggleComplete(qId, newCompleted);
                this.textContent = newCompleted ? L.markIncomplete : L.markComplete;
                this.classList.toggle('done', newCompleted);
            });
        }

        // Chain node clicks
        var chainNodes = panel.querySelectorAll('.chain-node');
        chainNodes.forEach(function(node) {
            node.addEventListener('click', function() {
                var chainQuestId = parseInt(this.dataset.chainId);
                if (chainQuestId && chainQuestId !== questId) {
                    state.expandedQuestId = null;
                    state.detailCache = {};
                    toggleAccordion(chainQuestId);
                }
            });
        });

        // Follow-up quest clicks
        var followups = panel.querySelectorAll('.followup-item');
        followups.forEach(function(item) {
            item.addEventListener('click', function() {
                var fuId = parseInt(this.dataset.followupId);
                if (fuId) {
                    state.expandedQuestId = null;
                    state.detailCache = {};
                    toggleAccordion(fuId);
                }
            });
        });
    }

    // ─── Progress ───────────────────────────────────────────────────────────

    async function toggleComplete(questId, completed, quickBtn) {
        try {
            var result = await ipc('quest:progress:set', {
                questId: questId,
                completed: completed,
                profileId: state.profileId
            });

            if (result && result.success) {
                for (var i = 0; i < state.quests.length; i++) {
                    if (state.quests[i].id === questId) {
                        state.quests[i].completed = completed;
                        break;
                    }
                }
                // Clear detail cache for this quest (completion status changed)
                delete state.detailCache[questId];
                updateStats();

                // Visual feedback on the quick-complete button
                if (quickBtn) {
                    var origHtml = quickBtn.innerHTML;
                    var origTitle = quickBtn.title;
                    quickBtn.innerHTML = esc(L.savedFeedback || 'Saved');
                    quickBtn.dataset.completed = completed ? '1' : '0';
                    quickBtn.classList.toggle('done', completed);
                    quickBtn.title = completed ? (L.markIncomplete || 'Mark Incomplete') : (L.markComplete || 'Mark Complete');
                    setTimeout(function() {
                        quickBtn.innerHTML = '&#x2713;';
                    }, 500);
                }
            }
        } catch (err) {
            console.error('[QuestGuide] Progress update error:', err);
        }
    }

    // ─── Stats ──────────────────────────────────────────────────────────────

    function updateStats() {
        var total = state.quests.length;
        var completed = 0;
        var available = 0;
        for (var i = 0; i < state.quests.length; i++) {
            if (state.quests[i].completed) completed++;
            if (state.quests[i].available && !state.quests[i].completed) available++;
        }
        el.statTotal.textContent = L.total + ': ' + total;
        el.statAvailable.textContent = L.available + ': ' + available;
        el.statCompleted.textContent = L.completed + ': ' + completed;
    }

    // ─── UI Helpers ─────────────────────────────────────────────────────────

    function showLoading() {
        el.questList.innerHTML = '<div class="loading">' + esc(L.loading) + '</div>';
    }

    function showError(message) {
        el.questList.innerHTML = '<div class="error-state">' + esc(L.error) + ': ' + esc(message) + '</div>';
    }

    function esc(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function truncate(str, max) {
        if (!str || str.length <= max) return str || '';
        return str.slice(0, max) + '...';
    }

    function localizedName(obj) {
        if (!obj) return 'Unknown';
        if (typeof obj === 'string') return obj;
        return obj[locale] || obj['en'] || Object.values(obj)[0] || 'Unknown';
    }

    // ─── Init ───────────────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

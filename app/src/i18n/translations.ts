export type Locale = "en" | "de" | "pl" | "fr" | "ru" | "tr" | "cn" | "jp";

export const DEFAULT_LOCALE: Locale = "en";

const messagesEn = {
  "header.newProfile": "New profile",
  "filter.searchPlaceholder": "Search character...",
  "filter.allJobs": "All jobs",

  "tips.title": "Tip",

  "create.namePlaceholder": "Profile name",
  "create.add": "Add",
  "create.cancel": "Close",
  "create.delete": "Delete",

  "news.title": "Newsfeed",
  "news.loading": "Loading news...",
  "news.none": "No news found.",
  "news.error": "Could not load news",

  "list.error": "Error loading profiles.",
  "list.empty": "No profiles yet. Create one with 'New profile'.",
  "list.noMatches": "No matches for the filter.",

  "profile.play": "Play",
  "profile.delete": "Delete",
  "profile.mode.tabs": "Tabs",
  "profile.mode.window": "Window",
  "profile.mode.useTabs": "Use in tabs",

  "profile.overlay.disabled": "Overlay selection temporarily disabled",
  "profile.overlay.on": "Overlay target (click to disable)",
  "profile.overlay.off": "Mark as overlay target",

  "profile.save": "Save",
  "profile.clone": "Clone profile",
  "profile.cloneConfirm": "Clone profile",
  "profile.clonePlaceholder": "Name for copy",
  "profile.copySuffix": "Copy",
  "profile.close": "Close",
  "profile.back": "Back",

  "job.choose": "Select job",

  "picker.title": "Select profile:",
  "picker.empty": "No more tab profiles available.",

  "split.start": "Split screen",
  "split.stop": "Exit split",
  "split.activePair": "Active split:",
  "split.title": "Link two tabs",
  "split.subtitle": "Choose a second tab to show side by side.",
  "split.noOpenTabs": "No other open tabs.",
  "split.openOther": "Open another profile...",
};

const messagesDe: typeof messagesEn = {
  "header.newProfile": "Neues Profil",
  "filter.searchPlaceholder": "Charname suchen...",
  "filter.allJobs": "Alle Berufe",

  "tips.title": "Tipp",

  "create.namePlaceholder": "Profilname",
  "create.add": "Hinzufügen",
  "create.cancel": "Schließen",
  "create.delete": "Löschen",

  "news.title": "Newsfeed",
  "news.loading": "News werden geladen...",
  "news.none": "Keine News gefunden.",
  "news.error": "Konnte News nicht laden",

  "list.error": "Fehler beim Laden der Profile.",
  "list.empty": "Noch keine Profile. Erstelle eins mit 'Neues Profil'.",
  "list.noMatches": "Keine Treffer für den Filter.",

  "profile.play": "Spielen",
  "profile.delete": "Löschen",
  "profile.mode.tabs": "Tabs",
  "profile.mode.window": "Fenster",
  "profile.mode.useTabs": "In Tabs verwenden",

  "profile.overlay.disabled": "Overlay-Auswahl vorübergehend deaktiviert",
  "profile.overlay.on": "Overlay-Ziel (klicken zum Deaktivieren)",
  "profile.overlay.off": "Als Overlay-Ziel markieren",

  "profile.save": "Speichern",
  "profile.clone": "Profil kopieren",
  "profile.cloneConfirm": "Profil kopieren",
  "profile.clonePlaceholder": "Name für Kopie",
  "profile.copySuffix": "Kopie",
  "profile.close": "Schließen",
  "profile.back": "Zurück",

  "job.choose": "Beruf wählen",

  "picker.title": "Profil auswählen:",
  "picker.empty": "Keine weiteren Tab-Profile verfügbar.",

  "split.start": "Split-Screen",
  "split.stop": "Split beenden",
  "split.activePair": "Aktiver Split:",
  "split.title": "Tabs im Split-Screen verbinden",
  "split.subtitle": "Wähle einen zweiten Tab, der daneben angezeigt wird.",
  "split.noOpenTabs": "Keine weiteren offenen Tabs.",
  "split.openOther": "Anderes Profil öffnen...",

};

const messagesPl: typeof messagesEn = {
  "header.newProfile": "Nowy profil",
  "filter.searchPlaceholder": "Szukaj postaci...",
  "filter.allJobs": "Wszystkie klasy",

  "tips.title": "Wskazówka",

  "create.namePlaceholder": "Nazwa profilu",
  "create.add": "Dodaj",
  "create.cancel": "Zamknij",
  "create.delete": "Usuń",

  "news.title": "Aktualności",
  "news.loading": "Ładowanie wiadomości...",
  "news.none": "Brak wiadomości.",
  "news.error": "Nie udało się załadować wiadomości",

  "list.error": "Błąd ładowania profili.",
  "list.empty": "Brak profili. Utwórz nowy przyciskiem 'Nowy profil'.",
  "list.noMatches": "Brak wyników dla filtra.",

  "profile.play": "Graj",
  "profile.delete": "Usuń",
  "profile.mode.tabs": "Karty",
  "profile.mode.window": "Okno",
  "profile.mode.useTabs": "Używaj w kartach",

  "profile.overlay.disabled": "Wybór overlay tymczasowo wyłączony",
  "profile.overlay.on": "Overlay cel (kliknij, aby wyłączyć)",
  "profile.overlay.off": "Ustaw jako cel overlay",

  "profile.save": "Zapisz",
  "profile.clone": "Kopiuj profil",
  "profile.cloneConfirm": "Kopiuj profil",
  "profile.clonePlaceholder": "Nazwa kopii",
  "profile.copySuffix": "Kopia",
  "profile.close": "Zamknij",
  "profile.back": "Wróć",

  "job.choose": "Wybierz klasę",

  "picker.title": "Wybierz profil:",
  "picker.empty": "Brak dostępnych profili kart.",

  "split.start": "Split screen",
  "split.stop": "Exit split",
  "split.activePair": "Active split:",
  "split.title": "Link two tabs",
  "split.subtitle": "Choose a second tab to show side by side.",
  "split.noOpenTabs": "No other open tabs.",
  "split.openOther": "Open another profile...",

};

const messagesFr: typeof messagesEn = {
  "header.newProfile": "Nouveau profil",
  "filter.searchPlaceholder": "Rechercher un personnage...",
  "filter.allJobs": "Tous les métiers",

  "tips.title": "Astuce",

  "create.namePlaceholder": "Nom du profil",
  "create.add": "Ajouter",
  "create.cancel": "Fermer",
  "create.delete": "Supprimer",

  "news.title": "Fil d'actus",
  "news.loading": "Chargement des actus...",
  "news.none": "Aucune actu trouvée.",
  "news.error": "Impossible de charger les actus",

  "list.error": "Erreur lors du chargement des profils.",
  "list.empty": "Aucun profil. Crée-en un via 'Nouveau profil'.",
  "list.noMatches": "Aucun résultat pour ce filtre.",

  "profile.play": "Jouer",
  "profile.delete": "Supprimer",
  "profile.mode.tabs": "Onglets",
  "profile.mode.window": "Fenêtre",
  "profile.mode.useTabs": "Utiliser en onglets",

  "profile.overlay.disabled": "Sélection d'overlay temporairement désactivée",
  "profile.overlay.on": "Cible d'overlay (cliquer pour désactiver)",
  "profile.overlay.off": "Marquer comme cible d'overlay",

  "profile.save": "Enregistrer",
  "profile.clone": "Dupliquer le profil",
  "profile.cloneConfirm": "Dupliquer le profil",
  "profile.clonePlaceholder": "Nom de la copie",
  "profile.copySuffix": "Copie",
  "profile.close": "Fermer",
  "profile.back": "Retour",

  "job.choose": "Choisir une classe",

  "picker.title": "Choisir un profil :",
  "picker.empty": "Aucun autre profil onglet disponible.",

  "split.start": "Split screen",
  "split.stop": "Exit split",
  "split.activePair": "Active split:",
  "split.title": "Link two tabs",
  "split.subtitle": "Choose a second tab to show side by side.",
  "split.noOpenTabs": "No other open tabs.",
  "split.openOther": "Open another profile...",

};

const messagesRu: typeof messagesEn = {
  "header.newProfile": "Новый профиль",
  "filter.searchPlaceholder": "Поиск персонажа...",
  "filter.allJobs": "Все классы",

  "tips.title": "Совет",

  "create.namePlaceholder": "Имя профиля",
  "create.add": "Добавить",
  "create.cancel": "Закрыть",
  "create.delete": "Удалить",

  "news.title": "Новости",
  "news.loading": "Загрузка новостей...",
  "news.none": "Нет новостей.",
  "news.error": "Не удалось загрузить новости",

  "list.error": "Ошибка загрузки профилей.",
  "list.empty": "Профилей нет. Создайте через «Новый профиль».",
  "list.noMatches": "Нет результатов для фильтра.",

  "profile.play": "Играть",
  "profile.delete": "Удалить",
  "profile.mode.tabs": "Вкладки",
  "profile.mode.window": "Окно",
  "profile.mode.useTabs": "Использовать во вкладках",

  "profile.overlay.disabled": "Выбор оверлея временно отключен",
  "profile.overlay.on": "Цель оверлея (клик для выключения)",
  "profile.overlay.off": "Отметить как цель оверлея",

  "profile.save": "Сохранить",
  "profile.clone": "Клонировать профиль",
  "profile.cloneConfirm": "Клонировать профиль",
  "profile.clonePlaceholder": "Имя копии",
  "profile.copySuffix": "Копия",
  "profile.close": "Закрыть",
  "profile.back": "Назад",

  "job.choose": "Выберите класс",

  "picker.title": "Выберите профиль:",
  "picker.empty": "Нет доступных профилей для вкладок.",

  "split.start": "Split screen",
  "split.stop": "Exit split",
  "split.activePair": "Active split:",
  "split.title": "Link two tabs",
  "split.subtitle": "Choose a second tab to show side by side.",
  "split.noOpenTabs": "No other open tabs.",
  "split.openOther": "Open another profile...",

};

const messagesTr: typeof messagesEn = {
  "header.newProfile": "Yeni profil",
  "filter.searchPlaceholder": "Karakter ara...",
  "filter.allJobs": "Tüm meslekler",

  "tips.title": "İpucu",

  "create.namePlaceholder": "Profil adı",
  "create.add": "Ekle",
  "create.cancel": "Kapat",
  "create.delete": "Sil",

  "news.title": "Haber akışı",
  "news.loading": "Haberler yükleniyor...",
  "news.none": "Haber bulunamadı.",
  "news.error": "Haberler yüklenemedi",

  "list.error": "Profiller yüklenirken hata.",
  "list.empty": "Henüz profil yok. 'Yeni profil' ile oluştur.",
  "list.noMatches": "Filtre için sonuç yok.",

  "profile.play": "Oyna",
  "profile.delete": "Sil",
  "profile.mode.tabs": "Sekmeler",
  "profile.mode.window": "Pencere",
  "profile.mode.useTabs": "Sekmelerde kullan",

  "profile.overlay.disabled": "Overlay seçimi geçici olarak kapalı",
  "profile.overlay.on": "Overlay hedefi (kapatmak için tıkla)",
  "profile.overlay.off": "Overlay hedefi yap",

  "profile.save": "Kaydet",
  "profile.clone": "Profili kopyala",
  "profile.cloneConfirm": "Profili kopyala",
  "profile.clonePlaceholder": "Kopya adı",
  "profile.copySuffix": "Kopya",
  "profile.close": "Kapat",
  "profile.back": "Geri",

  "job.choose": "Sınıf seç",

  "picker.title": "Profil seç:",
  "picker.empty": "Başka sekme profili yok.",

  "split.start": "Split screen",
  "split.stop": "Exit split",
  "split.activePair": "Active split:",
  "split.title": "Link two tabs",
  "split.subtitle": "Choose a second tab to show side by side.",
  "split.noOpenTabs": "No other open tabs.",
  "split.openOther": "Open another profile...",

};

const messagesCn: typeof messagesEn = {
  "header.newProfile": "新建配置",
  "filter.searchPlaceholder": "搜索角色...",
  "filter.allJobs": "所有职业",

  "tips.title": "提示",

  "create.namePlaceholder": "配置名称",
  "create.add": "添加",
  "create.cancel": "关闭",
  "create.delete": "删除",

  "news.title": "新闻",
  "news.loading": "正在加载新闻...",
  "news.none": "没有找到新闻。",
  "news.error": "无法加载新闻",

  "list.error": "加载配置时出错。",
  "list.empty": "还没有配置。点击“新建配置”创建。",
  "list.noMatches": "筛选无结果。",

  "profile.play": "开始游戏",
  "profile.delete": "删除",
  "profile.mode.tabs": "标签页",
  "profile.mode.window": "窗口",
  "profile.mode.useTabs": "使用标签页",

  "profile.overlay.disabled": "暂时禁用覆盖选择",
  "profile.overlay.on": "覆盖目标（点击关闭）",
  "profile.overlay.off": "设为覆盖目标",

  "profile.save": "保存",
  "profile.clone": "复制配置",
  "profile.cloneConfirm": "复制配置",
  "profile.clonePlaceholder": "副本名称",
  "profile.copySuffix": "副本",
  "profile.close": "关闭",
  "profile.back": "返回",

  "job.choose": "选择职业",

  "picker.title": "选择配置：",
  "picker.empty": "没有更多标签页配置。",

  "split.start": "Split screen",
  "split.stop": "Exit split",
  "split.activePair": "Active split:",
  "split.title": "Link two tabs",
  "split.subtitle": "Choose a second tab to show side by side.",
  "split.noOpenTabs": "No other open tabs.",
  "split.openOther": "Open another profile...",

};

const messagesJp: typeof messagesEn = {
  "header.newProfile": "新規プロファイル",
  "filter.searchPlaceholder": "キャラ名を検索...",
  "filter.allJobs": "すべての職業",

  "tips.title": "ヒント",

  "create.namePlaceholder": "プロファイル名",
  "create.add": "追加",
  "create.cancel": "閉じる",
  "create.delete": "削除",

  "news.title": "ニュースフィード",
  "news.loading": "ニュースを読み込み中...",
  "news.none": "ニュースが見つかりません。",
  "news.error": "ニュースを読み込めませんでした",

  "list.error": "プロファイルの読み込みエラー。",
  "list.empty": "まだプロファイルがありません。「新規プロファイル」で作成してください。",
  "list.noMatches": "フィルターに一致するものはありません。",

  "profile.play": "プレイ",
  "profile.delete": "削除",
  "profile.mode.tabs": "タブ",
  "profile.mode.window": "ウィンドウ",
  "profile.mode.useTabs": "タブで使う",

  "profile.overlay.disabled": "オーバーレイ選択は一時的に無効",
  "profile.overlay.on": "オーバーレイ対象（クリックで解除）",
  "profile.overlay.off": "オーバーレイ対象にする",

  "profile.save": "保存",
  "profile.clone": "プロファイルをコピー",
  "profile.cloneConfirm": "プロファイルをコピー",
  "profile.clonePlaceholder": "コピー名",
  "profile.copySuffix": "コピー",
  "profile.close": "閉じる",
  "profile.back": "戻る",

  "job.choose": "職業を選択",

  "picker.title": "プロファイルを選択:",
  "picker.empty": "他にタブ用プロファイルがありません。",

  "split.start": "Split screen",
  "split.stop": "Exit split",
  "split.activePair": "Active split:",
  "split.title": "Link two tabs",
  "split.subtitle": "Choose a second tab to show side by side.",
  "split.noOpenTabs": "No other open tabs.",
  "split.openOther": "Open another profile...",

};

export type TranslationKey = keyof typeof messagesEn;

export const translations: Record<Locale, Record<TranslationKey, string>> = {
  en: messagesEn,
  de: messagesDe,
  pl: messagesPl,
  fr: messagesFr,
  ru: messagesRu,
  tr: messagesTr,
  cn: messagesCn,
  jp: messagesJp,
};

const tipsEn = [
  "Drag & drop profiles to reorder them.",
  "Use tabs mode to keep multiple chars in one window.",
  "Mark a char as overlay target (Aibatt) so the overlay follows.",
  "Click Play to open in the chosen start mode (tabs/window).",
];

const tipsDe = [
  "Ziehe Profile per Drag & Drop, um die Reihenfolge zu ändern.",
  "Nutze den Tabs-Modus, um mehrere Chars in einem Fenster offen zu halten.",
  "Markiere einen Char als Overlay-Ziel (Aibatt), damit die Overlay-Anzeige folgt.",
  "Klicke auf 'Spielen', um direkt im gewählten Startmodus (Tabs/Fenster) zu öffnen.",
];

const tipsPl = [
  "Przeciągaj profile, aby zmienić kolejność.",
  "Używaj trybu kart, by mieć kilka postaci w jednym oknie.",
  "Oznacz cel overlay (Aibatt), by overlay podążał.",
  "Kliknij Graj, by otworzyć w wybranym trybie (karty/okno).",
];

const tipsFr = [
  "Glisse-dépose les profils pour les réordonner.",
  "Utilise le mode onglets pour plusieurs persos dans une fenêtre.",
  "Marque une cible overlay (Aibatt) pour suivre l'overlay.",
  "Clique sur Jouer pour ouvrir dans le mode choisi (onglets/fenêtre).",
];

const tipsRu = [
  "Перетаскивай профили, чтобы менять порядок.",
  "Режим вкладок держит несколько персонажей в одном окне.",
  "Отметь цель оверлея (Aibatt), чтобы оверлей следовал.",
  "Жми Играть, чтобы открыть в выбранном режиме (вкладки/окно).",
];

const tipsTr = [
  "Profilleri sürükleyip bırakarak sıralamayı değiştir.",
  "Sekme moduyla birden çok karakteri tek pencerede tut.",
  "Overlay hedefi (Aibatt) seç, overlay onu takip etsin.",
  "Oyna'ya tıkla, seçili modda aç (sekme/pencere).",
];

const tipsCn = [
  "拖动配置可调整顺序。",
  "用标签模式在一个窗口开多个角色。",
  "标记覆盖目标（Aibatt），覆盖会跟随。",
  "点击开始游戏，用所选模式打开（标签/窗口）。",
];

const tipsJp = [
  "ドラッグして順序を並べ替え。",
  "タブモードで複数キャラを1ウィンドウに。",
  "オーバーレイ対象（Aibatt）を指定すると追従。",
  "「プレイ」で選択したモード（タブ/ウィンドウ）で開く。",
];

const tipsFallbacks: Record<Locale, string[]> = {
  en: tipsEn,
  de: tipsDe,
  pl: tipsPl,
  fr: tipsFr,
  ru: tipsRu,
  tr: tipsTr,
  cn: tipsCn,
  jp: tipsJp,
};

export function translate(locale: Locale, key: TranslationKey) {
  const dict = translations[locale] ?? translations[DEFAULT_LOCALE];
  return dict[key] ?? translations[DEFAULT_LOCALE][key] ?? key;
}

export function getTips(locale: Locale) {
  return tipsFallbacks[locale] ?? tipsFallbacks[DEFAULT_LOCALE];
}



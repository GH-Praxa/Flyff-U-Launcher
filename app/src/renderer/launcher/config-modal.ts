import { THEMES, type ThemeDefinition } from "../../themes";
import pkg from "../../../package.json";
import { DEFAULT_LOCALE, type Locale, type TranslationKey } from "../../i18n/translations";
import type { TabLayout, ClientSettings } from "../../shared/schemas";
import { DEFAULT_HOTKEYS, formatHotkey, normalizeHotkeySettings, sanitizeHotkeyChord } from "../../shared/hotkeys";
import { logErr } from "../../shared/logger";
import { GRID_CONFIGS, LAYOUT as LAYOUT_CONST } from "../../shared/constants";
import {
    DONATION_URL,
    JOB_ICONS,
    tabLayoutCompact,
    tabLayoutChips1,
    tabLayoutChips2,
    tabLayoutMiniGrid,
} from "../constants";
import {
    type ThemeColors,
    currentTheme,
    isThemeKey,
    FALLBACK_THEME_COLORS,
    applyTheme,
    pushThemeUpdate,
    getActiveThemeColors,
    getThemeColors as getThemeColorsFromStore,
    hexToRgb,
    rgbToHex,
    normalizeHex,
    setTabActiveColor,
    persistTabActiveColor,
    lastTabActiveHex,
    isTabActiveColorManual,
} from "../theme";
import { t, currentLocale } from "../i18n";
import {
    DEFAULT_CLIENT_SETTINGS,
    loadClientSettings,
    patchClientSettings,
    clampLayoutDelaySeconds,
    clampToastDurationSeconds,
    clampLauncherWidthPx,
    clampLauncherHeightPx,
    setLayoutDelaySeconds,
    setToastDurationSeconds,
    setLayoutTabDisplay,
    normalizeTabLayoutDisplay,
    hideSessionViews,
    showSessionViews,
    sequentialGridLoad,
    setSequentialGridLoad,
    autoSaveLayouts,
    setAutoSaveLayouts,
    onLayoutTabDisplayChange,
    applyLauncherFont,
    applyLauncherFontSize,
} from "../settings";
import { el, showToast, jobIconSrc } from "../dom-utils";

export interface ConfigModalDeps {
    snapshotThemeVars: () => Record<string, string>;
    applyThemeToIframe: (iframe: HTMLIFrameElement) => void;
}

/** Format der via `gameIcons:list`-IPC gelieferten Icons (siehe
 *  `gameIcons.ts`-Handler im Main-Process). */
interface GameIcon {
    id: string;
    category: "skills" | "items" | "buffs" | "other";
    name: string;
    path: string;
    dataUrl: string;
}

/**
 * Oeffnet einen Modal-Picker mit allen via Plugins (api-fetch / cd-timer
 * skill-fetcher) gecachten Spiel-Icons. User filtert per Suche + Kategorie-
 * Tabs, klickt ein Icon → `onChoose(dataUrl)`. Klick auf "Loeschen" liefert
 * `null`. ESC oder Klick aufs Overlay schliesst ohne Auswahl.
 *
 * Nutzt `window.controllerApi.listGameIcons()` (Preload-Bridge).
 */
function openGameIconPicker(currentDataUrl: string | undefined, onChoose: (chosen: string | null) => void): void {
    const ctrlApi = (window as unknown as {
        controllerApi?: { listGameIcons?: () => Promise<{ ok: boolean; icons?: GameIcon[]; error?: string }> };
    }).controllerApi;

    const overlay = el("div", "modalOverlay iconPickerOverlay");
    overlay.style.zIndex = "2147483646"; // unter dem ctrlActionMenu, aber ueber dem Settings-Modal
    const modal = el("div", "modal iconPickerModal");
    modal.style.maxWidth = "640px";
    modal.style.height = "min(560px, 80vh)";

    const header = el("div", "modalHeader");
    const title = el("div", "modalHeaderTitle", t("controller.iconPicker.title" as TranslationKey));
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "modalCloseBtn";
    closeBtn.textContent = "×";
    header.append(title, closeBtn);

    const body = el("div", "configBody");
    body.style.padding = "12px";
    body.style.gap = "10px";
    body.style.display = "flex";
    body.style.flexDirection = "column";

    const searchRow = el("div");
    searchRow.style.display = "flex";
    searchRow.style.gap = "8px";
    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.placeholder = t("controller.iconPicker.searchPlaceholder" as TranslationKey);
    searchInput.style.flex = "1";
    searchInput.style.padding = "6px 10px";
    searchInput.style.borderRadius = "6px";
    searchInput.style.border = "1px solid var(--stroke)";
    searchInput.style.background = "var(--panel)";
    searchInput.style.color = "var(--text)";
    const clearIconBtn = document.createElement("button");
    clearIconBtn.type = "button";
    clearIconBtn.className = "ctrlBtn";
    clearIconBtn.textContent = t("controller.iconPicker.removeIcon" as TranslationKey);
    clearIconBtn.title = t("controller.iconPicker.removeIcon" as TranslationKey);
    if (!currentDataUrl) clearIconBtn.disabled = true;
    searchRow.append(searchInput, clearIconBtn);

    const tabsRow = el("div");
    tabsRow.style.display = "flex";
    tabsRow.style.gap = "6px";
    const TABS: Array<{ id: "all" | GameIcon["category"]; labelKey: string }> = [
        { id: "all", labelKey: "controller.iconPicker.tabAll" },
        { id: "skills", labelKey: "controller.iconPicker.tabSkills" },
        { id: "items", labelKey: "controller.iconPicker.tabItems" },
        { id: "buffs", labelKey: "controller.iconPicker.tabBuffs" },
    ];
    let activeTab: "all" | GameIcon["category"] = "all";
    const tabBtns: HTMLButtonElement[] = [];
    for (const tab of TABS) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ctrlBtn";
        btn.textContent = t(tab.labelKey as TranslationKey);
        btn.dataset.tabId = tab.id;
        btn.addEventListener("click", () => {
            activeTab = tab.id;
            for (const b of tabBtns) b.classList.toggle("active", b.dataset.tabId === activeTab);
            renderGrid();
        });
        tabsRow.append(btn);
        tabBtns.push(btn);
    }
    tabBtns[0].classList.add("active");

    const grid = el("div", "iconPickerGrid");
    grid.style.flex = "1";
    grid.style.overflowY = "auto";
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(64px, 1fr))";
    grid.style.gap = "6px";
    grid.style.padding = "8px";
    grid.style.background = "var(--panel)";
    grid.style.borderRadius = "8px";

    const status = el("div");
    status.style.fontSize = "11px";
    status.style.color = "var(--muted)";
    status.style.textAlign = "center";

    body.append(searchRow, tabsRow, grid, status);
    modal.append(header, body);
    overlay.append(modal);
    document.body.append(overlay);

    let allIcons: GameIcon[] = [];
    let loaded = false;

    const close = (chosen: string | null | undefined) => {
        overlay.remove();
        document.removeEventListener("keydown", onKey);
        if (chosen !== undefined) onChoose(chosen);
    };
    const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") close(undefined);
    };
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close(undefined);
    });
    closeBtn.addEventListener("click", () => close(undefined));
    clearIconBtn.addEventListener("click", () => close(null));

    const renderGrid = () => {
        const query = searchInput.value.trim().toLowerCase();
        const filtered = allIcons.filter((icon) => {
            if (activeTab !== "all" && icon.category !== activeTab) return false;
            if (query && !icon.name.toLowerCase().includes(query)) return false;
            return true;
        });
        grid.innerHTML = "";
        if (!loaded) {
            status.textContent = t("controller.iconPicker.loading" as TranslationKey);
            return;
        }
        if (filtered.length === 0) {
            status.textContent = allIcons.length === 0
                ? t("controller.iconPicker.empty" as TranslationKey)
                : t("controller.iconPicker.noMatches" as TranslationKey);
            return;
        }
        status.textContent = t("controller.iconPicker.count" as TranslationKey, { count: String(filtered.length) });
        // Cap auf 500 Icons sichtbar — sonst zerlegt's bei 5000+ Icons den DOM
        const slice = filtered.slice(0, 500);
        for (const icon of slice) {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "iconPickerCell";
            cell.title = icon.name;
            cell.style.aspectRatio = "1 / 1";
            cell.style.border = "1px solid var(--stroke)";
            cell.style.borderRadius = "6px";
            cell.style.background = "var(--panel2, #0d1830)";
            cell.style.cursor = "pointer";
            cell.style.padding = "4px";
            cell.style.display = "flex";
            cell.style.alignItems = "center";
            cell.style.justifyContent = "center";
            const img = document.createElement("img");
            img.src = icon.dataUrl;
            img.alt = icon.name;
            img.loading = "lazy";
            img.style.maxWidth = "100%";
            img.style.maxHeight = "100%";
            img.style.objectFit = "contain";
            cell.append(img);
            cell.addEventListener("click", () => close(icon.dataUrl));
            grid.append(cell);
        }
        if (filtered.length > 500) {
            const more = document.createElement("div");
            more.style.gridColumn = "1 / -1";
            more.style.fontSize = "10px";
            more.style.color = "var(--muted)";
            more.style.textAlign = "center";
            more.style.padding = "6px";
            more.textContent = t("controller.iconPicker.moreHidden" as TranslationKey, { count: String(filtered.length - 500) });
            grid.append(more);
        }
    };

    searchInput.addEventListener("input", () => renderGrid());
    renderGrid();

    if (!ctrlApi?.listGameIcons) {
        loaded = true;
        status.textContent = t("controller.iconPicker.apiUnavailable" as TranslationKey);
        return;
    }

    void ctrlApi.listGameIcons().then((res) => {
        loaded = true;
        if (res?.ok && res.icons) {
            allIcons = res.icons;
        } else {
            allIcons = [];
        }
        renderGrid();
    }).catch((err: unknown) => {
        loaded = true;
        allIcons = [];
        const msg = err instanceof Error ? err.message : String(err);
        status.textContent = `${t("controller.iconPicker.error" as TranslationKey)}: ${msg}`;
    });

    setTimeout(() => searchInput.focus(), 0);
}

export function openConfigModal(
    deps: ConfigModalDeps,
    defaultStyleTab: "theme" | "tabActive" = "theme",
    defaultTab: "style" | "plugins" | "client" | "patchnotes" | "docs" | "support" = "style",
) {
    const { snapshotThemeVars, applyThemeToIframe } = deps;
    const overlay = el("div", "modalOverlay");
    const modal = el("div", "modal configModal");
    const headerEl = el("div", "modalHeader");
    const headerTitle = el("div", "modalHeaderTitle", t("config.title"));
    const headerClose = document.createElement("button");
    headerClose.type = "button";
    headerClose.className = "modalCloseBtn";
    headerClose.title = "Close";
    headerClose.textContent = "\u00d7";
    headerEl.append(headerTitle, headerClose);
    const body = el("div", "modalBody configBody");
    // ── Global Sidebar with sub-categories ──
    type SidebarId = "client.display" | "client.layout" | "client.behavior"
        | "client.theme" | "client.tabcolor" | "client.font" | "client.hotkeys"
        | "controller"
        | "plugins" | "patchnotes" | "docs" | "support";
    const globalSidebar = el("div", "settingsSidebar");
    const allSidebarBtns = new Map<SidebarId, HTMLButtonElement>();

    const createSidebarGroup = (groupLabel: string, groupIcon: string) => {
        const header = el("div", "sidebarGroupHeader");
        const iconSpan = el("span", "sidebarIcon", groupIcon);
        const labelSpan = el("span", "sidebarGroupLabel", groupLabel);
        header.append(iconSpan, labelSpan);
        globalSidebar.append(header);
    };
    const createSidebarBtn = (id: SidebarId, icon: string, label: string, indent = false) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = indent ? "sidebarCategory sidebarSub" : "sidebarCategory";
        const iconSpan = el("span", "sidebarIcon", icon);
        const labelSpan = el("span", "sidebarLabel", label);
        btn.append(iconSpan, labelSpan);
        globalSidebar.append(btn);
        allSidebarBtns.set(id, btn);
    };

    // Settings group (merged: client + style)
    createSidebarGroup(t("config.tab.settings"), "\u2699\uFE0F");
    createSidebarBtn("client.display", "\uD83D\uDDA5\uFE0F", t("config.client.cat.display" as TranslationKey), true);
    createSidebarBtn("client.layout", "\uD83D\uDCF1", t("config.client.cat.layout" as TranslationKey), true);
    createSidebarBtn("client.behavior", "\u26A1", t("config.client.cat.behavior" as TranslationKey), true);
    createSidebarBtn("client.theme", "\uD83C\uDF0C", t("config.tab.theme"), true);
    createSidebarBtn("client.tabcolor", "\uD83D\uDD8C\uFE0F", t("config.tab.style.activeTabColor"), true);
    createSidebarBtn("client.font", "\uD83C\uDFA8", t("config.client.cat.font" as TranslationKey), true);
    createSidebarBtn("client.hotkeys", "\u2328\uFE0F", t("config.client.cat.hotkeys" as TranslationKey), true);
    // Separator
    const sep = el("div", "sidebarSep");
    globalSidebar.append(sep);
    // Other pages
    createSidebarBtn("controller", "\uD83C\uDFAE", t("config.tab.controller" as TranslationKey));
    createSidebarBtn("plugins", "\uD83E\uDDE9", t("config.tab.plugins" as TranslationKey));
    createSidebarBtn("patchnotes", "\uD83D\uDCCB", t("config.tab.patchnotes" as TranslationKey));
    createSidebarBtn("docs", "\uD83D\uDCD6", t("config.tab.docs" as TranslationKey));
    createSidebarBtn("support", "\u2764\uFE0F", t("config.tab.support" as TranslationKey));

    const content = el("div", "configContent");
    // Each client sub-category is its own pane (separate page per sidebar item)
    const displayPane = el("div", "configPaneCard");
    const layoutPane = el("div", "configPaneCard");
    const behaviorPane = el("div", "configPaneCard");
    const styleContentBody = el("div", "styleContent");
    const themePane = el("div", "stylePane configPaneCard");
    themePane.append(styleContentBody);
    const tabColorPane = el("div", "tabColorPaneWrapper configPaneCard");
    tabColorPane.style.display = "none";
    const fontPane = el("div", "configPaneCard");
    const hotkeysPane = el("div", "configPaneCard");
    // Controller pane
    const controllerPane = el("div", "controllerPane configPaneCard");
    controllerPane.style.display = "none";

    // Plugins pane
    const pluginsPane = el("div", "pluginsPane configPaneCard");
    const pluginsTitle = el("div", "pluginsTitle", t("config.plugins.title" as TranslationKey));
    const pluginsList = el("div", "pluginsList");
    const pluginsEmpty = el("div", "pluginsEmpty muted", t("config.plugins.empty" as TranslationKey));
    pluginsPane.append(pluginsTitle, pluginsList, pluginsEmpty);

    // Helper: create toggle switch (replaces old checkboxes)
    const createToggleSwitch = (cb: HTMLInputElement): HTMLLabelElement => {
        const lbl = document.createElement("label");
        lbl.className = "toggleSwitch";
        cb.type = "checkbox";
        const slider = el("span", "toggleSlider");
        lbl.append(cb, slider);
        return lbl;
    };
    // Helper: create a setting card with toggle
    const createToggleCard = (labelText: string, hintText: string, cb: HTMLInputElement): HTMLDivElement => {
        const card = el("div", "settingCard") as HTMLDivElement;
        const info = el("div", "settingInfo");
        const lbl = el("div", "settingLabel", labelText);
        info.append(lbl);
        if (hintText) {
            const hint = el("div", "settingHint", hintText);
            info.append(hint);
        }
        const toggle = createToggleSwitch(cb);
        card.append(info, toggle);
        return card;
    };
    // Helper: create a slider card
    const createSliderCard = (labelText: string, hintText: string, input: HTMLInputElement, valueBadge: HTMLElement): HTMLDivElement => {
        const card = el("div", "settingCard sliderCard") as HTMLDivElement;
        const header = el("div", "sliderHeader");
        const info = el("div", "settingInfo");
        const lbl = el("div", "settingLabel", labelText);
        info.append(lbl);
        if (hintText) {
            const hint = el("div", "settingHint", hintText);
            info.append(hint);
        }
        valueBadge.className = "sliderValueBadge";
        header.append(info, valueBadge);
        input.className = "slider";
        input.style.width = "";
        card.append(header, input);
        return card;
    };
    // Helper: collapsible section
    const createSection = (icon: string, titleText: string, extraInfo?: string): { section: HTMLDivElement; contentEl: HTMLDivElement; header: HTMLDivElement } => {
        const section = el("div", "settingsSection") as HTMLDivElement;
        const header = el("div", "sectionHeader") as HTMLDivElement;
        const title = el("div", "sectionTitle");
        const iconSpan = el("span", "", icon);
        const titleSpan = document.createTextNode(` ${titleText}`);
        title.append(iconSpan, titleSpan);
        if (extraInfo) {
            const extra = el("span", "");
            extra.style.fontWeight = "400";
            extra.style.fontSize = "11px";
            extra.style.color = "var(--muted)";
            extra.style.marginLeft = "8px";
            extra.textContent = extraInfo;
            title.append(extra);
        }
        const toggle = el("span", "sectionToggle", "\u25BC");
        header.append(title, toggle);
        const contentEl = el("div", "sectionContent") as HTMLDivElement;
        header.addEventListener("click", () => {
            header.classList.toggle("collapsed");
            contentEl.classList.toggle("hidden");
        });
        section.append(header, contentEl);
        return { section, contentEl, header };
    };

    // ── Fullscreen toggle ──
    const fullscreenCheckbox = document.createElement("input");
    const delayInput = document.createElement("input");
    delayInput.type = "range";
    delayInput.min = "0";
    delayInput.max = "30";
    delayInput.step = "1";
    const delayValue = el("div", "sliderValueBadge", "");
    // Sequential grid loading toggle
    const seqCheckbox = document.createElement("input");
    const seqToggle = {
        get: () => seqCheckbox.checked,
        set: (val: boolean) => {
            seqCheckbox.checked = !!val;
        },
    };
    const tabDisplaySelect = document.createElement("select");
    tabDisplaySelect.className = "settingSelect";
    tabDisplaySelect.title = t("config.client.tabLayoutDisplay.hint" as TranslationKey);
    const tabDisplayOptions: Array<{ value: ClientSettings["tabLayoutDisplay"]; label: TranslationKey; icon: string }> = [
        { value: "compact", label: "config.client.tabLayoutDisplay.compact" as TranslationKey, icon: "\u25A2\u25A2\u25A2" },
        { value: "grouped", label: "config.client.tabLayoutDisplay.grouped" as TranslationKey, icon: "\u25A3\u25A3 \u25A3\u25A3" },
        { value: "separated", label: "config.client.tabLayoutDisplay.separated" as TranslationKey, icon: "\u25A2 \u25A2 \u25A2" },
        { value: "mini-grid", label: "config.client.tabLayoutDisplay.mini-grid" as TranslationKey, icon: "\u25A6\u25A6" },
    ];
    for (const opt of tabDisplayOptions) {
        const optionEl = document.createElement("option");
        optionEl.value = opt.value;
        optionEl.textContent = t(opt.label);
        tabDisplaySelect.append(optionEl);
    }
    // Layout option cards with image previews
    const layoutPreviewImages: Record<string, string> = {
        compact: tabLayoutCompact,
        grouped: tabLayoutChips1,
        separated: tabLayoutChips2,
        "mini-grid": tabLayoutMiniGrid,
    };
    const layoutPreviewRow = el("div", "layoutPreviewRow");
    const layoutOptionEls = new Map<string, HTMLDivElement>();
    for (const opt of tabDisplayOptions) {
        const optDiv = el("div", "layoutOption") as HTMLDivElement;
        const img = document.createElement("img");
        img.className = "layoutOptionImg";
        img.src = layoutPreviewImages[opt.value] ?? "";
        img.alt = t(opt.label);
        const labelDiv = el("div", "layoutOptionLabel", t(opt.label));
        optDiv.append(img, labelDiv);
        optDiv.addEventListener("click", () => {
            tabDisplaySelect.value = opt.value;
            tabDisplaySelect.dispatchEvent(new Event("change"));
            updateLayoutOptionActive();
        });
        layoutPreviewRow.append(optDiv);
        layoutOptionEls.set(opt.value, optDiv);
    }
    const updateLayoutOptionActive = () => {
        for (const [val, div] of layoutOptionEls) {
            div.classList.toggle("active", val === tabDisplaySelect.value);
        }
    };
    onLayoutTabDisplayChange(() => updateLayoutOptionActive());
    updateLayoutOptionActive();
    const gridBorderCheckbox = document.createElement("input");
    const gridBorderToggle = {
        get: () => gridBorderCheckbox.checked,
        set: (val: boolean) => {
            gridBorderCheckbox.checked = !!val;
        },
    };
    const autoSaveCheckbox = document.createElement("input");
    const autoSaveToggle = {
        get: () => autoSaveCheckbox.checked,
        set: (val: boolean) => {
            autoSaveCheckbox.checked = !!val;
        },
    };
    const annCheckbox = document.createElement("input");
    const annToggle = {
        get: () => annCheckbox.checked,
        set: (val: boolean) => { annCheckbox.checked = !!val; },
    };
    const collapsibleCheckbox = document.createElement("input");
    const collapsibleToggle = {
        get: () => collapsibleCheckbox.checked,
        set: (val: boolean) => { collapsibleCheckbox.checked = !!val; },
    };
    const telemetryCheckbox = document.createElement("input");
    const telemetryToggle = {
        get: () => telemetryCheckbox.checked,
        set: (val: boolean) => {
            telemetryCheckbox.checked = !!val;
        },
    };
    const ramCheckbox = document.createElement("input");
    const ramToggle = {
        get: () => ramCheckbox.checked,
        set: (val: boolean) => { ramCheckbox.checked = !!val; },
    };
    const updateCheckbox = document.createElement("input");
    const updateToggle = {
        get: () => updateCheckbox.checked,
        set: (val: boolean) => { updateCheckbox.checked = !!val; },
    };
    const toastInput = document.createElement("input");
    toastInput.type = "range";
    toastInput.min = "1";
    toastInput.max = "60";
    toastInput.step = "1";
    const toastValue = el("div", "sliderValueBadge", "");
    const launcherWidthInput = document.createElement("input");
    launcherWidthInput.type = "range";
    launcherWidthInput.min = String(LAYOUT_CONST.LAUNCHER_MIN_WIDTH);
    launcherWidthInput.max = String(LAYOUT_CONST.LAUNCHER_MAX_WIDTH);
    launcherWidthInput.step = "10";
    launcherWidthInput.title = t("config.client.launcherWidthHint" as TranslationKey);
    const launcherWidthValue = el("div", "sliderValueBadge", "");
    const launcherHeightInput = document.createElement("input");
    launcherHeightInput.type = "range";
    launcherHeightInput.min = String(LAYOUT_CONST.LAUNCHER_MIN_HEIGHT);
    launcherHeightInput.max = String(LAYOUT_CONST.LAUNCHER_MAX_HEIGHT);
    launcherHeightInput.step = "10";
    launcherHeightInput.title = t("config.client.launcherHeightHint" as TranslationKey);
    const launcherHeightValue = el("div", "sliderValueBadge", "");
    // ── Game Font Row ──────────────────────────────────────────────────
    // Load Google Fonts in the launcher window so the preview works
    const PREVIEW_FONTS_URL =
        "https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@400;700" +
        "&family=Roboto:wght@400;700&family=Open+Sans:wght@400;700" +
        "&family=Lato:wght@400;700&family=Montserrat:wght@400;700" +
        "&family=Raleway:wght@400;700&family=Nunito:wght@400;700" +
        "&family=Ubuntu:wght@400;700&family=Cinzel:wght@400;700&display=swap";
    if (!document.querySelector(`link[href="${PREVIEW_FONTS_URL}"]`)) {
        const previewFontsLink = document.createElement("link");
        previewFontsLink.rel = "stylesheet";
        previewFontsLink.href = PREVIEW_FONTS_URL;
        document.head.appendChild(previewFontsLink);
    }
    const FONT_OPTIONS: Array<{ value: string | null; label: string }> = [
        { value: null,           label: t("config.client.gameFont.default" as TranslationKey) },
        { value: "Josefin Sans", label: "Josefin Sans" },
        { value: "Roboto",       label: "Roboto" },
        { value: "Open Sans",    label: "Open Sans" },
        { value: "Lato",         label: "Lato" },
        { value: "Montserrat",   label: "Montserrat" },
        { value: "Raleway",      label: "Raleway" },
        { value: "Nunito",       label: "Nunito" },
        { value: "Ubuntu",        label: "Ubuntu" },
        { value: "Cinzel",        label: "Cinzel" },
        { value: "sans-serif",   label: "sans-serif (System)" },
        { value: "serif",        label: "serif (System)" },
        { value: "monospace",    label: "Monospace (System)" },
    ];
    const fontSelect = document.createElement("select");
    fontSelect.className = "settingSelect";
    for (const opt of FONT_OPTIONS) {
        const o = document.createElement("option");
        o.value = opt.value ?? "__default__";
        o.textContent = opt.label;
        fontSelect.append(o);
    }
    const fontPreview = el("div", "fontPreviewText");
    fontPreview.style.letterSpacing = "0.02em";
    fontPreview.textContent = t("config.client.gameFont.preview" as TranslationKey);

    const applyFontPreview = (font: string | null) => {
        fontPreview.style.fontFamily = font ? `"${font}", sans-serif` : "";
    };

    const getFontSelectValue = (): string | null => {
        if (fontSelect.value === "__default__") return null;
        return fontSelect.value;
    };

    const syncFontSelectFromValue = (font: string | null) => {
        if (!font) {
            fontSelect.value = "__default__";
        } else {
            const known = FONT_OPTIONS.find((o) => o.value === font && o.value !== null);
            if (known) {
                fontSelect.value = font;
            } else {
                // Unknown font from old config — fall back to default
                fontSelect.value = "__default__";
            }
        }
        applyFontPreview(font);
    };

    let fontSaveTimer: ReturnType<typeof setTimeout> | null = null;
    const persistFont = async (font: string | null) => {
        if (fontSaveTimer) { clearTimeout(fontSaveTimer); fontSaveTimer = null; }
        try {
            await patchClientSettings({ gameFont: font } as Parameters<typeof patchClientSettings>[0]);
            applyLauncherFont(font);
            showToast(t("config.client.gameFont.saved" as TranslationKey), "success");
        } catch (err) {
            showToast(String(err), "error");
        }
    };

    fontSelect.addEventListener("change", async () => {
        const font = getFontSelectValue();
        applyFontPreview(font);
        await persistFont(font);
    });

    // ── Launcher Font Size Row ──────────────────────────────────────────
    const LAUNCHER_FONT_SIZE_MIN = 75;
    const LAUNCHER_FONT_SIZE_MAX = 150;
    const LAUNCHER_FONT_SIZE_STEP = 5;
    const LAUNCHER_FONT_SIZE_DEFAULT = 100;
    const clampFontSize = (v: number) =>
        Math.round(Math.min(LAUNCHER_FONT_SIZE_MAX, Math.max(LAUNCHER_FONT_SIZE_MIN, v)) / LAUNCHER_FONT_SIZE_STEP) * LAUNCHER_FONT_SIZE_STEP;

    const fontSizeInput = document.createElement("input");
    fontSizeInput.type = "range";
    fontSizeInput.min = String(LAUNCHER_FONT_SIZE_MIN);
    fontSizeInput.max = String(LAUNCHER_FONT_SIZE_MAX);
    fontSizeInput.step = String(LAUNCHER_FONT_SIZE_STEP);
    fontSizeInput.value = String(LAUNCHER_FONT_SIZE_DEFAULT);
    const fontSizeValue = el("div", "sliderValueBadge", "100%");

    let fontSizeSaveTimer: ReturnType<typeof setTimeout> | null = null;
    fontSizeInput.addEventListener("change", () => {
        const v = clampFontSize(fontSizeInput.valueAsNumber);
        fontSizeInput.value = String(v);
        fontSizeValue.textContent = `${v}%`;
        applyLauncherFontSize(v === LAUNCHER_FONT_SIZE_DEFAULT ? null : v);
        if (fontSizeSaveTimer) clearTimeout(fontSizeSaveTimer);
        fontSizeSaveTimer = setTimeout(async () => {
            fontSizeSaveTimer = null;
            try {
                await patchClientSettings({ launcherFontSize: v === LAUNCHER_FONT_SIZE_DEFAULT ? null : v } as Parameters<typeof patchClientSettings>[0]);
                showToast(t("config.client.launcherFontSize.saved" as TranslationKey), "success");
            } catch (err) {
                showToast(String(err), "error");
            }
        }, 600);
    });

    // ── Build cards for each pane ──
    // Display pane content
    const displayGrid = el("div", "settingsGrid");
    displayGrid.append(
        createToggleCard(t("config.client.fullscreen"), t("config.client.fullscreen.hint" as TranslationKey), fullscreenCheckbox),
        createToggleCard(t("config.client.gridActiveBorder" as TranslationKey), t("config.client.gridActiveBorder.hint" as TranslationKey), gridBorderCheckbox),
        createToggleCard(t("config.client.showAnnouncements" as TranslationKey), t("config.client.showAnnouncements.hint" as TranslationKey), annCheckbox),
        createToggleCard(t("config.client.collapsibleOpenProfiles" as TranslationKey), t("config.client.collapsibleOpenProfiles.hint" as TranslationKey), collapsibleCheckbox),
        createToggleCard(t("config.client.showRamUsage" as TranslationKey), t("config.client.showRamUsage.hint" as TranslationKey), ramCheckbox),
    );
    displayPane.append(displayGrid);

    // Layout pane content
    const layoutGrid = el("div", "settingsGrid");
    layoutGrid.append(
        createSliderCard(t("config.client.launcherWidth" as TranslationKey), "", launcherWidthInput, launcherWidthValue),
        createSliderCard(t("config.client.launcherHeight" as TranslationKey), "", launcherHeightInput, launcherHeightValue),
        createSliderCard(t("config.client.layoutDelay"), t("config.client.layoutDelay.hint" as TranslationKey), delayInput, delayValue),
        createSliderCard(t("config.client.toastDuration"), t("config.client.toastDuration.hint"), toastInput, toastValue),
    );
    // Tab layout mode visual selector
    const layoutModeWrapper = el("div", "");
    layoutModeWrapper.style.marginTop = "12px";
    const layoutModeLabel = el("div", "settingLabel", t("config.client.tabLayoutDisplay" as TranslationKey));
    layoutModeLabel.style.marginBottom = "8px";
    layoutModeWrapper.append(layoutModeLabel, layoutPreviewRow);
    layoutPane.append(layoutGrid, layoutModeWrapper);

    // Behavior pane content
    const behaviorGrid = el("div", "settingsGrid");
    behaviorGrid.append(
        createToggleCard(t("config.client.layoutAutoSave" as TranslationKey), t("config.client.layoutAutoSave.hint" as TranslationKey), autoSaveCheckbox),
        createToggleCard(t("config.client.seqGridLoad"), t("config.client.seqGridLoad.hint"), seqCheckbox),
        createToggleCard(t("config.client.sendTelemetry" as TranslationKey), t("config.client.sendTelemetry.hint" as TranslationKey), telemetryCheckbox),
        createToggleCard(t("config.client.checkForUpdatesOnStart" as TranslationKey), t("config.client.checkForUpdatesOnStart.hint" as TranslationKey), updateCheckbox),
    );

    // Manual update check button
    const updateBtnCard = el("div", "settingCard sliderCard") as HTMLDivElement;
    const updateBtnInfo = el("div", "settingInfo");
    updateBtnInfo.append(el("div", "settingLabel", t("config.client.checkForUpdatesManual" as TranslationKey)));
    updateBtnInfo.append(el("div", "settingHint", t("config.client.checkForUpdatesManual.hint" as TranslationKey)));
    const checkUpdateBtn = el("button", "btn primary") as HTMLButtonElement;
    checkUpdateBtn.textContent = t("config.client.checkForUpdatesManual.button" as TranslationKey);
    checkUpdateBtn.style.marginTop = "8px";
    checkUpdateBtn.addEventListener("click", async () => {
        checkUpdateBtn.disabled = true;
        checkUpdateBtn.textContent = "...";
        try {
            const res = await (window.api as unknown as Record<string, () => Promise<{ ok: boolean; error?: string }>>).appCheckForUpdates();
            if (!res.ok) {
                showToast(res.error ?? "Unknown error", "error");
            }
        } catch (err) {
            showToast(String(err), "error");
        } finally {
            checkUpdateBtn.disabled = false;
            checkUpdateBtn.textContent = t("config.client.checkForUpdatesManual.button" as TranslationKey);
        }
    });
    updateBtnCard.append(updateBtnInfo, checkUpdateBtn);
    behaviorGrid.append(updateBtnCard);

    // ── Version rollback card ────────────────────────────────────────
    const rollbackCard = el("div", "settingCard sliderCard") as HTMLDivElement;
    const rollbackInfo = el("div", "settingInfo");
    rollbackInfo.append(el("div", "settingLabel", t("config.client.rollback" as TranslationKey)));
    rollbackInfo.append(el("div", "settingHint", t("config.client.rollback.hint" as TranslationKey)));
    const rollbackRow = el("div", "rollbackRow");
    const versionSelect = document.createElement("select") as HTMLSelectElement;
    versionSelect.className = "select";
    versionSelect.style.minWidth = "160px";
    const placeholderOpt = document.createElement("option");
    placeholderOpt.value = "";
    placeholderOpt.textContent = t("config.client.rollback.loading" as TranslationKey);
    placeholderOpt.disabled = true;
    placeholderOpt.selected = true;
    versionSelect.append(placeholderOpt);
    versionSelect.disabled = true;
    const rollbackBtn = el("button", "btn danger") as HTMLButtonElement;
    rollbackBtn.textContent = t("config.client.rollback.button" as TranslationKey);
    rollbackBtn.disabled = true;
    rollbackRow.append(versionSelect, rollbackBtn);
    rollbackCard.append(rollbackInfo, rollbackRow);
    behaviorGrid.append(rollbackCard);
    // Fetch releases async
    (async () => {
        try {
            const res = await window.api.appListReleases();
            versionSelect.innerHTML = "";
            if (!res.ok || !res.releases?.length) {
                const errOpt = document.createElement("option");
                errOpt.value = "";
                errOpt.textContent = t("config.client.rollback.noReleases" as TranslationKey);
                errOpt.disabled = true;
                errOpt.selected = true;
                versionSelect.append(errOpt);
                return;
            }
            const defaultOpt = document.createElement("option");
            defaultOpt.value = "";
            defaultOpt.textContent = t("config.client.rollback.select" as TranslationKey);
            defaultOpt.disabled = true;
            defaultOpt.selected = true;
            versionSelect.append(defaultOpt);
            for (const rel of res.releases) {
                const opt = document.createElement("option");
                opt.value = rel.version;
                const dateStr = new Date(rel.date).toLocaleDateString();
                const suffix = rel.current ? ` (${t("config.client.rollback.current" as TranslationKey)})` : "";
                opt.textContent = `v${rel.version} – ${dateStr}${suffix}`;
                if (rel.current) opt.disabled = true;
                versionSelect.append(opt);
            }
            versionSelect.disabled = false;
            versionSelect.onchange = () => {
                rollbackBtn.disabled = !versionSelect.value;
            };
        } catch {
            versionSelect.innerHTML = "";
            const errOpt = document.createElement("option");
            errOpt.value = "";
            errOpt.textContent = t("config.client.rollback.error" as TranslationKey);
            errOpt.disabled = true;
            errOpt.selected = true;
            versionSelect.append(errOpt);
        }
    })();
    rollbackBtn.onclick = async () => {
        const version = versionSelect.value;
        if (!version) return;
        rollbackBtn.disabled = true;
        rollbackBtn.textContent = "...";
        versionSelect.disabled = true;
        try {
            const res = await window.api.appInstallVersion(version);
            if (!res.ok) {
                showToast(res.error ?? "Unknown error", "error");
            }
        } catch (err) {
            showToast(String(err), "error");
        } finally {
            rollbackBtn.disabled = false;
            rollbackBtn.textContent = t("config.client.rollback.button" as TranslationKey);
            versionSelect.disabled = false;
        }
    };

    behaviorPane.append(behaviorGrid);

    // Font pane content
    const fontGrid = el("div", "settingsGrid");
    // Game font card (select + custom input + preview)
    const fontCard = el("div", "settingCard sliderCard") as HTMLDivElement;
    const fontCardInfo = el("div", "settingInfo");
    fontCardInfo.append(el("div", "settingLabel", t("config.client.gameFont" as TranslationKey)));
    fontCardInfo.append(el("div", "settingHint", t("config.client.gameFont.hint" as TranslationKey)));
    fontCard.append(fontCardInfo, fontSelect, fontPreview);
    // Font size card
    const fontSizeCard = createSliderCard(
        t("config.client.launcherFontSize" as TranslationKey),
        t("config.client.launcherFontSize.hint" as TranslationKey),
        fontSizeInput, fontSizeValue);
    fontGrid.append(fontCard, fontSizeCard);
    fontPane.append(fontGrid);

    const setSliderBadge = (input: HTMLInputElement, badge: HTMLElement, formatter: (v: number) => string) => {

        const val = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : Number(input.value);
        badge.textContent = formatter(val);
    };
    let currentHotkeys = normalizeHotkeySettings(DEFAULT_CLIENT_SETTINGS.hotkeys, DEFAULT_HOTKEYS);
    let hotkeyRevision = 0;

    type HotkeyKey = keyof typeof currentHotkeys;

    const hotkeyDefs: Array<{ key: HotkeyKey; label: TranslationKey; hint: TranslationKey; defaultChord: ReturnType<typeof normalizeHotkeySettings>[HotkeyKey] }> = [
        { key: "toggleOverlays", label: "config.client.hotkeys.toggleOverlays" as TranslationKey, hint: "config.client.hotkeys.toggleOverlays.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.toggleOverlays },
        { key: "sidePanelToggle", label: "config.client.hotkeys.sidePanelToggle" as TranslationKey, hint: "config.client.hotkeys.sidePanelToggle.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.sidePanelToggle },
        { key: "tabBarToggle", label: "config.client.hotkeys.tabBarToggle" as TranslationKey, hint: "config.client.hotkeys.tabBarToggle.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.tabBarToggle },
        { key: "screenshotWindow", label: "config.client.hotkeys.screenshotWindow" as TranslationKey, hint: "config.client.hotkeys.screenshotWindow.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.screenshotWindow },
        { key: "tabPrev", label: "config.client.hotkeys.tabPrev" as TranslationKey, hint: "config.client.hotkeys.tabPrev.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.tabPrev },
        { key: "tabNext", label: "config.client.hotkeys.tabNext" as TranslationKey, hint: "config.client.hotkeys.tabNext.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.tabNext },
        { key: "nextInstance", label: "config.client.hotkeys.nextInstance" as TranslationKey, hint: "config.client.hotkeys.nextInstance.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.nextInstance },
        { key: "cdTimerExpireAll", label: "config.client.hotkeys.cdTimerExpireAll" as TranslationKey, hint: "config.client.hotkeys.cdTimerExpireAll.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.cdTimerExpireAll },
        { key: "showFcoinConverter", label: "config.client.hotkeys.showFcoinConverter" as TranslationKey, hint: "config.client.hotkeys.showFcoinConverter.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.showFcoinConverter },
        { key: "showShoppingList", label: "config.client.hotkeys.showShoppingList" as TranslationKey, hint: "config.client.hotkeys.showShoppingList.hint" as TranslationKey, defaultChord: DEFAULT_HOTKEYS.showShoppingList },
    ];
    // Hotkeys pane content
    const hotkeyRowsContainer = el("div", "hotkeyGrid");
    hotkeysPane.append(hotkeyRowsContainer);

    type HotkeyRowUi = {

        badge: HTMLDivElement;
        recordBtn: HTMLButtonElement;
        clearBtn: HTMLButtonElement;
    };
    const hotkeyUi: Partial<Record<HotkeyKey, HotkeyRowUi>> = {};

    const setHotkeyBadge = (key: HotkeyKey, chord: ReturnType<typeof normalizeHotkeySettings>[HotkeyKey]) => {

        const ui = hotkeyUi[key];
        if (!ui)
            return;
        const label = chord && Array.isArray(chord) && chord.length
            ? formatHotkey(chord)
            : t("config.client.hotkeys.notSet" as TranslationKey);
        ui.badge.textContent = label;
    };

    const setHotkeyButtonsDisabled = (key: HotkeyKey, disabled: boolean) => {

        const ui = hotkeyUi[key];
        if (!ui)
            return;
        ui.recordBtn.disabled = disabled;
        ui.clearBtn.disabled = disabled;
    };

    const applyHotkeyState = (settings: ClientSettings) => {

        currentHotkeys = normalizeHotkeySettings(settings.hotkeys ?? currentHotkeys, currentHotkeys);
        for (const def of hotkeyDefs) {
            setHotkeyBadge(def.key, currentHotkeys[def.key]);
        }
    };

    async function persistHotkey(key: HotkeyKey, next: ReturnType<typeof normalizeHotkeySettings>[HotkeyKey]) {

        const prevHotkeys = currentHotkeys;
        // Optimistic update so the badge doesn't flicker back to "not set" while saving
        currentHotkeys = normalizeHotkeySettings({ ...currentHotkeys, [key]: next } as ClientSettings["hotkeys"], currentHotkeys);
        // Conflict check (client-side)
        const isSameChord = (a: ReturnType<typeof normalizeHotkeySettings>[HotkeyKey], b: ReturnType<typeof normalizeHotkeySettings>[HotkeyKey]) => {
            if (!a || !b)
                return false;
            if (a.length !== b.length)
                return false;
            return a.every((v, i) => v === b[i]);
        };
        const conflict = hotkeyDefs.find((def) => def.key !== key && isSameChord(currentHotkeys[def.key], currentHotkeys[key]));
        if (conflict) {
            showToast(t("config.client.hotkeys.conflict" as TranslationKey), "error");
            currentHotkeys = prevHotkeys;
            applyHotkeyState({ ...DEFAULT_CLIENT_SETTINGS, hotkeys: currentHotkeys });
            return;
        }
        applyHotkeyState({ ...DEFAULT_CLIENT_SETTINGS, hotkeys: currentHotkeys });
        setHotkeyButtonsDisabled(key, true);
        try {
            const updated = await patchClientSettings({ hotkeys: { [key]: next } as ClientSettings["hotkeys"] });
            if (!updated) {
                throw new Error("Client settings service unavailable (no IPC bridge)");
            }
            // Re-read from disk to be 100% sure we reflect what was persisted
            const verified = await loadClientSettings();
            hotkeyRevision += 1;
            currentHotkeys = normalizeHotkeySettings(verified.hotkeys ?? updated.hotkeys ?? currentHotkeys, currentHotkeys);
            applyHotkeyState({ ...verified, hotkeys: currentHotkeys });
            showToast(t("config.client.hotkeys.saved" as TranslationKey), "success");
        }
        catch (err) {
            // Revert optimistic update on failure
            currentHotkeys = prevHotkeys;
            applyHotkeyState({ ...DEFAULT_CLIENT_SETTINGS, hotkeys: currentHotkeys });
            showToast(String(err), "error");
        }
        finally {
            setHotkeyButtonsDisabled(key, false);
        }
    }
    let captureActive = false;
    let captureKeys = new Set<string>();
    let captureTimer: number | null = null;
    let captureTarget: HotkeyKey | null = null;

    const stopCapture = (restoreBadge: boolean) => {

        if (!captureActive)
            return;
        captureActive = false;
        if (captureTimer) {
            window.clearTimeout(captureTimer);
            captureTimer = null;
        }
        window.removeEventListener("keydown", onCaptureKeyDown, true);
        window.removeEventListener("keyup", onCaptureKeyUp, true);
        if (captureTarget && hotkeyUi[captureTarget]) {
            hotkeyUi[captureTarget]!.recordBtn.textContent = t("config.client.hotkeys.record" as TranslationKey);
            if (restoreBadge) {
                setHotkeyBadge(captureTarget, currentHotkeys[captureTarget]);
            }
        }
        captureTarget = null;
        // Re-enable global hotkeys after recording
        window.api?.hotkeysResume?.().catch((): void => undefined);
    };

    const finalizeCapture = () => {

        if (!captureActive || !captureTarget)
            return;
        const target = captureTarget;
        const rawKeys = Array.from(captureKeys);
        const chord = sanitizeHotkeyChord(rawKeys);
        stopCapture(false);
        if (!chord) {
            showToast(t("config.client.hotkeys.invalid" as TranslationKey), "error");
            captureKeys.clear();
            setHotkeyBadge(target, currentHotkeys[target]);
            return;
        }
        const chordStr = chord.join("+");
        const conflictKey = (Object.keys(currentHotkeys) as HotkeyKey[]).find((k) => {
            if (k === target) return false;
            const existing = currentHotkeys[k];
            return existing && existing.join("+") === chordStr;
        });
        if (conflictKey) {
            showToast(t("config.client.hotkeys.conflict" as TranslationKey), "error");
            captureKeys.clear();
            setHotkeyBadge(target, currentHotkeys[target]);
            return;
        }
        captureKeys.clear();
        void persistHotkey(target, chord);
    };

    const onCaptureKeyDown = (e: KeyboardEvent) => {

        if (!captureActive || !captureTarget)
            return;
        e.preventDefault();
        e.stopPropagation();
        captureKeys.add(e.key);
        const snapshot = Array.from(captureKeys);
        const preview = sanitizeHotkeyChord(snapshot);
        setHotkeyBadge(captureTarget, preview ?? (snapshot.length ? snapshot : null));
        if (captureTimer) {
            window.clearTimeout(captureTimer);
            captureTimer = null;
        }
        captureTimer = window.setTimeout(() => finalizeCapture(), 900);
        if (captureKeys.size >= 3) {
            finalizeCapture();
        }
    };

    const onCaptureKeyUp = (e: KeyboardEvent) => {

        if (!captureActive)
            return;
        if (e.key === "Escape") {
            captureKeys.clear();
            stopCapture(true);
        }
    };
    for (const def of hotkeyDefs) {
        const card = el("div", "hotkeyCard");
        const info = el("div", "hotkeyInfo");
        const label = el("span", "hotkeyLabel", t(def.label));
        const hint = el("span", "hotkeyHint", t(def.hint));
        info.append(label, hint);
        const badge = el("div", "hotkeyBadge");
        const actions = el("div", "hotkeyActions");
        const recordBtn = el("button", "btn primary", t("config.client.hotkeys.record" as TranslationKey));
        const clearBtn = el("button", "btn xBtn", "\u00D7");
        clearBtn.title = t("config.client.hotkeys.clear" as TranslationKey);
        clearBtn.setAttribute("aria-label", t("config.client.hotkeys.clear" as TranslationKey));
        actions.append(clearBtn, recordBtn);
        card.append(info, badge, actions);
        hotkeyRowsContainer.append(card);
        hotkeyUi[def.key] = { badge: badge as HTMLDivElement, recordBtn: recordBtn as HTMLButtonElement, clearBtn: clearBtn as HTMLButtonElement };
        recordBtn.addEventListener("click", () => {
            if (captureActive && captureTarget === def.key) {
                stopCapture(true);
                return;
            }
            stopCapture(true);
            captureKeys = new Set<string>();
            captureActive = true;
            captureTarget = def.key;
            // Pause global hotkeys so they don't intercept key presses during recording
            window.api?.hotkeysPause?.().catch((): void => undefined);
            showToast(t("config.client.hotkeys.recordHint" as TranslationKey), "info");
            recordBtn.textContent = t("config.client.hotkeys.recording" as TranslationKey);
            setHotkeyBadge(def.key, null);
            window.addEventListener("keydown", onCaptureKeyDown, true);
            window.addEventListener("keyup", onCaptureKeyUp, true);
        });
        clearBtn.addEventListener("click", () => {
            stopCapture(true);
            setHotkeyBadge(def.key, null);
            void persistHotkey(def.key, null);
        });
    }
    // Patchnotes pane
    const patchnotesPane = el("div", "patchnotesPane configPaneCard");
    const patchnotesContent = el("div", "patchnotesContent");
    patchnotesPane.append(patchnotesContent);
    // Documentation pane
    const docsPane = el("div", "docsPane configPaneCard");
    const docsContent = el("div", "docsContent");
    docsPane.append(docsContent);
    // Support pane
    const supportPane = el("div", "supportPane configPaneCard");
    const supportTitle = el("div", "sectionTitle", t("config.support.title" as TranslationKey));
    const supportText = el("div", "muted", t("config.support.text" as TranslationKey));
    const supportActions = el("div", "supportActions");
    const supportBtn = document.createElement("a");
    supportBtn.className = "btn primary supportBtn";
    supportBtn.href = DONATION_URL;
    supportBtn.target = "_blank";
    supportBtn.rel = "noreferrer";
    supportBtn.textContent = t("config.support.button" as TranslationKey);
    const supportThanks = el("div", "muted", t("config.support.thanks" as TranslationKey));
    supportActions.append(supportBtn, supportThanks);
    supportPane.append(supportTitle, supportText, supportActions);
    // All panes go into the content area (right side)
    content.append(displayPane, layoutPane, behaviorPane, themePane, tabColorPane, fontPane, hotkeysPane, controllerPane, pluginsPane, patchnotesPane, docsPane, supportPane);

    const refreshClientSettings = async () => {

        const revisionAtRequest = hotkeyRevision;
        const settings = await loadClientSettings();
        fullscreenCheckbox.checked = settings.startFullscreen;
        delayInput.value = String(settings.layoutDelaySeconds ?? DEFAULT_CLIENT_SETTINGS.layoutDelaySeconds);
        toastInput.value = String(settings.toastDurationSeconds ?? DEFAULT_CLIENT_SETTINGS.toastDurationSeconds);
        launcherWidthInput.value = String(settings.launcherWidth ?? DEFAULT_CLIENT_SETTINGS.launcherWidth);
        launcherHeightInput.value = String(settings.launcherHeight ?? DEFAULT_CLIENT_SETTINGS.launcherHeight);
        setSliderBadge(delayInput, delayValue, (v) => `${v}s`);
        setSliderBadge(toastInput, toastValue, (v) => `${v}s`);
        setSliderBadge(launcherWidthInput, launcherWidthValue, (v) => `${v}px`);
        setSliderBadge(launcherHeightInput, launcherHeightValue, (v) => `${v}px`);
        setToastDurationSeconds(settings.toastDurationSeconds ?? DEFAULT_CLIENT_SETTINGS.toastDurationSeconds);
        seqToggle.set(settings.seqGridLoad ?? DEFAULT_CLIENT_SETTINGS.seqGridLoad);
        setSequentialGridLoad(settings.seqGridLoad ?? DEFAULT_CLIENT_SETTINGS.seqGridLoad);
        tabDisplaySelect.value = settings.tabLayoutDisplay ?? DEFAULT_CLIENT_SETTINGS.tabLayoutDisplay;
        setLayoutTabDisplay(settings.tabLayoutDisplay ?? DEFAULT_CLIENT_SETTINGS.tabLayoutDisplay);
        updateLayoutOptionActive();
        gridBorderToggle.set(settings.gridActiveBorder ?? DEFAULT_CLIENT_SETTINGS.gridActiveBorder);
        autoSaveToggle.set(settings.autoSaveLayouts ?? DEFAULT_CLIENT_SETTINGS.autoSaveLayouts);
        setAutoSaveLayouts(settings.autoSaveLayouts ?? DEFAULT_CLIENT_SETTINGS.autoSaveLayouts);
        annToggle.set(settings.showAnnouncements ?? DEFAULT_CLIENT_SETTINGS.showAnnouncements);
        collapsibleToggle.set(settings.collapsibleOpenProfiles ?? DEFAULT_CLIENT_SETTINGS.collapsibleOpenProfiles);
        telemetryToggle.set(settings.sendTelemetry ?? DEFAULT_CLIENT_SETTINGS.sendTelemetry);
        ramToggle.set(settings.showRamUsage ?? DEFAULT_CLIENT_SETTINGS.showRamUsage);
        updateToggle.set(settings.checkForUpdatesOnStart ?? DEFAULT_CLIENT_SETTINGS.checkForUpdatesOnStart);
        syncFontSelectFromValue(settings.gameFont ?? null);
        const savedFontSize = settings.launcherFontSize ?? LAUNCHER_FONT_SIZE_DEFAULT;
        fontSizeInput.value = String(clampFontSize(savedFontSize));
        fontSizeValue.textContent = `${clampFontSize(savedFontSize)}%`;
        if (revisionAtRequest === hotkeyRevision) {
            applyHotkeyState(settings);
        }
    };
    refreshClientSettings().catch((): void => undefined);
    fullscreenCheckbox.addEventListener("change", async () => {
        const next = fullscreenCheckbox.checked;
        try {
            await patchClientSettings({ startFullscreen: next });
            showToast(t("config.client.fullscreenSaved"), "success");
        }
        catch (err) {
            showToast(String(err), "error");
            const current = await loadClientSettings();
            fullscreenCheckbox.checked = current.startFullscreen;
        }
    });
    tabDisplaySelect.addEventListener("change", async () => {
        const next = normalizeTabLayoutDisplay(tabDisplaySelect.value);
        try {
            await patchClientSettings({ tabLayoutDisplay: next });
            setLayoutTabDisplay(next);
            showToast(t("config.client.tabLayoutDisplay.saved" as TranslationKey), "success");
        }
        catch (err) {
            showToast(String(err), "error");
            const current = await loadClientSettings();
            const fallback = normalizeTabLayoutDisplay(current?.tabLayoutDisplay);
            tabDisplaySelect.value = fallback;
            setLayoutTabDisplay(fallback);
        }
    });
    delayInput.addEventListener("change", async () => {
        const next = clampLayoutDelaySeconds(delayInput.valueAsNumber);
        delayInput.value = String(next);
        setSliderBadge(delayInput, delayValue, (v) => `${v}s`);
        try {
            await patchClientSettings({ layoutDelaySeconds: next });
            setLayoutDelaySeconds(next);
            showToast(t("config.client.layoutDelaySaved"), "success");
        }
        catch (err) {
            showToast(String(err), "error");
            const current = await loadClientSettings();
            const fallback = clampLayoutDelaySeconds(current?.layoutDelaySeconds);
            delayInput.value = String(fallback);
            setSliderBadge(delayInput, delayValue, (v) => `${v}s`);
            setLayoutDelaySeconds(fallback);
        }
    });
    toastInput.addEventListener("change", async () => {
        const next = clampToastDurationSeconds(toastInput.valueAsNumber);
        toastInput.value = String(next);
        setSliderBadge(toastInput, toastValue, (v) => `${v}s`);
        try {
            await patchClientSettings({ toastDurationSeconds: next });
            setToastDurationSeconds(next);
            showToast(t("config.client.toastDurationSaved"), "success");
        }
        catch (err) {
            showToast(String(err), "error");
            const current = await loadClientSettings();
            const fallback = clampToastDurationSeconds(current?.toastDurationSeconds);
            toastInput.value = String(fallback);
            setSliderBadge(toastInput, toastValue, (v) => `${v}s`);
            setToastDurationSeconds(fallback);
        }
    });
    seqCheckbox.addEventListener("change", async () => {
        const next = !!seqCheckbox.checked;
        try {
            await patchClientSettings({ seqGridLoad: next });
            setSequentialGridLoad(next);
            showToast(t("config.client.seqGridLoadSaved"), "success");
        }
        catch (err) {
            showToast(String(err), "error");
            const current = await loadClientSettings();
            seqToggle.set(current?.seqGridLoad ?? DEFAULT_CLIENT_SETTINGS.seqGridLoad);
            setSequentialGridLoad(current?.seqGridLoad ?? DEFAULT_CLIENT_SETTINGS.seqGridLoad);
        }
    });
    gridBorderCheckbox.addEventListener("change", async () => {
        const next = !!gridBorderCheckbox.checked;
        try {
            await patchClientSettings({ gridActiveBorder: next });
            showToast(t("config.client.gridActiveBorderSaved" as TranslationKey), "success");
        }
        catch (err) {
            showToast(String(err), "error");
            const current = await loadClientSettings();
            gridBorderToggle.set(current?.gridActiveBorder ?? DEFAULT_CLIENT_SETTINGS.gridActiveBorder);
        }
    });
    autoSaveCheckbox.addEventListener("change", async () => {
        const next = !!autoSaveCheckbox.checked;
        try {
            await patchClientSettings({ autoSaveLayouts: next });
            setAutoSaveLayouts(next);
            showToast(t("config.client.layoutAutoSaveSaved" as TranslationKey), "success");
        }
        catch (err) {
            showToast(String(err), "error");
            const current = await loadClientSettings();
            const fallback = current?.autoSaveLayouts ?? DEFAULT_CLIENT_SETTINGS.autoSaveLayouts;
            autoSaveToggle.set(fallback);
            setAutoSaveLayouts(fallback);
        }
    });
    annCheckbox.addEventListener("change", async () => {
        const next = !!annCheckbox.checked;
        try {
            await patchClientSettings({ showAnnouncements: next });
            showToast(t("config.client.showAnnouncementsSaved" as TranslationKey), "success");
            window.dispatchEvent(new CustomEvent("launcherSettingChanged", { detail: { key: "showAnnouncements", value: next } }));
        }
        catch (err) {
            showToast(String(err), "error");
            const current = await loadClientSettings();
            annToggle.set(current?.showAnnouncements ?? DEFAULT_CLIENT_SETTINGS.showAnnouncements);
        }
    });
    collapsibleCheckbox.addEventListener("change", async () => {
        const next = !!collapsibleCheckbox.checked;
        try {
            await patchClientSettings({ collapsibleOpenProfiles: next });
            showToast(t("config.client.collapsibleOpenProfilesSaved" as TranslationKey), "success");
            window.dispatchEvent(new CustomEvent("launcherSettingChanged", { detail: { key: "collapsibleOpenProfiles", value: next } }));
        }
        catch (err) {
            showToast(String(err), "error");
            const current = await loadClientSettings();
            collapsibleToggle.set(current?.collapsibleOpenProfiles ?? DEFAULT_CLIENT_SETTINGS.collapsibleOpenProfiles);
        }
    });
    telemetryCheckbox.addEventListener("change", async () => {
        const next = !!telemetryCheckbox.checked;
        try {
            await patchClientSettings({ sendTelemetry: next });
            showToast(t("config.client.sendTelemetrySaved" as TranslationKey), "success");
        }
        catch (err) {
            showToast(String(err), "error");
            const current = await loadClientSettings();
            telemetryToggle.set(current?.sendTelemetry ?? DEFAULT_CLIENT_SETTINGS.sendTelemetry);
        }
    });
    updateCheckbox.addEventListener("change", async () => {
        const next = !!updateCheckbox.checked;
        try {
            await patchClientSettings({ checkForUpdatesOnStart: next });
            showToast(t("config.client.checkForUpdatesOnStartSaved" as TranslationKey), "success");
        }
        catch (err) {
            showToast(String(err), "error");
            const current = await loadClientSettings();
            updateToggle.set(current?.checkForUpdatesOnStart ?? DEFAULT_CLIENT_SETTINGS.checkForUpdatesOnStart);
        }
    });
    ramCheckbox.addEventListener("change", async () => {
        const next = !!ramCheckbox.checked;
        try {
            await patchClientSettings({ showRamUsage: next });
            showToast(t("config.client.showRamUsageSaved" as TranslationKey), "success");
        }
        catch (err) {
            showToast(String(err), "error");
            const current = await loadClientSettings();
            ramToggle.set(current?.showRamUsage ?? DEFAULT_CLIENT_SETTINGS.showRamUsage);
        }
    });
    launcherWidthInput.addEventListener("change", async () => {
        const next = clampLauncherWidthPx(launcherWidthInput.valueAsNumber);
        launcherWidthInput.value = String(next);
        setSliderBadge(launcherWidthInput, launcherWidthValue, (v) => `${v}px`);
        try {
            await patchClientSettings({ launcherWidth: next });
            showToast(t("config.client.launcherSizeSaved" as TranslationKey), "success");
        }
        catch (err) {
            showToast(String(err), "error");
            const current = await loadClientSettings();
            launcherWidthInput.value = String(current?.launcherWidth ?? DEFAULT_CLIENT_SETTINGS.launcherWidth);
            setSliderBadge(launcherWidthInput, launcherWidthValue, (v) => `${v}px`);
        }
    });
    launcherHeightInput.addEventListener("change", async () => {
        const next = clampLauncherHeightPx(launcherHeightInput.valueAsNumber);
        launcherHeightInput.value = String(next);
        setSliderBadge(launcherHeightInput, launcherHeightValue, (v) => `${v}px`);
        try {
            await patchClientSettings({ launcherHeight: next });
            showToast(t("config.client.launcherSizeSaved" as TranslationKey), "success");
        }
        catch (err) {
            showToast(String(err), "error");
            const current = await loadClientSettings();
            launcherHeightInput.value = String(current?.launcherHeight ?? DEFAULT_CLIENT_SETTINGS.launcherHeight);
            setSliderBadge(launcherHeightInput, launcherHeightValue, (v) => `${v}px`);
        }
    });
    body.append(globalSidebar, content);
    // Simple markdown to HTML converter (no images/videos) used by patchnotes

    function markdownToHtmlBasic(md: string): string {

        return md
            // Escape HTML first
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            // Headers
            .replace(/^### (.+)$/gm, "<h3>$1</h3>")
            .replace(/^## (.+)$/gm, "<h2>$1</h2>")
            .replace(/^# (.+)$/gm, "<h1>$1</h1>")
            // Bold
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            // Italic
            .replace(/\*(.+?)\*/g, "<em>$1</em>")
            // Inline code
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            // Horizontal rule
            .replace(/^---$/gm, "<hr>")
            // List items
            .replace(/^- (.+)$/gm, "<li>$1</li>")
            // Wrap consecutive list items in ul
            .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
            // Paragraphs (lines that are not already wrapped)
            .replace(/^(?!<\/?[h1-6ul]|<li|<hr)(.+)$/gm, "<p>$1</p>")
            // Clean up empty paragraphs
            .replace(/<p><\/p>/g, "")
            // Clean up newlines
            .replace(/\n/g, "");
    }

    function markdownToHtml(md: string): string {

        // Normalize CRLF to LF so accordion close markers match on Windows
        md = md.replace(/\r\n/g, "\n");

        // Parse accordions (supports nesting via recursive call)
        const accordionRegex = /(^|\n)(:{3,})accordion\[([^\]]+)\]/g;
        let processed = "";
        let lastPos = 0;
        let match: RegExpExecArray | null;
        while ((match = accordionRegex.exec(md))) {
            const start = match.index + match[1].length;
            const colons = match[2];
            const title = match[3];
            const headerEnd = accordionRegex.lastIndex;
            const closeMarker = `\n${colons}\n`;
            const closeIdx = md.indexOf(closeMarker, headerEnd);
            if (closeIdx === -1) continue;
            const content = md.slice(headerEnd, closeIdx);
            processed += markdownToHtmlBasic(md.slice(lastPos, start));
            const body = markdownToHtml(content.trim());
            processed += `<details class="docAccordion"><summary class="docAccordionHeader"><span class="docAccordionTitle">${escapeHtml(title)}</span><span class="docAccordionIcon">&#9654;</span></summary><div class="docAccordionContent">${body}</div></details>`;
            lastPos = closeIdx + closeMarker.length;
            accordionRegex.lastIndex = lastPos;
        }
        processed += markdownToHtmlBasic(md.slice(lastPos));
        return processed;
    }
    // Extended markdown to HTML converter for documentation with accordions, images, videos

    function markdownToHtmlExtended(md: string, assetsPath: string): string {

        // Normalize CRLF to LF so accordion close markers and other patterns match on Windows
        md = md.replace(/\r\n/g, "\n");

        // Parse accordions (supports nesting via recursive call)
        const accordionRegex = /(^|\n)(:{3,})accordion\[([^\]]+)\]/g;
        let processed = "";
        let lastPos = 0;
        let hadAccordion = false;
        let match: RegExpExecArray | null;
        while ((match = accordionRegex.exec(md))) {
            const start = match.index + match[1].length; // exclude leading newline (if any)
            const colons = match[2];
            const title = match[3];
            const headerEnd = accordionRegex.lastIndex;
            const closeMarker = `\n${colons}\n`;
            const closeIdx = md.indexOf(closeMarker, headerEnd);
            if (closeIdx === -1) {
                continue; // unmatched - skip
            }
            const content = md.slice(headerEnd, closeIdx);
            // Process content before the accordion so plain text still gets paragraph wrapping
            processed += processDocContent(md.slice(lastPos, start), assetsPath);
            const body = markdownToHtmlExtended(content.trim(), assetsPath);
            processed += `<details class="docAccordion"><summary class="docAccordionHeader"><span class="docAccordionTitle">${escapeHtml(title)}</span><span class="docAccordionIcon">&#9654;</span></summary><div class="docAccordionContent">${body}</div></details>`;
            lastPos = closeIdx + closeMarker.length;
            accordionRegex.lastIndex = lastPos;
            hadAccordion = true;
        }
        // Process trailing content after the last accordion as well
        processed += processDocContent(md.slice(lastPos), assetsPath);
        // Process info boxes
        const beforeInfo = processed;
        processed = processed.replace(
            /:::info\n([\s\S]*?):::/g,
            (_match, content) => `<div class="docInfoBox">${processDocContent(content.trim(), assetsPath)}</div>`
        );
        // Process warning boxes
        const beforeWarn = processed;
        processed = processed.replace(
            /:::warning\n([\s\S]*?):::/g,
            (_match, content) => `<div class="docWarningBox">${processDocContent(content.trim(), assetsPath)}</div>`
        );
        // processed is already normalized via processDocContent above.
        // Returning it directly avoids double-processing (which escaped HTML tags inside accordions).
        return processed;
    }

    function escapeHtml(str: string): string {

        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function processDocContent(md: string, assetsPath: string): string {

        let html = md
            // Escape HTML first
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        // YouTube embeds ::youtube[VIDEO_ID]
        html = html.replace(
            /::youtube\[([^\]]+)\]/g,
            (_match, videoId) => `<div class="docYoutube"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
        );
        // Helper to convert Windows paths to file:// URLs
        const toFileUrl = (filePath: string) => {
            // Convert backslashes to forward slashes and ensure proper file:// format
            const normalized = filePath.replace(/\\/g, "/");
            // Windows paths need file:/// (three slashes)
            return `file:///${normalized.replace(/^\/+/, "")}`;
        };
        // Local video embeds ::video[path.mp4]
        html = html.replace(
            /::video\[([^\]]+)\]/g,
            (_match, videoPath) => {
                const fullPath = videoPath.startsWith("http") ? videoPath : toFileUrl(`${assetsPath}/videos/${videoPath}`);
                return `<div class="docVideo"><video controls><source src="${fullPath}" type="video/mp4">Your browser does not support the video tag.</video></div>`;
            }
        );
        // Images ![alt](src) - supports data: URLs (base64), http(s) URLs, and local files
        html = html.replace(
            /!\[([^\]]*)\]\(([^)]+)\)/g,
            (_match, alt, src) => {
                // data: URLs and http(s) URLs are used directly
                const fullSrc = (src.startsWith("data:") || src.startsWith("http"))
                    ? src
                    : toFileUrl(`${assetsPath}/screenshots/${src}`);
                const cls = alt.toLowerCase() === "small" ? "docImageSmall" : "docImage";
                return `<img class="${cls}" src="${fullSrc}" alt="${escapeHtml(alt)}" loading="lazy">`;
            }
        );
        // Links [text](url)
        html = html.replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            (_match, text, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`
        );
        // Tables (simple markdown tables)
        // Mark separator rows, then convert all table rows
        html = html.replace(/^\|(.+)\|$/gm, (match) => {
            const cells = match.slice(1, -1).split("|").map(c => c.trim());
            const isHeader = cells.every(c => /^-+$/.test(c));
            if (isHeader) return "<!--tbl-sep-->";
            const cellsHtml = cells.map(c => `<td>${c}</td>`).join("");
            return `<tr>${cellsHtml}</tr>`;
        });
        // Wrap consecutive table rows (including separator comments) into a table
        html = html.replace(/((<tr>.*<\/tr>|<!--tbl-sep-->)\n?)+/g, (match) => {
            // Remove separator comments
            const clean = match.replace(/<!--tbl-sep-->\n?/g, "");
            // Promote first row cells to <th>
            const promoted = clean.replace(/^<tr>(.*?)<\/tr>/, (_m, inner) =>
                `<tr>${inner.replace(/<td>/g, "<th>").replace(/<\/td>/g, "</th>")}</tr>`
            );
            return `<table class="docTable">${promoted}</table>`;
        });
        // Headers
        html = html
            .replace(/^### (.+)$/gm, "<h3>$1</h3>")
            .replace(/^## (.+)$/gm, "<h2>$1</h2>")
            .replace(/^# (.+)$/gm, "<h1>$1</h1>");
        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        // Italic
        html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
        // Inline code
        html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
        // Horizontal rule
        html = html.replace(/^---$/gm, "<hr>");
        // List items
        html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
        // Numbered list items
        html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
        // Wrap consecutive list items in ul
        html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
        // Paragraphs (lines that are not already wrapped)
        html = html.replace(/^(?!<\/?[h1-6ulotda]|<li|<hr|<img|<div|<table|<tr)(.+)$/gm, "<p>$1</p>");
        // Clean up empty paragraphs
        html = html.replace(/<p><\/p>/g, "");
        // Clean up newlines
        html = html.replace(/\n/g, "");
        return html;
    }
    // Load patchnotes content

    async function loadPatchnotes() {

        patchnotesContent.innerHTML = "<div class='muted'>Loading...</div>";
        try {
            const md = await window.api.patchnotesGet(currentLocale);
            patchnotesContent.innerHTML = markdownToHtml(md);
        } catch (err) {
            patchnotesContent.innerHTML = `<div class='muted'>Error loading patchnotes: ${String(err)}</div>`;
        }
    }
    // Load documentation content

    async function loadDocumentation() {

        docsContent.innerHTML = "<div class='muted'>Loading...</div>";
        try {
            const { content, assetsPath } = await window.api.documentationGet(currentLocale);
            docsContent.innerHTML = markdownToHtmlExtended(content, assetsPath);
        } catch (err) {
            docsContent.innerHTML = `<div class='muted'>Error loading documentation: ${String(err)}</div>`;
        }
    }
    // Main tab switching

    // Map sidebar IDs to panes
    const paneMap: Record<SidebarId, HTMLElement> = {
        "client.display": displayPane,
        "client.layout": layoutPane,
        "client.behavior": behaviorPane,
        "client.theme": themePane,
        "client.tabcolor": tabColorPane,
        "client.font": fontPane,
        "client.hotkeys": hotkeysPane,
        "controller": controllerPane,
        "plugins": pluginsPane,
        "patchnotes": patchnotesPane,
        "docs": docsPane,
        "support": supportPane,
    };

    function selectSidebarItem(id: SidebarId) {

        for (const [btnId, btn] of allSidebarBtns) {
            btn.classList.toggle("active", btnId === id);
        }
        // Show only the selected pane, hide all others
        for (const [paneId, pane] of Object.entries(paneMap)) {
            pane.style.display = paneId === id ? "" : "none";
        }

        if (id === "client.theme") {
            renderStyleContent("theme");
        } else if (id === "client.tabcolor") {
            renderStyleContent("tabcolor");
        }
        if (id === "plugins") {
            loadPluginsList();
        }
        if (id === "patchnotes") {
            loadPatchnotes();
        }
        if (id === "docs") {
            loadDocumentation();
        }
        if (id === "controller") {
            renderControllerTab().catch((e) => logErr(e, "ControllerTab"));
        }
        else if (controllerLiveCleanup) {
            // Tab verlassen → Live-Loop stoppen, sonst pollt das RAF weiter.
            controllerLiveCleanup();
            controllerLiveCleanup = null;
        }
    }
    for (const [id, btn] of allSidebarBtns) {
        btn.addEventListener("click", () => selectSidebarItem(id));
    }
    // ====================================================================
    // Controller-Tab: Per-Profil-Mapping-Editor (kompakt, Sektionen, Grid)
    // ====================================================================
    type ControllerButtonName =
        | "a" | "b" | "x" | "y"
        | "l1" | "r1" | "l2" | "r2"
        | "select" | "start" | "l3" | "r3"
        | "dpadUp" | "dpadDown" | "dpadLeft" | "dpadRight";

    type ControllerButtonOverride = Partial<Record<ControllerButtonName, string | null>>;

    interface ControllerButtonInfo {
        key: ControllerButtonName;
        symbol: string;
        name: string;
        defaultAction: string | null;
    }

    // Kurze Single-Token-Namen — die Card im Spatial-Layout ist eng. Lange
    // Namen wie "Stick links (Klick)" zerbrechen das Layout. Symbol + Group-
    // Titel ("D-PAD"/"FACE-BUTTONS") liefern den Kontext.
    const CONTROLLER_BUTTONS: Record<ControllerButtonName, ControllerButtonInfo> = {
        a:         { key: "a",         symbol: "✕",  name: "Cross",    defaultAction: "Space" },
        b:         { key: "b",         symbol: "◯",  name: "Circle",   defaultAction: "Escape" },
        x:         { key: "x",         symbol: "☐",  name: "Square",   defaultAction: "Z" },
        y:         { key: "y",         symbol: "△",  name: "Triangle", defaultAction: "Tab" },
        l1:        { key: "l1",        symbol: "L1", name: "L1",       defaultAction: "1" },
        r1:        { key: "r1",        symbol: "R1", name: "R1",       defaultAction: "2" },
        l2:        { key: "l2",        symbol: "L2", name: "L2",       defaultAction: "@cursorHold" },
        r2:        { key: "r2",        symbol: "R2", name: "R2",       defaultAction: "3" },
        select:    { key: "select",    symbol: "⊟",  name: "Share",    defaultAction: null },
        start:     { key: "start",     symbol: "≡",  name: "Options",  defaultAction: "Return" },
        l3:        { key: "l3",        symbol: "L3", name: "L3",       defaultAction: "I" },
        r3:        { key: "r3",        symbol: "R3", name: "R3",       defaultAction: "C" },
        dpadUp:    { key: "dpadUp",    symbol: "↑",  name: "Up",       defaultAction: "@zoomIn" },
        dpadDown:  { key: "dpadDown",  symbol: "↓",  name: "Down",     defaultAction: "@zoomOut" },
        dpadLeft:  { key: "dpadLeft",  symbol: "←",  name: "Left",     defaultAction: "@prevTab" },
        dpadRight: { key: "dpadRight", symbol: "→",  name: "Right",    defaultAction: "@nextTab" },
    };

    // Special-Actions die per Popover-Menu gewaehlt werden koennen. Alle starten
    // mit `@` und werden vom Router speziell behandelt (statt Keyboard-Event):
    //  - @actionPad        — kalibrierter Klick im Spielfenster (in-game HUD)
    //  - @cursorHold       — solange gehalten: rechter Stick → Maus, A → Klick
    //  - @cursorToggle     — Tippen schaltet Cursor-Modus um (statt Halten)
    //  - @zoomIn/@zoomOut  — synthetisches mouseWheel (Bildschirm-Mitte)
    //  - @nextTab/@prevTab — Tab-Wechsel im Session-Window
    //  - @reloadView       — aktuelles Game-View neu laden
    //  - @toggleFullscreen — Launcher-Window Vollbild togglen
    //  - @openConfig       — Settings-Modal oeffnen
    const SPECIAL_ACTIONS: ReadonlyArray<{ key: string; labelKey: string }> = [
        { key: "@actionPad",        labelKey: "controller.action.actionPad" },
        { key: "@cursorHold",       labelKey: "controller.action.cursorHold" },
        { key: "@cursorToggle",     labelKey: "controller.action.cursorToggle" },
        { key: "@forwardHold",      labelKey: "controller.action.forwardHold" },
        { key: "@zoomIn",           labelKey: "controller.action.zoomIn" },
        { key: "@zoomOut",          labelKey: "controller.action.zoomOut" },
        { key: "@nextTab",          labelKey: "controller.action.nextTab" },
        { key: "@prevTab",          labelKey: "controller.action.prevTab" },
        { key: "@reloadView",       labelKey: "controller.action.reloadView" },
        { key: "@toggleFullscreen", labelKey: "controller.action.toggleFullscreen" },
        { key: "@openConfig",       labelKey: "controller.action.openConfig" },
    ];

    const showSpecialActionMenu = (anchor: HTMLElement, onPick: (action: string) => void) => {
        // Vorheriges Menue raeumen.
        document.querySelectorAll(".ctrlActionMenu").forEach((m) => m.remove());
        const menu = el("div", "ctrlActionMenu");
        for (const sa of SPECIAL_ACTIONS) {
            const item = el("div", "ctrlActionMenuItem", t(sa.labelKey as TranslationKey));
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                onPick(sa.key);
                menu.remove();
            });
            menu.append(item);
        }
        // Inline-Styles SETZEN BEVOR appendChild — damit kein initiales
        // Render-Frame mit fehlendem position/zIndex ablaeuft.
        const rect = anchor.getBoundingClientRect();
        const menuWidth = 200;
        const menuMaxHeight = 360;
        menu.style.position = "fixed";
        const top = rect.bottom + 4;
        const wouldOverflowBottom = top + menuMaxHeight > window.innerHeight;
        menu.style.top = `${wouldOverflowBottom ? Math.max(8, rect.top - 4 - menuMaxHeight) : top}px`;
        menu.style.left = `${Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.left))}px`;
        // Z-Index ueber dem Modal-Overlay (das hat kein explizites z-index,
        // aber durch backdrop-filter / position:fixed Stacking-Context kann's
        // eigenes Layer sein). 2147483647 = max-safe int, kann nichts mehr
        // ueberlagern.
        menu.style.zIndex = "2147483647";
        menu.style.maxHeight = `${menuMaxHeight}px`;
        menu.style.overflowY = "auto";
        menu.style.pointerEvents = "auto";
        // Append zu body — gleicher Container wie das Overlay, hoeherer z-index
        // sollte greifen. Falls trotzdem nicht sichtbar (transformed parent,
        // etc.), wuerde der console.log es zeigen.
        document.body.appendChild(menu);
        // Diagnose: falls das Menu trotz allem nicht erscheint, kann der User
        // im DevTools-Console sehen WAS positioniert wurde. Wird mit Production-
        // Build mitgeshippt — kostenlos, kein Risiko.
        try {
            // eslint-disable-next-line no-console
            console.debug(
                "[ctrl] showSpecialActionMenu anchor=",
                anchor.getBoundingClientRect(),
                "menu=",
                menu.getBoundingClientRect(),
                "items=",
                SPECIAL_ACTIONS.length,
            );
        } catch { /* ignore */ }
        // Outside-Click schliesst. `click` statt `mousedown` weil mousedown
        // mit useCapture im DOM mit komplexen Modal-Layouts manchmal das
        // Target-Event verschluckt. Click ist nach mouseup → konsistenter.
        const onDocClick = (e: MouseEvent) => {
            const target = e.target as Node | null;
            if (target && (menu.contains(target) || target === anchor || anchor.contains(target))) {
                return; // klick auf menu oder anchor — nicht schliessen
            }
            menu.remove();
            document.removeEventListener("click", onDocClick, true);
        };
        // Setup auf NEXT tick, damit der initiale Klick der das Menu geoeffnet
        // hat nicht sofort wieder schliesst.
        setTimeout(() => document.addEventListener("click", onDocClick, true), 0);
    };

    /** UI-freundliche Repraesentation eines Action-Werts. */
    function controllerActionLabel(action: string | null | undefined): string {
        if (action === null) return t("controller.binding.unbound" as TranslationKey);
        if (!action) return "";
        if (action.startsWith("@")) {
            const sa = SPECIAL_ACTIONS.find((x) => x.key === action);
            if (sa) return t(sa.labelKey as TranslationKey);
            return action;
        }
        if (action === "Space") return "Leertaste";
        if (action === "Return" || action === "Enter") return "Enter";
        if (action === "Escape") return "Escape";
        if (action === "Tab") return "Tab";
        return action;
    }

    let currentControllerProfileId: string | null = null;
    let currentControllerOverride: ControllerButtonOverride = {};

    // Modifier-Layer: pro Schulter (l1/r1/l2/r2) ein Layer mit enabled-Flag +
    // Override-Mapping fuer die Face-Buttons (a/b/x/y). UX: User toggelt pro
    // Schulter on/off; bei "on" werden die 4 Face-Bindings angezeigt. Bindings
    // bleiben auch bei toggle-off erhalten, damit man nicht neu zuweisen muss.
    type ModifierSlotName = "l1" | "r1" | "l2" | "r2";
    type ModifierLayerState = { enabled?: boolean; buttons?: ControllerButtonOverride };
    let currentControllerModifiers: Partial<Record<ModifierSlotName, ModifierLayerState>> = {};

    /** Cleanup-Hook fuer den Live-Gamepad-Polling-Loop des Controller-Diagramms.
     *  Wird beim Tab-Wechsel oder Modal-Close aufgerufen, damit kein RAF-Leak. */
    let controllerLiveCleanup: (() => void) | null = null;

    /** "auto" bedeutet: erkannten Controller-Typ aus gamepad.id ableiten.
     *  "ps"/"xbox" sind manuelle Overrides — bleiben ueber Connect/Disconnect
     *  hinweg gesetzt, bis der User wieder umstellt. */
    type ControllerStyle = "auto" | "ps" | "xbox";
    /** Effektives Layout: "ps" oder "xbox". "generic" gibt es bewusst nicht —
     *  wenn nichts erkennbar ist, faellt der Default auf "ps" zurueck (am
     *  weitesten verbreitete Symbol-Belegung). */
    type ControllerVisualStyle = "ps" | "xbox";

    interface ControllerSvgRefs {
        wrap: HTMLDivElement;
        statusEl: HTMLElement;
        styleSelectEl: HTMLSelectElement;
        svgHost: HTMLDivElement;
        /** Vom aktuellen Layout abhaengig — wird beim Style-Swap neu befuellt. */
        buttonShapes: Map<ControllerButtonName, SVGElement>;
        stickDots: { l: SVGCircleElement; r: SVGCircleElement };
        /** Achsen-Basis-Koordinaten, layout-abhaengig. */
        stickBases: { l: { cx: number; cy: number }; r: { cx: number; cy: number } };
        /** Aktuell gerendertes Layout (ps oder xbox). */
        effectiveStyle: ControllerVisualStyle;
    }

    /** Erkennt den Controller-Typ aus dem Web-Gamepad-API-`id`-String.
     *  Sony-DualSense/DualShock und PlayStation-Branding -> ps.
     *  Microsoft-Xbox/XInput-Strings und Vendor 045e -> xbox.
     *  Default ist ps (PS-Symbole sind die mit Abstand verbreitetsten Defaults
     *  in MMORPG-Tutorials, und unsere Standard-Belegung ist daran orientiert). */
    function detectControllerStyle(id: string | null | undefined): ControllerVisualStyle {
        if (!id) return "ps";
        const lower = id.toLowerCase();
        if (lower.includes("xbox") || lower.includes("xinput") || lower.includes("microsoft") || lower.includes("045e")) {
            return "xbox";
        }
        if (lower.includes("dualsense") || lower.includes("dualshock") || lower.includes("playstation")
            || lower.includes("sony") || lower.includes("054c")) {
            return "ps";
        }
        return "ps";
    }

    const STICK_DEAD = 0.12;
    const STICK_DOT_RANGE = 18;

    /** Baut die SVG-Controller-Abbildung. ASCII-Kommentar zeigt die Layout-Bereiche:
     *
     *  ╭──L2──╮          ╭──R2──╮       y(0..70)   Trigger
     *  ╭──L1──╮          ╭──R1──╮       y(56..76)  Shoulder
     *  ╭───────────────────────────╮
     *  │  ▲              △        │
     *  │ ◀▶  Sel  Start □ ○      │    y(75..320)  Body
     *  │  ▼  ▭ Touchpad   ✕      │
     *  │      L3       R3         │
     *  ╰───────────────────────────╯
     */
    /** PS-Layout (DualSense): Body mit M-fluegel-Silhouette + Bottom-Pinch,
     *  Center-Band hinter Touchpad+Light-Bar, Stick-Wells konzentrisch fuer Tiefe.
     *  Stick-Basis: L3=(240,272), R3=(360,272). */
    function buildSvgPs(): string {
        return `
            <svg viewBox="0 0 600 360" class="ctrlSvg ctrlSvgStylePs" role="img" aria-label="DualSense controller">
                <rect data-button="l2" class="ctrlSvgBtn ctrlSvgTrigger" x="92" y="14" width="86" height="46" rx="16"/>
                <text class="ctrlSvgLbl ctrlSvgLblTrigger" x="135" y="42">L2</text>
                <rect data-button="r2" class="ctrlSvgBtn ctrlSvgTrigger" x="422" y="14" width="86" height="46" rx="16"/>
                <text class="ctrlSvgLbl ctrlSvgLblTrigger" x="465" y="42">R2</text>

                <rect data-button="l1" class="ctrlSvgBtn ctrlSvgShoulder" x="95" y="58" width="100" height="22" rx="11"/>
                <text class="ctrlSvgLbl ctrlSvgLblShoulder" x="145" y="71">L1</text>
                <rect data-button="r1" class="ctrlSvgBtn ctrlSvgShoulder" x="405" y="58" width="100" height="22" rx="11"/>
                <text class="ctrlSvgLbl ctrlSvgLblShoulder" x="455" y="71">R1</text>

                <path class="ctrlSvgBody" d="M 124 80 L 476 80 C 520 82 552 110 556 158 C 560 198 552 236 535 270 C 518 297 495 316 470 327 C 442 340 410 342 384 335 C 363 329 348 320 335 312 C 322 305 312 300 302 300 L 298 300 C 288 300 278 305 265 312 C 252 320 237 329 216 335 C 190 342 158 340 130 327 C 105 316 82 297 65 270 C 48 236 40 198 44 158 C 48 110 80 82 124 80 Z"/>

                <rect class="ctrlSvgTouchpad" x="245" y="148" width="110" height="44" rx="6"/>
                <rect class="ctrlSvgLightBar" x="241" y="144" width="118" height="52" rx="9"/>
                <line class="ctrlSvgTouchpadDivider" x1="300" y1="150" x2="300" y2="190"/>
                <rect data-button="select" class="ctrlSvgBtn ctrlSvgPill" x="225" y="167" width="16" height="9" rx="4.5"/>
                <rect data-button="start"  class="ctrlSvgBtn ctrlSvgPill" x="359" y="167" width="16" height="9" rx="4.5"/>

                <rect class="ctrlSvgDpadCenter" x="161" y="171" width="18" height="18"/>
                <rect data-button="dpadUp"    class="ctrlSvgBtn ctrlSvgDpad" x="161" y="146" width="18" height="25" rx="3"/>
                <path class="ctrlSvgDpadArrow" d="M 165 162 L 170 154 L 175 162 Z"/>
                <rect data-button="dpadDown"  class="ctrlSvgBtn ctrlSvgDpad" x="161" y="189" width="18" height="25" rx="3"/>
                <path class="ctrlSvgDpadArrow" d="M 165 198 L 170 206 L 175 198 Z"/>
                <rect data-button="dpadLeft"  class="ctrlSvgBtn ctrlSvgDpad" x="136" y="171" width="25" height="18" rx="3"/>
                <path class="ctrlSvgDpadArrow" d="M 152 176 L 144 180 L 152 184 Z"/>
                <rect data-button="dpadRight" class="ctrlSvgBtn ctrlSvgDpad" x="179" y="171" width="25" height="18" rx="3"/>
                <path class="ctrlSvgDpadArrow" d="M 188 176 L 196 180 L 188 184 Z"/>

                <circle data-button="y" class="ctrlSvgBtn ctrlSvgFace ctrlSvgFaceY" cx="430" cy="150" r="14"/>
                <text class="ctrlSvgLbl ctrlSvgLblFace" x="430" y="155">△</text>
                <circle data-button="b" class="ctrlSvgBtn ctrlSvgFace ctrlSvgFaceB" cx="460" cy="180" r="14"/>
                <text class="ctrlSvgLbl ctrlSvgLblFace" x="460" y="185">○</text>
                <circle data-button="a" class="ctrlSvgBtn ctrlSvgFace ctrlSvgFaceA" cx="430" cy="210" r="14"/>
                <text class="ctrlSvgLbl ctrlSvgLblFace" x="430" y="215">✕</text>
                <circle data-button="x" class="ctrlSvgBtn ctrlSvgFace ctrlSvgFaceX" cx="400" cy="180" r="14"/>
                <text class="ctrlSvgLbl ctrlSvgLblFace" x="400" y="185">□</text>

                <circle class="ctrlSvgStickWell"      cx="240" cy="272" r="36"/>
                <circle class="ctrlSvgStickWellInner" cx="240" cy="272" r="30"/>
                <circle data-button="l3" class="ctrlSvgBtn ctrlSvgStick" cx="240" cy="272" r="24"/>
                <circle class="ctrlSvgStickRim"       cx="240" cy="272" r="22"/>
                <circle data-stick="l"  class="ctrlSvgStickDot" cx="240" cy="272" r="10"/>

                <circle class="ctrlSvgStickWell"      cx="360" cy="272" r="36"/>
                <circle class="ctrlSvgStickWellInner" cx="360" cy="272" r="30"/>
                <circle data-button="r3" class="ctrlSvgBtn ctrlSvgStick" cx="360" cy="272" r="24"/>
                <circle class="ctrlSvgStickRim"       cx="360" cy="272" r="22"/>
                <circle data-stick="r"  class="ctrlSvgStickDot" cx="360" cy="272" r="10"/>

                <text class="ctrlSvgPsLogo" x="300" y="240">PlayStation</text>
            </svg>
        `;
    }

    /** Xbox-Layout (Series X): kompakter Body, asymmetrische Sticks (L3 oben links,
     *  R3 unten rechts), D-Pad unter L-Stick, Guide-Button mit Halo + leuchtendem
     *  X-Logo, Grip-Texture-Lines.
     *  Stick-Basis: L3=(180,160), R3=(370,252). */
    function buildSvgXbox(): string {
        return `
            <svg viewBox="0 0 600 360" class="ctrlSvg ctrlSvgStyleXbox" role="img" aria-label="Xbox controller">
                <rect data-button="l2" class="ctrlSvgBtn ctrlSvgTrigger" x="100" y="14" width="80" height="46" rx="16"/>
                <text class="ctrlSvgLbl ctrlSvgLblTrigger" x="140" y="42">LT</text>
                <rect data-button="r2" class="ctrlSvgBtn ctrlSvgTrigger" x="420" y="14" width="80" height="46" rx="16"/>
                <text class="ctrlSvgLbl ctrlSvgLblTrigger" x="460" y="42">RT</text>

                <rect data-button="l1" class="ctrlSvgBtn ctrlSvgShoulder" x="100" y="58" width="98" height="22" rx="11"/>
                <text class="ctrlSvgLbl ctrlSvgLblShoulder" x="149" y="71">LB</text>
                <rect data-button="r1" class="ctrlSvgBtn ctrlSvgShoulder" x="402" y="58" width="98" height="22" rx="11"/>
                <text class="ctrlSvgLbl ctrlSvgLblShoulder" x="451" y="71">RB</text>

                <path class="ctrlSvgBody" d="M 130 80 L 470 80 C 502 82 524 106 530 140 C 535 178 524 220 506 252 C 488 282 462 300 432 310 C 408 316 384 314 364 306 C 348 298 334 290 322 284 C 312 280 304 278 300 278 L 300 278 C 296 278 288 280 278 284 C 266 290 252 298 236 306 C 216 314 192 316 168 310 C 138 300 112 282 94 252 C 76 220 65 178 70 140 C 76 106 98 82 130 80 Z"/>

                <path class="ctrlSvgGripDetail" d="M 110 270 L 130 290 M 105 280 L 125 300 M 100 290 L 120 308"/>
                <path class="ctrlSvgGripDetail" d="M 490 270 L 470 290 M 495 280 L 475 300 M 500 290 L 480 308"/>

                <circle class="ctrlSvgGuideRing" cx="300" cy="120" r="22"/>
                <circle class="ctrlSvgGuide"      cx="300" cy="120" r="16"/>
                <path   class="ctrlSvgXboxLogo"   d="M 291 111 L 309 129 M 291 129 L 309 111"/>

                <rect data-button="select" class="ctrlSvgBtn ctrlSvgPill" x="248" y="115" width="20" height="10" rx="5"/>
                <rect data-button="start"  class="ctrlSvgBtn ctrlSvgPill" x="332" y="115" width="20" height="10" rx="5"/>

                <circle class="ctrlSvgStickWell"      cx="180" cy="160" r="36"/>
                <circle class="ctrlSvgStickWellInner" cx="180" cy="160" r="30"/>
                <circle data-button="l3" class="ctrlSvgBtn ctrlSvgStick" cx="180" cy="160" r="24"/>
                <circle class="ctrlSvgStickRim"       cx="180" cy="160" r="22"/>
                <circle data-stick="l"  class="ctrlSvgStickDot" cx="180" cy="160" r="10"/>

                <circle data-button="y" class="ctrlSvgBtn ctrlSvgFace ctrlSvgXboxY" cx="430" cy="138" r="14"/>
                <text class="ctrlSvgLbl ctrlSvgLblFace" x="430" y="143">Y</text>
                <circle data-button="b" class="ctrlSvgBtn ctrlSvgFace ctrlSvgXboxB" cx="462" cy="170" r="14"/>
                <text class="ctrlSvgLbl ctrlSvgLblFace" x="462" y="175">B</text>
                <circle data-button="a" class="ctrlSvgBtn ctrlSvgFace ctrlSvgXboxA" cx="430" cy="202" r="14"/>
                <text class="ctrlSvgLbl ctrlSvgLblFace" x="430" y="207">A</text>
                <circle data-button="x" class="ctrlSvgBtn ctrlSvgFace ctrlSvgXboxX" cx="398" cy="170" r="14"/>
                <text class="ctrlSvgLbl ctrlSvgLblFace" x="398" y="175">X</text>

                <rect class="ctrlSvgDpadCenter" x="211" y="243" width="18" height="18"/>
                <rect data-button="dpadUp"    class="ctrlSvgBtn ctrlSvgDpad" x="211" y="219" width="18" height="24" rx="3"/>
                <path class="ctrlSvgDpadArrow" d="M 215 235 L 220 227 L 225 235 Z"/>
                <rect data-button="dpadDown"  class="ctrlSvgBtn ctrlSvgDpad" x="211" y="261" width="18" height="24" rx="3"/>
                <path class="ctrlSvgDpadArrow" d="M 215 269 L 220 277 L 225 269 Z"/>
                <rect data-button="dpadLeft"  class="ctrlSvgBtn ctrlSvgDpad" x="187" y="243" width="24" height="18" rx="3"/>
                <path class="ctrlSvgDpadArrow" d="M 203 248 L 195 252 L 203 256 Z"/>
                <rect data-button="dpadRight" class="ctrlSvgBtn ctrlSvgDpad" x="229" y="243" width="24" height="18" rx="3"/>
                <path class="ctrlSvgDpadArrow" d="M 237 248 L 245 252 L 237 256 Z"/>

                <circle class="ctrlSvgStickWell"      cx="370" cy="252" r="36"/>
                <circle class="ctrlSvgStickWellInner" cx="370" cy="252" r="30"/>
                <circle data-button="r3" class="ctrlSvgBtn ctrlSvgStick" cx="370" cy="252" r="24"/>
                <circle class="ctrlSvgStickRim"       cx="370" cy="252" r="22"/>
                <circle data-stick="r"  class="ctrlSvgStickDot" cx="370" cy="252" r="10"/>

                <text class="ctrlSvgXboxWord" x="300" y="318">XBOX</text>
            </svg>
        `;
    }

    function svgMarkupFor(style: ControllerVisualStyle): string {
        return style === "xbox" ? buildSvgXbox() : buildSvgPs();
    }

    function stickBasesFor(style: ControllerVisualStyle): { l: { cx: number; cy: number }; r: { cx: number; cy: number } } {
        if (style === "xbox") {
            return { l: { cx: 180, cy: 160 }, r: { cx: 370, cy: 252 } };
        }
        return { l: { cx: 240, cy: 272 }, r: { cx: 360, cy: 272 } };
    }

    /** Befuellt buttonShapes/stickDots aus dem aktuell im svgHost gemounteten
     *  SVG. Bei einem Style-Swap rufen wir das erneut auf. */
    function querySvgRefs(refs: ControllerSvgRefs): void {
        const svg = refs.svgHost.querySelector("svg") as SVGSVGElement | null;
        refs.buttonShapes.clear();
        if (!svg) return;
        for (const shape of Array.from(svg.querySelectorAll<SVGElement>("[data-button]"))) {
            const name = shape.getAttribute("data-button") as ControllerButtonName;
            refs.buttonShapes.set(name, shape);
        }
        refs.stickDots.l = svg.querySelector<SVGCircleElement>('[data-stick="l"]') as SVGCircleElement;
        refs.stickDots.r = svg.querySelector<SVGCircleElement>('[data-stick="r"]') as SVGCircleElement;
    }

    /** Rendert ein neues Layout in den vorhandenen svgHost. Liefert true zurueck,
     *  wenn tatsaechlich getauscht wurde (zum Re-Wiren der Hover-Listener). */
    function applyControllerStyle(refs: ControllerSvgRefs, nextStyle: ControllerVisualStyle): boolean {
        if (refs.effectiveStyle === nextStyle && refs.buttonShapes.size > 0) return false;
        refs.effectiveStyle = nextStyle;
        refs.svgHost.innerHTML = svgMarkupFor(nextStyle);
        refs.stickBases = stickBasesFor(nextStyle);
        querySvgRefs(refs);
        return true;
    }

    function buildControllerSvg(initialStyle: ControllerVisualStyle): ControllerSvgRefs {
        const wrap = el("div", "ctrlVisualWrap") as HTMLDivElement;
        // Top-row: Status (links) + Style-Dropdown (rechts).
        const topRow = el("div", "ctrlVisualTopRow");
        const statusEl = el("div", "ctrlVisualStatus") as HTMLElement;
        const styleSelectEl = document.createElement("select");
        styleSelectEl.className = "ctrlVisualStyleSelect";
        for (const [val, key] of [
            ["auto", "controller.svg.style.auto"],
            ["ps",   "controller.svg.style.ps"],
            ["xbox", "controller.svg.style.xbox"],
        ] as const) {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = t(key as TranslationKey);
            styleSelectEl.append(opt);
        }
        styleSelectEl.value = "auto";
        topRow.append(statusEl, styleSelectEl);
        wrap.append(topRow);

        const svgHost = el("div", "ctrlSvgHost") as HTMLDivElement;
        wrap.append(svgHost);

        const refs: ControllerSvgRefs = {
            wrap,
            statusEl,
            styleSelectEl,
            svgHost,
            buttonShapes: new Map<ControllerButtonName, SVGElement>(),
            stickDots: { l: null as unknown as SVGCircleElement, r: null as unknown as SVGCircleElement },
            stickBases: stickBasesFor(initialStyle),
            effectiveStyle: initialStyle,
        };
        applyControllerStyle(refs, initialStyle);
        return refs;
    }

    /** Startet den RAF-Loop fuer Live-Button-Anzeige im SVG. Liefert eine
     *  Cleanup-Funktion zurueck; aktiviert auch den Status-Text (Controller-ID).
     *
     *  Wir lesen `navigator.getGamepads()` direkt im Renderer (Launcher-Window)
     *  — der gleiche Loop, den der Preload fuer das Spiel nutzt, aber hier nur
     *  zur Visualisierung. Triggers (L2/R2) zaehlen als gedrueckt ab value > 0.3,
     *  damit Analog-Trigger sauber animieren. */
    function startControllerLiveLoop(
        refs: ControllerSvgRefs,
        opts: {
            getUserStyle: () => ControllerStyle;
            onStyleSwapped: () => void;
        },
    ): () => void {
        let cancelled = false;
        let rafId: number | null = null;
        let lastConnectedId: string | null = null;
        let lastStatusKey: string | null = null;

        const setStatus = (id: string | null, hint: string | null) => {
            const key = (id ?? "") + "|" + (hint ?? "");
            if (key === lastStatusKey) return;
            lastStatusKey = key;
            refs.statusEl.innerHTML = "";
            const dot = el("span", "ctrlVisualStatusDot");
            const txt = document.createTextNode(
                id ? id : (hint ?? t("controller.svg.statusDisconnected" as TranslationKey)),
            );
            refs.statusEl.classList.toggle("connected", !!id);
            refs.statusEl.append(dot, txt);
        };

        const applyDz = (v: number) => (Math.abs(v) < STICK_DEAD ? 0 : v);

        const tick = () => {
            if (cancelled) return;
            const pads: Array<Gamepad | null> = navigator.getGamepads
                ? Array.from(navigator.getGamepads())
                : [];
            const gp = pads.find((p): p is Gamepad => !!p) ?? null;

            // Auto-Style: erkenntes Layout aus gamepad.id ableiten und das SVG
            // tauschen — nur wenn der User keinen manuellen Override gesetzt hat.
            const userStyle = opts.getUserStyle();
            if (gp && userStyle === "auto") {
                const detected = detectControllerStyle(gp.id);
                if (detected !== refs.effectiveStyle) {
                    if (applyControllerStyle(refs, detected)) {
                        opts.onStyleSwapped();
                    }
                }
            }

            if (gp) {
                if (gp.id !== lastConnectedId) {
                    lastConnectedId = gp.id;
                    setStatus(gp.id, null);
                }
                const buttonIndices: Array<{ idx: number; name: ControllerButtonName }> = [
                    { idx: 0, name: "a" }, { idx: 1, name: "b" }, { idx: 2, name: "x" }, { idx: 3, name: "y" },
                    { idx: 4, name: "l1" }, { idx: 5, name: "r1" }, { idx: 6, name: "l2" }, { idx: 7, name: "r2" },
                    { idx: 8, name: "select" }, { idx: 9, name: "start" }, { idx: 10, name: "l3" }, { idx: 11, name: "r3" },
                    { idx: 12, name: "dpadUp" }, { idx: 13, name: "dpadDown" }, { idx: 14, name: "dpadLeft" }, { idx: 15, name: "dpadRight" },
                ];
                for (const { idx, name } of buttonIndices) {
                    const shape = refs.buttonShapes.get(name);
                    if (!shape) continue;
                    const btn = gp.buttons[idx];
                    const pressed = !!(btn && (btn.pressed || (typeof btn.value === "number" && btn.value > 0.3)));
                    shape.classList.toggle("ctrlSvgPressed", pressed);
                }
                const lx = applyDz(gp.axes[0] ?? 0);
                const ly = applyDz(gp.axes[1] ?? 0);
                refs.stickDots.l?.setAttribute("cx", String(refs.stickBases.l.cx + lx * STICK_DOT_RANGE));
                refs.stickDots.l?.setAttribute("cy", String(refs.stickBases.l.cy + ly * STICK_DOT_RANGE));
                const rx = applyDz(gp.axes[2] ?? 0);
                const ry = applyDz(gp.axes[3] ?? 0);
                refs.stickDots.r?.setAttribute("cx", String(refs.stickBases.r.cx + rx * STICK_DOT_RANGE));
                refs.stickDots.r?.setAttribute("cy", String(refs.stickBases.r.cy + ry * STICK_DOT_RANGE));
            }
            else if (lastConnectedId !== null) {
                lastConnectedId = null;
                setStatus(null, null);
                for (const shape of refs.buttonShapes.values()) {
                    shape.classList.remove("ctrlSvgPressed");
                }
                refs.stickDots.l?.setAttribute("cx", String(refs.stickBases.l.cx));
                refs.stickDots.l?.setAttribute("cy", String(refs.stickBases.l.cy));
                refs.stickDots.r?.setAttribute("cx", String(refs.stickBases.r.cx));
                refs.stickDots.r?.setAttribute("cy", String(refs.stickBases.r.cy));
            }
            rafId = requestAnimationFrame(tick);
        };

        setStatus(null, null);
        rafId = requestAnimationFrame(tick);

        return () => {
            cancelled = true;
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        };
    }

    async function renderControllerTab(): Promise<void> {
        // Falls beim Re-Open der gleiche Tab schon einen Live-Loop laufen
        // hatte: erst sauber abreissen, sonst stapeln sich RAFs.
        if (controllerLiveCleanup) {
            controllerLiveCleanup();
            controllerLiveCleanup = null;
        }
        controllerPane.innerHTML = "";
        controllerPane.classList.add("controllerPaneInner");

        // Header: Titel + Intro
        const head = el("div", "ctrlHead");
        head.append(
            el("div", "ctrlTabTitle", t("controller.tabTitle" as TranslationKey)),
            el("div", "ctrlIntro", t("controller.intro" as TranslationKey)),
        );
        controllerPane.append(head);

        // SVG-Diagramm + Live-Status — beide Eingangsrichtungen (SVG → Card,
        // Card → SVG) werden weiter unten verdrahtet, sobald die Cards stehen.
        // Initial-Layout: einmal aktuelle Pads abfragen, davon erstes Layout
        // ableiten. Spaeter kann der Live-Loop auto-swappen.
        let userStyle: ControllerStyle = "auto";
        const initialDetected: ControllerVisualStyle = (() => {
            const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
            const gp = pads.find((p): p is Gamepad => !!p) ?? null;
            return gp ? detectControllerStyle(gp.id) : "ps";
        })();
        const svgRefs = buildControllerSvg(initialDetected);
        // SVG wird gleich in das Spatial-Layout (Mittelspalte) gehaengt — nicht
        // mehr direkt in den Pane.

        const cardRefs = new Map<ControllerButtonName, HTMLElement>();

        const flashCard = (card: HTMLElement) => {
            card.classList.remove("ctrlCardFlash");
            // Force reflow, damit die Animation neu startet, falls schnell
            // hintereinander auf den gleichen Button geklickt wird.
            void card.offsetWidth;
            card.classList.add("ctrlCardFlash");
            window.setTimeout(() => card.classList.remove("ctrlCardFlash"), 900);
        };

        /** Listener-Bindung muss nach jedem Style-Swap neu passieren, weil das
         *  innerHTML-Replace der SVG-Inhalte alle alten DOM-Listener killt. */
        const wireSvgListeners = () => {
            for (const [name, shape] of svgRefs.buttonShapes.entries()) {
                shape.addEventListener("mouseenter", () => {
                    shape.classList.add("ctrlSvgHover");
                    cardRefs.get(name)?.classList.add("ctrlCardHighlight");
                });
                shape.addEventListener("mouseleave", () => {
                    shape.classList.remove("ctrlSvgHover");
                    cardRefs.get(name)?.classList.remove("ctrlCardHighlight");
                });
                shape.addEventListener("click", () => {
                    const card = cardRefs.get(name);
                    if (!card) return;
                    card.scrollIntoView({ behavior: "smooth", block: "center" });
                    flashCard(card);
                });
            }
        };
        wireSvgListeners();

        // Style-Dropdown: User kann Auto/PS/Xbox waehlen. Bei Auto erkennt der
        // Live-Loop selbststaendig und tauscht; bei manueller Wahl wird sofort
        // geswappt und die Auto-Erkennung pausiert.
        svgRefs.styleSelectEl.addEventListener("change", () => {
            userStyle = svgRefs.styleSelectEl.value as ControllerStyle;
            const target: ControllerVisualStyle = userStyle === "auto"
                ? (() => {
                    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
                    const gp = pads.find((p): p is Gamepad => !!p) ?? null;
                    return gp ? detectControllerStyle(gp.id) : "ps";
                })()
                : userStyle;
            if (applyControllerStyle(svgRefs, target)) {
                wireSvgListeners();
            }
        });

        // Profile dropdown
        const profiles = (await window.api.profilesList?.()) as Array<{
            id: string;
            name: string;
            controller?: { buttons?: ControllerButtonOverride };
        }>;
        if (!profiles || profiles.length === 0) {
            controllerPane.append(el("div", "ctrlEmpty", t("controller.noProfiles" as TranslationKey)));
            return;
        }

        const profileRow = el("div", "ctrlProfileRow");
        profileRow.append(el("span", "ctrlProfileLabel", t("controller.profileLabel" as TranslationKey)));
        const selectEl = document.createElement("select");
        selectEl.className = "ctrlProfileSelect";
        for (const p of profiles) {
            const opt = document.createElement("option");
            opt.value = p.id;
            opt.textContent = p.name;
            selectEl.append(opt);
        }
        if (currentControllerProfileId && profiles.some((p) => p.id === currentControllerProfileId)) {
            selectEl.value = currentControllerProfileId;
        }
        else {
            currentControllerProfileId = profiles[0].id;
            selectEl.value = profiles[0].id;
        }
        profileRow.append(selectEl);
        controllerPane.append(profileRow);

        // Ringmaster-Buffer-Target-Selector: Welches Profil bekommt die
        // Inputs solange die Special-Action `@forwardHold` gehalten wird?
        // None → Hold-Action no-op. Wird neben dem Profile-Selector angezeigt.
        const bufferRow = el("div", "ctrlProfileRow");
        bufferRow.append(el("span", "ctrlProfileLabel", t("controller.bufferTarget.label" as TranslationKey)));
        const bufferSelect = document.createElement("select");
        bufferSelect.className = "ctrlProfileSelect";
        const noneOpt = document.createElement("option");
        noneOpt.value = "";
        noneOpt.textContent = t("controller.bufferTarget.none" as TranslationKey);
        bufferSelect.append(noneOpt);
        // Optionen werden in renderForProfile aktualisiert (alle anderen Profile
        // ausser dem aktuellen).
        const refreshBufferOptions = (currentId: string) => {
            // Vorhandene non-none-Options entfernen.
            while (bufferSelect.children.length > 1) bufferSelect.removeChild(bufferSelect.lastChild!);
            for (const p of profiles) {
                if (p.id === currentId) continue; // Selbst-Referenz blockieren
                const opt = document.createElement("option");
                opt.value = p.id;
                opt.textContent = p.name;
                bufferSelect.append(opt);
            }
            // Aktuellen Wert vom Profil setzen.
            const profile = profiles.find((p) => p.id === currentId) as
                | { controller?: { bufferTargetProfileId?: string | null } } | undefined;
            const target = profile?.controller?.bufferTargetProfileId ?? "";
            bufferSelect.value = profiles.some((p) => p.id === target) ? target : "";
        };
        bufferSelect.addEventListener("change", async () => {
            if (!currentControllerProfileId) return;
            const newTarget = bufferSelect.value || null;
            // Profile-Cache lokal patchen, damit Re-Render konsistent ist.
            const prof = profiles.find((p) => p.id === currentControllerProfileId);
            if (prof) {
                const root = prof as unknown as { controller?: Record<string, unknown> };
                const c = (root.controller ??= {} as Record<string, unknown>);
                if (newTarget) c.bufferTargetProfileId = newTarget;
                else delete c.bufferTargetProfileId;
            }
            // Persistieren via profilesUpdate-IPC (gleicher Mechanismus wie
            // Bindings/Modifier-Save).
            try {
                await api.profilesUpdate({
                    id: currentControllerProfileId,
                    controller: { bufferTargetProfileId: newTarget },
                });
                // Reload-Trigger an Main, damit der Cache fuer den naechsten
                // Frame schon den neuen Target hat.
                (window as unknown as { controllerApi?: { reloadMapping?: (id: string) => void } })
                    .controllerApi?.reloadMapping?.(currentControllerProfileId);
            } catch (err) {
                showToast(`Save failed: ${err instanceof Error ? err.message : String(err)}`, "error");
            }
        });
        bufferRow.append(bufferSelect);
        controllerPane.append(bufferRow);

        controllerPane.append(el("div", "ctrlCalibrateHint", t("controller.calibrateHint" as TranslationKey)));

        // Spatial-Layout: 3 Spalten — links D-Pad + L3, mitte (Top-Strip mit
        // Triggers/Shoulders/System + SVG-Diagramm), rechts Face-Buttons + R3.
        // Jede Card sitzt da wo der reale Knopf am Pad sitzt — antimicrox-Style.
        const spatialLayout = el("div", "ctrlSpatial");
        const leftCol = el("div", "ctrlSpatialCol ctrlSpatialLeft");
        const centerCol = el("div", "ctrlSpatialCol ctrlSpatialCenter");
        const rightCol = el("div", "ctrlSpatialCol ctrlSpatialRight");
        const topStrip = el("div", "ctrlSpatialTopStrip");
        centerCol.append(topStrip, svgRefs.wrap);
        centerCol.append(el("div", "ctrlSvgHint muted", t("controller.svg.hint" as TranslationKey)));

        // Modifier-Inline-Bereich: direkt unter dem SVG. Toggle-Reihe + bedingte
        // Binding-Reihen pro aktiviertem Slot. Container hier anlegen, befuellt
        // wird von rebuildModifierPanel().
        const modifiersInline = el("div", "ctrlModifiersInline");
        const modifiersTitle = el("div", "ctrlModifiersInlineTitle", t("controller.modifiers.title" as TranslationKey));
        const modToggleRow = el("div", "ctrlModToggleRow");
        const modBindingsContainer = el("div", "ctrlModBindings");
        modifiersInline.append(modifiersTitle, modToggleRow, modBindingsContainer);
        centerCol.append(modifiersInline);

        const buildGroup = (parent: HTMLElement, titleKey: string): HTMLElement => {
            const group = el("div", "ctrlSpatialGroup");
            group.append(el("div", "ctrlSpatialGroupTitle", t(titleKey as TranslationKey)));
            const inner = el("div", "ctrlSpatialGroupInner");
            group.append(inner);
            parent.append(group);
            return inner;
        };
        const dpadGroup = buildGroup(leftCol, "controller.section.dpad");
        const lstickGroup = buildGroup(leftCol, "controller.section.lstick");
        const faceGroup = buildGroup(rightCol, "controller.section.face");
        const rstickGroup = buildGroup(rightCol, "controller.section.rstick");

        spatialLayout.append(leftCol, centerCol, rightCol);
        controllerPane.append(spatialLayout);

        // Reihenfolge fuer das Top-Strip-Subgrid (CSS positioniert die einzelnen
        // Cards via [data-button="..."] in 2 Reihen). Hier reicht die DOM-Order
        // wie aufgelistet.
        const buttonPlacements: Array<{ container: HTMLElement; button: ControllerButtonName }> = [
            { container: topStrip, button: "l2" },
            { container: topStrip, button: "r2" },
            { container: topStrip, button: "l1" },
            { container: topStrip, button: "select" },
            { container: topStrip, button: "start" },
            { container: topStrip, button: "r1" },
            { container: dpadGroup,   button: "dpadUp" },
            { container: dpadGroup,   button: "dpadDown" },
            { container: dpadGroup,   button: "dpadLeft" },
            { container: dpadGroup,   button: "dpadRight" },
            { container: lstickGroup, button: "l3" },
            { container: faceGroup,   button: "y" },
            { container: faceGroup,   button: "x" },
            { container: faceGroup,   button: "b" },
            { container: faceGroup,   button: "a" },
            { container: rstickGroup, button: "r3" },
        ];
        const groupContainers = [topStrip, dpadGroup, lstickGroup, faceGroup, rstickGroup];

        // ── Modifier-UI ──────────────────────────────────────────────────────
        // Toggle pro Schulter (L1/R1/L2/R2). Bei "on" wird die Binding-Reihe
        // mit 4 Face-Button-Cards (△○✕□) eingeblendet. Bindings bleiben auch
        // bei toggle-off erhalten — nur enabled-Flag wird umgeschaltet.

        const MODIFIER_TARGETS: ControllerButtonName[] = ["y", "b", "a", "x"];

        const buildModifierCard = (slot: ModifierSlotName, target: ControllerButtonName): HTMLElement => {
            const info = CONTROLLER_BUTTONS[target];
            const card = el("div", "ctrlCard ctrlModCard");
            card.dataset.button = target;
            card.dataset.modifier = slot;
            card.title = `${slot.toUpperCase()} + ${info.name}`;

            const symbol = el("div", "ctrlSymbol", info.symbol);
            const meta = el("div", "ctrlCardInfo");
            const binding = el("div", "ctrlCardBinding");
            meta.append(binding);

            const refreshBinding = () => {
                binding.className = "ctrlCardBinding";
                binding.innerHTML = "";
                const value = currentControllerModifiers[slot]?.buttons?.[target];
                if (typeof value === "string" && value.length > 0) {
                    binding.classList.add("override");
                    binding.textContent = controllerActionLabel(value);
                }
                else if (value === null) {
                    binding.classList.add("unbound");
                    binding.textContent = t("controller.binding.unbound" as TranslationKey);
                }
                else {
                    binding.classList.add("default");
                    binding.textContent = t("controller.modifiers.unset" as TranslationKey);
                }
            };

            const writeBinding = (value: string | null) => {
                if (!currentControllerModifiers[slot]) currentControllerModifiers[slot] = { enabled: true };
                const layer = currentControllerModifiers[slot]!;
                if (!layer.buttons) layer.buttons = {};
                layer.buttons[target] = value;
                refreshBinding();
            };

            let capturingActive = false;
            const startCapture = () => {
                if (capturingActive) return;
                capturingActive = true;
                binding.textContent = t("controller.capturing" as TranslationKey);
                binding.classList.add("capturing");
                const onKey = (ev: KeyboardEvent) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    document.removeEventListener("keydown", onKey, true);
                    capturingActive = false;
                    binding.classList.remove("capturing");
                    if (ev.key === "Escape") {
                        refreshBinding();
                        return;
                    }
                    let code = ev.key;
                    if (code.length === 1) code = code.toUpperCase();
                    if (code === " ") code = "Space";
                    if (code === "Enter") code = "Return";
                    writeBinding(code);
                };
                document.addEventListener("keydown", onKey, true);
            };

            binding.tabIndex = 0;
            binding.addEventListener("click", startCapture);
            binding.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    startCapture();
                }
            });

            const actions = el("div", "ctrlCardActions");
            const modPadBtn = document.createElement("button");
            modPadBtn.type = "button";
            modPadBtn.className = "ctrlBtn ctrlBtnPad";
            modPadBtn.textContent = "@";
            modPadBtn.title = t("controller.action.menuTitle" as TranslationKey);
            modPadBtn.addEventListener("click", () => {
                showSpecialActionMenu(modPadBtn, (action) => writeBinding(action));
            });
            const clearBtn = document.createElement("button");
            clearBtn.type = "button";
            clearBtn.className = "ctrlBtn ctrlBtnReset";
            clearBtn.textContent = "↺";
            clearBtn.title = t("controller.modifiers.clear" as TranslationKey);
            clearBtn.addEventListener("click", () => {
                const layer = currentControllerModifiers[slot];
                if (layer?.buttons) {
                    delete layer.buttons[target];
                    if (Object.keys(layer.buttons).length === 0) delete layer.buttons;
                }
                refreshBinding();
            });
            actions.append(modPadBtn, clearBtn);
            // Icon nur fuer aktive Modifier-Layer (l1/r1/r2 — l2 ist Cursor-Modus,
            // wird hier nicht gerendert).
            if (slot === "l1" || slot === "r1" || slot === "r2") {
                if (target === "a" || target === "b" || target === "x" || target === "y") {
                    actions.append(buildIconBtn(target, slot));
                }
            }

            card.append(symbol, meta, actions);
            refreshBinding();
            return card;
        };

        const isModifierEnabled = (slot: ModifierSlotName): boolean => {
            const layer = currentControllerModifiers[slot];
            return !!layer && layer.enabled !== false;
        };

        const rebuildModifierPanel = () => {
            // Toggle-Reihe
            modToggleRow.innerHTML = "";
            for (const slot of ["l1", "r1", "l2", "r2"] as const) {
                const isOn = isModifierEnabled(slot);
                const chip = document.createElement("button");
                chip.type = "button";
                chip.className = "ctrlModToggle";
                if (isOn) chip.classList.add("on");
                chip.append(
                    el("span", "ctrlModToggleLabel", slot.toUpperCase()),
                    el("span", "ctrlModToggleStatus", isOn
                        ? t("controller.modifiers.toggleOn" as TranslationKey)
                        : t("controller.modifiers.toggleOff" as TranslationKey)),
                );
                chip.addEventListener("click", () => {
                    const cur = currentControllerModifiers[slot] ?? {};
                    if (isOn) {
                        currentControllerModifiers[slot] = { ...cur, enabled: false };
                    }
                    else {
                        currentControllerModifiers[slot] = { ...cur, enabled: true };
                    }
                    rebuildModifierPanel();
                });
                modToggleRow.append(chip);
            }
            // Binding-Reihen pro aktiviertem Slot
            modBindingsContainer.innerHTML = "";
            for (const slot of ["l1", "r1", "l2", "r2"] as const) {
                if (!isModifierEnabled(slot)) continue;
                const row = el("div", "ctrlModRow");
                row.append(el("div", "ctrlModRowLabel", `${slot.toUpperCase()} +`));
                const grid = el("div", "ctrlModRowGrid");
                for (const target of MODIFIER_TARGETS) {
                    grid.append(buildModifierCard(slot, target));
                }
                row.append(grid);
                modBindingsContainer.append(row);
            }
        };

        const renderForProfile = (profileId: string) => {
            const p = profiles.find((x) => x.id === profileId);
            currentControllerOverride = { ...(p?.controller?.buttons ?? {}) };
            // Modifier deep-clonen damit die Bearbeitung nicht in den Profile-
            // List-Cache zurueckschlaegt. Beide Formate akzeptieren: das neue
            // { enabled, buttons } und das alte flache { y, b, ... }, falls
            // Profile noch nicht migriert sind.
            const rawMods = (p as {
                controller?: { modifiers?: Partial<Record<ModifierSlotName, unknown>> };
            } | undefined)?.controller?.modifiers ?? {};
            currentControllerModifiers = {};
            for (const slot of ["l1", "r1", "l2", "r2"] as const) {
                const raw = rawMods[slot];
                if (!raw || typeof raw !== "object") continue;
                const obj = raw as Record<string, unknown>;
                const hasLayerShape = "enabled" in obj || "buttons" in obj;
                if (hasLayerShape) {
                    const enabled = typeof obj.enabled === "boolean" ? obj.enabled : true;
                    const buttons = (obj.buttons && typeof obj.buttons === "object")
                        ? { ...(obj.buttons as ControllerButtonOverride) }
                        : undefined;
                    currentControllerModifiers[slot] = { enabled, ...(buttons ? { buttons } : {}) };
                }
                else {
                    currentControllerModifiers[slot] = { enabled: true, buttons: { ...(raw as ControllerButtonOverride) } };
                }
            }
            for (const c of groupContainers) c.innerHTML = "";
            cardRefs.clear();
            for (const { container, button } of buttonPlacements) {
                container.append(buildButtonCard(button));
            }
            rebuildModifierPanel();
            refreshBufferOptions(profileId);
        };

        const buildButtonCard = (btnKey: ControllerButtonName): HTMLElement => {
            const info = CONTROLLER_BUTTONS[btnKey];
            const card = el("div", "ctrlCard");
            card.dataset.button = btnKey;
            card.title = info.name;
            cardRefs.set(btnKey, card);
            card.addEventListener("mouseenter", () => {
                svgRefs.buttonShapes.get(btnKey)?.classList.add("ctrlSvgHover");
            });
            card.addEventListener("mouseleave", () => {
                svgRefs.buttonShapes.get(btnKey)?.classList.remove("ctrlSvgHover");
            });

            const symbol = el("div", "ctrlSymbol", info.symbol);
            const meta = el("div", "ctrlCardInfo");
            const name = el("div", "ctrlCardName", info.name);
            const binding = el("div", "ctrlCardBinding");
            meta.append(name, binding);

            const refreshBinding = () => {
                binding.className = "ctrlCardBinding";
                binding.innerHTML = "";
                const override = currentControllerOverride[btnKey];
                if (override === null) {
                    binding.classList.add("unbound");
                    binding.textContent = t("controller.binding.unbound" as TranslationKey);
                }
                else if (typeof override === "string") {
                    binding.classList.add("override");
                    binding.textContent = controllerActionLabel(override);
                }
                else {
                    const def = controllerActionLabel(info.defaultAction);
                    binding.classList.add("default");
                    binding.append(
                        document.createTextNode(def || "—"),
                        el("span", "ctrlDefaultTag", " " + t("controller.defaultTag" as TranslationKey)),
                    );
                }
            };

            const actions = el("div", "ctrlCardActions");
            const captureBtn = document.createElement("button");
            captureBtn.type = "button";
            captureBtn.className = "ctrlBtn ctrlBtnCapture";
            captureBtn.textContent = t("controller.capture" as TranslationKey);

            // Capture-Logik: kann sowohl von der Binding-Zelle (Klick) als auch
            // vom expliziten Capture-Button (in nicht-spatial Layouts) angestossen
            // werden. Im Spatial-Mode ist die Binding selbst der Trigger — der
            // Capture-Button wird per CSS versteckt.
            let capturingActive = false;
            const startCapture = () => {
                if (capturingActive) return;
                capturingActive = true;
                const origText = binding.textContent || "";
                binding.textContent = t("controller.capturing" as TranslationKey);
                binding.classList.add("capturing");
                captureBtn.textContent = t("controller.capturing" as TranslationKey);
                captureBtn.disabled = true;
                captureBtn.classList.add("capturing");
                const onKey = (ev: KeyboardEvent) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    document.removeEventListener("keydown", onKey, true);
                    capturingActive = false;
                    captureBtn.textContent = t("controller.capture" as TranslationKey);
                    captureBtn.disabled = false;
                    captureBtn.classList.remove("capturing");
                    binding.classList.remove("capturing");
                    if (ev.key === "Escape") {
                        binding.textContent = origText;
                        return;
                    }
                    let code = ev.key;
                    if (code.length === 1) code = code.toUpperCase();
                    if (code === " ") code = "Space";
                    if (code === "Enter") code = "Return";
                    currentControllerOverride[btnKey] = code;
                    refreshBinding();
                };
                document.addEventListener("keydown", onKey, true);
            };

            captureBtn.addEventListener("click", startCapture);
            // Binding-Zelle ist im Spatial-Mode das Click-Target.
            binding.tabIndex = 0;
            binding.addEventListener("click", startCapture);
            binding.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    startCapture();
                }
            });

            // "@"-Button: oeffnet Popover mit Special-Actions (Action-Pad,
            // Tab-Wechsel, Reload, Fullscreen, Open-Config).
            const padBtn = document.createElement("button");
            padBtn.type = "button";
            padBtn.className = "ctrlBtn ctrlBtnPad";
            padBtn.textContent = "@";
            padBtn.title = t("controller.action.menuTitle" as TranslationKey);
            padBtn.addEventListener("click", () => {
                showSpecialActionMenu(padBtn, (action) => {
                    currentControllerOverride[btnKey] = action;
                    refreshBinding();
                });
            });

            const unbindBtn = document.createElement("button");
            unbindBtn.type = "button";
            unbindBtn.className = "ctrlBtn ctrlBtnUnbind";
            unbindBtn.textContent = "✕";
            unbindBtn.title = t("controller.unbind" as TranslationKey);
            unbindBtn.addEventListener("click", () => {
                currentControllerOverride[btnKey] = null;
                refreshBinding();
            });

            const resetBtn = document.createElement("button");
            resetBtn.type = "button";
            resetBtn.className = "ctrlBtn ctrlBtnReset";
            resetBtn.textContent = "↺";
            resetBtn.title = t("controller.resetHint" as TranslationKey);
            resetBtn.addEventListener("click", () => {
                delete currentControllerOverride[btnKey];
                refreshBinding();
            });

            // Icon-Button — nur fuer Face-Buttons (a/b/x/y). Click-to-Capture aus
            // dem laufenden Spiel; Shift+Klick loescht das Icon. Persistiert direkt
            // (unabhaengig vom Save-Knopf), weil der Capture-Flow async ist und
            // das Spiel bereits offen sein muss.
            let iconBtn: HTMLButtonElement | null = null;
            if (btnKey === "a" || btnKey === "b" || btnKey === "x" || btnKey === "y") {
                iconBtn = buildIconBtn(btnKey, null);
            }

            actions.append(captureBtn, padBtn, unbindBtn, resetBtn);
            if (iconBtn) actions.append(iconBtn);

            card.append(symbol, meta, actions);
            refreshBinding();
            return card;
        };

        // Helfer: erzeugt einen Icon-Setter-Button fuer ein Face-Slot (Base-Layer
        // oder Modifier-Layer). Liest aktuellen Icon-State vom Profil-Cache,
        // ruft beim Klick `captureIcon`/`clearIcon` aus dem Preload und
        // aktualisiert die Anzeige direkt mit der zurueckgegebenen Data-URI.
        const buildIconBtn = (
            face: "a" | "b" | "x" | "y",
            layer: "l1" | "r1" | "r2" | null,
        ): HTMLButtonElement => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "ctrlBtn ctrlBtnIcon";

            const readCurrentIcon = (): string | undefined => {
                if (!currentControllerProfileId) return undefined;
                const profile = profiles.find((p) => p.id === currentControllerProfileId) as
                    | { controller?: { icons?: Record<string, string>; modifiers?: Record<string, { icons?: Record<string, string> }> } }
                    | undefined;
                if (!profile?.controller) return undefined;
                if (layer) return profile.controller.modifiers?.[layer]?.icons?.[face];
                return profile.controller.icons?.[face];
            };
            const setDisplay = (uri: string | undefined) => {
                if (uri) {
                    btn.style.backgroundImage = `url("${uri}")`;
                    btn.style.backgroundSize = "cover";
                    btn.style.backgroundPosition = "center";
                    btn.textContent = "";
                    btn.title = t("controller.icon.replace" as TranslationKey);
                }
                else {
                    btn.style.backgroundImage = "";
                    btn.textContent = "📷";
                    btn.title = t("controller.icon.set" as TranslationKey);
                }
            };
            setDisplay(readCurrentIcon());

            const ctrlApi = (window as unknown as {
                controllerApi?: {
                    captureIcon: (id: string, f: "a" | "b" | "x" | "y", l: "l1" | "r1" | "r2" | null)
                        => Promise<{ ok: boolean; dataUri?: string; reason?: string }>;
                    clearIcon: (id: string, f: "a" | "b" | "x" | "y", l: "l1" | "r1" | "r2" | null)
                        => Promise<{ ok: boolean }>;
                    listGameIcons?: () => Promise<{ ok: boolean; icons?: GameIcon[]; error?: string }>;
                };
            }).controllerApi;

            // Helper zum Schreiben des Icons ins Profile-Cache + Persistierung
            // via captureIcon-IPC. Wir nutzen `captureIcon` mit einem virtuellen
            // dataUri-Pfad indem wir den Capture-Mechanismus umgehen — eigentlich
            // braucht's einen separaten IPC `controller:icon:set`. Pragmatisch:
            // wir schreiben direkt in den Profile-Cache und lassen die normale
            // profilesUpdate-Pipeline persistieren.
            const persistIcon = async (dataUri: string | null) => {
                if (!currentControllerProfileId || !ctrlApi) return;
                if (dataUri === null) {
                    // Loeschen geht ueber den existierenden clearIcon-IPC.
                    await ctrlApi.clearIcon(currentControllerProfileId, face, layer);
                } else {
                    // Setzen geht ueber setIcon-IPC (siehe gameIcons-Handler-
                    // Reuse-Strategie). Wenn der nicht existiert, fallback:
                    // direkt via profile-update-IPC. Hier nutzen wir die
                    // existierende Pipeline ueber `setIcon` — wenn sie spaeter
                    // hinzukommt; aktuell setzen wir nur den Cache und lassen
                    // den User auf "Speichern" druecken.
                    const setIconApi = ctrlApi as unknown as {
                        setIcon?: (id: string, f: string, l: string | null, uri: string) => Promise<{ ok: boolean }>;
                    };
                    if (setIconApi.setIcon) {
                        await setIconApi.setIcon(currentControllerProfileId, face, layer, dataUri);
                    }
                }
                // profiles-Cache lokal patchen damit's beim Re-Render bleibt.
                const prof = profiles.find((p) => p.id === currentControllerProfileId);
                if (prof) {
                    const root = prof as unknown as { controller?: Record<string, unknown> };
                    const c = (root.controller ??= {} as Record<string, unknown>);
                    if (layer) {
                        const mods = (c.modifiers as Record<string, { icons?: Record<string, string> }> | undefined) ?? {};
                        const lObj = mods[layer] ?? {};
                        if (dataUri) {
                            lObj.icons = { ...(lObj.icons ?? {}), [face]: dataUri };
                        } else if (lObj.icons) {
                            delete lObj.icons[face];
                        }
                        mods[layer] = lObj;
                        c.modifiers = mods;
                    } else {
                        const ic = (c.icons as Record<string, string> | undefined) ?? {};
                        if (dataUri) {
                            ic[face] = dataUri;
                        } else {
                            delete ic[face];
                        }
                        c.icons = ic;
                    }
                }
                setDisplay(dataUri ?? undefined);
            };

            btn.addEventListener("click", async (ev) => {
                if (!currentControllerProfileId || !ctrlApi) return;
                if (ev.shiftKey) {
                    // Shift+Klick = direkt loeschen, wie bisher
                    btn.disabled = true;
                    try { await persistIcon(null); }
                    finally { btn.disabled = false; }
                    return;
                }
                // Normaler Klick = Picker oeffnen mit allen via Plugins
                // gecachten Spiel-Icons. Suche + Tabs (skills/items/all).
                openGameIconPicker(readCurrentIcon(), async (chosen) => {
                    btn.disabled = true;
                    try { await persistIcon(chosen); }
                    finally { btn.disabled = false; }
                });
            });
            return btn;
        };

        renderForProfile(selectEl.value);
        selectEl.addEventListener("change", () => {
            currentControllerProfileId = selectEl.value;
            renderForProfile(selectEl.value);
        });

        // Footer
        const footer = el("div", "ctrlFooter");
        const resetAllBtn = document.createElement("button");
        resetAllBtn.type = "button";
        resetAllBtn.className = "ctrlBtn ctrlBtnResetAll";
        resetAllBtn.textContent = t("controller.resetAll" as TranslationKey);
        resetAllBtn.addEventListener("click", () => {
            currentControllerOverride = {};
            currentControllerModifiers = {};
            renderForProfile(selectEl.value);
        });

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "ctrlBtn ctrlBtnSave primaryBtn";
        saveBtn.textContent = t("controller.save" as TranslationKey);
        saveBtn.addEventListener("click", async () => {
            if (!currentControllerProfileId) return;
            saveBtn.disabled = true;
            try {
                await window.api.profilesUpdate?.({
                    id: currentControllerProfileId,
                    controller: {
                        buttons: currentControllerOverride,
                        modifiers: currentControllerModifiers,
                    },
                } as unknown as Parameters<NonNullable<typeof window.api.profilesUpdate>>[0]);
                const ctrlApi = (window as unknown as { controllerApi?: { reloadMapping: (id: string) => void } }).controllerApi;
                ctrlApi?.reloadMapping(currentControllerProfileId);
                showToast(t("controller.saved" as TranslationKey), "success");
                const updated = (await window.api.profilesList?.()) as Array<{
                    id: string;
                    controller?: {
                        buttons?: ControllerButtonOverride;
                        modifiers?: Partial<Record<ModifierSlotName, unknown>>;
                    };
                }>;
                const fresh = updated?.find((p) => p.id === currentControllerProfileId);
                currentControllerOverride = { ...(fresh?.controller?.buttons ?? {}) };
                const freshMods = fresh?.controller?.modifiers ?? {};
                currentControllerModifiers = {};
                // Format-Detection: alte (flache) und neue (Layer-Wrapper)
                // Bindings akzeptieren — das Backend persistiert das neue
                // Format, aber alte Profile koennten noch flach sein.
                for (const slot of ["l1", "r1", "l2", "r2"] as const) {
                    const raw = freshMods[slot];
                    if (!raw || typeof raw !== "object") continue;
                    const obj = raw as Record<string, unknown>;
                    const hasLayerShape = "enabled" in obj || "buttons" in obj;
                    if (hasLayerShape) {
                        const enabled = typeof obj.enabled === "boolean" ? obj.enabled : true;
                        const buttons = (obj.buttons && typeof obj.buttons === "object")
                            ? { ...(obj.buttons as ControllerButtonOverride) }
                            : undefined;
                        currentControllerModifiers[slot] = { enabled, ...(buttons ? { buttons } : {}) };
                    }
                    else {
                        currentControllerModifiers[slot] = { enabled: true, buttons: { ...(raw as ControllerButtonOverride) } };
                    }
                }
                rebuildModifierPanel();
            }
            catch (err) {
                logErr(err, "ControllerSave");
                showToast(t("controller.saveFailed" as TranslationKey), "error");
            }
            finally {
                saveBtn.disabled = false;
            }
        });

        footer.append(resetAllBtn, saveBtn);
        controllerPane.append(footer);

        // Live-Anzeige: gepollt aus dem Renderer (Launcher-Window). Laeuft, bis
        // der Tab gewechselt oder das Modal geschlossen wird. Der Loop swappt
        // ggf. das SVG-Layout und ruft dann onStyleSwapped auf, damit wir die
        // Hover-Listener neu binden.
        controllerLiveCleanup = startControllerLiveLoop(svgRefs, {
            getUserStyle: () => userStyle,
            onStyleSwapped: () => wireSvgListeners(),
        });
    }

    // Load and render plugins list

    async function loadPluginsList() {

        pluginsList.innerHTML = "";
        pluginsEmpty.style.display = "none";
        const loadingEl = el("div", "pluginsLoading muted", t("config.plugins.status.loading" as TranslationKey));
        pluginsList.append(loadingEl);
        try {
            const plugins = await window.api.pluginsListAll();
            pluginsList.innerHTML = "";
            if (!plugins || plugins.length === 0) {
                pluginsEmpty.style.display = "";
                return;
            }
            for (const plugin of plugins) {
                const isKillfeed = plugin.id === "killfeed";
                const card = el("div", "pluginCard");
                const cardHeader = el("div", "pluginCardHeader");
                const info = el("div", "pluginInfo");
                const name = el("div", "pluginName", plugin.name);
                const version = el("span", "pluginVersion", `v${plugin.version}`);
                name.append(version);
                if (plugin.author) {
                    const author = el("div", "pluginAuthor muted", plugin.author);
                    info.append(name, author);
                } else {
                    info.append(name);
                }
                const status = el("div", `pluginStatus ${getStatusClass(plugin.state, plugin.enabled)}`,
                    getStatusText(plugin.state, plugin.enabled));
                cardHeader.append(info, status);
                // Try to get translated description, fall back to manifest description
                const descKey = `plugin.${plugin.id}.description` as TranslationKey;
                const translatedDesc = t(descKey);
                const descText = translatedDesc !== descKey ? translatedDesc : plugin.description;
                if (descText) {
                    const desc = el("div", "pluginDescription muted", descText);
                    card.append(cardHeader, desc);
                } else {
                    card.append(cardHeader);
                }
                // Action buttons
                const actions = el("div", "pluginActions");
                const isQuestGuide = plugin.id === "questguide";
                if (!isKillfeed && !isQuestGuide && plugin.hasSettingsUI && plugin.permissions?.includes("settings:ui") && plugin.enabled) {
                    const uiBtn = el("button", "btn pluginBtn", t("config.plugins.openUI" as TranslationKey));
                    uiBtn.addEventListener("click", async () => {
                        uiBtn.disabled = true;
                        try {
                            await window.api.pluginsOpenSettingsWindow(plugin.id);
                        } catch (err) {
                            showToast(String(err), "error");
                        } finally {
                            uiBtn.disabled = false;
                        }
                    });
                    actions.append(uiBtn);
                }
                if (plugin.enabled) {
                    const disableBtn = el("button", "btn pluginBtn", t("config.plugins.disable" as TranslationKey));
                    disableBtn.addEventListener("click", async () => {
                        disableBtn.disabled = true;
                        const result = await window.api.pluginsDisable(plugin.id);
                        if (result.success) {
                            showToast(`${plugin.name}: ${t("config.plugins.pluginDisabled" as TranslationKey)}`, "success");
                            loadPluginsList();
                        } else {
                            showToast(result.error || t("config.plugins.pluginError" as TranslationKey), "error");
                            disableBtn.disabled = false;
                        }
                    });
                    actions.append(disableBtn);
                } else {
                    const enableBtn = el("button", "btn primary pluginBtn", t("config.plugins.enable" as TranslationKey));
                    enableBtn.addEventListener("click", async () => {
                        enableBtn.disabled = true;
                        const result = await window.api.pluginsEnable(plugin.id);
                        if (result.success) {
                            showToast(`${plugin.name}: ${t("config.plugins.pluginEnabled" as TranslationKey)}`, "success");
                            loadPluginsList();
                        } else {
                            showToast(result.error || t("config.plugins.pluginError" as TranslationKey), "error");
                            enableBtn.disabled = false;
                        }
                    });
                    actions.append(enableBtn);
                }
                card.append(actions);
                // Error display
                if (!isKillfeed && plugin.error) {
                    const errorEl = el("div", "pluginError", plugin.error);
                    card.append(errorEl);
                }
                pluginsList.append(card);
            }
        } catch (err) {
            pluginsList.innerHTML = "";
            const errorEl = el("div", "pluginsError muted", String(err));
            pluginsList.append(errorEl);
        }
    }

    function getStatusClass(state: string, enabled: boolean): string {

        if (!enabled) return "disabled";
        if (state === "running") return "running";
        if (state === "error") return "error";
        if (state === "loading" || state === "starting" || state === "initializing") return "loading";
        return "stopped";
    }

    function getStatusText(state: string, enabled: boolean): string {

        if (!enabled) return t("config.plugins.status.disabled");
        if (state === "running") return t("config.plugins.status.ready");
        if (state === "error") return t("config.plugins.status.error");
        if (state === "loading" || state === "starting" || state === "initializing") return t("config.plugins.status.working");
        return t("config.plugins.status.stopped");
    }
    // Tab state is now initialized via selectSidebarItem() below
    modal.append(headerEl, body);
    overlay.append(modal);

    const onKey = (e: KeyboardEvent) => {

        if (e.key === "Escape")
            close();
    };

    const close = () => {

        if (controllerLiveCleanup) {
            controllerLiveCleanup();
            controllerLiveCleanup = null;
        }
        overlay.remove();
        document.removeEventListener("keydown", onKey);
        const currentHex = isTabActiveColorManual ? lastTabActiveHex : null;
        if (currentHex) {
            setTabActiveColor(currentHex, { manual: true, persist: true });
        }
        pushThemeUpdate(currentTheme, {
            ...getActiveThemeColors(),
            tabActive: currentHex ?? getActiveThemeColors().tabActive,
        });
    };
    headerClose.addEventListener("click", () => close());
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay)
            close();
    });
    document.addEventListener("keydown", onKey);

    function getThemeColors(themeId: string): ThemeColors {

        if (isThemeKey(themeId)) {
            const cached = getThemeColorsFromStore(themeId);
            if (cached) return { ...cached };
        }
        if (isThemeKey(themeId) && currentTheme === themeId) {
            const colors = getActiveThemeColors();
            const builtin = THEMES.find((t) => t.id === themeId);
            if (builtin?.tabActive) {
                colors.tabActive = builtin.tabActive;
            }
            return colors;
        }
        const builtin = THEMES.find((t) => t.id === themeId);
        if (builtin?.tabActive) {
            return { ...FALLBACK_THEME_COLORS, tabActive: builtin.tabActive };
        }
        return { ...FALLBACK_THEME_COLORS };
    }
    // Style rendering is now driven by selectSidebarItem

    function buildThemeGrid() {

        const grid = el("div", "themeGrid");
        const themeTitle = (theme: ThemeDefinition) => theme.nameKey ? t(theme.nameKey) : theme.name ?? theme.id;
        const themeDescription = (theme: ThemeDefinition) => theme.descriptionKey ? t(theme.descriptionKey) : theme.description ?? "";
        for (const theme of THEMES) {
            const card = el("div", "themeCard");
            const cardHeader = el("div", "themeCardHeader");
            const titleGroup = el("div", "themeCardTitleGroup");
            const title = el("div", "themeName", themeTitle(theme));
            const badge = el("span", "themeBadge", t("config.theme.active"));
            titleGroup.append(title);
            if (theme.id === currentTheme)
                titleGroup.append(badge);
            const btn = el(
                "button",
                "btn primary themeSelectBtn",
                theme.id === currentTheme ? t("config.theme.active") : t("config.theme.use")
            ) as HTMLButtonElement;
            cardHeader.append(titleGroup, btn);
            const desc = el("div", "themeDescription", themeDescription(theme));
            const swatches = el("div", "themeSwatches");
            for (const color of theme.swatches ?? []) {
                const sw = el("div", "themeSwatch");
                sw.style.background = color;
                swatches.append(sw);
            }
            btn.disabled = theme.id === currentTheme;
            btn.addEventListener("click", () => {
                if (theme.id === currentTheme)
                    return;
                applyTheme(theme.id);
                const colors = getThemeColors(theme.id);
                pushThemeUpdate(theme.id, colors);
                renderStyleContent("theme");
                showToast(`${t("config.theme.applied")}: ${themeTitle(theme)}`, "success");
            });
            card.append(cardHeader, desc, swatches);
            grid.append(card);
        }
        return grid;
    }

    function buildTabColorSection() {

        const tabColorSection = el("div", "tabColorSection");
        const tabColorHeader = el("div", "themeName", t("config.tab.style.activeTabColor"));
        const tabColorDesc = el("div", "themeDescription", t("config.theme.customDesc"));
        const colorPalette = el("div", "colorPalette");
        const colorCategories: { name: string; nameKey?: string; colors: string[] }[] = [
            {
                name: "Greens",
                nameKey: "config.color.greens",
                colors: ["#2ecc71", "#27ae60", "#1abc9c", "#16a085", "#00d4aa", "#00e676", "#69f0ae", "#b9f6ca", "#a8e6cf", "#88d498", "#56ab2f", "#a8caba", "#3d9970", "#2d6a4f"]
            },
            {
                name: "Blues",
                nameKey: "config.color.blues",
                colors: ["#3498db", "#2980b9", "#0984e3", "#74b9ff", "#00cec9", "#81ecec", "#48dbfb", "#0abde3", "#54a0ff", "#5f27cd", "#341f97", "#00b4d8", "#0077b6", "#023e8a"]
            },
            {
                name: "Purples",
                nameKey: "config.color.purples",
                colors: ["#9b59b6", "#8e44ad", "#a55eea", "#d63384", "#e056fd", "#be2edd", "#f368e0", "#ff9ff3", "#c44569", "#cf6a87", "#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd"]
            },
            {
                name: "Pinks & Reds",
                nameKey: "config.color.pinksReds",
                colors: ["#e74c3c", "#c0392b", "#ff6b6b", "#ee5a5a", "#fc5c65", "#eb3b5a", "#ff4757", "#ff6348", "#ff7675", "#fab1a0", "#fd79a8", "#f8a5c2", "#e84393", "#b83280"]
            },
            {
                name: "Oranges & Yellows",
                nameKey: "config.color.orangesYellows",
                colors: ["#f39c12", "#e67e22", "#d35400", "#f7ba48", "#f3c65d", "#e0ac3a", "#ffc312", "#f9ca24", "#fdcb6e", "#ffeaa7", "#ff9f43", "#ee5a24", "#fa8231", "#fed330"]
            },
            {
                name: "Cyans & Teals",
                nameKey: "config.color.cyansTeal",
                colors: ["#00bcd4", "#00acc1", "#0097a7", "#26c6da", "#4dd0e1", "#80deea", "#18dcff", "#7efff5", "#00cec9", "#55efc4", "#00b894", "#20bf6b", "#26de81", "#0fb9b1"]
            },
            {
                name: "Neons",
                nameKey: "config.color.neons",
                colors: ["#ff00ff", "#00ffff", "#ff00aa", "#00ff88", "#ffff00", "#ff3366", "#33ff99", "#9933ff", "#ff6600", "#00ff00", "#ff0066", "#66ff00", "#0066ff", "#ff0099"]
            },
            {
                name: "Pastels",
                nameKey: "config.color.pastels",
                colors: ["#dfe6e9", "#b2bec3", "#a29bfe", "#74b9ff", "#55efc4", "#81ecec", "#ffeaa7", "#fab1a0", "#ff7675", "#fd79a8", "#e17055", "#fdcb6e", "#00b894", "#6c5ce7"]
            }
        ];
        const gradients: { name: string; gradient: string; baseColor: string }[] = [
            { name: "Sunset", gradient: "linear-gradient(135deg, #f093fb, #f5576c)", baseColor: "#f5576c" },
            { name: "Ocean", gradient: "linear-gradient(135deg, #4facfe, #00f2fe)", baseColor: "#4facfe" },
            { name: "Aurora", gradient: "linear-gradient(135deg, #43e97b, #38f9d7)", baseColor: "#43e97b" },
            { name: "Neon Pink", gradient: "linear-gradient(135deg, #f953c6, #b91d73)", baseColor: "#f953c6" },
            { name: "Electric", gradient: "linear-gradient(135deg, #0066ff, #00ffcc)", baseColor: "#0066ff" },
            { name: "Fire", gradient: "linear-gradient(135deg, #f12711, #f5af19)", baseColor: "#f5af19" },
            { name: "Purple Haze", gradient: "linear-gradient(135deg, #7f00ff, #e100ff)", baseColor: "#7f00ff" },
            { name: "Lime", gradient: "linear-gradient(135deg, #b4ec51, #429321)", baseColor: "#b4ec51" },
            { name: "Cotton Candy", gradient: "linear-gradient(135deg, #ffecd2, #fcb69f)", baseColor: "#fcb69f" },
            { name: "Midnight", gradient: "linear-gradient(135deg, #232526, #414345)", baseColor: "#414345" },
            { name: "Royal", gradient: "linear-gradient(135deg, #141e30, #243b55)", baseColor: "#243b55" },
            { name: "Peach", gradient: "linear-gradient(135deg, #ffecd2, #fcb69f)", baseColor: "#fcb69f" },
            { name: "Aqua", gradient: "linear-gradient(135deg, #13547a, #80d0c7)", baseColor: "#80d0c7" },
            { name: "Berry", gradient: "linear-gradient(135deg, #8e2de2, #4a00e0)", baseColor: "#8e2de2" },
            { name: "Cyber", gradient: "linear-gradient(135deg, #00d2ff, #3a7bd5)", baseColor: "#00d2ff" },
            { name: "Warm", gradient: "linear-gradient(135deg, #f7971e, #ffd200)", baseColor: "#f7971e" },
            { name: "Cool", gradient: "linear-gradient(135deg, #2193b0, #6dd5ed)", baseColor: "#2193b0" },
            { name: "Emerald", gradient: "linear-gradient(135deg, #11998e, #38ef7d)", baseColor: "#38ef7d" },
            { name: "Rose Gold", gradient: "linear-gradient(135deg, #f4c4f3, #fc67fa)", baseColor: "#fc67fa" },
            { name: "Titanium", gradient: "linear-gradient(135deg, #283048, #859398)", baseColor: "#859398" }
        ];
        const tabColorInput = document.createElement("input");
        tabColorInput.type = "color";
        const setActiveSwatch = (btn: HTMLButtonElement | null, hex: string) => {
            const stroke = getComputedStyle(document.documentElement).getPropertyValue("--stroke")?.trim() || "#3f4046";
            const norm = normalizeHex(hex);
            for (const swatch of Array.from(colorPalette.querySelectorAll(".tabColorSwatch"))) {
                const elBtn = swatch as HTMLButtonElement;
                elBtn.classList.remove("active");
                elBtn.style.borderColor = stroke;
                elBtn.style.boxShadow = "";
            }
            const target = btn ?? (colorPalette.querySelector(`[data-color="${norm}"]`) as HTMLButtonElement | null);
            if (target) {
                target.classList.add("active");
                target.style.borderColor = `rgba(${getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb") || "255,255,255"},0.9)`;
                target.style.boxShadow = `0 0 0 3px rgba(${getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb") || "255,255,255"},0.6),
                    0 0 0 6px rgba(${getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb") || "255,255,255"},0.16),
                    0 2px 8px rgba(0,0,0,0.3)`;
            }
        };
        const applyTabColor = (hex: string, clicked?: HTMLButtonElement | null) => {
            tabColorHeader.textContent = `${t("config.tab.style.activeTabColor")}: ${hex.toUpperCase()}`;
            setTabActiveColor(hex, { manual: true, persist: true });
            pushThemeUpdate(currentTheme, { ...getActiveThemeColors(), tabActive: hex });
            tabColorInput.value = rgbToHex(hex);
            setActiveSwatch(clicked ?? null, rgbToHex(hex));
            showToast(t("config.theme.applied"), "success");
        };
        const syncSwatchState = () => {
            const currentHex = (isTabActiveColorManual && lastTabActiveHex) ? lastTabActiveHex : rgbToHex(getActiveThemeColors().tabActive);
            tabColorInput.value = currentHex;
            tabColorHeader.textContent = `${t("config.tab.style.activeTabColor")}: ${currentHex.toUpperCase()}`;
            setActiveSwatch(null, currentHex);
        };
        tabColorInput.value = (isTabActiveColorManual && lastTabActiveHex) ? lastTabActiveHex : rgbToHex(getActiveThemeColors().tabActive);
        for (const category of colorCategories) {
            const categorySection = el("div", "colorCategory");
            const categoryHeader = el("div", "colorCategoryHeader", category.nameKey ? t(category.nameKey as TranslationKey) : category.name);
            const swatchRow = el("div", "tabColorSwatches");
            for (const color of category.colors) {
                const b = el("button", "tabColorSwatch");
                b.type = "button";
                b.style.background = color;
                b.dataset.color = normalizeHex(color);
                b.addEventListener("click", () => applyTabColor(color, b));
                swatchRow.append(b);
            }
            categorySection.append(categoryHeader, swatchRow);
            colorPalette.append(categorySection);
        }
        const gradientSection = el("div", "colorCategory gradientCategory");
        const gradientHeader = el("div", "colorCategoryHeader", t("config.color.gradients" as TranslationKey) || "Gradients");
        const gradientRow = el("div", "tabColorSwatches gradientSwatches");
        for (const grad of gradients) {
            const b = el("button", "tabColorSwatch gradientSwatch");
            b.type = "button";
            b.style.background = grad.gradient;
            b.dataset.color = normalizeHex(grad.baseColor);
            b.title = grad.name;
            b.addEventListener("click", () => applyTabColor(grad.baseColor, b));
            gradientRow.append(b);
        }
        gradientSection.append(gradientHeader, gradientRow);
        colorPalette.append(gradientSection);
        tabColorInput.addEventListener("input", () => applyTabColor(tabColorInput.value));
        const resetTabColor = el("button", "btn", t("config.tabActive.reset"));
        resetTabColor.addEventListener("click", () => {
            setTabActiveColor(null, { manual: false });
            persistTabActiveColor(null);
            applyTheme(currentTheme);
            pushThemeUpdate(currentTheme, getActiveThemeColors());
            syncSwatchState();
        });
        const tabColorControls = el("div", "tabColorControls");
        tabColorControls.append(tabColorInput, resetTabColor);
        tabColorSection.append(tabColorHeader, tabColorDesc, colorPalette, tabColorControls);
        syncSwatchState();
        return tabColorSection;
    }

    function renderStyleContent(mode: "theme" | "tabcolor") {

        if (mode === "tabcolor") {
            tabColorPane.innerHTML = "";
            tabColorPane.append(buildTabColorSection());
        } else {
            styleContentBody.innerHTML = "";
            styleContentBody.append(buildThemeGrid());
        }
    }

    // Map defaultStyleTab to sidebar ID
    const initialSidebar: SidebarId = defaultStyleTab === "tabActive" ? "client.tabcolor"
        : defaultTab === "client" ? "client.display"
        : defaultTab === "plugins" ? "plugins"
        : defaultTab === "patchnotes" ? "patchnotes"
        : defaultTab === "docs" ? "docs"
        : defaultTab === "support" ? "support"
        : defaultTab === "style" ? "client.theme"
        : "client.display";
    selectSidebarItem(initialSidebar);
    document.body.append(overlay);


}

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
    content.append(displayPane, layoutPane, behaviorPane, themePane, tabColorPane, fontPane, hotkeysPane, pluginsPane, patchnotesPane, docsPane, supportPane);

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
    }
    for (const [id, btn] of allSidebarBtns) {
        btn.addEventListener("click", () => selectSidebarItem(id));
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

import { THEMES, type ThemeDefinition } from "../../themes";
import pkg from "../../../package.json";
import { DEFAULT_LOCALE, type Locale, type TranslationKey } from "../../i18n/translations";
import type { TabLayout, ClientSettings } from "../../shared/schemas";
import { DEFAULT_HOTKEYS, formatHotkey, normalizeHotkeySettings, sanitizeHotkeyChord } from "../../shared/hotkeys";
import { logErr } from "../../shared/logger";
import { GRID_CONFIGS, LAYOUT as LAYOUT_CONST } from "../../shared/constants";
import {
    tabLayoutCompact,
    tabLayoutChips1,
    tabLayoutChips2,
    tabLayoutMiniGrid,
    DONATION_URL,
    JOB_ICONS,
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
    layoutTabDisplay,
    setLayoutTabDisplay,
    normalizeTabLayoutDisplay,
    hideSessionViews,
    showSessionViews,
    sequentialGridLoad,
    setSequentialGridLoad,
    autoSaveLayouts,
    setAutoSaveLayouts,
    onLayoutTabDisplayChange,
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
    const tabs = el("div", "configTabs");
    const tabStyle = el("button", "configTab", t("config.tab.style"));
    const tabPlugins = el("button", "configTab", t("config.tab.plugins" as TranslationKey));
    const tabClient = el("button", "configTab", t("config.tab.client" as TranslationKey));
    const tabPatchnotes = el("button", "configTab", t("config.tab.patchnotes" as TranslationKey));
    const tabDocs = el("button", "configTab", t("config.tab.docs" as TranslationKey));
    const tabSupport = el("button", "configTab", t("config.tab.support" as TranslationKey));
    tabs.append(tabStyle, tabPlugins, tabClient, tabPatchnotes, tabDocs, tabSupport);
    const content = el("div", "configContent");
    // Style pane
    const styleTabs = el("div", "configSubTabs");
    const subTabTheme = el("button", "configSubTab", t("config.tab.theme"));
    const subTabTabColor = el("button", "configSubTab", t("config.tab.style.activeTabColor"));
    styleTabs.append(subTabTheme, subTabTabColor);
    const styleContentBody = el("div", "styleContent");
    const stylePane = el("div", "stylePane configPaneCard");
    stylePane.append(styleTabs, styleContentBody);
    // Plugins pane
    const pluginsPane = el("div", "pluginsPane configPaneCard");
    const pluginsTitle = el("div", "pluginsTitle", t("config.plugins.title" as TranslationKey));
    const pluginsList = el("div", "pluginsList");
    const pluginsEmpty = el("div", "pluginsEmpty muted", t("config.plugins.empty" as TranslationKey));
    pluginsPane.append(pluginsTitle, pluginsList, pluginsEmpty);
    const clientPane = el("div", "clientPane configPaneCard");
    const clientSection = el("div", "section clientSection");
    const clientTitle = el("div", "sectionTitle", t("config.tab.client"));
    const clientRow = el("div", "row clientControlRow");
    const fullscreenLabel = document.createElement("label");
    fullscreenLabel.className = "checkbox";
    const fullscreenCheckbox = document.createElement("input");
    fullscreenCheckbox.type = "checkbox";
    const fullscreenText = document.createElement("span");
    fullscreenText.textContent = t("config.client.fullscreen");
    fullscreenLabel.append(fullscreenCheckbox, fullscreenText);
    clientRow.append(fullscreenLabel);
    const delayRow = el("div", "row clientControlRow clientDelayRow");
    const createNudgeButton = (label: string, onClick: () => void) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn";
        btn.style.padding = "6px 10px";
        btn.style.margin = "0 6px";
        btn.textContent = label;
        btn.addEventListener("click", onClick);
        return btn;
    };
    const delayLabelWrap = el("div", "rowLeft");
    const delayLabel = el("div", "rowName", t("config.client.layoutDelay"));
    const delayHint = el("div", "muted", "");
    delayLabelWrap.append(delayLabel, delayHint);
    const delayInputWrap = el("div", "rowActions");
    const delayInput = document.createElement("input");
    delayInput.type = "range";
    delayInput.min = "0";
    delayInput.max = "30";
    delayInput.step = "1";
    delayInput.className = "slider";
    delayInput.style.width = "220px";
    const delayValue = el("div", "sliderValue badge", "");
    const delayDecBtn = createNudgeButton("-1", () => {
        const current = Number.isFinite(delayInput.valueAsNumber) ? delayInput.valueAsNumber : Number(delayInput.value) || 0;
        const next = clampLayoutDelaySeconds(current - 1);
        delayInput.value = String(next);
        delayInput.dispatchEvent(new Event("change"));
    });
    const delayIncBtn = createNudgeButton("+1", () => {
        const current = Number.isFinite(delayInput.valueAsNumber) ? delayInput.valueAsNumber : Number(delayInput.value) || 0;
        const next = clampLayoutDelaySeconds(current + 1);
        delayInput.value = String(next);
        delayInput.dispatchEvent(new Event("change"));
    });
    delayInputWrap.append(delayDecBtn, delayInput, delayIncBtn, delayValue);
    delayRow.append(delayLabelWrap, delayInputWrap);
    // New: toggle sequential loading for grid/layout tabs
    const seqRow = el("div", "row clientControlRow clientSeqRow");
    const seqLabelWrap = el("div", "rowLeft");
    const seqLabel = el("div", "rowName", t("config.client.seqGridLoad"));
    const seqHint = el("div", "muted", t("config.client.seqGridLoad.hint"));
    seqLabelWrap.append(seqLabel, seqHint);
    const seqInputWrap = el("div", "rowActions");
    const seqCheckboxLabel = document.createElement("label");
    seqCheckboxLabel.className = "checkbox";
    const seqCheckbox = document.createElement("input");
    seqCheckbox.type = "checkbox";
    const seqText = document.createElement("span");
    seqText.textContent = t("config.client.seqGridLoad.label");
    seqCheckboxLabel.append(seqCheckbox, seqText);
    seqInputWrap.append(seqCheckboxLabel);
    seqRow.append(seqLabelWrap, seqInputWrap);
    const seqToggle = {
        get: () => seqCheckbox.checked,
        set: (val: boolean) => {
            seqCheckbox.checked = !!val;
        },
    };
    const tabDisplayRow = el("div", "row clientControlRow clientTabDisplayRow");
    const tabDisplayLabelWrap = el("div", "rowLeft");
    const tabDisplayLabel = el("div", "rowName", t("config.client.tabLayoutDisplay" as TranslationKey));
    const tabDisplayHint = el("div", "muted", t("config.client.tabLayoutDisplay.hint" as TranslationKey));
    tabDisplayLabelWrap.append(tabDisplayLabel, tabDisplayHint);
    const tabDisplayActions = el("div", "rowActions tabDisplayActions");
    const tabDisplaySelect = document.createElement("select");
    const tabDisplayPreview = document.createElement("img");
    tabDisplayPreview.className = "tabLayoutPreview";
    tabDisplayPreview.src = tabLayoutCompact;
    tabDisplayPreview.alt = "Compact layout preview";
    tabDisplayPreview.loading = "lazy";
    tabDisplayPreview.decoding = "async";
    const tabDisplayControl = el("div", "tabDisplayControl");
    tabDisplaySelect.className = "select";
    const tabDisplayOptions: Array<{ value: ClientSettings["tabLayoutDisplay"]; label: TranslationKey }> = [
        { value: "compact", label: "config.client.tabLayoutDisplay.compact" as TranslationKey },
        { value: "grouped", label: "config.client.tabLayoutDisplay.grouped" as TranslationKey },
        { value: "separated", label: "config.client.tabLayoutDisplay.separated" as TranslationKey },
        { value: "mini-grid", label: "config.client.tabLayoutDisplay.mini-grid" as TranslationKey },
    ];
    for (const opt of tabDisplayOptions) {
        const optionEl = document.createElement("option");
        optionEl.value = opt.value;
        optionEl.textContent = t(opt.label);
        tabDisplaySelect.append(optionEl);
    }
    tabDisplayControl.append(tabDisplaySelect);
    const TAB_DISPLAY_PREVIEWS: Record<string, string> = {
        "compact": tabLayoutCompact,
        "grouped": tabLayoutChips1,
        "separated": tabLayoutChips2,
        "mini-grid": tabLayoutMiniGrid,
    };

    const renderTabLayoutPreview = () => {
        tabDisplayPreview.src = TAB_DISPLAY_PREVIEWS[layoutTabDisplay] ?? tabLayoutCompact;
        tabDisplayPreview.hidden = false;
    };
    onLayoutTabDisplayChange(renderTabLayoutPreview);
    renderTabLayoutPreview();
    tabDisplayActions.append(tabDisplayControl, tabDisplayPreview);
    tabDisplayRow.append(tabDisplayLabelWrap, tabDisplayActions);
    const gridBorderRow = el("div", "row clientControlRow clientGridBorderRow");
    const gridBorderLabelWrap = el("div", "rowLeft");
    const gridBorderLabel = el("div", "rowName", t("config.client.gridActiveBorder" as TranslationKey));
    const gridBorderHint = el("div", "muted", t("config.client.gridActiveBorder.hint" as TranslationKey));
    gridBorderLabelWrap.append(gridBorderLabel, gridBorderHint);
    const gridBorderInputWrap = el("div", "rowActions");
    const gridBorderCheckboxLabel = document.createElement("label");
    gridBorderCheckboxLabel.className = "checkbox";
    const gridBorderCheckbox = document.createElement("input");
    gridBorderCheckbox.type = "checkbox";
    const gridBorderText = document.createElement("span");
    gridBorderText.textContent = t("config.client.gridActiveBorder.label" as TranslationKey);
    gridBorderCheckboxLabel.append(gridBorderCheckbox, gridBorderText);
    gridBorderInputWrap.append(gridBorderCheckboxLabel);
    gridBorderRow.append(gridBorderLabelWrap, gridBorderInputWrap);
    const gridBorderToggle = {
        get: () => gridBorderCheckbox.checked,
        set: (val: boolean) => {
            gridBorderCheckbox.checked = !!val;
        },
    };
    const autoSaveRow = el("div", "row clientControlRow clientAutoSaveRow");
    const autoSaveLabelWrap = el("div", "rowLeft");
    const autoSaveLabel = el("div", "rowName", t("config.client.layoutAutoSave" as TranslationKey));
    const autoSaveHint = el("div", "muted", t("config.client.layoutAutoSave.hint" as TranslationKey));
    autoSaveLabelWrap.append(autoSaveLabel, autoSaveHint);
    const autoSaveInputWrap = el("div", "rowActions");
    const autoSaveCheckboxLabel = document.createElement("label");
    autoSaveCheckboxLabel.className = "checkbox";
    const autoSaveCheckbox = document.createElement("input");
    autoSaveCheckbox.type = "checkbox";
    const autoSaveText = document.createElement("span");
    autoSaveText.textContent = t("config.client.layoutAutoSave.label" as TranslationKey);
    autoSaveCheckboxLabel.append(autoSaveCheckbox, autoSaveText);
    autoSaveInputWrap.append(autoSaveCheckboxLabel);
    autoSaveRow.append(autoSaveLabelWrap, autoSaveInputWrap);
    const autoSaveToggle = {
        get: () => autoSaveCheckbox.checked,
        set: (val: boolean) => {
            autoSaveCheckbox.checked = !!val;
        },
    };
    const uiPosRow = el("div", "row clientControlRow clientUiPosRow");
    const uiPosLabelWrap = el("div", "rowLeft");
    const uiPosLabel = el("div", "rowName", t("config.client.persistGameUiPositions" as TranslationKey));
    const uiPosHint = el("div", "muted", t("config.client.persistGameUiPositions.hint" as TranslationKey));
    uiPosLabelWrap.append(uiPosLabel, uiPosHint);
    const uiPosInputWrap = el("div", "rowActions");
    const uiPosCheckboxLabel = document.createElement("label");
    uiPosCheckboxLabel.className = "checkbox";
    const uiPosCheckbox = document.createElement("input");
    uiPosCheckbox.type = "checkbox";
    const uiPosText = document.createElement("span");
    uiPosText.textContent = t("config.client.persistGameUiPositions.label" as TranslationKey);
    uiPosCheckboxLabel.append(uiPosCheckbox, uiPosText);
    uiPosInputWrap.append(uiPosCheckboxLabel);
    uiPosRow.append(uiPosLabelWrap, uiPosInputWrap);
    const uiPosToggle = {
        get: () => uiPosCheckbox.checked,
        set: (val: boolean) => {
            uiPosCheckbox.checked = !!val;
        },
    };
    const toastRow = el("div", "row clientControlRow clientToastRow");
    const toastLabelWrap = el("div", "rowLeft");
    const toastLabel = el("div", "rowName", t("config.client.toastDuration"));
    const toastHint = el("div", "muted", t("config.client.toastDuration.hint"));
    toastLabelWrap.append(toastLabel, toastHint);
    const toastInputWrap = el("div", "rowActions");
    const toastInput = document.createElement("input");
    toastInput.type = "range";
    toastInput.min = "1";
    toastInput.max = "60";
    toastInput.step = "1";
    toastInput.className = "slider";
    toastInput.style.width = "220px";
    const toastValue = el("div", "sliderValue badge", "");
    toastInputWrap.append(toastInput, toastValue);
    toastRow.append(toastLabelWrap, toastInputWrap);
    const launcherWidthRow = el("div", "row clientControlRow clientLauncherWidthRow");
    const launcherWidthLabelWrap = el("div", "rowLeft");
    const launcherWidthLabel = el("div", "rowName", t("config.client.launcherWidth" as TranslationKey));
    const launcherWidthHint = el("div", "muted", "");
    launcherWidthLabelWrap.append(launcherWidthLabel, launcherWidthHint);
    const launcherWidthInputWrap = el("div", "rowActions");
    const launcherWidthInput = document.createElement("input");
    launcherWidthInput.type = "range";
    launcherWidthInput.min = String(LAYOUT_CONST.LAUNCHER_MIN_WIDTH);
    launcherWidthInput.max = String(LAYOUT_CONST.LAUNCHER_MAX_WIDTH);
    launcherWidthInput.step = "10";
    launcherWidthInput.className = "slider";
    launcherWidthInput.style.width = "220px";
    const launcherWidthValue = el("div", "sliderValue badge", "");
    const launcherWidthDecBtn = createNudgeButton("-10", () => {
        const current = Number.isFinite(launcherWidthInput.valueAsNumber)
            ? launcherWidthInput.valueAsNumber
            : Number(launcherWidthInput.value) || DEFAULT_CLIENT_SETTINGS.launcherWidth;
        const next = clampLauncherWidthPx(current - 10);
        launcherWidthInput.value = String(next);
        launcherWidthInput.dispatchEvent(new Event("change"));
    });
    const launcherWidthIncBtn = createNudgeButton("+10", () => {
        const current = Number.isFinite(launcherWidthInput.valueAsNumber)
            ? launcherWidthInput.valueAsNumber
            : Number(launcherWidthInput.value) || DEFAULT_CLIENT_SETTINGS.launcherWidth;
        const next = clampLauncherWidthPx(current + 10);
        launcherWidthInput.value = String(next);
        launcherWidthInput.dispatchEvent(new Event("change"));
    });
    launcherWidthInputWrap.append(launcherWidthDecBtn, launcherWidthInput, launcherWidthIncBtn, launcherWidthValue);
    launcherWidthRow.append(launcherWidthLabelWrap, launcherWidthInputWrap);
    const launcherHeightRow = el("div", "row clientControlRow clientLauncherHeightRow");
    const launcherHeightLabelWrap = el("div", "rowLeft");
    const launcherHeightLabel = el("div", "rowName", t("config.client.launcherHeight" as TranslationKey));
    const launcherHeightHint = el("div", "muted", "");
    launcherHeightLabelWrap.append(launcherHeightLabel, launcherHeightHint);
    const launcherHeightInputWrap = el("div", "rowActions");
    const launcherHeightInput = document.createElement("input");
    launcherHeightInput.type = "range";
    launcherHeightInput.min = String(LAYOUT_CONST.LAUNCHER_MIN_HEIGHT);
    launcherHeightInput.max = String(LAYOUT_CONST.LAUNCHER_MAX_HEIGHT);
    launcherHeightInput.step = "10";
    launcherHeightInput.className = "slider";
    launcherHeightInput.style.width = "220px";
    const launcherHeightValue = el("div", "sliderValue badge", "");
    const launcherHeightDecBtn = createNudgeButton("-10", () => {
        const current = Number.isFinite(launcherHeightInput.valueAsNumber)
            ? launcherHeightInput.valueAsNumber
            : Number(launcherHeightInput.value) || DEFAULT_CLIENT_SETTINGS.launcherHeight;
        const next = clampLauncherHeightPx(current - 10);
        launcherHeightInput.value = String(next);
        launcherHeightInput.dispatchEvent(new Event("change"));
    });
    const launcherHeightIncBtn = createNudgeButton("+10", () => {
        const current = Number.isFinite(launcherHeightInput.valueAsNumber)
            ? launcherHeightInput.valueAsNumber
            : Number(launcherHeightInput.value) || DEFAULT_CLIENT_SETTINGS.launcherHeight;
        const next = clampLauncherHeightPx(current + 10);
        launcherHeightInput.value = String(next);
        launcherHeightInput.dispatchEvent(new Event("change"));
    });
    launcherHeightInputWrap.append(launcherHeightDecBtn, launcherHeightInput, launcherHeightIncBtn, launcherHeightValue);
    launcherHeightRow.append(launcherHeightLabelWrap, launcherHeightInputWrap);
    const clientGrid = el("div", "clientGrid");
    clientGrid.append(
        clientRow,            // Fullscreen toggle
        launcherWidthRow,     // Launcher width
        launcherHeightRow,    // Launcher height
        delayRow,             // Layout delay / next tab
        seqRow,               // Sequential grid loading
        tabDisplayRow,        // Layout tab display mode
        gridBorderRow,        // Highlight active grid view
        autoSaveRow,          // Layout auto-save
        uiPosRow,             // Persist game UI positions
        toastRow              // Toast duration
    );
    clientSection.append(clientTitle, clientGrid);

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
    const hotkeySection = el("div", "section clientSection hotkeySection");
    const hotkeyTitle = el("div", "sectionTitle", t("config.client.hotkeys.title" as TranslationKey));
    hotkeySection.append(hotkeyTitle);
    const hotkeyRowsContainer = el("div", "hotkeyRows");
    hotkeySection.append(hotkeyRowsContainer);
    clientPane.append(clientSection, hotkeySection);

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
        window.api?.hotkeysResume?.().catch(() => undefined);
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
        const row = el("div", "row hotkeyRow");
        const left = el("div", "rowLeft");
        const label = el("div", "rowName", t(def.label));
        const hint = el("div", "muted", t(def.hint));
        left.append(label, hint);
        const actions = el("div", "rowActions hotkeyActions");
        const badge = el("div", "badge hotkeyBadge");
        const recordBtn = el("button", "btn primary", t("config.client.hotkeys.record" as TranslationKey));
        const clearBtn = el("button", "btn xBtn", "�");
        clearBtn.title = t("config.client.hotkeys.clear" as TranslationKey);
        clearBtn.setAttribute("aria-label", t("config.client.hotkeys.clear" as TranslationKey));
        actions.append(badge, clearBtn, recordBtn);
        row.append(left, actions);
        hotkeyRowsContainer.append(row);
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
            window.api?.hotkeysPause?.().catch(() => undefined);
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
    // Tab content
    content.append(stylePane, pluginsPane, clientPane, patchnotesPane, docsPane, supportPane);

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
        gridBorderToggle.set(settings.gridActiveBorder ?? DEFAULT_CLIENT_SETTINGS.gridActiveBorder);
        autoSaveToggle.set(settings.autoSaveLayouts ?? DEFAULT_CLIENT_SETTINGS.autoSaveLayouts);
        setAutoSaveLayouts(settings.autoSaveLayouts ?? DEFAULT_CLIENT_SETTINGS.autoSaveLayouts);
        uiPosToggle.set(settings.persistGameUiPositions ?? DEFAULT_CLIENT_SETTINGS.persistGameUiPositions);
        if (revisionAtRequest === hotkeyRevision) {
            applyHotkeyState(settings);
        }
    };
    refreshClientSettings().catch(() => undefined);
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
    uiPosCheckbox.addEventListener("change", async () => {
        const next = !!uiPosCheckbox.checked;
        try {
            await patchClientSettings({ persistGameUiPositions: next });
            showToast(t("config.client.persistGameUiPositionsSaved" as TranslationKey), "success");
        }
        catch (err) {
            showToast(String(err), "error");
            const current = await loadClientSettings();
            uiPosToggle.set(current?.persistGameUiPositions ?? DEFAULT_CLIENT_SETTINGS.persistGameUiPositions);
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
    body.append(tabs, content);
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
                return `<img class="docImage" src="${fullSrc}" alt="${escapeHtml(alt)}" loading="lazy">`;
            }
        );
        // Links [text](url)
        html = html.replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            (_match, text, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`
        );
        // Tables (simple markdown tables)
        html = html.replace(/^\|(.+)\|$/gm, (match) => {
            const cells = match.slice(1, -1).split("|").map(c => c.trim());
            const isHeader = cells.every(c => /^-+$/.test(c));
            if (isHeader) return ""; // Skip separator row
            const cellTag = "td";
            const cellsHtml = cells.map(c => `<${cellTag}>${c}</${cellTag}>`).join("");
            return `<tr>${cellsHtml}</tr>`;
        });
        // Wrap table rows
        html = html.replace(/(<tr>.*<\/tr>\n?)+/g, (match) => `<table class="docTable">${match}</table>`);
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

    function selectMainTab(tab: "style" | "plugins" | "client" | "patchnotes" | "docs" | "support") {

        tabStyle.classList.toggle("active", tab === "style");
        tabPlugins.classList.toggle("active", tab === "plugins");
        tabClient.classList.toggle("active", tab === "client");
        tabPatchnotes.classList.toggle("active", tab === "patchnotes");
        tabDocs.classList.toggle("active", tab === "docs");
        tabSupport.classList.toggle("active", tab === "support");
        stylePane.style.display = tab === "style" ? "" : "none";
        pluginsPane.style.display = tab === "plugins" ? "" : "none";
        clientPane.style.display = tab === "client" ? "" : "none";
        patchnotesPane.style.display = tab === "patchnotes" ? "" : "none";
        docsPane.style.display = tab === "docs" ? "" : "none";
        supportPane.style.display = tab === "support" ? "" : "none";
        if (tab === "plugins") {
            loadPluginsList();
        }
        if (tab === "patchnotes") {
            loadPatchnotes();
        }
        if (tab === "docs") {
            loadDocumentation();
        }
    }
    tabStyle.addEventListener("click", () => selectMainTab("style"));
    tabPlugins.addEventListener("click", () => selectMainTab("plugins"));
    tabClient.addEventListener("click", () => selectMainTab("client"));
    tabPatchnotes.addEventListener("click", () => selectMainTab("patchnotes"));
    tabDocs.addEventListener("click", () => selectMainTab("docs"));
    tabSupport.addEventListener("click", () => selectMainTab("support"));
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
                if (!isKillfeed && plugin.hasSettingsUI && plugin.permissions?.includes("settings:ui") && plugin.enabled) {
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
    // Initialize tab state
    selectMainTab(defaultTab);
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

        if (isThemeKey(themeId) && themeColorCache[themeId])
            return { ...themeColorCache[themeId]! };
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
    let activeStyleSubTab: "theme" | "tabActive" = defaultStyleTab;

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
                selectStyleSubTab("theme");
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

    function renderStyleContent() {

        styleContentBody.innerHTML = "";
        if (activeStyleSubTab === "tabActive") {
            styleContentBody.append(buildTabColorSection());
        }
        else {
            styleContentBody.append(buildThemeGrid());
        }
    }

    function selectStyleSubTab(tab: "theme" | "tabActive") {

        activeStyleSubTab = tab;
        subTabTheme.classList.toggle("active", tab === "theme");
        subTabTabColor.classList.toggle("active", tab === "tabActive");
        renderStyleContent();
    }
    subTabTheme.addEventListener("click", () => selectStyleSubTab("theme"));
    subTabTabColor.addEventListener("click", () => selectStyleSubTab("tabActive"));
    selectStyleSubTab(defaultStyleTab);
    document.body.append(overlay);


}

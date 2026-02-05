import { THEMES, type ThemeDefinition } from "../themes";
import pkg from "../../package.json";
import { DEFAULT_LOCALE, getTips, type Locale, type TranslationKey } from "../i18n/translations";
import type { TabLayout, ClientSettings } from "../shared/schemas";
import { DEFAULT_HOTKEYS, formatHotkey, normalizeHotkeySettings, sanitizeHotkeyChord } from "../shared/hotkeys";
import { logErr } from "../shared/logger";
import { GRID_CONFIGS, LAYOUT as LAYOUT_CONST } from "../shared/constants";
import {
    aibattGold,
    supporterIcon,
    flyffuniverseIcon,
    flyffipediaIcon,
    flyffulatorIcon,
    reskillIcon,
    tabLayoutCompact,
    tabLayoutChips1,
    tabLayoutChips2,
    tabLayoutMiniGrid,
    discordIcon,
    githubIcon,
    settingsIcon,
    GITHUB_REPO_URL,
    DONATION_URL,
    NEWS_BASE_URL,
    FLAG_ICONS,
    JOB_ICONS,
} from "./constants";
import {
    type ThemeColors,
    currentTheme,
    isThemeKey,
    FALLBACK_THEME_COLORS,
    applyTheme,
    pushThemeUpdate,
    getActiveThemeColors,
    getThemeColors,
    hexToRgb,
    rgbToHex,
    normalizeHex,
    setTabActiveColor,
    persistTabActiveColor,
    lastTabActiveHex,
    isTabActiveColorManual,
    getUpdateAvailable,
} from "./theme";
import { t, currentLocale, setLocale } from "./i18n";
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
    onLayoutTabDisplayChange,
    normalizeTabLayoutDisplay,
    hideSessionViews,
    showSessionViews,
    sequentialGridLoad,
    setSequentialGridLoad,
    autoSaveLayouts,
    setAutoSaveLayouts,
} from "./settings";
import { qs, el, clear, jobIconSrc, createJobIcon, decorateJobSelect, showToast, withTimeout, fetchTabLayouts, createWebview } from "./dom-utils";

export let langMenuCloser: ((e: MouseEvent) => void) | null = null;

export async function renderLauncher(root: HTMLElement) {



    clear(root);



    root.className = "launcherRoot";



    const overlayDisabled = false;



    let overlayClearedOnce = false;



    if (langMenuCloser) {



        document.removeEventListener("click", langMenuCloser);



        langMenuCloser = null;



    }



    const header = el("div", "topbar");



            type JobOption = {



                value: string;



                label: string;



                disabled?: boolean;



            };



        const jobOptions: JobOption[] = [



        { value: "", label: t("job.choose") },



        { value: "Vagrant", label: "Vagrant" },



        { value: "__sep1", label: "--- 1. Job ---", disabled: true },



        { value: "Assist", label: "Assist" },



        { value: "Acrobat", label: "Acrobat" },



        { value: "Mercenary", label: "Mercenary" },



        { value: "Magician", label: "Magician" },



        { value: "__sep2", label: "--- 2. Job ---", disabled: true },



        { value: "Ringmaster", label: "Ringmaster" },



        { value: "Billposter", label: "Billposter" },



        { value: "Blade", label: "Blade" },



        { value: "Knight", label: "Knight" },



        { value: "Ranger", label: "Ranger" },



        { value: "Jester", label: "Jester" },



        { value: "Elementor", label: "Elementor" },



        { value: "Psykeeper", label: "Psykeeper" },



        { value: "__sep3", label: "--- 3. Job ---", disabled: true },



        { value: "Templar", label: "Templar" },



        { value: "Forcemaster", label: "Forcemaster" },



        { value: "Seraph", label: "Seraph" },



        { value: "Mentalist", label: "Mentalist" },



        { value: "Slayer", label: "Slayer" },



        { value: "Arcanist", label: "Arcanist" },



        { value: "Harlequin", label: "Harlequin" },



        { value: "Crackshooter", label: "Crackshooter" },



    ];



    const tips = getTips(currentLocale);



    function renderJobOptions(select: HTMLSelectElement, selectedValue: string | null = null) {



        select.innerHTML = "";



        for (const j of jobOptions) {



            const opt = document.createElement("option");



            opt.value = j.disabled ? "" : j.value;



            opt.textContent = j.label;



            if (j.disabled)



                opt.disabled = true;



            select.append(opt);



        }



        select.value = selectedValue ?? "";



        decorateJobSelect(select);



    }



    function snapshotThemeVars(): Record<string, string> {



        const colors = getActiveThemeColors();



        const vars: Record<string, string> = {



            "--bg": colors.bg,



            "--panel": colors.panel,



            "--panel2": colors.panel2,



            "--stroke": colors.stroke,



            "--text": colors.text,



            "--muted": colors.muted,



            "--blue": colors.blue,



            "--blue2": colors.blue2,



            "--danger": colors.danger,



            "--green": colors.green,



            "--accent-rgb": hexToRgb(colors.accent) ?? "",



            "--danger-rgb": hexToRgb(colors.danger) ?? "",



            "--green-rgb": hexToRgb(colors.green) ?? "",



            "--tab-active-rgb": hexToRgb(colors.tabActive ?? colors.green) ?? "",



        };



        const computed = getComputedStyle(document.documentElement);



        for (const [key, value] of Object.entries(vars)) {



            if (!value) {



                const fallback = computed.getPropertyValue(key);



                if (fallback) {



                    vars[key] = fallback.trim();



                }



            }



        }



        return vars;



    }



    function applyThemeToIframe(iframe: HTMLIFrameElement): void {



        try {



            const doc = iframe.contentDocument;



            if (!doc)



                return;



            const vars = snapshotThemeVars();



            for (const [key, value] of Object.entries(vars)) {



                if (value) {



                    doc.documentElement.style.setProperty(key, value);



                }



            }



        }



        catch (err) {



            logErr(err, "renderer");



        }



    }



    async function openPluginSettingsUI(plugin: { id: string; name: string; hasSettingsUI?: boolean; enabled?: boolean }): Promise<void> {



        console.log("[PluginUI] open", { id: plugin.id, name: plugin.name, enabled: plugin.enabled, hasSettingsUI: plugin.hasSettingsUI });



        if (!plugin.hasSettingsUI) {



            showToast(t("config.plugins.noUI"), "info");



            return;



        }



        if (plugin.enabled === false) {



            showToast(t("config.plugins.isDisabled"), "warning");



            return;



        }



        const overlay = el("div", "pluginUiOverlay");



        const container = el("div", "pluginUiContainer");



        const header = el("div", "pluginUiHeader");



        const title = el("div", "pluginUiTitle", plugin.name);



        const closeBtn = el("button", "pluginUiClose", "x");



        const frame = document.createElement("iframe");



        frame.className = "pluginUiFrame";



        // Only allow-scripts, not allow-same-origin to prevent sandbox escape



        frame.setAttribute("sandbox", "allow-scripts");



        header.append(title, closeBtn);



        container.append(header, frame);



        overlay.append(container);



        document.body.append(overlay);



        const close = () => {



            window.removeEventListener("message", messageHandler);



            overlay.remove();



        };



        // Handle postMessage from iframe for IPC calls



        const messageHandler = async (evt: MessageEvent) => {



            if (evt.source !== frame.contentWindow) return;



            const { type, id, channel, args } = evt.data || {};



            if (type === "plugin:ipc:invoke" && channel && id) {



                try {



                    const result = await window.api.pluginsInvokeChannel(plugin.id, channel, ...(args || []));



                    frame.contentWindow?.postMessage({ type: "plugin:ipc:result", id, result }, "*");



                } catch (err) {



                    frame.contentWindow?.postMessage({ type: "plugin:ipc:result", id, error: String(err) }, "*");



                }



            } else if (type === "plugin:theme:refresh") {



                applyThemeToIframe(frame);



            } else if (type === "plugin:theme:vars") {



                frame.contentWindow?.postMessage({ type: "plugin:theme:vars:result", vars: snapshotThemeVars() }, "*");



            }



        };



        window.addEventListener("message", messageHandler);



        closeBtn.addEventListener("click", close);



        overlay.addEventListener("click", (evt) => {



            if (evt.target === overlay)



                close();



        });



        frame.addEventListener("load", () => {



            console.log("[PluginUI] iframe loaded", plugin.id);



            applyThemeToIframe(frame);



        });



        try {



            const uiInfo = await window.api.pluginsGetSettingsUI(plugin.id);



            console.log("[PluginUI] settings UI info", uiInfo);



            if (!uiInfo) {



                throw new Error("No UI URL available");



            }



            if (uiInfo.width) {



                container.style.width = `${Math.max(360, uiInfo.width)}px`;



            }



            if (uiInfo.height) {



                container.style.height = `${Math.max(240, uiInfo.height)}px`;



            }



            if (uiInfo.html) {



                // Inject base tag to resolve relative URLs to plugin directory



                const baseTag = uiInfo.baseHref ? `<base href="${uiInfo.baseHref}">` : "";



                // Inject bridge script that provides window.plugin API via postMessage



                const bridgeScript = `<script>



(function() {



    var pending = {};



    var nextId = 1;



    window.addEventListener("message", function(evt) {



        var data = evt.data || {};



        if (data.type === "plugin:ipc:result" && data.id && pending[data.id]) {



            if (data.error) {



                pending[data.id].reject(new Error(data.error));



            } else {



                pending[data.id].resolve(data.result);



            }



            delete pending[data.id];



        } else if (data.type === "plugin:theme:vars:result" && pending["theme:vars"]) {



            pending["theme:vars"].resolve(data.vars);



            delete pending["theme:vars"];



        }



    });



    window.plugin = {



        ipc: {



            invoke: function(channel) {



                var args = Array.prototype.slice.call(arguments, 1);



                var id = nextId++;



                return new Promise(function(resolve, reject) {



                    pending[id] = { resolve: resolve, reject: reject };



                    parent.postMessage({ type: "plugin:ipc:invoke", id: id, channel: channel, args: args }, "*");



                });



            }



        },



        theme: {



            refresh: function() {



                parent.postMessage({ type: "plugin:theme:refresh" }, "*");



            },



            vars: function() {



                return new Promise(function(resolve) {



                    pending["theme:vars"] = { resolve: resolve };



                    parent.postMessage({ type: "plugin:theme:vars" }, "*");



                });



            }



        }



    };



})();



<\/script>`;



                const html = `${baseTag}${bridgeScript}${uiInfo.html}`;



                frame.srcdoc = html;



            } else if (uiInfo.url) {



                frame.src = uiInfo.url;



            } else {



                throw new Error("No UI URL available");



            }



        }



        catch (err) {



            console.error("[PluginUI] failed to load settings UI", plugin.id, err);



            frame.remove();



            const errorEl = el("div", "pluginsError muted", String(err));



            container.append(errorEl);



        }



    }



    function openConfigModal(defaultStyleTab: "theme" | "tabActive" = "theme", defaultTab: "style" | "plugins" | "client" | "patchnotes" | "docs" | "support" = "style") {



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



        // Simple markdown to HTML converter for patchnotes



        function markdownToHtml(md: string): string {



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



        // Extended markdown to HTML converter for documentation with accordions, images, videos



        function markdownToHtmlExtended(md: string, assetsPath: string): string {



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



                            // Directly launch Python UI without dialog



                            uiBtn.disabled = true;



                            status.textContent = t("config.plugins.status.working");



                            status.className = "pluginStatus loading";



                            try {



                                const result = await window.api.pluginsInvokeChannel(plugin.id, "ui:launch");



                                if (result && (result as { ok?: boolean }).ok) {



                                    showToast(t("config.plugins.uiStarted"), "success");



                                } else {



                                    showToast((result as { error?: string })?.error || t("config.plugins.uiError"), "error");



                                }



                            } catch (err) {



                                showToast(String(err), "error");



                            } finally {



                                uiBtn.disabled = false;



                                status.textContent = getStatusText(plugin.state, plugin.enabled);



                                status.className = `pluginStatus ${getStatusClass(plugin.state, plugin.enabled)}`;



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



    const btnFlyffuniverse = el("button", "btn primary") as HTMLButtonElement;



    btnFlyffuniverse.title = "Flyffuniverse �ffnen";



    const flyffuniverseImg = document.createElement("img");



    flyffuniverseImg.src = flyffuniverseIcon;



    flyffuniverseImg.alt = "Flyffuniverse";



    flyffuniverseImg.style.width = "64x";



    flyffuniverseImg.style.height = "32px";



    btnFlyffuniverse.style.width = "128px";



    btnFlyffuniverse.style.height = "32px";



    btnFlyffuniverse.append(flyffuniverseImg);



    btnFlyffuniverse.addEventListener("click", () => {



        window.open("https://universe.flyff.com/", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768");



    });



    header.append(btnFlyffuniverse);



    const btnFlyffipedia = el("button", "btn primary") as HTMLButtonElement;



    btnFlyffipedia.title = "Flyffipedia �ffnen";



    const flyffipediaImg = document.createElement("img");



    flyffipediaImg.src = flyffipediaIcon;



    flyffipediaImg.alt = "Flyffipedia";



    flyffipediaImg.style.width = "64x";



    flyffipediaImg.style.height = "32px";



    btnFlyffipedia.style.width = "128px";



    btnFlyffipedia.style.height = "32px";



    btnFlyffipedia.append(flyffipediaImg);



    btnFlyffipedia.addEventListener("click", () => {



        window.open("https://flyffipedia.com/home", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768");



    });



    header.append(btnFlyffipedia);



    const btnFlyffulator = el("button", "btn primary pink-text") as HTMLButtonElement;



    btnFlyffulator.title = "Flyffulator �ffnen";



    const flyffulatorImg = document.createElement("img");



    flyffulatorImg.src = flyffulatorIcon;



    flyffulatorImg.alt = "Flyffulator";



    flyffulatorImg.style.width = "32px";



    flyffulatorImg.style.height = "32px";



    flyffulatorImg.style.marginRight = "0px";



    const btnText = document.createElement("span");



    btnText.textContent = "Flyffulator";


    btnFlyffulator.style.display = "flex";



    btnFlyffulator.style.alignItems = "center";



    btnFlyffulator.style.justifyContent = "center";



    btnFlyffulator.style.padding = "8px 12px";



    btnFlyffulator.style.height = "40px";



    btnFlyffulator.append(flyffulatorImg, btnText);



    btnFlyffulator.addEventListener("click", () => {



        window.open("https://flyffulator.com/", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768");



    });



    header.append(btnFlyffulator);



    const btnSkillulator = el("button", "btn primary skillulator") as HTMLButtonElement;



    btnSkillulator.title = "Skillulator �ffnen";



    const skillulatorImg = document.createElement("img");



    skillulatorImg.src = reskillIcon;



    skillulatorImg.alt = "Skillulator";



    skillulatorImg.style.width = "32px";



    skillulatorImg.style.height = "32px";



    skillulatorImg.style.marginRight = "0px";



    const btnSkillulatorText = document.createElement("span");



    btnSkillulatorText.textContent = "Skillulator";



    btnSkillulatorText.className = "skillulatorLabel";



    btnSkillulator.style.display = "flex";



    btnSkillulator.style.alignItems = "center";



    btnSkillulator.style.justifyContent = "center";



    btnSkillulator.style.padding = "8px 12px";



    btnSkillulator.style.height = "40px";



    btnSkillulator.append(skillulatorImg, btnSkillulatorText);



    btnSkillulator.addEventListener("click", () => {



        window.open("https://skillulator.lol/", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768");



    });



    header.append(btnSkillulator);



    const btnDiscord = el("button", "btn primary") as HTMLButtonElement;



    btnDiscord.title = "Discord-Server beitreten";



    btnDiscord.style.width = "38px";



    btnDiscord.style.height = "36px";



    const discordImg = document.createElement("img");



    discordImg.src = discordIcon;



    discordImg.alt = "Discord";



    discordImg.style.width = "20px";



    discordImg.style.height = "20px";



    btnDiscord.append(discordImg);



    btnDiscord.addEventListener("click", () => {



        window.open("https://discord.gg/vAPxWYHt", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=900,height=700");



    });



    header.append(btnDiscord);



    const btnGithub = el("button", "btn primary githubBtn") as HTMLButtonElement;



    btnGithub.title = "GitHub �ffnen";



    const githubImg = document.createElement("img");



    githubImg.src = githubIcon;



    githubImg.alt = "GitHub";



    githubImg.style.width = "20px";



    githubImg.style.height = "20px";



    btnGithub.append(githubImg);



    btnGithub.addEventListener("click", () => {



        window.open(GITHUB_REPO_URL, "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1200,height=800");



    });



    const updateNotice = el("div", "updateNotice hidden", t("update.available.title"));



    const btnConfig = el("button", "btn primary configBtn") as HTMLButtonElement;
    btnConfig.title = t("config.title");
    btnConfig.setAttribute("aria-label", t("config.title"));
    const configIcon = document.createElement("span");
    configIcon.textContent = settingsIcon;
    configIcon.setAttribute("aria-hidden", "true");
    configIcon.style.fontSize = "18px";
    btnConfig.append(configIcon);


    btnConfig.addEventListener("click", () => openConfigModal());



    header.append(btnGithub, btnConfig, updateNotice);



    const versionLabel = el("div", "versionLabel", `v${pkg.version}`);



    const applyUpdateState = (available: boolean) => {



        btnGithub.classList.toggle("updateAvailable", available);



        updateNotice.classList.toggle("hidden", !available);



    };



    applyUpdateState(cachedUpdateAvailable ?? false);



    getUpdateAvailable()



        .then(applyUpdateState)



        .catch((err) => {



        console.warn("launcher update check failed", err);



        applyUpdateState(false);



    });



    const languages: {



        value: Locale;



        title: string;



        icon: string;



    }[] = [



        { value: "en", title: "English", icon: FLAG_ICONS.en },



        { value: "de", title: "Deutsch", icon: FLAG_ICONS.de },



        { value: "pl", title: "Polski", icon: FLAG_ICONS.pl },



        { value: "fr", title: "Fran�ais", icon: FLAG_ICONS.fr },



        { value: "ru", title: "???????", icon: FLAG_ICONS.ru },



        { value: "tr", title: "T�rk�e", icon: FLAG_ICONS.tr },



        { value: "cn", title: "??", icon: FLAG_ICONS.cn },



        { value: "jp", title: "???", icon: FLAG_ICONS.jp },



    ];



    const langPicker = el("div", "langPicker");



    const langButton = document.createElement("button");



    langButton.className = "btn langButton";



    const langIcon = el("div", "langIcon");



    langButton.append(langIcon);



    const langMenu = el("div", "langMenu hidden");



    function syncLangButton() {



        const active = languages.find((l) => l.value === currentLocale) ?? languages[0];



        langButton.title = active.title;



        langIcon.style.backgroundImage = `url("${active.icon}")`;



    }



    for (const l of languages) {



        const btn = document.createElement("button");



        btn.className = "langMenuItem";



        btn.type = "button";



        btn.title = l.title;



        btn.style.backgroundImage = `url("${l.icon}")`;



        btn.onclick = () => {



            setLocale(l.value);



            syncLangButton();



            langMenu.classList.add("hidden");



            if (langMenuCloser) {



                document.removeEventListener("click", langMenuCloser);



                langMenuCloser = null;



            }



            renderLauncher(root);



        };



        langMenu.append(btn);



    }



    syncLangButton();



    langButton.addEventListener("click", (e) => {



        e.stopPropagation();



        langMenu.classList.toggle("hidden");



    });



    langMenuCloser = () => langMenu.classList.add("hidden");



    document.addEventListener("click", langMenuCloser);



    langPicker.append(langButton, langMenu);



    header.append(el("div", "title", ""), el("div", "spacer"), versionLabel, langPicker);



    const btnCreate = el("button", "btn primary", t("header.newProfile"));



    const filterBar = el("div", "filterBar");



    const searchInput = document.createElement("input");



    searchInput.className = "input searchInput";



    searchInput.placeholder = t("filter.searchPlaceholder");



    const jobSelect = document.createElement("select");



    jobSelect.className = "select filterSelect";



    renderJobOptions(jobSelect);



    const btnRefreshLayouts = el("button", "btn", t("layout.refresh"));



    filterBar.append(searchInput, jobSelect, btnCreate, btnRefreshLayouts);



    async function renderLayoutChips(target: HTMLElement) {



        // Replace existing layout card without touching other content (e.g., profile cards)



        target.querySelector(".layoutCard")?.remove();



        const refreshFlag = localStorage.getItem("tabLayoutsRefresh");



        if (refreshFlag)



            localStorage.removeItem("tabLayoutsRefresh");



        const layouts = await fetchTabLayouts();



        const card = el("div", "card layoutCard");



        const layoutBar = el("div", "layoutBar");



        const layoutList = el("div", "layoutList");



        layoutBar.append(layoutList);







        // Localized Labels to avoid ReferenceError before session view is initialised



        const layoutLabel = (type: string): string => {



            const labels: Record<string, string> = {



                single: t("layout.single"),



                "split-2": t("layout.split2"),



                "grid-4": t("layout.grid4"),



                "row-4": t("layout.row4"),



                "grid-6": t("layout.grid6"),



                "grid-8": t("layout.grid8"),



            };



            return labels[type] ?? t("layout.multi");



        };







        let profileNames = new Map<string, string>();



        let profileJobs = new Map<string, string | null>();



        try {



            const profiles = await window.api.profilesList();



            profileNames = new Map(profiles.map((p: Profile) => [p.id, p.name]));



            profileJobs = new Map(profiles.map((p: Profile) => [p.id, p.job?.trim() || null]));



            profiles.forEach((p) => rememberProfileName(p.id, p.name, p.job));



        }



        catch (e) {



            console.warn("profilesList failed", e);



        }



        let activeCloseMenu: (() => void) | null = null;



        if (layouts.length === 0) {



            layoutList.append(el("div", "muted", t("layout.empty")));



        }



        else {



            for (const layout of layouts) {



                const chip = el("div", "layoutChip");



                const handle = el("span", "dragHandle", "=");



                const name = el("span", "layoutName", layout.name);



                const metaParts = [`${layout.tabs.length} Tabs`];



                const shortLabel = (type: string): string => {



                    const map: Record<string, string> = {



                        single: "1x1", "split-2": "1x2", "row-3": "1x3", "row-4": "1x4",



                        "grid-4": "2x2", "grid-6": "2x3", "grid-8": "2x4",



                    };



                    return map[type] ?? type;



                };



                const savedLayouts: Array<{ layout: { type: string } }> = layout.layouts ?? [];



                if (savedLayouts.length > 0) {



                    metaParts.push(savedLayouts.map((g) => shortLabel(g.layout.type)).join(" - "));



                } else if (layout.split) {



                    const typeKey = "type" in layout.split ? (layout.split as { type?: string }).type ?? "split-2" : "split-2";



                    metaParts.push(shortLabel(typeKey));



                }



                const meta = el("span", "layoutMeta", metaParts.join(" | "));



                const actions = el("div", "layoutActions");



                // --- Profiles expand button ---



                let profilesRow: HTMLDivElement | null = null;



                const profilesBtn = el("button", "btn layoutProfilesBtn", "👥");



                profilesBtn.title = "Profiles";



                profilesBtn.onclick = (e) => {



                    e.stopPropagation();



                    if (profilesRow) {



                        profilesRow.remove();



                        profilesRow = null;



                        profilesBtn.classList.remove("active");



                        return;



                    }



                    profilesRow = el("div", "layoutProfilesRow") as HTMLDivElement;



                    // Determine layout grouping from saved layout data



                    const savedLayouts: Array<{ name?: string; layout: { type: string; cells: Array<{ id: string; position: number }> } }> = layout.layouts ?? [];



                    if (savedLayouts.length > 0) {



                        // Show each saved layout group



                        for (const grp of savedLayouts) {



                            const groupEl = el("div", "layoutProfileGroup");



                            const groupTitle = grp.name || layoutLabel(grp.layout.type);



                            const groupLabel = el("span", "layoutProfileGroupLabel", groupTitle);



                            groupEl.append(groupLabel);



                            const groupItems = el("div", "layoutProfileGroupItems");



                            const sortedCells = [...grp.layout.cells].sort((a, b) => a.position - b.position);



                            for (const cell of sortedCells) {



                                const item = el("div", "layoutProfileItem");



                                const job = profileJobs.get(cell.id) ?? null;



                                const icon = createJobIcon(job ?? undefined, "layoutProfileJobIcon");



                                if (icon) item.append(icon);



                                const label = el("span", "layoutProfileLabel", profileNames.get(cell.id) ?? cell.id);



                                item.append(label);



                                groupItems.append(item);



                            }



                            groupEl.append(groupItems);



                            profilesRow.append(groupEl);



                        }



                    } else {



                        // Fallback: flat list (no grouping info available)



                        const groupItems = el("div", "layoutProfileGroupItems");



                        for (const tabId of layout.tabs) {



                            const item = el("div", "layoutProfileItem");



                            const job = profileJobs.get(tabId) ?? null;



                            const icon = createJobIcon(job ?? undefined, "layoutProfileJobIcon");



                            if (icon) item.append(icon);



                            const label = el("span", "layoutProfileLabel", profileNames.get(tabId) ?? tabId);



                            item.append(label);



                            groupItems.append(item);



                        }



                        profilesRow.append(groupItems);



                    }



                    if (layout.tabs.length === 0) {



                        profilesRow.append(el("span", "muted", t("layout.empty")));



                    }



                    chip.append(profilesRow);



                    profilesBtn.classList.add("active");



                };







                const manageBtn = el("button", "btn", "⚙");


                manageBtn.title = "Manage";



                let menu: HTMLDivElement | null = null;



                let closeMenu: (() => void) | null = null;



                const buildMenu = () => {



                    if (menu)



                        return;



                    activeCloseMenu?.();



                    activeCloseMenu = null;



                    menu = el("div", "layoutMenu") as HTMLDivElement;



                    const renameBtn = el("button", "btn", t("layout.rename"));



                    renameBtn.onclick = async () => {



                        closeMenu?.();



                        const requestName = async (initial: string): Promise<string | null> => {



                            if (typeof askLayoutName === "function") {



                                return await askLayoutName(initial);



                            }



                            // Fallback modal (prompt is not available in this environment)



                            return await new Promise<string | null>((resolve) => {



                                void hideSessionViews();



                                const overlay = el("div", "modalOverlay");



                                const modal = el("div", "modal");



                                const header = el("div", "modalHeader");



                                const headerTitle = el("span", "", t("layout.namePrompt"));



                                const headerClose = el("button", "modalCloseBtn", "\u00d7") as HTMLButtonElement;



                                headerClose.type = "button";



                                headerClose.onclick = () => cleanup(null);



                                header.append(headerTitle, headerClose);



                                const body = el("div", "modalBody");



                                const input = document.createElement("input");



                                input.className = "input";



                                input.value = initial;



                                input.placeholder = t("layout.namePrompt");



                                const actions = el("div", "manageActions");



                                const btnSave = el("button", "btn primary", t("profile.save"));



                                const btnCancel = el("button", "btn", t("create.cancel"));



                                actions.append(btnSave, btnCancel);



                                body.append(input, actions);



                                modal.append(header, body);



                                overlay.append(modal);



                                const cleanup = (val: string | null) => {



                                    overlay.remove();



                                    void showSessionViews();



                                    resolve(val);



                                    pushBounds();



                                    kickBounds();



                                };



                                btnSave.onclick = () => cleanup(input.value.trim() || initial);



                                btnCancel.onclick = () => cleanup(null);



                                overlay.addEventListener("click", (e) => {



                                    if (e.target === overlay)



                                        cleanup(null);



                                });



                                input.addEventListener("keydown", (e) => {



                                    if (e.key === "Enter")



                                        cleanup(input.value.trim() || initial);



                                    if (e.key === "Escape")



                                        cleanup(null);



                                });



                                document.body.append(overlay);



                                input.focus();



                                input.select();



                            });



                        };



                        const nextName = await requestName(layout.name || "");



                        if (!nextName)



                            return;



                        try {



                            await window.api.tabLayoutsSave({



                                id: layout.id,



                                name: nextName,



                                tabs: layout.tabs,



                                split: layout.split ?? null,



                                activeId: layout.activeId ?? null,



                                loggedOutChars: layout.loggedOutChars,



                            });



                            showToast(t("layout.saved"), "success");



                            closeMenu?.();



                            await renderLayoutChips(target);



                        }



                        catch (err) {



                            showToast(`${t("layout.saveError")}: ${err instanceof Error ? err.message : String(err)}`, "error");



                        }



                    };



                    const delBtn = el("button", "btn danger", t("layout.delete"));



                    delBtn.onclick = async () => {



                        closeMenu?.();



                        await window.api.tabLayoutsDelete(layout.id);



                        await renderLayoutChips(target);



                    };



                    const menuActions = el("div", "layoutMenuActions");



                    menuActions.append(renameBtn, delBtn);



                    menu.append(menuActions);



                    document.body.append(menu);



                    const positionMenu = () => {



                        if (!menu)



                            return;



                        const margin = 12;



                        const triggerRect = manageBtn.getBoundingClientRect();



                        const menuRect = menu.getBoundingClientRect();



                        const maxLeft = Math.max(margin, window.innerWidth - menuRect.width - margin);



                        const left = Math.min(Math.max(margin, triggerRect.right - menuRect.width), maxLeft);



                        const maxTop = Math.max(margin, window.innerHeight - menuRect.height - margin);



                        const top = Math.min(triggerRect.bottom + margin, maxTop);



                        menu.style.left = `${left}px`;



                        menu.style.top = `${top}px`;



                    };



                    positionMenu();



                    const onDocClick = (e: MouseEvent) => {



                        if (!menu)



                            return;



                        const targetEl = e.target as Node;



                        if (targetEl === manageBtn || menu.contains(targetEl))



                            return;



                        closeMenu?.();



                    };



                    closeMenu = () => {



                        menu?.remove();



                        menu = null;



                        if (activeCloseMenu === closeMenu) activeCloseMenu = null;



                        document.removeEventListener("click", onDocClick);



                        window.removeEventListener("resize", positionMenu);



                    };



                    activeCloseMenu = closeMenu;



                    window.addEventListener("resize", positionMenu);



                    document.addEventListener("click", onDocClick);



                };



                manageBtn.onclick = (e) => {



                    e.stopPropagation();



                    if (menu) {



                        closeMenu?.();



                    }



                    else {



                        buildMenu();



                    }



                };



                const openBtn = el("button", "btn primary", t("profile.play"));



                openBtn.onclick = async () => {



                    showToast(t("layout.apply"), "info");



                    try {



                        await window.api.tabLayoutsApply(layout.id);



                    }



                    catch (err) {



                        showToast(`${t("layout.saveError")}: ${err instanceof Error ? err.message : String(err)}`, "error");



                    }



                };



                actions.append(profilesBtn, manageBtn, openBtn);



                chip.append(handle, name, meta, actions);



                layoutList.append(chip);



            }



        }



        card.append(layoutBar);



        target.prepend(card);



    }



    const body = el("div", "layout");



    const left = el("div", "panel left");



    const right = el("div", "panel right");



    const list = el("div", "list");



    const profilesContainer = el("div", "profilesContainer");



    list.append(profilesContainer);



    const createPanel = el("div", "manage createPanel hidden");



    const createGrid = el("div", "manageGrid");



    const tipsBanner = el("div", "tipsBanner");



    const tipsTitle = el("div", "tipsTitle", t("tips.title"));



    const tipsText = el("div", "tipsText", "");



    tipsBanner.append(tipsTitle, tipsText);



    const createName = document.createElement("input");



    createName.className = "input";



    createName.placeholder = t("create.namePlaceholder");



    createGrid.append(createName);



    const createActions = el("div", "manageActions");



    const btnAdd = el("button", "btn primary", t("create.add"));



    const btnCancel = el("button", "btn", t("create.cancel"));



    // eslint-disable-next-line @typescript-eslint/no-unused-vars



    const btnDel = el("button", "btn danger", t("create.delete")); // Reserved for future delete functionality



    createActions.append(btnAdd, btnCancel);



    createPanel.append(createGrid, createActions);



    left.append(createPanel, list, tipsBanner);



    const newsHeader = el("div", "newsHeader");



    const newsTitle = el("div", "panelTitle", t("news.title"));



    newsHeader.append(newsTitle);



    const newsState = el("div", "newsState muted", t("news.loading"));



    const newsList = el("div", "newsList");



    const openProfilesTitle = el("div", "openProfilesTitle", t("news.openProfiles"));



    const openProfilesList = el("div", "openProfilesList");



    const openProfilesBox = el("div", "openProfiles");



    openProfilesBox.append(openProfilesTitle, openProfilesList);



    right.append(newsHeader, newsState, newsList, openProfilesBox);



    root.append(header, filterBar, body);



    body.append(left, right);



    type NewsItem = {



        title: string;



        url: string;



        excerpt?: string;



        image?: string;



        category?: string;



        date?: string;



        orderIdx?: number;



    };



    const MONTHS: Record<string, number> = {



        jan: 1, january: 1,



        feb: 2, february: 2,



        mar: 3, march: 3,



        apr: 4, april: 4,



        may: 5,



        jun: 6, june: 6,



        jul: 7, july: 7,



        aug: 8, august: 8,



        sep: 9, sept: 9, september: 9,



        oct: 10, october: 10,



        nov: 11, november: 11,



        dec: 12, december: 12,



    };



    function normalizeNewsText(input: string | null | undefined) {



        if (!input)



            return "";



        return input.replace(/\s+/g, " ").trim();



    }



    function absoluteNewsUrl(href: string | null): string | null {



        if (!href)



            return null;



        try {



            return new URL(href, NEWS_BASE_URL).toString();



        }



        catch {



            return null;



        }



    }



    function pad2(n: number) {



        return n.toString().padStart(2, "0");



    }



    function formatDate(parts: {



        year?: number;



        month?: number;



        day?: number;



        raw?: string;



    }) {



        if (parts.year && parts.month && parts.day) {



            return `${pad2(parts.day)}.${pad2(parts.month)}.${parts.year}`;



        }



        if (parts.month && parts.day) {



            return `${pad2(parts.day)}.${pad2(parts.month)}`;



        }



        return parts.raw ?? null;



    }



    function formatDateFromIso(iso: string | null | undefined) {



        if (!iso)



            return null;



        const d = new Date(iso);



        if (Number.isNaN(d.getTime()))



            return null;



        return formatDate({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });



    }



    function parseDateFromText(text: string | null | undefined): string | null {



        if (!text)



            return null;



        const t = text;



        let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);



        if (m)



            return formatDate({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) });



        m = t.match(/\b(\d{4})(\d{2})(\d{2})\b/);



        if (m)



            return formatDate({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) });



        m = t.match(/\b(\d{2})(\d{2})(\d{2})(?!\d)\b/);



        if (m) {



            const month = Number(m[1]);



            const day = Number(m[2]);



            const year = 2000 + Number(m[3]);



            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {



                return formatDate({ year, month, day });



            }



        }



        m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);



        if (m) {



            const month = Number(m[1]);



            const day = Number(m[2]);



            const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;



            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {



                return formatDate({ year, month, day });



            }



        }



        m = t.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s.-]*(\d{1,2})(?:,?\s*(\d{2,4}))?/i);



        if (m) {



            const month = MONTHS[m[1].toLowerCase()];



            const day = Number(m[2]);



            const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;



            if (month) {



                return formatDate({ year, month, day });



            }



        }



        return null;



    }



    function extractDate(candidates: (string | null | undefined)[]) {



        for (const c of candidates) {



            const parsed = parseDateFromText(c);



            if (parsed)



                return parsed;



        }



        return null;



    }



    function renderNewsItem(item: NewsItem) {



        const link = document.createElement("a");



        link.className = "newsItem";



        link.href = item.url;



        link.target = "_blank";



        link.rel = "noreferrer";



        const thumb = el("div", "newsThumb");



        if (item.image) {



            const img = document.createElement("img");



            img.src = item.image;



            img.alt = item.title;



            thumb.append(img);



        }



        else {



            thumb.textContent = "NEWS";



        }



        const content = el("div", "newsContent");



        const title = el("div", "newsTitle", item.title);



        const metaText = item.date ? `${item.category ?? "News"} � ${item.date}` : item.category ?? "News";



        const meta = el("div", "newsMeta", metaText);



        content.append(meta, title);



        link.append(thumb, content);



        return link;



    }



    type NewsNavTarget = {



        path: string;



        category?: string;



    };



    function parseNews(html: string, fallbackCategory?: string, navTargets?: NewsNavTarget[]): NewsItem[] {



        const doc = new DOMParser().parseFromString(html, "text/html");



        const tabNames: Record<string, string> = {};



        doc.querySelectorAll("#news-tabs .nav-link").forEach((btn) => {



            const target = btn.getAttribute("data-bs-target");



            if (!target)



                return;



            const name = normalizeNewsText(btn.textContent) || "News";



            tabNames[target.replace("#", "")] = name;



            const href = btn.getAttribute("href");



            if (href && !href.startsWith("#")) {



                try {



                    const url = new URL(href, NEWS_BASE_URL);



                    if (url.hostname === "universe.flyff.com" && url.pathname.startsWith("/news")) {



                        const path = `${url.pathname}${url.search}`;



                        navTargets?.push({ path, category: name });



                    }



                }



                catch (err) {



                    logErr(err, "renderer");



                }



            }



        });



        const seen = new Set<string>();



        const items: NewsItem[] = [];



        const panes = Array.from(doc.querySelectorAll(".tab-content .tab-pane"));



        const addLinksFrom = (scope: ParentNode, category: string) => {



            const links = Array.from(scope.querySelectorAll(".card a, .list-group-item a, .news-card a, .newsCard a, a[href*='/news/']"));



            for (const link of links) {



                if ((link as HTMLElement).closest("#news-tabs"))



                    continue;



                const href = absoluteNewsUrl(link.getAttribute("href"));



                const title = normalizeNewsText(link.querySelector("h5")?.textContent ?? link.textContent);



                if (!href || !title || title.length < 3)



                    continue;



                if (seen.has(href))



                    continue;



                seen.add(href);



                const excerpt = normalizeNewsText(link.querySelector("h6")?.textContent ?? "");



                const img = link.querySelector("img") as HTMLImageElement | null;



                const image = absoluteNewsUrl(img?.getAttribute("src") ?? null) ?? undefined;



                const altText = normalizeNewsText(img?.getAttribute("alt") ?? "");



                let slug = "";



                try {



                    const url = new URL(href);



                    slug = url.pathname.split("/").filter(Boolean).pop() ?? "";



                }



                catch (err) {



                    logErr(err, "renderer");



                }



                const date = extractDate([altText, title, excerpt, link.textContent, slug]);



                items.push({



                    title,



                    url: href,



                    excerpt: excerpt || undefined,



                    image,



                    category,



                    date: date ?? undefined,



                });



            }



        };



        if (panes.length > 0) {



            for (const pane of panes) {



                const category = tabNames[pane.id] ?? fallbackCategory ?? "News";



                addLinksFrom(pane, category);



            }



        }



        else {



            addLinksFrom(doc.body, fallbackCategory ?? "News");



        }



        return items;



    }



    function parseArticleDate(html: string): string | null {



        const doc = new DOMParser().parseFromString(html, "text/html");



        const ogPublished = formatDateFromIso(doc.querySelector('meta[property="og:article:published_time"]')?.getAttribute("content") ?? undefined);



        if (ogPublished)



            return ogPublished;



        const pMuted = normalizeNewsText(doc.querySelector("p.text-muted")?.textContent ?? "");



        const postedOn = normalizeNewsText(doc.querySelector("p.d-md-inline-block")?.textContent ?? "");



        return extractDate([pMuted, postedOn]) ?? null;



    }



    function dateStringToNumber(input?: string): number {



        if (!input)



            return 0;



        const parsed = Date.parse(input);



        if (!Number.isNaN(parsed))



            return parsed;



        const m = input.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);



        if (m) {



            const day = Number(m[1]);



            const month = Number(m[2]);



            const year = Number(m[3]);



            if (day && month && year) {



                return Date.UTC(year, month - 1, day);



            }



        }



        return 0;



    }



    async function enrichNewsDates(items: NewsItem[]) {



        for (const item of items) {



            try {



                const articleHtml = await window.api.fetchNewsArticle(item.url);



                const date = parseArticleDate(articleHtml);



                if (date)



                    item.date = date;



            }



            catch (err) {



                console.warn("[news] article fetch failed:", err);



            }



        }



    }



    function showNewsState(text: string) {



        newsState.textContent = text;



        newsState.style.display = "block";



    }



    function hideNewsState() {



        newsState.style.display = "none";



    }



    const NEWS_FEED_PAGES: {



        path: string;



        category?: string;



    }[] = [



        { path: "/news", category: "Updates" },



        { path: "/news?category=events", category: "Events" },



        { path: "/news?category=event", category: "Events" },



        { path: "/news?category=item-shop-news", category: "Item Shop News" },



        { path: "/news?category=item-shop", category: "Item Shop News" },



    ];



    async function loadNews() {



        showNewsState(t("news.loading"));



        newsList.innerHTML = "";



        try {



            const combined: NewsItem[] = [];



            const seen = new Set<string>();



            const navTargets: NewsNavTarget[] = [];



            try {



                const baseHtml = await window.api.fetchNewsPage("/news");



                const baseItems = parseNews(baseHtml, "Updates", navTargets);



                for (const item of baseItems) {



                    if (seen.has(item.url))



                        continue;



                    seen.add(item.url);



                    item.orderIdx = combined.length;



                    combined.push(item);



                }



            }



            catch (err) {



                console.warn("[news] fetch base page failed", err);



            }



            const queuedPaths = new Map<string, string | undefined>();



            for (const page of NEWS_FEED_PAGES) {



                queuedPaths.set(page.path, page.category);



            }



            for (const target of navTargets) {



                queuedPaths.set(target.path, target.category ?? queuedPaths.get(target.path));



            }



            for (const [path, category] of queuedPaths.entries()) {



                if (path === "/news")



                    continue;



                try {



                    const html = await window.api.fetchNewsPage(path);



                    const items = parseNews(html, category);



                    for (const item of items) {



                        if (seen.has(item.url))



                            continue;



                        seen.add(item.url);



                        if (!item.category)



                            item.category = category;



                        item.orderIdx = combined.length;



                        combined.push(item);



                    }



                }



                catch (err) {



                    console.warn("[news] fetch page failed", path, err);



                }



            }



            if (combined.length === 0) {



                showNewsState(t("news.none"));



                return;



            }



            const categoryBuckets = new Map<string, NewsItem[]>();



            for (const item of combined) {



                const cat = item.category ?? "News";



                if (!categoryBuckets.has(cat))



                    categoryBuckets.set(cat, []);



                categoryBuckets.get(cat)?.push(item);



            }



            const toEnrich: NewsItem[] = [];



            const preferCategories = ["Updates", "Events", "Item Shop News", "News"];



            for (const cat of preferCategories) {



                const bucket = categoryBuckets.get(cat);



                if (!bucket)



                    continue;



                toEnrich.push(...bucket.slice(0, 8));



            }



            if (toEnrich.length < 24) {



                for (const item of combined) {



                    if (toEnrich.includes(item))



                        continue;



                    toEnrich.push(item);



                    if (toEnrich.length >= 24)



                        break;



                }



            }



            await enrichNewsDates(toEnrich);



            const sortedCombined = combined



                .slice()



                .sort((a, b) => {



                const da = dateStringToNumber(a.date);



                const db = dateStringToNumber(b.date);



                if (db !== da)



                    return db - da;



                const ia = a.orderIdx ?? 0;



                const ib = b.orderIdx ?? 0;



                return ia - ib;



            });



            const subset = sortedCombined.slice(0, 12);



            hideNewsState();



            for (const item of subset) {



                newsList.append(renderNewsItem(item));



            }



        }



        catch (err) {



            console.error("[news] load failed:", err);



            const msg = err instanceof Error && err.message ? ` (${err.message})` : "";



            showNewsState(`${t("news.error")}${msg ? ` ${msg}` : ""}`);



        }



    }



    async function refreshOpenProfilesBadge() {



        openProfilesList.innerHTML = "";



        const getAllOpenProfiles = window.api?.sessionTabsGetAllOpenProfiles;



        const getOpenProfiles = window.api?.sessionTabsGetOpenProfiles;



        if (typeof getAllOpenProfiles !== "function" && typeof getOpenProfiles !== "function") {



            const pill = el("span", "newsBadge empty", t("news.openProfiles.none"));



            openProfilesList.append(pill);



            return;



        }



        try {



            const [openIds, profiles] = await Promise.all([



                (typeof getAllOpenProfiles === "function"



                    ? getAllOpenProfiles()



                    : (getOpenProfiles?.() ?? Promise.resolve([]))) as Promise<string[]>,



                window.api.profilesList() as Promise<Profile[]>,



            ]);



            const orderMap = new Map(profiles.map((p, idx) => [p.id, idx]));



            const nameMap = new Map(profiles.map((p) => [p.id, p.name]));



            const uniqueIds = Array.from(new Set(openIds));



            uniqueIds.sort((a, b) => (orderMap.get(a) ?? 9999) - (orderMap.get(b) ?? 9999));



            const names = uniqueIds.map((id) => nameMap.get(id) ?? id);



            if (names.length === 0) {



                const pill = el("span", "newsBadge empty", t("news.openProfiles.none"));



                openProfilesList.append(pill);



                return;



            }



            for (const name of names) {



                const pill = el("div", "openProfileItem", name);



                openProfilesList.append(pill);



            }



        }



        catch (err) {



            logErr(err, "renderer");



            const pill = el("span", "newsBadge empty", "?");



            openProfilesList.append(pill);



        }



    }







    // Layout selector for launching a profile



    const layoutOptions: LayoutType[] = ["single", "split-2", "row-3", "row-4", "grid-4", "grid-5", "grid-6", "grid-7", "grid-8"];



    const layoutDisplayNames: Record<LayoutType, string> = {



        "single": "1x1",



        "split-2": "1x2",



        "row-3": "1x3",



        "row-4": "1x4",



        "grid-4": "2x2",



        "grid-5": "3+2",



        "grid-6": "2x3",



        "grid-7": "4+3",



        "grid-8": "2x4",



    };







    /**



     * Shows window selector modal for multi-window tab support.



     * Returns the selected windowId or creates a new window.



     */



    async function showWindowSelectorForProfile(profileId: string): Promise<void> {



        const windows = await window.api.listTabWindows();







        // If there are existing windows, show selector



        if (windows.length > 0) {



            return new Promise((resolve) => {



                const overlay = el("div", "modalOverlay");



                const modal = el("div", "modal");



                const header = el("div", "modalHeader", t("multiwindow.selectWindow"));



                const body = el("div", "modalBody");



                const list = el("div", "pickerList windowSelectorList");



                body.append(list);



                modal.append(header, body);



                overlay.append(modal);



                document.body.append(overlay);







                const close = () => {



                    overlay.remove();



                    resolve();



                };







                overlay.addEventListener("click", (e) => {



                    if (e.target === overlay) close();



                });







                // "New Window" option - layout selector BEFORE creating window



                const newWindowItem = el("button", "pickerItem primary", `+ ${t("multiwindow.newWindow")}`) as HTMLButtonElement;



                newWindowItem.onclick = async () => {



                    overlay.remove();



                    // Show layout selector first, THEN create window with layout



                    await showLayoutSelectorForProfile(profileId, null); // null = create new window



                    resolve();



                };



                list.append(newWindowItem);







                // Existing windows



                for (const win of windows) {



                const item = el("button", "pickerItem") as HTMLButtonElement;



                // Prefer live window title, fall back to stored name or translation



                const windowDisplayName = win.title || win.name || t("multiwindow.unnamed");



                const windowName = el("div", "windowSelectorName", windowDisplayName);



                    const tabCount = el("div", "windowSelectorCount muted", t("multiwindow.tabsCount").replace("{count}", String(win.tabCount)));



                    item.append(windowName, tabCount);



                    item.onclick = async () => {



                        overlay.remove();



                        await showLayoutSelectorForProfile(profileId, win.id);



                        resolve();



                    };



                    list.append(item);



                }



            });



        }







        // No existing windows - show layout selector first



        await showLayoutSelectorForProfile(profileId, null);



    }







    async function showLayoutSelectorForProfile(profileId: string, windowId: string | null): Promise<void> {



        return new Promise((resolve) => {



            const overlay = el("div", "modalOverlay");



            const modal = el("div", "modal");



            const header = el("div", "modalHeader", t("layout.select"));



            const body = el("div", "modalBody");



            const list = el("div", "pickerList layoutTypeList");



            body.append(list);



            modal.append(header, body);



            overlay.append(modal);



            document.body.append(overlay);







            const close = () => {



                overlay.remove();



                resolve();



            };







            overlay.addEventListener("click", (e) => {



                if (e.target === overlay) close();



            });







            for (const layoutType of layoutOptions) {



                const item = el("button", "pickerItem", layoutDisplayNames[layoutType]) as HTMLButtonElement;



                item.onclick = async () => {



                    overlay.remove();







                    // Show grid configuration modal to select profiles for cells



                    const layoutConfig = await showGridConfigModal(profileId, layoutType);



                    if (!layoutConfig) {



                        resolve();



                        return;



                    }







                    // If windowId is null, create new window first



                    let targetWindowId = windowId;



                    if (targetWindowId === null) {



                        targetWindowId = await window.api.createTabWindow();



                    }







                    // Now create the full layout with all cells



                    await window.api.createWindowWithLayout(layoutConfig, targetWindowId, profileId);







                    resolve();



                };



                list.append(item);



            }



        });



    }







    /**



     * Shows grid configuration modal where user can assign profiles to cells



     */



    async function showGridConfigModal(initialProfileId: string, layoutType: string): Promise<any | null> {



        const config = GRID_CONFIGS[layoutType];



        if (!config) return null;







        // Get all profiles with tab mode



        const allProfiles = await window.api.profilesList();



        const tabProfiles = allProfiles.filter(p => p.launchMode === "tabs");







        // Get already open profiles from all windows



        const openProfiles = new Set<string>();



        try {



            const allOpen = await window.api.sessionTabsGetAllOpenProfiles();



            allOpen.forEach(id => openProfiles.add(id));



        } catch (err) {



            console.warn("Failed to get open profiles:", err);



        }







        return new Promise((resolve) => {



            const overlay = el("div", "modalOverlay");



            const modal = el("div", "modal");



            const header = el("div", "modalHeader", `${t("layout.select")} - ${layoutDisplayNames[layoutType]}`);



            const body = el("div", "modalBody");



            const hint = el("div", "modalHint", t("layout.gridHint") || "W�hlen Sie Profile f�r die Zellen");



            const grid = el("div", "layoutGrid");



            grid.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;



            grid.style.gridTemplateRows = `repeat(${config.rows}, 1fr)`;



            grid.style.position = "relative"; // For absolute positioning of picker menu







            const actions = el("div", "manageActions");



            const btnSave = el("button", "btn primary", t("create.save")) as HTMLButtonElement;



            const btnCancel = el("button", "btn", t("create.cancel")) as HTMLButtonElement;



            actions.append(btnSave, btnCancel);







            body.append(hint, grid);

            body.style.flex = "1 1 auto";
            body.style.minHeight = "0";
            body.style.overflowY = "auto";

            modal.append(header, body, actions);



            overlay.append(modal);



            document.body.append(overlay);







            const cells: Array<{ id: string; position: number }> = [



                { id: initialProfileId, position: 0 }



            ];







            const close = (result: any | null) => {



                overlay.remove();



                resolve(result);



            };







            overlay.addEventListener("click", (e) => {



                if (e.target === overlay) close(null);



            });







            btnCancel.onclick = () => close(null);



            btnSave.onclick = () => {



                if (cells.length === 0) return;



                const layout = {



                    type: layoutType,



                    cells: cells,



                    activePosition: 0,



                };



                close(layout);



            };







            function renderGrid() {



                grid.innerHTML = "";



                const maxCells = Math.min(config.maxViews, config.rows * config.cols);







                for (let pos = 0; pos < maxCells; pos++) {



                    const current = cells.find(c => c.position === pos);



                    const cellBtn = el("button", "gridCellBtn") as HTMLButtonElement;



                    const numSpan = el("span", "cellNum", String(pos + 1));



                    const nameSpan = el("span", "cellName",



                        current ? (tabProfiles.find(p => p.id === current.id)?.name || current.id) : t("layout.emptyCell") || "Leer"



                    );



                    cellBtn.append(numSpan, nameSpan);



                    if (!current) cellBtn.classList.add("empty");







                    cellBtn.onclick = () => {



                        // Close any existing picker menus first



                        document.querySelectorAll(".cellPickerMenu").forEach((m) => m.remove());







                        // Show profile picker for this cell



                        const pickerMenu = el("div", "cellPickerMenu") as HTMLDivElement;







                        // Available profiles (not already used in cells, not open in other windows)



                        const usedInCells = new Set(cells.filter(c => c.position !== pos).map(c => c.id));



                        const available = tabProfiles.filter(p =>



                            !usedInCells.has(p.id) && !openProfiles.has(p.id)



                        );







                        // Add current profile to list if set



                        if (current && !available.some(p => p.id === current.id)) {



                            const currentProf = tabProfiles.find(p => p.id === current.id);



                            if (currentProf) available.unshift(currentProf);



                        }







                        // "Empty" option if cell already has profile



                        if (current) {



                            const emptyBtn = el("button", "pickerItem", t("layout.emptyCell") || "Leer") as HTMLButtonElement;



                            emptyBtn.onclick = () => {



                                // Remove from cells



                                const idx = cells.findIndex(c => c.position === pos);



                                if (idx >= 0) cells.splice(idx, 1);



                                pickerMenu.remove();



                                renderGrid();



                            };



                            pickerMenu.append(emptyBtn);



                        }







                        // Profile options



                        for (const prof of available) {



                            const profBtn = el("button", "pickerItem", prof.name) as HTMLButtonElement;



                            if (current && prof.id === current.id) {



                                profBtn.classList.add("selected");



                            }



                            profBtn.onclick = () => {



                                // Update cells



                                const idx = cells.findIndex(c => c.position === pos);



                                if (idx >= 0) {



                                    cells[idx] = { id: prof.id, position: pos };



                                } else {



                                    cells.push({ id: prof.id, position: pos });



                                }



                                pickerMenu.remove();



                                renderGrid();



                            };



                            pickerMenu.append(profBtn);



                        }







                        if (available.length === 0 && !current) {



                            const noProfiles = el("div", "pickerItem muted", t("list.empty" as TranslationKey));



                            pickerMenu.append(noProfiles);



                        }







                        // Place picker below the action buttons using fixed positioning
                        pickerMenu.style.position = "fixed";
                        pickerMenu.style.zIndex = "9999999";
                        document.body.append(pickerMenu);
                        const actionsRect = actions.getBoundingClientRect();
                        const cellRect = cellBtn.getBoundingClientRect();
                        pickerMenu.style.top = `${actionsRect.bottom + 6}px`;
                        pickerMenu.style.left = `${cellRect.left}px`;
                        pickerMenu.style.maxHeight = `calc(100vh - ${actionsRect.bottom + 12}px)`;







                        // Close on outside click



                        const closeMenu = (e: MouseEvent) => {



                            if (!pickerMenu.contains(e.target as Node) && e.target !== cellBtn) {



                                pickerMenu.remove();



                                document.removeEventListener("click", closeMenu);



                            }



                        };



                        setTimeout(() => document.addEventListener("click", closeMenu), 10);



                    };







                    grid.append(cellBtn);



                }







                btnSave.disabled = cells.length === 0;



            }







            renderGrid();



        });



    }







    async function reload() {



        const prevScroll = list.scrollTop;



        profilesContainer.innerHTML = "";



        try {



            await renderLayoutChips(profilesContainer);



        }



        catch (err) {



            console.error("[layouts] render failed:", err);



            showToast(t("layout.refresh"), "error", 2500);



        }



        if (overlayDisabled && !overlayClearedOnce) {



            try {



                await window.api.profilesSetOverlayTarget(null);



                await window.api.profilesSetOverlaySupportTarget?.(null);



                overlayClearedOnce = true;



            }



            catch (e) {



                console.error("profilesSetOverlayTarget (disabled) failed:", e);



            }



        }



        let profiles: Profile[] = [];



        try {



            profiles = await window.api.profilesList();



        }



        catch (e) {



            console.error(e);



            profilesContainer.append(el("div", "muted", t("list.error")));



            return;



        }



        if (profiles.length === 0) {



            profilesContainer.append(el("div", "muted", t("list.empty")));



            return;



        }



        const searchTerm = searchInput.value.trim().toLowerCase();



        const jobFilter = jobSelect.value;



        const filteredProfiles = profiles.filter((p) => {



            const matchesSearch = p.name.toLowerCase().includes(searchTerm);



            const matchesJob = !jobFilter || (p.job ?? "") === jobFilter;



            return matchesSearch && matchesJob;



        });



        if (filteredProfiles.length === 0) {



            profilesContainer.append(el("div", "muted", t("list.noMatches")));



            return;



        }



        let draggingId: string | null = null;



        for (const p of filteredProfiles) {



            const card = el("div", "card");



            const row = el("div", "row");



            const leftInfo = el("div", "rowLeft");



            const dragHandle = el("span", "dragHandle", "=");



            const name = el("div", "rowName", p.name);



            leftInfo.append(dragHandle);



            dragHandle.setAttribute("draggable", "true");



            dragHandle.addEventListener("dragstart", (e) => {



                draggingId = p.id;



                card.classList.add("dragging");



                e.dataTransfer?.setData("text/plain", p.id);



                e.dataTransfer!.effectAllowed = "move";



                e.dataTransfer?.setDragImage(row, 20, 20);



            });



            dragHandle.addEventListener("dragend", () => {



                draggingId = null;



                card.classList.remove("dragging", "dropBefore", "dropAfter");



            });



            const actions = el("div", "rowActions");



            const btnManage = el("button", "btn", "") as HTMLButtonElement;



            const manageIcon = document.createElement("span");



            manageIcon.textContent = "⚙";


            manageIcon.setAttribute("aria-hidden", "true");



            btnManage.title = t("profile.manage");



            btnManage.setAttribute("aria-label", t("profile.manage"));



            btnManage.append(manageIcon);



            const btnPlay = el("button", "btn primary", t("profile.play"));



            const btnDel = el("button", "btn danger", t("profile.delete"));



            const btnTag = el("button", "btn", "") as HTMLButtonElement;



            btnTag.disabled = overlayDisabled;



            btnTag.title = overlayDisabled



                ? t("profile.overlay.disabled")



                : p.overlayTarget



                    ? t("profile.overlay.on")



                    : t("profile.overlay.off");



            if (!overlayDisabled && p.overlayTarget) {



                btnTag.classList.add("primary");



            }



            const img = document.createElement("img");



            img.src = aibattGold;



            img.alt = "Overlay";



            img.style.width = "100%";



            img.style.height = "100%";



            img.style.display = "block";



            img.style.objectFit = "cover";



            img.style.opacity = overlayDisabled ? "0.35" : p.overlayTarget ? "1" : "0.35";



            img.style.filter = overlayDisabled ? "grayscale(100%)" : p.overlayTarget ? "none" : "grayscale(100%)";



            btnTag.append(img);



            btnTag.style.width = "34px";



            btnTag.style.height = "34px";



            btnTag.style.display = "grid";



            btnTag.style.placeItems = "center";



            btnTag.style.padding = "0";



            btnTag.style.borderRadius = "10px";



            btnTag.style.overflow = "hidden";



            btnTag.onclick = async () => {



                if (overlayDisabled)



                    return;



                try {



                    if (p.overlayTarget) {



                        await window.api.profilesSetOverlayTarget(null);



                    }



                    else {



                        await window.api.profilesSetOverlayTarget(p.id, "aibatt-gold");



                    }



                    await reload();



                }



                catch (e) {



                    console.error("profilesSetOverlayTarget failed:", e);



                }



            };



            const btnSupport = el("button", "btn", "") as HTMLButtonElement;



            btnSupport.disabled = overlayDisabled;



            btnSupport.title = overlayDisabled



                ? t("profile.overlay.disabled")



                : p.overlaySupportTarget



                    ? "Support-Ziel aktiv (klicken zum deaktivieren)"



                    : "Als Support-Ziel markieren";



            if (!overlayDisabled && p.overlaySupportTarget) {



                btnSupport.style.background = "rgba(120,214,196,0.20)";



                btnSupport.style.borderColor = "rgba(120,214,196,0.65)";



            }



            const supportImg = document.createElement("img");



            supportImg.src = supporterIcon;



            supportImg.alt = "Support Overlay";



            supportImg.style.width = "100%";



            supportImg.style.height = "100%";



            supportImg.style.display = "block";



            supportImg.style.objectFit = "cover";



            supportImg.style.opacity = overlayDisabled ? "0.35" : p.overlaySupportTarget ? "1" : "0.35";



            supportImg.style.filter = overlayDisabled ? "grayscale(100%)" : p.overlaySupportTarget ? "none" : "grayscale(100%)";



            btnSupport.append(supportImg);



            btnSupport.style.width = "34px";



            btnSupport.style.height = "34px";



            btnSupport.style.display = "grid";



            btnSupport.style.placeItems = "center";



            btnSupport.style.padding = "0";



            btnSupport.style.borderRadius = "10px";



            btnSupport.style.overflow = "hidden";



            btnSupport.onclick = async () => {



                if (overlayDisabled)



                    return;



                try {



                    if (p.overlaySupportTarget) {



                        await window.api.profilesSetOverlaySupportTarget?.(null);



                    }



                    else {



                        await window.api.profilesSetOverlaySupportTarget?.(p.id, "supporter");



                    }



                    await reload();



                }



                catch (e) {



                    console.error("profilesSetOverlaySupportTarget failed:", e);



                }



            };



            leftInfo.append(btnTag, btnSupport, name);



            const jobBadge = createJobBadge(p.job);



            if (jobBadge)



                leftInfo.append(jobBadge);



            leftInfo.append(el("span", "badge subtle", p.launchMode === "tabs" ? t("profile.mode.tabs") : t("profile.mode.window")));



            btnDel.onclick = async () => {



                await window.api.profilesDelete(p.id);



                await reload();



            };



            actions.append(btnManage, btnPlay);



            row.append(leftInfo, actions);



            const manage = el("div", "manage hidden");



            const nameInput = document.createElement("input");



            nameInput.className = "input";



            nameInput.value = p.name;



            const jobSelect = document.createElement("select");



            jobSelect.className = "select";



            renderJobOptions(jobSelect, p.job ?? "");



            const modeWrap = el("div", "modeWrap");



            const modeLabel = el("label", "checkbox");



            const modeCheck = document.createElement("input");



            modeCheck.type = "checkbox";



            modeCheck.checked = p.launchMode === "tabs";



            modeLabel.append(modeCheck, el("span", "", t("profile.mode.useTabs")));



            modeWrap.append(modeLabel);



            const currentMode = (): "tabs" | "window" => (modeCheck.checked ? "tabs" : "window");



            btnPlay.onclick = async () => {



                await window.api.profilesUpdate({



                    id: p.id,



                    launchMode: currentMode(),



                });



                if (currentMode() === "tabs") {



                    await showWindowSelectorForProfile(p.id);



                }



                else {



                    await window.api.openWindow(p.id);



                }



            };



            const btnSave = el("button", "btn primary", t("profile.save"));



            const btnClone = el("button", "btn", t("profile.clone"));



            const btnClose = el("button", "btn", t("profile.close"));



            const clonePanel = el("div", "clonePanel hidden");



            const cloneInput = document.createElement("input");



            cloneInput.className = "input";



            cloneInput.placeholder = t("profile.clonePlaceholder");



            cloneInput.value = `${p.name} (${t("profile.copySuffix")})`;



            const cloneActions = el("div", "manageActions");



            const btnDoClone = el("button", "btn primary", t("profile.cloneConfirm"));



            const btnCloneCancel = el("button", "btn", t("profile.back"));



            cloneActions.append(btnDoClone, btnCloneCancel);



            clonePanel.append(cloneInput, cloneActions);



            btnSave.onclick = async () => {



                await window.api.profilesUpdate({



                    id: p.id,



                    name: nameInput.value.trim() || p.name,



                    job: jobSelect.value,



                    launchMode: modeCheck.checked ? "tabs" : "window",



                });



                await reload();



            };



            btnClone.onclick = () => {



                clonePanel.classList.toggle("hidden");



                cloneInput.focus();



                cloneInput.select();



            };



            btnCloneCancel.onclick = () => clonePanel.classList.add("hidden");



            btnDoClone.onclick = async () => {



                const newName = cloneInput.value.trim() || `${p.name} (Copy)`;



                await window.api.profilesClone(p.id, newName);



                clonePanel.classList.add("hidden");



                manage.classList.add("hidden");



                await reload();



            };



            btnClose.onclick = () => {



                clonePanel.classList.add("hidden");



                manage.classList.add("hidden");



            };



            const grid = el("div", "manageGrid");



            grid.append(nameInput, jobSelect, modeWrap);



            const actionBar = el("div", "manageActions");



            const actionSpacer = el("div", "spacer");



            actionBar.append(btnSave, btnClone, actionSpacer, btnDel, btnClose);



            manage.append(grid, actionBar, clonePanel);



            btnManage.onclick = () => manage.classList.toggle("hidden");



            card.addEventListener("dragover", (e) => {



                e.preventDefault();



                if (!draggingId || draggingId === p.id)



                    return;



                const rect = card.getBoundingClientRect();



                const after = e.clientY - rect.top > rect.height / 2;



                card.classList.toggle("dropAfter", after);



                card.classList.toggle("dropBefore", !after);



                e.dataTransfer!.dropEffect = "move";



            });



            card.addEventListener("dragleave", () => {



                card.classList.remove("dropBefore", "dropAfter");



            });



            card.addEventListener("drop", async (e) => {



                e.preventDefault();



                card.classList.remove("dropBefore", "dropAfter");



                const fromId = draggingId ?? e.dataTransfer?.getData("text/plain");



                const toId = p.id;



                if (!fromId || fromId === toId)



                    return;



                const rect = card.getBoundingClientRect();



                const after = e.clientY - rect.top > rect.height / 2;



                const orderedIds = reorderIds(profiles.map((x) => x.id), fromId, toId, after);



                await window.api.profilesReorder(orderedIds);



                await reload();



            });



            card.append(row, manage);



            profilesContainer.append(card);



        }



        requestAnimationFrame(() => {



            list.scrollTop = prevScroll;



        });



    }



    btnCreate.onclick = () => {



        createPanel.classList.toggle("hidden");



        createName.focus();



    };



    btnAdd.onclick = async () => {



        const name = createName.value.trim();



        if (!name)



            return;



        await window.api.profilesCreate(name);



        createName.value = "";



        createPanel.classList.add("hidden");



        await reload();



    };



    btnCancel.onclick = () => createPanel.classList.add("hidden");



    searchInput.addEventListener("input", () => {



        reload().catch(console.error);



    });



    jobSelect.addEventListener("change", () => {



        reload().catch(console.error);



    });



    btnRefreshLayouts.onclick = () => {



        reload().catch(console.error);



    };



    // Listen for layout changes from other windows (e.g., session window saving a layout)



    window.api.onLayoutsChanged?.(() => {



        reload().catch(console.error);



    });



    let tipIdx = 0;



    function showNextTip() {



        if (tips.length === 0)



            return;



        tipsText.textContent = tips[tipIdx];



        tipIdx = (tipIdx + 1) % tips.length;



    }



    showNextTip();



    setInterval(showNextTip, 6000);



    const refreshBadge = () => refreshOpenProfilesBadge().catch(console.error);



    refreshBadge();



    setInterval(refreshBadge, 5000);



    window.addEventListener("focus", refreshBadge);



    loadNews().catch(console.error);



    await reload();



}







import pkg from "../../../package.json";
import { getTips, type Locale } from "../../i18n/translations";
import { logErr } from "../../shared/logger";
import {
    aibattGold,
    supporterIcon,
    flyffuniverseIcon,
    flyffipediaIcon,
    flyffulatorIcon,
    reskillIcon,
    discordIcon,
    githubIcon,
    settingsIcon,
    GITHUB_REPO_URL,
    FLAG_ICONS,
} from "../constants";
import {
    getActiveThemeColors,
    hexToRgb,
    getUpdateAvailable,
    cachedUpdateAvailable,
} from "../theme";
import { t, currentLocale, setLocale } from "../i18n";
import {
    hideSessionViews,
    showSessionViews,
} from "../settings";
import { type Profile, el, clear, createJobIcon, createJobBadge, decorateJobSelect, showToast, fetchTabLayouts, reorderIds } from "../dom-utils";
import { openConfigModal as _openConfigModal } from "./config-modal";
import { openPluginSettingsUI as _openPluginSettingsUI } from "./plugin-settings-ui";
import { createNewsUI } from "./news";
import { showWindowSelectorForProfile } from "./profile-selectors";

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
    // --- Plugin Settings UI (delegated to module) ---
    async function openPluginSettingsUI(plugin: { id: string; name: string; hasSettingsUI?: boolean; enabled?: boolean }): Promise<void> {
        return _openPluginSettingsUI({ snapshotThemeVars, applyThemeToIframe }, plugin);
    }
    // --- Config Modal (delegated to module) ---
    function openConfigModal(defaultStyleTab: "theme" | "tabActive" = "theme", defaultTab: "style" | "plugins" | "client" | "patchnotes" | "docs" | "support" = "style") {
        return _openConfigModal({ snapshotThemeVars, applyThemeToIframe, openPluginSettingsUI }, defaultStyleTab, defaultTab);
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
    const runtimeVersion = await window.api.appGetVersion().catch(() => null);
    const launcherVersion = (typeof runtimeVersion === "string" && runtimeVersion.trim())
        ? runtimeVersion.trim()
        : pkg.version;
    const versionLabel = el("div", "versionLabel", `v${launcherVersion}`);

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
    // --- News (delegated to module) ---
    const newsUI = createNewsUI({ newsState, newsList });
    const loadNews = newsUI.loadNews;

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



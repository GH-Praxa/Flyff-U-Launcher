import type { TabLayout } from "../../shared/schemas";
import type { TranslationKey } from "../../i18n/translations";
import { logErr } from "../../shared/logger";
import { formatHotkey } from "../../shared/hotkeys";
import { GRID_CONFIGS, LAYOUT as LAYOUT_CONST } from "../../shared/constants";
import {
    flyffuniverseIcon,
    flyffipediaIcon,
    flyffulatorIcon,
    reskillIcon,
} from "../constants";
import { t, currentLocale } from "../i18n";
import {
    layoutTabDisplay,
    onLayoutTabDisplayChange,
    hideSessionViews,
    showSessionViews,
    sequentialGridLoad,
    autoSaveLayouts,
    autoSaveTimeout,
    setAutoSaveTimeout,
    getLayoutDelayMs,
    loadClientSettings,
    setLayoutDelaySeconds,
    setToastDurationSeconds,
    syncLocaleFromSettings,
    setSequentialGridLoad,
} from "../settings";
import { type Profile, qs, el, clear, createJobIcon, showToast, withTimeout, fetchTabLayouts } from "../dom-utils";
import { tr, buildFcoinConverterHtml, buildShoppingListHtml, buildUpgradeCalculatorHtml, getThemeVars } from "./tools-html";

export async function renderSession(root: HTMLElement) {

    clear(root);
    root.className = "sessionRoot";
    const tabsBar = el("div", "tabs");
    // Layout-Progress-Anzeige in der Tab-Leiste
    const tabsProgress = el("button", "tabBtn progressTab");
    const tabsProgressFill = el("div", "progressTabFill");
    const tabsProgressLabel = el("span", "progressTabLabel", "");
    tabsProgress.append(tabsProgressFill, tabsProgressLabel);
    tabsProgress.style.display = "none";
    tabsProgress.tabIndex = -1;
    const initialLayoutId = qs().get("layoutId");
    const initialProfileId = qs().get("openProfileId");
    let initialLayoutPendingId: string | null = initialLayoutId;
    let initialLayoutFallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const markInitialLayoutHandled = (layoutId: string) => {

        if (initialLayoutId && layoutId === initialLayoutId) {
            initialLayoutPendingId = null;
            if (initialLayoutFallbackTimer) {
                clearTimeout(initialLayoutFallbackTimer);
                initialLayoutFallbackTimer = null;
            }
        }
    };

    const setLayoutStatus = (text: string, tone: "info" | "success" | "error" = "info") => {

        // Keep a lightweight log for layout actions (no dedicated UI element yet).
        console.debug("[layout-status]", tone, text);
    };

    type LoadProgress = { active: boolean; total: number; done: number };

    const loadProgress: LoadProgress = { active: false, total: 0, done: 0 };

    function applyProgressDisplay() {

        if (!loadProgress.active || loadProgress.total <= 0) {
            tabsProgress.style.display = "none";
            tabsProgressLabel.textContent = "";
            tabsProgressFill.style.width = "0%";
            return;
        }
        const safeDone = Math.max(0, Math.min(loadProgress.total, Math.round(loadProgress.done)));
        tabsProgress.style.display = "inline-flex";
        tabsProgressLabel.textContent = `${safeDone}/${loadProgress.total}`;
        const pct = loadProgress.total > 0 ? (safeDone / loadProgress.total) * 100 : 0;
        tabsProgressFill.style.width = `${pct}%`;
    }
    let progressHideTimer: ReturnType<typeof setTimeout> | null = null;

    function finishLoadProgress() {

        if (progressHideTimer) {
            clearTimeout(progressHideTimer);
            progressHideTimer = null;
        }
        loadProgress.active = false;
        loadProgress.total = 0;
        loadProgress.done = 0;
        applyProgressDisplay();
    }

    function scheduleProgressHide() {

        if (progressHideTimer) {
            clearTimeout(progressHideTimer);
        }
        progressHideTimer = setTimeout(() => {
            progressHideTimer = null;
            finishLoadProgress();
        }, 3000);
    }

    function startLoadProgress(total: number) {

        // Cancel any pending hide timer when new progress starts
        if (progressHideTimer) {
            clearTimeout(progressHideTimer);
            progressHideTimer = null;
        }
        const nextTotal = Math.max(0, Math.round(total));
        if (loadProgress.active && nextTotal <= loadProgress.total) {
            return;
        }
        loadProgress.active = nextTotal > 0;
        loadProgress.total = nextTotal;
        loadProgress.done = 0;
        applyProgressDisplay();
    }

    function incrementLoadProgress(by = 1) {

        if (!loadProgress.active)
            return;
        loadProgress.done = Math.min(loadProgress.total, loadProgress.done + by);
        applyProgressDisplay();
        // Schedule hide when all items are loaded
        if (loadProgress.done >= loadProgress.total) {
            scheduleProgressHide();
        }
    }
    // Backwards compatible helper used in existing code paths

    function setLayoutProgress(done: number | null, total?: number) {

        if (done === null || total === undefined || total <= 0 || Number.isNaN(done)) {
            finishLoadProgress();
            return;
        }
        // Cancel any pending hide timer when new progress comes in
        if (progressHideTimer) {
            clearTimeout(progressHideTimer);
            progressHideTimer = null;
        }
        // Update/override totals only when an explicit value is passed
        loadProgress.active = true;
        loadProgress.total = Math.max(loadProgress.total, Math.round(total));
        loadProgress.done = Math.max(loadProgress.done, Math.round(done));
        applyProgressDisplay();
        if (loadProgress.done >= loadProgress.total) {
            // Schedule hide after 3 seconds instead of immediate
            scheduleProgressHide();
        }
    }
    let layoutApplyChain: Promise<void> = Promise.resolve();

    function enqueueLayoutApply(task: () => Promise<void>): Promise<void> {

        const run = layoutApplyChain.then(() => task());
        layoutApplyChain = run.catch(() => undefined);
        return run;
    }

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const content = el("div", "content");
    const loginOverlay = el("div", "sessionLoginOverlay") as HTMLDivElement;
    const loginTitle = el("div", "sessionLoginTitle", t("session.loggedOut"));
    const loginName = el("div", "sessionLoginName", "");
    const loginHint = el("div", "sessionLoginHint", t("session.loginHint"));
    const btnLogin = el("button", "btn primary", t("session.login")) as HTMLButtonElement;
    loginOverlay.append(loginTitle, loginName, loginHint, btnLogin);
    content.append(loginOverlay);
    root.append(tabsBar, content);
        loadClientSettings()
            .then((settings) => {
            setLayoutDelaySeconds(settings.layoutDelaySeconds);
            setToastDurationSeconds(settings.toastDurationSeconds);
            setSequentialGridLoad(settings.seqGridLoad ?? false);
        })
            .catch((err) => logErr(err, "renderer"));
    // Layout types need to be defined before Tab type

    type LayoutType = keyof typeof GRID_CONFIGS;

    type GridCell = { id: string; position: number };

    type LayoutState = {

        type: LayoutType;
        cells: GridCell[];
        ratio?: number;
        activePosition?: number;
    };
    // Tab types - support for single-profile and layout tabs

    type TabKind = "single" | "layout";

    type Tab = {

        id: string;                    // Unique tab ID
        type: TabKind;                 // "single" or "layout"
        profileId?: string;            // Only for type="single"
        layout?: LayoutState;          // Only for type="layout"
        name: string;                  // Display name
        tabBtn: HTMLButtonElement;
        cellButtons?: HTMLElement[];   // Only for type="layout": chip buttons when expanded view is enabled
        loggedOut?: boolean;           // Only for type="single"
    };

    type CloseChoice = "tab" | "dissolve" | "window" | "app" | "cancel";

    type CloseTarget =

        | { kind: "single"; profileId: string; label: string }
        | { kind: "layout"; tabId: string; label: string };
    const defaultSplitRatio = LAYOUT_CONST.DEFAULT_SPLIT_RATIO;
    const minSplitRatio = LAYOUT_CONST.MIN_SPLIT_RATIO;
    const maxSplitRatio = LAYOUT_CONST.MAX_SPLIT_RATIO;
    // Generate unique tab IDs
    let tabIdCounter = 0;

    function generateTabId(): string {

        return `tab-${Date.now()}-${++tabIdCounter}`;
    }

    const tabs: Tab[] = [];
    let activeTabId: string | null = null;     // Current active tab ID (single or layout)
    let activeProfileId: string | null = null; // Current active profile ID within a tab
    let layoutState: LayoutState | null = null; // Current visible layout (for rendering)
    let currentSplitRatio = defaultSplitRatio;

    const refreshLayoutDisplayMode = () => {

        tabsBar.dataset.layoutDisplay = layoutTabDisplay;
        for (const t of tabs) {
            if (t.type === "layout") {
                renderLayoutTabUi(t);
            }
        }
        syncTabClasses();
    };
    onLayoutTabDisplayChange(refreshLayoutDisplayMode);
    refreshLayoutDisplayMode();
    // Helper functions for the new tab architecture

    function findTabById(tabId: string): Tab | null {

        return tabs.find((t) => t.id === tabId) ?? null;
    }

    function findTabByProfileId(profileId: string): Tab | null {

        return tabs.find((t) => t.type === "single" && t.profileId === profileId) ?? null;
    }

    function findLayoutTab(): Tab | null {

        return tabs.find((t) => t.type === "layout") ?? null;
    }

    function getActiveTab(): Tab | null {

        if (!activeTabId) return null;
        return findTabById(activeTabId);
    }

    function isProfileInAnyLayout(profileId: string): boolean {

        return tabs.some((t) => t.type === "layout" && t.layout?.cells.some((c) => c.id === profileId));
    }
    const profileNameCache = new Map<string, string>();
    const profileJobCache = new Map<string, string | null>();

    function rememberProfileName(profileId: string, name?: string | null, job?: string | null): void {

        if (!profileId) return;
        const trimmed = name?.trim();
        if (trimmed) {
            profileNameCache.set(profileId, trimmed);
        }
        if (job !== undefined) {
            profileJobCache.set(profileId, job?.trim() || null);
        }
    }

    function getProfileLabel(profileId: string): string {

        return (
            profileNameCache.get(profileId) ??
            findSingleTab(profileId)?.name ??
            profileId
        );
    }

    function getProfileJob(profileId: string): string | null {

        return profileJobCache.get(profileId) ?? null;
    }

    async function resolveProfileName(profileId: string): Promise<string | null> {

        const cached = profileNameCache.get(profileId);
        if (cached) return cached;
        try {
            const profiles = await window.api.profilesList();
            for (const p of profiles) {
                rememberProfileName(p.id, p.name, p.job as string | null | undefined);
            }
        }
        catch (err) {
            logErr(err, "renderer");
        }
        return profileNameCache.get(profileId) ?? null;
    }

    function isGenericSingleLayoutName(name?: string | null): boolean {

        if (!name) return true;
        const normalized = name.replace(/[×]/g, "x").toLowerCase().replace(/\s+/g, " ").trim();
        return normalized === "1x1 layout" || normalized === "1 x 1 layout";
    }

    async function deriveLayoutTabName(layout: LayoutState, providedName?: string): Promise<string> {

        const config = GRID_CONFIGS[layout.type];
        const gridDefaultName = `${config?.rows ?? 1}×${config?.cols ?? 1} Layout`;
        const isSingleLayout = layout.type === "single" && layout.cells.length === 1;
        if (!isSingleLayout) {
            return providedName || gridDefaultName;
        }
        const profileId = layout.cells[0].id;
        const profileName = (await resolveProfileName(profileId)) ?? profileId;
        if (!providedName) {
            return profileName;
        }
        if (isGenericSingleLayoutName(providedName) || providedName === gridDefaultName) {
            return profileName;
        }
        return providedName;
    }

    function buildLayoutChips(layout: LayoutState): { group: HTMLElement; chips: HTMLElement[] } {

        const group = el("div", "layoutTabGroup");
        const sortedCells = [...layout.cells].sort((a, b) => a.position - b.position);
        const chips: HTMLElement[] = [];
        const missingJobs: { chip: HTMLElement; cellId: string }[] = [];
        for (const cell of sortedCells) {
            const chip = el("div", "layoutTabChip");
            chip.dataset.profileId = cell.id;
            chip.title = getProfileLabel(cell.id);
            chip.draggable = false;
            const job = getProfileJob(cell.id);
            const jobIcon = createJobIcon(job ?? undefined, "tabJobIcon");
            if (jobIcon)
                chip.append(jobIcon);
            else
                missingJobs.push({ chip, cellId: cell.id });
            chip.append(el("span", "tabLabel", getProfileLabel(cell.id)));
            chips.push(chip);
            group.append(chip);
        }
        // Async refresh: fetch profiles, insert missing job icons, and update labels
        window.api.profilesList().then((profiles: Profile[]) => {
            for (const p of profiles)
                rememberProfileName(p.id, p.name, p.job);
            for (const { chip, cellId } of missingJobs) {
                const job = getProfileJob(cellId);
                const icon = createJobIcon(job ?? undefined, "tabJobIcon");
                if (icon) {
                    const label = chip.querySelector(".tabLabel");
                    if (label) chip.insertBefore(icon, label);
                    else chip.prepend(icon);
                }
            }
            // Update chip labels with resolved profile names
            for (const chip of chips) {
                const pid = chip.dataset.profileId;
                if (!pid) continue;
                const resolved = getProfileLabel(pid);
                const label = chip.querySelector(".tabLabel");
                if (label && label.textContent !== resolved) {
                    label.textContent = resolved;
                }
                chip.title = resolved;
            }
        }).catch(console.error);
        return { group, chips };
    }

    function renderLayoutTabUi(tab: Tab): void {

        if (tab.type !== "layout" || !tab.layout)
            return;
        const mode = layoutTabDisplay;
        (tab.tabBtn as HTMLButtonElement).type = "button";
        tab.cellButtons = undefined;
        tab.tabBtn.className = "tabBtn layoutTab";
        tab.tabBtn.dataset.layoutType = tab.layout.type;
        tab.tabBtn.dataset.display = mode;
        tab.tabBtn.replaceChildren();
        tab.tabBtn.draggable = true;
        if (mode === "compact") {
            const iconSpan = el("span", "layoutTabIcon", "▦");
            const nameSpan = el("span", "tabLabel", tab.name);
            const badge = el("span", "layoutTabBadge", String(tab.layout.cells.length));
            const closeBtn = el("span", "tabClose", "×");
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                handleLayoutCloseClick(tab.id);
            };
            tab.tabBtn.append(iconSpan, nameSpan, badge, closeBtn);
        }
        else if (mode === "mini-grid") {
            tab.tabBtn.classList.add("layoutMode-mini-grid");
            const config = GRID_CONFIGS[tab.layout.type] ?? { rows: 1, cols: 1 };
            const grid = el("div", "miniGrid");
            (grid as HTMLElement).style.setProperty("--mg-rows", String(config.rows));
            (grid as HTMLElement).style.setProperty("--mg-cols", String(config.cols));
            const sortedCells = [...tab.layout.cells].sort((a, b) => a.position - b.position);
            const cellEls: HTMLElement[] = [];
            for (const cell of sortedCells) {
                const cellEl = el("div", "miniGridCell");
                cellEl.dataset.profileId = cell.id;
                cellEl.title = getProfileLabel(cell.id);
                const job = getProfileJob(cell.id);
                const icon = createJobIcon(job ?? undefined, "miniGridIcon");
                if (icon) cellEl.append(icon);
                else cellEl.append(el("span", "miniGridDot", ""));
                grid.append(cellEl);
                cellEls.push(cellEl);
            }
            const closeBtn = el("span", "tabClose", "×");
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                handleLayoutCloseClick(tab.id);
            };
            tab.tabBtn.append(grid, closeBtn);
            tab.cellButtons = cellEls;
        }
        else {
            const { group, chips } = buildLayoutChips(tab.layout);
            if (mode === "grouped")
                group.classList.add("tight");
            if (mode === "separated")
                group.classList.add("separated");
            tab.tabBtn.classList.add(`layoutMode-${mode}`);
            const closeBtn = el("span", "tabClose", "×");
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                handleLayoutCloseClick(tab.id);
            };
            tab.tabBtn.append(group, closeBtn);
            tab.cellButtons = chips;
        }
        tab.tabBtn.onclick = () => {
            switchToTab(tab.id).catch(console.error);
        };
        tab.tabBtn.oncontextmenu = (e) => {
            e.preventDefault();
            showLayoutTabContextMenu(tab.id, e as MouseEvent);
        };
    }
    /**
     * Create a layout tab from a LayoutState.
     * This creates a single tab that represents multiple profiles in a grid/split layout.
     */

    async function createLayoutTab(layout: LayoutState, name?: string): Promise<Tab> {

        const id = generateTabId();
        const displayName = await deriveLayoutTabName(layout, name);
        const tab: Tab = {
            id,
            type: "layout",
            layout,
            name: displayName,
            tabBtn: document.createElement("button"),
        };
        renderLayoutTabUi(tab);
        attachDnd(tab.tabBtn, id);
        return tab;
    }
    /**
     * Dissolve a layout tab back into individual single tabs.
     */

    async function handleLayoutCloseClick(tabId: string) {

        const layoutTab = findTabById(tabId);
        if (!layoutTab || layoutTab.type !== "layout") return;
        // Ensure this layout is active so getCloseTarget picks it up
        if (activeTabId !== tabId) {
            await switchToTab(tabId);
        }
        await handleCloseChoice();
    }

    async function dissolveLayoutTab(tabId: string) {

        const layoutTab = findTabById(tabId);
        if (!layoutTab || layoutTab.type !== "layout" || !layoutTab.layout) return;
        const wasActive = activeTabId === tabId;
        const profiles = layoutTab.layout.cells.map((c) => c.id);
        // Remove the layout tab
        const idx = tabs.findIndex((t) => t.id === tabId);
        if (idx >= 0) {
            tabs[idx].tabBtn.remove();
            tabs.splice(idx, 1);
        }
        // Create single tabs for each profile (BrowserViews already exist)
        for (const profileId of profiles) {
            if (!findSingleTab(profileId)) {
                // Need to create single tab button (view already exists in main)
                const profilesList: Profile[] = await window.api.profilesList();
                const p = profilesList.find((x) => x.id === profileId);
                rememberProfileName(profileId, p?.name, p?.job);
                const title = p?.name ?? profileId;
                const tabBtn = document.createElement("button");
                tabBtn.className = "tabBtn sessionTab";
                tabBtn.dataset.title = title;
                const splitGlyph = el("span", "tabGlyph", "");
                (splitGlyph as HTMLElement).style.display = "none";
                const jobIcon = createJobIcon(p?.job, "tabJobIcon");
                const label = el("span", "tabLabel", title);
                if (p?.job?.trim()) tabBtn.title = p.job;
                const closeBtn = el("span", "tabClose", "×");
                closeBtn.onclick = (e) => {
                    e.stopPropagation();
                    handleCloseChoice(profileId).catch(console.error);
                };
                tabBtn.append(splitGlyph);
                if (jobIcon) tabBtn.append(jobIcon);
                tabBtn.append(label, closeBtn);
                tabBtn.onclick = () => {
                    setActive(profileId, "left").catch(console.error);
                };
                tabBtn.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    setActive(profileId, "right").catch(console.error);
                });
                attachDnd(tabBtn, profileId);
                const tab: Tab = {
                    id: generateTabId(),
                    type: "single",
                    profileId,
                    name: title,
                    tabBtn,
                    loggedOut: false,
                };
                tabs.push(tab);
            }
        }
        // Clear layout state
        layoutState = null;
        renderTabsOrder();
        updateSplitButton();
        syncTabClasses();
        updateSplitGlyphs();
        // Activate the first profile if this was the active tab
        if (wasActive && profiles.length > 0) {
            await setActive(profiles[0]);
        }
        scheduleAutoSave();
        updateWindowTitle();
        showToast(t("layout.dissolved"), "info");
    }
    /**
     * Show context menu for layout tab (rename, dissolve)
     */

    async function showLayoutTabContextMenu(tabId: string, e: MouseEvent) {

        const tab = findTabById(tabId);
        if (!tab || tab.type !== "layout") return;
        e.preventDefault();
        // Ask main process to show a native context menu (drawn above BrowserViews)
        const choice = await window.api.sessionTabsShowLayoutMenu?.({ x: e.screenX, y: e.screenY });
        if (choice === "rename") {
            const newName = await askLayoutName(tab.name);
            if (newName && newName !== tab.name) {
                tab.name = newName;
                renderLayoutTabUi(tab);
                scheduleAutoSave();
            }
        }
        else if (choice === "dissolve") {
            dissolveLayoutTab(tabId).catch(console.error);
        }
    }
    /**
     * Activate a multi-view layout, creating a layout tab and removing single tabs for those profiles.
     */

    async function activateMultiLayout(layout: LayoutState, name?: string, targetTabId?: string | null) {

        // Remove existing single tabs for profiles that will be in the layout
        for (const cell of layout.cells) {
            const existingSingle = findSingleTab(cell.id);
            if (existingSingle) {
                existingSingle.tabBtn.remove();
                const idx = tabs.indexOf(existingSingle);
                if (idx >= 0) tabs.splice(idx, 1);
            }
        }
        const isSingleLayout = layout.type === "single" && layout.cells.length === 1;
        if (isSingleLayout) {
            const profileId = layout.cells[0].id;
            await openTab(profileId);
            layoutState = null;
            activeProfileId = profileId;
            activeTabId = findSingleTab(profileId)?.id ?? activeTabId;
            currentSplitRatio = defaultSplitRatio;
            return;
        }
        const activeTab = getActiveTab();
        const explicitTarget = targetTabId ? findTabById(targetTabId) : null;
        const targetLayoutTab =
            explicitTarget && explicitTarget.type === "layout"
                ? explicitTarget
                : activeTab?.type === "layout" && activeTab.layout?.type === layout.type
                    ? activeTab
                    : null;
        if (targetLayoutTab) {
            const resolvedName = await deriveLayoutTabName(layout, name ?? targetLayoutTab.name);
            targetLayoutTab.layout = layout;
            targetLayoutTab.name = resolvedName;
            renderLayoutTabUi(targetLayoutTab);
            layoutState = layout;
            activeTabId = targetLayoutTab.id;
        }
        else {
            // Create new layout tab
            const layoutTab = await createLayoutTab(layout, name);
            tabs.push(layoutTab);
            tabsBar.insertBefore(layoutTab.tabBtn, tabsSpacer);
            layoutState = layout;
            activeTabId = layoutTab.id;
        }
        // Set active profile from layout
        const activeCell = layout.cells.find((c) => c.position === layout.activePosition) ?? layout.cells[0];
        activeProfileId = activeCell?.id ?? null;
        currentSplitRatio = layout.ratio ?? currentSplitRatio;
        const startedHere = !loadProgress.active;
        if (!sequentialGridLoad) {
            // Parallel: create all BrowserViews, then push layout once
            const orderedCells = [...layout.cells];
            if (startedHere) startLoadProgress(orderedCells.length);
            await Promise.all(
                orderedCells.map((cell) =>
                    window.api.sessionTabsOpen(cell.id).catch(console.error).then(() => incrementLoadProgress())
                )
            );
            await pushLayoutToMain();
        }
        else {
            // Sequential: push full layout skeleton first, then materialize each cell one by one
            const orderedCells = [...layout.cells].sort((a, b) => a.position - b.position);
            const totalCells = orderedCells.length;
            if (startedHere)
                startLoadProgress(totalCells);
            const skeletonLayout: LayoutState = {
                type: layout.type,
                cells: orderedCells,
                ratio: layout.ratio,
                activePosition: layout.activePosition ?? orderedCells[0].position,
            };
            await window.api.sessionTabsSetMultiLayout(skeletonLayout, { ensureViews: false, allowMissingViews: true }).catch(console.error);
            pushBoundsInternal(true);
            const delayMs = getLayoutDelayMs();
            for (let i = 0; i < orderedCells.length; i += 1) {
                const cell = orderedCells[i];
                await window.api.sessionTabsOpenInCell(cell.position, cell.id, {
                    activate: cell.position === skeletonLayout.activePosition,
                }).catch(console.error);
                pushBoundsInternal(true);
                incrementLoadProgress();
                if (i < orderedCells.length - 1 && delayMs > 0) {
                    await sleep(delayMs);
                }
            }
            // Apply the delay once more after the last view to avoid an immediate tab switch
            if (orderedCells.length > 1 && delayMs > 0) {
                await sleep(delayMs);
            }
            // Finalize layout with correct bounds/ratio and disable missing-view tolerance
            const finalLayoutForMain: LayoutState = {
                type: layout.type,
                cells: orderedCells,
                ratio: layout.ratio ?? currentSplitRatio,
                activePosition: skeletonLayout.activePosition,
            };
            await window.api.sessionTabsSetMultiLayout(finalLayoutForMain, { ensureViews: true, allowMissingViews: false }).catch(console.error);
            // Fortschritt wird nur abgeschlossen, wenn alle geplanten Tabs/Views fertig sind
        }
        if (activeProfileId) {
            await window.api.sessionTabsSwitch(activeProfileId);
        }
        updateSplitButton();
        updateSplitGlyphs();
        syncTabClasses();
        kickBounds();
        scheduleAutoSave();
    }
    let pendingSplitAnchor: string | null = null;
    let closePromptOpen = false;
    let currentLayoutId: string | null = null;
    let isApplyingLayout = false;
    const TAB_HEIGHT_KEY = "sessionTabHeightPx";
    const tabHeightPresets = [28, 32, 36, 40, 44, 48, 52, 56, 60, 64];

    function loadTabHeight() {

        try {
            const raw = localStorage.getItem(TAB_HEIGHT_KEY);
            const num = raw ? Number(raw) : NaN;
            if (Number.isFinite(num))
                return num;
        }
        catch (err) {
            logErr(err, "renderer");
        }
        return tabHeightPresets[1];
    }

    function persistTabHeight(px: number) {

        try {
            localStorage.setItem(TAB_HEIGHT_KEY, String(px));
        }
        catch (err) {
            logErr(err, "renderer");
        }
    }

    function applyTabHeight(px: number) {

        const clamped = Math.max(28, Math.min(64, Math.round(px)));
        document.documentElement.style.setProperty("--session-tab-height", `${clamped}px`);
        persistTabHeight(clamped);
        return clamped;
    }
    let tabHeightPx = applyTabHeight(loadTabHeight());

    function clampSplitRatio(r: number) {

        const value = Number.isFinite(r) ? r : defaultSplitRatio;
        return Math.min(maxSplitRatio, Math.max(minSplitRatio, value));
    }

    function normalizeLayoutState(next: LayoutState | null): LayoutState | null {

        if (!next)
            return null;
        const config = GRID_CONFIGS[next.type];
        if (!config)
            return null;
        const maxPositions = config.rows * config.cols;
        const unique = new Map<number, GridCell>();
        for (const cell of next.cells) {
            const pos = Math.max(0, Math.min(maxPositions - 1, cell.position));
            if (!unique.has(pos)) {
                unique.set(pos, { id: cell.id, position: pos });
            }
        }
        const cells = Array.from(unique.values()).sort((a, b) => a.position - b.position).slice(0, config.maxViews);
        if (cells.length === 0)
            return null;
        const activePosition = next.activePosition !== undefined && cells.some((c) => c.position === next.activePosition)
            ? next.activePosition
            : cells[0].position;
        const ratio = next.type === "split-2" ? clampSplitRatio(next.ratio ?? currentSplitRatio) : undefined;
        return { type: next.type, cells, ratio, activePosition };
    }

    function pruneLayoutState(): void {

        if (!layoutState)
            return;
        // Collect all known profile IDs from single tabs AND layout tabs
        const existing = new Set<string>();
        for (const t of tabs) {
            if (t.type === "single" && t.profileId) {
                existing.add(t.profileId);
            } else if (t.type === "layout" && t.layout) {
                for (const cell of t.layout.cells) {
                    existing.add(cell.id);
                }
            }
        }
        layoutState = normalizeLayoutState({
            ...layoutState,
            cells: layoutState.cells.filter((c) => existing.has(c.id)),
        });
        if (layoutState) {
            const activeCell = layoutState.cells.find((c) => c.position === layoutState!.activePosition) ?? layoutState.cells[0];
            activeProfileId = activeCell?.id ?? activeProfileId;
            currentSplitRatio = layoutState.ratio ?? currentSplitRatio;
        }
    }

    async function pushLayoutToMain(): Promise<void> {

        pruneLayoutState();
        const activeIsLoggedOut = isProfileLoggedOut(activeProfileId);
        if (layoutState) {
            const opts = layoutHasLoggedOut(layoutState)
                ? { ensureViews: false, allowMissingViews: true }
                : undefined;
            await window.api.sessionTabsSetMultiLayout?.(layoutState, opts);
            return;
        }
        if (activeProfileId) {
            if (activeIsLoggedOut) {
                const skeleton: LayoutState = {
                    type: "single",
                    cells: [{ id: activeProfileId, position: 0 }],
                    ratio: currentSplitRatio,
                    activePosition: 0,
                };
                await window.api.sessionTabsSetMultiLayout?.(skeleton, { ensureViews: false, allowMissingViews: true });
                return;
            }
            await window.api.sessionTabsSwitch(activeProfileId).catch((err) => logErr(err, "renderer"));
            return;
        }
        await window.api.sessionTabsSetMultiLayout?.(null);
    }
    const tabsSpacer = el("div", "spacer");
    const btnSplit = el("button", "tabBtn iconBtn plus", "+") as HTMLButtonElement;
    btnSplit.draggable = false;
    const splitControls = el("div", "splitControls") as HTMLDivElement;
    splitControls.style.display = "none";
    const splitSlider = document.createElement("input");
    splitSlider.type = "range";
    splitSlider.className = "splitSlider";
    splitSlider.min = String(Math.round(minSplitRatio * 100));
    splitSlider.max = String(Math.round(maxSplitRatio * 100));
    splitSlider.value = String(Math.round(defaultSplitRatio * 100));
    splitSlider.step = "1";
    splitSlider.title = "Fensteraufteilung anpassen";
    splitSlider.ariaLabel = "Fensteraufteilung anpassen";
    const splitSliderValue = el("span", "splitSliderValue", "50 / 50");
    splitControls.append(splitSlider, splitSliderValue);
    const btnTabHeight = el("button", "tabBtn iconBtn", `${tabHeightPx}↕`) as HTMLButtonElement;
    btnTabHeight.title = `${t("tabHeight.label")}: ${tabHeightPx}px`;
    btnTabHeight.draggable = false;
    btnTabHeight.onclick = () => {
        const idx = tabHeightPresets.findIndex((v) => v === tabHeightPx);
        const nextIdx = (idx + 1) % tabHeightPresets.length;
        tabHeightPx = applyTabHeight(tabHeightPresets[nextIdx]);
        btnTabHeight.textContent = `${tabHeightPx}↕`;
        btnTabHeight.title = `${t("tabHeight.label")}: ${tabHeightPx}px`;
        kickBounds();
    };
    // --- Hotkeys button ---
    const btnHotkeys = el("button", "tabBtn iconBtn hotkeysToggle") as HTMLButtonElement;
    btnHotkeys.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.4"/><rect x="3.5" y="5.5" width="2" height="2" rx="0.4" fill="currentColor"/><rect x="7" y="5.5" width="2" height="2" rx="0.4" fill="currentColor"/><rect x="10.5" y="5.5" width="2" height="2" rx="0.4" fill="currentColor"/><rect x="4.5" y="9" width="7" height="1.8" rx="0.4" fill="currentColor"/></svg>`;
    btnHotkeys.title = "Hotkeys";
    btnHotkeys.draggable = false;
    btnHotkeys.setAttribute("aria-label", "Hotkeys");
    const hotkeysMenu = el("div", "toolsMenu hotkeysMenu") as HTMLDivElement;
    hotkeysMenu.style.position = "fixed";
    hotkeysMenu.style.zIndex = "99999";
    hotkeysMenu.style.display = "none";
    const hotkeysList = el("div", "toolsMenuList");
    hotkeysMenu.append(hotkeysList);
    let hotkeysMenuOpen = false;
    const handleHotkeysOutsideClick = (e: MouseEvent) => {
        if (!(e.target instanceof Node)) return;
        if (hotkeysMenu.contains(e.target) || btnHotkeys.contains(e.target)) return;
        closeHotkeysMenu();
    };
    const handleHotkeysKeydown = (e: KeyboardEvent) => {
        if (e.key === "Escape") closeHotkeysMenu();
    };
    function closeHotkeysMenu() {
        if (!hotkeysMenuOpen) return;
        hotkeysMenu.classList.remove("show");
        hotkeysMenu.style.display = "none";
        btnHotkeys.setAttribute("aria-expanded", "false");
        hotkeysMenuOpen = false;
        document.removeEventListener("mousedown", handleHotkeysOutsideClick);
        document.removeEventListener("keydown", handleHotkeysKeydown);
        window.removeEventListener("resize", closeHotkeysMenu);
        void showSessionViews();
    }
    function positionHotkeysMenu() {
        const btnRect = btnHotkeys.getBoundingClientRect();
        const menuWidth = hotkeysMenu.offsetWidth || 260;
        const viewportW = window.innerWidth;
        let left = btnRect.left;
        if (left + menuWidth > viewportW - 8) {
            left = Math.max(8, btnRect.right - menuWidth);
        }
        hotkeysMenu.style.left = `${left}px`;
        hotkeysMenu.style.top = `${btnRect.bottom + 6}px`;
    }
    async function openHotkeysMenu() {
        hotkeysList.innerHTML = "";
        try {
            const settings = await (window.api as any).clientSettingsGet();
            const hk = (settings as any)?.hotkeys;
            const HOTKEY_LABELS: Record<string, string> = {
                toggleOverlays: t("config.client.hotkeys.toggleOverlays" as TranslationKey),
                sidePanelToggle: t("config.client.hotkeys.sidePanelToggle" as TranslationKey),
                tabBarToggle: t("config.client.hotkeys.tabBarToggle" as TranslationKey),
                screenshotWindow: t("config.client.hotkeys.screenshotWindow" as TranslationKey),
                tabPrev: t("config.client.hotkeys.tabPrev" as TranslationKey),
                tabNext: t("config.client.hotkeys.tabNext" as TranslationKey),
                nextInstance: t("config.client.hotkeys.nextInstance" as TranslationKey),
                cdTimerExpireAll: t("config.client.hotkeys.cdTimerExpireAll" as TranslationKey),
                showFcoinConverter: t("config.client.hotkeys.showFcoinConverter" as TranslationKey),
                showShoppingList: t("config.client.hotkeys.showShoppingList" as TranslationKey),
            };
            let count = 0;
            if (hk) {
                for (const [key, chord] of Object.entries(hk)) {
                    const formatted = formatHotkey(chord as any);
                    if (!formatted) continue;
                    const item = el("div", "toolsMenuItem hotkeysItem");
                    const label = el("span", "toolsMenuLabel", HOTKEY_LABELS[key] || key);
                    const badge = el("span", "toolsMenuArrow hotkeyBadge", formatted);
                    item.append(label, badge);
                    hotkeysList.append(item);
                    count++;
                }
            }
            if (count === 0) {
                const empty = el("div", "toolsMenuItem muted", t("config.client.hotkeys.tabBarToggle.hint" as TranslationKey) || "No hotkeys set");
                hotkeysList.append(empty);
            }
        } catch (err) {
            logErr(err, "renderer");
            const errItem = el("div", "toolsMenuItem muted", "Error loading hotkeys");
            hotkeysList.append(errItem);
        }
        hotkeysMenu.style.display = "flex";
        hotkeysMenu.classList.add("show");
        positionHotkeysMenu();
        const rect = hotkeysMenu.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            hotkeysMenu.style.left = "12px";
            hotkeysMenu.style.top = "48px";
        } else if (rect.right > window.innerWidth - 8) {
            hotkeysMenu.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`;
        }
        btnHotkeys.setAttribute("aria-expanded", "true");
        hotkeysMenuOpen = true;
        void hideSessionViews();
        document.addEventListener("mousedown", handleHotkeysOutsideClick);
        document.addEventListener("keydown", handleHotkeysKeydown);
        window.addEventListener("resize", closeHotkeysMenu);
    }
    btnHotkeys.onclick = () => {
        if (hotkeysMenuOpen) closeHotkeysMenu();
        else void openHotkeysMenu();
    };
    const btnTools = el("button", "tabBtn iconBtn toolsToggle", "★") as HTMLButtonElement;
    btnTools.title = "Tools";
    btnTools.draggable = false;
    btnTools.setAttribute("aria-label", "Tools");
    const btnEditMode = el("button", "tabBtn iconBtn lockToggle", "🔒") as HTMLButtonElement;
    btnEditMode.title = "Profile ausloggen";
    btnEditMode.draggable = false;
    const btnSaveLayout = el("button", "tabBtn iconBtn", "💾") as HTMLButtonElement;
    btnSaveLayout.title = t("layout.saveCurrent");
    btnSaveLayout.draggable = false;
    const btnLayouts = el("button", "tabBtn iconBtn", "📂") as HTMLButtonElement;
    btnLayouts.title = t("layout.pick");
    btnLayouts.draggable = false;
    const toolsMenu = el("div", "toolsMenu") as HTMLDivElement;
    // Inline defaults as Fallback, falls CSS nicht greift
    toolsMenu.style.position = "fixed";
    toolsMenu.style.zIndex = "99999";
    toolsMenu.style.display = "none";
    const toolsList = el("div", "toolsMenuList");
    toolsMenu.append(toolsList);
    let toolsMenuOpen = false;

    const handleToolsOutsideClick = (e: MouseEvent) => {

        if (!(e.target instanceof Node))
            return;
        if (toolsMenu.contains(e.target) || btnTools.contains(e.target))
            return;
        closeToolsMenu();
    };

    const handleToolsKeydown = (e: KeyboardEvent) => {

        if (e.key === "Escape") {
            closeToolsMenu();
        }
    };

    function closeToolsMenu() {

        if (!toolsMenuOpen)
            return;
        toolsMenu.classList.remove("show");
        toolsMenu.style.display = "none";
        btnTools.setAttribute("aria-expanded", "false");
        toolsMenuOpen = false;
        document.removeEventListener("mousedown", handleToolsOutsideClick);
        document.removeEventListener("keydown", handleToolsKeydown);
        window.removeEventListener("resize", closeToolsMenu);
        void showSessionViews();
    }

    function positionToolsMenu() {

        const btnRect = btnTools.getBoundingClientRect();
        toolsMenu.style.left = `${btnRect.left}px`;
        toolsMenu.style.top = `${btnRect.bottom + 6}px`;
    }

    function openToolsMenu() {

        positionToolsMenu();
        toolsMenu.style.display = "flex";
        toolsMenu.classList.add("show");
        // Fallback: falls Größe 0 (z.B. CSS nicht geladen), setze Standard-Offset
        const rect = toolsMenu.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            toolsMenu.style.left = "12px";
            toolsMenu.style.top = "48px";
        }
        btnTools.setAttribute("aria-expanded", "true");
        toolsMenuOpen = true;
        void hideSessionViews();
        document.addEventListener("mousedown", handleToolsOutsideClick);
        document.addEventListener("keydown", handleToolsKeydown);
        window.addEventListener("resize", closeToolsMenu);
    }

    function toggleToolsMenu() {
        if (toolsMenuOpen) {
            closeToolsMenu();
        } else {
            openToolsMenu();
        }
    }

    type ToolEntry = { label: string; icon?: string; action: () => void };

    const showFcoinConverter = () => {
        closeToolsMenu();
        const theme = getThemeVars();
        const win = window.open("", "fcoinConverter", "width=420,height=460,menubar=no,toolbar=no,resizable=yes");
        if (!win) { alert(tr("popup.blocked" as TranslationKey)); return; }
        win.document.open();
        win.document.write(buildFcoinConverterHtml(currentLocale, theme));
        win.document.close();
    };

    const showShoppingList = () => {
        closeToolsMenu();
        const theme = getThemeVars();
        const win = window.open("", "premiumShoppingList", "width=520,height=650,menubar=no,toolbar=no,location=no,status=no,resizable=yes");
        if (!win) { alert(tr("popup.blocked" as TranslationKey)); return; }
        win.document.open();
        win.document.write(buildShoppingListHtml(currentLocale, theme));
        win.document.close();
    };

    const showUpgradeCalculator = () => {
        closeToolsMenu();
        const theme = getThemeVars();
        const win = window.open("", "upgradeCalculator", "width=900,height=700,menubar=no,toolbar=no,location=no,status=no,resizable=yes");
        if (!win) { alert(tr("popup.blocked" as TranslationKey)); return; }
        win.document.open();
        win.document.write(buildUpgradeCalculatorHtml(currentLocale, theme));
        win.document.close();
    };
    type ToolSection = { header: string; entries: ToolEntry[] };
    const toolSections: ToolSection[] = [
        {
            header: "Interne Tools",
            entries: [
                { label: tr("tools.menu.fcoin" as TranslationKey), action: showFcoinConverter },
                { label: t("config.client.hotkeys.showShoppingList" as TranslationKey), action: showShoppingList },
                { label: t("tools.menu.upgrade" as TranslationKey), action: showUpgradeCalculator },
            ],
        },
        {
            header: "Externe Links",
            entries: [
                { label: "Flyff Universe", icon: flyffuniverseIcon, action: () => window.open("https://universe.flyff.com/", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768") },
                { label: "Flyffipedia", icon: flyffipediaIcon, action: () => window.open("https://flyffipedia.com/home", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768") },
                { label: "Flyffulator", icon: flyffulatorIcon, action: () => window.open("https://flyffulator.com/", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768") },
                { label: "Skillulator", icon: reskillIcon, action: () => window.open("https://skillulator.lol/", "_blank", "toolbar=no,location=no,status=no,menubar=no,width=1024,height=768") },
            ],
        },
    ];
    for (const section of toolSections) {
        const hdr = el("div", "toolsMenuHeader", section.header);
        toolsList.append(hdr);
        for (const entry of section.entries) {
            const item = el("button", "toolsMenuItem") as HTMLButtonElement;
            if (entry.icon) {
                const img = document.createElement("img");
                img.src = entry.icon;
                item.append(img);
            }
            const lbl = el("span", "toolsMenuLabel", entry.label);
            const arrow = el("span", "toolsMenuArrow", "►");
            item.append(lbl, arrow);
            item.onclick = () => { closeToolsMenu(); entry.action(); };
            toolsList.append(item);
        }
    }
    tabsBar.append(tabsSpacer, tabsProgress, splitControls, btnTabHeight, btnHotkeys, btnTools, btnEditMode, btnSaveLayout, btnLayouts, btnSplit);
    document.body.append(toolsMenu, hotkeysMenu);

    function isOpen(profileId: string) {

        // Check if profile is open as a single tab OR part of a layout tab
        return tabs.some((t) =>
            (t.type === "single" && t.profileId === profileId) ||
            (t.type === "layout" && t.layout?.cells.some((c) => c.id === profileId))
        );
    }

    function findTab(profileId: string): Tab | null {

        // Find a single-type tab by profileId (for backward compatibility)
        return tabs.find((t) => t.type === "single" && t.profileId === profileId) ?? null;
    }

    function findSingleTab(profileId: string): Tab | null {

        return tabs.find((t) => t.type === "single" && t.profileId === profileId) ?? null;
    }

    const layoutLabels: Record<LayoutType, string> = {
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
    // Helper function to update window title based on current tabs

    async function updateWindowTitle() {

        if (!window.api?.updateWindowTitle) return;
        const layoutTypes: string[] = [];
        for (const tab of tabs) {
            if (tab.type === "single") {
                layoutTypes.push("1");
            } else if (tab.type === "layout" && tab.layout) {
                const label = layoutLabels[tab.layout.type] || tab.layout.type;
                layoutTypes.push(label);
            }
        }
        try {
            await window.api.updateWindowTitle(layoutTypes);
        } catch (err) {
            // Silently ignore errors - this is not critical
        }
    }

    function updateSplitButton() {

        btnSplit.title = t("layout.select");
        syncSplitSlider();
    }

    function updateSplitGlyphs() {

        for (const t of tabs) {
            // Skip layout tabs for glyph updates - they have their own rendering
            if (t.type === "layout") continue;
            const glyph = t.tabBtn.querySelector('.tabGlyph') as HTMLElement | null;
            if (!glyph)
                continue;
            glyph.innerHTML = "";
            glyph.classList.remove("isLeft", "isRight", "isActive");
            const cell = layoutState?.cells.find((c) => c.id === t.profileId) ?? null;
            if (!cell) {
                glyph.style.display = "none";
                continue;
            }
            glyph.style.display = "inline-flex";
            glyph.textContent = String(cell.position + 1);
            if (layoutState?.activePosition === cell.position) {
                glyph.classList.add("isActive");
            }
        }
    }

    function syncTabClasses() {

        for (const t of tabs) {
            if (t.type === "layout") {
                const isActiveTab = t.id === activeTabId;
                t.tabBtn.classList.toggle("active", isActiveTab);
                t.tabBtn.classList.remove("splitPartner", "splitLeft", "splitRight", "loggedOut");
                t.tabBtn.classList.toggle("layoutActive", isActiveTab);
                if (t.cellButtons && t.layout) {
                    for (const chip of t.cellButtons) {
                        const cell = t.layout.cells.find((c) => c.id === chip.dataset.profileId);
                        const isActiveCell = !!(cell && layoutState && layoutState.activePosition === cell.position && t.id === activeTabId);
                        const isLoggedOut = isProfileLoggedOut(cell?.id ?? null);
                        chip.classList.toggle("active", isActiveCell);
                        chip.classList.toggle("loggedOut", isLoggedOut);
                    }
                }
                continue;
            }
            // Single tab handling
            const cell = layoutState?.cells.find((c) => c.id === t.profileId) ?? null;
            const isInLayout = !!cell;
            const isActiveCell = !!(cell && layoutState?.activePosition === cell.position);
            const isLeft = layoutState?.type === "split-2" && cell?.position === 0;
            const isRight = layoutState?.type === "split-2" && cell?.position === 1;
            // Single tab is active if it's the current activeTabId OR activeProfileId matches
            const isActive = t.id === activeTabId || t.profileId === activeProfileId;
            t.tabBtn.classList.toggle("active", isActive);
            t.tabBtn.classList.toggle("splitPartner", isInLayout);
            t.tabBtn.classList.toggle("splitLeft", !!isLeft);
            t.tabBtn.classList.toggle("splitRight", !!isRight);
            t.tabBtn.classList.toggle("layoutActive", isActiveCell);
            t.tabBtn.classList.toggle("loggedOut", !!t.loggedOut);
        }
    }

    function isTabLoggedOut(profileId: string | null): boolean {

        if (!profileId)
            return false;
        return !!findSingleTab(profileId)?.loggedOut;
    }

    function isProfileLoggedOut(profileId: string | null): boolean {

        return !!profileId && isTabLoggedOut(profileId);
    }

    function layoutHasLoggedOut(layout: LayoutState | null | undefined): boolean {

        if (!layout)
            return false;
        return layout.cells.some((c) => isProfileLoggedOut(c.id));
    }

    function updateLoginOverlay() {

        const activeTab = activeProfileId ? findSingleTab(activeProfileId) : null;
        const show = !!(activeTab && activeTab.loggedOut);
        loginOverlay.classList.toggle("show", show);
        loginOverlay.querySelector('.sessionLoginName')
        loginName.textContent = activeTab?.name ?? "";
        btnLogin.disabled = !show;
    }

    function syncSplitSlider() {

        if (!layoutState || layoutState.type !== "split-2") {
            splitControls.style.display = "none";
            splitSlider.disabled = true;
            return;
        }
        splitControls.style.display = "flex";
        splitSlider.disabled = false;
        const ratio = clampSplitRatio(layoutState.ratio ?? currentSplitRatio);
        currentSplitRatio = ratio;
        const pct = Math.round(ratio * 100);
        const pctRight = Math.max(0, 100 - pct);
        splitSlider.value = String(pct);
        splitSliderValue.textContent = `${pct}% / ${pctRight}%`;
    }
    splitSlider.addEventListener("input", () => {
        if (!layoutState || layoutState.type !== "split-2")
            return;
        const pct = Number(splitSlider.value);
        if (!Number.isFinite(pct))
            return;
        const ratio = clampSplitRatio(pct / 100);
        if (Math.abs(ratio - (layoutState.ratio ?? currentSplitRatio)) < 0.001)
            return;
        currentSplitRatio = ratio;
        layoutState = { ...layoutState, ratio };
        // Also update the tab's layout to persist the ratio
        const activeTab = getActiveTab();
        if (activeTab?.type === "layout" && activeTab.layout) {
            activeTab.layout = { ...activeTab.layout, ratio };
        }
        syncSplitSlider();
        window.api.sessionTabsSetSplitRatio?.(ratio).catch(console.error);
        scheduleAutoSave();
        kickBounds();
    });

    function askLayoutName(defaultName: string): Promise<string | null> {

        return new Promise((resolve) => {
            void hideSessionViews();
            const overlay = el("div", "modalOverlay");
            const modal = el("div", "modal");
            const header = el("div", "modalHeader", t("layout.namePrompt"));
            const body = el("div", "modalBody");
            const input = document.createElement("input");
            input.className = "input";
            input.value = defaultName;
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
            btnSave.onclick = () => cleanup(input.value.trim() || defaultName);
            btnCancel.onclick = () => cleanup(null);
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay)
                    cleanup(null);
            });
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter")
                    cleanup(input.value.trim() || defaultName);
                if (e.key === "Escape")
                    cleanup(null);
            });
            document.body.append(overlay);
            input.focus();
            input.select();
        });
    }

    async function saveCurrentLayout() {

        setLayoutStatus("Save clicked", "info");
        if (tabs.length === 0) {
            alert(t("layout.saveError"));
            setLayoutStatus(t("layout.saveError"), "error");
            return;
        }
        if (!window.api.tabLayoutsSave) {
            alert(`${t("layout.saveError")}: tabLayoutsSave not available`);
            setLayoutStatus("tabLayoutsSave not available", "error");
            return;
        }
        setLayoutStatus(`Tabs open: ${tabs.length}`, "info");
        const defaultName = `Layout ${new Date().toLocaleTimeString()}`;
        const name = await askLayoutName(defaultName);
        if (!name) {
            setLayoutStatus("Save cancelled", "info");
            return;
        }
        setLayoutStatus(`Tabs open: ${tabs.length} | Name len=${name.length}`, "info");
        // Collect all profile IDs and layouts from ALL tabs
        const allProfileIds = new Set<string>();
        const loggedOutSet = new Set<string>();
        const layoutsForSave: { name?: string; layout: LayoutState }[] = [];
        for (const tab of tabs) {
            if (tab.type === "single" && tab.profileId) {
                allProfileIds.add(tab.profileId);
                if (tab.loggedOut) loggedOutSet.add(tab.profileId);
            } else if (tab.type === "layout" && tab.layout) {
                layoutsForSave.push({
                    name: tab.name,
                    layout: { ...tab.layout, ratio: tab.layout.ratio ?? currentSplitRatio },
                });
                for (const cell of tab.layout.cells) {
                    allProfileIds.add(cell.id);
                }
            }
        }
        // Use first layout as 'split' for backward compatibility, all layouts in 'layouts' array
        const firstLayout = layoutsForSave[0]?.layout ?? null;
        const payload = {
            name,
            tabs: Array.from(allProfileIds),
            split: firstLayout ? { ...firstLayout } : null,
            layouts: layoutsForSave.length > 0 ? layoutsForSave : undefined,
            activeId: activeProfileId,
            loggedOutChars: Array.from(loggedOutSet),
        };
        const statusMsg = `Saving layout: ${payload.tabs.length} profiles, ${layoutsForSave.length} layout tabs`;
        setLayoutStatus(statusMsg, "info");
        showToast(statusMsg, "info");
        const before = await withTimeout(window.api.tabLayoutsList(), "tabLayoutsList before", 2000);
        const saved = await withTimeout(window.api.tabLayoutsSave(payload), "tabLayoutsSave", 3000);
        const after = saved ?? (await withTimeout(window.api.tabLayoutsList(), "tabLayoutsList after", 2000));
        const beforeCount = before?.length ?? 0;
        const afterCount = after?.length ?? 0;
        const delta = afterCount - beforeCount;
        const deltaMsg = `before=${beforeCount} after=${afterCount} delta=${delta}`;
        showToast(t("layout.saved"), "success");
        alert(`${t("layout.saved")} (${deltaMsg})`);
        setLayoutStatus(`${t("layout.saved")} (${deltaMsg})`, "success");
        localStorage.setItem("tabLayoutsRefresh", "1");
    }

    function scheduleAutoSave() {

        console.log("[autoSave] scheduleAutoSave called, currentLayoutId:", currentLayoutId, "isApplyingLayout:", isApplyingLayout, "autoSaveLayouts:", autoSaveLayouts);
        if (!autoSaveLayouts) {
            if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
            setAutoSaveTimeout(null);
            return;
        }
        if (!currentLayoutId || isApplyingLayout) return;
        if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
        setAutoSaveTimeout(setTimeout(() => {
            autoSaveLayout().catch((err) => logErr(err, "renderer"));
        }, 500));
    }

    async function autoSaveLayout() {

        console.log("[autoSave] autoSaveLayout called");
        if (!autoSaveLayouts) return;
        if (!currentLayoutId || tabs.length === 0) return;
        if (!window.api.tabLayoutsSave) return;
        // Collect all profile IDs and layouts from all tabs
        const allProfileIds = new Set<string>();
        const loggedOutSet = new Set<string>();
        const layoutsForSave: { name?: string; layout: LayoutState }[] = [];
        for (const tab of tabs) {
            if (tab.type === "single" && tab.profileId) {
                allProfileIds.add(tab.profileId);
                if (tab.loggedOut) loggedOutSet.add(tab.profileId);
            } else if (tab.type === "layout" && tab.layout) {
                layoutsForSave.push({
                    name: tab.name,
                    layout: { ...tab.layout, ratio: tab.layout.ratio ?? currentSplitRatio },
                });
                for (const cell of tab.layout.cells) {
                    allProfileIds.add(cell.id);
                }
            }
        }
        const loggedOutChars = Array.from(loggedOutSet);
        console.log("[autoSave] loggedOutChars:", loggedOutChars);
        const firstLayout = layoutsForSave[0]?.layout ?? null;
        const payload = {
            id: currentLayoutId,
            name: "", // Will be preserved by the store
            tabs: Array.from(allProfileIds),
            split: firstLayout ? { ...firstLayout } : null,
            layouts: layoutsForSave.length > 0 ? layoutsForSave : undefined,
            activeId: activeProfileId,
            loggedOutChars,
        };
        console.log("[autoSave] Saving payload:", JSON.stringify(payload));
        try {
            await window.api.tabLayoutsSave(payload);
            console.log("[autoSave] Save successful");
        }
        catch (err) {
            console.error("[autoSave] Save failed:", err);
            logErr(err, "renderer");
        }
    }

    async function reattachVisibleViews() {

        const visibleIds = layoutState ? layoutState.cells.map((c) => c.id) : activeProfileId ? [activeProfileId] : [];
        if (visibleIds.length === 0)
            return;
        const hasLoggedOut = visibleIds.some((id) => isProfileLoggedOut(id)) || layoutHasLoggedOut(layoutState);
        // Force bounds push before switching to ensure views have correct dimensions
        pushBoundsInternal(true);
        // Re-apply current layout to ensure all views are attached
        if (layoutState) {
            try {
                await window.api.sessionTabsSetMultiLayout(layoutState, {
                    ensureViews: !hasLoggedOut,
                    allowMissingViews: hasLoggedOut,
                });
            }
            catch (err) {
                logErr(err, "renderer");
            }
        } else if (activeProfileId && isProfileLoggedOut(activeProfileId)) {
            const skeleton: LayoutState = {
                type: "single",
                cells: [{ id: activeProfileId, position: 0 }],
                ratio: currentSplitRatio,
                activePosition: 0,
            };
            await window.api.sessionTabsSetMultiLayout(skeleton, { ensureViews: false, allowMissingViews: true }).catch((err) => logErr(err, "renderer"));
            // No BrowserView should be focused while logged out
            pushBoundsInternal(true);
            return;
        }
        // Switch to each visible view to ensure it's properly activated and rendered
        for (const id of visibleIds) {
            if (isProfileLoggedOut(id))
                continue;
            try {
                await window.api.sessionTabsSwitch(id);
            }
            catch (err) {
                logErr(err, "renderer");
            }
        }
        // Ensure the correct active view is focused last
        if (activeProfileId && !isProfileLoggedOut(activeProfileId) && visibleIds[visibleIds.length - 1] !== activeProfileId) {
            await window.api.sessionTabsSwitch(activeProfileId).catch((err) => logErr(err, "renderer"));
        }
        // Final bounds push to ensure everything is correctly sized
        pushBoundsInternal(true);
    }

    async function applyLayout(layout: TabLayout) {

        return enqueueLayoutApply(async () => {
            // Disable auto-save during layout application
            isApplyingLayout = true;
            // Track current layout for auto-save
            currentLayoutId = layout.id;
            // Brief hide during reset to avoid flicker
            await hideSessionViews();
            let viewsRestored = false;
            try {
                await window.api.sessionTabsReset();
                activeTabId = null;
                activeProfileId = null;
                layoutState = null;
                pendingSplitAnchor = null;
                currentSplitRatio = defaultSplitRatio;
                updateSplitButton();
                updateSplitGlyphs();
                syncTabClasses();
                updateLoginOverlay();
                const profiles = await window.api.profilesList();
                profiles.forEach((p) => rememberProfileName(p.id, p.name, p.job));
                const existingIds = new Set((profiles ?? []).map((p: Profile) => p.id));
                const orderedRaw = layout.tabs ?? [];
                const ordered = (() => {
                    const filtered = orderedRaw.filter((id) => existingIds.has(id));
                    // Fallback: if profiles are not yet loaded, still try to open all tabs
                    return filtered.length > 0 ? filtered : orderedRaw;
                })();
                if (ordered.length === 0) {
                    setLayoutStatus("Layout contains no valid tabs", "error");
                    return;
                }
                for (const t of tabs)
                    t.tabBtn.remove();
                tabs.length = 0;
                syncTabClasses();
                updateSplitGlyphs();
                updateLoginOverlay();
                // Collect all layouts to restore (either from new 'layouts' array or legacy 'split' field)
                const layoutsToRestore: { name?: string; layout: LayoutState }[] = [];
                const allLayoutIds = new Set<string>();
                // Check for new layouts array first (multiple layout tabs)
                if (layout.layouts && layout.layouts.length > 0) {
                    for (const saved of layout.layouts) {
                        const normalized = normalizeLayoutState({
                            type: saved.layout.type as LayoutType,
                            cells: saved.layout.cells,
                            ratio: saved.layout.ratio,
                            activePosition: saved.layout.activePosition,
                        });
                        layoutsToRestore.push({ name: saved.name, layout: normalized });
                        for (const cell of normalized.cells) {
                            allLayoutIds.add(cell.id);
                        }
                    }
                }
                // Fallback to legacy 'split' field for backward compatibility
                else if (layout.split) {
                    let normalizedLayout: LayoutState;
                    if ("type" in layout.split) {
                        normalizedLayout = normalizeLayoutState({
                            type: layout.split.type as LayoutType,
                            cells: (layout.split as { cells: GridCell[] }).cells,
                            ratio: (layout.split as LayoutState).ratio,
                            activePosition: (layout.split as LayoutState).activePosition,
                        });
                    }
                    else {
                        normalizedLayout = normalizeLayoutState({
                            type: "split-2",
                            cells: [
                                { id: (layout.split as { leftId: string }).leftId, position: 0 },
                                { id: (layout.split as { rightId: string }).rightId, position: 1 },
                            ],
                            ratio: (layout.split as { ratio?: number }).ratio ?? currentSplitRatio,
                            activePosition: 0,
                        });
                    }
                    layoutsToRestore.push({ name: layout.name, layout: normalizedLayout });
                    for (const cell of normalizedLayout.cells) {
                        allLayoutIds.add(cell.id);
                    }
                }
                // Re-enable visibility before opening tabs so each tab is immediately visible
                await showSessionViews();
                viewsRestored = true;
                pushBounds();
                // Gesamtanzahl für Progress (alle Tabs im Layout + zusätzliche Single-Tabs)
                const totalToOpen = ordered.length;
                if (totalToOpen > 0) {
                    startLoadProgress(totalToOpen);
                }
                // Load tabs from left to right: create tab with grid skeleton, then load views into cells
                const delayMs = getLayoutDelayMs();
                const createdLayoutTabs: Tab[] = [];
                for (const { name: layoutTabName, layout: layoutForTab } of layoutsToRestore) {
                    const isSingleLayout = layoutForTab.type === "single" && layoutForTab.cells.length === 1;
                    if (isSingleLayout) {
                        const singleId = layoutForTab.cells[0].id;
                        allLayoutIds.add(singleId);
                        await openTab(singleId);
                        incrementLoadProgress();
                        if (delayMs > 0) {
                            await sleep(delayMs);
                        }
                        continue;
                    }
                    // Create tab UI element
                    const layoutTab = await createLayoutTab(layoutForTab, layoutTabName);
                    tabs.push(layoutTab);
                    tabsBar.insertBefore(layoutTab.tabBtn, tabsSpacer);
                    createdLayoutTabs.push(layoutTab);
                    // Activate this tab
                    layoutState = layoutForTab;
                    activeTabId = layoutTab.id;
                    currentSplitRatio = layoutForTab.ratio ?? currentSplitRatio;
                    const activeCell = layoutForTab.cells.find((c) => c.position === layoutForTab.activePosition) ?? layoutForTab.cells[0];
                    activeProfileId = activeCell?.id ?? null;
                    syncTabClasses();
                    // Set up grid skeleton first (empty cells)
                    const sortedCells = [...layoutForTab.cells].sort((a, b) => a.position - b.position);
                    const skeletonLayout: LayoutState = {
                        type: layoutForTab.type,
                        cells: sortedCells,
                        ratio: layoutForTab.ratio,
                        activePosition: layoutForTab.activePosition ?? sortedCells[0].position,
                    };
                    await window.api.sessionTabsSetMultiLayout(skeletonLayout, { ensureViews: false, allowMissingViews: true }).catch(console.error);
                    pushBoundsInternal(true);
                    // Load BrowserViews into their grid cells
                    if (sequentialGridLoad) {
                        // Sequential loading - load into specific cells one by one
                        for (let i = 0; i < sortedCells.length; i++) {
                            const cell = sortedCells[i];
                            try {
                                await window.api.sessionTabsOpenInCell(cell.position, cell.id, {
                                    activate: cell.position === skeletonLayout.activePosition,
                                });
                                pushBoundsInternal(true);
                                incrementLoadProgress();
                            }
                            catch (err) {
                                logErr(`Failed to open layout view ${cell.id}: ${err}`, "renderer");
                            }
                            // Delay between views (except after last one)
                            if (delayMs > 0 && i < sortedCells.length - 1) {
                                await sleep(delayMs);
                            }
                        }
                    } else {
                        // Parallel loading - all views in this grid at once
                        await Promise.all(
                            sortedCells.map((cell) =>
                                window.api.sessionTabsOpenInCell(cell.position, cell.id, {
                                    activate: cell.position === skeletonLayout.activePosition,
                                })
                                    .catch((err) => logErr(`Failed to open layout view ${cell.id}: ${err}`, "renderer"))
                            )
                        );
                        // Increment progress once for all views in this tab
                        for (const _ of sortedCells) {
                            incrementLoadProgress();
                        }
                        pushBoundsInternal(true);
                    }
                    // Finalize layout for this tab
                    await window.api.sessionTabsSetMultiLayout(skeletonLayout, { ensureViews: true, allowMissingViews: false }).catch(console.error);
                    pushBoundsInternal(true);
                    // Delay before next tab (always, if delay is set)
                    if (delayMs > 0) {
                        await sleep(delayMs);
                    }
                }
                // Open single tabs that are not part of any layout
                for (const [idx, id] of ordered.entries()) {
                    if (allLayoutIds.has(id))
                        continue;
                    try {
                        await openTab(id);
                        pushBoundsInternal(true);
                        incrementLoadProgress();
                    }
                    catch (err) {
                        logErr(`Failed to open tab ${id}: ${err}`, "renderer");
                    }
                    // Delay after each single tab (except last)
                    if (delayMs > 0 && idx < ordered.length - 1) {
                        await sleep(delayMs);
                    }
                }
                // Ensure first layout tab is active at the end
                if (createdLayoutTabs.length > 0) {
                    const firstLayoutTab = createdLayoutTabs[0];
                    if (firstLayoutTab.layout) {
                        layoutState = firstLayoutTab.layout;
                        activeTabId = firstLayoutTab.id;
                        currentSplitRatio = firstLayoutTab.layout.ratio ?? currentSplitRatio;
                        const activeCell = firstLayoutTab.layout.cells.find((c) => c.position === firstLayoutTab.layout!.activePosition) ?? firstLayoutTab.layout.cells[0];
                        activeProfileId = activeCell?.id ?? null;
                        await pushLayoutToMain();
                    }
                } else if (createdLayoutTabs.length === 0 && tabs.length > 0) {
                    layoutState = null;
                }
                if (layout.loggedOutChars) {
                    for (const id of layout.loggedOutChars) {
                        await logoutTab(id);
                    }
                }
                pruneLayoutState();
                await pushLayoutToMain();
                if (layout.activeId && ordered.includes(layout.activeId)) {
                    await setActive(layout.activeId);
                }
                if (!activeProfileId) {
                    if (layoutState) {
                        const activeCell = layoutState.cells.find((c) => c.position === layoutState!.activePosition) ?? layoutState.cells[0];
                        activeProfileId = activeCell?.id ?? null;
                    }
                    if (!activeProfileId && tabs[0] && tabs[0].type === "single") {
                        activeProfileId = tabs[0].profileId ?? null;
                        activeTabId = tabs[0].id;
                    }
                    syncTabClasses();
                }
                updateSplitButton();
                syncTabClasses();
                pushBounds();
                setTimeout(pushBounds, 120);
                setTimeout(pushBounds, 280);
            }
            finally {
                if (!viewsRestored) {
                    await showSessionViews();
                }
                pushBounds();
                kickBounds();
            }
            if (!activeProfileId && tabs[0] && tabs[0].type === "single") {
                activeProfileId = tabs[0].profileId ?? null;
                activeTabId = tabs[0].id;
                syncTabClasses();
            }
            await reattachVisibleViews();
            // Schedule additional activation passes to handle any timing issues
            setTimeout(() => {
                reattachVisibleViews().catch((err) => logErr(err, "renderer"));
            }, 200);
            setTimeout(() => {
                pushBoundsInternal(true);
                if (activeProfileId && !isProfileLoggedOut(activeProfileId)) {
                    window.api.sessionTabsSwitch(activeProfileId).catch((err) => logErr(err, "renderer"));
                }
            }, 500);
            // Re-apply user-selected tab active color in case any theme defaults were re-applied during layout load
            setTimeout(() => applyStoredTabActiveColor(), 20);
            // Re-enable auto-save after layout is fully applied
            isApplyingLayout = false;
            scheduleProgressHide();
        }
    );
    }

    async function showLayoutPicker() {

        await hideSessionViews();
        const overlay = el("div", "modalOverlay");
        const modal = el("div", "modal");
        const header = el("div", "modalHeader", t("layout.pick"));
        const body = el("div", "modalBody");
        const list = el("div", "pickerList");
        modal.append(header, body);
        body.append(list);
        overlay.append(modal);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape")
                close().catch(console.error);
        };
        const close = async () => {
            overlay.remove();
            document.removeEventListener("keydown", onKey);
            await showSessionViews();
            kickBounds();
        };
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay)
                close().catch(console.error);
        });
        document.addEventListener("keydown", onKey);
        document.body.append(overlay);
        const layouts = await fetchTabLayouts();
        if (layouts.length === 0) {
            list.append(el("div", "pickerEmpty", t("layout.empty")));
            return;
        }
        for (const layout of layouts) {
            const metaParts = [`${layout.tabs.length} Tabs`];
            if (layout.split)
                metaParts.push("Split");
            const item = el("button", "pickerItem", `${layout.name} (${metaParts.join("  ")})`) as HTMLButtonElement;
            item.onclick = async () => {
                await applyLayout(layout);
                await close();
            };
            list.append(item);
        }
    }
    let lastBounds: { x: number; y: number; width: number; height: number } | null = null;
    let pushTimer = 0;

    function schedulePushBounds() {

        if (pushTimer)
            return;
        pushTimer = window.setTimeout(() => {
            pushTimer = 0;
            pushBoundsInternal();
        }, 50);
    }

    function pushBoundsInternal(force = false) {

        const y = Math.round(tabsBar.getBoundingClientRect().height);
        const width = Math.round(window.innerWidth);
        const height = Math.max(1, Math.round(window.innerHeight - y));
        const next = { x: 0, y, width, height };
        const same = lastBounds &&
            lastBounds.x === next.x &&
            lastBounds.y === next.y &&
            lastBounds.width === next.width &&
            lastBounds.height === next.height;
        if (!force && same)
            return;
        lastBounds = next;
        window.api.sessionTabsSetBounds(next);
    }

    function pushBounds(force = false) {

        if (force) {
            if (pushTimer) clearTimeout(pushTimer);
            pushTimer = 0;
            pushBoundsInternal(true);
            return;
        }
        schedulePushBounds();
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars

    function forceBounds() {

        lastBounds = null;
        pushBounds(true);
        void showSessionViews();
    }
    let raf = 0;

    function kickBounds() {

        if (raf)
            return;
        raf = requestAnimationFrame(() => {
            raf = 0;
            pushBounds();
        });
    }
    window.addEventListener("resize", kickBounds);
    new ResizeObserver(kickBounds).observe(tabsBar);

    async function applySplit(next: LayoutState | null) {

        layoutState = normalizeLayoutState(next);
        if (layoutState) {
            currentSplitRatio = layoutState.ratio ?? currentSplitRatio;
            const activeCell = layoutState.cells.find((c) => c.position === layoutState!.activePosition) ?? layoutState.cells[0];
            activeProfileId = activeCell?.id ?? activeProfileId;
        }
        updateSplitButton();
        syncTabClasses();
        updateSplitGlyphs();
        await pushLayoutToMain();
        if (activeProfileId && !isProfileLoggedOut(activeProfileId)) {
            await window.api.sessionTabsSwitch(activeProfileId).catch((err) => logErr(err, "renderer"));
        }
        pushBoundsInternal(true);
        await reattachVisibleViews();
        scheduleAutoSave();
        updateWindowTitle();
    }

    async function clearSplit() {

        if (!layoutState)
            return;
        await applySplit(null);
    }
    /**
     * Activate a tab by ID (can be a tab.id for layout tabs or profileId for single tabs)
     */

    async function switchToTab(tabId: string) {

        const tab = findTabById(tabId);
        if (!tab) return;
        // Save current layout state back to the previous tab before switching
        const previousTab = getActiveTab();
        if (previousTab?.type === "layout" && previousTab.layout && layoutState) {
            previousTab.layout = { ...previousTab.layout, ratio: layoutState.ratio };
        }
        activeTabId = tabId;
        if (tab.type === "layout" && tab.layout) {
            // Activate a layout tab
            layoutState = tab.layout;
            const activeCell = tab.layout.cells.find((c) =>
                c.position === tab.layout!.activePosition
            ) ?? tab.layout.cells[0];
            activeProfileId = activeCell?.id ?? null;
            currentSplitRatio = tab.layout.ratio ?? currentSplitRatio;
            const orderedCells = [...tab.layout.cells].sort((a, b) => a.position - b.position);
            const hasLoggedOutCells = layoutHasLoggedOut(layoutState);
            // Push layout skeleton first so BrowserViews can attach directly into their cells
            await window.api.sessionTabsSetMultiLayout(layoutState, { ensureViews: false, allowMissingViews: true });
            // Materialize all cells in parallel but without changing the active layout type
            await Promise.all(
                orderedCells
                    .filter((cell) => !isProfileLoggedOut(cell.id))
                    .map((cell) =>
                        window.api.sessionTabsOpenInCell(cell.position, cell.id, {
                            activate: cell.position === layoutState?.activePosition,
                        }).catch((err) => logErr(err, "renderer"))
                    )
            );
            // Finalize layout with full bounds
            await window.api.sessionTabsSetMultiLayout(layoutState, {
                ensureViews: !hasLoggedOutCells,
                allowMissingViews: hasLoggedOutCells,
            });
            // Force bounds update to ensure views are correctly sized
            pushBoundsInternal(true);
            // Re-attach visible views to ensure they're displayed
            await reattachVisibleViews();
            if (activeProfileId && !isProfileLoggedOut(activeProfileId)) {
                await window.api.sessionTabsSwitch(activeProfileId);
            }
        } else if (tab.type === "single" && tab.profileId) {
            // Activate a single tab - clear layout in main process
            activeProfileId = tab.profileId;
            layoutState = null;
            const isLoggedOut = !!tab.loggedOut;
            // Important: Push null layout to main so it switches to single-view mode
            await pushLayoutToMain();
            if (!isLoggedOut) {
                await window.api.sessionTabsSwitch(tab.profileId);
            }
            // Force bounds update for single view
            pushBoundsInternal(true);
            // Re-attach visible views to ensure they're displayed (same as layout tabs)
            await reattachVisibleViews();
        }
        updateSplitButton();
        syncTabClasses();
        updateSplitGlyphs();
        applyStoredTabActiveColor();
        kickBounds();
        updateLoginOverlay();
        scheduleAutoSave();
    }

    async function setActive(profileId: string, side: "left" | "right" = "left") {

        // Check if this profile is part of the active layout tab
        const activeTab = getActiveTab();
        if (activeTab?.type === "layout" && activeTab.layout) {
            const cell = activeTab.layout.cells.find((c) => c.id === profileId);
            if (cell) {
                // Profile is in the active layout - just change active position
                activeTab.layout = { ...activeTab.layout, activePosition: cell.position };
                layoutState = activeTab.layout;
                activeProfileId = profileId;
                updateSplitButton();
                syncTabClasses();
                updateSplitGlyphs();
                await pushLayoutToMain();
                if (!isProfileLoggedOut(profileId)) {
                    await window.api.sessionTabsSwitch(profileId);
                }
                applyStoredTabActiveColor();
                kickBounds();
                updateLoginOverlay();
                scheduleAutoSave();
                return;
            }
        }
        // Check if this profile has its own single tab
        const singleTab = findSingleTab(profileId);
        if (singleTab) {
            await switchToTab(singleTab.id);
            return;
        }
        // Check if profile is in ANY layout tab (not just the active one)
        const layoutTabWithProfile = tabs.find((t) =>
            t.type === "layout" && t.layout?.cells.some((c) => c.id === profileId)
        );
        if (layoutTabWithProfile) {
            // Switch to that layout tab and set active position
            const cell = layoutTabWithProfile.layout!.cells.find((c) => c.id === profileId);
            if (cell) {
                layoutTabWithProfile.layout = { ...layoutTabWithProfile.layout!, activePosition: cell.position };
            }
            await switchToTab(layoutTabWithProfile.id);
            return;
        }
        // Profile is not in any tab - this shouldn't happen normally
        // Fallback: directly switch the profile
        activeProfileId = profileId;
        syncTabClasses();
        updateSplitGlyphs();
        if (!isProfileLoggedOut(profileId)) {
            await window.api.sessionTabsSwitch(profileId);
        }
        applyStoredTabActiveColor();
        pushBoundsInternal(true);
        await reattachVisibleViews();
        updateLoginOverlay();
        scheduleAutoSave();
    }

    function renderTabsOrder() {

        for (const t of tabs) {
            tabsBar.insertBefore(t.tabBtn, tabsSpacer);
        }
    }

    const getSideActiveId = (side: "left" | "right"): string | null => {

        if (layoutState && layoutState.type === "split-2") {
            const cell = layoutState.cells.find((c) => c.position === (side === "left" ? 0 : 1));
            return cell?.id ?? null;
        }
        return activeProfileId;
    };

    const getActiveSide = (): "left" | "right" => {

        if (layoutState && layoutState.type === "split-2") {
            return layoutState.activePosition === 1 ? "right" : "left";
        }
        return "left";
    };

    const findNextTabId = (currentId: string | null, dir: "prev" | "next"): string | null => {

        if (!currentId || tabs.length === 0)
            return null;
        // Only consider single tabs for navigation
        const singleTabs = tabs.filter((t) => t.type === "single");
        const idx = singleTabs.findIndex((t) => t.profileId === currentId);
        if (idx < 0)
            return null;
        const delta = dir === "next" ? 1 : -1;
        const nextIdx = (idx + delta + singleTabs.length) % singleTabs.length;
        return singleTabs[nextIdx]?.profileId ?? null;
    };

    async function navigateTab(dir: "prev" | "next", explicitSide?: "left" | "right") {

        const side = explicitSide ?? getActiveSide();
        const current = getSideActiveId(side);
        const next = findNextTabId(current, dir);
        if (!next || next === current)
            return;
        await setActive(next, layoutState?.type === "split-2" ? side : "left");
    }
    window.api.onTabHotkeyNavigate?.((payload) => {
        if (!payload)
            return;
        const dir = payload.dir === "next" ? "next" : "prev";
        const side = payload.side === "right" ? "right" : payload.side === "left" ? "left" : undefined;
        navigateTab(dir, side).catch((err) => logErr(err, "hotkey-nav"));
    });
    window.api.onTabBarToggle?.(() => {
        closeToolsMenu();
        const hidden = tabsBar.classList.toggle("isHidden");
        tabsBar.setAttribute("aria-hidden", hidden ? "true" : "false");
        // When hidden, give content full height; when shown, reflow bounds
        if (hidden) {
            tabsBar.style.display = "none";
        } else {
            tabsBar.style.display = "flex";
        }
        kickBounds();
    });
    window.api.onShowFcoinConverter?.(() => {
        showFcoinConverter();
    });
    document.addEventListener("clientHotkey:showFcoinConverter", () => {
        showFcoinConverter();
    });
    window.api.onShowShoppingList?.(() => {
        showShoppingList();
    });
    document.addEventListener("clientHotkey:showShoppingList", () => {
        showShoppingList();
    });

    function moveTab(fromId: string, toId: string, after: boolean) {

        // Support both profileId (for single tabs) and tab.id (for layout tabs)
        const fromIdx = tabs.findIndex((t) =>
            (t.type === "single" && t.profileId === fromId) || t.id === fromId
        );
        const toIdx = tabs.findIndex((t) =>
            (t.type === "single" && t.profileId === toId) || t.id === toId
        );
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx)
            return;
        const [item] = tabs.splice(fromIdx, 1);
        let insertIdx = toIdx;
        if (fromIdx < toIdx)
            insertIdx -= 1;
        if (after)
            insertIdx += 1;
        tabs.splice(insertIdx, 0, item);
        renderTabsOrder();
        scheduleAutoSave();
    }
    let draggingId: string | null = null;

    function attachDnd(tabBtn: HTMLButtonElement, profileId: string) {

        tabBtn.draggable = true;
        tabBtn.addEventListener("dragstart", (e) => {
            draggingId = profileId;
            tabBtn.classList.add("dragging");
            e.dataTransfer?.setData("text/plain", profileId);
            e.dataTransfer!.effectAllowed = "move";
        });
        tabBtn.addEventListener("dragend", () => {
            draggingId = null;
            tabBtn.classList.remove("dragging", "dropBefore", "dropAfter");
            for (const t of tabs)
                t.tabBtn.classList.remove("dropBefore", "dropAfter");
        });
        tabBtn.addEventListener("dragover", (e) => {
            e.preventDefault();
            const fromId = draggingId ?? e.dataTransfer?.getData("text/plain");
            if (!fromId || fromId === profileId)
                return;
            const rect = tabBtn.getBoundingClientRect();
            const after = e.clientX - rect.left > rect.width / 2;
            tabBtn.classList.toggle("dropAfter", after);
            tabBtn.classList.toggle("dropBefore", !after);
            e.dataTransfer!.dropEffect = "move";
        });
        tabBtn.addEventListener("dragleave", () => {
            tabBtn.classList.remove("dropBefore", "dropAfter");
        });
        tabBtn.addEventListener("drop", (e) => {
            e.preventDefault();
            const fromId = draggingId ?? e.dataTransfer?.getData("text/plain");
            if (!fromId || fromId === profileId)
                return;
            const rect = tabBtn.getBoundingClientRect();
            const after = e.clientX - rect.left > rect.width / 2;
            tabBtn.classList.remove("dropBefore", "dropAfter");
            moveTab(fromId, profileId, after);
        });
    }

    async function promptCloseChoice(target: CloseTarget | null): Promise<CloseChoice> {

        await hideSessionViews();
        const targetLabel = target?.label ?? null;
        const targetIsLayout = target?.kind === "layout";
        return await new Promise<CloseChoice>((resolve) => {
            const overlay = el("div", "modalOverlay");
            const modal = el("div", "modal");
            const header = el("div", "modalHeader");
            const headerTitle = el("span", "", t("close.title"));
            const headerClose = el("button", "modalCloseBtn", "\u00d7") as HTMLButtonElement;
            headerClose.type = "button";
            headerClose.onclick = () => finish("cancel");
            header.append(headerTitle, headerClose);
            const body = el("div", "modalBody");
            const prompt = el("div", "modalHint", t("close.prompt"));
            const targetHint = targetLabel ? (() => {
                const hint = el("div", "closeTargetBadge");
                const label = el("span", "closeTargetLabel", t("close.target"));
                const name = el("span", "closeTargetName", targetLabel);
                hint.append(label, name);
                return hint;
            })() : null;
            const actions = el("div", "manageActions");
            // All actions except cancel are styled as danger (red) for clear emphasis
            const btnTab = el("button", "btn danger", t((targetIsLayout ? "close.optionLayout" : "close.optionTab") as TranslationKey)) as HTMLButtonElement;
            const btnWindow = el("button", "btn danger", t("close.optionWindow")) as HTMLButtonElement;
            const btnApp = el("button", "btn danger", t("close.optionApp")) as HTMLButtonElement;
            let done = false;
            const finish = (choice: CloseChoice) => {
                if (done)
                    return;
                done = true;
                overlay.remove();
                window.removeEventListener("keydown", onKey);
                resolve(choice);
            };
            const onKey = (e: KeyboardEvent) => {
                if (e.key === "Escape")
                    finish("cancel");
            };
            window.addEventListener("keydown", onKey);
            btnTab.disabled = !target;
            btnTab.onclick = () => finish("tab");
            btnWindow.onclick = () => finish("window");
            btnApp.onclick = () => finish("app");
            if (targetIsLayout) {
                const btnDissolve = el("button", "btn warning", t("layoutClose.optionDissolve" as TranslationKey)) as HTMLButtonElement;
                btnDissolve.onclick = () => finish("dissolve");
                actions.append(btnDissolve, btnTab, btnWindow, btnApp);
            } else {
                actions.append(btnTab, btnWindow, btnApp);
            }
            body.append(prompt);
            if (targetHint)
                body.append(targetHint);
            body.append(actions);
            modal.append(header, body);
            overlay.append(modal);
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay)
                    finish("cancel");
            });
            document.body.append(overlay);
            (btnTab.disabled ? btnWindow : btnTab).focus();
        });
    }

    async function closeTab(profileId: string) {

        pendingSplitAnchor = pendingSplitAnchor === profileId ? null : pendingSplitAnchor;
        await window.api.sessionTabsClose(profileId);
        const idx = tabs.findIndex((t) => t.profileId === profileId);
        if (idx >= 0) {
            const [removed] = tabs.splice(idx, 1);
            removed.tabBtn.remove();
        }
        else {
            const existing = findTab(profileId);
            existing?.tabBtn.remove();
        }
        pruneLayoutState();
        await pushLayoutToMain();
        const next = (() => {
            if (layoutState) {
                const activeCell = layoutState.cells.find((c) => c.position === layoutState!.activePosition) ?? layoutState.cells[0];
                if (activeCell && isOpen(activeCell.id))
                    return findSingleTab(activeCell.id);
            }
            // Only consider single tabs for next tab selection
            const singleTabs = tabs.filter((t) => t.type === "single");
            const singleIdx = singleTabs.findIndex((t) => t.profileId === profileId);
            return singleTabs[singleIdx] ?? singleTabs[singleIdx - 1] ?? singleTabs[0] ?? null;
        })();
        if (next && next.type === "single" && next.profileId) {
            activeProfileId = next.profileId;
            activeTabId = next.id;
            await setActive(next.profileId);
        } else {
            activeProfileId = null;
            activeTabId = null;
        }
        renderTabsOrder();
        updateSplitButton();
        syncTabClasses();
        updateSplitGlyphs();
        updateLoginOverlay();
        scheduleAutoSave();
        updateWindowTitle();
    }

    async function closeLayoutTab(tabId: string) {

        const idx = tabs.findIndex((t) => t.id === tabId && t.type === "layout");
        if (idx < 0)
            return;
        const [removed] = tabs.splice(idx, 1);
        removed.tabBtn.remove();
        const wasActive = activeTabId === tabId;
        if (wasActive) {
            layoutState = null;
            activeTabId = null;
            activeProfileId = null;
            const next = tabs[idx] ?? tabs[idx - 1] ?? tabs[0] ?? null;
            if (next) {
                await switchToTab(next.id);
            }
            else {
                await pushLayoutToMain();
                updateWindowTitle();
            }
        }
        pruneLayoutState();
        renderTabsOrder();
        updateSplitButton();
        syncTabClasses();
        updateSplitGlyphs();
        updateLoginOverlay();
        scheduleAutoSave();
        updateWindowTitle();
    }

    function getCloseTarget(profileId?: string | null): CloseTarget | null {

        if (profileId) {
            return { kind: "single", profileId, label: getProfileLabel(profileId) };
        }
        const activeTab = getActiveTab();
        if (activeTab?.type === "layout") {
            return { kind: "layout", tabId: activeTab.id, label: activeTab.name };
        }
        if (activeProfileId) {
            return { kind: "single", profileId: activeProfileId, label: getProfileLabel(activeProfileId) };
        }
        const firstSingle = tabs.find((t) => t.type === "single" && t.profileId);
        if (firstSingle?.profileId) {
            return { kind: "single", profileId: firstSingle.profileId, label: getProfileLabel(firstSingle.profileId) };
        }
        return null;
    }

    async function handleCloseChoice(profileId?: string | null) {

        if (closePromptOpen)
            return;
        closePromptOpen = true;
        // Ensure we honor the latest language selection from other windows
        await syncLocaleFromSettings();
        const target = getCloseTarget(profileId);
        let restoreTabs = true;
        try {
            const choice = await promptCloseChoice(target);
            restoreTabs = choice === "tab" || choice === "dissolve" || choice === "cancel" || !target;
            if (choice === "dissolve" && target?.kind === "layout") {
                await dissolveLayoutTab(target.tabId);
            }
            else if (choice === "tab") {
                if (target?.kind === "layout") {
                    await closeLayoutTab(target.tabId);
                }
                else if (target?.kind === "single") {
                    await closeTab(target.profileId);
                }
            }
            else if (choice === "window") {
                restoreTabs = false;
                await window.api.sessionWindowClose();
            }
            else if (choice === "app") {
                restoreTabs = false;
                await window.api.appQuit();
            }
        }
        catch (err) {
            logErr(err, "renderer");
            restoreTabs = true;
        }
        finally {
            closePromptOpen = false;
        }
        if (restoreTabs) {
            await showSessionViews();
            await reattachVisibleViews();
            kickBounds();
        }
    }

    async function logoutTab(profileId: string) {

        const tab = findTab(profileId);
        if (!tab || tab.loggedOut)
            return;
        tab.loggedOut = true;
        syncTabClasses();
        updateLoginOverlay();
        try {
            await window.api.sessionTabsLogout(profileId);
            showToast("Tab ausgeloggt", "info");
            scheduleAutoSave();
        }
        catch (err) {
            logErr(err, "renderer");
            tab.loggedOut = false;
            syncTabClasses();
            updateLoginOverlay();
            showToast("Ausloggen fehlgeschlagen", "error");
        }
    }

    async function loginTab(profileId: string) {

        const tab = findTab(profileId);
        if (!tab || !tab.loggedOut)
            return;
        btnLogin.disabled = true;
        try {
            await window.api.sessionTabsLogin(profileId);
            tab.loggedOut = false;
            syncTabClasses();
            updateLoginOverlay();
            await setActive(profileId);
            showToast("Tab eingeloggt", "success");
        }
        catch (err) {
            logErr(err, "renderer");
            tab.loggedOut = true;
            showToast("Einloggen fehlgeschlagen", "error");
        }
        finally {
            btnLogin.disabled = !isTabLoggedOut(profileId);
            updateLoginOverlay();
        }
    }

    async function showProfileManager(): Promise<void> {

        // Collect all profile IDs from both single tabs and layouts
        const allProfileIds = new Set<string>();
        for (const tab of tabs) {
            if (tab.type === "single" && tab.profileId) {
                allProfileIds.add(tab.profileId);
            } else if (tab.type === "layout" && tab.layout) {
                for (const cell of tab.layout.cells) {
                    allProfileIds.add(cell.id);
                }
            }
        }
        if (allProfileIds.size === 0) {
            showToast(tr("toast.noProfiles" as TranslationKey), "info");
            return;
        }
        // Get currently logged in profiles
        const openProfiles = await window.api.sessionTabsGetOpenProfiles() as string[];
        const loggedInSet = new Set(openProfiles);
        // Hide BrowserViews (required - they render above DOM)
        await hideSessionViews();
        return new Promise((resolve) => {
            const overlay = el("div", "profileManagerOverlay");
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                background: transparent;
            `;
            const modal = el("div", "modal");
            modal.style.cssText = `
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
            `;
            const header = el("div", "modalHeader", "Profile verwalten");
            const body = el("div", "modalBody");
            const list = el("div", "profileManagerList");
            list.style.cssText = "display: flex; flex-direction: column; gap: 8px; flex: 1; overflow-y: auto; min-height: 0;";
            body.append(list);
            modal.append(header, body);
            overlay.append(modal);
            const closeModal = async () => {
                overlay.remove();
                await showSessionViews();
                kickBounds();
                resolve();
            };
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    closeModal();
                }
            };
            const onKey = (e: KeyboardEvent) => {
                if (e.key === "Escape") {
                    e.preventDefault();
                    window.removeEventListener("keydown", onKey);
                    closeModal();
                }
            };
            window.addEventListener("keydown", onKey);
            document.body.append(overlay);
            // Load profiles to get job icons and names
            window.api.profilesList().then((profiles: Profile[]) => {
                for (const profileId of allProfileIds) {
                    const profile = profiles.find((p) => p.id === profileId);
                    const profileName = profile?.name ?? profileNameCache.get(profileId) ?? profileId;
                    const isLoggedIn = loggedInSet.has(profileId);
                    const item = el("div", "profileManagerItem");
                    item.style.cssText = `
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 12px 16px;
                        background: var(--panel2);
                        border: 1px solid var(--stroke);
                        border-radius: var(--radius2);
                        color: var(--text);
                        font-size: 14px;
                    `;
                    // Add status indicator (first, on the left)
                    const statusDot = el("span", "statusDot");
                    statusDot.style.cssText = `
                        width: 10px;
                        height: 10px;
                        border-radius: 50%;
                        background: ${isLoggedIn ? '#2ecc71' : '#ff9800'};
                        flex-shrink: 0;
                    `;
                    item.append(statusDot);
                    // Add job icon if available
                    const jobIcon = createJobIcon(profile?.job, "itemJobIcon");
                    if (jobIcon) {
                        jobIcon.style.cssText = "width: 24px; height: 24px; flex-shrink: 0;";
                        item.append(jobIcon);
                    }
                    // Add profile name
                    const nameLabel = el("span", "", profileName);
                    nameLabel.style.cssText = "flex: 1; font-weight: 500;";
                    item.append(nameLabel);
                    // Add login/logout button
                    const actionBtn = el("button", "actionBtn");
                    actionBtn.textContent = isLoggedIn ? "Logout" : "Login";
                    actionBtn.style.cssText = `
                        padding: 6px 16px;
                        background: ${isLoggedIn ? 'var(--danger)' : 'var(--green)'};
                        border: none;
                        border-radius: 6px;
                        color: var(--text);
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 600;
                        transition: all 0.2s;
                        flex-shrink: 0;
                    `;
                    actionBtn.addEventListener("mouseenter", () => {
                        actionBtn.style.opacity = "0.8";
                        actionBtn.style.transform = "scale(1.05)";
                    });
                    actionBtn.addEventListener("mouseleave", () => {
                        actionBtn.style.opacity = "1";
                        actionBtn.style.transform = "scale(1)";
                    });
                    actionBtn.onclick = async () => {
                        actionBtn.disabled = true;
                        overlay.remove();
                        await showSessionViews();
                        kickBounds();
                        if (isLoggedIn) {
                            // Handle logout
                            const singleTab = findTab(profileId);
                            if (singleTab && !singleTab.loggedOut) {
                                await logoutTab(profileId);
                            } else {
                                try {
                                    await window.api.sessionTabsLogout(profileId);
                                    showToast("Profil ausgeloggt", "info");
                                    scheduleAutoSave();
                                } catch (err) {
                                    logErr(err, "renderer");
                                    showToast("Ausloggen fehlgeschlagen", "error");
                                }
                            }
                        } else {
                            // Handle login
                            const singleTab = findTab(profileId);
                            if (singleTab && singleTab.loggedOut) {
                                await loginTab(profileId);
                            } else {
                                try {
                                    await window.api.sessionTabsLogin(profileId);
                                    showToast("Profil eingeloggt", "success");
                                    scheduleAutoSave();
                                } catch (err) {
                                    logErr(err, "renderer");
                                    showToast("Einloggen fehlgeschlagen", "error");
                                }
                            }
                        }
                        resolve();
                    };
                    item.append(actionBtn);
                    list.append(item);
                }
            }).catch((err) => {
                console.error("Failed to load profiles:", err);
                closeModal();
            });
        });
    }

    async function openTab(profileId: string) {

        // Check if profile already exists as a single tab
        const existingSingle = findSingleTab(profileId);
        if (existingSingle) {
            if (pendingSplitAnchor && pendingSplitAnchor !== profileId && isOpen(pendingSplitAnchor)) {
                const anchor = pendingSplitAnchor;
                pendingSplitAnchor = null;
                await applySplit({
                    type: "split-2",
                    cells: [
                        { id: anchor, position: 0 },
                        { id: profileId, position: 1 },
                    ],
                    ratio: currentSplitRatio,
                    activePosition: 0,
                });
                return;
            }
            pendingSplitAnchor = null;
            return setActive(profileId);
        }
        // Check if profile exists in a layout tab
        if (isProfileInAnyLayout(profileId)) {
            return setActive(profileId);
        }
        const profiles: Profile[] = await window.api.profilesList();
        const p = profiles.find((x) => x.id === profileId);
        rememberProfileName(profileId, p?.name, p?.job);
        const title = p?.name ?? profileId;
        const tabBtn = document.createElement("button");
        tabBtn.className = "tabBtn sessionTab";
        tabBtn.dataset.title = title;
        const splitGlyph = el("span", "tabGlyph", "");
        (splitGlyph as HTMLElement).style.display = "none";
        const jobIcon = createJobIcon(p?.job, "tabJobIcon");
        const label = el("span", "tabLabel", title);
        if (p?.job?.trim())
            tabBtn.title = p.job;
        const closeBtn = el("span", "tabClose", "×");
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            handleCloseChoice(profileId).catch(console.error);
        };
        tabBtn.append(splitGlyph);
        if (jobIcon)
            tabBtn.append(jobIcon);
        tabBtn.append(label, closeBtn);
        tabBtn.onclick = () => {
            setActive(profileId, "left").catch(console.error);
        };
        tabBtn.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            setActive(profileId, "right").catch(console.error);
        });
        attachDnd(tabBtn, profileId);
        // Create single-type tab with unique ID
        const tab: Tab = {
            id: generateTabId(),
            type: "single",
            profileId,
            name: title,
            tabBtn,
            loggedOut: false,
        };
        tabs.push(tab);
        renderTabsOrder();
        await window.api.sessionTabsOpen(profileId);
        if (pendingSplitAnchor && pendingSplitAnchor !== profileId && isOpen(pendingSplitAnchor)) {
            const anchor = pendingSplitAnchor;
            pendingSplitAnchor = null;
            await applySplit({
                type: "split-2",
                cells: [
                    { id: anchor, position: 0 },
                    { id: profileId, position: 1 },
                ],
                ratio: currentSplitRatio,
                activePosition: 0,
            });
            return;
        }
        pendingSplitAnchor = null;
        activeTabId = tab.id;
        await setActive(profileId);
        updateWindowTitle();
    }

    async function showPicker() {

        await hideSessionViews();
        const overlay = el("div", "modalOverlay");
        const modal = el("div", "modal");
        const header = el("div", "modalHeader", t("picker.title"));
        const body = el("div", "modalBody");
        const list = el("div", "pickerList");
        modal.append(header, body);
        body.append(list);
        overlay.append(modal);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape")
                close().catch(console.error);
        };
        const close = async () => {
            overlay.remove();
            window.removeEventListener("keydown", onKey);
            await showSessionViews();
            kickBounds();
        };
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay)
                close().catch(console.error);
        });
        window.addEventListener("keydown", onKey);
        document.body.append(overlay);
        const profiles: Profile[] = await window.api.profilesList();
        const candidates = profiles.filter((p) => p.launchMode === "tabs" && !isOpen(p.id));
        if (candidates.length === 0) {
            list.append(el("div", "pickerEmpty", t("picker.empty")));
            return;
        }
        for (const p of candidates) {
            const item = el("button", "pickerItem", p.name) as HTMLButtonElement;
            item.onclick = async () => {
                await openTab(p.id);
                await close();
            };
            list.append(item);
        }
    }

    async function showGridConfigModal(type: LayoutType, initial?: LayoutState | null): Promise<LayoutState | null> {

        const config = GRID_CONFIGS[type];
        const overlay = el("div", "modalOverlay");
        const modal = el("div", "modal gridConfigModal");
        const header = el("div", "modalHeader", layoutLabels[type] ?? t("layout.select"));
        const body = el("div", "modalBody");
        const hint = el("div", "modalHint", t("layout.gridHint"));
        const grid = el("div", "layoutGrid") as HTMLDivElement;
        grid.style.gridTemplateColumns = `repeat(${config.cols}, minmax(${LAYOUT_CONST.MIN_CELL_WIDTH}px, 1fr))`;
        grid.style.gridTemplateRows = `repeat(${config.rows}, minmax(${LAYOUT_CONST.MIN_CELL_HEIGHT}px, 1fr))`;
        const actions = el("div", "manageActions");
        const btnSave = el("button", "btn primary", t("create.save")) as HTMLButtonElement;
        const btnCancel = el("button", "btn", t("create.cancel")) as HTMLButtonElement;
        actions.append(btnSave, btnCancel);
        const pickerContainer = el("div", "cellPickerContainer");
        body.append(hint, grid, pickerContainer);
        body.style.flex = "1 1 auto";
        body.style.minHeight = "0";
        body.style.overflowY = "auto";
        modal.append(header, body, actions);
        overlay.append(modal);
        document.body.append(overlay);
        // Load all available profiles for cell picker
        const allProfiles: Profile[] = await window.api.profilesList();
        const tabModeProfiles = allProfiles.filter((p) => p.launchMode === "tabs");
        tabModeProfiles.forEach((p) => rememberProfileName(p.id, p.name, p.job));
        // Get IDs of profiles already used in other tabs/layouts (excluding current layout being edited)
        const usedProfileIds = new Set<string>();
        // First, add profiles from current window's tabs
        for (const tab of tabs) {
            if (tab.type === "single" && tab.profileId) {
                usedProfileIds.add(tab.profileId);
            } else if (tab.type === "layout" && tab.layout) {
                // Skip the current layout being edited (if initial is set, we're editing)
                if (initial && tab.layout.type === initial.type) continue;
                for (const cell of tab.layout.cells) {
                    usedProfileIds.add(cell.id);
                }
            }
        }
        // Then, add profiles from ALL other windows (multi-window support)
        try {
            if (window.api.sessionTabsGetAllOpenProfiles) {
                const allOpenProfiles = await window.api.sessionTabsGetAllOpenProfiles();
                allOpenProfiles.forEach(id => usedProfileIds.add(id));
            }
        } catch (err) {
            console.warn("Failed to get all open profiles:", err);
        }
        let cells: GridCell[] = initial && initial.type === type ? [...initial.cells] : [];
        let activePosition = initial?.activePosition ?? cells[0]?.position ?? 0;
        let resolvePromise: (layout: LayoutState | null) => void = () => undefined;
        const close = (result: LayoutState | null) => {
            overlay.remove();
            resolvePromise(result);
            kickBounds();
        };
        const done = new Promise<LayoutState | null>((resolve) => {
            resolvePromise = resolve;
        });
        function getProfileName(id: string): string {
            return tabModeProfiles.find((p) => p.id === id)?.name ?? findTab(id)?.name ?? id;
        }
        function renderGrid() {
            grid.innerHTML = "";
            pickerContainer.innerHTML = "";
            const maxCells = Math.min(config.maxViews, config.rows * config.cols);
            for (let pos = 0; pos < maxCells; pos++) {
                const current = cells.find((c) => c.position === pos);
                // Show only position number, profile name shown on hover/selection
                const cellBtn = el("button", "gridCellBtn") as HTMLButtonElement;
                const numSpan = el("span", "cellNum", String(pos + 1));
                const nameSpan = el("span", "cellName", current ? getProfileName(current.id) : t("layout.emptyCell"));
                cellBtn.append(numSpan, nameSpan);
                if (!current) cellBtn.classList.add("empty");
                cellBtn.dataset.position = String(pos);
                if (activePosition === pos)
                    cellBtn.classList.add("active");
                cellBtn.onclick = () => openCellPicker(pos, current?.id ?? null);
                // Drag & drop reorder
                cellBtn.draggable = true;
                cellBtn.addEventListener("dragstart", (ev) => {
                    ev.dataTransfer?.setData("text/plain", String(pos));
                    cellBtn.classList.add("dragging");
                });
                cellBtn.addEventListener("dragend", () => {
                    cellBtn.classList.remove("dragging");
                    cellBtn.classList.remove("dragOver");
                });
                cellBtn.addEventListener("dragover", (ev) => {
                    ev.preventDefault();
                    cellBtn.classList.add("dragOver");
                });
                cellBtn.addEventListener("dragleave", () => cellBtn.classList.remove("dragOver"));
                cellBtn.addEventListener("drop", (ev) => {
                    ev.preventDefault();
                    cellBtn.classList.remove("dragOver");
                    const from = Number(ev.dataTransfer?.getData("text/plain"));
                    const to = pos;
                    if (!Number.isFinite(from) || from === to)
                        return;
                    const fromIdx = cells.findIndex((c) => c.position === from);
                    const toIdx = cells.findIndex((c) => c.position === to);
                    if (fromIdx < 0)
                        return;
                    // swap positions
                    cells[fromIdx] = { ...cells[fromIdx], position: to };
                    if (toIdx >= 0 && toIdx !== fromIdx) {
                        cells[toIdx] = { ...cells[toIdx], position: from };
                    }
                    cells = cells.sort((a, b) => a.position - b.position);
                    if (activePosition === from)
                        activePosition = to;
                    else if (activePosition === to)
                        activePosition = from;
                    renderGrid();
                });
                grid.append(cellBtn);
            }
            // Disable save button if no cells have profiles assigned
            btnSave.disabled = cells.length === 0;
        }
        function openCellPicker(position: number, currentId: string | null) {
            // Clear previous picker and show new one inline
            pickerContainer.innerHTML = "";
            const pickerLabel = el("div", "cellPickerLabel", `${t("layout.emptyCell") !== "Leere Zelle" ? "Cell" : "Zelle"} ${position + 1}:`);
            const menu = el("div", "cellPickerMenu") as HTMLDivElement;
            // Get IDs already used in current cells (excluding the current position)
            const usedInCurrentCells = new Set(cells.filter((c) => c.position !== position).map((c) => c.id));
            // Filter profiles: not used elsewhere AND not used in other cells of this layout
            const availableProfiles = tabModeProfiles.filter((p) =>
                !usedProfileIds.has(p.id) && !usedInCurrentCells.has(p.id)
            );
            // Also include the current profile if set (so user can keep it)
            if (currentId) {
                const currentProfile = tabModeProfiles.find((p) => p.id === currentId);
                if (currentProfile && !availableProfiles.some((p) => p.id === currentId)) {
                    availableProfiles.unshift(currentProfile);
                }
            }
            const options: { label: string; value: string }[] = [
                // Only show "empty" option if cell already has a profile assigned
                ...(currentId ? [{ label: t("layout.emptyCell"), value: "" }] : []),
                ...availableProfiles.map((p) => ({ label: p.name, value: p.id })),
            ];
            for (const opt of options) {
                const btn = el("button", "pickerItem", opt.label) as HTMLButtonElement;
                if (opt.value === currentId) {
                    btn.classList.add("selected");
                }
                btn.onclick = () => {
                    cells = cells.filter((c) => c.position !== position);
                    if (opt.value) {
                        cells.push({ id: opt.value, position });
                    }
                    if (activePosition === position && !opt.value) {
                        activePosition = cells[0]?.position ?? 0;
                    }
                    renderGrid();
                };
                menu.append(btn);
            }
            pickerContainer.append(pickerLabel, menu);
            menu.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        btnSave.onclick = () => {
            const normalized = normalizeLayoutState({
                type,
                cells,
                ratio: type === "split-2" ? currentSplitRatio : undefined,
                activePosition: activePosition ?? cells[0]?.position ?? 0,
            });
            close(normalized);
        };
        btnCancel.onclick = () => close(null);
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay)
                close(null);
        });
        document.addEventListener("keydown", function escHandler(ev) {
            if (ev.key === "Escape") {
                close(null);
                document.removeEventListener("keydown", escHandler);
            }
        });
        renderGrid();
        return done;
    }

    async function showLayoutSelector() {

        await hideSessionViews();
        const overlay = el("div", "modalOverlay");
        const modal = el("div", "modal");
        const header = el("div", "modalHeader", t("layout.select"));
        const body = el("div", "modalBody");
        const list = el("div", "pickerList layoutTypeList");
        body.append(list);
        modal.append(header, body);
        overlay.append(modal);
        document.body.append(overlay);
        const options: LayoutType[] = ["single", "split-2", "row-3", "row-4", "grid-4", "grid-5", "grid-6", "grid-7", "grid-8"];
        options.forEach((opt) => {
            const item = el("button", "pickerItem", layoutLabels[opt]) as HTMLButtonElement;
            item.onclick = async () => {
                overlay.remove();
                const activeTab = getActiveTab();
                const initial = layoutState?.type === opt ? layoutState : null;
                const targetLayoutTabId = initial && activeTab?.type === "layout" ? activeTab.id : null;
                const configured = await showGridConfigModal(opt, initial);
                await showSessionViews();
                kickBounds();
                if (configured) {
                    // Create a layout tab instead of just setting layoutState
                    await activateMultiLayout(configured, undefined, targetLayoutTabId);
                }
            };
            list.append(item);
        });
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                overlay.remove();
                void showSessionViews();
                kickBounds();
            }
        });
    }

    async function showSplitPicker(anchorId: string) {

        await hideSessionViews();
        const overlay = el("div", "modalOverlay");
        const modal = el("div", "modal");
        const header = el("div", "modalHeader", t("split.title"));
        const body = el("div", "modalBody");
        const hint = el("div", "modalHint", t("split.subtitle"));
        const list = el("div", "pickerList");
        modal.append(header, body);
        body.append(hint, list);
        overlay.append(modal);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape")
                close().catch(console.error);
        };
        const close = async (keepAnchor = false) => {
            overlay.remove();
            window.removeEventListener("keydown", onKey);
            await showSessionViews();
            if (!keepAnchor)
                pendingSplitAnchor = null;
            kickBounds();
        };
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay)
                close().catch(console.error);
        });
        window.addEventListener("keydown", onKey);
        document.body.append(overlay);
        // Only show single tabs in split picker (layout tabs don't have profileId)
        const openTabs = tabs.filter((tab) => tab.type === "single" && tab.profileId !== anchorId);
        if (openTabs.length === 0) {
            list.append(el("div", "pickerEmpty", t("split.noOpenTabs")));
        }
        else {
            for (const tab of openTabs) {
                const item = el("button", "pickerItem", tab.name) as HTMLButtonElement;
                item.onclick = async () => {
                    await applySplit({
                        type: "split-2",
                        cells: [
                            { id: anchorId, position: 0 },
                            { id: tab.profileId!, position: 1 },
                        ],
                        ratio: currentSplitRatio,
                        activePosition: 0,
                    });
                    await close();
                };
                list.append(item);
            }
        }
        const addBtn = el("button", "pickerItem secondary", t("split.openOther")) as HTMLButtonElement;
        addBtn.onclick = async () => {
            await close(true);
            pendingSplitAnchor = anchorId;
            await showPicker();
            pendingSplitAnchor = null;
        };
        body.append(addBtn);
    }
    btnTools.onclick = (e) => {
        e.stopPropagation();
        toggleToolsMenu();
    };
    btnEditMode.onclick = () => {
        closeToolsMenu();
        showProfileManager().catch(console.error);
    };
    btnLogin.onclick = () => {
        if (!activeProfileId)
            return;
        loginTab(activeProfileId).catch(console.error);
    };
    btnSplit.onclick = () => {
        showLayoutSelector().catch(console.error);
    };
    btnSaveLayout.onclick = () => {
        showToast(t("layout.saveStart"), "info");
        saveCurrentLayout().catch((err) => {
            logErr(err, "renderer");
            showToast(`${t("layout.saveError")}: ${err instanceof Error ? err.message : String(err)}`, "error");
        });
    };
    btnLayouts.onclick = () => showLayoutPicker().catch(console.error);
    window.api.onOpenTab((profileId: string) => {
        openTab(profileId).catch(console.error);
    });
    window.api.onOpenTabWithLayout?.((profileId: string, layoutType: string) => {
        const validTypes: LayoutType[] = ["single", "split-2", "row-3", "row-4", "grid-4", "grid-5", "grid-6", "grid-7", "grid-8"];
        if (!validTypes.includes(layoutType as LayoutType)) {
            console.error("Invalid layout type:", layoutType);
            openTab(profileId).catch(console.error);
            return;
        }
        // Show grid config modal with profile pre-filled at position 0
        const initialLayout: LayoutState = {
            type: layoutType as LayoutType,
            cells: [{ id: profileId, position: 0 }],
            activePosition: 0,
        };
        showGridConfigModal(layoutType as LayoutType, initialLayout).then((configured) => {
            if (configured) {
                activateMultiLayout(configured).catch(console.error);
            }
        }).catch(console.error);
    });
    window.api.onSessionActiveChanged((profileId: string | null) => {
        if (profileId && !isOpen(profileId))
            return;
        activeProfileId = profileId;
        if (layoutState && profileId) {
            const cell = layoutState.cells.find((c) => c.id === profileId);
            if (cell) {
                layoutState = { ...layoutState, activePosition: cell.position };
            }
        }
        syncTabClasses();
        updateLoginOverlay();
        // Ensure manual tab-active color stays applied when switching tabs
        applyStoredTabActiveColor();
    });
    window.api.onSessionWindowCloseRequested(() => {
        handleCloseChoice().catch(console.error);
    });
    window.api.onApplyLayout((layout: TabLayout) => {
        markInitialLayoutHandled(layout.id);
        applyLayout(layout).catch(console.error);
    });

    async function tryApplyPendingLayout() {

        if (!window.api.tabLayoutsPending)
            return false;
        try {
            const pending = await window.api.tabLayoutsPending();
            if (pending && typeof pending === "object" && pending.id) {
                markInitialLayoutHandled(pending.id);
                await applyLayout(pending);
                return true;
            }
        }
        catch (err) {
            logErr(err, "renderer");
        }
        return false;
    }

    async function applyInitialLayoutById(id: string) {

        try {
            const layout = await window.api.tabLayoutsGet(id);
            if (!layout)
                return;
            markInitialLayoutHandled(layout.id);
            await applyLayout(layout);
        }
        catch (err) {
            logErr(err, "renderer");
        }
    }

    async function startInitialLoad() {

        // First, try to pull any pending layout the main process cached for us
        const appliedPending = await tryApplyPendingLayout();
        if (appliedPending)
            return;
        if (initialLayoutId) {
            window.api
                .tabLayoutsApply(initialLayoutId)
                .catch((err) => {
                logErr(err, "renderer");
                return applyInitialLayoutById(initialLayoutId).catch(() => undefined);
            });
            initialLayoutFallbackTimer = setTimeout(() => {
                if (!initialLayoutPendingId)
                    return;
                applyInitialLayoutById(initialLayoutPendingId).catch(() => undefined);
            }, 800);
            let initialWatchAttempts = 0;
            const initialWatch = window.setInterval(() => {
                if (!initialLayoutId) {
                    window.clearInterval(initialWatch);
                    return;
                }
                if (tabs.length > 0) {
                    window.clearInterval(initialWatch);
                    return;
                }
                if (initialWatchAttempts >= 3) {
                    window.clearInterval(initialWatch);
                    return;
                }
                initialWatchAttempts += 1;
                applyInitialLayoutById(initialLayoutId).catch(() => undefined);
            }, 1200);
            // Kick an immediate watchdog pass as well
            setTimeout(() => {
                if (tabs.length === 0) {
                    initialWatchAttempts += 1;
                    applyInitialLayoutById(initialLayoutId).catch(() => undefined);
                }
            }, 300);
            return;
        }
        if (initialProfileId) {
            openTab(initialProfileId).catch(console.error);
        }
    }
    // Listen for layout creation events (from multi-window support)
    if (window.api?.onLayoutCreated) {
        window.api.onLayoutCreated(async (layout) => {
            try {
                // Create a layout tab from the received layout
                const layoutTab = await createLayoutTab(layout);
                tabs.push(layoutTab);
                tabsBar.insertBefore(layoutTab.tabBtn, tabsSpacer);
                // Set this as the active tab
                layoutState = layout;
                activeTabId = layoutTab.id;
                // Set active profile from layout
                const activeCell = layout.cells.find((c) => c.position === layout.activePosition) ?? layout.cells[0];
                activeProfileId = activeCell?.id ?? null;
                currentSplitRatio = layout.ratio ?? currentSplitRatio;
                // Update UI
                renderTabsOrder();
                syncTabClasses();
                updateSplitButton();
                kickBounds();
                // Update window title
                updateWindowTitle();
            } catch (err) {
                logErr(err, "onLayoutCreated");
            }
        });
    }
    startInitialLoad().catch((err) => logErr(err, "renderer"));
    syncEditModeUi();
    updateLoginOverlay();
    updateSplitButton();
    syncTabClasses();
    kickBounds();

}


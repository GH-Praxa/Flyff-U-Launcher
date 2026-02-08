import { GRID_CONFIGS } from "../../shared/constants";
import type { TranslationKey } from "../../i18n/translations";
import { el } from "../dom-utils";
import { t } from "../i18n";

type LayoutType = keyof typeof GRID_CONFIGS;

interface Profile {
    id: string;
    name: string;
    job?: string;
    overlayTarget?: boolean;
    supportTarget?: boolean;
}

    // Layout selector for launching a profile


export const layoutOptions: LayoutType[] = ["single", "split-2", "row-3", "row-4", "grid-4", "grid-5", "grid-6", "grid-7", "grid-8"];

export const layoutDisplayNames: Record<LayoutType, string> = {

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

export async function showWindowSelectorForProfile(profileId: string): Promise<void> {

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

export async function showLayoutSelectorForProfile(profileId: string, windowId: string | null): Promise<void> {

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

export async function showGridConfigModal(initialProfileId: string, layoutType: string): Promise<any | null> {

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
        const actions = el("div", "manageActions");
        const btnSave = el("button", "btn primary", t("create.save")) as HTMLButtonElement;
        const btnCancel = el("button", "btn", t("create.cancel")) as HTMLButtonElement;
        actions.append(btnSave, btnCancel);
        // Picker container sits between grid and actions — inline, scrollable
        const pickerContainer = el("div", "cellPickerContainer");
        body.append(hint, grid, pickerContainer);
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
            pickerContainer.innerHTML = "";
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
                    // Clear previous picker
                    pickerContainer.innerHTML = "";
                    // Build profile picker for this cell
                    const pickerLabel = el("div", "cellPickerLabel", `${t("layout.emptyCell") !== "Leere Zelle" ? "Cell" : "Zelle"} ${pos + 1}:`);
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
                            const idx = cells.findIndex(c => c.position === pos);
                            if (idx >= 0) cells.splice(idx, 1);
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
                            const idx = cells.findIndex(c => c.position === pos);
                            if (idx >= 0) {
                                cells[idx] = { id: prof.id, position: pos };
                            } else {
                                cells.push({ id: prof.id, position: pos });
                            }
                            renderGrid();
                        };
                        pickerMenu.append(profBtn);
                    }
                    if (available.length === 0 && !current) {
                        const noProfiles = el("div", "pickerItem muted", t("list.empty" as TranslationKey));
                        pickerMenu.append(noProfiles);
                    }
                    pickerContainer.append(pickerLabel, pickerMenu);
                    pickerMenu.scrollIntoView({ behavior: "smooth", block: "nearest" });
                };
                grid.append(cellBtn);
            }
            btnSave.disabled = cells.length === 0;
        }
        renderGrid();
    });

}

import { el } from "./dom-utils";
import { t } from "./i18n";
import { pushScope, popScope } from "./controller-nav";

export type CustomEditorCell = { x: number; y: number; width: number; height: number };
export type SliderLineResult = { axis: "x" | "y"; pos: number };
export type CustomLayoutResult = {
    cells: CustomEditorCell[];
    sliderLine: SliderLineResult | null;
    ratio?: number;
};

export async function showCustomLayoutEditor(
    initial?: { customCells?: CustomEditorCell[]; sliderLine?: SliderLineResult | null } | null,
): Promise<CustomLayoutResult | null> {

    const cells: CustomEditorCell[] = [];
    if (initial?.customCells) {
        for (const cc of initial.customCells) cells.push({ x: cc.x, y: cc.y, width: cc.width, height: cc.height });
    } else {
        cells.push({ x: 0, y: 0, width: 50, height: 100 });
        cells.push({ x: 50, y: 0, width: 50, height: 100 });
    }
    let selectedIdx = 0;
    let snapPct = 5;
    let sliderLine: SliderLineResult | null = initial?.sliderLine ? { ...initial.sliderLine } : null;

    const snap = (v: number) => Math.round(v / snapPct) * snapPct;
    const clampV = (v: number) => Math.max(0, Math.min(100, v));
    const clampSize = (v: number) => Math.max(5, Math.min(100, v));

    return new Promise<CustomLayoutResult | null>((resolve) => {
        const overlay = el("div", "modalOverlay");
        const modal = el("div", "modal customLayoutModal");
        const header = el("div", "modalHeader", t("layout.custom"));
        const closeBtn = el("button", "modalCloseBtn", "\u00d7") as HTMLButtonElement;
        header.append(closeBtn);
        const body = el("div", "modalBody");
        const hint = el("div", "modalHint", t("layout.customHint"));

        // Toolbar
        const toolbar = el("div", "customEditorToolbar");
        const addBtn = el("button", "btn", t("layout.customAddCell")) as HTMLButtonElement;
        const snapLabel = el("span", "", `${t("layout.customSnap")}:`);
        const snapSelect = document.createElement("select");
        snapSelect.className = "select";
        snapSelect.style.width = "auto";
        for (const v of [1, 5, 10]) {
            const opt = document.createElement("option");
            opt.value = String(v);
            opt.textContent = `${v}%`;
            if (v === snapPct) opt.selected = true;
            snapSelect.append(opt);
        }
        snapSelect.onchange = () => { snapPct = Number(snapSelect.value) || 5; };

        // Slider line controls
        const sliderLabel = el("span", "", "Slider:");
        const sliderSelect = document.createElement("select");
        sliderSelect.className = "select";
        sliderSelect.style.width = "auto";
        for (const [val, label] of [["none", "\u2014"], ["x", "\u2194"], ["y", "\u2195"]] as const) {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = label;
            if (val === "none" && !sliderLine) opt.selected = true;
            if (sliderLine && val === sliderLine.axis) opt.selected = true;
            sliderSelect.append(opt);
        }
        sliderSelect.onchange = () => {
            const v = sliderSelect.value;
            if (v === "none") { sliderLine = null; }
            else { sliderLine = { axis: v as "x" | "y", pos: sliderLine?.pos ?? 50 }; }
            renderCanvas();
        };

        toolbar.append(addBtn, snapLabel, snapSelect, sliderLabel, sliderSelect);

        // Canvas
        const canvas = el("div", "customEditorCanvas");

        // Props panel
        const propsPanel = el("div", "customEditorProps");

        // Actions
        const actions = el("div", "manageActions");
        const applyBtn = el("button", "btn primary", t("layout.select")) as HTMLButtonElement;
        const cancelBtn = el("button", "btn", t("create.cancel")) as HTMLButtonElement;
        actions.append(applyBtn, cancelBtn);

        body.append(hint, toolbar, canvas, propsPanel);
        modal.append(header, body, actions);
        overlay.append(modal);
        document.body.append(overlay);

        function close(result: CustomLayoutResult | null) {
            popScope(overlay);
            overlay.remove();
            window.removeEventListener("keydown", onKey);
            resolve(result);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") close(null);
        }
        window.addEventListener("keydown", onKey);
        // Controller-Navigation auf den Layout-Editor eingrenzen; ◯ schließt.
        pushScope({ el: overlay, onBack: () => close(null) });
        closeBtn.onclick = () => close(null);
        cancelBtn.onclick = () => close(null);
        overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });

        function renderCanvas() {
            canvas.innerHTML = "";
            // Render slider line
            if (sliderLine) {
                const line = el("div", "customSliderLine");
                if (sliderLine.axis === "x") {
                    line.style.left = `${sliderLine.pos}%`;
                    line.style.top = "0";
                    line.style.width = "2px";
                    line.style.height = "100%";
                    line.style.cursor = "ew-resize";
                } else {
                    line.style.top = `${sliderLine.pos}%`;
                    line.style.left = "0";
                    line.style.height = "2px";
                    line.style.width = "100%";
                    line.style.cursor = "ns-resize";
                }
                line.addEventListener("mousedown", (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    startSliderLineDrag(e);
                });
                canvas.append(line);
            }
            cells.forEach((cell, idx) => {
                const div = el("div", `customCell${idx === selectedIdx ? " selected" : ""}`);
                div.dataset.idx = String(idx);
                div.style.left = `${cell.x}%`;
                div.style.top = `${cell.y}%`;
                div.style.width = `${cell.width}%`;
                div.style.height = `${cell.height}%`;
                const label = el("div", "customCellLabel", `${idx + 1}`);
                div.append(label);

                // Resize handles
                for (const dir of ["nw", "ne", "sw", "se", "n", "s", "e", "w"] as const) {
                    const handle = el("div", `customCellHandle ${dir}`);
                    handle.dataset.dir = dir;
                    handle.addEventListener("mousedown", (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        selectedIdx = idx;
                        startResize(idx, dir, e);
                    });
                    div.append(handle);
                }

                div.addEventListener("mousedown", (e) => {
                    if ((e.target as HTMLElement).classList.contains("customCellHandle")) return;
                    e.preventDefault();
                    selectedIdx = idx;
                    startDrag(idx, e);
                });
                canvas.append(div);
            });
            renderProps();
        }

        function renderProps() {
            propsPanel.innerHTML = "";
            if (cells.length === 0) return;
            const cell = cells[selectedIdx];
            if (!cell) return;

            const fields: Array<{ label: string; key: keyof CustomEditorCell; min: number; max: number }> = [
                { label: t("layout.customX"), key: "x", min: 0, max: 100 },
                { label: t("layout.customY"), key: "y", min: 0, max: 100 },
                { label: t("layout.customWidth"), key: "width", min: 5, max: 100 },
                { label: t("layout.customHeight"), key: "height", min: 5, max: 100 },
            ];
            for (const f of fields) {
                const group = el("div", "propGroup");
                const lbl = el("label", "", f.label);
                const inp = document.createElement("input");
                inp.type = "number";
                inp.min = String(f.min);
                inp.max = String(f.max);
                inp.step = String(snapPct);
                inp.value = String(Math.round(cell[f.key]));
                inp.addEventListener("input", () => {
                    const v = Number(inp.value);
                    if (!Number.isFinite(v)) return;
                    (cell as unknown as Record<string, number>)[f.key] = f.key === "width" || f.key === "height" ? clampSize(v) : clampV(v);
                    renderCanvas();
                });
                group.append(lbl, inp);
                propsPanel.append(group);
            }

            // Remove button
            const removeBtn = el("button", "btn", t("layout.customRemoveCell")) as HTMLButtonElement;
            removeBtn.onclick = () => {
                if (cells.length <= 1) return;
                cells.splice(selectedIdx, 1);
                if (selectedIdx >= cells.length) selectedIdx = cells.length - 1;
                renderCanvas();
            };
            if (cells.length <= 1) removeBtn.disabled = true;
            propsPanel.append(removeBtn);
        }

        function startDrag(idx: number, startEvent: MouseEvent) {
            const rect = canvas.getBoundingClientRect();
            const cell = cells[idx];
            const startMX = startEvent.clientX;
            const startMY = startEvent.clientY;
            const startCX = cell.x;
            const startCY = cell.y;
            const onMove = (e: MouseEvent) => {
                const dx = (e.clientX - startMX) / rect.width * 100;
                const dy = (e.clientY - startMY) / rect.height * 100;
                cell.x = clampV(snap(startCX + dx));
                cell.y = clampV(snap(startCY + dy));
                if (cell.x + cell.width > 100) cell.x = 100 - cell.width;
                if (cell.y + cell.height > 100) cell.y = 100 - cell.height;
                if (cell.x < 0) cell.x = 0;
                if (cell.y < 0) cell.y = 0;
                renderCanvas();
            };
            const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
        }

        function startResize(idx: number, dir: string, startEvent: MouseEvent) {
            const rect = canvas.getBoundingClientRect();
            const cell = cells[idx];
            const startMX = startEvent.clientX;
            const startMY = startEvent.clientY;
            const startCX = cell.x;
            const startCY = cell.y;
            const startW = cell.width;
            const startH = cell.height;
            const onMove = (e: MouseEvent) => {
                const dx = (e.clientX - startMX) / rect.width * 100;
                const dy = (e.clientY - startMY) / rect.height * 100;
                if (dir.includes("e")) cell.width = clampSize(snap(startW + dx));
                if (dir.includes("w")) {
                    const newX = clampV(snap(startCX + dx));
                    cell.width = clampSize(startW + (startCX - newX));
                    cell.x = newX;
                }
                if (dir.includes("s")) cell.height = clampSize(snap(startH + dy));
                if (dir.includes("n")) {
                    const newY = clampV(snap(startCY + dy));
                    cell.height = clampSize(startH + (startCY - newY));
                    cell.y = newY;
                }
                renderCanvas();
            };
            const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
        }

        function startSliderLineDrag(startEvent: MouseEvent) {
            if (!sliderLine) return;
            const rect = canvas.getBoundingClientRect();
            const axis = sliderLine.axis;
            const onMove = (e: MouseEvent) => {
                if (!sliderLine) return;
                let pos: number;
                if (axis === "x") {
                    pos = (e.clientX - rect.left) / rect.width * 100;
                } else {
                    pos = (e.clientY - rect.top) / rect.height * 100;
                }
                sliderLine.pos = Math.max(5, Math.min(95, snap(pos)));
                renderCanvas();
            };
            const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
        }

        addBtn.onclick = () => {
            if (cells.length >= 8) return;
            const newX = snap((cells.length * 15) % 60);
            const newY = snap((cells.length * 15) % 60);
            cells.push({ x: newX, y: newY, width: 30, height: 40 });
            selectedIdx = cells.length - 1;
            addBtn.disabled = cells.length >= 8;
            if (cells.length >= 8) addBtn.title = t("layout.customMaxCells");
            renderCanvas();
        };

        applyBtn.onclick = () => {
            if (cells.length === 0) { close(null); return; }
            const result: CustomLayoutResult = {
                cells: cells.map(c => ({
                    x: Math.round(c.x),
                    y: Math.round(c.y),
                    width: Math.round(c.width),
                    height: Math.round(c.height),
                })),
                sliderLine: sliderLine ? { axis: sliderLine.axis, pos: Math.round(sliderLine.pos) } : null,
            };
            if (sliderLine) {
                result.ratio = sliderLine.pos / 100;
            }
            close(result);
        };

        renderCanvas();
    });
}

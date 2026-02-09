import { app } from "electron";
import path from "path";
import { generateId } from "../../shared/utils";
import { createFileStore } from "../../shared/fileStore";
import { GRID_CONFIGS } from "../../shared/constants";
import {
    MultiViewLayoutSchema,
    SavedLayoutTabSchema,
    isLegacySplit,
    migrateToMultiView,
    type MultiViewLayout,
    type SavedLayoutTab,
    type TabLayout,
    type TabLayoutInput,
    type TabLayoutSplit,
} from "../../shared/schemas";

function clampRatio(r: unknown) {
    const n = Number(r);
    if (!Number.isFinite(n))
        return undefined;
    return Math.min(0.8, Math.max(0.2, n));
}
function normalizeSplit(v: unknown): TabLayoutSplit | null {
    if (v === null || v === undefined)
        return null;
    if (isLegacySplit(v)) {
        const migrated = migrateToMultiView({
            leftId: String((v as { leftId: string }).leftId),
            rightId: String((v as { rightId: string }).rightId),
            ratio: clampRatio((v as { ratio?: number }).ratio),
        });
        return { ...migrated, ratio: clampRatio(migrated.ratio) };
    }
    const parsed = MultiViewLayoutSchema.safeParse(v);
    if (!parsed.success)
        return null;
    const layout = parsed.data;
    const config = GRID_CONFIGS[layout.type];
    const maxPositions = config.rows * config.cols;
    const unique = new Map<number, { id: string; position: number }>();
    for (const cell of layout.cells) {
        const pos = Math.max(0, Math.min(maxPositions - 1, cell.position));
        if (!unique.has(pos)) {
            unique.set(pos, { id: cell.id, position: pos });
        }
    }
    const cells = Array.from(unique.values()).sort((a, b) => a.position - b.position).slice(0, config.maxViews);
    if (cells.length === 0)
        return null;
    const ratio = layout.type === "split-2" ? clampRatio(layout.ratio) : undefined;
    const activePosition = layout.activePosition !== undefined && cells.some((c) => c.position === layout.activePosition)
        ? layout.activePosition
        : cells[0].position;
    return {
        type: layout.type,
        cells,
        ratio,
        activePosition,
    } as MultiViewLayout;
}
function normalizeLayoutsArray(v: unknown): SavedLayoutTab[] | undefined {
    if (!Array.isArray(v) || v.length === 0)
        return undefined;
    const result: SavedLayoutTab[] = [];
    for (const item of v) {
        if (!item || typeof item !== "object")
            continue;
        const obj = item as Record<string, unknown>;
        const layoutData = normalizeSplit(obj.layout);
        if (!layoutData || !("type" in layoutData))
            continue;
        const parsed = SavedLayoutTabSchema.safeParse({
            name: typeof obj.name === "string" ? obj.name : undefined,
            layout: layoutData,
        });
        if (parsed.success) {
            result.push(parsed.data);
        }
    }
    return result.length > 0 ? result : undefined;
}

function normalizeLayout(v: unknown): TabLayout | null {
    if (!v || typeof v !== "object")
        return null;
    const obj = v as Record<string, unknown>;
    const tabs = Array.isArray(obj.tabs) ? obj.tabs.map((t) => String(t)).filter(Boolean) : [];
    if (tabs.length === 0)
        return null;
    const createdAt = typeof obj.createdAt === "string" ? obj.createdAt : new Date().toISOString();
    const updatedAt = typeof obj.updatedAt === "string" ? obj.updatedAt : createdAt;
    const loggedOutChars = Array.isArray(obj.loggedOutChars)
        ? obj.loggedOutChars.map((t) => String(t)).filter(Boolean)
        : [];
    return {
        id: String(obj.id ?? generateId()),
        name: String(obj.name ?? "Layout"),
        createdAt,
        updatedAt,
        tabs,
        split: normalizeSplit(obj.split),
        layouts: normalizeLayoutsArray(obj.layouts),
        activeId: typeof obj.activeId === "string" ? obj.activeId : null,
        loggedOutChars,
    };
}

const layoutStore = createFileStore<TabLayout>({
    getPath: () => path.join(app.getPath("userData"), "user", "ui", "tab-layouts.json"),
    normalize: normalizeLayout,
});
export function createTabLayoutsStore() {
    return {
        async list(): Promise<TabLayout[]> {
            return layoutStore.read();
        },
        async get(layoutId: string): Promise<TabLayout | null> {
            return layoutStore.findById(layoutId);
        },
        async save(input: TabLayoutInput): Promise<TabLayout[]> {
            const normalized = normalizeLayout(input);
            if (!normalized)
                throw new Error("invalid layout");
            const now = new Date().toISOString();
            return layoutStore.update((all) => {
                const existing = input.id ? all.find((l) => l.id === input.id) : null;
                if (existing) {
                    // Preserve name and createdAt when updating, only update if new name provided
                    const updatedName = input.name?.trim() || existing.name;
                    return all.map((l) => (l.id === existing.id ? { ...normalized, name: updatedName, createdAt: existing.createdAt, updatedAt: now } : l));
                }
                return [...all, { ...normalized, id: generateId(), createdAt: now, updatedAt: now }];
            });
        },
        async delete(layoutId: string): Promise<TabLayout[]> {
            return layoutStore.update((all) => all.filter((l) => l.id !== layoutId));
        },
    };
}

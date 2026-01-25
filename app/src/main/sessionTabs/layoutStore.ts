import { app } from "electron";
import path from "path";
import { generateId } from "../../shared/utils";
import { createFileStore } from "../../shared/fileStore";

export type TabLayoutSplit = {
    leftId: string;
    rightId: string;
    ratio?: number;
};
export type TabLayout = {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    tabs: string[];
    split?: TabLayoutSplit | null;
    activeId?: string | null;
    loggedOutChars?: string[];
};
export type TabLayoutInput = {
    id?: string;
    name: string;
    tabs: string[];
    split?: TabLayoutSplit | null;
    activeId?: string | null;
    loggedOutChars?: string[];
};

function clampRatio(r: unknown) {
    const n = Number(r);
    if (!Number.isFinite(n))
        return undefined;
    return Math.min(0.8, Math.max(0.2, n));
}
function normalizeSplit(v: unknown): TabLayoutSplit | null {
    if (!v || typeof v !== "object")
        return null;
    const obj = v as Record<string, unknown>;
    if (!obj.leftId || !obj.rightId || typeof obj.leftId !== "string" || typeof obj.rightId !== "string")
        return null;
    const ratio = clampRatio(obj.ratio);
    return { leftId: obj.leftId, rightId: obj.rightId, ratio: ratio ?? undefined };
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
        activeId: typeof obj.activeId === "string" ? obj.activeId : null,
        loggedOutChars,
    };
}

const layoutStore = createFileStore<TabLayout>({
    getPath: () => path.join(app.getPath("userData"), "tabLayouts.json"),
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

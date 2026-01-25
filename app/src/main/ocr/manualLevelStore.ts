import { app } from "electron";
import path from "path";
import { createFileStore } from "../../shared/fileStore";

export type ManualLevelOverrideRow = {
    profileId: string;
    value: number;
    enabled: boolean;
    updatedAt: number;
};

const MIN_LEVEL = 1;
const MAX_LEVEL = 300;

function clampLevel(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return MIN_LEVEL;
    return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(n)));
}

const store = createFileStore<ManualLevelOverrideRow>({
    getPath: () => path.join(app.getPath("userData"), "manual-levels.json"),
    normalize(raw) {
        if (!raw || typeof raw !== "object") return null;
        const obj = raw as Record<string, unknown>;
        const profileId = typeof obj.profileId === "string" && obj.profileId.trim() ? obj.profileId : null;
        if (!profileId) return null;
        const value = clampLevel(obj.value);
        const enabled = Boolean(obj.enabled);
        const updatedAt = typeof obj.updatedAt === "number" && Number.isFinite(obj.updatedAt)
            ? obj.updatedAt
            : Date.now();
        return { profileId, value, enabled, updatedAt };
    },
});

export async function loadManualLevelOverrides(): Promise<ManualLevelOverrideRow[]> {
    return store.read();
}

export async function persistManualLevelOverride(
    profileId: string,
    patch: Partial<Pick<ManualLevelOverrideRow, "value" | "enabled">>
): Promise<ManualLevelOverrideRow | null> {
    if (!profileId.trim()) return null;
    const sanitized: Partial<ManualLevelOverrideRow> = {};
    if ("value" in patch) sanitized.value = clampLevel(patch.value);
    if ("enabled" in patch && typeof patch.enabled === "boolean") sanitized.enabled = patch.enabled;

    const nextRows = await store.update((rows) => {
        const remaining = rows.filter((row) => row.profileId !== profileId);
        const existing = rows.find((row) => row.profileId === profileId);
        const base: ManualLevelOverrideRow = existing ?? {
            profileId,
            value: clampLevel(patch.value ?? MIN_LEVEL),
            enabled: false,
            updatedAt: Date.now(),
        };
        const next: ManualLevelOverrideRow = {
            profileId,
            value: sanitized.value ?? base.value,
            enabled: sanitized.enabled ?? base.enabled,
            updatedAt: Date.now(),
        };
        return [...remaining, next];
    });

    return nextRows.find((row) => row.profileId === profileId) ?? null;
}

export function clampManualLevel(value: unknown): number {
    return clampLevel(value);
}

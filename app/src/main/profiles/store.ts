import { app } from "electron";
import path from "path";
import { generateId } from "../../shared/utils";
import { createFileStore } from "../../shared/fileStore";

export type LaunchMode = "tabs" | "window";
export type OverlaySettings = {
    showExp?: boolean;
    showDeltaExp?: boolean;
    showTotalExp?: boolean;
    showKillsSession?: boolean;
    showKillsLifetime?: boolean;
    showKillsPerMinute?: boolean;
    showKillsPerHour?: boolean;
    showSessionTime?: boolean;
    showLastKill?: boolean;
    showAvgExpPerKill?: boolean;
    showExpPerMinute?: boolean;
    showResetButton?: boolean;
};
export type OverlayHudLayout = {
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
};
export type ProfileFeatures = {
    questlog: {
        enabled: boolean;
    };
};
/**
 * Per-Profil-Controller-Daten — Action-Pad-Position als Bruchteil 0..1 der
 * Canvas-Groesse. `null`/undefined = nicht kalibriert, D-Pad-Up triggert
 * dann nichts.
 */
export type ProfileController = {
    actionPadX?: number | null;
    actionPadY?: number | null;
};
export type Profile = {
    id: string;
    name: string;
    createdAt: string;
    characterJobs?: Record<string, string>;
    launchMode: LaunchMode;
    overlayTarget?: boolean;
    overlaySupportTarget?: boolean;
    overlayIconKey?: string;
    overlaySupportIconKey?: string;
    overlaySettings?: OverlaySettings;
    overlayHud?: OverlayHudLayout;
    features?: ProfileFeatures;
    characters?: string[];
    controller?: ProfileController;
};
function defaultOverlaySettings(): OverlaySettings {
    return {
        showExp: true,
        showDeltaExp: true,
        showTotalExp: false,
        showKillsSession: false,
        showKillsLifetime: false,
        showKillsPerMinute: false,
        showKillsPerHour: false,
        showSessionTime: false,
        showLastKill: false,
        showAvgExpPerKill: false,
        showExpPerMinute: false,
        showResetButton: true,
    };
}
function normalizeOverlaySettings(v: unknown): OverlaySettings {
    const d = defaultOverlaySettings();
    if (!v || typeof v !== "object")
        return d;
    const obj = v as Record<string, unknown>;
    const b = (x: unknown, fallback: boolean) => (typeof x === "boolean" ? x : fallback);
    return {
        showExp: b(obj.showExp, d.showExp!),
        showDeltaExp: b(obj.showDeltaExp, d.showDeltaExp!),
        showTotalExp: b(obj.showTotalExp, d.showTotalExp!),
        showKillsSession: b(obj.showKillsSession, d.showKillsSession!),
        showKillsLifetime: b(obj.showKillsLifetime, d.showKillsLifetime!),
        showKillsPerMinute: b(obj.showKillsPerMinute, d.showKillsPerMinute!),
        showKillsPerHour: b(obj.showKillsPerHour, d.showKillsPerHour!),
        showSessionTime: b(obj.showSessionTime, d.showSessionTime!),
        showLastKill: b(obj.showLastKill, d.showLastKill!),
        showAvgExpPerKill: b(obj.showAvgExpPerKill, d.showAvgExpPerKill!),
        showExpPerMinute: b(obj.showExpPerMinute, d.showExpPerMinute!),
        showResetButton: b(obj.showResetButton, d.showResetButton!),
    };
}
function defaultHudLayout(): OverlayHudLayout {
    return { offsetX: 12, offsetY: 12, width: 380, height: 320 };
}
function normalizeHudLayout(v: unknown): OverlayHudLayout {
    const d = defaultHudLayout();
    if (!v || typeof v !== "object")
        return d;
    const obj = v as Record<string, unknown>;
    const n = (x: unknown, fallback: number) => (Number.isFinite(Number(x)) ? Number(x) : fallback);
    const width = Math.max(260, n(obj.width, d.width));
    const height = Math.max(180, n(obj.height, d.height));
    return {
        offsetX: n(obj.offsetX, d.offsetX),
        offsetY: n(obj.offsetY, d.offsetY),
        width,
        height,
    };
}
function defaultFeatures(): ProfileFeatures {
    return { questlog: { enabled: false } };
}
function normalizeController(v: unknown): ProfileController | undefined {
    if (!v || typeof v !== "object") return undefined;
    const obj = v as Record<string, unknown>;
    const x = typeof obj.actionPadX === "number" && obj.actionPadX >= 0 && obj.actionPadX <= 1
        ? obj.actionPadX
        : null;
    const y = typeof obj.actionPadY === "number" && obj.actionPadY >= 0 && obj.actionPadY <= 1
        ? obj.actionPadY
        : null;
    if (x === null && y === null) return undefined;
    return { actionPadX: x, actionPadY: y };
}

function normalizeFeatures(v: unknown): ProfileFeatures {
    const base = defaultFeatures();
    if (!v || typeof v !== "object")
        return base;
    const obj = v as Record<string, unknown>;
    const ql = obj.questlog && typeof obj.questlog === "object" ? obj.questlog as Record<string, unknown> : {};
    return {
        questlog: {
            enabled: typeof ql.enabled === "boolean" ? ql.enabled : base.questlog.enabled,
        },
    };
}

function normalizeProfile(v: unknown): Profile | null {
    if (!v || typeof v !== "object")
        return null;
    const p = v as Record<string, unknown>;
    return {
        id: String(p.id ?? generateId()),
        name: String(p.name ?? "Profil"),
        createdAt: String(p.createdAt ?? new Date().toISOString()),
        characterJobs: (() => {
            // Migrate old single-job field to per-character jobs
            if (p.characterJobs && typeof p.characterJobs === "object" && !Array.isArray(p.characterJobs)) {
                const cj: Record<string, string> = {};
                for (const [k, v] of Object.entries(p.characterJobs as Record<string, unknown>)) {
                    if (typeof v === "string" && v) cj[k] = v;
                }
                return Object.keys(cj).length > 0 ? cj : undefined;
            }
            // Migration: old `job` field → assign to first character
            if (typeof p.job === "string" && p.job) {
                const chars = Array.isArray(p.characters) ? p.characters.filter((c: unknown): c is string => typeof c === "string" && c.length > 0) : [];
                if (chars.length > 0) {
                    return { [chars[0]]: p.job };
                }
            }
            return undefined;
        })(),
        launchMode: (p.launchMode === "window" ? "window" : "tabs") as LaunchMode,
        overlayTarget: !!p.overlayTarget,
        overlaySupportTarget: !!p.overlaySupportTarget,
        overlayIconKey: typeof p.overlayIconKey === "string" ? p.overlayIconKey : "default",
        overlaySupportIconKey: typeof p.overlaySupportIconKey === "string" ? p.overlaySupportIconKey : "default",
        overlaySettings: normalizeOverlaySettings(p.overlaySettings),
        overlayHud: normalizeHudLayout(p.overlayHud),
        features: normalizeFeatures(p.features),
        characters: Array.isArray(p.characters)
            ? p.characters.filter((c): c is string => typeof c === "string" && c.length > 0).slice(0, 64)
            : undefined,
        controller: normalizeController(p.controller),
    };
}

const profileStore = createFileStore<Profile>({
    getPath: () => path.join(app.getPath("userData"), "user", "profiles", "profiles.json"),
    normalize: normalizeProfile,
});
export function createProfilesStore() {
    // In-memory cache for the hot 50 ms sync loops.
    // undefined = not yet loaded; null = no target set; string = profile id.
    // Invalidated whenever the overlay target is explicitly changed or a profile
    // is deleted (which might remove the current target).
    let overlayTargetIdCache: string | null | undefined = undefined;
    let overlaySupportTargetIdCache: string | null | undefined = undefined;

    return {
        async list(): Promise<Profile[]> {
            return profileStore.read();
        },
        async create(name: string): Promise<Profile[]> {
            return profileStore.update((ps) => [
                ...ps,
                {
                    id: generateId(),
                    name: name.trim() || "Profil",
                    createdAt: new Date().toISOString(),
                    launchMode: "tabs" as LaunchMode,
                    overlayTarget: false,
                    overlaySupportTarget: false,
                    overlayIconKey: "default",
                    overlaySupportIconKey: "default",
                    overlaySettings: defaultOverlaySettings(),
                    overlayHud: defaultHudLayout(),
                    features: defaultFeatures(),
                },
            ]);
        },
        async update(patch: Partial<Profile> & { id: string }): Promise<Profile[]> {
            // Generic patch may touch overlayTarget flags – invalidate caches.
            if (patch.overlayTarget !== undefined) overlayTargetIdCache = undefined;
            if (patch.overlaySupportTarget !== undefined) overlaySupportTargetIdCache = undefined;
            return profileStore.update((ps) =>
                ps.map((p) => {
                    if (p.id !== patch.id)
                        return p;
                    const mergedSettings = patch.overlaySettings !== undefined
                        ? normalizeOverlaySettings({ ...(p.overlaySettings ?? defaultOverlaySettings()), ...patch.overlaySettings })
                        : p.overlaySettings;
                    const mergedHud = patch.overlayHud !== undefined
                        ? normalizeHudLayout({ ...(p.overlayHud ?? defaultHudLayout()), ...patch.overlayHud })
                        : p.overlayHud;
                    const mergedFeatures = patch.features !== undefined
                        ? normalizeFeatures({ ...(p.features ?? defaultFeatures()), ...patch.features })
                        : p.features;
                    const mergedController = patch.controller !== undefined
                        ? normalizeController({ ...(p.controller ?? {}), ...patch.controller })
                        : p.controller;
                    return {
                        ...p,
                        ...patch,
                        overlaySettings: mergedSettings,
                        overlayHud: mergedHud,
                        features: mergedFeatures ?? defaultFeatures(),
                        controller: mergedController,
                    };
                })
            );
        },
        async delete(profileId: string): Promise<Profile[]> {
            // Deleted profile might have been the overlay target.
            if (overlayTargetIdCache === profileId) overlayTargetIdCache = undefined;
            if (overlaySupportTargetIdCache === profileId) overlaySupportTargetIdCache = undefined;
            return profileStore.update((ps) => ps.filter((p) => p.id !== profileId));
        },
        async clone(profileId: string, newName: string): Promise<Profile[]> {
            return profileStore.update((ps) => {
                const src = ps.find((p) => p.id === profileId);
                if (!src)
                    return ps;
                return [
                    ...ps,
                    {
                        ...src,
                        id: generateId(),
                        name: newName.trim() || `${src.name} (Copy)`,
                        createdAt: new Date().toISOString(),
                        overlayTarget: false,
                        overlaySupportTarget: false,
                        overlaySettings: normalizeOverlaySettings(src.overlaySettings),
                        overlayHud: normalizeHudLayout(src.overlayHud),
                        features: normalizeFeatures(src.features),
                    },
                ];
            });
        },
        async reorder(orderedIds: string[]): Promise<Profile[]> {
            return profileStore.update((ps) => {
                const map = new Map(ps.map((p) => [p.id, p]));
                const ordered = orderedIds.map((pid) => map.get(pid)).filter(Boolean) as Profile[];
                const rest = ps.filter((p) => !orderedIds.includes(p.id));
                return [...ordered, ...rest];
            });
        },
        async getOverlayTargetId(): Promise<string | null> {
            if (overlayTargetIdCache !== undefined) return overlayTargetIdCache;
            const ps = await profileStore.read();
            const targets = ps.filter((p) => p.overlayTarget).map((p) => p.id);
            overlayTargetIdCache = targets[0] ?? null;
            // Diagnostic removed — overlay target ID is cached after first read
            return overlayTargetIdCache;
        },
        async setOverlayTarget(profileId: string | null, iconKey?: string): Promise<Profile[]> {
            const result = await profileStore.update((ps) =>
                ps.map((p) => {
                    if (!profileId)
                        return { ...p, overlayTarget: false };
                    if (p.id !== profileId)
                        return { ...p, overlayTarget: false };
                    return {
                        ...p,
                        overlayTarget: true,
                        overlaySupportTarget: false, // same Profil kann nicht beide Rollen haben
                        overlayIconKey: iconKey ?? p.overlayIconKey ?? "default",
                    };
                })
            );
            overlayTargetIdCache = profileId;
            // If this profile was the support target it no longer is.
            if (profileId && overlaySupportTargetIdCache === profileId) overlaySupportTargetIdCache = null;
            return result;
        },
        async getOverlaySupportTargetId(): Promise<string | null> {
            if (overlaySupportTargetIdCache !== undefined) return overlaySupportTargetIdCache;
            const ps = await profileStore.read();
            overlaySupportTargetIdCache = ps.find((p) => p.overlaySupportTarget)?.id ?? null;
            return overlaySupportTargetIdCache;
        },
        async setOverlaySupportTarget(profileId: string | null, iconKey?: string): Promise<Profile[]> {
            const result = await profileStore.update((ps) =>
                ps.map((p) => {
                    if (!profileId)
                        return { ...p, overlaySupportTarget: false };
                    if (p.id !== profileId)
                        return { ...p, overlaySupportTarget: false };
                    return {
                        ...p,
                        overlayTarget: false, // gleiche Entität darf nicht beides sein
                        overlaySupportTarget: true,
                        overlaySupportIconKey: iconKey ?? p.overlaySupportIconKey ?? "default",
                    };
                })
            );
            overlaySupportTargetIdCache = profileId;
            // If this profile was the main overlay target it no longer is.
            if (profileId && overlayTargetIdCache === profileId) overlayTargetIdCache = null;
            return result;
        },
        async getOverlaySettings(profileId: string): Promise<OverlaySettings> {
            const p = await profileStore.findById(profileId);
            return normalizeOverlaySettings(p?.overlaySettings);
        },
        async patchOverlaySettings(profileId: string, patch: Partial<OverlaySettings>): Promise<OverlaySettings> {
            const next = await profileStore.update((ps) =>
                ps.map((p) => {
                    if (p.id !== profileId)
                        return p;
                    const merged = normalizeOverlaySettings({ ...(p.overlaySettings ?? defaultOverlaySettings()), ...patch });
                    return { ...p, overlaySettings: merged };
                })
            );
            const updated = next.find((p) => p.id === profileId);
            return normalizeOverlaySettings(updated?.overlaySettings);
        },
        async getOverlayHudLayout(profileId: string): Promise<OverlayHudLayout> {
            const p = await profileStore.findById(profileId);
            return normalizeHudLayout(p?.overlayHud);
        },
        async patchOverlayHudLayout(profileId: string, patch: Partial<OverlayHudLayout>): Promise<OverlayHudLayout> {
            const next = await profileStore.update((ps) =>
                ps.map((p) => {
                    if (p.id !== profileId)
                        return p;
                    const merged = normalizeHudLayout({ ...(p.overlayHud ?? defaultHudLayout()), ...patch });
                    return { ...p, overlayHud: merged };
                })
            );
            const updated = next.find((p) => p.id === profileId);
            return normalizeHudLayout(updated?.overlayHud);
        },
    };
}

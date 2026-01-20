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
export type Profile = {
    id: string;
    name: string;
    createdAt: string;
    job?: string;
    launchMode: LaunchMode;
    overlayTarget?: boolean;
    overlaySupportTarget?: boolean;
    overlayIconKey?: string;
    overlaySupportIconKey?: string;
    overlaySettings?: OverlaySettings;
    overlayHud?: OverlayHudLayout;
    features?: ProfileFeatures;
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
        job: typeof p.job === "string" ? p.job : undefined,
        launchMode: (p.launchMode === "window" ? "window" : "tabs") as LaunchMode,
        overlayTarget: !!p.overlayTarget,
        overlaySupportTarget: !!p.overlaySupportTarget,
        overlayIconKey: typeof p.overlayIconKey === "string" ? p.overlayIconKey : "default",
        overlaySupportIconKey: typeof p.overlaySupportIconKey === "string" ? p.overlaySupportIconKey : "default",
        overlaySettings: normalizeOverlaySettings(p.overlaySettings),
        overlayHud: normalizeHudLayout(p.overlayHud),
        features: normalizeFeatures(p.features),
    };
}

const profileStore = createFileStore<Profile>({
    getPath: () => path.join(app.getPath("userData"), "profiles.json"),
    normalize: normalizeProfile,
});
export function createProfilesStore() {
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
                    return {
                        ...p,
                        ...patch,
                        overlaySettings: mergedSettings,
                        overlayHud: mergedHud,
                        features: mergedFeatures ?? defaultFeatures(),
                    };
                })
            );
        },
        async delete(profileId: string): Promise<Profile[]> {
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
            const ps = await profileStore.read();
            return ps.find((p) => p.overlayTarget)?.id ?? null;
        },
        async setOverlayTarget(profileId: string | null, iconKey?: string): Promise<Profile[]> {
            return profileStore.update((ps) =>
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
        },
        async getOverlaySupportTargetId(): Promise<string | null> {
            const ps = await profileStore.read();
            return ps.find((p) => p.overlaySupportTarget)?.id ?? null;
        },
        async setOverlaySupportTarget(profileId: string | null, iconKey?: string): Promise<Profile[]> {
            return profileStore.update((ps) =>
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

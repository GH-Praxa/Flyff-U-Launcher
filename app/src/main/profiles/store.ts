import { app } from "electron";
import path from "path";
import fs from "fs/promises";
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
export type Profile = {
    id: string;
    name: string;
    createdAt: string;
    job?: string;
    launchMode: LaunchMode;
    overlayTarget?: boolean;
    overlayIconKey?: string;
    overlaySettings?: OverlaySettings;
    overlayHud?: OverlayHudLayout;
};
function id() {
    return Math.random().toString(36).slice(2, 10);
}
function profilesPath() {
    return path.join(app.getPath("userData"), "profiles.json");
}
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
function normalizeOverlaySettings(v: any): OverlaySettings {
    const d = defaultOverlaySettings();
    if (!v || typeof v !== "object")
        return d;
    const b = (x: any, fallback: boolean) => (typeof x === "boolean" ? x : fallback);
    return {
        showExp: b(v.showExp, d.showExp!),
        showDeltaExp: b(v.showDeltaExp, d.showDeltaExp!),
        showTotalExp: b(v.showTotalExp, d.showTotalExp!),
        showKillsSession: b(v.showKillsSession, d.showKillsSession!),
        showKillsLifetime: b(v.showKillsLifetime, d.showKillsLifetime!),
        showKillsPerMinute: b(v.showKillsPerMinute, d.showKillsPerMinute!),
        showKillsPerHour: b(v.showKillsPerHour, d.showKillsPerHour!),
        showSessionTime: b(v.showSessionTime, d.showSessionTime!),
        showLastKill: b(v.showLastKill, d.showLastKill!),
        showAvgExpPerKill: b(v.showAvgExpPerKill, d.showAvgExpPerKill!),
        showExpPerMinute: b(v.showExpPerMinute, d.showExpPerMinute!),
        showResetButton: b(v.showResetButton, d.showResetButton!),
    };
}
function defaultHudLayout(): OverlayHudLayout {
    return { offsetX: 12, offsetY: 12, width: 380, height: 320 };
}
function normalizeHudLayout(v: any): OverlayHudLayout {
    const d = defaultHudLayout();
    if (!v || typeof v !== "object")
        return d;
    const n = (x: any, fallback: number) => (Number.isFinite(Number(x)) ? Number(x) : fallback);
    const width = Math.max(260, n(v.width, d.width));
    const height = Math.max(180, n(v.height, d.height));
    return {
        offsetX: n(v.offsetX, d.offsetX),
        offsetY: n(v.offsetY, d.offsetY),
        width,
        height,
    };
}
async function readProfiles(): Promise<Profile[]> {
    try {
        const raw = await fs.readFile(profilesPath(), "utf-8");
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [];
        return arr.map((p: any) => ({
            id: String(p?.id ?? id()),
            name: String(p?.name ?? "Profil"),
            createdAt: String(p?.createdAt ?? new Date().toISOString()),
            job: typeof p?.job === "string" ? p.job : undefined,
            launchMode: (p?.launchMode === "window" ? "window" : "tabs") as LaunchMode,
            overlayTarget: !!p?.overlayTarget,
            overlayIconKey: typeof p?.overlayIconKey === "string" ? p.overlayIconKey : "default",
            overlaySettings: normalizeOverlaySettings(p?.overlaySettings),
            overlayHud: normalizeHudLayout(p?.overlayHud),
        }));
    }
    catch {
        return [];
    }
}
async function writeProfiles(ps: Profile[]) {
    await fs.writeFile(profilesPath(), JSON.stringify(ps, null, 2), "utf-8");
}
export function createProfilesStore() {
    return {
        async list(): Promise<Profile[]> {
            return await readProfiles();
        },
        async create(name: string): Promise<Profile[]> {
            const ps = await readProfiles();
            const next: Profile[] = [
                ...ps,
                {
                    id: id(),
                    name: name.trim() || "Profil",
                    createdAt: new Date().toISOString(),
                    launchMode: "tabs",
                    overlayTarget: false,
                    overlayIconKey: "default",
                    overlaySettings: defaultOverlaySettings(),
                    overlayHud: defaultHudLayout(),
                },
            ];
            await writeProfiles(next);
            return next;
        },
        async update(patch: Partial<Profile> & {
            id: string;
        }): Promise<Profile[]> {
            const ps = await readProfiles();
            const next = ps.map((p) => {
                if (p.id !== patch.id)
                    return p;
                const mergedSettings = patch.overlaySettings !== undefined
                    ? normalizeOverlaySettings({ ...(p.overlaySettings ?? defaultOverlaySettings()), ...(patch.overlaySettings as any) })
                    : p.overlaySettings;
                const mergedHud = patch.overlayHud !== undefined
                    ? normalizeHudLayout({ ...(p.overlayHud ?? defaultHudLayout()), ...(patch.overlayHud as any) })
                    : p.overlayHud;
                return { ...p, ...patch, overlaySettings: mergedSettings, overlayHud: mergedHud };
            });
            await writeProfiles(next);
            return next;
        },
        async delete(profileId: string): Promise<Profile[]> {
            const ps = await readProfiles();
            const next = ps.filter((p) => p.id !== profileId);
            await writeProfiles(next);
            return next;
        },
        async clone(profileId: string, newName: string): Promise<Profile[]> {
            const ps = await readProfiles();
            const src = ps.find((p) => p.id === profileId);
            if (!src)
                return ps;
            const next: Profile[] = [
                ...ps,
                {
                    ...src,
                    id: id(),
                    name: newName.trim() || `${src.name} (Copy)`,
                    createdAt: new Date().toISOString(),
                    overlayTarget: false,
                    overlaySettings: normalizeOverlaySettings(src.overlaySettings),
                    overlayHud: normalizeHudLayout(src.overlayHud),
                },
            ];
            await writeProfiles(next);
            return next;
        },
        async reorder(orderedIds: string[]): Promise<Profile[]> {
            const ps = await readProfiles();
            const map = new Map(ps.map((p) => [p.id, p]));
            const ordered = orderedIds.map((pid) => map.get(pid)).filter(Boolean) as Profile[];
            const rest = ps.filter((p) => !orderedIds.includes(p.id));
            const next = [...ordered, ...rest];
            await writeProfiles(next);
            return next;
        },
        async getOverlayTargetId(): Promise<string | null> {
            const ps = await readProfiles();
            return ps.find((p) => p.overlayTarget)?.id ?? null;
        },
        async setOverlayTarget(profileId: string | null, iconKey?: string): Promise<Profile[]> {
            const ps = await readProfiles();
            const next = ps.map((p) => {
                if (!profileId)
                    return { ...p, overlayTarget: false };
                if (p.id !== profileId)
                    return { ...p, overlayTarget: false };
                return {
                    ...p,
                    overlayTarget: true,
                    overlayIconKey: iconKey ?? p.overlayIconKey ?? "default",
                };
            });
            await writeProfiles(next);
            return next;
        },
        async getOverlaySettings(profileId: string): Promise<OverlaySettings> {
            const ps = await readProfiles();
            const p = ps.find((x) => x.id === profileId);
            return normalizeOverlaySettings(p?.overlaySettings);
        },
        async patchOverlaySettings(profileId: string, patch: Partial<OverlaySettings>): Promise<OverlaySettings> {
            const ps = await readProfiles();
            const next = ps.map((p) => {
                if (p.id !== profileId)
                    return p;
                const merged = normalizeOverlaySettings({ ...(p.overlaySettings ?? defaultOverlaySettings()), ...(patch as any) });
                return { ...p, overlaySettings: merged };
            });
            await writeProfiles(next);
            const updated = next.find((p) => p.id === profileId);
            return normalizeOverlaySettings(updated?.overlaySettings);
        },
        async getOverlayHudLayout(profileId: string): Promise<OverlayHudLayout> {
            const ps = await readProfiles();
            const p = ps.find((x) => x.id === profileId);
            return normalizeHudLayout(p?.overlayHud);
        },
        async patchOverlayHudLayout(profileId: string, patch: Partial<OverlayHudLayout>): Promise<OverlayHudLayout> {
            const ps = await readProfiles();
            const next = ps.map((p) => {
                if (p.id !== profileId)
                    return p;
                const merged = normalizeHudLayout({ ...(p.overlayHud ?? defaultHudLayout()), ...(patch as any) });
                return { ...p, overlayHud: merged };
            });
            await writeProfiles(next);
            const updated = next.find((p) => p.id === profileId);
            return normalizeHudLayout(updated?.overlayHud);
        },
    };
}

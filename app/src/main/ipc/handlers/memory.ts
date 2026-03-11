/**
 * IPC handlers for memory/RAM usage information.
 * Reports per-BrowserView memory with profile names,
 * plus plugin and system process memory.
 */
import { app, BrowserWindow } from "electron";
import type { BrowserView } from "electron";
import fs from "fs";
import type { SafeHandle } from "../common";

export type MemoryRowCategory = "profile" | "plugin" | "system";

export interface MemoryRowInfo {
    profileName: string;
    memoryMB: number;
    category?: MemoryRowCategory;
    /** True when multiple rows share the same renderer process (e.g. sidepanel iframes). */
    shared?: boolean;
}

export interface MemoryDetails {
    totalMB: number;
    rows: MemoryRowInfo[];
}

export interface TabsSource {
    getLoadedProfileIds: () => string[];
    getViewByProfile: (profileId: string) => BrowserView | null;
}

export interface ExtraWindowInfo {
    label: string;
    window: BrowserWindow;
    category: MemoryRowCategory;
}

export interface ExtraRowInfo {
    label: string;
    memoryMB: number;
    category: MemoryRowCategory;
    shared?: boolean;
}

export interface MemoryHandlerDeps {
    /** Returns all profiles (async) */
    listProfiles: () => Promise<Array<{ id: string; name: string }>>;
    /** All tabs sources (legacy singleton + registry entries) */
    getTabsSources: () => TabsSource[];
    /** Returns labelled extra windows (plugins, sidepanel, overlays) */
    getExtraWindows?: () => ExtraWindowInfo[];
    /** Returns pre-built extra rows (plugin tabs, OCR, etc.) */
    getExtraRows?: () => ExtraRowInfo[];
}

/**
 * Read RSS from /proc/[pid]/statm on Linux (in MB).
 * Returns 0 if the file is unavailable or unreadable.
 */
function readRssFromProc(pid: number): number {
    try {
        const data = fs.readFileSync(`/proc/${pid}/statm`, "utf-8");
        const parts = data.trim().split(/\s+/);
        // statm columns: size resident shared text lib data dt (all in pages)
        const residentPages = parseInt(parts[1], 10);
        if (!Number.isFinite(residentPages)) return 0;
        const pageSizeBytes = 4096; // standard Linux page size
        return Math.round((residentPages * pageSizeBytes) / (1024 * 1024));
    } catch {
        return 0;
    }
}

/** Resolve memory in MB for a given PID, with Linux /proc fallback. */
function resolveMemoryMB(pid: number, pidToMemory: Map<number, number>): number {
    let memoryMB = pidToMemory.get(pid) ?? 0;
    if (memoryMB <= 0 && process.platform === "linux") {
        memoryMB = readRssFromProc(pid);
    }
    return memoryMB;
}

async function collectViewMemory(deps: MemoryHandlerDeps): Promise<MemoryDetails> {
    // Build a PID→memory map from app metrics (workingSetSize is in KB).
    const metrics = app.getAppMetrics();
    const pidToMemory = new Map<number, number>();
    for (const m of metrics) {
        pidToMemory.set(m.pid, Math.round(m.memory.workingSetSize / 1024));
    }

    const profiles = await deps.listProfiles();
    const nameById = new Map(profiles.map((p) => [p.id, p.name]));

    const rows: MemoryRowInfo[] = [];
    let totalMB = 0;
    const seenProfiles = new Set<string>();
    const seenPids = new Set<number>();

    // 1. Profile BrowserViews
    for (const source of deps.getTabsSources()) {
        for (const profileId of source.getLoadedProfileIds()) {
            if (seenProfiles.has(profileId)) continue;
            seenProfiles.add(profileId);

            const view = source.getViewByProfile(profileId);
            if (!view || view.webContents.isDestroyed()) continue;

            const pid = view.webContents.getOSProcessId();
            seenPids.add(pid);
            const memoryMB = resolveMemoryMB(pid, pidToMemory);

            const profileName = nameById.get(profileId) ?? profileId;
            rows.push({ profileName, memoryMB, category: "profile" });
            totalMB += memoryMB;
        }
    }

    // 2. Extra windows (plugin settings, overlays, etc.)
    if (deps.getExtraWindows) {
        for (const extra of deps.getExtraWindows()) {
            if (extra.window.isDestroyed()) continue;
            const pid = extra.window.webContents.getOSProcessId();
            if (seenPids.has(pid)) continue;
            seenPids.add(pid);

            const memoryMB = resolveMemoryMB(pid, pidToMemory);
            rows.push({ profileName: extra.label, memoryMB, category: extra.category });
            totalMB += memoryMB;
        }
    }

    // 3. Pre-built extra rows (sidepanel plugin tabs, OCR, etc.)
    //    These are NOT deduplicated by PID because they may represent
    //    sub-items inside a shared process (e.g. iframes in the sidepanel).
    //    Their memory is NOT added to totalMB to avoid double-counting.
    if (deps.getExtraRows) {
        for (const extra of deps.getExtraRows()) {
            rows.push({
                profileName: extra.label,
                memoryMB: extra.memoryMB,
                category: extra.category,
                shared: extra.shared,
            });
            // Only add to total if not shared (shared rows are sub-breakdowns
            // of a window that's already counted above or doesn't have its own PID).
            if (!extra.shared) {
                totalMB += extra.memoryMB;
            }
        }
    }

    // Sort within each category: profiles first, then plugins, then system
    const categoryOrder: Record<MemoryRowCategory, number> = { profile: 0, plugin: 1, system: 2 };
    rows.sort((a, b) => {
        const ca = categoryOrder[a.category ?? "profile"];
        const cb = categoryOrder[b.category ?? "profile"];
        if (ca !== cb) return ca - cb;
        return b.memoryMB - a.memoryMB;
    });
    return { totalMB, rows };
}

export function registerMemoryHandlers(safeHandle: SafeHandle, deps: MemoryHandlerDeps): void {
    safeHandle("memory:system", async (): Promise<{ totalMB: number }> => {
        const { totalMB } = await collectViewMemory(deps);
        return { totalMB };
    });

    safeHandle("memory:details", async (): Promise<MemoryDetails> => {
        return collectViewMemory(deps);
    });
}

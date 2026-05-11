/**
 * IPC-Handler fuer das Auflisten aller via Plugins (api-fetch, cd-timer)
 * gecachten Spiel-Icons. Wird vom Controller-Tab im Settings-Modal benutzt,
 * um den User aus den bereits geladenen Icons waehlen zu lassen statt
 * Click-to-Capture machen zu muessen.
 *
 * Pfad-Konventionen identisch zu cd-timer's `listIcons` (DRY-Verstoss
 * akzeptiert, weil cd-timer ein Plugin im Sandbox-Process ist und seine
 * Helpers nicht direkt importierbar):
 *   - userData/user/cache/item/icons/    (Buff-/Item-Icons via api-fetch)
 *   - userData/user/cache/skill/icons/   (Skill-Icons via skill-fetcher)
 *   - userData/icons/{buffs,items,skills}/ (Legacy)
 *
 * Liefert pro Icon `{id, category, name, dataUrl}` — dataUrl ist die
 * file-base64 Repraesentation, direkt im <img src=...> usable.
 */
import { app, ipcMain } from "electron";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { logWarn } from "../../../shared/logger";
import type { SafeHandle, IpcEvent } from "../common";

export interface GameIcon {
    id: string;
    category: "skills" | "items" | "buffs" | "other";
    name: string;
    /** Relative Pfad fuer Cache-Key. */
    path: string;
    /** Inline data:image/...;base64,... — direkt in `<img src>` einsetzbar. */
    dataUrl: string;
}

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];

function mimeForExt(ext: string): string {
    switch (ext.toLowerCase()) {
        case ".png": return "image/png";
        case ".jpg":
        case ".jpeg": return "image/jpeg";
        case ".webp": return "image/webp";
        case ".bmp": return "image/bmp";
        default: return "application/octet-stream";
    }
}

async function fileToDataUrl(absPath: string): Promise<string | null> {
    try {
        const buf = await fs.readFile(absPath);
        const ext = path.extname(absPath);
        return `data:${mimeForExt(ext)};base64,${buf.toString("base64")}`;
    } catch {
        return null;
    }
}

/**
 * Liest die buff-icon-Liste aus dem api-fetch Plugin-Cache (item-Icons mit
 * Buff-Namen). Format ist eine JSON-Array von `{buffname, iconname}`.
 */
async function loadBuffIconList(): Promise<Array<{ name: string; iconname: string }>> {
    const userData = app.getPath("userData");
    // api-fetch legt diese Datei typischerweise hier ab.
    const candidates = [
        path.join(userData, "user", "cache", "buff_icon_list.json"),
        path.join(userData, "user", "cache", "item", "buff_icon_list.json"),
    ];
    for (const candidate of candidates) {
        try {
            const raw = await fs.readFile(candidate, "utf8");
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed
                    .map((item: { buffname?: string; iconname?: string }) => ({
                        name: item?.buffname ?? "",
                        iconname: item?.iconname ?? "",
                    }))
                    .filter((x) => x.name && x.iconname);
            }
        } catch {
            // try next candidate
        }
    }
    return [];
}

async function listItemIcons(): Promise<GameIcon[]> {
    const userData = app.getPath("userData");
    const buffs = await loadBuffIconList();
    const seen = new Set<string>();
    const icons: GameIcon[] = [];
    // Pfad: user/cache/item/icons/<file>
    for (const item of buffs) {
        const relPath = path.join("user", "cache", "item", "icons", item.iconname).replace(/\\/g, "/");
        const absPath = path.join(userData, relPath);
        if (!fsSync.existsSync(absPath)) continue;
        if (seen.has(relPath)) continue;
        seen.add(relPath);
        const dataUrl = await fileToDataUrl(absPath);
        if (!dataUrl) continue;
        icons.push({
            id: `item:${relPath}`,
            category: "items",
            name: item.name,
            path: relPath,
            dataUrl,
        });
    }
    return icons;
}

async function listSkillIcons(): Promise<GameIcon[]> {
    const userData = app.getPath("userData");
    const root = path.join(userData, "user", "cache", "skill");
    const mappingPath = path.join(root, "skill_icon_skillname.json");
    let entries: Array<{ skillname?: string; name?: string; iconname?: string; icon?: string }> = [];
    try {
        const raw = await fs.readFile(mappingPath, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) entries = parsed;
    } catch {
        return [];
    }
    const icons: GameIcon[] = [];
    for (const entry of entries) {
        const iconFile = entry?.iconname || entry?.icon || null;
        const name = entry?.skillname || entry?.name || iconFile || "";
        if (!iconFile || !name) continue;
        // Skill-Icons koennen unter colored/ oder old/ liegen — wir nehmen
        // die erste Variante, die existiert.
        const relCandidates = [
            path.join("user", "cache", "skill", "icons", "colored", iconFile).replace(/\\/g, "/"),
            path.join("user", "cache", "skill", "icons", "old", iconFile).replace(/\\/g, "/"),
        ];
        let absPath: string | null = null;
        let relPath = relCandidates[0];
        for (const candidate of relCandidates) {
            const abs = path.join(userData, candidate);
            if (fsSync.existsSync(abs)) {
                absPath = abs;
                relPath = candidate;
                break;
            }
        }
        if (!absPath) continue;
        const dataUrl = await fileToDataUrl(absPath);
        if (!dataUrl) continue;
        icons.push({
            id: `skill:${relPath}`,
            category: "skills",
            name,
            path: relPath,
            dataUrl,
        });
    }
    return icons;
}

async function listLegacyIcons(): Promise<GameIcon[]> {
    const root = path.join(app.getPath("userData"), "icons");
    const categories: Array<GameIcon["category"]> = ["buffs", "items", "skills"];
    const icons: GameIcon[] = [];
    for (const category of categories) {
        const dir = path.join(root, category);
        let entries: import("fs").Dirent[] = [];
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.isFile()) continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (!IMAGE_EXTS.includes(ext)) continue;
            const relPath = path.join(category, entry.name).replace(/\\/g, "/");
            const absPath = path.join(dir, entry.name);
            const dataUrl = await fileToDataUrl(absPath);
            if (!dataUrl) continue;
            icons.push({
                id: `legacy:${relPath}`,
                category,
                name: entry.name.replace(ext, ""),
                path: relPath,
                dataUrl,
            });
        }
    }
    return icons;
}

/** Aggregiert + sortiert + dedupliziert. Rueckgabe: alle gefundenen Icons. */
export async function listGameIcons(): Promise<GameIcon[]> {
    const [items, skills, legacy] = await Promise.all([
        listItemIcons(),
        listSkillIcons(),
        listLegacyIcons(),
    ]);
    const all = [...items, ...skills, ...legacy];
    // Dedupliziere by id (gleicher Pfad, unterschiedliche Quelle theoretisch).
    const seen = new Set<string>();
    const deduped: GameIcon[] = [];
    for (const icon of all) {
        if (seen.has(icon.id)) continue;
        seen.add(icon.id);
        deduped.push(icon);
    }
    deduped.sort((a, b) => a.name.localeCompare(b.name));
    return deduped;
}

export function registerGameIconsHandlers(safeHandle: SafeHandle): () => void {
    safeHandle("gameIcons:list", async (_e: IpcEvent) => {
        try {
            const icons = await listGameIcons();
            return { ok: true as const, icons };
        } catch (err) {
            logWarn("gameIcons", `list failed: ${(err as Error).message}`);
            return { ok: false as const, error: (err as Error).message };
        }
    });
    return () => {
        ipcMain.removeHandler("gameIcons:list");
    };
}

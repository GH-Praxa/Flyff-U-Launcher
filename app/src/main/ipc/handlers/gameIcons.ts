/**
 * IPC-Handler fuer das Auflisten aller via api-fetch / cd-timer gecachten
 * Spiel-Icons. Wird vom Controller-Tab im Settings-Modal benutzt, um den User
 * aus den bereits geladenen Icons waehlen zu lassen statt Click-to-Capture
 * machen zu muessen.
 *
 * Cache-Layout (api-fetch v2+):
 *   userData/user/cache/item/icons/         — Item-Icon-Files
 *   userData/user/cache/item/item_parameter/<id>.json — Item-Metadaten pro ID
 *   userData/user/cache/skill/icons/colored|old/  — Skill-Icon-Files
 *   userData/user/cache/skill/skill_parameter/<id>.json — Skill-Metadaten pro ID
 *
 * Die monolithischen `*_parameter.json`-Dateien sind im neuen Layout oft
 * abgeschnitten/unvollstaendig (api-fetch streamt jetzt einzelne Files), wir
 * lesen direkt aus dem per-ID-Verzeichnis.
 *
 * Performance: bei ~18k Items + ~1.3k Skills wuerde ein Komplett-Dump als
 * data:image-URI base64 mehrere hundert MB IPC-Payload erzeugen. Stattdessen
 * liefern wir `file://`-URLs — der Renderer rendert die direkt im `<img>`
 * (CSP `img-src 'self' data: https: blob: file:` erlaubt das). Lazy-Loading
 * via Browser-Image-Loader.
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
    /** `file:///absolute/path/to/icon.png` — direkt im `<img src>` einsetzbar. */
    url: string;
}

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];

function normalizeName(n: unknown): string {
    if (!n) return "";
    if (typeof n === "string") return n;
    if (typeof n === "object") {
        const o = n as Record<string, unknown>;
        if (typeof o.en === "string" && o.en) return o.en;
        for (const v of Object.values(o)) {
            if (typeof v === "string" && v) return v;
        }
    }
    return String(n);
}

function fileUrl(absPath: string): string {
    // Auf Windows: backslashes → slashes, plus drive-letter-handling.
    const normalized = absPath.replace(/\\/g, "/");
    return normalized.startsWith("/") ? `file://${normalized}` : `file:///${normalized}`;
}

/**
 * Liest ALLE per-ID-JSONs aus einem Verzeichnis und liefert Items mit
 * gefundenem `icon`-Feld. Robuste Fehlertoleranz: einzelne kaputte JSONs
 * werden geskippt, nicht der ganze Loop abgebrochen.
 */
async function loadParametersDir(dir: string): Promise<Array<Record<string, unknown>>> {
    let entries: import("fs").Dirent[] = [];
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: Array<Record<string, unknown>> = [];
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        try {
            const raw = await fs.readFile(path.join(dir, entry.name), "utf8");
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") out.push(parsed as Record<string, unknown>);
        } catch {
            // skip corrupt file
        }
    }
    return out;
}

async function listItemIcons(): Promise<GameIcon[]> {
    const userData = app.getPath("userData");
    const dir = path.join(userData, "user", "cache", "item", "item_parameter");
    const items = await loadParametersDir(dir);
    const seen = new Set<string>();
    const icons: GameIcon[] = [];
    for (const item of items) {
        const iconFile = typeof item.icon === "string" ? item.icon : null;
        if (!iconFile) continue;
        const name = normalizeName(item.name);
        if (!name) continue;
        const relPath = path.join("user", "cache", "item", "icons", iconFile).replace(/\\/g, "/");
        if (seen.has(relPath)) continue;
        const absPath = path.join(userData, relPath);
        if (!fsSync.existsSync(absPath)) continue;
        seen.add(relPath);
        const cat: GameIcon["category"] = item.category === "buff" ? "buffs" : "items";
        icons.push({
            id: `item:${relPath}`,
            category: cat,
            name,
            path: relPath,
            url: fileUrl(absPath),
        });
    }
    return icons;
}

async function listSkillIcons(): Promise<GameIcon[]> {
    const userData = app.getPath("userData");
    const dir = path.join(userData, "user", "cache", "skill", "skill_parameter");
    const skills = await loadParametersDir(dir);
    const seen = new Set<string>();
    const icons: GameIcon[] = [];
    for (const skill of skills) {
        const iconFile = typeof skill.icon === "string" ? skill.icon : null;
        if (!iconFile) continue;
        const name = normalizeName(skill.name);
        if (!name) continue;
        // Skill-Icons koennen unter colored/ oder old/ liegen — erste existierende.
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
        if (seen.has(relPath)) continue;
        seen.add(relPath);
        icons.push({
            id: `skill:${relPath}`,
            category: "skills",
            name,
            path: relPath,
            url: fileUrl(absPath),
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
            icons.push({
                id: `legacy:${relPath}`,
                category,
                name: entry.name.replace(ext, ""),
                path: relPath,
                url: fileUrl(absPath),
            });
        }
    }
    return icons;
}

export async function listGameIcons(): Promise<GameIcon[]> {
    const [items, skills, legacy] = await Promise.all([
        listItemIcons(),
        listSkillIcons(),
        listLegacyIcons(),
    ]);
    const all = [...items, ...skills, ...legacy];
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

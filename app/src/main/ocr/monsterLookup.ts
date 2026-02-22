/**
 * Monster Lookup – resolves monster identity from OCR signals.
 *
 * Priority order:
 *   1. HP (most reliable OCR signal) → narrow by element → narrow by level
 *   2. Level + element (fallback when HP is unavailable)
 */

import fsp from "fs/promises";
import { getDataPath, DATA_FILES } from "../../data/index";
import { logErr, logWarn } from "../../shared/logger";

interface MonsterEntry {
    id: number;
    name: string;
    level: number;
    element: string;
    rank: string;
    hp: number | null;
}

const RANK_PRIORITY: string[] = [
    "normal", "captain", "boss", "giant", "super", "violet", "small", "material", "worldboss",
];

function rankOrder(rank: string): number {
    const idx = RANK_PRIORITY.indexOf(rank);
    return idx >= 0 ? idx : RANK_PRIORITY.length;
}

export function createMonsterLookup() {
    /** level-element index */
    let lvlElIndex: Map<string, MonsterEntry[]> | null = null;
    /** hp index: hp → MonsterEntry[] */
    let hpIndex: Map<number, MonsterEntry[]> | null = null;
    let loadPromise: Promise<void> | null = null;

    function makeLvlElKey(level: number, element: string): string {
        return `${level}-${element}`;
    }

    async function ensureLoaded(): Promise<void> {
        if (lvlElIndex) return;
        if (loadPromise) return loadPromise;
        loadPromise = (async () => {
            try {
                const filePath = getDataPath(DATA_FILES.MONSTER_REFERENCE);
                const raw = await fsp.readFile(filePath, "utf-8");
                const data: MonsterEntry[] = JSON.parse(raw);

                lvlElIndex = new Map();
                hpIndex = new Map();

                for (const entry of data) {
                    // level-element index
                    const lvlKey = makeLvlElKey(entry.level, entry.element);
                    const lvlList = lvlElIndex.get(lvlKey);
                    if (lvlList) lvlList.push(entry);
                    else lvlElIndex.set(lvlKey, [entry]);

                    // hp index
                    if (entry.hp !== null && entry.hp > 0) {
                        const hpList = hpIndex.get(entry.hp);
                        if (hpList) hpList.push(entry);
                        else hpIndex.set(entry.hp, [entry]);
                    }
                }

                // Sort each bucket by rank priority
                for (const [, list] of lvlElIndex) {
                    list.sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank));
                }
                for (const [, list] of hpIndex) {
                    list.sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank));
                }

                logWarn(`MonsterLookup: ${data.length} Monster, ${lvlElIndex.size} LvEl-Buckets, ${hpIndex.size} HP-Buckets`, "OCR");
            } catch (err) {
                logErr(err, "MonsterLookup load");
                lvlElIndex = new Map();
                hpIndex = new Map();
            }
        })();
        return loadPromise;
    }

    function filterRelevant(entries: MonsterEntry[]): MonsterEntry[] {
        const relevant = entries.filter((m) =>
            !m.name.startsWith("[Event]")
            && !m.name.startsWith("Goldenes ")
            && !m.name.startsWith("Silber ")
        );
        return relevant.length > 0 ? relevant : entries;
    }

    function uniqueNames(entries: MonsterEntry[]): string {
        return [...new Set(entries.map((m) => m.name))].join(", ");
    }

    /**
     * HP-first lookup: find all monsters with matching HP, then narrow down.
     * Uses 3% tolerance for exact HP match to handle minor OCR digit errors.
     */
    function lookupByHp(maxHp: number, element: string | null, level: number | null): string | null {
        if (!hpIndex) return null;

        // Exact HP match first
        let candidates = hpIndex.get(maxHp);

        // If no exact match, search within 3% tolerance
        if (!candidates) {
            const tolerance = Math.max(1, Math.round(maxHp * 0.03));
            for (let hp = maxHp - tolerance; hp <= maxHp + tolerance; hp++) {
                const bucket = hpIndex.get(hp);
                if (bucket) {
                    candidates = bucket;
                    break;
                }
            }
        }

        if (!candidates || candidates.length === 0) return null;

        let entries = filterRelevant(candidates);

        // Single match → done
        if (new Set(entries.map((m) => m.name)).size === 1) return entries[0]!.name;

        // Narrow by element
        if (element && element !== "none") {
            const elFiltered = entries.filter((m) => m.element === element);
            if (elFiltered.length > 0) entries = elFiltered;
            if (new Set(entries.map((m) => m.name)).size === 1) return entries[0]!.name;
        }

        // Narrow by level
        if (level !== null && level >= 1) {
            const lvlFiltered = entries.filter((m) => m.level === level);
            if (lvlFiltered.length > 0) entries = lvlFiltered;
            if (new Set(entries.map((m) => m.name)).size === 1) return entries[0]!.name;
        }

        // Still multiple → return best match (sorted by rank priority)
        return entries[0]!.name;
    }

    /**
     * Level+element fallback (used when HP is not available).
     */
    function lookupByLevelElement(level: number, element: string | null): string | null {
        if (!lvlElIndex) return null;

        if (element && element !== "none") {
            const bucket = lvlElIndex.get(makeLvlElKey(level, element));
            if (bucket && bucket.length > 0) {
                const entries = filterRelevant(bucket);
                return entries[0]!.name;
            }
        }

        // element=none: check if there's a unique match by level alone
        if (!element || element === "none") {
            const candidates: MonsterEntry[] = [];
            for (const el of ["fire", "water", "wind", "earth", "electricity", "none"]) {
                const bucket = lvlElIndex.get(makeLvlElKey(level, el));
                if (bucket) candidates.push(...bucket);
            }
            const entries = filterRelevant(candidates);
            const unique = [...new Set(entries.map((m) => m.name))];
            if (unique.length === 1) return unique[0]!;
        }

        return null;
    }

    async function lookupMonster(level: number | null, element: string | null, maxHp?: number | null): Promise<string | null> {
        await ensureLoaded();

        // HP-first strategy: most reliable OCR signal
        if (maxHp && maxHp > 0) {
            const result = lookupByHp(maxHp, element, level);
            if (result) return result;
        }

        // Fallback: level + element
        if (level !== null && level >= 1) {
            return lookupByLevelElement(level, element);
        }

        return null;
    }

    return { lookupMonster, ensureLoaded };
}

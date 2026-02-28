import { app } from "electron";
import path from "path";
import fs from "fs/promises";

export type RoiVisibility = {
    lvl?: boolean;
    charname?: boolean;
    exp?: boolean;
    lauftext?: boolean;
    rmExp?: boolean;
    enemyName?: boolean;
    enemyHp?: boolean;
};

type RoiVisDb = Record<string, RoiVisibility>;

function visPath() {
    return path.join(app.getPath("userData"), "user", "profiles", "roi-visibility.json");
}

async function readDb(): Promise<RoiVisDb> {
    try {
        const raw = await fs.readFile(visPath(), "utf-8");
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return {};
        return parsed as RoiVisDb;
    } catch {
        return {};
    }
}

async function writeDb(db: RoiVisDb) {
    await fs.writeFile(visPath(), JSON.stringify(db, null, 2), "utf-8");
}

export function createRoiVisibilityStore() {
    // In-memory cache per profileId – eliminates disk reads on every 200 ms
    // overlay refresh cycle. Invalidated on write.
    const cache = new Map<string, RoiVisibility>();

    return {
        async get(profileId: string): Promise<RoiVisibility> {
            if (cache.has(profileId)) return cache.get(profileId)!;
            const db = await readDb();
            const result = db[profileId] ?? {};
            cache.set(profileId, result);
            return result;
        },
        async set(profileId: string, vis: RoiVisibility): Promise<RoiVisibility> {
            const db = await readDb();
            const current = db[profileId] ?? {};
            const next: RoiVisibility = { ...current, ...vis };
            db[profileId] = next;
            await writeDb(db);
            cache.set(profileId, next);
            return next;
        },
    };
}

export type RoiVisibilityStore = ReturnType<typeof createRoiVisibilityStore>;

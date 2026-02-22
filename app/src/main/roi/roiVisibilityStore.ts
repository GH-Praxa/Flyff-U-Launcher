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
    return {
        async get(profileId: string): Promise<RoiVisibility> {
            const db = await readDb();
            return db[profileId] ?? {};
        },
        async set(profileId: string, vis: RoiVisibility): Promise<RoiVisibility> {
            const db = await readDb();
            const current = db[profileId] ?? {};
            const next: RoiVisibility = { ...current, ...vis };
            db[profileId] = next;
            await writeDb(db);
            return next;
        },
    };
}

export type RoiVisibilityStore = ReturnType<typeof createRoiVisibilityStore>;

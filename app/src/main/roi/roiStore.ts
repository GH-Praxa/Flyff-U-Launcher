import { app } from "electron";
import path from "path";
import fs from "fs/promises";
export type RoiRatio = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type HudRois = {
    nameLevel: RoiRatio;
    expPercent: RoiRatio;
};
type RoiDb = Record<string, HudRois>;
function clamp01(n: number) {
    return Math.max(0, Math.min(1, n));
}
function normalizeRoi(r: RoiRatio): RoiRatio {
    const x = clamp01(r.x);
    const y = clamp01(r.y);
    const w = clamp01(r.w);
    const h = clamp01(r.h);
    return { x, y, w: Math.max(0.001, w), h: Math.max(0.001, h) };
}
function roisPath() {
    return path.join(app.getPath("userData"), "rois.json");
}
async function readDb(): Promise<RoiDb> {
    try {
        const raw = await fs.readFile(roisPath(), "utf-8");
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object")
            return {};
        return parsed as RoiDb;
    }
    catch {
        return {};
    }
}
async function writeDb(db: RoiDb) {
    await fs.writeFile(roisPath(), JSON.stringify(db, null, 2), "utf-8");
}
export function createRoiStore() {
    return {
        async get(profileId: string): Promise<HudRois | null> {
            const db = await readDb();
            return db[profileId] ?? null;
        },
        async set(profileId: string, rois: HudRois): Promise<void> {
            const db = await readDb();
            db[profileId] = {
                nameLevel: normalizeRoi(rois.nameLevel),
                expPercent: normalizeRoi(rois.expPercent),
            };
            await writeDb(db);
        },
        async remove(profileId: string): Promise<void> {
            const db = await readDb();
            delete db[profileId];
            await writeDb(db);
        },
        async listAll(): Promise<RoiDb> {
            return readDb();
        },
    };
}
export type RoiStore = ReturnType<typeof createRoiStore>;

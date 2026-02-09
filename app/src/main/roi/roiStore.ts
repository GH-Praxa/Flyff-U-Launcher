import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import { debugLog } from "../debugConfig";
export type RoiRatio = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type HudRois = {
    lvl?: RoiRatio;
    charname?: RoiRatio;
    exp?: RoiRatio;
    lauftext?: RoiRatio;
    rmExp?: RoiRatio;
    enemyName?: RoiRatio;
    enemyHp?: RoiRatio;
    // Legacy for migration
    nameLevel?: RoiRatio;
    expPercent?: RoiRatio;
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
    return path.join(app.getPath("userData"), "user", "profiles", "rois.json");
}
function migrateRois(rois: HudRois): HudRois {
    if (rois.lvl || rois.charname || rois.exp || rois.lauftext || rois.rmExp || rois.enemyName || rois.enemyHp) {
        const { nameLevel, expPercent, ...rest } = rois;
        return rest;
    }
    return {
        charname: rois.nameLevel,
        exp: rois.expPercent,
    };
}
function normalizeOptional(rois: HudRois): HudRois {
    const next: HudRois = {};
    if (rois.lvl)
        next.lvl = normalizeRoi(rois.lvl);
    if (rois.charname)
        next.charname = normalizeRoi(rois.charname);
    if (rois.exp)
        next.exp = normalizeRoi(rois.exp);
    if (rois.lauftext)
        next.lauftext = normalizeRoi(rois.lauftext);
    if (rois.rmExp)
        next.rmExp = normalizeRoi(rois.rmExp);
    if (rois.enemyName)
        next.enemyName = normalizeRoi(rois.enemyName);
    if (rois.enemyHp)
        next.enemyHp = normalizeRoi(rois.enemyHp);
    // Keep legacy values normalized for migration safety
    if (rois.nameLevel)
        next.nameLevel = normalizeRoi(rois.nameLevel);
    if (rois.expPercent)
        next.expPercent = normalizeRoi(rois.expPercent);
    return next;
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
            const raw = db[profileId];
            if (!raw)
                return null;
            const migrated = normalizeOptional(migrateRois(raw));
            const changed = JSON.stringify(migrated) !== JSON.stringify(raw);
            if (changed) {
                db[profileId] = migrated;
                await writeDb(db);
            }
            return migrated;
        },
        async set(profileId: string, rois: HudRois): Promise<void> {
            console.log("[ROI STORE] set called profileId:", profileId, "input rois keys:", Object.keys(rois));
            debugLog("ocr", "[ROI STORE] set called profileId:", profileId, "input rois:", JSON.stringify(rois));
            const db = await readDb();
            const migrated = normalizeOptional(migrateRois(rois));
            console.log("[ROI STORE] migrated keys:", Object.keys(migrated));
            debugLog("ocr", "[ROI STORE] migrated:", JSON.stringify(migrated));
            db[profileId] = migrated;
            console.log("[ROI STORE] writing to:", roisPath());
            await writeDb(db);
            console.log("[ROI STORE] writeDb completed, db keys for profile:", Object.keys(db[profileId] || {}));
            debugLog("ocr", "[ROI STORE] writeDb completed");
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

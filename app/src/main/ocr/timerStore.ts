import { app } from "electron";
import path from "path";
import { createFileStore } from "../../shared/fileStore";

export const OCR_TIMER_KEYS = ["lvl", "exp", "charname", "lauftext", "rmExp", "enemyName", "enemyHp"] as const;
export type OcrTimerKey = typeof OCR_TIMER_KEYS[number];

export type OcrTimerSettings = Record<OcrTimerKey, number>;
export type OcrTimerRow = {
    profileId: string;
} & OcrTimerSettings;

// Default polling intervals in milliseconds.
// These are intentionally conservative to avoid excessive GPU readbacks
// (capturePage forces a full GPU flush and causes micro-stutters when called
// too frequently). Users can lower them in the side panel settings.
const DEFAULT_TIMERS: OcrTimerSettings = {
    lvl: 5000,
    exp: 2000,
    charname: 5000,
    lauftext: 3000,
    rmExp: 2000,
    enemyName: 2000,
    enemyHp: 2000,
};

const MAX_TIMER_MS = 5000;
// 500 ms lower bound: values below this (e.g. legacy 200 ms defaults stored in
// user data) are automatically clamped up on the next read, preventing the
// too-frequent capturePage() calls that cause GPU stalls and game freezes.
const MIN_TIMER_MS = 500;

function sanitizeTimerValue(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return 0;
    }
    const clamped = Math.max(0, Math.round(n));
    if (clamped === 0) return 0;
    return Math.min(MAX_TIMER_MS, Math.max(MIN_TIMER_MS, clamped));
}

const timerStore = createFileStore<OcrTimerRow>({
    getPath: () => path.join(app.getPath("userData"), "user", "profiles", "ocr-timers.json"),
    normalize(raw) {
        if (!raw || typeof raw !== "object") {
            return null;
        }
        const obj = raw as Record<string, unknown>;
        const profileId = typeof obj.profileId === "string" && obj.profileId.trim()
            ? obj.profileId
            : null;
        if (!profileId) {
            return null;
        }
        return {
            profileId,
            lvl: sanitizeTimerValue(obj.lvl ?? DEFAULT_TIMERS.lvl),
            exp: sanitizeTimerValue(obj.exp ?? DEFAULT_TIMERS.exp),
            charname: sanitizeTimerValue(obj.charname ?? DEFAULT_TIMERS.charname),
            lauftext: sanitizeTimerValue(obj.lauftext ?? DEFAULT_TIMERS.lauftext),
            rmExp: sanitizeTimerValue(obj.rmExp ?? DEFAULT_TIMERS.rmExp),
            enemyName: sanitizeTimerValue(obj.enemyName ?? DEFAULT_TIMERS.enemyName),
            enemyHp: sanitizeTimerValue(obj.enemyHp ?? DEFAULT_TIMERS.enemyHp),
        };
    },
});

export async function loadAllOcrTimers(): Promise<OcrTimerRow[]> {
    return timerStore.read();
}

export async function loadOcrTimersForProfile(profileId: string): Promise<OcrTimerRow | null> {
    const rows = await timerStore.read();
    return rows.find((row) => row.profileId === profileId) ?? null;
}

export async function persistOcrTimerSettings(
    profileId: string,
    patch: Partial<OcrTimerSettings>
): Promise<OcrTimerRow | null> {
    const sanitizedPatch: Partial<OcrTimerSettings> = {};
    for (const key of OCR_TIMER_KEYS) {
        const value = patch[key];
        if (typeof value === "number") {
            sanitizedPatch[key] = sanitizeTimerValue(value);
        }
    }

    const nextRows = await timerStore.update((rows) => {
        const remaining = rows.filter((row) => row.profileId !== profileId);
        const existing = rows.find((row) => row.profileId === profileId);
        const base: OcrTimerRow = existing ?? { profileId, ...DEFAULT_TIMERS };
        const next: OcrTimerRow = {
            profileId,
            lvl: sanitizedPatch.lvl ?? base.lvl,
            exp: sanitizedPatch.exp ?? base.exp,
            charname: sanitizedPatch.charname ?? base.charname,
            lauftext: sanitizedPatch.lauftext ?? base.lauftext,
            rmExp: sanitizedPatch.rmExp ?? base.rmExp,
            enemyName: sanitizedPatch.enemyName ?? base.enemyName,
            enemyHp: sanitizedPatch.enemyHp ?? base.enemyHp,
        };
        const hasActiveTimer = Object.values(next).some((value) => (value as number) > 0);
        if (hasActiveTimer) {
            return [...remaining, next];
        }
        return remaining;
    });

    return nextRows.find((row) => row.profileId === profileId) ?? null;
}

export function getDefaultOcrTimers(): OcrTimerSettings {
    return { ...DEFAULT_TIMERS };
}

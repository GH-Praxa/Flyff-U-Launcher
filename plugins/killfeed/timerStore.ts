import { app } from "electron";
import path from "path";
import { createFileStore } from "../../shared/fileStore";

export const OCR_TIMER_KEYS = ["lvl", "exp", "charname", "lauftext", "rmExp"] as const;
export type OcrTimerKey = typeof OCR_TIMER_KEYS[number];

export type OcrTimerSettings = Record<OcrTimerKey, number>;
export type OcrTimerRow = {
    profileId: string;
} & OcrTimerSettings;

// Default polling intervals in milliseconds (non-zero to keep OCR running out of the box)
const DEFAULT_TIMERS: OcrTimerSettings = {
    lvl: 500,
    exp: 500,
    charname: 800,
    lauftext: 1000,
    rmExp: 600,
};

function sanitizeTimerValue(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return 0;
    }
    return Math.max(0, Math.round(n));
}

const timerStore = createFileStore<OcrTimerRow>({
    getPath: () => path.join(app.getPath("userData"), "ocr-timers.json"),
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
            lvl: sanitizeTimerValue(obj.lvl),
            exp: sanitizeTimerValue(obj.exp),
            charname: sanitizeTimerValue(obj.charname),
            lauftext: sanitizeTimerValue(obj.lauftext),
            rmExp: sanitizeTimerValue(obj.rmExp),
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
        };
        const hasActiveTimer = Object.values(next).some((value) => value > 0);
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

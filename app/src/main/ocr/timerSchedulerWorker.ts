/**
 * OCR Timer Scheduler Worker
 *
 * Runs in a dedicated worker thread. Manages per-profile, per-key
 * polling intervals and emits "tick" messages to the main thread.
 *
 * NOTE: This file must NOT import Electron modules — it runs outside
 * the main process context.
 */
import { parentPort } from "worker_threads";

if (!parentPort) {
    throw new Error("OCR timer scheduler requires parentPort");
}

const port = parentPort;

// Duplicated from timerStore.ts to avoid importing Electron in this worker.
const OCR_TIMER_KEYS = ["lvl", "exp", "charname", "lauftext", "rmExp", "enemyName", "enemyHp"] as const;
type OcrTimerKey = typeof OCR_TIMER_KEYS[number];
type OcrTimerSettings = Record<OcrTimerKey, number>;

type Entry = {
    profileId: string;
    key: OcrTimerKey;
    interval: number;
    handle: ReturnType<typeof setTimeout> | undefined;
    busyCount: number;
    pending: boolean;
    lastTick: number;
    lastAck: number;
};

const MAX_CONCURRENCY = 3;
const STALL_MULTIPLIER = 3;  // allow 3x interval before considering a tick stuck
const STALL_MIN_MS = 2000;   // minimum watchdog threshold
const WATCHDOG_MS = 1000;    // how often the watchdog scans
const MAX_OCR_INTERVAL = 30000; // reasonable max for OCR polling (30 seconds)

const entries = new Map<string, Entry>();

const safeSendError = (err: unknown): void => {
    try {
        port.postMessage({ type: "error", error: String((err as Error)?.message ?? err) });
    } catch { /* ignore */ }
};

process.on("uncaughtException", safeSendError);
process.on("unhandledRejection", safeSendError);

const makeId = (profileId: string, key: OcrTimerKey): string => `${profileId}::${key}`;

const clearEntry = (entry: Entry): void => {
    if (entry.handle !== undefined) clearTimeout(entry.handle);
    entry.handle = undefined;
    entry.busyCount = 0;
    entry.pending = false;
};

const scheduleNext = (entry: Entry): void => {
    if (entry.interval <= 0 || entry.busyCount > 0) return;
    if (entry.handle !== undefined) clearTimeout(entry.handle);
    entry.handle = setTimeout(() => triggerTick(entry), entry.interval);
};

const triggerTick = (entry: Entry): void => {
    if (entry.busyCount >= MAX_CONCURRENCY) {
        entry.pending = true;
        return;
    }
    entry.busyCount += 1;
    entry.lastTick = Date.now();
    port.postMessage({ type: "tick", profileId: entry.profileId, key: entry.key });
};

const touchEntry = (profileId: string, key: OcrTimerKey): Entry => {
    const id = makeId(profileId, key);
    let entry = entries.get(id);
    if (!entry) {
        entry = {
            profileId,
            key,
            interval: 0,
            handle: undefined,
            busyCount: 0,
            pending: false,
            lastTick: 0,
            lastAck: 0,
        };
        entries.set(id, entry);
    }
    return entry;
};

const sanitizeInterval = (val: unknown): number => {
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(Math.round(n), MAX_OCR_INTERVAL);
};

// Watchdog: reset stalled ticks
setInterval((): void => {
    const now = Date.now();
    for (const entry of entries.values()) {
        const threshold = Math.max(STALL_MIN_MS, entry.interval * STALL_MULTIPLIER);
        const sinceTick = entry.lastTick ? now - entry.lastTick : 0;
        if (entry.busyCount > 0 && sinceTick > threshold) {
            entry.busyCount = 0;
            entry.pending = false;
            scheduleNext(entry);
        }
    }
}, WATCHDOG_MS);

type IncomingMessage = {
    type: string;
    profileId?: string;
    key?: OcrTimerKey;
    timers?: OcrTimerSettings;
};

port.on("message", (msg: IncomingMessage) => {
    try {
        if (!msg || typeof msg.type !== "string") return;

        if (msg.type === "update") {
            const { profileId, timers } = msg;
            if (!profileId) return;
            for (const key of OCR_TIMER_KEYS) {
                const interval = sanitizeInterval(timers?.[key]);
                const entry = touchEntry(profileId, key);
                entry.interval = interval;
                if (interval <= 0) {
                    clearEntry(entry);
                    entries.delete(makeId(profileId, key));
                    continue;
                }
                if (!entry.busyCount && !entry.pending) {
                    scheduleNext(entry);
                }
            }
            return;
        }

        if (msg.type === "ack") {
            const { profileId, key } = msg;
            if (!profileId || !key) return;
            const entry = entries.get(makeId(profileId, key));
            if (!entry) return;
            entry.lastAck = Date.now();
            entry.busyCount = Math.max(0, entry.busyCount - 1);
            if (entry.pending) {
                entry.pending = false;
                triggerTick(entry);
                return;
            }
            scheduleNext(entry);
        }
    } catch (err) {
        safeSendError(err);
    }
});

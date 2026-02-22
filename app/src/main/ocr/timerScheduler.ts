import { Worker } from "worker_threads";
import { OcrTimerKey, OcrTimerSettings, OCR_TIMER_KEYS } from "./timerStore";

type SchedulerTick = {
    type: "tick";
    profileId: string;
    key: OcrTimerKey;
};

type SchedulerMessage =
    | {
          type: "update";
          profileId: string;
          timers: OcrTimerSettings;
      }
    | {
          type: "ack";
          profileId: string;
          key: OcrTimerKey;
      };

type TickHandler = (profileId: string, key: OcrTimerKey) => void;
type ErrorHandler = (err: Error) => void;

export class OcrTimerScheduler {
    private readonly worker: Worker;
    private stopping = false;

    constructor(private readonly onTick: TickHandler, private readonly onError?: ErrorHandler) {
        const script = this.createWorkerScript();
        this.worker = new Worker(script, { eval: true });
        this.worker.on("message", (msg: SchedulerTick | { type: string; error?: string }) => {
            if (msg && msg.type === "tick") {
                this.onTick(msg.profileId, msg.key);
            } else if (msg && msg.type === "error") {
                this.onError?.(new Error(msg.error || "OCR timer worker reported error"));
            }
        });
        this.worker.on("error", (err) => {
            // Suppress errors triggered by an intentional stop
            if (this.stopping) return;
            this.onError?.(err);
        });
        this.worker.on("exit", (code) => {
            // node: worker.terminate() resolves with code 1, so treat that as a clean shutdown when stopping
            const isIntentionalStop = this.stopping && (code === 1 || code === 0);
            if (!isIntentionalStop && code !== 0) {
                this.onError?.(new Error(`OCR timer worker exited with code ${code}`));
            }
        });
    }

    public update(profileId: string, timers: OcrTimerSettings): void {
        this.worker.postMessage({ type: "update", profileId, timers });
    }

    public ack(profileId: string, key: OcrTimerKey): void {
        this.worker.postMessage({ type: "ack", profileId, key });
    }

    public async stop(): Promise<void> {
        // Mark as stopping so exit/error events from terminate() aren't treated as crashes
        this.stopping = true;
        try {
            await this.worker.terminate();
        } catch (err) {
            if (err instanceof Error) {
                this.onError?.(err);
            }
        }
    }

    private createWorkerScript(): string {
        const keys = JSON.stringify(OCR_TIMER_KEYS);
        return `
            const { parentPort } = require("worker_threads");
            const timerKeys = ${keys};
            if (!parentPort) {
                throw new Error("OCR timer scheduler requires parentPort");
            }

            const safeSendError = (err) => {
                try {
                    parentPort.postMessage({ type: "error", error: String(err?.message || err) });
                } catch { /* ignore */ }
            };

            process.on("uncaughtException", (err) => {
                safeSendError(err);
            });
            process.on("unhandledRejection", (err) => {
                safeSendError(err);
            });

            const entries = new Map();

            const makeId = (profileId, key) => profileId + "::" + key;
            const MAX_CONCURRENCY = 3;
            const STALL_MULTIPLIER = 3; // allow 3x interval before considering a tick stuck
            const STALL_MIN_MS = 2000;  // minimum watchdog threshold
            const WATCHDOG_MS = 1000;   // how often the watchdog scans

            const clearEntry = (entry) => {
                if (!entry) return;
                if (entry.handle) {
                    clearTimeout(entry.handle);
                }
                entry.handle = undefined;
                entry.busy = false;
                entry.pending = false;
            };

            const scheduleNext = (entry) => {
                if (!entry || entry.interval <= 0 || entry.busy) {
                    return;
                }
                if (entry.handle) {
                    clearTimeout(entry.handle);
                }
                entry.handle = setTimeout(() => triggerTick(entry), entry.interval);
            };

            const triggerTick = (entry) => {
                if (!entry) return;
                if (entry.busyCount >= MAX_CONCURRENCY) {
                    entry.pending = true;
                    return;
                }
                entry.busyCount += 1;
                entry.lastTick = Date.now();
                parentPort.postMessage({ type: "tick", profileId: entry.profileId, key: entry.key });
            };

            const touchEntry = (profileId, key) => {
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

            // Maximum safe timeout value (32-bit signed int max)
            const MAX_TIMEOUT = 2147483647;
            // Reasonable max for OCR polling (30 seconds)
            const MAX_OCR_INTERVAL = 30000;

            const sanitizeInterval = (val) => {
                const n = Number(val);
                if (!Number.isFinite(n) || n <= 0) return 0;
                // Clamp to reasonable OCR interval max
                return Math.min(Math.round(n), MAX_OCR_INTERVAL);
            };

            const watchdog = () => {
                const now = Date.now();
                for (const entry of entries.values()) {
                    const threshold = Math.max(STALL_MIN_MS, (entry.interval || 0) * STALL_MULTIPLIER);
                    const sinceTick = entry.lastTick ? now - entry.lastTick : 0;
                    if (entry.busyCount > 0 && sinceTick > threshold) {
                        entry.busyCount = 0;
                        entry.pending = false;
                        scheduleNext(entry);
                    }
                }
            };
            setInterval(watchdog, WATCHDOG_MS);

            parentPort.on("message", (msg) => {
                try {
                    if (!msg || typeof msg.type !== "string") {
                        return;
                    }
                    if (msg.type === "update") {
                        const { profileId, timers } = msg;
                        if (!profileId) return;
                        timerKeys.forEach((key) => {
                            const interval = sanitizeInterval(timers?.[key]);
                            const entry = touchEntry(profileId, key);
                            entry.interval = interval;
                            if (interval <= 0) {
                                clearEntry(entry);
                                entries.delete(makeId(profileId, key));
                                return;
                            }
                            if (!entry.busy && !entry.pending) {
                                scheduleNext(entry);
                            }
                        });
                        return;
                    }
                    if (msg.type === "ack") {
                        const { profileId, key } = msg;
                        const id = makeId(profileId, key);
                        const entry = entries.get(id);
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
        `;
    }
}

import { Worker } from "worker_threads";
import path from "path";
import { OcrTimerKey, OcrTimerSettings } from "./timerStore";

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
        const workerPath = path.join(__dirname, "timerSchedulerWorker.js");
        this.worker = new Worker(workerPath);
        this.worker.on("message", (msg: SchedulerTick | { type: string; error?: string }) => {
            if (msg && msg.type === "tick") {
                this.onTick((msg as SchedulerTick).profileId, (msg as SchedulerTick).key);
            } else if (msg && msg.type === "error") {
                this.onError?.(new Error((msg as { error?: string }).error || "OCR timer worker reported error"));
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
        this.worker.postMessage({ type: "update", profileId, timers } satisfies SchedulerMessage);
    }

    public ack(profileId: string, key: OcrTimerKey): void {
        this.worker.postMessage({ type: "ack", profileId, key } satisfies SchedulerMessage);
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
}

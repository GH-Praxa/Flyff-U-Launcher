import { app } from "electron";
import path from "path";
import { NativeOcrWorker } from "./nativeWorker";
import { logErr } from "../../shared/logger";

type PoolEntry = {
    worker: NativeOcrWorker | null;
    refs: number;
    acquirePromise: Promise<NativeOcrWorker> | null;
    releasePromise: Promise<void> | null;
    debugDir?: string;
};

const pools = new Map<string, PoolEntry>();

export function defaultOcrDebugPath(): string {
    return path.join(app.getPath("userData"), "user", "logs", "ocr");
}

function getPool(key: string): PoolEntry {
    let entry = pools.get(key);
    if (!entry) {
        entry = {
            worker: null,
            refs: 0,
            acquirePromise: null,
            releasePromise: null,
        };
        pools.set(key, entry);
    }
    return entry;
}

export async function acquireSharedOcrWorker(
    _pythonExe?: string,
    _scriptPath?: string,
    poolKey = "default",
    debugDir?: string
): Promise<NativeOcrWorker> {
    const pool = getPool(poolKey);

    // Wait for any pending release to complete first
    if (pool.releasePromise) {
        await pool.releasePromise;
    }

    // If already acquiring, wait for that to complete
    if (pool.acquirePromise) {
        await pool.acquirePromise;
        pool.refs += 1;
        return pool.worker!;
    }

    if (!pool.worker) {
        const resolvedDebugDir = debugDir ?? pool.debugDir ?? defaultOcrDebugPath();
        pool.acquirePromise = (async () => {
            const worker = new NativeOcrWorker({
                debugDir: resolvedDebugDir,
            });
            await worker.start();
            pool.worker = worker;
            pool.debugDir = resolvedDebugDir;
            return worker;
        })();

        try {
            await pool.acquirePromise;
        } finally {
            pool.acquirePromise = null;
        }
    }
    pool.refs += 1;
    return pool.worker!;
}

export async function releaseSharedOcrWorker(poolKey = "default"): Promise<void> {
    const pool = pools.get(poolKey);
    if (!pool) return;

    // Prevent underflow
    if (pool.refs <= 0) {
        pool.refs = 0;
        return;
    }

    pool.refs -= 1;
    if (pool.refs > 0)
        return;

    // If already releasing, wait for that
    if (pool.releasePromise) {
        await pool.releasePromise;
        return;
    }

    if (pool.worker) {
        const workerToStop = pool.worker;
        pool.worker = null; // Clear reference immediately to prevent reuse

        pool.releasePromise = (async () => {
            try {
                await workerToStop.stop();
            }
            catch (err) {
                logErr(err, "OCR");
            }
        })();

        try {
            await pool.releasePromise;
        } finally {
            pool.releasePromise = null;
        }
    }
}

export async function releaseAllOcrWorkers(): Promise<void> {
    const keys = Array.from(pools.keys());
    for (const key of keys) {
        // Force release regardless of ref count
        const pool = pools.get(key);
        if (!pool?.worker) continue;
        try {
            await pool.worker.stop();
        } catch (err) {
            logErr(err, "OCR");
        } finally {
            pools.delete(key);
        }
    }
}

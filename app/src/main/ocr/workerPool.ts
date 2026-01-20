import { app } from "electron";
import fs from "fs";
import path from "path";
import { PythonOcrWorker } from "./pythonWorker";
import { logErr } from "../../shared/logger";

let sharedWorker: PythonOcrWorker | null = null;
let sharedRefs = 0;
let acquirePromise: Promise<PythonOcrWorker> | null = null;
let releasePromise: Promise<void> | null = null;

type PoolEntry = {
    worker: PythonOcrWorker | null;
    refs: number;
    acquirePromise: Promise<PythonOcrWorker> | null;
    releasePromise: Promise<void> | null;
    pythonExe?: string;
    scriptPath?: string;
    debugDir?: string;
};

const pools = new Map<string, PoolEntry>();

export function defaultOcrScriptPath(): string {
    const candidates = [
        path.join(process.resourcesPath, "ocr", "ocr_worker.py"),
        path.join(process.resourcesPath, "app.asar.unpacked", "ocr", "ocr_worker.py"),
        path.join(app.getAppPath(), "ocr", "ocr_worker.py"),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return candidates[candidates.length - 1];
}

export function defaultOcrDebugPath(): string {
    return path.join(app.getPath("userData"), "ocr-debug");
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
    pythonExe?: string,
    scriptPath?: string,
    poolKey = "default",
    debugDir?: string
): Promise<PythonOcrWorker> {
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
            const worker = new PythonOcrWorker({
                pythonExe: pythonExe ?? pool.pythonExe ?? "python",
                scriptPath: scriptPath ?? pool.scriptPath ?? defaultOcrScriptPath(),
                debugDir: resolvedDebugDir,
            });
            await worker.start();
            pool.worker = worker;
            pool.pythonExe = pythonExe ?? pool.pythonExe;
            pool.scriptPath = scriptPath ?? pool.scriptPath;
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

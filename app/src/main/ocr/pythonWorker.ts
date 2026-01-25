import { spawn, execFile, type ChildProcessWithoutNullStreams } from "child_process";
import * as path from "path";
import { LIMITS } from "../../shared/constants";
import { logWarn } from "../../shared/logger";
import { debugLog } from "../debugConfig";
import { env } from "process";

export type OcrKind = "digits" | "line" | "exp" | "lvl" | "charname" | "lauftext" | "enemyName" | "enemyHp";

/**
 * Validates the Python executable path to prevent command injection.
 * Only allows:
 * - Simple command names (python, python3, python3.11) without path separators
 * - Absolute paths to executables
 * Rejects paths with shell metacharacters or suspicious patterns.
 */
function validatePythonPath(pythonExe: string): void {
    if (!pythonExe || typeof pythonExe !== "string") {
        throw new Error("Invalid Python path: must be a non-empty string");
    }

    // Reject shell metacharacters and dangerous patterns
    const dangerousPatterns = /[;&|`$(){}[\]<>!#*?~\n\r]/;
    if (dangerousPatterns.test(pythonExe)) {
        throw new Error("Invalid Python path: contains forbidden characters");
    }

    const isAbsolutePath = path.isAbsolute(pythonExe);
    const isSimpleCommand = /^python[0-9.]*$/.test(pythonExe);

    if (!isAbsolutePath && !isSimpleCommand) {
        throw new Error(
            "Invalid Python path: must be an absolute path or a simple command name (python, python3, etc.)"
        );
    }
}

/**
 * Verifies that the Python executable is actually Python by checking --version output.
 */
async function verifyPythonExecutable(pythonExe: string): Promise<void> {
    return new Promise((resolve, reject) => {
        execFile(pythonExe, ["--version"], { timeout: LIMITS.PYTHON_VERIFY_TIMEOUT_MS }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Failed to verify Python executable: ${error.message}`));
                return;
            }
            const output = (stdout || stderr || "").toLowerCase();
            if (!output.includes("python")) {
                reject(new Error("Invalid Python executable: --version output does not contain 'python'"));
                return;
            }
            resolve();
        });
    });
}
export type OcrRequest = {
    id: number;
    png_b64: string;
    kind?: OcrKind;
};
export type OcrResponse = {
    id: number;
    ok: boolean;
    raw?: string;
    value?: string | null;
    unit?: string | null;
    error?: string;
};
export class PythonOcrWorker {
    private proc: ChildProcessWithoutNullStreams | null = null;
    private buf = "";
    private nextId = 0;
    private pending = new Map<number, {
        resolve: (r: OcrResponse) => void;
        reject: (e: Error) => void;
        t: NodeJS.Timeout;
    }>();
    /** Track when Python is processing (even after timeout) to avoid queue buildup */
    private pythonBusy = false;
    private lastRequestTime = 0;
    /** Minimum time between requests to allow Python to catch up */
    private static readonly MIN_REQUEST_INTERVAL_MS = 0;
    constructor(private opts: {
        pythonExe: string;
        scriptPath: string;
        timeoutMs?: number;
        debugDir?: string;
    }) { }
    async start(): Promise<void> {
        if (this.proc)
            return;

        // Validate Python path before spawning to prevent command injection
        validatePythonPath(this.opts.pythonExe);
        await verifyPythonExecutable(this.opts.pythonExe);

        const procEnv = { ...env };
        // Propagate optional bundled Tesseract path to the worker
        if (process.env.TESSERACT_EXE) {
            procEnv.TESSERACT_EXE = process.env.TESSERACT_EXE;
        }
        if (process.env.TESSDATA_PREFIX) {
            procEnv.TESSDATA_PREFIX = process.env.TESSDATA_PREFIX;
        }
        // Propagate debug flag
        if (process.env.FLYFF_OCR_DEBUG) {
            procEnv.FLYFF_OCR_DEBUG = process.env.FLYFF_OCR_DEBUG;
        }
        if (this.opts.debugDir) {
            procEnv.FLYFF_OCR_DEBUG_DIR = path.resolve(this.opts.debugDir);
        }

        this.proc = spawn(this.opts.pythonExe, [this.opts.scriptPath], {
            stdio: ["pipe", "pipe", "inherit"],
            windowsHide: true,
            env: procEnv,
        });
        debugLog("ocr", `[OCR Worker] Python process spawned pid=${this.proc.pid}`);
        this.proc.stdout.setEncoding("utf8");
        this.proc.stdout.on("data", (chunk) => {
            debugLog("ocr", `[OCR Worker] stdout received ${chunk.length} bytes: ${chunk.slice(0, 100)}...`);
            this.onStdout(chunk);
        });
        this.proc.on("exit", (code) => {
            debugLog("ocr", `[OCR Worker] Python process EXITED code=${code}`);
            for (const { reject, t } of this.pending.values()) {
                clearTimeout(t);
                reject(new Error(`Python OCR exited (code=${code ?? "?"})`));
            }
            this.pending.clear();
            this.proc = null;
        });
        this.proc.on("error", (err) => {
            debugLog("ocr", `[OCR Worker] Python process ERROR: ${err.message}`);
        });
    }
    async stop(): Promise<void> {
        if (!this.proc)
            return;
        this.proc.kill();
        this.proc = null;
    }
    /** Maximum pending requests before rejecting new ones */
    private static readonly MAX_PENDING = 2;

    async recognizePng(png: Buffer, opts?: {
        kind?: OcrKind;
    }): Promise<OcrResponse> {
        if (!this.proc)
            throw new Error("Python OCR worker not started");

        // Reject if too many requests already pending to prevent queue buildup
        if (this.pending.size >= PythonOcrWorker.MAX_PENDING) {
            debugLog("ocr", `[OCR Worker] REJECTED - worker busy (pending=${this.pending.size})`);
            return { id: -1, ok: false, error: "worker_busy" };
        }

        const now = Date.now();
        const id = ++this.nextId;
        const req: OcrRequest = {
            id,
            png_b64: png.toString("base64"),
            kind: opts?.kind ?? "digits",
        };
        const timeoutMs = this.opts.timeoutMs ?? LIMITS.OCR_TIMEOUT_MS;

        // Mark Python as busy and track request time
        this.pythonBusy = true;
        this.lastRequestTime = now;

        debugLog("ocr", `[OCR Worker] Sending request id=${id} kind=${req.kind} png_size=${png.length} pending=${this.pending.size}`);
        return await new Promise<OcrResponse>((resolve, reject) => {
            const t = setTimeout(() => {
                this.pending.delete(id);
                // NOTE: Don't clear pythonBusy here - Python is still processing!
                // pythonBusy will be cleared when we receive ANY response
                debugLog("ocr", `[OCR Worker] TIMEOUT id=${id} after ${timeoutMs}ms - pending=${this.pending.size}`);
                reject(new Error(`OCR timeout after ${timeoutMs}ms`));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, t });

            // Handle stdin write errors (e.g., process crashed, pipe closed)
            try {
                const writeResult = this.proc!.stdin.write(JSON.stringify(req) + "\n");
                debugLog("ocr", `[OCR Worker] stdin.write returned=${writeResult} id=${id}`);
                if (!writeResult) {
                    // Handle backpressure - wait for drain event
                    this.proc!.stdin.once("drain", () => {
                        debugLog("ocr", `[OCR Worker] stdin drained id=${id}`);
                    });
                }
            } catch (err) {
                clearTimeout(t);
                this.pending.delete(id);
                this.pythonBusy = false;
                reject(new Error(`Failed to write to Python OCR stdin: ${err instanceof Error ? err.message : String(err)}`));
            }
        });
    }
    public isRunning(): boolean {
        return !!this.proc;
    }
    private onStdout(chunk: string): void {
        this.buf += chunk;
        let idx = this.buf.indexOf("\n");
        while (idx >= 0) {
            const line = this.buf.slice(0, idx).trim();
            this.buf = this.buf.slice(idx + 1);
            if (line) {
                try {
                    const msg = JSON.parse(line) as OcrResponse;

                    // Python sent a response, so it's no longer busy
                    this.pythonBusy = false;

                    const p = this.pending.get(msg.id);
                    if (p) {
                        clearTimeout(p.t);
                        this.pending.delete(msg.id);
                        p.resolve(msg);
                    } else {
                        // Response for a request that already timed out - this is expected
                        debugLog("ocr", `[OCR Worker] Received late response id=${msg.id} (already timed out)`);
                    }
                }
                catch (err) {
                    // Ignore malformed lines but keep a trace for debugging.
                    logWarn(err, "python-worker");
                }
            }
            idx = this.buf.indexOf("\n");
        }
    }
}

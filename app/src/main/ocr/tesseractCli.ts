/**
 * Direct Tesseract CLI wrapper – replaces pytesseract.
 *
 * Calls tesseract.exe via execFile with stdin pipe (preferred)
 * or temp-file fallback.
 */

import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface TesseractCliOptions {
    tesseractExe: string;
    tessdata?: string;
    lang?: string;
}

export interface OcrRunOptions {
    psm?: number;   // page segmentation mode (default 7 = single line)
    oem?: number;   // OCR engine mode (default 3 = default)
    whitelist?: string;
    timeoutMs?: number;
}

export class TesseractCli {
    private exe: string;
    private tessdata: string | undefined;
    private lang: string;

    constructor(opts: TesseractCliOptions) {
        this.exe = opts.tesseractExe;
        this.tessdata = opts.tessdata;
        this.lang = opts.lang ?? "eng";
    }

    /** Run OCR on a PNG buffer. Returns recognized text. */
    async recognize(png: Buffer, opts: OcrRunOptions = {}): Promise<string> {
        const psm = opts.psm ?? 7;
        const oem = opts.oem ?? 3;
        const timeout = opts.timeoutMs ?? 5000;

        const args = this.buildArgs(psm, oem, opts.whitelist);

        // Try stdin-based approach first (no temp files)
        try {
            return await this.runWithStdin(png, args, timeout);
        } catch {
            // Fallback: use temp file
            return await this.runWithTempFile(png, args, timeout);
        }
    }

    /** Get tesseract version string. */
    async getVersion(): Promise<string> {
        return new Promise((resolve, reject) => {
            execFile(this.exe, ["--version"], { timeout: 5000 }, (err, stdout, stderr) => {
                if (err) return reject(err);
                resolve((stdout || stderr || "").trim().split("\n")[0] ?? "unknown");
            });
        });
    }

    private buildArgs(psm: number, oem: number, whitelist?: string): string[] {
        // tesseract INPUT OUTPUT [options]
        // Using "stdin" as input and "stdout" as output for pipe mode
        const args: string[] = [];

        if (this.tessdata) {
            args.push("--tessdata-dir", this.tessdata);
        }

        args.push("-l", this.lang);
        args.push("--oem", String(oem));
        args.push("--psm", String(psm));

        if (whitelist) {
            args.push("-c", `tessedit_char_whitelist=${whitelist}`);
        }

        return args;
    }

    private runWithStdin(png: Buffer, extraArgs: string[], timeout: number): Promise<string> {
        return new Promise((resolve, reject) => {
            const args = ["stdin", "stdout", ...extraArgs];
            const proc = execFile(this.exe, args, {
                timeout,
                maxBuffer: 1024 * 1024,
                encoding: "utf8",
                windowsHide: true,
            }, (err, stdout) => {
                if (err) return reject(err);
                resolve((stdout || "").trim());
            });

            if (proc.stdin) {
                proc.stdin.write(png);
                proc.stdin.end();
            } else {
                reject(new Error("Failed to access tesseract stdin"));
            }
        });
    }

    private async runWithTempFile(png: Buffer, extraArgs: string[], timeout: number): Promise<string> {
        const tmpDir = os.tmpdir();
        const stamp = `tess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const inFile = path.join(tmpDir, `${stamp}.png`);
        const outBase = path.join(tmpDir, `${stamp}_out`);
        const outFile = outBase + ".txt";

        try {
            fs.writeFileSync(inFile, png);

            await new Promise<void>((resolve, reject) => {
                const args = [inFile, outBase, ...extraArgs];
                execFile(this.exe, args, {
                    timeout,
                    windowsHide: true,
                }, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            if (fs.existsSync(outFile)) {
                return fs.readFileSync(outFile, "utf-8").trim();
            }
            return "";
        } finally {
            try { fs.unlinkSync(inFile); } catch { /* ignore */ }
            try { fs.unlinkSync(outFile); } catch { /* ignore */ }
        }
    }
}

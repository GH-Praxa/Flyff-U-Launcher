import { spawn, type ChildProcessWithoutNullStreams } from "child_process";

export type OcrKind = "digits" | "line";

export type OcrRequest = { id: number; png_b64: string; kind?: OcrKind };

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
  private pending = new Map<
    number,
    { resolve: (r: OcrResponse) => void; reject: (e: Error) => void; t: NodeJS.Timeout }
  >();

  constructor(private opts: { pythonExe: string; scriptPath: string; timeoutMs?: number }) {}

  async start(): Promise<void> {
    if (this.proc) return;

    this.proc = spawn(this.opts.pythonExe, [this.opts.scriptPath], {
      stdio: ["pipe", "pipe", "inherit"],
      windowsHide: true,
    });

    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk) => this.onStdout(chunk));

    this.proc.on("exit", (code) => {
      for (const { reject, t } of this.pending.values()) {
        clearTimeout(t);
        reject(new Error(`Python OCR exited (code=${code ?? "?"})`));
      }
      this.pending.clear();
      this.proc = null;
    });
  }

  async stop(): Promise<void> {
    if (!this.proc) return;
    this.proc.kill();
    this.proc = null;
  }

  async recognizePng(png: Buffer, opts?: { kind?: OcrKind }): Promise<OcrResponse> {
    if (!this.proc) throw new Error("Python OCR worker not started");

    const id = ++this.nextId;
    const req: OcrRequest = {
      id,
      png_b64: png.toString("base64"),
      kind: opts?.kind ?? "digits",
    };

    const timeoutMs = this.opts.timeoutMs ?? 1500;

    return await new Promise<OcrResponse>((resolve, reject) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`OCR timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, t });
      this.proc!.stdin.write(JSON.stringify(req) + "\n");
    });
  }

  private onStdout(chunk: string): void {
    this.buf += chunk;

    while (true) {
      const idx = this.buf.indexOf("\n");
      if (idx < 0) break;

      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);

      if (!line) continue;

      try {
        const msg = JSON.parse(line) as OcrResponse;
        const p = this.pending.get(msg.id);
        if (p) {
          clearTimeout(p.t);
          this.pending.delete(msg.id);
          p.resolve(msg);
        }
      } catch {
        // ignore malformed lines
      }
    }
  }
}

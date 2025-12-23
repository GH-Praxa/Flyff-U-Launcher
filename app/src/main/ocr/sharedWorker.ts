import { PythonOcrWorker } from "./pythonWorker";

let shared: PythonOcrWorker | null = null;
let refs = 0;
let sharedKey: string | null = null;

export function acquireOcrWorker(opts: {
  pythonExe: string;
  scriptPath: string;
  timeoutMs?: number;
}): PythonOcrWorker {
  const key = `${opts.pythonExe}::${opts.scriptPath}::${opts.timeoutMs ?? ""}`;

  if (!shared) {
    shared = new PythonOcrWorker(opts);
    shared.start();
    sharedKey = key;
  } else if (sharedKey && sharedKey !== key) {
    // We keep the first worker config; differing configs are ignored to avoid spawning multiple workers.
    // If you need multiple configs, make this a keyed pool.
  }

  refs++;
  return shared;
}

export function releaseOcrWorker(): void {
  refs = Math.max(0, refs - 1);
  if (refs === 0 && shared) {
    shared.stop();
    shared = null;
    sharedKey = null;
  }
}

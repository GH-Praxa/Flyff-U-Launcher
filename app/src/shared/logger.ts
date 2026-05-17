export type LogEntry = {
    ts: number;
    level: "error";
    module: string;
    message: string;
};

const MAX_LOG_ENTRIES = 500;
const logBuffer: LogEntry[] = [];
let logListener: ((entry: LogEntry) => void) | null = null;

/**
 * Persistente Log-Datei. Wird im Main-Process initialisiert (siehe
 * `initFileLogging` weiter unten); Renderer/Preload schreiben nicht selbst —
 * dort landet's nur in der DevTools-Console.
 *
 * Pfad: <userData>/launcher.log. Wird bei jedem Start NEU angelegt (truncate),
 * sonst waechst die Datei unkontrolliert.
 */
let fileWriter: ((line: string) => void) | null = null;

function timestamp(): string {
    const d = new Date();
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function pushEntry(entry: LogEntry): void {
    if (logBuffer.length >= MAX_LOG_ENTRIES) {
        logBuffer.shift();
    }
    logBuffer.push(entry);
    try {
        logListener?.(entry);
    } catch {
        // ignore listener errors
    }
}

function fmt(moduleName: string | undefined, msg: unknown): string {
    const s = typeof msg === "string" ? msg : msg instanceof Error ? msg.message : String(msg);
    return `${timestamp()} [${moduleName ?? "App"}] ${s}`;
}

export const logErr = (err: unknown, moduleName?: string) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${moduleName ?? "App"}]`, err);
    fileWriter?.(`${timestamp()} ERROR [${moduleName ?? "App"}] ${message}`);
    pushEntry({ ts: Date.now(), level: "error", module: moduleName ?? "App", message });
};

export const logWarn = (msg: unknown, moduleName?: string) => {
    console.warn(`[${moduleName ?? "App"}]`, msg);
    fileWriter?.(`WARN  ${fmt(moduleName, msg)}`);
};

export const logInfo = (msg: unknown, moduleName?: string) => {
    console.log(`[${moduleName ?? "App"}]`, msg);
    fileWriter?.(`INFO  ${fmt(moduleName, msg)}`);
};

/**
 * Aktiviert persistentes File-Logging. Nur im Main-Process aufrufen — der
 * Preload/Renderer-Process hat keinen sicheren Dateisystem-Zugriff dafuer.
 * Pfad wird zurueckgegeben fuer Logging-Zwecke (Diagnose: User schickt das
 * File).
 */
export function initFileLogging(filePath: string): string {
    // Dynamisch laden, damit der Renderer-Bundle diese Datei mitnehmen kann
    // ohne 'fs' zu importieren (das wuerde im Renderer-Build crashen).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    try {
        fs.writeFileSync(filePath, `=== Launcher start ${new Date().toISOString()} ===\n`);
    } catch {
        // ignore — Schreibrechte fehlen evtl.
    }
    fileWriter = (line: string) => {
        try { fs.appendFileSync(filePath, line + "\n"); } catch { /* ignore */ }
    };
    return filePath;
}

export function getLogEntries(): LogEntry[] {
    return [...logBuffer];
}

export function clearLogEntries(): void {
    logBuffer.length = 0;
}

export function setLogListener(listener: ((entry: LogEntry) => void) | null): void {
    logListener = listener;
}

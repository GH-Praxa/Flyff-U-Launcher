export type LogEntry = {
    ts: number;
    level: "error";
    module: string;
    message: string;
};

const MAX_LOG_ENTRIES = 500;
const logBuffer: LogEntry[] = [];
let logListener: ((entry: LogEntry) => void) | null = null;

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

export const logErr = (err: unknown, moduleName?: string) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${moduleName ?? "App"}]`, err);
    pushEntry({ ts: Date.now(), level: "error", module: moduleName ?? "App", message });
};

export const logWarn = (msg: unknown, moduleName?: string) => {
    console.warn(`[${moduleName ?? "App"}]`, msg);
};

export function getLogEntries(): LogEntry[] {
    return [...logBuffer];
}

export function clearLogEntries(): void {
    logBuffer.length = 0;
}

export function setLogListener(listener: ((entry: LogEntry) => void) | null): void {
    logListener = listener;
}

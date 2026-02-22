/**
 * IPC handlers for news fetching operations.
 */
import https from "https";
import { SafeHandle, IpcEvent, ValidationError, PermissionError } from "../common";
import { TIMINGS } from "../../../shared/constants";

export function registerNewsHandlers(
    safeHandle: SafeHandle,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _logErr: (msg: unknown) => void
): void {
    async function fetchWithFallback(url: string): Promise<string> {
        const headers = { "User-Agent": "FlyffU-Launcher" };
        try {
            if (typeof fetch === "function") {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), TIMINGS.FETCH_TIMEOUT_MS);
                const res = await fetch(url, { headers, signal: controller.signal });
                clearTimeout(timer);
                if (!res.ok) {
                    throw new Error(`status ${res.status}`);
                }
                return await res.text();
            }
        } catch (err) {
            console.warn("[news:fetch] fetch failed, fallback to https:", err);
        }
        return await new Promise<string>((resolve, reject) => {
            const req = https.get(url, { headers }, (res) => {
                if ((res.statusCode ?? 0) >= 400) {
                    reject(new Error(`status ${res.statusCode}`));
                    res.resume();
                    return;
                }
                const chunks: Buffer[] = [];
                res.on("data", (c) => chunks.push(c as Buffer));
                res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
            });
            req.on("error", reject);
            req.setTimeout(TIMINGS.FETCH_TIMEOUT_MS, () => req.destroy(new Error("timeout")));
        });
    }

    safeHandle("news:fetch", async (_e: IpcEvent, path?: string) => {
        let url = "https://universe.flyff.com/news";
        if (path) {
            try {
                const parsed = new URL(path, "https://universe.flyff.com");
                if (parsed.hostname !== "universe.flyff.com") {
                    throw new PermissionError("invalid news host");
                }
                if (!parsed.pathname.startsWith("/news")) {
                    throw new PermissionError("invalid news path");
                }
                url = parsed.toString();
            } catch (err) {
                if (err instanceof PermissionError) throw err;
                throw new ValidationError(err instanceof Error ? err.message : "invalid news url");
            }
        }
        return await fetchWithFallback(url);
    });

    safeHandle("news:fetchArticle", async (_e: IpcEvent, rawUrl: string) => {
        if (!rawUrl || typeof rawUrl !== "string") {
            throw new ValidationError("invalid url");
        }
        let target: URL;
        try {
            target = new URL(rawUrl, "https://universe.flyff.com");
        } catch {
            throw new ValidationError("invalid url");
        }
        if (target.hostname !== "universe.flyff.com") {
            throw new PermissionError("blocked host");
        }
        if (!target.pathname.startsWith("/news")) {
            throw new PermissionError("blocked path");
        }
        return await fetchWithFallback(target.toString());
    });
}

/**
 * Safe Window Capture
 *
 * Platform-safe screenshot capture that avoids GPU stalls and WebGL corruption.
 *
 * Problem: In Electron 40 / Chromium 130, webContents.capturePage() flushes the
 * GPU command buffer via WaitForGetOffsetInRange, which corrupts the game's
 * WebGL rendering context → permanent game freeze.
 *
 * Solution per platform:
 * - Windows/macOS: BrowserWindow.capturePage() reads from the OS compositor
 *   surface (DWM / WindowServer) — no GPU command-buffer flush.
 * - Linux: External screen-capture via maim/scrot — per-ROI, rate-limited.
 *
 *   CRITICAL: On X11 + compositing WM, ANY XGetImage call forces the
 *   compositor (KWin) to do a glReadPixels → GPU pipeline flush.  This stalls
 *   the game's WebGL rendering.  The stall is independent of capture size
 *   (even 1×1 pixel flushes the whole pipeline).
 *
 *   Strategy: STRICT RATE-LIMITING.
 *   - Max CAPTURE_RATE_LIMIT captures per second globally.
 *   - Each capture is per-ROI (tiny, ~32×38 pixels → fast XGetImage data transfer).
 *   - Between captures, return the LAST captured image for each ROI.
 *   - The OCR system's roiFrameCache sees identical pixel hashes → skips Tesseract.
 *   - Result: OCR stays fluid (cached values displayed), GPU stalls are minimised.
 */

import { type BrowserWindow, nativeImage, type NativeImage } from "electron";
import { execFile } from "child_process";
import { logWarn } from "../../shared/logger";

// ─── Types ───────────────────────────────────────────────────────────

type WmctrlEntry = { xid: number; pid: number; x: number; y: number; w: number; h: number; title: string };

// ─── Window screen-position cache ────────────────────────────────────

type WindowPosInfo = {
    screenX: number;
    screenY: number;
    wmctrlW: number;
    wmctrlH: number;
    resolvedAt: number;
};

const posCache = new Map<number, WindowPosInfo>();
const POS_REFRESH_MS = 2000;

// ─── Tool availability (cached) ──────────────────────────────────────

let maimChecked = false;
let maimAvailable = false;

function probeMaim(): Promise<boolean> {
    if (maimChecked) return Promise.resolve(maimAvailable);
    return new Promise((resolve) => {
        execFile("maim", ["--version"], { timeout: 3000 }, (err) => {
            maimChecked = true;
            maimAvailable = !(err && (err as NodeJS.ErrnoException).code === "ENOENT");
            resolve(maimAvailable);
        });
    });
}

let scrotChecked = false;
let scrotAvailable = false;

function probeScrot(): Promise<boolean> {
    if (scrotChecked) return Promise.resolve(scrotAvailable);
    return new Promise((resolve) => {
        execFile("scrot", ["--version"], { timeout: 3000 }, (err) => {
            scrotChecked = true;
            scrotAvailable = !(err && (err as NodeJS.ErrnoException).code === "ENOENT");
            resolve(scrotAvailable);
        });
    });
}

let xwdChecked = false;
let xwdAvailable = false;

export function probeXwd(): Promise<boolean> {
    if (xwdChecked) return Promise.resolve(xwdAvailable);
    return new Promise((resolve) => {
        execFile("xwd", ["-help"], { timeout: 3000 }, (err) => {
            xwdChecked = true;
            xwdAvailable = !(err && (err as NodeJS.ErrnoException).code === "ENOENT");
            resolve(xwdAvailable);
        });
    });
}

// ─── wmctrl ──────────────────────────────────────────────────────────

function wmctrlList(): Promise<WmctrlEntry[]> {
    return new Promise((resolve) => {
        execFile("wmctrl", ["-l", "-G", "-p"], { encoding: "utf-8", timeout: 3000 }, (err, stdout) => {
            if (err || !stdout) { resolve([]); return; }
            const results: WmctrlEntry[] = [];
            for (const line of stdout.trim().split("\n")) {
                const m = line.match(/^(0x[\da-f]+)\s+\S+\s+(\d+)\s+(-?\d+)\s+(-?\d+)\s+(\d+)\s+(\d+)\s+\S+\s*(.*)/i);
                if (!m) continue;
                results.push({
                    xid: parseInt(m[1]!, 16),
                    pid: parseInt(m[2]!, 10),
                    x: parseInt(m[3]!, 10),
                    y: parseInt(m[4]!, 10),
                    w: parseInt(m[5]!, 10),
                    h: parseInt(m[6]!, 10),
                    title: m[7]?.trim() ?? "",
                });
            }
            resolve(results);
        });
    });
}

// ─── Resolve window screen position ──────────────────────────────────

const resolveLoggedFor = new Set<number>();

async function resolveWindowPos(win: BrowserWindow): Promise<WindowPosInfo | null> {
    if (win.isDestroyed()) return null;

    const now = Date.now();
    const cached = posCache.get(win.id);
    if (cached && (now - cached.resolvedAt) < POS_REFRESH_MS) return cached;

    const bounds = win.getBounds();

    try {
        const windows = await wmctrlList();
        const pid = process.pid;

        const pids = new Set<number>([pid]);
        try {
            const { readFileSync } = await import("fs");
            for (const w of windows) {
                if (w.pid === 0 || pids.has(w.pid)) continue;
                try {
                    const stat = readFileSync(`/proc/${w.pid}/stat`, "utf-8");
                    const ppidMatch = stat.match(/\)\s+\S+\s+(\d+)/);
                    if (ppidMatch && parseInt(ppidMatch[1]!, 10) === pid) {
                        pids.add(w.pid);
                    }
                } catch { /* ignore */ }
            }
        } catch { /* ignore */ }

        const sizeMatch = (w: WmctrlEntry) =>
            Math.abs(w.w - bounds.width) <= 40 && Math.abs(w.h - bounds.height) <= 40;

        let match = windows.find(w => pids.has(w.pid) && sizeMatch(w));
        if (!match) {
            const title = win.getTitle();
            if (title) match = windows.find(w => w.title === title && sizeMatch(w));
        }
        if (!match) match = windows.find(sizeMatch);

        if (match) {
            const info: WindowPosInfo = {
                screenX: match.x,
                screenY: match.y,
                wmctrlW: match.w,
                wmctrlH: match.h,
                resolvedAt: now,
            };
            posCache.set(win.id, info);
            if (!resolveLoggedFor.has(win.id)) {
                resolveLoggedFor.add(win.id);
                console.log(`[SafeCapture] Resolved win ${win.id} screen pos: ${match.x},${match.y} ${match.w}x${match.h} (pid=${match.pid})`);
            }
            win.once("closed", () => { posCache.delete(win.id); resolveLoggedFor.delete(win.id); });
            return info;
        }
    } catch { /* ignore */ }

    if (!resolveLoggedFor.has(win.id)) {
        resolveLoggedFor.add(win.id);
        console.log(`[SafeCapture] Could not resolve screen position for win ${win.id}`);
    }
    return null;
}

// ─── Screen-coordinate computation ───────────────────────────────────

function computeScreenCoords(
    win: BrowserWindow,
    pos: WindowPosInfo,
    rect?: { x: number; y: number; width: number; height: number },
): { screenX: number; screenY: number; w: number; h: number } | null {
    const outerBounds = win.getBounds();
    const contentBounds = win.getContentBounds();
    const decorX = contentBounds.x - outerBounds.x;
    const decorY = contentBounds.y - outerBounds.y;

    if (rect) {
        return {
            screenX: pos.screenX + decorX + rect.x,
            screenY: pos.screenY + decorY + rect.y,
            w: rect.width,
            h: rect.height,
        };
    }
    return {
        screenX: pos.screenX + decorX,
        screenY: pos.screenY + decorY,
        w: contentBounds.width,
        h: contentBounds.height,
    };
}

// ─── Global rate limiter ─────────────────────────────────────────────
//
// Strict limit on how many maim/scrot subprocess invocations happen per second.
// Each XGetImage forces a GPU pipeline flush in the compositor → game stutter.
// Even a 1×1 capture causes a full flush, so the limit is on CALL COUNT.

const CAPTURE_RATE_LIMIT = 2;                          // max captures per second
const CAPTURE_MIN_INTERVAL_MS = 1000 / CAPTURE_RATE_LIMIT; // ms between captures
let lastCaptureTime = 0;
let captureCount = 0;
let captureThrottledCount = 0;
let lastThrottleLogTime = 0;

function canCapture(): boolean {
    const now = Date.now();
    if (now - lastCaptureTime >= CAPTURE_MIN_INTERVAL_MS) {
        return true;
    }
    return false;
}

function recordCapture(): void {
    lastCaptureTime = Date.now();
    captureCount++;
}

function recordThrottled(): void {
    captureThrottledCount++;
    const now = Date.now();
    if (now - lastThrottleLogTime > 10_000) {
        lastThrottleLogTime = now;
        console.log(`[SafeCapture] Rate limit: ${captureCount} captures, ${captureThrottledCount} throttled (last 10s)`);
        captureCount = 0;
        captureThrottledCount = 0;
    }
}

// ─── Per-ROI image cache ─────────────────────────────────────────────
//
// When rate-limited, return the last captured image for this ROI.
// The OCR system's roiFrameCache will see the same pixel hash → skip Tesseract.

interface CachedRoiImage {
    img: NativeImage;
    capturedAt: number;
}

const roiImageCache = new Map<string, CachedRoiImage>();
const ROI_CACHE_TTL_MS = 10_000;  // hold cached images for 10 seconds

function roiCacheKey(winId: number, rect?: { x: number; y: number; width: number; height: number }): string {
    if (!rect) return `${winId}:full`;
    return `${winId}:${rect.x},${rect.y},${rect.width},${rect.height}`;
}

// ─── Per-ROI capture ─────────────────────────────────────────────────

let captureSeq = 0;
const fsModule = import("fs");  // warm module cache once

// Serialise scrot captures (XGrabServer must not overlap).
let scrotLock: Promise<void> = Promise.resolve();

function captureRegionMaim(x: number, y: number, w: number, h: number): Promise<NativeImage | null> {
    const rx = Math.round(x), ry = Math.round(y), rw = Math.max(1, Math.round(w)), rh = Math.max(1, Math.round(h));
    const seq = captureSeq++;
    const tmpFile = `/tmp/.cap_${process.pid}_${seq}.png`;
    return new Promise((resolve) => {
        execFile(
            "maim", ["-g", `${rw}x${rh}+${rx}+${ry}`, tmpFile],
            { timeout: 5000 },
            (err) => {
                if (err) { resolve(null); return; }
                try {
                    const img = nativeImage.createFromPath(tmpFile);
                    fsModule.then(fs => fs.unlink(tmpFile, () => {})).catch(() => {});
                    resolve(img);
                } catch {
                    resolve(null);
                }
            },
        );
    });
}

function captureRegionScrot(x: number, y: number, w: number, h: number): Promise<NativeImage | null> {
    const rx = Math.round(x), ry = Math.round(y), rw = Math.max(1, Math.round(w)), rh = Math.max(1, Math.round(h));
    const seq = captureSeq++;
    const tmpFile = `/tmp/.cap_${process.pid}_${seq}.png`;
    return new Promise((resolve) => {
        execFile(
            "scrot", ["-a", `${rx},${ry},${rw},${rh}`, "-o", tmpFile],
            { timeout: 5000 },
            (err) => {
                if (err) { resolve(null); return; }
                try {
                    const img = nativeImage.createFromPath(tmpFile);
                    fsModule.then(fs => fs.unlink(tmpFile, () => {})).catch(() => {});
                    resolve(img);
                } catch {
                    resolve(null);
                }
            },
        );
    });
}

// ─── xwd capture (kept for backward compat) ─────────────────────────

/** Parse XWD version-7 (ZPixmap, 24 or 32 bpp) into a NativeImage. */
export function parseXwd(buf: Buffer): NativeImage | null {
    if (buf.length < 100) return null;
    const headerSize = buf.readUInt32BE(0);
    if (buf.readUInt32BE(4) !== 7) return null;
    const width       = buf.readUInt32BE(16);
    const height      = buf.readUInt32BE(20);
    const byteOrder   = buf.readUInt32BE(28);
    const bpp         = buf.readUInt32BE(44);
    const bytesPerLine = buf.readUInt32BE(48);
    const nColors     = buf.readUInt32BE(76);
    if ((bpp !== 32 && bpp !== 24) || width <= 0 || height <= 0 || width > 8192 || height > 8192) return null;

    const dataOffset = headerSize + nColors * 12;
    if (dataOffset + height * bytesPerLine > buf.length) return null;

    const rowBytes = width * 4;
    const bgra = Buffer.alloc(height * rowBytes);
    const srcBpp = bpp / 8;

    if (bpp === 32 && byteOrder === 0 && bytesPerLine === rowBytes) {
        for (let y = 0; y < height; y++) {
            buf.copy(bgra, y * rowBytes, dataOffset + y * bytesPerLine, dataOffset + y * bytesPerLine + rowBytes);
        }
        for (let i = 3; i < bgra.length; i += 4) bgra[i] = 255;
    } else {
        for (let y = 0; y < height; y++) {
            const srcRow = dataOffset + y * bytesPerLine;
            const dstRow = y * rowBytes;
            for (let x = 0; x < width; x++) {
                const s = srcRow + x * srcBpp;
                const d = dstRow + x * 4;
                if (bpp === 24) {
                    if (byteOrder === 0) {
                        bgra[d] = buf[s]!; bgra[d+1] = buf[s+1]!; bgra[d+2] = buf[s+2]!;
                    } else {
                        bgra[d] = buf[s+2]!; bgra[d+1] = buf[s+1]!; bgra[d+2] = buf[s]!;
                    }
                } else {
                    if (byteOrder === 0) {
                        bgra[d] = buf[s]!; bgra[d+1] = buf[s+1]!; bgra[d+2] = buf[s+2]!;
                    } else {
                        bgra[d] = buf[s+3]!; bgra[d+1] = buf[s+2]!; bgra[d+2] = buf[s+1]!;
                    }
                }
                bgra[d+3] = 255;
            }
        }
    }
    return nativeImage.createFromBitmap(bgra, { width, height });
}

/** Capture a specific X11 window via xwd -id (fails on Ozone windows). */
export function captureXwd(xid: number): Promise<NativeImage | null> {
    return new Promise((resolve) => {
        execFile(
            "xwd", ["-id", String(xid), "-silent"],
            { encoding: "buffer", maxBuffer: 64 * 1024 * 1024, timeout: 5000 },
            (err, stdout) => {
                if (err || !stdout || stdout.length === 0) { resolve(null); return; }
                resolve(parseXwd(stdout));
            },
        );
    });
}

// ─── Tool probing ────────────────────────────────────────────────────

let toolsProbed = false;
let useMaim = false;
let useScrot = false;
let diagLogged = false;

async function probeTools(): Promise<void> {
    if (toolsProbed) return;
    toolsProbed = true;
    useMaim = await probeMaim();
    if (!useMaim) {
        useScrot = await probeScrot();
    }
    if (useMaim) {
        console.log(`[SafeCapture] Using maim — per-ROI, rate-limited (max ${CAPTURE_RATE_LIMIT}/sec), no XGrabServer`);
    } else if (useScrot) {
        console.log(`[SafeCapture] WARNING: scrot uses XGrabServer — per-ROI, rate-limited (max ${CAPTURE_RATE_LIMIT}/sec)`);
        console.log("[SafeCapture] STRONGLY RECOMMENDED: sudo apt install maim");
    } else {
        console.log("[SafeCapture] WARNING: neither maim nor scrot available — OCR capture disabled");
        console.log("[SafeCapture] Install maim: sudo apt install maim");
    }
}

// ─── Main capture function ───────────────────────────────────────────

/**
 * Capture a BrowserWindow safely without corrupting WebGL.
 *
 * @param win The BrowserWindow to capture
 * @param rect Optional sub-region (relative to the window's content area)
 * @returns NativeImage of the capture (may be empty on Linux if tools unavailable)
 */
export async function safeCaptureWindow(
    win: BrowserWindow,
    rect?: { x: number; y: number; width: number; height: number },
): Promise<NativeImage> {
    if (win.isDestroyed()) return nativeImage.createEmpty();

    // Windows/macOS: BrowserWindow.capturePage() reads from the OS compositor
    if (process.platform !== "linux") {
        return win.capturePage(rect);
    }

    // Linux: probe tools on first call
    await probeTools();

    if (!diagLogged) {
        diagLogged = true;
        console.log(`[SafeCapture] tool: ${useMaim ? "maim" : useScrot ? "scrot" : "none"}, rate-limit: ${CAPTURE_RATE_LIMIT}/sec`);
    }

    if (!useMaim && !useScrot) return nativeImage.createEmpty();

    const cacheKey = roiCacheKey(win.id, rect);

    // ── Rate limit check ──
    if (!canCapture()) {
        // Return cached image for this ROI (if available)
        const cached = roiImageCache.get(cacheKey);
        if (cached && (Date.now() - cached.capturedAt) < ROI_CACHE_TTL_MS) {
            recordThrottled();
            return cached.img;
        }
        // No cached image available → return empty (OCR skips this cycle)
        recordThrottled();
        return nativeImage.createEmpty();
    }

    // ── Actual capture ──
    const pos = await resolveWindowPos(win);
    if (!pos) return nativeImage.createEmpty();

    const coords = computeScreenCoords(win, pos, rect);
    if (!coords || coords.w <= 0 || coords.h <= 0) return nativeImage.createEmpty();

    recordCapture();

    let img: NativeImage | null = null;

    if (useMaim) {
        img = await captureRegionMaim(coords.screenX, coords.screenY, coords.w, coords.h);
    } else if (useScrot) {
        const job = scrotLock.then(async () => {
            img = await captureRegionScrot(coords.screenX, coords.screenY, coords.w, coords.h);
        });
        scrotLock = job.catch(() => {});
        await job;
    }

    if (img && !img.isEmpty()) {
        // Cache this image for when we're rate-limited
        roiImageCache.set(cacheKey, { img, capturedAt: Date.now() });
        return img;
    }

    return nativeImage.createEmpty();
}

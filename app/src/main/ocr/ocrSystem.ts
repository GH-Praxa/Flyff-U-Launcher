/**
 * OCR System - orchestrates OCR scanning, caching, level overrides, and IPC handlers.
 *
 * Extracted from main.ts; all the OCR logic that previously lived inside app.whenReady().
 */

import { app, BrowserWindow, ipcMain, type NativeImage } from "electron";
import path from "path";
import fsp from "fs/promises";
import { logWarn, logErr } from "../../shared/logger";
import { acquireSharedOcrWorker, releaseAllOcrWorkers } from "./workerPool";
import { OcrTimerScheduler } from "./timerScheduler";
import type { OcrKind, PythonOcrWorker } from "./pythonWorker";
import {
    getDefaultOcrTimers,
    loadAllOcrTimers,
    persistOcrTimerSettings,
    OCR_TIMER_KEYS,
    type OcrTimerKey,
    type OcrTimerSettings,
} from "./timerStore";
import {
    clampManualLevel,
    loadManualLevelOverrides,
    persistManualLevelOverride,
    type ManualLevelOverrideRow,
} from "./manualLevelStore";

// ─── Types ──────────────────────────────────────────────────────────
export interface OcrSystemDeps {
    services: {
        roiStore: {
            get(profileId: string): Promise<Record<string, { x: number; y: number; w: number; h: number }> | null>;
        };
        sessionTabs: {
            getViewByProfile(profileId: string): {
                getBounds(): { x: number; y: number; width: number; height: number };
                webContents: { capturePage(rect: { x: number; y: number; width: number; height: number }): Promise<NativeImage> };
            } | null;
            getBounds(profileId: string): { x: number; y: number; width: number; height: number };
        };
        sessionWindow: {
            get(): BrowserWindow | null;
        };
        instances: {
            get(profileId: string): BrowserWindow | null;
        };
    };
    getPluginEventBus: () => {
        emit(event: string, payload: unknown, source: string): void;
    } | null;
    hasPluginHandler: (channel: string) => boolean;
    invokePluginHandler: (channel: string, ...args: unknown[]) => Promise<unknown>;
    safeHandle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => void;
    pythonExe: string;
}

// ─── Constants ──────────────────────────────────────────────────────
const WORKER_BACKOFF_MS = 5000;
const STALE_CLEAR_MS = 900;
const EXP_MAX_DROP_PER_TICK = 0.3;
const EXP_LEVEL_DROP_GRACE_MS = 6000;
const EXP_LEVELUP_THRESHOLD = 99.9999;
const EXP_LEVELUP_RESET_THRESHOLD = 10;
const EXP_LEVELUP_DROP_MIN = 10;
const EXP_LEVELUP_LOCK_MS = 2500;

const KEY_TO_OCR_KIND: Record<OcrTimerKey, OcrKind> = {
    lvl: "lvl",
    exp: "exp",
    rmExp: "exp",
    charname: "charname",
    lauftext: "lauftext",
    enemyName: "lvl",
    enemyHp: "enemyHp",
};

const ELEMENT_COLORS: Record<string, [number, number, number]> = {
    fire: [121, 94, 85],
    water: [130, 141, 149],
    wind: [83, 105, 68],
    earth: [96, 74, 79],
    electricity: [125, 114, 72],
};

// ─── Helpers (pure functions) ───────────────────────────────────────
function isImageNearlyUniform(img: NativeImage): boolean {
    try {
        const { width, height } = img.getSize();
        if (width === 0 || height === 0) return true;
        const buf = img.getBitmap();
        if (!buf || buf.length < 4) return true;
        const totalPixels = width * height;
        let minLum = 255;
        let maxLum = 0;
        for (let i = 0; i < totalPixels; i++) {
            const offset = i * 4;
            const b = buf[offset]!;
            const g = buf[offset + 1]!;
            const r = buf[offset + 2]!;
            const lum = (299 * r + 587 * g + 114 * b) / 1000;
            if (lum < minLum) minLum = lum;
            if (lum > maxLum) maxLum = lum;
            if (maxLum - minLum > 8) return false;
        }
        return (maxLum - minLum) <= 8;
    } catch {
        return false;
    }
}

function rgbToHsv(r: number, g: number, b: number) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
            case g: h = ((b - r) / d + 2); break;
            case b: h = ((r - g) / d + 4); break;
        }
        h *= 60;
    }
    const s = max === 0 ? 0 : d / max;
    const v = max;
    return { h, s, v };
}

function detectElement(img: NativeImage): string | null {
    try {
        const { width, height } = img.getSize();
        if (width <= 0 || height <= 0) return null;
        const buf = img.getBitmap();
        if (!buf || buf.length < 4) return null;
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        const startX = Math.floor(width * 0.25);
        const endX = Math.ceil(width * 0.75);
        const startY = Math.floor(height * 0.25);
        const endY = Math.ceil(height * 0.75);
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const idx = (y * width + x) * 4;
                const b = buf[idx] ?? 0;
                const g = buf[idx + 1] ?? 0;
                const r = buf[idx + 2] ?? 0;
                sumR += r; sumG += g; sumB += b; count++;
            }
        }
        if (count === 0) return null;
        const avgR = sumR / count;
        const avgG = sumG / count;
        const avgB = sumB / count;
        const { h, s, v } = rgbToHsv(avgR, avgG, avgB);
        if (s > 0.12 && v > 0.25) {
            if ((h >= 0 && h < 30) || h >= 330) return "fire";
            if (h >= 30 && h < 70) return "electricity";
            if (h >= 70 && h < 170) return "wind";
            if (h >= 170 && h < 250) return "water";
            if (h >= 250 && h < 330) return "earth";
        }
        let best: { name: string; dist: number } | null = null;
        for (const [name, [r, g, b]] of Object.entries(ELEMENT_COLORS)) {
            const dist = Math.sqrt(Math.pow(avgR - r, 2) + Math.pow(avgG - g, 2) + Math.pow(avgB - b, 2));
            if (!best || dist < best.dist) best = { name, dist };
        }
        if (best && best.dist <= 90) return best.name;
        return null;
    } catch {
        return null;
    }
}

function parseLevelElement(token: string | null): { level: number | null; element: string | null } {
    if (!token) return { level: null, element: null };
    const cleaned = token.trim();
    let level: number | null = null;
    const lvMatch = cleaned.match(/lv?\.?\s*(\d{1,3})/i);
    if (lvMatch) {
        level = Number(lvMatch[1]);
    } else {
        const numMatch = cleaned.match(/\b(\d{1,3})\b/);
        if (numMatch) level = Number(numMatch[1]);
    }
    const parts = cleaned.toLowerCase().split(/[-\s]/).filter(Boolean);
    const elements = ["earth", "fire", "water", "wind", "electricity", "electric"];
    let element: string | null = null;
    for (const p of parts) {
        if (elements.includes(p)) {
            element = p === "electric" ? "electricity" : p;
            break;
        }
    }
    return { level: Number.isFinite(level) ? level! : null, element };
}

function clampExpPercent(val: unknown): number | null {
    const str = typeof val === "string" ? val : String(val ?? "");
    const parsed = parseFloat(str.replace(/[^0-9.,]/g, "").replace(",", "."));
    if (!Number.isFinite(parsed)) return null;
    return Math.min(100, Math.max(0, parsed));
}

// ─── Main factory ───────────────────────────────────────────────────
export function createOcrSystem(deps: OcrSystemDeps) {
    const { services, getPluginEventBus, pythonExe } = deps;
    const OCR_KEYS = OCR_TIMER_KEYS;

    // ── Worker pool ─────────────────────────────────────────────
    const ocrWorkerPromises = new Map<OcrKind, Promise<PythonOcrWorker>>();
    const ocrWorkerBackoff = new Map<OcrKind, number>();

    async function ensureOcrWorker(kind: OcrKind): Promise<PythonOcrWorker> {
        const until = ocrWorkerBackoff.get(kind) ?? 0;
        if (Date.now() < until) throw new Error("ocr_worker_backoff");
        if (!ocrWorkerPromises.has(kind)) {
            ocrWorkerPromises.set(kind, acquireSharedOcrWorker(pythonExe, undefined, kind));
        }
        try {
            const worker = await ocrWorkerPromises.get(kind)!;
            if (!worker.isRunning()) {
                ocrWorkerPromises.set(kind, acquireSharedOcrWorker(pythonExe, undefined, kind));
                return await ocrWorkerPromises.get(kind)!;
            }
            ocrWorkerBackoff.delete(kind);
            return worker;
        } catch (err) {
            ocrWorkerPromises.delete(kind);
            ocrWorkerBackoff.set(kind, Date.now() + WORKER_BACKOFF_MS);
            throw err;
        }
    }

    const resetOcrWorker = (kind?: OcrKind) => {
        if (kind) ocrWorkerPromises.delete(kind);
        else ocrWorkerPromises.clear();
    };

    // ── OCR cache & manual level overrides ──────────────────────
    const ocrCache = new Map<string, {
        lvl?: string; exp?: string; rmExp?: string; charname?: string;
        lauftext?: string; enemyName?: string; enemyHp?: string; monsterName?: string;
        updatedAt: number;
    }>();
    const manualLevelOverrides = new Map<string, ManualLevelOverrideRow>();
    const ocrTimers = new Map<string, OcrTimerSettings>();

    const loadManualLevelOverridesIntoMemory = async () => {
        const rows = await loadManualLevelOverrides();
        manualLevelOverrides.clear();
        rows.forEach((row) => manualLevelOverrides.set(row.profileId, row));
    };

    const getManualLevelOverride = (profileId: string) => manualLevelOverrides.get(profileId) ?? null;

    const saveManualLevelOverride = async (
        profileId: string,
        patch: Partial<Pick<ManualLevelOverrideRow, "value" | "enabled">>
    ) => {
        const updated = await persistManualLevelOverride(profileId, patch);
        if (updated) {
            manualLevelOverrides.set(profileId, updated);
            return updated;
        }
        manualLevelOverrides.delete(profileId);
        return null;
    };

    const getEffectiveOcrSnapshot = (profileId: string) => {
        const base = ocrCache.get(profileId) ?? null;
        const manual = getManualLevelOverride(profileId);
        if (!base && !manual) return null;
        const snapshot = base ? { ...base } : { updatedAt: 0 };
        if (manual?.enabled) {
            snapshot.lvl = String(manual.value);
            snapshot.updatedAt = Math.max(snapshot.updatedAt ?? 0, manual.updatedAt ?? Date.now());
        }
        if (snapshot.enemyName && !snapshot.monsterName) {
            snapshot.monsterName = snapshot.enemyName;
        }
        return snapshot;
    };

    const getEffectiveOcrValue = (profileId: string, key: OcrTimerKey, rawValue: string | null) => {
        if (key === "lvl") {
            const manual = getManualLevelOverride(profileId);
            if (manual?.enabled) return String(manual.value);
        }
        return rawValue;
    };

    const getOcrTimers = (profileId: string): OcrTimerSettings => {
        const existing = ocrTimers.get(profileId);
        if (existing) {
            const allZero = OCR_KEYS.every((k) => (existing as Record<string, number>)[k] <= 0);
            if (!allZero) return existing;
        }
        return getDefaultOcrTimers();
    };

    // ── EXP level-up detection ──────────────────────────────────
    const lastLevelChangeAt = new Map<string, number>();
    const expLevelUpLocks = new Map<string, number>();
    const lastEnemyMeta = new Map<string, { level: number | null; element: string | null; updatedAt: number }>();

    const handleExpLevelUp = (profileId: string, prevExp: unknown, nextExp: unknown, now: number) => {
        const lastLockAt = expLevelUpLocks.get(profileId) ?? 0;
        const lockActive = lastLockAt && (now - lastLockAt) < EXP_LEVELUP_LOCK_MS;
        const prevPct = clampExpPercent(prevExp);
        const nextPct = clampExpPercent(nextExp);
        if (nextPct !== null && nextPct < EXP_LEVELUP_RESET_THRESHOLD && !lockActive) {
            expLevelUpLocks.delete(profileId);
        }
        const levelUpByThreshold = (
            nextPct !== null
            && nextPct >= EXP_LEVELUP_THRESHOLD
            && (prevPct ?? 0) < EXP_LEVELUP_THRESHOLD
            && !lockActive
        );
        const levelUpByDrop = (
            prevPct !== null
            && nextPct !== null
            && prevPct - nextPct >= EXP_LEVELUP_DROP_MIN
            && nextPct <= EXP_LEVELUP_RESET_THRESHOLD
            && !lockActive
        );
        if (levelUpByThreshold || levelUpByDrop) {
            expLevelUpLocks.set(profileId, now);
            lastLevelChangeAt.set(profileId, now);
        }
    };

    // ── Emit/broadcast ──────────────────────────────────────────
    const emitOcrUpdate = (
        profileId: string,
        key: OcrTimerKey,
        value: string,
        snapshot: ReturnType<typeof getEffectiveOcrSnapshot>,
        meta?: Record<string, unknown>
    ) => {
        if (!snapshot) return;
        const payload: Record<string, unknown> = { profileId, key, value, values: snapshot };
        if (meta && Object.keys(meta).length > 0) payload.meta = meta;
        getPluginEventBus()?.emit("ocr:update", payload, "core");

        if (key === "exp") {
            const expPayload: Record<string, unknown> = { profileId, value, updatedAt: snapshot.updatedAt };
            if (meta && Object.keys(meta).length > 0) expPayload.meta = meta;
            for (const win of BrowserWindow.getAllWindows()) {
                try { win.webContents.send("exp:update", expPayload); } catch (err) { logErr(err, "OCR IPC"); }
            }
            getPluginEventBus()?.emit("exp:update", expPayload, "core");
        }
    };

    const broadcastManualLevelOverride = (profileId: string) => {
        const manual = getManualLevelOverride(profileId);
        if (manual?.enabled) {
            const existing = ocrCache.get(profileId) ?? { updatedAt: 0 };
            existing.updatedAt = Math.max(existing.updatedAt || 0, manual.updatedAt ?? Date.now());
            ocrCache.set(profileId, existing);
        }
        const snapshot = getEffectiveOcrSnapshot(profileId);
        if (!snapshot) return;
        getPluginEventBus()?.emit("ocr:update", {
            profileId,
            key: "lvl",
            value: snapshot.lvl ?? "",
            values: snapshot,
        }, "core");
    };

    // ── Capture context builder ─────────────────────────────────
    const buildCaptureCtx = (profileId: string) => {
        const view = services.sessionTabs.getViewByProfile(profileId);
        if (view) {
            const hostWin = services.sessionWindow.get();
            const attached = !!hostWin && !hostWin.isDestroyed() && (hostWin as unknown as { getBrowserViews(): unknown[] }).getBrowserViews().includes(view);
            if (!hostWin || hostWin.isDestroyed() || hostWin.isMinimized() || !hostWin.isVisible() || !attached) return null;
            const liveBounds = view.getBounds();
            const viewBounds = services.sessionTabs.getBounds(profileId);
            if (liveBounds.width <= 0 || liveBounds.height <= 0 || viewBounds.width <= 0 || viewBounds.height <= 0) return null;
            return {
                win: hostWin,
                width: Math.min(viewBounds.width, liveBounds.width),
                height: Math.min(viewBounds.height, liveBounds.height),
                offsetX: viewBounds.x,
                offsetY: viewBounds.y,
                grab: (rect: { x: number; y: number; width: number; height: number }) => view.webContents.capturePage(rect),
            };
        }
        const inst = services.instances.get(profileId);
        if (inst && !inst.isDestroyed() && inst.isVisible() && !inst.isMinimized()) {
            const bounds = inst.getBounds();
            const content = inst.getContentBounds();
            if (bounds.width <= 0 || bounds.height <= 0) return null;
            return {
                win: inst,
                width: content.width,
                height: content.height,
                offsetX: 0,
                offsetY: 0,
                grab: (rect: { x: number; y: number; width: number; height: number }) => inst.webContents.capturePage(rect),
            };
        }
        return null;
    };

    const padExpRoi = (x: number, y: number, width: number, height: number, captureWidth: number, captureHeight: number) => {
        const minW = 80;
        const minH = 22;
        let w = width, h = height;
        if (w < minW) {
            const delta = minW - w;
            const newX = Math.max(0, x - Math.floor(delta / 2));
            const newW = Math.min(captureWidth - newX, w + delta);
            w = Math.max(w, newW);
        }
        if (h < minH) {
            const delta = minH - h;
            const newY = Math.max(0, y - Math.floor(delta / 2));
            const newH = Math.min(captureHeight - newY, h + delta);
            h = Math.max(h, newH);
        }
        return { width: w, height: h };
    };

    // ── Debug save ──────────────────────────────────────────────
    const debugSaveRoi = async (profileId: string, key: OcrTimerKey): Promise<string> => {
        const rois = await services.roiStore.get(profileId);
        const roi = rois?.[key];
        if (!roi || roi.w <= 0 || roi.h <= 0) throw new Error("ROI nicht gesetzt");

        const captureCtx = buildCaptureCtx(profileId);
        if (!captureCtx || captureCtx.width <= 0 || captureCtx.height <= 0) throw new Error("No visible host for ROI");

        const x = Math.round(roi.x * captureCtx.width);
        const y = Math.round(roi.y * captureCtx.height);
        let width = Math.max(1, Math.round(roi.w * captureCtx.width));
        let height = Math.max(1, Math.round(roi.h * captureCtx.height));

        const isExpLike = key === "exp" || key === "rmExp";
        if (isExpLike) {
            const padded = padExpRoi(x, y, width, height, captureCtx.width, captureCtx.height);
            width = padded.width; height = padded.height;
        }

        let screenshot;
        try {
            screenshot = await captureCtx.grab({ x, y, width, height });
        } catch (err) {
            logErr(err, `ROI debug grab ${key}`);
            if (captureCtx.win && !captureCtx.win.isDestroyed()) {
                screenshot = await captureCtx.win.webContents.capturePage({
                    x: Math.max(0, Math.round((captureCtx.offsetX ?? 0) + x)),
                    y: Math.max(0, Math.round((captureCtx.offsetY ?? 0) + y)),
                    width, height,
                });
            } else throw err;
        }

        const png = screenshot.toPNG();
        const debugDir = path.join(app.getAppPath(), "ocr", "debug");
        await fsp.mkdir(debugDir, { recursive: true });
        const timestamp = Date.now();
        const baseName = `roi_debug_${profileId}_${key}_${timestamp}`;
        const filePath = path.join(debugDir, `${baseName}.png`);
        await fsp.writeFile(filePath, png);

        const cached = ocrCache.get(profileId);
        const liveValue = cached?.[key as keyof typeof cached] ?? null;
        const ocrExp = cached?.exp ?? null;

        let killfeedStats: { currentExp?: number; expTotal?: number; expSession?: number } | null = null;
        try {
            if (deps.hasPluginHandler("killfeed:overlay:request:state")) {
                const result = await deps.invokePluginHandler("killfeed:overlay:request:state", profileId);
                const outer = result as { ok?: boolean; data?: unknown } | null;
                if (outer?.ok) {
                    const inner = outer.data as { stats?: Record<string, unknown> } | null;
                    if (inner?.stats) {
                        killfeedStats = {
                            currentExp: typeof inner.stats.currentExp === "number" ? inner.stats.currentExp : undefined,
                            expTotal: typeof inner.stats.expTotal === "number" ? inner.stats.expTotal : undefined,
                            expSession: typeof inner.stats.expSession === "number" ? inner.stats.expSession : undefined,
                        };
                    }
                }
            }
        } catch (err) {
            console.error("[Debug ROI] Failed to get killfeed stats:", err);
        }

        const jsonData = {
            profileId, key, liveValue, currentExp: ocrExp,
            killfeedCurrentExp: killfeedStats?.currentExp ?? null,
            expTotal: killfeedStats?.expTotal ?? null,
            expSession: killfeedStats?.expSession ?? null,
            allOcrValues: cached ? { ...cached } : null,
            timestamp, roi: { x: roi.x, y: roi.y, w: roi.w, h: roi.h },
            captureSize: { width, height },
        };
        await fsp.writeFile(path.join(debugDir, `${baseName}.json`), JSON.stringify(jsonData, null, 2));
        return filePath;
    };

    // ── Core scan ───────────────────────────────────────────────
    const scanRoiKey = async (profileId: string, key: OcrTimerKey): Promise<string | null> => {
        try {
            const tStart = Date.now();
            const rois = await services.roiStore.get(profileId);
            const roi = rois?.[key];
            if (!roi || roi.w <= 0 || roi.h <= 0) return "";

            const captureCtx = buildCaptureCtx(profileId);
            if (!captureCtx || captureCtx.width <= 0 || captureCtx.height <= 0) return null;

            const x = Math.round(roi.x * captureCtx.width);
            const y = Math.round(roi.y * captureCtx.height);
            let width = Math.max(1, Math.round(roi.w * captureCtx.width));
            let height = Math.max(1, Math.round(roi.h * captureCtx.height));

            const isExpLike = key === "exp" || key === "rmExp";
            if (isExpLike) {
                const padded = padExpRoi(x, y, width, height, captureCtx.width, captureCtx.height);
                width = padded.width; height = padded.height;
            }

            let screenshot;
            try {
                screenshot = await captureCtx.grab({ x, y, width, height });
            } catch (err) {
                logErr(err, `OCR grab primary ${key}`);
                if (captureCtx.win && !captureCtx.win.isDestroyed()) {
                    try {
                        screenshot = await captureCtx.win.webContents.capturePage({
                            x: Math.max(0, Math.round((captureCtx.offsetX ?? 0) + x)),
                            y: Math.max(0, Math.round((captureCtx.offsetY ?? 0) + y)),
                            width, height,
                        });
                    } catch (err2) {
                        logErr(err2, `OCR grab fallback ${key}`);
                        return null;
                    }
                } else return null;
            }

            if (!isExpLike && isImageNearlyUniform(screenshot)) return "";
            const tGrab = Date.now();
            const png = screenshot.toPNG();
            const elementHint = key === "enemyName" ? detectElement(screenshot) : null;

            if (process.env.FLYFF_OCR_SAVE_ROI === "1") {
                try {
                    const fs = await import("fs");
                    const debugPath = require("path").join(app.getAppPath(), "ocr", "debug");
                    await fs.promises.mkdir(debugPath, { recursive: true });
                    await fs.promises.writeFile(require("path").join(debugPath, `roi_${key}_${Date.now()}.png`), png);
                } catch { /* ignore */ }
            }

            const kind = KEY_TO_OCR_KIND[key];
            const worker = await ensureOcrWorker(kind);
            const tBeforeOcr = Date.now();
            const response = await worker.recognizePng(png, { kind });
            const tAfterOcr = Date.now();
            const durTotal = tAfterOcr - tStart;
            if (durTotal > 500) {
                logWarn(`OCR slow (${key}) grab=${tGrab - tStart}ms ocr=${tAfterOcr - tBeforeOcr}ms total=${durTotal}ms`, "OCR");
            }

            if (!response.ok) {
                const rawText = typeof response.raw === "string" ? response.raw.trim() : "";
                if (!response.error && rawText) return rawText;
                if (!response.error || response.error === "blank_image") return elementHint ?? "";
                return elementHint ?? null;
            }

            const raw = typeof response.raw === "string" ? response.raw.trim() : "";
            const fallback = typeof response.value === "string" ? response.value.trim() : "";
            const candidate = fallback || raw;

            if (isExpLike) {
                if (!candidate) return "";
                if (typeof response.value === "string" && response.value.trim()) {
                    const num = Number(response.value.replace(",", "."));
                    if (Number.isFinite(num) && num >= 0 && num <= 100) return `${num.toFixed(4)}%`;
                }
                return candidate;
            }

            if (key === "enemyName") {
                let lvlNum: number | null = null;
                if (typeof response.value === "string") {
                    const parsed = parseFloat(response.value.replace(/[^0-9.,]/g, "").replace(",", "."));
                    if (Number.isFinite(parsed)) lvlNum = Math.min(300, Math.max(1, Math.round(parsed)));
                }
                if (!lvlNum && raw) {
                    const parsed = parseFloat(raw.replace(/[^0-9.,]/g, "").replace(",", "."));
                    if (Number.isFinite(parsed)) lvlNum = Math.min(300, Math.max(1, Math.round(parsed)));
                }
                const parts = [];
                if (lvlNum) parts.push(`Lv${lvlNum}`);
                if (elementHint) parts.push(elementHint);
                return parts.join("-") || elementHint || "";
            }

            return raw || fallback || "";
        } catch (err) {
            logErr(err, `OCR scan ${key}`);
            return null;
        }
    };

    // ── Apply result (plausibility guards) ──────────────────────
    const applyOcrResult = (profileId: string, key: OcrTimerKey, result: string) => {
        const cached = ocrCache.get(profileId) ?? { updatedAt: 0 };
        const prevValue = (cached as Record<string, unknown>)[key];
        const now = Date.now();
        let shouldUpdate = true;
        const lastEnemyLog = (applyOcrResult as unknown as { _enemyLog?: Map<string, number> })._enemyLog || new Map<string, number>();
        (applyOcrResult as unknown as { _enemyLog?: Map<string, number> })._enemyLog = lastEnemyLog;

        const isExpLike = key === "exp" || key === "rmExp";
        if (isExpLike && result !== "" && typeof result === "string") {
            if (typeof prevValue === "string" && prevValue !== "") {
                const prevVal = parseFloat(prevValue.replace(/[^0-9.,]/g, "").replace(",", "."));
                const newVal = parseFloat(result.replace(/[^0-9.,]/g, "").replace(",", "."));
                if (!isNaN(prevVal) && !isNaN(newVal)) {
                    const drop = prevVal - newVal;
                    const rise = newVal - prevVal;
                    const lastLvlChange = lastLevelChangeAt.get(profileId) ?? 0;
                    const isLevelUpDrop = drop >= EXP_LEVELUP_DROP_MIN && newVal <= EXP_LEVELUP_RESET_THRESHOLD && prevVal >= EXP_LEVELUP_DROP_MIN;
                    const allowDrop = (lastLvlChange > 0 && (now - lastLvlChange) <= EXP_LEVEL_DROP_GRACE_MS) || isLevelUpDrop;
                    if (!allowDrop && drop > EXP_MAX_DROP_PER_TICK) shouldUpdate = false;
                    if (key === "exp" && prevVal >= 90 && prevVal < 100 && newVal >= 80 && newVal < 90) shouldUpdate = false;
                    if (rise > 20 || (!allowDrop && drop > 60)) shouldUpdate = false;
                }
            }
        }

        if (shouldUpdate) {
            if (key === "exp") handleExpLevelUp(profileId, prevValue, result, now);
            (cached as Record<string, unknown>)[key] = result;
            if (key === "lvl") {
                const prevLvlNum = typeof prevValue === "string" ? parseFloat(prevValue.replace(/[^0-9.,]/g, "").replace(",", ".")) : NaN;
                const nextLvlNum = parseFloat(result.replace(/[^0-9.,]/g, "").replace(",", "."));
                if (!isNaN(nextLvlNum) && (isNaN(prevLvlNum) || nextLvlNum !== prevLvlNum)) lastLevelChangeAt.set(profileId, now);
            }
            if (key === "enemyName") {
                const parsed = typeof result === "string" ? parseLevelElement(result) : { level: null, element: null };
                const prevMeta = lastEnemyMeta.get(profileId) ?? { level: null, element: null, updatedAt: 0 };
                let nextResult = result;
                if (!parsed.level && prevMeta.level) {
                    const el = parsed.element ?? prevMeta.element;
                    const parts = [`Lv${prevMeta.level}`];
                    if (el) parts.push(el);
                    nextResult = parts.join("-");
                }
                if (typeof nextResult === "string" && nextResult !== result) {
                    (cached as Record<string, unknown>)[key] = nextResult;
                    result = nextResult;
                }
                lastEnemyMeta.set(profileId, {
                    level: parsed.level ?? prevMeta.level ?? null,
                    element: parsed.element ?? prevMeta.element ?? null,
                    updatedAt: now,
                });
                (cached as Record<string, unknown>).monsterName = result;
                const token = `${profileId}:${result || ""}`;
                const last = lastEnemyLog.get(token) ?? 0;
                if (result && now - last > 3000) {
                    logWarn(`Enemy erkannt: ${result}`, "OCR");
                    lastEnemyLog.set(token, now);
                }
            }
            cached.updatedAt = now;
            ocrCache.set(profileId, cached);
            const snapshot = getEffectiveOcrSnapshot(profileId);
            if (snapshot) {
                const effectiveValue = getEffectiveOcrValue(profileId, key, result);
                emitOcrUpdate(profileId, key, effectiveValue ?? result, snapshot);
            }
        }
    };

    // ── Scheduled OCR ───────────────────────────────────────────
    const pendingOcrTicks = new Map<string, number>();
    const MAX_INFLIGHT_PER_KIND = 1;
    const ocrErrorCounts = new Map<string, number>();
    const ocrErrorThrottle = new Map<string, number>();
    let ocrTimerScheduler: OcrTimerScheduler | null = null;
    const primedProfiles = new Set<string>();

    async function handleScheduledOcr(profileId: string, key: OcrTimerKey) {
        const globalToken = `${KEY_TO_OCR_KIND[key]}:${profileId}`;
        const inflight = pendingOcrTicks.get(globalToken) ?? 0;
        if (inflight >= MAX_INFLIGHT_PER_KIND) {
            ocrTimerScheduler?.ack(profileId, key);
            return;
        }
        pendingOcrTicks.set(globalToken, inflight + 1);
        try {
            const timers = getOcrTimers(profileId);
            if (timers[key] <= 0) return;
            let result: string | null = null;
            try {
                result = await scanRoiKey(profileId, key);
            } catch (err) {
                const isTimeout = err instanceof Error && err.message.toLowerCase().includes("timeout");
                const isNotStarted = err instanceof Error && err.message.includes("Python OCR worker not started");
                const isBackoff = err instanceof Error && err.message.includes("ocr_worker_backoff");
                if (isTimeout || isNotStarted) {
                    resetOcrWorker(KEY_TO_OCR_KIND[key]);
                    ocrWorkerBackoff.set(KEY_TO_OCR_KIND[key], Date.now() + WORKER_BACKOFF_MS);
                    result = await scanRoiKey(profileId, key);
                } else if (isBackoff) {
                    return;
                } else throw err;
            }

            if (result === null) {
                const now = Date.now();
                const cached = ocrCache.get(profileId) ?? { updatedAt: 0 };
                const age = now - (cached.updatedAt || 0);
                if (age >= STALE_CLEAR_MS) {
                    (cached as Record<string, unknown>)[key] = "";
                    if (key === "enemyName") (cached as Record<string, unknown>).monsterName = "";
                    cached.updatedAt = now;
                    ocrCache.set(profileId, cached);
                    const snapshot = getEffectiveOcrSnapshot(profileId);
                    if (snapshot) {
                        const effectiveValue = getEffectiveOcrValue(profileId, key, "");
                        getPluginEventBus()?.emit("ocr:update", { profileId, key, value: effectiveValue ?? "", values: snapshot }, "core");
                        if (key === "exp") {
                            const payload = { profileId, value: "", updatedAt: cached.updatedAt };
                            for (const win of BrowserWindow.getAllWindows()) {
                                try { win.webContents.send("exp:update", payload); } catch (err) { logErr(err, "OCR IPC"); }
                            }
                            getPluginEventBus()?.emit("exp:update", payload, "core");
                        }
                    }
                } else {
                    const errKey = `${profileId}:${key}`;
                    ocrErrorCounts.set(errKey, (ocrErrorCounts.get(errKey) ?? 0) + 1);
                }
                return;
            }

            ocrErrorCounts.set(`${profileId}:${key}`, 0);
            applyOcrResult(profileId, key, result);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const now = Date.now();
            const token = msg.includes("Python OCR worker not started") ? "worker:not_started"
                : msg.includes("ocr_worker_backoff") ? "worker:backoff" : `other:${key}`;
            const lastLog = ocrErrorThrottle.get(token) ?? 0;
            if (now - lastLog > 3000) {
                ocrErrorThrottle.set(token, now);
                logErr(err, `OCR scheduled scan ${key}`);
            }
        } finally {
            const current = pendingOcrTicks.get(globalToken) ?? 1;
            if (current <= 1) pendingOcrTicks.delete(globalToken);
            else pendingOcrTicks.set(globalToken, current - 1);
            ocrTimerScheduler?.ack(profileId, key);
        }
    }

    const restartOcrScheduler = () => {
        if (ocrTimerScheduler) {
            void ocrTimerScheduler.stop().catch((err) => logErr(err, "OCR Timer Scheduler stop"));
            ocrTimerScheduler = null;
        }
        ocrTimerScheduler = new OcrTimerScheduler(handleScheduledOcr, (err) => {
            logErr(err, "OCR Timer Scheduler");
            restartOcrScheduler();
            for (const [profileId] of ocrTimers.entries()) {
                scheduleTimersForProfile(profileId);
            }
        });
    };

    restartOcrScheduler();

    const scheduleTimersForProfile = (profileId: string) => {
        if (!ocrTimerScheduler) restartOcrScheduler();
        ocrTimerScheduler?.update(profileId, getOcrTimers(profileId));
        if (!primedProfiles.has(profileId)) {
            primedProfiles.add(profileId);
            for (const key of OCR_KEYS) {
                void handleScheduledOcr(profileId, key);
            }
        }
    };

    const runImmediateOcr = async (profileId: string) => {
        const timers = getOcrTimers(profileId);
        for (const key of OCR_KEYS) {
            if ((timers as Record<string, number>)[key] <= 0) continue;
            try {
                const result = await scanRoiKey(profileId, key);
                if (result === null) continue;
                applyOcrResult(profileId, key, result);
            } catch (err) {
                logErr(err, `OCR immediate scan ${key}`);
            }
        }
    };

    // ── Lifecycle ───────────────────────────────────────────────
    app.on("will-quit", () => {
        void ocrTimerScheduler?.stop().catch((err) => logErr(err, "OCR Timer Scheduler"));
        releaseAllOcrWorkers().catch((err) => logErr(err, "OCR"));
    });

    // ── IPC Handlers ────────────────────────────────────────────
    const { safeHandle } = deps;

    ipcMain.handle("roi:debug:save", async (_event, arg: unknown) => {
        try {
            const obj = arg && typeof arg === "object" ? arg as Record<string, unknown> : {};
            const profileId = typeof obj.profileId === "string" ? obj.profileId : null;
            const key = typeof obj.key === "string" ? obj.key as OcrTimerKey : null;
            if (!profileId) throw new Error("profileId fehlt");
            if (!key || !OCR_KEYS.includes(key)) throw new Error("invalid key");
            const filePath = await debugSaveRoi(profileId, key);
            return { ok: true, data: filePath };
        } catch (err) {
            logErr(err, "ROI Debug Save");
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
    });

    safeHandle("ocr:getLatest", async (_e: unknown, arg: unknown) => {
        const profileId = typeof arg === "string" ? arg : null;
        if (!profileId) return null;
        const cached = getEffectiveOcrSnapshot(profileId);
        const now = Date.now();
        const isStale = !cached || (now - (cached.updatedAt || 0) > 1200);
        if (isStale) {
            try { await runImmediateOcr(profileId); } catch (err) { logErr(err, "OCR on-demand refresh"); }
        }
        const next = getEffectiveOcrSnapshot(profileId);
        if (next) {
            return {
                lvl: next.lvl, exp: next.exp, rmExp: next.rmExp,
                charname: next.charname, lauftext: next.lauftext,
                enemyName: next.enemyName, enemyHp: next.enemyHp,
                monsterName: next.monsterName, updatedAt: next.updatedAt,
            };
        }
        return null;
    });

    safeHandle("ocr:getTimers", async (_e: unknown, arg: unknown) => {
        const profileId = typeof arg === "string" ? arg : null;
        if (!profileId) return getDefaultOcrTimers();
        return getOcrTimers(profileId);
    });

    safeHandle("ocr:setTimer", async (_e: unknown, arg: unknown) => {
        const obj = arg && typeof arg === "object" ? (arg as Record<string, unknown>) : null;
        const profileId = obj?.profileId as string | undefined;
        const key = obj?.key as OcrTimerKey | undefined;
        const ms = typeof obj?.ms === "number" ? obj.ms : undefined;
        if (!profileId || !key || !OCR_KEYS.includes(key) || ms === undefined) return false;
        const patch: Partial<OcrTimerSettings> = {};
        patch[key] = ms;
        try {
            const stored = await persistOcrTimerSettings(profileId, patch);
            if (stored) {
                ocrTimers.set(profileId, {
                    lvl: stored.lvl, exp: stored.exp, charname: stored.charname,
                    lauftext: stored.lauftext, rmExp: stored.rmExp,
                    enemyName: stored.enemyName, enemyHp: stored.enemyHp,
                });
            } else ocrTimers.delete(profileId);
        } catch (err) {
            logErr(err, "OCR Timer");
            return false;
        }
        scheduleTimersForProfile(profileId);
        return true;
    });

    safeHandle("ocr:manualLevel:get", async (_e: unknown, arg: unknown) => {
        const profileId = typeof arg === "string" ? arg : null;
        if (!profileId) return null;
        const entry = getManualLevelOverride(profileId);
        if (!entry) return null;
        return { value: entry.value, enabled: entry.enabled, updatedAt: entry.updatedAt };
    });

    safeHandle("ocr:manualLevel:set", async (_e: unknown, arg: unknown) => {
        const obj = arg && typeof arg === "object" ? (arg as Record<string, unknown>) : null;
        const profileId = (typeof obj?.profileId === "string" ? obj.profileId : "").trim();
        if (!profileId) return false;
        const patch: Partial<Pick<ManualLevelOverrideRow, "value" | "enabled">> = {};
        if (obj && "value" in obj) patch.value = clampManualLevel(obj?.value);
        if (typeof obj?.enabled === "boolean") patch.enabled = obj.enabled;
        const updated = await saveManualLevelOverride(profileId, patch);
        if (!updated) return false;
        const cached = ocrCache.get(profileId) ?? { updatedAt: 0 };
        cached.updatedAt = Math.max(cached.updatedAt || 0, updated.updatedAt ?? Date.now());
        ocrCache.set(profileId, cached);
        broadcastManualLevelOverride(profileId);
        if (patch.enabled === false || updated.enabled === false) {
            void runImmediateOcr(profileId).catch((err) => logErr(err, "OCR manual level refresh"));
        }
        return true;
    });

    safeHandle("ocr:manualExp:set", async (_e: unknown, arg: unknown) => {
        const obj = arg && typeof arg === "object" ? (arg as Record<string, unknown>) : null;
        const profileId = (typeof obj?.profileId === "string" ? obj.profileId : "").trim();
        if (!profileId) return false;
        const parsed = clampExpPercent(obj?.value ?? obj?.exp ?? null);
        if (parsed === null) return false;
        const formatted = `${parsed.toFixed(4)}%`;
        const cached = ocrCache.get(profileId) ?? { updatedAt: 0 };
        const prevExp = (cached as Record<string, unknown>).exp;
        const now = Date.now();
        handleExpLevelUp(profileId, prevExp, formatted, now);
        (cached as Record<string, unknown>).exp = formatted;
        cached.updatedAt = now;
        ocrCache.set(profileId, cached);
        const snapshot = getEffectiveOcrSnapshot(profileId);
        if (snapshot) emitOcrUpdate(profileId, "exp", formatted, snapshot, { manualExp: true });
        return true;
    });

    safeHandle("ocr:update", async (_e: unknown, arg: unknown) => {
        const obj = arg && typeof arg === "object" ? (arg as Record<string, unknown>) : null;
        const profileId = obj?.profileId as string | undefined;
        if (!profileId) return false;
        ocrCache.set(profileId, {
            lvl: typeof obj?.lvl === "string" ? obj.lvl : undefined,
            exp: typeof obj?.exp === "string" ? obj.exp : undefined,
            rmExp: typeof obj?.rmExp === "string" ? obj.rmExp : undefined,
            charname: typeof obj?.charname === "string" ? obj.charname : undefined,
            lauftext: typeof obj?.lauftext === "string" ? obj.lauftext : undefined,
            enemyName: typeof obj?.enemyName === "string" ? obj.enemyName : undefined,
            enemyHp: typeof obj?.enemyHp === "string" ? obj.enemyHp : undefined,
            monsterName: typeof obj?.monsterName === "string" ? obj.monsterName : undefined,
            updatedAt: Date.now(),
        });
        return true;
    });

    // ── Init (call after creation) ──────────────────────────────
    const init = async () => {
        await loadManualLevelOverridesIntoMemory();
        const persistedTimers = await loadAllOcrTimers();
        for (const row of persistedTimers) {
            const timers: OcrTimerSettings = {
                lvl: row.lvl, exp: row.exp, charname: row.charname,
                lauftext: row.lauftext, rmExp: row.rmExp,
                enemyName: row.enemyName, enemyHp: row.enemyHp,
            };
            ocrTimers.set(row.profileId, timers);
            scheduleTimersForProfile(row.profileId);
        }
    };

    // Prewarm EXP OCR worker
    void ensureOcrWorker("exp").catch((err) => logErr(err, "OCR prewarm exp"));

    return {
        scheduleTimersForProfile,
        broadcastManualLevelOverride,
        getManualLevelOverrides: () => manualLevelOverrides,
        getOcrCache: () => ocrCache,
        init,
    };
}

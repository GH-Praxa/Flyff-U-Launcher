/**
 * OCR System - orchestrates OCR scanning, caching, level overrides, and IPC handlers.
 *
 * Extracted from main.ts; all the OCR logic that previously lived inside app.whenReady().
 */

import { app, BrowserWindow, ipcMain, nativeImage, type NativeImage } from "electron";
import path from "path";
import fsp from "fs/promises";
import { logWarn, logErr } from "../../shared/logger";
import { acquireSharedOcrWorker, releaseAllOcrWorkers, releaseSharedOcrWorker } from "./workerPool";
import { OcrTimerScheduler } from "./timerScheduler";
import type { OcrKind } from "./ocrTypes";
import type { NativeOcrWorker } from "./nativeWorker";
import { discoverExpRoi, isExpPercentMatch, setDiscoveryDebugDumpDir } from "./autoDiscoverRoi";
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
import { createMonsterLookup } from "./monsterLookup";
import { safeCaptureWindow } from "../capture/safeCapture";

// ─── Types ──────────────────────────────────────────────────────────
type SessionTabsLike = {
    getViewByProfile(profileId: string): {
        getBounds(): { x: number; y: number; width: number; height: number };
        webContents: { capturePage(rect: { x: number; y: number; width: number; height: number }): Promise<NativeImage> };
    } | null;
    getBounds(profileId: string): { x: number; y: number; width: number; height: number };
};

type SessionWindowLike = {
    get(): BrowserWindow | null;
};

export interface SessionRegistryEntry {
    window: BrowserWindow;
    tabsManager: SessionTabsLike;
}

export interface OcrSystemDeps {
    services: {
        roiStore: {
            get(profileId: string): Promise<Record<string, { x: number; y: number; w: number; h: number }> | null>;
            set(profileId: string, rois: Record<string, { x: number; y: number; w: number; h: number }>): Promise<void>;
        };
        sessionTabs: SessionTabsLike;
        sessionWindow: SessionWindowLike;
        instances: {
            get(profileId: string): BrowserWindow | null;
        };
        /** Multi-window session registry – when present, OCR will search all
         *  session windows (not just the legacy singleton) for the target profile. */
        sessionRegistry?: {
            list(): SessionRegistryEntry[];
        };
    };
    getPluginEventBus: () => {
        emit(event: string, payload: unknown, source: string): void;
    } | null;
    hasPluginHandler: (channel: string) => boolean;
    invokePluginHandler: (channel: string, ...args: unknown[]) => Promise<unknown>;
    safeHandle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => void;
    /** Returns the currently active game font family name (e.g. "Roboto Light"). */
    getGameFont?: () => string | null;
}

// ─── Font weight inference ───────────────────────────────────────────
/**
 * Infers a numeric CSS font-weight (100–900) from a font family name.
 * Returns 400 (Regular) when no weight keyword is detected.
 * More specific variants (ExtraLight, ExtraBold) are tested before their
 * shorter siblings (Light, Bold) to avoid false matches.
 */
export function inferFontWeight(fontFamily: string | null | undefined): number {
    if (!fontFamily) return 400;
    const lower = fontFamily.toLowerCase();
    if (/\b(extralight|extra.?light|ultralight|ultra.?light)\b/.test(lower)) return 200;
    if (/\b(extrabold|extra.?bold|ultrabold|ultra.?bold)\b/.test(lower)) return 800;
    if (/\b(semibold|semi.?bold|demibold|demi.?bold)\b/.test(lower)) return 600;
    if (/\b(thin|hairline)\b/.test(lower)) return 100;
    if (/\blight\b/.test(lower)) return 300;
    if (/\bmedium\b/.test(lower)) return 500;
    if (/\bbold\b/.test(lower)) return 700;
    if (/\b(black|heavy)\b/.test(lower)) return 900;
    return 400;
}

// ─── Constants ──────────────────────────────────────────────────────
const WORKER_BACKOFF_MS = 5000;
const STALE_CLEAR_MS = 900;
const EXP_MAX_DROP_PER_TICK = 0.3;
const EXP_LEVEL_DROP_GRACE_MS = 6000;
const EXP_LEVELUP_THRESHOLD = 99.9999;
const EXP_LEVELUP_RESET_THRESHOLD = 5;
const EXP_LEVELUP_DROP_MIN = 80;
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
        const buf = img.getBitmap() as unknown as Buffer | null | undefined;
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
        const buf = img.getBitmap() as unknown as Buffer | null | undefined;
        if (!buf || buf.length < 4) return null;
        let sumR = 0, sumG = 0, sumB = 0, totalWeight = 0, survivedPixels = 0;
        // Das Element ist die farbige Fuellung des Level-Kreises — im mittleren
        // ROI-Bereich messen (Kreisfuellung + Ziffern), die Ecken (Spielwelt-
        // Hintergrund) bleiben aussen vor.
        const startX = Math.floor(width * 0.25);
        const endX = Math.ceil(width * 0.75);
        const startY = Math.floor(height * 0.25);
        const endY = Math.ceil(height * 0.75);
        const totalCenterPixels = (endX - startX) * (endY - startY);
        // Praesenz-Check ueber die weissen Level-Ziffern: Die "142" ist nur da,
        // wenn ueberhaupt ein Monster anvisiert ist. Fehlen die weissen Pixel,
        // sieht der ROI nur Spielwelt-Boden (olivgruen) — dann KEIN Element
        // raten, sondern null liefern, damit der Aufrufer das zuletzt
        // bestaetigte Monster haelt statt es faelschlich umzuschalten.
        let whitePixels = 0;
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const idx = (y * width + x) * 4;
                const b = buf[idx] ?? 0;
                const g = buf[idx + 1] ?? 0;
                const r = buf[idx + 2] ?? 0;
                const { h: pH, s: pS, v: pV } = rgbToHsv(r, g, b);
                // Skip white text pixels (high brightness, low saturation)
                if (pV > 0.78 && pS < 0.15) { whitePixels++; continue; }
                // Skip dark edge/shadow pixels
                if (pV < 0.10) continue;
                // Skip golden ring pixels (hue 20-50°, low saturation)
                if (pH >= 20 && pH <= 50 && pS < 0.3) continue;
                // Saturation-weighted accumulation: purer element colours count more
                const w = 0.2 + pS;
                sumR += r * w; sumG += g * w; sumB += b * w; totalWeight += w;
                survivedPixels++;
            }
        }
        // No white level digits visible → no monster targeted → don't guess
        if (totalCenterPixels > 0 && whitePixels / totalCenterPixels < 0.04) return null;
        if (totalWeight === 0) return null;
        // If too few pixels survived filtering, this is likely background, not an element circle
        if (totalCenterPixels > 0 && survivedPixels / totalCenterPixels < 0.15) return null;
        const avgR = sumR / totalWeight;
        const avgG = sumG / totalWeight;
        const avgB = sumB / totalWeight;
        const { h, s, v } = rgbToHsv(avgR, avgG, avgB);
        if (s > 0.12 && v > 0.25) {
            if ((h >= 0 && h < 30) || h >= 330) return "fire";
            if (h >= 30 && h < 70) return "electricity";
            if (h >= 70 && h < 170) return "wind";
            if (h >= 170 && h < 250) return "water";
            if (h >= 250 && h < 330) return "earth";
        }
        let best: { name: string; dist: number } | null = null;
        for (const [name, [er, eg, eb]] of Object.entries(ELEMENT_COLORS)) {
            const dist = Math.sqrt(Math.pow(avgR - er, 2) + Math.pow(avgG - eg, 2) + Math.pow(avgB - eb, 2));
            if (!best || dist < best.dist) best = { name, dist };
        }
        if (best && best.dist <= 90) return best.name;
        return null;
    } catch {
        return null;
    }
}

function detectHpBar(img: NativeImage): boolean {
    try {
        const { width, height } = img.getSize();
        if (width <= 0 || height <= 0) return false;
        const buf = img.getBitmap() as unknown as Buffer | null | undefined;
        if (!buf || buf.length < 4) return false;
        const totalPixels = width * height;
        let hpPixels = 0;
        for (let i = 0; i < totalPixels; i++) {
            const offset = i * 4;
            const b = buf[offset] ?? 0;
            const g = buf[offset + 1] ?? 0;
            const r = buf[offset + 2] ?? 0;
            const { h, s, v } = rgbToHsv(r, g, b);
            if (s < 0.25 || v < 0.20) continue;
            // Red HP bar: hue 0-20 or 340-360
            // Green HP bar: hue 80-160
            if ((h <= 20 || h >= 340) || (h >= 80 && h <= 160)) hpPixels++;
        }
        return totalPixels > 0 && hpPixels / totalPixels >= 0.12;
    } catch {
        return false;
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
    const { services, getPluginEventBus } = deps;
    const OCR_KEYS = OCR_TIMER_KEYS;

    // ── Worker pool ─────────────────────────────────────────────
    const ocrWorkerPromises = new Map<OcrKind, Promise<NativeOcrWorker>>();
    const ocrWorkerBackoff = new Map<OcrKind, number>();

    // ── Global Tesseract concurrency limit ──────────────────────
    // Each Tesseract subprocess uses 100% of a CPU core for 700-1200ms.
    // Multiple concurrent processes starve the GPU process of CPU → game freeze.
    // Limit to 1 concurrent Tesseract call globally.
    let globalOcrRunning = 0;
    const MAX_GLOBAL_OCR = 1;

    async function ensureOcrWorker(kind: OcrKind): Promise<NativeOcrWorker> {
        const until = ocrWorkerBackoff.get(kind) ?? 0;
        if (Date.now() < until) throw new Error("ocr_worker_backoff");
        if (!ocrWorkerPromises.has(kind)) {
            ocrWorkerPromises.set(kind, acquireSharedOcrWorker(undefined, undefined, kind));
        }
        try {
            const worker = await ocrWorkerPromises.get(kind)!;
            if (!worker.isRunning()) {
                ocrWorkerPromises.set(kind, acquireSharedOcrWorker(undefined, undefined, kind));
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

    // ── Monster lookup ─────────────────────────────────────────
    const monsterLookup = createMonsterLookup();

    // ── ROI pixel-hash cache (skip Tesseract when frame unchanged) ──
    const roiFrameCache = new Map<string, { hash: number; value: string }>();

    /** Fast 32-bit rolling hash over sampled bytes of a PNG buffer. */
    function pngHash(buf: Buffer): number {
        let h = 0x811c9dc5;
        const step = Math.max(1, Math.floor(buf.length / 512));
        for (let i = 0; i < buf.length; i += step) {
            h ^= buf[i]!;
            h = (Math.imul(h, 0x01000193) >>> 0);
        }
        return h;
    }

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
    const lastEnemyMeta = new Map<string, { level: number | null; element: string | null; maxHp: number | null; updatedAt: number }>();
    const lastEnemyLog = new Map<string, number>();

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

    /** Capture a region of a BrowserWindow using the platform-safe strategy
     *  (xwd → desktopCapturer → empty on Linux, capturePage on Win/Mac). */
    const grabSafe = (
        win: BrowserWindow,
        rect: { x: number; y: number; width: number; height: number },
    ): Promise<NativeImage> => safeCaptureWindow(win, rect);

    const tryBuildFromView = (
        view: NonNullable<ReturnType<SessionTabsLike["getViewByProfile"]>>,
        hostWin: BrowserWindow,
        tabs: SessionTabsLike,
        profileId: string,
    ) => {
        if (!hostWin || hostWin.isDestroyed() || hostWin.isMinimized() || !hostWin.isVisible()) return null;
        const liveBounds = view.getBounds();
        const viewBounds = tabs.getBounds(profileId);
        if (liveBounds.width <= 0 || liveBounds.height <= 0 || viewBounds.width <= 0 || viewBounds.height <= 0) return null;

        // Bounds sanity: liveBounds (BrowserView) and viewBounds (TabsManager
        // cell) should agree to within ~10%. If they diverge, the view is in
        // a mid-resize / tab-switch transition — capturing now would yield a
        // crop based on stale dimensions and Math.min(below) would pick the
        // wrong (shrunken) value. Skip and let the next tick get a stable read.
        const widthRatio = Math.min(liveBounds.width, viewBounds.width) / Math.max(liveBounds.width, viewBounds.width);
        const heightRatio = Math.min(liveBounds.height, viewBounds.height) / Math.max(liveBounds.height, viewBounds.height);
        if (widthRatio < 0.9 || heightRatio < 0.9) return null;

        return {
            win: hostWin,
            width: Math.min(viewBounds.width, liveBounds.width),
            height: Math.min(viewBounds.height, liveBounds.height),
            offsetX: viewBounds.x,
            offsetY: viewBounds.y,
            grab: (rect: { x: number; y: number; width: number; height: number }) =>
                grabSafe(hostWin, { x: viewBounds.x + rect.x, y: viewBounds.y + rect.y, width: rect.width, height: rect.height }),
        };
    };

    // Throttled buildCaptureCtx diagnostics
    let buildCtxDiagAt = 0;

    const buildCaptureCtx = (profileId: string) => {
        // 1. Try legacy singleton session tabs
        const view = services.sessionTabs.getViewByProfile(profileId);
        if (view) {
            const hostWin = services.sessionWindow.get();
            if (hostWin) {
                const ctx = tryBuildFromView(view, hostWin, services.sessionTabs, profileId);
                if (ctx) return ctx;
            }
        }

        // 2. Try multi-window session registry
        if (services.sessionRegistry) {
            for (const entry of services.sessionRegistry.list()) {
                const regView = entry.tabsManager.getViewByProfile(profileId);
                if (regView && entry.window && !entry.window.isDestroyed()) {
                    const ctx = tryBuildFromView(regView, entry.window, entry.tabsManager, profileId);
                    if (ctx) return ctx;
                }
            }
        }

        // 3. Try instance windows
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
                grab: (rect: { x: number; y: number; width: number; height: number }) => grabSafe(inst, rect),
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
            throw err;
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
    // Diagnostic: log every scan attempt for the first 60s, then throttle
    const diagLastLog = new Map<string, number>();
    const diagStartTime = Date.now();
    const diagShouldLog = (tag: string): boolean => {
        const now = Date.now();
        if (now - (diagLastLog.get(tag) ?? 0) > 10_000) {
            diagLastLog.set(tag, now);
            return true;
        }
        return false;
    };

    const scanRoiKey = async (profileId: string, key: OcrTimerKey): Promise<string | null> => {
        try {
            const tStart = Date.now();
            const rois = await services.roiStore.get(profileId);
            const roi = rois?.[key];
            if (!roi || roi.w <= 0 || roi.h <= 0) {
                if (diagShouldLog(key)) {
                    const allKeys = rois ? Object.keys(rois) : [];
                    console.log(`[OCR DIAG] key=${key} profile=${profileId} → no ROI set. Available ROIs: [${allKeys.join(",")}]`);
                }
                return "";
            }

            const captureCtx = buildCaptureCtx(profileId);
            if (!captureCtx || captureCtx.width <= 0 || captureCtx.height <= 0) {
                if (diagShouldLog(key)) {
                    console.log(`[OCR DIAG] key=${key} → no capture context. profileId=${profileId}, captureCtx=${captureCtx ? `w=${captureCtx.width} h=${captureCtx.height}` : "null"}`);
                }
                return null;
            }

            const x = Math.round(roi.x * captureCtx.width);
            const y = Math.round(roi.y * captureCtx.height);
            let width = Math.max(1, Math.round(roi.w * captureCtx.width));
            let height = Math.max(1, Math.round(roi.h * captureCtx.height));

            const isExpLike = key === "exp" || key === "rmExp";
            if (isExpLike) {
                const padded = padExpRoi(x, y, width, height, captureCtx.width, captureCtx.height);
                // Width-padding is the "view instable" signal: it means the raw
                // crop was below 80 px wide, which only happens when
                // captureCtx.width has shrunk mid-resize. Height-padding (17→22)
                // is legitimate — Flyff's EXP bar is often <22 px tall depending
                // on window size — and the padded crop reads fine.
                // Return "" so E4's hold-on-empty preserves the last good value
                // (returning null would trigger stale-clear after 900 ms and
                // wipe even manually-set EXP values).
                if (padded.width !== width) {
                    if (diagShouldLog(key)) {
                        console.log(`[OCR DIAG] key=${key} profile=${profileId} → skip: crop width ${width}→${padded.width} (view unstable, ctx=${captureCtx.width}x${captureCtx.height})`);
                    }
                    return "";
                }
                width = padded.width; height = padded.height;
            }

            let screenshot;
            try {
                screenshot = await captureCtx.grab({ x, y, width, height });
            } catch (err) {
                logErr(err, `OCR grab ${key}`);
                return null;
            }

            const screenshotSize = screenshot.isEmpty() ? { width: 0, height: 0 } : screenshot.getSize();
            if (screenshotSize.width <= 0 || screenshotSize.height <= 0) {
                if (diagShouldLog(key)) {
                    console.log(`[OCR DIAG] key=${key} profile=${profileId} → empty capture. roi={x:${roi.x.toFixed(3)},y:${roi.y.toFixed(3)},w:${roi.w.toFixed(3)},h:${roi.h.toFixed(3)}} ctx=${captureCtx.width}x${captureCtx.height} crop=${x},${y},${width}x${height}`);
                }
                return "";
            }

            if (!isExpLike && isImageNearlyUniform(screenshot)) return "";
            // enemyHp: detect bar presence, then OCR the text for maxHp
            if (key === "enemyHp") {
                if (!detectHpBar(screenshot)) return "";
                // Bar detected – hold previous value if OCR fails
                const prevHpValue = (ocrCache.get(profileId) as Record<string, unknown> | undefined)?.enemyHp;
                const holdHp = typeof prevHpValue === "string" && prevHpValue.includes("/") ? prevHpValue : "HP erkannt";
                const hpPng = screenshot.toPNG();
                try {
                    if (globalOcrRunning >= MAX_GLOBAL_OCR) return holdHp;
                    const hpKind = KEY_TO_OCR_KIND[key];
                    const hpWorker = await ensureOcrWorker(hpKind);
                    globalOcrRunning++;
                    let hpResp;
                    try {
                        hpResp = await hpWorker.recognizePng(hpPng, { kind: hpKind });
                    } finally {
                        globalOcrRunning--;
                    }
                    const hpRaw = typeof hpResp.raw === "string" ? hpResp.raw.trim() : "";
                    const slashMatch = hpRaw.match(/(\d[\d.,]*)\s*[\/|]\s*(\d[\d.,]*)/);
                    if (slashMatch) {
                        const maxHp = Math.round(parseFloat(slashMatch[2]!.replace(/[.,]/g, "")));
                        if (maxHp > 0) {
                            const meta = lastEnemyMeta.get(profileId);
                            if (meta) meta.maxHp = maxHp;
                            else lastEnemyMeta.set(profileId, { level: null, element: null, maxHp, updatedAt: Date.now() });
                            return `${slashMatch[1]}/${slashMatch[2]}`;
                        }
                    }
                } catch { /* OCR failed, fall back */ }
                return holdHp;
            }
            const tGrab = Date.now();
            const png = screenshot.toPNG();
            const elementHint = key === "enemyName" ? detectElement(screenshot) : null;

            if (process.env.FLYFF_OCR_SAVE_ROI === "1") {
                try {
                    const fsDyn = await import("fs");
                    const debugPath = path.join(app.getAppPath(), "ocr", "debug");
                    await fsDyn.promises.mkdir(debugPath, { recursive: true });
                    await fsDyn.promises.writeFile(path.join(debugPath, `roi_${key}_${Date.now()}.png`), png);
                } catch { /* ignore */ }
            }

            // Fast path: if pixel content unchanged, reuse last OCR result.
            // IMPORTANT: cache hits include empty strings — re-running Tesseract
            // on identical pixels gives the same result, so skipping it saves CPU.
            // Without this, enemyName scans with no target ("")  re-run Tesseract
            // every cycle (700-1200ms × many/sec) → CPU starvation of GPU process → freeze.
            const frameCacheKey = `${profileId}:${key}`;
            const frameHash = pngHash(png);
            const frameCached = roiFrameCache.get(frameCacheKey);
            if (frameCached && frameCached.hash === frameHash) {
                return frameCached.value;
            }

            const kind = KEY_TO_OCR_KIND[key];
            const worker = await ensureOcrWorker(kind);

            // Global concurrency gate: skip if too many Tesseract processes running
            if (globalOcrRunning >= MAX_GLOBAL_OCR) {
                return frameCached?.value ?? "";
            }

            globalOcrRunning++;
            const tBeforeOcr = Date.now();
            let response;
            try {
                const fontWeight = key === "lvl" ? inferFontWeight(deps.getGameFont?.()) : undefined;
                response = await worker.recognizePng(png, { kind, fontWeight });
            } finally {
                globalOcrRunning--;
            }
            const tAfterOcr = Date.now();
            const durTotal = tAfterOcr - tStart;

            // Diagnostic log (throttled per key)
            if (diagShouldLog(`result:${key}`)) {
                console.log(`[OCR DIAG] key=${key} profile=${profileId} img=${screenshotSize.width}x${screenshotSize.height} ctx=${captureCtx.width}x${captureCtx.height} ok=${response.ok} raw="${(response.raw ?? "").slice(0, 40)}" val="${(response.value ?? "").slice(0, 20)}" ${durTotal}ms`);
            }

            if (durTotal > 500) {
                logWarn(`OCR slow (${key}) grab=${tGrab - tStart}ms ocr=${tAfterOcr - tBeforeOcr}ms total=${durTotal}ms`, "OCR");
            }

            // ── enemyName: HP-first monster identification ──
            if (key === "enemyName") {
                const cached = ocrCache.get(profileId);
                const prevMeta = lastEnemyMeta.get(profileId);
                const cachedMaxHp = prevMeta?.maxHp ?? null;
                const prevElement = prevMeta?.element ?? null;

                // Helper: cache the result before returning so the frame cache
                // can skip Tesseract on identical pixels next cycle.
                const cacheAndReturn = (val: string): string => {
                    roiFrameCache.set(frameCacheKey, { hash: frameHash, value: val });
                    return val;
                };

                // Determine if same monster (element matches or no element detected)
                const sameMonster = !elementHint || !prevElement || prevElement === elementHint;
                let holdValue = sameMonster
                    ? (cached?.monsterName || cached?.enemyName || "")
                    : ""; // element changed = different monster, don't hold
                if (!sameMonster && prevMeta) prevMeta.maxHp = null;

                // No element AND no HP = no monster targeted
                if (!elementHint && !cachedMaxHp) return cacheAndReturn("");

                // Refine held value when maxHp can narrow it down
                if (holdValue && holdValue.includes(",") && cachedMaxHp) {
                    try {
                        const refined = await monsterLookup.lookupMonster(prevMeta?.level ?? null, elementHint, cachedMaxHp);
                        if (refined) holdValue = refined;
                    } catch { /* keep holdValue */ }
                }

                // Try HP-based lookup when no hold value yet
                if (!holdValue && cachedMaxHp) {
                    try {
                        const hpResult = await monsterLookup.lookupMonster(prevMeta?.level ?? null, elementHint, cachedMaxHp);
                        if (hpResult) holdValue = hpResult;
                    } catch { /* no result */ }
                }

                if (!response.ok) return cacheAndReturn(holdValue);

                // OCR succeeded – try to parse level
                const raw = typeof response.raw === "string" ? response.raw.trim() : "";
                const val = typeof response.value === "string" ? response.value.trim() : "";
                let lvlNum: number | null = null;
                if (val) {
                    const parsed = parseFloat(val.replace(/[^0-9.,]/g, "").replace(",", "."));
                    if (Number.isFinite(parsed)) lvlNum = Math.min(300, Math.max(1, Math.round(parsed)));
                }
                if (lvlNum === null && raw) {
                    const parsed = parseFloat(raw.replace(/[^0-9.,]/g, "").replace(",", "."));
                    if (Number.isFinite(parsed)) lvlNum = Math.min(300, Math.max(1, Math.round(parsed)));
                }

                // Store parsed level+element in meta
                if (lvlNum !== null || elementHint) {
                    if (prevMeta) {
                        if (lvlNum !== null) prevMeta.level = lvlNum;
                        if (elementHint) prevMeta.element = elementHint;
                    } else {
                        lastEnemyMeta.set(profileId, { level: lvlNum, element: elementHint, maxHp: cachedMaxHp, updatedAt: Date.now() });
                    }
                }

                // Resolve: HP is primary, level+element secondary
                try {
                    const name = await monsterLookup.lookupMonster(lvlNum, elementHint, cachedMaxHp);
                    if (name) return cacheAndReturn(name);
                } catch { /* fallback */ }

                // No match – return holdValue or level-element fallback
                if (holdValue) return cacheAndReturn(holdValue);
                if (lvlNum !== null) return cacheAndReturn(`Lv${lvlNum}-${elementHint || "unknown"}`);
                return cacheAndReturn("");
            }

            if (!response.ok) {
                const rawText = typeof response.raw === "string" ? response.raw.trim() : "";
                if (!response.error && rawText) return rawText;
                if (!response.error || response.error === "blank_image") return "";
                return null;
            }

            const raw = typeof response.raw === "string" ? response.raw.trim() : "";
            const fallback = typeof response.value === "string" ? response.value.trim() : "";
            const candidate = fallback || raw;

            if (isExpLike) {
                if (!candidate) return "";
                if (typeof response.value === "string" && response.value.trim()) {
                    const num = Number(response.value.replace(",", "."));
                    if (Number.isFinite(num) && num >= 0 && num <= 100) {
                        const r = `${num.toFixed(4)}%`;
                        roiFrameCache.set(frameCacheKey, { hash: frameHash, value: r });
                        return r;
                    }
                }
                roiFrameCache.set(frameCacheKey, { hash: frameHash, value: candidate });
                return candidate;
            }

            const finalVal = raw || fallback || "";
            roiFrameCache.set(frameCacheKey, { hash: frameHash, value: finalVal });
            return finalVal;
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

        // Hold-on-empty for EXP keys: a transient empty result (skipped tick
        // via padded-ROI skip, blank crop, OCR worker glitch) must not wipe a
        // valid last reading — killfeed's delta logic would mis-detect a kill
        // or rollback. Genuinely stale data is cleared by the null-result path
        // in handleScheduledOcr after STALE_CLEAR_MS.
        if ((key === "exp" || key === "rmExp") && result === "" && typeof prevValue === "string" && prevValue !== "") {
            return;
        }

        const isExpLike = key === "exp" || key === "rmExp";
        if (isExpLike && result !== "" && typeof result === "string") {
            if (typeof prevValue === "string" && prevValue !== "") {
                const prevVal = parseFloat(prevValue.replace(/[^0-9.,]/g, "").replace(",", "."));
                const newVal = parseFloat(result.replace(/[^0-9.,]/g, "").replace(",", "."));
                if (!isNaN(prevVal) && !isNaN(newVal)) {
                    const drop = prevVal - newVal;
                    const rise = newVal - prevVal;
                    const lastLvlChange = lastLevelChangeAt.get(profileId) ?? 0;
                    // Tight level-up detection: a real Flyff level-up always goes
                    // from ~95-100% to ~0-5%. The 63→3 OCR glitch (leading-digit
                    // loss) must NOT be mistaken for a level-up, otherwise the
                    // stabilizer "infects" lastExpVal with the bad value and then
                    // rejects every subsequent correct reading as "rise too large".
                    const isLevelUpDrop = drop >= 80 && newVal < 5 && prevVal >= 85;
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
                const prevMeta = lastEnemyMeta.get(profileId) ?? { level: null, element: null, maxHp: null, updatedAt: 0 };
                const isResolvedName = !parsed.level && !parsed.element && result && !result.startsWith("Lv");
                let nextResult = result;
                // Only apply Lv-format fallback if result is NOT an already-resolved monster name
                if (!isResolvedName && !parsed.level && prevMeta.level) {
                    const el = parsed.element ?? prevMeta.element;
                    const parts = [`Lv${prevMeta.level}`];
                    if (el) parts.push(el);
                    nextResult = parts.join("-");
                }
                if (typeof nextResult === "string" && nextResult !== result) {
                    (cached as Record<string, unknown>)[key] = nextResult;
                    result = nextResult;
                }
                if (!isResolvedName) {
                    lastEnemyMeta.set(profileId, {
                        level: parsed.level ?? prevMeta.level ?? null,
                        element: parsed.element ?? prevMeta.element ?? null,
                        maxHp: prevMeta.maxHp,
                        updatedAt: now,
                    });
                }
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

    // ── Auto-Discovery state ────────────────────────────────────
    // Two failure tracks per profile:
    //   - `transientRetries`: capture-context absent / frame all-black /
    //     capture rate-limited. These are temporary states (tab still
    //     loading, game in background, etc.) — fast retry, don't escalate.
    //   - `attemptCount`: real "no match" after a valid frame was analyzed.
    //     This is permanent until either ROIs change or HUD moves; escalate
    //     with exponential backoff.
    // After 12 transient retries (≈1 min) we escalate to permanent track.
    const discoveryState = new Map<string, {
        lastAttemptAt: number;
        attemptCount: number;
        transientRetries: number;
        running: boolean;
    }>();
    const TRANSIENT_RETRY_MS = 5_000;
    const MAX_TRANSIENT_RETRIES = 12;
    const PERMANENT_BACKOFFS_MS = [10_000, 30_000, 60_000, 300_000];

    // Enable disk debug dumps so we can inspect what Discovery sees on failure.
    try {
        const dumpDir = path.join(app.getPath("userData"), "user", "logs", "ocr-discovery");
        setDiscoveryDebugDumpDir(dumpDir);
        console.log(`[OCR Discovery] debug PNG dump dir: ${dumpDir}`);
    } catch (err) {
        logErr(err, "AutoDiscover dump dir");
    }


    // Phase 2: Re-Discovery trigger via sliding-window match-rate.
    //
    // When the user moves the HUD, the stored ROI typically lands on a region
    // that partially overlaps the EXP bar — OCR oscillates between matches
    // ("68.50%") and garbage (",", "."). A strict consecutive-failure counter
    // would never trigger because each success resets it.
    //
    // We track the last N non-empty results (true=EXP-shaped, false=garbage)
    // and trigger re-discovery if the match rate falls below MIN_MATCH_RATIO.
    // Empty/null results are ambiguous (game in menu, capture unavailable) and
    // do not enter the window.
    const expScanHistory = new Map<string, boolean[]>();
    const EXP_HISTORY_SIZE = 20;
    const EXP_MIN_SAMPLES = 10;
    const EXP_MIN_MATCH_RATIO = 0.5;

    const recordExpScanResult = (profileId: string, result: string | null): void => {
        if (result === null || result === "") return;
        const isMatch = isExpPercentMatch(result);
        let history = expScanHistory.get(profileId);
        if (!history) {
            history = [];
            expScanHistory.set(profileId, history);
        }
        history.push(isMatch);
        while (history.length > EXP_HISTORY_SIZE) history.shift();

        if (history.length < EXP_MIN_SAMPLES) return;
        const matchCount = history.filter((h) => h).length;
        const ratio = matchCount / history.length;
        if (ratio >= EXP_MIN_MATCH_RATIO) return;

        // Below threshold → trigger re-discovery and clear history so a single
        // run is enough; a second below-threshold check will not fire until
        // we've accumulated EXP_MIN_SAMPLES new results.
        expScanHistory.delete(profileId);
        logWarn(`Re-Discovery triggered for ${profileId} — match rate ${Math.round(ratio * 100)}% (${matchCount}/${history.length})`, "OCR Discovery");
        discoveryState.delete(profileId);
        void runAutoDiscovery(profileId).then((found) => {
            if (found) scheduleTimersForProfile(profileId);
        });
    };

    // Schedules a fresh runAutoDiscovery + scheduleTimersForProfile call after
    // a delay. Used by markFailure for self-driven retry without needing an
    // external scheduleTimersForProfile trigger.
    const scheduleDiscoveryRetry = (profileId: string, delayMs: number): void => {
        setTimeout(() => {
            void runAutoDiscovery(profileId).then((found) => {
                if (found) scheduleTimersForProfile(profileId);
            });
        }, delayMs);
    };

    const runAutoDiscovery = async (profileId: string): Promise<boolean> => {
        const state = discoveryState.get(profileId) ?? { lastAttemptAt: 0, attemptCount: 0, transientRetries: 0, running: false };
        if (state.running) {
            console.log(`[OCR Discovery] skip ${profileId} — already running`);
            return false;
        }
        const now = Date.now();
        // Backoff only applies to permanent failures. Transient retries use
        // their own fast cadence via scheduleDiscoveryRetry.
        if (state.attemptCount > 0) {
            const backoffIdx = Math.min(state.attemptCount - 1, PERMANENT_BACKOFFS_MS.length - 1);
            const requiredWait = PERMANENT_BACKOFFS_MS[backoffIdx]!;
            if (now - state.lastAttemptAt < requiredWait) {
                console.log(`[OCR Discovery] skip ${profileId} — in backoff (attempt ${state.attemptCount}, next in ${Math.round((requiredWait - (now - state.lastAttemptAt)) / 1000)}s)`);
                return false;
            }
        }
        state.running = true;
        state.lastAttemptAt = now;
        discoveryState.set(profileId, state);
        console.log(`[OCR Discovery] starting for profile=${profileId} (attempts: ${state.attemptCount} permanent / ${state.transientRetries} transient)`);

        const markTransient = (reason: string) => {
            const cur = discoveryState.get(profileId) ?? state;
            cur.transientRetries++;
            cur.running = false;
            // After many transients, escalate to permanent.
            if (cur.transientRetries >= MAX_TRANSIENT_RETRIES) {
                cur.transientRetries = 0;
                cur.attemptCount++;
                const delay = PERMANENT_BACKOFFS_MS[Math.min(cur.attemptCount - 1, PERMANENT_BACKOFFS_MS.length - 1)]!;
                discoveryState.set(profileId, cur);
                console.log(`[OCR Discovery] FAILED profile=${profileId} — ${reason} (${MAX_TRANSIENT_RETRIES}× transient, escalating; retry in ${delay / 1000}s)`);
                scheduleDiscoveryRetry(profileId, delay);
            } else {
                discoveryState.set(profileId, cur);
                console.log(`[OCR Discovery] TRANSIENT profile=${profileId} — ${reason} (${cur.transientRetries}/${MAX_TRANSIENT_RETRIES}, retry in ${TRANSIENT_RETRY_MS / 1000}s)`);
                scheduleDiscoveryRetry(profileId, TRANSIENT_RETRY_MS);
            }
        };

        const markPermanent = (reason: string) => {
            const cur = discoveryState.get(profileId) ?? state;
            cur.attemptCount++;
            cur.transientRetries = 0;
            cur.running = false;
            const delay = PERMANENT_BACKOFFS_MS[Math.min(cur.attemptCount - 1, PERMANENT_BACKOFFS_MS.length - 1)]!;
            discoveryState.set(profileId, cur);
            console.log(`[OCR Discovery] FAILED profile=${profileId} — ${reason} (permanent, retry in ${delay / 1000}s)`);
            scheduleDiscoveryRetry(profileId, delay);
        };

        try {
            const captureCtx = buildCaptureCtx(profileId);
            if (!captureCtx || captureCtx.width <= 0 || captureCtx.height <= 0) {
                markTransient(`no capture context (ctx=${captureCtx ? `${captureCtx.width}x${captureCtx.height}` : "null"})`);
                return false;
            }
            console.log(`[OCR Discovery] capture ctx=${captureCtx.width}x${captureCtx.height}`);

            // safeCaptureWindow has a strict 2/sec rate limit; full-frame
            // captures get throttled to empty. Retry with sleeps past the
            // rate-limit window.
            let png: Buffer | null = null;
            const MAX_CAPTURE_ATTEMPTS = 6;
            for (let attempt = 0; attempt < MAX_CAPTURE_ATTEMPTS; attempt++) {
                if (attempt > 0) await new Promise((r) => setTimeout(r, 550));
                try {
                    const img = await captureCtx.grab({ x: 0, y: 0, width: captureCtx.width, height: captureCtx.height });
                    if (!img.isEmpty()) {
                        const buf = img.toPNG();
                        if (buf.length > 256) {
                            png = buf;
                            console.log(`[OCR Discovery] captured ${png.length} bytes (${img.getSize().width}x${img.getSize().height}) on attempt ${attempt + 1}`);
                            break;
                        }
                    }
                } catch (err) {
                    logErr(err, "AutoDiscover capture");
                }
            }
            if (!png) {
                markTransient(`${MAX_CAPTURE_ATTEMPTS} capture attempts empty (rate-limited or no frame)`);
                return false;
            }

            const worker = await acquireSharedOcrWorker(undefined, undefined, "discovery");
            let outcome;
            try {
                outcome = await discoverExpRoi({ capturePng: png, ocrWorker: worker, profileId });
            } finally {
                await releaseSharedOcrWorker("discovery").catch((err) => logErr(err, "AutoDiscover release"));
            }

            if (outcome.kind === "matched") {
                const existing = await services.roiStore.get(profileId);
                const next: Record<string, { x: number; y: number; w: number; h: number }> = { ...(existing ?? {}) };
                next.exp = outcome.result.roi;
                await services.roiStore.set(profileId, next);
                console.log(`[OCR Discovery] SUCCESS profile=${profileId} sample="${outcome.result.rawSample}" box=${outcome.result.sourceBox.x},${outcome.result.sourceBox.y} ${outcome.result.sourceBox.w}x${outcome.result.sourceBox.h} roi=(${outcome.result.roi.x.toFixed(4)},${outcome.result.roi.y.toFixed(4)},${outcome.result.roi.w.toFixed(4)},${outcome.result.roi.h.toFixed(4)})`);
                discoveryState.delete(profileId);
                return true;
            }

            if (outcome.kind === "frame-blank") {
                markTransient(`frame blank (${outcome.maskFg} white px — tab inactive or loading)`);
                return false;
            }
            if (outcome.kind === "no-shape-valid") {
                markPermanent(`no shape-valid candidates (${outcome.componentsScanned} comps, ${outcome.maskFg} mask px)`);
                return false;
            }
            markPermanent(`no candidate matched EXP regex (${outcome.candidatesScanned} probed)`);
            return false;
        } catch (err) {
            logErr(err, "AutoDiscover");
            markPermanent(`exception: ${err instanceof Error ? err.message : String(err)}`);
            return false;
        }
    };

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
                const isNotStarted = err instanceof Error && err.message.includes("OCR worker not started");
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
            // Phase 2 Re-Discovery: if EXP OCR returns garbage (non-empty but
            // not EXP-shaped), the stored ROI has likely been invalidated by
            // a HUD move. recordExpScanResult tracks the failure rate and
            // triggers runAutoDiscovery when it crosses threshold.
            if (key === "exp") recordExpScanResult(profileId, result);
            applyOcrResult(profileId, key, result);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const now = Date.now();
            const token = msg.includes("OCR worker not started") ? "worker:not_started"
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

    const scheduleTimersForProfile = (profileId: string): void => {
        // Pre-check ROIs asynchronously. If EXP is missing, trigger
        // auto-discovery in the background — on success it re-invokes this
        // function. Profiles without ANY ROI are not primed (E1); profiles
        // with some ROIs (e.g. only `lvl`) schedule normally and Discovery
        // runs alongside for EXP.
        void (async () => {
            try {
                const rois = await services.roiStore.get(profileId);
                const hasAnyRoi = !!rois && Object.values(rois).some((r) => r && r.w > 0 && r.h > 0);
                const hasExpRoi = !!rois?.exp && rois.exp.w > 0 && rois.exp.h > 0;

                if (!hasExpRoi) {
                    console.log(`[OCR Discovery] scheduleTimersForProfile profile=${profileId}: no EXP ROI in store → triggering discovery`);
                    void runAutoDiscovery(profileId).then((found) => {
                        if (found) scheduleTimersForProfile(profileId);
                    });
                } else {
                    console.log(`[OCR Discovery] scheduleTimersForProfile profile=${profileId}: EXP ROI in store (${rois!.exp!.x.toFixed(3)},${rois!.exp!.y.toFixed(3)},${rois!.exp!.w.toFixed(3)},${rois!.exp!.h.toFixed(3)}) — discovery NOT triggered`);
                }

                if (!hasAnyRoi) {
                    primedProfiles.delete(profileId);
                    return;
                }
            } catch (err) {
                logErr(err, "OCR scheduleTimersForProfile ROI precheck");
                // Fall through and schedule anyway — safer than stalling.
            }
            if (!ocrTimerScheduler) restartOcrScheduler();
            ocrTimerScheduler?.update(profileId, getOcrTimers(profileId));
            if (!primedProfiles.has(profileId)) {
                primedProfiles.add(profileId);
                for (const key of OCR_KEYS) {
                    void handleScheduledOcr(profileId, key);
                }
            }
        })();
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

    // Throttle on-demand refreshes: only trigger runImmediateOcr at most once
    // every 3 seconds per profile.  The side panel polls ocr:getLatest every
    // ~250 ms — without throttling this fires immediate scans on EVERY poll
    // when data is stale, blocking the IPC channel for seconds.
    const lastImmediateOcr = new Map<string, number>();

    safeHandle("ocr:getLatest", async (_e: unknown, arg: unknown) => {
        const profileId = typeof arg === "string" ? arg : null;
        if (!profileId) return null;
        const cached = getEffectiveOcrSnapshot(profileId);
        const now = Date.now();
        const isStale = !cached || (now - (cached.updatedAt || 0) > 6000);
        const lastImmediate = lastImmediateOcr.get(profileId) ?? 0;
        if (isStale && (now - lastImmediate > 3000)) {
            lastImmediateOcr.set(profileId, now);
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
        await monsterLookup.ensureLoaded();
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

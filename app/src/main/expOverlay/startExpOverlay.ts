import { app, BrowserView, BrowserWindow, Rectangle, ipcMain } from "electron";
import path from "path";
import fs from "fs/promises";
import { createOverlayWindow } from "../windows/overlayWindow";
import { PythonOcrWorker } from "../ocr/pythonWorker";
type OcrResponse = {
    id: number;
    ok: boolean;
    raw?: string;
    value?: string | null;
    unit?: string | null;
    error?: string;
};
export type StartHudOverlayOptions = {
    getSessionWindow: () => BrowserWindow | null;
    getActiveView: () => BrowserView | null;
    intervalMs?: number;
    nameLevelEveryMs?: number;
    debugEveryN?: number;
    pythonExe?: string;
    ocrScriptPath?: string;
    getRects?: (size: {
        width: number;
        height: number;
    }) => HudRects | undefined | null;
};
type HudRects = {
    nameLevel: Rectangle;
    expPercent: Rectangle;
};
type Controller = {
    stop: () => void;
};
let sharedWorker: PythonOcrWorker | null = null;
let sharedRefs = 0;
function defaultOcrScriptPath(): string {
    return path.join(app.getAppPath(), "ocr", "ocr_worker.py");
}
async function acquireWorker(pythonExe?: string, scriptPath?: string) {
    if (!sharedWorker) {
        sharedWorker = new PythonOcrWorker({
            pythonExe: pythonExe ?? "python",
            scriptPath: scriptPath ?? defaultOcrScriptPath(),
        });
        await sharedWorker.start();
    }
    sharedRefs += 1;
    return sharedWorker;
}
async function releaseWorker() {
    sharedRefs -= 1;
    if (sharedRefs <= 0) {
        sharedRefs = 0;
        if (sharedWorker) {
            try {
                await sharedWorker.stop();
            }
            catch (err) {
                logErr(err);
            }
            sharedWorker = null;
        }
    }
}
function clampRect(r: Rectangle, w: number, h: number): Rectangle {
    const x = Math.max(0, Math.min(r.x, w - 1));
    const y = Math.max(0, Math.min(r.y, h - 1));
    const width = Math.max(1, Math.min(r.width, w - x));
    const height = Math.max(1, Math.min(r.height, h - y));
    return { x, y, width, height };
}
function defaultRects(size: {
    width: number;
    height: number;
}): HudRects {
    const { width: w, height: h } = size;
    const nameLevel = clampRect({
        x: Math.round(w * 0.012),
        y: Math.round(h * 0.012),
        width: Math.round(w * 0.24),
        height: Math.round(h * 0.05),
    }, w, h);
    const expPercent = clampRect({
        x: Math.round(w * 0.055),
        y: Math.round(h * 0.078),
        width: Math.round(w * 0.16),
        height: Math.round(h * 0.05),
    }, w, h);
    return { nameLevel, expPercent };
}
function resolveRects(size: {
    width: number;
    height: number;
}, getRects?: (size: {
    width: number;
    height: number;
}) => HudRects | undefined | null): HudRects {
    const fallback = defaultRects(size);
    if (!getRects)
        return fallback;
    try {
        const r = getRects(size);
        if (!r || !r.nameLevel || !r.expPercent)
            return fallback;
        return r;
    }
    catch {
        return fallback;
    }
}
function normalizeOcr(s: string) {
    return (s ?? "").replace(/\r/g, "\n").replace(/[^\S\n]+/g, " ").trim();
}
function parseNameLevel(raw: string): {
    name: string | null;
    level: number | null;
} {
    const s = normalizeOcr(raw).replace(/\n/g, " ").trim();
    const m = s.match(/^(.*?)\s*L\s*[vV]\s*([0-9]{1,3})\b/);
    if (!m)
        return { name: s || null, level: null };
    const name = (m[1] ?? "").trim() || null;
    const lvl = Number(m[2]);
    return { name, level: Number.isFinite(lvl) ? lvl : null };
}
function parseExpFromResponse(res: OcrResponse): number | null {
    const v = res?.value;
    if (typeof v === "string" && v.trim()) {
        const n = Number(v.replace(",", "."));
        if (Number.isFinite(n))
            return n;
    }
    const raw = res?.raw ?? "";
    const s = normalizeOcr(raw).replace(/\s+/g, "").replace(",", ".");
    const m = s.match(/(\d+(?:\.\d+)?)%?/);
    if (!m)
        return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
}
export function startExpOverlay(opts: StartHudOverlayOptions): Controller {
    const intervalMs = opts.intervalMs ?? 800;
    const nameLevelEveryMs = opts.nameLevelEveryMs ?? 8000;
    const debugEveryN = opts.debugEveryN ?? 0;
    const overlayPreloadPath = path.join(__dirname, "preload.js");
    const logErr = (err: unknown) => console.error("[Overlay]", err);
    const debugDir = debugEveryN ? path.join(app.getPath("userData"), "ocr_debug") : null;
    if (debugDir) {
        fs.mkdir(debugDir, { recursive: true })
            .then(() => console.log("[OCR DEBUG] dir ready:", debugDir))
            .catch((e) => console.error("[OCR DEBUG] mkdir failed:", e));
    }
    let stopped = false;
    let timer: NodeJS.Timeout | null = null;
    let inFlight = false;
    let tickCount = 0;
    let overlay: BrowserWindow | null = null;
    let overlayParentId: number | null = null;
    let overlayFollowTimer: NodeJS.Timeout | null = null;
    let overlayFollowParentId: number | null = null;
    let parentEventCleanup: (() => void) | null = null;
    let worker: PythonOcrWorker | null = null;
    let lastNameLevelAt = 0;
    let cachedName: string | null = null;
    let cachedLevel: number | null = null;
    let cachedExpPct: number | null = null;
    let cachedRawExp: string | null = null;
    let cachedRawNameLevel: string | null = null;
    let lastSentKey = "";
    let overlayVisible = false;
    const hudBox = { x: 14, y: 14, width: 0, height: 0 };
    let editOn = false;
    function safeHandle(channel: string, handler: any) {
        try {
            ipcMain.removeHandler(channel);
        }
        catch (err) {
            logErr(err);
        }
        ipcMain.handle(channel, handler);
    }
    function safeOn(channel: string, listener: any) {
        try {
            ipcMain.removeAllListeners(channel);
        }
        catch (err) {
            logErr(err);
        }
        ipcMain.on(channel, listener);
    }
    function isFromOverlay(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) {
        return !!(overlay && !overlay.isDestroyed() && event?.sender && overlay.webContents && event.sender.id === overlay.webContents.id);
    }
    function computeOverlayWindowBounds(parent: BrowserWindow) {
        const pb = parent.getContentBounds();
        const w = Math.max(160, hudBox.width || 0);
        const h = Math.max(60, hudBox.height || 0);
        const x = pb.x + Math.max(0, hudBox.x || 0);
        const y = pb.y + Math.max(0, hudBox.y || 0);
        return { x, y, width: w, height: h };
    }
    safeHandle("hud:getBounds", async (e) => {
        if (!isFromOverlay(e))
            return null;
        return { ...hudBox, editOn };
    });
    safeOn("overlay:setBounds", (e, payload) => {
        if (!isFromOverlay(e))
            return;
        const x = payload?.x;
        const y = payload?.y;
        if (typeof x === "number")
            hudBox.x = x;
        if (typeof y === "number")
            hudBox.y = y;
        const parent = overlay?.getParentWindow?.();
        if (parent && !parent.isDestroyed())
            syncOverlayBounds(parent);
    });
    safeOn("overlay:setSize", (e, payload) => {
        if (!isFromOverlay(e))
            return;
        const w = payload?.width;
        const h = payload?.height;
        if (typeof w === "number")
            hudBox.width = w;
        if (typeof h === "number")
            hudBox.height = h;
        const parent = overlay?.getParentWindow?.();
        if (parent && !parent.isDestroyed())
            syncOverlayBounds(parent);
    });
    function applyOverlayEditMode() {
        if (!overlay || overlay.isDestroyed())
            return;
        try {
            overlay.setIgnoreMouseEvents(!editOn, { forward: !editOn });
        }
        catch (err) {
            logErr(err);
        }
        try {
            overlay.webContents.send("overlay:edit", { on: editOn });
        }
        catch (err) {
            logErr(err);
        }
    }
    safeOn("overlay:toggleEdit", (e, payload) => {
        if (!isFromOverlay(e))
            return;
        editOn = !!payload?.on;
        applyOverlayEditMode();
    });
    function safeSendToOverlay(payload: any) {
        if (!overlay || overlay.isDestroyed())
            return;
        const wc = overlay.webContents;
        if (!wc || wc.isDestroyed())
            return;
        try {
            wc.send("exp:update", payload);
        }
        catch (err) {
            logErr(err);
        }
    }
    function closeOverlay() {
        if (overlay && !overlay.isDestroyed()) {
            try {
                overlay.close();
            }
            catch (err) {
                logErr(err);
            }
        }
        overlay = null;
        overlayParentId = null;
        if (overlayFollowTimer) {
            clearInterval(overlayFollowTimer);
            overlayFollowTimer = null;
        }
        overlayFollowParentId = null;
        if (parentEventCleanup) {
            try {
                parentEventCleanup();
            }
            catch (err) {
                logErr(err);
            }
            parentEventCleanup = null;
        }
    }
    function syncOverlayBounds(parent: BrowserWindow) {
        if (!overlay || overlay.isDestroyed())
            return;
        try {
            const b = computeOverlayWindowBounds(parent);
            overlay.setBounds(b, false);
        }
        catch (err) {
            logErr(err);
        }
    }
    function isParentVisible(parent: BrowserWindow) {
        try {
            return parent.isVisible() && !parent.isMinimized();
        }
        catch {
            return false;
        }
    }
    function isParentActive(parent: BrowserWindow) {
        try {
            const focused = BrowserWindow.getFocusedWindow();
            if (!focused)
                return false;
            let cur: BrowserWindow | null = focused;
            while (cur) {
                if (cur.id === parent.id)
                    return true;
                cur = cur.getParentWindow?.() ?? null;
            }
            return false;
        }
        catch {
            return false;
        }
    }
    function updateOverlayVisibility(parent: BrowserWindow) {
        if (!overlay || overlay.isDestroyed())
            return;
        const show = isParentVisible(parent) && isParentActive(parent);
        if (show === overlayVisible)
            return;
        overlayVisible = show;
        try {
            if (show) {
                overlay.setAlwaysOnTop(true, "screen-saver");
                overlay.showInactive();
                syncOverlayBounds(parent);
            }
            else {
                overlay.setAlwaysOnTop(false);
                overlay.hide();
            }
        }
        catch (err) {
            logErr(err);
        }
    }
    function startOverlayFollow(parent: BrowserWindow) {
        const pid = parent.id;
        if (overlayFollowTimer && overlayFollowParentId === pid)
            return;
        if (overlayFollowTimer) {
            clearInterval(overlayFollowTimer);
            overlayFollowTimer = null;
        }
        overlayFollowParentId = pid;
        overlayFollowTimer = setInterval(() => {
            if (!overlay || overlay.isDestroyed())
                return;
            updateOverlayVisibility(parent);
            if (isParentVisible(parent) && isParentActive(parent)) {
                syncOverlayBounds(parent);
            }
        }, 80);
    }
    function attachParentEvents(parent: BrowserWindow) {
        const pid = parent.id;
        if (parentEventCleanup && overlayParentId === pid)
            return;
        if (parentEventCleanup) {
            try {
                parentEventCleanup();
            }
            catch (err) {
                logErr(err);
            }
        }
        const onMove = () => syncOverlayBounds(parent);
        const onResize = () => syncOverlayBounds(parent);
        const onFocus = () => updateOverlayVisibility(parent);
        const onBlur = () => updateOverlayVisibility(parent);
        const onShow = () => updateOverlayVisibility(parent);
        const onHide = () => updateOverlayVisibility(parent);
        const onMinimize = () => updateOverlayVisibility(parent);
        const onRestore = () => updateOverlayVisibility(parent);
        parent.on("move", onMove);
        parent.on("resize", onResize);
        parent.on("focus", onFocus);
        parent.on("blur", onBlur);
        parent.on("show", onShow);
        parent.on("hide", onHide);
        parent.on("minimize", onMinimize);
        parent.on("restore", onRestore);
        parentEventCleanup = () => {
            parent.removeListener("move", onMove);
            parent.removeListener("resize", onResize);
            parent.removeListener("focus", onFocus);
            parent.removeListener("blur", onBlur);
            parent.removeListener("show", onShow);
            parent.removeListener("hide", onHide);
            parent.removeListener("minimize", onMinimize);
            parent.removeListener("restore", onRestore);
        };
    }
    function ensureOverlayForParent(parent: BrowserWindow) {
        if (overlay && overlay.isDestroyed())
            overlay = null;
        const pid = parent.id;
        if (overlay && overlayParentId !== pid) {
            closeOverlay();
        }
        if (!overlay) {
            overlay = createOverlayWindow(parent, { preloadPath: overlayPreloadPath });
            overlayParentId = pid;
            overlay.on("closed", () => {
                overlay = null;
                overlayParentId = null;
            });
            applyOverlayEditMode();
        }
        syncOverlayBounds(parent);
        attachParentEvents(parent);
        startOverlayFollow(parent);
        try {
            overlay?.setAlwaysOnTop(true, "screen-saver");
        }
        catch (err) {
            logErr(err);
        }
    }
    function getCaptureSize(parent: BrowserWindow, view: BrowserView | null) {
        if (view) {
            const b = view.getBounds();
            return { width: Math.max(1, b.width), height: Math.max(1, b.height) };
        }
        const [w, h] = parent.getContentSize();
        return { width: Math.max(1, w), height: Math.max(1, h) };
    }
    async function captureCropPng(parent: BrowserWindow, view: BrowserView | null, rect: Rectangle) {
        try {
            if (view) {
                if (view.webContents.isDestroyed())
                    return null;
                const img = await view.webContents.capturePage(rect);
                return img.toPNG();
            }
            if (parent.webContents.isDestroyed())
                return null;
            const img = await parent.webContents.capturePage(rect);
            return img.toPNG();
        }
        catch (e) {
            console.error("[OCR DEBUG] capture failed", e);
            return null;
        }
    }
    async function maybeDebugWrite(png: Buffer, label: string) {
        if (!debugEveryN)
            return;
        if (tickCount % debugEveryN !== 0)
            return;
        try {
            const dir = path.join(app.getPath("userData"), "ocr_debug");
            await fs.mkdir(dir, { recursive: true });
            const file = path.join(dir, `${label}_${Date.now()}.png`);
            await fs.writeFile(file, png);
        }
        catch (e) {
            console.error("[OCR DEBUG] write failed", e);
        }
    }
    const tick = async () => {
        if (stopped || inFlight)
            return;
        inFlight = true;
        tickCount += 1;
        try {
            const parent = opts.getSessionWindow();
            if (!parent || parent.isDestroyed()) {
                closeOverlay();
                return;
            }
            ensureOverlayForParent(parent);
            updateOverlayVisibility(parent);
            if (!worker) {
                worker = await acquireWorker(opts.pythonExe, opts.ocrScriptPath);
            }
            const view = (() => {
                try {
                    const v = opts.getActiveView?.() ?? null;
                    if (!v)
                        return null;
                    if (v.webContents.isDestroyed())
                        return null;
                    return v;
                }
                catch {
                    return null;
                }
            })();
            const size = getCaptureSize(parent, view);
            const rects = resolveRects(size, opts.getRects);
            const expPng = await captureCropPng(parent, view, rects.expPercent);
            if (expPng) {
                await maybeDebugWrite(expPng, "hud_exp");
                const res = (await worker.recognizePng(expPng, { kind: "exp" })) as OcrResponse;
                cachedRawExp = res.raw ?? cachedRawExp;
                const exp = parseExpFromResponse(res);
                if (exp !== null && exp >= 0 && exp <= 100) {
                    cachedExpPct = exp;
                }
            }
            const now = Date.now();
            if (now - lastNameLevelAt > nameLevelEveryMs) {
                const nlPng = await captureCropPng(parent, view, rects.nameLevel);
                if (nlPng) {
                    await maybeDebugWrite(nlPng, "hud_namelevel");
                    const res = (await worker.recognizePng(nlPng, { kind: "namelevel" })) as OcrResponse;
                    cachedRawNameLevel = res.raw ?? cachedRawNameLevel;
                    if (res.raw) {
                        const parsed = parseNameLevel(res.raw);
                        cachedName = parsed.name ?? cachedName;
                        cachedLevel = parsed.level ?? cachedLevel;
                    }
                }
                lastNameLevelAt = now;
            }
            const key = `${cachedName ?? ""}|${cachedLevel ?? ""}|${cachedExpPct ?? ""}`;
            if (key !== lastSentKey) {
                lastSentKey = key;
                safeSendToOverlay({
                    ts: Date.now(),
                    name: cachedName,
                    level: cachedLevel,
                    expPct: cachedExpPct,
                    rawExp: cachedRawExp,
                    rawNameLevel: cachedRawNameLevel,
                });
            }
        }
        catch (e) {
            console.error("[OCR DEBUG] tick error", e);
        }
        finally {
            inFlight = false;
        }
    };
    timer = setInterval(() => {
        tick().catch((err) => logErr(err));
    }, intervalMs);
    const stop = () => {
        if (stopped)
            return;
        stopped = true;
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        closeOverlay();
        const hadWorker = !!worker;
        worker = null;
        if (hadWorker) {
            releaseWorker().catch((err) => logErr(err));
        }
    };
    return { stop };
}

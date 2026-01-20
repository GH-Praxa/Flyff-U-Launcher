import { BrowserView, screen } from "electron";
import type { ViewBounds } from "../../shared/types";
import { hardenGameContents } from "../security/harden";
import type { SessionWindowController } from "../windows/sessionWindow";
import { LAYOUT, TIMINGS } from "../../shared/constants";
import { logErr } from "../../shared/logger"; // Added import
type SplitPair = {
    leftId: string;
    rightId: string;
};
export function createSessionTabsManager(opts: {
    sessionWindow: Pick<SessionWindowController, "ensure" | "get">;
    flyffUrl: string;
}) {
    const sessionViews = new Map<string, BrowserView>();
    const loadedProfiles = new Set<string>();
    let sessionActiveId: string | null = null;
    let sessionSplit: SplitPair | null = null;
    const defaultSplitRatio = LAYOUT.DEFAULT_SPLIT_RATIO;
    let sessionSplitRatio = defaultSplitRatio;
    let sessionVisible = true;
    let sessionBounds: ViewBounds = { x: 0, y: 60, width: 1200, height: 700 };
    const splitGap = LAYOUT.SPLIT_GAP;
    const minSplitRatio = LAYOUT.MIN_SPLIT_RATIO;
    const maxSplitRatio = LAYOUT.MAX_SPLIT_RATIO;
    const hoverPollMs = TIMINGS.HOVER_POLL_MS;
    let hoverTimer: NodeJS.Timeout | null = null;
    let lastNotifiedActiveId: string | null = null;
    function clampSplitRatio(ratio: number): number {
        if (!Number.isFinite(ratio))
            return sessionSplitRatio;
        return Math.min(maxSplitRatio, Math.max(minSplitRatio, ratio));
    }
    function getLayoutIds(): string[] {
        if (sessionSplit)
            return [sessionSplit.leftId, sessionSplit.rightId];
        return sessionActiveId ? [sessionActiveId] : [];
    }
    function sanitizeActiveId(): void {
        const visibleIds = getLayoutIds();
        if (visibleIds.length === 0) {
            sessionActiveId = null;
            return;
        }
        if (!sessionActiveId || !visibleIds.includes(sessionActiveId)) {
            sessionActiveId = visibleIds[0];
        }
    }
    function computeLayoutBounds(): Array<{
        id: string;
        bounds: ViewBounds;
    }> {
        const ids = getLayoutIds();
        if (ids.length === 0)
            return [];
        const hasSplit = sessionSplit !== null && ids.length > 1;
        const gap = hasSplit ? splitGap : 0;
        const leftWidth = hasSplit
            ? Math.max(1, Math.floor((sessionBounds.width - gap) * clampSplitRatio(sessionSplitRatio)))
            : sessionBounds.width;
        const rightWidth = hasSplit ? Math.max(1, sessionBounds.width - gap - leftWidth) : sessionBounds.width;
        return ids.map((id, idx) => {
            const isLeft = idx === 0;
            const width = hasSplit ? (isLeft ? leftWidth : rightWidth) : sessionBounds.width;
            const x = hasSplit && !isLeft ? sessionBounds.x + leftWidth + gap : sessionBounds.x;
            return {
                id,
                bounds: { x, y: sessionBounds.y, width, height: sessionBounds.height },
            };
        });
    }
    function notifyActiveChanged() {
        if (sessionActiveId === lastNotifiedActiveId)
            return;
        lastNotifiedActiveId = sessionActiveId;
        const win = opts.sessionWindow.get();
        if (!win || win.isDestroyed())
            return;
        try {
            win.webContents.send("sessionTabs:activeChanged", sessionActiveId);
        }
        catch (err) {
            logErr(err, "SessionTabs");
        }
    }
    function focusActiveView() {
        if (!sessionActiveId)
            return;
        const view = sessionViews.get(sessionActiveId);
        if (!view)
            return;
        try {
            view.webContents.focus();
        }
        catch (err) {
            logErr(err, "SessionTabs");
        }
    }
    function ensureAttached(win: Electron.BrowserWindow, view: BrowserView) {
        const existing = win.getBrowserViews();
        if (!existing.includes(view)) {
            try {
                win.addBrowserView(view);
            }
            catch (err) {
                logErr(err, "SessionTabs");
            }
        }
    }
    const lastBoundsMap = new Map<string, string>();
    function applyActiveBrowserView() {
        const win = opts.sessionWindow.get();
        if (!win)
            return;
        sanitizeActiveId();
        const layout = computeLayoutBounds();
        const layoutIds = new Set(layout.map((l) => l.id));
        const shouldShow = sessionVisible && layout.length > 0;
        // When hidden, keep ALL views attached but set bounds to zero
        // This allows tabs to be created while hidden, then shown later
        if (!shouldShow) {
            if (!sessionVisible && sessionViews.size > 0) {
                // Keep ALL views attached but hide them by setting zero bounds
                for (const [, view] of sessionViews) {
                    ensureAttached(win, view);
                    try {
                        view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
                    }
                    catch (err) {
                        logErr(err, "SessionTabs");
                    }
                }
                notifyActiveChanged();
                return;
            }
            // No views exist - remove any stale views
            for (const view of win.getBrowserViews()) {
                try {
                    win.removeBrowserView(view);
                }
                catch (err) {
                    logErr(err, "SessionTabs");
                }
            }
            lastBoundsMap.clear();
            notifyActiveChanged();
            return;
        }
        const idByView = new Map<BrowserView, string>();
        for (const [id, view] of sessionViews) {
            idByView.set(view, id);
        }
        // Remove views that are not part of the current layout
        for (const view of win.getBrowserViews()) {
            const id = idByView.get(view);
            if (!id || !layoutIds.has(id)) {
                try {
                    win.removeBrowserView(view);
                }
                catch (err) {
                    logErr(err, "SessionTabs");
                }
            }
            else {
                try {
                    view.setAutoResize({ width: false, height: false });
                }
                catch (err) {
                    logErr(err, "SessionTabs");
                }
            }
        }
        // Attach needed views and update bounds when changed
        for (const { id, bounds } of layout) {
            const view = sessionViews.get(id);
            if (!view)
                continue;
            ensureAttached(win, view);
            const key = `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`;
            const prevKey = lastBoundsMap.get(id);
            if (key !== prevKey) {
                try {
                    view.setBounds(bounds);
                    view.setAutoResize({ width: false, height: false });
                }
                catch (err) {
                    logErr(err, "SessionTabs");
                }
                lastBoundsMap.set(id, key);
            }
            loadProfile(id);
        }
        focusActiveView();
        notifyActiveChanged();
    }
    function checkHoverActivation() {
        if (!sessionSplit || !sessionVisible)
            return;
        const win = opts.sessionWindow.get();
        if (!win || win.isDestroyed() || !win.isFocused())
            return;
        const layout = computeLayoutBounds();
        if (layout.length < 2)
            return;
        const contentBounds = win.getContentBounds();
        const cursor = screen.getCursorScreenPoint();
        const localX = cursor.x - contentBounds.x;
        const localY = cursor.y - contentBounds.y;
        if (localY < sessionBounds.y || localY > sessionBounds.y + sessionBounds.height)
            return;
        if (localX < sessionBounds.x || localX > sessionBounds.x + sessionBounds.width)
            return;
        const target = layout.find(({ bounds }) => {
            return (localX >= bounds.x &&
                localX <= bounds.x + bounds.width &&
                localY >= bounds.y &&
                localY <= bounds.y + bounds.height);
        });
        if (!target || target.id === sessionActiveId)
            return;
        sessionActiveId = target.id;
        focusActiveView();
        notifyActiveChanged();
    }
    function startHoverActivation() {
        if (hoverTimer || !sessionSplit || !sessionVisible)
            return;
        hoverTimer = setInterval(checkHoverActivation, hoverPollMs);
    }
    function stopHoverActivation() {
        if (!hoverTimer)
            return;
        clearInterval(hoverTimer);
        hoverTimer = null;
    }
    function ensureSessionView(profileId: string) {
        if (sessionViews.has(profileId))
            return sessionViews.get(profileId)!;
        const view = new BrowserView({
            webPreferences: {
                partition: `persist:${profileId}`,
                contextIsolation: true,
                nodeIntegration: false,
            },
        });
        try {
            view.setAutoResize({ width: false, height: false });
        }
        catch (err) {
            logErr(err, "SessionTabs");
        }
        hardenGameContents(view.webContents);
        sessionViews.set(profileId, view);
        return view;
    }
    function loadProfile(profileId: string, loadOpts: { force?: boolean } = {}) {
        const view = sessionViews.get(profileId);
        if (!view)
            return;
        if (loadedProfiles.has(profileId))
            return;
        const shouldLoad = loadOpts.force ||
            sessionActiveId === profileId ||
            (sessionSplit && (sessionSplit.leftId === profileId || sessionSplit.rightId === profileId));
        if (!shouldLoad)
            return;
        const currentUrl = view.webContents.getURL();
        if (currentUrl && currentUrl !== "about:blank") {
            loadedProfiles.add(profileId);
            return;
        }
        loadedProfiles.add(profileId);
        view.webContents.loadURL(opts.flyffUrl).catch(() => undefined);
    }
    function destroySessionView(profileId: string) {
        const view = sessionViews.get(profileId);
        if (!view)
            return;
        const win = opts.sessionWindow.get();
        if (win) {
            try {
                win.removeBrowserView(view);
            }
            catch (err) {
                logErr(err, "SessionTabs");
            }
        }
        try {
            view.webContents.destroy();
        }
        catch (err) {
            logErr(err, "SessionTabs");
        }
        sessionViews.delete(profileId);
        loadedProfiles.delete(profileId);
        lastBoundsMap.delete(profileId);
        if (sessionSplit && (sessionSplit.leftId === profileId || sessionSplit.rightId === profileId)) {
            const survivor = sessionSplit.leftId === profileId ? sessionSplit.rightId : sessionSplit.leftId;
            sessionSplit = null;
            sessionActiveId = survivor ?? null;
            stopHoverActivation();
        }
        if (sessionActiveId === profileId) {
            sessionActiveId = null;
        }
    }
    function unloadSessionView(profileId: string) {
        loadedProfiles.delete(profileId);
        const view = sessionViews.get(profileId);
        if (!view)
            return false;
        const win = opts.sessionWindow.get();
        if (win) {
            try {
                win.removeBrowserView(view);
            }
            catch (err) {
                logErr(err, "SessionTabs");
            }
        }
        try {
            view.webContents.destroy();
        }
        catch (err) {
            logErr(err, "SessionTabs");
        }
        sessionViews.delete(profileId);
        lastBoundsMap.delete(profileId);
        return true;
    }
    const OPEN_TIMEOUT_MS = TIMINGS.VIEW_LOAD_TIMEOUT_MS;

    async function open(profileId: string): Promise<boolean> {
        const win = await opts.sessionWindow.ensure();
        const view = ensureSessionView(profileId);
        const webContents = view.webContents;
        if (!webContents || webContents.isDestroyed()) {
            logErr(`Cannot open session tab; webContents missing for profile ${profileId}`, "SessionTabs");
            return false;
        }
        const timeout = setTimeout(() => {
            logErr(`View load timeout after ${OPEN_TIMEOUT_MS}ms for profile ${profileId}`, "SessionTabs");
        }, OPEN_TIMEOUT_MS);
        const clearLoadWatch = () => {
            clearTimeout(timeout);
        };
        webContents.once("did-finish-load", clearLoadWatch);
        webContents.once("destroyed", clearLoadWatch);
        loadProfile(profileId, { force: true });
        sessionActiveId = profileId;
        sessionSplit = null;
        applyActiveBrowserView();
        stopHoverActivation();
        win.show();
        win.focus();
        return true;
    }
    function switchTo(profileId: string) {
        if (sessionSplit) {
            if (sessionSplit.leftId === profileId || sessionSplit.rightId === profileId) {
                sessionActiveId = profileId;
                applyActiveBrowserView();
                return true;
            }
            sessionSplit = null;
        }
        sessionActiveId = profileId;
        applyActiveBrowserView();
        stopHoverActivation();
        return true;
    }
    function logout(profileId: string) {
        unloadSessionView(profileId);
        applyActiveBrowserView();
        return true;
    }
    function login(profileId: string) {
        ensureSessionView(profileId);
        loadedProfiles.delete(profileId);
        applyActiveBrowserView();
        return true;
    }
    function close(profileId: string) {
        destroySessionView(profileId);
        applyActiveBrowserView();
        return true;
    }
    function setBounds(b: ViewBounds) {
        sessionBounds = b;
        applyActiveBrowserView();
        return true;
    }
    function setVisible(visible: boolean) {
        const wasVisible = sessionVisible;
        sessionVisible = !!visible;
        if (!sessionVisible) {
            stopHoverActivation();
        }
        else {
            startHoverActivation();
        }
        applyActiveBrowserView();
        // When becoming visible, force focus on active view to trigger render
        if (!wasVisible && sessionVisible) {
            const win = opts.sessionWindow.get();
            if (win && !win.isDestroyed()) {
                // Re-apply bounds to all visible views to ensure proper rendering
                const layout = computeLayoutBounds();
                for (const { id, bounds } of layout) {
                    const view = sessionViews.get(id);
                    if (!view) continue;
                    try {
                        view.setBounds(bounds);
                        view.setAutoResize({ width: false, height: false });
                    }
                    catch (err) {
                        logErr(err, "SessionTabs");
                    }
                }
                focusActiveView();
            }
        }
        return true;
    }
    async function setSplit(pair: {
        primary: string;
        secondary: string;
        ratio?: number;
    } | null) {
        const win = await opts.sessionWindow.ensure();
        if (!pair || !pair.primary) {
            sessionSplit = null;
            applyActiveBrowserView();
            stopHoverActivation();
            return true;
        }
        if (pair.primary === pair.secondary) {
            sessionActiveId = pair.primary;
            sessionSplit = null;
            applyActiveBrowserView();
            stopHoverActivation();
            return true;
        }
        ensureSessionView(pair.primary);
        ensureSessionView(pair.secondary);
        sessionActiveId = pair.primary;
        sessionSplit = { leftId: pair.primary, rightId: pair.secondary };
        sessionSplitRatio = clampSplitRatio(pair.ratio ?? sessionSplitRatio);
        applyActiveBrowserView();
        startHoverActivation();
        win.show();
        win.focus();
        return true;
    }
    function setSplitRatio(ratio: number) {
        if (!sessionSplit)
            return true;
        const next = clampSplitRatio(ratio);
        if (Math.abs(next - sessionSplitRatio) < 0.0001)
            return true;
        sessionSplitRatio = next;
        applyActiveBrowserView();
        startHoverActivation();
        return true;
    }
    function reset() {
        for (const id of [...sessionViews.keys()])
            destroySessionView(id);
        sessionViews.clear();
        loadedProfiles.clear();
        lastBoundsMap.clear();
        sessionActiveId = null;
        sessionSplit = null;
        sessionSplitRatio = defaultSplitRatio;
        stopHoverActivation();
    }
    function getActiveView(): BrowserView | null {
        if (!sessionActiveId)
            return null;
        return sessionViews.get(sessionActiveId) ?? null;
    }
    function getViewByProfile(profileId: string): BrowserView | null {
        return sessionViews.get(profileId) ?? null;
    }
    function getActiveId(): string | null {
        return sessionActiveId;
    }
    function isActive(profileId: string): boolean {
        return getLayoutIds().includes(profileId);
    }
    function getBounds(profileId?: string): ViewBounds {
        const layout = computeLayoutBounds();
        if (!profileId || layout.length <= 1)
            return sessionBounds;
        const match = layout.find((l) => l.id === profileId);
        return match?.bounds ?? sessionBounds;
    }
    return {
        open,
        switchTo,
        close,
        setBounds,
        setVisible,
        setSplit,
        setSplitRatio,
        reset,
        logout,
        login,
        getActiveView,
        getViewByProfile,
        getActiveId,
        isActive,
        getBounds,
    };
}
export type SessionTabsManager = ReturnType<typeof createSessionTabsManager>;

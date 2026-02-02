import { BrowserView, screen } from "electron";
import type { ViewBounds } from "../../shared/types";
import { hardenGameContents } from "../security/harden";
import type { SessionWindowController } from "../windows/sessionWindow";
import { GRID_CONFIGS, LAYOUT, TIMINGS } from "../../shared/constants";
import { logErr } from "../../shared/logger"; // Added import
import type { GridCell, MultiViewLayout } from "../../shared/schemas";
export function createSessionTabsManager(opts: {
    sessionWindow: Pick<SessionWindowController, "ensure" | "get">;
    flyffUrl: string;
    windowId?: string; // Optional ID for multi-window tracking
}) {
    const windowId = opts.windowId ?? "default";
    const sessionViews = new Map<string, BrowserView>();
    const loadedProfiles = new Set<string>();
    const loggedOutProfiles = new Set<string>();
    let sessionActiveId: string | null = null;
    let sessionLayout: MultiViewLayout | null = null;
    // When true, keep layout cells even if their BrowserView has not been created yet (sequential grid load).
    let layoutAllowsMissingViews = false;
    const defaultSplitRatio = LAYOUT.DEFAULT_SPLIT_RATIO;
    let sessionSplitRatio = defaultSplitRatio;
    let sessionVisible = true;
    let sessionBounds: ViewBounds = { x: 0, y: 60, width: 1200, height: 700 };
    const gridGap = LAYOUT.GRID_GAP;
    const minSplitRatio = LAYOUT.MIN_SPLIT_RATIO;
    const maxSplitRatio = LAYOUT.MAX_SPLIT_RATIO;
    const hoverPollMs = TIMINGS.HOVER_POLL_MS;
    let hoverTimer: NodeJS.Timeout | null = null;
    let lastNotifiedActiveId: string | null = null;
    let highlightActiveGridBorder = false;
    const activeBorderCssByView = new Map<BrowserView, string>();
    let hoverBorderTargetId: string | null = null;
    let lastLayoutSnapshot: Array<{ id: string; position: number }> = [];
    const ACTIVE_BORDER_CSS = `
        html, body {
            outline: 3px solid #2ecc71 !important;
            outline-offset: -3px;
        }
    `;
    function clampSplitRatio(ratio: number): number {
        if (!Number.isFinite(ratio))
            return sessionSplitRatio;
        return Math.min(maxSplitRatio, Math.max(minSplitRatio, ratio));
    }
    function removeActiveBorder(view: BrowserView) {
        const key = activeBorderCssByView.get(view);
        if (!key)
            return;
        activeBorderCssByView.delete(view);
        try {
            const res = view.webContents.removeInsertedCSS(key);
            if (res && typeof (res as Promise<void>).then === "function") {
                (res as Promise<void>).catch((err) => logErr(err, "SessionTabs"));
            }
        }
        catch (err) {
            logErr(err, "SessionTabs");
        }
    }
    function applyActiveBorder(view: BrowserView) {
        try {
            const res = view.webContents.insertCSS(ACTIVE_BORDER_CSS);
            const setKey = (key: string) => {
                const prev = activeBorderCssByView.get(view);
                if (prev && prev !== key) {
                    try {
                        const rm = view.webContents.removeInsertedCSS(prev);
                        if (rm && typeof (rm as Promise<void>).then === "function") {
                            (rm as Promise<void>).catch((err) => logErr(err, "SessionTabs"));
                        }
                    }
                    catch (err) {
                        logErr(err, "SessionTabs");
                    }
                }
                activeBorderCssByView.set(view, key);
            };
            if (res && typeof (res as Promise<string>).then === "function") {
                (res as Promise<string>).then(setKey).catch((err) => logErr(err, "SessionTabs"));
            }
            else if (typeof res === "string") {
                setKey(res as string);
            }
        }
        catch (err) {
            logErr(err, "SessionTabs");
        }
    }
    function refreshActiveBorder(layout: Array<{ id: string; position: number }> = lastLayoutSnapshot) {
        lastLayoutSnapshot = layout;
        const layoutIds = new Set(layout.map((l) => l.id));
        if (hoverBorderTargetId && !layoutIds.has(hoverBorderTargetId)) {
            hoverBorderTargetId = null;
        }
        const borderTargetId = hoverBorderTargetId ?? sessionActiveId;
        const shouldHighlight = highlightActiveGridBorder && layout.length > 1 && !!borderTargetId;
        for (const [id, view] of sessionViews) {
            const needsBorder = shouldHighlight && id === borderTargetId;
            const hasBorder = activeBorderCssByView.has(view);
            if (needsBorder && !hasBorder) {
                applyActiveBorder(view);
            }
            else if (!needsBorder && hasBorder) {
                removeActiveBorder(view);
            }
        }
    }
    /**
     * Ensure layout does not reference missing views and respects grid limits.
     * If all cells vanish (e.g., tabs closed) collapse to null layout.
     */
    function pruneInvalidLayout(): void {
        if (!sessionLayout)
            return;
        const config = GRID_CONFIGS[sessionLayout.type];
        if (!config) {
            sessionLayout = null;
            layoutAllowsMissingViews = false;
            return;
        }
        const maxPositions = config.rows * config.cols;
        const seen = new Map<number, GridCell>();
        for (const cell of sessionLayout.cells) {
            const hasView = sessionViews.has(cell.id);
            if (!hasView && !layoutAllowsMissingViews)
                continue;
            const pos = Math.max(0, Math.min(maxPositions - 1, cell.position));
            if (!seen.has(pos)) {
                seen.set(pos, { id: cell.id, position: pos });
            }
        }
        const cells = Array.from(seen.values()).sort((a, b) => a.position - b.position).slice(0, config.maxViews);
        if (cells.length === 0) {
            sessionLayout = null;
            sessionActiveId = null;
            layoutAllowsMissingViews = false;
            return;
        }
        const activePosition = sessionLayout.activePosition !== undefined && cells.some((c) => c.position === sessionLayout!.activePosition)
            ? sessionLayout.activePosition
            : cells[0].position;
        sessionSplitRatio = clampSplitRatio(sessionLayout.ratio ?? sessionSplitRatio);
        sessionLayout = {
            ...sessionLayout,
            ratio: sessionSplitRatio,
            cells,
            activePosition,
        };
        const activeCell = cells.find((c) => c.position === activePosition) ?? cells[0];
        sessionActiveId = activeCell.id;
    }
    function getLayoutIds(): string[] {
        if (sessionLayout)
            return [...sessionLayout.cells].sort((a, b) => a.position - b.position).map((c) => c.id);
        if (sessionActiveId && sessionViews.has(sessionActiveId))
            return [sessionActiveId];
        const first = sessionViews.keys().next();
        return !first.done ? [first.value] : [];
    }
    function sanitizeActiveId(): void {
        pruneInvalidLayout();
        const visibleIds = getLayoutIds();
        if (visibleIds.length === 0) {
            sessionActiveId = null;
            return;
        }
        if (sessionLayout) {
            const activeCell = sessionLayout.activePosition !== undefined
                ? sessionLayout.cells.find((c) => c.position === sessionLayout!.activePosition)
                : null;
            if (activeCell) {
                sessionActiveId = activeCell.id;
                return;
            }
            const first = sessionLayout.cells[0];
            sessionLayout = { ...sessionLayout, activePosition: first.position };
            sessionActiveId = first.id;
            return;
        }
        if (!sessionActiveId || !visibleIds.includes(sessionActiveId)) {
            sessionActiveId = visibleIds[0];
        }
    }
    function computeSplit2Bounds(
        bounds: ViewBounds,
        cells: GridCell[],
        ratio: number,
        gap: number
    ): Array<{ id: string; bounds: ViewBounds; position: number }> {
        if (cells.length === 0)
            return [];
        const clamped = clampSplitRatio(ratio);
        const leftCell = cells.find((c) => c.position === 0) ?? cells[0];
        const rightCell = cells.find((c) => c.position === 1) ?? cells[1];
        const hasRight = !!rightCell;
        const totalGap = hasRight ? gap : 0;
        const leftWidth = hasRight
            ? Math.max(1, Math.floor((bounds.width - totalGap) * clamped))
            : bounds.width;
        const rightWidth = hasRight ? Math.max(1, bounds.width - totalGap - leftWidth) : 0;
        const result: Array<{ id: string; bounds: ViewBounds; position: number }> = [];
        if (leftCell) {
            result.push({
                id: leftCell.id,
                position: leftCell.position,
                bounds: { x: bounds.x, y: bounds.y, width: leftWidth, height: bounds.height },
            });
        }
        if (rightCell) {
            result.push({
                id: rightCell.id,
                position: rightCell.position,
                bounds: { x: bounds.x + leftWidth + totalGap, y: bounds.y, width: rightWidth, height: bounds.height },
            });
        }
        return result;
    }
    function computeGridLayoutBounds(
        bounds: ViewBounds,
        layout: MultiViewLayout,
        gap: number
    ): Array<{ id: string; bounds: ViewBounds; position: number }> {
        const config = GRID_CONFIGS[layout.type];
        const { rows, cols } = config;
        const totalGapX = gap * (cols - 1);
        const totalGapY = gap * (rows - 1);
        const cellWidth = Math.floor((bounds.width - totalGapX) / cols);
        const cellHeight = Math.floor((bounds.height - totalGapY) / rows);
        return layout.cells.map((cell) => {
            const row = Math.floor(cell.position / cols);
            const col = cell.position % cols;
            return {
                id: cell.id,
                position: cell.position,
                bounds: {
                    x: bounds.x + col * (cellWidth + gap),
                    y: bounds.y + row * (cellHeight + gap),
                    width: cellWidth,
                    height: cellHeight,
                },
            };
        });
    }
    function computeLayoutBounds(): Array<{
        id: string;
        bounds: ViewBounds;
        position: number;
    }> {
        pruneInvalidLayout();
        const effectiveLayout: MultiViewLayout | null = sessionLayout ?? (sessionActiveId
            ? {
                type: "single",
                cells: [{ id: sessionActiveId, position: 0 }],
                ratio: sessionSplitRatio,
                activePosition: 0,
            }
            : null);
        if (!effectiveLayout)
            return [];
        const config = GRID_CONFIGS[effectiveLayout.type];
        if (!config)
            return [];
        const maxPositions = config.rows * config.cols;
        const orderedCells = [...effectiveLayout.cells]
            .map((c) => ({ ...c, position: Math.max(0, Math.min(maxPositions - 1, c.position)) }))
            .sort((a, b) => a.position - b.position)
            .slice(0, config.maxViews);
        if (orderedCells.length === 0)
            return [];
        const activeCell = effectiveLayout.activePosition !== undefined
            ? orderedCells.find((c) => c.position === effectiveLayout.activePosition)
            : orderedCells[0];
        sessionActiveId = activeCell?.id ?? orderedCells[0].id;
        if (effectiveLayout.type === "split-2") {
            const ratio = clampSplitRatio(effectiveLayout.ratio ?? sessionSplitRatio);
            sessionSplitRatio = ratio;
            return computeSplit2Bounds(sessionBounds, orderedCells, ratio, gridGap);
        }
        return computeGridLayoutBounds(sessionBounds, { ...effectiveLayout, cells: orderedCells }, gridGap);
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
        refreshActiveBorder(shouldShow ? layout : []);
        // When hidden, keep ALL views attached but set bounds to zero.
        // This preserves WebGL contexts (removing views destroys them).
        if (!shouldShow) {
            if (!sessionVisible && sessionViews.size > 0) {
                for (const [, view] of sessionViews) {
                    ensureAttached(win, view);
                    try {
                        view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
                    }
                    catch (err) {
                        logErr(err, "SessionTabs");
                    }
                }
                // Clear cached bounds so the next applyActiveBrowserView re-applies
                // real bounds instead of skipping due to stale key matches.
                lastBoundsMap.clear();
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
        if (!sessionVisible)
            return;
        const win = opts.sessionWindow.get();
        if (!win || win.isDestroyed() || !win.isFocused())
            return;
        const layout = computeLayoutBounds();
        if (layout.length < 2) {
            if (hoverBorderTargetId) {
                hoverBorderTargetId = null;
                refreshActiveBorder(layout);
            }
            return;
        }
        const contentBounds = win.getContentBounds();
        const cursor = screen.getCursorScreenPoint();
        const localX = cursor.x - contentBounds.x;
        const localY = cursor.y - contentBounds.y;
        const withinX = localX >= sessionBounds.x && localX <= sessionBounds.x + sessionBounds.width;
        const withinY = localY >= sessionBounds.y && localY <= sessionBounds.y + sessionBounds.height;
        if (!withinX || !withinY) {
            if (hoverBorderTargetId) {
                hoverBorderTargetId = null;
                refreshActiveBorder(layout);
            }
            return;
        }
        const target = layout.find(({ bounds }) => {
            return (localX >= bounds.x &&
                localX <= bounds.x + bounds.width &&
                localY >= bounds.y &&
                localY <= bounds.y + bounds.height);
        });
        if (!target) {
            if (hoverBorderTargetId) {
                hoverBorderTargetId = null;
                refreshActiveBorder(layout);
            }
            return;
        }
        const hoverChanged = hoverBorderTargetId !== target.id;
        hoverBorderTargetId = target.id;
        if (hoverChanged) {
            refreshActiveBorder(layout);
        }
        if (target.id === sessionActiveId)
            return;
        sessionActiveId = target.id;
        if (sessionLayout) {
            sessionLayout = { ...sessionLayout, activePosition: target.position };
        }
        focusActiveView();
        notifyActiveChanged();
    }
    function startHoverActivation() {
        if (hoverTimer || !sessionVisible)
            return;
        const layout = computeLayoutBounds();
        if (layout.length < 2)
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
    /** Returns true if a load was actually started, false if already loaded or skipped. */
    function loadProfile(profileId: string, loadOpts: { force?: boolean } = {}): boolean {
        if (isLoggedOut(profileId))
            return false;
        const view = sessionViews.get(profileId);
        if (!view)
            return false;
        if (loadedProfiles.has(profileId))
            return false;
        const shouldLoad = loadOpts.force ||
            sessionActiveId === profileId ||
            (sessionLayout && sessionLayout.cells.some((c) => c.id === profileId));
        if (!shouldLoad)
            return false;
        const currentUrl = view.webContents.getURL();
        if (currentUrl && currentUrl !== "about:blank") {
            loadedProfiles.add(profileId);
            return false;
        }
        loadedProfiles.add(profileId);
        view.webContents.loadURL(opts.flyffUrl).catch(() => undefined);
        return true;
    }
    function destroySessionView(profileId: string) {
        const view = sessionViews.get(profileId);
        if (!view)
            return;
        removeActiveBorder(view);
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
        if (sessionLayout && sessionLayout.cells.some((c) => c.id === profileId)) {
            const remaining = sessionLayout.cells.filter((c) => c.id !== profileId);
            if (remaining.length === 0) {
                sessionLayout = null;
                sessionActiveId = null;
                layoutAllowsMissingViews = false;
            }
            else {
                const nextActive = remaining.find((c) => c.position === sessionLayout!.activePosition) ?? remaining[0];
                sessionLayout = { ...sessionLayout, cells: remaining, activePosition: nextActive.position };
                sessionActiveId = nextActive.id;
            }
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
        removeActiveBorder(view);
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
        if (isLoggedOut(profileId)) {
            sessionActiveId = profileId;
            sessionLayout = {
                type: "single",
                cells: [{ id: profileId, position: 0 }],
                ratio: sessionSplitRatio,
                activePosition: 0,
            };
            layoutAllowsMissingViews = true;
            applyActiveBrowserView();
            win.show();
            win.focus();
            return true;
        }
        const view = ensureSessionView(profileId);
        const webContents = view.webContents;
        if (!webContents || webContents.isDestroyed()) {
            logErr(`Cannot open session tab; webContents missing for profile ${profileId}`, "SessionTabs");
            return false;
        }
        sessionActiveId = profileId;
        sessionLayout = {
            type: "single",
            cells: [{ id: profileId, position: 0 }],
            ratio: sessionSplitRatio,
            activePosition: 0,
        };
        layoutAllowsMissingViews = false;
        applyActiveBrowserView();
        stopHoverActivation();
        win.show();
        win.focus();

        const loadStarted = loadProfile(profileId, { force: true });
        if (!loadStarted) {
            // Already loaded, no need to wait
            return true;
        }

        // Wait for the view to actually finish loading
        return new Promise<boolean>((resolve) => {
            let resolved = false;
            const cleanup = () => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeout);
                webContents.removeListener("did-finish-load", onFinish);
                webContents.removeListener("did-fail-load", onFail);
                webContents.removeListener("destroyed", onDestroyed);
            };
            const onFinish = () => {
                cleanup();
                resolve(true);
            };
            const onFail = () => {
                cleanup();
                resolve(true); // Still resolve true, view is open but failed to load content
            };
            const onDestroyed = () => {
                cleanup();
                resolve(false);
            };
            const timeout = setTimeout(() => {
                logErr(`View load timeout after ${OPEN_TIMEOUT_MS}ms for profile ${profileId}`, "SessionTabs");
                cleanup();
                resolve(true); // Resolve anyway after timeout
            }, OPEN_TIMEOUT_MS);

            webContents.once("did-finish-load", onFinish);
            webContents.once("did-fail-load", onFail);
            webContents.once("destroyed", onDestroyed);
        });
    }

    async function openInCell(position: number, profileId: string, options: { activate?: boolean; forceLoad?: boolean } = {}): Promise<boolean> {
        const win = await opts.sessionWindow.ensure();
        if (!sessionLayout) {
            // Fallback: no active layout, behave like open()
            return open(profileId);
        }
        const config = GRID_CONFIGS[sessionLayout.type];
        const maxPositions = config.rows * config.cols;
        const pos = Math.max(0, Math.min(maxPositions - 1, position));

        // Keep layout cells even if not yet materialised
        layoutAllowsMissingViews = true;

        let cells = [...sessionLayout.cells];
        const existing = cells.find((c) => c.id === profileId);
        if (!existing) {
            cells = cells.filter((c) => c.position !== pos);
            cells.push({ id: profileId, position: pos });
            cells = cells.sort((a, b) => a.position - b.position).slice(0, config.maxViews);
            sessionLayout = { ...sessionLayout, cells };
        }

        const view = ensureSessionView(profileId);
        const webContents = view.webContents;
        const layoutBounds = computeLayoutBounds();
        const target = layoutBounds.find((c) => c.id === profileId) ?? layoutBounds.find((c) => c.position === pos);

        if (target) {
            try {
                view.setBounds(target.bounds);
                view.setAutoResize({ width: false, height: false });
            }
            catch (err) {
                logErr(err, "SessionTabs");
            }
        }

        ensureAttached(win, view);

        if (options.activate) {
            sessionActiveId = profileId;
            sessionLayout = { ...sessionLayout, activePosition: target?.position ?? pos };
        }

        applyActiveBrowserView();
        if (sessionLayout && sessionLayout.cells.length > 1) {
            startHoverActivation();
        }
        else {
            stopHoverActivation();
        }

        const loadStarted = loadProfile(profileId, { force: options.forceLoad !== false });
        if (!loadStarted) {
            // Already loaded, no need to wait
            return true;
        }

        // Wait for the view to actually finish loading
        if (!webContents || webContents.isDestroyed()) {
            return true;
        }

        return new Promise<boolean>((resolve) => {
            let resolved = false;
            const cleanup = () => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeout);
                webContents.removeListener("did-finish-load", onFinish);
                webContents.removeListener("did-fail-load", onFail);
                webContents.removeListener("destroyed", onDestroyed);
            };
            const onFinish = () => {
                cleanup();
                resolve(true);
            };
            const onFail = () => {
                cleanup();
                resolve(true); // Still resolve true, view is open but failed to load content
            };
            const onDestroyed = () => {
                cleanup();
                resolve(false);
            };
            const timeout = setTimeout(() => {
                logErr(`View load timeout after ${OPEN_TIMEOUT_MS}ms for profile ${profileId}`, "SessionTabs");
                cleanup();
                resolve(true); // Resolve anyway after timeout
            }, OPEN_TIMEOUT_MS);

            webContents.once("did-finish-load", onFinish);
            webContents.once("did-fail-load", onFail);
            webContents.once("destroyed", onDestroyed);
        });
    }
    const isLoggedOut = (id: string) => loggedOutProfiles.has(id);

    function switchTo(profileId: string) {
        const inLayout = sessionLayout && sessionLayout.cells.some((c) => c.id === profileId);
        if (isLoggedOut(profileId)) {
            // Keep existing layout intact, just mark active cell and allow missing views
            if (inLayout) {
                const cell = sessionLayout!.cells.find((c) => c.id === profileId);
                sessionLayout = { ...sessionLayout!, activePosition: cell?.position ?? sessionLayout!.activePosition };
                sessionActiveId = profileId;
                layoutAllowsMissingViews = true;
                applyActiveBrowserView();
                return true;
            }
            // Otherwise fallback to single-tab skeleton without loading the view
            sessionActiveId = profileId;
            sessionLayout = {
                type: "single",
                cells: [{ id: profileId, position: 0 }],
                ratio: sessionSplitRatio,
                activePosition: 0,
            };
            layoutAllowsMissingViews = true;
            applyActiveBrowserView();
            stopHoverActivation();
            return true;
        }
        ensureSessionView(profileId);
        if (inLayout) {
            const cell = sessionLayout!.cells.find((c) => c.id === profileId);
            sessionLayout = { ...sessionLayout!, activePosition: cell?.position ?? sessionLayout!.activePosition };
            sessionActiveId = profileId;
            applyActiveBrowserView();
            return true;
        }
        sessionActiveId = profileId;
        sessionLayout = {
            type: "single",
            cells: [{ id: profileId, position: 0 }],
            ratio: sessionSplitRatio,
            activePosition: 0,
        };
        layoutAllowsMissingViews = false;
        applyActiveBrowserView();
        stopHoverActivation();
        return true;
    }
    function logout(profileId: string) {
        loggedOutProfiles.add(profileId);
        unloadSessionView(profileId);
        // Keep layout cells even when views are logged out
        if (sessionLayout && sessionLayout.type !== "single") {
            layoutAllowsMissingViews = true;
        }
        applyActiveBrowserView();
        return true;
    }
    function login(profileId: string) {
        loggedOutProfiles.delete(profileId);
        ensureSessionView(profileId);
        loadedProfiles.delete(profileId);
        // Ensure the profile is in the layout after login (logout removed it)
        if (!sessionLayout || !sessionLayout.cells.some(c => c.id === profileId)) {
            sessionActiveId = profileId;
            sessionLayout = {
                type: "single",
                cells: [{ id: profileId, position: 0 }],
                ratio: sessionSplitRatio,
                activePosition: 0,
            };
            layoutAllowsMissingViews = false;
        }
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
    function setActiveGridBorderEnabled(enabled: boolean) {
        highlightActiveGridBorder = !!enabled;
        refreshActiveBorder();
        return true;
    }
    type SetLayoutOptions = { ensureViews?: boolean; allowMissingViews?: boolean };

    async function setMultiLayout(layout: MultiViewLayout | null, options: SetLayoutOptions = {}): Promise<boolean> {
        const ensureViews = options.ensureViews !== false;
        const allowMissing = options.allowMissingViews ?? !ensureViews;
        const win = await opts.sessionWindow.ensure();
        if (layout === null) {
            sessionLayout = null;
            layoutAllowsMissingViews = false;
            applyActiveBrowserView();
            stopHoverActivation();
            return true;
        }
        const config = GRID_CONFIGS[layout.type];
        const maxPositions = config.rows * config.cols;
        const unique = new Map<number, GridCell>();
        for (const cell of layout.cells) {
            const pos = Math.max(0, Math.min(maxPositions - 1, cell.position));
            if (!unique.has(pos)) {
                unique.set(pos, { id: cell.id, position: pos });
            }
        }
        const cells = Array.from(unique.values()).sort((a, b) => a.position - b.position).slice(0, config.maxViews);
        if (cells.length === 0) {
            sessionLayout = null;
            sessionActiveId = null;
            applyActiveBrowserView();
            stopHoverActivation();
            return true;
        }
        layoutAllowsMissingViews = allowMissing;
        if (ensureViews) {
            for (const cell of cells) {
                ensureSessionView(cell.id);
            }
        }
        sessionSplitRatio = clampSplitRatio(layout.ratio ?? sessionSplitRatio);
        const activePosition = layout.activePosition !== undefined && cells.some((c) => c.position === layout.activePosition)
            ? layout.activePosition
            : cells[0].position;
        sessionLayout = {
            type: layout.type,
            cells,
            ratio: sessionSplitRatio,
            activePosition,
        };
        sessionActiveId = cells.find((c) => c.position === activePosition)?.id ?? cells[0].id;
        applyActiveBrowserView();
        if (cells.length > 1) {
            startHoverActivation();
        }
        else {
            stopHoverActivation();
        }
        win.show();
        win.focus();
        return true;
    }
    async function updateCell(position: number, profileId: string | null): Promise<boolean> {
        if (!sessionLayout && profileId === null)
            return false;
        if (!sessionLayout && profileId) {
            sessionSplitRatio = clampSplitRatio(sessionSplitRatio);
            sessionLayout = {
                type: "single",
                cells: [{ id: profileId, position: 0 }],
                ratio: sessionSplitRatio,
                activePosition: 0,
            };
            sessionActiveId = profileId;
            layoutAllowsMissingViews = false;
            applyActiveBrowserView();
            stopHoverActivation();
            return true;
        }
        if (!sessionLayout)
            return false;
        const config = GRID_CONFIGS[sessionLayout.type];
        const maxPositions = config.rows * config.cols;
        const pos = Math.max(0, Math.min(maxPositions - 1, position));
        let cells = [...sessionLayout.cells].filter((c) => c.position !== pos);
        if (profileId) {
            ensureSessionView(profileId);
            cells.push({ id: profileId, position: pos });
        }
        cells = cells.sort((a, b) => a.position - b.position).slice(0, config.maxViews);
        if (cells.length === 0) {
            sessionLayout = null;
            sessionActiveId = null;
            layoutAllowsMissingViews = false;
            applyActiveBrowserView();
            stopHoverActivation();
            return true;
        }
        const nextActivePosition = cells.some((c) => c.position === (sessionLayout.activePosition ?? pos))
            ? (sessionLayout.activePosition ?? pos)
            : cells[0].position;
        sessionLayout = {
            ...sessionLayout,
            cells,
            activePosition: nextActivePosition,
        };
        sessionActiveId = cells.find((c) => c.position === nextActivePosition)?.id ?? cells[0].id;
        applyActiveBrowserView();
        if (cells.length > 1) {
            startHoverActivation();
        }
        else {
            stopHoverActivation();
        }
        return true;
    }
    async function setSplit(pair: {
        primary: string;
        secondary: string;
        ratio?: number;
    } | null) {
        if (!pair || !pair.primary) {
            return setMultiLayout(null);
        }
        if (pair.primary === pair.secondary) {
            sessionSplitRatio = clampSplitRatio(pair.ratio ?? sessionSplitRatio);
            return setMultiLayout({
                type: "single",
                cells: [{ id: pair.primary, position: 0 }],
                ratio: sessionSplitRatio,
                activePosition: 0,
            });
        }
        return setMultiLayout({
            type: "split-2",
            cells: [
                { id: pair.primary, position: 0 },
                { id: pair.secondary, position: 1 },
            ],
            ratio: pair.ratio ?? sessionSplitRatio,
            activePosition: 0,
        });
    }
    function setSplitRatio(ratio: number) {
        const next = clampSplitRatio(ratio);
        sessionSplitRatio = next;
        if (sessionLayout && sessionLayout.type === "split-2") {
            sessionLayout = { ...sessionLayout, ratio: next };
        }
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
        sessionLayout = null;
        sessionSplitRatio = defaultSplitRatio;
        layoutAllowsMissingViews = false;
        loggedOutProfiles.clear();
        activeBorderCssByView.clear();
        hoverBorderTargetId = null;
        lastLayoutSnapshot = [];
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
    function getLoadedProfileIds(): string[] {
        return Array.from(loadedProfiles);
    }
    function hasLoadedProfile(profileId: string): boolean {
        return loadedProfiles.has(profileId);
    }
    return {
        open,
        openInCell,
        switchTo,
        close,
        setBounds,
        setVisible,
        setActiveGridBorderEnabled,
        setMultiLayout,
        updateCell,
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
        getLoadedProfileIds,
        hasLoadedProfile,
    };
}
export type SessionTabsManager = ReturnType<typeof createSessionTabsManager>;

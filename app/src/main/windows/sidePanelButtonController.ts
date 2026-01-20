import { app, BrowserWindow } from "electron";
import path from "path";
import fs from "fs/promises";
import { logErr } from "../../shared/logger";
import { createOverlayButtonWindow } from "./overlayButtonWindow";

type Bounds = { x: number; y: number; width: number; height: number };

type PositionMap = Record<string, { offsetX: number; offsetY: number }>;

export function createSidePanelButtonController(opts: {
    sessionWindow: { get(): BrowserWindow | null };
    sessionTabs: { getBounds(profileId: string): Bounds; getActiveId?: () => string | null; isActive?: (id: string) => boolean };
    profiles: { getOverlayTargetId(): Promise<string | null> };
    preloadPath?: string;
    pollMs?: number;
    clickThrough?: boolean;
}) {
    const filePath = path.join(app.getPath("userData"), "sidepanel-button.json");
    const pollMs = opts.pollMs ?? 500;
    const size = { width: 36, height: 36 };
    let win: BrowserWindow | null = null;
    let activeProfile: string | null = null;
    let followTimer: NodeJS.Timeout | null = null;
    let posCache: PositionMap = {};
    let lastProfileId: string | null = null;
    let parentListenersAttached = false;
    let onParentMove: (() => void) | null = null;
    let onParentResize: (() => void) | null = null;
    let clickThrough = !!opts.clickThrough;

    function updateButtonProfileId(profileId: string | null) {
        if (!win || win.isDestroyed())
            return;
        const pid = profileId ?? "";
        try {
            void win.webContents.executeJavaScript(`window.__setProfileId && window.__setProfileId(${JSON.stringify(pid)});`);
        }
        catch (err) {
            logErr(err, "SidePanelButton");
        }
    }

    async function loadPositions(): Promise<PositionMap> {
        try {
            const raw = await fs.readFile(filePath, "utf-8");
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
                return parsed as PositionMap;
            }
        } catch {
            // ignore
        }
        return {};
    }

    async function savePositions(): Promise<void> {
        try {
            await fs.writeFile(filePath, JSON.stringify(posCache, null, 2), "utf-8");
        } catch (err) {
            logErr(err, "SidePanelButton");
        }
    }

    function getOffset(profileId: string, view: Bounds): { offsetX: number; offsetY: number } {
        const stored = posCache[profileId];
        if (stored) {
            return clampOffset(stored, view);
        }
        // default: top-right with small margin
        const margin = 8;
        return clampOffset({ offsetX: Math.max(0, view.width - size.width - margin), offsetY: margin }, view);
    }

    function clampOffset(offset: { offsetX: number; offsetY: number }, view: Bounds) {
        const maxX = Math.max(0, view.width - size.width);
        const maxY = Math.max(0, view.height - size.height);
        return {
            offsetX: Math.min(maxX, Math.max(0, offset.offsetX)),
            offsetY: Math.min(maxY, Math.max(0, offset.offsetY)),
        };
    }

    function applyClickThrough(target?: BrowserWindow | null): void {
        const wnd = target ?? win;
        if (!wnd || wnd.isDestroyed()) return;
        try {
            wnd.setIgnoreMouseEvents(clickThrough, { forward: true });
            if (typeof wnd.setFocusable === "function") {
                wnd.setFocusable(!clickThrough);
            }
            if (clickThrough && wnd.isFocused()) {
                opts.sessionWindow.get()?.focus();
            }
            void wnd.webContents.executeJavaScript(
                clickThrough
                    ? "document.body && document.body.classList.add('ct-none');"
                    : "document.body && document.body.classList.remove('ct-none');",
            );
        } catch (err) {
            logErr(err, "SidePanelButton");
        }
    }

    function ensureWindow(parent: BrowserWindow | null): BrowserWindow | null {
        if (win && !win.isDestroyed()) return win;
        if (!parent) return null;

        win = createOverlayButtonWindow({
            parent,
            preloadPath: opts.preloadPath,
            profileId: activeProfile,
            clickThrough,
            onToggle: () => {
                parent.webContents.send("sidepanel:toggle", {
                    focusTab: "roi",
                    profileId: activeProfile || undefined,
                });
            },
            focusable: !clickThrough,
        });

        win.on("move", () => persistPosition());
        win.on("closed", () => {
            win = null;
            detachParentListeners();
        });

        applyClickThrough(win);

        // Attach parent listeners for immediate position updates
        attachParentListeners(parent);

        return win;
    }

    function attachParentListeners(parent: BrowserWindow): void {
        if (parentListenersAttached) return;

        onParentMove = () => {
            if (activeProfile && win && !win.isDestroyed()) {
                moveToProfile(activeProfile);
            }
        };
        onParentResize = () => {
            if (activeProfile && win && !win.isDestroyed()) {
                moveToProfile(activeProfile);
            }
        };

        parent.on("move", onParentMove);
        parent.on("resize", onParentResize);
        parentListenersAttached = true;
    }

    function detachParentListeners(): void {
        if (!parentListenersAttached) return;
        const parent = opts.sessionWindow.get();
        if (parent && !parent.isDestroyed()) {
            if (onParentMove) parent.off("move", onParentMove);
            if (onParentResize) parent.off("resize", onParentResize);
        }
        onParentMove = null;
        onParentResize = null;
        parentListenersAttached = false;
    }


    function persistPosition() {
        if (!win || !activeProfile) return;
        const parent = opts.sessionWindow.get();
        if (!parent) return;
        const view = opts.sessionTabs.getBounds(activeProfile);
        const content = parent.getContentBounds();
        const wb = win.getBounds();
        const baseX = content.x + view.x;
        const baseY = content.y + view.y;
        const offsetX = wb.x - baseX;
        const offsetY = wb.y - baseY;
        posCache[activeProfile] = clampOffset({ offsetX, offsetY }, view);
        void savePositions();
    }

    function moveToProfile(profileId: string): void {
        const parent = opts.sessionWindow.get();
        if (!parent) return;
        const view = opts.sessionTabs.getBounds(profileId);
        const offset = getOffset(profileId, view);
        const content = parent.getContentBounds();
        const x = Math.round(content.x + view.x + offset.offsetX);
        const y = Math.round(content.y + view.y + offset.offsetY);
        const wnd = ensureWindow(parent);
        if (!wnd) return;
        try {
            wnd.setBounds({ x, y, width: size.width, height: size.height });
            wnd.showInactive();
            updateButtonProfileId(profileId);
        } catch (err) {
            logErr(err, "SidePanelButton");
        }
    }

    async function tick(): Promise<void> {
        const overlayTargetId = await opts.profiles.getOverlayTargetId();
        const activeId = opts.sessionTabs.getActiveId?.() ?? null;
        const isActiveTarget = Boolean(
            overlayTargetId &&
            activeId &&
            activeId === overlayTargetId &&
            (typeof opts.sessionTabs.isActive !== "function" || opts.sessionTabs.isActive(overlayTargetId))
        );
        if (!isActiveTarget) {
            activeProfile = null;
            lastProfileId = null;
            if (win && !win.isDestroyed()) {
                win.hide();
            }
            return;
        }
        activeProfile = overlayTargetId;
        lastProfileId = overlayTargetId;
        moveToProfile(overlayTargetId);
    }

    async function start(): Promise<void> {
        posCache = await loadPositions();
        if (followTimer) return;
        await tick();
        followTimer = setInterval(() => {
            void tick();
        }, pollMs);
    }

    async function stop(): Promise<void> {
        if (followTimer) clearInterval(followTimer);
        followTimer = null;
        if (win && !win.isDestroyed()) {
            win.hide();
        }
    }

    function destroy(): void {
        if (followTimer) clearInterval(followTimer);
        followTimer = null;
        detachParentListeners();
        if (win && !win.isDestroyed()) {
            win.destroy();
        }
        win = null;
    }

    function getActiveProfileId(): string | null {
        return activeProfile ?? lastProfileId;
    }

    function hide(): void {
        if (win && !win.isDestroyed() && win.isVisible()) {
            win.hide();
        }
    }

    function show(): void {
        if (win && !win.isDestroyed() && activeProfile) {
            win.showInactive();
        }
    }

    function isVisible(): boolean {
        return win !== null && !win.isDestroyed() && win.isVisible();
    }

    function setClickThrough(next: boolean): void {
        clickThrough = !!next;
        applyClickThrough();
    }

    return { start, stop, destroy, getActiveProfileId, hide, show, isVisible, setClickThrough };
}

import { ipcMain, app } from "electron";
import fs from "fs/promises";
import path from "path";
import https from "https";
type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
type ProfilesStore = {
    list: () => Promise<any[]>;
    create: (name: string) => Promise<any[]>;
    update: (patch: any) => Promise<any[]>;
    delete: (profileId: string) => Promise<any[]>;
    clone: (profileId: string, newName: string) => Promise<any[]>;
    reorder: (orderedIds: string[]) => Promise<any[]>;
    getOverlayTargetId: () => Promise<string | null>;
    setOverlayTarget: (profileId: string | null, iconKey?: string) => Promise<any[]>;
    getOverlaySettings: (profileId: string) => Promise<any>;
    patchOverlaySettings: (profileId: string, patch: any) => Promise<any>;
};
type SessionWindowController = {
    ensure: () => Promise<any>;
    get: () => any | null;
    allowCloseWithoutPrompt: () => void;
    closeWithoutPrompt: () => void;
};
type SessionTabsManager = {
    open: (profileId: string) => Promise<void> | void;
    switchTo: (profileId: string) => Promise<void> | void;
    login: (profileId: string) => Promise<void> | void;
    logout: (profileId: string) => Promise<void> | void;
    close: (profileId: string) => Promise<void> | void;
    setBounds: (bounds: Rect) => void;
    setVisible: (visible: boolean) => void;
    setSplit: (pair: {
        primary: string;
        secondary: string;
        ratio?: number;
    } | null) => Promise<void> | void;
    setSplitRatio: (ratio: number) => Promise<void> | void;
    reset: () => void;
};
type TabLayoutsStore = {
    list: () => Promise<any[]>;
    get: (layoutId: string) => Promise<any | null>;
    save: (input: any) => Promise<any[]>;
    delete: (layoutId: string) => Promise<any[]>;
};
type ThemeStore = {
    list: () => Promise<any[]>;
    save: (input: any) => Promise<any[]>;
    delete: (id: string) => Promise<any[]>;
};
export function registerMainIpc(opts: {
    profiles: ProfilesStore;
    sessionTabs: SessionTabsManager;
    sessionWindow: SessionWindowController;
    tabLayouts: TabLayoutsStore;
    themes: ThemeStore;
    loadView?: any;
    createInstanceWindow: (profileId: string) => void;
    overlayTargetRefresh?: () => Promise<any> | any;
    roiOpen: (profileId: string) => Promise<boolean>;
    roiLoad: (profileId: string) => Promise<any>;
    roiSave: (profileId: string, rois: any) => Promise<boolean>;
}) {
    const logErr = (err: unknown) => console.error("[IPC]", err);
    const themeSnapshotPath = path.join(app.getPath("userData"), "themeSnapshot.json");
    const tabActiveColorPath = path.join(app.getPath("userData"), "tabActiveColor.json");
    async function loadTabActiveColorFromFile(): Promise<string | null> {
        try {
            const raw = await fs.readFile(tabActiveColorPath, "utf-8");
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.color === "string" && parsed.color.trim()) {
                return parsed.color;
            }
        }
        catch (err) {
            if (err && typeof err === "object" && "code" in err && (err as any).code === "ENOENT") {
                return null;
            }
            logErr(err);
        }
        return null;
    }
    async function saveTabActiveColorToFile(color: string | null) {
        if (!color) {
            try {
                await fs.unlink(tabActiveColorPath);
            }
            catch (err) {
                if (!(err && typeof err === "object" && "code" in err && (err as any).code === "ENOENT")) {
                    logErr(err);
                }
            }
            return;
        }
        try {
            await fs.mkdir(path.dirname(tabActiveColorPath), { recursive: true });
            await fs.writeFile(tabActiveColorPath, JSON.stringify({ color }, null, 2), "utf-8");
        }
        catch (err) {
            logErr(err);
        }
    }
    let themeSnapshot: any = null;
    async function loadThemeSnapshot() {
        try {
            const raw = await fs.readFile(themeSnapshotPath, "utf-8");
            return JSON.parse(raw);
        }
        catch (err) {
            if (err && typeof err === "object" && "code" in err && (err as any).code !== "ENOENT") {
                logErr(err);
            }
            return null;
        }
    }
    async function persistThemeSnapshot(snapshot: any) {
        try {
            await fs.mkdir(path.dirname(themeSnapshotPath), { recursive: true });
            await fs.writeFile(themeSnapshotPath, JSON.stringify(snapshot, null, 2), "utf-8");
        }
        catch (err) {
            logErr(err);
        }
    }
    loadThemeSnapshot().then((snap) => {
        if (snap)
            themeSnapshot = snap;
    }).catch(logErr);
    function safeHandle(channel: string, handler: any) {
        try {
            ipcMain.removeHandler(channel);
        }
        catch (err) {
            logErr(err);
        }
        ipcMain.handle(channel, handler);
    }
    safeHandle("profiles:list", async () => await opts.profiles.list());
    safeHandle("profiles:create", async (_e, name: string) => await opts.profiles.create(name));
    safeHandle("profiles:update", async (_e, patch: any) => await opts.profiles.update(patch));
    safeHandle("profiles:delete", async (_e, profileId: string) => await opts.profiles.delete(profileId));
    safeHandle("profiles:clone", async (_e, profileId: string, newName: string) => await opts.profiles.clone(profileId, newName));
    safeHandle("profiles:reorder", async (_e, orderedIds: string[]) => await opts.profiles.reorder(orderedIds));
    safeHandle("profiles:getOverlayTargetId", async () => {
        return await opts.profiles.getOverlayTargetId();
    });
    safeHandle("profiles:setOverlayTarget", async (_e, profileId: string | null, iconKey?: string) => {
        const next = await opts.profiles.setOverlayTarget(profileId, iconKey);
        try {
            await opts.overlayTargetRefresh?.();
        }
        catch (err) {
            console.error("[IPC] overlayTargetRefresh failed:", err);
        }
        return next;
    });
    safeHandle("overlaySettings:get", async (_e, profileId: string) => {
        return await opts.profiles.getOverlaySettings(profileId);
    });
    safeHandle("overlaySettings:patch", async (_e, profileId: string, patch: any) => {
        const next = await opts.profiles.patchOverlaySettings(profileId, patch);
        try {
            await opts.overlayTargetRefresh?.();
        }
        catch (err) {
            logErr(err);
        }
        return next;
    });
    safeHandle("session:openTab", async (_e, profileId: string) => {
        const win = await opts.sessionWindow.ensure();
        win.show();
        win.focus();
        await opts.sessionTabs.open(profileId);
        try {
            win.webContents.send("session:openTab", profileId);
        }
        catch (err) {
            logErr(err);
        }
        return true;
    });
    safeHandle("instance:openWindow", async (_e, profileId: string) => {
        opts.createInstanceWindow(profileId);
        return true;
    });
    safeHandle("sessionTabs:open", async (_e, profileId: string) => {
        await opts.sessionTabs.open(profileId);
        return true;
    });
    safeHandle("sessionTabs:switch", async (_e, profileId: string) => {
        await opts.sessionTabs.switchTo(profileId);
        return true;
    });
    safeHandle("sessionTabs:logout", async (_e, profileId: string) => {
        await opts.sessionTabs.logout(profileId);
        return true;
    });
    safeHandle("sessionTabs:login", async (_e, profileId: string) => {
        await opts.sessionTabs.login(profileId);
        return true;
    });
    safeHandle("sessionTabs:close", async (_e, profileId: string) => {
        await opts.sessionTabs.close(profileId);
        return true;
    });
    safeHandle("sessionTabs:setBounds", async (_e, bounds: Rect) => {
        opts.sessionTabs.setBounds(bounds);
        return true;
    });
    safeHandle("sessionTabs:setVisible", async (_e, visible: boolean) => {
        opts.sessionTabs.setVisible(visible);
        return true;
    });
    safeHandle("sessionTabs:setSplit", async (_e, pair: {
        primary: string;
        secondary: string;
        ratio?: number;
    } | null) => {
        await opts.sessionTabs.setSplit(pair);
        return true;
    });
    safeHandle("sessionTabs:setSplitRatio", async (_e, ratio: number) => {
        await opts.sessionTabs.setSplitRatio(ratio);
        return true;
    });
    safeHandle("sessionTabs:reset", async () => {
        opts.sessionTabs.reset();
        return true;
    });
    safeHandle("sessionWindow:close", async () => {
        opts.sessionWindow.closeWithoutPrompt();
        return true;
    });
    safeHandle("app:quit", async () => {
        opts.sessionWindow.allowCloseWithoutPrompt();
        app.quit();
        return true;
    });
    safeHandle("tabLayouts:list", async () => await opts.tabLayouts.list());
    safeHandle("tabLayouts:get", async (_e, layoutId: string) => await opts.tabLayouts.get(layoutId));
    safeHandle("tabLayouts:save", async (_e, input: any) => await opts.tabLayouts.save(input));
    safeHandle("tabLayouts:delete", async (_e, layoutId: string) => await opts.tabLayouts.delete(layoutId));
    safeHandle("tabLayouts:apply", async (_e, layoutId: string) => {
        const layout = await opts.tabLayouts.get(layoutId);
        if (!layout)
            throw new Error("layout not found");
        const win = await opts.sessionWindow.ensure();
        try {
            win.show();
            win.focus();
            win.webContents.send("session:applyLayout", layout);
        }
        catch (err) {
            logErr(err);
        }
        return true;
    });
    safeHandle("themes:list", async () => await opts.themes.list());
    safeHandle("themes:save", async (_e, input: any) => await opts.themes.save(input));
    safeHandle("themes:delete", async (_e, id: string) => await opts.themes.delete(id));
    safeHandle("tabActiveColor:load", async () => await loadTabActiveColorFromFile());
    safeHandle("tabActiveColor:save", async (_e, color: string | null) => {
        await saveTabActiveColorToFile(color);
        return true;
    });
    safeHandle("theme:push", async (_e, payload: any) => {
        const merged: any = {
            ...(themeSnapshot ?? {}),
            ...(payload ?? {}),
        };
        if (themeSnapshot?.colors || payload?.colors) {
            merged.colors = { ...(themeSnapshot?.colors ?? {}), ...(payload?.colors ?? {}) };
        }
        themeSnapshot = merged;
        persistThemeSnapshot(merged).catch(logErr);
        try {
            const { BrowserWindow } = await import("electron");
            for (const w of BrowserWindow.getAllWindows()) {
                if (!w.isDestroyed()) {
                    w.webContents.send("theme:update", merged);
                }
            }
        }
        catch (err) {
            logErr(err);
        }
        return true;
    });
    safeHandle("theme:current", async () => {
        if (themeSnapshot === null) {
            themeSnapshot = await loadThemeSnapshot();
        }
        return themeSnapshot;
    });
    async function fetchWithFallback(url: string) {
        const headers = { "User-Agent": "FlyffU-Launcher" };
        try {
            if (typeof fetch === "function") {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 10000);
                const res = await fetch(url, { headers, signal: controller.signal });
                clearTimeout(timer);
                if (!res.ok) {
                    throw new Error(`status ${res.status}`);
                }
                return await res.text();
            }
        }
        catch (err) {
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
            req.setTimeout(10000, () => req.destroy(new Error("timeout")));
        });
    }
    safeHandle("news:fetch", async (_e, path?: string) => {
        let url = "https://universe.flyff.com/news";
        if (path) {
            try {
                const parsed = new URL(path, "https://universe.flyff.com");
                if (parsed.hostname !== "universe.flyff.com")
                    throw new Error("invalid news host");
                if (!parsed.pathname.startsWith("/news"))
                    throw new Error("invalid news path");
                url = parsed.toString();
            }
            catch (err) {
                throw new Error(err instanceof Error ? err.message : "invalid news url");
            }
        }
        return await fetchWithFallback(url);
    });
    safeHandle("news:fetchArticle", async (_e, rawUrl: string) => {
        if (!rawUrl || typeof rawUrl !== "string")
            throw new Error("invalid url");
        let target: URL;
        try {
            target = new URL(rawUrl, "https://universe.flyff.com");
        }
        catch {
            throw new Error("invalid url");
        }
        if (target.hostname !== "universe.flyff.com") {
            throw new Error("blocked host");
        }
        if (!target.pathname.startsWith("/news")) {
            throw new Error("blocked path");
        }
        return await fetchWithFallback(target.toString());
    });
    safeHandle("roi:open", async (_e, arg) => {
        const profileId = typeof arg === "string" ? arg : arg?.profileId;
        if (!profileId)
            throw new Error("roi:open: missing profileId");
        return await opts.roiOpen(profileId);
    });
    safeHandle("roi:load", async (_e, profileId: string) => {
        return await opts.roiLoad(profileId);
    });
    safeHandle("roi:save", async (_e, a: any, b?: any) => {
        let profileId: string;
        let rois: any;
        if (a && typeof a === "object" && typeof a.profileId === "string" && a.rois && b === undefined) {
            profileId = a.profileId;
            rois = a.rois;
        }
        else {
            profileId = a as string;
            rois = b;
        }
        const actual = rois?.rois ?? rois;
        if (!actual?.nameLevel || !actual?.expPercent) {
            throw new Error(`[ROI SAVE] invalid payload for ${profileId}: ${JSON.stringify(rois)}`);
        }
        return await opts.roiSave(profileId, actual);
    });
}

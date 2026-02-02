import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerLayoutHandlers } from "./layouts";
import { ValidationError, NotFoundError, type SafeHandle, type IpcEvent } from "../common";
import type { TabLayout } from "../../../shared/schemas";

// Mock electron module
vi.mock("electron", () => ({
    BrowserWindow: {
        getAllWindows: vi.fn().mockReturnValue([]),
    },
}));

type Handler = (...args: unknown[]) => unknown;

function createSafeHandle(registry: Map<string, Handler>): SafeHandle {
    return ((channel: string, handler: (...args: unknown[]) => unknown) => {
        registry.set(channel, handler as Handler);
    }) as SafeHandle;
}

describe("Layout IPC handlers", () => {
    let handlers: Map<string, Handler>;
    let tabLayouts: {
        list: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
        save: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
    };
    let sessionWindow: {
        ensure: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
        closeWithoutPrompt: ReturnType<typeof vi.fn>;
        isNew: ReturnType<typeof vi.fn>;
    };
    let sessionTabs: {
        hasLoadedProfile: ReturnType<typeof vi.fn>;
        getLoadedProfileIds: ReturnType<typeof vi.fn>;
        reset: ReturnType<typeof vi.fn>;
    };
    let showToast: ReturnType<typeof vi.fn>;
    const win = {
        show: vi.fn(),
        focus: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: {
            send: vi.fn(),
            isLoading: vi.fn().mockReturnValue(false),
        },
    };
    const logErr = vi.fn();

    beforeEach(() => {
        handlers = new Map();
        logErr.mockReset();
        Object.values(win).forEach((fn) => typeof fn === "function" && fn.mockReset?.());
        win.webContents.send.mockReset();
        win.webContents.isLoading.mockReset();
        win.webContents.isLoading.mockReturnValue(false);

        tabLayouts = {
            list: vi.fn().mockResolvedValue([]),
            get: vi.fn().mockResolvedValue(null),
            save: vi.fn().mockResolvedValue([]),
            delete: vi.fn().mockResolvedValue([]),
        };
        sessionWindow = {
            ensure: vi.fn().mockResolvedValue(win),
            get: vi.fn().mockReturnValue(null),
            closeWithoutPrompt: vi.fn(),
            isNew: vi.fn().mockReturnValue(false),
        };
        sessionTabs = {
            hasLoadedProfile: vi.fn().mockReturnValue(false),
            getLoadedProfileIds: vi.fn().mockReturnValue([]),
            reset: vi.fn(),
        };
        showToast = vi.fn();

        const safeHandle = createSafeHandle(handlers);
        registerLayoutHandlers(
            safeHandle,
            { tabLayouts, sessionWindow, sessionTabs, showToast },
            logErr,
        );
    });

    function handler(channel: string): Handler {
        const h = handlers.get(channel);
        if (!h) throw new Error(`missing handler ${channel}`);
        return h;
    }

    it("wirft NotFoundError wenn Layout fehlt", async () => {
        const apply = handler("tabLayouts:apply");
        tabLayouts.get.mockResolvedValueOnce(null);

        await expect(apply({} as IpcEvent, "missing")).rejects.toBeInstanceOf(NotFoundError);
    });

    it("wendet Layout an und sendet Event", async () => {
        const apply = handler("tabLayouts:apply");
        const layout: TabLayout = {
            id: "layout-1",
            name: "Test",
            createdAt: "2024-01-01",
            updatedAt: "2024-01-02",
            tabs: ["a", "b"],
            split: null,
            activeId: "a",
            loggedOutChars: [],
        };
        tabLayouts.get.mockResolvedValueOnce(layout);

        await expect(apply({} as IpcEvent, layout.id)).resolves.toBe(true);

        expect(sessionWindow.ensure).toHaveBeenCalled();
        expect(win.webContents.send).toHaveBeenCalledWith("session:applyLayout", layout);
    });

    it("validiert Eingaben für save", async () => {
        const save = handler("tabLayouts:save");

        await expect(save({} as IpcEvent, { name: "" })).rejects.toBeInstanceOf(ValidationError);

        const valid = { name: "My Layout", tabs: ["one"] };
        await expect(save({} as IpcEvent, valid)).resolves.toEqual([]);
        expect(tabLayouts.save).toHaveBeenCalled();
    });

    it("zeigt Toast wenn Profil bereits online ist", async () => {
        const apply = handler("tabLayouts:apply");
        const layout: TabLayout = {
            id: "layout-1",
            name: "Test",
            createdAt: "2024-01-01",
            updatedAt: "2024-01-02",
            tabs: ["a", "b"],
            split: null,
            activeId: "a",
            loggedOutChars: [],
        };
        tabLayouts.get.mockResolvedValueOnce(layout);
        // Profile "a" is already online
        sessionTabs.hasLoadedProfile.mockImplementation((id: string) => id === "a");

        await expect(apply({} as IpcEvent, layout.id)).resolves.toBe(false);

        expect(showToast).toHaveBeenCalledWith(
            expect.stringContaining("a"),
            "error"
        );
        expect(sessionWindow.ensure).not.toHaveBeenCalled();
    });

    it("schließt bestehendes Fenster vor Layout-Anwendung", async () => {
        const apply = handler("tabLayouts:apply");
        const layout: TabLayout = {
            id: "layout-1",
            name: "Test",
            createdAt: "2024-01-01",
            updatedAt: "2024-01-02",
            tabs: ["c", "d"],
            split: null,
            activeId: "c",
            loggedOutChars: [],
        };
        tabLayouts.get.mockResolvedValueOnce(layout);
        // No profiles online
        sessionTabs.hasLoadedProfile.mockReturnValue(false);
        // But existing window exists
        const existingWin = { isDestroyed: vi.fn().mockReturnValue(false) };
        sessionWindow.get.mockReturnValue(existingWin);

        await expect(apply({} as IpcEvent, layout.id)).resolves.toBe(true);

        expect(sessionTabs.reset).toHaveBeenCalled();
        expect(sessionWindow.closeWithoutPrompt).toHaveBeenCalled();
        expect(sessionWindow.ensure).toHaveBeenCalled();
    });
});

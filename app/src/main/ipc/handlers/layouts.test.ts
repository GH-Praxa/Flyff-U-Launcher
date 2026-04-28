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
    let sessionRegistry: {
        list: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
        setInitialProfileId: ReturnType<typeof vi.fn>;
    };
    let createTabWindow: ReturnType<typeof vi.fn>;
    let showToast: ReturnType<typeof vi.fn>;
    const win = {
        show: vi.fn(),
        focus: vi.fn(),
        setTitle: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        once: vi.fn(),
        webContents: {
            id: 42,
            send: vi.fn(),
            isLoading: vi.fn().mockReturnValue(false),
            once: vi.fn(),
            off: vi.fn(),
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
        win.webContents.once.mockReset();
        win.webContents.off.mockReset();
        win.once.mockReset();
        win.show.mockReset();
        win.focus.mockReset();
        win.setTitle.mockReset();
        win.isDestroyed.mockReset();
        win.isDestroyed.mockReturnValue(false);

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
        sessionRegistry = {
            list: vi.fn().mockReturnValue([]),
            get: vi.fn().mockReturnValue({
                id: "session-1",
                name: undefined,
                createdAt: new Date().toISOString(),
                window: win,
                tabsManager: { getLoadedProfileIds: (): string[] => [] },
                initialProfileId: undefined,
            }),
            setInitialProfileId: vi.fn().mockReturnValue(true),
        };
        createTabWindow = vi.fn().mockResolvedValue("session-1");
        showToast = vi.fn();

        const safeHandle = createSafeHandle(handlers);
        registerLayoutHandlers(
            safeHandle,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { tabLayouts, sessionWindow, sessionTabs, sessionRegistry, createTabWindow, showToast } as any,
            logErr as any,
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

    it("öffnet ein neues Fenster mit layoutId-Param und legt Pending ab", async () => {
        const apply = handler("tabLayouts:apply");
        const pending = handler("tabLayouts:pending");
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

        expect(createTabWindow).toHaveBeenCalledWith({
            name: "Test",
            params: { layoutId: layout.id },
        });
        expect(sessionRegistry.setInitialProfileId).toHaveBeenCalledWith("session-1", "a");
        expect(win.setTitle).toHaveBeenCalledWith("Test");

        // Renderer of the new window polls tabLayouts:pending → gets the layout once.
        const fakeEvent = { sender: { id: 42 } } as unknown as IpcEvent;
        await expect(pending(fakeEvent)).resolves.toEqual(layout);
        // Second poll returns null (already consumed).
        await expect(pending(fakeEvent)).resolves.toBeNull();
    });

    it("validiert Eingaben für save", async () => {
        const save = handler("tabLayouts:save");

        await expect(save({} as IpcEvent, { name: "" })).rejects.toBeInstanceOf(ValidationError);

        const valid = { name: "My Layout", tabs: ["one"] };
        await expect(save({} as IpcEvent, valid)).resolves.toEqual([]);
        expect(tabLayouts.save).toHaveBeenCalled();
    });

    it("öffnet das Layout-Fenster auch wenn ein Profil bereits anderswo online ist", async () => {
        // Conflict handling moved to renderer (DOM overlay over the cell);
        // the handler must NOT abort or jump to the other window anymore.
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
        sessionTabs.getLoadedProfileIds.mockReturnValue(["a"]);
        sessionTabs.hasLoadedProfile.mockImplementation((id: string) => id === "a");

        await expect(apply({} as IpcEvent, layout.id)).resolves.toBe(true);

        expect(createTabWindow).toHaveBeenCalledWith({
            name: "Test",
            params: { layoutId: layout.id },
        });
    });

    it("öffnet das Layout auch wenn ein Profil in einem Multi-Window offen ist", async () => {
        // Conflict cells are flagged by the renderer (which overlays a "jump"
        // button); the apply handler always opens a new window.
        const apply = handler("tabLayouts:apply");
        const layout: TabLayout = {
            id: "layout-1",
            name: "Test",
            createdAt: "2024-01-01",
            updatedAt: "2024-01-02",
            tabs: ["c"],
            split: null,
            activeId: "c",
            loggedOutChars: [],
        };
        tabLayouts.get.mockResolvedValueOnce(layout);
        sessionRegistry.list.mockReturnValue([
            {
                id: "session-existing",
                name: "Other Layout",
                tabsManager: { getLoadedProfileIds: (): string[] => ["c"] },
                window: win,
                createdAt: "",
                initialProfileId: undefined,
            },
        ]);

        await expect(apply({} as IpcEvent, layout.id)).resolves.toBe(true);

        expect(createTabWindow).toHaveBeenCalled();
    });

    it("schließt bestehende Fenster NICHT — multi-window add-only", async () => {
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
        const existingWin = { isDestroyed: vi.fn().mockReturnValue(false) };
        sessionWindow.get.mockReturnValue(existingWin);

        await expect(apply({} as IpcEvent, layout.id)).resolves.toBe(true);

        expect(sessionTabs.reset).not.toHaveBeenCalled();
        expect(sessionWindow.closeWithoutPrompt).not.toHaveBeenCalled();
        expect(createTabWindow).toHaveBeenCalled();
    });

    it("dedupliziert parallele Apply-Calls für dieselbe layoutId", async () => {
        const apply = handler("tabLayouts:apply");
        const layout: TabLayout = {
            id: "layout-1",
            name: "Test",
            createdAt: "2024-01-01",
            updatedAt: "2024-01-02",
            tabs: ["a"],
            split: null,
            activeId: "a",
            loggedOutChars: [],
        };
        tabLayouts.get.mockResolvedValue(layout);

        // Slow down createTabWindow so the two calls overlap.
        let resolveCreate: (id: string) => void;
        createTabWindow.mockImplementationOnce(
            () => new Promise<string>((r) => { resolveCreate = r; })
        );

        const first = apply({} as IpcEvent, layout.id);
        const second = await apply({} as IpcEvent, layout.id);

        // Second call returns false (deduped) without creating another window.
        expect(second).toBe(false);
        expect(createTabWindow).toHaveBeenCalledTimes(1);

        resolveCreate!("session-1");
        await first;
    });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerSessionHandlers } from "./sessions";
import { ValidationError, type SafeHandle, type IpcEvent } from "../common";

vi.mock("electron", () => {
    const app = {
        quit: vi.fn(),
        getVersion: vi.fn().mockReturnValue("9.9.9"),
        commandLine: { appendSwitch: vi.fn() },
    };
    return {
        app,
        BrowserWindow: vi.fn(),
    };
});
import { app as electronApp } from "electron";

type Handler = (...args: unknown[]) => unknown;

function createSafeHandle(registry: Map<string, Handler>): SafeHandle {
    return ((channel: string, handler: (...args: unknown[]) => unknown) => {
        registry.set(channel, handler as Handler);
    }) as SafeHandle;
}

describe("Session IPC handlers", () => {
    let handlers: Map<string, Handler>;
    let sessionWindow: {
        ensure: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
        allowCloseWithoutPrompt: ReturnType<typeof vi.fn>;
        closeWithoutPrompt: ReturnType<typeof vi.fn>;
        isNew: ReturnType<typeof vi.fn>;
    };
    let sessionTabs: {
        open: ReturnType<typeof vi.fn>;
        switchTo: ReturnType<typeof vi.fn>;
        login: ReturnType<typeof vi.fn>;
        logout: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
        setBounds: ReturnType<typeof vi.fn>;
        setVisible: ReturnType<typeof vi.fn>;
        setSplit: ReturnType<typeof vi.fn>;
        setSplitRatio: ReturnType<typeof vi.fn>;
        reset: ReturnType<typeof vi.fn>;
    };
    let sessionRegistry: {
        list: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
        getWindow: ReturnType<typeof vi.fn>;
        getTabsManager: ReturnType<typeof vi.fn>;
        listMetadata: ReturnType<typeof vi.fn>;
        rename: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
        getFirst: ReturnType<typeof vi.fn>;
        has: ReturnType<typeof vi.fn>;
        setInitialProfileId: ReturnType<typeof vi.fn>;
        getInitialProfileId: ReturnType<typeof vi.fn>;
        updateWindowTitle: ReturnType<typeof vi.fn>;
    };
    let profiles: { list: ReturnType<typeof vi.fn> };
    let createInstanceWindow: ReturnType<typeof vi.fn>;
    let createTabWindow: ReturnType<typeof vi.fn>;
    const win = {
        show: vi.fn(),
        focus: vi.fn(),
        webContents: { send: vi.fn() },
    };
    const logErr = vi.fn();

    beforeEach(() => {
        handlers = new Map();
        logErr.mockReset();
        Object.values(win).forEach((fn) => typeof fn === "function" && fn.mockReset?.());
        win.webContents.send.mockReset();

        sessionWindow = {
            ensure: vi.fn().mockResolvedValue(win),
            get: vi.fn().mockReturnValue(win),
            allowCloseWithoutPrompt: vi.fn(),
            closeWithoutPrompt: vi.fn(),
            isNew: vi.fn().mockReturnValue(false),
        };

        sessionTabs = {
            open: vi.fn().mockResolvedValue(true),
            switchTo: vi.fn(),
            login: vi.fn(),
            logout: vi.fn(),
            close: vi.fn(),
            setBounds: vi.fn(),
            setVisible: vi.fn(),
            setSplit: vi.fn(),
            setSplitRatio: vi.fn(),
            reset: vi.fn(),
        };

        profiles = {
            list: vi.fn().mockResolvedValue([]),
        };

        sessionRegistry = {
            list: vi.fn().mockReturnValue([]),
            get: vi.fn().mockReturnValue(null),
            getWindow: vi.fn().mockReturnValue(null),
            getTabsManager: vi.fn().mockReturnValue(null),
            listMetadata: vi.fn().mockReturnValue([]),
            rename: vi.fn().mockReturnValue(true),
            close: vi.fn().mockReturnValue(true),
            getFirst: vi.fn().mockReturnValue(null),
            has: vi.fn().mockReturnValue(false),
        setInitialProfileId: vi.fn(),
        getInitialProfileId: vi.fn().mockReturnValue(undefined),
        updateWindowTitle: vi.fn().mockReturnValue(true),
    };

    const getLocale = vi.fn().mockResolvedValue("en");

        createInstanceWindow = vi.fn().mockResolvedValue(undefined);
        createTabWindow = vi.fn().mockResolvedValue("session-123");

        const safeHandle = createSafeHandle(handlers);
        registerSessionHandlers(
            safeHandle,
            { sessionTabs, sessionWindow, sessionRegistry, profiles, createInstanceWindow, createTabWindow, getLocale },
            logErr,
        );
    });

    function handler(channel: string): Handler {
        const h = handlers.get(channel);
        if (!h) throw new Error(`missing handler ${channel}`);
        return h;
    }

    it("oeffnet Tab und sendet IPC an Renderer", async () => {
        const openTab = handler("session:openTab");

        await expect(openTab({} as IpcEvent, "profile-1")).resolves.toBe(true);

        expect(sessionWindow.ensure).toHaveBeenCalled();
        expect(sessionTabs.open).toHaveBeenCalledWith("profile-1");
        expect(win.webContents.send).toHaveBeenCalledWith("session:openTab", "profile-1");
    });

    it("wirft ValidationError bei ungueltiger ID", async () => {
        const openTab = handler("session:openTab");

        await expect(openTab({} as IpcEvent, "")).rejects.toBeInstanceOf(ValidationError);
    });

    it("validiert Split-Payload", async () => {
        const setSplit = handler("sessionTabs:setSplit");

        await expect(setSplit({} as IpcEvent, { primary: "a", secondary: "b", ratio: 2 })).rejects.toBeInstanceOf(ValidationError);
    });

    it("schliesst Session-Window ohne Prompt (Legacy)", async () => {
        const close = handler("sessionWindow:close");

        await expect(close({} as IpcEvent)).resolves.toBe(true);
        expect(sessionWindow.closeWithoutPrompt).toHaveBeenCalled();
    });

    it("schliesst aktuelles Multi-Window ohne Prompt", async () => {
        const secondaryWin: any = {
            webContents: {},
            close: vi.fn(),
            isDestroyed: vi.fn().mockReturnValue(false),
            __allowCloseWithoutPrompt: vi.fn(),
        };
        sessionRegistry.list.mockReturnValue([
            {
                id: "session-99",
                name: undefined,
                createdAt: "",
                window: secondaryWin,
                tabsManager: {} as any,
                initialProfileId: undefined,
            },
        ]);

        const close = handler("sessionWindow:close");

        await expect(close({ sender: secondaryWin.webContents } as unknown as IpcEvent)).resolves.toBe(true);

        expect(secondaryWin.__allowCloseWithoutPrompt).toHaveBeenCalled();
        expect(secondaryWin.close).toHaveBeenCalled();
        expect(sessionWindow.closeWithoutPrompt).not.toHaveBeenCalled();
    });

    it("ruft app.quit ueber IPC auf und umgeht alle Prompts", async () => {
        const quit = handler("app:quit");
        const secondaryWin: any = {
            isDestroyed: vi.fn().mockReturnValue(false),
            __allowCloseWithoutPrompt: vi.fn(),
        };
        sessionRegistry.list.mockReturnValue([
            {
                id: "session-2",
                name: undefined,
                createdAt: "",
                window: secondaryWin,
                tabsManager: {} as any,
                initialProfileId: undefined,
            },
        ]);

        await expect(quit({} as IpcEvent)).resolves.toBe(true);
        expect(sessionWindow.allowCloseWithoutPrompt).toHaveBeenCalled();
        expect(secondaryWin.__allowCloseWithoutPrompt).toHaveBeenCalled();
        expect(electronApp.quit).toHaveBeenCalled();
    });

    it("liefert die aktuelle App-Version ueber IPC", async () => {
        const getVersion = handler("app:getVersion");

        await expect(getVersion({} as IpcEvent)).resolves.toBe("9.9.9");
        expect(electronApp.getVersion).toHaveBeenCalled();
    });
});

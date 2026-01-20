import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerLayoutHandlers } from "./layouts";
import { ValidationError, NotFoundError, type SafeHandle, type IpcEvent } from "../common";
import type { TabLayout } from "../../../shared/schemas";

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
        isNew: ReturnType<typeof vi.fn>;
    };
    const win = {
        show: vi.fn(),
        focus: vi.fn(),
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
            isNew: vi.fn().mockReturnValue(false),
        };

        const safeHandle = createSafeHandle(handlers);
        registerLayoutHandlers(
            safeHandle,
            { tabLayouts, sessionWindow },
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
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "path";
import { registerThemeHandlers } from "./themes";
import { ValidationError, type SafeHandle, type IpcEvent } from "../common";

const fsState = vi.hoisted(() => {
    const files = new Map<string, string>();
    return {
        files,
        mock: {
            readFile: vi.fn(async (p: string) => {
                if (!files.has(p)) {
                    const err = new Error("ENOENT");
                    (err as NodeJS.ErrnoException).code = "ENOENT";
                    throw err;
                }
                return files.get(p)!;
            }),
            writeFile: vi.fn(async (p: string, data: string) => {
                files.set(p, data.toString());
            }),
            mkdir: vi.fn(async () => { /* noop */ }),
            unlink: vi.fn(async (p: string) => {
                if (!files.has(p)) {
                    const err = new Error("ENOENT");
                    (err as NodeJS.ErrnoException).code = "ENOENT";
                    throw err;
                }
                files.delete(p);
            }),
        },
    };
});

const userDataPath = "C:/tmp/userdata";
const mockWindows: Array<{ webContents: { send: ReturnType<typeof vi.fn> } }> = [];

vi.mock("fs/promises", () => ({ default: fsState.mock, ...fsState.mock, __files: fsState.files }));
vi.mock("electron", () => {
    const app = { getPath: vi.fn(() => userDataPath) };
    const browserWindow = {
        getAllWindows: vi.fn(() => mockWindows),
    };
    return { app, BrowserWindow: browserWindow };
});
import fs from "fs/promises";
import { app as electronApp, BrowserWindow as electronBrowserWindow } from "electron";

type Handler = (...args: unknown[]) => unknown;
const fsMock = fs as unknown as typeof fsState.mock & { __files: Map<string, string> };

function createSafeHandle(registry: Map<string, Handler>): SafeHandle {
    return ((channel: string, handler: (...args: unknown[]) => unknown) => {
        registry.set(channel, handler as Handler);
    }) as SafeHandle;
}

describe("Theme IPC handlers", () => {
    let handlers: Map<string, Handler>;
    let themes: {
        list: ReturnType<typeof vi.fn>;
        save: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
    };
    const logErr = vi.fn();

    beforeEach(() => {
        handlers = new Map();
        fsState.files.clear();
        mockWindows.length = 0;
        logErr.mockReset();
        Object.values(fsState.mock).forEach((fn) => typeof fn === "function" && fn.mockReset?.());
        electronApp.getPath.mockClear();
        electronBrowserWindow.getAllWindows.mockClear();

        themes = {
            list: vi.fn().mockResolvedValue([]),
            save: vi.fn().mockResolvedValue([]),
            delete: vi.fn().mockResolvedValue([]),
        };

        const safeHandle = createSafeHandle(handlers);
        registerThemeHandlers(
            safeHandle,
            { themes },
            logErr,
        );
    });

    function handler(channel: string): Handler {
        const h = handlers.get(channel);
        if (!h) throw new Error(`missing handler ${channel}`);
        return h;
    }

    it("validiert Theme-Eingaben", async () => {
        const save = handler("themes:save");

        await expect(save({} as IpcEvent, { colors: { bg: 123 } })).rejects.toBeInstanceOf(ValidationError);

        const valid = { name: "Dark", colors: { bg: "#000000" } };
        await expect(save({} as IpcEvent, valid)).resolves.toEqual([]);
        expect(themes.save).toHaveBeenCalled();
    });

    it("persistiert Snapshot bei theme:push und informiert Windows", async () => {
        const push = handler("theme:push");
        const themeSnapshotPath = path.join(userDataPath, "themeSnapshot.json");
        mockWindows.push({ isDestroyed: () => false, webContents: { send: vi.fn() } } as never);

        await expect(push({} as IpcEvent, { colors: { bg: "#111111" } })).resolves.toBe(true);
        await new Promise((r) => setTimeout(r, 0)); // allow async persist

        expect(fsMock.writeFile).toHaveBeenCalledWith(themeSnapshotPath, expect.stringContaining("#111111"), "utf-8");
        expect(electronBrowserWindow.getAllWindows).toHaveBeenCalled();
        expect(mockWindows[0].webContents.send).toHaveBeenCalledWith("theme:update", expect.objectContaining({
            colors: expect.objectContaining({ bg: "#111111" }),
        }));
    });

    it("speichert und lädt tabActiveColor", async () => {
        const save = handler("tabActiveColor:save");
        const load = handler("tabActiveColor:load");

        await expect(save({} as IpcEvent, "#ff0000")).resolves.toBe(true);
        const color = await load({} as IpcEvent);

        expect(color).toBe("#ff0000");
        expect(fsMock.writeFile).toHaveBeenCalled();
        expect(fsMock.readFile).toHaveBeenCalled();
    });
});

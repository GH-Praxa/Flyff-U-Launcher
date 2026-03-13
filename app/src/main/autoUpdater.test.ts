import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (factory closures – no top-level refs) ─────────────────────
const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock("electron", () => ({
    app: { getVersion: () => "3.2.0" },
    BrowserWindow: { getAllWindows: () => [] },
    dialog: { showMessageBox: vi.fn(), showErrorBox: vi.fn() },
    ipcMain: {
        handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers.set(channel, handler);
        },
    },
}));

vi.mock("electron-updater", () => {
    const mock = {
        currentVersion: { format: () => "3.2.0" },
        allowDowngrade: false,
        autoDownload: false,
        autoInstallOnAppQuit: false,
        disableDifferentialDownload: false,
        setFeedURL: vi.fn(),
        checkForUpdates: vi.fn().mockResolvedValue({
            updateInfo: { version: "3.1.0" },
        }),
        downloadUpdate: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
    };
    return { autoUpdater: mock };
});

vi.mock("../shared/logger", () => ({
    logWarn: vi.fn(),
    logErr: vi.fn(),
}));

// ── Import AFTER mocks ──────────────────────────────────────────────
import { setupAutoUpdater } from "./autoUpdater";
import { autoUpdater } from "electron-updater";

describe("autoUpdater – installVersion", () => {
    beforeEach(() => {
        handlers.clear();
        // Reset to SemVer-like object
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (autoUpdater as any).currentVersion = { format: () => "3.2.0" };
        setupAutoUpdater({ getLocale: () => "en", checkOnStart: false });
    });

    it("should not overwrite currentVersion with a plain string", async () => {
        const handler = handlers.get("app:installVersion");
        expect(handler).toBeDefined();

        await handler!({}, "3.1.0");

        // currentVersion must remain an object with .format(), never a plain string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cv = (autoUpdater as any).currentVersion;
        expect(typeof cv).not.toBe("string");
        if (cv && typeof cv === "object") {
            expect(typeof (cv as { format: unknown }).format).toBe("function");
        }
    });
});

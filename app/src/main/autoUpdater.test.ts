import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (factory closures – no top-level refs) ─────────────────────
const handlers = new Map<string, (...args: unknown[]) => unknown>();
const eventHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock("electron", () => ({
    app: { getVersion: () => "3.3.0" },
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
        currentVersion: { format: () => "3.3.0" },
        allowDowngrade: false,
        autoDownload: false,
        autoInstallOnAppQuit: false,
        disableDifferentialDownload: false,
        setFeedURL: vi.fn(),
        checkForUpdates: vi.fn().mockResolvedValue({
            updateInfo: { version: "3.2.0" },
        }),
        downloadUpdate: vi.fn().mockResolvedValue(undefined),
        on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
            eventHandlers.set(event, handler);
        }),
    };
    return { autoUpdater: mock };
});

vi.mock("../shared/logger", () => ({
    logWarn: vi.fn(),
    logErr: vi.fn(),
}));

// Mock fetchGitHubReleases via https module
vi.mock("node:https", () => {
    const mockResponse = {
        on: vi.fn((event: string, cb: (chunk: string) => void) => {
            if (event === "data") {
                cb(JSON.stringify([
                    { tag_name: "v3.2.0", name: "v3.2.0", published_at: "2026-01-01", prerelease: false, draft: false },
                    { tag_name: "v3.3.0", name: "v3.3.0", published_at: "2026-03-13", prerelease: false, draft: false },
                ]));
            }
            if (event === "end") {
                cb("" /* unused */);
            }
            return mockResponse;
        }),
    };
    return {
        get: vi.fn((_opts: unknown, cb: (res: unknown) => void) => {
            cb(mockResponse);
            return { on: vi.fn(), end: vi.fn() };
        }),
    };
});

// ── Import AFTER mocks ──────────────────────────────────────────────
import { setupAutoUpdater } from "./autoUpdater";
import { autoUpdater } from "electron-updater";

describe("autoUpdater – installVersion", () => {
    beforeEach(() => {
        handlers.clear();
        eventHandlers.clear();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (autoUpdater as any).currentVersion = { format: () => "3.3.0" };
        (autoUpdater.setFeedURL as ReturnType<typeof vi.fn>).mockClear();
        (autoUpdater.checkForUpdates as ReturnType<typeof vi.fn>).mockResolvedValue({
            updateInfo: { version: "3.2.0" },
        });
        (autoUpdater.downloadUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        setupAutoUpdater({ getLocale: () => "en", checkOnStart: false });
    });

    it("should not overwrite currentVersion with a plain string", async () => {
        const handler = handlers.get("app:installVersion");
        expect(handler).toBeDefined();

        await handler!({}, "3.2.0");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cv = (autoUpdater as any).currentVersion;
        expect(typeof cv).not.toBe("string");
        if (cv && typeof cv === "object") {
            expect(typeof (cv as { format: unknown }).format).toBe("function");
        }
    });

    it("should use generic provider with release-specific URL", async () => {
        const handler = handlers.get("app:installVersion");
        const result = await handler!({}, "3.2.0");

        expect(result).toEqual({ ok: true });

        // setFeedURL should have been called with generic provider pointing to release assets
        const calls = (autoUpdater.setFeedURL as ReturnType<typeof vi.fn>).mock.calls;
        const genericCall = calls.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c: any[]) => c[0]?.provider === "generic",
        );
        expect(genericCall).toBeDefined();
        expect(genericCall![0].url).toBe(
            "https://github.com/GH-Praxa/Flyff-U-Launcher/releases/download/v3.2.0/",
        );
    });

    it("should set allowDowngrade to true during install and restore after", async () => {
        const handler = handlers.get("app:installVersion");
        await handler!({}, "3.2.0");

        // After handler completes, allowDowngrade should be restored to false
        expect(autoUpdater.allowDowngrade).toBe(false);
    });

    it("should restore original feed config after install", async () => {
        const handler = handlers.get("app:installVersion");
        await handler!({}, "3.2.0");

        // Last setFeedURL call should restore the github provider
        const calls = (autoUpdater.setFeedURL as ReturnType<typeof vi.fn>).mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[0].provider).toBe("github");
    });

    it("should return error when release not found", async () => {
        const handler = handlers.get("app:installVersion");
        const result = await handler!({}, "9.9.9");

        expect(result).toEqual({ ok: false, error: "Release for version 9.9.9 not found" });
    });

    it("should suppress update-available dialog during version install", async () => {
        const handler = handlers.get("app:installVersion");

        // Simulate update-available event firing during checkForUpdates
        (autoUpdater.checkForUpdates as ReturnType<typeof vi.fn>).mockImplementation(async () => {
            const onUpdateAvailable = eventHandlers.get("update-available");
            if (onUpdateAvailable) onUpdateAvailable({ version: "3.2.0" });
            return { updateInfo: { version: "3.2.0" } };
        });

        await handler!({}, "3.2.0");

        // dialog.showMessageBox should NOT have been called by the update-available handler
        const { dialog } = await import("electron");
        expect(dialog.showMessageBox).not.toHaveBeenCalled();
    });
});

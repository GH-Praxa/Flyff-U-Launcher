import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerProfileHandlers, type ProfilesStore } from "./profiles";
import { ValidationError, type SafeHandle, type IpcEvent } from "../common";

type Handler = (...args: unknown[]) => unknown;

function createSafeHandle(registry: Map<string, Handler>): SafeHandle {
    return ((channel: string, handler: (...args: unknown[]) => unknown) => {
        registry.set(channel, handler as Handler);
    }) as SafeHandle;
}

describe("Profile IPC handlers", () => {
    let handlers: Map<string, Handler>;
    let profiles: ProfilesStore;
    let logErr: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        handlers = new Map();
        logErr = vi.fn();
        profiles = {
            list: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue([]),
            update: vi.fn().mockResolvedValue([]),
            delete: vi.fn().mockResolvedValue([]),
            clone: vi.fn().mockResolvedValue([]),
            reorder: vi.fn().mockResolvedValue([]),
            getOverlayTargetId: vi.fn().mockResolvedValue(null),
            setOverlayTarget: vi.fn().mockResolvedValue([]),
            getOverlaySupportTargetId: vi.fn().mockResolvedValue(null),
            setOverlaySupportTarget: vi.fn().mockResolvedValue([]),
            getOverlaySettings: vi.fn().mockResolvedValue(null),
            patchOverlaySettings: vi.fn().mockResolvedValue({} as never),
        };

        const safeHandle = createSafeHandle(handlers);
        registerProfileHandlers(
            safeHandle,
            { profiles },
            logErr,
        );
    });

    function getHandler(channel: string): Handler {
        const handler = handlers.get(channel);
        if (!handler) {
            throw new Error(`Handler not registered: ${channel}`);
        }
        return handler;
    }

    it("validates profile names on create", async () => {
        const create = getHandler("profiles:create");
        await expect(create({} as IpcEvent, "New Profile")).resolves.toEqual([]);
        await expect(create({} as IpcEvent, "")).rejects.toBeInstanceOf(ValidationError);
    });

    it("sets overlay target correctly", async () => {
        const setOverlayTarget = getHandler("profiles:setOverlayTarget");
        const next = [{ id: "p1" } as never];
        (profiles.setOverlayTarget as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(next);

        const result = await setOverlayTarget({} as IpcEvent, "p1", "icon");

        expect(result).toBe(next);
        expect(profiles.setOverlayTarget).toHaveBeenCalledWith("p1", "icon");
    });

    it("sets overlay support target correctly", async () => {
        const setOverlaySupportTarget = getHandler("profiles:setOverlaySupportTarget");
        const next = [{ id: "p2" } as never];
        (profiles.setOverlaySupportTarget as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(next);

        const result = await setOverlaySupportTarget({} as IpcEvent, "p2", "support-icon");

        expect(result).toBe(next);
        expect(profiles.setOverlaySupportTarget).toHaveBeenCalledWith("p2", "support-icon");
    });

    it("rejects non-array reorder payloads", async () => {
        const reorder = getHandler("profiles:reorder");
        await expect(reorder({} as IpcEvent, "not-an-array" as never)).rejects.toThrow();
    });
});

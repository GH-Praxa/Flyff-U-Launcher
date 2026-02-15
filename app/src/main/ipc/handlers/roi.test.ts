import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerRoiHandlers } from "./roi";
import { ValidationError, type SafeHandle, type IpcEvent } from "../common";
import type { RoiData } from "../../../shared/schemas";

type Handler = (...args: unknown[]) => unknown;

function createSafeHandle(registry: Map<string, Handler>): SafeHandle {
    return ((channel: string, handler: (...args: unknown[]) => unknown) => {
        registry.set(channel, handler as Handler);
    }) as SafeHandle;
}

const roiSample: RoiData = {
    lvl: { x: 0.1, y: 0.1, width: 0.2, height: 0.15 },
    charname: { x: 0.2, y: 0.12, width: 0.25, height: 0.1 },
    exp: { x: 0.2, y: 0.2, width: 0.25, height: 0.1 },
};

describe("ROI IPC handlers", () => {
    let handlers: Map<string, Handler>;
    const roiOpen = vi.fn<[], Promise<boolean>>();
    const roiLoad = vi.fn<[string], Promise<RoiData | null>>();
    const roiSave = vi.fn<[string, RoiData], Promise<boolean>>();
    const roiStatus = vi.fn<[string], Promise<Record<string, boolean>>>();
    const getOverlayTargetId = vi.fn<[], Promise<string | null>>();

    beforeEach(() => {
        roiOpen.mockReset();
        roiLoad.mockReset();
        roiSave.mockReset();
        roiStatus.mockReset();
        getOverlayTargetId.mockReset();
        roiOpen.mockResolvedValue(true);
        roiLoad.mockResolvedValue(roiSample);
        roiSave.mockResolvedValue(true);
        roiStatus.mockResolvedValue({ lvl: true, charname: false, exp: true, lauftext: false });
        getOverlayTargetId.mockResolvedValue("overlay-1");

        handlers = new Map();
        const safeHandle = createSafeHandle(handlers);
        registerRoiHandlers(safeHandle, { roiOpen, roiLoad, roiSave, getOverlayTargetId });
    });

    function getHandler(channel: string): Handler {
        const handler = handlers.get(channel);
        if (!handler) {
            throw new Error(`Handler not registered: ${channel}`);
        }
        return handler;
    }

it("allows opening ROI with string id", async () => {
        const open = getHandler("roi:open");
        const result = await open({} as IpcEvent, "profile1");

        expect(result).toBe(true);
        expect(roiOpen).toHaveBeenCalledWith("profile1", undefined);
    });

    it("accepts object payloads for roi:open", async () => {
        const open = getHandler("roi:open");
        await open({} as IpcEvent, { profileId: "profile2" });

        expect(roiOpen).toHaveBeenCalledWith("profile2", undefined);
    });

    it("rejects missing profileId on roi:open when no overlay target available", async () => {
        const open = getHandler("roi:open");
        getOverlayTargetId.mockResolvedValue(null);

        await expect(open({} as IpcEvent, { wrong: true })).rejects.toBeInstanceOf(ValidationError);
    });

    it("saves ROI data for both payload shapes", async () => {
        const save = getHandler("roi:save");

        await expect(save({} as IpcEvent, { profileId: "p1", rois: roiSample })).resolves.toBe(true);
        expect(roiSave).toHaveBeenLastCalledWith("p1", roiSample);

        await expect(save({} as IpcEvent, "p2", { rois: roiSample })).resolves.toBe(true);
        expect(roiSave).toHaveBeenLastCalledWith("p2", roiSample);
    });

    it("validates ROI payloads", async () => {
        const save = getHandler("roi:save");
        const invalid = { ...roiSample, exp: { ...roiSample.exp!, width: 2 } };

        await expect(save({} as IpcEvent, { profileId: "p3", rois: invalid as RoiData })).rejects.toBeInstanceOf(ValidationError);
    });

it("derives status from roiLoad when no custom status handler is provided", async () => {
        const status = getHandler("roi:status");
        const result = await status({} as IpcEvent, "p4") as Record<string, boolean>;

        expect(roiLoad).toHaveBeenCalledWith("p4");
        expect(result).toEqual({ lvl: true, charname: true, exp: true, lauftext: false, rmExp: false, enemyName: false, enemyHp: false });
    });

    it("uses custom roiStatus handler when present", async () => {
        handlers = new Map();
        const safeHandle = createSafeHandle(handlers);
        roiStatus.mockResolvedValue({ lvl: true, charname: false, exp: true, lauftext: false, rmExp: false, enemyName: false, enemyHp: false });
        registerRoiHandlers(safeHandle, { roiOpen, roiLoad, roiSave, roiStatus });

        const status = handlers.get("roi:status")!;
        const result = await status({} as IpcEvent, "custom") as Record<string, boolean>;

        expect(roiStatus).toHaveBeenCalledWith("custom");
        expect(result).toEqual({ lvl: true, charname: false, exp: true, lauftext: false, rmExp: false, enemyName: false, enemyHp: false });
    });

    it("falls back to overlay target id for roi:status", async () => {
        const status = getHandler("roi:status");
        await status({} as IpcEvent, {});

        expect(getOverlayTargetId).toHaveBeenCalled();
        expect(roiLoad).toHaveBeenCalledWith("overlay-1");
    });
});

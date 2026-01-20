/**
 * IPC handlers for ROI (Region of Interest) calibration operations.
 */
import { SafeHandle, IpcEvent, assertValidId, assertValid, ValidationError } from "../common";
import { RoiData, RoiDataSchema } from "../../../shared/schemas";

export type RoiHandlerOptions = {
    roiOpen: (profileId: string, roiKey?: "lvl" | "charname" | "exp" | "lauftext" | "rmExp" | "enemyName" | "enemyHp") => Promise<boolean>;
    roiLoad: (profileId: string) => Promise<RoiData | null>;
    roiSave: (profileId: string, rois: RoiData) => Promise<boolean>;
    getOverlayTargetId?: () => Promise<string | null>;
    roiStatus?: (profileId: string) => Promise<Record<string, boolean>>;
    roiVisibilityGet?: (profileId: string) => Promise<Record<string, boolean>>;
    roiVisibilitySet?: (profileId: string, key: "lvl" | "charname" | "exp" | "lauftext" | "rmExp" | "enemyName" | "enemyHp", visible: boolean) => Promise<Record<string, boolean>>;
};

export function registerRoiHandlers(
    safeHandle: SafeHandle,
    opts: RoiHandlerOptions
): void {
    const deriveStatus = (data: RoiData | null): Record<string, boolean> => {
        const status = { lvl: false, charname: false, exp: false, lauftext: false, rmExp: false, enemyName: false, enemyHp: false };
        if (!data)
            return status;
        status.lvl = !!data.lvl;
        status.charname = !!(data.charname ?? data.nameLevel);
        status.exp = !!(data.exp ?? data.expPercent);
        status.lauftext = !!data.lauftext;
        status.rmExp = !!data.rmExp;
        status.enemyName = !!data.enemyName;
        status.enemyHp = !!data.enemyHp;
        return status;
    };

    safeHandle("roi:open", async (_e: IpcEvent, arg: unknown) => {
        console.log("[ROI IPC] roi:open received arg:", JSON.stringify(arg));
        let profileId = typeof arg === "string"
            ? arg
            : (arg && typeof arg === "object" && "profileId" in arg && typeof (arg as { profileId: unknown }).profileId === "string")
                ? (arg as { profileId: string }).profileId
                : null;
        const roiKey = (arg && typeof arg === "object" && "roiKey" in arg && typeof (arg as { roiKey: unknown }).roiKey === "string")
            ? (arg as { roiKey: "lvl" | "charname" | "exp" | "lauftext" | "rmExp" | "enemyName" | "enemyHp" }).roiKey
            : undefined;
        console.log("[ROI IPC] roi:open parsed profileId:", profileId, "roiKey:", roiKey);
        if (!profileId && opts.getOverlayTargetId) {
            profileId = await opts.getOverlayTargetId();
        }
        if (!profileId) {
            throw new ValidationError("roi:open: missing profileId");
        }
        assertValidId(profileId, "profileId");
        console.log("[ROI IPC] roi:open calling roiOpen with profileId:", profileId, "roiKey:", roiKey);
        return await opts.roiOpen(profileId, roiKey);
    });

    safeHandle("roi:load", async (_e: IpcEvent, arg: unknown) => {
        let profileId = typeof arg === "string"
            ? arg
            : (arg && typeof arg === "object" && "profileId" in arg && typeof (arg as { profileId: unknown }).profileId === "string")
                ? (arg as { profileId: string }).profileId
                : null;
        if (!profileId && opts.getOverlayTargetId) {
            profileId = await opts.getOverlayTargetId();
        }
        if (!profileId) {
            throw new ValidationError("roi:load: missing profileId");
        }
        assertValidId(profileId, "profileId");
        return await opts.roiLoad(profileId);
    });

    safeHandle("roi:save", async (_e: IpcEvent, a: unknown, b?: unknown) => {
        let profileId: string;
        let roisRaw: unknown;
        if (a && typeof a === "object" && "profileId" in a && typeof (a as Record<string, unknown>).profileId === "string" && "rois" in a && b === undefined) {
            profileId = (a as Record<string, unknown>).profileId as string;
            roisRaw = (a as Record<string, unknown>).rois;
        } else if (typeof a === "string") {
            profileId = a;
            roisRaw = b;
        } else {
            throw new ValidationError("roi:save: invalid arguments");
        }
        assertValidId(profileId, "profileId");
        const actual = (roisRaw && typeof roisRaw === "object" && "rois" in roisRaw)
            ? (roisRaw as Record<string, unknown>).rois
            : roisRaw;
        assertValid(RoiDataSchema, actual, "ROI data");
        return await opts.roiSave(profileId, actual);
    });

    safeHandle("roi:status", async (_e: IpcEvent, arg: unknown) => {
        let profileId = typeof arg === "string"
            ? arg
            : (arg && typeof arg === "object" && "profileId" in arg && typeof (arg as { profileId: unknown }).profileId === "string")
                ? (arg as { profileId: string }).profileId
                : null;
        if (!profileId && opts.getOverlayTargetId) {
            profileId = await opts.getOverlayTargetId();
        }
        if (!profileId) {
            throw new ValidationError("roi:status: missing profileId");
        }
        assertValidId(profileId, "profileId");
        if (opts.roiStatus) {
            return await opts.roiStatus(profileId);
        }
        const data = await opts.roiLoad(profileId);
        return deriveStatus(data);
    });

    safeHandle("roi:visibility:get", async (_e: IpcEvent, arg: unknown) => {
        let profileId = typeof arg === "string"
            ? arg
            : (arg && typeof arg === "object" && "profileId" in arg && typeof (arg as { profileId: unknown }).profileId === "string")
                ? (arg as { profileId: string }).profileId
                : null;
        if (!profileId && opts.getOverlayTargetId) {
            profileId = await opts.getOverlayTargetId();
        }
        if (!profileId) {
            throw new ValidationError("roi:visibility:get: missing profileId");
        }
        assertValidId(profileId, "profileId");
        if (opts.roiVisibilityGet) {
            return await opts.roiVisibilityGet(profileId);
        }
        return { lvl: false, charname: false, exp: false, lauftext: false, rmExp: false, enemyName: false, enemyHp: false };
    });

    safeHandle("roi:visibility:set", async (_e: IpcEvent, arg: unknown) => {
        const obj = arg && typeof arg === "object" ? arg as Record<string, unknown> : null;
        const profileId = obj && typeof obj.profileId === "string" ? obj.profileId : null;
        const key = obj && typeof obj.key === "string" ? obj.key as "lvl" | "charname" | "exp" | "lauftext" | "rmExp" | "enemyName" | "enemyHp" : null;
        const visible = obj && typeof obj.visible === "boolean" ? obj.visible : null;
        if (!profileId) throw new ValidationError("roi:visibility:set: missing profileId");
        if (!key || !["lvl", "charname", "exp", "lauftext", "rmExp", "enemyName", "enemyHp"].includes(key)) throw new ValidationError("roi:visibility:set: invalid key");
        if (visible === null) throw new ValidationError("roi:visibility:set: missing visible");
        assertValidId(profileId, "profileId");
        if (!opts.roiVisibilitySet) throw new ValidationError("roi:visibility:set: handler not available");
        return await opts.roiVisibilitySet(profileId, key, visible);
    });
}

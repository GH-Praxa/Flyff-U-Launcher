/**
 * IPC handlers for profile operations.
 */
import { SafeHandle, IpcEvent, assertValidId, assertValidName, assertValid } from "../common";
import {
    Profile,
    ProfilePatch,
    ProfilePatchSchema,
    OverlaySettings,
    OverlaySettingsSchema,
} from "../../../shared/schemas";

export type ProfilesStore = {
    list: () => Promise<Profile[]>;
    create: (name: string) => Promise<Profile[]>;
    update: (patch: ProfilePatch) => Promise<Profile[]>;
    delete: (profileId: string) => Promise<Profile[]>;
    clone: (profileId: string, newName: string) => Promise<Profile[]>;
    reorder: (orderedIds: string[]) => Promise<Profile[]>;
    getOverlayTargetId: () => Promise<string | null>;
    setOverlayTarget: (profileId: string | null, iconKey?: string) => Promise<Profile[]>;
    getOverlaySupportTargetId: () => Promise<string | null>;
    setOverlaySupportTarget: (profileId: string | null, iconKey?: string) => Promise<Profile[]>;
    getOverlaySettings: (profileId: string) => Promise<OverlaySettings | null>;
    patchOverlaySettings: (profileId: string, patch: Partial<OverlaySettings>) => Promise<OverlaySettings>;
};

export type ProfileHandlerOptions = {
    profiles: ProfilesStore;
};

// Note: questlogRefresh and overlayTargetRefresh removed - will be handled by plugins

export function registerProfileHandlers(
    safeHandle: SafeHandle,
    opts: ProfileHandlerOptions,
    logErr: (msg: unknown) => void
): void {
    safeHandle("profiles:list", async () => await opts.profiles.list());

    safeHandle("profiles:create", async (_e: IpcEvent, name: string) => {
        assertValidName(name, "profile name");
        return await opts.profiles.create(name);
    });

    safeHandle("profiles:update", async (_e: IpcEvent, patch: unknown) => {
        assertValid(ProfilePatchSchema, patch, "profile patch");
        return await opts.profiles.update(patch);
    });

    safeHandle("profiles:delete", async (_e: IpcEvent, profileId: string) => {
        assertValidId(profileId, "profileId");
        return await opts.profiles.delete(profileId);
    });

    safeHandle("profiles:clone", async (_e: IpcEvent, profileId: string, newName: string) => {
        assertValidId(profileId, "profileId");
        assertValidName(newName, "profile name");
        return await opts.profiles.clone(profileId, newName);
    });

    safeHandle("profiles:reorder", async (_e: IpcEvent, orderedIds: string[]) => {
        if (!Array.isArray(orderedIds)) {
            throw new Error("orderedIds must be an array");
        }
        for (const id of orderedIds) assertValidId(id, "profileId");
        return await opts.profiles.reorder(orderedIds);
    });

    safeHandle("profiles:getOverlayTargetId", async () => {
        return await opts.profiles.getOverlayTargetId();
    });

    safeHandle("profiles:setOverlayTarget", async (_e: IpcEvent, profileId: string | null, iconKey?: string) => {
        if (profileId !== null) assertValidId(profileId, "profileId");
        return await opts.profiles.setOverlayTarget(profileId, iconKey);
    });

    safeHandle("profiles:getOverlaySupportTargetId", async () => {
        return await opts.profiles.getOverlaySupportTargetId();
    });

    safeHandle("profiles:setOverlaySupportTarget", async (_e: IpcEvent, profileId: string | null, iconKey?: string) => {
        if (profileId !== null) assertValidId(profileId, "profileId");
        return await opts.profiles.setOverlaySupportTarget(profileId, iconKey);
    });

    safeHandle("overlaySettings:get", async (_e: IpcEvent, profileId: string) => {
        assertValidId(profileId, "profileId");
        return await opts.profiles.getOverlaySettings(profileId);
    });

    safeHandle("overlaySettings:patch", async (_e: IpcEvent, profileId: string, patch: unknown) => {
        assertValidId(profileId, "profileId");
        assertValid(OverlaySettingsSchema.partial(), patch, "overlay settings patch");
        return await opts.profiles.patchOverlaySettings(profileId, patch);
    });
}

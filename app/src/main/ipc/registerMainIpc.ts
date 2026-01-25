/**
 * Main IPC registration module.
 * Orchestrates handler registration across all IPC modules.
 */
import { createSafeHandler } from "./common";
import { registerProfileHandlers, ProfilesStore } from "./handlers/profiles";
import { registerSessionHandlers, SessionWindowController, SessionTabsManager } from "./handlers/sessions";
import { registerLayoutHandlers, TabLayoutsStore } from "./handlers/layouts";
import { registerThemeHandlers, ThemeStore } from "./handlers/themes";
import { registerNewsHandlers } from "./handlers/news";
import { registerRoiHandlers } from "./handlers/roi";
import { registerFeatureHandlers, type FeatureStore } from "./handlers/features";
import { registerClientSettingsHandlers } from "./handlers/clientSettings";
import { registerPatchnotesHandlers } from "./handlers/patchnotes";
import type { ClientSettingsStore } from "../clientSettings/store";
import type { ClientSettings } from "../../shared/schemas";
import { logErr } from "../../shared/logger";
import type { LoadView } from "../viewLoader";
import type { RoiData } from "../../shared/schemas";

export type RegisterMainIpcOptions = {
    profiles: ProfilesStore;
    sessionTabs: SessionTabsManager;
    sessionWindow: SessionWindowController;
    tabLayouts: TabLayoutsStore;
    themes: ThemeStore;
    features: FeatureStore;
    clientSettings: ClientSettingsStore;
    loadView?: LoadView;
    createInstanceWindow: (profileId: string) => Promise<void>;
    roiOpen: (profileId: string, roiKey?: "lvl" | "charname" | "exp" | "lauftext" | "rmExp" | "enemyName" | "enemyHp") => Promise<boolean>;
    roiLoad: (profileId: string) => Promise<RoiData | null>;
    roiSave: (profileId: string, rois: RoiData) => Promise<boolean>;
    roiStatus?: (profileId: string) => Promise<Record<string, boolean>>;
    roiVisibilityGet?: (profileId: string) => Promise<Record<string, boolean>>;
    roiVisibilitySet?: (profileId: string, key: "lvl" | "charname" | "exp" | "lauftext" | "rmExp" | "enemyName" | "enemyHp", visible: boolean) => Promise<Record<string, boolean>>;
    onClientSettingsChanged?: (settings: ClientSettings) => void;
};

/**
 * Registers all IPC handlers for the main process.
 */
export function registerMainIpc(opts: RegisterMainIpcOptions): void {
    const ipcLogErr = (msg: unknown) => logErr(msg, "IPC");
    const safeHandle = createSafeHandler(ipcLogErr);

    // Register all handler groups
    registerProfileHandlers(safeHandle, {
        profiles: opts.profiles,
    }, ipcLogErr);

    registerSessionHandlers(safeHandle, {
        sessionTabs: opts.sessionTabs,
        sessionWindow: opts.sessionWindow,
        createInstanceWindow: opts.createInstanceWindow,
    }, ipcLogErr);

    registerLayoutHandlers(safeHandle, {
        tabLayouts: opts.tabLayouts,
        sessionWindow: opts.sessionWindow,
    }, ipcLogErr);

    registerThemeHandlers(safeHandle, {
        themes: opts.themes,
    }, ipcLogErr);

    registerNewsHandlers(safeHandle, ipcLogErr);

    registerFeatureHandlers(safeHandle, {
        features: opts.features,
    }, ipcLogErr);

    registerClientSettingsHandlers(safeHandle, {
        clientSettings: opts.clientSettings,
        onChange: opts.onClientSettingsChanged,
    });

    registerRoiHandlers(safeHandle, {
        roiOpen: opts.roiOpen,
        roiLoad: opts.roiLoad,
        roiSave: opts.roiSave,
        getOverlayTargetId: opts.profiles.getOverlayTargetId,
        roiStatus: opts.roiStatus,
        roiVisibilityGet: opts.roiVisibilityGet,
        roiVisibilitySet: opts.roiVisibilitySet,
    });

    registerPatchnotesHandlers(safeHandle);
}

// Re-export types that may be needed externally
export type { ProfilesStore } from "./handlers/profiles";
export type { SessionWindowController, SessionTabsManager } from "./handlers/sessions";
export type { TabLayoutsStore } from "./handlers/layouts";
export type { ThemeStore } from "./handlers/themes";
export type { FeatureStore } from "./handlers/features";

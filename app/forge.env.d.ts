export {};
type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
type Profile = {
    id: string;
    name: string;
    createdAt: string;
    job?: string;
    launchMode: "tabs" | "window";
    overlayTarget?: boolean;
    overlayIconKey?: string;
};
type TabLayoutSplit = {
    leftId: string;
    rightId: string;
    ratio?: number;
};
type TabLayout = {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    tabs: string[];
    split?: TabLayoutSplit | null;
    activeId?: string | null;
};
type RoiRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
type RoiData = {
    lvl?: RoiRect;
    charname?: RoiRect;
    exp?: RoiRect;
    lauftext?: RoiRect;
};
type BuffWeckerScanArgs = Record<string, unknown>;
type BuffWeckerOverlayPayload = Record<string, unknown>;
type BuffWeckerPingResult = { ok?: boolean; error?: string; disabled?: boolean };
type BuffWeckerScanResult = Record<string, unknown> | { error: string };
type ThemePushPayload = {
    colors?: Partial<Record<string, string>>;
    builtin?: { tabActive?: string };
};
type RoiCalibPayload = { rois: RoiData } | { cancel: true };
type RoiDebugPayload = Record<string, unknown>;

// Plugin state machine states
type PluginState =
    | "discovered"
    | "loading"
    | "loaded"
    | "initializing"
    | "starting"
    | "running"
    | "paused"
    | "stopping"
    | "stopped"
    | "unloading"
    | "unloaded"
    | "error";

// Plugin state info returned by API
type PluginStateInfo = {
    id: string;
    name: string;
    version: string;
    state: PluginState;
    enabled: boolean;
    error?: string;
    errorTime?: string;
    author?: string;
    description?: string;
    hasSettingsUI?: boolean;
    settingsUI?: {
        entry: string;
        width?: number;
        height?: number;
    };
    permissions?: string[];
    requires?: string[];
};

// Plugin manifest (simplified for renderer)
type PluginManifest = {
    id: string;
    name: string;
    version: string;
    author?: string;
    description?: string;
    requires: string[];
    permissions: string[];
};

// Plugin info (detailed)
type PluginInfo = PluginStateInfo & {
    requires?: string[];
    permissions?: string[];
};

// Plugin operation result
type PluginOpResult = { success: boolean; error?: string };

declare global {
    interface Window {
        api: {
            profilesList: () => Promise<Profile[]>;
            profilesCreate: (name: string) => Promise<Profile[]>;
            profilesUpdate: (patch: Partial<Profile> & {
                id: string;
            }) => Promise<Profile[]>;
            profilesDelete: (id: string) => Promise<Profile[]>;
            profilesClone: (sourceId: string, newName: string) => Promise<Profile[]>;
            profilesReorder: (orderedIds: string[]) => Promise<Profile[]>;
            profilesSetOverlayTarget: (profileId: string | null, iconKey?: string) => Promise<Profile[]>;
            openTab: (profileId: string) => Promise<boolean>;
            openWindow: (profileId: string) => Promise<boolean>;
            sessionTabsOpen: (profileId: string) => Promise<boolean>;
            sessionTabsSwitch: (profileId: string) => Promise<boolean>;
            sessionTabsLogout: (profileId: string) => Promise<boolean>;
            sessionTabsLogin: (profileId: string) => Promise<boolean>;
            sessionTabsClose: (profileId: string) => Promise<boolean>;
            sessionTabsSetBounds: (bounds: Rect) => Promise<boolean>;
            sessionTabsSetVisible: (visible: boolean) => Promise<boolean>;
            sessionTabsSetSplit: (pair: {
                primary: string;
                secondary: string;
                ratio?: number;
            } | null) => Promise<boolean>;
            sessionTabsSetSplitRatio: (ratio: number) => Promise<boolean>;
            sessionTabsReset: () => Promise<boolean>;
            tabLayoutsList: () => Promise<TabLayout[]>;
            tabLayoutsGet: (id: string) => Promise<TabLayout | null>;
            tabLayoutsSave: (input: Partial<TabLayout> & {
                name: string;
                tabs: string[];
            }) => Promise<TabLayout[]>;
            tabLayoutsDelete: (id: string) => Promise<TabLayout[]>;
            tabLayoutsApply: (id: string) => Promise<boolean>;
            buffWeckerShowPanel: () => Promise<{ ok?: boolean; error?: string }>;
            buffWeckerPing: () => Promise<BuffWeckerPingResult>;
            buffWeckerLiveScan: (args: BuffWeckerScanArgs) => Promise<BuffWeckerScanResult>;
            buffWeckerOverlayUpdate: (payload: BuffWeckerOverlayPayload) => void;
            buffWeckerActiveJob: () => Promise<{ job?: string | null; error?: string; disabled?: boolean }>;
            onOpenTab: (cb: (profileId: string) => void) => void;
            onSessionActiveChanged: (cb: (profileId: string | null) => void) => void;
            onApplyLayout: (cb: (layout: TabLayout) => void) => void;
            roiOpen: (profileId: string) => Promise<boolean>;
            roiLoad: (profileId: string) => Promise<RoiData | null>;
            roiStatus: (profileId: string) => Promise<Record<string, boolean>>;
            roiSave: (profileId: string, rois: RoiData) => Promise<boolean>;
            fetchNewsPage: (path?: string) => Promise<string>;
            fetchNewsArticle: (url: string) => Promise<string>;
            tabActiveColorLoad: () => Promise<string | null>;
            tabActiveColorSave: (color: string | null) => Promise<boolean>;
            themesList: () => Promise<unknown[]>;
            themeSave: (input: { id?: string; name?: string; colors?: Partial<Record<string, string>> }) => Promise<unknown[]>;
            themeDelete: (id: string) => Promise<unknown[]>;
            themePush: (payload: ThemePushPayload) => Promise<boolean>;
            themeCurrent: () => Promise<ThemePushPayload | null>;
            onThemeUpdate: (cb: (payload: ThemePushPayload) => void) => void;
            sessionWindowClose: () => Promise<boolean>;
            appQuit: () => Promise<boolean>;
            // Plugin management
            pluginsList: () => Promise<PluginStateInfo[]>;
            pluginsListAll: () => Promise<PluginStateInfo[]>;
            pluginsDiscover: () => Promise<PluginManifest[]>;
            pluginsGetState: (pluginId: string) => Promise<PluginState | null>;
            pluginsGetInfo: (pluginId: string) => Promise<PluginInfo | null>;
            pluginsEnable: (pluginId: string) => Promise<PluginOpResult>;
            pluginsDisable: (pluginId: string) => Promise<PluginOpResult>;
            pluginsStart: (pluginId: string) => Promise<PluginOpResult>;
            pluginsStop: (pluginId: string) => Promise<PluginOpResult>;
            pluginsReload: (pluginId: string) => Promise<PluginOpResult>;
            pluginsIsEnabled: (pluginId: string) => Promise<boolean>;
            pluginsGetSettingsUI: (pluginId: string) => Promise<{ url: string; width?: number; height?: number }>;
            pluginsInvokeChannel: (pluginId: string, channel: string, ...args: unknown[]) => Promise<unknown>;
            onPluginStateChanged: (cb: (state: PluginStateInfo) => void) => () => void;
        };
        ipc?: {
            send: (channel: string, payload?: unknown) => void;
            invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
            on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
        };
        roiBridge?: {
            channel: string | null;
            send?: (payload: RoiCalibPayload) => void;
            sendDebug?: (payload: RoiDebugPayload) => void;
        };
    }
}

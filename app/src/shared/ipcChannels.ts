/**
 * Centralized IPC channel names.
 * Single source of truth for all IPC communication channels.
 */

export const IPC_CHANNELS = {
    // Profile operations
    PROFILES_LIST: "profiles:list",
    PROFILES_CREATE: "profiles:create",
    PROFILES_UPDATE: "profiles:update",
    PROFILES_DELETE: "profiles:delete",
    PROFILES_CLONE: "profiles:clone",
    PROFILES_REORDER: "profiles:reorder",
    PROFILES_GET_OVERLAY_TARGET_ID: "profiles:getOverlayTargetId",
    PROFILES_SET_OVERLAY_TARGET: "profiles:setOverlayTarget",

    // Overlay settings
    OVERLAY_SETTINGS_GET: "overlaySettings:get",
    OVERLAY_SETTINGS_PATCH: "overlaySettings:patch",

    // Session tabs
    SESSION_OPEN_TAB: "session:openTab",
    SESSION_TABS_OPEN: "sessionTabs:open",
    SESSION_TABS_SWITCH: "sessionTabs:switch",
    SESSION_TABS_LOGOUT: "sessionTabs:logout",
    SESSION_TABS_LOGIN: "sessionTabs:login",
    SESSION_TABS_CLOSE: "sessionTabs:close",
    SESSION_TABS_SET_BOUNDS: "sessionTabs:setBounds",
    SESSION_TABS_SET_VISIBLE: "sessionTabs:setVisible",
    SESSION_TABS_SET_SPLIT: "sessionTabs:setSplit",
    SESSION_TABS_SET_SPLIT_RATIO: "sessionTabs:setSplitRatio",
    SESSION_TABS_RESET: "sessionTabs:reset",
    SESSION_TABS_ACTIVE_CHANGED: "sessionTabs:activeChanged",

    // Session window
    SESSION_WINDOW_CLOSE: "sessionWindow:close",
    SESSION_WINDOW_CLOSE_REQUESTED: "sessionWindow:closeRequested",
    SESSION_APPLY_LAYOUT: "session:applyLayout",

    // Instance window
    INSTANCE_OPEN_WINDOW: "instance:openWindow",

    // App
    APP_QUIT: "app:quit",

    // Tab layouts
    TAB_LAYOUTS_LIST: "tabLayouts:list",
    TAB_LAYOUTS_GET: "tabLayouts:get",
    TAB_LAYOUTS_SAVE: "tabLayouts:save",
    TAB_LAYOUTS_DELETE: "tabLayouts:delete",
    TAB_LAYOUTS_APPLY: "tabLayouts:apply",

    // News
    NEWS_FETCH: "news:fetch",
    NEWS_FETCH_ARTICLE: "news:fetchArticle",

    // ROI
    ROI_OPEN: "roi:open",
    ROI_LOAD: "roi:load",
    ROI_SAVE: "roi:save",

    // Themes
    THEMES_LIST: "themes:list",
    THEMES_SAVE: "themes:save",
    THEMES_DELETE: "themes:delete",
    THEME_PUSH: "theme:push",
    THEME_CURRENT: "theme:current",
    THEME_UPDATE: "theme:update",

    // Tab active color
    TAB_ACTIVE_COLOR_LOAD: "tabActiveColor:load",
    TAB_ACTIVE_COLOR_SAVE: "tabActiveColor:save",

    // HUD/Overlay controls
    OVERLAY_TOGGLE_EDIT: "overlay:toggleEdit",
    OVERLAY_SET_BOUNDS: "overlay:setBounds",
    OVERLAY_SET_SIZE: "overlay:setSize",
    OVERLAY_EDIT: "overlay:edit",
    HUD_GET_BOUNDS: "hud:getBounds",
    HUD_TOGGLE_EDIT: "hud:toggleEdit",
    HUD_EDIT: "hud:edit",
    HUDPANEL_TOGGLE: "hudpanel:toggle",
    HUDPANEL_SET_WIDTH: "hudpanel:setWidth",
    SIDEPANEL_TOGGLE: "sidepanel:toggle",
    EXP_UPDATE: "exp:update",

    // Buff-Wecker (optional module)
    BUFF_WECKER_SHOW_PANEL: "buff-wecker/show-panel",
    BUFF_WECKER_PING: "buff-wecker/ping",
    BUFF_WECKER_SCAN: "buff-wecker/scan",
    BUFF_WECKER_SCAN_FILE: "buff-wecker/scan-file",
    BUFF_WECKER_LIVE_SCAN: "buff-wecker/live-scan",
    BUFF_WECKER_ACTIVE_JOB: "buff-wecker/active-job",
    BUFF_WECKER_OVERLAY_UPDATE: "buff-wecker/overlay-update",
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

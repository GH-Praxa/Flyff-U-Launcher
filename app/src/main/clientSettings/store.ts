import { app } from "electron";
import fs from "fs/promises";
import path from "path";
import { DEFAULT_LOCALE, LocaleSchema, type ClientSettings, type ClientSettingsPatch } from "../../shared/schemas";
import { DEFAULT_HOTKEYS, mergeHotkeySettings, normalizeHotkeySettings } from "../../shared/hotkeys";
import { LAYOUT } from "../../shared/constants";
import { clampLauncherHeight, clampLauncherWidth, normalizeLauncherSize } from "../../shared/launcherSize";

const SETTINGS_FILE = path.join("user", "config", "settings.json");

const DEFAULT_CLIENT_SETTINGS: ClientSettings = {
    startFullscreen: false,
    layoutDelaySeconds: 2,
    toastDurationSeconds: 5,
    overlayButtonPassthrough: false,
    locale: DEFAULT_LOCALE,
    hotkeys: DEFAULT_HOTKEYS,
    launcherWidth: LAYOUT.LAUNCHER_WIDTH,
    launcherHeight: LAYOUT.LAUNCHER_HEIGHT,
    seqGridLoad: false,
    gridActiveBorder: false,
    autoSaveLayouts: true,
    persistGameUiPositions: false,
    tabLayoutDisplay: "compact",
    fcoinRate: 200_000_000,
    gameFont: null,
    launcherFontSize: null,
    sendTelemetry: false,
    logsWebhook: process.env.LOGS_WEBHOOK_URL ?? "",  // Set via LOGS_WEBHOOK_URL GitHub Secret at build time
    showAnnouncements: true,
    collapsibleOpenProfiles: true,
};

function clampDelaySeconds(input: unknown): number {
    const n = Number(input);
    if (!Number.isFinite(n))
        return DEFAULT_CLIENT_SETTINGS.layoutDelaySeconds;
    return Math.min(30, Math.max(0, n));
}

const TAB_LAYOUT_DISPLAY_VALUES: ClientSettings["tabLayoutDisplay"][] = ["compact", "grouped", "separated", "mini-grid"];
function normalizeTabLayoutDisplay(input: unknown): ClientSettings["tabLayoutDisplay"] {
    return TAB_LAYOUT_DISPLAY_VALUES.includes(input as ClientSettings["tabLayoutDisplay"])
        ? (input as ClientSettings["tabLayoutDisplay"])
        : DEFAULT_CLIENT_SETTINGS.tabLayoutDisplay;
}

function settingsPath() {
    return path.join(app.getPath("userData"), SETTINGS_FILE);
}

type NormalizedSettingsResult = {
    settings: ClientSettings;
    migrated: boolean;
};

function migrateHotkeys(rawHotkeys: unknown, fallback: typeof DEFAULT_HOTKEYS): { hotkeys: ClientSettings["hotkeys"]; migrated: boolean } {
    const rawObj = rawHotkeys && typeof rawHotkeys === "object" ? (rawHotkeys as Record<string, unknown>) : {};
    const hasLegacy =
        "tabLeftPrev" in rawObj ||
        "tabLeftNext" in rawObj ||
        "tabRightPrev" in rawObj ||
        "tabRightNext" in rawObj;
    const normalized = normalizeHotkeySettings(rawHotkeys, fallback);
    const missingUnified =
        (!normalized.tabPrev && (rawObj.tabLeftPrev || rawObj.tabRightPrev)) ||
        (!normalized.tabNext && (rawObj.tabLeftNext || rawObj.tabRightNext));
    const migrated = hasLegacy || !!missingUnified;
    return { hotkeys: normalized, migrated };
}

function normalize(raw: unknown): NormalizedSettingsResult {
    if (!raw || typeof raw !== "object") {
        return { settings: { ...DEFAULT_CLIENT_SETTINGS }, migrated: false };
    }
    const obj = raw as Record<string, unknown>;
    const normalizedSize = normalizeLauncherSize({
        width: obj.launcherWidth,
        height: obj.launcherHeight,
    });
    const { hotkeys, migrated } = migrateHotkeys(obj.hotkeys, DEFAULT_HOTKEYS);
    return {
        migrated,
        settings: {
            startFullscreen:
                typeof obj.startFullscreen === "boolean"
                    ? obj.startFullscreen
                    : DEFAULT_CLIENT_SETTINGS.startFullscreen,
            layoutDelaySeconds: clampDelaySeconds(obj.layoutDelaySeconds),
            toastDurationSeconds:
                typeof obj.toastDurationSeconds === "number"
                    ? Math.min(60, Math.max(1, Math.round(obj.toastDurationSeconds)))
                    : DEFAULT_CLIENT_SETTINGS.toastDurationSeconds,
            overlayButtonPassthrough:
                typeof obj.overlayButtonPassthrough === "boolean"
                    ? obj.overlayButtonPassthrough
                    : DEFAULT_CLIENT_SETTINGS.overlayButtonPassthrough,
            seqGridLoad:
                typeof obj.seqGridLoad === "boolean"
                    ? obj.seqGridLoad
                    : DEFAULT_CLIENT_SETTINGS.seqGridLoad,
            gridActiveBorder:
                typeof obj.gridActiveBorder === "boolean"
                    ? obj.gridActiveBorder
                    : DEFAULT_CLIENT_SETTINGS.gridActiveBorder,
            autoSaveLayouts:
                typeof obj.autoSaveLayouts === "boolean"
                    ? obj.autoSaveLayouts
                    : DEFAULT_CLIENT_SETTINGS.autoSaveLayouts,
            persistGameUiPositions:
                typeof obj.persistGameUiPositions === "boolean"
                    ? obj.persistGameUiPositions
                    : DEFAULT_CLIENT_SETTINGS.persistGameUiPositions,
            tabLayoutDisplay: normalizeTabLayoutDisplay(obj.tabLayoutDisplay),
            fcoinRate:
                typeof obj.fcoinRate === "number" && obj.fcoinRate > 0
                    ? obj.fcoinRate
                    : DEFAULT_CLIENT_SETTINGS.fcoinRate,
            locale: LocaleSchema.safeParse(obj.locale).success
                ? (obj.locale as ClientSettings["locale"])
                : DEFAULT_CLIENT_SETTINGS.locale,
            hotkeys,
            launcherWidth: normalizedSize.width,
            launcherHeight: normalizedSize.height,
            gameFont: typeof obj.gameFont === "string" ? obj.gameFont.slice(0, 256) : null,
            launcherFontSize:
                typeof obj.launcherFontSize === "number" && obj.launcherFontSize >= 75 && obj.launcherFontSize <= 150
                    ? obj.launcherFontSize
                    : null,
            sendTelemetry:
                typeof obj.sendTelemetry === "boolean"
                    ? obj.sendTelemetry
                    : DEFAULT_CLIENT_SETTINGS.sendTelemetry,
            logsWebhook:
                typeof obj.logsWebhook === "string" && obj.logsWebhook.length > 0
                    ? obj.logsWebhook
                    : DEFAULT_CLIENT_SETTINGS.logsWebhook,
            showAnnouncements:
                typeof obj.showAnnouncements === "boolean"
                    ? obj.showAnnouncements
                    : DEFAULT_CLIENT_SETTINGS.showAnnouncements,
            collapsibleOpenProfiles:
                typeof obj.collapsibleOpenProfiles === "boolean"
                    ? obj.collapsibleOpenProfiles
                    : DEFAULT_CLIENT_SETTINGS.collapsibleOpenProfiles,
        },
    };
}

async function readSettings(): Promise<ClientSettings> {
    try {
        const raw = await fs.readFile(settingsPath(), "utf-8");
        const parsed = JSON.parse(raw);
        const { settings, migrated } = normalize(parsed);
        if (migrated) {
            // Persist migration (e.g., legacy per-side tab hotkeys -> unified hotkeys)
            await writeSettings(settings);
        }
        return settings;
    } catch {
        return { ...DEFAULT_CLIENT_SETTINGS };
    }
}

async function writeSettings(settings: ClientSettings): Promise<void> {
    await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
    await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2), "utf-8");
}

export function createClientSettingsStore() {
    return {
        async get(): Promise<ClientSettings> {
            return await readSettings();
        },
        async patch(patch: ClientSettingsPatch): Promise<ClientSettings> {
            const current = await readSettings();
            const next: ClientSettings = { ...current };
            if (typeof patch.startFullscreen === "boolean") {
                next.startFullscreen = patch.startFullscreen;
            }
            if (patch.layoutDelaySeconds !== undefined) {
                next.layoutDelaySeconds = clampDelaySeconds(patch.layoutDelaySeconds);
            }
            if (patch.toastDurationSeconds !== undefined) {
                next.toastDurationSeconds = Math.min(60, Math.max(1, Math.round(patch.toastDurationSeconds)));
            }
            if (typeof patch.overlayButtonPassthrough === "boolean") {
                next.overlayButtonPassthrough = patch.overlayButtonPassthrough;
            }
            if (typeof patch.seqGridLoad === "boolean") {
                next.seqGridLoad = patch.seqGridLoad;
            }
            if (typeof patch.gridActiveBorder === "boolean") {
                next.gridActiveBorder = patch.gridActiveBorder;
            }
            if (typeof patch.autoSaveLayouts === "boolean") {
                next.autoSaveLayouts = patch.autoSaveLayouts;
            }
            if (typeof patch.persistGameUiPositions === "boolean") {
                next.persistGameUiPositions = patch.persistGameUiPositions;
            }
            if (typeof patch.tabLayoutDisplay === "string") {
                next.tabLayoutDisplay = normalizeTabLayoutDisplay(patch.tabLayoutDisplay);
            }
            if (patch.locale !== undefined && LocaleSchema.safeParse(patch.locale).success) {
                next.locale = patch.locale;
            }
            if (patch.hotkeys !== undefined) {
                next.hotkeys = mergeHotkeySettings(next.hotkeys ?? DEFAULT_HOTKEYS, patch.hotkeys, DEFAULT_HOTKEYS);
            }
            if (typeof patch.fcoinRate === "number" && patch.fcoinRate > 0) {
                next.fcoinRate = patch.fcoinRate;
            }
            if (patch.launcherWidth !== undefined) {
                next.launcherWidth = clampLauncherWidth(patch.launcherWidth, next.launcherWidth);
            }
            if (patch.launcherHeight !== undefined) {
                next.launcherHeight = clampLauncherHeight(patch.launcherHeight, next.launcherHeight);
            }
            if (patch.gameFont !== undefined) {
                next.gameFont = typeof patch.gameFont === "string" ? patch.gameFont.slice(0, 256) : null;
            }
            if (patch.launcherFontSize !== undefined) {
                const s = patch.launcherFontSize;
                next.launcherFontSize =
                    typeof s === "number" && s >= 75 && s <= 150 ? Math.round(s) : null;
            }
            if (typeof patch.sendTelemetry === "boolean") {
                next.sendTelemetry = patch.sendTelemetry;
            }
            if (typeof patch.logsWebhook === "string") {
                next.logsWebhook = patch.logsWebhook.length > 0 ? patch.logsWebhook : undefined;
            }
            if (typeof patch.showAnnouncements === "boolean") {
                next.showAnnouncements = patch.showAnnouncements;
            }
            if (typeof patch.collapsibleOpenProfiles === "boolean") {
                next.collapsibleOpenProfiles = patch.collapsibleOpenProfiles;
            }
            await writeSettings(next);
            // Re-read to ensure we return the exact persisted state (normalizes any FS or serialization quirks)
            return await readSettings();
        },
    };
}

export type ClientSettingsStore = ReturnType<typeof createClientSettingsStore>;

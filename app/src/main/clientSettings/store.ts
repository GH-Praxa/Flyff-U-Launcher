import { app } from "electron";
import fs from "fs/promises";
import path from "path";
import { DEFAULT_LOCALE, LocaleSchema, type ClientSettings, type ClientSettingsPatch } from "../../shared/schemas";

const SETTINGS_FILE = "client-settings.json";

const DEFAULT_CLIENT_SETTINGS: ClientSettings = {
    startFullscreen: false,
    layoutDelaySeconds: 2,
    overlayButtonPassthrough: false,
    locale: DEFAULT_LOCALE,
};

function clampDelaySeconds(input: unknown): number {
    const n = Number(input);
    if (!Number.isFinite(n))
        return DEFAULT_CLIENT_SETTINGS.layoutDelaySeconds;
    return Math.min(30, Math.max(0, n));
}

function settingsPath() {
    return path.join(app.getPath("userData"), SETTINGS_FILE);
}

function normalize(raw: unknown): ClientSettings {
    if (!raw || typeof raw !== "object") {
        return { ...DEFAULT_CLIENT_SETTINGS };
    }
    const obj = raw as Record<string, unknown>;
    return {
        startFullscreen:
            typeof obj.startFullscreen === "boolean"
                ? obj.startFullscreen
                : DEFAULT_CLIENT_SETTINGS.startFullscreen,
        layoutDelaySeconds: clampDelaySeconds(obj.layoutDelaySeconds),
        overlayButtonPassthrough:
            typeof obj.overlayButtonPassthrough === "boolean"
                ? obj.overlayButtonPassthrough
                : DEFAULT_CLIENT_SETTINGS.overlayButtonPassthrough,
        locale: LocaleSchema.safeParse(obj.locale).success
            ? (obj.locale as ClientSettings["locale"])
            : DEFAULT_CLIENT_SETTINGS.locale,
    };
}

async function readSettings(): Promise<ClientSettings> {
    try {
        const raw = await fs.readFile(settingsPath(), "utf-8");
        const parsed = JSON.parse(raw);
        return normalize(parsed);
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
            if (typeof patch.overlayButtonPassthrough === "boolean") {
                next.overlayButtonPassthrough = patch.overlayButtonPassthrough;
            }
            if (patch.locale !== undefined && LocaleSchema.safeParse(patch.locale).success) {
                next.locale = patch.locale;
            }
            await writeSettings(next);
            return next;
        },
    };
}

export type ClientSettingsStore = ReturnType<typeof createClientSettingsStore>;

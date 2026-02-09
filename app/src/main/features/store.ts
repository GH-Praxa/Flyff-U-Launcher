import { app } from "electron";
import fs from "fs/promises";
import path from "path";
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from "../../shared/featureFlags";

function normalizeFlags(raw: unknown): FeatureFlags {
    const base = DEFAULT_FEATURE_FLAGS;
    if (!raw || typeof raw !== "object")
        return { ...base };
    const obj = raw as Record<string, unknown>;
    const questlogRaw = obj.questlog && typeof obj.questlog === "object" ? obj.questlog as Record<string, unknown> : {};
    return {
        questlog: {
            enabled: typeof questlogRaw.enabled === "boolean" ? questlogRaw.enabled : base.questlog.enabled,
        },
    };
}

function flagsPath() {
    return path.join(app.getPath("userData"), "user", "config", "features.json");
}

async function readFlags(): Promise<FeatureFlags> {
    try {
        const raw = await fs.readFile(flagsPath(), "utf-8");
        const parsed = JSON.parse(raw);
        return normalizeFlags(parsed);
    }
    catch {
        return { ...DEFAULT_FEATURE_FLAGS };
    }
}

async function writeFlags(flags: FeatureFlags): Promise<void> {
    await fs.mkdir(path.dirname(flagsPath()), { recursive: true });
    await fs.writeFile(flagsPath(), JSON.stringify(flags, null, 2), "utf-8");
}

export function createFeatureStore() {
    return {
        async get(): Promise<FeatureFlags> {
            return readFlags();
        },
        async patch(patch: Partial<FeatureFlags>): Promise<FeatureFlags> {
            const current = await readFlags();
            const next = normalizeFlags({
                ...current,
                ...patch,
                questlog: {
                    ...current.questlog,
                    ...(patch.questlog ?? {}),
                },
            });
            await writeFlags(next);
            return next;
        },
    };
}

export type FeatureStore = ReturnType<typeof createFeatureStore>;

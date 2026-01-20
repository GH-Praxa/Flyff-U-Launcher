/**
 * IPC handlers for theme operations.
 */
import { app } from "electron";
import fs from "fs/promises";
import path from "path";
import { SafeHandle, IpcEvent, assertValidId, assertValid, safeMerge } from "../common";
import {
    StoredTheme,
    ThemeInput,
    ThemeInputSchema,
    ThemeColorsSchema,
} from "../../../shared/schemas";
import { z } from "zod";

export type ThemeStore = {
    list: () => Promise<StoredTheme[]>;
    save: (input: ThemeInput) => Promise<StoredTheme[]>;
    delete: (id: string) => Promise<StoredTheme[]>;
};

/** Schema for theme:push payload */
const ThemePushPayloadSchema = z.object({
    colors: ThemeColorsSchema.partial().optional(),
    builtin: z.object({
        tabActive: z.string().optional(),
    }).optional(),
}).passthrough();

/** Type for theme snapshot (persisted state) */
type ThemeSnapshot = z.infer<typeof ThemePushPayloadSchema> | null;

export type ThemeHandlerOptions = {
    themes: ThemeStore;
};

export function registerThemeHandlers(
    safeHandle: SafeHandle,
    opts: ThemeHandlerOptions,
    logErr: (msg: unknown) => void
): void {
    const themeSnapshotPath = path.join(app.getPath("userData"), "themeSnapshot.json");
    const tabActiveColorPath = path.join(app.getPath("userData"), "tabActiveColor.json");

    let themeSnapshot: ThemeSnapshot = null;

    async function loadTabActiveColorFromFile(): Promise<string | null> {
        try {
            const raw = await fs.readFile(tabActiveColorPath, "utf-8");
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.color === "string" && parsed.color.trim()) {
                return parsed.color;
            }
        } catch (err) {
            if (err && typeof err === "object" && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
                return null;
            }
            logErr(err);
        }
        return null;
    }

    async function saveTabActiveColorToFile(color: string | null) {
        if (!color) {
            try {
                await fs.unlink(tabActiveColorPath);
            } catch (err) {
                if (!(err && typeof err === "object" && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT")) {
                    logErr(err);
                }
            }
            return;
        }
        try {
            await fs.mkdir(path.dirname(tabActiveColorPath), { recursive: true });
            await fs.writeFile(tabActiveColorPath, JSON.stringify({ color }, null, 2), "utf-8");
        } catch (err) {
            logErr(err);
        }
    }

    async function loadThemeSnapshot() {
        try {
            const raw = await fs.readFile(themeSnapshotPath, "utf-8");
            return JSON.parse(raw);
        } catch (err) {
            if (err && typeof err === "object" && "code" in err && (err as NodeJS.ErrnoException).code !== "ENOENT") {
                logErr(err);
            }
            return null;
        }
    }

    async function persistThemeSnapshot(snapshot: ThemeSnapshot) {
        try {
            await fs.mkdir(path.dirname(themeSnapshotPath), { recursive: true });
            await fs.writeFile(themeSnapshotPath, JSON.stringify(snapshot, null, 2), "utf-8");
        } catch (err) {
            logErr(err);
        }
    }

    // Load theme snapshot on initialization
    loadThemeSnapshot().then((snap) => {
        if (snap) themeSnapshot = snap;
    }).catch(logErr);

    safeHandle("themes:list", async () => await opts.themes.list());

    safeHandle("themes:save", async (_e: IpcEvent, input: unknown) => {
        assertValid(ThemeInputSchema, input, "theme input");
        return await opts.themes.save(input);
    });

    safeHandle("themes:delete", async (_e: IpcEvent, id: string) => {
        assertValidId(id, "themeId");
        return await opts.themes.delete(id);
    });

    safeHandle("tabActiveColor:load", async () => await loadTabActiveColorFromFile());

    safeHandle("tabActiveColor:save", async (_e: IpcEvent, color: string | null) => {
        await saveTabActiveColorToFile(color);
        return true;
    });

    safeHandle("theme:push", async (_e: IpcEvent, payload: unknown) => {
        assertValid(ThemePushPayloadSchema, payload, "theme push payload");
        const merged = safeMerge(themeSnapshot ?? {}, payload ?? {});
        if (themeSnapshot?.colors || payload?.colors) {
            merged.colors = safeMerge(themeSnapshot?.colors ?? {}, payload?.colors ?? {});
        }
        themeSnapshot = merged;
        persistThemeSnapshot(merged).catch(logErr);
        try {
            const { BrowserWindow } = await import("electron");
            for (const w of BrowserWindow.getAllWindows()) {
                if (!w.isDestroyed()) {
                    w.webContents.send("theme:update", merged);
                }
            }
        } catch (err) {
            logErr(err);
        }
        return true;
    });

    safeHandle("theme:current", async () => {
        if (themeSnapshot === null) {
            themeSnapshot = await loadThemeSnapshot();
        }
        return themeSnapshot;
    });
}

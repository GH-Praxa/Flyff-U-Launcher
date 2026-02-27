/**
 * IPC handlers for profile export / import (.flyffprofile ZIP format).
 *
 * Format (ZIP):
 *   manifest.json      – { version, exportedAt, launcherVersion }
 *   profile.json       – Profile metadata (name, job, launchMode, …)
 *   cookies.json       – Electron session cookies for the partition
 *   localstorage.json  – Game localStorage (login session, settings, …)
 */
import { dialog, session, app, BrowserWindow } from "electron";
import type { BrowserView } from "electron";
import path from "path";
import fsp from "fs/promises";
import AdmZip from "adm-zip";
import type { SafeHandle, IpcEvent } from "../common";
import type { ProfilesStore } from "./profiles";

const FLYFF_PROFILE_EXT = "flyffprofile";
const FLYFF_PROFILE_FILTER = [{ name: "Flyff Profile", extensions: [FLYFF_PROFILE_EXT] }];
const MANIFEST_VERSION = 2; // bumped: now includes localstorage
const LS_TIMEOUT_MS = 20_000;

function safeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_ ]/g, "_").trim() || "profile";
}

function reconstructUrl(cookie: Electron.Cookie): string {
    const domain = (cookie.domain ?? "").replace(/^\./, "");
    return `http${cookie.secure ? "s" : ""}://${domain}${cookie.path ?? "/"}`;
}

// ── localStorage helpers ─────────────────────────────────────────────────────

const DUMP_JS = `(function(){
    try {
        var r = {};
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k !== null) r[k] = localStorage.getItem(k);
        }
        return JSON.stringify(r);
    } catch(e) { return "{}"; }
})()`;

function buildRestoreJS(data: Record<string, string>): string {
    return `(function(){
        try {
            var d = ${JSON.stringify(data)};
            for (var k in d) { try { localStorage.setItem(k, d[k]); } catch(e) {} }
            return true;
        } catch(e) { return false; }
    })()`;
}

/**
 * Reads localStorage for the given profile.
 * Uses an existing WebContents if available, otherwise opens a temporary hidden window.
 */
async function readLocalStorage(
    profileId: string,
    getViewByProfile: (id: string) => BrowserView | null,
    flyffUrl: string,
): Promise<Record<string, string>> {
    // Fast path: use the already-open game tab
    const view = getViewByProfile(profileId);
    if (view && !view.webContents.isDestroyed()) {
        try {
            const raw = await view.webContents.executeJavaScript(DUMP_JS);
            if (typeof raw === "string") return JSON.parse(raw) as Record<string, string>;
        } catch { /* fall through */ }
    }

    // Slow path: spin up a hidden window under the same partition
    return new Promise<Record<string, string>>((resolve) => {
        const win = new BrowserWindow({
            show: false,
            webPreferences: {
                partition: `persist:${profileId}`,
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
            },
        });

        let settled = false;
        const finish = (data: Record<string, string>) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { win.destroy(); } catch { /* already gone */ }
            resolve(data);
        };

        const timer = setTimeout(() => finish({}), LS_TIMEOUT_MS);

        win.webContents.once("dom-ready", async () => {
            try {
                const raw = await win.webContents.executeJavaScript(DUMP_JS);
                finish(typeof raw === "string" ? JSON.parse(raw) as Record<string, string> : {});
            } catch {
                finish({});
            }
        });

        win.webContents.loadURL(flyffUrl).catch(() => finish({}));
    });
}

/**
 * Writes localStorage entries for a new partition via a temporary hidden window.
 * Returns immediately if data is empty.
 */
async function writeLocalStorage(
    profileId: string,
    data: Record<string, string>,
    flyffUrl: string,
): Promise<void> {
    if (Object.keys(data).length === 0) return;

    return new Promise<void>((resolve) => {
        const win = new BrowserWindow({
            show: false,
            webPreferences: {
                partition: `persist:${profileId}`,
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
            },
        });

        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { win.destroy(); } catch { /* already gone */ }
            resolve();
        };

        const timer = setTimeout(finish, LS_TIMEOUT_MS);

        win.webContents.once("dom-ready", async () => {
            try { await win.webContents.executeJavaScript(buildRestoreJS(data)); } catch { /* non-fatal */ }
            finish();
        });

        win.webContents.loadURL(flyffUrl).catch(finish);
    });
}

// ── Handler registration ─────────────────────────────────────────────────────

export type ProfileTransferOptions = {
    getViewByProfile: (profileId: string) => BrowserView | null;
    flyffUrl: string;
};

export function registerProfileTransferHandlers(
    safeHandle: SafeHandle,
    profiles: ProfilesStore,
    transferOpts: ProfileTransferOptions,
): void {
    const { getViewByProfile, flyffUrl } = transferOpts;

    // ── Export ──────────────────────────────────────────────────────────────
    safeHandle("profiles:export", async (_e: IpcEvent, profileId: unknown) => {
        if (typeof profileId !== "string" || !profileId) {
            throw new Error("Invalid profileId");
        }

        const allProfiles = await profiles.list();
        const profile = allProfiles.find((p) => p.id === profileId);
        if (!profile) throw new Error("Profile not found");

        const ses = session.fromPartition(`persist:${profileId}`);
        const [cookies, localStorage] = await Promise.all([
            ses.cookies.get({}),
            readLocalStorage(profileId, getViewByProfile, flyffUrl),
        ]);

        const zip = new AdmZip();
        zip.addFile("manifest.json", Buffer.from(JSON.stringify({
            version: MANIFEST_VERSION,
            exportedAt: new Date().toISOString(),
            launcherVersion: app.getVersion(),
        }, null, 2)));
        zip.addFile("profile.json",      Buffer.from(JSON.stringify(profile, null, 2)));
        zip.addFile("cookies.json",      Buffer.from(JSON.stringify(cookies, null, 2)));
        zip.addFile("localstorage.json", Buffer.from(JSON.stringify(localStorage, null, 2)));

        const parentWin = BrowserWindow.fromWebContents(_e.sender) ?? undefined;
        const { canceled, filePath } = await dialog.showSaveDialog(parentWin!, {
            title: "Export profile",
            defaultPath: path.join(
                app.getPath("downloads"),
                `${safeFilename(profile.name)}.${FLYFF_PROFILE_EXT}`,
            ),
            filters: FLYFF_PROFILE_FILTER,
        });

        if (canceled || !filePath) return null;

        await fsp.writeFile(filePath, zip.toBuffer());
        return filePath;
    });

    // ── Import ──────────────────────────────────────────────────────────────
    safeHandle("profiles:import", async (_e: IpcEvent) => {
        const parentWin = BrowserWindow.fromWebContents(_e.sender) ?? undefined;
        const { canceled, filePaths } = await dialog.showOpenDialog(parentWin!, {
            title: "Import profile",
            filters: FLYFF_PROFILE_FILTER,
            properties: ["openFile"],
        });

        if (canceled || filePaths.length === 0) return null;

        const buf = await fsp.readFile(filePaths[0]);
        const zip = new AdmZip(buf);

        const profileEntry      = zip.getEntry("profile.json");
        const cookiesEntry      = zip.getEntry("cookies.json");
        const localStorageEntry = zip.getEntry("localstorage.json");

        if (!profileEntry || !cookiesEntry) {
            throw new Error("Invalid .flyffprofile file (missing entries)");
        }

        const importedProfile      = JSON.parse(profileEntry.getData().toString("utf-8")) as Record<string, unknown>;
        const importedCookies      = JSON.parse(cookiesEntry.getData().toString("utf-8")) as Electron.Cookie[];
        const importedLocalStorage = localStorageEntry
            ? JSON.parse(localStorageEntry.getData().toString("utf-8")) as Record<string, string>
            : {};

        // Create new profile (new unique ID)
        const profileName = typeof importedProfile.name === "string" ? importedProfile.name : "Imported Profile";
        const newList    = await profiles.create(profileName);
        const newProfile = newList[newList.length - 1];
        if (!newProfile) throw new Error("Failed to create profile during import");

        // Patch remaining fields (id + createdAt stay fresh)
        const { id: _id, createdAt: _ct, name: _n, ...rest } = importedProfile;
        await profiles.update({ id: newProfile.id, ...(rest as object) } as Parameters<ProfilesStore["update"]>[0]);

        // Restore cookies
        const ses = session.fromPartition(`persist:${newProfile.id}`);
        for (const cookie of importedCookies) {
            try {
                await ses.cookies.set({
                    url: reconstructUrl(cookie),
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain,
                    path: cookie.path,
                    secure: cookie.secure,
                    httpOnly: cookie.httpOnly,
                    expirationDate: cookie.expirationDate,
                    sameSite: cookie.sameSite,
                });
            } catch { /* non-fatal */ }
        }
        await ses.cookies.flushStore();

        // Restore localStorage
        await writeLocalStorage(newProfile.id, importedLocalStorage, flyffUrl);

        return newProfile;
    });
}

import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import { logWarn, logErr } from "../shared/logger";
import type { Locale } from "../shared/schemas";
import { translations, type TranslationKey } from "../i18n/translations";
import * as https from "node:https";

export interface AutoUpdaterDeps {
    getLocale: () => Locale;
    checkOnStart: boolean;
}

export function setupAutoUpdater(deps: AutoUpdaterDeps): void {
    const t = (key: TranslationKey, replacements?: Record<string, string>): string => {
        const locale = deps.getLocale();
        let text = translations[locale]?.[key] ?? translations.en[key] ?? key;
        if (replacements) {
            for (const [k, v] of Object.entries(replacements)) {
                text = text.replace(`{${k}}`, v);
            }
        }
        return text;
    };

    const feedConfig: Record<string, string> = {
        provider: "github",
        owner: "GH-Praxa",
        repo: "Flyff-U-Launcher",
    };
    if (process.env.GH_TOKEN) {
        feedConfig.token = process.env.GH_TOKEN;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    autoUpdater.setFeedURL(feedConfig as any);

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.disableDifferentialDownload = true; // our artifacts do not ship blockmaps

    let isManualCheck = false;

    autoUpdater.on("update-available", async (info) => {
        isManualCheck = false;
        const result = await dialog.showMessageBox({
            type: "info",
            title: t("update.available.title"),
            message: t("update.available.message", { version: info.version }),
            detail: t("update.available.detail"),
            buttons: [t("update.available.yes"), t("update.later")],
            defaultId: 0,
            cancelId: 1,
        });

        if (result.response === 0) {
            logWarn("User accepted update, starting download...", "AutoUpdater");
            autoUpdater.downloadUpdate()
                .then(() => {
                    logWarn("downloadUpdate() resolved successfully", "AutoUpdater");
                })
                .catch((err) => {
                    logErr(err, "AutoUpdater downloadUpdate");
                    const win = BrowserWindow.getAllWindows()[0];
                    if (win) win.setProgressBar(-1);
                    dialog.showErrorBox(t("update.error.title"), `${t("update.error.detail")}\n\n${String(err)}`);
                });
        }
    });

    autoUpdater.on("update-not-available", () => {
        if (isManualCheck) {
            isManualCheck = false;
            dialog.showMessageBox({
                type: "info",
                title: t("update.notAvailable.title" as TranslationKey),
                message: t("update.notAvailable.message" as TranslationKey),
            });
        }
    });

    autoUpdater.on("download-progress", (progress) => {
        const percent = Math.round(progress.percent);
        logWarn(`Download progress: ${percent}%`, "AutoUpdater");
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            win.setProgressBar(progress.percent / 100);
            win.setTitle(`Flyff Universe Launcher - Downloading update: ${percent}%`);
        }
    });

    autoUpdater.on("update-downloaded", () => {
        logWarn("Update downloaded, installing...", "AutoUpdater");
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            win.setProgressBar(-1);
            win.setTitle("Flyff Universe Launcher");
        }
        autoUpdater.quitAndInstall();
    });

    autoUpdater.on("error", (err) => {
        logErr(err, "AutoUpdater error event");
        const win = BrowserWindow.getAllWindows()[0];
        if (win) win.setProgressBar(-1);
        if (isManualCheck) {
            isManualCheck = false;
            dialog.showErrorBox(t("update.error.title"), `${t("update.error.detail")}\n\n${String(err)}`);
        }
    });

    // IPC handler for manual update check from renderer
    ipcMain.handle("app:checkForUpdates", async () => {
        isManualCheck = true;
        try {
            const result = await autoUpdater.checkForUpdates();
            return { ok: true, version: result?.updateInfo?.version ?? null };
        } catch (err) {
            isManualCheck = false;
            return { ok: false, error: String(err) };
        }
    });

    // ── List available GitHub releases ─────────────────────────────────
    ipcMain.handle("app:listReleases", async () => {
        try {
            const releases = await fetchGitHubReleases();
            const currentVersion = app.getVersion();
            const MIN_VERSION = "3.0.5";
            const filtered = releases.filter((r) => {
                const ver = r.tag_name.replace(/^v/, "");
                return compareVersions(ver, MIN_VERSION) >= 0;
            });
            return {
                ok: true,
                releases: filtered.map((r) => ({
                    version: r.tag_name.replace(/^v/, ""),
                    tag: r.tag_name,
                    name: r.name || r.tag_name,
                    date: r.published_at,
                    prerelease: r.prerelease,
                    current: r.tag_name.replace(/^v/, "") === currentVersion,
                })),
            };
        } catch (err) {
            logErr(err, "AutoUpdater listReleases");
            return { ok: false, error: String(err) };
        }
    });

    // ── Install a specific version (downgrade / rollback) ───────────
    ipcMain.handle("app:installVersion", async (_e, version: string) => {
        try {
            logWarn(`User requested install of version ${version}`, "AutoUpdater");
            // Point electron-updater to the specific release tag
            const versionFeed: Record<string, string> = {
                provider: "github",
                owner: "GH-Praxa",
                repo: "Flyff-U-Launcher",
            };
            if (process.env.GH_TOKEN) {
                versionFeed.token = process.env.GH_TOKEN;
            }
            autoUpdater.allowDowngrade = true;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            autoUpdater.setFeedURL(versionFeed as any);
            const result = await autoUpdater.checkForUpdates();
            if (!result?.updateInfo) {
                return { ok: false, error: "No update info returned" };
            }
            // If the found version matches what the user wants, download it
            if (result.updateInfo.version === version) {
                await autoUpdater.downloadUpdate();
                return { ok: true };
            }
            // Otherwise try direct download from GitHub release assets
            return { ok: false, error: `Version mismatch: found ${result.updateInfo.version}, wanted ${version}` };
        } catch (err) {
            logErr(err, "AutoUpdater installVersion");
            return { ok: false, error: String(err) };
        } finally {
            // Restore original feed config
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            autoUpdater.setFeedURL(feedConfig as any);
            autoUpdater.allowDowngrade = false;
        }
    });

    // Check for updates on startup (if enabled)
    if (deps.checkOnStart) {
        autoUpdater.checkForUpdates()
            .then((result) => {
                logWarn(`Update check result: ${JSON.stringify(result?.updateInfo?.version ?? "no update")}`, "AutoUpdater");
            })
            .catch((err) => {
                logErr(err, "AutoUpdater checkForUpdates");
            });
    }
}

// ── GitHub API helper ───────────────────────────────────────────────
interface GitHubRelease {
    tag_name: string;
    name: string | null;
    published_at: string;
    prerelease: boolean;
    draft: boolean;
}

function fetchGitHubReleases(): Promise<GitHubRelease[]> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: "api.github.com",
            path: "/repos/GH-Praxa/Flyff-U-Launcher/releases?per_page=30",
            headers: {
                "User-Agent": "Flyff-U-Launcher",
                Accept: "application/vnd.github+json",
                ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}),
            },
        };
        const req = https.get(options, (res) => {
            let data = "";
            res.on("data", (chunk: string) => (data += chunk));
            res.on("end", () => {
                try {
                    const releases = JSON.parse(data) as GitHubRelease[];
                    if (!Array.isArray(releases)) {
                        reject(new Error("Unexpected GitHub API response"));
                        return;
                    }
                    resolve(releases.filter((r) => !r.draft));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on("error", reject);
        req.end();
    });
}

function compareVersions(a: string, b: string): number {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const na = pa[i] ?? 0;
        const nb = pb[i] ?? 0;
        if (na !== nb) return na - nb;
    }
    return 0;
}

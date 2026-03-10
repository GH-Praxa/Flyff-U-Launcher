import { BrowserWindow, dialog, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import { logWarn, logErr } from "../shared/logger";
import type { Locale } from "../shared/schemas";
import { translations, type TranslationKey } from "../i18n/translations";

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

import { BrowserWindow, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import { logWarn, logErr } from "../shared/logger";
import type { Locale } from "../shared/schemas";
import { translations, type TranslationKey } from "../i18n/translations";

export interface AutoUpdaterDeps {
    getLocale: () => Locale;
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
    autoUpdater.setFeedURL(feedConfig);

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.disableDifferentialDownload = true; // our artifacts do not ship blockmaps

    autoUpdater.on("update-available", async (info) => {
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
        dialog.showErrorBox(t("update.error.title"), `${t("update.error.detail")}\n\n${String(err)}`);
    });

    // Check for updates on startup
    autoUpdater.checkForUpdates()
        .then((result) => {
            logWarn(`Update check result: ${JSON.stringify(result?.updateInfo?.version ?? "no update")}`, "AutoUpdater");
        })
        .catch((err) => {
            logErr(err, "AutoUpdater checkForUpdates");
            dialog.showErrorBox("Update Check Failed", `Could not check for updates:\n\n${String(err)}`);
        });
}

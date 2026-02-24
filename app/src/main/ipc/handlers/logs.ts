import { app } from "electron";
import path from "path";
import fsp from "fs/promises";
import { getLogEntries, clearLogEntries } from "../../../shared/logger";
import type { SafeHandle } from "../common";
import type { ClientSettingsStore } from "../../clientSettings/store";
import { openLogsWindow } from "../../windows/logsWindow";
import type { Locale } from "../../../shared/schemas";

const SEND_COOLDOWN_MS = 60_000;
let lastSendTs: number | null = null;

export function registerLogsHandlers(
    safeHandle: SafeHandle,
    clientSettings: ClientSettingsStore,
    windowOpts?: { preloadPath: string; getLocale: () => Locale },
): void {
    safeHandle("logs:get", async () => {
        return { ok: true, data: getLogEntries() };
    });

    safeHandle("logs:clear", async () => {
        clearLogEntries();
        return { ok: true, data: true };
    });

    safeHandle("logs:save", async () => {
        const now = new Date();
        const pad = (n: number, len = 2) => String(n).padStart(len, "0");
        const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const logsDir = path.join(app.getPath("userData"), "user", "logs");
        await fsp.mkdir(logsDir, { recursive: true });
        const filePath = path.join(logsDir, `errors-${stamp}.txt`);
        const entries = getLogEntries();
        const lines = entries.map((e) => {
            const d = new Date(e.ts);
            const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            return `[${time}] [${e.level.toUpperCase()}] [${e.module}] ${e.message}`;
        });
        await fsp.writeFile(filePath, lines.join("\n"), "utf-8");
        return { ok: true, data: filePath };
    });

    safeHandle("logs:sendToDiscord", async (_event, userNote: unknown, userName: unknown) => {
        // Cooldown check
        if (lastSendTs !== null) {
            const elapsed = Date.now() - lastSendTs;
            if (elapsed < SEND_COOLDOWN_MS) {
                return { ok: true, data: { cooldownMs: SEND_COOLDOWN_MS - elapsed } };
            }
        }

        const settings = await clientSettings.get();
        const webhookUrl = settings.logsWebhook;
        if (!webhookUrl) {
            return { ok: true, data: { noWebhook: true } };
        }

        const entries = getLogEntries();
        if (!entries.length) {
            return { ok: true, data: { noLogs: true } };
        }

        const pad = (n: number) => String(n).padStart(2, "0");
        const lines = entries.map((e) => {
            const d = new Date(e.ts);
            const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            return `[${time}] [${e.level.toUpperCase()}] [${e.module}] ${e.message}`;
        });

        // Keep the most recent entries that fit within Discord's embed limit
        const MAX_CHARS = 3800;
        let logText = lines.join("\n");
        if (logText.length > MAX_CHARS) {
            logText = "...(truncated)\n" + logText.slice(-MAX_CHARS);
        }

        const noteStr = typeof userNote === "string" && userNote.trim() ? userNote.trim() : null;
        const nameStr = typeof userName === "string" && userName.trim() ? userName.trim() : null;

        type EmbedField = { name: string; value: string; inline?: boolean };
        const fields: EmbedField[] = [];
        if (noteStr) fields.push({ name: "When / how does the error occur?", value: noteStr });
        if (nameStr) fields.push({ name: "Reported by", value: nameStr, inline: true });

        const payload = {
            username: "Flyff-U-Launcher",
            embeds: [{
                title: "Error Logs",
                description: "```\n" + logText + "\n```",
                color: 0xff3b4f,
                fields,
                footer: { text: `v${app.getVersion()} \u2022 ${process.platform}` },
                timestamp: new Date().toISOString(),
            }],
            allowed_mentions: { parse: [] as string[] },
        };

        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => "");
            throw new Error(`Discord webhook failed: ${response.status}${errText ? ` ${errText}` : ""}`);
        }

        lastSendTs = Date.now();
        return { ok: true, data: { sent: true } };
    });

    safeHandle("logs:openWindow", async () => {
        if (!windowOpts) return { ok: true, data: false };
        openLogsWindow({ preloadPath: windowOpts.preloadPath, locale: windowOpts.getLocale() });
        return { ok: true, data: true };
    });
}

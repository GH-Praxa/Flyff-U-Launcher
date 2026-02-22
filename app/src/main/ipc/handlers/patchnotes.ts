import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import type { SafeHandle } from "../common";
import { SUPPORTED_LOCALES, type Locale } from "../../../shared/schemas";
// Embed patchnotes as a fallback when external resources are missing (e.g., packaged installs)
import changelog_en from "../../../../patchnotes/CHANGELOG_en.md?raw";
import changelog_de from "../../../../patchnotes/CHANGELOG_de.md?raw";
import changelog_pl from "../../../../patchnotes/CHANGELOG_pl.md?raw";
import changelog_fr from "../../../../patchnotes/CHANGELOG_fr.md?raw";
import changelog_ru from "../../../../patchnotes/CHANGELOG_ru.md?raw";
import changelog_tr from "../../../../patchnotes/CHANGELOG_tr.md?raw";
import changelog_cn from "../../../../patchnotes/CHANGELOG_cn.md?raw";
import changelog_jp from "../../../../patchnotes/CHANGELOG_jp.md?raw";

const embeddedPatchnotes: Record<Locale, string> = {
    en: changelog_en,
    de: changelog_de,
    pl: changelog_pl,
    fr: changelog_fr,
    ru: changelog_ru,
    tr: changelog_tr,
    cn: changelog_cn,
    jp: changelog_jp,
};

/**
 * Gets the path to the patchnotes folder.
 * Works for development and packaged (asar/unpacked) builds.
 */
function getPatchnotesPath(): string {
    const candidates = [
        // If added via extraResources (preferred)
        path.join(process.resourcesPath, "patchnotes"),
        // Legacy app folder (non-asar)
        path.join(process.resourcesPath, "app", "patchnotes"),
        // Unpacked asar payloads
        path.join(process.resourcesPath, "app.asar.unpacked", "patchnotes"),
        // Inside asar (app.getAppPath points to app.asar when packaged)
        path.join(app.getAppPath(), "patchnotes"),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    // Last resort: fall back to app path (may still succeed if virtual asar fs resolves later)
    return path.join(app.getAppPath(), "patchnotes");
}

/**
 * Loads the patchnotes markdown file for a given locale.
 * Falls back to English if the requested locale is not available.
 */
function loadPatchnotes(locale: Locale): string {
    const patchnotesDir = getPatchnotesPath();
    const filePath = path.join(patchnotesDir, `CHANGELOG_${locale}.md`);

    // Try the requested locale first
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, "utf-8");
    }

    // Fallback to English
    const fallbackPath = path.join(patchnotesDir, "CHANGELOG_en.md");
    if (fs.existsSync(fallbackPath)) {
        return fs.readFileSync(fallbackPath, "utf-8");
    }

    // If files are missing (e.g., extra resources not bundled), fall back to embedded content
    if (embeddedPatchnotes[locale]) {
        return embeddedPatchnotes[locale];
    }
    return embeddedPatchnotes.en ?? "# Patchnotes\n\nNo patchnotes available.";
}

/**
 * Validates that the locale is a supported locale.
 */
function isValidLocale(locale: unknown): locale is Locale {
    return typeof locale === "string" && SUPPORTED_LOCALES.includes(locale as Locale);
}

export function registerPatchnotesHandlers(safeHandle: SafeHandle): void {
    safeHandle("patchnotes:get", (_e, locale: unknown) => {
        const validLocale = isValidLocale(locale) ? locale : "en";
        return loadPatchnotes(validLocale);
    });
}

import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import type { SafeHandle } from "../common";
import { SUPPORTED_LOCALES, type Locale } from "../../../shared/schemas";

/**
 * Gets the path to the patchnotes folder.
 * Works for both development and packaged (asar) builds.
 *
 * In packaged builds `app.getAppPath()` resolves to `<resources>/app.asar`,
 * so we can append `patchnotes` and still read files inside the archive.
 */
function getPatchnotesPath(): string {
    const appPath = app.getAppPath();
    return path.join(appPath, "patchnotes");
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

    return "# Patchnotes\n\nNo patchnotes available.";
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

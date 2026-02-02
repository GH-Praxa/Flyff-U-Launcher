import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import type { SafeHandle } from "../common";
import { SUPPORTED_LOCALES, type Locale } from "../../../shared/schemas";
// Embed documentation as a fallback when external resources are missing (e.g., packaged installs)
import docs_en from "../../../../docs/documentation_en.md?raw";
import docs_de from "../../../../docs/documentation_de.md?raw";
import docs_pl from "../../../../docs/documentation_pl.md?raw";
import docs_fr from "../../../../docs/documentation_fr.md?raw";
import docs_ru from "../../../../docs/documentation_ru.md?raw";
import docs_tr from "../../../../docs/documentation_tr.md?raw";
import docs_cn from "../../../../docs/documentation_cn.md?raw";
import docs_jp from "../../../../docs/documentation_jp.md?raw";

const embeddedDocumentation: Record<Locale, string> = {
    en: docs_en,
    de: docs_de,
    pl: docs_pl,
    fr: docs_fr,
    ru: docs_ru,
    tr: docs_tr,
    cn: docs_cn,
    jp: docs_jp,
};

/**
 * Gets the path to the docs folder.
 * Works for development and packaged (asar/unpacked) builds.
 */
function getDocsPath(): string {
    // In development, app.getAppPath() points to .vite/build, so we need to go up
    const appPath = app.getAppPath();
    const isDev = appPath.includes(".vite");

    const candidates = [
        // Development mode: go up from .vite/build to app/docs
        ...(isDev ? [path.join(appPath, "..", "..", "docs")] : []),
        // If added via extraResources (preferred for packaged builds)
        path.join(process.resourcesPath, "docs"),
        // Legacy app folder (non-asar)
        path.join(process.resourcesPath, "app", "docs"),
        // Unpacked asar payloads
        path.join(process.resourcesPath, "app.asar.unpacked", "docs"),
        // Inside asar (app.getAppPath points to app.asar when packaged)
        path.join(appPath, "docs"),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    // Last resort: fall back to app path (may still succeed if virtual asar fs resolves later)
    return path.join(appPath, "docs");
}

/**
 * Gets the MIME type for an image based on file extension.
 */
function getImageMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
    };
    return mimeTypes[ext] || "image/png";
}

/**
 * Converts an image file to a base64 data URL.
 */
function imageToDataUrl(imagePath: string): string | null {
    try {
        if (!fs.existsSync(imagePath)) {
            return null;
        }
        const imageBuffer = fs.readFileSync(imagePath);
        const base64 = imageBuffer.toString("base64");
        const mimeType = getImageMimeType(imagePath);
        return `data:${mimeType};base64,${base64}`;
    } catch {
        return null;
    }
}

/**
 * Processes markdown content and embeds images as base64 data URLs.
 */
function embedImages(content: string, assetsPath: string): string {
    // eslint-disable-next-line no-console
    console.log("[Documentation] Assets path:", assetsPath);
    // Replace ![alt](filename) with embedded base64 images
    return content.replace(
        /!\[([^\]]*)\]\(([^)]+)\)/g,
        (match, alt, src) => {
            // Skip external URLs
            if (src.startsWith("http://") || src.startsWith("https://")) {
                return match;
            }
            const imagePath = path.join(assetsPath, "screenshots", src);
            // eslint-disable-next-line no-console
            console.log("[Documentation] Looking for image:", imagePath, "exists:", fs.existsSync(imagePath));
            const dataUrl = imageToDataUrl(imagePath);
            if (dataUrl) {
                return `![${alt}](${dataUrl})`;
            }
            // Return original if image not found
            return match;
        }
    );
}

/**
 * Loads the documentation markdown file for a given locale.
 * Falls back to English if the requested locale is not available.
 * Images are embedded as base64 data URLs.
 */
function loadDocumentation(locale: Locale): string {
    const docsDir = getDocsPath();
    const assetsPath = path.join(docsDir, "assets");
    const filePath = path.join(docsDir, `documentation_${locale}.md`);

    let content: string;

    // Try the requested locale first
    if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, "utf-8");
    } else {
        // Fallback to English
        const fallbackPath = path.join(docsDir, "documentation_en.md");
        if (fs.existsSync(fallbackPath)) {
            content = fs.readFileSync(fallbackPath, "utf-8");
        } else {
            // If files are missing, fall back to embedded content
            content = embeddedDocumentation[locale] ?? embeddedDocumentation.en ?? "# Documentation\n\nNo documentation available.";
        }
    }

    // Embed images as base64
    return embedImages(content, assetsPath);
}

/**
 * Returns the base path for documentation assets (images, videos).
 * Used by the renderer to resolve relative asset paths.
 */
function getDocsAssetsPath(): string {
    const docsDir = getDocsPath();
    return path.join(docsDir, "assets");
}

/**
 * Validates that the locale is a supported locale.
 */
function isValidLocale(locale: unknown): locale is Locale {
    return typeof locale === "string" && SUPPORTED_LOCALES.includes(locale as Locale);
}

export function registerDocumentationHandlers(safeHandle: SafeHandle): void {
    safeHandle("documentation:get", (_e, locale: unknown) => {
        const validLocale = isValidLocale(locale) ? locale : "en";
        return {
            content: loadDocumentation(validLocale),
            assetsPath: getDocsAssetsPath(),
        };
    });
}

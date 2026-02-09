/**
 * AppData Migration – helpers & types
 *
 * Contains the low-level filesystem helpers used by the migration runner
 * and the MigrationEntry interface shared across the migration system.
 */
import fs from "fs/promises";
import path from "path";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface MigrationEntry {
    oldRel: string;
    newRel: string;
    type: "file" | "dir";
}

// ────────────────────────────────────────────────────────────────────────────
// Legacy directories to remove if empty after migration
// ────────────────────────────────────────────────────────────────────────────

export const LEGACY_CLEANUP = [
    "debug",
    "ocr-debug",
    // Intermediate directories from v2.3.0 migration
    "config",
    "profiles",
    "ui",
    "shopping",
    "logs",
];

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

export async function exists(p: string): Promise<boolean> {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

export async function copyDir(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

export async function removeDir(dir: string): Promise<void> {
    await fs.rm(dir, { recursive: true, force: true });
}

export async function removeDirIfEmpty(dir: string): Promise<void> {
    try {
        const entries = await fs.readdir(dir);
        if (entries.length === 0) {
            await fs.rmdir(dir);
        }
    } catch {
        // Directory doesn't exist or can't be read – fine.
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Single-entry executor (used by migrationRunner)
// ────────────────────────────────────────────────────────────────────────────

export async function executeEntry(userDataPath: string, entry: MigrationEntry): Promise<void> {
    const oldPath = path.join(userDataPath, entry.oldRel);
    const newPath = path.join(userDataPath, entry.newRel);

    if (!(await exists(oldPath))) return;
    if (await exists(newPath)) return;

    await fs.mkdir(path.dirname(newPath), { recursive: true });

    if (entry.type === "dir") {
        await copyDir(oldPath, newPath);
        await removeDir(oldPath);
    } else {
        await fs.rename(oldPath, newPath);
    }

    console.log(`[Migration] ${entry.oldRel} -> ${entry.newRel}`);
}

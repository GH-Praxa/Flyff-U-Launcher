/**
 * Migration Runner – version-gated, resumable migration executor.
 *
 * Reads `.migration-version` to determine which migration sets have already
 * been applied. Executes pending sets in order with per-entry progress
 * tracking for interruption safety.
 */
import fs from "fs/promises";
import path from "path";
import semver from "semver";
import { MIGRATION_SETS, LEGACY_SENTINEL_FILES } from "./migrationRegistry";
import { executeEntry, exists, removeDirIfEmpty, LEGACY_CLEANUP } from "./appDataMigration";

const VERSION_FILE = "user/config/.migration-version";
const PROGRESS_FILE = "user/config/.migration-progress.json";

interface ProgressFile {
    version: string;
    completedEntries: number;
    totalEntries: number;
}

async function readVersionFile(userDataPath: string): Promise<string | null> {
    const filePath = path.join(userDataPath, VERSION_FILE);
    try {
        const content = (await fs.readFile(filePath, "utf-8")).trim();
        return semver.valid(content) ? content : null;
    } catch {
        return null;
    }
}

async function writeVersionFile(userDataPath: string, version: string): Promise<void> {
    const filePath = path.join(userDataPath, VERSION_FILE);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, version, "utf-8");
}

async function readProgressFile(userDataPath: string): Promise<ProgressFile | null> {
    const filePath = path.join(userDataPath, PROGRESS_FILE);
    try {
        const content = await fs.readFile(filePath, "utf-8");
        return JSON.parse(content) as ProgressFile;
    } catch {
        return null;
    }
}

async function writeProgressFile(userDataPath: string, progress: ProgressFile): Promise<void> {
    const filePath = path.join(userDataPath, PROGRESS_FILE);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(progress), "utf-8");
}

async function deleteProgressFile(userDataPath: string): Promise<void> {
    const filePath = path.join(userDataPath, PROGRESS_FILE);
    try {
        await fs.unlink(filePath);
    } catch {
        // File may not exist — that's fine.
    }
}

async function isFreshInstall(userDataPath: string): Promise<boolean> {
    for (const sentinel of LEGACY_SENTINEL_FILES) {
        if (await exists(path.join(userDataPath, sentinel))) {
            return false;
        }
    }
    return true;
}

function getPendingSets(currentVersion: string | null): typeof MIGRATION_SETS {
    if (currentVersion === null) return MIGRATION_SETS;
    return MIGRATION_SETS.filter(set => semver.gt(set.version, currentVersion));
}

export interface MigrationProgress {
    current: number;
    total: number;
    label: string;
    setLabel: string;
}

/**
 * Quick check whether any migrations need to run.
 * Used by main.ts to decide if the migration window should be shown.
 */
export async function hasPendingMigrations(userDataPath: string): Promise<boolean> {
    const storedVersion = await readVersionFile(userDataPath);

    // Resume in progress?
    const progress = await readProgressFile(userDataPath);
    if (progress) return true;

    // Fresh install — no legacy data, no version file
    if (storedVersion === null && await isFreshInstall(userDataPath)) {
        return false;
    }

    return getPendingSets(storedVersion).length > 0;
}

/**
 * Execute all pending migration sets with progress reporting.
 *
 * - Skips sets already applied (version <= stored version)
 * - Resumes from last incomplete entry if a progress file exists
 * - Calls `onProgress` before each entry for UI updates
 * - Errors on individual entries are logged but never thrown
 */
export async function runMigrations(
    userDataPath: string,
    onProgress?: (progress: MigrationProgress) => void,
): Promise<void> {
    const storedVersion = await readVersionFile(userDataPath);

    // Fresh install — stamp version file, skip all migrations
    if (storedVersion === null && await isFreshInstall(userDataPath)) {
        const latestVersion = MIGRATION_SETS[MIGRATION_SETS.length - 1]?.version;
        if (latestVersion) {
            await writeVersionFile(userDataPath, latestVersion);
        }
        return;
    }

    // Check for in-progress migration (resume after crash)
    const existingProgress = await readProgressFile(userDataPath);

    const pendingSets = getPendingSets(storedVersion);

    // Calculate total entries across all pending sets
    let totalEntries = 0;
    for (const set of pendingSets) {
        totalEntries += set.entries.length;
    }

    let globalCurrent = 0;

    for (const set of pendingSets) {
        // Determine resume offset for this set
        let startIndex = 0;
        if (existingProgress && existingProgress.version === set.version) {
            startIndex = existingProgress.completedEntries;
            globalCurrent += startIndex;
        }

        for (let i = startIndex; i < set.entries.length; i++) {
            const entry = set.entries[i];
            globalCurrent++;

            // Report progress
            onProgress?.({
                current: globalCurrent,
                total: totalEntries,
                label: `${entry.oldRel} → ${entry.newRel}`,
                setLabel: set.label,
            });

            // Write progress file BEFORE executing (for resume on crash)
            await writeProgressFile(userDataPath, {
                version: set.version,
                completedEntries: i,
                totalEntries: set.entries.length,
            });

            try {
                await executeEntry(userDataPath, entry);
            } catch (err) {
                console.warn(`[Migration] failed: ${entry.oldRel} -> ${entry.newRel}`, err);
            }
        }

        // Set completed — update version file, delete progress
        await writeVersionFile(userDataPath, set.version);
        await deleteProgressFile(userDataPath);
    }

    // Clean up empty legacy directories
    for (const rel of LEGACY_CLEANUP) {
        await removeDirIfEmpty(path.join(userDataPath, rel));
    }
}

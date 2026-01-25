/**
 * Generic file-based JSON store abstraction.
 * Reduces code duplication across profiles, layouts, themes, and ROI stores.
 */
import fs from "fs/promises";
import path from "path";
import { logErr } from "./logger";

export interface FileStoreOptions<T> {
    /** Function that returns the file path */
    getPath: () => string;
    /** Function to normalize/validate a single item from raw JSON */
    normalize: (raw: unknown) => T | null;
    /** Optional: ensure directory exists before writing (default: true) */
    ensureDir?: boolean;
}

/**
 * Creates a generic file store for reading/writing JSON arrays.
 */
export function createFileStore<T>(opts: FileStoreOptions<T>) {
    const { getPath, normalize, ensureDir = true } = opts;
    let lock = Promise.resolve(); // Initialize lock as a resolved promise

    /**
     * Reads and normalizes items from the JSON file.
     * Returns empty array if file doesn't exist or is invalid.
     */
    async function read(): Promise<T[]> {
        try {
            const raw = await fs.readFile(getPath(), "utf-8");
            const parsed = JSON.parse(raw);
            const arr = Array.isArray(parsed) ? parsed : [];
            return arr.map(normalize).filter((x): x is T => x !== null);
        } catch (err) {
            // Return empty array for missing file or parse errors
            if (err && typeof err === "object" && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
                return [];
            }
            logErr(err, "FileStore");
            return [];
        }
    }

    /**
     * Writes items to the JSON file.
     * Optionally creates the directory if it doesn't exist.
     */
    async function write(items: T[]): Promise<void> {
        const filePath = getPath();
        if (ensureDir) {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
        }
        await fs.writeFile(filePath, JSON.stringify(items, null, 2), "utf-8");
    }

    /**
     * Finds an item by ID (assumes items have an 'id' property).
     */
    async function findById(id: string): Promise<T | null> {
        const items = await read();
        return items.find((item) => (item as { id?: string }).id === id) ?? null;
    }

    /**
     * Updates items by applying a transform function.
     * Returns the new list after writing.
     */
    async function update(transform: (items: T[]) => T[]): Promise<T[]> {
        // Wait for the previous write operation to complete
        await lock;

        // Create a new promise for the current write operation
        let releaseLock: () => void;
        lock = new Promise((resolve) => {
            releaseLock = resolve;
        });

        try {
            const items = await read();
            const next = transform(items);
            await write(next);
            return next;
        } finally {
            // Release the lock when the operation is done, regardless of success or failure
            releaseLock!();
        }
    }

    return {
        read,
        write,
        findById,
        update,
        getPath,
    };
}

export type FileStore<T> = ReturnType<typeof createFileStore<T>>;

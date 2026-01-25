/**
 * Secure module loader for dynamically loaded code.
 * Provides path validation and integrity checks to prevent loading malicious code.
 */
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { logWarn, logErr } from "../../shared/logger";

/**
 * Validates that a path is safe to load (no path traversal, within app directory).
 */
export function validateModulePath(modulePath: string): { valid: boolean; error?: string } {
    if (!modulePath || typeof modulePath !== "string") {
        return { valid: false, error: "Module path must be a non-empty string" };
    }

    // Resolve to absolute path
    const resolvedPath = path.resolve(modulePath);
    const appPath = app.getAppPath();
    const appDir = path.resolve(appPath);

    // Check if path is within the app directory
    if (!resolvedPath.startsWith(appDir + path.sep) && resolvedPath !== appDir) {
        return {
            valid: false,
            error: `Module path must be within app directory: ${resolvedPath} is not in ${appDir}`
        };
    }

    // Check for path traversal attempts
    const relativePath = path.relative(appDir, resolvedPath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        return { valid: false, error: "Path traversal detected" };
    }

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
        return { valid: false, error: `Module file not found: ${resolvedPath}` };
    }

    // Check if it's a file (not a directory)
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
        return { valid: false, error: "Module path must be a file" };
    }

    return { valid: true };
}

/**
 * Calculates SHA256 hash of a file.
 */
export function calculateFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Known good hashes for production modules.
 * These hashes are updated with each release to ensure module integrity.
 *
 * To calculate a module hash:
 *   node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('./path/to/module.js')).digest('hex'))"
 *
 * Format: { [moduleName]: expectedHash }
 */
const KNOWN_HASHES: Record<string, string> = {
    // Buff-Wecker module hash (update when mainLoader.js changes)
    "buff-wecker/mainLoader.js": "f9d405a5ae8ba382d2d14dd90ad8592caf518404e5ec4c2ed5d09b0d9c8589f9",
    // Local development override (optional, for testing)
    // "buff-wecker-local/mainLoader.js": "...",
};

/**
 * Options for secure module loading.
 */
export interface SecureLoadOptions {
    /** Skip hash validation (for development) */
    skipHashValidation?: boolean;
    /** Allow loading even if hash doesn't match (logs warning) */
    allowHashMismatch?: boolean;
    /** Module name for hash lookup */
    moduleName?: string;
}

/**
 * Securely validates a module before loading.
 * Returns the validated path if safe, throws error otherwise.
 */
export function validateModuleForLoading(
    modulePath: string,
    options: SecureLoadOptions = {}
): string {
    const { skipHashValidation = false, allowHashMismatch = false, moduleName } = options;

    // Step 1: Validate path
    const pathValidation = validateModulePath(modulePath);
    if (!pathValidation.valid) {
        throw new Error(`Module path validation failed: ${pathValidation.error}`);
    }

    const resolvedPath = path.resolve(modulePath);

    // Step 2: Check hash if in production and hash is known
    if (!skipHashValidation && !app.isPackaged) {
        logWarn("Skipping hash validation in development mode", "ModuleLoader");
    }

    if (!skipHashValidation && app.isPackaged && moduleName && KNOWN_HASHES[moduleName]) {
        const actualHash = calculateFileHash(resolvedPath);
        const expectedHash = KNOWN_HASHES[moduleName];

        if (actualHash !== expectedHash) {
            const message = `Hash mismatch for ${moduleName}: expected ${expectedHash}, got ${actualHash}`;
            if (allowHashMismatch) {
                logWarn(message, "ModuleLoader");
            } else {
                throw new Error(message);
            }
        }
    }

    // Step 3: Log the load for audit purposes
    if (app.isPackaged) {
        logWarn(`Loading external module: ${resolvedPath}`, "ModuleLoader");
    }

    return resolvedPath;
}

/**
 * Security audit information about a module.
 */
export interface ModuleAuditInfo {
    path: string;
    hash: string;
    size: number;
    mtime: Date;
    isWithinAppDir: boolean;
}

/**
 * Gets audit information about a module file.
 */
export function getModuleAuditInfo(modulePath: string): ModuleAuditInfo | null {
    try {
        const resolvedPath = path.resolve(modulePath);
        if (!fs.existsSync(resolvedPath)) {
            return null;
        }

        const stats = fs.statSync(resolvedPath);
        const appDir = path.resolve(app.getAppPath());

        return {
            path: resolvedPath,
            hash: calculateFileHash(resolvedPath),
            size: stats.size,
            mtime: stats.mtime,
            isWithinAppDir: resolvedPath.startsWith(appDir + path.sep),
        };
    } catch (err) {
        logErr(err, "ModuleLoader");
        return null;
    }
}

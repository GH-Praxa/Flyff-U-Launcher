/**
 * Plugin Sandbox
 *
 * Provides error isolation and security boundaries for plugin execution.
 * Catches and logs plugin errors without crashing the host application.
 */

import { logErr, logWarn } from "../../shared/logger";

// ============================================================================
// Types
// ============================================================================

export interface SandboxOptions {
    pluginId: string;
    timeout?: number; // Default: 30000ms
    onError?: (error: Error) => void;
}

export interface SandboxResult<T> {
    ok: boolean;
    data?: T;
    error?: Error;
    duration: number;
}

// ============================================================================
// Sandbox Execution
// ============================================================================

/**
 * Executes a function in a sandboxed context with error isolation.
 *
 * @param fn The function to execute
 * @param opts Sandbox options
 * @returns Promise with result or error
 */
export async function runInSandbox<T>(
    fn: () => T | Promise<T>,
    opts: SandboxOptions
): Promise<SandboxResult<T>> {
    const { pluginId, timeout = 30000, onError } = opts;
    const start = Date.now();

    try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new SandboxTimeoutError(pluginId, timeout));
            }, timeout);
        });

        // Race between execution and timeout
        const result = await Promise.race([
            Promise.resolve(fn()),
            timeoutPromise,
        ]);

        return {
            ok: true,
            data: result,
            duration: Date.now() - start,
        };
    } catch (err) {
        const error = normalizeError(err);

        // Log the error
        logErr(`[Plugin:${pluginId}] ${error.message}`, "Sandbox");

        // Call error callback if provided
        if (onError) {
            try {
                onError(error);
            } catch (callbackErr) {
                logWarn(`Error in onError callback: ${callbackErr}`, "Sandbox");
            }
        }

        return {
            ok: false,
            error,
            duration: Date.now() - start,
        };
    }
}

/**
 * Wraps a function to execute in sandbox context.
 *
 * @param fn The function to wrap
 * @param opts Sandbox options
 * @returns Wrapped function that returns SandboxResult
 */
export function wrapInSandbox<T extends (...args: unknown[]) => unknown>(
    fn: T,
    opts: SandboxOptions
): (...args: Parameters<T>) => Promise<SandboxResult<Awaited<ReturnType<T>>>> {
    return async (...args: Parameters<T>) => {
        return runInSandbox(() => fn(...args) as Awaited<ReturnType<T>>, opts);
    };
}

/**
 * Creates a sandboxed version of an async function that swallows errors.
 * Returns undefined on error instead of throwing.
 *
 * @param fn The function to wrap
 * @param opts Sandbox options
 * @returns Function that returns result or undefined on error
 */
export function safeSandbox<R>(
    fn: (...args: unknown[]) => R | Promise<R>,
    opts: SandboxOptions
): (...args: unknown[]) => Promise<R | undefined> {
    return async (...args: unknown[]): Promise<R | undefined> => {
        const result = await runInSandbox(() => fn(...args), opts);
        return result.ok ? (result.data as R) : undefined;
    };
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when a sandbox execution times out.
 */
export class SandboxTimeoutError extends Error {
    public readonly pluginId: string;
    public readonly timeoutMs: number;

    constructor(pluginId: string, timeoutMs: number) {
        super(`Plugin '${pluginId}' execution timed out after ${timeoutMs}ms`);
        this.name = "SandboxTimeoutError";
        this.pluginId = pluginId;
        this.timeoutMs = timeoutMs;
    }
}

/**
 * Error thrown when a plugin violates security constraints.
 */
export class SandboxSecurityError extends Error {
    public readonly pluginId: string;
    public readonly violation: string;

    constructor(pluginId: string, violation: string) {
        super(`Plugin '${pluginId}' security violation: ${violation}`);
        this.name = "SandboxSecurityError";
        this.pluginId = pluginId;
        this.violation = violation;
    }
}

// ============================================================================
// Path Validation
// ============================================================================

/**
 * Validates that a path is within the allowed plugin data directory.
 * Prevents directory traversal attacks.
 *
 * @param pluginId Plugin identifier
 * @param basePath Allowed base path
 * @param requestedPath Path to validate
 * @throws SandboxSecurityError if path is outside allowed directory
 */
export function validatePluginPath(
    pluginId: string,
    basePath: string,
    requestedPath: string
): void {
    // Normalize paths for comparison
    const normalizedBase = normalizePath(basePath);
    const normalizedRequested = normalizePath(requestedPath);

    // Check if requested path is within base path
    if (!normalizedRequested.startsWith(normalizedBase)) {
        throw new SandboxSecurityError(
            pluginId,
            `Path traversal attempt: ${requestedPath} is outside ${basePath}`
        );
    }

    // Check for null bytes (common in path injection attacks)
    if (requestedPath.includes("\0")) {
        throw new SandboxSecurityError(
            pluginId,
            "Path contains null bytes"
        );
    }
}

/**
 * Validates a URL for plugin network requests.
 *
 * @param pluginId Plugin identifier
 * @param url URL to validate
 * @param allowedHosts Optional list of allowed hosts
 * @throws SandboxSecurityError if URL is not allowed
 */
export function validatePluginUrl(
    pluginId: string,
    url: string,
    allowedHosts?: string[]
): void {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new SandboxSecurityError(pluginId, `Invalid URL: ${url}`);
    }

    // Require HTTPS
    if (parsed.protocol !== "https:") {
        throw new SandboxSecurityError(
            pluginId,
            `Only HTTPS URLs are allowed, got: ${parsed.protocol}`
        );
    }

    // Block local addresses
    const blockedHosts = [
        "localhost",
        "127.0.0.1",
        "::1",
        "0.0.0.0",
    ];

    if (blockedHosts.includes(parsed.hostname.toLowerCase())) {
        throw new SandboxSecurityError(
            pluginId,
            `Local addresses are not allowed: ${parsed.hostname}`
        );
    }

    // Check allowed hosts if specified
    if (allowedHosts && allowedHosts.length > 0) {
        const isAllowed = allowedHosts.some((host) => {
            if (host.startsWith("*.")) {
                // Wildcard domain match
                const suffix = host.slice(1); // Remove *
                return parsed.hostname.endsWith(suffix);
            }
            return parsed.hostname === host;
        });

        if (!isAllowed) {
            throw new SandboxSecurityError(
                pluginId,
                `Host not in allowed list: ${parsed.hostname}`
            );
        }
    }
}

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitState {
    count: number;
    windowStart: number;
}

const rateLimitStates = new Map<string, RateLimitState>();

/**
 * Checks if an action is within rate limits.
 *
 * @param key Unique key for the rate limit
 * @param limit Maximum number of actions
 * @param windowMs Time window in milliseconds
 * @returns True if action is allowed, false if rate limited
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const state = rateLimitStates.get(key);

    if (!state || now - state.windowStart > windowMs) {
        // New window
        rateLimitStates.set(key, { count: 1, windowStart: now });
        return true;
    }

    if (state.count >= limit) {
        return false;
    }

    state.count++;
    return true;
}

/**
 * Creates a rate limiter for a specific plugin action.
 *
 * @param pluginId Plugin identifier
 * @param action Action name
 * @param limit Maximum actions per window
 * @param windowMs Time window in milliseconds
 * @returns Function that checks and enforces rate limit
 */
export function createRateLimiter(
    pluginId: string,
    action: string,
    limit: number,
    windowMs: number
): () => void {
    const key = `${pluginId}:${action}`;

    return () => {
        if (!checkRateLimit(key, limit, windowMs)) {
            throw new SandboxSecurityError(
                pluginId,
                `Rate limit exceeded for action '${action}': max ${limit} per ${windowMs}ms`
            );
        }
    };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Normalizes a path for cross-platform comparison.
 */
function normalizePath(p: string): string {
    // Replace backslashes with forward slashes
    let normalized = p.replace(/\\/g, "/");

    // Remove trailing slash
    if (normalized.endsWith("/")) {
        normalized = normalized.slice(0, -1);
    }

    // Lowercase on Windows for case-insensitive comparison
    if (process.platform === "win32") {
        normalized = normalized.toLowerCase();
    }

    return normalized;
}

/**
 * Normalizes any error value to an Error instance.
 */
function normalizeError(err: unknown): Error {
    if (err instanceof Error) {
        return err;
    }
    if (typeof err === "string") {
        return new Error(err);
    }
    return new Error(String(err));
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clears rate limit state for a plugin.
 * Call this when a plugin is unloaded.
 */
export function clearPluginRateLimits(pluginId: string): void {
    for (const key of rateLimitStates.keys()) {
        if (key.startsWith(`${pluginId}:`)) {
            rateLimitStates.delete(key);
        }
    }
}

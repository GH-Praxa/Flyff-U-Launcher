/**
 * Common IPC utilities shared across all handler modules.
 */
import { ipcMain, IpcMainInvokeEvent } from "electron";
import { z } from "zod";
import { IpcResult, IpcErrorCode, ipcOk, ipcErr } from "../../shared/types";
import { IdSchema, NameSchema } from "../../shared/schemas";

export type IpcEvent = IpcMainInvokeEvent;

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Custom error class for validation errors.
 */
export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}

/**
 * Custom error class for not found errors.
 */
export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NotFoundError";
    }
}

/**
 * Custom error class for permission/access denied errors.
 */
export class PermissionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PermissionError";
    }
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Parses and validates an ID, throws ValidationError on failure.
 */
export function assertValidId(id: unknown, fieldName: string): asserts id is string {
    const result = IdSchema.safeParse(id);
    if (!result.success) {
        const errors = result.error.issues.map(e => e.message).join(", ");
        throw new ValidationError(`Invalid ${fieldName}: ${errors}`);
    }
}

/**
 * Parses and validates a name, throws ValidationError on failure.
 */
export function assertValidName(name: unknown, fieldName: string): asserts name is string {
    const result = NameSchema.safeParse(name);
    if (!result.success) {
        const errors = result.error.issues.map(e => e.message).join(", ");
        throw new ValidationError(`Invalid ${fieldName}: ${errors}`);
    }
}

/**
 * Validates a value against a Zod schema, throws ValidationError on failure.
 */
export function assertValid<T>(schema: z.ZodSchema<T>, value: unknown, fieldName: string): asserts value is T {
    const result = schema.safeParse(value);
    if (!result.success) {
        const errors = result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
        throw new ValidationError(`Invalid ${fieldName}: ${errors}`);
    }
}

/**
 * Safe object merge that prevents prototype pollution.
 */
export function safeMerge<T extends Record<string, unknown>>(
    target: T | null | undefined,
    source: Partial<T> | null | undefined
): T {
    const result = { ...(target ?? {}) } as T;
    if (!source || typeof source !== "object") return result;

    for (const key of Object.keys(source)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
            continue;
        }
        (result as Record<string, unknown>)[key] = source[key as keyof T];
    }
    return result;
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Simple token bucket rate limiter for IPC handlers.
 * Prevents flooding from a potentially malicious renderer process.
 */
export class RateLimiter {
    private tokens: number;
    private lastRefill: number;
    private readonly maxTokens: number;
    private readonly refillRate: number; // tokens per second

    /**
     * Creates a rate limiter.
     * @param maxTokens Maximum burst capacity
     * @param refillRate Tokens refilled per second
     */
    constructor(maxTokens = 100, refillRate = 50) {
        this.maxTokens = maxTokens;
        this.refillRate = refillRate;
        this.tokens = maxTokens;
        this.lastRefill = Date.now();
    }

    /**
     * Attempts to consume a token.
     * @returns true if allowed, false if rate limited
     */
    tryConsume(): boolean {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }
        return false;
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        const tokensToAdd = elapsed * this.refillRate;
        this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }
}

/** Global rate limiters per channel */
const rateLimiters = new Map<string, RateLimiter>();

/**
 * Gets or creates a rate limiter for a channel.
 */
function getRateLimiter(channel: string, maxTokens = 100, refillRate = 50): RateLimiter {
    let limiter = rateLimiters.get(channel);
    if (!limiter) {
        limiter = new RateLimiter(maxTokens, refillRate);
        rateLimiters.set(channel, limiter);
    }
    return limiter;
}

/** Rate limited error for IPC */
export class RateLimitError extends Error {
    constructor(channel: string) {
        super(`Rate limit exceeded for channel: ${channel}`);
        this.name = "RateLimitError";
    }
}

// ============================================================================
// IPC Handler Utilities
// ============================================================================

/**
 * Classifies an error into an IpcErrorCode based on error type.
 */
function classifyError(err: unknown): IpcErrorCode {
    if (err instanceof RateLimitError) return "RATE_LIMITED";
    if (err instanceof ValidationError) return "VALIDATION_ERROR";
    if (err instanceof NotFoundError) return "NOT_FOUND";
    if (err instanceof PermissionError) return "PERMISSION_DENIED";
    if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (msg.includes("not found") || msg.includes("missing")) return "NOT_FOUND";
        if (msg.includes("invalid") || msg.includes("must be")) return "VALIDATION_ERROR";
        if (msg.includes("network") || msg.includes("timeout") || msg.includes("fetch")) return "NETWORK_ERROR";
        if (msg.includes("permission") || msg.includes("denied") || msg.includes("blocked")) return "PERMISSION_DENIED";
    }
    return "OPERATION_FAILED";
}

/**
 * Options for rate limiting an IPC handler.
 */
export interface RateLimitOptions {
    /** Maximum burst capacity (default: 100) */
    maxTokens?: number;
    /** Tokens refilled per second (default: 50) */
    refillRate?: number;
}

/**
 * Options for creating a safe IPC handler.
 */
export interface SafeHandlerOptions {
    /** Enable rate limiting (default: true) */
    rateLimit?: boolean | RateLimitOptions;
}

/**
 * Creates a safe IPC handler wrapper with consistent error handling and rate limiting.
 * Returns a function that can be used to register handlers.
 */
export function createSafeHandler(logErr: (msg: unknown) => void) {
    return function safeHandle<T>(
        channel: string,
        handler: (...args: unknown[]) => Promise<T> | T,
        options: SafeHandlerOptions = {}
    ): void {
        const { rateLimit = true } = options;

        // Configure rate limiter
        let limiter: RateLimiter | null = null;
        if (rateLimit) {
            const opts = typeof rateLimit === "object" ? rateLimit : {};
            limiter = getRateLimiter(channel, opts.maxTokens, opts.refillRate);
        }

        try {
            ipcMain.removeHandler(channel);
        } catch (err) {
            logErr(err);
        }
        ipcMain.handle(channel, async (...args: unknown[]): Promise<IpcResult<T>> => {
            try {
                // Check rate limit
                if (limiter && !limiter.tryConsume()) {
                    throw new RateLimitError(channel);
                }

                const result = await handler(...args);
                return ipcOk(result);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                const code = classifyError(err);
                logErr(`[${channel}] ${code}: ${message}`);
                return ipcErr(message, code);
            }
        });
    };
}

export type SafeHandle = ReturnType<typeof createSafeHandler>;

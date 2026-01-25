/**
 * Shared utility functions used across the application.
 */

/**
 * Generates a random 8-character alphanumeric ID.
 * Used for profiles, layouts, themes, and other entities.
 */
export function generateId(): string {
    return Math.random().toString(36).slice(2, 10);
}

/**
 * Suppresses errors from a promise, optionally logging them.
 * Use for fire-and-forget operations where failure is acceptable.
 *
 * @example
 * // Silent suppression (for truly ignorable errors)
 * suppressError(api.setVisible(false));
 *
 * // With logging (for errors that should be tracked but not blocking)
 * suppressError(api.loadUrl(), "Failed to load URL");
 */
export function suppressError<T>(
    promise: Promise<T>,
    logMessage?: string
): Promise<T | undefined> {
    return promise.catch((err) => {
        if (logMessage) {
            console.warn(logMessage, err);
        }
        return undefined;
    });
}

/**
 * Wraps a callback to catch and log any errors it throws.
 * Useful for event handlers where errors shouldn't propagate.
 */
export function safeCallback<T extends (...args: unknown[]) => unknown>(
    fn: T,
    context?: string
): T {
    return ((...args: unknown[]) => {
        try {
            const result = fn(...args);
            if (result instanceof Promise) {
                return result.catch((err) => {
                    console.error(context ? `[${context}]` : "[safeCallback]", err);
                    return undefined;
                });
            }
            return result;
        } catch (err) {
            console.error(context ? `[${context}]` : "[safeCallback]", err);
            return undefined;
        }
    }) as T;
}

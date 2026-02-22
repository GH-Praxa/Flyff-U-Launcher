/**
 * Plugin Event Bus (V2)
 *
 * Enhanced publish/subscribe event bus for plugin-to-plugin communication.
 * Events are namespaced with the emitting plugin's ID.
 *
 * Features:
 * - Pattern matching with wildcards
 * - Typed events
 * - Promise-based waitFor
 * - Request/response pattern
 */

import type { PluginEventBus } from "../../shared/pluginApi";

type EventHandler = (data: unknown, from: string) => void;
type ResponseHandler<T> = (data: unknown, from: string) => T | Promise<T>;

interface EventSubscription {
    pattern: string;
    handler: EventHandler;
    once: boolean;
}

interface ResponseSubscription {
    event: string;
    pluginId: string;
    handler: ResponseHandler<unknown>;
}

// ============================================================================
// Typed Events (common patterns)
// ============================================================================

export interface PluginEvents {
    "level-up": { profileId: string; newLevel: number; oldLevel: number };
    "exp-gained": { profileId: string; amount: number; source: string };
    "kill-registered": { profileId: string; mobName?: string };
    "buff-expired": { profileId: string; buffId: string; buffName: string };
    "quest-completed": { profileId: string; questId: string };
    "session-started": { profileId: string; timestamp: number };
    "session-ended": { profileId: string; duration: number };
}

/**
 * Creates a global event bus for plugin communication.
 */
export function createEventBus() {
    const subscriptions: EventSubscription[] = [];

    /**
     * Matches an event name against a pattern.
     * Supports wildcards: "*:event" matches any plugin, "plugin:*" matches any event
     */
    function matchesPattern(pattern: string, eventName: string): boolean {
        if (pattern === eventName) return true;

        const patternParts = pattern.split(":");
        const eventParts = eventName.split(":");

        if (patternParts.length !== eventParts.length) return false;

        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i] !== "*" && patternParts[i] !== eventParts[i]) {
                return false;
            }
        }

        return true;
    }

    /**
     * Emit an event to all matching subscribers.
     */
    function emit(eventName: string, data: unknown, fromPluginId: string): void {
        const fullEventName = `${fromPluginId}:${eventName}`;

        // Collect handlers to call (copy to avoid mutation during iteration)
        const toCall: { handler: EventHandler; index: number }[] = [];

        for (let i = 0; i < subscriptions.length; i++) {
            const sub = subscriptions[i];
            if (matchesPattern(sub.pattern, fullEventName)) {
                toCall.push({ handler: sub.handler, index: i });
            }
        }

        // Remove once-handlers before calling (to handle re-subscription)
        const onceIndices = toCall
            .filter((_, idx) => subscriptions[toCall[idx]?.index]?.once)
            .map((t) => t.index)
            .sort((a, b) => b - a); // Sort descending to remove from end first

        for (const idx of onceIndices) {
            subscriptions.splice(idx, 1);
        }

        // Call handlers
        for (const { handler } of toCall) {
            try {
                handler(data, fromPluginId);
            } catch (err) {
                console.error(`[EventBus] Error in handler for ${fullEventName}:`, err);
            }
        }
    }

    /**
     * Subscribe to events matching a pattern.
     * @returns Unsubscribe function
     */
    function on(pattern: string, handler: EventHandler): () => void {
        const subscription: EventSubscription = { pattern, handler, once: false };
        subscriptions.push(subscription);

        return () => {
            const idx = subscriptions.indexOf(subscription);
            if (idx !== -1) {
                subscriptions.splice(idx, 1);
            }
        };
    }

    /**
     * Subscribe to an event once.
     * @returns Unsubscribe function
     */
    function once(pattern: string, handler: EventHandler): () => void {
        const subscription: EventSubscription = { pattern, handler, once: true };
        subscriptions.push(subscription);

        return () => {
            const idx = subscriptions.indexOf(subscription);
            if (idx !== -1) {
                subscriptions.splice(idx, 1);
            }
        };
    }

    /**
     * Remove all subscriptions (for cleanup).
     */
    function clear(): void {
        subscriptions.length = 0;
    }

    /**
     * Get subscription count (for debugging).
     */
    function getSubscriptionCount(): number {
        return subscriptions.length;
    }

    // ========================================================================
    // V2 Features: waitFor and request/respond
    // ========================================================================

    /**
     * Wait for an event matching a pattern (Promise-based).
     * @param pattern Event pattern to wait for
     * @param timeoutMs Timeout in milliseconds (default: 30000)
     * @returns Promise resolving to { data, from }
     */
    function waitFor(
        pattern: string,
        timeoutMs: number = 30000
    ): Promise<{ data: unknown; from: string }> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                unsubscribe();
                reject(new Error(`Timeout waiting for event: ${pattern}`));
            }, timeoutMs);

            const unsubscribe = once(pattern, (data, from) => {
                clearTimeout(timeoutId);
                resolve({ data, from });
            });
        });
    }

    /**
     * Register a responder for request/response pattern.
     * @param event Event name to respond to
     * @param pluginId Plugin ID that should receive the request
     * @param handler Handler function that returns the response
     * @returns Unsubscribe function
     */
    function respond<T>(
        event: string,
        pluginId: string,
        handler: ResponseHandler<T>
    ): () => void {
        const sub: ResponseSubscription = {
            event,
            pluginId,
            handler: handler as ResponseHandler<unknown>,
        };
        responseHandlers.push(sub);

        return () => {
            const idx = responseHandlers.indexOf(sub);
            if (idx !== -1) {
                responseHandlers.splice(idx, 1);
            }
        };
    }

    /**
     * Send a request and wait for a response.
     * @param targetPlugin Plugin ID to send the request to
     * @param event Event name
     * @param data Request data
     * @param timeoutMs Timeout in milliseconds (default: 10000)
     * @returns Promise resolving to the response
     */
    async function request<T>(
        targetPlugin: string,
        event: string,
        data: unknown,
        fromPluginId: string,
        timeoutMs: number = 10000
    ): Promise<T> {
        // Find a matching response handler
        const handler = responseHandlers.find(
            (h) => h.event === event && h.pluginId === targetPlugin
        );

        if (!handler) {
            throw new Error(`No responder registered for ${targetPlugin}:${event}`);
        }

        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Request timeout for ${targetPlugin}:${event}`));
            }, timeoutMs);
        });

        // Execute the handler
        const responsePromise = Promise.resolve(handler.handler(data, fromPluginId));

        // Race between response and timeout
        return Promise.race([responsePromise as Promise<T>, timeoutPromise]);
    }

    /**
     * Emit a typed event.
     */
    function emitTyped<K extends keyof PluginEvents>(
        eventName: K,
        data: PluginEvents[K],
        fromPluginId: string
    ): void {
        emit(eventName, data, fromPluginId);
    }

    return {
        emit,
        emitTyped,
        on,
        once,
        clear,
        getSubscriptionCount,
        waitFor,
        respond,
        request,
    };
}

// Response handlers storage (shared across all event buses)
const responseHandlers: ResponseSubscription[] = [];

/**
 * Extended PluginEventBus with V2 features
 */
export interface PluginEventBusV2 extends PluginEventBus {
    /** Wait for an event (Promise-based) */
    waitFor(pattern: string, timeoutMs?: number): Promise<{ data: unknown; from: string }>;

    /** Register a responder for request/response pattern */
    respond<T>(event: string, handler: (data: unknown, from: string) => T | Promise<T>): () => void;

    /** Send a request and wait for response */
    request<T>(targetPlugin: string, event: string, data: unknown, timeoutMs?: number): Promise<T>;

    /** Emit a typed event */
    emitTyped<K extends keyof PluginEvents>(event: K, data: PluginEvents[K]): void;
}

/**
 * Creates a scoped event bus for a specific plugin.
 * The plugin's ID is automatically prepended to emitted events.
 */
export function createScopedEventBus(
    globalBus: ReturnType<typeof createEventBus>,
    pluginId: string
): PluginEventBusV2 {
    return {
        emit(event: string, data: unknown): void {
            globalBus.emit(event, data, pluginId);
        },

        emitTyped<K extends keyof PluginEvents>(event: K, data: PluginEvents[K]): void {
            globalBus.emitTyped(event, data, pluginId);
        },

        on(pattern: string, handler: (data: unknown, from: string) => void): () => void {
            return globalBus.on(pattern, handler);
        },

        once(pattern: string, handler: (data: unknown, from: string) => void): () => void {
            return globalBus.once(pattern, handler);
        },

        waitFor(pattern: string, timeoutMs?: number): Promise<{ data: unknown; from: string }> {
            return globalBus.waitFor(pattern, timeoutMs);
        },

        respond<T>(
            event: string,
            handler: (data: unknown, from: string) => T | Promise<T>
        ): () => void {
            return globalBus.respond(event, pluginId, handler);
        },

        request<T>(
            targetPlugin: string,
            event: string,
            data: unknown,
            timeoutMs?: number
        ): Promise<T> {
            return globalBus.request(targetPlugin, event, data, pluginId, timeoutMs);
        },
    };
}

export type GlobalEventBus = ReturnType<typeof createEventBus>;

/**
 * Tests for IPC common utilities.
 * Tests cover: validation functions, error classes, safeMerge, and error classification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
    ValidationError,
    NotFoundError,
    PermissionError,
    RateLimitError,
    RateLimiter,
    assertValidId,
    assertValidName,
    assertValid,
    safeMerge,
    createSafeHandler,
} from './common';

// Mock electron's ipcMain
const mockHandle = vi.fn();
const mockRemoveHandler = vi.fn();
vi.mock('electron', () => ({
    ipcMain: {
        handle: (...args: unknown[]) => mockHandle(...args),
        removeHandler: (...args: unknown[]) => mockRemoveHandler(...args),
    },
}));

describe('IPC Common Utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // Error Classes
    // =========================================================================

    describe('ValidationError', () => {
        it('should create error with correct name and message', () => {
            const error = new ValidationError('Invalid input');

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(ValidationError);
            expect(error.name).toBe('ValidationError');
            expect(error.message).toBe('Invalid input');
        });
    });

    describe('NotFoundError', () => {
        it('should create error with correct name and message', () => {
            const error = new NotFoundError('Item not found');

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(NotFoundError);
            expect(error.name).toBe('NotFoundError');
            expect(error.message).toBe('Item not found');
        });
    });

    describe('PermissionError', () => {
        it('should create error with correct name and message', () => {
            const error = new PermissionError('Access denied');

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(PermissionError);
            expect(error.name).toBe('PermissionError');
            expect(error.message).toBe('Access denied');
        });
    });

    describe('RateLimitError', () => {
        it('should create error with correct name and message', () => {
            const error = new RateLimitError('test:channel');

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(RateLimitError);
            expect(error.name).toBe('RateLimitError');
            expect(error.message).toContain('test:channel');
        });
    });

    // =========================================================================
    // Rate Limiting
    // =========================================================================

    describe('RateLimiter', () => {
        it('should allow requests up to max tokens', () => {
            const limiter = new RateLimiter(5, 1); // 5 tokens max, 1/sec refill

            expect(limiter.tryConsume()).toBe(true);
            expect(limiter.tryConsume()).toBe(true);
            expect(limiter.tryConsume()).toBe(true);
            expect(limiter.tryConsume()).toBe(true);
            expect(limiter.tryConsume()).toBe(true);
        });

        it('should block after exhausting tokens', () => {
            const limiter = new RateLimiter(2, 1); // Only 2 tokens

            expect(limiter.tryConsume()).toBe(true);
            expect(limiter.tryConsume()).toBe(true);
            expect(limiter.tryConsume()).toBe(false); // Exhausted
        });

        it('should refill tokens over time', async () => {
            const limiter = new RateLimiter(2, 100); // 100/sec refill

            // Exhaust tokens
            limiter.tryConsume();
            limiter.tryConsume();

            // Immediately after, should be empty
            const emptyResult = limiter.tryConsume();

            // Wait for refill (100 tokens/sec = 10ms per token)
            await new Promise(r => setTimeout(r, 20));

            // Should have refilled at least one token
            const refillResult = limiter.tryConsume();

            expect(emptyResult).toBe(false);
            expect(refillResult).toBe(true);
        });

        it('should not exceed max tokens when refilling', async () => {
            const limiter = new RateLimiter(3, 1000);

            // Wait for potential overfill
            await new Promise(r => setTimeout(r, 10));

            // Should still only have max tokens
            expect(limiter.tryConsume()).toBe(true);
            expect(limiter.tryConsume()).toBe(true);
            expect(limiter.tryConsume()).toBe(true);
            expect(limiter.tryConsume()).toBe(false);
        });
    });

    // =========================================================================
    // Validation Functions
    // =========================================================================

    describe('assertValidId', () => {
        it('should accept valid alphanumeric IDs', () => {
            expect(() => assertValidId('abc123', 'id')).not.toThrow();
            expect(() => assertValidId('user-id-1', 'id')).not.toThrow();
            expect(() => assertValidId('profile_name', 'id')).not.toThrow();
            expect(() => assertValidId('A', 'id')).not.toThrow();
        });

        it('should reject empty ID', () => {
            expect(() => assertValidId('', 'profileId')).toThrow();
        });

        it('should reject non-string values', () => {
            expect(() => assertValidId(123, 'id')).toThrow();
            expect(() => assertValidId(null, 'id')).toThrow();
            expect(() => assertValidId(undefined, 'id')).toThrow();
            expect(() => assertValidId({}, 'id')).toThrow();
        });

        it('should reject IDs with invalid characters', () => {
            expect(() => assertValidId('id with space', 'id')).toThrow();
            expect(() => assertValidId('id@special', 'id')).toThrow();
            expect(() => assertValidId('id.with.dots', 'id')).toThrow();
        });

        it('should include field name in error message', () => {
            try {
                assertValidId('', 'myFieldName');
                expect.fail('Should have thrown');
            } catch (err) {
                expect((err as Error).message).toContain('myFieldName');
            }
        });
    });

    describe('assertValidName', () => {
        it('should accept valid names', () => {
            expect(() => assertValidName('John Doe', 'name')).not.toThrow();
            expect(() => assertValidName('A', 'name')).not.toThrow();
            expect(() => assertValidName('Project Alpha 2.0', 'name')).not.toThrow();
        });

        it('should reject empty name', () => {
            expect(() => assertValidName('', 'profileName')).toThrow();
        });

        it('should reject non-string values', () => {
            expect(() => assertValidName(123, 'name')).toThrow();
            expect(() => assertValidName(null, 'name')).toThrow();
        });

        it('should include field name in error message', () => {
            try {
                assertValidName('', 'displayName');
                expect.fail('Should have thrown');
            } catch (err) {
                expect((err as Error).message).toContain('displayName');
            }
        });
    });

    describe('assertValid', () => {
        const NumberSchema = z.number().min(0).max(100);
        const ObjectSchema = z.object({
            name: z.string(),
            age: z.number(),
        });

        it('should accept valid values', () => {
            expect(() => assertValid(NumberSchema, 50, 'value')).not.toThrow();
            expect(() => assertValid(ObjectSchema, { name: 'Test', age: 25 }, 'obj')).not.toThrow();
        });

        it('should reject invalid values', () => {
            expect(() => assertValid(NumberSchema, -1, 'value')).toThrow();
            expect(() => assertValid(NumberSchema, 101, 'value')).toThrow();
            expect(() => assertValid(NumberSchema, 'string', 'value')).toThrow();
        });

        it('should include field paths in error message', () => {
            try {
                assertValid(ObjectSchema, { name: 'Test', age: 'invalid' }, 'person');
                expect.fail('Should have thrown');
            } catch (err) {
                const message = (err as Error).message;
                expect(message).toContain('person');
            }
        });

        it('should work with complex nested schemas', () => {
            const NestedSchema = z.object({
                items: z.array(z.object({ id: z.string() })),
            });

            expect(() => assertValid(NestedSchema, { items: [{ id: '1' }] }, 'data')).not.toThrow();
            expect(() => assertValid(NestedSchema, { items: [{ id: 123 }] }, 'data')).toThrow();
        });
    });

    // =========================================================================
    // safeMerge
    // =========================================================================

    describe('safeMerge', () => {
        it('should merge objects correctly', () => {
            const target = { a: 1, b: 2 };
            const source = { b: 3, c: 4 };

            const result = safeMerge(target, source);

            expect(result).toEqual({ a: 1, b: 3, c: 4 });
        });

        it('should handle null target', () => {
            const result = safeMerge(null, { a: 1 });

            expect(result).toEqual({ a: 1 });
        });

        it('should handle undefined target', () => {
            const result = safeMerge(undefined, { a: 1 });

            expect(result).toEqual({ a: 1 });
        });

        it('should handle null source', () => {
            const target = { a: 1 };

            const result = safeMerge(target, null);

            expect(result).toEqual({ a: 1 });
        });

        it('should handle undefined source', () => {
            const target = { a: 1 };

            const result = safeMerge(target, undefined);

            expect(result).toEqual({ a: 1 });
        });

        it('should prevent __proto__ pollution', () => {
            const target = { a: 1 };
            // Create an object with __proto__ key without actually polluting
            const maliciousSource = { a: 2 };
            Object.defineProperty(maliciousSource, '__proto__', {
                value: { polluted: true },
                enumerable: true,
            });

            const result = safeMerge(target, maliciousSource as Partial<typeof target>);

            // The regular property should be merged
            expect(result.a).toBe(2);
            // But __proto__ should not be copied
            expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        });

        it('should prevent constructor pollution', () => {
            const target = { a: 1 };
            const source = { constructor: 'malicious' } as unknown as Partial<typeof target>;

            const result = safeMerge(target, source);

            expect(result.a).toBe(1);
            // constructor should not be set as a regular property
            expect(typeof result.constructor).toBe('function');
        });

        it('should prevent prototype pollution', () => {
            const target = { a: 1 };
            const source = { prototype: {} } as unknown as Partial<typeof target>;

            const result = safeMerge(target, source);

            expect(result.a).toBe(1);
        });

        it('should not modify the original target', () => {
            const target = { a: 1, b: 2 };
            const source = { b: 3 };

            safeMerge(target, source);

            expect(target).toEqual({ a: 1, b: 2 });
        });
    });

    // =========================================================================
    // createSafeHandler
    // =========================================================================

    describe('createSafeHandler', () => {
        it('should register handler with ipcMain', () => {
            const logErr = vi.fn();
            const safeHandle = createSafeHandler(logErr);

            safeHandle('test:channel', async () => 'result');

            expect(mockRemoveHandler).toHaveBeenCalledWith('test:channel');
            expect(mockHandle).toHaveBeenCalledWith('test:channel', expect.any(Function));
        });

        it('should wrap handler result in IpcSuccess on success', async () => {
            const logErr = vi.fn();
            const safeHandle = createSafeHandler(logErr);

            let registeredHandler: ((...args: unknown[]) => Promise<unknown>) | null = null;
            mockHandle.mockImplementation((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
                registeredHandler = handler;
            });

            safeHandle('test:channel', async () => ({ data: 'test' }));

            expect(registeredHandler).not.toBeNull();
            const result = await registeredHandler!() as { ok: boolean; data?: unknown };

            expect(result.ok).toBe(true);
            expect(result.data).toEqual({ data: 'test' });
        });

        it('should wrap errors in IpcError on failure', async () => {
            const logErr = vi.fn();
            const safeHandle = createSafeHandler(logErr);

            let registeredHandler: ((...args: unknown[]) => Promise<unknown>) | null = null;
            mockHandle.mockImplementation((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
                registeredHandler = handler;
            });

            safeHandle('test:channel', async () => {
                throw new Error('Something went wrong');
            });

            const result = await registeredHandler!() as { ok: boolean; error?: string; code?: string };

            expect(result.ok).toBe(false);
            expect(result.error).toBe('Something went wrong');
            expect(result.code).toBe('OPERATION_FAILED');
        });

        it('should classify ValidationError correctly', async () => {
            const logErr = vi.fn();
            const safeHandle = createSafeHandler(logErr);

            let registeredHandler: ((...args: unknown[]) => Promise<unknown>) | null = null;
            mockHandle.mockImplementation((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
                registeredHandler = handler;
            });

            safeHandle('test:channel', async () => {
                throw new ValidationError('Invalid input');
            });

            const result = await registeredHandler!() as { ok: boolean; code?: string };

            expect(result.ok).toBe(false);
            expect(result.code).toBe('VALIDATION_ERROR');
        });

        it('should classify NotFoundError correctly', async () => {
            const logErr = vi.fn();
            const safeHandle = createSafeHandler(logErr);

            let registeredHandler: ((...args: unknown[]) => Promise<unknown>) | null = null;
            mockHandle.mockImplementation((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
                registeredHandler = handler;
            });

            safeHandle('test:channel', async () => {
                throw new NotFoundError('Item not found');
            });

            const result = await registeredHandler!() as { ok: boolean; code?: string };

            expect(result.ok).toBe(false);
            expect(result.code).toBe('NOT_FOUND');
        });

        it('should allow repeated calls without rate limiting', async () => {
            const logErr = vi.fn();
            const safeHandle = createSafeHandler(logErr);

            let registeredHandler: ((...args: unknown[]) => Promise<unknown>) | null = null;
            mockHandle.mockImplementation((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
                registeredHandler = handler;
            });

            safeHandle('rate:test', async () => 'ok');

            // First call should succeed
            const result1 = await registeredHandler!() as { ok: boolean; data?: string };
            expect(result1.ok).toBe(true);
            expect(result1.data).toBe('ok');

            // Immediate second call should also succeed (no rate limiting)
            const result2 = await registeredHandler!() as { ok: boolean; data?: string };
            expect(result2.ok).toBe(true);
            expect(result2.data).toBe('ok');
        });

        it('should log errors when they occur', async () => {
            const logErr = vi.fn();
            const safeHandle = createSafeHandler(logErr);

            let registeredHandler: ((...args: unknown[]) => Promise<unknown>) | null = null;
            mockHandle.mockImplementation((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
                registeredHandler = handler;
            });

            safeHandle('error:test', async () => {
                throw new Error('Test error');
            });

            await registeredHandler!();

            expect(logErr).toHaveBeenCalled();
            expect(logErr.mock.calls[0][0]).toContain('Test error');
        });
    });
});

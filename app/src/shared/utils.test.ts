/**
 * Tests for shared utility functions.
 */
import { describe, it, expect, vi } from 'vitest';
import { generateId, suppressError, safeCallback } from './utils';

describe('generateId', () => {
    it('should generate a string', () => {
        const id = generateId();
        expect(typeof id).toBe('string');
    });

    it('should generate an 8-character ID', () => {
        const id = generateId();
        expect(id.length).toBe(8);
    });

    it('should generate alphanumeric characters only', () => {
        const id = generateId();
        expect(id).toMatch(/^[a-z0-9]+$/);
    });

    it('should generate unique IDs', () => {
        const ids = new Set<string>();
        for (let i = 0; i < 100; i++) {
            ids.add(generateId());
        }
        // All 100 IDs should be unique
        expect(ids.size).toBe(100);
    });

    it('should not generate empty strings', () => {
        for (let i = 0; i < 50; i++) {
            const id = generateId();
            expect(id.length).toBeGreaterThan(0);
        }
    });
});

describe('suppressError', () => {
    it('should return value on successful promise', async () => {
        const result = await suppressError(Promise.resolve('success'));
        expect(result).toBe('success');
    });

    it('should return undefined on rejected promise', async () => {
        const result = await suppressError(Promise.reject(new Error('fail')));
        expect(result).toBeUndefined();
    });

    it('should log message when provided and promise rejects', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await suppressError(Promise.reject(new Error('test error')), 'Custom message');

        expect(warnSpy).toHaveBeenCalledWith('Custom message', expect.any(Error));
        warnSpy.mockRestore();
    });

    it('should not log when no message provided', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await suppressError(Promise.reject(new Error('silent error')));

        expect(warnSpy).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});

describe('safeCallback', () => {
    it('should execute callback and return result', () => {
        const fn = safeCallback(() => 42);
        expect(fn()).toBe(42);
    });

    it('should catch sync errors and return undefined', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const fn = safeCallback(() => {
            throw new Error('sync error');
        });

        expect(fn()).toBeUndefined();
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('should catch async errors and return undefined', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const fn = safeCallback(async () => {
            throw new Error('async error');
        });

        const result = await fn();
        expect(result).toBeUndefined();
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('should include context in error log', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const fn = safeCallback(() => {
            throw new Error('context error');
        }, 'TestContext');

        fn();
        expect(errorSpy).toHaveBeenCalledWith('[TestContext]', expect.any(Error));
        errorSpy.mockRestore();
    });

    it('should pass arguments to callback', () => {
        const fn = safeCallback((a: number, b: number) => a + b);
        expect(fn(2, 3)).toBe(5);
    });
});

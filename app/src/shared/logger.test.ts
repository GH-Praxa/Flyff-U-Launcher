/**
 * Tests for logger utilities.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logErr, logWarn } from './logger';

describe('Logger', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    describe('logErr', () => {
        it('should log error with default module name', () => {
            logErr('Test error');

            expect(consoleErrorSpy).toHaveBeenCalledWith('[App]', 'Test error');
        });

        it('should log error with custom module name', () => {
            logErr('Test error', 'MyModule');

            expect(consoleErrorSpy).toHaveBeenCalledWith('[MyModule]', 'Test error');
        });

        it('should log Error objects', () => {
            const error = new Error('Something went wrong');
            logErr(error, 'ErrorTest');

            expect(consoleErrorSpy).toHaveBeenCalledWith('[ErrorTest]', error);
        });

        it('should log with undefined module name as App', () => {
            logErr('Test', undefined);

            expect(consoleErrorSpy).toHaveBeenCalledWith('[App]', 'Test');
        });
    });

    describe('logWarn', () => {
        it('should log warning with default module name', () => {
            logWarn('Test warning');

            expect(consoleWarnSpy).toHaveBeenCalledWith('[App]', 'Test warning');
        });

        it('should log warning with custom module name', () => {
            logWarn('Test warning', 'MyModule');

            expect(consoleWarnSpy).toHaveBeenCalledWith('[MyModule]', 'Test warning');
        });

        it('should log various types', () => {
            logWarn({ key: 'value' }, 'ObjectTest');

            expect(consoleWarnSpy).toHaveBeenCalledWith('[ObjectTest]', { key: 'value' });
        });

        it('should log numbers', () => {
            logWarn(42, 'NumberTest');

            expect(consoleWarnSpy).toHaveBeenCalledWith('[NumberTest]', 42);
        });
    });
});

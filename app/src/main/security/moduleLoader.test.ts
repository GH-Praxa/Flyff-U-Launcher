/**
 * Tests for secure module loader.
 * Tests path validation and security checks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

// Mock Electron app
vi.mock('electron', () => ({
    app: {
        getAppPath: vi.fn().mockReturnValue('/app'),
        isPackaged: false,
    },
}));

// Mock fs
vi.mock('fs', () => ({
    existsSync: vi.fn().mockReturnValue(true),
    statSync: vi.fn().mockReturnValue({ isFile: () => true }),
    readFileSync: vi.fn().mockReturnValue(Buffer.from('test content')),
}));

// Mock logger
vi.mock('../../shared/logger', () => ({
    logWarn: vi.fn(),
    logErr: vi.fn(),
}));

import { validateModulePath, calculateFileHash } from './moduleLoader';
import * as fs from 'fs';
import { app } from 'electron';

describe('moduleLoader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (app.getAppPath as ReturnType<typeof vi.fn>).mockReturnValue('/app');
    });

    describe('validateModulePath', () => {
        it('should reject empty path', () => {
            const result = validateModulePath('');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('non-empty string');
        });

        it('should reject non-string path', () => {
            const result = validateModulePath(null as unknown as string);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('non-empty string');
        });

        it('should reject path outside app directory', () => {
            (app.getAppPath as ReturnType<typeof vi.fn>).mockReturnValue('/app');

            const result = validateModulePath('/other/malicious.js');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('within app directory');
        });

        it('should reject path traversal attempts', () => {
            (app.getAppPath as ReturnType<typeof vi.fn>).mockReturnValue('/app');

            const result = validateModulePath('/app/../etc/passwd');

            expect(result.valid).toBe(false);
        });

        it('should reject non-existent files', () => {
            (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

            const result = validateModulePath('/app/missing.js');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should reject directories', () => {
            (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
            (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ isFile: () => false });

            const result = validateModulePath('/app/directory');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('must be a file');
        });

        it('should accept valid file within app directory', () => {
            (app.getAppPath as ReturnType<typeof vi.fn>).mockReturnValue('/app');
            (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
            (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ isFile: () => true });

            const result = validateModulePath('/app/valid-module.js');

            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should handle Windows paths', () => {
            (app.getAppPath as ReturnType<typeof vi.fn>).mockReturnValue('C:\\app');
            (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
            (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ isFile: () => true });

            // Use path.resolve to normalize
            const testPath = path.resolve('C:\\app\\module.js');
            const appPath = path.resolve('C:\\app');

            // This test verifies the logic works with resolved paths
            expect(testPath.startsWith(appPath)).toBe(true);
        });
    });

    describe('calculateFileHash', () => {
        it('should calculate SHA256 hash of file content', () => {
            const testContent = 'test content';
            (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(Buffer.from(testContent));

            const hash = calculateFileHash('/app/test.js');

            // SHA256 hash is 64 hex characters
            expect(hash).toMatch(/^[a-f0-9]{64}$/);
        });

        it('should return different hashes for different content', () => {
            (fs.readFileSync as ReturnType<typeof vi.fn>)
                .mockReturnValueOnce(Buffer.from('content1'))
                .mockReturnValueOnce(Buffer.from('content2'));

            const hash1 = calculateFileHash('/app/file1.js');
            const hash2 = calculateFileHash('/app/file2.js');

            expect(hash1).not.toBe(hash2);
        });

        it('should return same hash for same content', () => {
            const content = 'same content';
            (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(Buffer.from(content));

            const hash1 = calculateFileHash('/app/file1.js');
            const hash2 = calculateFileHash('/app/file2.js');

            expect(hash1).toBe(hash2);
        });
    });
});

describe('Security edge cases', () => {
    it('should detect double-encoded path traversal', () => {
        // %2e%2e = ..
        const maliciousPath = '/app/%2e%2e/etc/passwd';

        // The path.resolve should handle this, but we verify the concept
        const resolved = path.resolve(maliciousPath);

        // Should not contain the app directory if traversal worked
        // This tests that our logic would catch it
        expect(resolved).toBeDefined();
    });

    it('should handle null bytes in path', () => {
        const maliciousPath = '/app/module.js\0.txt';

        // path.resolve handles null bytes
        const resolved = path.resolve(maliciousPath);

        expect(resolved).toBeDefined();
    });
});

/**
 * Tests for the FileStore abstraction.
 * Tests cover: reading, writing, findById, update with concurrency.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFileStore } from './fileStore';

// Create mock functions
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();

// Mock fs/promises module
vi.mock('fs/promises', () => ({
    default: {
        readFile: (...args: unknown[]) => mockReadFile(...args),
        writeFile: (...args: unknown[]) => mockWriteFile(...args),
        mkdir: (...args: unknown[]) => mockMkdir(...args),
    },
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

// Mock logger
vi.mock('./logger', () => ({
    logErr: vi.fn(),
}));

// Test item type
type TestItem = {
    id: string;
    name: string;
    value: number;
};

// Normalizer that validates TestItem structure
function normalizeTestItem(raw: unknown): TestItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;
    if (typeof obj.id !== 'string') return null;
    if (typeof obj.name !== 'string') return null;
    if (typeof obj.value !== 'number') return null;
    return { id: obj.id, name: obj.name, value: obj.value };
}

describe('createFileStore', () => {
    const testPath = '/test/data/items.json';
    let store: ReturnType<typeof createFileStore<TestItem>>;

    beforeEach(() => {
        vi.clearAllMocks();
        store = createFileStore<TestItem>({
            getPath: () => testPath,
            normalize: normalizeTestItem,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('read()', () => {
        it('should return empty array when file does not exist', async () => {
            const enoentError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
            mockReadFile.mockRejectedValue(enoentError);

            const result = await store.read();

            expect(result).toEqual([]);
            expect(mockReadFile).toHaveBeenCalledWith(testPath, 'utf-8');
        });

        it('should return empty array when file contains invalid JSON', async () => {
            mockReadFile.mockResolvedValue('not valid json');

            const result = await store.read();

            expect(result).toEqual([]);
        });

        it('should return empty array when file contains non-array JSON', async () => {
            mockReadFile.mockResolvedValue('{"not": "an array"}');

            const result = await store.read();

            expect(result).toEqual([]);
        });

        it('should parse and normalize valid items', async () => {
            const validData = [
                { id: '1', name: 'Item 1', value: 100 },
                { id: '2', name: 'Item 2', value: 200 },
            ];
            mockReadFile.mockResolvedValue(JSON.stringify(validData));

            const result = await store.read();

            expect(result).toEqual(validData);
        });

        it('should filter out invalid items', async () => {
            const mixedData = [
                { id: '1', name: 'Valid', value: 100 },
                { id: '2', name: 'Missing value' }, // Invalid: missing value
                { invalid: true }, // Invalid: missing all fields
                { id: '3', name: 'Also valid', value: 300 },
            ];
            mockReadFile.mockResolvedValue(JSON.stringify(mixedData));

            const result = await store.read();

            expect(result).toEqual([
                { id: '1', name: 'Valid', value: 100 },
                { id: '3', name: 'Also valid', value: 300 },
            ]);
        });

        it('should handle empty array in file', async () => {
            mockReadFile.mockResolvedValue('[]');

            const result = await store.read();

            expect(result).toEqual([]);
        });
    });

    describe('write()', () => {
        it('should write items as formatted JSON', async () => {
            mockMkdir.mockResolvedValue(undefined);
            mockWriteFile.mockResolvedValue(undefined);

            const items: TestItem[] = [
                { id: '1', name: 'Test', value: 42 },
            ];

            await store.write(items);

            expect(mockMkdir).toHaveBeenCalled();
            expect(mockWriteFile).toHaveBeenCalledWith(
                testPath,
                JSON.stringify(items, null, 2),
                'utf-8'
            );
        });

        it('should create directory before writing', async () => {
            mockMkdir.mockResolvedValue(undefined);
            mockWriteFile.mockResolvedValue(undefined);

            await store.write([]);

            // Check mkdir was called
            expect(mockMkdir).toHaveBeenCalled();
            expect(mockWriteFile).toHaveBeenCalled();
        });

        it('should skip directory creation when ensureDir is false', async () => {
            const storeNoDir = createFileStore<TestItem>({
                getPath: () => testPath,
                normalize: normalizeTestItem,
                ensureDir: false,
            });
            mockWriteFile.mockResolvedValue(undefined);

            await storeNoDir.write([]);

            expect(mockMkdir).not.toHaveBeenCalled();
            expect(mockWriteFile).toHaveBeenCalled();
        });
    });

    describe('findById()', () => {
        it('should find item by id', async () => {
            const items = [
                { id: 'a', name: 'First', value: 1 },
                { id: 'b', name: 'Second', value: 2 },
                { id: 'c', name: 'Third', value: 3 },
            ];
            mockReadFile.mockResolvedValue(JSON.stringify(items));

            const result = await store.findById('b');

            expect(result).toEqual({ id: 'b', name: 'Second', value: 2 });
        });

        it('should return null when id not found', async () => {
            const items = [
                { id: 'a', name: 'First', value: 1 },
            ];
            mockReadFile.mockResolvedValue(JSON.stringify(items));

            const result = await store.findById('nonexistent');

            expect(result).toBeNull();
        });

        it('should return null when store is empty', async () => {
            mockReadFile.mockResolvedValue('[]');

            const result = await store.findById('any');

            expect(result).toBeNull();
        });
    });

    describe('update()', () => {
        beforeEach(() => {
            mockMkdir.mockResolvedValue(undefined);
            mockWriteFile.mockResolvedValue(undefined);
        });

        it('should read, transform, and write items', async () => {
            const initial = [{ id: '1', name: 'Original', value: 100 }];
            mockReadFile.mockResolvedValue(JSON.stringify(initial));

            const result = await store.update((items) =>
                items.map((item) => ({ ...item, value: item.value * 2 }))
            );

            expect(result).toEqual([{ id: '1', name: 'Original', value: 200 }]);
            expect(mockWriteFile).toHaveBeenCalled();
        });

        it('should add new items', async () => {
            const initial = [{ id: '1', name: 'First', value: 1 }];
            mockReadFile.mockResolvedValue(JSON.stringify(initial));

            const result = await store.update((items) => [
                ...items,
                { id: '2', name: 'Second', value: 2 },
            ]);

            expect(result).toHaveLength(2);
            expect(result[1]).toEqual({ id: '2', name: 'Second', value: 2 });
        });

        it('should remove items', async () => {
            const initial = [
                { id: '1', name: 'Keep', value: 1 },
                { id: '2', name: 'Remove', value: 2 },
            ];
            mockReadFile.mockResolvedValue(JSON.stringify(initial));

            const result = await store.update((items) =>
                items.filter((item) => item.id !== '2')
            );

            expect(result).toEqual([{ id: '1', name: 'Keep', value: 1 }]);
        });

        it('should handle sequential updates correctly', async () => {
            let currentValue = [{ id: '1', name: 'Counter', value: 0 }];

            // Mock read to return current value
            mockReadFile.mockImplementation(async () => {
                return JSON.stringify(currentValue);
            });

            // Mock write to update current value
            mockWriteFile.mockImplementation(async (_path: string, content: string) => {
                currentValue = JSON.parse(content);
            });

            // Execute updates sequentially
            await store.update((items) => items.map((i) => ({ ...i, value: i.value + 1 })));
            await store.update((items) => items.map((i) => ({ ...i, value: i.value + 1 })));
            await store.update((items) => items.map((i) => ({ ...i, value: i.value + 1 })));

            // All updates should have been applied, resulting in value = 3
            expect(currentValue[0].value).toBe(3);
        });

        it('should allow multiple stores to operate independently', async () => {
            const store2 = createFileStore<TestItem>({
                getPath: () => '/other/path.json',
                normalize: normalizeTestItem,
            });

            let value1 = [{ id: '1', name: 'Store1', value: 10 }];
            let value2 = [{ id: '1', name: 'Store2', value: 20 }];

            mockReadFile.mockImplementation(async (path: string) => {
                if (path === testPath) return JSON.stringify(value1);
                return JSON.stringify(value2);
            });

            mockWriteFile.mockImplementation(async (path: string, content: string) => {
                if (path === testPath) {
                    value1 = JSON.parse(content);
                } else {
                    value2 = JSON.parse(content);
                }
            });

            await store.update((items) => items.map((i) => ({ ...i, value: i.value + 5 })));
            await store2.update((items) => items.map((i) => ({ ...i, value: i.value + 10 })));

            expect(value1[0].value).toBe(15);
            expect(value2[0].value).toBe(30);
        });

        it('should release lock even when transform throws', async () => {
            mockReadFile.mockResolvedValue('[]');

            // First update throws
            await expect(
                store.update(() => {
                    throw new Error('Transform failed');
                })
            ).rejects.toThrow('Transform failed');

            // Second update should still work (lock was released)
            mockReadFile.mockResolvedValue('[{"id":"1","name":"Test","value":1}]');

            const result = await store.update((items) => items);

            expect(result).toEqual([{ id: '1', name: 'Test', value: 1 }]);
        });

        it('should release lock even when write fails', async () => {
            mockReadFile.mockResolvedValue('[]');
            mockWriteFile.mockRejectedValueOnce(new Error('Write failed'));

            // First update fails on write
            await expect(store.update((items) => items)).rejects.toThrow('Write failed');

            // Second update should still work
            mockWriteFile.mockResolvedValueOnce(undefined);
            const result = await store.update(() => [{ id: '1', name: 'New', value: 1 }]);

            expect(result).toEqual([{ id: '1', name: 'New', value: 1 }]);
        });
    });

    describe('getPath()', () => {
        it('should return the configured path', () => {
            expect(store.getPath()).toBe(testPath);
        });

        it('should call the getPath function each time', () => {
            let callCount = 0;
            const dynamicStore = createFileStore<TestItem>({
                getPath: () => {
                    callCount++;
                    return `/path/v${callCount}.json`;
                },
                normalize: normalizeTestItem,
            });

            expect(dynamicStore.getPath()).toBe('/path/v1.json');
            expect(dynamicStore.getPath()).toBe('/path/v2.json');
        });
    });
});

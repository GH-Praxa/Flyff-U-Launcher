/**
 * Tests für den ROI-Store (Region of Interest).
 * Testet die echte Geschäftslogik: Legacy-Migration, Normalisierung und Coordinate-Clamping.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks müssen vor den Importen stehen
const mockReadFile = vi.hoisted(() => vi.fn<(p0: string, p1: string) => Promise<string>>());
const mockWriteFile = vi.hoisted(() => vi.fn<(p0: string, p1: string, p2: string) => Promise<void>>());

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn().mockReturnValue('/mock-user-data'),
    },
}));

vi.mock('fs/promises', () => ({
    default: {
        readFile: (...args: unknown[]) => mockReadFile(args[0] as string, args[1] as string),
        writeFile: (...args: unknown[]) => mockWriteFile(args[0] as string, args[1] as string, args[2] as string),
    },
}));

vi.mock('../debugConfig', () => ({
    debugLog: vi.fn(),
}));

import { createRoiStore } from './roiStore';

/** Liest den zuletzt in den "Dateisystem-Mock" geschriebenen JSON-Inhalt */
function lastWrittenDb(): Record<string, unknown> {
    const calls = mockWriteFile.mock.calls;
    if (calls.length === 0) throw new Error('writeFile wurde nicht aufgerufen');
    return JSON.parse(calls[calls.length - 1][1]);
}

describe('createRoiStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockWriteFile.mockResolvedValue(undefined);
    });

    // =========================================================================
    // get()
    // =========================================================================

    describe('get()', () => {
        it('gibt null zurück für unbekanntes Profil', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({}));
            const store = createRoiStore();
            expect(await store.get('unknown')).toBeNull();
        });

        it('gibt gespeicherte ROI-Daten zurück', async () => {
            const db = {
                'p1': { exp: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 } },
            };
            mockReadFile.mockResolvedValue(JSON.stringify(db));
            const result = await createRoiStore().get('p1');
            expect(result).not.toBeNull();
            expect(result!.exp!.x).toBeCloseTo(0.1);
            expect(result!.exp!.y).toBeCloseTo(0.2);
            expect(result!.exp!.w).toBeCloseTo(0.3);
            expect(result!.exp!.h).toBeCloseTo(0.1);
        });

        it('gibt null zurück wenn die Datei nicht existiert', async () => {
            mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
            expect(await createRoiStore().get('p1')).toBeNull();
        });

        it('gibt null zurück bei ungültigem JSON', async () => {
            mockReadFile.mockResolvedValue('{ ungültiges json [');
            expect(await createRoiStore().get('p1')).toBeNull();
        });

        it('gibt null zurück wenn die Datei kein Objekt enthält', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify([1, 2, 3]));
            expect(await createRoiStore().get('p1')).toBeNull();
        });

        describe('Coordinate-Clamping auf [0, 1]', () => {
            it('klemmt negative x/y-Werte auf 0', async () => {
                const db = { 'p1': { exp: { x: -0.5, y: -1.0, w: 0.3, h: 0.1 } } };
                mockReadFile.mockResolvedValue(JSON.stringify(db));
                const result = await createRoiStore().get('p1');
                expect(result!.exp!.x).toBe(0);
                expect(result!.exp!.y).toBe(0);
            });

            it('klemmt x/y-Werte über 1 auf 1', async () => {
                const db = { 'p1': { lvl: { x: 1.5, y: 2.0, w: 0.2, h: 0.1 } } };
                mockReadFile.mockResolvedValue(JSON.stringify(db));
                const result = await createRoiStore().get('p1');
                expect(result!.lvl!.x).toBe(1);
                expect(result!.lvl!.y).toBe(1);
            });

            it('klemmt zu große w/h-Werte auf 1', async () => {
                const db = { 'p1': { charname: { x: 0.1, y: 0.1, w: 3.0, h: 5.0 } } };
                mockReadFile.mockResolvedValue(JSON.stringify(db));
                const result = await createRoiStore().get('p1');
                expect(result!.charname!.w).toBe(1);
                expect(result!.charname!.h).toBe(1);
            });

            it('erzwingt Mindestgröße 0.001 für w und h', async () => {
                const db = { 'p1': { lvl: { x: 0, y: 0, w: 0, h: 0 } } };
                mockReadFile.mockResolvedValue(JSON.stringify(db));
                const result = await createRoiStore().get('p1');
                expect(result!.lvl!.w).toBe(0.001);
                expect(result!.lvl!.h).toBe(0.001);
            });

            it('erzwingt Mindestgröße 0.001 auch für negative w/h-Werte', async () => {
                const db = { 'p1': { exp: { x: 0.5, y: 0.5, w: -0.5, h: -1.0 } } };
                mockReadFile.mockResolvedValue(JSON.stringify(db));
                const result = await createRoiStore().get('p1');
                // clamp01(-0.5) = 0, dann max(0.001, 0) = 0.001
                expect(result!.exp!.w).toBe(0.001);
                expect(result!.exp!.h).toBe(0.001);
            });
        });

        describe('Legacy-Migration (nameLevel → charname, expPercent → exp)', () => {
            it('migriert nameLevel zu charname wenn keine neuen Felder vorhanden', async () => {
                const db = {
                    'p1': {
                        nameLevel: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 },
                        expPercent: { x: 0.2, y: 0.2, w: 0.4, h: 0.1 },
                    },
                };
                mockReadFile.mockResolvedValue(JSON.stringify(db));
                const result = await createRoiStore().get('p1');
                expect(result!.charname).toBeDefined();
                expect(result!.exp).toBeDefined();
                expect(result!.nameLevel).toBeUndefined();
                expect(result!.expPercent).toBeUndefined();
            });

            it('migriert nur nameLevel wenn expPercent fehlt', async () => {
                const db = {
                    'p1': { nameLevel: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } },
                };
                mockReadFile.mockResolvedValue(JSON.stringify(db));
                const result = await createRoiStore().get('p1');
                expect(result!.charname).toBeDefined();
                expect(result!.exp).toBeUndefined();
                expect(result!.nameLevel).toBeUndefined();
            });

            it('entfernt nameLevel/expPercent wenn bereits neue Felder vorhanden sind', async () => {
                const db = {
                    'p1': {
                        charname: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 },
                        nameLevel: { x: 0.9, y: 0.9, w: 0.3, h: 0.1 }, // wird entfernt
                    },
                };
                mockReadFile.mockResolvedValue(JSON.stringify(db));
                const result = await createRoiStore().get('p1');
                expect(result!.charname).toBeDefined();
                expect(result!.nameLevel).toBeUndefined();
            });

            it('speichert automatisch nach Legacy-Migration', async () => {
                const db = {
                    'p1': { nameLevel: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } },
                };
                mockReadFile.mockResolvedValue(JSON.stringify(db));
                await createRoiStore().get('p1');
                expect(mockWriteFile).toHaveBeenCalled();
                // Das gespeicherte Objekt muss das migrierte Format haben
                const saved = lastWrittenDb() as Record<string, Record<string, unknown>>;
                expect(saved['p1'].charname).toBeDefined();
                expect(saved['p1'].nameLevel).toBeUndefined();
            });

            it('speichert NICHT wenn keine Migration nötig ist', async () => {
                const db = {
                    'p1': { exp: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 } },
                };
                mockReadFile.mockResolvedValue(JSON.stringify(db));
                await createRoiStore().get('p1');
                expect(mockWriteFile).not.toHaveBeenCalled();
            });
        });
    });

    // =========================================================================
    // set()
    // =========================================================================

    describe('set()', () => {
        it('speichert ROI-Daten in die Datenbank', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({}));
            await createRoiStore().set('p1', { exp: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 } });
            expect(mockWriteFile).toHaveBeenCalled();
            const saved = lastWrittenDb() as Record<string, unknown>;
            expect(saved['p1']).toBeDefined();
        });

        it('klemmt Koordinaten beim Speichern', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({}));
            await createRoiStore().set('p1', { exp: { x: -1, y: 2, w: 3, h: -0.5 } });
            const saved = lastWrittenDb() as Record<string, Record<string, Record<string, number>>>;
            expect(saved['p1'].exp.x).toBe(0);
            expect(saved['p1'].exp.y).toBe(1);
            expect(saved['p1'].exp.w).toBe(1);
            expect(saved['p1'].exp.h).toBe(0.001);
        });

        it('migriert Legacy-Felder beim Speichern', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({}));
            await createRoiStore().set('p1', {
                nameLevel: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 },
                expPercent: { x: 0.2, y: 0.2, w: 0.3, h: 0.1 },
            });
            const saved = lastWrittenDb() as Record<string, Record<string, unknown>>;
            expect(saved['p1'].charname).toBeDefined();
            expect(saved['p1'].exp).toBeDefined();
            expect(saved['p1'].nameLevel).toBeUndefined();
            expect(saved['p1'].expPercent).toBeUndefined();
        });

        it('behält andere Profile beim Speichern bei', async () => {
            const initialDb = { 'existing': { lvl: { x: 0.5, y: 0.5, w: 0.1, h: 0.1 } } };
            mockReadFile.mockResolvedValue(JSON.stringify(initialDb));
            await createRoiStore().set('new-profile', { exp: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 } });
            const saved = lastWrittenDb() as Record<string, unknown>;
            expect(saved['existing']).toBeDefined();
            expect(saved['new-profile']).toBeDefined();
        });

        it('überschreibt bestehende Daten für dasselbe Profil', async () => {
            const initialDb = { 'p1': { exp: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } } };
            mockReadFile.mockResolvedValue(JSON.stringify(initialDb));
            await createRoiStore().set('p1', { lvl: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 } });
            const saved = lastWrittenDb() as Record<string, Record<string, unknown>>;
            expect(saved['p1'].lvl).toBeDefined();
            // Das alte exp-Feld wird nicht übertragen (set ersetzt komplett)
        });
    });

    // =========================================================================
    // remove()
    // =========================================================================

    describe('remove()', () => {
        it('entfernt ein Profil aus der Datenbank', async () => {
            const db = {
                'p1': { exp: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 } },
                'p2': { lvl: { x: 0.5, y: 0.5, w: 0.1, h: 0.1 } },
            };
            mockReadFile.mockResolvedValue(JSON.stringify(db));
            await createRoiStore().remove('p1');
            const saved = lastWrittenDb() as Record<string, unknown>;
            expect(saved['p1']).toBeUndefined();
            expect(saved['p2']).toBeDefined();
        });

        it('schlägt nicht fehl bei unbekanntem Profil', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({}));
            await expect(createRoiStore().remove('unknown')).resolves.not.toThrow();
        });

        it('schreibt die aktualisierte Datenbank zurück', async () => {
            const db = { 'p1': { exp: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 } } };
            mockReadFile.mockResolvedValue(JSON.stringify(db));
            await createRoiStore().remove('p1');
            expect(mockWriteFile).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // listAll()
    // =========================================================================

    describe('listAll()', () => {
        it('gibt alle Profile zurück', async () => {
            const db = {
                'p1': { exp: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 } },
                'p2': { lvl: { x: 0.5, y: 0.5, w: 0.1, h: 0.1 } },
            };
            mockReadFile.mockResolvedValue(JSON.stringify(db));
            const result = await createRoiStore().listAll();
            expect(Object.keys(result)).toHaveLength(2);
            expect(result['p1']).toBeDefined();
            expect(result['p2']).toBeDefined();
        });

        it('gibt ein leeres Objekt zurück wenn die Datei fehlt', async () => {
            mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
            const result = await createRoiStore().listAll();
            expect(result).toEqual({});
        });

        it('gibt ein leeres Objekt zurück bei ungültigem JSON', async () => {
            mockReadFile.mockResolvedValue('{ kaputt');
            const result = await createRoiStore().listAll();
            expect(result).toEqual({});
        });

        it('gibt alle Profile zurück ohne sie zu normalisieren', async () => {
            // listAll() gibt die Rohdaten zurück — keine Normalisierung wie bei get()
            const db = {
                'p1': { nameLevel: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } },
            };
            mockReadFile.mockResolvedValue(JSON.stringify(db));
            const result = await createRoiStore().listAll() as typeof db;
            // Die Rohdaten werden unverändert zurückgegeben
            expect(result['p1'].nameLevel).toBeDefined();
        });
    });
});

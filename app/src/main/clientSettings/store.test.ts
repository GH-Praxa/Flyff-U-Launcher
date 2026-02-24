/**
 * Tests für den ClientSettings-Store.
 * Testet die echte Normalisierungslogik: Clamping, Validierung und Legacy-Migration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockReadFile = vi.hoisted(() => vi.fn<(p0: string, p1: string) => Promise<string>>());
const mockWriteFile = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<void>>());
const mockMkdir = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<void>>());

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn().mockReturnValue('/mock-user-data'),
    },
}));

vi.mock('fs/promises', () => ({
    default: {
        readFile: (...args: unknown[]) => mockReadFile(args[0] as string, args[1] as string),
        writeFile: (...args: unknown[]) => mockWriteFile(...args),
        mkdir: (...args: unknown[]) => mockMkdir(...args),
    },
}));

import { createClientSettingsStore } from './store';
import { LAYOUT } from '../../shared/constants';
import { DEFAULT_HOTKEYS } from '../../shared/hotkeys';

/** Gibt den zuletzt in writeFile geschriebenen Settings-Inhalt zurück */
function lastWrittenSettings(): Record<string, unknown> {
    const calls = mockWriteFile.mock.calls;
    if (calls.length === 0) throw new Error('writeFile wurde nicht aufgerufen');
    return JSON.parse(calls[calls.length - 1][1] as string);
}

describe('createClientSettingsStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockWriteFile.mockResolvedValue(undefined);
        mockMkdir.mockResolvedValue(undefined);
    });

    // =========================================================================
    // get() — Standard-Einstellungen
    // =========================================================================

    describe('get() – Standardwerte und Normalisierung', () => {
        it('gibt Standard-Einstellungen zurück wenn die Datei nicht existiert', async () => {
            mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
            const settings = await createClientSettingsStore().get();
            expect(settings.locale).toBe('en');
            expect(settings.startFullscreen).toBe(false);
            expect(settings.layoutDelaySeconds).toBe(2);
        });

        it('gibt Standard-Einstellungen zurück bei ungültigem JSON', async () => {
            mockReadFile.mockResolvedValue('{ kaputt');
            const settings = await createClientSettingsStore().get();
            expect(settings.launcherWidth).toBe(LAYOUT.LAUNCHER_WIDTH);
        });

        it('gibt Standard-Einstellungen zurück wenn die Datei kein Objekt enthält', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify(null));
            const settings = await createClientSettingsStore().get();
            expect(settings.locale).toBe('en');
        });

        it('liest und normalisiert gültige Einstellungen', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({
                startFullscreen: true,
                layoutDelaySeconds: 5,
                locale: 'de',
                hotkeys: DEFAULT_HOTKEYS,
                launcherWidth: LAYOUT.LAUNCHER_WIDTH,
                launcherHeight: LAYOUT.LAUNCHER_HEIGHT,
            }));
            const settings = await createClientSettingsStore().get();
            expect(settings.startFullscreen).toBe(true);
            expect(settings.layoutDelaySeconds).toBe(5);
            expect(settings.locale).toBe('de');
        });
    });

    // =========================================================================
    // Normalisierung: layoutDelaySeconds
    // =========================================================================

    describe('layoutDelaySeconds – Clamping auf [0, 30]', () => {
        it('klemmt negative Werte auf 0', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ layoutDelaySeconds: -5 }));
            const settings = await createClientSettingsStore().get();
            expect(settings.layoutDelaySeconds).toBe(0);
        });

        it('klemmt Werte über 30 auf 30', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ layoutDelaySeconds: 999 }));
            const settings = await createClientSettingsStore().get();
            expect(settings.layoutDelaySeconds).toBe(30);
        });

        it('akzeptiert den Grenzwert 30', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ layoutDelaySeconds: 30 }));
            const settings = await createClientSettingsStore().get();
            expect(settings.layoutDelaySeconds).toBe(30);
        });

        it('akzeptiert 0', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ layoutDelaySeconds: 0 }));
            const settings = await createClientSettingsStore().get();
            expect(settings.layoutDelaySeconds).toBe(0);
        });

        it('gibt den Standardwert zurück bei NaN', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ layoutDelaySeconds: 'nicht-numerisch' }));
            const settings = await createClientSettingsStore().get();
            // Number('nicht-numerisch') = NaN → default = 2
            expect(settings.layoutDelaySeconds).toBe(2);
        });

        it('interpretiert einen String mit Zahlenwert korrekt', async () => {
            // Number('5') = 5, also gültig und wird geclampd
            mockReadFile.mockResolvedValue(JSON.stringify({ layoutDelaySeconds: '5' }));
            const settings = await createClientSettingsStore().get();
            expect(settings.layoutDelaySeconds).toBe(5);
        });
    });

    // =========================================================================
    // Normalisierung: tabLayoutDisplay
    // =========================================================================

    describe('tabLayoutDisplay – Enum-Normalisierung', () => {
        const validValues = ['compact', 'grouped', 'separated', 'mini-grid'] as const;

        it.each(validValues)('akzeptiert gültigen Wert "%s"', async (value) => {
            mockReadFile.mockResolvedValue(JSON.stringify({ tabLayoutDisplay: value }));
            const settings = await createClientSettingsStore().get();
            expect(settings.tabLayoutDisplay).toBe(value);
        });

        it('fällt auf "compact" zurück bei ungültigem Wert', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ tabLayoutDisplay: 'invalid-mode' }));
            const settings = await createClientSettingsStore().get();
            expect(settings.tabLayoutDisplay).toBe('compact');
        });

        it('fällt auf "compact" zurück bei fehlendem Wert', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({}));
            const settings = await createClientSettingsStore().get();
            expect(settings.tabLayoutDisplay).toBe('compact');
        });
    });

    // =========================================================================
    // Normalisierung: Locale
    // =========================================================================

    describe('locale – Schema-Validierung', () => {
        it('akzeptiert gültige Locale-Werte', async () => {
            for (const locale of ['en', 'de', 'pl', 'fr', 'ru', 'tr', 'cn', 'jp']) {
                mockReadFile.mockResolvedValue(JSON.stringify({ locale }));
                const settings = await createClientSettingsStore().get();
                expect(settings.locale).toBe(locale);
            }
        });

        it('fällt auf "en" zurück bei ungültiger Locale', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ locale: 'zz' }));
            const settings = await createClientSettingsStore().get();
            expect(settings.locale).toBe('en');
        });
    });

    // =========================================================================
    // Normalisierung: gameFont
    // =========================================================================

    describe('gameFont – String-Truncation', () => {
        it('gibt null zurück wenn kein gameFont gesetzt', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({}));
            const settings = await createClientSettingsStore().get();
            expect(settings.gameFont).toBeNull();
        });

        it('gibt null zurück für nicht-string gameFont', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ gameFont: 123 }));
            const settings = await createClientSettingsStore().get();
            expect(settings.gameFont).toBeNull();
        });

        it('akzeptiert einen normalen Font-Namen', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ gameFont: 'Arial' }));
            const settings = await createClientSettingsStore().get();
            expect(settings.gameFont).toBe('Arial');
        });

        it('schneidet auf 256 Zeichen ab', async () => {
            const longFont = 'A'.repeat(300);
            mockReadFile.mockResolvedValue(JSON.stringify({ gameFont: longFont }));
            const settings = await createClientSettingsStore().get();
            expect(settings.gameFont).toHaveLength(256);
            expect(settings.gameFont).toBe('A'.repeat(256));
        });
    });

    // =========================================================================
    // Normalisierung: launcherFontSize
    // =========================================================================

    describe('launcherFontSize – Validierung [75, 150]', () => {
        it('gibt null zurück wenn nicht gesetzt', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({}));
            const settings = await createClientSettingsStore().get();
            expect(settings.launcherFontSize).toBeNull();
        });

        it('akzeptiert gültige Werte im Bereich [75, 150]', async () => {
            for (const size of [75, 100, 150]) {
                mockReadFile.mockResolvedValue(JSON.stringify({ launcherFontSize: size }));
                const settings = await createClientSettingsStore().get();
                expect(settings.launcherFontSize).toBe(size);
            }
        });

        it('gibt null zurück bei Wert unter 75', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ launcherFontSize: 74 }));
            const settings = await createClientSettingsStore().get();
            expect(settings.launcherFontSize).toBeNull();
        });

        it('gibt null zurück bei Wert über 150', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ launcherFontSize: 151 }));
            const settings = await createClientSettingsStore().get();
            expect(settings.launcherFontSize).toBeNull();
        });

        it('gibt null zurück bei nicht-numerischem Wert', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ launcherFontSize: 'large' }));
            const settings = await createClientSettingsStore().get();
            expect(settings.launcherFontSize).toBeNull();
        });
    });

    // =========================================================================
    // Normalisierung: LauncherSize
    // =========================================================================

    describe('launcherWidth/launcherHeight – Clamping', () => {
        it('klemmt zu kleine Werte auf Minimum', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ launcherWidth: 0, launcherHeight: 0 }));
            const settings = await createClientSettingsStore().get();
            expect(settings.launcherWidth).toBe(LAYOUT.LAUNCHER_MIN_WIDTH);
            expect(settings.launcherHeight).toBe(LAYOUT.LAUNCHER_MIN_HEIGHT);
        });

        it('klemmt zu große Werte auf Maximum', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ launcherWidth: 99999, launcherHeight: 99999 }));
            const settings = await createClientSettingsStore().get();
            expect(settings.launcherWidth).toBe(LAYOUT.LAUNCHER_MAX_WIDTH);
            expect(settings.launcherHeight).toBe(LAYOUT.LAUNCHER_MAX_HEIGHT);
        });

        it('akzeptiert gültige Werte', async () => {
            const w = LAYOUT.LAUNCHER_MIN_WIDTH + 50;
            const h = LAYOUT.LAUNCHER_MIN_HEIGHT + 50;
            mockReadFile.mockResolvedValue(JSON.stringify({ launcherWidth: w, launcherHeight: h }));
            const settings = await createClientSettingsStore().get();
            expect(settings.launcherWidth).toBe(w);
            expect(settings.launcherHeight).toBe(h);
        });
    });

    // =========================================================================
    // Legacy-Hotkey-Migration
    // =========================================================================

    describe('Hotkey-Migration (tabLeftPrev → tabPrev)', () => {
        it('migriert Legacy-Hotkeys und speichert automatisch', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({
                hotkeys: {
                    tabLeftPrev: ['Ctrl', 'Shift', 'Left'],
                    tabLeftNext: ['Ctrl', 'Shift', 'Right'],
                },
            }));
            const store = createClientSettingsStore();
            const settings = await store.get();
            // Nach der Migration sollten tabPrev/tabNext befüllt sein
            expect(settings.hotkeys.tabPrev).toBeDefined();
            // Und writeFile sollte aufgerufen worden sein, um die Migration zu speichern
            expect(mockWriteFile).toHaveBeenCalled();
        });

        it('speichert NICHT wenn keine Hotkey-Migration nötig', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({
                hotkeys: DEFAULT_HOTKEYS,
            }));
            await createClientSettingsStore().get();
            expect(mockWriteFile).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // patch()
    // =========================================================================

    describe('patch()', () => {
        it('aktualisiert startFullscreen', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ startFullscreen: false }));
            await createClientSettingsStore().patch({ startFullscreen: true });
            const saved = lastWrittenSettings();
            expect(saved.startFullscreen).toBe(true);
        });

        it('klemmt layoutDelaySeconds beim Patchen', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ layoutDelaySeconds: 5 }));
            await createClientSettingsStore().patch({ layoutDelaySeconds: 999 });
            const saved = lastWrittenSettings();
            expect(saved.layoutDelaySeconds).toBe(30);
        });

        it('normalisiert tabLayoutDisplay beim Patchen', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({}));
            await createClientSettingsStore().patch({ tabLayoutDisplay: 'grouped' });
            const saved = lastWrittenSettings();
            expect(saved.tabLayoutDisplay).toBe('grouped');
        });

        it('ignoriert ungültige tabLayoutDisplay beim Patchen', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ tabLayoutDisplay: 'compact' }));
            await createClientSettingsStore().patch({ tabLayoutDisplay: 'invalid' as never });
            const saved = lastWrittenSettings();
            // Ungültiger Wert → Fallback auf 'compact'
            expect(saved.tabLayoutDisplay).toBe('compact');
        });

        it('aktualisiert locale mit gültigem Wert', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ locale: 'en' }));
            await createClientSettingsStore().patch({ locale: 'de' });
            const saved = lastWrittenSettings();
            expect(saved.locale).toBe('de');
        });

        it('ignoriert ungültige locale beim Patchen', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ locale: 'en' }));
            await createClientSettingsStore().patch({ locale: 'zz' as never });
            const saved = lastWrittenSettings();
            expect(saved.locale).toBe('en');
        });

        it('schneidet gameFont auf 256 Zeichen ab', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({}));
            await createClientSettingsStore().patch({ gameFont: 'A'.repeat(400) });
            const saved = lastWrittenSettings();
            expect((saved.gameFont as string).length).toBe(256);
        });

        it('setzt gameFont auf null wenn null übergeben wird', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ gameFont: 'Arial' }));
            await createClientSettingsStore().patch({ gameFont: null });
            const saved = lastWrittenSettings();
            expect(saved.gameFont).toBeNull();
        });

        it('validiert launcherFontSize beim Patchen', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({}));
            await createClientSettingsStore().patch({ launcherFontSize: 200 }); // > 150 → null
            const saved = lastWrittenSettings();
            expect(saved.launcherFontSize).toBeNull();
        });

        it('akzeptiert gültige launcherFontSize beim Patchen', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({}));
            await createClientSettingsStore().patch({ launcherFontSize: 110 });
            const saved = lastWrittenSettings();
            expect(saved.launcherFontSize).toBe(110);
        });

        it('klemmt fcoinRate auf positive Werte', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ fcoinRate: 200_000_000 }));
            await createClientSettingsStore().patch({ fcoinRate: -100 });
            const saved = lastWrittenSettings();
            // Negative Werte werden ignoriert, der alte Wert bleibt
            expect(saved.fcoinRate).toBe(200_000_000);
        });

        it('akzeptiert positive fcoinRate', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ fcoinRate: 200_000_000 }));
            await createClientSettingsStore().patch({ fcoinRate: 150_000_000 });
            const saved = lastWrittenSettings();
            expect(saved.fcoinRate).toBe(150_000_000);
        });

        it('löscht logsWebhook bei leerem String', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ logsWebhook: 'https://example.com/webhook' }));
            await createClientSettingsStore().patch({ logsWebhook: '' });
            const saved = lastWrittenSettings();
            // Leerer String → undefined (wird nicht gespeichert)
            expect(saved.logsWebhook).toBeUndefined();
        });

        it('aktualisiert toastDurationSeconds und klemmt auf [1, 60]', async () => {
            mockReadFile.mockResolvedValue(JSON.stringify({ toastDurationSeconds: 5 }));
            await createClientSettingsStore().patch({ toastDurationSeconds: 0 });
            const saved = lastWrittenSettings();
            expect(saved.toastDurationSeconds).toBe(1);

            mockReadFile.mockResolvedValue(JSON.stringify({ toastDurationSeconds: 5 }));
            await createClientSettingsStore().patch({ toastDurationSeconds: 100 });
            const saved2 = lastWrittenSettings();
            expect(saved2.toastDurationSeconds).toBe(60);
        });
    });
});

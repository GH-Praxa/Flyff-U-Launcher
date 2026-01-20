/**
 * Tests for i18n translation utilities.
 * Tests cover: translate function, getTips function, locale handling.
 */
import { describe, it, expect } from 'vitest';
import {
    translate,
    getTips,
    translations,
    DEFAULT_LOCALE,
    type Locale,
    type TranslationKey,
} from './translations';

describe('translations', () => {
    // =========================================================================
    // translate()
    // =========================================================================

    describe('translate()', () => {
        it('should return English translation for default locale', () => {
            const result = translate('en', 'profile.play');

            expect(result).toBe('Play');
        });

        it('should return German translation for de locale', () => {
            const result = translate('de', 'profile.play');

            expect(result).toBe('Spielen');
        });

        it('should return Polish translation for pl locale', () => {
            const result = translate('pl', 'profile.play');

            expect(result).toBe('Graj');
        });

        it('should return French translation for fr locale', () => {
            const result = translate('fr', 'profile.play');

            expect(result).toBe('Jouer');
        });

        it('should return Russian translation for ru locale', () => {
            const result = translate('ru', 'profile.play');

            expect(result).toBe('Играть');
        });

        it('should return Turkish translation for tr locale', () => {
            const result = translate('tr', 'profile.play');

            expect(result).toBe('Oyna');
        });

        it('should return Chinese translation for cn locale', () => {
            const result = translate('cn', 'profile.play');

            expect(result).toBe('开始游戏');
        });

        it('should return Japanese translation for jp locale', () => {
            const result = translate('jp', 'profile.play');

            expect(result).toBe('プレイ');
        });

        it('should fallback to English for unknown locale', () => {
            // Cast to Locale to test fallback behavior
            const result = translate('unknown' as Locale, 'profile.play');

            expect(result).toBe('Play');
        });

        it('should return key if translation not found', () => {
            const result = translate('en', 'nonexistent.key' as TranslationKey);

            expect(result).toBe('nonexistent.key');
        });

        it('should translate header.newProfile correctly', () => {
            expect(translate('en', 'header.newProfile')).toBe('New profile');
            expect(translate('de', 'header.newProfile')).toBe('Neues Profil');
        });

        it('should translate profile.mode.tabs correctly', () => {
            expect(translate('en', 'profile.mode.tabs')).toBe('Tabs');
            expect(translate('de', 'profile.mode.tabs')).toBe('Tabs');
            expect(translate('jp', 'profile.mode.tabs')).toBe('タブ');
        });

        it('should translate news keys correctly', () => {
            expect(translate('en', 'news.title')).toBe('Newsfeed');
            expect(translate('de', 'news.title')).toBe('Newsfeed');
            expect(translate('fr', 'news.title')).toBe("Fil d'actus");
        });
    });

    // =========================================================================
    // getTips()
    // =========================================================================

    describe('getTips()', () => {
        it('should return array of tips for English', () => {
            const tips = getTips('en');

            expect(Array.isArray(tips)).toBe(true);
            expect(tips.length).toBeGreaterThan(0);
            expect(tips[0]).toContain('Drag');
        });

        it('should return array of tips for German', () => {
            const tips = getTips('de');

            expect(Array.isArray(tips)).toBe(true);
            expect(tips.length).toBeGreaterThan(0);
            expect(tips[0]).toContain('Ziehe');
        });

        it('should return tips for all supported locales', () => {
            const locales: Locale[] = ['en', 'de', 'pl', 'fr', 'ru', 'tr', 'cn', 'jp'];

            for (const locale of locales) {
                const tips = getTips(locale);
                expect(Array.isArray(tips)).toBe(true);
                expect(tips.length).toBeGreaterThan(0);
            }
        });

        it('should fallback to English tips for unknown locale', () => {
            const tips = getTips('unknown' as Locale);
            const englishTips = getTips('en');

            expect(tips).toEqual(englishTips);
        });

        it('should have meaningful tip content', () => {
            const tips = getTips('en');

            // Check that tips mention relevant features
            const allTipsText = tips.join(' ');
            expect(allTipsText).toContain('profile');
        });
    });

    // =========================================================================
    // Translation completeness
    // =========================================================================

    describe('translation completeness', () => {
        it('should have translations object with all locales', () => {
            const expectedLocales: Locale[] = ['en', 'de', 'pl', 'fr', 'ru', 'tr', 'cn', 'jp'];

            for (const locale of expectedLocales) {
                expect(translations[locale]).toBeDefined();
            }
        });

        it('should have English as default locale', () => {
            expect(DEFAULT_LOCALE).toBe('en');
        });

        it('should have same keys in all locale translations', () => {
            const englishKeys = Object.keys(translations.en);
            const locales: Locale[] = ['de', 'pl', 'fr', 'ru', 'tr', 'cn', 'jp'];

            for (const locale of locales) {
                const localeKeys = Object.keys(translations[locale]);
                expect(localeKeys.length).toBe(englishKeys.length);

                for (const key of englishKeys) {
                    expect(
                        translations[locale][key as TranslationKey],
                        `Missing key "${key}" in locale "${locale}"`
                    ).toBeDefined();
                }
            }
        });

        it('should not have empty translation values', () => {
            const locales: Locale[] = ['en', 'de', 'pl', 'fr', 'ru', 'tr', 'cn', 'jp'];

            for (const locale of locales) {
                const localeTranslations = translations[locale];
                for (const [key, value] of Object.entries(localeTranslations)) {
                    expect(
                        value.length,
                        `Empty translation for key "${key}" in locale "${locale}"`
                    ).toBeGreaterThan(0);
                }
            }
        });
    });

    // =========================================================================
    // Specific translation keys
    // =========================================================================

    describe('specific translation keys', () => {
        it('should translate config.title', () => {
            expect(translate('en', 'config.title')).toBe('Settings');
            expect(translate('de', 'config.title')).toBe('Einstellungen');
        });

        it('should translate create actions', () => {
            expect(translate('en', 'create.add')).toBe('Add');
            expect(translate('en', 'create.cancel')).toBe('Close');
            expect(translate('en', 'create.delete')).toBe('Delete');
        });

        it('should translate list messages', () => {
            expect(translate('en', 'list.empty')).toContain('No profiles');
            expect(translate('de', 'list.empty')).toContain('keine Profile');
        });

        it('should translate layout keys', () => {
            expect(translate('en', 'layout.title')).toBe('Tab layouts');
            expect(translate('de', 'layout.title')).toBe('Tab-Layouts');
        });

        it('should translate theme keys', () => {
            expect(translate('en', 'config.theme.active')).toBe('Active');
            expect(translate('de', 'config.theme.active')).toBe('Aktiv');
        });
    });
});

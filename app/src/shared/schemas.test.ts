/**
 * Tests for Zod schemas and validation helpers.
 */
import { describe, it, expect } from 'vitest';
import {
    IdSchema,
    NameSchema,
    BoundsSchema,
    RatioSchema,
    LaunchModeSchema,
    OverlaySettingsSchema,
    ProfileSchema,
    ProfilePatchSchema,
    TabLayoutSchema,
    TabLayoutInputSchema,
    ThemeColorsSchema,
    RoiRectSchema,
    RoiDataSchema,
    SplitPairSchema,
    safeParse,
    parse,
    validate,
} from './schemas';

describe('Schemas', () => {
    // =========================================================================
    // Base Schemas
    // =========================================================================

    describe('IdSchema', () => {
        it('should accept valid alphanumeric IDs', () => {
            expect(IdSchema.safeParse('abc123').success).toBe(true);
            expect(IdSchema.safeParse('user-id-1').success).toBe(true);
            expect(IdSchema.safeParse('profile_name').success).toBe(true);
            expect(IdSchema.safeParse('A').success).toBe(true);
        });

        it('should reject empty ID', () => {
            expect(IdSchema.safeParse('').success).toBe(false);
        });

        it('should reject IDs with invalid characters', () => {
            expect(IdSchema.safeParse('id with space').success).toBe(false);
            expect(IdSchema.safeParse('id@special').success).toBe(false);
            expect(IdSchema.safeParse('id.with.dots').success).toBe(false);
        });

        it('should reject IDs exceeding max length', () => {
            const longId = 'a'.repeat(65);
            expect(IdSchema.safeParse(longId).success).toBe(false);
        });

        it('should accept ID at max length', () => {
            const maxId = 'a'.repeat(64);
            expect(IdSchema.safeParse(maxId).success).toBe(true);
        });
    });

    describe('NameSchema', () => {
        it('should accept valid names', () => {
            expect(NameSchema.safeParse('John Doe').success).toBe(true);
            expect(NameSchema.safeParse('A').success).toBe(true);
            expect(NameSchema.safeParse('Project Alpha 2.0').success).toBe(true);
            expect(NameSchema.safeParse('Name with special chars: @#$%').success).toBe(true);
        });

        it('should reject empty name', () => {
            expect(NameSchema.safeParse('').success).toBe(false);
        });

        it('should reject names exceeding max length', () => {
            const longName = 'a'.repeat(257);
            expect(NameSchema.safeParse(longName).success).toBe(false);
        });

        it('should accept name at max length', () => {
            const maxName = 'a'.repeat(256);
            expect(NameSchema.safeParse(maxName).success).toBe(true);
        });
    });

    describe('BoundsSchema', () => {
        it('should accept valid bounds', () => {
            const bounds = { x: 100, y: 200, width: 800, height: 600 };
            expect(BoundsSchema.safeParse(bounds).success).toBe(true);
        });

        it('should accept negative x and y', () => {
            const bounds = { x: -100, y: -200, width: 800, height: 600 };
            expect(BoundsSchema.safeParse(bounds).success).toBe(true);
        });

        it('should reject negative width', () => {
            const bounds = { x: 0, y: 0, width: -100, height: 600 };
            expect(BoundsSchema.safeParse(bounds).success).toBe(false);
        });

        it('should reject negative height', () => {
            const bounds = { x: 0, y: 0, width: 800, height: -100 };
            expect(BoundsSchema.safeParse(bounds).success).toBe(false);
        });

        it('should accept zero width and height', () => {
            const bounds = { x: 0, y: 0, width: 0, height: 0 };
            expect(BoundsSchema.safeParse(bounds).success).toBe(true);
        });

        it('should reject infinite values', () => {
            const bounds = { x: Infinity, y: 0, width: 100, height: 100 };
            expect(BoundsSchema.safeParse(bounds).success).toBe(false);
        });
    });

    describe('RatioSchema', () => {
        it('should accept values between 0 and 1', () => {
            expect(RatioSchema.safeParse(0).success).toBe(true);
            expect(RatioSchema.safeParse(0.5).success).toBe(true);
            expect(RatioSchema.safeParse(1).success).toBe(true);
        });

        it('should reject values below 0', () => {
            expect(RatioSchema.safeParse(-0.1).success).toBe(false);
        });

        it('should reject values above 1', () => {
            expect(RatioSchema.safeParse(1.1).success).toBe(false);
        });
    });

    describe('LaunchModeSchema', () => {
        it('should accept valid launch modes', () => {
            expect(LaunchModeSchema.safeParse('tabs').success).toBe(true);
            expect(LaunchModeSchema.safeParse('window').success).toBe(true);
        });

        it('should reject invalid launch modes', () => {
            expect(LaunchModeSchema.safeParse('invalid').success).toBe(false);
            expect(LaunchModeSchema.safeParse('').success).toBe(false);
        });
    });

    // =========================================================================
    // Profile Schemas
    // =========================================================================

    describe('OverlaySettingsSchema', () => {
        it('should accept empty object', () => {
            expect(OverlaySettingsSchema.safeParse({}).success).toBe(true);
        });

        it('should accept partial settings', () => {
            const settings = { showExp: true, showKillsSession: false };
            expect(OverlaySettingsSchema.safeParse(settings).success).toBe(true);
        });

        it('should accept full settings', () => {
            const settings = {
                showExp: true,
                showDeltaExp: false,
                showTotalExp: true,
                showKillsSession: true,
                showKillsLifetime: false,
                showKillsPerMinute: true,
                showKillsPerHour: false,
                showSessionTime: true,
                showLastKill: false,
                showAvgExpPerKill: true,
                showExpPerMinute: false,
                showResetButton: true,
            };
            expect(OverlaySettingsSchema.safeParse(settings).success).toBe(true);
        });
    });

    describe('ProfileSchema', () => {
        it('should accept valid profile', () => {
            const profile = {
                id: 'profile-1',
                name: 'My Profile',
                createdAt: '2024-01-01T00:00:00Z',
                launchMode: 'tabs',
            };
            expect(ProfileSchema.safeParse(profile).success).toBe(true);
        });

        it('should accept profile with optional fields', () => {
            const profile = {
                id: 'profile-2',
                name: 'Full Profile',
                createdAt: '2024-01-01T00:00:00Z',
                job: 'Blade',
                launchMode: 'window',
                overlayTarget: true,
                overlaySupportTarget: true,
                overlayIconKey: 'sword',
                overlaySupportIconKey: 'support',
                features: { questlog: { enabled: true } },
            };
            expect(ProfileSchema.safeParse(profile).success).toBe(true);
        });

        it('should reject profile without required fields', () => {
            const profile = { id: 'profile-1', name: 'Test' };
            expect(ProfileSchema.safeParse(profile).success).toBe(false);
        });
    });

    describe('ProfilePatchSchema', () => {
        it('should require id field', () => {
            const patch = { name: 'New Name' };
            expect(ProfilePatchSchema.safeParse(patch).success).toBe(false);
        });

        it('should accept patch with only id', () => {
            const patch = { id: 'profile-1' };
            expect(ProfilePatchSchema.safeParse(patch).success).toBe(true);
        });

        it('should accept patch with id and partial fields', () => {
            const patch = { id: 'profile-1', name: 'New Name', job: 'Knight' };
            expect(ProfilePatchSchema.safeParse(patch).success).toBe(true);
        });
    });

    // =========================================================================
    // Tab Layout Schemas
    // =========================================================================

    describe('TabLayoutSchema', () => {
        it('should accept valid layout', () => {
            const layout = {
                id: 'layout-1',
                name: 'My Layout',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
                tabs: ['profile-1'],
            };
            expect(TabLayoutSchema.safeParse(layout).success).toBe(true);
        });

        it('should reject layout without tabs', () => {
            const layout = {
                id: 'layout-1',
                name: 'My Layout',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
                tabs: [],
            };
            expect(TabLayoutSchema.safeParse(layout).success).toBe(false);
        });

        it('should accept layout with split', () => {
            const layout = {
                id: 'layout-1',
                name: 'Split Layout',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
                tabs: ['profile-1', 'profile-2'],
                split: { leftId: 'profile-1', rightId: 'profile-2', ratio: 0.5 },
            };
            expect(TabLayoutSchema.safeParse(layout).success).toBe(true);
        });
    });

    describe('TabLayoutInputSchema', () => {
        it('should accept input without id (for creation)', () => {
            const input = {
                name: 'New Layout',
                tabs: ['profile-1'],
            };
            expect(TabLayoutInputSchema.safeParse(input).success).toBe(true);
        });

        it('should accept input with id (for update)', () => {
            const input = {
                id: 'layout-1',
                name: 'Updated Layout',
                tabs: ['profile-1', 'profile-2'],
            };
            expect(TabLayoutInputSchema.safeParse(input).success).toBe(true);
        });
    });

    // =========================================================================
    // Theme Schemas
    // =========================================================================

    describe('ThemeColorsSchema', () => {
        it('should accept valid theme colors', () => {
            const colors = {
                bg: '#000000',
                panel: '#111111',
                panel2: '#222222',
                stroke: '#333333',
                text: '#ffffff',
                muted: '#888888',
                blue: '#0000ff',
                blue2: '#0066ff',
                danger: '#ff0000',
                green: '#00ff00',
                accent: '#ff00ff',
                tabActive: '#00ffff',
            };
            expect(ThemeColorsSchema.safeParse(colors).success).toBe(true);
        });

        it('should reject missing color fields', () => {
            const colors = {
                bg: '#000000',
                panel: '#111111',
            };
            expect(ThemeColorsSchema.safeParse(colors).success).toBe(false);
        });
    });

    // =========================================================================
    // ROI Schemas
    // =========================================================================

    describe('RoiRectSchema', () => {
        it('should accept valid normalized coordinates', () => {
            const rect = { x: 0.1, y: 0.2, width: 0.5, height: 0.3 };
            expect(RoiRectSchema.safeParse(rect).success).toBe(true);
        });

        it('should accept boundary values', () => {
            const rect = { x: 0, y: 0, width: 1, height: 1 };
            expect(RoiRectSchema.safeParse(rect).success).toBe(true);
        });

        it('should reject values outside 0-1 range', () => {
            const rect = { x: 1.5, y: 0, width: 0.5, height: 0.5 };
            expect(RoiRectSchema.safeParse(rect).success).toBe(false);
        });

        it('should reject negative values', () => {
            const rect = { x: -0.1, y: 0, width: 0.5, height: 0.5 };
            expect(RoiRectSchema.safeParse(rect).success).toBe(false);
        });
    });

    describe('RoiDataSchema', () => {
        it('should accept valid ROI data', () => {
            const data = {
                lvl: { x: 0.1, y: 0.1, width: 0.2, height: 0.05 },
                charname: { x: 0.2, y: 0.15, width: 0.25, height: 0.06 },
                exp: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 },
                lauftext: { x: 0.05, y: 0.8, width: 0.9, height: 0.15 },
            };
            expect(RoiDataSchema.safeParse(data).success).toBe(true);
        });

        it('should accept partial ROI data with at least one field', () => {
            const data = {
                exp: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 },
            };
            expect(RoiDataSchema.safeParse(data).success).toBe(true);
        });

        it('should reject empty ROI data', () => {
            expect(RoiDataSchema.safeParse({}).success).toBe(false);
        });
    });

    describe('SplitPairSchema', () => {
        it('should accept valid split pair', () => {
            const pair = { primary: 'profile-1', secondary: 'profile-2' };
            expect(SplitPairSchema.safeParse(pair).success).toBe(true);
        });

        it('should accept split pair with ratio', () => {
            const pair = { primary: 'profile-1', secondary: 'profile-2', ratio: 0.6 };
            expect(SplitPairSchema.safeParse(pair).success).toBe(true);
        });

        it('should reject invalid ratio', () => {
            const pair = { primary: 'profile-1', secondary: 'profile-2', ratio: 1.5 };
            expect(SplitPairSchema.safeParse(pair).success).toBe(false);
        });
    });

    // =========================================================================
    // Validation Helpers
    // =========================================================================

    describe('safeParse', () => {
        it('should return data on success', () => {
            const result = safeParse(IdSchema, 'valid-id');
            expect(result).toBe('valid-id');
        });

        it('should return null on failure', () => {
            const result = safeParse(IdSchema, '');
            expect(result).toBeNull();
        });

        it('should work with complex schemas', () => {
            const bounds = { x: 0, y: 0, width: 100, height: 100 };
            const result = safeParse(BoundsSchema, bounds);
            expect(result).toEqual(bounds);
        });
    });

    describe('parse', () => {
        it('should return data on success', () => {
            const result = parse(IdSchema, 'valid-id');
            expect(result).toBe('valid-id');
        });

        it('should throw on failure', () => {
            expect(() => parse(IdSchema, '')).toThrow();
        });
    });

    describe('validate', () => {
        it('should return success with data on valid input', () => {
            const result = validate(IdSchema, 'valid-id');
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe('valid-id');
            }
        });

        it('should return failure with errors on invalid input', () => {
            const result = validate(IdSchema, '');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors.length).toBeGreaterThan(0);
            }
        });

        it('should include path in error messages', () => {
            const result = validate(BoundsSchema, { x: 0, y: 0, width: -1, height: 100 });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors.some(e => e.includes('width'))).toBe(true);
            }
        });
    });
});

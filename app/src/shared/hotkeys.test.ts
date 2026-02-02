/**
 * Tests for hotkey settings normalization and merging.
 */
import { describe, it, expect } from 'vitest';
import {
    sanitizeHotkeyChord,
    normalizeHotkeySettings,
    mergeHotkeySettings,
    DEFAULT_HOTKEYS,
    formatHotkey,
    chordToAccelerator,
} from './hotkeys';

describe('Hotkey Utilities', () => {
    describe('sanitizeHotkeyChord', () => {
        it('should normalize valid hotkey chords', () => {
            expect(sanitizeHotkeyChord(['Ctrl', 'T'])).toEqual(['Ctrl', 'T']);
            expect(sanitizeHotkeyChord(['Control', 't'])).toEqual(['Ctrl', 'T']);
            expect(sanitizeHotkeyChord(['Ctrl', 'Shift', 'T'])).toEqual(['Ctrl', 'Shift', 'T']);
        });

        it('should return null for invalid chords', () => {
            expect(sanitizeHotkeyChord(['T'])).toBeNull(); // too short
            expect(sanitizeHotkeyChord(['Ctrl', 'Shift', 'Alt', 'T'])).toBeNull(); // too long
            expect(sanitizeHotkeyChord(['Ctrl', 'Shift'])).toBeNull(); // no non-modifier
        });

        it('should handle string input', () => {
            expect(sanitizeHotkeyChord('Ctrl+T')).toEqual(['Ctrl', 'T']);
            expect(sanitizeHotkeyChord('Ctrl+Shift+T')).toEqual(['Ctrl', 'Shift', 'T']);
        });

        it('should return null for null/undefined', () => {
            expect(sanitizeHotkeyChord(null)).toBeNull();
            expect(sanitizeHotkeyChord(undefined)).toBeNull();
        });
    });

    describe('normalizeHotkeySettings', () => {
        it('should use fallback for missing values', () => {
            const result = normalizeHotkeySettings({}, DEFAULT_HOTKEYS);
            expect(result.toggleOverlays).toEqual(DEFAULT_HOTKEYS.toggleOverlays);
            expect(result.tabBarToggle).toBeNull(); // DEFAULT_HOTKEYS.tabBarToggle is null
        });

        it('should preserve valid values', () => {
            const input = {
                tabBarToggle: ['Ctrl', 'T'],
            };
            const result = normalizeHotkeySettings(input, DEFAULT_HOTKEYS);
            expect(result.tabBarToggle).toEqual(['Ctrl', 'T']);
        });

        it('should use fallback when sanitize fails', () => {
            const input = {
                toggleOverlays: ['T'], // invalid: too short
            };
            const result = normalizeHotkeySettings(input, DEFAULT_HOTKEYS);
            // Should fall back to DEFAULT_HOTKEYS.toggleOverlays
            expect(result.toggleOverlays).toEqual(DEFAULT_HOTKEYS.toggleOverlays);
        });

        it('should return null when sanitize fails and fallback is null', () => {
            const input = {
                tabBarToggle: ['T'], // invalid: too short
            };
            const result = normalizeHotkeySettings(input, DEFAULT_HOTKEYS);
            // Should fall back to DEFAULT_HOTKEYS.tabBarToggle which is null
            expect(result.tabBarToggle).toBeNull();
        });
    });

    describe('mergeHotkeySettings', () => {
        it('should merge new hotkey into existing settings', () => {
            const current = {
                ...DEFAULT_HOTKEYS,
                tabBarToggle: null,
            };
            const patch = { tabBarToggle: ['Ctrl', 'T'] };
            const result = mergeHotkeySettings(current, patch, DEFAULT_HOTKEYS);
            expect(result.tabBarToggle).toEqual(['Ctrl', 'T']);
        });

        it('should preserve other hotkeys when patching one', () => {
            const current = {
                ...DEFAULT_HOTKEYS,
            };
            const patch = { tabBarToggle: ['Ctrl', 'T'] };
            const result = mergeHotkeySettings(current, patch, DEFAULT_HOTKEYS);
            expect(result.toggleOverlays).toEqual(DEFAULT_HOTKEYS.toggleOverlays);
            expect(result.sidePanelToggle).toEqual(DEFAULT_HOTKEYS.sidePanelToggle);
            expect(result.tabBarToggle).toEqual(['Ctrl', 'T']);
        });

        it('should clear hotkey when patch value is null', () => {
            const current = {
                ...DEFAULT_HOTKEYS,
                tabBarToggle: ['Ctrl', 'T'] as string[],
            };
            const patch = { tabBarToggle: null };
            const result = mergeHotkeySettings(current, patch as any, DEFAULT_HOTKEYS);
            expect(result.tabBarToggle).toBeNull();
        });

        it('should not change value when sanitize fails', () => {
            const current = {
                ...DEFAULT_HOTKEYS,
                tabBarToggle: ['Ctrl', 'T'] as string[],
            };
            const patch = { tabBarToggle: ['X'] }; // invalid: too short
            const result = mergeHotkeySettings(current, patch as any, DEFAULT_HOTKEYS);
            // Value should remain unchanged because sanitize failed
            expect(result.tabBarToggle).toEqual(['Ctrl', 'T']);
        });
    });

    describe('Full save/load cycle simulation', () => {
        it('should preserve tabBarToggle through save/load cycle', () => {
            // Simulate what happens when saving and loading settings

            // 1. User sets a new hotkey
            const newHotkey = ['Ctrl', 'Shift', 'B'];

            // 2. Merge into current settings (simulates store.patch)
            const currentSettings = { ...DEFAULT_HOTKEYS };
            const afterMerge = mergeHotkeySettings(
                currentSettings,
                { tabBarToggle: newHotkey } as any,
                DEFAULT_HOTKEYS
            );
            expect(afterMerge.tabBarToggle).toEqual(['Ctrl', 'Shift', 'B']);

            // 3. Simulate JSON serialization/deserialization (writing and reading from file)
            const serialized = JSON.stringify(afterMerge);
            const deserialized = JSON.parse(serialized);

            // 4. Normalize after loading (simulates store.normalize)
            const afterNormalize = normalizeHotkeySettings(deserialized, DEFAULT_HOTKEYS);
            expect(afterNormalize.tabBarToggle).toEqual(['Ctrl', 'Shift', 'B']);

            // 5. Normalize again in renderer (simulates loadClientSettings)
            const afterRendererNormalize = normalizeHotkeySettings(afterNormalize, DEFAULT_HOTKEYS);
            expect(afterRendererNormalize.tabBarToggle).toEqual(['Ctrl', 'Shift', 'B']);
        });

        it('should map legacy tabLeftPrev to the new tabPrev hotkey when normalizing', () => {
            const raw = { tabLeftPrev: ['Ctrl', 'Shift', 'Left'] };
            const normalized = normalizeHotkeySettings(raw, DEFAULT_HOTKEYS);
            expect(normalized.tabPrev).toEqual(['Ctrl', 'Shift', 'Left']);
        });
    });

    describe('formatHotkey', () => {
        it('should format hotkey chord for display', () => {
            expect(formatHotkey(['Ctrl', 'T'])).toBe('Ctrl + T');
            expect(formatHotkey(['Ctrl', 'Shift', 'T'])).toBe('Ctrl + Shift + T');
        });

        it('should return empty string for null', () => {
            expect(formatHotkey(null)).toBe('');
            expect(formatHotkey(undefined)).toBe('');
        });
    });

    describe('chordToAccelerator', () => {
        it('should convert chord to Electron accelerator format', () => {
            expect(chordToAccelerator(['Ctrl', 'T'])).toBe('Ctrl+T');
            expect(chordToAccelerator(['Ctrl', 'Shift', 'T'])).toBe('Ctrl+Shift+T');
        });

        it('should return null for invalid chords', () => {
            expect(chordToAccelerator(null)).toBeNull();
            expect(chordToAccelerator(['T'])).toBeNull(); // too short
        });
    });

    describe('Raw keyboard input simulation (e.key values)', () => {
        it('should normalize raw keyboard event values', () => {
            // e.key returns "Control" not "Ctrl", "t" not "T", etc.
            expect(sanitizeHotkeyChord(['Control', 't'])).toEqual(['Ctrl', 'T']);
            expect(sanitizeHotkeyChord(['Control', 'Shift', 't'])).toEqual(['Ctrl', 'Shift', 'T']);
            expect(sanitizeHotkeyChord(['Alt', 'Tab'])).toEqual(['Alt', 'Tab']);
        });

        it('should handle Tab key', () => {
            // Tab is a special key
            expect(sanitizeHotkeyChord(['Control', 'Tab'])).toEqual(['Ctrl', 'Tab']);
            expect(sanitizeHotkeyChord(['Control', 'Shift', 'Tab'])).toEqual(['Ctrl', 'Shift', 'Tab']);
        });

        it('should handle function keys', () => {
            expect(sanitizeHotkeyChord(['Control', 'F1'])).toEqual(['Ctrl', 'F1']);
            expect(sanitizeHotkeyChord(['Alt', 'F12'])).toEqual(['Alt', 'F12']);
        });

        it('should handle arrow keys', () => {
            expect(sanitizeHotkeyChord(['Control', 'ArrowLeft'])).toEqual(['Ctrl', 'Left']);
            expect(sanitizeHotkeyChord(['Control', 'Shift', 'ArrowRight'])).toEqual(['Ctrl', 'Shift', 'Right']);
        });

        it('should reject single key without modifier', () => {
            expect(sanitizeHotkeyChord(['t'])).toBeNull();
            expect(sanitizeHotkeyChord(['Tab'])).toBeNull();
            expect(sanitizeHotkeyChord(['F1'])).toBeNull();
        });

        it('should reject modifier-only combinations', () => {
            expect(sanitizeHotkeyChord(['Control'])).toBeNull();
            expect(sanitizeHotkeyChord(['Control', 'Shift'])).toBeNull();
            expect(sanitizeHotkeyChord(['Control', 'Shift', 'Alt'])).toBeNull();
        });
    });
});

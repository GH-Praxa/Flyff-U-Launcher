/**
 * Tests für launcherSize-Hilfsfunktionen.
 * Alle Funktionen sind reine Berechnungen ohne externe Abhängigkeiten.
 */
import { describe, it, expect } from 'vitest';
import { LAYOUT } from './constants';
import {
    clampLauncherWidth,
    clampLauncherHeight,
    normalizeLauncherSize,
    fitLauncherSizeToWorkArea,
} from './launcherSize';

describe('clampLauncherWidth', () => {
    it('gibt den Minimalwert zurück bei zu kleiner Eingabe', () => {
        expect(clampLauncherWidth(0)).toBe(LAYOUT.LAUNCHER_MIN_WIDTH);
        expect(clampLauncherWidth(-100)).toBe(LAYOUT.LAUNCHER_MIN_WIDTH);
    });

    it('gibt den Maximalwert zurück bei zu großer Eingabe', () => {
        expect(clampLauncherWidth(99999)).toBe(LAYOUT.LAUNCHER_MAX_WIDTH);
        expect(clampLauncherWidth(Infinity)).toBe(LAYOUT.LAUNCHER_WIDTH); // Infinity → NaN-Pfad → fallback
    });

    it('rundet auf die nächste ganze Zahl', () => {
        const w = LAYOUT.LAUNCHER_MIN_WIDTH + 10.7;
        expect(clampLauncherWidth(w)).toBe(Math.round(w));
    });

    it('gibt den Fallback zurück bei NaN', () => {
        expect(clampLauncherWidth(NaN)).toBe(LAYOUT.LAUNCHER_WIDTH);
    });

    it('gibt den Fallback zurück bei nicht-numerischen Werten (NaN-Pfad)', () => {
        // Number('abc') = NaN → Fallback
        expect(clampLauncherWidth('abc' as unknown as number)).toBe(LAYOUT.LAUNCHER_WIDTH);
        // Number(undefined) = NaN → Fallback
        expect(clampLauncherWidth(undefined as unknown as number)).toBe(LAYOUT.LAUNCHER_WIDTH);
    });

    it('klemmt null auf LAUNCHER_MIN_WIDTH (Number(null)=0)', () => {
        // Number(null) = 0, gültig → wird auf Minimum geclampt, nicht Fallback
        expect(clampLauncherWidth(null as unknown as number)).toBe(LAYOUT.LAUNCHER_MIN_WIDTH);
    });

    it('verwendet den benutzerdefinierten Fallback', () => {
        expect(clampLauncherWidth(NaN, 999)).toBe(999);
        expect(clampLauncherWidth('x' as unknown as number, 500)).toBe(500);
    });

    it('gibt gültige Werte unverändert zurück', () => {
        const w = LAYOUT.LAUNCHER_MIN_WIDTH + 50;
        expect(clampLauncherWidth(w)).toBe(w);
    });

    it('min und max sind konsistent (min ≤ default ≤ max)', () => {
        expect(LAYOUT.LAUNCHER_MIN_WIDTH).toBeLessThanOrEqual(LAYOUT.LAUNCHER_WIDTH);
        expect(LAYOUT.LAUNCHER_WIDTH).toBeLessThanOrEqual(LAYOUT.LAUNCHER_MAX_WIDTH);
    });
});

describe('clampLauncherHeight', () => {
    it('gibt den Minimalwert zurück bei zu kleiner Eingabe', () => {
        expect(clampLauncherHeight(0)).toBe(LAYOUT.LAUNCHER_MIN_HEIGHT);
        expect(clampLauncherHeight(-1)).toBe(LAYOUT.LAUNCHER_MIN_HEIGHT);
    });

    it('gibt den Maximalwert zurück bei zu großer Eingabe', () => {
        expect(clampLauncherHeight(99999)).toBe(LAYOUT.LAUNCHER_MAX_HEIGHT);
    });

    it('rundet auf die nächste ganze Zahl', () => {
        const h = LAYOUT.LAUNCHER_MIN_HEIGHT + 5.4;
        expect(clampLauncherHeight(h)).toBe(Math.round(h));
    });

    it('gibt den Fallback zurück bei NaN', () => {
        expect(clampLauncherHeight(NaN)).toBe(LAYOUT.LAUNCHER_HEIGHT);
    });

    it('klemmt null auf LAUNCHER_MIN_HEIGHT (Number(null)=0)', () => {
        // Number(null) = 0, gültig → wird auf Minimum geclampt, nicht Fallback
        expect(clampLauncherHeight(null as unknown as number)).toBe(LAYOUT.LAUNCHER_MIN_HEIGHT);
    });

    it('verwendet den benutzerdefinierten Fallback', () => {
        expect(clampLauncherHeight(NaN, 750)).toBe(750);
    });

    it('gibt gültige Werte unverändert zurück', () => {
        const h = LAYOUT.LAUNCHER_MIN_HEIGHT + 100;
        expect(clampLauncherHeight(h)).toBe(h);
    });
});

describe('normalizeLauncherSize', () => {
    it('klemmt zu kleine Werte auf Minimum', () => {
        const result = normalizeLauncherSize({ width: 0, height: 0 });
        expect(result.width).toBe(LAYOUT.LAUNCHER_MIN_WIDTH);
        expect(result.height).toBe(LAYOUT.LAUNCHER_MIN_HEIGHT);
    });

    it('klemmt zu große Werte auf Maximum', () => {
        const result = normalizeLauncherSize({ width: 99999, height: 99999 });
        expect(result.width).toBe(LAYOUT.LAUNCHER_MAX_WIDTH);
        expect(result.height).toBe(LAYOUT.LAUNCHER_MAX_HEIGHT);
    });

    it('gibt Standard-Breite zurück bei null-Eingabe', () => {
        const result = normalizeLauncherSize(null);
        expect(result.width).toBe(LAYOUT.LAUNCHER_WIDTH);
        expect(result.height).toBe(LAYOUT.LAUNCHER_HEIGHT);
    });

    it('gibt Standard-Breite zurück bei undefined-Eingabe', () => {
        const result = normalizeLauncherSize(undefined);
        expect(result.width).toBe(LAYOUT.LAUNCHER_WIDTH);
        expect(result.height).toBe(LAYOUT.LAUNCHER_HEIGHT);
    });

    it('gibt Standard-Breite zurück wenn beide Felder fehlen', () => {
        const result = normalizeLauncherSize({});
        expect(result.width).toBe(LAYOUT.LAUNCHER_WIDTH);
        expect(result.height).toBe(LAYOUT.LAUNCHER_HEIGHT);
    });

    it('normalisiert nur die fehlende Dimension', () => {
        const validW = LAYOUT.LAUNCHER_MIN_WIDTH + 50;
        const result = normalizeLauncherSize({ width: validW, height: undefined });
        expect(result.width).toBe(validW);
        expect(result.height).toBe(LAYOUT.LAUNCHER_HEIGHT);
    });

    it('akzeptiert gültige Abmessungen unverändert', () => {
        const w = LAYOUT.LAUNCHER_MIN_WIDTH + 50;
        const h = LAYOUT.LAUNCHER_MIN_HEIGHT + 50;
        const result = normalizeLauncherSize({ width: w, height: h });
        expect(result.width).toBe(w);
        expect(result.height).toBe(h);
    });

    it('rundet Dezimalwerte', () => {
        const w = LAYOUT.LAUNCHER_MIN_WIDTH + 3.7;
        const h = LAYOUT.LAUNCHER_MIN_HEIGHT + 2.3;
        const result = normalizeLauncherSize({ width: w, height: h });
        expect(result.width).toBe(Math.round(w));
        expect(result.height).toBe(Math.round(h));
    });
});

describe('fitLauncherSizeToWorkArea', () => {
    it('gibt die Größe unverändert zurück wenn kein Work Area angegeben', () => {
        const size = { width: 300, height: 700 };
        expect(fitLauncherSizeToWorkArea(size)).toEqual(size);
        expect(fitLauncherSizeToWorkArea(size, null)).toEqual(size);
        expect(fitLauncherSizeToWorkArea(size, undefined)).toEqual(size);
    });

    it('begrenzt die Größe auf das Work Area', () => {
        const size = { width: 9999, height: 9999 };
        const workArea = { width: 1280, height: 800 };
        const result = fitLauncherSizeToWorkArea(size, workArea);
        expect(result.width).toBeLessThanOrEqual(workArea.width);
        expect(result.height).toBeLessThanOrEqual(workArea.height);
    });

    it('erzwingt Minimum 320 bei sehr kleinem Work Area', () => {
        const size = { width: 9999, height: 9999 };
        const workArea = { width: 100, height: 100 };
        const result = fitLauncherSizeToWorkArea(size, workArea);
        // maxWidth = max(320, min(LAUNCHER_MAX_WIDTH, 100)) = 320
        expect(result.width).toBe(320);
        expect(result.height).toBe(320);
    });

    it('vergrößert die Größe nicht über das Work Area hinaus', () => {
        const smallSize = { width: LAYOUT.LAUNCHER_MIN_WIDTH, height: LAYOUT.LAUNCHER_MIN_HEIGHT };
        const largeWorkArea = { width: 3840, height: 2160 };
        const result = fitLauncherSizeToWorkArea(smallSize, largeWorkArea);
        expect(result.width).toBe(smallSize.width);
        expect(result.height).toBe(smallSize.height);
    });

    it('begrenzt auf LAUNCHER_MAX_WIDTH auch bei sehr breitem Work Area', () => {
        const size = { width: 99999, height: 99999 };
        const workArea = { width: 99999, height: 99999 };
        const result = fitLauncherSizeToWorkArea(size, workArea);
        expect(result.width).toBeLessThanOrEqual(LAYOUT.LAUNCHER_MAX_WIDTH);
        expect(result.height).toBeLessThanOrEqual(LAYOUT.LAUNCHER_MAX_HEIGHT);
    });

    it('hält gültige Größen im Work Area unverändert', () => {
        // Werte müssen >= LAUNCHER_MIN_WIDTH/HEIGHT sein, sonst werden sie geclampt
        const size = { width: LAYOUT.LAUNCHER_MIN_WIDTH + 50, height: LAYOUT.LAUNCHER_MIN_HEIGHT + 50 };
        const workArea = { width: 1920, height: 1080 };
        const result = fitLauncherSizeToWorkArea(size, workArea);
        expect(result.width).toBe(size.width);
        expect(result.height).toBe(size.height);
    });

    it('klemmt Größen unter LAUNCHER_MIN_WIDTH auf das Minimum', () => {
        // fitLauncherSizeToWorkArea erzwingt auch das Launcher-Minimum
        const smallSize = { width: 100, height: 100 };
        const workArea = { width: 1920, height: 1080 };
        const result = fitLauncherSizeToWorkArea(smallSize, workArea);
        expect(result.width).toBeGreaterThanOrEqual(LAYOUT.LAUNCHER_MIN_WIDTH);
        expect(result.height).toBeGreaterThanOrEqual(LAYOUT.LAUNCHER_MIN_HEIGHT);
    });
});

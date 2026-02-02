import { LAYOUT } from "./constants";

export type LauncherSize = { width: number; height: number };

function toNumber(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

export function clampLauncherWidth(value: unknown, fallback: number = LAYOUT.LAUNCHER_WIDTH): number {
    const n = toNumber(value);
    if (n === null) return fallback;
    return Math.min(LAYOUT.LAUNCHER_MAX_WIDTH, Math.max(LAYOUT.LAUNCHER_MIN_WIDTH, Math.round(n)));
}

export function clampLauncherHeight(value: unknown, fallback: number = LAYOUT.LAUNCHER_HEIGHT): number {
    const n = toNumber(value);
    if (n === null) return fallback;
    return Math.min(LAYOUT.LAUNCHER_MAX_HEIGHT, Math.max(LAYOUT.LAUNCHER_MIN_HEIGHT, Math.round(n)));
}

export function normalizeLauncherSize(raw?: { width?: unknown; height?: unknown } | null): LauncherSize {
    return {
        width: clampLauncherWidth(raw?.width),
        height: clampLauncherHeight(raw?.height),
    };
}

export function fitLauncherSizeToWorkArea(
    size: LauncherSize,
    workArea?: { width: number; height: number } | null
): LauncherSize {
    if (!workArea) return size;
    const maxWidth = Math.max(320, Math.min(LAYOUT.LAUNCHER_MAX_WIDTH, workArea.width));
    const maxHeight = Math.max(320, Math.min(LAYOUT.LAUNCHER_MAX_HEIGHT, workArea.height));
    const minWidth = Math.min(LAYOUT.LAUNCHER_MIN_WIDTH, maxWidth);
    const minHeight = Math.min(LAYOUT.LAUNCHER_MIN_HEIGHT, maxHeight);
    return {
        width: Math.min(maxWidth, Math.max(minWidth, size.width)),
        height: Math.min(maxHeight, Math.max(minHeight, size.height)),
    };
}


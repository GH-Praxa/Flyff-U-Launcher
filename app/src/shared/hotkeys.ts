import type { HotkeyChord, Hotkeys } from "./schemas";

const MODIFIER_ORDER: HotkeyChord = ["Ctrl", "Shift", "Alt", "Super"];
const MODIFIER_SET = new Set(MODIFIER_ORDER);

const KEY_ALIASES: Record<string, string> = {
    control: "Ctrl",
    ctrl: "Ctrl",
    command: "Super",
    cmd: "Super",
    win: "Super",
    meta: "Super",
    super: "Super",
    option: "Alt",
    menu: "Alt",
    alt: "Alt",
    shift: "Shift",
    escape: "Escape",
    esc: "Escape",
    space: "Space",
    spacebar: "Space",
    return: "Enter",
    arrowup: "Up",
    arrowdown: "Down",
    arrowleft: "Left",
    arrowright: "Right",
    pageup: "PageUp",
    pagedown: "PageDown",
    plus: "+",
    minus: "-",
};

const isModifier = (key: string) => MODIFIER_SET.has(key);

function parseChordInput(raw: unknown): string[] | null {
    if (Array.isArray(raw)) {
        return raw.map((v) => String(v));
    }
    if (typeof raw === "string") {
        return raw.split("+").map((v) => v.trim()).filter(Boolean);
    }
    return null;
}

function normalizeKey(input: string): string | null {
    const raw = (input ?? "").trim();
    if (!raw)
        return null;
    const lower = raw.toLowerCase();
    if (KEY_ALIASES[lower])
        return KEY_ALIASES[lower];
    const fn = /^f([1-9]|1[0-2])$/.exec(lower);
    if (fn)
        return `F${fn[1]}`;
    if (/^[a-z]$/.test(lower))
        return lower.toUpperCase();
    if (/^[0-9]$/.test(lower))
        return lower;
    if (raw.length === 1)
        return raw.toUpperCase();
    return raw[0].toUpperCase() + raw.slice(1);
}

export function sanitizeHotkeyChord(raw: unknown): HotkeyChord | null {
    const parts = parseChordInput(raw);
    if (!parts)
        return null;
    const normalized: string[] = [];
    for (const part of parts) {
        const key = normalizeKey(part);
        if (!key)
            continue;
        if (!normalized.includes(key)) {
            normalized.push(key);
        }
    }
    const modifiers = normalized.filter(isModifier).sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b));
    const nonModifiers = normalized.filter((k) => !isModifier(k));
    if (nonModifiers.length === 0)
        return null;
    const chord = [...modifiers, ...nonModifiers] as HotkeyChord;
    if (chord.length < 2 || chord.length > 3)
        return null;
    return chord;
}

export function chordToAccelerator(chord?: HotkeyChord | null): string | null {
    const normalized = sanitizeHotkeyChord(chord ?? null);
    if (!normalized)
        return null;
    return normalized.join("+");
}

export function formatHotkey(chord?: HotkeyChord | null): string {
    const normalized = sanitizeHotkeyChord(chord ?? null);
    if (!normalized)
        return "";
    return normalized.join(" + ");
}

export const DEFAULT_HOTKEYS: Hotkeys = {
    toggleOverlays: ["Ctrl", "Alt", "1"],
    sidePanelToggle: ["Ctrl", "Shift", "O"],
    tabBarToggle: null,
    tabPrev: null,
    tabNext: null,
    nextInstance: null,
    cdTimerExpireAll: null,
    screenshotWindow: ["Ctrl", "Shift", "S"],
    showFcoinConverter: null,
    showShoppingList: null,
};

export function normalizeHotkeySettings(raw: unknown, fallback?: Hotkeys): Hotkeys {
    console.log("[DEBUG normalizeHotkeySettings] raw:", JSON.stringify(raw), "fallback:", JSON.stringify(fallback));
    const baseToggle = fallback?.toggleOverlays ?? null;
    const baseSidePanelToggle = fallback?.sidePanelToggle ?? null;
    const baseTabBarToggle = fallback?.tabBarToggle ?? null;
    const baseScreenshotWindow = fallback?.screenshotWindow ?? null;
    const basePrev = fallback?.tabPrev ?? null;
    const baseNext = fallback?.tabNext ?? null;
    const baseNextInstance = fallback?.nextInstance ?? null;
    const baseCdTimerExpireAll = fallback?.cdTimerExpireAll ?? null;
    const baseShowFcoinConverter = fallback?.showFcoinConverter ?? null;
    const baseShowShoppingList = fallback?.showShoppingList ?? null;
    const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const pick = (key: keyof Hotkeys, base: HotkeyChord | null, legacyKeys: string[] = []) => {
        const rawVal = (obj as Record<string, unknown>)[key];
        if (rawVal === null)
            return null;
        if (rawVal !== undefined) {
            const sanitized = sanitizeHotkeyChord(rawVal);
            console.log(`[DEBUG pick] key=${key}, rawVal=${JSON.stringify(rawVal)}, sanitized=${JSON.stringify(sanitized)}, base=${JSON.stringify(base)}`);
            return sanitized ?? base;
        }
        for (const legacyKey of legacyKeys) {
            const legacyVal = (obj as Record<string, unknown>)[legacyKey];
            if (legacyVal === null)
                continue;
            if (legacyVal !== undefined) {
                const sanitized = sanitizeHotkeyChord(legacyVal);
                console.log(`[DEBUG legacy] key=${key}, legacyKey=${legacyKey}, rawVal=${JSON.stringify(legacyVal)}, sanitized=${JSON.stringify(sanitized)}`);
                if (sanitized)
                    return sanitized;
            }
        }
        return base;
    };
    return {
        toggleOverlays: pick("toggleOverlays", baseToggle),
        sidePanelToggle: pick("sidePanelToggle", baseSidePanelToggle),
        tabBarToggle: pick("tabBarToggle", baseTabBarToggle),
        screenshotWindow: pick("screenshotWindow", baseScreenshotWindow),
        tabPrev: pick("tabPrev", basePrev, ["tabLeftPrev", "tabRightPrev"]),
        tabNext: pick("tabNext", baseNext, ["tabLeftNext", "tabRightNext"]),
        nextInstance: pick("nextInstance", baseNextInstance),
        cdTimerExpireAll: pick("cdTimerExpireAll", baseCdTimerExpireAll),
        showFcoinConverter: pick("showFcoinConverter", baseShowFcoinConverter),
        showShoppingList: pick("showShoppingList", baseShowShoppingList),
    };
}

export function mergeHotkeySettings(current: Hotkeys | undefined | null, patch: Hotkeys | null | undefined, fallback?: Hotkeys): Hotkeys {
    console.log("[DEBUG mergeHotkeySettings] current:", JSON.stringify(current), "patch:", JSON.stringify(patch));
    const next = normalizeHotkeySettings(current ?? null, fallback);
    if (!patch || typeof patch !== "object")
        return next;
    const apply = (key: keyof Hotkeys) => {
        if (key in patch) {
            const value = (patch as Record<string, unknown>)[key];
            console.log(`[DEBUG mergeHotkeySettings apply] key=${key}, value=${JSON.stringify(value)}`);
            if (value === null) {
                next[key] = null;
            }
            else if (value !== undefined) {
                const normalized = sanitizeHotkeyChord(value);
                console.log(`[DEBUG mergeHotkeySettings apply] normalized=${JSON.stringify(normalized)}`);
                if (normalized) {
                    next[key] = normalized;
                }
            }
        }
    };
    apply("toggleOverlays");
    apply("sidePanelToggle");
    apply("tabBarToggle");
    apply("screenshotWindow");
    apply("tabPrev");
    apply("tabNext");
    apply("nextInstance");
    apply("cdTimerExpireAll");
    apply("showFcoinConverter");
    apply("showShoppingList");
    return next;
}

/**
 * Virtuelle Bildschirm-Tastatur für die Controller-Navigation.
 *
 * Wird geöffnet, wenn ein Textfeld per ✕ aktiviert wird. Die Tasten sind
 * normale `<button>`-Elemente in einem eigenen Nav-Scope — die generische
 * Spatial-Nav navigiert sie, ✕ "tippt" (klickt) die Taste. Die physische
 * Tastatur bleibt parallel nutzbar.
 */
import { t, currentLocale } from "../i18n";
import type { TranslationKey } from "../../i18n/translations";
import { pushScope, popScope } from "./scope";

type TextTarget = HTMLInputElement | HTMLTextAreaElement;

interface KeyboardDeps {
    /** Setzt den Controller-Fokus (aus dem Nav-Kern injiziert). */
    setFocus(el: HTMLElement | null): void;
}

let deps: KeyboardDeps | null = null;
let kbEl: HTMLElement | null = null;
let target: TextTarget | null = null;
let shiftOn = false;

const LETTER_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const DIGIT_ROW = "1234567890";
const SYMBOL_ROW = ["@", ".", "-", "_", ":", "/", "+", "?", "!", ","];

export function initVirtualKeyboard(d: KeyboardDeps): void {
    deps = d;
}

export function isKeyboardOpen(): boolean {
    return kbEl !== null;
}

function isNumericTarget(el: TextTarget): boolean {
    return el instanceof HTMLInputElement && (el.type === "number" || el.type === "tel");
}

/** Selektion robust lesen — `selectionStart` wirft bei type=number/email. */
function getSelection(el: TextTarget): [number, number] {
    try {
        const s = el.selectionStart;
        const e = el.selectionEnd;
        if (s != null && e != null) return [s, e];
    } catch {
        /* number/email-Inputs erlauben keine Selektion */
    }
    const len = el.value.length;
    return [len, len];
}

function setCaret(el: TextTarget, pos: number): void {
    try {
        el.setSelectionRange(pos, pos);
    } catch {
        /* number/email-Inputs: ignorieren */
    }
}

function insertText(text: string): void {
    if (!target) return;
    if (isNumericTarget(target) && !/^[0-9.,+\-]$/.test(text)) return;
    const [start, end] = getSelection(target);
    const v = target.value;
    target.value = v.slice(0, start) + text + v.slice(end);
    setCaret(target, start + text.length);
    target.dispatchEvent(new Event("input", { bubbles: true }));
}

function backspace(): void {
    if (!target) return;
    const [start, end] = getSelection(target);
    const v = target.value;
    if (start !== end) {
        target.value = v.slice(0, start) + v.slice(end);
        setCaret(target, start);
    } else if (start > 0) {
        target.value = v.slice(0, start - 1) + v.slice(start);
        setCaret(target, start - 1);
    }
    target.dispatchEvent(new Event("input", { bubbles: true }));
}

function clearField(): void {
    if (!target) return;
    target.value = "";
    setCaret(target, 0);
    target.dispatchEvent(new Event("input", { bubbles: true }));
}

function makeKey(label: string, cls: string, onPress: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `cnavKbKey ${cls}`.trim();
    btn.textContent = label;
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        onPress();
    });
    return btn;
}

function applyShiftLabels(): void {
    if (!kbEl) return;
    const charKeys = kbEl.querySelectorAll<HTMLButtonElement>(".cnavKbKey[data-char]");
    charKeys.forEach((k) => {
        const ch = k.getAttribute("data-char") ?? "";
        if (/[a-z]/i.test(ch)) k.textContent = shiftOn ? ch.toUpperCase() : ch.toLowerCase();
    });
}

function makeCharKey(ch: string): HTMLButtonElement {
    const key = makeKey(ch, "", () => {
        const out = shiftOn && /[a-z]/i.test(ch) ? ch.toUpperCase() : ch;
        insertText(out);
        if (shiftOn && /[a-z]/i.test(ch)) {
            // Shift wirkt wie bei Handy-Tastaturen einmalig.
            shiftOn = false;
            applyShiftLabels();
            syncShiftKey();
        }
    });
    key.setAttribute("data-char", ch);
    return key;
}

function syncShiftKey(): void {
    if (!kbEl) return;
    const shiftKey = kbEl.querySelector<HTMLButtonElement>(".cnavKbShift");
    if (shiftKey) shiftKey.classList.toggle("cnavKbShiftOn", shiftOn);
}

function buildKeyboard(numericOnly: boolean): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cnavKeyboard";

    const hint = document.createElement("div");
    hint.className = "cnavKbHint";
    hint.textContent = t("controllerNav.kb.hint" as TranslationKey);
    wrap.appendChild(hint);

    const addRow = (keys: HTMLElement[]): void => {
        const row = document.createElement("div");
        row.className = "cnavKbRow";
        keys.forEach((k) => row.appendChild(k));
        wrap.appendChild(row);
    };

    // Ziffernreihe.
    addRow([...DIGIT_ROW].map((d) => makeCharKey(d)));

    if (!numericOnly) {
        for (const row of LETTER_ROWS) {
            addRow([...row].map((c) => makeCharKey(c)));
        }
        addRow(SYMBOL_ROW.map((s) => makeCharKey(s)));
    }

    // Aktionsreihe.
    const shiftKey = makeKey("⇧ " + t("controllerNav.kb.shift" as TranslationKey), "cnavKbShift", () => {
        shiftOn = !shiftOn;
        applyShiftLabels();
        syncShiftKey();
    });
    const spaceKey = makeKey(t("controllerNav.kb.space" as TranslationKey), "cnavKbWide", () => insertText(" "));
    const backKey = makeKey("⌫", "", () => backspace());
    const clearKey = makeKey(t("controllerNav.kb.clear" as TranslationKey), "", () => clearField());
    const doneKey = makeKey("✓ " + t("controllerNav.kb.done" as TranslationKey), "cnavKbDone", () => closeKeyboard());

    addRow(numericOnly ? [backKey, clearKey, doneKey] : [shiftKey, spaceKey, backKey, clearKey, doneKey]);

    return wrap;
}

export function openKeyboard(field: TextTarget): void {
    if (kbEl) closeKeyboard();
    target = field;
    shiftOn = false;
    const numericOnly = isNumericTarget(field);
    kbEl = buildKeyboard(numericOnly);
    document.body.appendChild(kbEl);
    // Sprache neu anwenden, falls Locale-Wechsel — currentLocale referenziert,
    // damit der Tree-Shaker den Import nicht entfernt.
    void currentLocale;

    pushScope({ el: kbEl, onBack: closeKeyboard });

    const firstKey = kbEl.querySelector<HTMLElement>(".cnavKbKey");
    if (firstKey && deps) deps.setFocus(firstKey);
}

export function closeKeyboard(): void {
    if (!kbEl) return;
    popScope(kbEl);
    kbEl.remove();
    kbEl = null;
    const restore = target;
    target = null;
    if (restore && deps) {
        try {
            restore.focus({ preventScroll: true });
        } catch {
            /* ignore */
        }
        deps.setFocus(restore);
    }
}

/**
 * Controller-Navigation für die Launcher-Oberfläche.
 *
 * Verdrahtet Gamepad-Poller, Spatial-Nav, Fokus-Ring, Scope-Stack und die
 * virtuelle Tastatur zu einem bedienbaren UI-Navigationssystem. Komplett
 * getrennt vom ControllerInputRouter des Main-Process (der die Spiel-Eingaben
 * macht) — dieses Modul läuft nur im Renderer und steuert ausschließlich die
 * Launcher-/Tool-Oberflächen.
 */
import "../../styles/controller-nav.css";
import { createGamepadPoller, type NavButton, type NavDirection } from "./gamepad-poller";
import { findInDirection, getFocusables, isElementVisible } from "./spatial-nav";
import { createFocusRing, type FocusRing } from "./focus-ring";
import { currentScopeEl, topScope } from "./scope";
import { initVirtualKeyboard, openKeyboard, isKeyboardOpen } from "./virtual-keyboard";

export { pushScope, popScope } from "./scope";
export type { NavScope } from "./scope";

interface InitOptions {
    /** Fenster-Art: "launcher" | "session" | "instance" | "popup". */
    view: string;
}

const FOCUSABLE_QUERY =
    "a[href],button,input,select,textarea,[role=button],[tabindex],[data-cnav]";

let initialized = false;
let viewKind = "launcher";
let focused: HTMLElement | null = null;
let ring: FocusRing | null = null;
let windowFocused = true;

/**
 * Im Launcher-/Popup-Fenster ist die Nav immer aktiv (sobald das Fenster den
 * Fokus hat). In Spiel-Fenstern (session/instance) nur, wenn ein Overlay-Scope
 * offen ist — sonst gehört der Controller dem Spiel.
 */
function computeEnabled(): boolean {
    if (!windowFocused) return false;
    if (viewKind === "launcher" || viewKind === "popup") return true;
    return topScope() !== null;
}

function isTextInput(el: HTMLElement): el is HTMLInputElement | HTMLTextAreaElement {
    if (el instanceof HTMLTextAreaElement) return true;
    if (el instanceof HTMLInputElement) {
        return ["text", "search", "number", "email", "password", "url", "tel"].includes(el.type);
    }
    return false;
}

function setFocus(el: HTMLElement | null): void {
    focused = el;
    ring?.moveTo(el);
    if (el) {
        try {
            el.focus({ preventScroll: true });
        } catch {
            /* ignore */
        }
    }
}

function activate(el: HTMLElement | null): void {
    if (!el || !el.isConnected) return;
    if (isTextInput(el)) {
        openKeyboard(el);
        return;
    }
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
        el.click();
        return;
    }
    if (el instanceof HTMLSelectElement) {
        // Native Dropdowns lassen sich per Script nicht öffnen → Option zyklisch
        // weiterschalten.
        const opts = el.options;
        if (opts.length > 0) {
            el.selectedIndex = (el.selectedIndex + 1) % opts.length;
            el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
    }
    el.click();
}

function findScrollable(el: HTMLElement | null): HTMLElement | null {
    let cur: HTMLElement | null = el;
    while (cur && cur !== document.body) {
        const s = getComputedStyle(cur);
        if (/(auto|scroll)/.test(s.overflowY) && cur.scrollHeight > cur.clientHeight + 2) {
            return cur;
        }
        cur = cur.parentElement;
    }
    return null;
}

function onDirection(dir: NavDirection): void {
    if (!computeEnabled()) return;
    const scope = currentScopeEl();
    if (focused) {
        const stale =
            !focused.isConnected || (scope !== document.body && !scope.contains(focused));
        if (stale) focused = null;
    }
    const next = findInDirection(focused, dir, scope);
    if (next) {
        setFocus(next);
    } else if (!focused) {
        const list = getFocusables(scope);
        if (list.length > 0) setFocus(list[0]);
    }
}

function onButton(btn: NavButton): void {
    if (!computeEnabled()) return;
    switch (btn) {
        case "activate":
            activate(focused);
            break;
        case "back": {
            const top = topScope();
            if (top?.onBack) {
                top.onBack();
            } else {
                const tgt = top?.el ?? document;
                tgt.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
            }
            break;
        }
        case "menu": {
            document.querySelector<HTMLElement>("[data-cnav-menu]")?.click();
            break;
        }
        case "tabPrev":
        case "tabNext": {
            const tabs = Array.from(
                currentScopeEl().querySelectorAll<HTMLElement>("[data-cnav-tab]"),
            ).filter(isElementVisible);
            if (tabs.length === 0) break;
            let activeIdx = tabs.findIndex(
                (tab) =>
                    tab.getAttribute("aria-selected") === "true" ||
                    tab.classList.contains("active"),
            );
            if (activeIdx < 0) activeIdx = 0;
            const delta = btn === "tabNext" ? 1 : -1;
            tabs[(activeIdx + delta + tabs.length) % tabs.length]?.click();
            break;
        }
    }
}

function onScroll(dx: number, dy: number): void {
    if (!computeEnabled() || isKeyboardOpen()) return;
    const scroller = findScrollable(focused);
    if (scroller) {
        scroller.scrollBy(dx, dy);
    } else {
        window.scrollBy(dx, dy);
    }
}

export function initControllerNav(opts: InitOptions): void {
    if (initialized) return;
    initialized = true;
    viewKind = opts.view;

    ring = createFocusRing();
    initVirtualKeyboard({ setFocus });

    const poller = createGamepadPoller({ onDirection, onButton, onScroll });

    windowFocused = document.hasFocus();
    window.addEventListener("focus", () => {
        windowFocused = true;
        poller.start();
    });
    window.addEventListener("blur", () => {
        windowFocused = false;
    });
    window.addEventListener("gamepadconnected", () => poller.start());

    // Maus-/Tastatur-Fokus mit dem Controller-Fokus synchron halten — aber nur
    // wenn die Nav im aktuellen Fenster überhaupt aktiv ist.
    document.addEventListener("focusin", (e) => {
        if (!computeEnabled()) return;
        const tgt = e.target;
        if (tgt instanceof HTMLElement && tgt !== focused) {
            focused = tgt;
            ring?.moveTo(tgt);
        }
    });
    document.addEventListener(
        "pointerdown",
        (e) => {
            if (!computeEnabled()) return;
            const tgt = e.target;
            if (tgt instanceof HTMLElement) {
                const f = tgt.closest<HTMLElement>(FOCUSABLE_QUERY);
                if (f) {
                    focused = f;
                    ring?.moveTo(f);
                }
            }
        },
        true,
    );

    // Fokus-Ring den Element-Positionen folgen lassen (Scroll, Layout-Shift).
    // Sichtbar nur solange die Nav im aktuellen Fenster aktiv ist.
    const rafRefresh = (): void => {
        if (ring) {
            if (computeEnabled()) ring.refresh();
            else ring.hide();
        }
        requestAnimationFrame(rafRefresh);
    };
    requestAnimationFrame(rafRefresh);

    poller.start();
}

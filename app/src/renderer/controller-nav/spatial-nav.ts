/**
 * Geometrische Fokus-Navigation: findet das nächste fokussierbare Element in
 * einer gegebenen Richtung anhand der Bildschirm-Positionen. Bewertet wird
 * nach Distanz entlang der Richtungs-Achse plus einer Strafe für Querversatz,
 * sodass Elemente "geradeaus" bevorzugt werden.
 */
import type { NavDirection } from "./gamepad-poller";

const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type=hidden])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[role=button]:not([aria-disabled=true])",
    "[tabindex]:not([tabindex='-1'])",
    "[data-cnav]",
].join(",");

function isVisible(el: HTMLElement): boolean {
    if (el.hidden) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") return false;
    // Mindestens teilweise im Viewport.
    if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
    if (rect.right < 0 || rect.left > window.innerWidth) return false;
    return true;
}

export function getFocusables(scope: HTMLElement): HTMLElement[] {
    const all = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    return all.filter(isVisible);
}

interface Point { x: number; y: number; }

function center(el: HTMLElement): Point {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function isElementVisible(el: HTMLElement): boolean {
    return isVisible(el);
}

export function findInDirection(
    current: HTMLElement | null,
    dir: NavDirection,
    scope: HTMLElement,
): HTMLElement | null {
    const candidates = getFocusables(scope).filter((el) => el !== current);
    if (candidates.length === 0) return null;

    if (!current || !isVisible(current)) {
        // Kein gültiger Fokus → oberstes/linkestes Element.
        return candidates.sort((a, b) => {
            const ca = center(a);
            const cb = center(b);
            return (ca.y - cb.y) || (ca.x - cb.x);
        })[0] ?? null;
    }

    const from = center(current);
    let best: HTMLElement | null = null;
    let bestScore = Infinity;

    for (const el of candidates) {
        const to = center(el);
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        let primary = 0;
        let perp = 0;
        switch (dir) {
            case "up":    primary = -dy; perp = Math.abs(dx); break;
            case "down":  primary = dy;  perp = Math.abs(dx); break;
            case "left":  primary = -dx; perp = Math.abs(dy); break;
            case "right": primary = dx;  perp = Math.abs(dy); break;
        }
        if (primary <= 1) continue; // nicht in Richtung
        const score = primary + perp * 2;
        if (score < bestScore) {
            bestScore = score;
            best = el;
        }
    }
    return best;
}

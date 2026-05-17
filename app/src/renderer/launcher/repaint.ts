/**
 * Workaround für einen Chromium-Compositing-Bug (Electron 40 / Chromium 130):
 *
 * Wenn innerhalb eines Scroll-Containers ein Panel ein- oder ausgeklappt wird
 * (z. B. das Profil-Einstellungen-Panel oder ein <details>-Accordion in der
 * Doku), ändert sich die Layout-Höhe. Chromium verwirft dabei manchmal
 * veraltete Compositor-Kacheln des Scroll-Containers nicht – ein Element
 * (z. B. der Zahnrad-Button) bleibt als "Geisterbild" am oberen Rand stehen.
 *
 * Ein erzwungener Neuaufbau des Render-/Layer-Trees des Scroll-Containers
 * (display:none → reflow → display zurück) verwirft alle Kacheln zuverlässig
 * und beendet das Geisterbild. Der Wechsel geschieht synchron innerhalb einer
 * Task, daher ohne sichtbares Flackern. Scroll-Position und Fokus werden
 * erhalten.
 *
 * Plattformneutral: reiner Renderer-Code, identisches Chromium-Verhalten auf
 * Windows, Linux und macOS.
 */

/** Nächstgelegenen tatsächlich scrollbaren Vorfahren ermitteln. */
export function nearestScrollable(el: Element | null | undefined): HTMLElement | null {
    let node: HTMLElement | null = (el?.parentElement as HTMLElement | null) ?? null;
    while (node) {
        const oy = getComputedStyle(node).overflowY;
        if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) {
            return node;
        }
        node = node.parentElement;
    }
    return null;
}

/**
 * Erzwingt einen kompletten Neuaufbau des Render-Trees von `el` und verwirft
 * damit veraltete Compositor-Kacheln. Scroll-Position und – falls der Fokus
 * innerhalb von `el` lag – der Fokus werden wiederhergestellt.
 */
export function forceScrollRepaint(el: HTMLElement | null | undefined): void {
    if (!el) return;
    const top = el.scrollTop;
    const left = el.scrollLeft;
    const active = document.activeElement as HTMLElement | null;
    const refocus = active && el.contains(active) ? active : null;

    const prevDisplay = el.style.display;
    el.style.display = "none";
    void el.offsetHeight; // erzwingt das Verwerfen von Render-Tree & Layern
    el.style.display = prevDisplay;
    void el.offsetHeight; // erzwingt den Neuaufbau, bevor Scroll/Fokus gesetzt werden

    el.scrollTop = top;
    el.scrollLeft = left;
    if (refocus) refocus.focus({ preventScroll: true });
}

let collapseGuardInstalled = false;

/**
 * Registriert (einmalig) einen globalen Handler, der nach jedem Auf-/Zuklappen
 * eines <details>-Elements den umgebenden Scroll-Container neu zeichnet.
 * Deckt alle aktuellen und zukünftigen Accordions ab (Doku, Config-Modal …).
 */
export function installCollapseRepaintGuard(): void {
    if (collapseGuardInstalled) return;
    collapseGuardInstalled = true;
    // `toggle` bubbelt nicht – Capture-Phase erreicht das document dennoch.
    document.addEventListener(
        "toggle",
        (e) => {
            const target = e.target as Element | null;
            if (target instanceof HTMLDetailsElement) {
                forceScrollRepaint(nearestScrollable(target));
            }
        },
        true,
    );
}

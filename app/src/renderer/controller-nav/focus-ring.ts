/**
 * Sichtbarer Fokus-Rahmen, der über das aktuell per Controller fokussierte
 * Element gelegt wird und ihm bei Scroll/Resize folgt.
 *
 * Sichtbarkeit steuert der Aufrufer: `refresh()` zeichnet den Ring am Ziel,
 * `hide()` blendet ihn aus.
 */
export interface FocusRing {
    moveTo(el: HTMLElement | null): void;
    refresh(): void;
    hide(): void;
    destroy(): void;
}

export function createFocusRing(): FocusRing {
    const ring = document.createElement("div");
    ring.className = "cnavFocusRing";
    ring.setAttribute("aria-hidden", "true");
    document.body.appendChild(ring);
    let target: HTMLElement | null = null;

    function refresh(): void {
        if (!target || !target.isConnected) {
            ring.style.opacity = "0";
            return;
        }
        const r = target.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) {
            ring.style.opacity = "0";
            return;
        }
        ring.style.opacity = "1";
        ring.style.transform = `translate(${r.left}px, ${r.top}px)`;
        ring.style.width = `${r.width}px`;
        ring.style.height = `${r.height}px`;
    }

    return {
        moveTo(el: HTMLElement | null): void {
            target = el;
            if (el) {
                try {
                    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
                } catch {
                    /* ältere Engines */
                }
            }
            refresh();
        },
        refresh,
        hide(): void {
            ring.style.opacity = "0";
        },
        destroy(): void {
            ring.remove();
        },
    };
}

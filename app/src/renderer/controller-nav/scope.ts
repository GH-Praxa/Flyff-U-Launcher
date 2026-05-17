/**
 * Scope-Stack für die Controller-Navigation.
 *
 * Das oberste registrierte Modal fängt die Navigation (Focus-Trap): solange ein
 * Scope aktiv ist, durchsucht die Spatial-Nav nur dessen Teilbaum. Ist kein
 * Scope registriert, gilt `document.body`.
 */
export interface NavScope {
    /** Container-Element, in dem navigiert wird. */
    el: HTMLElement;
    /** Optionaler Handler für die Zurück-Taste (◯). */
    onBack?: () => void;
}

const stack: NavScope[] = [];

export function pushScope(scope: NavScope): void {
    stack.push(scope);
}

export function popScope(el?: HTMLElement): NavScope | undefined {
    if (el) {
        const idx = stack.map((s) => s.el).lastIndexOf(el);
        if (idx >= 0) return stack.splice(idx, 1)[0];
        return undefined;
    }
    return stack.pop();
}

/** Oberster Scope, dessen Element noch im DOM hängt. Verwaiste werden verworfen. */
export function topScope(): NavScope | null {
    while (stack.length > 0) {
        const s = stack[stack.length - 1];
        if (s && s.el.isConnected) return s;
        stack.pop();
    }
    return null;
}

export function currentScopeEl(): HTMLElement {
    return topScope()?.el ?? document.body;
}

export function scopeDepth(): number {
    return stack.length;
}

/**
 * CSS Custom Properties Manager.
 *
 * Manages dynamic CSS custom properties on :root via a dedicated <style>
 * element instead of element.style.setProperty(). The <style> element carries
 * the CSP nonce exposed by the preload so it is allowed by the nonce-based
 * style-src directive without requiring 'unsafe-inline'.
 */

const vars = new Map<string, string>();
let styleEl: HTMLStyleElement | null = null;

function buildCSS(): string {
    if (vars.size === 0) return "";
    const decls = [...vars.entries()].map(([k, v]) => `  ${k}: ${v};`).join("\n");
    return `:root {\n${decls}\n}`;
}

function getStyleEl(): HTMLStyleElement {
    if (styleEl && styleEl.isConnected) return styleEl;
    styleEl = document.createElement("style");
    styleEl.id = "css-vars-override";
    const nonce = window.__cspNonce;
    if (nonce) styleEl.setAttribute("nonce", nonce);
    document.head.appendChild(styleEl);
    return styleEl;
}

export function setRootVar(name: string, value: string): void {
    vars.set(name, value);
    getStyleEl().textContent = buildCSS();
}

export function removeRootVar(name: string): void {
    if (!vars.has(name)) return;
    vars.delete(name);
    getStyleEl().textContent = buildCSS();
}

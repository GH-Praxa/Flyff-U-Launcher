import "../styles/index.css";

import { logErr } from "../shared/logger";
import { FLYFF_URL } from "./constants";
import {
    type ThemeUpdatePayload,
    currentTheme,
    isThemeKey,
    applyTheme,
    pushThemeUpdate,
    getActiveThemeColors,
    getThemeColors,
    applyStoredTabActiveColor,
    hydrateTabActiveJsonOverride,
    hydrateThemeFromSnapshot,
    getManualTabActiveOverride,
    setTabActiveColor,
    setIsTabActiveColorManual,
    setLastTabActiveHex,
    setJsonTabActiveOverride,
} from "./theme";
import { loadFeatureFlags, loadClientSettings } from "./settings";
import { qs, clear, createWebview, showToast } from "./dom-utils";
import { renderLauncher } from "./launcher";
import { renderSession } from "./session";

// Global error diagnostics to catch runtime issues in renderer/settings UI

if (typeof window !== "undefined") {

    window.addEventListener("error", (e) => {
        // eslint-disable-next-line no-console
        console.error("[RendererError]", e.message, e.error?.stack || e.error || "(no stack)");
    });
    window.addEventListener("unhandledrejection", (e) => {
        // eslint-disable-next-line no-console
        console.error("[RendererUnhandledRejection]", e.reason?.stack || e.reason || "(no reason)");
    });

}

async function renderInstance(root: HTMLElement, profileId: string) {

    clear(root);
    root.className = "instanceRoot";
    const wv = createWebview(profileId);
    wv.setAttribute("src", FLYFF_URL);
    root.append(wv);

}

async function main() {

    const root = document.getElementById("app")!;
    window.api?.onToast?.((payload) => {
        if (!payload || typeof payload !== "object")
            return;
        const { message, tone, ttlMs } = payload as { message?: string; tone?: "info" | "success" | "error"; ttlMs?: number };
        if (!message)
            return;
        showToast(message, tone ?? "info", ttlMs);
    });
    await hydrateTabActiveJsonOverride();
    await hydrateThemeFromSnapshot();
    applyTheme(currentTheme);
    applyStoredTabActiveColor();
    setTimeout(applyStoredTabActiveColor, 0);
    pushThemeUpdate(currentTheme, getActiveThemeColors());
    await loadFeatureFlags();
    // Hydrate persisted client settings (incl. locale) before rendering any view
    await loadClientSettings().catch((err) => logErr(err, "renderer"));
    if (window.api?.onThemeUpdate) {
        window.api.onThemeUpdate((payload: ThemeUpdatePayload) => {
            if (!payload || typeof payload.id !== "string")
                return;
            const nextTheme = isThemeKey(payload.id) ? payload.id : currentTheme;
            const manualTabColor = getManualTabActiveOverride();
            if (manualTabColor) {
                setIsTabActiveColorManual(true);
                setLastTabActiveHex(manualTabColor);
                setTabActiveColor(manualTabColor, { manual: true, persist: false });
            }
            else if (payload.colors?.tabActive) {
                const themeDefault = getThemeColors(nextTheme).tabActive;
                const isManualColor = payload.colors.tabActive.toLowerCase() !== themeDefault?.toLowerCase();
                setJsonTabActiveOverride(isManualColor ? payload.colors.tabActive : null);
                setLastTabActiveHex(payload.colors.tabActive);
                setIsTabActiveColorManual(isManualColor);
                setTabActiveColor(payload.colors.tabActive, { manual: isManualColor, persist: false });
            }
            if (nextTheme !== currentTheme) {
                applyTheme(nextTheme);
            }
        });
    }
    window.addEventListener("focus", applyStoredTabActiveColor);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden)
            applyStoredTabActiveColor();
    });
    const view = qs().get("view") ?? "launcher";
    if (view === "launcher")
        return renderLauncher(root);
    if (view === "session")
        return renderSession(root);
    if (view === "instance") {
        const profileId = qs().get("profileId") ?? "";
        return renderInstance(root, profileId);
    }
    return renderLauncher(root);

}

main().catch(console.error);

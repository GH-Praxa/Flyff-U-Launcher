import type { WebContents } from "electron";

/**
 * JavaScript that runs inside the game page context.
 *
 * Flyff Universe renders its entire UI on a canvas element.
 * The game stores UI settings (including window positions) in localStorage
 * under the key `game_client_settings`. This script:
 *
 * 1. On page load: restores `game_client_settings` from a backup key
 * 2. Monkey-patches both localStorage.setItem AND Storage.prototype.setItem
 *    to intercept the game's first write (from server) and replace it with backup
 * 3. Saves subsequent changes (user interactions) as new backups
 * 4. Periodically polls for changes (fallback for WASM/C++ storage access)
 * 5. Exposes write stats on window.__flyffUiPosStats for diagnostics
 */
const INJECTION_SCRIPT = `
(function() {
    if (window.__flyffUiPositionsPersistActive) return;
    window.__flyffUiPositionsPersistActive = true;

    var GAME_KEY = "game_client_settings";
    var BACKUP_KEY = "__flyff_settings_backup_v1";
    var BACKUP_INTERVAL_MS = 5000;
    var LOG = "[UiPosPersist]";

    // Stats object readable by diagnostics from main process
    window.__flyffUiPosStats = {
        intercepted: 0,   // first-write intercepts (backup restored over server data)
        saved: 0,         // user-change saves
        periodic: 0,      // periodic backup updates (WASM/C++ fallback)
        preRestored: false
    };

    // ── Pre-restore ──────────────────────────────────────────────────
    var backup = null;
    try { backup = localStorage.getItem(BACKUP_KEY); } catch(e) {}
    var currentSettings = null;
    try { currentSettings = localStorage.getItem(GAME_KEY); } catch(e) {}

    if (backup) {
        try {
            localStorage.setItem(GAME_KEY, backup);
            window.__flyffUiPosStats.preRestored = true;
            console.log(LOG, "Pre-restored from backup (" + backup.length + " chars)");
        } catch(e) { console.error(LOG, "Pre-restore failed:", e); }
    } else if (currentSettings) {
        try {
            localStorage.setItem(BACKUP_KEY, currentSettings);
            console.log(LOG, "Created initial backup (" + currentSettings.length + " chars)");
        } catch(e) {}
    }

    // ── Monkey-patch localStorage.setItem ─────────────────────────────
    var nativeSetItem = Storage.prototype.setItem;
    var firstGameWrite = true;

    function interceptedSetItem(key, value) {
        if (key === GAME_KEY) {
            if (firstGameWrite && backup) {
                firstGameWrite = false;
                window.__flyffUiPosStats.intercepted++;
                console.log(LOG, "Intercepted first write (" + (value ? value.length : 0) + "ch) -> backup (" + backup.length + "ch)");
                nativeSetItem.call(localStorage, key, backup);
                return;
            }
            firstGameWrite = false;
            window.__flyffUiPosStats.saved++;
            nativeSetItem.call(localStorage, key, value);
            nativeSetItem.call(localStorage, BACKUP_KEY, value);
            console.log(LOG, "Saved change (" + (value ? value.length : 0) + "ch)");
            return;
        }
        nativeSetItem.call(localStorage, key, value);
    }

    localStorage.setItem = interceptedSetItem;
    Storage.prototype.setItem = function(key, value) {
        if (this === localStorage) {
            interceptedSetItem(key, value);
            return;
        }
        nativeSetItem.call(this, key, value);
    };

    // ── Periodic backup (fallback for WASM/C++ direct storage access) ─
    var lastKnown = currentSettings || backup || "";
    setInterval(function() {
        try {
            var current = localStorage.getItem(GAME_KEY);
            if (current && current !== lastKnown) {
                lastKnown = current;
                window.__flyffUiPosStats.periodic++;
                nativeSetItem.call(localStorage, BACKUP_KEY, current);
                console.log(LOG, "Periodic backup (" + current.length + "ch)");
            }
        } catch(e) {}
    }, BACKUP_INTERVAL_MS);

    // ── Final backup on page unload ──────────────────────────────────
    window.addEventListener("beforeunload", function() {
        try {
            var current = localStorage.getItem(GAME_KEY);
            if (current) {
                nativeSetItem.call(localStorage, BACKUP_KEY, current);
            }
        } catch(e) {}
    });

    console.log(LOG, "Active. backup=" + (backup ? backup.length + "ch" : "none") + " settings=" + (currentSettings ? currentSettings.length + "ch" : "none"));
})();
`;

/**
 * Registers UI position persistence for a WebContents loading Flyff Universe.
 *
 * Injects on both `did-navigate` (earliest possible) and `dom-ready` (fallback).
 * A guard variable prevents double-injection.
 *
 * @returns A cleanup function that removes the listeners.
 */
export function registerUiPositionInjection(
    wc: WebContents,
    isEnabled: () => boolean,
): () => void {
    const LOG_TAG = "[UiPosPersist]";
    let injected = false;

    // Forward page console messages to main process log.
    // Electron 39 uses Event<WebContentsConsoleMessageEventParams> — all
    // properties (level, message, line, sourceId) are on the event object.
    const onConsoleMessage = (
        _event: Electron.Event,
        _level: number,
        message: string,
    ) => {
        if (message && message.includes("[UiPosPersist]")) {
            console.log(LOG_TAG, "(page)", message.replace("[UiPosPersist] ", ""));
        }
    };
    // Use type assertion because Electron 39 marks positional args as deprecated
    // but still passes them. The handler will work with both old and new style.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wc.on("console-message", onConsoleMessage as any);

    // Periodic diagnostic via executeJavaScript (always reliable).
    let diagInterval: ReturnType<typeof setInterval> | null = null;
    let diagCount = 0;
    const startDiagnostics = () => {
        if (diagInterval) return;
        diagInterval = setInterval(() => {
            diagCount++;
            if (diagCount > 30 || wc.isDestroyed()) {
                if (diagInterval) clearInterval(diagInterval);
                diagInterval = null;
                return;
            }
            wc.executeJavaScript(`
                (function() {
                    var gcs = localStorage.getItem("game_client_settings");
                    var bak = localStorage.getItem("__flyff_settings_backup_v1");
                    var stats = window.__flyffUiPosStats || {};
                    return {
                        guard: !!window.__flyffUiPositionsPersistActive,
                        gcs: gcs ? gcs.length : 0,
                        bak: bak ? bak.length : 0,
                        match: gcs === bak,
                        stats: { i: stats.intercepted||0, s: stats.saved||0, p: stats.periodic||0, pr: !!stats.preRestored },
                        preview: gcs ? gcs.substring(0, 80) : null,
                    };
                })();
            `)
                .then((r: unknown) => {
                    console.log(LOG_TAG, "Diag #" + diagCount + ":", JSON.stringify(r));
                })
                .catch((): void => {});
        }, 5000);
    };

    const tryInject = (source: string) => {
        if (injected) return;
        if (!isEnabled()) {
            console.log(LOG_TAG, source, "skipped (disabled)");
            return;
        }
        try {
            const url = wc.getURL();
            if (!url || !url.includes("universe.flyff.com")) return;
            injected = true;
            console.log(LOG_TAG, "Injecting via", source, ":", url);
            wc.executeJavaScript(INJECTION_SCRIPT)
                .then(() => {
                    console.log(LOG_TAG, "Injection OK via", source);
                })
                .catch((err: Error) => {
                    console.error(LOG_TAG, "Injection FAILED via", source, ":", err?.message);
                    injected = false;
                });
            startDiagnostics();
        } catch (err) {
            console.error(LOG_TAG, "Injection error:", err);
        }
    };

    // did-navigate fires earliest: page context exists, game JS hasn't run yet.
    const onDidNavigate = (_event: Electron.Event, url: string) => {
        injected = false;
        diagCount = 0;
        if (url && url.includes("universe.flyff.com")) {
            tryInject("did-navigate");
        }
    };

    // dom-ready as fallback (game JS may have already run).
    const onDomReady = () => {
        tryInject("dom-ready");
    };

    wc.on("did-navigate", onDidNavigate);
    wc.on("dom-ready", onDomReady);

    return () => {
        if (diagInterval) clearInterval(diagInterval);
        diagInterval = null;
        try {
            wc.off("did-navigate", onDidNavigate);
            wc.off("dom-ready", onDomReady);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            wc.off("console-message", onConsoleMessage as any);
        } catch {
            // WebContents may already be destroyed
        }
    };
}

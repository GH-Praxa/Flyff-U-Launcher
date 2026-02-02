# Troubleshooting

## Schließen-Dialog immer auf Englisch / Sprache nicht persistent

**Ursache:** `normalize()` in `clientSettings/store.ts` gab die Settings-Properties flach zurück statt im erwarteten `settings`-Objekt. Beim Destrukturieren war `settings` daher `undefined`, Fallback auf `DEFAULT_LOCALE` ("en").

**Fix:** Return-Wert von `normalize()` korrekt in `{ settings: { ... }, migrated }` gewrappt.

---

## Schließen-Dialog erscheint hinter BrowserViews

**Ursache:** `applyLayout()` in `renderer.ts` hatte 1x `hideSessionViews()` aber 2x `showSessionViews()` (einmal im `try`-Block, einmal im `finally`-Block). Der Depth-Counter wurde dadurch vorzeitig auf 0 gebracht, was `setVisible(true)` auslöste und BrowserViews über dem Dialog wieder einblendete.

**Fix:** `viewsRestored`-Flag eingeführt. `showSessionViews()` im `try`-Block setzt das Flag auf `true`, der `finally`-Block ruft `showSessionViews()` nur auf wenn das Flag `false` ist (Fehlerfall). So bleibt der Depth-Counter immer balanciert (1 hide, 1 show).

---

## WebGL-Rendering kaputt (schwarzer Hintergrund, kein 3D-Modell)

**Ursache:** `applyActiveBrowserView()` in `manager.ts` verwendete `win.removeBrowserView(view)` zum Verstecken. Das Entfernen und Wiederhinzufügen von BrowserViews zerstört den WebGL-Kontext des Spiels.

**Fix:** Views bleiben attached und werden stattdessen mit `view.setBounds({x:0, y:0, width:0, height:0})` auf Null-Größe gesetzt. Der WebGL-Kontext bleibt so erhalten.

---

## Progressbar im Tabmodus springt (z.B. 5/7 direkt auf 7/7)

**Ursache:** `openTab()` in `renderer.ts` rief intern `incrementLoadProgress()` auf (Zeile 5905). Die Schleife zum Öffnen von Single-Tabs (ab Zeile 4938) rief nach `openTab()` nochmals `incrementLoadProgress()` auf (Zeile 4944). Dadurch wurde der Fortschritt pro Single-Tab doppelt inkrementiert. Beispiel bei einem Layout mit 1x3, 1x2, 1, 1 (7 Inhalte): Nach den Grid-Tabs stand der Progress korrekt bei 5/7. Der erste Single-Tab sprang dann direkt auf 7/7 (+2 statt +1), die Progressbar verschwand, und der letzte Tab wurde ohne sichtbaren Fortschritt geladen.

**Fix:** `incrementLoadProgress()` aus `openTab()` entfernt, da es eine allgemeine Funktion ist und keine Seiteneffekte auf den Ladefortschritt haben sollte. Stattdessen wird `incrementLoadProgress()` explizit von den aufrufenden Codepfaden gesteuert (Layout-Restore-Schleife für Single-Layouts und Single-Tabs-Schleife).

---

## Toastmeldungen hinter dem Einstellungsmenü nicht lesbar

**Ursache:** Der `.toastContainer` hatte `z-index: 11000`, das Einstellungs-Modal (`.modalOverlay`) jedoch `z-index: 999999`. Beim Öffnen der Einstellungen lagen Toasts darunter und waren verdeckt.

**Fix:** `z-index` des `.toastContainer` in `index.css` von `11000` auf `1000000` erhöht, sodass Toasts immer über dem Modal sichtbar sind.

---

## Tools-Dropdown (✨) im Tabmodus unsichtbar

**Ursache:** Das Dropdown wurde innerhalb der Tab-Leiste gerendert und blieb hinter aktiven BrowserViews verborgen; zusätzlich war die Positionierung abhängig von der verschachtelten Leiste.

**Fix:** Dropdown als `fixed`-Element direkt an `document.body` gehängt, hohen `z-index` vergeben und beim Öffnen `hideSessionViews()` / beim Schließen `showSessionViews()` aufgerufen. Fallback-Display (`display: flex`) und Default-Position hinzugefügt, falls CSS nicht greift.

---

## FCoins→Penya-Rechner öffnet kein Eingabefeld

**Ursache:** Die erste Version nutzte `prompt()/alert()`, die im Renderer-Kontext nicht sichtbar waren bzw. durch BrowserViews überdeckt werden konnten.

**Fix:** Rechner als eigenes Fenster per `window.open` umgesetzt. Enthält Eingabefelder für Kurs (Penya/FCoin) und FCoins-Anzahl, rechnet live und zeigt auch den 1000er-Wert. Pop-up meldet klar, falls Pop-ups geblockt sind.

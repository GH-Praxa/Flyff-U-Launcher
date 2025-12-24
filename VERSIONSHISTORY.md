# Versionshistory

## 0.4.0 – Overlay-Kontrolle & Launcher-Politur

### Added
- **Floatinges Overlay-Steuerfeld:** Eine schwebende Zahnrad-Schaltfläche lauert über dem markierten Profilfenster und öffnet ein Sidepanel mit Platzhaltern für Anzeige-, Settings-, Version- und Debug-Tabs. Das Panel folgt dem Spiel-Fenster, lässt sich in der Breite ziehen, bietet einen schnellen ROI-Kalibrier-Button und verarbeitet die `sidepanel:toggle`/`hudpanel:toggle`-Events.
- **Launcher-Topbar mit Brand-Links:** Die neue Kopfzeile verlinkt Flyff Universe, Flyffipedia, Flyffulator, Skillulator und Discord inklusive eigener Icons, ergänzt um eine Infobadge-Grafik und die aktuelle Versionsnummer.
- **Icon-Update:** Die Hauptfensterinstanz setzt jetzt das neue `flyff.png`-App-Icon, damit sich Launcher- und Gamefenster einheitlich präsentieren.

### Changed
- **Overlay-Handling:** Das HUD folgt nun automatisch dem aktiven Tabs-/Instanz-Fenster, blendet sich aus, sobald die Session den Fokus verliert, und nimmt per Rechtsklick-Editmodus Drag/Resize-Bounds entgegen, die über IPC persistiert und vom Sidepanel lesen werden können.

## 0.3.0 – Erweiterte OCR/ROI-Workflows

### Added
- **Robuste EXP-HUD-Pipeline:** `startExpOverlay` orchestriert einen Python-Worker (`ocr_worker.py`) zum Erfassen von EXP- und Name/Level-Crops, schreibt auf Wunsch Debug-PNGs, cached die letzten Werte und feuert `exp:update`-Events ins Overlay, sobald sich Namen/Level/EXP ändern.
- **Profile + IPC erweitern:** Das Profil-Store-Interface verwaltet nun Overlay-Settings/Hud-Layouts und ein Overlay-Icon pro Profil; `registerMainIpc` bietet Handler für ROI-Öffnen/Laden/Speichern sowie das Setzen des Overlay-Targets, wodurch Renderer und Sidepanel direkt auf diese Werkzeuge zugreifen können.
- **ROI-Kalibrierer + Normierte Speicherung:** Der neue Kalibrierdialog (Screen-Screenshot + Ziehrechtecke) speichert normierte ROIs in `userData/rois.json`, folgt einem aktiven Tab- oder Instanz-Fenster und versorgt `createOverlayTargetController` mit pixelgenauen Rechtecken.
- **Overlay-Target-Controller:** Dieser Controller liest das markierte Profil, lädt passende ROIs und startet das `startExpOverlay` nur dann, wenn die Zielinstanz im Fokus ist (Tabs + Fenster werden abgefragt).

### Changed
- **Overlay synchronisiert Fenstergrößen:** Statt `webContents.getSize()` nutzt das HUD `getContentBounds()` bzw. BrowserView-Bounds, passt sich an Parent-Bounds an, sendet `overlay:setBounds`/`overlay:setSize` und betreibt das click-through-Verhalten über `setIgnoreMouseEvents` dynamisch.
- **ROI-Kalibrierung im Flow:** `roiOpen` (Main) sorgt dafür, dass entweder die Instanz oder die Tab-View den Screenshot liefert, der Kalibrierer das Fenster folgt und nach dem Speichern automatisch das Overlay aktualisiert.

## 0.2.0 – Overlay/OCR-Grundgerüst + ROI-Kalibrierung + Launcher-UI Updates

### Added
- **Overlay Target pro Profil**
  - Profile können als **Overlay-Ziel** markiert werden (`overlayTarget`, optional `overlayIconKey`).
  - Overlay-Target wird aus dem Profile-Store gelesen und im Main regelmäßig refreshed.
- **ROI-System (Kalibrierung + Persistenz)**
  - **ROI Store** (`rois.json` im `userData`) zur Persistierung der HUD-Bereiche pro Profil.
  - **Kalibrierfenster** (transparentes Overlay über Screenshot), um **Name/Level** und **EXP%** per Rechteck zu setzen.
- **OCR-Pipeline (Python/Tesseract)**
  - `ocr_worker.py` als JSONL-Worker: nimmt PNG (Base64), liefert Text + (bei EXP) parsed value.
  - Bild-Preprocessing + mehrere Threshold-Varianten + Voting zur Stabilisierung.
- **EXP Overlay (erste Version)**
  - Regelmäßiges Capturing der ROI-Crops (Tab-View oder Instance-Window).
  - Anzeige im Overlay (inkl. optionaler Rohwerte für Debug).
  - Debug-Modus: schreibt regelmäßig PNG-Crops nach `userData/ocr_debug`.

### Changed (Renderer / UI)
- **`renderer.ts`**
  - Launcher-Topbar: Buttons für externe Tools/Seiten (Flyff Universe / Flyffipedia / Flyffulator).
  - Pro Profil: neuer **„Kalibrieren“-Button** (öffnet ROI-Kalibrierung).
  - Pro Profil: **Overlay-Target Toggle Button** (Icon-Button mit visueller Markierung).
  - Tab-Titel: verwendet primär **Profilname** (Job höchstens als Tooltip).

### Fixed / Improved
- Stabilere Capture-Basis im Main: Nutzung von **`getContentSize()`** statt `webContents.getSize()` (für korrekte Bounds im Tab/Window-Kontext).
- Debugging verbessert durch klare Logs und Crop-PNG-Export (schneller ROI/OCR-Check).

### Known issues (für 0.3 geplant)
- EXP-OCR kann trotz guter Crop-Qualität noch **sporadisch springen** (Filter/Voting hilft, aber nicht perfekt).
- Overlay-/HUD-Fenster Interaktion (Click-Through / Control-UI / Resizing / Dragging) ist **noch nicht final** (kommt als 0.3-Thema).


## 0.1.0 – Basis Launcher (Profile, Tabs/Window, IPC)

### Added
- Grundlegender **Electron/Vite Launcher**
- **Profile-System** (Create/Update/Delete/Clone/Reorder)
  - Felder: Name, optional Job, Launch-Mode (Tabs/Window)
- **Session-Modus mit BrowserView-Tabs**
  - Tabs öffnen/schließen/wechseln, Bounds-Handling bei Resize
- **Instance-Window Modus**
  - Profil als eigenes Fenster starten
- **IPC/Preload Bridge**
  - Renderer kann Profile/Session/Windows über API steuern
- Grundstruktur: View-Loader, Window-Controller, Session-Tabs-Manager, Registry-Pattern

# Versionshistory

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

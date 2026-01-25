# Flyff-U-Launcher
Inoffizieller Desktop-Launcher für Flyff Universe mit Multi-Profilen, Overlays, Plugins und Live-News.
Wichtig: Der Launcher hält sich an die Spielregeln. Keine Automationen oder Eingriffe in das Spielgeschehen.

## Schnellstart
- (Optional für OCR/Overlays) Python 3 + Tesseract installieren und `python -m pip install -r app/ocr/requirements.txt` ausführen. Bei Bedarf `FLYFF_OCR_PYTHON` auf den Python-Pfad setzen.
- Launcher starten und neues Profil anlegen (Name + Job/Badge vergeben).
- (Aibatt-Icon) für das Overlay-Ziel-Profil wählen.
- "Play" klicken (Tab oder eigenes Fenster), im Session-Fenster ggf. Split-Screen aktivieren und Layout speichern.
- Im Spiel auf das schwebende Zahnrad klicken -> ROI/OCR/Plugin-Panel öffnen, OCR-Regionen kalibrieren und Overlays aktivieren.

## Funktionen im Überblick

### Profile & Start
- Profile anlegen, umbenennen, klonen, löschen und per Drag & Drop sortieren.
- Job/Badge auswählen (Vagrant -> Crackshooter), Suchfeld + Job-Filter für lange Listen.
- Startmodus pro Profil: **Tabs** (im Session-Fenster) oder **Fenster** (eigene Instanz).
- Overlay-Zielschalter (Aibatt-Icon) für OCR/Sidepanel/Plugin-Overlays.
- Schnellzugriffe im Header: Flyff Universe, Flyffipedia, Flyffulator, Skillulator, Discord, GitHub, Update-Hinweis, Versionslabel.
- Newsfeed aus `universe.flyff.com` (Updates/Events/Shop) und rotierender Tipps-Banner.

### Session-Fenster & Layouts
- Tabbar mit Plus-Button zum Öffnen weiterer Profile und Login-Overlay für geschlossene BrowserViews.
- Split-Screen mit einstellbarem Seitenverhältnis und Links/Rechts-Markierung pro Tab.
- Tabhöhe stufenweise anpassbar; Edit-Mode zum schnellen Ausloggen/Schließen einzelner Tabs.
- Layouts speichern/laden (Tabs, aktiver Tab, Split, ausgeloggte Chars) - Chips im Startbildschirm anwenden, im Session-Fenster speichern/auto-speichern.
- Optionaler Layout-Delay (Client-Settings) verzögert das nacheinander Öffnen beim Anwenden eines Layouts.

### Overlays, OCR & Sidepanel
- Schwebendes Zahnrad folgt dem Overlay-Profil; klickt man es, öffnet sich das Sidepanel.
- **ROI**: Level, Charname, EXP % und Lauftext per Screenshot markieren, Sichtbarkeit pro Feld toggeln oder alle auf einmal ein/aus.
- **OCR**: Live-Werte für Level/EXP/Name/Lauftext, eigene Scan-Intervalle (ms) pro Feld.
- ROI/OCR gelten pro Profil; der Overlay ist klick-durchlässig und bindet Plugin-Overlays (z. B. Killfeed) automatisch an das Overlay-Ziel.
- ROI-Kalibrator: transparenter Vollbildmodus mit TAB/1-4 zum Feldwechsel, ESC für Abbruch, speichert direkt nach dem Loslassen der Box.

### Erscheinungsbild
- Fertige Themes (Toffee, Zimt, Flyff Gold, Synthwave, Holz, u. v. m.) über das Einstellungen-Modal aktivieren.
- Aktive Tabfarbe per Palette/Gradient oder Farbeingabe setzen; Änderungen werden sofort auf Sidepanel/Plugins gespiegelt.
- Animierte Akzente für Tabs/Panels (deaktivieren über Themewechsel) und Language Switcher (EN/DE/PL/FR/RU/TR/CN/JP).

### Plugins
- Plugin-Manager im Einstellungen-Modal: Status (Running/Stopped/Error/Disabled), Enable/Disable, optionales UI starten (z. B. Killfeed).
- Plugins einfach in `%APPDATA%\\Flyff-U-Launcher\\plugins` ablegen (Ordnername = Plugin-ID, z. B. `killfeed`), Launcher neu starten.
- Plugin-Tabs erscheinen automatisch im Sidepanel, Overlays werden im Spiel eingeblendet; Plugin-UI läuft im Sandbox-Iframe mit Themeübergabe.

Verfügbar:
API-Fetch - Läd Endpunkte aus der Flyff-U-API herunter und speichert sie lokal auf dem Rechner.
Killfeed - Ein Tracker welche durch ausgelesene EXP berechnungen anstellt.
CD-Timer - Lässt Timer für Buffs/Power Ups einstellen, laufen diese ab werden Icons als hinweis angezeigt.


### News & Ressourcen
- Newsfeed rechts im Startbildschirm mit Bildern, Datum und Kategorie (Updates/Events/ItemShop).
- Direktlinks zu Tools & Community (Flyff Universe, Flyffipedia, Flyffulator, Skillulator, Discord, GitHub) im Topbar.

### Sprache & Lokalisierung
- Sofort umschaltbar über die Flagge im Header; Auswahl wird lokal gespeichert.

### Speicherorte
- Profil-, Layout-, Theme- und Client-Settings werden unter `%APPDATA%\\Flyff-U-Launcher` abgelegt.
- Plugins: `%APPDATA%\\Flyff-U-Launcher\\plugins`

### Voraussetzungen für OCR/Plugins
- **Python 3** auf dem PATH oder per FLYFF_OCR_PYTHON definiert.
- `pip install -r app/ocr/requirements.txt` (opencv-python, numpy, pytesseract) + lokales Tesseract-Binary.



## English Version
Unofficial desktop launcher for Flyff Universe with multi-profiles, overlays, plugins, and live news.
Important: The launcher follows the game rules. No automation or interference with gameplay.

### Quick Start
- (Optional for OCR/overlays) Install Python 3 + Tesseract and run `python -m pip install -r app/ocr/requirements.txt`. Set `FLYFF_OCR_PYTHON` to the Python path if needed.
- Start the launcher and create a new profile (assign name + job/badge).
- Choose the Aibatt icon for the overlay target profile.
- Click "Play" (Tab or separate window); in the session window enable split-screen if desired and save the layout.
- In-game click the floating gear -> open ROI/OCR/Plugin panel, calibrate OCR regions, and enable overlays.

### Features at a Glance

#### Profiles & Launch
- Create, rename, clone, delete, and drag & drop sort profiles.
- Pick job/badge (Vagrant -> Crackshooter), search field + job filter for long lists.
- Start mode per profile: **Tabs** (inside session window) or **Window** (separate instance).
- Overlay target toggle (Aibatt icon) for OCR/sidepanel/plugin overlays.
- Quick links in the header: Flyff Universe, Flyffipedia, Flyffulator, Skillulator, Discord, GitHub, update notice, version label.
- News feed from `universe.flyff.com` (updates/events/shop) and rotating tips banner.

#### Session Window & Layouts
- Tab bar with plus button to open more profiles and login overlay for closed BrowserViews.
- Split-screen with adjustable ratio and left/right markers per tab.
- Adjustable tab height; edit mode for quick logout/close of individual tabs.
- Save/load layouts (tabs, active tab, split, logged-out chars) - apply via chips on the start screen; save/auto-save in the session window.
- Optional layout delay (client settings) to stagger opening when applying a layout.

#### Overlays, OCR & Sidepanel
- Floating gear follows the overlay profile; clicking it opens the side panel.
- **ROI**: Mark level, character name, EXP %, and ticker text via screenshot; toggle visibility per field or all at once.
- **OCR**: Live values for level/EXP/name/ticker text with custom scan intervals (ms) per field.
- ROI/OCR are per profile; the overlay is click-through and automatically attaches plugin overlays (e.g., Killfeed) to the overlay target.
- ROI calibrator: transparent full-screen with TAB/1-4 to switch fields, ESC to abort, saves right after releasing the box.

#### Appearance
- Ready-made themes (Toffee, Cinnamon, Flyff Gold, Synthwave, Wood, many more) via the settings modal.
- Set active tab color via palette/gradient or manual entry; updates mirror instantly to sidepanel/plugins.
- Animated accents for tabs/panels (can be disabled by switching themes) and language switcher (EN/DE/PL/FR/RU/TR/CN/JP).

#### Plugins
- Plugin manager in the settings modal: status (Running/Stopped/Error/Disabled), enable/disable, optionally start UI (e.g., Killfeed).
- Drop plugins into `%APPDATA%\\Flyff-U-Launcher\\plugins` (folder name = plugin ID, e.g., `killfeed`), then restart the launcher.
- Plugin tabs show up in the sidepanel; overlays appear in-game; plugin UI runs in a sandboxed iframe with theme handoff.

Available:
API-Fetch - Loads endpoints from the Flyff-U API and stores them locally on the machine.
Killfeed - A tracker that calculates based on read EXP values.
CD-Timer - Lets you set timers for buffs/power-ups; when they expire, icons appear as a hint.

#### News & Resources
- News feed on the right of the start screen with images, date, and category (Updates/Events/ItemShop).
- Direct links to tools & community (Flyff Universe, Flyffipedia, Flyffulator, Skillulator, Discord, GitHub) in the top bar.

#### Language & Localization
- Switch instantly via the flag in the header; selection is stored locally.

#### Storage Locations
- Profile, layout, theme, and client settings are stored in `%APPDATA%\\Flyff-U-Launcher`.
- Plugins: `%APPDATA%\\Flyff-U-Launcher\\plugins`

#### Requirements for OCR/Plugins
- **Python 3** on PATH or defined via FLYFF_OCR_PYTHON.
- `pip install -r app/ocr/requirements.txt` (opencv-python, numpy, pytesseract) + local Tesseract binary.

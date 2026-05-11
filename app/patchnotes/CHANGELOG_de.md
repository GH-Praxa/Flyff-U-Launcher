# 📦 Patchnotes

---
## 🆕 Version 3.6.0

### ✨ Skill-Icon-Picker im Controller-Tab

Statt nur per Click-to-Capture aus dem laufenden Spiel kann das Skill-Icon
für einen Face-Button (✕/○/△/□) jetzt aus den **bereits via Plugins
gecachten Spiel-Icons** ausgewählt werden — analog zum Buff-Alarm-Picker
in cd-timer.

- Klick auf den Kamera-📷-Button im Controller-Tab öffnet ein Picker-Modal
- Suche oben + Tab-Filter (Alle / Skills / Items / Buffs)
- Grid mit allen Icons aus `userData/user/cache/{item,skill}/icons/` und
  `userData/icons/{buffs,items,skills}/`
- Klick auf ein Icon → wird sofort als Skill-Icon ins Profil persistiert
- Shift+Klick auf den Kamera-Button = Icon entfernen (wie bisher)

### 🛠 Implementation

- Neuer IPC-Handler `gameIcons:list` im Main-Process (`gameIcons.ts`)
  aggregiert alle Icons als `{id, category, name, dataUrl}` und liefert
  data:image-URIs direkt im Picker einsetzbar
- Neuer IPC-Handler `controller:icon:set` zum direkten Setzen einer
  data:image-URI als Skill-Icon (umgeht den Click-to-Capture-Flow)
- Preload-Bridge: `controllerApi.listGameIcons()` + `setIcon(...)`
- Vollständige i18n in 8 Sprachen für die Picker-Strings

### 📝 Caveat

Wenn die api-fetch- oder cd-timer-Plugins nicht installiert/gestartet
sind, ist der Cache leer und der Picker zeigt einen entsprechenden
Hinweis. Click-to-Capture (über die alte Code-Pfad) ist im Backend
weiterhin verfügbar via Preload-API; aktuell hat der Button im UI nur
den Picker-Trigger — falls du Click-to-Capture als Fallback brauchst,
sag bescheid und ich baue einen separaten Capture-Button daneben.

---
## 🐛 Version 3.5.1

### 🐛 Fehlerbehebungen

**Spezial-Aktion-Picker im Controller-Tab**
- Klick auf den `@`-Button zum Auswählen einer Special-Action (Action-Pad,
  Tab-Wechsel, Settings öffnen, …) öffnete in v3.5.0 keine Auswahl
- Vermutung: Z-Index-Konflikt mit dem Modal-Overlay durch `backdrop-filter`
  auf `.configPaneCard` (CSS-Stacking-Context-Falle)
- Fix: Popover-Z-Index auf Maximum hochgezogen, Pointer-Events explizit
  gesetzt, Outside-Click via `click` statt `mousedown` (konsistenter mit
  komplexen Modal-Layouts)
- Plus `console.debug`-Logging im DevTools, falls's bei dir trotzdem nicht
  erscheint — dann steht die Position-Box im Console und wir können gezielt
  weitersuchen

---
## 🆕 Version 3.5.0

### ✨ Controller — neue Defaults & Cursor-Modus konfigurierbar

Synchron zur Android-App (v33) bekommt der PC-Launcher die gleichen Controller-Verbesserungen:

**Neue D-Pad-Defaults**
- D-Pad ↑/↓ → **Zoom +/−** (synthetisches Mausrad in der Bildschirmmitte)
- D-Pad ←/→ → **Slot-Wechsel** (`@prevTab`/`@nextTab` — wechselt zwischen offenen Tabs im selben Fenster)
- D-Pad-Up war vorher hart auf Action-Pad — jetzt muss `@actionPad` explizit auf einen Button gemappt werden (z. B. Select)

**Cursor-Modus (Maus-Steuerung) ist konfigurierbar**
- L2 war vorher hardcoded auf "reserviert für Cursor-Modus"; ist jetzt eine Special-Action `@cursorHold` (Default für L2)
- Solange `@cursorHold` gehalten wird: rechter Stick bewegt einen synthetischen Maus-Cursor, A-Taste = Maus-Klick links an aktueller Position
- Alternative `@cursorToggle`: Tippen schaltet zwischen Normal- und Cursor-Modus um
- Beide auf jeden Button mappbar — wer L2 als Skill-Slot will, legt den Cursor-Modus z. B. auf R2 oder L1
- L2 ist jetzt auch als Modifier-Layer-Slot verfügbar (vorher ausgeschlossen)

**Architektur**
- Special-Actions können jetzt Down/Up-Events haben (Hold-Verhalten); Edge-Actions wie `@actionPad` ignorieren UP wie bisher
- Neuer Cursor-Pump-Timer (60 Hz) für kontinuierliche Maus-Bewegung auch bei still gehaltenem Stick
- `releaseAll`/`reset` setzt Cursor-Modus + Maus-Down sauber zurück, damit nichts beim Window-Wechsel "hängt"

---
## 🐛 Version 3.4.1

### 🐛 Fehlerbehebungen

**Mehrere Layout-Fenster gleichzeitig**
- „Play" auf einem gespeicherten Layout öffnet jetzt ein **zusätzliches** Fenster, das laufende bleibt offen
- Fenstertitel zeigt den Namen des Layouts
- Ist ein Profil schon in einem anderen Fenster offen, erscheint in der Zelle ein Hinweis mit „Zum Fenster springen"-Button — kein zweiter Login, kein Rauswurf des Charakters

🙏 Danke an **@ODevil97** für den ausführlichen Bug-Report (GitHub)

---
## 🆕 Version 3.4.0

### ✨ Neue Funktionen

**Benutzerdefiniertes Layout (Custom)**
- Neuer Layout-Typ „Benutzerdefiniert" in der Layout-Auswahl — erlaubt die freie Anordnung von 1–8 BrowserViews mit individueller Position und Größe
- Visueller Editor mit Drag & Drop: Zellen auf einer Leinwand (16:9) positionieren und per Griffe an Ecken/Kanten in der Größe ändern
- Einstellbares Raster (Snap): 1 %, 5 % oder 10 % Genauigkeit beim Verschieben und Skalieren
- Optionale Slider-Linie (horizontal oder vertikal) für Laufzeit-Anpassung der Aufteilung
- Überlappende Zellen werden gestapelt (oberste Zelle empfängt Eingaben)
- Gespeicherte Custom-Layouts zeigen eine dynamische ASCII-Vorschau basierend auf der tatsächlichen Zellanordnung

**Verstellbarer Slider für 1×3-Layouts**
- Das mittlere Fenster im 1×3-Layout (row-3) kann per Slider in der Breite angepasst werden — die Seitenfenster teilen sich den verbleibenden Platz gleichmäßig

### ⚙️ Verbesserungen

- Dokumentation um den Custom-Layout-Editor erweitert (alle 8 Sprachen)

### 🐛 Fehlerbehebungen

- **Schriftarten**: Gebündelte Schriftarten (Josefin Sans, Roboto, Open Sans u. a.) wurden nicht korrekt auf die Spiel-Browser angewendet; `@font-face` wird jetzt im Author-Origin geladen
- **Login**: Anmeldung durch Facebook und Apple lud endlos

---
## 🐛 Version 3.3.0

### 🐛 Fehlerbehebungen

- **Versionsrückstufung**: Rückkehr zu einer älteren Version schlug fehl mit "TypeError: this.currentVersion.format is not a function" — der Update-Handler überschrieb interne Versionsdaten fälschlicherweise mit einem einfachen String statt einem Versions-Objekt
- **Versionsrückstufung**: Auswahl einer bestimmten älteren Version fand immer das neueste Release — verwendet jetzt eine direkte Asset-URL für das Ziel-Release, sodass jede verfügbare Version installiert werden kann

---
## 🆕 Version 3.2.0

### ⚙️ Verbesserungen

- **Quest Guide: EXP-Anzeige** — EXP-Werte werden als Prozent mit 4 Nachkommastellen angezeigt; OCR-Level wird immer für die EXP-Berechnung verwendet, Level-Modus steuert nur noch die Quest-Filterung

### 🐛 Fehlerbehebungen

- **API-Fetch**: Endpoint-Auswahl (Checkboxen) wurde ignoriert — fehlender Parameter in IPC-Handlern behoben
- **API-Fetch**: Weltkarten-Kacheln (`tile_grid`) werden jetzt korrekt heruntergeladen
- Fehlerberichte können jetzt auch ohne vorhandene Log-Einträge gesendet werden
- Fehlerprotokoll Senden-Button zeigt Feedback nach dem Senden an

---
## 🐛 Version 3.1.1

### 🐛 Fehlerbehebungen

- Sidepanel-UI im gepackten Build komplett zerlegt (weißer Hintergrund, fehlende Styles) — Content Security Policy blockierte Inline-Styles in temporären HTML-Dateien

---
## 🆕 Version 3.1.0

### ✨ Neue Funktionen

**Neue Layout-Typen**
- Vertikale Layouts: 2x1, 3x1, 4x1 (Views übereinander)
- Asymmetrische Layouts: Hauptfenster + 2–3 Nebenfenster rechts (`main-r2`, `main-r3`) oder unten (`main-b2`, `main-b3`)
- Aufteilung der asymmetrischen Layouts per Slider einstellbar (min 20% / max 80%)
- Layout-Picker mit ASCII-Vorschau: Beim Hovern wird ein Diagramm des Layouts angezeigt

**Profil-Export/Import**
- Profile als `.flyffprofile`-Datei exportieren und importieren
- Enthält Profil-Metadaten, Electron-Session-Cookies und localStorage-Daten
- Ermöglicht Backup und Transfer zwischen Rechnern

**Charakternamen & Berufe pro Charakter**
- Charakternamen und Berufe pro Charakter im Profil hinterlegen — Anzeige als Badges mit Job-Icon in der Profilliste, filterbar und in Plugins per Combobox auswählbar

**Launcher-Ankündigungen**
- Neuer Bereich im rechten Panel zeigt Nachrichten vom Entwickler ohne App-Update — z. B. bekannte Fehler, aktuelle Entwicklungen oder geplante Features; auf Deutsch und Englisch verfügbar, deaktivierbar in den Einstellungen
- Geöffnete Profile im rechten Panel sind auf- und zuklappbar

**Schriftart-Einstellung**
- Neue Einstellung "Overlay- & UI-Schriftart" in den Client-Einstellungen — verfügbare Schriftarten: Josefin Sans, Roboto, Open Sans, Lato, Montserrat, Raleway, Nunito, Ubuntu, Cinzel; Schriftart wird in Launcher-Overlays und DOM-basierte UI-Elemente im Spiel angewendet

**Schriftgröße-Einstellung**
- Neue Einstellung "Schriftgröße des Launchers": Textgröße im Launcher-Fenster skalierbar (75–150%), nicht im Spiel selbst

**Fehlerprotokoll & Nachricht an Entwickler**
- Log-Fenster vom Sidepanel in die Tab-Leiste verschoben — ermöglicht das Anzeigen, Speichern und Löschen von Fehlerlogs sowie das Senden einer Nachricht an den Entwickler (angezeigte Fehler werden mitgesendet); 60-Sekunden-Cooldown

**Quest Guide Plugin**
- Neues Plugin im Sidepanel: zeigt Quests inkl. Start-/End-NPC, Aufgabe und Belohnungen mit Mapmarker an — benötigt Quest-, NPC-, Monster- und Item-Daten per API-Fetch

**Unified Upgrade-Rechner**
- Upgrade-Rechner um weitere Berechnungen zu Waffen, Schmuck, Rüstungs-Piercing, Waffen-Piercing, Ultimate erweitert inkl. Pity-System, FWC und Event-Bonus sowie bereits vorhandene Versuche

**UI-Tooltips & Hilfe-Icons**
- Alle wichtigen Bedienelemente im Launcher haben Tooltips (in allen 8 Sprachen)
- Hilfe-Icons (?) für komplexe Funktionen: Profilname, Tab-/Fenstermodus, Charakternamen
- Hinweise für Launcher-Breite/Höhe, Filter, Layout-Auswahl und Grid-Zellen

**Telemetrie**
- Optionale anonyme Startstatistiken (Version, Betriebssystem, zufällige ID)
- Standardmäßig aktiviert, keine persönlichen Daten, jederzeit deaktivierbar

**Update-Prüfung & Versions-Rollback**
- Neue Einstellung: Beim Start automatisch nach Updates suchen (an/aus)
- Manueller „Jetzt prüfen"-Button in den Einstellungen
- Versions-Rollback: Ältere Launcher-Versionen (ab 3.0.5) können direkt aus den Einstellungen installiert werden
- Dropdown mit allen verfügbaren GitHub-Releases inkl. Datum und Markierung der aktuellen Version

### 🚀 Performance

**OCR-System optimiert**
- Plattform-sichere Screen-Capture-Methode: `xwd` auf Linux (kein GPU-Kontakt), `capturePage()` auf Win/Mac — verhindert GPU-Stalls und Spiel-Freezes
- Bei Capture-Fehler auf Linux wird der Scan übersprungen statt das Spiel einzufrieren
- Pixel-Hash-Cache: OCR wird übersprungen wenn sich der Frame nicht geändert hat — reduziert CPU-Last bei statischen Spielinhalten
- Leere OCR-Ergebnisse werden korrekt gecacht — keine unnötigen Tesseract-Wiederholungen auf unveränderten Pixeln
- Globales Tesseract-Concurrency-Limit (max. 1 gleichzeitig) — verhindert CPU-Aushungerung des GPU-Prozesses
- In-Memory-Caches für Profile, ROI-Store und ROI-Visibility-Store statt häufiger DB-Reads

**Overlay-Optimierung**
- Effizientes Overlay-Polling: minimierte Opacity-Wechsel und reduzierte Intervalle
- Linux: Vermeidung unnötiger Show/Hide-Zyklen für transparente Overlays

### ⚙️ Verbesserungen

- **Layout-Karten verbessert**: ASCII-Vorschau des Layout-Typs direkt in der Layout-Karte; Anzeige „X Profile" statt „X Tabs"; kompaktere Darstellung
- **Profil-Karten kompakter**: Reduzierte Kartenhöhe, Charaktere mit Job-Icons als horizontale Badges unter dem Profilnamen
- **Einstellungen komplett überarbeitet**: Neues Sidebar-Layout mit kategorisierten Unterseiten, Toggle-Switches und Slider-Cards
- **RAM-Anzeige**: Einstellung „RAM-Nutzung anzeigen" mit Speicherdetails pro Profil, Plugin und Systemprozess
- **Killfeed-Overlay positionierbar**: Overlay per Drag verschieben, Position wird gespeichert (x/y im Layout)
- **Killfeed-Charakterauswahl**: Charakternamen werden per Combobox aus dem Profil gewählt
- **Side-Panel-Button** in der Session-Tab-Leiste (statt im Overlay)
- **Killfeed- und Scan-Tabs im Sidepanel vereinfacht**: übersichtlichere Darstellung und reduzierte Komplexität

### 🐛 Fehlerbehebungen

- GLib/GTK-Assertion-Warnungen auf Linux unterdrückt (harmlose Chromium-interne Meldungen)

### 📦 Linux-Support

- Tesseract-Binärdateien und Bibliotheken für Linux gebündelt
- tessdata-Sprachdateien für Linux gebündelt

### 🌐 Übersetzungen

- Übersetzungen erweitert

---
## 🐛 Version 3.0.5

### 🐛 Fehlerbehebungen
- Behoben: Problem beim Einloggen mit Google-Account

---
## 🐛 Version 3.0.4

### 🐛 Fehlerbehebungen (macOS)
- Behoben: "damaged and can't be opened"-Fehler — die App innerhalb der DMG wird jetzt vor dem Zusammenstellen der DMG ad-hoc signiert (zuvor lief der Signierschritt erst nach der fertigen DMG).
- Behoben: Reihenfolge ist jetzt korrekt: `package → sign → DMG erstellen`.
- Hinweis: macOS zeigt beim ersten Start weiterhin den "Unbekannter Entwickler"-Dialog. Rechtsklick auf die App → **Öffnen** → **Trotzdem öffnen**, oder Terminal-Befehl im README verwenden.

---
## 🆕 Version 3.0.0

### 🆕 Neues Tool: Upgrade-Kosten-Rechner
- Berechnet die erwarteten Kosten für Item-Upgrades von +0 bis +10
inklusive Materialbedarf, Versuchsanzahl und Vergleich zwischen Low Sprotect zu Sprotect.

### ✨ Neue Funktionen
- Neues Logs-Tab im Sidepanel mit Live-Fehlerprotokoll (Warn/Error) sowie Löschen- und Speichern-Aktion.
- API-Fetch-Plugin 3.0.0 mit neuer nativer Sidepanel-Oberfläche (kein separates Python-UI-Fenster mehr).

### 🚀 Plattform & Distribution - Linux und Mac Support
- Build-/Release-Pipeline für Windows, macOS und Linux in GitHub Actions.
- Neue Paketformate: macOS DMG sowie Linux AppImage/DEB/RPM.
- Plattformspezifisches Tesseract-Bundling (win32, darwin, linux) inkl. angepasster Laufzeit-Erkennung/Fallback.

### 🐛 Fehlerbehebungen
- Fcoin zu Penya Kurs korrigiert
- Killfeed: Race-Conditions bei schnellen OCR-Updates reduziert (profilweises Serialisieren), Broadcast-Updates werden nicht mehr verworfen.

### 📦 Runtime & Dependencies
- Sharp-Bibliothek für Bildverarbeitung im Paket gebündelt (keine separate Installation nötig).

### ⚙️ Verbesserungen
- Killfeed-Monstererkennung priorisiert jetzt Monster-HP (mit Toleranz), danach Element/Level.
- TTK-Zielerkennung robuster durch HP-Toleranz; Monster-Grace-Fenster von 5s auf 2s angepasst.
- Stats-Engine unterscheidet besser zwischen OCR-Levelrauschen und echten Levelwechseln.
- ### Weitere Killfeed-Verbesserungen folgen
- API-Fetch im Zuge der Plattform neu aufgebaut. Weiterhin in den Einstellungen zu öffnen, zusätzlich im Sidepanel.
- Einstellungen -> Dokumentation erweitert.

### 🧹 Aufräumarbeiten
- Alte API-Fetch-Python-Artefakte entfernt (.py, .exe) zugunsten der JS/Sidepanel-Variante.
- Tesseract-Ressourcen in die neuen Plattform-Unterordner umstrukturiert.

:::accordion[Speicherpfade nach Plattform]
Alle Nutzerdaten liegen plattformabhängig in folgenden Verzeichnissen:

| **Windows** | `%APPDATA%\Flyff-U-Launcher\user\` |
| **macOS** | `~/Library/Application Support/Flyff-U-Launcher/user/` |
| **Linux** | `~/.config/Flyff-U-Launcher/user/` |

**Neue Dateien seit 2.5.1:**
- `user/tools/upgrades/upgrade_cost_calc.json` — Upgrade-Kosten-Rechner
- `user/logs/errors-*.txt` — Fehlerprotokolle
- `user/logs/ocr/` — OCR-Debug-Logs

:::

---
## 🆕 Version 2.5.1

### 🆕 Neues Feature: Giant Tracker
Eigenständiges Fenster im Killfeed-Plugin — erfasst und visualisiert Kill-Statistiken für **Giants**, **Violets** und **Bosse**.

**Filter-Tabs**
- 5 Tabs: **Alle** · **Giants** · **Violets** · **Bosse** · **Drops**
- **Bosse** — filtert nach Rang `boss` (rote Karten-Border, eigenes Icon-Styling)
- **Drops** — zeigt nur Monster mit geloggten Drops, inklusive Loot-Pool-Vorschau (Top 5 Items nach Seltenheit) direkt in der Karte

**Kill-Statistiken**
- Kartenansicht mit Compact- und Expanded-Modus
- Zeiträume: Heute, Woche, Monat, Jahr, Gesamt
- Monster-Info: Icon, Name, Level, Element, Rang, HP, ATK

**Drop-Tracking**
- Drops über den Loot-Pool des Monsters loggen (mit Seltenheitsfilter)
- Drop-History pro Monster: Item-Name, Kill-Zählerstand, Zeitstempel
- Statistiken: Ø Kills/Drop, Kills seit letztem Drop

**Time to Kill (TTK)**
- Misst automatisch die Kampfdauer gegen Giants, Violets und Bosse
- 10s Karenzzeit beim Abwählen des Ziels (Buffen, Heilen etc.) — Pausenzeit zählt nicht zur TTK
- Monster-Name + Max-HP-Fingerprint: Ziel wird zuverlässig wiedererkannt
- Anzeige: Letzter TTK, Ø TTK, Schnellster
- Persistierung in der Kill-History (CSV-Spalte `TTK_ms`)

**Sonstiges**
- Sortierung nach Kills, Name oder Level
- Suchfeld zum Filtern nach Monster-Namen

### ✨ Weitere Verbesserungen
- Killfeed: Verbesserte Monster-Erkennung
- Neue Identifizierungsgewichtung: Monster HP > Monster Level > Monster Element
- Killfeed: Monster-Tracking zählt nun getötete Mobs
- Killfeed: History eingeführt (pro Profil)
  - Tagesdatei pro Datum mit einzelnen Kills (`Datum/Uhrzeit`, `Charakter`, `Level`, `Monster-ID`, `Rang`, `Monster`, `Element`, `EXP-Zuwachs`, `erwartete EXP`, `TTK_ms`)
  - Aggregierte Tagesübersicht mit `Kills`, `EXP gesamt`, `Monster-Verteilung`, `erster/letzter Kill`
- Killfeed: Monster-Tracking im Sidepanel aktualisiert sich jetzt sofort nach Kills (kein Tab-Wechsel nötig)
- Killfeed: In den Monster-Tracking-Accordions gibt es jetzt pro Rang einen Kills-Button mit ListView der Einzelkills.
  Einzelne Kills können direkt in der ListView gelöscht werden.
  Beim Löschen einzelner Kills werden AppData-History-Dateien (daily/YYYY-MM-DD.csv, history.csv) und Sidepanel-Status aktualisiert.
- Killfeed: Sidepanel folgt jetzt stabil dem Overlay-Zielprofil (kein Springen zwischen Profil-IDs)
- Monster-Referenzdaten aktualisiert
- "Layout auswählen" Dialog Design optimiert
- "Profile verwalten (ausloggen)" Dialog Design optimiert

### 🐛 Fehlerbehebungen
- Overlays überlagern den Schließen-Dialog nicht mehr
- Accordions in der Dokumentation werden korrekt dargestellt
- Migration von Version 2.3.0 auf die neue AppData-Struktur (`user/`) läuft nun zuverlässig
- Killfeed: Negative OCR-EXP-Sprünge werden als OCR-Rauschen abgefangen und verfälschen die Kill-Erkennung nicht mehr

### 🧹 Aufräumarbeiten
- Renderer-Architektur modularisiert (interne Umstrukturierung)
- Interner Datenordner `api_fetch/` in `cache/` umbenannt
- AppData-Verzeichnisstruktur reorganisiert: Daten sind nun im Unterordner AppData\Roaming\Flyff-U-Launcher\user sortiert
- Automatische Migration: Bestehende Daten werden beim ersten Start nahtlos migriert — mit Fortschrittsanzeige
- Statische Daten (u.a. Referenzdaten) werden im Build gebündelt, damit sie in Release-Builds zuverlässig verfügbar sind
- Killfeed/Overlay-Debug-Logging reduziert, um die Konsole lesbarer zu halten

:::accordion[Neue Speicherpfade]
Alle Nutzerdaten liegen nun unter `%APPDATA%\Flyff-U-Launcher\user\`:

- `user/config/settings.json` — Client-Einstellungen
- `user/config/features.json` — Feature-Flags
- `user/profiles/profiles.json` — Launcher-Profile
- `user/profiles/rois.json` — ROI-Kalibrierungen
- `user/profiles/ocr-timers.json` — OCR-Timer
- `user/ui/themes.json` — Themes
- `user/ui/tab-layouts.json` — Tab-Layouts
- `user/ui/tab-active-color.json` — Aktive Tabfarbe
- `user/shopping/item-prices.json` — Premium-Einkaufsliste Preise
- `user/plugin-data/` — Plugin-Einstellungen
- `user/plugin-data/killfeed/history/<profile-id>/history.csv` — Killfeed Tagesübersicht pro Profil
- `user/plugin-data/killfeed/history/<profile-id>/daily/YYYY-MM-DD.csv` — Killfeed Detail-History pro Kill und Tag
- `user/cache/` — API-Fetch Daten & Icons
- `user/logs/` — Diagnose-Logs
:::

---

## 🆕 Version 2.3.0

### 🐛 Fehlerbehebungen

- OCR-Werte (Sidepanel) werden jetzt korrekt erkannt, wenn das Spiel in einem separaten Multi-Window-Fenster läuft
- ROI-Kalibrierung öffnet nicht mehr fälschlicherweise eine neue Session, sondern nutzt das bestehende Spielfenster
- OCR nutzt jetzt zuverlässig das mitgelieferte Tesseract — eine separate Installation ist nicht mehr nötig

### ✨ Verbesserungen

- Dokumentations-Accordions verwenden jetzt native HTML5-Elemente (kein JavaScript mehr nötig)

---

## 🆕 Version 2.2.0

### ➕ Neue Funktionen

**Layouts**
- Layout-Funktion überarbeitet, unterstützte Spielanzeigen:
  - 1x1 Einzelfenster
  - 1x2 Splitscreen
  - 1x3, 1x4, 2x2, 3+2, 2x3, 4+3, 2x4 Multiscreens
- Progressbar in Tab-Leiste eingefügt, welcher den Fortschritt beim Öffnen der Spielscreens zeigt
- Multi-Window-System: Mehrere unabhängige Session-Fenster können geöffnet werden

**Hotkeys** — frei belegbare Tastenkombinationen (2-3 Tasten)
- Overlays ausblenden
- Sidepanel ein/aus
- Tab-Leiste ein/aus
- Screenshot des aktiven Fensters in `C:\Users\<USER>\Pictures\Flyff-U-Launcher\` speichern
- Letzter Tab / Nächster Tab
- Nächste Fenster-Instanz
- CD-Timer auf 00:00 setzen, Icons warten auf Klick
- FCoins-Rechner öffnen
- Premium-Einkaufsliste öffnen

**Neue Client Settings**
- Launcher-Breite / Launcher-Höhe
- Grid-Tabs sequentiell laden
- Tab-Anzeige für Layouts
- Aktiven Grid-View hervorheben
- Layouts bei Änderungen aktualisieren
- Dauer Statusmeldungen
- FCoins-Wechselkurs
- Tab-Layout-Anzeigemodus (Kompakt, Gruppiert, Getrennt, Mini-Grid)

**Menüs & Tools**
- Neues Menü "Tools (Sternsymbol)" zur Tab-Leiste hinzugefügt.
  Das Menü blendet die Browserview aus, die Charaktere bleiben eingeloggt.
  - Interne Tools: FCoins zu Penya Rechner, Premium-Einkaufsliste
  - Externe Links: Flyff Universe Homepage, Flyffipedia, Flyffulator, Skillulator
- Neues Menü in der Tab-Leiste (Tastatur) zeigt die festgelegten Hotkeys an.
  Das Menü blendet die Browserview aus, die Charaktere bleiben eingeloggt.

**Dokumentation**
- Neuer Tab im Einstellungsmenü "Dokumentation" mit Erklärungen in verschiedenen Sprachen:
  - Profil erstellen, Layout erstellen, Datenpfade & Persistent, API-Fetch,
    CD-Timer, Killfeed, FCoins <-> Penya, Premium-Einkaufsliste
- Der Text ist in alle verfügbaren Sprachen übersetzt. Bilder fehlen teilweise noch.
  Fallback: englisches UI → deutsches UI.

**Sonstiges**
- Neues Theme "Steel Ruby" hinzugefügt
- Launcher zeigt unter dem Newsfeed eine Liste bereits geöffneter Profile an
- Spendenfunktion in Einstellungen → Support hinzugefügt
- Schließen-Dialog bei MultiTabs enthält die Option "In einzelne Tabs auflösen"
- Beim Öffnen eines Profils, während bereits eine Session aktiv ist, wird abgefragt, ob es zum aktuellen Fenster hinzugefügt oder ein neues Fenster erstellt werden soll

### 🧹 Aufräumarbeiten

- Das Fenster des Launchers hat nun eine Mindestgröße und ist bis dahin responsiv
- Standard-Fenstergröße des Launchers von 980×640 auf 1200×970 geändert
- "X" Button im Einstellungsmenü hinzugefügt
- Größe des Einstellungsfensters angepasst
- "Manage" Menü für Profile und Layouts geändert. Diese enthalten "Umbenennen" und "Löschen"
- "Profile" Button in der Layoutauswahl hinzugefügt. Dieser zeigt enthaltene Profile des Layouts an
- Icon für den Button zum Vergrößern der Tab-Leiste hinzugefügt
- Anzeige des aktiven Tab im schließen Dialog hervorgehoben

### 🐛 Fehlerbehebungen

- Fehler behoben welcher beim Tabwechsel zum ausblenden des Spiels geführt hat

### 🐛 Bekannte Fehler

- Es kommt vor, dass Texteingabem im Sidepanel nicht korrekt ankommen
- Overlays werden in Dialogfenstern z.b. "Schließen" und "Layout auswählen" angezeigt     ✅ behoben in 2.4.1 
- Das Sidepanel wird im Fenstermodus nicht angezeigt


---

## 🆕 Version 2.1.1

### ✨ Verbesserungen

- Overlays überlagern keine externen Fenster mehr.
  Bei Inaktivität des Fensters werden sie automatisch ausgeblendet.
- Flackern der Overlays beim Verschieben des Fensters behoben.
  Auch hier werden Overlays nun korrekt ausgeblendet.
- Letzter Tab im Layout erhält nun ausreichend Ladezeit, bevor der Splitscreen aktiviert wird.
- Alle Aktionen im Beenden-Dialog (außer Abbrechen) sind jetzt als Danger-Buttons (rot) markiert.
  „Abbrechen" bleibt bewusst neutral.
- Patchnotes-Tab im Einstellungsmenü hinzugefügt.
  Anzeige erfolgt in der jeweils gewählten Sprache.

### ➕ Neue Funktionen

- „+"-Button am Ende des CD-Timers hinzugefügt

### 🧹 Aufräumarbeiten

- Ungenutzter Reiter im Icon-Dialog entfernt
- Ungenutztes „RM-EXP"-Badge oben rechts entfernt

---

## 🔄 Version 2.1.0

### 🚀 Neuerungen

- Updates können nun direkt über den Launcher durchgeführt werden

---

## 🔄 Version 2.0.2

### 🐛 Fehlerbehebungen

- Fehler behoben, welcher das Sidepanel leer anzeigt
- Fehler in der Übersetzung korrigiert

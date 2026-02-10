# 📦 Patchnotes

---
## 🆕 Version 2.5.0

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

<div align="center">

# Flyff-U-Launcher

**Inoffizieller Desktop-Launcher für Flyff Universe**
Multi-Accounts, Splitscreen, OCR-Overlays, Plugins und Live-News — alles in einer App.

[![Download Latest Release](https://img.shields.io/badge/%E2%AC%87%EF%B8%8F%20Download-Latest%20Release-blue?style=for-the-badge&logo=github)](https://github.com/GH-Praxa/Flyff-U-Launcher/releases)

> Der Launcher hält sich an die Spielregeln. Keine Automationen oder Eingriffe in das Spielgeschehen.

<img src="app/docs/assets/screenshots/1.png" width="700" alt="Flyff-U-Launcher Startbildschirm" />

</div>

---

## Funktionen

### Multi-Profil-System
- Profile anlegen, umbenennen, klonen, löschen und per Drag & Drop sortieren
- Job/Badge pro Profil (Vagrant bis Crackshooter) mit Suchfeld und Job-Filter
- Startmodus pro Profil: **Tabs** (im Session-Fenster) oder **Fenster** (eigene Instanz)
- Overlay-Ziel bestimmen, welches Profil die OCR-Overlays und das Sidepanel erhält

### Layouts & Splitscreen
- **Grid-Layouts**: 1x1, 1x2, 1x3, 1x4, 2x2, 3+2, 2x3, 4+3, 2x4
- Layouts speichern/laden — per Klick mehrere Charaktere gleichzeitig starten
- Auto-Save und optionaler Layout-Delay für sequentielles Laden
- Multi-Window: Mehrere unabhängige Session-Fenster parallel nutzen
- Fortschrittsanzeige beim Laden der Spielinstanzen

<div align="center">
<img src="app/docs/assets/screenshots/3.png" width="700" alt="2x3 Grid-Layout mit 6 Spielinstanzen" />
<br/><sub>2x3 Grid-Layout — 6 Spielinstanzen gleichzeitig</sub>
</div>

<br/>

<div align="center">
<img src="screen.png" width="700" alt="Session mit Splitscreen und Overlays" />
<br/><sub>Splitscreen mit Sidepanel und Overlays</sub>
</div>

### OCR & Overlays
- **ROI-Kalibrator**: Regionen für Level, Charname, EXP % und Lauftext per Screenshot markieren
- **Live-OCR**: Werte werden in Echtzeit ausgelesen, eigene Scan-Intervalle pro Feld
- Schwebendes Zahnrad-Overlay folgt dem aktiven Profil — Klick öffnet das Sidepanel
- Overlays sind klick-durchlässig und werden bei Inaktivität automatisch ausgeblendet
- OCR nutzt das mitgelieferte Tesseract — keine separate Installation nötig

### Hotkeys
Frei belegbare Tastenkombinationen (2–3 Tasten) für:
- Overlays/Sidepanel/Tab-Leiste ein/aus
- Tab-Navigation (Vorheriger/Nächster Tab, Nächstes Fenster)
- Screenshot speichern
- CD-Timer zurücksetzen
- FCoins-Rechner und Premium-Einkaufsliste öffnen

### Themes & Sprachen
- Fertige Themes: Toffee, Zimt, Flyff Gold, Synthwave, Steel Ruby, Holz u.v.m.
- Aktive Tabfarbe per Palette, Gradient oder Farbcode anpassen
- Animierte Akzente für Tabs und Panels
- **8 Sprachen**: Deutsch, English, Polski, Francais, Русский, Türkce, 中文, 日本語

### Integrierte Tools

<div align="center">
<table>
<tr>
<td align="center"><img src="app/docs/assets/screenshots/tools/fcoin_zu_penya/fcoin_zu_penya_2.png" width="300" alt="FCoins zu Penya Rechner" /><br/><sub>FCoins-Rechner</sub></td>
<td align="center"><img src="app/docs/assets/screenshots/tools/premium_shopping_list/premium_shopping_list_2.png" width="300" alt="Premium Shopping List" /><br/><sub>Premium-Einkaufsliste</sub></td>
</tr>
</table>
</div>

- **FCoins-Rechner**: FCoins zu Penya umrechnen mit einstellbarem Wechselkurs
- **Premium-Einkaufsliste**: Items und Preise verwalten, Gesamtkosten in FCoins berechnen
- **Newsfeed**: Updates, Events und Item-Shop-News direkt von universe.flyff.com
- **Schnellzugriffe**: Flyff Universe, Flyffipedia, Flyffulator, Skillulator, Discord

---

## Plugins

Plugins werden in `%APPDATA%\Flyff-U-Launcher\plugins` abgelegt und erscheinen automatisch im Sidepanel.

| Plugin | Beschreibung |
|--------|-------------|
| **Killfeed** | EXP-Tracker mit Kill-Erkennung, Monster-Statistiken und detaillierter History (CSV) pro Profil |
| **Giant Tracker** | Kill-Statistiken für Giants, Violets und Bosse — mit Drop-Tracking, Loot-Pool-Vorschau und Time-to-Kill (TTK) |
| **CD-Timer** | Timer für Buffs und Power-Ups — Icons warnen bei Ablauf |
| **API-Fetch** | Lädt Flyff-Universe-API-Daten herunter und speichert sie lokal |

### Giant Tracker

<div align="center">
<img src="app/docs/assets/screenshots/killfeed_giant_tracker/killfeed_giant_tracker_5_de.png" width="700" alt="Giant Tracker — Kill-Statistiken mit TTK und Drop-Tracking" />
<br/><sub>Kill-Statistiken mit Time-to-Kill, Drop-Tracking und Zeitraum-Filter</sub>
</div>

<br/>

<div align="center">
<img src="app/docs/assets/screenshots/killfeed_giant_tracker/killfeed_giant_tracker_6_de.png" width="700" alt="Giant Tracker — Loot-Pool mit Seltenheitsfilter" />
<br/><sub>Drop loggen mit Loot-Pool-Vorschau und Seltenheitsfilter</sub>
</div>

### CD-Timer

<div align="center">
<table>
<tr>
<td align="center"><img src="app/docs/assets/screenshots/cd_timer/cd_timer_3_de.png" width="300" alt="CD-Timer Konfiguration" /><br/><sub>Timer konfigurieren</sub></td>
<td align="center"><img src="app/docs/assets/screenshots/cd_timer/cd_timer_5_de.png" width="300" alt="CD-Timer Overlay" /><br/><sub>Einzeln anwählbar</sub></td>
</tr>
</table>
</div>

---

## Installation

1. [Neueste Version herunterladen](https://github.com/GH-Praxa/Flyff-U-Launcher/releases) und entpacken
2. `Flyff-U-Launcher.exe` starten
3. Profil anlegen, Job wählen und auf **Spielen** klicken

**OCR/Overlays** erfordern Python 3 (`pip install -r app/ocr/requirements.txt`). Tesseract ist im Launcher enthalten.

---

## Speicherort

Alle Nutzerdaten liegen unter `%APPDATA%\Flyff-U-Launcher\user\` — Profile, Layouts, Themes, Plugin-Daten und OCR-Kalibrierungen.

---

<div align="center">

# English

</div>

---

<div align="center">

**Unofficial desktop launcher for Flyff Universe**
Multi-accounts, splitscreen, OCR overlays, plugins, and live news — all in one app.

[![Download Latest Release](https://img.shields.io/badge/%E2%AC%87%EF%B8%8F%20Download-Latest%20Release-blue?style=for-the-badge&logo=github)](https://github.com/GH-Praxa/Flyff-U-Launcher/releases)

> The launcher follows the game rules. No automation or interference with gameplay.

</div>

---

## Features

### Multi-Profile System
- Create, rename, clone, delete, and drag & drop sort profiles
- Job/badge per profile (Vagrant to Crackshooter) with search and job filter
- Launch mode per profile: **Tabs** (inside session window) or **Window** (separate instance)
- Overlay target determines which profile receives OCR overlays and the side panel

### Layouts & Splitscreen
- **Grid layouts**: 1x1, 1x2, 1x3, 1x4, 2x2, 3+2, 2x3, 4+3, 2x4
- Save/load layouts — launch multiple characters at once with a single click
- Auto-save and optional layout delay for sequential loading
- Multi-window: Use multiple independent session windows in parallel
- Progress bar shows loading status for game instances

<div align="center">
<img src="app/docs/assets/screenshots/3.png" width="700" alt="2x3 grid layout with 6 game instances" />
<br/><sub>2x3 grid layout — 6 game instances simultaneously</sub>
</div>

<br/>

<div align="center">
<img src="screen.png" width="700" alt="Session with splitscreen and overlays" />
<br/><sub>Splitscreen with side panel and overlays</sub>
</div>

### OCR & Overlays
- **ROI calibrator**: Mark regions for level, character name, EXP %, and ticker text via screenshot
- **Live OCR**: Values are read in real time with custom scan intervals per field
- Floating gear overlay follows the active profile — click to open the side panel
- Overlays are click-through and auto-hide when the window is inactive
- OCR uses the bundled Tesseract — no separate installation required

### Hotkeys
Freely assignable key combinations (2–3 keys) for:
- Toggle overlays/side panel/tab bar
- Tab navigation (previous/next tab, next window)
- Save screenshot
- Reset CD timer
- Open FCoins calculator and premium shopping list

### Themes & Languages
- Built-in themes: Toffee, Cinnamon, Flyff Gold, Synthwave, Steel Ruby, Wood, and more
- Customize active tab color via palette, gradient, or color code
- Animated accents for tabs and panels
- **8 languages**: Deutsch, English, Polski, Francais, Русский, Türkce, 中文, 日本語

### Built-in Tools

<div align="center">
<table>
<tr>
<td align="center"><img src="app/docs/assets/screenshots/tools/fcoin_zu_penya/fcoin_zu_penya_2.png" width="300" alt="FCoins to Penya Calculator" /><br/><sub>FCoins Calculator</sub></td>
<td align="center"><img src="app/docs/assets/screenshots/tools/premium_shopping_list/premium_shopping_list_2.png" width="300" alt="Premium Shopping List" /><br/><sub>Premium Shopping List</sub></td>
</tr>
</table>
</div>

- **FCoins Calculator**: Convert FCoins to Penya with adjustable exchange rate
- **Premium Shopping List**: Manage items and prices, calculate total cost in FCoins
- **Newsfeed**: Updates, events, and item shop news directly from universe.flyff.com
- **Quick Links**: Flyff Universe, Flyffipedia, Flyffulator, Skillulator, Discord

---

## Plugins

Drop plugins into `%APPDATA%\Flyff-U-Launcher\plugins` — they appear automatically in the side panel.

| Plugin | Description |
|--------|------------|
| **Killfeed** | EXP tracker with kill detection, monster statistics, and detailed per-profile history (CSV) |
| **Giant Tracker** | Kill statistics for Giants, Violets, and Bosses — with drop tracking, loot pool preview, and time-to-kill (TTK) |
| **CD-Timer** | Timers for buffs and power-ups — icons warn on expiry |
| **API-Fetch** | Downloads Flyff Universe API data and stores it locally |

### Giant Tracker

<div align="center">
<img src="app/docs/assets/screenshots/killfeed_giant_tracker/killfeed_giant_tracker_5_de.png" width="700" alt="Giant Tracker — Kill statistics with TTK and drop tracking" />
<br/><sub>Kill statistics with time-to-kill, drop tracking, and time range filter</sub>
</div>

<br/>

<div align="center">
<img src="app/docs/assets/screenshots/killfeed_giant_tracker/killfeed_giant_tracker_6_de.png" width="700" alt="Giant Tracker — Loot pool with rarity filter" />
<br/><sub>Log drops with loot pool preview and rarity filter</sub>
</div>

### CD-Timer

<div align="center">
<table>
<tr>
<td align="center"><img src="app/docs/assets/screenshots/cd_timer/cd_timer_3_de.png" width="300" alt="CD-Timer Configuration" /><br/><sub>Configure timers</sub></td>
<td align="center"><img src="app/docs/assets/screenshots/cd_timer/cd_timer_5_de.png" width="300" alt="CD-Timer Overlay" /><br/><sub>In-game overlay</sub></td>
</tr>
</table>
</div>

---

## Installation

1. [Download the latest release](https://github.com/GH-Praxa/Flyff-U-Launcher/releases) and extract
2. Run `Flyff-U-Launcher.exe`
3. Create a profile, pick a job, and click **Play**

**OCR/Overlays** require Python 3 (`pip install -r app/ocr/requirements.txt`). Tesseract is bundled with the launcher.

---

## Storage

All user data is stored under `%APPDATA%\Flyff-U-Launcher\user\` — profiles, layouts, themes, plugin data, and OCR calibrations.

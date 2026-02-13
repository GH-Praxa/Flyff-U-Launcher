# AppData Refactoring – v2.4.1

## Problem

Bis v2.4.0 lagen **14 JSON-Dateien** lose im userData-Root. Die Struktur war flach, unübersichtlich und nicht nach Zugehörigkeit gruppiert:

```
{userData}/                          ← VOR v2.4.1 (chaotisch)
├── client-settings.json
├── profiles.json
├── features.json
├── themes.json
├── tabLayouts.json
├── rois.json
├── roi-visibility.json
├── plugin-states.json
├── ocr-timers.json
├── manual-levels.json
├── item-prices.json
├── themeSnapshot.json
├── tabActiveColor.json
├── sidepanel-button.json
├── plugins/                  ← Plugin-Quellcode
├── plugin-data/              ← Plugin-Storage (ok)
│   └── {pluginId}/
├── api_fetch/                ← Unklarer Name
│   ├── item/
│   │   ├── item_parameter.json
│   │   └── icons/
│   ├── monster/
│   │   └── monster_parameter/
│   └── skill/
│       ├── skill_icon_skillname.json
│       └── icons/
├── ocr-debug/                ← Debug-Logs
│   ├── electron_diagnostic.txt
│   ├── python_stderr.txt
│   └── python_spawn_error.txt
└── debug/
    └── debugConfig.json      ← Verschachtelt ohne Grund
```

---

## Neue Struktur (ab v2.4.1)

```
{userData}/
│
├── config/                          ← App-Einstellungen
│   ├── settings.json                   (war: client-settings.json)
│   ├── features.json                   (war: features.json)
│   └── debug.json                      (war: debug/debugConfig.json)
│
├── profiles/                        ← Alles was per-Profile gespeichert wird
│   ├── profiles.json                   (war: profiles.json)
│   ├── rois.json                       (war: rois.json)
│   ├── roi-visibility.json             (war: roi-visibility.json)
│   ├── ocr-timers.json                 (war: ocr-timers.json)
│   ├── manual-levels.json              (war: manual-levels.json)
│   └── ui-positions.json               (war: sidepanel-button.json)
│
├── ui/                              ← Themes & Layouts
│   ├── themes.json                     (war: themes.json)
│   ├── theme-snapshot.json             (war: themeSnapshot.json)
│   ├── tab-active-color.json           (war: tabActiveColor.json)
│   └── tab-layouts.json                (war: tabLayouts.json)
│
├── shopping/                        ← Shopping-List-Daten
│   └── item-prices.json               (war: item-prices.json)
│
├── plugins/                         ← Plugin-Quellcode (unverändert)
│   ├── api-fetch/
│   ├── cd-timer/
│   └── killfeed/
│
├── plugin-data/                     ← Plugin-Storage (leicht erweitert)
│   ├── _states.json                    (war: plugin-states.json)
│   └── {pluginId}/
│       ├── settings.json
│       └── *.json
│
├── cache/                           ← Heruntergeladene Spieldaten (war: api_fetch/)
│   ├── manifest.json                   api-fetch Plugin Lauf-Manifest
│   ├── item/                           (war: api_fetch/item/)
│   │   ├── item_parameter.json
│   │   ├── buff_icon_buffname.json
│   │   └── icons/
│   ├── monster/                        (war: api_fetch/monster/)
│   │   ├── monster_parameter.json
│   │   └── monster_parameter/
│   │       └── {monsterId}.json
│   └── skill/                          (war: api_fetch/skill/)
│       ├── skill_icon_skillname.json
│       └── icons/
│           ├── colored/
│           └── old/
│
└── logs/                            ← Debug & Diagnose
    └── ocr/                            (war: ocr-debug/)
        ├── electron_diagnostic.txt
        ├── python_stderr.txt
        └── python_spawn_error.txt
```

---

## Migrations-Mapping

Die Migration wird beim Start von `migrateAppData()` durchgeführt.
Regeln: Nur verschieben wenn alt existiert UND neu NICHT existiert.

| # | Alt (userData-relativ)              | Neu (userData-relativ)               | Typ        |
|---|-------------------------------------|--------------------------------------|------------|
| 1 | `client-settings.json`             | `config/settings.json`               | file move  |
| 2 | `features.json`                    | `config/features.json`               | file move  |
| 3 | `debug/debugConfig.json`           | `config/debug.json`                  | file move  |
| 4 | `profiles.json`                    | `profiles/profiles.json`             | file move  |
| 5 | `rois.json`                        | `profiles/rois.json`                 | file move  |
| 6 | `roi-visibility.json`              | `profiles/roi-visibility.json`       | file move  |
| 7 | `ocr-timers.json`                  | `profiles/ocr-timers.json`           | file move  |
| 8 | `manual-levels.json`               | `profiles/manual-levels.json`        | file move  |
| 9 | `sidepanel-button.json`            | `profiles/ui-positions.json`         | file move+rename |
| 10| `themes.json`                      | `ui/themes.json`                     | file move  |
| 11| `themeSnapshot.json`               | `ui/theme-snapshot.json`             | file move+rename |
| 12| `tabActiveColor.json`              | `ui/tab-active-color.json`           | file move+rename |
| 13| `tabLayouts.json`                  | `ui/tab-layouts.json`                | file move+rename |
| 14| `item-prices.json`                 | `shopping/item-prices.json`          | file move  |
| 15| `plugin-states.json`               | `plugin-data/_states.json`           | file move  |
| 16| `api_fetch/`                       | `cache/`                             | dir copy+delete |
| 17| `ocr-debug/`                       | `logs/ocr/`                          | dir copy+delete |

Cleanup nach Migration: leere `debug/` und `ocr-debug/` Verzeichnisse werden entfernt.

---

## Implementierung (abgeschlossen)

### Phase 1: Migration-Modul ✅

**Datei:** `app/src/main/migration/appDataMigration.ts`

- 17 Migrations-Einträge (15 Dateien + 2 Verzeichnisse)
- `api_fetch/` wird als **ganzes Verzeichnis** nach `cache/` kopiert (interne Struktur bleibt erhalten)
- Dateien werden per `fs.rename()` verschoben, Verzeichnisse per `copyDir()` + `removeDir()`
- try/catch pro Eintrag — Fehler werden geloggt, crashen aber nie

### Phase 2: Store-Pfade ✅

Alle 15 Store-Dateien auf neue Pfade umgestellt:

| Datei                                          | Alter Pfad                          | Neuer Pfad                              |
|------------------------------------------------|-------------------------------------|-----------------------------------------|
| `main/clientSettings/store.ts`                 | `client-settings.json`              | `config/settings.json`                  |
| `main/features/store.ts`                       | `features.json`                     | `config/features.json`                  |
| `main/debugConfig.ts`                          | `debug/debugConfig.json`            | `config/debug.json`                     |
| `main/profiles/store.ts`                       | `profiles.json`                     | `profiles/profiles.json`                |
| `main/roi/roiStore.ts`                         | `rois.json`                         | `profiles/rois.json`                    |
| `main/roi/roiVisibilityStore.ts`               | `roi-visibility.json`               | `profiles/roi-visibility.json`          |
| `main/ocr/timerStore.ts`                       | `ocr-timers.json`                   | `profiles/ocr-timers.json`              |
| `main/ocr/manualLevelStore.ts`                 | `manual-levels.json`                | `profiles/manual-levels.json`           |
| `main/windows/sidePanelButtonController.ts`    | `sidepanel-button.json`             | `profiles/ui-positions.json`            |
| `main/themeStore.ts`                           | `themes.json`                       | `ui/themes.json`                        |
| `main/ipc/handlers/themes.ts`                  | `themeSnapshot.json`                | `ui/theme-snapshot.json`                |
| `main/ipc/handlers/themes.ts`                  | `tabActiveColor.json`               | `ui/tab-active-color.json`              |
| `main/sessionTabs/layoutStore.ts`              | `tabLayouts.json`                   | `ui/tab-layouts.json`                   |
| `main/ipc/handlers/shoppingList.ts`            | `item-prices.json`                  | `shopping/item-prices.json`             |
| `main/plugin/pluginStateStore.ts`              | `plugin-states.json`                | `plugin-data/_states.json`              |

Zusätzliche Pfad-Änderungen im Main-Prozess:

| Datei                                          | Alter Pfad           | Neuer Pfad     |
|------------------------------------------------|----------------------|----------------|
| `main/ipc/handlers/shoppingList.ts`            | `api_fetch/item/`    | `cache/item/`  |
| `main.ts` (writeTesseractDiagnostic)           | `ocr-debug/`         | `logs/ocr/`    |
| `main/ocr/pythonWorker.ts` (2 Stellen)         | `ocr-debug/`         | `logs/ocr/`    |
| `main/ocr/workerPool.ts`                       | `ocr-debug/`         | `logs/ocr/`    |
| `main/ipc/handlers/themes.test.ts`             | `themeSnapshot.json`  | `ui/theme-snapshot.json` |

### Phase 3: Plugin-Pfade ✅

Entscheidung: `api_fetch/` → `cache/` wird als **ganzes Verzeichnis** migriert. Die interne Substruktur (`item/`, `monster/`, `skill/`) bleibt identisch — nur der Parent-Ordnername ändert sich. Das vereinfacht die Migration und vermeidet Inkompatibilitäten mit der Plugin-Endpoint-Konfiguration.

| Plugin / Script                               | Alter Pfad                                        | Neuer Pfad                                       |
|------------------------------------------------|---------------------------------------------------|--------------------------------------------------|
| `plugins/api-fetch/main.js` (outputDir)        | `Flyff-U-Launcher/api_fetch`                     | `Flyff-U-Launcher/cache`                         |
| `plugins/killfeed/main.js`                     | `api_fetch/monster/monster_parameter/{id}.json`   | `cache/monster/monster_parameter/{id}.json`       |
| `plugins/killfeed/shared/monster_exp_validator.js` | `api_fetch/monster/monster_parameter`          | `cache/monster/monster_parameter`                 |
| `plugins/cd-timer/main.js` (item-Pfade)        | `api_fetch/item/...`                              | `cache/item/...`                                 |
| `plugins/cd-timer/main.js` (skill-Pfade)       | `api_fetch/skill/...`                             | `cache/skill/...`                                |
| `scripts/export-monster-reference.js`          | `api_fetch/monster/monster_parameter`             | `cache/monster/monster_parameter`                 |

### Phase 4: Integration in main.ts ✅

- Import von `migrateAppData` aus `./main/migration/appDataMigration`
- Aufruf direkt nach `app.whenReady()`, **vor** `configureBundledTesseract()` und allen Store-Initialisierungen
- TypeScript-Check bestätigt: keine neuen Fehler durch die Änderungen

---

## Geänderte Dateien (Zusammenfassung)

**24 Dateien, +40/-36 Zeilen** (ohne das neue Migrations-Modul)

```
 app/src/main/migration/appDataMigration.ts       | 139 +++  (NEU)
 app/src/main.ts                                   |   6 +-
 app/src/main/clientSettings/store.ts              |   2 +-
 app/src/main/debugConfig.ts                       |   4 +-
 app/src/main/features/store.ts                    |   2 +-
 app/src/main/ipc/handlers/shoppingList.ts         |   6 +-
 app/src/main/ipc/handlers/themes.test.ts          |   2 +-
 app/src/main/ipc/handlers/themes.ts               |   4 +-
 app/src/main/ocr/manualLevelStore.ts              |   2 +-
 app/src/main/ocr/pythonWorker.ts                  |   4 +-
 app/src/main/ocr/timerStore.ts                    |   2 +-
 app/src/main/ocr/workerPool.ts                    |   2 +-
 app/src/main/plugin/pluginStateStore.ts           |   2 +-
 app/src/main/profiles/store.ts                    |   2 +-
 app/src/main/roi/roiStore.ts                      |   2 +-
 app/src/main/roi/roiVisibilityStore.ts            |   2 +-
 app/src/main/sessionTabs/layoutStore.ts           |   2 +-
 app/src/main/themeStore.ts                        |   2 +-
 app/src/main/windows/sidePanelButtonController.ts |   2 +-
 plugins/api-fetch/main.js                         |   2 +-
 plugins/cd-timer/main.js                          |  14 +-
 plugins/killfeed/main.js                          |   2 +-
 plugins/killfeed/shared/monster_exp_validator.js  |   2 +-
 scripts/export-monster-reference.js               |   4 +-
 app/package.json                                  |   2 +-  (version 2.4.0 → 2.4.1)
```

---

## Risiken & Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|--------|---------------|
| Migration schlägt fehl (Permissions, Locks) | try/catch pro Datei, Fehler loggen, App startet trotzdem |
| Alte und neue Datei existieren gleichzeitig | Neue Datei hat Priorität, alte wird ignoriert |
| Plugin liest noch alten Pfad | Alle Plugin-Pfade direkt im Quellcode aktualisiert |
| User macht Downgrade auf alte Version | Alte Version findet Dateien nicht mehr — akzeptables Risiko bei Major-Refactoring |
| Datei wird gerade geschrieben während Migration | Migration läuft VOR allen Store-Initialisierungen |
| `api_fetch/` Ordner enthält noch laufende Downloads | Migration kopiert statt move für Verzeichnisse, löscht erst nach Erfolg |

---

## Testplan

1. **Fresh Install** — keine alten Dateien vorhanden → neue Struktur wird direkt durch Stores erstellt
2. **Bestandsinstallation** — alle 14 JSON-Dateien + Verzeichnisse werden korrekt verschoben
3. **Wiederholter Start** — nach erfolgreicher Migration passiert nichts (Quelle existiert nicht mehr)
4. **Teilmigration** — einzelne Dateien fehlen → nur vorhandene werden verschoben
5. **Plugins** — api-fetch schreibt nach `cache/`, killfeed/cd-timer lesen aus `cache/`

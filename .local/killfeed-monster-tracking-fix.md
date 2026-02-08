# Killfeed Monster-Tracking Fix - Statusbericht

**Datum:** 2026-02-08
**Branch:** 2.0.3

---

## Ausgangsproblem

Monster-Tracking im Killfeed-Sidepanel zeigte keine Daten an. Kills wurden zwar gezaehlt, aber nicht im Monster-Tracking Tab aufgelistet. Zusaetzlich landeten alle Monster unter "Unbekannt" statt in ihren korrekten Rang-Kategorien (Normal, Riesen, Violette, Bosse).

---

## Identifizierte und behobene Bugs

### 1. Temporal Dead Zone (TDZ) - monsterReference immer leer
**Datei:** `plugins/killfeed/main.js`
**Problem:** `const monsterReference = []` war auf Zeile ~100 deklariert, aber `loadMonsterReference()` wurde auf Zeile ~75 aufgerufen. JavaScript TDZ verhindert Zugriff auf `const` vor der Deklaration. Der `try/catch` in der Funktion schluckte den `ReferenceError` still — `monsterReference` war **immer leer**.
**Fix:** Deklaration auf Zeile 50 verschoben (vor Funktionsdefinition und -aufruf).

### 2. loadMonsterReference() - falscher Suchpfad
**Datei:** `plugins/killfeed/main.js`
**Problem:** Die Suchpfade fuer `monster_reference.json` enthielten nicht den tatsaechlichen Speicherort `userData/plugins/killfeed/`. Die Datei liegt in `%APPDATA%\Flyff-U-Launcher\plugins\killfeed\monster_reference.json`, aber der erste Kandidat suchte nur in `userData/monster_reference.json` (root).
**Fix:** Neuer Suchpfad `path.join(app.getPath('userData'), 'plugins', 'killfeed', 'monster_reference.json')` als ersten Kandidaten hinzugefuegt. Zusaetzlich: `console.log` statt `debugLog` fuer Sichtbarkeit, Retry in `init()` falls Modul-Ladezeitpunkt zu frueh.

### 3. getMonsterRank() - Platzhalter gab immer 'unknown' zurueck
**Datei:** `plugins/killfeed/shared/stats_engine.js`
**Problem:** Die Funktion ignorierte `monsterMeta.rank` komplett und gab immer `UNKNOWN` zurueck.
**Fix:** Neugeschrieben mit Mapping:
- `small`, `normal`, `captain`, `material`, `super` → `'normal'`
- `giant` → `'giant'`
- `violet` → `'violet'`
- `boss`, `worldboss` → `'boss'`

### 4. monsterCandidate ohne rank-Feld
**Datei:** `plugins/killfeed/main.js`
**Problem:** Bei Level+Element-Lookup wurde `rank` nicht aus der Referenz uebernommen.
**Fix:** `rank: ref.rank || null` zum `monsterCandidate`-Objekt hinzugefuegt.

### 5. Kein monsterMeta fuer namenbasiert erkannte Monster
**Datei:** `plugins/killfeed/main.js`
**Problem:** Wenn OCR den Monsternamen direkt liest (z.B. "Pukepuke"), wurde kein `monsterMeta` erstellt — nur Level+Element-Lookup erzeugte eins.
**Fix:** `findMonsterByName()` Funktion hinzugefuegt + Lookup-Pfad wenn `monsterToken` vorhanden aber kein `parsedMonster`.

### 6. Sidepanel Profil-Binding Race Condition
**Datei:** `plugins/killfeed/ui_sidepanel.js`, `main.js`, `manifest.json`
**Problem:** `window.__overlayTargetId` wird vom Host NACH `init()` gesetzt (iframe load handler in `sidePanelWindow.ts:2023-2036`). Sidepanel band sich immer an `'default'` Profil (leer).
**Fix:** IPC-basierte Profil-Erkennung via `panel:get:active-profile`. Handler gibt das Profil zurueck, das zuletzt OCR-Events empfangen hat (`lastActiveProfileId`). Fallback: Profil mit meisten Kills.

### 7. Orphaned catch-Block - Syntax Error
**Datei:** `plugins/killfeed/ui_sidepanel.js`
**Problem:** Verwaistes `} catch (_) { /* ignore */ }` aus frueherem Edit verursachte Parse-Error — gesamtes Sidepanel-Script lief nicht.
**Fix:** Entfernt.

### 8. Race Condition in getEngine()
**Datei:** `plugins/killfeed/main.js`
**Problem:** Mehrere gleichzeitige async Aufrufe von `getEngine()` konnten doppelte Engines erzeugen.
**Fix:** `engineInitPromises` Map als Promise-Guard hinzugefuegt.

### 9. Rang-Update bei bestehenden Monstern
**Datei:** `plugins/killfeed/shared/stats_engine.js`
**Problem:** `registerKill()` setzte den Rang nur beim ersten Eintrag. Spaetere Kills mit besserer Rang-Info aktualisierten nicht.
**Fix:** Rang-Update nach Count-Inkrement wenn Rang nicht `'unknown'`.

### 10. Falsche Profilauswahl via panel:get:active-profile
**Datei:** `plugins/killfeed/main.js`
**Problem:** Handler suchte Profil mit meisten historischen Kills (`mqpp6ggi`, 8457 Kills) statt aktuell aktivem Profil.
**Fix:** `lastActiveProfileId` hat jetzt Prioritaet. Nur wenn kein OCR-Event empfangen wurde, Fallback auf meiste Kills.

---

## Geaenderte Dateien

| Datei | Aenderungen |
|---|---|
| `plugins/killfeed/main.js` | TDZ-Fix, Suchpfade, findMonsterByName(), rank in monsterCandidate, lastActiveProfileId, panel:get:active-profile, getEngine() Race Condition, console.log Diagnostik |
| `plugins/killfeed/shared/stats_engine.js` | getMonsterRank() Neuimplementierung, registerKill() Rang-Update |
| `plugins/killfeed/ui_sidepanel.js` | IPC Profil-Erkennung, syncProfiles(), Debug-Info, orphaned catch entfernt |
| `plugins/killfeed/manifest.json` | `panel:get:active-profile` zu ipcChannels hinzugefuegt |

Alle Dateien wurden nach `%APPDATA%\Flyff-U-Launcher\plugins\killfeed\` kopiert.

---

## Aktueller Status

### Funktioniert
- Sidepanel bindet sich an korrektes Profil (nicht mehr `'default'`)
- Monster-Tracking zeigt Daten an (Screenshot: `P: mqpp6ggi | M: 56`)
- Profil-Auswahl bevorzugt jetzt aktives OCR-Profil statt historisch meiste Kills
- Debug-Zeile im Sidepanel zeigt Profil-ID, Monster-Anzahl, Backend-Status

### Offen / Zu verifizieren
- **monsterReference Laden:** `console.log` hinzugefuegt — nach Neustart in Konsole pruefen ob `[Killfeed][MonsterRef] geladen aus ... | Eintraege: 1137` erscheint
- **Rang-Zuordnung bei neuen Kills:** Erst verifizierbar wenn monsterReference korrekt laedt. Neue Kills sollten dann echte Monsternamen und korrekte Raenge bekommen
- **Bestehende State-Daten:** Profil `kzvpvt5o` hat 17 Kills mit Token-Namen (`Lv4-electricity` etc.) und `rank: "unknown"`. Diese sind nicht rueckwirkend korrigierbar — nur Reset oder neue Kills loesen das
- **Debug-Zeile entfernen:** Sobald alles funktioniert, Debug-Info aus `renderMonsters()` entfernen

---

## Architektur-Notizen

### Plugin-Ladepfade
- **Entwicklung:** `C:\Entwicklung\FlyffU-Launcher\plugins\killfeed\`
- **Runtime (AppData):** `C:\Users\Daniel\AppData\Roaming\Flyff-U-Launcher\plugins\killfeed\`
- **Plugin-Daten:** `C:\Users\Daniel\AppData\Roaming\Flyff-U-Launcher\plugin-data\killfeed\`
- State-Dateien: `state_{profileId}.json` (z.B. `state_kzvpvt5o.json`)

### Kill-Detection Flow
```
OCR Snapshot → monsterName (Token wie "Lv4-electricity")
  → parseMonsterToken() → {level, element}
  → findMonsterByLevelElement() → monsterCandidate (inkl. rank)
  → monsterMeta wird erstellt
  → stats_engine.update() → deltaExp Erkennung
  → registerKill(deltaExp, resolvedName, timestamp, monsterMeta)
  → getMonsterRank(name, monsterMeta) → Rang-Kategorie
```

### Sidepanel Profil-Binding
```
iframe srcdoc geladen → init() laeuft
  → __overlayTargetId noch NICHT gesetzt (Race Condition!)
  → Workaround: IPC panel:get:active-profile
  → main.js trackt lastActiveProfileId bei jedem OCR-Event
  → Sidepanel fragt aktives Profil per IPC ab
```

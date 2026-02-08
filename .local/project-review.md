# FlyffU-Launcher - Project Review

## Zusammenfassung

Der **FlyffU-Launcher** ist ein ausgereifter Electron-basierter Multi-Instanz-Game-Launcher fuer Flyff Universe, entwickelt mit TypeScript, Vite und Electron Forge. Version **2.2.0**, Branch `2.0.3`.

---

## 1. Tech Stack

| Kategorie | Technologie | Version |
|-----------|------------|---------|
| Framework | Electron | 39.2.7 |
| Sprache | TypeScript | ~5.7.2 |
| Build Tool | Vite | 5.4.21 |
| Packaging | Electron Forge | 7.10.2 |
| Validierung | Zod | 4.2.1 |
| Auto-Update | electron-updater | 6.7.3 |
| Testing | Vitest | 4.0.16 |
| Linting | ESLint | 8.57.1 |

---

## 2. Architektur

### Prozessmodell (Electron)

```
Main Process (main.ts)
  ├── Core Services (coreServices.ts)
  │     ├── Profile Store
  │     ├── Tab Layout Store
  │     ├── Theme Store
  │     ├── Client Settings Store
  │     ├── Session Tabs Manager
  │     ├── Session Registry
  │     ├── Instance Registry
  │     └── ROI Store/Controller
  ├── IPC Handlers (16 Handler-Module)
  ├── Window Management
  │     ├── Launcher Window
  │     ├── Session Window (Tabs)
  │     ├── Instance Window
  │     ├── Overlay Window
  │     ├── Side Panel Window
  │     └── ROI Calibrator Window
  └── Plugin System

Preload Script (preload.ts)
  └── Context Bridge (Channel-Allowlist)

Renderer Process (renderer.ts, ~14.000 Zeilen)
  └── Frontend UI (HTML/CSS/JS)
```

### IPC-Kommunikation

- **50+ Channels** zentralisiert in `ipcChannels.ts`
- **Safe Wrapper Pattern**: `createSafeHandler()` fuer konsistentes Error-Handling
- **Response-Format**: `{ok: true, data: T}` oder `{ok: false, error: string}`
- Handler sind nach Feature in `handlers/` organisiert (Profiles, Sessions, Layouts, Themes, etc.)

---

## 3. Projektstruktur

```
app/
├── src/
│   ├── main/                    # Electron Main Process
│   │   ├── coreServices.ts      # Service-Factory
│   │   ├── ipc/
│   │   │   ├── common.ts        # IPC Utilities
│   │   │   ├── registerMainIpc.ts
│   │   │   └── handlers/        # 16 Handler-Module + Tests
│   │   ├── windows/             # 10 Window-Module
│   │   ├── sessionTabs/         # Multi-View Layout Manager
│   │   ├── clientSettings/      # Settings Store
│   │   ├── profiles/            # Profil-Verwaltung
│   │   ├── plugin/              # Plugin-System
│   │   ├── roi/                 # Region of Interest
│   │   ├── ocr/                 # OCR-Funktionalitaet
│   │   ├── features/            # Feature Flags
│   │   └── security/            # Security Hardening
│   ├── shared/                  # Geteilter Code (Main + Renderer)
│   │   ├── schemas.ts           # Zod-Schemas
│   │   ├── constants.ts         # Konstanten
│   │   ├── ipcChannels.ts       # Channel-Definitionen
│   │   ├── hotkeys.ts           # Hotkey-System
│   │   ├── fileStore.ts         # Datei-Persistierung
│   │   └── 12 Test-Dateien
│   ├── themes/                  # 17 Themes + CSS
│   ├── assets/                  # Icons, Settings-UI
│   ├── i18n/                    # Uebersetzungen (8 Sprachen)
│   ├── main.ts                  # Haupt-Einstiegspunkt (~2.325 Zeilen)
│   ├── main-plugin.ts           # Plugin-Einstiegspunkt (~548 Zeilen)
│   ├── renderer.ts              # Renderer (~13.995 Zeilen)
│   ├── preload.ts               # Context Bridge
│   └── index.css                # Globale Styles (~63 KB)
├── patchnotes/                  # Changelogs (8 Sprachen)
├── forge.config.ts              # Build-Konfiguration
└── package.json
```

---

## 4. Features

### Profil-Management
- Erstellen, Bearbeiten, Loeschen, Klonen, Sortieren von Profilen
- Pro Profil: Job-Klasse, Launch-Modus (Tabs/Fenster), Overlay-Einstellungen, Hotkeys

### Multi-Instanz & Session Tabs
- Mehrere Game-Clients gleichzeitig in Tabs oder separaten Fenstern
- Layouts: Single, Split-2, Row-3/4, Grid-4/5/6/7/8 (bis zu 8 Views)
- Isolierte Session-Partitionen pro Profil (Cookies/Storage)
- Sequentielles Grid-Loading mit konfigurierbarem Delay

### Layout-System
- Speichern/Laden benutzerdefinierter Fenster-Layouts
- Persistierung von Profil-Anordnung und Split-Ratios
- Auto-Save-Option
- Mehrere Anzeige-Modi (compact, chips, mini-grid)

### Theme-System
- 17 eingebaute Themes (toffee, zimt, flyff-gold, cyberpunk, steel-ruby, etc.)
- Custom-Theme-Erstellung mit Color Picker
- Individuelle CSS-Stylesheets pro Theme
- Aktive-Tab-Farb-Anpassung, Animationen

### Internationalisierung (i18n)
- 8 Sprachen: EN, DE, PL, FR, RU, TR, CN, JP
- Umfassendes Uebersetzungssystem in `translations.ts`

### Overlay & ROI
- Region of Interest Kalibrierung fuer Game-UI-Elemente
- Konfigurierbare Overlay-Anzeigen (EXP, Kills, Timer)
- Hotkey-Support fuer Overlay-Toggle
- Side Panel fuer Schnellzugriff

### Plugin-System
- Plugins aus `userData/plugins/` ladbar
- Standard-Plugins: api-fetch, cd-timer, killfeed
- Plugin Discovery, Enable/Disable, Start/Stop, Reload
- State Management und Settings-UI

### Auto-Update
- electron-updater Integration mit GitHub Releases
- latest.yml-Generierung fuer Update-Checks

---

## 5. Sicherheit

| Massnahme | Status |
|-----------|--------|
| Context Isolation | Aktiv |
| Node Integration im Renderer | Deaktiviert |
| Preload Channel-Allowlist | Aktiv |
| Content Security Policy (CSP) | Aktiv |
| ASAR Integrity Validation | Aktiv (Fuses) |
| Cookie Encryption | Aktiv (Fuses) |
| Input-Validierung (Zod) | Aktiv |
| Safe Error Wrapping (keine Stack-Traces) | Aktiv |

Die Sicherheitsarchitektur folgt Electron Best Practices konsequent.

---

## 6. Test-Abdeckung

**16 Test-Dateien** vorhanden:

| Modul | Test-Datei |
|-------|-----------|
| Schemas | `schemas.test.ts` |
| Hotkeys | `hotkeys.test.ts` |
| Layouts | `layouts.test.ts` |
| Sessions | `sessions.test.ts` |
| Profiles | `profiles.test.ts` |
| Themes | `themes.test.ts` |
| ROI | `roi.test.ts` |
| FileStore | `fileStore.test.ts` |
| Constants | `constants.test.ts` |
| Logger | `logger.test.ts` |
| Utils | `utils.test.ts` |
| PluginStates | `pluginStates.test.ts` |

Test-Framework: Vitest mit Coverage (v8) und UI-Dashboard.

---

## 7. Staerken

1. **Starke Typsicherheit**: Zod-Schemas fuer Runtime-Validierung in Kombination mit TypeScript
2. **Klare Modularitaet**: Saubere Trennung nach Features (IPC-Handler, Windows, Services)
3. **Konsistentes Error-Handling**: Safe-Wrapper-Pattern fuer alle IPC-Handler
4. **Gute Test-Abdeckung**: 16 Test-Dateien fuer alle kritischen Module
5. **Security Hardening**: CSP, Context Isolation, ASAR Integrity, Cookie Encryption
6. **Rueckwaertskompatibilitaet**: Legacy-Hotkey-Migration, Split-Layout-Kompatibilitaet
7. **Erweiterbarkeit**: Plugin-System fuer Community-Erweiterungen
8. **Umfangreiche i18n**: 8 Sprachen vollstaendig unterstuetzt
9. **Service-Factory-Pattern**: Saubere Dependency Injection ueber `coreServices.ts`

---

## 8. Verbesserungspotenzial

### Hoch

| Thema | Beschreibung |
|-------|-------------|
| **renderer.ts (~14.000 Zeilen)** | Die Datei ist extrem gross und sollte in kleinere, feature-basierte Module aufgeteilt werden (z.B. UI-Komponenten, Event-Handler, State-Management). |
| **main.ts (~2.325 Zeilen)** | Ebenfalls sehr umfangreich; weitere Extraktion von Logik in dedizierte Module wuerde die Wartbarkeit verbessern. |
| **index.css (~63 KB)** | Monolithisches Stylesheet. Aufteilen in Theme-Module, Layout-Styles und Komponenten-Styles waere sinnvoll. |

### Mittel

| Thema | Beschreibung |
|-------|-------------|
| **Globaler State im Main Process** | Mehrere globale Singletons; koennten staerker ueber Registries/DI verwaltet werden. |
| **Dual Entry Points** | `main.ts` und `main-plugin.ts` als separate Einstiegspunkte deuten auf gewachsene Architektur hin; Konsolidierung pruefen. |
| **Async-Komplexitaet** | Einige komplexe Promise-Chains koennten durch klarere async/await-Patterns vereinfacht werden. |

### Niedrig

| Thema | Beschreibung |
|-------|-------------|
| **ESLint-Version** | ESLint 8.57.1 - Migration auf ESLint 9 (Flat Config) pruefen. |
| **Renderer-Framework** | Kein dediziertes UI-Framework (React/Vue/Svelte) erkennbar im Renderer - bei weiterem Wachstum der UI koennte ein Framework die Komplexitaet reduzieren. |

---

## 9. Konfiguration & Build

### Plattform-Support

| Plattform | Format |
|-----------|--------|
| Windows | Squirrel, WIX MSI |
| Linux | DEB, RPM |
| macOS | ZIP |

### Ressourcen-Bundling

- Patchnotes (alle Sprachen)
- Dokumentation
- Tesseract OCR-Daten
- Standard-Plugins (api-fetch, cd-timer, killfeed)
- App-Icon (`flyff.ico`)

### Window-Dimensionen

| Fenster | Groesse |
|---------|---------|
| Launcher | 1200x970 (min 880x540, max 2560x1440) |
| Session | 1380x860 |
| Side Panel | 420px Breite |
| Grid Gap | 8px |
| Min Cell | 200x150px |

---

## 10. Fazit

Das Projekt zeigt solide Software-Engineering-Praktiken mit klarer Service-Architektur, umfangreichen Tests, typsicheren Schemas und konsequentem Security-Hardening. Die Hauptherausforderung liegt in der Groesse einzelner Dateien (`renderer.ts`, `main.ts`, `index.css`), die bei weiterem Wachstum die Wartbarkeit beeintraechtigen koennten. Die Feature-Dichte ist beeindruckend - Multi-Instanz-Support, Plugin-System, 17 Themes, 8 Sprachen und OCR/Overlay-Funktionalitaet in einem Desktop-Launcher.

**Gesamtbewertung**: Gut strukturiertes, feature-reiches Electron-Projekt mit klarem Verbesserungspotenzial bei der Modularisierung der groessten Dateien.

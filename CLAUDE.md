# Project Guidelines

## Cross-Platform Requirement

All features MUST work on **Windows**, **macOS**, and **Linux**. When writing new code:

- Never use Windows-specific APIs (registry, DWM, COM) without a `process.platform === "win32"` guard
- Never hardcode `.exe` extensions — use `process.platform === "win32" ? "name.exe" : "name"`
- Always use `path.join()` / `path.resolve()` / `path.delimiter` instead of hardcoded path separators
- Use `process.env.HOME` or `app.getPath()` instead of `APPDATA` / `LOCALAPPDATA` (Windows-only env vars)
- Test file paths case-sensitively (macOS/Linux filesystems are case-sensitive)
- For native binaries: provide platform-specific variants under `app/resources/<tool>/<platform>/`
- Electron Forge makers must include: Squirrel (Windows), DMG (macOS), DEB/RPM (Linux) — AppImage ist deaktiviert (siehe Stolperfallen)

## GitHub Workflow Release Process

**Wichtig: Jeder GitHub Workflow soll Updates für alle drei Plattformen bereitstellen, aber zuerst als Draft!**

### Workflow-Konfiguration

Alle GitHub Workflows für Releases müssen:
1. **Alle drei Plattformen bauen**: Windows, macOS, Linux
2. **Draft Release erstellen**: Kein automatisches Update für User
3. **Update-Manifeste inkludieren**: `latest.yml`, `latest-mac.yml`, `latest-linux.yml`

### Release-Prozess

1. **Workflow starten** → Erstellt einen Draft-Release mit allen Builds
2. **Dateien herunterladen** → Testen auf allen Plattformen
3. **Wenn alles passt** → Draft auf Release umstellen
4. **Update verfügbar** → User bekommen automatisch das Update (via electron-updater)

### Workflow-Ausführung

Der primäre Workflow für Draft-Releases ist **"Draft Release (All Platforms)"** (`macos-draft.yml`):

```bash
gh workflow run "Draft Release (All Platforms)" \
  -f tag_name=v3.0.0 \
  -f create_release=true \
  -f release_draft=true \
  -f prerelease=true \
  -f run_tests=false
```

### Bekannte Stolperfallen im Release-Workflow

1. **AppImage ist deaktiviert** — Der `@reforged/maker-appimage` hat Strukturprobleme mit Electron Forge und ist in `forge.config.ts` auskommentiert. Workflows dürfen **keine `.AppImage`-Dateien erwarten** (kein `fail_on_unmatched_files: true` für AppImage).

2. **Doppelte `latest-mac.yml`** — Der `postMake`-Hook in `forge.config.ts` erzeugt für jeden macOS-Maker (DMG + ZIP) eine eigene `latest-mac.yml`. Der Release-Job sammelt deshalb alle Artifacts mit `find ... -exec cp -f {} release-assets/` in einen flachen Ordner, damit Duplikate automatisch überschrieben werden. **Niemals `softprops/action-gh-release` verwenden** — stattdessen `gh release create` mit dem flachen `release-assets/`-Ordner nutzen.

3. **`gh release create` braucht ein Git-Repo** — Der Release-Job muss einen `actions/checkout@v4`-Schritt enthalten, sonst schlägt `gh` mit `fatal: not a git repository` fehl.

4. **Fehlgeschlagene Drafts aufräumen** — Vor einem erneuten Workflow-Run den alten Draft löschen:
   ```bash
   gh release delete v3.0.0 --yes
   ```

## Branch-Struktur

- **live** → Produktiver Branch (für Releases)
- **dev** → Entwicklung/Test Branch
- **main** → Nicht vorhanden (wurde entfernt)

## GitHub Workflow Testing

**Wichtig: GitHub Actions liest Workflows IMMER vom Default-Branch (live)!**

### Workflow-Änderungen testen ohne live zu verändern

Um Workflow-Änderungen im dev Branch zu testen, ohne den live Branch zu verändern:

1. **Default-Branch vorübergehend auf dev ändern**
   ```bash
   gh repo edit GH-Praxa/Flyff-U-Launcher --default-branch dev
   ```

2. **Workflow testen** (er wird jetzt aus dev ausgeführt)
   ```bash
   gh workflow run release.yml -f tag_name=v2.9.3 -f release_draft=true
   ```

3. **Nach erfolgreichem Test: Default-Branch wieder auf live setzen**
   ```bash
   gh repo edit GH-Praxa/Flyff-U-Launcher --default-branch live
   ```

4. **Wenn Workflow korrekt ist**: Änderungen von dev nach live mergen

**Merke: Jeder Workflow-Aufruf verwendet den Workflow aus dem Default-Branch, nicht aus dem auslösenden Branch!**

## Git Commit Guidelines

**Wichtig: Bei GitHub Pushes, Pull Requests und automatisierten Commits:**

- **Keine Patchnotes** in Commit Messages hinzufügen
- **Kein "Co-Authored-By"** Tag setzen (dieser ist nur für manuelle Commits gedacht)

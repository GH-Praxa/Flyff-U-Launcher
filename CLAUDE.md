# Project Guidelines

## Cross-Platform Requirement

All features MUST work on **Windows**, **macOS**, and **Linux**. When writing new code:

- Never use Windows-specific APIs (registry, DWM, COM) without a `process.platform === "win32"` guard
- Never hardcode `.exe` extensions — use `process.platform === "win32" ? "name.exe" : "name"`
- Always use `path.join()` / `path.resolve()` / `path.delimiter` instead of hardcoded path separators
- Use `process.env.HOME` or `app.getPath()` instead of `APPDATA` / `LOCALAPPDATA` (Windows-only env vars)
- Test file paths case-sensitively (macOS/Linux filesystems are case-sensitive)
- For native binaries: provide platform-specific variants under `app/resources/<tool>/<platform>/`
- Electron Forge makers must include: Squirrel (Windows), DMG (macOS), DEB/RPM/AppImage (Linux)

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

```bash
# Draft-Release über Workflow Dispatch starten
gh workflow run release.yml -f tag_name=v2.9.3 -f release_draft=true -f prerelease=true
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

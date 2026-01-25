# Auto-Update Implementierung

Dieses Dokument beschreibt die Implementierung der automatischen Update-Funktionalität für den Flyff-U-Launcher.

## Übersicht

- **Update-Quelle**: GitHub Releases
- **Bibliothek**: `electron-updater`
- **User-Interaktion**: Dialog fragt User ob Update installiert werden soll
- **Build-Automatisierung**: GitHub Actions

---

## Schritt 1: Abhängigkeiten installieren

```bash
cd app
npm install electron-updater
npm install -D @electron-forge/publisher-github
```

---

## Schritt 2: package.json anpassen

Repository-Informationen hinzufügen:

```json
{
  "name": "Flyff-U-Launcher",
  "version": "2.0.1",
  "repository": {
    "type": "git",
    "url": "https://github.com/DEIN_USERNAME/FlyffU-Launcher.git"
  }
}
```

---

## Schritt 3: forge.config.ts - Publisher hinzufügen

Am Anfang der Datei den Import hinzufügen:

```typescript
import { PublisherGithub } from "@electron-forge/publisher-github";
```

In der `config` den `publishers` Array hinzufügen (nach `plugins`):

```typescript
const config: ForgeConfig = {
    packagerConfig: { /* ... */ },
    rebuildConfig: {},
    makers: [ /* ... */ ],
    plugins: [ /* ... */ ],
    publishers: [
        new PublisherGithub({
            repository: {
                owner: "DEIN_GITHUB_USERNAME",
                name: "FlyffU-Launcher"
            },
            prerelease: false,
            draft: true
        })
    ]
};
```

---

## Schritt 4: main.ts - Auto-Updater integrieren

### 4.1 Import hinzufügen

Nach den bestehenden Imports:

```typescript
import { autoUpdater } from "electron-updater";
```

**Hinweis**: `dialog` ist bereits importiert aus "electron".

### 4.2 Auto-Updater Logik einfügen

Am Ende von `app.whenReady()`, nach der launcherWindow Erstellung (~Zeile 1930):

```typescript
// =========================================================================
// Auto-Update (nur in Production)
// =========================================================================
if (app.isPackaged) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("update-available", async (info) => {
        const result = await dialog.showMessageBox({
            type: "info",
            title: "Update verfügbar",
            message: `Eine neue Version (${info.version}) ist verfügbar.`,
            detail: "Möchtest du das Update jetzt herunterladen?",
            buttons: ["Ja, herunterladen", "Später"],
            defaultId: 0,
            cancelId: 1
        });

        if (result.response === 0) {
            autoUpdater.downloadUpdate();
        }
    });

    autoUpdater.on("download-progress", (progress) => {
        const percent = Math.round(progress.percent);
        logWarn(`Download-Fortschritt: ${percent}%`, "AutoUpdater");
    });

    autoUpdater.on("update-downloaded", async () => {
        const result = await dialog.showMessageBox({
            type: "info",
            title: "Update bereit",
            message: "Das Update wurde heruntergeladen.",
            detail: "Die App wird jetzt neu gestartet, um das Update zu installieren.",
            buttons: ["Jetzt neu starten", "Später"],
            defaultId: 0,
            cancelId: 1
        });

        if (result.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });

    autoUpdater.on("error", (err) => {
        logErr(err, "AutoUpdater");
    });

    // Prüfe auf Updates beim Start
    autoUpdater.checkForUpdates().catch((err) => {
        logErr(err, "AutoUpdater");
    });
}
```

---

## Schritt 5: GitHub Actions Workflow erstellen

Erstelle die Datei `.github/workflows/release.yml`:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: app/package-lock.json

      - name: Install dependencies
        working-directory: app
        run: npm ci

      - name: Build and Publish
        working-directory: app
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm run publish

  # Optional: macOS Build
  # build-macos:
  #   runs-on: macos-latest
  #   steps: ...
```

---

## Schritt 6: Erstes Release erstellen

### 6.1 Lokaler Test

```bash
cd app
npm run make
```

Prüfe ob der Build erfolgreich ist.

### 6.2 Version und Release

```bash
# Version in package.json erhöhen (z.B. 2.0.2)
# Dann:
git add .
git commit -m "feat: Add auto-update functionality"
git tag v2.0.2
git push origin 1.0
git push origin v2.0.2
```

### 6.3 Release veröffentlichen

1. Gehe zu GitHub → Repository → Releases
2. Der Draft-Release wurde automatisch erstellt
3. Release Notes hinzufügen
4. "Publish release" klicken

---

## Dateiübersicht

| Datei | Änderung |
|-------|----------|
| `app/package.json` | + repository, + electron-updater |
| `app/forge.config.ts` | + PublisherGithub |
| `app/src/main.ts` | + autoUpdater Logik |
| `.github/workflows/release.yml` | Neue Datei |

---

## Testen

1. **Alte Version installieren**: Installiere die aktuelle Version (z.B. 2.0.1)
2. **Neue Version veröffentlichen**: Erstelle Release v2.0.2 auf GitHub
3. **App starten**: Starte die alte Version
4. **Update-Dialog**: Es sollte ein Dialog erscheinen "Update verfügbar"
5. **Download**: Klicke "Ja, herunterladen"
6. **Installation**: Nach Download erscheint "Update bereit - Jetzt neu starten?"
7. **Neustart**: App startet mit neuer Version

---

## Troubleshooting

### Update wird nicht erkannt
- Prüfe ob die Version in `package.json` korrekt erhöht wurde
- Prüfe ob das Release auf GitHub veröffentlicht (nicht Draft) ist
- Prüfe die Netzwerkverbindung

### Build schlägt fehl
- Prüfe ob alle Dependencies installiert sind
- Prüfe die GitHub Actions Logs

### Fehler beim Download
- Der `autoUpdater.on("error")` Handler loggt den Fehler
- Prüfe die Konsole/Logs der App

---

## Erweiterte Optionen

### Update-Intervall anpassen

```typescript
// Prüfe alle 4 Stunden auf Updates
setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => logErr(err, "AutoUpdater"));
}, 4 * 60 * 60 * 1000);
```

### Download-Fortschritt in der UI anzeigen

```typescript
autoUpdater.on("download-progress", (progress) => {
    // Sende an Renderer-Prozess
    if (launcherWindow && !launcherWindow.isDestroyed()) {
        launcherWindow.webContents.send("update:progress", {
            percent: progress.percent,
            transferred: progress.transferred,
            total: progress.total
        });
    }
});
```

### Manueller Update-Check

IPC Handler für manuellen Check aus der UI:

```typescript
ipcMain.handle("update:check", async () => {
    try {
        const result = await autoUpdater.checkForUpdates();
        return { available: !!result?.updateInfo };
    } catch (err) {
        return { available: false, error: err.message };
    }
});
```
# Release Guide

Ab Version 2.0.16 unterstützt der Launcher automatische Updates. Diese Anleitung beschreibt die Schritte für neue Releases.

## Neues Release erstellen

### 1. Version in package.json erhöhen

```bash
# In app/package.json die Version erhöhen
"version": "2.0.17"  # Beispiel
```

### 2. Änderungen committen

```bash
git add .
git commit -m "Beschreibung der Änderungen"
```

### 3. Git Tag erstellen und pushen

```bash
git tag v2.0.17
git push origin <branch>
git push origin v2.0.17
```

### 4. GitHub Actions abwarten

- Der Tag-Push triggert automatisch den Build-Workflow
- Status prüfen: https://github.com/GH-Praxa/Flyff-U-Launcher/actions
- Das Release wird als **Draft** erstellt

### 5. Release veröffentlichen

1. Gehe zu https://github.com/GH-Praxa/Flyff-U-Launcher/releases
2. Finde das Draft-Release (v2.0.17)
3. Klicke auf "Edit"
4. Füge Release Notes hinzu (optional)
5. Klicke auf "Publish release"

## Wichtige Hinweise

- **Tag-Format**: Muss mit `v` beginnen (z.B. `v2.0.17`)
- **Draft-Release**: Wird von GitHub Actions erstellt, muss manuell veröffentlicht werden
- **latest.yml**: Wird automatisch generiert und enthält SHA512-Hash für sichere Updates

## Auto-Update Ablauf

1. Launcher prüft beim Start auf neue Version
2. Vergleicht mit `latest.yml` auf GitHub Releases
3. Zeigt Dialog "Update verfügbar" an
4. Download-Fortschritt in Taskleiste sichtbar
5. Automatischer Neustart nach Download

## Dateien die für Updates relevant sind

| Datei | Zweck |
|-------|-------|
| `app/package.json` | Enthält die Versionsnummer |
| `app/resources/app-update.yml` | GitHub Provider-Konfiguration |
| `app/forge.config.ts` | Build-Konfiguration, erstellt `latest.yml` |
| `.github/workflows/release.yml` | GitHub Actions Workflow |

## Fehlerbehebung

### Update wird nicht erkannt
- Prüfen ob Release veröffentlicht ist (nicht Draft)
- Prüfen ob `latest.yml` im Release vorhanden ist
- Launcher neu starten

### Download schlägt fehl
- Internetverbindung prüfen
- GitHub-Status prüfen: https://www.githubstatus.com/

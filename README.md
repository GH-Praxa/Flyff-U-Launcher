# Flyff-U-Launcher

Electron Forge + Vite launcher for Flyff with overlay, ROI calibration, and optional OCR support. Main-process logic lives under `app/src/main`, while the UI is driven by `app/src/renderer.ts` and shared styles in `app/src/index.css`. Packaging and scripts are scoped to the `app/` workspace.

## Features
- Launcher UI with session/instance windows and overlay controls.
- Electron Forge build chain with Vite for renderer/main/preload bundles.

## Aktuelle Features

- Profile & Tabs/Fenster: Mehrere Chars bequem in Tabs oder separaten
  Fenstern verwalten.
- Split-Screen im Tab-Modus: Zwei Tabs nebeneinander, aktives Fenster per
  Hover wechselbar.
- Tab-Layouts speichern/laden: Eure Tab-Anordnung sichern und per Klick
  wiederherstellen.
- Quick-Links: Direkt zu Flyff Universe, Flyffipedia, Flyffulator,
  Skillulator.
- News-Feed: Updates, Events und Item Shop News aus dem offiziellen Portal.
- Auto-Update-Hinweis: GitHub-Button zeigt neue Launcher-Versionen an.

## Geplant / Ideen
Teilweise warte ich noch auf das OK der Devs/GMs:

- Killcounter via Bild-/Texterkennung: Gesamt-Kills, EXP/h, Kills/Lifetime sowie weitere optionale Anzeigen;
  als Overlay im Spielfenster.
- Buff-Wecker: Erkennung per Template-Bildern, zeigt ein Overlay in der
  Bildschirmmitte, falls ein Buff/PowerUp aus gewÇ¬nschter Liste fehlt (keine Eingriffe/Klick-Automation,
  nur Anzeige).
- Quest-Overlay: NÇÏchste annehmbare Quests mit Name, EXP, Button fÇ¬r eine
  Map-View mit Marker. auf englisch

## Prerequisites
- Node.js (18+ recommended) and npm.
- For OCR: Python 3 with `pip`, plus Tesseract available on `PATH`.
- Windows is the primary target (uses Electron with native overlay windows).

## Quickstart
```bash
cd app
npm install
npm run start
```

## Development & Quality
- `npm run start` ƒ?" Launch Electron Forge + Vite dev servers.
- `npm run lint` ƒ?" ESLint on `.ts/.tsx` sources.

## Packaging & Distribution
- `npm run package` ƒ?" Unpackaged build.
- `npm run make` ƒ?" Platform-specific distributables.
- `npm run publish` ƒ?" Publish via Electron Forge publishers.
- Vite output lives in `app/.vite/build/` (kept out of git).


## Project Structure
- `app/` ƒ?" Electron Forge + Vite project (run all npm commands here).
- `app/src/main/` ƒ?" Windows/controllers, session tabs, overlay targets, ROI capture, IPC wiring.
- `app/src/preload.ts` ƒ?" Preload bridge.
- `app/src/renderer.ts` ƒ?" Launcher UI entry; shared styling in `app/src/index.css`; React/TSX experiments under `app/src/ui/`.
- `app/src/main/expOverlay` & `app/src/main/roi` ƒ?" Overlay and calibration logic.
- `app/ocr/ocr_worker.py` ƒ?" OCR worker.
- Config: `.eslintrc.json`, `tsconfig.json`, `forge.config.ts`.

## Configuration Notes
- Environment: `FLYFF_OCR_PYTHON` for custom Python path; ensure `PATH` includes Tesseract.
- Runtime screenshots/crops go to the Electron `userData` path (not versioned).

## Release
- Current release: `v1.0.0` (branch `1.0`).

## License
MIT (see `package.json`).

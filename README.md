# Flyff-U-Launcher

Electron Forge + Vite launcher for Flyff with overlay, ROI calibration, and optional OCR support. Main-process logic lives under `app/src/main`, while the UI is driven by `app/src/renderer.ts` and shared styles in `app/src/index.css`. Packaging and scripts are scoped to the `app/` workspace.

## Features
- Launcher UI with session/instance windows and overlay controls.
- Electron Forge build chain with Vite for renderer/main/preload bundles.

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
- `npm run start` — Launch Electron Forge + Vite dev servers.
- `npm run lint` — ESLint on `.ts/.tsx` sources.

## Packaging & Distribution
- `npm run package` — Unpackaged build.
- `npm run make` — Platform-specific distributables.
- `npm run publish` — Publish via Electron Forge publishers.
- Vite output lives in `app/.vite/build/` (kept out of git).

## OCR Setup (optional)
```bash
cd app
pip install -r ocr/requirements.txt
```
Ensure `tesseract` is on `PATH`. Set `FLYFF_OCR_PYTHON` to point to a specific Python interpreter if needed.

## Project Structure
- `app/` — Electron Forge + Vite project (run all npm commands here).
- `app/src/main/` — Windows/controllers, session tabs, overlay targets, ROI capture, IPC wiring.
- `app/src/preload.ts` — Preload bridge.
- `app/src/renderer.ts` — Launcher UI entry; shared styling in `app/src/index.css`; React/TSX experiments under `app/src/ui/`.
- `app/src/main/expOverlay` & `app/src/main/roi` — Overlay and calibration logic.
- `app/ocr/ocr_worker.py` — OCR worker.
- Config: `.eslintrc.json`, `tsconfig.json`, `forge.config.ts`.

## Configuration Notes
- Environment: `FLYFF_OCR_PYTHON` for custom Python path; ensure `PATH` includes Tesseract.
- Runtime screenshots/crops go to the Electron `userData` path (not versioned).

## Release
- Current release: `v1.0.0` (branch `1.0`).

## License
MIT (see `package.json`).

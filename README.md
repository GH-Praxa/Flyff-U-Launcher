# Unofficial Flyff-U-Launcher

Electron Forge + Vite launcher for Flyff Universe

## Features
- Launcher UI with session/instance windows and overlay controls.

## Prerequisites
- Node.js (18+ recommended) and npm.

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


## Project Structure
- `app/` — Electron Forge + Vite project (run all npm commands here).
- `app/src/main/` — Windows/controllers, session tabs, overlay targets, ROI capture, IPC wiring.
- `app/src/preload.ts` — Preload bridge.
- `app/src/renderer.ts` — Launcher UI entry; shared styling in `app/src/index.css`; React/TSX experiments under `app/src/ui/`.
- Config: `.eslintrc.json`, `tsconfig.json`, `forge.config.ts`.


## Release
- Current release: `v1.1.0`.

## License
MIT (see `package.json`).

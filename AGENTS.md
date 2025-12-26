commite und # Repository Guidelines

## Project Structure & Module Organization
- `app/` holds the Electron Forge + Vite project; run all npm commands here.
- `app/src/main/` contains main-process controllers for windows, session tabs, overlay targets, ROI capture, and IPC wiring; preload glue lives in `app/src/preload.ts`.
- `app/src/renderer.ts` drives the launcher UI; shared styling is in `app/src/index.css`; experimental React/TSX pieces sit in `app/src/ui/`.
- OCR/overlay pipeline sits in `app/src/main/expOverlay` with calibration logic in `app/src/main/roi`; the Python worker is `app/ocr/ocr_worker.py`.
- Config and build artifacts: `.eslintrc.json`, `tsconfig.json`, `forge.config.ts`; Vite output lands in `app/.vite/build/` (do not commit).

## Build, Test, and Development Commands
- Install deps (from `app/`): `npm install` (or `npm ci`).
- Dev run: `npm run start` (Electron Forge + Vite dev server).
- Lint: `npm run lint` (ESLint on `.ts/.tsx`).
- Packaging: `npm run make` for distributables; `npm run package` for unpackaged builds; `npm run publish` for Forge publishers.
- OCR stack: `pip install -r app/ocr/requirements.txt` and ensure `tesseract` is on `PATH`; set `FLYFF_OCR_PYTHON` to point to a specific interpreter if needed.

## Coding Style & Naming Conventions
- TypeScript-first; `noImplicitAny` is enabled—add explicit types for IPC payloads and window configs.
- Prefer 2-space indent, double quotes, trailing semicolons; mirror existing import ordering.
- Name main-process constructs as factories/controllers (`create...Controller`, `...Window`); keep shared shapes in `app/src/shared/types.ts` and preload types in `app/src/forge.env.d.ts`.
- Run `npm run lint` before committing; add brief comments only for non-obvious flows (window lifecycle, overlay refresh, ROI math).

## Testing Guidelines
- No automated test suite yet; do manual smoke tests via `npm run start` (profile CRUD, tab vs window launch, ROI calibrator open/save, overlay refresh, side panel follow behavior).
- If adding tests, colocate by module and use `*.spec.ts`; prioritize unit coverage for ROI computations, IPC handlers, and profile store logic.

## Commit & Pull Request Guidelines
- Follow Conventional Commits as in history (`feat(overlay): ...`, `chore: ...`, `release vX.Y.Z`).
- PRs should include a short summary, linked issue/ticket, and validation steps; UI/overlay changes should add screenshots or notes about manual checks and platforms.
- Keep changes focused; avoid committing build artifacts or userData outputs (e.g., cropped PNGs).

## Security & Configuration Tips
- Do not hardcode credentials or local paths; rely on env vars (`FLYFF_OCR_PYTHON`, `PATH` for Tesseract).
- Runtime screenshots/crops go to `app.getPath("userData")`; keep them local and out of version control.

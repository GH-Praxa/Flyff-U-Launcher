# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flyff-U-Launcher is an Electron desktop application serving as a multi-instance launcher for Flyff Universe. It features tab management, overlay HUD for tracking kills/experience, ROI calibration, buff detection via OCR, and a theming system.

**Stack:** Electron 39 + TypeScript + Vite 5 + Electron Forge 7

## Development Commands

All commands run from the `app/` directory:

```bash
npm install              # Install dependencies
npm start                # Launch dev server with hot reload
npm run lint             # ESLint on .ts/.tsx files
npm run package          # Build unpackaged app
npm run make             # Build platform installers (MSI, EXE, etc.)
```

## Architecture

### Process Model

```
Launcher UI (renderer.ts) ↔ IPC Bridge (preload.ts) ↔ Main Process (main.ts)
                                                            ↓
                                              ┌─────────────┼─────────────┐
                                              ↓             ↓             ↓
                                       SessionWindow  InstanceWindow  Overlays
                                       (BrowserViews)  (per profile)   (HUD)
                                                                         ↓
                                                              Python OCR Worker
```

### Key Modules (app/src/main/)

- **windows/**: Window controllers (launcher, session, instance, overlay, roi-calibrator)
- **sessionTabs/manager.ts**: Tab management with split-screen support and layout persistence
- **profiles/**: JSON-based profile storage (userData/profiles.json)
- **roi/**: Region of Interest calibration for HUD element extraction
- **expOverlay/**: Experience/kill overlay with OCR integration (800ms polling)
- **ocr/pythonWorker.ts**: Python subprocess for digit/line extraction
- **security/harden.ts**: WebView restrictions, navigation guards, CSP

### IPC Contract

The preload bridge (`preload.ts`) exposes `window.api` with typed methods for:
- Profile CRUD and overlay target selection
- Session tab operations (open, switch, split, bounds)
- Layout save/load/apply
- ROI calibration tools
- Theme management
- Buff-Wecker integration

Types are defined in `forge.env.d.ts`.

### Data Storage

All JSON files in Electron userData path:
- `profiles.json`: User profiles with overlay settings
- `themes.json`: Custom theme definitions
- `rois.json`: Calibrated HUD region coordinates
- `tabActiveColor.json`: Active tab highlight color
- `themeSnapshot.json`: Last applied theme state

## Key Patterns

- **Factory Functions**: Services use `create*` pattern (e.g., `createProfileStore`, `createThemeStore`)
- **Lazy Module Loading**: Buff-Wecker loaded via dynamic import with fallback paths
- **Normalized Coordinates**: ROI uses 0-1 ratios for resolution independence
- **Context Isolation**: All windows use preload bridge, node integration disabled

## Security Model

- WebViews restricted to `https://universe.flyff.com` only
- Navigation guards prevent URL hijacking
- Electron Fuses enabled (cookie encryption, ASAR integrity, no node CLI args)
- Window.open blocked globally

## Internationalization

8 languages supported (en, de, pl, fr, ru, tr, cn, jp) via `src/i18n/translations.ts`. Language stored in localStorage key `launcherLang`.

## Environment Variables

- `FLYFF_OCR_PYTHON`: Custom Python path (defaults to "python")

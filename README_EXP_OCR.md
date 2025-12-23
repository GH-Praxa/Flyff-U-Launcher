# EXP Overlay + OCR (MVP)

Dieses Patch-Paket fügt dir 3 Bausteine hinzu:

- `app/src/main/ocr/pythonWorker.ts` – startet Python, JSONL-Protokoll, Promise-API
- `app/src/main/expOverlay/startExpOverlay.ts` – Capture (BrowserView) -> OCR -> Overlay
- `app/src/main/windows/overlayWindow.ts` – transparentes Always-on-Top Fenster (MVP, inline HTML)
- `app/ocr/ocr_worker.py` – Python OCR Worker (OpenCV + pytesseract)

## Python Setup

1) Tesseract installieren (Windows):
   - Tesseract-OCR (z.B. UB Mannheim Builds) und `tesseract.exe` in PATH
   - oder Pfad in `ocr_worker.py` setzen (`pytesseract.pytesseract.tesseract_cmd = ...`)

2) Python Pakete:
   ```bash
   pip install -r app/ocr/requirements.txt
   ```

## Integration in Electron (Main)

Du brauchst **nur eine** Zeile im Bootstrapping:

```ts
import { startExpOverlay } from "./main/expOverlay/startExpOverlay";

const expOverlay = startExpOverlay({
  getSessionWindow: () => sessionWindow.getWindow?.() ?? null,    // an deine Struktur anpassen
  getActiveView: () => sessionTabs.getActiveView?.() ?? null,      // an deine Struktur anpassen
  intervalMs: 800,
  debugEveryN: 10, // optional: alle 10 Ticks exp_crop_*.png in userData
});
```

### Wenn du noch die "monolithische" main.ts nutzt
Dann kannst du statt `getSessionWindow/getActiveView` einfach deine bestehenden Variablen zurückgeben:

- Session Fenster: `sessionWindow`
- aktive BrowserView: `sessionViews.get(sessionActiveId)?.view`

## Rect / Crop anpassen

Standard ist **bottom-right**. Wenn OCR nichts findet, aktiviere Debug:

`debugEveryN: 10`

Dann findest du in `app.getPath("userData")` die `exp_crop_*.png` und kannst `computeExpRect()` passend tweaken:
`app/src/main/capture/computeRects.ts`

## Nächster Schritt (wenn OCR läuft)
- Overlay-Inhalt in deine React/Vite-UI ziehen (statt data: URL)
- Rect konfigurierbar machen (GUI "Kalibrieren")
- Alternative: Bar-Füllstand per Pixelanalyse (oft stabiler als OCR)

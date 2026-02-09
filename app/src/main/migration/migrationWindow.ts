/**
 * Migration Window – small frameless progress dialog shown during data migration.
 *
 * Uses a data: URL so no preload or external HTML file is needed.
 */
import { BrowserWindow, screen } from "electron";

const WINDOW_WIDTH = 420;
const WINDOW_HEIGHT = 160;

const HTML_CONTENT = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #1a1a2e;
    color: #e0e0e0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    padding: 24px;
    -webkit-app-region: drag;
    user-select: none;
  }
  h1 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #ffffff;
  }
  .progress-container {
    width: 100%;
    background: #2a2a4a;
    border-radius: 6px;
    overflow: hidden;
    height: 20px;
    margin-bottom: 12px;
  }
  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #4a90d9, #67b8f7);
    border-radius: 6px;
    transition: width 0.3s ease;
    width: 0%;
  }
  .step-info {
    font-size: 11px;
    color: #999;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }
  .step-counter {
    font-size: 12px;
    color: #bbb;
    margin-bottom: 6px;
  }
</style>
</head>
<body>
  <h1 id="title">Updating data structure...</h1>
  <div class="progress-container">
    <div class="progress-bar" id="bar"></div>
  </div>
  <div class="step-counter" id="counter"></div>
  <div class="step-info" id="label"></div>
</body>
</html>`;

export function createMigrationWindow(): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

    const win = new BrowserWindow({
        width: WINDOW_WIDTH,
        height: WINDOW_HEIGHT,
        x: Math.round((screenW - WINDOW_WIDTH) / 2),
        y: Math.round((screenH - WINDOW_HEIGHT) / 2),
        frame: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        alwaysOnTop: true,
        skipTaskbar: false,
        show: false,
        transparent: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(HTML_CONTENT)}`);
    win.once("ready-to-show", () => win.show());

    return win;
}

export interface MigrationWindowProgress {
    current: number;
    total: number;
    label: string;
    setLabel?: string;
}

export function updateMigrationProgress(win: BrowserWindow, progress: MigrationWindowProgress): void {
    if (win.isDestroyed()) return;
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    const js = `
        document.getElementById('title').textContent = ${JSON.stringify(progress.setLabel || "Updating data structure...")};
        document.getElementById('bar').style.width = '${pct}%';
        document.getElementById('counter').textContent = '${progress.current} / ${progress.total}';
        document.getElementById('label').textContent = ${JSON.stringify(progress.label)};
    `;
    win.webContents.executeJavaScript(js).catch(() => {});
}

export function closeMigrationWindow(win: BrowserWindow): void {
    if (!win.isDestroyed()) {
        win.destroy();
    }
}

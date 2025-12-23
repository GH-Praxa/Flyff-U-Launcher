import { BrowserWindow } from "electron";

const ICON_W = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsSAAALEgHS3X78AAABJUlEQVR4nO2XsUoDQRSGv2kqKBiQ1sLGQmtrY2FhZ2FhY2FhY2FhY2HhC2gQKx0C8Qn0gkQxQhQ0q7j3r2c7d3b0p7mY+Z0zv3d2Z7gkO3cCk0lQm0mJ4AqgGkJfM2cA4wE8rH8b1cKcKkYfW8b0s4H2Q9QmQeEo4bQv7oWcQG0xvWq6bQ7m8GvQ9bqgC9QHnY4k7gFq2J0i6xg0r2tQmE1q5qfXo3wDkYc0gF0yqkq2B2oGQ1c3cQ5nqgC9QFf2Z8Aqgq7g9GZyJ5b0Z2b6gY0oYc1oWm0m0lY0V8A2F5p0x0uV0y8j1n0Yt6+8rj0yq7Q0m2g5oBvW8m3jz0aQAAAABJRU5ErkJggg==";
const ICON_H = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsSAAALEgHS3X78AAABG0lEQVR4nO2XsUoDQRSGv2kqKBiQ1sLGQmtrY2FhZ2FhY2FhY2FhY2HhC2gQKx0C8Qn0gkQxQhQ0q7j3r2c7d3b0p7mY+Z0zv3d2Z7gkO3cCk0lQm0mJ4AqgGkJfM2cA4wE8rH8b1cKcKkYfW8b0s4H2Q9QmQeEo4bQv7oWcQG0xvWq6bQ7m8GvQ9bqgC9QHnY4k7gFq2J0i6xg0r2tQmE1q5qfXo3wDkYc0gF0yqkq2B2oGQ1c3cQ5nqgC9QFf2Z8Aqgq7g9GZyJ5b0Z2b6gY0oYc1oWm0m0lY0V8A2F5p0x0uV0y8j1n0Yt6+8rj0yq7Q0m2g5oBvW8m3jz0aQAAAABJRU5ErkJggg==";

export function createHudControlWindow(parent: BrowserWindow) {
  const win = new BrowserWindow({
    parent,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    show: true,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");

  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden;font-family:Segoe UI,Arial}
  #wrap{
    width: 168px; height: 44px;
    display:flex; gap:8px;
    align-items:center; justify-content:flex-end;
    padding:6px;
    border-radius: 12px;
    border:1px solid rgba(255,215,0,0.35);
    background: rgba(0,0,0,0.55);
    box-shadow: 0 10px 30px rgba(0,0,0,0.25);
    user-select:none;
  }

  .btn{
    width: 36px; height: 28px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.06);
    color:#ddd;
    cursor:pointer;
    display:grid;
    place-items:center;
    touch-action:none;
  }
  .btn:hover{ background: rgba(255,255,255,0.10); }

  .btn img{ width:20px; height:20px; image-rendering: auto; }

  #move{ font-size: 16px; line-height: 1; }
  #reset.hidden{ display:none; }

  .active{
    border-color: rgba(255,215,0,0.35);
    background: rgba(255,215,0,0.12);
    color:#ffd700;
  }
</style>
</head>
<body>
  <div id="wrap">
    <div class="btn" id="reset" title="Reset">R</div>
    <div class="btn" id="move" title="Verschieben">⤧</div>
    <div class="btn" id="w" title="Breite ändern"><img alt="↔" src="${ICON_W}"></div>
    <div class="btn" id="h" title="Höhe ändern"><img alt="↕" src="${ICON_H}"></div>
  </div>

<script>
  const { ipcRenderer } = require("electron");

  let profileId = null;
  let dragging = null; // { kind, pointerId }

  const moveBtn = document.getElementById("move");
  const wBtn = document.getElementById("w");
  const hBtn = document.getElementById("h");
  const resetBtn = document.getElementById("reset");

  function startDrag(kind, el, e){
    e.preventDefault();
    dragging = { kind, pointerId: e.pointerId };
    el.setPointerCapture(e.pointerId);
    el.classList.add("active");
    ipcRenderer.send("hud:dragStart", { kind, x: e.screenX, y: e.screenY });
  }

  function moveDrag(e){
    if (!dragging) return;
    ipcRenderer.send("hud:dragMove", { x: e.screenX, y: e.screenY });
  }

  function endDrag(el, e){
    if (!dragging) return;
    try { el.releasePointerCapture(dragging.pointerId); } catch {}
    dragging = null;
    el.classList.remove("active");
    ipcRenderer.send("hud:dragEnd");
  }

  // Move
  moveBtn.addEventListener("pointerdown", (e) => startDrag("move", moveBtn, e));
  moveBtn.addEventListener("pointermove", moveDrag);
  moveBtn.addEventListener("pointerup", (e) => endDrag(moveBtn, e));
  moveBtn.addEventListener("pointercancel", (e) => endDrag(moveBtn, e));

  // Resize Width
  wBtn.addEventListener("pointerdown", (e) => startDrag("w", wBtn, e));
  wBtn.addEventListener("pointermove", moveDrag);
  wBtn.addEventListener("pointerup", (e) => endDrag(wBtn, e));
  wBtn.addEventListener("pointercancel", (e) => endDrag(wBtn, e));

  // Resize Height
  hBtn.addEventListener("pointerdown", (e) => startDrag("h", hBtn, e));
  hBtn.addEventListener("pointermove", moveDrag);
  hBtn.addEventListener("pointerup", (e) => endDrag(hBtn, e));
  hBtn.addEventListener("pointercancel", (e) => endDrag(hBtn, e));

  // Reset
  resetBtn.addEventListener("click", () => {
    if (!profileId) return;
    ipcRenderer.send("overlay:reset", { profileId });
  });

  // Profil + Settings
  ipcRenderer.on("exp:update", (_e, payload) => {
    if (!payload) return;
    profileId = payload.profileId ?? profileId;

    const s = payload.settings || null;
    const showReset = (s && typeof s.showResetButton === "boolean") ? s.showResetButton : true;
    resetBtn.classList.toggle("hidden", !showReset);
  });
</script>
</body>
</html>
`.trim();

  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html)).catch(() => {});
  return win;
}

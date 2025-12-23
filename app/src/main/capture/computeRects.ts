import type { Rectangle } from "electron";

export type HudRects = {
  nameLevel: Rectangle; // "Name Lv 2"
  expPercent: Rectangle; // "5.0000%"
};

function clampRect(r: Rectangle, w: number, h: number): Rectangle {
  const x = Math.max(0, Math.min(r.x, w - 1));
  const y = Math.max(0, Math.min(r.y, h - 1));
  const width = Math.max(1, Math.min(r.width, w - x));
  const height = Math.max(1, Math.min(r.height, h - y));
  return { x, y, width, height };
}

export function computeHudRects(size: { width: number; height: number }): HudRects {
  const { width: w, height: h } = size;

  // Basierend auf typischer Flyff-HUD Position oben links
  // => bitte mit debugEveryN Crops prüfen und ggf. korrigieren
  const nameLevel = clampRect(
    {
      x: Math.round(w * 0.015),
      y: Math.round(h * 0.015),
      width: Math.round(w * 0.23),
      height: Math.round(h * 0.04),
    },
    w,
    h
  );

  const expPercent = clampRect(
    {
      x: Math.round(w * 0.06),
      y: Math.round(h * 0.085),
      width: Math.round(w * 0.14),
      height: Math.round(h * 0.04),
    },
    w,
    h
  );

  return { nameLevel, expPercent };
}

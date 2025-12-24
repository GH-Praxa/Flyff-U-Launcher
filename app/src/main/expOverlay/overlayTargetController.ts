import type { BrowserView, BrowserWindow, Rectangle } from "electron";
import { startExpOverlay } from "./startExpOverlay";
import type { RoiStore, HudRois } from "../roi/roiStore";

function clampRect(r: Rectangle, w: number, h: number): Rectangle {
  const x = Math.max(0, Math.min(r.x, w - 1));
  const y = Math.max(0, Math.min(r.y, h - 1));
  const width = Math.max(1, Math.min(r.width, w - x));
  const height = Math.max(1, Math.min(r.height, h - y));
  return { x, y, width, height };
}

function roiToPx(roi: { x: number; y: number; w: number; h: number }, size: { width: number; height: number }): Rectangle {
  const x = Math.round(roi.x * size.width);
  const y = Math.round(roi.y * size.height);
  const width = Math.round(roi.w * size.width);
  const height = Math.round(roi.h * size.height);
  return clampRect({ x, y, width, height }, size.width, size.height);
}

export function createOverlayTargetController(opts: {
  profiles: { getOverlayTargetId: () => Promise<string | null> };
  roiStore: RoiStore;

  sessionWindow: { get: () => BrowserWindow | null };
  sessionTabs: {
    getViewByProfile: (profileId: string) => BrowserView | null;
    isActive: (profileId: string) => boolean;
  };
  instances: { get: (profileId: string) => BrowserWindow | null };

  pythonExe?: string;
  intervalMs?: number;
  debugEveryN?: number;
}) {
  let targetId: string | null = null;
  let cachedRois: HudRois | null = null;

  const overlay = startExpOverlay({
    getSessionWindow: () => {
      if (!targetId) return null;

      const inst = opts.instances.get(targetId);
      if (inst) return inst;

      if (!opts.sessionTabs.isActive(targetId)) return null;
      return opts.sessionWindow.get();
    },

    getActiveView: () => {
      if (!targetId) return null;

      const inst = opts.instances.get(targetId);
      if (inst) return null;

      if (!opts.sessionTabs.isActive(targetId)) return null;
      return opts.sessionTabs.getViewByProfile(targetId);
    },

    // ✅ ROIs pro Target nutzen (fallback bleibt in startExpOverlay)
    getRects: (size) => {
      if (!cachedRois) return undefined as any; // startExpOverlay fällt auf defaultRects zurück
      return {
        nameLevel: roiToPx(cachedRois.nameLevel, size),
        expPercent: roiToPx(cachedRois.expPercent, size),
      };
    },

    intervalMs: opts.intervalMs ?? 800,
    debugEveryN: opts.debugEveryN ?? 0,
    pythonExe: opts.pythonExe ?? "python",
  });

  async function refreshFromStore() {
    try {
      targetId = await opts.profiles.getOverlayTargetId();
      console.log("[OVERLAY TARGET] targetId =", targetId);

      if (targetId) {
        cachedRois = await opts.roiStore.get(targetId);
        console.log("[OVERLAY TARGET] rois loaded:", !!cachedRois);
      } else {
        cachedRois = null;
      }
    } catch {
      targetId = null;
      cachedRois = null;
      console.log("[OVERLAY TARGET] targetId =", targetId);
    }
  }

  function stop() {
    overlay.stop();
  }

  return { refreshFromStore, stop };
}

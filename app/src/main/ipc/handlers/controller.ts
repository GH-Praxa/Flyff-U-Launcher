/**
 * IPC-Handler fuer Controller-Eingaben. Empfaengt Gamepad-Frames vom Preload
 * (fire-and-forget via `ipcRenderer.send`) und reicht sie an den
 * [ControllerInputRouter] weiter, der die Events am Chromium-Input-Layer
 * der fokussierten Session-WebContents absetzt.
 *
 * Plus: Action-Pad-Kalibrierungs-Handshake (`controller:calibrate:done`).
 */
import { ipcMain, type IpcMainEvent, type WebContents } from "electron";
import type { ControllerInputRouter, GamepadFrame, ActionPadAnchor } from "../../controller/inputRouter";
import { deriveActionPadAnchor } from "../../controller/inputRouter";
import { logErr, logInfo } from "../../../shared/logger";

export interface ControllerHandlerOptions {
    router: ControllerInputRouter;
    onControllerConnected?: (info: { id: string; mapping: string; axesCount: number; buttonsCount: number }) => void;
    /**
     * Liefert die Profil-ID, die zur Sender-WebContents gehoert. Wird vom
     * Calibrate-Handler genutzt, um die kalibrierte Position dem richtigen
     * Profil zuzuweisen. `null` falls die WebContents nicht zu einer
     * registrierten Flyff-View gehoert.
     */
    getProfileForWebContents: (wc: WebContents) => string | null;
    /**
     * Persistiert den neu kalibrierten Action-Pad-Anker fuer ein Profil
     * (Update auf den ProfilesStore + In-Memory-Cache).
     */
    setActionPadAnchor: (profileId: string, anchor: ActionPadAnchor) => Promise<void>;
    /**
     * Toast nach erfolgreicher / fehlgeschlagener Kalibrierung.
     */
    notify?: (message: string, tone?: "info" | "success" | "error") => void;
}

interface CalibrateDonePayload {
    x: number;
    y: number;
    viewportWidth: number;
    viewportHeight: number;
}

export function registerControllerHandlers(opts: ControllerHandlerOptions): () => void {
    const onFrame = (event: IpcMainEvent, frame: unknown) => {
        try {
            if (!isGamepadFrame(frame)) return;
            opts.router.handleFrame(frame, event.sender);
        }
        catch (err) {
            logErr("controller:frame handler failed: " + String(err));
        }
    };

    const onConnected = (_event: IpcMainEvent, info: unknown) => {
        try {
            if (!info || typeof info !== "object") return;
            const i = info as Record<string, unknown>;
            const sanitized = {
                id: typeof i.id === "string" ? i.id : "unknown",
                mapping: typeof i.mapping === "string" ? i.mapping : "unknown",
                axesCount: typeof i.axesCount === "number" ? i.axesCount : 0,
                buttonsCount: typeof i.buttonsCount === "number" ? i.buttonsCount : 0,
            };
            logInfo("controller", `Gamepad connected: ${sanitized.id} (mapping=${sanitized.mapping}, axes=${sanitized.axesCount}, buttons=${sanitized.buttonsCount})`);
            opts.onControllerConnected?.(sanitized);
        }
        catch (err) {
            logErr("controller:connected handler failed: " + String(err));
        }
    };

    const onCalibrateDone = async (event: IpcMainEvent, payload: unknown) => {
        try {
            if (!isCalibrateDonePayload(payload)) {
                opts.notify?.("Kalibrierung fehlgeschlagen (ungültige Daten)", "error");
                return;
            }
            const profileId = opts.getProfileForWebContents(event.sender);
            if (!profileId) {
                opts.notify?.("Kalibrierung: Profil nicht erkannt", "error");
                return;
            }
            const w = payload.viewportWidth;
            const h = payload.viewportHeight;
            if (w <= 0 || h <= 0) {
                opts.notify?.("Kalibrierung: ungültige Viewport-Größe", "error");
                return;
            }
            const anchor = deriveActionPadAnchor(payload.x, payload.y, w, h);
            await opts.setActionPadAnchor(profileId, anchor);
            opts.notify?.(
                `Action-Pad kalibriert: ${anchor.vAnchor}-${anchor.hAnchor} `
                + `(${anchor.offsetX >= 0 ? "+" : ""}${anchor.offsetX.toFixed(0)}, `
                + `${anchor.offsetY >= 0 ? "+" : ""}${anchor.offsetY.toFixed(0)})`,
                "success",
            );
            logInfo("controller", `Action-pad calibrated for profile ${profileId}: ${anchor.vAnchor}-${anchor.hAnchor} offset (${anchor.offsetX.toFixed(1)}, ${anchor.offsetY.toFixed(1)})`);
        }
        catch (err) {
            logErr("controller:calibrate:done handler failed: " + String(err));
            opts.notify?.("Kalibrierung fehlgeschlagen", "error");
        }
    };

    ipcMain.on("controller:frame", onFrame);
    ipcMain.on("controller:connected", onConnected);
    ipcMain.on("controller:calibrate:done", onCalibrateDone);

    return () => {
        ipcMain.removeListener("controller:frame", onFrame);
        ipcMain.removeListener("controller:connected", onConnected);
        ipcMain.removeListener("controller:calibrate:done", onCalibrateDone);
    };
}

function isGamepadFrame(value: unknown): value is GamepadFrame {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    return typeof v.index === "number"
        && typeof v.timestamp === "number"
        && Array.isArray(v.axes)
        && Array.isArray(v.buttons)
        && typeof v.viewportWidth === "number"
        && typeof v.viewportHeight === "number";
}

function isCalibrateDonePayload(value: unknown): value is CalibrateDonePayload {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    return typeof v.x === "number"
        && typeof v.y === "number"
        && typeof v.viewportWidth === "number"
        && typeof v.viewportHeight === "number";
}


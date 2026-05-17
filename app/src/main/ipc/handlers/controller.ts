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
    getProfileForWebContents: (wc: WebContents) => string | null;
    setActionPadAnchor: (profileId: string, anchor: ActionPadAnchor) => Promise<void>;
    /**
     * Schreibt den Klick-Anker fuer einen Buff-Empfaenger-Slot (0..NAME_SLOT_COUNT-1).
     * Wird vom calibrate:done-Handler aufgerufen, wenn der Payload einen Slot-Index enthaelt.
     */
    setNameSlotAnchor?: (profileId: string, slot: number, anchor: ActionPadAnchor) => Promise<void>;
    /**
     * Wird vom UI nach Save eines neuen Button-Mappings aufgerufen, damit der
     * In-Memory-Cache fuer den naechsten Frame schon den neuen Wert benutzt.
     */
    reloadButtonMapping: (profileId: string) => Promise<void>;
    notify?: (message: string, tone?: "info" | "success" | "error") => void;
}

interface CalibrateDonePayload {
    x: number;
    y: number;
    viewportWidth: number;
    viewportHeight: number;
    /** Optional: bei gesetztem Slot-Index (0..7) wird statt Action-Pad-Anker
     *  der Name-Slot-Anker im Profil geschrieben. */
    slot?: number;
    /** Optional: Ziel-Profil fuer den Anker. Wird vom Renderer beim
     *  UI-getriggerten Slot-Calibrate mitgeschickt — der Anker wird damit
     *  unabhaengig von der Sender-WebContents am gewuenschten Profil
     *  gespeichert. Fehlt das Feld, faellt der Handler auf
     *  `getProfileForWebContents(sender)` zurueck. */
    profileId?: string;
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
            // Bevorzugt das im Payload mitgeschickte Ziel-Profil (UI-Pfad);
            // sonst Fallback auf die Sender-WebContents (Global-Shortcut-Pfad).
            const profileId = payload.profileId ?? opts.getProfileForWebContents(event.sender);
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
            if (typeof payload.slot === "number" && Number.isInteger(payload.slot) && payload.slot >= 0 && payload.slot < 8) {
                if (!opts.setNameSlotAnchor) {
                    opts.notify?.("Name-Slot-Kalibrierung nicht verfügbar", "error");
                    return;
                }
                await opts.setNameSlotAnchor(profileId, payload.slot, anchor);
                opts.notify?.(
                    `Slot ${payload.slot + 1} kalibriert: ${anchor.vAnchor}-${anchor.hAnchor} `
                    + `(${anchor.offsetX >= 0 ? "+" : ""}${anchor.offsetX.toFixed(0)}, `
                    + `${anchor.offsetY >= 0 ? "+" : ""}${anchor.offsetY.toFixed(0)})`,
                    "success",
                );
                logInfo("controller", `Name-slot ${payload.slot} calibrated for profile ${profileId}: ${anchor.vAnchor}-${anchor.hAnchor} offset (${anchor.offsetX.toFixed(1)}, ${anchor.offsetY.toFixed(1)})`);
                return;
            }
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

    const onReloadMapping = async (_event: IpcMainEvent, profileId: unknown) => {
        try {
            if (typeof profileId !== "string" || !profileId) return;
            await opts.reloadButtonMapping(profileId);
        }
        catch (err) {
            logErr("controller:reloadMapping handler failed: " + String(err));
        }
    };

    ipcMain.on("controller:frame", onFrame);
    ipcMain.on("controller:connected", onConnected);
    ipcMain.on("controller:calibrate:done", onCalibrateDone);
    ipcMain.on("controller:reloadMapping", onReloadMapping);

    return () => {
        ipcMain.removeListener("controller:frame", onFrame);
        ipcMain.removeListener("controller:connected", onConnected);
        ipcMain.removeListener("controller:calibrate:done", onCalibrateDone);
        ipcMain.removeListener("controller:reloadMapping", onReloadMapping);
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
    if (typeof v.x !== "number"
        || typeof v.y !== "number"
        || typeof v.viewportWidth !== "number"
        || typeof v.viewportHeight !== "number") {
        return false;
    }
    if (v.slot !== undefined && (typeof v.slot !== "number" || !Number.isInteger(v.slot))) {
        return false;
    }
    if (v.profileId !== undefined && typeof v.profileId !== "string") {
        return false;
    }
    return true;
}


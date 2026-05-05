/**
 * IPC-Handler fuer Controller-Eingaben. Empfaengt Gamepad-Frames vom Preload
 * (fire-and-forget via `ipcRenderer.send`) und reicht sie an den
 * [ControllerInputRouter] weiter, der die Events am Chromium-Input-Layer
 * der fokussierten Session-WebContents absetzt.
 */
import { ipcMain, type IpcMainEvent } from "electron";
import type { ControllerInputRouter, GamepadFrame } from "../../controller/inputRouter";
import { logErr, logInfo } from "../../../shared/logger";

export interface ControllerHandlerOptions {
    router: ControllerInputRouter;
    onControllerConnected?: (info: { id: string; mapping: string; axesCount: number; buttonsCount: number }) => void;
}

export function registerControllerHandlers(opts: ControllerHandlerOptions): () => void {
    const onFrame = (_event: IpcMainEvent, frame: unknown) => {
        try {
            if (!isGamepadFrame(frame)) return;
            opts.router.handleFrame(frame);
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

    ipcMain.on("controller:frame", onFrame);
    ipcMain.on("controller:connected", onConnected);

    return () => {
        ipcMain.removeListener("controller:frame", onFrame);
        ipcMain.removeListener("controller:connected", onConnected);
    };
}

function isGamepadFrame(value: unknown): value is GamepadFrame {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    return typeof v.index === "number"
        && typeof v.timestamp === "number"
        && Array.isArray(v.axes)
        && Array.isArray(v.buttons);
}

/**
 * IPC-Handler fuer Controller-Eingaben. Empfaengt Gamepad-Frames vom Preload
 * (fire-and-forget via `ipcRenderer.send`) und reicht sie an den
 * [ControllerInputRouter] weiter, der die Events am Chromium-Input-Layer
 * der fokussierten Session-WebContents absetzt.
 */
import { ipcMain, type IpcMainEvent } from "electron";
import type { ControllerInputRouter, GamepadFrame } from "../../controller/inputRouter";
import { logErr } from "../../../shared/logger";

export interface ControllerHandlerOptions {
    router: ControllerInputRouter;
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

    ipcMain.on("controller:frame", onFrame);

    return () => {
        ipcMain.removeListener("controller:frame", onFrame);
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

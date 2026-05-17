/**
 * Native Linux-Gamepad-Reader fuer den Main-Process.
 *
 * Bypasses Chromium's `navigator.getGamepads()`-User-Activation-Gate: liest
 * Events direkt vom Joystick-Devicefile (`/dev/input/jsX`), formt sie zu
 * standardisierten [GamepadFrame]s und reicht sie an den [ControllerInputRouter]
 * weiter. Damit sind schon-gesteckte Controller sofort nach Launcher-Start
 * verfuegbar — kein Replug, kein Tastendruck "zum Aufwecken" mehr noetig.
 *
 * Plattform: nur Linux. Windows/macOS bleiben beim Preload-Polling. Aktiv
 * solange mindestens ein `/dev/input/js*` existiert; bei Disconnect 2s-Retry.
 *
 * Event-Format ([struct js_event](https://www.kernel.org/doc/Documentation/input/joystick-api.txt)):
 *   u32 time, s16 value, u8 type, u8 number    → 8 Bytes pro Event
 * `type & 0x80` = init-Event (Initial-Zustands-Broadcast nach open()),
 * `type & 0x01` = Button, `type & 0x02` = Achse.
 */
import fs from "fs";
import path from "path";
import { logInfo, logWarn } from "../../shared/logger";
import type { GamepadFrame } from "./inputRouter";

const JS_EVENT_SIZE = 8;
const JS_EVENT_BUTTON = 0x01;
const JS_EVENT_AXIS = 0x02;
const JS_EVENT_INIT = 0x80;
const AXIS_NORM = 32767;
const RETRY_DELAY_MS = 2000;

/** Schwelle ab der ein D-Pad-Hat-Wert (-1/0/+1) als „gedrueckt" gilt. */
const HAT_THRESHOLD = 0.5;

interface VidPid { vid: number; pid: number }

/**
 * Die jsX-Reihenfolge des Linux-Kernels stimmt nicht mit dem
 * Chromium-„Standard Gamepad"-Layout ueberein, das der [ControllerInputRouter]
 * erwartet. Diese Funktion wandelt rohe jsX-Buttons+Achsen in das
 * Standard-Layout um:
 *
 *  Standard-Buttons: 0=A/Cross 1=B/Circle 2=X/Square 3=Y/Triangle
 *                    4=LB 5=RB 6=LT 7=RT 8=Back/Share 9=Start/Options
 *                    10=L3 11=R3 12=Up 13=Down 14=Left 15=Right 16=Home/PS
 *  Standard-Axes:    0=LX 1=LY 2=RX 3=RY
 *
 * DualSense via `hid-playstation` liefert in jsX-Reihenfolge:
 *  Buttons: 0=Cross 1=Circle 2=Triangle 3=Square 4=L1 5=R1 6=L2 7=R2
 *           8=Share 9=Options 10=PS 11=L3 12=R3 13=Touchpad
 *  Axes:    0=LX 1=LY 2=L2-analog 3=RX 4=RY 5=R2-analog 6=DPad-X 7=DPad-Y
 *
 * Fuer unbekannte Geraete wird das rohe jsX-Layout durchgereicht — besser ein
 * teilweise falsches Mapping als gar keine Eingabe.
 */
function toStandardFrame(rawButtons: boolean[], rawAxes: number[], vidPid: VidPid | null): { buttons: boolean[]; axes: number[] } {
    const isDualSense = vidPid && vidPid.vid === 0x054c && (vidPid.pid === 0x0ce6 || vidPid.pid === 0x0df2);
    if (!isDualSense) {
        return { buttons: rawButtons.slice(), axes: rawAxes.slice() };
    }
    const stdButtons: boolean[] = new Array(17).fill(false);
    stdButtons[0] = rawButtons[0] ?? false;            // Cross
    stdButtons[1] = rawButtons[1] ?? false;            // Circle
    stdButtons[2] = rawButtons[3] ?? false;            // Square (raw 3)
    stdButtons[3] = rawButtons[2] ?? false;            // Triangle (raw 2)
    stdButtons[4] = rawButtons[4] ?? false;            // L1
    stdButtons[5] = rawButtons[5] ?? false;            // R1
    stdButtons[6] = rawButtons[6] ?? false;            // L2 (digital threshold via kernel)
    stdButtons[7] = rawButtons[7] ?? false;            // R2
    stdButtons[8] = rawButtons[8] ?? false;            // Share
    stdButtons[9] = rawButtons[9] ?? false;            // Options
    stdButtons[10] = rawButtons[11] ?? false;          // L3 (raw 11)
    stdButtons[11] = rawButtons[12] ?? false;          // R3 (raw 12)
    // D-Pad aus Hat-Achsen
    const hatX = rawAxes[6] ?? 0;
    const hatY = rawAxes[7] ?? 0;
    stdButtons[12] = hatY < -HAT_THRESHOLD;            // Up
    stdButtons[13] = hatY > HAT_THRESHOLD;             // Down
    stdButtons[14] = hatX < -HAT_THRESHOLD;            // Left
    stdButtons[15] = hatX > HAT_THRESHOLD;             // Right
    stdButtons[16] = rawButtons[10] ?? false;          // PS (raw 10)
    const stdAxes: number[] = [
        rawAxes[0] ?? 0,                               // LX
        rawAxes[1] ?? 0,                               // LY
        rawAxes[3] ?? 0,                               // RX  ← war vorher rawAxes[2] = L2!
        rawAxes[4] ?? 0,                               // RY  ← war vorher rawAxes[3] = RX!
    ];
    return { buttons: stdButtons, axes: stdAxes };
}

function readDeviceVidPid(devPath: string): VidPid | null {
    try {
        const base = path.basename(devPath);
        const vidStr = fs.readFileSync(`/sys/class/input/${base}/device/id/vendor`, "utf8").trim();
        const pidStr = fs.readFileSync(`/sys/class/input/${base}/device/id/product`, "utf8").trim();
        return { vid: parseInt(vidStr, 16), pid: parseInt(pidStr, 16) };
    } catch {
        return null;
    }
}

export interface LinuxGamepadReaderOpts {
    /** Wird mit dem aktuellen Schnappschuss aller Buttons + Achsen aufgerufen,
     *  jedes Mal wenn ein non-init-Event ankommt. */
    onFrame: (frame: GamepadFrame) => void;
    /** Einmal pro Connect — Identifier des Devices fuer das Toast/Log. */
    onConnected?: (info: { id: string; mapping: string; axesCount: number; buttonsCount: number }) => void;
    /** Wird gerufen wenn das Device verschwindet (USB raus, Bluetooth-Disconnect). */
    onDisconnected?: () => void;
    /** Liefert die viewport-Groesse fuer die Frame-Felder. Da der Router via
     *  `getViewportFor` selbst die echten Bounds zieht, hier nur ein fallback;
     *  Defaults sind ok. */
    getViewportSize?: () => { width: number; height: number };
}

export function startLinuxGamepadReader(opts: LinuxGamepadReaderOpts): () => void {
    if (process.platform !== "linux") return () => { /* no-op */ };

    let stream: fs.ReadStream | null = null;
    let retryTimer: NodeJS.Timeout | null = null;
    let heartbeat: NodeJS.Timeout | null = null;
    let connected = false;
    let currentDevPath = "";
    let currentVidPid: VidPid | null = null;
    const buttons: boolean[] = [];
    const axes: number[] = [];
    /** Carryover-Buffer fuer Frames, die nicht auf 8-Byte-Grenze fallen. */
    let pending: Buffer = Buffer.alloc(0);

    const HEARTBEAT_HZ = 60;
    const HEARTBEAT_INTERVAL_MS = Math.round(1000 / HEARTBEAT_HZ);

    function findDevicePath(): string | null {
        for (let i = 0; i < 8; i++) {
            const p = `/dev/input/js${i}`;
            try {
                if (fs.existsSync(p)) return p;
            } catch { /* ignore */ }
        }
        return null;
    }

    function readDeviceName(devPath: string): string {
        try {
            const sys = `/sys/class/input/${path.basename(devPath)}/device/name`;
            if (fs.existsSync(sys)) return fs.readFileSync(sys, "utf8").trim();
        } catch { /* ignore */ }
        return `Linux Gamepad (${path.basename(devPath)})`;
    }

    function emitFrame(): void {
        const view = opts.getViewportSize?.() ?? { width: 1920, height: 1080 };
        const std = toStandardFrame(buttons, axes, currentVidPid);
        opts.onFrame({
            index: 0,
            timestamp: Date.now(),
            buttons: std.buttons,
            axes: std.axes,
            viewportWidth: view.width,
            viewportHeight: view.height,
        });
    }

    function handleChunk(chunk: Buffer): void {
        const merged = pending.length > 0 ? Buffer.concat([pending, chunk]) : chunk;
        const usable = merged.length - (merged.length % JS_EVENT_SIZE);
        pending = merged.subarray(usable);
        let frameChanged = false;
        let hadInitEvent = false;
        for (let i = 0; i < usable; i += JS_EVENT_SIZE) {
            const value = merged.readInt16LE(i + 4);
            const type = merged.readUInt8(i + 6);
            const number = merged.readUInt8(i + 7);
            const isInit = (type & JS_EVENT_INIT) !== 0;
            const realType = type & ~JS_EVENT_INIT;
            if (realType === JS_EVENT_BUTTON) {
                while (buttons.length <= number) buttons.push(false);
                buttons[number] = value !== 0;
            } else if (realType === JS_EVENT_AXIS) {
                while (axes.length <= number) axes.push(0);
                axes[number] = Math.max(-1, Math.min(1, value / AXIS_NORM));
            } else {
                continue;
            }
            if (isInit) hadInitEvent = true;
            else frameChanged = true;
        }
        // Erst-Connect: schon Init-Events reichen, damit der Router den Controller
        // kennt — sonst muesste der User erst einen Knopf druecken/repluggen,
        // damit non-init-Events fliessen.
        const shouldFirstConnect = !connected && (frameChanged || hadInitEvent) && (buttons.length > 0 || axes.length > 0);
        if (shouldFirstConnect) {
            connected = true;
            const id = readDeviceName(currentDevPath);
            logInfo(`[LinuxGamepad] connected: ${id} (axes=${axes.length}, buttons=${buttons.length})`, "controller");
            opts.onConnected?.({ id, mapping: "standard", axesCount: axes.length, buttonsCount: buttons.length });
            emitFrame();
            startHeartbeat();
            return;
        }
        if (!frameChanged) return;
        emitFrame();
    }

    function startHeartbeat(): void {
        if (heartbeat) return;
        heartbeat = setInterval(() => {
            if (!connected) return;
            emitFrame();
        }, HEARTBEAT_INTERVAL_MS);
    }

    function stopHeartbeat(): void {
        if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
        }
    }

    function cleanupStream(): void {
        if (stream) {
            try { stream.removeAllListeners(); stream.destroy(); } catch { /* ignore */ }
            stream = null;
        }
        pending = Buffer.alloc(0);
        stopHeartbeat();
        if (connected) {
            connected = false;
            opts.onDisconnected?.();
        }
    }

    function scheduleRetry(): void {
        if (retryTimer) return;
        retryTimer = setTimeout(() => {
            retryTimer = null;
            open();
        }, RETRY_DELAY_MS);
    }

    function open(): void {
        const devPath = findDevicePath();
        if (!devPath) {
            scheduleRetry();
            return;
        }
        currentDevPath = devPath;
        currentVidPid = readDeviceVidPid(devPath);
        try {
            stream = fs.createReadStream(devPath, { highWaterMark: 64 * JS_EVENT_SIZE });
        } catch (err) {
            logWarn(`[LinuxGamepad] open failed (${devPath}): ${(err as Error).message}`, "controller");
            scheduleRetry();
            return;
        }
        stream.on("data", (chunk) => {
            if (typeof chunk === "string") return;
            handleChunk(chunk);
        });
        stream.on("error", (err) => {
            logWarn(`[LinuxGamepad] stream error (${currentDevPath}): ${(err as Error).message}`, "controller");
            cleanupStream();
            scheduleRetry();
        });
        stream.on("close", () => {
            cleanupStream();
            scheduleRetry();
        });
    }

    logInfo("[LinuxGamepad] starting reader", "controller");
    open();

    return () => {
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
        stopHeartbeat();
        cleanupStream();
        logInfo("[LinuxGamepad] reader stopped", "controller");
    };
}

import type { WebContents } from "electron";
import { logInfo, logWarn } from "../../shared/logger";

/**
 * Snapshot eines Gamepads, wie er aus dem Preload via IPC kommt. Strukturell
 * angelehnt an die Web-Gamepad-API (`navigator.getGamepads()[i]`), aber serialisiert
 * (keine Live-Referenz). Achsen sind in [-1, 1], Buttons sind boolesch.
 *
 * Der Preload liefert zusaetzlich die Viewport-Groesse (`window.innerWidth/Height`)
 * der Page mit, weil der Frame in einer BrowserView lebt — `getContentSize()` der
 * Parent-Window-WebContents wuerde uns nicht die BrowserView-Groesse geben.
 */
export interface GamepadFrame {
    index: number;
    timestamp: number;
    axes: number[];
    buttons: boolean[];
    viewportWidth: number;
    viewportHeight: number;
}

/**
 * Standard-Mapping (Web-Gamepad-API "standard" mapping):
 *   buttons[0]  = A / Cross
 *   buttons[1]  = B / Circle
 *   buttons[2]  = X / Square
 *   buttons[3]  = Y / Triangle
 *   buttons[4]  = L1
 *   buttons[5]  = R1
 *   buttons[6]  = L2
 *   buttons[7]  = R2
 *   buttons[8]  = Select / Share
 *   buttons[9]  = Start / Options
 *   buttons[10] = L3 (linker Stick-Klick)
 *   buttons[11] = R3 (rechter Stick-Klick)
 *   buttons[12] = D-Pad Up
 *   buttons[13] = D-Pad Down
 *   buttons[14] = D-Pad Left
 *   buttons[15] = D-Pad Right
 *   axes[0]     = Linker Stick X
 *   axes[1]     = Linker Stick Y
 *   axes[2]     = Rechter Stick X
 *   axes[3]     = Rechter Stick Y
 */
export const BTN = {
    A: 0,
    B: 1,
    X: 2,
    Y: 3,
    L1: 4,
    R1: 5,
    L2: 6,
    R2: 7,
    SELECT: 8,
    START: 9,
    L3: 10,
    R3: 11,
    DPAD_UP: 12,
    DPAD_DOWN: 13,
    DPAD_LEFT: 14,
    DPAD_RIGHT: 15,
} as const;

/**
 * Action-Pad-Anker als Eck-Referenz + Pixel-Offset. Robust gegen Window-
 * Resize bei Unity-WebGL-HUDs mit eck-fixierten Buttons (Default fuer
 * praktisch alle Browser-MMORPGs inkl. Flyff Universe).
 */
export interface ActionPadAnchor {
    hAnchor: "left" | "center" | "right";
    vAnchor: "top" | "middle" | "bottom";
    offsetX: number;
    offsetY: number;
}

export function resolveActionPadPixel(
    anchor: ActionPadAnchor,
    viewportWidth: number,
    viewportHeight: number,
): { x: number; y: number } {
    const baseX = anchor.hAnchor === "left"
        ? 0
        : anchor.hAnchor === "center"
            ? viewportWidth / 2
            : viewportWidth;
    const baseY = anchor.vAnchor === "top"
        ? 0
        : anchor.vAnchor === "middle"
            ? viewportHeight / 2
            : viewportHeight;
    return { x: baseX + anchor.offsetX, y: baseY + anchor.offsetY };
}

/**
 * Pickt aus einer rohen Klick-Position die naechste der 9 Anchor-Positionen
 * (Drittel-Aufteilung pro Achse) und gibt den Pixel-Offset zu diesem Anker
 * zurueck. Wird bei der Kalibrierung benutzt.
 */
export function deriveActionPadAnchor(
    clickX: number,
    clickY: number,
    viewportWidth: number,
    viewportHeight: number,
): ActionPadAnchor {
    const w = viewportWidth;
    const h = viewportHeight;
    const fx = w > 0 ? clickX / w : 0.5;
    const fy = h > 0 ? clickY / h : 0.5;

    const hAnchor: ActionPadAnchor["hAnchor"] = fx < 1 / 3 ? "left" : fx > 2 / 3 ? "right" : "center";
    const vAnchor: ActionPadAnchor["vAnchor"] = fy < 1 / 3 ? "top" : fy > 2 / 3 ? "bottom" : "middle";

    const baseX = hAnchor === "left" ? 0 : hAnchor === "center" ? w / 2 : w;
    const baseY = vAnchor === "top" ? 0 : vAnchor === "middle" ? h / 2 : h;

    return {
        hAnchor,
        vAnchor,
        offsetX: clickX - baseX,
        offsetY: clickY - baseY,
    };
}

/**
 * Mapping von Button-Index → Aktion. Aktionen sind entweder Accelerator-Keys
 * ("W", "Space", "Escape", "1"...) oder Special-Actions mit `@`-Prefix:
 *   "@actionPad" — feuert den kalibrierten Action-Pad-Klick
 *   "@cursorMode" — toggelt Cursor-Modus (Stage 3, noch nicht implementiert)
 */
export type ControllerButtonMapping = Record<number, string | null | undefined>;

/**
 * Default-Mapping fuer Standard-Gamepads (PS4/Xbox/SCUF-XInput). Faces folgen
 * der typischen Belegung in 3D-MMORPGs:
 *  - Cross/A → Space (Jump/Action)
 *  - Circle/B → Escape (Menue/Cancel)
 *  - Square/X → Z (Attack)
 *  - Triangle/Y → Tab (naechstes Ziel)
 *  - L1/R1/R2 → Skill-Slots 1/2/3
 *  - L3/R3 → Inventar / Char-Info
 *  - Start → Enter (Chat)
 *  - D-Pad-Up → Action-Pad-Trigger
 *
 * L2 ist absichtlich frei (reserviert fuer Cursor-Modus, Stage 3).
 */
export const DEFAULT_BUTTON_MAPPING: ControllerButtonMapping = {
    [BTN.A]: "Space",
    [BTN.B]: "Escape",
    [BTN.X]: "Z",
    [BTN.Y]: "Tab",
    [BTN.L1]: "1",
    [BTN.R1]: "2",
    [BTN.R2]: "3",
    [BTN.START]: "Return",
    [BTN.L3]: "I",
    [BTN.R3]: "C",
    [BTN.DPAD_UP]: "@actionPad",
};

export interface ControllerInputRouterDeps {
    getActionPadAnchor: (sender: WebContents) => ActionPadAnchor | null;
    /**
     * Liefert das Button-Mapping fuer die Sender-WebContents. Falls kein
     * spezielles Mapping konfiguriert ist, fallback auf DEFAULT_BUTTON_MAPPING.
     */
    getButtonMapping?: (sender: WebContents) => ControllerButtonMapping;
    notify?: (message: string) => void;
}

const ACTION_PAD_DEBOUNCE_MS = 200;
const ACTION_PAD_OFFSET_PX = 18;
const ACTION_PAD_DRIFT_PX = 3;
const ACTION_PAD_DURATION_MIN_MS = 55;
const ACTION_PAD_DURATION_RANGE_MS = 60;

const STICK_DEADZONE = 0.15;
const STICK_KEY_THRESHOLD = 0.4;
const CAMERA_INITIAL_DRAG_PX = 60;     // erster Mausschub in Stick-Richtung
const CAMERA_SPEED_PX = 14;            // Pixel pro Pump-Tick bei voller Auslenkung
const CAMERA_PUMP_INTERVAL_MS = 16;    // ~60 Hz
const CAMERA_EDGE_BUFFER_PX = 80;

function rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

/**
 * Router fuer Controller-Eingaben. Empfaengt Frames vom Preload, erkennt Edges,
 * uebersetzt in synthetische Eingaben (Maus/Tastatur) am Chromium-Input-Layer
 * der Ziel-WebContents.
 *
 * Der Router ist stateful: er merkt sich den vorherigen Frame, damit
 * Knopf-Druck/-Loslassen-Edges erkannt werden. Stick-/Cursor-Logik (Stage 2)
 * wird in derselben Klasse erweitert.
 */
export class ControllerInputRouter {
    private prevButtons: boolean[] = [];
    private prevAxes: number[] = [];
    private actionPadInProgress = false;
    private lastActionPadFireMs = 0;

    /** Aktuell als gehalten registrierte Tasten (KeyDown ohne KeyUp). */
    private heldKeys: Set<string> = new Set();

    /** Camera-Drag-State (rechter Stick). Nur eine Drag-Sequenz gleichzeitig. */
    private cameraActive = false;
    private cameraSender: WebContents | null = null;
    private cameraViewportW = 0;
    private cameraViewportH = 0;
    private cameraStickX = 0;
    private cameraStickY = 0;
    private cameraLastX = 0;
    private cameraLastY = 0;
    private cameraPumpTimer: ReturnType<typeof setInterval> | null = null;

    constructor(private readonly deps: ControllerInputRouterDeps) {}

    handleFrame(frame: GamepadFrame, sender: WebContents): void {
        const buttons = frame.buttons;
        const prev = this.prevButtons;

        // 1) Linker Stick → WASD
        const lx = applyDeadzone(frame.axes[0] ?? 0);
        const ly = applyDeadzone(frame.axes[1] ?? 0);
        this.updateStickKey(sender, "A", lx < -STICK_KEY_THRESHOLD);
        this.updateStickKey(sender, "D", lx > STICK_KEY_THRESHOLD);
        this.updateStickKey(sender, "W", ly < -STICK_KEY_THRESHOLD);
        this.updateStickKey(sender, "S", ly > STICK_KEY_THRESHOLD);

        // 2) Rechter Stick → Kamera-Drag (rechte Maustaste, gepumpt aus Mitte
        //    des Viewports). Solange ausgelenkt: Drag aktiv. Sobald neutral:
        //    MouseUp.
        const rx = applyDeadzone(frame.axes[2] ?? 0);
        const ry = applyDeadzone(frame.axes[3] ?? 0);
        this.updateCameraStick(sender, frame.viewportWidth, frame.viewportHeight, rx, ry);

        // 3) Buttons → Mapping (Tasten oder Special-Actions wie @actionPad).
        //    D-Pad-Up-via-HAT bleibt zusaetzlich aktiv (manche Pads liefern
        //    D-Pad ausschliesslich als Achse).
        const mapping = this.deps.getButtonMapping?.(sender) ?? DEFAULT_BUTTON_MAPPING;
        for (let i = 0; i < buttons.length; i++) {
            const action = mapping[i];
            if (!action) continue;
            const wasDown = prev[i] === true;
            const isDown = buttons[i] === true;
            if (isDown && !wasDown) {
                this.handleButtonDown(sender, action, frame);
            }
            else if (!isDown && wasDown) {
                this.handleButtonUp(sender, action);
            }
        }

        // 4) D-Pad-Up als HAT-Achse (DInput-Modus, keine Buttons-Eintraege).
        //    Triggert immer Action-Pad — ist die einzige sinnvolle Aktion fuer
        //    "POV-Up" auf solchen Controllern.
        if (this.isHatUpEdge(frame)) {
            this.triggerActionPad(sender, frame.viewportWidth, frame.viewportHeight);
        }

        this.prevButtons = buttons.slice();
        this.prevAxes = frame.axes.slice();
    }

    private handleButtonDown(sender: WebContents, action: string, frame: GamepadFrame): void {
        if (action.startsWith("@")) {
            if (action === "@actionPad") {
                this.triggerActionPad(sender, frame.viewportWidth, frame.viewportHeight);
            }
            // andere @-Actions (z.B. @cursorMode) folgen in Stage 3
            return;
        }
        if (this.heldKeys.has(action)) return;
        this.heldKeys.add(action);
        try {
            sender.sendInputEvent({ type: "keyDown", keyCode: action });
        }
        catch (err) {
            logWarn("controller", `keyDown ${action} failed: ${(err as Error).message}`);
        }
    }

    private handleButtonUp(sender: WebContents, action: string): void {
        if (action.startsWith("@")) return;
        if (!this.heldKeys.has(action)) return;
        this.heldKeys.delete(action);
        try {
            sender.sendInputEvent({ type: "keyUp", keyCode: action });
        }
        catch (err) {
            logWarn("controller", `keyUp ${action} failed: ${(err as Error).message}`);
        }
    }

    private updateStickKey(sender: WebContents, keyCode: string, shouldBeHeld: boolean): void {
        const isHeld = this.heldKeys.has(keyCode);
        if (shouldBeHeld && !isHeld) {
            this.heldKeys.add(keyCode);
            try { sender.sendInputEvent({ type: "keyDown", keyCode }); } catch { /* ignore */ }
        }
        else if (!shouldBeHeld && isHeld) {
            this.heldKeys.delete(keyCode);
            try { sender.sendInputEvent({ type: "keyUp", keyCode }); } catch { /* ignore */ }
        }
    }

    private updateCameraStick(
        sender: WebContents,
        viewportWidth: number,
        viewportHeight: number,
        rx: number,
        ry: number,
    ): void {
        this.cameraStickX = rx;
        this.cameraStickY = ry;
        const isDeflected = rx !== 0 || ry !== 0;

        if (isDeflected) {
            if (!this.cameraActive) {
                if (viewportWidth <= 0 || viewportHeight <= 0) return;
                const cx = viewportWidth / 2;
                const cy = viewportHeight / 2;
                const mag = Math.sqrt(rx * rx + ry * ry);
                const nx = mag > 0 ? rx / mag : 0;
                const ny = mag > 0 ? ry / mag : 0;
                const initialX = clamp(cx + nx * CAMERA_INITIAL_DRAG_PX, 0, viewportWidth);
                const initialY = clamp(cy + ny * CAMERA_INITIAL_DRAG_PX, 0, viewportHeight);
                try {
                    sender.sendInputEvent({ type: "mouseMove", x: Math.round(cx), y: Math.round(cy) });
                    sender.sendInputEvent({
                        type: "mouseDown",
                        x: Math.round(cx),
                        y: Math.round(cy),
                        button: "right",
                        clickCount: 1,
                    });
                    sender.sendInputEvent({
                        type: "mouseMove",
                        x: Math.round(initialX),
                        y: Math.round(initialY),
                    });
                }
                catch (err) {
                    logWarn("controller", `cameraStart failed: ${(err as Error).message}`);
                    return;
                }
                this.cameraSender = sender;
                this.cameraViewportW = viewportWidth;
                this.cameraViewportH = viewportHeight;
                this.cameraLastX = initialX;
                this.cameraLastY = initialY;
                this.cameraActive = true;
                if (this.cameraPumpTimer) clearInterval(this.cameraPumpTimer);
                this.cameraPumpTimer = setInterval(() => this.pumpCamera(), CAMERA_PUMP_INTERVAL_MS);
            }
            else {
                this.cameraViewportW = viewportWidth;
                this.cameraViewportH = viewportHeight;
                this.cameraSender = sender;
            }
        }
        else if (this.cameraActive) {
            this.stopCameraDrag();
        }
    }

    private pumpCamera(): void {
        if (!this.cameraActive) return;
        const wc = this.cameraSender;
        if (!wc || wc.isDestroyed()) {
            this.stopCameraDrag();
            return;
        }
        const w = this.cameraViewportW;
        const h = this.cameraViewportH;
        const dx = this.cameraStickX * CAMERA_SPEED_PX;
        const dy = this.cameraStickY * CAMERA_SPEED_PX;
        let newX = this.cameraLastX + dx;
        let newY = this.cameraLastY + dy;

        const buf = CAMERA_EDGE_BUFFER_PX;
        const needsReset = newX < buf || newX > w - buf || newY < buf || newY > h - buf;

        try {
            if (needsReset) {
                // MouseUp am letzten Punkt, dann frischer Down von der Mitte —
                // sonst wuerde die Kamera am Rand "feststecken".
                wc.sendInputEvent({
                    type: "mouseUp",
                    x: Math.round(this.cameraLastX),
                    y: Math.round(this.cameraLastY),
                    button: "right",
                    clickCount: 1,
                });
                const cx = w / 2;
                const cy = h / 2;
                wc.sendInputEvent({ type: "mouseMove", x: Math.round(cx), y: Math.round(cy) });
                wc.sendInputEvent({
                    type: "mouseDown",
                    x: Math.round(cx),
                    y: Math.round(cy),
                    button: "right",
                    clickCount: 1,
                });
                newX = clamp(cx + dx, 0, w);
                newY = clamp(cy + dy, 0, h);
            }
            wc.sendInputEvent({ type: "mouseMove", x: Math.round(newX), y: Math.round(newY) });
        }
        catch (err) {
            logWarn("controller", `cameraPump failed: ${(err as Error).message}`);
            this.stopCameraDrag();
            return;
        }
        this.cameraLastX = newX;
        this.cameraLastY = newY;
    }

    private stopCameraDrag(): void {
        if (this.cameraPumpTimer) {
            clearInterval(this.cameraPumpTimer);
            this.cameraPumpTimer = null;
        }
        const wc = this.cameraSender;
        if (this.cameraActive && wc && !wc.isDestroyed()) {
            try {
                wc.sendInputEvent({
                    type: "mouseUp",
                    x: Math.round(this.cameraLastX),
                    y: Math.round(this.cameraLastY),
                    button: "right",
                    clickCount: 1,
                });
            }
            catch { /* ignore */ }
        }
        this.cameraActive = false;
        this.cameraSender = null;
    }

    private isHatUpEdge(frame: GamepadFrame): boolean {
        const axes = frame.axes;
        if (axes.length < 2) return false;
        // Heuristik: HAT auf den letzten zwei Achsen (X, Y).
        const xIdx = axes.length - 2;
        const yIdx = axes.length - 1;
        const curX = axes[xIdx] ?? 0;
        const curY = axes[yIdx] ?? 0;
        const oldY = this.prevAxes[yIdx] ?? 0;
        const wasNotUp = oldY > -0.5;
        const isPureUp = curY <= -0.7 && Math.abs(curX) < 0.5;
        return wasNotUp && isPureUp;
    }

    private isEdgeDown(prev: boolean[], curr: boolean[], idx: number): boolean {
        const before = prev[idx] === true;
        const after = curr[idx] === true;
        return !before && after;
    }

    /**
     * Action-Pad-Trigger: organischer Maus-Klick an der per Lehrmodus gesetzten
     * Position. Pixel-Offset, Druckdauer und Drift sind pro Press random — keine
     * konstante Sequenz, kein pixelgenauer Repeat. Wenn keine Position gesetzt
     * ist, passiert nichts (kein Blind-Klick auf die Bildschirmmitte).
     *
     * `webContents.sendInputEvent` injiziert Events am Chromium-Input-Layer →
     * `MouseEvent.isTrusted = true` fuer die Page, ununterscheidbar von echtem
     * Hardware-Input. OS-Cursor wird NICHT bewegt — User kann die Maus weiter
     * normal benutzen.
     */
    private triggerActionPad(wc: WebContents, viewportWidth: number, viewportHeight: number): void {
        if (!wc || wc.isDestroyed()) return;

        const anchor = this.deps.getActionPadAnchor(wc);
        if (!anchor) {
            this.deps.notify?.("Bitte zuerst Action-Pad kalibrieren");
            return;
        }

        const size = { width: viewportWidth, height: viewportHeight };
        if (size.width <= 0 || size.height <= 0) return;

        const resolved = resolveActionPadPixel(anchor, viewportWidth, viewportHeight);

        const now = Date.now();
        if (now - this.lastActionPadFireMs < ACTION_PAD_DEBOUNCE_MS) return;
        if (this.actionPadInProgress) return;
        this.lastActionPadFireMs = now;
        this.actionPadInProgress = true;

        const cx = resolved.x;
        const cy = resolved.y;
        const ox = (Math.random() - 0.5) * ACTION_PAD_OFFSET_PX * 2;
        const oy = (Math.random() - 0.5) * ACTION_PAD_OFFSET_PX * 2;
        const baseX = clamp(cx + ox, 0, size.width);
        const baseY = clamp(cy + oy, 0, size.height);

        const totalMs = rand(
            ACTION_PAD_DURATION_MIN_MS,
            ACTION_PAD_DURATION_MIN_MS + ACTION_PAD_DURATION_RANGE_MS
        );
        const dx = (Math.random() - 0.5) * ACTION_PAD_DRIFT_PX * 2;
        const dy = (Math.random() - 0.5) * ACTION_PAD_DRIFT_PX * 2;
        const driftX = clamp(baseX + dx, 0, size.width);
        const driftY = clamp(baseY + dy, 0, size.height);

        try {
            // Pre-Move auf die Klick-Position, dann Down. Realistischer und
            // hilft Pages, die separate mousemove- und mousedown-Events erwarten.
            wc.sendInputEvent({
                type: "mouseMove",
                x: Math.round(baseX),
                y: Math.round(baseY),
            });
            wc.sendInputEvent({
                type: "mouseDown",
                x: Math.round(baseX),
                y: Math.round(baseY),
                button: "left",
                clickCount: 1,
            });
        } catch (err) {
            logWarn("controller", `actionPad mouseDown failed: ${(err as Error).message}`);
            this.actionPadInProgress = false;
            return;
        }

        // Mid-Move + Up nach randomisierter Druckdauer.
        setTimeout(() => {
            if (wc.isDestroyed()) {
                this.actionPadInProgress = false;
                return;
            }
            try {
                wc.sendInputEvent({
                    type: "mouseMove",
                    x: Math.round(driftX),
                    y: Math.round(driftY),
                });
                wc.sendInputEvent({
                    type: "mouseUp",
                    x: Math.round(driftX),
                    y: Math.round(driftY),
                    button: "left",
                    clickCount: 1,
                });
            } catch (err) {
                logWarn("controller", `actionPad mouseUp failed: ${(err as Error).message}`);
            } finally {
                this.actionPadInProgress = false;
            }
        }, totalMs);
    }

    /** Reset bei Window-Wechsel oder Disable: gehaltene Tasten lockerlassen,
     *  Camera-Drag beenden, Edge-Tracking nullen. */
    reset(): void {
        // Held-Keys sauber loslassen — sonst laeuft der Char weiter, weil ein
        // KeyDown ohne KeyUp im Spiel haengen bleibt.
        const sender = this.cameraSender;
        if (sender && !sender.isDestroyed()) {
            for (const keyCode of this.heldKeys) {
                try { sender.sendInputEvent({ type: "keyUp", keyCode }); } catch { /* ignore */ }
            }
        }
        this.heldKeys.clear();
        this.stopCameraDrag();
        this.prevButtons = [];
        this.prevAxes = [];
        this.actionPadInProgress = false;
    }
}

function applyDeadzone(value: number): number {
    return Math.abs(value) < STICK_DEADZONE ? 0 : value;
}

function clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

/**
 * Erstellt die Manager-Instanz mit Lifecycle-Methoden. Wird typischerweise
 * einmalig in `coreServices` instanziiert und bei jedem Frame aus dem IPC-
 * Handler `controller:frame` aufgerufen.
 */
export function createControllerInputRouter(deps: ControllerInputRouterDeps): ControllerInputRouter {
    logInfo("controller", "ControllerInputRouter initialized");
    return new ControllerInputRouter(deps);
}


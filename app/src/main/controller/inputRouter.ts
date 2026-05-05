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

export interface ActionPadAnchor {
    x: number;  // 0..1
    y: number;  // 0..1
}

export interface ControllerInputRouterDeps {
    /**
     * Liefert den Action-Pad-Anker (Bruchteil 0..1 der Window-Groesse) fuer die
     * Sender-WebContents (z.B. anhand der Profil-ID, die ueber das Partition-
     * Mapping gefunden wird). `null` falls nicht kalibriert.
     */
    getActionPadAnchor: (sender: WebContents) => ActionPadAnchor | null;

    /**
     * Optionale Toast-Anzeige (z.B. "Bitte erst Action-Pad kalibrieren").
     */
    notify?: (message: string) => void;
}

const ACTION_PAD_DEBOUNCE_MS = 200;
const ACTION_PAD_OFFSET_PX = 18;
const ACTION_PAD_DRIFT_PX = 3;
const ACTION_PAD_DURATION_MIN_MS = 55;
const ACTION_PAD_DURATION_RANGE_MS = 60;

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
    private actionPadInProgress = false;
    private lastActionPadFireMs = 0;

    constructor(private readonly deps: ControllerInputRouterDeps) {}

    /**
     * Verarbeitet einen einzelnen Gamepad-Frame. Aufgerufen vom IPC-Handler,
     * der Frames vom Preload empfaengt. `sender` ist die WebContents in der
     * Flyff laeuft (BrowserView-WebContents) — Klicks und Tastendruecke werden
     * direkt dorthin geschickt.
     */
    handleFrame(frame: GamepadFrame, sender: WebContents): void {
        const buttons = frame.buttons;
        const prev = this.prevButtons;

        // D-Pad-Up: Edge-Detect (nicht gedrueckt → gedrueckt) → Action-Pad-Trigger.
        // Manche Controller (SCUF DInput-Modus etc.) liefern D-Pad als HAT-Achse
        // axes[9] (Standard-Mapping POV als fraktionalem Wert). Beide Pfade
        // werden hier abgedeckt.
        const dpadUpFromButtons = this.isEdgeDown(prev, buttons, BTN.DPAD_UP);
        const dpadUpFromHat = this.isHatUpEdge(frame);
        if (dpadUpFromButtons || dpadUpFromHat) {
            this.triggerActionPad(sender, frame.viewportWidth, frame.viewportHeight);
        }

        // (Stage 2: weitere Buttons + Sticks hier)

        this.prevButtons = buttons.slice();
        this.prevAxes = frame.axes.slice();
    }

    /**
     * Erkennt D-Pad-Up auf einer HAT-Achse. Standard-Mapping kennt kein POV-Hat
     * direkt, aber im "non-standard"-Modus liefern viele Pads axes[9] (oder eine
     * der hoeheren Achsen) mit einem POV-Wert -1..1, wobei -1 ungefaehr Up
     * bedeutet. Wir erkennen Edge: Achse > -0.5 (kein Up) → Achse <= -0.7 (Up).
     */
    private prevAxes: number[] = [];

    private isHatUpEdge(frame: GamepadFrame): boolean {
        const axes = frame.axes;
        const prev = this.prevAxes;
        // axes[7] (Y) bei vielen Pads, axes[9] bei Standard-Web-Gamepad-API,
        // oder axes[5] / axes[6] je nach Treiber. Wir scannen alle Achsen ab
        // Index 4 (nach den zwei Sticks) auf eine, die jetzt <= -0.7 ist und
        // vorher > -0.5 war.
        for (let i = 4; i < axes.length; i++) {
            const cur = axes[i];
            const old = prev[i] ?? 0;
            if (cur <= -0.7 && old > -0.5) return true;
        }
        return false;
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

        const now = Date.now();
        if (now - this.lastActionPadFireMs < ACTION_PAD_DEBOUNCE_MS) return;
        if (this.actionPadInProgress) return;
        this.lastActionPadFireMs = now;
        this.actionPadInProgress = true;

        const cx = size.width * anchor.x;
        const cy = size.height * anchor.y;
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

    /** Reset bei Window-Wechsel oder Disable, damit keine Edge-Phantome auftauchen. */
    reset(): void {
        this.prevButtons = [];
        this.prevAxes = [];
        this.actionPadInProgress = false;
    }
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


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
 * Symbolische Button-Namen — User-friendly statt numerischer Indizes. Der
 * Router uebersetzt zwischen Index (frame.buttons[i]) und Name via BTN_INDEX_TO_NAME.
 */
export const BUTTON_NAMES = [
    "a", "b", "x", "y",
    "l1", "r1", "l2", "r2",
    "select", "start", "l3", "r3",
    "dpadUp", "dpadDown", "dpadLeft", "dpadRight",
] as const;
export type ButtonName = typeof BUTTON_NAMES[number];

export const BTN_INDEX_TO_NAME: Record<number, ButtonName> = {
    [BTN.A]: "a",
    [BTN.B]: "b",
    [BTN.X]: "x",
    [BTN.Y]: "y",
    [BTN.L1]: "l1",
    [BTN.R1]: "r1",
    [BTN.L2]: "l2",
    [BTN.R2]: "r2",
    [BTN.SELECT]: "select",
    [BTN.START]: "start",
    [BTN.L3]: "l3",
    [BTN.R3]: "r3",
    [BTN.DPAD_UP]: "dpadUp",
    [BTN.DPAD_DOWN]: "dpadDown",
    [BTN.DPAD_LEFT]: "dpadLeft",
    [BTN.DPAD_RIGHT]: "dpadRight",
};

/**
 * Mapping von Button-Index → Aktion. Aktionen sind entweder Accelerator-Keys
 * ("W", "Space", "Escape", "1"...) oder Special-Actions mit `@`-Prefix:
 *   "@actionPad"      — feuert den kalibrierten Action-Pad-Klick
 *   "@zoomIn"/"@zoomOut" — synthetisches mouseWheel (Bildschirm-Mitte)
 *   "@cursorHold"     — solange gehalten: rechter Stick → Maus, A → Klick
 *   "@cursorToggle"   — Tippen schaltet Cursor-Modus um (statt Halten)
 *   "@nextTab"/"@prevTab" — Slot-/Tab-Wechsel im Session-Window
 *   "@reloadView"     — aktuelle Game-View neu laden
 *   "@toggleFullscreen" — Launcher-Window Fullscreen togglen
 *   "@openConfig"     — Launcher Settings-Modal oeffnen
 */
export type ControllerButtonMapping = Record<number, string | null | undefined>;

/**
 * Default-Mapping fuer Standard-Gamepads (PS4/Xbox/SCUF-XInput). Synchron zur
 * Android-App ab v33:
 *  - Cross/A → Space (Jump/Action)
 *  - Circle/B → Escape (Menue/Cancel)
 *  - Square/X → Z (Attack)
 *  - Triangle/Y → Tab (naechstes Ziel)
 *  - L1/R1/R2 → Skill-Slots 1/2/3
 *  - L2       → @cursorHold (rechter Stick wird zur Maus solange gehalten)
 *  - L3/R3    → Inventar / Char-Info
 *  - Start    → Enter (Chat)
 *  - D-Pad ↑/↓ → Zoom +/− (mouseWheel)
 *  - D-Pad ←/→ → Slot-/Tab-Wechsel (@prevTab/@nextTab)
 *
 * Action-Pad-Trigger ist NICHT mehr Default — User muss `@actionPad`
 * manuell auf einen Button legen (z.B. Select).
 */
export const DEFAULT_BUTTON_MAPPING: ControllerButtonMapping = {
    [BTN.A]: "Space",
    [BTN.B]: "Escape",
    [BTN.X]: "Z",
    [BTN.Y]: "Tab",
    [BTN.L1]: "1",
    [BTN.R1]: "2",
    [BTN.L2]: "@cursorHold",
    [BTN.R2]: "3",
    [BTN.START]: "Return",
    [BTN.L3]: "I",
    [BTN.R3]: "C",
    [BTN.DPAD_UP]: "@zoomIn",
    [BTN.DPAD_DOWN]: "@zoomOut",
    [BTN.DPAD_LEFT]: "@prevTab",
    [BTN.DPAD_RIGHT]: "@nextTab",
};

/**
 * Erzeugt aus einem Per-Profil-Button-Override (symbolische Namen) und dem
 * Default ein vollstaendiges Mapping (Index → Action). Override-Werte:
 *   string  → benutze diesen Wert (Tasten-Code oder @-Action)
 *   null    → explizit unbelegt (KEIN Default)
 *   undef   → Default verwenden
 */
export function resolveButtonMapping(
    override: Partial<Record<ButtonName, string | null | undefined>> | undefined,
): ControllerButtonMapping {
    const out: ControllerButtonMapping = { ...DEFAULT_BUTTON_MAPPING };
    if (!override) return out;
    for (const [idxStr, name] of Object.entries(BTN_INDEX_TO_NAME)) {
        const idx = Number(idxStr);
        const v = override[name];
        if (v === null) {
            out[idx] = null;        // explizit unbelegt
        }
        else if (typeof v === "string" && v.length > 0) {
            out[idx] = v;            // expliziter Override
        }
        // else (undefined): Default beibehalten
    }
    return out;
}

/** Schulter-Slot der als Modifier wirkt (gehalten + anderer Button → alternative
 *  Aktion). */
export type ModifierSlot = "l1" | "r1" | "l2" | "r2";

const MODIFIER_SLOTS: Array<{ slot: ModifierSlot; index: number }> = [
    { slot: "l1", index: BTN.L1 },
    { slot: "r1", index: BTN.R1 },
    { slot: "l2", index: BTN.L2 },
    { slot: "r2", index: BTN.R2 },
];

export interface ControllerInputRouterDeps {
    getActionPadAnchor: (sender: WebContents) => ActionPadAnchor | null;
    /**
     * Liefert das Button-Mapping fuer die Sender-WebContents. Falls kein
     * spezielles Mapping konfiguriert ist, fallback auf DEFAULT_BUTTON_MAPPING.
     */
    getButtonMapping?: (sender: WebContents) => ControllerButtonMapping;
    /**
     * Liefert das Modifier-Mapping fuer eine Schulter (l1/r1/l2/r2). Wenn die
     * Schulter gehalten wird und ein dort gemappter Button gedrueckt wird,
     * ueberschreibt das Modifier-Mapping den Default-Eintrag fuer diesen Button.
     */
    getModifierMapping?: (sender: WebContents, slot: ModifierSlot) => ControllerButtonMapping | null;
    /**
     * Wird aufgerufen wenn ein Button auf eine `@<action>`-Special-Action gemappt
     * ist, die nicht `@actionPad` ist (z.B. `@nextTab`). Implementierung im
     * Main-Process (Session-Manager / Launcher-Window) verdrahtet.
     */
    onLauncherAction?: (action: string, sender: WebContents) => void;
    /**
     * Buffer-Forward-Ziel fuer ein Profil: solange `@forwardHold` gehalten wird,
     * gehen alle Inputs an die hier zurueckgegebene WebContents statt an den
     * Vordergrund-Sender. `null`/`undefined` = kein Forward-Ziel konfiguriert
     * (Hold-Action zeigt nur Hinweis, keine Aktion).
     */
    getBufferTarget?: (sender: WebContents) => WebContents | null;
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
const CURSOR_SPEED_PX = 12;            // Pixel pro Pump-Tick bei voller Auslenkung
const CURSOR_PUMP_INTERVAL_MS = 16;    // ~60 Hz
const ZOOM_DELTA_Y = 100;              // mouseWheel deltaY pro Zoom-Trigger

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

    /** Aktuell als gehalten registrierte Tasten (KeyDown ohne KeyUp). Wird
     *  von Stick-Keys (W/A/S/D) UND Buttons gemeinsam genutzt — Set verhindert
     *  doppeltes KeyDown wenn beide Quellen die gleiche Taste wollen. */
    private heldKeys: Set<string> = new Set();

    /** Pro gehaltener Taste die WebContents an die das KeyDown gegangen ist.
     *  Wichtig fuer Ringmaster-Forward: wenn das DOWN waehrend Hold an
     *  forwardTarget ging, muss das UP AUCH an forwardTarget gehen — sonst
     *  bleibt die Taste im Buffer-Tab "haengen" und feuert weiter (Stuck-Key
     *  Bug). Sender (Vordergrund) kriegt sonst falsch das keyUp.
     *  Wird parallel zu heldKeys gepflegt; gleiche Taste von zwei Quellen
     *  (Stick UND Button) → letzter target gewinnt, refcount via heldKeys/
     *  heldButtonActions weiterhin korrekt. */
    private heldKeyTarget: Map<string, WebContents> = new Map();

    /** Pro Button-Index (0..15) die Aktion, die beim Press emittiert wurde.
     *  Wichtig fuer Modifier-Layer: wenn der User L1+A drueckt und dann L1
     *  loslaesst bevor A losgelassen ist, soll trotzdem die ModifierTaste
     *  freigegeben werden, nicht der Default. Ohne dieses Tracking wuerde
     *  beim Release die *aktuelle* Effektiv-Aktion benutzt — falsch.
     *  Refcounted: mehrere Buttons mit gleicher Aktion → KeyUp erst beim letzten. */
    private heldButtonActions: Map<number, string> = new Map();

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

    /** Buffer-Forward-State: solange `@forwardHold` gehalten wird, route alle
     *  Inputs an `forwardTarget` statt den `sender`. Hold-Button selbst muss
     *  weiter lokal verarbeitet werden, damit das UP forwarding deaktiviert.
     *
     *  Aktivierung: dispatchSpecial(`@forwardHold`, down=true) bekommt vom Dep
     *  `getBufferTarget(sender)` die Ziel-WebContents. Setzt forwardActive=true
     *  + forwardTarget. Beim UP wird forwardActive=false + forwardTarget=null.
     *
     *  Cross-Profile-Routing einfacher als auf Android weil alle BrowserViews
     *  im selben Main-Process leben — sender.sendInputEvent direkt an
     *  forwardTarget reicht. */
    private forwardActive = false;
    private forwardTarget: WebContents | null = null;

    /** Schuetzt unseren prevButtons-Reset in setForwardMode davor, am Ende
     *  des aktuellen handleFrame-Calls von `this.prevButtons = buttons.slice()`
     *  wieder ueberschrieben zu werden. Wird nach dem Skip im naechsten
     *  Frame zurueckgesetzt. */
    private skipPrevButtonsUpdate = false;

    /** Cursor-Modus: rechter Stick wird zum Maus-Mover statt Camera-Drag.
     *  A im Cursor-Modus = Maus-Klick links an aktueller Cursor-Position. */
    private mode: "normal" | "cursor" = "normal";
    private cursorX = 0;
    private cursorY = 0;
    private cursorInitialized = false;
    private cursorMouseDown = false;
    private cursorStickX = 0;
    private cursorStickY = 0;
    private cursorSender: WebContents | null = null;
    private cursorViewportW = 0;
    private cursorViewportH = 0;
    private cursorPumpTimer: ReturnType<typeof setInterval> | null = null;

    constructor(private readonly deps: ControllerInputRouterDeps) {}

    handleFrame(frame: GamepadFrame, sender: WebContents): void {
        const buttons = frame.buttons;
        const prev = this.prevButtons;

        // Buffer-Forward: solange `@forwardHold` aktiv ist, alle Sticks +
        // Buttons (ausser dem Hold-Button selbst) an `forwardTarget` routen.
        // Der "effektive sender" fuer Stick/Button-Output ist dann der Target
        // statt der Vordergrund-Sender. Hold-Button wird unten in
        // handleButtonDown/Up immer mit dem `sender` (Vordergrund) verarbeitet,
        // damit das UP zuverlaessig ankommt.
        const effectiveSender: WebContents = (this.forwardActive && this.forwardTarget && !this.forwardTarget.isDestroyed())
            ? this.forwardTarget
            : sender;

        // 1) Linker Stick → WASD (an effectiveSender)
        const lx = applyDeadzone(frame.axes[0] ?? 0);
        const ly = applyDeadzone(frame.axes[1] ?? 0);
        this.updateStickKey(effectiveSender, "A", lx < -STICK_KEY_THRESHOLD);
        this.updateStickKey(effectiveSender, "D", lx > STICK_KEY_THRESHOLD);
        this.updateStickKey(effectiveSender, "W", ly < -STICK_KEY_THRESHOLD);
        this.updateStickKey(effectiveSender, "S", ly > STICK_KEY_THRESHOLD);

        // 2) Rechter Stick → Kamera-Drag (rechte Maustaste, gepumpt aus Mitte
        //    des Viewports). Solange ausgelenkt: Drag aktiv. Sobald neutral:
        //    MouseUp. Auch an effectiveSender geroutet.
        const rx = applyDeadzone(frame.axes[2] ?? 0);
        const ry = applyDeadzone(frame.axes[3] ?? 0);
        this.updateCameraStick(effectiveSender, frame.viewportWidth, frame.viewportHeight, rx, ry);

        // 3) Buttons → Mapping (Tasten oder Special-Actions wie @actionPad).
        //    Modifier-Layer: wenn eine Schulter (L1/R1/L2/R2) mit eigenem
        //    Modifier-Mapping gehalten wird, ueberschreibt deren Eintrag das
        //    Default-Mapping fuer den jeweiligen Button.
        //    D-Pad-Up-via-HAT bleibt zusaetzlich aktiv (manche Pads liefern
        //    D-Pad ausschliesslich als Achse).
        const baseMapping = this.deps.getButtonMapping?.(sender) ?? DEFAULT_BUTTON_MAPPING;

        // Aktive Modifier-Layer: Schultern die jetzt gerade gehalten werden
        // UND ein nicht-leeres Modifier-Mapping haben. Reihenfolge entspricht
        // MODIFIER_SLOTS — bei mehreren gleichzeitig haltenden Schultern
        // gewinnt der erstdefinierte mit Override fuer den Button.
        const activeModifiers: ControllerButtonMapping[] = [];
        if (this.deps.getModifierMapping) {
            for (const { slot, index } of MODIFIER_SLOTS) {
                if (buttons[index] !== true) continue;
                const mod = this.deps.getModifierMapping(sender, slot);
                if (mod && Object.keys(mod).length > 0) activeModifiers.push(mod);
            }
        }
        const resolveAction = (i: number): string | null | undefined => {
            for (const mod of activeModifiers) {
                if (i in mod) return mod[i]; // explizit gesetzt (auch null = unbind)
            }
            return baseMapping[i];
        };

        for (let i = 0; i < buttons.length; i++) {
            const wasDown = prev[i] === true;
            const isDown = buttons[i] === true;
            if (isDown && !wasDown) {
                const action = resolveAction(i);
                if (!action) continue;
                // Hold-Buttons fuer @forwardHold IMMER mit dem originalen
                // Vordergrund-`sender` verarbeiten — sonst verliert die
                // Mapping-Resolution beim UP den Bezug.
                const isForwardHold = action === "@forwardHold";
                const target = (this.forwardActive && !isForwardHold && this.forwardTarget && !this.forwardTarget.isDestroyed())
                    ? this.forwardTarget
                    : sender;
                this.handleButtonDown(target, i, action, frame, sender);
            }
            else if (!isDown && wasDown) {
                // UP geht an den Sender wo der DOWN registriert wurde — wird
                // via heldButtonActions automatisch korrekt verfolgt.
                this.handleButtonUp(sender, i);
            }
        }

        // 4) D-Pad-Up als HAT-Achse (DInput-Modus, keine Buttons-Eintraege).
        //    Triggert immer Action-Pad — ist die einzige sinnvolle Aktion fuer
        //    "POV-Up" auf solchen Controllern.
        if (this.isHatUpEdge(frame)) {
            this.triggerActionPad(sender, frame.viewportWidth, frame.viewportHeight);
        }

        // setForwardMode (in dispatchSpecial waehrend dieses Frames gerufen)
        // hat moeglicherweise prevButtons gezielt zurueckgesetzt damit der
        // NAECHSTE Frame Edges fuer noch-gehaltene Buttons sieht. Wenn das
        // Flag gesetzt ist, ueberschreiben wir den Reset NICHT.
        if (this.skipPrevButtonsUpdate) {
            this.skipPrevButtonsUpdate = false;
        } else {
            this.prevButtons = buttons.slice();
        }
        this.prevAxes = frame.axes.slice();
    }

    private handleButtonDown(sender: WebContents, btnIdx: number, action: string, frame: GamepadFrame, originalSender?: WebContents): void {
        // Bereits getrackt? (Re-Press ohne Release zwischen den Frames — selten,
        // aber moeglich bei Frame-Drops.)
        if (this.heldButtonActions.has(btnIdx)) return;
        // Special-Actions auch tracken — damit (a) der Modifier-Loop in
        // handleFrame die gehaltene Schulter sieht (auch bei `@cursorHold`)
        // und (b) Hold-Specials beim UP sauber zurueckgesetzt werden.
        this.heldButtonActions.set(btnIdx, action);
        if (action.startsWith("@")) {
            // Specials immer mit originalSender (Vordergrund-WebContents) —
            // damit @forwardHold das forwarding-Ziel korrekt aufloesen kann
            // (via getBufferTarget(originalSender)) und @nextTab/@reload etc.
            // an der originalen Session-Window operieren statt am Buffer-Ziel.
            this.dispatchSpecial(action, originalSender ?? sender, frame, true, btnIdx);
            return;
        }
        // Cursor-Modus: A → Maus-Klick links an aktueller Cursor-Position.
        // Andere Tasten gehen normal als KeyDown durch — User kann Skills
        // im Cursor-Modus nutzen.
        if (this.mode === "cursor" && btnIdx === BTN.A) {
            this.cursorMouseDown = true;
            this.dispatchCursorMouse(sender, "mouseDown");
            return;
        }
        // KeyDown nur emittieren wenn die Taste nicht schon anderweitig gehalten
        // wird (z.B. zweiter Button auf gleiche Taste, oder Stick-Key).
        if (this.heldKeys.has(action)) {
            // Refcount-Case: action wird schon gehalten (gleiche Taste von
            // anderer Quelle). Wir senden kein zweites keyDown, aber wir
            // updaten den Target auf den aktuellen sender — beim UP soll's
            // dann an die zuletzt registrierte WebContents gehen.
            this.heldKeyTarget.set(action, sender);
            return;
        }
        this.heldKeys.add(action);
        this.heldKeyTarget.set(action, sender);
        try {
            sender.sendInputEvent({ type: "keyDown", keyCode: action });
        }
        catch (err) {
            logWarn("controller", `keyDown ${action} failed: ${(err as Error).message}`);
        }
    }

    private handleButtonUp(sender: WebContents, btnIdx: number): void {
        // Welche Aktion wurde fuer diesen Button beim Press emittiert? Nicht
        // die aktuelle Effektiv-Aktion benutzen — die kann sich durch
        // Modifier-Wechsel mid-press geaendert haben.
        const action = this.heldButtonActions.get(btnIdx);
        if (!action) return;
        this.heldButtonActions.delete(btnIdx);
        if (action.startsWith("@")) {
            this.dispatchSpecial(action, sender, null, false, btnIdx);
            return;
        }
        // Cursor-Modus A-Tap-Release.
        if (this.mode === "cursor" && btnIdx === BTN.A && this.cursorMouseDown) {
            this.cursorMouseDown = false;
            this.dispatchCursorMouse(sender, "mouseUp");
            return;
        }
        // Wird die Aktion noch von einem anderen Button gehalten? Refcounting
        // ueber heldButtonActions.values() — nicht freigeben.
        for (const a of this.heldButtonActions.values()) {
            if (a === action) return;
        }
        if (!this.heldKeys.has(action)) return;
        this.heldKeys.delete(action);
        // UP an dem WebContents wo der DOWN hingegangen ist (Ringmaster-Forward-
        // Fix). `sender` ist der aktuelle Vordergrund — der kann nach Hold-
        // Aktivierung/Deaktivierung anders sein als der target des DOWN-Events.
        const target = this.heldKeyTarget.get(action) ?? sender;
        this.heldKeyTarget.delete(action);
        try {
            target.sendInputEvent({ type: "keyUp", keyCode: action });
        }
        catch (err) {
            logWarn("controller", `keyUp ${action} failed: ${(err as Error).message}`);
        }
    }

    /**
     * Zentraler Dispatch fuer `@`-Actions. `down`-Param erlaubt Hold-Specials
     * wie `@cursorHold` UP zu sehen; Edge-Specials (@actionPad, @zoomIn,
     * @nextTab, @openConfig, ...) ignorieren UP. `frame` ist nur bei DOWN noetig
     * (fuer Viewport-Groesse beim Action-Pad/Zoom); bei UP optional.
     */
    private dispatchSpecial(
        action: string,
        sender: WebContents,
        frame: GamepadFrame | null,
        down: boolean,
        btnIdx: number = -1,
    ): void {
        switch (action) {
            case "@cursorHold":
                this.setMode(down ? "cursor" : "normal", sender, frame);
                return;
            case "@cursorToggle":
                if (down) this.setMode(this.mode === "cursor" ? "normal" : "cursor", sender, frame);
                return;
            case "@forwardHold":
                this.setForwardMode(down, sender, btnIdx);
                return;
            case "@actionPad":
                if (down && frame) {
                    this.triggerActionPad(sender, frame.viewportWidth, frame.viewportHeight);
                }
                return;
            case "@zoomIn":
                if (down && frame) this.triggerZoom(sender, frame, -ZOOM_DELTA_Y);
                return;
            case "@zoomOut":
                if (down && frame) this.triggerZoom(sender, frame, ZOOM_DELTA_Y);
                return;
            default:
                // Externe Specials (@nextTab, @prevTab, @reloadView,
                // @toggleFullscreen, @openConfig, ...) — DOWN only, dispatcht
                // der Main-Process via onLauncherAction.
                if (down) this.deps.onLauncherAction?.(action, sender);
                return;
        }
    }

    /**
     * Setzt den Buffer-Forward-Modus. Beim DOWN: Ziel-WebContents vom Dep
     * abfragen; alle gerade gehaltenen lokalen Inputs (WASD/Camera/Skill)
     * auf dem `sender` released, damit der Vordergrund-Char nicht weiter-
     * laeuft. Beim UP: alle in der Forward-Phase gehaltenen Inputs werden
     * auf dem Ziel released.
     *
     * Wichtig 1: heldButtonActions wird NICHT komplett geleert — der
     * @forwardHold-Eintrag selbst bleibt drin, damit das UP korrekt findet
     * dass der Hold ein Special war (analog Android v41-Fix).
     *
     * Wichtig 2: prevButtons wird zurueckgesetzt, damit der naechste Frame
     * fuer noch GEDRUECKT-GEHALTENE Buttons (z.B. X den der User schon vor
     * dem Hold hielt) einen frischen Edge-Trigger sieht und sie an den NEUEN
     * Target dispatcht. Ohne diesen Reset wuerde X stumm bleiben weil
     * isDown=wasDown=true → kein Edge → kein neuer keyDown am Buffer-Tab.
     * Hold-Button-Eintrag in heldButtonActions blockt seinen eigenen
     * Re-Trigger.
     */
    private setForwardMode(activate: boolean, sender: WebContents, holdBtnIdx: number = -1): void {
        if (activate) {
            if (this.forwardActive) return; // idempotent
            const target = this.deps.getBufferTarget?.(sender) ?? null;
            if (!target || target.isDestroyed()) {
                this.deps.notify?.("Kein Ringmaster-Ziel im Profil konfiguriert");
                return;
            }
            // Lokale gehaltene Bindings auf sender loesen — aber nur Stick-
            // Keys + Skill-Tasten, NICHT die Special-Hold-Trackings (sonst
            // verlieren wir das @forwardHold-Tracking selbst und das UP findet
            // es nicht mehr).
            this.releaseLocalInputsExceptSpecials(sender);
            this.forwardActive = true;
            this.forwardTarget = target;
            // Edge-Tracking gezielt setzen: alle Buttons "false" markieren
            // AUSSER dem Hold-Button selbst (der ist gerade aktiv und soll
            // nicht als neuer Edge erkannt werden). Damit triggert der
            // NAECHSTE Frame fuer alle noch-gehaltenen Buttons (z.B. X den
            // der User schon vor dem Hold druckte) ein handleButtonDown am
            // neuen Target=forwardTarget. skipPrevButtonsUpdate-Flag
            // verhindert dass der Frame-End-Update unseren Reset gleich
            // wieder ueberschreibt.
            const newPrev: boolean[] = new Array(Math.max(16, holdBtnIdx + 1)).fill(false);
            if (holdBtnIdx >= 0) newPrev[holdBtnIdx] = true;
            this.prevButtons = newPrev;
            this.skipPrevButtonsUpdate = true;
        }
        else {
            if (!this.forwardActive) return; // idempotent
            // Forward-Phase beendet: alle Sticks/Tasten die WAEHREND der
            // Forward-Phase auf den Target gegangen sind dort releasen, damit
            // der Char dort nicht weiterlaeuft.
            const target = this.forwardTarget;
            if (target && !target.isDestroyed()) {
                this.releaseLocalInputsExceptSpecials(target);
            }
            this.forwardActive = false;
            this.forwardTarget = null;
            // Wieder Edge-Reset → noch gehaltene Buttons werden naechsten
            // Frame neu an `sender` (Vordergrund) dispatched. Hold-Button
            // ist beim UP eh false also kein Special-Handling noetig.
            this.prevButtons = new Array(16).fill(false);
            this.skipPrevButtonsUpdate = true;
        }
    }

    /**
     * Released gehaltene Tastatur-/Stick-Keys und Camera-Drag — laesst aber
     * Special-Hold-Trackings (@forwardHold, @cursorHold) im heldButtonActions
     * stehen, damit deren UP-Events das Mapping noch finden und sauber
     * dispatchSpecial(down=false) rufen koennen. Vermeidet den self-wipe-Bug.
     *
     * Wichtig: jede gehaltene Taste wird auf DEM WebContents released, an
     * den ihr DOWN urspruenglich ging (via `heldKeyTarget`-Map). Beim
     * Ringmaster-Wechsel kann das mid-stream sein: einige Keys gingen an
     * Vordergrund (vor Hold-DOWN), andere an Forward-Target (nach Hold-DOWN).
     * Beim Hold-UP muss jeder Key an seinen tatsaechlichen Target zurueck-
     * geschickt werden, sonst bleibt der "haengen" und feuert weiter
     * (Stuck-Key Bug aus User-Report v3.7.0).
     *
     * Der `fallbackSender`-Param ist nur Fallback wenn der heldKeyTarget keinen
     * Eintrag fuer einen key hat (sollte nicht passieren, aber defensive).
     */
    private releaseLocalInputsExceptSpecials(fallbackSender: WebContents): void {
        const releaseKey = (action: string) => {
            if (!this.heldKeys.has(action)) return;
            this.heldKeys.delete(action);
            const target = this.heldKeyTarget.get(action) ?? fallbackSender;
            this.heldKeyTarget.delete(action);
            if (!target.isDestroyed()) {
                try { target.sendInputEvent({ type: "keyUp", keyCode: action }); }
                catch { /* ignore */ }
            }
        };
        // Skill-/Modifier-Tasten releasen — Specials lassen wir drin.
        const toRemove: number[] = [];
        for (const [btnIdx, action] of this.heldButtonActions.entries()) {
            if (action.startsWith("@")) continue; // Special-Tracking behalten
            toRemove.push(btnIdx);
            // Refcount-aware: pruefen ob die action noch von einem anderen
            // Button gehalten wird BEVOR wir keyUp dispatchen.
            let stillHeldByOther = false;
            for (const [otherIdx, otherAction] of this.heldButtonActions.entries()) {
                if (otherIdx === btnIdx) continue;
                if (otherAction === action) { stillHeldByOther = true; break; }
            }
            if (!stillHeldByOther) releaseKey(action);
        }
        for (const idx of toRemove) this.heldButtonActions.delete(idx);
        // Stick-WASD-Tasten direkt releasen — heldKeyTarget weiss wohin.
        for (const stickKey of ["A", "D", "W", "S"]) releaseKey(stickKey);
        // Camera-Drag stoppen wenn aktiv.
        if (this.cameraActive) this.stopCameraDrag();
        // Cursor-Pump stoppen, Cursor-Mode bleibt gesetzt (Special).
        this.stopCursorPump();
    }

    /** Setzt den Stick-Mode um. Stoppt Camera-Drag wenn aktiv (Mode-Wechsel
     *  mid-stick), initialisiert Cursor-Position auf Bildschirm-Mitte beim
     *  ersten Cursor-Eintritt. */
    private setMode(mode: "normal" | "cursor", sender: WebContents, frame: GamepadFrame | null): void {
        if (mode === this.mode) return;
        // Wenn wir aus Cursor-Modus rausgehen und A noch gehalten ist,
        // Mouse-Up senden — sonst bleibt die linke Maustaste haengen.
        if (this.mode === "cursor" && this.cursorMouseDown) {
            this.cursorMouseDown = false;
            this.dispatchCursorMouse(sender, "mouseUp");
        }
        // Mode-Wechsel: laufende Camera-Drag stoppen, Cursor-Pump stoppen.
        if (this.cameraActive) this.stopCameraDrag();
        this.stopCursorPump();
        this.mode = mode;
        if (mode === "cursor" && frame && !this.cursorInitialized) {
            this.cursorX = frame.viewportWidth / 2;
            this.cursorY = frame.viewportHeight / 2;
            this.cursorInitialized = true;
        }
    }

    /** Synthetisches mouseWheel an der Bildschirm-Mitte. Flyff Universe hoert
     *  auf wheel fuer Maus-Zoom. */
    private triggerZoom(sender: WebContents, frame: GamepadFrame, deltaY: number): void {
        if (frame.viewportWidth <= 0 || frame.viewportHeight <= 0) return;
        try {
            sender.sendInputEvent({
                type: "mouseWheel",
                x: Math.round(frame.viewportWidth / 2),
                y: Math.round(frame.viewportHeight / 2),
                deltaX: 0,
                deltaY,
                canScroll: true,
            } as Electron.MouseWheelInputEvent);
        }
        catch (err) {
            logWarn("controller", `zoom failed: ${(err as Error).message}`);
        }
    }

    /** Maus-Down/Up an aktueller Cursor-Position (links). */
    private dispatchCursorMouse(sender: WebContents, type: "mouseDown" | "mouseUp"): void {
        if (sender.isDestroyed()) return;
        try {
            sender.sendInputEvent({
                type,
                x: Math.round(this.cursorX),
                y: Math.round(this.cursorY),
                button: "left",
                clickCount: 1,
            });
        }
        catch (err) {
            logWarn("controller", `cursor ${type} failed: ${(err as Error).message}`);
        }
    }

    private updateStickKey(sender: WebContents, keyCode: string, shouldBeHeld: boolean): void {
        const isHeld = this.heldKeys.has(keyCode);
        if (shouldBeHeld && !isHeld) {
            this.heldKeys.add(keyCode);
            this.heldKeyTarget.set(keyCode, sender);
            try { sender.sendInputEvent({ type: "keyDown", keyCode }); } catch { /* ignore */ }
        }
        else if (!shouldBeHeld && isHeld) {
            this.heldKeys.delete(keyCode);
            // UP an dem WebContents wo der DOWN hingegangen ist (kann nach
            // Ringmaster-Wechsel ein anderer sein als der aktuelle `sender`).
            // Fallback auf sender wenn Map keinen Eintrag hat (Race / Cleanup).
            const target = this.heldKeyTarget.get(keyCode) ?? sender;
            this.heldKeyTarget.delete(keyCode);
            try { target.sendInputEvent({ type: "keyUp", keyCode }); } catch { /* ignore */ }
        }
    }

    private updateCameraStick(
        sender: WebContents,
        viewportWidth: number,
        viewportHeight: number,
        rx: number,
        ry: number,
    ): void {
        // Cursor-Modus: rechter Stick bewegt synthetischen Cursor statt Camera-
        // Drag zu starten. Initialisiere Cursor wenn noch nicht gesetzt
        // (passiert wenn der User im Cursor-Modus startet ohne vorher Stick
        // bewegt zu haben).
        if (this.mode === "cursor") {
            if (!this.cursorInitialized && viewportWidth > 0 && viewportHeight > 0) {
                this.cursorX = viewportWidth / 2;
                this.cursorY = viewportHeight / 2;
                this.cursorInitialized = true;
            }
            this.updateCursorStick(sender, viewportWidth, viewportHeight, rx, ry);
            return;
        }
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

    /** Update der Cursor-Position via rechtem Stick im Cursor-Modus. Da der
     *  Preload diff-basiert pollt (kein Frame bei stillem Stick), starten wir
     *  einen Pump-Timer, sobald der Stick ausgelenkt wird — sonst wuerde der
     *  Cursor nur bei Stick-Wert-Aenderung bewegt, nicht waehrend gehalten. */
    private updateCursorStick(
        sender: WebContents,
        viewportWidth: number,
        viewportHeight: number,
        rx: number,
        ry: number,
    ): void {
        this.cursorStickX = rx;
        this.cursorStickY = ry;
        this.cursorSender = sender;
        this.cursorViewportW = viewportWidth;
        this.cursorViewportH = viewportHeight;
        const isDeflected = rx !== 0 || ry !== 0;
        if (isDeflected && !this.cursorPumpTimer) {
            this.cursorPumpTimer = setInterval(() => this.pumpCursor(), CURSOR_PUMP_INTERVAL_MS);
        }
        else if (!isDeflected && this.cursorPumpTimer) {
            this.stopCursorPump();
        }
    }

    private pumpCursor(): void {
        const wc = this.cursorSender;
        if (!wc || wc.isDestroyed()) {
            this.stopCursorPump();
            return;
        }
        if (this.cursorStickX === 0 && this.cursorStickY === 0) return;
        if (this.cursorViewportW <= 0 || this.cursorViewportH <= 0) return;
        this.cursorX = clamp(
            this.cursorX + this.cursorStickX * CURSOR_SPEED_PX,
            0,
            this.cursorViewportW,
        );
        this.cursorY = clamp(
            this.cursorY + this.cursorStickY * CURSOR_SPEED_PX,
            0,
            this.cursorViewportH,
        );
        try {
            wc.sendInputEvent({
                type: "mouseMove",
                x: Math.round(this.cursorX),
                y: Math.round(this.cursorY),
            });
            // Wenn A im Cursor-Modus gehalten wird, brauchen wir kontinuierliche
            // mouseMove-Events damit Drag-Operationen im Spiel funktionieren
            // (z.B. Items im Inventar verschieben). Der bereits gesendete
            // mouseMove erfuellt das.
        }
        catch (err) {
            logWarn("controller", `cursor pump failed: ${(err as Error).message}`);
            this.stopCursorPump();
        }
    }

    private stopCursorPump(): void {
        if (this.cursorPumpTimer) {
            clearInterval(this.cursorPumpTimer);
            this.cursorPumpTimer = null;
        }
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
     *  Camera-Drag beenden, Edge-Tracking nullen, Cursor-Modus zuruecksetzen. */
    reset(): void {
        // Held-Keys sauber loslassen — sonst laeuft der Char weiter, weil ein
        // KeyDown ohne KeyUp im Spiel haengen bleibt.
        const sender = this.cameraSender ?? this.cursorSender;
        if (sender && !sender.isDestroyed()) {
            for (const keyCode of this.heldKeys) {
                try { sender.sendInputEvent({ type: "keyUp", keyCode }); } catch { /* ignore */ }
            }
            // Falls A im Cursor-Modus gehalten war, Mouse-Up am letzten
            // Cursor-Punkt — sonst bleibt linke Maustaste haengen.
            if (this.cursorMouseDown) {
                try {
                    sender.sendInputEvent({
                        type: "mouseUp",
                        x: Math.round(this.cursorX),
                        y: Math.round(this.cursorY),
                        button: "left",
                        clickCount: 1,
                    });
                }
                catch { /* ignore */ }
            }
        }
        this.heldKeys.clear();
        this.heldKeyTarget.clear();
        this.heldButtonActions.clear();
        this.stopCameraDrag();
        this.stopCursorPump();
        this.cursorMouseDown = false;
        this.mode = "normal";
        this.forwardActive = false;
        this.forwardTarget = null;
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


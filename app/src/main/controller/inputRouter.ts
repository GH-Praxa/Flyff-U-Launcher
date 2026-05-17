import type { WebContents } from "electron";
import { logInfo, logWarn } from "../../shared/logger";

/**
 * CDP-Key-Mapping fuer Hintergrund-Dispatch via webContents.debugger.
 * `sendInputEvent` kommt am nicht-fokussierten WebContents nicht durch —
 * wir muessen `Input.dispatchKeyEvent` via Chrome DevTools Protocol nutzen.
 *
 * Die hier verwendeten keyCode-Strings entsprechen Electron-Accelerator-
 * Syntax (z.B. "Space", "Return", "Z", "1"). Wir uebersetzen in CDP's
 * `key`/`code`/`windowsVirtualKeyCode`-Triplet.
 */
type CdpKeyInfo = { key: string; code: string; vkc: number };

const SPECIAL_CDP_KEYS: Record<string, CdpKeyInfo> = {
    "Space": { key: " ", code: "Space", vkc: 32 },
    "Escape": { key: "Escape", code: "Escape", vkc: 27 },
    "Tab": { key: "Tab", code: "Tab", vkc: 9 },
    "Return": { key: "Enter", code: "Enter", vkc: 13 },
    "Enter": { key: "Enter", code: "Enter", vkc: 13 },
    "Backspace": { key: "Backspace", code: "Backspace", vkc: 8 },
    "Delete": { key: "Delete", code: "Delete", vkc: 46 },
    "Insert": { key: "Insert", code: "Insert", vkc: 45 },
    "Home": { key: "Home", code: "Home", vkc: 36 },
    "End": { key: "End", code: "End", vkc: 35 },
    "PageUp": { key: "PageUp", code: "PageUp", vkc: 33 },
    "PageDown": { key: "PageDown", code: "PageDown", vkc: 34 },
    "Up": { key: "ArrowUp", code: "ArrowUp", vkc: 38 },
    "Down": { key: "ArrowDown", code: "ArrowDown", vkc: 40 },
    "Left": { key: "ArrowLeft", code: "ArrowLeft", vkc: 37 },
    "Right": { key: "ArrowRight", code: "ArrowRight", vkc: 39 },
    "Shift": { key: "Shift", code: "ShiftLeft", vkc: 16 },
    "Control": { key: "Control", code: "ControlLeft", vkc: 17 },
    "Alt": { key: "Alt", code: "AltLeft", vkc: 18 },
    "Plus": { key: "+", code: "Equal", vkc: 187 },
    "Minus": { key: "-", code: "Minus", vkc: 189 },
};

function toCdpKeyInfo(keyCode: string): CdpKeyInfo | null {
    const direct = SPECIAL_CDP_KEYS[keyCode];
    if (direct) return direct;
    if (/^[A-Za-z]$/.test(keyCode)) {
        const upper = keyCode.toUpperCase();
        return { key: upper.toLowerCase(), code: `Key${upper}`, vkc: upper.charCodeAt(0) };
    }
    if (/^[0-9]$/.test(keyCode)) {
        return { key: keyCode, code: `Digit${keyCode}`, vkc: keyCode.charCodeAt(0) };
    }
    const fmatch = /^F([1-9]|1[0-9]|2[0-4])$/.exec(keyCode);
    if (fmatch) {
        const n = parseInt(fmatch[1], 10);
        return { key: `F${n}`, code: `F${n}`, vkc: 111 + n };
    }
    return null;
}

/**
 * Snapshot eines Gamepads, wie er aus dem Preload via IPC kommt. Strukturell
 * angelehnt an die Web-Gamepad-API (`navigator.getGamepads()[i]`), aber serialisiert
 * (keine Live-Referenz). Achsen sind in [-1, 1], Buttons sind boolesch.
 *
 * Der Preload liefert zusaetzlich die Viewport-Groesse (`window.innerWidth/Height`)
 * der Page mit, weil der Frame in einer BrowserView lebt — `getContentSize()` der
 * Parent-Window-WebContents wuerde uns nicht die BrowserView-Groesse geben.
 *
 * `mapping` ist der Web-Gamepad-API-Wert (`gp.mapping`): "standard" fuer von
 * Chromium erkannte XInput-Pads, "" (leer) fuer Non-Standard-Pads — u.a. den in
 * den Steam Deck eingebauten Controller im Desktop-Mode (hid-steam, ohne Steam
 * Input). Davon haengt das Achsen-Layout des rechten Sticks ab, siehe
 * [rightStickAxes]. Optional, weil aeltere Preload-Versionen es nicht mitsenden.
 */
export interface GamepadFrame {
    index: number;
    timestamp: number;
    axes: number[];
    buttons: boolean[];
    viewportWidth: number;
    viewportHeight: number;
    mapping?: string;
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
    // Steam-Deck Back-Paddles. Standard-Gamepads liefern diese Indizes nicht
    // (gp.buttons.length = 16); der Router behandelt sie wie jeden anderen
    // Index und ignoriert sie still, wenn das Frame sie nicht enthaelt.
    L4: 16,
    R4: 17,
    L5: 18,
    R5: 19,
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
    "l4", "r4", "l5", "r5",
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
    [BTN.L4]: "l4",
    [BTN.R4]: "r4",
    [BTN.L5]: "l5",
    [BTN.R5]: "r5",
};

/**
 * Mapping von Button-Index → Aktion. Aktionen sind entweder Accelerator-Keys
 * ("W", "Space", "Escape", "1"...) oder Special-Actions mit `@`-Prefix:
 *   "@actionPad"      — feuert den kalibrierten Action-Pad-Klick
 *   "@zoomIn"/"@zoomOut" — synthetisches mouseWheel (Bildschirm-Mitte)
 *   "@cursorHold"     — solange gehalten: linker Stick → Maus-Cursor,
 *                       rechter Stick → mouseWheel-Scroll, A → Linksklick
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
 *  - L2       → @cursorHold (linker Stick = Cursor, rechter Stick = Scroll,
 *               solange gehalten)
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
 * Default-Mapping fuer Steam Deck: erbt alles aus DEFAULT_BUTTON_MAPPING und
 * belegt zusaetzlich die vier Back-Paddles mit Skill-Slots 4–7. Damit hat der
 * Spieler ohne Umbelegen sieben Skill-Slots in Reichweite (1/2/3 auf L1/R1/R2,
 * 4–7 auf den Paddles), wobei die Spielfeldhand am Stick bleibt.
 *
 * Wird vom Caller (Profile-Store via coreServices) als `baseMapping` an
 * resolveButtonMapping uebergeben, wenn `profile.controller.style === "steamdeck"`.
 */
export const STEAMDECK_BUTTON_MAPPING: ControllerButtonMapping = {
    ...DEFAULT_BUTTON_MAPPING,
    [BTN.L4]: "4",
    [BTN.R4]: "5",
    [BTN.L5]: "6",
    [BTN.R5]: "7",
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
    baseMapping?: ControllerButtonMapping,
): ControllerButtonMapping {
    const out: ControllerButtonMapping = { ...(baseMapping ?? DEFAULT_BUTTON_MAPPING) };
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

/** Anzahl Name-Slots im Buff-Empfaenger-Panel (Party-Max in Flyff = 8). */
export const NAME_SLOT_COUNT = 8;

export interface ControllerInputRouterDeps {
    getActionPadAnchor: (sender: WebContents) => ActionPadAnchor | null;
    /**
     * Liefert den Klick-Anker fuer einen Buff-Empfaenger-Slot (0..NAME_SLOT_COUNT-1).
     * `null` = Slot nicht kalibriert → Trigger feuert nicht (kein Blind-Klick).
     */
    getNameSlotAnchor?: (sender: WebContents, slot: number) => ActionPadAnchor | null;
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
    /**
     * Liefert true wenn `sender` aktuell ein sichtbarer/aktiver Tab in seinem
     * SessionWindow ist. Wird vom Router benutzt um Spurious-Frames von
     * Hintergrund-Tabs zu droppen — z.B. wenn `webContents.debugger.attach`
     * an einen Buffer-Target-Tab ein `focus`-Event ausloest, woraufhin dessen
     * Preload-Polling startet und Frames an den IPC-Handler schickt.
     *
     * Ohne diesen Filter wuerden Frames vom Buffer-Target durch Pass-1/2 der
     * Edge-Detection laufen und z.B. dessen lokales Mapping (L2=@cursorHold
     * statt @forwardHold) feuern, was Forward-Routing zerlegt.
     *
     * `undefined` zurueckgeben = "weiss nicht" → Router akzeptiert das Frame
     * (Backward-Compat / kein Hard-Fail wenn die Dep nicht verdrahtet ist).
     */
    isActiveSender?: (sender: WebContents) => boolean;
    /**
     * Liefert die aktuelle Viewport-Groesse einer WebContents in CSS-Pixeln.
     * Wird benoetigt damit Camera-Drag-Maus-Events an einen Buffer-Target
     * (= NICHT der Frame-Sender) die richtigen Koordinaten benutzen. Sonst:
     * Main im Split-Layout (z.B. 960×1080) schickt Frame mit seinen Viewport-
     * Maßen, Camera-Drag wuerde an RM (1920×1080) mit den falschen 960-Maßen
     * dispatchen → Mausklick landet nicht auf RM's Canvas-Mitte.
     *
     * Implementierung in main.ts via sessionTabs.getBounds(profileId). Wenn
     * unverdrahtet: Fallback auf Frame-Viewport (alte Verhaltensweise).
     */
    getViewportFor?: (wc: WebContents) => { width: number; height: number } | null;
    notify?: (message: string) => void;
}

const ACTION_PAD_DEBOUNCE_MS = 200;
const ACTION_PAD_OFFSET_PX = 18;
const ACTION_PAD_DRIFT_PX = 3;
const ACTION_PAD_DURATION_MIN_MS = 55;
const ACTION_PAD_DURATION_RANGE_MS = 60;

/** Deadzone: 0.22. Steam Deck / DualSense Stick-Drift liegt typisch bei
 *  0.10-0.20 nach Release; ohne grosszuegige Deadzone laeuft der Char weiter,
 *  weil ly leicht negativ "klebt". 0.22 ist immer noch responsiv genug fuer
 *  intentionalen Mini-Push. */
const STICK_DEADZONE = 0.22;
/** Stick→Key Hysterese: engage erst bei 0.40, disengage erst unter 0.22
 *  (= sofort wenn Deadzone snappt). Ohne Hysterese springt der Key beim
 *  Loslassen/Federbouncen mehrfach down/up → Flyff erkennt das als
 *  Double-Tap und aktiviert Auto-Run. */
const STICK_KEY_ENGAGE = 0.40;
const STICK_KEY_RELEASE = 0.22;
/** Camera-Drag-Release-Grace: wenn der rechte Stick beim Richtungswechsel
 *  kurz durch den Mittelbereich huscht, NICHT sofort stopCameraDrag rufen —
 *  sonst sendet die Logik mouseUp+neuen mouseDown an der Bildmitte und Flyff
 *  resettet die Drag-Origin (Camera springt zurueck). 220ms decken auch
 *  langsamere Direction-Switches ab. */
const CAMERA_RELEASE_GRACE_MS = 220;
const CAMERA_INITIAL_DRAG_PX = 60;     // erster Mausschub in Stick-Richtung
const CAMERA_SPEED_PX = 14;            // Pixel pro Pump-Tick bei voller Auslenkung
const CAMERA_PUMP_INTERVAL_MS = 16;    // ~60 Hz
const CAMERA_EDGE_BUFFER_PX = 80;
const CURSOR_SPEED_PX = 12;            // Pixel pro Pump-Tick bei voller Auslenkung
const CURSOR_PUMP_INTERVAL_MS = 16;    // ~60 Hz
const SCROLL_SPEED_PX = 24;            // deltaY pro Pump-Tick bei voller Auslenkung
const SCROLL_PUMP_INTERVAL_MS = 16;    // ~60 Hz
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
    /** Edge-Detection-State PRO SENDER. Jedes Tab (Main, RM, ...) hat sein
     *  eigenes preload-Polling und schickt eigene controller:frame-IPCs. Wenn
     *  wir die Edge-Detection global tracken, beeinflussen die Frames der Tabs
     *  einander: RM-Frame setzt prevButtons[L2]=true, danach sieht Main-Frame
     *  kein L2-DOWN-Edge mehr → Forward-Hold wird nie aktiv → X geht an Main
     *  statt RM. Pro-Sender-Maps trennen das sauber.
     *
     *  Key = WebContents.id. Cleanup bei reset() oder unregisterWebContents.
     */
    private prevButtonsBySender: Map<number, boolean[]> = new Map();
    private prevAxesBySender: Map<number, number[]> = new Map();
    /** Letztes Gamepad-`mapping` pro Sender — parallel zu prevAxesBySender
     *  gepflegt, damit reapplyStickStateAt das Rechtsstick-Achsen-Layout
     *  (Standard vs. Non-Standard) auch ohne frische Frame-Referenz kennt. */
    private prevMappingBySender: Map<number, string> = new Map();
    /** Einmaliges Log, sobald ein Non-Standard-Achsen-Layout erkannt und der
     *  rechte Stick umgemappt wurde — verhindert Log-Spam pro Frame. */
    private axisLayoutLogged = false;
    /** Per-Sender-Flag: nach setForwardMode soll Frame-End-Update den von
     *  setForwardMode gesetzten newPrev NICHT ueberschreiben. */
    private skipPrevByButtonsSenders: Set<number> = new Set();
    /** Pro Click-Lock (z.B. "actionPad", "nameSlot:3") eigener Debounce-State.
     *  Verhindert Eigen-Pressure-Spam je Slot, aber Slot 1 und Slot 2 koennen
     *  unabhaengig im 200ms-Fenster feuern (zwei verschiedene Aktionen). */
    private clickInProgress = new Map<string, boolean>();
    private lastClickFireMs = new Map<string, number>();

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
    /** Grace-Timer: pendelnder stopCameraDrag-Aufruf nach Stick-Neutral. Wird
     *  vom naechsten ausgelenkten Frame storniert (Direction-Change ohne
     *  Drag-Reset). Vermeidet das Camera-Snap-Back-Problem. */
    private cameraReleaseTimer: ReturnType<typeof setTimeout> | null = null;

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
    /** Hysterese-Timer fuer @forwardHold-UP: bei Trigger-Flackern (kurzes
     *  unbeabsichtigtes Loslassen <150ms) wird der UP verschluckt damit der
     *  Forward-Modus nicht zerlegt wird. Wenn L2 vor Ablauf wieder DOWN geht,
     *  wird der Timer abgebrochen. */
    private forwardReleaseTimer: ReturnType<typeof setTimeout> | null = null;
    private forwardReleaseSender: WebContents | null = null;
    private forwardReleaseBtnIdx = -1;
    private static readonly FORWARD_HYSTERESIS_MS = 150;

    // (skipPrevButtonsUpdate ist jetzt pro Sender — siehe skipPrevByButtonsSenders.)

    /** Set der WebContents, an die wir bereits den CDP-Debugger attached haben.
     *  Wird benutzt um Inputs an Hintergrund-Tabs zu schicken — `sendInputEvent`
     *  kommt am nicht-fokussierten WebContents nicht durch (Electron-Limitation,
     *  Chromium routet Events nur an die fokussierte View). CDP via
     *  `webContents.debugger.sendCommand('Input.dispatchKeyEvent', ...)`
     *  umgeht diese Beschraenkung. Attach ist sticky — einmal an einem WC
     *  attached, bleiben wir dran bis WC zerstoert wird (Electron detached
     *  automatisch). WeakSet weil Referenzen schwach gehalten werden sollen. */
    private cdpAttached: WeakSet<WebContents> = new WeakSet();

    /** Erstkontakt-Log pro WC-Pfad-Kombo, damit Diagnose moeglich ist ohne
     *  Log-Flood pro Frame. Format: `${wcId}:${path}` → schon geloggt? */
    private routingLogged: Set<string> = new Set();

    /** Pro CDP-getriebene WebContents die aktuell gedrueckten Maustasten als
     *  Chromium-Bitmask (left=1, right=2, middle=4). CDP `Input.dispatchMouseEvent`
     *  vom Typ `mouseMoved` braucht dieses Feld, damit die Page einen Drag
     *  erkennt (nur Move + ohne `buttons` = "Maus bewegt, aber nicht gehalten",
     *  also kein Drag → Camera-Drag funktioniert nicht).
     *
     *  Aktualisiert in `dispatchViaCdp` bei mouseDown/Up; gelesen bei mouseMove. */
    private cdpHeldMouseButtons: Map<number, number> = new Map();

    /** Cursor-Modus: linker Stick bewegt den Cursor, rechter Stick scrollt
     *  (mouseWheel). WASD und Camera-Drag sind suspendiert. A im Cursor-Modus =
     *  Maus-Klick links an aktueller Cursor-Position. */
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

    /** Scroll-Pump-State: rechter Stick im Cursor-Modus erzeugt mouseWheel-Events
     *  an der aktuellen Cursor-Position. Wie beim Cursor-Pump: das Preload pollt
     *  diff-basiert, daher braucht es einen Timer, damit der Scroll auch bei
     *  ruhig gehaltenem Stick weiterlaeuft. */
    private scrollStickX = 0;
    private scrollStickY = 0;
    private scrollSender: WebContents | null = null;
    private scrollViewportW = 0;
    private scrollViewportH = 0;
    private scrollPumpTimer: ReturnType<typeof setInterval> | null = null;

    constructor(private readonly deps: ControllerInputRouterDeps) {}

    /**
     * Pruef ob wir an `wc` via CDP statt sendInputEvent dispatchen muessen.
     * sticky: einmal CDP-attached → bleibt CDP, auch wenn forwardActive wieder
     * false ist. Verhindert dass z.B. ein setTimeout-Mouse-Up nach Forward-
     * Release mitten in der Sequenz auf sendInputEvent springt und verloren
     * geht. Ausserdem: Keys die WAEHREND Forward auf RM gepresst wurden, deren
     * UP-Edge erst NACH Forward-Release kommt — der UP muss weiter via CDP an
     * RM, sonst bleibt die Taste am RM-Tab haengen.
     *
     * WICHTIG: NICHT `isFocused()` als heuristische Bedingung benutzen. Das
     * fuehrte zum L2-Trigger-Bug: bei kurzem Fokus-Verlust der Main-Tab (User
     * klickt Taskbar, anderes Fenster ploppt auf) waere shouldUseCdp(Main)
     * true geworden → CDP haette an Main angehaeftet → Main routet seitdem
     * permanent ueber CDP statt sendInputEvent, mit anderem Timing. Das macht
     * L2-Routing flaky. CDP attached jetzt explizit nur fuer das aktuell
     * registrierte Forward-Ziel.
     */
    private shouldUseCdp(wc: WebContents): boolean {
        if (wc.isDestroyed()) return false;
        if (this.cdpAttached.has(wc)) return true;
        return this.forwardActive && this.forwardTarget !== null && this.forwardTarget === wc;
    }

    private ensureCdpAttached(wc: WebContents): boolean {
        if (this.cdpAttached.has(wc)) return true;
        // Wenn der Debugger schon attached ist, ist das DevTools (oder ein
        // anderer Konsumer). Wir koennen keinen zweiten Debugger anhaengen,
        // und `sendCommand` ueber den fremd-attachten waere ein silent fail.
        // Sauberer: zurueckweisen, User notifien.
        if (wc.debugger.isAttached()) {
            logWarn("controller", `[CDP] wcId=${wc.id} hat bereits einen anderen Debugger (vermutlich DevTools) — Forward an dieser WC nicht moeglich`);
            this.deps.notify?.("DevTools auf Forward-Ziel offen — bitte schliessen, sonst funktioniert Forward-Hold nicht");
            return false;
        }
        try {
            wc.debugger.attach("1.3");
            this.cdpAttached.add(wc);
            const wcId = wc.id;
            wc.once("destroyed", () => {
                this.cdpAttached.delete(wc);
                this.cdpHeldMouseButtons.delete(wcId);
            });
            // Wenn DevTools spaeter auf dem WC geoeffnet wird, klaut es uns den
            // Debugger (Electron auto-detached). Wir clearen unseren Marker,
            // damit der naechste sendInput-Call merkt dass CDP weg ist und
            // sauber neu zu versuchen (was dann oben mit notify ablehnt).
            wc.debugger.on("detach", (_event, reason) => {
                logWarn("controller", `[CDP] wcId=${wcId} detached: ${reason}`);
                this.cdpAttached.delete(wc);
                this.cdpHeldMouseButtons.delete(wcId);
            });
            logInfo(`[CDP] attached to wcId=${wc.id}`, "controller");
            return true;
        } catch (err) {
            logWarn("controller", `[CDP] attach failed wcId=${wc.id}: ${(err as Error).message}`);
            return false;
        }
    }

    /**
     * Zentraler Input-Dispatch. Routet automatisch via CDP an Hintergrund-WCs
     * (sonst kommt nichts durch) und via sendInputEvent an den Vordergrund.
     * Alle Aufrufer in dieser Klasse gehen hier durch — direkte
     * sendInputEvent-Calls sind zu vermeiden, sonst gehen Inputs am
     * Forward-Target verloren.
     */
    private sendInput(wc: WebContents, ev: Electron.MouseInputEvent | Electron.MouseWheelInputEvent | Electron.KeyboardInputEvent): void {
        if (wc.isDestroyed()) return;
        if (this.shouldUseCdp(wc)) {
            if (this.dispatchViaCdp(wc, ev)) {
                const key = `${wc.id}:cdp`;
                if (!this.routingLogged.has(key)) {
                    this.routingLogged.add(key);
                    logInfo(`[ROUTE] wcId=${wc.id} via CDP (forwardActive=${this.forwardActive} forwardTargetId=${this.forwardTarget?.id ?? "null"})`, "controller");
                }
                return;
            }
            // CDP-Attach fehlgeschlagen (z.B. DevTools schon offen) — wir
            // versuchen sendInputEvent als Fallback; wird vermutlich nicht
            // ankommen, aber besser als gar nichts.
        }
        const key = `${wc.id}:native`;
        if (!this.routingLogged.has(key)) {
            this.routingLogged.add(key);
            logInfo(`[ROUTE] wcId=${wc.id} via sendInputEvent (forwardActive=${this.forwardActive} forwardTargetId=${this.forwardTarget?.id ?? "null"})`, "controller");
        }
        try {
            wc.sendInputEvent(ev);
        } catch (err) {
            logWarn("controller", `sendInputEvent ${ev.type} failed: ${(err as Error).message}`);
        }
    }

    private dispatchViaCdp(wc: WebContents, ev: Electron.MouseInputEvent | Electron.MouseWheelInputEvent | Electron.KeyboardInputEvent): boolean {
        if (!this.ensureCdpAttached(wc)) return false;
        const dbg = wc.debugger;
        try {
            if (ev.type === "keyDown" || ev.type === "keyUp") {
                const kbd = ev as Electron.KeyboardInputEvent;
                const info = toCdpKeyInfo(kbd.keyCode);
                if (!info) {
                    logWarn("controller", `[CDP] kein Mapping fuer keyCode=${kbd.keyCode}`);
                    return false;
                }
                dbg.sendCommand("Input.dispatchKeyEvent", {
                    type: ev.type === "keyDown" ? "keyDown" : "keyUp",
                    key: info.key,
                    code: info.code,
                    windowsVirtualKeyCode: info.vkc,
                    nativeVirtualKeyCode: info.vkc,
                }).catch((err: Error) => {
                    logWarn("controller", `[CDP] dispatchKeyEvent ${ev.type} ${kbd.keyCode} failed: ${err.message}`);
                });
                return true;
            }
            if (ev.type === "mouseDown" || ev.type === "mouseUp") {
                const m = ev as Electron.MouseInputEvent;
                const btn = m.button ?? "left";
                const bit = btn === "right" ? 2 : btn === "middle" ? 4 : 1;
                const prev = this.cdpHeldMouseButtons.get(wc.id) ?? 0;
                const next = ev.type === "mouseDown" ? (prev | bit) : (prev & ~bit);
                this.cdpHeldMouseButtons.set(wc.id, next);
                dbg.sendCommand("Input.dispatchMouseEvent", {
                    type: ev.type === "mouseDown" ? "mousePressed" : "mouseReleased",
                    x: m.x,
                    y: m.y,
                    button: btn,
                    buttons: next,
                    clickCount: m.clickCount ?? 1,
                }).catch((err: Error) => {
                    logWarn("controller", `[CDP] dispatchMouseEvent ${ev.type} failed: ${err.message}`);
                });
                return true;
            }
            if (ev.type === "mouseMove") {
                const m = ev as Electron.MouseInputEvent;
                const held = this.cdpHeldMouseButtons.get(wc.id) ?? 0;
                // CDP-Move braucht `buttons` (Bitmaske) damit ein gehaltener
                // Button als Drag interpretiert wird (Camera-Drag = right).
                // `button` einzeln muss konsistent zu `buttons` sein: einen
                // Button picken den der Drag betrifft, sonst "none".
                const dragButton = (held & 2) ? "right" : (held & 1) ? "left" : (held & 4) ? "middle" : "none";
                dbg.sendCommand("Input.dispatchMouseEvent", {
                    type: "mouseMoved",
                    x: m.x,
                    y: m.y,
                    button: dragButton,
                    buttons: held,
                }).catch((err: Error) => {
                    logWarn("controller", `[CDP] dispatchMouseEvent move failed: ${err.message}`);
                });
                return true;
            }
            if (ev.type === "mouseWheel") {
                const m = ev as Electron.MouseWheelInputEvent;
                dbg.sendCommand("Input.dispatchMouseEvent", {
                    type: "mouseWheel",
                    x: m.x,
                    y: m.y,
                    deltaX: m.deltaX ?? 0,
                    deltaY: m.deltaY ?? 0,
                }).catch((err: Error) => {
                    logWarn("controller", `[CDP] dispatchMouseEvent wheel failed: ${err.message}`);
                });
                return true;
            }
        } catch (err) {
            logWarn("controller", `[CDP] dispatch threw: ${(err as Error).message}`);
            return false;
        }
        return false;
    }

    handleFrame(frame: GamepadFrame, sender: WebContents): void {
        // Frame-Filter: nur Frames vom aktuell sichtbaren Tab seines Windows
        // akzeptieren. Ein Forward-Target-Tab kann durch CDP-Attach-Side-Effect
        // faelschlicherweise zu pollen anfangen — seine Frames muessen wir
        // droppen, sonst feuert sein lokales Mapping (z.B. L2=@cursorHold) und
        // konfligiert mit der Forward-Logik vom Vordergrund-Sender.
        //
        // `isActiveSender` ist optional — wenn nicht verdrahtet, behalten wir
        // das alte (unfiltrierte) Verhalten (Backward-Compat).
        if (this.deps.isActiveSender !== undefined && !this.deps.isActiveSender(sender)) {
            // 1x pro Sender loggen, sonst spam-flood (60Hz pro non-active tab).
            const dropKey = `drop:${sender.id}`;
            if (!this.routingLogged.has(dropKey)) {
                this.routingLogged.add(dropKey);
                logInfo(`[FILTER] frames from wcId=${sender.id} werden gedroppt (nicht active tab)`, "controller");
            }
            return;
        }
        const buttons = frame.buttons;
        const senderId = sender.id;
        const prev = this.prevButtonsBySender.get(senderId) ?? [];
        // DEBUG: log alle button-changes mit Index.
        const changedIdx: number[] = [];
        const maxLen = Math.max(prev.length, buttons.length);
        for (let i = 0; i < maxLen; i++) {
            if ((prev[i] === true) !== (buttons[i] === true)) changedIdx.push(i);
        }
        if (changedIdx.length > 0) {
            const downNow = buttons.map((b, i) => b ? i : -1).filter(i => i >= 0).join(",");
            logInfo(`[FRAME] sender=${senderId} changed=[${changedIdx.join(",")}] downNow=[${downNow}] forwardActive=${this.forwardActive}`, "controller");
        }

        // Buffer-Forward: solange `@forwardHold` aktiv ist, alle Sticks +
        // Buttons (ausser dem Hold-Button selbst) an `forwardTarget` routen.
        // Der "effektive sender" fuer Stick/Button-Output ist dann der Target
        // statt der Vordergrund-Sender. Hold-Button wird unten in
        // handleButtonDown/Up immer mit dem `sender` (Vordergrund) verarbeitet,
        // damit das UP zuverlaessig ankommt.
        const effectiveSender: WebContents = (this.forwardActive && this.forwardTarget && !this.forwardTarget.isDestroyed())
            ? this.forwardTarget
            : sender;

        // Sticks. Im Cursor-Modus (und nicht im Forward) belegen wir die
        // Sticks komplett um: linker Stick = Cursor, rechter Stick = Scrollen.
        // Sonst: linker Stick = WASD, rechter Stick = Kamera-Drag.
        const lx = applyDeadzone(frame.axes[0] ?? 0);
        const ly = applyDeadzone(frame.axes[1] ?? 0);
        // Rechtsstick-Achsen haengen vom Gamepad-Mapping ab (siehe rightStickAxes):
        // Standard-Pads → axes[2]/[3], Non-Standard (Steam-Deck-Desktop-Mode)
        // → axes[3]/[4], weil axes[2] dort der linke Analog-Trigger ist.
        const rs = rightStickAxes(frame.axes, frame.mapping);
        if (rs !== RIGHT_STICK_STANDARD && !this.axisLayoutLogged) {
            this.axisLayoutLogged = true;
            logInfo(
                `Non-standard gamepad (mapping="${frame.mapping ?? ""}", ${frame.axes.length} axes) — `
                + `rechter Stick auf axes[${rs.xIdx}]/[${rs.yIdx}] umgemappt (Steam-Deck-Desktop-Mode)`,
                "controller",
            );
        }
        const rx = applyDeadzone(frame.axes[rs.xIdx] ?? 0);
        const ry = applyDeadzone(frame.axes[rs.yIdx] ?? 0);
        const inCursorMode = this.mode === "cursor" && !this.forwardActive;
        if (inCursorMode) {
            // WASD-Keys ggf. release-en (falls der User mid-stick in den
            // Cursor-Modus gewechselt ist). updateStickKey ist idempotent —
            // ist die Taste nicht gehalten, passiert nichts.
            this.updateStickKey(effectiveSender, "A", false);
            this.updateStickKey(effectiveSender, "D", false);
            this.updateStickKey(effectiveSender, "W", false);
            this.updateStickKey(effectiveSender, "S", false);
            this.updateCursorStick(effectiveSender, frame.viewportWidth, frame.viewportHeight, lx, ly);
            this.updateScrollStick(effectiveSender, frame.viewportWidth, frame.viewportHeight, rx, ry);
        }
        else {
            // 1) Linker Stick → WASD (an effectiveSender)
            //    Hysterese: gehaltene Keys bleiben bis unter STICK_KEY_RELEASE,
            //    losgelassene Keys triggern erst ab STICK_KEY_ENGAGE.
            const wantA = this.heldKeys.has("A") ? lx < -STICK_KEY_RELEASE : lx < -STICK_KEY_ENGAGE;
            const wantD = this.heldKeys.has("D") ? lx >  STICK_KEY_RELEASE : lx >  STICK_KEY_ENGAGE;
            const wantW = this.heldKeys.has("W") ? ly < -STICK_KEY_RELEASE : ly < -STICK_KEY_ENGAGE;
            const wantS = this.heldKeys.has("S") ? ly >  STICK_KEY_RELEASE : ly >  STICK_KEY_ENGAGE;
            this.updateStickKey(effectiveSender, "A", wantA);
            this.updateStickKey(effectiveSender, "D", wantD);
            this.updateStickKey(effectiveSender, "W", wantW);
            this.updateStickKey(effectiveSender, "S", wantS);

            // 2) Rechter Stick → Kamera-Drag (rechte Maustaste, gepumpt aus
            //    Mitte des Viewports). Solange ausgelenkt: Drag aktiv. Sobald
            //    neutral: MouseUp. Auch an effectiveSender geroutet.
            this.updateCameraStick(effectiveSender, frame.viewportWidth, frame.viewportHeight, rx, ry);
        }

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

        // Two-Pass-Edge-Detection: erst alle @forwardHold-DOWN-Edges
        // verarbeiten (aktiviert/deaktiviert forwarding), dann erst alle
        // anderen Buttons. Sonst wuerden z.B. X (Index 2) und L2/Hold
        // (Index 6) im selben Frame so verarbeitet werden, dass X *vor* L2
        // läuft → X geht an Vordergrund-Sender statt an forwardTarget,
        // obwohl der User L2 gleichzeitig gedrückt hatte.
        // Plus UP-Edges für @forwardHold VOR den anderen UPs — damit der
        // Forward-Modus rechtzeitig deaktiviert ist wenn andere Buttons im
        // gleichen Frame losgelassen werden.
        for (let i = 0; i < buttons.length; i++) {
            const wasDown = prev[i] === true;
            const isDown = buttons[i] === true;
            if (isDown && !wasDown) {
                const action = resolveAction(i);
                if (action === "@forwardHold") {
                    this.handleButtonDown(sender, i, action, frame, sender);
                }
            }
            else if (!isDown && wasDown) {
                const heldAction = this.heldButtonActions.get(i);
                if (heldAction === "@forwardHold") {
                    this.handleButtonUp(sender, i);
                }
            }
        }
        // Pass 2: alle anderen Buttons mit aktualisiertem forwardActive-State.
        // WICHTIG: prev neu einlesen — falls Pass 1 setForwardMode getriggert
        // hat, wurde der prevButtons-Eintrag fuer diesen Sender zu newPrev
        // (alle false ausser HoldBtn) gesetzt. Damit Pass 2 alle noch-
        // gehaltenen Buttons als frischen Edge sieht und SOFORT am neuen
        // Target dispatched (statt 1 Frame Verzoegerung). Wenn Pass 1 nichts
        // geaendert hat: gleiche Referenz wie die lokale prev → kein Effekt.
        const prev2 = this.prevButtonsBySender.get(senderId) ?? prev;
        // Pass-2-Mapping: waehrend Forward die RM-Mapping benutzen, nicht
        // Mains. User-Erwartung: "L2 gehalten = wir agieren als ob wir auf
        // RM waeren, mit RM's Bindings". Mains Mapping war nur fuer die
        // @forwardHold-Detection in Pass 1 noetig.
        const forwarding = this.forwardActive && this.forwardTarget && !this.forwardTarget.isDestroyed();
        const pass2Target: WebContents = forwarding ? this.forwardTarget! : sender;
        const pass2Mapping = forwarding
            ? (this.deps.getButtonMapping?.(pass2Target) ?? DEFAULT_BUTTON_MAPPING)
            : baseMapping;
        // Modifier-Layer ebenfalls aus RM ziehen waehrend Forward.
        const pass2Modifiers: ControllerButtonMapping[] = [];
        if (this.deps.getModifierMapping) {
            for (const { slot, index } of MODIFIER_SLOTS) {
                if (buttons[index] !== true) continue;
                const mod = this.deps.getModifierMapping(pass2Target, slot);
                if (mod && Object.keys(mod).length > 0) pass2Modifiers.push(mod);
            }
        }
        const pass2Resolve = (i: number): string | null | undefined => {
            for (const mod of pass2Modifiers) {
                if (i in mod) return mod[i];
            }
            return pass2Mapping[i];
        };
        for (let i = 0; i < buttons.length; i++) {
            const wasDown = prev2[i] === true;
            const isDown = buttons[i] === true;
            if (isDown && !wasDown) {
                const action = pass2Resolve(i);
                if (!action || action === "@forwardHold") continue; // schon in Pass 1
                if (i === 2 || i === 6) {
                    logInfo(`[PASS2-DOWN] btn=${i} action=${action} targetId=${pass2Target.id} senderId=${sender.id} forwardActive=${this.forwardActive} mappingFrom=${forwarding ? "rm" : "main"}`, "controller");
                }
                this.handleButtonDown(pass2Target, i, action, frame, sender);
            }
            else if (!isDown && wasDown) {
                const heldAction = this.heldButtonActions.get(i);
                if (heldAction === "@forwardHold") continue; // schon in Pass 1
                // UP geht an den Sender wo der DOWN registriert wurde — wird
                // via heldKeyTarget automatisch korrekt verfolgt.
                this.handleButtonUp(sender, i);
            }
        }

        // 4) D-Pad-Up als HAT-Achse (DInput-Modus, keine Buttons-Eintraege).
        //    Triggert immer Action-Pad — ist die einzige sinnvolle Aktion fuer
        //    "POV-Up" auf solchen Controllern.
        const prevAxesForSender = this.prevAxesBySender.get(senderId) ?? [];
        if (this.isHatUpEdge(frame, prevAxesForSender)) {
            this.triggerActionPad(sender, frame.viewportWidth, frame.viewportHeight);
        }

        // setForwardMode (in dispatchSpecial waehrend dieses Frames gerufen)
        // hat moeglicherweise den prevButtons-Eintrag fuer diesen Sender
        // gezielt zurueckgesetzt damit der NAECHSTE Frame Edges fuer noch-
        // gehaltene Buttons sieht. Wenn das Flag gesetzt ist, ueberschreiben
        // wir den Reset NICHT.
        if (this.skipPrevByButtonsSenders.has(senderId)) {
            this.skipPrevByButtonsSenders.delete(senderId);
        } else {
            this.prevButtonsBySender.set(senderId, buttons.slice());
        }
        this.prevAxesBySender.set(senderId, frame.axes.slice());
        this.prevMappingBySender.set(senderId, frame.mapping ?? "");
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
            // Specials, deren Wirkung an der WebContents passiert (Maus-/
            // Tastatur-Klick), folgen dem `sender`-Param (= im Forward-Modus
            // forwardTarget, sonst Vordergrund). @forwardHold und @cursorHold
            // brauchen dagegen den originalSender (Vordergrund), damit
            // setForwardMode getBufferTarget(originalSender) korrekt aufloest
            // und Cursor-Mode-State am Vordergrund-Char umschaltet.
            // Launcher-Actions (@nextTab, @reloadView, @toggleFullscreen,
            // @openConfig) brauchen ebenfalls den originalSender — sie operieren
            // auf der Session-Window, nicht am Spiel-WebContents.
            const isForwardableSpecial = action !== "@forwardHold"
                && action !== "@cursorHold"
                && action !== "@cursorToggle"
                && action !== "@nextTab"
                && action !== "@prevTab"
                && action !== "@reloadView"
                && action !== "@toggleFullscreen"
                && action !== "@openConfig";
            const specialSender = isForwardableSpecial ? sender : (originalSender ?? sender);
            this.dispatchSpecial(action, specialSender, frame, true, btnIdx);
            return;
        }
        // Cursor-Modus: A → Maus-Klick links an aktueller Cursor-Position.
        // Andere Tasten gehen normal als KeyDown durch — User kann Skills
        // im Cursor-Modus nutzen.
        // Cursor-A-Tap nur wenn NICHT im Forward — sonst soll A normal als
        // KeyDown gehen (an forwardTarget). Cursor ist beim Forward suspendiert.
        if (this.mode === "cursor" && !this.forwardActive && btnIdx === BTN.A) {
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
        this.sendInput(sender, { type: "keyDown", keyCode: action });
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
        this.sendInput(target, { type: "keyUp", keyCode: action });
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
                if (down) {
                    // Pending UP-Timer abbrechen — DOWN annulliert ein
                    // kurzzeitiges Trigger-Flackern.
                    if (this.forwardReleaseTimer) {
                        clearTimeout(this.forwardReleaseTimer);
                        this.forwardReleaseTimer = null;
                        this.forwardReleaseSender = null;
                        this.forwardReleaseBtnIdx = -1;
                        // forwardActive bleibt unveraendert true → kein
                        // setForwardMode-Call noetig. Der Hold setzt sich fort.
                        logInfo(`[FORWARD] DOWN nach Flacker — UP-Timer abgebrochen, Hold haelt`, "controller");
                        return;
                    }
                    this.setForwardMode(true, sender, btnIdx);
                } else {
                    // UP nicht sofort verarbeiten — Hysterese-Timer starten.
                    // Wenn L2 binnen FORWARD_HYSTERESIS_MS wieder DOWN geht,
                    // bricht der DOWN-Branch oben den Timer ab.
                    if (this.forwardReleaseTimer) clearTimeout(this.forwardReleaseTimer);
                    this.forwardReleaseSender = sender;
                    this.forwardReleaseBtnIdx = btnIdx;
                    this.forwardReleaseTimer = setTimeout(() => {
                        this.forwardReleaseTimer = null;
                        const s = this.forwardReleaseSender;
                        const b = this.forwardReleaseBtnIdx;
                        this.forwardReleaseSender = null;
                        this.forwardReleaseBtnIdx = -1;
                        if (s && !s.isDestroyed()) {
                            logInfo(`[FORWARD] UP-Hysterese abgelaufen → deaktiviere Forward`, "controller");
                            this.setForwardMode(false, s, b);
                        }
                    }, ControllerInputRouter.FORWARD_HYSTERESIS_MS);
                }
                return;
            case "@actionPad":
                if (down && frame) {
                    this.triggerActionPad(sender, frame.viewportWidth, frame.viewportHeight);
                }
                return;
            case "@nameSlot:0":
            case "@nameSlot:1":
            case "@nameSlot:2":
            case "@nameSlot:3":
            case "@nameSlot:4":
            case "@nameSlot:5":
            case "@nameSlot:6":
            case "@nameSlot:7":
                if (down && frame) {
                    const slot = Number(action.slice("@nameSlot:".length));
                    if (Number.isInteger(slot) && slot >= 0 && slot < NAME_SLOT_COUNT) {
                        this.triggerNameSlot(sender, slot, frame.viewportWidth, frame.viewportHeight);
                    }
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
        logInfo(`[FORWARD] ${activate ? "activate" : "deactivate"} senderId=${sender.id} holdBtnIdx=${holdBtnIdx} currentActive=${this.forwardActive}`, "controller");
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
            this.prevButtonsBySender.set(sender.id, newPrev);
            this.skipPrevByButtonsSenders.add(sender.id);
            // Sticks SOFORT am neuen Target re-engagen — sonst muss der User
            // den Stick erst neu bewegen damit Preload (diff-basiert) ein
            // Frame schickt. Beispiel: User haelt linken Stick + drueckt L2 →
            // WASD-Taste muss SOFORT an RM (forwardTarget). Ohne dieses Re-
            // Apply wuerde der RM-Char stehen bleiben bis User Stick neu
            // bewegt.
            this.reapplyStickStateAt(target, sender);
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
            this.prevButtonsBySender.set(sender.id, new Array(16).fill(false));
            this.skipPrevByButtonsSenders.add(sender.id);
            // Sticks SOFORT an Vordergrund re-engagen — gleiche Logik wie
            // beim Activate, nur in die andere Richtung. Linker Stick haengt
            // beim L2-Release weiter gehalten → Main soll sofort weiterlaufen
            // ohne dass der User den Stick erst neu auslenken muss.
            this.reapplyStickStateAt(sender, sender);
        }
    }

    /**
     * Wendet den zuletzt bekannten Stick-Zustand von `axesSource` (Sender,
     * dessen Frames wir empfangen) als WASD- und Camera-Drag-Input auf
     * `targetWc` (wo die Inputs landen sollen) an.
     *
     * Hintergrund: das Preload pollt diff-basiert — wenn der Stick gehalten
     * und nicht bewegt wird, kommen keine neuen Frames. Bei Forward-State-
     * Wechsel (Aktivieren/Deaktivieren) ist `effectiveSender` jetzt aber ein
     * anderer WC. Ohne aktives Re-Engagement bleibt der gehaltene Stick
     * "stumm" am neuen Ziel — User waere genoetigt Stick los/wieder anzulegen.
     */
    private reapplyStickStateAt(targetWc: WebContents, axesSource: WebContents): void {
        if (targetWc.isDestroyed()) return;
        const prevAxes = this.prevAxesBySender.get(axesSource.id);
        if (!prevAxes) return;
        const lx = applyDeadzone(prevAxes[0] ?? 0);
        const ly = applyDeadzone(prevAxes[1] ?? 0);
        // Re-Engagement nach Forward-Wechsel: nutze ENGAGE-Threshold, damit
        // ein zwischen 0.25 und 0.40 ausgelenkter Stick nicht direkt neu
        // triggert (das waere effektiv ein Tap).
        this.updateStickKey(targetWc, "A", lx < -STICK_KEY_ENGAGE);
        this.updateStickKey(targetWc, "D", lx >  STICK_KEY_ENGAGE);
        this.updateStickKey(targetWc, "W", ly < -STICK_KEY_ENGAGE);
        this.updateStickKey(targetWc, "S", ly >  STICK_KEY_ENGAGE);
        // Camera-Stick (rechter Stick): nur re-engagen wenn ausgelenkt UND
        // wir die letzte Viewport-Groesse kennen. Im Cursor-Modus skippen
        // (Camera-Drag suspendiert).
        if (this.mode === "cursor" && !this.forwardActive) return;
        const rs = rightStickAxes(prevAxes, this.prevMappingBySender.get(axesSource.id));
        const rx = applyDeadzone(prevAxes[rs.xIdx] ?? 0);
        const ry = applyDeadzone(prevAxes[rs.yIdx] ?? 0);
        if (rx === 0 && ry === 0) return;
        // Viewport-Fallback: letzte bekannte Camera-Viewport-Groesse (kann
        // vom anderen Tab sein). Klein abweichend ok — Camera-Drag-Math nutzt
        // nur viewport/2 als Drag-Origin.
        const w = this.cameraViewportW > 0 ? this.cameraViewportW : 1920;
        const h = this.cameraViewportH > 0 ? this.cameraViewportH : 1080;
        this.updateCameraStick(targetWc, w, h, rx, ry);
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
                this.sendInput(target, { type: "keyUp", keyCode: action });
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
        // Mode-Wechsel: laufende Camera-Drag stoppen, Cursor- und Scroll-Pump
        // stoppen.
        if (this.cameraActive) this.stopCameraDrag();
        this.stopCursorPump();
        this.stopScrollPump();
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
        this.sendInput(sender, {
            type: "mouseWheel",
            x: Math.round(frame.viewportWidth / 2),
            y: Math.round(frame.viewportHeight / 2),
            deltaX: 0,
            deltaY,
            canScroll: true,
        } as Electron.MouseWheelInputEvent);
    }

    /** Maus-Down/Up an aktueller Cursor-Position (links). */
    private dispatchCursorMouse(sender: WebContents, type: "mouseDown" | "mouseUp"): void {
        if (sender.isDestroyed()) return;
        this.sendInput(sender, {
            type,
            x: Math.round(this.cursorX),
            y: Math.round(this.cursorY),
            button: "left",
            clickCount: 1,
        });
    }

    private updateStickKey(sender: WebContents, keyCode: string, shouldBeHeld: boolean): void {
        const isHeld = this.heldKeys.has(keyCode);
        if (shouldBeHeld && !isHeld) {
            this.heldKeys.add(keyCode);
            this.heldKeyTarget.set(keyCode, sender);
            this.sendInput(sender, { type: "keyDown", keyCode });
        }
        else if (!shouldBeHeld && isHeld) {
            this.heldKeys.delete(keyCode);
            // UP an dem WebContents wo der DOWN hingegangen ist (kann nach
            // Ringmaster-Wechsel ein anderer sein als der aktuelle `sender`).
            // Fallback auf sender wenn Map keinen Eintrag hat (Race / Cleanup).
            const target = this.heldKeyTarget.get(keyCode) ?? sender;
            this.heldKeyTarget.delete(keyCode);
            this.sendInput(target, { type: "keyUp", keyCode });
        }
    }

    private updateCameraStick(
        sender: WebContents,
        viewportWidth: number,
        viewportHeight: number,
        rx: number,
        ry: number,
    ): void {
        // Im Forward-Modus laufen die Mouse-Events an die forwardTarget-WC,
        // nicht an den Frame-Sender. Wenn die beiden unterschiedlich grosse
        // Viewports haben (z.B. Split-Layout: Main 960×1080, RM 1920×1080),
        // wuerde Camera-Drag mit Main's Maßen am RM auf falschen Koordinaten
        // landen → Maus klickt nicht auf RM's Canvas. Daher hier auf RM's
        // echte Viewport-Größe umstellen.
        if (this.forwardActive && this.forwardTarget && !this.forwardTarget.isDestroyed()) {
            const target = this.forwardTarget;
            const targetView = this.deps.getViewportFor?.(target);
            if (targetView && targetView.width > 0 && targetView.height > 0) {
                viewportWidth = targetView.width;
                viewportHeight = targetView.height;
            }
        }
        // Cursor-Modus: rechter Stick bewegt synthetischen Cursor statt Camera-
        // Drag zu starten. Im Forward ist Cursor suspendiert (handleButtonDown
        // checkt !this.forwardActive); rechter Stick faellt durch zum normalen
        // Camera-Drag am effectiveSender (= forwardTarget wenn forwardActive).
        // Damit dreht der rechte Stick im Forward die Kamera am Buffer-Char.
        if (this.mode === "cursor" && !this.forwardActive) {
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
            // Direction-Change durch den Mittelbereich: pending Release abbrechen.
            if (this.cameraReleaseTimer) {
                clearTimeout(this.cameraReleaseTimer);
                this.cameraReleaseTimer = null;
            }
            if (!this.cameraActive) {
                if (viewportWidth <= 0 || viewportHeight <= 0) return;
                const cx = viewportWidth / 2;
                const cy = viewportHeight / 2;
                const mag = Math.sqrt(rx * rx + ry * ry);
                const nx = mag > 0 ? rx / mag : 0;
                const ny = mag > 0 ? ry / mag : 0;
                const initialX = clamp(cx + nx * CAMERA_INITIAL_DRAG_PX, 0, viewportWidth);
                const initialY = clamp(cy + ny * CAMERA_INITIAL_DRAG_PX, 0, viewportHeight);
                this.dispatchMouseEvent(sender, "mouseMove", cx, cy);
                this.dispatchMouseEvent(sender, "mouseDown", cx, cy, "right");
                this.dispatchMouseEvent(sender, "mouseMove", initialX, initialY);
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
        else if (this.cameraActive && !this.cameraReleaseTimer) {
            // Stick neutral → erst NACH Grace-Period stoppen. Wenn der Stick
            // innerhalb der Grace wieder ausgelenkt wird (Direction-Change),
            // wird der Timer im if-Zweig oben gecancelt und der Drag laeuft
            // weiter — Flyff sieht keinen mouseUp → keine Origin-Reset →
            // keine Camera-Snapback.
            this.cameraReleaseTimer = setTimeout(() => {
                this.cameraReleaseTimer = null;
                this.stopCameraDrag();
            }, CAMERA_RELEASE_GRACE_MS);
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

        // 360°-Drehung: Cursor darf ueber den Viewport-Rand hinaus wandern.
        // Flyff Universe interpretiert die Drag-Bewegung absolut/relativ zur
        // Drag-Start-Position — Chromium/Flyff handlen Koordinaten ausserhalb
        // des Viewport-Range transparent (clientX kann negativ oder > width
        // sein). Damit dreht die Kamera so lange wie der Stick gehalten wird.
        // KEIN mouseUp+mouseDown-Edge-Reset (interpretiert Flyff als Drag-
        // verlassen → Spring-Back).
        //
        // Soft-Cap fuer den virtuellen Cursor bei ~3× Viewport-Breite, damit
        // die Zahlen nicht ins Unendliche wachsen wenn der User die Stick-
        // ewig haelt. Praktisch erreicht: ~3× Viewport ≈ 3× 360° = mehr als
        // genug fuer jedes Spielszenario.
        const maxOffsetX = w * 3;
        const maxOffsetY = h * 3;
        const cx = w / 2;
        const cy = h / 2;
        const newX = clamp(this.cameraLastX + dx, cx - maxOffsetX, cx + maxOffsetX);
        const newY = clamp(this.cameraLastY + dy, cy - maxOffsetY, cy + maxOffsetY);

        // Wenn der Cursor am Soft-Cap klebt, skippe den dispatch — sonst
        // floodieren wir CDP/IPC 60Hz lang ohne Effekt.
        if (newX === this.cameraLastX && newY === this.cameraLastY) return;

        this.dispatchMouseEvent(wc, "mouseMove", newX, newY);
        this.cameraLastX = newX;
        this.cameraLastY = newY;
    }

    /**
     * Maus-Event-Dispatch via sendInputEvent. Vorherige Variante mit
     * JS-Fallback (executeJavaScript-MouseEvent) hat den Renderer ueberlastet
     * (60Hz Pump → IPC-Flood) und alle anderen Inputs blockiert. Wenn der
     * Background-Tab das Maus-Event nicht sehen kann, ist das aktuell
     * unvermeidlich — Maus-Events brauchen einen aktiven WebContents.
     */
    private dispatchMouseEvent(
        wc: WebContents,
        type: "mouseDown" | "mouseUp" | "mouseMove",
        x: number,
        y: number,
        button: "left" | "right" = "left",
    ): void {
        if (wc.isDestroyed()) return;
        const ix = Math.round(x);
        const iy = Math.round(y);
        const ev: Parameters<WebContents["sendInputEvent"]>[0] =
            type === "mouseMove"
                ? { type, x: ix, y: iy }
                : { type, x: ix, y: iy, button, clickCount: 1 };
        this.sendInput(wc, ev);
    }

    private stopCameraDrag(): void {
        if (this.cameraPumpTimer) {
            clearInterval(this.cameraPumpTimer);
            this.cameraPumpTimer = null;
        }
        if (this.cameraReleaseTimer) {
            clearTimeout(this.cameraReleaseTimer);
            this.cameraReleaseTimer = null;
        }
        const wc = this.cameraSender;
        if (this.cameraActive && wc && !wc.isDestroyed()) {
            this.dispatchMouseEvent(wc, "mouseUp", this.cameraLastX, this.cameraLastY, "right");
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
        this.sendInput(wc, {
            type: "mouseMove",
            x: Math.round(this.cursorX),
            y: Math.round(this.cursorY),
        });
        // Wenn A im Cursor-Modus gehalten wird, brauchen wir kontinuierliche
        // mouseMove-Events damit Drag-Operationen im Spiel funktionieren
        // (z.B. Items im Inventar verschieben). Der bereits gesendete
        // mouseMove erfuellt das.
    }

    private stopCursorPump(): void {
        if (this.cursorPumpTimer) {
            clearInterval(this.cursorPumpTimer);
            this.cursorPumpTimer = null;
        }
    }

    /** Rechter Stick im Cursor-Modus: erzeugt mouseWheel-Events an der
     *  aktuellen Cursor-Position. Vertikal (ry) und horizontal (rx) skalieren
     *  proportional zur Stick-Auslenkung. */
    private updateScrollStick(
        sender: WebContents,
        viewportWidth: number,
        viewportHeight: number,
        rx: number,
        ry: number,
    ): void {
        this.scrollStickX = rx;
        this.scrollStickY = ry;
        this.scrollSender = sender;
        this.scrollViewportW = viewportWidth;
        this.scrollViewportH = viewportHeight;
        const isDeflected = rx !== 0 || ry !== 0;
        if (isDeflected && !this.scrollPumpTimer) {
            this.scrollPumpTimer = setInterval(() => this.pumpScroll(), SCROLL_PUMP_INTERVAL_MS);
        }
        else if (!isDeflected && this.scrollPumpTimer) {
            this.stopScrollPump();
        }
    }

    private pumpScroll(): void {
        const wc = this.scrollSender;
        if (!wc || wc.isDestroyed()) {
            this.stopScrollPump();
            return;
        }
        if (this.scrollStickX === 0 && this.scrollStickY === 0) return;
        if (this.scrollViewportW <= 0 || this.scrollViewportH <= 0) return;
        const x = Math.round(clamp(this.cursorX, 0, this.scrollViewportW));
        const y = Math.round(clamp(this.cursorY, 0, this.scrollViewportH));
        this.sendInput(wc, {
            type: "mouseWheel",
            x,
            y,
            deltaX: Math.round(this.scrollStickX * SCROLL_SPEED_PX),
            deltaY: Math.round(this.scrollStickY * SCROLL_SPEED_PX),
            canScroll: true,
        } as Electron.MouseWheelInputEvent);
    }

    private stopScrollPump(): void {
        if (this.scrollPumpTimer) {
            clearInterval(this.scrollPumpTimer);
            this.scrollPumpTimer = null;
        }
    }

    private isHatUpEdge(frame: GamepadFrame, prevAxes: number[]): boolean {
        const axes = frame.axes;
        if (axes.length < 2) return false;
        // Heuristik: HAT auf den letzten zwei Achsen (X, Y).
        const xIdx = axes.length - 2;
        const yIdx = axes.length - 1;
        const curX = axes[xIdx] ?? 0;
        const curY = axes[yIdx] ?? 0;
        const oldY = prevAxes[yIdx] ?? 0;
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
     * Position. Wrapper auf [fireJitteredClick] mit Lock-Key "actionPad".
     */
    private triggerActionPad(wc: WebContents, viewportWidth: number, viewportHeight: number): void {
        const anchor = this.deps.getActionPadAnchor(wc);
        if (!anchor) {
            this.deps.notify?.("Bitte zuerst Action-Pad kalibrieren");
            return;
        }
        const [w, h] = this.resolveTargetViewport(wc, viewportWidth, viewportHeight);
        this.fireJitteredClick(wc, anchor, w, h, "actionPad");
    }

    /**
     * Name-Slot-Klick: identische Mechanik wie Action-Pad, aber pro Slot eigener
     * Anker (Buff-Empfaenger 1..N im Party-Panel) und eigener Debounce-Lock.
     * Wenn der Slot nicht kalibriert ist → no-op + Toast.
     */
    private triggerNameSlot(wc: WebContents, slot: number, viewportWidth: number, viewportHeight: number): void {
        const anchor = this.deps.getNameSlotAnchor?.(wc, slot);
        const [w, h] = this.resolveTargetViewport(wc, viewportWidth, viewportHeight);
        logInfo(`[nameSlot] trigger slot=${slot} wcId=${wc?.id} anchor=${anchor ? JSON.stringify(anchor) : "null"} viewport=${w}x${h} frameViewport=${viewportWidth}x${viewportHeight}`, "controller");
        if (!anchor) {
            this.deps.notify?.(`Bitte Name-Slot ${slot + 1} kalibrieren`);
            return;
        }
        this.fireJitteredClick(wc, anchor, w, h, `nameSlot:${slot}`);
    }

    /**
     * Im Forward-Modus kommt der Frame vom SENDER (Main), traegt aber Mains
     * Viewport-Groesse. Wenn wir an einen anderen WC (RM/Forward-Target)
     * dispatchen, brauchen wir DESSEN Viewport, sonst rechnet
     * resolveActionPadPixel den Anker auf Mains Groesse — Klick landet
     * neben dem Ziel (z.B. im Split-Layout 960×1080 Main vs. 1280×800 RM).
     * `getViewportFor` schaut beim SessionTabsManager nach den echten Bounds.
     * Falls die Dep nicht verdrahtet ist oder keine Bounds liefert, Fallback
     * auf die uebergebene Frame-Viewport (alte Verhaltensweise).
     */
    private resolveTargetViewport(wc: WebContents, fallbackW: number, fallbackH: number): [number, number] {
        const view = this.deps.getViewportFor?.(wc);
        if (view && view.width > 0 && view.height > 0) return [view.width, view.height];
        return [fallbackW, fallbackH];
    }

    /**
     * Organischer Maus-Klick: Pixel-Offset, Druckdauer und Drift pro Press random
     * — keine konstante Sequenz, kein pixelgenauer Repeat. `lockKey` separiert
     * Debounce-State pro Aktionstyp, damit Slot-Clicks und Action-Pad-Clicks
     * sich nicht gegenseitig blockieren.
     *
     * `webContents.sendInputEvent` injiziert Events am Chromium-Input-Layer →
     * `MouseEvent.isTrusted = true` fuer die Page, ununterscheidbar von echtem
     * Hardware-Input. OS-Cursor wird NICHT bewegt — User kann die Maus weiter
     * normal benutzen.
     */
    private fireJitteredClick(
        wc: WebContents,
        anchor: ActionPadAnchor,
        viewportWidth: number,
        viewportHeight: number,
        lockKey: string,
    ): void {
        if (!wc || wc.isDestroyed()) {
            logInfo(`[click] ${lockKey} skipped — wc destroyed`, "controller");
            return;
        }

        const size = { width: viewportWidth, height: viewportHeight };
        if (size.width <= 0 || size.height <= 0) {
            logInfo(`[click] ${lockKey} skipped — bad viewport ${viewportWidth}x${viewportHeight}`, "controller");
            return;
        }

        const resolved = resolveActionPadPixel(anchor, viewportWidth, viewportHeight);
        logInfo(`[click] ${lockKey} target=(${Math.round(resolved.x)}, ${Math.round(resolved.y)}) wcId=${wc.id}`, "controller");

        const now = Date.now();
        const lastFire = this.lastClickFireMs.get(lockKey) ?? 0;
        if (now - lastFire < ACTION_PAD_DEBOUNCE_MS) {
            logInfo(`[click] ${lockKey} debounced (${now - lastFire}ms < ${ACTION_PAD_DEBOUNCE_MS}ms)`, "controller");
            return;
        }
        if (this.clickInProgress.get(lockKey)) {
            logInfo(`[click] ${lockKey} already in progress`, "controller");
            return;
        }
        this.lastClickFireMs.set(lockKey, now);
        this.clickInProgress.set(lockKey, true);

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

        this.sendInput(wc, {
            type: "mouseMove",
            x: Math.round(baseX),
            y: Math.round(baseY),
        });
        this.sendInput(wc, {
            type: "mouseDown",
            x: Math.round(baseX),
            y: Math.round(baseY),
            button: "left",
            clickCount: 1,
        });

        setTimeout(() => {
            if (wc.isDestroyed()) {
                this.clickInProgress.set(lockKey, false);
                return;
            }
            try {
                this.sendInput(wc, {
                    type: "mouseMove",
                    x: Math.round(driftX),
                    y: Math.round(driftY),
                });
                this.sendInput(wc, {
                    type: "mouseUp",
                    x: Math.round(driftX),
                    y: Math.round(driftY),
                    button: "left",
                    clickCount: 1,
                });
            } finally {
                this.clickInProgress.set(lockKey, false);
            }
        }, totalMs);
    }

    /** Reset bei Window-Wechsel oder Disable: gehaltene Tasten lockerlassen,
     *  Camera-Drag beenden, Edge-Tracking nullen, Cursor-Modus zuruecksetzen. */
    /**
     * Liefert `forwardTarget`, falls Forward gerade aktiv ist. Wird vom
     * Main-Process gebraucht um Overlay-Events (Modifier-Held, Face-Press) an
     * den Buffer-Target weiterzureichen — RM's eigene Overlay-Scheibe soll
     * waehrend Forward die Modifier-Layer-Belegung anzeigen, nicht Main's.
     */
    getActiveForwardTarget(): WebContents | null {
        if (!this.forwardActive || !this.forwardTarget || this.forwardTarget.isDestroyed()) return null;
        return this.forwardTarget;
    }

    reset(): void {
        // Held-Keys sauber loslassen — auf den jeweiligen Target wo der DOWN
        // hin ging (via heldKeyTarget). Vorher wurde stumpf cameraSender als
        // Fallback genommen, was bei Ringmaster-Forward die falsche View war.
        for (const keyCode of this.heldKeys) {
            const target = this.heldKeyTarget.get(keyCode);
            if (target && !target.isDestroyed()) {
                this.sendInput(target, { type: "keyUp", keyCode });
            }
        }
        // Falls A im Cursor-Modus gehalten war, Mouse-Up am letzten
        // Cursor-Punkt — sonst bleibt linke Maustaste haengen.
        if (this.cursorMouseDown && this.cursorSender && !this.cursorSender.isDestroyed()) {
            this.sendInput(this.cursorSender, {
                type: "mouseUp",
                x: Math.round(this.cursorX),
                y: Math.round(this.cursorY),
                button: "left",
                clickCount: 1,
            });
        }
        this.heldKeys.clear();
        this.heldKeyTarget.clear();
        this.heldButtonActions.clear();
        this.stopCameraDrag();
        this.stopCursorPump();
        this.stopScrollPump();
        this.cursorMouseDown = false;
        this.mode = "normal";
        this.forwardActive = false;
        this.forwardTarget = null;
        // Hysterese-Timer cleanen, sonst koennte ein noch laufender
        // Forward-Release-Timer nach reset() setForwardMode(false) auf
        // bereits resetteten State rufen.
        if (this.forwardReleaseTimer) {
            clearTimeout(this.forwardReleaseTimer);
            this.forwardReleaseTimer = null;
        }
        this.forwardReleaseSender = null;
        this.forwardReleaseBtnIdx = -1;
        this.prevButtonsBySender.clear();
        this.prevAxesBySender.clear();
        this.prevMappingBySender.clear();
        this.axisLayoutLogged = false;
        this.skipPrevByButtonsSenders.clear();
        this.cdpHeldMouseButtons.clear();
        this.routingLogged.clear();
        this.clickInProgress.clear();
        this.lastClickFireMs.clear();
    }
}

function applyDeadzone(value: number): number {
    return Math.abs(value) < STICK_DEADZONE ? 0 : value;
}

/** Achsen-Indizes des rechten Sticks bei Standard-Gamepads (Web-Gamepad-API
 *  mapping="standard"). */
const RIGHT_STICK_STANDARD = { xIdx: 2, yIdx: 3 } as const;

/** Achsen-Indizes des rechten Sticks bei Non-Standard-Pads. Linux/Chromium
 *  reicht solche Pads in evdev-Reihenfolge `[LX, LY, LT, RX, RY, RT]` durch —
 *  axes[2] ist dort der linke Analog-Trigger, der rechte Stick rutscht auf
 *  axes[3]/[4]. Betrifft v.a. den in den Steam Deck eingebauten Controller im
 *  Desktop-Mode (hid-steam, ohne Steam Input): der meldet `mapping=""`. */
const RIGHT_STICK_NONSTANDARD = { xIdx: 3, yIdx: 4 } as const;

/**
 * Liefert die Achsen-Indizes des rechten Sticks. Standard-Pads → axes[2]/[3].
 * Bei Non-Standard-Mapping mit mindestens 5 Achsen wird das Linux-6-Achsen-
 * Layout angenommen und auf axes[3]/[4] korrigiert — sonst laese der Router
 * axes[2] (= linker Trigger) als rechten-Stick-X und die Kamera reagierte nur,
 * wenn der Spieler zusaetzlich den Trigger zieht. `mapping` undefined (alte
 * Preload-Version) → konservativ Standard.
 */
function rightStickAxes(axes: number[], mapping: string | undefined): { xIdx: number; yIdx: number } {
    const isStandard = mapping === undefined || mapping === "standard";
    if (!isStandard && axes.length >= 5) return RIGHT_STICK_NONSTANDARD;
    return RIGHT_STICK_STANDARD;
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


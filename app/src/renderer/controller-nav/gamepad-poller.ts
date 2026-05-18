/**
 * Gamepad-Poller für die Launcher-Navigation.
 *
 * Liest `navigator.getGamepads()` per requestAnimationFrame, erkennt
 * Button-Flanken und Richtungs-Eingaben (linker Stick + D-Pad) und meldet sie
 * als semantische Navigations-Events. Komplett getrennt vom
 * ControllerInputRouter des Main-Process — dieser Poller steuert ausschließlich
 * die Launcher-Oberfläche und läuft nur im Renderer.
 */

export type NavDirection = "up" | "down" | "left" | "right";
export type NavButton =
    | "activate" // ✕ / A
    | "back"     // ◯ / B
    | "menu"     // ☰ Options / Start
    | "tabPrev"  // L1
    | "tabNext"; // R1

export interface PollerHandlers {
    onDirection(dir: NavDirection): void;
    onButton(btn: NavButton): void;
    onScroll(dx: number, dy: number): void;
    /** Meldet Änderungen der Gamepad-Präsenz (verbunden / getrennt). */
    onPadPresence(present: boolean): void;
}

// Standard-Gamepad-Layout (Chromium "standard mapping").
const BTN_A = 0;
const BTN_B = 1;
const BTN_L1 = 4;
const BTN_R1 = 5;
const BTN_START = 9;
const BTN_DPAD_UP = 12;
const BTN_DPAD_DOWN = 13;
const BTN_DPAD_LEFT = 14;
const BTN_DPAD_RIGHT = 15;

const STICK_DEADZONE = 0.5;
const SCROLL_DEADZONE = 0.25;
const SCROLL_SPEED = 16;        // px pro Frame bei vollem Stick-Ausschlag
const REPEAT_DELAY_MS = 420;    // erste Wiederholung einer gehaltenen Richtung
const REPEAT_INTERVAL_MS = 110; // danach

export interface GamepadPoller {
    start(): void;
    stop(): void;
    isRunning(): boolean;
}

export function createGamepadPoller(handlers: PollerHandlers): GamepadPoller {
    let running = false;
    let rafId = 0;
    let padPresent = false;
    const prevButtons: boolean[] = [];
    let heldDir: NavDirection | null = null;
    let nextRepeatAt = 0;

    function readDirection(gp: Gamepad): NavDirection | null {
        const ax = gp.axes[0] ?? 0;
        const ay = gp.axes[1] ?? 0;
        const up = (gp.buttons[BTN_DPAD_UP]?.pressed === true) || ay < -STICK_DEADZONE;
        const down = (gp.buttons[BTN_DPAD_DOWN]?.pressed === true) || ay > STICK_DEADZONE;
        const left = (gp.buttons[BTN_DPAD_LEFT]?.pressed === true) || ax < -STICK_DEADZONE;
        const right = (gp.buttons[BTN_DPAD_RIGHT]?.pressed === true) || ax > STICK_DEADZONE;
        // Dominante Achse gewinnt — kein Diagonal-Sprung.
        if (Math.abs(ax) > Math.abs(ay)) {
            if (left) return "left";
            if (right) return "right";
            if (up) return "up";
            if (down) return "down";
        } else {
            if (up) return "up";
            if (down) return "down";
            if (left) return "left";
            if (right) return "right";
        }
        return null;
    }

    function edge(gp: Gamepad, idx: number): boolean {
        const pressed = gp.buttons[idx]?.pressed === true;
        const was = prevButtons[idx] === true;
        prevButtons[idx] = pressed;
        return pressed && !was;
    }

    function tick(): void {
        if (!running) return;
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        let gp: Gamepad | null = null;
        for (const p of pads) {
            if (p) { gp = p; break; }
        }
        const present = gp !== null;
        if (present !== padPresent) {
            padPresent = present;
            handlers.onPadPresence(present);
        }
        if (gp) {
            if (edge(gp, BTN_A)) handlers.onButton("activate");
            if (edge(gp, BTN_B)) handlers.onButton("back");
            if (edge(gp, BTN_START)) handlers.onButton("menu");
            if (edge(gp, BTN_L1)) handlers.onButton("tabPrev");
            if (edge(gp, BTN_R1)) handlers.onButton("tabNext");

            // Richtung mit Auto-Repeat.
            const dir = readDirection(gp);
            const now = performance.now();
            if (dir && dir !== heldDir) {
                heldDir = dir;
                nextRepeatAt = now + REPEAT_DELAY_MS;
                handlers.onDirection(dir);
            } else if (dir && dir === heldDir && now >= nextRepeatAt) {
                nextRepeatAt = now + REPEAT_INTERVAL_MS;
                handlers.onDirection(dir);
            } else if (!dir) {
                heldDir = null;
            }

            // Rechter Stick → Scroll.
            const sx = gp.axes[2] ?? 0;
            const sy = gp.axes[3] ?? 0;
            if (Math.abs(sx) > SCROLL_DEADZONE || Math.abs(sy) > SCROLL_DEADZONE) {
                handlers.onScroll(
                    Math.abs(sx) > SCROLL_DEADZONE ? sx * SCROLL_SPEED : 0,
                    Math.abs(sy) > SCROLL_DEADZONE ? sy * SCROLL_SPEED : 0,
                );
            }
        }
        rafId = requestAnimationFrame(tick);
    }

    return {
        start(): void {
            if (running) return;
            running = true;
            rafId = requestAnimationFrame(tick);
        },
        stop(): void {
            running = false;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = 0;
            heldDir = null;
            prevButtons.length = 0;
        },
        isRunning(): boolean {
            return running;
        },
    };
}

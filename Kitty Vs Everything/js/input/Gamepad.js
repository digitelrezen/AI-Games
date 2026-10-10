// Filename: Gamepad.js
// Kitty Vs Everything — v4.22.0
// CONTROLLER SUPPORT — Gamepad API polling for Xbox-layout and any
// standard-mapping gamepad (PlayStation / generic pads map to the same
// standard button indices).
//
// Polling: Game.loop() calls update() once per frame BEFORE the simulation
// reads input (so edges are fresh), and endFrame() clears the edge set
// (same lifecycle as InputManager's keyboard/mouse pressed sets).
//
// Standard mapping (Xbox layout, index → role):
//   0 A        — Fire (primary)
//   1 B        — Cycle Weapon
//   2 X        — Stun Rockets
//   3 Y        — Napalm Rockets
//   4 LB       — Boost (also 6 LT)
//   5 RB       — Ultimate
//   7 RT       — Fire (primary, hold)
//   9 Start    — Pause (onPause callback — Game.js gates it)
//   12 D-pad ↑ — Deploy / Recall Fleet
//   13 D-pad ↓ — Synergy (Fleet Orbit)
// Sticks (deadzoned + renormalized to 0..1):
//   axis 0 (left X)  — strafe / rotate (PlayerFlight, follows controlMode)
//   axis 1 (left Y)  — thrust (up) / brake (down)
//   axis 2 (right X) — spin (PlayerFlight, × spinSpeedMouse)
//
// Integration: InputManager owns an instance (this.gamepad) and ORs its
// isDown()/wasPressed() into the action layer (isDownAction /
// wasPressedAction), so Player / PlayerWeapons / PlayerFlight consume the
// controller through the SAME remappable action API as keyboard + mouse —
// no game module ever reads a gamepad directly.
//
// Enable: SETTINGS.gamepad (Settings → CONTROLLER, default ON) — when
// disabled the pad is ignored (state zeroed, no gameplay effect).
// Events: bus 'gamepadConnected' / 'gamepadDisconnected' (Settings status
// line + Game.js msglog).
export const VERSION = 'v4.22.0';
import { bus } from '../core/EventBus.js';
import { SETTINGS } from '../ui/Settings.js';

const DEADZONE = 0.25; // stick deadzone (raw), renormalized after

// Standard (Xbox) button indices
const BTN = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7,
  BACK: 8, START: 9, LS: 10, RS: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
};

// action → button indices (any bound button pressed counts — mirrors the
// Keybinds.js "any code in the list" semantics)
const ACTION_BUTTONS = {
  fire:        [BTN.A, BTN.RT],
  cycleWeapon: [BTN.B],
  stun:        [BTN.X],
  napalm:      [BTN.Y],
  boost:       [BTN.LB, BTN.LT],
  ultimate:    [BTN.RB],
  deployFleet: [BTN.UP],
  synergy:     [BTN.DOWN],
};

/** Deadzone + renormalize a raw axis value to 0..1 (keeps full range feel). */
function deadzone(v) {
  if (Math.abs(v) < DEADZONE) return 0;
  return (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE);
}

export default class Gamepad {
  constructor() {
    this.connected = false;
    this.id = '';
    this.name = '';
    // Analog stick state (deadzoned, -1..1) — read by PlayerFlight.js.
    this.axisX = 0;    // left stick X (strafe / rotate)
    this.axisY = 0;    // left stick Y (thrust up / brake down)
    this.spinX = 0;    // right stick X (spin)
    this.onPause = null; // Game.js: pause-toggle callback (Start button)
    this._pad = null;
    this._down = new Set();      // actions currently held
    this._pressed = new Set();   // actions that went down this frame
    this._prevDown = new Set();
    this._prevStart = false;
  }

  /**
   * Poll once per frame (Game.loop, before the sim reads input).
   * Safe in headless / no-gamepad browsers (no-op state).
   */
  update() {
    if (!SETTINGS.gamepad) {
      // Disabled in Settings → behave as if no pad is attached.
      if (this.connected) this._settle();
      return;
    }
    let pad = null;
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      const pads = navigator.getGamepads();
      for (const gp of pads) {
        if (gp && gp.connected) { pad = gp; break; } // first connected pad wins
      }
    }
    if (!pad) {
      if (this.connected) this._settle();
      return;
    }
    const wasConnected = this.connected;
    this.connected = true;
    this._pad = pad;
    if (!wasConnected || this.id !== pad.id) {
      this.id = pad.id;
      this.name = pad.id; // pad.id carries the device name in all major browsers
      bus.emit('gamepadConnected', { name: this.name });
    }

    // ─── Sticks (deadzoned) ───
    this.axisX = deadzone(pad.axes[0] || 0);
    this.axisY = deadzone(pad.axes[1] || 0);
    this.spinX = deadzone(pad.axes[2] || 0);

    // ─── Buttons → actions (held + edge) ───
    const down = new Set();
    for (const [action, btns] of Object.entries(ACTION_BUTTONS)) {
      for (const b of btns) {
        const btn = pad.buttons[b];
        if (btn && btn.pressed) { down.add(action); break; }
      }
    }
    for (const action of down) {
      if (!this._prevDown.has(action)) this._pressed.add(action);
    }
    this._down = down;
    this._prevDown = new Set(down);

    // ─── Start → pause (edge) ───
    const start = pad.buttons[BTN.START] && pad.buttons[BTN.START].pressed;
    if (start && !this._prevStart && this.onPause) this.onPause();
    this._prevStart = start;
  }
  /** True while a mapped button is held. */
  isDown(action) { return this._down.has(action); }

  /** True on the frame a mapped button went down (cleared in endFrame). */
  wasPressed(action) { return this._pressed.has(action); }

  /** Left-stick forward magnitude 0..1 (stick up). */
  get thrust() { return this.axisY < 0 ? -this.axisY : 0; }
  /** Left-stick reverse magnitude 0..1 (stick down). */
  get brake() { return this.axisY > 0 ? this.axisY : 0; }

  /** Clear per-frame edge state (called from InputManager.endFrame). */
  endFrame() { this._pressed.clear(); }

  /** Pad vanished (or support disabled) — zero everything, emit once. */
  _settle() {
    this.connected = false;
    this._pad = null;
    this.axisX = this.axisY = this.spinX = 0;
    this._down = new Set();
    this._pressed = new Set();
    this._prevDown = new Set();
    this._prevStart = false;
    bus.emit('gamepadDisconnected', { name: this.name });
    this.name = '';
  }
}
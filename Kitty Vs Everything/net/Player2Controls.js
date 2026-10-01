// Filename: net/Player2Controls.js
// Kitty Vs Everything — v3.47.0
// Player 2 keyboard input — a SEPARATE keybind set + input state for the
// second cat ship (local co-op and host-driven remote P2). It exposes the SAME
// action-layer interface the rest of the game consumes (isDownAction /
// wasPressedAction / mouseIdleTime / mouse.moveX), so a P2 Player instance can
// be updated with `p2.update(dt, p2Controls)` with zero changes to the flight /
// weapon / fleet modules.
//
// P2 does NOT use the mouse (P1 owns it). P2 auto-aims at the nearest enemy —
// the CoopManager sets p2.angle each frame — so rotateLeft/rotateRight are left
// unbound and mouseIdleTime() reports "idle" to skip mouse-look.
//
// Default P2 binds (chosen to never collide with P1's defaults):
//   fire KeyK · thrust KeyI · brake KeyO · boost KeyY · stun KeyV ·
//   napalm KeyX · ultimate KeyM · cycleWeapon KeyZ · deployFleet Numpad0 ·
//   synergy Comma (v3.47.0 — P2 Synergy Explosion, mirrors P1's T / -)
// Remappable + persisted to localStorage (kve-keybinds-p2-v1).
import { bus } from '../js/core/EventBus.js';

const STORAGE_KEY = 'kve-keybinds-p2-v1';

export const P2_ACTIONS = [
  'fire', 'thrust', 'brake', 'boost',
  'stun', 'napalm', 'ultimate', 'cycleWeapon', 'deployFleet', 'synergy',
  'rotateLeft', 'rotateRight',
];

export const P2_DEFAULT_BINDS = {
  fire: ['KeyK'],
  thrust: ['KeyI'],
  brake: ['KeyO'],
  boost: ['KeyY'],
  stun: ['KeyV'],
  napalm: ['KeyX'],
  ultimate: ['KeyM'],
  cycleWeapon: ['KeyZ'],
  deployFleet: ['Numpad0'],
  synergy: ['Comma'],   // v3.47.0: P2 Synergy Explosion
  rotateLeft: [],   // auto-aim (CoopManager)
  rotateRight: [],  // auto-aim (CoopManager)
};

function loadBinds() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) || {};
        const out = JSON.parse(JSON.stringify(P2_DEFAULT_BINDS));
        for (const id of P2_ACTIONS) {
          if (Array.isArray(data[id])) out[id] = data[id].filter((c) => typeof c === 'string');
        }
        return out;
      }
    }
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(P2_DEFAULT_BINDS));
}

class Player2Controls {
  constructor() {
    this.binds = loadBinds();
    this.enabled = false;
    this._down = new Set();
    this._pressed = new Set();
    this.mouse = { moveX: 0 };
    this._onKeyDown = (e) => {
      if (!this.enabled) return;
      if (e.repeat) return;
      this._down.add(e.code);
      this._pressed.add(e.code);
      if (this._isBound(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => { this._down.delete(e.code); };
    this._onBlur = () => { this._down.clear(); };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  _isBound(code) {
    return Object.values(this.binds).some((list) => list.includes(code));
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!on) { this._down.clear(); this._pressed.clear(); }
  }

  /** True if any code bound to `action` is currently held. */
  isDownAction(action) {
    const list = this.binds[action] || [];
    return list.some((c) => this._down.has(c));
  }

  /** True if any code bound to `action` was pressed this frame (edge). */
  wasPressedAction(action) {
    const list = this.binds[action] || [];
    return list.some((c) => this._pressed.has(c));
  }

  /** P2 never uses the mouse — report "idle" so flight skips mouse-look. */
  mouseIdleTime() { return Infinity; }

  /** Rebind an action to a single code (steals it from other P2 actions). */
  setBind(action, code) {
    if (!P2_ACTIONS.includes(action) || typeof code !== 'string') return;
    for (const id of P2_ACTIONS) this.binds[id] = this.binds[id].filter((c) => c !== code);
    this.binds[action] = [code];
    this._persist();
    bus.emit('p2keybindsChanged');
  }

  resetBinds() {
    this.binds = JSON.parse(JSON.stringify(P2_DEFAULT_BINDS));
    this._persist();
    bus.emit('p2keybindsChanged');
  }

  _persist() {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(this.binds)); } catch (e) { /* ignore */ }
  }

  /** Clear per-frame edge state — call once per frame (mirrors InputManager.endFrame). */
  endFrame() { this._pressed.clear(); }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
  }
}

export const p2Controls = new Player2Controls();
export default p2Controls;

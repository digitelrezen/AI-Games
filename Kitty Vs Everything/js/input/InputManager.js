// Filename: InputManager.js
// Kitty Vs Everything — v3.7.0
// Unified keyboard + mouse + touch input. Tracks pressed/just-pressed keys,
// mouse position, and touch joystick/button state.
// v3.1.0: Renamed btn-element to btn-weapon.
// v3.5.0: Mouse idle tracking (mouse.lastMove / mouseIdleTime) so the
//         mouse-look flight model only steers while the mouse is in active
//         use — keyboard-only and touch players keep full control.
// v3.7.0: Dual keybinds — righty Q/E/F/R + lefty H/J/C/L/G (E is now
//         NAPALM, not primary fire). mouse.moveX accumulates raw movementX
//         per frame for the delta-based 360° spin (PlayerFlight.js). New
//         NAPALM touch button (btn-napalm).
// v3.12.0: Mouse mapping uses logical GAME.W/H — the canvas buffer may be
//          q×-scaled by ViewScaler and #game-root is CSS-scaled to fit the
//          display, so buffer-pixel math would drift.
// v3.13.0: Mouse mapping uses the LIVE logical viewport (view.viewW/H) —
//          the width stretches on ultra-wide displays, so mapping to fixed
//          1280×720 would misalign aim off-center.
// v3.14.0: REMAPPABLE ACTION LAYER — all gameplay input now goes through
//          isDownAction()/wasPressedAction(), which resolve the action's
//          codes from Keybinds.js (keyboard keys AND mouse buttons
//          Mouse0–Mouse4, any 2 aliases each). Touch fallbacks live in the
//          action layer. Raw-key access (isDown/wasPressed/mouse.down) is
//          retained for internal use only — game modules must not call it.
// v3.31.0: POINTER LOCK — requestPointerLock()/releasePointerLock()/isLocked()
//          hide the cursor + capture raw mouse deltas during active
//          gameplay. Game.js owns the policy (when to lock/unlock) and
//          receives pointerlockchange via onLockChange — the browser
//          consumes the Escape keydown while locked, so the game pauses
//          from the lock loss, not a keydown. mousemove skips absolute
//          x/y mapping while locked (movementX + idle tracking keep
//          working); touch devices never lock.
// v4.22.0: GAMEPAD LAYER — this.gamepad (Gamepad.js, Gamepad API, Xbox
//          standard mapping) is polled once per frame by Game.loop() and
//          ORed into the action layer: isDownAction()/wasPressedAction()
//          also count mapped gamepad buttons, so Player / PlayerWeapons /
//          PlayerFlight consume the controller through the same remappable
//          action API (Settings → CONTROLLER toggles SETTINGS.gamepad).
//          Analog sticks (axisX/axisY/spinX) are read directly by
//          PlayerFlight.js for thrust / brake / strafe / spin.
export const VERSION = 'v4.22.0';
import { GAME } from '../core/config.js';
import { KEYBINDS, isMouseCode } from './Keybinds.js';
import Gamepad from './Gamepad.js'; // v4.22.0: controller support

export default class InputManager {
  constructor(canvas, view = null) {
    this.keys = new Set();
    this.pressed = new Set();
    // v3.14.0: buttons = live mouse-button set (Mouse0–Mouse4);
    // mouse.down/right kept as legacy aliases (button 0 / button 2).
    this.mousePressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, right: false, lastMove: 0, moveX: 0, buttons: new Set() };
    this.canvas = canvas;
    this.view = view; // v3.13.0: live logical viewport (ViewScaler)
    this.touch = { active: false, joyX: 0, joyY: 0, fire: false, boost: false, stun: false, napalm: false, nova: false, weapon: false };
    // v4.22.0: gamepad (controller) layer — Game.loop() polls
    // this.gamepad.update() each frame; the action layer below ORs its
    // button state in; PlayerFlight.js reads the analog sticks directly.
    this.gamepad = new Gamepad();

    // v3.31.0: pointer lock — cursor hidden + deltas captured in play.
    // Touch devices have no pointer to lock (the touch UI owns input).
    this._isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this._relockArmed = false;
    this.onLockChange = null; // Game.js: (locked) => policy (auto-pause on ESC)
    document.addEventListener('pointerlockchange', () => {
      if (this.onLockChange) this.onLockChange(this.isLocked());
    });
    document.addEventListener('pointerlockerror', () => this._armRelock());

    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      // v3.13.0: map to LIVE logical coordinates (view.viewW/H) — the
      // viewport widens on ultra-wide, so fixed 1280×720 would misalign.
      // v3.31.0: while pointer-locked, clientX/Y are pinned to the lock
      // point — skip the absolute mapping (nothing consumes mouse.x/y;
      // the flight model uses the moveX deltas below).
      if (!this.isLocked()) {
        const vw = this.view ? this.view.viewW : GAME.W;
        const vh = this.view ? this.view.viewH : GAME.H;
        this.mouse.x = (e.clientX - r.left) * (vw / r.width);
        this.mouse.y = (e.clientY - r.top) * (vh / r.height);
      }
      // v3.7.0: accumulate raw horizontal mouse movement for the
      // delta-based 360° spin (PlayerFlight.js consumes it; endFrame clears).
      this.mouse.moveX += (typeof e.movementX === 'number' ? e.movementX : 0);
      this.mouse.lastMove = performance.now();
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button >= 0 && e.button <= 4) {
        const code = 'Mouse' + e.button;
        if (!this.mouse.buttons.has(code)) this.mousePressed.add(code);
        this.mouse.buttons.add(code);
      }
      // legacy aliases
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) this.mouse.right = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button >= 0 && e.button <= 4) this.mouse.buttons.delete('Mouse' + e.button);
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this._initTouch();
  }

  _initTouch() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    const touchUI = document.getElementById('touch-ui');
    if (touchUI) touchUI.classList.remove('hidden');

    const joyBase = document.getElementById('joy-base');
    const joyKnob = document.getElementById('joy-knob');
    let joyId = null;

    joyBase.addEventListener('touchstart', (e) => {
      e.preventDefault();
      joyId = e.changedTouches[0].identifier;
      this._updateJoy(e.changedTouches[0], joyBase);
    });
    joyBase.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) this._updateJoy(t, joyBase);
      }
    });
    joyBase.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          joyId = null;
          this.touch.joyX = 0;
          this.touch.joyY = 0;
          joyKnob.style.transform = 'translate(0,0)';
        }
      }
    });

    const bindBtn = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); this.touch[key] = true; });
      el.addEventListener('touchend', (e) => { e.preventDefault(); this.touch[key] = false; });
    };
    bindBtn('btn-fire', 'fire');
    bindBtn('btn-stun', 'stun');
    bindBtn('btn-napalm', 'napalm');
    bindBtn('btn-nova', 'nova');
    bindBtn('btn-boost', 'boost');
    bindBtn('btn-weapon', 'weapon');
  }

  _updateJoy(touch, base) {
    const r = base.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;
    const max = r.width / 2;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    this.touch.joyX = dx / max;
    this.touch.joyY = dy / max;
    const knob = document.getElementById('joy-knob');
    if (knob) knob.style.transform = `translate(${dx}px,${dy}px)`;
  }

  /**
   * Seconds since the physical mouse last moved — Infinity if it never
   * moved. Used by the mouse-spin flight model (PlayerFlight.js) so the
   * ship only spins from mouse movement while the mouse is actively used.
   */
  mouseIdleTime() {
    if (!this.mouse.lastMove) return Infinity;
    return (performance.now() - this.mouse.lastMove) / 1000;
  }

  // ═══ POINTER LOCK (v3.31.0) — cursor hidden + captured deltas in play ═══

  /** True while the canvas holds the browser pointer lock. */
  isLocked() {
    return document.pointerLockElement === this.canvas;
  }

  /**
   * Hide the cursor + capture mouse deltas (active gameplay). No-op on touch
   * devices. Safe to call without a user gesture — a refused request (ESC
   * re-lock cooldown / missing gesture) arms a one-shot canvas click that
   * retries, so the player re-engages with a single click.
   */
  requestPointerLock() {
    if (this._isTouch || this.isLocked()) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => this._armRelock());
    } catch (_) { /* non-secure context / unsupported — cursor stays visible */ }
  }

  /** Restore the cursor (pause / settings / game-over / menu). */
  releasePointerLock() {
    this._disarmRelock();
    if (this.isLocked()) document.exitPointerLock();
  }

  /**
   * Browser refused a re-lock: the next click on the canvas retries, so the
   * player can re-engage with one click. Disarmed on any explicit release so
   * a stray click can never lock the pointer while a menu is up.
   */
  _armRelock() {
    if (this._relockArmed || this._isTouch) return;
    this._relockArmed = true;
    this._relockRetry = () => {
      this._disarmRelock();
      this.requestPointerLock();
    };
    this.canvas.addEventListener('click', this._relockRetry);
  }

  _disarmRelock() {
    if (!this._relockArmed) return;
    this._relockArmed = false;
    this.canvas.removeEventListener('click', this._relockRetry);
    this._relockRetry = null;
  }

  // ═══ RAW CODE LAYER (internal + legacy) ═══

  isDownCode(code) {
    if (isMouseCode(code)) return this.mouse.buttons.has(code);
    return this.keys.has(code);
  }

  wasPressedCode(code) {
    if (isMouseCode(code)) return this.mousePressed.has(code);
    return this.pressed.has(code);
  }

  /** @deprecated v3.14.0 — raw-key query. Use isDownAction() instead. */
  isDown(...codes) {
    for (const c of codes) if (this.isDownCode(c)) return true;
    return false;
  }

  /** @deprecated v3.14.0 — raw-key query. Use wasPressedAction() instead. */
  wasPressed(code) {
    return this.wasPressedCode(code);
  }

  // ═══ ACTION LAYER (v3.14.0) — the only API game modules may use ═══
  // Resolves an action's bound codes from Keybinds.js; any bound code
  // (keyboard key or mouse button) counts. Touch fallbacks map the old
  // touch buttons onto actions (one-shot flags consume themselves).

  isDownAction(action) {
    for (const code of (KEYBINDS[action] || [])) {
      if (this.isDownCode(code)) return true;
    }
    // v4.22.0: gamepad buttons (Xbox standard mapping — Gamepad.js).
    if (this.gamepad.isDown(action)) return true;
    switch (action) {
      case 'fire':        return this.touch.fire;
      case 'thrust':      return this.touch.joyY < -0.3;
      case 'brake':       return this.touch.joyY > 0.3;
      case 'rotateLeft':  return this.touch.joyX < -0.3;
      case 'rotateRight': return this.touch.joyX > 0.3;
      case 'boost':       return this.touch.boost;
    }
    return false;
  }

  wasPressedAction(action) {
    for (const code of (KEYBINDS[action] || [])) {
      if (this.wasPressedCode(code)) return true;
    }
    // v4.22.0: gamepad button edges (cleared in endFrame).
    if (this.gamepad.wasPressed(action)) return true;
    switch (action) {
      case 'stun':        if (this.touch.stun)   { this.touch.stun = false;   return true; } break;
      case 'napalm':      if (this.touch.napalm) { this.touch.napalm = false; return true; } break;
      case 'ultimate':    if (this.touch.nova)   { this.touch.nova = false;   return true; } break;
      case 'cycleWeapon': if (this.touch.weapon) { this.touch.weapon = false; return true; } break;
    }
    return false;
  }

  endFrame() {
    this.pressed.clear();
    this.mousePressed.clear();
    this.mouse.moveX = 0; // v3.7.0: clear accumulated mouse movement each frame
    this.gamepad.endFrame(); // v4.22.0: clear gamepad button edges
  }
}
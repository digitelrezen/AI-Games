// Filename: PlayerFlight.js
// Kitty Vs Everything — v3.11.0 (screen bounds: bounce or wrap — SETTINGS)
// Asteroids-style flight for the cat ship: rotation, thrust, boost, drag,
// speed cap, wrap-around bounds, tail sway. Pure logic — mutates the
// Player's flight state (angle, vx/vy, tailSway, prevAngle, ...).
// v3.3.0: Extracted from Player.js (module split of oversized files).
// v3.5.0: Mouse-look steering + S as active brake (see below).
// v3.6.0: Continuous 360° mouse-look (position-based cursor tracking).
// v3.7.0: Mouse spin is now DELTA-BASED — moving the mouse LEFT/RIGHT
//         spins the ship by mouse-movement distance (full 360°+ in one
//         motion, no "ship always yanks toward the cursor" pull).
//         The mouse spin-speed setting (Settings.js) scales the rad/px
//         rate DIRECTLY, so the sensitivity slider has a visible effect.
//         THRUST REWORK: holding BOOST (Space/RMB) alone now thrusts the
//         ship FORWARD at base speed; adding W on top engages BOOST_MULT
//         (faster); S (even while still boosting) still brakes, then
//         reverses along the facing heading.
// v3.14.0: Remappable action layer — rotation/boost/thrust/brake read
//          input.isDownAction(...) (Keybinds.js, keyboard + mouse buttons)
//          and the spin sensitivity SPLIT: keyboard spin ×
//          SETTINGS.spinSpeedKeyboard, mouse spin × SETTINGS.spinSpeedMouse
//          (the legacy shared spin-speed setting is retired).
// v3.78.0: A/D CONTROL MODE (Settings.controlMode) — 'strafe' (default):
//          A/D slide the ship sideways, perpendicular to the nose (lateral
//          thrust × PLAYER.STRAFE_THRUST_MULT); mouse spin stays fully
//          active. 'spin': the classic behavior (A/D rotate the nose; mouse
//          spin only when no rotation key is held).
export const VERSION = 'v3.78.0';
import { PLAYER } from '../core/config.js';
import { TAU } from '../core/utils.js';
import { SETTINGS } from '../ui/Settings.js';

/**
 * v3.7.0 DELTA-BASED MOUSE SPIN.
 * input.mouse.moveX = raw px of mouse movement accumulated since the last
 * frame (InputManager accumulates e.movementX; it is cleared every frame
 * in InputManager.endFrame). Each px turns the nose by MOUSE_SENSITIVITY
 * radians × the MOUSE spin-speed setting (SETTINGS.spinSpeedMouse, v3.14.0
 * settings panel) — sweep the mouse left/right and the ship spins exactly
 * that far (a full 360°+ is one big sweep).
 */
function spinWithMouse(p, input) {
  const dx = input.mouse.moveX;
  if (dx === 0) return;
  p.angle += dx * PLAYER.MOUSE_SENSITIVITY * SETTINGS.spinSpeedMouse;
}

export function updateFlight(p, dt, input) {
  // ─── ROTATION (delta mouse spin, A/D override) ───
  // v3.78.0: SETTINGS.controlMode decides what A/D do. 'spin' (classic):
  // keyboard rotation takes precedence over the mouse. 'strafe' (default):
  // A/D never rotate the nose — mouse spin is always active (the lateral
  // A/D thrust lives in the STRAFE section below). v3.14.0: keyboard spin
  // scales with SETTINGS.spinSpeedKeyboard, mouse spin with
  // SETTINGS.spinSpeedMouse — the two sensitivities are fully independent.
  const strafeMode = SETTINGS.controlMode === 'strafe';
  const keyTurn =
    (input.isDownAction('rotateRight') ? 1 : 0) -
    (input.isDownAction('rotateLeft') ? 1 : 0);
  const keySpinning = !strafeMode && keyTurn !== 0;
  if (keySpinning) {
    p.angle += keyTurn * PLAYER.ROTATION_SPEED * SETTINGS.spinSpeedKeyboard * dt;
  } else if (input.mouseIdleTime() < PLAYER.MOUSE_LOOK_TIMEOUT) {
    spinWithMouse(p, input);
  }
  // Mouse idle past the timeout (or simply not moving) → heading holds.
  // input.mouse.moveX is cleared in InputManager.endFrame() regardless,
  // so a burst of stale movement never leaks into the next steering frame.
  if (p.angle > Math.PI) p.angle -= TAU;
  if (p.angle < -Math.PI) p.angle += TAU;

  // ─── BOOST (v3.14.0: remappable 'boost' action — default Space / RMB) ───
  p.boostActive = input.isDownAction('boost');
  const boostMul = p.boostActive ? PLAYER.BOOST_MULT : 1;

  // ─── THRUST (v3.7.0: the thrust key ALONE moves the ship forward) ───
  // SPACE/RMB held → the ship ALWAYS accelerates forward (base thrust),
  // no W/S needed. Adding W on top of boost engages BOOST_MULT (faster).
  // Pressing S — even while still holding boost — wins: active brake,
  // then reverse along the facing heading. (v3.14.0: remappable actions.)
  const wantW = input.isDownAction('thrust');
  const wantS = input.isDownAction('brake');
  const wantFwd = wantW || (p.boostActive && !wantS);
  const wantRev = wantS;
  p.thrusterActive = wantFwd || wantRev;
  if (wantFwd && !wantRev) {
    const accelMul = (wantW && p.boostActive) ? PLAYER.BOOST_MULT : 1;
    const accel = PLAYER.THRUST * accelMul * dt;
    p.vx += Math.cos(p.angle) * accel;
    p.vy += Math.sin(p.angle) * accel;
  } else if (wantRev) {
    // S wins over W: split velocity into the component along the facing
    // (fwd) and the perpendicular drift (lat) — the brake/reverse only
    // touches the forward component.
    const cosA = Math.cos(p.angle);
    const sinA = Math.sin(p.angle);
    const fwdSpeed = p.vx * cosA + p.vy * sinA;
    const latX = p.vx - cosA * fwdSpeed;
    const latY = p.vy - sinA * fwdSpeed;
    let newFwd = fwdSpeed;
    if (fwdSpeed > 0) {
      // ACTIVE BRAKE: bleed off forward speed fast, clamped at 0 (the ship
      // halts cleanly instead of overshooting into reverse mid-brake).
      newFwd = Math.max(0, fwdSpeed - PLAYER.THRUST * PLAYER.BRAKE_MULT * boostMul * dt);
    } else {
      // REVERSE THRUST: from a stop (or while already moving backward),
      // accelerate backward along the facing heading — holding S takes the
      // ship forward → halt → backward in one continuous motion.
      newFwd -= PLAYER.THRUST * boostMul * dt;
    }
    p.vx = latX + cosA * newFwd;
    p.vy = latY + sinA * newFwd;
  }

  // ─── STRAFE (v3.78.0: 'strafe' control mode — A/D slide sideways) ───
  // Lateral unit vector = the nose direction rotated +90° (the ship's right
  // side), scaled by the A/D key state: D strafe-right, A strafe-left.
  // Runs independently of the forward/reverse thrust above (both together =
  // diagonal motion), and is damped by the same DRAG below.
  if (strafeMode && keyTurn !== 0) {
    const latX = Math.cos(p.angle + Math.PI / 2) * keyTurn;
    const latY = Math.sin(p.angle + Math.PI / 2) * keyTurn;
    const accel = PLAYER.THRUST * PLAYER.STRAFE_THRUST_MULT * dt;
    p.vx += latX * accel;
    p.vy += latY * accel;
  }

  // ─── DRAG ───
  const dragFactor = Math.exp(-PLAYER.DRAG * dt);
  p.vx *= dragFactor;
  p.vy *= dragFactor;

  // ─── SPEED CAP ───
  const spd = Math.hypot(p.vx, p.vy);
  if (spd > PLAYER.MAX_SPEED) {
    p.vx = (p.vx / spd) * PLAYER.MAX_SPEED;
    p.vy = (p.vy / spd) * PLAYER.MAX_SPEED;
  }

  // ─── POSITION INTEGRATION ───
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  // ─── SCREEN BOUNDS (v3.11.0 — SETTINGS.screenBounds admin toggle) ───
  if (SETTINGS.screenBounds) {
    // BOUNCE: reflect off the arena edges with a bit of damping.
    const r = p.radius;
    if (p.x < r) { p.x = r; if (p.vx < 0) p.vx = -p.vx * 0.6; }
    if (p.x > p.game.W - r) { p.x = p.game.W - r; if (p.vx > 0) p.vx = -p.vx * 0.6; }
    if (p.y < r) { p.y = r; if (p.vy < 0) p.vy = -p.vy * 0.6; }
    if (p.y > p.game.H - r) { p.y = p.game.H - r; if (p.vy > 0) p.vy = -p.vy * 0.6; }
  } else {
    // WRAP-AROUND (classic): re-enter on the opposite side.
    const margin = 30;
    if (p.x < -margin) p.x += p.game.W + margin * 2;
    if (p.x > p.game.W + margin) p.x -= p.game.W + margin * 2;
    if (p.y < -margin) p.y += p.game.H + margin * 2;
    if (p.y > p.game.H + margin) p.y -= p.game.H + margin * 2;
  }

  // ─── TAIL SWAY ───
  const lateralVel = Math.abs(Math.sin(p.angle) * p.vx - Math.cos(p.angle) * p.vy);
  const angleDelta = p.angle - p.prevAngle;
  const targetSway = Math.max(-0.6, Math.min(0.6, lateralVel * 0.003 + angleDelta * 2.0));
  p.tailSway += (targetSway - p.tailSway) * Math.min(1, dt * 8);
  p.prevAngle = p.angle;
}

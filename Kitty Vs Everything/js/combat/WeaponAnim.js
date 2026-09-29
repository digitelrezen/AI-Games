// Filename: WeaponAnim.js
// Kitty Vs Everything — v3.16.0
// Weapon animation state machine — the single owner of the per-weapon
// visual animation values that the paw-hardpoint + nose-muzzle art reads:
//   vulkanSpin  — gatling barrel spin (rad, wraps at TAU). Spins up while
//                 the paw hardpoint is firing, spins down when idle.
//   railCharge  — 0→1 charge progress across the rail cannon's chargeTime
//                 window (energy gathering at the muzzle hardpoint tip).
//   plasmaPulse — 0→1 emitter pulse for the plasma pulse cannon (idle
//                 breathing + full pulse while the hardpoint is firing).
// Pure logic: no canvas, no DOM. Player.js (main hull) and MiniShip.js
// (deployed minis) both tick this; docked minis tick with active=false,
// which decays everything to zero (inert while docked — v3.16.0).
export const VERSION = 'v3.16.0';
import { TAU, WEAPONS } from '../core/config.js';

const VULKAN_SPIN_UP = 50;    // rad/s while the hardpoint is firing
const VULKAN_SPIN_DECAY = 45; // rad/s spin-down when idle
const PLASMA_PULSE_HZ = 9;    // idle breathing frequency
const PLASMA_DECAY = 6;       // per-second decay when the weapon is switched away

/** Initialize the animation fields on a state object (player or mini). */
export function initWeaponAnimState(s) {
  s.vulkanSpin = 0;
  s.railCharge = 0;
  s.plasmaPulse = 0;
  return s;
}

/** True while any paw hardpoint flash is active (the weapon just fired). */
export function isHardpointFiring(s) {
  return (s.pawFlashL || 0) > 0 || (s.pawFlashR || 0) > 0 || (s.pawFlash || 0) > 0;
}

/**
 * Tick the weapon animation state.
 * @param {object} s      state object (player or mini) — must carry
 *                        weapon, fireTimer and the paw flash fields.
 * @param {number} dt     frame delta (s)
 * @param {object} [opts] { active: bool (false = inert/docked), time: clock (s) }
 */
export function updateWeaponAnim(s, dt, opts = {}) {
  const active = opts.active !== false;
  const time = opts.time || 0;

  if (!active) {
    // Inert (docked mini): no charge, no pulse, spin decays to rest.
    s.vulkanSpin = Math.max(0, s.vulkanSpin - VULKAN_SPIN_DECAY * dt) % TAU;
    s.railCharge = 0;
    s.plasmaPulse = Math.max(0, s.plasmaPulse - PLASMA_DECAY * dt);
    return;
  }

  const firing = isHardpointFiring(s);

  // ─── VULCAN / GATLING: spinning barrels on the paw hardpoints ───
  if (s.weapon === 'vulkan' && firing) {
    s.vulkanSpin = (s.vulkanSpin + VULKAN_SPIN_UP * dt) % TAU;
  } else {
    s.vulkanSpin = Math.max(0, s.vulkanSpin - VULKAN_SPIN_DECAY * dt) % TAU;
  }

  // ─── RAIL CANNON: charge 0→1 across the chargeTime window ───
  if (s.weapon === 'rail') {
    const w = WEAPONS.rail;
    s.railCharge = (s.fireTimer > 0 && s.fireTimer < w.chargeTime)
      ? 1 - s.fireTimer / w.chargeTime
      : 0;
  } else {
    s.railCharge = 0;
  }

  // ─── PLASMA PULSE: breathing idle pulse, full pulse while firing ───
  if (s.weapon === 'plasma') {
    const breath = 0.5 + 0.5 * Math.sin(time * PLASMA_PULSE_HZ * TAU);
    s.plasmaPulse = firing ? 1 : 0.35 + 0.65 * breath;
  } else {
    s.plasmaPulse = Math.max(0, s.plasmaPulse - PLASMA_DECAY * dt);
  }
}
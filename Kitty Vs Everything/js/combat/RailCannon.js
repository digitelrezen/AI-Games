// Filename: RailCannon.js
// Kitty Vs Everything — v4.11.0 (module v1.1.0)
// v1.1.0: AUDIO SUITE POLISH — fire() now plays the dedicated
//   audio.railShot() voice (deep sub-bass transient + electric
//   high-frequency snap + rail discharge sweep) instead of the generic
//   audio.tone(200→800) sawtooth — immense power for the piercing beam.
// MODULAR WEAPON ARCHITECTURE (Phase 2) — the RAIL CANNON extracted from
// PlayerWeapons.firePrimary (piercing beam) + updateWeaponState (charge-up
// visual).
//
// Behavior (unchanged from the inline implementation):
//   - Piercing beam: single 1500 px/s bolt from the center muzzle (snout
//     tip), 100 dmg, pierce 999 (hits everything in its line), 1.0 s life,
//     radius 8, 1.0 s cadence.
//   - Impact FX: 12-particle muzzle burst (#d1c4e9), screen shake >= 5,
//     muzzleFlash 0.18 s, sawtooth 200->800 Hz tone.
//   - Charge mechanic: a 0.5 s charge-up (WEAPONS.rail.chargeTime) visible
//     as muzzle particles while the shared cooldown (owner.fireTimer) sits
//     inside (0, chargeTime) — the last 0.5 s of the 1.0 s cooldown.
//     WeaponAnim.js reads the same canonical fields for the railCharge UI.
//
// State ownership: no per-weapon state of its own — the charge is derived
// from the shared owner.fireTimer (BaseWeapon.cooldown proxy). reset()
// still clears the owner's thermal/lockout so switching away from an
// overheated Vulcan never carries its lockout into this weapon (v3.67.0
// cycleWeapon invariant, preserved).
export const VERSION = 'v1.1.0';
import Bullet from './Bullet.js';
import { audio } from '../core/AudioSystem.js';
import { getMuzzlePosition } from '../player/PlayerHardpoints.js';
import BaseWeapon from './BaseWeapon.js';

export default class RailCannon extends BaseWeapon {
  constructor(owner) {
    super(owner, 'rail');
  }

  /**
   * Per-frame state tick: charge-up visual while the shared cooldown is
   * inside the charge window (cooldown in (0, chargeTime)).
   */
  update(dt) {
    const w = this.config;
    // Charge visual: the last chargeTime seconds of the cooldown window
    if (this.cooldown > 0 && this.cooldown < w.chargeTime) {
      const muzzle = getMuzzlePosition(this.owner);
      const chargeProgress = 1 - (this.cooldown / w.chargeTime);
      if (Math.random() < 0.6) {
        this.game.particles.burst(muzzle.x, muzzle.y, {
          count: 2,
          color: chargeProgress > 0.7 ? '#ffffff' : '#b388ff',
          speed: 50, life: 0.2, size: 2,
        });
      }
    }
  }

  /**
   * Fire one piercing beam from the center muzzle.
   * opts: { dmgMul — mini-ship damage bonus, homing — aim-assist tracking }
   * Returns true (the fireNow gate already ran canFire() before this).
   */
  fire(aim, { dmgMul = 1, homing = false } = {}) {
    const w = this.config;
    // Piercing beam from center muzzle
    const muzzle = getMuzzlePosition(this.owner);
    const b = new Bullet({
      x: muzzle.x, y: muzzle.y,
      vx: Math.cos(aim) * w.speed, vy: Math.sin(aim) * w.speed,
      damage: w.damage * dmgMul,
      color: w.color, weapon: 'rail',
      friendly: true, life: 1.0, radius: 8,
      pierce: w.pierce, owner: this.owner,
    });
    if (homing) b.homing = true;
    this.game.bullets.push(b);
    this.game.particles.burst(muzzle.x, muzzle.y, { count: 12, color: '#d1c4e9', speed: 200, life: 0.3, size: 3 });
    this.game.shake = Math.max(this.game.shake, 5);
    this.owner.muzzleFlash = 0.18;
    audio.railShot(); // v4.11.0: dedicated rail cannon sub-bass + electric snap
    return true;
  }

  /** Barrel art stays in PlayerShipFx.drawWeaponPaw — no-op hook. */
  draw(ctx) { /* inherited no-op */ }

  /**
   * No weapon-specific state, but clear the shared thermal/lockout so a
   * switch away from an overheated Vulcan never carries its lockout into
   * this weapon (v3.67.0 cycleWeapon invariant, preserved).
   */
  reset() {
    this.owner.thermal = 0;
    this.owner.thermalLockout = 0;
    super.reset();
  }
}

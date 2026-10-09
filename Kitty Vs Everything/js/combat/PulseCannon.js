// Filename: PulseCannon.js
// Kitty Vs Everything — v4.11.0 (module v1.1.0)
// v1.1.0: AUDIO SUITE POLISH — fire() now plays the dedicated
//   audio.pulseShot() voice (rich downward pitch sweep + warm resonant
//   filter pop) instead of the generic audio.shoot() beep — a satisfying
//   sci-fi energy punch for the twin-pod burst.
// MODULAR WEAPON ARCHITECTURE (Phase 2) — the PLASMA PULSE (pulse cannon)
// extracted from PlayerWeapons.firePrimary (v3.46.0 TWIN-POD BURST).
//
// Behavior (unchanged from the inline implementation):
//   - Twin-pod burst: a 3-bolt fan (aim ± 0.14 rad) from BOTH front-paw
//     emitter tips (getMuzzleTipOffsets — v3.46.0 per-weapon barrelLen 10
//     places the tips at the pod mouths): 6 bolts per shot, 0.24 s cadence.
//   - Bolts: 560 px/s, 22 dmg, 2.0 s life, radius 6, shieldMelt 15
//     (WEAPONS.plasma.shieldMelt — melts enemy shields on hit).
//   - Muzzle flash: both paw flashes 0.12 s.
//   - No thermal state: plasma never overheats (no lockout, no decay).
//
// State ownership: no per-weapon state of its own — the cooldown is the
// shared owner.fireTimer (BaseWeapon.cooldown proxy). reset() still clears
// the owner's thermal/lockout so switching away from an overheated Vulcan
// never carries its lockout into this weapon (v3.67.0 cycleWeapon
// invariant, preserved).
export const VERSION = 'v1.1.0';
import Bullet from './Bullet.js';
import { audio } from '../core/AudioSystem.js';
import { getMuzzleTipOffsets } from '../player/PlayerHardpoints.js';
import BaseWeapon from './BaseWeapon.js';

export default class PulseCannon extends BaseWeapon {
  constructor(owner) {
    super(owner, 'plasma');
  }

  /**
   * Fire one twin-pod burst: a 3-bolt fan from each front-paw emitter tip.
   * opts: { dmgMul — mini-ship damage bonus, homing — aim-assist tracking }
   * Returns true (the fireNow gate already ran canFire() before this).
   */
  fire(aim, { dmgMul = 1, homing = false } = {}) {
    const w = this.config;
    // v3.46.0: TWIN-POD BURST — fire a 3-bolt fan from BOTH front-paw
    // emitter tips (no alternation; both pods fire together).
    const tips = getMuzzleTipOffsets(this.owner);
    for (const paw of tips) {
      for (let i = -1; i <= 1; i++) {
        const spread = aim + i * 0.14;
        const b = new Bullet({
          x: paw.x, y: paw.y,
          vx: Math.cos(spread) * w.speed, vy: Math.sin(spread) * w.speed,
          damage: w.damage * dmgMul,
          color: w.color, weapon: 'plasma',
          friendly: true, life: 2.0, radius: 6,
          shieldMelt: w.shieldMelt, owner: this.owner,
        });
        if (homing) b.homing = true;
        this.game.bullets.push(b);
      }
    }
    this.owner.pawFlashL = 0.12;
    this.owner.pawFlashR = 0.12;
    audio.pulseShot(); // v4.11.0: dedicated pulse cannon sweep + resonant pop
    return true;
  }

  /** No per-frame state (no thermal) — inherited no-op tick. */
  update(dt) { /* inherited no-op */ }

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

// Filename: VulcanCannon.js
// Kitty Vs Everything — v4.11.0 (module v1.1.0)
// v1.1.0: AUDIO SUITE POLISH — fire() now plays the dedicated
//   audio.vulkanShot() voice (fast ballistic snap with per-shot pitch
//   variation) instead of the generic audio.shoot() beep, and the OVERHEAT
//   lockout plays audio.overheat() (steam hiss) — zero silent triggers.
// MODULAR WEAPON ARCHITECTURE (Phase 1) — the VULCAN CANNON extracted from
// PlayerWeapons.firePrimary / updateWeaponState (v3.14.0 fire-control
// dashboard → v3.17.0 twin-tip Gatling → v3.33.0 FRENZY heat immunity).
//
// Behavior (unchanged from the inline implementation):
//   - Gatling: fires from BOTH front-paw barrel TIPS (getMuzzleTipOffsets —
//     v3.17.0 oversized guns), 2 bullets per shot, 0.07 s cadence.
//   - Heat: +0.05 per shot (0.35/s decay while idle) → at 1.0 OVERHEAT:
//     1.2 s lockout + "OVERHEAT!" floater + msglog entry.
//   - FRENZY (owner.frenzyTime > 0): no heat buildup, no overheat.
//   - Lockout: ticking smoke from the muzzle (PlayerWeapons used to emit it).
//
// State ownership: thermal / lockout live on the owner (Player.thermal /
// Player.thermalLockout) so HUDFireControl.js, FRENZY and respawn keep
// reading the canonical player fields; this class only drives them.
export const VERSION = 'v1.1.0';
import Bullet from './Bullet.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';
import { getMuzzlePosition, getMuzzleTipOffsets } from '../player/PlayerHardpoints.js';
import BaseWeapon from './BaseWeapon.js';

export default class VulcanCannon extends BaseWeapon {
  constructor(owner) {
    super(owner, 'vulkan');
  }

  // Thermal state lives on the owner (Player.thermal) — canonical field.
  get thermal() { return this.owner.thermal || 0; }
  set thermal(v) { this.owner.thermal = v; }

  /** Per-frame state tick: thermal decay + overheat lockout tick + smoke. */
  update(dt) {
    const w = this.config;
    // Thermal decay
    if (this.thermal > 0) {
      this.thermal = Math.max(0, this.thermal - w.thermalDecay * dt);
    }
    // Thermal lockout tick
    if (this.lockout > 0) {
      this.lockout = Math.max(0, this.lockout - dt);
      // Emit smoke during lockout
      if (Math.random() < 0.3) {
        const muzzle = getMuzzlePosition(this.owner);
        this.game.particles.burst(muzzle.x, muzzle.y, { count: 2, color: '#4a4a4a', speed: 30, life: 0.6, size: 3 });
      }
    }
  }

  /**
   * Fire one Gatling volley: one bullet from each front-paw barrel tip.
   * opts: { dmgMul — mini-ship damage bonus, homing — aim-assist tracking }
   * Returns true (the fireNow gate already ran canFire() before this).
   */
  fire(aim, { dmgMul = 1, homing = false } = {}) {
    const w = this.config;
    // Gatling: fire from both front-paw barrel TIPS (v3.17.0 oversized guns)
    const tips = getMuzzleTipOffsets(this.owner);
    for (const paw of tips) {
      const b = new Bullet({
        x: paw.x, y: paw.y,
        vx: Math.cos(aim) * w.speed,
        vy: Math.sin(aim) * w.speed,
        damage: w.damage * dmgMul,
        color: w.color,
        weapon: 'vulkan',
        friendly: true,
        life: 1.5,
        radius: 3,
        tracking: w.tracking,
        owner: this.owner,
      });
      if (homing) b.homing = true;
      this.game.bullets.push(b);
    }
    this.owner.pawFlashL = 0.07; // v3.17.0: muzzle flash at the tips
    this.owner.pawFlashR = 0.07;
    // v3.33.0: FRENZY — no heat buildup and no overheat while active
    if (this.owner.frenzyTime > 0) {
      this.thermal = 0;
    } else {
      this.thermal = Math.min(w.thermalMax, this.thermal + w.thermalPerShot);
      if (this.thermal >= w.thermalMax) {
        this.lockout = w.thermalLockout;
        this.thermal = 0;
        bus.emit('dmg', { x: this.owner.x, y: this.owner.y - 30, text: 'OVERHEAT!', color: '#ff5722' });
        audio.overheat(); // v4.11.0: overheat lockout hiss (zero silent triggers)
        if (this.game.msglog) {
          this.game.msglog.log('VULKAN OVERHEAT — LOCKOUT ' + w.thermalLockout + 's', 'bad', this.game.time);
        }
      }
    }
    audio.vulkanShot(); // v4.11.0: dedicated Vulcan ballistic snap (per-shot pitch variation)
    return true;
  }

  /** Barrel art stays in PlayerShipFx.drawWeaponPaw — no-op hook. */
  draw(ctx) { /* inherited no-op */ }

  /** Clear thermal + lockout (weapon switch / respawn). */
  reset() {
    this.thermal = 0;
    this.lockout = 0;
    super.reset();
  }
}

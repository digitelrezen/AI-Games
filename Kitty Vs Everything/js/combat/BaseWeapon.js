// Filename: BaseWeapon.js
// Kitty Vs Everything — v3.68.0 (module v1.0.0)
// MODULAR WEAPON ARCHITECTURE (Phase 1) — abstract base class for player
// weapons. A weapon owns its FIRING LOGIC (volley shape, heat/lockout,
// per-frame state tick, reset); its STATE stays on the owner (Player) so
// HUDFireControl, FRENZY, respawn and net sync keep reading the canonical
// player fields (fireTimer / thermal / thermalLockout).
//
// Contract implemented by subclasses (e.g. VulcanCannon.js):
//   - fire(aim, { dmgMul, homing }) → boolean  one volley toward `aim` (rad)
//   - update(dt)                    per-frame state tick (thermal decay,
//                                   lockout timers, smoke, charge-up...)
//   - draw(ctx)                     render hook — barrel/muzzle art stays in
//                                   the ship art (PlayerShipFx.drawWeaponPaw)
//   - reset()                       clear per-weapon state (weapon switch,
//                                   respawn)
//
// Shared properties:
//   - cooldown  (get/set → owner.fireTimer)  shared fire-rate timer
//   - lockout   (get/set → owner.thermalLockout) overheat lockout timer
//   - ammo      (Infinity = unlimited)
//   - damage    base damage snapshot from WEAPONS[key].damage
//   - active    weapon available (false = cannot fire)
//   - canFire()  active && cooldown <= 0 && lockout <= 0 && ammo > 0
//
// Note: cooldown decay is owned by PlayerWeapons.tryFire (shared across
// weapons); a weapon's update(dt) handles its OWN per-frame state only.
export const VERSION = 'v1.0.0';
import { WEAPONS } from '../core/config.js';

export default class BaseWeapon {
  constructor(owner, key) {
    this.owner = owner;
    this.key = key;
    this.config = WEAPONS[key];
    this.active = true;
    this.ammo = Infinity;
    this.damage = this.config.damage;
    this.reset();
  }

  get game() {
    return this.owner.game;
  }

  // ─── Shared state lives on the owner (Player) — canonical fields ───
  get cooldown() { return this.owner.fireTimer; }
  set cooldown(v) { this.owner.fireTimer = v; }
  get lockout() { return this.owner.thermalLockout || 0; }
  set lockout(v) { this.owner.thermalLockout = v; }

  canFire() {
    return this.active && this.cooldown <= 0 && this.lockout <= 0 && this.ammo > 0;
  }

  /** Per-frame weapon state tick (dt in seconds). */
  update(dt) { /* subclasses tick their own state here */ }

  /**
   * Fire one volley toward `aim` (radians).
   * opts: { dmgMul — mini-ship damage bonus multiplier, homing — aim-assist
   *         tracking flag }
   * Returns true if a volley was fired.
   */
  fire(aim, opts = {}) {
    throw new Error(`BaseWeapon.fire() is abstract — implement in ${this.key}`);
  }

  /** Render hook. Barrel/muzzle art is drawn by the ship art (PlayerShipFx). */
  draw(ctx) { /* subclasses override only if the weapon has its own art */ }

  /** Clear per-weapon state (weapon switch / respawn). */
  reset() {
    this.active = true;
  }
}

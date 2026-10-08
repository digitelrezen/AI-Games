// Filename: MiniShip.js
// Kitty Vs Everything — v3.71.0
// Docked mini-ship: a shrunken clone of the player's cat ship with an
// independent HP pool. Spawns ONLY via CatShipFactory.createMiniShip —
// the strict same-color rule (minis always clone the player's current
// theme) is enforced there, and the dock slot comes from
// SHIP_GEOMETRY.miniDockL / miniDockR via PlayerHardpoints.getDockPosition.
//
// v3.3.0 lifecycle:
//   • Own hp / maxHp — minis can die independently of the main hull.
//   • applyDamage() sets the white hit-flash; death is picked up by
//     PlayerFleet.updateFleet (own explosion + banner + cleanup).
//   • Enemy fire / rams hit docked minis first (Collisions.js), and
//     hull-level damage is intercepted by minis too (Player.hit).
//   • The whole fleet is cleared when the main hull is lost
//     (PlayerFleet.clearFleet, called from Player.hit).
// v3.9.0: DOCKED MINIS NOW FIRE — each frame the mini auto-fires the
//         player's ACTIVE weapon profile (vulkan / plasma / rail) from its
//         own dock slot along the player's heading, dealing
//         MINI_SHIP.damageMul × the weapon's base damage (the +50%/mini
//         main-ship bonus stays on the hull). Paw / muzzle flashes are
//         surfaced to PlayerMiniArt for the shared drawCatShip art.
// v3.10.0: FULL CLONE GUNS — the mini now fires the weapon's COMPLETE
//         volley on the hull's fire cadence (fireRateMult = 1): vulkan
//         twin-paw burst, plasma alternating-paw bolt, rail muzzle beam —
//         each from THIS mini's own 0.6×-scaled paws / muzzle. 1 docked
//         mini doubles the fleet's projectiles, 2 minis triple them.
// v3.14.0: Mini volleys also get spread-zero + homing while the robot
//         aimbot OR the dev test aimbot is active (PlayerWeapons gate).
// v3.16.0: FIRE-CONTROL FIX — docked minis are COMPLETELY INERT: they do
//         NOT fire and show no weapon animation (no spin/charge/pulse).
//         The fleet must be DEPLOYED (MiniDeploy.js, 'deployFleet' action,
//         default B/N) to undock into a combat orbit where the minis fire
//         the player's active weapon + tick their weapon animation
//         (WeaponAnim.js). Docked minis remain passive interceptors.
// v3.17.0: DOCKED MINIS FIRE IN SYNC WITH THE HULL — the v3.16.0 "inert"
//         behavior was a regression (docked minis stopped shooting). Now a
//         docked mini mirrors the hull's fireTimer (so rail charge-up lines
//         up) and fires the full clone volley the SAME frame the hull fires
//         (Player.firedThisFrame, set by PlayerWeapons.fireNow). Weapon
//         animation stays active so spin/charge/pulse match the hull. The
//         fleet can still be DEPLOYED (MiniDeploy.js) into a combat orbit
//         where minis fire on their own cadence.
// v3.46.0: PER-WEAPON BARREL LENGTH + PLASMA TWIN-POD BURST — the mini's
//         barrel-tip spawn point now uses the per-weapon barrelLen
//         (WEAPONS[weapon].barrelLen: vulkan 15 / plasma 10 / rail 22,
//         fallback SHIP_GEOMETRY.barrelLen) instead of the global value, and
//         the plasma volley now fires a 3-bolt fan from BOTH front paws (no
//         alternation), matching the hull's PlayerWeapons.firePrimary.
// v3.71.0: MODULAR COMBAT (Phase 4) — moved from js/core/ into js/combat/
//           alongside the rest of the combat modules; behavior unchanged.
// v3.73.0: SPRITE CLONE SCALE — MINI_SCALE is now imported from config.js
//           (0.6 × MAIN_SHIP_SCALE = 1.2 in the 70px local frame → 84px
//           world-tall sprite clone), replacing the local 0.6 constant. The
//           _miniPoint hardpoint math is unchanged — it now tracks the
//           bigger drawn mini so bullets still spawn on the drawn paws.
export const VERSION = 'v3.73.0';
import Entity from '../core/Entity.js';
import Bullet from './Bullet.js';
import { MINI_SHIP, PLAYER_THEMES, SHIP_GEOMETRY, WEAPONS, MINI_SCALE } from '../core/config.js';
import { rand } from '../core/utils.js';
import { getDockPosition } from '../player/PlayerHardpoints.js';
import { initWeaponAnimState, updateWeaponAnim } from './WeaponAnim.js';

export default class MiniShip extends Entity {
  /**
   * @param {Player} player — the cat ship this mini is docked to (theme source)
   * @param {number} side   — -1 = left flank, +1 = right flank
   */
  constructor(player, side) {
    const th = PLAYER_THEMES[player.theme] || PLAYER_THEMES.white_yellow;
    const dock = getDockPosition(player, side);
    super({
      x: dock.x, y: dock.y,
      radius: MINI_SHIP.radius,
      hp: MINI_SHIP.hp,
      color: th.color,
    });
    this.game = player.game;
    this.side = side;
    // ─── STRICT SAME-COLOR RULE: clone the player's current theme ───
    this.theme = player.theme;
    this.color = th.color;
    this.pattern = th.pattern;
    // ─── v3.16.0: the mini fires the player's ACTIVE weapon (kept in sync
    // in update) so its weapon animation matches the hull (WeaponAnim.js) ───
    this.weapon = player.weapon;
    // ─── INDEPENDENT HP / HIT-FLASH STATE ───
    this.maxHp = MINI_SHIP.hp;
    this.hitFlash = 0;
    // ─── AUTO-FIRE STATE (v3.9.0: minis fire the player's active weapon) ───
    // Random start offset so a twin fleet doesn't fire in lockstep.
    this.fireTimer = Math.random() * WEAPONS[player.weapon].rate * MINI_SHIP.fireRateMult;
    // Plasma bolt side: mini alternates its OWN paws; random start phase so
    // two docked minis don't flash the same paw in unison.
    this.plasmaAlt = Math.random() < 0.5 ? 0 : 1;
    this.pawFlash = 0;     // vulkan / plasma front-paw flashes (PlayerMiniArt)
    this.muzzleFlash = 0;  // rail nose flash (PlayerMiniArt)
    // ─── v3.16.0: DEPLOY ORBIT + WEAPON ANIMATION STATE ───
    this.orbitAngle = 0;   // combat-orbit phase (MiniDeploy.updateFleetDeploy)
    initWeaponAnimState(this); // vulkanSpin / railCharge / plasmaPulse
  }

  /**
   * Per-frame (v3.17.0 fire-control fix, v3.96.0 orbit mode):
   *   ORBITING (T toggle) — flat circle around the hull; the mini's facing
   *   is ALWAYS the player's heading (drawMiniPod rotates by player.angle),
   *   no matter where it is in the orbit. Fires IN SYNC with the hull.
   *   DOCKED (default) — snap to the player's dock slot and fire IN SYNC
   *   with the hull: mirror the hull's fireTimer (rail charge-up lines up)
   *   and fire the full clone volley the same frame the hull fires
   *   (player.firedThisFrame). Weapon animation stays active so the mini's
   *   spin/charge/pulse match the hull.
   *   DEPLOYED — the position is set by MiniDeploy.updateFleetDeploy (combat
   *   orbit, called before this); the mini fires the player's active weapon
   *   on its own cadence and ticks its weapon animation (WeaponAnim.js).
   */
  update(dt, player, input) {
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.pawFlash > 0) this.pawFlash = Math.max(0, this.pawFlash - dt);
    if (this.muzzleFlash > 0) this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
    if (player.fleetOrbiting) {
      // ─── v3.96.0: ORBITING (T toggle) — flat circle around the hull.
      // POSITION ONLY: the facing is ALWAYS the player's heading
      // (drawMiniPod rotates by player.angle), no matter where the mini is
      // in the orbit. Fires IN SYNC with the hull exactly like docked. ───
      this.orbitAngle += MINI_SHIP.orbitSpeed * dt;
      const a = player.angle + this.side * (Math.PI / 2) + this.orbitAngle;
      this.x = player.x + Math.cos(a) * MINI_SHIP.orbitRadius;
      this.y = player.y + Math.sin(a) * MINI_SHIP.orbitRadius;
      this.weapon = player.weapon;
      this.fireTimer = player.fireTimer; // mirror the hull's cooldown/charge
      if (player.firedThisFrame) this.fireWeapon(player);
      updateWeaponAnim(this, dt, { active: true, time: this.game.time });
    } else if (player.fleetDeployed) {
      // ─── DEPLOYED: combat orbit — fire the player's active weapon ───
      this.weapon = player.weapon; // v3.16.0: track the hull's active weapon
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = WEAPONS[player.weapon].rate * MINI_SHIP.fireRateMult;
        this.fireWeapon(player);
      }
      updateWeaponAnim(this, dt, { active: true, time: this.game.time });
    } else {
      // ─── v3.17.0: DOCKED — snap to the dock slot and fire IN SYNC with
      // the hull. Mirror the hull's fireTimer (so rail charge-up lines up)
      // and fire the full clone volley the SAME frame the hull fires. ───
      const dock = getDockPosition(player, this.side);
      this.x = dock.x;
      this.y = dock.y;
      this.weapon = player.weapon;
      this.fireTimer = player.fireTimer; // mirror the hull's cooldown/charge
      if (player.firedThisFrame) this.fireWeapon(player);
      updateWeaponAnim(this, dt, { active: true, time: this.game.time });
    }
  }

  /**
   * World position of a SHIP_GEOMETRY hardpoint on THIS mini — the hull
   * geometry scaled to the mini's drawn size, rotated exactly like
   * PlayerHardpoints.localToWorld (rotate(angle + PI/2), nose = local -Y)
   * but centered on the mini's dock position.
   */
  _miniPoint(g, player) {
    const x = g.x * MINI_SCALE, y = g.y * MINI_SCALE;
    const sinA = Math.sin(player.angle), cosA = Math.cos(player.angle);
    return { x: this.x - x * sinA - y * cosA, y: this.y + x * cosA - y * sinA };
  }

  /**
   * Fire the player's ACTIVE weapon as a FULL CLONE volley (v3.10.0) from
   * this mini's own 0.6×-scaled hardpoints: vulkan = twin-barrel-tip burst,
   * plasma = 3-bolt fan from BOTH front paws (v3.46.0), rail = one beam from
   * the mini's muzzle. v3.17.0: vulkan/plasma spawn at the barrel tips (paw
   * extended forward by the barrel length, scaled by MINI_SCALE) so the
   * mini's shots match its drawn guns. v3.46.0: the barrel length is now
   * PER-WEAPON (WEAPONS[weapon].barrelLen: vulkan 15 / plasma 10 / rail 22,
   * fallback SHIP_GEOMETRY.barrelLen) so each weapon's tip aligns with its
   * drawn paw art. Mini bullets are friendly and deal damageMul × weapon
   * damage (the +50%/mini hull bonus is NOT re-applied); they get homing when
   * the aim-bot is active, exactly like the main hull's shots.
   */
  fireWeapon(player) {
    const w = WEAPONS[player.weapon];
    // v3.14.0: robot aimbot OR dev test aimbot → zero spread + homing.
    const assist = player.game.aimbot.active || (player.game.testAimbot && player.game.testAimbot.active);
    const spread = assist ? 0 : rand(-0.04, 0.04);
    const aim = player.angle + spread;
    // v3.46.0: barrel-tip geometry point (paw extended forward by the
    // PER-WEAPON barrelLen — WEAPONS[weapon].barrelLen: vulkan 15 / plasma 10 /
    // rail 22 — fallback to the global SHIP_GEOMETRY.barrelLen).
    const tip = (g) => ({ x: g.x, y: g.y - (w.barrelLen || SHIP_GEOMETRY.barrelLen) });
    const mk = (pt) => {
      const b = new Bullet({
        x: pt.x, y: pt.y,
        vx: Math.cos(aim) * w.speed, vy: Math.sin(aim) * w.speed,
        damage: w.damage * MINI_SHIP.damageMul,
        color: w.color, weapon: player.weapon,
        friendly: true, owner: player,
      });
      b.homing = assist;
      return b;
    };
    switch (player.weapon) {
      case 'vulkan': {
        // Gatling: twin-barrel-tip burst, exactly like the hull.
        const tips = [tip(SHIP_GEOMETRY.frontPawL), tip(SHIP_GEOMETRY.frontPawR)];
        for (const g of tips) {
          const b = mk(this._miniPoint(g, player));
          b.life = 1.5; b.radius = 2; b.tracking = w.tracking;
          player.game.bullets.push(b);
        }
        this.pawFlash = 0.07;
        break;
      }
      case 'plasma': {
        // v3.46.0: TWIN-POD BURST — fire a 3-bolt fan from BOTH front-paw
        // emitter tips (no alternation; both pods fire together), matching
        // the hull's PlayerWeapons.firePrimary plasma volley.
        const paws = [SHIP_GEOMETRY.frontPawL, SHIP_GEOMETRY.frontPawR];
        for (const g of paws) {
          for (let i = -1; i <= 1; i++) {
            const b = mk(this._miniPoint(tip(g), player));
            // Fan: offset each bolt's heading around the aim direction.
            b.vx = Math.cos(aim + i * 0.14) * w.speed;
            b.vy = Math.sin(aim + i * 0.14) * w.speed;
            b.life = 2.0; b.radius = 4; b.shieldMelt = w.shieldMelt;
            player.game.bullets.push(b);
          }
        }
        this.pawFlash = 0.12;
        break;
      }
      case 'rail':
      default: {
        // Piercing beam from the mini's nose muzzle.
        const b = mk(this._miniPoint(SHIP_GEOMETRY.muzzle, player));
        b.life = 1.0; b.radius = 5; b.pierce = w.pierce;
        player.game.bullets.push(b);
        this.muzzleFlash = 0.18;
        break;
      }
    }
  }

  /**
   * Mini damage (no shield — minis are cheap interceptors). Sets the white
   * hit-flash; the death itself is handled by PlayerFleet.updateFleet.
   */
  applyDamage(amount) {
    if (!this.alive || amount <= 0) return;
    this.hp -= amount;
    this.hitFlash = 0.15;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
  }
}

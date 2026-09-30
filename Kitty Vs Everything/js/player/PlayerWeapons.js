// Filename: PlayerWeapons.js
// Kitty Vs Everything — v3.46.0
// 3-weapon primary fire system (Vulkan / Plasma / Rail), thermal management,
// Q/H stun rockets, E/J napalm rockets, R/G weapon cycling. Pure logic —
// mutates Player weapon state and pushes bullets via player.game.
// v3.3.0: Extracted from Player.js (module split of oversized files).
// v3.7.0: L is now primary fire (E is NO LONGER fire — E/J = NAPALM
//         ROCKETS: same twin-paw launch as stun, but a high-damage napalm
//         blast over the same 200px radius). H/G are the lefty mirrors
//         of Q/R.
// v3.14.0: Remappable action layer (fire/stun/napalm/cycleWeapon via
//          InputManager.isDownAction/wasPressedAction + Keybinds.js) and
//          fireNow() split out so TestAimbot can auto-fire at the same
//          cadence; bullets also gain homing while the test aimbot is
//          active (same gate as the robot aimbot).
// v3.33.0: FRENZY (Player.frenzyTime > 0) — the fire cooldown (fireTimer)
//          and ALL thermal state (thermal / thermalLockout) are held at
//          zero every frame: every weapon fires at max rate, the Vulcan
//          never builds heat and can never overheat (updateWeaponState +
//          firePrimary).
// v3.46.0: PLASMA TWIN-POD BURST — firePrimary's plasma case now fires a
//          3-bolt fan from BOTH front-paw emitter tips on every shot (no
//          alternation; both pods fire together). Per-weapon barrelLen
//          (WEAPONS.plasma.barrelLen = 10) places the tips at the pod
//          mouths (PlayerHardpoints.getMuzzleTipOffsets).
export const VERSION = 'v3.46.0';
import Bullet from '../combat/Bullet.js';
import { PLAYER, WEAPONS, WEAPON_ORDER, MINI_SHIP } from '../core/config.js';
import { TAU, rand, dist2 } from '../core/utils.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';
import { onEnemyDeath } from '../combat/Combat.js';
import { launchRockets } from '../combat/Rockets.js'; // v3.11.0: real flying rockets
import { getUpperPawOffsets, getMuzzlePosition, getMuzzleTipOffsets } from './PlayerHardpoints.js';

/** Thermal decay, overheat lockout smoke, rail charge-up visual.
 *  v3.33.0: while FRENZY is active (p.frenzyTime > 0) the fire cooldown and
 *  ALL thermal state are held at zero every frame — cooldowns removed,
 *  Vulcan overheat neutralized. */
export function updateWeaponState(p, dt) {
  const w = WEAPONS[p.weapon];

  if (p.frenzyTime > 0) {
    // ─── v3.33.0: FRENZY — hold fire cooldown + thermal/lockout at zero ───
    p.fireTimer = 0;
    p.thermal = 0;
    p.thermalLockout = 0;
  } else {
    // Thermal decay (Vulkan)
    if (p.weapon === 'vulkan' && p.thermal > 0) {
      p.thermal = Math.max(0, p.thermal - w.thermalDecay * dt);
    }
    // Thermal lockout tick
    if (p.thermalLockout > 0) {
      p.thermalLockout = Math.max(0, p.thermalLockout - dt);
      // Emit smoke during lockout
      if (Math.random() < 0.3) {
        const muzzle = getMuzzlePosition(p);
        p.game.particles.burst(muzzle.x, muzzle.y, { count: 2, color: '#4a4a4a', speed: 30, life: 0.6, size: 3 });
      }
    }
  }

  // Rail Cannon charge visual
  if (p.weapon === 'rail' && p.fireTimer > 0 && p.fireTimer < w.chargeTime) {
    const muzzle = getMuzzlePosition(p);
    const chargeProgress = 1 - (p.fireTimer / w.chargeTime);
    if (Math.random() < 0.6) {
      p.game.particles.burst(muzzle.x, muzzle.y, {
        count: 2,
        color: chargeProgress > 0.7 ? '#ffffff' : '#b388ff',
        speed: 50, life: 0.2, size: 2,
      });
    }
  }
}

/** L / LMB: primary fire with rate-of-fire + overheat lockout gating.
 *  v3.7.0: E is no longer primary fire (E/J = napalm rockets).
 *  v3.14.0: reads the remappable 'fire' action (Keybinds.js). The
 *  cooldown/lockout gating lives in fireNow() so the dev test-aimbot
 *  (TestAimbot.js) can auto-fire at the exact same cadence. */
export function tryFire(p, dt, input) {
  p.fireTimer -= dt;
  if (input.isDownAction('fire')) fireNow(p);
}

/** Fire if the cooldown + overheat gates allow. Returns true if fired.
 *  v3.14.0: shared by tryFire (manual) and TestAimbot (auto). */
export function fireNow(p) {
  const w = WEAPONS[p.weapon];
  if (p.thermalLockout > 0 || p.fireTimer > 0) return false;
  p.fireTimer = w.rate;
  p.firedThisFrame = true; // v3.17.0: docked minis fire in sync with the hull
  firePrimary(p);
  return true;
}

/** Q/H stun rockets · E/J napalm rockets · R/G cycle weapon.
 *  (F/C ultimate stays on Player — variants override it.)
 *  v3.14.0: all read the remappable action layer. */
export function handleActionKeys(p, input) {
  // ─── STUN ROCKETS action (default Q / H) ───
  if (input.wasPressedAction('stun') && p.stunCooldown <= 0) {
    fireStunRockets(p);
    p.stunCooldown = PLAYER.STUN_COOLDOWN;
  }
  // ─── NAPALM ROCKETS action (default E / J) ───
  if (input.wasPressedAction('napalm') && p.napalmCooldown <= 0) {
    fireNapalmRockets(p);
    p.napalmCooldown = PLAYER.NAPALM_COOLDOWN;
  }
  // ─── CYCLE WEAPON action (default R / G) ───
  if (input.wasPressedAction('cycleWeapon')) cycleWeapon(p, 1);
}

// ═══════════════════════════════════════════════════════════
//  PRIMARY FIRE — weapon-specific, from front-paw hardpoints
// ═══════════════════════════════════════════════════════════
/** v3.14.0: aim-assist gate — the robot aimbot OR the dev test aimbot.
 *  Used for spread-zero + bullet homing. */
function aimAssist(p) {
  return p.game.aimbot.active || (p.game.testAimbot && p.game.testAimbot.active);
}

export function firePrimary(p) {
  const w = WEAPONS[p.weapon];
  const spread = aimAssist(p) ? 0 : rand(-0.04, 0.04);
  const aim = p.angle + spread;
  const dmgMul = 1 + p.minis.length * MINI_SHIP.damageBonusPerMini;

  switch (p.weapon) {
    case 'vulkan': {
      // Gatling: fire from both front-paw barrel TIPS (v3.17.0 oversized guns)
      const tips = getMuzzleTipOffsets(p);
      for (const paw of tips) {
        const b = new Bullet({
          x: paw.x, y: paw.y,
          vx: Math.cos(aim) * w.speed, vy: Math.sin(aim) * w.speed,
          damage: w.damage * dmgMul,
          color: w.color, weapon: 'vulkan',
          friendly: true, life: 1.5, radius: 3,
          tracking: w.tracking, owner: p,
        });
        if (aimAssist(p)) b.homing = true;
        p.game.bullets.push(b);
      }
      p.pawFlashL = 0.07;
      p.pawFlashR = 0.07;
      // v3.33.0: FRENZY — no heat buildup and no overheat while active
      // (thermal is also held at zero by updateWeaponState each frame).
      if (p.frenzyTime > 0) {
        p.thermal = 0;
      } else {
        p.thermal = Math.min(w.thermalMax, p.thermal + w.thermalPerShot);
        // Overheat check
        if (p.thermal >= w.thermalMax) {
          p.thermalLockout = w.thermalLockout;
          p.thermal = 0;
          bus.emit('dmg', { x: p.x, y: p.y - 30, text: 'OVERHEAT!', color: '#ff5722' });
          if (p.game.msglog) { // v3.14.0: weapon lockout → combat console
            p.game.msglog.log('VULKAN OVERHEAT — LOCKOUT ' + w.thermalLockout + 's', 'bad', p.game.time);
          }
        }
      }
      audio.shoot();
      break;
    }

    case 'plasma': {
      // v3.46.0: TWIN-POD BURST — fire a 3-bolt fan from BOTH front-paw
      // emitter tips on every shot (no alternation; both pods fire together).
      // Per-weapon barrelLen (WEAPONS.plasma.barrelLen = 10) places the tips
      // at the pod mouths (PlayerHardpoints.getMuzzleTipOffsets).
      const tips = getMuzzleTipOffsets(p);
      for (const paw of tips) {
        for (let i = -1; i <= 1; i++) {
          const spread = aim + i * 0.14;
          const b = new Bullet({
            x: paw.x, y: paw.y,
            vx: Math.cos(spread) * w.speed, vy: Math.sin(spread) * w.speed,
            damage: w.damage * dmgMul,
            color: w.color, weapon: 'plasma',
            friendly: true, life: 2.0, radius: 6,
            shieldMelt: w.shieldMelt, owner: p,
          });
          if (aimAssist(p)) b.homing = true;
          p.game.bullets.push(b);
        }
      }
      p.pawFlashL = 0.12;
      p.pawFlashR = 0.12;
      audio.shoot();
      break;
    }
    case 'rail': {
      // Piercing beam from center muzzle
      const muzzle = getMuzzlePosition(p);
      const b = new Bullet({
        x: muzzle.x, y: muzzle.y,
        vx: Math.cos(aim) * w.speed, vy: Math.sin(aim) * w.speed,
        damage: w.damage * dmgMul,
        color: w.color, weapon: 'rail',
        friendly: true, life: 1.0, radius: 8,
        pierce: w.pierce, owner: p,
      });
      if (aimAssist(p)) b.homing = true;
      p.game.bullets.push(b);
      p.game.particles.burst(muzzle.x, muzzle.y, { count: 12, color: '#d1c4e9', speed: 200, life: 0.3, size: 3 });
      p.game.shake = Math.max(p.game.shake, 5);
      p.muzzleFlash = 0.18;
      audio.tone(200, 0.15, 'sawtooth', 0.08, 800);
      break;
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  Q/H KEY: STUN ROCKETS (v3.11.0 — real homing rockets)
//  Twin rockets home in with a zig-zag weave + smoke trail (Rockets.js)
//  and burst into the classic 200px shield-strip/stun field on impact
//  (no direct damage).
// ═══════════════════════════════════════════════════════════
export function fireStunRockets(p) {
  launchRockets(p.game, p, 'stun');
  p.pawFlashL = 0.1;
  p.pawFlashR = 0.1;
  bus.emit('banner', { text: 'STUN ROCKETS AWAY!', tone: 'good', duration: 0.8 });
}

// ═══════════════════════════════════════════════════════════
//  E / J KEY: NAPALM ROCKETS (v3.11.0 — real straight-flying rockets)
//  Twin rockets fly straight with a fire trail (Rockets.js). Impact:
//  200px AoE damage burst (mini-scaled) + a lingering fire zone; enemies
//  clipped in flight take chip damage and ignite a pool at their spot.
// ═══════════════════════════════════════════════════════════
export function fireNapalmRockets(p) {
  launchRockets(p.game, p, 'napalm');
  p.pawFlashL = 0.1;
  p.pawFlashR = 0.1;
  bus.emit('banner', { text: 'NAPALM ROCKETS AWAY!', tone: 'good', duration: 0.8 });
}

/** R / G key: cycle to next/previous weapon and reset per-weapon state. */
export function cycleWeapon(p, dir) {
  const order = WEAPON_ORDER;
  const i = (order.indexOf(p.weapon) + dir + order.length) % order.length;
  p.weapon = order[i];
  p.thermal = 0;
  p.thermalLockout = 0;
  p.plasmaAlt = 0;
  bus.emit('banner', { text: 'WEAPON: ' + WEAPONS[p.weapon].name, tone: 'good', duration: 0.8 });
}

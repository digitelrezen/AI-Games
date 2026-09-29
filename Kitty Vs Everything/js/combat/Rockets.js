// Filename: Rockets.js
// Kitty Vs Everything — v3.11.0
// Rocket projectiles for the Q/H (stun) and E/J (napalm) special weapons.
// v3.11.0 replaces the old "instant AoE around the player" behavior with
// real flying rockets (Bullet.js carriers with rocketKind set):
//   STUN   — twin homing rockets with a zig-zag weave + smoke trail.
//            Impact: 200px AoE field that strips shields + stuns
//            non-special enemies (no direct damage).
//   NAPALM — twin straight-flying rockets with a fire trail. Impact: 200px
//            AoE damage burst (mini-scaled) + a lingering FireZone pool;
//            enemies clipped in flight take chip damage and ignite a pool
//            at their spot.
// updateRockets() runs in Game.update BEFORE the bullet position
// integration and Collisions.js, so a rocket that detonates this frame is
// already dead when the friendly-bullet loop runs — no double processing.
export const VERSION = 'v3.11.0';
import Bullet from './Bullet.js';
import { ROCKETS, MINI_SHIP } from '../core/config.js';
import { TAU, clamp, angleTo, dist2 } from '../core/utils.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';
import { applyWeaponHit, onEnemyDeath } from './Combat.js';
import { spawnFireZone } from './FireZone.js';
import { getUpperPawOffsets } from '../player/PlayerHardpoints.js';

/**
 * Launch the twin salvo for a special weapon from the front-paw
 * hardpoints. kind = 'stun' | 'napalm'.
 */
export function launchRockets(game, player, kind) {
  const paws = getUpperPawOffsets(player);
  const aim = player.angle;
  const color = kind === 'napalm' ? ROCKETS.napalmColor : ROCKETS.stunColor;
  for (let i = 0; i < paws.length; i++) {
    const a = aim + (i === 0 ? -0.12 : 0.12);
    const b = new Bullet({
      x: paws[i].x, y: paws[i].y,
      vx: Math.cos(a) * ROCKETS.speed, vy: Math.sin(a) * ROCKETS.speed,
      damage: kind === 'napalm' ? ROCKETS.napalmChip : 0,
      color, friendly: true,
      life: ROCKETS.life, radius: ROCKETS.radius,
      weapon: kind, owner: player,
    });
    b.rocketKind = kind;
    game.bullets.push(b);
  }
  // Launch FX
  game.particles.burst(player.x, player.y, { count: 10, color, speed: 140, life: 0.4, size: 3 });
  game.particles.burst(paws[0].x, paws[0].y, { count: 6, color: '#ffffff', speed: 100, life: 0.3, size: 2.5 });
  game.particles.burst(paws[1].x, paws[1].y, { count: 6, color: '#ffffff', speed: 100, life: 0.3, size: 2.5 });
  game.shake = Math.max(game.shake, 3);
  audio.shoot();
}

/**
 * Per-frame steering, trails and detonation for all live rockets.
 * Called from Game.update before the bullet position integration.
 */
export function updateRockets(game, dt) {
  for (const b of game.bullets) {
    if (!b.alive || !b.rocketKind) continue;
    if (b.rocketKind === 'stun') updateStunRocket(game, b, dt);
    else updateNapalmRocket(game, b, dt);
    // Self-destruct at end of life — the impact IS the explosion.
    if (b.alive && b.life <= dt) {
      if (b.rocketKind === 'stun') detonateStun(game, b, b.x, b.y);
      else detonateNapalm(game, b, b.x, b.y);
    }
  }
}

/** Nearest living enemy (homing + impact checks). */
function nearestEnemy(game, x, y) {
  let target = null;
  let best = Infinity;
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < best) { best = d; target = e; }
  }
  return target;
}

/** STUN: homing with a zig-zag weave + smoke trail. */
function updateStunRocket(game, b, dt) {
  const target = nearestEnemy(game, b.x, b.y);
  const cur = Math.atan2(b.vy, b.vx);
  const desired = target
    ? angleTo(b.x, b.y, target.x, target.y) + Math.sin(b.t * 10) * ROCKETS.weave
    : cur;
  let delta = desired - cur;
  while (delta > Math.PI) delta -= TAU;
  while (delta < -Math.PI) delta += TAU;
  delta = clamp(delta, -ROCKETS.turnRate * dt, ROCKETS.turnRate * dt);
  const spd = Math.hypot(b.vx, b.vy);
  const a = cur + delta;
  b.vx = Math.cos(a) * spd;
  b.vy = Math.sin(a) * spd;

  // Impact on a target → detonate (AoE only, no direct damage).
  if (target) {
    const rr = b.radius + target.radius;
    if (dist2(b.x, b.y, target.x, target.y) < rr * rr) detonateStun(game, b, target.x, target.y);
  }

  // Smoke trail
  if (Math.random() < 0.6) {
    const a2 = Math.atan2(b.vy, b.vx);
    game.particles.burst(b.x - Math.cos(a2) * 9, b.y - Math.sin(a2) * 9, {
      count: 1, color: '#cfd8dc', speed: 20, life: 0.5, size: 2.5,
    });
  }
}

/** NAPALM: straight flight, fire trail, ignite on clip. */
function updateNapalmRocket(game, b, dt) {
  const target = nearestEnemy(game, b.x, b.y);
  if (target) {
    const rr = b.radius + target.radius + 4;
    if (dist2(b.x, b.y, target.x, target.y) < rr * rr) {
      // Direct hit: chip damage + a pool at the enemy's spot, then the
      // full AoE detonation.
      applyWeaponHit(game, target, b);
      if (Math.random() < ROCKETS.igniteChance) spawnFireZone(game, target.x, target.y);
      detonateNapalm(game, b, target.x, target.y);
      return;
    }
  }
  // Fire trail
  if (Math.random() < 0.8) {
    const a = Math.atan2(b.vy, b.vx);
    game.particles.burst(b.x - Math.cos(a) * 9, b.y - Math.sin(a) * 9, {
      count: 1,
      color: Math.random() < 0.5 ? '#ff9800' : ROCKETS.napalmColor,
      speed: 30, life: 0.35, size: 2.5,
    });
  }
}

/** STUN impact: AoE shield-strip + stun (non-specials), no direct damage. */
function detonateStun(game, b, x, y) {
  b.alive = false;
  let stunned = 0;
  let stripped = 0;
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const rr = ROCKETS.stunRadius + e.radius;
    if (dist2(x, y, e.x, e.y) < rr * rr) {
      e.flash = 0.3;
      if (e.shield > 0) { e.shield = 0; stripped++; }
      if (!e.special) {
        e.stunTimer = Math.max(e.stunTimer, ROCKETS.stunDuration);
        e.shootTimer = Math.max(e.shootTimer, ROCKETS.stunSuppress);
        stunned++;
      }
    }
  }
  game.particles.burst(x, y, { count: 26, color: ROCKETS.stunColor, speed: 240, life: 0.5, size: 4 });
  game.shake = Math.max(game.shake, 4);
  audio.tone(440, 0.3, 'sine', 0.08, 220);
  const msg = [];
  if (stunned > 0) msg.push('STUN x' + stunned);
  if (stripped > 0) msg.push('SHIELD STRIP x' + stripped);
  if (msg.length > 0) bus.emit('dmg', { x, y: y - 20, text: msg.join(' | '), color: ROCKETS.stunColor });
}

/** NAPALM impact: AoE damage (mini-scaled) + one lingering fire zone. */
function detonateNapalm(game, b, x, y) {
  b.alive = false;
  const dmg = Math.round(ROCKETS.napalmDamage * (1 + game.player.minis.length * MINI_SHIP.damageBonusPerMini));
  let burned = 0;
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const rr = ROCKETS.napalmRadius + e.radius;
    if (dist2(x, y, e.x, e.y) < rr * rr) {
      e.flash = 0.3;
      e.applyDamage(dmg);
      game.particles.burst(e.x, e.y, { count: 10, color: ROCKETS.napalmColor, speed: 160, life: 0.45, size: 4 });
      burned++;
      if (!e.alive && !e.deathHandled) { e.deathHandled = true; onEnemyDeath(game, e, b.owner); }
    }
  }
  spawnFireZone(game, x, y);
  game.particles.burst(x, y, { count: 28, color: ROCKETS.napalmColor, speed: 220, life: 0.55, size: 5 });
  game.shake = Math.max(game.shake, 6);
  audio.tone(140, 0.35, 'sawtooth', 0.09, 40);
  if (burned > 0) bus.emit('dmg', { x, y: y - 20, text: 'NAPALM x' + burned + ' | ' + burned * dmg + ' DMG', color: ROCKETS.napalmColor });
}

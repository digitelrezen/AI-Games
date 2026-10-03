// Filename: NapalmRockets.js
// Kitty Vs Everything — v3.70.0 (module v1.0.0)
// MODULAR WEAPON ARCHITECTURE (Phase 3) — the NAPALM ROCKETS (E/J) extracted
// from js/combat/Rockets.js (v3.11.0 real flying rockets).
//
// Behavior (unchanged from the Rockets.js implementation):
//   - Payload: twin straight-flying rockets from the front-paw hardpoints
//     (ROCKETS.napalmChip 12 chip damage on a direct hit).
//   - Tracking: straight flight + fire trail; an enemy clipped in flight
//     takes chip damage (applyWeaponHit) and ignites a FireZone pool at its
//     spot (ROCKETS.igniteChance 0.75) before the full detonation.
//   - Impact: 200px AoE damage burst (ROCKETS.napalmDamage 60, mini-scaled)
//     + one lingering FireZone pool (persistent flame DoT, FireZone.js).
//   - Self-destruct at ROCKETS.life (2 s) — the impact IS the explosion.
//
// State ownership: none — the carrier bullets carry the flight state
// (velocity, t clock, life) and the cooldown lives on the Player
// (napalmCooldown, gated in PlayerWeapons.handleActionKeys). The
// module-level singleton (napalmRockets) serves every player, coop included.
export const VERSION = 'v1.0.0';
import { ROCKETS, MINI_SHIP } from '../core/config.js';
import { dist2 } from '../core/utils.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';
import { applyWeaponHit, onEnemyDeath } from './Combat.js';
import { spawnFireZone } from './FireZone.js';
import BaseRocket from './BaseRocket.js';

export default class NapalmRockets extends BaseRocket {
  get kind() { return 'napalm'; }

  /** Deploy the twin straight salvo from the front-paw hardpoints. */
  launch(game, player) {
    this._deploySalvo(game, player, {
      color: ROCKETS.napalmColor,
      damage: ROCKETS.napalmChip,
      weapon: 'napalm',
    });
  }

  /** Straight flight, fire trail, ignite on clip. */
  steer(game, b, dt) {
    const target = this.nearestEnemy(game, b.x, b.y);
    if (target) {
      const rr = b.radius + target.radius + 4;
      if (dist2(b.x, b.y, target.x, target.y) < rr * rr) {
        // Direct hit: chip damage + a pool at the enemy's spot, then the
        // full AoE detonation.
        applyWeaponHit(game, target, b);
        if (Math.random() < ROCKETS.igniteChance) spawnFireZone(game, target.x, target.y);
        this.detonate(game, b, target.x, target.y);
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

  /** AoE damage (mini-scaled) + one lingering fire zone. */
  detonate(game, b, x, y) {
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
}

/** Module-level singleton — stateless, serves every player (coop included). */
export const napalmRockets = new NapalmRockets();

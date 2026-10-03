// Filename: BaseRocket.js
// Kitty Vs Everything — v3.70.0 (module v1.0.0)
// MODULAR WEAPON ARCHITECTURE (Phase 3) — abstract base class for the
// twin-launched special rockets (Q/H stun, E/J napalm), extracted from
// js/combat/Rockets.js (v3.11.0 real flying rockets).
//
// A rocket kind owns its PAYLOAD DEPLOYMENT (twin salvo from the front-paw
// hardpoints), its TRACKING (per-frame steering + trail for each live
// carrier), and its DETONATION (impact AoE + status effects). Carriers are
// Bullet.js instances tagged with rocketKind; the logic is stateless — it
// reads the game world per call — so a module-level singleton serves every
// player (coop included). Cooldowns stay on the Player (stunCooldown /
// napalmCooldown, gated in PlayerWeapons.handleActionKeys).
//
// Contract implemented by subclasses (StunRockets.js / NapalmRockets.js):
//   - kind       'stun' | 'napalm'  (the rocketKind tag on the carrier)
//   - launch(game, player)          deploy the twin salvo + launch FX
//   - steer(game, b, dt)            per-frame steering + trail for one carrier
//   - detonate(game, b, x, y)       impact AoE + status effects (kills b)
//
// Shared:
//   - _deploySalvo(...)  twin-paw hardpoint launch + launch FX (Bullet carriers)
//   - nearestEnemy(...)  nearest living enemy (homing + impact checks)
//   - update(game, dt)   iterate live carriers of this kind → steer +
//                        self-destruct. Runs in Game.update BEFORE the bullet
//                        position integration and Collisions.js, so a rocket
//                        that detonates this frame is already dead when the
//                        friendly-bullet loop runs — no double processing.
export const VERSION = 'v1.0.0';
import Bullet from './Bullet.js';
import { ROCKETS } from '../core/config.js';
import { dist2 } from '../core/utils.js';
import { audio } from '../core/AudioSystem.js';
import { getUpperPawOffsets } from '../player/PlayerHardpoints.js';

export default class BaseRocket {
  /** The rocketKind tag on the Bullet carrier ('stun' | 'napalm'). */
  get kind() {
    throw new Error('BaseRocket.kind is abstract — implement in a subclass');
  }

  /** Deploy the twin salvo from the front-paw hardpoints. */
  launch(game, player) {
    throw new Error(`BaseRocket.launch() is abstract — implement in ${this.constructor.name}`);
  }

  /** Per-frame steering + trail for one live carrier. */
  steer(game, b, dt) {
    throw new Error(`BaseRocket.steer() is abstract — implement in ${this.constructor.name}`);
  }

  /** Impact AoE + status effects. Must set b.alive = false. */
  detonate(game, b, x, y) {
    throw new Error(`BaseRocket.detonate() is abstract — implement in ${this.constructor.name}`);
  }

  /**
   * Shared twin-salvo deployment from the front-paw hardpoints (v3.11.0):
   * two Bullet carriers at aim ± 0.12 rad with the kind's color/damage,
   * rocketKind tagged, plus the launch FX (player burst + white paw puffs,
   * shake ≥ 3, shoot SFX).
   */
  _deploySalvo(game, player, { color, damage, weapon }) {
    const paws = getUpperPawOffsets(player);
    const aim = player.angle;
    for (let i = 0; i < paws.length; i++) {
      const a = aim + (i === 0 ? -0.12 : 0.12);
      const b = new Bullet({
        x: paws[i].x, y: paws[i].y,
        vx: Math.cos(a) * ROCKETS.speed, vy: Math.sin(a) * ROCKETS.speed,
        damage, color, friendly: true,
        life: ROCKETS.life, radius: ROCKETS.radius,
        weapon, owner: player,
      });
      b.rocketKind = this.kind;
      game.bullets.push(b);
    }
    // Launch FX
    game.particles.burst(player.x, player.y, { count: 10, color, speed: 140, life: 0.4, size: 3 });
    game.particles.burst(paws[0].x, paws[0].y, { count: 6, color: '#ffffff', speed: 100, life: 0.3, size: 2.5 });
    game.particles.burst(paws[1].x, paws[1].y, { count: 6, color: '#ffffff', speed: 100, life: 0.3, size: 2.5 });
    game.shake = Math.max(game.shake, 3);
    audio.shoot();
  }

  /** Nearest living enemy (homing + impact checks). */
  nearestEnemy(game, x, y) {
    let target = null;
    let best = Infinity;
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < best) { best = d; target = e; }
    }
    return target;
  }

  /**
   * Per-frame steering, trails and detonation for all live carriers of
   * this kind. Called from Game.update before the bullet position
   * integration and Collisions.js.
   */
  update(game, dt) {
    for (const b of game.bullets) {
      if (!b.alive || b.rocketKind !== this.kind) continue;
      this.steer(game, b, dt);
      // Self-destruct at end of life — the impact IS the explosion.
      if (b.alive && b.life <= dt) this.detonate(game, b, b.x, b.y);
    }
  }
}

// Filename: StunRockets.js
// Kitty Vs Everything — v3.70.0 (module v1.0.0)
// MODULAR WEAPON ARCHITECTURE (Phase 3) — the STUN ROCKETS (Q/H) extracted
// from js/combat/Rockets.js (v3.11.0 real flying rockets).
//
// Behavior (unchanged from the Rockets.js implementation):
//   - Payload: twin homing rockets from the front-paw hardpoints (0 dmg —
//     the impact is pure status, no direct damage).
//   - Tracking: homing with a zig-zag weave (ROCKETS.turnRate 3.4 rad/s,
//     ROCKETS.weave 0.4 rad, sin(b.t * 10) phase) + a smoke trail.
//   - Impact: 200px AoE field that strips enemy shields + stuns
//     non-special enemies (stunTimer 1.0 s, fire suppression 3.0 s).
//   - Self-destruct at ROCKETS.life (2 s) — the impact IS the explosion.
//
// State ownership: none — the carrier bullets carry the flight state
// (velocity, t clock, life) and the cooldown lives on the Player
// (stunCooldown, gated in PlayerWeapons.handleActionKeys). The
// module-level singleton (stunRockets) serves every player, coop included.
export const VERSION = 'v1.0.0';
import { ROCKETS } from '../core/config.js';
import { TAU, clamp, angleTo, dist2 } from '../core/utils.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';
import BaseRocket from './BaseRocket.js';

export default class StunRockets extends BaseRocket {
  get kind() { return 'stun'; }

  /** Deploy the twin homing salvo from the front-paw hardpoints. */
  launch(game, player) {
    this._deploySalvo(game, player, {
      color: ROCKETS.stunColor,
      damage: 0,
      weapon: 'stun',
    });
  }

  /** Homing with a zig-zag weave + smoke trail; detonate on contact. */
  steer(game, b, dt) {
    const target = this.nearestEnemy(game, b.x, b.y);
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
      if (dist2(b.x, b.y, target.x, target.y) < rr * rr) this.detonate(game, b, target.x, target.y);
    }

    // Smoke trail
    if (Math.random() < 0.6) {
      const a2 = Math.atan2(b.vy, b.vx);
      game.particles.burst(b.x - Math.cos(a2) * 9, b.y - Math.sin(a2) * 9, {
        count: 1, color: '#cfd8dc', speed: 20, life: 0.5, size: 2.5,
      });
    }
  }

  /** AoE shield-strip + stun (non-specials), no direct damage. */
  detonate(game, b, x, y) {
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
}

/** Module-level singleton — stateless, serves every player (coop included). */
export const stunRockets = new StunRockets();

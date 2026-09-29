// Filename: FireZone.js
// Kitty Vs Everything — v3.11.0
// Lingering napalm pools (FIRE_ZONE in config.js): a ground pool left by
// napalm rocket impacts (Rockets.js) that deals periodic DoT damage to
// every enemy passing through it until it burns out after `duration`
// seconds. Owned by Game (game.fireZones), updated + drawn there.
export const VERSION = 'v3.11.0';
import { FIRE_ZONE } from '../core/config.js';
import { TAU, rand, dist2 } from '../core/utils.js';
import { onEnemyDeath } from './Combat.js';

export class FireZone {
  constructor(x, y, game) {
    this.x = x;
    this.y = y;
    this.game = game;
    this.radius = FIRE_ZONE.radius;
    this.life = FIRE_ZONE.duration;
    this.maxLife = FIRE_ZONE.duration;
    this.tickTimer = FIRE_ZONE.tick; // first DoT tick after one interval
    this.alive = true;
    this.t = rand(0, TAU);           // animation phase offset
  }

  update(dt) {
    this.life -= dt;
    this.t += dt;
    if (this.life <= 0) { this.alive = false; return; }
    this.tickTimer -= dt;
    if (this.tickTimer > 0) return;
    this.tickTimer = FIRE_ZONE.tick;
    for (const e of this.game.enemies) {
      if (!e.alive) continue;
      const rr = this.radius + e.radius;
      if (dist2(this.x, this.y, e.x, e.y) < rr * rr) {
        e.flash = Math.max(e.flash, 0.15);
        e.applyDamage(FIRE_ZONE.damage);
        if (!e.alive && !e.deathHandled) { e.deathHandled = true; onEnemyDeath(this.game, e); }
      }
    }
  }

  draw(ctx) {
    const frac = Math.max(0, this.life / this.maxLife); // 1 → 0 as it burns out
    const flicker = 0.85 + 0.15 * Math.sin(this.t * 12);
    ctx.save();
    // Outer glow pool
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
    grad.addColorStop(0, `rgba(255, 152, 0, ${0.30 * frac * flicker})`);
    grad.addColorStop(0.6, `rgba(255, 87, 34, ${0.18 * frac * flicker})`);
    grad.addColorStop(1, 'rgba(255, 87, 34, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, TAU);
    ctx.fill();
    // Bubbling fire blobs
    for (let i = 0; i < 5; i++) {
      const a = this.t * 2 + i * (TAU / 5);
      const wob = 0.25 + 0.45 * Math.abs(Math.sin(this.t * 3 + i));
      const px = this.x + Math.cos(a) * this.radius * 0.45;
      const py = this.y + Math.sin(a) * this.radius * 0.45;
      ctx.fillStyle = i % 2
        ? `rgba(255,193,7,${0.35 * frac * flicker})`
        : `rgba(255,87,34,${0.4 * frac * flicker})`;
      ctx.beginPath();
      ctx.arc(px, py, this.radius * wob * 0.22, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Spawn a napalm pool at (x, y). No-op when the pool cap is reached —
 *  the oldest pool burns out to make room. */
export function spawnFireZone(game, x, y) {
  if (game.fireZones.length >= 12) game.fireZones.shift();
  game.fireZones.push(new FireZone(x, y, game));
}

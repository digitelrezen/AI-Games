// Filename: hazards/HazardManager.js
// Kitty Vs Everything — v1.0.0 (v3.97.0 Hazards)
// The HAZARD FIELD — an independent spawner + per-frame driver for the
// non-lootable, shootable environmental obstacles (js/hazards/).
//
// Independence: the manager owns its own list / FX state and its own
// spawn timer. Game.js ticks it (update) and renders it (draw) but the
// WaveManager never sees hazards — they spawn on their own cadence,
// separate from enemy waves, power-up drops and easter eggs. The spawner
// is active during combat levels only (game.state === 'playing' with an
// active combat wave), so bonus rounds stay hazard-free.
//
// ZERO LOOT: destruction never routes through the DropManager — a popped
// hazard yields score (player kills only) and its explosion, nothing else.
//
// Explosions are per-type (HAZARD_TYPES[type].explosion):
//   bio     green splatter + lingering toxic pool (dps over time)
//   fire    orange burst + lingering fire pool
//   ash     gray burst + long-lived low-dps ash pool (Depleted Shell)
//   cluster N sub-bursts + mini shockwaves around the center
//   magnet  blue-white EM burst + CLEARS enemy bullets in the field
//   nuke    massive blast radius, double shockwave, full-screen flash
//   prox    tight high-damage burst (Prox Mine)
// Every explosion: particle bursts, expanding shockwave ring, screen
// shake, audio.explosion(), and AoE damage to every live player inside
// the blast radius (co-op safe — all of game.players).
export const VERSION = 'v1.0.0';
import { HAZARD, HAZARD_TYPES } from '../core/config.js';
import { TAU, rand, dist2, lerp } from '../core/utils.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';
import { createHazard, pickSpawnVector } from './HazardFactory.js';

// Per-kind particle palettes (hot core → body → accent).
const PALETTES = {
  bio:     ['#76ff03', '#00e676', '#b9f6ca'],
  fire:    ['#ff9800', '#ff5722', '#ffd54f'],
  ash:     ['#9e9e9e', '#616161', '#cfd8dc'],
  cluster: ['#ffd740', '#ffb300', '#fff59d'],
  magnet:  ['#40c4ff', '#b3e5fc', '#ffffff'],
  nuke:    ['#ffffff', '#ff1744', '#ff9e80'],
  prox:    ['#ff4081', '#ff80ab', '#ffffff'],
};

export default class HazardManager {
  constructor(game) {
    this.game = game;
    this.list = [];      // active hazards (HazardBase)
    this.rings = [];     // expanding shockwave rings (fx)
    this.pools = [];     // lingering damage pools (bio / fire / ash)
    this.flashT = 0;     // nuke full-screen flash (seconds remaining)
    this.flashMax = 1;   // flash duration reference (for the fade)
    this.spawnTimer = rand(HAZARD.SPAWN_MIN, HAZARD.SPAWN_MAX);
  }

  /** Fresh hazard field per mission (Game.start). */
  reset() {
    this.list = [];
    this.rings = [];
    this.pools = [];
    this.flashT = 0;
    this.flashMax = 1;
    this.spawnTimer = rand(HAZARD.SPAWN_MIN, HAZARD.SPAWN_MAX);
  }

  /**
   * Per-frame driver (Game.update, playing/bonus block). Spawns are gated
   * to active combat waves; drift / pools / rings / flash always tick so
   * in-flight hazards finish their course across stage transitions.
   */
  update(game, dt) {
    const combat = game.state === 'playing' && game.waveManager && game.waveManager.active;
    if (combat) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = rand(HAZARD.SPAWN_MIN, HAZARD.SPAWN_MAX);
        if (this.list.length < HAZARD.MAX_CONCURRENT) this.spawnRandom(game);
      }
    }
    for (const hz of this.list) hz.update(dt);
    this.list = this.list.filter(hz => hz.alive);

    // Lingering pools — DoT on every player standing in them.
    const players = (game.players && game.players.length) ? game.players : [game.player];
    for (const pool of this.pools) {
      pool.t += dt;
      pool.life -= dt;
      if (pool.life > 0) {
        for (const p of players) {
          if (!p || p.dead) continue;
          const r = pool.radius + p.radius;
          if (dist2(pool.x, pool.y, p.x, p.y) < r * r) game.hitPlayer(pool.dps * dt, p);
        }
      }
    }
    this.pools = this.pools.filter(pool => pool.life > 0);

    for (const ring of this.rings) ring.t += dt;
    this.rings = this.rings.filter(ring => ring.t < ring.life);
    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
  }

  /** Spawn one hazard from a random edge (any direction). Dev panel too. */
  spawnRandom(game, type) {
    const v = pickSpawnVector(game, type);
    const hz = createHazard({ type: v.type, x: v.x, y: v.y, angle: v.angle, game });
    this.list.push(hz);
    return hz;
  }

  /**
   * Detonate a hazard (called by the Collisions.js friendly-bullet loop
   * with byPlayer: true, or by HazardBase via proximity fuse / contact).
   * ZERO loot — this is the only destruction path and it never drops.
   */
  explode(game, hz, opts = {}) {
    if (hz.deathHandled) return;
    hz.deathHandled = true;
    hz.alive = false;
    const spec = hz.spec;
    const ex = spec.explosion;
    const x = hz.x, y = hz.y;
    const pal = PALETTES[ex.kind] || [spec.color, '#ffffff'];
    game.shake = Math.max(game.shake, ex.shake);
    audio.explosion();

    // Main burst — two layers (hot core + colored body).
    game.particles.burst(x, y, { count: 18 + Math.round(ex.radius / 4), color: pal[0], speed: 300, life: 0.6, size: 3 });
    game.particles.burst(x, y, { count: 10 + Math.round(ex.radius / 6), color: pal[1], speed: 180, life: 0.8, size: 2.5 });
    // Primary shockwave ring.
    this.rings.push({ x, y, t: 0, life: 0.45, r0: hz.radius, r1: ex.radius, color: pal[0], width: 3 });

    // Kind-specific FX.
    if (ex.pool) {
      this.pools.push({ x, y, radius: ex.pool.radius, life: ex.pool.life, maxLife: ex.pool.life, dps: ex.pool.dps, color: ex.pool.color, t: 0 });
    }
    if (ex.kind === 'cluster') {
      const subs = ex.subs || 5;
      for (let i = 0; i < subs; i++) {
        const a = rand(0, TAU), d = rand(0, ex.radius * 0.55);
        const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d;
        game.particles.burst(sx, sy, { count: 10, color: pal[i % pal.length], speed: 160, life: 0.5, size: 2 });
        this.rings.push({ x: sx, y: sy, t: 0, life: 0.35, r0: 4, r1: 46, color: pal[1], width: 2 });
      }
    }
    if (ex.kind === 'magnet' && ex.clearBullets) {
      // EM burst eats the enemy fire in the field (tactical chaos).
      for (const b of game.bullets) {
        if (!b.alive || b.friendly) continue;
        if (dist2(x, y, b.x, b.y) < ex.clearBullets * ex.clearBullets) {
          b.alive = false;
          game.particles.burst(b.x, b.y, { count: 5, color: '#b3e5fc', speed: 90, life: 0.3, size: 2 });
        }
      }
    }
    if (ex.kind === 'nuke') {
      this.rings.push({ x, y, t: 0, life: 0.7, r0: ex.radius * 0.4, r1: ex.radius * 1.25, color: '#ffffff', width: 5 });
      game.particles.burst(x, y, { count: 40, color: '#ffffff', speed: 420, life: 0.5, size: 3 });
      if (ex.flash) {
        this.flashT = Math.max(this.flashT, ex.flash);
        this.flashMax = Math.max(this.flashMax, ex.flash);
      }
    }

    // AoE damage — every live player inside the blast radius.
    const players = (game.players && game.players.length) ? game.players : [game.player];
    for (const p of players) {
      if (!p || p.dead) continue;
      const r = ex.radius + p.radius;
      if (dist2(x, y, p.x, p.y) < r * r) game.hitPlayer(ex.damage, p);
    }

    // Score for PLAYER KILLS only — drift-outs / self-detonations score
    // nothing. Still ZERO loot: no DropManager, ever.
    if (opts.byPlayer) {
      const pts = Math.round(spec.score * game.multiplier);
      game.score += pts;
      bus.emit('dmg', { x, y, text: '+' + pts, color: '#ffd54f' });
    }
  }

  /** Render the hazard field (Game.render): pools → sprites → rings → flash. */
  draw(game, ctx) {
    // Lingering pools under everything.
    for (const pool of this.pools) {
      const fade = Math.min(1, pool.life / 1.2);
      const flicker = 0.8 + 0.2 * Math.sin(pool.t * 14);
      const r = pool.radius * (0.92 + 0.08 * flicker);
      const grd = ctx.createRadialGradient(pool.x, pool.y, r * 0.15, pool.x, pool.y, r);
      grd.addColorStop(0, pool.color);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalAlpha = 0.35 * fade * flicker;
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.5 * fade;
      ctx.strokeStyle = pool.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    for (const hz of this.list) hz.draw(ctx);
    // Expanding shockwave rings.
    for (const ring of this.rings) {
      const k = ring.t / ring.life;
      const r = lerp(ring.r0, ring.r1, k);
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = ring.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, r, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    // Nuke full-screen flash.
    if (this.flashT > 0) {
      const a = Math.min(0.8, (this.flashT / this.flashMax) * 0.8);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(0, 0, game.viewW || game.W, game.viewH || game.H);
    }
  }
}
// Filename: AsteroidBonus.js
// Kitty Vs Everything — v3.83.0
// Destructible asteroid chain power-up (ASTEROID in config.js):
//   Large  → 2 Medium + 2 Small shards
//   Medium → 4 Small
//   every destroyed Small rolls the DROP_POLICY.asteroid chance (40%)
//   to drop a regular power-up (max 1, via DropManager).
// Asteroids live in game.powerups with destructible=true, so the existing
// friendly-bullet collision loop (Collisions.js) routes shots straight
// into them, and the pickup loop already skips destructible drops.
// Destruction is routed to Game.destroyAsteroid (isAsteroid flag), which
// delegates back to destroyAsteroid() here for the split / drop roll.
//
// v3.22.0: the rock is now the pixel-art asset from
// .assets/Asteroid pixel_art_small.png (sprite pipeline in AsteroidSprite.js).
// A Large asteroid shatters into MEDIUM + SMALLER fragment parts: the Medium
// and Small fragments are drawn from jagged shard sub-sprites (the rock
// clipped to irregular polygons) so each piece looks like a broken jagged
// chunk of it. Until the sprite pipeline finishes (or if it fails) the old
// procedural jittered-rock fallback is drawn instead.
// v3.42.0: shatter drops sample the shared POWERUP_DROPS pool (config.js)
//          — Health / Frenzy / Shields / Wanted (mini) / Extra Life.
// v3.83.0: shatter drops route through the DropManager (DROP_POLICY.asteroid:
//          40% chance, max 1 drop, on-screen sources only).
export const VERSION = 'v3.83.0';
import { ASTEROID } from '../core/config.js';
import { spawnSourceDrops } from '../core/DropManager.js'; // v3.83.0
import { TAU, rand } from '../core/utils.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';
import { getAsteroidSprite, getAsteroidShards } from './AsteroidSprite.js';

export class Asteroid {
  /**
   * @param {object} o { x, y, stage, game } — stage 0 = large, 1 = medium,
   *   2 = small (ASTEROID.chain).
   */
  constructor({ x, y, stage, game }) {
    const spec = ASTEROID.chain[stage];
    this.game = game;
    this.x = x;
    this.y = y;
    this.stage = stage;
    this.type = 'asteroid';    // never matched by Game.collectPowerUp's switch
    this.radius = spec.size;
    this.hp = spec.hp;
    this.maxHp = spec.hp;
    this.destructible = true;  // shot down, never picked up
    this.isAsteroid = true;    // routes destruction to Game.destroyAsteroid
    this.alive = true;
    this.t = rand(0, TAU);
    this.spin = rand(-0.9, 0.9);
    const a = rand(0, TAU);
    const s = ASTEROID.drift * (1 - stage * 0.15);
    this.vx = Math.cos(a) * s;
    this.vy = Math.abs(Math.sin(a)) * s + 25; // slow downward drift
    this.seed = Math.floor(rand(0, 9999));    // stable crater / wobble pattern
    this.flash = 0;
  }

  update(dt) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y > this.game.H + 60) this.alive = false;
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.t * this.spin);

    const sprite = getAsteroidSprite();
    if (sprite) {
      // v3.22.0: pixel-art asteroid (AsteroidSprite.js). Large = the full
      // rock; Medium / Small = a jagged shard (a broken chunk of the rock,
      // picked by seed) scaled to the tier's size.
      const shardList = getAsteroidShards();
      const src = (this.stage === 0 || !shardList)
        ? sprite
        : shardList[this.seed % shardList.length];
      const h = r * 2;
      const w = h * (src.width / src.height);
      ctx.imageSmoothingEnabled = true;
      if (this.flash > 0) { // white hit-flash glow
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = r * 0.9;
      }
      ctx.drawImage(src, -w / 2, -h / 2, w, h);
      ctx.shadowBlur = 0;
    } else {
      // Fallback until the sprite pipeline finishes (should be instant):
      // rocky silhouette — seeded jittered circle.
      ctx.fillStyle = this.flash > 0 ? '#fff' : '#8d6e63';
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * TAU;
        const wob = 0.82 + 0.18 * Math.sin(this.seed + i * 2.7);
        const px = Math.cos(a) * r * wob;
        const py = Math.sin(a) * r * wob;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Craters
      ctx.fillStyle = 'rgba(93, 64, 55, 0.55)';
      for (let i = 0; i < 3; i++) {
        const a = this.seed * 1.3 + i * 2.1;
        const cr = r * (0.12 + 0.1 * ((this.seed + i) % 3) / 3);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, cr, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    // HP bar (only once damaged)
    if (this.hp < this.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(this.x - r, this.y - r - 10, r * 2, 4);
      ctx.fillStyle = '#a1887f';
      ctx.fillRect(this.x - r, this.y - r - 10, r * 2 * (this.hp / this.maxHp), 4);
    }
  }
}

/** Spawn a large asteroid (stage 0) at (x, y). */
export function spawnAsteroid(game, x, y) {
  game.powerups.push(new Asteroid({ x, y, stage: 0, game }));
}

/**
 * Destroy an asteroid: score + explosion, then shatter into the next chain
 * stage — or roll the regular power-up drop table on the last stage.
 *
 * v3.22.0 multi-tier shatter: a Large asteroid breaks apart into MEDIUM
 * fragments (spec.splits) PLUS SMALLER fragments (spec.smallShards Small
 * shards), and a Medium breaks into Small fragments. Each fragment is drawn
 * from a jagged shard sub-sprite of the pixel-art rock (AsteroidSprite.js),
 * so the pieces read as broken jagged chunks of the shattered asteroid.
 */
export function destroyAsteroid(game, a) {
  a.alive = false;
  const spec = ASTEROID.chain[a.stage];
  const stageScore = [500, 250, 100][a.stage];
  const pts = Math.round(stageScore * game.multiplier);
  game.score += pts;
  game.particles.burst(a.x, a.y, { count: 10 + a.radius / 2, color: '#a1887f', speed: 180, life: 0.5 });
  game.shake = Math.max(game.shake, a.stage === 0 ? 5 : 3);
  bus.emit('dmg', { x: a.x, y: a.y, text: '+' + pts, color: '#bcaaa4' });
  audio.explosion();
  const lastStage = ASTEROID.chain.length - 1;
  if (a.stage < lastStage) {
    // Next-tier (Medium) fragments.
    for (let i = 0; i < spec.splits; i++) {
      game.powerups.push(new Asteroid({
        x: a.x + rand(-24, 24),
        y: a.y + rand(-24, 24),
        stage: a.stage + 1,
        game,
      }));
    }
    // Smaller (Small) shards — the "smaller fragment parts" of the shatter.
    const smallShards = spec.smallShards || 0;
    for (let i = 0; i < smallShards; i++) {
      game.powerups.push(new Asteroid({
        x: a.x + rand(-30, 30),
        y: a.y + rand(-30, 30),
        stage: lastStage,
        game,
      }));
    }
  } else {
    // v3.83.0: Small destroyed → DropManager 'asteroid' source (40% chance,
    // max 1 drop, on-screen sources only — DROP_POLICY.asteroid).
    spawnSourceDrops(game, 'asteroid', a.x, a.y, a.radius);
  }
}

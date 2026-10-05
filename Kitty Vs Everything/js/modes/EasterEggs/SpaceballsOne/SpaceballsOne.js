// Filename: SpaceballsOne.js
// Kitty Vs Everything — v3.81.0
// "Spaceballs One" — the rare UNSTOPPABLE easter-egg ship (v3.81.0).
//
// Spawn: a rare roll at the start of every combat wave
// (SPACEBALLS_ONE.spawnChance, capped at SPACEBALLS_ONE.maxPerRun per
// mission — the roll lives in EasterEgg.maybeSpawnSpaceballs, called from
// WaveManager.startNext). The dev panel "Spaceballs One" button force-
// spawns it (switchEgg(game, 'spaceballs')).
//
// Flight: enters off-screen top-right and races diagonally to bottom-left
// (SPACEBALLS_ONE.speed px/s, delta-time integrated), despawning cleanly
// once fully off-screen. The art (SpaceballsOneArt.js,
// .assets/We-Brake-For-Nobody.png) is scaled by SPACEBALLS_ONE.scale and
// rotated to the descent heading.
//
// Unstoppable: SpaceballsOneCollision.sweepPath obliterates everything in
// its path (enemies / asteroids / crates / all projectiles) — "We brake
// for nobody!". SpaceballsOneWeapon.js fires a brake-light bolt stream at
// the player. Friendly bullets damage it (SPACEBALLS_ONE.hp); on
// destruction SpaceballsOneLoot.spawnTreasureChest ejects ONE of EVERY
// power-up type (the treasure-chest jackpot).

import { clamp } from '../../../core/utils.js';
import { spaceballsArtDims } from './SpaceballsOneArt.js';
import { drawSpaceballsShip } from './SpaceballsOneArt.js';
import { sweepPath } from './SpaceballsOneCollision.js';
import { updateSpaceballsWeapon } from './SpaceballsOneWeapon.js';
import { spawnTreasureChest } from './SpaceballsOneLoot.js';

/** v3.81.0: Spaceballs One tuning (single source of truth). */
export const SPACEBALLS_ONE = {
  spawnChance: 0.06,    // rare roll at the start of each combat wave
  maxPerRun: 2,         // per-mission cap (EasterEgg manager counts)
  hp: 200,              // high-health target — ~3s of focused fire
  speed: 400,           // px/s diagonal transit (top-right → bottom-left)
  scale: 1.75,          // 128×72 art → 224×126 on screen
  sweepPad: 20,         // extra px around the art box for the sweep
  fireInterval: 0.16,   // s between weapon volleys
  bulletsPerVolley: 3,  // 3-way spread
  spread: 0.12,         // rad between spread arms
  bulletSpeed: 340,     // px/s (the ship outruns its own bolts)
  bulletDamage: 8,
  bulletColor: '#ff4dd8', // brake-light magenta
  lootScore: 10000,     // jackpot score bonus (× multiplier)
};

export default class SpaceballsOne {
  constructor(game) {
    this.game = game;
    this.alive = true;
    this.t = 0;
    this.hp = SPACEBALLS_ONE.hp;
    this.maxHp = SPACEBALLS_ONE.hp;
    this.fireTimer = SPACEBALLS_ONE.fireInterval; // first volley after one interval
    this.swept = 0; // entities obliterated last frame (debug snapshot)
    // On-screen art size (registry dims × scale — aspect-correct).
    const dims = spaceballsArtDims();
    this.w = dims.w * SPACEBALLS_ONE.scale;
    this.h = dims.h * SPACEBALLS_ONE.scale;
    // Trajectory: off-screen top-right → off-screen bottom-left.
    const W = game.viewW, H = game.viewH;
    this.x = W + 120;
    this.y = -120;
    const dx = -(W + 240), dy = H + 240;
    const len = Math.hypot(dx, dy);
    this.vx = (dx / len) * SPACEBALLS_ONE.speed;
    this.vy = (dy / len) * SPACEBALLS_ONE.speed;
    this.heading = Math.atan2(this.vy, this.vx);
  }

  /** 0 at spawn (top-right) → 1 at exit (bottom-left) (debug snapshot). */
  get progress() {
    const k = 1 - (this.x - 120) / (this.game.viewW + 240);
    return clamp(k, 0, 1);
  }

  update(dt) {
    if (!this.alive) return;
    const g = this.game;
    const x0 = this.x, y0 = this.y;
    this.t += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // Clean despawn: fully off-screen bottom-left → the egg is done.
    if (this.x < -200 && this.y > g.viewH + 120) {
      this.alive = false;
      return;
    }
    // Unstoppable sweep along this frame's movement segment.
    this.swept = sweepPath(g, x0, y0, this.x, this.y,
      this.w / 2 + SPACEBALLS_ONE.sweepPad, this.h / 2 + SPACEBALLS_ONE.sweepPad);
    // Brake-light stream at the player.
    updateSpaceballsWeapon(this, dt, SPACEBALLS_ONE);
    // Friendly bullets vs the ship's bounding box.
    this.checkBullets();
  }

  /** Friendly bullets vs the ship's bounding box (ship-egg pattern). */
  checkBullets() {
    const g = this.game;
    const hw = this.w / 2, hh = this.h / 2;
    for (const b of g.bullets) {
      if (!b.alive || !b.friendly) continue;
      if (Math.abs(b.x - this.x) <= hw + b.radius &&
          Math.abs(b.y - this.y) <= hh + b.radius) {
        b.alive = false;
        this.hp -= b.damage;
        g.particles.burst(b.x, b.y, { count: 6, color: SPACEBALLS_ONE.bulletColor, speed: 140, life: 0.3 });
        if (this.hp <= 0) {
          this.destroyed();
          return;
        }
      }
    }
  }

  /** v3.81.0: destroyed → treasure-chest jackpot cascade. */
  destroyed() {
    if (!this.alive) return;
    this.alive = false;
    const g = this.game;
    g.particles.burst(this.x, this.y, { count: 48, color: '#ffd54f', speed: 380, life: 0.9 });
    spawnTreasureChest(g, this.x, this.y, SPACEBALLS_ONE.lootScore);
  }

  draw(ctx) {
    if (!this.alive) return;
    drawSpaceballsShip(ctx, this.x, this.y, this.heading, SPACEBALLS_ONE.scale);
    // HP bar — only once damaged (ship-egg pattern).
    if (this.hp < this.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2 - 14, this.w, 5);
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2 - 14,
        this.w * Math.max(0, this.hp) / this.maxHp, 5);
    }
  }
}

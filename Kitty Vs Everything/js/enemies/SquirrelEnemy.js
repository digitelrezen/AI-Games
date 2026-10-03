// Filename: SquirrelEnemy.js
// Kitty Vs Everything — v1.0.0
// Squirrel: fast, erratic tree-dweller with a bushy tail. Scurries down on
// quick bursts with sudden hops and twitchy lateral sprints, fires light
// aimed shots.
// v1.0.0: sprite — the 19th species. Draws the shared pixel-art PNG
//         (.assets/Squirel pixel_art.png, 580×476) through the AssetManager
//         pipeline (tools/import-assets.mjs → js/core/AssetSprites.js, key
//         "squirrel", normalized to 128×105). The art is a near-frontal
//         upright squirrel (head at the top, centered mass, bushy tail
//         curling up the side), so it stays head-up with NO face-the-player
//         mirror: a fast scurry bounce (t * 16) + twitchy wobble (t * 4.2)
//         + a sprint stretch along the current burst keep the blit alive
//         between hops, and a type-color accent glow pass adds depth under
//         the crisp draw. The classic procedural squirrel (bushy S-tail,
//         round body, perked ears, glowing eyes, claw feet) is kept as the
//         null-sprite fallback per the AssetManager contract.
export const VERSION = 'v1.0.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v1.0.0: shared PNG pipeline

const SQUIRREL_SPRITE_KEY = 'squirrel';

export default class SquirrelEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    // Fast scurry descent (the squirrel is the fastest mob in the roster).
    this.y += s * dt * 0.95;
    // Erratic hop: every 0.9–2.2 s an upward impulse that decays fast, so
    // the squirrel keeps leaping off its scurry line.
    this._hopT = (this._hopT ?? 0) - dt;
    if (this._hopT <= 0) {
      this._hopT = rand(0.9, 2.2);
      this._hopVy = -rand(70, 160);
    }
    this._hopVy = (this._hopVy ?? 0) * Math.exp(-3.2 * dt);
    this.y += this._hopVy * dt;
    // Twitchy lateral sprints: a fresh burst velocity every 0.25–0.7 s.
    this._sprintT = (this._sprintT ?? 0) - dt;
    if (this._sprintT <= 0) {
      this._sprintT = rand(0.25, 0.7);
      this._sprintVx = rand(-1, 1) * rand(0.5, 1.3) * s;
    }
    this.x += this._sprintVx * dt;
    // Twitchy wobble keeps the scurry alive between sprints.
    this.x += Math.sin(this.t * 9) * s * dt * 0.12;
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    // Light aimed shot (same contract as BatEnemy).
    this.fireAtPlayer(this.angleToPlayer(), 260, 0.85);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    const sprite = getSprite(SQUIRREL_SPRITE_KEY);
    if (sprite) {
      this._drawSprite(ctx, sprite, r);
    } else {
      this._drawProcedural(ctx, r);
    }

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }

  // v1.0.0 — pixel-art squirrel sprite. Aspect-preserving, centered on the
  // hitbox, nearest-neighbor. The PNG is a near-frontal upright squirrel
  // (head at the top, centered mass, bushy tail up the side — the same
  // upright orientation as the procedural squirrel), so it stays head-up
  // while the scurry carries it: a fast footfall bounce (t * 16) + a
  // twitchy wobble (t * 4.2) + a sprint stretch along the current burst
  // keep the blit alive between hops, and a type-color accent glow pass
  // adds depth under the crisp draw.
  _drawSprite(ctx, sprite, r) {
    const dims = getDims(SQUIRREL_SPRITE_KEY);
    const targetW = r * 2.4;
    const targetH = dims ? (targetW * dims.h) / dims.w : targetW;
    const dx = -targetW / 2, dy = -targetH / 2;
    // Scurry gait: fast footfall bounce (t * 16) + twitchy wobble (t * 4.2)
    // + a sprint stretch along the current burst direction.
    const bounce = Math.sin(this.t * 16);
    const wobble = Math.sin(this.t * 4.2) * 0.07;
    const stretch = 1 + (Math.abs(this._sprintVx ?? 0) / this.speed) * 0.10;
    ctx.save();
    ctx.translate(0, bounce * r * 0.06);
    ctx.rotate(wobble);
    ctx.scale(stretch, 1 + bounce * 0.04);
    ctx.imageSmoothingEnabled = false;
    // Accent glow pass (type color) under the crisp sprite
    ctx.globalAlpha = 0.30;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = r * 0.8;
    ctx.drawImage(sprite, dx, dy, targetW, targetH);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = this.flash > 0 ? 0.55 : 1;
    ctx.drawImage(sprite, dx, dy, targetW, targetH);
    ctx.restore();
  }

  // v1.0.0 procedural fallback (kept when the sprite is unavailable).
  _drawProcedural(ctx, r) {
    const bounce = Math.sin(this.t * 16) * 0.05;
    const wobble = Math.sin(this.t * 4.2) * 0.07;
    ctx.save();
    ctx.rotate(wobble);
    ctx.translate(0, bounce * r);

    // ─── BUSHY TAIL (big S-curve, behind the body) ───
    const tailGrad = ctx.createLinearGradient(-r * 0.8, -r * 0.2, r * 0.4, r * 0.5);
    tailGrad.addColorStop(0, '#c98a4b');
    tailGrad.addColorStop(1, this.color);
    ctx.fillStyle = tailGrad;
    ctx.beginPath();
    ctx.moveTo(r * 0.25, r * 0.35);
    ctx.quadraticCurveTo(r * 1.1, r * 0.2, r * 0.95, -r * 0.4);
    ctx.quadraticCurveTo(r * 0.85, -r * 0.95, r * 0.35, -r * 0.85);
    ctx.quadraticCurveTo(r * 0.7, -r * 0.55, r * 0.55, -r * 0.1);
    ctx.quadraticCurveTo(r * 0.45, r * 0.25, r * 0.25, r * 0.35);
    ctx.closePath();
    ctx.fill();

    // ─── BODY (rounded, centered) ───
    const bodyGrad = ctx.createRadialGradient(-r * 0.1, -r * 0.05, 0, 0, 0, r * 0.55);
    bodyGrad.addColorStop(0, '#c98a4b');
    bodyGrad.addColorStop(1, this.color);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.1, r * 0.42, r * 0.5, 0, 0, TAU);
    ctx.fill();
    // Belly (lighter patch)
    ctx.fillStyle = '#e8c9a0';
    ctx.beginPath();
    ctx.ellipse(-r * 0.05, r * 0.18, r * 0.24, r * 0.3, 0, 0, TAU);
    ctx.fill();

    // ─── HEAD (top, near-frontal) ───
    ctx.fillStyle = '#b5722f';
    ctx.beginPath();
    ctx.arc(0, -r * 0.42, r * 0.3, 0, TAU);
    ctx.fill();

    // Ears (perked, small)
    ctx.fillStyle = '#8a5222';
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.6);
    ctx.lineTo(-r * 0.3, -r * 0.9);
    ctx.lineTo(-r * 0.05, -r * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.2, -r * 0.6);
    ctx.lineTo(r * 0.3, -r * 0.9);
    ctx.lineTo(r * 0.05, -r * 0.68);
    ctx.closePath();
    ctx.fill();

    // Eyes (glowing)
    ctx.fillStyle = '#ffd54f';
    ctx.shadowColor = '#ffd54f';
    ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(-r * 0.12, -r * 0.45, r * 0.07, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.12, -r * 0.45, r * 0.07, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;

    // Nose
    ctx.fillStyle = '#4a2c12';
    ctx.beginPath(); ctx.arc(0, -r * 0.32, r * 0.05, 0, TAU); ctx.fill();

    // ─── FEET (small claws) ───
    ctx.strokeStyle = '#8a5222';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-r * 0.15, r * 0.55); ctx.lineTo(-r * 0.2, r * 0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.15, r * 0.55); ctx.lineTo(r * 0.2, r * 0.7); ctx.stroke();
    ctx.restore();
  }
}

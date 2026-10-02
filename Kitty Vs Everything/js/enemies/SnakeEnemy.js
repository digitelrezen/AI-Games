// Filename: SnakeEnemy.js
// Kitty Vs Everything — v1.2.0
// Snake: undulating serpent with segmented coils, a flickering forked tongue,
// and a glowing red eye. Moves in a smooth sine wave.
// v1.2.0: sprite swap — now draws the shared pixel-art PNG
//         (.assets/snake pixel_art.png, 714×713) through the AssetManager
//         pipeline (tools/import-assets.mjs → js/core/AssetSprites.js, key
//         "snake", normalized to 128×128). The full pixel-art shading,
//         depth, and charcoal/gold texture replace the flat green gradient:
//         aspect-preserving, centered on the hitbox, nearest-neighbor, with
//         a ground shadow, a slither bob/sway/tilt gait (phase-locked to the
//         movement sine), and a type-color accent glow pass. The classic
//         procedural serpent is kept as the null-sprite fallback per the
//         AssetManager contract (segmented coils, flickering forked tongue,
//         glowing red eyes, pale belly, tail tip).
export const VERSION = 'v1.2.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v1.2.0: shared PNG pipeline

const SNAKE_SPRITE_KEY = 'snake';

export default class SnakeEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt * 0.8;
    this.x = this.baseX + Math.sin(this.t * 3) * 100;
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    const a = this.angleToPlayer();
    this.fireAtPlayer(a, 240, 1);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    const sprite = getSprite(SNAKE_SPRITE_KEY);
    if (sprite) {
      this._drawSprite(ctx, sprite, r);
    } else {
      this._drawProcedural(ctx, r);
    }

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }

  // v1.2.0 — pixel-art snake sprite. Aspect-preserving, centered on the
  // hitbox, nearest-neighbor. The full pixel-art shading / depth /
  // charcoal-gold texture comes from the PNG itself (head up top, coil
  // filling the lower frame — same orientation as the procedural art);
  // the slither gait is a gentle lateral sway + vertical ripple + slight
  // body tilt (phase-locked to the movement sine, this.t * 3) plus a subtle
  // idle breathe. A soft ground shadow grounds the sprite, and a type-color
  // accent glow pass adds depth under the crisp blit.
  _drawSprite(ctx, sprite, r) {
    const dims = getDims(SNAKE_SPRITE_KEY);
    const targetW = r * 3.0;
    const targetH = dims ? (targetW * dims.h) / dims.w : targetW;
    // Slither gait (phase-locked to the movement sine, this.t * 3)
    const sway = Math.sin(this.t * 3) * r * 0.08;
    const bob = Math.sin(this.t * 6) * r * 0.05;
    const tilt = Math.sin(this.t * 3 + 0.6) * 0.07;
    const breathe = 1 + 0.02 * Math.sin(this.t * 6);
    ctx.save();
    // Ground shadow (depth cue under the coil)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, targetH * 0.41, targetW * 0.30, targetW * 0.07, 0, 0, TAU);
    ctx.fill();
    ctx.translate(sway, bob);
    ctx.rotate(tilt);
    ctx.scale(breathe, 1);
    ctx.imageSmoothingEnabled = false;
    const dx = -targetW / 2, dy = -targetH / 2;
    // Accent glow pass (type color) under the crisp sprite
    ctx.globalAlpha = 0.30;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = r * 0.8;
    ctx.drawImage(sprite, dx, dy, targetW, targetH);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.drawImage(sprite, dx, dy, targetW, targetH);
    ctx.restore();
  }

  // Classic procedural serpent (null-sprite fallback) — segmented coils,
  // flickering forked tongue, glowing red eyes, pale belly, tail tip.
  _drawProcedural(ctx, r) {
    // ─── BODY SEGMENTS (undulating coils) ───
    const segCount = 7;
    for (let i = 0; i < segCount; i++) {
      const phase = this.t * 5 + i * 0.9;
      const sx = Math.sin(phase) * r * 0.35;
      const sy = -r * 1.2 + i * r * 0.4;
      const segR = r * (0.32 - i * 0.02);
      const segGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, segR);
      segGrad.addColorStop(0, '#8ad48a');
      segGrad.addColorStop(0.6, this.color);
      segGrad.addColorStop(1, '#2a6a2a');
      ctx.fillStyle = segGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, segR, 0, TAU);
      ctx.fill();
      // Scale pattern on each segment
      ctx.strokeStyle = 'rgba(0, 60, 0, 0.25)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, segR * 0.6, 0.3, Math.PI - 0.3);
      ctx.stroke();
    }

    // ─── HEAD (triangular, at the front) ───
    const headX = Math.sin(this.t * 5) * r * 0.35;
    const headY = -r * 1.35;
    const headGrad = ctx.createRadialGradient(headX, headY, 0, headX, headY, r * 0.3);
    headGrad.addColorStop(0, '#a0e0a0');
    headGrad.addColorStop(1, this.color);
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.moveTo(headX, headY - r * 0.2);
    ctx.lineTo(headX + r * 0.25, headY + r * 0.1);
    ctx.lineTo(headX - r * 0.25, headY + r * 0.1);
    ctx.closePath();
    ctx.fill();

    // ─── EYES (glowing red, single visible) ───
    ctx.fillStyle = '#ff1744';
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(headX - r * 0.1, headY, r * 0.06, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headX + r * 0.1, headY, r * 0.06, 0, TAU);
    ctx.fill();
    // Slit pupils
    ctx.fillStyle = '#111';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.ellipse(headX - r * 0.1, headY, r * 0.015, r * 0.05, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(headX + r * 0.1, headY, r * 0.015, r * 0.05, 0, 0, TAU);
    ctx.fill();

    // ─── TONGUE (forked, flickering) ───
    const tongueOut = Math.max(0, Math.sin(this.t * 10)) * r * 0.35;
    if (tongueOut > 0.01) {
      ctx.strokeStyle = '#ff5252';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(headX, headY - r * 0.2);
      ctx.lineTo(headX, headY - r * 0.2 - tongueOut);
      ctx.stroke();
      // Fork
      ctx.beginPath();
      ctx.moveTo(headX, headY - r * 0.2 - tongueOut);
      ctx.lineTo(headX - r * 0.08, headY - r * 0.2 - tongueOut - r * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(headX, headY - r * 0.2 - tongueOut);
      ctx.lineTo(headX + r * 0.08, headY - r * 0.2 - tongueOut - r * 0.1);
      ctx.stroke();
    }

    // ─── BELLY (lighter underside) ───
    ctx.fillStyle = 'rgba(200, 255, 200, 0.15)';
    for (let i = 1; i < segCount - 1; i++) {
      const phase = this.t * 5 + i * 0.9;
      const sx = Math.sin(phase) * r * 0.35;
      const sy = -r * 1.2 + i * r * 0.4;
      ctx.beginPath();
      ctx.ellipse(sx, sy + r * 0.05, r * 0.15, r * 0.08, 0, 0, TAU);
      ctx.fill();
    }

    // ─── TAIL TIP (thin, pointed) ───
    const tailPhase = this.t * 5 + (segCount - 1) * 0.9;
    const tailX = Math.sin(tailPhase) * r * 0.35;
    const tailY = -r * 1.2 + (segCount - 1) * r * 0.4;
    ctx.strokeStyle = '#2a6a2a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(tailX + r * 0.1, tailY + r * 0.2);
    ctx.stroke();
  }
}

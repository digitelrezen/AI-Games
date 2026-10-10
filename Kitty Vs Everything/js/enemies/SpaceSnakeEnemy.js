// Filename: SpaceSnakeEnemy.js
// Kitty Vs Everything — v4.12.0
// Space Snake — the cosmic serpent of the RnM encounter PRE-WAVE (v4.12.0).
//
// EASTER-EGG-ONLY species: it never appears in the regular wave cycle
// (WaveManager.js filters it out of the species list — WAVE.SPECIES_COUNT
// stays 19). It is spawned by EasterEgg.spawnRnMPreWave into the playfield
// (across the top of the screen) a few seconds before the RnM interceptor
// crosses in — "Aw geez, Rick, is that a snake?" — setting the scene for
// the encounter. Stats come from ENEMY_TYPES.spacesnake (config/enemies.js)
// through EnemyBase — nothing hardcoded here (parameter standardization).
//
// Behavior: a slow serpentine drift — the body slithers laterally (sine,
// phase-locked to this.t) while the whole serpent sinks down the playfield
// (the classic off-screen cull retires it at the bottom edge, so the
// pre-wave clears itself). Attack: one aimed bolt at the player
// (fireAtPlayer, base speed 260).
//
// Art: the shared pixel-art PNG (.assets/SpaceSnake-256x256.png, 256×256)
// through the AssetManager pipeline (tools/import-assets.mjs →
// js/core/AssetSprites.js, key "spacesnake", normalized to 128×128).
// Aspect-preserving, centered on the hitbox, nearest-neighbor, with a
// slither gait (sway/bob/tilt phase-locked to the movement sine), a soft
// ground shadow, and a type-color accent glow pass. The procedural cosmic
// serpent is kept as the null-sprite fallback per the AssetManager contract
// (segmented coils in the #b388ff space palette, glowing cyan eye, star
// sparkles).
export const VERSION = 'v1.0.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v4.12.0: shared PNG pipeline

const SPACE_SNAKE_SPRITE_KEY = 'spacesnake';

export default class SpaceSnakeEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt * 0.7;
    this.x = this.baseX + Math.sin(this.t * 2.4) * 130;
    this.x = clamp(this.x, -60, this.game.W + 60);
  }

  attack() {
    const a = this.angleToPlayer();
    this.fireAtPlayer(a, 260, 1);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    const sprite = getSprite(SPACE_SNAKE_SPRITE_KEY);
    if (sprite) {
      this._drawSprite(ctx, sprite, r);
    } else {
      this._drawProcedural(ctx, r);
    }

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }

  // v4.12.0 — pixel-art space snake sprite. Aspect-preserving, centered on
  // the hitbox, nearest-neighbor. The cosmic serpent art (coiled body,
  // starlit glow) comes from the PNG itself; the slither gait is a gentle
  // lateral sway + vertical ripple + slight body tilt (phase-locked to the
  // movement sine, this.t * 2.4) plus a subtle idle breathe. A soft ground
  // shadow grounds the sprite, and a type-color accent glow pass adds depth
  // under the crisp blit.
  _drawSprite(ctx, sprite, r) {
    const dims = getDims(SPACE_SNAKE_SPRITE_KEY);
    const targetW = r * 3.0;
    const targetH = dims ? (targetW * dims.h) / dims.w : targetW;
    // Slither gait (phase-locked to the movement sine, this.t * 2.4)
    const sway = Math.sin(this.t * 2.4) * r * 0.08;
    const bob = Math.sin(this.t * 4.8) * r * 0.05;
    const tilt = Math.sin(this.t * 2.4 + 0.6) * 0.07;
    const breathe = 1 + 0.02 * Math.sin(this.t * 4.8);
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

  // v4.12.0 — procedural cosmic serpent (null-sprite fallback): segmented
  // coils in the space palette (#b388ff body, cyan glow), a triangular head
  // with a glowing cyan eye, a flickering forked tongue, a pale belly and a
  // thin tail tip — plus a few star sparkles for the "space" read.
  _drawProcedural(ctx, r) {
    const segCount = 7;
    // Star sparkles (ambient, behind the coil)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let s = 0; s < 5; s++) {
      const sx = Math.sin(this.t * 0.7 + s * 2.1) * r * 1.6;
      const sy = -r * 1.4 + s * r * 0.55;
      const tw = 0.5 + 0.5 * Math.sin(this.t * 3 + s * 1.7);
      ctx.globalAlpha = 0.25 + 0.45 * tw;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    // ─── BODY (segmented coils, space palette) ───
    for (let i = segCount - 1; i >= 0; i--) {
      const phase = this.t * 4.8 + i * 0.9;
      const sx = Math.sin(phase) * r * 0.35;
      const sy = -r * 1.2 + i * r * 0.4;
      const segR = r * (0.32 - i * 0.02);
      const segGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, segR);
      segGrad.addColorStop(0, '#d1b3ff');
      segGrad.addColorStop(0.6, this.color);
      segGrad.addColorStop(1, '#4a2a7a');
      ctx.fillStyle = segGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, segR, 0, TAU);
      ctx.fill();
      // Scale pattern on each segment
      ctx.strokeStyle = 'rgba(40, 10, 80, 0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, segR * 0.6, 0.3, Math.PI - 0.3);
      ctx.stroke();
    }

    // ─── HEAD (triangular, at the front) ───
    const headX = Math.sin(this.t * 4.8) * r * 0.35;
    const headY = -r * 1.35;
    const headGrad = ctx.createRadialGradient(headX, headY, 0, headX, headY, r * 0.3);
    headGrad.addColorStop(0, '#e6d5ff');
    headGrad.addColorStop(1, this.color);
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.moveTo(headX, headY - r * 0.2);
    ctx.lineTo(headX + r * 0.25, headY + r * 0.1);
    ctx.lineTo(headX - r * 0.25, headY + r * 0.1);
    ctx.closePath();
    ctx.fill();

    // ─── EYES (glowing cyan, cosmic) ───
    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff';
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
    const tongueOut = Math.max(0, Math.sin(this.t * 9)) * r * 0.35;
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
    ctx.fillStyle = 'rgba(230, 213, 255, 0.15)';
    for (let i = 1; i < segCount - 1; i++) {
      const phase = this.t * 4.8 + i * 0.9;
      const sx = Math.sin(phase) * r * 0.35;
      const sy = -r * 1.2 + i * r * 0.4;
      ctx.beginPath();
      ctx.ellipse(sx, sy + r * 0.05, r * 0.15, r * 0.08, 0, 0, TAU);
      ctx.fill();
    }

    // ─── TAIL TIP (thin, pointed) ───
    const tailPhase = this.t * 4.8 + (segCount - 1) * 0.9;
    const tailX = Math.sin(tailPhase) * r * 0.35;
    const tailY = -r * 1.2 + (segCount - 1) * r * 0.4;
    ctx.strokeStyle = '#4a2a7a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(tailX + r * 0.1, tailY + r * 0.2);
    ctx.stroke();
  }
}
// Filename: WolfEnemy.js
// Kitty Vs Everything — v1.2.0
// Wolf: mid-speed pack hunter with angular wolf-head silhouette, pointed ears,
// glowing red eyes, and a fur-textured body. Moves in coordinated pack sine.
// v1.2.0: sprite swap — now renders the shared pixel-art PNG
//         (.assets/Wolf-pixel-art.png, 675×708) through the AssetManager
//         pipeline (tools/import-assets.mjs → js/core/AssetSprites.js, key
//         "wolf", normalized to 122×128). Full pixel-art shading, depth and
//         fur texture replace the flat gray gradient: aspect-preserving,
//         centered on the hitbox, nearest-neighbor, with a ground shadow, a
//         pack-sine gait (lateral sway + bob + tilt, phase-locked to the
//         movement sine) and a type-color accent glow pass. The classic
//         procedural wolf is kept as the null-sprite fallback per the
//         AssetManager contract (angular body, pointed ears, glowing red
//         eyes, teeth, legs, fluffy tail).
export const VERSION = 'v1.2.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v1.2.0: shared PNG pipeline

const WOLF_SPRITE_KEY = 'wolf';

export default class WolfEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt * 0.8;
    this.x = this.baseX + Math.sin(this.t * 1.2 + this.baseX * 0.01) * 40;
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    const a = this.angleToPlayer();
    this.fireAtPlayer(a, 250, 1.1);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    const sprite = getSprite(WOLF_SPRITE_KEY);
    if (sprite) {
      this._drawSprite(ctx, sprite, r);
    } else {
      this._drawProcedural(ctx, r);
    }

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }

  // v1.2.0 — pixel-art wolf sprite. Aspect-preserving, centered on the
  // hitbox, nearest-neighbor. The full pixel-art shading / depth / fur
  // texture comes from the PNG itself (head up, body below — same
  // orientation as the procedural art); the pack gait is a gentle lateral
  // sway + vertical bob + slight tilt (phase-locked to the movement sine,
  // this.t * 1.2 + this.baseX * 0.01) plus subtle idle breathing. A soft
  // ground shadow grounds the sprite, and a type-color accent glow pass
  // adds depth under the crisp blit.
  _drawSprite(ctx, sprite, r) {
    const dims = getDims(WOLF_SPRITE_KEY);
    const targetW = r * 3.0;
    const targetH = dims ? (targetW * dims.h) / dims.w : targetW;
    // Pack gait (phase-locked to the movement sine, this.t * 1.2 + this.baseX * 0.01)
    const phase = this.t * 1.2 + this.baseX * 0.01;
    const sway = Math.sin(phase) * r * 0.08;
    const bob = Math.sin(phase * 2) * r * 0.05;
    const tilt = Math.sin(phase + 0.6) * 0.06;
    const breathe = 1 + 0.02 * Math.sin(phase * 2);
    ctx.save();
    // Ground shadow (depth cue under the body)
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

  // Classic procedural wolf (null-sprite fallback) — angular body, pointed
  // ears, glowing red eyes, teeth, legs, fluffy tail.
  _drawProcedural(ctx, r) {
    // ─── BODY (angular, tapered toward tail) ───
    const bodyGrad = ctx.createLinearGradient(0, -r * 0.5, 0, r * 0.8);
    bodyGrad.addColorStop(0, '#b0b8c4');
    bodyGrad.addColorStop(0.5, this.color);
    bodyGrad.addColorStop(1, '#5a6570');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.6);
    ctx.lineTo(r * 0.7, r * 0.2);
    ctx.lineTo(r * 0.5, r * 0.7);
    ctx.lineTo(-r * 0.5, r * 0.7);
    ctx.lineTo(-r * 0.7, r * 0.2);
    ctx.closePath();
    ctx.fill();

    // Fur texture strokes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.15, r * 0.1);
      ctx.lineTo(i * r * 0.15 + r * 0.05, r * 0.6);
      ctx.stroke();
    }

    // ─── HEAD (angular wolf snout) ───
    ctx.fillStyle = '#8a95a5';
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.1);
    ctx.lineTo(r * 0.5, -r * 0.5);
    ctx.lineTo(r * 0.3, -r * 0.3);
    ctx.lineTo(-r * 0.3, -r * 0.3);
    ctx.lineTo(-r * 0.5, -r * 0.5);
    ctx.closePath();
    ctx.fill();

    // Snout (pointed)
    ctx.fillStyle = '#6a7585';
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.3);
    ctx.lineTo(r * 0.15, -r * 1.0);
    ctx.lineTo(-r * 0.15, -r * 1.0);
    ctx.closePath();
    ctx.fill();
    // Nose
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(0, -r * 1.25, r * 0.06, 0, TAU);
    ctx.fill();

    // ─── EARS (tall, pointed, inner accent) ───
    // Left ear
    ctx.fillStyle = '#7a8595';
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, -r * 0.7);
    ctx.lineTo(-r * 0.6, -r * 1.4);
    ctx.lineTo(-r * 0.1, -r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d4a0a0';
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, -r * 0.8);
    ctx.lineTo(-r * 0.5, -r * 1.2);
    ctx.lineTo(-r * 0.15, -r * 0.85);
    ctx.closePath();
    ctx.fill();
    // Right ear
    ctx.fillStyle = '#7a8595';
    ctx.beginPath();
    ctx.moveTo(r * 0.35, -r * 0.7);
    ctx.lineTo(r * 0.6, -r * 1.4);
    ctx.lineTo(r * 0.1, -r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d4a0a0';
    ctx.beginPath();
    ctx.moveTo(r * 0.35, -r * 0.8);
    ctx.lineTo(r * 0.5, -r * 1.2);
    ctx.lineTo(r * 0.15, -r * 0.85);
    ctx.closePath();
    ctx.fill();

    // ─── EYES (glowing red, menacing) ───
    ctx.fillStyle = '#ff1744';
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, -r * 0.55, r * 0.1, r * 0.06, -0.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(r * 0.2, -r * 0.55, r * 0.1, r * 0.06, 0.2, 0, TAU);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.55, r * 0.03, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.55, r * 0.03, 0, TAU); ctx.fill();

    // ─── JAW / TEETH ───
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, -r * 0.3);
    ctx.lineTo(-r * 0.1, -r * 0.2);
    ctx.lineTo(-r * 0.05, -r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.05, -r * 0.3);
    ctx.lineTo(r * 0.1, -r * 0.2);
    ctx.lineTo(r * 0.15, -r * 0.3);
    ctx.closePath();
    ctx.fill();

    // ─── LEGS (angular, visible) ───
    ctx.strokeStyle = '#5a6570';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const legSwing = Math.sin(this.t * 5) * r * 0.1;
    ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.6); ctx.lineTo(-r * 0.5, r * 1.0 + legSwing); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.4, r * 0.6); ctx.lineTo(r * 0.5, r * 1.0 - legSwing); ctx.stroke();

    // ─── TAIL (fluffy, curved) ───
    ctx.strokeStyle = '#8a95a5';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.7);
    ctx.quadraticCurveTo(r * 0.3, r * 1.1, r * 0.1, r * 1.3);
    ctx.stroke();
    // Tail tip (white)
    ctx.fillStyle = '#e0e5ec';
    ctx.beginPath();
    ctx.arc(r * 0.1, r * 1.3, r * 0.12, 0, TAU);
    ctx.fill();
  }
}
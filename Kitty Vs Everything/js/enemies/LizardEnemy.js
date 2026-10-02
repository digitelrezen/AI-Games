// Filename: LizardEnemy.js
// Kitty Vs Everything — v1.2.0
// Lizard: slow tank that spits acid in 3-way spread. Segmented body with
// a scaly gradient, a flicking tongue, and a long coiled tail.
// v1.2.0: sprite swap — now draws the shared pixel-art PNG
//         (.assets/Lizard pixel_art.png, 507×656) through the AssetManager
//         pipeline (tools/import-assets.mjs → js/core/AssetSprites.js, key
//         "lizard", normalized to 99×128). The full pixel-art shading,
//         depth, and charcoal-scale texture replace the flat green gradient:
//         aspect-preserving, centered on the hitbox, nearest-neighbor, with
//         a ground shadow, a tank gait (sway/bob/tilt phase-locked to the
//         fixed-altitude hover bob, this.t), and a type-color accent glow
//         pass. The classic procedural lizard is kept as the null-sprite
//         fallback per the AssetManager contract (segmented scaly body,
//         broad flat head, slit yellow-green eyes, flicking forked tongue,
//         splayed legs, coiled tail, pale belly).
export const VERSION = 'v1.2.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v1.2.0: shared PNG pipeline

const LIZARD_SPRITE_KEY = 'lizard';

export default class LizardEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt * 0.4;
    if (this.y > 160) this.y = 160 + Math.sin(this.t) * 4;
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    // 3-way acid spit
    const a = this.angleToPlayer();
    this.fireAtPlayer(a - 0.3, 260, 1);
    this.fireAtPlayer(a, 260, 1);
    this.fireAtPlayer(a + 0.3, 260, 1);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    const sprite = getSprite(LIZARD_SPRITE_KEY);
    if (sprite) {
      this._drawSprite(ctx, sprite, r);
    } else {
      this._drawProcedural(ctx, r);
    }

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }

  // v1.2.0 — pixel-art lizard sprite. Aspect-preserving, centered on the
  // hitbox, nearest-neighbor. The full pixel-art shading / depth /
  // charcoal-scale texture comes from the PNG itself (head up top, body
  // and coiled tail filling the lower frame — same orientation as the
  // procedural art); the tank gait is a gentle lateral sway + vertical
  // bob + slight body tilt (phase-locked to the fixed-altitude hover bob,
  // this.t — move() pins the tank at y 160 + sin(this.t) * 4) plus a
  // subtle idle breathe. A soft ground shadow grounds the sprite, and a
  // type-color accent glow pass adds depth under the crisp blit.
  _drawSprite(ctx, sprite, r) {
    const dims = getDims(LIZARD_SPRITE_KEY);
    const targetW = r * 3.0;
    const targetH = dims ? (targetW * dims.h) / dims.w : targetW;
    // Tank gait (phase-locked to the fixed-altitude hover bob, this.t)
    const sway = Math.sin(this.t) * r * 0.07;
    const bob = Math.sin(this.t * 2) * r * 0.05;
    const tilt = Math.sin(this.t + 0.6) * 0.06;
    const breathe = 1 + 0.02 * Math.sin(this.t * 2);
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

  // Classic procedural lizard (null-sprite fallback) — segmented scaly
  // body, broad flat head, slit yellow-green eyes, flicking forked
  // tongue, splayed legs, coiled tail, pale belly.
  _drawProcedural(ctx, r) {
    // ─── TAIL (long, coiled segments) ───
    ctx.strokeStyle = '#3a8a3a';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.5, r * 0.3);
    const tailSway = Math.sin(this.t * 2) * r * 0.2;
    ctx.bezierCurveTo(
      r * 0.9, r * 0.5 + tailSway,
      r * 1.2, r * 0.2 - tailSway,
      r * 1.0, -r * 0.1 + tailSway * 0.5
    );
    ctx.stroke();
    // Tail tip
    ctx.fillStyle = '#2a6a2a';
    ctx.beginPath();
    ctx.arc(r * 1.0, -r * 0.1 + tailSway * 0.5, r * 0.1, 0, TAU);
    ctx.fill();

    // ─── BODY (segmented, scaly) ───
    for (let i = 0; i < 5; i++) {
      const segX = Math.sin(this.t * 4 + i * 0.8) * r * 0.15;
      const segY = -r * 0.3 + i * r * 0.35;
      const segR = r * (0.35 - i * 0.03);
      const segGrad = ctx.createRadialGradient(segX, segY, 0, segX, segY, segR);
      segGrad.addColorStop(0, '#6abf6a');
      segGrad.addColorStop(0.7, this.color);
      segGrad.addColorStop(1, '#2a6a2a');
      ctx.fillStyle = segGrad;
      ctx.beginPath();
      ctx.arc(segX, segY, segR, 0, TAU);
      ctx.fill();
      // Scale pattern
      ctx.strokeStyle = 'rgba(0, 80, 0, 0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(segX, segY, segR * 0.6, 0, TAU);
      ctx.stroke();
    }

    // ─── HEAD (broad, flat) ───
    const headGrad = ctx.createRadialGradient(0, -r * 0.9, 0, 0, -r * 0.9, r * 0.35);
    headGrad.addColorStop(0, '#8ad48a');
    headGrad.addColorStop(1, this.color);
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.9, r * 0.35, r * 0.25, 0, 0, TAU);
    ctx.fill();

    // ─── EYES (slit, yellow-green) ───
    ctx.fillStyle = '#cddc39';
    ctx.shadowColor = '#cddc39';
    ctx.shadowBlur = 3;
    ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.95, r * 0.08, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.95, r * 0.08, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, -r * 0.95, r * 0.02, r * 0.06, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(r * 0.2, -r * 0.95, r * 0.02, r * 0.06, 0, 0, TAU);
    ctx.fill();

    // ─── TONGUE (flicking, forked) ───
    const tongueOut = Math.max(0, Math.sin(this.t * 8)) * r * 0.4;
    if (tongueOut > 0.01) {
      ctx.strokeStyle = '#ff5252';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.1);
      ctx.lineTo(0, -r * 1.1 - tongueOut);
      ctx.stroke();
      // Fork
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.1 - tongueOut);
      ctx.lineTo(-r * 0.08, -r * 1.1 - tongueOut - r * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.1 - tongueOut);
      ctx.lineTo(r * 0.08, -r * 1.1 - tongueOut - r * 0.1);
      ctx.stroke();
    }

    // ─── LEGS (small, splayed) ───
    ctx.strokeStyle = '#3a8a3a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    // Left legs
    ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.1); ctx.lineTo(-r * 0.6, r * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.5); ctx.lineTo(-r * 0.6, r * 0.7); ctx.stroke();
    // Right legs
    ctx.beginPath(); ctx.moveTo(r * 0.3, r * 0.1); ctx.lineTo(r * 0.6, r * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.3, r * 0.5); ctx.lineTo(r * 0.6, r * 0.7); ctx.stroke();
    // Toes
    ctx.fillStyle = '#2a6a2a';
    ctx.beginPath(); ctx.arc(-r * 0.6, r * 0.3, r * 0.06, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-r * 0.6, r * 0.7, r * 0.06, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.6, r * 0.3, r * 0.06, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.6, r * 0.7, r * 0.06, 0, TAU); ctx.fill();

    // ─── BELLY (lighter) ───
    ctx.fillStyle = 'rgba(200, 255, 200, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.2, r * 0.25, r * 0.5, 0, 0, TAU);
    ctx.fill();
  }
}

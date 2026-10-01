// Filename: SpiderEnemy.js
// Kitty Vs Everything — v1.2.0
// Spider: slow web-spinner with 8 articulated legs, a multi-eyed face,
// and a patterned abdomen. Fires slow web projectiles.
// v1.2.0: sprite swap — now draws the shared pixel-art PNG
//         (.assets/Spider-pixel_art.png, 390×532) through the AssetManager
//         pipeline (tools/import-assets.mjs → js/core/AssetSprites.js, key
//         "spider", normalized to 94×128). The full pixel-art shading,
//         depth, and charcoal texture replace the flat gray silhouette:
//         aspect-preserving, centered on the hitbox, nearest-neighbor, with
//         a ground shadow, a crawler bob/sway/tilt gait, and a BRIGHT RED
//         HOURGLASS mark painted on the dorsal (back) section of the
//         abdomen. The classic procedural spider is kept as the null-sprite
//         fallback per the AssetManager contract (brown/charcoal shading +
//         red hourglass marking).
export const VERSION = 'v1.2.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v1.2.0: shared PNG pipeline

const SPIDER_SPRITE_KEY = 'spider';

export default class SpiderEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt * 0.5;
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    // Slow web shot
    const a = this.angleToPlayer();
    this.fireAtPlayer(a, 180, 1);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    const sprite = getSprite(SPIDER_SPRITE_KEY);
    if (sprite) {
      this._drawSprite(ctx, sprite, r);
    } else {
      this._drawProcedural(ctx, r);
    }

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }

  // v1.2.0 — pixel-art spider sprite. Aspect-preserving, centered on the
  // hitbox, nearest-neighbor. The full pixel-art shading / depth /
  // charcoal texture comes from the PNG itself; the crawler gait is a
  // gentle bob + lateral sway + slight body tilt (the leg-wave feel of the
  // old procedural art) plus a subtle idle breathe. A soft ground shadow
  // grounds the sprite, then a BRIGHT RED HOURGLASS mark is painted on the
  // dorsal (back) section of the abdomen after the crisp sprite pass.
  _drawSprite(ctx, sprite, r) {
    const dims = getDims(SPIDER_SPRITE_KEY);
    const targetW = r * 3.0;
    const targetH = dims ? (targetW * dims.h) / dims.w : targetW;
    // Crawler gait (phase-locked, like the old legWave)
    const bob = Math.sin(this.t * 5) * r * 0.05;
    const sway = Math.sin(this.t * 2.5) * r * 0.05;
    const tilt = Math.sin(this.t * 2.5) * 0.04;
    const breathe = 1 + 0.02 * Math.sin(this.t * 5);
    ctx.save();
    // Ground shadow (depth cue under the leg spread)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.8, r * 1.2, r * 0.35, 0, 0, TAU);
    ctx.fill();
    ctx.translate(sway, bob);
    ctx.rotate(tilt);
    ctx.scale(breathe, breathe);
    ctx.imageSmoothingEnabled = false;
    const dx = -targetW / 2, dy = -targetH / 2;
    // Accent glow pass (type color) under the crisp sprite
    ctx.globalAlpha = 0.30;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = r * 0.8;
    ctx.drawImage(sprite, dx, dy, targetW, targetH);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = this.flash > 0 ? 0.55 : 1;
    ctx.drawImage(sprite, dx, dy, targetW, targetH);
    // ─── BRIGHT RED HOURGLASS MARK (dorsal / back section) ───
    this._drawHourglassMark(ctx, targetW, targetH);
    ctx.restore();
  }

  // v1.2.0 — bright red hourglass dorsal marking: two triangles pinched
  // at the waist, a dark outline for contrast on the charcoal body, a
  // soft red glow, and a lighter red core highlight that pulses so the
  // mark reads as a vivid brand. The pixel-art body column sits slightly
  // above sprite center (opaque body ≈ 23%–59% of the art height, center
  // ≈ 41%), so the mark anchors at -9% of the drawn height.
  _drawHourglassMark(ctx, targetW, targetH) {
    const cw = targetW * 0.13;    // half-width of each triangle
    const chh = targetH * 0.14;   // half-height of the full hourglass
    const cy = -targetH * 0.09;   // dorsal anchor (body center ≈ 41% of art)
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-cw, cy - chh);
    ctx.lineTo(cw, cy - chh);
    ctx.lineTo(0, cy);
    ctx.lineTo(cw, cy + chh);
    ctx.lineTo(-cw, cy + chh);
    ctx.closePath();
    ctx.shadowColor = 'rgba(255, 32, 32, 0.9)';
    ctx.shadowBlur = targetW * (0.05 + 0.05 * pulse);
    ctx.fillStyle = `rgba(255, 34, 34, ${0.82 + 0.18 * pulse})`;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(60, 0, 0, 0.85)';
    ctx.lineWidth = Math.max(1, targetW * 0.015);
    ctx.stroke();
    // Bright core highlight (the "bright" of the mark)
    ctx.beginPath();
    ctx.moveTo(-cw * 0.55, cy - chh * 0.55);
    ctx.lineTo(cw * 0.55, cy - chh * 0.55);
    ctx.lineTo(0, cy);
    ctx.lineTo(cw * 0.55, cy + chh * 0.55);
    ctx.lineTo(-cw * 0.55, cy + chh * 0.55);
    ctx.closePath();
    ctx.fillStyle = `rgba(255, 102, 85, ${0.30 + 0.30 * pulse})`;
    ctx.fill();
    ctx.restore();
  }

  // v1.2.0 — classic procedural spider, kept as the null-sprite fallback.
  // Brown/charcoal shading + a bright red hourglass marking on the dorsal
  // (back) section of the abdomen.
  _drawProcedural(ctx, r) {
    const legWave = Math.sin(this.t * 4) * 0.1;

    // ─── LEGS (8, articulated, animated) ───
    ctx.strokeStyle = '#4a3f33';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const baseAngle = -0.8 + i * 0.5;
      const wave = legWave * (i % 2 === 0 ? 1 : -1);
      // Left legs
      const la = baseAngle + wave;
      const kx = Math.cos(la) * r * 0.5;
      const ky = Math.sin(la) * r * 0.3;
      const ex = Math.cos(la) * r * 1.3;
      const ey = Math.sin(la) * r * 1.1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, 0);
      ctx.lineTo(-r * 0.3 + kx, ky);
      ctx.lineTo(-r * 0.3 + ex, ey);
      ctx.stroke();
      // Right legs
      const ra = -baseAngle + wave;
      const rx = Math.cos(ra) * r * 0.5;
      const ry = Math.sin(ra) * r * 0.3;
      const rex = Math.cos(ra) * r * 1.3;
      const rey = Math.sin(ra) * r * 1.1;
      ctx.beginPath();
      ctx.moveTo(r * 0.3, 0);
      ctx.lineTo(r * 0.3 + rx, ry);
      ctx.lineTo(r * 0.3 + rex, rey);
      ctx.stroke();
    }

    // Leg joints (small circles)
    ctx.fillStyle = '#241f1a';
    for (let i = 0; i < 4; i++) {
      const baseAngle = -0.8 + i * 0.5;
      const wave = legWave * (i % 2 === 0 ? 1 : -1);
      const la = baseAngle + wave;
      ctx.beginPath();
      ctx.arc(-r * 0.3 + Math.cos(la) * r * 0.5, Math.sin(la) * r * 0.3, r * 0.05, 0, TAU);
      ctx.fill();
      const ra = -baseAngle + wave;
      ctx.beginPath();
      ctx.arc(r * 0.3 + Math.cos(ra) * r * 0.5, Math.sin(ra) * r * 0.3, r * 0.05, 0, TAU);
      ctx.fill();
    }

    // ─── ABDOMEN (large, patterned) — brown/charcoal shading ───
    const abdGrad = ctx.createRadialGradient(-r * 0.15, -r * 0.05, r * 0.1, 0, r * 0.2, r * 0.7);
    abdGrad.addColorStop(0, '#6b5a4a');
    abdGrad.addColorStop(0.55, '#4a4038');
    abdGrad.addColorStop(1, '#26221e');
    ctx.fillStyle = abdGrad;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.2, r * 0.55, r * 0.65, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 16, 12, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Abdomen pattern — BRIGHT RED HOURGLASS marking (dorsal/back section)
    const markPulse = 0.5 + 0.5 * Math.sin(this.t * 3);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, -r * 0.1);
    ctx.lineTo(r * 0.22, -r * 0.1);
    ctx.lineTo(0, r * 0.2);
    ctx.lineTo(r * 0.22, r * 0.5);
    ctx.lineTo(-r * 0.22, r * 0.5);
    ctx.closePath();
    ctx.shadowColor = 'rgba(255, 32, 32, 0.9)';
    ctx.shadowBlur = r * 0.25;
    ctx.fillStyle = `rgba(255, 34, 34, ${0.8 + 0.2 * markPulse})`;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(60, 0, 0, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    // Spots
    ctx.fillStyle = 'rgba(190, 150, 105, 0.28)';
    ctx.beginPath(); ctx.arc(-r * 0.2, r * 0.4, r * 0.06, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.2, r * 0.4, r * 0.06, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, r * 0.6, r * 0.05, 0, TAU); ctx.fill();

    // ─── CEPHALOTHORAX (front body, smaller) — brown/charcoal shading ───
    const headGrad = ctx.createRadialGradient(-r * 0.1, -r * 0.4, r * 0.05, 0, -r * 0.3, r * 0.5);
    headGrad.addColorStop(0, '#5a4a3a');
    headGrad.addColorStop(0.6, '#3d342c');
    headGrad.addColorStop(1, '#1e1a16');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.3, r * 0.4, r * 0.35, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 16, 12, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ─── EYES (8, clustered) ───
    const eyePositions = [
      [-0.15, -0.35, 0.07], [0.15, -0.35, 0.07],
      [-0.25, -0.25, 0.05], [0.25, -0.25, 0.05],
      [-0.1, -0.2, 0.05], [0.1, -0.2, 0.05],
      [-0.2, -0.45, 0.04], [0.2, -0.45, 0.04],
    ];
    for (const [ex, ey, er] of eyePositions) {
      // Eye glow
      ctx.fillStyle = 'rgba(255, 255, 200, 0.3)';
      ctx.beginPath();
      ctx.arc(ex * r, ey * r, er * r * 1.5, 0, TAU);
      ctx.fill();
      // Eye white
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex * r, ey * r, er * r, 0, TAU);
      ctx.fill();
      // Pupil
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(ex * r, ey * r, er * r * 0.5, 0, TAU);
      ctx.fill();
    }

    // ─── CHILICERAE (small fangs) ───
    ctx.fillStyle = '#241f1a';
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.5);
    ctx.lineTo(-r * 0.08, -r * 0.65);
    ctx.lineTo(-r * 0.12, -r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.5);
    ctx.lineTo(r * 0.08, -r * 0.65);
    ctx.lineTo(r * 0.12, -r * 0.6);
    ctx.closePath();
    ctx.fill();

    // ─── WEB THREADS (subtle, from legs) ───
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.15)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-r * 1.2, r * 0.8);
    ctx.lineTo(-r * 1.5, r * 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 1.2, r * 0.8);
    ctx.lineTo(r * 1.5, r * 1.2);
    ctx.stroke();
  }
}
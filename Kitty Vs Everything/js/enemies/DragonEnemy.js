// Filename: DragonEnemy.js
// Kitty Vs Everything — v1.2.0
// Dragon: heavy breather that hovers high and fires a 5-shot cone. Large
// membranous wings, horns, a fire-glowing throat, and a scaly body.
// v1.2.0: sprite swap — now draws the shared pixel-art PNG
//         (.assets/Dragon-pixel-art.png, 800×800) through the AssetManager
//         pipeline (tools/import-assets.mjs → js/core/AssetSprites.js, key
//         "dragon", normalized to 128×128). The full pixel-art shading,
//         depth, and scale texture replace the flat gradients:
//         aspect-preserving, centered on the hitbox, nearest-neighbor, with
//         a flight gait (sway/bob/tilt phase-locked to the horizontal weave
//         in move() and the wing-beat), a type-color accent glow pass, and
//         a pulsing fire-throat glow while breathing. The classic procedural
//         dragon is kept as the null-sprite fallback per the AssetManager
//         contract (membranous wings, scaly body, snouted head, curved
//         horns, slit eyes, fire throat, claws, spade-tipped tail).
export const VERSION = 'v1.2.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v1.2.0: shared PNG pipeline

const DRAGON_SPRITE_KEY = 'dragon';

export default class DragonEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt * 0.5;
    if (this.y > 140) this.y = 140;
    this.x = this.game.W / 2 + Math.sin(this.t * 0.8) * 200;
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    // 5-shot fire breath cone
    const a = this.angleToPlayer();
    for (let i = -2; i <= 2; i++) {
      this.fireAtPlayer(a + i * 0.14, 210, 0.7);
    }
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    const sprite = getSprite(DRAGON_SPRITE_KEY);
    if (sprite) {
      this._drawSprite(ctx, sprite, r);
    } else {
      this._drawProcedural(ctx, r);
    }

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }

  // v1.2.0 — pixel-art dragon sprite. Aspect-preserving, centered on the
  // hitbox, nearest-neighbor. The full pixel-art shading / depth / scale
  // texture comes from the PNG itself (head up top, wings spread — same
  // orientation as the procedural art); the flight gait is a lateral sway
  // + body tilt phase-locked to the horizontal weave in move()
  // (Math.sin(this.t * 0.8) * 200) plus a vertical bob + idle breathe
  // phase-locked to the wing-beat (Math.sin(this.t * 5)). A type-color
  // accent glow pass adds depth under the crisp blit, and a pulsing
  // fire-throat glow (same fireGlow pulse as the procedural throat) marks
  // the breath between fire cones.
  _drawSprite(ctx, sprite, r) {
    const dims = getDims(DRAGON_SPRITE_KEY);
    const targetW = r * 3.0;
    const targetH = dims ? (targetW * dims.h) / dims.w : targetW;
    // Flight gait — phase-locked to the weave (t * 0.8) and wing-beat (t * 5)
    const weave = Math.sin(this.t * 0.8);
    const flap = Math.sin(this.t * 5);
    const sway = weave * r * 0.15;
    const bob = flap * r * 0.08;
    const tilt = weave * 0.08;
    const breathe = 1 + 0.02 * flap;
    ctx.save();
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
    // Fire-throat glow while breathing (same pulse as the procedural throat)
    const fireGlow = 0.5 + 0.5 * Math.sin(this.t * 3);
    ctx.globalAlpha = 0.5 * fireGlow;
    ctx.shadowColor = '#ff6a00';
    ctx.shadowBlur = r * 0.5;
    ctx.fillStyle = 'rgba(255, 110, 20, 0.8)';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.6, r * 0.22, r * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Classic procedural dragon (null-sprite fallback) — large membranous
  // wings, scaly body, snouted head, curved horns, slit eyes, fire throat,
  // claws, spade-tipped tail.
  _drawProcedural(ctx, r) {
    const wing = Math.sin(this.t * 5) * 0.4;
    const fireGlow = 0.5 + 0.5 * Math.sin(this.t * 3);

    // ─── WINGS (large, membranous) ───
    // Left wing
    ctx.save();
    ctx.rotate(-0.4 + wing);
    const lwGrad = ctx.createLinearGradient(-r * 1.5, 0, 0, 0);
    lwGrad.addColorStop(0, 'rgba(100, 20, 20, 0.8)');
    lwGrad.addColorStop(1, this.color);
    ctx.fillStyle = lwGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-r * 1.4, -r * 0.6);
    ctx.lineTo(-r * 1.2, -r * 0.1);
    ctx.lineTo(-r * 0.8, r * 0.2);
    ctx.lineTo(-r * 0.4, r * 0.1);
    ctx.closePath();
    ctx.fill();
    // Wing membrane lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 1.2, -r * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 1.0, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 0.7, r * 0.15); ctx.stroke();
    // Wing bone (thick)
    ctx.strokeStyle = '#5a1a1a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 1.3, -r * 0.5); ctx.stroke();
    ctx.restore();

    // Right wing
    ctx.save();
    ctx.rotate(0.4 - wing);
    const rwGrad = ctx.createLinearGradient(0, 0, r * 1.5, 0);
    rwGrad.addColorStop(0, this.color);
    rwGrad.addColorStop(1, 'rgba(100, 20, 20, 0.8)');
    ctx.fillStyle = rwGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 1.4, -r * 0.6);
    ctx.lineTo(r * 1.2, -r * 0.1);
    ctx.lineTo(r * 0.8, r * 0.2);
    ctx.lineTo(r * 0.4, r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.2, -r * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.0, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.7, r * 0.15); ctx.stroke();
    ctx.strokeStyle = '#5a1a1a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.3, -r * 0.5); ctx.stroke();
    ctx.restore();

    // ─── BODY (scaly, elongated) ───
    const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.9);
    bodyGrad.addColorStop(0, '#ff6a4a');
    bodyGrad.addColorStop(0.4, this.color);
    bodyGrad.addColorStop(1, '#6a1a1a');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.5, r * 0.85, 0, 0, TAU);
    ctx.fill();

    // Scale pattern (overlapping arcs)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 0.8;
    for (let row = -2; row <= 2; row++) {
      for (let col = -1; col <= 1; col++) {
        ctx.beginPath();
        ctx.arc(col * r * 0.2 + (row % 2) * r * 0.1, row * r * 0.25, r * 0.12, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
    }

    // ─── BELLY (lighter, segmented) ───
    ctx.fillStyle = 'rgba(255, 200, 150, 0.3)';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(0, i * r * 0.2, r * 0.3 - Math.abs(i) * r * 0.03, r * 0.12, 0, 0, TAU);
      ctx.fill();
    }

    // ─── HEAD (broad, with snout) ───
    ctx.fillStyle = '#b03030';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.85, r * 0.35, r * 0.3, 0, 0, TAU);
    ctx.fill();
    // Snout
    ctx.fillStyle = '#8a2020';
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.05, r * 0.2, r * 0.15, 0, 0, TAU);
    ctx.fill();
    // Nostrils
    ctx.fillStyle = '#3a0a0a';
    ctx.beginPath(); ctx.arc(-r * 0.08, -r * 1.05, r * 0.04, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.08, -r * 1.05, r * 0.04, 0, TAU); ctx.fill();

    // ─── HORNS (curved, bone-colored) ───
    ctx.fillStyle = '#d4c4a0';
    // Left horn
    ctx.beginPath();
    ctx.moveTo(-r * 0.25, -r * 1.0);
    ctx.quadraticCurveTo(-r * 0.5, -r * 1.5, -r * 0.3, -r * 1.6);
    ctx.quadraticCurveTo(-r * 0.2, -r * 1.4, -r * 0.15, -r * 1.05);
    ctx.closePath();
    ctx.fill();
    // Right horn
    ctx.beginPath();
    ctx.moveTo(r * 0.25, -r * 1.0);
    ctx.quadraticCurveTo(r * 0.5, -r * 1.5, r * 0.3, -r * 1.6);
    ctx.quadraticCurveTo(r * 0.2, -r * 1.4, r * 0.15, -r * 1.05);
    ctx.closePath();
    ctx.fill();

    // ─── EYES (glowing, slit) ───
    ctx.fillStyle = '#ffd54f';
    ctx.shadowColor = '#ffd54f';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.ellipse(-r * 0.18, -r * 0.85, r * 0.08, r * 0.05, -0.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(r * 0.18, -r * 0.85, r * 0.08, r * 0.05, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.ellipse(-r * 0.18, -r * 0.85, r * 0.02, r * 0.04, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(r * 0.18, -r * 0.85, r * 0.02, r * 0.04, 0, 0, TAU);
    ctx.fill();

    // ─── FIRE THROAT GLOW ───
    ctx.fillStyle = `rgba(255, 100, 0, ${0.3 + fireGlow * 0.4})`;
    ctx.shadowColor = '#ff6a00';
    ctx.shadowBlur = 10 * fireGlow;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.6, r * 0.2, r * 0.15, 0, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ─── CLAWS (visible on body sides) ───
    ctx.strokeStyle = '#d4c4a0';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.3); ctx.lineTo(-r * 0.55, r * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.45); ctx.lineTo(-r * 0.55, r * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.4, r * 0.3); ctx.lineTo(r * 0.55, r * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.4, r * 0.45); ctx.lineTo(r * 0.55, r * 0.55); ctx.stroke();

    // ─── TAIL (long, with spade tip) ───
    ctx.strokeStyle = '#8a2020';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.8);
    const tailSway = Math.sin(this.t * 2) * r * 0.2;
    ctx.quadraticCurveTo(r * 0.3 + tailSway, r * 1.2, r * 0.1 + tailSway, r * 1.4);
    ctx.stroke();
    // Spade tip
    ctx.fillStyle = '#d4c4a0';
    ctx.beginPath();
    ctx.moveTo(r * 0.1 + tailSway, r * 1.4);
    ctx.lineTo(r * 0.0 + tailSway, r * 1.55);
    ctx.lineTo(r * 0.2 + tailSway, r * 1.55);
    ctx.closePath();
    ctx.fill();
  }
}
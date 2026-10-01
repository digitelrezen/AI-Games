// Filename: BeetleEnemy.js
// Kitty Vs Everything — v1.2.0
// Beetle: slow armored tank that charges in bursts. Heavy chitin shell with
// iridescent gradient, six articulated legs, and a glowing mandible core.
// v1.2.0: sprite swap — now draws the shared pixel-art PNG
//         (.assets/Beetle-new-pixel-art.png, 665×693) through the
//         AssetManager pipeline (tools/import-assets.mjs →
//         js/core/AssetSprites.js, key "beetle", normalized to 123×128).
//         The armored shell is drawn aspect-preserving, centered on the
//         hitbox, nearest-neighbor, with a charge-lunge scale pulse that
//         tracks the tank's periodic burst (move() lunges every 2.4 s) +
//         an accent glow pass. The classic procedural beetle is kept as
//         the null-sprite fallback per the AssetManager contract.
export const VERSION = 'v1.2.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp, angleTo } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v1.2.0: shared PNG pipeline

const BEETLE_SPRITE_KEY = 'beetle';

export default class BeetleEnemy extends EnemyBase {
  move(dt, slowMul) {
    // Slow armored drift with a periodic charge lunge toward the player.
    this.y += this.speed * 0.35 * dt * slowMul;
    const phase = this.t * 1.2;
    this.x += Math.sin(phase) * this.speed * 0.25 * dt * slowMul;

    // Charge burst: every 2.4s lunge toward the player.
    if (this.t % 2.4 < dt) {
      const dx = this.game.player.x - this.x;
      const dy = this.game.player.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.x += (dx / d) * this.speed * 0.8 * dt * slowMul;
      this.y += (dy / d) * this.speed * 0.5 * dt * slowMul;
    }

    this.x = clamp(this.x, this.radius, this.game.W - this.radius);
  }

  attack() {
    // Armored shell cannon: 3 heavy aimed shots in a tight fan.
    const dx = this.game.player.x - this.x;
    const dy = this.game.player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    for (let i = -1; i <= 1; i++) {
      const a = Math.atan2(dy, dx) + i * 0.22;
      this.game.bullets.push({
        x: this.x, y: this.y,
        vx: Math.cos(a) * 130, vy: Math.sin(a) * 130,
        r: 5, damage: this.damage, color: this.accent,
      });
    }
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    const sprite = getSprite(BEETLE_SPRITE_KEY);
    if (sprite) {
      this._drawSprite(ctx, sprite, r);
    } else {
      this._drawProcedural(ctx, r);
    }

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }

  // v1.2.0 — pixel-art armored tank sprite. Aspect-preserving, centered on
  // the hitbox, nearest-neighbor. The charge-lunge pulse swells in the
  // wind-up just before the 2.4 s burst (the same phase the lunge trigger
  // in move() watches), so the shell visibly "punches" with each charge,
  // plus a subtle idle breathe; accent glow pass in the type color.
  _drawSprite(ctx, sprite, r) {
    const dims = getDims(BEETLE_SPRITE_KEY);
    const targetW = r * 3.0;
    const targetH = dims ? (targetW * dims.h) / dims.w : targetW;
    const phase = (this.t % 2.4) / 2.4;
    const swell = phase > 0.8 ? (phase - 0.8) / 0.2 : 0; // 0 → 1 wind-up
    const breathe = 1 + 0.03 * Math.sin(this.t * 2);
    const s = (1 + 0.10 * swell) * breathe;
    ctx.save();
    ctx.scale(s, s);
    ctx.imageSmoothingEnabled = false;
    const dx = -targetW / 2, dy = -targetH / 2;
    ctx.globalAlpha = 0.30;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = r * 0.8;
    ctx.drawImage(sprite, dx, dy, targetW, targetH);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = this.flash > 0 ? 0.55 : 1;
    ctx.drawImage(sprite, dx, dy, targetW, targetH);
    ctx.restore();
  }

  // v1.2.0 — classic procedural beetle, kept as the null-sprite fallback.
  _drawProcedural(ctx, r) {
    const t = this.t;
    // Six articulated legs (3 per side) with walking cycle.
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 3; i++) {
        const baseAng = side * (0.9 + i * 0.5);
        const walk = Math.sin(t * 6 + i * 2.1 + (side > 0 ? Math.PI : 0)) * 0.25;
        const a = baseAng + walk;
        const hipX = Math.cos(baseAng) * r * 0.55;
        const hipY = Math.sin(baseAng) * r * 0.55;
        const kneeX = hipX + Math.cos(a) * r * 0.7;
        const kneeY = hipY + Math.sin(a) * r * 0.7;
        const footX = kneeX + Math.cos(a + 0.6 * side) * r * 0.6;
        const footY = kneeY + Math.sin(a + 0.6 * side) * r * 0.6;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(footX, footY);
        ctx.stroke();
        // Joint dots
        ctx.fillStyle = this.accent;
        ctx.beginPath();
        ctx.arc(kneeX, kneeY, 2.5, 0, TAU);
        ctx.fill();
      }
    }

    // Heavy chitin shell (elytra) — wide oval with iridescent gradient.
    const shellGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r * 1.2);
    shellGrad.addColorStop(0, this.accent);
    shellGrad.addColorStop(0.5, this.color);
    shellGrad.addColorStop(1, '#2d1b4e');
    ctx.fillStyle = shellGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.95, r * 1.15, 0, 0, TAU);
    ctx.fill();

    // Elytra split line (beetle wing-case seam).
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05);
    ctx.lineTo(0, r * 0.95);
    ctx.stroke();

    // Shell ridges (concentric armor plates).
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.95 * (1 - i * 0.18), r * 1.15 * (1 - i * 0.18), 0, 0, TAU);
      ctx.stroke();
    }

    // Pronotum (front plate) — smaller rounded section ahead of elytra.
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.05, r * 0.6, r * 0.45, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Head + mandibles.
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, -r * 1.45, r * 0.38, 0, TAU);
    ctx.fill();

    // Mandibles — curved pincers.
    const mandOpen = 0.3 + Math.sin(t * 3) * 0.15;
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.2, -r * 1.55);
      ctx.quadraticCurveTo(
        side * r * 0.55, -r * (1.55 + mandOpen),
        side * r * 0.3, -r * (1.75 + mandOpen * 0.8)
      );
      ctx.stroke();
    }

    // Eyes — glowing dots.
    const eyeGlow = 0.6 + Math.sin(t * 4) * 0.3;
    ctx.fillStyle = this.accent;
    ctx.globalAlpha = eyeGlow;
    ctx.beginPath();
    ctx.arc(-r * 0.18, -r * 1.5, r * 0.1, 0, TAU);
    ctx.arc(r * 0.18, -r * 1.5, r * 0.1, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

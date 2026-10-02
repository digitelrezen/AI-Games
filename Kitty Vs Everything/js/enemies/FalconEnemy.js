// Filename: FalconEnemy.js
// Kitty Vs Everything — v1.2.0
// Falcon: fast diving raptor with swept wings, sharp beak, and a tail fan.
// Hovers high then dives at the player in a straight line.
// v1.2.0: sprite swap — now draws the shared pixel-art PNG
//         (.assets/Falcon pixel_art.png, 718×718) through the AssetManager
//         pipeline (tools/import-assets.mjs → js/core/AssetSprites.js, key
//         "falcon", normalized to 128×128). The full pixel-art feather
//         shading, depth, and plumage texture replace the flat gradients:
//         aspect-preserving, centered on the hitbox, nearest-neighbor, with
//         a beak-lead dive rotation (the art faces up — head/beak at the
//         top, same orientation as the procedural falcon — so the beak
//         leads the dive: the heading eases toward angleToPlayer and the
//         blit rotates by heading + PI/2), a wing-beat oscillation
//         phase-locked to the procedural flap (t * 6), a hover bob, and a
//         type-color accent glow pass. The classic procedural falcon is
//         kept as the null-sprite fallback per the AssetManager contract
//         (swept layered wings, tapered body, hooked beak, tail fan,
//         talons).
export const VERSION = 'v1.2.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp, angleTo } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v1.2.0: shared PNG pipeline

const FALCON_SPRITE_KEY = 'falcon';

export default class FalconEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    if (this.y < 120) {
      this.y += s * dt;
    } else {
      const p = this.game.player;
      if (p && !p.dead) {
        const a = angleTo(this.x, this.y, p.x, p.y);
        this.x += Math.cos(a) * s * dt * 1.5;
        this.y += Math.sin(a) * s * dt * 1.5;
      }
    }
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    const a = this.angleToPlayer();
    this.fireAtPlayer(a, 280, 1);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    const sprite = getSprite(FALCON_SPRITE_KEY);
    if (sprite) {
      this._drawSprite(ctx, sprite, r);
    } else {
      this._drawProcedural(ctx, r);
    }

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }

  // v1.2.0 — pixel-art falcon sprite. Aspect-preserving, centered on the
  // hitbox, nearest-neighbor. The PNG faces up (head/beak at the top,
  // wings spread, tail below — same orientation as the procedural falcon),
  // so the beak leads the dive: the heading eases toward the dive vector
  // (straight down while hovering above y = 120, angleToPlayer once the
  // dive starts — the same vector move() flies along) and the blit rotates
  // by heading + PI/2. A wing-beat oscillation (t * 6, the procedural
  // flap's phase) + a hover bob keep the blit alive between dives, and a
  // type-color accent glow pass adds depth under the crisp draw.
  _drawSprite(ctx, sprite, r) {
    const dims = getDims(FALCON_SPRITE_KEY);
    const targetW = r * 3.0;
    const targetH = dims ? (targetW * dims.h) / dims.w : targetW;
    const dx = -targetW / 2, dy = -targetH / 2;
    // Beak-lead dive heading (art faces up → rotate by heading + PI/2)
    const p = this.game.player;
    const diving = this.y >= 120 && p && !p.dead;
    const target = diving ? angleTo(this.x, this.y, p.x, p.y) : Math.PI / 2;
    if (this._heading === undefined) this._heading = target;
    let dh = target - this._heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh)); // shortest arc
    this._heading += dh * 0.18;
    // Wing-beat (t * 6 = procedural flap phase) + hover bob
    const flap = Math.sin(this.t * 6);
    const bob = Math.sin(this.t * 3) * r * 0.05;
    const rot = this._heading + Math.PI / 2 + flap * 0.06;
    ctx.save();
    ctx.translate(0, bob);
    ctx.rotate(rot);
    ctx.imageSmoothingEnabled = false;
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

  // Classic procedural falcon (null-sprite fallback) — swept layered
  // wings, tapered body, hooked beak, sharp eyes, spread tail fan, talons.
  _drawProcedural(ctx, r) {
    const wing = Math.sin(this.t * 6) * 0.4;

    ctx.save();
    ctx.rotate(wing * 0.15);

    // Wings — swept, layered
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * (0.5 + wing));
      const lwGrad = ctx.createLinearGradient(0, 0, side * r * 2.2, 0);
      lwGrad.addColorStop(0, this.accent);
      lwGrad.addColorStop(1, this.color);
      ctx.fillStyle = lwGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(side * r * 2.2, -r * 0.6);
      ctx.lineTo(side * r * 1.8, r * 0.3);
      ctx.lineTo(side * r * 0.5, r * 0.2);
      ctx.closePath();
      ctx.fill();
      // Wing feathers
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const fx = side * r * (0.6 + i * 0.45);
        ctx.beginPath();
        ctx.moveTo(fx, 0);
        ctx.lineTo(fx + side * r * 0.2, r * 0.25);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Body — tapered
    const bodyGrad = ctx.createLinearGradient(0, -r, 0, r);
    bodyGrad.addColorStop(0, this.accent);
    bodyGrad.addColorStop(1, this.color);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.55, r * 1.0, 0, 0, TAU);
    ctx.fill();

    // Tail fan
    const tailSpread = Math.sin(this.t * 4) * 0.2;
    ctx.fillStyle = this.color;
    for (let i = -2; i <= 2; i++) {
      ctx.save();
      ctx.translate(0, r * 0.8);
      ctx.rotate(i * (0.25 + tailSpread * 0.3));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-r * 0.15, r * 0.9);
      ctx.lineTo(r * 0.15, r * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Head
    const headGrad = ctx.createRadialGradient(0, -r * 0.75, 0, 0, -r * 0.75, r * 0.5);
    headGrad.addColorStop(0, this.accent);
    headGrad.addColorStop(1, this.color);
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, -r * 0.75, r * 0.45, 0, TAU);
    ctx.fill();

    // Beak — hooked
    ctx.fillStyle = '#e8a020';
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, -r * 0.9);
    ctx.lineTo(0, -r * 1.2);
    ctx.lineTo(r * 0.15, -r * 0.9);
    ctx.closePath();
    ctx.fill();

    // Eyes — sharp
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#ffe040';
      ctx.beginPath();
      ctx.arc(side * r * 0.22, -r * 0.8, r * 0.1, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(side * r * 0.22, -r * 0.8, r * 0.05, 0, TAU);
      ctx.fill();
    }

    // Talons
    ctx.strokeStyle = '#e8a020';
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.3, r * 0.5);
      ctx.lineTo(side * r * 0.4, r * 0.8);
      ctx.stroke();
    }

    ctx.restore();
  }
}

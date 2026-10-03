// Filename: BatEnemy.js
// Kitty Vs Everything — v1.2.0
// Bat: erratic flutterer with membrane wings (scalloped edges), fangs,
// and a small body. Moves in unpredictable random jitter.
// v1.2.0: sprite swap — now draws the shared pixel-art PNG
//         (.assets/Bat-pixel-art.png, 679×367) through the AssetManager
//         pipeline (tools/import-assets.mjs → js/core/AssetSprites.js, key
//         "bat", normalized to 128×69). The full pixel-art charcoal wing
//         shading, membrane texture, fanged head, and claw feet replace the
//         flat gradients: aspect-preserving, centered on the hitbox,
//         nearest-neighbor, with the art upright (head/ears at the top,
//         wings spread wide, feet below — the same front-view orientation
//         as the procedural bat), a wing-beat squash phase-locked to the
//         procedural flap (t * 14), a flutter wobble + hover bob, and a
//         type-color accent glow pass. The classic procedural bat is kept
//         as the null-sprite fallback per the AssetManager contract
//         (scalloped membrane wings + wing bones, red glowing eyes, fangs,
//         tiny claw feet).
export const VERSION = 'v1.2.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v1.2.0: shared PNG pipeline

const BAT_SPRITE_KEY = 'bat';

export default class BatEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt * 0.7;
    this.x += (Math.random() - 0.5) * s * dt * 3;
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    const a = this.angleToPlayer();
    this.fireAtPlayer(a, 240, 0.9);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    const sprite = getSprite(BAT_SPRITE_KEY);
    if (sprite) {
      this._drawSprite(ctx, sprite, r);
    } else {
      this._drawProcedural(ctx, r);
    }

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }

  // v1.2.0 — pixel-art bat sprite. Aspect-preserving, centered on the
  // hitbox, nearest-neighbor. The PNG is a front-view bat (head/ears at
  // the top, wings spread wide, claw feet below — the same upright
  // orientation as the procedural bat), so it stays head-up while the
  // erratic jitter carries it: a wing-beat squash (t * 14, the
  // procedural flap's phase) compresses/stretches the blit vertically
  // like the membrane wings flapping, a small flutter wobble + hover bob
  // keep the blit alive between jitters, and a type-color accent glow
  // pass adds depth under the crisp draw.
  _drawSprite(ctx, sprite, r) {
    const dims = getDims(BAT_SPRITE_KEY);
    const targetW = r * 2.6;
    const targetH = dims ? (targetW * dims.h) / dims.w : targetW;
    const dx = -targetW / 2, dy = -targetH / 2;
    // Wing-beat (t * 14 = procedural flap phase) + hover bob
    const flap = Math.sin(this.t * 14);
    const bob = Math.sin(this.t * 3);
    const wing = 1 + flap * 0.10;
    ctx.save();
    ctx.translate(0, bob * r * 0.05);
    ctx.rotate(flap * 0.06);
    ctx.scale(1, wing);
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

  // Classic procedural bat (null-sprite fallback) — scalloped membrane
  // wings with wing bones, small round body, head with pointed ears, red
  // glowing eyes, fangs, tiny claw feet.
  _drawProcedural(ctx, r) {
    const flap = Math.sin(this.t * 14) * 0.5;

    // ─── WINGS (membrane with scalloped edges) ───
    // Left wing
    ctx.save();
    ctx.rotate(flap);
    const lwGrad = ctx.createLinearGradient(-r * 1.5, 0, 0, 0);
    lwGrad.addColorStop(0, 'rgba(60, 60, 90, 0.8)');
    lwGrad.addColorStop(1, this.color);
    ctx.fillStyle = lwGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-r * 0.5, -r * 0.6, -r * 0.9, -r * 0.7);
    // Scalloped edge
    ctx.quadraticCurveTo(-r * 1.1, -r * 0.4, -r * 1.2, -r * 0.1);
    ctx.quadraticCurveTo(-r * 1.1, r * 0.1, -r * 1.0, r * 0.3);
    ctx.quadraticCurveTo(-r * 0.7, r * 0.4, -r * 0.4, r * 0.3);
    ctx.quadraticCurveTo(-r * 0.2, r * 0.2, 0, r * 0.3);
    ctx.closePath();
    ctx.fill();
    // Wing bones
    ctx.strokeStyle = 'rgba(20, 20, 40, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 0.9, -r * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 1.1, -r * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 0.9, r * 0.2); ctx.stroke();
    ctx.restore();

    // Right wing
    ctx.save();
    ctx.rotate(-flap);
    const rwGrad = ctx.createLinearGradient(0, 0, r * 1.5, 0);
    rwGrad.addColorStop(0, this.color);
    rwGrad.addColorStop(1, 'rgba(60, 60, 90, 0.8)');
    ctx.fillStyle = rwGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.5, -r * 0.6, r * 0.9, -r * 0.7);
    ctx.quadraticCurveTo(r * 1.1, -r * 0.4, r * 1.2, -r * 0.1);
    ctx.quadraticCurveTo(r * 1.1, r * 0.1, r * 1.0, r * 0.3);
    ctx.quadraticCurveTo(r * 0.7, r * 0.4, r * 0.4, r * 0.3);
    ctx.quadraticCurveTo(r * 0.2, r * 0.2, 0, r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 20, 40, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.9, -r * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.1, -r * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.9, r * 0.2); ctx.stroke();
    ctx.restore();

    // ─── BODY (small, round) ───
    const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.4);
    bodyGrad.addColorStop(0, '#7a7a9a');
    bodyGrad.addColorStop(1, this.color);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.35, 0, TAU);
    ctx.fill();

    // ─── HEAD ───
    ctx.fillStyle = '#5d5d7a';
    ctx.beginPath();
    ctx.arc(0, -r * 0.3, r * 0.22, 0, TAU);
    ctx.fill();

    // Ears (pointed, small)
    ctx.fillStyle = '#4a4a6a';
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, -r * 0.45);
    ctx.lineTo(-r * 0.25, -r * 0.75);
    ctx.lineTo(-r * 0.05, -r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.15, -r * 0.45);
    ctx.lineTo(r * 0.25, -r * 0.75);
    ctx.lineTo(r * 0.05, -r * 0.5);
    ctx.closePath();
    ctx.fill();

    // Eyes (red, glowing)
    ctx.fillStyle = '#ff1744';
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(-r * 0.1, -r * 0.32, r * 0.06, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.1, -r * 0.32, r * 0.06, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;

    // Fangs (two small triangles)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-r * 0.06, -r * 0.1);
    ctx.lineTo(-r * 0.04, r * 0.0);
    ctx.lineTo(-r * 0.08, r * 0.0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.06, -r * 0.1);
    ctx.lineTo(r * 0.04, r * 0.0);
    ctx.lineTo(r * 0.08, r * 0.0);
    ctx.closePath();
    ctx.fill();

    // ─── FEET (tiny claws) ───
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-r * 0.15, r * 0.3); ctx.lineTo(-r * 0.2, r * 0.45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.15, r * 0.3); ctx.lineTo(r * 0.2, r * 0.45); ctx.stroke();
  }
}

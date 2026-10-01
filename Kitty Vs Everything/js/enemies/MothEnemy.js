// Filename: MothEnemy.js
// Kitty Vs Everything — v1.0.0
// Moth: erratic fluttering night-flyer with a fuzzy body, four broad dusty
// wings, and clubbed antennae. Drifts down on a double-sine flutter path
// with sudden darts, fires light aimed shots.
// v1.0.0: sprite — top-down pixel-art PNG (.assets/Moth-New-pixel-art.png,
//         795×490, viewed from above) through the AssetManager pipeline
//         (tools/import-assets.mjs → js/core/AssetSprites.js, key "moth",
//         normalized to 128×79). Because the art is a top-down view there
//         is NO face-the-player mirror (unlike the side-profile Wasp);
//         instead a fast procedural OVERHEAD animation sells the flutter —
//         a sinusoidal vertical scale (scaleY) + a subtle wing-fold (scaleX)
//         + a quicker rotation wobble for the erratic drift/turn.
//         Nearest-neighbor, aspect-preserving, centered on the hitbox,
//         accent glow pass + crisp pass. The classic procedural moth is kept
//         as the null-sprite fallback per the AssetManager contract.
export const VERSION = 'v1.0.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v1.0.0: shared PNG pipeline

const MOTH_SPRITE_KEY = 'moth';

export default class MothEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt * 0.85;
    // Erratic flutter: slow drift + fast wing-beat sway + sudden darts
    // (a fresh random lateral velocity every 0.4–1.3 s).
    this._dartT = (this._dartT ?? 0) - dt;
    if (this._dartT <= 0) {
      this._dartT = rand(0.4, 1.3);
      this._dartVx = rand(-140, 140);
    }
    this._dartX = (this._dartX ?? 0) + this._dartVx * dt;
    this.x = this.baseX
      + Math.sin(this.t * 2.3) * 52
      + Math.sin(this.t * 6.7) * 22
      + this._dartX;
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    // Light aimed shot (same contract as ButterflyEnemy).
    this.fireAtPlayer(this.angleToPlayer(), 240, 0.9);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    const sprite = getSprite(MOTH_SPRITE_KEY);
    if (sprite) {
      this._drawSprite(ctx, sprite, r);
    } else {
      this._drawProcedural(ctx, r);
    }

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }

  // v1.0.0 — top-down pixel-art sprite with a fast overhead wing-beat.
  // The art is a top-down view (no face-the-player mirror); a fast
  // sinusoidal scaleY + subtle wing-fold scaleX + quicker rotation wobble
  // sell the erratic flutter.
  _drawSprite(ctx, sprite, r) {
    const dims = getDims(MOTH_SPRITE_KEY);
    const targetW = r * 3.4;
    const targetH = dims ? (targetW * dims.h) / dims.w : targetW;
    const flap = Math.sin(this.t * 14);
    const scaleY = 1 + 0.12 * flap;    // fast vertical wing-beat
    const scaleX = 1 + 0.06 * flap;    // subtle wing-fold
    const wobble = Math.sin(this.t * 3.4) * 0.09;  // quicker drift/turn
    ctx.save();
    ctx.rotate(wobble);
    ctx.scale(scaleX, scaleY);
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


  // v1.0.0 procedural fallback (kept when the sprite is unavailable).
  _drawProcedural(ctx, r) {
    const flap = Math.sin(this.t * 14) * 0.6;

    // ─── UPPER WINGS (broad, dusty) ───
    // Left upper
    ctx.save();
    ctx.rotate(flap * 0.7);
    const uwGradL = ctx.createRadialGradient(-r * 0.8, -r * 0.2, 0, -r * 0.8, -r * 0.2, r * 0.9);
    uwGradL.addColorStop(0, '#f0e6d0');
    uwGradL.addColorStop(0.5, this.color);
    uwGradL.addColorStop(1, '#6b5433');
    ctx.fillStyle = uwGradL;
    ctx.beginPath();
    ctx.ellipse(-r * 0.85, -r * 0.15, r * 0.8, r * 0.55, -0.3, 0, TAU);
    ctx.fill();
    // Wing spots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath(); ctx.arc(-r * 1.0, -r * 0.3, r * 0.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-r * 0.7, -r * 0.05, r * 0.08, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(107, 84, 51, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(-r * 0.85, -r * 0.15, r * 0.8, r * 0.55, -0.3, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // Right upper
    ctx.save();
    ctx.rotate(-flap * 0.7);
    const uwGradR = ctx.createRadialGradient(r * 0.8, -r * 0.2, 0, r * 0.8, -r * 0.2, r * 0.9);
    uwGradR.addColorStop(0, '#f0e6d0');
    uwGradR.addColorStop(0.5, this.color);
    uwGradR.addColorStop(1, '#6b5433');
    ctx.fillStyle = uwGradR;
    ctx.beginPath();
    ctx.ellipse(r * 0.85, -r * 0.15, r * 0.8, r * 0.55, 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath(); ctx.arc(r * 1.0, -r * 0.3, r * 0.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.7, -r * 0.05, r * 0.08, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(107, 84, 51, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(r * 0.85, -r * 0.15, r * 0.8, r * 0.55, 0.3, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // ─── LOWER WINGS (smaller) ───
    ctx.save();
    ctx.rotate(flap * 0.5);
    ctx.fillStyle = 'rgba(150, 122, 80, 0.7)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.6, r * 0.4, r * 0.55, r * 0.38, 0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath(); ctx.arc(-r * 0.7, r * 0.35, r * 0.07, 0, TAU); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.rotate(-flap * 0.5);
    ctx.fillStyle = 'rgba(150, 122, 80, 0.7)';
    ctx.beginPath();
    ctx.ellipse(r * 0.6, r * 0.4, r * 0.55, r * 0.38, -0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath(); ctx.arc(r * 0.7, r * 0.35, r * 0.07, 0, TAU); ctx.fill();
    ctx.restore();

    // ─── BODY (fuzzy, segmented) ───
    const bodyGrad = ctx.createLinearGradient(0, -r * 0.7, 0, r * 0.7);
    bodyGrad.addColorStop(0, '#5a4630');
    bodyGrad.addColorStop(1, '#2e2214');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.22, r * 0.7, 0, 0, TAU);
    ctx.fill();
    // Fuzzy tufts
    ctx.strokeStyle = 'rgba(240, 230, 208, 0.35)';
    ctx.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, i * r * 0.15);
      ctx.lineTo(r * 0.2, i * r * 0.15);
      ctx.stroke();
    }

    // ─── HEAD ───
    ctx.fillStyle = '#3a2c1c';
    ctx.beginPath();
    ctx.arc(0, -r * 0.75, r * 0.16, 0, TAU);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-r * 0.08, -r * 0.78, r * 0.05, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.08, -r * 0.78, r * 0.05, 0, TAU); ctx.fill();
    // Clubbed antennae (moth signature)
    ctx.strokeStyle = '#3a2c1c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.05, -r * 0.85);
    ctx.quadraticCurveTo(-r * 0.25, -r * 1.15, -r * 0.3, -r * 1.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.05, -r * 0.85);
    ctx.quadraticCurveTo(r * 0.25, -r * 1.15, r * 0.3, -r * 1.25);
    ctx.stroke();
    // Antenna clubs
    ctx.fillStyle = '#c9a86a';
    ctx.beginPath(); ctx.arc(-r * 0.3, -r * 1.25, r * 0.06, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.3, -r * 1.25, r * 0.06, 0, TAU); ctx.fill();
  }
}

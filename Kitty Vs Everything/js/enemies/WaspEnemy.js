// Filename: WaspEnemy.js
// Kitty Vs Everything — v1.2.0
// Wasp: fast weaving striker with aimed shots. Moves in a sine-weave
// pattern, fires aimed shots.
// v1.2.0: sprite swap — draws the shared pixel-art PNG (.assets/Wasp Update
//         pixel_art.png, 694×393, side profile facing LEFT) through the
//         AssetManager pipeline (tools/import-assets.mjs → AssetSprites.js,
//         key "wasp", normalized to 128×72). Nearest-neighbor, aspect-
//         preserving, centered on the hitbox, mirrored to face the player
//         (Wasp2Enemy pattern, inverted for the left-facing art), accent
//         glow pass + crisp pass. The classic procedural wasp (flapping
//         wings, striped abdomen, glowing stinger) is kept as the
//         null-sprite fallback per the AssetManager contract.
export const VERSION = 'v1.2.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp, angleTo } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v1.2.0: shared PNG pipeline

const WASP_SPRITE_KEY = 'wasp';

export default class WaspEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt;
    this.x = this.baseX + Math.sin(this.t * 1.8) * 90;
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    const a = this.angleToPlayer();
    this.fireAtPlayer(a, 260, 1);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    // v1.2.0: the pixel art is a side profile facing LEFT — mirror it when
    // the player is on the right so the wasp always faces its target
    // (Wasp2Enemy pattern, inverted for the left-facing art).
    const p = this.game.player;
    if (p && !p.dead && p.x > this.x) ctx.scale(-1, 1);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    const sprite = getSprite(WASP_SPRITE_KEY);
    const dims = getDims(WASP_SPRITE_KEY);
    if (sprite && dims) {
      // Aspect-preserving, centered on the hitbox — same visual scale as
      // Wasp2 (h = r * 3.4; the 128:72 art aspect ≈ 1.78 matches).
      const h = r * 3.4;
      const w = h * (dims.w / dims.h);
      // Pass 1: accent glow so the wasp reads against the space backdrop
      ctx.imageSmoothingEnabled = true;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = Math.max(6, r * 0.55);
      ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
      // Pass 2: crisp pixel art on top (nearest-neighbor, no shadow)
      ctx.shadowBlur = 0;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
    } else {
      // Fallback while the sprite decodes (or if the asset is missing/corrupt)
      this.drawProcedural(ctx, r);
    }

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }

  /** v1.2.0: the classic procedural wasp (pre-pixel-art), kept as the
   *  AssetManager null-sprite fallback. Draws centered on the origin —
   *  the caller has already translated + oriented the context. */
  drawProcedural(ctx, r) {
    const flap = Math.sin(this.t * 20) * 0.5;

    // ─── WINGS (translucent, layered) ───
    ctx.save();
    ctx.rotate(-0.5 + flap);
    const wingGradL = ctx.createLinearGradient(-r * 1.5, 0, 0, 0);
    wingGradL.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    wingGradL.addColorStop(1, 'rgba(255, 255, 255, 0.4)');
    ctx.fillStyle = wingGradL;
    ctx.beginPath();
    ctx.ellipse(-r * 0.9, -r * 0.4, r * 0.75, r * 0.32, -0.2, 0, TAU);
    ctx.fill();
    // Wing vein
    ctx.strokeStyle = 'rgba(200, 180, 100, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.4);
    ctx.lineTo(-r * 1.4, -r * 0.5);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.rotate(0.5 - flap);
    const wingGradR = ctx.createLinearGradient(0, 0, r * 1.5, 0);
    wingGradR.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    wingGradR.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
    ctx.fillStyle = wingGradR;
    ctx.beginPath();
    ctx.ellipse(r * 0.9, -r * 0.4, r * 0.75, r * 0.32, 0.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 180, 100, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(r * 0.3, -r * 0.4);
    ctx.lineTo(r * 1.4, -r * 0.5);
    ctx.stroke();
    ctx.restore();

    // ─── ABDOMEN (striped, tapered) ───
    const bodyGrad = ctx.createLinearGradient(0, -r * 0.9, 0, r * 0.9);
    bodyGrad.addColorStop(0, this.color);
    bodyGrad.addColorStop(0.5, '#c49a20');
    bodyGrad.addColorStop(1, '#8a6a10');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.55, r * 0.85, 0, 0, TAU);
    ctx.fill();

    // Stripes
    ctx.strokeStyle = '#2a1a00';
    ctx.lineWidth = 2.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, i * r * 0.35);
      ctx.lineTo(r * 0.5, i * r * 0.35);
      ctx.stroke();
    }

    // ─── THORAX (smaller, rounded) ───
    ctx.fillStyle = '#b8860b';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.4, r * 0.35, 0, 0, TAU);
    ctx.fill();
    // Thorax fuzz
    ctx.fillStyle = 'rgba(255, 220, 100, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.3, r * 0.25, 0, 0, TAU);
    ctx.fill();

    // ─── HEAD ───
    ctx.fillStyle = '#3a2a00';
    ctx.beginPath();
    ctx.arc(0, -r * 0.85, r * 0.25, 0, TAU);
    ctx.fill();
    // Eyes (red, menacing)
    ctx.fillStyle = '#ff3d00';
    ctx.shadowColor = '#ff3d00';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(-r * 0.12, -r * 0.88, r * 0.08, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.12, -r * 0.88, r * 0.08, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ─── STINGER (glowing tip) ───
    ctx.fillStyle = '#ffd54f';
    ctx.shadowColor = '#ffd54f';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.8);
    ctx.lineTo(-r * 0.1, r * 1.1);
    ctx.lineTo(r * 0.1, r * 1.1);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // ─── ANTENNAE ───
    ctx.strokeStyle = '#2a1a00';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 1.0);
    ctx.quadraticCurveTo(-r * 0.3, -r * 1.3, -r * 0.2, -r * 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 1.0);
    ctx.quadraticCurveTo(r * 0.3, -r * 1.3, r * 0.2, -r * 1.4);
    ctx.stroke();
  }
}
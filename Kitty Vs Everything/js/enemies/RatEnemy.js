// Filename: RatEnemy.js
// Kitty Vs Everything — v1.2.0
// Rat: fast dashing scavenger with a sinuous tail, round ears, whiskers,
// and a pink nose. Moves in quick dashes with lateral jitter.
// v1.2.0: sprite swap — draws the shared pixel-art PNG (.assets/Rat
//         pixel_art.png, 671×526, side profile facing LEFT) through the
//         AssetManager pipeline (tools/import-assets.mjs → AssetSprites.js,
//         key "rat", normalized to 128×100). Nearest-neighbor, aspect-
//         preserving, centered on the hitbox, mirrored to face the player
//         (the art faces left, so mirror when the player is on the right),
//         accent glow pass + crisp pass. The classic procedural rat
//         (sinuous tail, furry body, round ears, whiskers, pink nose) is
//         kept as the null-sprite fallback per the AssetManager contract.
export const VERSION = 'v1.2.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v1.2.0: shared PNG pipeline

const RAT_SPRITE_KEY = 'rat';

export default class RatEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt;
    this.x += Math.sin(this.t * 8) * s * dt * 0.6;
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
    // v1.2.0: the pixel art is a side profile facing LEFT — mirror it when
    // the player is on the right so the rat always faces its target.
    const p = this.game.player;
    if (p && !p.dead && p.x > this.x) ctx.scale(-1, 1);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    const sprite = getSprite(RAT_SPRITE_KEY);
    const dims = getDims(RAT_SPRITE_KEY);
    if (sprite && dims) {
      // Aspect-preserving, centered on the hitbox — same visual scale as
      // the wasp swap (h = r * 3.4; the 128:100 art aspect ≈ 1.28).
      const h = r * 3.4;
      const w = h * (dims.w / dims.h);
      // Pass 1: accent glow so the rat reads against the space backdrop
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

  /** v1.2.0: the classic procedural rat (pre-pixel-art), kept as the
   *  AssetManager null-sprite fallback. Draws centered on the origin —
   *  the caller has already translated + oriented the context. */
  drawProcedural(ctx, r) {
    // ─── TAIL (sinuous, animated) ───
    ctx.strokeStyle = '#b08080';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.8, 0);
    const tailWave = Math.sin(this.t * 6) * r * 0.2;
    ctx.bezierCurveTo(
      r * 1.2, -r * 0.3 + tailWave,
      r * 1.5, r * 0.2 - tailWave,
      r * 1.3, r * 0.5 + tailWave * 0.5
    );
    ctx.stroke();
    // Tail tip
    ctx.fillStyle = '#d0a0a0';
    ctx.beginPath();
    ctx.arc(r * 1.3, r * 0.5 + tailWave * 0.5, r * 0.08, 0, TAU);
    ctx.fill();

    // ─── BODY (elongated, furry gradient) ───
    const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.9);
    bodyGrad.addColorStop(0, '#a0a0a0');
    bodyGrad.addColorStop(0.6, this.color);
    bodyGrad.addColorStop(1, '#5a5a5a');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.85, r * 0.55, 0, 0, TAU);
    ctx.fill();

    // Fur texture (subtle strokes)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.15, -r * 0.3);
      ctx.lineTo(i * r * 0.15 + r * 0.05, r * 0.3);
      ctx.stroke();
    }

    // ─── HEAD (rounded, forward) ───
    ctx.fillStyle = '#8d8d8d';
    ctx.beginPath();
    ctx.ellipse(-r * 0.7, -r * 0.1, r * 0.35, r * 0.3, -0.2, 0, TAU);
    ctx.fill();

    // ─── EARS (round, pink inside) ───
    // Left ear
    ctx.fillStyle = '#7a7a7a';
    ctx.beginPath();
    ctx.arc(-r * 0.85, -r * 0.5, r * 0.25, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d4a0a0';
    ctx.beginPath();
    ctx.arc(-r * 0.85, -r * 0.5, r * 0.15, 0, TAU);
    ctx.fill();
    // Right ear
    ctx.fillStyle = '#7a7a7a';
    ctx.beginPath();
    ctx.arc(-r * 0.55, -r * 0.55, r * 0.22, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d4a0a0';
    ctx.beginPath();
    ctx.arc(-r * 0.55, -r * 0.55, r * 0.13, 0, TAU);
    ctx.fill();

    // ─── EYES (beady, white with black pupil) ───
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-r * 0.8, -r * 0.2, r * 0.08, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-r * 0.82, -r * 0.2, r * 0.04, 0, TAU); ctx.fill();

    // ─── NOSE (pink) ───
    ctx.fillStyle = '#e8a0a0';
    ctx.beginPath();
    ctx.arc(-r * 1.0, -r * 0.05, r * 0.08, 0, TAU);
    ctx.fill();

    // ─── WHISKERS ───
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 0.7;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, i * r * 0.08);
      ctx.lineTo(-r * 1.4, i * r * 0.15 - r * 0.05);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, i * r * 0.08 + r * 0.05);
      ctx.lineTo(-r * 1.4, i * r * 0.15 + r * 0.1);
      ctx.stroke();
    }

    // ─── FEET (small nubs) ───
    ctx.fillStyle = '#d4a0a0';
    ctx.beginPath(); ctx.ellipse(-r * 0.3, r * 0.5, r * 0.12, r * 0.06, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.3, r * 0.5, r * 0.12, r * 0.06, 0, 0, TAU); ctx.fill();
  }
}
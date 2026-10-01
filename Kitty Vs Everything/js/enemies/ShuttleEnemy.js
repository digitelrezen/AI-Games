// Filename: ShuttleEnemy.js
// Kitty Vs Everything — v1.0.0
// Space Shuttle enemy: a crewed space shuttle (asset sprite
// .assets/Human-SpaceShuttle-pixel-art.png, 699×329 → 128×60, key "shuttle")
// that glides in from the top, holds a hover band, and strafes left/right
// with a BANKED TILT (the sprite rotates toward its travel direction).
// Fires telegraphed aimed cannon shots — a brief red sight ring before each
// shot, so the player can read the aim (same telegraph contract as
// HumanEnemy: attack() arms the aim, move() counts it down and fires).
// v3.50.0: 17th species — REGULAR WAVES ONLY. Bone Yard Phase 2 is locked to
// standard humanoids by an explicit allowlist (BoneYardBonus.js), so shuttles
// can never leak into the Bone Yard march.
export const VERSION = 'v1.0.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v3.50.0: shared PNG pipeline

const SHUTTLE_SPRITE_KEY = 'shuttle';

export default class ShuttleEnemy extends EnemyBase {
  constructor(opts) {
    super(opts);
    // Wave behavior: glide down into the hover band, then banked strafe.
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.hoverY = 80 + rand(0, 100);
    // Bank angle (radians) — eased toward the travel direction.
    this.bank = 0;
    // Telegraph: seconds of visible "aiming" before the cannon fires.
    this.telegraph = 0;
  }

  move(dt, slowMul) {
    const s = this.speed * slowMul;

    // Telegraphed aimed cannon fire: attack() arms the aim, this counts it
    // down and fires the shot. Stunned shuttles (slowMul = 0) hold their aim
    // without firing.
    if (this.telegraph > 0 && slowMul > 0) {
      this.telegraph -= dt;
      if (this.telegraph <= 0) this.fireAtPlayer(this.angleToPlayer(), 340, 1);
    }

    // Glide in: descend into the hover band level (no bank).
    if (this.y < this.hoverY) {
      this.y += s * dt * 0.5;
      this.bank += (0 - this.bank) * Math.min(1, dt * 4);
      return;
    }

    // Hover band: banked strafe left/right, flipping at the screen edges.
    this.x += s * dt * 0.85 * this.strafeDir;
    const edge = 24 + this.radius;
    if (this.x < edge) this.strafeDir = 1;
    if (this.x > this.game.W - edge) this.strafeDir = -1;
    const bankTarget = this.strafeDir * 0.22;
    this.bank += (bankTarget - this.bank) * Math.min(1, dt * 4);
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    // Telegraph the aim — the actual shot fires in move() once the
    // telegraph expires.
    this.telegraph = 0.4;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;
    ctx.rotate(this.bank);
    const sprite = getSprite(SHUTTLE_SPRITE_KEY);
    if (sprite) {
      this._drawSprite(ctx, sprite);
    } else {
      this._drawProcedural(ctx);
    }
    // Telegraph: small red sight ring on the aim line (drawn un-rotated so
    // it tracks the player, not the hull).
    if (this.telegraph > 0) {
      ctx.rotate(-this.bank);
      const a = this.angleToPlayer();
      const d = this.radius + 8;
      ctx.strokeStyle = 'rgba(255, 82, 82, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 4, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }

  // Pixel-art sprite: nearest-neighbor, aspect-preserving (128×60),
  // centered on the hitbox.
  _drawSprite(ctx, sprite) {
    const dims = getDims(SHUTTLE_SPRITE_KEY);
    const w = 76;
    const h = w * dims.h / dims.w;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  }

  // Procedural fallback (null sprite per the AssetManager contract):
  // white shuttle silhouette — wings, fuselage, cockpit, engine glow.
  _drawProcedural(ctx) {
    const r = this.radius;
    // Wings
    ctx.fillStyle = '#90a4ae';
    ctx.beginPath();
    ctx.moveTo(-r * 1.6, r * 0.4);
    ctx.lineTo(r * 0.2, -r * 0.1);
    ctx.lineTo(r * 0.2, r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 1.6, -r * 0.4);
    ctx.lineTo(r * 0.2, r * 0.1);
    ctx.lineTo(r * 0.2, -r * 0.3);
    ctx.closePath();
    ctx.fill();
    // Fuselage
    ctx.fillStyle = '#eceff1';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.4, r * 0.55, 0, 0, TAU);
    ctx.fill();
    // Cockpit window
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath();
    ctx.arc(r * 0.5, 0, r * 0.22, 0, TAU);
    ctx.fill();
    // Engine glow (pulsing)
    const glow = 0.5 + 0.3 * Math.sin(this.t * 8);
    ctx.fillStyle = `rgba(255, 152, 0, ${glow})`;
    ctx.beginPath();
    ctx.arc(-r * 1.2, 0, r * 0.25, 0, TAU);
    ctx.fill();
  }
}

// Filename: PinkCatEnemy.js
// Kitty Vs Everything — v3.32.0
// Pink Cat Boss: the "Internet" boss (trash/crate scale, radius 18).
// v3.32.0: Art is now the generated pixel-art sprite (PinkCatSprite.js)
//          — nearest-neighbor, plain pink-circle fallback, drawn centered
//          on the hitbox (drawn height ≈ 2.6 × radius). The v3.13.0 soft
//          pink aura + drifting hearts are kept around the sprite. ALL
//          boss behavior is UNCHANGED: boss-tier HP/shield/damage
//          (EnemyBase), same hover/sine movement, same 3-way attack, same
//          5-fan special + side bursts.
export const VERSION = 'v3.32.0';
import EnemyBase from '../enemies/EnemyBase.js';
import { clamp, TAU } from '../core/utils.js';
import { drawHeart, PINK_CAT_PALETTE } from './PinkCatBossArt.js';
import { getPinkCatSprite, PINK_CAT_H } from './PinkCatSprite.js';

export default class PinkCatEnemy extends EnemyBase {
  constructor(opts) {
    super(opts);
    // v3.13.0: small cute boss — hitbox at trash/crate scale (18) instead
    // of the default boss-tier 41.6. Boss-tier HP/shield/damage are
    // untouched (EnemyBase tier multipliers).
    this.radius = 18;
  }

  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt * 0.3;
    if (this.y > 160) this.y = 160 + Math.sin(this.t * 1.2) * 25;
    this.x = this.game.W / 2 + Math.sin(this.t * 0.8) * 150;
    this.x = clamp(this.x, 80, this.game.W - 80);
  }

  attack() {
    // 3-way pink energy shot
    const a = this.angleToPlayer();
    this.fireAtPlayer(a - 0.2, 280, 1.1);
    this.fireAtPlayer(a, 300, 1.2);
    this.fireAtPlayer(a + 0.2, 280, 1.1);
  }

  specialAttack() {
    // Pink Cat special: 5-shot fan + 2 homing-ish bursts
    const a = this.angleToPlayer();
    for (let i = -2; i <= 2; i++) {
      this.fireAtPlayer(a + i * 0.2, 260, 0.9);
    }
    // Side bursts
    this.game.spawnEnemyBullet(this.x - 30, this.y, Math.PI * 0.7, 200, this.damage * 0.6, '#ff69b4');
    this.game.spawnEnemyBullet(this.x + 30, this.y, Math.PI * 0.3, 200, this.damage * 0.6, '#ff69b4');
    this.game.shake = Math.max(this.game.shake, 5);
  }

  draw(ctx) {
    const r = this.radius;
    const P = PINK_CAT_PALETTE;
    ctx.save();
    ctx.translate(this.x, this.y);

    // ─── SOFT PINK AURA (boss glow + drifting hearts) ───
    // Kept from the v3.13.0 procedural art (PinkCatBossArt.js), now
    // drawn around the generated sprite.
    const pulse = 0.28 + 0.18 * Math.sin(this.t * 2.4);
    ctx.globalAlpha = (this.flash > 0 ? 0.3 : 1) * pulse;
    ctx.strokeStyle = P.pink;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = P.pink;
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.25, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0;
    for (let i = 0; i < 3; i++) {
      const ha = this.t * 1.2 + (i / 3) * TAU;
      const hx = Math.cos(ha) * r * 1.15;
      const hy = Math.sin(ha * 1.3) * r * 0.9 - r * 0.2;
      drawHeart(ctx, hx, hy, r * 0.11, P.blush, 0.5 + 0.3 * Math.sin(this.t * 3 + i));
    }

    // ─── v3.32.0: GENERATED SPRITE (PinkCatSprite.js) ───
    // The pixel-art cat is drawn centered on the origin, scaled so the
    // drawn height ≈ 2.6 × the hitbox radius (the cat reads slightly
    // larger than its circle — boss presence). Nearest-neighbor: no
    // smoothing.
    const spr = getPinkCatSprite();
    if (this.flash > 0) ctx.globalAlpha = 0.55;
    if (spr) {
      const s = (2.6 * r) / PINK_CAT_H;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(spr, -spr.width * s * 0.5, -spr.height * s * 0.5, spr.width * s, spr.height * s);
    } else {
      // Fallback (sprite not decoded yet / failed): plain pink circle.
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }
}

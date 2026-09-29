// Filename: BlackCatEnemy.js
// Kitty Vs Everything — v3.32.0
// Black Cat: teleporting phantom with a yellow ghost trail.
// v3.32.0: Art is now the generated pixel-art sprite (BlackCatSprite.js)
//          — nearest-neighbor, plain dark-circle fallback. The sprite is
//          square and drawn centered on the hitbox (drawn width = 2 ×
//          radius), so the v1.2.0/v3.29.0 skinny-tall squash is gone.
// v3.29.0: Internet Bonus entourage — when `entourage` is set (the 8
//          orbiting cats), the cat wears a chunky old-school gold chain
//          with a large iced-out digital clock pendant showing the
//          player's real local time (art: BlackCatEntourage.js, live
//          time: RealTimeClock.js). The outfit is the Internet Bonus
//          tell now that the silhouette is square.
export const VERSION = 'v3.32.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';
import { drawEntourageOutfit } from './BlackCatEntourage.js';
import { getBlackCatSprite, BLACK_CAT_W } from './BlackCatSprite.js';

export default class BlackCatEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt * 0.3;
    // Teleport every ~1.8s
    if (this.t % 1.8 < dt) {
      this.x = rand(80, this.game.W - 80);
      this.y = Math.min(this.y + rand(0, 120), this.game.H - 200);
      this.flash = 0.2;
      // Teleport particles
      this.game.particles.burst(this.x, this.y, { count: 8, color: '#ffee58', speed: 100, life: 0.3 });
    }
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    const a = this.angleToPlayer();
    this.fireAtPlayer(a, 260, 1.1);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);

    // ─── v3.32.0: GENERATED SPRITE (BlackCatSprite.js) ───
    // The pixel-art cat is drawn centered on the origin, scaled so the
    // drawn width equals 2 × the hitbox radius (the visible body matches
    // the collision circle). The sprite is near-square (362×357) — the
    // v1.2.0 skinny-tall squash is gone (the entourage outfit below is
    // the Internet Bonus tell now). Nearest-neighbor: no smoothing.
    const spr = getBlackCatSprite();
    if (this.flash > 0) ctx.globalAlpha = 0.4;
    if (spr) {
      const s = (2 * r) / BLACK_CAT_W;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(spr, -spr.width * s * 0.5, -spr.height * s * 0.5, spr.width * s, spr.height * s);
    } else {
      // Fallback (sprite not decoded yet / failed): plain dark circle.
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ─── GHOST TRAIL (subtle afterimage) ───
    const trailAlpha = 0.1 + 0.05 * Math.sin(this.t * 2);
    ctx.globalAlpha = trailAlpha;
    ctx.fillStyle = '#ffee58';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.7, r * 0.9, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ─── v3.15.0: INTERNET ENTOURAGE OUTFIT ───
    // Chunky gold chain + iced-out real-time clock pendant (art:
    // BlackCatEntourage.js, live local time: RealTimeClock.js). Only
    // the 8 orbiting cats of the Internet Bonus wear it (entourage).
    if (this.entourage) {
      drawEntourageOutfit(ctx, {
        r: this.radius,
        t: this.t,
        phase: this.entouragePhase || 0,
        flash: this.flash,
      });
    }

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }
}
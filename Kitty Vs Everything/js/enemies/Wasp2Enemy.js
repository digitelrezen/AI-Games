// Filename: Wasp2Enemy.js
// Kitty Vs Everything — v1.0.0
// Wasp2: black wireframe wasp rendered from the pixel-art silhouette in
// ../.assets/Wasp 1 Pixel Art.png (sprite pipeline in Wasp2Sprite.js — the white
// background is keyed to transparency, only the black outline is kept).
// AI: hovers while TRACKING the player's X (exponential lerp), OSCILLATES
// side to side around the tracked point, and periodically LUNGES — a fast
// dash straight at the player. Fires aimed darts (occasional 2-way spread).
export const VERSION = 'v1.0.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp, angleTo } from '../core/utils.js';
import { getWasp2Sprite } from './Wasp2Sprite.js';

export default class Wasp2Enemy extends EnemyBase {
  constructor(opts) {
    super(opts);
    // AI state (see move())
    this.hoverX = this.x;              // tracked X (homes onto the player)
    this.trackK = rand(1.0, 1.8);      // tracking responsiveness (1/s)
    this.oscAmp = rand(28, 55);        // oscillation half-width (px)
    this.oscFreq = rand(1.6, 2.6);     // oscillation frequency (rad/s)
    this.lungeTimer = rand(1.5, 3.0);  // time to first lunge (s)
    this.lungeT = 0;                   // remaining lunge time (s)
    this.lungeVx = 0;                  // lunge velocity (px/s)
    this.lungeVy = 0;
  }

  move(dt, slowMul) {
    const s = this.speed * slowMul;
    const p = this.game.player;

    // ─── LUNGE PHASE: fast dash toward where the player was ───
    if (this.lungeT > 0) {
      this.lungeT -= dt;
      this.x += this.lungeVx * dt;
      this.y += this.lungeVy * dt;
      if (this.lungeT <= 0) this.hoverX = this.x; // resync after the dash
      return;
    }

    // ─── TRACK PHASE: home onto the player's X (frame-rate independent) ───
    const targetX = p && !p.dead ? p.x : this.baseX;
    this.hoverX += (targetX - this.hoverX) * (1 - Math.exp(-this.trackK * dt));

    // ─── OSCILLATE around the tracked X while slowly descending ───
    this.x = clamp(
      this.hoverX + Math.sin(this.t * this.oscFreq) * this.oscAmp,
      20, this.game.W - 20
    );
    this.y += s * 0.5 * dt;

    // ─── Occasionally trigger a lunge at the player ───
    this.lungeTimer -= dt;
    if (this.lungeTimer <= 0 && this.y > 60 && p && !p.dead) {
      this.lungeTimer = rand(2.5, 4.5);
      const a = angleTo(this.x, this.y, p.x, p.y);
      const v = s * 2.2;
      this.lungeVx = Math.cos(a) * v;
      this.lungeVy = Math.sin(a) * v;
      this.lungeT = 0.45;
    }
  }

  attack() {
    const a = this.angleToPlayer();
    this.fireAtPlayer(a, 300, 1);
    // Occasionally add a weak 2-way spread
    if (Math.random() < 0.45) {
      const off = 0.16;
      this.game.spawnEnemyBullet(this.x, this.y + this.radius * 0.5, a - off, 240, this.damage * 0.5, this.color);
      this.game.spawnEnemyBullet(this.x, this.y + this.radius * 0.5, a + off, 240, this.damage * 0.5, this.color);
    }
  }

  draw(ctx) {
    const r = this.radius;
    const sprite = getWasp2Sprite();
    ctx.save();
    ctx.translate(this.x, this.y);
    const p = this.game.player;
    if (p && !p.dead && p.x < this.x) ctx.scale(-1, 1); // face the player
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    if (sprite) {
      const h = r * 3.4;
      const w = h * (sprite.width / sprite.height);
      // Pass 1: accent glow so the black wireframe reads against space
      ctx.imageSmoothingEnabled = true;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = Math.max(6, r * 0.55);
      ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
      // Pass 2: crisp black silhouette on top (no shadow)
      ctx.shadowBlur = 0;
      ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
    } else {
      // Fallback until the sprite pipeline finishes (should be instant)
      ctx.fillStyle = '#151515';
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }
}

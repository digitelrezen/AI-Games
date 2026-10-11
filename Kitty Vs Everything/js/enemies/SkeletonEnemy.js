// Filename: SkeletonEnemy.js
// Kitty Vs Everything — v1.0.0
// v4.24.0: Skeleton — Boneyard-encounter-only species. Eridath's Mom's
//          House (js/levels/EridathsMomsHouse.js) dumps them into the
//          yard during BoneYardBonus Phase 3/4. They shamble toward the
//          player with a slow lateral wobble and fire a lazy bone-chunk
//          shot (classic shootTimer/attack() loop — no telegraphed
//          attackType).
//          Like spacesnake, skeleton is EXCLUDED from the regular wave
//          cycle (WaveManager.js filter) — it only ever spawns from the
//          house. Tuning (speed/hp/damage/fireRate) lives in ENEMY_TYPES
//          (js/core/config/enemies.js — the single tuning surface);
//          score comes from TIERS.
export const VERSION = 'v1.0.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';

export default class SkeletonEnemy extends EnemyBase {
  constructor(opts) {
    super(opts);
    // Shamble wobble phase (per-instance, so the yard never marches in
    // lockstep).
    this.shamblePhase = rand(0, TAU);
  }

  move(dt, slowMul) {
    const s = this.speed * slowMul;
    const p = this.game.player;
    const tx = p ? p.x : this.game.W / 2;
    const ty = p ? p.y : this.game.H;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    // Shamble: drift toward the player with a slow lateral wobble.
    this.shamblePhase += dt * 3;
    const wobble = Math.sin(this.shamblePhase) * 0.45;
    this.x += ((dx / d) + (-dy / d) * wobble) * s * dt * 0.9;
    this.y += ((dy / d) + (dx / d) * wobble) * s * dt * 0.9;
    this.x = clamp(this.x, -60, this.game.W + 60);
  }

  attack() {
    // One lazy bone-chunk shot at the player (weak — dmgMul 0.7).
    this.fireAtPlayer(this.angleToPlayer() + rand(-0.12, 0.12), 230, 0.7);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const r = this.radius;
    // Ethereal glow pass (BoneFragment-style).
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#fffef0';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.1, r * 1.3, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = this.flash > 0 ? 0.5 : 1;
    const bone = '#e8e4d8';
    const shade = '#b8b2a0';
    // ─── SKULL ───
    ctx.fillStyle = bone;
    ctx.beginPath();
    ctx.arc(0, -r * 0.62, r * 0.42, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = shade;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Eye sockets
    ctx.fillStyle = '#1a1a22';
    ctx.beginPath();
    ctx.arc(-r * 0.16, -r * 0.66, r * 0.1, 0, TAU);
    ctx.arc(r * 0.16, -r * 0.66, r * 0.1, 0, TAU);
    ctx.fill();
    // Jaw
    ctx.fillStyle = bone;
    ctx.fillRect(-r * 0.2, -r * 0.34, r * 0.4, r * 0.14);
    // ─── SPINE ───
    ctx.strokeStyle = bone;
    ctx.lineWidth = r * 0.14;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.2);
    ctx.lineTo(0, r * 0.42);
    ctx.stroke();
    // ─── RIBCAGE (three arcs) ───
    ctx.lineWidth = r * 0.1;
    for (let i = 0; i < 3; i++) {
      const ry = -r * 0.12 + i * r * 0.18;
      ctx.beginPath();
      ctx.ellipse(0, ry, r * 0.42 - i * r * 0.05, r * 0.14, 0, 0, TAU);
      ctx.stroke();
    }
    // ─── PELVIS ───
    ctx.beginPath();
    ctx.ellipse(0, r * 0.46, r * 0.26, r * 0.14, 0, 0, TAU);
    ctx.stroke();
    // ─── ARMS (nubs angled out) ───
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.1);
    ctx.lineTo(-r * 0.55, r * 0.18);
    ctx.moveTo(r * 0.2, -r * 0.1);
    ctx.lineTo(r * 0.55, r * 0.18);
    ctx.stroke();
    // ─── LEGS ───
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, r * 0.55);
    ctx.lineTo(-r * 0.2, r * 0.95);
    ctx.moveTo(r * 0.12, r * 0.55);
    ctx.lineTo(r * 0.2, r * 0.95);
    ctx.stroke();
    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }
}

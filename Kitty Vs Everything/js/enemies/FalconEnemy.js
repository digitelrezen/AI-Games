// Filename: FalconEnemy.js
// Kitty Vs Everything — v1.1.0
// Falcon: fast diving raptor with swept wings, sharp beak, and a tail fan.
// Hovers high then dives at the player in a straight line.
export const VERSION = 'v1.1.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp, angleTo } from '../core/utils.js';

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

    const wing = Math.sin(this.t * 6) * 0.4;

    // ─── WINGS (swept, layered) ───
    // Left wing
    ctx.save();
    ctx.rotate(-0.3 + wing);
    const lwGrad = ctx.createLinearGradient(-r * 1.5, 0, 0, 0);
    lwGrad.addColorStop(0, '#8a5520');
    lwGrad.addColorStop(1, this.color);
    ctx.fillStyle = lwGrad;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.1);
    ctx.lineTo(-r * 1.4, -r * 0.5);
    ctx.lineTo(-r * 1.1, r * 0.1);
    ctx.lineTo(-r * 0.5, r * 0.2);
    ctx.closePath();
    ctx.fill();
    // Feather lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      const fx = -r * (0.3 + i * 0.25);
      ctx.beginPath();
      ctx.moveTo(fx, -r * 0.1);
      ctx.lineTo(fx - r * 0.1, r * 0.15);
      ctx.stroke();
    }
    ctx.restore();

    // Right wing
    ctx.save();
    ctx.rotate(0.3 - wing);
    const rwGrad = ctx.createLinearGradient(0, 0, r * 1.5, 0);
    rwGrad.addColorStop(0, this.color);
    rwGrad.addColorStop(1, '#8a5520');
    ctx.fillStyle = rwGrad;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.1);
    ctx.lineTo(r * 1.4, -r * 0.5);
    ctx.lineTo(r * 1.1, r * 0.1);
    ctx.lineTo(r * 0.5, r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      const fx = r * (0.3 + i * 0.25);
      ctx.beginPath();
      ctx.moveTo(fx, -r * 0.1);
      ctx.lineTo(fx + r * 0.1, r * 0.15);
      ctx.stroke();
    }
    ctx.restore();

    // ─── BODY (sleek, tapered) ───
    const bodyGrad = ctx.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
    bodyGrad.addColorStop(0, '#c08040');
    bodyGrad.addColorStop(0.5, this.color);
    bodyGrad.addColorStop(1, '#6a4020');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.35, r * 0.8, 0, 0, TAU);
    ctx.fill();

    // Chest (lighter)
    ctx.fillStyle = 'rgba(255, 230, 180, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.2, r * 0.2, r * 0.4, 0, 0, TAU);
    ctx.fill();

    // ─── HEAD ───
    ctx.fillStyle = '#8a5520';
    ctx.beginPath();
    ctx.arc(0, -r * 0.75, r * 0.25, 0, TAU);
    ctx.fill();

    // Beak (hooked, yellow)
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.9);
    ctx.lineTo(-r * 0.12, -r * 1.1);
    ctx.lineTo(0, -r * 1.2);
    ctx.lineTo(r * 0.12, -r * 1.1);
    ctx.closePath();
    ctx.fill();
    // Beak hook
    ctx.fillStyle = '#e6a800';
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.2);
    ctx.lineTo(-r * 0.05, -r * 1.15);
    ctx.lineTo(r * 0.05, -r * 1.15);
    ctx.closePath();
    ctx.fill();

    // Eyes (sharp, yellow)
    ctx.fillStyle = '#ffeb3b';
    ctx.shadowColor = '#ffeb3b';
    ctx.shadowBlur = 3;
    ctx.beginPath(); ctx.arc(-r * 0.12, -r * 0.78, r * 0.06, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.12, -r * 0.78, r * 0.06, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(-r * 0.12, -r * 0.78, r * 0.03, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.12, -r * 0.78, r * 0.03, 0, TAU); ctx.fill();

    // ─── TAIL FAN (spread feathers) ───
    const tailSpread = 0.3 + Math.sin(this.t * 4) * 0.1;
    ctx.fillStyle = '#6a4020';
    for (let i = -2; i <= 2; i++) {
      ctx.save();
      ctx.rotate(i * tailSpread * 0.3);
      ctx.beginPath();
      ctx.ellipse(0, r * 0.9, r * 0.08, r * 0.35, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // Tail band (white)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.75, r * 0.25, r * 0.08, 0, 0, TAU);
    ctx.fill();

    // ─── TALONS (small, visible) ───
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-r * 0.2, r * 0.5); ctx.lineTo(-r * 0.3, r * 0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.2, r * 0.5); ctx.lineTo(r * 0.3, r * 0.7); ctx.stroke();

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }
}
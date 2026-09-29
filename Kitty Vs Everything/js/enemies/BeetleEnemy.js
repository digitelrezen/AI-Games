// Filename: BeetleEnemy.js
// Kitty Vs Everything — v1.1.0
// Beetle: slow armored tank that charges in bursts. Heavy chitin shell with
// iridescent gradient, six articulated legs, and a glowing mandible core.
export const VERSION = 'v1.1.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp, angleTo } from '../core/utils.js';

export default class BeetleEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt * 0.6;
    // Periodic charge lunge toward player
    if (this.t % 2.4 < dt) {
      const a = angleTo(this.x, this.y, this.game.player.x, this.game.player.y);
      this.x += Math.cos(a) * s * 2 * dt;
      this.y += Math.sin(a) * s * 2 * dt;
    }
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    const a = this.angleToPlayer();
    this.fireAtPlayer(a, 220, 1.2);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    // ─── LEGS (6 articulated, animated) ───
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    const legPhase = Math.sin(this.t * 3) * 0.15;
    for (let i = -1; i <= 1; i++) {
      const ly = i * r * 0.4;
      // Left legs
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, ly);
      ctx.lineTo(-r * 0.9, ly + r * 0.15 + legPhase * r);
      ctx.lineTo(-r * 1.2, ly + r * 0.3 + legPhase * r);
      ctx.stroke();
      // Right legs
      ctx.beginPath();
      ctx.moveTo(r * 0.55, ly);
      ctx.lineTo(r * 0.9, ly + r * 0.15 - legPhase * r);
      ctx.lineTo(r * 1.2, ly + r * 0.3 - legPhase * r);
      ctx.stroke();
    }

    // ─── ELYTRA (hard shell — iridescent gradient) ───
    const shellGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.9);
    shellGrad.addColorStop(0, '#9a6a30');
    shellGrad.addColorStop(0.4, this.color);
    shellGrad.addColorStop(0.7, '#4a2a10');
    shellGrad.addColorStop(1, '#2a1508');
    ctx.fillStyle = shellGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.7, r * 0.9, 0, 0, TAU);
    ctx.fill();

    // Shell center seam
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.85);
    ctx.lineTo(0, r * 0.85);
    ctx.stroke();

    // Shell ridges
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, i * r * 0.25);
      ctx.quadraticCurveTo(0, i * r * 0.25 + r * 0.05, r * 0.5, i * r * 0.25);
      ctx.stroke();
    }

    // Iridescent highlight
    ctx.fillStyle = 'rgba(100, 200, 150, 0.15)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, -r * 0.3, r * 0.3, r * 0.4, -0.3, 0, TAU);
    ctx.fill();

    // ─── HEAD (small, with mandibles) ───
    ctx.fillStyle = '#2a1508';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.85, r * 0.3, r * 0.25, 0, 0, TAU);
    ctx.fill();

    // Mandibles (glowing)
    const mandGlow = 0.5 + 0.5 * Math.sin(this.t * 4);
    ctx.strokeStyle = `rgba(255, 150, 0, ${0.4 + mandGlow * 0.4})`;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.95);
    ctx.quadraticCurveTo(-r * 0.35, -r * 1.2, -r * 0.15, -r * 1.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.2, -r * 0.95);
    ctx.quadraticCurveTo(r * 0.35, -r * 1.2, r * 0.15, -r * 1.3);
    ctx.stroke();

    // Eyes (small, amber)
    ctx.fillStyle = '#ffb300';
    ctx.shadowColor = '#ffb300';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.arc(-r * 0.15, -r * 0.9, r * 0.07, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.15, -r * 0.9, r * 0.07, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }
}
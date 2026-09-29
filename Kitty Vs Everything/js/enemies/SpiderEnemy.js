// Filename: SpiderEnemy.js
// Kitty Vs Everything — v1.1.0
// Spider: slow web-spinner with 8 articulated legs, a multi-eyed face,
// and a patterned abdomen. Fires slow web projectiles.
export const VERSION = 'v1.1.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';

export default class SpiderEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt * 0.5;
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    // Slow web shot
    const a = this.angleToPlayer();
    this.fireAtPlayer(a, 180, 1);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    const legWave = Math.sin(this.t * 4) * 0.1;

    // ─── LEGS (8, articulated, animated) ───
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const baseAngle = -0.8 + i * 0.5;
      const wave = legWave * (i % 2 === 0 ? 1 : -1);
      // Left legs
      const la = baseAngle + wave;
      const kx = Math.cos(la) * r * 0.5;
      const ky = Math.sin(la) * r * 0.3;
      const ex = Math.cos(la) * r * 1.3;
      const ey = Math.sin(la) * r * 1.1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, 0);
      ctx.lineTo(-r * 0.3 + kx, ky);
      ctx.lineTo(-r * 0.3 + ex, ey);
      ctx.stroke();
      // Right legs
      const ra = -baseAngle + wave;
      const rx = Math.cos(ra) * r * 0.5;
      const ry = Math.sin(ra) * r * 0.3;
      const rex = Math.cos(ra) * r * 1.3;
      const rey = Math.sin(ra) * r * 1.1;
      ctx.beginPath();
      ctx.moveTo(r * 0.3, 0);
      ctx.lineTo(r * 0.3 + rx, ry);
      ctx.lineTo(r * 0.3 + rex, rey);
      ctx.stroke();
    }

    // Leg joints (small circles)
    ctx.fillStyle = '#2a2a2a';
    for (let i = 0; i < 4; i++) {
      const baseAngle = -0.8 + i * 0.5;
      const wave = legWave * (i % 2 === 0 ? 1 : -1);
      const la = baseAngle + wave;
      ctx.beginPath();
      ctx.arc(-r * 0.3 + Math.cos(la) * r * 0.5, Math.sin(la) * r * 0.3, r * 0.05, 0, TAU);
      ctx.fill();
      const ra = -baseAngle + wave;
      ctx.beginPath();
      ctx.arc(r * 0.3 + Math.cos(ra) * r * 0.5, Math.sin(ra) * r * 0.3, r * 0.05, 0, TAU);
      ctx.fill();
    }

    // ─── ABDOMEN (large, patterned) ───
    const abdGrad = ctx.createRadialGradient(0, r * 0.2, 0, 0, r * 0.2, r * 0.7);
    abdGrad.addColorStop(0, '#5a5a5a');
    abdGrad.addColorStop(0.5, this.color);
    abdGrad.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = abdGrad;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.2, r * 0.55, r * 0.65, 0, 0, TAU);
    ctx.fill();

    // Abdomen pattern (hourglass / markings)
    ctx.strokeStyle = 'rgba(200, 200, 100, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.2);
    ctx.lineTo(-r * 0.2, r * 0.2);
    ctx.lineTo(0, r * 0.6);
    ctx.lineTo(r * 0.2, r * 0.2);
    ctx.closePath();
    ctx.stroke();
    // Spots
    ctx.fillStyle = 'rgba(200, 200, 100, 0.3)';
    ctx.beginPath(); ctx.arc(-r * 0.2, r * 0.4, r * 0.06, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.2, r * 0.4, r * 0.06, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, r * 0.6, r * 0.05, 0, TAU); ctx.fill();

    // ─── CEPHALOTHORAX (front body, smaller) ───
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.3, r * 0.4, r * 0.35, 0, 0, TAU);
    ctx.fill();

    // ─── EYES (8, clustered) ───
    const eyePositions = [
      [-0.15, -0.35, 0.07], [0.15, -0.35, 0.07],
      [-0.25, -0.25, 0.05], [0.25, -0.25, 0.05],
      [-0.1, -0.2, 0.05], [0.1, -0.2, 0.05],
      [-0.2, -0.45, 0.04], [0.2, -0.45, 0.04],
    ];
    for (const [ex, ey, er] of eyePositions) {
      // Eye glow
      ctx.fillStyle = 'rgba(255, 255, 200, 0.3)';
      ctx.beginPath();
      ctx.arc(ex * r, ey * r, er * r * 1.5, 0, TAU);
      ctx.fill();
      // Eye white
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex * r, ey * r, er * r, 0, TAU);
      ctx.fill();
      // Pupil
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(ex * r, ey * r, er * r * 0.5, 0, TAU);
      ctx.fill();
    }

    // ─── CHILICERAE (small fangs) ───
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.5);
    ctx.lineTo(-r * 0.08, -r * 0.65);
    ctx.lineTo(-r * 0.12, -r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.5);
    ctx.lineTo(r * 0.08, -r * 0.65);
    ctx.lineTo(r * 0.12, -r * 0.6);
    ctx.closePath();
    ctx.fill();

    // ─── WEB THREADS (subtle, from legs) ───
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.15)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-r * 1.2, r * 0.8);
    ctx.lineTo(-r * 1.5, r * 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 1.2, r * 0.8);
    ctx.lineTo(r * 1.5, r * 1.2);
    ctx.stroke();

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }
}
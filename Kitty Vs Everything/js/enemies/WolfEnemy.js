// Filename: WolfEnemy.js
// Kitty Vs Everything — v1.1.0
// Wolf: mid-speed pack hunter with angular wolf-head silhouette, pointed ears,
// glowing red eyes, and a fur-textured body. Moves in coordinated pack sine.
export const VERSION = 'v1.1.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';

export default class WolfEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt * 0.8;
    this.x = this.baseX + Math.sin(this.t * 1.2 + this.baseX * 0.01) * 40;
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    const a = this.angleToPlayer();
    this.fireAtPlayer(a, 250, 1.1);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    // ─── BODY (angular, tapered toward tail) ───
    const bodyGrad = ctx.createLinearGradient(0, -r * 0.5, 0, r * 0.8);
    bodyGrad.addColorStop(0, '#b0b8c4');
    bodyGrad.addColorStop(0.5, this.color);
    bodyGrad.addColorStop(1, '#5a6570');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.6);
    ctx.lineTo(r * 0.7, r * 0.2);
    ctx.lineTo(r * 0.5, r * 0.7);
    ctx.lineTo(-r * 0.5, r * 0.7);
    ctx.lineTo(-r * 0.7, r * 0.2);
    ctx.closePath();
    ctx.fill();

    // Fur texture strokes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.15, r * 0.1);
      ctx.lineTo(i * r * 0.15 + r * 0.05, r * 0.6);
      ctx.stroke();
    }

    // ─── HEAD (angular wolf snout) ───
    ctx.fillStyle = '#8a95a5';
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.1);
    ctx.lineTo(r * 0.5, -r * 0.5);
    ctx.lineTo(r * 0.3, -r * 0.3);
    ctx.lineTo(-r * 0.3, -r * 0.3);
    ctx.lineTo(-r * 0.5, -r * 0.5);
    ctx.closePath();
    ctx.fill();

    // Snout (pointed)
    ctx.fillStyle = '#6a7585';
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.3);
    ctx.lineTo(r * 0.15, -r * 1.0);
    ctx.lineTo(-r * 0.15, -r * 1.0);
    ctx.closePath();
    ctx.fill();
    // Nose
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(0, -r * 1.25, r * 0.06, 0, TAU);
    ctx.fill();

    // ─── EARS (tall, pointed, inner accent) ───
    // Left ear
    ctx.fillStyle = '#7a8595';
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, -r * 0.7);
    ctx.lineTo(-r * 0.6, -r * 1.4);
    ctx.lineTo(-r * 0.1, -r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d4a0a0';
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, -r * 0.8);
    ctx.lineTo(-r * 0.5, -r * 1.2);
    ctx.lineTo(-r * 0.15, -r * 0.85);
    ctx.closePath();
    ctx.fill();
    // Right ear
    ctx.fillStyle = '#7a8595';
    ctx.beginPath();
    ctx.moveTo(r * 0.35, -r * 0.7);
    ctx.lineTo(r * 0.6, -r * 1.4);
    ctx.lineTo(r * 0.1, -r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d4a0a0';
    ctx.beginPath();
    ctx.moveTo(r * 0.35, -r * 0.8);
    ctx.lineTo(r * 0.5, -r * 1.2);
    ctx.lineTo(r * 0.15, -r * 0.85);
    ctx.closePath();
    ctx.fill();

    // ─── EYES (glowing red, menacing) ───
    ctx.fillStyle = '#ff1744';
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, -r * 0.55, r * 0.1, r * 0.06, -0.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(r * 0.2, -r * 0.55, r * 0.1, r * 0.06, 0.2, 0, TAU);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.55, r * 0.03, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.55, r * 0.03, 0, TAU); ctx.fill();

    // ─── JAW / TEETH ───
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, -r * 0.3);
    ctx.lineTo(-r * 0.1, -r * 0.2);
    ctx.lineTo(-r * 0.05, -r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.05, -r * 0.3);
    ctx.lineTo(r * 0.1, -r * 0.2);
    ctx.lineTo(r * 0.15, -r * 0.3);
    ctx.closePath();
    ctx.fill();

    // ─── LEGS (angular, visible) ───
    ctx.strokeStyle = '#5a6570';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const legSwing = Math.sin(this.t * 5) * r * 0.1;
    ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.6); ctx.lineTo(-r * 0.5, r * 1.0 + legSwing); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.4, r * 0.6); ctx.lineTo(r * 0.5, r * 1.0 - legSwing); ctx.stroke();

    // ─── TAIL (fluffy, curved) ───
    ctx.strokeStyle = '#8a95a5';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.7);
    ctx.quadraticCurveTo(r * 0.3, r * 1.1, r * 0.1, r * 1.3);
    ctx.stroke();
    // Tail tip (white)
    ctx.fillStyle = '#e0e5ec';
    ctx.beginPath();
    ctx.arc(r * 0.1, r * 1.3, r * 0.12, 0, TAU);
    ctx.fill();

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }
}
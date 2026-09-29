// Filename: ButterflyEnemy.js
// Kitty Vs Everything — v1.1.0
// Butterfly: fast fluttering dodger with large iridescent wings, spots,
// and a slim segmented body. Moves in rapid sine flutter, fires light shots.
export const VERSION = 'v1.1.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';

export default class ButterflyEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt * 0.8;
    this.x = this.baseX + Math.sin(this.t * 4) * 60;
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    const a = this.angleToPlayer();
    this.fireAtPlayer(a, 240, 0.9);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    const flap = Math.sin(this.t * 10) * 0.6;

    // ─── UPPER WINGS (large, iridescent) ───
    // Left upper
    ctx.save();
    ctx.rotate(flap * 0.7);
    const uwGradL = ctx.createRadialGradient(-r * 0.8, -r * 0.2, 0, -r * 0.8, -r * 0.2, r * 0.9);
    uwGradL.addColorStop(0, '#e0b0ff');
    uwGradL.addColorStop(0.5, this.color);
    uwGradL.addColorStop(1, '#7a3aaa');
    ctx.fillStyle = uwGradL;
    ctx.beginPath();
    ctx.ellipse(-r * 0.85, -r * 0.15, r * 0.75, r * 0.55, -0.3, 0, TAU);
    ctx.fill();
    // Wing spots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath(); ctx.arc(-r * 1.0, -r * 0.3, r * 0.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-r * 0.7, -r * 0.05, r * 0.08, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255, 200, 50, 0.4)';
    ctx.beginPath(); ctx.arc(-r * 1.1, -r * 0.05, r * 0.06, 0, TAU); ctx.fill();
    // Wing edge
    ctx.strokeStyle = 'rgba(100, 50, 150, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(-r * 0.85, -r * 0.15, r * 0.75, r * 0.55, -0.3, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // Right upper
    ctx.save();
    ctx.rotate(-flap * 0.7);
    const uwGradR = ctx.createRadialGradient(r * 0.8, -r * 0.2, 0, r * 0.8, -r * 0.2, r * 0.9);
    uwGradR.addColorStop(0, '#e0b0ff');
    uwGradR.addColorStop(0.5, this.color);
    uwGradR.addColorStop(1, '#7a3aaa');
    ctx.fillStyle = uwGradR;
    ctx.beginPath();
    ctx.ellipse(r * 0.85, -r * 0.15, r * 0.75, r * 0.55, 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath(); ctx.arc(r * 1.0, -r * 0.3, r * 0.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.7, -r * 0.05, r * 0.08, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255, 200, 50, 0.4)';
    ctx.beginPath(); ctx.arc(r * 1.1, -r * 0.05, r * 0.06, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(100, 50, 150, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(r * 0.85, -r * 0.15, r * 0.75, r * 0.55, 0.3, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // ─── LOWER WINGS (smaller) ───
    ctx.save();
    ctx.rotate(flap * 0.5);
    ctx.fillStyle = 'rgba(150, 80, 200, 0.7)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.6, r * 0.4, r * 0.5, r * 0.35, 0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath(); ctx.arc(-r * 0.7, r * 0.35, r * 0.07, 0, TAU); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.rotate(-flap * 0.5);
    ctx.fillStyle = 'rgba(150, 80, 200, 0.7)';
    ctx.beginPath();
    ctx.ellipse(r * 0.6, r * 0.4, r * 0.5, r * 0.35, -0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath(); ctx.arc(r * 0.7, r * 0.35, r * 0.07, 0, TAU); ctx.fill();
    ctx.restore();

    // ─── BODY (slim, segmented) ───
    const bodyGrad = ctx.createLinearGradient(0, -r * 0.7, 0, r * 0.7);
    bodyGrad.addColorStop(0, '#3a2a4a');
    bodyGrad.addColorStop(1, '#1a0a2a');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.2, r * 0.7, 0, 0, TAU);
    ctx.fill();
    // Segments
    ctx.strokeStyle = 'rgba(200, 150, 255, 0.3)';
    ctx.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.18, i * r * 0.15);
      ctx.lineTo(r * 0.18, i * r * 0.15);
      ctx.stroke();
    }

    // ─── HEAD ───
    ctx.fillStyle = '#2a1a3a';
    ctx.beginPath();
    ctx.arc(0, -r * 0.75, r * 0.15, 0, TAU);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-r * 0.08, -r * 0.78, r * 0.05, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.08, -r * 0.78, r * 0.05, 0, TAU); ctx.fill();
    // Antennae (curly)
    ctx.strokeStyle = '#2a1a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.05, -r * 0.85);
    ctx.quadraticCurveTo(-r * 0.2, -r * 1.2, -r * 0.1, -r * 1.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.05, -r * 0.85);
    ctx.quadraticCurveTo(r * 0.2, -r * 1.2, r * 0.1, -r * 1.3);
    ctx.stroke();
    // Antenna tips
    ctx.fillStyle = '#c77dff';
    ctx.beginPath(); ctx.arc(-r * 0.1, -r * 1.3, r * 0.04, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.1, -r * 1.3, r * 0.04, 0, TAU); ctx.fill();

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }
}
// Filename: BatEnemy.js
// Kitty Vs Everything — v1.1.0
// Bat: erratic flutterer with membrane wings (scalloped edges), fangs,
// and a small body. Moves in unpredictable random jitter.
export const VERSION = 'v1.1.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';

export default class BatEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    this.y += s * dt * 0.7;
    this.x += (Math.random() - 0.5) * s * dt * 3;
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

    const flap = Math.sin(this.t * 14) * 0.5;

    // ─── WINGS (membrane with scalloped edges) ───
    // Left wing
    ctx.save();
    ctx.rotate(flap);
    const lwGrad = ctx.createLinearGradient(-r * 1.5, 0, 0, 0);
    lwGrad.addColorStop(0, 'rgba(60, 60, 90, 0.8)');
    lwGrad.addColorStop(1, this.color);
    ctx.fillStyle = lwGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-r * 0.5, -r * 0.6, -r * 0.9, -r * 0.7);
    // Scalloped edge
    ctx.quadraticCurveTo(-r * 1.1, -r * 0.4, -r * 1.2, -r * 0.1);
    ctx.quadraticCurveTo(-r * 1.1, r * 0.1, -r * 1.0, r * 0.3);
    ctx.quadraticCurveTo(-r * 0.7, r * 0.4, -r * 0.4, r * 0.3);
    ctx.quadraticCurveTo(-r * 0.2, r * 0.2, 0, r * 0.3);
    ctx.closePath();
    ctx.fill();
    // Wing bones
    ctx.strokeStyle = 'rgba(20, 20, 40, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 0.9, -r * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 1.1, -r * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 0.9, r * 0.2); ctx.stroke();
    ctx.restore();

    // Right wing
    ctx.save();
    ctx.rotate(-flap);
    const rwGrad = ctx.createLinearGradient(0, 0, r * 1.5, 0);
    rwGrad.addColorStop(0, this.color);
    rwGrad.addColorStop(1, 'rgba(60, 60, 90, 0.8)');
    ctx.fillStyle = rwGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.5, -r * 0.6, r * 0.9, -r * 0.7);
    ctx.quadraticCurveTo(r * 1.1, -r * 0.4, r * 1.2, -r * 0.1);
    ctx.quadraticCurveTo(r * 1.1, r * 0.1, r * 1.0, r * 0.3);
    ctx.quadraticCurveTo(r * 0.7, r * 0.4, r * 0.4, r * 0.3);
    ctx.quadraticCurveTo(r * 0.2, r * 0.2, 0, r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 20, 40, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.9, -r * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.1, -r * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.9, r * 0.2); ctx.stroke();
    ctx.restore();

    // ─── BODY (small, round) ───
    const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.4);
    bodyGrad.addColorStop(0, '#7a7a9a');
    bodyGrad.addColorStop(1, this.color);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.35, 0, TAU);
    ctx.fill();

    // ─── HEAD ───
    ctx.fillStyle = '#5d5d7a';
    ctx.beginPath();
    ctx.arc(0, -r * 0.3, r * 0.22, 0, TAU);
    ctx.fill();

    // Ears (pointed, small)
    ctx.fillStyle = '#4a4a6a';
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, -r * 0.45);
    ctx.lineTo(-r * 0.25, -r * 0.75);
    ctx.lineTo(-r * 0.05, -r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.15, -r * 0.45);
    ctx.lineTo(r * 0.25, -r * 0.75);
    ctx.lineTo(r * 0.05, -r * 0.5);
    ctx.closePath();
    ctx.fill();

    // Eyes (red, glowing)
    ctx.fillStyle = '#ff1744';
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(-r * 0.1, -r * 0.32, r * 0.06, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.1, -r * 0.32, r * 0.06, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;

    // Fangs (two small triangles)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-r * 0.06, -r * 0.1);
    ctx.lineTo(-r * 0.04, r * 0.0);
    ctx.lineTo(-r * 0.08, r * 0.0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.06, -r * 0.1);
    ctx.lineTo(r * 0.04, r * 0.0);
    ctx.lineTo(r * 0.08, r * 0.0);
    ctx.closePath();
    ctx.fill();

    // ─── FEET (tiny claws) ───
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-r * 0.15, r * 0.3); ctx.lineTo(-r * 0.2, r * 0.45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.15, r * 0.3); ctx.lineTo(r * 0.2, r * 0.45); ctx.stroke();

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }
}
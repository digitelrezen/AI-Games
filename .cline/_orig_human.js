// Filename: HumanEnemy.js
// Everything Vs Kitty ΓÇö v1.1.0
// Human Ship: angular military craft with twin thrusters, a cockpit canopy,
// and side weapon pods. Strafes horizontally across the screen.
export const VERSION = 'v1.1.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from './utils.js';

export default class HumanEnemy extends EnemyBase {
  move(dt, slowMul) {
    const s = this.speed * slowMul;
    const dir = this.baseX < this.game.W / 2 ? 1 : -1;
    this.x += s * dt * dir;
    this.y += s * dt * 0.15;
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    // Fires straight down
    this.fireAtPlayer(Math.PI / 2, 300, 1);
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55;

    const thrusterFlicker = 0.6 + 0.4 * Math.sin(this.t * 15);

    // ΓöÇΓöÇΓöÇ THRUSTERS (twin, glowing) ΓöÇΓöÇΓöÇ
    // Left thruster
    const ltGrad = ctx.createRadialGradient(-r * 0.7, r * 0.6, 0, -r * 0.7, r * 0.6, r * 0.3 * thrusterFlicker);
    ltGrad.addColorStop(0, 'rgba(100, 200, 255, 0.9)');
    ltGrad.addColorStop(0.5, 'rgba(50, 100, 200, 0.5)');
    ltGrad.addColorStop(1, 'rgba(0, 50, 150, 0)');
    ctx.fillStyle = ltGrad;
    ctx.beginPath();
    ctx.ellipse(-r * 0.7, r * 0.6, r * 0.15 * thrusterFlicker, r * 0.25 * thrusterFlicker, 0, 0, TAU);
    ctx.fill();
    // Right thruster
    const rtGrad = ctx.createRadialGradient(r * 0.7, r * 0.6, 0, r * 0.7, r * 0.6, r * 0.3 * thrusterFlicker);
    rtGrad.addColorStop(0, 'rgba(100, 200, 255, 0.9)');
    rtGrad.addColorStop(0.5, 'rgba(50, 100, 200, 0.5)');
    rtGrad.addColorStop(1, 'rgba(0, 50, 150, 0)');
    ctx.fillStyle = rtGrad;
    ctx.beginPath();
    ctx.ellipse(r * 0.7, r * 0.6, r * 0.15 * thrusterFlicker, r * 0.25 * thrusterFlicker, 0, 0, TAU);
    ctx.fill();

    // ΓöÇΓöÇΓöÇ HULL (angular, military) ΓöÇΓöÇΓöÇ
    const hullGrad = ctx.createLinearGradient(0, -r * 0.8, 0, r * 0.6);
    hullGrad.addColorStop(0, '#5a8abf');
    hullGrad.addColorStop(0.5, this.color);
    hullGrad.addColorStop(1, '#2a4a6a');
    ctx.fillStyle = hullGrad;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.9);
    ctx.lineTo(r * 0.6, -r * 0.3);
    ctx.lineTo(r * 0.7, r * 0.5);
    ctx.lineTo(r * 0.4, r * 0.7);
    ctx.lineTo(-r * 0.4, r * 0.7);
    ctx.lineTo(-r * 0.7, r * 0.5);
    ctx.lineTo(-r * 0.6, -r * 0.3);
    ctx.closePath();
    ctx.fill();

    // Hull panel lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(0, r * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.3); ctx.lineTo(-r * 0.4, r * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.6, -r * 0.3); ctx.lineTo(r * 0.4, r * 0.5); ctx.stroke();

    // ΓöÇΓöÇΓöÇ SIDE WEAPON PODS ΓöÇΓöÇΓöÇ
    ctx.fillStyle = '#2a4a6a';
    // Left pod
    ctx.fillRect(-r * 0.9, -r * 0.1, r * 0.3, r * 0.5);
    ctx.fillStyle = '#1a3a5a';
    ctx.fillRect(-r * 0.85, r * 0.3, r * 0.2, r * 0.15);
    // Right pod
    ctx.fillStyle = '#2a4a6a';
    ctx.fillRect(r * 0.6, -r * 0.1, r * 0.3, r * 0.5);
    ctx.fillStyle = '#1a3a5a';
    ctx.fillRect(r * 0.65, r * 0.3, r * 0.2, r * 0.15);

    // ΓöÇΓöÇΓöÇ COCKPIT CANOPY (blue glow) ΓöÇΓöÇΓöÇ
    const canopyGrad = ctx.createLinearGradient(0, -r * 0.7, 0, -r * 0.3);
    canopyGrad.addColorStop(0, 'rgba(100, 200, 255, 0.9)');
    canopyGrad.addColorStop(1, 'rgba(30, 80, 150, 0.7)');
    ctx.fillStyle = canopyGrad;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.5, r * 0.25, r * 0.2, 0, 0, TAU);
    ctx.fill();
    // Canopy shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.08, -r * 0.55, r * 0.1, r * 0.08, -0.3, 0, TAU);
    ctx.fill();

    // ΓöÇΓöÇΓöÇ NAVIGATION LIGHTS (red/green) ΓöÇΓöÇΓöÇ
    ctx.fillStyle = '#ff5252';
    ctx.shadowColor = '#ff5252';
    ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(-r * 0.7, r * 0.5, r * 0.08, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4caf50';
    ctx.shadowColor = '#4caf50';
    ctx.beginPath(); ctx.arc(r * 0.7, r * 0.5, r * 0.08, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;

    // ΓöÇΓöÇΓöÇ WING TIPS (small fins) ΓöÇΓöÇΓöÇ
    ctx.fillStyle = '#3a6a9a';
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.3);
    ctx.lineTo(-r * 1.0, -r * 0.5);
    ctx.lineTo(-r * 0.7, -r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.6, -r * 0.3);
    ctx.lineTo(r * 1.0, -r * 0.5);
    ctx.lineTo(r * 0.7, -r * 0.1);
    ctx.closePath();
    ctx.fill();

    // ΓöÇΓöÇΓöÇ RIVETS / DETAIL ΓöÇΓöÇΓöÇ
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath(); ctx.arc(-r * 0.3, r * 0.2, r * 0.04, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.3, r * 0.2, r * 0.04, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, r * 0.4, r * 0.04, 0, TAU); ctx.fill();

    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }
}

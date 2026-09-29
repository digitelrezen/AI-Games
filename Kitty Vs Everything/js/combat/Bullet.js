// Filename: Bullet.js
// Kitty Vs Everything — v3.11.0
// Projectiles for both sides; supports pierce (rail), tracking (vulkan),
// shield-melt (plasma), and homing (aim-bot / super-weapon).
// v3.1.0: Replaced element with weapon type + per-weapon properties.
// v3.7.0: isNapalmRocket flag (E/J napalm rockets — visual carrier; the
//         damage is dealt as an instant AoE in fireNapalmRockets).
// v3.11.0: rocketKind ('stun' | 'napalm') + t clock — real flying rockets
//          (steered/detonated by Rockets.js) with full rocket art
//          (drawRocket: nose cone, fins, exhaust plume).
export const VERSION = 'v3.11.0';
import Entity from '../core/Entity.js';
import { TAU } from '../core/utils.js';
export default class Bullet extends Entity {
  constructor(opts) {
    super({ x: opts.x, y: opts.y, radius: opts.radius || 5, hp: 1, color: opts.color });
    this.vx = opts.vx;
    this.vy = opts.vy;
    this.damage = opts.damage ?? 10; // v3.11.0: ?? so 0-damage stun rockets stay 0
    this.weapon = opts.weapon || null;
    this.owner = opts.owner || null; // v3.20.0: the Player who fired this (score credit)
    this.friendly = opts.friendly !== false;
    this.life = opts.life || 2;
    this.pierce = opts.pierce || 0;
    this.homing = false;
    this.tracking = opts.tracking || 0;
    this.shieldMelt = opts.shieldMelt || 0;
    this.isStunRocket = false;      // legacy (v3.7.0) — superseded by rocketKind
    this.isNapalmRocket = false;    // legacy (v3.7.0) — superseded by rocketKind
    this.rocketKind = opts.rocketKind || null; // v3.11.0: 'stun' | 'napalm'
    this.t = 0;                     // v3.11.0: per-bullet clock (rocket visuals)
  }
  update(dt) {
    this.t += dt; // v3.11.0: rocket visual clock
    super.update(dt);
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }
  draw(ctx) {
    // v3.11.0: rockets get full art (nose cone, fins, exhaust plume).
    if (this.rocketKind === 'stun' || this.rocketKind === 'napalm') {
      this.drawRocket(ctx);
      return;
    }
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.pierce > 10 ? 14 : 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, TAU);
    ctx.fill();
    // Piercing beam trail
    if (this.pierce > 10) {
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > 0) {
        const trailLen = Math.min(30, speed * 0.02);
        const tx = -this.vx / speed * trailLen;
        const ty = -this.vy / speed * trailLen;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.radius * 1.5;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + tx, this.y + ty);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** v3.11.0: rocket art — nose cone, body, fins, animated exhaust plume. */
  drawRocket(ctx) {
    const a = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(a + Math.PI / 2); // nose = -Y in local space
    ctx.globalAlpha = Math.min(1, this.life * 2);
    const stun = this.rocketKind === 'stun';
    const body = stun ? '#26c6da' : '#e65100';
    const nose = stun ? '#80d8ff' : '#ff9800';
    const fin = stun ? '#8ef0ff' : '#ff6d00';
    // Exhaust plume (flickers)
    const flick = 0.7 + 0.3 * Math.sin(this.t * 40);
    ctx.fillStyle = stun ? `rgba(142,240,255,${0.55 * flick})` : `rgba(255,152,0,${0.6 * flick})`;
    ctx.beginPath();
    ctx.moveTo(-3.5, 8);
    ctx.lineTo(0, 8 + 9 * flick);
    ctx.lineTo(3.5, 8);
    ctx.closePath();
    ctx.fill();
    // Fins
    ctx.fillStyle = fin;
    ctx.beginPath(); ctx.moveTo(-4, 3); ctx.lineTo(-7.5, 9); ctx.lineTo(-3, 8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, 3); ctx.lineTo(7.5, 9); ctx.lineTo(3, 8); ctx.closePath(); ctx.fill();
    // Body
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -9);          // nose tip
    ctx.lineTo(4, -4);
    ctx.lineTo(4, 8);
    ctx.lineTo(-4, 8);
    ctx.lineTo(-4, -4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Nose cone
    ctx.fillStyle = nose;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(4, -4);
    ctx.lineTo(-4, -4);
    ctx.closePath();
    ctx.fill();
    // Window
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 1.8, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
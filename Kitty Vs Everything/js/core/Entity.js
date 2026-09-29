// Filename: Entity.js
// Kitty Vs Everything — v3.1.0
// Base class: position, HP/shield, stun timer.
// v3.1.0: Removed legacy elemental status (dot/slow/armor). Added stunTimer.
export const VERSION = 'v3.1.0';
import { TAU } from './utils.js';
export default class Entity {
  constructor(opts = {}) {
    this.x = opts.x || 0;
    this.y = opts.y || 0;
    this.radius = opts.radius || 16;
    this.hp = opts.hp || 10;
    this.maxHp = this.hp;
    this.shield = opts.shield || 0;
    this.maxShield = this.shield;
    this.color = opts.color || '#fff';
    this.alive = true;
    this.vx = 0;
    this.vy = 0;
    this.stunTimer = 0;
  }
  applyDamage(amount) {
    if (!this.alive) return;
    if (this.shield > 0) {
      const s = Math.min(this.shield, amount);
      this.shield -= s;
      amount -= s;
    }
    if (amount > 0) {
      this.hp -= amount;
      if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    }
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.stunTimer > 0) this.stunTimer = Math.max(0, this.stunTimer - dt);
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, TAU);
    ctx.fill();
  }
}
// Filename: ParticleSystem.js
// Kitty Vs Everything — v1.0.0
// Explosion particles + jagged lightning bolts (arc element visual).

export const VERSION = 'v1.0.0';
import { TAU, rand } from './utils.js';

export default class ParticleSystem {
  constructor() { this.parts = []; this.bolts = []; }
  burst(x, y, opts = {}) {
    const { count = 12, color = '#fff', speed = 200, life = 0.6, size = 3 } = opts;
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), s = rand(speed * 0.3, speed);
      this.parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(life * 0.5, life), maxLife: life, color, size: rand(size * 0.5, size),
      });
    }
  }
  lightning(x1, y1, x2, y2, color = '#b388ff') {
    const pts = [];
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const j = (i === 0 || i === n) ? 0 : rand(-14, 14);
      pts.push([x1 + (x2 - x1) * t + j, y1 + (y2 - y1) * t + j]);
    }
    this.bolts.push({ pts, color, life: 0.18 });
  }
  update(dt) {
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt; }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter(b => b.life > 0);
  }
  draw(ctx) {
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    for (const b of this.bolts) {
      ctx.globalAlpha = Math.max(0, b.life / 0.18);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.pts[0][0], b.pts[0][1]);
      for (const pt of b.pts) ctx.lineTo(pt[0], pt[1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  clear() { this.parts = []; this.bolts = []; }
}
// Filename: yellowCat.js
// Kitty Vs Everything — v3.1.0
// Yellow Tabby — Agile Baseline variant.
// Ultimate (F key): ENERGY RING EXPLOSION.
// v3.1.0: Removed element references from ultimate bullets.
export const VERSION = 'v3.1.0';
import Player from '../Player.js';
import Bullet from '../../combat/Bullet.js';
import { TAU, rand, dist2 } from '../../core/utils.js';
import { bus } from '../../core/EventBus.js';
import { audio } from '../../core/AudioSystem.js';

export default class YellowCat extends Player {
  constructor(game, theme = 'yellow') {
    super(game, theme);
    this.ultimateName = 'ENERGY RING EXPLOSION';
    this.ULTIMATE_COOLDOWN = 8.0;
  }
  activateUltimate() {
    const g = this.game;
    bus.emit('banner', { text: '⚡ ENERGY RING EXPLOSION! ⚡', tone: 'good', duration: 2 });
    audio.superWeapon();
    audio.tone(880, 0.4, 'sine', 0.06, 1760);
    const maxRange = 350;
    const maxRange2 = maxRange * maxRange;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      if (dist2(this.x, this.y, e.x, e.y) < maxRange2) {
        e.shield = Math.floor(e.shield * 0.5);
      }
    }
    for (let wave = 0; wave < 3; wave++) {
      const waveSpeed = 500 + wave * 150;
      const waveDamage = 30 - wave * 5;
      const waveColor = ['#ffd54f', '#ffab00', '#ff6f00'][wave];
      const bulletCount = 12;
      for (let i = 0; i < bulletCount; i++) {
        const a = (i / bulletCount) * TAU + wave * 0.1;
        g.bullets.push(new Bullet({
          x: this.x, y: this.y,
          vx: Math.cos(a) * waveSpeed, vy: Math.sin(a) * waveSpeed,
          damage: waveDamage, color: waveColor, friendly: true, life: 1.5, radius: 5,
        }));
      }
    }
    const knockRange2 = 200 * 200;
    for (const e of g.enemies) {
      if (!e.alive || e.special) continue;
      if (dist2(this.x, this.y, e.x, e.y) < knockRange2) {
        const dx = e.x - this.x;
        const dy = e.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        const pushForce = 300;
        e.x += (dx / d) * pushForce * 0.1;
        e.y += (dy / d) * pushForce * 0.1;
      }
    }
    for (let i = 0; i < 20; i++) {
      const a = rand(0, TAU);
      const r = rand(0, 80);
      g.particles.burst(
        this.x + Math.cos(a) * r,
        this.y + Math.sin(a) * r,
        { count: 2, color: '#ffd54f', speed: 80, life: 0.8, size: 2 }
      );
    }
    g.particles.burst(this.x, this.y, { count: 36, color: '#ffd54f', speed: 350, life: 0.7, size: 4 });
    g.particles.burst(this.x, this.y, { count: 20, color: '#ffffff', speed: 150, life: 0.4, size: 3 });
    g.particles.burst(this.x, this.y, { count: 16, color: '#ffab00', speed: 250, life: 0.5, size: 3 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + rand(-0.2, 0.2);
      const ex = this.x + Math.cos(a) * 120;
      const ey = this.y + Math.sin(a) * 120;
      g.particles.lightning(this.x, this.y, ex, ey, '#ffd54f');
    }
    g.shake = 12;
  }
}
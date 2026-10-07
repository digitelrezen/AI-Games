// Filename: orangeCat.js
// Kitty Vs Everything — v3.1.0
// Orange Tabby — Fiery Brawler variant.
// Ultimate (F key): NOVA SHOCKWAVE.
// v3.1.0: Removed element references from ultimate bullets.
export const VERSION = 'v3.1.0';
import Player from '../Player.js';
import Bullet from '../../combat/Bullet.js';
import { TAU, rand, dist2 } from '../../core/utils.js';
import { bus } from '../../core/EventBus.js';
import { audio } from '../../core/AudioSystem.js';

export default class OrangeCat extends Player {
  constructor(game, theme = 'white_orange') {
    super(game, theme);
    this.ultimateName = 'NOVA SHOCKWAVE';
    this.ULTIMATE_COOLDOWN = 10.0;
  }
  activateUltimate() {
    const g = this.game;
    bus.emit('banner', { text: '🔥 NOVA SHOCKWAVE! 🔥', tone: 'good', duration: 2 });
    audio.superWeapon();
    const shatterRange2 = 400 * 400;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      if (dist2(this.x, this.y, e.x, e.y) < shatterRange2) e.shield = 0;
    }
    const dmgRange2 = 250 * 250;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      if (dist2(this.x, this.y, e.x, e.y) < dmgRange2) {
        e.flash = 0.3;
        e.applyDamage(50);
      }
    }
    const bulletCount = 24;
    for (let i = 0; i < bulletCount; i++) {
      const a = (i / bulletCount) * TAU;
      g.bullets.push(new Bullet({
        x: this.x, y: this.y,
        vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
        damage: 35, color: '#ff9d3b', friendly: true, life: 1.8, radius: 6,
      }));
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + TAU / 16;
      g.bullets.push(new Bullet({
        x: this.x, y: this.y,
        vx: Math.cos(a) * 900, vy: Math.sin(a) * 900,
        damage: 55, color: '#ff5722', friendly: true, life: 1.2, radius: 8,
      }));
    }
    g.particles.burst(this.x, this.y, { count: 48, color: '#ff9d3b', speed: 400, life: 0.8, size: 5 });
    g.particles.burst(this.x, this.y, { count: 24, color: '#ffffff', speed: 200, life: 0.4, size: 4 });
    g.particles.burst(this.x, this.y, { count: 32, color: '#ff5722', speed: 300, life: 0.6, size: 3 });
    g.particles.burst(this.x, this.y, { count: 16, color: '#4a4a4a', speed: 100, life: 1.0, size: 6 });
    g.shake = 18;
    for (let ring = 0; ring < 3; ring++) {
      const ringRadius = 60 + ring * 50;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        g.particles.burst(
          this.x + Math.cos(a) * ringRadius,
          this.y + Math.sin(a) * ringRadius,
          { count: 2, color: ring === 0 ? '#fff' : (ring === 1 ? '#ff9d3b' : '#ff5722'), speed: 50, life: 0.5, size: 3 }
        );
      }
    }
  }
}
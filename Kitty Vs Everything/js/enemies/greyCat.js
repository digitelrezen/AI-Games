// Filename: greyCat.js
// Kitty Vs Everything — v3.0.0
// Gray Cat — Stealth/Tech variant.
// Ultimate (F key): BLACK HOLE PULL — creates a localized gravitational well
// that pulls all enemies toward a point ahead of the ship, compressing them
// into a dense cluster where they take massive damage and shield destruction.
export const VERSION = 'v3.0.0';
import Player from '../player/Player.js';
import Bullet from '../combat/Bullet.js';
import { TAU, rand, dist2, angleTo } from '../core/utils.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';

export default class GreyCat extends Player {
  constructor(game, theme = 'gray') {
    super(game, theme);
    this.ultimateName = 'BLACK HOLE PULL';
    this.ULTIMATE_COOLDOWN = 12.0;
  }

  /**
   * F KEY ULTIMATE: Black Hole Pull
   * - Creates a gravitational singularity 150px ahead of the ship
   * - Pulls ALL enemies within 300px toward the singularity point
   * - Deals 80 damage to all enemies pulled within 60px of center
   * - Destroys all shields of pulled enemies
   * - Visual: purple/black spiral particles converging + gravitational lensing ring
   */
  activateUltimate() {
    const g = this.game;
    bus.emit('banner', { text: '🌀 BLACK HOLE PULL! 🌀', tone: 'good', duration: 2 });
    audio.superWeapon();
    audio.tone(60, 1.0, 'sine', 0.1, 20);

    // ─── SINGULARITY POINT (150px ahead of ship) ───
    const singX = this.x + Math.cos(this.angle) * 150;
    const singY = this.y + Math.sin(this.angle) * 150;

    // ─── PULL ALL ENEMIES WITHIN 300px TOWARD SINGULARITY ───
    const pullRange2 = 300 * 300;
    const crushRange2 = 60 * 60;
    let crushed = 0;

    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d2 = dist2(this.x, this.y, e.x, e.y);
      if (d2 < pullRange2) {
        // Pull toward singularity
        const a = angleTo(e.x, e.y, singX, singY);
        const pullStrength = e.special ? 40 : 120;
        e.x += Math.cos(a) * pullStrength;
        e.y += Math.sin(a) * pullStrength;

        // Destroy shields
        e.shield = 0;

        // Check if crushed (within 60px of singularity center)
        if (dist2(e.x, e.y, singX, singY) < crushRange2) {
          e.flash = 0.4;
          e.applyDamage(80);
          crushed++;
        }
      }
    }

    // ─── FIRE 16 INWARD-CONVERGING BULLETS (visual + damage) ───
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const startX = singX + Math.cos(a) * 200;
      const startY = singY + Math.sin(a) * 200;
      const b = new Bullet({
        x: startX, y: startY,
        vx: Math.cos(a + Math.PI) * 600, vy: Math.sin(a + Math.PI) * 600,
        damage: 20, color: '#7c4dff', friendly: true, life: 0.5, radius: 4,
      });
      g.barticles = g.particles; // no-op, keep reference
      g.bullets.push(b);
    }

    // ─── VISUAL: SPIRAL PARTICLES CONVERGING ───
    for (let i = 0; i < 40; i++) {
      const a = rand(0, TAU);
      const r = rand(80, 250);
      const sx = singX + Math.cos(a) * r;
      const sy = singY + Math.sin(a) * r;
      g.particles.burst(sx, sy, {
        count: 2,
        color: i % 3 === 0 ? '#7c4dff' : (i % 3 === 1 ? '#4a148c' : '#1a0030'),
        speed: 200, life: 0.6, size: 3,
      });
    }

    // ─── VISUAL: GRAVITATIONAL LENSING RING ───
    for (let ring = 0; ring < 4; ring++) {
      const ringR = 30 + ring * 40;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        g.particles.burst(
          singX + Math.cos(a) * ringR,
          singY + Math.sin(a) * ringR,
          { count: 1, color: ring < 2 ? '#b388ff' : '#4a148c', speed: 30, life: 0.8, size: 2 }
        );
      }
    }

    // ─── VISUAL: DARK CENTER FLASH ───
    g.particles.burst(singX, singY, { count: 20, color: '#000000', speed: 50, life: 0.5, size: 8 });
    g.particles.burst(singX, singY, { count: 12, color: '#7c4dff', speed: 100, life: 0.7, size: 4 });

    // ─── SHOCKWAVE RING (expanding) ───
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      g.particles.burst(
        singX + Math.cos(a) * 100,
        singY + Math.sin(a) * 100,
        { count: 1, color: '#b388ff', speed: 150, life: 0.4, size: 3 }
      );
    }

    g.shake = 14;

    if (crushed > 0) {
      bus.emit('dmg', { x: singX, y: singY - 40, text: 'CRUSHED x' + crushed, color: '#7c4dff' });
    }
  }
}
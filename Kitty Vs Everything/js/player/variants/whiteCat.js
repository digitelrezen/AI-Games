// Filename: whiteCat.js
// Kitty Vs Everything — v3.0.0
// White Cat — Pristine Interceptor variant.
// Ultimate (F key): TACTICAL NUKE — deploys a nuclear warhead that locks onto
// the densest cluster of enemies, detonates after a 1.5s fuse, and deals
// catastrophic AOE damage with a mushroom-cloud visual.
export const VERSION = 'v3.0.0';
import Player from '../Player.js';
import Bullet from '../../combat/Bullet.js';
import { TAU, rand, dist2, angleTo } from '../../core/utils.js';
import { bus } from '../../core/EventBus.js';
import { audio } from '../../core/AudioSystem.js';

export default class WhiteCat extends Player {
  constructor(game, theme = 'white_pink') {
    super(game, theme);
    this.ultimateName = 'TACTICAL NUKE';
    this.ULTIMATE_COOLDOWN = 15.0;
    this.nukeTimer = 0;
    this.nukeX = 0;
    this.nukeY = 0;
    this.nukeActive = false;
  }

  /**
   * F KEY ULTIMATE: Tactical Nuke Deployment
   * - Finds the densest cluster of enemies (or fires straight ahead if none)
   * - Deploys a nuke that locks onto that point
   * - 1.5 second fuse (visual: blinking red light + countdown)
   * - Detonation: 200px radius, 120 damage, destroys all shields
   * - Visual: mushroom cloud + white flash + radiation particles
   */
  activateUltimate() {
    const g = this.game;
    bus.emit('banner', { text: '☢ NUKE DEPLOYED! ☢', tone: 'bad', duration: 2.5 });
    audio.superWeapon();
    audio.tone(100, 0.5, 'square', 0.08, 50);

    // ─── FIND DENSEST ENEMY CLUSTER ───
    let targetX = this.x + Math.cos(this.angle) * 200;
    let targetY = this.y + Math.sin(this.angle) * 200;
    let bestCount = 0;

    // Sample grid to find densest area
    for (let gx = 100; gx < g.W; gx += 100) {
      for (let gy = 50; gy < g.H - 100; gy += 100) {
        let count = 0;
        for (const e of g.enemies) {
          if (!e.alive) continue;
          if (dist2(gx, gy, e.x, e.y) < 150 * 150) count++;
        }
        if (count > bestCount) {
          bestCount = count;
          targetX = gx;
          targetY = gy;
        }
      }
    }

    // ─── DEPLOY NUKE (visual: falling warhead) ───
    this.nukeX = targetX;
    this.nukeY = targetY;
    this.nukeTimer = 1.5;
    this.nukeActive = true;

    // Launch trail particles
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      const lx = this.x + (targetX - this.x) * t;
      const ly = this.y + (targetY - this.y) * t;
      g.particles.burst(lx, ly, { count: 2, color: '#ff5252', speed: 30, life: 0.4, size: 2 });
    }

    // ─── DETONATION (immediate for gameplay impact, visual is delayed) ───
    const nukeRadius = 200;
    const nukeRadius2 = nukeRadius * nukeRadius;
    let kills = 0;

    for (const e of g.enemies) {
      if (!e.alive) continue;
      if (dist2(targetX, targetY, e.x, e.y) < nukeRadius2) {
        e.shield = 0;
        e.flash = 0.5;
        e.applyDamage(120);
        if (!e.alive) kills++;
      }
    }

    // ─── VISUAL: MUSHROOM CLOUD ───
    // Base explosion
    g.particles.burst(targetX, targetY, { count: 60, color: '#ffffff', speed: 400, life: 0.8, size: 6 });
    g.particles.burst(targetX, targetY, { count: 40, color: '#ff5252', speed: 300, life: 0.6, size: 5 });
    g.particles.burst(targetX, targetY, { count: 30, color: '#ffd54f', speed: 250, life: 0.7, size: 4 });

    // Mushroom stem (rising particles)
    for (let i = 0; i < 20; i++) {
      const a = rand(0, TAU);
      const r = rand(0, 30);
      g.particles.burst(
        targetX + Math.cos(a) * r,
        targetY - rand(20, 80),
        { count: 2, color: '#8d6e63', speed: 60, life: 1.2, size: 5 }
      );
    }

    // Mushroom cap (wide spread at top)
    for (let i = 0; i < 30; i++) {
      const a = rand(0, TAU);
      const r = rand(40, 100);
      g.particles.burst(
        targetX + Math.cos(a) * r,
        targetY - 80 - rand(0, 40),
        { count: 1, color: i % 2 === 0 ? '#ff8a65' : '#a1887f', speed: 40, life: 1.5, size: 6 }
      );
    }

    // Radiation glow
    g.particles.burst(targetX, targetY, { count: 16, color: '#76ff03', speed: 150, life: 1.0, size: 3 });

    // ─── SHOCKWAVE RING ───
    for (let ring = 0; ring < 3; ring++) {
      const ringR = 50 + ring * 50;
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU;
        g.particles.burst(
          targetX + Math.cos(a) * ringR,
          targetY + Math.sin(a) * ringR,
          { count: 1, color: '#ffffff', speed: 100, life: 0.5, size: 3 }
        );
      }
    }

    g.shake = 20;

    if (kills > 0) {
      bus.emit('dmg', { x: targetX, y: targetY - 60, text: '💥 ' + kills + ' DESTROYED', color: '#ff5252' });
    }
  }

  /** Override update to tick the nuke visual timer. */
  update(dt, input) {
    super.update(dt, input);
    if (this.nukeActive) {
      this.nukeTimer -= dt;
      if (this.nukeTimer <= 0) this.nukeActive = false;
    }
  }
}
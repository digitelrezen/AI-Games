// Filename: brownCat.js
// Kitty Vs Everything — v3.0.0
// Brown Cat — Rugged Support variant.
// Ultimate (F key): SHIELD OVERCHARGE & NANOBOOT REPAIR — a massive shield
// burst that overcharges the player's shield to 200% max, then deploys a
// swarm of nanobots that rapidly repair HP over 3 seconds. Also grants
// brief invulnerability and pushes nearby enemies away.
export const VERSION = 'v3.0.0';
import Player from '../Player.js';
import Bullet from '../../combat/Bullet.js';
import { TAU, rand, dist2 } from '../../core/utils.js';
import { bus } from '../../core/EventBus.js';
import { audio } from '../../core/AudioSystem.js';

export default class BrownCat extends Player {
  constructor(game, theme = 'brown') {
    super(game, theme);
    this.ultimateName = 'SHIELD OVERCHARGE';
    this.ULTIMATE_COOLDOWN = 14.0;
    this.repairTimer = 0;
    this.repairDuration = 3.0;
    this.shieldOvercharge = 0;
  }

  /**
   * F KEY ULTIMATE: Shield Overcharge & Nanobot Repair
   * - Overcharges shield to 200% of max (temporary bonus pool)
   * - Deploys nanobot swarm: repairs 15 HP/sec for 3 seconds
   * - Grants 1.5 seconds of invulnerability
   * - Pushes all enemies within 150px outward (defensive knockback)
   * - Strips shields from enemies within 120px (counter-attack)
   * - Visual: expanding cyan shield dome + green nanobot particles
   */
  activateUltimate() {
    const g = this.game;
    bus.emit('banner', { text: '🛡 SHIELD OVERCHARGE + NANOBOOT REPAIR! 🛡', tone: 'good', duration: 2.5 });
    audio.superWeapon();
    audio.tone(220, 0.6, 'sine', 0.08, 440);
    audio.tone(330, 0.8, 'triangle', 0.05, 660);

    // ─── SHIELD OVERCHARGE (200% max) ───
    const overchargeAmount = this.maxShield * 2.0;
    this.shield = Math.min(overchargeAmount, this.shield + this.maxShield * 1.5);
    this.shieldOvercharge = this.shield;

    // ─── NANOBOOT REPAIR (15 HP/sec for 3 sec = 45 total) ───
    this.repairTimer = this.repairDuration;

    // ─── INVULNERABILITY (1.5s) ───
    this.invuln = Math.max(this.invuln, 1.5);

    // ─── DEFENSIVE KNOCKBACK (push enemies within 150px) ───
    const knockRange2 = 150 * 150;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      if (dist2(this.x, this.y, e.x, e.y) < knockRange2) {
        const dx = e.x - this.x;
        const dy = e.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        const pushForce = e.special ? 60 : 150;
        e.x += (dx / d) * pushForce;
        e.y += (dy / d) * pushForce;
      }
    }

    // ─── COUNTER-ATTACK: STRIP SHIELDS (within 120px) ───
    const stripRange2 = 120 * 120;
    let stripped = 0;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      if (dist2(this.x, this.y, e.x, e.y) < stripRange2) {
        if (e.shield > 0) {
          e.shield = 0;
          stripped++;
        }
      }
    }

    // ─── VISUAL: SHIELD DOME (expanding cyan ring) ───
    for (let ring = 0; ring < 4; ring++) {
      const ringR = 30 + ring * 25;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        g.particles.burst(
          this.x + Math.cos(a) * ringR,
          this.y + Math.sin(a) * ringR,
          { count: 2, color: ring < 2 ? '#00e5ff' : '#4fc3f7', speed: 80, life: 0.8, size: 3 }
        );
      }
    }

    // ─── VISUAL: NANOBOOT SWARM (green particles orbiting) ───
    for (let i = 0; i < 30; i++) {
      const a = rand(0, TAU);
      const r = rand(20, 60);
      g.particles.burst(
        this.x + Math.cos(a) * r,
        this.y + Math.sin(a) * r,
        { count: 2, color: i % 2 === 0 ? '#69f0ae' : '#00e676', speed: 60, life: 1.0, size: 2 }
      );
    }

    // ─── VISUAL: REPAIR BEAMS (vertical green lines) ───
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const bx = this.x + Math.cos(a) * 40;
      const by = this.y + Math.sin(a) * 40;
      g.particles.lightning(bx, by, this.x, this.y, '#69f0ae');
    }

    // ─── VISUAL: SHIELD SHATTER (if enemies had shields) ───
    if (stripped > 0) {
      g.particles.burst(this.x, this.y, { count: 20, color: '#80d8ff', speed: 200, life: 0.5, size: 3 });
      bus.emit('dmg', { x: this.x, y: this.y - 40, text: 'SHIELDS STRIPPED x' + stripped, color: '#80d8ff' });
    }

    g.shake = 10;
  }

  /** Override update to tick nanobot repair. */
  update(dt, input) {
    super.update(dt, input);

    // ─── NANOBOOT REPAIR TICK ───
    if (this.repairTimer > 0) {
      this.repairTimer -= dt;
      const healAmount = 15 * dt; // 15 HP per second
      this.hp = Math.min(this.maxHp, this.hp + healAmount);

      // Visual: occasional green sparkle
      if (Math.random() < 0.3) {
        const a = rand(0, TAU);
        const r = rand(10, 35);
        this.game.particles.burst(
          this.x + Math.cos(a) * r,
          this.y + Math.sin(a) * r,
          { count: 1, color: '#69f0ae', speed: 20, life: 0.4, size: 2 }
        );
      }
    }

    // ─── SHIELD OVERCHARGE DECAY (slowly return to normal max) ───
    if (this.shield > this.maxShield) {
      this.shield = Math.max(this.maxShield, this.shield - 5 * dt);
    }
  }
}
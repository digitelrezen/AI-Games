// Filename: EnemyBase.js
// Kitty Vs Everything — v3.11.0 (boss-tier screen containment)
// Base class for all enemy species: core physics, health pools, stun timer,
// common update loop, and shared canvas draw helpers.
// v3.1.0: Removed ELEMENTS import and status.slow. Uses stunTimer from Entity.
// v3.35.0: BOSS HOVER + WRAP — special-tier (boss and above) enemies now
//          hold the upper-middle fight zone (with a gentle bob) and can pass
//          from one side of the screen to the other, instead of being pinned
//          to the arena edges (which left them stuck on the bottom).
export const VERSION = 'v3.35.0';
import Entity from '../core/Entity.js';
import { ENEMY_TYPES, TIERS } from '../core/config.js';
import { TAU, rand, clamp, angleTo } from '../core/utils.js';
import { onEnemyDeath } from '../combat/Combat.js';

export default class EnemyBase extends Entity {
  constructor({ type, tier, x, y, game, difficulty = 1 }) {
    const t = ENEMY_TYPES[type];
    const m = TIERS[tier];
    const diff = Math.max(0, difficulty || 1); // v3.30.0: wave difficulty (HP + damage only)
    super({
      x, y,
      radius: 16 * m.size,
      hp: Math.round(t.hp * m.hpMul * diff),
      shield: m.shield,
      color: t.color,
    });
    this.game = game;
    this.type = type;
    this.tier = tier;
    this.tierLabel = m.label;
    this.baseX = x;
    this.speed = t.speed * m.speedMul * 60;
    this.damage = t.damage * m.dmgMul * diff;
    this.fireRate = t.fireRate;
    this.score = m.score;
    this.special = !!m.special;
    this.pattern = t.pattern;
    this.accent = t.accent || this._deriveAccent(t.color);
    this.t = rand(0, TAU);
    this.shootTimer = rand(0.6, 1.6);
    this.specialTimer = rand(2.5, 4.0);
    this.flash = 0;
    this.escaped = false;
    this.deathHandled = false;
  }

  update(dt) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    const slowMul = this.stunTimer > 0 ? 0 : 1;
    this.move(dt, slowMul);

    if (this.maxShield > 0 && this.shield > 0 && this.shield < this.maxShield * 0.5) {
      this.shield = Math.min(this.maxShield * 0.5, this.shield + 10 * dt);
    }

    if (this.shootTimer <= 0 && this.y > 20 && this.y < this.game.H - 60 && this.stunTimer <= 0) {
      this.shootTimer = this.fireRate * rand(0.8, 1.2);
      this.attack();
    }

    if (this.special) {
      this.specialTimer -= dt;
      if (this.specialTimer <= 0) {
        this.specialTimer = this.tier === 'finalboss' ? 3.5 : 6;
        this.specialAttack();
      }
    }

    super.update(dt);

    // v3.11.0: BOSS CONTAINMENT — special-tier (boss and above) enemies
    // are kept on screen once they are fully inside (y > radius) instead
    // of the classic escape check. Normal mobs keep escaping
    // (off-screen = gone, no score).
    // v3.35.0: BOSS HOVER + WRAP — the old edge-clamp left bosses stuck on
    // the bottom of the screen. A boss now holds the upper-middle fight
    // zone (with a gentle bob) and can pass from one side of the screen to
    // the other. The species' move() still drives the horizontal weaving
    // (side-to-side, mostly centered); we only pin the vertical position
    // so the boss stays and fights.
    if (this.special) {
      if (this.y > this.radius) {
        const m = this.radius;
        // Hold the upper-middle fight zone with a gentle bob (dynamic).
        // Species that already hover above this line (dragon, falcon,
        // lizard, pink cat) are left to their own logic; species that would
        // otherwise drift to the bottom are pinned here.
        const hoverY = this.game.H * 0.30;
        const line = hoverY + Math.sin(this.t * 1.1) * 20;
        if (this.y > line) {
          const gap = this.y - line;
          // Snap to the hover line if close; ease up if far (a boss that
          // was stuck at the bottom before this fix).
          this.y = gap < 60 ? line : this.y - 300 * dt;
        }
        // Horizontal wrap: the boss can pass from one side to the other.
        if (this.x < -m) this.x = this.game.W + m;
        else if (this.x > this.game.W + m) this.x = -m;
      }
    } else if (this.y > this.game.H + 80 || this.x < -80 || this.x > this.game.W + 80) {
      this.escaped = true;
      this.alive = false;
      return;
    }
    if (!this.alive && !this.deathHandled && !this.escaped) {
      this.deathHandled = true;
      onEnemyDeath(this.game, this);
    }
  }

  move(dt, slowMul) {
    throw new Error(`EnemyBase.move() not implemented for type "${this.type}"`);
  }
  attack() {
    throw new Error(`EnemyBase.attack() not implemented for type "${this.type}"`);
  }
  specialAttack() {
    const p = this.game.player;
    if (this.tier === 'finalboss' && p) {
      const phase = this.hp / this.maxHp;
      if (phase > 0.66) {
        for (let i = 0; i < 18; i++) {
          this.game.spawnEnemyBullet(this.x, this.y, (i / 18) * TAU, 220, this.damage * 0.8, this.color);
        }
      } else if (phase > 0.33) {
        for (let i = 0; i < 10; i++) {
          this.game.spawnEnemyBullet(this.x, this.y, this.t * 2 + (i / 10) * TAU, 260, this.damage * 0.8, this.color);
        }
      } else {
        const a = angleTo(this.x, this.y, p.x, p.y);
        for (let i = -3; i <= 3; i++) {
          this.game.spawnEnemyBullet(this.x, this.y, a + i * 0.16, 320, this.damage * 0.9, this.color);
        }
      }
      this.game.shake = Math.max(this.game.shake, 8);
    } else {
      const n = this.tier === 'boss' ? 12 : 8;
      for (let i = 0; i < n; i++) {
        this.game.spawnEnemyBullet(this.x, this.y, (i / n) * TAU, 200, this.damage * 0.7, this.color);
      }
    }
  }
  draw(ctx) {
    throw new Error(`EnemyBase.draw() not implemented for type "${this.type}"`);
  }

  drawShieldRing(ctx) {
    if (this.shield <= 0) return;
    const pulse = 1 + 0.08 * Math.sin(this.t * 6);
    ctx.save();
    ctx.strokeStyle = `rgba(0, 229, 255, ${0.5 + 0.3 * Math.sin(this.t * 4)})`;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * pulse + 6, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  drawBossBar(ctx) {
    if (!this.special) return;
    const w = Math.max(60, this.radius * 2);
    const barY = this.y - this.radius - 18;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(this.x - w / 2, barY, w, 6);
    const hpFrac = this.hp / this.maxHp;
    const grad = ctx.createLinearGradient(this.x - w / 2, 0, this.x + w / 2, 0);
    grad.addColorStop(0, '#ff5252');
    grad.addColorStop(1, '#ff8a80');
    ctx.fillStyle = grad;
    ctx.fillRect(this.x - w / 2, barY, w * hpFrac, 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x - w / 2, barY, w, 6);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.tierLabel.toUpperCase() + ' ' + ENEMY_TYPES[this.type].name, this.x, barY - 5);
    ctx.textAlign = 'left';
  }

  applyFlash(ctx) {
    if (this.flash <= 0) return false;
    ctx.globalAlpha = 0.5 + 0.3 * (this.flash / 0.15);
    return true;
  }

  fireAtPlayer(angle, speed, dmgMul = 1) {
    this.game.spawnEnemyBullet(
      this.x, this.y + this.radius * 0.5,
      angle, speed, this.damage * dmgMul, this.color
    );
  }
  angleToPlayer() {
    const p = this.game.player;
    if (!p || p.dead) return Math.PI / 2;
    return angleTo(this.x, this.y, p.x, p.y);
  }
  _deriveAccent(base) {
    const hex = base.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const lr = Math.min(255, r + 80);
    const lg = Math.min(255, g + 80);
    const lb = Math.min(255, b + 80);
    return `rgb(${lr},${lg},${lb})`;
  }
}
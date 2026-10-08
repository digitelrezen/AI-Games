// Filename: hazards/HazardBase.js
// Kitty Vs Everything — v1.0.0 (v3.97.0 Hazards)
// Base class for all hazard types (config/hazards.js HAZARD_TYPES):
// non-lootable, shootable environmental obstacles. A hazard is created by
// HazardFactory with a position + heading, then drifts CONTINUOUSLY along
// that fixed heading (no steering, no AI) until one of:
//   • shot down by the player (Collisions.js friendly-bullet loop →
//     HazardManager.explode with byPlayer → score, ZERO loot)
//   • proximity-fuse trigger (types with proximityFuse — Prox Mine) or
//     direct contact with the player fleet → detonation (byPlayer: false)
//   • drift fully off-screen → silent despawn (no explosion, no score)
// Health/durability: applyDamage() honors the v3.83.0 off-screen kill gate
// (utils.isOnScreen) exactly like EnemyBase — a hazard can only be hurt
// while it is visible, so detonations always happen where the player can
// see them.
// Rendering: the 256×256 hazard PNG (tools/import-assets.mjs, key
// "hazard_<type>", embedded 128×128) through the AssetManager pipeline,
// with a procedural drum/bomb glyph as the null-sprite fallback per the
// AssetManager contract.
export const VERSION = 'v1.0.0';
import Entity from '../core/Entity.js';
import { HAZARD_TYPES } from '../core/config.js';
import { TAU, rand, dist2, isOnScreen } from '../core/utils.js';
import { getSprite, getDims } from '../core/AssetManager.js';

export default class HazardBase extends Entity {
  /**
   * @param {object} o { type, x, y, angle, speed, game }
   *   angle  heading in radians (the fixed drift direction)
   *   speed drift speed in px/s (defaults to HAZARD_TYPES[type].speed)
   */
  constructor({ type, x, y, angle, speed, game }) {
    const t = HAZARD_TYPES[type];
    if (!t) throw new Error(`Unknown hazard type "${type}"`);
    super({ x, y, radius: t.radius, hp: t.hp, shield: 0, color: t.color });
    this.game = game;
    this.type = type;
    this.spec = t;
    this.angle = angle;
    this.speed = speed != null ? speed : t.speed;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.t = rand(0, TAU);
    this.flash = 0;
    this.escaped = false;
    this.deathHandled = false;
    this.proximityFuse = t.proximityFuse || 0;
  }

  update(dt) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    // Continuous drift along the fixed heading.
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const players = (this.game.players && this.game.players.length) ? this.game.players : [this.game.player];
    for (const p of players) {
      if (!p || p.dead) continue;
      // Proximity fuse — armed trigger radius (detonates BEFORE contact).
      if (this.proximityFuse > 0) {
        const fr = this.proximityFuse + p.radius;
        if (dist2(this.x, this.y, p.x, p.y) < fr * fr) { this._detonate(false); return; }
      }
      // Direct contact — the hazard detonates on the hull.
      const cr = this.radius + p.radius;
      if (dist2(this.x, this.y, p.x, p.y) < cr * cr) { this._detonate(false); return; }
      // Docked / orbiting mini-ships are part of the fleet too.
      for (const m of p.minis || []) {
        if (!m.alive) continue;
        const mr = this.radius + m.radius;
        if (dist2(this.x, this.y, m.x, m.y) < mr * mr) { this._detonate(false); return; }
      }
    }

    // Drifted fully off-screen → silent despawn (no explosion, no score,
    // no loot — the hazard simply leaves the playfield).
    const m = this.radius + 32;
    if (this.x < -m || this.x > this.game.W + m || this.y < -m || this.y > this.game.H + m) {
      this.escaped = true;
      this.alive = false;
    }
  }

  /** v3.83.0 off-screen kill gate — hazards only take damage on-screen. */
  applyDamage(amount) {
    if (!this.alive) return;
    if (!isOnScreen(this.game, this.x, this.y, this.radius)) return;
    super.applyDamage(amount);
  }

  draw(ctx) {
    const r = this.radius;
    const key = 'hazard_' + this.type;
    ctx.save();
    ctx.translate(this.x, this.y);
    const sprite = getSprite(key);
    if (sprite) {
      const dims = getDims(key);
      const targetW = r * 3.0;
      const targetH = dims ? (targetW * dims.h) / dims.w : targetW;
      const wobble = Math.sin(this.t * 2.2) * 0.06; // slow drift roll
      ctx.rotate(wobble);
      ctx.imageSmoothingEnabled = false;
      // Accent glow pass, then the crisp sprite (hit flash dims it).
      ctx.globalAlpha = 0.30;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = r * 0.8;
      ctx.drawImage(sprite, -targetW / 2, -targetH / 2, targetW, targetH);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = this.flash > 0 ? 0.55 : 1;
      ctx.drawImage(sprite, -targetW / 2, -targetH / 2, targetW, targetH);
    } else {
      this._drawProcedural(ctx, r);
    }
    ctx.restore();

    // Durability arc — visible only once the hazard has been hit.
    if (this.alive && this.hp < this.maxHp) {
      const frac = Math.max(0, this.hp / this.maxHp);
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r + 6, -Math.PI / 2, -Math.PI / 2 + TAU);
      ctx.stroke();
      ctx.strokeStyle = frac > 0.5 ? '#76ff03' : (frac > 0.25 ? '#ffd740' : '#ff5252');
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
      ctx.stroke();
      ctx.restore();
    }

    // Proximity-fuse warning ring — blinks faster as the player closes in.
    if (this.alive && this.proximityFuse > 0) {
      const p = this.game.player;
      const near = p && !p.dead && dist2(this.x, this.y, p.x, p.y) < (this.proximityFuse * 2.2) ** 2;
      const blink = near ? (0.5 + 0.5 * Math.sin(this.t * 24)) : 0.25;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 64, 129, ${0.15 + 0.45 * blink})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.proximityFuse, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  /**
   * Proximity-fuse / contact detonation (update loop). byPlayer is always
   * false here — these are self-detonations, so they score nothing and
   * drop nothing (the blast FX + AoE damage still apply).
   */
  _detonate(byPlayer) {
    if (this.deathHandled) return;
    this.game.hazards.explode(this.game, this, { byPlayer }); // sets deathHandled
  }

  // Procedural fallback (drum/bomb glyph) — drawn when the sprite is
  // unavailable (null-sprite contract, AssetManager).
  _drawProcedural(ctx, r) {
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, this.color);
    grad.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    // Hazard band.
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 235, 59, 0.85)';
    ctx.lineWidth = r * 0.35;
    ctx.beginPath();
    ctx.moveTo(-r * 1.2, r * 0.45);
    ctx.lineTo(r * 1.2, -r * 0.45);
    ctx.stroke();
    ctx.restore();
    // Blinking core (arm indicator).
    const blink = 0.5 + 0.5 * Math.sin(this.t * 8);
    ctx.fillStyle = `rgba(255, 82, 82, ${0.4 + 0.6 * blink})`;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(-r * 0.08, -r * 0.08, r * 0.1, 0, TAU);
    ctx.fill();
  }
}
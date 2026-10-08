// Filename: TestAimbot.js
// Kitty Vs Everything — v3.47.0
// DEVELOPER-ONLY test aimbot (debug tooling — NOT gameplay). Toggled from
// the Dev Panel (TEST AIMBOT button) or the F8 hotkey (v3.47.0 — moved from
// T, which now triggers Fleet Orbit (v3.96.0); status banner +
// MessageLog entry on every toggle.
// While engaged:
//   • locks onto the NEAREST valid enemy (any tier — bosses included)
//   • leads the target from its live velocity (positional delta) and snaps
//     the ship's heading onto the lead solution each frame
//   • auto-fires the player's current weapon at the NORMAL cadence via
//     fireNow() (no double cooldown decay — tryFire owns fireTimer)
//   • PlayerWeapons/MiniShip also grant bullets homing while active (same
//     gate as the robot aimbot)
//   • draws the trajectory line, lead marker, target reticle, and a readout
//     (name/tier/HP/range/lead-time/DPS) for weapon testing
// It never mutates enemy state, scoring, or drops — it only aims and fires
// through the normal weapon path.
export const VERSION = 'v3.47.0';
import { TAU } from '../core/utils.js';
import { WEAPONS } from '../core/config.js';
import { bus } from '../core/EventBus.js';
import { fireNow } from '../player/PlayerWeapons.js';

const LOOKAHEAD_MAX = 0.9; // s — cap on predicted projectile travel time

export default class TestAimbot {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.target = null;     // locked enemy
    this.aimPoint = null;   // {x, y, t} lead solution (world space)
    this.dps = 0;           // smoothed damage/s dealt to the current target
    this._prev = new Map(); // enemy → {x, y} previous frame (velocity est.)
    this._prevTarget = null;
    this._prevHp = 0;
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.code !== 'F8') return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      this.toggle();
    });
  }

  toggle() {
    const g = this.game;
    if (!g.player || g.state === 'menu') return;
    this.active = !this.active;
    this.target = null;
    this.dps = 0;
    const msg = this.active ? 'TEST AIMBOT: ENGAGED (F8 to disengage)' : 'TEST AIMBOT: DISENGAGED';
    bus.emit('banner', { text: msg, tone: this.active ? 'bad' : 'info', duration: 1.4 });
    if (g.msglog) g.msglog.log(msg, this.active ? 'warn' : 'info', g.time);
    bus.emit('testAimbotChanged');
  }

  update(dt) {
    const g = this.game, p = g.player;
    if (!p || p.dead) { this.target = null; this.aimPoint = null; return; }

    // Velocity estimate for every alive enemy (positional delta / dt).
    const prev = this._prev;
    const next = new Map();
    const inv = dt > 0 ? 1 / dt : 0;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const old = prev.get(e);
      e._abVx = old ? (e.x - old.x) * inv : 0;
      e._abVy = old ? (e.y - old.y) * inv : 0;
      next.set(e, { x: e.x, y: e.y });
    }
    this._prev = next;

    if (!this.active) { this.target = null; this.aimPoint = null; return; }

    // ─── TARGET SELECTION: nearest valid enemy (bosses included) ───
    let best = null, bestD = Infinity;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    this.target = best;
    if (!best) { this.aimPoint = null; return; }

    // ─── LEAD SOLUTION ───
    const w = WEAPONS[p.weapon] || WEAPONS.vulkan;
    const tFlight = Math.min(LOOKAHEAD_MAX, bestD / w.speed);
    this.aimPoint = {
      x: best.x + (best._abVx || 0) * tFlight,
      y: best.y + (best._abVy || 0) * tFlight,
      t: tFlight,
    };

    // ─── LOCK: snap heading onto the lead solution (fast lerp) ───
    const desired = Math.atan2(this.aimPoint.y - p.y, this.aimPoint.x - p.x);
    let diff = desired - p.angle;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    p.angle += diff * Math.min(1, dt * 14);

    // ─── DPS SAMPLE (damage the target takes, exponentially smoothed) ───
    if (best !== this._prevTarget) {
      this._prevTarget = best;
      this._prevHp = best.hp;
      this.dps = 0;
    }
    const deltaHp = this._prevHp - best.hp;
    this._prevHp = best.hp;
    this.dps = this.dps * 0.9 + (deltaHp > 0 ? deltaHp / Math.max(dt, 1e-4) * 0.1 : 0);

    // ─── AUTO-FIRE at the normal cadence (fireNow gates on fireTimer) ───
    fireNow(p);
  }

  draw(ctx) {
    if (!this.active) return;
    const g = this.game, p = g.player;
    if (!p) return;
    const t = this.target, a = this.aimPoint;
    ctx.save();
    if (!t || !a) {
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = 'rgba(255,82,82,0.85)';
      ctx.textAlign = 'left';
      ctx.fillText('TEST AIMBOT — NO TARGET', 12, 130);
      ctx.restore();
      return;
    }
    // trajectory line (ship → lead point)
    ctx.strokeStyle = 'rgba(0,255,170,0.5)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(a.x, a.y); ctx.stroke();
    // lead marker
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(0,255,170,0.9)';
    ctx.beginPath(); ctx.arc(a.x, a.y, 6, 0, TAU); ctx.stroke();
    // rotating target reticle
    const rot = (performance.now() / 400) % TAU;
    const r = (t.radius || 16) + 8;
    ctx.strokeStyle = 'rgba(255,82,82,0.9)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const a0 = rot + (i / 4) * TAU;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, a0, a0 + 0.7);
      ctx.stroke();
    }
    // readout (name/tier/HP/range/lead/DPS)
    const lines = [
      'TARGET: ' + String(t.type || 'ENEMY').toUpperCase() + (t.tier && t.tier !== 'mob' ? ' [' + String(t.tier).toUpperCase() + ']' : ''),
      'HP ' + Math.max(0, Math.ceil(t.hp)) + '/' + Math.ceil(t.maxHp || t.hp) + '   RNG ' + Math.round(Math.hypot(t.x - p.x, t.y - p.y)) + 'px',
      'LEAD ' + (a.t * 1000).toFixed(0) + 'ms   DPS ' + Math.round(this.dps),
    ];
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,255,170,0.95)';
    const bx = Math.min(t.x + r + 10, (g.viewW || 1280) - 175);
    const by = Math.max(12, t.y - 24);
    lines.forEach((s, i) => ctx.fillText(s, bx, by + i * 12));
    ctx.restore();
  }
}
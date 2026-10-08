// Filename: RadarManager.js
// Kitty Vs Everything — v3.99.0
// SEARCH & DESTROY — avionics: the cockpit radar HUD.
//
// A toggleable cockpit overlay (F1 — SAR.RADAR.KEY, DevPanel-style window
// listener) + a transparent radar panel showing real-time blips:
//   • regional enemies   — tier-colored (mob white → boss red)
//   • power-ups          — green
//   • journey zones      — the boneyard / deep-sector boundary lines
//   • the target base    — Eridath's Mom's House (magenta square +
//                          distance readout; rim-pinned when out of range)
//
// The radar is PLAYER-CENTERED: every blip is the entity's world
// position (SectorMap.screenToWorld) projected relative to the player's
// world position, scaled to the radar range (SAR.RADAR.RANGE world px →
// SAR.RADAR.R screen px).
export const VERSION = 'v1.0.0';
import { SAR, sarProgress } from '../../core/config.js';
import { TAU, clamp } from '../../core/utils.js';

const TIER_COLORS = {
  mob: '#e0e0e0',
  champion: '#ffd54f',
  miniboss: '#ff8a65',
  boss: '#ff5252',
  finalboss: '#ff1744',
};

export default class RadarManager {
  constructor(game, map) {
    this.game = game;
    this.map = map;
    this.visible = true; // SAR opens with avionics up
    this.sweep = 0;
    this._onKey = (e) => {
      if (e.code !== SAR.RADAR.KEY) return;
      if (this.game.state !== 'playing') return;
      e.preventDefault();
      this.visible = !this.visible;
      this.game.msglog.log('RADAR ' + (this.visible ? 'ON' : 'OFF'), 'info', this.game.time);
    };
    window.addEventListener('keydown', this._onKey);
  }

  /** Remove the key listener (mode teardown / restart). */
  destroy() {
    window.removeEventListener('keydown', this._onKey);
  }

  /** Per-frame driver (sweep animation). */
  update(dt) {
    this.sweep = (this.sweep + dt * 1.6) % TAU;
  }

  /**
   * Render the cockpit overlay + radar panel (Game.render, after the
   * classic HUD — screen space, top of the stack).
   */
  render(ctx) {
    const g = this.game;
    if (!this.visible || !g.player || g.player.dead) return;
    const W = g.viewW, H = g.viewH;
    this._drawCockpit(ctx, W, H);
    const R = SAR.RADAR.R;
    const cx = W - R - 24;
    const cy = H - R - 24;
    this._drawPanel(ctx, cx, cy, R);
    this._drawBlips(ctx, cx, cy, R);
    this._drawHouseBlip(ctx, cx, cy, R);
    this._drawReadout(ctx, cx, cy, R);
  }

  // ─── COCKPIT OVERLAY (subtle avionics frame) ───

  _drawCockpit(ctx, W, H) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.22)';
    ctx.lineWidth = 2;
    const m = 14, len = 46;
    // Corner brackets.
    for (const [x, y, dx, dy] of [
      [m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * len, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * len);
      ctx.stroke();
    }
    // Top avionics strip.
    ctx.fillStyle = 'rgba(0, 229, 255, 0.5)';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('AVIONICS — SEARCH & DESTROY', m + 10, m + 22);
    ctx.textAlign = 'right';
    ctx.fillText('RADAR ' + (this.visible ? 'ON' : 'OFF') + ' [' + SAR.RADAR.KEY + ']', W - m - 10, m + 22);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  // ─── RADAR PANEL (transparent circular scope) ───

  _drawPanel(ctx, cx, cy, R) {
    ctx.save();
    // Transparent scope background.
    const bg = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
    bg.addColorStop(0, 'rgba(0, 40, 48, 0.55)');
    bg.addColorStop(1, 'rgba(0, 20, 26, 0.72)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    // Rings + cross.
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
    ctx.lineWidth = 1;
    for (const f of [0.33, 0.66, 1]) {
      ctx.beginPath();
      ctx.arc(cx, cy, R * f, 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R);
    ctx.lineTo(cx, cy + R);
    ctx.stroke();
    // Rim.
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    // Sweep (wedge — conic gradients are not universally supported).
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    ctx.fillStyle = 'rgba(0, 229, 255, 0.14)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, this.sweep - 0.7, this.sweep);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(this.sweep) * R, cy + Math.sin(this.sweep) * R);
    ctx.stroke();
    ctx.restore();
    // Journey zone boundary lines (world x → radar offset).
    this._drawZoneLines(ctx, cx, cy, R);
    ctx.restore();
  }

  _drawZoneLines(ctx, cx, cy, R) {
    const p = this.map.playerWorld();
    const scale = R / SAR.RADAR.RANGE;
    for (let i = 0; i < SAR.ZONES.length - 1; i++) {
      const bx = SAR.ZONES[i].x1;
      const dx = (bx - p.x) * scale;
      if (Math.abs(dx) > R) continue;
      ctx.save();
      ctx.strokeStyle = i === 0 ? 'rgba(255, 213, 79, 0.4)' : 'rgba(255, 82, 82, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      // The boundary is a vertical world line — on the player-centered
      // radar it is a vertical screen line at offset dx (rotation is
      // ignored for the map readout — a chart, not a scope image).
      ctx.moveTo(cx + dx, cy - R);
      ctx.lineTo(cx + dx, cy + R);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = i === 0 ? 'rgba(255, 213, 79, 0.8)' : 'rgba(255, 82, 82, 0.85)';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(i === 0 ? 'BONEYARD' : 'DEEP SECTOR', cx + dx, cy - R + 12);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  // ─── BLIPS (enemies + power-ups, tier-colored) ───

  /** Entity screen pos → radar pos (player-centered, range-scaled). */
  _blipPos(sx, sy, cx, cy, R) {
    const e = this.map.screenToWorld(sx, sy);
    const p = this.map.screenToWorld(this.game.player.x, this.game.player.y);
    const scale = R / SAR.RADAR.RANGE;
    let dx = (e.x - p.x) * scale;
    let dy = (e.y - p.y) * scale;
    const d = Math.hypot(dx, dy);
    let off = false;
    if (d > R - 6) {
      dx = (dx / d) * (R - 6);
      dy = (dy / d) * (R - 6);
      off = true;
    }
    return { x: cx + dx, y: cy + dy, off };
  }

  _drawBlips(ctx, cx, cy, R) {
    const g = this.game;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R - 2, 0, TAU);
    ctx.clip();
    let count = 0;
    // Enemies (tier-colored).
    for (const e of g.enemies) {
      if (!e.alive || count >= SAR.RADAR.BLIP_CAP) continue;
      const b = this._blipPos(e.x, e.y, cx, cy, R);
      const color = TIER_COLORS[e.tier] || '#e0e0e0';
      const r = e.special ? 4 : 2.5;
      ctx.fillStyle = color;
      ctx.globalAlpha = b.off ? 0.6 : 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, TAU);
      ctx.fill();
      count++;
    }
    // Power-ups (green).
    for (const pw of g.powerups) {
      if (!pw.alive || pw.destructible || count >= SAR.RADAR.BLIP_CAP) continue;
      const b = this._blipPos(pw.x, pw.y, cx, cy, R);
      ctx.fillStyle = '#69f0ae';
      ctx.globalAlpha = b.off ? 0.6 : 1;
      ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
      count++;
    }
    // Player (center — the ship).
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx + 4, cy + 4);
    ctx.lineTo(cx - 4, cy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ─── TARGET BASE BLIP (magenta square + distance) ───

  _drawHouseBlip(ctx, cx, cy, R) {
    const combat = this.game.sard && this.game.sard.combat;
    if (!combat || !combat.house) return;
    const h = combat.house;
    ctx.save();
    const hs = this.map.worldToScreen(h.x, h.y);
    const b = this._blipPos(hs.x, hs.y, cx, cy, R);
    // World distance (km = world px / 1000).
    const p = this.map.playerWorld();
    const km = Math.hypot(p.x - h.x, p.y - h.y) / 1000;
    if (h.alive) {
      ctx.fillStyle = '#ff69b4';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.fillRect(b.x - 4, b.y - 4, 8, 8);
      ctx.strokeRect(b.x - 4, b.y - 4, 8, 8);
      ctx.fillStyle = '#ffb8e2';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(km.toFixed(1) + 'km', b.x, b.y - 8);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = 'rgba(255, 105, 180, 0.5)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('X', b.x, b.y + 3);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  // ─── READOUT (range + journey progress) ───

  _drawReadout(ctx, cx, cy, R) {
    const g = this.game;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 229, 255, 0.75)';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RNG ' + (SAR.RADAR.RANGE / 1000).toFixed(1) + 'km', cx, cy + R + 14);
    const prog = Math.round(sarProgress(this.map.playerWorld().x) * 100);
    ctx.fillText('JOURNEY ' + prog + '%', cx, cy + R + 26);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

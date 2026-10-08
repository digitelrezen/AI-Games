// Filename: SectorMap.js
// Kitty Vs Everything — v3.99.0
// SEARCH & DESTROY — the sector map: a large 2D world-space coordinate
// grid + the rotational background camera.
//
// Camera model: the camera owns a world position (x, y) + a background
// rotation (angle). The player flies in SCREEN space (the classic combat
// stack is untouched — full parity); the camera converts:
//   • PAN    — the player's screen-space velocity scrolls the world
//              (× CAMERA.PAN_FACTOR), and the tether clamps the player
//              near the screen center: beyond the dead zone the camera
//              pans 1:1 with the overflow, so the ship never leaves the
//              screen (classic wrap bounds disabled — the world scrolls).
//   • ROTATE — the background rotates toward the ship's heading
//              (× CAMERA.ROTATION_INFLUENCE): the "rotational background
//              camera shift" relative to the movement vector.
// The background (3-layer parallax starfield, reference planets, sector
// grid, journey zone bands, boneyard debris texture, the house base)
// renders in world space through the camera transform; gameplay entities
// render in screen space above it (Game.render).
//
// Pure camera + rendering — no gameplay state. The house's live state
// (hp / flash / alive) is passed in from SectorCombatManager at draw time.
export const VERSION = 'v1.0.0';
import { SAR } from '../../core/config.js';
import { TAU, clamp } from '../../core/utils.js';
import { getSprite } from '../../core/AssetManager.js';

/** Deterministic PRNG (mulberry32) — the sector layout is identical every run. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Parallax starfield layers: f = parallax factor (0 = pinned far, 1 =
// full camera lock). Far layers drift/rotate less — depth for free.
const STAR_LAYERS = [
  { f: 0.25, n: 240, size: 1.4, alpha: 0.45 },
  { f: 0.5, n: 170, size: 2.0, alpha: 0.65 },
  { f: 0.8, n: 120, size: 2.6, alpha: 0.85 },
];

export default class SectorMap {
  constructor(game) {
    this.game = game;
    this.cam = { x: SAR.START.x, y: SAR.START.y, angle: 0 };
    this.time = 0;
    this.layers = this._makeStarLayers();
    this.planets = this._makePlanets();
    this.boneMarks = this._makeBoneMarks();
  }

  /** Fresh sector per mission (camera back at the start coordinates). */
  reset() {
    this.cam.x = SAR.START.x;
    this.cam.y = SAR.START.y;
    this.cam.angle = 0;
    this.time = 0;
  }

  _makeStarLayers() {
    return STAR_LAYERS.map((spec, li) => {
      const rng = mulberry32(0xC0FFEE + li * 7919);
      const stars = [];
      for (let i = 0; i < spec.n; i++) {
        stars.push({ x: rng() * SAR.SECTOR.W, y: rng() * SAR.SECTOR.H, tw: rng() * TAU });
      }
      return { f: spec.f, size: spec.size, alpha: spec.alpha, stars };
    });
  }

  _makePlanets() {
    // Reference planets at fixed world positions (full camera transform).
    const rng = mulberry32(0xB0B);
    const hues = [210, 280, 160, 330];
    const out = [];
    for (let i = 0; i < 4; i++) {
      out.push({
        x: 4000 + rng() * (SAR.SECTOR.W - 8000),
        y: 1500 + rng() * (SAR.SECTOR.H - 3000),
        r: 80 + rng() * 100,
        hue: hues[i % hues.length],
        ring: rng() > 0.5,
        spin: rng() * TAU,
      });
    }
    return out;
  }

  _makeBoneMarks() {
    // Faint debris texture across THE BONEYARD band (world space) — the
    // yard's "floor" (the shootable debris itself is screen-space
    // bonusTargets spawned by SectorSpawner).
    const rng = mulberry32(0xB0BE);
    const z = SAR.ZONES[1];
    const out = [];
    for (let i = 0; i < 60; i++) {
      out.push({
        x: z.x0 + rng() * (z.x1 - z.x0),
        y: rng() * SAR.SECTOR.H,
        r: 14 + rng() * 30,
        a: rng() * TAU,
      });
    }
    return out;
  }

  // ─── COORDINATE TRANSFORMS (camera pan + rotation) ───

  /** Screen → world (through the camera pan + rotation). */
  screenToWorld(sx, sy) {
    const g = this.game;
    const dx = sx - g.viewW / 2;
    const dy = sy - g.viewH / 2;
    const c = Math.cos(this.cam.angle);
    const s = Math.sin(this.cam.angle);
    return { x: this.cam.x + dx * c - dy * s, y: this.cam.y + dx * s + dy * c };
  }

  /** World → screen (inverse of screenToWorld). */
  worldToScreen(wx, wy) {
    const g = this.game;
    const dx = wx - this.cam.x;
    const dy = wy - this.cam.y;
    const c = Math.cos(-this.cam.angle);
    const s = Math.sin(-this.cam.angle);
    return { x: g.viewW / 2 + dx * c - dy * s, y: g.viewH / 2 + dx * s + dy * c };
  }

  /** The player's live world position (screen pos → world). */
  playerWorld() {
    const p = this.game.player;
    return this.screenToWorld(p.x, p.y);
  }

  /** The visible world rectangle (for background culling). */
  visibleRect() {
    const g = this.game;
    const pts = [
      this.screenToWorld(0, 0),
      this.screenToWorld(g.viewW, 0),
      this.screenToWorld(0, g.viewH),
      this.screenToWorld(g.viewW, g.viewH),
    ];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }

  // ─── CAMERA UPDATE (pan + tether + rotation) ───

  /**
   * Per-frame camera follow:
   *   1. rotate — ease the background toward the ship's heading
   *   2. pan    — the ship's screen-space velocity scrolls the world
   *   3. tether — clamp the player near the screen center (bounds
   *               disabled: the camera pans 1:1 with the overflow)
   *   4. clamp  — keep the camera inside the sector bounds
   */
  update(dt, player) {
    this.time += dt;
    const g = this.game;
    // ── 1. ROTATION (rotational background camera shift) ──
    const target = player.angle * SAR.CAMERA.ROTATION_INFLUENCE;
    let d = target - this.cam.angle;
    d = Math.atan2(Math.sin(d), Math.cos(d)); // shortest arc
    this.cam.angle += d * Math.min(1, SAR.CAMERA.ANGLE_EASE * dt);
    const c = Math.cos(this.cam.angle);
    const s = Math.sin(this.cam.angle);
    // ── 2. PAN (the ship's screen-space velocity scrolls the world) ──
    const pvx = player.vx * SAR.CAMERA.PAN_FACTOR;
    const pvy = player.vy * SAR.CAMERA.PAN_FACTOR;
    this.cam.x += (pvx * c - pvy * s) * dt;
    this.cam.y += (pvx * s + pvy * c) * dt;
    // ── 3. TETHER (player near screen center; overflow pans 1:1) ──
    const tx = g.viewW * SAR.CAMERA.TETHER_X;
    const ty = g.viewH * SAR.CAMERA.TETHER_Y;
    let ox = 0, oy = 0;
    if (player.x < g.viewW / 2 - tx) ox = g.viewW / 2 - tx - player.x;
    else if (player.x > g.viewW / 2 + tx) ox = g.viewW / 2 + tx - player.x;
    if (player.y < g.viewH / 2 - ty) oy = g.viewH / 2 - ty - player.y;
    else if (player.y > g.viewH / 2 + ty) oy = g.viewH / 2 + ty - player.y;
    if (ox !== 0 || oy !== 0) {
      // Screen-space overflow → world-space pan (through the rotation),
      // then clamp the ship back onto the tether edge.
      this.cam.x += ox * c - oy * s;
      this.cam.y += ox * s + oy * c;
      player.x += ox;
      player.y += oy;
    }
    // ── 4. SECTOR BOUNDS ──
    const m = SAR.CAMERA.CLAMP_MARGIN;
    this.cam.x = clamp(this.cam.x, m, SAR.SECTOR.W - m);
    this.cam.y = clamp(this.cam.y, m, SAR.SECTOR.H - m);
  }

  // ─── BACKGROUND RENDER (world space through the camera transform) ───

  /**
   * Render the sector background (Game.render, replaces the classic
   * starfield in SAR mode). `house` is the live target-base state from
   * SectorCombatManager ({ x, y, hp, maxHp, radius, alive, flash, t }).
   */
  renderBackground(ctx, house) {
    const g = this.game;
    const W = g.viewW, H = g.viewH;
    // ── PARALLAX STARFIELD (3 layers, world-anchored, per-layer parallax) ──
    for (const layer of this.layers) {
      const f = layer.f;
      const c = Math.cos(this.cam.angle * f);
      const s = Math.sin(this.cam.angle * f);
      const cx = this.cam.x * f;
      const cy = this.cam.y * f;
      for (const st of layer.stars) {
        const dx = st.x - cx;
        const dy = st.y - cy;
        const sx = W / 2 + dx * c - dy * s;
        const sy = H / 2 + dx * s + dy * c;
        if (sx < -4 || sx > W + 4 || sy < -4 || sy > H + 4) continue;
        const tw = 0.7 + 0.3 * Math.sin(this.time * 2 + st.tw);
        ctx.globalAlpha = layer.alpha * tw;
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx, sy, layer.size, layer.size);
      }
    }
    ctx.globalAlpha = 1;
    // ── WORLD-SPACE PASS (planets → grid → zones → boneyard → house) ──
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(this.cam.angle);
    ctx.translate(-this.cam.x, -this.cam.y);
    const rect = this.visibleRect();
    this._drawPlanets(ctx, rect);
    this._drawGrid(ctx, rect);
    this._drawZones(ctx, rect);
    this._drawBoneMarks(ctx, rect);
    this._drawHouse(ctx, house);
    ctx.restore();
  }

  _drawPlanets(ctx, rect) {
    for (const p of this.planets) {
      if (p.x + p.r < rect.minX || p.x - p.r > rect.maxX ||
          p.y + p.r < rect.minY || p.y - p.r > rect.maxY) continue;
      const grd = ctx.createRadialGradient(
        p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.15, p.x, p.y, p.r
      );
      grd.addColorStop(0, `hsl(${p.hue}, 45%, 62%)`);
      grd.addColorStop(0.7, `hsl(${p.hue}, 50%, 38%)`);
      grd.addColorStop(1, `hsl(${p.hue}, 55%, 20%)`);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
      if (p.ring) {
        ctx.strokeStyle = `hsla(${p.hue}, 60%, 75%, 0.5)`;
        ctx.lineWidth = p.r * 0.08;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r * 1.5, p.r * 0.42, p.spin, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  _drawGrid(ctx, rect) {
    const step = SAR.SECTOR.GRID;
    const x0 = Math.max(0, Math.floor(rect.minX / step) * step);
    const x1 = Math.min(SAR.SECTOR.W, rect.maxX);
    const y0 = Math.max(0, Math.floor(rect.minY / step) * step);
    const y1 = Math.min(SAR.SECTOR.H, rect.maxY);
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) {
      ctx.moveTo(x, Math.max(0, rect.minY));
      ctx.lineTo(x, Math.min(SAR.SECTOR.H, rect.maxY));
    }
    for (let y = y0; y <= y1; y += step) {
      ctx.moveTo(Math.max(0, rect.minX), y);
      ctx.lineTo(Math.min(SAR.SECTOR.W, rect.maxX), y);
    }
    ctx.stroke();
    // Sector border (the grid edge).
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.18)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, SAR.SECTOR.W, SAR.SECTOR.H);
    ctx.restore();
  }

  _drawZones(ctx, rect) {
    ctx.save();
    for (let i = 0; i < SAR.ZONES.length; i++) {
      const z = SAR.ZONES[i];
      // Zone boundary line (right edge of each band, except the last).
      if (i < SAR.ZONES.length - 1) {
        const bx = z.x1;
        if (bx >= rect.minX && bx <= rect.maxX) {
          ctx.strokeStyle = i === 0 ? 'rgba(255, 213, 79, 0.25)' : 'rgba(255, 82, 82, 0.3)';
          ctx.lineWidth = 3;
          ctx.setLineDash([26, 20]);
          ctx.beginPath();
          ctx.moveTo(bx, Math.max(0, rect.minY));
          ctx.lineTo(bx, Math.min(SAR.SECTOR.H, rect.maxY));
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      // Zone label (world space, top of the visible band).
      const lx = (z.x0 + z.x1) / 2;
      if (lx >= rect.minX - 600 && lx <= rect.maxX + 600) {
        const ly = Math.max(220, rect.minY + 160);
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = i === 0 ? '#ffd54f' : i === 1 ? '#f5f0e0' : '#ff5252';
        ctx.font = 'bold 64px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(z.label, lx, ly);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  _drawBoneMarks(ctx, rect) {
    // Faint boneyard debris texture (the shootable bones are screen-space
    // bonusTargets — these are the yard's ambient "floor").
    const z = SAR.ZONES[1];
    if (rect.maxX < z.x0 || rect.minX > z.x1) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 240, 224, 0.10)';
    ctx.lineWidth = 3;
    for (const b of this.boneMarks) {
      if (b.x < rect.minX || b.x > rect.maxX || b.y < rect.minY || b.y > rect.maxY) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      ctx.beginPath();
      ctx.moveTo(-b.r, 0);
      ctx.lineTo(b.r, 0);
      ctx.moveTo(-b.r, -b.r * 0.35);
      ctx.arc(-b.r, 0, b.r * 0.35, -Math.PI / 2, Math.PI / 2);
      ctx.moveTo(b.r, b.r * 0.35);
      ctx.arc(b.r, 0, b.r * 0.35, Math.PI / 2, -Math.PI / 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * The target base — Eridath's Mom's House (world space). `house` is the
   * live state from SectorCombatManager; null → nothing to draw.
   */
  _drawHouse(ctx, house) {
    if (!house) return;
    const rect = this.visibleRect();
    const size = 128 * SAR.HOUSE.drawScale;
    const hx = house.x, hy = house.y;
    if (hx + size < rect.minX || hx - size > rect.maxX ||
        hy + size < rect.minY || hy - size > rect.maxY) return;
    const pulse = 1 + 0.06 * Math.sin((house.t || 0) * 2);
    // Approach glow (pulsing pink — the base is the mission objective).
    const glow = ctx.createRadialGradient(hx, hy, size * 0.2, hx, hy, size * 0.95 * pulse);
    glow.addColorStop(0, 'rgba(255, 105, 180, 0.22)');
    glow.addColorStop(1, 'rgba(255, 105, 180, 0)');
    ctx.save();
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(hx, hy, size * 0.95 * pulse, 0, TAU);
    ctx.fill();
    // House art (asset `eridath_moms_house`, 128px native → drawScale) —
    // nearest-neighbor (the canvas context is already crisp).
    const sprite = getSprite('eridath_moms_house');
    if (sprite) {
      ctx.drawImage(sprite, hx - size / 2, hy - size / 2, size, size);
    } else {
      // Procedural fallback (asset missing / still decoding).
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(hx - size * 0.36, hy - size * 0.1, size * 0.72, size * 0.5);
      ctx.fillStyle = '#d84343';
      ctx.beginPath();
      ctx.moveTo(hx - size * 0.44, hy - size * 0.1);
      ctx.lineTo(hx, hy - size * 0.46);
      ctx.lineTo(hx + size * 0.44, hy - size * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3e2723';
      ctx.fillRect(hx - size * 0.08, hy + size * 0.18, size * 0.16, size * 0.22);
    }
    // Hit flash (set by SectorCombatManager on bullet impact).
    if (house.flash > 0) {
      ctx.globalAlpha = 0.55 * (house.flash / 0.15);
      ctx.fillStyle = '#fff';
      ctx.fillRect(hx - size / 2, hy - size / 2, size, size);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

// Filename: SectorMap.js
// Kitty Vs Everything — v4.3.0
// SEARCH & DESTROY — the sector map: a true 2D world-space coordinate
// grid + the DISPLACEMENT-ACCUMULATOR camera (v4.0.0) + the DEEP
// PARALLAX STARFIELD (v4.3.0).
//
// Camera model (displacement accumulator): the camera owns a world
// position (worldX, worldY) — the world coordinate at the screen
// center. The player flies in SCREEN space (the classic combat stack
// is untouched — full parity; PlayerFlight's velocity / input
// integration / weapon-collision routines are 100% sovereign). Per
// frame:
//   1. OBSERVE  — the player's screen delta is read (the flight
//                 integration already ran; we only observe it, and we
//                 undo our own previous camera nudge — soft recentering
//                 + backstop — to recover the ship's true flight delta);
//   2. ACCUMULATE — the dead zone (CAMERA.DEADZONE_X/Y × viewW/H)
//                 absorbs travel around the screen center; the EXCESS
//                 delta is accumulated into the world coordinates
//                 (worldX / worldY) — the world scrolls fluidly
//                 around the combat layer (1:1 with the overflow);
//   3. RECENTER — the ship is SOFTLY recentered: pulled back toward
//                 the center by a fraction of the excess (exponential
//                 ease, CAMERA.RECENTER — no hard clamp, no velocity
//                 change) + a screen-edge backstop as a safety net;
//   4. CLAMP    — the camera stays inside the sector bounds.
// The background (DEEP PARALLAX STARFIELD — v4.3.0: far micro-stars
// with slow autonomous drift, mid-depth stellar dust / nebula puffs,
// near stars, and foreground star trails streaking opposite the
// ship's movement vector; plus reference planets, sector grid,
// journey zone bands, boneyard debris texture, the house base)
// renders in world space through the camera transform; gameplay
// entities render in screen space above it (Game.render).
//
// DEEP PARALLAX STARFIELD (v4.3.0): the v4.0.0 field spread its stars
// across the whole 64 km sector and sampled them at worldX·f — the
// on-screen window (1280×720 of layer space) expected ≈ 0.3 visible
// stars: an empty sky. The v4.3.0 field TILES each layer (tile px of
// layer space, mod-wrapped) so the on-screen density is constant
// across the journey, and every layer carries its own slow autonomous
// WIND drift (px/s) on top of the per-layer parallax factor f
// (0 = pinned far, 1 = full camera lock) — the sky keeps moving even
// when the ship holds still. The NEBULA layer adds soft mid-depth
// stellar-dust puffs (radial gradients) and the TRAILS layer
// (f = 1, full camera lock + its own drift) streaks opposite the
// player's movement vector — streak length = min(maxLen, speed·gain),
// alpha ∝ speed/speedRef (quiet points while the ship holds still).
// Tunables: SAR.STARFIELD (config/searchDestroy.js).
//
// World-anchored layout (v4.0.0): the sector's debris anchors, hazard
// anchors and regional patrol sites are generated once from a seeded
// PRNG (identical every run) at ABSOLUTE world coordinates —
// SectorSpawner.js activates them as the player's world position
// approaches (debrisAnchors / hazardAnchors / patrolSites below).
//
// Pure camera + layout + rendering — no gameplay state. The house's
// live state (hp / flash / alive) is passed in from SectorCombatManager
// at draw time.
export const VERSION = 'v4.3.0';
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

/** Positive modulo (JS % keeps the sign of the dividend). */
const mod = (v, m) => ((v % m) + m) % m;

// v4.3.0: the starfield layers are built from SAR.STARFIELD
// (config/searchDestroy.js) — FAR / MID / NEAR star layers (tiled,
// per-layer parallax factor f + autonomous wind drift), the NEBULA
// mid-depth dust layer and the TRAILS foreground layer. The layer
// builders live below (_makeStarLayers / _makeNebula / _makeTrails).

export default class SectorMap {
  constructor(game) {
    this.game = game;
    this.worldX = SAR.START.x;
    this.worldY = SAR.START.y;
    this.time = 0;
    // Displacement-accumulator state (previous frame's observed player
    // position, clamped dead-zone offset and total camera nudge).
    this._accInit = false;
    this.prevPX = 0;
    this.prevPY = 0;
    this.prevClX = 0;
    this.prevClY = 0;
    this.prevNudgeX = 0;
    this.prevNudgeY = 0;
    // Starfield (v4.3.0 deep parallax — see the file header).
    this.layers = this._makeStarLayers();
    this.nebula = this._makeNebula();
    this.trails = this._makeTrails();
    this.planets = this._makePlanets();
    this.boneMarks = this._makeBoneMarks();
    // ── WORLD-ANCHORED LAYOUT (deterministic, absolute world px) ──
    this.debrisAnchors = this._makeDebrisAnchors();
    this.hazardAnchors = this._makeHazardAnchors();
    this.patrolSites = this._makePatrolSites();
  }

  /** Fresh sector per mission (camera back at the start coordinates). */
  reset() {
    this.worldX = SAR.START.x;
    this.worldY = SAR.START.y;
    this.time = 0;
    this._accInit = false;
  }

  /**
   * v4.3.0 star layers — built from SAR.STARFIELD (FAR / MID / NEAR).
   * Each layer is TILED (spec.tile px of layer space): stars are
   * distributed inside one tile and mod-wrapped at draw time, so the
   * on-screen density is constant across the whole 64 km sector.
   * spec.f = parallax factor (0 = pinned far, 1 = full camera lock);
   * spec.windX/Y = the layer's autonomous drift (px/s, layer space) —
   * the sky keeps moving even when the ship holds still.
   */
  _makeStarLayers() {
    const spec = (key, seed) => {
      const s = SAR.STARFIELD[key];
      const rng = mulberry32(seed);
      const stars = [];
      for (let i = 0; i < s.n; i++) {
        stars.push({ x: rng() * s.tile, y: rng() * s.tile, tw: rng() * TAU, c: rng() });
      }
      return { f: s.f, tile: s.tile, size: s.size, alpha: s.alpha, windX: s.windX, windY: s.windY, stars };
    };
    return [spec('FAR', 0xC0FFEE), spec('MID', 0xC0FFEE + 7919), spec('NEAR', 0xC0FFEE + 15838)];
  }

  /**
   * v4.3.0 mid-depth nebula / stellar-dust layer (SAR.STARFIELD.NEBULA):
   * soft radial-gradient puffs, tiled like the star layers, with its own
   * parallax factor + wind drift.
   */
  _makeNebula() {
    const s = SAR.STARFIELD.NEBULA;
    const rng = mulberry32(0x5EEDB1);
    const hues = [210, 265, 180, 320];
    const puffs = [];
    for (let i = 0; i < s.n; i++) {
      puffs.push({
        x: rng() * s.tile, y: rng() * s.tile,
        r: s.rMin + rng() * (s.rMax - s.rMin),
        hue: hues[i % hues.length],
        a: 0.6 + rng() * 0.4,
      });
    }
    return { f: s.f, tile: s.tile, alpha: s.alpha, windX: s.windX, windY: s.windY, puffs };
  }

  /**
   * v4.3.0 foreground star trails (SAR.STARFIELD.TRAILS): full camera
   * lock (f = 1) + each star's own slow drift — at draw time the streak
   * points OPPOSITE the player's movement vector (length ∝ ship speed).
   */
  _makeTrails() {
    const s = SAR.STARFIELD.TRAILS;
    const rng = mulberry32(0x7A115);
    const trails = [];
    for (let i = 0; i < s.n; i++) {
      const a = rng() * TAU;
      const sp = s.drift * (0.4 + rng() * 0.6);
      trails.push({
        x: rng() * s.tile, y: rng() * s.tile,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        c: 0.6 + rng() * 0.4,
      });
    }
    return { tile: s.tile, trails };
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
        ring: rng() < 0.5,
        spin: rng() * TAU,
      });
    }
    return out;
  }

  _makeBoneMarks() {
    // Faint debris texture across THE BONEYARD band (world space) — the
    // yard's "floor" (the shootable debris itself is world-anchored
    // bonusTargets activated by SectorSpawner).
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

  // ─── WORLD-ANCHORED LAYOUT (deterministic, absolute world px) ───

  /** Boneyard bone-debris anchors (THE BONEYARD band, world space). */
  _makeDebrisAnchors() {
    const rng = mulberry32(0xB0D57);
    const z = SAR.ZONES[1];
    const out = [];
    for (let i = 0; i < SAR.WORLD.DEBRIS.count; i++) {
      out.push({
        x: z.x0 + rng() * (z.x1 - z.x0),
        y: rng() * SAR.SECTOR.H,
        a: rng() * TAU,
        used: false,
      });
    }
    return out;
  }

  /** Boneyard hazard anchors (THE BONEYARD band, world space). */
  _makeHazardAnchors() {
    const rng = mulberry32(0xDE57A7);
    const z = SAR.ZONES[1];
    const out = [];
    for (let i = 0; i < SAR.WORLD.HAZARDS.count; i++) {
      out.push({
        x: z.x0 + rng() * (z.x1 - z.x0),
        y: rng() * SAR.SECTOR.H,
        used: false,
      });
    }
    return out;
  }

  /** Regional patrol sites — one set per journey zone (world space). */
  _makePatrolSites() {
    const rng = mulberry32(0x7A7E01);
    return SAR.ZONES.map((z) => {
      const sites = [];
      for (let i = 0; i < SAR.WORLD.PATROL.perZone; i++) {
        sites.push({
          x: z.x0 + 800 + rng() * (z.x1 - z.x0 - 1600),
          y: 600 + rng() * (SAR.SECTOR.H - 1200),
          used: false,
          cooldown: 0,
        });
      }
      return sites;
    });
  }

  // ─── COORDINATE TRANSFORMS (displacement-accumulator pan) ───

  /** Screen → world (through the camera displacement). */
  screenToWorld(sx, sy) {
    const g = this.game;
    return { x: this.worldX + (sx - g.viewW / 2), y: this.worldY + (sy - g.viewH / 2) };
  }

  /** World → screen (inverse of screenToWorld). */
  worldToScreen(wx, wy) {
    const g = this.game;
    return { x: wx - this.worldX + g.viewW / 2, y: wy - this.worldY + g.viewH / 2 };
  }

  /** The player's live world position (screen pos → world). */
  playerWorld() {
    const p = this.game.player;
    return this.screenToWorld(p.x, p.y);
  }

  /** The visible world rectangle (for background culling). */
  visibleRect() {
    const g = this.game;
    return {
      minX: this.worldX - g.viewW / 2,
      maxX: this.worldX + g.viewW / 2,
      minY: this.worldY - g.viewH / 2,
      maxY: this.worldY + g.viewH / 2,
    };
  }

  // ─── CAMERA UPDATE (displacement accumulator, v4.0.0) ───

  /**
   * Per-frame displacement accumulator:
   *   1. observe the player's screen delta (PlayerFlight is sovereign —
   *      the flight integration already ran; we only read the result
   *      and undo our own previous camera nudge — soft recentering +
   *      screen-edge backstop — to recover the true flight delta);
   *   2. accumulate the EXCESS delta (beyond the dead zone) into the
   *      world coordinates (worldX / worldY) — the world scrolls
   *      fluidly around the combat layer;
   *   3. softly recenter the ship (fraction of the excess, exponential
   *      ease — no hard clamp, no velocity change) + screen-edge
   *      backstop;
   *   4. clamp the camera inside the sector bounds.
   */
  update(dt, player) {
    this.time += dt;
    const g = this.game;
    const cx = g.viewW / 2, cy = g.viewH / 2;
    const dzX = g.viewW * SAR.CAMERA.DEADZONE_X;
    const dzY = g.viewH * SAR.CAMERA.DEADZONE_Y;
    if (!this._accInit) {
      // First frame: anchor the accumulator to the ship's current
      // screen position (no accumulation, no recentering).
      this.prevPX = player.x;
      this.prevPY = player.y;
      this.prevClX = clamp(player.x - cx, -dzX, dzX);
      this.prevClY = clamp(player.y - cy, -dzY, dzY);
      this.prevNudgeX = 0;
      this.prevNudgeY = 0;
      this._accInit = true;
      return;
    }
    // ── 1. OBSERVE the player's screen-space delta ──
    const dpx = player.x - this.prevPX;
    const dpy = player.y - this.prevPY;
    this.prevPX = player.x;
    this.prevPY = player.y;
    const soft = 1 - Math.exp(-SAR.CAMERA.RECENTER * dt);
    // The observed delta includes last frame's total camera nudge (soft
    // recentering + screen-edge backstop) — remove it to recover the
    // ship's true flight delta (we only undo OUR OWN positional
    // correction; PlayerFlight is untouched).
    const flightX = dpx + this.prevNudgeX;
    const flightY = dpy + this.prevNudgeY;
    // ── 2. ACCUMULATE the excess delta into world coordinates ──
    const ox = player.x - cx;
    const oy = player.y - cy;
    const clX = clamp(ox, -dzX, dzX);
    const clY = clamp(oy, -dzY, dzY);
    const exX = ox - clX;
    const exY = oy - clY;
    // The dead zone absorbs (clX - prevClX) of the flight delta; the
    // excess is the displacement the world takes on. The per-frame cap
    // is a teleport guard (respawn / dev warp).
    const maxStep = g.viewW * 0.5;
    this.worldX += clamp(flightX - (clX - this.prevClX), -maxStep, maxStep);
    this.worldY += clamp(flightY - (clY - this.prevClY), -maxStep, maxStep);
    this.prevClX = clX;
    this.prevClY = clY;
    // ── 3. SOFTLY RECENTER the ship (fraction of the excess) ──
    let nudgeX = 0;
    let nudgeY = 0;
    if (exX !== 0 || exY !== 0) {
      nudgeX = exX * soft;
      nudgeY = exY * soft;
      player.x -= nudgeX;
      player.y -= nudgeY;
    }
    // Screen-edge backstop (safety net — the soft recentering keeps the
    // ship well inside; this only catches extreme full-throttle cases).
    const preX = player.x;
    const preY = player.y;
    player.x = clamp(player.x, 12, g.viewW - 12);
    player.y = clamp(player.y, 12, g.viewH - 12);
    // The camera's TOTAL positional nudge this frame (soft recentering +
    // backstop) is removed from the next frame's observed delta — the
    // accumulator stays exact even when the backstop fires.
    this.prevNudgeX = nudgeX + (preX - player.x);
    this.prevNudgeY = nudgeY + (preY - player.y);
    // ── 4. SECTOR BOUNDS ──
    const m = SAR.CAMERA.CLAMP_MARGIN;
    this.worldX = clamp(this.worldX, m, SAR.SECTOR.W - m);
    this.worldY = clamp(this.worldY, m, SAR.SECTOR.H - m);
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
    // ── DEEP PARALLAX STARFIELD (v4.3.0) ──
    // Far micro-stars (slow autonomous drift) → mid nebula dust → mid
    // motes → near stars → foreground star trails (streak opposite the
    // ship's movement vector). Each layer is tiled + parallaxed.
    this._drawStarLayer(ctx, W, H, this.layers[0]);
    this._drawNebula(ctx, W, H);
    this._drawStarLayer(ctx, W, H, this.layers[1]);
    this._drawStarLayer(ctx, W, H, this.layers[2]);
    this._drawStarTrails(ctx, W, H);
    // ── WORLD-SPACE PASS (planets → grid → zones → boneyard → house) ──
    ctx.save();
    ctx.translate(W / 2 - this.worldX, H / 2 - this.worldY);
    const rect = this.visibleRect();
    this._drawPlanets(ctx, rect);
    this._drawGrid(ctx, rect);
    this._drawZones(ctx, rect);
    this._drawBoneMarks(ctx, rect);
    this._drawHouse(ctx, house);
    ctx.restore();
  }

  /**
   * v4.3.0 tiled star layer. Layer-space offset = worldX·f (parallax)
   * + the layer's autonomous wind drift (time·wind — the sky moves even
   * when the ship holds still); stars mod-wrap into the tile, and up to
   * 3×3 tile candidates are tested per star so ultra-wide views stay
   * covered.
   */
  _drawStarLayer(ctx, W, H, layer) {
    const t = layer.tile, ht = t / 2;
    const offX = this.worldX * layer.f - layer.windX * this.time;
    const offY = this.worldY * layer.f - layer.windY * this.time;
    for (const st of layer.stars) {
      const bx = W / 2 + mod(st.x - offX, t) - ht;
      const by = H / 2 + mod(st.y - offY, t) - ht;
      for (let ox = -t; ox <= t; ox += t) {
        const sx = bx + ox;
        if (sx < -4 || sx > W + 4) continue;
        for (let oy = -t; oy <= t; oy += t) {
          const sy = by + oy;
          if (sy < -4 || sy > H + 4) continue;
          const tw = 0.7 + 0.3 * Math.sin(this.time * 2 + st.tw);
          ctx.globalAlpha = layer.alpha * tw;
          ctx.fillStyle = st.c < 0.75 ? '#ffffff' : (st.c < 0.9 ? '#cfe8ff' : '#ffe9c4');
          ctx.fillRect(sx, sy, layer.size, layer.size);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * v4.3.0 mid-depth nebula / stellar dust: soft radial-gradient puffs,
   * tiled + parallaxed + wind-drifted like the star layers.
   */
  _drawNebula(ctx, W, H) {
    const nb = this.nebula;
    const t = nb.tile, ht = t / 2;
    const offX = this.worldX * nb.f - nb.windX * this.time;
    const offY = this.worldY * nb.f - nb.windY * this.time;
    for (const p of nb.puffs) {
      const bx = W / 2 + mod(p.x - offX, t) - ht;
      const by = H / 2 + mod(p.y - offY, t) - ht;
      for (let ox = -t; ox <= t; ox += t) {
        const sx = bx + ox;
        if (sx + p.r < 0 || sx - p.r > W) continue;
        for (let oy = -t; oy <= t; oy += t) {
          const sy = by + oy;
          if (sy + p.r < 0 || sy - p.r > H) continue;
          const a = nb.alpha * p.a;
          const grd = ctx.createRadialGradient(sx, sy, p.r * 0.1, sx, sy, p.r);
          grd.addColorStop(0, `hsla(${p.hue}, 60%, 60%, ${a})`);
          grd.addColorStop(1, `hsla(${p.hue}, 60%, 40%, 0)`);
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(sx, sy, p.r, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  /**
   * v4.3.0 foreground star trails — full camera lock (f = 1) + each
   * star's own slow drift. The streak points OPPOSITE the player's
   * movement vector: length = min(maxLen, speed·gain), alpha ∝
   * speed/speedRef; while the ship holds still the layer rests as quiet
   * points. (Reads the ship's velocity vector for the streak direction
   * only — the camera accumulator is untouched.)
   */
  _drawStarTrails(ctx, W, H) {
    const s = SAR.STARFIELD.TRAILS;
    const t = this.trails.tile, ht = t / 2;
    const p = this.game.player;
    const pvx = p && !p.dead ? (p.vx || 0) : 0;
    const pvy = p && !p.dead ? (p.vy || 0) : 0;
    const speed = Math.hypot(pvx, pvy);
    const L = Math.min(s.maxLen, speed * s.gain);
    const a = Math.min(1, speed / s.speedRef);
    const ux = speed > 1 ? -pvx / speed : 0;
    const uy = speed > 1 ? -pvy / speed : 0;
    for (const st of this.trails.trails) {
      const bx = W / 2 + mod(st.x + st.vx * this.time - this.worldX, t) - ht;
      const by = H / 2 + mod(st.y + st.vy * this.time - this.worldY, t) - ht;
      for (let ox = -t; ox <= t; ox += t) {
        const sx = bx + ox;
        if (sx < -4 || sx > W + 4) continue;
        for (let oy = -t; oy <= t; oy += t) {
          const sy = by + oy;
          if (sy < -4 || sy > H + 4) continue;
          if (L < 6) {
            ctx.globalAlpha = s.idle * st.c;
            ctx.fillStyle = '#dff2ff';
            ctx.fillRect(sx, sy, 2, 2);
          } else {
            ctx.globalAlpha = 1;
            ctx.strokeStyle = `rgba(214, 240, 255, ${(0.25 + 0.5 * a) * st.c})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + ux * L, sy + uy * L);
            ctx.stroke();
            ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + 0.4 * a})`;
            ctx.fillRect(sx - 1, sy - 1, 2, 2);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
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
    // Faint boneyard debris texture (the shootable bones are world-
    // anchored bonusTargets — these are the yard's ambient "floor").
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
    // 512px native asset (manifest `eridath_moms_house`) × drawScale —
    // 1:1 crisp at drawScale 1 (the canvas context is already crisp).
    const size = 512 * SAR.HOUSE.drawScale;
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
    // House art (the 512px .assets/Eridaths-Moms-House landmark) —
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

// Filename: Crosshair.js
// Kitty Vs Everything — v4.22.0
// Procedural canvas crosshair (aim reticle) for the local player ship.
// Zero external assets — pure Canvas 2D primitives.
//
// v4.22.0: CROSSHAIR CUSTOMIZATION (Settings → CROSSHAIR section) —
//   • THINNER STROKES — the v3.48.0 reticle was too thick: circle stroke
//     1.5 → 1, tick stroke 2 → 1, glow 10 → 8.
//   • 4 STYLES (SETTINGS.crosshairStyle, default 'classic'):
//       classic  — two concentric circles + center dot + 4 ticks
//       brackets — viewfinder corner brackets + center dot + 4 ticks
//       diamond  — rotated-square (rhombus) outline + center dot + 4 ticks
//       dot      — minimal: larger center dot + 4 short ticks
//   • 5 COLORS (SETTINGS.crosshairColor, default 'red'):
//       red / green / yellow / blue / white (CROSSHAIR_COLORS palette).
//   • LENGTH (SETTINGS.crosshairLength, 0.5–2×) scales how far the ticks
//     reach; SIZE (SETTINGS.crosshairSize, 0.5–2×) scales the whole reticle.
//   • drawReticle(ctx, {style,color,size,length}) is exported so the
//     Settings screen preview canvas renders the EXACT same geometry as
//     the in-game reticle (single source of truth for the art).
//
// The reticle sits at a configurable forward offset (SETTINGS.crosshairOffset)
// directly in front of the ship's nose, along the ship's heading vector, and
// rotates with the heading so the reticle's local "up" tracks the aim
// direction (matching the projectile trajectories).
//
// ULTRAWIDE / SCALING: draw() renders in LOGICAL viewport coordinates.
// Game.render() applies the crisp q× buffer transform (ViewScaler), so the
// reticle scales seamlessly on any display — including the native 3440×1440 /
// 5120×1440 ultrawide presets (crisp 1:1 buffer, no blur). Because the logical
// height is fixed at 720, the reticle keeps the same relative size as the ship
// on every aspect ratio; no per-width compensation is needed.
//
// Toggle: SETTINGS.crosshair (Settings screen → FX section, default ON).
// Offset: SETTINGS.crosshairOffset (Dev panel → Player slider, live).
// v3.55.0: range widened to 140–340 logical px — draw() clamps the offset
// to LIMITS.crosshairOffset (single source of truth) defensively.
export const VERSION = 'v4.22.0';
import { TAU } from '../core/config.js';
import { SETTINGS, LIMITS } from './Settings.js'; // v3.55.0: LIMITS for the defensive clamp

// ─── Reticle geometry (logical px, at size = 1.0 / length = 1.0) ───
const R_OUTER = 16;    // classic outer circle radius / diamond & bracket reach
const R_INNER = 9.5;   // classic inner circle radius (ticks stop at this edge)
const DOT_R = 2.6;     // solid center dot radius
const CIRCLE_W = 1;    // v4.22.0: circle stroke width (was 1.5 — too thick)
const TICK_W = 1;      // v4.22.0: tick stroke width (was 2 — too thick)
const GLOW = 8;        // v4.22.0: shadowBlur (was 10 — softer with thin lines)
const MIN_STROKE = 0.75; // never draw sub-pixel-thin strokes (crisp at 0.5×)

// ─── v4.22.0: color palette (Settings → CROSSHAIR — red is the default) ───
export const CROSSHAIR_COLORS = {
  red:    { core: '#ff5252', glow: 'rgba(255, 60, 60, 0.8)' },
  green:  { core: '#4dff88', glow: 'rgba(40, 255, 120, 0.8)' },
  yellow: { core: '#ffe14d', glow: 'rgba(255, 220, 40, 0.8)' },
  blue:   { core: '#4da6ff', glow: 'rgba(40, 150, 255, 0.8)' },
  white:  { core: '#ffffff', glow: 'rgba(255, 255, 255, 0.8)' },
};
export const CROSSHAIR_STYLES = ['classic', 'brackets', 'diamond', 'dot'];
export const CROSSHAIR_STYLE_LABELS = {
  classic: 'Classic', brackets: 'Brackets', diamond: 'Diamond', dot: 'Dot',
};

/**
 * Draw the reticle centered on the CURRENT origin (0,0) — the caller owns
 * translate/rotate. Shared by the in-game reticle (Crosshair.draw) and the
 * Settings screen preview canvas, so the preview is always the real thing.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o  { style, color, size, length } — all optional
 */
export function drawReticle(ctx, o = {}) {
  const palette = CROSSHAIR_COLORS[o.color] || CROSSHAIR_COLORS.red;
  const size = Number.isFinite(o.size) ? o.size : 1;
  const len = Number.isFinite(o.length) ? o.length : 1;
  const s = (v) => v * size;                    // whole-reticle scale
  const L = (v) => v * size * len;              // tick reach (size × length)
  const stroke = Math.max(MIN_STROKE, CIRCLE_W * size);
  const tick = Math.max(MIN_STROKE, TICK_W * size);

  ctx.strokeStyle = palette.core;
  ctx.fillStyle = palette.core;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = GLOW * size;

  // Four ticks (all styles): from a small gap around the dot out to
  // R_INNER × length — clamped so a 2× length never overruns the outer ring.
  const tickEnd = Math.min(L(R_INNER), s(R_OUTER) * 1.05);
  const tickGap = s(DOT_R) + s(1.5);
  ctx.lineWidth = tick;
  ctx.beginPath();
  ctx.moveTo(0, tickGap); ctx.lineTo(0, tickEnd);
  ctx.moveTo(0, -tickGap); ctx.lineTo(0, -tickEnd);
  ctx.moveTo(tickGap, 0); ctx.lineTo(tickEnd, 0);
  ctx.moveTo(-tickGap, 0); ctx.lineTo(-tickEnd, 0);
  ctx.stroke();

  switch (o.style) {
    case 'brackets': {
      // Viewfinder: four corner brackets at the outer radius.
      const r = s(R_OUTER);
      const arm = s(6);
      ctx.lineWidth = stroke;
      ctx.beginPath();
      ctx.moveTo(-r, -r + arm); ctx.lineTo(-r, -r); ctx.lineTo(-r + arm, -r);
      ctx.moveTo(r - arm, -r); ctx.lineTo(r, -r); ctx.lineTo(r, -r + arm);
      ctx.moveTo(r, r - arm); ctx.lineTo(r, r); ctx.lineTo(r - arm, r);
      ctx.moveTo(-r + arm, r); ctx.lineTo(-r, r); ctx.lineTo(-r, r - arm);
      ctx.stroke();
      break;
    }
    case 'diamond': {
      // Rhombus (rotated square) — points up/down/left/right.
      const r = s(R_OUTER);
      ctx.lineWidth = stroke;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'dot':
      // Minimal — no ring, just the (slightly larger) dot + the ticks above.
      break;
    case 'classic':
    default: {
      // Two concentric circles (the original v3.48.0 shape, thinner).
      ctx.lineWidth = stroke;
      ctx.beginPath();
      ctx.arc(0, 0, s(R_OUTER), 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, s(R_INNER), 0, TAU);
      ctx.stroke();
    }
  }

  // Solid center dot (bigger for the minimal 'dot' style).
  ctx.beginPath();
  ctx.arc(0, 0, s(o.style === 'dot' ? DOT_R * 1.4 : DOT_R), 0, TAU);
  ctx.fill();
}

export default class Crosshair {
  constructor(game) {
    this.game = game;
  }

  /**
   * Draw the reticle for the local player.
   * No-op when the crosshair is disabled in Settings or the ship is absent/dead.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const p = this.game.player;
    if (!SETTINGS.crosshair || !p || p.dead) return;

    // Forward offset along the heading vector, in front of the nose.
    // v3.55.0: clamp to the published slider range (140–340 logical px) so a
    // stale save or direct SETTINGS write can never push the reticle out of
    // bounds — LIMITS (Settings.js) is the single source of truth.
    const lim = LIMITS.crosshairOffset;
    const off = Math.max(lim.min, Math.min(lim.max, SETTINGS.crosshairOffset));
    const cx = p.x + Math.cos(p.angle) * off;
    const cy = p.y + Math.sin(p.angle) * off;

    ctx.save();
    ctx.translate(cx, cy);
    // Rotate with the heading: the reticle's local "up" (-y) points away from
    // the ship along the aim direction (angle=-PI/2 ⇒ upright).
    ctx.rotate(p.angle + Math.PI / 2);
    // v4.22.0: style / color / size / length come from Settings — the same
    // values the Settings screen preview canvas renders.
    drawReticle(ctx, {
      style: SETTINGS.crosshairStyle,
      color: SETTINGS.crosshairColor,
      size: SETTINGS.crosshairSize,
      length: SETTINGS.crosshairLength,
    });
    ctx.restore();
  }
}

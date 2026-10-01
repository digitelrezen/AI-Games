// Filename: Crosshair.js
// Kitty Vs Everything — v3.55.0
// Procedural canvas crosshair (aim reticle) for the local player ship.
// Zero external assets — pure Canvas 2D primitives:
//   • two concentric circles (outer + inner)
//   • a solid center dot
//   • four clean vertical/horizontal ticks that start at the center and
//     stop at the inner circle's edge
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
export const VERSION = 'v3.55.0';
import { TAU } from '../core/config.js';
import { SETTINGS, LIMITS } from './Settings.js'; // v3.55.0: LIMITS for the defensive clamp

// ─── Reticle geometry (logical px) ───
const R_OUTER = 16;    // outer circle radius
const R_INNER = 9.5;   // inner circle radius (ticks stop at this edge)
const DOT_R = 2.6;     // solid center dot radius
const CIRCLE_W = 1.5;  // circle stroke width
const TICK_W = 2;      // tick stroke width
const GLOW = 10;       // shadowBlur (neon glow)
const COLOR = '#3df2ff';                 // neon cyan core
const GLOW_COLOR = 'rgba(0, 235, 255, 0.85)';

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

    ctx.strokeStyle = COLOR;
    ctx.fillStyle = COLOR;
    ctx.lineCap = 'round';
    ctx.shadowColor = GLOW_COLOR;
    ctx.shadowBlur = GLOW;

    // Two concentric circles
    ctx.lineWidth = CIRCLE_W;
    ctx.beginPath();
    ctx.arc(0, 0, R_OUTER, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, R_INNER, 0, TAU);
    ctx.stroke();

    // Four ticks: center → inner circle edge (vertical + horizontal)
    ctx.lineWidth = TICK_W;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -R_INNER);
    ctx.moveTo(0, 0); ctx.lineTo(0, R_INNER);
    ctx.moveTo(0, 0); ctx.lineTo(-R_INNER, 0);
    ctx.moveTo(0, 0); ctx.lineTo(R_INNER, 0);
    ctx.stroke();

    // Solid center dot
    ctx.beginPath();
    ctx.arc(0, 0, DOT_R, 0, TAU);
    ctx.fill();

    ctx.restore();
  }
}

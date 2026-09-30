// Filename: PlayerRenderer.js
// Kitty Vs Everything — v3.45.0
// Rendering orchestrator for the cat ship fleet. The actual art lives in:
//   PlayerShipArt.js  — top-down "Superman H" main hull (v3.3.0 redesign)
//   PlayerMiniArt.js  — docked mini clones + independent HP bars
//   PlayerShipFx.js   — shared paw pods / thrusters / muzzle flashes
// Public entry points stay stable:
//   draw(ctx)        — full fleet draw (Player.draw calls this)
//   drawCatShip(...) — v3.2.0 compat signature used by main.js menu icons
// v3.45.0: ship-side charge/shield rings REMOVED — the gold synergy charge
//          ring and cyan shield ring no longer draw (clean catship). The
//          shield is now a yellow outer bubble (SHIELD_BUBBLE_RADIUS) drawn
//          under the hull while shield > 0; Nova charge/cooldown moved to the
//          HUDFireControl purple meter. Player.hit plays the shatter burst.
export const VERSION = 'v3.45.0';
import { TAU, PLAYER_THEMES } from '../core/config.js';
import { drawCatShip as drawMainShip } from './PlayerShipArt.js';
import { drawMiniPod, drawDockArc } from './PlayerMiniArt.js';

// v3.45.0: yellow shield-bubble radius (px). Sized to cover the hull AND both
// docked minis (they dock within ~40px of the hull center).
const SHIELD_BUBBLE_RADIUS = 48;

export default class PlayerRenderer {
  constructor(player) {
    this.player = player;
  }

  /** Main draw entry point called by Player.draw(ctx). */
  draw(ctx) {
    const p = this.player;
    const th = PLAYER_THEMES[p.theme] || PLAYER_THEMES.yellow;
    const blink = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.35;

    // Draw docked mini-ships first (behind main ship)
    for (const m of p.minis) {
      if (!m.alive) continue;
      const mt = PLAYER_THEMES[m.theme] || PLAYER_THEMES.yellow;
      // v3.17.0: arc-bolt coupling tether (DOCKED only) — drawn behind the
      // ships so it reads as a latch keeping the mini coupled to the hull.
      if (!p.fleetDeployed) drawDockArc(ctx, m, p);
      drawMiniPod(ctx, m, p, mt);
      // v3.17.0: mini HP now lives in the fire-control panel (HUDFireControl)
      // stacked under the DOCKED label — the old world-space canvas bar is
      // gone (it was rendering outside the panel).
    }

    // v3.45.0: SHIELD BUBBLE — yellow outer bubble drawn UNDER the hull,
    // sized (SHIELD_BUBBLE_RADIUS) to cover the hull AND both docked minis.
    // Rendered only while shield > 0, so it vanishes the frame the shield
    // breaks (Player.hit plays the shatter burst). Fill/rim/glow intensity
    // scales with shield HP. The ship-side gold synergy charge ring is gone
    // — nova charge/cooldown now lives in the HUDFireControl purple meter.
    if (p.shield > 0) {
      const shPct = p.maxShield > 0 ? p.shield / p.maxShield : 1;
      const R = SHIELD_BUBBLE_RADIUS;
      ctx.save();
      // Soft yellow fill (fades with shield HP)
      ctx.fillStyle = `rgba(255, 213, 79, ${0.04 + 0.07 * shPct})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, TAU);
      ctx.fill();
      // Outer rim — bright yellow, glow scales with shield HP
      ctx.strokeStyle = `rgba(255, 213, 79, ${0.55 + 0.45 * shPct})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ffd54f';
      ctx.shadowBlur = 10 * shPct;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, TAU);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Inner highlight (glassy bubble edge)
      ctx.strokeStyle = `rgba(255, 244, 194, ${0.2 + 0.3 * shPct})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R - 3, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // Main cat ship (top-down "Superman H")
    drawMainShip(ctx, p, th.color, th.accent, th.pattern);

    ctx.globalAlpha = 1;
  }

  /**
   * Compat entry point (v3.2.0 signature) — main.js uses it to render menu
   * ship icons. Delegates to the H-pose art with an explicit position/scale.
   */
  drawCatShip(ctx, x, y, s, c, a, pattern) {
    drawMainShip(ctx, this.player, c, a, pattern, { x, y, scale: s });
  }
}

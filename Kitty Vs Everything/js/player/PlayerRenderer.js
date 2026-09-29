// Filename: PlayerRenderer.js
// Kitty Vs Everything — v3.3.0
// Rendering orchestrator for the cat ship fleet. The actual art lives in:
//   PlayerShipArt.js  — top-down "Superman H" main hull (v3.3.0 redesign)
//   PlayerMiniArt.js  — docked mini clones + independent HP bars
//   PlayerShipFx.js   — shared paw pods / thrusters / muzzle flashes
// Public entry points stay stable:
//   draw(ctx)        — full fleet draw (Player.draw calls this)
//   drawCatShip(...) — v3.2.0 compat signature used by main.js menu icons
export const VERSION = 'v3.3.0';
import { TAU, PLAYER_THEMES } from '../core/config.js';
import { drawCatShip as drawMainShip } from './PlayerShipArt.js';
import { drawMiniPod, drawDockArc } from './PlayerMiniArt.js';

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

    // Main cat ship (top-down "Superman H")
    drawMainShip(ctx, p, th.color, th.accent, th.pattern);

    ctx.globalAlpha = 1;

    // Synergy charge ring
    if (p.superCharge > 0) {
      ctx.save();
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffd54f';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34 + p.superCharge * 10, 0, TAU * p.superCharge);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Shield visual (cyan ring when shield > 0)
    if (p.shield > 0) {
      const pulse = 1 + 0.06 * Math.sin(p.engineFlicker * 2);
      ctx.save();
      ctx.strokeStyle = `rgba(0, 229, 255, ${0.3 + 0.2 * Math.sin(p.engineFlicker)})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 28 * pulse, 0, TAU);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  /**
   * Compat entry point (v3.2.0 signature) — main.js uses it to render menu
   * ship icons. Delegates to the H-pose art with an explicit position/scale.
   */
  drawCatShip(ctx, x, y, s, c, a, pattern) {
    drawMainShip(ctx, this.player, c, a, pattern, { x, y, scale: s });
  }
}

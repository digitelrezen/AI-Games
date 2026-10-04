// Filename: PlayerRenderer.js
// Kitty Vs Everything — v3.56.0
// Rendering orchestrator for the cat ship fleet. The actual art lives in:
//   PlayerShipArt.js  — top-down "Superman H" main hull (v3.3.0 redesign)
//   PlayerMiniArt.js  — docked mini clones + independent HP bars
//   PlayerShipFx.js   — shared paw pods / thrusters / muzzle flashes
// Public entry points stay stable:
//   draw(ctx)        — full fleet draw (Player.draw calls this)
//   drawCatShip(...) — v3.2.0 compat signature used by main.js menu icons
// v3.56.0: shield ring resized — SHIELD_BUBBLE_RADIUS 48 → 60 so the ring
//          clears the railgun barrel tips (±16, -50 ≈ 52.5 px from center)
//          with margin; rim stroke thinned 2.5 → 1.5 (inner highlight
//          1 → 0.75 at R-2.5, glow 10 → 6) for a sharper, thinner look.
// v3.45.0: ship-side charge/shield rings REMOVED — the gold synergy charge
//          ring and cyan shield ring no longer draw (clean catship). The
//          shield is now a yellow outer bubble (SHIELD_BUBBLE_RADIUS) drawn
//          under the hull while shield > 0; Nova charge/cooldown moved to the
//          HUDFireControl purple meter. Player.hit plays the shatter burst.
// v3.72.1: SPRITE BRANCH TRANSFORM FIX — the v3.72.0 sprite blit drew at raw
//          (0,0) (no translate/rotate), so the hull rendered at the world
//          origin (off-screen corner: the "floating circle") while weapons
//          fired from the real position. The sprite now blits in the ship's
//          local frame (translate p.x/p.y + rotate angle+PI/2, same as the
//          procedural path), the hard accent-ellipse underlay is replaced
//          with a soft theme shadow-glow, and the weapon paws / thruster
//          pods / muzzle flash are re-layered at the SHIP_GEOMETRY
//          hardpoints so the sprite keeps its firing/thrusting read.
// v3.73.0: SHIELD_BUBBLE_RADIUS 100 → 110 — the v3.73.0 sprite-clone minis
//          (84px tall, docked at ±36 local) reach ~98px from the hull
//          center, so the bubble grows to keep covering both flanks.
export const VERSION = 'v3.73.0';
import { TAU, PLAYER_THEMES, PLAYER_THEME_SPRITES, SHIP_GEOMETRY, WEAPONS, MAIN_SHIP_SCALE } from '../core/config.js';
import { getSprite } from '../core/AssetManager.js';
import { drawCatShip as drawMainShip } from './PlayerShipArt.js';
import { drawMiniPod, drawDockArc } from './PlayerMiniArt.js';
import { drawWeaponPaw, drawThrusterPaw, drawThrusterFlame, drawMuzzleFlash } from './PlayerShipFx.js';

// v3.45.0: yellow shield-bubble radius (px). Sized to cover the hull AND both
// docked minis (they dock within ~40px of the hull center).
// v3.56.0: 48 → 60 — the ring must clear the railgun barrel tips (±16, -50,
// ≈ 52.5 px from center) while still covering the docked minis.
// v3.47.0: 60 → 100 — the 2x hull (±70px nose/tail, muzzle tips ≈ ±92px) and
// the outboard minis (±77px) need a larger glow radius.
// v3.73.0: 100 → 110 — the sprite-clone minis (±36 dock + 26.25px half-width
// ≈ ±98px outer edge) need a bit more margin to stay fully covered.
const SHIELD_BUBBLE_RADIUS = 110;

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
      // v3.72.3: shield glow is now BARELY visible — the HUD shield meter is
      // the primary read; the on-ship halo is a faint hint only. Intensity
      // scales with shield HP but stays near-invisible so it never dims or
      // blocks the cat artwork.
      const g = ctx.createRadialGradient(p.x, p.y, R * 0.45, p.x, p.y, R);
      g.addColorStop(0, `rgba(255, 213, 79, ${0.004 + 0.008 * shPct})`);
      g.addColorStop(0.55, `rgba(255, 213, 79, ${0.008 + 0.016 * shPct})`);
      g.addColorStop(1, 'rgba(255, 213, 79, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // Main cat ship — v3.72.0: blit the theme's Catship sprite art when
    // imported (a cat on its back: head/ears at center, the two upper
    // extensions = weapon arms, the two lower = thruster legs); otherwise
    // fall back to the procedural top-down "Superman H" hull.
    // v3.72.1: the blit happens in the ship's LOCAL frame (translate to
    // p.x/p.y + rotate by heading, exactly like the procedural path) — the
    // v3.72.0 build drew at raw (0,0) and the hull vanished off-screen.
    const spriteKey = PLAYER_THEME_SPRITES[p.theme];
    const sprite = spriteKey ? getSprite(spriteKey) : null;
    if (sprite && sprite.width && sprite.height) {
      const drawH = 70; // sprite height (px) — matches the procedural hull scale
      const s = drawH / sprite.height;
      const dw = sprite.width * s;
      const dh = sprite.height * s;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle + Math.PI / 2);
      ctx.scale(MAIN_SHIP_SCALE, MAIN_SHIP_SCALE); // v3.47.0: 2x main ship
      ctx.globalAlpha = blink ? 0.35 : 1;
      // v3.72.1: soft theme glow behind the sprite (replaces the hard
      // accent-ellipse underlay that read as a circle behind the cat).
      ctx.shadowColor = th.accent;
      ctx.shadowBlur = 14;
      ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh);
      ctx.shadowBlur = 0;
      // v3.72.1: re-layer the hardpoint FX on top of the sprite so the
      // thrusters flame and the muzzles flash exactly where bullets spawn.
      const flicker = 0.7 + 0.3 * Math.sin(p.engineFlicker);
      const thrustOn = p.thrusterActive || p.boostActive;
      const flameFlicker = thrustOn ? (0.7 + 0.3 * Math.sin(p.engineFlicker * 2)) : 0;
      const boostGlow = p.boostActive ? 1.6 : 1;
      const weaponColor = (p.weapon && WEAPONS[p.weapon]) ? WEAPONS[p.weapon].color : '#ffffff';
      drawThrusterFlame(ctx, SHIP_GEOMETRY.thrusterL.x, SHIP_GEOMETRY.thrusterL.y, flicker, flameFlicker, boostGlow);
      drawThrusterFlame(ctx, SHIP_GEOMETRY.thrusterR.x, SHIP_GEOMETRY.thrusterR.y, flicker, flameFlicker, boostGlow);
      drawWeaponPaw(ctx, SHIP_GEOMETRY.frontPawL.x, SHIP_GEOMETRY.frontPawL.y, th.color, th.accent, p.pawFlashL || 0, weaponColor, p);
      drawWeaponPaw(ctx, SHIP_GEOMETRY.frontPawR.x, SHIP_GEOMETRY.frontPawR.y, th.color, th.accent, p.pawFlashR || 0, weaponColor, p);
      if (p.muzzleFlash > 0) {
        drawMuzzleFlash(ctx, SHIP_GEOMETRY.muzzle.x, SHIP_GEOMETRY.muzzle.y,
          Math.min(1, p.muzzleFlash / 0.18), weaponColor);
      }
      ctx.restore();
    } else {
      drawMainShip(ctx, p, th.color, th.accent, th.pattern, { scale: MAIN_SHIP_SCALE });
    }

    ctx.globalAlpha = 1;
  }

  /**
   * Compat entry point (v3.2.0 signature) — main.js uses it to render menu
   * ship icons. Delegates to the H-pose art with an explicit position/scale.
   */
  drawCatShip(ctx, x, y, s, c, a, pattern) {
    // v3.72.0 — pass the theme's Catship sprite so menu icons match the in-game art.
    const spriteKey = PLAYER_THEME_SPRITES[this.player.theme];
    const sprite = spriteKey ? getSprite(spriteKey) : null;
    drawMainShip(ctx, this.player, c, a, pattern, { x, y, scale: s }, sprite);
  }
}

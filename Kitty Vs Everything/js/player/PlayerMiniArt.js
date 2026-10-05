// Filename: PlayerMiniArt.js
// Kitty Vs Everything — v3.79.0
// Docked mini-ship art: an EXACT 0.6× clone of the main cat ship.
// v3.3.0: Shrunken top-down H-pose capsule clone + independent HP bar and
//         hit-flash (white hull on impact).
// v3.8.0: COMPLETE CLONE — the old capsule H-pose art is GONE. Minis now
//         render through the same drawCatShip() as the main hull
//         (PlayerShipArt.js), so paws (pads/toes/claws), ears, tail,
//         torso and the red-toothed snarl mouth ALWAYS match the main
//         ship — a mini can never drift out of date again.
//         Minis pass opts.mini = true (no sub-dock glow-orbs) and a
//         synthetic state object: the player's heading/boost/tail, with
//         per-side animation offsets so tails wag and blinks differ, and
//         a white hull while the hit-flash is active. The v3.3.0
//         independent HP bar (world space, unrotated) is unchanged.
// v3.9.0: The synthetic state now carries the mini's OWN paw / muzzle
//         flashes — docked minis auto-fire the player's weapon (MiniShip.js)
//         and flash like the main hull while firing.
// v3.10.0: World-space HP bar enlarged + outlined (30×5, white frame) so
//          low-HP minis read at a glance; the HUD fleet row (HUD.js) is the
//          primary read while docked.
// v3.16.0: The synthetic state now carries the mini's OWN weapon animation
//          (vulkanSpin / railCharge / plasmaPulse) — inert while docked,
//          active while deployed (MiniDeploy.js + WeaponAnim.js).
// v3.73.0: SPRITE CLONE — when the theme's Catship sprite is imported the
//          mini blits the SAME PNG as the main hull (PlayerRenderer's
//          sprite branch, mirrored 1:1): local-frame translate/rotate,
//          ctx.scale(MINI_SCALE) with MINI_SCALE = 0.6 × MAIN_SHIP_SCALE
//          (84px world-tall — a true 0.6× clone of the RENDERED main ship,
//          up from the old 42px), soft accent glow, and the hardpoint FX
//          re-layered on top (drawThrusterFlame ×2, drawWeaponPaw ×2,
//          drawMuzzleFlash) driven by the mini's own paw/muzzle flashes +
//          weapon animation. The white hit-flash becomes a
//          brightness/saturate filter on the blit; the world-space HP bar
//          grows (36×6) and lifts to -50px to clear the bigger clone.
//          Themes without a sprite keep the procedural drawCatShip clone.
// v3.79.0: DOCK ARC COUPLER UPGRADE — drawDockArc moved to PlayerShipFx.js
//          (procedural pulsing plasma arc: midpoint-displacement crackle +
//          Math.sin energy pulse + cyan shadow glow) and re-exported here so
//          PlayerRenderer's import path is unchanged.
export const VERSION = 'v3.79.0';
import { drawCatShip } from './PlayerShipArt.js';
import { PLAYER_THEME_SPRITES, SHIP_GEOMETRY, WEAPONS, MINI_SCALE } from '../core/config.js';
import { getSprite } from '../core/AssetManager.js';
import { drawWeaponPaw, drawThrusterFlame, drawMuzzleFlash } from './PlayerShipFx.js';

/**
 * Draw a docked mini (world coords, local nose = -Y like the main hull).
 * v3.73.0: renders the theme's Catship SPRITE at MINI_SCALE (0.6× the main
 * ship's rendered size) with the same hardpoint FX layer as the main hull's
 * sprite branch — a strict visual clone of the player. Themes without a
 * sprite fall back to the procedural drawCatShip clone.
 */
export function drawMiniPod(ctx, mini, player, th) {
  const hit = mini.hitFlash > 0;
  // Synthetic "player" state for the shared art: player's heading/boost/
  // tail drive the clone, per-side offsets keep the fleet lively.
  const state = {
    angle: player.angle,
    animTime: (player.animTime || 0) + mini.side * 0.7,        // offset blink/wag
    engineFlicker: (player.engineFlicker || 0) + mini.side * 2.1,
    tailSway: player.tailSway,
    thrusterActive: player.thrusterActive,
    boostActive: player.boostActive,
    weapon: player.weapon,
    // v3.9.0: minis auto-fire the player's weapon — surface their own paw /
    // muzzle flashes (ticked in MiniShip.update) so the clone's paws flash
    // and its snarl opens while it fires.
    pawFlashL: mini.pawFlash || 0, pawFlashR: mini.pawFlash || 0,
    muzzleFlash: mini.muzzleFlash || 0,
    // v3.16.0: mini weapon animation (WeaponAnim.js) — inert (all 0) while
    // docked, active while deployed in combat orbit (MiniDeploy.js).
    vulkanSpin: mini.vulkanSpin || 0,
    railCharge: mini.railCharge || 0,
    plasmaPulse: mini.plasmaPulse || 0,
  };
  const spriteKey = PLAYER_THEME_SPRITES[mini.theme];
  const sprite = spriteKey ? getSprite(spriteKey) : null;
  if (sprite && sprite.width && sprite.height) {
    // ─── v3.73.0: SPRITE CLONE — mirrors PlayerRenderer's main-hull branch ───
    const drawH = 70; // sprite height (px) — matches the procedural hull frame
    const s = drawH / sprite.height;
    const dw = sprite.width * s, dh = sprite.height * s;
    ctx.save();
    ctx.translate(mini.x, mini.y);
    ctx.rotate(player.angle + Math.PI / 2);
    ctx.scale(MINI_SCALE, MINI_SCALE); // 0.6× the main ship's rendered size
    ctx.shadowColor = th.accent;
    ctx.shadowBlur = 14;
    if (hit) ctx.filter = 'brightness(2.4) saturate(0.15)'; // white hit-flash
    ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh);
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    // Hardpoint FX on top (same layer as the main hull's sprite branch) so
    // the mini's thrusters flame and muzzles flash where its bullets spawn.
    const flicker = 0.7 + 0.3 * Math.sin(state.engineFlicker);
    const thrustOn = player.thrusterActive || player.boostActive;
    const flameFlicker = thrustOn ? (0.7 + 0.3 * Math.sin(state.engineFlicker * 2)) : 0;
    const boostGlow = player.boostActive ? 1.6 : 1;
    const weaponColor = (player.weapon && WEAPONS[player.weapon]) ? WEAPONS[player.weapon].color : '#ffffff';
    drawThrusterFlame(ctx, SHIP_GEOMETRY.thrusterL.x, SHIP_GEOMETRY.thrusterL.y, flicker, flameFlicker, boostGlow);
    drawThrusterFlame(ctx, SHIP_GEOMETRY.thrusterR.x, SHIP_GEOMETRY.thrusterR.y, flicker, flameFlicker, boostGlow);
    drawWeaponPaw(ctx, SHIP_GEOMETRY.frontPawL.x, SHIP_GEOMETRY.frontPawL.y, th.color, th.accent, state.pawFlashL, weaponColor, state);
    drawWeaponPaw(ctx, SHIP_GEOMETRY.frontPawR.x, SHIP_GEOMETRY.frontPawR.y, th.color, th.accent, state.pawFlashR, weaponColor, state);
    if (mini.muzzleFlash > 0) {
      drawMuzzleFlash(ctx, SHIP_GEOMETRY.muzzle.x, SHIP_GEOMETRY.muzzle.y,
        Math.min(1, mini.muzzleFlash / 0.18), weaponColor);
    }
    ctx.restore();
  } else {
    // ─── procedural fallback (themes without a sprite) ───
    const c = hit ? '#ffffff' : th.color;   // hit-flash: white hull
    drawCatShip(ctx, state, c, th.accent, th.pattern,
      { x: mini.x, y: mini.y, scale: MINI_SCALE, mini: true });
  }
}

/**
 * Mini HP bar (world space, unrotated) — only shown while the mini is
 * taking damage (v3.3.0 independent-HP lifecycle).
 * v3.10.0: bigger + white-outlined frame for low-HP visibility.
 */
export function drawMiniHpBar(ctx, mini) {
  if (mini.hp >= mini.maxHp) return;
  // v3.73.0: 36×6 bar lifted to -50px — the sprite clone is 84px tall, so the
  // old -26px offset sat inside the hull.
  const w = 36, h = 6;
  const x = mini.x - w / 2, y = mini.y - 50;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,24,0.85)';
  ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
  const frac = Math.max(0, mini.hp / mini.maxHp);
  ctx.fillStyle = frac > 0.5 ? '#69f0ae' : frac > 0.25 ? '#ffd54f' : '#ff5252';
  ctx.fillRect(x, y, w * frac, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

/**
 * v3.17.0: Arc-bolt coupling tether — visually "couples" a DOCKED mini to
 * the main hull (keeps them looking latched together). Drawn BEHIND the
 * ships (PlayerRenderer) so it reads as a tether, not a projectile.
 * v3.79.0: implementation moved to PlayerShipFx.js — a PROCEDURAL PULSING
 * PLASMA ARC (midpoint-displacement crackle + Math.sin energy pulse on the
 * core line width 1.5→3px + cyan/blue canvas shadow glow). Re-exported here
 * so PlayerRenderer's import path is unchanged.
 */
export { drawDockArc } from './PlayerShipFx.js';

// Filename: SpaceballsOneArt.js
// Kitty Vs Everything — v3.81.0
// "Spaceballs One" easter-egg ship art (js/modes/EasterEggs/SpaceballsOne/).
//
// Asset: .assets/We-Brake-For-Nobody.png (696×390 → 128×72 via the shared
// AssetManager pipeline, key `spaceballs_one` — tools/asset-manifest.json).
// The art's nose faces -x (left); the ship races top-right → bottom-left,
// so the blit is rotated by (heading − ART_NOSE_ANGLE) — a slight ~29° tilt
// on a 1280×720 stage. If the art is ever mirrored, flip ART_NOSE_ANGLE
// to 0 (nose +x) and the rotation math stays correct.
//
// Scale is dynamic: SPACEBALLS_ONE.scale (1.75) → 224×126 on screen.
// Headless / not-yet-decoded → procedural gold-wedge fallback (the game
// never breaks on a missing art file — AssetManager null-sprite contract).

import { getSprite, getDims, isReady } from '../../../core/AssetManager.js';
import { TAU } from '../../../core/utils.js';

export const SPACEBALLS_ART_KEY = 'spaceballs_one';
export const SPACEBALLS_ART_W = 128; // registry dims (normalized ≤128px)
export const SPACEBALLS_ART_H = 72;
export const ART_NOSE_ANGLE = Math.PI; // nose faces -x (left) in the raw art

/** Registry dims (available before decode — aspect-correct sizing). */
export function spaceballsArtDims() {
  return getDims(SPACEBALLS_ART_KEY) || { w: SPACEBALLS_ART_W, h: SPACEBALLS_ART_H };
}

/** Draw-ready canvas or null (the procedural fallback then). */
export function getSpaceballsArt() {
  return getSprite(SPACEBALLS_ART_KEY);
}

export function isSpaceballsArtReady() {
  return isReady(SPACEBALLS_ART_KEY);
}

/**
 * Draw the ship centered at (x, y), rotated so the nose follows the
 * velocity heading, scaled by `scale`. `heading` = atan2(vy, vx).
 */
export function drawSpaceballsShip(ctx, x, y, heading, scale) {
  const dims = spaceballsArtDims();
  const w = dims.w * scale;
  const h = dims.h * scale;
  const rot = heading - ART_NOSE_ANGLE;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.imageSmoothingEnabled = false; // crisp pixel art
  const art = getSpaceballsArt();
  if (art) {
    ctx.drawImage(art, -w / 2, -h / 2, w, h);
  } else {
    // Procedural fallback: gold wedge, red "brake" stripe, cyan cockpit.
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0); // nose (−x)
    ctx.lineTo(w / 2, -h / 2);
    ctx.lineTo(w * 0.32, 0);
    ctx.lineTo(w / 2, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e53935';
    ctx.fillRect(w * 0.1, -h * 0.16, w * 0.28, h * 0.32); // brake stripe
    ctx.fillStyle = '#80deea';
    ctx.beginPath();
    ctx.arc(-w * 0.18, 0, h * 0.14, 0, TAU); // cockpit
    ctx.fill();
  }
  ctx.restore();
}

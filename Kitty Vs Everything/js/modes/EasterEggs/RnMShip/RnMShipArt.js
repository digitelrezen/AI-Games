// Filename: RnMShipArt.js
// Kitty Vs Everything — v4.1.0
// "RnM ship" easter-egg interceptor art (js/modes/EasterEggs/RnMShip/).
//
// Asset: .assets/RnMship-256x256.png (256×256 native, uniform square art —
// the Rick & Morty ship) through the shared AssetManager pipeline, key
// `rnms` (tools/asset-manifest.json). The art's nose faces +x (right); the
// ship enters off-screen left flying right (dir = 1, unmirrored) and is
// mirrored (scaleX = -1) when it turns around and patrols back left
// (dir = -1) — the Planet Express ship-egg convention (ShipSprite.js).
//
// Scale is uniform: RNMSHIP.scale (0.5) → 128×128 on screen (the 256×256
// art keeps its square proportions — no stretch). Headless /
// not-yet-decoded → procedural orange-hull / cyan-dome fallback (the game
// never breaks on a missing art file — AssetManager null-sprite contract).

import { getSprite, getDims, isReady } from '../../../core/AssetManager.js';
import { TAU } from '../../../core/utils.js';

export const RNMSHIP_ART_KEY = 'rnms';
export const RNMSHIP_ART_W = 256; // registry dims (native 256×256)
export const RNMSHIP_ART_H = 256;

/** Registry dims (available before decode — aspect-correct sizing). */
export function rnmsArtDims() {
  return getDims(RNMSHIP_ART_KEY) || { w: RNMSHIP_ART_W, h: RNMSHIP_ART_H };
}

/** Draw-ready canvas or null (the procedural fallback then). */
export function getRnMShipArt() {
  return getSprite(RNMSHIP_ART_KEY);
}

export function isRnMShipArtReady() {
  return isReady(RNMSHIP_ART_KEY);
}

/**
 * Draw the ship at its top-left corner (x, y), scaled uniformly by
 * `scale`, mirrored when `dir < 0` (patrolling back left, nose -x).
 */
export function drawRnMShip(ctx, x, y, dir, scale) {
  const dims = rnmsArtDims();
  const w = dims.w * scale;
  const h = dims.h * scale;
  ctx.save();
  ctx.translate(x, y);
  if (dir < 0) ctx.scale(-1, 1); // nose faces +x; mirror when heading left
  ctx.imageSmoothingEnabled = false; // crisp pixel art
  const art = getRnMShipArt();
  if (art) {
    ctx.drawImage(art, 0, 0, w, h);
  } else {
    // Procedural fallback: orange hull wedge, cyan dome, green tail fin —
    // nose at +x (right) so the dir mirror stays correct.
    ctx.fillStyle = '#fb8c00';
    ctx.beginPath();
    ctx.moveTo(w * 0.98, h / 2); // nose
    ctx.lineTo(w * 0.30, h * 0.14);
    ctx.lineTo(w * 0.06, h * 0.30);
    ctx.lineTo(w * 0.06, h * 0.70);
    ctx.lineTo(w * 0.30, h * 0.86);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#43a047';
    ctx.fillRect(w * 0.02, h * 0.22, w * 0.10, h * 0.56); // tail fin
    ctx.fillStyle = '#80deea';
    ctx.beginPath();
    ctx.arc(w * 0.58, h / 2, h * 0.16, 0, TAU); // dome
    ctx.fill();
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.arc(w * 0.82, h / 2, h * 0.08, 0, TAU); // cockpit light
    ctx.fill();
  }
  ctx.restore();
}
// Filename: MiniPosterSprite.js
// Kitty Vs Everything — v1.0.0
// Sprite pipeline for the mini-ship power-up: an "Adopt Me!" WANTED poster —
// a cat behind bars — rendered as 28×28 pixel art.
//
// The PNG is embedded below as base64 (267 bytes, generated in the
// C:\Dev\AI-GAMES\.cline\adoptme-poster sandbox) so the sprite works in BOTH the
// dev server (native ES modules) and the single-file standalone build
// (game-standalone.html runs from a double-click — no server, no .assets
// folder next to it). Same approach as Wasp2Sprite.js.
//
// The sprite is 28×28 so it lines up EXACTLY with the PowerUp 'mini' hitbox
// (radius 14 → a 28×28 square centered on the drop's origin). No physics
// change — PowerUp.radius stays 14.
//
// Pipeline (runs once, at import time — long before the first mini drop):
//   1. Decode the embedded PNG into an offscreen canvas at native 28×28.
//   2. No keying / downscale needed — the art is already final pixel art
//      with a proper alpha channel (transparent corners, opaque poster).
export const VERSION = 'v1.0.0';

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAAA0klEQVR42mPwM9H7T0/MACJeXF1MF4zTQpgYPpoQJttCXJZgcwguMZItJGQRIUcQZSE2SwgFNdV8SIyFFMUh3VMpMjZ39yda/P9ca5zqibIQZgCIJmQhSA1FFiIbAGMjY0LiJFmIboCuNB9BC0FqQBhZfOhYSE6QUtXCXi8r+lpIdR/SPZViy4ekWEhRSUPTou2YhgachrFxicPYyHx0cXRzUCzEZyg2NjKNzSJ0x2K1EJurcfmIkIXYHEW2D3FZiEsdURbiMoxYCwnG4aCpgIeHhfTEAAvCaQSyKlPjAAAAAElFTkSuQmCC';

export const SPRITE_W = 28;
export const SPRITE_H = 28;

let spriteCanvas = null;
let loadPromise = null;

function buildSprite(img) {
  const out = document.createElement('canvas');
  out.width = SPRITE_W;
  out.height = SPRITE_H;
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = false; // crisp pixels — no bilinear blur
  octx.drawImage(img, 0, 0, SPRITE_W, SPRITE_H);
  return out;
}

/** @returns {HTMLCanvasElement|null} Processed sprite, or null before ready. */
export function getMiniPosterSprite() {
  return spriteCanvas;
}

/** @returns {boolean} True once the sprite pipeline has finished. */
export function isMiniPosterSpriteReady() {
  return spriteCanvas !== null;
}

/**
 * Kick off (or join) the sprite pipeline.
 * @returns {Promise<void>} Resolves when the sprite is ready.
 */
export function loadMiniPosterSprite() {
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          spriteCanvas = buildSprite(img);
          resolve();
        } catch (err) {
          loadPromise = null; // allow a retry
          reject(err);
        }
      };
      img.onerror = () => {
        loadPromise = null;
        reject(new Error('MiniPoster sprite: failed to decode embedded PNG'));
      };
      img.src = 'data:image/png;base64,' + PNG_BASE64;
    });
  }
  return loadPromise;
}

// Start at import time: the first mini drop can appear on wave 1, so the
// sprite is ready well before it's needed. Failures are non-fatal — PowerUp
// falls back to the classic cat-head icon until (if) the pipeline succeeds.
loadMiniPosterSprite().catch(() => {});

// tools/derive-wasp2-sprite.mjs
// Kitty Vs Everything — v3.94.0
//
// Regenerates js/enemies/sprites/Wasp2Sprite.js from the NEW full-color
// pixel-art wasp:
//
//   <AI-GAMES>/.assets/Wasp2-256x256.png   (256×256, 8-bit RGBA, real alpha)
//
// Run:  node tools/derive-wasp2-sprite.mjs
//
// v1.1.0 (v3.94.0): the old sprite was a black wireframe derived at RUNTIME
// from the black-on-white "Wasp 1 Pixel Art.png" (flood-fill frame removal +
// white-keying + bilinear downscale + alpha dilation). The new art ships as
// full-color RGBA with a real alpha channel, so all of that runtime keying is
// gone — the generator now just crops to the content bbox (+1px padding),
// re-encodes, and embeds the payload. The browser side is a 1:1 decode onto
// a canvas (bilinear smoothing kept opt-in for the gameplay downscale).
//
// The sprite stays OPTIONAL at runtime: Wasp2Enemy.js draws a plain dark
// circle until (or if) the decode finishes / works.
//
// Re-run any time the source PNG changes.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, bboxOf, cropRgba, asciiMap } from './derive-cat-sprites.mjs';

const TOOLS_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = resolve(TOOLS_DIR, '..');
const ASSET_DIR = resolve(ROOT, '..', '.assets'); // <AI-GAMES>/.assets (shared art folder)

const SRC = 'Wasp2-256x256.png';
const OUT = join(ROOT, 'js', 'enemies', 'sprites', 'Wasp2Sprite.js');
const PAD = 1; // 1px transparent border around the content bbox

const buf = readFileSync(join(ASSET_DIR, SRC));
const img = decodePng(buf); // throws unless 8-bit RGB(A); always returns 4-channel data
console.log(`\n═══ Wasp2 enemy sprite — ${SRC} ═══`);
console.log(`source:        ${img.w}×${img.h}, ${(buf.length / 1024).toFixed(1)} KB`);

const bbox = bboxOf(img.data, img.w, img.h);
console.log(`content bbox:  x=${bbox.x}, y=${bbox.y}, ${bbox.w}×${bbox.h}`);

// 1px padding around the bbox (clamped to the image)
const crop = {
  x: Math.max(0, bbox.x - PAD),
  y: Math.max(0, bbox.y - PAD),
  w: Math.min(img.w - Math.max(0, bbox.x - PAD), bbox.w + PAD * 2),
  h: Math.min(img.h - Math.max(0, bbox.y - PAD), bbox.h + PAD * 2),
};
const cropped = cropRgba(img.data, img.w, img.h, crop);
const png = encodePng(cropped.w, cropped.h, cropped.data);
const b64 = png.toString('base64');

console.log(`crop:          x=${crop.x}, y=${crop.y}, ${crop.w}×${crop.h}`);
console.log(`sprite:        ${cropped.w}×${cropped.h} (no downscale — art is already at game scale)`);
console.log(`re-encoded:    ${(png.length / 1024).toFixed(1)} KB PNG → ${(b64.length / 1024).toFixed(1)} KB base64`);
console.log(`\nASCII preview (source):\n${asciiMap(img.data, img.w, img.h)}`);

const source = `// Filename: Wasp2Sprite.js
// Kitty Vs Everything — v3.94.0
// GENERATED FILE — regenerate with:  node tools/derive-wasp2-sprite.mjs
//
// Wasp2 enemy sprite (v1.1.0): the full-color pixel-art wasp from
// \`\${AI-GAMES}/.assets/${SRC}\` (${img.w}×${img.h}, 8-bit RGBA, real
// alpha channel — no white-background keying needed). Replaces the old
// black wireframe that was derived at runtime from "Wasp 1 Pixel Art.png".
//
// Generation pipeline (Node, at generation time — not at runtime):
//   1. Crop to the non-transparent content bbox + 1px padding:
//      x=${crop.x}, y=${crop.y}, ${crop.w}×${crop.h}.
//   2. Re-encode as an 8-bit RGBA PNG and embed as base64 below.
// The browser side is trivial: decode the embedded PNG onto a canvas 1:1
// (bilinear smoothing kept opt-in for the gameplay downscale).
//
// The sprite is OPTIONAL at runtime: Wasp2Enemy.js draws a plain dark
// circle until (or if) the decode finishes / works.

export const WASP2_B64 =
  '${b64}';

/** Processed sprite dimensions (px) — bbox crop, see header. */
export const WASP2_W = ${cropped.w};
export const WASP2_H = ${cropped.h};

export const VERSION = 'v1.1.0';

let spriteCanvas = null;
let loadPromise = null;

function buildSprite(img) {
  const out = document.createElement('canvas');
  out.width = WASP2_W;
  out.height = WASP2_H;
  const octx = out.getContext('2d', { willReadFrequently: true });
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(img, 0, 0, WASP2_W, WASP2_H);
  return out;
}

/** @returns {HTMLCanvasElement|null} Processed sprite, or null before ready. */
export function getWasp2Sprite() {
  return spriteCanvas;
}

/** @returns {boolean} True once the sprite pipeline has finished. */
export function isWasp2SpriteReady() {
  return spriteCanvas !== null;
}

/**
 * Kick off (or join) the sprite pipeline.
 * @returns {Promise<void>} Resolves when the sprite is ready.
 */
export function loadWasp2Sprite() {
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const img = new Image(); // Node (headless): throws in the executor → reject → caught below
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
        reject(new Error('Wasp2 sprite: failed to decode embedded PNG'));
      };
      img.src = 'data:image/png;base64,' + WASP2_B64;
    });
  }
  return loadPromise;
}

// Start at import time: Wasp2 first spawns on wave 2, so the sprite is long
// ready by then. Failures are non-fatal — Wasp2Enemy falls back to a plain
// dark circle until (if) the pipeline succeeds.
loadWasp2Sprite().catch(() => {});
`;

writeFileSync(OUT, source, 'utf8');
console.log(`\nwrote:         ${OUT}`);
console.log('Done. Re-run any time the source PNG changes.');

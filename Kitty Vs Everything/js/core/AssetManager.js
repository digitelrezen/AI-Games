// Filename: AssetManager.js
// Kitty Vs Everything — v3.33.0
// Runtime asset manager for the shared transparent-PNG pipeline.
//
// The heavy lifting happens at BUILD time in tools/import-assets.mjs, which
// discovers + validates the PNGs in Z:\Dev\AI-GAMES\.assets (via
// tools/asset-manifest.json), normalizes them (≤128px, 8-bit RGBA) and
// generates AssetSprites.js (embedded base64 + dimensions). This module
// decodes that registry into draw-ready canvases with PER-KEY ERROR
// ISOLATION: a missing or corrupt asset resolves to null and the consumer
// (PowerUp.js, …) draws its procedural fallback — the game never breaks on
// a missing art file, and one bad asset never takes down the others.
//
// Node-safe: importing under Node (headless checks) never throws —
// loadAssets() resolves with an empty ready-set (no Image in Node), so the
// null-sprite fallback contract holds everywhere.

import { ASSET_B64, ASSET_DIMS } from './AssetSprites.js';

const canvases = new Map(); // key → HTMLCanvasElement | null (null = failed/undecoded)
const failed = new Set();   // keys that failed to decode (logged once, never retried)
let loading = null;         // in-flight loadAssets() promise (shared)

/** All asset keys known to the generated registry (sorted). */
export function assetKeys() {
  return Object.keys(ASSET_B64).sort();
}

/** Static dimensions from the import registry — available BEFORE decode.
 *  Consumers use these for aspect-correct sizing even while the canvas is
 *  still decoding (or fell back to null). */
export function getDims(key) {
  return ASSET_DIMS[key] || null;
}

/**
 * Decode every key (or a subset) into offscreen canvases. Idempotent:
 * concurrent calls share one promise, already-decoded keys are skipped.
 * Resolves { ready: {key: true, …}, failed: [keys] }.
 */
export function loadAssets(keys = assetKeys()) {
  // Headless (Node): no Image/document — resolve with nothing decoded.
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve({ ready: {}, failed: [] });
  }
  if (!loading) {
    loading = Promise.all(
      keys.map((key) => {
        if (canvases.has(key) || failed.has(key)) return null;
        const b64 = ASSET_B64[key];
        const dims = ASSET_DIMS[key];
        if (!b64 || !dims) {
          failed.add(key);
          console.warn(`[AssetManager] "${key}" is not in the generated registry — run tools/import-assets.mjs (procedural fallback active)`);
          return null;
        }
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            try {
              const c = document.createElement('canvas');
              c.width = dims.w;
              c.height = dims.h;
              c.getContext('2d').drawImage(img, 0, 0, dims.w, dims.h);
              canvases.set(key, c);
            } catch (err) {
              failed.add(key);
              canvases.set(key, null);
              console.warn(`[AssetManager] "${key}" failed to decode — ${err && err.message} (procedural fallback active)`);
            }
            resolve();
          };
          img.onerror = () => {
            failed.add(key);
            canvases.set(key, null);
            console.warn(`[AssetManager] "${key}" image load failed (corrupt base64?) — procedural fallback active`);
            resolve();
          };
          img.src = 'data:image/png;base64,' + b64;
        });
      })
    ).then(() => {
      const ready = {};
      for (const [k, c] of canvases) if (c) ready[k] = true;
      return { ready, failed: [...failed] };
    }).finally(() => { loading = null; });
  }
  return loading;
}

/** Draw-ready canvas for a key — null until decoded (or if it failed).
 *  Consumers MUST treat null as "draw the procedural fallback". */
export function getSprite(key) {
  return canvases.has(key) ? canvases.get(key) : null;
}

/** True once the key's canvas is decoded and draw-ready. */
export function isReady(key) {
  return !!canvases.get(key);
}

/** True when every key in the list is decoded (empty list → true). */
export function allReady(keys = assetKeys()) {
  return keys.every((k) => isReady(k));
}

/**
 * Power-up drop type → asset key map (v3.33.0 power-up art).
 * PowerUp.js draws through this map; the five keys are imported from
 * .assets by tools/import-assets.mjs (see tools/asset-manifest.json):
 *   health    ← Health-pixel-art.png          (hull repair)
 *   extralife ← Extra-life-pink-pixel_art.png (extra life)
 *   shield    ← Shield-pixel-art.png          (shield refill)
 *   frenzy    ← Frenzy-pixel-art.png          (30s all-cooldowns-off)
 *   crate     ← Crate-pixel-art.png           (bonus crate, shot to open)
 */
export const POWERUP_ASSETS = {
  health: 'health',
  life: 'extralife',
  shield: 'shield',
  frenzy: 'frenzy',
  crate: 'crate',
};

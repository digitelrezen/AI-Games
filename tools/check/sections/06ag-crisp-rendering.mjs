// ═══════════════════════════════════════════════════════════
//  [6ag] v3.88.0 GLOBAL CRISP PIXEL-ART RENDERING —
//        (1) style.css: a global `canvas, .pixel-art, img` rule forces
//            image-rendering: pixelated + crisp-edges so every canvas
//            and sprite element scales nearest-neighbor at any DPR/window.
//        (2) utils.js: new disableImageSmoothing(ctx) helper (standard
//            imageSmoothingEnabled + webkit/moz/ms vendor-prefixed
//            fallbacks, null-safe).
//        (3) Context-initialization enforcement: Game.js (main canvas),
//            ViewScaler.js (re-applied after EVERY buffer resize — a
//            canvas.width assignment resets 2D context state), main.js
//            (hangar hero canvas after its DPR buffer sizing),
//            AssetManager.js (shared PNG sprite cache) and PowerUp.js
//            (jewel icon buffer) all disable smoothing on their 2D
//            contexts.
//        (4) Intentional one-shot bilinear asset-downscale passes are
//            preserved: Wasp2Sprite.js + AsteroidSprite.js still opt in
//            with imageSmoothingEnabled = true on their own offscreen
//            sprite-generation contexts (never the live render canvas).
//        Headless: disableImageSmoothing({}) flips the standard flag.
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
{
  console.log('\n[6ag] v3.88.0 global crisp pixel-art rendering (source + headless)');
  const cssSrc = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  const utilsSrc = fs.readFileSync(path.join(ROOT, 'js/core/utils.js'), 'utf8');
  const gameSrc = fs.readFileSync(path.join(ROOT, 'js/core/Game.js'), 'utf8');
  const viewSrc = fs.readFileSync(path.join(ROOT, 'js/core/ViewScaler.js'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js/core/main.js'), 'utf8');
  const assetSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetManager.js'), 'utf8');
  const pwSrc = fs.readFileSync(path.join(ROOT, 'js/combat/PowerUp.js'), 'utf8');
  const waspSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/sprites/Wasp2Sprite.js'), 'utf8');
  const asteroidSrc = fs.readFileSync(path.join(ROOT, 'js/levels/AsteroidSprite.js'), 'utf8');
  const { disableImageSmoothing } = await mod('js/core/utils.js');

  // ── (1) global CSS rule ──
  check('style.css has the global `canvas, .pixel-art, img` selector',
    cssSrc.includes('canvas, .pixel-art, img'));
  check('style.css forces image-rendering: pixelated',
    cssSrc.includes('image-rendering: pixelated;'));
  check('style.css forces image-rendering: crisp-edges',
    cssSrc.includes('image-rendering: crisp-edges;'));

  // ── (2) utils helper ──
  check('utils.js exports disableImageSmoothing (runtime)', typeof disableImageSmoothing === 'function');
  check('utils.js sets the standard imageSmoothingEnabled flag',
    utilsSrc.includes('ctx.imageSmoothingEnabled = false;'));
  check('utils.js carries webkit/moz/ms vendor-prefixed fallbacks',
    utilsSrc.includes('webkitImageSmoothingEnabled') && utilsSrc.includes('mozImageSmoothingEnabled') && utilsSrc.includes('msImageSmoothingEnabled'));
  check('headless: disableImageSmoothing({}) flips the standard flag', (() => {
    const ctx = {};
    disableImageSmoothing(ctx);
    return ctx.imageSmoothingEnabled === false;
  })());
  check('disableImageSmoothing is null-safe', disableImageSmoothing(null) === null);

  // ── (3) context-initialization enforcement ──
  check('Game.js disables smoothing on the main canvas context', gameSrc.includes('disableImageSmoothing(this.ctx)'));
  check('ViewScaler.js re-applies smoothing after the buffer resize',
    viewSrc.includes("disableImageSmoothing(this.canvas.getContext('2d'))"));
  check('main.js disables smoothing on the hangar hero canvas', mainSrc.includes('disableImageSmoothing(hangarCtx)'));
  check('AssetManager.js disables smoothing on the sprite cache context', assetSrc.includes('disableImageSmoothing(g)'));
  check('PowerUp.js disables smoothing on the jewel icon buffer', pwSrc.includes('disableImageSmoothing(g)'));

  // ── (4) intentional bilinear asset-downscale passes preserved ──
  check('Wasp2Sprite.js keeps its explicit bilinear downscale opt-in', waspSrc.includes('octx.imageSmoothingEnabled = true;'));
  check('AsteroidSprite.js keeps its explicit bilinear downscale opt-in', asteroidSrc.includes('octx.imageSmoothingEnabled = true;'));
}
}
// ═══════════════════════════════════════════════════════════
//  [6ag] v3.88.1 SCOPED CRISP PIXEL-ART RENDERING —
//        (1) style.css: image-rendering: pixelated + crisp-edges is
//            scoped STRICTLY to the #game-canvas rule (the v3.88.0
//            global canvas/.pixel-art/img rule was reverted — it
//            pixelated the hangar hero preview and the UI).
//        (2) utils.js: disableImageSmoothing(ctx) helper (standard
//            imageSmoothingEnabled + webkit/moz/ms vendor-prefixed
//            fallbacks, null-safe).
//        (3) Context-initialization enforcement: Game.js (main canvas),
//            ViewScaler.js (re-applied after EVERY buffer resize — a
//            canvas.width assignment resets 2D context state),
//            AssetManager.js (shared PNG sprite cache) and PowerUp.js
//            (jewel icon buffer) disable smoothing on their 2D
//            contexts. The hangar hero canvas (main.js) deliberately
//            keeps default bilinear smoothing — the ship preview is
//            upscaled and nearest-neighbor made it jagged.
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
  console.log('\n[6ag] v3.88.1 scoped crisp pixel-art rendering (source + headless)');
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

  // ── (1) CSS scoped to the main gameplay canvas only ──
  check('style.css scopes image-rendering to the #game-canvas rule',
    /#game-canvas\s*{[^}]*image-rendering:\s*pixelated;[^}]*image-rendering:\s*crisp-edges;/.test(cssSrc));
  check('style.css: the v3.88.0 global canvas/.pixel-art/img rule is gone',
    !cssSrc.includes('canvas, .pixel-art, img'));

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

  // ── (3) context-initialization enforcement (gameplay canvas only) ──
  check('Game.js disables smoothing on the main canvas context', gameSrc.includes('disableImageSmoothing(this.ctx)'));
  check('ViewScaler.js re-applies smoothing after the buffer resize',
    viewSrc.includes("disableImageSmoothing(this.canvas.getContext('2d'))"));
  check('AssetManager.js disables smoothing on the sprite cache context', assetSrc.includes('disableImageSmoothing(g)'));
  check('PowerUp.js disables smoothing on the jewel icon buffer', pwSrc.includes('disableImageSmoothing(g)'));
  check('main.js keeps default bilinear smoothing on the hangar hero canvas (no disableImageSmoothing)',
    !mainSrc.includes('disableImageSmoothing'));

  // ── (4) intentional bilinear asset-downscale passes preserved ──
  check('Wasp2Sprite.js keeps its explicit bilinear downscale opt-in', waspSrc.includes('octx.imageSmoothingEnabled = true;'));
  check('AsteroidSprite.js keeps its explicit bilinear downscale opt-in', asteroidSrc.includes('octx.imageSmoothingEnabled = true;'));
}
}
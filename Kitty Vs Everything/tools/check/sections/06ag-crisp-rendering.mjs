// ═══════════════════════════════════════════════════════════
//  [6ag] v3.100.0 CRISP NATIVE CATSHIP HANGAR — TERMINAL PREVIEW —
//        (1) style.css: image-rendering: pixelated + crisp-edges is
//            scoped to #game-canvas AND #hangar-canvas (the v3.88.0
//            global canvas/.pixel-art/img rule stays reverted).
//            #hangar-canvas is the square 448×448 showcase stage:
//            main.js blits the cat_* art at NATIVE 1:1 (1 art px =
//            1 CSS px, no downscale) onto a ×DPR buffer, so the
//            pixelated filter reproduces the art crisply instead of
//            the v3.88.0 jagged aliasing.
//        (2) utils.js: disableImageSmoothing(ctx) helper (standard
//            imageSmoothingEnabled + webkit/moz/ms vendor-prefixed
//            fallbacks, null-safe).
//        (3) Context-initialization enforcement: Game.js (main canvas),
//            ViewScaler.js (re-applied after EVERY buffer resize — a
//            canvas.width assignment resets 2D context state),
//            AssetManager.js (shared PNG sprite cache), PowerUp.js
//            (jewel icon buffer) and main.js (hangar hero canvas —
//            after its DPR buffer sizing) disable smoothing on their
//            2D contexts.
//        (4) main.js: the hangar TACTICAL PREVIEW (v3.100.0) blits the
//            selected cat_* sprite at NATIVE resolution — 1:1, no
//            downscale, no showcase zoom — centered on the FIXED stage
//            midpoint (224, 224) of the square 448×448 stage (buffer
//            ×DPR), over the drawTacticalOverlay wireframe layer; the
//            procedural PlayerRenderer hull is the fallback until the
//            sprite decodes.
//        (5) Intentional one-shot bilinear asset-downscale passes are
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
  console.log('\n[6ag] v3.100.0 crisp 256×384 native catship hangar — terminal 1:1 preview (source + headless)');
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

  // ── (1) CSS scoped to the gameplay canvas + hangar hero canvas ──
  check('style.css scopes image-rendering to the #game-canvas rule',
    /#game-canvas\s*{[^}]*image-rendering:\s*pixelated;[^}]*image-rendering:\s*crisp-edges;/.test(cssSrc));
  check('style.css scopes image-rendering to the #hangar-canvas rule (v3.90.0)',
    /#hangar-canvas\s*{[^}]*image-rendering:\s*pixelated;[^}]*image-rendering:\s*crisp-edges;/.test(cssSrc));
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

  // ── (3) context-initialization enforcement ──
  check('Game.js disables smoothing on the main canvas context', gameSrc.includes('disableImageSmoothing(this.ctx)'));
  check('ViewScaler.js re-applies smoothing after the buffer resize',
    viewSrc.includes("disableImageSmoothing(this.canvas.getContext('2d'))"));
  check('AssetManager.js disables smoothing on the sprite cache context', assetSrc.includes('disableImageSmoothing(g)'));
  check('PowerUp.js disables smoothing on the jewel icon buffer', pwSrc.includes('disableImageSmoothing(g)'));
  check('main.js disables smoothing on the hangar hero canvas (v3.90.0)',
    mainSrc.includes('disableImageSmoothing(hangarCtx)'));

  // ── (4) native 1:1 terminal preview blit (v3.100.0: square 448×448 stage) ──
  check('main.js defines the HANGAR_STAGE 448×448 showcase stage (v3.100.0)',
    mainSrc.includes('const HANGAR_STAGE = 448;'));
  check('main.js sizes the hangar buffer to the 448×448 stage ×DPR (v3.100.0)',
    mainSrc.includes('hangarCanvas.width = Math.round(HANGAR_STAGE * HANGAR_DPR);') &&
    mainSrc.includes('hangarCanvas.height = Math.round(HANGAR_STAGE * HANGAR_DPR);'));
  check('style.css: #hangar-canvas is the square 448×448 stage (v3.100.0)',
    /#hangar-canvas\s*{[^}]*width:\s*448px;[^}]*height:\s*448px;/.test(cssSrc));
  check('main.js clears the full 448×448 logical stage (v3.100.0)',
    mainSrc.includes('hangarCtx.clearRect(0, 0, HANGAR_STAGE, HANGAR_STAGE)'));
  check('main.js blits the sprite at NATIVE 1:1 (no downscale), centered on (224, 224) (v3.100.0)',
    mainSrc.includes('hangarCtx.drawImage(sprite, C - sprite.width / 2, C - sprite.height / 2, sprite.width, sprite.height)') &&
    mainSrc.includes('const C = HANGAR_STAGE / 2;'));
  check('main.js draws the tactical wireframe overlay behind the ship (v3.100.0)',
    mainSrc.includes('function drawTacticalOverlay(ctx, th)') &&
    mainSrc.includes('drawTacticalOverlay(hangarCtx, th)'));
  check('main.js keeps the procedural hull as the pre-sprite fallback',
    mainSrc.includes('new PlayerRenderer(mockPlayer).drawCatShip('));

  // ── (5) intentional bilinear asset-downscale passes preserved ──
  check('Wasp2Sprite.js keeps its explicit bilinear downscale opt-in', waspSrc.includes('octx.imageSmoothingEnabled = true;'));
  check('AsteroidSprite.js keeps its explicit bilinear downscale opt-in', asteroidSrc.includes('octx.imageSmoothingEnabled = true;'));
}
}

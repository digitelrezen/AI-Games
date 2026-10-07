// ═══════════════════════════════════════════════════════════
//  [6ag] v3.90.0 CRISP 256×384 NATIVE CATSHIP HANGAR —
//        (1) style.css: image-rendering: pixelated + crisp-edges is
//            scoped to #game-canvas AND #hangar-canvas (the v3.88.0
//            global canvas/.pixel-art/img rule stays reverted).
//            #hangar-canvas is the 320×384 native frame: main.js blits
//            each native 256×384 cat sprite at the integer HANGAR_K
//            scale (1 native pixel = 1 CSS pixel, 2×2 blocks at DPR 2)
//            — a uniform integer downsample, so the pixelated filter
//            reproduces the art exactly instead of the v3.88.0 jagged
//            aliasing.
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
//        (4) main.js: the hangar hero preview is a 1:1 integer blit of
//            the native 256×384 art — HANGAR_K = max(1, round(DPR));
//            the stage is 320×384 (buffer ×DPR); each ship's CONTENT
//            box (alpha bbox measured once per sprite, cached in
//            hangarMetrics — lazy because renderHangar runs before
//            loadAssets resolves) is drawn content-centered on the
//            FIXED stage midpoint (160, 192) at the identical scale —
//            completely stationary (no bounce); the procedural
//            PlayerRenderer hull is the fallback until the sprite
//            decodes.
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
  console.log('\n[6ag] v3.90.0 crisp 256×384 native catship hangar (source + headless)');
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

  // ── (4) 1:1 integer-mapped hangar blit (v3.90.0: 320×384 native stage) ──
  check('main.js computes the integer HANGAR_K preview scale',
    mainSrc.includes('const HANGAR_K = Math.max(1, Math.round(HANGAR_DPR));'));
  check('main.js sizes the hangar buffer to the 320×384 native stage (v3.90.0)',
    mainSrc.includes('hangarCanvas.width = Math.round(320 * HANGAR_DPR);') &&
    mainSrc.includes('hangarCanvas.height = Math.round(384 * HANGAR_DPR);'));
  check('style.css: #hangar-canvas is the 320×384 native frame (v3.90.0)',
    /#hangar-canvas\s*{[^}]*width:\s*320px;[^}]*height:\s*384px;/.test(cssSrc));
  check('main.js clears the full 320×384 logical stage (v3.90.0)',
    mainSrc.includes('hangarCtx.clearRect(0, 0, 320, 384)'));
  check('main.js measures per-ship content boxes (lazy hangarMetrics cache)',
    mainSrc.includes('let hangarMetrics = null;') && mainSrc.includes('function measureHangarSprite(sprite)'));
  check('main.js blits the content box 1:1, centered on the fixed stage midpoint (160, 192) (v3.90.0)',
    mainSrc.includes('hangarCtx.drawImage(sprite, m.sx, m.sy, m.sw, m.sh, 160 - dw / 2, 192 - dh / 2, dw, dh)'));
  check('main.js keeps the procedural hull as the pre-sprite fallback',
    mainSrc.includes('new PlayerRenderer(mockPlayer).drawCatShip('));

  // ── (5) intentional bilinear asset-downscale passes preserved ──
  check('Wasp2Sprite.js keeps its explicit bilinear downscale opt-in', waspSrc.includes('octx.imageSmoothingEnabled = true;'));
  check('AsteroidSprite.js keeps its explicit bilinear downscale opt-in', asteroidSrc.includes('octx.imageSmoothingEnabled = true;'));
}
}

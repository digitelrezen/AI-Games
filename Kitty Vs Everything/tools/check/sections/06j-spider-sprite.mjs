// ═══════════════════════════════════════════════════════════
//  [6j] v3.57.0 SPIDER PIXEL-ART SPRITE — web-spinner now draws
//       the shared PNG (key "spider") with crawler gait + a bright
//       red hourglass dorsal mark; procedural fallback kept
// ═══════════════════════════════════════════════════════════

import { ROOT, check } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');

export default async function run() {
console.log('\n[6j] v3.57.0 spider pixel-art sprite + red hourglass mark');
{
  const spSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/SpiderEnemy.js'), 'utf8');
  check('SpiderEnemy: VERSION = v1.2.0', spSrc.includes("VERSION = 'v1.2.0'"));
  check('SpiderEnemy: sprite key "spider" via AssetManager', spSrc.includes("SPIDER_SPRITE_KEY = 'spider'") && spSrc.includes('getSprite(SPIDER_SPRITE_KEY)'));
  check('SpiderEnemy: null-sprite → procedural fallback branch', spSrc.includes('this._drawProcedural(ctx, r)'));
  check('SpiderEnemy: crawler gait (bob/sway/tilt) in sprite draw', spSrc.includes('const bob = Math.sin(this.t * 5)') && spSrc.includes('const sway = Math.sin(this.t * 2.5)') && spSrc.includes('const tilt = Math.sin(this.t * 2.5)'));
  check('SpiderEnemy: aspect-preserving nearest-neighbor draw', spSrc.includes('(targetW * dims.h) / dims.w') && spSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('SpiderEnemy: bright red hourglass dorsal mark', spSrc.includes('_drawHourglassMark(ctx, targetW, targetH)') && spSrc.includes('rgba(255, 34, 34,') && spSrc.includes('-targetH * 0.09'));
  check('SpiderEnemy: procedural fallback keeps red hourglass marking', spSrc.includes('BRIGHT RED HOURGLASS marking (dorsal/back section)'));
  check('AssetSprites: spider sprite dims 128×128 registered', /spider:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(spritesSrc));
}

}

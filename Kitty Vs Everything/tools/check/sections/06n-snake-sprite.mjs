// ═══════════════════════════════════════════════════════════
//  [6n] v3.61.0 SNAKE PIXEL-ART SPRITE — slithering serpent now
//       draws the shared PNG (key "snake") with a slither gait
//       (sway/bob/tilt phase-locked to the movement sine) + a
//       type-color accent glow; procedural fallback kept
// ═══════════════════════════════════════════════════════════

import { ROOT, check } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');

export default async function run() {
console.log('\n[6n] v3.61.0 snake pixel-art sprite');
{
  const snSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/SnakeEnemy.js'), 'utf8');
  check('SnakeEnemy: VERSION = v1.2.0', snSrc.includes("VERSION = 'v1.2.0'"));
  check('SnakeEnemy: sprite key "snake" via AssetManager', snSrc.includes("SNAKE_SPRITE_KEY = 'snake'") && snSrc.includes('getSprite(SNAKE_SPRITE_KEY)'));
  check('SnakeEnemy: null-sprite → procedural fallback branch', snSrc.includes('this._drawProcedural(ctx, r)'));
  check('SnakeEnemy: slither gait (sway/bob/tilt) phase-locked to the movement sine', snSrc.includes('const sway = Math.sin(this.t * 3)') && snSrc.includes('const bob = Math.sin(this.t * 6)') && snSrc.includes('const tilt = Math.sin(this.t * 3 + 0.6)'));
  check('SnakeEnemy: aspect-preserving nearest-neighbor draw', snSrc.includes('(targetW * dims.h) / dims.w') && snSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('SnakeEnemy: type-color accent glow pass', snSrc.includes('ctx.shadowColor = this.color') && snSrc.includes('ctx.shadowBlur = r * 0.8'));
  check('AssetSprites: snake sprite dims 128×128 registered', /snake:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(spritesSrc));
}

}

// ═══════════════════════════════════════════════════════════
//  [6p] v3.63.0 LIZARD PIXEL-ART SPRITE — slow tank now draws
//       the shared PNG (key "lizard") with a tank gait
//       (sway/bob/tilt phase-locked to the fixed-altitude
//       hover bob) + type-color accent glow; procedural
//       fallback retained
// ═══════════════════════════════════════════════════════════

import { ROOT, check } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');

export default async function run() {
console.log('\n[6p] v3.63.0 lizard pixel-art sprite');
{
  const lzSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/LizardEnemy.js'), 'utf8');
  check('LizardEnemy: VERSION = v1.2.0', lzSrc.includes("VERSION = 'v1.2.0'"));
  check('LizardEnemy: sprite key "lizard" via AssetManager', lzSrc.includes("LIZARD_SPRITE_KEY = 'lizard'") && lzSrc.includes('getSprite(LIZARD_SPRITE_KEY)'));
  check('LizardEnemy: null-sprite → procedural fallback branch', lzSrc.includes('this._drawProcedural(ctx, r)'));
  check('LizardEnemy: tank gait (sway/bob/tilt) phase-locked to the hover bob (this.t)', lzSrc.includes('const sway = Math.sin(this.t)') && lzSrc.includes('const tilt = Math.sin(this.t + 0.6)'));
  check('LizardEnemy: aspect-preserving nearest-neighbor draw', lzSrc.includes('(targetW * dims.h) / dims.w') && lzSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('LizardEnemy: ground shadow + type-color accent glow pass', lzSrc.includes('ctx.ellipse(0, targetH * 0.41') && lzSrc.includes('ctx.shadowColor = this.color'));
  check('LizardEnemy: procedural fallback art intact (tongue/tail/scales)', lzSrc.includes('tongueOut') && lzSrc.includes('tailSway') && lzSrc.includes('segGrad'));
  check('AssetSprites: lizard sprite dims 128×128 registered', /lizard:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(spritesSrc));
}

}

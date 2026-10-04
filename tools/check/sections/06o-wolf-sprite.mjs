// ═══════════════════════════════════════════════════════════
//  [6o] v3.62.0 WOLF PIXEL-ART SPRITE — pack hunter now draws
//       the shared PNG (key "wolf") with a pack-sine gait
//       (sway/bob/tilt phase-locked to the movement sine) +
//       type-color accent glow; procedural fallback retained
// ═══════════════════════════════════════════════════════════

import { ROOT, check } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');

export default async function run() {
console.log('\n[6o] v3.62.0 wolf pixel-art sprite');
{
  const wfSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/WolfEnemy.js'), 'utf8');
  check('WolfEnemy: VERSION = v1.2.0', wfSrc.includes("VERSION = 'v1.2.0'"));
  check('WolfEnemy: sprite key "wolf" via AssetManager', wfSrc.includes("WOLF_SPRITE_KEY = 'wolf'") && wfSrc.includes('getSprite(WOLF_SPRITE_KEY)'));
  check('WolfEnemy: null-sprite → procedural fallback branch', wfSrc.includes('this._drawProcedural(ctx, r)'));
  check('WolfEnemy: pack-sine gait (sway/bob/tilt) phase-locked to the movement sine', wfSrc.includes('const phase = this.t * 1.2 + this.baseX * 0.01') && wfSrc.includes('const sway = Math.sin(phase)') && wfSrc.includes('const tilt = Math.sin(phase + 0.6)'));
  check('WolfEnemy: aspect-preserving nearest-neighbor draw', wfSrc.includes('(targetW * dims.h) / dims.w') && wfSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('WolfEnemy: type-color accent glow pass', wfSrc.includes('ctx.shadowColor = this.color') && wfSrc.includes('ctx.shadowBlur = r * 0.8'));
  check('AssetSprites: wolf sprite dims 122×128 registered', /wolf:\s*\{\s*w:\s*122,\s*h:\s*128\s*\}/.test(spritesSrc));
}

}

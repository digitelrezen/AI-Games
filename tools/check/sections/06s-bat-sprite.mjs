// ═══════════════════════════════════════════════════════════
//  [6s] v3.66.0 BAT PIXEL-ART SPRITE — erratic flutterer now draws
//       the shared PNG (key "bat", 679×367 → 128×69) upright
//       (head/ears up, wings spread) with a wing-beat (t*14) +
//       flutter wobble + hover bob (t*3) phase-locked to the
//       procedural flap + type-color accent glow; procedural
//       fallback retained
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const { ENEMY_TYPES, WAVE } = await mod('js/core/config.js');
const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');

export default async function run() {
console.log('\n[6s] v3.66.0 bat pixel-art sprite');
{
  const baSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/BatEnemy.js'), 'utf8');
  check('BatEnemy: VERSION = v1.2.0', baSrc.includes("VERSION = 'v1.2.0'"));
  check('BatEnemy: sprite key "bat" via AssetManager', baSrc.includes("BAT_SPRITE_KEY = 'bat'") && baSrc.includes('getSprite(BAT_SPRITE_KEY)'));
  check('BatEnemy: null-sprite → procedural fallback branch', baSrc.includes('this._drawProcedural(ctx, r)'));
  check('BatEnemy: wing-beat (t*14) + hover bob (t*3) phase-locked to the procedural flap', baSrc.includes('const flap = Math.sin(this.t * 14)') && baSrc.includes('const bob = Math.sin(this.t * 3)'));
  check('BatEnemy: aspect-preserving nearest-neighbor draw', baSrc.includes('(targetW * dims.h) / dims.w') && baSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('BatEnemy: type-color accent glow pass', baSrc.includes('ctx.shadowColor = this.color') && baSrc.includes('ctx.shadowBlur = r * 0.8'));
  check('BatEnemy: procedural fallback art intact (scallop wings/wing bones/fangs)', baSrc.includes('lwGrad') && baSrc.includes('bodyGrad') && baSrc.includes('#ff1744'));
  check('BatEnemy: erratic jitter + attack fireAtPlayer(a, 240, 0.9) unchanged', baSrc.includes('s * dt * 0.7') && baSrc.includes('fireAtPlayer(a, 240, 0.9)'));
  check('config: ENEMY_TYPES.bat intact (color/speed/hp/damage/fireRate/pattern)',
    ENEMY_TYPES.bat && ENEMY_TYPES.bat.color === '#5d5d7a' && ENEMY_TYPES.bat.speed === 2.8 &&
    ENEMY_TYPES.bat.hp === 16 && ENEMY_TYPES.bat.damage === 8 && ENEMY_TYPES.bat.fireRate === 0.9 &&
    ENEMY_TYPES.bat.pattern === 'erratic',
    `got ${JSON.stringify(ENEMY_TYPES.bat)}`);
  check('AssetSprites: bat sprite dims 128×69 registered', /bat:\s*\{\s*w:\s*128,\s*h:\s*69\s*\}/.test(spritesSrc));
  check('AssetSprites: bat source 679×367 → 128×69', /bat: "Bat-pixel-art\.png \(679×367 → 128×69,/.test(spritesSrc));
}

}

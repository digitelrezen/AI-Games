// ═══════════════════════════════════════════════════════════
//  [6q] v3.64.0 DRAGON PIXEL-ART SPRITE — fire-breather now draws
//       the shared PNG (key "dragon", 256×256 → 128×128) with a
//       flight gait (sway/bob/tilt phase-locked to the horizontal
//       weave + wing-beat) + type-color accent glow + pulsing
//       fire-throat glow; procedural fallback retained
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const { ENEMY_TYPES, WAVE } = await mod('js/core/config.js');
const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');

export default async function run() {
console.log('\n[6q] v3.64.0 dragon pixel-art sprite');
{
  const deSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/DragonEnemy.js'), 'utf8');
  check('DragonEnemy: VERSION = v1.2.0', deSrc.includes("VERSION = 'v1.2.0'"));
  check('DragonEnemy: sprite key "dragon" via AssetManager', deSrc.includes("DRAGON_SPRITE_KEY = 'dragon'") && deSrc.includes('getSprite(DRAGON_SPRITE_KEY)'));
  check('DragonEnemy: null-sprite → procedural fallback branch', deSrc.includes('this._drawProcedural(ctx, r)'));
  check('DragonEnemy: flight gait phase-locked to the weave (t*0.8) + wing-beat (t*5)', deSrc.includes('const weave = Math.sin(this.t * 0.8)') && deSrc.includes('const flap = Math.sin(this.t * 5)'));
  check('DragonEnemy: aspect-preserving nearest-neighbor draw', deSrc.includes('(targetW * dims.h) / dims.w') && deSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('DragonEnemy: type-color accent glow pass', deSrc.includes('ctx.shadowColor = this.color') && deSrc.includes('ctx.shadowBlur = r * 0.8'));
  check('DragonEnemy: pulsing fire-throat glow while breathing', deSrc.includes('const fireGlow = 0.5 + 0.5 * Math.sin(this.t * 3)') && deSrc.includes('rgba(255, 110, 20, 0.8)'));
  check('DragonEnemy: procedural fallback art intact (wings/scales/tail)', deSrc.includes('lwGrad') && deSrc.includes('bodyGrad') && deSrc.includes('tailSway'));
  check('DragonEnemy: movement + attack unchanged (weave 200 / 5-shot cone 210)', deSrc.includes('Math.sin(this.t * 0.8) * 200') && deSrc.includes('fireAtPlayer(a + i * 0.14, 210, 0.7)'));
  check('config: ENEMY_TYPES.dragon intact (color/speed/hp/damage/fireRate/pattern)',
    ENEMY_TYPES.dragon && ENEMY_TYPES.dragon.color === '#d64545' && ENEMY_TYPES.dragon.speed === 1.6 &&
    ENEMY_TYPES.dragon.hp === 70 && ENEMY_TYPES.dragon.damage === 20 && ENEMY_TYPES.dragon.fireRate === 1.8 &&
    ENEMY_TYPES.dragon.pattern === 'breath',
    `got ${JSON.stringify(ENEMY_TYPES.dragon)}`);
  check('AssetSprites: dragon sprite dims 128×128 registered', /dragon:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(spritesSrc));
  check('AssetSprites: dragon source 256×256 → 128×128', /dragon: "Dragon-256x256\.png \(256×256 → 128×128,/.test(spritesSrc));
}

}

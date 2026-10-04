// ═══════════════════════════════════════════════════════════
//  [6g] v3.53.0 BEETLE PIXEL-ART SPRITE — armored tank now draws
//       the shared PNG (key "beetle") with charge-lunge pulse;
//       procedural fallback kept
// ═══════════════════════════════════════════════════════════

import { ROOT, check } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');

export default async function run() {
console.log('\n[6g] v3.53.0 beetle pixel-art sprite');
{
  const beSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/BeetleEnemy.js'), 'utf8');
  check('BeetleEnemy: VERSION = v1.2.0', beSrc.includes("VERSION = 'v1.2.0'"));
  check('BeetleEnemy: sprite key "beetle" via AssetManager', beSrc.includes("BEETLE_SPRITE_KEY = 'beetle'") && beSrc.includes('getSprite(BEETLE_SPRITE_KEY)'));
  check('BeetleEnemy: null-sprite → procedural fallback branch', beSrc.includes('this._drawProcedural(ctx, r)'));
  check('BeetleEnemy: charge-lunge pulse tracks the 2.4 s burst', beSrc.includes('_drawSprite(ctx, sprite, r)') && beSrc.includes('this.t % 2.4'));
  check('AssetSprites: beetle sprite dims 123×128 registered', /beetle:\s*\{\s*w:\s*123,\s*h:\s*128\s*\}/.test(spritesSrc));
}

}

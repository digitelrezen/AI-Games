// ═══════════════════════════════════════════════════════════
//  [6h] v3.54.0 BONEYARD PIXEL-ART ENVIRONMENT — the four shared
//       bone/skull/skeleton PNGs + BonusLevel draw delegation
//       (v3.60.0: the yard itself is fully destructible — [6m])
// ═══════════════════════════════════════════════════════════

import { ROOT, check } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const gameSrc = fs.readFileSync(path.join(ROOT, 'js/core/Game.js'), 'utf8');
const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');

export default async function run() {
console.log('\n[6h] v3.54.0 boneyard pixel-art environment');
{
  const blSrc = fs.readFileSync(path.join(ROOT, 'js/levels/BonusLevel.js'), 'utf8');
  check('BonusLevel: VERSION = v3.76.0', blSrc.includes("VERSION = 'v3.76.0'"));
  check('BonusLevel: draw(ctx) delegates to the active bonus', blSrc.includes('draw(ctx)') && blSrc.includes('this.currentBonus.draw(ctx)'));
  check('Game: bonus draw hook under the bonus targets', gameSrc.includes('this.bonus.draw(ctx)'));
  check('AssetSprites: skeleton dims 76×128 registered', /skeleton:\s*\{\s*w:\s*76,\s*h:\s*128\s*\}/.test(spritesSrc));
  check('AssetSprites: skull dims 104×128 registered', /skull:\s*\{\s*w:\s*104,\s*h:\s*128\s*\}/.test(spritesSrc));
  check('AssetSprites: femur dims 126×128 registered', /femur:\s*\{\s*w:\s*126,\s*h:\s*128\s*\}/.test(spritesSrc));
  check('AssetSprites: profile_bone dims 128×56 registered', /profile_bone:\s*\{\s*w:\s*128,\s*h:\s*56\s*\}/.test(spritesSrc));
}

}

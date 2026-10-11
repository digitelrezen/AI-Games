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
  check('AssetSprites: skeleton dims 85×128 registered', /skeleton:\s*\{\s*w:\s*85,\s*h:\s*128\s*\}/.test(spritesSrc));
  check('AssetSprites: skull dims 128×128 registered', /skull:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(spritesSrc));
  check('AssetSprites: femur dims 128×128 registered', /femur:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(spritesSrc));
  check('AssetSprites: profile_bone dims 128×128 registered', /profile_bone:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(spritesSrc));
  // v4.25.0: the boneyard house centerpiece draws the shared pixel-art
  // landmark — embedded at 256×256 (HOUSE_MAX_DIM import exception).
  check('AssetSprites: eridath_moms_house dims 256×256 registered (v4.25.0)', /eridath_moms_house:\s*\{\s*w:\s*256,\s*h:\s*256\s*\}/.test(spritesSrc));
}

}

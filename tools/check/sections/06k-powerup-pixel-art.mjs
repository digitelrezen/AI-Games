// ═══════════════════════════════════════════════════════════
//  [6k] v3.58.0 POWER-UP PIXEL ART — all five pill/poster drops
//       carry the shared PNG art (extralife/health/frenzy/shield/
//       wanted); mini routes to the "wanted" poster; the jewel
//       pass-order fix (icon blit after depth+shine) and the
//       deterministic sparkle field are verified here
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const { loadAssets, getSprite, getDims, POWERUP_ASSETS } = await mod('js/core/AssetManager.js');
const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');
const pwSrc = fs.readFileSync(path.join(ROOT, 'js/combat/PowerUp.js'), 'utf8');

export default async function run() {
console.log('\n[6k] v3.58.0 power-up pixel art (5 pill/poster assets)');
check('AssetSprites: extralife sprite dims 128×46 registered', /extralife:\s*\{\s*w:\s*128,\s*h:\s*46\s*\}/.test(spritesSrc));
check('AssetSprites: health sprite dims 128×50 registered', /health:\s*\{\s*w:\s*128,\s*h:\s*50\s*\}/.test(spritesSrc));
check('AssetSprites: frenzy sprite dims 128×41 registered', /frenzy:\s*\{\s*w:\s*128,\s*h:\s*41\s*\}/.test(spritesSrc));
check('AssetSprites: shield sprite dims 128×50 registered', /shield:\s*\{\s*w:\s*128,\s*h:\s*50\s*\}/.test(spritesSrc));
check('AssetSprites: wanted sprite dims 78×128 registered', /wanted:\s*\{\s*w:\s*78,\s*h:\s*128\s*\}/.test(spritesSrc));
check('AssetManager: POWERUP_ASSETS.mini === "wanted" (v3.58.0)', !!POWERUP_ASSETS && POWERUP_ASSETS.mini === 'wanted');
// v3.58.1 regression gate: the mini drop must draw the imported "wanted"
// pixel art (78×128) — v3.58.0 shipped with the mini case still blitting
// the old embedded 28×28 MiniPosterSprite.
check('PowerUp: mini drop draws the "wanted" pixel art (v3.58.1 fix)', pwSrc.includes("drawSpriteIcon(c, 'mini', JEWEL_BOX)"));
// v3.58.0 pass-order fix: the buffered icon blit (PASS 4) runs AFTER
// the source-atop DEPTH (PASS 1) + SHINE (PASS 2) passes.
{
  const blitIdx = pwSrc.indexOf('ctx.drawImage(buf.c, -JEWEL_BUF / 2, -JEWEL_BUF / 2)');
  const shineIdx = pwSrc.indexOf('PASS 2: SHINE');
  const baseIdx = pwSrc.indexOf('PASS 4: BASE');
  check('PowerUp: pass-order fix — icon blit (PASS 4) after depth+shine (PASS 1–2)',
    blitIdx !== -1 && shineIdx !== -1 && baseIdx !== -1 && shineIdx < baseIdx && baseIdx < blitIdx);
}
// v3.58.0: the sparkle field is deterministic (sin-hash seed, no per-instance state).
check('PowerUp: sparkle determinism (sparkleSeed sin-hash + per-type hash)',
  pwSrc.includes('function sparkleSeed(n)') &&
  pwSrc.includes('Math.sin(n * 127.1 + 311.7) * 43758.5453') &&
  pwSrc.includes('function sparkleTypeHash(type)'));

}

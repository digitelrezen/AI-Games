// ═══════════════════════════════════════════════════════════
//  [6b] v3.45.0 CLEAN CATSHIP — yellow shield bubble (ship-side
//       charge/shield rings removed) + HUDFireControl purple Nova
//       meter (charge/cooldown/ready) + one-shot shield-break burst
// ═══════════════════════════════════════════════════════════

import { ROOT, check } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
console.log('\n[6b] v3.45.0 clean catship (source gates)');
{
  const prSrc = fs.readFileSync(path.join(ROOT, 'js/player/PlayerRenderer.js'), 'utf8');
  check('PlayerRenderer: SHIELD_BUBBLE_RADIUS = 110 (v3.47.0: glow covers the 2x hull + minis)', /SHIELD_BUBBLE_RADIUS\s*=\s*110/.test(prSrc));
  check('PlayerRenderer: yellow shield GLOW (radial gradient, no hard rim) while shield > 0',
    prSrc.includes('if (p.shield > 0)') && prSrc.includes('createRadialGradient') && prSrc.includes('rgba(255, 213, 79'));
  check('PlayerRenderer: ship no longer reads superCharge (gold ring gone)',
    !prSrc.includes('p.superCharge'));
  const plSrc = fs.readFileSync(path.join(ROOT, 'js/player/Player.js'), 'utf8');
  check('Player: shield-break shatter burst (shield >0 → 0, one-shot)',
    plSrc.includes('const shieldBefore = this.shield') &&
    plSrc.includes('shieldBefore > 0 && this.shield <= 0') &&
    plSrc.includes('#ffd54f'));
  const hudSrc = fs.readFileSync(path.join(ROOT, 'js/ui/HUDFireControl.js'), 'utf8');
  check('HUDFireControl: Nova meter reads superCharge + ultimateCooldown',
    hudSrc.includes('p.superCharge') && hudSrc.includes('p.ultimateCooldown'));
  check('HUDFireControl: Nova meter states super-ready/-charging/-cooldown (v4.2.0: SUPER slot)',
    hudSrc.includes('super-ready') && hudSrc.includes('super-charging') && hudSrc.includes('super-cooldown'));
  check('HUDFireControl: old minis-based Nova ready flag (novaReady) removed',
    !hudSrc.includes('novaReady'));
}

}

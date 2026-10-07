// ═══════════════════════════════════════════════════════════
//  [6l] v3.59.0 DOUBLE-SIZED POWER-UP ICONS — every drop icon
//       (jewel box, buffer, aura, shimmer, sparkles, robot,
//       crate, fallbacks) and the pickup hitbox are 2× the
//       v3.58.x size
// ═══════════════════════════════════════════════════════════

import { ROOT, check } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const pwSrc = fs.readFileSync(path.join(ROOT, 'js/combat/PowerUp.js'), 'utf8');

export default async function run() {
console.log('\n[6l] v3.59.0 double-sized power-up icons');
check('PowerUp: JEWEL_BOX doubled 28 → 56', pwSrc.includes('const JEWEL_BOX = 56'));
check('PowerUp: JEWEL_BUF doubled 40 → 80', pwSrc.includes('const JEWEL_BUF = 80'));
check('PowerUp: pickup hitbox doubled (crate 36 / drop 28)', pwSrc.includes("this.radius = type === 'crate' ? 36 : 28"));
check('PowerUp: jewel aura radius doubled 22 → 44', pwSrc.includes('ctx.arc(0, 0, 44, 0, TAU)'));
check('PowerUp: shimmer perimeter radius doubled 13.5 → 27', pwSrc.includes('ctx.arc(0, 0, 27, a0, a0 + 1.1)'));
check('PowerUp: sparkle orbit doubled 10–18 → 20–36 px', pwSrc.includes('const orbit = 20 + 16 * h1'));
check('PowerUp: robot drop height doubled 28 → 56', pwSrc.includes('const h = 56'));
check('PowerUp: crate sprite box doubled 28 → 56', pwSrc.includes("drawSpriteIcon(ctx, 'crate', 56)"));
check('PowerUp: mini fallback poster doubled 28×28 → 56×56', pwSrc.includes('c.drawImage(poster, -28, -28, 56, 56)'));

}

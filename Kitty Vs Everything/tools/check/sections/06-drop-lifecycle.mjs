// ═══════════════════════════════════════════════════════════
//  [6] POWER-UP DROP LIFECYCLE — falls at vy=70, despawns below
//      the live viewport (game.H + 40)
// ═══════════════════════════════════════════════════════════

import { PowerUp, check, makeGame } from '../infra.mjs';

export default async function run() {
console.log('\n[6] Power-up drop lifecycle (headless)');
{
  const game = makeGame();
  const pw = new PowerUp({ x: 100, y: 0, type: 'frenzy', game });
  pw.update(1);
  check('drop falls 70px in 1s (vy=70)', Math.abs(pw.y - 70) < 1e-9, `got ${pw.y}`);
  check('drop still alive mid-screen', pw.alive === true);
  pw.update(12);
  check('drop despawns below viewport (y > H+40)', pw.alive === false && pw.y > game.H + 40, `y=${pw.y}`);
  const crate = new PowerUp({ x: 100, y: 0, type: 'crate', game });
  check('crate drop is destructible (hp 30)', crate.destructible === true && crate.hp === 30, `hp=${crate.hp}`);
}

}

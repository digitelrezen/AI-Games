// ═══════════════════════════════════════════════════════════
//  [6ab] v3.77.0 SHUTTLE WAVE EVENT — every destroyed Space
//        Shuttle (ENEMY_TYPES.shuttle, species #17: waves
//        17/36/55/...) releases a GUARANTEED mini-ship
//        power-up at the kill point (Combat.maybeDrop via
//        SHUTTLE_DROP in config.js), and the pickup routes
//        through Game.collectPowerUp → PlayerFleet.addMini
//        (+500 score fallback when the dock is full).
// ═══════════════════════════════════════════════════════════

import { ROOT, check, collect, makeGame, makePlayer, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
{
  console.log('\n[6ab] v3.77.0 shuttle wave event (source + headless lifecycle)');
  const { applyWeaponHit } = await mod('js/combat/Combat.js');
  const { default: ShuttleEnemy } = await mod('js/enemies/ShuttleEnemy.js');
  const { SHUTTLE_DROP, MINI_SHIP } = await mod('js/core/config.js');
  const combatSrc3 = fs.readFileSync(path.join(ROOT, 'js/combat/Combat.js'), 'utf8');
  const gameSrc4 = fs.readFileSync(path.join(ROOT, 'js/core/Game.js'), 'utf8');

  // ── Source gates ──
  check('config: SHUTTLE_DROP is the guaranteed mini-ship drop', SHUTTLE_DROP && SHUTTLE_DROP.type === 'mini', JSON.stringify(SHUTTLE_DROP));
  check('Combat: shuttle kills bypass the pool roll (SHUTTLE_DROP special case)',
    combatSrc3.includes("enemy.type === 'shuttle'") && combatSrc3.includes('SHUTTLE_DROP.type'));
  check('Combat: non-shuttle enemies still roll the shared pool', combatSrc3.includes('rollPowerUpDrop()'));
  check('Game: startCombatStage logs the shuttle wave event',
    gameSrc4.includes("currentSpecies === 'shuttle'") && gameSrc4.includes('SHUTTLE INTERCEPT'));

  // ── Headless lifecycle: shuttle defeated → mini drop → pickup ──
  const game = makeGame();
  game.powerups = [];
  const shuttle = new ShuttleEnemy({ type: 'shuttle', tier: 'mob', x: 100, y: 100, game, difficulty: 1 });
  // v3.82.0: the constructor owns the spawn point (off-screen right, fixed
  // flight altitude) — place the shuttle at the kill point for this test.
  shuttle.x = 100;
  shuttle.y = 100;
  shuttle.shield = 0;
  shuttle.hp = 1;
  const bullet = { damage: 10, weapon: 'vulkan', shieldMelt: 0, alive: true, owner: null };
  applyWeaponHit(game, shuttle, bullet);
  check('shuttle defeated by weapon hit', shuttle.alive === false);
  check('shuttle kill spawns exactly one power-up', game.powerups.length === 1, `got ${game.powerups.length}`);
  const drop = game.powerups[0];
  check('shuttle drop is a mini-ship at the kill point (100,100)',
    drop && drop.type === 'mini' && drop.x === 100 && drop.y === 100,
    drop ? `type=${drop.type} at (${drop.x},${drop.y})` : 'no drop');

  // Pickup with room in the dock: PlayerFleet.addMini docks a mini
  const p = makePlayer(game);
  const minisBefore = p.minis.length;
  collect(game, 'mini', p);
  check('mini pickup: PlayerFleet.addMini docks a mini', p.minis.length === minisBefore + 1, `got ${p.minis.length}`);

  // Pickup with a full dock: +500 score fallback
  while (p.minis.length < MINI_SHIP.maxDocked) p.addMini();
  game.score = 0;
  collect(game, 'mini', p);
  check('mini pickup with full dock: +500 score fallback', game.score === 500, `got ${game.score}`);
}

}

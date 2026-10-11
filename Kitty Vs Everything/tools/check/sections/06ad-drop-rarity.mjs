// ═══════════════════════════════════════════════════════════
//  [6ad] v3.86.0 DROP POLICY + SHIPS EVERY LEVEL —
//        (1) The shared POWERUP_DROPS pool is now coin-first:
//            coin 0.76 / health 0.07 / shield 0.06 / frenzy 0.05 /
//            mini 0.03 / crate 0.02 / robot 0.01 (v4.30.0: the
//            'life' pill left the pool — coin absorbed its 1%).
//            The weights sum to exactly 1.00, and the guaranteed
//            drops stay separate (SHUTTLE_DROP mini poster, ship
//            flyby robot).
//        (2) v3.83.0: every NORMAL drop source rolls DROP_POLICY
//            (config/drops.js, re-exported by config.js) through
//            js/core/DropManager.js — mob 0.08/max 1, asteroid
//            0.40/max 1, crate 1.00/max 2, boss 0.50/max 3, on-screen
//            sources only (isOnScreen gate). DROP_RARITY is gone.
//        (3) Ships every level: WaveManager.startNext starts the
//            Planet Express flyby egg UNCONDITIONALLY (the v3.42.0
//            bonus-adjacent skip is gone), and non-shuttle waves
//            weave SHUTTLES_PER_WAVE = 2 shuttle enemies into the
//            spawn queue.
//        (4) Ambient spawners (combat waves only): asteroids stream
//            in every 2–4s (spawnAsteroid, fully off-screen) and
//            score crates fall every 12–20s while the wave is
//            active; an inactive WaveManager spawns nothing.
//        (5) v4.30.0: EXTRA-LIFE TIMER — LIFE_DROP_TIMER (30 s /
//            10%) is the ONLY source of extra lives: Game.update
//            ticks DropManager.lifeDropTick() every frame, which
//            rolls once per interval and ejects a single 'life' pill
//            from the top of the screen. The score-bonus life
//            (checkScoreLives / LIFE_SCORE_INTERVAL) is GONE.
//        Headless lifecycle: startNext() → ship egg alive + 2
//            shuttles in the wave-1 queue; 30s of update() →
//            5–15 ambient asteroids and 1–2 ambient crates;
//            lifeDropTick() spawns at most one 'life' per 30 s.
// ═══════════════════════════════════════════════════════════

import { ROOT, check, makeGame, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
{
  console.log('\n[6ad] v3.83.0 drop policy + ships every level (source + headless lifecycle)');
  const { POWERUP_DROPS, DROP_POLICY, SHUTTLE_DROP } = await mod('js/core/config.js');
  const DropManager = await mod('js/core/DropManager.js');
  const { isOnScreen } = await mod('js/core/utils.js');
  const { default: WaveManager } = await mod('js/core/WaveManager.js');
  const dropsSrc = fs.readFileSync(path.join(ROOT, 'js/core/config/drops.js'), 'utf8');
  const cfgSrc = fs.readFileSync(path.join(ROOT, 'js/core/config.js'), 'utf8');
  const combatSrc = fs.readFileSync(path.join(ROOT, 'js/combat/Combat.js'), 'utf8');
  const waveSrc = fs.readFileSync(path.join(ROOT, 'js/core/WaveManager.js'), 'utf8');
  const gameSrc = fs.readFileSync(path.join(ROOT, 'js/core/Game.js'), 'utf8');

  // ── (1) rarity ladder ──
  const EXPECTED = { coin: 0.76, health: 0.07, shield: 0.06, frenzy: 0.05, mini: 0.03, crate: 0.02, robot: 0.01 };
  check('POWERUP_DROPS is the v4.30.0 coin-first pool (life pill removed — coin absorbed its 1%)',
    JSON.stringify(Object.keys(POWERUP_DROPS)) === JSON.stringify(Object.keys(EXPECTED)) &&
    Object.entries(EXPECTED).every(([k, w]) => Math.abs(POWERUP_DROPS[k] - w) < 1e-9),
    `got ${JSON.stringify(POWERUP_DROPS)}`);
  check('v4.30.0: the life pill is OUT of the shared pool (no kill can roll a life)', !('life' in POWERUP_DROPS), `got ${JSON.stringify(Object.keys(POWERUP_DROPS))}`);
  const total = Object.values(POWERUP_DROPS).reduce((a, b) => a + b, 0);
  check('POWERUP_DROPS weights sum to 1.00', Math.abs(total - 1) < 1e-9, `sum ${total}`);
  check('robot is super-rare at 0.01 (1%)', POWERUP_DROPS.robot === 0.01, `got ${POWERUP_DROPS.robot}`);
  check('SHUTTLE_DROP still guarantees the mini poster', SHUTTLE_DROP && SHUTTLE_DROP.type === 'mini', JSON.stringify(SHUTTLE_DROP));

  // ── (5) v4.30.0 extra-life timer (the ONLY source of extra lives) ──
  const { LIFE_DROP_TIMER } = await mod('js/core/config.js');
  check('LIFE_DROP_TIMER = 30 s interval / 10% chance (very low, no cap)',
    LIFE_DROP_TIMER && LIFE_DROP_TIMER.interval === 30 && Math.abs(LIFE_DROP_TIMER.chance - 0.10) < 1e-9,
    JSON.stringify(LIFE_DROP_TIMER));
  check('drops.js defines LIFE_DROP_TIMER', dropsSrc.includes('export const LIFE_DROP_TIMER'));
  check('config.js re-exports LIFE_DROP_TIMER from config/drops.js',
    cfgSrc.includes('LIFE_DROP_TIMER') && cfgSrc.includes("from './config/drops.js'"));
  check('DropManager exports lifeDropTick + resetLifeTimer',
    typeof DropManager.lifeDropTick === 'function' && typeof DropManager.resetLifeTimer === 'function');
  check('Game.js ticks the extra-life timer in the update loop', gameSrc.includes('lifeDropTick(this, dt)'));
  check('v4.30.0: the score-bonus life is GONE (no checkScoreLives, no LIFE_SCORE_INTERVAL, no nextLifeAt)',
    !gameSrc.includes('checkScoreLives') && !gameSrc.includes('LIFE_SCORE_INTERVAL') && !gameSrc.includes('nextLifeAt')
    && !fs.readFileSync(path.join(ROOT, 'js/core/game/Gameplay.js'), 'utf8').includes('checkScoreLives')
    && !fs.readFileSync(path.join(ROOT, 'js/core/config/stages.js'), 'utf8').includes('LIFE_SCORE_INTERVAL'));

  // ── (2) DROP_POLICY per-source drop gate (v3.83.0 — DROP_RARITY is gone) ──
  check('DROP_POLICY.mob = 8% / max 1 (regular enemy kill)', DROP_POLICY.mob.chance === 0.08 && DROP_POLICY.mob.maxDrops === 1, JSON.stringify(DROP_POLICY.mob));
  check('DROP_POLICY.asteroid = 40% / max 1 (destroyed small asteroid)', DROP_POLICY.asteroid.chance === 0.40 && DROP_POLICY.asteroid.maxDrops === 1, JSON.stringify(DROP_POLICY.asteroid));
  check('DROP_POLICY.crate = 100% / max 2 (crate spill)', DROP_POLICY.crate.chance === 1.0 && DROP_POLICY.crate.maxDrops === 2, JSON.stringify(DROP_POLICY.crate));
  check('DROP_POLICY.boss = 50% / max 3 (champion / miniboss / finalboss)', DROP_POLICY.boss.chance === 0.50 && DROP_POLICY.boss.maxDrops === 3, JSON.stringify(DROP_POLICY.boss));
  check('drops.js defines DROP_POLICY', dropsSrc.includes('export const DROP_POLICY'));
  check('drops.js no longer exports DROP_RARITY', !dropsSrc.includes('export const DROP_RARITY'));
  check('config.js re-exports DROP_POLICY from config/drops.js',
    cfgSrc.includes('DROP_POLICY') && cfgSrc.includes("from './config/drops.js'"));
  check('DropManager.js exports spawnSourceDrops / spawnGuaranteedDrop / spawnEventDrop / spawnDropAt',
    typeof DropManager.spawnSourceDrops === 'function' && typeof DropManager.spawnGuaranteedDrop === 'function' &&
    typeof DropManager.spawnEventDrop === 'function' && typeof DropManager.spawnDropAt === 'function');
  check('utils.js exports the on-screen kill gate (isOnScreen)', typeof isOnScreen === 'function');
  check('Combat.js routes kills through the DropManager (mob/boss + shuttle guaranteed)',
    combatSrc.includes("spawnSourceDrops(game, enemy.special ? 'boss' : 'mob'") && combatSrc.includes('spawnGuaranteedDrop(game, SHUTTLE_DROP.type'));

  // ── (3) ships every level (source) ──
  check('WaveManager.startNext starts the ship egg unconditionally',
    /startNext\(\)[\s\S]{0,700}?switchEgg\(this\.game, 'ship'\)/.test(waveSrc));
  check('v3.42.0 bonus-adjacent ship-egg skip is gone', !waveSrc.includes('this.wave % this.bonusEvery !== 0'));
  check('SHUTTLES_PER_WAVE = 2', waveSrc.includes('const SHUTTLES_PER_WAVE = 2'));
  check('non-shuttle waves weave shuttles into the spawn queue', waveSrc.includes("if (type !== 'shuttle')"));

  // ── (4) ambient spawners (source) ──
  check('ambient asteroid cadence 2–4s', waveSrc.includes('ASTEROID_AMBIENT_MIN = 2') && waveSrc.includes('ASTEROID_AMBIENT_MAX = 4'));
  check('ambient crate cadence 12–20s', waveSrc.includes('CRATE_AMBIENT_MIN = 12') && waveSrc.includes('CRATE_AMBIENT_MAX = 20'));
  check('ambient spawns are gated on this.active (combat waves only)',
    /if \(this\.active\) \{[\s\S]{0,500}?\basteroidTimer/.test(waveSrc));

  // ── headless lifecycle ──
  const game = makeGame();
  game.enemies = [{}]; // keep the wave active (no clear)
  game.powerups = [];
  game.eggs = { bender: null, ship: null };
  const wm = new WaveManager(game);
  wm.startNext(); // wave 1
  check('startNext activates the Planet Express flyby egg every level',
    !!game.eggs.ship && game.eggs.ship.alive === true,
    `eggs.ship=${JSON.stringify(game.eggs.ship && { alive: game.eggs.ship.alive })}`);
  const shuttles = wm.spawnQueue.filter((q) => q.type === 'shuttle').length;
  check('wave 1 (non-shuttle species) queue contains 2 shuttle enemies', shuttles === 2, `got ${shuttles}`);
  // ambient spawn loop: 30s of updates with the queue emptied (no enemy spawns)
  wm.spawnQueue.length = 0;
  const before = game.powerups.length;
  for (let t = 0; t < 30; t += 0.25) wm.update(0.25);
  const spawned = game.powerups.slice(before);
  const asteroids = spawned.filter((p) => p.type === 'asteroid' || p.isAsteroid).length;
  const crates = spawned.filter((p) => p.type === 'crate').length;
  check('ambient asteroids stream in during a combat wave (2–4s cadence → 5–15 in 30s)', asteroids >= 5 && asteroids <= 15, `got ${asteroids}`);
  check('ambient crates fall in occasionally (12–20s cadence → 1–2 in 30s)', crates >= 1 && crates <= 2, `got ${crates}`);
  // an inactive WaveManager spawns nothing
  const game2 = makeGame();
  game2.powerups = [];
  const wm2 = new WaveManager(game2);
  for (let t = 0; t < 30; t += 0.25) wm2.update(0.25);
  check('ambient spawners are off when the wave is inactive', game2.powerups.length === 0, `got ${game2.powerups.length}`);

  // ── v4.30.0 extra-life timer headless cadence ──
  const lifeGame = makeGame();
  lifeGame.powerups = [];
  DropManager.resetLifeTimer();
  // sub-interval ticks never roll: 29 s → zero life pills
  for (let t = 0; t < 29; t += 0.25) DropManager.lifeDropTick(lifeGame, 0.25);
  check('life timer: 29 s of ticks never rolls (no life pill)', lifeGame.powerups.length === 0, `got ${lifeGame.powerups.length}`);
  // 120 s → at most one roll per 30 s window → at most 4 life pills
  for (let t = 0; t < 120; t += 0.25) DropManager.lifeDropTick(lifeGame, 0.25);
  const lifePills = lifeGame.powerups.filter((p) => p.type === 'life');
  check('life timer: 120 s spawns at most 4 life pills (one roll per 30 s, 10% each)',
    lifePills.length >= 0 && lifePills.length <= 4, `got ${lifePills.length}`);
  if (lifePills.length > 0) {
    check('life timer: the ejected pill is a falling "life" drop above the screen',
      lifePills.every((p) => p.type === 'life' && p.y < 0), `got ${JSON.stringify(lifePills.map((p) => ({ type: p.type, y: p.y })))}`);
  }
  DropManager.resetLifeTimer();
}

}
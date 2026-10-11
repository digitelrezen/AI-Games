// Filename: DropManager.js
// Kitty Vs Everything — v4.30.0
// Single home for every loot drop in the game: on-screen gating,
// per-source chance + drop caps (DROP_POLICY in config/drops.js), the
// extra-life timer (LIFE_DROP_TIMER, v4.30.0), and the raw spawn
// primitive. Drop config (the POWERUP_DROPS pool, DROP_POLICY,
// SHUTTLE_DROP, LIFE_DROP_TIMER) stays in js/core/config/drops.js —
// this module only decides WHEN and WHERE a drop spawns.
//
// v4.30.0: EXTRA-LIFE TIMER — the 'life' pill left the shared pool and
// the score-bonus life was removed. Extra lives now come from ONE
// place: lifeDropTick() — every LIFE_DROP_TIMER.interval seconds (game
// time, active play only) it rolls LIFE_DROP_TIMER.chance to eject a
// single 'life' pill from the top of the screen. No cap, very low
// chance (~1 life per 5 minutes at 10%/30s).
//
// Normal sources (chance + cap, ON-SCREEN only — no off-screen clutter):
//   mob      — regular enemy kills              (Combat.onEnemyDeath)
//   asteroid — destroyed small asteroid         (AsteroidBonus.destroyAsteroid)
//   crate    — destructible crate spill         (Game.destroyCrate)
//   boss     — champion / miniboss / finalboss  (Combat.onEnemyDeath)
//
// Guaranteed special drops (bypass chance + cap — scripted set pieces):
//   shuttle        → SHUTTLE_DROP.type mini "Wanted" poster (Combat)
//   Planet Express → 'robot' (EasterEgg ship destruction)
//   Spaceballs One → one of EVERY pool type (SpaceballsOneLoot)
//
// Event drops (wave clear, Internet bonus): a single pool roll at a fixed
// off-screen spawn position — the player catches them as they fall, so
// they are intentionally NOT gated by on-screen bounds.
export const VERSION = 'v4.30.0';
import { DROP_POLICY, rollPowerUpDrop, LIFE_DROP_TIMER } from './config.js';
import { isOnScreen, rand } from './utils.js';
import PowerUp from '../combat/PowerUp.js';

/**
 * Raw spawn primitive — pushes a power-up at an exact position, no gating.
 * @param {Game} game
 * @param {number} x
 * @param {number} y
 * @param {string} type a POWERUP_DROPS key (or a guaranteed drop type)
 * @returns {PowerUp} the spawned drop
 */
export function spawnDropAt(game, x, y, type) {
  const d = new PowerUp({ x, y, type, game });
  game.powerups.push(d);
  return d;
}

/**
 * Source-gated drop: on-screen check → per-source chance roll → up to
 * maxDrops pool rolls (jittered so multi-drops don't overlap).
 * @param {Game} game
 * @param {string} source a DROP_POLICY key ('mob' | 'asteroid' | 'crate' | 'boss')
 * @param {number} x kill / destruction point
 * @param {number} y kill / destruction point
 * @param {number} [radius] source radius for the on-screen margin
 * @returns {PowerUp[]} the spawned drops (possibly empty)
 */
export function spawnSourceDrops(game, source, x, y, radius = 0) {
  const policy = DROP_POLICY[source];
  if (!policy) return [];
  // v3.83.0: loot only from on-screen sources — no off-screen clutter.
  if (!isOnScreen(game, x, y, radius)) return [];
  if (Math.random() > policy.chance) return [];
  const n = 1 + Math.floor(Math.random() * policy.maxDrops);
  const drops = [];
  for (let i = 0; i < n; i++) {
    const jx = n > 1 ? rand(-16, 16) : 0;
    const jy = n > 1 ? rand(-16, 16) : 0;
    drops.push(spawnDropAt(game, x + jx, y + jy, rollPowerUpDrop()));
  }
  return drops;
}

/**
 * Event drop: one shared-pool roll at a fixed (off-screen) spawn position.
 * Wave-clear and the Internet bonus use this — the player catches the drop
 * as it falls, so no on-screen gate here.
 * @returns {PowerUp} the spawned drop
 */
export function spawnEventDrop(game, x, y) {
  return spawnDropAt(game, x, y, rollPowerUpDrop());
}

/**
 * Guaranteed special-ship drop — bypasses chance and cap. Scripted
 * set-piece rewards (the shuttle's mini poster, the flyby's robot) are
 * never gated.
 * @returns {PowerUp} the spawned drop
 */
export function spawnGuaranteedDrop(game, type, x, y) {
  return spawnDropAt(game, x, y, type);
}

// ─── v4.30.0: EXTRA-LIFE TIMER (the ONLY source of extra lives) ───
// Module-level game-time accumulator: Game.update() calls lifeDropTick()
// every frame while a run is active (paused games never tick), so the
// timer naturally freezes on pause. Every LIFE_DROP_TIMER.interval
// seconds it rolls LIFE_DROP_TIMER.chance once — on a hit it ejects a
// single 'life' pill from the top of the screen (off-screen, falling —
// the player catches it as it drops). At most ONE life per interval,
// no cap on total lives.
let lifeTimer = 0;

/** Reset the extra-life timer (new run). */
export function resetLifeTimer() {
  lifeTimer = 0;
}

/**
 * Tick the extra-life timer.
 * @param {Game} game
 * @param {number} dt seconds
 * @returns {PowerUp|null} the spawned 'life' pill, or null
 */
export function lifeDropTick(game, dt) {
  lifeTimer += dt;
  if (lifeTimer < LIFE_DROP_TIMER.interval) return null;
  lifeTimer -= LIFE_DROP_TIMER.interval;
  if (Math.random() > LIFE_DROP_TIMER.chance) return null;
  const x = rand(60, Math.max(61, game.view.viewW - 60));
  return spawnDropAt(game, x, -40, 'life');
}
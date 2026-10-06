// Filename: config/drops.js
// Kitty Vs Everything — v3.83.0
// v3.83.0: DROP POLICY — DROP_RARITY is gone; every normal drop source now
// rolls DROP_POLICY (per-source chance + max drops per kill) through
// js/core/DropManager.js, which also enforces the on-screen gate (loot
// only from on-screen sources). Guaranteed special-ship drops (shuttle
// mini poster, flyby robot, Spaceballs One treasure chest) bypass it.
// v3.80.0: drop rarity overhaul — POWERUP_DROPS is now a rarity ladder
// (robot SUPER RARE 1%) + new DROP_RARITY per-source drop chances.
// E6 modularization (v3.77.0): power-up drop pool + asteroid chain +
// shuttle drop split out of js/core/config.js (now the compatibility
// re-export shim — the public surface is unchanged).

// ─── v3.11.0: ASTEROID BONUS (destructible chain — AsteroidBonus.js) ───
// A destructible chain power-up that lives in game.powerups. v3.22.0: the
// rock is the pixel-art asset from .assets/Asteroid pixel_art_small.png
// (sprite pipeline in AsteroidSprite.js). A Large asteroid shatters into
// 2 Medium fragments + 2 smaller Small shards, each Medium into 4 Small
// rocks, and every destroyed Small rolls a 40% chance to drop a regular
// power-up. Fragments are drawn from jagged shard sub-sprites of the rock.
// Destructible = shot down, never picked up.
export const ASTEROID = {
  chain: [
    { size: 46, hp: 120, splits: 2, smallShards: 2 }, // large  → 2 mediums + 2 small shards
    { size: 28, hp: 50,  splits: 4, smallShards: 0 }, // medium → 4 smalls
    { size: 15, hp: 14,  splits: 0, smallShards: 0 }, // small  → DROP_POLICY.asteroid drop roll
  ],
  // v3.83.0: the destroyed-small drop chance moved to DROP_POLICY.asteroid.
  drift: 40,              // base drift speed (px/s), random direction
  spawnY: -80,            // v3.42.0: wave-spawn Y — large rock (r=46) fully above the viewport
};

// ─── v3.42.0: SHARED POWER-UP DROP POOL (every drop source samples it) ───
// v3.80.0: NEW RARITY TABLE — the pool is now a rarity ladder: Health /
// Frenzy / Shields are COMMON, the Wanted (mini) poster + score crate are
// UNCOMMON, Extra Life is RARE, and the Bender 'robot' is SUPER RARE (1%).
// The robot's real home is the guaranteed ship sources: the Planet Express
// flyby drops it on destruction and every shuttle kill guarantees the mini
// poster (SHUTTLE_DROP below). Enemy kills (Combat.maybeDrop), wave-clear
// drops (WaveManager), asteroid shatter (AsteroidBonus), the Internet bonus
// (InternetBonus) and crate destruction (Game.destroyCrate) all roll this
// one table, so no source is ever missing a core drop. Asteroids are NOT in
// the pool: they spawn fully off-screen from the wave spawner only
// (ASTEROID.spawnY).
export const POWERUP_DROPS = {
  health: 0.30,  // COMMON — hull repair (PLAYER.HEALTH_RESTORE)
  frenzy: 0.20,  // COMMON — 30s all-cooldowns-off
  shield: 0.22,  // COMMON — shield restore
  mini:   0.14,  // UNCOMMON — "Wanted" poster → mini-ship
  crate:  0.07,  // UNCOMMON — score crate (destructible — drops again)
  life:   0.06,  // RARE — extra life
  robot:  0.01,  // SUPER RARE — Bender easter egg
};

/** v3.42.0: weighted roll over POWERUP_DROPS (weights sum to 1). */

export function rollPowerUpDrop() {
  let r = Math.random();
  for (const [type, w] of Object.entries(POWERUP_DROPS)) {
    if (r < w) return type;
    r -= w;
  }
  return 'crate';
}

// v3.83.0: DROP POLICY — the chance + max drops per kill for every NORMAL
// (non-guaranteed) drop source. Every source rolls through
// js/core/DropManager.js, which also enforces the on-screen gate (loot
// only from on-screen sources — no off-screen clutter):
//   mob      — regular enemy kills (Combat.onEnemyDeath)      8%  / max 1
//   asteroid — destroyed small asteroid (AsteroidBonus)      40%  / max 1
//   crate    — destructible crate spill (Game.destroyCrate) 100%  / max 2
//   boss     — champion / miniboss / finalboss kills         50%  / max 3
// Guaranteed special-ship drops (the shuttle's mini poster, the flyby's
// robot, the Spaceballs One treasure chest) bypass this table — they're
// scripted set-piece rewards, not pool rolls.
export const DROP_POLICY = {
  mob:      { chance: 0.08, maxDrops: 1 },
  asteroid: { chance: 0.40, maxDrops: 1 },
  crate:    { chance: 1.00, maxDrops: 2 },
  boss:     { chance: 0.50, maxDrops: 3 },
};

// v3.77.0: SHUTTLE WAVE EVENT — the Space Shuttle is the wave's "event"
// species (ENEMY_TYPES.shuttle, species #17: waves 17/36/55/...). Every
// destroyed shuttle releases its "Wanted" poster: a GUARANTEED mini-ship
// power-up at the kill point (Combat.maybeDrop). This bypasses the shared
// POWERUP_DROPS roll for the shuttle species only — all other enemies keep
// the weighted pool above.
export const SHUTTLE_DROP = { type: 'mini' };

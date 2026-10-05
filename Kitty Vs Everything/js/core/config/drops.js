// Filename: config/drops.js
// Kitty Vs Everything — v3.77.0
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
    { size: 15, hp: 14,  splits: 0, smallShards: 0 }, // small  → power-up drop roll
  ],
  dropChance: 0.4,        // destroyed small → regular power-up drop
  drift: 40,              // base drift speed (px/s), random direction
  spawnY: -80,            // v3.42.0: wave-spawn Y — large rock (r=46) fully above the viewport
};

// ─── v3.42.0: SHARED POWER-UP DROP POOL (every drop source samples it) ───
// The five core drops — Health, Frenzy, Shields, Wanted (the mini "Adopt
// Me!" poster), Extra Life — plus the rare Bender (robot) and the score
// crate. Enemy kills (Combat.maybeDrop), wave-clear drops (WaveManager),
// asteroid shatter (AsteroidBonus), the Internet bonus (InternetBonus) and
// crate destruction (Game.destroyCrate) all roll this one table, so no
// source is ever missing a core drop. Asteroids are NOT in the pool: they
// spawn fully off-screen from the wave spawner only (ASTEROID.spawnY).
export const POWERUP_DROPS = {
  health: 0.12,  // hull repair (PLAYER.HEALTH_RESTORE)
  frenzy: 0.08,  // 30s all-cooldowns-off
  shield: 0.16,  // shield restore
  mini:   0.10,  // "Wanted" poster → mini-ship
  life:   0.08,  // extra life
  robot:  0.04,  // Bender easter egg
  crate:  0.42,  // score crate (destructible — drops again)
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

// v3.77.0: SHUTTLE WAVE EVENT — the Space Shuttle is the wave's "event"
// species (ENEMY_TYPES.shuttle, species #17: waves 17/36/55/...). Every
// destroyed shuttle releases its "Wanted" poster: a GUARANTEED mini-ship
// power-up at the kill point (Combat.maybeDrop). This bypasses the shared
// POWERUP_DROPS roll for the shuttle species only — all other enemies keep
// the weighted pool above.
export const SHUTTLE_DROP = { type: 'mini' };

// Filename: config/hazards.js
// Kitty Vs Everything — v3.97.0
// HAZARDS — independent, NON-LOOTABLE, shootable environmental obstacles.
// Spawned by js/hazards/HazardManager.js on its own spawner (fully separate
// from the WaveManager enemy waves, power-up drops and easter eggs): each
// hazard drifts in from a random edge (top / bottom / side / diagonal
// vector) along a fixed heading until it is shot down by the player or
// drifts completely off-screen. Destruction — by player fire, by
// proximity-fuse trigger, or by direct contact — detonates a per-type
// explosion (the `explosion` profiles below) and drops ZERO loot: the
// js/hazards/ modules never touch the DropManager.
//
// Phase 2 parameter standardization: these are the single tuning surface
// for hazards. The js/hazards/ modules read these stats and must NOT
// hardcode or override their own.
//   speed    drift speed in px/s (fixed heading — hazards never steer)
//   hp       base health (player bullets pop them early)
//   radius   hitbox radius (world px)
//   score    points for SHOOTING it down (drift-outs score nothing)
//   proximityFuse  optional armed trigger radius (px) — detonates before
//                  contact when the player closes in (Prox Mine)
//   explosion.kind    bio | fire | ash | cluster | magnet | nuke | prox
//   explosion.radius  blast radius (px) — AoE damage to every player inside
//   explosion.damage  blast damage per player hit
//   explosion.shake   screen shake on detonation
//   explosion.pool    optional lingering damage pool (bio-splatter / fire /
//                     ash) — { radius, life, dps, color }
//   explosion.subs    cluster: number of sub-bursts around the center
//   explosion.clearBullets  magnet: enemy-bullet clear radius (px)
//   explosion.flash   nuke: full-screen white flash duration (s)
export const HAZARD_TYPES = {
  biobarrel:      { name: 'Bio Barrel',      color: '#76ff03', speed: 62, hp: 24, radius: 20, score: 150,
                    explosion: { kind: 'bio',     radius: 110, damage: 18, shake: 6,  pool: { radius: 84,  life: 4.5, dps: 10, color: '#64dd17' } } },
  biobomb:        { name: 'Bio Bomb',        color: '#69f0ae', speed: 78, hp: 34, radius: 22, score: 200,
                    explosion: { kind: 'bio',     radius: 130, damage: 22, shake: 8,  pool: { radius: 100, life: 5,   dps: 12, color: '#00e676' } } },
  clusterbomb:    { name: 'Cluster Bomb',    color: '#ffd740', speed: 84, hp: 30, radius: 20, score: 200,
                    explosion: { kind: 'cluster', radius: 90,  damage: 14, shake: 7,  subs: 5 } },
  depletedshell:  { name: 'Depleted Shell',  color: '#9e9e9e', speed: 54, hp: 44, radius: 24, score: 250,
                    explosion: { kind: 'ash',     radius: 120, damage: 20, shake: 7,  pool: { radius: 96,  life: 7,   dps: 8,  color: '#757575' } } },
  firebarrel:     { name: 'Fire Barrel',     color: '#ff9800', speed: 72, hp: 26, radius: 20, score: 150,
                    explosion: { kind: 'fire',    radius: 120, damage: 20, shake: 7,  pool: { radius: 92,  life: 5,   dps: 12, color: '#ff7043' } } },
  firemine:       { name: 'Fire Mine',       color: '#ff5722', speed: 60, hp: 20, radius: 18, score: 150,
                    explosion: { kind: 'fire',    radius: 100, damage: 18, shake: 6,  pool: { radius: 76,  life: 4,   dps: 10, color: '#ff8a65' } } },
  magnetmine:     { name: 'Magnet Mine',     color: '#40c4ff', speed: 68, hp: 28, radius: 20, score: 200,
                    explosion: { kind: 'magnet',  radius: 110, damage: 20, shake: 8,  clearBullets: 190 } },
  nuke:           { name: 'Nuke',            color: '#ff1744', speed: 48, hp: 60, radius: 26, score: 400,
                    explosion: { kind: 'nuke',    radius: 240, damage: 40, shake: 16, flash: 0.5 } },
  nukebarrel:     { name: 'Nuke Barrel',     color: '#d50000', speed: 60, hp: 48, radius: 24, score: 300,
                    explosion: { kind: 'nuke',    radius: 170, damage: 30, shake: 12, flash: 0.3 } },
  proxmine:       { name: 'Prox Mine',       color: '#ff4081', speed: 88, hp: 18, radius: 18, score: 150,
                    proximityFuse: 64,
                    explosion: { kind: 'prox',    radius: 95,  damage: 26, shake: 9 } },
};

// ─── v3.97.0: hazard spawner cadence (combat levels only) ───
// The HazardManager spawns on its own timer, independent of the enemy
// waves: one hazard every SPAWN_MIN–SPAWN_MAX seconds, capped at
// MAX_CONCURRENT on screen. Each spawn picks a random edge (top / right /
// bottom / left) fully off-screen past EDGE_MARGIN and a random heading
// into the playfield, so hazards enter from ANY direction (including
// diagonals) and drift straight across until shot or gone.
export const HAZARD = {
  SPAWN_MIN: 3.5,
  SPAWN_MAX: 7.0,
  MAX_CONCURRENT: 3,
  EDGE_MARGIN: 40,
  // Weighted spawn table (sums to 100): common barrels/mines, rarer big
  // nukes. rollHazardType() samples it.
  WEIGHTS: {
    biobarrel: 14,
    biobomb: 10,
    clusterbomb: 10,
    depletedshell: 8,
    firebarrel: 14,
    firemine: 12,
    magnetmine: 8,
    nuke: 4,
    nukebarrel: 8,
    proxmine: 12,
  },
};

/** Weighted roll over HAZARD.WEIGHTS → a HAZARD_TYPES key. */
export function rollHazardType() {
  const entries = Object.entries(HAZARD.WEIGHTS);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [type, w] of entries) {
    if (r < w) return type;
    r -= w;
  }
  return entries[entries.length - 1][0];
}
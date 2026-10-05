// Filename: config/enemies.js
// Kitty Vs Everything — v3.77.0
// E6 modularization (v3.77.0): enemy roster, score tiers and wave system
// split out of js/core/config.js (now the compatibility re-export shim —
// the public surface is unchanged).

// Enemy roster — the single tuning surface for every enemy species.
// v3.75.0 (Phase 2 parameter standardization): every behavior module in
// js/enemies/ reads these stats through EnemyBase (this.speed / this.hp /
// this.damage / this.fireRate / this.score) and must NOT hardcode its own.
//   speed    base movement speed (× tier speedMul × 60 in EnemyBase)
//   hp       base health (× tier hpMul × wave difficulty)
//   damage   per-hit damage (× tier dmgMul × wave difficulty)
//   fireRate seconds between shots (EnemyBase jitters it 0.8–1.2×)
//   score    per-kill value comes from TIERS below (tier, not species)
//   pattern  AI movement style label (documented per species in js/enemies/)
export const ENEMY_TYPES = {
  wasp:     { name: 'Wasp',         color: '#e8b62c', speed: 2.2, hp: 20, damage: 8,  fireRate: 0.9, pattern: 'weave' },
  beetle:   { name: 'Beetle',       color: '#7a4a21', speed: 1.4, hp: 40, damage: 12, fireRate: 1.4, pattern: 'charge' },
  butterfly:{ name: 'Butterfly',    color: '#c77dff', speed: 2.6, hp: 14, damage: 6,  fireRate: 1.1, pattern: 'flutter' },
  wasp2:    { name: 'Wasp2',        color: '#c8ff3d', speed: 2.9, hp: 16, damage: 9,  fireRate: 0.7, pattern: 'track' },
  rat:      { name: 'Rat',          color: '#8d8d8d', speed: 3.0, hp: 18, damage: 10, fireRate: 0.8, pattern: 'dash' },
  wolf:     { name: 'Wolf',         color: '#9aa5b1', speed: 2.4, hp: 34, damage: 14, fireRate: 1.2, pattern: 'pack' },
  falcon:   { name: 'Falcon',       color: '#b0713a', speed: 3.2, hp: 22, damage: 12, fireRate: 1.0, pattern: 'dive' },
  bat:      { name: 'Bat',          color: '#5d5d7a', speed: 2.8, hp: 16, damage: 8,  fireRate: 0.9, pattern: 'erratic' },
  blackcat: { name: 'Black Cat',    color: '#2b2b3a', speed: 2.0, hp: 28, damage: 16, fireRate: 1.3, pattern: 'teleport' },
  lizard:   { name: 'Lizard',       color: '#4caf50', speed: 1.2, hp: 44, damage: 10, fireRate: 1.5, pattern: 'spit' },
  dragon:   { name: 'Dragon',       color: '#d64545', speed: 1.6, hp: 70, damage: 20, fireRate: 1.8, pattern: 'breath' },
  human:    { name: 'Human',        color: '#3d6fb4', speed: 2.2, hp: 50, damage: 14, fireRate: 1.0, pattern: 'strafe' },
  alien:    { name: 'Alien Ship',   color: '#7b2ff7', speed: 2.5, hp: 46, damage: 16, fireRate: 1.2, pattern: 'phase' },
  snake:    { name: 'Snake',        color: '#66bb6a', speed: 2.0, hp: 30, damage: 12, fireRate: 1.1, pattern: 'sine' },
  spider:   { name: 'Spider',       color: '#4a4a4a', speed: 1.8, hp: 38, damage: 10, fireRate: 0.9, pattern: 'web' },
  pinkcat:  { name: 'Pink Cat',     color: '#ff69b4', speed: 1.8, hp: 60, damage: 18, fireRate: 1.2, pattern: 'fierce' },
  shuttle:  { name: 'Space Shuttle', color: '#cfd8dc', speed: 2.0, hp: 60, damage: 16, fireRate: 1.4, pattern: 'glide' },
  moth:     { name: 'Moth',           color: '#d8c8a0', speed: 2.4, hp: 16, damage: 8,  fireRate: 1.0, pattern: 'erratic' },
  squirrel: { name: 'Squirrel',       color: '#a5622d', speed: 3.4, hp: 12, damage: 7,  fireRate: 0.7, pattern: 'scurry' },
};

export const TIERS = {
  mob:       { label: 'Trash Mob',  hpMul: 1,   dmgMul: 1,   speedMul: 1,    score: 100,   shield: 0,   size: 1,    special: false },
  champion:  { label: 'Champion',   hpMul: 3,   dmgMul: 1.5, speedMul: 1.1,  score: 350,   shield: 20,  size: 1.35, special: false },
  miniboss:  { label: 'Mini-Boss',  hpMul: 8,   dmgMul: 2,   speedMul: 1.0,  score: 1000,  shield: 80,  size: 1.8,  special: true },
  boss:      { label: 'Boss',       hpMul: 20,  dmgMul: 2.5, speedMul: 0.9,  score: 3000,  shield: 250, size: 2.6,  special: true },
  finalboss: { label: 'Final Boss', hpMul: 45,  dmgMul: 3,   speedMul: 0.85, score: 10000, shield: 600, size: 3.4,  special: true },
};

// ─── v3.30.0: 16-species sequential wave system ───
// v3.50.0: roster grew to 17 species (shuttle) — SPECIES_COUNT tracks it.
// v3.52.0: roster grew to 18 species (moth).
// v3.67.0: roster grew to 19 species (squirrel).
// One species per wave (wraps after 19, order = ENEMY_TYPES insertion order).
// Active enemy count sawtooth-ramps COUNT_MIN→COUNT_MAX over COUNT_RAMP_WAVES
// then resets. Wave difficulty scales enemy HP + damage only, +DIFF_PER_WAVE
// per wave, capped after DIFF_CAP_CYCLES full species cycles (hard cap
// DIFF_CAP). Each wave spawns 1 boss of the active species (finalboss every
// 10 waves) + lower-tier same-species fill (TIER_MIX). spawnOverride > 0
// (dev-panel slider / `count <n>` debug command) pins the active count.
export const WAVE = {
  SPECIES_COUNT: 19,
  COUNT_MIN: 20,
  COUNT_MAX: 300,
  COUNT_RAMP_WAVES: 12,
  DIFF_PER_WAVE: 0.06,
  DIFF_CAP_CYCLES: 2,
  DIFF_CAP: 3.0,
  TIER_MIX: { mob: 0.82, champion: 0.12, miniboss: 0.06 },
  SPAWN_DELAY_MIN: 0.35,
  SPAWN_DELAY_MAX: 1.1,
  BOSS_DELAY: 2.5,
};

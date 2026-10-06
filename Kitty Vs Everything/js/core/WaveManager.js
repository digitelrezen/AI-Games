// Filename: WaveManager.js
// Kitty Vs Everything — v3.76.0
// v3.76.0 (LevelRegistry refactor): the WaveManager no longer decides what
//          follows a cleared wave. onWaveCleared() now just signals
//          completion (this.cleared + isComplete()); Game.advanceStage()
//          consumes the LevelRegistry manifest and either starts the next
//          combat wave or a bonus round. bonusEvery is still synced by
//          Game from the registry (drives the ship-egg skip cadence).
// 16-species sequential wave system: one species per wave (wraps after 16),
// active enemy count sawtooth-ramps 20→300 over 12 waves then resets, and
// wave difficulty scales enemy HP + damage (capped after two full species
// cycles). Each wave spawns 1 boss of the active species (finalboss every
// 10 waves) plus lower-tier same-species fill (mob/champion/miniboss).
// NOW USES EnemyFactory.createEnemy() — no direct Enemy.js import.
// v3.13.0: Spawn / wave-clear drop X ranges use the LIVE viewport width.
// v3.33.0: wave-clear drop table gained the hull-repair (health) and
//          FRENZY drops (tools/asset-manifest.json PNG art, v3.33.0).
// v3.42.0: wave-clear drops roll the shared POWERUP_DROPS pool; the 15%
//          asteroid spawns fully off-screen (ASTEROID.spawnY); the Planet
//          Express ship flyby auto-triggers at the start of most waves
//          (all but every 4th — the bonus-adjacent ones).
// v3.80.0: SHIPS EVERY LEVEL + DROP RARITY — the flyby now enters/exits
//          during EVERY level (the bonus-adjacent skip is gone),
//          SHUTTLES_PER_WAVE Space Shuttle enemies are woven into every
//          combat wave's spawn queue, asteroids stream in constantly
//          (asteroidTimer, 2–4s) and score crates fall in occasionally
//          (crateTimer, 12–20s) — all ambient spawns fully off-screen.
// v3.81.0: SPACEBALLS ONE — maybeSpawnSpaceballs(game) runs the rare
//          per-wave roll at the top of startNext (SPACEBALLS_ONE.spawnChance,
//          capped at SPACEBALLS_ONE.maxPerRun per mission via the
//          EasterEgg manager counter).
// v3.83.0: WAVE-CLEAR DROP — the wave-clear power-up now routes through
//          the DropManager (spawnEventDrop: one shared-pool roll at the
//          fixed off-screen spawn position, caught as it falls).
export const VERSION = 'v3.83.0';
import { ENEMY_TYPES, WAVE, ASTEROID } from './config.js';
import { createEnemy } from '../enemies/EnemyFactory.js';
import PowerUp from '../combat/PowerUp.js'; // v3.83.0: ambient crate spawner only
import { spawnEventDrop } from './DropManager.js'; // v3.83.0: wave-clear drop
import { spawnAsteroid } from '../levels/AsteroidBonus.js'; // v3.11.0: asteroid chain drops
import { switchEgg, maybeSpawnSpaceballs } from './EasterEgg.js'; // v3.42.0: ship flyby in most levels
import { rand } from './utils.js';
import { bus } from './EventBus.js';
import { audio } from './AudioSystem.js';

// v3.80.0: SHIPS EVERY LEVEL — Space Shuttle enemies woven into every
// combat wave (shuttle species waves are already all shuttles).
const SHUTTLES_PER_WAVE = 2;
// v3.80.0: ambient spawner cadence (combat waves only, off-screen spawns).
const ASTEROID_AMBIENT_MIN = 2, ASTEROID_AMBIENT_MAX = 4;   // asteroids: constant
const CRATE_AMBIENT_MIN = 12, CRATE_AMBIENT_MAX = 20;       // crates: occasional

export default class WaveManager {
  constructor(game) {
    this.game = game;
    this.wave = 0;
    this.active = false;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.clearedTimer = 0;
    this.bonusEvery = 4; // v3.76.0: synced by Game from LevelRegistry.bonusInterval
    this.cleared = false; // v3.76.0: wave-clear signal for the LevelRegistry
    // ─── v3.30.0: 16-species sequential wave system ───
    this.species = Object.keys(ENEMY_TYPES); // insertion order = species order
    this.speciesIndex = 0;
    this.currentSpecies = this.species[0];
    this.spawnOverride = 0; // 0 = AUTO (sawtooth ramp); >0 = fixed active count
    // ─── v3.80.0: ambient spawners (reset per wave in startNext) ───
    this.asteroidTimer = 0; // asteroids stream in constantly (off-screen)
    this.crateTimer = 0;    // score crates fall in occasionally (off-screen)
  }

  reset() {
    this.wave = 0;
    this.active = false;
    this.cleared = false; // v3.76.0
    this.spawnQueue = [];
    this.clearedTimer = 0;
    this.speciesIndex = 0;
    this.currentSpecies = this.species[0];
    this.asteroidTimer = 0; // v3.80.0
    this.crateTimer = 0;    // v3.80.0
    // NOTE: spawnOverride intentionally preserved across resets (dev tooling).
  }

  /** v3.30.0: wave difficulty multiplier — scales enemy HP + damage only. */
  get difficulty() {
    const waves = Math.max(0, this.wave);
    const capWaves = WAVE.SPECIES_COUNT * WAVE.DIFF_CAP_CYCLES; // 38 (two full 19-species cycles, v3.67.0)
    return Math.min(1 + Math.min(waves, capWaves) * WAVE.DIFF_PER_WAVE, WAVE.DIFF_CAP);
  }

  /** v3.30.0: target active-enemy count for the current wave (sawtooth ramp). */
  getWaveCount() {
    if (this.spawnOverride > 0) return this.spawnOverride;
    const w = Math.max(1, this.wave); // avoid negative modulo at wave 0
    const span = WAVE.COUNT_RAMP_WAVES - 1;
    const t = ((w - 1) % WAVE.COUNT_RAMP_WAVES) / span; // 0..1
    return Math.round(WAVE.COUNT_MIN + t * (WAVE.COUNT_MAX - WAVE.COUNT_MIN));
  }

  /** v3.30.0: pick a lower-tier fill tier from WAVE.TIER_MIX (mob/champion/miniboss). */
  pickFillTier() {
    const mix = WAVE.TIER_MIX;
    const r = Math.random();
    if (r < mix.mob) return 'mob';
    if (r < mix.mob + mix.champion) return 'champion';
    return 'miniboss';
  }

  startNext() {
    this.wave++;
    this.cleared = false; // v3.76.0: a new wave is not "cleared"
    this.clearedTimer = 0;
    // v3.30.0: advance to the next species (one per wave, wraps after 16).
    // Wave 1 = first species, wave 16 = last, wave 17 wraps to first again.
    this.speciesIndex = (this.wave - 1) % this.species.length;
    this.currentSpecies = this.species[this.speciesIndex];
    this.buildQueue();
    this.active = true;
    // v3.80.0: SHIPS EVERY LEVEL — the Planet Express flyby enters and
    // exits during EVERY level (v3.42.0's bonus-adjacent skip is gone;
    // bonus rounds stay ship-free because the egg only starts here).
    switchEgg(this.game, 'ship');
    // v3.81.0: SPACEBALLS ONE — rare roll at the start of every combat
    // wave (SPACEBALLS_ONE.spawnChance, capped per mission).
    maybeSpawnSpaceballs(this.game);
    // v3.80.0: reset the ambient spawners for the new combat wave.
    this.asteroidTimer = rand(ASTEROID_AMBIENT_MIN, ASTEROID_AMBIENT_MAX);
    this.crateTimer = rand(CRATE_AMBIENT_MIN, CRATE_AMBIENT_MAX);
    const isFinal = this.wave % 10 === 0;
    bus.emit('banner', {
      text: isFinal ? `WAVE ${this.wave} — FINAL BOSS INBOUND` : `WAVE ${this.wave}`,
      tone: isFinal ? 'bad' : 'good', duration: 2,
    });
    audio.banner();
  }

  buildQueue() {
    const q = [];
    const type = this.currentSpecies;
    const count = Math.max(1, this.getWaveCount());
    // v3.30.0: lower-tier same-species fill (mob/champion/miniboss).
    for (let i = 0; i < count - 1; i++) {
      q.push({ type, tier: this.pickFillTier(), delay: rand(WAVE.SPAWN_DELAY_MIN, WAVE.SPAWN_DELAY_MAX) });
    }
    // v3.30.0: 1 boss of the active species arrives last (finalboss every 10 waves).
    const bossTier = (this.wave % 10 === 0) ? 'finalboss' : 'boss';
    q.push({ type, tier: bossTier, delay: WAVE.BOSS_DELAY });
    // v3.80.0: SHIPS EVERY LEVEL — weave SHUTTLES_PER_WAVE Space Shuttle
    // enemies into the queue at even intervals (shuttle species waves are
    // already all shuttles, so they're left untouched). Every destroyed
    // shuttle guarantees its mini-ship "Wanted" poster (SHUTTLE_DROP).
    if (type !== 'shuttle') {
      const step = Math.max(1, Math.floor(q.length / (SHUTTLES_PER_WAVE + 1)));
      for (let sIdx = 0; sIdx < SHUTTLES_PER_WAVE; sIdx++) {
        const idx = Math.min(q.length - 1, step * (sIdx + 1));
        q.splice(idx, 0, { type: 'shuttle', tier: 'mob', delay: rand(WAVE.SPAWN_DELAY_MIN, WAVE.SPAWN_DELAY_MAX) });
      }
    }
    this.spawnQueue = q;
    this.spawnTimer = 1;
  }

  spawn(s) {
    const x = rand(120, this.game.viewW - 120); // v3.13.0: live viewport
    this.game.enemies.push(createEnemy({ type: s.type, tier: s.tier, x, y: -50, game: this.game, difficulty: this.difficulty }));
  }

  update(dt) {
    if (!this.active) return;
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const s = this.spawnQueue.shift();
        this.spawn(s);
        this.spawnTimer = s.delay;
      }
    } else if (this.game.enemies.length === 0) {
      this.clearedTimer += dt;
      if (this.clearedTimer > 1.2) {
        this.clearedTimer = 0;
        this.active = false;
        this.onWaveCleared();
      }
    }
    // v3.80.0: ambient spawners (combat waves only — bonus rounds deactivate
    // the WaveManager, so these pause between levels). Asteroids stream in
    // constantly, fully off-screen; score crates fall in occasionally.
    if (this.active) {
      this.asteroidTimer -= dt;
      if (this.asteroidTimer <= 0) {
        this.asteroidTimer = rand(ASTEROID_AMBIENT_MIN, ASTEROID_AMBIENT_MAX);
        spawnAsteroid(this.game, rand(80, this.game.viewW - 80), ASTEROID.spawnY);
      }
      this.crateTimer -= dt;
      if (this.crateTimer <= 0) {
        this.crateTimer = rand(CRATE_AMBIENT_MIN, CRATE_AMBIENT_MAX);
        this.game.powerups.push(new PowerUp({ x: rand(80, this.game.viewW - 80), y: -30, type: 'crate', game: this.game }));
      }
    }
  }

  onWaveCleared() {
    // v3.42.0: wave-clear drop — 15% asteroid (spawns fully off-screen at
    // ASTEROID.spawnY), otherwise one roll from the shared POWERUP_DROPS
    // pool (Health / Frenzy / Shields / Wanted / Extra Life / robot / crate).
    const x = rand(200, this.game.viewW - 200); // v3.13.0: live viewport
    if (Math.random() < 0.15) {
      spawnAsteroid(this.game, x, ASTEROID.spawnY); // v3.42.0: off-screen wave spawn
    } else {
      spawnEventDrop(this.game, x, -30); // v3.83.0: event drop via DropManager
    }
    // v3.76.0: the WaveManager no longer picks the next stage — it signals
    // completion and Game.advanceStage() consults the LevelRegistry manifest
    // (combat wave or bonus round).
    this.cleared = true;
  }

  /** v3.76.0: uniform stage interface — true once the wave is fully cleared. */
  isComplete() {
    return this.cleared;
  }
}
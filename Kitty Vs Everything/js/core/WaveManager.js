// Filename: WaveManager.js
// Kitty Vs Everything — v3.30.0
// 16-species sequential wave system: one species per wave (wraps after 16),
// active enemy count sawtooth-ramps 20→300 over 12 waves then resets, and
// wave difficulty scales enemy HP + damage (capped after two full species
// cycles). Each wave spawns 1 boss of the active species (finalboss every
// 10 waves) plus lower-tier same-species fill (mob/champion/miniboss).
// NOW USES EnemyFactory.createEnemy() — no direct Enemy.js import.
// v3.13.0: Spawn / wave-clear drop X ranges use the LIVE viewport width.
// v3.33.0: wave-clear drop table gained the hull-repair (health) and
//          FRENZY drops (tools/asset-manifest.json PNG art, v3.33.0).
export const VERSION = 'v3.33.0';
import { ENEMY_TYPES, WAVE } from './config.js';
import { createEnemy } from '../enemies/EnemyFactory.js';
import PowerUp from '../combat/PowerUp.js';
import { spawnAsteroid } from '../levels/AsteroidBonus.js'; // v3.11.0: asteroid chain drops
import { rand } from './utils.js';
import { bus } from './EventBus.js';
import { audio } from './AudioSystem.js';

export default class WaveManager {
  constructor(game) {
    this.game = game;
    this.wave = 0;
    this.active = false;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.clearedTimer = 0;
    this.bonusEvery = 4; // goal: bonus level every 4 waves
    // ─── v3.30.0: 16-species sequential wave system ───
    this.species = Object.keys(ENEMY_TYPES); // insertion order = species order
    this.speciesIndex = 0;
    this.currentSpecies = this.species[0];
    this.spawnOverride = 0; // 0 = AUTO (sawtooth ramp); >0 = fixed active count
  }

  reset() {
    this.wave = 0;
    this.active = false;
    this.spawnQueue = [];
    this.clearedTimer = 0;
    this.speciesIndex = 0;
    this.currentSpecies = this.species[0];
    // NOTE: spawnOverride intentionally preserved across resets (dev tooling).
  }

  /** v3.30.0: wave difficulty multiplier — scales enemy HP + damage only. */
  get difficulty() {
    const waves = Math.max(0, this.wave);
    const capWaves = WAVE.SPECIES_COUNT * WAVE.DIFF_CAP_CYCLES; // 32 (two full cycles)
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
    this.clearedTimer = 0;
    // v3.30.0: advance to the next species (one per wave, wraps after 16).
    // Wave 1 = first species, wave 16 = last, wave 17 wraps to first again.
    this.speciesIndex = (this.wave - 1) % this.species.length;
    this.currentSpecies = this.species[this.speciesIndex];
    this.buildQueue();
    this.active = true;
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
  }

  onWaveCleared() {
    // Wave-clear drops (v3.33.0: + health repair 3.5% + FRENZY 3%)
    const roll = Math.random();
    const x = rand(200, this.game.viewW - 200); // v3.13.0: live viewport
    if (roll < 0.015) this.game.powerups.push(new PowerUp({ x, y: -30, type: 'robot', game: this.game }));
    else if (roll < 0.05) this.game.powerups.push(new PowerUp({ x, y: -30, type: 'health', game: this.game }));
    else if (roll < 0.08) this.game.powerups.push(new PowerUp({ x, y: -30, type: 'frenzy', game: this.game }));
    else if (roll < 0.165) this.game.powerups.push(new PowerUp({ x, y: -30, type: 'mini', game: this.game }));
    else if (roll < 0.265) this.game.powerups.push(new PowerUp({ x, y: -30, type: 'life', game: this.game }));
    else if (roll < 0.465) this.game.powerups.push(new PowerUp({ x, y: -30, type: 'crate', game: this.game }));
    else if (roll < 0.615) spawnAsteroid(this.game, x, -30); // v3.11.0: asteroid chain (15%)
    if (this.wave % this.bonusEvery === 0) this.game.startBonusLevel();
    else this.startNext();
  }
}
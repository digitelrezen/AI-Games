// Filename: WaveManager.js
// Everything Vs Kitty ΓÇö v1.1.0
// Wave escalation, spawn queue, roster unlocks, wave-clear drops,
// and bonus-level goal triggering (every 4 waves).
// NOW USES EnemyFactory.createEnemy() ΓÇö no direct Enemy.js import.
export const VERSION = 'v1.1.0';
import { ENEMY_TYPES, GAME } from './config.js';
import { createEnemy } from './EnemyFactory.js';
import PowerUp from './PowerUp.js';
import { spawnAsteroid } from './AsteroidBonus.js'; // v3.11.0: asteroid chain drops
import { rand, pick } from './utils.js';
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
  }

  reset() {
    this.wave = 0;
    this.active = false;
    this.spawnQueue = [];
    this.clearedTimer = 0;
  }

  unlockedTypes() {
    const all = Object.keys(ENEMY_TYPES);
    const n = Math.min(all.length, 3 + Math.floor(this.wave / 1.5));
    return all.slice(0, n);
  }

  startNext() {
    this.wave++;
    this.clearedTimer = 0;
    this.buildQueue();
    this.active = true;
    const isFinal = this.wave % 10 === 0;
    bus.emit('banner', {
      text: isFinal ? `WAVE ${this.wave} ΓÇö FINAL BOSS INBOUND` : `WAVE ${this.wave}`,
      tone: isFinal ? 'bad' : 'good', duration: 2,
    });
    audio.banner();
  }

  buildQueue() {
    const q = [];
    const count = 8 + this.wave * 3;
    const types = this.unlockedTypes();
    for (let i = 0; i < count; i++) {
      let tier = 'mob';
      const r = Math.random();
      if (this.wave >= 2 && r < 0.10) tier = 'champion';
      if (this.wave >= 3 && r < 0.035) tier = 'miniboss';
      if (this.wave >= 5 && r < 0.012) tier = 'boss';
      q.push({ type: pick(types), tier, delay: rand(0.35, 1.1) });
    }
    if (this.wave % 10 === 0) q.push({ type: pick(types), tier: 'finalboss', delay: 2.5 });
    this.spawnQueue = q;
    this.spawnTimer = 1;
  }

  spawn(s) {
    const x = rand(120, GAME.W - 120);
    this.game.enemies.push(createEnemy({ type: s.type, tier: s.tier, x, y: -50, game: this.game }));
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
    // Wave-clear drops (mini-ships, lives, crates, rare robot)
    const roll = Math.random();
    const x = rand(200, GAME.W - 200);
    if (roll < 0.015) this.game.powerups.push(new PowerUp({ x, y: -30, type: 'robot', game: this.game }));
    else if (roll < 0.10) this.game.powerups.push(new PowerUp({ x, y: -30, type: 'mini', game: this.game }));
    else if (roll < 0.20) this.game.powerups.push(new PowerUp({ x, y: -30, type: 'life', game: this.game }));
    else if (roll < 0.40) this.game.powerups.push(new PowerUp({ x, y: -30, type: 'crate', game: this.game }));
    else if (roll < 0.55) spawnAsteroid(this.game, x, -30); // v3.11.0: asteroid chain (15%)
    if (this.wave % this.bonusEvery === 0) this.game.startBonusLevel();
    else this.startNext();
  }
}

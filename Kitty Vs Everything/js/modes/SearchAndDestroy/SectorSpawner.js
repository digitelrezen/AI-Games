// Filename: SectorSpawner.js
// Kitty Vs Everything — v3.99.0
// SEARCH & DESTROY — journey progression + regional spawners.
//
// The sequenced journey: the player starts in OPEN SPACE, must navigate
// through THE BONEYARD (debris field, hazards, regional enemy patrols)
// and finally reaches the DEEP SECTOR coordinates anchored by Eridath's
// Mom's House (the house's own spawn volleys live in
// SectorCombatManager — this module drives everything else).
//
// The player's WORLD x (SectorMap.playerWorld) drives the zone. Each zone
// runs its own spawners (tunables in config/searchDestroy.js SAR.ZONES):
//   • patrol   — regional enemies, screen-edge spawns (classic EnemyBase
//                AI — full roster parity, no re-implementation)
//   • boneyard — debris (BoneFragment bonusTargets) + hazards (the
//                v3.97.0 hazard field, spawned directly)
//   • drops    — the shared POWERUP_DROPS pool (DropManager) + asteroids,
//                fully off-screen, every zone
//
// Spawns are SCREEN-space (the combat stack is screen-space) — the world
// scroll comes from the camera, not from entity coordinates.
export const VERSION = 'v1.0.0';
import { SAR, rollPowerUpDrop } from '../../core/config.js';
import { rand, pick } from '../../core/utils.js';
import { bus } from '../../core/EventBus.js';
import { audio } from '../../core/AudioSystem.js';
import { createEnemy } from '../../enemies/EnemyFactory.js';
import BoneFragment from '../../levels/BoneFragment.js';
import { spawnAsteroid } from '../../levels/AsteroidBonus.js';
import { spawnDropAt } from '../../core/DropManager.js';

// Zone difficulty ramp (EnemyBase difficulty scales HP + damage).
const ZONE_DIFFICULTY = [1, 1.5, 2.0];

export default class SectorSpawner {
  constructor(game, map) {
    this.game = game;
    this.map = map;
    this.zone = -1; // -1 = pre-entry (the first update enters zone 0)
    this.patrolTimer = 1;
    this.boneTimer = 1;
    this.hazardTimer = 3;
    this.dropTimer = 4;
    this.asteroidTimer = 2;
  }

  /** Fresh journey per mission. */
  reset() {
    this.zone = -1;
    this.patrolTimer = 1;
    this.boneTimer = 1;
    this.hazardTimer = 3;
    this.dropTimer = 4;
    this.asteroidTimer = 2;
  }

  /** Per-frame driver (SearchAndDestroy.update). */
  update(dt) {
    const g = this.game;
    if (g.state !== 'playing' || !g.player || g.player.dead) return;
    const pw = this.map.playerWorld();
    // ─── JOURNEY PROGRESSION (zone by world x) ───
    let z = 0;
    for (let i = SAR.ZONES.length - 1; i >= 0; i--) {
      if (pw.x >= SAR.ZONES[i].x0) { z = i; break; }
    }
    if (z !== this.zone) this._enterZone(z);
    const zone = SAR.ZONES[z];
    // ─── REGIONAL PATROLS (screen-edge spawns, per-zone roster) ───
    this.patrolTimer -= dt;
    if (this.patrolTimer <= 0 && g.enemies.length < zone.maxEnemies) {
      this.patrolTimer = rand(zone.spawnMin, zone.spawnMax);
      this._spawnPatrol(zone, z);
    }
    // ─── THE BONEYARD: debris field + hazards ───
    if (zone.id === 'boneyard') {
      this.boneTimer -= dt;
      if (this.boneTimer <= 0) {
        this.boneTimer = rand(zone.boneMin, zone.boneMax);
        g.bonusTargets.push(new BoneFragment({
          x: rand(60, g.viewW - 60), y: -40, game: g,
        }));
      }
      this.hazardTimer -= dt;
      if (this.hazardTimer <= 0) {
        this.hazardTimer = rand(zone.hazardMin, zone.hazardMax);
        if (g.hazards && g.hazards.list.length < 8) g.hazards.spawnRandom(g);
      }
    }
    // ─── AMBIENT DROPS + ASTEROIDS (every zone, off-screen) ───
    this.dropTimer -= dt;
    if (this.dropTimer <= 0) {
      this.dropTimer = rand(SAR.DROPS.min, SAR.DROPS.max);
      spawnDropAt(g, rand(100, g.viewW - 100), -30, rollPowerUpDrop());
    }
    this.asteroidTimer -= dt;
    if (this.asteroidTimer <= 0) {
      this.asteroidTimer = rand(SAR.DROPS.asteroidMin, SAR.DROPS.asteroidMax);
      spawnAsteroid(g, rand(80, g.viewW - 80), -80);
    }
    // ─── CULL: boneyard debris that drifted below the screen ───
    for (const bt of g.bonusTargets) {
      if (bt.alive && bt.y > g.viewH + 120) bt.alive = false;
    }
  }

  /** Zone transition — banner + mission log (the journey's beats). */
  _enterZone(z) {
    this.zone = z;
    const zone = SAR.ZONES[z];
    const tone = z === 2 ? 'bad' : 'warn';
    bus.emit('banner', {
      text: 'ENTERING ' + zone.label,
      tone,
      duration: 3,
    });
    audio.banner();
    this.game.msglog.log('ENTERING ' + zone.label, tone, this.game.time);
    if (z === 1) {
      this.game.msglog.log('DEBRIS FIELD AHEAD — shoot the bones, dodge the hazards', 'info', this.game.time);
    }
    if (z === 2) {
      this.game.msglog.log("OBJECTIVE: DESTROY ERIDATH'S MOM'S HOUSE", 'bad', this.game.time);
    }
  }

  /** One regional patrol enemy from a screen edge (ahead of the travel). */
  _spawnPatrol(zone, z) {
    const g = this.game;
    const type = pick(zone.patrol);
    const tier = pick(zone.tiers);
    // Travel is left → right, so patrols close in from the right + top.
    const fromRight = Math.random() < 0.5;
    const x = fromRight ? g.viewW + 40 : rand(80, g.viewW - 80);
    const y = fromRight ? rand(60, g.viewH - 120) : -50;
    g.enemies.push(createEnemy({
      type, tier, x, y, game: g, difficulty: ZONE_DIFFICULTY[z] || 1,
    }));
  }
}

// Filename: SectorSpawner.js
// Kitty Vs Everything — v4.0.0
// SEARCH & DESTROY — journey progression + world-anchored spawners.
//
// The sequenced journey: the player starts in OPEN SPACE, must navigate
// through THE BONEYARD (debris field + hazards + regional enemy
// patrols) and finally reaches the DEEP SECTOR coordinates anchored by
// Eridath's Mom's House (the house's own spawn volleys live in
// SectorCombatManager — this module drives everything else).
//
// WORLD-ANCHORED SPAWNING (v4.0.0): debris, hazards and regional
// patrols are anchored to ABSOLUTE world coordinates — the
// deterministic layout in SectorMap (debrisAnchors / hazardAnchors /
// patrolSites). The player's WORLD position (SectorMap.playerWorld)
// activates the anchors:
//   • patrol   — a site arms when the player's world position comes
//                within PATROL.activate AND the site is on screen; the
//                enemy spawns AT the site's world→screen position
//                (classic EnemyBase AI — full roster parity, no
//                re-implementation); the site re-arms after a cooldown.
//   • boneyard — debris (BoneFragment bonusTargets) + hazards (the
//                v3.97.0 hazard field): activated at their world anchor,
//                then WORLD-LOCKED — the anchor owns the entity's world
//                position (slow world-space drift) and the entity's
//                screen position is re-projected every frame
//                (worldToScreen), so the debris streams past as the
//                displacement-accumulator camera scrolls. The classic
//                screen-space collision / draw / cull routines are
//                untouched (the entities always expose screen x/y).
//   • drops    — the shared POWERUP_DROPS pool (DropManager) + asteroids,
//                fully off-screen, every zone (classic lifecycle).
//
// PlayerFlight stays sovereign: nothing here touches the ship's
// velocity, input integration or weapon collision — only the world
// layer around it.
export const VERSION = 'v4.0.0';
import { SAR, rollPowerUpDrop, rollHazardType } from '../../core/config.js';
import { TAU, rand, pick, dist2, isOnScreen } from '../../core/utils.js';
import { bus } from '../../core/EventBus.js';
import { audio } from '../../core/AudioSystem.js';
import { createEnemy } from '../../enemies/EnemyFactory.js';
import BoneFragment from '../../levels/BoneFragment.js';
import { spawnAsteroid } from '../../levels/AsteroidBonus.js';
import { spawnDropAt } from '../../core/DropManager.js';
import { createHazard } from '../../hazards/HazardFactory.js';

// Zone difficulty ramp (EnemyBase difficulty scales HP + damage).
const ZONE_DIFFICULTY = [1, 1.5, 2.0];

export default class SectorSpawner {
  constructor(game, map) {
    this.game = game;
    this.map = map;
    this.zone = -1; // -1 = pre-entry (the first update enters zone 0)
    this.dropTimer = 4;
    this.asteroidTimer = 2;
    this.worldLocked = []; // { anchor, entity, wx, wy, vx, vy }
  }

  /** Fresh journey per mission. */
  reset() {
    this.zone = -1;
    this.dropTimer = 4;
    this.asteroidTimer = 2;
    this.worldLocked = [];
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
    // ─── REGIONAL PATROLS (world-anchored sites, per-zone roster) ───
    this._updatePatrolSites(z, pw, dt);
    // ─── THE BONEYARD: world-anchored debris field + hazards ───
    this._updateDebrisAnchors(pw);
    this._updateHazardAnchors(pw);
    // ─── WORLD-LOCKED ENTITIES (anchor drift + world→screen projection) ───
    this._updateWorldLocked(dt);
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

  // ─── REGIONAL PATROLS (world-anchored sites) ───

  /**
   * Patrol sites arm when the player's WORLD position comes within
   * PATROL.activate (absolute world coordinates) and the site is on
   * screen; the enemy spawns at the site's world→screen position.
   * Spent sites re-arm after a cooldown (sustainable patrol pressure).
   */
  _updatePatrolSites(z, pw, dt) {
    const g = this.game;
    const zone = SAR.ZONES[z];
    const sites = this.map.patrolSites[z];
    const R2 = SAR.WORLD.PATROL.activate ** 2;
    for (const site of sites) {
      if (site.used) {
        site.cooldown -= dt;
        if (site.cooldown <= 0) site.used = false;
        continue;
      }
      if (g.enemies.length >= zone.maxEnemies) continue;
      if (dist2(pw.x, pw.y, site.x, site.y) > R2) continue;
      // Spawn only while the site is on screen (visible world anchor).
      const s = this.map.worldToScreen(site.x, site.y);
      if (!isOnScreen(g, s.x, s.y, 80)) continue;
      site.used = true;
      site.cooldown = rand(SAR.WORLD.PATROL.rearmMin, SAR.WORLD.PATROL.rearmMax);
      this._spawnPatrol(zone, z, s.x, s.y);
    }
  }

  /** One regional patrol enemy at a world-anchored site (classic AI). */
  _spawnPatrol(zone, z, x, y) {
    const g = this.game;
    const type = pick(zone.patrol);
    const tier = pick(zone.tiers);
    g.enemies.push(createEnemy({
      type, tier, x, y, game: g, difficulty: ZONE_DIFFICULTY[z] || 1,
    }));
  }

  // ─── THE BONEYARD: world-anchored debris + hazards ───

  /**
   * Bone-debris anchors (absolute world coordinates): activated when the
   * player's world position comes within DEBRIS.activate and the anchor
   * is on screen. The bone spawns at the anchor's world→screen position
   * and is WORLD-LOCKED — the anchor owns its world position (slow
   * world-space drift) and the bone's screen position is re-projected
   * every frame, so the debris streams past as the camera scrolls.
   */
  _updateDebrisAnchors(pw) {
    const g = this.game;
    const R2 = SAR.WORLD.DEBRIS.activate ** 2;
    for (const anchor of this.map.debrisAnchors) {
      if (anchor.used) continue;
      if (dist2(pw.x, pw.y, anchor.x, anchor.y) > R2) continue;
      const s = this.map.worldToScreen(anchor.x, anchor.y);
      if (!isOnScreen(g, s.x, s.y, 60)) continue;
      anchor.used = true;
      const bone = new BoneFragment({ x: s.x, y: s.y, game: g });
      // World-locked: the anchor owns the position (the bone's own
      // screen-space drift is disabled — the camera scroll streams it
      // past; rotation / flash / HP / collision stay classic).
      bone.vx = 0;
      bone.vy = 0;
      g.bonusTargets.push(bone);
      this.worldLocked.push({
        anchor, entity: bone,
        wx: anchor.x, wy: anchor.y,
        vx: rand(-14, 14), vy: rand(6, 18), // slow world-space drift
      });
    }
  }

  /**
   * Hazard anchors (absolute world coordinates): activated when the
   * player's world position comes within HAZARDS.activate and the anchor
   * is on screen. The hazard spawns at the anchor's world→screen
   * position (weighted type roll, classic heading) and is WORLD-LOCKED
   * exactly like the debris — the classic hazard contact / proximity /
   // cull routines run untouched on the projected screen position.
   */
  _updateHazardAnchors(pw) {
    const g = this.game;
    if (!g.hazards) return;
    const R2 = SAR.WORLD.HAZARDS.activate ** 2;
    for (const anchor of this.map.hazardAnchors) {
      if (anchor.used) continue;
      if (dist2(pw.x, pw.y, anchor.x, anchor.y) > R2) continue;
      const s = this.map.worldToScreen(anchor.x, anchor.y);
      if (!isOnScreen(g, s.x, s.y, 60)) continue;
      if (g.hazards.list.length >= 8) continue;
      anchor.used = true;
      const hz = createHazard({
        type: rollHazardType(), x: s.x, y: s.y, angle: rand(0, TAU), game: g,
      });
      // World-locked: the anchor owns the position (the hazard's own
      // drift is disabled — the camera scroll streams it past).
      hz.vx = 0;
      hz.vy = 0;
      g.hazards.list.push(hz);
      this.worldLocked.push({
        anchor, entity: hz,
        wx: anchor.x, wy: anchor.y,
        vx: rand(-10, 10), vy: rand(4, 12), // slow world-space drift
      });
    }
  }

  /**
   * World-locked entities: advance the world-space drift, re-project to
   * screen space (the classic collision / draw / cull routines read the
   * projected x/y), and consume the anchor once the entity dies or the
   * anchor leaves the visible world.
   */
  _updateWorldLocked(dt) {
    const rect = this.map.visibleRect();
    const margin = 160;
    for (let i = this.worldLocked.length - 1; i >= 0; i--) {
      const w = this.worldLocked[i];
      // The entity died (shot down / self-culled off-screen) → the
      // anchor is consumed (one-shot world feature).
      if (!w.entity.alive) {
        w.anchor.used = true;
        this.worldLocked.splice(i, 1);
        continue;
      }
      // Advance the world-space drift + re-project to screen space.
      w.wx += w.vx * dt;
      w.wy += w.vy * dt;
      const s = this.map.worldToScreen(w.wx, w.wy);
      w.entity.x = s.x;
      w.entity.y = s.y;
      // The anchor left the visible world (with margin) → consumed.
      if (w.wx < rect.minX - margin || w.wx > rect.maxX + margin ||
          w.wy < rect.minY - margin || w.wy > rect.maxY + margin) {
        w.entity.alive = false;
        w.anchor.used = true;
        this.worldLocked.splice(i, 1);
      }
    }
  }
}

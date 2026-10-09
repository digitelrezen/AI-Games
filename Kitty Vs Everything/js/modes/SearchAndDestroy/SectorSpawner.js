// Filename: SectorSpawner.js
// Kitty Vs Everything — v4.3.0
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
// AUTONOMOUS WORLD MOTION (v4.3.0): drops, asteroids and chasing enemies
// integrate in SCREEN space (the classic combat stack), while the
// displacement-accumulator camera scrolls WORLD space — left alone they
// drift relative to the world (a stationary drop "rises" off the sector
// floor as the camera scrolls). The worldMotion registry (a Map keyed by
// entity, alongside the worldLocked registry) fixes that:
//   • auto  — the entity's own screen-space delta is treated as world
//             motion: its world position advances by the delta (capped at
//             WORLD_MOTION_MAX_STEP per frame — boss wrap / teleport
//             artifacts never reach the world layer), and the world
//             position is re-projected back to screen after the camera
//             accumulator advances (worldToScreen), so the entity stays
//             pinned to the world while keeping its own flight;
//   • drift — the registry owns a fixed world velocity (the worldLocked
//             pattern, generalized for non-anchored entities).
// Adoption runs at the end of update() (after every spawn source) and
// re-projection runs after SectorMap.update, so drops keep falling while
// the ship holds still and nothing drifts while the camera scrolls.
//
// PlayerFlight stays sovereign: nothing here touches the ship's
// velocity, input integration or weapon collision — only the world
// layer around it.
export const VERSION = 'v4.3.0';
import { SAR, rollPowerUpDrop, rollHazardType } from '../../core/config.js';
import { TAU, rand, pick, dist2, isOnScreen, clamp } from '../../core/utils.js';
import { bus } from '../../core/EventBus.js';
import { audio } from '../../core/AudioSystem.js';
import { createEnemy } from '../../enemies/EnemyFactory.js';
import BoneFragment from '../../levels/BoneFragment.js';
import { spawnAsteroid } from '../../levels/AsteroidBonus.js';
import { spawnDropAt } from '../../core/DropManager.js';
import { createHazard } from '../../hazards/HazardFactory.js';

// Zone difficulty ramp (EnemyBase difficulty scales HP + damage).
const ZONE_DIFFICULTY = [1, 1.5, 2.0];

// v4.3.0: per-frame cap on the world-space delta an adopted entity may
// take on (px). Far above any legitimate enemy / drop / asteroid speed
// (a few px per frame) — it only blocks boss-wrap and teleport artifacts
// (a 1300px screen jump) from reaching the world layer.
const WORLD_MOTION_MAX_STEP = 48;

export default class SectorSpawner {
  constructor(game, map) {
    this.game = game;
    this.map = map;
    this.zone = -1; // -1 = pre-entry (the first update enters zone 0)
    this.dropTimer = 4;
    this.asteroidTimer = 2;
    this.worldLocked = []; // { anchor, entity, wx, wy, vx, vy }
    // v4.3.0: autonomous world-motion registry (entity → { wx, wy,
    // prevX, prevY, mode, vx, vy }) — drops / asteroids / chasing
    // enemies pinned to the world (see the file header).
    this.worldMotion = new Map();
  }

  /** Fresh journey per mission. */
  reset() {
    this.zone = -1;
    this.dropTimer = 4;
    this.asteroidTimer = 2;
    this.worldLocked = [];
    this.worldMotion = new Map();
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

    // ─── AUTONOMOUS WORLD MOTION (v4.3.0) ───
    // After every spawn source this frame: adopt new drops / asteroids /
    // enemies into the worldMotion registry, advance their world
    // positions, and re-project them back to screen (SectorMap.update
    // already advanced the camera accumulator this frame, so the
    // re-projection sees the new view).
    this._adoptWorldEntities();
    this._updateWorldMotion(dt);
  }

  /**
   * v4.3.0 — adopt one entity into the worldMotion registry. The world
   * position is back-projected from the entity's current screen position
   * (screenToWorld), so adoption is seamless: the entity is pinned to
   * the world point it currently occupies. mode 'auto' = the entity's
   * own screen-space delta is world motion; mode 'drift' = the registry
   * owns a fixed world velocity (vx, vy) — the worldLocked pattern.
   */
  _adoptWorld(entity, mode) {
    if (!entity || this.worldMotion.has(entity)) return;
    const w = this.map.screenToWorld(entity.x, entity.y);
    this.worldMotion.set(entity, {
      wx: w.x, wy: w.y,          // world position (the source of truth)
      prevX: entity.x, prevY: entity.y, // last re-projected screen pos
      mode,
      vx: 0, vy: 0,              // drift-mode world velocity
    });
  }

  /**
   * v4.3.0 — adopt every live drop / asteroid / enemy not yet in the
   * registry (all three live in game.powerups / game.enemies — see
   * AsteroidBonus: asteroids are PowerUp-shaped, destructible=true).
   * Runs at the end of update(), after every spawn source, so nothing
   * escapes adoption for a frame.
   */
  _adoptWorldEntities() {
    const g = this.game;
    for (const pw of g.powerups) {
      if (pw.alive) this._adoptWorld(pw, 'auto');
    }
    for (const e of g.enemies) {
      if (e.alive) this._adoptWorld(e, 'auto');
    }
  }

  /**
   * v4.3.0 — advance every adopted entity's world position and re-project
   * it back to screen. auto: the entity's own screen-space delta since the
   * last re-projection is treated as world motion (capped at
   * WORLD_MOTION_MAX_STEP per frame — a boss wrap or teleport never drags
   * the world position with it). drift: the registry's fixed world velocity
   * integrates the world position directly. prevX/prevY always hold the
   * last RE-PROJECTED screen position, so the camera's own shift is never
   * counted as entity motion (no drift on sustained scroll). Dead entities
   * are dropped from the registry (the classic cull already removed them).
   */
  _updateWorldMotion(dt) {
    for (const [entity, w] of this.worldMotion) {
      if (!entity.alive) {
        this.worldMotion.delete(entity);
        continue;
      }
      if (w.mode === 'drift') {
        w.wx += w.vx * dt;
        w.wy += w.vy * dt;
      } else {
        // auto — the entity's own screen-space delta is world motion.
        const dx = entity.x - w.prevX;
        const dy = entity.y - w.prevY;
        w.wx += clamp(dx, -WORLD_MOTION_MAX_STEP, WORLD_MOTION_MAX_STEP);
        w.wy += clamp(dy, -WORLD_MOTION_MAX_STEP, WORLD_MOTION_MAX_STEP);
      }
      // Re-project world → screen (the camera accumulator already
      // advanced this frame in SectorMap.update). prevX/prevY track the
      // re-projected position so next frame's delta is the entity's own
      // classic motion only — the camera shift is never double-counted.
      const s = this.map.worldToScreen(w.wx, w.wy);
      entity.x = s.x;
      entity.y = s.y;
      w.prevX = s.x;
      w.prevY = s.y;
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

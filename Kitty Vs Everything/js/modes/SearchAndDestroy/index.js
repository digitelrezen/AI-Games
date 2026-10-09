// Filename: index.js
// Kitty Vs Everything — v4.3.0
// SEARCH & DESTROY subsystem barrel (E6 nested module) — the single import
// surface for js/modes/SearchAndDestroy/. Game.js imports the
// SearchAndDestroy facade from here; the submodules are re-exported for
// the check suite + future consumers.
//
// The facade owns the four SAR modules and drives them from the core
// loop (Game.update → update, Game.render → renderBackground/renderHud):
//   SectorMap            — world grid + displacement-accumulator camera
//   SectorSpawner        — journey zones + world-anchored spawners
//   SectorCombatManager  — the house base + victory sequence
//   RadarManager         — cockpit radar HUD (F1 toggle)
//
// v4.0.0: the DISPLACEMENT-ACCUMULATOR camera (SectorMap) replaces the
// v3.99.0 pan+rotation model — the player's screen offset is tracked
// against a dead zone, the excess delta is accumulated into world
// coordinates (worldX / worldY) and the ship is softly recentered; the
// world scrolls fluidly around the untouched screen-space combat layer
// (PlayerFlight stays sovereign). Debris, hazards and regional patrols
// are WORLD-ANCHORED at absolute world coordinates (the deterministic
// SectorMap layout).
//
// Roster parity: the classic combat stack (all 9 Catships, the
// Vulcan/Plasma/Rail weapons, rockets, ultimates, POWERUP_DROPS) is
// reused untouched — the SAR mode only adds the world layer around it.
export { default as SectorMap } from './SectorMap.js';
export { default as SectorSpawner } from './SectorSpawner.js';
export { default as SectorCombatManager } from './SectorCombatManager.js';
export { default as RadarManager } from './RadarManager.js';

import SectorMap from './SectorMap.js';
import SectorSpawner from './SectorSpawner.js';
import SectorCombatManager from './SectorCombatManager.js';
import RadarManager from './RadarManager.js';
import { SAR, sarProgress } from '../../core/config.js';
import { bus } from '../../core/EventBus.js';
import { audio } from '../../core/AudioSystem.js';

export const VERSION = 'v4.3.0';

export default class SearchAndDestroy {
  constructor(game) {
    this.game = game;
    this.map = new SectorMap(game);
    this.combat = new SectorCombatManager(game, this.map);
    this.spawner = new SectorSpawner(game, this.map);
    this.radar = new RadarManager(game, this.map);
    this.combat.reset();
    this.spawner.reset();
    this.map.reset();
    bus.emit('banner', {
      text: "SEARCH & DESTROY v4.3.0 — FIND ERIDATH'S MOM'S HOUSE",
      tone: 'warn',
      duration: 4,
    });
    audio.banner();
    game.msglog.log('SEARCH & DESTROY v4.3.0 MISSION START', 'warn', game.time);
    game.msglog.log('OBJECTIVE: cross the sector, clear The Boneyard, destroy the base', 'info', game.time);
    game.msglog.log('F1 toggles the cockpit radar', 'info', game.time);
  }

  /** Per-frame driver (Game.update, playing block). */
  update(dt) {
    const g = this.game;
    const p = g.player;
    if (!p || p.dead) return;
    this.map.update(dt, p);      // camera pan + tether + rotation
    this.spawner.update(dt);     // journey zones + patrols + debris + drops
    this.combat.update(dt);      // house base + spawn volleys + victory
    this.radar.update(dt);       // sweep animation
  }

  /** Sector background (Game.render — replaces the classic starfield). */
  renderBackground(ctx) {
    this.map.renderBackground(ctx, this.combat.house);
  }

  /** Screen-space SAR HUD (Game.render — after the classic HUD). */
  renderHud(ctx) {
    this.combat.renderHouseHud(ctx);
    this.radar.render(ctx);
  }

  /** HUD wave-label slot (the journey readout). */
  hudLabel() {
    const z = this.spawner.zone >= 0 ? SAR.ZONES[this.spawner.zone] : SAR.ZONES[0];
    const prog = Math.round(sarProgress(this.map.playerWorld().x) * 100);
    return 'SAR · ' + z.label + ' · ' + prog + '%';
  }

  /** Teardown (mode restart) — drops the radar's key listener. */
  destroy() {
    this.radar.destroy();
  }
}

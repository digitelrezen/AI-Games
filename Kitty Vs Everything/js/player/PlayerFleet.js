// Filename: PlayerFleet.js
// Kitty Vs Everything — v3.47.0
// Docked mini-ship fleet: spawn (strict same-color clone via
// CatShipFactory.createMiniShip), per-frame update, independent mini death
// handling, color-match synergy charging, and fleet clearing on hull loss.
// v3.3.0: strict same-color mini lifecycle — minis always clone the
//         player's theme, have their own HP pool, and die with the hull.
// v3.16.0: fleet deploy state (player.fleetDeployed) is reset when the
//         fleet is cleared (MiniDeploy.js owns the deploy/recall logic).
// v3.47.0: Synergy Explosion is now KEY-TRIGGERED — the meter charges
//         while the fleet is color-matched and HOLDS at 100%; the
//         'synergy' action (P1: T / -, P2 co-op: , — see Keybinds.js /
//         Player2Controls.js) fires superWeapon() when ready. The old
//         10s auto-fire is gone.
export const VERSION = 'v3.47.0';
import { createMiniShip } from '../core/CatShipFactory.js';
import { MINI_SHIP } from '../core/config.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';

/**
 * Dock a mini-ship. Strict same-color rule: the mini always clones the
 * player's current theme (CatShipFactory is the single mini spawn path).
 * @returns {boolean} true if a mini was docked, false when the grid is full.
 */
export function addMini(player) {
  if (player.minis.length >= MINI_SHIP.maxDocked) return false;
  const mini = createMiniShip(player);
  if (!mini) return false;
  player.minis.push(mini);
  bus.emit('banner', {
    text: player.minis.length >= MINI_SHIP.maxDocked
      ? 'FLEET COMPLETE! SYNERGY CHARGING…'
      : 'MINI-SHIP DOCKED! SYNERGY CHARGING…',
    tone: 'good', duration: 1.5,
  });
  return true;
}

/**
 * Update docked minis, handle their independent deaths, and charge the
 * color-match synergy meter (superCharge). v3.47.0: the meter HOLDS at
 * 100% — the 'synergy' key (T / - P1, , P2) fires superWeapon() when the
 * fleet is color-matched and the meter is full.
 */
export function updateFleet(player, dt, input) {
  const g = player.game;
  for (const m of player.minis) m.update(dt, player, input);

  // ─── INDEPENDENT MINI DEATHS (own HP pool, own explosion) ───
  const dead = player.minis.filter(m => !m.alive);
  if (dead.length > 0) {
    for (const m of dead) {
      g.particles.burst(m.x, m.y, { count: 26, color: m.color, speed: 260, life: 0.7, size: 3 });
      g.particles.burst(m.x, m.y, { count: 10, color: '#ffffff', speed: 120, life: 0.4, size: 2 });
      g.shake = Math.max(g.shake, 5);
    }
    audio.explosion();
    bus.emit('banner', {
      text: dead.length > 1
        ? 'MINI-SHIPS DESTROYED! (' + dead.length + ')'
        : 'MINI-SHIP DESTROYED!',
      tone: 'bad', duration: 1.2,
    });
    player.minis = player.minis.filter(m => m.alive);
  }

  // ─── COLOR-MATCH SYNERGY (strict rule ⇒ all minis always match) ───
  if (player.minis.length > 0 && player.minis.every(m => m.theme === player.theme)) {
    player.superCharge = Math.min(1, player.superCharge + dt / MINI_SHIP.synergyChargeTime);
  }
  // ─── v3.47.0: SYNERGY EXPLOSION (key-triggered — 'synergy' action) ───
  // The meter holds at 100% once charged; the player fires it with the
  // synergy key (P1 keyboard T / -, P2 co-op , — local or remote).
  if (player.minis.length > 0
      && player.minis.every(m => m.theme === player.theme)
      && player.superCharge >= 1
      && input.wasPressedAction('synergy')) {
    player.superCharge = 0;
    player.superWeapon();
  }
}

/** Destroy every docked mini (fleet lost with the hull). */
export function clearFleet(player) {
  if (player.minis.length === 0) return;
  for (const m of player.minis) {
    player.game.particles.burst(m.x, m.y, { count: 18, color: m.color, speed: 220, life: 0.6, size: 3 });
  }
  player.minis = [];
  player.superCharge = 0;
  player.fleetDeployed = false; // v3.16.0: no fleet ⇒ nothing to deploy
}

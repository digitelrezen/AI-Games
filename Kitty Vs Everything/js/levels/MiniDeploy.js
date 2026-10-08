// Filename: MiniDeploy.js
// Kitty Vs Everything — v3.16.0
// Fleet deploy / recall — the undock mechanic for the mini-ship fleet.
//   DOCKED (default): minis ride the flank hardpoints and are completely
//                     inert (no fire, no weapon animation — MiniShip.js).
//   DEPLOYED: minis orbit the hull on their dock side (deployRadius,
//             deployOrbitSpeed) and fire the player's active weapon.
// Toggled by the remappable 'deployFleet' action (Keybinds.js, default
// B / N) and the external debugger command `deploy [on|off]`
// (DebugBridge.js). Pure logic — no canvas, no DOM.
export const VERSION = 'v3.16.0';
import { MINI_SHIP } from '../core/config.js';
import { bus } from '../core/EventBus.js';

/**
 * Toggle the fleet deploy state. On deploy, stagger the fire timers and
 * orbit phases so the fleet doesn't fire in lockstep with the main hull.
 * @returns {boolean|null} new deploy state, or null when there is no fleet.
 */
export function toggleFleetDeploy(player) {
  if (!player || player.minis.length === 0) return null;
  player.fleetDeployed = !player.fleetDeployed;
  if (player.fleetDeployed) {
    player.minis.forEach((m, i) => {
      m.orbitAngle = (i % 2 === 0 ? 0 : Math.PI) + i * 0.7;
      m.fireTimer = Math.random() * 0.4;
    });
  }
  const g = player.game;
  const msg = player.fleetDeployed
    ? 'FLEET DEPLOYED — minis in combat orbit'
    : 'FLEET RECALLED — minis docked & inert';
  bus.emit('banner', { text: msg, tone: player.fleetDeployed ? 'good' : 'info', duration: 1.6 });
  if (g.msglog) g.msglog.log(msg, 'info', g.time);
  return player.fleetDeployed;
}

/**
 * v3.96.0: ORBIT MODE (T toggle) — DOCKED <-> ORBITING.
 * Entering orbit recalls any active deploy (so a second T redocks into the
 * clamp slots instead of re-deploying) and resets the orbit phase so the
 * minis start on their dock sides. Exiting orbit returns the minis to their
 * dock slots (the docked branch in MiniShip.update snaps them back).
 * Destroyed minis are ignored (they're already filtered from player.minis).
 */
export function toggleFleetOrbit(player) {
  player.fleetOrbiting = !player.fleetOrbiting;
  if (player.fleetOrbiting) {
    player.fleetDeployed = false; // recall deploy so a 2nd T redocks
    player.minis.forEach((m) => { m.orbitAngle = 0; });
  }
}

/**
 * Per-frame fleet flight. Docked minis are positioned by MiniShip.update
 * (snap to the dock hardpoint); deployed minis orbit the hull on their
 * dock side. Called from Player.update BEFORE the per-mini update so each
 * mini reads its final position this frame.
 */
export function updateFleetDeploy(player, dt) {
  if (!player) return;
  if (player.minis.length === 0) {
    player.fleetDeployed = false;
    player.fleetOrbiting = false; // v3.96.0: no fleet ⇒ nothing to orbit
    return;
  }
  if (!player.fleetDeployed) return;
  for (const m of player.minis) {
    if (!m.alive) continue;
    m.orbitAngle += MINI_SHIP.deployOrbitSpeed * dt;
    const a = player.angle + m.side * (Math.PI / 2) + m.orbitAngle;
    m.x = player.x + Math.cos(a) * MINI_SHIP.deployRadius;
    m.y = player.y + Math.sin(a) * MINI_SHIP.deployRadius;
  }
}
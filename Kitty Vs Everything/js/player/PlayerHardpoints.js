// Filename: PlayerHardpoints.js
// Kitty Vs Everything — v3.46.0
// Catship hardpoint math: converts SHIP_GEOMETRY local-space positions
// (weapon paws, muzzle, mini docks) into world space.
// v3.3.0: Extracted from Player.js (module split of oversized files).
// SHIP_GEOMETRY (config.js) is the single source of truth for all of these
// positions — shared by this module and the art (PlayerShipArt.js).
export const VERSION = 'v3.46.0';
import { SHIP_GEOMETRY, WEAPONS, MAIN_SHIP_SCALE } from '../core/config.js';

/**
 * Transform a ship-local point (nose = -Y, tail = +Y, flanks = ±X) to world.
 * MUST match PlayerShipArt's transform: rotate(angle + PI/2). A local point
 * (lx, ly) lands at world offset (-lx*sinA - ly*cosA, +lx*cosA - ly*sinA) —
 * verified against canvas rotation math so bullets spawn exactly on the
 * drawn hardpoints.
 */
export function localToWorld(player, lx, ly) {
  const cosA = Math.cos(player.angle);
  const sinA = Math.sin(player.angle);
  // v3.47.0: scale by MAIN_SHIP_SCALE so gameplay hardpoints (bullet spawn,
  // mini docks) track the 2x-drawn main hull (PlayerRenderer ctx.scale).
  const s = MAIN_SHIP_SCALE;
  return {
    x: player.x - (lx * sinA + ly * cosA) * s,
    y: player.y + (lx * cosA - ly * sinA) * s,
  };
}

/** World positions of the twin front-paw weapon hardpoints [left, right]. */
export function getUpperPawOffsets(player) {
  const l = SHIP_GEOMETRY.frontPawL;
  const r = SHIP_GEOMETRY.frontPawR;
  return [
    localToWorld(player, l.x, l.y),
    localToWorld(player, r.x, r.y),
  ];
}

/**
 * v3.17.0: World positions of the OVERSIZED barrel TIPS [left, right].
 * The barrels extend forward (-Y) from each paw by barrelLen, so bullets
 * spawn at the tip — matching the drawn muzzle (PlayerShipFx).
 * v3.46.0: per-weapon barrelLen (WEAPONS[weapon].barrelLen; vulkan 15 /
 * plasma 10 / rail 22), falling back to SHIP_GEOMETRY.barrelLen.
 */
export function getMuzzleTipOffsets(player) {
  const l = SHIP_GEOMETRY.frontPawL;
  const r = SHIP_GEOMETRY.frontPawR;
  // v3.46.0: per-weapon barrel length (vulkan 15 / plasma 10 / rail 22)
  const BL = (WEAPONS[player.weapon] && WEAPONS[player.weapon].barrelLen) || SHIP_GEOMETRY.barrelLen;
  return [
    localToWorld(player, l.x, l.y - BL),
    localToWorld(player, r.x, r.y - BL),
  ];
}

/** World position of the nose muzzle (rail cannon). */
export function getMuzzlePosition(player) {
  const m = SHIP_GEOMETRY.muzzle;
  return localToWorld(player, m.x, m.y);
}

/** World position of a mini dock slot. side: -1 = left flank, +1 = right. */
export function getDockPosition(player, side) {
  const dock = side < 0 ? SHIP_GEOMETRY.miniDockL : SHIP_GEOMETRY.miniDockR;
  return localToWorld(player, dock.x, dock.y);
}

// Filename: CatShipFactory.js
// Kitty Vs Everything — v3.71.0
// Single factory for the player fleet:
//   createCatShip(theme, game) — builds the main hull (per-theme variant)
//   createMiniShip(player)     — THE SOLE mini-ship spawn path. v3.3.0 strict
//                                same-color rule: minis always clone the
//                                player's current theme and dock on the free
//                                flank (SHIP_GEOMETRY.miniDockL / miniDockR).
// v3.71.0: MODULAR COMBAT (Phase 4) — moved from js/core/ into js/combat/
//           alongside the rest of the combat modules; createCatShip /
//           createMiniShip behavior unchanged.
export const VERSION = 'v3.71.0';
import { MINI_SHIP } from '../core/config.js';
import MiniShip from './MiniShip.js';
import OrangeCat from '../player/variants/orangeCat.js';
import YellowCat from '../player/variants/yellowCat.js';
import GreyCat from '../player/variants/greyCat.js';
import WhiteCat from '../player/variants/whiteCat.js';
import BrownCat from '../player/variants/brownCat.js';

// v3.91.0: hue-shifted white-base theme keys (White-*-Catship-256x384.png).
// Each of the 9 themes maps to the variant class of its hue family — the
// class supplies the ultimate; white_yellow is the fallback class.
const VARIANTS = {
  white_yellow:   YellowCat, // bright family — Energy Ring Explosion
  white_green:    YellowCat,
  white_orange:   OrangeCat, // hot family — Nova Shockwave
  white_pink:     WhiteCat,  // bright/soft family — Tactical Nuke
  white_purple:   WhiteCat,
  white_blue:     GreyCat,   // cool family — Black Hole Pull
  white_elecblue: GreyCat,
  white_teal:     GreyCat,
  white_red:      BrownCat,  // deep warm family — Shield Overcharge
};

/** Create the main hull variant for a theme (Game.start calls this). */
export function createCatShip(theme, game) {
  const Variant = VARIANTS[theme] || YellowCat;
  return new Variant(game, theme);
}

/**
 * Create a docked mini-ship (v3.3.0: the ONLY mini spawn path).
 * Clones the player's theme, picks the free dock side, and initializes
 * independent HP / radius / color / pattern / visual state.
 * @returns {MiniShip|null} null when the fleet is at capacity
 *                          (MINI_SHIP.maxDocked).
 */
export function createMiniShip(player) {
  if (!player || player.minis.length >= MINI_SHIP.maxDocked) return null;
  // Free flank: the first mini docks left, the second takes the opposite side.
  const side = player.minis.length === 0 ? -1 : (player.minis[0].side === -1 ? 1 : -1);
  return new MiniShip(player, side);
}

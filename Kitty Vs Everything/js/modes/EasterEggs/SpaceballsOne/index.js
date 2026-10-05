// Filename: index.js
// Kitty Vs Everything — v3.81.0
// Spaceballs One easter-egg subsystem barrel (E6 nested module).
// The ship is registered by js/core/EasterEgg.js (the `spaceballs` slot);
// this barrel is the single import surface for the subsystem.

export { default as SpaceballsOne, SPACEBALLS_ONE } from './SpaceballsOne.js';
export {
  drawSpaceballsShip,
  getSpaceballsArt,
  isSpaceballsArtReady,
  spaceballsArtDims,
  SPACEBALLS_ART_KEY,
} from './SpaceballsOneArt.js';
export { sweepPath } from './SpaceballsOneCollision.js';
export { updateSpaceballsWeapon, spaceballsNosePos } from './SpaceballsOneWeapon.js';
export { spawnTreasureChest, treasureChestTypes } from './SpaceballsOneLoot.js';

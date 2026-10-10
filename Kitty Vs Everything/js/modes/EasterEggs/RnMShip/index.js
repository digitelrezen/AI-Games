// Filename: index.js
// Kitty Vs Everything — v4.1.0
// RnM ship easter-egg subsystem barrel (E6 nested module).
// The ship is registered by js/core/EasterEgg.js (the `rnms` slot);
// this barrel is the single import surface for the subsystem.

export { default as RnMShip, RNMSHIP, RNMSHIP_DIALOGUE } from './RnMShip.js';
export {
  drawRnMShip,
  getRnMShipArt,
  isRnMShipArtReady,
  rnmsArtDims,
  RNMSHIP_ART_KEY,
} from './RnMShipArt.js';
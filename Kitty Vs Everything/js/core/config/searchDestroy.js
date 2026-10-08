// Filename: config/searchDestroy.js
// Kitty Vs Everything — v3.99.0
// SEARCH & DESTROY (SAR) mode — the single tuning surface for the new
// sector-journey mode (js/modes/SearchAndDestroy/, E6 nested modules).
//
// The SAR mode is a world-space CAMERA LAYER over the untouched
// screen-space combat stack: the player flies in screen space (full
// parity with all 9 Catships, the Vulcan/Plasma/Rail weapons, rockets,
// ultimates and the shared POWERUP_DROPS pool) while SectorMap.js pans +
// rotates a large 2D coordinate grid (the sector) relative to the
// player's movement vector. The sequenced journey runs left → right
// across the sector: OPEN SPACE → THE BONEYARD → DEEP SECTOR, where
// Eridath's Mom's House anchors the deep sector as a persistent,
// shootable enemy-spawning base (the mission objective).
//
// Tunables live HERE (Phase 2 parameter standardization) — the SAR
// modules must not hardcode their own stats.

// ─── SECTOR (world space) ───
// The sector is a large 2D world-space coordinate grid (world px). The
// camera (SectorMap.js) pans with the ship's screen-space velocity and
// tethers the player near the screen center (classic screen bounds are
// disabled — the world scrolls instead of wrapping).
export const SAR = {
  SECTOR: { W: 64000, H: 12000, GRID: 2000 },
  // The player's starting world position (open space, left edge).
  START: { x: 2000, y: 6000 },
  // ─── CAMERA ───
  //   PAN_FACTOR         world scroll per px of screen-space ship velocity
  //   ROTATION_INFLUENCE background rotation = ship heading × this (the
  //                      "rotational background camera shift")
  //   ANGLE_EASE         rad/s ease rate toward the target rotation
  //   TETHER_X / TETHER_Y  dead-zone half-size (× viewW / viewH) — the
  //                      player is tethered near the screen center;
  //                      beyond the dead zone the camera pans 1:1 with
  //                      the overflow (bounds disabled)
  //   CLAMP_MARGIN       camera clamp margin inside the sector bounds
  CAMERA: {
    PAN_FACTOR: 0.25,
    ROTATION_INFLUENCE: 0.35,
    ANGLE_EASE: 3.0,
    TETHER_X: 0.36,
    TETHER_Y: 0.36,
    CLAMP_MARGIN: 400,
  },
  // ─── JOURNEY ZONES (left → right across the sector) ───
  // The sequenced journey: the player starts in OPEN SPACE, must navigate
  // through THE BONEYARD (debris field, hazards, regional enemy patrols)
  // and finally reaches the DEEP SECTOR coordinates anchored by Eridath's
  // Mom's House. SectorSpawner.js drives per-zone patrols / debris /
  // hazards from these entries (patrol = regional enemy roster, tiers =
  // spawn tier mix, spawnMin/Max = patrol cadence in seconds).
  ZONES: [
    {
      id: 'open', label: 'OPEN SPACE', x0: 0, x1: 22000, maxEnemies: 8,
      patrol: ['wasp', 'butterfly', 'rat', 'moth'], tiers: ['mob'],
      spawnMin: 2.4, spawnMax: 4.2,
    },
    {
      id: 'boneyard', label: 'THE BONEYARD', x0: 22000, x1: 46000, maxEnemies: 12,
      patrol: ['human', 'spider', 'snake', 'alien'], tiers: ['mob', 'champion'],
      spawnMin: 1.8, spawnMax: 3.0,
      boneMin: 1.1, boneMax: 2.4,      // debris cadence (s)
      hazardMin: 3.5, hazardMax: 7,    // hazard cadence (s)
    },
    {
      id: 'deep', label: 'DEEP SECTOR', x0: 46000, x1: 64000, maxEnemies: 16,
      patrol: ['wolf', 'falcon', 'dragon', 'blackcat', 'pinkcat', 'shuttle'],
      tiers: ['mob', 'champion', 'miniboss'],
      spawnMin: 1.5, spawnMax: 2.8,
    },
  ],
  // ─── ERIDATH'S MOM'S HOUSE (the target base, deep sector) ───
  // A world-anchored, shootable, PERSISTENT enemy-spawning base (the
  // mission objective). SectorCombatManager.js owns its state + the
  // friendly-bullet collision pass + the victory sequence; SectorMap.js
  // renders it (asset key `eridath_moms_house`, 128px native → drawScale).
  HOUSE: {
    x: 60000, y: 3500,       // world position (anchored in the deep sector)
    HP: 2500,                // base hull
    radius: 110,             // screen-space collision radius
    drawScale: 3,            // 128px sprite → 384px world landmark
    spawnRange: 1500,        // world px — the base spawns while the player is this close
    spawnMin: 4.5, spawnMax: 8, // seconds between base spawn volleys
    volleyMin: 3, volleyMax: 6, // enemies per base volley
    victoryScore: 50000,     // mission-complete bonus
  },
  // ─── AMBIENT DROPS (SAR power-up cadence, seconds) ───
  // Every zone streams the shared POWERUP_DROPS pool (DropManager) +
  // asteroids, fully off-screen — the classic drop lifecycle is reused.
  DROPS: { min: 6, max: 11, asteroidMin: 3, asteroidMax: 6 },
  // ─── COCKPIT RADAR (RadarManager.js) ───
  RADAR: {
    RANGE: 2200,             // world px shown at the radar rim
    R: 120,                  // radar radius (screen px)
    BLIP_CAP: 48,            // max blips drawn (nearest first)
    KEY: 'F1',               // avionics toggle (DevPanel-style window listener)
  },
};

/**
 * Journey progress 0..1 along the start → house axis (world x). Used by
 * the HUD label + the radar progress readout.
 */
export function sarProgress(wx) {
  const t = (wx - SAR.START.x) / (SAR.HOUSE.x - SAR.START.x);
  return Math.max(0, Math.min(1, t));
}

/**
 * Zone index for a world x (0 = open space / 1 = boneyard / 2 = deep
 * sector). The zone bands are the ZONES x0/x1 columns above.
 */
export function sarZoneFor(wx) {
  for (let i = SAR.ZONES.length - 1; i >= 0; i--) {
    if (wx >= SAR.ZONES[i].x0) return i;
  }
  return 0;
}

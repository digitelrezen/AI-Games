// Filename: config/searchDestroy.js
// Kitty Vs Everything — v4.3.0
// SEARCH & DESTROY (SAR) mode — the single tuning surface for the
// sector-journey mode (js/modes/SearchAndDestroy/, E6 nested modules).
//
// The SAR mode is a world-space CAMERA LAYER over the untouched
// screen-space combat stack: the player flies in screen space (full
// parity with all 9 Catships, the Vulcan/Plasma/Rail weapons, rockets,
// ultimates and the shared POWERUP_DROPS pool) while SectorMap.js runs
// the DISPLACEMENT-ACCUMULATOR camera (v4.0.0): the player's screen
// offset is tracked against a dead zone around the screen center, the
// EXCESS delta is accumulated into world coordinates (worldX / worldY)
// and the ship is SOFTLY RECENTERED — the world scrolls fluidly around
// the combat layer. PlayerFlight's velocity / input integration /
// weapon-collision routines are 100% untouched (sovereign).
//
// The sector is a TRUE 2D WORLD GRID: background parallax layers,
// reference planets, debris anchors, hazard anchors and regional patrol
// sites are all anchored to ABSOLUTE world coordinates (deterministic
// seeded layout in SectorMap). The sequenced journey runs left → right
// across the sector: OPEN SPACE → THE BONEYARD (debris field + hazards)
// → DEEP SECTOR, where Eridath's Mom's House (the 512px
// .assets/Eridaths-Moms-House landmark, manifest key
// `eridath_moms_house`) anchors the deep sector as a persistent,
// shootable, enemy-spawning base (the mission objective).
//
// Tunables live HERE (Phase 2 parameter standardization) — the SAR
// modules must not hardcode their own stats.

// ─── SECTOR (world space) ───
// The sector is a large 2D world-space coordinate grid (world px). The
// displacement-accumulator camera (SectorMap.js) scrolls the world as
// the player's screen offset leaves the dead zone; the classic screen
// bounds are disabled (freeBounds) — the world scrolls instead of
// wrapping.
export const SAR = {
  SECTOR: { W: 64000, H: 12000, GRID: 2000 },
  // The player's starting world position (open space, left edge).
  START: { x: 2000, y: 6000 },
  // ─── CAMERA (displacement accumulator, v4.0.0) ───
  //   DEADZONE_X / DEADZONE_Y  dead-zone half-size (× viewW / viewH) —
  //                      the ship flies freely inside the dead zone
  //                      around the screen center; the camera holds.
  //   RECENTER           1/s ease rate of the SOFT RECENTERING — when
  //                      the offset exceeds the dead zone, the excess
  //                      delta is accumulated into worldX / worldY and
  //                      the ship is pulled back toward the center by
  //                      a fraction of the excess per frame (exponential
  //                      ease — no hard clamp, no velocity change;
  //                      PlayerFlight stays sovereign).
  //   CLAMP_MARGIN       camera clamp margin inside the sector bounds
  CAMERA: {
    DEADZONE_X: 0.36,
    DEADZONE_Y: 0.36,
    RECENTER: 4.0,
    CLAMP_MARGIN: 400,
  },
  // ─── WORLD LAYOUT (world-anchored, deterministic — SectorMap) ───
  // Debris / hazards / patrols are anchored to ABSOLUTE world
  // coordinates: the layout is generated once (seeded PRNG, identical
  // every run) and SectorSpawner activates the anchors as the player's
  // WORLD position approaches them (activate = world px radius).
  WORLD: {
    DEBRIS: { count: 90, activate: 900 },    // boneyard bone anchors
    HAZARDS: { count: 28, activate: 800 },   // boneyard hazard anchors
    PATROL: {
      perZone: 14, activate: 1100,           // regional patrol sites
      rearmMin: 15, rearmMax: 25,            // site re-arm cooldown (s)
    },
  },
  // ─── JOURNEY ZONES (left → right across the sector) ───
  // The sequenced journey: the player starts in OPEN SPACE, must navigate
  // through THE BONEYARD (debris field, hazards, regional enemy patrols)
  // and finally reaches the DEEP SECTOR coordinates anchored by Eridath's
  // Mom's House. SectorSpawner.js drives per-zone patrols / debris /
  // hazards from these entries (patrol = regional enemy roster, tiers =
  // spawn tier mix, maxEnemies = live-enemy cap for the zone).
  ZONES: [
    {
      id: 'open', label: 'OPEN SPACE', x0: 0, x1: 22000, maxEnemies: 8,
      patrol: ['wasp', 'butterfly', 'rat', 'moth'], tiers: ['mob'],
    },
    {
      id: 'boneyard', label: 'THE BONEYARD', x0: 22000, x1: 46000, maxEnemies: 12,
      patrol: ['human', 'spider', 'snake', 'alien'], tiers: ['mob', 'champion'],
    },
    {
      id: 'deep', label: 'DEEP SECTOR', x0: 46000, x1: 64000, maxEnemies: 16,
      patrol: ['wolf', 'falcon', 'dragon', 'blackcat', 'pinkcat', 'shuttle'],
      tiers: ['mob', 'champion', 'miniboss'],
    },
  ],
  // ─── ERIDATH'S MOM'S HOUSE (the target base, deep sector) ───
  // A world-anchored, shootable, PERSISTENT enemy-spawning base (the
  // mission objective). SectorCombatManager.js owns its state + the
  // friendly-bullet collision pass + the victory sequence; SectorMap.js
  // renders it (asset key `eridath_moms_house` — the 512×512 native
  // .assets/Eridaths-Moms-House landmark — drawScale 1 = 1:1 crisp).
  HOUSE: {
    x: 60000, y: 3500,       // world position (anchored in the deep sector)
    HP: 2500,                // base hull
    radius: 110,             // screen-space collision radius
    drawScale: 1,            // 512px native asset → 512px world landmark (1:1)
    spawnRange: 1500,        // world px — the base spawns while the player is this close
    spawnMin: 4.5, spawnMax: 8, // seconds between base spawn volleys
    volleyMin: 3, volleyMax: 6, // enemies per base volley
    victoryScore: 50000,     // mission-complete bonus
  },
  // ─── AMBIENT DROPS (SAR power-up cadence, seconds) ───
  // Every zone streams the shared POWERUP_DROPS pool (DropManager) +
  // asteroids, fully off-screen — the classic drop lifecycle is reused.
  DROPS: { min: 6, max: 11, asteroidMin: 3, asteroidMax: 6 },
  // ─── DEEP PARALLAX STARFIELD (SectorMap.js, v4.3.0) ───
  // The multi-layered sector sky. Each star layer is TILED (tile px of
  // layer space, mod-wrapped) so the on-screen density stays constant
  // across the 64 km sector (the v4.0.0 field spread its stars across
  // the whole sector and sampled them at worldX·f — an empty sky). On
  // top of the per-layer parallax factor f (0 = pinned far, 1 = full
  // camera lock), every layer carries its own slow autonomous WIND
  // drift (px/s, layer space) — the sky keeps moving even when the
  // ship holds still. NEBULA adds the mid-depth stellar dust (soft
  // radial-gradient puffs) and TRAILS is the foreground layer: f = 1
  // (full camera lock) + its own drift, streaking OPPOSITE the
  // player's movement vector — streak length = min(maxLen, speed·gain),
  // alpha ∝ speed/speedRef (quiet points while the ship holds still).
  STARFIELD: {
    FAR:    { f: 0.22, tile: 2048, n: 130, size: 1.4, alpha: 0.55, windX: -6,  windY: -3 },
    MID:    { f: 0.5,  tile: 2048, n: 64,  size: 2.0, alpha: 0.45, windX: -11, windY: -6 },
    NEAR:   { f: 0.8,  tile: 2048, n: 44,  size: 2.8, alpha: 0.8,  windX: -18, windY: -9 },
    NEBULA: { f: 0.5,  tile: 4096, n: 10, rMin: 90, rMax: 240, alpha: 0.09, windX: -8, windY: -4 },
    TRAILS: { n: 44, tile: 2048, drift: 34, maxLen: 90, gain: 0.3, speedRef: 320, idle: 0.4 },
  },
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

// Filename: config/player.js
// Kitty Vs Everything — v3.77.0
// E6 modularization (v3.77.0): player ship constants (flight physics, P2,
// hull geometry, minis, themes) split out of js/core/config.js (now the
// compatibility re-export shim — the public surface is unchanged).

// ─── PLAYER FLIGHT PHYSICS (Asteroids-style + mouse-look, v3.5.0) ───
export const PLAYER = {
  ROTATION_SPEED: 3.8,     // rad/s base spin rate — multiplied by SETTINGS.spinSpeedKeyboard
  MOUSE_SENSITIVITY: 0.0035, // v3.7.0: rad per px of mouse movement — × SETTINGS.spinSpeedMouse
  THRUST: 380,
  BOOST_MULT: 2.4,
  BRAKE_MULT: 2.2,         // S-key active brake = BRAKE_MULT × THRUST while moving forward
  DRAG: 1.6,
  MAX_SPEED: 620,
  MOUSE_LOOK_TIMEOUT: 2.5, // seconds of mouse inactivity → mouse-look pauses, heading holds
  STUN_COOLDOWN: 3.0,
  NAPALM_COOLDOWN: 4.0,    // v3.7.0: E/J napalm rockets (high-damage AoE)
  // ─── v3.33.0: FRENZY power-up + hull-repair drop ───
  FRENZY_DURATION: 30,     // seconds of all-cooldowns-off (fire cooldown held
                           // at zero, Vulcan heat/overheat neutralized)
  HEALTH_RESTORE: 25,      // hull HP restored by the 'health' drop (capped at maxHp)
};

// ─── v3.20.0: PLAYER 2 (LAN / local co-op second cat ship) ───
// P2 is a full second cat ship (CatShipFactory.createCatShip) driven by
// Player2Controls (local co-op) or the remote input stream (host). P2
// auto-aims at the nearest enemy (no mouse, no manual rotation) — see
// net/CoopManager.js. Per-player HP / lives / score are tracked on the
// Player instance itself (p.hp / p.lives / p.score).
export const PLAYER2 = {
  spawnOffsetX: 70,        // lateral offset from P1 so the ships don't overlap
  autoAimTurnRate: 4.5,    // rad/s — how fast P2 turns toward the nearest enemy
  hp: 100,                 // P2 hull HP (matches P1 by default)
  shield: 50,              // P2 shield
  lives: 3,                // P2 lives
  weaponDamageMul: 1.0,    // P2 weapon damage scaling
};

// ─── MAIN SHIP SCALE (v3.47.0) ───
// The main cat ship is drawn at 2x the 70px sprite frame. The sprite and the
// hardpoint FX (weapon paws, thruster flames, muzzle) are all scaled together
// via ctx.scale(MAIN_SHIP_SCALE) in PlayerRenderer.draw(), and the gameplay
// hardpoints (bullet spawn, mini docks) are scaled by the same factor in
// PlayerHardpoints.localToWorld — so bullets/docks stay exactly on the art.
export const MAIN_SHIP_SCALE = 2;

// v3.73.0: mini ships render as 0.6× clones of the main ship's RENDERED size:
// 0.6 × MAIN_SHIP_SCALE in the 70px local frame → 84px world-tall (up from the
// old 42px capsule era). Single source of truth shared by PlayerMiniArt (the
// sprite blit) and MiniShip._miniPoint (bullet hardpoints), so the mini's
// drawn guns and its bullet spawns always stay on the art.
export const MINI_SCALE = 0.6 * MAIN_SHIP_SCALE;

// ─── CATSHIP GEOMETRY (local space, nose = -Y, 70px sprite frame) ───
// Single source of truth shared by Player.js (weapon hardpoint math) and
// PlayerRenderer.js (art). Front paws = weapon hardpoints; rear thrusters =
// rocket flames (drawn in the renderer, no bullets spawn from them).
// v3.47.0: rear thrusters recentered onto the rear legs (x≈±4, y≈31 — the two
// legs and the short tail sit close together on the centerline pointing
// straight back); mini docks moved out to ±32 so the 2x hull and the 0.6x
// minis stay clearly separated (no overlap) while remaining locked to the hull.
// v3.73.0: mini docks out to ±36 — the sprite-clone minis are now 52.5px wide
// (world), so the flanks latch just outside the hull body without swallowing it.
export const SHIP_GEOMETRY = {
  frontPawL: { x: -16, y: -28 }, // left front paw  — vulkan / plasma / stun hardpoint
  frontPawR: { x: 16,  y: -28 }, // right front paw — vulkan / plasma / stun hardpoint
  muzzle:    { x: 0,   y: -20 }, // nose muzzle     — rail cannon (snout tip)
  thrusterL: { x: -4,  y: 31 },  // left rear leg   — thruster flame at the rear-leg ankle (no bullets)
  thrusterR: { x: 4,   y: 31 },  // right rear leg  — thruster flame at the rear-leg ankle (no bullets)
  miniDockL: { x: -36, y: 2 },   // left mini dock  — docked mini-ship slot (v3.73.0: ±36 for the 84px sprite clone)
  miniDockR: { x: 36,  y: 2 },   // right mini dock — docked mini-ship slot (v3.73.0: ±36 for the 84px sprite clone)
  // v3.17.0: OVERSIZED weapon barrels — DEFAULT barrel length (local -Y) from
  // the paw hardpoint to the muzzle tip. The art (PlayerShipFx.drawWeaponPaw)
  // draws the barrels this long and bullets spawn at the tip (PlayerHardpoints
  // .getMuzzleTipOffsets). v3.46.0: this is the VULKAN default / fallback; each
  // weapon can override it via WEAPONS[weapon].barrelLen (vulkan 15 / plasma
  // 10 / rail 22). ~15 is well over half the front-arm length (~24).
  barrelLen: 15,
};

// ─── DOCKED MINI-SHIPS (v3.3.0 fleet) ───
// Minis are strict same-color clones of the player's cat ship with their own
// independent HP pool (MiniShip.js, spawned via CatShipFactory.createMiniShip).
// Enemy fire / rams hit docked minis first (Collisions.js); hull-level damage
// is also intercepted by minis (Player.hit). The fleet is cleared when the
// main hull is lost (PlayerFleet.clearFleet).
// v3.9.0: docked minis AUTO-FIRED the player's active weapon profile from
// their dock slot (MiniShip.fireWeapon), dealing damageMul × weapon damage.
// v3.10.0: FULL CLONE GUNS — fireRateMult = 1 (same cadence as the hull)
// and each mini fires the weapon's complete volley (twin vulkan paws /
// alternating plasma paw / rail muzzle) from its own scaled hardpoints:
// 1 docked mini doubles the fleet's projectile stream, 2 minis triple it.
// v3.16.0: FIRE-CONTROL FIX — docked minis are INERT (no fire, no weapon
// animation). The fleet must be DEPLOYED (MiniDeploy.js, 'deployFleet'
// action) to undock into a combat orbit where the minis fire + animate.
export const MINI_SHIP = {
  hp: 60,                  // independent mini HP pool
  maxDocked: 2,            // max mini-ships docked to the fleet
  radius: 24,              // v3.73.0: collision radius (was 11 for the 42px capsule; the 84px sprite clone is 52.5px wide)
  damageBonusPerMini: 0.5, // +50% weapon damage per docked mini (PlayerWeapons)
  synergyChargeTime: 10,   // seconds of color-match synergy to charge the meter to 100% (v3.47.0: key-triggered fire)
  fireRateMult: 1,         // v3.10.0: mini fires on the hull's cadence (weapon.rate × 1) — full clone
  damageMul: 0.5,          // v3.9.0: mini bullets deal 50% of the weapon's base damage
  // v3.16.0: combat orbit (deployed fleet) — radius from hull center and
  // orbit angular speed (rad/s).
  // v3.17.0: DOCKED minis fire IN SYNC with the hull (Player.firedThisFrame)
  // and mirror its weapon animation; DEPLOYED minis orbit + fire on cadence.
  deployRadius: 120,       // v3.73.0: combat-orbit radius (was 70) — clears the 2x hull (70px half-length) + the 84px mini (42px half-length)
  deployOrbitSpeed: 1.8,
};

// Selectable cat ship color themes
export const PLAYER_THEMES = {
  yellow: { name: 'Yellow Tabby',  color: '#ffd54f', accent: '#fff9c4', pattern: 'striped' },
  orange: { name: 'Orange Tabby',  color: '#ff9d3b', accent: '#ffd9a0', pattern: 'striped' },
  white:  { name: 'White Cat',     color: '#f2f2f2', accent: '#ffffff', pattern: 'solid' },
  gray:   { name: 'Gray Cat',      color: '#9e9e9e', accent: '#cfd8dc', pattern: 'spotted' },
  brown:  { name: 'Brown Cat',     color: '#8d6e63', accent: '#bcaaa4', pattern: 'striped' },
  blue:   { name: 'Blue Cat',      color: '#4fc3f7', accent: '#e1f5fe', pattern: 'solid' },
  red:    { name: 'Red Cat',       color: '#ef5350', accent: '#ffcdd2', pattern: 'solid' },
  green:  { name: 'Green Cat',     color: '#66bb6a', accent: '#c8e6c9', pattern: 'solid' },
  black:  { name: 'Black Cat',     color: '#37474f', accent: '#90a4ae', pattern: 'solid' },
};

// v3.72.0 — Catship sprite art (tools/asset-manifest.json → js/core/AssetSprites.js).
// Each theme maps to a transparent PNG of a cat lying on its back (head + ears at
// the center/top, the two long upper extensions = the weapon arms, the two lower
// extensions = the thruster legs). PlayerRenderer blits the sprite in place of the
// procedural hull; the theme's color/accent still drive the cockpit, weapons,
// thrusters, shields and HUD. Themes without a sprite keep the procedural hull.
export const PLAYER_THEME_SPRITES = {
  yellow: 'cat_yellow',
  orange: 'cat_orange',
  white:  'cat_white',
  gray:   'cat_gray',
  brown:  'cat_brown',
  blue:   'cat_blue',
  red:    'cat_red',
  green:  'cat_green',
  black:  'cat_black',
};

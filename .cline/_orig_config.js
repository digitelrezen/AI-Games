// Filename: config.js
// Everything Vs Kitty ΓÇö v3.3.0
// Central configuration: versioning, balance, enemy roster, tiers, weapons, themes,
// and PLAYER flight physics constants.
// v3.1.0: Replaced 8-element system with 3-weapon system (Vulkan / Plasma / Rail).
// v3.2.0: Added SHIP_GEOMETRY (catship hardpoint positions, shared with renderer).
// v3.3.0: SHIP_GEOMETRY now covers the full catship (front paws, muzzle, back-paw
//         thrusters, mini docks); added MINI_SHIP (independent-HP fleet constants).
// v3.4.0: Hardpoints follow the redesigned H-pose hull (PlayerShipArt.js v3.4.0):
//         front paws stretched straight forward (y Γëê -28, level with the ear
//         tips), rear paws straight back from the hips (y Γëê +18), muzzle at
//         the new snout tip. Mini docks UNCHANGED (┬▒26, 2) ΓÇö the new art draws
//         dock cradles exactly on those points.
// v3.5.0: Mouse-look flight ΓÇö ROTATION_SPEED now scales with the user's
//         SETTINGS.spinSpeed (dev-panel slider, see Settings.js); added
//         BRAKE_MULT (S-key active-brake force) and MOUSE_LOOK_TIMEOUT
//         (mouse idle time after which the ship holds its heading so
//         keyboard-only players keep full A/D control).
// v3.6.0: Back-paw thruster hardpoints moved out to the ends of the longer
//         rear legs (┬▒15, 28) ΓÇö the legs now mirror the front-arm geometry
//         along the tail, flanking it (PlayerShipArt.js v3.6.0). Dock
//         cradles are gone: the art draws only floating glow-orb ports at
//         miniDockL/R (minis still snap to exactly those points).
// v3.7.0: MOUSE_SENSITIVITY (delta-based 360┬░ mouse spin, rad/px ├ù
//         SETTINGS.spinSpeed) + NAPALM_COOLDOWN (E/J napalm rockets).
// v3.8.0: Added wasp2 (Wasp2) to the roster ΓÇö black wireframe wasp enemy
//         (Wasp2Enemy.js + Wasp2Sprite.js, art from .assets/Wasp 1 Pixel
//         Art.png). Placed after butterfly so it unlocks from wave 2.
// v3.9.0: MINI_SHIP gained auto-fire tuning (fireRateMult / damageMul) ΓÇö
//         docked minis fire the player's active weapon profile (MiniShip.js).
// v3.10.0: FULL CLONE FIRE ΓÇö fireRateMult = 1 (minis fire on the hull's
//         cadence) and MiniShip.fireWeapon() fires the weapon's COMPLETE
//         volley from the mini's 0.6├ù-scaled paws / muzzle: 1 docked mini
//         doubles the fleet's projectiles, 2 minis triple them ΓÇö like extra
//         ships hooked on. Mini bullets still deal damageMul ├ù weapon damage.
// v3.11.0: ROCKETS (Q/H stun + E/J napalm are now real flying projectiles ΓÇö
//         homing zig-zag stun salvo, straight napalm salvo with FIRE_ZONE
//         lingering napalm pools), ASTEROID destructible chain power-up
//         (large ΓåÆ 2 medium ΓåÆ 4 small ΓåÆ 40% power-up drop), and
//         SETTINGS.screenBounds (dev toggle: bounce vs classic wrap).
//         Boss-tier (special) enemies are now contained to the screen.
// v3.12.0: ViewScaler.js ΓÇö the 1280├ù720 stage auto-fits any window/display
//         (uniform scale, crisp q├ù canvas buffer, never distorted) and the
//         U key toggles browser fullscreen.
export const VERSION = 'v3.12.0';
export const TAU = Math.PI * 2;
export const GAME = { W: 1280, H: 720 };

// ΓöÇΓöÇΓöÇ PLAYER FLIGHT PHYSICS (Asteroids-style + mouse-look, v3.5.0) ΓöÇΓöÇΓöÇ
export const PLAYER = {
  ROTATION_SPEED: 3.8,     // rad/s base spin rate ΓÇö multiplied by SETTINGS.spinSpeed
  MOUSE_SENSITIVITY: 0.0035, // v3.7.0: rad per px of mouse movement ΓÇö ├ù SETTINGS.spinSpeed
  THRUST: 380,
  BOOST_MULT: 2.4,
  BRAKE_MULT: 2.2,         // S-key active brake = BRAKE_MULT ├ù THRUST while moving forward
  DRAG: 1.6,
  MAX_SPEED: 620,
  MOUSE_LOOK_TIMEOUT: 2.5, // seconds of mouse inactivity ΓåÆ mouse-look pauses, heading holds
  STUN_COOLDOWN: 3.0,
  NAPALM_COOLDOWN: 4.0,    // v3.7.0: E/J napalm rockets (high-damage AoE)
};

// ΓöÇΓöÇΓöÇ CATSHIP GEOMETRY (local space, nose = -Y) ΓöÇΓöÇΓöÇ
// Single source of truth shared by Player.js (weapon hardpoint math) and
// PlayerRenderer.js (art). Front paws = weapon hardpoints; back paws =
// thruster rockets (drawn in the renderer, no bullets spawn from them).
export const SHIP_GEOMETRY = {
  frontPawL: { x: -16, y: -28 }, // left front paw  ΓÇö vulkan / plasma / stun hardpoint
  frontPawR: { x: 16,  y: -28 }, // right front paw ΓÇö vulkan / plasma / stun hardpoint
  muzzle:    { x: 0,   y: -20 }, // nose muzzle     ΓÇö rail cannon (snout tip)
  thrusterL: { x: -15, y: 28 },  // left back paw   ΓÇö thruster rocket pod at the rear-leg ankle (no bullets)
  thrusterR: { x: 15,  y: 28 },  // right back paw  ΓÇö thruster rocket pod at the rear-leg ankle (no bullets)
  miniDockL: { x: -26, y: 2 },   // left mini dock  ΓÇö docked mini-ship slot
  miniDockR: { x: 26,  y: 2 },   // right mini dock ΓÇö docked mini-ship slot
};

// ΓöÇΓöÇΓöÇ DOCKED MINI-SHIPS (v3.3.0 fleet) ΓöÇΓöÇΓöÇ
// Minis are strict same-color clones of the player's cat ship with their own
// independent HP pool (MiniShip.js, spawned via CatShipFactory.createMiniShip).
// Enemy fire / rams hit docked minis first (Collisions.js); hull-level damage
// is also intercepted by minis (Player.hit). The fleet is cleared when the
// main hull is lost (PlayerFleet.clearFleet).
// v3.9.0: docked minis AUTO-FIRE the player's active weapon profile from
// their dock slot (MiniShip.fireWeapon), dealing damageMul ├ù weapon damage.
// v3.10.0: FULL CLONE GUNS ΓÇö fireRateMult = 1 (same cadence as the hull)
// and each mini fires the weapon's complete volley (twin vulkan paws /
// alternating plasma paw / rail muzzle) from its own scaled hardpoints:
// 1 docked mini doubles the fleet's projectile stream, 2 minis triple it.
export const MINI_SHIP = {
  hp: 60,                  // independent mini HP pool
  maxDocked: 2,            // max mini-ships docked to the fleet
  radius: 11,              // collision radius (docked, ~0.6├ù the main hull)
  damageBonusPerMini: 0.5, // +50% weapon damage per docked mini (PlayerWeapons)
  synergyChargeTime: 10,   // seconds of color-match synergy per super-weapon
  fireRateMult: 1,         // v3.10.0: mini fires on the hull's cadence (weapon.rate ├ù 1) ΓÇö full clone
  damageMul: 0.5,          // v3.9.0: mini bullets deal 50% of the weapon's base damage
};

// ΓöÇΓöÇΓöÇ v3.11.0: ROCKETS (Q/H stun + E/J napalm ΓÇö real projectiles, Rockets.js) ΓöÇΓöÇΓöÇ
// Twin salvo from the front-paw hardpoints. Stun rockets home with a zig-zag
// weave + smoke trail and burst into the classic 200px shield-strip/stun
// field (no direct damage). Napalm rockets fly straight with a fire trail;
// impact = 200px AoE damage burst (mini-scaled) + a lingering FIRE_ZONE
// pool, and enemies clipped in flight take chip damage + ignite a pool.
export const ROCKETS = {
  speed: 540,             // px/s cruise speed
  life: 2.0,              // self-destruct (detonates) if nothing is hit (s)
  radius: 6,              // collision radius
  turnRate: 3.4,          // stun-rocket homing turn rate (rad/s)
  weave: 0.4,             // stun-rocket zig-zag weave amplitude (rad)
  // STUN ΓÇö AoE field around the impact point
  stunRadius: 200,        // same 200px field as the old instant blast
  stunDuration: 1.0,      // stun on non-special enemies (s)
  stunSuppress: 3.0,      // fire suppression on stunned enemies (s)
  stunColor: '#80d8ff',
  // NAPALM ΓÇö AoE around the impact point + burning ground pools
  napalmRadius: 200,      // same 200px field as the old instant blast
  napalmDamage: 60,       // base AoE damage (├ù mini damage bonus)
  napalmChip: 12,         // direct-hit chip (enemy clipped in flight)
  napalmColor: '#ff6d00',
  igniteChance: 0.75,     // clip hit ΓåÆ fire pool left at the enemy's spot
};

// ΓöÇΓöÇΓöÇ v3.11.0: FIRE ZONE (lingering napalm pools ΓÇö FireZone.js) ΓöÇΓöÇΓöÇ
// Ground pools left by napalm rocket impacts: enemies passing through take
// periodic DoT damage until the pool burns out.
export const FIRE_ZONE = {
  radius: 55,             // pool radius (px)
  duration: 4.0,          // how long the pool burns (s)
  tick: 0.5,              // DoT tick interval (s)
  damage: 8,              // damage per tick to every enemy inside
};

// ΓöÇΓöÇΓöÇ v3.11.0: ASTEROID BONUS (destructible chain ΓÇö AsteroidBonus.js) ΓöÇΓöÇΓöÇ
// A destructible chain power-up that lives in game.powerups: a Large
// asteroid splits into 2 Mediums, each Medium into 4 Small rocks, and every
// destroyed Small rolls a 40% chance to drop a regular power-up.
// Destructible = shot down, never picked up.
export const ASTEROID = {
  chain: [
    { size: 46, hp: 120, splits: 2 }, // large  ΓåÆ 2 mediums
    { size: 28, hp: 50,  splits: 4 }, // medium ΓåÆ 4 smalls
    { size: 15, hp: 14,  splits: 0 }, // small  ΓåÆ power-up drop roll
  ],
  dropChance: 0.4,        // destroyed small ΓåÆ regular power-up drop
  drift: 40,              // base drift speed (px/s), random direction
};

// Selectable cat ship color themes
export const PLAYER_THEMES = {
  yellow: { name: 'Yellow Tabby',  color: '#ffd54f', accent: '#fff9c4', pattern: 'striped' },
  orange: { name: 'Orange Tabby',  color: '#ff9d3b', accent: '#ffd9a0', pattern: 'striped' },
  white:  { name: 'White Cat',     color: '#f2f2f2', accent: '#ffffff', pattern: 'solid' },
  gray:   { name: 'Gray Cat',      color: '#9e9e9e', accent: '#cfd8dc', pattern: 'spotted' },
  brown:  { name: 'Brown Cat',     color: '#8d6e63', accent: '#bcaaa4', pattern: 'striped' },
};

// ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
//  WEAPON SYSTEM ΓÇö 3 distinct weapons for upper-paw hardpoints
// ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
export const WEAPONS = {
  vulkan: {
    name: 'VULKAN CANNON',
    color: '#ff6a00',
    accent: '#ffab40',
    damage: 5,
    speed: 720,
    rate: 0.07,
    pierce: 0,
    tracking: 0.8,
    thermalPerShot: 0.05,
    thermalDecay: 0.35,
    thermalMax: 1.0,
    thermalLockout: 1.2,
    desc: 'High-RoF Gatling ┬╖ Ballistic Tracking ┬╖ Thermal Buildup',
  },
  plasma: {
    name: 'PLASMA PULSE',
    color: '#00e5ff',
    accent: '#80d8ff',
    damage: 22,
    speed: 560,
    rate: 0.24,
    pierce: 0,
    shieldMelt: 15,
    alternating: true,
    desc: 'Burst Damage ┬╖ Alternating Bolts ┬╖ Shield Melt',
  },
  rail: {
    name: 'RAIL CANNON',
    color: '#b388ff',
    accent: '#d1c4e9',
    damage: 100,
    speed: 1500,
    rate: 1.0,
    pierce: 999,
    chargeTime: 0.5,
    desc: 'Piercing Beam ┬╖ Charge Mechanic ┬╖ Massive Impact',
  },
};
export const WEAPON_ORDER = ['vulkan', 'plasma', 'rail'];

// Enemy roster
export const ENEMY_TYPES = {
  wasp:     { name: 'Wasp',         color: '#e8b62c', speed: 2.2, hp: 20, damage: 8,  fireRate: 0.9, pattern: 'weave' },
  beetle:   { name: 'Beetle',       color: '#7a4a21', speed: 1.4, hp: 40, damage: 12, fireRate: 1.4, pattern: 'charge' },
  butterfly:{ name: 'Butterfly',    color: '#c77dff', speed: 2.6, hp: 14, damage: 6,  fireRate: 1.1, pattern: 'flutter' },
  wasp2:    { name: 'Wasp2',        color: '#c8ff3d', speed: 2.9, hp: 16, damage: 9,  fireRate: 0.7, pattern: 'track' },
  rat:      { name: 'Rat',          color: '#8d8d8d', speed: 3.0, hp: 18, damage: 10, fireRate: 0.8, pattern: 'dash' },
  wolf:     { name: 'Wolf',         color: '#9aa5b1', speed: 2.4, hp: 34, damage: 14, fireRate: 1.2, pattern: 'pack' },
  falcon:   { name: 'Falcon',       color: '#b0713a', speed: 3.2, hp: 22, damage: 12, fireRate: 1.0, pattern: 'dive' },
  bat:      { name: 'Bat',          color: '#5d5d7a', speed: 2.8, hp: 16, damage: 8,  fireRate: 0.9, pattern: 'erratic' },
  blackcat: { name: 'Black Cat',    color: '#2b2b3a', speed: 2.0, hp: 28, damage: 16, fireRate: 1.3, pattern: 'teleport' },
  lizard:   { name: 'Lizard',       color: '#4caf50', speed: 1.2, hp: 44, damage: 10, fireRate: 1.5, pattern: 'spit' },
  dragon:   { name: 'Dragon',       color: '#d64545', speed: 1.6, hp: 70, damage: 20, fireRate: 1.8, pattern: 'breath' },
  human:    { name: 'Human Ship',   color: '#3d6fb4', speed: 2.2, hp: 50, damage: 14, fireRate: 1.0, pattern: 'strafe' },
  alien:    { name: 'Alien Ship',   color: '#7b2ff7', speed: 2.5, hp: 46, damage: 16, fireRate: 1.2, pattern: 'phase' },
  snake:    { name: 'Snake',        color: '#66bb6a', speed: 2.0, hp: 30, damage: 12, fireRate: 1.1, pattern: 'sine' },
  spider:   { name: 'Spider',       color: '#4a4a4a', speed: 1.8, hp: 38, damage: 10, fireRate: 0.9, pattern: 'web' },
  pinkcat:  { name: 'Pink Cat',     color: '#ff69b4', speed: 1.8, hp: 60, damage: 18, fireRate: 1.2, pattern: 'fierce' },
};

export const TIERS = {
  mob:       { label: 'Trash Mob',  hpMul: 1,   dmgMul: 1,   speedMul: 1,    score: 100,   shield: 0,   size: 1,    special: false },
  champion:  { label: 'Champion',   hpMul: 3,   dmgMul: 1.5, speedMul: 1.1,  score: 350,   shield: 20,  size: 1.35, special: false },
  miniboss:  { label: 'Mini-Boss',  hpMul: 8,   dmgMul: 2,   speedMul: 1.0,  score: 1000,  shield: 80,  size: 1.8,  special: true },
  boss:      { label: 'Boss',       hpMul: 20,  dmgMul: 2.5, speedMul: 0.9,  score: 3000,  shield: 250, size: 2.6,  special: true },
  finalboss: { label: 'Final Boss', hpMul: 45,  dmgMul: 3,   speedMul: 0.85, score: 10000, shield: 600, size: 3.4,  special: true },
};

export const BONUS = {
  DURATION: 30,
  CRATE_POINTS: 2500,
  BONE_YARD_DURATION: 30,
  BONE_YARD_PHASE1: 10,
  BONE_YARD_PHASE2: 5,
  INTERNET_DURATION: 30,
};
export const LIFE_SCORE_INTERVAL = 30000;

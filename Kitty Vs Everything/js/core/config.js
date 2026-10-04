// Filename: config.js
// Kitty Vs Everything — v3.72.1
// Central configuration: versioning, balance, enemy roster, tiers, weapons, themes,
// and PLAYER flight physics constants.
// v3.70.0: MODULAR WEAPON ARCHITECTURE (Phase 3) — the specialized rockets
//   extracted from js/combat/Rockets.js (now deleted) into
//   js/combat/BaseRocket.js (shared twin-salvo base projectile),
//   js/combat/StunRockets.js (Q/H homing stun rockets) and
//   js/combat/NapalmRockets.js (E/J napalm rockets). ROCKETS / PLAYER
//   cooldown balance unchanged.
// v3.69.0: MODULAR WEAPON ARCHITECTURE (Phase 2) — new js/combat/PulseCannon.js
//   (Plasma Pulse: twin-pod 3-bolt fan + shieldMelt) and js/combat/RailCannon.js
//   (Rail Cannon: piercing beam + charge-up visual); all three primary
//   weapons now live in js/combat via the Player.weapons registry.
//   WEAPONS.plasma / WEAPONS.rail balance unchanged.
// v3.68.0: MODULAR WEAPON ARCHITECTURE (Phase 1) — new js/combat/BaseWeapon.js
//   (abstract base: fire/update/draw/reset + cooldown/ammo/damage/active) and
//   js/combat/VulcanCannon.js (Vulcan Cannon extracted from
//   PlayerWeapons.firePrimary — twin-tip Gatling volley + thermal/overheat).
//   Player owns the p.weapons registry; PlayerWeapons.js delegates to it.
//   WEAPONS.vulkan balance unchanged.
// v3.67.0: Squirrel enemy (19th species) — ENEMY_TYPES.squirrel: a fast,
//   erratic tree-dweller (speed 3.4 / hp 12 / damage 7 / fireRate 0.7 /
//   scurry pattern) rendered from the pixel-art squirrel
//   (`.assets/Squirel pixel_art.png`, key `squirrel`, 580×476 → 128×105)
//   upright (head up, centered mass, bushy tail) with a scurry bounce +
//   twitchy wobble + sprint stretch and a type-color accent glow; classic
//   procedural squirrel kept as null-sprite fallback. WAVE.SPECIES_COUNT
//   18 → 19 (waves wrap after 19 species).
// v3.66.0: Bat pixel-art sprite — the bat enemy (ENEMY_TYPES.bat,
//   unchanged stats: speed 2.8 / hp 16 / damage 8 / erratic pattern) now
//   renders the pixel-art bat from `.assets/Bat-pixel-art.png` via the
//   AssetManager pipeline (key `bat`, 679×367 → 128×69) upright
//   (head/ears up, wings spread) with a wing-beat squash + flutter
//   wobble + hover bob (phase-locked to the procedural flap) and a
//   type-color accent glow; classic procedural bat kept as null-sprite
//   fallback. No config changes — erratic jitter movement and the aimed
//   shot are unchanged.
//
// v3.65.0: Falcon pixel-art sprite — the falcon enemy (ENEMY_TYPES.falcon,
//   unchanged stats: speed 3.2 / hp 22 / damage 12 / dive pattern) now
//   renders the pixel-art falcon from `.assets/Falcon pixel_art.png` via
//   the AssetManager pipeline (key `falcon`, 718×718 → 128×128) with a
//   beak-lead dive rotation (heading eased toward the dive vector, blit
//   rotated by heading + PI/2), wing-beat + hover bob, and a type-color
//   accent glow; classic procedural falcon kept as null-sprite fallback.
//   No config changes — hover/dive movement and the aimed shot are
//   unchanged.
//
// v3.64.0: Dragon pixel-art sprite — the dragon enemy (ENEMY_TYPES.dragon,
//   unchanged stats: speed 1.6 / hp 70 / damage 20 / breath pattern) now
//   renders the pixel-art dragon from `.assets/Dragon-pixel-art.png` via
//   the AssetManager pipeline (key `dragon`, 800×800 → 128×128) with a flight
//   gait + accent glow; classic procedural dragon kept as null-sprite
//   fallback. No config changes — hover weave and the fire-breath cone are
//   unchanged.
//
// v3.63.0: Lizard pixel-art sprite — the lizard enemy (ENEMY_TYPES.lizard,
//   unchanged stats: speed 1.2 / hp 44 / damage 10 / spit pattern) now
//   renders the pixel-art lizard from `.assets/Lizard pixel_art.png` via
//   the AssetManager pipeline (key `lizard`, 507×656 → 99×128) with a tank
//   gait + ground shadow + accent glow; classic procedural lizard kept as
//   null-sprite fallback. No config changes — movement and the 3-way acid
//   spit are unchanged.
//
// v3.62.0: Wolf pixel-art sprite — the wolf enemy (ENEMY_TYPES.wolf,
//   unchanged stats: speed 2.4 / hp 34 / damage 14 / pack pattern) now
//   renders the pixel-art wolf from `.assets/Wolf-pixel-art.png` via the
//   AssetManager pipeline (key `wolf`, 675×708 → 122×128) with a pack-sine
//   gait + ground shadow + accent glow; classic procedural wolf kept as
//   null-sprite fallback. No config changes — movement and aimed shots
//   are unchanged.
//
// v3.61.0: Snake pixel-art sprite — the snake enemy (ENEMY_TYPES.snake,
//   unchanged stats: r 20 / hp 14 / speed 140 / 100 pts) now renders the
//   pixel-art snake from `.assets/snake pixel_art.png` via the AssetManager
//   pipeline (key `snake`, 714×713 → 128×128) with a slither gait + ground
//   shadow + accent glow; classic procedural serpent kept as null-sprite
//   fallback. No config changes — movement and strike attack are unchanged.
//
// v3.60.0: fully destructible Bone Yard — BONUS.BONE_YARD_FIELD seeds the
// stage with 29 destructible bones (10 femur / 10 profile_bone / 6 skull /
// 3 skeleton); BoneFragment.js v2.3.0 adds per-key radius/HP/score bands
// (regular 500 / skull 1000 / skeleton 2000) + a weighted spawn pool
// (40/40/15/5); BoneYardBonus.js v3.16.0 removes the non-shootable
// backdrop (draw() is a no-op hook).
// v3.59.0: double-sized power-up icons — PowerUp.js v3.59.0 renders every
// drop icon at 2× the v3.58.x size (JEWEL_BOX 28 → 56, JEWEL_BUF 40 → 80,
// jewel aura/shimmer/sparkle geometry doubled, robot 28 → 56, crate box
// 28 → 56, all procedural fallbacks doubled) and doubles the pickup
// hitbox (drop 14 → 28, crate 18 → 36). No config changes.
// v3.58.1: release version bump — PowerUp.js v3.58.1 fixes the mini drop,
// which was still drawing the old embedded 28×28 MiniPosterSprite instead
// of the imported "wanted" pixel art (.assets/Wanted-Cat-pixel-art.png,
// 78×128). No config changes.
// v3.58.0: batch power-up pixel-art integration — all five drop types (life /
// health / frenzy / shield / mini) now draw the new pill/poster pixel art
// (Powerup-BluePill-ExtraLife, Powerup-GreanPill-health, Powerup-RedPill-Frenzy,
// Powerup-YellowPill-Shield, Wanted-Cat) through PowerUp.js's 6-pass
// drawJewelDrop() with color-matched additive glows (blue / green / red /
// gold / bounty white-gold) + floating theme-colored sparkle fields; health
// and mini route through the jewel pass, and the buffered-icon blit now runs
// AFTER the depth/shine passes (v3.51.0 pass-order bug fixed). No config
// changes.
// v3.57.0: spider pixel-art sprite swap — SpiderEnemy.js v1.2.0 draws the
// shared PNG (key "spider", 390×532 → 94×128) with crawler gait + a bright
// red hourglass dorsal mark; procedural fallback kept. No config changes.
// v3.56.0: release version bump — player shield ring resized to clear the
// guns (PlayerRenderer.js: SHIELD_BUBBLE_RADIUS 48→60, thinner rim) + Fire
// Control Panel / minimized bar theme blue→yellow (style.css). No config
// changes.
// v3.55.0: crosshair offset range widened to 140–340 logical px
// (Settings.js LIMITS.crosshairOffset, default 140). Release version bump
// only; no config changes.
// v3.54.0: boneyard pixel-art environment — the Bone Yard bonus renders a
// seeded skeleton/skull/femur/profile-bone backdrop (BoneYardBonus.js
// v3.15.0) and BoneFragment.js v2.2.0 draws femur/profile-bone sprites.
// Release version bump only; no config changes.
// v3.53.0: beetle enemy now draws the shared pixel-art sprite (key "beetle",
// Beetle-new-pixel-art.png 665×693 → 123×128) — see BeetleEnemy.js v1.2.0.
// Release version bump only; no config changes.
// v3.52.0: moth enemy — 18th species (key "moth", asset sprite
// Moth-New-pixel-art.png 795×490 → 128×79) with erratic flutter + dart
// behavior (MothEnemy.js). Regular waves only: Bone Yard Phase 2 stays
// standard-humanoid via an explicit allowlist (BoneYardBonus.js).
// v3.51.0: release version bump — PowerUp.js v3.51.0 adds programmatic JEWEL
// SHADING to the frenzy / extra-life / shield drops (drawJewelDrop(): aura →
// base → bevel depth → specular shine → shimmer). No config changes.
// v3.50.0: space shuttle enemy — 17th species (key "shuttle", asset sprite
// Human-SpaceShuttle-pixel-art.png 699×329 → 128×60) with banked-strafe glide
// behavior (ShuttleEnemy.js). Regular waves only: Bone Yard Phase 2 stays
// standard-humanoid via an explicit allowlist (BoneYardBonus.js).
// v3.49.0: butterfly enemy now uses the shared top-down pixel-art sprite
// (key "butterfly") — see ButterflyEnemy.js v1.2.0 for the overhead animation.
// v3.1.0: Replaced 8-element system with 3-weapon system (Vulkan / Plasma / Rail).
// v3.2.0: Added SHIP_GEOMETRY (catship hardpoint positions, shared with renderer).
// v3.3.0: SHIP_GEOMETRY now covers the full catship (front paws, muzzle, back-paw
//         thrusters, mini docks); added MINI_SHIP (independent-HP fleet constants).
// v3.4.0: Hardpoints follow the redesigned H-pose hull (PlayerShipArt.js v3.4.0):
//         front paws stretched straight forward (y ≈ -28, level with the ear
//         tips), rear paws straight back from the hips (y ≈ +18), muzzle at
//         the new snout tip. Mini docks UNCHANGED (±26, 2) — the new art draws
//         dock cradles exactly on those points.
// v3.5.0: Mouse-look flight — ROTATION_SPEED now scales with the user's
//         spin-speed setting (settings-panel slider, see Settings.js); added
//         BRAKE_MULT (S-key active-brake force) and MOUSE_LOOK_TIMEOUT
//         (mouse idle time after which the ship holds its heading so
//         keyboard-only players keep full A/D control).
// v3.6.0: Back-paw thruster hardpoints moved out to the ends of the longer
//         rear legs (±15, 28) — the legs now mirror the front-arm geometry
//         along the tail, flanking it (PlayerShipArt.js v3.6.0). Dock
//         cradles are gone: the art draws only floating glow-orb ports at
//         miniDockL/R (minis still snap to exactly those points).
// v3.7.0: MOUSE_SENSITIVITY (delta-based 360° mouse spin, rad/px ×
//         the mouse spin-speed setting) + NAPALM_COOLDOWN (E/J napalm rockets).
// v3.8.0: Added wasp2 (Wasp2) to the roster — black wireframe wasp enemy
//         (Wasp2Enemy.js + Wasp2Sprite.js, art from .assets/Wasp 1 Pixel
//         Art.png). Placed after butterfly so it unlocks from wave 2.
// v3.9.0: MINI_SHIP gained auto-fire tuning (fireRateMult / damageMul) —
//         docked minis fire the player's active weapon profile (MiniShip.js).
// v3.10.0: FULL CLONE FIRE — fireRateMult = 1 (minis fire on the hull's
//         cadence) and MiniShip.fireWeapon() fires the weapon's COMPLETE
//         volley from the mini's 0.6×-scaled paws / muzzle: 1 docked mini
//         doubles the fleet's projectiles, 2 minis triple them — like extra
//         ships hooked on. Mini bullets still deal damageMul × weapon damage.
// v3.11.0: ROCKETS (Q/H stun + E/J napalm are now real flying projectiles —
//         homing zig-zag stun salvo, straight napalm salvo with FIRE_ZONE
//         lingering napalm pools), ASTEROID destructible chain power-up
//         (large → 2 medium → 4 small → 40% power-up drop), and
//         SETTINGS.screenBounds (dev toggle: bounce vs classic wrap).
//         Boss-tier (special) enemies are now contained to the screen.
// v3.12.0: ViewScaler.js — the 1280×720 stage auto-fits any window/display
//         (uniform scale, crisp q× canvas buffer, never distorted) and the
//         U key toggles browser fullscreen.
// v3.13.0: DYNAMIC VIEWPORT — GAME.W/H is now the native 1280×720
//          REFERENCE only (Viewport.js fit math). Live bounds come from
//          game.viewW/viewH (Game.W/H mirror them), so spawns/bounds
//          track the ultra-wide stage.
// v3.15.0: Internet Bonus Black Cat entourage — gold chain + iced-out
//          real-time clock pendants (BlackCatEntourage.js +
//          RealTimeClock.js). No config values changed.
// v3.18.0: Fire-control dashboard re-laid-out as a 3-column grid — TIME/SPD
//          telemetry left, HULL/SHIELD/mini-HP stack center, weapon select +
//          Q/E/F readiness boxes right (index.html + style.css; no JS changes).
// v3.19.0: Fire-control dashboard re-laid-out — combat console moved into the
//          left column (TIME tucked into its header's top-right corner), SPD
//          readout moved to the far right, mini HP bars now side-by-side under
//          the shield bar (index.html + style.css; no JS changes).
// v3.23.0: Dynamic select-screen keybind footer (MenuKeybinds.js) — the
//          old hardcoded .controls-help block now renders the player's
//          ACTIVE binds from the live KEYBINDS table, showing the standard
//          default set (WSAD / Q / E / R / F / Left Click / Right Click /
//          Esc / M / U / F9) while unmodified and the real keys the moment
//          they're rebound in Settings (live via keybindsChanged).
// v3.27.0: Easter-egg manager (EasterEgg.js) — one slot per egg
//          (game.eggs = { bender, ship }): Bender (robot power-up) +
//          Planet Express ship flyby (dev panel "Drop Ship", ShipSprite.js).
// v3.28.0: 'robot' power-up drop icon is now the TINY FULL-BODY Bender —
//          body + cigar arm re-composited in the original art pose
//          (BenderSprite.getBenderFull(), 293×441 art → 19×28) — instead
//          of the head-only icon (v3.24.0–v3.27.0).
// v3.30.0: 16-species sequential wave system — one species per wave (wraps
//          after 16), active count sawtooth-ramps 20→300 over 12 waves then
//          resets, wave difficulty scales enemy HP + damage (capped after two
//          full species cycles), boss per wave + finalboss every 10, dev-panel
//          spawn-count slider + `count <n>` debug command.
// v3.33.0: FRENZY power-up (PLAYER.FRENZY_DURATION — 30s all-cooldowns-off,
//          Vulcan overheat neutralized) + hull-repair drop
//          (PLAYER.HEALTH_RESTORE). Shared transparent PNG art for the four
//          power-up drops via tools/import-assets.mjs (AssetSprites.js +
//          AssetManager.js).
// v3.42.0: ASTEROID.spawnY (-80) — wave/bonus asteroids now spawn fully
//          off-screen (large rock r=46 clears the top edge) — and the
//          shared POWERUP_DROPS pool + rollPowerUpDrop(): every drop
//          source (enemy kills, wave-clear, asteroid shatter, Internet
//          bonus, crate destruction) samples it, so Health / Frenzy /
//          Shields / Wanted (mini) / Extra Life all appear everywhere.
// v3.46.0: Per-weapon paw barrel lengths (WEAPONS[weapon].barrelLen):
//          Vulcan 15 (twin Gatling), Plasma 10 (twin short pods), Rail 22
//          (single long charge barrel). SHIP_GEOMETRY.barrelLen remains the
//          fallback. Plasma now fires a 3-bolt fan from BOTH front paws
//          (no alternation) — see PlayerWeapons.js / MiniShip.js.
// v3.47.0: Synergy Explosion is key-triggered — MINI_SHIP.synergyChargeTime
//          now charges the meter to 100% (it holds), and the 'synergy' key
//          fires it (PlayerFleet.js). TestAimbot hotkey moved T → F8.
export const VERSION = 'v3.72.1';
export const TAU = Math.PI * 2;
export const GAME = { W: 1280, H: 720 };

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
// Mini ships are NOT affected: they use their own MINI_SCALE (0.6) via
// _miniPoint, so they stay the same size while docking further outboard.
export const MAIN_SHIP_SCALE = 2;

// ─── CATSHIP GEOMETRY (local space, nose = -Y, 70px sprite frame) ───
// Single source of truth shared by Player.js (weapon hardpoint math) and
// PlayerRenderer.js (art). Front paws = weapon hardpoints; rear thrusters =
// rocket flames (drawn in the renderer, no bullets spawn from them).
// v3.47.0: rear thrusters recentered onto the rear legs (x≈±4, y≈31 — the two
// legs and the short tail sit close together on the centerline pointing
// straight back); mini docks moved out to ±32 so the 2x hull and the 0.6x
// minis stay clearly separated (no overlap) while remaining locked to the hull.
export const SHIP_GEOMETRY = {
  frontPawL: { x: -16, y: -28 }, // left front paw  — vulkan / plasma / stun hardpoint
  frontPawR: { x: 16,  y: -28 }, // right front paw — vulkan / plasma / stun hardpoint
  muzzle:    { x: 0,   y: -20 }, // nose muzzle     — rail cannon (snout tip)
  thrusterL: { x: -4,  y: 31 },  // left rear leg   — thruster flame at the rear-leg ankle (no bullets)
  thrusterR: { x: 4,   y: 31 },  // right rear leg  — thruster flame at the rear-leg ankle (no bullets)
  miniDockL: { x: -32, y: 2 },   // left mini dock  — docked mini-ship slot (outboard of the 2x hull)
  miniDockR: { x: 32,  y: 2 },   // right mini dock — docked mini-ship slot (outboard of the 2x hull)
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
  radius: 11,              // collision radius (docked, ~0.6× the main hull)
  damageBonusPerMini: 0.5, // +50% weapon damage per docked mini (PlayerWeapons)
  synergyChargeTime: 10,   // seconds of color-match synergy to charge the meter to 100% (v3.47.0: key-triggered fire)
  fireRateMult: 1,         // v3.10.0: mini fires on the hull's cadence (weapon.rate × 1) — full clone
  damageMul: 0.5,          // v3.9.0: mini bullets deal 50% of the weapon's base damage
  // v3.16.0: combat orbit (deployed fleet) — radius from hull center and
  // orbit angular speed (rad/s).
  // v3.17.0: DOCKED minis fire IN SYNC with the hull (Player.firedThisFrame)
  // and mirror its weapon animation; DEPLOYED minis orbit + fire on cadence.
  deployRadius: 70,
  deployOrbitSpeed: 1.8,
};

// ─── v3.11.0: ROCKETS (Q/H stun + E/J napalm — real projectiles) ───
// v3.70.0: the rocket logic now lives in js/combat/StunRockets.js +
// js/combat/NapalmRockets.js (both extend js/combat/BaseRocket.js).
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
  // STUN — AoE field around the impact point
  stunRadius: 200,        // same 200px field as the old instant blast
  stunDuration: 1.0,      // stun on non-special enemies (s)
  stunSuppress: 3.0,      // fire suppression on stunned enemies (s)
  stunColor: '#80d8ff',
  // NAPALM — AoE around the impact point + burning ground pools
  napalmRadius: 200,      // same 200px field as the old instant blast
  napalmDamage: 60,       // base AoE damage (× mini damage bonus)
  napalmChip: 12,         // direct-hit chip (enemy clipped in flight)
  napalmColor: '#ff6d00',
  igniteChance: 0.75,     // clip hit → fire pool left at the enemy's spot
};

// ─── v3.11.0: FIRE ZONE (lingering napalm pools — FireZone.js) ───
// Ground pools left by napalm rocket impacts: enemies passing through take
// periodic DoT damage until the pool burns out.
export const FIRE_ZONE = {
  radius: 55,             // pool radius (px)
  duration: 4.0,          // how long the pool burns (s)
  tick: 0.5,              // DoT tick interval (s)
  damage: 8,              // damage per tick to every enemy inside
};

// ─── v3.11.0: ASTEROID BONUS (destructible chain — AsteroidBonus.js) ───
// A destructible chain power-up that lives in game.powerups. v3.22.0: the
// rock is the pixel-art asset from .assets/Asteroid pixel_art_small.png
// (sprite pipeline in AsteroidSprite.js). A Large asteroid shatters into
// 2 Medium fragments + 2 smaller Small shards, each Medium into 4 Small
// rocks, and every destroyed Small rolls a 40% chance to drop a regular
// power-up. Fragments are drawn from jagged shard sub-sprites of the rock.
// Destructible = shot down, never picked up.
export const ASTEROID = {
  chain: [
    { size: 46, hp: 120, splits: 2, smallShards: 2 }, // large  → 2 mediums + 2 small shards
    { size: 28, hp: 50,  splits: 4, smallShards: 0 }, // medium → 4 smalls
    { size: 15, hp: 14,  splits: 0, smallShards: 0 }, // small  → power-up drop roll
  ],
  dropChance: 0.4,        // destroyed small → regular power-up drop
  drift: 40,              // base drift speed (px/s), random direction
  spawnY: -80,            // v3.42.0: wave-spawn Y — large rock (r=46) fully above the viewport
};

// ─── v3.42.0: SHARED POWER-UP DROP POOL (every drop source samples it) ───
// The five core drops — Health, Frenzy, Shields, Wanted (the mini "Adopt
// Me!" poster), Extra Life — plus the rare Bender (robot) and the score
// crate. Enemy kills (Combat.maybeDrop), wave-clear drops (WaveManager),
// asteroid shatter (AsteroidBonus), the Internet bonus (InternetBonus) and
// crate destruction (Game.destroyCrate) all roll this one table, so no
// source is ever missing a core drop. Asteroids are NOT in the pool: they
// spawn fully off-screen from the wave spawner only (ASTEROID.spawnY).
export const POWERUP_DROPS = {
  health: 0.12,  // hull repair (PLAYER.HEALTH_RESTORE)
  frenzy: 0.08,  // 30s all-cooldowns-off
  shield: 0.16,  // shield restore
  mini:   0.10,  // "Wanted" poster → mini-ship
  life:   0.08,  // extra life
  robot:  0.04,  // Bender easter egg
  crate:  0.42,  // score crate (destructible — drops again)
};

/** v3.42.0: weighted roll over POWERUP_DROPS (weights sum to 1). */
export function rollPowerUpDrop() {
  let r = Math.random();
  for (const [type, w] of Object.entries(POWERUP_DROPS)) {
    if (r < w) return type;
    r -= w;
  }
  return 'crate';
}

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

// ═══════════════════════════════════════════════════════════
//  WEAPON SYSTEM — 3 distinct weapons for upper-paw hardpoints
// ═══════════════════════════════════════════════════════════
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
    // v3.46.0: per-weapon paw barrel length (local -Y) — twin Gatling barrels
    barrelLen: 15,
    desc: 'High-RoF Gatling · Ballistic Tracking · Thermal Buildup',
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
    // v3.46.0: per-weapon paw barrel length (local -Y) — short emitter pods
    barrelLen: 10,
    desc: 'Twin-Pod Burst · 3 Bolts/Paw · Shield Melt',
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
    // v3.46.0: per-weapon paw barrel length (local -Y) — single long barrel
    barrelLen: 22,
    desc: 'Piercing Beam · Charge Mechanic · Massive Impact',
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
  human:    { name: 'Human',        color: '#3d6fb4', speed: 2.2, hp: 50, damage: 14, fireRate: 1.0, pattern: 'strafe' },
  alien:    { name: 'Alien Ship',   color: '#7b2ff7', speed: 2.5, hp: 46, damage: 16, fireRate: 1.2, pattern: 'phase' },
  snake:    { name: 'Snake',        color: '#66bb6a', speed: 2.0, hp: 30, damage: 12, fireRate: 1.1, pattern: 'sine' },
  spider:   { name: 'Spider',       color: '#4a4a4a', speed: 1.8, hp: 38, damage: 10, fireRate: 0.9, pattern: 'web' },
  pinkcat:  { name: 'Pink Cat',     color: '#ff69b4', speed: 1.8, hp: 60, damage: 18, fireRate: 1.2, pattern: 'fierce' },
  shuttle:  { name: 'Space Shuttle', color: '#cfd8dc', speed: 2.0, hp: 60, damage: 16, fireRate: 1.4, pattern: 'glide' },
  moth:     { name: 'Moth',           color: '#d8c8a0', speed: 2.4, hp: 16, damage: 8,  fireRate: 1.0, pattern: 'erratic' },
  squirrel: { name: 'Squirrel',       color: '#a5622d', speed: 3.4, hp: 12, damage: 7,  fireRate: 0.7, pattern: 'scurry' },
};

export const TIERS = {
  mob:       { label: 'Trash Mob',  hpMul: 1,   dmgMul: 1,   speedMul: 1,    score: 100,   shield: 0,   size: 1,    special: false },
  champion:  { label: 'Champion',   hpMul: 3,   dmgMul: 1.5, speedMul: 1.1,  score: 350,   shield: 20,  size: 1.35, special: false },
  miniboss:  { label: 'Mini-Boss',  hpMul: 8,   dmgMul: 2,   speedMul: 1.0,  score: 1000,  shield: 80,  size: 1.8,  special: true },
  boss:      { label: 'Boss',       hpMul: 20,  dmgMul: 2.5, speedMul: 0.9,  score: 3000,  shield: 250, size: 2.6,  special: true },
  finalboss: { label: 'Final Boss', hpMul: 45,  dmgMul: 3,   speedMul: 0.85, score: 10000, shield: 600, size: 3.4,  special: true },
};

// ─── v3.30.0: 16-species sequential wave system ───
// v3.50.0: roster grew to 17 species (shuttle) — SPECIES_COUNT tracks it.
// v3.52.0: roster grew to 18 species (moth).
// v3.67.0: roster grew to 19 species (squirrel).
// One species per wave (wraps after 19, order = ENEMY_TYPES insertion order).
// Active enemy count sawtooth-ramps COUNT_MIN→COUNT_MAX over COUNT_RAMP_WAVES
// then resets. Wave difficulty scales enemy HP + damage only, +DIFF_PER_WAVE
// per wave, capped after DIFF_CAP_CYCLES full species cycles (hard cap
// DIFF_CAP). Each wave spawns 1 boss of the active species (finalboss every
// 10 waves) + lower-tier same-species fill (TIER_MIX). spawnOverride > 0
// (dev-panel slider / `count <n>` debug command) pins the active count.
export const WAVE = {
  SPECIES_COUNT: 19,
  COUNT_MIN: 20,
  COUNT_MAX: 300,
  COUNT_RAMP_WAVES: 12,
  DIFF_PER_WAVE: 0.06,
  DIFF_CAP_CYCLES: 2,
  DIFF_CAP: 3.0,
  TIER_MIX: { mob: 0.82, champion: 0.12, miniboss: 0.06 },
  SPAWN_DELAY_MIN: 0.35,
  SPAWN_DELAY_MAX: 1.1,
  BOSS_DELAY: 2.5,
};

export const BONUS = {
  DURATION: 30,
  CRATE_POINTS: 2500,
  BONE_YARD_DURATION: 30,
  BONE_YARD_PHASE1: 10,
  BONE_YARD_PHASE2: 5,
  // v3.60.0: the destructible yard field — 29 bones seeded at stage start
  // (BoneYardBonus._seedYardField). Regular bones dominate; the skeleton
  // sentinels hug the left/right margins.
  BONE_YARD_FIELD: { femur: 10, profile_bone: 10, skull: 6, skeleton: 3 },
  INTERNET_DURATION: 30,
};
export const LIFE_SCORE_INTERVAL = 30000;
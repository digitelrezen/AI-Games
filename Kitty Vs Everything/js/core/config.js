// Filename: config.js
// Kitty Vs Everything — v4.3.0
// Central configuration: versioning, balance, enemy roster, tiers, weapons, themes,
// and PLAYER flight physics constants.
// v4.0.0: SEARCH & DESTROY — the sector-journey mode (js/modes/
//          SearchAndDestroy/, E6 nested modules) stamps 4.0.0: the
//          DISPLACEMENT-ACCUMULATOR camera (SectorMap) replaces the
//          v3.99.0 pan+rotation model — the player's screen offset is
//          tracked against a dead zone (CAMERA.DEADZONE_X/Y), the
//          EXCESS delta is accumulated into world coordinates
//          (worldX/worldY) and the ship is softly recentered
//          (CAMERA.RECENTER) — the world scrolls fluidly around the
//          untouched screen-space combat layer (PlayerFlight stays
//          sovereign). Debris, hazards and regional enemy patrols are
//          WORLD-ANCHORED at absolute world coordinates (the
//          deterministic SectorMap layout — SAR.WORLD); the journey
//          runs OPEN SPACE → THE BONEYARD → DEEP SECTOR, where
//          Eridath's Mom's House (the 512px .assets/Eridaths-Moms-
//          House landmark) anchors the deep sector as a persistent,
//          shootable base. Milestone version synced across
//          package.json, config.js, main.js, Game.js, HUD.js and
//          index.html.
// v3.97.0: HAZARDS — new independent game module (js/hazards/): 10
//          non-lootable, shootable environmental obstacles (BioBarrel,
//          BioBomb, ClusterBomb, DepletedShell, FireBarrel, FireMine,
//          MagnetMine, Nuke, NukeBarrel, ProxMine) that drift in from any
//          edge on their own spawner (HazardManager) — separate from enemy
//          waves, power-ups and easter eggs — and detonate a per-type
//          explosion when shot, on proximity, or on contact (ZERO loot:
//          the hazards module never touches the DropManager). Tunables:
//          HAZARD_TYPES + HAZARD in js/core/config/hazards.js.
// v3.83.0: DROP POLICY + OFF-SCREEN KILL GATE — DROP_RARITY is gone:
//          every normal drop source (mob / asteroid / crate / boss) rolls
//          DROP_POLICY (chance + max drops) through js/core/DropManager.js,
//          which only drops from ON-SCREEN sources; EnemyBase.applyDamage
//          takes no damage while the enemy is fully off-screen (kills +
//          drops are always visible); guaranteed special-ship drops
//          (shuttle mini, flyby robot, Spaceballs One chest) bypass it.
// v3.82.0: SHUTTLE ROUND-TRIP FLYBY — the shuttle (species #17) now spawns
//          off-screen right, flies left, flips fully off-screen (sprite
//          mirrors), returns right, and loops until destroyed (EnemyBase
//          noEscape flag exempts it from the 80px off-screen cull);
//          SPACEBALLS ONE one-way flyby flipped to bottom-right → top-left
//          (spawns off-screen bottom-right, despawns off-screen top-left).
// v3.80.0: DROP RARITY OVERHAUL — POWERUP_DROPS (config/drops.js) is now a
//          rarity ladder (robot SUPER RARE 1%) + new DROP_RARITY per-source
//          drop chances (enemy 8% / special 50%); both ships enter/exit
//          every level + constant asteroids + occasional crates
//          (WaveManager.js).
// v3.78.0: A/D CONTROL MODE — Settings.controlMode ('strafe' default / 'spin'
//          classic; PlayerFlight.js + config/player.js STRAFE_THRUST_MULT);
//          the redundant fire-control pause button is removed (Esc / P / the
//          pause overlay handle pausing).
// v3.77.0: PHASE 4 MODULARIZATION LOCK-IN — the 4-phase modular refactor is
//          complete (v3.74.0 player variants + bosses, v3.75.0 enemy sprite
//          isolation, v3.76.0 LevelRegistry stage flow). Milestone version
//          synced across package.json, config.js, main.js, HUD.js and
//          index.html; ARCHITECTURE.md / ARCHITECTURE_INDEX.txt restructured
//          to the modular tree; check.mjs [6aa] version-sync gate.
//          + SHUTTLE WAVE EVENT: every destroyed Space Shuttle (species #17
//          in ENEMY_TYPES — waves 17/36/55/...) releases a GUARANTEED
//          mini-ship power-up at the kill point (SHUTTLE_DROP below;
//          Combat.maybeDrop special case; check.mjs [6ab] lifecycle gate).
// v3.75.0: ENEMY SPRITE ISOLATION (Phase 2) — standard enemy sprite/art
//          pipelines now live in js/enemies/sprites/ (Wasp2Sprite.js moved
//          there; Wasp2Enemy.js imports it from ./sprites/). Boss art +
//          behavior stay together in js/bosses/ (Phase 1 boundary). Enemy
//          behavior modules in js/enemies/ remain pure AI/movement/health/
//          combat — all tunable stats (speed, hp, damage, fireRate) come
//          from ENEMY_TYPES below and score from TIERS, assigned once in
//          EnemyBase (no per-species stat overrides).
// v3.73.0: MINI SHIP SPRITE CLONES — minis now blit the theme's Catship sprite
//          at MINI_SCALE (0.6 × MAIN_SHIP_SCALE = 84px world-tall, up from the
//          old 42px): new MINI_SCALE export (single source of truth for
//          PlayerMiniArt + MiniShip bullet hardpoints), mini docks out to ±36,
//          MINI_SHIP.radius 11 → 24 and deployRadius 70 → 120 to match the
//          bigger clone.
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
// v3.96.0: the 'synergy' key is now FLEET ORBIT (MiniDeploy.toggleFleetOrbit);
//          synergyChargeTime still drives the HUD color-match meter.
// v3.77.0: E6 MODULARIZATION — the config constants/functions moved into
//          js/core/config/ submodules (viewport / player / weapons /
//          enemies / drops / stages). This file is now the compatibility
//          re-export shim: the public surface (all 24 named exports) is
//          unchanged, so every importer keeps working untouched.
// v3.79.0: DOCK ARC COUPLER UPGRADE — the docked mini's arc coupler is now a
//          procedural pulsing plasma arc (drawDockArc moved to
//          PlayerShipFx.js + re-exported from PlayerMiniArt.js):
//          midpoint-displacement crackle, Math.sin energy pulse (core line
//          width 1.5→3px, alpha swell) and cyan/blue canvas shadow glow.
//          Milestone version synced across package.json, config.js, main.js,
//          Game.js, HUD.js and index.html.
// v3.81.0: SPACEBALLS ONE — the rare unstoppable easter-egg ship
//          (js/modes/EasterEggs/SpaceballsOne/): per-wave spawn roll in
//          WaveManager.startNext, diagonal top-right → bottom-left sweep
//          that obliterates everything in its path, brake-light bolt stream
//          at the player, and a treasure-chest jackpot (one of EVERY
//          POWERUP_DROPS type) on destruction. Milestone version synced
//          across package.json, config.js, main.js, Game.js, HUD.js and
//          index.html.
// v3.84.0: TELEGRAPHED ENEMY ATTACKS + ON-DEATH HAZARDS — per-species
//          ENEMY_ATTACK / ENEMY_HAZARD opt-ins (config/enemies.js) drive
//          telegraphed enemy attacks (EnemyAttackModule.js) and on-death
//          hazards (EnemyHazard.js) for standard enemies (EnemyBase).
// v3.88.0: GLOBAL CRISP PIXEL-ART RENDERING — style.css forces
//          image-rendering: pixelated/crisp-edges on all canvas/.pixel-
//          art/img elements; utils.disableImageSmoothing() (standard +
//          vendor-prefixed fallbacks) is applied at every 2D context
//          initialization (Game.js, ViewScaler.js after each buffer
//          resize, main.js hangar canvas, AssetManager.js sprite cache,
//          PowerUp.js jewel buffer). Milestone version synced across
//          package.json, config.js, main.js, Game.js, HUD.js and
//          index.html. (REVERTED in v3.88.1 — see below.)
// v3.88.1: CRISP PASS ISOLATION — the v3.88.0 global CSS rule pixelated
//          the hangar hero preview and UI, so image-rendering is now
//          scoped strictly to #game-canvas (style.css) and the hangar
//          hero canvas keeps default bilinear smoothing; crisp
//          nearest-neighbor rendering stays on the main gameplay canvas
//          (Game.js init + ViewScaler.js re-apply after each buffer
//          resize) and the offscreen sprite buffers (AssetManager.js,
//          PowerUp.js). Milestone version synced across package.json,
//          config.js, main.js, Game.js, HUD.js and index.html.
// v3.90.0: CRISP 256×384 NATIVE CATSHIP HANGAR — the 9 catship assets
//          are now the native 256×384 PNGs (tools/import-assets.mjs
//          MAX_DIM 128 → 512, so the art embeds untouched — no
//          downscale, no blur) and the hangar hero stage is sized to
//          the native frame (320×384 CSS px, buffer ×DPR). The v3.89.0
//          1:1 integer mapping is preserved (HANGAR_K = max(1,
//          round(DPR)) — one native pixel = one CSS pixel, 2×2 blocks at
//          DPR 2); each ship's content box is blitted at the identical
//          scale, centered on the FIXED stage midpoint (160, 192) —
//          completely stationary (no bounce), razor-sharp. Menu CSS
//          compacted to fit the taller hero stage in the 720px stage.
//          Milestone version synced across package.json, config.js,
//          main.js, Game.js, HUD.js and index.html.
// v3.89.0: CRISP HANGAR PREVIEW (1:1 INTEGER MAPPING) — the hangar
//          carousel hero canvas (main.js) returns to nearest-neighbor,
//          but correctly: each cat sprite's CONTENT box (alpha bbox,
//          measured once per ship and cached in hangarMetrics) is
//          blitted at the integer HANGAR_K scale where one native pixel
//          = one CSS pixel (2×2 blocks at DPR 2), content-centered on
//          the shared stage center (160, 110) — one scale, one bounding
//          box, one center for all 9 ships (White Cat reference); no
//          bilinear blur, no non-integer jaggedness. style.css scopes
//          image-rendering: pixelated/crisp-edges to #game-canvas +
//          #hangar-canvas. Milestone version synced across package.json,
//          config.js, main.js, Game.js, HUD.js and index.html.
// v4.7.0: RnM SHIP DIALOGUE + SPAWN-RATE BOOST — the RnM interceptor's
//          generic "RnM SHIP INTERCEPTOR INBOUND" spawn banner is gone:
//          the ship plays a sequential on-screen Rick & Morty dialogue
//          (RnMShip.js RNMSHIP_DIALOGUE, #alert-banner 'dialogue' style)
//          as it crosses into view, and the spawn roll is significantly
//          boosted (RNMSHIP.spawnChance 0.19, 8–15 s roll windows, 8 s
//          first roll, 5 per mission) in BOTH classic + Search & Destroy
//          modes. Destruction still drops the GUARANTEED Frenzy power-up.
//          Milestone version synced across package.json, config.js,
//          main.js, Game.js, HUD.js and index.html.
// v4.12.0: SPACE SNAKE PRE-WAVE + TANK EGG SHIPS — no config changes
//          (the milestone is the RnM encounter: the Space Snake pre-wave
//          enemy type 'spacesnake' lives in config/enemies.js —
//          .assets/SpaceSnake-256x256.png, easter-egg-only, filtered out
//          of the regular wave species by WaveManager.js — and the
//          encounter tuning lives in RnMShip.js RNMSHIP (preWaveCount /
//          preWaveDelay / hp 2400 / dialogueShieldMul) + EasterEgg.js
//          (spawnRnMPreWave / rnmsShipDelay / SHIP_EGG_HP 1200)).
//          Milestone version synced across package.json, config.js,
//          main.js, Game.js, HUD.js and index.html.
// v4.11.0: AUDIO SUITE POLISH + ADMIN JUKEBOX — no config changes
//          (the milestone is the js/core/audio/ suite: dedicated weapon
//          SFX, zero-silent-trigger action SFX, SFX-bus soft-clip shaper
//          + bounded voice pool, rebuilt explosion tail, and the
//          MusicScheduler jukebox preview session powering the DevPanel
//          Music Jukebox). Milestone version synced across package.json,
//          config.js, main.js, Game.js, HUD.js and index.html.
// v4.13.0: WEAPON SFX BALANCE + VULCAN REDESIGN — no config changes
//          (the milestone is the js/core/audio/ suite: the primary-weapon
//          master bus WEAPON_BUS_GAIN 0.65 in SoundEffects.js and the
//          rebuilt vulkanShot() dual-layer mechanical snap). Milestone
//          version synced across package.json, config.js, main.js,
//          Game.js, HUD.js and index.html.
export const VERSION = 'v4.23.0';
export { TAU, GAME } from './config/viewport.js';
export { PLAYER, PLAYER2, MAIN_SHIP_SCALE, MINI_SCALE, SHIP_GEOMETRY, MINI_SHIP, PLAYER_THEMES, PLAYER_THEME_SPRITES } from './config/player.js';
export { WEAPONS, WEAPON_ORDER, ROCKETS, FIRE_ZONE } from './config/weapons.js';
export { ENEMY_TYPES, TIERS, WAVE, ENEMY_ATTACK, ENEMY_HAZARD } from './config/enemies.js';
export { ASTEROID, POWERUP_DROPS, rollPowerUpDrop, SHUTTLE_DROP, DROP_POLICY } from './config/drops.js';
export { BONUS, LIFE_SCORE_INTERVAL } from './config/stages.js';
export { HAZARD_TYPES, HAZARD, rollHazardType } from './config/hazards.js'; // v3.97.0
export { SAR, sarProgress, sarZoneFor } from './config/searchDestroy.js'; // v3.99.0: Search & Destroy mode

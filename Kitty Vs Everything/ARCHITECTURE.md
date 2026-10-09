# Kitty Vs Everything — Architecture Roadmap / File Index

> **Workspace:** `C:\Dev\AI-GAMES\Kitty Vs Everything`
> **Generated:** 2026-10-08 (v4.0.0 SEARCH & DESTROY — the sector-journey mode in `js/modes/SearchAndDestroy/` (E6 nested modules) reworked onto the DISPLACEMENT-ACCUMULATOR camera: the player flies in screen space (PlayerFlight stays sovereign), the ship's screen offset is tracked against a dead zone, the excess delta is accumulated into world coordinates (`worldX`/`worldY`) and the ship is softly recentered — the world scrolls fluidly around the untouched classic combat stack. Debris, hazards and regional patrols are WORLD-ANCHORED at absolute world coordinates (deterministic seeded layout); the journey runs OPEN SPACE → THE BONEYARD → DEEP SECTOR, where Eridath's Mom's House (the 512px `.assets/Eridaths-Moms-House` landmark) anchors the deep sector as a persistent, shootable, enemy-spawning base — destroying it wins the mission. Milestone version synced across package.json / config.js / main.js / Game.js / HUD.js / index.html, check.mjs [6aa] version-sync gate + [6aj] SAR gate, these docs updated, final single-file build. v3.77.0 Phase 4 modularization lock-in remains the structural baseline: **v3.74.0 Phase 1** moved the player cat variants to `js/player/variants/` and the bosses to `js/bosses/`; **v3.75.0 Phase 2** isolated standard enemy sprite pipelines into `js/enemies/sprites/` and standardized enemy stats through `ENEMY_TYPES`/`TIERS`; **v3.76.0 Phase 3** made stage flow data-driven via `js/levels/LevelRegistry.js`; **v3.77.0 Phase 4** locked it in — the E6 modularization (domain config split into `js/core/config/`, `config.js` becomes a compatibility re-export shim, and the Game.js orchestrator logic split into `js/core/game/` — `Game.js` becomes a thin public shell with preserved source-level gate pins).)
> **Layout:** ~138 files — 115 ES modules in `js/` across 9 top-level subfolders (`core` + `config/` + `game/`, `player` + `variants`, `combat`, `enemies` + `sprites`, `bosses`, `levels`, `hazards`, `input`, `ui`) + `modes/` (5 SAR modules, v3.99.0→v4.0.0), 14 in `net/` (11 modules + 3 E6 data files), plus the root app shell (index.html, style.css, build.mjs, package.json); `npm run build` (build.mjs) inlines every module into a single self-contained `Kitty Vs Everything <version>.html` in `C:\Dev\AI-GAMES\Builds\`
> **Stack:** Native ES modules, Canvas 2D, WebAudio, plain DOM, `ws` (LAN relay, Node-only)
> **Run:** `python -m http.server 8000` → http://localhost:8000  ·  LAN: `npm run lan`

## Directory Map (modular tree since v3.74.0–v3.77.0)

```
Kitty Vs Everything/
├── index.html · style.css · build.mjs · package.json   app shell + build + version
├── js/
│   ├── core/         32   entry + orchestrator + infrastructure (main, Game, WaveManager, assets, audio, FX)
│   │   ├── config/    8   domain config submodules (viewport, player, weapons, enemies, drops, stages, hazards, searchDestroy)
│   │   └── game/      4   Game.js submodules (StageFlow, DisplayPolicy, GameOver, Gameplay)
│   ├── player/        9   player ship (Player, PlayerFlight, PlayerWeapons, PlayerRenderer, art/FX)
│   │   └── variants/  5   cat-ship variants (yellow / orange / white / grey / brown)
│   ├── combat/       18   weapons, projectiles, collisions, fleet (CatShipFactory, MiniShip, cannons, rockets)
│   ├── enemies/      19   enemy species AI (EnemyBase, EnemyFactory, 17 species)
│   │   └── sprites/   1   enemy sprite pipeline (Wasp2Sprite)
│   ├── bosses/        6   boss art + behavior (Black Cat, Pink Cat)
│   ├── levels/        9   stage flow + bonus levels (LevelRegistry, BonusLevel, BoneYard, Internet, asteroids)
│   ├── hazards/       3   hazard field (v3.97.0: HazardBase, HazardFactory, HazardManager — 10 non-lootable obstacles)
│   ├── modes/         5   SEARCH & DESTROY sector journey (v3.99.0→v4.0.0: index, SectorMap, SectorSpawner, SectorCombatManager, RadarManager)
│   ├── input/         3   input (InputManager, Keybinds, MenuKeybinds)
│   └── ui/           11   HUD / panels / settings (HUD, HUDFireControl, DevPanel, SettingsScreen, …)
└── net/             11   LAN co-op modules + net/data/ (3 E6 files)
```

## Dependency Flow (top → bottom)

```
index.html ─▶ js/core/main.js ─▶ js/core/Game.js (thin public shell / orchestrator)
Game.js ─▶ js/core/game/ (StageFlow / DisplayPolicy / GameOver / Gameplay — v3.77.0)
        ─▶ LevelRegistry (STAGE_SEQUENCE + BONUS_STAGES — v3.76.0)
        ─▶ WaveManager (combat stage: completion signal) ─▶ EnemyFactory ─▶ EnemyBase ─▶ 17 species (+ sprites/)
        ─▶ HazardManager (independent hazard field — v3.97.0) ─▶ HazardFactory ─▶ HazardBase
        ─▶ SearchAndDestroy (js/modes/ — v3.99.0/v4.0.0 SAR mode) ─▶ SectorMap (displacement-accumulator camera)
                                                           ─▶ SectorSpawner (world-anchored spawners) ─▶ SectorCombatManager (house base) ─▶ RadarManager (F1 cockpit radar)
        ─▶ BonusLevel (adapter) ─▶ BoneYardBonus / InternetBonus
        ─▶ InternetBonus ─▶ BlackCatEntourage / RealTimeClock ─▶ js/bosses (Black Cat / Pink Cat)
        ─▶ CatShipFactory ─▶ Player ─▶ js/player/variants (5 cat variants)
        ─▶ PlayerWeapons ─▶ js/combat (Vulcan / Pulse / Rail / rockets / SuperNova / MiniShip)
        ─▶ js/ui (HUD / DevPanel / Leaderboard — DOM)
        ─▶ js/input (InputManager) · js/core (AudioSystem / ParticleSystem / Starfield)
```

**Foundation:** `js/core/config.js` (re-export shim over `js/core/config/` — v3.77.0), `js/core/utils.js`, `js/core/EventBus.js`, `js/core/Entity.js` (imported by nearly every other file)

## 1. Entry & App Shell (root + js/core/main.js)

- **index.html** — App shell: canvas, main menu (ship-select row GENERATED by main.js from `PLAYER_THEMES` — all 9 themes), game-over + leaderboard lists, touch UI, HUD DOM; loads `js/core/main.js` as the ES-module entry point. v3.77.0: tab title carries the milestone version.
- **style.css** — All styling: layout, menu cards, HUD bars, touch-button colors, and the `.hidden` utility class.
- **build.mjs** — Single-file build script: esbuild bundles `js/core/main.js` + the whole module graph into one IIFE, inlines style.css, splices into index.html → `C:\Dev\AI-GAMES\Builds\Kitty Vs Everything <version>.html`. The version is read from package.json (source of truth).
- **package.json** — Project manifest + the BUILD VERSION SOURCE OF TRUTH (`version` drives the output filename). Scripts: `build` / `serve` / `validate` / `check` / `check:full` / `harness` / `lan`.
- **js/core/main.js** — Entry point: boots Game, wires `#start-btn`/`#retry-btn`/`#save-score`, drives the v3.85.0 hangar-carousel ship showcase from `PLAYER_THEMES` (hero canvas + ‹/› arrows + ←/→ keys + nameplate + dots), Enter shortcut; carries the project manifest comment + VERSION.

## 2. js/core/ — Core Infrastructure & Orchestrator (32 files: 20 root + config/ 8 + game/ 4)

- **Game.js** — THIN PUBLIC SHELL / orchestrator (v3.77.0 E6): state machine, fixed update loop, collision dispatch, scoring, starfield, render dispatch, `collectPowerUp`, `destroyCrate`, `startCombatStage`. Delegates to `js/core/game/`: StageFlow (stage lifecycle), DisplayPolicy (pointer lock / cursor / settings gate), GameOver (game-over sequence), Gameplay (combat housekeeping) — submodules take `game` as the first parameter, `Game.js` calls them with `this`. v3.13.0: `W`/`H` mirror the LIVE viewport (`view.viewW/H`) and re-sync on resize — legacy `game.W/H` consumers track ultra-wide. v3.27.0: `game.eggs` (one slot per easter egg). v3.76.0: stage flow is owned by `game.levelRegistry` — the core loop ticks `activeStage.update(dt)` and advances when `activeStage.isComplete()`; `createCatShip` is the single player spawn path. **Source-level gate pins stay in this file** (gates read it directly): `VERSION = 'v3.77.0'` ([6aa]), the `LevelRegistry` import + `activeStage.update(dt)` / `isComplete()` / `advanceStage()` core-loop lines ([6z]), the `stunRockets` / `napalmRockets` imports + `update(this, dt)` ticks ([6w]), the `type: rollPowerUpDrop()` crate-drop line + `Game.prototype.collectPowerUp` ([2]), the shuttle wave event (`currentSpecies === 'shuttle'` / `SHUTTLE INTERCEPT`, [6ab]), and the `this.bonus.draw(ctx)` hook ([6h]).
- **WaveManager.js** — v3.76.0: the COMBAT STAGE. Wave definitions + spawn scheduling through EnemyFactory, wave-clear detection, bonus scoring. It is now a completion signal only — bonus-stage selection moved to `LevelRegistry.STAGE_SEQUENCE`.
- **config.js** — v3.77.0 (E6): now a COMPATIBILITY RE-EXPORT SHIM. The domain tunables moved into the `js/core/config/` submodules (viewport: TAU/GAME; player: PLAYER/PLAYER2/SHIP_GEOMETRY/MINI_SHIP/PLAYER_THEMES; weapons: WEAPONS/WEAPON_ORDER/ROCKETS/FIRE_ZONE; enemies: ENEMY_TYPES/TIERS/WAVE; drops: ASTEROID/POWERUP_DROPS/rollPowerUpDrop/SHUTTLE_DROP; stages: BONUS/LIFE_SCORE_INTERVAL). The public surface (24 named exports incl. `VERSION = 'v3.77.0'`) is unchanged, so every existing importer keeps working untouched.
- **Viewport.js** — v3.13.0 dynamic viewport math: `computeViewport(winW, winH, dpr)` → `viewW/viewH` (the constrained axis stays at native GAME size, the other axis stretches to fill the window → zero letterboxing), crisp buffer scale `q` (≤ 3), and `ULTRA_WIDE_PRESETS` (exact native-pixel buffers at 3440×1440 / 5120×1440 @ DPR 1).
- **ViewScaler.js** — Applies `computeViewport`: CSS `scale()` on `#game-root`, canvas buffer sized `viewW×q × viewH×q`, identity ctx transform (Game.js applies `ctx.scale(q)` per frame). `U` = browser fullscreen.
- **utils.js** — Shared math helpers: TAU, rand, clamp, dist2, angleTo, pick.
- **EventBus.js** — Global pub/sub `bus` for UI events (banner, score, life) so game logic never touches the DOM directly.
- **Entity.js** — Base class for every actor: position, velocity, radius, hp/shield, alive flag.
- **AssetManager.js** — Runtime asset manager for the shared transparent-PNG pipeline: decodes the base64 registry (AssetSprites.js) into Image objects; `loadAssets()` resolves when all sprites are ready (main.js re-renders menu icons at that point).
- **AssetSprites.js** — GENERATED base64 sprite registry (do not edit by hand — `node tools/import-assets.mjs` from `tools/asset-manifest.json`; source art in the shared `.assets` folder, normalized to ≤128px): 9 `cat_*` themes, snake, spider, shuttle, moth, squirrel, wasp, beetle, crate, falcon, …
- **Starfield.js** — Parallax starfield background layers.
- **AudioSystem.js** — Zero-file WebAudio-synthesized SFX (hits, blasts, weapon and UI tones) + the v4.4.0 DYNAMIC PROCEDURAL SOUNDTRACK: a lookahead 16th-note scheduler with four context modes (`open` / `combat` / `boneyard` / `boss`) — 8-bar chord progressions, evolving detuned-saw pads, an algorithmic arpeggiator (3 pattern variants per mode + per-phrase seeded variation + phrase fills), mode-specific basslines, noise-based percussion, space delay + open-space shimmer; `setMusicMode()` applies changes at bar boundaries with riser/sub-drop accents; `startMusic()/stopMusic()` (PauseMenu lifecycle) + `setVolumes()` (master/SFX/music).
- **game/MusicDirector.js** — v4.4.0 dynamic soundtrack director: `syncMusicMode(game)` derives the soundtrack mode each frame from live state — SAR journey zones (OPEN SPACE → `open`, THE BONEYARD → `boneyard`, DEEP SECTOR → `boss` at Eridath's Mom's House range, else `combat`), classic stage flow (Bone Yard bonus → `boneyard`, Internet boss stage → `boss`, active waves → `combat`, else `open`) and enemy-pressure escalation.
- **ParticleSystem.js** — Particle bursts + jagged lightning bolts for explosions, impacts, ultimates.
- **RealTimeClock.js** — v3.15.0 real-time clock sync loop: `realTimeClock` singleton (`start()/stop()/update(dt)`) pulls the player's actual local system time (hours + minutes) from JavaScript's `Date` object, re-reading at most once per second; `getHHMM()` feeds the Internet-entourage pendants, `getSeconds()` drives the colon blink.
- **EasterEgg.js** — Easter-egg manager (v3.27.0): one slot per egg in `game.eggs`, both can be alive at the same time — Bender (v3.24.0, kill-based v3.29.0: "BENDER ENGAGED" banner, slides in from the right, 10 s auto-aim, parting quip on exit) + Planet Express ship flyby (dev panel "Drop Ship").
- **BenderSprite.js** — Bender pixel-art sprites: easter-egg body + animated cigar arm, the rare 'robot' power-up drop icon (tiny full-body robot, v3.28.0), and the dev-panel robot.
- **HumanSprite.js** — v3.13.0 procedural humanoid art: front-facing chibi person holding a rifle (4 shirt variants, 6 hair colors, 3 hair styles, 4 skin tones via `randomOutfit()`), walk-cycle leg/arm swing + body bob (`drawHuman(ctx, { r, outfit, walkPhase, flash, aim })`). Used by HumanEnemy (waves + Bone Yard march).
- **ShipSprite.js** — GENERATED Planet Express ship easter-egg sprite (`node .cline/ship-egg/derive-ship.mjs`).

### 2a. js/core/config/ — Domain Config Submodules (8 files: 6 E6 domains + hazards v3.97.0 + searchDestroy v3.99.0)

The tunable constants extracted from `config.js` (which became a re-export shim). Each submodule owns one domain; `config.js` re-exports everything so importers stay untouched.

- **viewport.js** — `TAU` + `GAME` (native 1280×720 REFERENCE dimensions).
- **player.js** — `PLAYER` / `PLAYER2` physics + HP/shield/lives, `MAIN_SHIP_SCALE` / `MINI_SCALE`, `SHIP_GEOMETRY` (catship hardpoints), `MINI_SHIP`, `PLAYER_THEMES` (9 themes) + `PLAYER_THEME_SPRITES`.
- **weapons.js** — `WEAPONS` (Vulcan / Plasma / Rail balance), `WEAPON_ORDER`, `ROCKETS` (stun / napalm), `FIRE_ZONE`.
- **enemies.js** — `ENEMY_TYPES` (19-species stats), `TIERS` (score), `WAVE` (16-species wave-system constants).
- **drops.js** — `ASTEROID`, `POWERUP_DROPS` pool + `rollPowerUpDrop()` shared drop roll, `SHUTTLE_DROP` (guaranteed mini-ship on shuttle kill).
- **stages.js** — `BONUS` (Bone Yard / Internet round constants), `LIFE_SCORE_INTERVAL`.
- **hazards.js** — v3.97.0: `HAZARD_TYPES` (per-type speed/hp/radius/score/proximityFuse/explosion) + `HAZARD` (spawner cadence + weighted table) — the single tuning point for the hazard field.
- **searchDestroy.js** — v3.99.0→v4.0.0: the SEARCH & DESTROY tuning point — `SECTOR` (world size), `START` (journey start), `CAMERA` (v4.0.0 displacement accumulator: `DEADZONE_X/Y`, `RECENTER`, `CLAMP_MARGIN`), `WORLD` (v4.0.0 world-anchored layout: `DEBRIS` / `HAZARDS` / `PATROL` counts + bands), `ZONES` (the 3 journey bands), `HOUSE` (Eridath's Mom's House base), `DROPS` (ambient power-ups), `RADAR` (cockpit radar), + `sarProgress()` / `sarZoneFor()` helpers.

### 2b. js/core/game/ — Game Orchestrator Submodules (4 files, v3.77.0 E6)

The Game.js orchestrator logic extracted into focused modules. Every function takes `game` as its first parameter; `Game.js` delegates with `this`.

- **StageFlow.js** — stage lifecycle: `advanceStage` / `startBonusStage` / `startBonusLevel` / `startBonusSpecific` / `restartLevel`, driven by `LevelRegistry` (`STAGE_SEQUENCE` cadence + `BONUS_STAGES` registry). v4.5.0: `returnToHangar(game)` — the pause-menu "RETURN TO HANGAR" teardown: active-stage cleanup hook + slot free, all entity arrays, hazard field + particles, player ships (P1/P2), co-op/LAN (`coopManager.stop()` / `clientMirror.stop()` when active), SAR facade (`game.sard.destroy()` + mode → `classic`), score/multiplier/life timer/shake/god mode, dev state (aimbot/test aimbot/floaters/msglog), stage manifest (`levelRegistry.reset()` + `waveManager.reset()`), `audio.stopMusic()`, `game.state = 'menu'`, `syncCursor(game)` (pointer-lock release) and the null-safe DOM swap (HUD/FC dashboard/pause overlay/game-over hidden, `#menu-screen` shown). The permanent rAF loop is untouched — the state machine unloads.
- **DisplayPolicy.js** — display gating: `checkViewportChange` / `wantsPointerLock` / `syncCursor` / `settingsOpen` / `onPointerLockChange` (pointer lock + cursor + settings-open state).
- **GameOver.js** — `gameOver(game)`: the game-over sequence (score submission, leaderboard, DOM).
- **Gameplay.js** — combat housekeeping: `hitPlayer` / `destroyAsteroid` / `checkScoreLives` / `cleanup` / `spawnEnemyBullet`.

## 3. js/player/ — Player Ship (9 files + variants/ 5)

- **Player.js** — Core player controller: hull state (health/shield/lives/invulnerability), weapon fire routed to PlayerWeapons, Q/E/F ability routing, mini-ship docking, lives & respawn.
- **PlayerFlight.js** — Asteroids-style flight for the cat ship: rotation, thrust, boost, drag, screen bounds (bounce or wrap — SETTINGS).
- **PlayerHardpoints.js** — Catship hardpoint math: converts SHIP_GEOMETRY local-space positions (muzzle tips, thruster pods, dock ports) to world space at the ship's live angle.
- **PlayerWeapons.js** — 3-weapon primary fire system (Vulcan / Plasma / Rail) via the `player.weapons` registry, thermal management, weapon switching (R/G). v3.70.0: no inline volleys left — each weapon module owns its firing logic; shared cooldown decay stays here (`fireTimer`).
- **PlayerRenderer.js** — Rendering orchestrator for the cat-ship fleet: dispatches hull art (PlayerShipArt), FX (PlayerShipFx) and mini art (PlayerMiniArt). v3.95.0: the `cat_*` sprite branch resolves the theme sprite, translates to the ship's position, and delegates to the shared `PlayerShipArt.drawSpriteShip` pipeline (rotate + 70px blit + soft theme shadow-glow + SHIP_GEOMETRY hardpoint FX — the v3.72.0 off-screen "floating circle" is gone); the hangar hero preview reuses that same pipeline at HANGAR_ZOOM; falls back to the procedural hull when no sprite.
- **PlayerShipArt.js** — Top-down "hands up, don't shoot" catship art (v3.4.0 full redesign): sleek teardrop hull with belly armor + neon nose trim, antenna ears, blinking glowing eyes, reactive tail; `drawSpriteShip` (v3.95.0) is the shared in-game sprite pipeline (70px frame × MAIN_SHIP_SCALE in the ship's local frame, soft theme shadow-glow, hardpoint FX) used by PlayerRenderer and the hangar preview; `drawCatShip` falls back to the procedural hull.
- **PlayerShipFx.js** — Shared cat-ship FX: front-paw weapon pods, back-paw thruster pods, muzzle flashes, `drawWeaponPaw` (vulkanSpin / railCharge / plasmaPulse), shield ring (v3.56.0: `SHIELD_BUBBLE_RADIUS` 60, thin rim stroke).
- **PlayerMiniArt.js** — Docked mini-ship art: an EXACT 0.6× clone of the main cat ship (v3.73.0: minis blit the theme's sprite at MINI_SCALE).
- **PlayerFleet.js** — Docked mini-ship fleet: spawn (strict same-color clone via CatShipFactory), dock/undock, clearFleet (resets `player.fleetDeployed`), damage bookkeeping.
- **variants/** — the 5 cat-ship variants (one file each; each sets `ULTIMATE_COOLDOWN`/`ultimateName`):
  - **yellowCat.js** — Yellow Tabby, Agile Baseline — ultimate: Energy Ring Explosion (bullet rings + shield break + knockback).
  - **orangeCat.js** — Orange Tabby, Fiery Brawler — ultimate: Nova Shockwave.
  - **whiteCat.js** — White, Pristine Interceptor — ultimate: Tactical Nuke (screen-wide AOE + mushroom-cloud visual).
  - **greyCat.js** — Grey, Stealth/Tech — ultimate: Black Hole Pull (warps enemies into a dense, crushable cluster).
  - **brownCat.js** — Brown, Rugged Support — ultimate: Shield Overcharge (brief invulnerability + pushes nearby enemies away).

  `CatShipFactory` REGISTRY maps theme IDs → variant classes (grey/gray alias, yellow fallback); the other 4 `PLAYER_THEMES` (blue/red/green/black) use the base `Player` with their theme colors.

## 4. js/combat/ — Weapons & Combat (18 files)

- **CatShipFactory.js** — Single factory for the player fleet: theme-ID → class registry; `createCatShip(theme, game)` is the single player spawn path; `getUltimateName` for HUD.
- **BaseWeapon.js** — v3.68.0 (module v1.0.0): abstract base for the modular weapon architecture (Phase 1). A weapon owns its FIRING LOGIC (volley shape, heat/lockout, per-frame state tick, reset); its STATE stays on the owner (Player) so HUDFireControl, FRENZY, respawn and net sync keep reading the canonical player fields. Contract: `fire(aim, { dmgMul, homing })` / `update(dt)` / `draw(ctx)` / `reset()` / `canFire()`, with owner-backed `cooldown` (→ owner.fireTimer) and `lockout` (→ owner.thermalLockout) accessors.
- **VulcanCannon.js** — v3.68.0 (module v1.0.0): the Vulcan Cannon extracted from PlayerWeapons. Gatling volley from BOTH front-paw barrel tips (2 bullets/shot, 0.07 s cadence), +0.05 heat/shot with 0.35/s decay → at 1.0 OVERHEAT: 1.2 s lockout + "OVERHEAT!" floater + msglog; FRENZY suppresses heat buildup and overheat entirely; ticking muzzle smoke during lockout.
- **PulseCannon.js** — v3.69.0 (module v1.0.0): the Plasma Pulse extracted from PlayerWeapons. Twin-pod 3-bolt fan (aim ± 0.14 rad) from BOTH front-paw emitter tips, 0.24 s cadence, 560 px/s, 22 dmg, shieldMelt 15; no thermal state (plasma never overheats).
- **RailCannon.js** — v3.69.0 (module v1.0.0): the Rail Cannon extracted from PlayerWeapons. Single piercing beam from the center muzzle (1500 px/s, 100 dmg, pierce 999, 1.0 s cadence); impact FX = muzzle burst + screen shake + sawtooth tone; the 0.5 s charge-up visual lives in `update(dt)`.
- **BaseRocket.js** — v3.70.0 (module v1.0.0): shared abstract base for the modular specialized rockets (Phase 3). A rocket module owns its LAUNCH shape (twin-carrier salvo), per-frame STEERING (homing / straight) and DETONATION (impact AoE + FX); the carriers are plain `Bullet` instances tagged `rocketKind` (so Combat/Bullet integration is unchanged). Contract: `kind` / `launch(game, player)` / `steer(game, rocket, dt)` / `detonate(game, rocket, x, y)`.
- **StunRockets.js** — v3.70.0 (module v1.0.0): Q/H stun rockets — homing tracking + smoke trail, shield-strip + stun + fire-suppression AoE, 0 direct damage.
- **NapalmRockets.js** — v3.70.0 (module v1.0.0): E/J napalm rockets — straight flight, chip damage, self-destruct AoE + lingering FireZone.
- **SuperNova.js** — v3.71.0 (module v1.0.0): base nova (F/C) + synergy super-weapon volleys (Phase 4 modular combat).
- **Bullet.js** — Projectiles for both sides: velocity, damage, weapon profile, pierce (rail), tracking (vulkan), optional homing, friendly flag, lifetime.
- **Homing.js** — Homing (full) + Tracking (mild, for Vulkan) steering for friendly bullets.
- **Combat.js** — `applyWeaponHit`: per-weapon damage rules (incl. plasma-pulse shield melt), hit-flash, `onEnemyDeath` (bullet ownership → per-player scoring).
- **Collisions.js** — All collision detection: friendly bullets vs enemies / bonus targets, enemy bullets vs players, enemy rams, powerup pickup — iterates `game.players` (fallback `[game.player]`), skipping `p.dead`.
- **PowerUp.js** — Falling drops: extra life, shield, mini-ship, destructible bonus crate (shared `.assets` PNG, key "crate"), rare Bender (easter egg).
- **FireZone.js** — Lingering napalm pools (FIRE_ZONE in config.js): a ground pool left by napalm detonation.
- **MiniShip.js** — Docked mini-ship: a shrunken clone of the player's cat ship with its own HP. v3.16.0: docked minis are INERT (snap to dock slot); deployed minis (player.fleetDeployed) fire the hull's active weapon on the hull's cadence. v3.73.0: renders as a 0.6× sprite clone (PlayerMiniArt).
- **WeaponAnim.js** — v3.16.0 pure-logic weapon animation state (vulkanSpin / railCharge / plasmaPulse): `initWeaponAnimState(s)` + `updateWeaponAnim(s, dt, { active, time })`; ticked by Player.js (hull) and MiniShip.js (minis), surfaced by PlayerShipFx.drawWeaponPaw.
- **TestAimbot.js** — DEVELOPER-ONLY test aimbot (debug tooling — NOT gameplay), toggled from the dev panel.

## 5. js/enemies/ — Enemy Species (19 files + sprites/ 1)

- **EnemyBase.js** — Base class for all enemy species: core physics, health pools, stun/slow state, `move(dt, slowMul)` hook, fire logic, flash decay, death book-keeping. v3.75.0: all tunable stats (speed, hp, damage, fireRate) come from `ENEMY_TYPES` in config.js and score from `TIERS`, assigned once here — no per-species stat overrides.
- **EnemyFactory.js** — Type-ID → class registry; `createEnemy({ type, tier, x, y, game })` with tier-scaled stats.
- **17 species** (behavior only — art via the sprite pipeline or procedural fallback):
  - **WaspEnemy.js** — Fast sine-weaving striker with aimed shots (pixel-art sprite, key "wasp", faces the player).
  - **Wasp2Enemy.js** — Black wireframe wasp (sprites/Wasp2Sprite.js PNG pipeline); tracks player X, oscillates, periodic lunges.
  - **BeetleEnemy.js** — Slow armored tank with periodic charge lunges (pixel-art sprite, key "beetle", 665×693 → 123×128 + charge-lunge pulse).
  - **ButterflyEnemy.js** — Fast fluttering dodger, light shots.
  - **RatEnemy.js** — Fast dashing scavenger with lateral jitter.
  - **WolfEnemy.js** — Mid-speed pack hunter, offset pack sines.
  - **FalconEnemy.js** — Hovers high, then dives straight at the player (pixel-art sprite, key "falcon" — v3.71.1 beak-up flip fix).
  - **BatEnemy.js** — Erratic random-jitter flutterer.
  - **LizardEnemy.js** — Slow tank, 3-way acid spit from fixed altitude.
  - **DragonEnemy.js** — Heavy high-hover firing 5-shot fire cones.
  - **HumanEnemy.js** — v3.13.0: a REAL PERSON (HumanSprite.js). Waves: hover band + strafe + telegraphed aimed rifle; Bone Yard: `marchMode` = straight-down single-file march at 0.7× speed with an animated walk cycle.
  - **AlienEnemy.js** — Pulsing UFO disc, phase-shift alpha, sine sweeps.
  - **SnakeEnemy.js** — Undulating serpent, smooth sine wave (pixel-art sprite, key "snake", slither gait phase-locked to the movement sine).
  - **SpiderEnemy.js** — Slow web-spinner, slow web projectiles (pixel-art sprite, key "spider", bright red hourglass mark on the dorsal abdomen).
  - **ShuttleEnemy.js** — v3.50.0: 17th species (REGULAR WAVES ONLY): crewed space shuttle, hover band (y 80–180) + banked-tilt strafe, telegraphed aimed cannon shots (pixel-art sprite, key "shuttle").
  - **MothEnemy.js** — v3.52.0: 18th species (REGULAR WAVES ONLY): erratic fluttering night-flyer, double-sine flutter + sudden random darts, light aimed shots (pixel-art sprite, key "moth", fast procedural wing-beat).
  - **SquirrelEnemy.js** — v3.67.0: 19th species (REGULAR WAVES ONLY): fast erratic tree-dweller, quick bursts + hops + twitchy sprints, light aimed shots (pixel-art sprite, key "squirrel").

  (Species 18–19 of the 19-species roster = the two bosses in `js/bosses/`: Black Cat + Pink Cat.)
- **sprites/Wasp2Sprite.js** — Wasp2 sprite pipeline: base64 PNG, white keyed to transparent, 882×500 → 256×145, 1-px dilation. v3.75.0 (Phase 2): `sprites/` is the home for standard enemy sprite/art pipelines — behavior modules in `js/enemies/` remain pure AI/movement/health/combat; boss art + behavior stay together in `js/bosses/`.

## 6. js/bosses/ — Bosses (6 files)

v3.74.0 (Phase 1): boss art + behavior isolated from `js/enemies/` — the boss boundary.

- **BlackCatEnemy.js** — Teleporting phantom with a yellow ghost trail (phases every ~1.8 s); `entourage` tag support for the Internet round.
- **BlackCatSprite.js** — GENERATED cat sprite pipeline (`node tools/derive-cat-sprites.mjs`).
- **BlackCatEntourage.js** — v3.15.0 entourage accessory art (pure drawing, no game state): chunky old-school gold cuban-link chain + large iced-out digital clock pendant (gold bail/bezel, diamond "ice" studs, 7-segment HH:MM with blinking colon). Called from `BlackCatEnemy.draw()` when `entourage` is set; the pendant reads `realTimeClock.getHHMM()` — the art never touches `Date`.
- **PinkCatEnemy.js** — "Internet" boss (InternetBonus): small cute FEMALE chibi boss (radius 18 — trash/crate scale), aggressive fire patterns.
- **PinkCatSprite.js** — GENERATED cat sprite pipeline (`node tools/derive-cat-sprites.mjs`).
- **PinkCatBossArt.js** — v3.13.0 boss art: `drawPinkCatBoss(ctx, { r, t, flash, hpFrac })` — hair bow, long lower lashes, blushing cheeks, tiny "w" mouth, fluffy tail + drifting hearts, "enraged" wide eyes below 35% HP.

## 7. js/levels/ — Stage Flow & Bonus Levels (9 files)

- **LevelRegistry.js** — v3.76.0 (Phase 3): the DATA-DRIVEN STAGE FLOW for the core game loop.
  - `STAGE_SEQUENCE` — the cadence manifest: 3 combat stages then a `bonus` entry (`bonusInterval = 4`); the bonus entry is `random` (resolved at draw time).
  - `BONUS_STAGES` — registry mapping bonus IDs → stage classes: `boneyard` → BoneYardBonus, `internet` → InternetBonus.
  - API: `nextStage()` (cyclic manifest walk, tracks `currentEntry`), `resolveEntry('random')` (→ a concrete registered bonus id; passthrough for non-random entries), `createStage(entry, game)` (combat → the shared WaveManager; bonus → a CACHED instance per id), `labelFor(entry)` (`WAVE` / `☠ BONE YARD ☠` / `🌐 INTERNET 🌐` / uppercased fallback), `forceBonus(id)` (DevPanel — 'random' resolves too), `reset()` (fresh manifest from the first entry).
  - UNIFORM STAGE INTERFACE — every stage exposes `init()` / `update(dt)` / `isComplete()` / `cleanup()`. Game.js drives `activeStage.update(dt)` and advances when `activeStage.isComplete()`. Bonus stages never mutate game state directly or call `waveManager.startNext()`.
- **BonusLevel.js** — v3.76.0: thin ADAPTER forwarding to the active registry stage (the old random Bone-Yard-vs-Internet dispatch is gone — sequencing lives in LevelRegistry).
- **BoneYardBonus.js** — 3-phase comedic round: seeded field of 29 destructible bones (`BONUS.BONE_YARD_FIELD`: 10 femur / 10 profile_bone / 6 skull / 3 skeleton, drifting at 6–18 px/s) → human line march (explicit `BONE_YARD_HUMANOID_TYPES = ['human']` allowlist so new species can never leak in) → "win by NOT making it" timer.
- **BoneFragment.js** — Destructible bone (femur / profile_bone / skull / skeleton): per-key radius/HP/score bands (500 / 1000 / 2000 pts), weighted spawn pool (40/40/15/5), shatter shrapnel (skeletons: bigger shake + extra shrapnel).
- **InternetBonus.js** — Boss round: 8 Black Cats orbiting in a circle around the 1 Pink Cat boss, with crate/power-up drops. v3.15.0: the 8 orbiting Black Cats are the boss's entourage (`entourage = true` + `entouragePhase`); the round owns the RealTimeClock lifecycle (start on spawn, tick in update, stop on phase-out).
- **AsteroidBonus.js** — Destructible asteroid chain power-up (lives in `game.powerups`, `destructible=true`): Large rock → 2 Medium + 2 Small, each Medium → 4 Small, every destroyed Small rolls a 40% regular power-up drop. Routed via `Game.destroyAsteroid` (`isAsteroid` flag).
- **AsteroidSprite.js** — v3.22.0 asteroid sprite pipeline: base64-embedded PNG (241×217, transparent) → tight-cropped → 128-px sprite → 8 seeded jagged shard sub-sprites; procedural jittered rock fallback.
- **MiniDeploy.js** — v3.16.0 pure-logic fleet deploy/recall: `toggleFleetDeploy(player)` flips `player.fleetDeployed`; `updateFleetDeploy(player, dt)` places deployed minis in a combat orbit (the ONLY source of deployed-mini position).
- **MiniPosterSprite.js** — Sprite pipeline for the mini-ship power-up: an "Adopt Me!" WANTED poster (a cat behind bars) rendered as 28×28 pixel art.

## 7a. js/hazards/ — Hazard Field (3 files, v3.97.0)

INDEPENDENT from `WaveManager`, `DropManager`, enemies and easter eggs: the hazard field has its own spawner, its own list, and ZERO loot.

- **HazardBase.js** — Base class for the 10 hazard types (`HAZARD_TYPES` in `js/core/config/hazards.js`): non-lootable, shootable environmental obstacles. Drifts CONTINUOUSLY along a fixed heading (no steering/AI) until (a) shot down by the player (Collisions.js friendly-bullet loop → `HazardManager.explode` with `byPlayer: true` → score, ZERO loot), (b) proximity-fuse trigger (Prox Mine) or direct contact with the player fleet → `_detonate()` (blast + AoE damage, no score), or (c) drifts fully off-screen → silent despawn. `applyDamage()` honors the v3.83.0 off-screen kill gate (`utils.isOnScreen`) exactly like `EnemyBase`. Rendering: the 256×256 hazard PNG (key `hazard_<type>`, embedded 128×128 via `tools/import-assets.mjs`) through the AssetManager pipeline, procedural drum/bomb glyph fallback, durability arc once hit, proximity warning ring.
- **HazardFactory.js** — `createHazard()` + `pickSpawnVector()`: the "enter from ANY direction" rule — random edge (top/right/bottom/left), a random point fully off-screen past `HAZARD.EDGE_MARGIN`, and a random interior target so the heading always crosses the playfield (straight or diagonal).
- **HazardManager.js** — The independent spawner + per-frame driver (`game.hazards`): owns its own list/rings/pools/flash state and spawn timer (`HAZARD.SPAWN_MIN..MAX`, capped at `HAZARD.MAX_CONCURRENT`), active during combat waves only (bonus rounds stay hazard-free). `explode(game, hz, {byPlayer})` detonates per `HAZARD_TYPES[type].explosion`: bio (green splatter + toxic pool), fire (orange burst + fire pool), ash (gray + long low-dps pool), cluster (N sub-bursts + mini shockwaves), magnet (EM burst + clears enemy bullets in the field), nuke (massive blast, double shockwave, full-screen flash), prox (tight high-damage burst). Every explosion: particle bursts, expanding shockwave ring, screen shake, audio, and AoE damage to every live player inside the blast radius. **ZERO LOOT: the module never imports the DropManager.**
- Tunables: `HAZARD_TYPES` (per-type speed/hp/radius/score/proximityFuse/explosion) + `HAZARD` (spawner cadence + weighted table) in `js/core/config/hazards.js`, re-exported by `config.js`. Dev panel "Drop Hazard" button (`#dev-hazard`) force-spawns one.

## 7b. js/modes/SearchAndDestroy/ — SEARCH & DESTROY (5 files, v3.99.0 → v4.0.0)

The sector-journey mode: a world-space coordinate grid the player flies through left → right (OPEN SPACE → THE BONEYARD → DEEP SECTOR) to destroy Eridath's Mom's House. A world-space CAMERA LAYER over the untouched screen-space combat stack — full roster parity (all 9 Catships, Vulcan/Plasma/Rail, rockets, ultimates, the shared power-up pool). Entry: `#sard-btn` on the start screen / DevPanel `#dev-sard` → `game.start(theme, { mode: 'sard' })`; `Game.js` ticks `game.sard.update(dt)` and render swaps in the sector background + radar HUD; `game.sard.hudLabel()` owns the wave label in SAR mode; victory routes through `game.victory()` → GameOver's "MISSION ACCOMPLISHED" state.

- **index.js** — the `SearchAndDestroy` facade (barrel + single import surface): owns the four modules, drives them from the core loop (`update(dt)` → map → spawner → combat → radar; `renderBackground(ctx)` / `renderHud(ctx)`), exposes `hudLabel()`, and `destroy()`s the modules on mode exit.
- **SectorMap.js** — the sector grid + the **DISPLACEMENT-ACCUMULATOR camera (v4.0.0)**: the ship flies in screen space (PlayerFlight stays sovereign — the camera NEVER writes `player.vx/vy`); the ship's screen offset is tracked against a dead zone (`CAMERA.DEADZONE_X/Y`), the EXCESS delta is accumulated into world coordinates (`worldX`/`worldY`), and the ship is softly recentered (`CAMERA.RECENTER` lerp + `CLAMP_MARGIN` screen-edge backstop). World→screen projection (`worldToScreen` / `playerWorld`) drives the scrolling grid, zone labels and the deterministic world-anchored layout (`debrisAnchors` / `hazardAnchors` / `patrolSites` — seeded PRNG, identical every run).
- **SectorSpawner.js** — journey progression + world-anchored spawners: the player's WORLD position (`playerWorld().x`) drives zone entry (OPEN SPACE → THE BONEYARD → DEEP SECTOR banners); debris and hazard anchors activate when the camera nears them (spawned into the shared `game.hazards` / bonus-target lists, culled when far behind); regional enemy patrols spawn from per-zone patrol sites near the player's world position (classic `EnemyFactory` roster).
- **SectorCombatManager.js** — the target base + victory sequence: Eridath's Mom's House (the 512px native `.assets/Eridaths-Moms-House` PNG under manifest key `eridath_moms_house`, drawn at 512×512 with a `HOUSE.radius` collision circle) sits at `HOUSE.x/y` in the deep sector — persistent, shootable, and it spawns enemy patrols while alive; friendly bullets damage it (off-screen kill gate parity), and destruction fires the 3s victory countdown → `game.victory()`.
- **RadarManager.js** — the cockpit radar HUD (F1 toggle, `SAR.RADAR`): a rotating sweep, enemy/power-up/house blips projected from world space, and the "AVIONICS — SEARCH & DESTROY" readout. v4.2.0: while the fire-control panel is expanded the scope renders into the panel's embedded canvas (`#fc-radar`, right column) and the standalone bottom-right screen radar is hidden; panel minimized/hidden → the classic standalone scope.

Tunables: `SAR` / `sarProgress` / `sarZoneFor` in `js/core/config/searchDestroy.js` (re-exported by `config.js`). Pinned by `tools/check/sections/06aj-search-destroy.mjs` (displacement-accumulator headless drive: dead-zone hold, excess accumulation, soft recenter, sustained scroll, world-anchored layout determinism, house destruction → victory).

## 8. js/ui/ — HUD / UI / Meta (11 files)

- **HUD.js** — DOM top bar: score, lives, wave, HP/shield bars, banners, `#version-label`. v3.76.0: in bonus state the wave label comes from `levelRegistry.labelFor(currentEntry)` — new bonus stages label themselves without touching the HUD. v3.77.0: milestone version label.
- **HUDConsole.js** — Combat message console panel: renders the MessageLog ring buffer into the DOM console.
- **HUDFireControl.js** — Bottom sci-fi fire-control dashboard: hull/shield meters, weapon label + thermal readout, 2×2 action-slot grid (STUN / NAPALM / SUPER — the ultimate's F-key cooldown timer / ORBIT — the undock/redock toggle state), FLEET strip (docked mini HP bars). v4.2.0: the SPD readout is gone — its right-column slot hosts the embedded radar scope (`#fc-radar`); this module draws the idle NO SIGNAL / RADAR OFF scope when the live SAR radar is not active.
- **Crosshair.js** — Procedural canvas crosshair (aim reticle) for the local player ship.
- **DevPanel.js** — Backtick/F9 admin panel: spawn species/tier, weapon override, instant bonus (v3.76.0: routes through `levelRegistry.forceBonus` — random / boneyard / internet), god mode, robot drop (Bender egg), ship drop (Planet Express flyby). v3.34.0: pinned header, scrollable `.dev-body`, pinned footer with a live viewport readout.
- **Leaderboard.js** — localStorage high scores (top 10): `submit(name, score)`, render into `#menu-scores-list` / `#go-scores-list`.
- **MessageLog.js** — Combat message console backend: a capped ring buffer of mission events.
- **PauseMenu.js** — Pause overlay: ESC / P / the HUD ⏸ button; Game.js gates its update loop on it. v4.5.0: the ⌂ `#pause-hangar` button calls `game.returnToHangar()` directly (no `close()` first — avoids the music restart blip + pointer re-lock churn) and tears the session down back to the hangar terminal.
- **Settings.js** — User-tunable settings (singleton + localStorage, same pattern as EventBus's `bus`).
- **SettingsScreen.js** — Shared settings panel (opened from the START SCREEN ⚙ button and the PAUSE menu): keybinds, split spin, volumes, FX, screen-bounds mode.
- **DebugBridge.js** — External debugger helper (dev tooling): exposes a single handle for external tooling.

## 9. js/input/ — Input (3 files)

- **InputManager.js** — Unified keyboard/mouse/touch: WASD/arrows, L/LMB fire, Q/H stun, E/J napalm, F/C nova, R/G switch, SPACE thrust (alone = forward, +W boost), delta-mouse 360° spin, virtual joystick + FIRE/STUN/NAPALM/BOOST/NOVA/WPN touch buttons.
- **Keybinds.js** — Remappable keybinds for keyboard keys AND mouse buttons (LMB/MMB/RMB + mouse 3/4): every gameplay action maps to a list of codes — any of them works; user-rebindable via SettingsScreen.
- **MenuKeybinds.js** — Select-screen keybind footer (`#menu-keybinds`): renders the player's ACTIVE keybinds (replaces the old hardcoded `.controls-help` block in index.html).

## 10. Multiplayer / LAN / E6 (v3.20.0, `net/` subfolder)

Host-authoritative LAN co-op: the **host** browser simulates the full game (P1 + P2) and broadcasts authoritative state; the **client** browser sends P2 input and mirrors the host's world (no local physics). P2 is a full second `CatShipFactory` ship (not a visual clone) with its own HP/shield/lives/score, auto-aim, and per-player scoring.

**`net/` modules (11 files):**
- **E6.js** — the project's standard plain-text record codec (pure, no DOM). Line-oriented, pipe-delimited, `#E6 <schema> v<major>.<minor>` header + `#FIELDS f1|f2|...` schema mapping + record rows. Values are escaped (`\\`→`\\\\`, `|`→`\\|`, newline→`\\n`); `splitRow` only guards against splitting on an escaped pipe and preserves backslashes so `unescapeValue` (single-pass) can process them. Used for ALL config, profiles, and wire-state.
- **NetProtocol.js** — wire protocol. JSON envelope (`hello`/`welcome`/`input`/`state`/`event`/`bye`); the state collections (players/enemies/boss) are serialized as E6 record rows. Fixed field order: `player: id|theme|x|y|angle|hp|shield|weapon|minis|score|lives|alive`, `enemy: id|type|x|y|hp|angle`, `boss: active|hp|maxHp|phase|x|y`.
- **NetSettings.js** — multiplayer config (E6 schema `netsettings`: `role|hosting|port|hostIp|syncRate`), persisted to localStorage + export/import as `multiplayer.config.e6`. Roles: `solo|coop|host|client`.
- **PlayerProfile.js** — per-player profiles (E6 schema `profile`: `slot|theme|callsign|score`), persisted to localStorage + export/import as `player1.profile.e6` / `player2.profile.e6`.
- **Player2Controls.js** — P2 keyboard input: a SEPARATE keybind set + input state (action-layer compatible: `isDownAction`/`wasPressedAction`).
- **NetClient.js** — browser WebSocket client (host + client roles); `connect()`, `sendInput()`, `onState`/`onEvent`/`onWelcome`/`onClose` callbacks, `status` for the net HUD.
- **NetSync.js** — host-side sync: broadcasts `encodeState(game, seq)` at `syncRate` Hz, applies the remote P2's `input` stream to `coopManager`.
- **CoopManager.js** — spawns P2 via `createCatShip`, sets `game.players=[p1,p2]` + `game.player2`, applies `PLAYER2` HP/shield/lives scaling, drives P2 from local keyboard (`local`) or remote input (`remote`), P2 auto-aim, co-op game-over (both ships dead).
- **ClientMirror.js** — client-side mirror: sends P2 input, maintains mirror Player/Enemy/Boss instances from host state, renders the mirror world, and updates the local `game.player`/`game.player2` placeholders for the HUD.
- **NetSettingsUI.js** — the `#net-settings` panel in the settings screen: role select, host IP/port, HOST GAME / JOIN GAME buttons, net status, E6 export/import.
- **server.mjs** — Node `ws` relay (Node-only, NOT inlined into the build). Pure relay enforcing host-authoritative direction: host→client `state`/`event`/`welcome`, client→host `input`/`hello`, either→other `bye`. Run with `npm run lan`.

**E6 data files (`net/data/`):** `multiplayer.config.e6`, `player1.profile.e6`, `player2.profile.e6`. A `lan-state.e6` is **not** required — the live state is sent over the wire in real-time (E6 blocks inside a JSON `state` message), never persisted to disk; the relay server holds no state.

**Key contracts (v3.20.0):**
- **Bullet ownership** — `Bullet.owner` is set by `PlayerWeapons`/`Player`/`BaseRocket`/`MiniShip`; `Combat.onEnemyDeath(game, enemy, owner)` credits both `game.score` and `owner.score`.
- **Per-player collisions** — `Collisions.runCollisions` iterates `game.players` (fallback `[game.player]`), skipping `p.dead`; enemy bullets, enemy rams, and powerup pickup apply per-player via `game.hitPlayer(dmg, player)` / `game.collectPowerUp(pw, player)`.
- **Co-op game-over** — `Game.gameOver()` continues if `coopManager.active && players.some(p => !p.dead)`; `Player.hit()` sets `p.dead` + calls `gameOver()` on final death.
- **Client placeholders** — `ClientMirror.start()` creates a local `game.player2` placeholder (P1 is created by `Game.start()`) so the P2 HUD updates from host state.
- **Net HUD** — `#net-hud` (in-game) + `#p2-hud` (P2 callsign/lives/score/HP/shield) are driven by `HUD._updateP2Hud()` and `main.js` net-status wiring.

## Key Cross-File Contracts (refactor hot spots)

- **Stage flow (v3.76.0)** — `LevelRegistry.STAGE_SEQUENCE` is the single source of truth for stage cadence; `Game.js` drives `activeStage.update(dt)` / `activeStage.isComplete()`; new bonus stages register in `BONUS_STAGES` and implement the uniform interface (`init`/`update`/`isComplete`/`cleanup`) — they never mutate game state directly or call `waveManager.startNext()`. The HUD bonus label comes from `levelRegistry.labelFor()`; DevPanel forced bonuses go through `levelRegistry.forceBonus()`.
- **Config split (v3.77.0 E6)** — `js/core/config.js` is a compatibility re-export shim over `js/core/config/` (viewport / player / weapons / enemies / drops / stages); the public surface (24 named exports) is unchanged. New tunables go into the matching submodule and are re-exported from `config.js`.
- **Game.js thin shell (v3.77.0 E6)** — `Game.js` delegates to `js/core/game/` (StageFlow / DisplayPolicy / GameOver / Gameplay); submodules take `game` as the first parameter and `Game.js` calls them with `this`. Source-level gate pins stay in `Game.js` (gates read the file directly): `VERSION = 'v3.77.0'` ([6aa]), the `LevelRegistry` import + `activeStage.update(dt)` / `isComplete()` / `advanceStage()` core-loop lines ([6z]), the `stunRockets` / `napalmRockets` imports + `update(this, dt)` ticks ([6w]), the `type: rollPowerUpDrop()` crate-drop line + `Game.prototype.collectPowerUp` ([2]), the shuttle wave event (`currentSpecies === 'shuttle'` / `SHUTTLE INTERCEPT`, [6ab]), and the `this.bonus.draw(ctx)` hook ([6h]).
- **DOM ids** — `main.js`, `Game.js`, `HUD.js`, `InputManager.js` all reference ids that must match `index.html`: `#game-canvas`, `#start-btn`, `#retry-btn`, `#save-score`, `#initials`, `#menu-scores-list`, `#go-scores-list`, `#version-label`, `#touch-ui`, `#joy-base`/`#joy-knob`, `#btn-fire`/`#btn-boost`/...
- **Theme IDs** — the generated `data-theme` cards ↔ `CatShipFactory` REGISTRY ↔ `PLAYER_THEMES` keys in `config.js` (9 themes: yellow/orange/white/gray/brown/blue/red/green/black; 5 have dedicated variant classes in `js/player/variants/`).
- **Enemy types** — `EnemyFactory` REGISTRY keys ↔ `ENEMY_TYPES` in `config.js` ↔ `WaveManager` wave definitions ↔ `DevPanel` spawn list.
- **Viewport** — v3.13.0: `GAME.W/H` in `config.js` is the native 1280×720 REFERENCE only. Live bounds are `game.viewW/viewH` (Game `W/H` mirror them and re-sync on resize) — all spawn/bounds/centering code must use live bounds.
- **Weapon IDs** — `WEAPONS` keys in `config.js` ↔ `Player`/`MiniShip` fire code ↔ `Combat.applyWeaponHit` rules ↔ `DevPanel`.
- **Ultimates** — the `createCatShip` call in `Game.js` is the single player spawn path; `ULTIMATE_COOLDOWN`/`ultimateName` are set per variant class.
- **EventBus** — the `bus` event names (e.g. `'banner'`) are the game-logic → HUD bridge; keep names stable.
- **Internet entourage (v3.15.0)** — `InternetBonus` tags the 8 orbiting Black Cats with `entourage = true` + `entouragePhase`; `BlackCatEnemy.draw()` renders the outfit via `BlackCatEntourage.drawEntourageOutfit()`; pendant time comes from `RealTimeClock.realTimeClock` (started/stopped by InternetBonus, ticked in its update). Art never touches `Date`; the clock module never draws.
- **Fleet deploy state (v3.16.0)** — `player.fleetDeployed` (boolean) is the single source of truth for docked vs deployed. `false` = minis docked + INERT (no fire, no weapon anim); `true` = minis in combat orbit, firing + animating. Set by `MiniDeploy.toggleFleetDeploy` (via `deployFleet` action / DebugBridge `deploy` command); reset to `false` on death, respawn, and `PlayerFleet.clearFleet`. `MiniDeploy.updateFleetDeploy` is the ONLY source of deployed-mini position (called before `MiniShip.update`); `MiniShip.update` skips dock-snapping when deployed. Weapon animation state (vulkanSpin / railCharge / plasmaPulse) is owned by `WeaponAnim.js`, ticked by Player/MiniShip, surfaced by PlayerShipArt/PlayerMiniArt, rendered by PlayerShipFx.drawWeaponPaw.

// Filename: Game.js
// Kitty Vs Everything — v3.76.0
// v3.76.0 (LevelRegistry refactor): stage sequencing is data-driven —
//          the LevelRegistry manifest (STAGE_SEQUENCE) decides what runs
//          next; Game.advanceStage() consumes it and drives the active
//          stage (WaveManager or a bonus stage) through the uniform
//          init/update/isComplete/cleanup interface. The core loop has no
//          stage-type branching; startBonusLevel()/startBonusSpecific()
//          now force a bonus via the registry (DevPanel).
// Orchestrator: state machine, fixed game loop, scoring, rendering.
// v3.70.0: MODULAR WEAPON ARCHITECTURE (Phase 3) — js/combat/Rockets.js
// (v3.11.0 shared stun/napalm rocket system) fully extracted into
// js/combat/BaseRocket.js (shared twin-salvo base) +
// js/combat/StunRockets.js (Q/H homing stun rockets) +
// js/combat/NapalmRockets.js (E/J napalm rockets); the update hook now
// ticks both module singletons (stunRockets.update + napalmRockets.update)
// before the bullet position integration, same ordering as before.
// v3.69.0: MODULAR WEAPON ARCHITECTURE (Phase 2) — js/combat/PulseCannon.js
// (Plasma Pulse) + js/combat/RailCannon.js (Rail Cannon) extracted; all
// three primary weapons are modular (Player.weapons registry). No
// orchestrator logic changes (weapons live in the player + combat modules).
// v3.68.0: MODULAR WEAPON ARCHITECTURE (Phase 1) — new js/combat/BaseWeapon.js
// abstract base class + js/combat/VulcanCannon.js (Vulcan Cannon extracted
// from PlayerWeapons.firePrimary); Player.js owns the p.weapons registry and
// PlayerWeapons.js delegates fire / state tick / reset to it. No
// orchestrator logic changes (weapons live in the player + combat modules).
// v3.67.0: Squirrel enemy (19th species) — SquirrelEnemy.js v1.0.0 renders
// the pixel-art squirrel from `.assets/Squirel pixel_art.png` via the
// AssetManager pipeline (key `squirrel`, 580×476 → 128×105) upright (head
// up, centered mass, bushy tail) with a scurry bounce + twitchy wobble +
// sprint stretch and a type-color accent glow; classic procedural squirrel
// kept as null-sprite fallback. Fast scurry + erratic hop movement, light
// aimed shot. Wave system wraps after 19 species (WAVE.SPECIES_COUNT 19).
// v3.66.0: Bat pixel-art sprite swap — BatEnemy.js v1.2.0 renders the
// pixel-art bat from `.assets/Bat-pixel-art.png` via the AssetManager
// pipeline (key `bat`, 679×367 → 128×69) upright (head/ears up, wings
// spread) with a wing-beat squash + flutter wobble + hover bob
// (phase-locked to the procedural flap) and a type-color accent glow;
// classic procedural bat kept as null-sprite fallback. Erratic jitter
// movement and the aimed single-shot attack are unchanged.
// v3.65.0: Falcon pixel-art sprite swap — FalconEnemy.js v1.2.0 renders the
// pixel-art falcon from `.assets/Falcon pixel_art.png` via the AssetManager
// pipeline (key `falcon`, 718×718 → 128×128) with a beak-lead dive rotation
// + wing-beat + type-color glow; classic procedural falcon kept as
// null-sprite fallback. Movement (hover descent + straight dive) and the
// aimed single-shot attack are unchanged.
// v3.64.0: Dragon pixel-art sprite swap — DragonEnemy.js v1.2.0 renders the
// pixel-art dragon from `.assets/Dragon-pixel-art.png` via the AssetManager
// pipeline (key `dragon`, 800×800 → 128×128) — aspect-preserving
// nearest-neighbor draw centered on the hitbox with a flight gait
// (sway/bob/bank, phase-locked to the hover weave + wing-beat) and a
// type-color accent glow pass; classic procedural dragon kept as
// null-sprite fallback. Movement (hover weave) and the fire-breath cone
// attack are unchanged.
// v3.63.0: Lizard pixel-art sprite swap — LizardEnemy.js v1.2.0 renders the
// pixel-art lizard from `.assets/Lizard pixel_art.png` via the AssetManager
// pipeline (key `lizard`, 507×656 → 99×128) — full pixel-art shading/depth/
// charcoal-scale texture, aspect-preserving nearest-neighbor draw centered
// on the hitbox with a tank gait (sway/bob/tilt, phase-locked to the
// fixed-altitude hover bob), ground shadow, and a type-color accent glow
// pass; classic procedural lizard kept as null-sprite fallback. Movement
// (fixed altitude) and the 3-way acid spit attack are unchanged.
// v3.62.0: Wolf pixel-art sprite swap — WolfEnemy.js v1.2.0 renders the
// pixel-art wolf from `.assets/Wolf-pixel-art.png` via the AssetManager
// pipeline (key `wolf`, 675×708 → 122×128) — full pixel-art shading/depth/
// fur texture, aspect-preserving nearest-neighbor draw centered on the
// hitbox with a pack-sine gait (sway/bob/tilt, phase-locked to the
// movement sine), ground shadow, and a type-color accent glow pass;
// classic procedural wolf kept as null-sprite fallback. Movement (pack
// sines) and the aimed shot attack are unchanged.
// v3.61.0: Snake pixel-art sprite swap — SnakeEnemy.js v1.2.0 renders the
// pixel-art snake from `.assets/snake pixel_art.png` via the AssetManager
// pipeline (key `snake`, 714×713 → 128×128) — dark charcoal scales with
// gold-amber highlights and red accents, aspect-preserving nearest-neighbor
// draw centered on the hitbox with a slither gait (sway/ripple/tilt/
// breathing, phase-locked to the movement sine), ground shadow, and a
// type-color accent glow pass; classic procedural serpent kept as
// null-sprite fallback. Movement (sine slither + baseX weave) and the
// strike attack are unchanged.
// v3.59.0: double-sized power-up icons — PowerUp.js v3.59.0 renders every
// drop at 2× the v3.58.x icon size and doubles the pickup hitbox (drop
// 14 → 28, crate 18 → 36); Collisions.js reads pw.radius dynamically, so
// no orchestrator changes.
// v3.58.1: release version bump — PowerUp.js v3.58.1 fixes the mini drop
// to draw the imported "wanted" pixel art (78×128) instead of the old
// embedded 28×28 MiniPosterSprite. No orchestrator changes.
// v3.58.0: batch power-up pixel-art integration — PowerUp.js v3.58.0 draws
// all five drop types (life / health / frenzy / shield / mini) from the new
// pill/poster pixel art with color-matched glows + sparkle fields (6-pass
// drawJewelDrop, pass-order fix); AssetManager.js POWERUP_ASSETS gains
// mini→"wanted". Release version bump only; no orchestrator changes.
// v3.57.0: spider pixel-art sprite swap — SpiderEnemy.js v1.2.0 draws the
// shared PNG (.assets/Spider-pixel_art.png, 390×532 → 94×128, key "spider")
// with full pixel-art shading/depth/charcoal texture, a crawler
// bob/sway/tilt gait + ground shadow, and a BRIGHT RED HOURGLASS mark on
// the dorsal section; procedural spider kept as null-sprite fallback.
// Release version bump only; no orchestrator changes.
// v3.56.0: release version bump — player shield ring now clears the guns
// (PlayerRenderer.js: SHIELD_BUBBLE_RADIUS 48→60, rim 2.5→1.5) and the Fire
// Control Panel + minimized bar turn yellow (style.css). Release version
// bump only; no orchestrator changes.
// v3.55.0: crosshair offset range widened — the Dev panel reticle-distance
// slider now spans 140–340 logical px (was 24–160). Settings.js LIMITS is
// the single source of truth (min 140 / max 340 / default 140); Crosshair.js
// clamps the drawn offset to that range defensively.
// v3.54.0: bonus stage backdrop hook — render() calls this.bonus.draw(ctx)
// (BonusLevel.js v2.2.0 delegates to the active bonus); BoneYardBonus.js
// v3.15.0 renders the seeded pixel-art yard (skeleton/skull/femur/
// profile-bone) and BoneFragment.js v2.2.0 draws femur/profile-bone
// sprites.
// v3.53.0: beetle enemy sprite swap — BeetleEnemy.js v1.2.0 now draws the
// shared pixel-art PNG (Beetle-new-pixel-art.png, 665×693 → 123×128, key
// "beetle") aspect-preserving with a charge-lunge scale pulse; procedural
// beetle kept as null-sprite fallback. Release version bump only.
// v3.52.0: moth enemy — 18th species (regular waves only, MothEnemy.js).
// Bone Yard Phase 2 stays standard-humanoid via an explicit allowlist
// (BoneYardBonus.js). Release version bump only.
// v3.51.0: release version bump — PowerUp.js v3.51.0 adds programmatic JEWEL
// SHADING to the frenzy / extra-life / shield drops (drawJewelDrop(): aura →
// base → bevel depth → specular shine → shimmer). No orchestrator changes.
// v3.50.0: space shuttle enemy — 17th species (regular waves only,
// ShuttleEnemy.js). Bone Yard Phase 2 stays standard-humanoid via an
// explicit allowlist (BoneYardBonus.js). Release version bump only.
// v3.49.0: butterfly enemy now draws the shared top-down pixel-art PNG
// (Butteryfly pixel_art.png, 530×343 → 128×83, key "butterfly") with a
// smooth overhead wing-beat (sinusoidal scaleY + subtle wing-fold + slow
// rotation wobble); classic procedural butterfly kept as null-sprite fallback.
// v3.48.0: procedural aim reticle — Crosshair.js draws a neon crosshair
// (two concentric circles + center dot + 4 ticks) offset in front of the
// nose along the ship's heading, rotating with it. Toggle: Settings → FX
// (SETTINGS.crosshair, default ON); live offset: Dev panel slider
// (SETTINGS.crosshairOffset, 140–340 logical px since v3.55.0). Drawn in logical viewport
// coordinates, so ultrawide scaling needs no per-width compensation.
// v3.47.0: Synergy Explosion is key-triggered — the 'synergy' action
// (T / - default, P2 co-op ,) fires PlayerFleet.superWeapon when the
// color-match meter is full, replacing the old 10s auto-fire. TestAimbot
// hotkey moved T → F8 (TestAimbot.js).
// v3.96.0: the 'synergy' action is now FLEET ORBIT — T toggles the mini
// fleet between docked and orbiting the hull (MiniDeploy.js).
// v3.43.0: alien UFO pixel-art sprite swap — AlienEnemy.js draws one of two
// shared UFO PNGs (asset keys ufo1/ufo2) with a random per-instance skin.
// v3.42.0: crate destruction spills one drop from the shared POWERUP_DROPS
// pool (config.js) — Health / Frenzy / Shields / Wanted (mini) / Extra Life.
// v3.27.0: EasterEgg.js is now the easter-egg manager — one slot per egg
// (game.eggs = { bender, ship }), both can be alive at the same time:
// Bender (robot power-up, aim-assist) and the Planet Express ship flyby
// (dev panel "Drop Ship" → switchEgg(game, 'ship')). The game.aimbot
// surface is unchanged (trigger/reset/update/draw + active/aimbotActive/
// killCount/onEnemyKilled — v3.29.0 kill-based Bender dialogue).
// v3.31.0: POINTER LOCK POLICY — the cursor is hidden + the pointer locked
// during active local play (playing/bonus, unpaused, settings closed) and
// restored for pause/settings/game-over/menu. InputManager.js owns the DOM
// mechanics; _syncCursor() runs on every state transition (start/restart
// via PauseMenu.close, pause toggle, settings open/close, gameOver). An
// unexpected lock loss (ESC / alt-tab) auto-pauses via PauseMenu — the
// browser consumes the Escape keydown while locked, so the game can't see
// it. The LAN client state never locks (P2 doesn't use the mouse).
// v3.13.0: DYNAMIC VIEWPORT — game dimensions come from ViewScaler.js
// (view.viewW/viewH, seamless ultra-wide support) instead of fixed
// GAME.W/GAME.H: starfield re-inits on resize, render clears the live
// viewport, viewW/viewH getters expose live bounds to enemies/levels.
// v3.11.0: fireZones lifecycle (lingering napalm pools), rocket steering
//          hook (updateRockets), asteroid chain destruction
//          (destroyAsteroid), and boss-tier (special) enemy phase-out
//          on game over.
// v3.12.0: ViewScaler — stage auto-fits any window/ultrawide display
//          (uniform scale + crisp q× canvas buffer; render() applies the
//          matching base transform) and U toggles browser fullscreen.
// Collisions / homing / starfield are extracted modules (v3.3.0):
//   Collisions.js (runCollisions — fleet damage routing: minis first),
//   Homing.js     (updateHoming — full homing + mild tracking),
//   Starfield.js  (initStars / updateStars / drawStars — game.stars owned here).
// v3.1.0: Replaced ELEMENTS with WEAPONS. Replaced applyElementalHit with
//         applyWeaponHit. Updated onEnemyDeath signature. Added tracking support.
// v3.3.0: Module split (Collisions / Homing / Starfield) + mini powerups now
//         always dock a same-color clone (PlayerFleet.addMini).
// v3.34.0: DevPanel.js redesign (scrollable admin panel, resolution-adaptive) —
//          release version bump only; no Game.js logic changes.
// v3.77.0: Phase 4 lock-in — milestone version sync (check.mjs [6aa] now
//          includes Game.js as a version-sync location).
// v3.77.0: E6 modularization — stage lifecycle / display policy / game-over
//          sequence / combat housekeeping extracted to js/core/game/
//          submodules; this file keeps the orchestrator (constructor,
//          start, loop, update, render, collectPowerUp, destroyCrate,
//          startCombatStage) + thin delegate methods, so the public
//          surface and all source-level gate pins are unchanged.
// v3.79.0: Version label synced (dock arc coupler upgraded to a procedural
//          pulsing plasma arc in PlayerShipFx.js — no orchestrator changes).
// v3.80.0: Version label synced (drop rarity overhaul: robot SUPER RARE,
//          both ships in/out every level, constant asteroids, occasional
//          crates — config/drops.js + WaveManager.js).
// v3.81.0: Version label synced (Spaceballs One easter-egg ship — rare
//          per-wave spawn, unstoppable diagonal sweep, treasure-chest
//          jackpot on destruction — js/modes/EasterEggs/SpaceballsOne/).
// v3.83.0: DROP POLICY — crate destruction spills through the DropManager
//          (DROP_POLICY.crate: 100% chance, up to 2 drops, on-screen only).
// v3.84.0: TELEGRAPHED ENEMY ATTACKS + ON-DEATH HAZARDS — standard enemies
//          (EnemyBase) opt into telegraphed attacks (drawAttackTelegraph after
//          e.draw) and on-death hazards (game.enemyHazards, updated/drawn after
//          the fire zones). Easter Egg ships are unaffected.
// v3.88.0: GLOBAL CRISP PIXEL-ART RENDERING — the main canvas 2D context
//          disables image smoothing at init (ViewScaler re-applies after
//          each buffer resize; style.css forces image-rendering on all
//          canvas/img elements). Milestone version synced across
//          package.json, config.js, main.js, Game.js, HUD.js and index.html.
//          (The v3.88.0 global CSS rule was reverted in v3.88.1 — see
//          below.)
// v3.88.1: CRISP PASS ISOLATION — the main gameplay canvas keeps its
//          crisp nearest-neighbor rendering (disableImageSmoothing at
//          init, re-applied by ViewScaler after each buffer resize) and
//          style.css now scopes image-rendering strictly to #game-canvas;
//          the hangar hero canvas and all UI return to normal smooth
//          rendering. Milestone version synced across package.json,
//          config.js, main.js, Game.js, HUD.js and index.html.
// v3.90.0: CRISP 256×384 NATIVE CATSHIP HANGAR — the 9 catship assets
//          are now the native 256×384 PNGs (importer catship ceiling 512,
//          art embeds untouched) and the hangar hero stage is sized to the
//          native frame (320×384 CSS px, buffer ×DPR). The v3.89.0 1:1
//          integer mapping is preserved (HANGAR_K = max(1, round(DPR)));
//          each ship's content box is blitted at the identical scale,
//          centered on the FIXED stage midpoint (160, 192) — completely
//          stationary (no bounce), razor-sharp. No orchestrator changes.
//          Milestone version synced with package.json.
// v3.89.0: CRISP HANGAR PREVIEW (1:1 INTEGER MAPPING) — the hangar hero
//          canvas (main.js) rejoins the crisp set: its cat sprites are
//          blitted at the integer HANGAR_K 1:1 scale with
//          disableImageSmoothing, content-centered on the shared stage
//          center (160, 110); the gameplay canvas is unchanged.
//          Milestone version synced across package.json, config.js,
//          main.js, Game.js, HUD.js and index.html.
// v3.97.0: HAZARDS — new independent hazard field (js/hazards/): 10
//          non-lootable, shootable environmental obstacles drift in from
//          any edge on the HazardManager's own spawner (separate from
//          enemy waves, power-ups and easter eggs); Game.js ticks
//          game.hazards.update() in the core loop and game.hazards.draw()
//          in render (pools → sprites → shockwaves → nuke flash);
//          Collisions.js routes friendly bullets into the hazard list
//          (pop early → per-type explosion → ZERO loot).
// v3.98.0: HANGAR_ZOOM 1.0 (exact in-game hangar scale) + the F9 admin
//          panel is gated behind the terminal passphrase prompt
//          (DevPanel.js). Milestone version synced with package.json.
// v3.99.0: SEARCH & DESTROY — the new sector-journey game mode
//          (js/modes/SearchAndDestroy/, E6 nested modules): a large
//          2D world-space coordinate grid with a rotational background
//          camera (SectorMap), a sequenced journey — OPEN SPACE → THE
//          BONEYARD → DEEP SECTOR (SectorSpawner) — anchored by
//          Eridath's Mom's House, a persistent shootable enemy-spawning
//          base (SectorCombatManager), and a toggleable cockpit radar
//          HUD (RadarManager, F1). The mode is a world-space CAMERA
//          LAYER over the untouched screen-space combat stack — full
//          parity with all 9 Catships, the Vulcan/Plasma/Rail weapons
//          and the shared power-up pool. Game.start(theme, { mode:
//          'sard' }) enters it; the core loop drives game.sard.update
//          and render() swaps in the sector background + radar HUD.
// v4.0.0: SEARCH & DESTROY — the sector-journey mode stamps 4.0.0: the
//          DISPLACEMENT-ACCUMULATOR camera (SectorMap) replaces the
//          v3.99.0 pan+rotation model — the player's screen offset is
//          tracked against a dead zone, the excess delta is accumulated
//          into world coordinates (worldX/worldY) and the ship is
//          softly recentered (the world scrolls fluidly around the
//          untouched screen-space combat layer — PlayerFlight stays
//          sovereign); debris, hazards and regional patrols are
//          WORLD-ANCHORED at absolute world coordinates. Milestone
//          version synced with package.json.
export const VERSION = 'v4.1.0';
import { LIFE_SCORE_INTERVAL, PLAYER } from './config.js';
import ViewScaler from './ViewScaler.js'; // v3.12.0: display scaling + fullscreen (U)
import { loadAssets } from './AssetManager.js'; // v3.33.0: shared PNG pipeline (power-up art)
import InputManager from '../input/InputManager.js';
import ParticleSystem from './ParticleSystem.js';
import { createCatShip } from '../combat/CatShipFactory.js'; // v3.71.0: modular combat
import { spawnSourceDrops } from './DropManager.js'; // v3.83.0: crate spill drop
import WaveManager from './WaveManager.js';
import BonusLevel from '../levels/BonusLevel.js';
import LevelRegistry, { STAGE_SEQUENCE, BONUS_STAGES } from '../levels/LevelRegistry.js'; // v3.76.0 (v3.77.0 E6: BONUS_STAGES now consumed by game/StageFlow.js — import kept for the [6z] pin)
import EasterEgg from './EasterEgg.js';
import HUD from '../ui/HUD.js';
import Leaderboard from '../ui/Leaderboard.js';
import DevPanel from '../ui/DevPanel.js';
import { runCollisions } from '../combat/Collisions.js';
import { updateHoming } from '../combat/Homing.js';
import { stunRockets } from '../combat/StunRockets.js'; // v3.70.0: modular stun rockets (Q/H)
import { napalmRockets } from '../combat/NapalmRockets.js'; // v3.70.0: modular napalm rockets (E/J)
import { drawAttackTelegraph } from '../enemies/EnemyAttackModule.js'; // v3.84.0: telegraphed enemy attacks
import { updateEnemyHazards, drawEnemyHazards } from '../enemies/EnemyHazard.js'; // v3.84.0: on-death hazards
import HazardManager from '../hazards/HazardManager.js'; // v3.97.0: independent hazard field
import { initStars, updateStars, drawStars } from './Starfield.js';
import { bus } from './EventBus.js';
import { audio } from './AudioSystem.js';
import { rand, disableImageSmoothing } from './utils.js'; // v3.88.0: crisp pixel-art enforcement
// ─── v3.14.0: settings / keybinds / console / pause / aimbot / debug ───
import { SETTINGS } from '../ui/Settings.js';
import { KEYBINDS } from '../input/Keybinds.js';
import MessageLog from '../ui/MessageLog.js';
import PauseMenu from '../ui/PauseMenu.js';
import TestAimbot from '../combat/TestAimbot.js';
import HUDConsole from '../ui/HUDConsole.js';
import HUDFireControl from '../ui/HUDFireControl.js';
import SettingsScreen from '../ui/SettingsScreen.js';
import Crosshair from '../ui/Crosshair.js'; // v3.48.0: procedural aim reticle
import DebugBridge from '../ui/DebugBridge.js';
// ─── v3.20.0: LAN / local co-op (P2) ───
import coopManager from '../../net/CoopManager.js';
import clientMirror from '../../net/ClientMirror.js';
import netSettings from '../../net/NetSettings.js';
// ─── v3.77.0: E6 modularization — Game.js submodules (delegates below) ───
import { advanceStage, startBonusStage, startBonusLevel, startBonusSpecific, restartLevel } from './game/StageFlow.js';
import { checkViewportChange, wantsPointerLock, syncCursor, settingsOpen, onPointerLockChange } from './game/DisplayPolicy.js';
import { gameOver } from './game/GameOver.js';
import { hitPlayer, destroyAsteroid, checkScoreLives, cleanup, spawnEnemyBullet } from './game/Gameplay.js';
import SearchAndDestroy from '../modes/SearchAndDestroy/index.js'; // v3.99.0: Search & Destroy mode facade

export default class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // v3.88.0: crisp pixel-art — nearest-neighbor drawImage on the main
    // canvas (ViewScaler re-applies this after every buffer resize).
    disableImageSmoothing(this.ctx);
    this.view = new ViewScaler(this.canvas); // v3.12.0: fit stage to display, U = fullscreen
    // v3.13.0: W/H mirror the LIVE logical viewport so legacy game.W/H
    // consumers (enemies, EasterEgg, DevPanel, bonuses) track ultra-wide.
    // GAME.W/H stays the native 1280×720 reference (Viewport.js fit math).
    this.W = this.view.viewW;
    this.H = this.view.viewH;
    this.input = new InputManager(this.canvas, this.view); // v3.13.0: live viewport for mouse mapping
    // v3.31.0: pointer-lock policy — auto-pause when the browser releases
    // the lock mid-mission (ESC is consumed by the browser while locked).
    this.input.onLockChange = (locked) => this._onPointerLockChange(locked);
    // v3.33.0: kick off the shared-PNG decode (power-up art) — fire and
    // forget; drops draw their procedural glyphs until the canvases land.
    // Headless-safe: resolves immediately with nothing decoded under Node.
    loadAssets();
    this.particles = new ParticleSystem();
    this.hud = new HUD(this);
    this.leaderboard = new Leaderboard();
    this.aimbot = new EasterEgg(this); // v3.27.0: easter-egg manager (Bender + ship slots)
    this.waveManager = new WaveManager(this);
    this.bonus = new BonusLevel(this);
    // v3.76.0: data-driven stage sequencing — the LevelRegistry owns the
    // run's stage manifest (combat waves + bonus rounds). advanceStage()
    // consumes it; the core loop no longer branches on stage type.
    this.levelRegistry = new LevelRegistry(STAGE_SEQUENCE);
    this.waveManager.bonusEvery = this.levelRegistry.bonusInterval || 4;
    this.activeStage = null;
    this.dev = new DevPanel(this);
    this.crosshair = new Crosshair(this); // v3.48.0: procedural aim reticle
    this.state = 'menu';
    this.mode = 'classic'; // v3.99.0: 'classic' | 'sard' (Search & Destroy)
    this.sard = null;      // v3.99.0: the SearchAndDestroy facade (live in SAR mode)
    this.score = 0;
    this.multiplier = 1;
    this.time = 0;
    this.nextLifeAt = LIFE_SCORE_INTERVAL;
    this.player = null;
    this.players = [];      // v3.20.0: all live player ships (P1 + P2 in co-op)
    this.player2 = null;    // v3.20.0: the second cat ship (co-op / host)
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
    this.bonusTargets = [];
    this.fireZones = [];   // v3.11.0: lingering napalm pools (FireZone.js)
    this.enemyHazards = [];   // v3.84.0: on-death hazards (EnemyHazard.js)
    this.hazards = new HazardManager(this); // v3.97.0: independent hazard field (js/hazards/)
    this.shake = 0;
    this.godMode = false;
    this.paused = false;
    this.stars = initStars(this.view.viewW, this.view.viewH);
    this._starW = this.view.viewW; // v3.13.0: re-init stars on viewport resize
    this._starH = this.view.viewH;
    this.lastTs = 0;
    // ─── v3.14.0: settings / console / pause / aimbot / debug bridge ───
    this.version = VERSION;
    this.settingsObj = SETTINGS;   // DebugBridge alias
    this.keybindsObj = KEYBINDS;   // DebugBridge alias
    this.msglog = new MessageLog();
    this.pauseMenu = new PauseMenu(this);
    this.testAimbot = new TestAimbot(this);
    this.hudConsole = new HUDConsole(this);
    this.hudFireControl = new HUDFireControl(this);
    this.settings = new SettingsScreen(this);
    this.debugBridge = new DebugBridge(this);
    audio.setVolumes(SETTINGS.audioMaster, SETTINGS.audioSfx, SETTINGS.audioMusic);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  /** v3.13.0: live viewport bounds (dynamic ultra-wide width). */
  get viewW() { return this.view.viewW; }
  get viewH() { return this.view.viewH; }

  /** v3.13.0: rebuild the starfield when the logical viewport resizes.
   *  v3.77.0 E6: logic lives in js/core/game/DisplayPolicy.js. */
  _checkViewportChange() { checkViewportChange(this); }

  // ─── v3.31.0: POINTER LOCK POLICY (DOM mechanics live in InputManager.js) ───
  // v3.77.0 E6: policy logic lives in js/core/game/DisplayPolicy.js —
  // these delegates keep the public surface (PauseMenu / SettingsScreen
  // call game._syncCursor()).

  /** True while the cursor should be hidden + locked: active LOCAL play
   *  (P1 owns the mouse — the LAN client's P2 never does), unpaused, and
   *  the settings screen closed. Menu / game-over / client never lock. */
  _wantsPointerLock() { return wantsPointerLock(this); }

  /** Lock the pointer for active play / restore the cursor otherwise. */
  _syncCursor() { syncCursor(this); }

  _settingsOpen() { return settingsOpen(this); }

  /** pointerlockchange callback: an unexpected lock loss mid-mission (ESC /
   *  alt-tab) pauses the game — the browser consumes the Escape keydown
   *  while locked, so PauseMenu's own keydown handler never sees it. */
  _onPointerLockChange(locked) { onPointerLockChange(this, locked); }

  /** v3.14.0: DebugBridge alias — current wave (reads/writes WaveManager). */
  get wave() { return this.waveManager.wave; }
  set wave(v) { this.waveManager.wave = v; }

  /** v3.14.0: DebugBridge alias — enemy bullets in flight. */
  get ebullets() { return this.bullets.filter(b => !b.friendly); }

  /** v3.14.0: pause handling moved to PauseMenu.js (Esc / P / ⏸ button). */

  start(theme, opts = {}) {
    this.score = 0;
    this.multiplier = 1;
    this.time = 0;
    this.nextLifeAt = LIFE_SCORE_INTERVAL;
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
    this.bonusTargets = [];
    this.fireZones = [];
    this.enemyHazards = [];   // v3.84.0
    this.hazards.reset(); // v3.97.0: fresh hazard field per mission
    this.player = createCatShip(theme, this);
    this.player.score = 0;        // v3.20.0: per-player score
    this.players = [this.player]; // v3.20.0: P1 always
    this.player2 = null;
    this.state = 'playing';
    this.godMode = false;
    this.shake = 0;
    this.paused = false;
    this.particles.clear();
    this.aimbot.reset();
    if (this.testAimbot) this.testAimbot.active = false; // v3.14.0: no carry-over
    this.hud.floaters = [];
    this.msglog.clear(); // v3.14.0: fresh mission log
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('fc-dashboard').classList.remove('hidden'); // v3.14.0: bottom fire-control panel
    this.hudFireControl.setMinimized(false); // v3.21.0: new missions start expanded
    this.pauseMenu.close(); // v3.14.0: hides overlay + starts mission music
    this.msglog.log('MISSION START', 'info', this.time);
    this.levelRegistry.reset(); // v3.76.0: restart the stage manifest
    this.waveManager.reset();
    // v3.99.0: MODE BRANCH — Search & Destroy is a sector journey driven by
    // the SAR facade (camera + spawners + house base + radar); classic runs
    // the WaveManager stage manifest. SAR also frees the ship from the
    // classic screen bounds (the camera tether replaces wrap/bounce).
    if (opts.mode === 'sard') {
      this.mode = 'sard';
      if (this.sard) this.sard.destroy();
      this.sard = new SearchAndDestroy(this);
      this.activeStage = null; // SAR facade is driven directly in update()
      this.player.freeBounds = true; // v3.99.0: camera tether, not wrap/bounce
    } else {
      this.mode = 'classic';
      this.sard = null;
      this.player.freeBounds = false;
      this.waveManager.startNext();
      this.activeStage = this.waveManager; // v3.76.0
    }
    // v3.20.0: LAN / local co-op modes (netSettings.role is the source of truth;
    // opts.role / opts.coop / opts.client are honored as explicit overrides).
    const role = opts.role || (opts.client ? 'client' : (opts.coop ? 'coop' : netSettings.role));
    if (role === 'client') {
      this.state = 'client';
      clientMirror.start(this, opts.p2Theme || 'orange');
    } else if (role === 'coop' || role === 'host') {
      coopManager.start(this, theme, opts.p2Theme || 'orange');
    }
    this._syncCursor(); // v3.31.0: lock for local play, release for LAN client
  }

  /**
   * v3.76.0: the active stage (combat wave or bonus round) has finished —
   * the LevelRegistry manifest decides what runs next. No stage-type
   * branching in the core loop.
   * v3.77.0 E6: logic lives in js/core/game/StageFlow.js.
   */
  advanceStage() { advanceStage(this); }

  /** v3.76.0: start the next standard combat wave (WaveManager). */
  startCombatStage() {
    this.bonus.setStage(null);
    this.activeStage = this.waveManager;
    this.state = 'playing';
    this.waveManager.startNext();
    // v3.77.0: SHUTTLE WAVE EVENT — WaveManager.startNext() already banners
    // "WAVE N — SHUTTLE"; the console carries the event detail: every
    // destroyed Space Shuttle drops a guaranteed mini-ship power-up
    // (Combat.maybeDrop / SHUTTLE_DROP in config.js).
    if (this.waveManager.currentSpecies === 'shuttle') {
      this.msglog.log('SHUTTLE INTERCEPT — space shuttles inbound (destroy for mini-ship drops)', 'warn', this.time);
    }
  }

  /** v3.76.0: start a bonus round from a resolved manifest entry.
   *  v3.77.0 E6: logic lives in js/core/game/StageFlow.js. */
  startBonusStage(entry) { startBonusStage(this, entry); }

  // Dev-forced bonus (DevPanel 'dev-bonus'): random bonus, no manifest slot
  // consumed — the next registry entry is a combat wave.
  // v3.77.0 E6: logic lives in js/core/game/StageFlow.js.
  startBonusLevel() { startBonusLevel(this); }

  // Dev-forced bonus (DevPanel 'dev-bonus-bone' / 'dev-bonus-internet').
  // v3.77.0 E6: logic lives in js/core/game/StageFlow.js.
  startBonusSpecific(type) { startBonusSpecific(this, type); }

  /** v3.14.0: pause menu "RESTART LEVEL" — full mission reset, keeps theme.
   *  v3.77.0 E6: logic lives in js/core/game/StageFlow.js. */
  restartLevel() { restartLevel(this); }

  /** v3.77.0 E6: the game-over sequence lives in js/core/game/GameOver.js
   *  (co-op continuation guard, leaderboard, DOM overlay, pointer restore). */
  gameOver() { gameOver(this); }

  loop(ts) {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000 || 0.016);
    this.lastTs = ts;
    if (!this.paused) this.update(dt); // v3.14.0: paused gates the whole world
    this.hudConsole.update();     // v3.14.0: DOM combat console (every frame)
    this.hudFireControl.update(); // v3.14.0: DOM fire-control dashboard
    this.render();
    this.input.endFrame();
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    if (this.state !== 'menu') this.time += dt;
    this._checkViewportChange(); // v3.13.0: seamless resize handling
    updateStars(this.stars, dt, this.view.viewW, this.view.viewH);
    this.particles.update(dt);
    this.aimbot.update(dt);
    if (this.state === 'client') {
      // v3.20.0: LAN client — no local simulation; send P2 input + mirror.
      clientMirror.update(dt);
      this.shake = Math.max(0, this.shake - dt * 20);
      this.hud.update(dt);
      return;
    }
    if (this.state === 'playing' || this.state === 'bonus') {
      this.player.update(dt, this.input);
      if (coopManager.active) coopManager.update(dt); // v3.20.0: P2 (local / remote)
      this.testAimbot.update(dt); // v3.14.0: dev test aimbot (aim + fireNow)
      updateHoming(this, dt);
      stunRockets.update(this, dt); // v3.70.0: modular rocket steering/detonation before movement
      napalmRockets.update(this, dt); // v3.70.0: each singleton filters its own carriers
      for (const b of this.bullets) b.update(dt);
      for (const e of this.enemies) e.update(dt);
      for (const p of this.powerups) p.update(dt);
      for (const z of this.fireZones) z.update(dt); // v3.11.0: napalm pool DoT
      updateEnemyHazards(this, dt); // v3.84.0: on-death hazard pools/bombs (self-culls)
      this.hazards.update(this, dt); // v3.97.0: hazard field (own spawner; combat levels only)
      for (const bt of this.bonusTargets) bt.update(dt);
      // v3.76.0: the active stage (combat wave or bonus round) is driven
      // through the uniform LevelRegistry interface; completion advances
      // the manifest (Game.advanceStage) — no stage-type branching here.
      // v3.99.0: SEARCH & DESTROY — the sector journey is driven by the SAR
      // facade (camera + spawners + house base + radar) instead of the wave
      // manifest; activeStage stays null in SAR mode so the block below is
      // a no-op and the classic stage flow is untouched.
      if (this.mode === 'sard' && this.sard) this.sard.update(dt);
      if (this.activeStage) {
        this.activeStage.update(dt);
        if (this.activeStage.isComplete()) this.advanceStage();
      }
      runCollisions(this);
      this.cleanup();
      this.checkScoreLives();
    }
    this.shake = Math.max(0, this.shake - dt * 20);
    this.hud.update(dt);
  }

  /** v3.77.0 E6: logic lives in js/core/game/Gameplay.js. */
  hitPlayer(dmg, player = this.player) { hitPlayer(this, dmg, player); }

  collectPowerUp(pw, player = this.player) {
    const p = player || this.player;
    let customSound = false; // v3.86.0: true when the drop plays its own SFX (coin)
    switch (pw.type) {
      case 'life':
        p.lives++;
        bus.emit('banner', { text: 'EXTRA LIFE!', tone: 'good', duration: 1.5 });
        break;
      case 'health':
        // v3.33.0: hull repair — restore HEALTH_RESTORE HP (capped at maxHp)
        p.hp = Math.min(p.maxHp, p.hp + PLAYER.HEALTH_RESTORE);
        bus.emit('banner', { text: 'HULL REPAIRED +' + PLAYER.HEALTH_RESTORE, tone: 'good', duration: 1 });
        break;
      case 'shield':
        p.shield = p.maxShield;
        bus.emit('banner', { text: 'SHIELD RESTORED', tone: 'good', duration: 1 });
        break;
      case 'frenzy':
        // v3.33.0: FRENZY — every weapon cooldown removed for
        // PLAYER.FRENZY_DURATION seconds, including the Vulcan overheat
        // lockout (PlayerWeapons.js holds thermal/lockout at zero).
        p.activateFrenzy();
        break;
      case 'mini':
        // v3.3.0: minis always clone the player's theme (strict same-color)
        if (!p.addMini()) this.score += 500;
        break;
      case 'robot':
        this.aimbot.trigger(); // v3.24.0: Bender (v3.27.0: via the egg manager)
        break;
      case 'crate':
        this.score += 1000 * this.multiplier;
        break;
      case 'coin':
        // v3.86.0: GOLD COIN — +500 score, coin SFX, gold floating text +
        // burst. The coin plays its own audio.coin(), so the generic
        // audio.powerup() below is skipped (customSound).
        this.score += 500;
        audio.coin();
        customSound = true;
        bus.emit('dmg', { x: pw.x, y: pw.y, text: '+500', color: '#ffd54f' });
        this.particles.burst(pw.x, pw.y, { count: 64, color: '#ffd54f', speed: 420, life: 1.0 });
        break;
    }
    if (!customSound) audio.powerup();
  }

  destroyCrate(pw) {
    pw.alive = false;
    const pts = Math.round(2500 * this.multiplier);
    this.score += pts;
    this.multiplier = Math.min(10, this.multiplier + 0.5);
    // v3.83.0: crate spill routes through the DropManager (DROP_POLICY.crate:
    // 100% chance, up to 2 drops, on-screen sources only).
    spawnSourceDrops(this, 'crate', pw.x, pw.y, pw.radius);
    bus.emit('banner', {
      text: 'CRATE DESTROYED! +' + pts.toLocaleString() + ' (x' + this.multiplier.toFixed(1) + ')',
      tone: 'good', duration: 1.6,
    });
    this.particles.burst(pw.x, pw.y, { count: 32, color: '#ffd54f', speed: 320, life: 0.8 });
    this.shake = Math.max(this.shake, 5);
    audio.explosion();
  }

  /** v3.11.0: destructible asteroid chain power-up (AsteroidBonus.js).
   *  v3.77.0 E6: logic lives in js/core/game/Gameplay.js. */
  destroyAsteroid(a) { destroyAsteroid(this, a); }

  /** v3.77.0 E6: logic lives in js/core/game/Gameplay.js. */
  checkScoreLives() { checkScoreLives(this); }

  /** v3.77.0 E6: logic lives in js/core/game/Gameplay.js. */
  cleanup() { cleanup(this); }

  /** v3.77.0 E6: logic lives in js/core/game/Gameplay.js. */
  spawnEnemyBullet(x, y, angle, speed, damage, color) { spawnEnemyBullet(this, x, y, angle, speed, damage, color); }

  render() {
    const ctx = this.ctx;
    // v3.13.0: base transform for the crisp q× buffer (ViewScaler.js) —
    // everything below draws in logical viewport coordinates (viewW×viewH;
    // 1280×720 on 16:9, wider on ultra-wide — zero letterboxing).
    ctx.setTransform(this.view.q, 0, 0, this.view.q, 0, 0);
    ctx.clearRect(0, 0, this.view.viewW, this.view.viewH);
    ctx.save();
    if (this.shake > 0) ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    // v3.99.0: SEARCH & DESTROY — the sector map (world-space parallax
    // starfield + grid + zones + boneyard + house base) replaces the
    // classic screen-space starfield; classic keeps drawStars.
    if (this.mode === 'sard' && this.sard) this.sard.renderBackground(ctx);
    else drawStars(ctx, this.stars);
    if (this.state === 'client') {
      // v3.20.0: LAN client — render the host's mirror world.
      clientMirror.render(ctx);
      this.particles.draw(ctx);
      this.hud.draw(ctx);
      ctx.restore();
      return;
    }
    for (const z of this.fireZones) z.draw(ctx); // v3.11.0: napalm pools under everything
    drawEnemyHazards(this, ctx); // v3.84.0: on-death hazards under enemies
    this.bonus.draw(ctx); // v3.54.0 → v3.60.0: bonus stage draw hook (Bone Yard bones are destructible bonusTargets)
    for (const pw of this.powerups) pw.draw(ctx);
    this.hazards.draw(this, ctx); // v3.97.0: hazard pools → sprites → shockwaves → nuke flash
    for (const bt of this.bonusTargets) bt.draw(ctx);
    for (const e of this.enemies) { e.draw(ctx); drawAttackTelegraph(e, ctx); } // v3.84.0: telegraph after sprite
    if (this.player && !this.player.dead) this.player.draw(ctx);
    this.crosshair.draw(ctx); // v3.48.0: procedural aim reticle (offset + heading-rotated)
    if (coopManager.active) coopManager.render(ctx); // v3.20.0: P2
    for (const b of this.bullets) b.draw(ctx);
    this.particles.draw(ctx);
    this.aimbot.draw(ctx); // v3.27.0: easter eggs (Bender + Planet Express ship)
    this.testAimbot.draw(ctx); // v3.14.0: trajectory / reticle readout
    this.hud.draw(ctx);
    // v3.99.0: SEARCH & DESTROY — the house-base HP HUD + cockpit radar
    // (screen space, top of the stack, after the classic HUD).
    if (this.mode === 'sard' && this.sard) this.sard.renderHud(ctx);
    ctx.restore();
  }

  /**
   * v3.99.0: SEARCH & DESTROY victory — Eridath's Mom's House is destroyed.
   * The SAR facade calls this once the victory timer elapses. Reuses the
   * classic game-over screen as the "MISSION ACCOMPLISHED" state (the
   * title is swapped by GameOver.js on the SAR branch).
   */
  victory() {
    if (this.state !== 'playing') return;
    this.state = 'victory';
    bus.emit('banner', { text: 'MISSION ACCOMPLISHED', tone: 'good', duration: 4 });
    audio.superWeapon();
    this.msglog.log('MISSION ACCOMPLISHED — SECTOR CLEARED', 'good', this.time);
    this._syncCursor();
    gameOver(this);
  }
}

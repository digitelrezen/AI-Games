// Filename: Game.js
// Kitty Vs Everything — v3.69.0
// Orchestrator: state machine, fixed game loop, scoring, rendering.
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
export const VERSION = 'v3.69.0';
import { LIFE_SCORE_INTERVAL, PLAYER, rollPowerUpDrop } from './config.js'; // v3.42.0: crate drop pool
import ViewScaler from './ViewScaler.js'; // v3.12.0: display scaling + fullscreen (U)
import { loadAssets } from './AssetManager.js'; // v3.33.0: shared PNG pipeline (power-up art)
import InputManager from '../input/InputManager.js';
import ParticleSystem from './ParticleSystem.js';
import { createCatShip } from './CatShipFactory.js';
import Bullet from '../combat/Bullet.js';
import PowerUp from '../combat/PowerUp.js'; // v3.42.0: crate destruction drops
import WaveManager from './WaveManager.js';
import BonusLevel from '../levels/BonusLevel.js';
import EasterEgg from './EasterEgg.js';
import HUD from '../ui/HUD.js';
import Leaderboard from '../ui/Leaderboard.js';
import DevPanel from '../ui/DevPanel.js';
import { runCollisions } from '../combat/Collisions.js';
import { updateHoming } from '../combat/Homing.js';
import { updateRockets } from '../combat/Rockets.js'; // v3.11.0: stun/napalm rockets
import { destroyAsteroid as breakAsteroid } from '../levels/AsteroidBonus.js'; // v3.11.0
import { initStars, updateStars, drawStars } from './Starfield.js';
import { bus } from './EventBus.js';
import { audio } from './AudioSystem.js';
import { rand } from './utils.js';
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

export default class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
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
    this.dev = new DevPanel(this);
    this.crosshair = new Crosshair(this); // v3.48.0: procedural aim reticle
    this.state = 'menu';
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

  /** v3.13.0: rebuild the starfield when the logical viewport resizes. */
  _checkViewportChange() {
    if (this.view.viewW !== this._starW || this.view.viewH !== this._starH) {
      this._starW = this.view.viewW;
      this._starH = this.view.viewH;
      this.stars = initStars(this.view.viewW, this.view.viewH);
      this.W = this._starW; // v3.13.0: keep legacy W/H live on resize
      this.H = this._starH;
    }
  }

  // ─── v3.31.0: POINTER LOCK POLICY (DOM mechanics live in InputManager.js) ───

  /** True while the cursor should be hidden + locked: active LOCAL play
   *  (P1 owns the mouse — the LAN client's P2 never does), unpaused, and
   *  the settings screen closed. Menu / game-over / client never lock. */
  _wantsPointerLock() {
    return (this.state === 'playing' || this.state === 'bonus')
      && !this.paused
      && !this._settingsOpen();
  }

  /** Lock the pointer for active play / restore the cursor otherwise. */
  _syncCursor() {
    if (this._wantsPointerLock()) this.input.requestPointerLock();
    else this.input.releasePointerLock();
  }

  _settingsOpen() {
    const s = document.getElementById('settings-screen');
    return !!(s && !s.classList.contains('hidden'));
  }

  /** pointerlockchange callback: an unexpected lock loss mid-mission (ESC /
   *  alt-tab) pauses the game — the browser consumes the Escape keydown
   *  while locked, so PauseMenu's own keydown handler never sees it. */
  _onPointerLockChange(locked) {
    if (locked) return;
    if (this._wantsPointerLock()) this.pauseMenu.toggle();
  }

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
    this.waveManager.reset();
    this.waveManager.startNext();
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

  startBonusLevel() {
    this.state = 'bonus';
    this.msglog.log('BONUS LEVEL INBOUND', 'warn', this.time);
    this.enemies = [];
    this.bullets = this.bullets.filter(b => b.friendly);
    this.bonusTargets = [];
    this.bonus.start();
  }
  startBonusSpecific(type) {
    this.state = 'bonus';
    this.msglog.log('BONUS LEVEL INBOUND (' + type.toUpperCase() + ')', 'warn', this.time);
    this.enemies = [];
    this.bullets = this.bullets.filter(b => b.friendly);
    this.bonusTargets = [];
    this.bonus.startSpecific(type);
  }

  /** v3.14.0: pause menu "RESTART LEVEL" — full mission reset, keeps theme. */
  restartLevel() {
    const theme = this.player ? this.player.theme : 'yellow';
    this.start(theme);
    this.msglog.log('MISSION RESTARTED', 'warn', this.time);
  }

  gameOver() {
    // v3.20.0: co-op — the mission only ends when ALL ships are down.
    if (coopManager.active && this.players.some(p => !p.dead)) {
      bus.emit('banner', { text: 'CO-OP CONTINUES', tone: 'warn', duration: 1.5 });
      return;
    }
    this.state = 'gameover';
    this.paused = false;
    this._syncCursor(); // v3.31.0: restore the cursor for the game-over screen
    this.msglog.log('MISSION FAILED', 'bad', this.time);
    audio.stopMusic(); // v3.14.0: mission music ends with the mission
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('fc-dashboard').classList.add('hidden'); // v3.14.0: hide with the HUD
    document.getElementById('pause-overlay').classList.add('hidden');
    document.getElementById('gameover-screen').classList.remove('hidden');
    document.getElementById('final-score').textContent = 'FINAL SCORE: ' + this.score.toLocaleString();
    document.getElementById('initials').value = '';
    document.getElementById('save-score').disabled = false;
    this.leaderboard.render(document.getElementById('go-scores-list'));
    // v3.11.0: boss-tier (special) enemies are contained to the screen —
    // on game over they phase out with the round instead of lingering.
    for (const e of this.enemies) {
      if (e.special && e.alive) {
        this.particles.burst(e.x, e.y, { count: 24, color: e.color || '#fff', speed: 260, life: 0.6 });
        e.escaped = true;
        e.alive = false;
      }
    }
    audio.gameOver();
  }

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
      updateRockets(this, dt); // v3.11.0: rocket steering/detonation before movement
      for (const b of this.bullets) b.update(dt);
      for (const e of this.enemies) e.update(dt);
      for (const p of this.powerups) p.update(dt);
      for (const z of this.fireZones) z.update(dt); // v3.11.0: napalm pool DoT
      for (const bt of this.bonusTargets) bt.update(dt);
      if (this.state === 'playing') this.waveManager.update(dt);
      if (this.state === 'bonus') this.bonus.update(dt);
      runCollisions(this);
      this.cleanup();
      this.checkScoreLives();
    }
    this.shake = Math.max(0, this.shake - dt * 20);
    this.hud.update(dt);
  }

  hitPlayer(dmg, player = this.player) {
    if (this.godMode) return;
    if (player) player.hit(dmg);
  }

  collectPowerUp(pw, player = this.player) {
    const p = player || this.player;
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
    }
    audio.powerup();
  }

  destroyCrate(pw) {
    pw.alive = false;
    const pts = Math.round(2500 * this.multiplier);
    this.score += pts;
    this.multiplier = Math.min(10, this.multiplier + 0.5);
    // v3.42.0: destroyed crates spill one drop from the shared active pool
    // (Health / Frenzy / Shields / Wanted / Extra Life / robot / crate).
    this.powerups.push(new PowerUp({ x: pw.x, y: pw.y, type: rollPowerUpDrop(), game: this }));
    bus.emit('banner', {
      text: 'CRATE DESTROYED! +' + pts.toLocaleString() + ' (x' + this.multiplier.toFixed(1) + ')',
      tone: 'good', duration: 1.6,
    });
    this.particles.burst(pw.x, pw.y, { count: 32, color: '#ffd54f', speed: 320, life: 0.8 });
    this.shake = Math.max(this.shake, 5);
    audio.explosion();
  }

  /** v3.11.0: destructible asteroid chain power-up (AsteroidBonus.js). */
  destroyAsteroid(a) { breakAsteroid(this, a); }

  checkScoreLives() {
    if (this.score >= this.nextLifeAt) {
      this.nextLifeAt += LIFE_SCORE_INTERVAL;
      this.player.lives++;
      bus.emit('banner', { text: 'SCORE BONUS: EXTRA LIFE!', tone: 'good', duration: 2 });
      audio.powerup();
    }
  }

  cleanup() {
    this.enemies = this.enemies.filter(e => e.alive);
    this.bullets = this.bullets.filter(b => b.alive);
    this.powerups = this.powerups.filter(p => p.alive);
    this.bonusTargets = this.bonusTargets.filter(bt => bt.alive);
    this.fireZones = this.fireZones.filter(z => z.alive); // v3.11.0
  }

  spawnEnemyBullet(x, y, angle, speed, damage, color) {
    this.bullets.push(new Bullet({
      x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      damage, color, friendly: false, life: 6, radius: 6,
    }));
  }

  render() {
    const ctx = this.ctx;
    // v3.13.0: base transform for the crisp q× buffer (ViewScaler.js) —
    // everything below draws in logical viewport coordinates (viewW×viewH;
    // 1280×720 on 16:9, wider on ultra-wide — zero letterboxing).
    ctx.setTransform(this.view.q, 0, 0, this.view.q, 0, 0);
    ctx.clearRect(0, 0, this.view.viewW, this.view.viewH);
    ctx.save();
    if (this.shake > 0) ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    drawStars(ctx, this.stars);
    if (this.state === 'client') {
      // v3.20.0: LAN client — render the host's mirror world.
      clientMirror.render(ctx);
      this.particles.draw(ctx);
      this.hud.draw(ctx);
      ctx.restore();
      return;
    }
    for (const z of this.fireZones) z.draw(ctx); // v3.11.0: napalm pools under everything
    this.bonus.draw(ctx); // v3.54.0 → v3.60.0: bonus stage draw hook (Bone Yard bones are destructible bonusTargets)
    for (const pw of this.powerups) pw.draw(ctx);
    for (const bt of this.bonusTargets) bt.draw(ctx);
    for (const e of this.enemies) e.draw(ctx);
    if (this.player && !this.player.dead) this.player.draw(ctx);
    this.crosshair.draw(ctx); // v3.48.0: procedural aim reticle (offset + heading-rotated)
    if (coopManager.active) coopManager.render(ctx); // v3.20.0: P2
    for (const b of this.bullets) b.draw(ctx);
    this.particles.draw(ctx);
    this.aimbot.draw(ctx); // v3.27.0: easter eggs (Bender + Planet Express ship)
    this.testAimbot.draw(ctx); // v3.14.0: trajectory / reticle readout
    this.hud.draw(ctx);
    ctx.restore();
  }
}

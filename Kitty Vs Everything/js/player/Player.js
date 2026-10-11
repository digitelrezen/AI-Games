// Filename: Player.js
// Kitty Vs Everything — v3.71.0
// Core player controller: hull state (health/shield/lives/invulnerability),
// per-frame orchestration of the extracted modules, and fleet-level damage
// routing (docked minis intercept damage BEFORE the main hull).
// v3.3.0: Module split — flight → PlayerFlight.js, weapons → PlayerWeapons.js,
//         fleet → PlayerFleet.js, hardpoint math → PlayerHardpoints.js,
//         art → PlayerRenderer.js (PlayerShipArt / PlayerMiniArt / PlayerShipFx).
//         Minis are now strict same-color clones with independent HP
//         (MiniShip.js): hull-level damage routes to docked minis first, and
//         the whole fleet is cleared when the main hull is lost.
// v3.7.0: napalmCooldown (E/J napalm rockets) + C as the lefty nova key
//         (F stays). Q/H stun, R/G switch, L primary fire.
// v3.13.0: Spawn/respawn anchored to the LIVE viewport (game.viewW/H) so
//          ultra-wide stages place the ship on-screen.
// v3.14.0: Ultimate reads the remappable 'ultimate' action (F/C default)
//          via the InputManager action layer — Keybinds.js.
// v3.16.0: fleet deploy/recall (MiniDeploy.js, 'deployFleet' action) +
//          weapon animation state (WeaponAnim.js: vulkan spin / rail
//          charge / plasma pulse) owned here and ticked in update().
// v3.33.0: FRENZY power-up — frenzyTime state + activateFrenzy() (30s
//          all-cooldowns-off: fire cooldown held at zero, Vulcan heat +
//          overheat neutralized by PlayerWeapons.js; stun/napalm/ultimate
//          cooldowns cleared on pickup). Reset on respawn.
// v3.45.0: shield-break shatter — hit() plays a one-shot yellow particle
//          burst when the hull shield drops from >0 to 0 (the yellow bubble
//          in PlayerRenderer vanishes the same frame; this makes it read).
// v3.47.0: Synergy Explosion is key-triggered — PlayerFleet.js fires
//          superWeapon on the 'synergy' action (T / - default) instead of
//          the old 10s auto-fire. Release version bump, no Player.js logic
//          changes.
// v3.96.0: the 'synergy' action is now FLEET ORBIT — it toggles the mini
//          fleet between docked and orbiting the hull (MiniDeploy.js); the
//          old superWeapon fire is gone. Player owns the fleetOrbiting flag.
// v3.68.0: MODULAR WEAPON ARCHITECTURE (Phase 1) — Player owns a weapons
//          registry (this.weapons) of js/combat weapon classes:
//          { vulkan: VulcanCannon }. PlayerWeapons.js delegates fire /
//          state tick / reset to the registry; thermal + lockout stay on
//          the player (canonical fields for HUDFireControl / FRENZY).
// v3.69.0: MODULAR WEAPON ARCHITECTURE (Phase 2) — the registry now holds
//          ALL THREE primary weapons: { vulkan: VulcanCannon, plasma:
//          PulseCannon, rail: RailCannon }. Respawn resets all three.
export const VERSION = 'v4.11.0';
import Entity from '../core/Entity.js';
import { PLAYER, PLAYER_THEMES } from '../core/config.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';
import { fireNova, fireSuperWeapon } from '../combat/SuperNova.js'; // v3.71.0: modular combat (nova / super-weapon volleys)
import PlayerRenderer from './PlayerRenderer.js';
import { updateFlight } from './PlayerFlight.js';
import { updateWeaponState, tryFire, handleActionKeys, cycleWeapon as cycleWeaponTo } from './PlayerWeapons.js';
import { addMini as dockMini, updateFleet, clearFleet } from './PlayerFleet.js';
import { getUpperPawOffsets, getMuzzlePosition, localToWorld } from './PlayerHardpoints.js';
import { toggleFleetDeploy, updateFleetDeploy, toggleFleetOrbit } from '../levels/MiniDeploy.js';
import { initWeaponAnimState, updateWeaponAnim } from '../combat/WeaponAnim.js';
import VulcanCannon from '../combat/VulcanCannon.js'; // v3.68.0: modular weapon
import PulseCannon from '../combat/PulseCannon.js';   // v3.69.0: modular weapon
import RailCannon from '../combat/RailCannon.js';     // v3.69.0: modular weapon

export default class Player extends Entity {
  constructor(game, theme = 'white_yellow') {
    const th = PLAYER_THEMES[theme] || PLAYER_THEMES.white_yellow;
    super({ x: game.viewW / 2, y: game.viewH - 90, radius: 18, hp: 100, shield: 50, color: th.color }); // v3.13.0: live viewport
    this.game = game;
    this.theme = theme;
    this.lives = 3;
    this.invuln = 2;
    this.fireTimer = 0;
    this.weapon = 'vulkan';
    this.minis = [];
    this.superCharge = 0;
    this.dead = false;
    this.engineFlicker = 0;
    // ─── ASTEROIDS FLIGHT STATE (integrated by PlayerFlight.js) ───
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.thrusterActive = false;
    this.boostActive = false;
    // ─── Q/H STUN · E/J NAPALM · F/C ULTIMATE ───
    this.stunCooldown = 0;
    this.napalmCooldown = 0;   // v3.7.0: E/J napalm rockets
    this.ultimateCooldown = 0;
    this.ULTIMATE_COOLDOWN = 8.0;
    // ─── TAIL ANIMATION ───
    this.tailSway = 0;
    this.prevAngle = this.angle;
    // ─── WEAPON STATE (ticked by PlayerWeapons.js) ───
    this.thermal = 0;
    this.thermalLockout = 0;
    this.plasmaAlt = 0;
    // ─── v3.69.0: MODULAR WEAPON REGISTRY (js/combat weapon classes) ───
    // PlayerWeapons.js delegates fire / state tick / reset to
    // p.weapons[p.weapon]. As of v3.69.0 all three primary weapons are
    // modular (vulkan → VulcanCannon, plasma → PulseCannon, rail →
    // RailCannon); thermal + lockout stay on the player (canonical fields
    // for HUDFireControl / FRENZY).
    this.weapons = { vulkan: new VulcanCannon(this), plasma: new PulseCannon(this), rail: new RailCannon(this) };
    // ─── v3.33.0: FRENZY (30s all-cooldowns-off — activateFrenzy) ───
    this.frenzyTime = 0;
    // ─── WEAPON ANIMATION (front-paw hardpoint flashes, decayed in update) ───
    this.pawFlashL = 0;
    this.pawFlashR = 0;
    this.muzzleFlash = 0;
    // ─── v3.16.0: FLEET DEPLOY STATE (docked = inert, deployed = orbit) ───
    this.fleetDeployed = false;
    // ─── v3.96.0: FLEET ORBIT STATE (T toggle: docked <-> flat-circle orbit) ───
    this.fleetOrbiting = false;
    // ─── v3.16.0: WEAPON ANIMATION STATE (WeaponAnim.js owns the values) ───
    initWeaponAnimState(this); // vulkanSpin / railCharge / plasmaPulse
    // ─── ANIMATION CLOCK (blink / tail idle-wag in the art) ───
    this.animTime = 0;
    // ─── v4.24.0: SCRIPTED CONTROL LOCK (Bone Yard Phase 3) ───
    // While locked the ship freezes in place and ignores ALL input
    // (movement + every weapon/action key). BoneYardBonus sets it while
    // Eridath's Mom's House descends and resets it defensively in
    // cleanup() so the lock can never leak out of the stage.
    this._controlsLocked = false;
    // ─── RENDERER ───
    this.renderer = new PlayerRenderer(this);
  }

  /** v4.24.0: scripted control lock — assigning true freezes the ship
   *  (velocity zeroed) and update() skips all input-driven sections. */
  set controlsLocked(v) {
    this._controlsLocked = !!v;
    if (v) { this.vx = 0; this.vy = 0; }
  }
  get controlsLocked() { return this._controlsLocked; }

  // ═══════════════════════════════════════════════════════════
  //  HARDPOINT MATH (delegates to PlayerHardpoints.js —
  //  SHIP_GEOMETRY local-space → world-space transform)
  // ═══════════════════════════════════════════════════════════
  localToWorld(lx, ly) { return localToWorld(this, lx, ly); }
  getUpperPawOffsets() { return getUpperPawOffsets(this); }
  getMuzzlePosition() { return getMuzzlePosition(this); }

  // ═══════════════════════════════════════════════════════════
  //  MINI-SHIP MANAGEMENT (v3.3.0: strict same-color clone)
  // ═══════════════════════════════════════════════════════════
  /**
   * Dock a mini-ship. v3.3.0: the theme argument is IGNORED — minis always
   * clone the player's current theme (CatShipFactory.createMiniShip is the
   * single mini spawn path, reached via PlayerFleet.addMini).
   * @returns {boolean} true if a mini was docked, false when the grid is full.
   */
  addMini() { return dockMini(this); }

  // ═══════════════════════════════════════════════════════════
  //  MAIN UPDATE LOOP (orchestrates the extracted modules)
  // ═══════════════════════════════════════════════════════════
  update(dt, input) {
    if (this.dead) return;
    // v3.17.0: reset the sync flag each frame — docked minis fire only when
    // the hull actually fires this frame (set by PlayerWeapons.fireNow).
    this.firedThisFrame = false;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.stunCooldown > 0) this.stunCooldown = Math.max(0, this.stunCooldown - dt);
    if (this.napalmCooldown > 0) this.napalmCooldown = Math.max(0, this.napalmCooldown - dt);
    if (this.ultimateCooldown > 0) this.ultimateCooldown = Math.max(0, this.ultimateCooldown - dt);
    // ─── v3.33.0: FRENZY tick (PlayerWeapons.js holds cooldowns/thermal at
    // zero while frenzyTime > 0) ───
    if (this.frenzyTime > 0) this.frenzyTime = Math.max(0, this.frenzyTime - dt);
    this.engineFlicker += dt * 12;
    this.animTime += dt;
    if (this.pawFlashL > 0) this.pawFlashL = Math.max(0, this.pawFlashL - dt);
    if (this.pawFlashR > 0) this.pawFlashR = Math.max(0, this.pawFlashR - dt);
    if (this.muzzleFlash > 0) this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
    // ─── v4.24.0: SCRIPTED CONTROL LOCK (Bone Yard Phase 3) — while
    // locked the ship coasts with drag only and ignores ALL input. ───
    const locked = this._controlsLocked;
    // ─── v3.16.0: FLEET DEPLOY / RECALL (remappable 'deployFleet' action) ───
    if (!locked && input.wasPressedAction('deployFleet')) toggleFleetDeploy(this);
    // ─── v3.96.0: FLEET ORBIT (remappable 'synergy' action, T / - default) ───
    if (!locked && input.wasPressedAction('synergy')) toggleFleetOrbit(this);

    // ─── FLIGHT (rotation / thrust / boost / drag / wrap / tail sway) ───
    if (!locked) updateFlight(this, dt, input);
    else {
      // v4.24.0: locked — drag-only coast (no input, no bounds wrap).
      const dragFactor = Math.exp(-PLAYER.DRAG * dt);
      this.vx *= dragFactor;
      this.vy *= dragFactor;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    // ─── WEAPONS (thermal state, E/LMB fire, Q stun rockets, R cycle) ───
    updateWeaponState(this, dt);
    if (!locked) {
      tryFire(this, dt, input);
      handleActionKeys(this, input);
    }

    // ─── ULTIMATE action (default F / C = lefty; abstract, overridden) ───
    // v3.14.0: remappable via Keybinds.js.
    if (!locked && input.wasPressedAction('ultimate') && this.ultimateCooldown <= 0) {
      this.activateUltimate();
      this.ultimateCooldown = this.ULTIMATE_COOLDOWN;
    }

    // ─── v3.16.0: fleet flight (docked snap / deployed orbit) BEFORE the
    // per-mini update so each mini reads its final position this frame ───
    updateFleetDeploy(this, dt);
    // ─── DOCKED FLEET + COLOR-MATCH SYNERGY (PlayerFleet.js) ───
    updateFleet(this, dt, input);
    // ─── v3.16.0: weapon animation state (vulkan spin / rail charge /
    // plasma pulse) — reads the paw flashes set by tryFire above ───
    updateWeaponAnim(this, dt, { active: true, time: this.game.time });
  }

  // ═══════════════════════════════════════════════════════════
  //  F KEY: ULTIMATE (ABSTRACT — overridden by each cat variant)
  //  v3.71.0: the base nova volley lives in combat/SuperNova.js
  //  (fireNova); this method is the delegation point.
  // ═══════════════════════════════════════════════════════════
  activateUltimate() {
    fireNova(this);
  }

  // ═══════════════════════════════════════════════════════════
  //  FRENZY POWER-UP (v3.33.0) — 30s all-cooldowns-off
  // ═══════════════════════════════════════════════════════════
  /**
   * v3.33.0: FRENZY (from the 'frenzy' power-up drop, Game.collectPowerUp).
   * Every weapon cooldown is cleared and HELD cleared for
   * PLAYER.FRENZY_DURATION seconds: PlayerWeapons.js holds fireTimer /
   * thermal / thermalLockout at zero while frenzyTime > 0, so every weapon
   * fires at max rate and the Vulcan can never build heat or overheat.
   * Stun / napalm / ultimate cooldowns are cleared once on pickup and then
   * tick normally (their re-use during FRENZY is free at the start).
   */
  activateFrenzy() {
    this.frenzyTime = PLAYER.FRENZY_DURATION;
    this.fireTimer = 0;
    this.thermal = 0;
    this.thermalLockout = 0;
    this.stunCooldown = 0;
    this.napalmCooldown = 0;
    this.ultimateCooldown = 0;
    bus.emit('banner', { text: 'FRENZY! ALL COOLDOWNS OFF ' + PLAYER.FRENZY_DURATION + 's', tone: 'good', duration: 2 });
    if (this.game.msglog) { // v3.14.0: combat console
      this.game.msglog.log('FRENZY — ' + PLAYER.FRENZY_DURATION + 's ALL COOLDOWNS OFF (NO OVERHEAT)', 'good', this.game.time);
    }
    this.game.particles.burst(this.x, this.y, { count: 24, color: '#ffd600', speed: 260, life: 0.7 });
    this.game.shake = Math.max(this.game.shake, 5);
  }

  // ═══════════════════════════════════════════════════════════
  //  SHARED UTILITIES
  // ═══════════════════════════════════════════════════════════
  // v3.71.0: the color-synergy super-weapon volley lives in
  // combat/SuperNova.js (fireSuperWeapon); this method delegates.
  superWeapon() {
    fireSuperWeapon(this);
  }

  cycleWeapon(dir) { cycleWeaponTo(this, dir); }

  /**
   * Hull damage. v3.3.0 FLEET ROUTING: while any docked mini is alive,
   * hull-level damage is intercepted by the mini first (independent HP
   * pool, white hit-flash); the main hull only takes damage once the
   * fleet is gone.
   */
  hit(damage) {
    if (this.dead || this.invuln > 0) return;
    const mini = this.minis.find(m => m.alive);
    if (mini) {
      mini.applyDamage(damage);
      return;
    }
    // v3.45.0: SHIELD BREAK — the yellow bubble (PlayerRenderer) renders only
    // while shield > 0, so it vanishes the frame the shield hits 0; this
    // one-shot shatter burst makes the break read cleanly.
    const shieldBefore = this.shield;
    const hpBefore = this.hp;
    this.applyDamage(damage);
    if (shieldBefore > 0 && this.shield <= 0) {
      this.game.particles.burst(this.x, this.y, { count: 26, color: '#ffd54f', speed: 320, life: 0.45 });
      audio.shieldBreak(); // v4.11.0: shield shatter (zero silent triggers)
    }
    if (this.hp > 0 && this.hp < hpBefore) {
      audio.hullHit(); // v4.11.0: non-lethal hull impact thud (death keeps audio.explosion())
    }
    if (this.hp <= 0) {
      this.lives--;
      this.invuln = 2.5;
      this.superCharge = 0;
      this.vx = 0;
      this.vy = 0;
      this.game.particles.burst(this.x, this.y, { count: 40, color: '#fff', speed: 320, life: 0.8 });
      this.game.shake = 12;
      audio.explosion();
      clearFleet(this); // v3.3.0: the docked fleet is lost with the hull
      if (this.lives <= 0) {
        this.dead = true;
        this.game.gameOver();
      } else {
        this.alive = true; // Entity.applyDamage set alive=false at hp 0 — restore it
        this.hp = this.maxHp;
        this.shield = this.maxShield;
        this.x = this.game.viewW / 2;   // v3.13.0: live viewport
        this.y = this.game.viewH - 90;
        this.angle = -Math.PI / 2;
        this.vx = 0;
        this.vy = 0;
        this.stunCooldown = 0;
        this.napalmCooldown = 0;
        this.ultimateCooldown = 0;
        this.frenzyTime = 0; // v3.33.0: FRENZY does not survive the hull loss
        this.tailSway = 0;
        // v3.69.0: modular weapon state (thermal/lockout) — all 3 primary weapons
        this.weapons.vulkan.reset();
        this.weapons.plasma.reset();
        this.weapons.rail.reset();
        this.plasmaAlt = 0;
        this.pawFlashL = 0;
        this.pawFlashR = 0;
        this.muzzleFlash = 0;
        this.fleetDeployed = false; // v3.16.0: respawn with the fleet docked
        this.fleetOrbiting = false; // v3.96.0: respawn with the fleet docked (orbit off)
        bus.emit('banner', { text: 'KITTY RESPAWNED! LIVES: ' + this.lives, tone: 'bad', duration: 1.5 });
      }
    }
  }

  draw(ctx) {
    if (this.dead) return;
    this.renderer.draw(ctx);
  }
}

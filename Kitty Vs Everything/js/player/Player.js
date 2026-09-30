// Filename: Player.js
// Kitty Vs Everything — v3.45.0
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
export const VERSION = 'v3.45.0';
import Entity from '../core/Entity.js';
import Bullet from '../combat/Bullet.js';
import { PLAYER, PLAYER_THEMES } from '../core/config.js';
import { TAU, rand } from '../core/utils.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';
import PlayerRenderer from './PlayerRenderer.js';
import { updateFlight } from './PlayerFlight.js';
import { updateWeaponState, tryFire, handleActionKeys, cycleWeapon as cycleWeaponTo } from './PlayerWeapons.js';
import { addMini as dockMini, updateFleet, clearFleet } from './PlayerFleet.js';
import { getUpperPawOffsets, getMuzzlePosition, localToWorld } from './PlayerHardpoints.js';
import { toggleFleetDeploy, updateFleetDeploy } from '../levels/MiniDeploy.js';
import { initWeaponAnimState, updateWeaponAnim } from '../combat/WeaponAnim.js';

export default class Player extends Entity {
  constructor(game, theme = 'yellow') {
    const th = PLAYER_THEMES[theme] || PLAYER_THEMES.yellow;
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
    // ─── v3.33.0: FRENZY (30s all-cooldowns-off — activateFrenzy) ───
    this.frenzyTime = 0;
    // ─── WEAPON ANIMATION (front-paw hardpoint flashes, decayed in update) ───
    this.pawFlashL = 0;
    this.pawFlashR = 0;
    this.muzzleFlash = 0;
    // ─── v3.16.0: FLEET DEPLOY STATE (docked = inert, deployed = orbit) ───
    this.fleetDeployed = false;
    // ─── v3.16.0: WEAPON ANIMATION STATE (WeaponAnim.js owns the values) ───
    initWeaponAnimState(this); // vulkanSpin / railCharge / plasmaPulse
    // ─── ANIMATION CLOCK (blink / tail idle-wag in the art) ───
    this.animTime = 0;
    // ─── RENDERER ───
    this.renderer = new PlayerRenderer(this);
  }

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
    // ─── v3.16.0: FLEET DEPLOY / RECALL (remappable 'deployFleet' action) ───
    if (input.wasPressedAction('deployFleet')) toggleFleetDeploy(this);

    // ─── FLIGHT (rotation / thrust / boost / drag / wrap / tail sway) ───
    updateFlight(this, dt, input);

    // ─── WEAPONS (thermal state, E/LMB fire, Q stun rockets, R cycle) ───
    updateWeaponState(this, dt);
    tryFire(this, dt, input);
    handleActionKeys(this, input);

    // ─── ULTIMATE action (default F / C = lefty; abstract, overridden) ───
    // v3.14.0: remappable via Keybinds.js.
    if (input.wasPressedAction('ultimate') && this.ultimateCooldown <= 0) {
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
  // ═══════════════════════════════════════════════════════════
  activateUltimate() {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      this.game.bullets.push(new Bullet({
        x: this.x, y: this.y,
        vx: Math.cos(a) * 500, vy: Math.sin(a) * 500,
        damage: 25, color: '#ffd54f', friendly: true, life: 1.5, owner: this,
      }));
    }
    this.game.particles.burst(this.x, this.y, { count: 30, color: '#ffd54f', speed: 300, life: 0.6 });
    this.game.shake = 8;
    audio.superWeapon();
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
  superWeapon() {
    bus.emit('banner', { text: 'COLOR SYNERGY! SUPER-WEAPON FIRED!', tone: 'good', duration: 2 });
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU;
      this.game.bullets.push(new Bullet({
        x: this.x, y: this.y,
        vx: Math.cos(a) * 500, vy: Math.sin(a) * 500,
        damage: 40, color: '#ffd54f', friendly: true, life: 2, owner: this,
      }));
    }
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU);
      const b = new Bullet({
        x: this.x, y: this.y,
        vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
        damage: 60, color: '#ff5252', friendly: true, life: 2.5, owner: this,
      });
      b.homing = true;
      this.game.bullets.push(b);
    }
    this.game.shake = 16;
    this.game.particles.burst(this.x, this.y, { count: 60, color: '#ffd54f', speed: 400, life: 1 });
    audio.superWeapon();
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
    this.applyDamage(damage);
    if (shieldBefore > 0 && this.shield <= 0) {
      this.game.particles.burst(this.x, this.y, { count: 26, color: '#ffd54f', speed: 320, life: 0.45 });
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
        this.thermal = 0;
        this.thermalLockout = 0;
        this.plasmaAlt = 0;
        this.pawFlashL = 0;
        this.pawFlashR = 0;
        this.muzzleFlash = 0;
        this.fleetDeployed = false; // v3.16.0: respawn with the fleet docked
        bus.emit('banner', { text: 'KITTY RESPAWNED! LIVES: ' + this.lives, tone: 'bad', duration: 1.5 });
      }
    }
  }

  draw(ctx) {
    if (this.dead) return;
    this.renderer.draw(ctx);
  }
}

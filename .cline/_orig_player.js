// Filename: Player.js
// Everything Vs Kitty ΓÇö v3.3.0
// Core player controller: hull state (health/shield/lives/invulnerability),
// per-frame orchestration of the extracted modules, and fleet-level damage
// routing (docked minis intercept damage BEFORE the main hull).
// v3.3.0: Module split ΓÇö flight ΓåÆ PlayerFlight.js, weapons ΓåÆ PlayerWeapons.js,
//         fleet ΓåÆ PlayerFleet.js, hardpoint math ΓåÆ PlayerHardpoints.js,
//         art ΓåÆ PlayerRenderer.js (PlayerShipArt / PlayerMiniArt / PlayerShipFx).
//         Minis are now strict same-color clones with independent HP
//         (MiniShip.js): hull-level damage routes to docked minis first, and
//         the whole fleet is cleared when the main hull is lost.
// v3.7.0: napalmCooldown (E/J napalm rockets) + C as the lefty nova key
//         (F stays). Q/H stun, R/G switch, L primary fire.
export const VERSION = 'v3.7.0';
import Entity from './Entity.js';
import Bullet from './Bullet.js';
import { GAME, PLAYER_THEMES } from './config.js';
import { TAU, rand } from './utils.js';
import { bus } from './EventBus.js';
import { audio } from './AudioSystem.js';
import PlayerRenderer from './PlayerRenderer.js';
import { updateFlight } from './PlayerFlight.js';
import { updateWeaponState, tryFire, handleActionKeys, cycleWeapon as cycleWeaponTo } from './PlayerWeapons.js';
import { addMini as dockMini, updateFleet, clearFleet } from './PlayerFleet.js';
import { getUpperPawOffsets, getMuzzlePosition, localToWorld } from './PlayerHardpoints.js';

export default class Player extends Entity {
  constructor(game, theme = 'yellow') {
    const th = PLAYER_THEMES[theme] || PLAYER_THEMES.yellow;
    super({ x: GAME.W / 2, y: GAME.H - 90, radius: 18, hp: 100, shield: 50, color: th.color });
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
    // ΓöÇΓöÇΓöÇ ASTEROIDS FLIGHT STATE (integrated by PlayerFlight.js) ΓöÇΓöÇΓöÇ
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.thrusterActive = false;
    this.boostActive = false;
    // ΓöÇΓöÇΓöÇ Q/H STUN ┬╖ E/J NAPALM ┬╖ F/C ULTIMATE ΓöÇΓöÇΓöÇ
    this.stunCooldown = 0;
    this.napalmCooldown = 0;   // v3.7.0: E/J napalm rockets
    this.ultimateCooldown = 0;
    this.ULTIMATE_COOLDOWN = 8.0;
    // ΓöÇΓöÇΓöÇ TAIL ANIMATION ΓöÇΓöÇΓöÇ
    this.tailSway = 0;
    this.prevAngle = this.angle;
    // ΓöÇΓöÇΓöÇ WEAPON STATE (ticked by PlayerWeapons.js) ΓöÇΓöÇΓöÇ
    this.thermal = 0;
    this.thermalLockout = 0;
    this.plasmaAlt = 0;
    // ΓöÇΓöÇΓöÇ WEAPON ANIMATION (front-paw hardpoint flashes, decayed in update) ΓöÇΓöÇΓöÇ
    this.pawFlashL = 0;
    this.pawFlashR = 0;
    this.muzzleFlash = 0;
    // ΓöÇΓöÇΓöÇ ANIMATION CLOCK (blink / tail idle-wag in the art) ΓöÇΓöÇΓöÇ
    this.animTime = 0;
    // ΓöÇΓöÇΓöÇ RENDERER ΓöÇΓöÇΓöÇ
    this.renderer = new PlayerRenderer(this);
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  //  HARDPOINT MATH (delegates to PlayerHardpoints.js ΓÇö
  //  SHIP_GEOMETRY local-space ΓåÆ world-space transform)
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  localToWorld(lx, ly) { return localToWorld(this, lx, ly); }
  getUpperPawOffsets() { return getUpperPawOffsets(this); }
  getMuzzlePosition() { return getMuzzlePosition(this); }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  //  MINI-SHIP MANAGEMENT (v3.3.0: strict same-color clone)
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  /**
   * Dock a mini-ship. v3.3.0: the theme argument is IGNORED ΓÇö minis always
   * clone the player's current theme (CatShipFactory.createMiniShip is the
   * single mini spawn path, reached via PlayerFleet.addMini).
   * @returns {boolean} true if a mini was docked, false when the grid is full.
   */
  addMini() { return dockMini(this); }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  //  MAIN UPDATE LOOP (orchestrates the extracted modules)
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  update(dt, input) {
    if (this.dead) return;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.stunCooldown > 0) this.stunCooldown = Math.max(0, this.stunCooldown - dt);
    if (this.napalmCooldown > 0) this.napalmCooldown = Math.max(0, this.napalmCooldown - dt);
    if (this.ultimateCooldown > 0) this.ultimateCooldown = Math.max(0, this.ultimateCooldown - dt);
    this.engineFlicker += dt * 12;
    this.animTime += dt;
    if (this.pawFlashL > 0) this.pawFlashL = Math.max(0, this.pawFlashL - dt);
    if (this.pawFlashR > 0) this.pawFlashR = Math.max(0, this.pawFlashR - dt);
    if (this.muzzleFlash > 0) this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);

    // ΓöÇΓöÇΓöÇ FLIGHT (rotation / thrust / boost / drag / wrap / tail sway) ΓöÇΓöÇΓöÇ
    updateFlight(this, dt, input);

    // ΓöÇΓöÇΓöÇ WEAPONS (thermal state, E/LMB fire, Q stun rockets, R cycle) ΓöÇΓöÇΓöÇ
    updateWeaponState(this, dt);
    tryFire(this, dt, input);
    handleActionKeys(this, input);

    // ΓöÇΓöÇΓöÇ F / C KEY: ULTIMATE (C = lefty; abstract ΓÇö overridden by variants) ΓöÇΓöÇΓöÇ
    if ((input.wasPressed('KeyF') || input.wasPressed('KeyC')) && this.ultimateCooldown <= 0) {
      this.activateUltimate();
      this.ultimateCooldown = this.ULTIMATE_COOLDOWN;
    }

    // ΓöÇΓöÇΓöÇ DOCKED FLEET + COLOR-MATCH SYNERGY (PlayerFleet.js) ΓöÇΓöÇΓöÇ
    updateFleet(this, dt, input);
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  //  F KEY: ULTIMATE (ABSTRACT ΓÇö overridden by each cat variant)
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  activateUltimate() {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      this.game.bullets.push(new Bullet({
        x: this.x, y: this.y,
        vx: Math.cos(a) * 500, vy: Math.sin(a) * 500,
        damage: 25, color: '#ffd54f', friendly: true, life: 1.5,
      }));
    }
    this.game.particles.burst(this.x, this.y, { count: 30, color: '#ffd54f', speed: 300, life: 0.6 });
    this.game.shake = 8;
    audio.superWeapon();
  }

  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  //  SHARED UTILITIES
  // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
  superWeapon() {
    bus.emit('banner', { text: 'COLOR SYNERGY! SUPER-WEAPON FIRED!', tone: 'good', duration: 2 });
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU;
      this.game.bullets.push(new Bullet({
        x: this.x, y: this.y,
        vx: Math.cos(a) * 500, vy: Math.sin(a) * 500,
        damage: 40, color: '#ffd54f', friendly: true, life: 2,
      }));
    }
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU);
      const b = new Bullet({
        x: this.x, y: this.y,
        vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
        damage: 60, color: '#ff5252', friendly: true, life: 2.5,
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
    this.applyDamage(damage);
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
        this.alive = true; // Entity.applyDamage set alive=false at hp 0 ΓÇö restore it
        this.hp = this.maxHp;
        this.shield = this.maxShield;
        this.x = GAME.W / 2;
        this.y = GAME.H - 90;
        this.angle = -Math.PI / 2;
        this.vx = 0;
        this.vy = 0;
        this.stunCooldown = 0;
        this.napalmCooldown = 0;
        this.ultimateCooldown = 0;
        this.tailSway = 0;
        this.thermal = 0;
        this.thermalLockout = 0;
        this.plasmaAlt = 0;
        this.pawFlashL = 0;
        this.pawFlashR = 0;
        this.muzzleFlash = 0;
        bus.emit('banner', { text: 'KITTY RESPAWNED! LIVES: ' + this.lives, tone: 'bad', duration: 1.5 });
      }
    }
  }

  draw(ctx) {
    if (this.dead) return;
    this.renderer.draw(ctx);
  }
}

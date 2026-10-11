// Filename: EasterEgg.js
// Kitty Vs Everything — v4.28.0
// v4.28.0: BENDER KILL PACING — the kill-based dialogue now requires
//          KILLS_PER_LINE (10) friendly kills between lines instead of one
//          kill per line: with the aimbot auto-firing, the old pacing pushed
//          all six lines out in a few seconds. Lines 2–5 now fire at kills
//          10/20/30/40 (BENDER_KILLS 4 → 40), giving each line time on
//          screen to be read.
// v4.12.0: SPACE SNAKE PRE-WAVE + TANK EGG SHIPS — when the RnM roll hits
//          (or the dev button fires), the encounter now runs in two beats:
//          (1) spawnRnMPreWave() drops RNMSHIP.preWaveCount Space Snake
//          enemies (type 'spacesnake', .assets/SpaceSnake-256x256.png)
//          across the top of the playfield, and (2) RNMSHIP.preWaveDelay
//          seconds later the RnM interceptor crosses in (rnmsShipDelay,
//          counted down in update(), gated on 'playing'). Both easter-egg
//          ships are TANKED so high-level player weapons can't vaporize
//          them mid-set-piece: the RnM hull 120 → 2400 (plus its
//          conversation-linked damage shield, RnMShip.js) and the Planet
//          Express ship SHIP_EGG_HP 30 → 1200.
// v4.7.0: RnM ship — the "RnM SHIP INTERCEPTOR INBOUND" spawn banner is
//          gone from maybeSpawnRnMShip: the ship plays its sequential
//          Rick & Morty dialogue itself (RnMShip.js RNMSHIP_DIALOGUE) as
//          it crosses into view; the spawn roll is significantly
//          boosted (RNMSHIP.spawnChance 0.19, 8–15 s roll windows,
//          8 s first roll, cap 5 per mission).
// Easter egg manager: one slot per egg, all can be alive at the same time.
//   • BenderEasterEgg (v3.24.0, resized v3.28.0, kill-based v3.29.0) —
//     the rare 'robot' power-up (dropped by the destroyed Planet Express
//     ship, or the rare enemy drop) summons Bender from the right edge.
//     Full-body pixel art (BenderSprite.js, derived from
//     ../.assets/Robot-Bender Pixel Art.png) at normal
//     proportions (no stretch), cigar arm at rest (v3.29.0: no more ship
//     tracking). v3.29.0: the 10-second timer is GONE — catching Bender
//     starts a kill-based dialogue (v4.28.0: KILLS_PER_LINE = 10 kills
//     between lines so each line stays on screen long enough to read):
//       0 "I'm your Aimbot." (on catch)
//       1 "Shoot that guy!" (2 s later, or the first kill)
//       2 "Great, now shoot that guy!" (kill 10)
//       3 "Great, great, now aim a little to the left." (kill 20)
//       4 "Boom! Headshot!" (kill 30)
//       5 "Ok that's enough, I have to go get drunk." (kill 40 → end)
//     Kills are counted via Combat.js onEnemyDeath → aimbot.onEnemyKilled.
//     After kill 40 the aimbot disables and Bender slides back out.
//   • ShipEasterEgg (v3.27.0, reworked v3.28.0) — the Planet Express ship
//     (ShipSprite.js, derived pixel art 422×159, nose faces +x) enters
//     off-screen left and flies right; off-screen right it flips
//     (scaleX = -1) and flies back left. Repeats the full right/left
//     pattern 3 times, then despawns. Friendly bullets damage it
//     (HP 30); on destruction it explodes, drops a 'robot' power-up
//     (catch → Bender's kill-based aimbot) and quips
//     "Bite My Shiney Metal Ass!". Triggered from the dev panel (Drop Ship).
//   • SpaceballsOne (v3.81.0, v3.82.0 one-way flyby) — "Spaceballs One",
//     the rare UNSTOPPABLE easter-egg ship (js/modes/EasterEggs/SpaceballsOne/):
//     spawns off-screen bottom-right on a rare per-wave roll
//     (SPACEBALLS_ONE.spawnChance, capped at SPACEBALLS_ONE.maxPerRun per
//     mission — maybeSpawnSpaceballs, called from WaveManager.startNext),
//     races diagonally up-left (one-way, despawns fully off-screen top-left)
//     at SPACEBALLS_ONE.speed, obliterates everything in its path (enemies
//     / asteroids / crates / all projectiles — "We brake for nobody!"),
//     fires a brake-light bolt stream at the player, and on destruction
//     explodes into a treasure-chest jackpot — ONE of EVERY power-up type
//     (SpaceballsOneLoot.spawnTreasureChest).
//   • RnMShip (v4.1.0) — the rare easter-egg INTERCEPTOR (js/modes/
//     EasterEggs/RnMShip/): a rare time-based roll in the manager's
//     update (RNMSHIP.spawnChance per roll window, capped at
//     RNMSHIP.maxPerRun per mission — maybeSpawnRnMShip) gated on
//     game.state === 'playing', so it works in BOTH classic wave mode
//     and Search & Destroy mode (one code path). The ship (.assets/
//     RnMship-256x256.png, key `rnms`) enters off-screen left flying
//     right, turns around (sprite mirror) fully off-screen right and
//     patrols back left, looping until destroyed (RNMSHIP.hp). Friendly
//     bullets damage it; on destruction it explodes and drops a
//     GUARANTEED Frenzy power-up at its death coordinates
//     (spawnGuaranteedDrop — bypasses DROP_POLICY).
// API: `game.aimbot` is the manager (default export). The v3.24.0 surface
//      is preserved — `active`/`onScreen`/`killCount`/`t`/`quip` proxy the
//      Bender egg (MiniShip/PlayerWeapons aim-assist gate, HUD "BENDER x/4"
//      counter, DebugBridge snapshot), `trigger()` = robot power-up
//      (dialogue line 0 + audio on trigger), `onEnemyKilled()` = Combat.js
//      kill hook (v3.29.0), `reset()` = Game.start(), `update()`/`draw()`
//      run all eggs. `game.eggs = { bender, ship, spaceballs }` exposes the
//      slots for the debug snapshot; `switchEgg(game, type)` spawns/replaces
//      an egg ('bender' | 'ship' | 'spaceballs' | null);
//      `maybeSpawnSpaceballs(game)` is the rare per-wave roll (v3.81.0);
//      `maybeSpawnRnMShip(game)` is the rare time-based roll (v4.1.0).
import { bus } from './EventBus.js';
import { audio } from './AudioSystem.js';
import {
  getBenderBody,
  getBenderArm,
  isBenderSpriteReady,
  BENDER_BODY_W,
  BENDER_BODY_H,
  BENDER_ARM_W,
  BENDER_ARM_H,
  BENDER_SHOULDER_IN_BODY,
  BENDER_SHOULDER_IN_ARM,
} from './BenderSprite.js';
import { getShip, SHIP_W, SHIP_H } from './ShipSprite.js'; // v3.27.0
import { SpaceballsOne, SPACEBALLS_ONE } from '../modes/EasterEggs/SpaceballsOne/index.js'; // v3.81.0
import { RnMShip, RNMSHIP } from '../modes/EasterEggs/RnMShip/index.js'; // v4.1.0
import { createEnemy } from '../enemies/EnemyFactory.js'; // v4.12.0: Space Snake pre-wave
import { spawnGuaranteedDrop } from './DropManager.js'; // v3.83.0: flyby 'robot' drop
import { TAU, clamp, rand } from './utils.js';

const KILLS_PER_LINE = 10; // v4.28.0: friendly kills between dialogue lines (was 1 — lines flew by unreadable)
export const BENDER_KILLS = KILLS_PER_LINE * 4; // v4.28.0: kills that end the egg (4 lines × 10; HUD "BENDER x/40")
const BENDER_INTRO_DELAY = 2; // v3.29.0: s between "I'm your Aimbot." and "Shoot that guy!"
const BENDER_SCALE = 0.5;    // v3.28.0: 293×441 art → 146×220 on screen (60% smaller than v3.27.0)
const BENDER_ENTER = 1.3;    // slide-in duration
const BENDER_EXIT = 1.0;     // slide-out duration
const BENDER_MARGIN = 20;    // rest gap from the right edge
const BENDER_OFFSCREEN = 60; // how far past the edge he starts/ends

const SHIP_EGG_SPEED = 260;  // v3.27.0: px/s (both directions)
const SHIP_EGG_SCALE = 0.42; // 422×159 art → ~177×67 on screen
const SHIP_EGG_WOBBLE = 14;  // px amplitude of the vertical bob
export const SHIP_EGG_HP = 1200;    // v4.12.0: TANK EGG SHIP — 30 → 1200 (40x): high-level
                                    // weapons can no longer one-shot vaporize the flyby
const SHIP_EGG_PASSES = 3;   // v3.28.0: full right/left patterns before despawn

// v3.29.0: kill-based dialogue — stage 0 on catch, stage 1 after the intro
// delay, stages 2–5 after kills 1–4 (stage 5 ends the egg).
// v4.28.0: KILLS_PER_LINE (10) kills between lines — stages 2–5 now fire
// at kills 10/20/30/40 so each line stays on screen long enough to read.
const BENDER_DIALOGUE = [
  "I'm your Aimbot.",
  'Shoot that guy!',
  'Great, now shoot that guy!',
  'Great, great, now aim a little to the left.',
  'Boom! Headshot!',
  "Ok that's enough, I have to go get drunk.",
];

/** v3.24.0: Bender — the robot power-up egg (kill-based dialogue v3.29.0). */
export class BenderEasterEgg {
  constructor(game) {
    this.game = game;
    this.active = false;      // aim window — MiniShip/PlayerWeapons gate on this
    this.aimbotActive = false; // v3.29.0: aim-assist on (mirrors active)
    this.onScreen = false;    // draw window (entry + exit slide) — draw() gates on this
    this.t = 0;
    this.quip = null;
    this.armAngle = Math.PI;  // rest: pointing left (v3.29.0: no more tracking)
    this.killCount = 0;       // v3.29.0: friendly kills during the egg
    this.dialogueStage = 0;   // v3.29.0: index of the last shown BENDER_DIALOGUE line
    this.exitStart = null;    // v3.29.0: t when the exit slide began
  }

  /** v3.24.0: Game.start() resets the egg between missions. */
  reset() {
    this.active = false;
    this.aimbotActive = false;
    this.onScreen = false;
    this.t = 0;
    this.quip = null;
    this.armAngle = Math.PI;
    this.killCount = 0;
    this.dialogueStage = 0;
    this.exitStart = null;
  }

  /** v3.29.0: robot power-up caught — Bender slides in, aimbot on, dialogue starts. */
  trigger() {
    if (this.onScreen) return;
    this.active = true;
    this.aimbotActive = true;
    this.onScreen = true;
    this.t = 0;
    this.killCount = 0;
    this.dialogueStage = 0;
    this.exitStart = null;
    this.armAngle = Math.PI;
    this.showLine(0, 'good'); // "I'm your Aimbot."
  }

  /** v3.29.0: show dialogue line i (banner + audio), advance dialogueStage. */
  showLine(i, tone = 'info') {
    this.dialogueStage = i;
    this.quip = BENDER_DIALOGUE[i];
    bus.emit('banner', { text: this.quip, tone, duration: 2.5 });
    audio.banner();
  }

  /**
   * v3.29.0: Combat.js onEnemyDeath hook — one friendly kill. Advances the
   * dialogue (v4.28.0: one line per KILLS_PER_LINE = 10 kills); after
   * BENDER_KILLS kills the aimbot and the egg end (final line + exit slide).
   */
  onEnemyKilled() {
    if (!this.active) return;
    this.killCount++;
    // v4.28.0: KILLS_PER_LINE (10) kills per line — kill 10 → line 2 … kill 40 → line 5
    const stage = 1 + Math.floor(this.killCount / KILLS_PER_LINE);
    if (stage > this.dialogueStage) this.showLine(stage);
    if (this.killCount >= BENDER_KILLS) this.end();
  }

  /** v3.29.0: aimbot off + exit slide (final line already shown by caller). */
  end() {
    if (!this.active) return;
    this.active = false;
    this.aimbotActive = false;
    this.exitStart = this.t;
  }

  update(dt) {
    if (!this.onScreen) return;
    this.t += dt;

    if (!this.active) {
      // Exit slide: once he's fully off-screen, the egg is done
      const out = clamp((this.t - this.exitStart) / BENDER_EXIT, 0, 1);
      if (out >= 1) {
        this.onScreen = false;
        this.t = 0;
        this.quip = null;
        this.armAngle = Math.PI;
      }
      return;
    }

    // Intro line 2: "Shoot that guy!" — skipped if a kill already advanced
    // the dialogue (kill lines take priority over the intro).
    if (this.dialogueStage === 0 && this.t >= BENDER_INTRO_DELAY) {
      this.showLine(1);
    }
    // v3.29.0: the cigar arm no longer tracks the ship — it rests at
    // armAngle (Math.PI, pointing left). The aim assist is purely the
    // MiniShip/PlayerWeapons gate on `active`.
  }

  /** Body center X: slide in from off-screen right → rest → slide back out. */
  bodyX() {
    const g = this.game;
    const w = BENDER_BODY_W * BENDER_SCALE;
    const rest = g.W + BENDER_MARGIN - w / 2;
    const off = g.W + BENDER_OFFSCREEN + w / 2;
    if (this.t < BENDER_ENTER) {
      const k = 1 - Math.pow(1 - this.t / BENDER_ENTER, 3); // easeOutCubic
      return off + (rest - off) * k;
    }
    if (!this.active && this.exitStart !== null) {
      const out = clamp((this.t - this.exitStart) / BENDER_EXIT, 0, 1);
      return rest + (off - rest) * out;
    }
    return rest;
  }

  shoulderPos() {
    const w = BENDER_BODY_W * BENDER_SCALE;
    const h = BENDER_BODY_H * BENDER_SCALE;
    return {
      x: this.bodyX() - w / 2 + BENDER_SHOULDER_IN_BODY.x * BENDER_SCALE,
      y: (this.game.H - h) / 2 + BENDER_SHOULDER_IN_BODY.y * BENDER_SCALE,
    };
  }

  draw(ctx) {
    if (!this.onScreen || !isBenderSpriteReady()) return;
    const w = BENDER_BODY_W * BENDER_SCALE;
    const h = BENDER_BODY_H * BENDER_SCALE;
    const x = this.bodyX() - w / 2;
    const y = (this.game.H - h) / 2;

    const body = getBenderBody();
    ctx.save();
    ctx.imageSmoothingEnabled = false; // crisp pixel art
    ctx.drawImage(body, x, y, w, h);
    ctx.restore();

    // Cigar arm: pivot at the body's shoulder, drawn at uniform scale
    // (v3.28.0: no stretch — the art keeps its proportions), resting at
    // armAngle (v3.29.0: no more ship tracking). The art is pre-rotated so
    // shoulder→hand = +x.
    const s = this.shoulderPos();
    const arm = getBenderArm();
    const aw = BENDER_ARM_W * BENDER_SCALE;
    const ah = BENDER_ARM_H * BENDER_SCALE;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(s.x, s.y);
    ctx.rotate(this.armAngle);
    ctx.drawImage(arm, -BENDER_SHOULDER_IN_ARM.x * BENDER_SCALE,
      -BENDER_SHOULDER_IN_ARM.y * BENDER_SCALE, aw, ah);
    ctx.restore();
  }
}

/**
 * v3.27.0 (reworked v3.28.0): Planet Express ship — traversing flyby.
 * Enters off-screen left and flies right; off-screen right it flips
 * (scaleX = -1, the sprite's nose faces +x) and flies back left.
 * Repeats the full right/left pattern SHIP_EGG_PASSES times, then
 * despawns. Friendly bullets damage it (SHIP_EGG_HP); on destruction
 * it explodes and drops a 'robot' power-up — catching it runs the
 * existing Game.collectPowerUp path → game.aimbot.trigger() (Bender's
 * kill-based aimbot dialogue, v3.29.0).
 */
export class ShipEasterEgg {
  constructor(game) {
    this.game = game;
    this.alive = true;
    this.t = 0;
    this.scale = SHIP_EGG_SCALE;
    this.x = -SHIP_W * this.scale - 40; // start off-screen left
    this.y = (game.H - SHIP_H * this.scale) / 2;
    this.dir = 1;        // v3.28.0: 1 = flying right, -1 = flying left (flipped)
    this.pass = 0;       // v3.28.0: completed right/left patterns
    this.hp = SHIP_EGG_HP;
    this.maxHp = SHIP_EGG_HP;
    this.wobblePhase = Math.random() * TAU;
  }

  /** 0 on entry → 1 on exit of the current pass (debug snapshot). */
  get progress() {
    const w = SHIP_W * this.scale;
    return clamp((this.x + w) / (this.game.W + w), 0, 1);
  }

  update(dt) {
    if (!this.alive) return;
    const g = this.game;
    const w = SHIP_W * this.scale;
    this.t += dt;
    this.x += this.dir * SHIP_EGG_SPEED * dt;
    this.y = (g.H - SHIP_H * this.scale) / 2 +
      Math.sin(this.t * 1.3 + this.wobblePhase) * SHIP_EGG_WOBBLE;
    if (this.dir === 1 && this.x > g.W) {
      this.dir = -1; // fully off-screen right → flip and head back left
    } else if (this.dir === -1 && this.x + w < 0) {
      this.dir = 1; // fully off-screen left → one full pattern done
      this.pass++;
      if (this.pass >= SHIP_EGG_PASSES) { this.alive = false; return; } // survived — despawn
    }
    this.checkBullets();
  }

  /** v3.28.0: friendly bullets vs the ship's bounding box (crate pattern). */
  checkBullets() {
    const g = this.game;
    const w = SHIP_W * this.scale, h = SHIP_H * this.scale;
    const cx = this.x + w / 2, cy = this.y + h / 2;
    for (const b of g.bullets) {
      if (!b.alive || !b.friendly) continue;
      if (Math.abs(b.x - cx) <= w / 2 + b.radius &&
          Math.abs(b.y - cy) <= h / 2 + b.radius) {
        b.alive = false;
        this.hp -= b.damage;
        g.particles.burst(b.x, b.y, { count: 8, color: '#ffd54f', speed: 160, life: 0.35, size: 2 });
        audio.hit();
        if (this.hp <= 0) this.destroy();
        break; // one bullet per frame is plenty
      }
    }
  }

  /** v3.28.0: explosion + mini Bender 'robot' drop + parting quip. */
  destroy() {
    if (!this.alive) return;
    this.alive = false;
    const g = this.game;
    const w = SHIP_W * this.scale, h = SHIP_H * this.scale;
    const cx = this.x + w / 2, cy = this.y + h / 2;
    g.particles.burst(cx, cy, { count: 48, color: '#ffd54f', speed: 380, life: 0.9, size: 4 });
    g.particles.burst(cx, cy, { count: 20, color: '#ffffff', speed: 180, life: 0.5, size: 3 });
    g.shake = Math.max(g.shake, 10);
    audio.explosion();
    bus.emit('banner', { text: 'Bite My Shiney Metal Ass!', tone: 'good', duration: 2.5 });
    // Normal-scaled mini Bender power-up (PowerUp 'robot' icon). Catching it
    // runs the existing Collisions.js → Game.collectPowerUp path, which
    // calls game.aimbot.trigger() — Bender's kill-based aimbot (v3.29.0).
    // v3.83.0: guaranteed special drop via the DropManager (bypasses
    // chance + cap — it's a scripted set-piece reward).
    spawnGuaranteedDrop(g, 'robot', cx, cy);
  }

  draw(ctx) {
    const w = SHIP_W * this.scale;
    const h = SHIP_H * this.scale;
    ctx.save();
    ctx.imageSmoothingEnabled = false; // crisp pixel art
    ctx.translate(this.x, this.y);
    if (this.dir < 0) ctx.scale(-1, 1); // nose faces +x; flip when heading left
    const ship = getShip();
    if (ship) {
      ctx.drawImage(ship, 0, 0, w, h);
    } else {
      // Placeholder while the sprite decodes (headless / early boot)
      ctx.fillStyle = '#eceff1';
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w * 0.42, h * 0.32, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#90a4ae';
      ctx.fillRect(w / 2 - w * 0.08, h / 2 - h * 0.52, w * 0.16, h * 0.24); // fin
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(w / 2 + w * 0.02, h / 2, h * 0.14, 0, TAU); // window
      ctx.fill();
    }
    ctx.restore();
    // HP bar (v3.28.0) — only once damaged
    if (this.alive && this.hp < this.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(this.x, this.y - 10, w, 4);
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(this.x, this.y - 10, w * Math.max(0, this.hp) / this.maxHp, 4);
    }
  }
}

/**
 * v3.27.0: spawn/replace an easter egg by type.
 * 'bender' — Bender (robot power-up / manager.trigger()), 'ship' —
 * Planet Express ship (dev panel Drop Ship), 'spaceballs' — Spaceballs
 * One (v3.81.0, dev panel "Spaceballs One" — force-spawn, no roll),
 * null — clear all eggs.
 */
export function switchEgg(game, type) {
  const e = game.eggs;
  if (type === 'bender') {
    if (e.bender && e.bender.onScreen) return; // one Bender at a time
    e.bender = new BenderEasterEgg(game);
    e.bender.trigger();
  } else if (type === 'ship') {
    if (e.ship) e.ship.alive = false; // replace a ship still flying
    e.ship = new ShipEasterEgg(game);
  } else if (type === 'spaceballs') { // v3.81.0: force-spawn (dev button)
    if (e.spaceballs) e.spaceballs.alive = false; // replace one still racing
    e.spaceballs = new SpaceballsOne(game);
  } else if (type === 'rnms') { // v4.1.0: force-spawn (dev button)
    if (e.rnms) e.rnms.alive = false; // replace one still patrolling
    // v4.12.0: the FULL encounter — Space Snake pre-wave first, then the
    // interceptor crosses in RNMSHIP.preWaveDelay later (the manager counts
    // down rnmsShipDelay in update()).
    const mgr = game.aimbot;
    if (mgr) {
      spawnRnMPreWave(game);
      mgr.rnmsShipDelay = RNMSHIP.preWaveDelay;
    } else {
      game.eggs.rnms = new RnMShip(game); // headless (no manager) — spawn directly
    }
  } else {
    if (e.bender) e.bender.reset();
    if (e.ship) e.ship.alive = false;
    if (e.spaceballs) e.spaceballs.alive = false; // v3.81.0
    if (e.rnms) e.rnms.alive = false; // v4.1.0
    e.bender = null;
    e.ship = null;
    e.spaceballs = null; // v3.81.0
    e.rnms = null; // v4.1.0
  }
}

/**
 * v3.81.0: the rare per-wave roll — WaveManager.startNext() calls this at
 * the top of every combat wave. Spawns Spaceballs One when the roll hits
 * AND the per-mission cap (SPACEBALLS_ONE.maxPerRun) hasn't been reached.
 * (Bonus rounds never call startNext, so they stay ship-free.)
 * @returns {boolean} true when Spaceballs One was spawned
 */
export function maybeSpawnSpaceballs(game) {
  const mgr = game.aimbot;
  if (!mgr || !game.eggs) return false;
  if (game.eggs.spaceballs) return false; // one at a time
  if (mgr.spaceballsCount >= SPACEBALLS_ONE.maxPerRun) return false; // per-mission cap
  if (Math.random() >= SPACEBALLS_ONE.spawnChance) return false; // rare
  mgr.spaceballsCount++;
  switchEgg(game, 'spaceballs');
  bus.emit('banner', { text: 'SPACEBALLS ONE INBOUND — WE BRAKE FOR NOBODY!', tone: 'warn', duration: 3 });
  return true;
}

/**
 * v4.12.0: SPACE SNAKE PRE-WAVE — the RnM encounter setup. A wave of
 * Space Snake enemies (type 'spacesnake' — .assets/SpaceSnake-256x256.png,
 * asset key `spacesnake`, stats from ENEMY_TYPES via EnemyBase) spawns
 * across the top of the playfield to set the scene ("Aw geez, Rick, is
 * that a snake?"); the interceptor crosses in RNMSHIP.preWaveDelay seconds
 * later (EasterEgg.update counts down mgr.rnmsShipDelay). Runs in BOTH
 * classic wave mode and Search & Destroy mode (same 'playing' gate as the
 * roll). The snakes are real enemies — shootable, they drift down and the
 * classic off-screen cull retires them, so the pre-wave clears itself.
 */
export function spawnRnMPreWave(game) {
  const list = game.enemies || (game.enemies = []);
  const n = RNMSHIP.preWaveCount;
  const margin = 140;
  for (let i = 0; i < n; i++) {
    const x = margin + ((i + 0.5) / n) * (game.viewW - margin * 2) + rand(-30, 30);
    const y = rand(40, 180);
    list.push(createEnemy({ type: 'spacesnake', tier: 'mob', x, y, game, difficulty: 1 }));
  }
}

/**
 * v4.1.0: the time-based roll — EasterEgg.update() calls this when a
 * roll window elapses (RNMSHIP.firstRollDelay after mission start, then
 * every RNMSHIP.rollIntervalMin–Max seconds), gated on
 * game.state === 'playing' so it works in BOTH classic wave mode and
 * Search & Destroy mode. Spawns the RnM ship interceptor when the roll
 * hits AND the per-mission cap (RNMSHIP.maxPerRun) hasn't been reached.
 * v4.7.0: the "RnM SHIP INTERCEPTOR INBOUND" spawn banner is GONE — the
 * ship plays its sequential Rick & Morty dialogue itself (RnMShip.js
 * RNMSHIP_DIALOGUE) as it crosses into view.
 * v4.12.0: the roll no longer spawns the ship directly — it starts the
 * SPACE SNAKE PRE-WAVE (spawnRnMPreWave) and arms rnmsShipDelay; the
 * interceptor crosses in RNMSHIP.preWaveDelay seconds later.
 * @returns {boolean} true when the encounter (pre-wave) was started
 */
export function maybeSpawnRnMShip(game) {
  const mgr = game.aimbot;
  if (!mgr || !game.eggs) return false;
  if (game.eggs.rnms) return false; // one at a time
  if (mgr.rnmsShipDelay !== null) return false; // v4.12.0: pre-wave already running
  if (mgr.rnmsCount >= RNMSHIP.maxPerRun) return false; // per-mission cap
  if (Math.random() >= RNMSHIP.spawnChance) return false; // v4.7.0: boosted (0.19)
  mgr.rnmsCount++;
  // v4.12.0: SPACE SNAKE PRE-WAVE — the snake wave enters the playfield
  // first; the interceptor crosses in RNMSHIP.preWaveDelay later.
  spawnRnMPreWave(game);
  mgr.rnmsShipDelay = RNMSHIP.preWaveDelay;
  return true;
}

/**
 * v3.27.0: manager — one slot per egg (`game.eggs`), both can be alive.
 * Preserves the v3.24.0 `game.aimbot` surface: `active`/`onScreen`/
 * `killCount`/`t`/`quip` proxy the Bender egg, `trigger()` spawns Bender,
 * `onEnemyKilled()` routes Combat.js kills to it (v3.29.0), `reset()`
 * clears everything, `update()`/`draw()` run both eggs.
 */
export default class EasterEgg {
  constructor(game) {
    this.game = game;
    this.eggs = { bender: null, ship: null, spaceballs: null, rnms: null }; // v4.1.0: + rnms slot
    this.spaceballsCount = 0; // v3.81.0: per-mission spawn counter (cap)
    this.rnmsCount = 0; // v4.1.0: per-mission spawn counter (cap)
    this.rnmsRollTimer = RNMSHIP.firstRollDelay; // v4.1.0: s until the first roll
    this.rnmsShipDelay = null; // v4.12.0: s until the RnM ship enters (Space Snake pre-wave); null = not pending
    game.eggs = this.eggs; // v3.27.0: debug snapshot + switchEgg target
  }

  // ─── v3.24.0 compat surface (Bender proxy) ───
  get active() { const b = this.eggs.bender; return !!(b && b.active); }
  get onScreen() { const b = this.eggs.bender; return !!(b && b.onScreen); }
  get aimbotActive() { const b = this.eggs.bender; return !!(b && b.aimbotActive); } // v3.29.0
  get killCount() { const b = this.eggs.bender; return b ? b.killCount : 0; } // v3.29.0
  get t() { const b = this.eggs.bender; return b ? b.t : 0; }
  get quip() { const b = this.eggs.bender; return b ? b.quip : null; }

  /** v3.24.0: robot power-up → Bender (Game.js 'robot' case). */
  trigger() { switchEgg(this.game, 'bender'); }

  /** v3.29.0: Combat.js onEnemyDeath hook — routes kills to the Bender egg. */
  onEnemyKilled(enemy, owner) {
    const b = this.eggs.bender;
    if (b && b.onEnemyKilled) b.onEnemyKilled(enemy, owner);
  }

  /** v3.24.0: Game.start() clears all eggs between missions. */
  reset() {
    if (this.eggs.bender) this.eggs.bender.reset();
    if (this.eggs.ship) this.eggs.ship.alive = false;
    if (this.eggs.spaceballs) this.eggs.spaceballs.alive = false; // v3.81.0
    if (this.eggs.rnms) this.eggs.rnms.alive = false; // v4.1.0
    this.eggs.bender = null;
    this.eggs.ship = null;
    this.eggs.spaceballs = null; // v3.81.0
    this.eggs.rnms = null; // v4.1.0
    this.spaceballsCount = 0; // v3.81.0: per-mission cap resets
    this.rnmsCount = 0; // v4.1.0: per-mission cap resets
    this.rnmsRollTimer = RNMSHIP.firstRollDelay; // v4.1.0: roll clock resets
    this.rnmsShipDelay = null; // v4.12.0: pending pre-wave → ship entry resets
  }

  update(dt) {
    const e = this.eggs;
    if (e.bender) {
      e.bender.update(dt);
      if (!e.bender.onScreen) e.bender = null; // done — free the slot
    }
    if (e.ship) {
      e.ship.update(dt);
      if (!e.ship.alive) e.ship = null; // flew off — free the slot
    }
    if (e.spaceballs) { // v3.81.0
      e.spaceballs.update(dt);
      if (!e.spaceballs.alive) e.spaceballs = null; // exited or destroyed — free the slot
    }
    if (e.rnms) { // v4.1.0
      e.rnms.update(dt);
      if (!e.rnms.alive) e.rnms = null; // destroyed — free the slot
    }
    // v4.1.0: RnM ship — rare time-based roll. Gated on 'playing' so it
    // runs in BOTH classic wave mode and Search & Destroy mode (this
    // manager updates in both — Game.update calls aimbot.update every
    // frame); bonus rounds / menus / game-over never roll.
    // v4.12.0: SPACE SNAKE PRE-WAVE — a hit starts the snake wave and arms
    // rnmsShipDelay (the interceptor crosses in RNMSHIP.preWaveDelay
    // later); the roll clock holds while the pre-wave is pending.
    if (this.game.state === 'playing') {
      // v4.12.0: pre-wave → ship entry countdown — the RnM interceptor
      // crosses in RNMSHIP.preWaveDelay seconds after the snake wave spawns
      // (armed by maybeSpawnRnMShip or the dev-button 'rnms' switchEgg).
      // Runs regardless of the per-mission cap so the dev button always
      // completes its encounter.
      if (this.rnmsShipDelay !== null) {
        this.rnmsShipDelay -= dt;
        if (this.rnmsShipDelay <= 0) {
          this.rnmsShipDelay = null;
          if (!e.rnms) e.rnms = new RnMShip(this.game);
        }
      }
      if (!e.rnms && this.rnmsCount < RNMSHIP.maxPerRun &&
          this.rnmsShipDelay === null) {
        this.rnmsRollTimer -= dt;
        if (this.rnmsRollTimer <= 0) {
          if (maybeSpawnRnMShip(this.game)) {
            // encounter started — next roll window opens after the delay
            this.rnmsRollTimer = rand(RNMSHIP.rollIntervalMin, RNMSHIP.rollIntervalMax) + RNMSHIP.preWaveDelay;
          } else {
            this.rnmsRollTimer = rand(RNMSHIP.rollIntervalMin, RNMSHIP.rollIntervalMax);
          }
        }
      }
    }
  }

  draw(ctx) {
    const e = this.eggs;
    if (e.bender) e.bender.draw(ctx);
    if (e.ship) e.ship.draw(ctx);
    if (e.spaceballs) e.spaceballs.draw(ctx); // v3.81.0
    if (e.rnms) e.rnms.draw(ctx); // v4.1.0
  }
}

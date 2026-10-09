// Filename: RnMShip.js
// Kitty Vs Everything — v4.1.0
// v4.7.0: RICK & MORTY DIALOGUE + SPAWN-RATE BOOST — the generic
//          "RnM SHIP INTERCEPTOR INBOUND" spawn banner is GONE: the ship
//          now plays a sequential on-screen dialogue (RNMSHIP_DIALOGUE,
//          the Bender-egg showLine pattern through the #alert-banner
//          'dialogue' style) as it crosses into view:
//            RICK:  "Come on Morty, 20 minutes! In and out!"
//            MORTY: "Aw geez, Rick, is that a snake?"
//            RICK:  "Yes Morty, I told you, there's everything in space."
//          Spawn rate significantly increased (still a capped easter
//          egg): RNMSHIP.spawnChance 0.03 → 0.19 per roll window, roll
//          windows every 8–15 s (was 25–45 s), first roll 8 s after
//          mission start (was 20 s), per-mission cap 2 → 5. Destruction
//          still drops the GUARANTEED Frenzy power-up.
// "RnM ship" — the rare easter-egg INTERCEPTOR (v4.1.0).
//
// Spawn: a rare time-based roll in the EasterEgg manager (RNMSHIP.spawnChance
// per roll window, capped at RNMSHIP.maxPerRun per mission — the roll lives
// in EasterEgg.update, gated on game.state === 'playing', so it works in
// BOTH classic wave mode and Search & Destroy mode — one code path). The
// dev panel "RnM Ship" button force-spawns it (switchEgg(game, 'rnms')).
//
// Flight: enters off-screen left and flies horizontally right
// (RNMSHIP.speed px/s, delta-time integrated) at mid-screen height with a
// gentle vertical wobble. Fully off-screen right it turns around (dir = -1,
// the sprite mirrors — the nose faces +x in the raw art) and patrols back
// left; fully off-screen left it turns around again (dir = 1). It loops
// this right/left patrol until destroyed (no pass limit — the interceptor
// keeps crossing the screen).
//
// Combat: friendly bullets damage it (RNMSHIP.hp, ship-egg bounding-box
// pattern). On destruction it explodes and drops a GUARANTEED Frenzy
// power-up directly at its death coordinates (spawnGuaranteedDrop —
// bypasses DROP_POLICY chance + cap, the scripted set-piece reward).
//
// Art: RnMShipArt.js (.assets/RnMship-256x256.png, key `rnms`, uniform
// RNMSHIP.scale — the 256×256 art stays square, no stretch).

import { clamp, TAU } from '../../../core/utils.js';
import { bus } from '../../../core/EventBus.js';
import { audio } from '../../../core/AudioSystem.js';
import { spawnGuaranteedDrop } from '../../../core/DropManager.js'; // guaranteed Frenzy
import { rnmsArtDims, drawRnMShip } from './RnMShipArt.js';

/** v4.1.0: RnM ship tuning (single source of truth). v4.7.0: spawn-rate boost. */
export const RNMSHIP = {
  spawnChance: 0.19,      // v4.7.0: boosted roll per roll window (was 0.03 — ~6x more likely)
  rollIntervalMin: 8,     // v4.7.0: s between roll windows (was 25)
  rollIntervalMax: 15,    // v4.7.0: s between roll windows (was 45)
  firstRollDelay: 8,      // v4.7.0: s after mission start before the first roll (was 20)
  maxPerRun: 5,           // v4.7.0: per-mission cap (was 2 — EasterEgg manager counts)
  hp: 120,                // shootable durability — ~a few seconds of fire
  speed: 240,             // px/s horizontal patrol (both directions)
  scale: 0.5,             // 256×256 art → 128×128 on screen (uniform scale)
  wobble: 10,             // px amplitude of the vertical bob
};

/** v4.7.0: sequential RnM dialogue — the iconic interceptor lines, shown
 *  on-screen (banner 'dialogue' style) as the ship crosses into view:
 *  line 0 RNMSHIP_FIRST_LINE_DELAY after spawn, then one line every
 *  RNMSHIP_LINE_INTERVAL (Bender-egg showLine pattern). Replaces the
 *  v4.1.0 "RnM SHIP INTERCEPTOR INBOUND" spawn banner. */
export const RNMSHIP_DIALOGUE = [
  'RICK: "Come on Morty, 20 minutes! In and out!"',
  'MORTY: "Aw geez, Rick, is that a snake?"',
  "RICK: \"Yes Morty, I told you, there's everything in space.\"",
];
const RNMSHIP_FIRST_LINE_DELAY = 0.8; // s after spawn before line 0 (the ship crossing in)
const RNMSHIP_LINE_INTERVAL = 3;      // s between dialogue lines

export default class RnMShip {
  constructor(game) {
    this.game = game;
    this.alive = true;
    this.t = 0;
    this.hp = RNMSHIP.hp;
    this.maxHp = RNMSHIP.hp;
    this.destroyed = false; // debug snapshot (shot down → true)
    // On-screen art size (registry dims × uniform scale — square art).
    const dims = rnmsArtDims();
    this.w = dims.w * RNMSHIP.scale;
    this.h = dims.h * RNMSHIP.scale;
    // Enter off-screen left, flying right (dir = 1).
    this.x = -this.w - 40;
    this.y = (game.viewH - this.h) / 2;
    this.dir = 1; // 1 = flying right, -1 = patrolling back left (mirrored)
    this.wobblePhase = Math.random() * TAU;
    // v4.7.0: sequential RnM dialogue state (Bender-egg pattern).
    this.dialogueStage = -1; // index of the last shown line (-1 = none yet)
    this.dialogueTimer = 0;  // s since spawn (drives the line schedule)
    this.quip = null;        // current dialogue line (debug snapshot)
  }

  /** 0 on entry (left) → 1 on exit of the right edge (debug snapshot). */
  get progress() {
    return clamp((this.x + this.w) / (this.game.viewW + this.w), 0, 1);
  }

  update(dt) {
    if (!this.alive) return;
    const g = this.game;
    this.t += dt;
    this.x += this.dir * RNMSHIP.speed * dt;
    this.y = (g.viewH - this.h) / 2 +
      Math.sin(this.t * 1.3 + this.wobblePhase) * RNMSHIP.wobble;
    if (this.dir === 1 && this.x > g.viewW) {
      this.dir = -1; // fully off-screen right → turn around, patrol back left
    } else if (this.dir === -1 && this.x + this.w < 0) {
      this.dir = 1; // fully off-screen left → turn around, patrol right (loop)
    }
    this.updateDialogue(dt); // v4.7.0: sequential RnM dialogue
    this.checkBullets();
  }

  /** v4.7.0: sequential RnM dialogue — line 0 RNMSHIP_FIRST_LINE_DELAY
   *  after spawn (as the ship crosses into view), then one line every
   *  RNMSHIP_LINE_INTERVAL. One pass per ship (no repeat on patrol). */
  updateDialogue(dt) {
    this.dialogueTimer += dt;
    const next = this.dialogueStage + 1;
    if (next >= RNMSHIP_DIALOGUE.length) return;
    const due = RNMSHIP_FIRST_LINE_DELAY + next * RNMSHIP_LINE_INTERVAL;
    if (this.dialogueTimer >= due) this.showLine(next);
  }

  /** v4.7.0: show dialogue line i (stylized 'dialogue' banner + audio). */
  showLine(i) {
    this.dialogueStage = i;
    this.quip = RNMSHIP_DIALOGUE[i];
    bus.emit('banner', { text: this.quip, tone: 'dialogue', duration: RNMSHIP_LINE_INTERVAL });
    audio.banner();
  }

  /** Friendly bullets vs the ship's bounding box (ship-egg pattern). */
  checkBullets() {
    const g = this.game;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    for (const b of g.bullets) {
      if (!b.alive || !b.friendly) continue;
      if (Math.abs(b.x - cx) <= this.w / 2 + b.radius &&
          Math.abs(b.y - cy) <= this.h / 2 + b.radius) {
        b.alive = false;
        this.hp -= b.damage;
        g.particles.burst(b.x, b.y, { count: 8, color: '#ffd54f', speed: 160, life: 0.35, size: 2 });
        audio.hit();
        if (this.hp <= 0) this.destroy();
        break; // one bullet per frame is plenty
      }
    }
  }

  /** v4.1.0: destroyed → explosion + GUARANTEED Frenzy drop at the death point. */
  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.destroyed = true;
    const g = this.game;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    g.particles.burst(cx, cy, { count: 48, color: '#ffd54f', speed: 380, life: 0.9, size: 4 });
    g.particles.burst(cx, cy, { count: 20, color: '#ffffff', speed: 180, life: 0.5, size: 3 });
    g.shake = Math.max(g.shake, 10);
    audio.explosion();
    bus.emit('banner', { text: 'RnM SHIP DOWN — FRENZY GUARANTEED!', tone: 'good', duration: 2.5 });
    // Guaranteed special drop (bypasses DROP_POLICY chance + cap — scripted
    // set-piece reward): the Frenzy power-up spawns at the death coordinates
    // for the player to collect (Collisions.js → Game.collectPowerUp).
    spawnGuaranteedDrop(g, 'frenzy', cx, cy);
  }

  draw(ctx) {
    if (!this.alive) return;
    drawRnMShip(ctx, this.x, this.y, this.dir, RNMSHIP.scale);
    // HP bar (ship-egg pattern) — only once damaged.
    if (this.hp < this.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(this.x, this.y - 10, this.w, 4);
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(this.x, this.y - 10, this.w * Math.max(0, this.hp) / this.maxHp, 4);
    }
  }
}
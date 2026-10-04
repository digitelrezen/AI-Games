// Filename: BoneYardBonus.js
// Kitty Vs Everything — v3.76.0
// v3.76.0 (LevelRegistry refactor): uniform stage interface — start() is
//          now init(); the timer-expired branch no longer drives the game
//          state itself, it sets this.complete and Game.advanceStage()
//          (via the LevelRegistry manifest) starts the next stage.
//          cleanup() clears any leftover bonus targets.
// "The Bone Yard" — 3-phase comedic bonus stage (original flow, restored):
//   Phase 1: Infinite Boneyard (floating bones drift down, shoot for shrapnel)
//   Phase 2: The Human Line (tight single-file line of Humans marches down)
//   Phase 3: Comedic Victory (line never ends, timer expires, you "win" by
//             NOT making it — stage complete, Game.advanceStage() resumes)
// v3.16.0 (v3.60.0 release): fully DESTRUCTIBLE yard — the v3.15.0
//          non-shootable pixel-art backdrop is gone. The stage now opens on
//          a SEEDED field of 29 destructible BoneFragment bonus targets
//          (BONUS.BONE_YARD_FIELD: 10 femur / 10 profile_bone / 6 skull /
//          3 skeleton) drifting at the old backdrop parallax speed
//          (6–18 px/s), with the skeleton sentinels hugging the left/right
//          margins; Phase 1 rains more bones from the weighted
//          BONE_FRAGMENT_POOL. draw() is a no-op hook — the bones render
//          through Game's bonusTargets pass, so every bone is a live,
//          damageable, shatterable target.
// v3.13.0: Lane/centering math uses the LIVE viewport (game.viewW/viewH)
//          so the stage spans the full ultra-wide; humans are real people
//          (HumanSprite.js) created through EnemyFactory — marchMode gives
//          the original straight-down march (replaces the inline move()
//          override) and the walk cycle animates as they advance.
// v3.14.0 (v3.50.0 release): Phase 2/3 spawning is locked to an EXPLICIT
//          humanoid allowlist (BONE_YARD_HUMANOID_TYPES) — new species added
//          to ENEMY_TYPES (e.g. 'shuttle') can never leak into the march.
// v3.15.0 (v3.54.0 release): pixel-art boneyard environment — a SEEDED
//          backdrop of the shared PNGs (skeleton / skull / femur /
//          profile_bone). SUPERSEDED by v3.16.0: the yard is now fully
//          destructible (see above).
export const VERSION = 'v3.76.0';
import { BONUS } from '../core/config.js';
import { rand } from '../core/utils.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';
import BoneFragment from './BoneFragment.js';
import { createEnemy } from '../enemies/EnemyFactory.js';

// v3.14.0: Phase 2/3 humanoid line — EXPLICIT allowlist. The Bone Yard march
// is standard humanoids only; new species added to ENEMY_TYPES (e.g. the
// v3.50.0 'shuttle') must never leak into it. Extend this list deliberately
// if a future phase should march something else.
const BONE_YARD_HUMANOID_TYPES = ['human'];

// Deterministic PRNG (mulberry32) — the yard field layout is identical
// every run.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default class BoneYardBonus {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.complete = false; // v3.76.0: uniform stage interface
    this.phase = 0; // 1, 2, 3
    this.phaseTimer = 0;
    this.timeLeft = 0;
    this.boneSpawnTimer = 0;
    this.humanSpawnTimer = 0;
    this.humanX = 0; // fixed X for the single-file line
    this.humanCount = 0;
  }

  init() { // v3.76.0: uniform stage interface (was start())
    this.active = true;
    this.complete = false;
    this.phase = 1;
    this.phaseTimer = 0;
    this.timeLeft = BONUS.BONE_YARD_DURATION;
    this.boneSpawnTimer = 0.3;
    this.humanSpawnTimer = 0;
    // v3.13.0: line X on the LIVE viewport center.
    this.humanX = this.game.viewW / 2 + rand(-60, 60);
    this.humanCount = 0;
    // Clear any existing bonus targets
    this.game.bonusTargets = [];
    // v3.16.0: seed the yard with a field of DESTRUCTIBLE bones (the
    // v3.15.0 non-shootable backdrop is gone).
    this._seedYardField();
    // Phase 1 banner
    bus.emit('banner', {
      text: "It just keeps going and and going... I'll never make it to Eridaths Mom's house.",
      tone: 'bad',
      duration: 3.5,
    });
    audio.banner();
  }

  // v3.16.0 — seed the yard with a deterministic field of destructible
  // bones (BONUS.BONE_YARD_FIELD). Regular bones fill the field, skulls
  // are scattered mid-field, and the skeleton sentinels hug the
  // left/right margins. Drift speed matches the old backdrop parallax
  // (6–18 px/s) with no horizontal drift, so the field stays a calm
  // graveyard until you shoot it up. Seeded (mulberry32, 20261001) so
  // the layout is identical every run.
  _seedYardField() {
    const rng = mulberry32(20261001); // v3.54.0 release date — stable yard layout
    const W = this.game.viewW;
    const H = this.game.viewH;
    const field = BONUS.BONE_YARD_FIELD;
    const layout = [];
    for (const [key, count] of Object.entries(field)) {
      for (let i = 0; i < count; i++) layout.push(key);
    }
    // Deterministic Fisher–Yates shuffle on the seeded rng.
    for (let i = layout.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [layout[i], layout[j]] = [layout[j], layout[i]];
    }
    for (const key of layout) {
      const sentinel = key === 'skeleton';
      const x = sentinel
        ? (rng() < 0.5 ? 40 + rng() * W * 0.1 : W - 40 - rng() * W * 0.1)
        : 30 + rng() * (W - 60);
      const bone = new BoneFragment({
        x,
        y: -40 - rng() * (H + 60),
        game: this.game,
        spriteKey: key,
      });
      bone.vy = 6 + rng() * 12; // old backdrop parallax (6–18 px/s)
      bone.vx = 0;
      this.game.bonusTargets.push(bone);
    }
  }

  update(dt) {
    if (!this.active) return;
    this.phaseTimer += dt;
    this.timeLeft -= dt;

    // ─── PHASE TRANSITIONS ───
    if (this.phase === 1 && this.phaseTimer >= BONUS.BONE_YARD_PHASE1) {
      this.phase = 2;
      this.phaseTimer = 0;
      this.humanSpawnTimer = 0.5;
      // Phase 2 banner
      bus.emit('banner', {
        text: "Oh Lord look at the line. I'll never make it in time...",
        tone: 'bad',
        duration: 3,
      });
      audio.banner();
    }
    if (this.phase === 2 && this.phaseTimer >= BONUS.BONE_YARD_PHASE2) {
      this.phase = 3;
      this.phaseTimer = 0;
      // Phase 3: no new banner, just keep spawning
    }

    // ─── PHASE 1: Spawn floating bones ───
    if (this.phase === 1) {
      this.boneSpawnTimer -= dt;
      if (this.boneSpawnTimer <= 0) {
        this.boneSpawnTimer = rand(0.25, 0.6);
        // v3.13.0: live viewport width.
        const x = rand(60, this.game.viewW - 60);
        // v3.16.0: no spriteKey → the weighted BONE_FRAGMENT_POOL decides
        // (mostly regular bones, some skulls, rare skeletons).
        this.game.bonusTargets.push(new BoneFragment({ x, y: -30, game: this.game }));
      }
    }

    // ─── PHASE 2 & 3: Spawn the endless human line ───
    if (this.phase >= 2) {
      this.humanSpawnTimer -= dt;
      if (this.humanSpawnTimer <= 0) {
        // Tight single-file line: all at same X, staggered Y
        this.humanSpawnTimer = this.phase === 2 ? rand(0.4, 0.8) : rand(0.3, 0.6);
        const y = -40 - (this.humanCount % 5) * 10;
        // v3.14.0: type comes from the explicit humanoid allowlist — the
        // Bone Yard line is standard humanoids only (never 'shuttle').
        const human = createEnemy({
          type: BONE_YARD_HUMANOID_TYPES[0],
          tier: 'mob',
          x: this.humanX + rand(-8, 8),
          y,
          game: this.game,
        });
        // v3.13.0: march straight down (no strafing) — the original Bone
        // Yard behavior, now a built-in mode on HumanEnemy.
        human.marchMode = true;
        // Reduce fire rate so they're more of a wall than a shooter
        human.fireRate = 2.0;
        this.game.enemies.push(human);
        this.humanCount++;
      }
    }

    // ─── TIMER EXPIRED: COMIC VICTORY ───
    if (this.timeLeft <= 0) {
      this.active = false;
      // Triumphant victory for NOT making it
      bus.emit('banner', {
        text: "VICTORY! You did NOT make it to Eridath's Mom's house in time. LEGENDARY.",
        tone: 'good',
        duration: 4,
      });
      audio.powerup();
      // Clear remaining bonus targets and enemies gracefully
      for (const bt of this.game.bonusTargets) {
        if (bt.alive) bt.alive = false;
      }
      this.game.bonusTargets = [];
      // Score bonus for surviving
      const bonusPts = 10000 * this.game.multiplier;
      this.game.score += bonusPts;
      bus.emit('dmg', {
        // v3.13.0: live viewport center.
        x: this.game.viewW / 2, y: this.game.viewH / 2,
        text: '+' + bonusPts.toLocaleString() + ' SURVIVAL BONUS',
        color: '#ffd54f',
      });
      // v3.76.0: the stage is done — Game.advanceStage() (LevelRegistry
      // manifest) returns to the next combat wave.
      this.complete = true;
    }
  }

  /** v3.76.0: uniform stage interface — true when the round has ended. */
  isComplete() {
    return this.complete;
  }

  /** v3.76.0: uniform stage interface — clear any leftover yard bones. */
  cleanup() {
    this.game.bonusTargets = [];
  }

  // v3.16.0 — no-op hook kept for BonusLevel's render delegation. The
  // yard's bones are bonusTargets and render through Game's bonusTargets
  // pass (the v3.15.0 non-destructible backdrop is gone).
  draw(ctx) {}
}

// Filename: BoneYardBonus.js
// Kitty Vs Everything — v3.76.0
// v3.76.0 (LevelRegistry refactor): uniform stage interface — start() is
//          now init(); the timer-expired branch no longer drives the game
//          state itself, it sets this.complete and Game.advanceStage()
//          (via the LevelRegistry manifest) starts the next stage.
//          cleanup() clears any leftover bonus targets.
// v4.24.0: 4-PHASE SCRIPTED ENCOUNTER — Eridath's Mom's House.
//   Phase 1 (12s): a long single-file line of Humans streams in from the
//     top (marchMode) while the yard rains weighted bones. Dialogue 0.
//   Phase 2 (8s): 4 parallel lines of Humans rush bottom→top
//     (HumanEnemy.rushMode — no firing). Dialogue 1–2.
//   Phase 3: player controls LOCK (Player.controlsLocked); Eridath's
//     Mom's House (js/levels/EridathsMomsHouse.js) descends from the top
//     of the view and settles.
//   Phase 4: controls unlock; the house dumps humans + skeletons until
//     the player has survived BONE_YARD_FIGHT_MIN (15s) OR the house has
//     taken its 1/16 damage cap — then it teleports out and the stage
//     completes (Game.advanceStage() resumes).
//   The yard is framed by 8 dense bone columns (4 per interior border,
//   BONUS.BONE_YARD_COLUMNS) drawn through BonusLevel's draw()
//   delegation — the center corridor stays clear.
//   The house is a STAGE SUB-MODULE: it is NOT a registered BONUS_STAGES
//   entry and it lives outside game.enemies — the stage owns its bullet
//   collision (_houseBulletHits) so it never enters the enemy
//   ram/death pipeline or wave-clear bookkeeping.
// v3.16.0 (v3.60.0 release): fully DESTRUCTIBLE yard — the v3.15.0
//          non-shootable pixel-art backdrop is gone. The stage now opens on
//          a SEEDED field of 29 destructible BoneFragment bonus targets
//          (BONUS.BONE_YARD_FIELD: 10 femur / 10 profile_bone / 6 skull /
//          3 skeleton) drifting at the old backdrop parallax speed
//          (6–18 px/s), with the skeleton sentinels hugging the left/right
//          margins; Phase 1 rains more bones from the weighted
//          BONE_FRAGMENT_POOL.
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
import { rand, TAU } from '../core/utils.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';
import BoneFragment from './BoneFragment.js';
import EridathsMomsHouse from './EridathsMomsHouse.js'; // v4.24.0: scripted centerpiece
import { createEnemy } from '../enemies/EnemyFactory.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v4.24.0: bone columns

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
    this.phase = 0; // v4.24.0: 1, 2, 3, 4
    this.phaseTimer = 0;
    this.t = 0; // v4.24.0: stage clock (dialogue scheduling)
    this.fightTimer = 0; // v4.24.0: Phase 4 survival clock (15s gate)
    this.house = null; // v4.24.0: Eridath's Mom's House
    this.dialogueQueue = []; // v4.24.0: { at, text }
    this.boneSpawnTimer = 0;
    this.humanSpawnTimer = 0;
    this.rushSpawnTimer = 0; // v4.24.0: Phase 2 rush spawner
    this.rushLine = 0; // v4.24.0: which rush line is next
    this.humanX = 0; // fixed X for the single-file line
    this.humanCount = 0;
  }

  init() { // v3.76.0: uniform stage interface (was start())
    this.active = true;
    this.complete = false;
    this.phase = 1;
    this.phaseTimer = 0;
    this.t = 0;
    this.fightTimer = 0;
    this.house = null;
    this.dialogueQueue = [];
    this.boneSpawnTimer = 0.3;
    this.humanSpawnTimer = 0.5;
    this.rushSpawnTimer = 0;
    this.rushLine = 0;
    // v3.13.0: line X on the LIVE viewport center.
    this.humanX = this.game.viewW / 2 + rand(-60, 60);
    this.humanCount = 0;
    // Clear any existing bonus targets
    this.game.bonusTargets = [];
    // v3.16.0: seed the yard with a field of DESTRUCTIBLE bones (the
    // v3.15.0 non-shootable backdrop is gone).
    this._seedYardField();
    // v4.24.0: Phase 1 opens on the line forming (dialogue line 0).
    this._say(BONUS.BONE_YARD_DIALOGUE[0], 0.5);
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

  // ─── v4.24.0: DIALOGUE (RnM-style 'dialogue' banner + voice blip) ───
  // Lines queue so they never overlap: a queued line waits until the
  // previous one's subtitle (line-length based) has finished.
  _say(text, delay = 0) {
    this.dialogueQueue.push({ at: this.t + delay, text });
  }

  _updateDialogue() {
    while (this.dialogueQueue.length && this.dialogueQueue[0].at <= this.t) {
      const q = this.dialogueQueue.shift();
      // Subtitle stays up long enough to read (line-length based).
      const duration = Math.min(4.5, Math.max(2.2, q.text.length * 0.05));
      bus.emit('banner', { text: q.text, tone: 'dialogue', duration });
      audio.voiceLine();
      // Keep the queue overlap-free: later lines wait for this one.
      for (const rest of this.dialogueQueue) {
        rest.at = Math.max(rest.at, this.t + duration);
      }
    }
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    this.phaseTimer += dt;
    this._updateDialogue();

    // v4.24.0: stage-owned TOP cull — EnemyBase only culls bottom/sides,
    // so the stage reaps its own top-exiting spawns (Phase 2 rush lines).
    this.game.enemies = this.game.enemies.filter((e) => e.y > -120);

    if (this.phase === 1) this._updatePhase1(dt);
    else if (this.phase === 2) this._updatePhase2(dt);
    else if (this.phase === 3) this._updatePhase3(dt);
    else if (this.phase === 4) this._updatePhase4(dt);

    // v4.24.0: house bullet collision (stage-owned — the house is not in
    // game.enemies, so it never enters the enemy ram/death pipeline).
    this._houseBulletHits();
  }

  // ─── PHASE 1: the line forms (bone rain + single-file march from top) ───
  _updatePhase1(dt) {
    // ─── PHASE 1: Spawn floating bones ───
    this.boneSpawnTimer -= dt;
    if (this.boneSpawnTimer <= 0) {
      this.boneSpawnTimer = rand(0.25, 0.6);
      // v3.13.0: live viewport width.
      const x = rand(60, this.game.viewW - 60);
      // v3.16.0: no spriteKey → the weighted BONE_FRAGMENT_POOL decides
      // (mostly regular bones, some skulls, rare skeletons).
      this.game.bonusTargets.push(new BoneFragment({ x, y: -30, game: this.game }));
    }
    // ─── PHASE 1: the endless human line (single-file, from the top) ───
    this.humanSpawnTimer -= dt;
    if (this.humanSpawnTimer <= 0) {
      // Tight single-file line: all at same X, staggered Y
      this.humanSpawnTimer = rand(0.4, 0.8);
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
    if (this.phaseTimer >= BONUS.BONE_YARD_PHASE1) {
      this.phase = 2;
      this.phaseTimer = 0;
      this.rushSpawnTimer = 0;
      // v4.24.0: Phase 2 — the lines surge (dialogue lines 1–2, queued).
      this._say(BONUS.BONE_YARD_DIALOGUE[1], 0.4);
      this._say(BONUS.BONE_YARD_DIALOGUE[2], 0.4);
    }
  }

  // ─── PHASE 2: 4 parallel rush lines, bottom→top ───
  _updatePhase2(dt) {
    this.rushSpawnTimer -= dt;
    if (this.rushSpawnTimer <= 0) {
      this.rushSpawnTimer = 0.6;
      const n = BONUS.BONE_YARD_RUSH_LINES;
      // Lanes evenly spread across the viewport (never the very edges).
      const lane = this.game.viewW * ((this.rushLine % n) + 1) / (n + 1);
      this.rushLine++;
      const human = createEnemy({
        type: BONE_YARD_HUMANOID_TYPES[0],
        tier: 'mob',
        x: lane + rand(-14, 14),
        y: this.game.viewH + 40,
        game: this.game,
      });
      // v4.24.0: bottom→top surge, no firing (HumanEnemy.rushMode).
      human.rushMode = true;
      this.game.enemies.push(human);
    }
    if (this.phaseTimer >= BONUS.BONE_YARD_PHASE2) {
      this.phase = 3;
      this.phaseTimer = 0;
      this._startHouse();
    }
  }

  // ─── PHASE 3: controls locked; the house descends from the top ───
  _startHouse() {
    if (this.game.player) this.game.player.controlsLocked = true;
    this.house = new EridathsMomsHouse(this.game, { onExit: () => this._finish() });
  }

  _updatePhase3(dt) {
    this.house.update(dt);
    if (this.house.settled) {
      // v4.24.0: Phase 4 — the house has settled and started dumping.
      this.phase = 4;
      this.phaseTimer = 0;
      this.fightTimer = 0;
      if (this.game.player) this.game.player.controlsLocked = false;
      this._say(BONUS.BONE_YARD_DIALOGUE[3], 0.3);
      this._say(BONUS.BONE_YARD_DIALOGUE[4], 0.3);
    }
  }

  // ─── PHASE 4: the fight (15s survival gate OR the 1/16 damage cap) ───
  _updatePhase4(dt) {
    this.fightTimer += dt;
    this.house.update(dt);
    if (this.fightTimer >= BONUS.BONE_YARD_FIGHT_MIN || this.house.capReached) {
      this.house.startTeleport();
    }
  }

  // v4.24.0: stage-owned bullet collision for the house (it is not in
  // game.enemies — see EridathsMomsHouse.js header).
  _houseBulletHits() {
    if (!this.house || this.house.state === 'teleporting' || this.house.state === 'exiting') return;
    const bullets = this.game.bullets || [];
    for (const b of bullets) {
      if (!b || !b.alive || !b.friendly) continue;
      const rr = b.radius + this.house.radius;
      const dx = b.x - this.house.x, dy = b.y - this.house.y;
      if (dx * dx + dy * dy < rr * rr) {
        this.house.applyDamage(b.damage);
        b.alive = false;
        this.game.particles.burst(b.x, b.y, { count: 5, color: '#e8e4d8', speed: 110, life: 0.25 });
        audio.hit();
      }
    }
  }

  // v4.24.0: the encounter is over — the house has teleported out, the
  // yard is clear, the stage completes (Game.advanceStage() resumes).
  _finish() {
    if (this.complete) return;
    this.complete = true;
    this.active = false;
    if (this.house) this.house.clearDumps();
    this.game.enemies = [];
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
  }

  /** v3.76.0: uniform stage interface — true when the round has ended. */
  isComplete() {
    return this.complete;
  }

  /** v3.76.0: uniform stage interface — clear any leftover yard bones. */
  cleanup() {
    // v4.24.0: reap the house's spawns and NEVER leak the control lock.
    if (this.house) {
      this.house.clearDumps();
      this.house = null;
    }
    if (this.game.player) this.game.player.controlsLocked = false;
    this.game.bonusTargets = [];
    this.game.enemies = [];
  }

  // v4.24.0 — the yard's architecture: 8 dense bone columns (4 per
  // interior border, BONUS.BONE_YARD_COLUMNS) frame the fight; the
  // center corridor stays clear. The house paints over them (BonusLevel
  // draws the stage before the bonusTargets/enemies passes).
  draw(ctx) {
    if (!this.active) return;
    this._drawColumns(ctx);
    if (this.house && this.house.state !== 'exiting') this.house.draw(ctx);
  }

  _drawColumns(ctx) {
    const { perSide, bonesPerColumn } = BONUS.BONE_YARD_COLUMNS;
    const W = this.game.viewW, H = this.game.viewH;
    const colW = 30; // column band width (px) per side
    const gap = 8;
    const slotH = H / bonesPerColumn;
    const sprite = getSprite('femur');
    const dims = getDims('femur');
    for (let side = 0; side < 2; side++) {
      for (let c = 0; c < perSide; c++) {
        const bx = side === 0
          ? 12 + c * (colW + gap)
          : W - 12 - (c + 1) * (colW + gap);
        for (let j = 0; j < bonesPerColumn; j++) {
          // Deterministic jitter (stable across frames).
          const jx = Math.sin(c * 12.9898 + j * 78.233) * 3;
          const jy = j * slotH + slotH / 2 + Math.cos(c * 4.7 + j * 9.1) * 2;
          this._drawColumnBone(ctx, bx + jx, jy, colW - 6, sprite, dims);
        }
      }
    }
  }

  _drawColumnBone(ctx, x, y, w, sprite, dims) {
    ctx.save();
    ctx.translate(x, y);
    if (sprite && dims) {
      const bh = (w * dims.h) / dims.w;
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(sprite, -w / 2, -bh / 2, w, bh);
    } else {
      // Procedural fallback: a horizontal bone (shaft + end knobs).
      const h = w * 0.32;
      ctx.fillStyle = '#e8dcc8';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#f0e8d4';
      ctx.beginPath();
      ctx.arc(-w / 2, -h * 0.3, h * 0.6, 0, TAU);
      ctx.arc(-w / 2, h * 0.3, h * 0.55, 0, TAU);
      ctx.arc(w / 2, -h * 0.3, h * 0.6, 0, TAU);
      ctx.arc(w / 2, h * 0.3, h * 0.55, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

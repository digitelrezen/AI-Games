// Filename: BoneYardBonus.js
// Kitty Vs Everything — v3.13.0
// "The Bone Yard" — 3-phase comedic bonus stage (original flow, restored):
//   Phase 1: Infinite Boneyard (floating bones drift down, shoot for shrapnel)
//   Phase 2: The Human Line (tight single-file line of Humans marches down)
//   Phase 3: Comedic Victory (line never ends, timer expires, you "win" by
//             NOT making it — returns to gameplay via waveManager.startNext())
// v3.13.0: Lane/centering math uses the LIVE viewport (game.viewW/viewH)
//          so the stage spans the full ultra-wide; humans are real people
//          (HumanSprite.js) created through EnemyFactory — marchMode gives
//          the original straight-down march (replaces the inline move()
//          override) and the walk cycle animates as they advance.
// v3.14.0 (v3.50.0 release): Phase 2/3 spawning is locked to an EXPLICIT
//          humanoid allowlist (BONE_YARD_HUMANOID_TYPES) — new species added
//          to ENEMY_TYPES (e.g. 'shuttle') can never leak into the march.
// v3.15.0 (v3.54.0 release): pixel-art boneyard environment — draw(ctx)
//          renders a SEEDED backdrop of the shared PNGs (skeleton / skull /
//          femur / profile_bone) through the AssetManager pipeline,
//          aspect-preserving with slow parallax drift + wrap; procedural
//          fallbacks per the AssetManager contract.
export const VERSION = 'v3.15.0';
import { BONUS } from '../core/config.js';
import { TAU, rand } from '../core/utils.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';
import { getSprite, getDims } from '../core/AssetManager.js'; // v3.15.0: shared PNG pipeline
import BoneFragment from './BoneFragment.js';
import { createEnemy } from '../enemies/EnemyFactory.js';

// v3.14.0: Phase 2/3 humanoid line — EXPLICIT allowlist. The Bone Yard march
// is standard humanoids only; new species added to ENEMY_TYPES (e.g. the
// v3.50.0 'shuttle') must never leak into it. Extend this list deliberately
// if a future phase should march something else.
const BONE_YARD_HUMANOID_TYPES = ['human'];

// v3.15.0: pixel-art yard backdrop — the four shared PNGs that dress the
// boneyard (tools/asset-manifest.json → js/core/AssetSprites.js).
const BONEYARD_BG_KEYS = ['skeleton', 'skull', 'femur', 'profile_bone'];
// Logical height (px) each key occupies at scale 1.
const BONEYARD_BG_BASE = { skeleton: 200, skull: 96, femur: 72, profile_bone: 52 };
const BONEYARD_BG_COUNTS = { skeleton: 4, skull: 6, femur: 6, profile_bone: 8 };

// Deterministic PRNG (mulberry32) — the yard layout is identical every run.
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
    this.phase = 0; // 1, 2, 3
    this.phaseTimer = 0;
    this.timeLeft = 0;
    this.boneSpawnTimer = 0;
    this.humanSpawnTimer = 0;
    this.humanX = 0; // fixed X for the single-file line
    this.humanCount = 0;
    this.bg = []; // v3.15.0: seeded pixel-art backdrop instances
  }

  start() {
    this.active = true;
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
    // v3.15.0: seed the pixel-art yard backdrop for this run.
    this._buildBackground();
    // Phase 1 banner
    bus.emit('banner', {
      text: "It just keeps going and and going... I'll never make it to Eridaths Mom's house.",
      tone: 'bad',
      duration: 3.5,
    });
    audio.banner();
  }

  update(dt) {
    if (!this.active) return;
    this.phaseTimer += dt;
    this.timeLeft -= dt;
    // v3.15.0: slow parallax drift of the yard backdrop (wrap at the edges).
    for (const b of this.bg) {
      b.y += b.drift * dt;
      if (b.y - 240 > this.game.viewH) b.y = -240;
    }

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
      // Return to normal gameplay
      this.game.state = 'playing';
      this.game.waveManager.startNext();
    }
  }

  // v3.15.0 — seed the yard layout: skeletons hugging the left/right
  // margins, skulls / femurs / profile bones scattered across the yard.
  // Seeded (mulberry32, 0xB0NE) so the placement is stable, aspect-
  // preserving, and identical every run.
  _buildBackground() {
    const rng = mulberry32(20261001); // v3.54.0 release date — stable yard layout
    const W = this.game.viewW;
    const H = this.game.viewH;
    const bg = [];
    for (const key of BONEYARD_BG_KEYS) {
      for (let i = 0; i < BONEYARD_BG_COUNTS[key]; i++) {
        let x;
        if (key === 'skeleton') {
          // Standing sentinels on the left/right margins
          const left = rng() < 0.5;
          x = left ? 40 + rng() * W * 0.1 : W - 40 - rng() * W * 0.1;
        } else {
          x = 30 + rng() * (W - 60);
        }
        const scale = key === 'skeleton' ? 0.85 + rng() * 0.4 : 0.7 + rng() * 0.6;
        bg.push({
          key,
          x,
          y: rng() * H,
          scale,
          base: BONEYARD_BG_BASE[key],
          // Skeletons stand nearly upright; loose bones tumble at any angle.
          rotation: key === 'skeleton' ? (rng() - 0.5) * 0.24 : rng() * TAU,
          drift: 6 + rng() * 12,
          alpha: 0.3 + rng() * 0.25,
        });
      }
    }
    this.bg = bg;
  }

  // v3.15.0 — render the pixel-art yard backdrop (called from
  // BonusLevel.draw → Game.render, under the bonus targets).
  draw(ctx) {
    if (!this.active || !this.bg.length) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const b of this.bg) {
      const dims = getDims(b.key);
      const h = b.base * b.scale;
      const w = dims ? (h * dims.w) / dims.h : h; // aspect-preserving
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rotation);
      ctx.globalAlpha = b.alpha;
      const sprite = getSprite(b.key);
      if (sprite) {
        ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
      } else {
        this._drawProceduralBg(ctx, b, w, h);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // v3.15.0 — procedural yard backdrop, kept as the null-sprite fallback
  // per the AssetManager contract (headless / pre-load frames).
  _drawProceduralBg(ctx, b, w, h) {
    ctx.strokeStyle = 'rgba(232, 220, 200, 0.9)';
    ctx.lineWidth = Math.max(1.5, h * 0.03);
    if (b.key === 'skeleton') {
      // Stick skeleton: skull, spine, ribcage, limbs
      ctx.beginPath(); ctx.arc(0, -h * 0.38, h * 0.09, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -h * 0.29); ctx.lineTo(0, h * 0.12); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const ry = -h * 0.24 + i * h * 0.07;
        ctx.beginPath(); ctx.ellipse(0, ry, h * 0.12, h * 0.035, 0, 0, TAU); ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-h * 0.14, -h * 0.22); ctx.lineTo(0, -h * 0.18); ctx.lineTo(h * 0.14, -h * 0.22);
      ctx.moveTo(0, h * 0.12); ctx.lineTo(-h * 0.1, h * 0.38);
      ctx.moveTo(0, h * 0.12); ctx.lineTo(h * 0.1, h * 0.38);
      ctx.stroke();
    } else if (b.key === 'skull') {
      // Cranium + jaw + eye sockets
      ctx.beginPath(); ctx.ellipse(0, -h * 0.06, h * 0.2, h * 0.24, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.rect(-h * 0.11, h * 0.14, h * 0.22, h * 0.11); ctx.stroke();
      ctx.beginPath(); ctx.arc(-h * 0.08, -h * 0.08, h * 0.055, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(h * 0.08, -h * 0.08, h * 0.055, 0, TAU); ctx.stroke();
    } else {
      // femur / profile_bone: classic bone — shaft + four knobs
      const sh = w * 0.66;
      const kw = Math.min(w * 0.18, h * 0.5);
      ctx.beginPath();
      ctx.moveTo(-sh / 2, -kw / 2); ctx.lineTo(sh / 2, -kw / 2);
      ctx.lineTo(sh / 2, kw / 2); ctx.lineTo(-sh / 2, kw / 2);
      ctx.closePath(); ctx.stroke();
      for (const sx of [-1, 1]) {
        ctx.beginPath(); ctx.arc(sx * sh / 2, -kw * 0.75, kw * 0.65, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(sx * sh / 2, kw * 0.75, kw * 0.65, 0, TAU); ctx.stroke();
      }
    }
  }
}

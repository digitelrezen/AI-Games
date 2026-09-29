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
export const VERSION = 'v3.13.0';
import { BONUS } from '../core/config.js';
import { rand } from '../core/utils.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';
import BoneFragment from './BoneFragment.js';
import { createEnemy } from '../enemies/EnemyFactory.js';

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
        const human = createEnemy({
          type: 'human',
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
}

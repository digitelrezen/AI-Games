// Filename: HumanEnemy.js
// Kitty Vs Everything — v3.13.0
// Human enemy: a REAL PERSON (HumanSprite.js) — replaces the old
// "Human Ship" placeholder art.
//   • Normal waves: descends into a hover band, strafes left/right, and
//     fires telegraphed aimed rifle shots (a brief red sight ring before
//     each shot, so the player can read the aim).
//   • Bone Yard bonus: marchMode = true → straight-down single-file march
//     at 0.7× speed (original Bone Yard behavior), walk cycle animating.
// Created through EnemyFactory.createEnemy(); bonuses may set marchMode /
// fireRate after creation.
export const VERSION = 'v3.13.0';
import EnemyBase from './EnemyBase.js';
import { TAU, rand, clamp } from '../core/utils.js';
import { randomOutfit, drawHuman } from '../core/HumanSprite.js';

export default class HumanEnemy extends EnemyBase {
  constructor(opts) {
    super(opts);
    // One random outfit per spawn (shirt / hair / skin / hair style).
    this.outfit = randomOutfit();
    // Bone Yard: straight-down single-file march (no strafing).
    this.marchMode = false;
    // Wave behavior: descend to a hover band, then strafe left/right.
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.hoverY = 90 + rand(0, 120);
    // Telegraph: seconds of visible "aiming" before the rifle fires.
    this.telegraph = 0;
  }

  move(dt, slowMul) {
    const s = this.speed * slowMul;

    // Telegraphed aimed rifle fire (v3.13.0): attack() arms the aim,
    // this counts it down and fires the shot. Stunned humans (slowMul = 0)
    // hold their aim without firing.
    if (this.telegraph > 0 && slowMul > 0) {
      this.telegraph -= dt;
      if (this.telegraph <= 0) this.fireAtPlayer(this.angleToPlayer(), 320, 1);
    }

    if (this.marchMode) {
      // Bone Yard: march straight down (original behavior, 0.7× speed).
      this.y += s * dt * 0.7;
      return;
    }
    // Normal waves: descend into the hover band, then strafe.
    if (this.y < this.hoverY) {
      this.y += s * dt * 0.5;
    } else {
      this.x += s * dt * 0.8 * this.strafeDir;
      const edge = 20 + this.radius;
      if (this.x < edge) this.strafeDir = 1;
      if (this.x > this.game.W - edge) this.strafeDir = -1;
    }
    this.x = clamp(this.x, -50, this.game.W + 50);
  }

  attack() {
    // Telegraph the aim — the actual shot fires in move() once the
    // telegraph expires.
    this.telegraph = 0.35;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    drawHuman(ctx, {
      r: this.radius,
      outfit: this.outfit,
      walkPhase: this.marchMode ? this.t * 6 : 0,
      flash: this.flash,
      aim: this.telegraph > 0 ? this.angleToPlayer() : Math.PI / 2,
    });
    // Telegraph: small red sight ring on the aim line.
    if (this.telegraph > 0) {
      const a = this.angleToPlayer();
      const d = this.radius + 8;
      ctx.strokeStyle = 'rgba(255, 82, 82, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 4, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    this.drawShieldRing(ctx);
    this.drawBossBar(ctx);
  }
}

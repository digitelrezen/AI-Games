// Filename: BonusLevel.js
// Kitty Vs Everything — v2.2.0
// Bonus stage dispatcher: randomly selects between "The Bone Yard" and
// "The Internet Classic" custom bonus rounds.
// v2.2.0 (v3.54.0 release): draw(ctx) hook — delegates to the active
// bonus stage so Game.render can paint its backdrop (the Bone Yard
// pixel-art yard) under the bonus targets. Bonuses without a draw()
// (InternetBonus) are skipped via a typeof guard.
export const VERSION = 'v2.2.0';
import { BONUS } from '../core/config.js';
import { bus } from '../core/EventBus.js';
import BoneYardBonus from './BoneYardBonus.js';
import InternetBonus from './InternetBonus.js';

export default class BonusLevel {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.currentBonus = null;
    this.boneYard = new BoneYardBonus(game);
    this.internet = new InternetBonus(game);
  }

  /** Start a randomly selected bonus stage. */
  start() {
    this.active = true;
    // Randomly pick between the two custom bonuses
    const roll = Math.random();
    if (roll < 0.5) {
      this.currentBonus = this.boneYard;
    } else {
      this.currentBonus = this.internet;
    }
    this.currentBonus.start();
  }

  /** Force-start a specific bonus (for dev panel testing). */
  startSpecific(type) {
    this.active = true;
    if (type === 'boneyard') {
      this.currentBonus = this.boneYard;
    } else {
      this.currentBonus = this.internet;
    }
    this.currentBonus.start();
  }

  update(dt) {
    if (!this.active || !this.currentBonus) return;
    this.currentBonus.update(dt);
  }

  // v2.2.0: paint the active bonus stage's backdrop (called from
  // Game.render before the bonus targets). No-op when inactive or when
  // the stage has no draw() (InternetBonus).
  draw(ctx) {
    if (!this.active || !this.currentBonus || typeof this.currentBonus.draw !== 'function') return;
    this.currentBonus.draw(ctx);
  }
}
// Filename: BonusLevel.js
// Kitty Vs Everything — v3.76.0
// v3.76.0 (LevelRegistry refactor): the bonus dispatcher is now a THIN
//          adapter. The LevelRegistry (js/levels/LevelRegistry.js) owns the
//          bonus stage instances (BoneYardBonus / InternetBonus) and the
//          run's stage manifest; Game.advanceStage() hands the active stage
//          to setStage() and this class only forwards update()/draw() to it.
//          Bonus stages implement the uniform interface: init() / update(dt)
//          / isComplete() / cleanup().
// v2.2.0 (v3.54.0 release): draw(ctx) hook — delegates to the active
// bonus stage so Game.render can paint its backdrop (the Bone Yard
// pixel-art yard) under the bonus targets. Bonuses without a draw()
// (InternetBonus) are skipped via a typeof guard.
export const VERSION = 'v3.76.0';

export default class BonusLevel {
  constructor(game) {
    this.game = game;
    // v3.76.0: registry-owned stage instance (BoneYardBonus / InternetBonus)
    this.currentBonus = null;
  }

  get active() {
    return !!this.currentBonus && this.currentBonus.active;
  }

  /** v3.76.0: Game.advanceStage() sets the active bonus stage (or null). */
  setStage(stage) {
    this.currentBonus = stage;
  }

  update(dt) {
    if (this.currentBonus) this.currentBonus.update(dt);
  }

  // v2.2.0: paint the active bonus stage's backdrop (called from
  // Game.render before the bonus targets). No-op when inactive or when
  // the stage has no draw() (InternetBonus).
  draw(ctx) {
    if (!this.currentBonus || typeof this.currentBonus.draw !== 'function') return;
    this.currentBonus.draw(ctx);
  }
}
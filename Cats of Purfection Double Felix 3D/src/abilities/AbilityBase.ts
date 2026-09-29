import { Scene } from '@babylonjs/core';

/**
 * Base class for special cat abilities (GM super-cat powers).
 * Planned abilities (step 3+):
 *  - CatPounce: short-range dash with damage
 *  - ClawDash: melee swipe arc
 *  - NightVision: see in the dark / through smoke
 *  - FelineAgility: temporary speed + jump boost
 *  - LifeSteal: convert a lost life into a burst (9-lives synergy)
 */
export abstract class AbilityBase {
  abstract readonly name: string;
  protected scene: Scene;
  protected cooldown = 0;
  protected maxCooldown: number;

  constructor(scene: Scene, maxCooldown: number) {
    this.scene = scene;
    this.maxCooldown = maxCooldown;
  }

  get isReady(): boolean {
    return this.cooldown <= 0;
  }

  /** Activate the ability. Returns true if it activated. */
  abstract activate(): boolean;

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  protected startCooldown(): void {
    this.cooldown = this.maxCooldown;
  }
}

import { Scene, Vector3 } from '@babylonjs/core';
import { EntityBase } from '../EntityBase';

/**
 * Modular enemy base class.
 * Concrete enemies (step 2+) extend this and implement die().
 * Health, position and a simple damage pipeline are provided here.
 */
export abstract class EnemyBase extends EntityBase {
  abstract readonly name: string;
  health: number;
  maxHealth: number;
  protected onDeath?: (enemy: EnemyBase) => void;

  constructor(scene: Scene, name: string, health: number) {
    super(scene, name);
    this.health = health;
    this.maxHealth = health;
  }

  get position(): Vector3 {
    return this.root.position;
  }

  get isDead(): boolean {
    return this.health <= 0;
  }

  takeDamage(amount: number): void {
    if (this.isDead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.die();
    }
  }

  /** Called once when health reaches 0. Subclasses drop loot / spawn gore here. */
  protected abstract die(): void;

  setOnDeath(handler: (enemy: EnemyBase) => void): void {
    this.onDeath = handler;
  }

  protected notifyDeath(): void {
    this.onDeath?.(this);
  }
}

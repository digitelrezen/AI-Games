import { Camera, Scene, TransformNode, Vector3 } from '@babylonjs/core';
import { EventBus } from '../events/EventBus';

/**
 * Weapon base class: viewmodel root + fire-rate/cooldown + firing hook.
 * Concrete weapons build their viewmodel (procedural or GLTF) and implement
 * fire() (raycast, projectiles, spread, gore hooks...).
 */
export abstract class WeaponBase {
  readonly name: string;
  protected scene: Scene;
  protected eventBus: EventBus;
  protected root: TransformNode;
  protected cooldown = 0;
  protected fireRate: number; // shots per second
  protected damage: number;

  constructor(scene: Scene, eventBus: EventBus, name: string, fireRate: number, damage: number) {
    this.scene = scene;
    this.eventBus = eventBus;
    this.name = name;
    this.fireRate = fireRate;
    this.damage = damage;
    this.root = new TransformNode(`weapon_${name}`, scene);
  }

  /** Build the viewmodel meshes under this.root. */
  abstract buildViewModel(): void;

  /** Parent the viewmodel to the player camera. */
  attachToCamera(camera: Camera): void {
    this.root.parent = camera;
  }

  get canFire(): boolean {
    return this.cooldown <= 0;
  }

  get currentDamage(): number {
    return this.damage;
  }

  /** Fire from `origin` along `direction`. Returns true if a shot was made. */
  abstract fire(origin: Vector3, direction: Vector3): boolean;

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  dispose(): void {
    this.root.dispose();
  }
}

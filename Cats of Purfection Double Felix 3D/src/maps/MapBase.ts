import { Scene, Vector3 } from '@babylonjs/core';

/** Axis-aligned bounding box used for arcade-style player collision. */
export interface ColliderBox {
  center: Vector3;
  half: Vector3;
}

/**
 * Base class for all maps/levels.
 * A map builds its visuals (ground, walls, props, lighting) and registers
 * collider boxes that the player (and later enemies) collide against.
 */
export abstract class MapBase {
  protected scene: Scene;
  readonly name: string;
  protected colliders: ColliderBox[] = [];

  constructor(scene: Scene, name: string) {
    this.scene = scene;
    this.name = name;
  }

  /** Build all visuals + colliders. Called once at map load. */
  abstract build(): void;

  getColliders(): ColliderBox[] {
    return this.colliders;
  }

  protected addBoxCollider(center: Vector3, half: Vector3): void {
    this.colliders.push({ center: center.clone(), half: half.clone() });
  }
}

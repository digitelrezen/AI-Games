import { Scene, TransformNode } from '@babylonjs/core';

/**
 * Base class for all world entities (player avatar, enemies, bosses, loot).
 * Provides a scene-attached root node and a per-frame update hook.
 */
export abstract class EntityBase {
  protected scene: Scene;
  readonly root: TransformNode;
  enabled = true;

  constructor(scene: Scene, name: string) {
    this.scene = scene;
    this.root = new TransformNode(name, scene);
  }

  abstract update(dt: number): void;

  dispose(): void {
    this.root.dispose();
  }
}

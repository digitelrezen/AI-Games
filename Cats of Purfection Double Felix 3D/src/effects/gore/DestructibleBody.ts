import { Scene, Vector3 } from '@babylonjs/core';

/**
 * Destructible body scaffold (explicit gore design).
 *
 * Plan (architecture.md §7):
 *  - Enemy bodies are composed of a torso + limb segments.
 *  - On lethal damage the body enters ragdoll mode (physics bodies),
 *    segments detach, organ chunks spawn, and a blood pool forms.
 *  - Bosses have multi-stage destruction (phase-gated part removal).
 *
 * Step 1: interface only — no physics integration yet.
 */
export interface DestructibleBodyConfig {
  /** Total damage before the body becomes destructible. */
  destructibleAt: number;
  /** Number of detachable segments. */
  segmentCount: number;
  /** Whether the body ragdolls on death. */
  ragdoll: boolean;
}

export class DestructibleBody {
  readonly config: DestructibleBodyConfig;
  private scene: Scene;
  private destroyed = false;

  constructor(scene: Scene, config: DestructibleBodyConfig) {
    this.scene = scene;
    this.config = config;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /** Apply damage; triggers destruction at the configured threshold. */
  damage(amount: number, point: Vector3): boolean {
    if (this.destroyed) return false;
    // TODO(step 3): track per-segment damage, detach segments, spawn gore
    console.debug(`[DestructibleBody] damage ${amount} at ${point.x.toFixed(1)},${point.y.toFixed(1)},${point.z.toFixed(1)}`);
    return false;
  }

  destroy(point: Vector3): void {
    if (this.destroyed) return;
    this.destroyed = true;
    // TODO(step 3): ragdoll + chunks + gore hooks
    console.debug(`[DestructibleBody] destroyed at ${point.x.toFixed(1)},${point.y.toFixed(1)},${point.z.toFixed(1)}`);
  }
}

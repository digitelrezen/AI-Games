import { Scene, Vector3 } from '@babylonjs/core';

/**
 * Gore system manager (scaffolding for the explicit gore/blood design).
 *
 * Design map (see architecture.md §7):
 *  - BloodSpray:  particle burst on hit (directional, volume-scaled)
 *  - BloodPool:   persistent decal on surfaces (grows with damage)
 *  - GutsDecal:   splatter decal for heavy hits
 *  - DestructibleBody: ragdoll + organ chunks for enemy/boss kills
 *
 * All gore is procedural (particles + decals) — no external assets.
 * Step 1: manager exists and logs; effects land in step 2/3.
 */
export class GoreSystem {
  private scene: Scene;
  private enabled = true;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Blood burst at a hit point along the impact direction. */
  spawnBloodSpray(point: Vector3, direction: Vector3, amount = 1): void {
    if (!this.enabled) return;
    // TODO(step 2): ParticleSystem burst (red, gravity, short life)
    console.debug(`[Gore] bloodSpray at ${point.x.toFixed(1)},${point.y.toFixed(1)},${point.z.toFixed(1)} x${amount}`);
  }

  /** Persistent pool on the surface below the point. */
  spawnBloodPool(point: Vector3, radius = 0.5): void {
    if (!this.enabled) return;
    // TODO(step 2): decal mesh (dark red, alpha, grows with radius)
    console.debug(`[Gore] bloodPool at ${point.x.toFixed(1)},${point.z.toFixed(1)} r=${radius}`);
  }

  /** Heavy-hit splatter. */
  spawnGuts(point: Vector3): void {
    if (!this.enabled) return;
    // TODO(step 3): chunk particles + splatter decal
    console.debug(`[Gore] guts at ${point.x.toFixed(1)},${point.y.toFixed(1)},${point.z.toFixed(1)}`);
  }

  update(_dt: number): void {
    // TODO(step 2): pool growth/decay, particle cleanup
  }
}

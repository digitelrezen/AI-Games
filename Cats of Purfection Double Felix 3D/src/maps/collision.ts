import { Vector3 } from '@babylonjs/core';
import { ColliderBox } from './MapBase';

/**
 * Arcade point-vs-AABB collision resolution.
 * The player is treated as a point (at eye height) with a radius; when it
 * penetrates an expanded collider box it is pushed out along the axis of
 * least penetration.
 *
 * TODO(step 2): replace with proper capsule-vs-AABB for standing on top of
 * crates without a small floating gap.
 */
export function resolveCollision(pos: Vector3, colliders: ColliderBox[], radius = 0.45): Vector3 {
  for (const c of colliders) {
    const minX = c.center.x - c.half.x - radius;
    const maxX = c.center.x + c.half.x + radius;
    const minY = c.center.y - c.half.y - radius;
    const maxY = c.center.y + c.half.y + radius;
    const minZ = c.center.z - c.half.z - radius;
    const maxZ = c.center.z + c.half.z + radius;

    if (pos.x <= minX || pos.x >= maxX || pos.y <= minY || pos.y >= maxY || pos.z <= minZ || pos.z >= maxZ) {
      continue;
    }

    const dxMin = pos.x - minX;
    const dxMax = maxX - pos.x;
    const dyMin = pos.y - minY;
    const dyMax = maxY - pos.y;
    const dzMin = pos.z - minZ;
    const dzMax = maxZ - pos.z;
    const m = Math.min(dxMin, dxMax, dyMin, dyMax, dzMin, dzMax);

    if (m === dxMin) pos.x = minX;
    else if (m === dxMax) pos.x = maxX;
    else if (m === dyMin) pos.y = minY;
    else if (m === dyMax) pos.y = maxY;
    else if (m === dzMin) pos.z = minZ;
    else pos.z = maxZ;
  }
  return pos;
}

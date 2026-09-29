// Filename: Homing.js
// Kitty Vs Everything — v3.3.0
// Homing (full) + Tracking (mild, for Vulkan) steering for friendly
// bullets. v3.3.0: Extracted from Game.js (module split of oversized files).
export const VERSION = 'v3.3.0';
import { dist2, angleTo, TAU } from '../core/utils.js';

export function updateHoming(game, dt) {
  for (const b of game.bullets) {
    if (!b.friendly) continue;
    if (!b.homing && !b.tracking) continue;
    let best = null, bd = Infinity;
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const d = dist2(b.x, b.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      const a = angleTo(b.x, b.y, best.x, best.y);
      const sp = Math.hypot(b.vx, b.vy) || 500;
      if (b.homing) {
        b.vx = Math.cos(a) * sp;
        b.vy = Math.sin(a) * sp;
      } else if (b.tracking > 0) {
        const currentA = Math.atan2(b.vy, b.vx);
        let diff = a - currentA;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        const turnRate = b.tracking * 4 * dt;
        const correction = Math.max(-turnRate, Math.min(turnRate, diff));
        const newA = currentA + correction;
        b.vx = Math.cos(newA) * sp;
        b.vy = Math.sin(newA) * sp;
      }
    }
  }
}

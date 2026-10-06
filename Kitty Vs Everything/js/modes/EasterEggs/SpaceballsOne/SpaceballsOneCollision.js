// Filename: SpaceballsOneCollision.js
// Kitty Vs Everything — v3.83.0
// Unstoppable sweep for Spaceballs One. "We brake for nobody!"
//
// The ship's bounding box is sampled along this frame's movement segment
// (gap-capped at SAMPLE_GAP px so a fast ship can never tunnel an entity
// between samples). Anything intersecting the path is obliterated:
//   • enemies             → onEnemyDeath (full death path: score + drops)
//   • asteroids           → game.destroyAsteroid (shatter chain + score)
//   • score crates        → game.destroyCrate (score + drop + banner)
//   • hostile projectiles → atomized (alive = false + spark)
//   • friendly projectiles → atomized too — it doesn't brake for the player
// Regular power-up pills are left alone (they're loot, not obstacles).
// Entity lists are snapshotted before the pass so fragments/drops spawned
// by a destruction are not re-swept in the same frame.
// v3.83.0: OFF-SCREEN KILL GATE — the sweep skips enemies that are fully
// off-screen (same utils.isOnScreen gate as EnemyBase.applyDamage), so a
// swept kill can never happen where the player can't see it.

import { onEnemyDeath } from '../../../combat/Combat.js';
import { isOnScreen } from '../../../core/utils.js'; // v3.83.0

const SAMPLE_GAP = 24; // px — max distance between sweep samples (no tunneling)

function boxHitsCircle(bx, by, hw, hh, cx, cy, r) {
  return Math.abs(cx - bx) <= hw + r && Math.abs(cy - by) <= hh + r;
}

/**
 * Sweep the ship's bounding box (half-extents hw/hh) from (x0,y0) to
 * (x1,y1) and obliterate everything in the path.
 * @returns {number} count of entities destroyed / atomized this frame
 */
export function sweepPath(game, x0, y0, x1, y1, hw, hh) {
  let swept = 0;
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(dist / SAMPLE_GAP));
  for (let s = 0; s <= n; s++) {
    const k = s / n;
    const bx = x0 + (x1 - x0) * k;
    const by = y0 + (y1 - y0) * k;

    // ── enemies: obliterated (full death path — score + drops + FX) ──
    for (const e of game.enemies.slice()) {
      if (!e.alive) continue;
      // v3.83.0: off-screen enemies are invulnerable — the sweep only
      // kills what the player can see (same gate as EnemyBase).
      if (!isOnScreen(game, e.x, e.y, e.radius)) continue;
      if (boxHitsCircle(bx, by, hw, hh, e.x, e.y, e.radius)) {
        e.alive = false;
        onEnemyDeath(game, e, null);
        swept++;
      }
    }

    // ── powerups: asteroids shatter, crates break open, pills survive ──
    for (const p of game.powerups.slice()) {
      if (!p.alive) continue;
      if (!boxHitsCircle(bx, by, hw, hh, p.x, p.y, p.radius)) continue;
      if (p.isAsteroid) {
        game.destroyAsteroid(p); // shatter chain (fragments next frame)
        swept++;
      } else if (p.destructible && p.type === 'crate') {
        game.destroyCrate(p); // score + drop + banner
        swept++;
      }
    }

    // ── projectiles: atomized — hostile AND friendly (no brakes) ──
    for (const b of game.bullets.slice()) {
      if (!b.alive) continue;
      if (boxHitsCircle(bx, by, hw, hh, b.x, b.y, b.radius)) {
        b.alive = false;
        game.particles.burst(b.x, b.y, { count: 4, color: '#ff4dd8', speed: 120, life: 0.25 });
        swept++;
      }
    }
  }
  return swept;
}

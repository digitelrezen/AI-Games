// Filename: hazards/HazardFactory.js
// Kitty Vs Everything — v1.0.0 (v3.97.0 Hazards)
// Hazard creation + spawn-vector selection. Mirrors EnemyFactory's role for
// the hazard family: the spawner (HazardManager) and the dev panel go
// through createHazard() — no direct HazardBase import elsewhere.
//
// pickSpawnVector() is the "enter from ANY direction" rule: it picks a
// random edge (top / right / bottom / left), a random point along that
// edge fully off-screen (HAZARD.EDGE_MARGIN past the border), and a random
// target inside the playfield — the resulting heading always crosses the
// screen, straight or diagonal.
export const VERSION = 'v1.0.0';
import HazardBase from './HazardBase.js';
import { HAZARD, rollHazardType } from '../core/config.js';
import { rand, randInt, angleTo } from '../core/utils.js';

/**
 * Create a hazard.
 * @param {object} o { type, x, y, angle, speed, game }
 * @returns {HazardBase}
 */
export function createHazard({ type, x, y, angle, speed, game }) {
  return new HazardBase({ type, x, y, angle, speed, game });
}

/**
 * Random spawn vector for the hazard field.
 * @param {object} game
 * @param {string} [type] hazard type (defaults to a weighted roll)
 * @returns {{ type: string, x: number, y: number, angle: number }}
 */
export function pickSpawnVector(game, type) {
  const t = type || rollHazardType();
  const m = HAZARD.EDGE_MARGIN;
  const W = game.viewW || game.W;
  const H = game.viewH || game.H;
  const edge = randInt(0, 3); // 0 top, 1 right, 2 bottom, 3 left
  let x, y;
  if (edge === 0)      { x = rand(m, W - m); y = -m; }
  else if (edge === 1) { x = W + m; y = rand(m, H - m); }
  else if (edge === 2) { x = rand(m, W - m); y = H + m; }
  else                 { x = -m; y = rand(m, H - m); }
  // Aim at a random interior point so the heading always crosses the field.
  const tx = rand(W * 0.15, W * 0.85);
  const ty = rand(H * 0.15, H * 0.85);
  return { type: t, x, y, angle: angleTo(x, y, tx, ty) };
}
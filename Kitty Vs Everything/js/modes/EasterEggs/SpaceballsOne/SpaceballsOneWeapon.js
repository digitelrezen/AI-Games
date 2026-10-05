// Filename: SpaceballsOneWeapon.js
// Kitty Vs Everything — v3.81.0
// Spaceballs One's weapon: a continuous "brake-light" bolt stream aimed at
// the player. Three-way spread volleys every cfg.fireInterval seconds from
// the nose, routed through game.spawnEnemyBullet (the standard hostile
// bullet path — Collisions.js handles the player hits).

import { angleTo } from '../../../core/utils.js';

/** Nose hardpoint: half the on-screen art width ahead of the ship center. */
export function spaceballsNosePos(ship, w) {
  return {
    x: ship.x + Math.cos(ship.heading) * w * 0.4,
    y: ship.y + Math.sin(ship.heading) * w * 0.4,
  };
}

/**
 * Tick the stream. `ship` must expose x, y, heading, fireTimer, game.
 * @returns {number} bullets fired this frame (0 or cfg.bulletsPerVolley)
 */
export function updateSpaceballsWeapon(ship, dt, cfg) {
  const g = ship.game;
  const p = g.player;
  if (!p || p.hp <= 0) return 0; // no live target — hold fire
  ship.fireTimer -= dt;
  if (ship.fireTimer > 0) return 0;
  ship.fireTimer = cfg.fireInterval;
  const nose = spaceballsNosePos(ship, ship.w);
  const aim = angleTo(nose.x, nose.y, p.x, p.y);
  let fired = 0;
  for (let i = 0; i < cfg.bulletsPerVolley; i++) {
    const off = (i - (cfg.bulletsPerVolley - 1) / 2) * cfg.spread;
    g.spawnEnemyBullet(nose.x, nose.y, aim + off, cfg.bulletSpeed, cfg.bulletDamage, cfg.bulletColor);
    fired++;
  }
  return fired;
}

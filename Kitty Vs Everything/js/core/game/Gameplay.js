// Filename: game/Gameplay.js
// Kitty Vs Everything — v3.77.0
// E6 modularization (v3.77.0): per-frame combat housekeeping extracted
// from Game.js — player damage, score-bonus lives, end-of-frame cleanup,
// enemy bullet spawn, asteroid breakage. Game.js keeps thin delegate
// methods (Collisions / EnemyBase / bosses still call game.spawnEnemyBullet
// & co. — the public surface is unchanged).

import Bullet from '../../combat/Bullet.js';
import { destroyAsteroid as breakAsteroid } from '../../levels/AsteroidBonus.js'; // v3.11.0

export function hitPlayer(game, dmg, player = game.player) {
  if (game.godMode) return;
  if (player) player.hit(dmg);
}

/** v3.11.0: destructible asteroid chain power-up (AsteroidBonus.js). */
export function destroyAsteroid(game, a) { breakAsteroid(game, a); }

export function cleanup(game) {
  game.enemies = game.enemies.filter(e => e.alive);
  game.bullets = game.bullets.filter(b => b.alive);
  game.powerups = game.powerups.filter(p => p.alive);
  game.bonusTargets = game.bonusTargets.filter(bt => bt.alive);
  game.fireZones = game.fireZones.filter(z => z.alive); // v3.11.0
}

export function spawnEnemyBullet(game, x, y, angle, speed, damage, color) {
  game.bullets.push(new Bullet({
    x, y,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    damage, color, friendly: false, life: 6, radius: 6,
  }));
}

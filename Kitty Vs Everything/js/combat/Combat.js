// Filename: Combat.js
// Kitty Vs Everything — v3.1.0
// Weapon hit resolution: direct damage, shield-melt (plasma), death handling,
// scoring, and drops. No legacy elemental secondary effects.
// v3.1.0: Replaced applyElementalHit with applyWeaponHit. Removed aoeBlast,
// chainLightning, ice-shatter, burn DoT, armor-melt.
// v3.29.0: onEnemyDeath routes friendly kills to the Bender easter egg
// (game.aimbot.onEnemyKilled — kill-based dialogue, EasterEgg.js).
export const VERSION = 'v3.1.0';
import { WEAPONS } from '../core/config.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';
import PowerUp from './PowerUp.js';
import { spawnAsteroid } from '../levels/AsteroidBonus.js'; // v3.11.0: asteroid chain drops

/**
 * Resolve a friendly bullet hitting an enemy.
 * @param {Game} game
 * @param {EnemyBase} enemy
 * @param {Bullet} bullet
 */
export function applyWeaponHit(game, enemy, bullet) {
  // Non-damaging projectiles (stun rockets, etc.)
  if (bullet.damage <= 0) {
    bullet.alive = false;
    return;
  }
  const w = WEAPONS[bullet.weapon] || { color: '#ffd54f', name: 'IMPACT' };
  const dmg = bullet.damage;
  enemy.flash = 0.15;

  // Shield-melt (Plasma Pulse)
  if (bullet.shieldMelt > 0 && enemy.shield > 0) {
    const melt = Math.min(enemy.shield, bullet.shieldMelt);
    enemy.shield -= melt;
    game.particles.burst(enemy.x, enemy.y, { count: 4, color: '#00e5ff', speed: 100, life: 0.3, size: 2 });
  }

  enemy.applyDamage(dmg);
  bus.emit('dmg', { x: enemy.x, y: enemy.y - enemy.radius, text: String(Math.round(dmg)), color: w.color });

  if (!enemy.alive) {
    onEnemyDeath(game, enemy, bullet.owner); // v3.20.0: credit the firing player
  } else {
    audio.hit();
  }
}

/**
 * Handle enemy death: particles, scoring, drops.
 * @param {Game} game
 * @param {EnemyBase} enemy
 * @param {Player|null} [owner] v3.20.0: the player who dealt the killing blow
 */
export function onEnemyDeath(game, enemy, owner) {
  game.particles.burst(enemy.x, enemy.y, { count: 16 + enemy.radius, color: enemy.color, speed: 220, life: 0.7 });
  audio.explosion();
  game.shake = Math.max(game.shake, enemy.special ? 10 : 3);
  // v3.29.0: Bender easter egg — friendly kills advance the kill-based dialogue
  game.aimbot?.onEnemyKilled?.(enemy, owner);

  // Scoring with multiplier (v3.20.0: also credit the killing player's score)
  const pts = Math.round(enemy.score * game.multiplier);
  game.score += pts;
  if (owner && owner.score !== undefined) owner.score += pts;
  bus.emit('dmg', { x: enemy.x, y: enemy.y, text: '+' + pts, color: '#ffd54f' });
  maybeDrop(game, enemy);
}

function maybeDrop(game, enemy) {
  const chance = enemy.special ? 0.5 : 0.08;
  if (Math.random() > chance) return;
  const roll = Math.random();
  let type = 'crate';
  if (roll < 0.02) type = 'robot';
  else if (roll < 0.10) type = 'mini';
  else if (roll < 0.20) type = 'life';
  else if (roll < 0.35) type = 'shield';
  else if (roll < 0.45) type = 'asteroid'; // v3.11.0: 10% → destructible chain
  if (type === 'asteroid') { spawnAsteroid(game, enemy.x, enemy.y); return; }
  game.powerups.push(new PowerUp({ x: enemy.x, y: enemy.y, type, game }));
}
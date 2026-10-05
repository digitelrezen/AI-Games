// Filename: Combat.js
// Kitty Vs Everything — v3.42.0
// Weapon hit resolution: direct damage, shield-melt (plasma), death handling,
// scoring, and drops. No legacy elemental secondary effects.
// v3.1.0: Replaced applyElementalHit with applyWeaponHit. Removed aoeBlast,
// chainLightning, ice-shatter, burn DoT, armor-melt.
// v3.29.0: onEnemyDeath routes friendly kills to the Bender easter egg
// (game.aimbot.onEnemyKilled — kill-based dialogue, EasterEgg.js).
// v3.42.0: enemy kills drop from the shared POWERUP_DROPS pool (config.js)
//          — Health / Frenzy / Shields / Wanted (mini) / Extra Life. The
//          on-screen asteroid drop at the kill point is gone: asteroids
//          now spawn fully off-screen from the wave spawner only.
// v3.77.0: SHUTTLE WAVE EVENT — a destroyed Space Shuttle (enemy.type ===
//          'shuttle') releases a GUARANTEED mini-ship power-up at the kill
//          point (SHUTTLE_DROP in config.js), bypassing the shared pool roll
//          for this species only. All other enemies keep the weighted
//          POWERUP_DROPS table (v3.42.0 behavior unchanged).
// v3.80.0: DROP RARITY — the kill drop chance moved from hardcoded values to
//          DROP_RARITY in config.js (enemy 8% / special 50%); the pool roll
//          is the new v3.80.0 rarity ladder (robot SUPER RARE, 1%).
export const VERSION = 'v3.80.0';
import { WEAPONS, DROP_RARITY, rollPowerUpDrop, SHUTTLE_DROP } from '../core/config.js'; // v3.42.0: shared drop pool
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';
import PowerUp from './PowerUp.js';

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
  // v3.77.0: SHUTTLE WAVE EVENT — every destroyed Space Shuttle releases its
  // "Wanted" poster: a guaranteed mini-ship power-up at the kill point,
  // bypassing the shared pool roll for this species only.
  if (enemy.type === 'shuttle') {
    game.powerups.push(new PowerUp({ x: enemy.x, y: enemy.y, type: SHUTTLE_DROP.type, game }));
    return;
  }
  // v3.42.0: enemy kills drop from the shared POWERUP_DROPS pool (Health /
  // Frenzy / Shields / Wanted / Extra Life / robot / crate). No on-screen
  // asteroid here — asteroids spawn fully off-screen from the wave spawner.
  // v3.80.0: the kill drop chance comes from the DROP_RARITY table — 8%
  // for regular enemies, 50% for champions / minibosses / bosses.
  const chance = enemy.special ? DROP_RARITY.special : DROP_RARITY.enemy;
  if (Math.random() > chance) return;
  game.powerups.push(new PowerUp({ x: enemy.x, y: enemy.y, type: rollPowerUpDrop(), game }));
}
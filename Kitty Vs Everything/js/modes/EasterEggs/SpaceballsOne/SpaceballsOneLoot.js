// Filename: SpaceballsOneLoot.js
// Kitty Vs Everything — v3.81.0
// Treasure-chest jackpot: when Spaceballs One is destroyed it explodes into
// ONE of EVERY available power-up type — the full POWERUP_DROPS pool
// (health / frenzy / shield / mini / crate / life / robot) — ejected
// simultaneously in a ring around the kill point, plus a gold burst, a
// jackpot score bonus (× multiplier) and the banner.

import { POWERUP_DROPS } from '../../../core/config.js';
import PowerUp from '../../../combat/PowerUp.js';
import { bus } from '../../../core/EventBus.js';
import { audio } from '../../../core/AudioSystem.js';
import { TAU, rand } from '../../../core/utils.js';

/** Every power-up type the game can drop (the shared pool's keys). */
export function treasureChestTypes() {
  return Object.keys(POWERUP_DROPS);
}

/**
 * Detonate the treasure chest at (x, y).
 * @returns {PowerUp[]} the ejected drops — one of every type
 */
export function spawnTreasureChest(game, x, y, lootScore = 10000) {
  const types = treasureChestTypes();
  const drops = [];
  const R = 70; // ring radius
  types.forEach((type, i) => {
    const a = (i / types.length) * TAU - Math.PI / 2;
    const d = new PowerUp({
      x: x + Math.cos(a) * R + rand(-6, 6),
      y: y + Math.sin(a) * R * 0.6 + rand(-6, 6),
      type, game,
    });
    game.powerups.push(d);
    drops.push(d);
  });
  // Jackpot FX — gold burst, shake, score, banner.
  const pts = Math.round(lootScore * game.multiplier);
  game.score += pts;
  game.shake = Math.max(game.shake, 12);
  game.particles.burst(x, y, { count: 64, color: '#ffd54f', speed: 420, life: 1.0 });
  game.particles.burst(x, y, { count: 32, color: '#ff8a65', speed: 260, life: 0.8 });
  bus.emit('dmg', { x, y, text: '+' + pts, color: '#ffd54f' });
  bus.emit('banner', { text: 'SPACEBALLS ONE DOWN! TREASURE CHEST OPEN!', tone: 'good', duration: 3 });
  audio.explosion();
  audio.powerup();
  return drops;
}

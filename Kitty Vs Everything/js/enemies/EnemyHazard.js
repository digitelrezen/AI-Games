// Filename: EnemyHazard.js
// Kitty Vs Everything — v3.84.0
// v3.84.0: ON-DEATH HAZARDS — when a standard enemy (EnemyBase) with an
// ENEMY_TYPES[type].onDeathEffect dies, it leaves a player-facing hazard:
//   fire_pool  a lingering pool that damages the player over time
//   bomb_drop  a bomb that arms, then explodes for AoE damage
// These are PLAYER-facing damage (game.hitPlayer), distinct from FireZone
// (enemy-side). Stored on game.enemyHazards (initialized in Game.js).
// Easter Egg ships (game.eggs) never route through here.
export const VERSION = 'v3.84.0';
import { ENEMY_HAZARD } from '../core/config.js';
import { TAU, dist2 } from '../core/utils.js';

export function spawnEnemyHazard(game, x, y, effect) {
  if (!game.enemyHazards) return;
  if (effect === 'fire_pool') {
    const h = ENEMY_HAZARD.firePool;
    game.enemyHazards.push({ type: 'fire_pool', x, y, radius: h.radius, life: h.life, dps: h.dps, color: h.color, t: 0 });
  } else if (effect === 'bomb_drop') {
    const h = ENEMY_HAZARD.bombDrop;
    game.enemyHazards.push({ type: 'bomb_drop', x, y, radius: h.radius, fuse: h.fuse, damage: h.damage, color: h.color, t: 0 });
  }
}

export function updateEnemyHazards(game, dt) {
  if (!game.enemyHazards) return;
  const players = (game.players && game.players.length) ? game.players : [game.player];
  for (const hz of game.enemyHazards) {
    hz.t += dt;
    if (hz.type === 'fire_pool') {
      hz.life -= dt;
      for (const p of players) {
        if (!p || p.dead) continue;
        const r = hz.radius + p.radius;
        if (dist2(hz.x, hz.y, p.x, p.y) < r * r) game.hitPlayer(hz.dps * dt, p);
      }
    } else if (hz.type === 'bomb_drop') {
      hz.fuse -= dt;
      if (hz.fuse <= 0) {
        for (const p of players) {
          if (!p || p.dead) continue;
          const r = hz.radius + p.radius;
          if (dist2(hz.x, hz.y, p.x, p.y) < r * r) game.hitPlayer(hz.damage, p);
        }
        game.particles.burst(hz.x, hz.y, { count: 44, color: hz.color, speed: 360, life: 0.7, size: 4 });
        game.particles.burst(hz.x, hz.y, { count: 20, color: '#ffffff', speed: 180, life: 0.4, size: 3 });
        game.shake = Math.max(game.shake, 10);
        hz.dead = true;
      }
    }
  }
  game.enemyHazards = game.enemyHazards.filter(hz => !hz.dead && (hz.type !== 'fire_pool' || hz.life > 0));
}

export function drawEnemyHazards(game, ctx) {
  if (!game.enemyHazards) return;
  for (const hz of game.enemyHazards) {
    ctx.save();
    if (hz.type === 'fire_pool') {
      const fade = Math.min(1, hz.life / 1.2);
      const flicker = 0.8 + 0.2 * Math.sin(hz.t * 14);
      const r = hz.radius * (0.92 + 0.08 * flicker);
      const grd = ctx.createRadialGradient(hz.x, hz.y, r * 0.15, hz.x, hz.y, r);
      grd.addColorStop(0, `rgba(255, 214, 120, ${0.5 * fade * flicker})`);
      grd.addColorStop(0.6, `rgba(255, 112, 67, ${0.32 * fade * flicker})`);
      grd.addColorStop(1, 'rgba(255, 64, 32, 0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 152, 64, ${0.5 * fade})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, r, 0, TAU);
      ctx.stroke();
    } else if (hz.type === 'bomb_drop') {
      const blink = hz.fuse < 0.6 ? (0.5 + 0.5 * Math.sin(hz.t * 30)) : 0.25;
      ctx.strokeStyle = `rgba(255, 82, 82, ${0.15 + 0.4 * blink})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.radius, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = hz.color;
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, 10 + 3 * blink, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(hz.x - 3, hz.y - 3, 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

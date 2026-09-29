// Filename: Collisions.js
// Kitty Vs Everything — v3.3.0
// All collision detection: friendly bullets vs enemies / bonus targets /
// destructible crates, enemy fire vs the player fleet, enemy ramming,
// powerup pickup.
// v3.3.0: Extracted from Game.js (module split of oversized files) + new
//         fleet damage routing: docked mini-ships intercept enemy fire and
//         ramming BEFORE the main hull (minis first, then hull).
export const VERSION = 'v3.3.0';
import { dist2 } from '../core/utils.js';
import { applyWeaponHit, onEnemyDeath } from './Combat.js';
import { bus } from '../core/EventBus.js';

export function runCollisions(game) {
  // v3.20.0: iterate every live player ship (P1 + P2 in co-op).
  const players = (game.players && game.players.length) ? game.players : [game.player];

  // ─── FRIENDLY BULLETS → enemies / bonus targets / destructible crates ───
  for (const b of game.bullets) {
    if (!b.alive || !b.friendly) continue;
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const rr = b.radius + e.radius;
      if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
        applyWeaponHit(game, e, b);
        if (b.pierce > 0) b.pierce--;
        else b.alive = false;
        break;
      }
    }
    if (b.alive) {
      for (const bt of game.bonusTargets) {
        if (!bt.alive) continue;
        const rr = b.radius + bt.radius;
        if (dist2(b.x, b.y, bt.x, bt.y) < rr * rr) {
          bt.flash = 0.15;
          bt.applyDamage(b.damage);
          b.alive = false;
          if (!bt.alive) {
            bt.shatter(game);
            const pts = Math.round((bt.scoreValue || 500) * game.multiplier);
            game.score += pts;
            bus.emit('dmg', { x: bt.x, y: bt.y, text: '+' + pts, color: '#f5f0e0' });
          }
          break;
        }
      }
    }
    if (b.alive) {
      for (const pw of game.powerups) {
        if (!pw.alive || !pw.destructible) continue;
        const rr = b.radius + pw.radius;
        if (dist2(b.x, b.y, pw.x, pw.y) < rr * rr) {
          pw.hp -= b.damage;
          pw.flash = 0.15; // v3.11.0: hit flash (asteroids read it; crates ignore)
          b.alive = false;
          game.particles.burst(b.x, b.y, { count: 6, color: '#ffd54f', speed: 120, life: 0.3 });
          if (pw.hp <= 0) {
            if (pw.isAsteroid) game.destroyAsteroid(pw); // v3.11.0: asteroid chain
            else game.destroyCrate(pw);
          }
          break;
        }
      }
    }
  }

  // ─── ENEMY BULLETS → each player's fleet (MINIS FIRST, then main hull) ───
  for (const b of game.bullets) {
    if (!b.alive || b.friendly) continue;
    for (const p of players) {
      if (!p || p.dead) continue;
      for (const m of p.minis) {
        if (!m.alive) continue;
        const rr = b.radius + m.radius;
        if (dist2(b.x, b.y, m.x, m.y) < rr * rr) {
          b.alive = false;
          if (!game.godMode) m.applyDamage(b.damage);
          game.particles.burst(b.x, b.y, { count: 6, color: m.color, speed: 120, life: 0.25 });
          break;
        }
      }
      if (!b.alive) break;
      const rr = b.radius + p.radius;
      if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        b.alive = false;
        game.hitPlayer(b.damage, p);
        break;
      }
    }
  }

  // ─── ENEMY RAM → each player's fleet (MINIS FIRST, then main hull) ───
  for (const e of game.enemies) {
    if (!e.alive) continue;
    for (const p of players) {
      if (!p || p.dead) continue;
      let absorbed = false;
      for (const m of p.minis) {
        if (!m.alive) continue;
        const rr = e.radius + m.radius;
        if (dist2(e.x, e.y, m.x, m.y) < rr * rr) {
          e.applyDamage(60);
          if (!e.alive && !e.deathHandled) { e.deathHandled = true; onEnemyDeath(game, e); }
          if (!game.godMode) m.applyDamage(e.damage);
          absorbed = true;
          break;
        }
      }
      if (absorbed) break;
      const rr = e.radius + p.radius;
      if (dist2(e.x, e.y, p.x, p.y) < rr * rr) {
        e.applyDamage(60);
        if (!e.alive && !e.deathHandled) { e.deathHandled = true; onEnemyDeath(game, e); }
        game.hitPlayer(e.damage, p);
        break;
      }
    }
  }

  // ─── POWERUP PICKUP (nearest player) ───
  for (const pw of game.powerups) {
    if (!pw.alive || pw.destructible) continue;
    for (const p of players) {
      if (!p || p.dead) continue;
      const rr = pw.radius + p.radius + 8;
      if (dist2(pw.x, pw.y, p.x, p.y) < rr * rr) {
        pw.alive = false;
        game.collectPowerUp(pw, p);
        break;
      }
    }
  }
}

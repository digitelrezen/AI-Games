// Filename: EnemyAttackModule.js
// Kitty Vs Everything — v3.84.0
// v3.84.0: MODULAR TELEGRAPHED ATTACKS — standard enemies (EnemyBase) can
// opt into a telegraphed attack via ENEMY_TYPES[type].attackType. Each attack
// shows a warning (telegraph) before it fires so the player can dodge:
//   projectile a single aimed bolt
//   burst      a short fan of bolts
//   beam       a fast, heavy bolt (reads as a "beam")
//   charger    a rapid velocity lunge toward the player
// 'none' (the default) keeps the base shootTimer/attack() loop unchanged.
// Easter Egg ships (game.eggs / EasterEgg.js) never go through EnemyBase, so
// they are completely unaffected by this module.
export const VERSION = 'v3.84.0';
import { ENEMY_TYPES, ENEMY_ATTACK } from '../core/config.js';
import { TAU, angleTo } from '../core/utils.js';

/**
 * Initialize the telegraphed-attack state on an enemy. Called from the
 * EnemyBase constructor. Safe default: 'none' = no telegraphed attack.
 */
export function initAttackState(enemy) {
  const t = ENEMY_TYPES[enemy.type] || {};
  enemy.attackType = t.attackType || 'none';
  enemy.attackCooldown = t.attackCooldown || ENEMY_ATTACK.cooldown[enemy.attackType] || ENEMY_ATTACK.cooldown.none;
  enemy.telegraphDuration = t.telegraphDuration || ENEMY_ATTACK.telegraph[enemy.attackType] || 0;
  enemy.attackPhase = 'idle';                 // 'idle' | 'telegraph'
  enemy.attackPhaseTimer = 0;
  enemy.attackAngle = Math.PI / 2;            // locked aim angle (down by default)
  enemy.attackCooldownTimer = enemy.attackCooldown * 0.5; // first attack sooner
  enemy.charging = 0;                         // seconds of charger lunge remaining
}

/** Nearest alive player (primary player in single-player), or null. */
function aimTarget(game, x, y) {
  const players = (game.players && game.players.length) ? game.players : [game.player];
  let best = null, bestD = Infinity;
  for (const p of players) {
    if (!p || p.dead) continue;
    const dx = p.x - x, dy = p.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/**
 * Per-frame telegraphed-attack state machine. Called from EnemyBase.update()
 * (after move(), before super.update()). No-op when attackType === 'none'.
 *
 * The charger re-applies its lunge velocity here every frame while charging,
 * because the species' move() (run earlier in update()) would otherwise
 * overwrite vx/vy.
 */
export function updateAttack(enemy, dt) {
  if (enemy.attackType === 'none') return;
  const A = ENEMY_ATTACK;

  // Charger: keep the lunge going for its duration (move() ran before us).
  if (enemy.charging > 0) {
    enemy.charging -= dt;
    enemy.vx = Math.cos(enemy.attackAngle) * A.charger.speed;
    enemy.vy = Math.sin(enemy.attackAngle) * A.charger.speed;
  }

  const p = aimTarget(enemy.game, enemy.x, enemy.y);
  if (!p) return;

  if (enemy.attackPhase === 'telegraph') {
    // Track the player during the telegraph (aim stays honest but warned).
    enemy.attackAngle = angleTo(enemy.x, enemy.y, p.x, p.y);
    enemy.attackPhaseTimer -= dt;
    if (enemy.attackPhaseTimer <= 0) {
      executeAttack(enemy);
      enemy.attackPhase = 'idle';
      enemy.attackCooldownTimer = enemy.attackCooldown;
    }
    return;
  }

  // idle: count down to the next telegraph.
  enemy.attackCooldownTimer -= dt;
  if (enemy.attackCooldownTimer <= 0) {
    enemy.attackPhase = 'telegraph';
    enemy.attackPhaseTimer = enemy.telegraphDuration;
    enemy.attackAngle = angleTo(enemy.x, enemy.y, p.x, p.y);
  }
}

function executeAttack(enemy) {
  const A = ENEMY_ATTACK;
  const a = enemy.attackAngle;
  switch (enemy.attackType) {
    case 'projectile': {
      enemy.game.spawnEnemyBullet(enemy.x, enemy.y, a, A.projectile.speed, enemy.damage * A.projectile.dmgMul, enemy.color);
      break;
    }
    case 'burst': {
      const n = A.burst.count;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * A.burst.spread;
        enemy.game.spawnEnemyBullet(enemy.x, enemy.y, a + off, A.burst.speed, enemy.damage * A.burst.dmgMul, enemy.color);
      }
      break;
    }
    case 'beam': {
      enemy.game.spawnEnemyBullet(enemy.x, enemy.y, a, A.beam.speed, enemy.damage * A.beam.dmgMul, enemy.color);
      enemy.game.shake = Math.max(enemy.game.shake, 6);
      break;
    }
    case 'charger': {
      enemy.charging = A.charger.duration;
      break;
    }
  }
}

/**
 * Draw the telegraph warning (aim line / burst fan / beam / charge path + a
 * pulsing ring). Called from Game.js draw() after the enemies so it is not
 * hidden by a species' overridden draw(). No-op unless telegraphing.
 */
export function drawAttackTelegraph(enemy, ctx) {
  if (enemy.attackType === 'none' || enemy.attackPhase !== 'telegraph') return;
  const A = ENEMY_ATTACK;
  const tt = (typeof enemy.t === 'number') ? enemy.t : 0;
  const pulse = 0.5 + 0.5 * Math.sin(tt * 22);
  const warn = `rgba(255, ${Math.round(120 + 110 * pulse)}, 60, ${0.35 + 0.45 * pulse})`;
  const a = enemy.attackAngle;
  ctx.save();
  if (enemy.attackType === 'burst') {
    const n = A.burst.count;
    ctx.strokeStyle = warn;
    ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * A.burst.spread;
      ctx.beginPath();
      ctx.moveTo(enemy.x, enemy.y);
      ctx.lineTo(enemy.x + Math.cos(a + off) * A.burst.range, enemy.y + Math.sin(a + off) * A.burst.range);
      ctx.stroke();
    }
  } else {
    const len = enemy.attackType === 'beam' ? A.beam.range
      : enemy.attackType === 'charger' ? A.charger.range
      : A.projectile.range;
    ctx.strokeStyle = warn;
    ctx.lineWidth = enemy.attackType === 'beam' ? 4 : enemy.attackType === 'charger' ? 3.5 : 2.5;
    ctx.setLineDash(enemy.attackType === 'beam' ? [] : [10, 8]);
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y);
    ctx.lineTo(enemy.x + Math.cos(a) * len, enemy.y + Math.sin(a) * len);
    ctx.stroke();
  }
  // Warning ring around the enemy (grows as the attack is about to fire).
  ctx.setLineDash([]);
  ctx.strokeStyle = warn;
  ctx.lineWidth = 2;
  const frac = enemy.telegraphDuration > 0 ? enemy.attackPhaseTimer / enemy.telegraphDuration : 1;
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, enemy.radius + 8 + 5 * (1 - frac), 0, TAU);
  ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
//  [4] HEADLESS BEHAVIOR — power-up collection through the
//      REAL Game.collectPowerUp + Player (mock game shell only)
// ═══════════════════════════════════════════════════════════

import { Game, Player, check, mod } from '../infra.mjs';
const { PLAYER, WEAPONS, ASTEROID, POWERUP_DROPS, rollPowerUpDrop } = await mod('js/core/config.js');

export default async function run() {
console.log('\n[4] Power-up collection (headless)');
const { default: PowerUp } = await mod('js/combat/PowerUp.js');
const { fireNow, updateWeaponState, cycleWeapon } = await mod('js/player/PlayerWeapons.js');

const makeGame = () => ({
  viewW: 1280, viewH: 720, H: 720,
  particles: { burst() {} }, shake: 0, time: 0,
  bullets: [], score: 0, multiplier: 1,
  msglog: { log() {} }, aimbot: { active: false, trigger() {} },
});
const makePlayer = (game) => new Player(game);
const collect = (game, type, player) =>
  Game.prototype.collectPowerUp.call(game, new PowerUp({ x: 100, y: 100, type, game }), player);

{
  const game = makeGame();
  const p = makePlayer(game);
  p.hp = 10;
  collect(game, 'health', p);
  check(`health drop: hp 10 → ${10 + PLAYER.HEALTH_RESTORE}`, p.hp === 10 + PLAYER.HEALTH_RESTORE, `got ${p.hp}`);
  p.hp = 90;
  collect(game, 'health', p);
  check('health drop caps at maxHp (90 → 100)', p.hp === p.maxHp, `got ${p.hp}`);
  p.shield = 0;
  collect(game, 'shield', p);
  check('shield drop restores to maxShield', p.shield === p.maxShield, `got ${p.shield}`);
  const livesBefore = p.lives;
  collect(game, 'life', p);
  check('life drop: lives +1', p.lives === livesBefore + 1, `got ${p.lives}`);
  game.score = 0; game.multiplier = 1;
  collect(game, 'crate', p);
  check('crate drop: score += 1000 × multiplier', game.score === 1000, `got ${game.score}`);
}

// ─── FRENZY pickup: every cooldown cleared + 30s timer ───
{
  const game = makeGame();
  const p = makePlayer(game);
  p.fireTimer = 0.5; p.thermal = 0.8; p.thermalLockout = 0.9;
  p.stunCooldown = 2; p.napalmCooldown = 2; p.ultimateCooldown = 2;
  game.shake = 0;
  collect(game, 'frenzy', p);
  check(`frenzy drop: frenzyTime = ${PLAYER.FRENZY_DURATION}`, p.frenzyTime === PLAYER.FRENZY_DURATION, `got ${p.frenzyTime}`);
  check('frenzy drop: fireTimer / thermal / lockout cleared', p.fireTimer === 0 && p.thermal === 0 && p.thermalLockout === 0,
    `fireTimer=${p.fireTimer} thermal=${p.thermal} lockout=${p.thermalLockout}`);
  check('frenzy drop: stun / napalm / ultimate cleared', p.stunCooldown === 0 && p.napalmCooldown === 0 && p.ultimateCooldown === 0);
  check('frenzy drop: screen shake ≥ 5', game.shake >= 5, `got ${game.shake}`);
}

}

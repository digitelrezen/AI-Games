// ═══════════════════════════════════════════════════════════
//  [5] VULKAN THERMAL + FRENZY IMMUNITY — real fireNow() gate,
//      20 shots × 0.05 = overheat lockout; frenzy holds it at 0
// ═══════════════════════════════════════════════════════════

import { check, fireNow, makeGame, makePlayer, mod, updateWeaponState } from '../infra.mjs';
const { PLAYER, WEAPONS, ASTEROID, POWERUP_DROPS, rollPowerUpDrop } = await mod('js/core/config.js');

export default async function run() {
console.log('\n[5] Vulcan thermal / frenzy overheat immunity (headless)');
{
  const game = makeGame();
  const p = makePlayer(game);
  p.weapon = 'vulkan';
  let shots = 0;
  for (let i = 0; i < 20; i++) { p.fireTimer = 0; if (fireNow(p)) shots++; }
  check('20 vulkan shots all fire', shots === 20, `got ${shots}`);
  check('overheat triggers lockout 1.2s on shot 20', p.thermalLockout === WEAPONS.vulkan.thermalLockout, `got ${p.thermalLockout}`);
  check('thermal resets to 0 on overheat', p.thermal === 0, `got ${p.thermal}`);
  p.fireTimer = 0;
  check('fireNow() blocked during lockout', fireNow(p) === false);
  check('bullets spawned (2 tips × 20 shots = 40)', game.bullets.length === 40, `got ${game.bullets.length}`);
}
{
  const game = makeGame();
  const p = makePlayer(game);
  p.weapon = 'vulkan';
  p.activateFrenzy();
  let shots = 0;
  for (let i = 0; i < 50; i++) { p.fireTimer = 0; if (fireNow(p)) shots++; }
  check('frenzy: 50/50 shots fire (no rate gate)', shots === 50, `got ${shots}`);
  check('frenzy: thermal stays 0 (no buildup)', p.thermal === 0, `got ${p.thermal}`);
  check('frenzy: no overheat lockout', p.thermalLockout === 0, `got ${p.thermalLockout}`);
}
{
  const game = makeGame();
  const p = makePlayer(game);
  p.weapon = 'vulkan';
  p.frenzyTime = PLAYER.FRENZY_DURATION;
  p.fireTimer = 0.5; p.thermal = 0.9; p.thermalLockout = 0.7;
  updateWeaponState(p, 0.016);
  check('frenzy: updateWeaponState holds fireTimer/thermal/lockout at 0',
    p.fireTimer === 0 && p.thermal === 0 && p.thermalLockout === 0,
    `fireTimer=${p.fireTimer} thermal=${p.thermal} lockout=${p.thermalLockout}`);
  p.frenzyTime = 0;
  p.thermal = 0.5; p.thermalLockout = 0;
  updateWeaponState(p, 1);
  check('no frenzy: thermal decays 0.5 → 0.15 over 1s', Math.abs(p.thermal - 0.15) < 1e-9, `got ${p.thermal}`);
}

}

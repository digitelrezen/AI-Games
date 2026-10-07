// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
//  [6u] v3.68.0 MODULAR WEAPON ARCHITECTURE (Phase 1) —
//      BaseWeapon contract (fire / update / draw / reset /
//      canFire + owner-backed cooldown & lockout) + the
//      VulcanCannon extraction: state stays on Player
//      (fireTimer / thermal / thermalLockout), firing logic
//      moves to js/combat, PlayerWeapons delegates
// ═══════════════════════════════════════════════════════════

import { ROOT, check, cycleWeapon, fireNow, makeGame, makePlayer, mod, updateWeaponState } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const { PLAYER, WEAPONS, ASTEROID, POWERUP_DROPS, rollPowerUpDrop } = await mod('js/core/config.js');

export default async function run() {
console.log('\n[6u] v3.68.0 modular weapon architecture (BaseWeapon + VulcanCannon)');
{
  const { default: BaseWeapon } = await mod('js/combat/BaseWeapon.js');
  const { default: VulcanCannon } = await mod('js/combat/VulcanCannon.js');
  const bwSrc = fs.readFileSync(path.join(ROOT, 'js/combat/BaseWeapon.js'), 'utf8');
  const vcSrc = fs.readFileSync(path.join(ROOT, 'js/combat/VulcanCannon.js'), 'utf8');
  check('BaseWeapon: VERSION = v1.0.0', bwSrc.includes("VERSION = 'v1.0.0'"));
  check('VulcanCannon: VERSION = v1.0.0', vcSrc.includes("VERSION = 'v1.0.0'"));
  check('VulcanCannon: extends BaseWeapon', Object.getPrototypeOf(VulcanCannon.prototype).constructor.name === 'BaseWeapon');
  check('BaseWeapon: abstract fire() throws for unimplemented weapons', (() => {
    const w = new BaseWeapon(makePlayer(makeGame()), 'vulkan');
    let threw = false;
    try { w.fire(0); } catch { threw = true; }
    return threw;
  })());
  check('BaseWeapon: cooldown maps to owner.fireTimer (get + set)', (() => {
    const p = makePlayer(makeGame());
    const w = new BaseWeapon(p, 'vulkan');
    w.cooldown = 0.25;
    return p.fireTimer === 0.25 && w.cooldown === 0.25;
  })());
  check('BaseWeapon: lockout maps to owner.thermalLockout (get + set)', (() => {
    const p = makePlayer(makeGame());
    const w = new BaseWeapon(p, 'vulkan');
    w.lockout = 0.5;
    return p.thermalLockout === 0.5 && w.lockout === 0.5;
  })());
  check('BaseWeapon: canFire() gates on cooldown + lockout + ammo', (() => {
    const p = makePlayer(makeGame());
    const w = new BaseWeapon(p, 'vulkan');
    if (!w.canFire()) return false;
    p.fireTimer = 0.1;
    const gatedByCooldown = !w.canFire();
    p.fireTimer = 0; p.thermalLockout = 0.1;
    const gatedByLockout = !w.canFire();
    p.thermalLockout = 0; w.ammo = 0;
    const gatedByAmmo = !w.canFire();
    return gatedByCooldown && gatedByLockout && gatedByAmmo;
  })());
  // Player owns the registry + the canonical state fields
  const pSrc = fs.readFileSync(path.join(ROOT, 'js/player/Player.js'), 'utf8');
  check('Player: imports VulcanCannon + owns the weapons registry',
    pSrc.includes("import VulcanCannon from '../combat/VulcanCannon.js'") &&
    pSrc.includes('new VulcanCannon(this)'));
  check('Player: respawn resets modular weapon state (weapons.vulkan.reset)', pSrc.includes('this.weapons.vulkan.reset()'));
  check('Player: canonical state fields intact (fireTimer / thermal / thermalLockout)',
    pSrc.includes('this.fireTimer = 0;') && pSrc.includes('this.thermal = 0;') && pSrc.includes('this.thermalLockout = 0;'));
  // PlayerWeapons delegates to p.weapons[p.weapon]
  const pwSrc2 = fs.readFileSync(path.join(ROOT, 'js/player/PlayerWeapons.js'), 'utf8');
  check('PlayerWeapons: fireNow gate delegates to weapon.canFire()',
    pwSrc2.includes('const weapon = p.weapons && p.weapons[p.weapon];') && pwSrc2.includes('if (!weapon.canFire()) return false;'));
  check('PlayerWeapons: firePrimary delegates volleys to weapon.fire()',
    pwSrc2.includes('weapon.fire(aim, { dmgMul, homing: aimAssist(p) })'));
  check('PlayerWeapons: updateWeaponState ticks weapon.update(dt)', pwSrc2.includes('weapon.update(dt);'));
  check('PlayerWeapons: cycleWeapon resets modular weapon state', pwSrc2.includes('weapon.reset();'));
  check('PlayerWeapons: inline fallback kept for un-extracted weapons',
    pwSrc2.includes("if (p.weapon === 'vulkan' && p.thermal > 0)"));
  // Headless: the delegated vulkan keeps its exact v3.67.0 behavior
  const game = makeGame();
  const p = makePlayer(game);
  p.weapon = 'vulkan';
  check('Player: weapons.vulkan is a VulcanCannon instance', p.weapons.vulkan instanceof VulcanCannon);
  let shots = 0;
  for (let i = 0; i < 20; i++) { p.fireTimer = 0; if (fireNow(p)) shots++; }
  check('v3.68.0: 20 delegated vulkan shots all fire', shots === 20, `got ${shots}`);
  check('v3.68.0: overheat sets lockout 1.2s on shot 20 (state on Player)',
    p.thermalLockout === WEAPONS.vulkan.thermalLockout, `got ${p.thermalLockout}`);
  check('v3.68.0: thermal resets to 0 on overheat', p.thermal === 0, `got ${p.thermal}`);
  check('v3.68.0: twin tips × 20 shots = 40 bullets', game.bullets.length === 40, `got ${game.bullets.length}`);
  p.fireTimer = 0;
  check('v3.68.0: fireNow() blocked during lockout (delegated gate)', fireNow(p) === false);
  p.thermal = 0.5; p.thermalLockout = 0;
  updateWeaponState(p, 1);
  check('v3.68.0: updateWeaponState → VulcanCannon.update decays thermal 0.5 → 0.15',
    Math.abs(p.thermal - 0.15) < 1e-9, `got ${p.thermal}`);
  cycleWeapon(p, 1);
  check('v3.68.0: weapon switch clears vulkan thermal/lockout',
    p.thermal === 0 && p.thermalLockout === 0, `thermal=${p.thermal} lockout=${p.thermalLockout}`);
}

}

// ═══════════════════════════════════════════════════════════
//  [6v] v3.69.0 MODULAR WEAPON ARCHITECTURE (Phase 2) —
//      PulseCannon (plasma twin-pod 3-bolt fan) + RailCannon
//      (piercing beam + charge-up visual) extracted; the inline
//      plasma/rail volleys + rail charge visual are gone from
//      PlayerWeapons, and all 3 primary weapons are modular
// ═══════════════════════════════════════════════════════════

import { ROOT, check, cycleWeapon, fireNow, makeGame, makePlayer, mod, updateWeaponState } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const { PLAYER, WEAPONS, ASTEROID, POWERUP_DROPS, rollPowerUpDrop } = await mod('js/core/config.js');

export default async function run() {
console.log('\n[6v] v3.69.0 modular weapon architecture (PulseCannon + RailCannon)');
{
  const { default: PulseCannon } = await mod('js/combat/PulseCannon.js');
  const { default: RailCannon } = await mod('js/combat/RailCannon.js');
  const pcSrc = fs.readFileSync(path.join(ROOT, 'js/combat/PulseCannon.js'), 'utf8');
  const rcSrc = fs.readFileSync(path.join(ROOT, 'js/combat/RailCannon.js'), 'utf8');
  check('PulseCannon: VERSION = v1.0.0', pcSrc.includes("VERSION = 'v1.0.0'"));
  check('RailCannon: VERSION = v1.0.0', rcSrc.includes("VERSION = 'v1.0.0'"));
  check('PulseCannon: extends BaseWeapon', Object.getPrototypeOf(PulseCannon.prototype).constructor.name === 'BaseWeapon');
  check('RailCannon: extends BaseWeapon', Object.getPrototypeOf(RailCannon.prototype).constructor.name === 'BaseWeapon');
  // Player owns the full registry + respawn resets all three
  const pSrc2 = fs.readFileSync(path.join(ROOT, 'js/player/Player.js'), 'utf8');
  check('Player: imports PulseCannon + RailCannon',
    pSrc2.includes("import PulseCannon from '../combat/PulseCannon.js'") &&
    pSrc2.includes("import RailCannon from '../combat/RailCannon.js'"));
  check('Player: registry owns all 3 primary weapons (vulkan/plasma/rail)',
    pSrc2.includes('new VulcanCannon(this)') && pSrc2.includes('new PulseCannon(this)') && pSrc2.includes('new RailCannon(this)'));
  check('Player: respawn resets plasma + rail modular state',
    pSrc2.includes('this.weapons.plasma.reset()') && pSrc2.includes('this.weapons.rail.reset()'));
  // PlayerWeapons: inline plasma/rail volleys + rail charge visual removed
  const pwSrc3 = fs.readFileSync(path.join(ROOT, 'js/player/PlayerWeapons.js'), 'utf8');
  check('PlayerWeapons: inline plasma volley removed (no case left)', !pwSrc3.includes("case 'plasma'"));
  check('PlayerWeapons: inline rail volley removed (no case left)', !pwSrc3.includes("case 'rail'"));
  check('PlayerWeapons: rail charge visual moved out (no chargeTime left)', !pwSrc3.includes('chargeTime'));
  check('RailCannon: charge visual reads the shared cooldown window', rcSrc.includes('this.cooldown > 0 && this.cooldown < w.chargeTime'));
  // Headless: delegated plasma keeps its exact v3.67.0 twin-pod behavior
  const game = makeGame();
  const p = makePlayer(game);
  check('Player: weapons.plasma is a PulseCannon instance', p.weapons.plasma instanceof PulseCannon);
  check('Player: weapons.rail is a RailCannon instance', p.weapons.rail instanceof RailCannon);
  p.weapon = 'plasma';
  let shots = 0;
  for (let i = 0; i < 5; i++) { p.fireTimer = 0; if (fireNow(p)) shots++; }
  check('v3.69.0: 5 delegated plasma shots all fire', shots === 5, `got ${shots}`);
  check('v3.69.0: twin pods × 3-bolt fan × 5 shots = 30 bullets', game.bullets.length === 30, `got ${game.bullets.length}`);
  check('v3.69.0: plasma bolts carry shieldMelt 15', game.bullets.every(b => b.shieldMelt === WEAPONS.plasma.shieldMelt));
  check('v3.69.0: plasma never builds thermal (no heat state)', p.thermal === 0, `got ${p.thermal}`);
  // Headless: delegated rail keeps its exact v3.67.0 piercing behavior
  p.weapon = 'rail';
  p.fireTimer = 0;
  check('v3.69.0: fireNow() fires the delegated rail', fireNow(p) === true);
  check('v3.69.0: rail sets the shared cooldown to rate 1.0s', p.fireTimer === WEAPONS.rail.rate, `got ${p.fireTimer}`);
  check('v3.69.0: fireNow() blocked while the rail cooldown ticks', fireNow(p) === false);
  const railBolts = game.bullets.filter(b => b.weapon === 'rail');
  check('v3.69.0: one piercing rail bolt per shot', railBolts.length === 1, `got ${railBolts.length}`);
  check('v3.69.0: rail bolt pierces 999 at 1500 px/s',
    railBolts[0].pierce === 999 && Math.abs(Math.hypot(railBolts[0].vx, railBolts[0].vy) - WEAPONS.rail.speed) < 1e-6);
  check('v3.69.0: rail impact FX (muzzleFlash 0.18 + shake ≥ 5)',
    p.muzzleFlash === 0.18 && game.shake >= 5, `flash=${p.muzzleFlash} shake=${game.shake}`);
  // Rail charge-up visual: RailCannon.update ticks without error mid-charge
  p.fireTimer = WEAPONS.rail.chargeTime / 2;
  updateWeaponState(p, 0.016);
  check('v3.69.0: RailCannon.update ticks mid-charge without error', p.fireTimer > 0);
  // Weapon-switch invariant: switching away from an overheated Vulcan
  // clears the lockout for the next (modular) weapon — v3.67.0 behavior
  p.weapon = 'vulkan';
  p.thermal = 0.8;
  p.thermalLockout = WEAPONS.vulkan.thermalLockout;
  cycleWeapon(p, 1);
  check('v3.69.0: switch vulkan→plasma clears thermal/lockout (PulseCannon.reset)',
    p.weapon === 'plasma' && p.thermal === 0 && p.thermalLockout === 0,
    `weapon=${p.weapon} thermal=${p.thermal} lockout=${p.thermalLockout}`);
  cycleWeapon(p, 1);
  check('v3.69.0: switch plasma→rail clears thermal/lockout (RailCannon.reset)',
    p.weapon === 'rail' && p.thermal === 0 && p.thermalLockout === 0,
    `weapon=${p.weapon} thermal=${p.thermal} lockout=${p.thermalLockout}`);
}

}

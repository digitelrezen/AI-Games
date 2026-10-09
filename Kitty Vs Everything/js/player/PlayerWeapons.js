// Filename: PlayerWeapons.js
// Kitty Vs Everything — v3.70.0
// 3-weapon primary fire system (Vulkan / Plasma / Rail), thermal management,
// Q/H stun rockets, E/J napalm rockets, R/G weapon cycling. Pure logic —
// mutates Player weapon state and pushes bullets via player.game.
// v3.3.0: Extracted from Player.js (module split of oversized files).
// v3.7.0: L is now primary fire (E is NO LONGER fire — E/J = NAPALM
//         ROCKETS: same twin-paw launch as stun, but a high-damage napalm
//         blast over the same 200px radius). H/G are the lefty mirrors
//         of Q/R.
// v3.14.0: Remappable action layer (fire/stun/napalm/cycleWeapon via
//          InputManager.isDownAction/wasPressedAction + Keybinds.js) and
//          fireNow() split out so TestAimbot can auto-fire at the same
//          cadence; bullets also gain homing while the test aimbot is
//          active (same gate as the robot aimbot).
// v3.33.0: FRENZY (Player.frenzyTime > 0) — the fire cooldown (fireTimer)
//          and ALL thermal state (thermal / thermalLockout) are held at
//          zero every frame: every weapon fires at max rate, the Vulcan
//          never builds heat and can never overheat (updateWeaponState +
//          firePrimary).
// v3.46.0: PLASMA TWIN-POD BURST — firePrimary's plasma case now fires a
//          3-bolt fan from BOTH front-paw emitter tips on every shot (no
//          alternation; both pods fire together). Per-weapon barrelLen
//          (WEAPONS.plasma.barrelLen = 10) places the tips at the pod
//          mouths (PlayerHardpoints.getMuzzleTipOffsets).
// v3.68.0: MODULAR WEAPON ARCHITECTURE (Phase 1) — the Vulcan Cannon moved
//          to js/combat/VulcanCannon.js (extends js/combat/BaseWeapon.js).
//          Player owns a weapons registry (p.weapons); fireNow / firePrimary
//          / updateWeaponState / cycleWeapon now delegate to
//          p.weapons[p.weapon] when the active weapon has been extracted.
// v3.69.0: MODULAR WEAPON ARCHITECTURE (Phase 2) — the Plasma Pulse moved
//          to js/combat/PulseCannon.js and the Rail Cannon to
//          js/combat/RailCannon.js (both extend BaseWeapon). ALL THREE
//          primary weapons are now modular: firePrimary has no inline
//          volleys left, the rail charge-up visual lives in
//          RailCannon.update(dt), and the inline state-tick fallback only
//          remains as a documented defensive path.
// v3.70.0: MODULAR WEAPON ARCHITECTURE (Phase 3) — the specialized
//          rockets moved out of js/combat/Rockets.js (now deleted):
//          js/combat/BaseRocket.js (shared twin-salvo base projectile) +
//          js/combat/StunRockets.js (Q/H: homing tracking, smoke trail,
//          shield-strip/stun AoE) + js/combat/NapalmRockets.js (E/J:
//          fire trail, clip-hit chip + ignite, AoE damage + FireZone).
//          fireStunRockets / fireNapalmRockets now delegate the launch to
//          the module singletons; the paw flash + banner stay in the
//          secondary firing loop here.
export const VERSION = 'v4.11.0';
import { PLAYER, WEAPONS, WEAPON_ORDER, MINI_SHIP } from '../core/config.js';
import { rand } from '../core/utils.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js'; // v4.11.0: weaponSwitch SFX
import { stunRockets } from '../combat/StunRockets.js'; // v3.70.0: modular stun rockets (Q/H)
import { napalmRockets } from '../combat/NapalmRockets.js'; // v3.70.0: modular napalm rockets (E/J)
import { getMuzzlePosition } from './PlayerHardpoints.js';

/** Per-weapon state tick (thermal decay, lockout smoke, charge visuals).
 *  v3.33.0: while FRENZY is active (p.frenzyTime > 0) the fire cooldown and
 *  ALL thermal state are held at zero every frame — cooldowns removed,
 *  Vulcan overheat neutralized.
 *  v3.68.0: the per-weapon state tick is delegated to the modular weapon
 *  (p.weapons[p.weapon].update(dt) — VulcanCannon for the vulkan).
 *  v3.69.0: all three primary weapons are modular (VulcanCannon /
 *  PulseCannon / RailCannon — the rail charge-up visual now lives in
 *  RailCannon.update); the inline fallback only remains as a documented
 *  defensive path for a future un-extracted weapon. */
export function updateWeaponState(p, dt) {
  const w = WEAPONS[p.weapon];

  if (p.frenzyTime > 0) {
    // ─── v3.33.0: FRENZY — hold fire cooldown + thermal/lockout at zero ───
    p.fireTimer = 0;
    p.thermal = 0;
    p.thermalLockout = 0;
  } else {
    const weapon = p.weapons && p.weapons[p.weapon];
    if (weapon) {
      // v3.68.0: modular weapon owns its per-frame state (VulcanCannon:
      // thermal decay + overheat lockout tick + lockout smoke).
      weapon.update(dt);
    } else {
      // Defensive fallback: every WEAPON_ORDER weapon is modular as of
      // v3.69.0, so this path is unreachable today — kept so a future
      // un-extracted weapon has a documented inline state tick.
      // Thermal decay (Vulkan)
      if (p.weapon === 'vulkan' && p.thermal > 0) {
        p.thermal = Math.max(0, p.thermal - w.thermalDecay * dt);
      }
      // Thermal lockout tick
      if (p.thermalLockout > 0) {
        p.thermalLockout = Math.max(0, p.thermalLockout - dt);
        // Emit smoke during lockout
        if (Math.random() < 0.3) {
          const muzzle = getMuzzlePosition(p);
          p.game.particles.burst(muzzle.x, muzzle.y, { count: 2, color: '#4a4a4a', speed: 30, life: 0.6, size: 3 });
        }
      }
    }
  }
  // v3.69.0: the rail charge-up visual moved to RailCannon.update(dt) —
  // it reads the same canonical fields (owner.fireTimer + the rail
  // charge window from WEAPONS.rail).
}

/** L / LMB: primary fire with rate-of-fire + overheat lockout gating.
 *  v3.7.0: E is no longer primary fire (E/J = napalm rockets).
 *  v3.14.0: reads the remappable 'fire' action (Keybinds.js). The
 *  cooldown/lockout gating lives in fireNow() so the dev test-aimbot
 *  (TestAimbot.js) can auto-fire at the exact same cadence. */
export function tryFire(p, dt, input) {
  p.fireTimer -= dt;
  if (input.isDownAction('fire')) fireNow(p);
}

/** Fire if the cooldown + overheat gates allow. Returns true if fired.
 *  v3.14.0: shared by tryFire (manual) and TestAimbot (auto).
 *  v3.68.0: the gate delegates to the modular weapon's canFire() when the
 *  active weapon has been extracted (p.weapons[p.weapon]). */
export function fireNow(p) {
  const w = WEAPONS[p.weapon];
  const weapon = p.weapons && p.weapons[p.weapon];
  if (weapon) {
    if (!weapon.canFire()) return false;
  } else if (p.thermalLockout > 0 || p.fireTimer > 0) {
    return false;
  }
  p.fireTimer = w.rate;
  p.firedThisFrame = true; // v3.17.0: docked minis fire in sync with the hull
  firePrimary(p);
  return true;
}

/** Q/H stun rockets · E/J napalm rockets · R/G cycle weapon.
 *  (F/C ultimate stays on Player — variants override it.)
 *  v3.14.0: all read the remappable action layer. */
export function handleActionKeys(p, input) {
  // ─── STUN ROCKETS action (default Q / H) ───
  if (input.wasPressedAction('stun') && p.stunCooldown <= 0) {
    fireStunRockets(p);
    p.stunCooldown = PLAYER.STUN_COOLDOWN;
  }
  // ─── NAPALM ROCKETS action (default E / J) ───
  if (input.wasPressedAction('napalm') && p.napalmCooldown <= 0) {
    fireNapalmRockets(p);
    p.napalmCooldown = PLAYER.NAPALM_COOLDOWN;
  }
  // ─── CYCLE WEAPON action (default R / G) ───
  if (input.wasPressedAction('cycleWeapon')) cycleWeapon(p, 1);
}

// ═══════════════════════════════════════════════════════════
//  PRIMARY FIRE — weapon-specific, from front-paw hardpoints
// ═══════════════════════════════════════════════════════════
/** v3.14.0: aim-assist gate — the robot aimbot OR the dev test aimbot.
 *  Used for spread-zero + bullet homing. */
function aimAssist(p) {
  return p.game.aimbot.active || (p.game.testAimbot && p.game.testAimbot.active);
}

export function firePrimary(p) {
  const spread = aimAssist(p) ? 0 : rand(-0.04, 0.04);
  const aim = p.angle + spread;
  const dmgMul = 1 + p.minis.length * MINI_SHIP.damageBonusPerMini;

  // v3.69.0: all three primary weapons are modular (p.weapons registry —
  // VulcanCannon / PulseCannon / RailCannon). The fireNow() gate already
  // ran canFire(); each weapon class owns its volley shape, FX and audio.
  const weapon = p.weapons && p.weapons[p.weapon];
  if (weapon) {
    weapon.fire(aim, { dmgMul, homing: aimAssist(p) });
    return;
  }
  // Defensive: every WEAPON_ORDER weapon has a modular class, so no inline
  // volleys remain. A future un-extracted weapon would get a case here.
}

// ═══════════════════════════════════════════════════════════
//  Q/H KEY: STUN ROCKETS (v3.11.0 — real homing rockets)
//  v3.70.0: the tracking + payload + stun AoE live in
//  js/combat/StunRockets.js (extends BaseRocket) — twin rockets home in
//  with a zig-zag weave + smoke trail and burst into the classic 200px
//  shield-strip/stun field on impact (no direct damage).
// ═══════════════════════════════════════════════════════════
export function fireStunRockets(p) {
  stunRockets.launch(p.game, p);
  p.pawFlashL = 0.1;
  p.pawFlashR = 0.1;
  bus.emit('banner', { text: 'STUN ROCKETS AWAY!', tone: 'good', duration: 0.8 });
}

// ═══════════════════════════════════════════════════════════
//  E / J KEY: NAPALM ROCKETS (v3.11.0 — real straight-flying rockets)
//  v3.70.0: the AoE burn zones + persistent flame + fire trail live in
//  js/combat/NapalmRockets.js (extends BaseRocket) — twin rockets fly
//  straight; impact: 200px AoE damage burst (mini-scaled) + a lingering
//  fire zone; enemies clipped in flight take chip damage and ignite a
//  pool at their spot.
// ═══════════════════════════════════════════════════════════
export function fireNapalmRockets(p) {
  napalmRockets.launch(p.game, p);
  p.pawFlashL = 0.1;
  p.pawFlashR = 0.1;
  bus.emit('banner', { text: 'NAPALM ROCKETS AWAY!', tone: 'good', duration: 0.8 });
}

/** R / G key: cycle to next/previous weapon and reset per-weapon state.
 *  v3.68.0: modular weapons clear their own state via weapon.reset(). */
export function cycleWeapon(p, dir) {
  const order = WEAPON_ORDER;
  const i = (order.indexOf(p.weapon) + dir + order.length) % order.length;
  p.weapon = order[i];
  const weapon = p.weapons && p.weapons[p.weapon];
  if (weapon) {
    weapon.reset(); // v3.69.0: all 3 primary weapons clear thermal + lockout
  } else {
    p.thermal = 0;
    p.thermalLockout = 0;
  }
  p.plasmaAlt = 0;
  bus.emit('banner', { text: 'WEAPON: ' + WEAPONS[p.weapon].name, tone: 'good', duration: 0.8 });
  audio.weaponSwitch(); // v4.11.0: weapon cycle blip (zero silent triggers)
}

// Filename: config/weapons.js
// Kitty Vs Everything — v3.77.0
// E6 modularization (v3.77.0): weapon / rocket / fire-zone balance split
// out of js/core/config.js (now the compatibility re-export shim — the
// public surface is unchanged).

// ─── v3.11.0: ROCKETS (Q/H stun + E/J napalm — real projectiles) ───
// v3.70.0: the rocket logic now lives in js/combat/StunRockets.js +
// js/combat/NapalmRockets.js (both extend js/combat/BaseRocket.js).
// Twin salvo from the front-paw hardpoints. Stun rockets home with a zig-zag
// weave + smoke trail and burst into the classic 200px shield-strip/stun
// field (no direct damage). Napalm rockets fly straight with a fire trail;
// impact = 200px AoE damage burst (mini-scaled) + a lingering FIRE_ZONE
// pool, and enemies clipped in flight take chip damage + ignite a pool.
export const ROCKETS = {
  speed: 540,             // px/s cruise speed
  life: 2.0,              // self-destruct (detonates) if nothing is hit (s)
  radius: 6,              // collision radius
  turnRate: 3.4,          // stun-rocket homing turn rate (rad/s)
  weave: 0.4,             // stun-rocket zig-zag weave amplitude (rad)
  // STUN — AoE field around the impact point
  stunRadius: 200,        // same 200px field as the old instant blast
  stunDuration: 1.0,      // stun on non-special enemies (s)
  stunSuppress: 3.0,      // fire suppression on stunned enemies (s)
  stunColor: '#80d8ff',
  // NAPALM — AoE around the impact point + burning ground pools
  napalmRadius: 200,      // same 200px field as the old instant blast
  napalmDamage: 60,       // base AoE damage (× mini damage bonus)
  napalmChip: 12,         // direct-hit chip (enemy clipped in flight)
  napalmColor: '#ff6d00',
  igniteChance: 0.75,     // clip hit → fire pool left at the enemy's spot
};

// ─── v3.11.0: FIRE ZONE (lingering napalm pools — FireZone.js) ───
// Ground pools left by napalm rocket impacts: enemies passing through take
// periodic DoT damage until the pool burns out.
export const FIRE_ZONE = {
  radius: 55,             // pool radius (px)
  duration: 4.0,          // how long the pool burns (s)
  tick: 0.5,              // DoT tick interval (s)
  damage: 8,              // damage per tick to every enemy inside
};

// ═══════════════════════════════════════════════════════════
//  WEAPON SYSTEM — 3 distinct weapons for upper-paw hardpoints
// ═══════════════════════════════════════════════════════════
export const WEAPONS = {
  vulkan: {
    name: 'VULKAN CANNON',
    color: '#ff6a00',
    accent: '#ffab40',
    damage: 5,
    speed: 720,
    rate: 0.07,
    pierce: 0,
    tracking: 0.8,
    thermalPerShot: 0.05,
    thermalDecay: 0.35,
    thermalMax: 1.0,
    thermalLockout: 1.2,
    // v3.46.0: per-weapon paw barrel length (local -Y) — twin Gatling barrels
    barrelLen: 15,
    desc: 'High-RoF Gatling · Ballistic Tracking · Thermal Buildup',
  },
  plasma: {
    name: 'PLASMA PULSE',
    color: '#00e5ff',
    accent: '#80d8ff',
    damage: 22,
    speed: 560,
    rate: 0.24,
    pierce: 0,
    shieldMelt: 15,
    // v3.46.0: per-weapon paw barrel length (local -Y) — short emitter pods
    barrelLen: 10,
    desc: 'Twin-Pod Burst · 3 Bolts/Paw · Shield Melt',
  },
  rail: {
    name: 'RAIL CANNON',
    color: '#b388ff',
    accent: '#d1c4e9',
    damage: 100,
    speed: 1500,
    rate: 1.0,
    pierce: 999,
    chargeTime: 0.5,
    // v3.46.0: per-weapon paw barrel length (local -Y) — single long barrel
    barrelLen: 22,
    desc: 'Piercing Beam · Charge Mechanic · Massive Impact',
  },
};

export const WEAPON_ORDER = ['vulkan', 'plasma', 'rail'];

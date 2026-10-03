// Filename: SuperNova.js
// Kitty Vs Everything — v3.71.0 (module v1.0.0)
// Base nova + synergy super-weapon volleys (Phase 4 modular combat
// extraction). Both volleys used to live inline in Player.js —
// activateUltimate() (the base F-key nova) and superWeapon() (the
// 'synergy' key, T / - P1, , P2). They are extracted here so js/combat/
// owns ALL cat-ship combat logic (weapons, rockets, catship factory,
// docked minis, nova/super-weapon); Player.js now only delegates.
//
// Behavior is byte-for-byte identical to the old inline code:
//   • fireNova(player) — 16-bullet ring (500 px/s, damage 25, #ffd54f,
//     1.5 s life, friendly, owner-tagged) + 30-particle burst + shake 8
//     + audio.superWeapon().
//   • fireSuperWeapon(player) — 'COLOR SYNERGY! SUPER-WEAPON FIRED!'
//     banner + 32-bullet ring (500 px/s, damage 40, #ffd54f, 2 s life)
//     + 8 homing bolts (700 px/s, damage 60, #ff5252, 2.5 s life,
//     homing = true) + shake 16 + 60-particle burst + audio.superWeapon().
//
// The 5 cat variants (yellowCat / orangeCat / greyCat / whiteCat /
// brownCat) still OVERRIDE Player.activateUltimate with their own
// element-flavored volleys — only the base fallback moves here.
export const VERSION = 'v1.0.0';
import Bullet from './Bullet.js';
import { TAU, rand } from '../core/utils.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';

/**
 * Base nova (Player.activateUltimate fallback, F / C default).
 * @param {Player} player — the firing cat ship (position + game source)
 */
export function fireNova(player) {
  const g = player.game;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    g.bullets.push(new Bullet({
      x: player.x, y: player.y,
      vx: Math.cos(a) * 500, vy: Math.sin(a) * 500,
      damage: 25, color: '#ffd54f', friendly: true, life: 1.5, owner: player,
    }));
  }
  g.particles.burst(player.x, player.y, { count: 30, color: '#ffd54f', speed: 300, life: 0.6 });
  g.shake = 8;
  audio.superWeapon();
}

/**
 * Synergy super-weapon (Player.superWeapon, 'synergy' action — T / - P1,
 * , P2 — fired when the docked fleet is color-matched and the meter is
 * full; see PlayerFleet.updateFleet).
 * @param {Player} player — the firing cat ship (position + game source)
 */
export function fireSuperWeapon(player) {
  const g = player.game;
  bus.emit('banner', { text: 'COLOR SYNERGY! SUPER-WEAPON FIRED!', tone: 'good', duration: 2 });
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * TAU;
    g.bullets.push(new Bullet({
      x: player.x, y: player.y,
      vx: Math.cos(a) * 500, vy: Math.sin(a) * 500,
      damage: 40, color: '#ffd54f', friendly: true, life: 2, owner: player,
    }));
  }
  for (let i = 0; i < 8; i++) {
    const a = rand(0, TAU);
    const b = new Bullet({
      x: player.x, y: player.y,
      vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
      damage: 60, color: '#ff5252', friendly: true, life: 2.5, owner: player,
    });
    b.homing = true;
    g.bullets.push(b);
  }
  g.shake = 16;
  g.particles.burst(player.x, player.y, { count: 60, color: '#ffd54f', speed: 400, life: 1 });
  audio.superWeapon();
}
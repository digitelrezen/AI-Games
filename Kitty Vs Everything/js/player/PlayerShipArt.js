// Filename: PlayerShipArt.js
// Kitty Vs Everything — v3.6.0
// Top-down "hands up, don't shoot" catship art (v3.4.0 full redesign).
//
// Design brief: sleek, aggressive, flying predator — NOT a block with
// antennas. The head assembly is a direct top-down interpretation of the
// enemy black cat (BlackCatEnemy.js): rounded skull, sharp INTEGRATED
// triangular cat ears (black-cat angle & sharpness, no antennas), glowing
// slit-pupil eyes, nose, muzzle, DETERMINED stern mouth, whisker fan.
// The body is a core torso with four limbs — no crossbars, no side rails,
// no bell, no central bulge:
//   • FRONT ARMS — sleek limbs stretched straight forward to the weapon
//     paws (SHIP_GEOMETRY.frontPawL/R, y ≈ -28, level with the ear tips).
//   • REAR LEGS  — the SAME arm geometry mirrored to the tail side: sleek
//     limbs stretched straight back along the tail, flanking it on both
//     sides, to the thruster paws (SHIP_GEOMETRY.thrusterL/R, ≈ 20%
//     shorter than the arms).
//   • TORSO      — smooth aerodynamic core connecting all four limbs.
//   • DOCK PORTS — INVISIBLE: no booms, no cradles. Just a tiny pulsing
//     glow-orb floating off each flank (SHIP_GEOMETRY.miniDockL/R) with
//     clear space to the hull; docked minis cover their orb exactly.
//
// Top-down transform UNCHANGED: nose = -Y, tail = +Y, flanks = ±X,
// ctx.rotate(angle + PI/2). All hardpoint positions come from SHIP_GEOMETRY
// (config.js) — the single source of truth.
// v3.6.0: Rear legs mirror the front-arm geometry along the tail.
// v3.8.0: FACE — the thin scowl line is gone. The cat now has a NOTICEABLE
//         open snarl mouth: red oral cavity with white SHARP TEETH (2 long
//         fangs + 4 upper canines + 3 lower teeth) so facial expressions
//         read during combat. The snarl opens WIDER while firing.
//         Paws upgraded in PlayerShipFx.js (main pad / toe beans / claws).
//         opts.mini — used by PlayerMiniArt to render exact mini clones
//         without drawing the sub-dock glow-orbs.
// v3.16.0: front-paw hardpoints read the weapon animation state (WeaponAnim.js)
//         — vulkan spin / rail charge / plasma pulse — passed as `p`.
export const VERSION = 'v3.16.0';
import { TAU } from '../core/utils.js';
import { hexA } from '../core/utils.js';
import { WEAPONS, SHIP_GEOMETRY } from '../core/config.js';
import { drawWeaponPaw, drawThrusterPaw, drawMuzzleFlash } from './PlayerShipFx.js';

/**
 * Draw the main cat hull (H-pose: four limbs on an aerodynamic core).
 * In-game: uses p.x / p.y / scale 1. Menu icons pass explicit
 * { x, y, scale } via opts.
 */
export function drawCatShip(ctx, p, c, a, pattern, opts = {}, sprite = null) {
  const x = opts.x !== undefined ? opts.x : p.x;
  const y = opts.y !== undefined ? opts.y : p.y;
  const s = opts.scale || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.angle + Math.PI / 2);
  ctx.scale(s, s);

  // v3.72.0 — Catship sprite art: when a decoded sprite canvas is supplied
  // (theme's cat-on-its-back PNG), blit it in place of the procedural hull.
  // The sprite is drawn at a fixed 70px height (matching the procedural hull)
  // so weapon/thruster hardpoints (drawn by the caller) still line up.
  if (sprite && sprite.width && sprite.height) {
    const dh = 70;
    const ss = dh / sprite.height;
    const dw = sprite.width * ss;
    ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return;
  }

  const flicker = 0.7 + 0.3 * Math.sin(p.engineFlicker);
  const thrustOn = p.thrusterActive || p.boostActive;
  const flameFlicker = thrustOn ? (0.7 + 0.3 * Math.sin(p.engineFlicker * 2)) : 0;
  const boostGlow = p.boostActive ? 1.6 : 1;
  const weaponColor = (p.weapon && WEAPONS[p.weapon]) ? WEAPONS[p.weapon].color : '#ffffff';
  const pawL = SHIP_GEOMETRY.frontPawL;
  const pawR = SHIP_GEOMETRY.frontPawR;
  const thrL = SHIP_GEOMETRY.thrusterL;
  const thrR = SHIP_GEOMETRY.thrusterR;
  const dockL = SHIP_GEOMETRY.miniDockL;
  const dockR = SHIP_GEOMETRY.miniDockR;

  // ═══ TAIL (reactive sway + idle wag, tapered, fluffy glowing tip) ═══
  const tailSway = p.tailSway * 15 + Math.sin((p.animTime || 0) * 5) * 2;
  const tipX = tailSway;
  const tipY = 41;
  ctx.strokeStyle = c;
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 13);
  ctx.quadraticCurveTo(tailSway * 0.35, 23, tailSway * 0.6, 30);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tailSway * 0.6, 30);
  ctx.quadraticCurveTo(tailSway * 0.85, 35, tipX, tipY);
  ctx.stroke();
  // Fluffy tip
  ctx.fillStyle = a;
  ctx.shadowColor = a;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(tipX, tipY, 4, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(tipX - 1, tipY - 1, 1.6, 0, TAU);
  ctx.fill();

  // ═══ REAR LEGS (v3.6.0: front-arm geometry mirrored to the tail side —
  //     sleek limbs stretched straight back along the tail, flanking it on
  //     both sides; same hip→ankle taper as the arms, ~20% shorter) ═══
  for (const f of [-1, 1]) {
    ctx.fillStyle = c;
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(f * 10.8, 8.2);                              // outer hip
    ctx.quadraticCurveTo(f * 13.4, 16.6, f * 16.7, 26.6);   // outer edge → ankle
    ctx.quadraticCurveTo(f * 15.1, 31.1, f * 13.4, 29.3);   // heel (under thruster pod)
    ctx.quadraticCurveTo(f * 10.0, 18.2, f * 6.2, 10.6);    // inner edge → hip
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Hip pad (accent — mirrors the arms' shoulder pads)
    ctx.fillStyle = hexA(a, 0.35);
    ctx.beginPath();
    ctx.arc(f * 9.0, 9.6, 1.7, 0, TAU);
    ctx.fill();
  }

  // ═══ BACK PAW THRUSTER PODS (hardpoints from SHIP_GEOMETRY) ═══
  drawThrusterPaw(ctx, thrL.x, thrL.y, flicker, flameFlicker, boostGlow, c, a);
  drawThrusterPaw(ctx, thrR.x, thrR.y, flicker, flameFlicker, boostGlow, c, a);

  // ═══ FRONT ARMS (sleek limbs stretched straight forward to the
  //     weapon paws — broad shoulder, tapering to the wrist) ═══
  for (const f of [-1, 1]) {
    ctx.fillStyle = c;
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(f * 10.8, -3.0);                             // outer shoulder
    ctx.quadraticCurveTo(f * 14.0, -13.5, f * 18.2, -26.0); // outer edge → paw
    ctx.quadraticCurveTo(f * 16.2, -31.6, f * 14.0, -29.4); // wrist (under weapon pod)
    ctx.quadraticCurveTo(f * 9.8, -15.5, f * 5.0, -6.0);    // inner edge → shoulder
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Shoulder pad (accent)
    ctx.fillStyle = hexA(a, 0.35);
    ctx.beginPath();
    ctx.arc(f * 8.6, -4.8, 2.0, 0, TAU);
    ctx.fill();
  }

  // ═══ FRONT PAW WEAPON PODS (hardpoints from SHIP_GEOMETRY) ═══
  // v3.16.0: pass the weapon animation state (p) so the paws read the
  // vulkan spin / rail charge / plasma pulse (WeaponAnim.js).
  drawWeaponPaw(ctx, pawL.x, pawL.y, c, a, p.pawFlashL || 0, weaponColor, p);
  drawWeaponPaw(ctx, pawR.x, pawR.y, c, a, p.pawFlashR || 0, weaponColor, p);

  // ═══ TORSO (smooth aerodynamic core — no bell, no central bulge) ═══
  ctx.fillStyle = c;
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -8.5);
  ctx.quadraticCurveTo(-5.2, -8.2, -8.6, -3.8);  // left shoulder
  ctx.quadraticCurveTo(-9.4, 1.2, -6.8, 4.6);    // left waist (taper)
  ctx.quadraticCurveTo(-6.4, 8.2, -8.4, 10.8);   // left hip
  ctx.quadraticCurveTo(-7.6, 14.0, 0, 14.4);     // tail root
  ctx.quadraticCurveTo(7.6, 14.0, 8.4, 10.8);    // right hip
  ctx.quadraticCurveTo(6.4, 8.2, 6.8, 4.6);      // right waist
  ctx.quadraticCurveTo(9.4, 1.2, 8.6, -3.8);     // right shoulder
  ctx.quadraticCurveTo(5.2, -8.2, 0, -8.5);      // neck
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Spine line (accent — keeps the core reading as one sleek piece)
  ctx.strokeStyle = hexA(a, 0.35);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.quadraticCurveTo(0, 5, 0, 12.5);
  ctx.stroke();
  // Torso fur pattern (theme)
  if (pattern === 'striped') {
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-7.4, -1.5); ctx.quadraticCurveTo(0, -0.3, 7.4, -1.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6.8, 3.5);  ctx.quadraticCurveTo(0, 4.7,  6.8, 3.5);  ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6.6, 8.5);  ctx.quadraticCurveTo(0, 9.7,  6.6, 8.5);  ctx.stroke();
  } else if (pattern === 'spotted') {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (const [sx, sy] of [[-4.2, -0.8], [4.2, 1.6], [-3.4, 6.2], [4.4, 9.2]]) {
      ctx.beginPath(); ctx.arc(sx, sy, 1.2, 0, TAU); ctx.fill();
    }
  }

  // ═══ DOCK PORTS (v3.6.0: INVISIBLE docking points — no boom, no cradle.
  //     Just a tiny pulsing glow-orb floating off each flank with clear
  //     space to the hull; a docked mini-ship covers its orb exactly.
  //     v3.8.0: skipped for mini clones — a mini can't sub-dock anything) ═══
  if (!opts.mini) {
    for (const f of [-1, 1]) {
      const dock = f < 0 ? dockL : dockR;
      const pulse = 0.75 + 0.25 * Math.sin((p.animTime || 0) * 3 + (f < 0 ? 0 : Math.PI / 2));
      ctx.shadowColor = a;
      ctx.shadowBlur = 5 * pulse;
      ctx.fillStyle = hexA(a, 0.95);
      ctx.beginPath();
      ctx.arc(dock.x, dock.y, 1.6, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(dock.x, dock.y, 0.6, 0, TAU);
      ctx.fill();
    }
  }

  // ═══ HEAD (rounded skull — the enemy black cat's head, top-down) ═══
  ctx.fillStyle = c;
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, -11, 9.5, 8.5, 0, 0, TAU);   // skull: x ±9.5, y -19.5..-2.5
  ctx.fill();
  ctx.stroke();
  // Neon nose trim (glowing edge along the snout)
  ctx.strokeStyle = hexA(a, 0.9);
  ctx.lineWidth = 1.3;
  ctx.shadowColor = a;
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.ellipse(0, -11, 9.1, 8.1, 0, -Math.PI / 2 - 0.85, -Math.PI / 2 + 0.85);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ═══ EARS (sleek INTEGRATED cat ears — black-cat angle & sharpness,
  //     base points sit on the skull rim, no antennas, no glowing tips) ═══
  for (const f of [-1, 1]) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(f * 6.7, -15.0);                              // base outer (on skull rim)
    ctx.quadraticCurveTo(f * 10.8, -26.8, f * 11.8, -29.2);  // leading edge → tip
    ctx.quadraticCurveTo(f * 7.5, -23.0, f * 1.2, -19.4);    // inner edge → base
    ctx.closePath();
    ctx.fill();
    // Crisp edges on the two exposed sides only (no seam at the base)
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(f * 6.7, -15.0);
    ctx.quadraticCurveTo(f * 10.8, -26.8, f * 11.8, -29.2);
    ctx.quadraticCurveTo(f * 7.5, -23.0, f * 1.2, -19.4);
    ctx.stroke();
    // Dark inner ear (like the black cat's)
    ctx.fillStyle = 'rgba(20,20,35,0.45)';
    ctx.beginPath();
    ctx.moveTo(f * 6.6, -16.7);
    ctx.lineTo(f * 10.3, -26.9);
    ctx.lineTo(f * 2.7, -19.9);
    ctx.closePath();
    ctx.fill();
  }

  // ═══ FACE (muzzle / eyes / determined brows / nose / SNARL MOUTH / whiskers) ═══
  // Muzzle (soft light snout patch under the eyes — makes the muzzle read
  // clearly against the dark skull; nose + open snarl mouth are drawn on top.
  // v3.8.0: widened to frame the new red mouth)
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.ellipse(0, -15.6, 4.6, 3.5, 0, 0, TAU);
  ctx.fill();

  // Eyes (glowing, slit pupils — focused, not manic; periodic blink)
  const cyc = (p.animTime || 0) % 3.4;
  const blink = cyc < 0.16 ? 1 - Math.abs(cyc - 0.08) / 0.08 : 0;
  for (const f of [-1, 1]) {
    const ex = f * 4.2;
    const ey = -16.8;
    if (blink > 0.8) {
      // Narrowed determined blink (flat line, not a happy curve)
      ctx.strokeStyle = '#131a2a';
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - 1.8, ey + 0.2);
      ctx.lineTo(ex + 1.8, ey + 0.2);
      ctx.stroke();
      continue;
    }
    const ry = 1 - blink * 0.85;
    ctx.fillStyle = 'rgba(255,255,245,0.95)';
    ctx.beginPath(); ctx.ellipse(ex, ey, 2.4, 1.8 * ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#37d4e8';
    ctx.shadowColor = '#37d4e8';
    ctx.shadowBlur = 3;
    ctx.beginPath(); ctx.ellipse(ex, ey, 1.6, 1.3 * ry, 0, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // Slit pupil (cat-like)
    ctx.fillStyle = '#131a2a';
    ctx.beginPath(); ctx.ellipse(ex, ey, 0.6, 1.15 * ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex + 0.8, ey - 0.8, 0.55, 0, TAU); ctx.fill();
  }

  // Brows (determined — inner ends drop toward the nose: focused furrow)
  ctx.strokeStyle = 'rgba(15,18,35,0.75)';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (const f of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(f * 6.3, -19.0);
    ctx.quadraticCurveTo(f * 4.4, -18.3, f * 2.7, -17.4);
    ctx.stroke();
  }

  // Nose (pink triangle at the snout tip)
  ctx.fillStyle = '#d4a0a0';
  ctx.shadowColor = '#d4a0a0';
  ctx.shadowBlur = 2;
  ctx.beginPath();
  ctx.moveTo(0, -19.4);
  ctx.lineTo(-1.5, -17.2);
  ctx.lineTo(1.5, -17.2);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // ═══ MOUTH (v3.8.0: NOTICEABLE open red snarl with white SHARP TEETH —
  //     facial expression reads during combat. The snarl opens WIDER and
  //     DEEPER while the ship is firing (muzzle/paw flash active)) ═══
  const firing = (p.muzzleFlash || 0) > 0 || (p.pawFlashL || 0) > 0 || (p.pawFlashR || 0) > 0;
  const mBot = firing ? -12.4 : -13.1;   // jaw depth (deeper snarl while firing)
  // Philtrum (nose → mouth)
  ctx.strokeStyle = 'rgba(15,18,35,0.6)';
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -17.2);
  ctx.lineTo(0, -15.4);
  ctx.stroke();
  // Open mouth (corners pull UP — aggressive snarl, never a smile)
  ctx.fillStyle = firing ? '#a01830' : '#8c1226';
  ctx.strokeStyle = 'rgba(15,18,35,0.55)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-4.0, -15.7);                                  // left corner (snarl flick up)
  ctx.quadraticCurveTo(-2.0, -15.25, 0, -15.25);            // upper lip → center
  ctx.quadraticCurveTo(2.0, -15.25, 4.0, -15.7);            // center → right corner
  ctx.quadraticCurveTo(3.5, mBot, 0, mBot);                 // right jaw → chin
  ctx.quadraticCurveTo(-3.5, mBot, -4.0, -15.7);            // chin → left jaw
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Throat (dark depth) + tongue
  ctx.fillStyle = '#5c0d1c';
  ctx.beginPath();
  ctx.ellipse(0, mBot - 0.9, 2.1, 1.0, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c74b63';
  ctx.beginPath();
  ctx.ellipse(0, mBot - 0.55, 1.3, 0.7, 0, 0, TAU);
  ctx.fill();
  // White sharp teeth — upper row: 2 long fangs (outer) + 4 small canines
  ctx.fillStyle = '#ffffff';
  for (const f of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(f * 3.75, -15.7);
    ctx.lineTo(f * 2.55, -15.35);
    ctx.lineTo(f * 3.05, -14.05);
    ctx.closePath();
    ctx.fill();
  }
  for (const tx of [-1.85, -0.65, 0.65, 1.85]) {
    ctx.beginPath();
    ctx.moveTo(tx - 0.5, -15.3);
    ctx.lineTo(tx + 0.5, -15.3);
    ctx.lineTo(tx, -14.25);
    ctx.closePath();
    ctx.fill();
  }
  // White sharp teeth — lower row: 3 small teeth pointing up from the jaw
  for (const tx of [-1.5, 0, 1.5]) {
    ctx.beginPath();
    ctx.moveTo(tx - 0.45, mBot - 0.3);
    ctx.lineTo(tx + 0.45, mBot - 0.3);
    ctx.lineTo(tx, mBot - 1.35);
    ctx.closePath();
    ctx.fill();
  }

  // Whiskers (glowing sensor lines, three per side — black-cat fan)
  ctx.strokeStyle = hexA(a, 0.7);
  ctx.lineWidth = 0.8;
  ctx.shadowColor = a;
  ctx.shadowBlur = 2;
  for (const f of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(f * 6.6, -14.6 + i * 1.5);
      ctx.quadraticCurveTo(f * 11.0, -15.0 + i * 1.9, f * 15.2, -15.6 + i * 2.4);
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;

  // ═══ MUZZLE FLASH (rail cannon, at SHIP_GEOMETRY.muzzle) ═══
  if (p.muzzleFlash > 0) {
    drawMuzzleFlash(ctx, SHIP_GEOMETRY.muzzle.x, SHIP_GEOMETRY.muzzle.y,
      Math.min(1, p.muzzleFlash / 0.18), weaponColor);
  }

  ctx.restore();
}

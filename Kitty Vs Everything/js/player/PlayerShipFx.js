// Filename: PlayerShipFx.js
// Kitty Vs Everything — v3.8.0
// Shared cat-ship art FX: front-paw weapon pods, back-paw thruster pods,
// muzzle flashes. Used by both the main hull (PlayerShipArt) and the
// docked minis (PlayerMiniArt).
// v3.3.0: Extracted from PlayerRenderer.js (module split of oversized files).
// v3.8.0: Paws now read as real CAT PAWS — each pad is a fur base over a
//         shared drawPawPads() cluster: heart-shaped main metacarpal pad,
//         3 toe beans, and 3 curved white claw talons (front paws face
//         forward, rear paws face back and grip the thruster nozzle).
//         Pads use theme-independent pink so they read on any theme.
// v3.16.0: drawWeaponPaw reads the weapon animation state (WeaponAnim.js):
//         vulkanSpin spins the twin barrels, railCharge builds an energy
//         glow between the barrels, plasmaPulse pulses an emitter orb at
//         the muzzle. Docked (inert) minis pass anim = {} (no animation).
export const VERSION = 'v3.17.0';
import { TAU } from '../core/utils.js';
import { hexA } from '../core/utils.js';
import { SHIP_GEOMETRY } from '../core/config.js';

// ─── PAW PAD CLUSTER (main pad + toe beans + claws) ─────────────
// dir = -1 → toes point forward (-Y, front weapon paws)
// dir = +1 → toes point back   (+Y, rear thruster paws)
// The main pad is a heart: lobes toward the toes, tip toward the wrist.
function drawPawPads(ctx, px, py, dir) {
  const w = -dir; // wrist direction (main-pad tip points toward the wrist)
  // Main metacarpal pad (heart-shaped, theme-independent pink)
  ctx.fillStyle = '#f2a2ba';
  ctx.strokeStyle = 'rgba(96, 20, 52, 0.28)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(px, py - w * 0.9);
  ctx.bezierCurveTo(px - 3.0, py - w * 2.1, px - 2.5, py + w * 2.3, px, py + w * 3.2);
  ctx.bezierCurveTo(px + 2.5, py + w * 2.3, px + 3.0, py - w * 2.1, px, py - w * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Toe beans (3, arced on the toe side)
  const toes = [[-2.5, 2.3], [0, 3.0], [2.5, 2.3]]; // [dx, toe distance]
  ctx.fillStyle = '#f8bdd1';
  for (const [dx, td] of toes) {
    ctx.beginPath();
    ctx.arc(px + dx, py + dir * td, 1.05, 0, TAU);
    ctx.fill();
  }
  // Claws (short curved white talons extending past the toes)
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  for (const [dx, td] of toes) {
    ctx.beginPath();
    ctx.moveTo(px + dx * 0.9, py + dir * (td - 0.6));
    ctx.quadraticCurveTo(px + dx * 1.15, py + dir * (td + 1.1), px + dx * 1.4, py + dir * (td + 2.0));
    ctx.stroke();
  }
}

// ═══════════════════════════════════════════════════════════
//  FRONT PAW (weapon hardpoint: twin barrels + real cat paw)
// ═══════════════════════════════════════════════════════════
export function drawWeaponPaw(ctx, px, py, c, a, flash, weaponColor, anim = {}) {
  // v3.17.0: weapon animation state (WeaponAnim.js) — vulkanSpin /
  // railCharge / plasmaPulse. Docked minis now mirror the hull's anim.
  const spin = anim.vulkanSpin || 0;
  const charge = anim.railCharge || 0;
  const pulse = anim.plasmaPulse || 0;
  // ─── v3.17.0: OVERSIZED twin gun barrels — the ship's focal point ───
  // Long (SHIP_GEOMETRY.barrelLen, well over half the front arm), thick,
  // and wide-spaced so they read as heavy cannon barrels. The muzzle tip
  // (py - BL) is where bullets spawn (PlayerHardpoints.getMuzzleTipOffsets).
  const BL = SHIP_GEOMETRY.barrelLen; // barrel length (local -Y, ahead of paw)
  const SP = 2.4;                     // half-spacing between the twin barrels
  const BW = 3.5;                     // barrel stroke width
  // v3.16.0: vulkan spin — the twin barrels rotate around the paw center
  const cs = Math.cos(spin), sn = Math.sin(spin);
  const rx = (lx, ly) => px + lx * cs - ly * sn;
  const ry = (lx, ly) => py + lx * sn + ly * cs;
  // Barrel bodies (dark metal)
  ctx.strokeStyle = '#39415c';
  ctx.lineWidth = BW;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(rx(-SP, -1.5), ry(-SP, -1.5)); ctx.lineTo(rx(-SP, -BL), ry(-SP, -BL)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rx(SP, -1.5), ry(SP, -1.5)); ctx.lineTo(rx(SP, -BL), ry(SP, -BL)); ctx.stroke();
  // Barrel highlight (lighter core for a 3D metal read)
  ctx.strokeStyle = '#5a6a8c';
  ctx.lineWidth = BW * 0.38;
  ctx.beginPath(); ctx.moveTo(rx(-SP, -2.2), ry(-SP, -2.2)); ctx.lineTo(rx(-SP, -BL + 1.2), ry(-SP, -BL + 1.2)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rx(SP, -2.2), ry(SP, -2.2)); ctx.lineTo(rx(SP, -BL + 1.2), ry(SP, -BL + 1.2)); ctx.stroke();
  // Muzzle rings (at the barrel tips)
  ctx.fillStyle = '#9fb0cc';
  ctx.beginPath(); ctx.arc(rx(-SP, -BL), ry(-SP, -BL), 1.7, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(rx(SP, -BL), ry(SP, -BL), 1.7, 0, TAU); ctx.fill();
  // Mount ring (dark metal gauntlet) — bigger to cradle the oversized barrels
  ctx.fillStyle = '#232a3d';
  ctx.strokeStyle = hexA(a, 0.7);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(px, py, 7.8, 7.1, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // Paw fur (theme color, cradles the pads)
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(px, py + 0.3, 6.3, 5.5, 0, 0, TAU);
  ctx.fill();
  // Cat paw: main pad + toe beans + claws (toes forward, -Y)
  drawPawPads(ctx, px, py, -1);
  // v3.16.0: rail charge — energy builds between the barrels as it charges
  if (charge > 0.02) {
    const cy = py - BL * 0.55;
    const cg = ctx.createRadialGradient(px, cy, 0, px, cy, 4 + 6 * charge);
    cg.addColorStop(0, hexA(weaponColor, 0.85 * charge));
    cg.addColorStop(1, hexA(weaponColor, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(px, cy, 4 + 6 * charge, 0, TAU);
    ctx.fill();
  }
  // v3.16.0: plasma pulse — emitter orb pulses at the muzzle tip
  if (pulse > 0.02) {
    const my = py - BL;
    const pr = 2.5 + 3.5 * pulse;
    const pg = ctx.createRadialGradient(px, my, 0, px, my, pr * 2.2);
    pg.addColorStop(0, hexA(weaponColor, 0.9 * pulse));
    pg.addColorStop(0.5, hexA(weaponColor, 0.5 * pulse));
    pg.addColorStop(1, hexA(weaponColor, 0));
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, my, pr * 2.2, 0, TAU);
    ctx.fill();
  }
  // Muzzle flash (this hardpoint is firing) — at the barrel tips
  if (flash > 0) {
    drawMuzzleFlash(ctx, px, py - BL, Math.min(1, flash / 0.07), weaponColor);
  }
}

// ═══════════════════════════════════════════════════════════
//  MUZZLE FLASH (radial glow + sparks in the weapon's color)
// ═══════════════════════════════════════════════════════════
export function drawMuzzleFlash(ctx, mx, my, k, color) {
  const r = 7 * (0.6 + 0.4 * k);
  const g = ctx.createRadialGradient(mx, my, 0, mx, my, r);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, hexA(color, 0.85 * k));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(mx, my, r, 0, TAU);
  ctx.fill();
  // Sparks
  ctx.strokeStyle = `rgba(255,255,255,${0.8 * k})`;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const ang = i * TAU / 4 + TAU / 8;
    ctx.beginPath();
    ctx.moveTo(mx + Math.cos(ang) * 2, my + Math.sin(ang) * 2);
    ctx.lineTo(mx + Math.cos(ang) * (4 + 3 * k), my + Math.sin(ang) * (4 + 3 * k));
    ctx.stroke();
  }
}

// ═══════════════════════════════════════════════════════════
//  BACK PAW (thruster rocket pod: nozzle + ember + flame)
// ═══════════════════════════════════════════════════════════
export function drawThrusterPaw(ctx, fx, fy, flicker, flameFlicker, boostGlow, c, a) {
  const thrustOn = flameFlicker > 0;
  // Rocket flame (from the nozzle)
  if (thrustOn) {
    const flameLen = (10 + 8 * flameFlicker) * boostGlow;
    const flameW = 3.5 * (boostGlow > 1 ? 1.25 : 1);
    const base = fy + 5.5;
    const fg = ctx.createLinearGradient(0, base, 0, base + flameLen);
    fg.addColorStop(0, 'rgba(255, 255, 220, 0.95)');
    fg.addColorStop(0.3, 'rgba(255, 180, 50, 0.85)');
    fg.addColorStop(0.7, 'rgba(255, 90, 10, 0.55)');
    fg.addColorStop(1, 'rgba(255, 30, 0, 0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(fx - flameW, base);
    ctx.lineTo(fx, base + flameLen);
    ctx.lineTo(fx + flameW, base);
    ctx.closePath();
    ctx.fill();
    // Hot core
    ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * flameFlicker})`;
    ctx.beginPath();
    ctx.moveTo(fx - flameW * 0.4, base);
    ctx.lineTo(fx, base + flameLen * 0.55);
    ctx.lineTo(fx + flameW * 0.4, base);
    ctx.closePath();
    ctx.fill();
    // Boost halo
    if (boostGlow > 1) {
      const bg = ctx.createRadialGradient(fx, base + 4, 0, fx, base + 4, 12);
      bg.addColorStop(0, 'rgba(255,190,60,0.5)');
      bg.addColorStop(1, 'rgba(255,90,0,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(fx, base + 4, 12, 0, TAU);
      ctx.fill();
    }
  }
  // Nozzle (dark)
  ctx.fillStyle = '#39415c';
  ctx.beginPath();
  ctx.ellipse(fx, fy + 4, 4.5, 3.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#121623';
  ctx.beginPath();
  ctx.ellipse(fx, fy + 4.8, 3, 2.4, 0, 0, TAU);
  ctx.fill();
  // Idle ember glow (engine always hot)
  const eg = ctx.createRadialGradient(fx, fy + 5, 0, fx, fy + 5, 6 * flicker);
  eg.addColorStop(0, `rgba(255, 200, 70, ${0.5 * flicker})`);
  eg.addColorStop(1, 'rgba(255, 80, 0, 0)');
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.ellipse(fx, fy + 5, 5 * flicker, 6 * flicker, 0, 0, TAU);
  ctx.fill();
  // Mount ring
  ctx.fillStyle = '#232a3d';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(fx, fy, 6.2, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // Paw fur (theme color, cradles the pads — overlaps the nozzle lip)
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(fx, fy - 0.3, 5.5, 4.7, 0, 0, TAU);
  ctx.fill();
  // Cat paw: main pad + toe beans + claws (toes back, +Y — gripping the nozzle)
  drawPawPads(ctx, fx, fy, 1);
}


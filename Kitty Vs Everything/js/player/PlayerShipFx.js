// Filename: PlayerShipFx.js
// Kitty Vs Everything — v3.46.0
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
// v3.44.0: vulkan spin pivot fix — barrels now rotate around the center of
//         the barrel assembly (Gatling-style in-place spin) instead of the
//         paw center (which made them orbit like clock hands / weed-whacker).
// v3.46.0: PER-WEAPON PAW HARDPOINT LOOKS — drawWeaponPaw now renders a
//         distinct hardpoint per weapon: vulkan = twin rotating Gatling
//         barrels, plasma = short blue emitter pods, rail = single long
//         charge barrel with coil bands + charge glow. Barrel length is
//         per-weapon (WEAPONS[weapon].barrelLen; vulkan 15 / plasma 10 /
//         rail 22), matching PlayerHardpoints.getMuzzleTipOffsets.
export const VERSION = 'v3.46.0';
import { TAU } from '../core/utils.js';
import { hexA } from '../core/utils.js';
import { SHIP_GEOMETRY, WEAPONS } from '../core/config.js';

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
  // v3.46.0: PER-WEAPON PAW HARDPOINT LOOKS — each weapon reads as a distinct
  // hardpoint on the front paws (vulkan = twin Gatling barrels, plasma = short
  // blue emitter pods, rail = single long charge barrel). Barrel length (local
  // -Y) from the paw to the muzzle tip is per-weapon (WEAPONS[weapon].barrelLen;
  // vulkan 15 / plasma 10 / rail 22), matching PlayerHardpoints.getMuzzleTipOffsets.
  const weapon = anim.weapon || 'vulkan';
  const BL = (WEAPONS[weapon] && WEAPONS[weapon].barrelLen) || SHIP_GEOMETRY.barrelLen;
  // ─── WEAPON-SPECIFIC BARRELS / PODS (drawn first, under the mount ring) ───
  if (weapon === 'plasma') {
    drawPlasmaPods(ctx, px, py, BL, weaponColor);
  } else if (weapon === 'rail') {
    drawRailBarrel(ctx, px, py, BL, weaponColor, charge);
  } else {
    drawVulkanBarrels(ctx, px, py, BL, spin);
  }
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
  // ─── RAIL CHARGE GLOW (charge-up visual at the barrel tip, drawn on top) ───
  if (weapon === 'rail' && charge > 0.02) {
    const cy = py - BL;
    const cg = ctx.createRadialGradient(px, cy, 0, px, cy, 4 + 8 * charge);
    cg.addColorStop(0, hexA('#ffffff', 0.85 * charge));
    cg.addColorStop(0.5, hexA(weaponColor, 0.6 * charge));
    cg.addColorStop(1, hexA(weaponColor, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(px, cy, 4 + 8 * charge, 0, TAU);
    ctx.fill();
  }
  // ─── PLASMA PULSE (emitter glow at both pod tips, drawn on top) ───
  if (weapon === 'plasma' && pulse > 0.02) {
    const pr = 2.5 + 3.5 * pulse;
    for (const sx of [-3.2, 3.2]) {
      const my = py - BL;
      const mg = ctx.createRadialGradient(px + sx, my, 0, px + sx, my, pr * 2.2);
      mg.addColorStop(0, hexA(weaponColor, 0.9 * pulse));
      mg.addColorStop(0.5, hexA(weaponColor, 0.5 * pulse));
      mg.addColorStop(1, hexA(weaponColor, 0));
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(px + sx, my, pr * 2.2, 0, TAU);
      ctx.fill();
    }
  }
  // Muzzle flash (this hardpoint is firing) — at the barrel tips
  if (flash > 0) {
    drawMuzzleFlash(ctx, px, py - BL, Math.min(1, flash / 0.07), weaponColor);
  }
}

// ─── v3.46.0: VULKAN — twin rotating Gatling barrels ───
function drawVulkanBarrels(ctx, px, py, BL, spin) {
  const SP = 2.4;   // half-spacing between the twin barrels
  const BW = 3.5;   // barrel stroke width
  // v3.44.0: PIVOT FIX — anchor the spin at the CENTER of the barrel assembly
  // (midpoint of the drawn barrels, local y = -(BL + 1.5)/2) instead of the
  // paw center, so the barrels spin locally in place like a multi-barrel
  // Gatling. Rest pose (spin = 0) is unchanged: (±SP, -1.5) → (±SP, -BL).
  const BL_HALF = (BL + 1.5) / 2;
  const cs = Math.cos(spin), sn = Math.sin(spin);
  const rx = (lx, ly) => px + lx * cs - (ly + BL_HALF) * sn;
  const ry = (lx, ly) => py - BL_HALF + lx * sn + (ly + BL_HALF) * cs;
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
}

// ─── v3.46.0: PLASMA — short blue emitter pods (twin) ───
function drawPlasmaPods(ctx, px, py, BL, weaponColor) {
  const SP = 3.2;   // half-spacing between the twin pods
  const PW = 4.6;   // pod width
  for (const sx of [-SP, SP]) {
    const cx = px + sx;
    const topY = py - BL;
    // Pod body (rounded top) — plain rect + arc (no global roundRect helper)
    ctx.fillStyle = '#1c2540';
    ctx.beginPath();
    ctx.moveTo(cx - PW / 2, py);
    ctx.lineTo(cx - PW / 2, topY + PW / 2);
    ctx.arc(cx, topY + PW / 2, PW / 2, Math.PI, 0);
    ctx.lineTo(cx + PW / 2, py);
    ctx.closePath();
    ctx.fill();
    // Glowing emitter core (blue) at the pod mouth
    ctx.fillStyle = hexA(weaponColor, 0.9);
    ctx.beginPath();
    ctx.arc(cx, topY + PW / 2, PW * 0.34, 0, TAU);
    ctx.fill();
    // Core highlight
    ctx.fillStyle = hexA('#ffffff', 0.75);
    ctx.beginPath();
    ctx.arc(cx, topY + PW / 2, PW * 0.15, 0, TAU);
    ctx.fill();
  }
}

// ─── v3.46.0: RAIL — single long charge barrel with coil bands ───
function drawRailBarrel(ctx, px, py, BL, weaponColor, charge) {
  const BW = 4.0;   // barrel width
  // Barrel body (dark metal, single central barrel)
  ctx.strokeStyle = '#39415c';
  ctx.lineWidth = BW;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px, py - 1.5); ctx.lineTo(px, py - BL); ctx.stroke();
  // Barrel highlight (lighter core)
  ctx.strokeStyle = '#5a6a8c';
  ctx.lineWidth = BW * 0.38;
  ctx.beginPath(); ctx.moveTo(px, py - 2.2); ctx.lineTo(px, py - BL + 1.2); ctx.stroke();
  // Muzzle ring (at the barrel tip)
  ctx.fillStyle = '#9fb0cc';
  ctx.beginPath(); ctx.arc(px, py - BL, 2.0, 0, TAU); ctx.fill();
  // Charge coil bands (rail-specific; brighten as the cannon charges)
  ctx.strokeStyle = hexA(weaponColor, 0.3 + 0.5 * charge);
  ctx.lineWidth = 1.2;
  for (let i = 1; i <= 3; i++) {
    const by = py - BL * (i / 4);
    ctx.beginPath();
    ctx.moveTo(px - BW / 2 - 0.8, by);
    ctx.lineTo(px + BW / 2 + 0.8, by);
    ctx.stroke();
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


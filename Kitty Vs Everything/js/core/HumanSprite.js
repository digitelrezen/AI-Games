// Filename: HumanSprite.js
// Kitty Vs Everything — v3.13.0
// Procedural humanoid art for the Bone Yard humans (and the regular wave
// "human" enemy) — replaces the old spaceship placeholder (v3.13.0).
// Front-facing chibi people that WALK (leg/arm swing cycle + body bob),
// holding a small rifle aimed at the player.
// Variety:
//   • 4 distinct SHIRT color variants (SHIRT_VARIANTS)
//   • 6 HAIR colors + 3 hair styles + 4 skin tones (randomized per spawn)
// Everything is drawn procedurally in game coordinates (no image assets),
// scaled by `r` (the enemy's hitbox radius, 16 for a mob-tier human).
//
// Coordinate convention (origin = enemy center):
//   head ≈ y -0.75r … +0.15r · torso y -0.15r … +0.55r · legs to +1.15r
// Total silhouette ≈ 1.9r wide × 2.6r tall (~32×42 px at r = 16).
export const VERSION = 'v3.13.0';
import { TAU, rand, pick } from './utils.js';

/** 4 distinct shirt color variants (base + darker shade for shading). */
export const SHIRT_VARIANTS = [
  { id: 'crimson', base: '#d64545', dark: '#8f2626', name: 'Crimson' },
  { id: 'forest',  base: '#3f9d4f', dark: '#24602f', name: 'Forest' },
  { id: 'royal',   base: '#3d6fb4', dark: '#26477a', name: 'Royal' },
  { id: 'mustard', base: '#e8b62c', dark: '#9c761a', name: 'Mustard' },
];

/** Diverse hair colors. */
export const HAIR_COLORS = [
  '#232323', // black
  '#4a2c17', // dark brown
  '#7a4a21', // brown
  '#e8c15a', // blonde
  '#c0392b', // red
  '#9e9e9e', // grey
];

/** Skin tones. */
export const SKIN_TONES = ['#ffd7b3', '#f0c090', '#c89060', '#8d5a3a'];

/** Hair styles (drawn variants). */
export const HAIR_STYLES = ['short', 'side', 'mohawk'];

/** Random outfit: { shirt, hair, skin, hairStyle } — pick once per spawn. */
export function randomOutfit() {
  return {
    shirt: pick(SHIRT_VARIANTS),
    hair: pick(HAIR_COLORS),
    skin: pick(SKIN_TONES),
    hairStyle: pick(HAIR_STYLES),
  };
}

/**
 * Draw the humanoid. The caller must already be translated to (x, y).
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o
 *   o.r          — hitbox radius (scales the whole figure)
 *   o.outfit     — { shirt, hair, skin, hairStyle } from randomOutfit()
 *   o.walkPhase  — walk-cycle phase in radians (advance ≈ 6×dt while moving)
 *   o.flash      — hit-flash timer (>0 → translucent white blink)
 *   o.aim        — optional angle (rad) the held rifle points at (default π/2 = down)
 */
export function drawHuman(ctx, o) {
  const r = o.r;
  const walk = o.walkPhase || 0;
  const swing = Math.sin(walk);          // -1..1 leg swing
  const bob = Math.abs(Math.sin(walk)) * 0.06 * r; // body bob (feet stay planted)
  const aim = o.aim ?? Math.PI / 2;
  const skin = o.outfit.skin;
  const hair = o.outfit.hair;
  const shirt = o.outfit.shirt;

  ctx.save();
  if (o.flash > 0) ctx.globalAlpha = 0.55;
  ctx.translate(0, bob);

  // ─── LEGS (pants, alternating step) ───
  const hipY = r * 0.48;
  const footL = r * (0.16 + swing * 0.14);
  const footR = r * (-0.16 - swing * 0.14);
  const liftL = Math.max(0, -swing) * 0.10 * r; // front leg lifts slightly
  const liftR = Math.max(0, swing) * 0.10 * r;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#37474f';
  ctx.lineWidth = r * 0.20;
  ctx.beginPath(); ctx.moveTo(-r * 0.14, hipY); ctx.lineTo(footL, r * 1.05 - liftL); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r * 0.14, hipY);  ctx.lineTo(footR, r * 1.05 - liftR); ctx.stroke();
  // Shoes
  ctx.fillStyle = '#212121';
  ctx.beginPath(); ctx.ellipse(footL, r * 1.08 - liftL, r * 0.14, r * 0.07, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(footR, r * 1.08 - liftR, r * 0.14, r * 0.07, 0, 0, TAU); ctx.fill();

  // ─── TORSO (shirt) ───
  const torsoGrad = ctx.createLinearGradient(-r * 0.38, 0, r * 0.38, 0);
  torsoGrad.addColorStop(0, shirt.dark);
  torsoGrad.addColorStop(0.5, shirt.base);
  torsoGrad.addColorStop(1, shirt.dark);
  ctx.fillStyle = torsoGrad;
  roundRect(ctx, -r * 0.36, -r * 0.18, r * 0.72, r * 0.72, r * 0.14);
  ctx.fill();
  // Collar
  ctx.fillStyle = shirt.dark;
  ctx.beginPath();
  ctx.moveTo(-r * 0.16, -r * 0.18); ctx.lineTo(0, r * 0.02); ctx.lineTo(r * 0.16, -r * 0.18);
  ctx.closePath(); ctx.fill();

  // ─── ARMS (shirt sleeves, swinging; right arm holds the rifle) ───
  const armSwingL = -swing * 0.12 * r;
  ctx.strokeStyle = shirt.base;
  ctx.lineWidth = r * 0.17;
  // Left arm swings free
  ctx.beginPath();
  ctx.moveTo(-r * 0.40, -r * 0.05);
  ctx.lineTo(-r * 0.52, r * 0.34 + armSwingL);
  ctx.stroke();
  // Left hand
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(-r * 0.52, r * 0.40 + armSwingL, r * 0.10, 0, TAU); ctx.fill();
  // Right arm (static, gripping the rifle)
  ctx.beginPath();
  ctx.moveTo(r * 0.40, -r * 0.05);
  ctx.lineTo(r * 0.30, r * 0.30);
  ctx.stroke();

  // ─── RIFLE (small, aimed at the player) ───
  ctx.save();
  ctx.translate(r * 0.30, r * 0.30);
  ctx.rotate(aim - Math.PI / 2); // aim π/2 (down) = unrotated
  ctx.fillStyle = '#263238';
  ctx.fillRect(-r * 0.05, -r * 0.08, r * 0.10, r * 0.55);   // barrel
  ctx.fillRect(-r * 0.10, r * 0.10, r * 0.20, r * 0.22);    // receiver
  ctx.fillRect(-r * 0.06, r * 0.30, r * 0.12, r * 0.16);    // magazine
  ctx.fillStyle = '#546e7a';
  ctx.fillRect(-r * 0.03, -r * 0.10, r * 0.06, r * 0.12);   // sight
  ctx.restore();
  // Right hand over the grip
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(r * 0.30, r * 0.30, r * 0.10, 0, TAU); ctx.fill();

  // ─── HEAD ───
  const headY = -r * 0.52;
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0, headY, r * 0.34, 0, TAU); ctx.fill();
  // Ears
  ctx.beginPath(); ctx.arc(-r * 0.34, headY + r * 0.02, r * 0.07, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.34, headY + r * 0.02, r * 0.07, 0, TAU); ctx.fill();

  // ─── HAIR (3 styles) ───
  ctx.fillStyle = hair;
  if (o.outfit.hairStyle === 'short') {
    // Simple cap over the top
    ctx.beginPath();
    ctx.arc(0, headY, r * 0.355, Math.PI, TAU);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(-r * 0.355, headY - r * 0.06, r * 0.71, r * 0.06);
  } else if (o.outfit.hairStyle === 'side') {
    // Side-swept bangs (part on the left)
    ctx.beginPath();
    ctx.arc(0, headY, r * 0.355, Math.PI * 1.05, TAU - 0.15);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.34, headY - r * 0.10);
    ctx.quadraticCurveTo(r * 0.05, headY - r * 0.52, r * 0.36, headY - r * 0.06);
    ctx.quadraticCurveTo(r * 0.10, headY - r * 0.22, -r * 0.34, headY - r * 0.10);
    ctx.closePath(); ctx.fill();
  } else {
    // Mohawk
    ctx.beginPath();
    ctx.arc(0, headY, r * 0.355, Math.PI, TAU);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(-r * 0.18, headY - r * 0.05, r * 0.17, Math.PI, TAU * 0.9);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.18, headY - r * 0.05, r * 0.17, TAU * 0.1, TAU * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.moveTo(-r * 0.10, headY - r * 0.32);
    ctx.lineTo(-r * 0.04, headY - r * 0.62);
    ctx.lineTo(0.06 * r, headY - r * 0.34);
    ctx.lineTo(r * 0.12, headY - r * 0.58);
    ctx.lineTo(r * 0.20, headY - r * 0.30);
    ctx.lineTo(r * 0.05, headY - r * 0.28);
    ctx.closePath(); ctx.fill();
  }

  // ─── FACE (eyes + brows, looking down at the player) ───
  const eyeY = headY + r * 0.02;
  ctx.fillStyle = '#263238';
  ctx.beginPath(); ctx.arc(-r * 0.13, eyeY, r * 0.045, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.13, eyeY, r * 0.045, 0, TAU); ctx.fill();
  // Angry-ish brows (they're coming for the cat)
  ctx.strokeStyle = hair;
  ctx.lineWidth = r * 0.05;
  ctx.beginPath(); ctx.moveTo(-r * 0.21, eyeY - r * 0.09); ctx.lineTo(-r * 0.06, eyeY - r * 0.045); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r * 0.21, eyeY - r * 0.09);  ctx.lineTo(r * 0.06, eyeY - r * 0.045);  ctx.stroke();
  // Mouth
  ctx.strokeStyle = '#8d5a3a';
  ctx.lineWidth = r * 0.045;
  ctx.beginPath();
  ctx.moveTo(-r * 0.08, headY + r * 0.17);
  ctx.lineTo(r * 0.08, headY + r * 0.17);
  ctx.stroke();

  ctx.restore();
}

/** Rounded-rect path helper (kept local — not in utils.js by design). */
function roundRect(ctx, x, y, w, h, rad) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

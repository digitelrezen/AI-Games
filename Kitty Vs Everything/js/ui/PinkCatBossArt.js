// Filename: PinkCatBossArt.js
// Kitty Vs Everything — v3.13.0
// "The Internet" boss art (v3.13.0 redesign): a CUTE FEMALE chibi cat in a
// pink & white color scheme, drawn at the SMALL scale of the trash/crate
// models in the game world (hitbox radius 18 = PowerUp crate radius;
// silhouette ≈ 30 px tall — the boss bar and glow keep the "boss" read).
// Female cues: hair bow, long lower lashes, blushing cheeks, tiny "w" mouth.
// Pure drawing module (no game state) — PinkCatEnemy.js calls
// drawPinkCatBoss() from its draw(). All boss abilities / HP pools /
// attack patterns live in PinkCatEnemy.js and are unchanged by the scale.
export const VERSION = 'v3.13.0';
import { TAU } from '../core/utils.js';

/** Pink & white palette. */
export const PINK_CAT_PALETTE = {
  pink: '#ff69b4',       // main body
  pinkLight: '#ffb6d9',  // highlights / ears
  pinkDeep: '#e0409a',   // shade / outline
  white: '#fff5fa',      // chest / muzzle / paws / tail tip
  blush: '#ff8fbf',
  bow: '#e91e63',
  eye: '#ad1457',
};

/**
 * Draw the small female Pink Cat boss. Caller must be translated to
 * (x, y); the figure is drawn centered on the origin, nose up.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o
 *   o.r     — hitbox radius (18 at boss tier — trash scale)
 *   o.t     — enemy time (s) for tail/heart animation
 *   o.flash — hit-flash timer (>0 → translucent blink)
 *   o.hpFrac— 0..1 (below 0.35 the cat's eyes go wide = "enraged")
 */
export function drawPinkCatBoss(ctx, o) {
  const r = o.r;
  const t = o.t || 0;
  const P = PINK_CAT_PALETTE;
  ctx.save();
  if (o.flash > 0) ctx.globalAlpha = 0.55;

  // ─── SOFT PINK AURA (small, boss glow + drifting hearts) ───
  const pulse = 0.28 + 0.18 * Math.sin(t * 2.4);
  ctx.globalAlpha = (o.flash > 0 ? 0.3 : 1) * pulse;
  ctx.strokeStyle = P.pink;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = P.pink;
  ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.25, 0, TAU); ctx.stroke();
  ctx.shadowBlur = 0;
  for (let i = 0; i < 3; i++) {
    const ha = t * 1.2 + (i / 3) * TAU;
    const hx = Math.cos(ha) * r * 1.15;
    const hy = Math.sin(ha * 1.3) * r * 0.9 - r * 0.2;
    drawHeart(ctx, hx, hy, r * 0.11, P.blush, 0.5 + 0.3 * Math.sin(t * 3 + i));
  }
  ctx.globalAlpha = o.flash > 0 ? 0.55 : 1;

  // ─── TAIL (fluffy pink, white tip, waving behind) ───
  const tailWave = Math.sin(t * 3) * r * 0.25;
  ctx.strokeStyle = P.pink;
  ctx.lineWidth = r * 0.22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(r * 0.30, r * 0.55);
  ctx.bezierCurveTo(
    r * 0.75, r * 0.65 + tailWave,
    r * 0.95, r * 0.10 - tailWave,
    r * 0.90, -r * 0.15 + tailWave * 0.5
  );
  ctx.stroke();
  ctx.fillStyle = P.white;
  ctx.beginPath();
  ctx.arc(r * 0.90, -r * 0.15 + tailWave * 0.5, r * 0.13, 0, TAU);
  ctx.fill();

  // ─── BODY (small chibi, pink with white chest) ───
  const bodyGrad = ctx.createRadialGradient(0, r * 0.35, r * 0.05, 0, r * 0.45, r * 0.55);
  bodyGrad.addColorStop(0, P.pinkLight);
  bodyGrad.addColorStop(0.65, P.pink);
  bodyGrad.addColorStop(1, P.pinkDeep);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.45, r * 0.40, r * 0.42, 0, 0, TAU);
  ctx.fill();
  // White chest/belly
  ctx.fillStyle = P.white;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.52, r * 0.24, r * 0.28, 0, 0, TAU);
  ctx.fill();
  // Faint pink stripes on the sides
  ctx.strokeStyle = 'rgba(224, 64, 154, 0.45)';
  ctx.lineWidth = r * 0.06;
  ctx.beginPath(); ctx.moveTo(-r * 0.34, r * 0.30); ctx.quadraticCurveTo(-r * 0.24, r * 0.34, -r * 0.30, r * 0.42); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r * 0.34, r * 0.30);  ctx.quadraticCurveTo(r * 0.24, r * 0.34, r * 0.30, r * 0.42);  ctx.stroke();

  // ─── HEAD (big, round — chibi proportion) ───
  const headY = -r * 0.35;
  const headR = r * 0.44;
  const headGrad = ctx.createRadialGradient(-r * 0.1, headY - r * 0.15, r * 0.05, 0, headY, headR * 1.2);
  headGrad.addColorStop(0, P.pinkLight);
  headGrad.addColorStop(0.7, P.pink);
  headGrad.addColorStop(1, P.pinkDeep);
  ctx.fillStyle = headGrad;
  ctx.beginPath(); ctx.arc(0, headY, headR, 0, TAU); ctx.fill();
  // White muzzle patch (lower face)
  ctx.fillStyle = P.white;
  ctx.beginPath();
  ctx.ellipse(0, headY + headR * 0.42, headR * 0.55, headR * 0.42, 0, 0, TAU);
  ctx.fill();

  // ─── EARS (rounded, pink outer / white inner, white tips) ───
  drawEar(ctx, -r * 0.30, headY - headR * 0.62, r, -0.35, P);
  drawEar(ctx, r * 0.30, headY - headR * 0.62, r, 0.35, P);

  // ─── HAIR BOW (female cue — perched above the right ear) ───
  drawBow(ctx, r * 0.42, headY - headR * 1.25, r * 0.16, t);

  // ─── EYES (big, sparkly, with long lower lashes) ───
  const eyeDX = r * 0.185, eyeY = headY - r * 0.02;
  const wide = (o.hpFrac ?? 1) < 0.35; // enraged = wider eyes
  const eyeH = r * (wide ? 0.15 : 0.125);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(-eyeDX, eyeY, r * 0.115, eyeH, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(eyeDX, eyeY, r * 0.115, eyeH, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = P.eye;
  ctx.beginPath(); ctx.ellipse(-eyeDX, eyeY + r * 0.015, r * 0.075, eyeH * 0.72, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(eyeDX, eyeY + r * 0.015, r * 0.075, eyeH * 0.72, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2b0a1e';
  ctx.beginPath(); ctx.ellipse(-eyeDX, eyeY + r * 0.02, r * 0.038, eyeH * 0.45, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(eyeDX, eyeY + r * 0.02, r * 0.038, eyeH * 0.45, 0, 0, TAU); ctx.fill();
  // Sparkles
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-eyeDX - r * 0.02, eyeY - r * 0.01, r * 0.028, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(eyeDX - r * 0.02, eyeY - r * 0.01, r * 0.028, 0, TAU); ctx.fill();
  // Lower lashes (3 per eye — the "makeup")
  ctx.strokeStyle = P.pinkDeep;
  ctx.lineWidth = r * 0.028;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-eyeDX + i * r * 0.05, eyeY + eyeH + r * 0.01);
    ctx.lineTo(-eyeDX + i * r * 0.07, eyeY + eyeH + r * 0.055);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(eyeDX + i * r * 0.05, eyeY + eyeH + r * 0.01);
    ctx.lineTo(eyeDX + i * r * 0.07, eyeY + eyeH + r * 0.055);
    ctx.stroke();
  }

  // ─── NOSE + MOUTH (tiny pink triangle, cute "w") ───
  ctx.fillStyle = P.pinkDeep;
  ctx.beginPath();
  ctx.moveTo(0, headY + headR * 0.28);
  ctx.lineTo(-r * 0.035, headY + headR * 0.38);
  ctx.lineTo(r * 0.035, headY + headR * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = P.pinkDeep;
  ctx.lineWidth = r * 0.045;
  ctx.beginPath();
  ctx.moveTo(-r * 0.10, headY + headR * 0.52);
  ctx.quadraticCurveTo(-r * 0.05, headY + headR * 0.66, 0, headY + headR * 0.52);
  ctx.quadraticCurveTo(r * 0.05, headY + headR * 0.66, r * 0.10, headY + headR * 0.52);
  ctx.stroke();

  // ─── BLUSH (soft pink cheeks) ───
  ctx.globalAlpha = (o.flash > 0 ? 0.55 : 1) * 0.4;
  ctx.fillStyle = P.blush;
  ctx.beginPath(); ctx.ellipse(-r * 0.32, headY + headR * 0.30, r * 0.09, r * 0.05, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.32, headY + headR * 0.30, r * 0.09, r * 0.05, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = o.flash > 0 ? 0.55 : 1;

  // ─── WHISKERS (faint) ───
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = r * 0.025;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.26, headY + headR * 0.35 + i * r * 0.07);
    ctx.lineTo(-r * 0.52, headY + headR * 0.28 + i * r * 0.10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.26, headY + headR * 0.35 + i * r * 0.07);
    ctx.lineTo(r * 0.52, headY + headR * 0.28 + i * r * 0.10);
    ctx.stroke();
  }

  // ─── PAWS (small white, toe lines) ───
  ctx.fillStyle = P.white;
  ctx.beginPath(); ctx.ellipse(-r * 0.18, r * 0.86, r * 0.11, r * 0.07, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.18, r * 0.86, r * 0.11, r * 0.07, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(224, 64, 154, 0.5)';
  ctx.lineWidth = r * 0.02;
  ctx.beginPath(); ctx.moveTo(-r * 0.20, r * 0.84); ctx.lineTo(-r * 0.20, r * 0.88); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r * 0.16, r * 0.84); ctx.lineTo(-r * 0.16, r * 0.88); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r * 0.16, r * 0.84);  ctx.lineTo(r * 0.16, r * 0.88);  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r * 0.20, r * 0.84);  ctx.lineTo(r * 0.20, r * 0.88);  ctx.stroke();

  ctx.restore();
}

/** One rounded ear (outer pink, inner white, white tip). */
function drawEar(ctx, x, y, r, lean, P) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.fillStyle = P.pink;
  ctx.beginPath();
  ctx.moveTo(-r * 0.16, r * 0.18);
  ctx.quadraticCurveTo(-r * 0.10, -r * 0.16, 0, -r * 0.20);
  ctx.quadraticCurveTo(r * 0.10, -r * 0.16, r * 0.16, r * 0.18);
  ctx.closePath();
  ctx.fill();
  // Inner ear
  ctx.fillStyle = P.white;
  ctx.beginPath();
  ctx.moveTo(-r * 0.08, r * 0.10);
  ctx.quadraticCurveTo(-r * 0.05, -r * 0.08, 0, -r * 0.10);
  ctx.quadraticCurveTo(r * 0.05, -r * 0.08, r * 0.08, r * 0.10);
  ctx.closePath();
  ctx.fill();
  // White tip
  ctx.fillStyle = P.white;
  ctx.beginPath();
  ctx.arc(0, -r * 0.155, r * 0.05, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Hair bow (two loops + knot) with a gentle sway. */
function drawBow(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 2.2) * 0.12);
  ctx.fillStyle = PINK_CAT_PALETTE.bow;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-s * 1.6, -s * 0.9, -s * 1.5, s * 0.1);
  ctx.quadraticCurveTo(-s * 1.4, s * 0.8, 0, s * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(s * 1.6, -s * 0.9, s * 1.5, s * 0.1);
  ctx.quadraticCurveTo(s * 1.4, s * 0.8, 0, s * 0.25);
  ctx.closePath();
  ctx.fill();
  // Knot
  ctx.fillStyle = PINK_CAT_PALETTE.pinkDeep;
  ctx.beginPath();
  ctx.arc(0, s * 0.1, s * 0.42, 0, TAU);
  ctx.fill();
  // Shine
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.7, -s * 0.15, s * 0.28, s * 0.14, -0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Tiny filled heart (aura motif). v3.32.0: exported — PinkCatEnemy.js
 *  draws the drifting hearts around the generated sprite. */
export function drawHeart(ctx, x, y, s, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.9);
  ctx.bezierCurveTo(-s * 1.1, s * 0.1, -s * 0.7, -s * 0.9, 0, -s * 0.25);
  ctx.bezierCurveTo(s * 0.7, -s * 0.9, s * 1.1, s * 0.1, 0, s * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

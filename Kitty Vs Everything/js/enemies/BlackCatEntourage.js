// Filename: BlackCatEntourage.js
// Kitty Vs Everything — v3.29.0
// Black Cat entourage accessories (Internet Bonus): chunky old-school gold
// chain necklaces with LARGE, ICED-OUT digital clock pendants.
//
// Pure drawing module (no game state) — BlackCatEnemy.js calls
// drawEntourageOutfit() from its draw() when `entourage` is set (the 8
// orbiting cats of the Internet Bonus). The pendant's 12-hour h:MM AM/PM
// display is read from RealTimeClock.js (the real-time clock sync loop) —
// this module never touches Date itself.
//
// All coordinates are cat-local (the caller is translated to the cat and
// carries the skinny/tall scale), so the outfit squashes/stretches with
// the silhouette. Animations: chain sway, pendant swing, ice twinkle,
// LCD colon blink.
export const VERSION = 'v3.29.0';
import { TAU } from '../core/utils.js';
import { realTimeClock } from '../core/RealTimeClock.js';

/** Gold / ice / LCD palette for the entourage accessories. */
export const GOLD_PALETTE = {
  gold: '#ffd700',
  goldLight: '#fff3a0',
  goldDeep: '#b8860b',
  goldDark: '#7a5200',
  ice: '#e8faff',
  lcd: '#0a1408',
  lcdGlow: '#39ff14',
};

/**
 * Draw the full entourage outfit: chunky gold chain + iced-out digital
 * clock pendant (real local time from RealTimeClock.js).
 * @param {CanvasRenderingContext2D} ctx — translated to the cat's (x, y)
 * @param {object} o
 *   o.r     — cat hitbox radius
 *   o.t     — enemy time (s) for chain sway / pendant swing / ice twinkle
 *   o.phase — per-cat animation phase offset (radians)
 *   o.flash — hit-flash timer (>0 → translucent, matches the cat)
 */
export function drawEntourageOutfit(ctx, o) {
  const r = o.r;
  const t = (o.t || 0) + (o.phase || 0);
  ctx.save();
  if (o.flash > 0) ctx.globalAlpha = 0.4;

  // ─── CHUNKY GOLD CHAIN (cuban links, V-drape from neck to chest) ───
  drawGoldChain(ctx, r, t);

  // ─── ICED-OUT DIGITAL CLOCK PENDANT (hangs from the V bottom) ───
  const sway = Math.sin(t * 1.6 + 0.35) * 0.09; // gentle swing, lags the chain
  ctx.save();
  ctx.translate(0, r * 0.46);
  ctx.rotate(sway);
  drawClockPendant(ctx, r, t);
  ctx.restore();

  ctx.restore();
}

/**
 * Chunky old-school gold chain: interlocking oval links (cuban-link
 * style) draped in a V from the shoulders to the chest, with a subtle
 * sway. Drawn in cat-local coordinates.
 */
function drawGoldChain(ctx, r, t) {
  const P = GOLD_PALETTE;
  // Chain path: left shoulder → swaying chest bottom → right shoulder
  const x0 = -r * 0.30, y0 = -r * 0.04;
  const xm = Math.sin(t * 1.6) * r * 0.03, ym = r * 0.46;
  const x1 = r * 0.30,  y1 = -r * 0.04;
  const N = 10; // chunky links
  const linkR = r * 0.075;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    const x = a * x0 + b * xm + c * x1;
    const y = a * y0 + b * ym + c * y1;
    // Bezier tangent → link orientation
    const dx = 2 * (1 - u) * (xm - x0) + 2 * u * (x1 - xm);
    const dy = 2 * (1 - u) * (ym - y0) + 2 * u * (y1 - ym);
    const ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(x, y);
    // Alternate link orientation for the interlocking look
    ctx.rotate(ang + (i % 2 ? Math.PI / 2 : 0));
    const grad = ctx.createLinearGradient(-linkR, -linkR, linkR, linkR);
    grad.addColorStop(0, P.goldLight);
    grad.addColorStop(0.5, P.gold);
    grad.addColorStop(1, P.goldDeep);
    ctx.strokeStyle = grad;
    ctx.lineWidth = r * 0.045;
    ctx.shadowColor = P.gold;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, linkR, linkR * 0.62, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Large iced-out digital clock pendant: gold bail, chunky gold bezel
 * studded with twinkling "ice", dark LCD screen, and a 7-segment 12-hour
 * h:MM display + small AM/PM label fed by the real-time clock
 * (RealTimeClock.js). Drawn in cat-local coordinates with the bail centered
 * on the origin (the chain V bottom).
 */
function drawClockPendant(ctx, r, t) {
  const P = GOLD_PALETTE;
  const sw = r * 0.95;  // LCD screen width
  const sh = r * 0.42;  // LCD screen height
  const bez = r * 0.10; // bezel border
  const bw = sw + bez * 2;
  const bh = sh + bez * 2;
  const bailR = r * 0.07;
  const top = bailR * 0.6;

  // ─── BAIL (gold loop the chain passes through) ───
  ctx.strokeStyle = P.gold;
  ctx.lineWidth = r * 0.045;
  ctx.shadowColor = P.gold;
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(0, 0, bailR, 0, TAU);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ─── BEZEL (chunky gold) ───
  const grad = ctx.createLinearGradient(-bw / 2, top, bw / 2, top + bh);
  grad.addColorStop(0, P.goldLight);
  grad.addColorStop(0.45, P.gold);
  grad.addColorStop(1, P.goldDeep);
  ctx.fillStyle = grad;
  ctx.shadowColor = P.gold;
  ctx.shadowBlur = 6;
  roundRect(ctx, -bw / 2, top, bw, bh, r * 0.10);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Inner rim
  ctx.strokeStyle = P.goldDark;
  ctx.lineWidth = r * 0.02;
  roundRect(ctx, -bw / 2 + r * 0.025, top + r * 0.025, bw - r * 0.05, bh - r * 0.05, r * 0.07);
  ctx.stroke();

  // ─── ICE (diamond studs around the bezel, twinkling) ───
  drawIceStuds(ctx, bw, bh, top, r, t);

  // ─── LCD SCREEN (dark) ───
  const sx = -sw / 2, sy = top + bez;
  const lcdGrad = ctx.createLinearGradient(0, sy, 0, sy + sh);
  lcdGrad.addColorStop(0, '#0d1a0c');
  lcdGrad.addColorStop(1, '#040804');
  ctx.fillStyle = lcdGrad;
  roundRect(ctx, sx, sy, sw, sh, r * 0.05);
  ctx.fill();

  // ─── DIGITAL TIME (player's real local 12-hour h:MM + AM/PM, kept live) ───
  // v3.29.0: 12-hour format — digits right-aligned in the 5 slots (blank
  // leading slot for 1-9 o'clock) with a small AM/PM label in the reserved
  // right-hand zone (7-segment can't render A/M/P, so it's plain LCD text).
  const h12mm = realTimeClock.getH12MM(); // "h:MM" (4) or "hh:MM" (5)
  const mer = realTimeClock.getMeridiem(); // "AM" / "PM"
  const blinkOn = realTimeClock.getSeconds() % 2 === 0;
  const pad = sw * 0.09;
  const merW = sw * 0.26; // right-hand AM/PM text zone
  const slot = (sw - pad * 2 - merW) / 5; // 4 digits + colon
  const dw = slot * 0.72;
  const dh = sh * 0.62;
  const dy = sy + (sh - dh) / 2;
  const startSlot = 5 - h12mm.length; // right-align the digits
  ctx.fillStyle = P.lcdGlow;
  ctx.shadowColor = P.lcdGlow;
  ctx.shadowBlur = 3;
  for (let i = 0; i < h12mm.length; i++) {
    const ch = h12mm[i];
    const cx = sx + pad + (startSlot + i) * slot + (slot - dw) / 2;
    if (ch === ':') {
      if (blinkOn) {
        const cw = dw * 0.35;
        ctx.fillRect(cx + (dw - cw) / 2, dy + dh * 0.18, cw, cw);
        ctx.fillRect(cx + (dw - cw) / 2, dy + dh * 0.62, cw, cw);
      }
    } else {
      draw7SegDigit(ctx, ch, cx, dy, dw, dh);
    }
  }
  // AM/PM — small LCD text, right-aligned in the reserved zone (font/text
  // state is restored by the caller's ctx.save()/restore()).
  ctx.font = `bold ${Math.max(3, sh * 0.32)}px 'Courier New', monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(mer, sx + sw - pad * 0.5, sy + sh * 0.5);
  ctx.shadowBlur = 0;
}

/** Diamond "ice" studs around the bezel border, each twinkling on its
 *  own phase (the iced-out sparkle). */
function drawIceStuds(ctx, bw, bh, top, r, t) {
  const P = GOLD_PALETTE;
  const s = r * 0.04; // stud half-size
  let i = 0;
  const stud = (x, y) => {
    const tw = 0.5 + 0.5 * Math.sin(t * 4 + i * 1.7);
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * tw;
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = P.ice;
    ctx.shadowColor = '#bfefff';
    ctx.shadowBlur = 2 + 3 * tw;
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.restore();
    i++;
  };
  const n = 5;
  for (let k = 0; k < n; k++) {
    const u = (k + 0.5) / n;
    stud(-bw / 2 + bw * u, top + r * 0.05);
    stud(-bw / 2 + bw * u, top + bh - r * 0.05);
  }
  const m = 2;
  for (let k = 0; k < m; k++) {
    const u = (k + 0.5) / m;
    stud(-bw / 2 + r * 0.05, top + bh * u);
    stud(bw / 2 - r * 0.05, top + bh * u);
  }
}

/** 7-segment digit maps (classic digital-clock layout). */
const SEG_MAP = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'fgcd',
  '6': 'fgcde',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcfgd',
};

/**
 * Draw one 7-segment digit. (x, y) = top-left of the digit cell;
 * (w, h) = cell size. Fills with the caller's current fillStyle.
 */
function draw7SegDigit(ctx, ch, x, y, w, h) {
  const segs = SEG_MAP[ch];
  if (!segs) return;
  const t = Math.max(1, Math.min(w, h) * 0.16); // segment thickness
  const seg = (id) => {
    if (!segs.includes(id)) return;
    ctx.beginPath();
    switch (id) {
      case 'a': ctx.rect(x + t * 0.5, y, w - t, t); break;
      case 'b': ctx.rect(x + w - t, y + t * 0.5, t, h * 0.5 - t * 0.5); break;
      case 'c': ctx.rect(x + w - t, y + h * 0.5, t, h * 0.5 - t * 0.5); break;
      case 'd': ctx.rect(x + t * 0.5, y + h - t, w - t, t); break;
      case 'e': ctx.rect(x, y + h * 0.5, t, h * 0.5 - t * 0.5); break;
      case 'f': ctx.rect(x, y + t * 0.5, t, h * 0.5 - t * 0.5); break;
      case 'g': ctx.rect(x + t * 0.5, y + h * 0.5 - t * 0.5, w - t, t); break;
    }
    ctx.fill();
  };
  for (const id of 'abcdefg') seg(id);
}

/** Rounded-rect path helper (no ctx.roundRect dependency). */
function roundRect(ctx, x, y, w, h, rad) {
  const rr = Math.min(rad, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
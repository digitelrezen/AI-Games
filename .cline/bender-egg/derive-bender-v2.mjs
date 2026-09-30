// derive-bender-v2.mjs — re-derive Bender sprites from the CORRECTED asset
// (white area between the legs is now transparent).
//
// Stage 1 (default): analysis only — prints content bbox, leg-gap transparency
//   check, and ASCII maps (full body coarse, arm region fine, head region fine
//   with color quantization) so the exact cut regions can be eyeballed in text.
// Stage 2 (--derive): with REGIONS filled in, derives:
//   - body : full body with the cigar-arm region cut out (easter egg)
//   - arm  : cigar arm pre-rotated so shoulder->hand points along +x,
//            shoulder translated to origin (animated reach arm)
//   - head : head+antenna icon at /2 integer downsample (power-up drop)
// No canvas — pure pixel math.

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

const SRC = 'z:/Dev/AI-GAMES/.assets/Robot-Bender Pixel Art.png'; // .assets moved up to AI-GAMES root
const OUT_JSON = 'z:/Dev/AI-GAMES/.cline/bender-egg/sprites-v2.json';
const OUT_TXT = 'z:/Dev/AI-GAMES/.cline/bender-egg/previews-v2.txt';

const DERIVE = process.argv.includes('--derive');

// ─── Stage 2 regions (content coordinates; fill after inspecting Stage 1) ───
const REGIONS = {
  // Cigar arm (viewer-left extended arm) cut from the body.
  arm: { x0: 0, y0: 124, cw: 62, ch: 112 },
  // Shoulder joint (where arm meets torso) in content coords.
  shoulder: { x: 58, y: 185 },
  // Hand tip (far end of arm, cigar side) in content coords.
  hand: { x: 13, y: 168 },
  // Head + antenna crop in content coords (use even w/h for /2 downsample).
  head: { x0: 100, y0: 0, cw: 100, ch: 140 },
};

// ─── Minimal PNG decoder (RGBA8, filters 0-4) ─────────────────────────────
function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8, w = 0, h = 0, bitDepth = 0, colorType = 0;
  const chunks = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (crc32(buf.subarray(off + 4, off + 8 + len)) !== buf.readUInt32BE(off + 8 + len)) throw new Error('bad CRC in ' + type);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') chunks.push(data);
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) throw new Error(`unsupported PNG: depth=${bitDepth} type=${colorType}`);
  return { w, h, nComp: colorType === 6 ? 4 : 3, raw: Buffer.concat(chunks) };
}
function decodePixels(buf) {
  const { w, h, nComp, raw } = decodePNG(buf);
  const inflated = inflateSync(raw);
  const stride = w * nComp;
  const px = Buffer.alloc(w * h * 4);
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = inflated[y * (stride + 1)];
    const cur = Buffer.from(inflated.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= nComp ? cur[i - nComp] : 0;
      const b = prev[i];
      const c = i >= nComp ? prev[i - nComp] : 0;
      let v = cur[i];
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      cur[i] = v;
    }
    for (let x = 0; x < w; x++) {
      px.set([cur[x * nComp], cur[x * nComp + 1], cur[x * nComp + 2], nComp === 4 ? cur[x * nComp + 3] : 255], (y * w + x) * 4);
    }
    prev.set(cur);
  }
  return { w, h, px };
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function contentBBox(img) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.px[(y * img.w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
function crop(img, x0, y0, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((y0 + y) * img.w + (x0 + x)) * 4, d = (y * w + x) * 4;
    out[d] = img.px[s]; out[d + 1] = img.px[s + 1]; out[d + 2] = img.px[s + 2]; out[d + 3] = img.px[s + 3];
  }
  return { w, h, px: out };
}
function zeroRect(img, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
    img.px[((y * img.w + x) * 4) + 3] = 0;
  }
}
// Nearest-neighbor integer downsample by factor n.
function downsample(img, n) {
  const w = Math.floor(img.w / n), h = Math.floor(img.h / n);
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0, cnt = 0;
    for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) {
      const s = (((y * n + dy) * img.w + x * n + dx) * 4);
      r += img.px[s]; g += img.px[s + 1]; b += img.px[s + 2]; a += img.px[s + 3]; cnt++;
    }
    const d = (y * w + x) * 4;
    out[d] = Math.round(r / cnt); out[d + 1] = Math.round(g / cnt); out[d + 2] = Math.round(b / cnt); out[d + 3] = Math.round(a / cnt);
  }
  return { w, h, px: out };
}
// Rotate image around (ax, ay) by angle (rad, screen coords y-down),
// nearest neighbor. Output is (w+h) square; anchor lands at (h/2+ax, h/2+ay).
function rotateNearest(img, angle, ax, ay) {
  const S = img.w + img.h;
  const out = Buffer.alloc(S * S * 4);
  const cosA = Math.cos(-angle), sinA = Math.sin(-angle);
  const axo = img.h / 2 + ax, ayo = img.h / 2 + ay;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x - axo, dy = y - ayo;
    const ix = Math.round(ax + dx * cosA - dy * sinA);
    const iy = Math.round(ay + dx * sinA + dy * cosA);
    if (ix >= 0 && iy >= 0 && ix < img.w && iy < img.h) {
      const s = (iy * img.w + ix) * 4, d = (y * S + x) * 4;
      out[d] = img.px[s]; out[d + 1] = img.px[s + 1]; out[d + 2] = img.px[s + 2]; out[d + 3] = img.px[s + 3];
    }
  }
  return { w: S, h: S, px: out, anchor: { x: axo, y: ayo } };
}
function bboxOf(img) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.px[(y * img.w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { x0, y0, w: Math.max(0, x1 - x0 + 1), h: Math.max(0, y1 - y0 + 1) };
}
// Encode RGBA buffer as PNG (filter 0, zlib deflate).
function encodePNG(img) {
  const { w, h, px } = img;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const idat = deflateSync(raw);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const chunks = [];
  const put = (type, data) => {
    const t = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0, 0);
    chunks.push(len, t, data, crc);
  };
  put('IHDR', ihdr); put('IDAT', idat); put('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ...chunks]);
}
// ASCII rendering: alpha map or color-quantized map.
function ascii(img, x0, y0, w, h, scale, colored) {
  const lines = [];
  for (let y = y0; y < y0 + h; y += scale) {
    let line = '';
    for (let x = x0; x < x0 + w; x += scale) {
      let a = 0, r = 0, g = 0, b = 0, n = 0;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const sx = x + dx, sy = y + dy;
        if (sx >= img.w || sy >= img.h) continue;
        const s = (sy * img.w + sx) * 4;
        a += img.px[s + 3]; r += img.px[s]; g += img.px[s + 1]; b += img.px[s + 2]; n++;
      }
      if (!n) { line += ' '; continue; }
      a /= n; r /= n; g /= n; b /= n;
      if (a < 20) { line += ' '; continue; }
      if (!colored) { line += a > 200 ? '#' : '+'; continue; }
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      let ch;
      if (d < 24) { const v = (r + g + b) / 3; ch = v > 200 ? 'W' : v > 120 ? 'g' : v > 60 ? 'o' : 'k'; }
      else if (r === mx) ch = g > b ? 'y' : 'r';
      else if (g === mx) ch = b > r ? 'c' : 'l';
      else ch = r > g ? 'm' : 'b';
      line += ch;
    }
    lines.push(String(y).padStart(3) + ' ' + line);
  }
  return lines.join('\n');
}



// ─── Main ─────────────────────────────────────────────────────────────────
const img = decodePixels(readFileSync(SRC));
console.log(`source: ${img.w}x${img.h}`);
const bb = contentBBox(img);
console.log(`content bbox: x=${bb.x0} y=${bb.y0} w=${bb.w} h=${bb.h}`);

// Leg-gap check: the region between the legs (content coords, lower body).
// Old file had opaque WHITE here; corrected file must be transparent.
const gap = { x0: bb.x0 + 260, y0: bb.y0 + 426, w: 16, h: 10 };
let gapOpaque = 0, gapWhite = 0, gapTotal = 0;
for (let y = gap.y0; y < gap.y0 + gap.h; y++) for (let x = gap.x0; x < gap.x0 + gap.w; x++) {
  if (x >= img.w || y >= img.h) continue;
  const s = (y * img.w + x) * 4;
  gapTotal++;
  if (img.px[s + 3] > 16) {
    gapOpaque++;
    if (img.px[s] > 230 && img.px[s + 1] > 230 && img.px[s + 2] > 230) gapWhite++;
  }
}
console.log(`leg-gap check: opaque=${gapOpaque}/${gapTotal}, white=${gapWhite} -> ${gapOpaque === 0 ? 'FIXED (transparent)' : gapWhite > gapOpaque / 2 ? 'STILL WHITE (not fixed!)' : 'opaque non-white (unexpected)'}`);

const lines = [];
lines.push(`BENDER v2 PREVIEW — source ${img.w}x${img.h}, content bbox (${bb.x0},${bb.y0}) ${bb.w}x${bb.h}`);
lines.push('');
lines.push('== FULL BODY (alpha, 1 char = 3px) ==');
lines.push(ascii(img, bb.x0, bb.y0, bb.w, bb.h, 3, false));
lines.push('');
lines.push(`== ARM REGION (content x ${REGIONS.arm.x0}..${REGIONS.arm.x0 + REGIONS.arm.cw}, y ${REGIONS.arm.y0}..${REGIONS.arm.y0 + REGIONS.arm.ch}, 1px, colored) ==`);
lines.push('   legend: W=white g=gray o=orange k=black y=yellow r=red c=cyan l=green m=magenta b=blue +=mid alpha');
lines.push(ascii(img, bb.x0 + REGIONS.arm.x0, bb.y0 + REGIONS.arm.y0, REGIONS.arm.cw, REGIONS.arm.ch, 1, true));
lines.push('');
lines.push(`== HEAD REGION (content x ${REGIONS.head.x0}..${REGIONS.head.x0 + REGIONS.head.cw}, y ${REGIONS.head.y0}..${REGIONS.head.y0 + REGIONS.head.ch}, 2px, colored) ==`);
lines.push(ascii(img, bb.x0 + REGIONS.head.x0, bb.y0 + REGIONS.head.y0, REGIONS.head.cw, REGIONS.head.ch, 2, true));
writeFileSync(OUT_TXT, lines.join('\n'));
console.log(`analysis written to ${OUT_TXT}`);

if (!DERIVE) { console.log('stage 1 complete — inspect previews-v2.txt, then run with --derive'); process.exit(0); }

// ─── Stage 2: derive sprites ──────────────────────────────────────────────
// Work in content space: crop content first.
const FULL = crop(img, bb.x0, bb.y0, bb.w, bb.h);

// body = full with arm region zeroed
const BODY = crop(FULL, 0, 0, FULL.w, FULL.h);
zeroRect(BODY, REGIONS.arm.x0, REGIONS.arm.y0, REGIONS.arm.cw, REGIONS.arm.ch);

// arm = crop arm region, rotate so shoulder->hand points +x, shoulder to origin
const ARM_CROP = crop(FULL, REGIONS.arm.x0, REGIONS.arm.y0, REGIONS.arm.cw, REGIONS.arm.ch);
const sAx = REGIONS.shoulder.x - REGIONS.arm.x0, sAy = REGIONS.shoulder.y - REGIONS.arm.y0;
const hAx = REGIONS.hand.x - REGIONS.arm.x0, hAy = REGIONS.hand.y - REGIONS.arm.y0;
const artDir = Math.atan2(hAy - sAy, hAx - sAx);
const rot = rotateNearest(ARM_CROP, -artDir, sAx, sAy); // rotate so artDir -> +x
const bb2 = bboxOf(rot);
const MARGIN = 2;
const AX0 = Math.max(0, bb2.x0 - MARGIN), AY0 = Math.max(0, bb2.y0 - MARGIN);
const AX1 = Math.min(rot.w, bb2.x0 + bb2.w + MARGIN), AY1 = Math.min(rot.h, bb2.y0 + bb2.h + MARGIN);
const ARM = crop(rot, AX0, AY0, AX1 - AX0, AY1 - AY0);
const shoulderInArm = { x: rot.anchor.x - AX0, y: rot.anchor.y - AY0 };
const armLen = Math.hypot(hAx - sAx, hAy - sAy);
const handInArm = { x: shoulderInArm.x + armLen, y: shoulderInArm.y };

// head icon: crop head region (content), downsample /2
const HEAD_SRC = crop(FULL, REGIONS.head.x0, REGIONS.head.y0, REGIONS.head.cw, REGIONS.head.ch);
const HEAD = downsample(HEAD_SRC, 2);

// Shoulder in BODY coords (content space):
const shoulderInBody = { x: REGIONS.shoulder.x, y: REGIONS.shoulder.y };

const out = {
  source: { w: img.w, h: img.h },
  contentBBox: bb,
  geometry: { shoulderInBody, shoulderInArm, handInArm, armLen, armArtDirRad: artDir, headSrcSize: { w: HEAD_SRC.w, h: HEAD_SRC.h } },
  body: { w: BODY.w, h: BODY.h, b64: encodePNG(BODY).toString('base64') },
  arm: { w: ARM.w, h: ARM.h, b64: encodePNG(ARM).toString('base64') },
  head: { w: HEAD.w, h: HEAD.h, b64: encodePNG(HEAD).toString('base64') },
};
writeFileSync(OUT_JSON, JSON.stringify(out));
console.log(`derived: body ${BODY.w}x${BODY.h}, arm ${ARM.w}x${ARM.h} (shoulder ${JSON.stringify(shoulderInArm)}, hand ${JSON.stringify(handInArm)}, len ${armLen.toFixed(1)}), head ${HEAD.w}x${HEAD.h}`);
console.log(`written ${OUT_JSON}`);

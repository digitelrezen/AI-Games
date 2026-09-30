// analyze-rat.mjs — Kitty Vs Everything (sandbox scratchpad)
// Programmatic analysis of `.assets/Rat pixel_art.png` (NO screenshots,
// per project rule — we decode the PNG and inspect pixel statistics only).
//
// Outputs:
//   • dimensions, color type, alpha stats
//   • opaque-pixel bounding box
//   • column/row density profile (orientation: where is the mass / head?)
//   • ASCII preview (downsampled) for visual orientation check
//   • dominant colors (palette)

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import path from 'node:path';

const ASSETS = path.resolve('Z:/Dev/AI-GAMES/.assets');
const FILES = [
  'Rat pixel_art.png',
];

// ── minimal PNG decoder (RGBA, 8-bit, non-interlaced) ─────────────────────
function decodePng(b) {
  if (b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) throw new Error('not a PNG');
  let off = 8;
  let w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off);
    const type = b.toString('ascii', off + 4, off + 8);
    const data = b.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  if (depth !== 8) throw new Error(`unsupported depth ${depth}`);
  if (interlace !== 0) throw new Error('interlaced PNG unsupported');
  const ch = ctype === 6 ? 4 : ctype === 2 ? 3 : ctype === 4 ? 2 : 1;
  if (ch !== 4) throw new Error(`unsupported color type ${ctype} (need RGBA 6)`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const out = Buffer.alloc(w * h * 4);
  const paeth = (a, bb, c) => {
    const p = a + bb - c, pa = Math.abs(p - a), pb = Math.abs(p - bb), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? bb : c;
  };
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const dst = out.subarray(y * stride, (y + 1) * stride);
    const up = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < w; x++) {
      const i = x * 4;
      const u = up ? [up[i], up[i + 1], up[i + 2], up[i + 3]] : [0, 0, 0, 0];
      const l = x >= 4 ? [dst[i - 4], dst[i - 3], dst[i - 2], dst[i - 1]] : [0, 0, 0, 0];
      const ul = (x >= 4 && up) ? [up[i - 4], up[i - 3], up[i - 2], up[i - 1]] : [0, 0, 0, 0];
      for (let k = 0; k < 4; k++) {
        let v;
        if (f === 0) v = row[i + k];
        else if (f === 1) v = row[i + k] + l[k];
        else if (f === 2) v = row[i + k] + u[k];
        else if (f === 3) v = row[i + k] + Math.floor((l[k] + u[k]) / 2);
        else v = row[i + k] + paeth(l[k], u[k], ul[k]);
        dst[i + k] = v & 0xff;
      }
    }
  }
  return { w, h, px: out, ctype, depth };
}

for (const name of FILES) {
  const p = path.join(ASSETS, name);
  console.log(`\n════ ${name} ════`);
  const buf = readFileSync(p);
  const { w, h, px, ctype, depth } = decodePng(buf);
  console.log(`decoded: ${w}x${h}, depth=${depth}, ctype=${ctype} (6=RGBA), bytes=${buf.length}`);

  const alphaAt = (x, y) => px[(y * w + x) * 4 + 3];
  const opaque = (x, y) => alphaAt(x, y) > 16;

  // alpha stats
  let aMin = 255, aMax = 0, aSum = 0, opaqueCount = 0, semiCount = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = alphaAt(x, y);
    if (a < aMin) aMin = a; if (a > aMax) aMax = a; aSum += a;
    if (a > 16) opaqueCount++;
    if (a > 16 && a < 239) semiCount++;
  }
  console.log(`alpha: min=${aMin} max=${aMax} avg=${(aSum / (w * h)).toFixed(1)} opaquePx=${opaqueCount} (${(100 * opaqueCount / (w * h)).toFixed(1)}%) semiPx=${semiCount}`);

  // bounding box
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (opaque(x, y)) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  console.log(`opaque bbox: x=${minX}..${maxX} y=${minY}..${maxY} → ${maxX - minX + 1}x${maxY - minY + 1}`);

  // column density (orientation: left vs right mass)
  const colD = new Array(w).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (opaque(x, y)) colD[x]++;
  const half = Math.floor(w / 2);
  let leftMass = 0, rightMass = 0;
  for (let x = 0; x < w; x++) (x < half ? (leftMass += colD[x]) : (rightMass += colD[x]));
  const tot = leftMass + rightMass || 1;
  console.log(`column mass: left=${(100 * leftMass / tot).toFixed(1)}% right=${(100 * rightMass / tot).toFixed(1)}%`);
  const dense = colD.map((n, x) => [x, n]).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log('densest columns (x, count):', JSON.stringify(dense));

  // row density (top vs bottom mass)
  const rowD = new Array(h).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (opaque(x, y)) rowD[y]++;
  const halfY = Math.floor(h / 2);
  let topMass = 0, botMass = 0;
  for (let y = 0; y < h; y++) (y < halfY ? (topMass += rowD[y]) : (botMass += rowD[y]));
  const totY = topMass + botMass || 1;
  console.log(`row mass: top=${(100 * topMass / totY).toFixed(1)}% bottom=${(100 * botMass / totY).toFixed(1)}%`);

  // palette
  const pal = new Map();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 16) continue;
    const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
    pal.set(key, (pal.get(key) || 0) + 1);
  }
  [...pal.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, n]) => {
    const r = (k >> 16) & 255, g = (k >> 8) & 255, b = k & 255;
    console.log(`  color #${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')} x${n}`);
  });

  // ASCII preview (downsampled, ~64 cols)
  const CW = 64, CH = Math.max(8, Math.round((h / w) * CW * 0.5));
  const chars = ' .:-=+*#%@';
  console.log(`ASCII preview (${CW}x${CH}, left→right):`);
  for (let cy = 0; cy < CH; cy++) {
    let line = '';
    for (let cx = 0; cx < CW; cx++) {
      const x0 = Math.floor((cx / CW) * w), x1 = Math.max(x0 + 1, Math.floor(((cx + 1) / CW) * w));
      const y0 = Math.floor((cy / CH) * h), y1 = Math.max(y0 + 1, Math.floor(((cy + 1) / CH) * h));
      let sum = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const a = alphaAt(x, y);
        if (a > 16) { sum += a; n++; }
      }
      const v = n ? sum / n / 255 : 0;
      line += chars[Math.min(chars.length - 1, Math.floor(v * chars.length))];
    }
    console.log(line);
  }
}

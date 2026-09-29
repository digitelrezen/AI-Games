// ascii-bender.mjs — TEXT-ONLY structural preview of the Bender asset
// (same pattern as .cline/adoptme-poster: ASCII on stdout, NO screenshots).
// Renders the alpha mask of the cropped content bbox to ASCII so the
// layout (head / body / arms) can be identified programmatically.

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import path from 'node:path';

const SRC = path.resolve('Z:/Dev/AI-GAMES/.assets/Robot-Bender Pixel Art.png'); // .assets moved up to AI-GAMES root
const buf = readFileSync(SRC);

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
  if (depth !== 8 || ctype !== 6 || interlace !== 0) throw new Error('unsupported PNG');
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
  return { w, h, px: out };
}

const { w, h, px } = decodePng(buf);
const opaque = (x, y) => px[(y * w + x) * 4 + 3] > 16;

// content bbox
let minX = w, minY = h, maxX = -1, maxY = -1;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (opaque(x, y)) {
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
}
const cw = maxX - minX + 1, ch = maxY - minY + 1;
console.log(`content bbox: (${minX},${minY}) ${cw}x${ch}`);

// ── ASCII alpha mask, downsampled to ~100 cols ────────────────────────────
const COLS = 100;
const scale = cw / COLS;
const ROWS = Math.round(ch / scale); // keep aspect
const ramp = ' .:-=+*#%@';
const lines = [];
for (let ry = 0; ry < ROWS; ry++) {
  let line = '';
  for (let rx = 0; rx < COLS; rx++) {
    let sum = 0, n = 0;
    const x0 = Math.floor(rx * scale), x1 = Math.floor((rx + 1) * scale);
    const y0 = Math.floor(ry * scale), y1 = Math.floor((ry + 1) * scale);
    for (let y = y0; y < y1 && y < ch; y++) for (let x = x0; x < x1 && x < cw; x++) {
      if (x < 0 || y < 0) continue;
      sum += px[((y + minY) * w + (x + minX)) * 4 + 3] / 255;
      n++;
    }
    const a = n ? sum / n : 0;
    line += ramp[Math.min(ramp.length - 1, Math.floor(a * ramp.length))];
  }
  lines.push(line);
}
console.log('   ' + '0123456789'.repeat(10).slice(0, COLS));
lines.forEach((l, i) => console.log(String(i).padStart(3) + l));

// ── horizontal profile: per-row width of content (shape skeleton) ─────────
console.log('\nrow profile (y: count of opaque px in content, every 4th row):');
for (let y = 0; y < ch; y += 4) {
  let n = 0, lx = -1, rx = -1;
  for (let x = 0; x < cw; x++) if (opaque(minX + x, minY + y)) { n++; if (x < lx || lx < 0) lx = x; rx = x; }
  const bar = '#'.repeat(Math.round(n / 8));
  console.log(`y=${String(y + minY).padStart(3)} [${String(lx + minX).padStart(3)}..${String(rx + minX).padStart(3)}] ${String(n).padStart(4)} ${bar}`);
}

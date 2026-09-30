// hi-res-preview.mjs — Kitty Vs Everything (sandbox scratchpad)
// Finer ASCII preview (128 cols) of `.assets/Rat pixel_art.png` to confirm
// head vs tail orientation. NO screenshots — alpha-based pixel stats only.

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import path from 'node:path';

const p = path.resolve('Z:/Dev/AI-GAMES/.assets/Rat pixel_art.png');
const b = readFileSync(p);
let off = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
const idat = [];
while (off < b.length) {
  const len = b.readUInt32BE(off);
  const type = b.toString('ascii', off + 4, off + 8);
  const data = b.subarray(off + 8, off + 8 + len);
  if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
  else if (type === 'IDAT') idat.push(data);
  off += 12 + len;
}
if (depth !== 8 || ctype !== 6 || interlace !== 0) throw new Error('unsupported PNG');
const raw = inflateSync(Buffer.concat(idat));
const stride = w * 4;
const out = Buffer.alloc(w * h * 4);
const paeth = (a, bb, c) => { const P = a + bb - c, pa = Math.abs(P - a), pb = Math.abs(P - bb), pc = Math.abs(P - c); return pa <= pb && pa <= pc ? a : pb <= pc ? bb : c; };
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
const alphaAt = (x, y) => out[(y * w + x) * 4 + 3];
const CW = 128, CH = 40;
const chars = ' .:-=+*#%@';
console.log(`128x40 preview of ${w}x${h} (left→right):`);
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

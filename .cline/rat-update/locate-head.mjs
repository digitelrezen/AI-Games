// locate-head.mjs — Kitty Vs Everything (sandbox scratchpad)
// Pinpoint the rat's head: find where pink (nose/ears) and white (eyes)
// pixels live relative to the body mass (pixel stats only).

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import path from 'node:path';

const p = path.resolve('Z:/Dev/AI-GAMES/.assets/Rat pixel_art.png');
const b = readFileSync(p);
if (b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) throw new Error('not a PNG');
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
console.log(`image: ${w}x${h}`);

// Classify pixels: pink (nose/inner ear), white (eyes), dark (outline), fur (brown)
const pink = [], white = [], dark = [];
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = (y * w + x) * 4;
  const a = out[i + 3];
  if (a < 16) continue;
  const r = out[i], g = out[i + 1], bl = out[i + 2];
  // pink: red dominant, R-G > 40, R > 150
  if (r > 150 && r - g > 40 && r - bl > 25) pink.push([x, y, r, g, bl]);
  // white: all channels high
  else if (r > 200 && g > 200 && bl > 200) white.push([x, y]);
  // dark: all channels low (outline / pupils)
  else if (r < 60 && g < 60 && bl < 60) dark.push([x, y]);
}
const summarize = (name, pts) => {
  if (!pts.length) { console.log(`${name}: none`); return; };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, sx = 0, sy = 0;
  for (const q of pts) {
    if (q[0] < minX) minX = q[0]; if (q[0] > maxX) maxX = q[0];
    if (q[1] < minY) minY = q[1]; if (q[1] > maxY) maxY = q[1];
    sx += q[0]; sy += q[1];
  }
  console.log(`${name}: n=${pts.length} bbox x=${minX}..${maxX} y=${minY}..${maxY} centroid=(${(sx / pts.length).toFixed(0)}, ${(sy / pts.length).toFixed(0)}) [image center x=${w / 2}]`);
};
summarize('pink (nose/ears)', pink);
summarize('white (eyes)', white);
summarize('dark (outline/pupils)', dark);

// Sample a few pink pixel colors to confirm
if (pink.length) {
  const seen = new Map();
  for (const [x, y, r, g, bl] of pink) {
    const key = `${r},${g},${bl}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([k, n]) => console.log(`  pink sample rgb(${k}) x${n}`));
}

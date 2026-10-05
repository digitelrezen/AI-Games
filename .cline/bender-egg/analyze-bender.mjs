// analyze-bender.mjs — Kitty Vs Everything (sandbox scratchpad)
// Programmatic analysis of `.assets/Robot-Bender Pixel Art.png` — we decode
// the PNG and inspect pixel statistics only.
//
// Outputs:
//   • overall opaque-pixel bounding box
//   • row/column transparency profiles (to detect sheet grid separators)
//   • per-cell bounding boxes + hashes (identical cells = static, differing = frames)
//   • per-frame diff regions (where frames differ — e.g. the animated arm)
//   • dominant colors (palette)

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import path from 'node:path';

const SRC = path.resolve('C:/Dev/AI-GAMES/.assets/Robot-Bender Pixel Art.png'); // .assets moved up to AI-GAMES root
const buf = readFileSync(SRC);

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
  if (depth !== 8 || ctype !== 6 || interlace !== 0) throw new Error(`unsupported PNG: depth=${depth} ctype=${ctype} interlace=${interlace}`);
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
console.log(`decoded: ${w}x${h} RGBA, bytes=${px.length}`);

const alphaAt = (x, y) => px[(y * w + x) * 4 + 3];
const opaque = (x, y) => alphaAt(x, y) > 16;

// ── overall bounding box ──────────────────────────────────────────────────
let minX = w, minY = h, maxX = -1, maxY = -1, count = 0;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (opaque(x, y)) {
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
  count++;
}
console.log(`opaque bbox: x=${minX}..${maxX} y=${minY}..${maxY}  (w=${maxX - minX + 1}, h=${maxY - minY + 1}, ${count} px)`);

// ── row / column transparency profiles (blank separators) ────────────────
const rowBlank = [], colBlank = [];
for (let y = 0; y < h; y++) { let n = 0; for (let x = 0; x < w; x++) if (opaque(x, y)) n++; rowBlank.push(n); }
for (let x = 0; x < w; x++) { let n = 0; for (let y = 0; y < h; y++) if (opaque(x, y)) n++; colBlank.push(n); }
const runs = (arr, isRun) => {
  const out = []; let s = null;
  for (let i = 0; i <= arr.length; i++) {
    const b = i < arr.length ? isRun(arr[i]) : true;
    if (b && s === null) s = i;
    else if (!b && s !== null) { out.push([s, i - 1]); s = null; }
  }
  return out;
};
console.log('blank ROW runs (y ranges):', JSON.stringify(runs(rowBlank, n => n === 0)));
console.log('blank COL runs (x ranges):', JSON.stringify(runs(colBlank, n => n === 0)));

// ── grid cells: split on fully-blank rows/cols ────────────────────────────
const rowRuns = runs(rowBlank, n => n > 0).filter(([a, b]) => b - a >= 8);
const colRuns = runs(colBlank, n => n > 0).filter(([a, b]) => b - a >= 8);
console.log(`grid: ${rowRuns.length} row-band(s) x ${colRuns.length} col-band(s)`);
const cells = [];
for (const [y0, y1] of rowRuns) for (const [x0, x1] of colRuns) {
  let a = x1, b = x0, c = y1, d = y0, n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (opaque(x, y)) {
    if (x < a) a = x; if (x > b) b = x; if (y < c) c = y; if (y > d) d = y; n++;
  }
  cells.push({ x0: x0, x1: x1, y0: y0, y1: y1, bw: b - a + 1, bh: d - c + 1, px: n, bx: a, by: c });
}
console.log(`cells: ${cells.length}`);
cells.forEach((cl, i) => console.log(`  [${i}] x=${cl.x0}..${cl.x1} y=${cl.y0}..${cl.y1} content=${cl.bw}x${cl.bh} at (${cl.bx},${cl.by}) px=${cl.px}`));

// ── cell hashes (which cells are identical?) ──────────────────────────────
const hashCell = (cl) => {
  let s = 0x811c9dc5;
  for (let y = cl.y0; y <= cl.y1; y++) for (let x = cl.x0; x <= cl.x1; x++) {
    const i = (y * w + x) * 4;
    for (let k = 0; k < 4; k++) { s ^= px[i + k]; s = Math.imul(s, 0x01000193) >>> 0; }
  }
  return s.toString(16);
};
const hashes = cells.map(hashCell);
const groups = new Map();
hashes.forEach((hsh, i) => {
  const g = groups.get(hsh);
  if (g) g.push(i); else groups.set(hsh, [i]);
});
console.log(`distinct cell hashes: ${groups.size}`);
for (const [hsh, idxs] of groups) console.log(`  hash ${hsh}: cells [${idxs.join(', ')}]`);

// ── per-pixel diff between consecutive cells (animated region) ────────────
if (cells.length >= 2) {
  for (let i = 1; i < Math.min(cells.length, 8); i++) {
    const A = cells[i - 1], B = cells[i];
    const ox = Math.max(A.x0, B.x0), oy = Math.max(A.y0, B.y0);
    const ex = Math.min(A.x1, B.x1), ey = Math.min(A.y1, B.y1);
    let dx0 = 1e9, dy0 = 1e9, dx1 = -1, dy1 = -1, n = 0;
    for (let y = oy; y <= ey; y++) for (let x = ox; x <= ex; x++) {
      const iA = (y * w + x) * 4, iB = (y * w + x) * 4;
      if (px[iA] !== px[iB] || px[iA + 1] !== px[iB + 1] || px[iA + 2] !== px[iB + 2] || px[iA + 3] !== px[iB + 3]) {
        if (x < dx0) dx0 = x; if (x > dx1) dx1 = x; if (y < dy0) dy0 = y; if (y > dy1) dy1 = y; n++;
      }
    }
    if (n > 0) console.log(`diff cell[${i - 1}] vs cell[${i}]: x=${dx0}..${dx1} y=${dy0}..${dy1} (${(dx1 - dx0 + 1)}x${(dy1 - dy0 + 1)}, ${n} px)`);
    else console.log(`diff cell[${i - 1}] vs cell[${i}]: IDENTICAL`);
  }
}

// ── palette (top colors of the whole sheet) ───────────────────────────────
const pal = new Map();
for (let i = 0; i < px.length; i += 4) {
  if (px[i + 3] < 16) continue;
  const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
  pal.set(key, (pal.get(key) || 0) + 1);
}
[...pal.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, n]) => {
  const r = (k >> 16) & 255, g = (k >> 8) & 255, b = k & 255;
  console.log(`  color #${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')} x${n}`);
});

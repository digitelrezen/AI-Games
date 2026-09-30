#!/usr/bin/env node
// test-poster.mjs — Everything Vs Kitty (sandbox scratchpad)
// Headless verification of the "Adopt Me!" poster PNG — everything is checked
// by decoding the PNG bytes and asserting on the pixel grid.
//
// Run: node test-poster.mjs
// Exits 0 on success, 1 on any failure.

import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { W, H, PALETTE, FONT, LAYOUT, buildGrid } from './build-grid.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let failures = 0;
const check = (label, cond) => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failures++;
};

// ─── PNG decoder (RGBA, 8-bit; supports all 5 row filters) ──────────────────
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}
function decodePNG(buf) {
  const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error('bad PNG signature');
  let offset = 8, width, height, bitDepth, colorType, idat = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.slice(offset + 4, offset + 8).toString('ascii');
    const data = buf.slice(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    offset += 12 + len;
  }
  if (bitDepth !== 8 || colorType !== 6) throw new Error(`unsupported PNG (depth=${bitDepth} color=${colorType})`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      if (filter === 1) v = (v + a) & 0xFF;
      else if (filter === 2) v = (v + b) & 0xFF;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xFF;
      else if (filter === 4) v = (v + paeth(a, b, c)) & 0xFF;
      out[y * stride + x] = v;
    }
  }
  return { width, height, rgba: out };
}

// ─── Load the generated PNG and round-trip it ───────────────────────────────
const pngPath = path.join(__dirname, 'adoptme-poster.png');
if (!fs.existsSync(pngPath)) {
  console.error('FAIL  adoptme-poster.png not found — run generate-poster.mjs first');
  process.exit(1);
}
const pngBuf = fs.readFileSync(pngPath);
const { width, height, rgba } = decodePNG(pngBuf);

console.log('');
console.log('== Adopt Me! poster — headless PNG verification ==');
console.log(`  decoded: ${width}x${height}, ${pngBuf.length} bytes`);

// 1) Dimensions must match the r=14 hitbox (28×28).
check('dimensions are 28x28 (hitbox radius 14)', width === 28 && height === 28);

// 2) Round-trip: decoded pixels must equal the source grid exactly.
const grid = buildGrid();
let mismatches = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const c = PALETTE[grid[y][x]];
    const i = (y * W + x) * 4;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], a = rgba[i + 3];
    if (c) {
      if (r !== c[0] || g !== c[1] || b !== c[2] || a !== c[3]) mismatches++;
    } else if (a !== 0) mismatches++;
  }
}
check('PNG round-trips to the exact source grid', mismatches === 0);

// 3) Opaque bounding box must fit inside the 28×28 hitbox square.
let minX = W, minY = H, maxX = -1, maxY = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (rgba[(y * W + x) * 4 + 3] > 0) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
}
check(`opaque bbox [${minX},${minY}]-[${maxX},${maxY}] fits 28x28 hitbox`,
  minX >= 0 && minY >= 0 && maxX < W && maxY < H);

// 4) Cat present: enough orange fur pixels.
const countColor = (key) => {
  const c = PALETTE[key];
  let n = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] === c[0] && rgba[i + 1] === c[1] && rgba[i + 2] === c[2] && rgba[i + 3] === c[3]) n++;
  }
  return n;
};
check('cat fur present (>=60 orange px)', countColor('C') >= 60);
check('cat eyes present (8 dark px: 2 eyes × 2×2)', countColor('E') === 8);
check('cat nose present (2 px)', countColor('N') === 2);

// 5) Cage bars: each bar column is a solid vertical run of bar color.
const barCols = LAYOUT.bars.cols;
let barsOk = true;
for (const bx of barCols) {
  for (let y = LAYOUT.bars.y0; y <= LAYOUT.bars.y1; y++) {
    const i = (y * W + bx) * 4;
    const c = PALETTE.R;
    if (rgba[i] !== c[0] || rgba[i + 1] !== c[1] || rgba[i + 2] !== c[2]) { barsOk = false; break; }
  }
}
check(`cage bars solid at cols [${barCols.join(',')}], rows ${LAYOUT.bars.y0}-${LAYOUT.bars.y1}`, barsOk);

// 6) Eyes are NOT covered by bars (cat is visible behind the bars).
const eyeCols = [8, 9, 18, 19];
let eyesClear = true;
for (const ex of eyeCols) {
  for (const ey of [11, 12]) {
    if (barCols.includes(ex)) eyesClear = false;
    const i = (ey * W + ex) * 4;
    const c = PALETTE.E;
    if (rgba[i] !== c[0] || rgba[i + 1] !== c[1] || rgba[i + 2] !== c[2]) eyesClear = false;
  }
}
check('cat eyes visible (not covered by bars)', eyesClear);

// 7) Text verification: re-render each word with the font and compare the
//    exact pixel pattern in the poster.
function renderText(str, x0, y0) {
  const cells = new Set();
  let cx = x0;
  for (const ch of str) {
    const glyph = FONT[ch];
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < glyph[gy].length; gx++) {
        if (glyph[gy][gx] === '1') cells.add(`${cx + gx},${y0 + gy}`);
      }
    }
    cx += glyph[0].length;
  }
  return cells;
}
const isColorAt = (x, y, key) => {
  const c = PALETTE[key];
  const i = (y * W + x) * 4;
  return rgba[i] === c[0] && rgba[i + 1] === c[1] && rgba[i + 2] === c[2] && rgba[i + 3] === c[3];
};
function textMatches(str, x0, y0, key) {
  const expected = renderText(str, x0, y0);
  // every expected text pixel must be the ink color
  for (const cell of expected) {
    const [x, y] = cell.split(',').map(Number);
    if (!isColorAt(x, y, key)) return false;
  }
  // no extra ink pixels in the text band beyond the expected set
  const bandY0 = y0, bandY1 = y0 + 4;
  for (let y = bandY0; y <= bandY1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (isColorAt(x, y, key) && !expected.has(`${x},${y}`)) return false;
    }
  }
  return true;
}
check('"WANTED" text renders correctly (rows 2-6)', textMatches(LAYOUT.wanted.text, LAYOUT.wanted.x, LAYOUT.wanted.y, 'W'));
check('"ADOPT ME!" text renders correctly (rows 19-23)', textMatches(LAYOUT.adopt.text, LAYOUT.adopt.x, LAYOUT.adopt.y, 'M'));

// 8) Border is a solid dark-brown frame.
let borderOk = true;
for (let x = 0; x < W; x++) {
  if (!isColorAt(x, 0, 'B') || !isColorAt(x, H - 1, 'B')) borderOk = false;
}
for (let y = 0; y < H; y++) {
  if (!isColorAt(0, y, 'B') || !isColorAt(W - 1, y, 'B')) borderOk = false;
}
check('poster border is a solid frame', borderOk);

console.log('');
if (failures) {
  console.log(`FAILED — ${failures} check(s) failed`);
  process.exit(1);
} else {
  console.log('PASSED — all poster checks clean');
}

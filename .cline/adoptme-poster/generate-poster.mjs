#!/usr/bin/env node
// generate-poster.mjs — Everything Vs Kitty (sandbox scratchpad)
// Renders the "Adopt Me!" WANTED-poster pixel art (from build-grid.mjs) to a
// 28×28 RGBA PNG and prints an ASCII preview + the base64 to embed.
//
// Output:
//   • adoptme-poster.png  — 28×28 RGBA PNG (matches the r=14 power-up hitbox)
//   • adoptme-poster.b64.txt — the base64 string
//   • an ASCII preview on stdout (TEXT ONLY)

import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { W, H, PALETTE, buildGrid } from './build-grid.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const grid = buildGrid();

// ─── Render grid → RGBA ─────────────────────────────────────────────────────
const rgba = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const c = PALETTE[grid[y][x]];
    const i = (y * W + x) * 4;
    if (c) { rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = c[3]; }
  }
}

// ─── Minimal PNG encoder (RGBA, 8-bit, filter 0) ────────────────────────────
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(width, height, px) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const png = encodePNG(W, H, rgba);
const outPath = path.join(__dirname, 'adoptme-poster.png');
fs.writeFileSync(outPath, png);

// ─── ASCII preview (text only) ──────────────────────────────────────────────
const GLYPH = { '.': ' ', B: '#', P: '.', W: 'W', C: 'c', E: 'e', N: 'n', R: '|', M: 'M' };
console.log('');
console.log('== Adopt Me! poster - 28x28 ASCII preview ==');
console.log('   ' + '0123456789012345678901234567'.match(/.{1,14}/g).join('   '));
grid.forEach((row, y) => {
  const line = row.map((c) => GLYPH[c] || '?').join('');
  console.log(String(y).padStart(2) + ' |' + line.slice(0, 14) + '   ' + line.slice(14));
});
console.log('   ' + '0123456789012345678901234567'.match(/.{1,14}/g).join('   '));

// ─── base64 for embedding ───────────────────────────────────────────────────
const b64 = png.toString('base64');
fs.writeFileSync(path.join(__dirname, 'adoptme-poster.b64.txt'), b64);
console.log('');
console.log('PNG bytes :', png.length);
console.log('base64 len:', b64.length);
console.log('wrote     :', outPath);
console.log('');
console.log('== base64 (paste into MiniPosterSprite.js) ==');
console.log(b64);

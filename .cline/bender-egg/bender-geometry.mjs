// bender-geometry.mjs — pin down arm/torso boundary + shoulder pivot (content coords).
// Reuses the same PNG decoder approach as derive-bender.mjs.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import path from 'node:path';

const SRC = path.resolve('C:/Dev/AI-GAMES/.assets/Robot-Bender Pixel Art.png'); // .assets moved up to AI-GAMES root
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
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  if (depth !== 8 || ctype !== 6 || interlace !== 0) throw new Error('unsupported PNG');
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const out = Buffer.alloc(w * h * 4);
  const paeth = (a, bb, c) => { const p = a + bb - c, pa = Math.abs(p - a), pb = Math.abs(p - bb), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? bb : c; };
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

let minX = w, minY = h, maxX = -1, maxY = -1;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (opaque(x, y)) {
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
}
const CW = maxX - minX + 1, CH = maxY - minY + 1;
const cOp = (cx, cy) => opaque(minX + cx, minY + cy);
console.log(`content bbox: (${minX},${minY}) ${CW}x${CH}`);

// ── 1. Torso LEFT edge: leftmost opaque x in [80,110] for each y ───────────
console.log('\n=== Torso left edge (leftmost opaque x in content x 80..110) ===');
console.log('y   x_left  (gap from 80)');
for (let y = 85; y <= 250; y++) {
  let xl = -1;
  for (let x = 80; x <= 110; x++) if (cOp(x, y)) { xl = x; break; }
  if (xl >= 0) console.log(String(y).padStart(3) + '   ' + String(xl).padStart(4) + '   ' + (xl - 80));
}

// ── 2. Arm RIGHT edge: rightmost opaque x in [0,85] for each y ─────────────
console.log('\n=== Arm right edge (rightmost opaque x in content x 0..85) ===');
console.log('y   x_right');
for (let y = 100; y <= 215; y++) {
  let xr = -1;
  for (let x = 85; x >= 0; x--) if (cOp(x, y)) { xr = x; break; }
  if (xr >= 0) console.log(String(y).padStart(3) + '   ' + String(xr).padStart(4));
}

// ── 3. Shoulder band: for y in 175..195, list opaque runs in x 60..110 ─────
console.log('\n=== Shoulder band (opaque runs in content x 60..110) ===');
for (let y = 175; y <= 195; y++) {
  const runs = [];
  let start = -1;
  for (let x = 60; x <= 110; x++) {
    if (cOp(x, y) && start < 0) start = x;
    if (!cOp(x, y) && start >= 0) { runs.push(`${start}-${x - 1}`); start = -1; }
  }
  if (start >= 0) runs.push(`${start}-110`);
  console.log(String(y).padStart(3) + '   ' + (runs.length ? runs.join('  ') : '(empty)'));
}

// ── 4. Head + antenna bbox: opaque bbox in x 90..175, y 0..140 (exclude arm) ─
{
  let a = 1e9, b = -1, c = 1e9, d = -1;
  for (let y = 0; y <= 140; y++) for (let x = 90; x <= 175; x++) if (cOp(x, y)) {
    if (x < a) a = x; if (x > b) b = x; if (y < c) c = y; if (y > d) d = y;
  }
  console.log(`\n=== Head+antenna bbox (search x 90..175, y 0..140, arm excluded) ===`);
  console.log(`x ${a}..${b}  y ${c}..${d}  (w=${b - a + 1} h=${d - c + 1})`);
}

// ── 4b. Head-only bbox (no antenna): x 90..175, y 25..140 ──────────────────
{
  let a = 1e9, b = -1, c = 1e9, d = -1;
  for (let y = 25; y <= 140; y++) for (let x = 90; x <= 175; x++) if (cOp(x, y)) {
    if (x < a) a = x; if (x > b) b = x; if (y < c) c = y; if (y > d) d = y;
  }
  console.log(`\n=== Head-only bbox (search x 90..175, y 25..140) ===`);
  console.log(`x ${a}..${b}  y ${c}..${d}  (w=${b - a + 1} h=${d - c + 1})`);
}

// ── 4c. Antenna bbox: x 90..175, y 0..30 ───────────────────────────────────
{
  let a = 1e9, b = -1, c = 1e9, d = -1;
  for (let y = 0; y <= 30; y++) for (let x = 90; x <= 175; x++) if (cOp(x, y)) {
    if (x < a) a = x; if (x > b) b = x; if (y < c) c = y; if (y > d) d = y;
  }
  console.log(`\n=== Antenna bbox (search x 90..175, y 0..30) ===`);
  console.log(`x ${a}..${b}  y ${c}..${d}  (w=${b - a + 1} h=${d - c + 1})`);
}

// ── 4d. ASCII of head region (content x 88..172, y 0..134), step 1 ─────────
{
  const X0 = 88, Y0 = 0, CWd = 84, CHd = 134;
  const lines = [`=== Head region ASCII (content x ${X0}..${X0 + CWd - 1}, y ${Y0}..${Y0 + CHd - 1}) ===`];
  for (let y = 0; y < CHd; y++) {
    let line = '';
    for (let x = 0; x < CWd; x++) line += cOp(X0 + x, Y0 + y) ? '@' : '.';
    lines.push(String(Y0 + y).padStart(3) + ' ' + line);
  }
  let r1 = '    ', r2 = '    ';
  for (let x = 0; x < CWd; x++) {
    r1 += x % 10 === 0 ? String(Math.floor(x / 10) % 10) : ' ';
    r2 += String(x % 10);
  }
  lines.push(r1, r2);
  console.log('\n' + lines.join('\n'));
}

// ── 6. Arm bbox: opaque bbox in x 0..75, y 100..215 ────────────────────────
{
  let a = 1e9, b = -1, c = 1e9, d = -1;
  for (let y = 100; y <= 215; y++) for (let x = 0; x <= 75; x++) if (cOp(x, y)) {
    if (x < a) a = x; if (x > b) b = x; if (y < c) c = y; if (y > d) d = y;
  }
  console.log(`\n=== Arm bbox (search x 0..75, y 100..215) ===`);
  console.log(`x ${a}..${b}  y ${c}..${d}  (w=${b - a + 1} h=${d - c + 1})`);
}

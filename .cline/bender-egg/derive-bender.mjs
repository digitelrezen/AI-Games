// derive-bender.mjs — Kitty Vs Everything (sandbox scratchpad)
// Derives game sprites from `.assets/Robot-Bender Pixel Art.png` (single static
// full-body pose). Verification is text/ASCII only.
//
// Stage 1 (this run): high-res ASCII of arm + head regions, connected
//   components, then derive FULL / ARM / BODY / HEAD sprites and emit
//   base64 + ASCII previews.
//
// Content coords: cropped to opaque bbox (160,22) 251x378 of the 570x428 sheet.

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import path from 'node:path';

const SRC = path.resolve('C:/Dev/AI-GAMES/.assets/Robot-Bender Pixel Art.png'); // .assets moved up to AI-GAMES root
const OUT = path.resolve('C:/Dev/AI-GAMES/.cline/bender-egg');
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

// ── minimal PNG encoder (RGBA, 8-bit, filter 0) ───────────────────────────
let CRC_TABLE = null;
function crc32(data) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}
function encodePng(img) {
  const { w, h, px } = img;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  };
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── decode source ──────────────────────────────────────────────────────────
const { w, h, px } = decodePng(buf);
const alphaAt = (x, y) => px[(y * w + x) * 4 + 3];
const opaque = (x, y) => alphaAt(x, y) > 16;

let minX = w, minY = h, maxX = -1, maxY = -1;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (opaque(x, y)) {
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
}
const CW = maxX - minX + 1, CH = maxY - minY + 1;
console.log(`content bbox: (${minX},${minY}) ${CW}x${CH}`);
const cOp = (cx, cy) => opaque(minX + cx, minY + cy);

// ── image ops (content coords) ─────────────────────────────────────────────
function crop(x0, y0, cw, ch) {
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    px.copy(out, y * cw * 4, (minY + y0 + y) * w * 4 + (minX + x0) * 4, (minY + y0 + y) * w * 4 + (minX + x0 + cw) * 4);
  }
  return { w: cw, h: ch, px: out };
}
function cutRegion(img, x0, y0, cw, ch) {
  const out = Buffer.from(img.px);
  for (let y = y0; y < y0 + ch; y++) for (let x = x0; x < x0 + cw; x++) {
    out[(y * img.w + x) * 4 + 3] = 0;
  }
  return { w: img.w, h: img.h, px: out };
}
function downscale(img, tw, th) {
  const out = Buffer.alloc(tw * th * 4);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const x0 = Math.floor(x * img.w / tw), x1 = Math.max(x0 + 1, Math.floor((x + 1) * img.w / tw));
    const y0 = Math.floor(y * img.h / th), y1 = Math.max(y0 + 1, Math.floor((y + 1) * img.h / th));
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
      const i = (sy * img.w + sx) * 4;
      const al = img.px[i + 3] / 255;
      r += img.px[i] * al; g += img.px[i + 1] * al; b += img.px[i + 2] * al; a += al;
    }
    const n = (x1 - x0) * (y1 - y0), o = (y * tw + x) * 4;
    if (a > 0.02) {
      out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a);
      out[o + 3] = Math.round(255 * Math.min(1, a / n));
    }
  }
  return { w: tw, h: th, px: out };
}
function padSquare(img, size) {
  const out = Buffer.alloc(size * size * 4); // transparent
  const ox = Math.floor((size - img.w) / 2), oy = Math.floor((size - img.h) / 2);
  for (let y = 0; y < img.h; y++) {
    img.px.copy(out, ((oy + y) * size + ox) * 4, y * img.w * 4, (y + 1) * img.w * 4);
  }
  return { w: size, h: size, px: out };
}
function asciiOf(img, op, label, step = 1) {
  const lines = [label];
  for (let y = 0; y < img.h; y += step) {
    let line = '';
    for (let x = 0; x < img.w; x += step) line += op(x, y) ? '@' : '.';
    lines.push(String(y).padStart(3) + ' ' + line);
  }
  let r1 = '    ', r2 = '    ';
  for (let x = 0; x < img.w; x += step) {
    r1 += step === 1 ? (x % 10 === 0 ? String(Math.floor(x / 10) % 10) : ' ') : String(Math.floor(x / step) % 10);
    r2 += step === 1 ? String(x % 10) : String((x / step) % 10);
  }
  lines.push(r1, r2);
  return lines.join('\n');
}
const opOf = (img) => (x, y) => img.px[(y * img.w + x) * 4 + 3] > 16;

// ── connected components (4-way) over content ──────────────────────────────
{
  const seen = Buffer.alloc(CW * CH);
  const comps = [];
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const i = y * CW + x;
    if (seen[i] || !cOp(x, y)) continue;
    const stack = [[x, y]]; seen[i] = 1;
    let a = CW, b = 0, c = CH, d = 0, n = 0;
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < a) a = cx; if (cx > b) b = cx; if (cy < c) c = cy; if (cy > d) d = cy; n++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= CW || ny >= CH) continue;
        const ni = ny * CW + nx;
        if (!seen[ni] && cOp(nx, ny)) { seen[ni] = 1; stack.push([nx, ny]); }
      }
    }
    comps.push({ x0: a, x1: b, y0: c, y1: d, n });
  }
  comps.sort((p, q) => q.n - p.n);
  console.log(`connected components: ${comps.length}`);
  comps.slice(0, 12).forEach((c, i) => console.log(`  comp[${i}] x=${c.x0}..${c.x1} y=${c.y0}..${c.y1} px=${c.n}`));
}

// ── high-res ASCII of arm + head regions (1 char = 1 px) ──────────────────
{
  const lines = [];
  lines.push('=== LEFT ARM region: content x 0..100, y 90..245 (1 char = 1 px) ===');
  for (let y = 90; y <= 245; y++) {
    let line = '';
    for (let x = 0; x <= 100; x++) line += cOp(x, y) ? '@' : '.';
    lines.push(String(y).padStart(3) + ' ' + line);
  }
  let r1 = '    ', r2 = '    ';
  for (let x = 0; x <= 100; x++) { r1 += x % 10 === 0 ? String(Math.floor(x / 10) % 10) : ' '; r2 += String(x % 10); }
  lines.push(r1, r2);
  lines.push('');
  lines.push('=== HEAD region: content x 60..195, y 0..125 (1 char = 1 px) ===');
  for (let y = 0; y <= 125; y++) {
    let line = '';
    for (let x = 60; x <= 195; x++) line += cOp(x, y) ? '@' : '.';
    lines.push(String(y).padStart(3) + ' ' + line);
  }
  r1 = '    '; r2 = '    ';
  for (let x = 60; x <= 195; x++) { r1 += x % 10 === 0 ? String(Math.floor(x / 10) % 10) : ' '; r2 += String(x % 10); }
  lines.push(r1, r2);
  writeFileSync(path.join(OUT, 'regions-hires.txt'), lines.join('\n'));
  console.log('wrote regions-hires.txt');
}

// ── derive sprites (regions — verified via bender-geometry.mjs) ────────────
// Arm: x 0..85, y 108..200; torso left edge x=90; shoulder joint ~(88,182).
// Head: x 88..168, y 30..133; antenna x 133..143, y 0..30.
const ARM = { x0: 0, y0: 100, cw: 90, ch: 110 };   // arm + shoulder, excludes torso (x>=90)
const HEAD = { x0: 88, y0: 0, cw: 84, ch: 136 };   // head + antenna
const SHOULDER = { x: 88, y: 182 };                // content coords (arm/torso joint)
console.log('region boxes (content coords):', JSON.stringify({ ARM, HEAD, SHOULDER }));

const FULL = crop(0, 0, CW, CH);
const ARM_IMG = crop(ARM.x0, ARM.y0, ARM.cw, ARM.ch);
const BODY = cutRegion(FULL, ARM.x0, ARM.y0, ARM.cw, ARM.ch);
const HEAD_IMG = downscale(padSquare(crop(HEAD.x0, HEAD.y0, HEAD.cw, HEAD.ch), 136), 28, 28);

const previews = [];
previews.push(asciiOf(ARM_IMG, opOf(ARM_IMG), `=== ARM sprite ${ARM_IMG.w}x${ARM_IMG.h} (1 char = 1 px) ===`));
previews.push('');
previews.push(asciiOf(BODY, opOf(BODY), '=== BODY (arm cut out) 251x378, step 2 ===', 2));
previews.push('');
previews.push(asciiOf(HEAD_IMG, opOf(HEAD_IMG), '=== HEAD icon 28x28 (1 char = 1 px) ==='));
writeFileSync(path.join(OUT, 'sprite-previews.txt'), previews.join('\n'));

// ── emit base64 ────────────────────────────────────────────────────────────
const out = {
  full: { w: FULL.w, h: FULL.h, b64: encodePng(FULL).toString('base64') },
  arm: { w: ARM_IMG.w, h: ARM_IMG.h, b64: encodePng(ARM_IMG).toString('base64') },
  body: { w: BODY.w, h: BODY.h, b64: encodePng(BODY).toString('base64') },
  head: { w: HEAD_IMG.w, h: HEAD_IMG.h, b64: encodePng(HEAD_IMG).toString('base64') },
};
writeFileSync(path.join(OUT, 'sprites-b64.json'), JSON.stringify(out, null, 1));
console.log('wrote sprites-b64.json');
for (const k of ['full', 'arm', 'body', 'head']) console.log(`  ${k}: ${out[k].w}x${out[k].h} b64len=${out[k].b64.length}`);

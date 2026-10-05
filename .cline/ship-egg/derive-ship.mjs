// .cline/ship-egg/derive-ship.mjs
// Derive the Planet Express ship sprite from the source PNG and generate
// the game's ShipSprite.js module (embedded base64).
//
// Pure-JS pipeline (no canvas / pngjs / ImageMagick — only node:zlib):
//   1. Load source: .assets/Futurama Ship pixel_art_large.png (935x500, RGBA8)
//   2. Decode PNG (RGBA8, filters 0-4) via zlib.inflateSync
//   3. Crop to content bbox (30,144) 844x319   [from analyze-ship.mjs]
//   4. Downsample /2 (nearest-neighbor, deterministic) -> 422x159
//   5. Encode PNG (RGBA8, filter 0) via zlib.deflateSync + CRC32
//   6. Write final PNG -> .cline/ship-egg/ship-sprite.png
//   7. Generate ShipSprite.js (embedded base64 + geometry + getters)
//
// The ship nose faces +x (right); no rotation needed. It flies left->right
// across the screen as a one-shot easter egg (type "planetexpress").
//
// Run: node .cline/ship-egg/derive-ship.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync, deflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const GAME = join(here, '..', '..', 'Kitty Vs Everything');
const SRC = join(here, '..', '..', '.assets', 'Futurama Ship pixel_art_large.png'); // .assets moved up to AI-GAMES root
const OUT_PNG = join(here, 'ship-sprite.png');
const OUT_JS = join(GAME, 'ShipSprite.js');
const OUT_PREVIEW = join(here, 'ship-preview-out.txt');

// Content bbox (from analyze-ship.mjs): x=30, y=144, w=844, h=319
const CROP = { x: 30, y: 144, w: 844, h: 319 };
const SCALE = 2; // integer downsample factor (keeps pixel-art crisp)

// ─── Minimal PNG codec (RGBA8, filters 0-4) ─────────────────────────────
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
function contentBBox(img) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.px[(y * img.w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA, no interlace
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter 0 (None)
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
function ascii(img, scale, colored) {
  const lines = [];
  for (let y = 0; y < img.h; y += scale) {
    let line = '';
    for (let x = 0; x < img.w; x += scale) {
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
    lines.push(String(y).padStart(4) + ' ' + line);
  }
  return lines.join('\n');
}

// ─── 1) Decode source ────────────────────────────────────────────────────
const src = decodePixels(readFileSync(SRC));
console.log('source', src.w + 'x' + src.h);

// ─── 2) Verify crop bbox matches the analyzed content bbox ───────────────
const bb = contentBBox(src);
console.log('content bbox x=' + bb.x0 + ' y=' + bb.y0 + ' w=' + bb.w + ' h=' + bb.h);
if (bb.x0 !== CROP.x || bb.y0 !== CROP.y || bb.w !== CROP.w || bb.h !== CROP.h) {
  throw new Error('content bbox mismatch: got ' + JSON.stringify(bb) + ' expected ' + JSON.stringify(CROP));
}

// ─── 3) Crop to content bbox ─────────────────────────────────────────────
const cw = CROP.w, ch = CROP.h;
const crop = Buffer.alloc(cw * ch * 4);
for (let y = 0; y < ch; y++) {
  const sy = CROP.y + y;
  for (let x = 0; x < cw; x++) {
    const si = (sy * src.w + CROP.x + x) * 4;
    const di = (y * cw + x) * 4;
    crop[di] = src.px[si]; crop[di + 1] = src.px[si + 1]; crop[di + 2] = src.px[si + 2]; crop[di + 3] = src.px[si + 3];
  }
}

// ─── 4) Downsample /2 (nearest-neighbor: sample top-left of each 2x2) ────
const W = Math.floor(cw / SCALE);
const H = Math.floor(ch / SCALE);
const out = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  const sy = y * SCALE;
  for (let x = 0; x < W; x++) {
    const si = (sy * cw + x * SCALE) * 4;
    const di = (y * W + x) * 4;
    out[di] = crop[si]; out[di + 1] = crop[si + 1]; out[di + 2] = crop[si + 2]; out[di + 3] = crop[si + 3];
  }
}

// ─── 5) Verify non-transparent content ───────────────────────────────────
let opaque = 0;
for (let i = 3; i < out.length; i += 4) if (out[i] > 0) opaque++;
const pct = (100 * opaque / (W * H)).toFixed(1);
console.log('output', W + 'x' + H, 'opaque px', opaque, '(' + pct + '%)');
if (opaque === 0) throw new Error('output is fully transparent — crop bbox wrong?');

// ─── 6) Encode PNG ───────────────────────────────────────────────────────
const png = encodePNG(W, H, out);
writeFileSync(OUT_PNG, png);
console.log('wrote', OUT_PNG, '(' + png.length + ' bytes)');

// ─── 6b) ASCII preview of the FINAL sprite (verify shape + nose direction)
const preview = [
  'FINAL SHIP SPRITE — ' + W + 'x' + H + ' (nearest /2 of content bbox ' + cw + 'x' + ch + ')',
  'nose faces +x (right); flies left->right',
  '',
  '== ALPHA (1 char = 4px) ==',
  ascii({ w: W, h: H, px: out }, 4, false),
  '',
  '== COLORED (1 char = 2px) ==',
  '   legend: W=white g=gray o=orange k=black y=yellow r=red c=cyan l=green m=magenta b=blue +=mid alpha',
  ascii({ w: W, h: H, px: out }, 2, true),
].join('\n');
writeFileSync(OUT_PREVIEW, preview);
console.log('wrote', OUT_PREVIEW);

// ─── 7) Generate ShipSprite.js (embedded base64 + geometry + getters) ────
const b64 = png.toString('base64');
const js = [
  '// Filename: ShipSprite.js',
  '// Kitty Vs Everything — v3.25.0',
  '// GENERATED FILE — regenerate with: node .cline/ship-egg/derive-ship.mjs',
  '// Planet Express ship easter-egg sprite (v3.25.0).',
  '//',
  '// Source: C:\\Dev\\AI-GAMES\\.assets\\Futurama Ship pixel_art_large.png (935x500)',
  '// Pipeline: crop to content bbox (30,144) 844x319 -> downsample /2 (nearest)',
  '//           -> ' + W + 'x' + H + '. Nose faces +x (right); no rotation needed.',
  '//',
  '// The ship flies left->right across the screen as a one-shot easter egg',
  '// (type "planetexpress"). Rendered by EasterEgg.js (ShipEgg class).',
  '//',
  "const SHIP_B64 = '" + b64 + "';",
  '',
  'export const SHIP_W = ' + W + ';',
  'export const SHIP_H = ' + H + ';',
  '',
  'let shipCanvas = null;',
  '',
  'function makeCanvas(b64, w, h) {',
  '  const img = new Image();',
  "  img.src = 'data:image/png;base64,' + b64;",
  '  return new Promise((resolve, reject) => {',
  '    img.onload = () => {',
  "      const c = document.createElement('canvas');",
  '      c.width = w;',
  '      c.height = h;',
  "      const ctx = c.getContext('2d');",
  '      ctx.imageSmoothingEnabled = false;',
  '      ctx.drawImage(img, 0, 0, w, h);',
  '      resolve(c);',
  '    };',
  '    img.onerror = reject;',
  '  });',
  '}',
  '',
  'export function getShip() {',
  '  return shipCanvas;',
  '}',
  'export function isShipSpriteReady() {',
  '  return !!shipCanvas;',
  '}',
  '',
  'makeCanvas(SHIP_B64, SHIP_W, SHIP_H)',
  '  .then((c) => { shipCanvas = c; })',
  "  .catch(() => { /* sprite optional — ShipEgg falls back to a placeholder */ });",
  '',
].join('\n');
writeFileSync(OUT_JS, js);
console.log('wrote', OUT_JS, '(' + js.length + ' chars)');
console.log('SHIP_B64 length:', b64.length);
console.log('done.');

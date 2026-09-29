// tools/derive-cat-sprites.mjs
// Kitty Vs Everything — v3.32.0
// One-off generator for the cat sprite modules (js/enemies/BlackCatSprite.js,
// js/enemies/PinkCatSprite.js). Pure Node — no browser, no npm deps:
//
//   1. Decodes the source PNGs (8-bit, color type 2/6) with a minimal
//      built-in PNG decoder (zlib inflate + unfilter).
//   2. Reports: dimensions, tight alpha bbox, top colors, and an ASCII
//      preview of the silhouette (so the pose/facing can be verified
//      without opening the image).
//   3. Crops to the content bbox, nearest-neighbor /2 downsamples
//      (clean 2×2 pixel merge), and re-encodes as an 8-bit RGBA PNG
//      (deflate level 9).
//   4. Writes the two sprite modules with the derived base64 payload.
//
// The decode/encode helpers are exported so tools/check-cat-sprites.mjs
// can re-validate the embedded payloads headlessly (no browser, no
// screenshot — the project's validation rule).
//
// Run:  node tools/derive-cat-sprites.mjs   (from anywhere)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateSync, deflateSync } from 'node:zlib';

const TOOLS_DIR = dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = resolve(TOOLS_DIR, '..', 'Kitty Vs Everything');
const ASSET_DIR = resolve(TOOLS_DIR, '..', '.assets');
const OUT_DIR = join(GAME_ROOT, 'js', 'enemies');

// ─────────────────────────────────────────────────────────────────────────
// Minimal PNG decoder — 8-bit depth, color type 2 (RGB) or 6 (RGBA).
// Returns { w, h, data } where data is a Buffer of w*h*4 RGBA bytes.
// ─────────────────────────────────────────────────────────────────────────
export function decodePng(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('not a PNG (bad signature)');
  }
  let off = 8;
  let w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8) throw new Error(`bit depth ${bitDepth} unsupported`);
      if (colorType !== 2 && colorType !== 6) {
        throw new Error(`color type ${colorType} unsupported (need 2 or 6)`);
      }
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  if (!w || !h) throw new Error('missing IHDR');
  const raw = inflateSync(Buffer.concat(idat));
  const ch = colorType === 6 ? 4 : 3;
  const stride = w * ch;
  const expected = h * (stride + 1);
  if (raw.length < expected) throw new Error('IDAT payload too short');
  const out = Buffer.alloc(w * h * 4);
  if (ch === 3) out.fill(255, 3, undefined, 4); // RGB → opaque alpha
  // Unfilter row by row. A (left), B (up) and C (up-left) must be the
  // RECONSTRUCTED values, so each row is unfiltered into its own buffer
  // before the next row references it.
  let prevRow = null;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const rs = y * (stride + 1) + 1;
    const rowBuf = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const cur = raw[rs + x];
      const A = x >= ch ? rowBuf[x - ch] : 0;
      const B = prevRow ? prevRow[x] : 0;
      const C = (x >= ch && prevRow) ? prevRow[x - ch] : 0;
      let v;
      if (f === 0) v = cur;
      else if (f === 1) v = cur + A;
      else if (f === 2) v = cur + B;
      else if (f === 3) v = cur + ((A + B) >> 1);
      else if (f === 4) {
        const p = A + B - C;
        const pa = Math.abs(p - A), pb = Math.abs(p - B), pc = Math.abs(p - C);
        v = cur + (pa <= pb && pa <= pc ? A : pb <= pc ? B : C);
      } else throw new Error(`unknown filter type ${f}`);
      rowBuf[x] = v & 0xff;
    }
    if (ch === 4) {
      rowBuf.copy(out, y * w * 4);
    } else {
      for (let p = 0; p < w; p++) {
        out[p * 4] = rowBuf[p * 3];
        out[p * 4 + 1] = rowBuf[p * 3 + 1];
        out[p * 4 + 2] = rowBuf[p * 3 + 2];
      }
    }
    prevRow = rowBuf;
  }
  return { w, h, data: out };
}

// ─────────────────────────────────────────────────────────────────────────
// Minimal PNG encoder — 8-bit RGBA, filter 0 (None) on every scanline,
// zlib deflate level 9.
// ─────────────────────────────────────────────────────────────────────────
let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let k = n;
      for (let i = 0; i < 8; i++) k = (k & 1) ? (0xedb88320 ^ (k >>> 1)) : (k >>> 1);
      CRC_TABLE[n] = k;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

export function encodePng(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter None
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// ─────────────────────────────────────────────────────────────────────────
// Analysis helpers
// ─────────────────────────────────────────────────────────────────────────

/** Tight bounding box of pixels with alpha > 0. */
export function bboxOf(rgba, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Copy a rectangular region out of an RGBA buffer. */
export function cropRgba(rgba, w, h, box) {
  const cw = box.w, chh = box.h;
  const out = Buffer.alloc(cw * chh * 4);
  for (let y = 0; y < chh; y++) {
    rgba.copy(out, y * cw * 4, ((y + box.y) * w + box.x) * 4, ((y + box.y) * w + box.x + cw) * 4);
  }
  return { w: cw, h: chh, data: out };
}

/** Nearest-neighbor /2 downsample (top-left of each 2×2 block — the
 *  ShipSprite.js pattern; exact for pixel art on a 2× grid). */
export function downscale2(rgba, w, h) {
  const ow = Math.floor(w / 2), oh = Math.floor(h / 2);
  const out = Buffer.alloc(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      rgba.copy(out, (y * ow + x) * 4, ((y * 2) * w + x * 2) * 4, ((y * 2) * w + x * 2) * 4 + 4);
    }
  }
  return { w: ow, h: oh, data: out };
}

/** ASCII silhouette preview: ' ' transparent, '#' dark, 'o' mid, '+'
 *  light, '.' very light. ~64 cols wide, 2:1 char aspect. */
export function asciiMap(rgba, w, h, cols = 64) {
  const rows = Math.max(8, Math.round((h / w) * cols * 0.5));
  const lines = [];
  for (let ry = 0; ry < rows; ry++) {
    let line = '';
    const y0 = Math.floor((ry / rows) * h);
    const y1 = Math.max(y0 + 1, Math.floor(((ry + 1) / rows) * h));
    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor((cx / cols) * w);
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) / cols) * w));
      let a = 0, sum = 0, n = 0;
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const i = (y * w + x) * 4;
          a += rgba[i + 3];
          sum += rgba[i] + rgba[i + 1] + rgba[i + 2];
          n++;
        }
      }
      const av = a / n, br = sum / (n * 3);
      line += av < 16 ? ' ' : br < 60 ? '#' : br < 140 ? 'o' : br < 210 ? '+' : '.';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/** Top N exact RGBA colors as hex + share of non-transparent pixels. */
export function topColors(rgba, w, h, n = 8) {
  const counts = new Map();
  let total = 0;
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3];
    if (a <= 0) continue;
    total++;
    const key = (rgba[i * 4] << 24) | (rgba[i * 4 + 1] << 16) | (rgba[i * 4 + 2] << 8) | a;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((p, q) => q[1] - p[1])
    .slice(0, n)
    .map(([key, c]) => {
      const r = (key >>> 24) & 0xff, g = (key >>> 16) & 0xff, b = (key >>> 8) & 0xff, a = key & 0xff;
      const hex = '#' + [r, g, b, a].map((v) => v.toString(16).padStart(2, '0')).join('');
      return `${hex}  ${(100 * c / total).toFixed(1)}%`;
    });
}

// ─────────────────────────────────────────────────────────────────────────
// Sprite module template
// ─────────────────────────────────────────────────────────────────────────
function moduleSource(a, stats) {
  return `// Filename: ${a.module}
// Kitty Vs Everything — v3.32.0
// GENERATED FILE — regenerate with:  node tools/derive-cat-sprites.mjs
//
// ${a.label} (v3.32.0): the pixel-art cat from
// \`Z:\\Dev\\AI-GAMES\\.assets\\${a.src}\` (${stats.srcW}×${stats.srcH}, 8-bit RGBA, real
// alpha channel — no white-background keying needed).
//
// Generation pipeline (Node, at generation time — not at runtime):
//   1. Crop to the non-transparent content bbox:
//      x=${stats.crop.x}, y=${stats.crop.y}, ${stats.crop.w}×${stats.crop.h}.
//   2. Nearest-neighbor /2 downsample (clean 2×2 pixel merge).
//   3. Re-encode as an 8-bit RGBA PNG and embed as base64 below.
// The browser side is trivial: decode the embedded PNG onto a canvas 1:1
// (BenderSprite.js precedent — embed the derived payload, not the full
// source, to keep the single-file build small).
//
// The sprite is OPTIONAL at runtime: ${a.enemy} draws ${a.fallback}
// until (or if) the decode finishes / works.
//
// Headless validation (no browser, no screenshot):
//   node tools/check-cat-sprites.mjs

export const ${a.prefix}_B64 =
  '${stats.b64}';

/** Processed sprite dimensions (px) — crop /2, see header. */
export const ${a.prefix}_W = ${stats.w};
export const ${a.prefix}_H = ${stats.h};

let ${a.canvasVar} = null;

function makeCanvas(b64, w, h) {
  return new Promise((resolve, reject) => {
    const img = new Image(); // Node (headless): throws in the executor → reject → caught below
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, w, h);
      resolve(c);
    };
    img.onerror = reject;
    img.src = 'data:image/png;base64,' + b64;
  });
}

/** Ready sprite canvas, or null while loading (or if it failed). */
export function ${a.getter}() {
  return ${a.canvasVar};
}
export function ${a.ready}() {
  return !!${a.canvasVar};
}

makeCanvas(${a.prefix}_B64, ${a.prefix}_W, ${a.prefix}_H)
  .then((c) => { ${a.canvasVar} = c; })
  .catch(() => { /* optional sprite — ${a.enemy} falls back to a circle */ });
`;
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────
const ASSETS = [
  {
    src: 'black-cat-pixel-art.png',
    module: 'BlackCatSprite.js',
    label: 'Black Cat enemy sprite',
    prefix: 'BLACK_CAT',
    getter: 'getBlackCatSprite',
    ready: 'isBlackCatSpriteReady',
    canvasVar: 'blackCatCanvas',
    fallback: 'a plain dark circle (this.color)',
    enemy: 'BlackCatEnemy.js',
  },
  {
    src: 'Pink-Cat-pixel-art.png',
    module: 'PinkCatSprite.js',
    label: 'Pink Cat boss sprite',
    prefix: 'PINK_CAT',
    getter: 'getPinkCatSprite',
    ready: 'isPinkCatSpriteReady',
    canvasVar: 'pinkCatCanvas',
    fallback: 'a plain pink circle',
    enemy: 'PinkCatEnemy.js',
  },
];

function main() {
  for (const a of ASSETS) {
    const path = join(ASSET_DIR, a.src);
    const buf = readFileSync(path);
    const img = decodePng(buf);
    console.log(`\n═══ ${a.label} — ${a.src} ═══`);
    console.log(`source:        ${img.w}×${img.h}, ${(buf.length / 1024).toFixed(1)} KB`);

    const bbox = bboxOf(img.data, img.w, img.h);
    console.log(`content bbox:  x=${bbox.x}, y=${bbox.y}, ${bbox.w}×${bbox.h}`);
    console.log(`top colors:\n  ` + topColors(img.data, img.w, img.h).join('\n  '));

    // 1px padding around the bbox (clamped to the image)
    const crop = {
      x: Math.max(0, bbox.x - 1),
      y: Math.max(0, bbox.y - 1),
      w: Math.min(img.w - Math.max(0, bbox.x - 1), bbox.w + 2),
      h: Math.min(img.h - Math.max(0, bbox.y - 1), bbox.h + 2),
    };
    const cropped = cropRgba(img.data, img.w, img.h, crop);
    const half = downscale2(cropped.data, cropped.w, cropped.h);
    const png = encodePng(half.w, half.h, half.data);
    const b64 = png.toString('base64');

    console.log(`crop:          x=${crop.x}, y=${crop.y}, ${crop.w}×${crop.h}`);
    console.log(`sprite (÷2):   ${half.w}×${half.h}`);
    console.log(`re-encoded:    ${(png.length / 1024).toFixed(1)} KB PNG → ${(b64.length / 1024).toFixed(1)} KB base64`);
    console.log(`\nASCII preview (source):\n${asciiMap(img.data, img.w, img.h)}`);

    const stats = { srcW: img.w, srcH: img.h, crop, w: half.w, h: half.h, b64 };
    const out = join(OUT_DIR, a.module);
    writeFileSync(out, moduleSource(a, stats), 'utf8');
    console.log(`\nwrote:         ${out}`);
  }
  console.log('\nDone. Re-run any time the source PNGs change.');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();





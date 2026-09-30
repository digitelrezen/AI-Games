// prep-ufo.mjs — one-off asset prep for the dual-ship alien (Kitty Vs Everything v3.43.0).
//
// The two UFO PNGs in .assets are pixel art on an OPAQUE WHITE background
// (RGBA, but alpha=255 everywhere). The art itself contains interior white
// pixels (windows/highlights), so a naive "white → transparent" key would
// punch holes in the ships. Instead this script:
//   1. flood-fills from the image EDGES through whitish pixels (4-connected)
//      and makes exactly that connected background transparent,
//   2. crops to the remaining content's bounding box (removes the big white
//      margins so the import downscale keeps detail),
//   3. re-encodes as 8-bit RGBA PNG (filter 0) — the format
//      tools/import-assets.mjs validates and accepts.
//
// Originals are left untouched; derived files are written next to them:
//   Alien-UFO1-pixel_art.png  →  Alien-UFO1-transparent.png
//   Alien-UFO2-pixel-art.png  →  Alien-UFO2-transparent.png
//
// Run: node .cline/alien-ships/prep-ufo.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

const ASSETS = 'Z:/Dev/AI-GAMES/.assets';
const JOBS = [
  { src: 'Alien-UFO1-pixel_art.png', dst: 'Alien-UFO1-transparent.png' },
  { src: 'Alien-UFO2-pixel-art.png', dst: 'Alien-UFO2-transparent.png' },
];

// ─── PNG decode (RGBA, filter 0 only — matches analyze-ufo.mjs) ───
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function readPng(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8, w = 0, h = 0, bitDepth = 0, colorType = 0;
  const raw = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    const crc = buf.readUInt32BE(off + 8 + len);
    // PNG spec: CRC covers chunk TYPE + chunk DATA
    if (crc !== crc32(buf.subarray(off + 4, off + 8 + len))) throw new Error(`bad CRC in ${type}`);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') raw.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || colorType !== 6) throw new Error(`need 8-bit RGBA, got depth=${bitDepth} type=${colorType}`);
  const rawBuf = inflateSync(Buffer.concat(raw));
  const bpp = 4, stride = w * bpp;
  const rgba = Buffer.alloc(w * h * bpp);
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = rawBuf[y * (stride + 1)];
    const cur = Buffer.from(rawBuf.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
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
    cur.copy(rgba, y * stride);
    cur.copy(prev);
  }
  return { w, h, rgba };
}

// ─── PNG encode (8-bit RGBA, filter 0) ───
function encodePng(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  const chunks = [];
  const mk = (type, data) => {
    const c = Buffer.alloc(8 + data.length + 4);
    c.writeUInt32BE(data.length, 0);
    c.write(type, 4, 'ascii');
    data.copy(c, 8);
    c.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
    return c;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  chunks.push(mk('IHDR', ihdr));
  chunks.push(mk('IDAT', idat));
  chunks.push(mk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

// ─── Edge-connected white flood fill ───
const WHITE_T = 235; // r,g,b all ≥ 235 counts as background
function isWhite(rgba, i) {
  return rgba[i * 4] >= WHITE_T && rgba[i * 4 + 1] >= WHITE_T && rgba[i * 4 + 2] >= WHITE_T;
}
function floodBackground(w, h, rgba) {
  const filled = new Uint8Array(w * h);
  const stack = [];
  const trySeed = (i) => {
    if (!filled[i] && isWhite(rgba, i)) { filled[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x++) { trySeed(x); trySeed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { trySeed(y * w); trySeed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    if (x > 0) trySeed(i - 1);
    if (x < w - 1) trySeed(i + 1);
    if (y > 0) trySeed(i - w);
    if (y < h - 1) trySeed(i + w);
  }
  let removed = 0, interiorWhite = 0;
  for (let i = 0; i < w * h; i++) {
    if (filled[i]) { rgba[i * 4 + 3] = 0; removed++; }
    else if (isWhite(rgba, i)) interiorWhite++;
  }
  return { removed, interiorWhite };
}

// ─── Content bbox + crop ───
function cropToContent(w, h, rgba) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('no opaque content left after fill!');
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    rgba.copy(out, y * cw * 4, (y + minY) * w * 4 + minX * 4, (y + minY) * w * 4 + (minX + cw) * 4);
  }
  return { cw, ch, out, pad: { minX, minY, maxX, maxY } };
}

// ─── ASCII preview (alpha-aware) ───
function preview(w, h, rgba, scale = 6) {
  const ch = (v) => (v > 200 ? 'W' : v > 120 ? 'g' : 'k');
  const lines = [];
  for (let py = 0; py < h; py += scale) {
    let line = '';
    for (let px = 0; px < w; px += scale) {
      let a = 0, lum = 0, n = 0;
      for (let dy = 0; dy < scale && py + dy < h; dy++) {
        for (let dx = 0; dx < scale && px + dx < w; dx++) {
          const i = ((py + dy) * w + (px + dx)) * 4;
          a += rgba[i + 3];
          lum += (rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3;
          n++;
        }
      }
      a /= n; lum /= n;
      line += a < 128 ? ' ' : a < 250 ? '·' : ch(lum);
    }
    lines.push(line);
  }
  return lines.join('\n');
}

// ─── Run ───
for (const job of JOBS) {
  const srcPath = `${ASSETS}/${job.src}`;
  const { w, h, rgba } = readPng(srcPath);
  let totalWhite = 0;
  for (let i = 0; i < w * h; i++) if (isWhite(rgba, i)) totalWhite++;
  const { removed, interiorWhite } = floodBackground(w, h, rgba);
  const { cw, ch, out, pad } = cropToContent(w, h, rgba);
  const png = encodePng(cw, ch, out);
  const dstPath = `${ASSETS}/${job.dst}`;
  writeFileSync(dstPath, png);
  console.log(`\n=== ${job.src} → ${job.dst} ===`);
  console.log(`original: ${w}×${h}, white-ish px: ${totalWhite}`);
  console.log(`flood-removed (background): ${removed}, interior white kept: ${interiorWhite}`);
  console.log(`content bbox: x=${pad.minX}..${pad.maxX} y=${pad.minY}..${pad.maxY} → cropped ${cw}×${ch} (aspect ${(cw / ch).toFixed(3)})`);
  console.log(`wrote ${dstPath} (${png.length} bytes)`);
  console.log('\n--- cropped alpha preview (6px scale; space=transparent, ·=partial, k/g/W=dark/gray/light) ---');
  console.log(preview(cw, ch, out));
}
console.log('\nDone.');


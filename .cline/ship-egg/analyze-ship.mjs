// analyze-ship.mjs — pure-pixel analysis of the Planet Express ship asset.
// Decode the PNG in Node and print the content bbox + an ASCII preview so the
// sprite can be eyeballed in text.
// Run: node analyze-ship.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const SRC = 'z:/Dev/AI-GAMES/.assets/Futurama Ship pixel_art_large.png'; // .assets moved up to AI-GAMES root
const OUT_TXT = 'z:/Dev/AI-GAMES/.cline/ship-egg/ship-preview.txt';

// ─── Minimal PNG decoder (RGBA8, filters 0-4) ─────────────────────────────
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
function ascii(img, x0, y0, w, h, scale, colored) {
  const lines = [];
  for (let y = y0; y < y0 + h; y += scale) {
    let line = '';
    for (let x = x0; x < x0 + w; x += scale) {
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

const img = decodePixels(readFileSync(SRC));
console.log(`source: ${img.w}x${img.h}`);
const bb = contentBBox(img);
console.log(`content bbox: x=${bb.x0} y=${bb.y0} w=${bb.w} h=${bb.h}`);
console.log(`aspect (w/h): ${(bb.w / bb.h).toFixed(3)}`);

const lines = [];
lines.push(`SHIP PREVIEW — source ${img.w}x${img.h}, content bbox (${bb.x0},${bb.y0}) ${bb.w}x${bb.h}`);
lines.push('');
lines.push('== FULL SHIP (alpha, 1 char = 4px) ==');
lines.push(ascii(img, bb.x0, bb.y0, bb.w, bb.h, 4, false));
lines.push('');
lines.push('== FULL SHIP (colored, 1 char = 2px) ==');
lines.push('   legend: W=white g=gray o=orange k=black y=yellow r=red c=cyan l=green m=magenta b=blue +=mid alpha');
lines.push(ascii(img, bb.x0, bb.y0, bb.w, bb.h, 2, true));
writeFileSync(OUT_TXT, lines.join('\n'));
console.log(`analysis written to ${OUT_TXT}`);

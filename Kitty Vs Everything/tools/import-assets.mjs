#!/usr/bin/env node
// tools/import-assets.mjs — Kitty Vs Everything v3.33.0
// Robust asset-import & mapping utility for the shared art folder.
//
// Discovers, validates and maps transparent PNGs out of <AI-GAMES>/.assets
// (resolved RELATIVE to this file — no hardcoded UNC paths) and generates the
// game's embedded sprite registry:
//   "js/core/AssetSprites.js"
//
// The game builds to a single self-contained HTML (build.mjs), so runtime
// file:// fetches of external PNGs are not an option — the established
// pipeline (BenderSprite / MiniPosterSprite / BlackCatSprite / …) embeds
// base64 PNGs in a generated module. This tool is the single entry point for
// that pipeline and is designed for batch updates: add a key → file name line
// to tools/asset-manifest.json and re-run. No game code changes needed.
//
// Per-key resolution (robust against renames / case / separator drift):
//   0. subfolder prefix — a value like "Hazards/BioBarrel-256x256.png"
//      (v3.97.0) resolves the base name inside .assets/Hazards/ instead of
//      the .assets root (same exact → case-insensitive → fuzzy ladder)
//   1. exact file name in .assets
//   2. normalized fuzzy match (lowercase, spaces / - / _ stripped) —
//      must be UNAMBIGUOUS (exactly one hit) or it errors
//   3. hard error listing every available PNG (exit 1)
//
// Per-file validation (hard errors, exit 1):
//   • PNG signature, parseable IHDR, 8-bit depth
//   • color type 6 (RGBA) — transparency is mandatory for this pipeline
//   • non-transparent pixel content exists (decoded, not just declared)
//
// Normalization: art larger than MAX_DIM px (128) is box-filter downscaled
// to fit (aspect preserved) and re-encoded as 8-bit RGBA PNG — keeps the
// single-file build small. v3.90.0: cat_* keys (the 9 catship themes) use
// CATSHIP_MAX_DIM (512) so the native 256×384 catship art embeds untouched.
// v3.93.0: spaceballs_one uses SHIP_MAX_DIM (384) so the 384×256 ship art (readable text) embeds untouched.
// Output is DETERMINISTIC (sorted keys, per-asset source sha12, no
// timestamps) so --check can byte-compare.
//
// Usage:
//   node tools/import-assets.mjs          → import + regenerate AssetSprites.js
//   node tools/import-assets.mjs --check  → verify the generated registry is
//                                           current (no writes; exit 1 if stale)
// Pure Node (zlib + manual PNG decode/encode), no canvas.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Clean relative mappings (no stale UNC paths): tools/ → game root → AI-GAMES root → .assets
const ASSET_DIR = path.resolve(__dirname, '..', '..', '.assets');
const MANIFEST = path.join(__dirname, 'asset-manifest.json');
const OUT = path.resolve(__dirname, '..', 'js', 'core', 'AssetSprites.js');
const MAX_DIM = 128; // v3.72.0 normalization ceiling for embedded art (keeps the single-file build small)
const CATSHIP_MAX_DIM = 512; // v3.90.0: cat_* keys (the 9 catship themes) embed at native 256×384 — 512 only guards future oversized catship art
const SHIP_MAX_DIM = 384; // v3.93.0: spaceballs_one ship embeds at native 384×256 (text must stay readable)

const checkMode = process.argv.includes('--check');
let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => { failures++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };
const warn = (m) => console.log(`  \x1b[33m⚠\x1b[0m ${m}`);

// ─── Pure-Node PNG decode (8-bit, color types 0/2/4/6) ─────────────────────
function decodePng(buf) {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (buf[i] !== SIG[i]) throw new Error('bad PNG signature (not a PNG file?)');
  let off = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (!width || !height) throw new Error('missing/invalid IHDR chunk');
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth} (need 8)`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported color type ${colorType} (need 6 = RGBA)`);
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length < height * (stride + 1)) throw new Error('IDAT payload shorter than expected');
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      } else if (filter !== 0) throw new Error(`unsupported PNG filter ${filter} at row ${y}`);
      out[y * stride + x] = v;
    }
  }
  return { width, height, bitDepth, colorType, channels, pixels: out };
}

// ─── Pure-Node PNG encode (8-bit RGBA, filter 0) ───────────────────────────
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
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Box-filter downscale (aspect-preserving, flat-color friendly) ─────────
function downscale(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor((y * sh) / dh);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor((x * sw) / dw);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / dw));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * sw + sx) * 4;
          r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3];
          n++;
        }
      }
      const o = (y * dw + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

// ─── Filename resolution (exact → normalized fuzzy → error) ────────────────
const norm = (s) => s.toLowerCase().replace(/[\s\-_]/g, '');
function resolveAssetFile(wanted, listing) {
  // 1) exact
  const exact = listing.find((f) => f === wanted);
  if (exact) return { file: exact, how: 'exact' };
  // 2) case-insensitive exact
  const ci = listing.find((f) => f.toLowerCase() === wanted.toLowerCase());
  if (ci) return { file: ci, how: 'case-insensitive' };
  // 3) normalized fuzzy (renames / separator drift) — must be unambiguous
  const base = wanted.replace(/\.png$/i, '');
  const hits = listing.filter((f) => norm(path.basename(f, '.png')) === norm(base));
  if (hits.length === 1) return { file: hits[0], how: 'fuzzy' };
  if (hits.length > 1) return { ambiguous: hits };
  return { missing: true };
}

// ─── Main ──────────────────────────────────────────────────────────────────
console.log(`\n[import-assets] asset dir : ${ASSET_DIR}`);
console.log(`[import-assets] manifest  : ${MANIFEST}`);
console.log(`[import-assets] output    : ${OUT}${checkMode ? '  (--check: no writes)' : ''}`);

if (!fs.existsSync(ASSET_DIR)) {
  bad(`asset directory not found: ${ASSET_DIR}`);
  process.exit(1);
}
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
} catch (err) {
  bad(`cannot read manifest ${MANIFEST}: ${err.message}`);
  process.exit(1);
}
const keys = Object.keys(manifest.assets || {});
if (keys.length === 0) {
  bad('manifest has no assets — nothing to import');
  process.exit(1);
}
const ROOT_LISTING = fs.readdirSync(ASSET_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
// v3.97.0: subfolder support — a manifest value may carry a folder prefix
// ("Hazards/BioBarrel-256x256.png"); the base name is then resolved inside
// that subfolder of .assets with the same exact → case → fuzzy ladder.
const listingFor = (wanted) => {
  const sep = wanted.indexOf('/');
  if (sep < 0) return { dir: '', base: wanted, listing: ROOT_LISTING };
  const dir = wanted.slice(0, sep).replace(/\\/g, '/');
  const sub = path.join(ASSET_DIR, dir);
  if (!fs.existsSync(sub) || !fs.statSync(sub).isDirectory()) {
    return { dir, base: wanted.slice(sep + 1), listing: [] };
  }
  return { dir, base: wanted.slice(sep + 1), listing: fs.readdirSync(sub).filter((f) => f.toLowerCase().endsWith('.png')) };
};
console.log(`[import-assets] ${ROOT_LISTING.length} PNGs in .assets root, ${keys.length} manifest keys\n`);

const imported = {}; // key → { b64, w, h, source, srcW, srcH, sha12, how }
for (const key of keys) {
  const wanted = manifest.assets[key];
  const { dir, base, listing } = listingFor(wanted);
  const res = resolveAssetFile(base, listing);
  if (res.missing) {
    bad(`${key}: "${wanted}" not found in .assets${dir ? '/' + dir : ''} — available: ${listing.join(', ') || '(empty folder)'}`);
    continue;
  }
  if (res.ambiguous) {
    bad(`${key}: "${wanted}" is ambiguous — matches: ${res.ambiguous.join(', ')}`);
    continue;
  }
  const file = dir ? dir + '/' + res.file : res.file;
  const buf = fs.readFileSync(path.join(ASSET_DIR, file));
  let png;
  try {
    png = decodePng(buf);
  } catch (err) {
    bad(`${key}: ${file} failed to decode — ${err.message}`);
    continue;
  }
  if (png.colorType !== 6) {
    bad(`${key}: ${file} is color type ${png.colorType}, need 6 (RGBA with alpha) — re-export the art with transparency`);
    continue;
  }
  // Non-transparent content check (decoded, not just declared)
  let content = 0;
  for (let i = 3; i < png.pixels.length; i += 4) if (png.pixels[i] > 0) content++;
  if (content === 0) {
    bad(`${key}: ${file} is fully transparent — nothing to draw`);
    continue;
  }
  // Normalize (downscale + re-encode) when larger than MAX_DIM
  let outBuf = buf, outW = png.width, outH = png.height, normalized = false;
  const cap = key.startsWith('cat_') ? CATSHIP_MAX_DIM : (key === 'spaceballs_one' ? SHIP_MAX_DIM : MAX_DIM); // v3.90.0: catship art embeds native; everything else stays at the 128px normalization
  const scale = Math.min(1, cap / Math.max(png.width, png.height));
  if (scale < 1) {
    const dw = Math.max(1, Math.round(png.width * scale));
    const dh = Math.max(1, Math.round(png.height * scale));
    const rgba = downscale(png.pixels, png.width, png.height, dw, dh);
    outBuf = encodePng(dw, dh, rgba);
    // Self-verify the re-encode round-trips (decoder is the same one used above)
    const rt = decodePng(outBuf);
    if (rt.width !== dw || rt.height !== dh || rt.colorType !== 6) {
      bad(`${key}: re-encode self-verify failed (${rt.width}×${rt.height})`);
      continue;
    }
    outW = dw; outH = dh; normalized = true;
  }
  const sha12 = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
  imported[key] = {
    b64: outBuf.toString('base64'),
    w: outW, h: outH,
    source: file, srcW: png.width, srcH: png.height,
    sha12, how: res.how,
    kb: (outBuf.length / 1024).toFixed(1),
  };
  const howNote = res.how === 'exact' ? '' : `  [${res.how} match]`;
  ok(`${key.padEnd(10)} ← ${file}  (${png.width}×${png.height}${normalized ? ` → ${outW}×${outH}` : ''}, ${imported[key].kb} KB embedded)${howNote}`);
}

if (failures > 0) {
  console.log(`\n[import-assets] FAILED — ${failures} error(s). The generated registry was NOT updated.\n`);
  process.exit(1);
}

// ─── Deterministic registry generation ─────────────────────────────────────
const sorted = Object.keys(imported).sort();
const lines = [];
lines.push('// Filename: AssetSprites.js');
lines.push('// GENERATED FILE — do not edit by hand.');
lines.push('// Regenerate: node tools/import-assets.mjs   (tools/asset-manifest.json → this registry)');
lines.push('// Source art: <AI-GAMES>/.assets (shared transparent PNGs, ≤128px normalized; cat_* catship art embeds native ≤512px; spaceballs_one ship embeds native 384×256).');
lines.push('// The runtime manager is js/core/AssetManager.js (decode + per-key');
lines.push('// error isolation + null → procedural fallback in the consumers).');
lines.push('');
lines.push('export const ASSET_DIMS = {');
for (const k of sorted) lines.push(`  ${k}: { w: ${imported[k].w}, h: ${imported[k].h} },`);
lines.push('};');
lines.push('');
lines.push('export const ASSET_SOURCES = {');
for (const k of sorted) {
  const a = imported[k];
  lines.push(`  ${k}: "${a.source} (${a.srcW}×${a.srcH} → ${a.w}×${a.h}, sha12 ${a.sha12})",`);
}
lines.push('};');
lines.push('');
lines.push('export const ASSET_B64 = {');
for (const k of sorted) lines.push(`  ${k}: "${imported[k].b64}",`);
lines.push('};');
lines.push('');
const outText = lines.join('\n'); // LF — the repo enforces eol=lf (.gitattributes: * text=auto eol=lf); --check compares byte-identical, so the generator must match

if (checkMode) {
  if (!fs.existsSync(OUT)) {
    bad('--check: generated registry missing — run: node tools/import-assets.mjs');
  } else {
    const current = fs.readFileSync(OUT, 'utf8');
    if (current === outText) ok('--check: registry is current (byte-identical)');
    else bad('--check: registry is STALE or hand-edited — run: node tools/import-assets.mjs');
  }
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, outText);
  ok(`wrote ${path.relative(path.resolve(__dirname, '..'), OUT)} (${(Buffer.byteLength(outText) / 1024).toFixed(1)} KB)`);
}

console.log(failures === 0 ? '\n[import-assets] OK\n' : `\n[import-assets] ${failures} failure(s)\n`);
process.exit(failures === 0 ? 0 : 1);

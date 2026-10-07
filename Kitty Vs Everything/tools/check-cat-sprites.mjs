#!/usr/bin/env node
// tools/check-cat-sprites.mjs — Kitty Vs Everything v3.32.0
// Headless validation of the v3.32.0 generated cat sprites:
//   [1] Import BlackCatSprite.js / PinkCatSprite.js — verify the exports and
//       the null-sprite contract (the sprite is OPTIONAL at runtime; the
//       enemies fall back to a plain circle until/if it decodes).
//   [2] Decode the embedded base64 PNG payloads in pure Node (zlib + manual
//       PNG unfilter — no canvas, no browser) and verify the IHDR dimensions
//       against the exported constants, 8-bit RGBA, and that non-transparent
//       content exists. Prints an ASCII alpha preview of each sprite.
//   [3]/[4] Spawn child processes that instantiate the REAL enemy classes and
//       run draw() against a mock 2D context:
//         --enemy-fallback  no DOM shims → sprite modules stay null →
//                           verify the circle-fallback branch.
//         --enemy-sprite    fake Image/document shims → the sprites
//                           "decode" → verify the nearest-neighbor drawImage
//                           branch, exact scale (2×r / 2.6×r) and centering.
// Run: node tools/check-cat-sprites.mjs

import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SELF = path.join(__dirname, 'check-cat-sprites.mjs');
const ROOT = path.resolve(__dirname, '..');
const url = (f) => pathToFileURL(path.join(ROOT, f)).href;

let failures = 0;
const check = (label, cond) => {
  console.log(`  ${cond ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}`);
  if (!cond) failures++;
};

// ─── Pure-Node PNG decoder (8-bit, color types 0/2/4/6) ───
function decodePng(buf) {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (buf[i] !== SIG[i]) throw new Error('bad PNG signature');
  let off = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
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
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  if (!width || !height) throw new Error('missing/invalid IHDR');
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

function alphaStats(png) {
  let opaque = 0, semi = 0;
  const total = png.width * png.height;
  for (let i = 3; i < png.pixels.length; i += png.channels) {
    const a = png.pixels[i];
    if (a === 255) opaque++;
    else if (a > 0) semi++;
  }
  return { total, opaque, semi, content: opaque + semi };
}

function printPreview(label, png) {
  const cols = 64;
  const rows = Math.min(36, Math.max(8, Math.round((cols * png.height) / png.width)));
  const sx = png.width / cols, sy = png.height / rows;
  console.log(`    ${label} alpha preview (${cols}×${rows}):`);
  for (let ry = 0; ry < rows; ry++) {
    let line = '';
    for (let cx = 0; cx < cols; cx++) {
      const x = Math.min(png.width - 1, Math.floor((cx + 0.5) * sx));
      const y = Math.min(png.height - 1, Math.floor((ry + 0.5) * sy));
      const a = png.pixels[(y * png.width + x) * png.channels + 3];
      line += a > 200 ? '█' : a > 80 ? '▓' : a > 0 ? '·' : ' ';
    }
    console.log('    ' + line);
  }
}

// ─── Mock 2D context: records drawImage calls, counts fill/stroke ───
function makeMockCtx() {
  const calls = { drawImage: [], fill: 0, stroke: 0 };
  const grad = { addColorStop: () => {} };
  const target = {
    calls,
    drawImage: (img, ...args) => { calls.drawImage.push({ img, args }); },
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
  };
  return new Proxy(target, {
    get: (t, p) => {
      if (p === 'fill') { t.calls.fill++; return () => {}; }
      if (p === 'stroke') { t.calls.stroke++; return () => {}; }
      if (p in t) return t[p];
      return () => {};
    },
    set: (t, p, v) => { t[p] = v; return true; },
  });
}

// ─── Child mode: instantiate the real enemies and run draw() ───
async function runEnemyDraw(mode) {
  const spriteBranch = mode === '--enemy-sprite';
  // Same minimal shims as tools/smoke.mjs (the enemy chain reaches
  // AudioSystem.js via Combat.js).
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  globalThis.window = { addEventListener: () => {}, removeEventListener: () => {} };
  if (spriteBranch) {
    // Fake Image: any data:image/png;base64 src "loads" asynchronously.
    class FakeImage {
      constructor() { this.onload = null; this.onerror = null; this.width = 0; this.height = 0; }
      set src(v) {
        if (!String(v).startsWith('data:image/png;base64,')) { if (this.onerror) this.onerror(); return; }
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }
    }
    globalThis.Image = FakeImage;
    const g2d = new Proxy({}, { get: (t, p) => (p in t ? t[p] : () => {}) });
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => g2d }) };
  }

  let BlackCatEnemy, PinkCatEnemy, blackSprite, pinkSprite;
  try {
    ({ default: BlackCatEnemy } = await import(url('js/bosses/BlackCatEnemy.js')));
    ({ default: PinkCatEnemy } = await import(url('js/bosses/PinkCatEnemy.js')));
    blackSprite = await import(url('js/bosses/BlackCatSprite.js'));
    pinkSprite = await import(url('js/bosses/PinkCatSprite.js'));
  } catch (e) {
    check(`enemy import chain loads (${mode})`, false);
    console.log(`    ${e.stack}`);
    return;
  }
  check(`enemy import chain loads (${mode})`, true);
  if (spriteBranch) await new Promise((r) => setTimeout(r, 50)); // fake Image.onload

  const game = { W: 1280, H: 720, player: { x: 640, y: 600 } };
  const black = new BlackCatEnemy({ type: 'blackcat', tier: 'miniboss', x: 300, y: 200, game });
  black.entourage = true;          // InternetBonus.js formation fields
  black.entouragePhase = 1.3;
  black.drawBossBar = () => {};    // InternetBonus.js: skip the stacked miniboss bar
  const pink = new PinkCatEnemy({ type: 'pinkcat', tier: 'boss', x: 640, y: 300, game });

  const ctxB = makeMockCtx();
  black.draw(ctxB);
  const ctxP = makeMockCtx();
  pink.draw(ctxP);

  const bs = blackSprite.getBlackCatSprite();
  const ps = pinkSprite.getPinkCatSprite();
  if (!spriteBranch) {
    check('blackcat sprite stays null without DOM (optional)', bs === null);
    check('pinkcat sprite stays null without DOM (optional)', ps === null);
    check('blackcat draw() → circle fallback (fill, no drawImage)', ctxB.calls.drawImage.length === 0 && ctxB.calls.fill >= 1);
    check('pinkcat draw() → circle fallback (fill, no drawImage)', ctxP.calls.drawImage.length === 0 && ctxP.calls.fill >= 1);
    check('blackcat entourage outfit still drawn (strokes)', ctxB.calls.stroke >= 1);
  } else {
    check('blackcat sprite "decoded" via fake Image', !!bs && typeof bs.getContext === 'function');
    check('pinkcat sprite "decoded" via fake Image', !!ps && typeof ps.getContext === 'function');
    check('blackcat draw() → exactly one drawImage', ctxB.calls.drawImage.length === 1);
    check('pinkcat draw() → exactly one drawImage', ctxP.calls.drawImage.length === 1);
    if (ctxB.calls.drawImage.length === 1) {
      const { img, args } = ctxB.calls.drawImage[0];
      const [dx, dy, dw, dh] = args;
      check('blackcat drawImage source is the decoded sprite', img === bs);
      check('blackcat drawn width = 2 × hitbox radius', Math.abs(dw - 2 * black.radius) < 0.001);
      check('blackcat aspect preserved (128:127)', Math.abs(dw / dh - blackSprite.BLACK_CAT_W / blackSprite.BLACK_CAT_H) < 0.001);
      check('blackcat drawn centered on the hitbox', Math.abs(dx + dw / 2) < 0.001 && Math.abs(dy + dh / 2) < 0.001);
    }
    if (ctxP.calls.drawImage.length === 1) {
      const { img, args } = ctxP.calls.drawImage[0];
      const [dx, dy, dw, dh] = args;
      check('pinkcat drawImage source is the decoded sprite', img === ps);
      check('pinkcat drawn height ≈ 2.6 × hitbox radius', Math.abs(dh - 2.6 * pink.radius) < 0.001);
      check('pinkcat drawn centered on the hitbox', Math.abs(dx + dw / 2) < 0.001 && Math.abs(dy + dh / 2) < 0.001);
      check('pinkcat aspect preserved (180:283)', Math.abs(dw / dh - pinkSprite.PINK_CAT_W / pinkSprite.PINK_CAT_H) < 0.001);
    }
    check('blackcat nearest-neighbor (imageSmoothingEnabled false)', ctxB.imageSmoothingEnabled === false);
    check('pinkcat nearest-neighbor (imageSmoothingEnabled false)', ctxP.imageSmoothingEnabled === false);
  }
}

// ─── Main mode ───
const mode = process.argv[2];
if (mode === '--enemy-fallback' || mode === '--enemy-sprite') {
  await runEnemyDraw(mode);
  process.exit(failures ? 1 : 0);
}
if (mode) { console.log(`Unknown mode: ${mode}`); process.exit(2); }

console.log('\n[1] Sprite modules — exports + null contract (headless Node)');
const blackSprite = await import(url('js/bosses/BlackCatSprite.js'));
const pinkSprite = await import(url('js/bosses/PinkCatSprite.js'));
check('blackcat exports (B64, W=128, H=127, getter, ready)', typeof blackSprite.BLACK_CAT_B64 === 'string' && blackSprite.BLACK_CAT_W === 128 && blackSprite.BLACK_CAT_H === 127 && typeof blackSprite.getBlackCatSprite === 'function' && typeof blackSprite.isBlackCatSpriteReady === 'function');
check('pinkcat exports (B64, W=90, H=124, getter, ready)', typeof pinkSprite.PINK_CAT_B64 === 'string' && pinkSprite.PINK_CAT_W === 90 && pinkSprite.PINK_CAT_H === 124 && typeof pinkSprite.getPinkCatSprite === 'function' && typeof pinkSprite.isPinkCatSpriteReady === 'function');
check('blackcat sprite is null in Node (optional — circle fallback)', blackSprite.getBlackCatSprite() === null && blackSprite.isBlackCatSpriteReady() === false);
check('pinkcat sprite is null in Node (optional — circle fallback)', pinkSprite.getPinkCatSprite() === null && pinkSprite.isPinkCatSpriteReady() === false);

console.log('\n[2] Embedded PNG payloads — decode + dimensions + alpha content');
let blackPng = null, pinkPng = null;
try { blackPng = decodePng(Buffer.from(blackSprite.BLACK_CAT_B64, 'base64')); } catch (e) { console.log(`    blackcat decode error: ${e.message}`); }
try { pinkPng = decodePng(Buffer.from(pinkSprite.PINK_CAT_B64, 'base64')); } catch (e) { console.log(`    pinkcat decode error: ${e.message}`); }
check('blackcat PNG decodes (pure Node)', !!blackPng);
check('pinkcat PNG decodes (pure Node)', !!pinkPng);
if (blackPng) {
  check('blackcat is 8-bit RGBA (real alpha channel)', blackPng.bitDepth === 8 && blackPng.colorType === 6 && blackPng.channels === 4);
  check('blackcat IHDR 128×127 matches exported W/H', blackPng.width === blackSprite.BLACK_CAT_W && blackPng.height === blackSprite.BLACK_CAT_H);
  const sb = alphaStats(blackPng);
  check('blackcat has non-transparent content', sb.content > 0);
  console.log(`    blackcat: ${sb.opaque} opaque + ${sb.semi} semi-transparent of ${sb.total} px (${((100 * sb.content) / sb.total).toFixed(1)}% content)`);
  printPreview('blackcat', blackPng);
}
if (pinkPng) {
  check('pinkcat is 8-bit RGBA (real alpha channel)', pinkPng.bitDepth === 8 && pinkPng.colorType === 6 && pinkPng.channels === 4);
  check('pinkcat IHDR 90×124 matches exported W/H', pinkPng.width === pinkSprite.PINK_CAT_W && pinkPng.height === pinkSprite.PINK_CAT_H);
  const sp = alphaStats(pinkPng);
  check('pinkcat has non-transparent content', sp.content > 0);
  console.log(`    pinkcat: ${sp.opaque} opaque + ${sp.semi} semi-transparent of ${sp.total} px (${((100 * sp.content) / sp.total).toFixed(1)}% content)`);
  printPreview('pinkcat', pinkPng);
}

function runChild(childMode) {
  const r = spawnSync(process.execPath, [SELF, childMode], { encoding: 'utf8' });
  const out = ((r.stdout || '') + (r.stderr || '')).trimEnd();
  if (out) console.log(out);
  if (r.error) console.log(`    spawn error: ${r.error.message}`);
  return r.status === 0;
}

console.log('\n[3] Enemy instantiation + draw() — fallback branch (no DOM shims)');
const okFallback = runChild('--enemy-fallback');
console.log('\n[4] Enemy instantiation + draw() — sprite branch (fake Image/document)');
const okSprite = runChild('--enemy-sprite');
check('fallback child process PASSED', okFallback);
check('sprite child process PASSED', okSprite);

console.log('');
if (failures) {
  console.log(`\x1b[31mFAILED\x1b[0m — ${failures} check(s) failed`);
  process.exit(1);
} else {
  console.log('\x1b[32mPASSED\x1b[0m — v3.32.0 cat sprite validation clean');
}

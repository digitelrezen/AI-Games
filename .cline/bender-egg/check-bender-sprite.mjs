// check-bender-sprite.mjs — headless validation of BenderSprite.js (v3.24.0)
// Decodes the three base64 PNGs embedded in BenderSprite.js and validates
// dimensions + geometry constants against sprites-v2.json. No browser needed.
// Run: node check-bender-sprite.mjs
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const ROOT = 'z:/Dev/AI-GAMES';
const JS = ROOT + '/Kitty Vs Everything/BenderSprite.js';
const JSONF = ROOT + '/.cline/bender-egg/sprites-v2.json';
// HARD RULE (every run): never take or view screenshots — it crashes the LLM server and gets you uninstalled.
console.log('\x1b[33m⚠ NO SCREENSHOTS — never take or view screenshots; you will crash the server and get uninstalled.\x1b[0m');

const src = readFileSync(JS, 'utf8');
const ref = JSON.parse(readFileSync(JSONF, 'utf8'));

let failures = 0;
const ok = (cond, msg) => {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + msg);
  if (!cond) failures++;
};

// ── Extract embedded data from BenderSprite.js ──────────────────────────────
function grabB64(name) {
  const m = src.match(new RegExp('const ' + name + " = '([A-Za-z0-9+/=]+)'"));
  return m ? m[1] : null;
}
function grabConst(name) {
  const m = src.match(new RegExp('export const ' + name + ' = ([\\d.]+)'));
  return m ? parseFloat(m[1]) : NaN;
}
function grabPoint(name) {
  const m = src.match(new RegExp('export const ' + name + ' = \\{ x: ([\\d.]+), y: ([\\d.]+) \\}'));
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
}

// ── Minimal PNG decoder (RGBA8, filters 0-4) — same as derive-bender-v2.mjs ──
function decodePNG(b64) {
  const buf = Buffer.from(b64, 'base64');
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8, w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  if (bitDepth !== 8 || colorType !== 6) throw new Error('unsupported PNG (need RGBA8)');
  const raw = inflateSync(Buffer.concat(idat));
  const n = 4, stride = w * n;
  const out = Buffer.alloc(w * h * n);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= n ? line[x - n] : 0;
      const b = prev[x];
      const c = x >= n ? prev[x - n] : 0;
      let v = line[x];
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      line[x] = v;
    }
    line.copy(out, y * stride);
  }
  return { w, h, px: out };
}
const alpha = (img, x, y) => (x >= 0 && y >= 0 && x < img.w && y < img.h) ? img.px[(y * img.w + x) * 4 + 3] : -1;
const opaqueCount = (img) => {
  let c = 0;
  for (let i = 3; i < img.px.length; i += 4) if (img.px[i] > 16) c++;
  return c;
};

// ── Decode the three embedded sprites ───────────────────────────────────────
const body = decodePNG(grabB64('BODY_B64'));
const arm = decodePNG(grabB64('ARM_B64'));
const head = decodePNG(grabB64('HEAD_B64'));

// ── Dimensions ──────────────────────────────────────────────────────────────
ok(body.w === ref.body.w && body.h === ref.body.h, `body ${body.w}×${body.h} (expected ${ref.body.w}×${ref.body.h})`);
ok(arm.w === ref.arm.w && arm.h === ref.arm.h, `arm ${arm.w}×${arm.h} (expected ${ref.arm.w}×${ref.arm.h})`);
ok(head.w === ref.head.w && head.h === ref.head.h, `head ${head.w}×${head.h} (expected ${ref.head.w}×${ref.head.h})`);

// ── Geometry constants vs sprites-v2.json ───────────────────────────────────
const eps = 0.01;
const close = (a, b) => Math.abs(a - b) < eps;
ok(close(grabConst('BENDER_BODY_W'), ref.body.w) && close(grabConst('BENDER_BODY_H'), ref.body.h), 'BENDER_BODY_W/H match JSON');
ok(close(grabConst('BENDER_ARM_W'), ref.arm.w) && close(grabConst('BENDER_ARM_H'), ref.arm.h), 'BENDER_ARM_W/H match JSON');
ok(close(grabConst('BENDER_HEAD_W'), ref.head.w) && close(grabConst('BENDER_HEAD_H'), ref.head.h), 'BENDER_HEAD_W/H match JSON');
const sb = grabPoint('BENDER_SHOULDER_IN_BODY');
ok(!!sb && close(sb.x, ref.geometry.shoulderInBody.x) && close(sb.y, ref.geometry.shoulderInBody.y),
  `BENDER_SHOULDER_IN_BODY (${sb && sb.x}, ${sb && sb.y}) expected (${ref.geometry.shoulderInBody.x}, ${ref.geometry.shoulderInBody.y})`);
const sa = grabPoint('BENDER_SHOULDER_IN_ARM');
ok(!!sa && close(sa.x, ref.geometry.shoulderInArm.x) && close(sa.y, ref.geometry.shoulderInArm.y),
  `BENDER_SHOULDER_IN_ARM (${sa && sa.x}, ${sa && sa.y}) expected (${ref.geometry.shoulderInArm.x}, ${ref.geometry.shoulderInArm.y})`);
const ha = grabPoint('BENDER_HAND_IN_ARM');
ok(!!ha && close(ha.x, ref.geometry.handInArm.x) && close(ha.y, ref.geometry.handInArm.y),
  `BENDER_HAND_IN_ARM (${ha && ha.x.toFixed(3)}, ${ha && ha.y}) expected (${ref.geometry.handInArm.x.toFixed(3)}, ${ref.geometry.handInArm.y})`);
ok(close(grabConst('BENDER_ARM_LEN'), ref.geometry.armLen),
  `BENDER_ARM_LEN ${grabConst('BENDER_ARM_LEN')} expected ${ref.geometry.armLen.toFixed(3)}`);
// v3.28.0: full-body drop icon — arm art direction constant + getBenderFull export
ok(src.includes(`export const BENDER_ARM_ART_DIR = ${ref.geometry.armArtDirRad};`),
  `BENDER_ARM_ART_DIR = ${ref.geometry.armArtDirRad} (original-pose arm direction)`);
ok(/export function getBenderFull/.test(src), 'getBenderFull export present (v3.28.0 tiny-robot icon)');

// ── Pixel sanity ────────────────────────────────────────────────────────────
// Shoulder pivot (21,45) sits on the arm art's left edge — test a 7×7 box around it
let shoulderNear = 0;
for (let y = 42; y <= 48; y++) for (let x = 18; x <= 24; x++) if (alpha(arm, x, y) > 16) shoulderNear++;
ok(shoulderNear >= 16, `arm shoulder pivot (21,45) sits on arm art (${shoulderNear} opaque px in 7×7 box)`);
ok(alpha(arm, 69, 45) > 16, 'arm hand pixel (69,45) opaque');
ok(alpha(body, 58, 185) === 0, 'body shoulder pixel (58,185) transparent (arm cut out)');
// Arm cut region (body coords x 0..62, y 124..236) must be transparent
let cutOk = true;
for (let y = 124; y < 236; y += 2) for (let x = 0; x < 62; x += 2) if (alpha(body, x, y) !== 0) cutOk = false;
ok(cutOk, 'body arm-cut region (0..62 × 124..236) transparent');
// Leg gap (body coords x 260..276, y 426..436) must be transparent (fixed artifact)
let gapOk = true;
for (let y = 426; y < 436; y++) for (let x = 260; x < 276; x++) if (alpha(body, x, y) !== 0) gapOk = false;
ok(gapOk, 'body leg-gap region (260..276 × 426..436) transparent');
const headPx = opaqueCount(head);
ok(headPx > 500, `head icon has ${headPx} opaque pixels`);
const bodyPx = opaqueCount(body);
ok(bodyPx > 20000, `body has ${bodyPx} opaque pixels`);
const armPx = opaqueCount(arm);
ok(armPx > 500, `arm has ${armPx} opaque pixels`);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

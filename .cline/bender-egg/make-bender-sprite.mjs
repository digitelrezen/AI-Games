// make-bender-sprite.mjs — generate Kitty Vs Everything/BenderSprite.js
// from sprites-v2.json (derived by derive-bender-v2.mjs).
// Embeds the three base64 PNGs (body / arm / head) plus the geometry
// constants, following the base64-embedding style of MiniPosterSprite.js.
// Run: node make-bender-sprite.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = 'z:/Dev/AI-GAMES';
const SRC_JSON = ROOT + '/.cline/bender-egg/sprites-v2.json';
const OUT_JS = ROOT + '/Kitty Vs Everything/BenderSprite.js';

const j = JSON.parse(readFileSync(SRC_JSON, 'utf8'));
const r3 = (n) => Number(n.toFixed(3));

const header = `// Filename: BenderSprite.js
// Kitty Vs Everything — v3.24.0
// Bender pixel-art sprites: easter egg (body + animated cigar arm), the
// rare 'robot' power-up drop icon (tiny full-body robot, v3.28.0) and the
// head (legacy, kept for the headless checks).
//
// Derived from Z:\Dev\AI-GAMES\.assets\Robot-Bender Pixel Art.png (moved up one level) with pure pixel math
// (derive-bender-v2.mjs — no screenshots, no canvas at derive time):
//   body — full body, cigar-arm region cut out (easter egg)
//   arm  — cigar arm, pre-rotated so shoulder→hand points along +x,
//          shoulder translated into the sprite (animated reach arm)
//   head — head + antenna at /2 integer downsample (legacy)
//   full — body + arm re-composited at runtime in the original art pose
//          (power-up drop icon — the tiny robot, v3.28.0)
// Embedded as base64 PNGs, same style as MiniPosterSprite.js.
//
// Geometry (art pixels — source: .cline/bender-egg/sprites-v2.json):
//   body ${j.body.w}×${j.body.h} | arm ${j.arm.w}×${j.arm.h} | head ${j.head.w}×${j.head.h}
//   shoulder in body: (${j.geometry.shoulderInBody.x}, ${j.geometry.shoulderInBody.y})
//   shoulder in arm:  (${j.geometry.shoulderInArm.x}, ${j.geometry.shoulderInArm.y})
//   hand in arm:      (${r3(j.geometry.handInArm.x)}, ${j.geometry.handInArm.y})
//   arm length (shoulder→hand): ${r3(j.geometry.armLen)}
//   arm art direction (original pose): ${j.geometry.armArtDirRad} rad
//
// GENERATED FILE — regenerate with: node .cline/bender-egg/make-bender-sprite.mjs

export const BENDER_BODY_W = ${j.body.w};
export const BENDER_BODY_H = ${j.body.h};
export const BENDER_ARM_W = ${j.arm.w};
export const BENDER_ARM_H = ${j.arm.h};
export const BENDER_HEAD_W = ${j.head.w};
export const BENDER_HEAD_H = ${j.head.h};
export const BENDER_SHOULDER_IN_BODY = { x: ${j.geometry.shoulderInBody.x}, y: ${j.geometry.shoulderInBody.y} };
export const BENDER_SHOULDER_IN_ARM = { x: ${j.geometry.shoulderInArm.x}, y: ${j.geometry.shoulderInArm.y} };
export const BENDER_HAND_IN_ARM = { x: ${r3(j.geometry.handInArm.x)}, y: ${j.geometry.handInArm.y} };
export const BENDER_ARM_LEN = ${r3(j.geometry.armLen)};
export const BENDER_ARM_ART_DIR = ${j.geometry.armArtDirRad}; // original-pose arm direction (rad)

const BODY_B64 = '${j.body.b64}';
const ARM_B64 = '${j.arm.b64}';
const HEAD_B64 = '${j.head.b64}';

let bodyCanvas = null;
let armCanvas = null;
let headCanvas = null;
let fullCanvas = null;

function makeCanvas(b64, w, h) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = () => resolve(null);
    img.src = 'data:image/png;base64,' + b64;
  });
}

function loadBenderSprites() {
  return Promise.all([
    makeCanvas(BODY_B64, BENDER_BODY_W, BENDER_BODY_H),
    makeCanvas(ARM_B64, BENDER_ARM_W, BENDER_ARM_H),
    makeCanvas(HEAD_B64, BENDER_HEAD_W, BENDER_HEAD_H),
  ]).then(([b, a, hd]) => {
    bodyCanvas = b;
    armCanvas = a;
    headCanvas = hd;
    return !!(b && a && hd);
  });
}

/** v3.28.0: tiny full-body robot for the 'robot' power-up drop icon —
 *  body + cigar arm re-composited in the ORIGINAL art pose (the arm art
 *  is pre-rotated so shoulder→hand = +x, so rotate back by the art
 *  direction, pivoting at the body's shoulder). Built lazily + cached;
 *  headless-safe (returns null until both canvases are decoded). */
function buildFull() {
  if (fullCanvas || !bodyCanvas || !armCanvas) return fullCanvas;
  const c = document.createElement('canvas');
  c.width = BENDER_BODY_W;
  c.height = BENDER_BODY_H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(bodyCanvas, 0, 0);
  g.save();
  g.translate(BENDER_SHOULDER_IN_BODY.x, BENDER_SHOULDER_IN_BODY.y);
  g.rotate(BENDER_ARM_ART_DIR);
  g.drawImage(armCanvas, -BENDER_SHOULDER_IN_ARM.x, -BENDER_SHOULDER_IN_ARM.y);
  g.restore();
  fullCanvas = c;
  return c;
}

export function getBenderBody() { return bodyCanvas; }
export function getBenderArm() { return armCanvas; }
export function getBenderHead() { return headCanvas; }
export function getBenderFull() { return buildFull(); }
export function isBenderSpriteReady() { return !!(bodyCanvas && armCanvas && headCanvas); }

loadBenderSprites().catch(() => {}); // v3.24.0: kick off decode at import
`;

writeFileSync(OUT_JS, header);
console.log(`wrote ${OUT_JS} (${header.length} chars)`);
console.log(`embedded: body ${j.body.w}x${j.body.h} (${j.body.b64.length} b64), arm ${j.arm.w}x${j.arm.h} (${j.arm.b64.length} b64), head ${j.head.w}x${j.head.h} (${j.head.b64.length} b64)`);

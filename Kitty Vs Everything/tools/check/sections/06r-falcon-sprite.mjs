// ═══════════════════════════════════════════════════════════
//  [6r] v3.65.0 FALCON PIXEL-ART SPRITE — diving raptor now draws
//       the shared PNG (key "falcon", 718×718 → 128×128) with a
//       beak-lead dive rotation (heading eases toward the dive
//       vector, blit rotated by heading + PI/2 since the art faces
//       up) + wing-beat (t*6) + hover bob + type-color accent glow;
//       procedural fallback retained
// ═══════════════════════════════════════════════════════════

import { ROOT, check, makeGame, makePlayer, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const { ENEMY_TYPES, WAVE } = await mod('js/core/config.js');
const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');
  const { default: BaseWeapon } = await mod('js/combat/BaseWeapon.js');
    const w = new BaseWeapon(makePlayer(makeGame()), 'vulkan');
  const makeRocketGame = () => { const g = makeGame(); g.enemies = []; g.player = { minis: [] }; g.fireZones = []; return g; };
    const g = makeRocketGame();

export default async function run() {
console.log('\n[6r] v3.65.0 falcon pixel-art sprite');
{
  const faSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/FalconEnemy.js'), 'utf8');
  check('FalconEnemy: VERSION = v1.2.0', faSrc.includes("VERSION = 'v1.2.0'"));
  check('FalconEnemy: sprite key "falcon" via AssetManager', faSrc.includes("FALCON_SPRITE_KEY = 'falcon'") && faSrc.includes('getSprite(FALCON_SPRITE_KEY)'));
  check('FalconEnemy: null-sprite → procedural fallback branch', faSrc.includes('this._drawProcedural(ctx, r)'));
  check('FalconEnemy: beak-lead dive heading eases toward the dive vector (dh * 0.18)', faSrc.includes('this._heading += dh * 0.18'));
  check('FalconEnemy: blit rotated by heading + PI/2 (art faces up)', faSrc.includes('this._heading + Math.PI / 2'));
  check('FalconEnemy: wing-beat (t*6) + hover bob phase-locked to the procedural flap', faSrc.includes('const flap = Math.sin(this.t * 6)') && faSrc.includes('const bob = Math.sin(this.t * 3)'));
  check('FalconEnemy: aspect-preserving nearest-neighbor draw', faSrc.includes('(targetW * dims.h) / dims.w') && faSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('FalconEnemy: type-color accent glow pass', faSrc.includes('ctx.shadowColor = this.color') && faSrc.includes('ctx.shadowBlur = r * 0.8'));
  check('FalconEnemy: procedural fallback art intact (wings/tail fan/talons)', faSrc.includes('tailSpread') && faSrc.includes('lwGrad') && faSrc.includes('bodyGrad'));
  check('FalconEnemy: dive multiplier * 1.5 + attack fireAtPlayer(a, 280, 1) unchanged', faSrc.includes('s * dt * 1.5') && faSrc.includes('fireAtPlayer(a, 280, 1)'));
  check('config: ENEMY_TYPES.falcon intact (color/speed/hp/damage/fireRate/pattern)',
    ENEMY_TYPES.falcon && ENEMY_TYPES.falcon.color === '#b0713a' && ENEMY_TYPES.falcon.speed === 3.2 &&
    ENEMY_TYPES.falcon.hp === 22 && ENEMY_TYPES.falcon.damage === 12 && ENEMY_TYPES.falcon.fireRate === 1.0 &&
    ENEMY_TYPES.falcon.pattern === 'dive',
    `got ${JSON.stringify(ENEMY_TYPES.falcon)}`);
  check('AssetSprites: falcon sprite dims 128×128 registered', /falcon:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(spritesSrc));
  check('AssetSprites: falcon source 718×718 → 128×128', /falcon: "Falcon pixel_art\.png \(718×718 → 128×128,/.test(spritesSrc));
  // v3.71.1 regression gate: the embedded falcon art must face UP (beak in
  // the top half). Since v3.65.0 the source PNG was stored vertically
  // flipped (beak down), so the raptor rendered upside down on canvas —
  // headless decode of the embedded b64 (pure Node zlib, no DOM).
  {
    const falconB64 = (spritesSrc.match(/falcon: "([A-Za-z0-9+/=]+)"/) || [])[1];
    let beakTop = 0, beakTotal = 0;
    if (falconB64) {
      const buf = Buffer.from(falconB64, 'base64');
      let off = 8, w = 0, h = 0, ch = 0;
      const idat = [];
      while (off + 12 <= buf.length) {
        const len = buf.readUInt32BE(off);
        const type = buf.toString('ascii', off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[data[9]]; }
        else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        off += 12 + len;
      }
      const stride = w * ch;
      const raw = zlib.inflateSync(Buffer.concat(idat));
      const px = Buffer.alloc(h * stride);
      for (let y = 0; y < h; y++) {
        const filter = raw[y * (stride + 1)];
        const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
        for (let x = 0; x < stride; x++) {
          const a = x >= ch ? px[y * stride + x - ch] : 0;
          const b = prev ? prev[x] : 0;
          const c = prev && x >= ch ? prev[x - ch] : 0;
          let v = line[x];
          if (filter === 1) v = (v + a) & 255;
          else if (filter === 2) v = (v + b) & 255;
          else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
          else if (filter === 4) { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
          px[y * stride + x] = v;
        }
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * ch;
        const r = px[i], g = px[i + 1], b = px[i + 2], al = ch === 4 ? px[i + 3] : 255;
        if (al < 16) continue;
        if (r > 170 && g > 90 && g < 215 && b < 125 && r > g && g > b) {
          beakTotal++;
          if (y < h / 2) beakTop++;
        }
      }
    }
    check('AssetSprites: falcon art faces up — beak pixels in top half (v3.71.1 flip fix)', beakTotal > 0 && beakTop > beakTotal / 2, `beak pixels top/bottom: ${beakTop}/${beakTotal - beakTop}`);
  }
}

}

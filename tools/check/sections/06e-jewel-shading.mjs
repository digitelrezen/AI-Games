// ═══════════════════════════════════════════════════════════
//  [6e] v3.58.0 JEWEL SHADING — all FIVE pill/poster drops
//      (life / health / frenzy / shield / mini) render through
//      the programmatic drawJewelDrop() 6-pass gem pipeline
//      (depth → shine → aura → base blit → shimmer → sparkles);
//      headless-safe (no DOM → base fallback only)
// ═══════════════════════════════════════════════════════════

import { PowerUp, ROOT, check, makeGame } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
console.log('\n[6e] v3.58.0 jewel shading (all five pill/poster drops)');
const pwSrc = fs.readFileSync(path.join(ROOT, 'js/combat/PowerUp.js'), 'utf8');
check('PowerUp: VERSION = v3.88.0', pwSrc.includes("VERSION = 'v3.88.0'"));
check('PowerUp: drawJewelDrop() gem pipeline (source-atop depth + lighter glow)',
  pwSrc.includes('function drawJewelDrop(') &&
  pwSrc.includes("globalCompositeOperation = 'source-atop'") &&
  pwSrc.includes("globalCompositeOperation = 'lighter'"));
check('PowerUp: 5-type jewel aura palette (blue/green/red/gold/bounty)',
  pwSrc.includes("life:   { aura: '64, 140, 255'") &&
  pwSrc.includes("health: { aura: '64, 220, 110'") &&
  pwSrc.includes("frenzy: { aura: '255, 64, 54'") &&
  pwSrc.includes("shield: { aura: '255, 205, 40'") &&
  pwSrc.includes("mini:   { aura: '255, 220, 120'"));
check('PowerUp: 5-type sparkle palette in pill theme colors',
  pwSrc.includes("life:   { rgb: '110, 180, 255', count: 7 }") &&
  pwSrc.includes("health: { rgb: '110, 240, 150', count: 7 }") &&
  pwSrc.includes("frenzy: { rgb: '255, 100, 90',  count: 7 }") &&
  pwSrc.includes("shield: { rgb: '255, 214, 90',  count: 7 }") &&
  pwSrc.includes("mini:   { rgb: '255, 236, 170', count: 8 }"));
check('PowerUp: life drop routes through the jewel pass', pwSrc.includes("drawJewelDrop(ctx, 'life', this.t,"));
check('PowerUp: health drop routes through the jewel pass', pwSrc.includes("drawJewelDrop(ctx, 'health', this.t,"));
check('PowerUp: frenzy drop routes through the jewel pass', pwSrc.includes("drawJewelDrop(ctx, 'frenzy', this.t,"));
check('PowerUp: shield drop routes through the jewel pass', pwSrc.includes("drawJewelDrop(ctx, 'shield', this.t,"));
check('PowerUp: mini drop routes through the jewel pass', pwSrc.includes("drawJewelDrop(ctx, 'mini', this.t,"));
check('PowerUp: jewel buffer is headless-guarded (no DOM → base only)',
  pwSrc.includes("typeof document === 'undefined'") &&
  pwSrc.includes('if (!buf) { drawBase(ctx); return; }'));
check('PowerUp: procedural fallbacks preserved (heart/cross/bolt/hexagon/cat)',
  pwSrc.includes('#ff5252') && pwSrc.includes('#66bb6a') && pwSrc.includes('#ffd600') &&
  pwSrc.includes('#4fc3f7') && pwSrc.includes('#ff9d3b'));
// Headless draw smoke: all three jewel drops must draw with a bare mock
// ctx (no DOM canvas) — the jewel pass falls back to the base glyph.
{
  const game = makeGame();
  const mockCtx = {
    save() {}, restore() {}, translate() {}, beginPath() {}, moveTo() {}, lineTo() {},
    closePath() {}, bezierCurveTo() {}, arc() {}, fill() {}, stroke() {}, fillRect() {},
    strokeRect() {}, drawImage() {}, clearRect() {},
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
  };
  for (const type of ['life', 'health', 'frenzy', 'shield', 'mini']) {
    const pw = new PowerUp({ x: 100, y: 100, type, game });
    let ok = true;
    try { pw.draw(mockCtx); } catch { ok = false; }
    check(`headless: ${type} drop draws without a DOM canvas (jewel pass → base fallback)`, ok);
  }
}

}

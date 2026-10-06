// ═══════════════════════════════════════════════════════════
//  [6ae] v3.82.0 SPACEBALLS ONE — one-way flyby flipped to
//        bottom-right → top-left (SpaceballsOne.js); the rare
//        per-wave roll lives in EasterEgg.maybeSpawnSpaceballs
//        (js/core/EasterEgg.js), called from WaveManager.startNext
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
  console.log('\n[6ae] v3.82.0 Spaceballs One one-way flyby');
  const src = fs.readFileSync(path.join(ROOT, 'js/modes/EasterEggs/SpaceballsOne/SpaceballsOne.js'), 'utf8');
  check('SpaceballsOne: v3.82.0 header', src.includes('// Kitty Vs Everything — v3.82.0'));
  check('SpaceballsOne: one-way flyby spawns off-screen bottom-right', src.includes('this.x = W + 120') && src.includes('this.y = H + 120'));
  check('SpaceballsOne: velocity points up-left (dx < 0, dy < 0)', src.includes('const dx = -(W + 240), dy = -(H + 240)'));
  check('SpaceballsOne: despawns fully off-screen top-left (no flip/return)', src.includes('if (this.x < -200 && this.y < -120)') && !src.includes('strafeDir'));
  check('SpaceballsOne: tuning unchanged (speed 400 px/s, scale 1.75)', src.includes('speed: 400') && src.includes('scale: 1.75'));
  const { SPACEBALLS_ONE } = await mod('js/modes/EasterEggs/SpaceballsOne/SpaceballsOne.js');
  check('SPACEBALLS_ONE: spawn roll + per-mission cap', SPACEBALLS_ONE.spawnChance > 0 && SPACEBALLS_ONE.maxPerRun === 2, `got ${JSON.stringify(SPACEBALLS_ONE)}`);
  const eggSrc = fs.readFileSync(path.join(ROOT, 'js/core/EasterEgg.js'), 'utf8');
  check('EasterEgg: maybeSpawnSpaceballs roll (spawnChance + maxPerRun cap)', eggSrc.includes('maybeSpawnSpaceballs') && eggSrc.includes('SPACEBALLS_ONE.spawnChance') && eggSrc.includes('SPACEBALLS_ONE.maxPerRun'));
  const wmSrc = fs.readFileSync(path.join(ROOT, 'js/core/WaveManager.js'), 'utf8');
  check('WaveManager: startNext rolls for Spaceballs One', wmSrc.includes('maybeSpawnSpaceballs'));
  const artSrc = fs.readFileSync(path.join(ROOT, 'js/modes/EasterEggs/SpaceballsOne/SpaceballsOneArt.js'), 'utf8');
  check('SpaceballsOneArt: auto-rotates to the heading (bottom-right → top-left)', artSrc.includes('bottom-right') && artSrc.includes('top-left') && artSrc.includes('rotated'));
}

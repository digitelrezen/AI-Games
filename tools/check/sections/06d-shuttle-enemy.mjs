// ═══════════════════════════════════════════════════════════
//  [6d] v3.50.0 SHUTTLE ENEMY — 17th species: regular waves
//      only (ENEMY_TYPES → WaveManager pool), Bone Yard Phase 2
//      locked to an explicit humanoid allowlist (BoneYardBonus.js)
//  v3.82.0: round-trip flyby — spawns off-screen right, flies left,
//      flips only fully off-screen (mirrored return pass), loops until
//      destroyed (noEscape exempts it from the 80px cull in EnemyBase).
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const wmSrc = fs.readFileSync(path.join(ROOT, 'js/core/WaveManager.js'), 'utf8');

export default async function run() {
console.log('\n[6d] shuttle enemy (19 species, v3.82.0 round-trip flyby)');
const { ENEMY_TYPES, WAVE } = await mod('js/core/config.js');
check('config: ENEMY_TYPES has 19 species (shuttle + moth + squirrel)', Object.keys(ENEMY_TYPES).length === 19, `got ${Object.keys(ENEMY_TYPES).length}: ${Object.keys(ENEMY_TYPES).join(', ')}`);
check('config: shuttle entry (Space Shuttle, glide pattern)', ENEMY_TYPES.shuttle && ENEMY_TYPES.shuttle.name === 'Space Shuttle' && ENEMY_TYPES.shuttle.pattern === 'glide', `got ${JSON.stringify(ENEMY_TYPES.shuttle)}`);
check('config: WAVE.SPECIES_COUNT = 19', WAVE.SPECIES_COUNT === 19, `got ${WAVE.SPECIES_COUNT}`);
const { isValidEnemyType, getEnemyClass, getEnemyTypeIds } = await mod('js/enemies/EnemyFactory.js');
check('EnemyFactory: shuttle registered in REGISTRY', isValidEnemyType('shuttle') && getEnemyTypeIds().includes('shuttle'));
check('EnemyFactory: getEnemyClass("shuttle") is the ShuttleEnemy class', typeof getEnemyClass('shuttle') === 'function' && getEnemyClass('shuttle').name === 'ShuttleEnemy', `got ${getEnemyClass('shuttle') && getEnemyClass('shuttle').name}`);
const { default: ShuttleEnemy } = await mod('js/enemies/ShuttleEnemy.js');
const seSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/ShuttleEnemy.js'), 'utf8');
check('ShuttleEnemy: extends EnemyBase, sprite key "shuttle", banked-strafe + telegraph', Object.getPrototypeOf(ShuttleEnemy.prototype).constructor.name === 'EnemyBase' && seSrc.includes("SHUTTLE_SPRITE_KEY = 'shuttle'") && seSrc.includes('this.bank') && seSrc.includes('this.telegraph'));
// Regular waves: WaveManager's species pool is Object.keys(ENEMY_TYPES) —
// a headless instance must list shuttle + moth + squirrel among its 19 species.
const { default: WaveManager } = await mod('js/core/WaveManager.js');
const wm = new WaveManager({});
check('WaveManager: regular-wave species pool includes shuttle + moth + squirrel (19 total)', wm.species.includes('shuttle') && wm.species.includes('moth') && wm.species.includes('squirrel') && wm.species.length === 19, `got ${wm.species.length}: ${wm.species.join(', ')}`);
check('WaveManager: species pool comes from ENEMY_TYPES (source gate)', wmSrc.includes('this.species = Object.keys(ENEMY_TYPES)'));
// Bone Yard Phase 2/3: explicit humanoid allowlist — a new species can
// never leak into the march.
const bySrc = fs.readFileSync(path.join(ROOT, 'js/levels/BoneYardBonus.js'), 'utf8');
check('BoneYardBonus: explicit humanoid allowlist is [\'human\']', /BONE_YARD_HUMANOID_TYPES\s*=\s*\[\s*'human'\s*\]/.test(bySrc));
check('BoneYardBonus: phase 2/3 spawn uses the allowlist (not a bare type)', bySrc.includes('type: BONE_YARD_HUMANOID_TYPES[0]'));
// Generated sprite data carries the shuttle PNG (128×60).
const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');
check('AssetSprites: shuttle sprite dims 128×60 registered', /shuttle:\s*\{\s*w:\s*128,\s*h:\s*60\s*\}/.test(spritesSrc));
// v3.82.0: round-trip flyby — spawn off-screen right, flip only fully
// off-screen, mirror the sprite on the return pass, noEscape beats the
// 80px off-screen cull in EnemyBase.update().
check('ShuttleEnemy: v1.1.0 round-trip flyby (spawn right, noEscape, off-screen flip)',
  seSrc.includes("export const VERSION = 'v1.1.0'") &&
  seSrc.includes('this.noEscape = true') &&
  seSrc.includes('this.x = this.game.W + 140') &&
  seSrc.includes('this.strafeDir = -1') &&
  seSrc.includes('if (this.strafeDir === -1 && this.x < -margin) this.strafeDir = 1;') &&
  seSrc.includes('if (this.strafeDir === 1 && this.x > this.game.W + margin) this.strafeDir = -1;'));
check('ShuttleEnemy: return pass mirrors the sprite (ctx.scale(-1, 1))', seSrc.includes('if (this.strafeDir === 1) ctx.scale(-1, 1)'));
check('ShuttleEnemy: shootTimer counts down in move() (telegraph contract)', seSrc.includes('this.shootTimer -= dt'));
const ebSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/EnemyBase.js'), 'utf8');
check('EnemyBase: noEscape flag gates the 80px off-screen cull (v3.36.0)', (await mod('js/enemies/EnemyBase.js')).VERSION === 'v3.36.0' && ebSrc.includes('this.noEscape = false') && ebSrc.includes('!this.noEscape && (this.y > this.game.H + 80'));
const { TIERS } = await mod('js/core/config.js');
const mobTier = Object.keys(TIERS).find((k) => !TIERS[k].special);
let shots = 0;
const g = { W: 1280, H: 720, player: { x: 640, y: 360 }, spawnEnemyBullet() { shots++; } };
const shuttle = new ShuttleEnemy({ type: 'shuttle', tier: mobTier, x: 0, y: 0, game: g });
check('ShuttleEnemy: spawns off-screen right at flight altitude (nose left)', shuttle.x > 1280 && shuttle.y >= 80 && shuttle.y <= 180 && shuttle.strafeDir === -1 && shuttle.noEscape === true, `x=${shuttle.x} y=${shuttle.y}`);
const sx0 = shuttle.x;
shuttle.move(1 / 60, 1);
check('ShuttleEnemy: first pass flies left (off-screen spawn → stage)', shuttle.x < sx0, `x0=${sx0} x1=${shuttle.x}`);
shuttle.x = -100;
shuttle.move(1 / 60, 1);
check('ShuttleEnemy: flips to the return pass fully off-screen left', shuttle.strafeDir === 1);
shuttle.x = 1380;
shuttle.move(1 / 60, 1);
check('ShuttleEnemy: flips back to the outbound pass fully off-screen right', shuttle.strafeDir === -1);
shuttle.x = -100;
shuttle.update(1 / 60);
check('ShuttleEnemy: survives fully off-screen (noEscape beats the 80px cull)', shuttle.alive === true && shuttle.escaped === false);
shuttle.shootTimer = 0;
shuttle.update(1 / 60);
for (let i = 0; i < 30 && shots === 0; i++) shuttle.move(1 / 60, 1);
check('ShuttleEnemy: telegraphed cannon shot fires after the 0.4s aim ring', shots === 1, `shots=${shots}`);
}

// ═══════════════════════════════════════════════════════════
//  [6d] v3.50.0 SHUTTLE ENEMY — 17th species: regular waves
//      only (ENEMY_TYPES → WaveManager pool), Bone Yard Phase 2
//      locked to an explicit humanoid allowlist (BoneYardBonus.js)
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const wmSrc = fs.readFileSync(path.join(ROOT, 'js/core/WaveManager.js'), 'utf8');

export default async function run() {
console.log('\n[6d] v3.50.0 shuttle enemy (17th species)');
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

}

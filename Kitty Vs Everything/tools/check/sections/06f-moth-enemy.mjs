// ═══════════════════════════════════════════════════════════
//  [6f] v3.52.0 MOTH ENEMY — 18th species: regular waves only
//      (ENEMY_TYPES → WaveManager pool), Bone Yard Phase 2 stays
//      locked to the explicit humanoid allowlist (BoneYardBonus.js)
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const { ENEMY_TYPES, WAVE } = await mod('js/core/config.js');
const { isValidEnemyType, getEnemyClass, getEnemyTypeIds } = await mod('js/enemies/EnemyFactory.js');
const bySrc = fs.readFileSync(path.join(ROOT, 'js/levels/BoneYardBonus.js'), 'utf8');
const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');

export default async function run() {
console.log('\n[6f] v3.52.0 moth enemy (18th species)');
check('config: moth entry (Moth, erratic pattern)', ENEMY_TYPES.moth && ENEMY_TYPES.moth.name === 'Moth' && ENEMY_TYPES.moth.pattern === 'erratic', `got ${JSON.stringify(ENEMY_TYPES.moth)}`);
check('EnemyFactory: moth registered in REGISTRY', isValidEnemyType('moth') && getEnemyTypeIds().includes('moth'));
check('EnemyFactory: getEnemyClass("moth") is the MothEnemy class', typeof getEnemyClass('moth') === 'function' && getEnemyClass('moth').name === 'MothEnemy', `got ${getEnemyClass('moth') && getEnemyClass('moth').name}`);
const { default: MothEnemy } = await mod('js/enemies/MothEnemy.js');
const meSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/MothEnemy.js'), 'utf8');
check('MothEnemy: extends EnemyBase, sprite key "moth", erratic dart + flutter', Object.getPrototypeOf(MothEnemy.prototype).constructor.name === 'EnemyBase' && meSrc.includes("MOTH_SPRITE_KEY = 'moth'") && meSrc.includes('this._dartX') && meSrc.includes('this._dartT'));
// Generated sprite data carries the moth PNG (128×128).
check('AssetSprites: moth sprite dims 128×128 registered', /moth:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(spritesSrc));
// Bone Yard Phase 2/3: explicit humanoid allowlist — the moth can never
// leak into the march.
check('BoneYardBonus: humanoid allowlist excludes moth', /BONE_YARD_HUMANOID_TYPES\s*=\s*\[\s*'human'\s*\]/.test(bySrc));

}

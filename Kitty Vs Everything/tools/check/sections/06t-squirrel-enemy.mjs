// ═══════════════════════════════════════════════════════════
//  [6t] v3.67.0 SQUIRREL ENEMY (19th species) — fast, erratic
//       tree-dweller with a bushy tail; draws the shared PNG
//       (key "squirrel", 256×256 → 128×128) upright (head up,
//       centered mass) with a scurry bounce (t*16) + twitchy
//       wobble (t*4.2) + sprint stretch + type-color accent
//       glow; procedural fallback retained; scurry + hop
//       movement, light aimed shot
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const { ENEMY_TYPES, WAVE } = await mod('js/core/config.js');
const { isValidEnemyType, getEnemyClass, getEnemyTypeIds } = await mod('js/enemies/EnemyFactory.js');
const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');

export default async function run() {
console.log('\n[6t] v3.67.0 squirrel enemy (19th species)');
{
  const sqSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/SquirrelEnemy.js'), 'utf8');
  check('SquirrelEnemy: VERSION = v1.0.0', sqSrc.includes("VERSION = 'v1.0.0'"));
  check('SquirrelEnemy: sprite key "squirrel" via AssetManager', sqSrc.includes("SQUIRREL_SPRITE_KEY = 'squirrel'") && sqSrc.includes('getSprite(SQUIRREL_SPRITE_KEY)'));
  check('SquirrelEnemy: null-sprite → procedural fallback branch', sqSrc.includes('this._drawProcedural(ctx, r)'));
  check('SquirrelEnemy: scurry bounce (t*16) + twitchy wobble (t*4.2)', sqSrc.includes('const bounce = Math.sin(this.t * 16)') && sqSrc.includes('const wobble = Math.sin(this.t * 4.2) * 0.07'));
  check('SquirrelEnemy: aspect-preserving nearest-neighbor draw', sqSrc.includes('(targetW * dims.h) / dims.w') && sqSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('SquirrelEnemy: type-color accent glow pass', sqSrc.includes('ctx.shadowColor = this.color') && sqSrc.includes('ctx.shadowBlur = r * 0.8'));
  check('SquirrelEnemy: procedural fallback art intact (bushy tail/body/perked ears)', sqSrc.includes('tailGrad') && sqSrc.includes('bodyGrad') && sqSrc.includes('#ffd54f'));
  check('SquirrelEnemy: fast scurry descent + erratic hop + lateral sprints', sqSrc.includes('s * dt * 0.95') && sqSrc.includes('this._hopVy') && sqSrc.includes('this._sprintVx') && sqSrc.includes('this._sprintT'));
  check('SquirrelEnemy: light aimed shot fireAtPlayer(a, 260, 0.85)', sqSrc.includes('fireAtPlayer(this.angleToPlayer(), 260, 0.85)'));
  check('config: ENEMY_TYPES.squirrel registered (speed 3.4 / hp 12 / damage 7 / scurry)',
    ENEMY_TYPES.squirrel && ENEMY_TYPES.squirrel.name === 'Squirrel' && ENEMY_TYPES.squirrel.color === '#a5622d' &&
    ENEMY_TYPES.squirrel.speed === 3.4 && ENEMY_TYPES.squirrel.hp === 12 && ENEMY_TYPES.squirrel.damage === 7 &&
    ENEMY_TYPES.squirrel.fireRate === 0.7 && ENEMY_TYPES.squirrel.pattern === 'scurry',
    `got ${JSON.stringify(ENEMY_TYPES.squirrel)}`);
  check('EnemyFactory: squirrel registered in REGISTRY', isValidEnemyType('squirrel') && getEnemyTypeIds().includes('squirrel'));
  check('EnemyFactory: getEnemyClass("squirrel") is the SquirrelEnemy class', typeof getEnemyClass('squirrel') === 'function' && getEnemyClass('squirrel').name === 'SquirrelEnemy', `got ${getEnemyClass('squirrel') && getEnemyClass('squirrel').name}`);
  const { default: SquirrelEnemy } = await mod('js/enemies/SquirrelEnemy.js');
  check('SquirrelEnemy: extends EnemyBase', Object.getPrototypeOf(SquirrelEnemy.prototype).constructor.name === 'EnemyBase');
  check('AssetSprites: squirrel sprite dims 128×128 registered', /squirrel:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(spritesSrc));
  check('AssetSprites: squirrel source 256×256 → 128×128', /squirrel: "Squirel-256x256\.png \(256×256 → 128×128,/.test(spritesSrc));
}

}

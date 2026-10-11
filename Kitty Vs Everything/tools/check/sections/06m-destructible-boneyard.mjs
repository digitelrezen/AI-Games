// ═══════════════════════════════════════════════════════════
//  [6m] v3.60.0 FULLY DESTRUCTIBLE BONE YARD — the yard opens on a
//       seeded field of 29 shootable bones; per-key radius/HP/score
//       bands (500/1000/2000); weighted spawn pool (40/40/15/5);
//       the v3.15.0 non-shootable backdrop is gone.
//       v4.25.0: the 8 bone columns (BONUS.BONE_YARD_COLUMNS) are now
//       SHOOTABLE too — 80 fixed BoneFragment entities (v2.5.0) in
//       game.bonusTargets, shot through the normal Collisions.js path.
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const bySrc = fs.readFileSync(path.join(ROOT, 'js/levels/BoneYardBonus.js'), 'utf8');

export default async function run() {
console.log('\n[6m] v3.60.0 fully destructible Bone Yard');
{
  const { BONUS } = await mod('js/core/config.js');
  const bfSrc = fs.readFileSync(path.join(ROOT, 'js/levels/BoneFragment.js'), 'utf8');
  check('config: BONUS.BONE_YARD_FIELD = 10 femur / 10 profile_bone / 6 skull / 3 skeleton', BONUS.BONE_YARD_FIELD && BONUS.BONE_YARD_FIELD.femur === 10 && BONUS.BONE_YARD_FIELD.profile_bone === 10 && BONUS.BONE_YARD_FIELD.skull === 6 && BONUS.BONE_YARD_FIELD.skeleton === 3);
  check('BoneYardBonus: VERSION = v3.77.0', bySrc.includes("VERSION = 'v3.77.0'"));
  check('BoneYardBonus: non-destructible backdrop removed (BONEYARD_BG_* gone)', !bySrc.includes('BONEYARD_BG_KEYS') && !bySrc.includes('BONEYARD_BG_BASE') && !bySrc.includes('BONEYARD_BG_COUNTS'));
  check('BoneYardBonus: _buildBackground/_drawProceduralBg removed', !bySrc.includes('_buildBackground') && !bySrc.includes('_drawProceduralBg'));
  // v4.25.0: the columns are SHOOTABLE fixed BoneFragment entities
  // (_buildColumns) — the old draw-only _drawColumns pass is gone; the
  // stage's draw() now only paints the house centerpiece.
  check('BoneYardBonus: v4.25.0 shootable columns (_buildColumns) + house draw', bySrc.includes('draw(ctx) {') && bySrc.includes('_buildColumns') && bySrc.includes('BONUS.BONE_YARD_COLUMNS') && bySrc.includes('EridathsMomsHouse') && !bySrc.includes('_drawColumns'));
  check('BoneYardBonus: seeded field from BONUS.BONE_YARD_FIELD', bySrc.includes('BONUS.BONE_YARD_FIELD') && bySrc.includes('_seedYardField'));
  check('BoneYardBonus: deterministic mulberry32 layout (seed 20261001)', bySrc.includes('function mulberry32') && bySrc.includes('mulberry32(20261001)'));
  check('BoneYardBonus: field drift 6–18 px/s, no horizontal drift', bySrc.includes('bone.vy = 6 + rng() * 12') && bySrc.includes('bone.vx = 0'));
  check('BoneYardBonus: Phase 1 rain rolls the weighted pool', bySrc.includes('new BoneFragment({ x, y: -30, game: this.game })'));
  check('BoneFragment: VERSION = v2.5.0', bfSrc.includes("VERSION = 'v2.5.0'"));
  check('BoneFragment: per-key radius/HP/score bands', bfSrc.includes('BONE_FRAGMENT_STATS') && bfSrc.includes('score: 500') && bfSrc.includes('score: 1000') && bfSrc.includes('score: 2000'));
  check('BoneFragment: weighted spawn pool 40/40/15/5', bfSrc.includes('BONE_FRAGMENT_POOL') && bfSrc.includes('weight: 40') && bfSrc.includes('weight: 15') && bfSrc.includes('weight: 5'));
  check('BoneFragment: optional spriteKey constructor arg', bfSrc.includes('spriteKey = null'));
  check('BoneFragment: aspect-preserving sprite + procedural fallback', bfSrc.includes('getDims(this.spriteKey)') && bfSrc.includes('this._drawProcedural(ctx, r)'));
  // ── headless behavior: seeded field, per-key stats, weighted pool ──
  const { default: BoneYardBonus } = await mod('js/levels/BoneYardBonus.js');
  const { default: BoneFragment, BONE_FRAGMENT_STATS, BONE_FRAGMENT_POOL } = await mod('js/levels/BoneFragment.js');
  const mkGame = () => ({
    viewW: 1920, viewH: 1080,
    bonusTargets: [], enemies: [], score: 0, multiplier: 1, shake: 0,
    state: 'bonus',
    particles: { burst() {} },
    waveManager: { startNext() {} },
  });
  const game = mkGame();
  const yard = new BoneYardBonus(game);
  yard.init(); // v3.76.0: uniform stage interface (was start())
  // v4.25.0: bonusTargets = drifting field bones + SHOOTABLE fixed
  // column bones — the field assertions below use the drifting set.
  const field = game.bonusTargets.filter((b) => !b.fixed);
  const columns = game.bonusTargets.filter((b) => b.fixed);
  check('BoneYard: seeded field = 29 destructible bones', field.length === 29, `got ${field.length}`);
  const count = (k) => field.filter((b) => b.spriteKey === k).length;
  check('BoneYard: field mix 10 femur / 10 profile_bone / 6 skull / 3 skeleton', count('femur') === 10 && count('profile_bone') === 10 && count('skull') === 6 && count('skeleton') === 3, `got ${count('femur')}/${count('profile_bone')}/${count('skull')}/${count('skeleton')}`);
  check('BoneYard: every field bone is damageable (alive, hp > 0, applyDamage)', field.every((b) => b.alive && b.hp > 0 && typeof b.applyDamage === 'function'));
  check('BoneYard: field drift 6–18 px/s, no horizontal drift', field.every((b) => b.vy >= 6 && b.vy <= 18 && b.vx === 0));
  check('BoneYard: skeleton sentinels hug the left/right margins', field.filter((b) => b.spriteKey === 'skeleton').every((b) => b.x < 240 || b.x > 1680));
  // v4.25.0: the 8 bone columns (4 per side × 10 stacked) are SHOOTABLE
  // fixed femur entities — no drift, no cull, damageable, center
  // corridor clear.
  const expectedColumns = BONUS.BONE_YARD_COLUMNS.perSide * BONUS.BONE_YARD_COLUMNS.bonesPerColumn * 2;
  check('BoneYard: v4.25.0 columns = 80 shootable fixed bones', columns.length === expectedColumns, `got ${columns.length}`);
  check('BoneYard: columns are fixed (no drift, no rotation)', columns.every((b) => b.vy === 0 && b.vx === 0 && b.rotSpeed === 0 && b.rotation === 0));
  check('BoneYard: columns are femur, damageable, hp 40', columns.every((b) => b.spriteKey === 'femur' && b.alive && b.hp === 40 && typeof b.applyDamage === 'function'));
  check('BoneYard: columns hug the left/right borders (center corridor clear)', columns.every((b) => b.x < 200 || b.x > 1720));
  const game2 = mkGame();
  new BoneYardBonus(game2).init(); // v3.76.0: uniform stage interface
  const field2 = game2.bonusTargets.filter((b) => !b.fixed);
  check('BoneYard: seeded layout is identical across runs', field2.length === field.length && field2.every((b, i) => b.spriteKey === field[i].spriteKey && Math.abs(b.x - field[i].x) < 0.001 && Math.abs(b.y - field[i].y) < 0.001));

  const femur = new BoneFragment({ x: 100, y: 100, game, spriteKey: 'femur' });
  const skull = new BoneFragment({ x: 100, y: 100, game, spriteKey: 'skull' });
  const skeleton = new BoneFragment({ x: 100, y: 100, game, spriteKey: 'skeleton' });
  check('BoneFragment: score bands (regular 500 / skull 1000 / skeleton 2000)', femur.scoreValue === 500 && skull.scoreValue === 1000 && skeleton.scoreValue === 2000, `got ${femur.scoreValue}/${skull.scoreValue}/${skeleton.scoreValue}`);
  check('BoneFragment: per-key radius bands', femur.radius >= 14 && femur.radius <= 26 && skull.radius >= 20 && skull.radius <= 32 && skeleton.radius >= 28 && skeleton.radius <= 42, `got ${femur.radius}/${skull.radius}/${skeleton.radius}`);
  check('BoneFragment: per-key HP bands', femur.hp >= 15 && femur.hp <= 35 && skull.hp >= 35 && skull.hp <= 60 && skeleton.hp >= 70 && skeleton.hp <= 110, `got ${femur.hp}/${skull.hp}/${skeleton.hp}`);
  check('BoneFragment: exported stats/pool tables', BONE_FRAGMENT_STATS.skeleton.score === 2000 && BONE_FRAGMENT_STATS.skull.score === 1000 && BONE_FRAGMENT_STATS.femur.score === 500 && BONE_FRAGMENT_POOL.length === 4);
  const pool = {};
  for (let i = 0; i < 2000; i++) {
    const b = new BoneFragment({ x: 0, y: 0, game });
    pool[b.spriteKey] = (pool[b.spriteKey] || 0) + 1;
  }
  check('BoneFragment: pool roll covers all four keys', pool.femur > 0 && pool.profile_bone > 0 && pool.skull > 0 && pool.skeleton > 0, JSON.stringify(pool));
  check('BoneFragment: pool weights ≈ 40/40/15/5', Math.abs(pool.femur / 2000 - 0.4) < 0.05 && Math.abs(pool.skull / 2000 - 0.15) < 0.05 && Math.abs(pool.skeleton / 2000 - 0.05) < 0.04, JSON.stringify(pool));
  // v4.25.0: fixed architectural bones (the boneyard's columns).
  check('BoneFragment: v2.5.0 fixed option (no drift, no cull)', bfSrc.includes('if (fixed) {') && bfSrc.includes('this.fixed = true') && bfSrc.includes('if (!this.fixed) {'));
  const col = new BoneFragment({ x: 100, y: 100, game, spriteKey: 'femur', fixed: true, radius: 10, hp: 40, rotation: 0 });
  for (let i = 0; i < 120; i++) col.update(1 / 60); // 2s — a drifting bone would have left
  check('BoneFragment: fixed bone stays put (no drift, no cull, overrides kept)', col.y === 100 && col.x === 100 && col.alive === true && col.radius === 10 && col.hp === 40 && col.rotation === 0);
  skull.applyDamage(9999);
  check('BoneFragment: skull dies to damage (alive=false)', skull.alive === false);
  skull.shatter(game);
  check('BoneFragment: shatter triggers screen shake (≥3)', game.shake >= 3, `got ${game.shake}`);
  skeleton.shatter(game);
  check('BoneFragment: skeleton shatter = bigger shake (6)', game.shake >= 6, `got ${game.shake}`);
}

}

// ═══════════════════════════════════════════════════════════
//  [6z] v3.76.0 LevelRegistry — data-driven stage flow
//        (combat/bonus manifest + uniform stage interface:
//         init() / update(dt) / isComplete() / cleanup())
// ═══════════════════════════════════════════════════════════

import { ROOT, check, makeGame, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const gameSrc = fs.readFileSync(path.join(ROOT, 'js/core/Game.js'), 'utf8');

export default async function run() {
console.log('\n[6z] v3.76.0 LevelRegistry stage flow (headless)');
{
  const { default: LevelRegistry, STAGE_SEQUENCE, BONUS_STAGES } = await mod('js/levels/LevelRegistry.js');
  const lrSrc = fs.readFileSync(path.join(ROOT, 'js/levels/LevelRegistry.js'), 'utf8');
  const wmSrc = fs.readFileSync(path.join(ROOT, 'js/core/WaveManager.js'), 'utf8');
  const blSrc2 = fs.readFileSync(path.join(ROOT, 'js/levels/BonusLevel.js'), 'utf8');
  const bySrc = fs.readFileSync(path.join(ROOT, 'js/levels/BoneYardBonus.js'), 'utf8');
  const ibSrc = fs.readFileSync(path.join(ROOT, 'js/levels/InternetBonus.js'), 'utf8');
  const hudSrc = fs.readFileSync(path.join(ROOT, 'js/ui/HUD.js'), 'utf8');

  // ── Source gates ──
  check('LevelRegistry: VERSION = v3.76.0', lrSrc.includes("VERSION = 'v3.76.0'"));
  check('Game: imports LevelRegistry (STAGE_SEQUENCE + BONUS_STAGES)',
    gameSrc.includes("import LevelRegistry, { STAGE_SEQUENCE, BONUS_STAGES } from '../levels/LevelRegistry.js'"));
  check('Game: core loop drives activeStage (update → isComplete → advanceStage)',
    gameSrc.includes('this.activeStage.update(dt)') && gameSrc.includes('if (this.activeStage.isComplete()) this.advanceStage();'));
  check('WaveManager: completion signal only (cleared flag + isComplete, no bonus choice)',
    wmSrc.includes('this.cleared = true') && wmSrc.includes('isComplete()') && !wmSrc.includes('startBonus'));
  check('BonusLevel: thin adapter (setStage + forward update/draw, no direct bonus imports)',
    blSrc2.includes('setStage(stage)') && !blSrc2.includes("from './BoneYardBonus.js'") && !blSrc2.includes("from './InternetBonus.js'"));
  check('BoneYardBonus: uniform interface (init/isComplete/cleanup, no game-state transitions)',
    bySrc.includes('init()') && bySrc.includes('isComplete()') && bySrc.includes('cleanup()') && !bySrc.includes("game.state = 'playing'") && !bySrc.includes('waveManager.startNext('));
  check('InternetBonus: uniform interface (init/isComplete/cleanup, no game-state transitions)',
    ibSrc.includes('init()') && ibSrc.includes('isComplete()') && ibSrc.includes('cleanup()') && !ibSrc.includes("game.state = 'playing'") && !ibSrc.includes('waveManager.startNext('));
  check('HUD: bonus label from levelRegistry.labelFor(currentEntry)',
    hudSrc.includes('g.levelRegistry.labelFor(g.levelRegistry.currentEntry)'));

  // ── Manifest + headless behavior ──
  check('STAGE_SEQUENCE: 3 combat + 1 random bonus (pre-refactor cadence)',
    STAGE_SEQUENCE.length === 4 && STAGE_SEQUENCE.filter(s => s.type === 'combat').length === 3 && STAGE_SEQUENCE[3].type === 'bonus' && STAGE_SEQUENCE[3].id === 'random');
  check('BONUS_STAGES: boneyard + internet registered with label + create()',
    Object.keys(BONUS_STAGES).sort().join(',') === 'boneyard,internet' &&
    Object.values(BONUS_STAGES).every(r => typeof r.label === 'string' && typeof r.create === 'function'));

  const reg = new LevelRegistry();
  check('bonusInterval = 4 (syncs WaveManager.bonusEvery)', reg.bonusInterval === 4, `got ${reg.bonusInterval}`);

  const seq = [reg.nextStage(), reg.nextStage(), reg.nextStage(), reg.nextStage(), reg.nextStage()];
  check('nextStage(): combat×3 → bonus(random) → combat (cyclic)',
    seq[0].type === 'combat' && seq[1].type === 'combat' && seq[2].type === 'combat' &&
    seq[3].type === 'bonus' && seq[3].id === 'random' && seq[4].type === 'combat');
  check('nextStage(): currentEntry tracks the last entry handed out', reg.currentEntry === seq[4]);

  const resolved = reg.resolveEntry({ type: 'bonus', id: 'random' });
  check("resolveEntry('random') → concrete registered bonus id",
    resolved.type === 'bonus' && Object.keys(BONUS_STAGES).includes(resolved.id), `got ${resolved.id}`);
  const passthrough = { type: 'bonus', id: 'boneyard' };
  check('resolveEntry: non-random entries pass through unchanged', reg.resolveEntry(passthrough) === passthrough);

  const g = makeGame();
  g.waveManager = { __waveManager: true };
  check('createStage(combat) → shared WaveManager', reg.createStage({ type: 'combat' }, g) === g.waveManager);
  const stage1 = reg.createStage({ type: 'bonus', id: 'boneyard' }, g);
  const stage2 = reg.createStage({ type: 'bonus', id: 'boneyard' }, g);
  check('createStage(bonus): instance cached + reused per id', stage1 === stage2);
  check('createStage(bonus): uniform interface (init/update/isComplete/cleanup)',
    ['init', 'update', 'isComplete', 'cleanup'].every(m => typeof stage1[m] === 'function'));
  check('createStage: boneyard vs internet are distinct instances', reg.createStage({ type: 'bonus', id: 'internet' }, g) !== stage1);

  check("labelFor: combat → 'WAVE'", reg.labelFor({ type: 'combat' }) === 'WAVE');
  check("labelFor: boneyard → '☠ BONE YARD ☠'", reg.labelFor({ type: 'bonus', id: 'boneyard' }) === '☠ BONE YARD ☠');
  check("labelFor: internet → '🌐 INTERNET 🌐'", reg.labelFor({ type: 'bonus', id: 'internet' }) === '🌐 INTERNET 🌐');
  check('labelFor: unknown id → uppercased fallback', reg.labelFor({ type: 'bonus', id: 'moonbase' }) === 'MOONBASE');

  reg.reset();
  const forced = reg.forceBonus('boneyard');
  check("forceBonus('boneyard') → concrete entry, currentEntry set", forced.type === 'bonus' && forced.id === 'boneyard' && reg.currentEntry === forced);
  check('forceBonus: next nextStage() is a combat wave (no back-to-back bonus)', reg.nextStage().type === 'combat');
  reg.reset();
  const forcedRandom = reg.forceBonus('random');
  check("forceBonus('random') → concrete registered bonus id", forcedRandom.type === 'bonus' && Object.keys(BONUS_STAGES).includes(forcedRandom.id), `got ${forcedRandom.id}`);
  reg.reset();
  check('reset(): manifest restarts from the first entry', reg.index === -1 && reg.currentEntry === null && reg.nextStage() === STAGE_SEQUENCE[0]);
}

}

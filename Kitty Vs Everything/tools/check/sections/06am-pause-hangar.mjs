// ═══════════════════════════════════════════════════════════
//  [6am] v4.5.0 PAUSE MENU "RETURN TO HANGAR" — the ⌂ button in
//        the pause overlay (index.html #pause-hangar, wired in
//        PauseMenu.js) calls game.returnToHangar() (delegate in
//        Game.js, logic in js/core/game/StageFlow.js): full session
//        teardown (active-stage cleanup, entity arrays, hazard field,
//        particles, player ships, co-op/LAN, SAR facade, score/run
//        state, dev state, stage manifest) + mission music stop +
//        pointer-lock release + DOM swap back to the hangar terminal
//        (state 'menu', #menu-screen shown). The rAF loop is
//        permanent (menu starfield) — the state machine unloads.
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
  console.log('\n[6am] v4.5.0 pause menu RETURN TO HANGAR');
  // ─── Static surface (source + module) ───
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const htmlSrc = read('index.html');
  const pauseSrc = read('js/ui/PauseMenu.js');
  const gameSrc = read('js/core/Game.js');
  const flowSrc = read('js/core/game/StageFlow.js');

  check('index.html: #pause-hangar button in the pause overlay',
    htmlSrc.includes('id="pause-overlay"') && htmlSrc.includes('id="pause-hangar"')
    && htmlSrc.indexOf('id="pause-overlay"') < htmlSrc.indexOf('id="pause-hangar"')
    && htmlSrc.indexOf('id="pause-hangar"') < htmlSrc.indexOf('id="touch-ui"'));
  check('index.html: button is labeled RETURN TO HANGAR',
    /id="pause-hangar"[^>]*>.*RETURN TO HANGAR/.test(htmlSrc));
  check('PauseMenu.js: wires #pause-hangar to game.returnToHangar()',
    pauseSrc.includes("getElementById('pause-hangar')") && pauseSrc.includes('game.returnToHangar()'));
  check('PauseMenu.js: does NOT call this.close() before returnToHangar (no music blip / lock churn)',
    !/this\.close\(\);\s*game\.returnToHangar\(\)/.test(pauseSrc) && !/returnToHangar\(\);\s*.*this\.close\(\)/.test(pauseSrc));
  check('Game.js: returnToHangar() delegate → StageFlow.js',
    gameSrc.includes('returnToHangar() { returnToHangar(this); }')
    && gameSrc.includes("import { advanceStage, startBonusStage, startBonusLevel, startBonusSpecific, restartLevel, returnToHangar } from './game/StageFlow.js'"));
  check('StageFlow.js: exports returnToHangar with the teardown surface',
    flowSrc.includes('export function returnToHangar(game)')
    && flowSrc.includes('game.state = \'menu\'')
    && flowSrc.includes('audio.stopMusic()')
    && flowSrc.includes('syncCursor(game)')
    && flowSrc.includes('if (coopManager.active) coopManager.stop()')
    && flowSrc.includes('if (clientMirror.active) clientMirror.stop()')
    && flowSrc.includes('if (game.sard) game.sard.destroy()')
    && flowSrc.includes('game.levelRegistry.reset()')
    && flowSrc.includes('game.waveManager.reset()')
    && flowSrc.includes('show(\'menu-screen\')')
    && flowSrc.includes('hide(\'pause-overlay\')'));

  const { returnToHangar } = await mod('js/core/game/StageFlow.js');
  check('StageFlow.js: returnToHangar is an exported function', typeof returnToHangar === 'function');

  // ─── Headless behavior: mid-mission session → hangar terminal ───
  const makeSession = (mode = 'classic') => {
    const calls = {};
    const track = (name) => (...a) => { calls[name] = (calls[name] || 0) + 1; };
    const player = { theme: 'white_yellow' };
    const game = {
      state: 'playing',
      mode,
      sard: mode === 'sard' ? { destroy: track('sardDestroy') } : null,
      activeStage: { cleanup: track('stageCleanup') },
      enemies: [{ alive: true }, { alive: true }],
      bullets: [{ alive: true }],
      powerups: [{ alive: true }],
      bonusTargets: [{ alive: true }],
      fireZones: [{ alive: true }],
      enemyHazards: [{ alive: true }],
      hazards: { reset: track('hazardsReset') },
      particles: { clear: track('particlesClear') },
      player,
      players: [player],
      player2: { netId: 'p2' },
      score: 12500,
      multiplier: 4,
      nextLifeAt: 90000,
      shake: 6,
      godMode: true,
      paused: true,
      aimbot: { reset: track('aimbotReset') },
      testAimbot: { active: true },
      hud: { floaters: [{ text: 'x' }] },
      msglog: { entries: [{ text: 'old' }], clear: track('msglogClear'), log() {} },
      levelRegistry: { reset: track('registryReset') },
      waveManager: { reset: track('waveReset') },
      hudFireControl: { setMinimized: track('fcReset') },
      input: { requestPointerLock: track('lock'), releasePointerLock: track('unlock') },
      time: 123.5,
    };
    return { game, calls };
  };

  // A) classic mid-mission (paused) → full teardown + state 'menu'
  {
    const { game, calls } = makeSession('classic');
    returnToHangar(game);
    check('state transitions to menu', game.state === 'menu', `got ${game.state}`);
    check('unpaused', game.paused === false);
    check('active stage cleanup hook ran + slot freed', calls.stageCleanup === 1 && game.activeStage === null);
    check('all entity arrays cleared',
      game.enemies.length === 0 && game.bullets.length === 0 && game.powerups.length === 0
      && game.bonusTargets.length === 0 && game.fireZones.length === 0 && game.enemyHazards.length === 0);
    check('hazard field + particles reset', calls.hazardsReset === 1 && calls.particlesClear === 1);
    check('player ships dropped (P1 + P2)', game.player === null && game.players.length === 0 && game.player2 === null);
    check('score/multiplier/shake/godMode reset',
      game.score === 0 && game.multiplier === 1 && game.shake === 0 && game.godMode === false);
    check('dev state cleared (aimbot reset, test aimbot off, floaters, msglog)',
      calls.aimbotReset === 1 && game.testAimbot.active === false && game.hud.floaters.length === 0 && calls.msglogClear === 1);
    check('stage manifest reset (registry + wave manager)', calls.registryReset === 1 && calls.waveReset === 1);
    check('fire-control panel re-expanded for the next mission', calls.fcReset === 1);
    check('pointer lock released (menu never locks)', calls.unlock === 1 && (calls.lock || 0) === 0);
    check('classic mode: no SAR facade to destroy', calls.sardDestroy === undefined && game.sard === null && game.mode === 'classic');
  }

  // B) SAR mid-mission → facade destroyed + mode back to classic
  {
    const { game, calls } = makeSession('sard');
    returnToHangar(game);
    check('SAR facade destroyed + slot freed', calls.sardDestroy === 1 && game.sard === null);
    check('mode back to classic', game.mode === 'classic');
    check('state transitions to menu (SAR)', game.state === 'menu');
  }

  // C) idempotent-ish: a second call on an already-missionless session
  //    must not throw (no stage, no sard, no players).
  {
    const { game } = makeSession('classic');
    returnToHangar(game);
    let threw = false;
    try { returnToHangar(game); } catch { threw = true; }
    check('second call on a clean session does not throw', !threw && game.state === 'menu');
  }
}
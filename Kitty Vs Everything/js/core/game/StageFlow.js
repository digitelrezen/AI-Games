// Filename: game/StageFlow.js
// Kitty Vs Everything — v4.5.0
// E6 modularization (v3.77.0): stage lifecycle extracted from Game.js —
// advanceStage / startBonusStage / dev-forced bonuses / restartLevel.
// Game.js keeps thin delegate methods (public surface unchanged); the
// pinned combat-stage path (startCombatStage + the core-loop stage drive)
// stays in Game.js.
// v4.5.0: returnToHangar — the pause menu "RETURN TO HANGAR" transition:
//         full session teardown (stage, entities, hazards, particles,
//         ships, co-op/LAN, SAR facade, score, music, pointer lock) +
//         state back to the hangar terminal (ship selection).

import { BONUS_STAGES } from '../../levels/LevelRegistry.js';
import { LIFE_SCORE_INTERVAL } from '../config.js';
import { audio } from '../AudioSystem.js';
import coopManager from '../../../net/CoopManager.js';
import clientMirror from '../../../net/ClientMirror.js';
import { syncCursor } from './DisplayPolicy.js';

/**
 * v3.76.0: the active stage (combat wave or bonus round) has finished —
 * the LevelRegistry manifest decides what runs next. No stage-type
 * branching in the core loop.
 */
export function advanceStage(game) {
  const prev = game.activeStage;
  game.activeStage = null;
  if (prev && typeof prev.cleanup === 'function') prev.cleanup();
  const entry = game.levelRegistry.nextStage();
  if (entry.type === 'bonus') startBonusStage(game, entry);
  else game.startCombatStage();
}

/** v3.76.0: start a bonus round from a resolved manifest entry. */
export function startBonusStage(game, entry) {
  entry = game.levelRegistry.resolveEntry(entry); // 'random' → concrete id
  game.levelRegistry.currentEntry = entry;
  const stage = game.levelRegistry.createStage(entry, game);
  game.bonus.setStage(stage);
  game.activeStage = stage;
  game.state = 'bonus';
  game.msglog.log('BONUS LEVEL INBOUND (' + game.levelRegistry.labelFor(entry) + ')', 'warn', game.time);
  game.enemies = [];
  game.bullets = game.bullets.filter(b => b.friendly);
  game.bonusTargets = [];
  stage.init();
}

// Dev-forced bonus (DevPanel 'dev-bonus'): random bonus, no manifest slot
// consumed — the next registry entry is a combat wave.
export function startBonusLevel(game) {
  if (game.state !== 'playing') return;
  const entry = game.levelRegistry.forceBonus('random');
  startBonusStage(game, entry);
}

// Dev-forced bonus (DevPanel 'dev-bonus-bone' / 'dev-bonus-internet').
export function startBonusSpecific(game, type) {
  if (game.state !== 'playing') return;
  const entry = game.levelRegistry.forceBonus(BONUS_STAGES[type] ? type : 'random');
  startBonusStage(game, entry);
}

/** v3.14.0: pause menu "RESTART LEVEL" — full mission reset, keeps theme.
 *  v3.99.0: also keeps the active mode (a SAR restart stays SAR). */
export function restartLevel(game) {
  const theme = game.player ? game.player.theme : 'yellow';
  game.start(theme, { mode: game.mode === 'sard' ? 'sard' : undefined });
  game.msglog.log('MISSION RESTARTED', 'warn', game.time);
}

/** v4.5.0: pause menu "RETURN TO HANGAR" — tear down the live session and
 *  transition back to the hangar terminal (Catship selection).
 *  Mirrors the Game.start() reset list so nothing from the mission leaks
 *  into the menu: no entities, no hazards, no particles, no stage, no SAR
 *  facade, no co-op/LAN session, no mission music, no pointer lock.
 *  The rAF loop itself is permanent (it renders the menu starfield), so
 *  there is no loop to stop — the state machine does the unloading. */
export function returnToHangar(game) {
  // ── Stage teardown (WaveManager / bonus stage cleanup hook) ──
  const prev = game.activeStage;
  game.activeStage = null;
  if (prev && typeof prev.cleanup === 'function') prev.cleanup();
  // ── Session entities — full clear (not the end-of-frame alive filter) ──
  game.enemies = [];
  game.bullets = [];
  game.powerups = [];
  game.bonusTargets = [];
  game.fireZones = [];
  game.enemyHazards = [];   // v3.84.0
  game.hazards.reset();     // v3.97.0: hazard field back to empty
  game.particles.clear();
  // ── Player ships (P1 + co-op P2) ──
  game.player = null;
  game.players = [];
  game.player2 = null;
  // ── Co-op / LAN session teardown (net relay + P2 controls) ──
  if (coopManager.active) coopManager.stop();
  if (clientMirror.active) clientMirror.stop();
  // ── Search & Destroy facade teardown (radar key listener + world) ──
  if (game.sard) game.sard.destroy();
  game.sard = null;
  game.mode = 'classic';
  // ── Run state (Game.start() resets these again on the next launch) ──
  game.score = 0;
  game.multiplier = 1;
  game.nextLifeAt = LIFE_SCORE_INTERVAL;
  game.shake = 0;
  game.godMode = false;
  game.paused = false;
  // ── Dev / debug state (no carry-over into the menu) ──
  game.aimbot.reset();
  if (game.testAimbot) game.testAimbot.active = false;
  game.hud.floaters = [];
  game.msglog.clear();
  // ── Stage manifest back to the top of the run ──
  game.levelRegistry.reset();
  game.waveManager.reset();
  // ── Audio + cursor: the menu never locks the pointer, and the mission
  //    music ends with the mission (v3.14.0 PauseMenu lifecycle). ──
  audio.stopMusic();
  game.state = 'menu';
  syncCursor(game);
  // ── DOM: hide the in-mission overlays, bring up the hangar terminal.
  //    Null-safe so the headless check harness (getElementById → null)
  //    can exercise the state transition. ──
  const hide = (id) => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); };
  const show = (id) => { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); };
  hide('hud');
  hide('fc-dashboard');
  hide('pause-overlay');
  hide('gameover-screen');
  show('menu-screen');
  game.hudFireControl.setMinimized(false); // v3.21.0: new missions start expanded
  game.msglog.log('RETURNED TO HANGAR', 'info', game.time);
}

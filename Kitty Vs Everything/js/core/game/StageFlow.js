// Filename: game/StageFlow.js
// Kitty Vs Everything — v3.77.0
// E6 modularization (v3.77.0): stage lifecycle extracted from Game.js —
// advanceStage / startBonusStage / dev-forced bonuses / restartLevel.
// Game.js keeps thin delegate methods (public surface unchanged); the
// pinned combat-stage path (startCombatStage + the core-loop stage drive)
// stays in Game.js.

import { BONUS_STAGES } from '../../levels/LevelRegistry.js';

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

/** v3.14.0: pause menu "RESTART LEVEL" — full mission reset, keeps theme. */
export function restartLevel(game) {
  const theme = game.player ? game.player.theme : 'yellow';
  game.start(theme);
  game.msglog.log('MISSION RESTARTED', 'warn', game.time);
}

// Filename: game/GameOver.js
// Kitty Vs Everything — v3.77.0
// E6 modularization (v3.77.0): the game-over sequence extracted from
// Game.js — co-op continuation guard, leaderboard render, DOM overlay,
// pointer restore. Game.js keeps the gameOver() delegate (Player.js still
// calls game.gameOver()).

import { bus } from '../EventBus.js';
import { audio } from '../AudioSystem.js';
import coopManager from '../../../net/CoopManager.js';
import { syncCursor } from './DisplayPolicy.js';

export function gameOver(game) {
  // v3.20.0: co-op — the mission only ends when ALL ships are down.
  if (coopManager.active && game.players.some(p => !p.dead)) {
    bus.emit('banner', { text: 'CO-OP CONTINUES', tone: 'warn', duration: 1.5 });
    return;
  }
  // v3.99.0: SEARCH & DESTROY victory — the house is destroyed, not the
  // ship. The same game-over screen doubles as the "MISSION ACCOMPLISHED"
  // state: swap the title + log line (the failure path is untouched).
  const victory = game.state === 'victory';
  game.state = 'gameover';
  game.paused = false;
  syncCursor(game); // v3.31.0: restore the cursor for the game-over screen
  game.msglog.log(victory ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED', victory ? 'good' : 'bad', game.time);
  audio.stopMusic(); // v3.14.0: mission music ends with the mission
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('fc-dashboard').classList.add('hidden'); // v3.14.0: hide with the HUD
  document.getElementById('pause-overlay').classList.add('hidden');
  document.getElementById('gameover-screen').classList.remove('hidden');
  // v3.99.0: the game-over title element (index.html #go-title) — victory
  // swaps it to MISSION ACCOMPLISHED; classic keeps the default.
  const goTitle = document.getElementById('go-title');
  if (goTitle) goTitle.textContent = victory ? 'MISSION ACCOMPLISHED' : 'GAME OVER';
  // v3.99.0: the victory state recolors the title (style.css .victory).
  document.getElementById('gameover-screen').classList.toggle('victory', victory);
  document.getElementById('final-score').textContent = 'FINAL SCORE: ' + game.score.toLocaleString();
  document.getElementById('initials').value = '';
  document.getElementById('save-score').disabled = false;
  game.leaderboard.render(document.getElementById('go-scores-list'));
  // v3.11.0: boss-tier (special) enemies are contained to the screen —
  // on game over they phase out with the round instead of lingering.
  for (const e of game.enemies) {
    if (e.special && e.alive) {
      game.particles.burst(e.x, e.y, { count: 24, color: e.color || '#fff', speed: 260, life: 0.6 });
      e.escaped = true;
      e.alive = false;
    }
  }
  audio.gameOver();
}

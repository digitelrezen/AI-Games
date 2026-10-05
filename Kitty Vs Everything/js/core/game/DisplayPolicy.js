// Filename: game/DisplayPolicy.js
// Kitty Vs Everything — v3.77.0
// E6 modularization (v3.77.0): display policy extracted from Game.js —
// pointer-lock policy (v3.31.0, DOM mechanics live in InputManager.js) +
// live viewport / starfield resize handling (v3.13.0). Game.js keeps thin
// delegate methods (PauseMenu / SettingsScreen still call game._syncCursor()).

import { initStars } from '../Starfield.js';

/** v3.13.0: rebuild the starfield when the logical viewport resizes. */
export function checkViewportChange(game) {
  if (game.view.viewW !== game._starW || game.view.viewH !== game._starH) {
    game._starW = game.view.viewW;
    game._starH = game.view.viewH;
    game.stars = initStars(game.view.viewW, game.view.viewH);
    game.W = game._starW; // v3.13.0: keep legacy W/H live on resize
    game.H = game._starH;
  }
}

// ─── v3.31.0: POINTER LOCK POLICY (DOM mechanics live in InputManager.js) ───

/** True while the cursor should be hidden + locked: active LOCAL play
 *  (P1 owns the mouse — the LAN client's P2 never does), unpaused, and
 *  the settings screen closed. Menu / game-over / client never lock. */
export function wantsPointerLock(game) {
  return (game.state === 'playing' || game.state === 'bonus')
    && !game.paused
    && !settingsOpen(game);
}

/** Lock the pointer for active play / restore the cursor otherwise. */
export function syncCursor(game) {
  if (wantsPointerLock(game)) game.input.requestPointerLock();
  else game.input.releasePointerLock();
}

export function settingsOpen(game) {
  const s = document.getElementById('settings-screen');
  return !!(s && !s.classList.contains('hidden'));
}

/** pointerlockchange callback: an unexpected lock loss mid-mission (ESC /
 *  alt-tab) pauses the game — the browser consumes the Escape keydown
 *  while locked, so PauseMenu's own keydown handler never sees it. */
export function onPointerLockChange(game, locked) {
  if (locked) return;
  if (wantsPointerLock(game)) game.pauseMenu.toggle();
}

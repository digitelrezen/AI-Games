// Filename: PauseMenu.js
// Kitty Vs Everything — v3.14.0
// Pause overlay: ESC / P (the HUD ⏸ button was removed in v3.78.0 — it was
// redundant). Game.js gates its update loop on g.paused, so the whole world
// freezes (rendering keeps drawing).
//   • Resume — Esc / P / ▶ button
//   • Options — opens the shared SettingsScreen (works from the menu too)
//   • Level Restart — full mission reset, keeps the selected cat theme
// Music pauses with the game and resumes on resume.
// v3.31.0: cursor coordination — opening the pause releases the pointer
//          lock (cursor restored for the overlay buttons); close() (resume)
//          re-locks it. The browser consumes the ESC keydown while locked,
//          so Game.js pauses from pointerlockchange instead of a keydown.
// v3.78.0: fire-control pause button REMOVED (redundant) — the #pause-btn
//          wiring is gone; Esc / P / the overlay buttons are the only pause
//          entry points.
export const VERSION = 'v3.78.0';
import { audio } from '../core/AudioSystem.js';

const isMidMission = (g) => g.state === 'playing' || g.state === 'bonus';

export default class PauseMenu {
  constructor(game) {
    this.game = game;
    this.overlay = document.getElementById('pause-overlay');

    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' && e.code !== 'KeyP') return;
      if (this._settingsOpen()) return; // SettingsScreen owns Esc (closes itself)
      if (isMidMission(game)) this.toggle();
    });

    const resume = document.getElementById('pause-resume');
    if (resume) resume.onclick = () => this.toggle();
    const options = document.getElementById('pause-options');
    if (options) options.onclick = () => this.openOptions();
    const restart = document.getElementById('pause-restart');
    if (restart) restart.onclick = () => { this.close(); game.restartLevel(); };
  }

  _settingsOpen() {
    const s = document.getElementById('settings-screen');
    return !!(s && !s.classList.contains('hidden'));
  }

  toggle() {
    const g = this.game;
    g.paused = !g.paused;
    if (g.paused) {
      this.overlay.classList.remove('hidden');
      if (g.msglog) g.msglog.log('MISSION PAUSED', 'info', g.time);
      audio.stopMusic();
      g._syncCursor(); // v3.31.0: restore the cursor for the overlay
    } else {
      this.close();
    }
  }

  close() {
    const g = this.game;
    g.paused = false;
    this.overlay.classList.add('hidden');
    g.lastTs = performance.now(); // avoid a dt spike on resume
    audio.startMusic();
    g._syncCursor(); // v3.31.0: re-lock for active play (no-op in the menu)
  }

  openOptions() {
    if (this.game.settings) this.game.settings.open();
  }
}
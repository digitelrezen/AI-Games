// Filename: HUDConsole.js
// Kitty Vs Everything — v3.19.0
// Combat message console panel: renders the MessageLog ring buffer into the
// #combat-console DOM block. v3.19.0: the console now lives inside the
// fire-control dashboard (#fc-dashboard) as the left column and hosts the
// TIME readout in its header, so it stays visible for the whole mission
// (the dashboard's own hidden class gates menu/game-over visibility).
// Shows the last 9 entries with mission timestamps.
export const VERSION = 'v3.19.0';
import { formatTime } from '../core/utils.js';

const TONE_CLASS = { info: 'cl-info', good: 'cl-good', warn: 'cl-warn', bad: 'cl-bad' };
const MAX_LINES = 9;

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default class HUDConsole {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('combat-console');
    this.lines = document.getElementById('console-lines');
    this.count = document.getElementById('console-count');
    this._last = '';
  }

  update() {
    if (!this.el) return;
    const g = this.game, log = g.msglog;
    if (!log) return;
    // v3.19.0: visible for the whole mission (it hosts the TIME readout);
    // no longer gated on having log entries.
    const show = (g.state === 'playing' || g.state === 'bonus' || g.state === 'gameover');
    this.el.classList.toggle('hidden', !show);
    if (!show) { this._last = ''; return; }

    const recent = log.entries.slice(-MAX_LINES);
    const html = recent.map(e =>
      `<div class="cl-line ${TONE_CLASS[e.tone] || 'cl-info'}"><span class="cl-time">${formatTime(e.time)}</span>${escapeHtml(e.text)}</div>`
    ).join('');
    if (html !== this._last) {
      this.lines.innerHTML = html;
      this._last = html;
    }
    if (this.count) this.count.textContent = String(log.entries.length);
  }
}
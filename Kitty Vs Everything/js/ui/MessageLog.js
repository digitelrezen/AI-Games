// Filename: MessageLog.js
// Kitty Vs Everything — v3.14.0
// Combat message console backend: a capped ring buffer of mission events so
// no in-game message is ever lost (banners, weapon state, pause, aimbot,
// drops). HUDConsole renders it; Game.js (and DevPanel/test tooling) feed it.
// Tones: info (default) | good | warn | bad.
export const VERSION = 'v3.14.0';
import { bus } from '../core/EventBus.js';

export default class MessageLog {
  constructor(cap = 64) {
    this.entries = [];
    this.cap = cap;
    // Banners are the game's "loud" messages — mirror them automatically.
    this._offBanner = bus.on('banner', (d) => this.log(d.text, d.tone || 'info'));
  }
  /** Append an entry. time = mission seconds (used for the console clock). */
  log(text, tone = 'info', time = 0) {
    this.entries.push({ text, tone, time });
    if (this.entries.length > this.cap) {
      this.entries.splice(0, this.entries.length - this.cap);
    }
  }
  clear() { this.entries = []; }
  destroy() { this._offBanner?.(); }
}
// Filename: RealTimeClock.js
// Kitty Vs Everything — v3.29.0
// Real-time clock sync loop for the Internet Bonus Black Cat entourage.
// The iced-out clock pendants on the Black Cats' gold chains display the
// player's ACTUAL local system time (hours + minutes), pulled from
// JavaScript's Date object and kept live during gameplay.
//
// Architecture (kept deliberately separate from the art):
//   - `realTimeClock` is a module-level singleton — one clock feeds every
//     pendant in the entourage, so all 8 Black Cats show the same time.
//   - InternetBonus.init() calls realTimeClock.start() when the round
//     begins; phaseOutFormation() calls realTimeClock.stop() when the
//     formation leaves.
//   - InternetBonus.update() calls realTimeClock.update(dt) every frame.
//     update() re-reads `new Date()` at most once per second — the display
//     only shows hours + minutes, so per-second sync is plenty and keeps
//     the per-frame cost near zero.
//   - BlackCatEntourage.js (pure art) reads realTimeClock.getH12MM() /
//     getMeridiem() / getSeconds() when drawing the pendants — the art
//     module never touches Date itself.
export const VERSION = 'v3.29.0';

export const realTimeClock = {
  running: false,
  _syncTimer: 0,
  _hours: 0,
  _minutes: 0,
  _seconds: 0,

  /** Read the player's actual local system time (JavaScript Date object). */
  _sync() {
    const now = new Date();
    this._hours = now.getHours();
    this._minutes = now.getMinutes();
    this._seconds = now.getSeconds();
  },

  /** Start the sync loop (Internet round begins). Reads the time
   *  immediately so the pendants are never blank on the first frame. */
  start() {
    this.running = true;
    this._syncTimer = 0;
    this._sync();
  },

  /** Stop the sync loop (Internet round ends / formation phases out). */
  stop() {
    this.running = false;
  },

  /**
   * Time-sync loop tick — call once per frame while the round is active.
   * Re-reads `new Date()` at most once per second; the cached HH:MM is
   * what the pendant art renders, so the displays flip live at the
   * minute boundary and the colon blinks on the second.
   */
  update(dt) {
    if (!this.running) return;
    this._syncTimer += dt;
    if (this._syncTimer >= 1) {
      this._syncTimer = 0;
      this._sync();
    }
  },

  /** Local system hours (0-23). */
  getHours() { return this._hours; },
  /** Local system minutes (0-59). */
  getMinutes() { return this._minutes; },
  /** Local system seconds (0-59) — drives the LCD colon blink. */
  getSeconds() { return this._seconds; },

  /** Zero-padded 24-hour "HH:MM" string (kept as the raw 24-hour API). */
  getHHMM() {
    return String(this._hours).padStart(2, '0') + ':' + String(this._minutes).padStart(2, '0');
  },

  /** v3.29.0 — 12-hour clock hour (1-12) for the pendant displays. */
  getHours12() {
    const h = this._hours % 12;
    return h === 0 ? 12 : h;
  },
  /** v3.29.0 — "AM" or "PM" for the pendant displays. */
  getMeridiem() { return this._hours < 12 ? 'AM' : 'PM'; },
  /** v3.29.0 — 12-hour "h:MM" string (e.g. "9:05", "12:45") for the pendant
   *  displays. Hour is NOT zero-padded (standard 12-hour style). */
  getH12MM() {
    return this.getHours12() + ':' + String(this._minutes).padStart(2, '0');
  },
};
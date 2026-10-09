// Filename: core/audio/SoundEffects.js
// Kitty Vs Everything — v4.8.0
// v4.8.0: AUDIO MODULARIZATION — every standalone game SFX voice (laser
//          shots, hits, explosions, coin / power-up pickups, banners, super
//          weapon, game-over sting, UI blips) extracted from the
//          AudioSystem.js monolith. All voices are short synthesized tones
//          through the AudioCore SFX bus (the master × sfx volume is applied
//          once on the bus — no per-voice volume math). Every source node is
//          registered in a live-source set (auto-removed on `onended` —
//          clean GC) and every setTimeout is tracked, so clearAll() can kill
//          dangling timers + nodes (called by the facade's stopAllMusic() /
//          resetAudioEngine()).
export const VERSION = 'v4.8.0';

export class SoundEffects {
  constructor(core) {
    this.core = core;
    this._timers = new Set();  // tracked setTimeout handles
    this._live = new Set();    // live source nodes (auto-removed on onended)
  }

  /** v3.14.0 API: one short tone (pre-bus volume; the SFX bus scales it). */
  tone(freq, dur, type = 'square', vol = 0.05, slideTo = null) {
    if (!this.core.enabled) return;
    const ctx = this.core.ensure();
    if (!ctx || !this.core.sfxBus) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.core.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur);
    this._track(osc);
  }

  /** v3.14.0: short UI click blip (settings / pause / keybind chips). */
  uiBlip(freq = 880, dur = 0.05, vol = 0.05) {
    this.tone(freq, dur, 'square', vol);
  }

  shoot()       { this.tone(880, 0.07, 'square', 0.02, 440); }
  hit()         { this.tone(220, 0.06, 'sawtooth', 0.03, 110); }
  explosion()   { this.tone(120, 0.4, 'sawtooth', 0.08, 30); }
  /** v3.86.0: gold coin pickup: classic two-note arcade coin (B5 to E6). */
  coin() {
    this.tone(987.77, 0.08, 'square', 0.07);
    this._after(70, () => this.tone(1318.51, 0.22, 'square', 0.07));
  }
  powerup()     { this.tone(523, 0.1, 'square', 0.05, 784); this.tone(784, 0.15, 'square', 0.04, 1046); }
  banner()      { this.tone(660, 0.2, 'triangle', 0.06, 880); }
  superWeapon() { this.tone(80, 0.8, 'sawtooth', 0.1, 40); }
  gameOver()    { this.tone(440, 0.6, 'triangle', 0.08, 110); }

  /** Tracked setTimeout — clearAll() never leaves a dangling timer. */
  _after(ms, fn) {
    const id = setTimeout(() => { this._timers.delete(id); fn(); }, ms);
    this._timers.add(id);
    return id;
  }

  /** Register a source node for GC + teardown (auto-removed on onended). */
  _track(src) {
    this._live.add(src);
    src.onended = () => this._live.delete(src);
  }

  /**
   * v4.8.0: kill every dangling SFX timer + live source node. Called by the
   * facade's stopAllMusic() / resetAudioEngine() — safe to call anytime.
   */
  clearAll() {
    for (const id of this._timers) clearTimeout(id);
    this._timers.clear();
    for (const src of this._live) {
      try { src.stop(); } catch (e) { /* already stopped */ }
      try { src.disconnect(); } catch (e) { /* noop */ }
    }
    this._live.clear();
  }
}

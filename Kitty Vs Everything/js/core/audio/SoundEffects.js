// Filename: core/audio/SoundEffects.js
// Kitty Vs Everything — v4.9.0
// v4.9.0: POLYPHONIC SFX — every game SFX voice is now built by the
//          SynthVoice.js engine (detuned oscillators + soft-clip + full
//          ADSR) instead of a raw single oscillator: the SAME public API
//          (tone / uiBlip / shoot / hit / explosion / coin / powerup /
//          banner / superWeapon / gameOver), the SAME AudioCore SFX bus,
//          the SAME tracked-timer + live-source GC — but the voices have
//          body. explosion() layers a filtered noise burst (the crack)
//          over the falling sub (the thump); superWeapon() adds a
//          bandpass noise riser (the charge-up) over the sub drop.
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
export const VERSION = 'v4.9.0';

import { makeVoice, makeNoiseBuffer } from './SynthVoice.js';

export class SoundEffects {
  constructor(core) {
    this.core = core;
    this._timers = new Set();  // tracked setTimeout handles
    this._live = new Set();    // live source nodes (auto-removed on onended)
    this._noise = null;        // white-noise buffer (cached per ctx)
    this._noiseCtx = null;     // the ctx the cached buffer belongs to
  }

  /**
   * v3.14.0 API: one short tone (pre-bus volume; the SFX bus scales it).
   * v4.9.0: now a SynthVoice.js voice (soft-clip + full ADSR) instead of a
   * raw oscillator — same signature, same bus, a warmer transient.
   */
  tone(freq, dur, type = 'square', vol = 0.05, slideTo = null) {
    if (!this.core.enabled) return;
    const ctx = this.core.ensure();
    if (!ctx || !this.core.sfxBus) return;
    const v = makeVoice(ctx, this.core.sfxBus, {
      t: ctx.currentTime, freq,
      type, detunes: [0],
      cutoff: 8000,
      q: 0.5,
      adsr: { a: 0.004, d: Math.max(0.02, dur * 0.6), s: 0.3, r: 0.05 },
      vol, dur,
      slideTo: slideTo || null,
    });
    for (const s of v.sources) this._track(s);
  }

  /** v3.14.0: short UI click blip (settings / pause / keybind chips). */
  uiBlip(freq = 880, dur = 0.05, vol = 0.05) {
    this.tone(freq, dur, 'square', vol);
  }

  shoot()       { this.tone(880, 0.07, 'square', 0.02, 440); }
  hit()         { this.tone(220, 0.06, 'sawtooth', 0.03, 110); }
  /** v4.9.0: explosion = filtered noise burst (the crack) + falling sub (the thump). */
  explosion() {
    if (!this.core.enabled) return;
    const ctx = this.core.ensure();
    if (!ctx || !this.core.sfxBus) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, t0);
    lp.frequency.exponentialRampToValueAtTime(150, t0 + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.14, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.core.sfxBus);
    src.start(t0);
    src.stop(t0 + 0.5);
    this._track(src);
    this.tone(120, 0.4, 'sawtooth', 0.08, 30);
  }
  /** v3.86.0: gold coin pickup: classic two-note arcade coin (B5 to E6). */
  coin() {
    this.tone(987.77, 0.08, 'square', 0.07);
    this._after(70, () => this.tone(1318.51, 0.22, 'square', 0.07));
  }
  powerup()     { this.tone(523, 0.1, 'square', 0.05, 784); this.tone(784, 0.15, 'square', 0.04, 1046); }
  banner()      { this.tone(660, 0.2, 'triangle', 0.06, 880); }
  /** v4.9.0: super weapon = sub drop + bandpass noise riser (the charge-up). */
  superWeapon() {
    this.tone(80, 0.8, 'sawtooth', 0.1, 40);
    if (!this.core.enabled) return;
    const ctx = this.core.ensure();
    if (!ctx || !this.core.sfxBus) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(200, t0);
    bp.frequency.exponentialRampToValueAtTime(3200, t0 + 0.65);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.09, t0 + 0.55);
    g.gain.linearRampToValueAtTime(0.0001, t0 + 0.78);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.core.sfxBus);
    src.start(t0);
    src.stop(t0 + 0.82);
    this._track(src);
  }
  gameOver()    { this.tone(440, 0.6, 'triangle', 0.08, 110); }

  /** White-noise buffer cached per AudioContext (recreated on engine reset). */
  _noiseBuf(ctx) {
    if (!this._noise || this._noiseCtx !== ctx) {
      this._noise = makeNoiseBuffer(ctx, 1.2);
      this._noiseCtx = ctx;
    }
    return this._noise;
  }

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

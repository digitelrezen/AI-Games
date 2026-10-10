// Filename: core/audio/SoundEffects.js
// Kitty Vs Everything — v4.13.0
// v4.13.0: WEAPON SFX BALANCE + VULCAN REDESIGN — the Catship primary
//          weapon fire (vulkanShot / pulseShot / railShot) now routes
//          through a dedicated WEAPON BUS (WEAPON_BUS_GAIN = 0.65, a
//          ~35% reduction) wired into the SFX bus, so continuous Gatling
//          fire blends under the music bed + impact SFX instead of
//          drowning them. vulkanShot() is REBUILT as a fast, heavy,
//          dual-layer mechanical snap: a LOW-MID TRANSIENT CLICK (180–
//          270 Hz square "thock", ~25 ms life) under a PUNCHY NOISE
//          BURST (480–820 Hz bandpass casing pop, ~45 ms life), both
//          with SUBTLE PER-SHOT PITCH VARIANCE (bandpass center +
//          playbackRate jitter) — the high-pitched screech/chirp (the
//          v4.11.0 1800–2700 Hz bandpass + 1500–2000 Hz square click)
//          is GONE; a 14-shot/s Gatling now reads as crisp, heavy
//          gatling chatter. Total voice life stays UNDER the 70 ms
//          fire cadence.
// v4.11.0: AUDIO SUITE POLISH — the weapon SFX are rebuilt as dedicated
//          high-performance voices and the SFX engine gains bounded voice
//          pooling so rapid-fire can never starve the AudioContext:
//            • vulkanShot() — fast, crisp ballistic snap: a ~35 ms
//              bandpassed noise crack (the casing pop) over a very short
//              square click, with PER-SHOT pitch variation (bandpass 1800–
//              2700 Hz, click 1500–2000 Hz, playbackRate jitter) so a
//              14-shot/s Gatling reads as a tight mechanical chatter,
//              never a stacked buzz. Total voice life < the 70 ms cadence.
//            • pulseShot() — rich sci-fi energy punch: a 3-osc detuned
//              saw with a FAST DOWNWARD PITCH DROP (900→180 Hz) through a
//              warm RESONANT lowpass pop (cutoff sweep 3200→700 Hz, Q 2.4)
//              + a sine sub + a high "zap" click.
//            • railShot() — immense power: a heavy SUB-BASS TRANSIENT
//              (130→38 Hz sine, 0.20 peak — the initial punch), an
//              ELECTRIC HIGH-FREQUENCY SNAP (highpassed noise crack +
//              2800→7500 Hz zing) and a mid rail-discharge sweep.
//            • shoot() is now the ROCKET LAUNCH whoosh (BaseRocket) —
//              rising bandpass noise + a low thump; the old generic beep
//              is gone.
//            • explosion() — the hollow "garbage can" tail is dead: the
//              crack is a PRE-SHAPED noise buffer (transient baked in —
//              4 ms attack + fast exponential decay) through a STATIC
//              lowpass (no long filter sweep = no comb ringing), over a
//              sine sub drop (90→32 Hz) — a tight, room-shaking arcade
//              thump with a clean transient drop.
//            • ANTI-CLIPPING / VOICE POOLING: every SFX source is
//              tracked in a bounded pool (MAX_LIVE_SOURCES) with
//              oldest-voice stealing — spamming fire keys recycles nodes
//              cleanly instead of stacking unbounded voices on the
//              context; AudioCore adds a soft-clip shaper on the SFX bus
//              as the final ceiling.
//            • ZERO SILENT TRIGGERS: hullHit() (hull chip thud),
//              shieldBreak() (shield shatter), bossSpawn() (boss alarm +
//              riser), overheat() (Vulcan lockout hiss), dock() (mini
//              ship dock blips), weaponSwitch() (weapon cycle click).
// v4.9.0: POLYPHONIC SFX — every game SFX voice is built by the
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
export const VERSION = 'v4.13.0';

import { makeVoice, makeNoiseBuffer } from './SynthVoice.js';

// ─── v4.11.0: bounded SFX voice pool ───
// Every source node started by the SFX engine is tracked in this._live.
// When the pool exceeds MAX_LIVE_SOURCES, the OLDEST voice is stolen
// (force-stopped + disconnected) to make room — rapid-fire spam recycles
// nodes cleanly and can never stack unbounded voices on the AudioContext
// (the anti-starvation / anti-crackle guarantee).
const MAX_LIVE_SOURCES = 24;

// ─── v4.13.0: primary-weapon master output bus ───
// Every Catship primary-weapon fire voice (vulkanShot / pulseShot /
// railShot) routes through this GainNode BEFORE the SFX bus, so the
// whole weapon family sits ~35% below the raw SFX level — continuous
// Gatling fire blends under the music bed + impact SFX instead of
// drowning them. One knob, one place: weapon balance never touches
// the per-voice envelopes or the global sfx volume.
const WEAPON_BUS_GAIN = 0.65;

export class SoundEffects {
  constructor(core) {
    this.core = core;
    this._timers = new Set();  // tracked setTimeout handles
    this._live = new Set();    // live source nodes (auto-removed on onended)
    this._noise = null;        // white-noise buffer (cached per ctx)
    this._boom = null;         // pre-shaped explosion crack buffer (per ctx)
    this._noiseCtx = null;     // the ctx the cached buffers belong to
    this._wBus = null;         // v4.13.0: weapon bus GainNode (per ctx)
    this._wBusCtx = null;      // the ctx the weapon bus belongs to
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

  /**
   * v4.13.0: VULCAN CANNON — fast, HEAVY, dual-layer mechanical snap.
   * The v4.11.0 high-pitched screech/chirp (1800–2700 Hz bandpass crack
   * + 1500–2000 Hz square click) is GONE. Instead:
   *   1) LOW-MID TRANSIENT CLICK — a 180–270 Hz square "thock" through
   *      a tight 900 Hz lowpass (~25 ms life), the mechanical snap of
   *      the barrel.
   *   2) PUNCHY NOISE BURST — a 480–820 Hz bandpass casing pop (~45 ms
   *      life), the ballistic crack.
   * Both layers carry SUBTLE PER-SHOT PITCH VARIANCE (bandpass center
   * + playbackRate jitter + click frequency) so a 14-shot/s Gatling
   * reads as crisp, heavy gatling chatter, never a stacked buzz. Total
   * voice life is UNDER the 70 ms fire cadence — no overlap buildup.
   * Routes through the v4.13.0 weapon bus (−35% master weapon level).
   */
  vulkanShot() {
    if (!this.core.enabled) return;
    const ctx = this.core.ensure();
    if (!ctx || !this.core.sfxBus) return;
    const t0 = ctx.currentTime;
    const bus = this._weaponBus(ctx);
    // 1) Low-mid transient click — the mechanical "thock" of the barrel,
    //    with subtle per-shot pitch (180–270 Hz).
    const v = makeVoice(ctx, bus, {
      t: t0, freq: 180 + Math.random() * 90,
      type: 'square', detunes: [0],
      cutoff: 900, q: 0.6,
      adsr: { a: 0.001, d: 0.016, s: 0.1, r: 0.008 },
      vol: 0.1, dur: 0.022,
    });
    for (const s of v.sources) this._track(s);
    // 2) Punchy noise burst — the ballistic casing pop (bandpass 480–
    //    820 Hz, per-shot pitch via center + playbackRate jitter).
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx);
    src.playbackRate.value = 0.9 + Math.random() * 0.18;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 480 + Math.random() * 340;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.042);
    src.connect(bp);
    bp.connect(g);
    g.connect(bus);
    src.start(t0);
    src.stop(t0 + 0.048);
    this._track(src);
  }

  /**
   * v4.11.0: PULSE / PLASMA CANNON — rich frequency sweep with a fast
   * downward pitch drop (900→180 Hz) through a warm resonant lowpass pop
   * (cutoff 3200→700 Hz, Q 2.4) + sine sub + a high "zap" click — a
   * satisfying sci-fi energy punch.
   * v4.13.0: routes through the weapon bus (−35% master weapon level).
   */
  pulseShot() {
    if (!this.core.enabled) return;
    const ctx = this.core.ensure();
    if (!ctx || !this.core.sfxBus) return;
    const t0 = ctx.currentTime;
    const bus = this._weaponBus(ctx);
    // 1) Energy core — detuned saw, fast downward pitch drop, resonant pop.
    const v = makeVoice(ctx, bus, {
      t: t0, freq: 900, slideTo: 180,
      type: 'sawtooth', detunes: [-7, 0, 7],
      sub: true, subLevel: 0.4,
      cutoff: 3200, q: 2.4,
      sweeps: [[0.09, 700]],
      adsr: { a: 0.004, d: 0.09, s: 0.35, r: 0.05 },
      vol: 0.085, dur: 0.13,
    });
    for (const s of v.sources) this._track(s);
    // 2) High "zap" click — the emitter crack.
    const z = makeVoice(ctx, bus, {
      t: t0, freq: 2400, slideTo: 900,
      type: 'square', detunes: [0],
      cutoff: 7000, q: 0.5,
      adsr: { a: 0.001, d: 0.03, s: 0.2, r: 0.02 },
      vol: 0.03, dur: 0.045,
    });
    for (const s of z.sources) this._track(s);
  }

  /**
   * v4.11.0: RAIL CANNON — deep, high-impact sub-bass transient (130→38 Hz
   * sine, heavy initial punch) combined with an electric high-frequency
   * snap (highpassed noise crack + 2800→7500 Hz zing) and a mid
   * rail-discharge sweep — immense power.
   * v4.13.0: routes through the weapon bus (−35% master weapon level).
   */
  railShot() {
    if (!this.core.enabled) return;
    const ctx = this.core.ensure();
    if (!ctx || !this.core.sfxBus) return;
    const t0 = ctx.currentTime;
    const bus = this._weaponBus(ctx);
    // 1) Deep sub-bass transient — the heavy initial punch.
    const sub = makeVoice(ctx, bus, {
      t: t0, freq: 130, slideTo: 38,
      type: 'sine', detunes: [0],
      cutoff: 400, q: 0.4,
      adsr: { a: 0.002, d: 0.14, s: 0.3, r: 0.1 },
      vol: 0.2, dur: 0.24,
    });
    for (const s of sub.sources) this._track(s);
    // 2) Electric high-frequency snap — highpassed noise crack.
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4500;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.12, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    src.connect(hp);
    hp.connect(ng);
    ng.connect(bus);
    src.start(t0);
    src.stop(t0 + 0.06);
    this._track(src);
    // 3) Rail discharge zing — bright square sweep up (2800→7500 Hz).
    const zing = makeVoice(ctx, bus, {
      t: t0, freq: 2800, slideTo: 7500,
      type: 'square', detunes: [0],
      cutoff: 9000, q: 0.5,
      adsr: { a: 0.001, d: 0.05, s: 0.2, r: 0.03 },
      vol: 0.035, dur: 0.07,
    });
    for (const s of zing.sources) this._track(s);
    // 4) Mid discharge sweep — the "rail" body (300→120 Hz saw, tight LP).
    const body = makeVoice(ctx, bus, {
      t: t0, freq: 300, slideTo: 120,
      type: 'sawtooth', detunes: [-5, 5],
      cutoff: 1400, q: 1.2,
      adsr: { a: 0.003, d: 0.1, s: 0.3, r: 0.06 },
      vol: 0.06, dur: 0.16,
    });
    for (const s of body.sources) this._track(s);
  }

  /**
   * v4.11.0: generic shoot() is now the ROCKET LAUNCH whoosh (BaseRocket
   * twin salvos) — a rising bandpass noise sweep (500→2400 Hz) with a low
   * thump. The old generic laser beep is gone (weapons have dedicated
   * voices: vulkanShot / pulseShot / railShot).
   */
  shoot() {
    if (!this.core.enabled) return;
    const ctx = this.core.ensure();
    if (!ctx || !this.core.sfxBus) return;
    const t0 = ctx.currentTime;
    // 1) Launch whoosh — rising bandpass noise.
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(500, t0);
    bp.frequency.exponentialRampToValueAtTime(2400, t0 + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.07, t0 + 0.06);
    g.gain.linearRampToValueAtTime(0.0001, t0 + 0.26);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.core.sfxBus);
    src.start(t0);
    src.stop(t0 + 0.28);
    this._track(src);
    // 2) Low launch thump.
    const thump = makeVoice(ctx, this.core.sfxBus, {
      t: t0, freq: 150, slideTo: 60,
      type: 'sine', detunes: [0],
      cutoff: 500, q: 0.5,
      adsr: { a: 0.002, d: 0.08, s: 0.3, r: 0.05 },
      vol: 0.08, dur: 0.12,
    });
    for (const s of thump.sources) this._track(s);
  }

  hit() { this.tone(220, 0.06, 'sawtooth', 0.03, 110); }

  /**
   * v4.11.0: EXPLOSION — the hollow "garbage can" reverb/comb-filter tail
   * is fixed: the crack is a PRE-SHAPED noise buffer (transient baked in —
   * 4 ms attack + fast exponential decay, so the tail is already gone by
   * 200 ms) through a STATIC lowpass (no long filter sweep = no comb
   * ringing), layered over a sine sub drop (90→32 Hz) — a tight,
   * room-shaking arcade thump with a clean transient drop.
   */
  explosion() {
    if (!this.core.enabled) return;
    const ctx = this.core.ensure();
    if (!ctx || !this.core.sfxBus) return;
    const t0 = ctx.currentTime;
    // 1) The CRACK — pre-shaped noise buffer through a static lowpass.
    const src = ctx.createBufferSource();
    src.buffer = this._boomBuf(ctx);
    src.playbackRate.value = 0.92 + Math.random() * 0.16; // per-boom variation
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    lp.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.core.sfxBus);
    src.start(t0);
    src.stop(t0 + 0.3);
    this._track(src);
    // 2) The THUMP — sine sub drop (90→32 Hz), the room-shaking low end.
    const sub = makeVoice(ctx, this.core.sfxBus, {
      t: t0, freq: 90, slideTo: 32,
      type: 'sine', detunes: [0],
      cutoff: 300, q: 0.4,
      adsr: { a: 0.002, d: 0.16, s: 0.35, r: 0.08 },
      vol: 0.18, dur: 0.24,
    });
    for (const s of sub.sources) this._track(s);
  }

  /** v3.86.0: gold coin pickup: classic two-note arcade coin (B5 to E6). */
  coin() {
    this.tone(987.77, 0.08, 'square', 0.07);
    this._after(70, () => this.tone(1318.51, 0.22, 'square', 0.07));
  }
  powerup()     { this.tone(523, 0.1, 'square', 0.05, 784); this.tone(784, 0.15, 'square', 0.04, 1046); }
  banner()      { this.tone(660, 0.2, 'triangle', 0.06, 880); }

  /** v4.11.0: HULL HIT — metallic hull-chip thud (square drop + noise tick). */
  hullHit() {
    if (!this.core.enabled) return;
    const ctx = this.core.ensure();
    if (!ctx || !this.core.sfxBus) return;
    const t0 = ctx.currentTime;
    const v = makeVoice(ctx, this.core.sfxBus, {
      t: t0, freq: 160, slideTo: 90,
      type: 'square', detunes: [0],
      cutoff: 900, q: 1.0,
      adsr: { a: 0.002, d: 0.05, s: 0.25, r: 0.03 },
      vol: 0.055, dur: 0.07,
    });
    for (const s of v.sources) this._track(s);
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.04, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.core.sfxBus);
    src.start(t0);
    src.stop(t0 + 0.035);
    this._track(src);
  }

  /** v4.11.0: SHIELD BREAK — glassy shatter (bandpass burst + descending square). */
  shieldBreak() {
    if (!this.core.enabled) return;
    const ctx = this.core.ensure();
    if (!ctx || !this.core.sfxBus) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.core.sfxBus);
    src.start(t0);
    src.stop(t0 + 0.16);
    this._track(src);
    const v = makeVoice(ctx, this.core.sfxBus, {
      t: t0, freq: 1200, slideTo: 400,
      type: 'square', detunes: [0],
      cutoff: 4000, q: 0.8,
      adsr: { a: 0.002, d: 0.08, s: 0.3, r: 0.05 },
      vol: 0.05, dur: 0.12,
    });
    for (const s of v.sources) this._track(s);
  }

  /** v4.11.0: BOSS SPAWN — two-tone alarm (440/554 Hz) over a low riser sub. */
  bossSpawn() {
    if (!this.core.enabled) return;
    const ctx = this.core.ensure();
    if (!ctx || !this.core.sfxBus) return;
    const t0 = ctx.currentTime;
    const a = makeVoice(ctx, this.core.sfxBus, {
      t: t0, freq: 440,
      type: 'sawtooth', detunes: [0],
      cutoff: 2500, q: 0.8,
      adsr: { a: 0.01, d: 0.1, s: 0.8, r: 0.04 },
      vol: 0.05, dur: 0.24,
    });
    for (const s of a.sources) this._track(s);
    const b = makeVoice(ctx, this.core.sfxBus, {
      t: t0 + 0.26, freq: 554.37,
      type: 'sawtooth', detunes: [0],
      cutoff: 2500, q: 0.8,
      adsr: { a: 0.01, d: 0.1, s: 0.8, r: 0.04 },
      vol: 0.05, dur: 0.24,
    });
    for (const s of b.sources) this._track(s);
    const r = makeVoice(ctx, this.core.sfxBus, {
      t: t0, freq: 50, slideTo: 95,
      type: 'sine', detunes: [0],
      cutoff: 400, q: 0.4,
      adsr: { a: 0.05, d: 0.3, s: 0.6, r: 0.15 },
      vol: 0.09, dur: 0.5,
    });
    for (const s of r.sources) this._track(s);
  }

  /** v4.11.0: VULCAN OVERHEAT — steam hiss (highpassed noise, 0.45 s fade). */
  overheat() {
    if (!this.core.enabled) return;
    const ctx = this.core.ensure();
    if (!ctx || !this.core.sfxBus) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx);
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.05, t0 + 0.05);
    g.gain.linearRampToValueAtTime(0.0001, t0 + 0.45);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.core.sfxBus);
    src.start(t0);
    src.stop(t0 + 0.5);
    this._track(src);
  }

  /** v4.11.0: MINI-SHIP DOCK — two rising confirmation blips. */
  dock() {
    this.tone(620, 0.06, 'square', 0.045);
    this._after(70, () => this.tone(930, 0.08, 'square', 0.045));
  }

  /** v4.11.0: WEAPON SWITCH — mechanical two-step click. */
  weaponSwitch() {
    this.tone(700, 0.04, 'square', 0.04);
    this._after(45, () => this.tone(1050, 0.05, 'square', 0.035));
  }

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

  /**
   * v4.13.0: the primary-weapon master output bus — a GainNode at
   * WEAPON_BUS_GAIN (−35%) wired into the SFX bus. Built lazily on first
   * fire and cached per AudioContext (recreated on engine reset, same
   * pattern as the noise buffers). Every primary-weapon fire voice
   * (vulkanShot / pulseShot / railShot) connects HERE instead of the raw
   * SFX bus, so weapon balance is one knob in one place.
   */
  _weaponBus(ctx) {
    if (!this._wBus || this._wBusCtx !== ctx) {
      this._wBus = ctx.createGain();
      this._wBus.gain.value = WEAPON_BUS_GAIN;
      this._wBus.connect(this.core.sfxBus);
      this._wBusCtx = ctx;
    }
    return this._wBus;
  }

  /** White-noise buffer cached per AudioContext (recreated on engine reset). */
  _noiseBuf(ctx) {
    if (!this._noise || this._noiseCtx !== ctx) {
      this._noise = makeNoiseBuffer(ctx, 1.2);
      this._boom = null;
      this._noiseCtx = ctx;
    }
    return this._noise;
  }

  /**
   * v4.11.0: pre-shaped explosion crack buffer — broadband noise with the
   * transient BAKED IN (4 ms attack + fast exponential decay). The tail is
   * already gone by ~200 ms, so a static lowpass can never ring a hollow
   * comb-filter tail (the v4.9.0 "garbage can" fix). Cached per ctx.
   */
  _boomBuf(ctx) {
    if (this._boom && this._noiseCtx === ctx) return this._boom;
    const len = Math.max(1, Math.floor(ctx.sampleRate * 0.35));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate;
      const env = Math.min(1, t / 0.004) * Math.exp(-t * 18);
      d[i] = (Math.random() * 2 - 1) * env;
    }
    this._boom = buf;
    return buf;
  }

  /** Tracked setTimeout — clearAll() never leaves a dangling timer. */
  _after(ms, fn) {
    const id = setTimeout(() => { this._timers.delete(id); fn(); }, ms);
    this._timers.add(id);
    return id;
  }

  /**
   * v4.11.0: register a source node for GC + teardown (auto-removed on
   * onended) AND enforce the bounded voice pool — if the pool exceeds
   * MAX_LIVE_SOURCES, the OLDEST voice is stolen (force-stopped +
   * disconnected; Sets preserve insertion order) so rapid-fire spam
   * recycles nodes cleanly instead of overloading the AudioContext.
   */
  _track(src) {
    this._live.add(src);
    src.onended = () => this._live.delete(src);
    while (this._live.size > MAX_LIVE_SOURCES) {
      const oldest = this._live.values().next().value;
      if (!oldest) break;
      this._live.delete(oldest);
      try { oldest.stop(); } catch (e) { /* already stopped */ }
      try { oldest.disconnect(); } catch (e) { /* noop */ }
    }
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

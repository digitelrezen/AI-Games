// Filename: AudioSystem.js
// Kitty Vs Everything — v4.4.0
// Synthesized SFX via WebAudio (zero audio files, zero dependencies).
// v3.14.0: Volume layer (setVolumes — master / SFX / music, applied at
//          startup from Settings.js and live from the Settings screen),
//          uiBlip() for UI clicks, and a startMusic/stopMusic mission-music
//          sequencer (PauseMenu starts it on mission start, stops it on
//          pause and game over).
// v4.4.0: DYNAMIC PROCEDURAL SOUNDTRACK — the old 8-step A-minor loop
//          (4 unique notes on a static 110 Hz drone) is GONE. The mission
//          soundtrack is now a multi-layer generative engine that changes
//          tension with gameplay context (MusicDirector.js syncs the mode
//          from game state every frame):
//            • open     — atmospheric space sweep (92bpm, Am/F/C/G 8-bar
//                         progression, slow arpeggio, whole-note bass,
//                         shimmer pings + space delay, NO percussion)
//            • combat   — driving engagement (126bpm, Em/C/G/D, 16th-note
//                         arps, 8th-note bass, 4-on-the-floor kick + snare
//                         + offbeat hats)
//            • boneyard — dark hazard zone (118bpm, Fm/Ab/Bb/Db/Eb, sparse
//                         tense arps, half-note bass, syncopated kick)
//            • boss     — max intensity (140bpm, Em/C/G/D/B, dense
//                         octave-doubled arps, 16th-note driving bass,
//                         full kit) — bosses / Eridath's Mom's House
//          Non-repetition: each mode runs an 8-bar (128 sixteenth-step)
//          phrase; per phrase a seeded PRNG rotates one of 3 algorithmic
//          arpeggio pattern variants, varies the pad filter sweep, and
//          rolls an occasional octave lift / phrase fill — the same
//          progression never carries the same arpeggio twice in a row.
//          Mode changes apply at the next bar boundary (smooth handoff)
//          with a riser (intensity up) or sub-drop (intensity down)
//          transition accent.

export const VERSION = 'v4.4.0';

// ─── v4.4.0: procedural soundtrack data ───
// MIDI → Hz (69 = A4 = 440).
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Seeded PRNG — per-phrase variation (deterministic per phrase + mode, so
// the soundtrack evolves without ever sounding random-noise).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The four context modes. chords = 8 bars × 3 MIDI chord tones; arps = 3
// 16-step (one bar of 16ths) pattern variants (chord-tone index 0..2,
// -1 = rest); bass = note pattern style; perc = 16th-grid hit positions
// (null = no percussion); vols = per-layer base levels.
export const MUSIC_MODES = {
  open: {
    intensity: 0,
    bpm: 92,
    chords: [
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [48, 52, 55], // C
      [55, 59, 62], // G
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [55, 59, 62], // G
      [52, 55, 59], // Em
    ],
    arps: [
      [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 2, -1, 1, -1, 0, -1],
      [0, -1, 2, -1, 1, -1, 2, -1, 0, -1, 1, -1, 2, -1, 1, -1],
      [0, 1, 2, -1, 1, 2, 0, -1, 2, 1, 0, -1, 1, 0, 1, -1],
    ],
    bass: 'whole',
    perc: null,
    padCutoff: 1500,
    vols: { pad: 0.09, arp: 0.055, bass: 0.11, perc: 0 },
  },
  combat: {
    intensity: 1,
    bpm: 126,
    chords: [
      [52, 55, 59], // Em
      [48, 52, 55], // C
      [55, 59, 62], // G
      [50, 53, 57], // D
      [52, 55, 59], // Em
      [48, 52, 55], // C
      [55, 59, 62], // G
      [50, 53, 57], // D
    ],
    arps: [
      [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 2, 1, 0, 1],
      [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 1, 0, 1, 2],
      [0, 2, 0, 2, 1, 2, 1, 2, 0, 2, 0, 2, 2, 1, 2, 1],
    ],
    bass: 'eighth',
    perc: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
    padCutoff: 1000,
    vols: { pad: 0.055, arp: 0.06, bass: 0.15, perc: 0.8 },
  },
  boneyard: {
    intensity: 2,
    bpm: 118,
    chords: [
      [53, 56, 59], // Fm
      [44, 48, 51], // Ab
      [46, 50, 53], // Bb
      [49, 53, 56], // Db
      [53, 56, 59], // Fm
      [44, 48, 51], // Ab
      [46, 50, 53], // Bb
      [51, 54, 57], // Eb
    ],
    arps: [
      [0, -1, -1, 2, -1, -1, 1, -1, 0, -1, -1, 2, -1, 1, -1, 2],
      [0, 1, -1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, -1, -1, -1],
      [0, -1, 2, -1, 1, -1, 0, -1, 2, -1, 1, -1, 0, -1, 2, -1],
    ],
    bass: 'half',
    perc: { kick: [0, 7, 10], snare: [8], hat: [4, 12] },
    padCutoff: 900,
    vols: { pad: 0.08, arp: 0.06, bass: 0.14, perc: 0.75 },
  },
  boss: {
    intensity: 3,
    bpm: 140,
    chords: [
      [52, 55, 59], // Em
      [52, 55, 59], // Em
      [48, 52, 55], // C
      [55, 59, 62], // G
      [50, 53, 57], // D
      [50, 53, 57], // D
      [47, 50, 53], // B (V — pre-dominant tension)
      [52, 55, 59], // Em
    ],
    arps: [
      [0, 0, 2, 2, 1, 2, 1, 2, 0, 0, 2, 2, 1, 2, 1, 2],
      [0, 2, 0, 2, 1, 2, 1, 2, 0, 2, 0, 2, 2, 1, 0, 1],
      [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 2, 1, 0, 1],
    ],
    bass: 'sixteenth',
    perc: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    padCutoff: 1200,
    vols: { pad: 0.05, arp: 0.07, bass: 0.17, perc: 1 },
  },
};

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    // ─── v3.14.0: volume layer (Settings.js sliders → 0..1) ───
    this.master = 1;
    this.sfx = 1;
    this.music = 1;
    // ─── v4.4.0: dynamic soundtrack state ───
    this.musicPlaying = false;
    this._musicGain = null;  // master music gain (→ ctx.destination)
    this._musicTimer = null;
    this._musicNext = 0;     // next 16th-note start time (ctx seconds)
    this._musicStep = 0;     // global 16th-note step counter
    this._mode = 'open';        // active mode (applied at bar boundaries)
    this._pendingMode = 'open'; // requested mode (setMusicMode)
    this._layers = null;       // { pad, arp, bass, perc, fx, delay, noise }
  }
  _ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { this.enabled = false; return; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  /** v3.14.0: apply the three Settings.js volumes (0..1 each). */
  setVolumes(master, sfx, music) {
    this.master = Math.max(0, Math.min(1, +master || 0));
    this.sfx = Math.max(0, Math.min(1, +sfx || 0));
    this.music = Math.max(0, Math.min(1, +music || 0));
    if (this._musicGain && this.ctx) {
      this._musicGain.gain.setTargetAtTime(this.music, this.ctx.currentTime, 0.1);
    }
  }
  /** v3.14.0: short UI click blip (settings / pause / keybind chips). */
  uiBlip(freq = 880, dur = 0.05, vol = 0.05) {
    this.tone(freq, dur, 'square', vol);
  }
  tone(freq, dur, type = 'square', vol = 0.05, slideTo = null) {
    if (!this.enabled) return;
    this._ensure();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    // v3.14.0: every SFX tone is scaled by master × sfx volume.
    gain.gain.setValueAtTime(vol * this.master * this.sfx, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  }
  shoot()       { this.tone(880, 0.07, 'square', 0.02, 440); }
  hit()         { this.tone(220, 0.06, 'sawtooth', 0.03, 110); }
  explosion()   { this.tone(120, 0.4, 'sawtooth', 0.08, 30); }
  /** v3.86.0: gold coin pickup: classic two-note arcade coin (B5 to E6). */
  coin()        { this.tone(987.77, 0.08, 'square', 0.07); setTimeout(() => this.tone(1318.51, 0.22, 'square', 0.07), 70); }
  powerup()     { this.tone(523, 0.1, 'square', 0.05, 784); this.tone(784, 0.15, 'square', 0.04, 1046); }
  banner()      { this.tone(660, 0.2, 'triangle', 0.06, 880); }
  superWeapon() { this.tone(80, 0.8, 'sawtooth', 0.1, 40); }
  gameOver()    { this.tone(440, 0.6, 'triangle', 0.08, 110); }

  // ═══════════════════════════════════════════════════════════
  //  v4.4.0: DYNAMIC PROCEDURAL SOUNDTRACK
  //  Look-ahead 16th-note scheduler. Four context modes (open /
  //  combat / boneyard / boss) — 8-bar chord progressions, layered
  //  pad / arpeggio / bass / percussion, per-phrase seeded
  //  variation. Zero audio files.
  // ═══════════════════════════════════════════════════════════
  /**
   * v4.4.0: request a soundtrack mode ('open' | 'combat' | 'boneyard' |
   * 'boss'). Takes effect at the next bar boundary (smooth handoff) and
   * plays a riser (intensity up) or sub-drop (intensity down) transition
   * accent. Safe to call every frame — a no-op when the mode is unchanged
   * or music is not playing.
   */
  setMusicMode(mode) {
    if (!MUSIC_MODES[mode]) return;
    if (mode === this._pendingMode) return;
    const from = this._pendingMode;
    this._pendingMode = mode;
    if (this.musicPlaying && this.ctx) {
      const t0 = this.ctx.currentTime + 0.02;
      if (MUSIC_MODES[mode].intensity > MUSIC_MODES[from].intensity) this._riser(t0);
      else this._subDrop(t0);
    }
  }
  /** v4.4.0: the requested soundtrack mode (MusicDirector reads this). */
  getMusicMode() { return this._pendingMode; }

  startMusic() {
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    this._ensure();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const master = ctx.createGain();
    master.gain.value = this.music;
    master.connect(ctx.destination);
    // Per-layer sub-gains (the scheduler writes into these; the master
    // carries the Settings music volume).
    const layers = {};
    for (const name of ['pad', 'arp', 'bass', 'perc', 'fx']) {
      const g = ctx.createGain();
      g.gain.value = 1;
      g.connect(master);
      layers[name] = g;
    }
    // Space delay (dotted-8th feedback) — the arp + shimmer send that
    // gives the open-space sweep its depth.
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.375;
    const fb = ctx.createGain(); fb.gain.value = 0.3;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    delay.connect(dlp); dlp.connect(fb); fb.connect(delay);
    delay.connect(wet); wet.connect(master);
    // Shared white-noise buffer (percussion voices).
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this._musicGain = master;
    this._layers = { pad: layers.pad, arp: layers.arp, bass: layers.bass, perc: layers.perc, fx: layers.fx, delay, noise };
    this._musicStep = 0;
    this._mode = this._pendingMode; // start straight in the requested mode
    this._musicNext = ctx.currentTime + 0.15;
    this._scheduleMusic();
  }
  stopMusic() {
    if (!this.musicPlaying) return;
    this.musicPlaying = false;
    if (this._musicTimer) { clearTimeout(this._musicTimer); this._musicTimer = null; }
    if (this._musicGain) {
      const m = this._musicGain;
      const layers = this._layers;
      m.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
      setTimeout(() => {
        try { m.disconnect(); } catch (e) { /* noop */ }
        if (layers) {
          for (const k of ['pad', 'arp', 'bass', 'perc', 'fx']) {
            try { layers[k].disconnect(); } catch (e) { /* noop */ }
          }
          try { layers.delay.disconnect(); } catch (e) { /* noop */ }
        }
      }, 800);
      this._musicGain = null;
      this._layers = null;
    }
  }

  // ─── v4.4.0: scheduler internals ───

  /** 16th-note duration for a mode (s). */
  _stepDur(cfg) { return 60 / cfg.bpm / 4; }

  /** Look-ahead loop: schedule every 16th up to 0.6 s ahead of now. */
  _scheduleMusic() {
    if (!this.musicPlaying || !this.ctx) return;
    const LOOKAHEAD = 0.6;
    while (this._musicNext < this.ctx.currentTime + LOOKAHEAD) {
      // Mode changes apply at the bar boundary (smooth handoff + the
      // tempo grid re-anchors on the new mode's step length).
      if (this._musicStep % 16 === 0 && this._pendingMode !== this._mode) {
        this._mode = this._pendingMode;
      }
      const cfg = MUSIC_MODES[this._mode];
      this._scheduleStep(this._musicStep, this._musicNext, cfg);
      this._musicNext += this._stepDur(cfg);
      this._musicStep++;
    }
    this._musicTimer = setTimeout(() => this._scheduleMusic(), 100);
  }

  /** One 16th note of the arrangement. */
  _scheduleStep(s, t, cfg) {
    if (!this._layers) return;
    const sib = s % 16;
    const bar = Math.floor(s / 16) % 8;
    const phrase = Math.floor(s / 128);
    const chord = cfg.chords[bar];
    const step = this._stepDur(cfg);
    const barLen = step * 16;
    // Per-phrase seeded variation (deterministic per phrase + mode).
    const rng = mulberry32((phrase * 0x9E3779B9) ^ (cfg.intensity * 0x85EBCA6B) ^ 0x1234);
    const arpIdx = Math.floor(rng() * cfg.arps.length);
    const padSweep = 0.8 + rng() * 0.9;    // pad cutoff multiplier
    const arpLift = rng() < 0.3 ? 12 : 0;  // occasional octave lift
    const fill = bar === 7;                // phrase fill on the last bar

    // ─── PAD (once per bar): detuned saws through a sweeping lowpass ───
    if (sib === 0) this._schedulePad(chord, t, barLen, cfg, padSweep);

    // ─── ARPEGGIO (pattern-driven, per 16th) ───
    const pattern = cfg.arps[arpIdx];
    const deg = pattern[sib];
    if (deg >= 0) {
      const f = hz(chord[deg] + 12 + arpLift);
      this._note(f, t, step * 1.8, 'triangle', cfg.vols.arp, this._layers.arp, true);
      // Boss mode doubles the arps an octave on the downbeats.
      if (this._mode === 'boss' && sib % 4 === 0) {
        this._note(f * 2, t, step * 1.4, 'triangle', cfg.vols.arp * 0.5, this._layers.arp, true);
      }
    }

    // ─── BASS (mode-specific pattern) ───
    const root = Math.max(36, chord[0] - 12);
    if (cfg.bass === 'whole' && sib === 0) {
      this._note(hz(root), t, barLen * 0.98, 'sine', cfg.vols.bass, this._layers.bass, false);
    } else if (cfg.bass === 'half' && (sib === 0 || sib === 8)) {
      this._note(hz(root), t, step * 7.5, 'sine', cfg.vols.bass, this._layers.bass, false);
    } else if (cfg.bass === 'eighth' && sib % 2 === 0) {
      this._note(hz(root), t, step * 0.9, 'triangle', cfg.vols.bass, this._layers.bass, false);
    } else if (cfg.bass === 'sixteenth') {
      this._note(hz(root + (sib % 2 === 1 ? 12 : 0)), t, step * 0.85, 'sawtooth', cfg.vols.bass * 0.8, this._layers.bass, false, 600);
    }

    // ─── PERCUSSION (noise-based; none in open space) ───
    if (cfg.perc) {
      const p = cfg.perc;
      if (p.kick.includes(sib)) this._kick(t, cfg.vols.perc);
      if (p.snare.includes(sib)) this._snare(t, cfg.vols.perc);
      const hatOn = p.hat.includes(sib) || (fill && (this._mode === 'combat' || this._mode === 'boss'));
      if (hatOn) this._hat(t, cfg.vols.perc, fill && sib >= 12);
      // Phrase fills (last bar of the 8-bar phrase).
      if (fill && (this._mode === 'combat' || this._mode === 'boss') && sib === 14) this._snare(t, cfg.vols.perc);
      if (fill && this._mode === 'boneyard' && (sib === 14 || sib === 15)) this._kick(t, cfg.vols.perc);
    }

    // ─── SHIMMER (open space only): long pings + a slow 2-bar glide ───
    if (this._mode === 'open') {
      if (s % 128 === 0) this._shimmerPing(hz(chord[2] + 24), t, 2.5);
      if (s % 128 === 64) this._shimmerGlide(hz(chord[1] + 12), hz(chord[1] + 16), t, barLen * 2);
    }
  }

  /** One short synthesized voice into a music layer (optional delay send). */
  _note(freq, t, dur, type, vol, layer, sendDelay, lpFreq = 0) {
    if (!this._layers) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.02, dur * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let head = osc;
    if (lpFreq > 0) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lpFreq;
      head.connect(lp);
      head = lp;
    }
    head.connect(gain).connect(layer);
    if (sendDelay) gain.connect(this._layers.delay);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Evolving space pad: 2 detuned saws per chord tone, sweeping lowpass. */
  _schedulePad(chord, t, barLen, cfg, sweep) {
    if (!this._layers) return;
    const ctx = this.ctx;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 0.8;
    const c0 = cfg.padCutoff * sweep;
    filt.frequency.setValueAtTime(c0, t);
    filt.frequency.linearRampToValueAtTime(c0 * 1.5, t + barLen * 0.55);
    filt.frequency.linearRampToValueAtTime(c0 * 0.8, t + barLen);
    const g = ctx.createGain();
    const peak = cfg.vols.pad;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + barLen * 0.25);
    g.gain.setValueAtTime(peak, t + barLen * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + barLen * 1.15);
    filt.connect(g).connect(this._layers.pad);
    for (const m of chord) {
      for (const det of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = hz(m);
        osc.detune.value = det;
        osc.connect(filt);
        osc.start(t);
        osc.stop(t + barLen * 1.2);
      }
    }
  }

  // ─── v4.4.0: noise-based percussion ───

  _kick(t, vol) {
    if (!this._layers) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.55 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(g).connect(this._layers.perc);
    osc.start(t);
    osc.stop(t + 0.3);
  }
  _snare(t, vol) {
    if (!this._layers) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._layers.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(bp).connect(g).connect(this._layers.perc);
    src.start(t);
    src.stop(t + 0.16);
  }
  _hat(t, vol, open) {
    if (!this._layers) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._layers.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const g = ctx.createGain();
    const dur = open ? 0.12 : 0.035;
    g.gain.setValueAtTime((open ? 0.16 : 0.11) * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(hp).connect(g).connect(this._layers.perc);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ─── v4.4.0: open-space shimmer + mode transition accents ───

  _shimmerPing(freq, t, dur) {
    this._note(freq, t, dur, 'sine', 0.035, this._layers.fx, true);
  }
  _shimmerGlide(f0, f1, t, dur) {
    if (!this._layers) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.linearRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.03, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this._layers.fx);
    g.connect(this._layers.delay);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
  /** Intensity UP: noise riser + rising sub (played on mode change). */
  _riser(t) {
    if (!this._layers) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._layers.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(3600, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.85);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.95);
    src.connect(bp).connect(g).connect(this._musicGain);
    src.start(t);
    src.stop(t + 1);
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(55, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.9);
    og.gain.setValueAtTime(0.05, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    osc.connect(og).connect(this._musicGain);
    osc.start(t);
    osc.stop(t + 1);
  }
  /** Intensity DOWN: sub drop (played on mode change). */
  _subDrop(t) {
    if (!this._layers) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(98, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 1.1);
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    osc.connect(g).connect(this._musicGain);
    osc.start(t);
    osc.stop(t + 1.25);
  }
}
export const audio = new AudioSystem();

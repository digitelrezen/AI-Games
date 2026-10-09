// Filename: core/audio/MusicScheduler.js
// Kitty Vs Everything — v4.8.0
// v4.8.0: AUDIO MODULARIZATION — the multi-track playlist scheduler,
//          extracted from the AudioSystem.js monolith. SINGLE SOURCE OF
//          TRUTH for mission music:
//            • ONE lookahead timer (this._timer) — the 16th-note scheduler
//              loop; cleared on every stop() and never re-armed while the
//              session is inactive.
//            • ONE session graph (this._master + this._layers) — built by
//              start(), disconnected by stop(); start() ALWAYS hard-kills
//              any previous session first, so a previous track's timer,
//              gain nodes and oscillator sources can never bleed into the
//              new session (the v4.6.0 overlap bug class is dead).
//            • every source node is registered in this._live (auto-removed
//              on onended) and the teardown force-stops + disconnects
//              whatever is still live — no dangling oscillators, no leaked
//              nodes, clean GC.
//          Rotation behavior is unchanged from v4.6.0: per-mode playlist
//          (PLAYLISTS) of 32-bar songs (SONGS), 1-bar overlap crossfade at
//          song boundaries, mode changes (setMode) apply at the next bar
//          boundary with a riser / sub-drop accent.
export const VERSION = 'v4.8.0';
import { MUSIC_MODES, SONGS, PLAYLISTS, hz, mulberry32 } from './MusicPlaylists.js';

const LOOKAHEAD = 0.6;    // schedule 16ths up to 0.6 s ahead of now
const TICK = 100;         // lookahead re-arm interval (ms)
const FADE = 0.12;        // stop() master fade time constant (s)
const TEARDOWN_MS = 500;  // tracked disconnect delay after the fade (ms)

export class MusicScheduler {
  constructor(core) {
    this.core = core;
    // ─── session state ───
    this.playing = false;
    this._mode = 'open';         // active mode (applied at bar boundaries)
    this._pendingMode = 'open';  // requested mode (setMode)
    this._musicNext = 0;         // next 16th-note start time (ctx seconds)
    // ─── playlist rotation state ───
    this._song = null;        // active song id (SONGS)
    this._songStep = 0;       // 16th-note step within the active song
    this._incoming = null;    // song id crossfading in (1-bar overlap)
    this._incomingStep = 0;   // 16th-note step within the incoming song
    this._plIdx = {};         // per-mode playlist rotation index
    this._lastLead = {};      // per-song last lead freq (portamento)
    // ─── the ONLY timers in this class (both tracked, both cleared) ───
    this._timer = null;         // lookahead loop (setTimeout chain)
    this._teardownTimer = null; // fade→disconnect of the old session graph
    // ─── the ONLY session graph (single active stream) ───
    this._master = null;       // session master gain (→ core.musicBus)
    this._layers = null;       // { pad, arp, bass, perc, fx, delay, wet, fb, dlp, noise }
    this._live = new Set();    // live source nodes (auto-removed on onended)
  }

  // ═══════════════════════════════════════════════════════════
  //  Public API (the AudioSystem.js facade delegates here)
  // ═══════════════════════════════════════════════════════════

  /** v4.4.0+: the requested soundtrack mode (MusicDirector reads this). */
  getMode() { return this._pendingMode; }
  /** v4.6.0: the song currently in rotation (debug / dev panel). */
  getSong() { return this._song ? SONGS[this._song].title : null; }

  /**
   * v4.4.0+: request a soundtrack mode ('open' | 'combat' | 'boneyard' |
   * 'boss'). Takes effect at the next bar boundary (1-bar crossfade into
   * the new mode's playlist) and plays a riser (intensity up) or sub-drop
   * (intensity down) transition accent. Safe to call every frame — a no-op
   * when the mode is unchanged or music is not playing.
   */
  setMode(mode) {
    if (!MUSIC_MODES[mode]) return;
    if (mode === this._pendingMode) return;
    const from = this._pendingMode;
    this._pendingMode = mode;
    if (this.playing && this.core.ctx) {
      const t0 = this.core.ctx.currentTime + 0.02;
      if (MUSIC_MODES[mode].intensity > MUSIC_MODES[from].intensity) this._riser(t0);
      else this._subDrop(t0);
    }
  }

  /**
   * v4.8.0: start the mission soundtrack. SINGLE ACTIVE STREAM — any
   * existing session (lookahead timer + session graph + live sources) is
   * hard-killed before the new one is built, so a restart can never stack
   * a second scheduler on top of the old track (the v4.6.0 bleed).
   * Headless-safe: sets playing=true (the PauseMenu lifecycle reads it)
   * but builds no graph when there is no AudioContext.
   */
  start() {
    if (this.playing) this.stop({ hard: true }); // singleton: one session only
    this.playing = true;
    const ctx = this.core.ensure();
    if (!ctx || !this.core.musicBus) return;
    this._buildGraph();
    // v4.6.0: start the rotation straight in the requested mode's queue.
    this._mode = this._pendingMode;
    this._plIdx = {};
    this._lastLead = {};
    this._song = this._pickSong(this._mode, null);
    this._songStep = 0;
    this._incoming = null;
    this._incomingStep = 0;
    this._master.gain.setValueAtTime(1, ctx.currentTime);
    this._musicNext = ctx.currentTime + 0.15;
    this._scheduleMusic();
  }

  /**
   * v4.8.0: stop the mission soundtrack.
   *   stop()          — graceful: fade the session master, then disconnect
   *                     the whole graph (tracked timer, cleared on any
   *                     restart so it can never touch a new session).
   *   stop({hard})    — immediate teardown (used by start() so the old
   *                     track's nodes can never bleed into the new one).
   * ALWAYS clears the lookahead timer + pending teardown timer + rotation
   * state, and force-stops every still-live source node.
   */
  stop(opts = {}) {
    const hard = !!opts.hard;
    this.playing = false;
    // 1) kill the lookahead timer (the only scheduler timer).
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    // 2) cancel a pending teardown (it must never disconnect a graph that
    //    start() is about to replace — or the new one it just built).
    if (this._teardownTimer) { clearTimeout(this._teardownTimer); this._teardownTimer = null; }
    // 3) tear down the session graph.
    if (this._master) {
      const master = this._master;
      const layers = this._layers;
      this._master = null;
      this._layers = null;
      if (!hard && this.core.ctx) {
        // Graceful: already-scheduled notes are all self-terminating
        // (osc.stop(t+dur)); the master fade carries them out, and the
        // tracked teardown timer disconnects the graph once it's silent.
        master.gain.setTargetAtTime(0.0001, this.core.ctx.currentTime, FADE);
        this._teardownTimer = setTimeout(() => {
          this._teardownTimer = null;
          this._killLive();
          this._disconnectGraph(master, layers);
        }, TEARDOWN_MS);
      } else {
        // Hard cut (restart path): silence + release everything NOW.
        this._killLive();
        this._disconnectGraph(master, layers);
      }
    } else {
      // No graph, but a stray live source may still remain — GC guard.
      this._killLive();
    }
    // 4) drop the rotation state (a fresh start() re-rolls it).
    this._song = null;
    this._incoming = null;
    this._songStep = 0;
    this._incomingStep = 0;
    this._lastLead = {};
  }

  // ─── v4.8.0: session graph management ───

  /** Build the session graph: master → core.musicBus + 5 layer buses. */
  _buildGraph() {
    const ctx = this.core.ctx;
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(this.core.musicBus);
    // Per-layer sub-gains (the scheduler writes into these; the session
    // master + the AudioCore music bus carry the Settings music volume).
    const layers = {};
    for (const name of ['pad', 'arp', 'bass', 'perc', 'fx']) {
      const g = ctx.createGain();
      g.gain.value = 1;
      g.connect(master);
      layers[name] = g;
    }
    // Space delay (dotted-8th feedback) — the arp/lead + shimmer send that
    // gives the open-space sweep its depth.
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.375;
    const fb = ctx.createGain(); fb.gain.value = 0.3;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    delay.connect(dlp); dlp.connect(fb); fb.connect(delay);
    delay.connect(wet); wet.connect(master);
    // Shared white-noise buffer (percussion voices + tension sweeps).
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this._master = master;
    this._layers = { pad: layers.pad, arp: layers.arp, bass: layers.bass, perc: layers.perc, fx: layers.fx, delay, wet, fb, dlp, noise };
  }

  /** Disconnect the whole session graph (master + layers + delay chain). */
  _disconnectGraph(master, layers) {
    const kill = (n) => { try { n.disconnect(); } catch (e) { /* noop */ } };
    kill(master);
    if (layers) {
      for (const k of ['pad', 'arp', 'bass', 'perc', 'fx']) kill(layers[k]);
      kill(layers.delay); kill(layers.wet); kill(layers.fb); kill(layers.dlp);
    }
  }

  /** Force-stop + disconnect every still-live source node (GC guard). */
  _killLive() {
    for (const src of this._live) {
      try { src.stop(); } catch (e) { /* already stopped */ }
      try { src.disconnect(); } catch (e) { /* noop */ }
    }
    this._live.clear();
  }

  /** Register a source node (auto-removed when it finishes — clean GC). */
  _track(src) {
    this._live.add(src);
    src.onended = () => this._live.delete(src);
  }

  // ─── v4.6.0: playlist rotation + scheduler internals ───

  /**
   * v4.6.0: next track in a mode's playlist — round-robin rotation with no
   * immediate repeat of the outgoing track (the album order is fixed; the
   * rotation just walks the queue).
   */
  _pickSong(mode, excludeId) {
    const list = PLAYLISTS[mode];
    if (!list || !list.length) return null;
    const i = this._plIdx[mode] || 0;
    for (let k = 0; k < list.length; k++) {
      const cand = list[(i + k) % list.length];
      if (cand !== excludeId) {
        this._plIdx[mode] = (i + k + 1) % list.length;
        return cand;
      }
    }
    this._plIdx[mode] = (i + 1) % list.length;
    return list[i % list.length];
  }

  /** Look-ahead loop: schedule every 16th up to LOOKAHEAD s ahead of now. */
  _scheduleMusic() {
    if (!this.playing || !this.core.ctx) return; // inactive → never re-arm
    const ctx = this.core.ctx;
    while (this._musicNext < ctx.currentTime + LOOKAHEAD) {
      const song = SONGS[this._song];
      const step = 60 / song.bpm / 4;
      const total = song.bars * 16;
      // Bar boundary: mode changes + song-end rotations apply here.
      if (this._songStep % 16 === 0 && !this._incoming) {
        const finalBar = this._songStep === total - 16;
        if (this._pendingMode !== this._mode || finalBar) {
          if (this._pendingMode !== this._mode) this._mode = this._pendingMode;
          this._incoming = this._pickSong(this._mode, this._song);
          this._incomingStep = 0;
        }
      }
      if (this._incoming) {
        // 1-bar overlap crossfade: the outgoing song's current bar fades
        // out while the incoming song's bar 0 fades in on the same grid.
        const pos = this._songStep % 16;
        const fade = (pos + 1) / 16;
        this._scheduleSongStep(this._song, this._songStep, this._musicNext, step, 1 - fade);
        this._scheduleSongStep(this._incoming, this._incomingStep, this._musicNext, step, fade);
        this._incomingStep++;
        if (pos === 15) {
          this._song = this._incoming;
          this._songStep = 16; // the incoming song continues from bar 1
          this._incoming = null;
        } else {
          this._songStep++;
        }
      } else {
        this._scheduleSongStep(this._song, this._songStep, this._musicNext, step, 1);
        this._songStep++;
      }
      this._musicNext += step;
    }
    this._timer = setTimeout(() => this._scheduleMusic(), TICK);
  }

  /** One 16th note of one song (volScale = crossfade gain, 0..1). */
  _scheduleSongStep(songId, songStep, t, step, volScale) {
    if (!this._layers || volScale <= 0.005) return;
    const song = SONGS[songId];
    const sib = songStep % 16;
    const bar = Math.floor(songStep / 16);
    const loopBar = bar % song.chords.length;
    const chord = song.chords[loopBar];
    const barLen = step * 16;
    // Per-phrase seeded variation (deterministic per phrase + song).
    const phrase = Math.floor(songStep / 128);
    const rng = mulberry32((phrase * 0x9E3779B9) ^ (song.seed * 0x85EBCA6B) ^ 0x1234);
    const arpIdx = Math.floor(rng() * (song.arps ? song.arps.length : 1));
    const padSweep = 0.8 + rng() * 0.9;    // pad cutoff multiplier
    const arpLift = rng() < 0.3 ? 12 : 0;  // occasional octave lift
    const fill = loopBar === song.chords.length - 1;

    // ─── PAD (once per bar): detuned saws through a sweeping lowpass ───
    if (sib === 0) this._schedulePad(chord, t, barLen, song, padSweep, volScale);

    // ─── LEAD: explicit crossover motif OR per-phrase seeded arps ───
    if (song.lead) {
      const loopStep = songStep % song.lead.loop;
      for (const [ns, midi, len] of song.lead.motif) {
        if (ns === loopStep) this._leadNote(song, midi, t, step * len, volScale);
      }
    } else if (song.arps) {
      const pattern = song.arps[arpIdx];
      const deg = pattern[sib];
      if (deg >= 0) {
        const f = hz(chord[deg] + 12 + arpLift);
        this._note(f, t, step * 1.8, 'triangle', song.vols.arp * volScale, this._layers.arp, true);
        // Boss tracks double the arps an octave on the downbeats.
        if (song.octaveDouble && sib % 4 === 0) {
          this._note(f * 2, t, step * 1.4, 'triangle', song.vols.arp * 0.5 * volScale, this._layers.arp, true);
        }
      }
    }

    // ─── BASS (per-song line structure) ───
    this._scheduleBass(song, chord, sib, t, step, barLen, volScale);

    // ─── PERCUSSION (noise-based; none in open space) ───
    if (song.perc) {
      const p = song.perc;
      const V = song.vols.perc * volScale;
      if (p.kick.includes(sib)) this._kick(t, V);
      if (p.snare.includes(sib)) this._snare(t, V);
      if (p.ghostSnare && p.ghostSnare.includes(sib)) this._snare(t, V * 0.35);
      const hatOn = p.hat.includes(sib) || (fill && p.hat.length);
      if (hatOn) this._hat(t, V, fill && sib >= 12);
      // Phrase fills (last bar of the 8-bar loop): a snare hit for the
      // 4-on-the-floor tracks, a double kick for the sparse ones.
      if (fill && p.kick.length === 4 && sib === 14) this._snare(t, V);
      if (fill && p.kick.length < 4 && (sib === 14 || sib === 15)) this._kick(t, V);
    }

    // ─── SHIMMER (open space only): long pings + a slow 2-bar glide ───
    if (song.shimmer) {
      if (songStep % 128 === 0) this._shimmerPing(hz(chord[2] + 24), t, 2.5);
      if (songStep % 128 === 64) this._shimmerGlide(hz(chord[1] + 12), hz(chord[1] + 16), t, barLen * 2);
    }

    // ─── TENSION SWEEPS (industrial builds) ───
    if (song.sweeps && song.sweeps.includes(loopBar) && sib === 0) {
      this._tensionSweep(t, barLen * 2, volScale);
    }
  }

  /**
   * v4.6.0: crossover lead voice — two detuned oscillators (saw for the
   * Für Elise cyber-remix, square for the Johnny industrial march),
   * optional portamento glide from the previous note, lowpass + delay.
   */
  _leadNote(song, midi, t, dur, volScale) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
    const cfg = song.lead;
    const freq = hz(midi);
    const vol = cfg.vol * volScale;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.015);
    g.gain.setValueAtTime(Math.max(0.0002, vol * 0.8), t + Math.max(0.02, dur * 0.55));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cfg.lp || 4000;
    lp.Q.value = 0.7;
    g.connect(lp);
    lp.connect(this._layers.arp); // the lead rides the arp/lead bus
    lp.connect(this._layers.delay);
    const prev = this._lastLead[song.id];
    const glide = cfg.glide && prev && Math.abs(freq - prev) / prev < 1.2 ? 0.05 : 0;
    const dets = cfg.detune ? [-cfg.detune, cfg.detune] : [0];
    for (const det of dets) {
      const osc = ctx.createOscillator();
      osc.type = cfg.wave;
      osc.detune.value = det;
      if (glide) {
        osc.frequency.setValueAtTime(prev, t);
        osc.frequency.exponentialRampToValueAtTime(freq, t + glide);
      } else {
        osc.frequency.value = freq;
      }
      osc.connect(g);
      osc.start(t);
      osc.stop(t + dur + 0.05);
      this._track(osc);
    }
    this._lastLead[song.id] = freq;
  }

  /** v4.6.0: per-song bassline (whole/half/eighth/sixteenth/techno/march). */
  _scheduleBass(song, chord, sib, t, step, barLen, volScale) {
    const style = song.bass;
    const root = Math.max(36, chord[0] - 12);
    const V = song.vols.bass * volScale;
    if (style === 'whole' && sib === 0) {
      this._note(hz(root), t, barLen * 0.98, 'sine', V, this._layers.bass, false);
    } else if (style === 'half' && (sib === 0 || sib === 8)) {
      this._note(hz(root), t, step * 7.5, 'sine', V, this._layers.bass, false);
    } else if (style === 'eighth' && sib % 2 === 0) {
      this._note(hz(root), t, step * 0.9, 'triangle', V, this._layers.bass, false);
    } else if (style === 'sixteenth') {
      this._note(hz(root + (sib % 2 === 1 ? 12 : 0)), t, step * 0.85, 'sawtooth', V * 0.8, this._layers.bass, false, 600);
    } else if (style === 'techno') {
      // 16th-note sub, sidechain-pumped: the kick steps (0/4/8/12) get a
      // short quiet note, the offbeat 16ths ring out an octave up — the
      // classic techno pump.
      const onKick = sib % 4 === 0;
      const sub = Math.max(36, chord[0] - 12);
      const f = hz(sub + ((sib % 8) === 2 || (sib % 8) === 6 ? 12 : 0));
      this._note(f, t, onKick ? step * 0.8 : step * 1.1, 'sine', onKick ? V * 0.35 : V, this._layers.bass, false);
    } else if (style === 'march') {
      // Distorted 8th-note pulses (saw through a tight lowpass); the last
      // 8th of the bar approaches the root from a semitone below.
      if (sib % 2 === 0) {
        const f = sib === 14 ? hz(root - 1) : hz(root);
        this._note(f, t, step * 0.85, 'sawtooth', V, this._layers.bass, false, 380);
      }
    }
  }

  /** One short synthesized voice into a music layer (optional delay send). */
  _note(freq, t, dur, type, vol, layer, sendDelay, lpFreq = 0) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
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
    this._track(osc);
  }

  /** Evolving space pad: 2 detuned saws per chord tone, sweeping lowpass. */
  _schedulePad(chord, t, barLen, song, sweep, volScale = 1) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 0.8;
    const c0 = song.padCutoff * sweep;
    filt.frequency.setValueAtTime(c0, t);
    filt.frequency.linearRampToValueAtTime(c0 * 1.5, t + barLen * 0.55);
    filt.frequency.linearRampToValueAtTime(c0 * 0.8, t + barLen);
    const g = ctx.createGain();
    const peak = song.vols.pad * volScale;
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
        this._track(osc);
      }
    }
  }

  // ─── v4.4.0: noise-based percussion ───

  _kick(t, vol) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
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
    this._track(osc);
  }
  _snare(t, vol) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
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
    this._track(src);
  }
  _hat(t, vol, open) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
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
    this._track(src);
  }

  // ─── v4.4.0: open-space shimmer + mode transition accents ───

  _shimmerPing(freq, t, dur) {
    this._note(freq, t, dur, 'sine', 0.035, this._layers.fx, true);
  }
  _shimmerGlide(f0, f1, t, dur) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
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
    this._track(osc);
  }
  /** v4.6.0: high-tension atmospheric sweep (bandpass noise riser). */
  _tensionSweep(t, dur, volScale = 1) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._layers.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(250, t);
    bp.frequency.exponentialRampToValueAtTime(4200, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.11 * volScale, t + dur * 0.85);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(this._layers.fx);
    g.connect(this._layers.delay);
    src.start(t);
    src.stop(t + dur + 0.05);
    this._track(src);
  }
  /** Intensity UP: noise riser + rising sub (played on mode change). */
  _riser(t) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
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
    src.connect(bp).connect(g).connect(this._master);
    src.start(t);
    src.stop(t + 1);
    this._track(src);
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(55, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.9);
    og.gain.setValueAtTime(0.05, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    osc.connect(og).connect(this._master);
    osc.start(t);
    osc.stop(t + 1);
    this._track(osc);
  }
  /** Intensity DOWN: sub drop (played on mode change). */
  _subDrop(t) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(98, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 1.1);
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    osc.connect(g).connect(this._master);
    osc.start(t);
    osc.stop(t + 1.25);
    this._track(osc);
  }
}

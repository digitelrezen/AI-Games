// Filename: core/audio/MusicScheduler.js
// Kitty Vs Everything — v4.21.0
// v4.21.0: AUDIO MIX PASS 2 + SONGS PLAY OUT — (1) mode changes no longer
//          cut the current song: setMode() only records the pending mode;
//          the bar-boundary handler applies it at the song's END (finalBar)
//          with the riser/sub-drop accent on the handoff, so the open↔
//          combat flips between waves let each song play out fully instead
//          of swapping tracks every bar; (2) per-song arp voice profile —
//          _pluckNote() honors an optional song.arp config (wave/detunes/
//          lp/q/adsr) so Tool — Pneuma's 2514-note sustained power-chord
//          rhythm (the arp slot) plays as a sustained saw guitar instead
//          of a dead triangle pluck; (3) TRACK_MIX_SETTINGS re-tuned ~2x
//          against the Forty Six & 2 reference (the user's "most tracks
//          need 2x" report): Axel F L4.0/A2.5/P2.5 (the hook rides
//          arp+pad at base vol 0.05/0.06 — it was inaudible), Unforgiven
//          A2.5/P1.5 (the rhythm guitar + "synth" harmony were buried at
//          0.8x/0.25x), Pneuma L2.0/B1.5/D1.0/A2.2 (the full band back),
//          Johnny March L3.0/D0.2 (melody over the march snare), plus ~2x
//          leads on every other quiet track.
// v4.20.0: AUDIO MIX TUNING — the per-track mix table (TRACK_MIX_SETTINGS)
//          grows from 3 scalars to 5: gainLead / gainBass / gainDrums +
//          NEW gainArp / gainPad. The event path multiplies gainArp into
//          the arp pluck gains and gainPad into the event-pad gains, so
//          the layers the v4.19.0 table couldn't reach (Pneuma's guitar
//          rhythm rides the arp slot; The Unforgiven's "synth" rides the
//          pad slot) can be balanced per song.
// v4.16.0: MIDI EVENT PLAYBACK — the v4.16.0 album is the exact note
//          sequences parsed from the local .mid files (tools/midi-import.mjs).
//          The scheduler grid moves from 16ths to 32nds (the MIDI event
//          resolution) and _scheduleSongStep gains an event path: every
//          song with an events map (lead/bass/arp/pad/drums, [t, note,
//          dur32, vel] on the 32nd grid) plays its parsed notes through
//          the SynthVoice.js voices (_leadNote / _eventBass / _pluckNote /
//          _eventPad / _kick / _snare / _hat, kick-pumped sidechain). The
//          procedural arrangement path is legacy (no procedural tracks
//          remain in the album).
// v4.11.0: JUKEBOX PREVIEW — the Admin Panel (js/ui/DevPanel.js) music
//          previewer can audition ANY track from the SONGS album in
//          isolation: previewSong(id) hard-kills any current session (game
//          music or another preview), builds a fresh session graph and LOOPS
//          the chosen track (the 32-bar song wraps at its end instead of
//          rotating to the next playlist track); stopPreview() fades out;
//          getPreview() reports the playing preview id (null = none). The
//          real game start()/stop() clear the preview state, so gameplay
//          music always takes over cleanly. This reuses the EXISTING
//          session graph + lookahead timer — no separate playback path.
// v4.9.0: POLYPHONIC SYNTH OVERHAUL — the scheduler keeps the v4.8.0
//          single-source-of-truth architecture (ONE lookahead timer, ONE
//          session graph, start() ALWAYS hard-kills any previous session,
//          tracked teardown timer, live-source GC) but the session graph
//          is now a professional effects chain and every voice is built by
//          the SynthVoice.js polyphonic engine:
//            • session graph: layer buses (pad/arp/lead/bass/perc/fx) →
//              session master → core.musicBus, with a soft-clip WaveShaper
//              on the bass bus (grit), a SIDECHAIN gain on the bass bus
//              (the classic 4-on-the-floor pump, scheduled per kick), a
//              DynamicsCompressor on the perc bus (punch), a feedback
//              delay (dotted-8th, lowpass-filtered) and a convolver
//              REVERB (procedural stereo impulse — no external .wav) as
//              sends.
//            • pads: makeChord() — one 3-osc detuned voice per chord tone
//              (+ a softer +12 octave layer), slow ADSR, resonant lowpass
//              sweep, spread stereo image, reverb send.
//            • leads (Für Elise / Johnny March): 3-osc detuned voice +
//              sine sub, ADSR, filter, delay + reverb sends, portamento
//              glide — plus a HARMONY counter-voice (octave double / march
//              third below) so the melody is never a thin single-note beep.
//            • bass: saw + sub through a tight lowpass, sidechain-pumped.
//            • arps: short detuned plucks with delay sends.
//            • stabs (combat/boss): short detuned chord hits on the
//              downbeats.
//            • percussion: transient-sharp kick (sine pitch-drop + click),
//              snare (bandpass noise + triangle body), hat (highpass
//              noise) through the punch compressor.
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
//          Rotation behavior: per-mode playlist (PLAYLISTS) of
//          full-length songs (SONGS), 1-bar overlap crossfade at song
//          boundaries; v4.21.0: mode changes (setMode) apply at the
//          current song's END (songs play out — no mid-song cuts) with a
//          riser / sub-drop accent on the handoff.
export const VERSION = 'v4.21.0';
import { MUSIC_MODES, SONGS, PLAYLISTS, TRACK_MIX_SETTINGS, hz, mulberry32 } from './MusicPlaylists.js';
import {
  makeNoiseBuffer, makeImpulse, softClipCurve,
  makeVoice, makeChord,
  kick as synthKick, snare as synthSnare, hat as synthHat,
} from './SynthVoice.js';

const LOOKAHEAD = 0.6;    // schedule 16ths up to 0.6 s ahead of now
const TICK = 100;         // lookahead re-arm interval (ms)
const FADE = 0.12;        // stop() master fade time constant (s)
const TEARDOWN_MS = 500;  // tracked disconnect delay after the fade (ms)

export class MusicScheduler {
  constructor(core) {
    this.core = core;
    // ─── session state ───
    this.playing = false;
    this._mode = 'open';         // active mode (applied at song ends — v4.21.0)
    this._pendingMode = 'open';  // requested mode (setMode)
    this._preview = null;        // v4.11.0: jukebox preview track id (null = none)
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
    this._layers = null;       // { pad, arp, lead, bass, perc, fx, side,
                               //   bassShaper, percComp, reverb, revWet,
                               //   delay, delayWet, fb, dlp, noise }
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
   * 'boss'). v4.21.0: the pending mode only takes effect when the CURRENT
   * SONG ENDS — the bar-boundary handler applies it at finalBar (with the
   * riser / sub-drop accent on the handoff), so rapid mode flips
   * (open↔combat between waves) let the song play out fully instead of
   * cutting it after one bar. Safe to call every frame — a no-op when the
   * mode is unchanged or music is not playing.
   */
  setMode(mode) {
    if (!MUSIC_MODES[mode]) return;
    if (mode === this._pendingMode) return;
    this._pendingMode = mode;
    // v4.21.0: no transition accent here — it plays at the song-end
    // handoff in _scheduleMusic(), so a mode flip that reverses before
    // the song ends never fires an accent (no more stacked risers).
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
    // v4.11.0: gameplay music always takes over from a jukebox preview.
    this._preview = null;
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
    // v4.11.0: dropping the session also drops any jukebox preview state.
    this._preview = null;
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

  /**
   * v4.11.0: JUKEBOX PREVIEW — play ONE track from the SONGS album (the
   * Admin Panel music previewer). Hard-kills any current session (game
   * music or another preview), builds a fresh session graph, and LOOPS the
   * chosen track (the bar-boundary wrap in _scheduleMusic). Returns true
   * when the preview was armed. Headless-safe: state is armed (playing +
   * _preview) but no graph is built when there is no AudioContext, exactly
   * like start(). Reuses the EXISTING session graph + lookahead timer —
   * no separate playback path.
   */
  previewSong(id) {
    if (!SONGS[id]) return false;
    if (this.playing) this.stop({ hard: true }); // singleton: one session only
    this.playing = true;
    this._preview = id;
    const ctx = this.core.ensure();
    if (!ctx || !this.core.musicBus) return false;
    this._buildGraph();
    // v4.11.0: preview plays the chosen track in isolation — no mode
    // rotation, no playlist queue (the wrap in _scheduleMusic loops it).
    this._mode = this._pendingMode;
    this._plIdx = {};
    this._lastLead = {};
    this._song = id;
    this._songStep = 0;
    this._incoming = null;
    this._incomingStep = 0;
    this._master.gain.setValueAtTime(1, ctx.currentTime);
    this._musicNext = ctx.currentTime + 0.15;
    this._scheduleMusic();
    return true;
  }

  /** v4.11.0: stop the jukebox preview (graceful fade-out). */
  stopPreview() {
    this._preview = null;
    this.stop();
  }

  /** v4.11.0: the track id currently previewing (null = no preview). */
  getPreview() { return this._preview; }

  // ─── v4.9.0: session graph management ───

  /**
   * Build the session graph — the v4.9.0 professional effects chain:
   *   pad/arp/lead/fx ────────────────────────┐
   *   bass → soft-clip shaper → sidechain gain ─┤
   *   perc → punch compressor ─────────────────┼→ master → core.musicBus
   *   (sends) delay + reverb ──────────────────┘
   * The delay and reverb are SEND destinations (voices connect their
   * envelope gain to them); the sidechain gain is pumped per kick.
   */
  _buildGraph() {
    const ctx = this.core.ctx;
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(this.core.musicBus);
    // Per-layer sub-gains (the scheduler writes into these; the session
    // master + the AudioCore music bus carry the Settings music volume).
    const layers = {};
    for (const name of ['pad', 'arp', 'lead', 'bass', 'perc', 'fx']) {
      const g = ctx.createGain();
      g.gain.value = 1;
      layers[name] = g;
    }
    layers.pad.connect(master);
    layers.arp.connect(master);
    layers.lead.connect(master);
    layers.fx.connect(master);
    // Bass bus: soft-clip saturation (grit) → sidechain gain → master.
    const bassShaper = ctx.createWaveShaper();
    bassShaper.curve = softClipCurve(2.2);
    bassShaper.oversample = '2x';
    const side = ctx.createGain();
    side.gain.value = 1;
    layers.bass.connect(bassShaper);
    bassShaper.connect(side);
    side.connect(master);
    // Perc bus: a fast compressor keeps the drums punchy (transient
    // preservation + glue) instead of clipping the master.
    const percComp = ctx.createDynamicsCompressor();
    percComp.threshold.value = -14;
    percComp.knee.value = 8;
    percComp.ratio.value = 3;
    percComp.attack.value = 0.004;
    percComp.release.value = 0.12;
    layers.perc.connect(percComp);
    percComp.connect(master);
    // Reverb: convolver with a PROCEDURAL stereo impulse (no external
    // .wav — the single-file build stays dependency-free).
    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 2.6, 3.0);
    const revWet = ctx.createGain();
    revWet.gain.value = 0.35;
    reverb.connect(revWet);
    revWet.connect(master);
    // Delay: dotted-8th feedback through a lowpass (the arp/lead + shimmer
    // send that gives the mix its depth).
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.375;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 2600;
    delay.connect(dlp);
    dlp.connect(fb);
    fb.connect(delay);
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0.24;
    delay.connect(delayWet);
    delayWet.connect(master);
    // Shared white-noise buffer (percussion voices + tension sweeps).
    const noise = makeNoiseBuffer(ctx, 1.2);
    this._master = master;
    this._layers = {
      pad: layers.pad, arp: layers.arp, lead: layers.lead,
      bass: layers.bass, perc: layers.perc, fx: layers.fx,
      side, bassShaper, percComp, reverb, revWet, delay, delayWet, fb, dlp, noise,
    };
  }

  /** Disconnect the whole session graph (master + layers + effects). */
  _disconnectGraph(master, layers) {
    const kill = (n) => { try { n.disconnect(); } catch (e) { /* noop */ } };
    kill(master);
    if (layers) {
      for (const k of ['pad', 'arp', 'lead', 'bass', 'perc', 'fx']) kill(layers[k]);
      kill(layers.side); kill(layers.bassShaper); kill(layers.percComp);
      kill(layers.reverb); kill(layers.revWet);
      kill(layers.delay); kill(layers.delayWet); kill(layers.fb); kill(layers.dlp);
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

  /** Look-ahead loop: schedule every 32nd up to LOOKAHEAD s ahead of now. */
  _scheduleMusic() {
    if (!this.playing || !this.core.ctx) return; // inactive → never re-arm
    const ctx = this.core.ctx;
    while (this._musicNext < ctx.currentTime + LOOKAHEAD) {
      const song = SONGS[this._song];
      // v4.16.0: 32nd-note grid — the MIDI event resolution of the parsed
      // album (the legacy 16th grid of the procedural tracks is gone).
      const step = 60 / song.bpm / 8;
      const total = song.bars * 32;
      // Bar boundary: mode changes + song-end rotations apply here.
      // v4.11.0: JUKEBOX PREVIEW — while a track is previewing, the song
      // WRAPS at its end (loops the same track) instead of rotating the
      // playlist or changing mode.
      if (this._songStep % 32 === 0 && !this._incoming) {
        const finalBar = this._songStep === total - 32;
        if (this._preview) {
          if (this._songStep >= total) this._songStep = 0;
        } else if (finalBar) {
          // v4.21.0: SONGS PLAY OUT — a pending mode change no longer
          // cuts the current song at the next bar boundary (the
          // open↔combat flips between waves swapped tracks constantly);
          // it applies HERE, at the song's end, with the transition
          // accent (riser up / sub-drop down) playing on the handoff.
          if (this._pendingMode !== this._mode) {
            const from = this._mode;
            this._mode = this._pendingMode;
            if (this.core.ctx) {
              if (MUSIC_MODES[this._mode].intensity > MUSIC_MODES[from].intensity) this._riser(this._musicNext);
              else this._subDrop(this._musicNext);
            }
          }
          this._incoming = this._pickSong(this._mode, this._song);
          this._incomingStep = 0;
        }
      }
      if (this._incoming) {
        // 1-bar overlap crossfade: the outgoing song's current bar fades
        // out while the incoming song's bar 0 fades in on the same grid.
        const pos = this._songStep % 32;
        const fade = (pos + 1) / 32;
        this._scheduleSongStep(this._song, this._songStep, this._musicNext, step, 1 - fade);
        this._scheduleSongStep(this._incoming, this._incomingStep, this._musicNext, step, fade);
        this._incomingStep++;
        if (pos === 31) {
          this._song = this._incoming;
          this._songStep = 32; // the incoming song continues from bar 1
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

  /** One 32nd note of one song (volScale = crossfade gain, 0..1). */
  _scheduleSongStep(songId, songStep, t, step, volScale) {
    if (!this._layers || volScale <= 0.005) return;
    const song = SONGS[songId];
    // v4.16.0: MIDI EVENT PLAYBACK — the entire v4.16.0 album is parsed
    // note sequences (tools/midi-import.mjs): every song carries an
    // events map (lead/bass/arp/pad/drums on the 32nd grid) and plays
    // back through the SynthVoice.js voices. The procedural arrangement
    // path below is legacy — no procedural tracks remain in the album.
    if (song.events) {
      this._scheduleEventStep(song, songStep, t, step, volScale);
      return;
    }
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

    // ─── PAD (once per bar): polyphonic chord — 3-osc detuned voices per
    //     chord tone + a softer octave layer, slow ADSR, resonant lowpass
    //     sweep, spread stereo image, reverb send ───
    if (sib === 0) this._schedulePad(chord, t, barLen, song, padSweep, volScale);

    // ─── LEAD: explicit crossover motif + harmony counter-voice (v4.9.0:
    //     chords + melody at the same time, never a thin single note) ───
    if (song.lead) {
      const loopStep = songStep % song.lead.loop;
      for (const [ns, midi, len] of song.lead.motif) {
        if (ns === loopStep) this._leadNote(song, midi, t, step * len, volScale);
      }
      if (song.harmony) {
        const hLoop = songStep % song.harmony.loop;
        for (const [ns, midi, len] of song.harmony.motif) {
          if (ns === hLoop) this._harmonyNote(song, midi, t, step * len, volScale);
        }
      }
    } else if (song.arps) {
      const pattern = song.arps[arpIdx];
      const deg = pattern[sib];
      if (deg >= 0) {
        const f = hz(chord[deg] + 12 + arpLift);
        this._pluckNote(f, t, step * 1.8, song.vols.arp * volScale, deg);
        // Boss tracks double the arps an octave on the downbeats.
        if (song.octaveDouble && sib % 4 === 0) {
          this._pluckNote(f * 2, t, step * 1.4, song.vols.arp * 0.5 * volScale, deg);
        }
      }
    }

    // ─── CHORD STAB (combat/boss, v4.9.0): short detuned chord hits on
    //     the downbeat + the "and" of 3 ───
    if (song.stab && (sib === 0 || sib === 10)) {
      this._scheduleStab(chord, t, step, song, volScale, sib === 0 ? 1 : 0.7);
    }

    // ─── BASS (per-song line structure, sidechain-pumped) ───
    this._scheduleBass(song, chord, sib, t, step, barLen, volScale);

    // ─── PERCUSSION (SynthVoice voices; none in open space) ───
    if (song.perc) {
      const p = song.perc;
      const V = song.vols.perc * volScale;
      const kickHit = p.kick.includes(sib);
      if (kickHit) this._kick(t, V);
      if (p.snare.includes(sib)) this._snare(t, V);
      if (p.ghostSnare && p.ghostSnare.includes(sib)) this._snare(t, V * 0.35);
      const hatOn = p.hat.includes(sib) || (fill && p.hat.length);
      if (hatOn) this._hat(t, V, fill && sib >= 12);
      // Phrase fills (last bar of the 8-bar loop): a snare hit for the
      // 4-on-the-floor tracks, a double kick for the sparse ones.
      if (fill && p.kick.length === 4 && sib === 14) this._snare(t, V);
      if (fill && p.kick.length < 4 && (sib === 14 || sib === 15)) this._kick(t, V);
      // Sidechain: pump the bass bus on every kick of a driving track.
      if (kickHit && (song.bass === 'techno' || song.bass === 'sixteenth')) {
        this._sidechainPump(t, step);
      }
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

  // ─── v4.9.0: polyphonic voice scheduling (SynthVoice.js builders) ───

  /**
   * Lush pad — makeChord(): one 3-osc detuned voice per chord tone plus a
   * softer +12 octave layer, slow ADSR, resonant lowpass sweep, spread
   * stereo image, reverb send.
   */
  _schedulePad(chord, t, barLen, song, sweep, volScale = 1) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
    const c0 = song.padCutoff * sweep;
    const v = makeChord(ctx, this._layers.pad, chord, {
      t,
      toFreq: hz,
      type: 'sawtooth',
      detunes: [-8, 0, 8],
      cutoff: c0,
      q: 1.1,
      sweeps: [
        [barLen * 0.55, c0 * 1.6],
        [barLen, c0 * 0.8],
      ],
      spread: 0.6,
      octave: 0.35,
      adsr: { a: barLen * 0.3, d: barLen * 0.2, s: 0.75, r: barLen * 0.35 },
      vol: song.vols.pad * volScale,
      dur: barLen * 0.9,
      sends: [this._layers.reverb],
    });
    for (const s of v.sources) this._track(s);
  }

  /**
   * Short detuned pluck (the arp voice) with a delay send.
   * v4.21.0: optional song — an explicit song.arp profile (wave /
   * detunes / lp / q / adsr) overrides the triangle pluck, so a sustained
   * rhythm-guitar channel (Tool — Pneuma) can play as a sustained saw
   * voice instead of a dead pluck.
   */
  _pluckNote(freq, t, dur, vol, deg = 1, song = null) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
    const cfg = song && song.arp;
    const v = makeVoice(ctx, this._layers.arp, {
      t, freq,
      type: (cfg && cfg.wave) || 'triangle',
      detunes: (cfg && cfg.detunes) || [-5, 5],
      cutoff: (cfg && cfg.lp) || 3600,
      q: (cfg && cfg.q) || 0.6,
      pan: (deg - 1) * 0.35,
      adsr: (cfg && cfg.adsr) || { a: 0.004, d: 0.18, s: 0, r: 0.1 },
      vol, dur,
      sends: [this._layers.delay],
    });
    for (const s of v.sources) this._track(s);
  }

  /**
   * Chord stab (combat/boss) — a short detuned chord hit an octave up with
   * a fast filter sweep, through the lead bus + reverb.
   */
  _scheduleStab(chord, t, step, song, volScale, level = 1) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
    const v = makeChord(ctx, this._layers.lead, chord, {
      t,
      toFreq: (m) => hz(m + 12),
      type: 'sawtooth',
      detunes: [-7, 0, 7],
      cutoff: 1800,
      q: 1.4,
      sweeps: [[step * 2.5, 700]],
      spread: 0.5,
      adsr: { a: 0.006, d: 0.22, s: 0, r: 0.18 },
      vol: (song.vols.stab || 0.05) * volScale * level,
      dur: step * 2.2,
      sends: [this._layers.reverb],
    });
    for (const s of v.sources) this._track(s);
  }

  /**
   * v4.9.0: crossover lead voice — 3-osc detuned voice + sine sub, ADSR,
   * resonant lowpass, delay + reverb sends, optional portamento glide from
   * the previous note. The melody is thick and warm, never a raw buzz.
   */
  _leadNote(song, midi, t, dur, volScale, vel = 1, mix = 1) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
    const cfg = song.lead;
    const freq = hz(midi);
    const prev = this._lastLead[song.id];
    const glide = cfg.glide && prev && Math.abs(freq - prev) / prev < 1.2 ? 0.05 : 0;
    const v = makeVoice(ctx, this._layers.lead, {
      t, freq,
      type: cfg.wave || 'sawtooth',
      detunes: cfg.detunes || [-9, 0, 9],
      sub: !!cfg.sub,
      subLevel: 0.45,
      cutoff: cfg.lp || 4000,
      q: cfg.q || 0.9,
      pan: cfg.pan || 0,
      adsr: cfg.adsr || { a: 0.012, d: 0.1, s: 0.7, r: 0.14 },
      // v4.19.0: mix = the per-track gainLead (TRACK_MIX_SETTINGS).
      vol: (cfg.vol || 0.08) * volScale * vel * mix,
      dur,
      glide,
      prevFreq: glide ? prev : null,
      sends: [this._layers.delay, this._layers.reverb],
    });
    for (const s of v.sources) this._track(s);
    this._lastLead[song.id] = freq;
  }

  /**
   * v4.9.0: harmony counter-voice — the crossover tracks' second hand
   * (Für Elise: octave double below; Johnny March: the classic march
   * third below). Soft, reverb-soaked, slightly delayed for width.
   */
  _harmonyNote(song, midi, t, dur, volScale) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
    const cfg = song.harmony;
    const v = makeVoice(ctx, this._layers.lead, {
      t: t + 0.012,
      freq: hz(midi),
      type: cfg.wave || 'triangle',
      detunes: cfg.detunes || [-6, 6],
      cutoff: cfg.lp || 2400,
      q: 0.7,
      pan: cfg.pan || 0.3,
      adsr: cfg.adsr || { a: 0.02, d: 0.14, s: 0.55, r: 0.16 },
      vol: (cfg.vol || 0.05) * volScale,
      dur,
      sends: [this._layers.reverb],
    });
    for (const s of v.sources) this._track(s);
  }

  /**
   * v4.9.0: per-song bassline (whole/half/eighth/sixteenth/techno/march).
   * Soft styles (open space) use a warm sine; driving styles layer a
   * detuned saw over a sine sub through a tight lowpass — the bass bus
   * shaper + sidechain pump add the grit and the 4-on-the-floor bounce.
   */
  _scheduleBass(song, chord, sib, t, step, barLen, volScale) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
    const style = song.bass;
    const root = Math.max(36, chord[0] - 12);
    const V = song.vols.bass * volScale;
    if (V <= 0.001) return;
    let freq, dur, vol, cutoff, q, det, sub, soft;
    if (style === 'whole' && sib === 0) {
      freq = hz(root); dur = barLen * 0.98; vol = V; cutoff = 900; q = 0.5; det = [0]; sub = false; soft = true;
    } else if (style === 'half' && (sib === 0 || sib === 8)) {
      freq = hz(root); dur = step * 7.5; vol = V; cutoff = 900; q = 0.5; det = [0]; sub = false; soft = true;
    } else if (style === 'eighth' && sib % 2 === 0) {
      freq = hz(root); dur = step * 0.9; vol = V; cutoff = 700; q = 0.8; det = [-4, 4]; sub = true; soft = false;
    } else if (style === 'sixteenth') {
      // 16th-note pulse, octave up on the offbeats.
      freq = hz(root + (sib % 2 === 1 ? 12 : 0)); dur = step * 0.85; vol = V * 0.8; cutoff = 600; q = 1.0; det = [-5, 5]; sub = true; soft = false;
    } else if (style === 'techno') {
      // 16th-note sub, sidechain-pumped: the kick steps (0/4/8/12) get a
      // short quiet note, the offbeat 16ths ring out an octave up — the
      // classic techno pump (the bus sidechain adds the bounce).
      const onKick = sib % 4 === 0;
      freq = hz(root + ((sib % 8) === 2 || (sib % 8) === 6 ? 12 : 0));
      dur = onKick ? step * 0.8 : step * 1.1;
      vol = onKick ? V * 0.55 : V;
      cutoff = 500; q = 1.2; det = [-5, 5]; sub = true; soft = false;
    } else if (style === 'march' && sib % 2 === 0) {
      // Distorted 8th-note pulses (saw + sub through a tight lowpass);
      // the last 8th of the bar approaches the root from a semitone below.
      freq = sib === 14 ? hz(root - 1) : hz(root);
      dur = step * 0.85; vol = V; cutoff = 420; q = 1.3; det = [-6, 6]; sub = true; soft = false;
    } else {
      return;
    }
    const v = makeVoice(ctx, this._layers.bass, {
      t, freq,
      type: soft ? 'sine' : 'sawtooth',
      detunes: det,
      sub: !!sub,
      subLevel: 0.8,
      cutoff, q,
      adsr: soft
        ? { a: 0.02, d: 0.15, s: 0.85, r: 0.25 }
        : { a: 0.005, d: 0.09, s: 0.8, r: 0.07 },
      vol, dur,
    });
    for (const s of v.sources) this._track(s);
  }

  // ─── v4.16.0: MIDI event playback (the parsed-note album) ───

  /**
   * v4.16.0: per-step event index for a MIDI song — lazy-built once and
   * cached on the song (static data, safe to memoize): idx[step] =
   * [[layer, event], ...] or undefined (a silent 32nd).
   */
  _evIndex(song) {
    if (song._evIdx) return song._evIdx;
    const total = song.bars * 32;
    const idx = new Array(total);
    for (const layer of ['lead', 'bass', 'arp', 'pad', 'drums']) {
      for (const ev of song.events[layer] || []) {
        const t = ev[0];
        if (t < 0 || t >= total) continue;
        (idx[t] || (idx[t] = [])).push([layer, ev]);
      }
    }
    song._evIdx = idx;
    return idx;
  }

  /**
   * v4.16.0: one 32nd step of a MIDI song — every parsed note event on
   * this step, routed to its SynthVoice.js slot:
   *   lead  → _leadNote (the song.lead cello/distorted-saw profile)
   *   bass  → _eventBass (the song.bass profile, soft-clip bus + pump)
   *   arp   → _pluckNote (short detuned pluck + delay send)
   *   pad   → _eventPad (slow-attack detuned voice + reverb send)
   *   drums → _kick/_snare/_hat (GM-mapped kinds 0/1/2/3, kick-pumped)
   * v4.19.0: the per-track mix (TRACK_MIX_SETTINGS[song.id]) multiplies
   * the lead / bass / drums layer gains — gainLead boosts a quiet lead
   * melody, gainDrums lowers an overpowering percussion channel, all
   * per song without touching the genre profile vols.
   */
  _scheduleEventStep(song, songStep, t, step, volScale) {
    const list = this._evIndex(song)[songStep];
    if (!list) return;
    const V = song.vols;
    // v4.19.0: per-track mix scalars (defaults 1.0 = profile vols as-is).
    // v4.20.0: the table grows to 5 scalars — gainArp / gainPad join
    // gainLead / gainBass / gainDrums so the arp + pad event layers can
    // be balanced per song (e.g. Pneuma's rhythm-guitar arp).
    const mix = TRACK_MIX_SETTINGS[song.id] || { gainLead: 1, gainBass: 1, gainDrums: 1, gainArp: 1, gainPad: 1 };
    for (const [layer, ev] of list) {
      if (layer === 'drums') {
        const kind = ev[1];
        const dv = V.perc * mix.gainDrums * volScale * ev[2];
        if (dv <= 0.001) continue;
        if (kind === 0) {
          this._kick(t, dv);
          this._sidechainPump(t, step); // the 4-on-the-floor bounce
        } else if (kind === 1) this._snare(t, dv);
        else if (kind === 2) this._hat(t, dv, false);
        else this._hat(t, dv, true);
        continue;
      }
      const n = ev[1];
      const dur = step * ev[2];
      const v = ev[3];
      if (layer === 'lead') this._leadNote(song, n, t, dur, volScale, v, mix.gainLead);
      else if (layer === 'bass') this._eventBass(song, n, t, dur, volScale, v, mix.gainBass);
      else if (layer === 'arp') this._pluckNote(hz(n), t, dur, V.arp * mix.gainArp * v * volScale, 1, song);
      else if (layer === 'pad') this._eventPad(song, n, t, dur, volScale, v, mix.gainPad);
    }
  }

  /**
   * v4.16.0: explicit MIDI bass note — the parsed bassline through the
   * song.bass voice profile (soft sine for ballads, detuned saw + sub
   * for the driven tracks) on the soft-clip bass bus.
   */
  _eventBass(song, n, t, dur, volScale, vel, mix = 1) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
    const cfg = song.bass;
    // v4.19.0: mix = the per-track gainBass (TRACK_MIX_SETTINGS).
    const V = song.vols.bass * mix * volScale * vel;
    if (V <= 0.001) return;
    const v = makeVoice(ctx, this._layers.bass, {
      t, freq: hz(n),
      type: cfg.soft ? 'sine' : 'sawtooth',
      detunes: cfg.detunes || [0],
      sub: !!cfg.sub,
      subLevel: 0.8,
      cutoff: cfg.lp || 700,
      q: cfg.q || 0.8,
      adsr: cfg.adsr || { a: 0.005, d: 0.09, s: 0.8, r: 0.07 },
      vol: V, dur,
    });
    for (const s of v.sources) this._track(s);
  }

  /**
   * v4.16.0: explicit MIDI pad note — a slow-attack 3-osc detuned voice
   * (the chord/harmony layer of the parsed arrangement) with a reverb
   * send, through the pad bus.
   */
  _eventPad(song, n, t, dur, volScale, vel, mix = 1) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
    // v4.20.0: mix = the per-track gainPad (TRACK_MIX_SETTINGS).
    const V = song.vols.pad * mix * volScale * vel;
    if (V <= 0.001) return;
    const d = Math.max(0.15, dur);
    const v = makeVoice(ctx, this._layers.pad, {
      t, freq: hz(n),
      type: 'sawtooth',
      detunes: [-8, 0, 8],
      cutoff: song.padCutoff || 1200,
      q: 1.1,
      pan: 0.2,
      adsr: { a: Math.min(0.3, d * 0.3), d: 0.2, s: 0.7, r: Math.min(0.6, d * 0.5) },
      vol: V, dur: d,
      sends: [this._layers.reverb],
    });
    for (const s of v.sources) this._track(s);
  }

  /**
   * v4.9.0: sidechain pump — dip the bass bus gain on every kick (the
   * classic 4-on-the-floor bounce). Overlapping pumps simply restart the
   * dip, which is exactly the desired behavior on dense kick patterns.
   */
  _sidechainPump(t, step) {
    if (!this._layers) return;
    const g = this._layers.side.gain;
    g.setValueAtTime(0.35, t);
    g.exponentialRampToValueAtTime(1, t + Math.min(0.22, step * 3));
  }

  // ─── v4.9.0: percussion (SynthVoice voices through the punch comp) ───

  _kick(t, vol) {
    if (!this._layers) return;
    for (const s of synthKick(this.core.ctx, this._layers.perc, t, vol, this._layers.noise)) this._track(s);
  }
  _snare(t, vol) {
    if (!this._layers) return;
    for (const s of synthSnare(this.core.ctx, this._layers.perc, t, vol, this._layers.noise)) this._track(s);
  }
  _hat(t, vol, open) {
    if (!this._layers) return;
    for (const s of synthHat(this.core.ctx, this._layers.perc, t, vol, this._layers.noise, open)) this._track(s);
  }

  // ─── v4.4.0: open-space shimmer + mode transition accents ───

  _shimmerPing(freq, t, dur) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
    const v = makeVoice(ctx, this._layers.fx, {
      t, freq,
      type: 'sine',
      detunes: [0],
      cutoff: 8000,
      q: 0.4,
      pan: 0.4,
      adsr: { a: 0.4, d: 0.8, s: 0.4, r: 1.2 },
      vol: 0.035, dur,
      sends: [this._layers.delay, this._layers.reverb],
    });
    for (const s of v.sources) this._track(s);
  }
  _shimmerGlide(f0, f1, t, dur) {
    if (!this._layers) return;
    const ctx = this.core.ctx;
    const v = makeVoice(ctx, this._layers.fx, {
      t, freq: f0,
      type: 'triangle',
      detunes: [0],
      cutoff: 6000,
      q: 0.4,
      pan: -0.3,
      slideTo: f1,
      adsr: { a: dur * 0.4, d: 0.3, s: 0.6, r: 0.8 },
      vol: 0.03, dur,
      sends: [this._layers.delay, this._layers.reverb],
    });
    for (const s of v.sources) this._track(s);
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
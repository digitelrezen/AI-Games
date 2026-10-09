// Filename: core/audio/AudioCore.js
// Kitty Vs Everything — v4.9.0
// v4.9.0: POLYPHONIC SYNTH OVERHAUL — unchanged surface: the context +
//          master chain + buses + volumes + mute stay the single source of
//          truth for every voice; the v4.9.0 SynthVoice.js engine and the
//          rebuilt MusicScheduler/SoundEffects route through these same
//          buses.
// v4.8.0: AUDIO MODULARIZATION — AudioSystem.js monolith split into
//          js/core/audio/ (this file + SoundEffects.js + MusicScheduler.js
//          + MusicPlaylists.js; the AudioSystem.js facade keeps the public
//          `audio` singleton API). AudioCore owns the Web Audio context
//          (lazy init + resume), the master output chain
//          (masterGain → DynamicsCompressor → destination), the SFX / music
//          buses, the three volume knobs (master / sfx / music) and the
//          global mute state — every voice in the game routes through this
//          graph, so volume + mute are enforced in exactly one place
//          (single source of truth).
export const VERSION = 'v4.9.0';

const clamp01 = (v) => Math.max(0, Math.min(1, +v || 0));

export class AudioCore {
  constructor() {
    this.ctx = null;          // AudioContext (created lazily on first use)
    this.enabled = true;      // false when no AudioContext is available (headless)
    // ─── volume layer (Settings.js sliders → 0..1) ───
    this.master = 1;
    this.sfx = 1;
    this.music = 1;
    this.muted = false;       // global mute (master gain → 0)
    // ─── master output chain (built together with the context) ───
    this.masterGain = null;   // master volume → compressor → destination
    this.compressor = null;   // gentle limiter (keeps bus peaks in check)
    this.sfxBus = null;       // SFX voices → sfxBus (gain = sfx volume)
    this.musicBus = null;     // music session graph → musicBus (gain = music volume)
  }

  /**
   * Lazily create (or resume) the AudioContext and build the master graph.
   * Headless-safe: returns null when no AudioContext constructor exists
   * (Node smoke tests) — callers must null-check.
   */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { this.enabled = false; return null; }
    this._buildGraph();
    return this.ctx;
  }

  /** masterGain → compressor → destination; sfxBus / musicBus → masterGain. */
  _buildGraph() {
    const ctx = this.ctx;
    this.masterGain = ctx.createGain();
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    this.masterGain.connect(this.compressor).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.masterGain);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.masterGain);
    this._applyVolumes();
  }

  /** v3.14.0 API: apply the three Settings.js volumes (0..1 each). */
  setVolumes(master, sfx, music) {
    this.master = clamp01(master);
    this.sfx = clamp01(sfx);
    this.music = clamp01(music);
    this._applyVolumes();
  }

  /** v4.8.0: global mute state (master gain → 0). */
  setMuted(muted) {
    this.muted = !!muted;
    this._applyVolumes();
  }

  /** Push the volume/mute state into the master graph (one place only). */
  _applyVolumes() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.muted ? 0.0001 : this.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.music, t, 0.05);
  }

  /**
   * v4.8.0: full engine reset — close the context (every node in the graph
   * is released with it) and drop the references. The next ensure() builds
   * a fresh context + graph. Idempotent, headless-safe.
   */
  close() {
    if (this.ctx) {
      if (this.ctx.state !== 'closed') {
        try { this.ctx.close(); } catch (e) { /* noop */ }
      }
      this.ctx = null;
    }
    this.masterGain = null;
    this.compressor = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.enabled = true;
  }
}

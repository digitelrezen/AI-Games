// Filename: AudioSystem.js
// Kitty Vs Everything — v4.8.0
// v4.8.0: AUDIO MODULARIZATION — the ~1000-line monolith is split into a
//          single-responsibility E6 tree under js/core/audio/:
//            • AudioCore.js      — Web Audio context (lazy init / resume),
//                                  master chain (masterGain → compressor →
//                                  destination), SFX / music buses, the
//                                  master / sfx / music volumes + global
//                                  mute state (single source of truth for
//                                  volume).
//            • SoundEffects.js   — every standalone SFX voice (shoot / hit
//                                  / explosion / coin / powerup / banner /
//                                  superWeapon / gameOver / uiBlip / tone),
//                                  tracked timers + live-source GC.
//            • MusicScheduler.js — the SINGLE mission-music scheduler: one
//                                  lookahead timer, one session graph;
//                                  start() hard-kills any previous session
//                                  (timer + gain nodes + live sources)
//                                  before a new track begins — zero
//                                  overlapping loops.
//            • MusicPlaylists.js — the soundtrack data (MUSIC_MODES, the
//                                  13-song SONGS album, per-mode PLAYLISTS,
//                                  the Für Elise + Johnny Marching Home
//                                  crossover motifs).
//          THIS FILE IS THE FACADE — the public `audio` singleton keeps its
//          exact v4.6.0 API (every consumer imports { audio } from
//          './AudioSystem.js' unchanged) and adds stopAllMusic() /
//          resetAudioEngine() / setMuted() for explicit teardown.
export const VERSION = 'v4.8.0';
import { AudioCore } from './audio/AudioCore.js';
import { SoundEffects } from './audio/SoundEffects.js';
import { MusicScheduler } from './audio/MusicScheduler.js';
export { MUSIC_MODES, SONGS, PLAYLISTS } from './audio/MusicPlaylists.js';

class AudioSystem {
  constructor() {
    this.core = new AudioCore();
    this.sfxEngine = new SoundEffects(this.core);
    this.musicEngine = new MusicScheduler(this.core);
  }

  // ─── v3.14.0: volume layer (Settings.js sliders → 0..1) ───
  setVolumes(master, sfx, music) {
    this.core.setVolumes(master, sfx, music);
  }
  /** v4.8.0: global mute (master gain → 0). */
  setMuted(muted) { this.core.setMuted(muted); }
  get muted() { return this.core.muted; }

  // ─── SFX (js/core/audio/SoundEffects.js) ───
  tone(freq, dur, type, vol, slideTo) { this.sfxEngine.tone(freq, dur, type, vol, slideTo); }
  uiBlip(freq, dur, vol) { this.sfxEngine.uiBlip(freq, dur, vol); }
  shoot()       { this.sfxEngine.shoot(); }
  hit()         { this.sfxEngine.hit(); }
  explosion()   { this.sfxEngine.explosion(); }
  /** v3.86.0: gold coin pickup: classic two-note arcade coin (B5 to E6). */
  coin()        { this.sfxEngine.coin(); }
  powerup()     { this.sfxEngine.powerup(); }
  banner()      { this.sfxEngine.banner(); }
  superWeapon() { this.sfxEngine.superWeapon(); }
  gameOver()    { this.sfxEngine.gameOver(); }

  // ─── mission music (js/core/audio/MusicScheduler.js — single source of truth) ───
  startMusic() { this.musicEngine.start(); }
  stopMusic() { this.musicEngine.stop(); }
  /**
   * v4.4.0+: request a soundtrack mode ('open' | 'combat' | 'boneyard' |
   * 'boss'). Takes effect at the next bar boundary (1-bar crossfade into
   * the new mode's playlist) and plays a riser (intensity up) or sub-drop
   * (intensity down) transition accent. Safe to call every frame — a no-op
   * when the mode is unchanged or music is not playing.
   */
  setMusicMode(mode) { this.musicEngine.setMode(mode); }
  /** v4.4.0+: the requested soundtrack mode (MusicDirector reads this). */
  getMusicMode() { return this.musicEngine.getMode(); }
  /** v4.6.0: the song currently in rotation (debug / dev panel). */
  getMusicSong() { return this.musicEngine.getSong(); }
  get musicPlaying() { return this.musicEngine.playing; }

  /**
   * v4.8.0: explicit full-music teardown — kill the scheduler (lookahead
   * timer + session graph + live sources) and every dangling SFX timer.
   * Idempotent; safe to call from any teardown path (pause / game over /
   * return-to-hangar).
   */
  stopAllMusic() {
    this.musicEngine.stop({ hard: true });
    this.sfxEngine.clearAll();
  }
  /**
   * v4.8.0: full audio engine reset — stopAllMusic() + close the Audio
   * Context (every node in the graph is released with it); the next SFX /
   * music call rebuilds a fresh context via AudioCore.ensure().
   * Idempotent; headless-safe.
   */
  resetAudioEngine() {
    this.stopAllMusic();
    this.core.close();
  }
}

export const audio = new AudioSystem();

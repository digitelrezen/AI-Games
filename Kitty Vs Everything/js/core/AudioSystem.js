// Filename: AudioSystem.js
// Kitty Vs Everything — v3.86.0
// Synthesized SFX via WebAudio (zero audio files, zero dependencies).
// v3.14.0: Volume layer (setVolumes — master / SFX / music, applied at
//          startup from Settings.js and live from the Settings screen),
//          uiBlip() for UI clicks, and a startMusic/stopMusic mission-music
//          sequencer (WebAudio-scheduled drone + arpeggio — PauseMenu starts
//          it on mission start, stops it on pause and game over).

export const VERSION = 'v3.86.0';

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    // ─── v3.14.0: volume layer (Settings.js sliders → 0..1) ───
    this.master = 1;
    this.sfx = 1;
    this.music = 1;
    // ─── v3.14.0: mission-music sequencer state ───
    this.musicPlaying = false;
    this._musicGain = null;
    this._musicTimer = null;
    this._musicNext = 0;
    this._musicStep = 0;
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
  //  v3.14.0: MISSION MUSIC — look-ahead WebAudio scheduler,
  //  zero audio files. Drone root + A-minor arpeggio at ~107 BPM.
  // ═══════════════════════════════════════════════════════════
  startMusic() {
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    this._ensure();
    if (!this.ctx) return;
    this._musicGain = this.ctx.createGain();
    this._musicGain.gain.value = this.music;
    this._musicGain.connect(this.ctx.destination);
    this._musicNext = this.ctx.currentTime + 0.1;
    this._musicStep = 0;
    this._scheduleMusic();
  }
  stopMusic() {
    if (!this.musicPlaying) return;
    this.musicPlaying = false;
    if (this._musicTimer) { clearTimeout(this._musicTimer); this._musicTimer = null; }
    if (this._musicGain) {
      const g = this._musicGain;
      g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
      setTimeout(() => { try { g.disconnect(); } catch (e) { /* noop */ } }, 600);
      this._musicGain = null;
    }
  }
  _musicNote(freq, t0, dur, type, vol) {
    if (!this._musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this._musicGain);
    osc.start(t0);
    osc.stop(t0 + dur);
  }
  _scheduleMusic() {
    if (!this.musicPlaying || !this.ctx) return;
    const STEP = 0.28; // 8th notes ≈ 107 BPM
    const ARP = [220, 261.63, 329.63, 261.63, 196, 261.63, 220, 329.63]; // A-minor
    while (this._musicNext < this.ctx.currentTime + 0.5) {
      const i = this._musicStep;
      if (i % 4 === 0) this._musicNote(110, this._musicNext, STEP * 3.8, 'sine', 0.16); // drone
      this._musicNote(ARP[i % ARP.length], this._musicNext, STEP * 0.95, 'triangle', 0.07);
      this._musicNext += STEP;
      this._musicStep++;
    }
    this._musicTimer = setTimeout(() => this._scheduleMusic(), 120);
  }
}
export const audio = new AudioSystem();
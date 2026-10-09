// Filename: core/audio/SynthVoice.js
// Kitty Vs Everything — v4.9.0
// v4.9.0: POLYPHONIC SYNTH ENGINE — the professional-grade voice builders
//          behind the v4.9.0 audio overhaul. Pure functions (no state, no
//          timers, no AudioContext at import time — headless-safe): every
//          builder takes the live AudioContext + a destination node and
//          returns the AudioScheduledSource nodes it started so the caller
//          (MusicScheduler / SoundEffects) can _track() them for teardown.
//
//          Voice architecture (why the v4.8.0 sound was harsh and how this
//          fixes it):
//            v4.8.0: ONE raw oscillator (buzzsaw/square) → gain → bus, with
//                    no more than a 20 ms attack, no resonance, no stereo
//                    image, no room — a thin, grating single-note beep.
//            v4.9.0: N detuned oscillators (±cents spread) + an optional
//                    sine sub → optional soft-clip saturation → resonant
//                    lowpass (with optional automated sweep) → StereoPanner
//                    → full ADSR envelope (Attack / Decay / Sustain /
//                    Release) → destination + optional sends (feedback
//                    delay / convolver reverb). Chords = makeChord() = one
//                    voice per pitch with a spread stereo image + per-note
//                    detune drift — real polyphony (chords + melody at the
//                    same time), never a single-note beep.
//          Percussion: kick (sine pitch-drop + transient click), snare
//          (bandpass noise + triangle body), hat (highpass noise) —
//          transient-sharp, low-mid clean, ready for the perc-bus
//          compressor in MusicScheduler.
export const VERSION = 'v4.9.0';

// ─── shared buffers ────────────────────────────────────────────────────────

/** White-noise buffer (percussion voices + tension sweeps). */
export function makeNoiseBuffer(ctx, seconds = 1.2) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/**
 * Procedural stereo reverb impulse response — exponentially decaying noise
 * (no external .wav, so the single-file build stays dependency-free).
 * `decay` = power exponent (higher = drier, shorter tail).
 */
export function makeImpulse(ctx, seconds = 2.4, decay = 3.0) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buf;
}

/**
 * Soft-clip (tanh) saturation curve for a WaveShaperNode — tames the harsh
 * harmonics of detuned saw/square layers without a brick-wall limiter.
 * `k` = drive (1 ≈ linear, 2.5 warm, 3+ crunchy).
 */
export function softClipCurve(k = 2.5) {
  const n = 1024;
  const curve = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

// ─── ADSR envelope ─────────────────────────────────────────────────────────

/**
 * Full ADSR envelope on a GainNode.
 *   adsr = { a, d, s, r } — attack / decay / release in seconds, sustain
 *           LEVEL 0..1 (not seconds — classic synth semantics)
 *   peak — target gain at the end of attack
 *   dur  — note length (sustain holds until t + dur, then release)
 * Returns the voice's end time (t + dur + r, clamped through the envelope).
 */
export function scheduleAdsr(gain, t, adsr, peak, dur) {
  const { a = 0.004, d = 0.08, s = 0.7, r = 0.2 } = adsr || {};
  const g = gain.gain;
  const peakV = Math.max(0.0002, peak);
  const susV = Math.max(0.0001, peak * Math.max(0, Math.min(1, s)));
  const aEnd = t + Math.max(0.0015, a);
  const dEnd = aEnd + Math.max(0.0015, d);
  const relStart = Math.max(dEnd, t + dur);
  const relEnd = relStart + Math.max(0.012, r);
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(peakV, aEnd);
  g.exponentialRampToValueAtTime(susV, dEnd);
  if (relStart > dEnd + 0.001) g.setValueAtTime(susV, relStart);
  g.exponentialRampToValueAtTime(0.0001, relEnd);
  return relEnd;
}

// ─── the polyphonic note voice ─────────────────────────────────────────────

/**
 * One rich note voice — the v4.9.0 polyphonic building block.
 *
 * Graph:  [detuned oscillators] + [optional sine sub, −1 octave]
 *         → preGain → [soft-clip WaveShaper] → resonant lowpass
 *         (optional automated sweep) → [StereoPanner] → ADSR gain
 *         → dest (+ each send node).
 *
 * o = {
 *   t,                 // start time (ctx seconds)
 *   freq,              // fundamental Hz
 *   type = 'sawtooth', // oscillator waveform
 *   detunes = [0],     // cents offsets — ONE oscillator per entry
 *   sub = false,       // + sine sub one octave down
 *   subLevel = 0.5,    // sub gain relative to the voice peak
 *   cutoff = 4000,     // lowpass Hz
 *   q = 0.8,           // lowpass resonance
 *   sweeps = null,     // [[offsetSec, hz], ...] automated cutoff points
 *   shaper = null,     // Float32Array curve (softClipCurve) or null
 *   pan = 0,           // -1..1 stereo position
 *   adsr = {a,d,s,r},  // envelope (s = sustain level 0..1)
 *   vol = 1,           // peak gain
 *   dur = 0.5,         // note length (before release)
 *   glide = 0,         // portamento seconds (from prevFreq)
 *   prevFreq = null,   // glide origin Hz
 *   slideTo = null,    // or slide freq → slideTo over dur (SFX style)
 *   sends = [],        // extra destinations (delay input / reverb input)
 * }
 * Returns { sources, end } — sources: the AudioScheduledSource nodes to
 * _track(); end: the voice's end time.
 */
export function makeVoice(ctx, dest, o) {
  const t = o.t;
  const freq = Math.max(1, o.freq);
  const detunes = o.detunes && o.detunes.length ? o.detunes : [0];
  const n = detunes.length;

  // Per-osc gain keeps the summed level constant as voices are added.
  const pre = ctx.createGain();
  pre.gain.value = (1 / Math.sqrt(n)) * (o.sub ? 0.8 : 1);

  let head = pre;
  if (o.shaper) {
    const ws = ctx.createWaveShaper();
    ws.curve = o.shaper;
    ws.oversample = '2x';
    pre.connect(ws);
    head = ws;
  }
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.max(40, o.cutoff || 4000);
  lp.Q.value = o.q ?? 0.8;
  if (o.sweeps && o.sweeps.length) {
    for (const [off, f] of o.sweeps) {
      lp.frequency.exponentialRampToValueAtTime(Math.max(40, f), t + off);
    }
  }
  head.connect(lp);

  let tail = lp;
  if (o.pan && typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    tail.connect(p);
    tail = p;
  }

  const env = ctx.createGain();
  env.gain.value = 0;
  tail.connect(env);
  env.connect(dest);
  for (const send of o.sends || []) env.connect(send);

  const sources = [];
  const addOsc = (type, detune) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.detune.value = detune || 0;
    if (o.glide > 0 && o.prevFreq) {
      osc.frequency.setValueAtTime(Math.max(1, o.prevFreq), t);
      osc.frequency.exponentialRampToValueAtTime(freq, t + o.glide);
    } else if (o.slideTo) {
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, o.slideTo), t + Math.max(0.02, o.dur));
    } else {
      osc.frequency.value = freq;
    }
    osc.connect(pre);
    osc.start(t);
    sources.push(osc);
  };
  for (const det of detunes) addOsc(o.type || 'sawtooth', det);
  if (o.sub) {
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = freq / 2;
    const sg = ctx.createGain();
    sg.gain.value = o.subLevel ?? 0.5;
    sub.connect(sg).connect(pre);
    sub.start(t);
    sources.push(sub);
  }

  const end = scheduleAdsr(env, t, o.adsr, o.vol ?? 1, o.dur ?? 0.5);
  for (const s of sources) s.stop(end + 0.03);
  return { sources, end };
}

/**
 * Polyphonic CHORD — one makeVoice per pitch with a spread stereo image
 * (leftmost note → left, rightmost → right) + a slight per-note detune
 * drift so the chord breathes instead of stacking in-phase buzz.
 *
 * o = makeVoice options + {
 *   midis: [..],        // chord tones (MIDI)
 *   toFreq: (m) => hz,  // MIDI → Hz (defaults to the A4=440 formula)
 *   spread = 0.55,      // stereo spread (0..1)
 *   octave = null,      // or a level 0..1 — a softer +12 octave layer for
 *                       // lush pads
 * }
 * Returns { sources, end }.
 */
export function makeChord(ctx, dest, midis, o) {
  const n = midis.length;
  const toFreq = o.toFreq || ((m) => 440 * Math.pow(2, (m - 69) / 12));
  const spread = o.spread ?? 0.55;
  const sources = [];
  let end = 0;
  const panFor = (i) => (n > 1 ? -spread + (2 * spread * i) / (n - 1) : 0);
  const play = (midi, i, level) => {
    const det = o.detunes && o.detunes.length ? o.detunes : [0];
    const drift = (i % 2 === 0 ? -1 : 1) * 2.5; // ±2.5 cents per voice
    const v = makeVoice(ctx, dest, {
      ...o,
      freq: toFreq(midi),
      pan: panFor(i),
      detunes: det.map((d) => d + drift),
      vol: (o.vol ?? 1) * (level ?? 1),
    });
    sources.push(...v.sources);
    end = Math.max(end, v.end);
  };
  midis.forEach((m, i) => play(m, i, 1));
  if (o.octave) midis.forEach((m, i) => play(m + 12, i, o.octave));
  return { sources, end };
}

// ─── percussion ────────────────────────────────────────────────────────────

/**
 * Punchy kick — sine pitch-drop (165 → 42 Hz) for the thump + a short
 * highpassed noise click for the transient attack. Returns source nodes.
 */
export function kick(ctx, dest, t, vol, noise) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(165, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.9 * vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
  const click = ctx.createBufferSource();
  click.buffer = noise;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 4000;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.22 * vol, t);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
  osc.connect(g).connect(dest);
  click.connect(hp).connect(cg).connect(dest);
  osc.start(t);
  osc.stop(t + 0.3);
  click.start(t);
  click.stop(t + 0.03);
  return [osc, click];
}

/**
 * Snare — bandpassed noise (the crack) + a triangle body tone (the thump),
 * so it reads as a drum instead of a burst of static. Returns sources.
 */
export function snare(ctx, dest, t, vol, noise) {
  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(210, t);
  body.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.32 * vol, t);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1900;
  bp.Q.value = 0.8;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.5 * vol, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  body.connect(bg).connect(dest);
  src.connect(bp).connect(ng).connect(dest);
  body.start(t);
  body.stop(t + 0.12);
  src.start(t);
  src.stop(t + 0.18);
  return [body, src];
}

/**
 * Hi-hat — highpassed noise transient (closed = 40 ms, open = 140 ms).
 * Returns source nodes.
 */
export function hat(ctx, dest, t, vol, noise, open = false) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 8000;
  const g = ctx.createGain();
  const dur = open ? 0.14 : 0.04;
  g.gain.setValueAtTime((open ? 0.18 : 0.12) * vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(hp).connect(g).connect(dest);
  src.start(t);
  src.stop(t + dur + 0.02);
  return [src];
}
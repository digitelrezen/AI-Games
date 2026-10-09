// Filename: AudioSystem.js
// Kitty Vs Everything — v4.6.0
// Synthesized SFX via WebAudio (zero audio files, zero dependencies).
// v3.14.0: Volume layer (setVolumes — master / SFX / music, applied at
//          startup from Settings.js and live from the Settings screen),
//          uiBlip() for UI clicks, and a startMusic/stopMusic mission-music
//          sequencer (PauseMenu starts it on mission start, stops it on
//          pause and game over).
// v4.4.0: DYNAMIC PROCEDURAL SOUNDTRACK — the old 8-step A-minor loop is
//          gone; four context modes (open / combat / boneyard / boss) with
//          8-bar chord progressions, evolving pads, per-phrase seeded
//          arpeggio variation, mode-specific bass + noise percussion,
//          space delay + shimmer. MusicDirector.js syncs the mode from
//          game state every frame.
// v4.6.0: MULTI-TRACK PLAYLIST ROTATION — each mode now owns a PLAYLIST
//          of 3–4 distinct full-length (32-bar) compositions with varying
//          root keys, chord progressions, bassline structures and
//          percussion patterns (the SONGS registry below). The look-ahead
//          step sequencer rotates the queue: when a song's phrase cycle
//          completes, the next track in the mode's playlist takes over
//          through a 1-BAR OVERLAP CROSSFADE — the outgoing track fades
//          out over its final bar while the incoming track fades in on
//          the same grid — so long sessions sound like an evolving
//          soundtrack album, never a single loop. Mode changes
//          (MusicDirector.js) still apply at the next bar boundary with a
//          riser (intensity up) / sub-drop (intensity down) accent and
//          jump the rotation to the new mode's queue. Two crossover
//          tracks ride the rotation:
//            • fur-elise    (combat + open) — Beethoven's Für Elise in
//              A minor as a 128 BPM cyber-remix: the iconic motif
//              (E4 D#4 E4 D#4 E4 B3 D4 C4 A3 G3 B3 C4 D4 E4 D4 C4 B3 A3
//              G3 E3) on a bright portamento'd detuned-saw lead,
//              4-on-the-floor techno kick, crisp offbeat hi-hats, a
//              sidechain-pumped 16th-note sub bassline, sweeping
//              detuned-saw pads.
//            • johnny-march (combat + boneyard) — When Johnny Comes
//              Marching Home Again as a 132 BPM militaristic industrial
//              synth-march: the driving A-minor motif on a gritty
//              detuned square lead, heavy 4-on-the-floor electro beat,
//              marching snare accents (backbeat + ghost shuffles),
//              distorted 8th-note bass pulses, high-tension 2-bar
//              atmospheric noise sweeps.
export const VERSION = 'v4.6.0';

// ─── v4.6.0: procedural soundtrack data ───
// MIDI → Hz (69 = A4 = 440).
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Seeded PRNG — per-phrase variation (deterministic per phrase + song, so
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

// The four context modes (MusicDirector.js syncs one of these every
// frame). intensity drives the transition accent (riser up / sub-drop down).
export const MUSIC_MODES = {
  open: { intensity: 0 },
  combat: { intensity: 1 },
  boneyard: { intensity: 2 },
  boss: { intensity: 3 },
};

// ─── v4.6.0: crossover track motifs (16th-note grid, 8-bar loop) ───

// Für Elise (A minor) — the iconic motif mapped onto the 16th grid:
// E4 D#4 E4 D#4 E4 B3 D4 C4 A3 | G3 B3 C4 D4 E4 D4 C4 B3 A3 G3 E3.
// Phrase A plays bars 0–1, phrase B plays bars 4–5 of each 8-bar loop.
const FUR_ELISE_PHRASE = [
  [0, 64, 2], [2, 63, 1], [3, 64, 1], [4, 63, 1], [5, 64, 1], [6, 59, 2],
  [8, 62, 1], [9, 60, 1], [10, 57, 2], [12, 55, 1], [13, 59, 1], [14, 60, 1],
  [15, 62, 1], [16, 64, 1], [17, 62, 1], [18, 60, 1], [19, 59, 1], [20, 57, 1],
  [21, 55, 1], [22, 52, 1],
];
const FUR_ELISE_MOTIF = [
  ...FUR_ELISE_PHRASE,
  ...FUR_ELISE_PHRASE.map(([s, m, l]) => [s + 64, m, l]),
];

// When Johnny Comes Marching Home Again (A minor) — the driving
// militaristic motif as 8th notes across the 8-bar loop
// (A A A B C A B C / C C B B A A B G / A B C D E C E D / B B A A G G A F).
const JOHNNY_MELODY = [
  [69, 69, 69, 71, 72, 69, 71, 72],
  [72, 72, 71, 71, 69, 69, 71, 67],
  [69, 71, 72, 74, 76, 72, 76, 74],
  [71, 71, 69, 69, 67, 67, 69, 65],
  [69, 69, 69, 71, 72, 69, 71, 72],
  [72, 72, 71, 71, 69, 69, 71, 67],
  [69, 71, 72, 74, 76, 72, 76, 74],
  [71, 71, 69, 69, 67, 67, 69, 65],
];
const JOHNNY_MOTIF = [];
JOHNNY_MELODY.forEach((barNotes, b) => {
  barNotes.forEach((m, i) => JOHNNY_MOTIF.push([b * 16 + i * 2, m, 1]));
});

// ─── v4.6.0: the soundtrack album — full-length song definitions ───
// Each song: bpm, bars (full length, 4× the 8-bar chord loop), chords
// (8 bars × 3 MIDI tones), arps (3 16-step chord-tone patterns, -1 = rest;
// per-phrase seeded rotation) OR lead (explicit crossover motif), bass
// (whole/half/eighth/sixteenth/techno/march line structure), perc
// (16th-grid hit positions; null = no percussion), padCutoff, vols.
export const SONGS = {
  // ═══ OPEN SPACE — atmospheric, no percussion (the breath between waves) ═══
  'open-drift': {
    id: 'open-drift', title: 'Open Drift', bpm: 92, bars: 32, seed: 1,
    chords: [
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [48, 52, 55], // C
      [55, 59, 62], // G
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [55, 59, 62], // G
      [52, 55, 58], // Em
    ],
    arps: [
      [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 2, -1, 1, -1, 0, -1],
      [0, -1, 2, -1, 1, -1, 2, -1, 0, -1, 1, -1, 2, -1, 1, -1],
      [0, 1, 2, -1, 1, 2, 0, -1, 2, 1, 0, -1, 1, 0, 1, -1],
    ],
    bass: 'whole',
    perc: null,
    shimmer: true,
    padCutoff: 1500,
    vols: { pad: 0.09, arp: 0.055, bass: 0.11, perc: 0 },
  },
  'open-nebula': {
    id: 'open-nebula', title: 'Nebula Crossing', bpm: 96, bars: 32, seed: 2,
    chords: [
      [50, 53, 55], // Dm
      [46, 50, 53], // Bb
      [48, 52, 55], // C
      [55, 59, 62], // G
      [50, 53, 55], // Dm
      [46, 50, 53], // Bb
      [55, 59, 62], // G
      [57, 61, 64], // A
    ],
    arps: [
      [0, -1, -1, 2, -1, -1, 1, -1, 0, -1, 2, -1, 1, -1, 2, -1],
      [0, 1, -1, -1, 2, -1, 1, -1, 0, 1, 2, -1, 1, -1, 0, -1],
      [2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1],
    ],
    bass: 'half',
    perc: null,
    shimmer: true,
    padCutoff: 1300,
    vols: { pad: 0.085, arp: 0.05, bass: 0.1, perc: 0 },
  },
  'open-aurora': {
    id: 'open-aurora', title: 'Aurora Static', bpm: 88, bars: 32, seed: 3,
    chords: [
      [52, 55, 58], // Em
      [54, 57, 61], // F#m
      [48, 52, 55], // C
      [55, 59, 62], // G
      [52, 55, 58], // Em
      [47, 50, 54], // Bm
      [48, 52, 55], // C
      [55, 59, 62], // G
    ],
    arps: [
      [0, -1, -1, -1, 1, -1, 2, -1, 0, -1, -1, -1, 1, -1, 2, -1],
      [0, 1, -1, 2, -1, -1, 0, -1, 2, -1, 1, -1, 0, -1, 1, -1],
      [0, -1, 2, -1, -1, 1, -1, 2, -1, 0, -1, 1, -1, 2, -1, 1],
    ],
    bass: 'whole',
    perc: null,
    shimmer: true,
    padCutoff: 1200,
    vols: { pad: 0.095, arp: 0.05, bass: 0.1, perc: 0 },
  },
  // ── CROSSOVER 1: Für Elise (A minor) — 128 BPM cyber-remix ──
  'fur-elise': {
    id: 'fur-elise', title: 'Für Elise (Cyber-Remix)', bpm: 128, bars: 32, seed: 4,
    chords: [
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [48, 52, 55], // C
      [55, 59, 62], // G
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [55, 59, 62], // G
      [52, 55, 59], // E
    ],
    arps: null,
    lead: {
      motif: FUR_ELISE_MOTIF, loop: 128,
      wave: 'sawtooth', detune: 9, glide: true, lp: 5200, vol: 0.075,
    },
    bass: 'techno', // 16th-note sub, sidechain-pumped on the kick
    perc: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
    padCutoff: 1100,
    vols: { pad: 0.05, arp: 0, bass: 0.16, perc: 0.85 },
  },
  // ═══ COMBAT — driving engagement ═══
  'combat-engage': {
    id: 'combat-engage', title: 'Engage', bpm: 126, bars: 32, seed: 5,
    chords: [
      [52, 55, 58], // Em
      [48, 52, 55], // C
      [55, 59, 62], // G
      [50, 53, 57], // D
      [52, 55, 58], // Em
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
  'combat-vanguard': {
    id: 'combat-vanguard', title: 'Vanguard', bpm: 130, bars: 32, seed: 6,
    chords: [
      [48, 51, 55], // Cm
      [44, 48, 51], // Ab
      [51, 55, 58], // Eb
      [46, 50, 53], // Bb
      [48, 51, 55], // Cm
      [44, 48, 51], // Ab
      [46, 50, 53], // Bb
      [55, 59, 62], // G
    ],
    arps: [
      [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2],
      [0, 1, 2, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1],
      [0, 2, 2, 1, 0, 2, 2, 1, 0, 2, 2, 1, 2, 1, 2, 1],
    ],
    bass: 'sixteenth',
    perc: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
    padCutoff: 950,
    vols: { pad: 0.05, arp: 0.06, bass: 0.16, perc: 0.85 },
  },
  // ── CROSSOVER 2: When Johnny Comes Marching Home — 132 BPM industrial remix ──
  'johnny-march': {
    id: 'johnny-march', title: 'Johnny Marching Home (Industrial Remix)', bpm: 132, bars: 32, seed: 7,
    chords: [
      [57, 60, 64], // Am
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [55, 59, 62], // G
      [57, 60, 64], // Am
      [57, 60, 64], // Am
      [52, 55, 59], // E
      [52, 55, 59], // E
    ],
    arps: null,
    lead: {
      motif: JOHNNY_MOTIF, loop: 128,
      wave: 'square', detune: 7, glide: false, lp: 3200, vol: 0.08,
    },
    bass: 'march', // distorted 8th-note pulses
    perc: {
      kick: [0, 4, 8, 12], snare: [4, 12],
      hat: [0, 2, 4, 6, 8, 10, 12, 14], ghostSnare: [2, 6, 10, 14],
    },
    sweeps: [6], // high-tension 2-bar build into the loop restart
    padCutoff: 850,
    vols: { pad: 0.06, arp: 0, bass: 0.15, perc: 0.9 },
  },
  // ═══ BONEYARD — dark hazard zone ═══
  'boneyard-crypt': {
    id: 'boneyard-crypt', title: 'Crypt Frequencies', bpm: 118, bars: 32, seed: 8,
    chords: [
      [53, 56, 60], // Fm
      [44, 48, 51], // Ab
      [46, 50, 53], // Bb
      [49, 53, 56], // Db
      [53, 56, 60], // Fm
      [44, 48, 51], // Ab
      [46, 50, 53], // Bb
      [51, 55, 58], // Eb
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
  'boneyard-mire': {
    id: 'boneyard-mire', title: 'Mire Signal', bpm: 112, bars: 32, seed: 9,
    chords: [
      [55, 58, 62], // Gm
      [51, 55, 58], // Eb
      [46, 50, 53], // Bb
      [50, 53, 57], // D
      [55, 58, 62], // Gm
      [51, 55, 58], // Eb
      [50, 53, 57], // D
      [53, 57, 60], // F
    ],
    arps: [
      [0, -1, -1, -1, -1, 2, -1, -1, 1, -1, -1, 2, -1, -1, 1, -1],
      [0, 1, -1, -1, -1, -1, 2, -1, 0, -1, -1, 1, -1, -1, 2, -1],
      [0, -1, 2, -1, 1, -1, -1, 0, -1, 2, -1, 1, -1, 0, -1, 2],
    ],
    bass: 'half',
    perc: { kick: [0, 10], snare: [8], hat: [4, 12] },
    padCutoff: 800,
    vols: { pad: 0.085, arp: 0.055, bass: 0.14, perc: 0.7 },
  },
  'boneyard-relic': {
    id: 'boneyard-relic', title: 'Relic Static', bpm: 116, bars: 32, seed: 10,
    chords: [
      [50, 53, 55], // Dm
      [46, 50, 53], // Bb
      [48, 52, 55], // C
      [53, 57, 60], // F
      [50, 53, 55], // Dm
      [46, 50, 53], // Bb
      [53, 57, 60], // F
      [48, 52, 55], // C
    ],
    arps: [
      [0, -1, -1, 1, -1, -1, 2, -1, 0, -1, -1, 1, -1, 2, -1, -1],
      [0, 2, -1, -1, -1, -1, 0, -1, 1, -1, 2, -1, -1, 0, -1, -1],
      [0, -1, 1, -1, -1, 2, -1, -1, 0, -1, 1, -1, 2, -1, -1, -1],
    ],
    bass: 'whole',
    perc: { kick: [0, 8], snare: [8], hat: [12] },
    padCutoff: 750,
    vols: { pad: 0.09, arp: 0.05, bass: 0.13, perc: 0.65 },
  },
  // ═══ BOSS — max intensity (bosses / Eridath's Mom's House) ═══
  'boss-eridath': {
    id: 'boss-eridath', title: 'Eridath Protocol', bpm: 140, bars: 32, seed: 11,
    chords: [
      [52, 55, 58], // Em
      [52, 55, 58], // Em
      [48, 52, 55], // C
      [55, 59, 62], // G
      [50, 53, 57], // D
      [50, 53, 57], // D
      [47, 51, 54], // B (V — pre-dominant tension)
      [52, 55, 58], // Em
    ],
    arps: [
      [0, 0, 2, 2, 1, 2, 1, 2, 0, 0, 2, 2, 1, 2, 1, 2],
      [0, 2, 0, 2, 1, 2, 1, 2, 0, 2, 0, 2, 2, 1, 0, 1],
      [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 2, 1, 0, 1],
    ],
    bass: 'sixteenth',
    perc: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    octaveDouble: true,
    padCutoff: 1200,
    vols: { pad: 0.05, arp: 0.07, bass: 0.17, perc: 1 },
  },
  'boss-overdrive': {
    id: 'boss-overdrive', title: 'Overdrive', bpm: 144, bars: 32, seed: 12,
    chords: [
      [48, 51, 55], // Cm
      [48, 51, 55], // Cm
      [44, 48, 51], // Ab
      [51, 55, 58], // Eb
      [46, 50, 53], // Bb
      [46, 50, 53], // Bb
      [55, 59, 62], // G
      [55, 59, 62], // G
    ],
    arps: [
      [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2],
      [0, 1, 2, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 2, 1],
      [0, 2, 0, 2, 1, 2, 1, 2, 2, 1, 2, 1, 0, 2, 1, 2],
    ],
    bass: 'sixteenth',
    perc: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    octaveDouble: true,
    padCutoff: 1100,
    vols: { pad: 0.045, arp: 0.07, bass: 0.18, perc: 1 },
  },
  'boss-redline': {
    id: 'boss-redline', title: 'Redline', bpm: 138, bars: 32, seed: 13,
    chords: [
      [47, 50, 54], // Bm
      [55, 59, 62], // G
      [50, 53, 57], // D
      [57, 61, 64], // A
      [47, 50, 54], // Bm
      [55, 59, 62], // G
      [57, 61, 64], // A
      [52, 55, 59], // E
    ],
    arps: [
      [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1],
      [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 1, 2, 1, 2],
      [0, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 0, 1, 2, 1, 0],
    ],
    bass: 'sixteenth',
    perc: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    octaveDouble: true,
    padCutoff: 1200,
    vols: { pad: 0.05, arp: 0.07, bass: 0.17, perc: 1 },
  },
};

// ─── v4.6.0: per-mode song queues (the rotation order) ───
export const PLAYLISTS = {
  open: ['open-drift', 'fur-elise', 'open-nebula', 'open-aurora'],
  combat: ['combat-engage', 'fur-elise', 'combat-vanguard', 'johnny-march'],
  boneyard: ['boneyard-crypt', 'johnny-march', 'boneyard-mire', 'boneyard-relic'],
  boss: ['boss-eridath', 'boss-overdrive', 'boss-redline'],
};

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    // ─── v3.14.0: volume layer (Settings.js sliders → 0..1) ───
    this.master = 1;
    this.sfx = 1;
    this.music = 1;
    // ─── v4.4.0+: dynamic soundtrack state ───
    this.musicPlaying = false;
    this._musicGain = null;  // master music gain (→ ctx.destination)
    this._musicTimer = null;
    this._musicNext = 0;     // next 16th-note start time (ctx seconds)
    this._mode = 'open';        // active mode (applied at bar boundaries)
    this._pendingMode = 'open'; // requested mode (setMusicMode)
    this._layers = null;       // { pad, arp, bass, perc, fx, delay, noise }
    // ─── v4.6.0: playlist rotation state ───
    this._song = null;        // active song id (SONGS)
    this._songStep = 0;       // 16th-note step within the active song
    this._incoming = null;    // song id crossfading in (1-bar overlap)
    this._incomingStep = 0;   // 16th-note step within the incoming song
    this._plIdx = {};         // per-mode playlist rotation index
    this._lastLead = {};      // per-song last lead freq (portamento)
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
  //  v4.6.0: MULTI-TRACK PLAYLIST ROTATION
  //  Look-ahead 16th-note scheduler. Four context modes (open /
  //  combat / boneyard / boss), each owning a playlist of 3–4
  //  full-length 32-bar songs (SONGS / PLAYLISTS above). Songs
  //  rotate through the queue with a 1-bar overlap crossfade;
  //  mode changes apply at the next bar boundary. Zero audio files.
  // ═══════════════════════════════════════════════════════════
  /**
   * v4.4.0+: request a soundtrack mode ('open' | 'combat' | 'boneyard' |
   * 'boss'). Takes effect at the next bar boundary (1-bar crossfade into
   * the new mode's playlist) and plays a riser (intensity up) or sub-drop
   * (intensity down) transition accent. Safe to call every frame — a no-op
   * when the mode is unchanged or music is not playing.
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
  /** v4.4.0+: the requested soundtrack mode (MusicDirector reads this). */
  getMusicMode() { return this._pendingMode; }
  /** v4.6.0: the song currently in rotation (debug / dev panel). */
  getMusicSong() { return this._song ? SONGS[this._song].title : null; }

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
    this._musicGain = master;
    this._layers = { pad: layers.pad, arp: layers.arp, bass: layers.bass, perc: layers.perc, fx: layers.fx, delay, noise };
    // v4.6.0: start the rotation straight in the requested mode's queue.
    this._mode = this._pendingMode;
    this._plIdx = {};
    this._lastLead = {};
    this._song = this._pickSong(this._mode, null);
    this._songStep = 0;
    this._incoming = null;
    this._incomingStep = 0;
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
    // v4.6.0: drop the rotation state (a fresh startMusic re-rolls it).
    this._song = null;
    this._incoming = null;
    this._songStep = 0;
    this._incomingStep = 0;
    this._lastLead = {};
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

  /** Look-ahead loop: schedule every 16th up to 0.6 s ahead of now. */
  _scheduleMusic() {
    if (!this.musicPlaying || !this.ctx) return;
    const LOOKAHEAD = 0.6;
    while (this._musicNext < this.ctx.currentTime + LOOKAHEAD) {
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
    this._musicTimer = setTimeout(() => this._scheduleMusic(), 100);
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
    const ctx = this.ctx;
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
  _schedulePad(chord, t, barLen, song, sweep, volScale = 1) {
    if (!this._layers) return;
    const ctx = this.ctx;
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
  /** v4.6.0: high-tension atmospheric sweep (bandpass noise riser). */
  _tensionSweep(t, dur, volScale = 1) {
    if (!this._layers) return;
    const ctx = this.ctx;
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

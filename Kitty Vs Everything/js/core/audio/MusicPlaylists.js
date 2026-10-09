// Filename: core/audio/MusicPlaylists.js
// Kitty Vs Everything — v4.8.0
// v4.8.0: AUDIO MODULARIZATION — the soundtrack data, extracted verbatim
//          from the AudioSystem.js monolith. Pure data (no audio nodes,
//          no timers): the four context modes, the full-length SONGS album
//          (13 compositions, 32 bars each), the per-mode PLAYLISTS rotation
//          queues, and the two crossover track motifs (Für Elise cyber-
//          remix + When Johnny Comes Marching Home industrial march).
// v4.6.0: MULTI-TRACK PLAYLIST ROTATION — each mode owns a PLAYLIST of
//          3–4 distinct full-length (32-bar) compositions with varying
//          root keys, chord progressions, bassline structures and
//          percussion patterns. The look-ahead step sequencer (Music-
//          Scheduler.js) rotates the queue: when a song's phrase cycle
//          completes, the next track in the mode's playlist takes over
//          through a 1-BAR OVERLAP CROSSFADE — the outgoing track fades
//          out over its final bar while the incoming track fades in on
//          the same grid — so long sessions sound like an evolving
//          soundtrack album, never a single loop. Two crossover tracks
//          ride the rotation:
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
export const VERSION = 'v4.8.0';

// ─── v4.6.0: procedural soundtrack data ───
// MIDI → Hz (69 = A4 = 440).
export const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Seeded PRNG — per-phrase variation (deterministic per phrase + song, so
// the soundtrack evolves without ever sounding random-noise).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The four context modes (js/core/game/MusicDirector.js syncs one of these
// every frame). intensity drives the transition accent (riser up / sub-drop
// down).
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

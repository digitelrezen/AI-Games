// Filename: core/audio/MusicPlaylists.js
// Kitty Vs Everything — v4.15.0
// v4.15.0: JUKEBOX PLAYLIST VIEW + TRACK REPLACEMENTS — the admin Music
//          Jukebox now shows the per-mode PLAYLISTS queues (DevPanel.js
//          renders #dev-jukebox-playlists from PLAYLISTS + SONGS and
//          highlights the track currently in preview), and three tracks
//          are replaced/rebuilt:
//            • fur-elise slot → "Neon Horizon": the cello-metal Für
//              Elise arrangement is REPLACED by a new 124 BPM D-minor
//              composition — a 61-note syncopated portamento saw lead
//              (glide ON) over an octave-below triangle doubling,
//              sidechain-pumped techno 16th sub, 4-on-the-floor kick
//              with OFFBEAT hats (still rides the open+combat slot).
//            • boss-overdrive → "Overdrive" rebuilt: a 48-note C-minor
//              gallop lead riff (staccato detuned saw + sub), a
//              galloping double-kick pattern (0/3/4/8/11/12), 8th-note
//              bass — no longer an arp clone of the other boss tracks.
//            • boss-redline → "Redline" rebuilt: 150 BPM B-minor
//              breakbeat (kick 0/7/8), new arp patterns, distorted
//              march 8th bass, a 2-bar tension sweep on bar 6 — clearly
//              distinct from Overdrive + Eridath Protocol.
// v4.14.0: SYMPHONIC CELLO-METAL OVERHAUL — the SONGS album adopts the
//          epic multi-cello metal aesthetic (Apocalyptica-style cello
//          ensembles): aggressive staccato bowing (glide OFF + tight
//          staccato ADSR on the leads), rich woody resonance (resonant
//          lowpass 1600–2800 Hz), heavy distorted lower registers
//          (detuned saw + sine sub bass through the bass-bus soft-clip
//          shaper), and soaring dramatic multi-voice lead harmonies
//          (lead + open-fifth / octave / third counter-voices) — zero
//          vocals. New + re-arranged:
//            • intro-overture (FIRST in the open queue — the game's
//              primary opening theme): "Epic Overture", a 100 BPM
//              arpeggiated symphonic-metal ballad in A minor — broken
//              Am/F/C/G string arps lift into a soaring sustained
//              melody over an open-fifth cello section, half-time
//              drums, downbeat chord stabs and a 2-bar tension sweep
//              into the dominant E (the acoustic-to-heavy build-up).
//            • fur-elise → "Für Elise (Cello-Metal)": the 40-note
//              motif keeps its 16th-grid shape but the arrangement is
//              re-voiced — staccato detuned-saw lead (portamento off),
//              the octave counter-voice becomes a detuned-saw cello
//              section, the techno sub becomes a 16th-note staccato
//              low-end pulse, 8th-note hats + heavy downbeat stabs.
//            • johnny-march → "Johnny Marching Home (Cello-Metal)":
//              the 64-note march motif moves from gritty square to
//              staccato detuned saw + sub, the third-below harmony
//              becomes a cello voice, the distorted march bassline +
//              ghost snares stay, heavy downbeat chord stabs join.
//          Every voice routes through the SynthVoice.js polyphonic
//          engine (makeVoice / makeChord: detuned multi-osc + sine sub
//          + soft-clip + resonant lowpass + full ADSR + delay/reverb
//          sends) — rich filtering, harmonic layering, distortion.
// v4.9.0: POLYPHONIC ARRANGEMENT DATA — the SONGS album now carries full
//          arrangement data for the SynthVoice.js polyphonic engine:
//            • lead: { motif, loop, wave, detunes, sub, lp, q, glide, vol,
//              adsr } — the crossover melody voice config (3-osc detuned
//              + sine sub + ADSR + filter + delay/reverb sends).
//            • harmony: { motif, loop, wave, vol, ... } — the counter-
//              voice: Für Elise plays the motif an OCTAVE BELOW (the
//              classic two-hand doubling), Johnny March plays the classic
//              march HARMONY A THIRD BELOW the melody — chords + melody
//              at the same time, never a thin single-note beep.
//            • stab: true — combat/boss tracks add short detuned chord
//              hits on the downbeats (vols.stab).
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
export const VERSION = 'v4.15.0';

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

// v4.15.0: "Neon Horizon" (D minor) — the replacement for the cello-metal
// Für Elise arrangement (the open+combat crossover slot). A syncopated
// 61-note lead line: phrase A (bars 0–1) is a staccato riff, phrase B
// (bars 2–3) lifts through the Bb5, phrase A' (bars 4–5) repeats the
// riff, phrase C (bars 6–7) resolves with a long held D root.
const NEON_HORIZON_MOTIF = [
  [0, 62, 2], [3, 65, 1], [4, 64, 2], [7, 62, 1], [8, 60, 2], [11, 58, 1],
  [12, 57, 2], [15, 60, 1], [16, 62, 2], [19, 65, 1], [20, 67, 2], [23, 65, 1],
  [24, 64, 2], [27, 62, 1], [28, 60, 2], [31, 57, 1],
  [32, 60, 2], [35, 64, 1], [36, 65, 2], [39, 64, 1], [40, 62, 2], [43, 60, 1],
  [44, 57, 2], [47, 60, 1], [48, 62, 2], [51, 65, 1], [52, 67, 2], [55, 70, 1],
  [56, 67, 2], [59, 65, 1], [60, 64, 2], [63, 62, 1],
  [64, 62, 2], [67, 65, 1], [68, 64, 2], [71, 62, 1], [72, 60, 2], [75, 58, 1],
  [76, 57, 2], [79, 60, 1], [80, 62, 2], [83, 65, 1], [84, 67, 2], [87, 65, 1],
  [88, 64, 2], [91, 62, 1], [92, 60, 2], [95, 57, 1],
  [96, 60, 2], [99, 62, 1], [100, 65, 2], [103, 67, 1], [104, 69, 2], [107, 67, 1],
  [108, 65, 2], [111, 64, 1], [112, 62, 2], [115, 60, 1], [116, 57, 2], [119, 53, 1],
  [120, 62, 4],
];
// The doubling: the same line an octave below (triangle — the classic
// two-voice cyber texture; the pad carries the chords).
const NEON_HORIZON_HARMONY = NEON_HORIZON_MOTIF.map(([s, m, l]) => [s, m - 12, l]);

// v4.15.0: "Overdrive" (C minor) — the rebuilt boss track: a 48-note
// gallop lead riff (staccato, 16th grid) over the Cm/Ab/Eb/Bb/G
// progression — four 2-bar phrases, each a rising-falling power pattern.
const OVERDRIVE_LEAD = [
  [0, 60, 1], [2, 60, 1], [4, 60, 2], [8, 63, 1], [10, 63, 1], [12, 63, 2],
  [16, 58, 1], [18, 58, 1], [20, 60, 2], [24, 63, 1], [26, 65, 1], [28, 67, 2],
  [32, 67, 1], [34, 67, 1], [36, 65, 2], [40, 63, 1], [42, 63, 1], [44, 60, 2],
  [48, 58, 1], [50, 58, 1], [52, 60, 2], [56, 63, 1], [58, 65, 1], [60, 67, 2],
  [64, 60, 1], [66, 60, 1], [68, 63, 2], [72, 67, 1], [74, 67, 1], [76, 70, 2],
  [80, 67, 1], [82, 65, 1], [84, 63, 2], [88, 60, 1], [90, 58, 1], [92, 60, 2],
  [96, 63, 1], [98, 63, 1], [100, 65, 2], [104, 67, 1], [106, 67, 1], [108, 70, 2],
  [112, 72, 1], [114, 70, 1], [116, 67, 2], [120, 65, 1], [122, 63, 1], [124, 60, 2],
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

// v4.9.0: the classic march harmony — a third below the melody line
// (A→F#, B→G, C→A, D→B, E→C, G→E, F#→D), the two-part military doubling.
const JOHNNY_HARMONY = JOHNNY_MOTIF.map(([s, m, l]) => [s, m - 3, l]);

// ─── v4.14.0: intro overture motifs (16th-note grid, 8-bar loop) ───
// "Epic Overture" (A minor) — the arpeggiated symphonic-metal ballad.
// Bars 1–4: broken-chord string ARPS (Am / F / C / G) — the "acoustic"
// half; bars 5–8: the SOARING sustained melody, resolved by a long
// dominant-E hold. The counter-voice doubles the line an OPEN FIFTH
// below — the multi-voice cello-ensemble texture (melody on top, thick
// open fifths underneath).
const INTRO_OVERTURE_LEAD = [
  [0, 69, 3], [4, 72, 3], [8, 76, 3], [12, 81, 3],   // Am: A4 C5 E5 A5 (arps)
  [16, 65, 3], [20, 69, 3], [24, 72, 3], [28, 77, 3], // F:  F4 A4 C5 F5
  [32, 72, 3], [36, 76, 3], [40, 79, 3], [44, 76, 3], // C:  C5 E5 G5 E5
  [48, 71, 3], [52, 74, 3], [56, 79, 3], [60, 76, 3], // G:  B4 D5 G5 E5
  [64, 76, 6], [70, 72, 2], [72, 69, 4], [76, 71, 4], // Am: E5.. C5 A4 B4 (soar)
  [80, 72, 4], [84, 69, 4], [88, 65, 4],              // F:  C5 A4 F4
  [96, 67, 4], [100, 71, 4], [104, 74, 4],            // G:  G4 B4 D5
  [112, 76, 8],                                       // E:  E5 (dominant hold)
];
// The cello section: an open fifth below the melody (the ensemble body).
const INTRO_OVERTURE_HARMONY = [
  [0, 62, 3], [4, 65, 3], [8, 69, 3], [12, 74, 3],   // D4 F4 A4 D5
  [16, 58, 3], [20, 62, 3], [24, 65, 3], [28, 70, 3], // B3 D4 F4 B4
  [32, 65, 3], [36, 69, 3], [40, 72, 3], [44, 69, 3], // F4 A4 C5 A4
  [48, 64, 3], [52, 67, 3], [56, 72, 3], [60, 69, 3], // E4 G4 C5 A4
  [64, 69, 6], [70, 65, 2], [72, 62, 4], [76, 64, 4], // A4 F4 D4 E4
  [80, 65, 4], [84, 62, 4], [88, 58, 4],              // F4 D4 B3
  [96, 60, 4], [100, 64, 4], [104, 67, 4],            // C4 E4 G4
  [112, 69, 8],                                       // A4 (under the E5 hold)
];

// ─── v4.6.0: the soundtrack album — full-length song definitions ───
// Each song: bpm, bars (full length, 4× the 8-bar chord loop), chords
// (8 bars × 3 MIDI tones), arps (3 16-step chord-tone patterns, -1 = rest;
// per-phrase seeded rotation) OR lead (explicit crossover motif), bass
// (whole/half/eighth/sixteenth/techno/march line structure), perc
// (16th-grid hit positions; null = no percussion), padCutoff, vols.
export const SONGS = {
  // ═══ v4.14.0: INTRO — the game's primary opening theme ═══
  // First in the open queue: MusicScheduler.start() picks PLAYLISTS.open[0],
  // so this is the track that opens every mission — an epic arpeggiated
  // symphonic-metal ballad (acoustic strings → heavy build-up).
  'intro-overture': {
    id: 'intro-overture', title: 'Epic Overture (Cello-Metal Ballad)', bpm: 100, bars: 32, seed: 14,
    chords: [
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [48, 52, 55], // C
      [55, 59, 62], // G
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [55, 59, 62], // G
      [52, 55, 59], // E (dominant — the heavy resolution)
    ],
    arps: null,
    lead: {
      motif: INTRO_OVERTURE_LEAD, loop: 128,
      // v4.14.0: soaring bowed-strings lead — 3-osc detuned saw + sine
      // sub, warm woody resonant lowpass, portamento glide (the cello
      // bow), delay + reverb sends.
      wave: 'sawtooth', detunes: [-10, 0, 10], sub: true,
      lp: 2800, q: 1.1, glide: true, vol: 0.09,
      adsr: { a: 0.01, d: 0.12, s: 0.55, r: 0.12 },
    },
    harmony: {
      motif: INTRO_OVERTURE_HARMONY, loop: 128,
      // the open-fifth cello section under the melody (multi-voice lead).
      wave: 'sawtooth', detunes: [-8, 0, 8], lp: 2000, vol: 0.055,
      adsr: { a: 0.008, d: 0.14, s: 0.5, r: 0.12 },
    },
    bass: 'eighth', // detuned saw + sub through the bass-bus soft-clip (heavy low register)
    perc: { kick: [0, 8], snare: [8], hat: [4, 12] }, // half-time epic ballad drums
    stab: true, // v4.14.0: detuned chord hits on the downbeats (the "heavy" layer)
    sweeps: [6], // 2-bar tension build into the dominant E
    padCutoff: 1100,
    vols: { pad: 0.07, arp: 0, bass: 0.16, perc: 0.8, stab: 0.05 },
  },
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
  // ── CROSSOVER 1: v4.15.0 "Neon Horizon" (D minor) — 124 BPM cyber drive ──
  // The cello-metal Für Elise arrangement was REPLACED (it sat badly
  // against the rest of the album): a new syncopated D-minor composition
  // with a portamento saw lead, octave triangle doubling, a
  // sidechain-pumped techno sub and offbeat hats. Still rides the
  // open+combat rotation (the crossover slot).
  'fur-elise': {
    id: 'fur-elise', title: 'Neon Horizon', bpm: 124, bars: 32, seed: 4,
    chords: [
      [50, 53, 57], // Dm
      [46, 50, 53], // Bb
      [48, 52, 55], // C
      [45, 49, 52], // A
      [50, 53, 57], // Dm
      [46, 50, 53], // Bb
      [43, 47, 50], // G
      [45, 49, 52], // A
    ],
    arps: null,
    lead: {
      motif: NEON_HORIZON_MOTIF, loop: 128,
      // v4.15.0: bright portamento cyber lead — 3-osc detuned saw +
      // sine sub, wide lowpass, glide ON (the classic cyber-remix bend),
      // delay + reverb sends.
      wave: 'sawtooth', detunes: [-10, 0, 10], sub: true,
      lp: 4200, q: 0.7, glide: true, vol: 0.085,
      adsr: { a: 0.006, d: 0.12, s: 0.55, r: 0.1 },
    },
    harmony: {
      motif: NEON_HORIZON_HARMONY, loop: 128,
      // the octave-below triangle doubling (two-voice melody).
      wave: 'triangle', detunes: [-6, 6], lp: 2400, vol: 0.05,
      adsr: { a: 0.01, d: 0.15, s: 0.5, r: 0.12 },
    },
    bass: 'techno', // sidechain-pumped 16th sub (the 4-on-the-floor bounce)
    perc: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, // offbeat hats
    stab: false,
    padCutoff: 1500,
    vols: { pad: 0.055, arp: 0, bass: 0.16, perc: 0.9, stab: 0 },
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
    stab: true, // v4.9.0: detuned chord hits on the downbeats
    padCutoff: 1000,
    vols: { pad: 0.055, arp: 0.06, bass: 0.15, perc: 0.8, stab: 0.05 },
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
    stab: true, // v4.9.0: detuned chord hits on the downbeats
    padCutoff: 950,
    vols: { pad: 0.05, arp: 0.06, bass: 0.16, perc: 0.85, stab: 0.055 },
  },
  // ── CROSSOVER 2: When Johnny Comes Marching Home — 132 BPM cello-metal arrangement ──
  'johnny-march': {
    id: 'johnny-march', title: 'Johnny Marching Home (Cello-Metal)', bpm: 132, bars: 32, seed: 7,
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
      // v4.14.0: SYMPHONIC CELLO-METAL — the driving march motif on a
      // staccato 3-osc detuned saw + sine sub (was a gritty square),
      // woody resonant lowpass, tight bowing ADSR, delay + reverb sends.
      wave: 'sawtooth', detunes: [-10, 0, 10], sub: true,
      lp: 2400, q: 1.1, glide: false, vol: 0.085,
      adsr: { a: 0.004, d: 0.1, s: 0.4, r: 0.08 },
    },
    harmony: {
      motif: JOHNNY_HARMONY, loop: 128,
      // the classic march third-below, now a detuned-saw cello voice
      // (two-part military doubling, chords + melody at the same time).
      wave: 'sawtooth', detunes: [-8, 0, 8], lp: 1600, vol: 0.05,
      adsr: { a: 0.005, d: 0.1, s: 0.4, r: 0.09 },
    },
    bass: 'march', // distorted 8th-note pulses
    perc: {
      kick: [0, 4, 8, 12], snare: [4, 12],
      hat: [0, 2, 4, 6, 8, 10, 12, 14], ghostSnare: [2, 6, 10, 14],
    },
    stab: true, // v4.14.0: heavy detuned chord hits (downbeat + "and" of 3)
    sweeps: [6], // high-tension 2-bar build into the loop restart
    padCutoff: 800,
    vols: { pad: 0.055, arp: 0, bass: 0.16, perc: 0.9, stab: 0.055 },
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
    stab: true, // v4.9.0: detuned chord hits on the downbeats
    padCutoff: 1200,
    vols: { pad: 0.05, arp: 0.07, bass: 0.17, perc: 1, stab: 0.06 },
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
    arps: null,
    lead: {
      motif: OVERDRIVE_LEAD, loop: 128,
      // v4.15.0: the gallop lead riff — staccato detuned saw + sine sub,
      // tight lowpass, no glide (the power-metal bite).
      wave: 'sawtooth', detunes: [-12, 0, 12], sub: true,
      lp: 3200, q: 1.0, glide: false, vol: 0.085,
      adsr: { a: 0.004, d: 0.1, s: 0.5, r: 0.08 },
    },
    bass: 'eighth', // v4.15.0: 8th-note detuned pulses (was 16th)
    perc: { kick: [0, 3, 4, 8, 11, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] }, // v4.15.0: gallop
    stab: true,
    padCutoff: 1000,
    vols: { pad: 0.045, arp: 0, bass: 0.18, perc: 1, stab: 0.06 },
  },
  'boss-redline': {
    id: 'boss-redline', title: 'Redline', bpm: 150, bars: 32, seed: 13,
    chords: [
      [47, 50, 54], // Bm
      [43, 47, 50], // G#m
      [44, 47, 51], // E
      [45, 49, 52], // A
      [47, 50, 54], // Bm
      [43, 47, 50], // G#m
      [45, 49, 52], // A
      [42, 46, 49], // F# (V — the redline tension)
    ],
    arps: [
      [0, 1, 2, 1, 0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1],
      [2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 2, 1, 0, 1, 0, 1],
      [0, 2, 1, 0, 2, 1, 0, 2, 1, 2, 1, 0, 2, 1, 2, 0],
    ],
    bass: 'march', // v4.15.0: distorted 8th pulses + semitone approach (was 16th)
    perc: { kick: [0, 7, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] }, // v4.15.0: breakbeat
    stab: true,
    sweeps: [6], // v4.15.0: 2-bar tension sweep into the final bar
    padCutoff: 900,
    vols: { pad: 0.05, arp: 0.08, bass: 0.17, perc: 1, stab: 0.06 },
  },
};

// ─── v4.6.0: per-mode song queues (the rotation order) ───
// v4.14.0: the open queue OPENS with the intro overture — the game's
// primary opening theme (MusicScheduler.start() picks the first entry);
// the Für Elise cello-metal crossover still rides the open rotation.
export const PLAYLISTS = {
  open: ['intro-overture', 'fur-elise', 'open-drift', 'open-nebula', 'open-aurora'],
  combat: ['combat-engage', 'fur-elise', 'combat-vanguard', 'johnny-march'],
  boneyard: ['boneyard-crypt', 'johnny-march', 'boneyard-mire', 'boneyard-relic'],
  boss: ['boss-eridath', 'boss-overdrive', 'boss-redline'],
};

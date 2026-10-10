// Filename: tools/midi-import.mjs
// Kitty Vs Everything — v4.19.0
// MIDI → MusicPlaylists.js converter (the v4.19.0 album import pipeline).
//
// The v4.19.0 soundtrack album is NOT procedural: every track is the exact
// note sequence parsed from the local .mid files in C:\Dev\AI-GAMES\.assets
// (15 tracks — Tool, Metallica, Pantera, Beethoven, Faltermeyer,
// Eastwood, traditional, Ziering, Eiffel 65, Ozzy Osbourne, Black Sabbath).
// This tool:
//   1. parses each SMF (type 0/1/2) with a ZERO-DEPENDENCY native parser
//      (no @tonejs/midi — the single-file build must stay dependency-free),
//   2. converts notes to the scheduler's 32nd-note grid (t = 32nd index,
//      d = length in 32nds, v = velocity 0..1),
//   3. classifies each MIDI channel into the SynthVoice.js voice slots
//      (lead / bass / arp / pad / drums) — GM percussion map for ch 10,
//      pitch-range heuristics for the melodic channels, per-track
//      overrides below,
//   4. regenerates js/core/audio/MusicPlaylists.js (SONGS +
//      TRACK_MIX_SETTINGS + PLAYLISTS) as clean embedded JS data — the
//      100% single-file portable HTML output stays intact.
//
// v4.19.0: per-track mix — each TRACKS entry may carry a
// `mix: { gainLead, gainBass, gainDrums }` object (defaults 1.0); the
// writer emits it as the exported TRACK_MIX_SETTINGS table in
// MusicPlaylists.js, which the MusicScheduler multiplies into the
// event-path layer gains (boost quiet leads, lower loud drums, per song).
//
// Usage:
//   node tools/midi-import.mjs --report   // parse + per-channel report
//   node tools/midi-import.mjs --write    // regenerate MusicPlaylists.js
//
// Event data format (MusicPlaylists.js SONGS[id].events):
//   lead/bass/arp/pad: [[t, midiNote, dur32nds, vel01], ...]
//   drums:             [[t, kind, vel01], ...]  kind: 0 kick, 1 snare,
//                                                  2 closed hat, 3 open hat

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.resolve(ROOT, '..', '.assets');
const OUT = path.join(ROOT, 'js', 'core', 'audio', 'MusicPlaylists.js');

// ═══════════════════════════════════════════════════════════
//  SMF parser (native, zero dependencies)
// ═══════════════════════════════════════════════════════════

/** Variable-length quantity. Returns [value, nextIndex]. */
function readVLQ(buf, i) {
  let v = 0;
  for (;;) {
    const b = buf[i++];
    v = (v << 7) | (b & 0x7f);
    if (!(b & 0x80)) return [v, i];
  }
}

/**
 * Parse a Standard MIDI File. Returns
 * { format, division, tracks: [{ name, events }] } where events are
 * { tick, kind: 'tempo'|'timesig'|'name'|'on'|'off'|'pc', ... }.
 */
export function parseMidi(buf) {
  if (buf.length < 14 || buf.toString('ascii', 0, 4) !== 'MThd') {
    throw new Error('not a MIDI file (missing MThd header)');
  }
  const hlen = buf.readUInt32BE(4);
  const format = buf.readUInt16BE(8);
  const ntrks = buf.readUInt16BE(10);
  const division = buf.readUInt16BE(12);
  if (division & 0x8000) throw new Error('unsupported tempo-meta division');
  let pos = 8 + hlen;
  const tracks = [];
  for (let t = 0; t < ntrks; t++) {
    if (buf.toString('ascii', pos, pos + 4) !== 'MTrk') throw new Error('missing MTrk #' + t);
    const len = buf.readUInt32BE(pos + 4);
    pos += 8;
    const end = pos + len;
    const events = [];
    let tick = 0;
    let running = null;
    while (pos < end) {
      tick += readVLQ(buf, pos)[0];
      pos = readVLQ(buf, pos)[1];
      let status = buf[pos];
      if (status < 0x80) {
        if (running === null) throw new Error('running status without status byte');
        pos += 1;
        status = running;
      } else {
        pos += 1;
        running = status;
      }
      const type = status >> 4;
      const ch = status & 0x0f;
      if (status === 0xff) {
        const mt = buf[pos++];
        const [ml, np] = readVLQ(buf, pos);
        pos = np;
        const payload = buf.subarray(pos, pos + ml);
        pos += ml;
        if (mt === 0x51 && ml === 3) {
          events.push({ tick, kind: 'tempo', us: (payload[0] << 16) | (payload[1] << 8) | payload[2] });
        } else if (mt === 0x58 && ml === 4) {
          events.push({ tick, kind: 'timesig', num: payload[0], denPow: payload[1] });
        } else if (mt === 0x03) {
          events.push({ tick, kind: 'name', text: payload.toString('latin1') });
        }
      } else if (status === 0xf0 || status === 0xf7) {
        const [ml] = readVLQ(buf, pos);
        pos += ml;
      } else {
        const nData = (type === 0xc || type === 0xd) ? 1 : 2;
        const d1 = buf[pos++];
        const d2 = nData === 2 ? buf[pos++] : 0;
        if (type === 0x9 && d2 > 0) events.push({ tick, kind: 'on', ch, note: d1, vel: d2 });
        else if (type === 0x9 && d2 === 0) events.push({ tick, kind: 'off', ch, note: d1, vel: 0 });
        else if (type === 0x8) events.push({ tick, kind: 'off', ch, note: d1, vel: d2 });
        else if (type === 0xc) events.push({ tick, kind: 'pc', ch, prog: d1 });
      }
    }
    pos = end;
    tracks.push({ name: (events.find((e) => e.kind === 'name') || {}).text || '', events });
  }
  return { format, division, tracks };
}

/**
 * Flatten the tracks into a global timeline. Returns
 * { notes: [{ch, note, vel, on, off}], tempoMap: [{tick, us}], division,
 *   lastTick, names: [] }.
 */
export function extractNotes(midi) {
  const all = [];
  const names = [];
  for (const tr of midi.tracks) {
    for (const e of tr.events) all.push(e);
    if (tr.name) names.push(tr.name);
  }
  all.sort((a, b) => a.tick - b.tick || (a.kind === 'off' ? 1 : -1));
  const tempoMap = [];
  const notes = [];
  const open = new Map();
  for (const e of all) {
    if (e.kind === 'tempo') {
      tempoMap.push({ tick: e.tick, us: e.us });
    } else if (e.kind === 'on') {
      open.set(e.ch * 128 + e.note, e);
    } else if (e.kind === 'off') {
      const k = e.ch * 128 + e.note;
      const on = open.get(k);
      if (on) {
        open.delete(k);
        notes.push({ ch: e.ch, note: e.note, vel: on.vel, on: on.tick, off: e.tick });
      }
    }
  }
  const lastTick = all.length ? all[all.length - 1].tick : 0;
  for (const [k, on] of open) {
    notes.push({ ch: Math.floor(k / 128), note: k % 128, vel: on.vel, on: on.tick, off: Math.max(on.tick + midi.division, lastTick) });
  }
  if (!tempoMap.length) tempoMap.push({ tick: 0, us: 500000 });
  tempoMap.sort((a, b) => a.tick - b.tick);
  return { notes, tempoMap, division: midi.division, lastTick, names };
}

/**
 * Dominant tempo of the map (the segment covering the most ticks) → BPM.
 * The scheduler plays one constant BPM per song, so a file with tempo
 * changes is quantized to its dominant tempo.
 */
export function dominantBpm(ex) {
  let best = null;
  for (let i = 0; i < ex.tempoMap.length; i++) {
    const endTick = i + 1 < ex.tempoMap.length ? ex.tempoMap[i + 1].tick : ex.lastTick;
    const span = Math.max(0, endTick - ex.tempoMap[i].tick);
    if (!best || span > best.span) best = { us: ex.tempoMap[i].us, span };
  }
  return Math.round(60e6 / best.us);
}

// ═══════════════════════════════════════════════════════════
//  Channel classification → SynthVoice.js voice slots
// ═══════════════════════════════════════════════════════════

/** GM percussion map → scheduler drum kinds (0 kick, 1 snare, 2 hat, 3 open). */
const DRUM_MAP = {
  kick: new Set([35, 36]),
  snare: new Set([37, 38, 39, 40]),
  hatC: new Set([41, 49]),
  hatO: new Set([42, 47, 50, 51, 52, 59, 62, 65, 96, 99]),
  tom: new Set([43, 45, 48, 60, 61, 63, 64, 82, 83, 85, 86, 91, 92, 93, 94, 95, 97, 98]),
  crash: new Set([46, 53, 56]),
};
export function drumKind(note) {
  if (DRUM_MAP.kick.has(note)) return 0;
  if (DRUM_MAP.snare.has(note)) return 1;
  if (DRUM_MAP.hatC.has(note)) return 2;
  if (DRUM_MAP.hatO.has(note) || DRUM_MAP.crash.has(note)) return 3;
  if (DRUM_MAP.tom.has(note)) return 1; // toms read as snare body
  return 2; // fallback: ride/bell/cowbell → hat
}

/** Per-channel statistics (pitch range, density, polyphony, duration). */
export function channelStats(notes) {
  const byCh = new Map();
  for (const n of notes) {
    let s = byCh.get(n.ch);
    if (!s) {
      s = { ch: n.ch, n: 0, sum: 0, min: 127, max: 0, durSum: 0, maxPoly: 0 };
      byCh.set(n.ch, s);
    }
    s.n += 1;
    s.sum += n.note;
    s.min = Math.min(s.min, n.note);
    s.max = Math.max(s.max, n.note);
    s.durSum += n.off - n.on;
  }
  for (const s of byCh.values()) {
    const ev = [];
    for (const n of notes) {
      if (n.ch !== s.ch) continue;
      ev.push([n.on, 1]);
      ev.push([n.off, -1]);
    }
    ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let cur = 0;
    for (const [, d] of ev) { cur += d; s.maxPoly = Math.max(s.maxPoly, cur); }
    s.avg = s.sum / s.n;
    s.avgDur = s.durSum / s.n;
  }
  return [...byCh.values()].sort((a, b) => a.ch - b.ch);
}

/**
 * Auto-classify the melodic channels:
 *   bass = lowest average pitch (< G3), lead = highest average pitch,
 *   pad  = densest long-note channel, arp  = everything else.
 */
export function classifyAuto(stats) {
  const melodic = stats.filter((s) => s.ch !== 9);
  if (!melodic.length) return { bass: [], lead: [], pad: [], arp: [] };
  const bassC = melodic.filter((s) => s.avg < 52).sort((a, b) => a.avg - b.avg)[0] || null;
  const rest = melodic.filter((s) => s !== bassC);
  const leadC = rest.length ? [...rest].sort((a, b) => b.avg - a.avg)[0] : null;
  const rest2 = rest.filter((s) => s !== leadC);
  const padC = rest2.length
    ? [...rest2].sort((a, b) => b.maxPoly * b.avgDur - a.maxPoly * a.avgDur)[0]
    : null;
  const arpC = rest2.filter((s) => s !== padC);
  return {
    bass: bassC ? [bassC.ch] : [],
    lead: leadC ? [leadC.ch] : [],
    pad: padC ? [padC.ch] : [],
    arp: arpC.map((s) => s.ch),
  };
}

// ═══════════════════════════════════════════════════════════
//  Track lineup + voice profiles (SynthVoice.js mapping)
// ═══════════════════════════════════════════════════════════

// Voice profiles: the MIDI note sequences are rendered through the
// standard SynthVoice.js cello/distorted-synth voices (makeVoice /
// makeChord) — per-genre lead + bass profiles, drums through the
// kick/snare/hat percussion voices.
const PROFILES = {
  metal: {
    lead: { wave: 'sawtooth', detunes: [-10, 0, 10], sub: true, lp: 3000, q: 1.0, glide: false, vol: 0.11, adsr: { a: 0.004, d: 0.1, s: 0.55, r: 0.09 } },
    bass: { soft: false, lp: 450, q: 1.2, detunes: [-6, 6], sub: true, adsr: { a: 0.005, d: 0.09, s: 0.8, r: 0.07 } },
    vols: { pad: 0.05, arp: 0.055, lead: 0.11, bass: 0.15, perc: 0.6 },
    padCutoff: 1000,
  },
  ballad: {
    lead: { wave: 'sawtooth', detunes: [-8, 0, 8], sub: true, lp: 2600, q: 1.0, glide: true, vol: 0.1, adsr: { a: 0.01, d: 0.12, s: 0.6, r: 0.12 } },
    bass: { soft: true, lp: 900, q: 0.6, detunes: [0], sub: false, adsr: { a: 0.02, d: 0.15, s: 0.85, r: 0.25 } },
    vols: { pad: 0.09, arp: 0.05, lead: 0.1, bass: 0.12, perc: 0.45 },
    padCutoff: 1300,
  },
  classical: {
    lead: { wave: 'triangle', detunes: [-6, 6], sub: false, lp: 3800, q: 0.8, glide: true, vol: 0.09, adsr: { a: 0.008, d: 0.1, s: 0.5, r: 0.1 } },
    bass: { soft: true, lp: 900, q: 0.6, detunes: [0], sub: false, adsr: { a: 0.02, d: 0.15, s: 0.85, r: 0.25 } },
    vols: { pad: 0.07, arp: 0.05, lead: 0.09, bass: 0.1, perc: 0.5 },
    padCutoff: 1500,
  },
  march: {
    lead: { wave: 'square', detunes: [-7, 7], sub: true, lp: 2800, q: 0.9, glide: false, vol: 0.1, adsr: { a: 0.005, d: 0.09, s: 0.6, r: 0.08 } },
    bass: { soft: false, lp: 420, q: 1.3, detunes: [-6, 6], sub: true, adsr: { a: 0.005, d: 0.09, s: 0.8, r: 0.07 } },
    vols: { pad: 0.07, arp: 0.06, lead: 0.1, bass: 0.15, perc: 0.6 },
    padCutoff: 1100,
  },
  // v4.16.0: 80s synth-pop (Axel F) — clean detuned-saw pluck lead (no sub),
  // warm smooth bass, moderate 4-on-the-floor drums. The track is a synth
  // instrumental, NOT metal — the old metal profile (distorted bass + harsh
  // saw + loud drums) made it sound wrong.
  synth: {
    lead: { wave: 'sawtooth', detunes: [-8, 0, 8], sub: false, lp: 3500, q: 0.8, glide: false, vol: 0.11, adsr: { a: 0.005, d: 0.12, s: 0.6, r: 0.1 } },
    bass: { soft: false, lp: 600, q: 0.8, detunes: [-4, 4], sub: true, adsr: { a: 0.005, d: 0.1, s: 0.7, r: 0.08 } },
    vols: { pad: 0.06, arp: 0.05, lead: 0.11, bass: 0.14, perc: 0.55 },
    padCutoff: 1400,
  },
  // v4.16.0: piano (Für Elise / No Quarter) — bright pluck-like lead with a
  // fast decay (piano notes ring out and fade), warm sine bass, soft drums.
  piano: {
    lead: { wave: 'triangle', detunes: [0, 4], sub: false, lp: 5000, q: 0.5, glide: false, vol: 0.13, adsr: { a: 0.003, d: 0.35, s: 0.25, r: 0.35 } },
    bass: { soft: true, lp: 800, q: 0.5, detunes: [0], sub: false, adsr: { a: 0.005, d: 0.2, s: 0.5, r: 0.2 } },
    vols: { pad: 0.08, arp: 0.06, lead: 0.13, bass: 0.1, perc: 0.3 },
    padCutoff: 1800,
  },
};

// The v4.16.0 lineup — file → song id / title / artist / genre / channel
// overrides (null = auto-classify; { lead:[], bass:[], pad:[], arp:[] }
// pins channels; splitAt: pitch-split one channel into melody + low end).
export const TRACKS = [
  { file: 'Metallica - Nothing Else Matters.mid', id: 'metallica-nem', title: 'Nothing Else Matters', artist: 'Metallica', genre: 'ballad' },
  // v4.16.0: the piano (ch0, 1400+ polyphonic notes) is the MAIN body of the
  // piece — pin it to the lead voice. The violin / music box / xylophone
  // (ch1–3) are short melodic accents → arp. (Auto-classify sent the piano
  // to the quiet pad slot and made a 48-note music box the "lead".)
  { file: 'Requiem for a Dream 3.mid', id: 'requiem-dream', title: 'Requiem for a Dream', artist: 'Clint Eastwood', genre: 'ballad', chMap: { lead: [0], arp: [1, 2, 3] } },
  // v4.16.0: 80s synth-pop, NOT metal — the new 'synth' profile (clean
  // detuned-saw pluck lead, smooth bass, moderate drums). Auto-classify
  // already routes ch2 (the synth-pluck riff) → lead, ch3 (bass line) →
  // bass, ch0 (electric-piano chords) → pad, ch1 (wide synth figure) → arp.
  { file: 'Axel - F.mid', id: 'axel-f', title: 'Axel F', artist: 'Harold Faltermeyer', genre: 'synth' },
  // Für Elise is a single piano channel — the melody and the left-hand
  // arpeggio overlap in pitch (A4/C5 belong to both), so a pitch split
  // would tear the melody apart: ALL notes ride the lead voice (the
  // polyphonic makeVoice renders the two-hand texture faithfully).
  // v4.16.0: the 'piano' profile (bright pluck-like lead, fast decay)
  // replaces the old soft 'classical' triangle.
  { file: 'Für Elise.mid', id: 'fur-elise', title: 'Für Elise', artist: 'Beethoven', genre: 'piano', chMap: { lead: [0] } },
  // v4.16.0: the trombone (ch0) plays the march MELODY — pin it to lead.
  // ch1 + ch4 are the bass line, ch2 (fast figure) + ch3 (violin
  // countermelody) are arp. (Auto-classify made the trombone a quiet pad
  // and the violin the "lead".)
  { file: 'When Johnny Comes Marching Home.mid', id: 'johnny-march', title: 'When Johnny Comes Marching Home', artist: 'Traditional', genre: 'march', chMap: { lead: [0], bass: [1, 4], arp: [2, 3] } },
  { file: 'Forty Six & 2 - Tool.mid', id: 'tool-forty-six', title: 'Forty Six & 2', artist: 'Tool', genre: 'metal' },
  // v4.16.0: the MIDI is the dramatic piano intro — the 'piano' profile
  // (not the metal sawtooth) renders it faithfully.
  { file: 'TOOL_ No Quarter.mid', id: 'tool-no-quarter', title: 'No Quarter', artist: 'Tool', genre: 'piano' },
  { file: 'Cowboys From HELL.mid', id: 'pantera-cowboys', title: 'Cowboys From Hell', artist: 'Pantera', genre: 'metal' },
  // v4.16.0: the distorted rhythm guitar (ch0) is the main body of the
  // song — pin it to lead. ch1 (acoustic) + ch2 (lead guitar) are arp,
  // ch3 is the bass line. (Auto-classify made the rhythm guitar a quiet
  // pad and a 21-note channel the "lead".)
  { file: 'Metallica - Harvester of Sorrow.mid', id: 'metallica-harvester', title: 'Harvester of Sorrow', artist: 'Metallica', genre: 'metal', chMap: { lead: [0], arp: [1, 2], bass: [3] } },
  { file: 'The Unforgiven - Metallica.mid', id: 'metallica-unforgiven', title: 'The Unforgiven', artist: 'Metallica', genre: 'metal' },
  { file: 'Tool- Pneuma.mid', id: 'tool-pneuma', title: 'Pneuma', artist: 'Tool', genre: 'metal' },
  // v4.17.0: Classical Gas (Mose Ziering) — a single-channel grand-piano
  // arrangement of the famous fingerpicked guitar piece. The melody and the
  // fast arpeggiated left-hand figure overlap in pitch, so (like Für Elise)
  // ALL notes ride the polyphonic lead voice; the 'piano' profile (bright
  // pluck-like lead, fast decay) keeps the 16th-note arpeggio crisp.
  { file: 'Classical Gas.mid.mid', id: 'classical-gas', title: 'Classical Gas', artist: 'Mose Ziering', genre: 'piano', chMap: { lead: [0] } },
  // v4.17.0: Eiffel 65 — Blue (Da Ba Dee) — a single-channel piano
  // arrangement of the Eurodance hook (the "da ba dee" lead melody + the
  // horn-stab chord hits). ALL notes ride the polyphonic lead voice; the
  // 'synth' profile (clean detuned-saw pluck) gives the hook its Eurodance
  // lead sound (NOT the metal saw — this is dance, not riffs).
  { file: 'Eiffel 65 - Blue (Da Ba Dee).mid', id: 'eiffel65-blue', title: 'Blue (Da Ba Dee)', artist: 'Eiffel 65', genre: 'synth', chMap: { lead: [0] } },
  // v4.19.0: Ozzy Osbourne — Crazy Train (intro riff, acoustic cover) —
  // the classic galloping E-minor riff as a single-channel acoustic
  // arrangement (80 notes, E2–B3, 9 bars). ALL notes ride the
  // polyphonic lead voice (like the other single-channel arrangements);
  // the 'metal' profile gives the gallop its driving distorted-saw body.
  // The per-track mix boost (gainLead 1.15) lifts the quiet solo-guitar
  // lead so it sits on top of the session bus.
  { file: 'ozzy osbourne - crazy train intro riff acoustic cover.mid', id: 'ozzy-crazy-train', title: 'Crazy Train (Intro Riff)', artist: 'Ozzy Osbourne', genre: 'metal', chMap: { lead: [0] }, mix: { gainLead: 1.15, gainBass: 1, gainDrums: 1 } },
  // v4.19.0: Black Sabbath — Children Of The Grave — the classic heavy
  // metal anthem (153 bars @ 138 bpm). ch0 (electric guitar, the
  // power-chord rhythm) + ch2 (the vocal melody) ride the lead bus
  // (riff + melody = the main body of the song, like Harvester), ch1 is
  // the bass line, ch9 the drums (GM map). The dense 1840-hit drum track
  // gets lowered with gainDrums 0.8 so the riff + melody stay on top.
  { file: 'Black Sabbath - Children Of The Grave.mid', id: 'black-sabbath-cotg', title: 'Children Of The Grave', artist: 'Black Sabbath', genre: 'metal', chMap: { lead: [0, 2], bass: [1] }, mix: { gainLead: 1, gainBass: 1, gainDrums: 0.8 } },
];

// The per-mode rotation queues (v4.19.0). Nothing Else Matters is the main
// intro sequence — MusicScheduler.start() picks PLAYLISTS.open[0].
// v4.17.0: Classical Gas rides the two mellow queues (open + boneyard, the
// fingerpicked arpeggio as the atmospheric breath); Eiffel 65 — Blue joins
// the high-energy combat queue (the Eurodance hook alongside the riffs).
// v4.19.0: Crazy Train (intro riff) joins the high-energy combat queue
// (the 31-second galloping riff loop); Children Of The Grave (the 4.4-min
// heavy metal anthem) joins the boss queue (a full-length battle track).
export const PLAYLISTS = {
  open: ['metallica-nem', 'fur-elise', 'axel-f', 'johnny-march', 'classical-gas'],
  combat: ['tool-forty-six', 'johnny-march', 'metallica-unforgiven', 'pantera-cowboys', 'eiffel65-blue', 'ozzy-crazy-train'],
  boneyard: ['requiem-dream', 'fur-elise', 'metallica-harvester', 'classical-gas'],
  boss: ['tool-no-quarter', 'tool-pneuma', 'metallica-harvester', 'pantera-cowboys', 'black-sabbath-cotg'],
};

// ═══════════════════════════════════════════════════════════
//  Conversion: MIDI notes → scheduler event data (32nd grid)
// ═══════════════════════════════════════════════════════════

const r2 = (x) => Math.round(x * 100) / 100;

/**
 * Convert one track's notes into the event layers.
 * t/d are 32nd-note units (the v4.16.0 scheduler grid), v = vel/127.
 */
export function convertTrack(ex, tr) {
  const per32 = ex.division / 8; // ticks per 32nd note
  const to32 = (tick) => Math.round(tick / per32);
  const layers = { lead: [], bass: [], arp: [], pad: [], drums: [] };
  const stats = channelStats(ex.notes);
  const map = buildChMap(tr.chMap || classifyAuto(stats));
  for (const n of ex.notes) {
    const t = to32(n.on);
    // Zero-length MIDI trigger notes (common in arranged exports) get a
    // default 16th of duration so they read as short staccato hits.
    const rawD = to32(n.off) - t;
    const d = rawD > 0 ? rawD : 2;
    const v = r2(n.vel / 127);
    if (n.ch === 9) {
      layers.drums.push([t, drumKind(n.note), v]);
      continue;
    }
    const slot = map.ch[n.ch];
    if (!slot) continue;
    layers[slot].push([t, n.note, d, v]);
  }
  // Sort (MIDI files can carry out-of-order / doubled notes).
  for (const k of Object.keys(layers)) {
    layers[k].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  let lastT = 0;
  for (const k of Object.keys(layers)) {
    for (const e of layers[k]) lastT = Math.max(lastT, e[0] + (e.length > 3 ? e[2] : 0));
  }
  const bars = Math.max(4, Math.ceil(lastT / 32) + 1);
  return { layers, bars, bpm: dominantBpm(ex), stats, map };
}

/** { bass:[chs], lead:[chs], pad:[chs], arp:[chs] } → per-channel slot map. */
function buildChMap(c) {
  const ch = {};
  for (const slot of ['bass', 'lead', 'pad', 'arp']) {
    for (const c2 of c[slot] || []) ch[c2] = slot;
  }
  return { ch };
}

// ═══════════════════════════════════════════════════════════
//  Report
// ═══════════════════════════════════════════════════════════

function report() {
  let totalNotes = 0;
  for (const tr of TRACKS) {
    const p = path.join(ASSETS, tr.file);
    if (!fs.existsSync(p)) {
      console.log(`\n✗ ${tr.file} — MISSING`);
      continue;
    }
    const midi = parseMidi(fs.readFileSync(p));
    const ex = extractNotes(midi);
    const conv = convertTrack(ex, tr);
    totalNotes += ex.notes.length;
    const durSec = conv.bars * 4 * 60 / conv.bpm;
    console.log(`\n══ ${tr.title} (${tr.artist}) — ${tr.file}`);
    console.log(`   division=${midi.division} format=${midi.format} notes=${ex.notes.length} bpm=${conv.bpm} bars=${conv.bars} (~${durSec.toFixed(0)} s)`);
    console.log(`   tempoMap: ${ex.tempoMap.map((t) => `${Math.round(60e6 / t.us)}bpm@${t.tick}`).join(' → ')}`);
    if (ex.names.length) console.log(`   names: ${ex.names.join(' | ')}`);
    for (const s of conv.stats) {
      const role = s.ch === 9 ? 'DRUMS' : (conv.map.ch[s.ch] || 'unused');
      console.log(`   ch${s.ch}: n=${s.n} pitch=${s.min}–${s.max} avg=${s.avg.toFixed(1)} poly=${s.maxPoly} avgDur=${(s.avgDur / (midi.division / 4)).toFixed(2)} 16ths  role=${role}`);
    }
    for (const k of ['lead', 'bass', 'arp', 'pad', 'drums']) {
      console.log(`   events.${k}: ${conv.layers[k].length}`);
    }
  }
  console.log(`\nTOTAL notes: ${totalNotes}`);
}

// ═══════════════════════════════════════════════════════════
//  Writer — regenerate MusicPlaylists.js
// ═══════════════════════════════════════════════════════════

function fmtEvents(evs, perLine = 10) {
  if (!evs.length) return '[]';
  const lines = [];
  for (let i = 0; i < evs.length; i += perLine) {
    lines.push('      ' + evs.slice(i, i + perLine).map((e) => '[' + e.join(',') + ']').join(', '));
  }
  return '[\n' + lines.join(',\n') + ',\n    ]';
}

/** Compact JS object/array literal (single-quoted strings). */
function jsfmt(v) {
  if (Array.isArray(v)) return '[' + v.map(jsfmt).join(', ') + ']';
  if (v && typeof v === 'object') {
    return '{ ' + Object.entries(v).map(([k, val]) => `${k}: ${jsfmt(val)}`).join(', ') + ' }';
  }
  if (typeof v === 'string') return `'${v}'`;
  return String(v);
}

function write() {
  const songs = [];
  for (let ti = 0; ti < TRACKS.length; ti++) {
    const tr = TRACKS[ti];
    const p = path.join(ASSETS, tr.file);
    if (!fs.existsSync(p)) throw new Error('missing MIDI: ' + tr.file);
    const midi = parseMidi(fs.readFileSync(p));
    const ex = extractNotes(midi);
    const conv = convertTrack(ex, tr);
    const prof = PROFILES[tr.genre];
    const L = [];
    L.push(`  '${tr.id}': {`);
    L.push(`    id: '${tr.id}', title: '${tr.title}', artist: '${tr.artist}',`);
    L.push(`    bpm: ${conv.bpm}, bars: ${conv.bars}, seed: ${ti + 1},`);
    L.push(`    lead: ${jsfmt(prof.lead)},`);
    L.push(`    bass: ${jsfmt(prof.bass)},`);
    L.push(`    padCutoff: ${prof.padCutoff},`);
    L.push(`    vols: ${jsfmt(prof.vols)},`);
    L.push(`    events: {`);
    L.push(`      lead: ${fmtEvents(conv.layers.lead)},`);
    L.push(`      bass: ${fmtEvents(conv.layers.bass)},`);
    L.push(`      arp: ${fmtEvents(conv.layers.arp)},`);
    L.push(`      pad: ${fmtEvents(conv.layers.pad)},`);
    L.push(`      drums: ${fmtEvents(conv.layers.drums)},`);
    L.push(`    },`);
    L.push('  },');
    songs.push(L.join('\n'));
  }
  const playlists = Object.entries(PLAYLISTS)
    .map(([m, l]) => `  ${m}: [${l.map((s) => `'${s}'`).join(', ')}],`)
    .join('\n');
  // v4.19.0: per-track mix settings — one entry per song (every track gets
  // an entry, defaults 1.0), so channel gains can be tweaked per song in
  // the generated file without touching the genre profiles.
  const mixes = TRACKS
    .map((tr) => {
      const m = { gainLead: 1, gainBass: 1, gainDrums: 1, ...(tr.mix || {}) };
      return `  '${tr.id}': ${jsfmt(m)},`;
    })
    .join('\n');
  const out = `// Filename: core/audio/MusicPlaylists.js
// Kitty Vs Everything — v4.19.0
// v4.19.0: CLASSIC HEAVY METAL EXPANSION + PER-TRACK MIX — the SONGS album
//          grows 13 → 15 tracks: + Ozzy Osbourne — Crazy Train (intro riff,
//          the galloping E-minor lead riff as a single-channel acoustic
//          arrangement — combat queue) + Black Sabbath — Children Of The
//          Grave (the full heavy metal anthem: power-chord rhythm + vocal
//          melody on the lead voice, bass line, GM drums — boss queue).
//          NEW: TRACK_MIX_SETTINGS — a per-song mix table (gainLead /
//          gainBass / gainDrums scalars, one entry per track, defaults
//          1.0) that the MusicScheduler multiplies into the event-path
//          layer gains, so quiet lead melodies can be boosted or
//          overpowering percussion channels lowered per song without
//          touching the genre profiles.
// v4.17.0: MIDI ALBUM EXPANSION — the v4.16.0 MIDI album (Nothing Else
//          Matters — the main intro sequence — first in the open queue,
//          Forty Six & 2 / No Quarter / Pneuma (Tool), Harvester of Sorrow
//          / The Unforgiven (Metallica), Cowboys From Hell (Pantera),
//          Axel F (Faltermeyer), Für Elise (Beethoven), When Johnny Comes
//          Marching Home (traditional), Requiem for a Dream (Eastwood)) +
//          Classical Gas (Mose Ziering — the fingerpicked-arpeggio piano
//          arrangement, open + boneyard queues) + Eiffel 65 — Blue (Da Ba
//          Dee) (the Eurodance lead hook + horn-stab chord hits, combat
//          queue). Every track is the exact note sequence parsed from the
//          local .mid files (tools/midi-import.mjs, zero-dependency SMF
//          parser); every MIDI channel is mapped to a SynthVoice.js voice
//          slot (lead / bass / arp / pad / drums) and every note rides the
//          scheduler's 32nd-note grid (events: [t, midiNote, dur32nds,
//          vel01]; drums: [t, kind, vel01] with kind 0 kick / 1 snare /
//          2 closed hat / 3 open hat). All procedural placeholder tracks
//          are gone — the data below is generated; re-run \`node
//          tools/midi-import.mjs --write\` after touching the .mid files.
export const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Seeded PRNG (kept for the scheduler's per-phrase variation helper).
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

// ─── v4.16.0: the MIDI album — exact parsed note sequences ───
// Each song: bpm (dominant MIDI tempo), bars (full parsed length), lead /
// bass voice profiles (SynthVoice.js makeVoice config), vols (layer gains),
// padCutoff, and events — the parsed note data on the 32nd-note grid.
export const SONGS = {
${songs.join('\n')}
};

// ─── v4.19.0: per-track mix settings (the per-song channel balance) ───
// One entry per song: gainLead / gainBass / gainDrums are scalar
// multipliers (1.0 = the genre profile's vols as-is) that the
// MusicScheduler applies in the MIDI event path — e.g. gainLead > 1
// boosts a quiet lead melody, gainDrums < 1 lowers an overpowering
// percussion channel. Tweak per song here (or in tools/midi-import.mjs
// TRACKS[].mix) and re-run \`node tools/midi-import.mjs --write\`.
export const TRACK_MIX_SETTINGS = {
${mixes}
};

// ─── v4.16.0: per-mode song queues (the rotation order) ───
// Nothing Else Matters opens every mission (MusicScheduler.start() picks
// the first entry of the active mode's queue).
export const PLAYLISTS = {
${playlists}
};
`;
  fs.writeFileSync(OUT, out, 'utf8');
  console.log(`Wrote ${OUT} (${(out.length / 1024).toFixed(1)} KB, ${TRACKS.length} tracks)`);
}

// ═══════════════════════════════════════════════════════════
//  CLI
// ═══════════════════════════════════════════════════════════

const arg = process.argv[2] || '--report';
try {
  if (arg === '--write') write();
  else report();
} catch (e) {
  console.error('midi-import failed:', e.message);
  process.exit(1);
}

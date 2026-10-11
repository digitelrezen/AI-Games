// Filename: tools/midi-import.mjs
// Kitty Vs Everything — v4.26.0
// v4.26.0: TRACK REMOVAL — The Unforgiven (Metallica) is gone from the
//          album: its TRACKS[] entry + comment block and its combat-queue
//          slot are removed (15 → 14 tracks). Re-run `node
//          tools/midi-import.mjs --write` to regenerate MusicPlaylists.js.
// v4.25.0: SOURCE REPLACEMENT — The Unforgiven re-imported from the new
// .mid file (The Unforgiven-New - Metallica.mid, 9 channels, 3820 notes):
// the old 6-channel arrangement (no drums, no bass) is replaced by the
// full band — a real bass line (ch5) + a full GM drum kit (ch9, 32nd-note
// snare-roll intro) join the rhythm guitar (ch0), the melody (ch1), the
// distortion harmony (ch2) and the guitar accents (ch3 first half + ch7
// second half); ch6 is the 3-bar tremolo E-power-chord intro; ch4 (3
// notes) is an unmapped artifact. chMap pinned (lead [1], bass [5], arp
// [0,3,6,7], pad [2]); mix normalized to the Forty Six & 2 reference:
// L2.5/A2.5/P1.5 keep the (identical) melodic channels at their v4.21.0
// reference-matched levels, the new bass 1.0x, the new drums 0.9x.
// v4.23.0: SOURCE REPLACEMENT — Pneuma + Axel F re-imported from the new
// .mid files (Tool - Pneuma (Classic Elec Piano w_ Remix, WIP).mid and
// Axel F (Beverly Hills Cop Theme).mid). Both are now piano arrangements
// (the old full-band metal Pneuma and multi-channel synth-pop Axel F are
// gone); both re-tuned to the 'piano' profile + gainLead 3.0 against the
// Forty Six & 2 reference.
// v4.20.0: AUDIO MIX TUNING — per-track volume/mix pass against the
// Forty Six & 2 reference: quiet leads boosted (Crazy Train 2.6x, Blue
// 2.3x, Fur Elise / No Quarter / Classical Gas / Axel F 2.0x, Cowboys
// 1.7x), drum-dominant tracks tamed (CoTG / Johnny March / Pneuma /
// Requiem / Harvester drums 0.35-0.45x), Harvester bass 0.5x, The
// Unforgiven's "synth" pad 0.25x, Pneuma's rhythm-guitar arp 1.9x.
// TRACKS[].mix grows from 3 to 5 scalars (gainLead / gainBass /
// gainDrums / gainArp / gainPad — the new arp + pad scalars are applied
// in the MusicScheduler event path). Nothing Else Matters moves to the
// 'piano' profile (the ballad saw+sub "gross synth" lead is gone) and
// Children Of The Grave becomes the OPENING track (PLAYLISTS.open[0]).
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
// `mix: { gainLead, gainBass, gainDrums, gainArp, gainPad }` object
// (defaults 1.0; v4.20.0 adds gainArp / gainPad); the writer emits it as
// the exported TRACK_MIX_SETTINGS table in MusicPlaylists.js, which the
// MusicScheduler multiplies into the event-path layer gains (boost quiet
// leads, lower loud drums, duck harsh synth pads, lift rhythm-guitar
// arps — per song).
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
  // v4.20.0: 'piano' profile (was 'ballad') — the ballad profile's
  // detuned-saw+sub lead was the "gross synth" sound; the triangle pluck
  // + soft sine bass render the piano ballad faithfully (like the other
  // piano-profile tracks). The mix boost (gainLead 1.8) lifts the quiet
  // piano to the Forty Six & 2 reference level.
  // v4.21.0: mix — "still ~2x too quiet": lead 3.0x, bass + drums 1.5x.
  { file: 'Metallica - Nothing Else Matters.mid', id: 'metallica-nem', title: 'Nothing Else Matters', artist: 'Metallica', genre: 'piano', mix: { gainLead: 3, gainBass: 1.5, gainDrums: 1.5, gainArp: 1, gainPad: 1 } },
  // v4.16.0: the piano (ch0, 1400+ polyphonic notes) is the MAIN body of the
  // piece — pin it to the lead voice. The violin / music box / xylophone
  // (ch1–3) are short melodic accents → arp. (Auto-classify sent the piano
  // to the quiet pad slot and made a 48-note music box the "lead".)
  // v4.20.0: mix — the 1176-hit drum track is "way over the top": 0.4x,
  // the quiet piano lead 1.7x (Forty Six & 2 reference level).
  // v4.21.0: mix — "still ~2x too quiet": piano lead 3.0x, the violin /
  // music-box arp 2.0x, drums 0.8x.
  { file: 'Requiem for a Dream 3.mid', id: 'requiem-dream', title: 'Requiem for a Dream', artist: 'Clint Eastwood', genre: 'ballad', chMap: { lead: [0], arp: [1, 2, 3] }, mix: { gainLead: 3, gainBass: 1, gainDrums: 0.8, gainArp: 2, gainPad: 1 } },
  // v4.16.0: 80s synth-pop — the 'synth' profile rendered the original
  // multi-channel Faltermeyer arrangement (synth-pluck riff -> lead, bass
  // line -> bass, e-piano chords -> pad, wide synth figure -> arp).
  // v4.22.0: SOURCE REPLACED — now the single-channel "Ragtime Piano"
  // arrangement (Axel F (Beverly Hills Cop Theme).mid, 1036 notes, one
  // piano channel, no drums/bass). The 'piano' profile (bright pluck
  // lead, fast decay) renders it faithfully; ALL notes ride the
  // polyphonic lead voice (like the other piano arrangements). Mix
  // gainLead 3.0 matches the Forty Six & 2 reference (energy 157.6, in
  // the piano-track band: Fur Elise 93.3 / NEM 155.2 / Classical Gas
  // 211.6).
  { file: 'Axel F (Beverly Hills Cop Theme).mid', id: 'axel-f', title: 'Axel F', artist: 'Harold Faltermeyer', genre: 'piano', chMap: { lead: [0] }, mix: { gainLead: 3, gainBass: 1, gainDrums: 1, gainArp: 1, gainPad: 1 } },
  // Für Elise is a single piano channel — the melody and the left-hand
  // arpeggio overlap in pitch (A4/C5 belong to both), so a pitch split
  // would tear the melody apart: ALL notes ride the lead voice (the
  // polyphonic makeVoice renders the two-hand texture faithfully).
  // v4.16.0: the 'piano' profile (bright pluck-like lead, fast decay)
  // replaces the old soft 'classical' triangle.
  // v4.20.0: mix — "just too low": the quiet triangle piano 2.0x.
  // v4.21.0: mix — "still ~2x too quiet": the solo piano 3.5x.
  { file: 'Für Elise.mid', id: 'fur-elise', title: 'Für Elise', artist: 'Beethoven', genre: 'piano', chMap: { lead: [0] }, mix: { gainLead: 3.5, gainBass: 1, gainDrums: 1, gainArp: 1, gainPad: 1 } },
  // v4.16.0: the trombone (ch0) plays the march MELODY — pin it to lead.
  // ch1 + ch4 are the bass line, ch2 (fast figure) + ch3 (violin
  // countermelody) are arp. (Auto-classify made the trombone a quiet pad
  // and the violin the "lead".)
  // v4.20.0: mix — the in-your-face drums (1.49x the melody energy) go to
  // the background (0.35x), the trombone melody 1.6x, the busy arp
  // counter-figures 0.8x.
  // v4.21.0: mix — "the drums ruin it" (still, at 0.35x): drums 0.2x,
  // the trombone melody 3.0x (clearly on top), bass 1.5x.
  // v4.25.0: SOURCE FILE SWAP — re-imported from
  // "When Johnny Comes Marching Home -New.mid": byte-identical to the
  // old file (same 4273 notes / 6 channels / 165 bpm — verified by
  // hash), so the generated event data is unchanged; only the source
  // reference moves to the -New file.
  { file: 'When Johnny Comes Marching Home -New.mid', id: 'johnny-march', title: 'When Johnny Comes Marching Home', artist: 'Traditional', genre: 'march', chMap: { lead: [0], bass: [1, 4], arp: [2, 3] }, mix: { gainLead: 3, gainBass: 1.5, gainDrums: 0.2, gainArp: 0.8, gainPad: 1 } },
  // v4.20.0: THE VOLUME REFERENCE — Forty Six & 2 is the loudest,
  // riff-forward track (dense high-velocity lead, drums at 0.14x the
  // lead). Every other track is tuned against it; it stays all-1.0.
  { file: 'Forty Six & 2 - Tool.mid', id: 'tool-forty-six', title: 'Forty Six & 2', artist: 'Tool', genre: 'metal', mix: { gainLead: 1, gainBass: 1, gainDrums: 1, gainArp: 1, gainPad: 1 } },
  // v4.16.0: the MIDI is the dramatic piano intro — the 'piano' profile
  // (not the metal sawtooth) renders it faithfully.
  // v4.20.0: mix — "too low": the short piano intro 2.0x.
  // v4.21.0: mix — "still ~2x too quiet": the piano intro 3.5x.
  { file: 'TOOL_ No Quarter.mid', id: 'tool-no-quarter', title: 'No Quarter', artist: 'Tool', genre: 'piano', mix: { gainLead: 3.5, gainBass: 1, gainDrums: 1, gainArp: 1, gainPad: 1 } },
  // v4.20.0: mix — "just too low": the fast 230-bpm staccato notes read
  // quiet — lead 1.7x + driving bass 1.3x.
  // v4.21.0: mix — "still ~2x too quiet": lead 3.0x, bass 2.0x, drums 1.5x.
  { file: 'Cowboys From HELL.mid', id: 'pantera-cowboys', title: 'Cowboys From Hell', artist: 'Pantera', genre: 'metal', mix: { gainLead: 3, gainBass: 2, gainDrums: 1.5, gainArp: 1, gainPad: 1 } },
  // v4.16.0: the distorted rhythm guitar (ch0) is the main body of the
  // song — pin it to lead. ch1 (acoustic) + ch2 (lead guitar) are arp,
  // ch3 is the bass line. (Auto-classify made the rhythm guitar a quiet
  // pad and a 21-note channel the "lead".)
  // v4.20.0: mix — the main rhythm can't be heard (lead 1.8x), the bass
  // was over the top (0.5x), and the clicky hi-hats are ick (drums 0.45x).
  // v4.21.0: mix — "still ~2x too quiet": lead 3.0x, the bass back to
  // 1.0x (the 0.5x cut was too far), drums 0.9x, the arp 1.5x.
  { file: 'Metallica - Harvester of Sorrow.mid', id: 'metallica-harvester', title: 'Harvester of Sorrow', artist: 'Metallica', genre: 'metal', chMap: { lead: [0], arp: [1, 2], bass: [3] }, mix: { gainLead: 3, gainBass: 1, gainDrums: 0.9, gainArp: 1.5, gainPad: 1 } },
  // v4.20.0: mix — the full metal band (power-chord rhythm on a per-song
  // SAW arp profile, heavy bass, drums, sparse lead).
  // v4.22.0: SOURCE REPLACED — now the "Classic Elec Piano w_ Remix"
  // arrangement (Tool - Pneuma (Classic Elec Piano w_ Remix, WIP).mid,
  // 1542 notes, two electric-piano channels, no drums/bass). The 'piano'
  // profile (bright pluck lead, fast decay) renders the electric piano
  // faithfully; BOTH channels ride the polyphonic lead voice (the old
  // per-song SAW arp profile is gone — no power-chord rhythm here). Mix
  // gainLead 3.0 matches the Forty Six & 2 reference (energy 234.5, just
  // above Classical Gas 211.6 — a dense boss-queue piano).
  { file: 'Tool - Pneuma (Classic Elec Piano w_ Remix, WIP).mid', id: 'tool-pneuma', title: 'Pneuma', artist: 'Tool', genre: 'piano', chMap: { lead: [0, 1] }, mix: { gainLead: 3, gainBass: 1, gainDrums: 1, gainArp: 1, gainPad: 1 } },
  // v4.17.0: Classical Gas (Mose Ziering) — a single-channel grand-piano
  // arrangement of the famous fingerpicked guitar piece. The melody and the
  // fast arpeggiated left-hand figure overlap in pitch, so (like Für Elise)
  // ALL notes ride the polyphonic lead voice; the 'piano' profile (bright
  // pluck-like lead, fast decay) keeps the 16th-note arpeggio crisp.
  // v4.21.0: mix — "still ~2x too quiet": the solo piano 3.0x.
  { file: 'Classical Gas.mid.mid', id: 'classical-gas', title: 'Classical Gas', artist: 'Mose Ziering', genre: 'piano', chMap: { lead: [0] }, mix: { gainLead: 3, gainBass: 1, gainDrums: 1, gainArp: 1, gainPad: 1 } },
  // v4.17.0: Eiffel 65 — Blue (Da Ba Dee) — a single-channel piano
  // arrangement of the Eurodance hook (the "da ba dee" lead melody + the
  // horn-stab chord hits). ALL notes ride the polyphonic lead voice; the
  // 'synth' profile (clean detuned-saw pluck) gives the hook its Eurodance
  // lead sound (NOT the metal saw — this is dance, not riffs).
  // v4.20.0: mix — "cannot hear it, so low" (1141 notes at avg velocity
  // 0.15): the lead hook 2.3x to the Forty Six & 2 reference level (the
  // arrangement itself "sounds great" — only the level was wrong).
  // v4.21.0: mix — "still ~2x too quiet": the lead hook 3.5x.
  { file: 'Eiffel 65 - Blue (Da Ba Dee).mid', id: 'eiffel65-blue', title: 'Blue (Da Ba Dee)', artist: 'Eiffel 65', genre: 'synth', chMap: { lead: [0] }, mix: { gainLead: 3.5, gainBass: 1, gainDrums: 1, gainArp: 1, gainPad: 1 } },
  // v4.19.0: Ozzy Osbourne — Crazy Train (intro riff, acoustic cover) —
  // the classic galloping E-minor riff as a single-channel acoustic
  // arrangement (80 notes, E2–B3, 9 bars). ALL notes ride the
  // polyphonic lead voice (like the other single-channel arrangements);
  // the 'metal' profile gives the gallop its driving distorted-saw body.
  // The per-track mix boost (gainLead 2.6 — v4.20.0, up from 1.15) lifts
  // the quiet solo-guitar riff ("cannot hear it, so low") to the Forty
  // Six & 2 reference level.
  // v4.21.0: mix — "still ~2x too quiet": the 31-second riff loop 4.0x
  // (the hook has to hit as hard as Forty Six & 2).
  { file: 'ozzy osbourne - crazy train intro riff acoustic cover.mid', id: 'ozzy-crazy-train', title: 'Crazy Train (Intro Riff)', artist: 'Ozzy Osbourne', genre: 'metal', chMap: { lead: [0] }, mix: { gainLead: 4, gainBass: 1, gainDrums: 1, gainArp: 1, gainPad: 1 } },
  // v4.19.0: Black Sabbath — Children Of The Grave — the classic heavy
  // metal anthem (153 bars @ 138 bpm). ch0 (electric guitar, the
  // power-chord rhythm) + ch2 (the vocal melody) ride the lead bus
  // (riff + melody = the main body of the song, like Harvester), ch1 is
  // the bass line, ch9 the drums (GM map).
  // v4.20.0: THE OPENING TRACK — first in the open queue (the game starts
  // on the anthem; it stays in the boss queue too). Mix: the 1840-hit
  // drum track was "too dominate, the main rhythm so far in the
  // background" — drums 0.8x → 0.45x, the riff + melody lead 1.7x.
  // v4.21.0: mix — "still ~2x too quiet": the riff + melody lead 2.5x,
  // bass 1.5x, drums 0.8x (audible under the riff, not on top of it).
  { file: 'Black Sabbath - Children Of The Grave.mid', id: 'black-sabbath-cotg', title: 'Children Of The Grave', artist: 'Black Sabbath', genre: 'metal', chMap: { lead: [0, 2], bass: [1] }, mix: { gainLead: 2.5, gainBass: 1.5, gainDrums: 0.8, gainArp: 1, gainPad: 1 } },
];

// The per-mode rotation queues (v4.20.0). Children Of The Grave is the
// OPENING track — MusicScheduler.start() picks PLAYLISTS.open[0] (the
// Black Sabbath anthem; it stays in the boss queue as a full-length
// battle track). v4.17.0: Classical Gas rides the two mellow queues
// (open + boneyard, the fingerpicked arpeggio as the atmospheric breath);
// Eiffel 65 — Blue joins the high-energy combat queue (the Eurodance hook
// alongside the riffs). v4.19.0: Crazy Train (intro riff) joins the
// high-energy combat queue (the 31-second galloping riff loop).
export const PLAYLISTS = {
  open: ['black-sabbath-cotg', 'metallica-nem', 'fur-elise', 'axel-f', 'johnny-march', 'classical-gas'],
  combat: ['tool-forty-six', 'johnny-march', 'pantera-cowboys', 'eiffel65-blue', 'ozzy-crazy-train'],
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
    // v4.21.0: optional per-song arp voice profile (Tool — Pneuma's
    // sustained power-chord rhythm plays as a saw guitar, not a pluck).
    if (tr.arp) L.push(`    arp: ${jsfmt(tr.arp)},`);
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
      const m = { gainLead: 1, gainBass: 1, gainDrums: 1, gainArp: 1, gainPad: 1, ...(tr.mix || {}) };
      return `  '${tr.id}': ${jsfmt(m)},`;
    })
    .join('\n');
  const out = `// Filename: core/audio/MusicPlaylists.js
// Kitty Vs Everything — v4.26.0
// v4.26.0: TRACK REMOVAL — The Unforgiven (Metallica) is gone from the
//          album: its SONGS data, its TRACK_MIX_SETTINGS entry, and its
//          combat-queue slot are all removed (15 → 14 tracks).
// v4.25.0: SOURCE REPLACEMENT + MIX FIX — The Unforgiven re-imported
//          from the new .mid file (The Unforgiven-New - Metallica.mid,
//          9 channels, 3820 notes): the old 6-channel arrangement (no
//          drums, no bass) is replaced by the full band — a real bass
//          line (ch5) + a full GM drum kit (ch9, 32nd-note snare-roll
//          intro) join the rhythm guitar (ch0), the melody (ch1), the
//          distortion harmony (ch2) and the guitar accents (ch3/ch7,
//          bars 67–81); ch4 (3-note artifact) and ch6 (2-bar tremolo
//          E-power-chord intro — a harsh buzz through the pluck voice)
//          are unmapped. Mix fix — "all separated, none of the melody
//          flows": the 612 open-hat hits (52% of the 1176 drum notes) +
//          the same-gain rhythm + the tremolo intro formed a wall
//          around the melody — the melody goes clearly on top (L4.0),
//          the rhythm supports (A1.5), the drums drive under it (D0.6),
//          the harmony sits back (P0.75), the bass 0.9x.
//          When Johnny Comes Marching Home re-imported from
//          "When Johnny Comes Marching Home -New.mid" — byte-identical
//          to the old file (same 4273 notes / 6 channels / 165 bpm), so
//          the event data is unchanged; only the source reference moves.
// v4.23.0: SOURCE REPLACEMENT — Pneuma + Axel F re-imported from the new
//          .mid files (Tool - Pneuma (Classic Elec Piano w_ Remix, WIP).mid
//          and Axel F (Beverly Hills Cop Theme).mid). Both are now piano
//          arrangements (the old full-band metal Pneuma and multi-channel
//          synth-pop Axel F are gone); both re-tuned to the 'piano' profile
//          + gainLead 3.0 against the Forty Six & 2 reference (Pneuma energy
//          234.5 ≈ Classical Gas 211.6; Axel F 157.6 ≈ NEM 155.2).
// v4.21.0: AUDIO MIX PASS 2 — TRACK_MIX_SETTINGS re-tuned against the
//          Forty Six & 2 reference after the "most tracks are ~2x too
//          quiet" report: Axel F L4.0/A2.5/P2.5 (the hook rides arp+pad
//          at base vol 0.05/0.06 — it was inaudible), Unforgiven
//          A2.5/P1.5 (the rhythm guitar + "synth" harmony were buried at
//          0.8x/0.25x — "only part of the harmony plays"), Pneuma
//          L2.0/B1.5/D1.0/A2.2/P1.5 (the full band back; the 2514-note
//          power-chord rhythm now also rides a per-song SAW arp voice
//          profile — song.arp — instead of the dead triangle pluck),
//          Johnny March L3.0/D0.2 (the melody over the march snare), plus
//          ~2x leads on every other quiet track (NEM 3.0, Requiem 3.0,
//          Fur Elise 3.5, No Quarter 3.5, Cowboys 3.0, Harvester 3.0,
//          Classical Gas 3.0, Blue 3.5, Crazy Train 4.0, CoTG 2.5).
//          Forty Six & 2 stays all-1.0 (the volume reference).
// v4.20.0: AUDIO MIX TUNING — per-track volume/mix pass against the
//          Forty Six & 2 reference (the loudest, riff-forward track):
//          quiet leads boosted (Crazy Train 2.6x, Blue 2.3x, Fur Elise /
//          No Quarter / Classical Gas / Axel F 2.0x, Cowboys 1.7x),
//          drum-dominant tracks tamed (Children Of The Grave / Johnny
//          March / Pneuma / Requiem / Harvester drums 0.35-0.45x),
//          Harvester's over-top bass 0.5x, The Unforgiven's "synth" pad
//          0.25x, Pneuma's rhythm-guitar arp 1.9x (NEW gainArp/gainPad
//          scalars in TRACK_MIX_SETTINGS, applied in the MusicScheduler
//          event path), Nothing Else Matters switched to the piano
//          profile (the detuned-saw+sub "gross synth" lead is gone).
//          NEW OPENING TRACK: Children Of The Grave leads the open queue
//          (the game starts on the Black Sabbath anthem; it stays in the
//          boss queue too).
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

// ─── v4.21.0: per-track mix settings (the per-song channel balance) ───
// One entry per song: gainLead / gainBass / gainDrums / gainArp / gainPad
// are scalar multipliers (1.0 = the genre profile's vols as-is) that the
// MusicScheduler applies in the MIDI event path — e.g. gainLead > 1
// boosts a quiet lead melody, gainDrums < 1 lowers an overpowering
// percussion channel, gainPad < 1 ducks a harsh synth pad, gainArp > 1
// lifts a rhythm-guitar arp. Re-tuned v4.21.0 against the Forty Six & 2
// reference (tool-forty-six stays all-1.0 — the volume benchmark) after
// the "most tracks need ~2x to match 46&2" report: the v4.20.0 pass
// under-corrected — Axel F's hook (arp+pad at base vol 0.05/0.06) was
// still inaudible, The Unforgiven's rhythm guitar (arp 0.8x) + "synth"
// harmony (pad 0.25x) were buried, Pneuma's full band was cut to a thin
// pluck, and Johnny March's drums still buried the melody.
// Tweak per song here (or in tools/midi-import.mjs TRACKS[].mix) and
// re-run \`node tools/midi-import.mjs --write\`.
export const TRACK_MIX_SETTINGS = {
${mixes}
};

// ─── v4.20.0: per-mode song queues (the rotation order) ───
// Children Of The Grave opens every mission (MusicScheduler.start() picks
// the first entry of the active mode's queue) — the Black Sabbath anthem
// is the game's opening track (v4.20.0); it stays in the boss queue too.
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

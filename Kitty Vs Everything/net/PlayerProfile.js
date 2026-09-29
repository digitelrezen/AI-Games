// Filename: net/PlayerProfile.js
// Kitty Vs Everything — v3.20.0
// Player profiles (P1 + P2) singleton. Persists as an E6 flat file
// (schema 'profile', two record rows) in localStorage, and can be exported /
// imported as standalone .e6 files (see net/data/player1.profile.e6 and
// net/data/player2.profile.e6).
//
// Fields (E6 schema mapping, fixed order):
//   slot     'p1' | 'p2'
//   theme    ship theme id (yellow/orange/white/gray/brown)
//   callsign player name (shown in the HUD + top-pilot board)
//   score    last session score (local save state)
import E6 from './E6.js';

const STORAGE_KEY = 'kve-profiles-v1';
export const SCHEMA_ID = 'profile';
export const FIELDS = ['slot', 'theme', 'callsign', 'score'];
export const THEMES = ['yellow', 'orange', 'white', 'gray', 'brown'];

const DEFAULTS = {
  p1: { slot: 'p1', theme: 'yellow', callsign: 'PILOT-1', score: 0 },
  p2: { slot: 'p2', theme: 'orange', callsign: 'PILOT-2', score: 0 },
};

class PlayerProfile {
  constructor() {
    this.profiles = {
      p1: { ...DEFAULTS.p1 },
      p2: { ...DEFAULTS.p2 },
    };
    this.load();
  }

  records() {
    return [this.profiles.p1, this.profiles.p2];
  }

  exportText() {
    return E6.serialize(SCHEMA_ID, E6.VERSION, FIELDS, this.records());
  }

  importText(text) {
    const doc = E6.parse(text);
    if (doc.schemaId !== SCHEMA_ID) return false;
    let ok = false;
    for (const r of doc.records) {
      const slot = r.slot === 'p2' ? 'p2' : 'p1';
      this.profiles[slot] = {
        slot,
        theme: THEMES.includes(r.theme) ? r.theme : DEFAULTS[slot].theme,
        callsign: String(r.callsign || DEFAULTS[slot].callsign).slice(0, 16),
        score: E6.num(r.score, 0),
      };
      ok = true;
    }
    if (ok) this.save();
    return ok;
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, this.exportText()); } catch (e) { /* private mode */ }
  }

  load() {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      if (text) this.importText(text);
    } catch (e) { /* ignore */ }
  }

  get(slot) { return this.profiles[slot === 'p2' ? 'p2' : 'p1']; }

  set(slot, data) {
    const key = slot === 'p2' ? 'p2' : 'p1';
    const cur = this.profiles[key];
    this.profiles[key] = {
      slot: key,
      theme: THEMES.includes(data.theme) ? data.theme : cur.theme,
      callsign: String(data.callsign ?? cur.callsign).slice(0, 16),
      score: E6.num(data.score, cur.score),
    };
    this.save();
    return this.profiles[key];
  }

  /** Record a finished session score for a slot (local save state). */
  recordScore(slot, score) {
    const key = slot === 'p2' ? 'p2' : 'p1';
    this.profiles[key].score = Math.max(this.profiles[key].score, Math.round(score));
    this.save();
  }
}

export const playerProfile = new PlayerProfile();
export default playerProfile;

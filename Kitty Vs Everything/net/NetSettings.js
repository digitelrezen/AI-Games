// Filename: net/NetSettings.js
// Kitty Vs Everything — v3.20.0
// Network / multiplayer settings singleton. Persists as an E6 flat file
// (schema 'netsettings') in localStorage, and can be exported/imported as a
// standalone .e6 file (see net/data/multiplayer.config.e6).
//
// Fields (E6 schema mapping, fixed order):
//   role     'solo' | 'coop' | 'host' | 'client'
//   hosting  0/1        — "Host Game" toggle (start local server / listen)
//   port     number     — LAN server port
//   hostIp   string     — host IP address to join
//   syncRate number     — state snapshot rate (Hz)
import E6 from './E6.js';

const STORAGE_KEY = 'kve-netsettings-v1';
export const SCHEMA_ID = 'netsettings';
export const FIELDS = ['role', 'hosting', 'port', 'hostIp', 'syncRate'];
export const ROLES = ['solo', 'coop', 'host', 'client'];

const DEFAULTS = {
  role: 'solo',
  hosting: 0,
  port: 8765,
  hostIp: '',
  syncRate: 20,
};

class NetSettings {
  constructor() {
    this.role = DEFAULTS.role;
    this.hosting = false;
    this.port = DEFAULTS.port;
    this.hostIp = DEFAULTS.hostIp;
    this.syncRate = DEFAULTS.syncRate;
    this.load();
  }

  /** Build the E6 record object from current state. */
  record() {
    return {
      role: this.role,
      hosting: this.hosting ? 1 : 0,
      port: this.port,
      hostIp: this.hostIp,
      syncRate: this.syncRate,
    };
  }

  /** Serialize to E6 text (for export / .e6 files). */
  exportText() {
    return E6.serialize(SCHEMA_ID, E6.VERSION, FIELDS, [this.record()]);
  }

  /** Load from E6 text (for import / .e6 files). Returns true on success. */
  importText(text) {
    const doc = E6.parse(text);
    if (doc.schemaId !== SCHEMA_ID || doc.records.length === 0) return false;
    const r = doc.records[0];
    this.role = ROLES.includes(r.role) ? r.role : DEFAULTS.role;
    this.hosting = E6.bool(r.hosting, false);
    this.port = E6.num(r.port, DEFAULTS.port);
    this.hostIp = String(r.hostIp || '');
    this.syncRate = E6.num(r.syncRate, DEFAULTS.syncRate);
    this.save();
    return true;
  }

  /** Persist to localStorage as E6 text. */
  save() {
    try { localStorage.setItem(STORAGE_KEY, this.exportText()); } catch (e) { /* private mode */ }
  }

  /** Restore from localStorage (E6 text). */
  load() {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      if (text) this.importText(text);
    } catch (e) { /* ignore */ }
  }

  /** Convenience setters (persist immediately). */
  setRole(role) { if (ROLES.includes(role)) { this.role = role; this.save(); } }
  setHosting(on) { this.hosting = !!on; this.save(); }
  setPort(port) { this.port = E6.num(port, this.port); this.save(); }
  setHostIp(ip) { this.hostIp = String(ip || '').trim(); this.save(); }
  setSyncRate(hz) { this.syncRate = Math.max(5, Math.min(60, E6.num(hz, this.syncRate))); this.save(); }

  /** True when this machine should run the authoritative game + server. */
  get isHost() { return this.role === 'host' || this.hosting; }
  /** True when this machine is a remote client (mirror). */
  get isClient() { return this.role === 'client'; }
  /** True when a second local player is active (local co-op or host). */
  get hasP2() { return this.role === 'coop' || this.role === 'host'; }
}

export const netSettings = new NetSettings();
export default netSettings;

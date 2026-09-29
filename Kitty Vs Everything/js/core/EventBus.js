// Filename: EventBus.js
// Kitty Vs Everything — v1.0.0
// Tiny pub/sub so UI, combat, and the easter egg stay decoupled.

export const VERSION = 'v1.0.0';

class EventBus {
  constructor() { this._map = new Map(); }
  on(evt, fn) {
    if (!this._map.has(evt)) this._map.set(evt, new Set());
    this._map.get(evt).add(fn);
    return () => this.off(evt, fn);
  }
  off(evt, fn) { this._map.get(evt)?.delete(fn); }
  emit(evt, data) {
    this._map.get(evt)?.forEach(fn => { try { fn(data); } catch (e) { console.error('[EventBus]', e); } });
  }
}
export const bus = new EventBus();
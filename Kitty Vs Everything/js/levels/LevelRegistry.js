// Filename: LevelRegistry.js
// Kitty Vs Everything — v3.76.0
// Data-driven stage sequencing for the core game loop.
//
// A run is a cyclic MANIFEST of stage entries (STAGE_SEQUENCE):
//   { type: 'combat' }             → a standard enemy wave (WaveManager)
//   { type: 'bonus', id: '...' }   → a bonus round (see BONUS_STAGES)
//   { type: 'bonus', id: 'random' } → a random bonus stage
//
// Game.advanceStage() walks the manifest; every stage implements the
// uniform interface: init() / update(dt) / isComplete() / cleanup().
//
// PLUG-AND-PLAY: to add a new bonus stage, (1) create a stage module
// implementing the 4-method interface, (2) register it in BONUS_STAGES,
// (3) add an entry to STAGE_SEQUENCE. No core-loop changes required.
export const VERSION = 'v3.76.0';

import BoneYardBonus from './BoneYardBonus.js';
import InternetBonus from './InternetBonus.js';

// The run's stage manifest (cyclic). v3.76.0: 3 combat waves + 1 bonus
// round — identical cadence to the pre-refactor WaveManager (bonusEvery=4).
export const STAGE_SEQUENCE = [
  { type: 'combat' },
  { type: 'combat' },
  { type: 'combat' },
  { type: 'bonus', id: 'random' },
];

// Bonus stage registry: id → { label, create }. `label` is the HUD wave-
// label text; `create(game)` returns a stage instance (cached by the
// registry and reset via init() on every start).
export const BONUS_STAGES = {
  boneyard: {
    label: '☠ BONE YARD ☠',
    create: (game) => new BoneYardBonus(game),
  },
  internet: {
    label: '🌐 INTERNET 🌐',
    create: (game) => new InternetBonus(game),
  },
};

export default class LevelRegistry {
  constructor(sequence = STAGE_SEQUENCE) {
    this.sequence = sequence;
    this.index = -1;
    this.currentEntry = null; // last entry handed out (HUD / logging)
    this.stages = new Map(); // bonus id → live stage instance (reused)
  }

  /**
   * Waves between bonus rounds (cyclic distance between bonus entries).
   * Game syncs this to WaveManager.bonusEvery (ship-egg skip cadence).
   * 0 when the manifest contains no bonus rounds.
   */
  get bonusInterval() {
    const len = this.sequence.length;
    const first = this.sequence.findIndex(s => s.type === 'bonus');
    if (first < 0) return 0;
    for (let i = first + 1; i < first + len + 1; i++) {
      if (this.sequence[i % len].type === 'bonus') return i - first;
    }
    return len;
  }

  /** Restart the manifest (run start / restart). */
  reset() {
    this.index = -1;
    this.currentEntry = null;
  }

  /** Advance to the next manifest entry (cyclic) and return it. */
  nextStage() {
    this.index = (this.index + 1) % this.sequence.length;
    this.currentEntry = this.sequence[this.index];
    return this.currentEntry;
  }

  /** Resolve { type:'bonus', id:'random' } to a concrete bonus id. */
  resolveEntry(entry) {
    if (entry.type !== 'bonus' || entry.id !== 'random') return entry;
    const ids = Object.keys(BONUS_STAGES);
    return { type: 'bonus', id: ids[Math.floor(Math.random() * ids.length)] };
  }

  /**
   * Instantiate (or reuse) the stage for a manifest entry. Combat entries
   * run on the shared WaveManager; bonus stages are cached per id and
   * reset via init() on every start.
   */
  createStage(entry, game) {
    if (entry.type === 'combat') return game.waveManager;
    if (!this.stages.has(entry.id)) {
      this.stages.set(entry.id, BONUS_STAGES[entry.id].create(game));
    }
    return this.stages.get(entry.id);
  }

  /** HUD / log label for a manifest entry. */
  labelFor(entry) {
    if (!entry) return '';
    if (entry.type !== 'bonus') return 'WAVE';
    const reg = BONUS_STAGES[entry.id];
    return reg ? reg.label : entry.id.toUpperCase();
  }

  /**
   * Dev-forced bonus (DevPanel): resolve the bonus immediately WITHOUT
   * consuming a manifest slot — the next nextStage() lands on a combat
   * wave, never a second back-to-back bonus.
   */
  forceBonus(id = 'random') {
    const entry = this.resolveEntry({ type: 'bonus', id });
    const len = this.sequence.length;
    let i = (this.index + 1) % len;
    for (let n = 0; n < len && this.sequence[i].type === 'bonus'; n++) {
      i = (i + 1) % len;
    }
    this.index = (i - 1 + len) % len;
    this.currentEntry = entry;
    return entry;
  }
}
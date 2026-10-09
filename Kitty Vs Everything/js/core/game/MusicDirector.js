// Filename: game/MusicDirector.js
// Kitty Vs Everything — v4.4.0
// v4.4.0: DYNAMIC SOUNDTRACK DIRECTOR — derives the AudioSystem soundtrack
//          mode (open / combat / boneyard / boss) from live game state and
//          pushes it via audio.setMusicMode() every frame (a no-op when the
//          mode is unchanged). Game.update() calls syncMusicMode(this) in
//          the playing/bonus block.
//
//          SAR mode (js/modes/SearchAndDestroy): the journey zone drives the
//          base mood — OPEN SPACE (zone 0) → 'open', THE BONEYARD (zone 1)
//          → 'boneyard', DEEP SECTOR (zone 2) → 'boss' once Eridath's Mom's
//          House is alive and within its spawn range (SAR.HOUSE.spawnRange),
//          else 'combat' — with enemy-pressure escalation (open → combat at
//          OPEN_ESCALATE live enemies, boneyard → boss at
//          BONEYARD_ESCALATE).
//
//          Classic mode: the LevelRegistry stage drives it — BONE YARD
//          bonus → 'boneyard', INTERNET bonus (the Black Cat / Pink Cat
//          boss stage) → 'boss', an active combat wave with live enemies →
//          'combat', otherwise the atmospheric 'open' sweep (the breath
//          between waves).
//
//          Pure derivation — no game state is mutated; AudioSystem owns the
//          actual mode handoff (bar-boundary apply + transition accents).
export const VERSION = 'v4.4.0';
import { audio } from '../AudioSystem.js';
import { SAR } from '../config.js';

// Enemy-pressure escalation thresholds (live-enemy counts).
const OPEN_ESCALATE = 5;     // open space → combat
const BONEYARD_ESCALATE = 9; // boneyard → boss

/**
 * v4.4.0: sync the soundtrack mode with the current game context. Safe to
 * call every frame — setMusicMode() is a no-op when the mode is unchanged
 * and fully inert when music is not playing (headless-safe).
 */
export function syncMusicMode(game) {
  const mode = (game.mode === 'sard' && game.sard) ? sardMode(game) : classicMode(game);
  audio.setMusicMode(mode);
}

/** SAR: journey zone + house proximity + enemy pressure. */
function sardMode(game) {
  const sard = game.sard;
  const z = sard.spawner.zone;
  const n = game.enemies.length;
  if (z === 1) {
    return n >= BONEYARD_ESCALATE ? 'boss' : 'boneyard';
  }
  if (z === 2) {
    const h = sard.combat.house;
    if (h && h.alive) {
      const pw = sard.map.playerWorld();
      if (Math.hypot(pw.x - h.x, pw.y - h.y) < SAR.HOUSE.spawnRange) return 'boss';
    }
    return 'combat';
  }
  return n >= OPEN_ESCALATE ? 'combat' : 'open';
}

/** Classic: the LevelRegistry stage + live enemy pressure. */
function classicMode(game) {
  if (game.state === 'bonus') {
    const entry = game.levelRegistry ? game.levelRegistry.currentEntry : null;
    const id = entry && entry.type === 'bonus' ? entry.id : null;
    if (id === 'boneyard') return 'boneyard';
    if (id === 'internet') return 'boss'; // the boss stage
    return 'combat';
  }
  const wm = game.waveManager;
  if (wm && wm.active && game.enemies.length > 0) return 'combat';
  return 'open';
}

// tools/check/infra.mjs — shared infrastructure for the check.mjs section
// modules (extracted from tools/check.mjs): browser shims, check() harness,
// mod() loader, headless game helpers, subprocess runner.
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(TOOLS, '..', 'Kitty Vs Everything');
const FULL = process.argv.includes('--full');

console.log(`\n[check] game root : ${ROOT}`);
console.log(`[check] mode      : ${FULL ? 'full (includes smoke.mjs)' : 'default'}`);

let failures = 0;
const check = (label, cond, detail = '') => {
  console.log(`  ${cond ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${!cond && detail ? `  (${detail})` : ''}`);
  if (!cond) failures++;
};

// ─── Minimal browser shims (must exist BEFORE any game module import) ──────
// Game.js touches `window` at module level; Settings.js reads localStorage;
// the Game constructor calls requestAnimationFrame. Player.js ↔ orangeCat.js
// is a circular import that only resolves when Game.js loads first (the real
// app's entry order), so Game.js is always imported before Player.js below.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
};
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, querySelector: () => null, querySelectorAll: () => [] }),
  addEventListener: () => {},
  removeEventListener: () => {},
};
globalThis.requestAnimationFrame = () => 0;

const mod = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

// ─── Shared headless game helpers (verbatim from the original [4] section) ──
const { default: Game } = await mod('js/core/Game.js');
const { default: Player } = await mod('js/player/Player.js');
const { default: PowerUp } = await mod('js/combat/PowerUp.js');
const { fireNow, updateWeaponState, cycleWeapon } = await mod('js/player/PlayerWeapons.js');

const makeGame = () => ({
  viewW: 1280, viewH: 720, H: 720,
  particles: { burst() {} }, shake: 0, time: 0,
  bullets: [], score: 0, multiplier: 1,
  msglog: { log() {} }, aimbot: { active: false, trigger() {} },
});
const makePlayer = (game) => new Player(game);
const collect = (game, type, player) =>
  Game.prototype.collectPowerUp.call(game, new PowerUp({ x: 100, y: 100, type, game }), player);

// ─── Subprocess runner (verbatim from the original [3] section) ─────────────
const runTool = (args, label) => {
  const r = spawnSync(process.execPath, [path.join(TOOLS, args[0]), ...args.slice(1)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0) {
    console.log(out.split('\n').map((l) => '      ' + l).join('\n'));
  }
  check(label, r.status === 0, `exit ${r.status}`);
};

export { check, failures, mod, ROOT, TOOLS, FULL, Game, Player, PowerUp, fireNow, updateWeaponState, cycleWeapon, makeGame, makePlayer, collect, runTool };

#!/usr/bin/env node
// ../tools/check.mjs — Kitty Vs Everything v3.43.0 (tools/ lives at AI-GAMES root)
// One-stop health check for the v3.43.0 release work (alien UFO pixel-art
// dual-skin sprite swap) plus the v3.42.0 release work (shared POWERUP_DROPS
// drop pool, fully off-screen asteroid spawns, ship easter egg in most
// levels) plus the v3.33.0 FRENZY / hull-repair / PNG pipeline / HUD checks.
// Pure Node — no canvas, no browser.
//
//   node tools/check.mjs          → version sync + module surface + asset
//                                   pipeline (import-assets --check, validate)
//                                   + headless behavior (power-up collection,
//                                   Vulcan thermal / frenzy overheat immunity,
//                                   drop lifecycle)
//   node tools/check.mjs --full   → additionally runs the full smoke.mjs
//                                   logic suite as a subprocess
//
// Exit code 0 = all green, 1 = at least one ✗.

import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
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

// ═══════════════════════════════════════════════════════════
//  [1] VERSION SYNC — package.json vs module VERSION exports
// ═══════════════════════════════════════════════════════════
console.log('\n[1] Version sync');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const V = {};
for (const [tag, rel] of [
  ['Game', 'js/core/Game.js'],
  ['Player', 'js/player/Player.js'],
  ['PlayerWeapons', 'js/player/PlayerWeapons.js'],
  ['PowerUp', 'js/combat/PowerUp.js'],
  ['HUDFireControl', 'js/ui/HUDFireControl.js'],
  ['WaveManager', 'js/core/WaveManager.js'],        // v3.42.0
  ['Combat', 'js/combat/Combat.js'],                // v3.42.0
  ['AsteroidBonus', 'js/levels/AsteroidBonus.js'],  // v3.42.0
  ['InternetBonus', 'js/levels/InternetBonus.js'],  // v3.42.0
  ['DevPanel', 'js/ui/DevPanel.js'],                // v3.42.0
]) {
  V[tag] = (await mod(rel)).VERSION;
}
const { loadAssets, getSprite, getDims, POWERUP_ASSETS } = await mod('js/core/AssetManager.js');
check(`package.json version is ${pkg.version}`, /\d+\.\d+\.\d+/.test(pkg.version || ''), `got "${pkg.version}"`);
// Convention: JS modules use "vX.Y.Z", package.json uses "X.Y.Z" — normalize.
check(`Game.js VERSION ${V.Game} matches package.json ${pkg.version}`, String(V.Game).replace(/^v/, '') === String(pkg.version));
const EXPECTED_MODULE_VERSIONS = { Player: 'v3.33.0', PlayerWeapons: 'v3.33.0', PowerUp: 'v3.36.0', HUDFireControl: 'v3.33.0', WaveManager: 'v3.42.0', Combat: 'v3.42.0', AsteroidBonus: 'v3.42.0', InternetBonus: 'v3.42.0', DevPanel: 'v3.42.0' };
for (const [tag, want] of Object.entries(EXPECTED_MODULE_VERSIONS)) {
  check(`${tag}.js VERSION is ${want}`, V[tag] === want, `got ${V[tag]}`);
}
check('AssetManager exports loadAssets/getSprite/getDims', typeof loadAssets === 'function' && typeof getSprite === 'function' && typeof getDims === 'function');
check('AssetManager POWERUP_ASSETS maps 5 drop types', Object.keys(POWERUP_ASSETS || {}).length === 5, `got ${Object.keys(POWERUP_ASSETS || {}).join(', ')}`);

// ═══════════════════════════════════════════════════════════
//  [2] v3.42.0 MODULE SURFACE — config values + APIs the new
//      features depend on (POWERUP_DROPS pool, ASTEROID.spawnY,
//      Player.activateFrenzy, Game.collectPowerUp, HUDFireControl
//      panel, WEAPONS.vulkan thermal constants)
// ═══════════════════════════════════════════════════════════
console.log('\n[2] v3.42.0 module surface');
const { PLAYER, WEAPONS, ASTEROID, POWERUP_DROPS, rollPowerUpDrop } = await mod('js/core/config.js');
check('PLAYER.FRENZY_DURATION = 30', PLAYER.FRENZY_DURATION === 30, `got ${PLAYER.FRENZY_DURATION}`);
check('PLAYER.HEALTH_RESTORE = 25', PLAYER.HEALTH_RESTORE === 25, `got ${PLAYER.HEALTH_RESTORE}`);
check('WEAPONS.vulkan.thermalPerShot = 0.05', WEAPONS.vulkan.thermalPerShot === 0.05, `got ${WEAPONS.vulkan.thermalPerShot}`);
check('WEAPONS.vulkan.thermalMax = 1.0', WEAPONS.vulkan.thermalMax === 1.0, `got ${WEAPONS.vulkan.thermalMax}`);
check('WEAPONS.vulkan.thermalLockout = 1.2', WEAPONS.vulkan.thermalLockout === 1.2, `got ${WEAPONS.vulkan.thermalLockout}`);
check('WEAPONS.vulkan.rate = 0.07', WEAPONS.vulkan.rate === 0.07, `got ${WEAPONS.vulkan.rate}`);
// v3.42.0: shared drop pool + fully off-screen asteroid spawn
check('ASTEROID.spawnY = -80 (fully off-screen spawn)', ASTEROID.spawnY === -80, `got ${ASTEROID.spawnY}`);
check('POWERUP_DROPS has the 7 v3.42.0 drop types',
  JSON.stringify(Object.keys(POWERUP_DROPS || {}).sort()) === JSON.stringify(['crate', 'frenzy', 'health', 'life', 'mini', 'robot', 'shield']),
  `got ${Object.keys(POWERUP_DROPS || {}).join(', ')}`);
check('POWERUP_DROPS weights sum to 1',
  Math.abs(Object.values(POWERUP_DROPS || {}).reduce((a, b) => a + b, 0) - 1) < 1e-9,
  `got ${Object.values(POWERUP_DROPS || {}).reduce((a, b) => a + b, 0)}`);
check('rollPowerUpDrop() covers every pool type (2000 rolls)', (() => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(rollPowerUpDrop());
  return seen.size === Object.keys(POWERUP_DROPS).length;
})());
// v3.42.0 source gates: every asteroid spawn off-screen, ship egg on most waves
const wmSrc = fs.readFileSync(path.join(ROOT, 'js/core/WaveManager.js'), 'utf8');
check('WaveManager: wave-clear asteroid spawns off-screen (ASTEROID.spawnY)', wmSrc.includes('spawnAsteroid(this.game, x, ASTEROID.spawnY)'));
check('WaveManager: ship easter egg auto-triggers on non-bonus waves', wmSrc.includes("switchEgg(this.game, 'ship')") && wmSrc.includes('this.wave % this.bonusEvery !== 0'));
const combatSrc = fs.readFileSync(path.join(ROOT, 'js/combat/Combat.js'), 'utf8');
check('Combat: enemy kills roll the shared pool (no spawnAsteroid left)', combatSrc.includes('rollPowerUpDrop()') && !combatSrc.includes('spawnAsteroid'));
const abSrc = fs.readFileSync(path.join(ROOT, 'js/levels/AsteroidBonus.js'), 'utf8');
check('AsteroidBonus: shatter drops roll the shared pool', abSrc.includes('rollPowerUpDrop()'));
const ibSrc = fs.readFileSync(path.join(ROOT, 'js/levels/InternetBonus.js'), 'utf8');
check('InternetBonus: asteroid drops off-screen + shared pool', ibSrc.includes('spawnAsteroid(this.game, x, ASTEROID.spawnY)') && ibSrc.includes('rollPowerUpDrop()'));
const gameSrc = fs.readFileSync(path.join(ROOT, 'js/core/Game.js'), 'utf8');
check('Game: crate destruction spills a shared-pool drop', gameSrc.includes('type: rollPowerUpDrop()'));
const devSrc = fs.readFileSync(path.join(ROOT, 'js/ui/DevPanel.js'), 'utf8');
check('DevPanel: debug asteroid drop also spawns off-screen', devSrc.includes('spawnAsteroid(g, g.W / 2, ASTEROID.spawnY)'));

const { default: Game } = await mod('js/core/Game.js');
const { default: Player } = await mod('js/player/Player.js');
check('Player.prototype.activateFrenzy is a function', typeof Player.prototype.activateFrenzy === 'function');
check('Player constructor initializes frenzyTime = 0', (() => {
  const p = new Player({ viewW: 1280, viewH: 720, particles: { burst() {} }, shake: 0, time: 0, bullets: [], msglog: { log() {} }, aimbot: { active: false } });
  return p.frenzyTime === 0 && p.thermal === 0 && p.thermalLockout === 0;
})());
check('Game.prototype.collectPowerUp is a function', typeof Game.prototype.collectPowerUp === 'function');

const { default: HUDFireControl } = await mod('js/ui/HUDFireControl.js');
check('HUDFireControl has constructor + update', typeof HUDFireControl === 'function' && typeof HUDFireControl.prototype.update === 'function');

// ─── Asset pipeline static surface (files the PNG pipeline needs) ───
const ASSET_DIR = path.resolve(TOOLS, '..', '.assets');
const MANIFEST = path.join(TOOLS, 'asset-manifest.json');
check('.assets directory exists', fs.existsSync(ASSET_DIR));
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const keys = Object.keys(manifest.assets || {});
// v3.33.0: the pipeline also carries enemy sprites (wasp, then rat) alongside
// the 5 power-up drops — assert the exact expected key set, not a bare count.
const EXPECTED_KEYS = ['health', 'extralife', 'shield', 'frenzy', 'wasp', 'rat', 'crate', 'ufo1', 'ufo2'];
check('asset-manifest.json has the expected asset keys',
  keys.length === EXPECTED_KEYS.length && EXPECTED_KEYS.every(k => keys.includes(k)),
  `got ${keys.length}: ${keys.join(', ')}`);
for (const key of keys) {
  const wanted = manifest.assets[key];
  const hit = fs.existsSync(path.join(ASSET_DIR, wanted));
  check(`.assets/${wanted} exists (key "${key}")`, hit);
}
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
check('index.html loads the entry js/core/main.js', /js\/core\/main\.js/.test(indexHtml));

// ═══════════════════════════════════════════════════════════
//  [3] ASSET PIPELINE — the real import/validate tools, as
//      subprocesses (import-assets --check never writes)
// ═══════════════════════════════════════════════════════════
console.log('\n[3] Asset pipeline (subprocess)');
const runTool = (args, label) => {
  const r = spawnSync(process.execPath, [path.join(TOOLS, args[0]), ...args.slice(1)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0) {
    console.log(out.split('\n').map((l) => '      ' + l).join('\n'));
  }
  check(label, r.status === 0, `exit ${r.status}`);
};
runTool(['import-assets.mjs', '--check'], 'tools/import-assets.mjs --check (decode + validate, no writes)');
runTool(['validate.mjs'], 'tools/validate.mjs (game source validation)');

// ═══════════════════════════════════════════════════════════
//  [4] HEADLESS BEHAVIOR — power-up collection through the
//      REAL Game.collectPowerUp + Player (mock game shell only)
// ═══════════════════════════════════════════════════════════
console.log('\n[4] Power-up collection (headless)');
const { default: PowerUp } = await mod('js/combat/PowerUp.js');
const { fireNow, updateWeaponState } = await mod('js/player/PlayerWeapons.js');

const makeGame = () => ({
  viewW: 1280, viewH: 720, H: 720,
  particles: { burst() {} }, shake: 0, time: 0,
  bullets: [], score: 0, multiplier: 1,
  msglog: { log() {} }, aimbot: { active: false, trigger() {} },
});
const makePlayer = (game) => new Player(game);
const collect = (game, type, player) =>
  Game.prototype.collectPowerUp.call(game, new PowerUp({ x: 100, y: 100, type, game }), player);

{
  const game = makeGame();
  const p = makePlayer(game);
  p.hp = 10;
  collect(game, 'health', p);
  check(`health drop: hp 10 → ${10 + PLAYER.HEALTH_RESTORE}`, p.hp === 10 + PLAYER.HEALTH_RESTORE, `got ${p.hp}`);
  p.hp = 90;
  collect(game, 'health', p);
  check('health drop caps at maxHp (90 → 100)', p.hp === p.maxHp, `got ${p.hp}`);
  p.shield = 0;
  collect(game, 'shield', p);
  check('shield drop restores to maxShield', p.shield === p.maxShield, `got ${p.shield}`);
  const livesBefore = p.lives;
  collect(game, 'life', p);
  check('life drop: lives +1', p.lives === livesBefore + 1, `got ${p.lives}`);
  game.score = 0; game.multiplier = 1;
  collect(game, 'crate', p);
  check('crate drop: score += 1000 × multiplier', game.score === 1000, `got ${game.score}`);
}

// ─── FRENZY pickup: every cooldown cleared + 30s timer ───
{
  const game = makeGame();
  const p = makePlayer(game);
  p.fireTimer = 0.5; p.thermal = 0.8; p.thermalLockout = 0.9;
  p.stunCooldown = 2; p.napalmCooldown = 2; p.ultimateCooldown = 2;
  game.shake = 0;
  collect(game, 'frenzy', p);
  check(`frenzy drop: frenzyTime = ${PLAYER.FRENZY_DURATION}`, p.frenzyTime === PLAYER.FRENZY_DURATION, `got ${p.frenzyTime}`);
  check('frenzy drop: fireTimer / thermal / lockout cleared', p.fireTimer === 0 && p.thermal === 0 && p.thermalLockout === 0,
    `fireTimer=${p.fireTimer} thermal=${p.thermal} lockout=${p.thermalLockout}`);
  check('frenzy drop: stun / napalm / ultimate cleared', p.stunCooldown === 0 && p.napalmCooldown === 0 && p.ultimateCooldown === 0);
  check('frenzy drop: screen shake ≥ 5', game.shake >= 5, `got ${game.shake}`);
}

// ═══════════════════════════════════════════════════════════
//  [5] VULKAN THERMAL + FRENZY IMMUNITY — real fireNow() gate,
//      20 shots × 0.05 = overheat lockout; frenzy holds it at 0
// ═══════════════════════════════════════════════════════════
console.log('\n[5] Vulcan thermal / frenzy overheat immunity (headless)');
{
  const game = makeGame();
  const p = makePlayer(game);
  p.weapon = 'vulkan';
  let shots = 0;
  for (let i = 0; i < 20; i++) { p.fireTimer = 0; if (fireNow(p)) shots++; }
  check('20 vulkan shots all fire', shots === 20, `got ${shots}`);
  check('overheat triggers lockout 1.2s on shot 20', p.thermalLockout === WEAPONS.vulkan.thermalLockout, `got ${p.thermalLockout}`);
  check('thermal resets to 0 on overheat', p.thermal === 0, `got ${p.thermal}`);
  p.fireTimer = 0;
  check('fireNow() blocked during lockout', fireNow(p) === false);
  check('bullets spawned (2 tips × 20 shots = 40)', game.bullets.length === 40, `got ${game.bullets.length}`);
}
{
  const game = makeGame();
  const p = makePlayer(game);
  p.weapon = 'vulkan';
  p.activateFrenzy();
  let shots = 0;
  for (let i = 0; i < 50; i++) { p.fireTimer = 0; if (fireNow(p)) shots++; }
  check('frenzy: 50/50 shots fire (no rate gate)', shots === 50, `got ${shots}`);
  check('frenzy: thermal stays 0 (no buildup)', p.thermal === 0, `got ${p.thermal}`);
  check('frenzy: no overheat lockout', p.thermalLockout === 0, `got ${p.thermalLockout}`);
}
{
  const game = makeGame();
  const p = makePlayer(game);
  p.weapon = 'vulkan';
  p.frenzyTime = PLAYER.FRENZY_DURATION;
  p.fireTimer = 0.5; p.thermal = 0.9; p.thermalLockout = 0.7;
  updateWeaponState(p, 0.016);
  check('frenzy: updateWeaponState holds fireTimer/thermal/lockout at 0',
    p.fireTimer === 0 && p.thermal === 0 && p.thermalLockout === 0,
    `fireTimer=${p.fireTimer} thermal=${p.thermal} lockout=${p.thermalLockout}`);
  p.frenzyTime = 0;
  p.thermal = 0.5; p.thermalLockout = 0;
  updateWeaponState(p, 1);
  check('no frenzy: thermal decays 0.5 → 0.15 over 1s', Math.abs(p.thermal - 0.15) < 1e-9, `got ${p.thermal}`);
}

// ═══════════════════════════════════════════════════════════
//  [6] POWER-UP DROP LIFECYCLE — falls at vy=70, despawns below
//      the live viewport (game.H + 40)
// ═══════════════════════════════════════════════════════════
console.log('\n[6] Power-up drop lifecycle (headless)');
{
  const game = makeGame();
  const pw = new PowerUp({ x: 100, y: 0, type: 'frenzy', game });
  pw.update(1);
  check('drop falls 70px in 1s (vy=70)', Math.abs(pw.y - 70) < 1e-9, `got ${pw.y}`);
  check('drop still alive mid-screen', pw.alive === true);
  pw.update(12);
  check('drop despawns below viewport (y > H+40)', pw.alive === false && pw.y > game.H + 40, `y=${pw.y}`);
  const crate = new PowerUp({ x: 100, y: 0, type: 'crate', game });
  check('crate drop is destructible (hp 30)', crate.destructible === true && crate.hp === 30, `hp=${crate.hp}`);
}

// ═══════════════════════════════════════════════════════════
//  [7] --full: full smoke.mjs logic suite (subprocess)
// ═══════════════════════════════════════════════════════════
if (FULL) {
  console.log('\n[7] Full smoke suite (subprocess)');
  runTool(['smoke.mjs'], 'tools/smoke.mjs (Settings/Keybinds/EventBus/MessageLog/DebugBridge)');
}

// ─── Summary ───────────────────────────────────────────────
console.log(failures === 0
  ? '\n\x1b[32m[check] ALL GREEN — v3.43.0 surface, asset pipeline, and headless behavior verified.\x1b[0m'
  : `\n\x1b[31m[check] ${failures} FAILURE(S) — see ✗ lines above.\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);

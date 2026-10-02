#!/usr/bin/env node
// ../tools/check.mjs — Kitty Vs Everything v3.63.0 (tools/ lives at AI-GAMES root)
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
  ['DevPanel', 'js/ui/DevPanel.js'],                // v3.48.0
  ['Settings', 'js/ui/Settings.js'],                // v3.48.0
  ['Crosshair', 'js/ui/Crosshair.js'],              // v3.48.0
  ['EnemyFactory', 'js/enemies/EnemyFactory.js'],   // v3.50.0
  ['BoneYardBonus', 'js/levels/BoneYardBonus.js'],  // v3.50.0
  ['ShuttleEnemy', 'js/enemies/ShuttleEnemy.js'],   // v3.50.0
  ['MothEnemy', 'js/enemies/MothEnemy.js'],         // v3.52.0
  ['BeetleEnemy', 'js/enemies/BeetleEnemy.js'],     // v3.53.0
  ['BonusLevel', 'js/levels/BonusLevel.js'],        // v3.54.0
  ['BoneFragment', 'js/levels/BoneFragment.js'],    // v3.54.0
  ['SpiderEnemy', 'js/enemies/SpiderEnemy.js'],     // v3.57.0
  ['SnakeEnemy', 'js/enemies/SnakeEnemy.js'],       // v3.61.0
  ['WolfEnemy', 'js/enemies/WolfEnemy.js'],         // v3.62.0
  ['LizardEnemy', 'js/enemies/LizardEnemy.js'],     // v3.63.0
]) {
  V[tag] = (await mod(rel)).VERSION;
}
const { loadAssets, getSprite, getDims, POWERUP_ASSETS } = await mod('js/core/AssetManager.js');
check(`package.json version is ${pkg.version}`, /\d+\.\d+\.\d+/.test(pkg.version || ''), `got "${pkg.version}"`);
// Convention: JS modules use "vX.Y.Z", package.json uses "X.Y.Z" — normalize.
check(`Game.js VERSION ${V.Game} matches package.json ${pkg.version}`, String(V.Game).replace(/^v/, '') === String(pkg.version));
const EXPECTED_MODULE_VERSIONS = { Player: 'v3.47.0', PlayerWeapons: 'v3.46.0', PowerUp: 'v3.59.0', HUDFireControl: 'v3.47.0', WaveManager: 'v3.42.0', Combat: 'v3.42.0', AsteroidBonus: 'v3.42.0', InternetBonus: 'v3.42.0', DevPanel: 'v3.55.0', Settings: 'v3.55.0', Crosshair: 'v3.55.0', EnemyFactory: 'v3.32.0', BoneYardBonus: 'v3.16.0', ShuttleEnemy: 'v1.0.0', MothEnemy: 'v1.0.0', BeetleEnemy: 'v1.2.0', BonusLevel: 'v2.2.0', BoneFragment: 'v2.3.0', SpiderEnemy: 'v1.2.0', SnakeEnemy: 'v1.2.0', WolfEnemy: 'v1.2.0', LizardEnemy: 'v1.2.0' };
for (const [tag, want] of Object.entries(EXPECTED_MODULE_VERSIONS)) {
  check(`${tag}.js VERSION is ${want}`, V[tag] === want, `got ${V[tag]}`);
}
check('AssetManager exports loadAssets/getSprite/getDims', typeof loadAssets === 'function' && typeof getSprite === 'function' && typeof getDims === 'function');
check('AssetManager POWERUP_ASSETS maps 6 drop types', Object.keys(POWERUP_ASSETS || {}).length === 6, `got ${Object.keys(POWERUP_ASSETS || {}).join(', ')}`);

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
// v3.50.0: + shuttle (space shuttle enemy, 17th species).
// v3.52.0: + moth (moth enemy, 18th species).
// v3.53.0: + beetle (beetle enemy pixel-art sprite swap).
// v3.54.0: + femur / profile_bone / skeleton / skull (boneyard environment).
// v3.57.0: + spider (spider enemy pixel-art sprite swap).
// v3.58.0: + wanted ("Adopt Me!" wanted poster for the mini drop).
// v3.61.0: + snake (snake enemy pixel-art sprite swap).
// v3.62.0: + wolf (wolf enemy pixel-art sprite swap).
// v3.63.0: + lizard (lizard enemy pixel-art sprite swap).
const EXPECTED_KEYS = ['health', 'extralife', 'shield', 'frenzy', 'wasp', 'butterfly', 'rat', 'crate', 'ufo1', 'ufo2', 'shuttle', 'moth', 'beetle', 'femur', 'profile_bone', 'skeleton', 'skull', 'spider', 'snake', 'wanted', 'wolf', 'lizard'];
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
//  [6b] v3.45.0 CLEAN CATSHIP — yellow shield bubble (ship-side
//       charge/shield rings removed) + HUDFireControl purple Nova
//       meter (charge/cooldown/ready) + one-shot shield-break burst
// ═══════════════════════════════════════════════════════════
console.log('\n[6b] v3.45.0 clean catship (source gates)');
{
  const prSrc = fs.readFileSync(path.join(ROOT, 'js/player/PlayerRenderer.js'), 'utf8');
  check('PlayerRenderer: SHIELD_BUBBLE_RADIUS = 60 (v3.56.0: ring clears the guns)', /SHIELD_BUBBLE_RADIUS\s*=\s*60/.test(prSrc));
  check('PlayerRenderer: yellow bubble drawn only while shield > 0',
    prSrc.includes('if (p.shield > 0)') && prSrc.includes('rgba(255, 213, 79'));
  check('PlayerRenderer: ship no longer reads superCharge (gold ring gone)',
    !prSrc.includes('p.superCharge'));
  const plSrc = fs.readFileSync(path.join(ROOT, 'js/player/Player.js'), 'utf8');
  check('Player: shield-break shatter burst (shield >0 → 0, one-shot)',
    plSrc.includes('const shieldBefore = this.shield') &&
    plSrc.includes('shieldBefore > 0 && this.shield <= 0') &&
    plSrc.includes('#ffd54f'));
  const hudSrc = fs.readFileSync(path.join(ROOT, 'js/ui/HUDFireControl.js'), 'utf8');
  check('HUDFireControl: Nova meter reads superCharge + ultimateCooldown',
    hudSrc.includes('p.superCharge') && hudSrc.includes('p.ultimateCooldown'));
  check('HUDFireControl: Nova meter states nova-ready/-charging/-cooldown',
    hudSrc.includes('nova-ready') && hudSrc.includes('nova-charging') && hudSrc.includes('nova-cooldown'));
  check('HUDFireControl: old minis-based Nova ready flag (novaReady) removed',
    !hudSrc.includes('novaReady'));
}

// ═══════════════════════════════════════════════════════════
//  [6c] v3.47.0 KEY-TRIGGERED SYNERGY EXPLOSION — the meter
//       (superCharge) holds at 100% and the 'synergy' action fires
//       superWeapon (P1: T / -, P2 co-op: ,); TestAimbot moved T → F8
// ═══════════════════════════════════════════════════════════
console.log('\n[6c] v3.47.0 key-triggered synergy explosion (source gates)');
{
  const fleetSrc = fs.readFileSync(path.join(ROOT, 'js/player/PlayerFleet.js'), 'utf8');
  check('PlayerFleet: synergy key gate (input.wasPressedAction("synergy"))',
    fleetSrc.includes("input.wasPressedAction('synergy')"));
  check('PlayerFleet: fire gated on minis + theme match + superCharge >= 1',
    fleetSrc.includes('player.minis.length > 0') &&
    fleetSrc.includes('m.theme === player.theme') &&
    fleetSrc.includes('player.superCharge >= 1'));
  check('PlayerFleet: old 10s auto-fire removed (no in-charge superWeapon)',
    !/superCharge\s*>=\s*1\s*\)\s*\{\s*player\.superCharge\s*=\s*0;\s*player\.superWeapon\(\);/.test(fleetSrc));
  const kbSrc = fs.readFileSync(path.join(ROOT, 'js/input/Keybinds.js'), 'utf8');
  check('Keybinds: synergy action registered (label "Synergy Explosion")',
    kbSrc.includes("{ id: 'synergy',     label: 'Synergy Explosion' }"));
  check('Keybinds: synergy defaults KeyT / Minus',
    /synergy:\s*\[\s*'KeyT'\s*,\s*'Minus'\s*\]/.test(kbSrc));
  const mkSrc = fs.readFileSync(path.join(ROOT, 'js/input/MenuKeybinds.js'), 'utf8');
  check('MenuKeybinds: synergy row after ultimate (12 rows total)',
    mkSrc.includes("action: 'ultimate', label: 'Super'") &&
    mkSrc.includes("action: 'synergy', label: 'Synergy Explosion'") &&
    (mkSrc.match(/\{ kind: '(wsad|action|static)'/g) || []).length === 12);
  const aimSrc = fs.readFileSync(path.join(ROOT, 'js/combat/TestAimbot.js'), 'utf8');
  check('TestAimbot: hotkey moved T → F8 (no KeyT left)',
    aimSrc.includes("e.code !== 'F8'") && !aimSrc.includes('KeyT'));
  const hudSrc2 = fs.readFileSync(path.join(ROOT, 'js/ui/HUDFireControl.js'), 'utf8');
  check('HUDFireControl: NOVA slot key label tracks the synergy action',
    hudSrc2.includes("this._slotLabel(e.novaSlot, 'synergy')"));
  const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check('index.html: static NOVA slot key is T (was F)',
    /nova-slot[\s\S]*?fc-slot-key">T</.test(htmlSrc));
  const p2Src = fs.readFileSync(path.join(ROOT, 'net/Player2Controls.js'), 'utf8');
  check('Player2Controls: synergy in P2_ACTIONS + default Comma',
    p2Src.includes("'deployFleet', 'synergy'") && /synergy:\s*\[\s*'Comma'\s*\]/.test(p2Src));
  const netSrc = fs.readFileSync(path.join(ROOT, 'net/NetProtocol.js'), 'utf8');
  check('NetProtocol: encodeInput sends the synergy edge',
    netSrc.includes("synergy: p('synergy') ? 1 : 0"));
  const coopSrc = fs.readFileSync(path.join(ROOT, 'net/CoopManager.js'), 'utf8');
  check('CoopManager: remote P2 synergy edge applied host-side',
    coopSrc.includes('synergy: !!ri.synergy'));
}

// ═══════════════════════════════════════════════════════════
//  [6d] v3.50.0 SHUTTLE ENEMY — 17th species: regular waves
//      only (ENEMY_TYPES → WaveManager pool), Bone Yard Phase 2
//      locked to an explicit humanoid allowlist (BoneYardBonus.js)
// ═══════════════════════════════════════════════════════════
console.log('\n[6d] v3.50.0 shuttle enemy (17th species)');
const { ENEMY_TYPES, WAVE } = await mod('js/core/config.js');
check('config: ENEMY_TYPES has 18 species (shuttle + moth)', Object.keys(ENEMY_TYPES).length === 18, `got ${Object.keys(ENEMY_TYPES).length}: ${Object.keys(ENEMY_TYPES).join(', ')}`);
check('config: shuttle entry (Space Shuttle, glide pattern)', ENEMY_TYPES.shuttle && ENEMY_TYPES.shuttle.name === 'Space Shuttle' && ENEMY_TYPES.shuttle.pattern === 'glide', `got ${JSON.stringify(ENEMY_TYPES.shuttle)}`);
check('config: WAVE.SPECIES_COUNT = 18', WAVE.SPECIES_COUNT === 18, `got ${WAVE.SPECIES_COUNT}`);
const { isValidEnemyType, getEnemyClass, getEnemyTypeIds } = await mod('js/enemies/EnemyFactory.js');
check('EnemyFactory: shuttle registered in REGISTRY', isValidEnemyType('shuttle') && getEnemyTypeIds().includes('shuttle'));
check('EnemyFactory: getEnemyClass("shuttle") is the ShuttleEnemy class', typeof getEnemyClass('shuttle') === 'function' && getEnemyClass('shuttle').name === 'ShuttleEnemy', `got ${getEnemyClass('shuttle') && getEnemyClass('shuttle').name}`);
const { default: ShuttleEnemy } = await mod('js/enemies/ShuttleEnemy.js');
const seSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/ShuttleEnemy.js'), 'utf8');
check('ShuttleEnemy: extends EnemyBase, sprite key "shuttle", banked-strafe + telegraph', Object.getPrototypeOf(ShuttleEnemy.prototype).constructor.name === 'EnemyBase' && seSrc.includes("SHUTTLE_SPRITE_KEY = 'shuttle'") && seSrc.includes('this.bank') && seSrc.includes('this.telegraph'));
// Regular waves: WaveManager's species pool is Object.keys(ENEMY_TYPES) —
// a headless instance must list shuttle + moth among its 18 species.
const { default: WaveManager } = await mod('js/core/WaveManager.js');
const wm = new WaveManager({});
check('WaveManager: regular-wave species pool includes shuttle + moth (18 total)', wm.species.includes('shuttle') && wm.species.includes('moth') && wm.species.length === 18, `got ${wm.species.length}: ${wm.species.join(', ')}`);
check('WaveManager: species pool comes from ENEMY_TYPES (source gate)', wmSrc.includes('this.species = Object.keys(ENEMY_TYPES)'));
// Bone Yard Phase 2/3: explicit humanoid allowlist — a new species can
// never leak into the march.
const bySrc = fs.readFileSync(path.join(ROOT, 'js/levels/BoneYardBonus.js'), 'utf8');
check('BoneYardBonus: explicit humanoid allowlist is [\'human\']', /BONE_YARD_HUMANOID_TYPES\s*=\s*\[\s*'human'\s*\]/.test(bySrc));
check('BoneYardBonus: phase 2/3 spawn uses the allowlist (not a bare type)', bySrc.includes('type: BONE_YARD_HUMANOID_TYPES[0]'));
// Generated sprite data carries the shuttle PNG (128×60).
const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');
check('AssetSprites: shuttle sprite dims 128×60 registered', /shuttle:\s*\{\s*w:\s*128,\s*h:\s*60\s*\}/.test(spritesSrc));

// ═══════════════════════════════════════════════════════════
//  [6e] v3.58.0 JEWEL SHADING — all FIVE pill/poster drops
//      (life / health / frenzy / shield / mini) render through
//      the programmatic drawJewelDrop() 6-pass gem pipeline
//      (depth → shine → aura → base blit → shimmer → sparkles);
//      headless-safe (no DOM → base fallback only)
// ═══════════════════════════════════════════════════════════
console.log('\n[6e] v3.58.0 jewel shading (all five pill/poster drops)');
const pwSrc = fs.readFileSync(path.join(ROOT, 'js/combat/PowerUp.js'), 'utf8');
check('PowerUp: VERSION = v3.59.0', pwSrc.includes("VERSION = 'v3.59.0'"));
check('PowerUp: drawJewelDrop() gem pipeline (source-atop depth + lighter glow)',
  pwSrc.includes('function drawJewelDrop(') &&
  pwSrc.includes("globalCompositeOperation = 'source-atop'") &&
  pwSrc.includes("globalCompositeOperation = 'lighter'"));
check('PowerUp: 5-type jewel aura palette (blue/green/red/gold/bounty)',
  pwSrc.includes("life:   { aura: '64, 140, 255'") &&
  pwSrc.includes("health: { aura: '64, 220, 110'") &&
  pwSrc.includes("frenzy: { aura: '255, 64, 54'") &&
  pwSrc.includes("shield: { aura: '255, 205, 40'") &&
  pwSrc.includes("mini:   { aura: '255, 220, 120'"));
check('PowerUp: 5-type sparkle palette in pill theme colors',
  pwSrc.includes("life:   { rgb: '110, 180, 255', count: 7 }") &&
  pwSrc.includes("health: { rgb: '110, 240, 150', count: 7 }") &&
  pwSrc.includes("frenzy: { rgb: '255, 100, 90',  count: 7 }") &&
  pwSrc.includes("shield: { rgb: '255, 214, 90',  count: 7 }") &&
  pwSrc.includes("mini:   { rgb: '255, 236, 170', count: 8 }"));
check('PowerUp: life drop routes through the jewel pass', pwSrc.includes("drawJewelDrop(ctx, 'life', this.t,"));
check('PowerUp: health drop routes through the jewel pass', pwSrc.includes("drawJewelDrop(ctx, 'health', this.t,"));
check('PowerUp: frenzy drop routes through the jewel pass', pwSrc.includes("drawJewelDrop(ctx, 'frenzy', this.t,"));
check('PowerUp: shield drop routes through the jewel pass', pwSrc.includes("drawJewelDrop(ctx, 'shield', this.t,"));
check('PowerUp: mini drop routes through the jewel pass', pwSrc.includes("drawJewelDrop(ctx, 'mini', this.t,"));
check('PowerUp: jewel buffer is headless-guarded (no DOM → base only)',
  pwSrc.includes("typeof document === 'undefined'") &&
  pwSrc.includes('if (!buf) { drawBase(ctx); return; }'));
check('PowerUp: procedural fallbacks preserved (heart/cross/bolt/hexagon/cat)',
  pwSrc.includes('#ff5252') && pwSrc.includes('#66bb6a') && pwSrc.includes('#ffd600') &&
  pwSrc.includes('#4fc3f7') && pwSrc.includes('#ff9d3b'));
// Headless draw smoke: all three jewel drops must draw with a bare mock
// ctx (no DOM canvas) — the jewel pass falls back to the base glyph.
{
  const game = makeGame();
  const mockCtx = {
    save() {}, restore() {}, translate() {}, beginPath() {}, moveTo() {}, lineTo() {},
    closePath() {}, bezierCurveTo() {}, arc() {}, fill() {}, stroke() {}, fillRect() {},
    strokeRect() {}, drawImage() {}, clearRect() {},
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
  };
  for (const type of ['life', 'health', 'frenzy', 'shield', 'mini']) {
    const pw = new PowerUp({ x: 100, y: 100, type, game });
    let ok = true;
    try { pw.draw(mockCtx); } catch { ok = false; }
    check(`headless: ${type} drop draws without a DOM canvas (jewel pass → base fallback)`, ok);
  }
}

// ═══════════════════════════════════════════════════════════
//  [6f] v3.52.0 MOTH ENEMY — 18th species: regular waves only
//      (ENEMY_TYPES → WaveManager pool), Bone Yard Phase 2 stays
//      locked to the explicit humanoid allowlist (BoneYardBonus.js)
// ═══════════════════════════════════════════════════════════
console.log('\n[6f] v3.52.0 moth enemy (18th species)');
check('config: moth entry (Moth, erratic pattern)', ENEMY_TYPES.moth && ENEMY_TYPES.moth.name === 'Moth' && ENEMY_TYPES.moth.pattern === 'erratic', `got ${JSON.stringify(ENEMY_TYPES.moth)}`);
check('EnemyFactory: moth registered in REGISTRY', isValidEnemyType('moth') && getEnemyTypeIds().includes('moth'));
check('EnemyFactory: getEnemyClass("moth") is the MothEnemy class', typeof getEnemyClass('moth') === 'function' && getEnemyClass('moth').name === 'MothEnemy', `got ${getEnemyClass('moth') && getEnemyClass('moth').name}`);
const { default: MothEnemy } = await mod('js/enemies/MothEnemy.js');
const meSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/MothEnemy.js'), 'utf8');
check('MothEnemy: extends EnemyBase, sprite key "moth", erratic dart + flutter', Object.getPrototypeOf(MothEnemy.prototype).constructor.name === 'EnemyBase' && meSrc.includes("MOTH_SPRITE_KEY = 'moth'") && meSrc.includes('this._dartX') && meSrc.includes('this._dartT'));
// Generated sprite data carries the moth PNG (128×79).
check('AssetSprites: moth sprite dims 128×79 registered', /moth:\s*\{\s*w:\s*128,\s*h:\s*79\s*\}/.test(spritesSrc));
// Bone Yard Phase 2/3: explicit humanoid allowlist — the moth can never
// leak into the march.
check('BoneYardBonus: humanoid allowlist excludes moth', /BONE_YARD_HUMANOID_TYPES\s*=\s*\[\s*'human'\s*\]/.test(bySrc));

// ═══════════════════════════════════════════════════════════
//  [6g] v3.53.0 BEETLE PIXEL-ART SPRITE — armored tank now draws
//       the shared PNG (key "beetle") with charge-lunge pulse;
//       procedural fallback kept
// ═══════════════════════════════════════════════════════════
console.log('\n[6g] v3.53.0 beetle pixel-art sprite');
{
  const beSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/BeetleEnemy.js'), 'utf8');
  check('BeetleEnemy: VERSION = v1.2.0', beSrc.includes("VERSION = 'v1.2.0'"));
  check('BeetleEnemy: sprite key "beetle" via AssetManager', beSrc.includes("BEETLE_SPRITE_KEY = 'beetle'") && beSrc.includes('getSprite(BEETLE_SPRITE_KEY)'));
  check('BeetleEnemy: null-sprite → procedural fallback branch', beSrc.includes('this._drawProcedural(ctx, r)'));
  check('BeetleEnemy: charge-lunge pulse tracks the 2.4 s burst', beSrc.includes('_drawSprite(ctx, sprite, r)') && beSrc.includes('this.t % 2.4'));
  check('AssetSprites: beetle sprite dims 123×128 registered', /beetle:\s*\{\s*w:\s*123,\s*h:\s*128\s*\}/.test(spritesSrc));
}

// ═══════════════════════════════════════════════════════════
//  [6h] v3.54.0 BONEYARD PIXEL-ART ENVIRONMENT — the four shared
//       bone/skull/skeleton PNGs + BonusLevel draw delegation
//       (v3.60.0: the yard itself is fully destructible — [6m])
// ═══════════════════════════════════════════════════════════
console.log('\n[6h] v3.54.0 boneyard pixel-art environment');
{
  const blSrc = fs.readFileSync(path.join(ROOT, 'js/levels/BonusLevel.js'), 'utf8');
  check('BonusLevel: VERSION = v2.2.0', blSrc.includes("VERSION = 'v2.2.0'"));
  check('BonusLevel: draw(ctx) delegates to the active bonus', blSrc.includes('draw(ctx)') && blSrc.includes('this.currentBonus.draw(ctx)'));
  check('Game: bonus draw hook under the bonus targets', gameSrc.includes('this.bonus.draw(ctx)'));
  check('AssetSprites: skeleton dims 76×128 registered', /skeleton:\s*\{\s*w:\s*76,\s*h:\s*128\s*\}/.test(spritesSrc));
  check('AssetSprites: skull dims 104×128 registered', /skull:\s*\{\s*w:\s*104,\s*h:\s*128\s*\}/.test(spritesSrc));
  check('AssetSprites: femur dims 126×128 registered', /femur:\s*\{\s*w:\s*126,\s*h:\s*128\s*\}/.test(spritesSrc));
  check('AssetSprites: profile_bone dims 128×56 registered', /profile_bone:\s*\{\s*w:\s*128,\s*h:\s*56\s*\}/.test(spritesSrc));
}

// ═══════════════════════════════════════════════════════════
//  [6i] v3.55.0 CROSSHAIR OFFSET RANGE — reticle distance slider
//       widened to 140–340 logical px (was 24–160); Settings.js
//       LIMITS is the single source of truth, Crosshair.draw()
//       clamps defensively
// ═══════════════════════════════════════════════════════════
console.log('\n[6i] v3.55.0 crosshair offset range (140–340 px)');
{
  const setSrc = fs.readFileSync(path.join(ROOT, 'js/ui/Settings.js'), 'utf8');
  const xhSrc = fs.readFileSync(path.join(ROOT, 'js/ui/Crosshair.js'), 'utf8');
  const devSrc = fs.readFileSync(path.join(ROOT, 'js/ui/DevPanel.js'), 'utf8');
  const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check('Settings: crosshairOffset LIMITS 140–340 (default 140)', /crosshairOffset:\s*\{\s*min:\s*140,\s*max:\s*340,\s*def:\s*140/.test(setSrc));
  check('Settings: LIMITS exported (shared clamp source)', setSrc.includes('export const LIMITS'));
  check('Crosshair: VERSION = v3.55.0', xhSrc.includes("VERSION = 'v3.55.0'"));
  check('Crosshair: draw() clamps offset to LIMITS range', xhSrc.includes('Math.max(lim.min, Math.min(lim.max, SETTINGS.crosshairOffset))'));
  check('DevPanel: slider → setSetting clamp path intact', devSrc.includes("setSetting('crosshairOffset', parseFloat(xhOffset.value))"));
  check('index.html: dev slider min=140 max=340 value=140', htmlSrc.includes('id="dev-crosshair-offset" min="140" max="340" step="1" value="140"'));
}

// ═══════════════════════════════════════════════════════════
//  [6j] v3.57.0 SPIDER PIXEL-ART SPRITE — web-spinner now draws
//       the shared PNG (key "spider") with crawler gait + a bright
//       red hourglass dorsal mark; procedural fallback kept
// ═══════════════════════════════════════════════════════════
console.log('\n[6j] v3.57.0 spider pixel-art sprite + red hourglass mark');
{
  const spSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/SpiderEnemy.js'), 'utf8');
  check('SpiderEnemy: VERSION = v1.2.0', spSrc.includes("VERSION = 'v1.2.0'"));
  check('SpiderEnemy: sprite key "spider" via AssetManager', spSrc.includes("SPIDER_SPRITE_KEY = 'spider'") && spSrc.includes('getSprite(SPIDER_SPRITE_KEY)'));
  check('SpiderEnemy: null-sprite → procedural fallback branch', spSrc.includes('this._drawProcedural(ctx, r)'));
  check('SpiderEnemy: crawler gait (bob/sway/tilt) in sprite draw', spSrc.includes('const bob = Math.sin(this.t * 5)') && spSrc.includes('const sway = Math.sin(this.t * 2.5)') && spSrc.includes('const tilt = Math.sin(this.t * 2.5)'));
  check('SpiderEnemy: aspect-preserving nearest-neighbor draw', spSrc.includes('(targetW * dims.h) / dims.w') && spSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('SpiderEnemy: bright red hourglass dorsal mark', spSrc.includes('_drawHourglassMark(ctx, targetW, targetH)') && spSrc.includes('rgba(255, 34, 34,') && spSrc.includes('-targetH * 0.09'));
  check('SpiderEnemy: procedural fallback keeps red hourglass marking', spSrc.includes('BRIGHT RED HOURGLASS marking (dorsal/back section)'));
  check('AssetSprites: spider sprite dims 94×128 registered', /spider:\s*\{\s*w:\s*94,\s*h:\s*128\s*\}/.test(spritesSrc));
}

// ═══════════════════════════════════════════════════════════
//  [6k] v3.58.0 POWER-UP PIXEL ART — all five pill/poster drops
//       carry the shared PNG art (extralife/health/frenzy/shield/
//       wanted); mini routes to the "wanted" poster; the jewel
//       pass-order fix (icon blit after depth+shine) and the
//       deterministic sparkle field are verified here
// ═══════════════════════════════════════════════════════════
console.log('\n[6k] v3.58.0 power-up pixel art (5 pill/poster assets)');
check('AssetSprites: extralife sprite dims 128×46 registered', /extralife:\s*\{\s*w:\s*128,\s*h:\s*46\s*\}/.test(spritesSrc));
check('AssetSprites: health sprite dims 128×50 registered', /health:\s*\{\s*w:\s*128,\s*h:\s*50\s*\}/.test(spritesSrc));
check('AssetSprites: frenzy sprite dims 128×41 registered', /frenzy:\s*\{\s*w:\s*128,\s*h:\s*41\s*\}/.test(spritesSrc));
check('AssetSprites: shield sprite dims 128×50 registered', /shield:\s*\{\s*w:\s*128,\s*h:\s*50\s*\}/.test(spritesSrc));
check('AssetSprites: wanted sprite dims 78×128 registered', /wanted:\s*\{\s*w:\s*78,\s*h:\s*128\s*\}/.test(spritesSrc));
check('AssetManager: POWERUP_ASSETS.mini === "wanted" (v3.58.0)', !!POWERUP_ASSETS && POWERUP_ASSETS.mini === 'wanted');
// v3.58.1 regression gate: the mini drop must draw the imported "wanted"
// pixel art (78×128) — v3.58.0 shipped with the mini case still blitting
// the old embedded 28×28 MiniPosterSprite.
check('PowerUp: mini drop draws the "wanted" pixel art (v3.58.1 fix)', pwSrc.includes("drawSpriteIcon(c, 'mini', JEWEL_BOX)"));
// v3.58.0 pass-order fix: the buffered icon blit (PASS 4) runs AFTER
// the source-atop DEPTH (PASS 1) + SHINE (PASS 2) passes.
{
  const blitIdx = pwSrc.indexOf('ctx.drawImage(buf.c, -JEWEL_BUF / 2, -JEWEL_BUF / 2)');
  const shineIdx = pwSrc.indexOf('PASS 2: SHINE');
  const baseIdx = pwSrc.indexOf('PASS 4: BASE');
  check('PowerUp: pass-order fix — icon blit (PASS 4) after depth+shine (PASS 1–2)',
    blitIdx !== -1 && shineIdx !== -1 && baseIdx !== -1 && shineIdx < baseIdx && baseIdx < blitIdx);
}
// v3.58.0: the sparkle field is deterministic (sin-hash seed, no per-instance state).
check('PowerUp: sparkle determinism (sparkleSeed sin-hash + per-type hash)',
  pwSrc.includes('function sparkleSeed(n)') &&
  pwSrc.includes('Math.sin(n * 127.1 + 311.7) * 43758.5453') &&
  pwSrc.includes('function sparkleTypeHash(type)'));

// ═══════════════════════════════════════════════════════════
//  [6l] v3.59.0 DOUBLE-SIZED POWER-UP ICONS — every drop icon
//       (jewel box, buffer, aura, shimmer, sparkles, robot,
//       crate, fallbacks) and the pickup hitbox are 2× the
//       v3.58.x size
// ═══════════════════════════════════════════════════════════
console.log('\n[6l] v3.59.0 double-sized power-up icons');
check('PowerUp: JEWEL_BOX doubled 28 → 56', pwSrc.includes('const JEWEL_BOX = 56'));
check('PowerUp: JEWEL_BUF doubled 40 → 80', pwSrc.includes('const JEWEL_BUF = 80'));
check('PowerUp: pickup hitbox doubled (crate 36 / drop 28)', pwSrc.includes("this.radius = type === 'crate' ? 36 : 28"));
check('PowerUp: jewel aura radius doubled 22 → 44', pwSrc.includes('ctx.arc(0, 0, 44, 0, TAU)'));
check('PowerUp: shimmer perimeter radius doubled 13.5 → 27', pwSrc.includes('ctx.arc(0, 0, 27, a0, a0 + 1.1)'));
check('PowerUp: sparkle orbit doubled 10–18 → 20–36 px', pwSrc.includes('const orbit = 20 + 16 * h1'));
check('PowerUp: robot drop height doubled 28 → 56', pwSrc.includes('const h = 56'));
check('PowerUp: crate sprite box doubled 28 → 56', pwSrc.includes("drawSpriteIcon(ctx, 'crate', 56)"));
check('PowerUp: mini fallback poster doubled 28×28 → 56×56', pwSrc.includes('c.drawImage(poster, -28, -28, 56, 56)'));

// ═══════════════════════════════════════════════════════════
//  [6m] v3.60.0 FULLY DESTRUCTIBLE BONE YARD — the yard opens on a
//       seeded field of 29 shootable bones; per-key radius/HP/score
//       bands (500/1000/2000); weighted spawn pool (40/40/15/5);
//       the v3.15.0 non-shootable backdrop is gone
// ═══════════════════════════════════════════════════════════
console.log('\n[6m] v3.60.0 fully destructible Bone Yard');
{
  const { BONUS } = await mod('js/core/config.js');
  const bfSrc = fs.readFileSync(path.join(ROOT, 'js/levels/BoneFragment.js'), 'utf8');
  check('config: BONUS.BONE_YARD_FIELD = 10 femur / 10 profile_bone / 6 skull / 3 skeleton', BONUS.BONE_YARD_FIELD && BONUS.BONE_YARD_FIELD.femur === 10 && BONUS.BONE_YARD_FIELD.profile_bone === 10 && BONUS.BONE_YARD_FIELD.skull === 6 && BONUS.BONE_YARD_FIELD.skeleton === 3);
  check('BoneYardBonus: VERSION = v3.16.0', bySrc.includes("VERSION = 'v3.16.0'"));
  check('BoneYardBonus: non-destructible backdrop removed (BONEYARD_BG_* gone)', !bySrc.includes('BONEYARD_BG_KEYS') && !bySrc.includes('BONEYARD_BG_BASE') && !bySrc.includes('BONEYARD_BG_COUNTS'));
  check('BoneYardBonus: _buildBackground/_drawProceduralBg removed', !bySrc.includes('_buildBackground') && !bySrc.includes('_drawProceduralBg'));
  check('BoneYardBonus: draw() is a no-op hook', bySrc.includes('draw(ctx) {}'));
  check('BoneYardBonus: seeded field from BONUS.BONE_YARD_FIELD', bySrc.includes('BONUS.BONE_YARD_FIELD') && bySrc.includes('_seedYardField'));
  check('BoneYardBonus: deterministic mulberry32 layout (seed 20261001)', bySrc.includes('function mulberry32') && bySrc.includes('mulberry32(20261001)'));
  check('BoneYardBonus: field drift 6–18 px/s, no horizontal drift', bySrc.includes('bone.vy = 6 + rng() * 12') && bySrc.includes('bone.vx = 0'));
  check('BoneYardBonus: Phase 1 rain rolls the weighted pool', bySrc.includes('new BoneFragment({ x, y: -30, game: this.game })'));
  check('BoneFragment: VERSION = v2.3.0', bfSrc.includes("VERSION = 'v2.3.0'"));
  check('BoneFragment: per-key radius/HP/score bands', bfSrc.includes('BONE_FRAGMENT_STATS') && bfSrc.includes('score: 500') && bfSrc.includes('score: 1000') && bfSrc.includes('score: 2000'));
  check('BoneFragment: weighted spawn pool 40/40/15/5', bfSrc.includes('BONE_FRAGMENT_POOL') && bfSrc.includes('weight: 40') && bfSrc.includes('weight: 15') && bfSrc.includes('weight: 5'));
  check('BoneFragment: optional spriteKey constructor arg', bfSrc.includes('spriteKey = null'));
  check('BoneFragment: aspect-preserving sprite + procedural fallback', bfSrc.includes('getDims(this.spriteKey)') && bfSrc.includes('this._drawProcedural(ctx, r)'));
  // ── headless behavior: seeded field, per-key stats, weighted pool ──
  const { default: BoneYardBonus } = await mod('js/levels/BoneYardBonus.js');
  const { default: BoneFragment, BONE_FRAGMENT_STATS, BONE_FRAGMENT_POOL } = await mod('js/levels/BoneFragment.js');
  const mkGame = () => ({
    viewW: 1920, viewH: 1080,
    bonusTargets: [], enemies: [], score: 0, multiplier: 1, shake: 0,
    state: 'bonus',
    particles: { burst() {} },
    waveManager: { startNext() {} },
  });
  const game = mkGame();
  const yard = new BoneYardBonus(game);
  yard.start();
  const field = game.bonusTargets;
  check('BoneYard: seeded field = 29 destructible bones', field.length === 29, `got ${field.length}`);
  const count = (k) => field.filter((b) => b.spriteKey === k).length;
  check('BoneYard: field mix 10 femur / 10 profile_bone / 6 skull / 3 skeleton', count('femur') === 10 && count('profile_bone') === 10 && count('skull') === 6 && count('skeleton') === 3, `got ${count('femur')}/${count('profile_bone')}/${count('skull')}/${count('skeleton')}`);
  check('BoneYard: every field bone is damageable (alive, hp > 0, applyDamage)', field.every((b) => b.alive && b.hp > 0 && typeof b.applyDamage === 'function'));
  check('BoneYard: field drift 6–18 px/s, no horizontal drift', field.every((b) => b.vy >= 6 && b.vy <= 18 && b.vx === 0));
  check('BoneYard: skeleton sentinels hug the left/right margins', field.filter((b) => b.spriteKey === 'skeleton').every((b) => b.x < 240 || b.x > 1680));
  const game2 = mkGame();
  new BoneYardBonus(game2).start();
  check('BoneYard: seeded layout is identical across runs', game2.bonusTargets.length === field.length && game2.bonusTargets.every((b, i) => b.spriteKey === field[i].spriteKey && Math.abs(b.x - field[i].x) < 0.001 && Math.abs(b.y - field[i].y) < 0.001));

  const femur = new BoneFragment({ x: 100, y: 100, game, spriteKey: 'femur' });
  const skull = new BoneFragment({ x: 100, y: 100, game, spriteKey: 'skull' });
  const skeleton = new BoneFragment({ x: 100, y: 100, game, spriteKey: 'skeleton' });
  check('BoneFragment: score bands (regular 500 / skull 1000 / skeleton 2000)', femur.scoreValue === 500 && skull.scoreValue === 1000 && skeleton.scoreValue === 2000, `got ${femur.scoreValue}/${skull.scoreValue}/${skeleton.scoreValue}`);
  check('BoneFragment: per-key radius bands', femur.radius >= 14 && femur.radius <= 26 && skull.radius >= 20 && skull.radius <= 32 && skeleton.radius >= 28 && skeleton.radius <= 42, `got ${femur.radius}/${skull.radius}/${skeleton.radius}`);
  check('BoneFragment: per-key HP bands', femur.hp >= 15 && femur.hp <= 35 && skull.hp >= 35 && skull.hp <= 60 && skeleton.hp >= 70 && skeleton.hp <= 110, `got ${femur.hp}/${skull.hp}/${skeleton.hp}`);
  check('BoneFragment: exported stats/pool tables', BONE_FRAGMENT_STATS.skeleton.score === 2000 && BONE_FRAGMENT_STATS.skull.score === 1000 && BONE_FRAGMENT_STATS.femur.score === 500 && BONE_FRAGMENT_POOL.length === 4);
  const pool = {};
  for (let i = 0; i < 2000; i++) {
    const b = new BoneFragment({ x: 0, y: 0, game });
    pool[b.spriteKey] = (pool[b.spriteKey] || 0) + 1;
  }
  check('BoneFragment: pool roll covers all four keys', pool.femur > 0 && pool.profile_bone > 0 && pool.skull > 0 && pool.skeleton > 0, JSON.stringify(pool));
  check('BoneFragment: pool weights ≈ 40/40/15/5', Math.abs(pool.femur / 2000 - 0.4) < 0.05 && Math.abs(pool.skull / 2000 - 0.15) < 0.05 && Math.abs(pool.skeleton / 2000 - 0.05) < 0.04, JSON.stringify(pool));
  skull.applyDamage(9999);
  check('BoneFragment: skull dies to damage (alive=false)', skull.alive === false);
  skull.shatter(game);
  check('BoneFragment: shatter triggers screen shake (≥3)', game.shake >= 3, `got ${game.shake}`);
  skeleton.shatter(game);
  check('BoneFragment: skeleton shatter = bigger shake (6)', game.shake >= 6, `got ${game.shake}`);
}

// ═══════════════════════════════════════════════════════════
//  [6n] v3.61.0 SNAKE PIXEL-ART SPRITE — slithering serpent now
//       draws the shared PNG (key "snake") with a slither gait
//       (sway/bob/tilt phase-locked to the movement sine) + a
//       type-color accent glow; procedural fallback kept
// ═══════════════════════════════════════════════════════════
console.log('\n[6n] v3.61.0 snake pixel-art sprite');
{
  const snSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/SnakeEnemy.js'), 'utf8');
  check('SnakeEnemy: VERSION = v1.2.0', snSrc.includes("VERSION = 'v1.2.0'"));
  check('SnakeEnemy: sprite key "snake" via AssetManager', snSrc.includes("SNAKE_SPRITE_KEY = 'snake'") && snSrc.includes('getSprite(SNAKE_SPRITE_KEY)'));
  check('SnakeEnemy: null-sprite → procedural fallback branch', snSrc.includes('this._drawProcedural(ctx, r)'));
  check('SnakeEnemy: slither gait (sway/bob/tilt) phase-locked to the movement sine', snSrc.includes('const sway = Math.sin(this.t * 3)') && snSrc.includes('const bob = Math.sin(this.t * 6)') && snSrc.includes('const tilt = Math.sin(this.t * 3 + 0.6)'));
  check('SnakeEnemy: aspect-preserving nearest-neighbor draw', snSrc.includes('(targetW * dims.h) / dims.w') && snSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('SnakeEnemy: type-color accent glow pass', snSrc.includes('ctx.shadowColor = this.color') && snSrc.includes('ctx.shadowBlur = r * 0.8'));
  check('AssetSprites: snake sprite dims 128×128 registered', /snake:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(spritesSrc));
}

// ═══════════════════════════════════════════════════════════
//  [6o] v3.62.0 WOLF PIXEL-ART SPRITE — pack hunter now draws
//       the shared PNG (key "wolf") with a pack-sine gait
//       (sway/bob/tilt phase-locked to the movement sine) +
//       type-color accent glow; procedural fallback retained
// ═══════════════════════════════════════════════════════════
console.log('\n[6o] v3.62.0 wolf pixel-art sprite');
{
  const wfSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/WolfEnemy.js'), 'utf8');
  check('WolfEnemy: VERSION = v1.2.0', wfSrc.includes("VERSION = 'v1.2.0'"));
  check('WolfEnemy: sprite key "wolf" via AssetManager', wfSrc.includes("WOLF_SPRITE_KEY = 'wolf'") && wfSrc.includes('getSprite(WOLF_SPRITE_KEY)'));
  check('WolfEnemy: null-sprite → procedural fallback branch', wfSrc.includes('this._drawProcedural(ctx, r)'));
  check('WolfEnemy: pack-sine gait (sway/bob/tilt) phase-locked to the movement sine', wfSrc.includes('const phase = this.t * 1.2 + this.baseX * 0.01') && wfSrc.includes('const sway = Math.sin(phase)') && wfSrc.includes('const tilt = Math.sin(phase + 0.6)'));
  check('WolfEnemy: aspect-preserving nearest-neighbor draw', wfSrc.includes('(targetW * dims.h) / dims.w') && wfSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('WolfEnemy: type-color accent glow pass', wfSrc.includes('ctx.shadowColor = this.color') && wfSrc.includes('ctx.shadowBlur = r * 0.8'));
  check('AssetSprites: wolf sprite dims 122×128 registered', /wolf:\s*\{\s*w:\s*122,\s*h:\s*128\s*\}/.test(spritesSrc));
}

// ═══════════════════════════════════════════════════════════
//  [6p] v3.63.0 LIZARD PIXEL-ART SPRITE — slow tank now draws
//       the shared PNG (key "lizard") with a tank gait
//       (sway/bob/tilt phase-locked to the fixed-altitude
//       hover bob) + type-color accent glow; procedural
//       fallback retained
// ═══════════════════════════════════════════════════════════
console.log('\n[6p] v3.63.0 lizard pixel-art sprite');
{
  const lzSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/LizardEnemy.js'), 'utf8');
  check('LizardEnemy: VERSION = v1.2.0', lzSrc.includes("VERSION = 'v1.2.0'"));
  check('LizardEnemy: sprite key "lizard" via AssetManager', lzSrc.includes("LIZARD_SPRITE_KEY = 'lizard'") && lzSrc.includes('getSprite(LIZARD_SPRITE_KEY)'));
  check('LizardEnemy: null-sprite → procedural fallback branch', lzSrc.includes('this._drawProcedural(ctx, r)'));
  check('LizardEnemy: tank gait (sway/bob/tilt) phase-locked to the hover bob (this.t)', lzSrc.includes('const sway = Math.sin(this.t)') && lzSrc.includes('const tilt = Math.sin(this.t + 0.6)'));
  check('LizardEnemy: aspect-preserving nearest-neighbor draw', lzSrc.includes('(targetW * dims.h) / dims.w') && lzSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('LizardEnemy: ground shadow + type-color accent glow pass', lzSrc.includes('ctx.ellipse(0, targetH * 0.41') && lzSrc.includes('ctx.shadowColor = this.color'));
  check('LizardEnemy: procedural fallback art intact (tongue/tail/scales)', lzSrc.includes('tongueOut') && lzSrc.includes('tailSway') && lzSrc.includes('segGrad'));
  check('AssetSprites: lizard sprite dims 99×128 registered', /lizard:\s*\{\s*w:\s*99,\s*h:\s*128\s*\}/.test(spritesSrc));
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
  ? '\n\x1b[32m[check] ALL GREEN — v3.63.0 surface, asset pipeline, and headless behavior verified.\x1b[0m'
  : `\n\x1b[31m[check] ${failures} FAILURE(S) — see ✗ lines above.\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);

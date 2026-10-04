#!/usr/bin/env node
// ../tools/check.mjs — Kitty Vs Everything v3.77.0 (tools/ lives at AI-GAMES root)
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
import zlib from 'node:zlib';
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
  ['WaveManager', 'js/core/WaveManager.js'],        // v3.76.0
  ['Combat', 'js/combat/Combat.js'],                // v3.42.0
  ['AsteroidBonus', 'js/levels/AsteroidBonus.js'],  // v3.42.0
  ['InternetBonus', 'js/levels/InternetBonus.js'],  // v3.76.0
  ['DevPanel', 'js/ui/DevPanel.js'],                // v3.48.0
  ['Settings', 'js/ui/Settings.js'],                // v3.48.0
  ['Crosshair', 'js/ui/Crosshair.js'],              // v3.48.0
  ['EnemyFactory', 'js/enemies/EnemyFactory.js'],   // v3.50.0
  ['BoneYardBonus', 'js/levels/BoneYardBonus.js'],  // v3.76.0
  ['ShuttleEnemy', 'js/enemies/ShuttleEnemy.js'],   // v3.50.0
  ['MothEnemy', 'js/enemies/MothEnemy.js'],         // v3.52.0
  ['BeetleEnemy', 'js/enemies/BeetleEnemy.js'],     // v3.53.0
  ['BonusLevel', 'js/levels/BonusLevel.js'],        // v3.76.0
  ['BoneFragment', 'js/levels/BoneFragment.js'],    // v3.54.0
  ['SpiderEnemy', 'js/enemies/SpiderEnemy.js'],     // v3.57.0
  ['SnakeEnemy', 'js/enemies/SnakeEnemy.js'],       // v3.61.0
  ['WolfEnemy', 'js/enemies/WolfEnemy.js'],         // v3.62.0
  ['LizardEnemy', 'js/enemies/LizardEnemy.js'],     // v3.63.0
  ['DragonEnemy', 'js/enemies/DragonEnemy.js'],     // v3.64.0
  ['FalconEnemy', 'js/enemies/FalconEnemy.js'],     // v3.65.0
  ['BatEnemy', 'js/enemies/BatEnemy.js'],           // v3.66.0
  ['SquirrelEnemy', 'js/enemies/SquirrelEnemy.js'], // v3.67.0
  ['BaseWeapon', 'js/combat/BaseWeapon.js'],        // v3.68.0
  ['VulcanCannon', 'js/combat/VulcanCannon.js'],    // v3.68.0
  ['PulseCannon', 'js/combat/PulseCannon.js'],      // v3.69.0
  ['RailCannon', 'js/combat/RailCannon.js'],        // v3.69.0
  ['BaseRocket', 'js/combat/BaseRocket.js'],        // v3.70.0
  ['StunRockets', 'js/combat/StunRockets.js'],      // v3.70.0
  ['NapalmRockets', 'js/combat/NapalmRockets.js'],  // v3.70.0
  ['CatShipFactory', 'js/combat/CatShipFactory.js'], // v3.71.0
  ['MiniShip', 'js/combat/MiniShip.js'],             // v3.73.0
  ['SuperNova', 'js/combat/SuperNova.js'],           // v3.71.0
]) {
  V[tag] = (await mod(rel)).VERSION;
}
const { loadAssets, getSprite, getDims, POWERUP_ASSETS } = await mod('js/core/AssetManager.js');
check(`package.json version is ${pkg.version}`, /\d+\.\d+\.\d+/.test(pkg.version || ''), `got "${pkg.version}"`);
// Convention: JS modules use "vX.Y.Z", package.json uses "X.Y.Z" — normalize.
check(`Game.js VERSION ${V.Game} matches package.json ${pkg.version}`, String(V.Game).replace(/^v/, '') === String(pkg.version));
const EXPECTED_MODULE_VERSIONS = { Player: 'v3.71.0', PlayerWeapons: 'v3.70.0', PowerUp: 'v3.59.0', HUDFireControl: 'v3.47.0', WaveManager: 'v3.76.0', Combat: 'v3.42.0', AsteroidBonus: 'v3.42.0', InternetBonus: 'v3.76.0', DevPanel: 'v3.55.0', Settings: 'v3.55.0', Crosshair: 'v3.55.0', EnemyFactory: 'v3.33.0', BoneYardBonus: 'v3.76.0', ShuttleEnemy: 'v1.0.0', MothEnemy: 'v1.0.0', BeetleEnemy: 'v1.2.0', BonusLevel: 'v3.76.0', BoneFragment: 'v2.3.0', SpiderEnemy: 'v1.2.0', SnakeEnemy: 'v1.2.0', WolfEnemy: 'v1.2.0', LizardEnemy: 'v1.2.0', DragonEnemy: 'v1.2.0', FalconEnemy: 'v1.2.0', BatEnemy: 'v1.2.0', SquirrelEnemy: 'v1.0.0', BaseWeapon: 'v1.0.0', VulcanCannon: 'v1.0.0', PulseCannon: 'v1.0.0', RailCannon: 'v1.0.0', BaseRocket: 'v1.0.0', StunRockets: 'v1.0.0', NapalmRockets: 'v1.0.0', CatShipFactory: 'v3.71.0', MiniShip: 'v3.73.0', SuperNova: 'v1.0.0' };
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
// v3.64.0: + dragon (dragon enemy pixel-art sprite swap).
// v3.65.0: + falcon (falcon enemy pixel-art sprite swap).
// v3.66.0: + bat (bat enemy pixel-art sprite swap).
// v3.67.0: + squirrel (squirrel enemy — 19th species).
// v3.72.0: + cat_black / cat_blue / cat_brown / cat_gray / cat_green /
//          cat_orange / cat_red / cat_white / cat_yellow (9 catship theme sprites).
const EXPECTED_KEYS = ['health', 'extralife', 'shield', 'frenzy', 'wasp', 'butterfly', 'rat', 'crate', 'ufo1', 'ufo2', 'shuttle', 'moth', 'beetle', 'femur', 'profile_bone', 'skeleton', 'skull', 'spider', 'snake', 'wanted', 'wolf', 'lizard', 'dragon', 'falcon', 'bat', 'squirrel', 'cat_black', 'cat_blue', 'cat_brown', 'cat_gray', 'cat_green', 'cat_orange', 'cat_red', 'cat_white', 'cat_yellow'];
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
  check('PlayerRenderer: SHIELD_BUBBLE_RADIUS = 110 (v3.47.0: glow covers the 2x hull + minis)', /SHIELD_BUBBLE_RADIUS\s*=\s*110/.test(prSrc));
  check('PlayerRenderer: yellow shield GLOW (radial gradient, no hard rim) while shield > 0',
    prSrc.includes('if (p.shield > 0)') && prSrc.includes('createRadialGradient') && prSrc.includes('rgba(255, 213, 79'));
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
check('config: ENEMY_TYPES has 19 species (shuttle + moth + squirrel)', Object.keys(ENEMY_TYPES).length === 19, `got ${Object.keys(ENEMY_TYPES).length}: ${Object.keys(ENEMY_TYPES).join(', ')}`);
check('config: shuttle entry (Space Shuttle, glide pattern)', ENEMY_TYPES.shuttle && ENEMY_TYPES.shuttle.name === 'Space Shuttle' && ENEMY_TYPES.shuttle.pattern === 'glide', `got ${JSON.stringify(ENEMY_TYPES.shuttle)}`);
check('config: WAVE.SPECIES_COUNT = 19', WAVE.SPECIES_COUNT === 19, `got ${WAVE.SPECIES_COUNT}`);
const { isValidEnemyType, getEnemyClass, getEnemyTypeIds } = await mod('js/enemies/EnemyFactory.js');
check('EnemyFactory: shuttle registered in REGISTRY', isValidEnemyType('shuttle') && getEnemyTypeIds().includes('shuttle'));
check('EnemyFactory: getEnemyClass("shuttle") is the ShuttleEnemy class', typeof getEnemyClass('shuttle') === 'function' && getEnemyClass('shuttle').name === 'ShuttleEnemy', `got ${getEnemyClass('shuttle') && getEnemyClass('shuttle').name}`);
const { default: ShuttleEnemy } = await mod('js/enemies/ShuttleEnemy.js');
const seSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/ShuttleEnemy.js'), 'utf8');
check('ShuttleEnemy: extends EnemyBase, sprite key "shuttle", banked-strafe + telegraph', Object.getPrototypeOf(ShuttleEnemy.prototype).constructor.name === 'EnemyBase' && seSrc.includes("SHUTTLE_SPRITE_KEY = 'shuttle'") && seSrc.includes('this.bank') && seSrc.includes('this.telegraph'));
// Regular waves: WaveManager's species pool is Object.keys(ENEMY_TYPES) —
// a headless instance must list shuttle + moth + squirrel among its 19 species.
const { default: WaveManager } = await mod('js/core/WaveManager.js');
const wm = new WaveManager({});
check('WaveManager: regular-wave species pool includes shuttle + moth + squirrel (19 total)', wm.species.includes('shuttle') && wm.species.includes('moth') && wm.species.includes('squirrel') && wm.species.length === 19, `got ${wm.species.length}: ${wm.species.join(', ')}`);
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
  check('BonusLevel: VERSION = v3.76.0', blSrc.includes("VERSION = 'v3.76.0'"));
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
  check('BoneYardBonus: VERSION = v3.76.0', bySrc.includes("VERSION = 'v3.76.0'"));
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
  yard.init(); // v3.76.0: uniform stage interface (was start())
  const field = game.bonusTargets;
  check('BoneYard: seeded field = 29 destructible bones', field.length === 29, `got ${field.length}`);
  const count = (k) => field.filter((b) => b.spriteKey === k).length;
  check('BoneYard: field mix 10 femur / 10 profile_bone / 6 skull / 3 skeleton', count('femur') === 10 && count('profile_bone') === 10 && count('skull') === 6 && count('skeleton') === 3, `got ${count('femur')}/${count('profile_bone')}/${count('skull')}/${count('skeleton')}`);
  check('BoneYard: every field bone is damageable (alive, hp > 0, applyDamage)', field.every((b) => b.alive && b.hp > 0 && typeof b.applyDamage === 'function'));
  check('BoneYard: field drift 6–18 px/s, no horizontal drift', field.every((b) => b.vy >= 6 && b.vy <= 18 && b.vx === 0));
  check('BoneYard: skeleton sentinels hug the left/right margins', field.filter((b) => b.spriteKey === 'skeleton').every((b) => b.x < 240 || b.x > 1680));
  const game2 = mkGame();
  new BoneYardBonus(game2).init(); // v3.76.0: uniform stage interface
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
//  [6q] v3.64.0 DRAGON PIXEL-ART SPRITE — fire-breather now draws
//       the shared PNG (key "dragon", 800×800 → 128×128) with a
//       flight gait (sway/bob/tilt phase-locked to the horizontal
//       weave + wing-beat) + type-color accent glow + pulsing
//       fire-throat glow; procedural fallback retained
// ═══════════════════════════════════════════════════════════
console.log('\n[6q] v3.64.0 dragon pixel-art sprite');
{
  const deSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/DragonEnemy.js'), 'utf8');
  check('DragonEnemy: VERSION = v1.2.0', deSrc.includes("VERSION = 'v1.2.0'"));
  check('DragonEnemy: sprite key "dragon" via AssetManager', deSrc.includes("DRAGON_SPRITE_KEY = 'dragon'") && deSrc.includes('getSprite(DRAGON_SPRITE_KEY)'));
  check('DragonEnemy: null-sprite → procedural fallback branch', deSrc.includes('this._drawProcedural(ctx, r)'));
  check('DragonEnemy: flight gait phase-locked to the weave (t*0.8) + wing-beat (t*5)', deSrc.includes('const weave = Math.sin(this.t * 0.8)') && deSrc.includes('const flap = Math.sin(this.t * 5)'));
  check('DragonEnemy: aspect-preserving nearest-neighbor draw', deSrc.includes('(targetW * dims.h) / dims.w') && deSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('DragonEnemy: type-color accent glow pass', deSrc.includes('ctx.shadowColor = this.color') && deSrc.includes('ctx.shadowBlur = r * 0.8'));
  check('DragonEnemy: pulsing fire-throat glow while breathing', deSrc.includes('const fireGlow = 0.5 + 0.5 * Math.sin(this.t * 3)') && deSrc.includes('rgba(255, 110, 20, 0.8)'));
  check('DragonEnemy: procedural fallback art intact (wings/scales/tail)', deSrc.includes('lwGrad') && deSrc.includes('bodyGrad') && deSrc.includes('tailSway'));
  check('DragonEnemy: movement + attack unchanged (weave 200 / 5-shot cone 210)', deSrc.includes('Math.sin(this.t * 0.8) * 200') && deSrc.includes('fireAtPlayer(a + i * 0.14, 210, 0.7)'));
  check('config: ENEMY_TYPES.dragon intact (color/speed/hp/damage/fireRate/pattern)',
    ENEMY_TYPES.dragon && ENEMY_TYPES.dragon.color === '#d64545' && ENEMY_TYPES.dragon.speed === 1.6 &&
    ENEMY_TYPES.dragon.hp === 70 && ENEMY_TYPES.dragon.damage === 20 && ENEMY_TYPES.dragon.fireRate === 1.8 &&
    ENEMY_TYPES.dragon.pattern === 'breath',
    `got ${JSON.stringify(ENEMY_TYPES.dragon)}`);
  check('AssetSprites: dragon sprite dims 128×128 registered', /dragon:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(spritesSrc));
  check('AssetSprites: dragon source 800×800 → 128×128', /dragon: "Dragon-pixel-art\.png \(800×800 → 128×128,/.test(spritesSrc));
}

// ═══════════════════════════════════════════════════════════
//  [6r] v3.65.0 FALCON PIXEL-ART SPRITE — diving raptor now draws
//       the shared PNG (key "falcon", 718×718 → 128×128) with a
//       beak-lead dive rotation (heading eases toward the dive
//       vector, blit rotated by heading + PI/2 since the art faces
//       up) + wing-beat (t*6) + hover bob + type-color accent glow;
//       procedural fallback retained
// ═══════════════════════════════════════════════════════════
console.log('\n[6r] v3.65.0 falcon pixel-art sprite');
{
  const faSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/FalconEnemy.js'), 'utf8');
  check('FalconEnemy: VERSION = v1.2.0', faSrc.includes("VERSION = 'v1.2.0'"));
  check('FalconEnemy: sprite key "falcon" via AssetManager', faSrc.includes("FALCON_SPRITE_KEY = 'falcon'") && faSrc.includes('getSprite(FALCON_SPRITE_KEY)'));
  check('FalconEnemy: null-sprite → procedural fallback branch', faSrc.includes('this._drawProcedural(ctx, r)'));
  check('FalconEnemy: beak-lead dive heading eases toward the dive vector (dh * 0.18)', faSrc.includes('this._heading += dh * 0.18'));
  check('FalconEnemy: blit rotated by heading + PI/2 (art faces up)', faSrc.includes('this._heading + Math.PI / 2'));
  check('FalconEnemy: wing-beat (t*6) + hover bob phase-locked to the procedural flap', faSrc.includes('const flap = Math.sin(this.t * 6)') && faSrc.includes('const bob = Math.sin(this.t * 3)'));
  check('FalconEnemy: aspect-preserving nearest-neighbor draw', faSrc.includes('(targetW * dims.h) / dims.w') && faSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('FalconEnemy: type-color accent glow pass', faSrc.includes('ctx.shadowColor = this.color') && faSrc.includes('ctx.shadowBlur = r * 0.8'));
  check('FalconEnemy: procedural fallback art intact (wings/tail fan/talons)', faSrc.includes('tailSpread') && faSrc.includes('lwGrad') && faSrc.includes('bodyGrad'));
  check('FalconEnemy: dive multiplier * 1.5 + attack fireAtPlayer(a, 280, 1) unchanged', faSrc.includes('s * dt * 1.5') && faSrc.includes('fireAtPlayer(a, 280, 1)'));
  check('config: ENEMY_TYPES.falcon intact (color/speed/hp/damage/fireRate/pattern)',
    ENEMY_TYPES.falcon && ENEMY_TYPES.falcon.color === '#b0713a' && ENEMY_TYPES.falcon.speed === 3.2 &&
    ENEMY_TYPES.falcon.hp === 22 && ENEMY_TYPES.falcon.damage === 12 && ENEMY_TYPES.falcon.fireRate === 1.0 &&
    ENEMY_TYPES.falcon.pattern === 'dive',
    `got ${JSON.stringify(ENEMY_TYPES.falcon)}`);
  check('AssetSprites: falcon sprite dims 128×128 registered', /falcon:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(spritesSrc));
  check('AssetSprites: falcon source 718×718 → 128×128', /falcon: "Falcon pixel_art\.png \(718×718 → 128×128,/.test(spritesSrc));
  // v3.71.1 regression gate: the embedded falcon art must face UP (beak in
  // the top half). Since v3.65.0 the source PNG was stored vertically
  // flipped (beak down), so the raptor rendered upside down on canvas —
  // headless decode of the embedded b64 (pure Node zlib, no DOM).
  {
    const falconB64 = (spritesSrc.match(/falcon: "([A-Za-z0-9+/=]+)"/) || [])[1];
    let beakTop = 0, beakTotal = 0;
    if (falconB64) {
      const buf = Buffer.from(falconB64, 'base64');
      let off = 8, w = 0, h = 0, ch = 0;
      const idat = [];
      while (off + 12 <= buf.length) {
        const len = buf.readUInt32BE(off);
        const type = buf.toString('ascii', off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[data[9]]; }
        else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        off += 12 + len;
      }
      const stride = w * ch;
      const raw = zlib.inflateSync(Buffer.concat(idat));
      const px = Buffer.alloc(h * stride);
      for (let y = 0; y < h; y++) {
        const filter = raw[y * (stride + 1)];
        const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
        for (let x = 0; x < stride; x++) {
          const a = x >= ch ? px[y * stride + x - ch] : 0;
          const b = prev ? prev[x] : 0;
          const c = prev && x >= ch ? prev[x - ch] : 0;
          let v = line[x];
          if (filter === 1) v = (v + a) & 255;
          else if (filter === 2) v = (v + b) & 255;
          else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
          else if (filter === 4) { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
          px[y * stride + x] = v;
        }
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * ch;
        const r = px[i], g = px[i + 1], b = px[i + 2], al = ch === 4 ? px[i + 3] : 255;
        if (al < 16) continue;
        if (r > 170 && g > 90 && g < 215 && b < 125 && r > g && g > b) {
          beakTotal++;
          if (y < h / 2) beakTop++;
        }
      }
    }
    check('AssetSprites: falcon art faces up — beak pixels in top half (v3.71.1 flip fix)', beakTotal > 0 && beakTop > beakTotal / 2, `beak pixels top/bottom: ${beakTop}/${beakTotal - beakTop}`);
  }
}

// ═══════════════════════════════════════════════════════════
//  [6s] v3.66.0 BAT PIXEL-ART SPRITE — erratic flutterer now draws
//       the shared PNG (key "bat", 679×367 → 128×69) upright
//       (head/ears up, wings spread) with a wing-beat (t*14) +
//       flutter wobble + hover bob (t*3) phase-locked to the
//       procedural flap + type-color accent glow; procedural
//       fallback retained
// ═══════════════════════════════════════════════════════════
console.log('\n[6s] v3.66.0 bat pixel-art sprite');
{
  const baSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/BatEnemy.js'), 'utf8');
  check('BatEnemy: VERSION = v1.2.0', baSrc.includes("VERSION = 'v1.2.0'"));
  check('BatEnemy: sprite key "bat" via AssetManager', baSrc.includes("BAT_SPRITE_KEY = 'bat'") && baSrc.includes('getSprite(BAT_SPRITE_KEY)'));
  check('BatEnemy: null-sprite → procedural fallback branch', baSrc.includes('this._drawProcedural(ctx, r)'));
  check('BatEnemy: wing-beat (t*14) + hover bob (t*3) phase-locked to the procedural flap', baSrc.includes('const flap = Math.sin(this.t * 14)') && baSrc.includes('const bob = Math.sin(this.t * 3)'));
  check('BatEnemy: aspect-preserving nearest-neighbor draw', baSrc.includes('(targetW * dims.h) / dims.w') && baSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('BatEnemy: type-color accent glow pass', baSrc.includes('ctx.shadowColor = this.color') && baSrc.includes('ctx.shadowBlur = r * 0.8'));
  check('BatEnemy: procedural fallback art intact (scallop wings/wing bones/fangs)', baSrc.includes('lwGrad') && baSrc.includes('bodyGrad') && baSrc.includes('#ff1744'));
  check('BatEnemy: erratic jitter + attack fireAtPlayer(a, 240, 0.9) unchanged', baSrc.includes('s * dt * 0.7') && baSrc.includes('fireAtPlayer(a, 240, 0.9)'));
  check('config: ENEMY_TYPES.bat intact (color/speed/hp/damage/fireRate/pattern)',
    ENEMY_TYPES.bat && ENEMY_TYPES.bat.color === '#5d5d7a' && ENEMY_TYPES.bat.speed === 2.8 &&
    ENEMY_TYPES.bat.hp === 16 && ENEMY_TYPES.bat.damage === 8 && ENEMY_TYPES.bat.fireRate === 0.9 &&
    ENEMY_TYPES.bat.pattern === 'erratic',
    `got ${JSON.stringify(ENEMY_TYPES.bat)}`);
  check('AssetSprites: bat sprite dims 128×69 registered', /bat:\s*\{\s*w:\s*128,\s*h:\s*69\s*\}/.test(spritesSrc));
  check('AssetSprites: bat source 679×367 → 128×69', /bat: "Bat-pixel-art\.png \(679×367 → 128×69,/.test(spritesSrc));
}

// ═══════════════════════════════════════════════════════════
//  [6t] v3.67.0 SQUIRREL ENEMY (19th species) — fast, erratic
//       tree-dweller with a bushy tail; draws the shared PNG
//       (key "squirrel", 580×476 → 128×105) upright (head up,
//       centered mass) with a scurry bounce (t*16) + twitchy
//       wobble (t*4.2) + sprint stretch + type-color accent
//       glow; procedural fallback retained; scurry + hop
//       movement, light aimed shot
// ═══════════════════════════════════════════════════════════
console.log('\n[6t] v3.67.0 squirrel enemy (19th species)');
{
  const sqSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/SquirrelEnemy.js'), 'utf8');
  check('SquirrelEnemy: VERSION = v1.0.0', sqSrc.includes("VERSION = 'v1.0.0'"));
  check('SquirrelEnemy: sprite key "squirrel" via AssetManager', sqSrc.includes("SQUIRREL_SPRITE_KEY = 'squirrel'") && sqSrc.includes('getSprite(SQUIRREL_SPRITE_KEY)'));
  check('SquirrelEnemy: null-sprite → procedural fallback branch', sqSrc.includes('this._drawProcedural(ctx, r)'));
  check('SquirrelEnemy: scurry bounce (t*16) + twitchy wobble (t*4.2)', sqSrc.includes('const bounce = Math.sin(this.t * 16)') && sqSrc.includes('const wobble = Math.sin(this.t * 4.2) * 0.07'));
  check('SquirrelEnemy: aspect-preserving nearest-neighbor draw', sqSrc.includes('(targetW * dims.h) / dims.w') && sqSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('SquirrelEnemy: type-color accent glow pass', sqSrc.includes('ctx.shadowColor = this.color') && sqSrc.includes('ctx.shadowBlur = r * 0.8'));
  check('SquirrelEnemy: procedural fallback art intact (bushy tail/body/perked ears)', sqSrc.includes('tailGrad') && sqSrc.includes('bodyGrad') && sqSrc.includes('#ffd54f'));
  check('SquirrelEnemy: fast scurry descent + erratic hop + lateral sprints', sqSrc.includes('s * dt * 0.95') && sqSrc.includes('this._hopVy') && sqSrc.includes('this._sprintVx') && sqSrc.includes('this._sprintT'));
  check('SquirrelEnemy: light aimed shot fireAtPlayer(a, 260, 0.85)', sqSrc.includes('fireAtPlayer(this.angleToPlayer(), 260, 0.85)'));
  check('config: ENEMY_TYPES.squirrel registered (speed 3.4 / hp 12 / damage 7 / scurry)',
    ENEMY_TYPES.squirrel && ENEMY_TYPES.squirrel.name === 'Squirrel' && ENEMY_TYPES.squirrel.color === '#a5622d' &&
    ENEMY_TYPES.squirrel.speed === 3.4 && ENEMY_TYPES.squirrel.hp === 12 && ENEMY_TYPES.squirrel.damage === 7 &&
    ENEMY_TYPES.squirrel.fireRate === 0.7 && ENEMY_TYPES.squirrel.pattern === 'scurry',
    `got ${JSON.stringify(ENEMY_TYPES.squirrel)}`);
  check('EnemyFactory: squirrel registered in REGISTRY', isValidEnemyType('squirrel') && getEnemyTypeIds().includes('squirrel'));
  check('EnemyFactory: getEnemyClass("squirrel") is the SquirrelEnemy class', typeof getEnemyClass('squirrel') === 'function' && getEnemyClass('squirrel').name === 'SquirrelEnemy', `got ${getEnemyClass('squirrel') && getEnemyClass('squirrel').name}`);
  const { default: SquirrelEnemy } = await mod('js/enemies/SquirrelEnemy.js');
  check('SquirrelEnemy: extends EnemyBase', Object.getPrototypeOf(SquirrelEnemy.prototype).constructor.name === 'EnemyBase');
  check('AssetSprites: squirrel sprite dims 128×105 registered', /squirrel:\s*\{\s*w:\s*128,\s*h:\s*105\s*\}/.test(spritesSrc));
  check('AssetSprites: squirrel source 580×476 → 128×105', /squirrel: "Squirel pixel_art\.png \(580×476 → 128×105,/.test(spritesSrc));
}

// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
//  [6u] v3.68.0 MODULAR WEAPON ARCHITECTURE (Phase 1) —
//      BaseWeapon contract (fire / update / draw / reset /
//      canFire + owner-backed cooldown & lockout) + the
//      VulcanCannon extraction: state stays on Player
//      (fireTimer / thermal / thermalLockout), firing logic
//      moves to js/combat, PlayerWeapons delegates
// ═══════════════════════════════════════════════════════════
console.log('\n[6u] v3.68.0 modular weapon architecture (BaseWeapon + VulcanCannon)');
{
  const { default: BaseWeapon } = await mod('js/combat/BaseWeapon.js');
  const { default: VulcanCannon } = await mod('js/combat/VulcanCannon.js');
  const bwSrc = fs.readFileSync(path.join(ROOT, 'js/combat/BaseWeapon.js'), 'utf8');
  const vcSrc = fs.readFileSync(path.join(ROOT, 'js/combat/VulcanCannon.js'), 'utf8');
  check('BaseWeapon: VERSION = v1.0.0', bwSrc.includes("VERSION = 'v1.0.0'"));
  check('VulcanCannon: VERSION = v1.0.0', vcSrc.includes("VERSION = 'v1.0.0'"));
  check('VulcanCannon: extends BaseWeapon', Object.getPrototypeOf(VulcanCannon.prototype).constructor.name === 'BaseWeapon');
  check('BaseWeapon: abstract fire() throws for unimplemented weapons', (() => {
    const w = new BaseWeapon(makePlayer(makeGame()), 'vulkan');
    let threw = false;
    try { w.fire(0); } catch { threw = true; }
    return threw;
  })());
  check('BaseWeapon: cooldown maps to owner.fireTimer (get + set)', (() => {
    const p = makePlayer(makeGame());
    const w = new BaseWeapon(p, 'vulkan');
    w.cooldown = 0.25;
    return p.fireTimer === 0.25 && w.cooldown === 0.25;
  })());
  check('BaseWeapon: lockout maps to owner.thermalLockout (get + set)', (() => {
    const p = makePlayer(makeGame());
    const w = new BaseWeapon(p, 'vulkan');
    w.lockout = 0.5;
    return p.thermalLockout === 0.5 && w.lockout === 0.5;
  })());
  check('BaseWeapon: canFire() gates on cooldown + lockout + ammo', (() => {
    const p = makePlayer(makeGame());
    const w = new BaseWeapon(p, 'vulkan');
    if (!w.canFire()) return false;
    p.fireTimer = 0.1;
    const gatedByCooldown = !w.canFire();
    p.fireTimer = 0; p.thermalLockout = 0.1;
    const gatedByLockout = !w.canFire();
    p.thermalLockout = 0; w.ammo = 0;
    const gatedByAmmo = !w.canFire();
    return gatedByCooldown && gatedByLockout && gatedByAmmo;
  })());
  // Player owns the registry + the canonical state fields
  const pSrc = fs.readFileSync(path.join(ROOT, 'js/player/Player.js'), 'utf8');
  check('Player: imports VulcanCannon + owns the weapons registry',
    pSrc.includes("import VulcanCannon from '../combat/VulcanCannon.js'") &&
    pSrc.includes('new VulcanCannon(this)'));
  check('Player: respawn resets modular weapon state (weapons.vulkan.reset)', pSrc.includes('this.weapons.vulkan.reset()'));
  check('Player: canonical state fields intact (fireTimer / thermal / thermalLockout)',
    pSrc.includes('this.fireTimer = 0;') && pSrc.includes('this.thermal = 0;') && pSrc.includes('this.thermalLockout = 0;'));
  // PlayerWeapons delegates to p.weapons[p.weapon]
  const pwSrc2 = fs.readFileSync(path.join(ROOT, 'js/player/PlayerWeapons.js'), 'utf8');
  check('PlayerWeapons: fireNow gate delegates to weapon.canFire()',
    pwSrc2.includes('const weapon = p.weapons && p.weapons[p.weapon];') && pwSrc2.includes('if (!weapon.canFire()) return false;'));
  check('PlayerWeapons: firePrimary delegates volleys to weapon.fire()',
    pwSrc2.includes('weapon.fire(aim, { dmgMul, homing: aimAssist(p) })'));
  check('PlayerWeapons: updateWeaponState ticks weapon.update(dt)', pwSrc2.includes('weapon.update(dt);'));
  check('PlayerWeapons: cycleWeapon resets modular weapon state', pwSrc2.includes('weapon.reset();'));
  check('PlayerWeapons: inline fallback kept for un-extracted weapons',
    pwSrc2.includes("if (p.weapon === 'vulkan' && p.thermal > 0)"));
  // Headless: the delegated vulkan keeps its exact v3.67.0 behavior
  const game = makeGame();
  const p = makePlayer(game);
  p.weapon = 'vulkan';
  check('Player: weapons.vulkan is a VulcanCannon instance', p.weapons.vulkan instanceof VulcanCannon);
  let shots = 0;
  for (let i = 0; i < 20; i++) { p.fireTimer = 0; if (fireNow(p)) shots++; }
  check('v3.68.0: 20 delegated vulkan shots all fire', shots === 20, `got ${shots}`);
  check('v3.68.0: overheat sets lockout 1.2s on shot 20 (state on Player)',
    p.thermalLockout === WEAPONS.vulkan.thermalLockout, `got ${p.thermalLockout}`);
  check('v3.68.0: thermal resets to 0 on overheat', p.thermal === 0, `got ${p.thermal}`);
  check('v3.68.0: twin tips × 20 shots = 40 bullets', game.bullets.length === 40, `got ${game.bullets.length}`);
  p.fireTimer = 0;
  check('v3.68.0: fireNow() blocked during lockout (delegated gate)', fireNow(p) === false);
  p.thermal = 0.5; p.thermalLockout = 0;
  updateWeaponState(p, 1);
  check('v3.68.0: updateWeaponState → VulcanCannon.update decays thermal 0.5 → 0.15',
    Math.abs(p.thermal - 0.15) < 1e-9, `got ${p.thermal}`);
  cycleWeapon(p, 1);
  check('v3.68.0: weapon switch clears vulkan thermal/lockout',
    p.thermal === 0 && p.thermalLockout === 0, `thermal=${p.thermal} lockout=${p.thermalLockout}`);
}

// ═══════════════════════════════════════════════════════════
//  [6v] v3.69.0 MODULAR WEAPON ARCHITECTURE (Phase 2) —
//      PulseCannon (plasma twin-pod 3-bolt fan) + RailCannon
//      (piercing beam + charge-up visual) extracted; the inline
//      plasma/rail volleys + rail charge visual are gone from
//      PlayerWeapons, and all 3 primary weapons are modular
// ═══════════════════════════════════════════════════════════
console.log('\n[6v] v3.69.0 modular weapon architecture (PulseCannon + RailCannon)');
{
  const { default: PulseCannon } = await mod('js/combat/PulseCannon.js');
  const { default: RailCannon } = await mod('js/combat/RailCannon.js');
  const pcSrc = fs.readFileSync(path.join(ROOT, 'js/combat/PulseCannon.js'), 'utf8');
  const rcSrc = fs.readFileSync(path.join(ROOT, 'js/combat/RailCannon.js'), 'utf8');
  check('PulseCannon: VERSION = v1.0.0', pcSrc.includes("VERSION = 'v1.0.0'"));
  check('RailCannon: VERSION = v1.0.0', rcSrc.includes("VERSION = 'v1.0.0'"));
  check('PulseCannon: extends BaseWeapon', Object.getPrototypeOf(PulseCannon.prototype).constructor.name === 'BaseWeapon');
  check('RailCannon: extends BaseWeapon', Object.getPrototypeOf(RailCannon.prototype).constructor.name === 'BaseWeapon');
  // Player owns the full registry + respawn resets all three
  const pSrc2 = fs.readFileSync(path.join(ROOT, 'js/player/Player.js'), 'utf8');
  check('Player: imports PulseCannon + RailCannon',
    pSrc2.includes("import PulseCannon from '../combat/PulseCannon.js'") &&
    pSrc2.includes("import RailCannon from '../combat/RailCannon.js'"));
  check('Player: registry owns all 3 primary weapons (vulkan/plasma/rail)',
    pSrc2.includes('new VulcanCannon(this)') && pSrc2.includes('new PulseCannon(this)') && pSrc2.includes('new RailCannon(this)'));
  check('Player: respawn resets plasma + rail modular state',
    pSrc2.includes('this.weapons.plasma.reset()') && pSrc2.includes('this.weapons.rail.reset()'));
  // PlayerWeapons: inline plasma/rail volleys + rail charge visual removed
  const pwSrc3 = fs.readFileSync(path.join(ROOT, 'js/player/PlayerWeapons.js'), 'utf8');
  check('PlayerWeapons: inline plasma volley removed (no case left)', !pwSrc3.includes("case 'plasma'"));
  check('PlayerWeapons: inline rail volley removed (no case left)', !pwSrc3.includes("case 'rail'"));
  check('PlayerWeapons: rail charge visual moved out (no chargeTime left)', !pwSrc3.includes('chargeTime'));
  check('RailCannon: charge visual reads the shared cooldown window', rcSrc.includes('this.cooldown > 0 && this.cooldown < w.chargeTime'));
  // Headless: delegated plasma keeps its exact v3.67.0 twin-pod behavior
  const game = makeGame();
  const p = makePlayer(game);
  check('Player: weapons.plasma is a PulseCannon instance', p.weapons.plasma instanceof PulseCannon);
  check('Player: weapons.rail is a RailCannon instance', p.weapons.rail instanceof RailCannon);
  p.weapon = 'plasma';
  let shots = 0;
  for (let i = 0; i < 5; i++) { p.fireTimer = 0; if (fireNow(p)) shots++; }
  check('v3.69.0: 5 delegated plasma shots all fire', shots === 5, `got ${shots}`);
  check('v3.69.0: twin pods × 3-bolt fan × 5 shots = 30 bullets', game.bullets.length === 30, `got ${game.bullets.length}`);
  check('v3.69.0: plasma bolts carry shieldMelt 15', game.bullets.every(b => b.shieldMelt === WEAPONS.plasma.shieldMelt));
  check('v3.69.0: plasma never builds thermal (no heat state)', p.thermal === 0, `got ${p.thermal}`);
  // Headless: delegated rail keeps its exact v3.67.0 piercing behavior
  p.weapon = 'rail';
  p.fireTimer = 0;
  check('v3.69.0: fireNow() fires the delegated rail', fireNow(p) === true);
  check('v3.69.0: rail sets the shared cooldown to rate 1.0s', p.fireTimer === WEAPONS.rail.rate, `got ${p.fireTimer}`);
  check('v3.69.0: fireNow() blocked while the rail cooldown ticks', fireNow(p) === false);
  const railBolts = game.bullets.filter(b => b.weapon === 'rail');
  check('v3.69.0: one piercing rail bolt per shot', railBolts.length === 1, `got ${railBolts.length}`);
  check('v3.69.0: rail bolt pierces 999 at 1500 px/s',
    railBolts[0].pierce === 999 && Math.abs(Math.hypot(railBolts[0].vx, railBolts[0].vy) - WEAPONS.rail.speed) < 1e-6);
  check('v3.69.0: rail impact FX (muzzleFlash 0.18 + shake ≥ 5)',
    p.muzzleFlash === 0.18 && game.shake >= 5, `flash=${p.muzzleFlash} shake=${game.shake}`);
  // Rail charge-up visual: RailCannon.update ticks without error mid-charge
  p.fireTimer = WEAPONS.rail.chargeTime / 2;
  updateWeaponState(p, 0.016);
  check('v3.69.0: RailCannon.update ticks mid-charge without error', p.fireTimer > 0);
  // Weapon-switch invariant: switching away from an overheated Vulcan
  // clears the lockout for the next (modular) weapon — v3.67.0 behavior
  p.weapon = 'vulkan';
  p.thermal = 0.8;
  p.thermalLockout = WEAPONS.vulkan.thermalLockout;
  cycleWeapon(p, 1);
  check('v3.69.0: switch vulkan→plasma clears thermal/lockout (PulseCannon.reset)',
    p.weapon === 'plasma' && p.thermal === 0 && p.thermalLockout === 0,
    `weapon=${p.weapon} thermal=${p.thermal} lockout=${p.thermalLockout}`);
  cycleWeapon(p, 1);
  check('v3.69.0: switch plasma→rail clears thermal/lockout (RailCannon.reset)',
    p.weapon === 'rail' && p.thermal === 0 && p.thermalLockout === 0,
    `weapon=${p.weapon} thermal=${p.thermal} lockout=${p.thermalLockout}`);
}

// ═══════════════════════════════════════════════════════════
//  [6w] v3.70.0 MODULAR SPECIALIZED ROCKETS — BaseRocket (shared
//        twin-salvo base) + StunRockets (Q/H homing) + NapalmRockets
//        (E/J straight). js/combat/Rockets.js is deleted; the twin-salvo
//        deploy, per-frame steering, and impact AoE now live in the three
//        modules and are ticked from Game.update before bullet integration.
// ═══════════════════════════════════════════════════════════
console.log('\n[6w] v3.70.0 modular specialized rockets (BaseRocket + StunRockets + NapalmRockets)');
{
  const { default: BaseRocket } = await mod('js/combat/BaseRocket.js');
  const { default: StunRockets, stunRockets } = await mod('js/combat/StunRockets.js');
  const { default: NapalmRockets, napalmRockets } = await mod('js/combat/NapalmRockets.js');
  const brSrc = fs.readFileSync(path.join(ROOT, 'js/combat/BaseRocket.js'), 'utf8');
  const srSrc = fs.readFileSync(path.join(ROOT, 'js/combat/StunRockets.js'), 'utf8');
  const nrSrc = fs.readFileSync(path.join(ROOT, 'js/combat/NapalmRockets.js'), 'utf8');
  const { ROCKETS } = await mod('js/core/config.js');

  // ── Source gates ──
  check('BaseRocket: VERSION = v1.0.0', brSrc.includes("VERSION = 'v1.0.0'"));
  check('StunRockets: VERSION = v1.0.0', srSrc.includes("VERSION = 'v1.0.0'"));
  check('NapalmRockets: VERSION = v1.0.0', nrSrc.includes("VERSION = 'v1.0.0'"));
  check('StunRockets: extends BaseRocket', Object.getPrototypeOf(StunRockets.prototype).constructor.name === 'BaseRocket');
  check('NapalmRockets: extends BaseRocket', Object.getPrototypeOf(NapalmRockets.prototype).constructor.name === 'BaseRocket');
  check('BaseRocket: abstract kind/launch/steer/detonate all throw', (() => {
    let threw = 0;
    const b = new BaseRocket();
    try { b.kind; } catch { threw++; }
    try { b.launch({}, {}); } catch { threw++; }
    try { b.steer({}, {}, 0); } catch { threw++; }
    try { b.detonate({}, {}, 0, 0); } catch { threw++; }
    return threw === 4;
  })());
  check('BaseRocket: _deploySalvo tags rocketKind + launch FX (shake ≥ 3)',
    brSrc.includes('b.rocketKind = this.kind;') && brSrc.includes('game.shake = Math.max(game.shake, 3)'));
  check('BaseRocket: update() filters live carriers by rocketKind',
    brSrc.includes('if (!b.alive || b.rocketKind !== this.kind) continue;'));
  check('StunRockets: kind = stun + no direct damage (damage: 0)', srSrc.includes("get kind() { return 'stun'; }") && srSrc.includes('damage: 0'));
  check('NapalmRockets: kind = napalm + chip damage (ROCKETS.napalmChip)', nrSrc.includes("get kind() { return 'napalm'; }") && nrSrc.includes('damage: ROCKETS.napalmChip'));
  check('StunRockets: module-level stunRockets singleton', stunRockets instanceof StunRockets);
  check('NapalmRockets: module-level napalmRockets singleton', napalmRockets instanceof NapalmRockets);

  // Game.js: imports both singletons + ticks them before bullet integration
  const gameSrc2 = fs.readFileSync(path.join(ROOT, 'js/core/Game.js'), 'utf8');
  check('Game: imports stunRockets + napalmRockets',
    gameSrc2.includes("import { stunRockets } from '../combat/StunRockets.js'") &&
    gameSrc2.includes("import { napalmRockets } from '../combat/NapalmRockets.js'"));
  check('Game: ticks stunRockets.update + napalmRockets.update',
    gameSrc2.includes('stunRockets.update(this, dt);') && gameSrc2.includes('napalmRockets.update(this, dt);'));
  check('Game: rocket update runs before bullet position integration',
    gameSrc2.indexOf('stunRockets.update(this, dt);') !== -1 &&
    gameSrc2.indexOf('stunRockets.update(this, dt);') < gameSrc2.indexOf('for (const b of this.bullets) b.update(dt);'));

  // PlayerWeapons: fires delegate to the module singletons (no inline salvo)
  const pwSrc4 = fs.readFileSync(path.join(ROOT, 'js/player/PlayerWeapons.js'), 'utf8');
  check('PlayerWeapons: fireStunRockets delegates to stunRockets.launch', pwSrc4.includes('stunRockets.launch(p.game, p);'));
  check('PlayerWeapons: fireNapalmRockets delegates to napalmRockets.launch', pwSrc4.includes('napalmRockets.launch(p.game, p);'));
  check('PlayerWeapons: no stale launchRockets/updateRockets', !pwSrc4.includes('launchRockets') && !pwSrc4.includes('updateRockets'));
  check('Rockets.js deleted (no js/combat/Rockets.js)', !fs.existsSync(path.join(ROOT, 'js/combat/Rockets.js')));

  // ── Headless behavior ──
  const makeRocketGame = () => { const g = makeGame(); g.enemies = []; g.player = { minis: [] }; g.fireZones = []; return g; };
  const makeEnemy = (x, y, extra = {}) => ({
    alive: true, x, y, radius: 20, shield: 0, special: false,
    stunTimer: 0, shootTimer: 0, flash: 0, hp: 1000, color: '#ff0000', score: 100,
    applyDamage(d) { this.hp -= d; if (this.hp <= 0) this.alive = false; },
    ...extra,
  });

  // STUN launch: twin homing salvo, 0 damage, stun-colored carriers
  {
    const g = makeRocketGame();
    const p = makePlayer(g); p.x = 640; p.y = 400; p.angle = 0;
    stunRockets.launch(g, p);
    const rockets = g.bullets.filter(b => b.rocketKind === 'stun');
    check('stun launch: twin salvo (2 carriers)', rockets.length === 2, `got ${rockets.length}`);
    check('stun launch: carriers tagged rocketKind=stun + weapon=stun', rockets.every(b => b.rocketKind === 'stun' && b.weapon === 'stun'));
    check('stun launch: 0 direct damage + stun color', rockets.every(b => b.damage === 0 && b.color === ROCKETS.stunColor));
  }
  // STUN detonate: shield-strip + stun + fire suppression, no direct damage
  {
    const g = makeRocketGame();
    const p = makePlayer(g); p.x = 640; p.y = 400; p.angle = 0;
    const enemy = makeEnemy(640, 200, { shield: 50 });
    g.enemies.push(enemy);
    stunRockets.launch(g, p);
    for (const b of g.bullets) { b.x = enemy.x; b.y = enemy.y; } // place both on target
    stunRockets.update(g, 0.016);
    check('stun detonate: both carriers dead', g.bullets.every(b => !b.alive));
    check('stun detonate: enemy shield stripped to 0', enemy.shield === 0, `got ${enemy.shield}`);
    check('stun detonate: enemy stunned (stunTimer 1.0)', enemy.stunTimer === ROCKETS.stunDuration, `got ${enemy.stunTimer}`);
    check('stun detonate: fire suppressed (shootTimer 3.0)', enemy.shootTimer === ROCKETS.stunSuppress, `got ${enemy.shootTimer}`);
    check('stun detonate: no direct damage (hp unchanged)', enemy.hp === 1000, `got ${enemy.hp}`);
  }
  // NAPALM launch: twin straight salvo, chip damage, napalm-colored carriers
  {
    const g = makeRocketGame();
    const p = makePlayer(g); p.x = 640; p.y = 400; p.angle = 0;
    napalmRockets.launch(g, p);
    const rockets = g.bullets.filter(b => b.rocketKind === 'napalm');
    check('napalm launch: twin salvo (2 carriers)', rockets.length === 2, `got ${rockets.length}`);
    check('napalm launch: carriers tagged rocketKind=napalm + weapon=napalm', rockets.every(b => b.rocketKind === 'napalm' && b.weapon === 'napalm'));
    check('napalm launch: chip damage 12 + napalm color', rockets.every(b => b.damage === ROCKETS.napalmChip && b.color === ROCKETS.napalmColor));
  }
  // NAPALM detonate (self-destruct): AoE damage + lingering fire zone
  {
    const g = makeRocketGame();
    const p = makePlayer(g); p.x = 640; p.y = 400; p.angle = 0;
    const enemy = makeEnemy(0, 0);
    g.enemies.push(enemy);
    napalmRockets.launch(g, p);
    for (const b of g.bullets) { b.x = 100; b.y = 0; b.life = 0.01; } // in AoE (200px), outside clip range
    napalmRockets.update(g, 0.016);
    check('napalm detonate: both carriers dead', g.bullets.every(b => !b.alive));
    check('napalm detonate: enemy took 2×60 AoE damage', enemy.hp === 1000 - 2 * ROCKETS.napalmDamage, `got ${enemy.hp}`);
    check('napalm detonate: lingering fire zone spawned per impact', g.fireZones.length === 2, `got ${g.fireZones.length}`);
  }
  // NAPALM clip-hit: in-flight chip damage + detonation + fire zone
  {
    const g = makeRocketGame();
    const p = makePlayer(g); p.x = 640; p.y = 400; p.angle = 0;
    const enemy = makeEnemy(0, 0);
    g.enemies.push(enemy);
    napalmRockets.launch(g, p);
    const b = g.bullets.find(x => x.rocketKind === 'napalm');
    b.x = enemy.x; b.y = enemy.y; b.life = ROCKETS.life; // on target → clip hit
    napalmRockets.update(g, 0.016);
    check('napalm clip: carrier dead after impact', !b.alive);
    check('napalm clip: enemy took chip + AoE damage (12 + 60)', enemy.hp === 1000 - ROCKETS.napalmChip - ROCKETS.napalmDamage, `got ${enemy.hp}`);
    check('napalm clip: fire zone spawned', g.fireZones.length >= 1, `got ${g.fireZones.length}`);
  }
}

// ═══════════════════════════════════════════════════════════
//  [6x] v3.71.0 PHASE 4 MODULAR CAT-SHIP COMBAT — CatShipFactory
//        + MiniShip moved js/core/ → js/combat/, and the base
//        nova / synergy super-weapon volleys extracted from
//        Player.js into js/combat/SuperNova.js (fireNova /
//        fireSuperWeapon). Player.js now only delegates; the 5
//        cat variants still override activateUltimate.
// ═══════════════════════════════════════════════════════════
console.log('\n[6x] v3.71.0 Phase 4 modular cat-ship combat (CatShipFactory + MiniShip + SuperNova)');
{
  const { fireNova, fireSuperWeapon } = await mod('js/combat/SuperNova.js');
  const { default: MiniShip } = await mod('js/combat/MiniShip.js');
  const { createCatShip, createMiniShip } = await mod('js/combat/CatShipFactory.js');
  const csfSrc = fs.readFileSync(path.join(ROOT, 'js/combat/CatShipFactory.js'), 'utf8');
  const msSrc = fs.readFileSync(path.join(ROOT, 'js/combat/MiniShip.js'), 'utf8');
  const snSrc = fs.readFileSync(path.join(ROOT, 'js/combat/SuperNova.js'), 'utf8');
  const pSrc = fs.readFileSync(path.join(ROOT, 'js/player/Player.js'), 'utf8');

  // ── Path gates: old js/core/ locations gone, new js/combat/ in place ──
  check('CatShipFactory moved: js/core/CatShipFactory.js deleted', !fs.existsSync(path.join(ROOT, 'js/core/CatShipFactory.js')));
  check('MiniShip moved: js/core/MiniShip.js deleted', !fs.existsSync(path.join(ROOT, 'js/core/MiniShip.js')));
  check('SuperNova created: js/combat/SuperNova.js exists', fs.existsSync(path.join(ROOT, 'js/combat/SuperNova.js')));

  // ── Source gates ──
  check('CatShipFactory: VERSION = v3.71.0', csfSrc.includes("VERSION = 'v3.71.0'"));
  check('MiniShip: VERSION = v3.73.0', msSrc.includes("VERSION = 'v3.73.0'"));
  check('SuperNova: VERSION = v1.0.0', snSrc.includes("VERSION = 'v1.0.0'"));
  check('SuperNova: exports fireNova + fireSuperWeapon', typeof fireNova === 'function' && typeof fireSuperWeapon === 'function');
  check('SuperNova: nova ring is 16 bullets @ damage 25', snSrc.includes('i < 16') && snSrc.includes('damage: 25'));
  check('SuperNova: super-weapon is 32 ring + 8 homing bolts', snSrc.includes('i < 32') && snSrc.includes('i < 8') && snSrc.includes('b.homing = true'));
  check('SuperNova: shake 8 (nova) + shake 16 (super-weapon)', snSrc.includes('g.shake = 8') && snSrc.includes('g.shake = 16'));
  check('SuperNova: super-weapon emits the COLOR SYNERGY banner', snSrc.includes("'COLOR SYNERGY! SUPER-WEAPON FIRED!'"));
  check('CatShipFactory: exports createCatShip + createMiniShip', typeof createCatShip === 'function' && typeof createMiniShip === 'function');
  check('MiniShip: default export is the MiniShip class', typeof MiniShip === 'function' && /class MiniShip/.test(msSrc));

  // Player.js: delegates to SuperNova, no inline bullet construction left
  check("Player: imports fireNova + fireSuperWeapon from combat/SuperNova.js", pSrc.includes("import { fireNova, fireSuperWeapon } from '../combat/SuperNova.js'"));
  check('Player: activateUltimate delegates to fireNova(this)', pSrc.includes('activateUltimate() {') && pSrc.includes('fireNova(this);'));
  check('Player: superWeapon delegates to fireSuperWeapon(this)', pSrc.includes('superWeapon() {') && pSrc.includes('fireSuperWeapon(this);'));
  check('Player: no inline new Bullet( construction left', !pSrc.includes('new Bullet('));
  check('Player: no stale Bullet/TAU/rand imports', !pSrc.includes('import Bullet') && !pSrc.includes("from '../core/utils.js'"));

  // No stale core/ import paths anywhere in js/ or net/
  const staleHits = [];
  const scanStale = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { scanStale(full); continue; }
      if (!e.name.endsWith('.js')) continue;
      const src = fs.readFileSync(full, 'utf8');
      if (src.includes('core/CatShipFactory') || src.includes('core/MiniShip')) staleHits.push(path.relative(ROOT, full));
    }
  };
  scanStale(path.join(ROOT, 'js'));
  scanStale(path.join(ROOT, 'net'));
  check('no stale core/CatShipFactory or core/MiniShip imports in js/ + net/', staleHits.length === 0, staleHits.join(', '));

  // ── Headless behavior ──
  // fireNova: 16-bullet friendly ring, damage 25, #ffd54f, owner-tagged, shake 8
  {
    const g = makeGame();
    const p = { x: 640, y: 360, game: g };
    fireNova(p);
    check('fireNova: 16-bullet ring', g.bullets.length === 16, `got ${g.bullets.length}`);
    check('fireNova: bullets damage 25 + #ffd54f + friendly', g.bullets.every(b => b.damage === 25 && b.color === '#ffd54f' && b.friendly === true));
    check('fireNova: bullets owner-tagged to the firing player', g.bullets.every(b => b.owner === p));
    check('fireNova: shake set to 8', g.shake === 8, `got ${g.shake}`);
  }
  // fireSuperWeapon: 32 ring + 8 homing bolts, shake 16
  {
    const g = makeGame();
    const p = { x: 640, y: 360, game: g };
    fireSuperWeapon(p);
    const ring = g.bullets.filter(b => b.damage === 40);
    const homing = g.bullets.filter(b => b.homing);
    check('fireSuperWeapon: 32-bullet ring (damage 40 + #ffd54f)', ring.length === 32 && ring.every(b => b.color === '#ffd54f' && b.friendly === true), `got ${ring.length}`);
    check('fireSuperWeapon: 8 homing bolts (damage 60 + #ff5252)', homing.length === 8 && homing.every(b => b.damage === 60 && b.color === '#ff5252'), `got ${homing.length}`);
    check('fireSuperWeapon: 40 bullets total + shake 16', g.bullets.length === 40 && g.shake === 16, `bullets=${g.bullets.length} shake=${g.shake}`);
  }
  // Real Player delegation: base activateUltimate + superWeapon route through SuperNova
  {
    const g = makeGame();
    const p = makePlayer(g);
    p.x = 640; p.y = 360;
    p.activateUltimate();
    check('Player.activateUltimate delegates: 16 nova bullets', g.bullets.length === 16, `got ${g.bullets.length}`);
    p.superWeapon();
    check('Player.superWeapon delegates: +40 super-weapon bullets', g.bullets.length === 56, `got ${g.bullets.length}`);
  }
}

// ═══════════════════════════════════════════════════════════
//  [6y] v3.72.0 CATSHIP SPRITE THEMES — the player ship blits
//        one of nine cat-on-its-back PNGs (tools/asset-manifest.json
//        → js/core/AssetSprites.js) in place of the procedural hull.
//        PLAYER_THEME_SPRITES maps every PLAYER_THEMES key to a cat_*
//        sprite key; the theme color/accent still drive the cockpit,
//        weapons, thrusters, shields and HUD; themes without a sprite
//        fall back to the procedural hull.
//        v3.72.1: + transform fix gate (sprite blit must translate/rotate
//        to the ship — v3.72.0 drew at raw (0,0): hull off-screen, "floating
//        circle"), hardpoint FX re-layer gate, and the ship-select menu
//        gates (index.html no longer hardcodes 5 cards; main.js generates
//        all 9 from PLAYER_THEMES + re-renders icons after loadAssets()).
// ═══════════════════════════════════════════════════════════
console.log('\n[6y] v3.72.0 catship sprite themes (9 cat-on-back PNGs) + v3.72.1 render/menu fixes');
{
  const { PLAYER_THEMES, PLAYER_THEME_SPRITES } = await mod('js/core/config.js');
  const prSrc = fs.readFileSync(path.join(ROOT, 'js/player/PlayerRenderer.js'), 'utf8');
  const psaSrc = fs.readFileSync(path.join(ROOT, 'js/player/PlayerShipArt.js'), 'utf8');
  const themeNames = Object.keys(PLAYER_THEMES);

  check('config: PLAYER_THEMES has all 9 themes', themeNames.length === 9, `got ${themeNames.length}: ${themeNames.join(', ')}`);
  check('config: PLAYER_THEME_SPRITES maps every theme to a cat_* sprite key',
    Object.keys(PLAYER_THEME_SPRITES).length === 9 && themeNames.every(t => typeof PLAYER_THEME_SPRITES[t] === 'string' && PLAYER_THEME_SPRITES[t].startsWith('cat_')),
    `got ${JSON.stringify(PLAYER_THEME_SPRITES)}`);
  for (const key of Object.values(PLAYER_THEME_SPRITES)) {
    check(`AssetSprites: ${key} registered with dims`, new RegExp(`${key}:\\s*\\{\\s*w:\\s*\\d+,\\s*h:\\s*\\d+\\s*\\}`).test(spritesSrc));
  }
  check('manifest: all 9 cat_* keys map to existing PNGs in .assets',
    Object.values(PLAYER_THEME_SPRITES).every(k => manifest.assets[k] && fs.existsSync(path.join(ASSET_DIR, manifest.assets[k]))),
    `missing: ${Object.values(PLAYER_THEME_SPRITES).filter(k => !manifest.assets[k] || !fs.existsSync(path.join(ASSET_DIR, manifest.assets[k]))).join(', ')}`);

  // PlayerRenderer: sprite blit path + procedural fallback
  check('PlayerRenderer: resolves the theme sprite (PLAYER_THEME_SPRITES + getSprite)', prSrc.includes('PLAYER_THEME_SPRITES[p.theme]') && prSrc.includes('getSprite('));
  check('PlayerRenderer: blits the sprite at a fixed 70px height', prSrc.includes('const drawH = 70') && prSrc.includes('ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh)'));
  // v3.72.1: the blit must happen in the ship's LOCAL frame — the v3.72.0
  // build drew at raw (0,0) and the hull vanished off-screen while weapons
  // kept firing (the reported "circle floating in space" bug).
  check('PlayerRenderer: sprite blit translated + rotated to the ship (v3.72.1 transform fix)', prSrc.includes('ctx.translate(p.x, p.y)') && prSrc.includes('ctx.rotate(p.angle + Math.PI / 2)'));
  check('PlayerRenderer: soft theme shadow-glow + blink alpha, no hard ellipse underlay (v3.72.1)', prSrc.includes('ctx.shadowColor = th.accent') && prSrc.includes('blink ? 0.35 : 1') && !prSrc.includes('ctx.ellipse(0, 0, dw * 0.62'));
  check('PlayerRenderer: hardpoint FX re-layered on the sprite (paws/thrusters/muzzle at SHIP_GEOMETRY)', prSrc.includes('drawWeaponPaw(ctx, SHIP_GEOMETRY.frontPawL.x') && prSrc.includes('drawThrusterFlame(ctx, SHIP_GEOMETRY.thrusterL.x') && prSrc.includes('drawMuzzleFlash(ctx, SHIP_GEOMETRY.muzzle.x'));
  check('PlayerRenderer: procedural fallback when no sprite (2x scale)', prSrc.includes('drawMainShip(ctx, p, th.color, th.accent, th.pattern, { scale: MAIN_SHIP_SCALE })'));
  check('PlayerRenderer: menu-icon compat path passes the theme sprite', prSrc.includes('drawMainShip(ctx, this.player, c, a, pattern, { x, y, scale: s }, sprite)'));

  // v3.72.1: ship-select menu — all 9 themes, generated from config.js
  const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js/core/main.js'), 'utf8');
  check('index.html: no hardcoded ship-option cards (menu generated from PLAYER_THEMES)', !htmlSrc.includes('data-theme=') && htmlSrc.includes('class="menu-ship-select"'));
  check('main.js: generates one ship-option per PLAYER_THEMES key (all 9 cards)', mainSrc.includes('for (const key of Object.keys(PLAYER_THEMES))') && mainSrc.includes('btn.dataset.theme = key'));
  check('main.js: mock player carries the theme (menu-icon sprite lookup works)', mainSrc.includes('const mockPlayer = {') && mainSrc.includes('theme,'));
  check('main.js: re-renders menu icons after loadAssets() resolves', mainSrc.includes('loadAssets().then(renderAllShipIcons)'));

  // PlayerShipArt: optional sprite parameter blits before the procedural hull
  check('PlayerShipArt: drawCatShip accepts an optional sprite parameter', psaSrc.includes('export function drawCatShip(ctx, p, c, a, pattern, opts = {}, sprite = null)'));
  check('PlayerShipArt: sprite blit at 70px height, early return skips the procedural hull', psaSrc.includes('const dh = 70') && psaSrc.includes('ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh)'));
}

// ═══════════════════════════════════════════════════════════
//  [6z] v3.76.0 LevelRegistry — data-driven stage flow
//        (combat/bonus manifest + uniform stage interface:
//         init() / update(dt) / isComplete() / cleanup())
// ═══════════════════════════════════════════════════════════
console.log('\n[6z] v3.76.0 LevelRegistry stage flow (headless)');
{
  const { default: LevelRegistry, STAGE_SEQUENCE, BONUS_STAGES } = await mod('js/levels/LevelRegistry.js');
  const lrSrc = fs.readFileSync(path.join(ROOT, 'js/levels/LevelRegistry.js'), 'utf8');
  const wmSrc = fs.readFileSync(path.join(ROOT, 'js/core/WaveManager.js'), 'utf8');
  const blSrc2 = fs.readFileSync(path.join(ROOT, 'js/levels/BonusLevel.js'), 'utf8');
  const bySrc = fs.readFileSync(path.join(ROOT, 'js/levels/BoneYardBonus.js'), 'utf8');
  const ibSrc = fs.readFileSync(path.join(ROOT, 'js/levels/InternetBonus.js'), 'utf8');
  const hudSrc = fs.readFileSync(path.join(ROOT, 'js/ui/HUD.js'), 'utf8');

  // ── Source gates ──
  check('LevelRegistry: VERSION = v3.76.0', lrSrc.includes("VERSION = 'v3.76.0'"));
  check('Game: imports LevelRegistry (STAGE_SEQUENCE + BONUS_STAGES)',
    gameSrc.includes("import LevelRegistry, { STAGE_SEQUENCE, BONUS_STAGES } from '../levels/LevelRegistry.js'"));
  check('Game: core loop drives activeStage (update → isComplete → advanceStage)',
    gameSrc.includes('this.activeStage.update(dt)') && gameSrc.includes('if (this.activeStage.isComplete()) this.advanceStage();'));
  check('WaveManager: completion signal only (cleared flag + isComplete, no bonus choice)',
    wmSrc.includes('this.cleared = true') && wmSrc.includes('isComplete()') && !wmSrc.includes('startBonus'));
  check('BonusLevel: thin adapter (setStage + forward update/draw, no direct bonus imports)',
    blSrc2.includes('setStage(stage)') && !blSrc2.includes("from './BoneYardBonus.js'") && !blSrc2.includes("from './InternetBonus.js'"));
  check('BoneYardBonus: uniform interface (init/isComplete/cleanup, no game-state transitions)',
    bySrc.includes('init()') && bySrc.includes('isComplete()') && bySrc.includes('cleanup()') && !bySrc.includes("game.state = 'playing'") && !bySrc.includes('waveManager.startNext('));
  check('InternetBonus: uniform interface (init/isComplete/cleanup, no game-state transitions)',
    ibSrc.includes('init()') && ibSrc.includes('isComplete()') && ibSrc.includes('cleanup()') && !ibSrc.includes("game.state = 'playing'") && !ibSrc.includes('waveManager.startNext('));
  check('HUD: bonus label from levelRegistry.labelFor(currentEntry)',
    hudSrc.includes('g.levelRegistry.labelFor(g.levelRegistry.currentEntry)'));

  // ── Manifest + headless behavior ──
  check('STAGE_SEQUENCE: 3 combat + 1 random bonus (pre-refactor cadence)',
    STAGE_SEQUENCE.length === 4 && STAGE_SEQUENCE.filter(s => s.type === 'combat').length === 3 && STAGE_SEQUENCE[3].type === 'bonus' && STAGE_SEQUENCE[3].id === 'random');
  check('BONUS_STAGES: boneyard + internet registered with label + create()',
    Object.keys(BONUS_STAGES).sort().join(',') === 'boneyard,internet' &&
    Object.values(BONUS_STAGES).every(r => typeof r.label === 'string' && typeof r.create === 'function'));

  const reg = new LevelRegistry();
  check('bonusInterval = 4 (syncs WaveManager.bonusEvery)', reg.bonusInterval === 4, `got ${reg.bonusInterval}`);

  const seq = [reg.nextStage(), reg.nextStage(), reg.nextStage(), reg.nextStage(), reg.nextStage()];
  check('nextStage(): combat×3 → bonus(random) → combat (cyclic)',
    seq[0].type === 'combat' && seq[1].type === 'combat' && seq[2].type === 'combat' &&
    seq[3].type === 'bonus' && seq[3].id === 'random' && seq[4].type === 'combat');
  check('nextStage(): currentEntry tracks the last entry handed out', reg.currentEntry === seq[4]);

  const resolved = reg.resolveEntry({ type: 'bonus', id: 'random' });
  check("resolveEntry('random') → concrete registered bonus id",
    resolved.type === 'bonus' && Object.keys(BONUS_STAGES).includes(resolved.id), `got ${resolved.id}`);
  const passthrough = { type: 'bonus', id: 'boneyard' };
  check('resolveEntry: non-random entries pass through unchanged', reg.resolveEntry(passthrough) === passthrough);

  const g = makeGame();
  g.waveManager = { __waveManager: true };
  check('createStage(combat) → shared WaveManager', reg.createStage({ type: 'combat' }, g) === g.waveManager);
  const stage1 = reg.createStage({ type: 'bonus', id: 'boneyard' }, g);
  const stage2 = reg.createStage({ type: 'bonus', id: 'boneyard' }, g);
  check('createStage(bonus): instance cached + reused per id', stage1 === stage2);
  check('createStage(bonus): uniform interface (init/update/isComplete/cleanup)',
    ['init', 'update', 'isComplete', 'cleanup'].every(m => typeof stage1[m] === 'function'));
  check('createStage: boneyard vs internet are distinct instances', reg.createStage({ type: 'bonus', id: 'internet' }, g) !== stage1);

  check("labelFor: combat → 'WAVE'", reg.labelFor({ type: 'combat' }) === 'WAVE');
  check("labelFor: boneyard → '☠ BONE YARD ☠'", reg.labelFor({ type: 'bonus', id: 'boneyard' }) === '☠ BONE YARD ☠');
  check("labelFor: internet → '🌐 INTERNET 🌐'", reg.labelFor({ type: 'bonus', id: 'internet' }) === '🌐 INTERNET 🌐');
  check('labelFor: unknown id → uppercased fallback', reg.labelFor({ type: 'bonus', id: 'moonbase' }) === 'MOONBASE');

  reg.reset();
  const forced = reg.forceBonus('boneyard');
  check("forceBonus('boneyard') → concrete entry, currentEntry set", forced.type === 'bonus' && forced.id === 'boneyard' && reg.currentEntry === forced);
  check('forceBonus: next nextStage() is a combat wave (no back-to-back bonus)', reg.nextStage().type === 'combat');
  reg.reset();
  const forcedRandom = reg.forceBonus('random');
  check("forceBonus('random') → concrete registered bonus id", forcedRandom.type === 'bonus' && Object.keys(BONUS_STAGES).includes(forcedRandom.id), `got ${forcedRandom.id}`);
  reg.reset();
  check('reset(): manifest restarts from the first entry', reg.index === -1 && reg.currentEntry === null && reg.nextStage() === STAGE_SEQUENCE[0]);
}

// ═══════════════════════════════════════════════════════════
//  [6aa] v3.77.0 PHASE 4 VERSION SYNC — the milestone version must
//        be consistent across package.json (build filename source of
//        truth), config.js (central config), main.js (project
//        manifest), Game.js (game orchestrator), HUD.js (in-game
//        #version-label) and index.html (browser tab title).
// ═══════════════════════════════════════════════════════════
{
  console.log('\n[6aa] v3.77.0 Phase 4 version sync');
  const MILESTONE = 'v3.77.0';
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  check('package.json version = 3.77.0 (build filename source of truth)', pkg.version === MILESTONE.slice(1), `got ${pkg.version}`);
  const cfgSrc = fs.readFileSync(path.join(ROOT, 'js/core/config.js'), 'utf8');
  check('config.js: VERSION = v3.77.0 (central config)', cfgSrc.includes(`VERSION = '${MILESTONE}'`));
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js/core/main.js'), 'utf8');
  check('main.js: VERSION = v3.77.0 (project manifest)', mainSrc.includes(`VERSION = '${MILESTONE}'`));
  const gameSrc = fs.readFileSync(path.join(ROOT, 'js/core/Game.js'), 'utf8');
  check('Game.js: VERSION = v3.77.0 (game orchestrator)', gameSrc.includes(`VERSION = '${MILESTONE}'`));
  const hudSrc = fs.readFileSync(path.join(ROOT, 'js/ui/HUD.js'), 'utf8');
  check('HUD.js: VERSION = v3.77.0 (in-game #version-label)', hudSrc.includes(`VERSION = '${MILESTONE}'`));
  const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check('index.html: tab title carries v3.77.0', htmlSrc.includes(`Kitty Vs Everything — ${MILESTONE}`));
}

// ═══════════════════════════════════════════════════════════
//  [6ab] v3.77.0 SHUTTLE WAVE EVENT — every destroyed Space
//        Shuttle (ENEMY_TYPES.shuttle, species #17: waves
//        17/36/55/...) releases a GUARANTEED mini-ship
//        power-up at the kill point (Combat.maybeDrop via
//        SHUTTLE_DROP in config.js), and the pickup routes
//        through Game.collectPowerUp → PlayerFleet.addMini
//        (+500 score fallback when the dock is full).
// ═══════════════════════════════════════════════════════════
{
  console.log('\n[6ab] v3.77.0 shuttle wave event (source + headless lifecycle)');
  const { applyWeaponHit } = await mod('js/combat/Combat.js');
  const { default: ShuttleEnemy } = await mod('js/enemies/ShuttleEnemy.js');
  const { SHUTTLE_DROP, MINI_SHIP } = await mod('js/core/config.js');
  const combatSrc3 = fs.readFileSync(path.join(ROOT, 'js/combat/Combat.js'), 'utf8');
  const gameSrc4 = fs.readFileSync(path.join(ROOT, 'js/core/Game.js'), 'utf8');

  // ── Source gates ──
  check('config: SHUTTLE_DROP is the guaranteed mini-ship drop', SHUTTLE_DROP && SHUTTLE_DROP.type === 'mini', JSON.stringify(SHUTTLE_DROP));
  check('Combat: shuttle kills bypass the pool roll (SHUTTLE_DROP special case)',
    combatSrc3.includes("enemy.type === 'shuttle'") && combatSrc3.includes('SHUTTLE_DROP.type'));
  check('Combat: non-shuttle enemies still roll the shared pool', combatSrc3.includes('rollPowerUpDrop()'));
  check('Game: startCombatStage logs the shuttle wave event',
    gameSrc4.includes("currentSpecies === 'shuttle'") && gameSrc4.includes('SHUTTLE INTERCEPT'));

  // ── Headless lifecycle: shuttle defeated → mini drop → pickup ──
  const game = makeGame();
  game.powerups = [];
  const shuttle = new ShuttleEnemy({ type: 'shuttle', tier: 'mob', x: 100, y: 100, game, difficulty: 1 });
  shuttle.shield = 0;
  shuttle.hp = 1;
  const bullet = { damage: 10, weapon: 'vulkan', shieldMelt: 0, alive: true, owner: null };
  applyWeaponHit(game, shuttle, bullet);
  check('shuttle defeated by weapon hit', shuttle.alive === false);
  check('shuttle kill spawns exactly one power-up', game.powerups.length === 1, `got ${game.powerups.length}`);
  const drop = game.powerups[0];
  check('shuttle drop is a mini-ship at the kill point (100,100)',
    drop && drop.type === 'mini' && drop.x === 100 && drop.y === 100,
    drop ? `type=${drop.type} at (${drop.x},${drop.y})` : 'no drop');

  // Pickup with room in the dock: PlayerFleet.addMini docks a mini
  const p = makePlayer(game);
  const minisBefore = p.minis.length;
  collect(game, 'mini', p);
  check('mini pickup: PlayerFleet.addMini docks a mini', p.minis.length === minisBefore + 1, `got ${p.minis.length}`);

  // Pickup with a full dock: +500 score fallback
  while (p.minis.length < MINI_SHIP.maxDocked) p.addMini();
  game.score = 0;
  collect(game, 'mini', p);
  check('mini pickup with full dock: +500 score fallback', game.score === 500, `got ${game.score}`);
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
  ? '\n\x1b[32m[check] ALL GREEN — v3.77.0 Phase 4 lock-in: version sync, LevelRegistry surface, asset pipeline, shuttle wave event, and headless behavior verified.\x1b[0m'
  : `\n\x1b[31m[check] ${failures} FAILURE(S) — see ✗ lines above.\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);

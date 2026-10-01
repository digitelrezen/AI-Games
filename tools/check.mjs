#!/usr/bin/env node
// ../tools/check.mjs — Kitty Vs Everything v3.56.0 (tools/ lives at AI-GAMES root)
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
]) {
  V[tag] = (await mod(rel)).VERSION;
}
const { loadAssets, getSprite, getDims, POWERUP_ASSETS } = await mod('js/core/AssetManager.js');
check(`package.json version is ${pkg.version}`, /\d+\.\d+\.\d+/.test(pkg.version || ''), `got "${pkg.version}"`);
// Convention: JS modules use "vX.Y.Z", package.json uses "X.Y.Z" — normalize.
check(`Game.js VERSION ${V.Game} matches package.json ${pkg.version}`, String(V.Game).replace(/^v/, '') === String(pkg.version));
const EXPECTED_MODULE_VERSIONS = { Player: 'v3.47.0', PlayerWeapons: 'v3.46.0', PowerUp: 'v3.51.0', HUDFireControl: 'v3.47.0', WaveManager: 'v3.42.0', Combat: 'v3.42.0', AsteroidBonus: 'v3.42.0', InternetBonus: 'v3.42.0', DevPanel: 'v3.55.0', Settings: 'v3.55.0', Crosshair: 'v3.55.0', EnemyFactory: 'v3.32.0', BoneYardBonus: 'v3.15.0', ShuttleEnemy: 'v1.0.0', MothEnemy: 'v1.0.0', BeetleEnemy: 'v1.2.0', BonusLevel: 'v2.2.0', BoneFragment: 'v2.2.0' };
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
// v3.50.0: + shuttle (space shuttle enemy, 17th species).
// v3.52.0: + moth (moth enemy, 18th species).
// v3.53.0: + beetle (beetle enemy pixel-art sprite swap).
// v3.54.0: + femur / profile_bone / skeleton / skull (boneyard environment).
const EXPECTED_KEYS = ['health', 'extralife', 'shield', 'frenzy', 'wasp', 'butterfly', 'rat', 'crate', 'ufo1', 'ufo2', 'shuttle', 'moth', 'beetle', 'femur', 'profile_bone', 'skeleton', 'skull'];
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
//  [6e] v3.51.0 JEWEL SHADING — frenzy / extra-life / shield
//      drops render through the programmatic drawJewelDrop()
//      gem pass (aura → base → bevel depth → specular shine →
//      shimmer); headless-safe (no DOM → base fallback only)
// ═══════════════════════════════════════════════════════════
console.log('\n[6e] v3.51.0 jewel shading (frenzy / life / shield)');
const pwSrc = fs.readFileSync(path.join(ROOT, 'js/combat/PowerUp.js'), 'utf8');
check('PowerUp: VERSION = v3.51.0', pwSrc.includes("VERSION = 'v3.51.0'"));
check('PowerUp: drawJewelDrop() gem pipeline (source-atop depth + lighter glow)',
  pwSrc.includes('function drawJewelDrop(') &&
  pwSrc.includes("globalCompositeOperation = 'source-atop'") &&
  pwSrc.includes("globalCompositeOperation = 'lighter'"));
check('PowerUp: per-type jewel palette (golden / emerald / azure)',
  pwSrc.includes("frenzy: { aura: '255, 200, 40'") &&
  pwSrc.includes("life:   { aura: '0, 230, 118'") &&
  pwSrc.includes("shield: { aura: '64, 196, 255'"));
check('PowerUp: life drop routes through the jewel pass', pwSrc.includes("drawJewelDrop(ctx, 'life', this.t,"));
check('PowerUp: shield drop routes through the jewel pass', pwSrc.includes("drawJewelDrop(ctx, 'shield', this.t,"));
check('PowerUp: frenzy drop routes through the jewel pass', pwSrc.includes("drawJewelDrop(ctx, 'frenzy', this.t,"));
check('PowerUp: jewel buffer is headless-guarded (no DOM → base only)',
  pwSrc.includes("typeof document === 'undefined'") &&
  pwSrc.includes('if (!buf) { drawBase(ctx); return; }'));
check('PowerUp: procedural fallbacks preserved (red heart / cyan hex / gold bolt)',
  pwSrc.includes('#ff5252') && pwSrc.includes('#4fc3f7') && pwSrc.includes('#ffd600'));
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
  for (const type of ['life', 'shield', 'frenzy']) {
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
//  [6h] v3.54.0 BONEYARD PIXEL-ART ENVIRONMENT — Bone Yard bonus
//       renders a seeded skeleton/skull/femur/profile-bone backdrop;
//       BoneFragment draws femur/profile-bone sprites; procedural
//       fallbacks kept
// ═══════════════════════════════════════════════════════════
console.log('\n[6h] v3.54.0 boneyard pixel-art environment');
{
  const blSrc = fs.readFileSync(path.join(ROOT, 'js/levels/BonusLevel.js'), 'utf8');
  const bfSrc = fs.readFileSync(path.join(ROOT, 'js/levels/BoneFragment.js'), 'utf8');
  check('BonusLevel: VERSION = v2.2.0', blSrc.includes("VERSION = 'v2.2.0'"));
  check('BonusLevel: draw(ctx) delegates to the active bonus', blSrc.includes('draw(ctx)') && blSrc.includes('this.currentBonus.draw(ctx)'));
  check('BoneYardBonus: VERSION = v3.15.0', bySrc.includes("VERSION = 'v3.15.0'"));
  check('BoneYardBonus: seeded backdrop keys (skeleton/skull/femur/profile_bone)', bySrc.includes("BONEYARD_BG_KEYS = ['skeleton', 'skull', 'femur', 'profile_bone']"));
  check('BoneYardBonus: deterministic mulberry32 layout (seed 20261001)', bySrc.includes('function mulberry32') && bySrc.includes('mulberry32(20261001)'));
  check('BoneYardBonus: aspect-preserving backdrop draw + procedural fallback', bySrc.includes('getDims(b.key)') && bySrc.includes('this._drawProceduralBg(ctx, b, w, h)'));
  check('BoneFragment: VERSION = v2.2.0', bfSrc.includes("VERSION = 'v2.2.0'"));
  check('BoneFragment: femur/profile_bone sprite key per instance', bfSrc.includes("BONE_FRAGMENT_SPRITE_KEYS = ['femur', 'profile_bone']") && bfSrc.includes('getSprite(this.spriteKey)'));
  check('BoneFragment: aspect-preserving sprite + procedural fallback', bfSrc.includes('getDims(this.spriteKey)') && bfSrc.includes('this._drawProcedural(ctx, r)'));
  check('Game: bonus backdrop drawn under the bonus targets', gameSrc.includes('this.bonus.draw(ctx)'));
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
//  [7] --full: full smoke.mjs logic suite (subprocess)
// ═══════════════════════════════════════════════════════════
if (FULL) {
  console.log('\n[7] Full smoke suite (subprocess)');
  runTool(['smoke.mjs'], 'tools/smoke.mjs (Settings/Keybinds/EventBus/MessageLog/DebugBridge)');
}

// ─── Summary ───────────────────────────────────────────────
console.log(failures === 0
  ? '\n\x1b[32m[check] ALL GREEN — v3.56.0 surface, asset pipeline, and headless behavior verified.\x1b[0m'
  : `\n\x1b[31m[check] ${failures} FAILURE(S) — see ✗ lines above.\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);

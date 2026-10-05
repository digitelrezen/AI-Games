// ═══════════════════════════════════════════════════════════
//  [2] v3.42.0 MODULE SURFACE — config values + APIs the new
//      features depend on (POWERUP_DROPS pool, ASTEROID.spawnY,
//      Player.activateFrenzy, Game.collectPowerUp, HUDFireControl
//      panel, WEAPONS.vulkan thermal constants)
// ═══════════════════════════════════════════════════════════

import { ROOT, TOOLS, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
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
// v3.42.0 source gates: every asteroid spawn off-screen, ship egg on EVERY wave (v3.80.0)
const wmSrc = fs.readFileSync(path.join(ROOT, 'js/core/WaveManager.js'), 'utf8');
check('WaveManager: wave-clear asteroid spawns off-screen (ASTEROID.spawnY)', wmSrc.includes('spawnAsteroid(this.game, x, ASTEROID.spawnY)'));
check('WaveManager: ship easter egg auto-triggers on EVERY combat wave (v3.80.0)', wmSrc.includes("switchEgg(this.game, 'ship')") && !wmSrc.includes('this.wave % this.bonusEvery !== 0'));
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

}

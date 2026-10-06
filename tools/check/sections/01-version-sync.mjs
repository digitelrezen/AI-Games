// ═══════════════════════════════════════════════════════════
//  [1] VERSION SYNC — package.json vs module VERSION exports
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
console.log('\n[1] Version sync');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const V = {};
for (const [tag, rel] of [
  ['Game', 'js/core/Game.js'],
  ['Player', 'js/player/Player.js'],
  ['PlayerWeapons', 'js/player/PlayerWeapons.js'],
  ['PowerUp', 'js/combat/PowerUp.js'], // v3.88.0: crisp pixel-art jewel buffer
  ['HUDFireControl', 'js/ui/HUDFireControl.js'],
  ['WaveManager', 'js/core/WaveManager.js'],        // v3.76.0
  ['Combat', 'js/combat/Combat.js'],                // v3.42.0
  ['AsteroidBonus', 'js/levels/AsteroidBonus.js'],  // v3.42.0
  ['InternetBonus', 'js/levels/InternetBonus.js'],  // v3.76.0
  ['DevPanel', 'js/ui/DevPanel.js'],                // v3.48.0
  ['Settings', 'js/ui/Settings.js'],                // v3.48.0
  ['Crosshair', 'js/ui/Crosshair.js'],              // v3.48.0
  ['Keybinds', 'js/input/Keybinds.js'],             // v3.78.0
  ['MenuKeybinds', 'js/input/MenuKeybinds.js'],     // v3.78.0
  ['PlayerFlight', 'js/player/PlayerFlight.js'],    // v3.78.0
  ['PauseMenu', 'js/ui/PauseMenu.js'],              // v3.78.0
  ['SettingsScreen', 'js/ui/SettingsScreen.js'],    // v3.78.0
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
const EXPECTED_MODULE_VERSIONS = { Player: 'v3.71.0', PlayerWeapons: 'v3.70.0', PowerUp: 'v3.89.0', HUDFireControl: 'v3.47.0', WaveManager: 'v3.83.0', Combat: 'v3.84.0', AsteroidBonus: 'v3.83.0', InternetBonus: 'v3.83.0', DevPanel: 'v3.82.0', Settings: 'v3.78.0', Crosshair: 'v3.55.0', Keybinds: 'v3.78.0', MenuKeybinds: 'v3.78.0', PlayerFlight: 'v3.78.0', PauseMenu: 'v3.78.0', SettingsScreen: 'v3.78.0', EnemyFactory: 'v3.33.0', BoneYardBonus: 'v3.76.0', ShuttleEnemy: 'v1.1.0', MothEnemy: 'v1.0.0', BeetleEnemy: 'v1.2.0', BonusLevel: 'v3.76.0', BoneFragment: 'v2.3.0', SpiderEnemy: 'v1.2.0', SnakeEnemy: 'v1.2.0', WolfEnemy: 'v1.2.0', LizardEnemy: 'v1.2.0', DragonEnemy: 'v1.2.0', FalconEnemy: 'v1.2.0', BatEnemy: 'v1.2.0', SquirrelEnemy: 'v1.0.0', BaseWeapon: 'v1.0.0', VulcanCannon: 'v1.0.0', PulseCannon: 'v1.0.0', RailCannon: 'v1.0.0', BaseRocket: 'v1.0.0', StunRockets: 'v1.0.0', NapalmRockets: 'v1.0.0', CatShipFactory: 'v3.71.0', MiniShip: 'v3.73.0', SuperNova: 'v1.0.0' };
for (const [tag, want] of Object.entries(EXPECTED_MODULE_VERSIONS)) {
  check(`${tag}.js VERSION is ${want}`, V[tag] === want, `got ${V[tag]}`);
}
check('AssetManager exports loadAssets/getSprite/getDims', typeof loadAssets === 'function' && typeof getSprite === 'function' && typeof getDims === 'function');
check('AssetManager POWERUP_ASSETS maps 7 drop types', Object.keys(POWERUP_ASSETS || {}).length === 7, `got ${Object.keys(POWERUP_ASSETS || {}).join(', ')}`);

}

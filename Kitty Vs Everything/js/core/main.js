// Filename: main.js
// Kitty Vs Everything — v3.3.0
// Entry point: boots the Game, wires menu / game-over / leaderboard UI,
// and cat-ship theme selection (v3.1.0 .ship-option buttons).
// v3.2.0: Menu icons render the redesigned catship base model (mock player
//         now carries animTime + paw/muzzle flash state for the renderer).
// v3.3.0: Menu icons render the top-down H-pose catship via the v3.3.0
//         PlayerRenderer compat entry (drawCatShip delegates to PlayerShipArt
//         with an explicit { x, y, scale } override).
// v3.13.0: Manifest refreshed (dynamic viewport + human/pink-cat art
//          files); removed the temporary window.__game debug hook.
// v3.14.0: Start-screen ⚙ SETTINGS button wired (opens SettingsScreen.js
//          — keybinds, split spin, volumes, FX).
// v3.15.0: Internet Bonus Black Cat entourage — gold chain + iced-out
//          real-time clock pendants (BlackCatEntourage.js +
//          RealTimeClock.js).
// v3.27.0: EasterEgg.js is now the easter-egg manager (Bender + ship slots);
//          "Drop Ship" dev button spawns the Planet Express flyby.
// v3.72.2: Ship-select row is now GENERATED from PLAYER_THEMES (all 9
//          themes) — the 5 hardcoded index.html cards are gone, config.js
//          is the single source of truth. Menu icons re-render once
//          loadAssets() resolves so they show the cat_* sprite art (the
//          first draw happens before the base64 decode lands), and the
//          mock player now carries `theme` so the sprite lookup works.
// v3.77.0: Phase 4 modularization lock-in — the 4-phase modular refactor is
//          complete (v3.74.0 js/player/variants + js/bosses, v3.75.0
//          js/enemies/sprites, v3.76.0 js/levels/LevelRegistry stage flow).
//          Project manifest version synced with package.json (3.77.0).
// v3.78.0: A/D control mode (strafe default / spin classic —
//          Settings.controlMode) + the redundant fire-control pause button
//          is gone (Esc / P / the pause overlay handle pausing).
// v3.79.0: Dock arc coupler upgraded to a procedural pulsing plasma arc
//          (drawDockArc in PlayerShipFx.js — midpoint-displacement crackle
//          + Math.sin energy pulse + cyan shadow glow). Project manifest
//          version synced with package.json (3.79.0).
// v3.80.0: Drop rarity overhaul — POWERUP_DROPS is now a rarity ladder
//          (robot SUPER RARE 1%), DROP_RARITY drives kill drop chances,
//          both ships enter/exit every level, asteroids stream in
//          constantly, crates fall in occasionally (config/drops.js +
//          WaveManager.js). Project manifest version synced with
//          package.json (3.80.0).
// v3.81.0: Spaceballs One — the rare unstoppable easter-egg ship:
//          per-wave spawn roll (6%, max 2 per mission) in
//          WaveManager.startNext, diagonal sweep that obliterates
//          everything in its path, brake-light stream at the player,
//          treasure-chest jackpot (one of EVERY power-up) on destruction.
//          Project manifest version synced with package.json (3.81.0).
export const VERSION = 'v3.83.0';
import Game from './Game.js';
import PlayerRenderer from '../player/PlayerRenderer.js';
import { PLAYER_THEMES } from './config.js';
import { loadAssets } from './AssetManager.js'; // v3.72.1: re-render icons when sprites land
import netSettingsUI from '../../net/NetSettingsUI.js'; // v3.20.0: LAN / multiplayer
import MenuKeybinds from '../input/MenuKeybinds.js'; // v3.23.0: dynamic keybind footer

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);

// v3.23.0: dynamic keybind footer — renders the player's active binds
// (standard default set when unmodified) and re-renders live on every
// keybindsChanged event from the Settings page.
new MenuKeybinds();
// v3.20.0: wire the in-game net status HUD (LAN).
netSettingsUI.showHud(document.getElementById('net-hud'));

// ─── Cat ship theme selection (v3.1.0 menu: .ship-option buttons) ───
// v3.72.1: the .ship-option cards are GENERATED here from PLAYER_THEMES
// (all 9 themes) — index.html only provides the empty .menu-ship-select
// container, so a new theme in config.js automatically gets a menu card.
let selectedTheme = 'yellow';

// Draw the actual cat ship (same PlayerRenderer used in-game) into a
// menu button icon canvas, using the theme's colors/accent/pattern.
function renderShipIcon(icon, theme) {
  if (!icon || icon.tagName !== 'CANVAS') return;
  const th = PLAYER_THEMES[theme] || PLAYER_THEMES.yellow;
  const size = 56;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  icon.width = size * dpr;
  icon.height = size * dpr;
  const ctx = icon.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  // Static pose: nose up, idle thruster flame, tail straight, eyes open
  // v3.72.1: `theme` is REQUIRED — PlayerRenderer.drawCatShip resolves the
  // cat_* sprite key from this.player.theme (undefined → procedural icon).
  const mockPlayer = {
    theme,
    angle: -Math.PI / 2,
    engineFlicker: 0.8,
    thrusterActive: true,
    boostActive: false,
    tailSway: 0,
    weapon: 'vulkan',
    pawFlashL: 0,
    pawFlashR: 0,
    muzzleFlash: 0,
    animTime: 1.0,
  };
  const scale = 0.62;
  // Local bounds: gun muzzles y≈-37.5 … tail/flames y≈+41 → visual center ≈ 2
  new PlayerRenderer(mockPlayer).drawCatShip(
    ctx, size / 2, size / 2 - 2 * scale, scale,
    th.color, th.accent, th.pattern
  );
}

const shipSelect = document.querySelector('.menu-ship-select');
const shipIcons = [];
for (const key of Object.keys(PLAYER_THEMES)) {
  const btn = document.createElement('div');
  btn.className = 'ship-option' + (key === selectedTheme ? ' selected' : '');
  btn.dataset.theme = key;
  const icon = document.createElement('canvas');
  icon.className = 'ship-icon';
  const label = document.createElement('span');
  label.textContent = PLAYER_THEMES[key].name.split(' ')[0];
  btn.appendChild(icon);
  btn.appendChild(label);
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ship-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedTheme = key;
  });
  shipSelect.appendChild(btn);
  shipIcons.push({ icon, theme: key });
}
const renderAllShipIcons = () => {
  for (const { icon, theme } of shipIcons) renderShipIcon(icon, theme);
};
renderAllShipIcons();
// v3.72.1: re-render every icon once the AssetManager sprites are decoded —
// the first draw above runs before the base64 cat_* decode (kicked off in
// the Game constructor) has landed, so without this the menu would show
// the procedural hull until the user clicked a card.
loadAssets().then(renderAllShipIcons);

// Start / restart
document.getElementById('start-btn').addEventListener('click', () => game.start(selectedTheme));
document.getElementById('retry-btn').addEventListener('click', () => game.start(selectedTheme));

// v3.14.0: start-screen ⚙ opens the shared settings screen (keybinds + audio)
document.getElementById('menu-settings-btn').addEventListener('click', () => {
  if (game.settings) game.settings.open();
});

// Enter key shortcut
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') {
    if (game.state === 'menu' || game.state === 'gameover') game.start(selectedTheme);
  }
});

// Game-over score saving
document.getElementById('save-score').addEventListener('click', () => {
  const name = (document.getElementById('initials').value || 'AAA').toUpperCase().slice(0, 3);
  game.leaderboard.submit(name, game.score);
  game.leaderboard.render(document.getElementById('go-scores-list'));
  document.getElementById('save-score').disabled = true;
});

// Initial leaderboard render
game.leaderboard.render(document.getElementById('menu-scores-list'));

// ============================================================
// PROJECT MANIFEST (v3.14.0) — all files flat in the root folder:
//   index.html, style.css,
//   config.js, utils.js, EventBus.js, AudioSystem.js, Settings.js, Keybinds.js,
//   InputManager.js, ParticleSystem.js, Entity.js, Bullet.js,
//   Viewport.js, ViewScaler.js,
//   MiniShip.js, Player.js, CatShipFactory.js,
//   PlayerFlight.js, PlayerWeapons.js, PlayerFleet.js, PlayerHardpoints.js,
//   PlayerRenderer.js, PlayerShipArt.js, PlayerMiniArt.js, PlayerShipFx.js,
//   player/variants/: orangeCat.js, yellowCat.js, greyCat.js, whiteCat.js, brownCat.js,
//   EnemyBase.js, EnemyFactory.js,
//   WaspEnemy.js, Wasp2Enemy.js,
//   enemies/sprites/: Wasp2Sprite.js,
//   BeetleEnemy.js, ButterflyEnemy.js, RatEnemy.js,
//   WolfEnemy.js, FalconEnemy.js, BatEnemy.js,
//   LizardEnemy.js, DragonEnemy.js, HumanEnemy.js, HumanSprite.js,
//   AlienEnemy.js, SnakeEnemy.js, SpiderEnemy.js,
//   bosses/: PinkCatEnemy.js, PinkCatSprite.js, BlackCatEnemy.js, BlackCatSprite.js,
//            BlackCatEntourage.js, PinkCatBossArt.js,
//   Combat.js, Collisions.js, Homing.js, Starfield.js,
//   PowerUp.js, WaveManager.js, BonusLevel.js,
//   AsteroidBonus.js, BoneYardBonus.js, BoneFragment.js, InternetBonus.js,
//   RealTimeClock.js,
//   EasterEgg.js, BenderSprite.js, FireZone.js, Rockets.js,
//   HUD.js, HUDConsole.js, HUDFireControl.js, MessageLog.js,
//   PauseMenu.js, SettingsScreen.js, TestAimbot.js, DebugBridge.js,
//   Leaderboard.js, DevPanel.js,
//   Game.js, main.js
//
// RUN:  python -m http.server 8000   (or: npx serve .)
//       → open http://localhost:8000
//
// CONTROLS (v3.7.0):
//   MOUSE ........ move L/R = spin ship (full 360°, delta-based)
//   SPACE ........ thrust (always forward; +W = boost faster)
//   W / S ........ thrust forward / brake + reverse
//   A / D ........ rotate
//   L / LMB ...... fire current weapon
//   Q / H ........ stun rockets (H = lefty)
//   E / J ........ napalm rockets — high-damage AoE (J = lefty)
//   F / C ........ ultimate — unique per cat ship (C = lefty)
//   R / G ........ cycle weapon (G = lefty)
//   ` ............ toggle Dev/Admin panel
//   ENTER ........ start / restart
//   ESC / P ...... pause
//
// v3.1.0 CHANGES:
//   • 5 cat ship variants (Orange/Yellow/Grey/White/Brown), each with its
//     own ultimate — created via CatShipFactory.js, drawn by PlayerRenderer.js
//   • Weapon system: auto / semi / scatter / laser (R to cycle)
//   • F = cat-ship ultimate (per-variant cooldown), Q = stun rocket
//   • Menu: .ship-option cards with ship icons
//   • Touch UI: joystick + FIRE / BOOST / STUN / NOVA / WPN buttons
//
// v3.2.0 CHANGES:
//   • Catship base-model redesign (PlayerRenderer.js): cute/funny/futuristic
//     hull with front-paw weapon hardpoints, back-paw thruster rockets,
//     reactive tail, blinking face, muzzle flashes
//   • SHIP_GEOMETRY (config.js) = shared hardpoint positions for art + firing
// ============================================================
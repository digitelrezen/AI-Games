// Filename: main.js
// Kitty Vs Everything — v3.3.0
// Entry point: boots the Game, wires menu / game-over / leaderboard UI,
// and cat-ship theme selection (v3.85.0 hangar carousel hero stage).
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
// v3.87.0: Start menu polish — the hangar carousel CSS block was stranded
//          inside an unclosed #dev-panel rule (the browser discarded it:
//          arrows stacked vertically, nameplate clipped); style.css now
//          closes #dev-panel first and restores the hangar section as a
//          top-level block — arrows flank the stage left/right, the
//          nameplate sits centered under the ship, arrow controls enlarged.
//          The hero canvas also renders at native device-pixel resolution
//          (DPR-aware buffer) so the start screen is crisp on HiDPI.
export const VERSION = 'v3.87.0';
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

// ─── Cat ship theme selection (v3.85.0: HANGAR CAROUSEL) ─────────────
// v3.85.0: the cramped 9-thumbnail row is replaced by a single hero
// "hangar" stage that showcases the currently-selected cat ship at large
// scale, cycled one by one with the ‹/› arrows or the ←/→ keys. The hero
// canvas, nameplate and dots are generated here from PLAYER_THEMES (all 9
// themes) — index.html only provides the empty containers, so a new theme
// in config.js automatically gets a carousel entry.
let selectedTheme = 'yellow';

const hangarCanvas = document.getElementById('hangar-canvas');
const hangarCtx = hangarCanvas ? hangarCanvas.getContext('2d') : null;
// v3.87.0: size the hero buffer at native device-pixel resolution. The
// canvas CSS size stays 320×220; on HiDPI displays (DPR > 1) a fixed
// 320×220 buffer gets upscaled by the browser and the ship looks soft.
// renderHangar() draws in 320×220 logical units under ctx.scale(HANGAR_DPR).
const HANGAR_DPR = Math.max(1, window.devicePixelRatio || 1);
if (hangarCanvas) {
  hangarCanvas.width = Math.round(320 * HANGAR_DPR);
  hangarCanvas.height = Math.round(220 * HANGAR_DPR);
}
const hangarNameplate = document.getElementById('hangar-nameplate');
const hangarDots = document.getElementById('hangar-dots');
const HANGAR_THEMES = Object.keys(PLAYER_THEMES);
let hangarIndex = Math.max(0, HANGAR_THEMES.indexOf(selectedTheme));

// v3.85.0: render the active cat ship (same PlayerRenderer used in-game)
// into the hero stage at large scale so the pixel-art details and colors
// truly pop, then refresh the nameplate + dot indicators.
function renderHangar() {
  if (!hangarCtx) return;
  const key = HANGAR_THEMES[hangarIndex];
  const th = PLAYER_THEMES[key];
  // v3.87.0: draw in 320×220 logical units; the HANGAR_DPR buffer scale
  // keeps the ship crisp on HiDPI displays.
  hangarCtx.save();
  hangarCtx.scale(HANGAR_DPR, HANGAR_DPR);
  hangarCtx.clearRect(0, 0, 320, 220);
  // ~2.35× the in-game 70px sprite → ~165px tall, centered in the 320×220
  // stage. Static pose: nose up, idle thruster flame, tail straight.
  const mockPlayer = {
    theme: key,
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
  new PlayerRenderer(mockPlayer).drawCatShip(
    hangarCtx, 160, 110, 2.35,
    th.color, th.accent, th.pattern
  );
  hangarCtx.restore();
  if (hangarNameplate) hangarNameplate.textContent = th.name;
  if (hangarDots) {
    hangarDots.innerHTML = '';
    HANGAR_THEMES.forEach((t, i) => {
      const dot = document.createElement('span');
      dot.className = 'hangar-dot' + (i === hangarIndex ? ' active' : '');
      dot.title = PLAYER_THEMES[t].name;
      dot.addEventListener('click', () => { hangarIndex = i; selectedTheme = t; renderHangar(); });
      hangarDots.appendChild(dot);
    });
  }
}

// v3.85.0: step the carousel (wraps around) and keep selectedTheme in sync.
function hangarStep(dir) {
  hangarIndex = (hangarIndex + dir + HANGAR_THEMES.length) % HANGAR_THEMES.length;
  selectedTheme = HANGAR_THEMES[hangarIndex];
  renderHangar();
}

const hangarPrev = document.getElementById('hangar-prev');
const hangarNext = document.getElementById('hangar-next');
if (hangarPrev) hangarPrev.addEventListener('click', () => hangarStep(-1));
if (hangarNext) hangarNext.addEventListener('click', () => hangarStep(1));
renderHangar();
// v3.85.0: re-render once the AssetManager sprites are decoded — the first
// draw runs before the base64 cat_* decode (kicked off in the Game
// constructor) has landed, so without this the hero would show the
// procedural hull until the user cycled the carousel.
loadAssets().then(renderHangar);

// v3.85.0: ←/→ cycle the hangar carousel (only while the menu is up).
window.addEventListener('keydown', (e) => {
  if (game.state !== 'menu') return;
  if (e.code === 'ArrowLeft') { hangarStep(-1); e.preventDefault(); }
  else if (e.code === 'ArrowRight') { hangarStep(1); e.preventDefault(); }
});

// v3.85.0: collapsible CONTROLS panel — the dense keybind block is tucked
// behind a toggle so the main menu breathes. MenuKeybinds.js already renders
// the live binds into #menu-keybinds; this just shows/hides the panel.
const controlsToggle = document.getElementById('menu-controls-toggle');
const controlsPanel = document.getElementById('menu-controls-panel');
if (controlsToggle && controlsPanel) {
  controlsToggle.addEventListener('click', () => {
    const open = controlsPanel.classList.toggle('hidden') === false;
    controlsToggle.setAttribute('aria-expanded', String(open));
    controlsToggle.textContent = (open ? '▾' : '▸') + ' CONTROLS';
  });
}

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
//   • Menu: hangar carousel hero stage (‹/› arrows, ←/→ keys, nameplate, dots)
//   • Touch UI: joystick + FIRE / BOOST / STUN / NOVA / WPN buttons
//
// v3.2.0 CHANGES:
//   • Catship base-model redesign (PlayerRenderer.js): cute/funny/futuristic
//     hull with front-paw weapon hardpoints, back-paw thruster rockets,
//     reactive tail, blinking face, muzzle flashes
//   • SHIP_GEOMETRY (config.js) = shared hardpoint positions for art + firing
// ============================================================
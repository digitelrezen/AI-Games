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
// v3.88.0: Global crisp pixel-art rendering — the hangar hero canvas
//          disables image smoothing after its DPR buffer sizing (canvas
//          resize resets context state); style.css forces
//          image-rendering: pixelated/crisp-edges on all canvas/img
//          elements. Milestone version synced with package.json.
//          (REVERTED in v3.88.1 — see below.)
// v3.88.1: CRISP PASS ISOLATION — the v3.88.0 global CSS rule pixelated
//          the hangar hero preview and the surrounding UI (jagged,
//          blurry selection screen), so it was reverted: style.css now
//          scopes image-rendering strictly to #game-canvas, and the
//          hero canvas keeps its default bilinear smoothing (smooth
//          ship preview). Crisp nearest-neighbor rendering stays on the
//          main gameplay canvas only. Milestone version synced with
//          package.json.
// v3.90.0: CRISP 256×384 NATIVE CATSHIP HANGAR — the 9 catship assets
//          are now the native 256×384 PNGs (importer MAX_DIM 128 → 512,
//          art embeds untouched — no downscale, no blur) and the hangar
//          hero stage is sized to the native frame (320×384 CSS px,
//          buffer ×DPR). The v3.89.0 1:1 integer mapping is preserved
//          (HANGAR_K = max(1, round(DPR)) — one native pixel = one CSS
//          pixel, 2×2 blocks at DPR 2), but the shared stage center
//          moves to (160, 192): each ship's CONTENT box is blitted at
//          the identical 1:1 scale, centered on the fixed stage
//          midpoint — completely stationary (no bounce, no animation),
//          razor-sharp. (The old 320×220 stage clipped the 384px-tall
//          art.) Menu CSS compacted to fit the taller hero stage in the
//          720px stage. Milestone version synced with package.json.
// v3.89.0: CRISP HANGAR PREVIEW (1:1 INTEGER MAPPING) — the v3.88.1
//          bilinear hero preview was soft, so the hangar canvas goes back
//          to nearest-neighbor — but correctly this time: every cat
//          sprite is blitted at the integer HANGAR_K scale where one
//          native pixel maps to exactly one CSS pixel (1 buffer px at
//          DPR 1, 2×2 blocks at DPR 2), so there is no bilinear blur AND
//          no non-integer jaggedness (the v3.88.0 failure mode that
//          forced the revert). Each ship's CONTENT box (alpha bbox
//          measured once per sprite, cached in hangarMetrics) is
//          centered on the shared stage center (160, 110) at the
//          identical 1:1 scale — one scale, one bounding box, one center
//          for all 9 ships (White Cat reference). style.css re-applies
//          image-rendering: pixelated scoped to #hangar-canvas only
//          (safe now — the buffer→CSS downsample is a uniform integer
//          block). Milestone version synced with package.json.
// v3.95.0: HANGAR = IN-GAME PIPELINE — the hero preview no longer runs a
//          separate 1:1 content-box blit (HANGAR_K / hangarMetrics /
//          measureHangarSprite are gone). renderHangar now draws through
//          PlayerShipArt.drawSpriteShip — the exact sprite pipeline
//          PlayerRenderer uses in-game (70px frame × MAIN_SHIP_SCALE ×
//          HANGAR_ZOOM, theme shadow-glow, SHIP_GEOMETRY hardpoint FX) —
//          centered on the fixed midpoint of the square 384×384 stage
//          (192, 192). The selection screen now shows the ship exactly
//          as it flies. Milestone version synced with package.json.
export const VERSION = 'v3.96.0';
import Game from './Game.js';
import PlayerRenderer from '../player/PlayerRenderer.js';
import { PLAYER_THEMES, PLAYER_THEME_SPRITES } from './config.js'; // v3.89.0: hangar sprite lookup
import { loadAssets, getSprite } from './AssetManager.js'; // v3.72.1: re-render icons when sprites land
import { disableImageSmoothing } from './utils.js'; // v3.89.0: crisp hangar preview
import { drawSpriteShip } from '../player/PlayerShipArt.js'; // v3.95.0: hangar = in-game sprite pipeline
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
let selectedTheme = 'white_yellow';

const hangarCanvas = document.getElementById('hangar-canvas');
const hangarCtx = hangarCanvas ? hangarCanvas.getContext('2d') : null;
// v3.95.0: size the hero buffer at native device-pixel resolution. The
// canvas CSS size is the square 384×384 showcase stage; on HiDPI displays
// (DPR > 1) a fixed 384×384 buffer gets upscaled by the browser and the
// ship looks soft. renderHangar() draws in 384×384 logical units under
// ctx.scale(HANGAR_DPR).
const HANGAR_DPR = Math.max(1, window.devicePixelRatio || 1);
// v3.95.0: showcase zoom — the sprite renders through the SAME in-game
// pipeline as PlayerRenderer (70px frame × MAIN_SHIP_SCALE = 2x),
// multiplied by HANGAR_ZOOM so the selection screen shows the ship at
// 2× its in-game size (4× the 70px frame) with the identical theme glow
// and hardpoint FX.
const HANGAR_ZOOM = 2.0;
if (hangarCanvas) {
  hangarCanvas.width = Math.round(384 * HANGAR_DPR);
  hangarCanvas.height = Math.round(384 * HANGAR_DPR);
  // v3.89.0: nearest-neighbor drawImage on the hero canvas — with
  // smoothing disabled the pixel-art upscale stays crisp (no bilinear
  // blur). A canvas.width assignment resets 2D context state, so this
  // runs AFTER the sizing above.
  disableImageSmoothing(hangarCtx);
}
const hangarNameplate = document.getElementById('hangar-nameplate');
const hangarDots = document.getElementById('hangar-dots');
const HANGAR_THEMES = Object.keys(PLAYER_THEMES);
let hangarIndex = Math.max(0, HANGAR_THEMES.indexOf(selectedTheme));

// v3.95.0: render the active cat ship through the SAME in-game sprite
// pipeline (PlayerShipArt.drawSpriteShip) that PlayerRenderer uses —
// 70px frame × MAIN_SHIP_SCALE × HANGAR_ZOOM, theme shadow-glow, blink
// alpha and the SHIP_GEOMETRY hardpoint FX (thruster flames + weapon
// paws + muzzle) identical to gameplay. The ship is centered on the
// FIXED stage midpoint (192, 192) of the square 384×384 stage — all
// ships share the identical scale + center, so the carousel is
// completely stationary (no bounce on selection). Until the sprite
// decodes (or if it fails), fall back to the procedural hull — ~4.5×
// the in-game 70px sprite → ~315px tall, static pose: nose up, idle
// thruster flame, tail straight.
function renderHangar() {
  if (!hangarCtx) return;
  const key = HANGAR_THEMES[hangarIndex];
  const th = PLAYER_THEMES[key];
  // v3.95.0: draw in 384×384 logical units (square showcase stage);
  // the HANGAR_DPR buffer scale keeps the ship crisp on HiDPI displays.
  hangarCtx.save();
  hangarCtx.scale(HANGAR_DPR, HANGAR_DPR);
  hangarCtx.clearRect(0, 0, 384, 384);
  const sprite = getSprite(PLAYER_THEME_SPRITES[key]);
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
  if (sprite && sprite.width > 0 && sprite.height > 0) {
    hangarCtx.translate(192, 192); // v3.95.0: fixed stage midpoint
    drawSpriteShip(hangarCtx, sprite, th, mockPlayer, HANGAR_ZOOM);
  } else {
    new PlayerRenderer(mockPlayer).drawCatShip(
      hangarCtx, 192, 192, 4.5, // v3.95.0: fixed stage midpoint + native-frame scale
      th.color, th.accent, th.pattern
    );
  }
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
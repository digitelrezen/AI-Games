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
// v3.99.0: SEARCH & DESTROY mode — the SAR start button (index.html
//          #sard-btn) starts the sector-journey mode via
//          game.start(theme, { mode: 'sard' }); the retry button + Enter
//          key preserve the active mode so a SAR run retries as SAR.
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
// v3.97.0: HAZARDS — independent hazard field (js/hazards/) added;
//          milestone version synced with package.json.
// v3.98.0: HANGAR_ZOOM 2.0 → 1.0 — the hangar hero now renders the
//          catship at its EXACT in-game scale (70px frame ×
//          MAIN_SHIP_SCALE, no showcase zoom). Milestone version synced
//          with package.json.
// v3.100.0: HACKER TERMINAL HANGAR — the start screen is a terminal/
//          console UI (charcoal + neon cyan/magenta/green, CRT scanlines,
//          monospace type). The single-card carousel is replaced by a
//          ROSTER grid (3×3, all 9 Catships by callsign — PLAYER_THEMES
//          is the single source of truth) + a TACTICAL PREVIEW panel that
//          renders the selected ship at NATIVE resolution (1 art pixel =
//          1 CSS pixel on the 448×448 stage — no downscale, no showcase
//          zoom) with a wireframe overlay (grid, crosshair, corner
//          brackets, magenta bounding box + dimension callouts, theme
//          glow) and a digital readout strip. Keyboard: ←↑↓→/WASD
//          grid-nav (wraps), ENTER launches the active mode, TAB toggles
//          CLASSIC ↔ SEARCH & DESTROY. Milestone version synced with
//          package.json.
// v4.0.0: SEARCH & DESTROY — the sector-journey mode stamps 4.0.0:
//          the DISPLACEMENT-ACCUMULATOR camera (SectorMap) replaces the
//          v3.99.0 pan+rotation model (the player's screen offset is
//          tracked against a dead zone, the excess delta is accumulated
//          into world coordinates worldX/worldY and the ship is softly
//          recentered — PlayerFlight stays sovereign); debris, hazards
//          and regional patrols are WORLD-ANCHORED at absolute world
//          coordinates. Milestone version synced with package.json.
// v4.5.0: pause menu RETURN TO HANGAR — the ⌂ button in the pause overlay
//          (PauseMenu.js) calls game.returnToHangar() (StageFlow.js): full
//          session teardown + transition back to this hangar terminal.
//          Milestone version synced with package.json.
// v4.7.0: RnM ship dialogue + spawn-rate boost (RnMShip.js — the
//          interceptor plays its sequential Rick & Morty dialogue and
//          spawns regularly in classic + Search & Destroy modes).
//          Milestone version synced with package.json.
// v4.12.0: SPACE SNAKE PRE-WAVE + TANK EGG SHIPS — no boot changes (the
//          milestone is the RnM encounter: Space Snake pre-wave + tanked
//          egg ships in EasterEgg.js / RnMShip.js / SpaceSnakeEnemy.js).
//          Milestone version synced with package.json.
// v4.13.0: WEAPON SFX BALANCE + VULCAN REDESIGN — no boot changes (the
//          milestone is the js/core/audio/ suite: the primary-weapon
//          master bus WEAPON_BUS_GAIN 0.65 in SoundEffects.js and the
//          rebuilt vulkanShot() dual-layer mechanical snap). Milestone
//          version synced with package.json.
export const VERSION = 'v4.18.0';
import Game from './Game.js';
import PlayerRenderer from '../player/PlayerRenderer.js';
import { PLAYER_THEMES, PLAYER_THEME_SPRITES } from './config.js'; // v3.89.0: hangar sprite lookup
import { loadAssets, getSprite } from './AssetManager.js'; // v3.72.1: re-render icons when sprites land
import { disableImageSmoothing } from './utils.js'; // v3.89.0: crisp hangar preview
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

// ─── Cat ship theme selection (v3.100.0: HACKER TERMINAL HANGAR) ─────
// v3.100.0: the v3.85.0 hangar carousel (single hero card + ‹/› arrows +
// dots) is replaced by a terminal ROSTER grid — one cell per
// PLAYER_THEMES entry (all 9 Catships, by callsign), generated here so
// config.js stays the single source of truth — plus a TACTICAL PREVIEW
// panel that renders the selected ship at NATIVE resolution (1 art
// pixel = 1 CSS pixel, no downscale) with a wireframe overlay and a
// digital readout strip. index.html only provides the empty containers.
let selectedTheme = 'white_yellow';
// v3.100.0: the launch mode — TAB toggles CLASSIC ↔ SEARCH & DESTROY,
// ENTER launches the active mode, the mode buttons set it explicitly.
let launchMode = 'classic';

const hangarCanvas = document.getElementById('hangar-canvas');
const hangarCtx = hangarCanvas ? hangarCanvas.getContext('2d') : null;
// v3.100.0: the preview stage is the square 448×448 showcase (CSS px);
// the buffer is ×DPR so the native 1:1 blit stays crisp on HiDPI
// displays (1 art px = 1 CSS px = DPR buffer px). renderHangar() draws
// in 448×448 logical units under ctx.scale(HANGAR_DPR).
const HANGAR_STAGE = 448;
const HANGAR_DPR = Math.max(1, window.devicePixelRatio || 1);
if (hangarCanvas) {
  hangarCanvas.width = Math.round(HANGAR_STAGE * HANGAR_DPR);
  hangarCanvas.height = Math.round(HANGAR_STAGE * HANGAR_DPR);
  // nearest-neighbor drawImage on the hero canvas — with smoothing
  // disabled the pixel-art blit stays crisp (no bilinear blur). A
  // canvas.width assignment resets 2D context state, so this runs
  // AFTER the sizing above.
  disableImageSmoothing(hangarCtx);
}
const hangarNameplate = document.getElementById('hangar-nameplate');
const hangarRoster = document.getElementById('hangar-roster');
const hangarReadout = document.getElementById('hangar-readout');
const modeLabel = document.getElementById('menu-mode-label');
const HANGAR_THEMES = Object.keys(PLAYER_THEMES);
const HANGAR_COLS = 3;
let hangarIndex = Math.max(0, HANGAR_THEMES.indexOf(selectedTheme));

// v3.100.0: ROSTER grid — one cell per PLAYER_THEMES entry (index +
// callsign + color chip + status). Clicking a cell selects it; the
// keyboard grid-nav (hangarMove) drives the same state.
function renderRoster() {
  if (!hangarRoster) return;
  hangarRoster.innerHTML = '';
  HANGAR_THEMES.forEach((key, i) => {
    const th = PLAYER_THEMES[key];
    const cell = document.createElement('div');
    cell.className = 'roster-cell' + (i === hangarIndex ? ' active' : '');
    cell.setAttribute('role', 'option');
    cell.setAttribute('aria-selected', String(i === hangarIndex));
    const idx = document.createElement('span');
    idx.className = 'roster-idx';
    idx.textContent = String(i + 1).padStart(2, '0');
    const cs = document.createElement('span');
    cs.className = 'roster-callsign';
    cs.textContent = th.callsign;
    const chip = document.createElement('span');
    chip.className = 'roster-chip';
    chip.style.background = th.color;
    const st = document.createElement('span');
    st.className = 'roster-status';
    st.textContent = i === hangarIndex ? 'LOCKED' : 'READY';
    cell.append(idx, cs, chip, st);
    cell.addEventListener('click', () => { hangarIndex = i; selectedTheme = key; renderHangar(); });
    hangarRoster.appendChild(cell);
  });
}

// v3.100.0: TACTICAL OVERLAY — the wireframe layer drawn BEHIND the ship:
// faint cyan grid, center crosshair, soft radial theme glow, the native
// 256×384 frame bounding box (magenta, dashed) with W/H dimension
// callouts, and neon corner brackets.
function drawTacticalOverlay(ctx, th) {
  const S = HANGAR_STAGE;
  const C = S / 2;
  ctx.save();
  // faint grid
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.055)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let g = 32; g < S; g += 32) {
    ctx.moveTo(g + 0.5, 0); ctx.lineTo(g + 0.5, S);
    ctx.moveTo(0, g + 0.5); ctx.lineTo(S, g + 0.5);
  }
  ctx.stroke();
  // center crosshair
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.18)';
  ctx.beginPath();
  ctx.moveTo(C + 0.5, 0); ctx.lineTo(C + 0.5, S);
  ctx.moveTo(0, C + 0.5); ctx.lineTo(S, C + 0.5);
  ctx.stroke();
  // soft theme glow behind the hull
  const glow = ctx.createRadialGradient(C, C, 30, C, C, 210);
  glow.addColorStop(0, th.accent + '2e');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);
  // native-frame bounding box (256×384 art centered on the stage)
  const BW = 256, BH = 384;
  const x0 = C - BW / 2, y0 = C - BH / 2;
  ctx.strokeStyle = 'rgba(255, 79, 216, 0.55)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, BW, BH);
  ctx.setLineDash([]);
  // dimension callouts
  ctx.fillStyle = 'rgba(83, 255, 138, 0.9)';
  ctx.font = "10px 'Cascadia Mono', Consolas, monospace";
  ctx.fillText('W:256', x0, y0 - 5);
  ctx.fillText('H:384', x0 + BW + 5, y0 + 10);
  // corner brackets
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.9)';
  ctx.lineWidth = 2;
  const B = 22, M = 6;
  const bracket = (x, y, dx, dy) => {
    ctx.beginPath();
    ctx.moveTo(x + dx * B, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * B);
    ctx.stroke();
  };
  bracket(M, M, 1, 1);
  bracket(S - M, M, -1, 1);
  bracket(M, S - M, 1, -1);
  bracket(S - M, S - M, -1, -1);
  ctx.restore();
}

// v3.100.0: render the selected cat ship at NATIVE resolution — the
// 256×384 cat_* art is blitted 1:1 (1 art pixel = 1 CSS pixel) centered
// on the fixed stage midpoint (224, 224): no downscale, no showcase
// zoom, pixel-perfect. The tactical overlay sits behind; the DOM readout
// strip updates alongside. Until the sprite decodes (or if it fails),
// fall back to the procedural hull — static pose: nose up, idle flame.
function renderHangar() {
  renderRoster();
  if (!hangarCtx) return;
  const key = HANGAR_THEMES[hangarIndex];
  const th = PLAYER_THEMES[key];
  const C = HANGAR_STAGE / 2;
  // draw in 448×448 logical units; the HANGAR_DPR buffer scale keeps the
  // native 1:1 blit crisp on HiDPI displays.
  hangarCtx.save();
  hangarCtx.scale(HANGAR_DPR, HANGAR_DPR);
  hangarCtx.clearRect(0, 0, HANGAR_STAGE, HANGAR_STAGE);
  drawTacticalOverlay(hangarCtx, th);
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
    // v3.100.0: NATIVE 1:1 blit — the art's own pixels, no rescale.
    hangarCtx.save();
    hangarCtx.shadowColor = th.accent;
    hangarCtx.shadowBlur = 26;
    hangarCtx.drawImage(sprite, C - sprite.width / 2, C - sprite.height / 2, sprite.width, sprite.height);
    hangarCtx.restore();
  } else {
    new PlayerRenderer(mockPlayer).drawCatShip(
      hangarCtx, C, C, 4.5,
      th.color, th.accent, th.pattern
    );
  }
  hangarCtx.restore();
  if (hangarNameplate) hangarNameplate.textContent = th.callsign;
  if (hangarReadout) {
    hangarReadout.innerHTML = '';
    const artW = sprite && sprite.width ? sprite.width : 256;
    const artH = sprite && sprite.height ? sprite.height : 384;
    const fields = [
      ['UNIT', th.callsign],
      ['ART', `${artW}×${artH} @1:1`],
      ['CORE', th.color],
      ['ACCENT', th.accent],
      ['PATTERN', th.pattern.toUpperCase()],
      ['CLASS', 'CATSHIP-9'],
    ];
    for (const [k, v] of fields) {
      const f = document.createElement('span');
      f.className = 'ro-field';
      const b = document.createElement('b');
      b.textContent = k;
      f.append(b, document.createTextNode(' ' + v));
      hangarReadout.appendChild(f);
    }
  }
}

// v3.100.0: step the ROSTER grid cursor (wraps on every edge) and keep
// selectedTheme in sync.
function hangarMove(dx, dy) {
  const rows = Math.ceil(HANGAR_THEMES.length / HANGAR_COLS);
  let col = hangarIndex % HANGAR_COLS;
  let row = Math.floor(hangarIndex / HANGAR_COLS);
  col = (col + dx + HANGAR_COLS) % HANGAR_COLS;
  row = (row + dy + rows) % rows;
  hangarIndex = row * HANGAR_COLS + col;
  selectedTheme = HANGAR_THEMES[hangarIndex];
  renderHangar();
}

// v3.100.0: TAB toggles the launch mode (CLASSIC ↔ SEARCH & DESTROY);
// the mode buttons highlight to match and set it explicitly on click.
const startBtn = document.getElementById('start-btn');
const sardBtn = document.getElementById('sard-btn');
function setLaunchMode(mode) {
  launchMode = mode;
  if (modeLabel) modeLabel.textContent = mode === 'sard' ? 'MODE: SEARCH & DESTROY [TAB]' : 'MODE: CLASSIC [TAB]';
  if (startBtn) startBtn.classList.toggle('mode-active', mode === 'classic');
  if (sardBtn) sardBtn.classList.toggle('mode-active', mode === 'sard');
}
function toggleLaunchMode() {
  setLaunchMode(launchMode === 'classic' ? 'sard' : 'classic');
}
renderHangar();
setLaunchMode('classic');
// v3.85.0: re-render once the AssetManager sprites are decoded — the first
// draw runs before the base64 cat_* decode (kicked off in the Game
// constructor) has landed, so without this the hero would show the
// procedural hull until the user cycled the roster.
loadAssets().then(renderHangar);

// v3.100.0: ←↑↓→ / WASD grid-nav the ROSTER (only while the menu is up);
// TAB toggles the launch mode.
window.addEventListener('keydown', (e) => {
  if (game.state !== 'menu') return;
  const k = e.code;
  if (k === 'ArrowLeft' || k === 'KeyA') { hangarMove(-1, 0); e.preventDefault(); }
  else if (k === 'ArrowRight' || k === 'KeyD') { hangarMove(1, 0); e.preventDefault(); }
  else if (k === 'ArrowUp' || k === 'KeyW') { hangarMove(0, -1); e.preventDefault(); }
  else if (k === 'ArrowDown' || k === 'KeyS') { hangarMove(0, 1); e.preventDefault(); }
  else if (k === 'Tab') { toggleLaunchMode(); e.preventDefault(); }
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
// v3.99.0: SEARCH & DESTROY — the SAR button starts the sector-journey
// mode (game.start with mode 'sard'); retry preserves the active mode so a
// SAR run retries as SAR and a classic run retries as classic.
// v3.100.0: the mode buttons also set the launch mode (TAB/ENTER parity).
document.getElementById('start-btn').addEventListener('click', () => { setLaunchMode('classic'); game.start(selectedTheme); });
if (sardBtn) sardBtn.addEventListener('click', () => { setLaunchMode('sard'); game.start(selectedTheme, { mode: 'sard' }); });
document.getElementById('retry-btn').addEventListener('click', () => game.start(selectedTheme, { mode: game.mode === 'sard' ? 'sard' : undefined }));

// v3.14.0: start-screen ⚙ opens the shared settings screen (keybinds + audio)
document.getElementById('menu-settings-btn').addEventListener('click', () => {
  if (game.settings) game.settings.open();
});

// Enter key shortcut (v3.100.0: from the menu it launches the ACTIVE
// launch mode — TAB toggles CLASSIC ↔ SAR; game-over retry preserves the
// run's mode)
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') {
    if (game.state === 'menu' || game.state === 'gameover') {
      const mode = game.state === 'gameover' ? (game.mode === 'sard' ? 'sard' : undefined) : (launchMode === 'sard' ? 'sard' : undefined);
      game.start(selectedTheme, { mode });
    }
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
// Filename: DevPanel.js
// Kitty Vs Everything — v3.55.0
// Toggleable admin panel (backtick / F9): spawn any species at any tier,
// weapon override, instant bonus level, god mode, robot drop (Bender easter egg),
// ship drop (Planet Express flyby easter egg, v3.27.0; v3.28.0: 3-pass
// traversing flyby, shootable, drops the Bender 'robot' power-up),
// screen-bounds toggle (bounce vs classic wrap), asteroid chain drop.
// v3.27.0: "Drop Ship" button — switchEgg(game, 'ship') spawns the
//          Planet Express ship flyby (EasterEgg.js manager, ShipSprite.js).
// v3.1.0: Replaced ELEMENTS/ELEMENT_ORDER with WEAPONS/WEAPON_ORDER.
// v3.3.0: Mini button no longer picks a random theme — minis always clone
//         the player's current theme (strict same-color fleet rule).
// v3.5.0: Added Flight section — spin-speed sensitivity slider
//         (the shared spin setting) that scaled mouse-look AND A/D rotation.
// v3.12.0: Display section — browser fullscreen toggle button (the U key
//          is handled by ViewScaler.js; the label syncs on fullscreenchange).
// v3.14.0: The spin slider moved to the Settings screen (split into
//          keyboard/mouse sensitivities) — replaced here with a TEST
//          AIMBOT button (weapon-testing toggle, shared with the F8 key).
// v3.34.0: REDESIGNED (bug fix: the panel was taller than the 720px stage
//          on 16:9, so the bottom sections rendered off-screen and were
//          unreachable). The panel is now a flex column — pinned header,
//          scrollable .dev-body, pinned footer — with a stage-relative
//          max-height (calc(100% - 20px) of #game-root), so it fits and
//          scales at ANY resolution (1366×768 → 4K/32:9). Sections were
//          regrouped (Spawn / Weapons / Player / Bonus / Drops / World &
//          Display) with 2-column grids. New footer: live viewport
//          readout (window → logical stage → buffer) via Viewport.js,
//          refreshed on resize + fullscreenchange.
// v3.42.0: debug asteroid drop now spawns fully off-screen (ASTEROID.spawnY),
//          matching the v3.42.0 gameplay spawn rule.
// v3.55.0: crosshair offset slider range widened to 140–340 logical px
//          (Settings.js LIMITS is the source of truth; setSetting clamps).
// v3.81.0: "Spaceballs One" dev button — force-spawns the rare
//          unstoppable easter-egg ship (switchEgg(game, 'spaceballs')).
export const VERSION = 'v3.82.0';
import { ENEMY_TYPES, TIERS, WEAPONS, WEAPON_ORDER, MINI_SHIP, ASTEROID } from '../core/config.js';
import { createEnemy } from '../enemies/EnemyFactory.js';
import PowerUp from '../combat/PowerUp.js';
import { spawnAsteroid } from '../levels/AsteroidBonus.js'; // v3.11.0: debug asteroid drop
import { switchEgg } from '../core/EasterEgg.js'; // v3.27.0: ship flyby dev button
import { bus } from '../core/EventBus.js';
import { SETTINGS, setSetting } from './Settings.js';
import { computeViewport, describeViewport } from '../core/Viewport.js'; // v3.34.0: footer readout

export default class DevPanel {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('dev-panel');
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote' || e.code === 'F9') {
        e.preventDefault();
        this.el.classList.toggle('hidden');
      }
    });
    document.getElementById('dev-close').onclick = () => this.el.classList.add('hidden');
    document.getElementById('dev-version').textContent = VERSION;

    // ─── v3.34.0: LIVE VIEWPORT READOUT (pinned footer) ───
    // The panel is stage-relative (it lives inside #game-root and scales
    // with the game), so this shows exactly what the player is running —
    // window px → logical stage → canvas buffer — and refreshes on resize
    // and fullscreen changes.
    const vpEl = document.getElementById('dev-viewport');
    const refreshViewport = () => {
      if (!vpEl) return;
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth, h = window.innerHeight;
      vpEl.textContent = describeViewport(computeViewport(w, h, dpr), w, h);
    };
    window.addEventListener('resize', refreshViewport);
    document.addEventListener('fullscreenchange', refreshViewport);
    refreshViewport();

    const typeSel = document.getElementById('dev-type');
    for (const [k, v] of Object.entries(ENEMY_TYPES)) typeSel.add(new Option(v.name, k));
    const tierSel = document.getElementById('dev-tier');
    for (const [k, v] of Object.entries(TIERS)) tierSel.add(new Option(v.label, k));
    document.getElementById('dev-spawn').onclick = () => {
      if (this.game.state === 'menu') return;
      const enemy = createEnemy({
        type: typeSel.value, tier: tierSel.value,
        x: 200 + Math.random() * (this.game.W - 400), y: -40, game: this.game,
      });
      this.game.enemies.push(enemy);
    };

    // ─── v3.30.0: WAVE SPAWN-COUNT SLIDER ───
    // 0 = AUTO (sawtooth 20→300 ramp); >0 pins the active enemy count for
    // every wave. Bound to waveManager.spawnOverride (Game creates the
    // waveManager before this panel, so this.game.waveManager is ready).
    const spawnCount = document.getElementById('dev-spawn-count');
    const spawnCountVal = document.getElementById('dev-spawn-count-val');
    const wm = this.game.waveManager;
    const syncSpawnCount = () => {
      spawnCountVal.textContent = spawnCount.value === '0' ? 'AUTO' : spawnCount.value;
    };
    spawnCount.value = String(wm ? wm.spawnOverride : 0);
    syncSpawnCount();
    spawnCount.oninput = () => {
      if (wm) wm.spawnOverride = parseInt(spawnCount.value, 10) || 0;
      syncSpawnCount();
    };

    // ─── v3.14.0: TEST AIMBOT (dev weapon-testing toggle) ───
    // Spin sensitivity now lives in the Settings screen
    // (set-spin-kb / set-spin-mouse — split keyboard/mouse values); the
    // old shared dev spin slider is retired. The T key and this button
    // both call TestAimbot.toggle() — the label mirrors it live.
    const aimbotBtn = document.getElementById('dev-aimbot');
    if (aimbotBtn) {
      const refreshAimbot = () => {
        const on = !!(this.game.testAimbot && this.game.testAimbot.active);
        aimbotBtn.textContent = on ? 'TEST AIMBOT: ON' : 'TEST AIMBOT';
        aimbotBtn.classList.toggle('active', on);
      };
      aimbotBtn.onclick = () => {
        if (this.game.testAimbot) { this.game.testAimbot.toggle(); refreshAimbot(); }
      };
      bus.on('banner', (e) => { if (e.text && e.text.indexOf('TEST AIMBOT') === 0) refreshAimbot(); });
      refreshAimbot();
    }

    // Weapon override buttons
    const wrap = document.getElementById('dev-weapons');
    for (const wid of WEAPON_ORDER) {
      const b = document.createElement('button');
      b.textContent = WEAPONS[wid].name;
      b.onclick = () => {
        if (this.game.player) {
          this.game.player.weapon = wid;
          this.game.player.thermal = 0;
          this.game.player.thermalLockout = 0;
          this.game.player.plasmaAlt = 0;
          bus.emit('banner', { text: 'WEAPON: ' + WEAPONS[wid].name, tone: 'good', duration: 1 });
        }
      };
      wrap.appendChild(b);
    }

    const g = game;
    document.getElementById('dev-life').onclick = () => { if (g.player) g.player.lives++; };
    document.getElementById('dev-mini').onclick = () => this.addMini();
    document.getElementById('dev-bonus').onclick = () => g.startBonusLevel();
    const boneBtn = document.getElementById('dev-bonus-bone');
    if (boneBtn) boneBtn.onclick = () => g.startBonusSpecific('boneyard');
    const internetBtn = document.getElementById('dev-bonus-internet');
    if (internetBtn) internetBtn.onclick = () => g.startBonusSpecific('internet');
    document.getElementById('dev-clear').onclick = () => {
      g.enemies = [];
      g.bullets = g.bullets.filter(b => b.friendly);
      g.bonusTargets = [];
    };
    document.getElementById('dev-score').onclick = () => { g.score += 10000; };
    // ─── v3.48.0: CROSSHAIR OFFSET SLIDER (live) ───
    // The reticle is drawn by Crosshair.js in Game.render(); this slider
    // live-tweaks SETTINGS.crosshairOffset (140–340 logical px in front of the
    // nose). The on/off toggle lives in Settings → FX (set-crosshair).
    const xhOffset = document.getElementById('dev-crosshair-offset');
    const xhOffsetVal = document.getElementById('dev-crosshair-offset-val');
    if (xhOffset) {
      const syncXh = () => { if (xhOffsetVal) xhOffsetVal.textContent = String(SETTINGS.crosshairOffset); };
      xhOffset.value = String(SETTINGS.crosshairOffset);
      syncXh();
      xhOffset.oninput = () => {
        setSetting('crosshairOffset', parseFloat(xhOffset.value));
        syncXh();
      };
    }
    document.getElementById('dev-robot').onclick = () => g.powerups.push(new PowerUp({ x: g.W / 2, y: -30, type: 'robot', game: g }));
    // ─── v3.27.0: Drop Ship — Planet Express flyby easter egg ───
    // v3.28.0: the ship now traverses right↔left (3 passes) and is
    // shootable — destroying it drops the Bender 'robot' power-up.
    const shipBtn = document.getElementById('dev-ship');
    if (shipBtn) {
      shipBtn.onclick = () => {
        switchEgg(g, 'ship'); // traversing flyby (EasterEgg manager)
        bus.emit('banner', { text: 'PLANET EXPRESS, INCOMING', tone: 'good', duration: 1.5 });
      };
    }
    // ─── v3.81.0: Spaceballs One — the rare unstoppable easter-egg ship ───
    // Force-spawns the ship (no roll): bottom-right → top-left diagonal
    // (v3.82.0), obliterates everything in its path, brake-light stream at
    // the player, and a treasure-chest jackpot (one of EVERY power-up) on
    // destruction.
    const spaceballsBtn = document.getElementById('dev-spaceballs');
    if (spaceballsBtn) {
      spaceballsBtn.onclick = () => {
        switchEgg(g, 'spaceballs'); // force-spawn (EasterEgg manager slot)
        bus.emit('banner', { text: 'SPACEBALLS ONE INBOUND — WE BRAKE FOR NOBODY!', tone: 'warn', duration: 2.5 });
      };
    }
    // ─── v3.11.0: screen bounds toggle (classic wrap vs bounce) ───
    const boundsBtn = document.getElementById('dev-bounds');
    if (boundsBtn) {
      const refreshBounds = () => {
        boundsBtn.textContent = SETTINGS.screenBounds ? 'BOUNDS: BOUNCE' : 'BOUNDS: WRAP (classic)';
        boundsBtn.classList.toggle('active', !!SETTINGS.screenBounds);
      };
      boundsBtn.onclick = () => {
        setSetting('screenBounds', !SETTINGS.screenBounds);
        refreshBounds();
        bus.emit('banner', {
          text: SETTINGS.screenBounds ? 'SCREEN BOUNDS: BOUNCE' : 'SCREEN BOUNDS: WRAP (classic)',
          tone: 'good', duration: 1.2,
        });
      };
      refreshBounds();
    }
    // ─── v3.11.0: drop a large asteroid chain power-up ───
    const asteroidBtn = document.getElementById('dev-asteroid');
    if (asteroidBtn) asteroidBtn.onclick = () => spawnAsteroid(g, g.W / 2, ASTEROID.spawnY); // v3.42.0: off-screen
    document.getElementById('dev-god').onclick = (e) => {
      g.godMode = !g.godMode;
      e.target.classList.toggle('active', g.godMode);
      e.target.textContent = g.godMode ? 'GOD: ON' : 'GOD MODE';
    };
    // ─── v3.12.0: browser fullscreen toggle (U key handled by ViewScaler) ───
    const fsBtn = document.getElementById('dev-fullscreen');
    if (fsBtn) {
      const refreshFs = () => {
        const on = game.view.isFullscreen();
        fsBtn.textContent = on ? 'FULLSCREEN: ON' : 'FULLSCREEN: OFF';
        fsBtn.classList.toggle('active', on);
      };
      fsBtn.onclick = () => game.view.toggleFullscreen();
      document.addEventListener('fullscreenchange', refreshFs);
      refreshFs();
    }
  }
  /** Dock a mini (v3.3.0: always clones the player's current theme). */
  addMini() {
    const g = this.game;
    if (g.player && g.player.minis.length < MINI_SHIP.maxDocked) g.player.addMini();
  }
}
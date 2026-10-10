// Filename: HUD.js
// Kitty Vs Everything — v3.3.0
// DOM HUD top bar (HP, Shield, Lives, Score, Wave, Timer, Weapon,
// Stun/Nova/Thermal indicators) + canvas floating combat text + banners.
// v3.1.0: Replaced ELEMENTS with WEAPONS. Added thermal indicator.
// v3.2.0: No HUD layout changes (catship redesign lives in PlayerRenderer).
// v3.3.0: Version label bumped with the mini-ship module split.
// v3.6.0: Version label bumped with the catship art pass (arm-style rear
//         legs, invisible dock ports, determined face) + 360° mouse-look.
// v3.7.0: NAPALM indicator (E/J napalm rocket cooldown).
// v3.10.0: FLEET row — docked mini-ship HP bars (L / R) in the HUD top bar:
//          per-side bar + number, green / amber / red by remaining HP,
//          white flash frame while the mini's hitFlash is up. Row hides
//          when no minis are docked.
// v3.12.0: Version label bumped with dynamic display scaling + fullscreen.
// v3.13.0: Version label bumped with the dynamic ultra-wide viewport.
// v3.14.0: FLEET strip + weapon-label / thermal readouts moved to
//          HUDFireControl.js (bottom fire-control dashboard). HUD keeps
//          HP/shield/lives/score/wave/timer + compact stun/napalm/nova tags.
// v3.15.0: Version label bumped with the Internet entourage (gold chain
//          + iced-out real-time clock pendants on the Black Cats).
// v3.16.0: Version label bumped with mini-fleet deploy/recall + weapon anim.
// v3.21.0: Removed the duplicate STUN / NAPALM / NOVA top-right indicators —
//          the fire-control panel's slots (HUDFireControl.js) are the single
//          source of truth for ability state.
// v3.29.0: Bender easter egg — the 10 s countdown is gone; the label now
//          shows the kill counter "BENDER x/4" (game.aimbot.killCount /
//          BENDER_KILLS) while the egg's aim window is open.
// v3.77.0: Version label bumped with the Phase 4 modularization lock-in
//          (4-phase modular refactor complete — see ARCHITECTURE.md).
// v3.78.0: A/D control mode (strafe / spin) + pause-button removal.
// v3.79.0: Version label bumped with the dock arc coupler plasma upgrade
//          (no HUD changes).
// v3.80.0: Version label bumped with the drop rarity overhaul (no HUD
//          changes — drops render through the existing power-up pipeline).
// v3.81.0: Version label bumped with Spaceballs One (no HUD changes —
//          the egg renders through the EasterEgg manager draw path).
// v3.88.0: Version label bumped with the global crisp pixel-art rendering
//          pass (no HUD changes — the fix lives in style.css + the 2D
//          context smoothing enforcement in utils/Game/ViewScaler/main).
// v3.88.1: Version label bumped with the crisp pass isolation (no HUD
//          changes — the v3.88.0 global CSS rule was reverted and
//          image-rendering is scoped to #game-canvas only; the hangar
//          hero canvas keeps default bilinear smoothing).
// v3.89.0: Version label bumped with the crisp 1:1 hangar preview (no
//          HUD changes — the fix lives in main.js + style.css).
// v3.95.0: Version label bumped with the in-game-pipeline hangar hero
//          preview (no HUD changes — the fix lives in main.js + style.css).
// v3.97.0: HAZARDS — independent hazard field (js/hazards/); version
//          label bumped with the milestone.
// v3.98.0: Version label bumped with the exact-scale hangar (HANGAR_ZOOM
//          1.0) + the F9 admin-panel passphrase gate (no HUD changes).
// v3.99.0: SEARCH & DESTROY mode — the wave label is owned by the SAR
//          facade (g.sard.hudLabel(): zone + journey progress) instead of
//          the wave counter while in SAR mode.
// v4.6.0: Version label bumped with the multi-track playlist soundtrack
//          (no HUD changes — the rotation lives in AudioSystem.js).
// v4.7.0: Version label bumped with the RnM ship dialogue (the
//          #alert-banner 'dialogue' style renders the interceptor's
//          sequential Rick & Morty lines — showBanner is unchanged).
// v4.12.0: SPACE SNAKE PRE-WAVE + TANK EGG SHIPS — version label bumped
//          (no HUD changes — the milestone is the RnM encounter: Space
//          Snake pre-wave + tanked egg ships in EasterEgg.js /
//          RnMShip.js / SpaceSnakeEnemy.js).
// v4.13.0: WEAPON SFX BALANCE + VULCAN REDESIGN — version label bumped
//          (no HUD changes — the milestone is the js/core/audio/ suite:
//          the primary-weapon master bus WEAPON_BUS_GAIN 0.65 in
//          SoundEffects.js + the rebuilt vulkanShot() dual-layer
//          mechanical snap).
export const VERSION = 'v4.21.0';
import { formatTime } from '../core/utils.js';
import { bus } from '../core/EventBus.js';
import { BENDER_KILLS } from '../core/EasterEgg.js'; // v3.29.0: "BENDER x/4" kill counter

export default class HUD {
  constructor(game) {
    this.game = game;
    this.bannerEl = document.getElementById('alert-banner');
    this.floaters = [];
    this.bannerTimer = 0;
    document.getElementById('version-label').textContent = VERSION;
    bus.on('banner', (d) => this.showBanner(d.text, d.tone, d.duration));
    bus.on('dmg', (d) => {
      if (this.floaters.length < 60) this.floaters.push({ x: d.x, y: d.y, text: d.text, color: d.color, life: 0.9 });
    });
  }
  showBanner(text, tone, duration) {
    this.bannerEl.textContent = text;
    this.bannerEl.className = tone || 'good';
    this.bannerTimer = duration || 2;
  }
  update(dt) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerEl.className = 'hidden';
    }
    const g = this.game;
    if (g.state === 'menu' || g.state === 'gameover' || !g.player) return;
    const p = g.player;

    const hpPct = Math.max(0, 100 * p.hp / p.maxHp);
    document.getElementById('hp-fill').style.width = hpPct + '%';
    document.getElementById('hp-text').textContent = Math.ceil(p.hp);
    const shPct = p.maxShield > 0 ? Math.max(0, 100 * p.shield / p.maxShield) : 0;
    document.getElementById('shield-fill').style.width = shPct + '%';
    document.getElementById('shield-text').textContent = Math.ceil(p.shield);

    // ─── FLEET strip (v3.14.0): owned by HUDFireControl.js (dashboard) ───

    document.getElementById('lives').textContent = '❤ ' + p.lives;
    document.getElementById('score').textContent = 'SCORE ' + g.score.toLocaleString();
    document.getElementById('multiplier').textContent = 'x' + g.multiplier.toFixed(1);

    let waveText;
    if (g.mode === 'sard' && g.sard) {
      // v3.99.0: SEARCH & DESTROY — the SAR facade owns the mode label
      // (zone + journey progress) instead of the wave counter.
      waveText = g.sard.hudLabel();
    } else if (g.state === 'bonus') {
      // v3.76.0: the stage label comes from the LevelRegistry manifest —
      // new bonus stages label themselves without touching the HUD.
      waveText = g.levelRegistry.labelFor(g.levelRegistry.currentEntry) || 'BONUS LEVEL';
    } else {
      waveText = 'WAVE ' + g.waveManager.wave;
    }
    document.getElementById('wave-label').textContent = waveText;
    document.getElementById('mission-timer').textContent = formatTime(g.time);

    // Weapon label + thermal: v3.14.0 — owned by HUDFireControl.js (it
    // updates weapon-label / fc-weapon-status / thermal-indicator live,
    // including the ×N mini multiplier and HOT/LOCKED states).

    // Stun / Napalm / Nova: v3.21.0 — the duplicate top-right indicators were
    // removed; the fire-control panel's slots (HUDFireControl.js) are the
    // single source of truth for ability state.

    // Bender easter egg (v3.24.0, kill-based v3.29.0) — kill counter
    const abEl = document.getElementById('aimbot-label');
    if (g.aimbot.active || g.aimbot.aimbotActive) {
      abEl.classList.remove('hidden');
      abEl.textContent = 'BENDER ' + g.aimbot.killCount + '/' + BENDER_KILLS;
    } else {
      abEl.classList.add('hidden');
    }

    // v3.20.0: P2 HUD (co-op / LAN)
    this._updateP2Hud(g);

    // Floating combat text
    for (const f of this.floaters) { f.y -= 40 * dt; f.life -= dt; }
    this.floaters = this.floaters.filter(f => f.life > 0);
  }
  draw(ctx) {
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  /** v3.20.0: update the P2 HUD (co-op / LAN). Hidden in solo. */
  _updateP2Hud(g) {
    const p2Hud = document.getElementById('p2-hud');
    if (!p2Hud) return;
    const p2 = g.player2;
    if (!p2) { p2Hud.classList.add('hidden'); return; }
    p2Hud.classList.remove('hidden');
    const callsign = document.getElementById('p2-callsign');
    if (callsign) callsign.textContent = (p2.callsign || 'P2').toUpperCase();
    document.getElementById('p2-lives').textContent = '❤ ' + p2.lives;
    document.getElementById('p2-score').textContent = Math.round(p2.score || 0).toLocaleString();
    const hpPct = Math.max(0, 100 * p2.hp / p2.maxHp);
    document.getElementById('p2-hp-fill').style.width = hpPct + '%';
    const shPct = p2.maxShield > 0 ? Math.max(0, 100 * p2.shield / p2.maxShield) : 0;
    document.getElementById('p2-shield-fill').style.width = shPct + '%';
  }
}
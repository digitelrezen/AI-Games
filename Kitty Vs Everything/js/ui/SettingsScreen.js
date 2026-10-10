// Filename: SettingsScreen.js
// Kitty Vs Everything — v3.48.0
// Shared settings panel (opened from the START SCREEN ⚙ button, the PAUSE
// MENU Options button, or the Dev Panel). One screen serves both contexts:
//   • KEYBINDS — click any key chip to rebind; captureNextInput grabs the
//     next keyboard key OR mouse button (ESC cancels); steals conflict codes
//   • FLIGHT — keyboard / mouse spin sensitivity sliders (split in v3.14.0)
//   • AUDIO — master / SFX / music volume sliders (live AudioSystem)
//   • FX — screen-shake toggle + particle-density slider
// Everything persists via Settings.js / Keybinds.js (localStorage).
// Esc closes the screen (the PauseMenu defers to it while it is open).
// v3.31.0: cursor coordination — open() releases the pointer lock (the
//          panel needs the cursor); close() re-locks it when the mission
//          is still active (no-op from the menu / while paused).
// v3.78.0: A/D control mode radio pair (strafe / spin) in the FLIGHT section
//          — writes Settings.controlMode (see _buildControlMode).
// v4.22.0: CROSSHAIR section — style chips (classic/brackets/diamond/dot),
//          color chips (red/green/yellow/blue/white), length + size + offset
//          sliders (offset 140–340 px — pushes the reticle out in front of
//          the ship, same range as the dev panel), and a LIVE PREVIEW canvas
//          drawn by the same drawReticle() the in-game reticle uses
//          (see _buildCrosshair). CONTROLLER section —
//          gamepad enable toggle + connection status line (see _buildGamepad).
export const VERSION = 'v4.22.0';
import { SETTINGS, setSetting, resetSettings } from './Settings.js';
import { drawReticle, CROSSHAIR_STYLES, CROSSHAIR_COLORS } from './Crosshair.js'; // v4.22.0: shared reticle renderer (live preview) + style/color source of truth
import {
  ACTIONS, ACTION_LABELS, getBinds, setBind, resetBinds,
  actionForCode, codeLabel, captureNextInput,
} from '../input/Keybinds.js';
import { audio } from '../core/AudioSystem.js';
import { bus } from '../core/EventBus.js';
import netSettingsUI from '../../net/NetSettingsUI.js'; // v3.20.0: LAN / multiplayer panel

function byId(id) { return document.getElementById(id); }
const pct = (v) => Math.round(v * 100) + '%';
const x2 = (v) => Number(v).toFixed(2) + '×';

export default class SettingsScreen {
  constructor(game) {
    this.game = game;
    this.el = byId('settings-screen');
    this._syncers = [];
    this._buildKeybinds();
    this._buildSliders();
    this._buildToggles();
    this._buildControlMode(); // v3.78.0: A/D strafe / spin radio pair
    this._buildCrosshair();   // v4.22.0: reticle style/color/size/length + preview
    this._buildGamepad();     // v4.22.0: controller toggle + connection status
    // v3.20.0: mount the LAN / multiplayer settings panel.
    const netContainer = byId('net-settings');
    if (netContainer) netSettingsUI.attach(game, netContainer);

    for (const id of ['settings-close', 'settings-done']) {
      const b = byId(id);
      if (b) b.onclick = () => this.close();
    }
    const resetBtn = byId('settings-reset');
    if (resetBtn) resetBtn.onclick = () => {
      resetSettings();
      resetBinds();
      this._syncAll();
      bus.emit('banner', { text: 'SETTINGS RESET TO DEFAULTS', tone: 'good', duration: 1.5 });
      audio.uiBlip(660, 0.08);
    };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && !this.el.classList.contains('hidden')) this.close();
    });
  }

  open() {
    this.el.classList.remove('hidden');
    this._syncAll();
    bus.emit('settingsChanged');
    if (this.game._syncCursor) this.game._syncCursor(); // v3.31.0: restore cursor
  }

  close() {
    if (this.el.classList.contains('hidden')) return;
    this.el.classList.add('hidden');
    bus.emit('settingsChanged');
    if (this.game._syncCursor) this.game._syncCursor(); // v3.31.0: re-lock if mid-mission
  }

  // ─── KEYBIND GRID ───
  _buildKeybinds() {
    const wrap = byId('settings-keybinds');
    for (const a of ACTIONS) {
      const row = document.createElement('div');
      row.className = 'kb-row';
      row.dataset.action = a.id;
      row.innerHTML = `<span class="kb-label">${a.label}</span><span class="kb-chips"></span>`;
      wrap.appendChild(row);
    }
    this.refreshKeybinds();
  }

  refreshKeybinds() {
    for (const row of this.el.querySelectorAll('.kb-row')) {
      const action = row.dataset.action;
      const chips = row.querySelector('.kb-chips');
      chips.innerHTML = '';
      const codes = getBinds(action);
      codes.forEach((code, i) => {
        const chip = document.createElement('button');
        chip.className = 'kb-chip';
        chip.textContent = codeLabel(code);
        chip.title = 'Click to rebind (press any key or mouse button · ESC cancels)';
        chip.onclick = () => this._rebind(action, i, chip);
        chips.appendChild(chip);
      });
      if (!codes.length) {
        const chip = document.createElement('button');
        chip.className = 'kb-chip kb-empty';
        chip.textContent = '— UNBOUND —';
        chip.title = 'Click to bind a key or mouse button';
        chip.onclick = () => this._rebind(action, 0, chip);
        chips.appendChild(chip);
      }
    }
  }

  _rebind(action, slot, chip) {
    if (chip.classList.contains('capturing')) return;
    chip.classList.add('capturing');
    chip.textContent = 'PRESS KEY / CLICK MOUSE…';
    captureNextInput(
      (code) => {
        const prevOwner = actionForCode(code);
        setBind(action, code, slot);
        let msg = 'BIND: ' + ACTION_LABELS[action] + ' = ' + codeLabel(code);
        if (prevOwner) msg += '  (stolen from ' + ACTION_LABELS[prevOwner] + ')';
        bus.emit('banner', { text: msg, tone: 'good', duration: 1.4 });
        audio.tone(700, 0.06, 'square', 0.03);
        this.refreshKeybinds();
      },
      () => { this.refreshKeybinds(); }
    );
  }

  // ─── SLIDERS (each: input event → setSetting → label + live apply) ───
  _slider(id, key, fmt, apply) {
    const el = byId(id), val = byId(id + '-val');
    if (!el) return;
    el.addEventListener('input', () => {
      setSetting(key, parseFloat(el.value));
      if (val) val.textContent = fmt(SETTINGS[key]);
      if (apply) apply();
      // Clamp the tick pitch: large-value sliders (crosshairOffset 140–340)
      // would otherwise map to inaudible frequencies.
      audio.tone(340 + Math.min(SETTINGS[key], 3) * 300, 0.04, 'sine', 0.02);
    });
    this._syncers.push(() => {
      el.value = SETTINGS[key];
      if (val) val.textContent = fmt(SETTINGS[key]);
    });
  }

  _buildSliders() {
    const applyAudio = () => audio.setVolumes(SETTINGS.audioMaster, SETTINGS.audioSfx, SETTINGS.audioMusic);
    this._slider('set-spin-kb', 'spinSpeedKeyboard', x2);
    this._slider('set-spin-mouse', 'spinSpeedMouse', x2);
    this._slider('set-vol-master', 'audioMaster', pct, applyAudio);
    this._slider('set-vol-sfx', 'audioSfx', pct, applyAudio);
    this._slider('set-vol-music', 'audioMusic', pct, applyAudio);
    this._slider('set-density', 'particleDensity', pct);
  }

  _buildToggles() {
    const shake = byId('set-shake');
    if (shake) {
      shake.addEventListener('change', () => {
        setSetting('screenShake', shake.checked);
        if (this.game.msglog && this.game.state === 'playing') {
          this.game.msglog.log('SCREEN SHAKE: ' + (shake.checked ? 'ON' : 'OFF'), 'info', this.game.time);
        }
      });
      this._syncers.push(() => { shake.checked = !!SETTINGS.screenShake; });
    }
    // v3.48.0: crosshair (aim reticle) toggle — the reticle is drawn by
    // Crosshair.js in Game.render(); the live offset slider lives in the Dev panel.
    const crosshair = byId('set-crosshair');
    if (crosshair) {
      crosshair.addEventListener('change', () => {
        setSetting('crosshair', crosshair.checked);
        if (this.game.msglog && this.game.state === 'playing') {
          this.game.msglog.log('CROSSHAIR: ' + (crosshair.checked ? 'ON' : 'OFF'), 'info', this.game.time);
        }
      });
      this._syncers.push(() => { crosshair.checked = !!SETTINGS.crosshair; });
    }
  }

  // ─── v3.78.0: A/D CONTROL MODE (strafe / spin radio pair) ───
  // 'strafe' (default): A/D slide the ship sideways (PlayerFlight.js).
  // 'spin': classic keyboard rotation. Mouse spin works in both modes.
  _buildControlMode() {
    const strafe = byId('set-control-strafe');
    const spin = byId('set-control-spin');
    if (strafe) strafe.addEventListener('change', () => {
      if (strafe.checked) {
        setSetting('controlMode', 'strafe');
        if (this.game.msglog && this.game.state === 'playing') {
          this.game.msglog.log('A/D CONTROL: STRAFE', 'info', this.game.time);
        }
      }
    });
    if (spin) spin.addEventListener('change', () => {
      if (spin.checked) {
        setSetting('controlMode', 'spin');
        if (this.game.msglog && this.game.state === 'playing') {
          this.game.msglog.log('A/D CONTROL: SPIN', 'info', this.game.time);
        }
      }
    });
    this._syncers.push(() => {
      if (strafe) strafe.checked = SETTINGS.controlMode === 'strafe';
      if (spin) spin.checked = SETTINGS.controlMode === 'spin';
    });
  }

  // ─── v4.22.0: CROSSHAIR — style / color / size / length + live preview ───
  // The preview canvas is drawn with the SAME drawReticle() the in-game
  // reticle uses (Crosshair.js), so what you see here is what you get.
  _buildCrosshair() {
    const preview = byId('set-crosshair-preview');
    this._chPreview = preview;
    // Style chips (classic / brackets / diamond / dot)
    const styleWrap = byId('set-crosshair-styles');
    if (styleWrap) {
      for (const btn of styleWrap.querySelectorAll('[data-chstyle]')) {
        btn.addEventListener('click', () => {
          setSetting('crosshairStyle', btn.dataset.chstyle);
          this._syncCrosshairChips();
          this._drawCrosshairPreview();
          audio.uiBlip(520, 0.06);
        });
      }
    }
    // Color chips (red / green / yellow / blue / white)
    const colorWrap = byId('set-crosshair-colors');
    if (colorWrap) {
      for (const btn of colorWrap.querySelectorAll('[data-chcolor]')) {
        btn.addEventListener('click', () => {
          setSetting('crosshairColor', btn.dataset.chcolor);
          this._syncCrosshairChips();
          this._drawCrosshairPreview();
          audio.uiBlip(560, 0.06);
        });
      }
    }
    // v4.22.0: the module lists are the source of truth — drop any chip
    // whose value no longer exists in Crosshair.js, and fall back to the
    // factory default if a saved value is stale/invalid.
    for (const btn of styleWrap ? styleWrap.querySelectorAll('[data-chstyle]') : []) {
      if (!CROSSHAIR_STYLES.includes(btn.dataset.chstyle)) btn.remove();
    }
    for (const btn of colorWrap ? colorWrap.querySelectorAll('[data-chcolor]') : []) {
      if (!Object.prototype.hasOwnProperty.call(CROSSHAIR_COLORS, btn.dataset.chcolor)) btn.remove();
    }
    if (!CROSSHAIR_STYLES.includes(SETTINGS.crosshairStyle)) setSetting('crosshairStyle', 'classic');
    if (!Object.prototype.hasOwnProperty.call(CROSSHAIR_COLORS, SETTINGS.crosshairColor)) setSetting('crosshairColor', 'red');
    // Length + size + offset sliders (redraw the preview on every tick).
    // Offset is 140–340 px (dev-panel range) — pushes the reticle farther
    // out in front of the ship.
    const redraw = () => this._drawCrosshairPreview();
    this._slider('set-crosshair-length', 'crosshairLength', x2, redraw);
    this._slider('set-crosshair-size', 'crosshairSize', x2, redraw);
    this._slider('set-crosshair-offset', 'crosshairOffset', v => Math.round(v) + 'px', redraw);
    // Sync: chip highlight (sliders are handled by _slider syncers)
    this._syncers.push(() => {
      this._syncCrosshairChips();
      this._drawCrosshairPreview();
    });
  }

  /** Highlight the active style / color chips (SETTINGS is the source). */
  _syncCrosshairChips() {
    for (const btn of document.querySelectorAll('#set-crosshair-styles [data-chstyle]')) {
      btn.classList.toggle('active', btn.dataset.chstyle === SETTINGS.crosshairStyle);
    }
    for (const btn of document.querySelectorAll('#set-crosshair-colors [data-chcolor]')) {
      btn.classList.toggle('active', btn.dataset.chcolor === SETTINGS.crosshairColor);
    }
  }

  /** Draw the preview canvas — the exact in-game reticle at 2× scale,
   *  pushed out above a ship marker by the (scaled) OFFSET, so dragging
   *  the offset slider visibly moves the reticle away from the ship.
   *  The offset is drawn at 0.25× so the full 140–340 px range fits the
   *  150 px panel canvas (the reticle geometry itself stays 2×). */
  _drawCrosshairPreview() {
    const cv = this._chPreview;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    // Ship marker — a small nose-up triangle at the bottom center
    // (schematic stand-in for the player ship, the reticle's anchor).
    const shipY = cv.height - 12;
    ctx.save();
    ctx.translate(cv.width / 2, shipY);
    ctx.fillStyle = 'rgba(140, 170, 210, 0.9)';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Reticle — 2× the in-game scale, offset px out in front of the nose.
    ctx.save();
    ctx.translate(cv.width / 2, shipY - SETTINGS.crosshairOffset * 0.25);
    drawReticle(ctx, {
      style: SETTINGS.crosshairStyle,
      color: SETTINGS.crosshairColor,
      size: SETTINGS.crosshairSize * 2,
      length: SETTINGS.crosshairLength,
    });
    ctx.restore();
  }

  // ─── v4.22.0: CONTROLLER — gamepad toggle + connection status ───
  _buildGamepad() {
    const toggle = byId('set-gamepad');
    if (toggle) {
      toggle.addEventListener('change', () => {
        setSetting('gamepad', toggle.checked);
        if (this.game.msglog && this.game.state === 'playing') {
          this.game.msglog.log('CONTROLLER: ' + (toggle.checked ? 'ENABLED' : 'DISABLED'), 'info', this.game.time);
        }
        this._updateGamepadStatus();
      });
      this._syncers.push(() => {
        toggle.checked = !!SETTINGS.gamepad;
        this._updateGamepadStatus();
      });
    }
    // Live connect / disconnect (Gamepad.js emits on the bus)
    bus.on('gamepadConnected', () => this._updateGamepadStatus());
    bus.on('gamepadDisconnected', () => this._updateGamepadStatus());
  }

  /** Status line: which pad is connected (or none / disabled). */
  _updateGamepadStatus() {
    const status = byId('set-gamepad-status');
    if (!status) return;
    if (!SETTINGS.gamepad) {
      status.textContent = 'Controller support disabled';
      status.classList.remove('connected');
      return;
    }
    let name = null;
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      for (const gp of navigator.getGamepads()) {
        if (gp && gp.connected) { name = gp.id; break; }
      }
    }
    if (name) {
      status.textContent = `Connected — ${name}`;
      status.classList.add('connected');
    } else {
      status.textContent = 'No controller connected (plug in a pad — it hot-plugs)';
      status.classList.remove('connected');
    }
  }

  _syncAll() {
    for (const fn of this._syncers) fn();
    this.refreshKeybinds();
    audio.setVolumes(SETTINGS.audioMaster, SETTINGS.audioSfx, SETTINGS.audioMusic);
  }
}
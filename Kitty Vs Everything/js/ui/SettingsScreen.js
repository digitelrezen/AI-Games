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
export const VERSION = 'v3.48.0';
import { SETTINGS, setSetting, resetSettings } from './Settings.js';
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
      audio.tone(340 + SETTINGS[key] * 300, 0.04, 'sine', 0.02);
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

  _syncAll() {
    for (const fn of this._syncers) fn();
    this.refreshKeybinds();
    audio.setVolumes(SETTINGS.audioMaster, SETTINGS.audioSfx, SETTINGS.audioMusic);
  }
}
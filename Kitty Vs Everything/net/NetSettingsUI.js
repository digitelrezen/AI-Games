// Filename: net/NetSettingsUI.js
// Kitty Vs Everything — v3.20.0
// Multiplayer / LAN settings panel. Renders the "MULTIPLAYER (LAN)" section of
// the settings screen (SettingsScreen.js) and the in-game connection HUD.
// Provides: role selection, host IP + port, sync rate, Host / Join /
// Disconnect buttons, connection status, P1/P2 callsigns, and export/import
// of the .e6 profile + config files.
import netSettings from './NetSettings.js';
import playerProfile from './PlayerProfile.js';
import coopManager from './CoopManager.js';
import clientMirror from './ClientMirror.js';
import { bus } from '../js/core/EventBus.js';

class NetSettingsUI {
  constructor() {
    this.game = null;
    this._container = null;
    this._statusEl = null;
    this._hudEl = null;
    this._onNetStatus = (e) => this._updateStatus(e);
    bus.on('netStatus', this._onNetStatus);
  }

  /** Attach to the settings screen (called by SettingsScreen). */
  attach(game, container) {
    this.game = game;
    this._container = container;
    this._render();
  }

  _render() {
    if (!this._container) return;
    const p1 = playerProfile.get('p1');
    const p2 = playerProfile.get('p2');
    this._container.innerHTML = `
      <label>Mode <span id="net-role-val" class="settings-val">${netSettings.role.toUpperCase()}</span></label>
      <select id="net-role">
        <option value="solo" ${netSettings.role === 'solo' ? 'selected' : ''}>Solo</option>
        <option value="coop" ${netSettings.role === 'coop' ? 'selected' : ''}>Local Co-op</option>
        <option value="host" ${netSettings.role === 'host' ? 'selected' : ''}>Host (LAN)</option>
        <option value="client" ${netSettings.role === 'client' ? 'selected' : ''}>Join (LAN)</option>
      </select>
      <label>Host IP</label>
      <input type="text" id="net-hostip" value="${netSettings.hostIp}" placeholder="192.168.1.10" />
      <label>Port</label>
      <input type="number" id="net-port" value="${netSettings.port}" min="1024" max="65535" />
      <label>Sync rate <span id="net-syncrate-val" class="settings-val">${netSettings.syncRate} Hz</span></label>
      <input type="range" id="net-syncrate" min="5" max="60" step="1" value="${netSettings.syncRate}" />
      <label>P1 callsign</label>
      <input type="text" id="net-p1-callsign" value="${p1.callsign}" maxlength="16" />
      <label>P2 callsign</label>
      <input type="text" id="net-p2-callsign" value="${p2.callsign}" maxlength="16" />
      <div class="net-actions">
        <button id="net-host-btn">HOST GAME</button>
        <button id="net-join-btn">JOIN GAME</button>
        <button id="net-disconnect-btn">DISCONNECT</button>
      </div>
      <div class="net-status" id="net-status">Status: ${netSettings.role}</div>
      <div class="net-export">
        <button id="net-export-profiles">EXPORT PROFILES</button>
        <button id="net-export-config">EXPORT CONFIG</button>
        <button id="net-import-profiles">IMPORT PROFILES</button>
        <button id="net-import-config">IMPORT CONFIG</button>
      </div>
      <p class="settings-hint">Host: run <code>npm run lan</code> first, then HOST GAME. Join: enter the host's LAN IP and JOIN GAME.</p>
    `;
    this._statusEl = this._container.querySelector('#net-status');
    this._wire();
  }

  _wire() {
    const $ = (id) => this._container.querySelector('#' + id);
    $('net-role').addEventListener('change', (e) => {
      netSettings.setRole(e.target.value);
      $('net-role-val').textContent = e.target.value.toUpperCase();
    });
    $('net-hostip').addEventListener('change', (e) => netSettings.setHostIp(e.target.value));
    $('net-port').addEventListener('change', (e) => netSettings.setPort(e.target.value));
    $('net-syncrate').addEventListener('input', (e) => {
      netSettings.setSyncRate(e.target.value);
      $('net-syncrate-val').textContent = e.target.value + ' Hz';
    });
    $('net-p1-callsign').addEventListener('change', (e) => playerProfile.set('p1', { callsign: e.target.value }));
    $('net-p2-callsign').addEventListener('change', (e) => playerProfile.set('p2', { callsign: e.target.value }));
    $('net-host-btn').addEventListener('click', () => this._host());
    $('net-join-btn').addEventListener('click', () => this._join());
    $('net-disconnect-btn').addEventListener('click', () => this._disconnect());
    $('net-export-profiles').addEventListener('click', () => this._download(playerProfile.exportText(), 'profiles.e6'));
    $('net-export-config').addEventListener('click', () => this._download(netSettings.exportText(), 'multiplayer.config.e6'));
    $('net-import-profiles').addEventListener('click', () => this._importFile((text) => playerProfile.importText(text)));
    $('net-import-config').addEventListener('click', () => this._importFile((text) => netSettings.importText(text)));
  }

  _host() {
    netSettings.setRole('host');
    netSettings.setHosting(true);
    this._startCoop();
  }

  _join() {
    netSettings.setRole('client');
    this._startClient();
  }

  _startCoop() {
    if (!this.game) return;
    const p1Theme = playerProfile.get('p1').theme;
    const p2Theme = playerProfile.get('p2').theme;
    if (this.game.settings) this.game.settings.close();
    this.game.start(p1Theme, { coop: true, p2Theme });
  }

  _startClient() {
    if (!this.game) return;
    const p2Theme = playerProfile.get('p2').theme;
    if (this.game.settings) this.game.settings.close();
    this.game.start('yellow', { client: true, p2Theme });
  }

  _disconnect() {
    if (coopManager.active) coopManager.stop();
    if (clientMirror.active) clientMirror.stop();
    netSettings.setRole('solo');
    netSettings.setHosting(false);
    this._updateStatus({ status: 'disconnected' });
  }

  _download(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  _importFile(onText) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.e6';
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (onText(reader.result)) this._render();
      };
      reader.readAsText(file);
    });
    input.click();
  }

  _updateStatus(e) {
    const status = e.status || 'unknown';
    if (this._statusEl) this._statusEl.textContent = 'Status: ' + status;
    if (this._hudEl) {
      this._hudEl.textContent = status.toUpperCase();
      this._hudEl.className = 'net-hud net-hud-' + status;
    }
  }

  /** Show the in-game HUD indicator. */
  showHud(el) {
    this._hudEl = el;
  }

  destroy() {
    bus.off('netStatus', this._onNetStatus);
    this._container = null;
    this._statusEl = null;
    this._hudEl = null;
  }
}

export const netSettingsUI = new NetSettingsUI();
export default netSettingsUI;
// Filename: net/NetClient.js
// Kitty Vs Everything — v3.20.0
// Browser-side LAN client. Connects to the host's WebSocket server, sends the
// local P2 input stream, and receives authoritative state snapshots + events.
// Uses the NATIVE WebSocket API (zero dependencies) so it works both in dev
// (python http.server) and in the single-file esbuild bundle.
//
// The client is a "remote control + mirror": it does NOT simulate physics. It
// sends P2 input to the host and renders whatever the host broadcasts.
import NetProtocol from './NetProtocol.js';
import netSettings from './NetSettings.js';
import { bus } from '../js/core/EventBus.js';

const { MSG, pack, unpack, encodeInput } = NetProtocol;

class NetClient {
  constructor() {
    this.ws = null;
    this.status = 'disconnected'; // disconnected | connecting | connected | error
    this.error = '';
    this.seq = 0;
    this.lastState = null;
    this.hostInfo = null;
    // Callbacks (assign before connect):
    this.onState = null;   // (stateMsg) => void
    this.onEvent = null;   // (eventMsg) => void
    this.onWelcome = null; // (welcomeMsg) => void
    this.onInput = null;   // (inputMsg) => void   (host side: remote P2 input)
    this.onHello = null;   // (helloMsg) => void   (host side: client joining)
    this.onOpen = null;    // () => void
    this.onClose = null;   // (reason) => void
  }

  get url() {
    const host = netSettings.hostIp || this._host || '127.0.0.1';
    const port = netSettings.port || this._port || 8765;
    return `ws://${host}:${port}`;
  }

  connect(host, port, role) {
    this._host = host || this._host;
    this._port = port || this._port;
    this._role = role || this._role || 'client';
    this.close();
    this.status = 'connecting';
    this.error = '';
    bus.emit('netStatus', { status: 'connecting', url: this.url });
    let ws;
    try { ws = new WebSocket(this.url); } catch (e) {
      this.status = 'error'; this.error = String(e);
      bus.emit('netStatus', { status: 'error', error: this.error });
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.status = 'connected';
      bus.emit('netStatus', { status: 'connected', url: this.url });
      this.send({ type: MSG.HELLO, role: this._role, profile: this._profile || { theme: 'orange', callsign: 'PILOT-2' } });
      if (this.onOpen) this.onOpen();
    };
    ws.onmessage = (ev) => this._onMessage(ev);
    ws.onclose = (ev) => {
      const was = this.status;
      this.status = 'disconnected';
      bus.emit('netStatus', { status: 'disconnected', url: this.url });
      if (this.onClose) this.onClose(ev.reason || 'closed');
      if (was === 'connected') bus.emit('netDropped', {});
    };
    ws.onerror = () => {
      if (this.status !== 'connected') {
        this.status = 'error';
        this.error = 'connection failed';
        bus.emit('netStatus', { status: 'error', error: this.error });
      }
    };
  }

  setProfile(profile) { this._profile = profile; }

  send(msg) {
    if (this.ws && this.ws.readyState === 1) {
      try { this.ws.send(pack(msg)); } catch (e) { /* ignore */ }
    }
  }

  /** Send a P2 input snapshot (call ~20-30Hz while connected). */
  sendInput(input) {
    if (this.status !== 'connected') return;
    this.seq++;
    this.send(encodeInput(input, this.seq));
  }

  _onMessage(ev) {
    const msg = unpack(typeof ev.data === 'string' ? ev.data : '');
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case MSG.HELLO:
        if (this.onHello) this.onHello(msg);
        break;
      case MSG.WELCOME:
        this.hostInfo = msg.host || null;
        if (this.onWelcome) this.onWelcome(msg);
        break;
      case MSG.STATE:
        this.lastState = msg;
        if (this.onState) this.onState(msg);
        break;
      case MSG.EVENT:
        if (this.onEvent) this.onEvent(msg);
        break;
      case MSG.INPUT:
        if (this.onInput) this.onInput(msg);
        break;
      case MSG.BYE:
        // v3.20.0: the peer left — update status + notify so the HUD flips to DISCONNECTED.
        this.status = 'disconnected';
        bus.emit('netStatus', { status: 'disconnected', url: this.url });
        if (this.onClose) this.onClose(msg.reason || 'host closed');
        break;
    }
  }

  close() {
    if (this.ws) {
      try { this.ws.onopen = this.ws.onmessage = this.ws.onclose = this.ws.onerror = null; } catch (e) { /* ignore */ }
      try { this.ws.close(); } catch (e) { /* ignore */ }
      this.ws = null;
    }
    this.status = 'disconnected';
  }
}

export const netClient = new NetClient();
export default netClient;

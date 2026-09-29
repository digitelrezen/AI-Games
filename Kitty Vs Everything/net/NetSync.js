// Filename: net/NetSync.js
// Kitty Vs Everything — v3.20.0
// HOST-side LAN state sync. The host browser is authoritative: it connects to
// the local relay server (net/server.mjs) as role 'host', receives the remote
// P2's input stream, and broadcasts compact state snapshots (E6 record rows)
// back out to the client at the configured sync rate.
//
// Responsibilities:
//   * connect the host to the local relay (127.0.0.1:<port>)
//   * capture remote P2 input (this.remoteInput) for the CoopManager to apply
//   * broadcast `state` snapshots at netSettings.syncRate Hz
//   * report connection status (bus 'netStatus')
import netClient from './NetClient.js';
import netSettings from './NetSettings.js';
import NetProtocol from './NetProtocol.js';
import { bus } from '../js/core/EventBus.js';

class NetSync {
  constructor() {
    this.client = netClient;
    this.game = null;
    this.remoteInput = null;      // last `input` msg from the remote P2
    this.clientConnected = false; // a remote client is attached
    this._seq = 0;
    this._accum = 0;
    this._lastInputAt = -1;
  }

  get active() { return !!this.game; }

  /** Start hosting: connect to the local relay as 'host'. */
  start(game, hostProfile) {
    this.game = game;
    this._hostProfile = hostProfile || { theme: 'yellow', callsign: 'PILOT-1' };
    this.client.setProfile(this._hostProfile);
    this.client.onInput = (msg) => {
      this.remoteInput = msg;
      this._lastInputAt = game.time;
    };
    this.client.onWelcome = () => { this.clientConnected = true; };
    this.client.onOpen = () => { this.clientConnected = true; };
    this.client.onClose = () => { this.clientConnected = false; this.remoteInput = null; };
    // A remote client is joining: acknowledge with a welcome (host-authoritative).
    this.client.onHello = () => {
      this.clientConnected = true;
      this.client.send({
        type: NetProtocol.MSG.WELCOME,
        yourId: 'p2',
        host: { theme: this._hostProfile.theme, callsign: this._hostProfile.callsign },
        config: { syncRate: netSettings.syncRate },
      });
    };
    // The host always talks to its OWN local relay server.
    this.client.connect('127.0.0.1', netSettings.port, 'host');
  }

  /** Per-frame tick: broadcast a state snapshot at the sync rate. */
  update(dt) {
    if (!this.game) return;
    this._accum += dt;
    const interval = 1 / Math.max(5, netSettings.syncRate);
    if (this._accum >= interval && this.client.status === 'connected') {
      this._accum = 0;
      this._seq++;
      this.client.send(NetProtocol.encodeState(this.game, this._seq));
    }
  }

  /** True if the remote P2 has sent input recently (within `maxAge` seconds). */
  inputFresh(maxAge = 2) {
    return this.remoteInput && (this.game ? (this.game.time - this._lastInputAt) < maxAge : true);
  }

  stop() {
    this.client.close();
    this.game = null;
    this.remoteInput = null;
    this.clientConnected = false;
    this._seq = 0;
    this._accum = 0;
  }
}

export const netSync = new NetSync();
export default netSync;

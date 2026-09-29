/**
 * Local LAN multiplayer hooks (up to 6 players).
 *
 * Plan (architecture.md §10):
 *  - Host-authoritative relay over WebSocket (no dedicated server).
 *  - Host runs the simulation; clients send inputs, receive state snapshots.
 *  - Entity interpolation + prediction on the client side.
 *
 * Step 1: scaffold only — status tracking + API surface. The actual
 * WebSocket relay lands in step 4.
 */
export type LanStatus = 'disconnected' | 'connecting' | 'hosting' | 'joined';

export interface LanPeer {
  id: string;
  name: string;
}

export class LanHooks {
  readonly maxPlayers = 6;
  private _status: LanStatus = 'disconnected';
  private peers: LanPeer[] = [];
  private statusHandler?: (status: LanStatus) => void;

  get status(): LanStatus {
    return this._status;
  }

  getPeers(): LanPeer[] {
    return [...this.peers];
  }

  onStatusChanged(handler: (status: LanStatus) => void): void {
    this.statusHandler = handler;
  }

  private setStatus(status: LanStatus): void {
    this._status = status;
    this.statusHandler?.(status);
  }

  /** Host a LAN session (scaffold). */
  host(_port = 8901): void {
    console.info('[LAN] host() scaffold — WebSocket relay not implemented yet (step 4).');
  }

  /** Join a LAN session (scaffold). */
  join(_url: string): void {
    console.info('[LAN] join() scaffold — WebSocket relay not implemented yet (step 4).');
  }

  disconnect(): void {
    this.peers = [];
    this.setStatus('disconnected');
  }
}

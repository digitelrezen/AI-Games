// Filename: net/CoopManager.js
// Kitty Vs Everything — v3.47.0
// LAN co-op orchestration (host + local co-op). Spawns the second Cat Ship
// (P2) via the existing CatShipFactory and drives it from either the local P2
// keyboard (Player2Controls.js) or the remote P2's input stream
// (NetSync.remoteInput). P2 auto-aims at the nearest enemy (no mouse, no
// manual rotation). Tracks per-player score/lives and handles the co-op
// game-over (both ships dead).
//
// Modes:
//   'local'  — P2 is driven by the local keyboard (Player2Controls).
//   'remote' — P2 is driven by the remote client's input (host-authoritative).
import { createCatShip } from '../js/core/CatShipFactory.js';
import { PLAYER2 } from '../js/core/config.js';
import netSettings from './NetSettings.js';
import netSync from './NetSync.js';
import p2Controls from './Player2Controls.js';
import playerProfile from './PlayerProfile.js';
import { bus } from '../js/core/EventBus.js';
import { TAU } from '../js/core/utils.js';

// Idle input source (no keys held, no mouse) — used when the remote P2 has
// not sent input yet.
const IDLE_INPUT = {
  isDownAction: () => false,
  wasPressedAction: () => false,
  mouseIdleTime: () => Infinity,
  mouse: { moveX: 0 },
};

class CoopManager {
  constructor() {
    this.game = null;
    this.p2 = null;
    this.active = false;
    this.mode = 'local'; // 'local' | 'remote'
    this._lastSeq = -1;
    this._edge = {};
  }

  get p1() { return this.game ? this.game.player : null; }

  /**
   * Start co-op.
   * @param {Game} game
   * @param {string} p1Theme
   * @param {string} p2Theme
   */
  start(game, p1Theme, p2Theme) {
    this.game = game;
    this.active = true;
    this.mode = (netSettings.role === 'host') ? 'remote' : 'local';
    this._lastSeq = -1;
    this._edge = {};

    const p1 = game.player;
    p1.netId = 'p1';
    p1.score = 0;
    p1.nextLifeAt = game.nextLifeAt;
    p1.callsign = playerProfile.get('p1').callsign; // v3.20.0: HUD callsign

    // Spawn P2 with a lateral offset so the ships don't overlap.
    const p2 = createCatShip(p2Theme, game);
    p2.netId = 'p2';
    p2.score = 0;
    p2.nextLifeAt = game.nextLifeAt;
    p2.callsign = playerProfile.get('p2').callsign; // v3.20.0: HUD callsign
    p2.hp = PLAYER2.hp; p2.maxHp = PLAYER2.hp;       // v3.20.0: P2 scaling
    p2.shield = PLAYER2.shield; p2.maxShield = PLAYER2.shield;
    p2.lives = PLAYER2.lives;
    p2.x = game.viewW / 2 + PLAYER2.spawnOffsetX;
    p2.y = game.viewH - 90;
    p2.angle = -Math.PI / 2;
    p2.vx = 0; p2.vy = 0;
    this.p2 = p2;

    game.players = [p1, p2];
    game.player2 = p2; // v3.20.0: HUD + Collisions read game.player2 directly

    if (this.mode === 'local') {
      p2Controls.setEnabled(true);
    } else {
      p2Controls.setEnabled(false);
      // Host: connect to the local relay and wait for the remote P2.
      netSync.start(game, { theme: p1Theme, callsign: playerProfile.get('p1').callsign });
    }

    bus.emit('banner', {
      text: this.mode === 'remote' ? 'LAN CO-OP — HOSTING' : 'CO-OP STARTED',
      tone: 'good', duration: 2,
    });
    bus.emit('coopStart', { mode: this.mode });
  }

  /** Per-frame tick (host + local co-op). */
  update(dt) {
    if (!this.active || !this.p2 || this.p2.dead) return;
    const input = this._inputSource();
    this._autoAim(this.p2, dt);
    this.p2.update(dt, input);
    if (this.mode === 'remote') netSync.update(dt); // broadcast state
  }

  /** Render P2 (host + local co-op). */
  render(ctx) {
    if (this.active && this.p2 && !this.p2.dead) this.p2.draw(ctx);
  }

  /** Co-op game-over: only when BOTH ships are dead. */
  onPlayerDied(player) {
    const anyAlive = this.game.players.some(p => !p.dead);
    if (anyAlive) {
      bus.emit('banner', { text: 'CO-OP CONTINUES', tone: 'warn', duration: 1.5 });
    } else {
      this.game.gameOver();
    }
  }

  /** Stop co-op (disconnect / leave). */
  stop() {
    if (this.mode === 'remote') netSync.stop();
    p2Controls.setEnabled(false);
    this.active = false;
    this.p2 = null;
    this._lastSeq = -1;
    this._edge = {};
    if (this.game) {
      this.game.players = [this.game.player];
      this.game.player2 = null; // v3.20.0: clear the P2 reference
    }
  }

  /** Resolve the P2 input source (local keyboard or remote stream). */
  _inputSource() {
    if (this.mode === 'remote') {
      const ri = netSync.remoteInput;
      if (!ri) return IDLE_INPUT;
      // Pre-compute edge-triggered actions for this seq (fire once per new seq).
      if (this._lastSeq !== ri.seq) {
        this._lastSeq = ri.seq;
        this._edge = {
          stun: !!ri.stun,
          napalm: !!ri.napalm,
          ultimate: !!ri.ultimate,
          cycleWeapon: !!ri.cycleWeapon,
          deployFleet: !!ri.deployFleet,
          synergy: !!ri.synergy, // v3.47.0: P2 Synergy Explosion
        };
      }
      const edge = this._edge;
      return {
        isDownAction: (name) => {
          switch (name) {
            case 'thrust': return !!ri.thrust;
            case 'brake': return !!ri.brake;
            case 'boost': return !!ri.boost;
            case 'fire': return !!ri.fire;
            default: return false;
          }
        },
        wasPressedAction: (name) => !!edge[name],
        mouseIdleTime: () => Infinity,
        mouse: { moveX: 0 },
      };
    }
    return p2Controls;
  }

  /** P2 auto-aim: smoothly turn toward the nearest enemy. */
  _autoAim(p, dt) {
    let best = null, bestD = Infinity;
    for (const e of this.game.enemies) {
      if (!e.alive) continue;
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) return;
    const target = Math.atan2(best.y - p.y, best.x - p.x);
    let diff = target - p.angle;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    const maxTurn = PLAYER2.autoAimTurnRate * dt;
    p.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
  }
}

export const coopManager = new CoopManager();
export default coopManager;

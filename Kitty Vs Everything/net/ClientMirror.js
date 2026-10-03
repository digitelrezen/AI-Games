// Filename: net/ClientMirror.js
// Kitty Vs Everything — v3.20.0
// CLIENT-side LAN mirror. The client browser does NOT simulate physics. It
// sends the local P2 input stream to the host and renders whatever the host
// broadcasts (authoritative state snapshots + events). This module:
//   * captures P2 input (Player2Controls.js) and sends it to the host
//   * maintains mirror Player/Enemy instances from the host's state
//   * renders the mirror world (both ships, enemies, boss, particles)
import netClient from './NetClient.js';
import netSettings from './NetSettings.js';
import p2Controls from './Player2Controls.js';
import playerProfile from './PlayerProfile.js';
import NetProtocol from './NetProtocol.js';
import { createCatShip } from '../js/combat/CatShipFactory.js'; // v3.71.0: modular combat
import { createEnemy } from '../js/enemies/EnemyFactory.js';
import { bus } from '../js/core/EventBus.js';

const IDLE_INPUT = {
  isDownAction: () => false,
  wasPressedAction: () => false,
  mouseIdleTime: () => Infinity,
  mouse: { moveX: 0 },
};

class ClientMirror {
  constructor() {
    this.game = null;
    this.active = false;
    this.mirrorP1 = null;
    this.mirrorP2 = null;
    this.mirrorEnemies = new Map(); // netId -> mirror enemy
    this.mirrorBoss = null;
    this._lastSeq = -1;
  }

  /** Start the client mirror (join a host). */
  start(game, p2Theme) {
    this.game = game;
    this.active = true;
    // v3.20.0: create a local placeholder for P2 so the HUD can update it.
    // (game.player is already created by Game.start() as the P1 placeholder.)
    if (!game.player2) {
      game.player2 = createCatShip(p2Theme, game);
      game.player2.netId = 'p2';
      game.player2.callsign = playerProfile.get('p2').callsign;
      game.player2.score = 0;
      game.player2.lives = 0;
    }
    p2Controls.setEnabled(true);
    netClient.setProfile({ theme: p2Theme, callsign: playerProfile.get('p2').callsign });
    netClient.onState = (msg) => this._onState(msg);
    netClient.onEvent = (msg) => this._onEvent(msg);
    netClient.onWelcome = () => {
      bus.emit('banner', { text: 'CONNECTED TO HOST', tone: 'good', duration: 2 });
    };
    netClient.onClose = (reason) => {
      bus.emit('banner', { text: 'DISCONNECTED: ' + reason, tone: 'bad', duration: 2 });
      this.stop();
    };
    const host = netSettings.hostIp || '127.0.0.1';
    const port = netSettings.port || 8765;
    netClient.connect(host, port, 'client');
  }

  /** Per-frame tick: send P2 input to the host. */
  update(dt) {
    if (!this.active) return;
    netClient.sendInput(p2Controls);
  }

  /** Render the mirror world. */
  render(ctx) {
    if (!this.active) return;
    if (this.mirrorP1 && !this.mirrorP1.dead) this.mirrorP1.draw(ctx);
    if (this.mirrorP2 && !this.mirrorP2.dead) this.mirrorP2.draw(ctx);
    for (const e of this.mirrorEnemies.values()) e.draw(ctx);
    if (this.mirrorBoss) this.mirrorBoss.draw(ctx);
  }

  /** Apply a host state snapshot to the mirror. */
  _onState(msg) {
    if (msg.seq === this._lastSeq) return;
    this._lastSeq = msg.seq;
    const players = NetProtocol.decodePlayers(msg.players);
    for (const rec of players) {
      if (rec.id === 'p1') this._applyPlayer(this.mirrorP1, rec, 'p1');
      else if (rec.id === 'p2') this._applyPlayer(this.mirrorP2, rec, 'p2');
    }
    this._applyEnemies(msg.enemies);
    this._applyBoss(msg.boss);
  }

  _applyPlayer(mirror, rec, id) {
    if (!mirror) {
      const theme = rec.theme || (id === 'p1' ? 'yellow' : 'orange');
      mirror = createCatShip(theme, this.game);
      mirror.netId = id;
      if (id === 'p1') this.mirrorP1 = mirror; else this.mirrorP2 = mirror;
    }
    mirror.x = Number(rec.x);
    mirror.y = Number(rec.y);
    mirror.angle = Number(rec.angle);
    mirror.hp = Number(rec.hp);
    mirror.shield = Number(rec.shield);
    mirror.weapon = rec.weapon;
    mirror.alive = Number(rec.alive) === 1;
    mirror.dead = !mirror.alive;
    if (rec.theme && rec.theme !== mirror.theme) mirror.theme = rec.theme;
    // Keep the mirror ship looking alive (thruster + tail animation).
    mirror.animTime = this.game.time;
    mirror.engineFlicker = (this.game.time * 12) % 10;
    mirror.thrusterActive = true;
    // v3.20.0: also update the local placeholder so the HUD shows live values.
    const local = (id === 'p1') ? this.game.player : this.game.player2;
    if (local) {
      local.x = Number(rec.x);
      local.y = Number(rec.y);
      local.angle = Number(rec.angle);
      local.hp = Number(rec.hp);
      local.shield = Number(rec.shield);
      local.score = Number(rec.score) || 0;
      local.lives = Number(rec.lives) || 0;
      local.alive = Number(rec.alive) === 1;
      local.dead = !local.alive;
    }
  }

  _applyEnemies(text) {
    const recs = NetProtocol.decodeEnemies(text);
    const seen = new Set();
    for (const rec of recs) {
      const id = String(rec.id);
      seen.add(id);
      let e = this.mirrorEnemies.get(id);
      if (!e) {
        try {
          e = createEnemy({ type: rec.type || 'wasp', tier: 'mob', x: Number(rec.x), y: Number(rec.y), game: this.game });
        } catch (err) { e = null; }
        if (e) { e.netId = id; this.mirrorEnemies.set(id, e); }
      }
      if (e) {
        e.x = Number(rec.x);
        e.y = Number(rec.y);
        e.hp = Number(rec.hp);
        e.angle = Number(rec.angle);
        e.alive = true;
      }
    }
    for (const [id, e] of this.mirrorEnemies) {
      if (!seen.has(id)) { e.alive = false; this.mirrorEnemies.delete(id); }
    }
  }

  _applyBoss(text) {
    const rec = NetProtocol.decodeBoss(text);
    if (!rec || Number(rec.active) !== 1) { this.mirrorBoss = null; return; }
    if (!this.mirrorBoss) {
      try {
        this.mirrorBoss = createEnemy({ type: 'pinkcat', tier: 'boss', x: Number(rec.x), y: Number(rec.y), game: this.game });
      } catch (err) { this.mirrorBoss = null; }
    }
    if (this.mirrorBoss) {
      this.mirrorBoss.x = Number(rec.x);
      this.mirrorBoss.y = Number(rec.y);
      this.mirrorBoss.hp = Number(rec.hp);
      this.mirrorBoss.maxHp = Number(rec.maxHp);
      this.mirrorBoss.phase = Number(rec.phase);
    }
  }

  _onEvent(msg) {
    switch (msg.kind) {
      case 'explosion':
        this.game.particles.burst(msg.x, msg.y, { count: 16, color: msg.color || '#fff', speed: 220, life: 0.7 });
        break;
      case 'banner':
        bus.emit('banner', { text: msg.text, tone: msg.tone || 'info', duration: msg.duration || 1.5 });
        break;
      case 'powerup':
        break;
    }
  }

  stop() {
    p2Controls.setEnabled(false);
    netClient.close();
    this.active = false;
    this.mirrorP1 = null;
    this.mirrorP2 = null;
    this.mirrorEnemies.clear();
    this.mirrorBoss = null;
    this._lastSeq = -1;
  }
}

export const clientMirror = new ClientMirror();
export default clientMirror;
// Filename: EridathsMomsHouse.js
// Kitty Vs Everything — v1.0.0
// v4.24.0: Eridath's Mom's House — the Boneyard bonus stage's scripted
//          centerpiece, driven by js/levels/BoneYardBonus.js (Phase 3/4).
//          It is a STAGE SUB-MODULE, not a registered BONUS_STAGES entry
//          (LevelRegistry stays boneyard/internet only — [6z]).
//
//          Lifecycle:
//            constructor — spawn at the top of the view, start descent
//            update(dt)  — descend to settleY over descentTime (ease-out),
//                          then dump humans + skeletons (maxDumps
//                          concurrent) until the teleport
//            applyDamage — player damage is CAPPED at hp * damageCapFrac
//                          (1/16): the house is a set piece, not a boss
//            startTeleport() — blink + shrink out over teleportTime
//            state 'exiting' — teleport finished; the stage's onExit
//            callback fires and the encounter completes
//
//          It lives OUTSIDE game.enemies on purpose: the stage owns its
//          bullet collision (BoneYardBonus._houseBulletHits) so the house
//          never enters the enemy ram loop, the enemy-death pipeline, or
//          the wave-clear bookkeeping.
export const VERSION = 'v1.0.0';
import { createEnemy } from '../enemies/EnemyFactory.js';
import { BONUS } from '../core/config.js';
import { TAU, rand } from '../core/utils.js';

export default class EridathsMomsHouse {
  constructor(game, opts = {}) {
    this.game = game;
    this.onExit = opts.onExit || null;
    const cfg = BONUS.BONE_YARD_HOUSE;
    this.cfg = cfg;
    this.maxHp = cfg.hp;
    this.cap = this.maxHp * cfg.damageCapFrac; // 1/16 damage cap
    this.size = cfg.size;
    this.radius = cfg.size * 0.5; // bullet hit radius (stage-owned collision)
    this.x = game.viewW / 2;
    this.y = -this.size; // top of the view (off-screen)
    this.settleY = cfg.settleY * game.viewH;
    this.state = 'descending'; // descending → settled → teleporting → exiting
    this.descentT = 0;
    this.damaged = 0;
    this.flash = 0;
    this.dumped = []; // house-dumped enemies (the stage reaps them)
    this.humanTimer = rand(cfg.dumpHuman[0], cfg.dumpHuman[1]);
    this.skeletonTimer = rand(cfg.dumpSkeleton[0], cfg.dumpSkeleton[1]);
    this.teleportT = 0;
  }

  get hp() { return this.maxHp - this.damaged; }
  get capReached() { return this.damaged >= this.cap; }
  get settled() {
    return this.state === 'settled' || this.state === 'teleporting' || this.state === 'exiting';
  }

  update(dt) {
    if (this.state === 'exiting') return;
    if (this.flash > 0) this.flash -= dt;

    if (this.state === 'descending') {
      this.descentT += dt;
      const k = Math.min(1, this.descentT / this.cfg.descentTime);
      // Ease-out descent: a fast drop that settles gently.
      const ease = 1 - (1 - k) * (1 - k);
      this.y = -this.size + (this.settleY + this.size) * ease;
      if (k >= 1) {
        this.y = this.settleY;
        this.state = 'settled';
      }
      return;
    }

    if (this.state === 'teleporting') {
      this.teleportT += dt;
      if (this.teleportT >= this.cfg.teleportTime) {
        this.state = 'exiting';
        if (this.onExit) this.onExit();
      }
      return;
    }

    // settled: dump humans + skeletons (maxDumps concurrent).
    this._dump(dt);
  }

  _dump(dt) {
    const alive = this.dumped.filter((e) => e.alive).length;
    this.humanTimer -= dt;
    if (this.humanTimer <= 0) {
      this.humanTimer = rand(this.cfg.dumpHuman[0], this.cfg.dumpHuman[1]);
      if (alive < this.cfg.maxDumps) this._dumpOne('human');
    }
    this.skeletonTimer -= dt;
    if (this.skeletonTimer <= 0) {
      this.skeletonTimer = rand(this.cfg.dumpSkeleton[0], this.cfg.dumpSkeleton[1]);
      if (alive < this.cfg.maxDumps) this._dumpOne('skeleton');
    }
  }

  _dumpOne(type) {
    const e = createEnemy({
      type, tier: 'mob',
      x: this.x + rand(-this.size * 0.35, this.size * 0.35),
      y: this.y + this.size * 0.45,
      game: this.game,
    });
    if (type === 'human') e.marchMode = true; // dumped humans march down at the player
    this.dumped.push(e);
    this.game.enemies.push(e);
  }

  /** Player damage, capped at hp * damageCapFrac (1/16). */
  applyDamage(dmg) {
    if (this.state === 'teleporting' || this.state === 'exiting') return;
    this.damaged = Math.min(this.cap, this.damaged + (dmg || 0));
    this.flash = 0.15;
  }

  startTeleport() {
    if (this.state === 'teleporting' || this.state === 'exiting') return;
    this.state = 'teleporting';
    this.teleportT = 0;
  }

  /** Stage cleanup: reap the house's spawns from the live enemy list. */
  clearDumps() {
    if (!this.dumped.length) return;
    const doomed = new Set(this.dumped);
    this.game.enemies = this.game.enemies.filter((e) => !doomed.has(e));
    this.dumped = [];
  }

  draw(ctx) {
    const s = this.size;
    ctx.save();
    ctx.translate(this.x, this.y);
    // Teleport: flicker + shrink out.
    if (this.state === 'teleporting') {
      const k = this.teleportT / this.cfg.teleportTime;
      ctx.globalAlpha = (0.25 + 0.75 * Math.abs(Math.sin(this.teleportT * 14))) * (1 - k * 0.8);
      const sc = 1 - 0.35 * k;
      ctx.scale(sc, sc);
    }
    // ─── WALLS ───
    const wallW = s;
    const wallH = s * 0.6;
    const wallTop = -s * 0.08;
    const wallGrad = ctx.createLinearGradient(0, wallTop, 0, wallTop + wallH);
    wallGrad.addColorStop(0, '#d8b078');
    wallGrad.addColorStop(1, '#b08a52');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(-wallW / 2, wallTop, wallW, wallH);
    ctx.strokeStyle = 'rgba(60, 40, 20, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-wallW / 2, wallTop, wallW, wallH);
    // ─── ROOF ───
    ctx.fillStyle = '#8a3b2a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.58, wallTop);
    ctx.lineTo(0, -s * 0.55);
    ctx.lineTo(s * 0.58, wallTop);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 15, 10, 0.7)';
    ctx.stroke();
    // ─── CHIMNEY ───
    ctx.fillStyle = '#6e4a30';
    ctx.fillRect(s * 0.22, -s * 0.46, s * 0.12, s * 0.2);
    // ─── DOOR ───
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(-s * 0.09, s * 0.18, s * 0.18, s * 0.34);
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath();
    ctx.arc(s * 0.04, s * 0.36, s * 0.015, 0, TAU);
    ctx.fill();
    // ─── WINDOWS (warm light) ───
    for (const wx of [-s * 0.3, s * 0.3]) {
      ctx.fillStyle = '#ffd54f';
      ctx.fillRect(wx - s * 0.09, s * 0.02, s * 0.18, s * 0.16);
      ctx.strokeStyle = 'rgba(60, 40, 20, 0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(wx - s * 0.09, s * 0.02, s * 0.18, s * 0.16);
      ctx.beginPath();
      ctx.moveTo(wx, s * 0.02);
      ctx.lineTo(wx, s * 0.18);
      ctx.moveTo(wx - s * 0.09, s * 0.1);
      ctx.lineTo(wx + s * 0.09, s * 0.1);
      ctx.stroke();
    }
    // ─── HIT FLASH ───
    if (this.flash > 0) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-s * 0.58, -s * 0.55, s * 1.16, s * 1.07);
    }
    ctx.restore();
  }
}

// Filename: SectorCombatManager.js
// Kitty Vs Everything — v3.99.0
// SEARCH & DESTROY — combat & roster parity + the target base.
//
// ROSTER PARITY: the SAR mode reuses the ENTIRE classic combat stack —
// all 9 Catships (CatShipFactory), the Vulcan/Plasma/Rail weapons, the
// stun/napalm rockets, the per-ship ultimates, the shared POWERUP_DROPS
// pool and the DropManager. Nothing is re-implemented here. This module
// owns the SAR-specific combat:
//   • the target base — Eridath's Mom's House: a world-anchored,
//     shootable, PERSISTENT enemy-spawning base in the deep sector
//     (asset `eridath_moms_house`; art renders through SectorMap)
//   • friendly-bullet → house collision (the house is a SAR entity, not
//     a game.enemies member, so it gets its own collision pass — the
//     classic Collisions.js is untouched)
//   • the base's spawn volleys (the "persistent enemy-spawning base")
//   • the victory sequence (house destroyed → mission accomplished)
export const VERSION = 'v1.0.0';
import { SAR } from '../../core/config.js';
import { rand, randInt, clamp, dist2, isOnScreen } from '../../core/utils.js';
import { bus } from '../../core/EventBus.js';
import { audio } from '../../core/AudioSystem.js';
import { createEnemy } from '../../enemies/EnemyFactory.js';
import { spawnGuaranteedDrop } from '../../core/DropManager.js';

// The base's volley roster (deep-sector heavy units — a subset of the
// full 19-species roster, all spawned through the shared EnemyFactory).
const BASE_VOLLEY_TYPES = ['wolf', 'falcon', 'dragon', 'blackcat', 'pinkcat', 'shuttle'];

export default class SectorCombatManager {
  constructor(game, map) {
    this.game = game;
    this.map = map;
    this.house = null;
    this.victoryTimer = -1;
    this.victoryShown = false;
    this.spawnTimer = rand(SAR.HOUSE.spawnMin, SAR.HOUSE.spawnMax);
  }

  /** Fresh target base per mission. */
  reset() {
    this.house = {
      x: SAR.HOUSE.x, y: SAR.HOUSE.y,
      hp: SAR.HOUSE.HP, maxHp: SAR.HOUSE.HP,
      radius: SAR.HOUSE.radius,
      alive: true, flash: 0, t: 0,
    };
    this.victoryTimer = -1;
    this.victoryShown = false;
    this.spawnTimer = rand(SAR.HOUSE.spawnMin, SAR.HOUSE.spawnMax);
  }

  /** The house's live screen position (world → screen through the camera). */
  houseScreen() {
    return this.map.worldToScreen(this.house.x, this.house.y);
  }

  /** Per-frame driver (SearchAndDestroy.update). */
  update(dt) {
    const g = this.game;
    if (!this.house) return;
    const h = this.house;
    h.t += dt;
    h.flash = Math.max(0, h.flash - dt);
    if (!h.alive) {
      this._victoryTick(dt);
      return;
    }
    // ─── BASE SPAWNER: the house is a persistent enemy-spawning base ───
    const pw = this.map.playerWorld();
    const d = Math.hypot(pw.x - h.x, pw.y - h.y);
    if (d < SAR.HOUSE.spawnRange) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = rand(SAR.HOUSE.spawnMin, SAR.HOUSE.spawnMax);
        this._baseVolley();
      }
    }
    // ─── FRIENDLY BULLETS → HOUSE (own collision pass) ───
    const hs = this.houseScreen();
    if (isOnScreen(g, hs.x, hs.y, h.radius)) {
      for (const b of g.bullets) {
        if (!b.alive || !b.friendly) continue;
        const rr = b.radius + h.radius;
        if (dist2(b.x, b.y, hs.x, hs.y) < rr * rr) {
          b.alive = false;
          h.flash = 0.15;
          h.hp -= b.damage;
          g.particles.burst(b.x, b.y, { count: 6, color: '#ffb8e2', speed: 120, life: 0.3 });
          if (h.hp <= 0 && h.alive) {
            h.hp = 0;
            h.alive = false;
            this._onHouseDestroyed(hs);
          }
          break;
        }
      }
    }
  }

  /** One base volley — a screen-space burst of deep-sector heavies. */
  _baseVolley() {
    const g = this.game;
    const hs = this.houseScreen();
    const n = randInt(SAR.HOUSE.volleyMin, SAR.HOUSE.volleyMax);
    for (let i = 0; i < n; i++) {
      const type = BASE_VOLLEY_TYPES[i % BASE_VOLLEY_TYPES.length];
      const tier = i === 0 ? 'miniboss' : (Math.random() < 0.3 ? 'champion' : 'mob');
      g.enemies.push(createEnemy({
        type, tier,
        x: clamp(hs.x + rand(-80, 80), 60, g.viewW - 60),
        y: clamp(hs.y + rand(40, 120), 40, g.viewH - 40),
        game: g, difficulty: 2,
      }));
    }
    bus.emit('dmg', { x: hs.x, y: Math.max(60, hs.y - 150), text: 'BASE SPAWNING!', color: '#ff69b4' });
    audio.banner();
  }

  /** The house is destroyed — victory sequence (score + loot + timer). */
  _onHouseDestroyed(hs) {
    const g = this.game;
    g.score += SAR.HOUSE.victoryScore;
    g.shake = 12;
    g.particles.burst(hs.x, hs.y, { count: 120, color: '#ff69b4', speed: 420, life: 1.2 });
    g.particles.burst(hs.x, hs.y, { count: 80, color: '#ffd54f', speed: 320, life: 1.0 });
    bus.emit('banner', {
      text: "TARGET DESTROYED — ERIDATH'S MOM'S HOUSE",
      tone: 'good',
      duration: 4,
    });
    audio.explosion();
    audio.superWeapon();
    // Guaranteed loot burst (the base's cache — bypasses the drop policy).
    for (const t of ['frenzy', 'health', 'shield', 'mini']) {
      spawnGuaranteedDrop(g, t, hs.x + rand(-70, 70), hs.y + rand(-70, 70));
    }
    g.msglog.log("ERIDATH'S MOM'S HOUSE DESTROYED", 'good', g.time);
    this.victoryTimer = 3.0;
  }

  /** Victory countdown → Game.victory() (mission accomplished screen). */
  _victoryTick(dt) {
    if (this.victoryTimer < 0) return;
    this.victoryTimer -= dt;
    if (this.victoryTimer <= 0 && !this.victoryShown) {
      this.victoryShown = true;
      this.game.victory();
    }
  }

  /**
   * Screen-space house HUD (Game.render, after the classic HUD): the HP
   * bar + label above the base, only while it is on screen + alive.
   */
  renderHouseHud(ctx) {
    const h = this.house;
    if (!h || !h.alive) return;
    const g = this.game;
    const hs = this.houseScreen();
    if (!isOnScreen(g, hs.x, hs.y, 200)) return;
    const size = 128 * SAR.HOUSE.drawScale;
    const w = size * 0.7;
    const barY = hs.y - size / 2 - 26;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(hs.x - w / 2, barY, w, 7);
    const frac = Math.max(0, h.hp / h.maxHp);
    const grad = ctx.createLinearGradient(hs.x - w / 2, 0, hs.x + w / 2, 0);
    grad.addColorStop(0, '#ff5252');
    grad.addColorStop(1, '#ff8a80');
    ctx.fillStyle = grad;
    ctx.fillRect(hs.x - w / 2, barY, w * frac, 7);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hs.x - w / 2, barY, w, 7);
    ctx.fillStyle = '#ffb8e2';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText("ERIDATH'S MOM'S HOUSE — TARGET", hs.x, barY - 7);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

// Filename: InternetBonus.js
// Kitty Vs Everything — v3.42.0
// "The Internet Classic" — High-intensity boss survival round:
//   8 skinny, tall Black Cat mini-bosses orbiting in a circle
//   around 1 skinny, short Pink Cat boss,
//   with normal bonus item drops (crates, power-ups).
//   Banner: "Wait, I've seen this on the Internet."
// v2.2.0: Black Cats now hold a rotating circle around the Pink Cat,
//         which hovers at the center of the formation.
// v2.3.0: Round end now logs the formation off (cats phase out with a
//         flash instead of lingering forever — fixes waves stalling after
//         the bonus). Orbiting cats no longer stack miniboss bars, and
//         their aimed fire is thinned out during the round.
// v3.13.0: Circle center / boss spawn / drops / victory text use the
//          LIVE viewport (game.viewW/H) on ultra-wide stages.
// v3.15.0: The 8 orbiting Black Cats are the boss's ENTOURAGE — each
//          wears a chunky old-school gold chain with a large iced-out
//          digital clock pendant showing the player's REAL local system
//          time (HH:MM), kept live by the RealTimeClock.js sync loop.
//          Outfit art lives in BlackCatEntourage.js.
// v3.42.0: the 12% asteroid drop spawns fully off-screen (ASTEROID.spawnY)
//          and the remaining drops sample the shared POWERUP_DROPS pool
//          (config.js) — Health / Frenzy / Shields / Wanted / Extra Life.
export const VERSION = 'v3.42.0';
import { BONUS, ASTEROID, rollPowerUpDrop } from '../core/config.js'; // v3.42.0: shared drop pool
import { TAU, rand } from '../core/utils.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../core/AudioSystem.js';
import { createEnemy } from '../enemies/EnemyFactory.js';
import PowerUp from '../combat/PowerUp.js';
import { spawnAsteroid } from './AsteroidBonus.js'; // v3.11.0: asteroid chain drops
import { realTimeClock } from '../core/RealTimeClock.js'; // v3.15.0: pendant time sync

export default class InternetBonus {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.timeLeft = 0;
    this.spawned = false;
    this.dropTimer = 0;
    // Circle formation state (Black Cats orbit the Pink Cat)
    this.pinkCat = null;
    this.circleCenter = { x: this.game.viewW / 2, y: 230 }; // v3.13.0: live viewport
    this.orbitAngle = 0;
    this.orbitRadius = 160;
    this.formation = []; // Pink Cat + orbiting Black Cats
  }

  start() {
    this.active = true;
    this.timeLeft = BONUS.INTERNET_DURATION;
    this.spawned = false;
    this.dropTimer = 2;
    this.pinkCat = null;
    this.circleCenter = { x: this.game.viewW / 2, y: 230 }; // v3.13.0: live viewport
    this.orbitAngle = rand(0, TAU); // random starting rotation each round
    this.formation = [];
    // Banner
    bus.emit('banner', {
      text: "Wait, I've seen this on the Internet.",
      tone: 'bad',
      duration: 3,
    });
    audio.banner();
    // v3.15.0: start the real-time clock sync loop (pendant displays)
    realTimeClock.start();
    // Immediately spawn the boss lineup
    this.spawnBosses();
  }

  spawnBosses() {
    const g = this.game;
    // 1 skinny, short Pink Cat boss — hovers at the center of the formation
    const pinkCat = createEnemy({
      type: 'pinkcat',
      tier: 'boss',
      x: g.viewW / 2, // v3.13.0: live viewport
      y: -80,
      game: g,
    });
    // Pink Cat glides down to the formation center and bobs gently;
    // the Black Cats keep a circle around it.
    pinkCat.move = function (dt, slowMul) {
      const s = this.speed * slowMul;
      this.y += s * dt * 0.6;
      if (this.y > 230) this.y = 230 + Math.sin(this.t * 1.2) * 18;
      this.x = g.W / 2 + Math.sin(this.t * 0.5) * 70;
      this.x = Math.max(120, Math.min(g.W - 120, this.x));
    };
    g.enemies.push(pinkCat);
    this.pinkCat = pinkCat;
    this.formation.push(pinkCat);

    // 8 skinny, tall Blackcat mini-bosses orbiting the Pink Cat
    for (let i = 0; i < 8; i++) {
      const a0 = this.orbitAngle + (i / 8) * TAU;
      const cat = createEnemy({
        type: 'blackcat',
        tier: 'miniboss',
        x: this.circleCenter.x + Math.cos(a0) * this.orbitRadius,
        y: -80 - i * 40, // staggered entry from off-screen
        game: g,
      });
      cat.orbitOffset = (i / 8) * TAU;
      // v3.15.0: entourage outfit — chunky gold chain + iced-out
      // real-time clock pendant (per-cat phase so the chains don't
      // sway in unison)
      cat.entourage = true;
      cat.entouragePhase = i * 0.7;
      // Formation tuning: skip the miniboss bar (8 stacked labels are
      // noise — the Pink Cat's boss bar is the focus) and thin the aimed
      // fire so the ring stays fair (the special ring stays untouched).
      cat.drawBossBar = () => {};
      cat.fireRate = 2.2;
      // Glide into the circle, then keep orbiting the Pink Cat
      cat.move = function (dt, slowMul) {
        const s = this.speed * slowMul;
        const ib = g.bonus.internet;
        const a = ib.orbitAngle + this.orbitOffset;
        const cx = ib.circleCenter.x + Math.cos(a) * ib.orbitRadius;
        const cy = ib.circleCenter.y + Math.sin(a) * ib.orbitRadius;
        const dx = cx - this.x;
        const dy = cy - this.y;
        const d = Math.hypot(dx, dy);
        if (d > 1) {
          const step = Math.min(d, s * 2.2 * dt);
          this.x += (dx / d) * step;
          this.y += (dy / d) * step;
        }
      };
      g.enemies.push(cat);
      this.formation.push(cat);
    }
    this.spawned = true;
  }

  update(dt) {
    if (!this.active) return;
    this.timeLeft -= dt;
    // v3.15.0: real-time clock sync loop (pendant displays, ≤1 Date read/s)
    realTimeClock.update(dt);

    // Circle formation: rotate the ring and keep it centered on the
    // Pink Cat (or where it last was if it goes down)
    this.orbitAngle += dt * 0.55;
    if (this.pinkCat && this.pinkCat.alive) {
      this.circleCenter.x = this.pinkCat.x;
      this.circleCenter.y = this.pinkCat.y;
    }

    // Normal bonus item drops (crates, power-ups)
    this.dropTimer -= dt;
    if (this.dropTimer <= 0) {
      this.dropTimer = rand(1.5, 3.0);
      const x = rand(80, this.game.viewW - 80); // v3.13.0: live viewport
      // v3.42.0: 12% asteroid (fully off-screen at ASTEROID.spawnY),
      // otherwise one roll from the shared POWERUP_DROPS pool.
      if (Math.random() < 0.12) {
        spawnAsteroid(this.game, x, ASTEROID.spawnY);
      } else {
        this.game.powerups.push(new PowerUp({ x, y: -30, type: rollPowerUpDrop(), game: this.game }));
      }
    }

    // Timer expired: log the formation off, then return to normal waves
    if (this.timeLeft <= 0) {
      this.active = false;
      this.phaseOutFormation();
      bus.emit('banner', {
        text: 'INTERNET CLEARED! Back to reality...',
        tone: 'good',
        duration: 2.5,
      });
      audio.powerup();
      // Score bonus
      const bonusPts = 8000 * this.game.multiplier;
      this.game.score += bonusPts;
      bus.emit('dmg', {
        x: this.game.viewW / 2, y: this.game.viewH / 2, // v3.13.0: live viewport
        text: '+' + bonusPts.toLocaleString() + ' INTERNET BONUS',
        color: '#ffd54f',
      });
      this.game.state = 'playing';
      this.game.waveManager.startNext();
    }
  }

  /**
   * Round over: phase out any surviving formation cats with a flash.
   * They leave without score or explosions (shots during the round
   * already earned their points), so normal waves can start right away.
   */
  phaseOutFormation() {
    const g = this.game;
    realTimeClock.stop(); // v3.15.0: round over — stop the pendant clock
    for (const e of this.formation) {
      if (!e.alive) continue;
      g.particles.burst(e.x, e.y, {
        count: 24,
        color: e.type === 'pinkcat' ? '#ff69b4' : '#ffee58',
        speed: 280,
        life: 0.55,
      });
      e.escaped = true; // skip onEnemyDeath scoring/explosions
      e.alive = false;
    }
    g.enemies = g.enemies.filter(e => e.alive);
    this.formation = [];
  }
}
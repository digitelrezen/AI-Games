// Filename: DebugBridge.js
// Kitty Vs Everything — v3.27.0
// External debugger helper (dev tooling). Exposes a single handle on
// `window.__KVE__` so external tooling (tools/harness.mjs via the browser
// console, a DevTools snippet, or a future Node bridge) can:
//   • read structured state snapshots  — debug.snapshot()
//   • run simple commands              — debug.run('score 5000')
//   • validate game-state invariants   — debug.validate() → problem list
//   • replay captured console traffic  — debug.logs (ring, 200 entries)
//   • subscribe to game events         — debug.onEvent('banner', fn)
// It never alters gameplay semantics: every command maps to an existing
// public method (pauseMenu, start, msglog, testAimbot, …).
// v3.81.0: `spaceballs` slot in the snapshot — Spaceballs One easter-egg
//          (alive/hp/x/y/destroyed), null-guarded when not on screen.
// v4.1.0: `rnms` slot in the snapshot — RnM ship interceptor easter-egg
//          (alive/hp/x/y/dir/destroyed), null-guarded when not on screen.
// v3.29.0: bender slot in the snapshot — kill-based fields
//          (aimbotActive/killCount/dialogueStage) replace the v3.24.0
//          timeLeft countdown (Bender's dialogue is now kill-driven).
// v3.27.0: `eggs` in the snapshot — easter-egg slots (game.eggs):
//          bender (active/onScreen/quip) + ship (alive/progress).
// v3.16.0: `deploy [on|off]` command (MiniDeploy.toggleFleetDeploy) +
//          fleetDeployed in the snapshot.
export const VERSION = 'v3.81.0';
import { bus } from '../core/EventBus.js';
import { toggleFleetDeploy } from '../levels/MiniDeploy.js';
import { WAVE } from '../core/config.js'; // v3.30.0: wave-system count bounds

const LOG_CAP = 200;

export default class DebugBridge {
  constructor(game) {
    this.game = game;
    this.logs = [];           // {t, level, args} ring buffer
    this._subscribers = new Map();
    this._hookConsole();
    // Register the external handle (idempotent).
    if (typeof window !== 'undefined') window.__KVE__ = this;
  }

  // ─── CONSOLE AGGREGATION ───
  _hookConsole() {
    if (typeof console === 'undefined') return;
    for (const level of ['log', 'warn', 'error']) {
      const orig = console[level].bind(console);
      console[level] = (...args) => {
        orig(...args);
        this.logs.push({ t: Date.now(), level, args: args.slice(0, 6) });
        if (this.logs.length > LOG_CAP) this.logs.shift();
      };
    }
  }

  // ─── STATE SNAPSHOTS ───
  /** Full structured snapshot of the game (safe to JSON.stringify). */
  snapshot() {
    const g = this.game;
    const p = g.player;
    return {
      version: g.version,
      state: g.state,
      paused: g.paused,
      time: g.time,
      score: g.score,
      multiplier: g.multiplier,
      wave: g.wave,
      waveSystem: g.waveManager ? { // v3.30.0: 16-species wave system
        count: g.waveManager.getWaveCount(),
        spawnOverride: g.waveManager.spawnOverride,
        difficulty: Math.round(g.waveManager.difficulty * 100) / 100,
        species: g.waveManager.currentSpecies,
        speciesIndex: g.waveManager.speciesIndex,
      } : null,
      enemies: g.enemies.length,
      bullets: g.bullets.length,
      ebullets: g.ebullets.length,
      particles: g.particles.parts.length,
      aimbot: !!g.aimbot.active,
      eggs: g.eggs ? { // v3.27.0: easter-egg slots (EasterEgg manager)
        bender: g.eggs.bender ? {
          active: g.eggs.bender.active,
          onScreen: g.eggs.bender.onScreen,
          aimbotActive: g.eggs.bender.aimbotActive, // v3.29.0
          killCount: g.eggs.bender.killCount, // v3.29.0
          dialogueStage: g.eggs.bender.dialogueStage, // v3.29.0
          quip: g.eggs.bender.quip,
        } : null,
        ship: g.eggs.ship ? {
          alive: g.eggs.ship.alive,
          hp: Math.max(0, Math.round(g.eggs.ship.hp)),
          pass: g.eggs.ship.pass,
          progress: Math.round(g.eggs.ship.progress * 1000) / 1000,
        } : null,
        spaceballs: g.eggs.spaceballs ? { // v3.81.0: Spaceballs One
          alive: g.eggs.spaceballs.alive,
          hp: Math.max(0, Math.round(g.eggs.spaceballs.hp)),
          x: Math.round(g.eggs.spaceballs.x),
          y: Math.round(g.eggs.spaceballs.y),
          destroyed: g.eggs.spaceballs.destroyed,
        } : null,
        rnms: g.eggs.rnms ? { // v4.1.0: RnM ship interceptor
          alive: g.eggs.rnms.alive,
          hp: Math.max(0, Math.round(g.eggs.rnms.hp)),
          x: Math.round(g.eggs.rnms.x),
          y: Math.round(g.eggs.rnms.y),
          dir: g.eggs.rnms.dir,
          destroyed: g.eggs.rnms.destroyed,
        } : null,
      } : null,
      testAimbot: {
        active: g.testAimbot ? g.testAimbot.active : false,
        target: g.testAimbot && g.testAimbot.target ? g.testAimbot.target.type : null,
        dps: g.testAimbot ? Math.round(g.testAimbot.dps) : 0,
      },
      player: p ? {
        x: Math.round(p.x), y: Math.round(p.y),
        hp: Math.round(p.hp), maxHp: p.maxHp,
        shield: Math.round(p.shield),
        lives: p.lives,
        weapon: p.weapon,
        thermal: Math.round(p.thermal),
        minis: p.minis.length,
        fleetDeployed: p.fleetDeployed, // v3.16.0: docked (false) / deployed (true)
      } : null,
      settings: { ...g.settingsObj },
      keybinds: { ...g.keybindsObj },
      msglog: g.msglog ? g.msglog.entries.slice(-10) : [],
    };
  }

  // ─── STATE VALIDATION (invariants) ───
  validate() {
    const g = this.game, p = g.player;
    const problems = [];
    const check = (cond, msg) => { if (!cond) problems.push(msg); };
    check(['menu', 'playing', 'bonus', 'gameover'].includes(g.state), 'invalid state: ' + g.state);
    check(g.score >= 0, 'negative score');
    check(g.multiplier >= 1, 'multiplier < 1');
    check(g.wave >= 0, 'wave < 0');
    check(g.time >= 0, 'negative time');
    if (p && g.state === 'playing') {
      check(p.hp <= p.maxHp + 1, 'hp > maxHp');
      check(p.shield >= 0, 'negative shield');
      check(p.lives >= 0, 'negative lives');
      check(isFinite(p.x) && isFinite(p.y), 'player position is not finite');
      check(p.thermal >= 0 && p.thermal <= (p.thermalMax || 100) + 1, 'thermal out of range');
    }
    check(g.particles.parts.length < 20000, 'particle leak: ' + g.particles.parts.length);
    return problems;
  }

  // ─── SIMPLE COMMAND INTERPRETER ───
  /**
   * Run a command. Returns {ok, output}.
   *   help · state · snapshot · validate · clearlog
   *   score <n> · hp <n> · lives <n> · wave <n> · count <n>
   *   pause · resume · restart · aimbot [on|off] · deploy [on|off]
   */
  run(cmdline) {
    const [cmd, ...rest] = String(cmdline || '').trim().split(/\s+/);
    const g = this.game, p = g.player;
    const out = (msg) => ({ ok: true, output: msg });
    const err = (msg) => ({ ok: false, output: msg });
    const num = (min, max) => {
      const v = parseFloat(rest[0]);
      if (isNaN(v)) return err('usage: ' + cmd + ' <number>');
      return { ok: true, v: Math.max(min, Math.min(max, v)) };
    };
    switch (cmd) {
      case 'help':
        return out('commands: help, state, snapshot, validate, clearlog, score <n>, hp <n>, lives <n>, wave <n>, count <n>, pause, resume, restart, aimbot [on|off], deploy [on|off]');
      case 'state':
      case 'snapshot':
        return out(JSON.stringify(this.snapshot(), null, 1));
      case 'validate': {
        const problems = this.validate();
        return out(problems.length ? 'PROBLEMS:\n- ' + problems.join('\n- ') : 'OK — all invariants hold');
      }
      case 'clearlog':
        this.logs = [];
        if (g.msglog) g.msglog.clear();
        return out('logs cleared');
      case 'score': { const r = num(0, 1e9); if (!r.ok) return r; g.score = Math.round(r.v); return out('score = ' + g.score); }
      case 'hp': { if (!p) return err('no player'); const r = num(1, p.maxHp); if (!r.ok) return r; p.hp = r.v; return out('hp = ' + p.hp); }
      case 'lives': { if (!p) return err('no player'); const r = num(0, 99); if (!r.ok) return r; p.lives = Math.round(r.v); return out('lives = ' + p.lives); }
      case 'wave': { const r = num(0, 999); if (!r.ok) return r; g.wave = Math.round(r.v); return out('wave = ' + g.wave); }
      case 'count': { // v3.30.0: pin the active enemy count (0 = AUTO ramp)
        if (!g.waveManager) return err('no wave manager');
        const r = num(0, WAVE.COUNT_MAX); if (!r.ok) return r;
        g.waveManager.spawnOverride = Math.round(r.v);
        return out('spawn count = ' + g.waveManager.spawnOverride + (g.waveManager.spawnOverride > 0 ? '' : ' (AUTO)'));
      }
      case 'pause': g.pauseMenu.toggle(); return out('paused = ' + g.paused);
      case 'resume': if (g.paused) g.pauseMenu.toggle(); return out('paused = ' + g.paused);
      case 'restart': g.restartLevel(); return out('mission restarted');
      case 'aimbot': {
        if (rest[0] === 'on' && !g.testAimbot.active) g.testAimbot.toggle();
        else if (rest[0] === 'off' && g.testAimbot.active) g.testAimbot.toggle();
        else if (!rest[0]) g.testAimbot.toggle();
        return out('test aimbot active = ' + g.testAimbot.active);
      }
      case 'deploy': {
        // v3.16.0: toggle the mini-fleet deploy state (MiniDeploy.js)
        if (!p) return err('no player');
        const want = rest[0] === 'on' ? true : rest[0] === 'off' ? false : !p.fleetDeployed;
        if (want !== p.fleetDeployed) toggleFleetDeploy(p);
        return out('fleetDeployed = ' + p.fleetDeployed + (p.minis.length ? '' : ' (no minis docked)'));
      }
      default:
        return err('unknown command: ' + cmd + ' (try "help")');
    }
  }

  // ─── EXTERNAL EVENT SUBSCRIPTION ───
  onEvent(name, fn) {
    if (!this._subscribers.has(name)) this._subscribers.set(name, []);
    this._subscribers.get(name).push(fn);
    bus.on(name, fn);
    return () => {
      const list = this._subscribers.get(name) || [];
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
      bus.off(name, fn);
    };
  }
}
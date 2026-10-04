// ═══════════════════════════════════════════════════════════
//  [6w] v3.70.0 MODULAR SPECIALIZED ROCKETS — BaseRocket (shared
//        twin-salvo base) + StunRockets (Q/H homing) + NapalmRockets
//        (E/J straight). js/combat/Rockets.js is deleted; the twin-salvo
//        deploy, per-frame steering, and impact AoE now live in the three
//        modules and are ticked from Game.update before bullet integration.
// ═══════════════════════════════════════════════════════════

import { ROOT, check, makeGame, makePlayer, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
console.log('\n[6w] v3.70.0 modular specialized rockets (BaseRocket + StunRockets + NapalmRockets)');
{
  const { default: BaseRocket } = await mod('js/combat/BaseRocket.js');
  const { default: StunRockets, stunRockets } = await mod('js/combat/StunRockets.js');
  const { default: NapalmRockets, napalmRockets } = await mod('js/combat/NapalmRockets.js');
  const brSrc = fs.readFileSync(path.join(ROOT, 'js/combat/BaseRocket.js'), 'utf8');
  const srSrc = fs.readFileSync(path.join(ROOT, 'js/combat/StunRockets.js'), 'utf8');
  const nrSrc = fs.readFileSync(path.join(ROOT, 'js/combat/NapalmRockets.js'), 'utf8');
  const { ROCKETS } = await mod('js/core/config.js');

  // ── Source gates ──
  check('BaseRocket: VERSION = v1.0.0', brSrc.includes("VERSION = 'v1.0.0'"));
  check('StunRockets: VERSION = v1.0.0', srSrc.includes("VERSION = 'v1.0.0'"));
  check('NapalmRockets: VERSION = v1.0.0', nrSrc.includes("VERSION = 'v1.0.0'"));
  check('StunRockets: extends BaseRocket', Object.getPrototypeOf(StunRockets.prototype).constructor.name === 'BaseRocket');
  check('NapalmRockets: extends BaseRocket', Object.getPrototypeOf(NapalmRockets.prototype).constructor.name === 'BaseRocket');
  check('BaseRocket: abstract kind/launch/steer/detonate all throw', (() => {
    let threw = 0;
    const b = new BaseRocket();
    try { b.kind; } catch { threw++; }
    try { b.launch({}, {}); } catch { threw++; }
    try { b.steer({}, {}, 0); } catch { threw++; }
    try { b.detonate({}, {}, 0, 0); } catch { threw++; }
    return threw === 4;
  })());
  check('BaseRocket: _deploySalvo tags rocketKind + launch FX (shake ≥ 3)',
    brSrc.includes('b.rocketKind = this.kind;') && brSrc.includes('game.shake = Math.max(game.shake, 3)'));
  check('BaseRocket: update() filters live carriers by rocketKind',
    brSrc.includes('if (!b.alive || b.rocketKind !== this.kind) continue;'));
  check('StunRockets: kind = stun + no direct damage (damage: 0)', srSrc.includes("get kind() { return 'stun'; }") && srSrc.includes('damage: 0'));
  check('NapalmRockets: kind = napalm + chip damage (ROCKETS.napalmChip)', nrSrc.includes("get kind() { return 'napalm'; }") && nrSrc.includes('damage: ROCKETS.napalmChip'));
  check('StunRockets: module-level stunRockets singleton', stunRockets instanceof StunRockets);
  check('NapalmRockets: module-level napalmRockets singleton', napalmRockets instanceof NapalmRockets);

  // Game.js: imports both singletons + ticks them before bullet integration
  const gameSrc2 = fs.readFileSync(path.join(ROOT, 'js/core/Game.js'), 'utf8');
  check('Game: imports stunRockets + napalmRockets',
    gameSrc2.includes("import { stunRockets } from '../combat/StunRockets.js'") &&
    gameSrc2.includes("import { napalmRockets } from '../combat/NapalmRockets.js'"));
  check('Game: ticks stunRockets.update + napalmRockets.update',
    gameSrc2.includes('stunRockets.update(this, dt);') && gameSrc2.includes('napalmRockets.update(this, dt);'));
  check('Game: rocket update runs before bullet position integration',
    gameSrc2.indexOf('stunRockets.update(this, dt);') !== -1 &&
    gameSrc2.indexOf('stunRockets.update(this, dt);') < gameSrc2.indexOf('for (const b of this.bullets) b.update(dt);'));

  // PlayerWeapons: fires delegate to the module singletons (no inline salvo)
  const pwSrc4 = fs.readFileSync(path.join(ROOT, 'js/player/PlayerWeapons.js'), 'utf8');
  check('PlayerWeapons: fireStunRockets delegates to stunRockets.launch', pwSrc4.includes('stunRockets.launch(p.game, p);'));
  check('PlayerWeapons: fireNapalmRockets delegates to napalmRockets.launch', pwSrc4.includes('napalmRockets.launch(p.game, p);'));
  check('PlayerWeapons: no stale launchRockets/updateRockets', !pwSrc4.includes('launchRockets') && !pwSrc4.includes('updateRockets'));
  check('Rockets.js deleted (no js/combat/Rockets.js)', !fs.existsSync(path.join(ROOT, 'js/combat/Rockets.js')));

  // ── Headless behavior ──
  const makeRocketGame = () => { const g = makeGame(); g.enemies = []; g.player = { minis: [] }; g.fireZones = []; return g; };
  const makeEnemy = (x, y, extra = {}) => ({
    alive: true, x, y, radius: 20, shield: 0, special: false,
    stunTimer: 0, shootTimer: 0, flash: 0, hp: 1000, color: '#ff0000', score: 100,
    applyDamage(d) { this.hp -= d; if (this.hp <= 0) this.alive = false; },
    ...extra,
  });

  // STUN launch: twin homing salvo, 0 damage, stun-colored carriers
  {
    const g = makeRocketGame();
    const p = makePlayer(g); p.x = 640; p.y = 400; p.angle = 0;
    stunRockets.launch(g, p);
    const rockets = g.bullets.filter(b => b.rocketKind === 'stun');
    check('stun launch: twin salvo (2 carriers)', rockets.length === 2, `got ${rockets.length}`);
    check('stun launch: carriers tagged rocketKind=stun + weapon=stun', rockets.every(b => b.rocketKind === 'stun' && b.weapon === 'stun'));
    check('stun launch: 0 direct damage + stun color', rockets.every(b => b.damage === 0 && b.color === ROCKETS.stunColor));
  }
  // STUN detonate: shield-strip + stun + fire suppression, no direct damage
  {
    const g = makeRocketGame();
    const p = makePlayer(g); p.x = 640; p.y = 400; p.angle = 0;
    const enemy = makeEnemy(640, 200, { shield: 50 });
    g.enemies.push(enemy);
    stunRockets.launch(g, p);
    for (const b of g.bullets) { b.x = enemy.x; b.y = enemy.y; } // place both on target
    stunRockets.update(g, 0.016);
    check('stun detonate: both carriers dead', g.bullets.every(b => !b.alive));
    check('stun detonate: enemy shield stripped to 0', enemy.shield === 0, `got ${enemy.shield}`);
    check('stun detonate: enemy stunned (stunTimer 1.0)', enemy.stunTimer === ROCKETS.stunDuration, `got ${enemy.stunTimer}`);
    check('stun detonate: fire suppressed (shootTimer 3.0)', enemy.shootTimer === ROCKETS.stunSuppress, `got ${enemy.shootTimer}`);
    check('stun detonate: no direct damage (hp unchanged)', enemy.hp === 1000, `got ${enemy.hp}`);
  }
  // NAPALM launch: twin straight salvo, chip damage, napalm-colored carriers
  {
    const g = makeRocketGame();
    const p = makePlayer(g); p.x = 640; p.y = 400; p.angle = 0;
    napalmRockets.launch(g, p);
    const rockets = g.bullets.filter(b => b.rocketKind === 'napalm');
    check('napalm launch: twin salvo (2 carriers)', rockets.length === 2, `got ${rockets.length}`);
    check('napalm launch: carriers tagged rocketKind=napalm + weapon=napalm', rockets.every(b => b.rocketKind === 'napalm' && b.weapon === 'napalm'));
    check('napalm launch: chip damage 12 + napalm color', rockets.every(b => b.damage === ROCKETS.napalmChip && b.color === ROCKETS.napalmColor));
  }
  // NAPALM detonate (self-destruct): AoE damage + lingering fire zone
  {
    const g = makeRocketGame();
    const p = makePlayer(g); p.x = 640; p.y = 400; p.angle = 0;
    const enemy = makeEnemy(0, 0);
    g.enemies.push(enemy);
    napalmRockets.launch(g, p);
    for (const b of g.bullets) { b.x = 100; b.y = 0; b.life = 0.01; } // in AoE (200px), outside clip range
    napalmRockets.update(g, 0.016);
    check('napalm detonate: both carriers dead', g.bullets.every(b => !b.alive));
    check('napalm detonate: enemy took 2×60 AoE damage', enemy.hp === 1000 - 2 * ROCKETS.napalmDamage, `got ${enemy.hp}`);
    check('napalm detonate: lingering fire zone spawned per impact', g.fireZones.length === 2, `got ${g.fireZones.length}`);
  }
  // NAPALM clip-hit: in-flight chip damage + detonation + fire zone
  {
    const g = makeRocketGame();
    const p = makePlayer(g); p.x = 640; p.y = 400; p.angle = 0;
    const enemy = makeEnemy(0, 0);
    g.enemies.push(enemy);
    napalmRockets.launch(g, p);
    const b = g.bullets.find(x => x.rocketKind === 'napalm');
    b.x = enemy.x; b.y = enemy.y; b.life = ROCKETS.life; // on target → clip hit
    napalmRockets.update(g, 0.016);
    check('napalm clip: carrier dead after impact', !b.alive);
    check('napalm clip: enemy took chip + AoE damage (12 + 60)', enemy.hp === 1000 - ROCKETS.napalmChip - ROCKETS.napalmDamage, `got ${enemy.hp}`);
    check('napalm clip: fire zone spawned', g.fireZones.length >= 1, `got ${g.fireZones.length}`);
  }
}

}

// ═══════════════════════════════════════════════════════════
//  [6ah] v3.97.0 HAZARDS — the independent hazard field
//        (js/hazards/): 10 non-lootable, shootable environmental
//        obstacles that drift in from ANY edge on the HazardManager's
//        own spawner (separate from enemy waves, power-up drops and
//        easter eggs), detonate a per-type explosion, and NEVER touch
//        the DropManager (zero loot).
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod, makeGame } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

const HAZARD_TYPES_EXPECTED = [
  'biobarrel', 'biobomb', 'clusterbomb', 'depletedshell', 'firebarrel',
  'firemine', 'magnetmine', 'nuke', 'nukebarrel', 'proxmine',
];

export default async function run() {
  console.log('\n[6ah] v3.97.0 hazards (source gates + headless)');
  {
    // ── Module existence ──
    for (const f of ['js/hazards/HazardBase.js', 'js/hazards/HazardFactory.js', 'js/hazards/HazardManager.js', 'js/core/config/hazards.js']) {
      check(`module exists: ${f}`, fs.existsSync(path.join(ROOT, f)));
    }

    const baseSrc = fs.readFileSync(path.join(ROOT, 'js/hazards/HazardBase.js'), 'utf8');
    const factorySrc = fs.readFileSync(path.join(ROOT, 'js/hazards/HazardFactory.js'), 'utf8');
    const managerSrc = fs.readFileSync(path.join(ROOT, 'js/hazards/HazardManager.js'), 'utf8');
    const cfgHazSrc = fs.readFileSync(path.join(ROOT, 'js/core/config/hazards.js'), 'utf8');
    const cfgSrc = fs.readFileSync(path.join(ROOT, 'js/core/config.js'), 'utf8');
    const gameSrc = fs.readFileSync(path.join(ROOT, 'js/core/Game.js'), 'utf8');
    const collSrc = fs.readFileSync(path.join(ROOT, 'js/combat/Collisions.js'), 'utf8');
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/asset-manifest.json'), 'utf8'));
    const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');

    // ── Config surface (single tuning point) ──
    check('config/hazards.js: HAZARD_TYPES defines all 10 types',
      HAZARD_TYPES_EXPECTED.every(t => cfgHazSrc.includes(`${t}:`)));
    check('config/hazards.js: HAZARD spawner tuning (SPAWN_MIN/MAX, MAX_CONCURRENT, EDGE_MARGIN, WEIGHTS)',
      cfgHazSrc.includes('SPAWN_MIN') && cfgHazSrc.includes('SPAWN_MAX') &&
      cfgHazSrc.includes('MAX_CONCURRENT') && cfgHazSrc.includes('EDGE_MARGIN') && cfgHazSrc.includes('WEIGHTS'));
    check('config/hazards.js: rollHazardType() weighted roll', cfgHazSrc.includes('export function rollHazardType'));
    check('config.js: re-exports HAZARD_TYPES / HAZARD / rollHazardType',
      cfgSrc.includes("export { HAZARD_TYPES, HAZARD, rollHazardType } from './config/hazards.js'"));

    // ── Asset pipeline ──
    check('asset-manifest.json: 10 hazard_* entries from the Hazards/ subfolder',
      HAZARD_TYPES_EXPECTED.every(t => manifest.assets && typeof manifest.assets['hazard_' + t] === 'string'
        && manifest.assets['hazard_' + t].startsWith('Hazards/')));
    check('AssetSprites.js: 10 hazard_* sprites embedded at 128×128',
      HAZARD_TYPES_EXPECTED.every(t => spritesSrc.includes(`hazard_${t}: { w: 128, h: 128 }`)));

    // ── Independence + zero loot ──
    check('hazards modules never import the DropManager (zero loot)',
      ![baseSrc, factorySrc, managerSrc, cfgHazSrc].some(s => /import[^;]*DropManager/.test(s)));
    check('HazardManager: own spawn timer (independent of WaveManager)',
      managerSrc.includes('this.spawnTimer') && !managerSrc.includes('waveManager.spawn'));
    check('HazardBase: off-screen kill gate (v3.83.0 parity)',
      baseSrc.includes('isOnScreen') && baseSrc.includes('applyDamage'));
    check('HazardBase: _detonate routes through HazardManager.explode',
      baseSrc.includes('_detonate') && baseSrc.includes('this.game.hazards.explode'));
    check('HazardFactory: pickSpawnVector enters from a random edge',
      factorySrc.includes('pickSpawnVector') && factorySrc.includes('EDGE_MARGIN'));

    // ── Game.js wiring ──
    check('Game.js: imports HazardManager',
      gameSrc.includes("import HazardManager from '../hazards/HazardManager.js'"));
    check('Game.js: instantiates game.hazards in the constructor', gameSrc.includes('this.hazards = new HazardManager(this)'));
    check('Game.js: resets the hazard field on mission start', gameSrc.includes('this.hazards.reset()'));
    check('Game.js: ticks hazards.update() in the core loop', gameSrc.includes('this.hazards.update(this, dt)'));
    check('Game.js: renders hazards.draw() in render()', gameSrc.includes('this.hazards.draw(this, ctx)'));

    // ── Collisions wiring (friendly bullets damage hazards) ──
    check('Collisions.js: friendly bullets hit hazards + explode on lethal damage',
      collSrc.includes('game.hazards') && collSrc.includes('game.hazards.explode(game, hz, { byPlayer: true })'));

    // ── Headless behavior ──
    const { default: HazardManager } = await mod('js/hazards/HazardManager.js');
    const { HAZARD_TYPES, rollHazardType } = await mod('js/core/config/hazards.js');
    const game = makeGame();
    game.state = 'playing';
    game.waveManager = { active: true };
    game.hitPlayer = () => {};
    const mgr = new HazardManager(game);
    check('headless: fresh manager has an empty field', mgr.list.length === 0 && mgr.rings.length === 0 && mgr.pools.length === 0);

    // rollHazardType returns a valid key every time.
    const rolls = new Set(Array.from({ length: 300 }, () => rollHazardType()));
    check('headless: rollHazardType() only yields HAZARD_TYPES keys',
      [...rolls].every(t => HAZARD_TYPES[t]) && rolls.size >= 5);

    // Spawn from a random edge — the spawn point starts off-screen.
    const hz = mgr.spawnRandom(game);
    check('headless: spawnRandom() pushes a live hazard with a valid spec',
      mgr.list.length === 1 && hz.alive && HAZARD_TYPES[hz.type]);
    const m = hz.radius + 40;
    const offScreen = hz.x < -m + 40 || hz.x > game.W + m - 40 || hz.y < -m + 40 || hz.y > game.H + m - 40;
    check('headless: hazard spawns off-screen at a random edge', offScreen);

    // Drift: position moves along the fixed heading.
    const x0 = hz.x, y0 = hz.y;
    hz.update(0.5);
    check('headless: hazard drifts along its heading', Math.hypot(hz.x - x0, hz.y - y0) > 1);

    // Off-screen kill gate: a hazard parked off-screen takes no damage.
    const parked = mgr.spawnRandom(game, 'nuke');
    const px0 = parked.x, py0 = parked.y;
    parked.x = -9999; parked.y = -9999; // force fully off-screen
    const hpBefore = parked.hp;
    parked.applyDamage(999);
    check('headless: off-screen kill gate — off-screen hazard ignores damage', parked.hp === hpBefore && parked.alive);
    parked.x = px0; parked.y = py0;

    // Player kill: lethal damage → explode(byPlayer) → score, rings,
    // per-type pools, and ZERO loot (no powerups / drops created).
    // Mirrors the Collisions.js friendly-bullet flow exactly.
    const hz2 = mgr.spawnRandom(game, 'biobarrel');
    hz2.x = game.W / 2; hz2.y = game.H / 2; // park on-screen
    const scoreBefore = game.score;
    const poolsBefore = mgr.pools.length;
    hz2.applyDamage(9999);
    if (!hz2.alive && !hz2.deathHandled) {
      mgr.explode(game, hz2, { byPlayer: true }); // sets deathHandled
    }
    check('headless: lethal damage kills the hazard', !hz2.alive && hz2.deathHandled);
    check('headless: player kill awards score', game.score > scoreBefore);
    check('headless: explosion pushes a shockwave ring', mgr.rings.length > 0);
    check('headless: bio explosion leaves a lingering pool', mgr.pools.length === poolsBefore + 1);
    check('headless: ZERO loot — no powerups or drops created', !game.powerups || game.powerups.length === 0);

    // Non-player detonation (proximity / contact) scores nothing, and a
    // second explode() on the same hazard is a no-op (deathHandled gate).
    const hz3 = mgr.spawnRandom(game, 'proxmine');
    hz3.x = game.W / 2; hz3.y = game.H / 2;
    const scoreBefore3 = game.score;
    mgr.explode(game, hz3, { byPlayer: false });
    check('headless: self-detonation scores nothing', game.score === scoreBefore3 && !hz3.alive && hz3.deathHandled);
    const ringsBefore3 = mgr.rings.length;
    mgr.explode(game, hz3, { byPlayer: true });
    check('headless: double-explode is a no-op (deathHandled gate)',
      mgr.rings.length === ringsBefore3 && game.score === scoreBefore3);

    // Magnet mine clears enemy bullets in its field.
    const hz4 = mgr.spawnRandom(game, 'magnetmine');
    hz4.x = game.W / 2; hz4.y = game.H / 2;
    game.bullets.push({ alive: true, friendly: false, x: game.W / 2 + 40, y: game.H / 2 + 40 });
    game.bullets.push({ alive: true, friendly: true, x: game.W / 2 + 40, y: game.H / 2 + 40 });
    mgr.explode(game, hz4, { byPlayer: false });
    check('headless: magnet mine clears enemy bullets only',
      game.bullets[0].alive === false && game.bullets[1].alive === true);

    // Nuke explosion sets the full-screen flash.
    const hz5 = mgr.spawnRandom(game, 'nuke');
    hz5.x = game.W / 2; hz5.y = game.H / 2;
    mgr.explode(game, hz5, { byPlayer: true });
    check('headless: nuke explosion triggers the full-screen flash', mgr.flashT > 0);

    // The spawner ticks under an active combat wave and respects the cap.
    mgr.reset();
    mgr.spawnTimer = 0.001;
    mgr.update(game, 0.01);
    check('headless: spawner fires on its own timer during a combat wave', mgr.list.length === 1);
    const { HAZARD } = await mod('js/core/config/hazards.js');
    for (let i = 0; i < 20; i++) mgr.spawnRandom(game);
    check('headless: field size is bounded (MAX_CONCURRENT + manual spawns)',
      mgr.list.length <= HAZARD.MAX_CONCURRENT + 20);
  }
}

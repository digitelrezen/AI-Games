// ═══════════════════════════════════════════════════════════
//  [6ap] v4.12.0 SPACE SNAKE PRE-WAVE (RnM encounter) — the
//        Space Snake is the easter-egg-only pre-wave species
//        that sets the scene before the RnM interceptor crosses
//        in ("Aw geez, Rick, is that a snake?"). Full pipeline:
//        .assets/SpaceSnake-256x256.png → tools/asset-manifest.json
//        (key `spacesnake`) → import-assets.mjs → js/core/
//        AssetSprites.js (base64, 128×128) + project assets/ copy;
//        stats live in ENEMY_TYPES.spacesnake (config/enemies.js,
//        parameter standardization — the module hardcodes nothing);
//        EnemyFactory registers it; WaveManager filters it out of
//        the regular wave species (WAVE.SPECIES_COUNT stays 19);
//        EasterEgg.spawnRnMPreWave drops RNMSHIP.preWaveCount of
//        them across the top of the playfield, and the RnM ship
//        enters RNMSHIP.preWaveDelay seconds later (rnmsShipDelay
//        countdown). The ship-side behavior (pre-wave → entry
//        delay, tank hull, conversation-linked shield, guaranteed
//        frenzy drop) is covered by [6al].
// ═══════════════════════════════════════════════════════════

import { ROOT, TOOLS, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
  console.log('\n[6ap] v4.12.0 Space Snake pre-wave (RnM encounter)');
  // ─── Asset pipeline (single-file build compatibility) ───
  const manifest = JSON.parse(fs.readFileSync(path.join(TOOLS, 'asset-manifest.json'), 'utf8'));
  check('asset-manifest.json: spacesnake → SpaceSnake-256x256.png', manifest.assets.spacesnake === 'SpaceSnake-256x256.png');
  const ASSET_DIR = path.resolve(TOOLS, '..', '..', '.assets');
  check('.assets/SpaceSnake-256x256.png exists (shared asset)', fs.existsSync(path.join(ASSET_DIR, 'SpaceSnake-256x256.png')));
  check('assets/SpaceSnake-256x256.png copied into the project', fs.existsSync(path.join(ROOT, 'assets', 'SpaceSnake-256x256.png')));
  const regSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');
  check('AssetSprites.js: registry carries the spacesnake key (128×128)', /spacesnake:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(regSrc));
  check('AssetSprites.js: base64 sprite embedded (single-file build)', regSrc.includes('spacesnake: "iVBOR'));

  // ─── Enemy config (parameter standardization: ENEMY_TYPES only) ───
  const { ENEMY_TYPES } = await mod('js/core/config.js');
  check('ENEMY_TYPES: spacesnake registered', !!ENEMY_TYPES.spacesnake, `got ${Object.keys(ENEMY_TYPES).join(', ')}`);
  check('ENEMY_TYPES.spacesnake: serpent pattern + cosmic palette',
    ENEMY_TYPES.spacesnake.pattern === 'serpent' && ENEMY_TYPES.spacesnake.color === '#b388ff',
    `got ${JSON.stringify(ENEMY_TYPES.spacesnake)}`);
  check('ENEMY_TYPES.spacesnake: tunable stats (hp 42 / speed 1.8 / damage 12 / fireRate 1.1)',
    ENEMY_TYPES.spacesnake.hp === 42 && ENEMY_TYPES.spacesnake.speed === 1.8 &&
    ENEMY_TYPES.spacesnake.damage === 12 && ENEMY_TYPES.spacesnake.fireRate === 1.1,
    `got ${JSON.stringify(ENEMY_TYPES.spacesnake)}`);

  // ─── Factory + module surface ───
  const factorySrc = fs.readFileSync(path.join(ROOT, 'js/enemies/EnemyFactory.js'), 'utf8');
  check('EnemyFactory: spacesnake → SpaceSnakeEnemy registration',
    factorySrc.includes('spacesnake: SpaceSnakeEnemy') && factorySrc.includes("import SpaceSnakeEnemy from './SpaceSnakeEnemy.js'"));
  const ssSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/SpaceSnakeEnemy.js'), 'utf8');
  check('SpaceSnakeEnemy: v4.12.0 header + VERSION = v1.0.0',
    ssSrc.includes('// Kitty Vs Everything — v4.12.0') && ssSrc.includes("VERSION = 'v1.0.0'"));
  check('SpaceSnakeEnemy: sprite key "spacesnake" via the AssetManager pipeline',
    ssSrc.includes("SPACE_SNAKE_SPRITE_KEY = 'spacesnake'") && ssSrc.includes('getSprite(SPACE_SNAKE_SPRITE_KEY)'));
  check('SpaceSnakeEnemy: null-sprite → procedural fallback branch', ssSrc.includes('this._drawProcedural(ctx, r)'));
  check('SpaceSnakeEnemy: slither gait phase-locked to the movement sine', ssSrc.includes('Math.sin(this.t * 2.4)'));
  check('SpaceSnakeEnemy: aspect-preserving nearest-neighbor draw',
    ssSrc.includes('(targetW * dims.h) / dims.w') && ssSrc.includes('ctx.imageSmoothingEnabled = false'));
  check('SpaceSnakeEnemy: type-color accent glow pass', ssSrc.includes('ctx.shadowColor = this.color') && ssSrc.includes('ctx.shadowBlur = r * 0.8'));
  check('SpaceSnakeEnemy: no hardcoded stats (parameter standardization)',
    !/this\.hp\s*=/.test(ssSrc) && !/this\.speed\s*=/.test(ssSrc) && !/this\.damage\s*=/.test(ssSrc) && !/this\.fireRate\s*=/.test(ssSrc));

  // ─── Easter-egg-only: filtered out of the regular wave cycle ───
  const waveSrc = fs.readFileSync(path.join(ROOT, 'js/core/WaveManager.js'), 'utf8');
  check('WaveManager: spacesnake + skeleton filtered out of the wave species',
    waveSrc.includes("t !== 'spacesnake'") && waveSrc.includes("t !== 'skeleton'"));
  check('regular wave species count stays 19 (bonus-only species excluded)',
    Object.keys(ENEMY_TYPES).filter((t) => t !== 'spacesnake' && t !== 'skeleton').length === 19,
    `got ${Object.keys(ENEMY_TYPES).filter((t) => t !== 'spacesnake' && t !== 'skeleton').length}`);

  // ─── Headless spawn through the factory (stats from ENEMY_TYPES) ───
  const { createEnemy } = await mod('js/enemies/EnemyFactory.js');
  const game = {
    W: 1280, viewW: 1280, viewH: 720, H: 720,
    state: 'playing',
    bullets: [], powerups: [],
    particles: { burst() {} },
    shake: 0,
    player: { x: 640, y: 400 },
  };
  const snake = createEnemy({ type: 'spacesnake', tier: 'mob', x: 640, y: 100, game, difficulty: 1 });
  check('factory: spacesnake spawns with ENEMY_TYPES stats (hp 42 @ mob tier)', snake.hp === 42 && snake.maxHp === 42, `hp=${snake.hp}`);
  check('factory: spacesnake serpent pattern + speed 1.8 (→ 108 px/s)', snake.pattern === 'serpent' && snake.speed === 108, `speed=${snake.speed} pattern=${snake.pattern}`);
  check('factory: spacesnake cosmic color + mob score 100', snake.color === '#b388ff' && snake.score === 100, `color=${snake.color} score=${snake.score}`);

  // ─── Pre-wave spawner surface (behavior covered by [6al]) ───
  const eggSrc = fs.readFileSync(path.join(ROOT, 'js/core/EasterEgg.js'), 'utf8');
  check('EasterEgg: spawnRnMPreWave drops spacesnake via the factory',
    eggSrc.includes('export function spawnRnMPreWave(game)') && eggSrc.includes("createEnemy({ type: 'spacesnake'"));
  check('EasterEgg: pre-wave size + delay come from RNMSHIP tuning',
    eggSrc.includes('RNMSHIP.preWaveCount') && eggSrc.includes('RNMSHIP.preWaveDelay'));
}
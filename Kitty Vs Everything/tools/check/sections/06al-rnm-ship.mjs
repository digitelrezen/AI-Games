// ═══════════════════════════════════════════════════════════
//  [6al] v4.1.0 RnM SHIP INTERCEPTOR (v4.7.0: dialogue +
//        spawn-rate boost) — the easter-egg interceptor
//        (js/modes/EasterEggs/RnMShip/): enters off-screen
//        left flying right, turns around (sprite mirror) fully
//        off-screen right and patrols back left, looping until
//        destroyed; friendly bullets damage it (RNMSHIP.hp);
//        destruction drops a GUARANTEED Frenzy power-up at its
//        death coordinates (spawnGuaranteedDrop). The time-based
//        roll lives in EasterEgg.update (gated on state ===
//        'playing' — classic + SAR modes); v4.7.0: significantly
//        boosted (spawnChance 0.19, 8–15 s roll windows, 8 s
//        first roll, cap 5) and the "RnM SHIP INTERCEPTOR
//        INBOUND" spawn banner is replaced by the ship's
//        sequential Rick & Morty dialogue (RNMSHIP_DIALOGUE
//        through the #alert-banner 'dialogue' style).
// ═══════════════════════════════════════════════════════════

import { ROOT, TOOLS, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
  console.log('\n[6al] v4.1.0 RnM ship interceptor');
  // ─── Static surface (source + module) ───
  const src = fs.readFileSync(path.join(ROOT, 'js/modes/EasterEggs/RnMShip/RnMShip.js'), 'utf8');
  check('RnMShip: v4.1.0 header', src.includes('// Kitty Vs Everything — v4.1.0'));
  check('RnMShip: spawns off-screen left (x = -w - 40)', src.includes('this.x = -this.w - 40'));
  check('RnMShip: starts flying right (dir = 1)', src.includes('this.dir = 1'));
  check('RnMShip: turns around fully off-screen right (dir = -1)', src.includes('if (this.dir === 1 && this.x > g.viewW)') && src.includes('this.dir = -1'));
  check('RnMShip: patrols back fully off-screen left (dir = 1 loop)', src.includes('if (this.dir === -1 && this.x + this.w < 0)') && src.includes('this.dir = 1'));
  check('RnMShip: guaranteed Frenzy drop at death coordinates', src.includes("spawnGuaranteedDrop(g, 'frenzy', cx, cy)"));
  const artSrc = fs.readFileSync(path.join(ROOT, 'js/modes/EasterEggs/RnMShip/RnMShipArt.js'), 'utf8');
  check('RnMShipArt: asset key `rnms` via the AssetManager pipeline', artSrc.includes("RNMSHIP_ART_KEY = 'rnms'") && artSrc.includes('getSprite(RNMSHIP_ART_KEY)'));
  check('RnMShipArt: mirrors the sprite when patrolling back (dir < 0)', artSrc.includes('if (dir < 0) ctx.scale(-1, 1)'));
  const barrelSrc = fs.readFileSync(path.join(ROOT, 'js/modes/EasterEggs/RnMShip/index.js'), 'utf8');
  check('RnMShip barrel: exports RnMShip + RNMSHIP + art surface', barrelSrc.includes('export { default as RnMShip, RNMSHIP }') && barrelSrc.includes('drawRnMShip'));
  const { RnMShip, RNMSHIP } = await mod('js/modes/EasterEggs/RnMShip/index.js');
  check('RNMSHIP: rare roll + per-mission cap', RNMSHIP.spawnChance > 0 && RNMSHIP.spawnChance < 0.2 && RNMSHIP.maxPerRun >= 1, `got ${JSON.stringify(RNMSHIP)}`);
  check('RNMSHIP: shootable durability + patrol speed + uniform scale', RNMSHIP.hp > 0 && RNMSHIP.speed > 0 && RNMSHIP.scale > 0, `got ${JSON.stringify(RNMSHIP)}`);
  check('RNMSHIP: v4.7.0 spawn-rate boost (0.19 roll, 8–15 s windows, 8 s first, cap 5)',
    RNMSHIP.spawnChance >= 0.15 && RNMSHIP.rollIntervalMin <= 10 && RNMSHIP.rollIntervalMax <= 20 &&
    RNMSHIP.firstRollDelay <= 10 && RNMSHIP.maxPerRun >= 3, `got ${JSON.stringify(RNMSHIP)}`);
  check('RnMShip: v4.7.0 sequential dialogue lines (Rick → Morty → Rick)',
    src.includes('Come on Morty, 20 minutes! In and out!') &&
    src.includes('Aw geez, Rick, is that a snake?') &&
    src.includes("there's everything in space."));
  check('RnMShip: v4.7.0 dialogue uses the stylized banner tone', src.includes("tone: 'dialogue'"));
  const eggSrc = fs.readFileSync(path.join(ROOT, 'js/core/EasterEgg.js'), 'utf8');
  check('EasterEgg: rnms slot + maybeSpawnRnMShip roll (spawnChance + maxPerRun cap)', eggSrc.includes('rnms: null') && eggSrc.includes('maybeSpawnRnMShip') && eggSrc.includes('RNMSHIP.spawnChance') && eggSrc.includes('RNMSHIP.maxPerRun'));
  check('EasterEgg: roll gated on state === playing (classic + SAR modes)', eggSrc.includes("this.game.state === 'playing'"));
  check('EasterEgg: v4.7.0 "INTERCEPTOR INBOUND" spawn banner removed (dialogue plays from the ship)',
    !eggSrc.includes("bus.emit('banner', { text: 'RnM SHIP INTERCEPTOR INBOUND"));
  const devSrc = fs.readFileSync(path.join(ROOT, 'js/ui/DevPanel.js'), 'utf8');
  check('DevPanel: dev-rnms force-spawn button wired', devSrc.includes("getElementById('dev-rnms')") && devSrc.includes("switchEgg(g, 'rnms')"));
  check('DevPanel: v4.7.0 "INTERCEPTOR INBOUND" spawn banner removed',
    !devSrc.includes("bus.emit('banner', { text: 'RnM SHIP INTERCEPTOR INBOUND"));
  const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check('index.html: dev-rnms button in the Drops section', htmlSrc.includes('id="dev-rnms"'));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/asset-manifest.json'), 'utf8'));
  check('asset-manifest.json: rnms → RnMship-256x256.png', manifest.assets.rnms === 'RnMship-256x256.png');
  const ASSET_DIR = path.resolve(TOOLS, '..', '..', '.assets');
  check('.assets/RnMship-256x256.png exists', fs.existsSync(path.join(ASSET_DIR, 'RnMship-256x256.png')));
  const regSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');
  check('AssetSprites.js: registry carries the rnms key', regSrc.includes('rnms:'));

  // ─── Headless behavior (trajectory + guaranteed drop) ───
  const { default: EasterEgg, switchEgg } = await mod('js/core/EasterEgg.js');
  const { bus } = await mod('js/core/EventBus.js');
  const banners = [];
  const unsub = bus.on('banner', (e) => banners.push(e.text));
  const DT = 1 / 60;
  const makeGame = () => ({
    W: 1280, viewW: 1280, viewH: 720, H: 720,
    state: 'playing',
    bullets: [], powerups: [],
    particles: { burst() {} },
    shake: 0,
    player: { x: 640, y: 400 },
  });

  // A) trajectory: off-screen left → right → flip → left → flip back (loop)
  {
    banners.length = 0;
    const g = makeGame();
    const mgr = new EasterEgg(g);
    switchEgg(g, 'rnms');
    const ship = g.eggs.rnms;
    check('spawned off-screen left', !!ship && ship.x < 0, `x=${ship && ship.x.toFixed(1)}`);
    check('starts flying right (dir=1)', !!ship && ship.dir === 1);
    check('hp = maxHp (RNMSHIP.hp)', !!ship && ship.hp === RNMSHIP.hp && ship.maxHp === RNMSHIP.hp);
    let t = 0, flipRightAt = null, flipLeftAt = null, maxX = -1e9;
    while (g.eggs.rnms && t < 30) {
      mgr.update(DT);
      t += DT;
      const s = g.eggs.rnms;
      if (s) {
        maxX = Math.max(maxX, s.x);
        if (s.dir === -1 && flipRightAt === null) flipRightAt = t;
        if (s.dir === 1 && flipRightAt !== null && flipLeftAt === null) flipLeftAt = t;
      }
    }
    check('reached the right edge', maxX > g.viewW, `maxX=${maxX.toFixed(1)} (viewW=${g.viewW})`);
    check('turns around after crossing right (dir=-1)', flipRightAt !== null && flipRightAt < 8, `flipRightAt=${flipRightAt && flipRightAt.toFixed(2)}s`);
    check('patrols back and turns around again (dir=1 loop)', flipLeftAt !== null && flipLeftAt > flipRightAt, `flipLeftAt=${flipLeftAt && flipLeftAt.toFixed(2)}s`);
    check('still patrolling after 30 s (no pass limit — loops until destroyed)', !!g.eggs.rnms && g.eggs.rnms.alive);
    check('no drop on plain patrol (only destruction drops)', g.powerups.length === 0);
    check('v4.7.0: sequential RnM dialogue fires in order (Rick → Morty → Rick)',
      banners.length === 3 &&
        banners[0].includes('Come on Morty, 20 minutes! In and out!') &&
        banners[1].includes('Aw geez, Rick, is that a snake?') &&
        banners[2].includes("there's everything in space."),
      banners.join(' | '));
  }

  // B) destruction: friendly bullets → hp 0 → explosion + GUARANTEED frenzy at death point
  {
    banners.length = 0;
    const g = makeGame();
    const mgr = new EasterEgg(g);
    switchEgg(g, 'rnms');
    while (g.eggs.rnms && g.eggs.rnms.x < 100) mgr.update(DT); // fly until on-screen
    const ship = g.eggs.rnms;
    check('ship on-screen', !!ship && ship.x > 0 && ship.x < g.viewW, `x=${ship && ship.x.toFixed(1)}`);
    // Capture the TRUE death coordinates (the ship moves during the final
    // update before the killing blow lands).
    let deathCx = null, deathCy = null;
    const origDestroy = ship.destroy.bind(ship);
    ship.destroy = function () {
      deathCx = this.x + this.w / 2;
      deathCy = this.y + this.h / 2;
      return origDestroy();
    };
    const hit = (friendly = true, damage = 10) => {
      const s = g.eggs.rnms;
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      g.bullets.push({ x: cx, y: cy, alive: true, friendly, radius: 4, damage });
      mgr.update(DT);
    };
    hit(false); // enemy bullet — ignored
    check('enemy bullet ignored (hp stays full, bullet alive)',
      !!g.eggs.rnms && g.eggs.rnms.hp === RNMSHIP.hp && g.bullets[0].alive === true,
      `hp=${g.eggs.rnms && g.eggs.rnms.hp} bulletAlive=${g.bullets[0] && g.bullets[0].alive}`);
    while (g.eggs.rnms) {
      hit(true);
      if (g.bullets.length > 200) break; // safety
    }
    check('destroyed by friendly fire (slot freed)', g.eggs.rnms === null);
    check('destroyed flag set on the shot-down ship', ship.destroyed === true && ship.alive === false);
    check('GUARANTEED Frenzy drop spawned (exactly one)', g.powerups.length === 1, `got ${g.powerups.length}`);
    check('drop type is frenzy', g.powerups.length === 1 && g.powerups[0].type === 'frenzy', `got ${g.powerups[0] && g.powerups[0].type}`);
    check('drop at the death coordinates', g.powerups.length === 1 && deathCx !== null &&
      Math.abs(g.powerups[0].x - deathCx) < 0.01 && Math.abs(g.powerups[0].y - deathCy) < 0.01,
      `drop=(${g.powerups[0] && g.powerups[0].x.toFixed(1)}, ${g.powerups[0] && g.powerups[0].y.toFixed(1)}) death=(${deathCx && deathCx.toFixed(1)}, ${deathCy && deathCy.toFixed(1)})`);
    check('destruction banner fired', banners.some((b) => /RnM SHIP DOWN/i.test(b)), banners.join(' | '));
  }

  // C) rare roll: state-gated (no roll in the menu) + per-mission cap
  {
    const g = makeGame();
    g.state = 'menu';
    const mgr = new EasterEgg(g);
    for (let i = 0; i < Math.round(400 / DT); i++) mgr.update(DT); // 400 s of menu
    check('no roll while not playing (state-gated)', g.eggs.rnms === null && mgr.rnmsCount === 0);
    g.state = 'playing';
    mgr.rnmsRollTimer = 0.001; // force the next window
    mgr.rnmsCount = RNMSHIP.maxPerRun; // cap already reached
    for (let i = 0; i < Math.round(2 / DT); i++) mgr.update(DT);
    check('per-mission cap blocks the roll', g.eggs.rnms === null && mgr.rnmsCount === RNMSHIP.maxPerRun);
  }
  unsub();
}
// ═══════════════════════════════════════════════════════════
//  [6aj] v3.99.0 SEARCH & DESTROY — the world-space sector-journey
//        mode (js/modes/SearchAndDestroy/, E6 nested modules). The
//        player flies in SCREEN space (full Catship/weapon/drop
//        parity — the classic combat stack is untouched) while a
//        rotational background camera (SectorMap) pans + rotates a
//        large 2D sector grid. The sequenced journey runs left →
//        right: OPEN SPACE → THE BONEYARD → DEEP SECTOR, where
//        Eridath's Mom's House anchors the deep sector as a
//        persistent, shootable, enemy-spawning base (the objective).
//        A cockpit radar (RadarManager, F1) tracks enemies /
//        power-ups / the house. Destroying the house = victory.
//        Headless: the facade is driven directly (camera pan, zone
//        entry, house state, hudLabel, sarProgress/sarZoneFor).
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod, makeGame } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
  console.log('\n[6aj] v3.99.0 search & destroy (sector journey, source gates + headless)');
  {
    // ── Module existence (E6 nested mode) ──
    for (const f of [
      'js/modes/SearchAndDestroy/index.js',
      'js/modes/SearchAndDestroy/SectorMap.js',
      'js/modes/SearchAndDestroy/SectorSpawner.js',
      'js/modes/SearchAndDestroy/SectorCombatManager.js',
      'js/modes/SearchAndDestroy/RadarManager.js',
      'js/core/config/searchDestroy.js',
    ]) {
      check(`module exists: ${f}`, fs.existsSync(path.join(ROOT, f)));
    }

    const cfgSrc = fs.readFileSync(path.join(ROOT, 'js/core/config.js'), 'utf8');
    const cfgSardSrc = fs.readFileSync(path.join(ROOT, 'js/core/config/searchDestroy.js'), 'utf8');
    const gameSrc = fs.readFileSync(path.join(ROOT, 'js/core/Game.js'), 'utf8');
    const flightSrc = fs.readFileSync(path.join(ROOT, 'js/player/PlayerFlight.js'), 'utf8');
    const goSrc = fs.readFileSync(path.join(ROOT, 'js/core/game/GameOver.js'), 'utf8');
    const hudSrc = fs.readFileSync(path.join(ROOT, 'js/ui/HUD.js'), 'utf8');
    const mainSrc = fs.readFileSync(path.join(ROOT, 'js/core/main.js'), 'utf8');
    const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const cssSrc = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
    const devSrc = fs.readFileSync(path.join(ROOT, 'js/ui/DevPanel.js'), 'utf8');
    const flowSrc = fs.readFileSync(path.join(ROOT, 'js/core/game/StageFlow.js'), 'utf8');

    // ── Config surface (single tuning point) ──
    check('config/searchDestroy.js: SAR sector / start / camera tuning',
      cfgSardSrc.includes('SECTOR:') && cfgSardSrc.includes('START:') && cfgSardSrc.includes('CAMERA:') &&
      cfgSardSrc.includes('PAN_FACTOR') && cfgSardSrc.includes('ROTATION_INFLUENCE') &&
      cfgSardSrc.includes('TETHER_X') && cfgSardSrc.includes('TETHER_Y'));
    check('config/searchDestroy.js: the 3 journey zones (open / boneyard / deep)',
      cfgSardSrc.includes("id: 'open'") && cfgSardSrc.includes("id: 'boneyard'") && cfgSardSrc.includes("id: 'deep'"));
    check('config/searchDestroy.js: the house base tuning (HP / radius / spawn / victory)',
      cfgSardSrc.includes('HOUSE:') && cfgSardSrc.includes('HP:') && cfgSardSrc.includes('radius:') &&
      cfgSardSrc.includes('spawnMin') && cfgSardSrc.includes('victoryScore'));
    check('config/searchDestroy.js: ambient drops + cockpit radar tuning',
      cfgSardSrc.includes('DROPS:') && cfgSardSrc.includes('RADAR:') && cfgSardSrc.includes('RANGE') && cfgSardSrc.includes('KEY'));
    check('config/searchDestroy.js: sarProgress + sarZoneFor helpers',
      cfgSardSrc.includes('export function sarProgress') && cfgSardSrc.includes('export function sarZoneFor'));
    check('config.js: re-exports SAR / sarProgress / sarZoneFor',
      cfgSrc.includes("export { SAR, sarProgress, sarZoneFor } from './config/searchDestroy.js'"));

    // ── Game.js wiring ──
    check('Game.js: imports the SearchAndDestroy facade',
      gameSrc.includes("import SearchAndDestroy from '../modes/SearchAndDestroy/index.js'"));
    check('Game.js: mode field defaults to classic', gameSrc.includes("this.mode = 'classic'"));
    check('Game.js: start() branches on opts.mode === "sard"',
      gameSrc.includes("opts.mode === 'sard'") && gameSrc.includes('this.sard = new SearchAndDestroy(this)'));
    check('Game.js: SAR frees the ship from classic screen bounds (freeBounds)',
      gameSrc.includes('this.player.freeBounds = true'));
    check('Game.js: ticks sard.update(dt) in the playing loop',
      gameSrc.includes("if (this.mode === 'sard' && this.sard) this.sard.update(dt)"));
    check('Game.js: renders the sector background in place of the starfield',
      gameSrc.includes('this.sard.renderBackground(ctx)'));
    check('Game.js: renders the SAR HUD after the classic HUD',
      gameSrc.includes('this.sard.renderHud(ctx)'));
    check('Game.js: victory() method drives the SAR mission-complete',
      gameSrc.includes('victory() {') && gameSrc.includes("this.state = 'victory'"));

    // ── PlayerFlight: classic bounds opt-out ──
    check('PlayerFlight: p.freeBounds opts out of wrap/bounce (SAR camera tether)',
      flightSrc.includes('if (!p.freeBounds)'));

    // ── GameOver: the SAR victory state ──
    check('GameOver: the victory state swaps the title + log line',
      goSrc.includes("const victory = game.state === 'victory'") &&
      goSrc.includes('MISSION ACCOMPLISHED') && goSrc.includes("getElementById('go-title')"));

    // ── HUD: the SAR mode label ──
    check('HUD: the wave label is owned by the SAR facade in SAR mode',
      hudSrc.includes("if (g.mode === 'sard' && g.sard)") && hudSrc.includes('g.sard.hudLabel()'));

    // ── main.js: the SAR start button + mode-preserving retry ──
    check('main.js: wires the #sard-btn start control',
      mainSrc.includes("getElementById('sard-btn')") && mainSrc.includes("{ mode: 'sard' }"));
    check('main.js: retry preserves the active mode',
      mainSrc.includes("game.mode === 'sard' ? 'sard' : undefined"));

    // ── index.html: the SAR button + game-over title element ──
    check('index.html: the #sard-btn menu button exists', htmlSrc.includes('id="sard-btn"'));
    check('index.html: the game-over title carries the #go-title id', htmlSrc.includes('id="go-title"'));
    check('index.html: the dev-panel #dev-sard force-start button exists', htmlSrc.includes('id="dev-sard"'));

    // ── style.css: the SAR button + victory title ──
    check('style.css: styles the #sard-btn menu button', /#sard-btn\s*{/.test(cssSrc));
    check('style.css: recolors the victory game-over title', cssSrc.includes('#gameover-screen.victory h2'));

    // ── DevPanel: the SAR force-start control ──
    check('DevPanel: wires the #dev-sard force-start button',
      devSrc.includes("getElementById('dev-sard')") && devSrc.includes("{ mode: 'sard' }"));

    // ── StageFlow: restart keeps the active mode ──
    check('StageFlow: restartLevel preserves the SAR mode',
      flowSrc.includes("game.mode === 'sard' ? 'sard' : undefined"));

    // ── Headless behavior (the facade driven directly) ──
    const { default: SearchAndDestroy } = await mod('js/modes/SearchAndDestroy/index.js');
    const { SAR, sarProgress, sarZoneFor } = await mod('js/core/config.js');

    // sarProgress / sarZoneFor are pure helpers — verify the math.
    check('headless: sarProgress(start) = 0, sarProgress(house) = 1',
      sarProgress(SAR.START.x) === 0 && sarProgress(SAR.HOUSE.x) === 1);
    check('headless: sarProgress clamps outside the journey axis',
      sarProgress(0) === 0 && sarProgress(SAR.SECTOR.W) === 1);
    check('headless: sarZoneFor maps world x to the 3 zone bands',
      sarZoneFor(SAR.ZONES[0].x0) === 0 &&
      sarZoneFor((SAR.ZONES[1].x0 + SAR.ZONES[1].x1) / 2) === 1 &&
      sarZoneFor((SAR.ZONES[2].x0 + SAR.ZONES[2].x1) / 2) === 2);

    const game = makeGame();
    game.state = 'playing';
    game.player = { x: 640, y: 360, vx: 0, vy: 0, angle: 0, dead: false, freeBounds: true };
    game.enemies = [];
    game.powerups = [];
    game.bonusTargets = [];
    game.hazards = { list: [], spawnRandom: () => null };
    let victoryCalled = false;
    game.victory = () => { victoryCalled = true; };

    const sard = new SearchAndDestroy(game);
    check('headless: the camera starts at the SAR start coordinates',
      sard.map.cam.x === SAR.START.x && sard.map.cam.y === SAR.START.y && sard.map.cam.angle === 0);
    check('headless: the house base is created at full HP in the deep sector',
      sard.combat.house && sard.combat.house.hp === SAR.HOUSE.HP &&
      sard.combat.house.x === SAR.HOUSE.x && sard.combat.house.y === SAR.HOUSE.y);
    check('headless: the spawner is pre-entry (zone -1) before the first update',
      sard.spawner.zone === -1);

    // One update: the camera holds (no velocity) and the spawner enters zone 0.
    sard.update(0.016);
    check('headless: the first update enters OPEN SPACE (zone 0)', sard.spawner.zone === 0);
    const label = sard.hudLabel();
    check('headless: hudLabel() reads "SAR · <zone> · <pct>%"',
      /^SAR · OPEN SPACE · \d+%$/.test(label), `got "${label}"`);
    check('headless: the player world position starts at the SAR start coordinates',
      Math.abs(sard.map.playerWorld().x - SAR.START.x) < 1 &&
      Math.abs(sard.map.playerWorld().y - SAR.START.y) < 1);

    // Camera pan: a rightward screen velocity scrolls the world right.
    const camBefore = sard.map.cam.x;
    game.player.vx = 400;
    for (let i = 0; i < 10; i++) sard.update(0.016);
    check('headless: a rightward screen velocity pans the camera right',
      sard.map.cam.x > camBefore, `cam.x ${camBefore} → ${sard.map.cam.x}`);
    check('headless: the journey progress advances as the camera pans',
      sarProgress(sard.map.playerWorld().x) > 0);

    // Rotational camera: a nonzero heading eases the background rotation.
    // (50 frames keeps the spawner timers from expiring — no live spawns.)
    game.player.vx = 0;
    game.player.angle = Math.PI / 2; // facing down
    for (let i = 0; i < 50; i++) sard.update(0.016);
    check('headless: a nonzero heading rotates the background camera',
      Math.abs(sard.map.cam.angle) > 0.1, `angle=${sard.map.cam.angle}`);

    // ── House destruction + victory sequence ──
    // Park the camera on the house so the base is on screen (center), then
    // a friendly bullet at the house's screen position lands the killing blow.
    game.player.angle = 0;
    game.player.vx = 0; game.player.vy = 0;
    game.player.x = 640; game.player.y = 360;
    sard.map.cam.x = SAR.HOUSE.x;
    sard.map.cam.y = SAR.HOUSE.y;
    sard.map.cam.angle = 0;
    const h = sard.combat.house;
    h.hp = 1;
    game.bullets.length = 0;
    game.bullets.push({ x: 640, y: 360, friendly: true, damage: 10, radius: 5, alive: true });
    sard.update(0.016);
    check('headless: a friendly bullet destroys the house (victory sequence starts)',
      sard.combat.house.alive === false && sard.combat.victoryTimer > 0,
      `alive=${sard.combat.house.alive} victoryTimer=${sard.combat.victoryTimer}`);
    // Fast-forward the 3s victory countdown → Game.victory() fires.
    sard.combat.victoryTimer = 0.01;
    sard.update(0.016);
    check('headless: the victory countdown fires Game.victory()', victoryCalled === true);
  }
}

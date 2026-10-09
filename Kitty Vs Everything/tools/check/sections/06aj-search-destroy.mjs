// ═══════════════════════════════════════════════════════════
//  [6aj] v4.3.0 SEARCH & DESTROY — the world-space sector-journey
//        mode (js/modes/SearchAndDestroy/, E6 nested modules). The
//        player flies in SCREEN space (full Catship/weapon/drop
//        parity — the classic combat stack is untouched, PlayerFlight
//        stays sovereign) while the DISPLACEMENT-ACCUMULATOR camera
//        (SectorMap) tracks the player's screen offset against a dead
//        zone, accumulates the EXCESS delta into world coordinates
//        (worldX/worldY) and softly recenters the ship — the world
//        scrolls fluidly around the combat layer. Debris, hazards and
//        regional patrols are WORLD-ANCHORED at absolute world
//        coordinates (deterministic seeded layout). The journey runs
//        left → right: OPEN SPACE → THE BONEYARD → DEEP SECTOR, where
//        Eridath's Mom's House (the 512px .assets/Eridaths-Moms-House
//        landmark) anchors the deep sector as a persistent, shootable,
//        enemy-spawning base (the objective). A cockpit radar
//        (RadarManager, F1) tracks enemies / power-ups / the house.
//        Destroying the house = victory.
//
//  v4.3.0 additions gated here:
//    • SAR.STARFIELD (config/searchDestroy.js) — the multi-layer
//      parallax starfield (FAR / MID / NEAR tiled star layers, NEBULA
//      mid-depth dust, TRAILS foreground streaks, per-layer parallax
//      factor f + autonomous wind drift, modulo-wrapped tiles).
//    • SectorMap starfield — _makeStarLayers / _makeNebula /
//      _makeTrails + _updateStarfield / _drawStarfield (tiled layers,
//      constant visible density across the 64 km sector).
//    • SectorSpawner.worldMotion — the autonomous world-motion
//      registry: drops / asteroids / chasing enemies integrate in
//      screen space, the registry treats their screen-space delta as
//      world motion (capped per frame) and re-projects them back to
//      screen after the camera accumulator advances, so nothing
//      drifts relative to the world while the camera scrolls — and
//      drops keep falling while the ship holds still.
//        Headless: the facade is driven directly (displacement
//        accumulator, world-anchored layout, zone entry, house state,
//        hudLabel, sarProgress/sarZoneFor, starfield layers,
//        world-motion registry).
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod, makeGame } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
  console.log('\n[6aj] v4.3.0 search & destroy (parallax starfield + autonomous world motion)');
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
    const mapSrc = fs.readFileSync(path.join(ROOT, 'js/modes/SearchAndDestroy/SectorMap.js'), 'utf8');
    const spawnSrc = fs.readFileSync(path.join(ROOT, 'js/modes/SearchAndDestroy/SectorSpawner.js'), 'utf8');
    const gameSrc = fs.readFileSync(path.join(ROOT, 'js/core/Game.js'), 'utf8');
    const flightSrc = fs.readFileSync(path.join(ROOT, 'js/player/PlayerFlight.js'), 'utf8');
    const goSrc = fs.readFileSync(path.join(ROOT, 'js/core/game/GameOver.js'), 'utf8');
    const hudSrc = fs.readFileSync(path.join(ROOT, 'js/ui/HUD.js'), 'utf8');
    const mainSrc = fs.readFileSync(path.join(ROOT, 'js/core/main.js'), 'utf8');
    const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const cssSrc = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
    const devSrc = fs.readFileSync(path.join(ROOT, 'js/ui/DevPanel.js'), 'utf8');
    const flowSrc = fs.readFileSync(path.join(ROOT, 'js/core/game/StageFlow.js'), 'utf8');

    // ── Config surface (single tuning point, v4.0.0) ──
    check('config/searchDestroy.js: the displacement-accumulator camera tuning',
      cfgSardSrc.includes('SECTOR:') && cfgSardSrc.includes('START:') && cfgSardSrc.includes('CAMERA:') &&
      cfgSardSrc.includes('DEADZONE_X') && cfgSardSrc.includes('DEADZONE_Y') &&
      cfgSardSrc.includes('RECENTER') && cfgSardSrc.includes('CLAMP_MARGIN'));
    check('config/searchDestroy.js: the world-anchored layout tuning (v4.0.0)',
      cfgSardSrc.includes('WORLD:') && cfgSardSrc.includes('DEBRIS:') &&
      cfgSardSrc.includes('HAZARDS:') && cfgSardSrc.includes('PATROL:'));
    check('config/searchDestroy.js: the 3 journey zones (open / boneyard / deep)',
      cfgSardSrc.includes("id: 'open'") && cfgSardSrc.includes("id: 'boneyard'") && cfgSardSrc.includes("id: 'deep'"));
    check('config/searchDestroy.js: the house base tuning (HP / radius / spawn / victory)',
      cfgSardSrc.includes('HOUSE:') && cfgSardSrc.includes('HP:') && cfgSardSrc.includes('radius:') &&
      cfgSardSrc.includes('spawnMin') && cfgSardSrc.includes('victoryScore'));
    check('config/searchDestroy.js: ambient drops + cockpit radar tuning',
      cfgSardSrc.includes('DROPS:') && cfgSardSrc.includes('RADAR:') &&
      cfgSardSrc.includes('RANGE') && cfgSardSrc.includes('KEY'));
    check('config/searchDestroy.js: sarProgress + sarZoneFor helpers',
      cfgSardSrc.includes('export function sarProgress') && cfgSardSrc.includes('export function sarZoneFor'));
    check('config.js: re-exports SAR / sarProgress / sarZoneFor',
      cfgSrc.includes("export { SAR, sarProgress, sarZoneFor } from './config/searchDestroy.js'"));

    // ── v4.3.0 starfield config (SAR.STARFIELD) ──
    check('config/searchDestroy.js: SAR.STARFIELD block (v4.3.0)',
      cfgSardSrc.includes('STARFIELD:'));
    check('config/searchDestroy.js: STARFIELD.FAR / MID / NEAR star layers',
      cfgSardSrc.includes('FAR:') && cfgSardSrc.includes('MID:') && cfgSardSrc.includes('NEAR:'));
    check('config/searchDestroy.js: STARFIELD.NEBULA mid-depth dust',
      cfgSardSrc.includes('NEBULA:') && cfgSardSrc.includes('rMin') && cfgSardSrc.includes('rMax'));
    check('config/searchDestroy.js: STARFIELD.TRAILS foreground streaks',
      cfgSardSrc.includes('TRAILS:') && cfgSardSrc.includes('maxLen') && cfgSardSrc.includes('speedRef'));
    check('config/searchDestroy.js: per-layer parallax factor + wind drift',
      cfgSardSrc.includes('f: 0.22') && cfgSardSrc.includes('windX') && cfgSardSrc.includes('windY'));

    // ── v4.0.0 camera model (source gates) ──
    check('SectorMap: the displacement-accumulator camera (worldX/worldY + dead zone + soft recenter)',
      mapSrc.includes('this.worldX') && mapSrc.includes('this.worldY') &&
      mapSrc.includes('DEADZONE_X') && mapSrc.includes('RECENTER'));
    check('SectorMap: the camera never touches the ship velocity (PlayerFlight sovereign)',
      !mapSrc.includes('player.vx') && !mapSrc.includes('player.vy'));
    check('SectorSpawner: world-anchored spawners (anchors + world-locked projection)',
      spawnSrc.includes('debrisAnchors') && spawnSrc.includes('hazardAnchors') &&
      spawnSrc.includes('patrolSites') && spawnSrc.includes('worldToScreen'));

    // ── v4.3.0 starfield (SectorMap source gates) ──
    check('SectorMap: starfield layer builders (_makeStarLayers / _makeNebula / _makeTrails)',
      mapSrc.includes('_makeStarLayers') && mapSrc.includes('_makeNebula') && mapSrc.includes('_makeTrails'));
    check('SectorMap: starfield renderers (_drawStarLayer / _drawNebula / _drawStarTrails)',
      mapSrc.includes('_drawStarLayer') && mapSrc.includes('_drawNebula') && mapSrc.includes('_drawStarTrails'));
    check('SectorMap: tiled star layers (tile + mod wrap for constant density)',
      mapSrc.includes('tile') && mapSrc.includes('mod(st.x - offX, t)'));
    check('SectorMap: per-layer parallax factor (f) + autonomous wind drift',
      mapSrc.includes('f: s.f') && mapSrc.includes('windX') && mapSrc.includes('windY') &&
      mapSrc.includes('this.worldX * layer.f'));
    check('SectorMap: TRAILS streak opposite the player movement vector',
      mapSrc.includes('p.vx') && mapSrc.includes('p.vy') && mapSrc.includes('-pvx / speed'));

    // ── v4.3.0 autonomous world motion (SectorSpawner source gates) ──
    check('SectorSpawner: worldMotion registry (entity → world state)',
      spawnSrc.includes('worldMotion') && spawnSrc.includes('new Map()'));
    check('SectorSpawner: adoption pass (_adoptWorldEntities + _adoptWorld)',
      spawnSrc.includes('_adoptWorldEntities') && spawnSrc.includes('_adoptWorld'));
    check('SectorSpawner: world-motion step (_updateWorldMotion)',
      spawnSrc.includes('_updateWorldMotion'));
    check('SectorSpawner: auto mode (screen delta = world motion)',
      spawnSrc.includes("'auto'") && spawnSrc.includes('w.wx +=') && spawnSrc.includes('w.wy +='));
    check('SectorSpawner: drift mode (registry-owned world velocity)',
      spawnSrc.includes("'drift'") && spawnSrc.includes('w.vx * dt') && spawnSrc.includes('w.vy * dt'));
    check('SectorSpawner: per-frame delta cap (WORLD_MOTION_MAX_STEP)',
      spawnSrc.includes('WORLD_MOTION_MAX_STEP') && spawnSrc.includes('clamp('));
    check('SectorSpawner: re-projection after the camera (worldToScreen)',
      spawnSrc.includes('worldToScreen(w.wx, w.wy)'));
    check('SectorSpawner: adoption back-projection (screenToWorld)',
      spawnSrc.includes('screenToWorld(entity.x, entity.y)'));
    check('SectorSpawner: registry wired into update() (adoption + step)',
      spawnSrc.includes('this._adoptWorldEntities()') && spawnSrc.includes('this._updateWorldMotion(dt)'));

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

    // ── PlayerFlight: classic bounds opt-out (sovereign) ──
    check('PlayerFlight: p.freeBounds opts out of wrap/bounce (SAR camera layer)',
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
    const si = await mod('js/modes/SearchAndDestroy/index.js');
    const SearchAndDestroy = si.default;
    const { SAR, sarProgress, sarZoneFor } = await mod('js/core/config.js');
    const sm = await mod('js/modes/SearchAndDestroy/SectorMap.js');
    const sp = await mod('js/modes/SearchAndDestroy/SectorSpawner.js');
    const sc = await mod('js/modes/SearchAndDestroy/SectorCombatManager.js');
    const sr = await mod('js/modes/SearchAndDestroy/RadarManager.js');
    check('SAR modules stamp VERSION v4.3.0',
      si.VERSION === 'v4.3.0' && sm.VERSION === 'v4.3.0' && sp.VERSION === 'v4.3.0' &&
      sc.VERSION === 'v4.3.0' && sr.VERSION === 'v4.3.0');

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
    check('headless: the camera starts at the SAR start coordinates (worldX/worldY)',
      sard.map.worldX === SAR.START.x && sard.map.worldY === SAR.START.y);
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

    // ── v4.3.0 starfield: all layers built (tiled, parallax, wind) ──
    const map = sard.map;
    check('headless: the starfield has 3 star layers (FAR / MID / NEAR)',
      Array.isArray(map.layers) && map.layers.length === 3);
    check('headless: each star layer is tiled with stars + parallax factor + wind',
      map.layers.every(l => l.tile > 0 && l.stars.length > 0 && typeof l.f === 'number' &&
        l.f >= 0 && l.f <= 1 && typeof l.windX === 'number' && typeof l.windY === 'number'));
    check('headless: the parallax factors increase with depth (FAR < MID < NEAR)',
      map.layers[0].f < map.layers[1].f && map.layers[1].f < map.layers[2].f);
    check('headless: the NEBULA dust layer is built (tiled puffs + parallax)',
      map.nebula && map.nebula.tile > 0 && map.nebula.puffs.length > 0 &&
      typeof map.nebula.f === 'number');
    check('headless: the TRAILS foreground layer is built (tiled streaks)',
      map.trails && map.trails.tile > 0 && map.trails.trails.length > 0);
    check('headless: the starfield is deterministic (seeded PRNG)',
      new sm.default(game).layers[0].stars[0].x === map.layers[0].stars[0].x);

    // ── v4.3.0 autonomous world motion: drops fall, nothing drifts ──
    const spawner = sard.spawner;
    check('headless: the worldMotion registry is a Map', spawner.worldMotion instanceof Map);
    // A synthetic drop at the screen center (classic falling: y += vy·dt).
    const drop = { x: 640, y: 300, vy: 70, alive: true, t: 0 };
    game.powerups.push(drop);
    spawner._adoptWorldEntities();
    check('headless: the drop is adopted into worldMotion', spawner.worldMotion.has(drop));
    const dw0 = spawner.worldMotion.get(drop);
    const dwx0 = dw0.wx, dwy0 = dw0.wy;
    // Frame 1: the classic layer integrates the fall (screen space), then
    // the registry advances the world position by that delta and
    // re-projects (camera stationary — the screen position is unchanged
    // by the re-projection, so the drop simply keeps falling).
    const dt = 0.016;
    drop.y += drop.vy * dt;
    spawner._updateWorldMotion(dt);
    check('headless: the drop keeps falling while the ship holds still',
      drop.y > 300 + drop.vy * dt * 0.9, `y=${drop.y}`);
    check('headless: the drop world-y advanced by its fall',
      spawner.worldMotion.get(drop).wy > dwy0);
    // Frame 2: the camera scrolls right by 100px (the displacement
    // accumulator) — the drop's world position must NOT jump, and its
    // screen position must shift LEFT (world-pinned, no drift).
    const sxBefore = drop.x;
    map.worldX += 100;
    spawner._updateWorldMotion(dt);
    check('headless: the drop stays world-pinned during camera scroll (no drift)',
      drop.x < sxBefore - 90 && drop.x > sxBefore - 110,
      `x ${sxBefore} → ${drop.x}`);
    check('headless: the drop world-x is unchanged by the camera scroll',
      Math.abs(spawner.worldMotion.get(drop).wx - dwx0) < 1,
      `wx ${dwx0} → ${spawner.worldMotion.get(drop).wx}`);

    // A synthetic chasing enemy: its own screen delta is world motion.
    const enemy = { x: 400, y: 400, alive: true, vx: 0, vy: 0 };
    game.enemies.push(enemy);
    spawner._adoptWorldEntities();
    check('headless: the enemy is adopted into worldMotion', spawner.worldMotion.has(enemy));
    // The enemy chases: a screen-space delta of +20x this frame.
    enemy.x += 20;
    const ewxBefore = spawner.worldMotion.get(enemy).wx;
    spawner._updateWorldMotion(dt);
    check('headless: the enemy world-x advanced by its screen delta',
      spawner.worldMotion.get(enemy).wx > ewxBefore);
    // Camera scroll: the enemy re-projects (shifts left), world unchanged.
    const exBefore = enemy.x;
    map.worldX += 50;
    spawner._updateWorldMotion(dt);
    check('headless: the enemy stays world-pinned during camera scroll',
      enemy.x < exBefore - 40 && enemy.x > exBefore - 60,
      `x ${exBefore} → ${enemy.x}`);
    // A boss-wrap artifact (a 1300px screen jump) must be capped: the
    // world position may advance at most WORLD_MOTION_MAX_STEP per frame.
    enemy.x += 1300;
    const ewxWrap = spawner.worldMotion.get(enemy).wx;
    spawner._updateWorldMotion(dt);
    check('headless: a wrap/teleport jump is capped (no world artifact)',
      spawner.worldMotion.get(enemy).wx - ewxWrap <= 48,
      `wx ${ewxWrap} → ${spawner.worldMotion.get(enemy).wx}`);

    // v4.3.0 regression: SUSTAINED camera scroll (many consecutive frames)
    // must not corrupt the world position — the camera's own re-projection
    // shift is never counted as entity motion (prevX/prevY track the
    // re-projected screen position, so next frame's delta is the entity's
    // own classic motion only).
    const pinned = { x: 400, y: 400, alive: true, vx: 0, vy: 0 };
    game.enemies.push(pinned);
    spawner._adoptWorldEntities();
    const pinWx0 = spawner.worldMotion.get(pinned).wx;
    for (let i = 0; i < 12; i++) {
      map.worldX += 50; // the camera scrolls right, every frame
      spawner._updateWorldMotion(dt);
    }
    check('headless: sustained camera scroll does not corrupt the world position (no drift)',
      Math.abs(spawner.worldMotion.get(pinned).wx - pinWx0) < 0.001,
      `wx ${pinWx0} → ${spawner.worldMotion.get(pinned).wx}`);
    check('headless: the pinned enemy tracks the camera exactly (screen == worldToScreen)',
      Math.abs(pinned.x - (spawner.worldMotion.get(pinned).wx - sard.map.worldX + 640)) < 0.001,
      `x=${pinned.x}`);

    // ── Displacement accumulator (v4.0.0 camera model) ──
    // Inside the dead zone the camera holds (the ship flies freely).
    const wxHold = sard.map.worldX, wyHold = sard.map.worldY;
    for (let i = 0; i < 5; i++) sard.update(0.016);
    check('headless: the camera holds inside the dead zone (no velocity)',
      sard.map.worldX === wxHold && sard.map.worldY === wyHold);

    // Push the ship 200px past the dead zone: the EXCESS delta is
    // accumulated into world coordinates and the ship is softly
    // recentered (pulled back toward the center).
    const wxBefore = sard.map.worldX;
    game.player.x = 640 + 1280 * SAR.CAMERA.DEADZONE_X + 200;
    const pxBefore = game.player.x;
    sard.update(0.016);
    check('headless: the excess delta is accumulated into world coordinates',
      sard.map.worldX > wxBefore, `worldX ${wxBefore} → ${sard.map.worldX}`);
    check('headless: the ship is softly recentered (pulled back toward the center)',
      game.player.x < pxBefore, `x ${pxBefore} → ${game.player.x}`);

    // Sustained flight: the world scrolls (displacement accumulates) and
    // the journey progress advances. (The flight integration is simulated
    // — PlayerFlight itself is sovereign and never driven here.)
    const wxSustained0 = sard.map.worldX;
    let monotonic = true;
    let wxPrev = wxSustained0;
    for (let i = 0; i < 30; i++) {
      game.player.x += 400 * 0.016;
      sard.update(0.016);
      if (sard.map.worldX < wxPrev) monotonic = false;
      wxPrev = sard.map.worldX;
    }
    check('headless: sustained flight scrolls the world (displacement accumulates)',
      sard.map.worldX > wxSustained0 && monotonic,
      `worldX ${wxSustained0} → ${sard.map.worldX}`);
    check('headless: the journey progress advances with the world scroll',
      sarProgress(sard.map.playerWorld().x) > 0);
    check('headless: the ship stays on screen during the scroll',
      game.player.x >= 0 && game.player.x <= 1280 && game.player.y >= 0 && game.player.y <= 720);

    // ── World-anchored layout (v4.0.0) ──
    const boneZone = SAR.ZONES[1];
    check('headless: the debris anchors are world-anchored in THE BONEYARD',
      sard.map.debrisAnchors.length === SAR.WORLD.DEBRIS.count &&
      sard.map.debrisAnchors.every(a => a.x >= boneZone.x0 && a.x <= boneZone.x1 &&
        a.y >= 0 && a.y <= SAR.SECTOR.H));
    check('headless: the hazard anchors are world-anchored in THE BONEYARD',
      sard.map.hazardAnchors.length === SAR.WORLD.HAZARDS.count &&
      sard.map.hazardAnchors.every(a => a.x >= boneZone.x0 && a.x <= boneZone.x1 &&
        a.y >= 0 && a.y <= SAR.SECTOR.H));
    check('headless: the patrol sites are world-anchored per journey zone',
      sard.map.patrolSites.length === SAR.ZONES.length &&
      sard.map.patrolSites.every((sites, zi) => sites.length === SAR.WORLD.PATROL.perZone &&
        sites.every(s => s.x >= SAR.ZONES[zi].x0 && s.x <= SAR.ZONES[zi].x1 &&
          s.y >= 0 && s.y <= SAR.SECTOR.H)));
    const sard2 = new SearchAndDestroy(game);
    check('headless: the world layout is deterministic (seeded PRNG)',
      sard2.map.debrisAnchors[0].x === sard.map.debrisAnchors[0].x &&
      sard2.map.hazardAnchors[0].x === sard.map.hazardAnchors[0].x &&
      sard2.map.patrolSites[1][0].x === sard.map.patrolSites[1][0].x);

    // ── House destruction + victory sequence ──
    // Park the camera on the house so the base is on screen (center), then
    // a friendly bullet at the house's screen position lands the killing blow.
    game.player.angle = 0;
    game.player.x = 640; game.player.y = 360;
    sard.map.worldX = SAR.HOUSE.x;
    sard.map.worldY = SAR.HOUSE.y;
    sard.map._accInit = false; // re-anchor the accumulator at the parked camera
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

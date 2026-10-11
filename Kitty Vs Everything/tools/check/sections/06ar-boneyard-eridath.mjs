// ═══════════════════════════════════════════════════════════
//  [6ar] v4.24.0 BONEYARD ENCOUNTER — Eridath's Mom's House
//        4-phase scripted encounter (headless simulation):
//        Phase 1 line forms (12s) → Phase 2 four rush lines (8s)
//        → Phase 3 controls locked + house descent (3s) →
//        Phase 4 the fight (15s survival gate OR 1/16 damage cap)
//        → house teleport-out (2.2s) → complete.
//        Stage-owned: top-exit cull, bullet-vs-house collision,
//        bone columns draw. The house is a sub-module (NOT a
//        registered BONUS_STAGES entry, NOT in game.enemies).
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
console.log('\n[6ar] v4.24.0 Boneyard encounter — Eridath\'s Mom\'s House (headless)');
{
  const { BONUS, TIERS } = await mod('js/core/config.js');
  const { default: BoneYardBonus } = await mod('js/levels/BoneYardBonus.js');
  const { default: EridathsMomsHouse } = await mod('js/levels/EridathsMomsHouse.js');
  const { default: SkeletonEnemy } = await mod('js/enemies/SkeletonEnemy.js');
  const { default: HumanEnemy } = await mod('js/enemies/HumanEnemy.js');
  const { BONUS_STAGES } = await mod('js/levels/LevelRegistry.js');
  const { bus } = await mod('js/core/EventBus.js');
  const mobTier = Object.keys(TIERS).find((k) => !TIERS[k].special);
  const H = BONUS.BONE_YARD_HOUSE;

  // ── Source gates ──
  const houseSrc = fs.readFileSync(path.join(ROOT, 'js/levels/EridathsMomsHouse.js'), 'utf8');
  const lrSrc = fs.readFileSync(path.join(ROOT, 'js/levels/LevelRegistry.js'), 'utf8');
  check('house: sub-module — NOT registered in BONUS_STAGES/LevelRegistry',
    !lrSrc.includes('EridathsMomsHouse') && Object.keys(BONUS_STAGES).sort().join(',') === 'boneyard,internet');
  check('house: VERSION v1.0.0 + 1/16 damage cap + maxDumps',
    houseSrc.includes("VERSION = 'v1.0.0'") && houseSrc.includes('damageCapFrac') && houseSrc.includes('maxDumps'));
  const bySrc = fs.readFileSync(path.join(ROOT, 'js/levels/BoneYardBonus.js'), 'utf8');
  check('stage: 4-phase machine + control lock + top cull + house collision',
    bySrc.includes('_updatePhase1') && bySrc.includes('_updatePhase2') &&
    bySrc.includes('_updatePhase3') && bySrc.includes('_updatePhase4') &&
    bySrc.includes('controlsLocked') && bySrc.includes('e.y > -120') && bySrc.includes('_houseBulletHits'));
  const skSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/SkeletonEnemy.js'), 'utf8');
  check('skeleton: extends EnemyBase, shamble + lazy bone-chunk shot',
    Object.getPrototypeOf(SkeletonEnemy.prototype).constructor.name === 'EnemyBase' &&
    skSrc.includes("VERSION = 'v1.0.0'") && skSrc.includes('shamblePhase') && skSrc.includes('fireAtPlayer'));
  const huSrc = fs.readFileSync(path.join(ROOT, 'js/enemies/HumanEnemy.js'), 'utf8');
  check('human: rushMode (bottom→top surge, no firing)',
    huSrc.includes('this.rushMode = false') && huSrc.includes('if (this.rushMode) {') && huSrc.includes('if (this.rushMode) return;'));

  // ── Skeleton behavior (headless) ──
  let shots = 0;
  const gsk = { W: 1280, H: 720, viewW: 1280, viewH: 720, player: { x: 640, y: 600, dead: false }, spawnEnemyBullet() { shots++; } };
  const sk = new SkeletonEnemy({ type: 'skeleton', tier: mobTier, x: 640, y: 200, game: gsk });
  check('skeleton: stats from ENEMY_TYPES.skeleton (no hardcoding)',
    sk.speed === 1.5 * 60 && sk.hp === 30 && sk.damage === 12 && sk.fireRate === 1.8,
    `speed=${sk.speed} hp=${sk.hp} dmg=${sk.damage} fr=${sk.fireRate}`);
  const sky0 = sk.y;
  sk.move(1 / 60, 1);
  check('skeleton: shambles toward the player', sk.y > sky0, `y0=${sky0} y1=${sk.y}`);
  sk.y = 300; // into the firing band
  sk.shootTimer = 0;
  sk.update(1 / 60);
  check('skeleton: lazy bone-chunk shot fires (classic attack loop)', shots >= 1, `shots=${shots}`);

  // ── Human rushMode behavior (headless) ──
  const hu = new HumanEnemy({ type: 'human', tier: mobTier, x: 300, y: 600, game: gsk });
  hu.rushMode = true;
  const shotsBefore = shots;
  const hy0 = hu.y;
  hu.move(1 / 60, 1);
  check('human rushMode: surges upward (bottom→top)', hu.y < hy0, `y0=${hy0} y1=${hu.y}`);
  hu.shootTimer = 0;
  hu.update(1 / 60);
  check('human rushMode: never fires', shots === shotsBefore, `shots=${shots}`);

  // ── House unit behavior (headless) ──
  const mkGame = () => ({
    W: 1280, viewW: 1280, viewH: 720, H: 720,
    bullets: [], enemies: [], bonusTargets: [],
    score: 0, multiplier: 1, shake: 0, time: 0,
    particles: { burst() {} },
    player: { x: 640, y: 620, dead: false, controlsLocked: false },
    spawnEnemyBullet() {},
  });
  let exited = false;
  const g3 = mkGame();
  const house3 = new EridathsMomsHouse(g3, { onExit: () => { exited = true; } });
  check('house: spawns at the top of the view (off-screen)', house3.y === -H.size && house3.state === 'descending');
  house3.update(0.5);
  check('house: descending toward settleY', house3.state === 'descending' && house3.y < house3.settleY && house3.y > -H.size);
  for (let i = 0; i < H.descentTime * 60; i++) house3.update(1 / 60);
  check('house: settles at settleY * viewH after descentTime',
    house3.state === 'settled' && Math.abs(house3.y - H.settleY * 720) < 1, `y=${house3.y} settle=${H.settleY * 720}`);
  // Dumps: humans + skeletons, capped at maxDumps concurrent.
  for (let i = 0; i < 25 * 60; i++) house3.update(1 / 60);
  check('house: dumps humans AND skeletons into game.enemies',
    house3.dumped.some((e) => e.type === 'human') && house3.dumped.some((e) => e.type === 'skeleton'),
    `dumped=${house3.dumped.length}`);
  check('house: dumped enemies live in game.enemies (stage reaps them)',
    house3.dumped.every((e) => g3.enemies.includes(e)));
  check('house: maxDumps concurrent cap holds',
    house3.dumped.filter((e) => e.alive).length <= H.maxDumps,
    `alive=${house3.dumped.filter((e) => e.alive).length}`);
  // Damage cap: 1/16 of hp, hard ceiling.
  const g2 = mkGame();
  const house2 = new EridathsMomsHouse(g2, {});
  house2.applyDamage(100000);
  check('house: damage capped at hp * 1/16', house2.damaged === H.hp * H.damageCapFrac && house2.capReached === true, `damaged=${house2.damaged}`);
  house2.applyDamage(100000);
  check('house: cap is a hard ceiling (no overflow)', house2.damaged === H.hp * H.damageCapFrac, `damaged=${house2.damaged}`);
  // Teleport-out.
  house3.startTeleport();
  house3.update(0.5);
  check('house: startTeleport → teleporting state', house3.state === 'teleporting');
  for (let i = 0; i < H.teleportTime * 60; i++) house3.update(1 / 60);
  check('house: teleport complete → exiting + onExit fired', house3.state === 'exiting' && exited === true);

  // ── FULL ENCOUNTER SIMULATION (all 4 phases) ──
  const banners = [];
  const offBanner = bus.on('banner', (b) => banners.push(b));
  const dt = 1 / 60;
  const game = mkGame();
  const yard = new BoneYardBonus(game);
  yard.init();
  check('phase 1: active + line/rain armed + dialogue line 0 queued',
    yard.phase === 1 && yard.active === true &&
    yard.dialogueQueue.length === 1 && yard.dialogueQueue[0].text === BONUS.BONE_YARD_DIALOGUE[0]);
  let t2 = null, t3 = null, t4 = null, tDone = null;
  let lockedAt3 = null, lockedAt4 = null;
  let drewDuringFight = false;
  let maxRushersOnScreen = 0;
  const baseCtx = {
    save() {}, restore() {}, translate() {}, scale() {}, rotate() {},
    beginPath() {}, closePath() {}, arc() {}, ellipse() {}, fill() {}, stroke() {},
    fillRect() {}, strokeRect() {}, clearRect() {}, moveTo() {}, lineTo() {},
    drawImage() {}, fillText() {}, strokeText() {}, setLineDash() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    measureText: () => ({ width: 10 }),
  };
  const mockCtx = new Proxy(baseCtx, { get: (t, k) => (k in t ? t[k] : () => {}), set: () => true });
  for (let i = 0; i < 60 * 90 && !yard.complete; i++) {
    const prev = yard.phase;
    yard.update(dt);
    for (const e of game.enemies) e.update(dt);
    game.time += dt;
    maxRushersOnScreen = Math.max(maxRushersOnScreen, game.enemies.filter((e) => e.rushMode === true).length);
    if (yard.phase !== prev) {
      if (yard.phase === 2) { t2 = game.time; }
      if (yard.phase === 3) { t3 = game.time; lockedAt3 = game.player.controlsLocked; }
      if (yard.phase === 4) { t4 = game.time; lockedAt4 = game.player.controlsLocked; yard.draw(mockCtx); drewDuringFight = true; }
    }
    if (yard.complete) { tDone = game.time; break; }
  }
  check('phase 1 → 2 at ~12s (BONE_YARD_PHASE1)', t2 !== null && t2 >= 11.5 && t2 <= 12.6, `t2=${t2}`);
  check('phase 2 → 3 at ~20s (PHASE1 + PHASE2)', t3 !== null && t3 >= 19.5 && t3 <= 20.6, `t3=${t3}`);
  check('phase 3 → 4 at ~23s (descentTime after house spawn)', t4 !== null && t4 >= 22.5 && t4 <= 23.6, `t4=${t4}`);
  check('phase 3: player controls LOCKED while the house descends', lockedAt3 === true, `lockedAt3=${lockedAt3}`);
  check('phase 4: player controls UNLOCKED for the fight', lockedAt4 === false, `lockedAt4=${lockedAt4}`);
  check('encounter completes after the 15s survival gate + teleport',
    tDone !== null && tDone >= 39.5 && tDone <= 41.5, `tDone=${tDone}`);
  check('stage: complete + isComplete (LevelRegistry handoff)', yard.complete === true && yard.isComplete() === true);
  check('stage: house is NOT in game.enemies (stage-owned collision)', !game.enemies.includes(yard.house));
  check('stage: draw() renders columns + house headless-safe (no crash)', drewDuringFight === true);
  // Dialogue: all 5 lines, tone 'dialogue', in order.
  const dialogueBanners = banners.filter((b) => b.tone === 'dialogue');
  check('dialogue: all 5 lines played (tone dialogue, in order)',
    dialogueBanners.length === BONUS.BONE_YARD_DIALOGUE.length &&
    BONUS.BONE_YARD_DIALOGUE.every((line, i) => dialogueBanners[i] && dialogueBanners[i].text === line),
    `got ${dialogueBanners.length}`);
  check('dialogue: subtitles are length-based (>= 2.2s)', dialogueBanners.every((b) => b.duration >= 2.2 && b.duration <= 4.5));
  // Victory: banner + survival score bonus.
  check('victory: banner + 10000×multiplier survival bonus',
    banners.some((b) => b.tone === 'good' && b.text.includes('VICTORY')) && game.score === 10000 * game.multiplier,
    `score=${game.score}`);
  // Rush lines: 4 lanes cycled, rushMode humans surge through (top-culled after).
  check('phase 2: rush lines surged (rushMode humans on screen, 4 lanes cycled)',
    maxRushersOnScreen >= 1 && yard.rushLine >= BONUS.BONE_YARD_RUSH_LINES,
    `maxRushers=${maxRushersOnScreen} rushLine=${yard.rushLine}`);
  // Cleanup: lock reset, state cleared.
  yard.cleanup();
  check('cleanup: control lock reset + house/enemies/bones cleared',
    game.player.controlsLocked === false && yard.house === null &&
    game.enemies.length === 0 && game.bonusTargets.length === 0);
  offBanner();

  // ── Stage-owned mechanics (isolated) ──
  const g5 = mkGame();
  const yard5 = new BoneYardBonus(g5);
  yard5.init();
  const rusher = { y: 100, alive: true, update() {} };
  g5.enemies.push(rusher);
  yard5.update(dt);
  check('top cull: on-screen enemies survive', g5.enemies.includes(rusher));
  rusher.y = -200;
  yard5.update(dt);
  check('top cull: top-exiting enemies are reaped by the stage', !g5.enemies.includes(rusher));

  const g4 = mkGame();
  const yard4 = new BoneYardBonus(g4);
  yard4.init();
  for (let i = 0; i < (BONUS.BONE_YARD_PHASE1 + BONUS.BONE_YARD_PHASE2 + 1) * 60; i++) {
    yard4.update(dt);
    for (const e of g4.enemies) e.update(dt);
  }
  check('phase 3: house spawned + descending', !!yard4.house && yard4.house.state === 'descending');
  for (let i = 0; i < (H.descentTime + 1) * 60; i++) {
    yard4.update(dt);
    for (const e of g4.enemies) e.update(dt);
  }
  const h4 = yard4.house;
  check('phase 4: house settled + dumping', h4.settled === true && yard4.phase === 4);
  const bullet = { x: h4.x, y: h4.y, radius: 5, damage: 50, alive: true, friendly: true };
  g4.bullets.push(bullet);
  yard4.update(dt);
  check('house collision: friendly bullet hits the house (stage-owned)', bullet.alive === false && h4.damaged === 50, `damaged=${h4.damaged}`);
  const enemyBullet = { x: h4.x, y: h4.y, radius: 5, damage: 50, alive: true, friendly: false };
  g4.bullets.push(enemyBullet);
  yard4.update(dt);
  check('house collision: enemy bullets ignore the house', enemyBullet.alive === true && h4.damaged === 50, `damaged=${h4.damaged}`);
  yard4.cleanup();
  check('house collision: cleanup reaps the house\'s dumps', g4.enemies.length === 0 && yard4.house === null);
}

}

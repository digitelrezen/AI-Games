#!/usr/bin/env node
// tools/test-ship-egg.mjs — v3.28.0 temporary headless test: Planet Express ship easter egg.
// Run: node tools/test-ship-egg.mjs
// Stubs the browser globals, then drives ShipEasterEgg's state machine:
//   A) traversal: off-screen left → right → flip → left, ×3 patterns → despawn
//   B) destruction: friendly bullets → hp 30→0 → explosion + 'robot' power-up drop
//   C) Bender: kill-based dialogue (v3.29.0) — trigger → line 0, intro delay
//      → line 1, kills 1–4 → lines 2–5, kill 4 ends the egg (aimbot off +
//      exit slide), no timer-based exit, Combat.js kill hook wired
import { readFileSync } from 'node:fs';

// ── Browser stubs (must exist before the game modules load) ─────────────────
globalThis.window = globalThis;
globalThis.Image = class {
  set src(v) { /* headless: never decodes — sprite getters stay null */ }
  get src() { return ''; }
};
const fakeCtx = new Proxy({}, {
  get(t, p) { return (p === 'canvas') ? {} : () => {}; },
  set() { return true; },
});
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx }) };

const { default: EasterEgg, switchEgg } = await import('../Kitty Vs Everything/js/core/EasterEgg.js');
const { bus } = await import('../Kitty Vs Everything/js/core/EventBus.js');

const banners = [];
bus.on('banner', (e) => banners.push(e.text));

let failures = 0;
function check(name, cond, extra = '') {
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (extra ? `  [${extra}]` : ''));
  if (!cond) failures++;
}

function makeGame() {
  const bursts = [];
  return {
    W: 960, H: 540,
    bullets: [],
    powerups: [],
    particles: { burst: (x, y, opts) => bursts.push({ x, y, opts }) },
    shake: 0,
    player: { x: 480, y: 400 },
    _bursts: bursts,
  };
}

const DT = 1 / 60;

// ── A) traversal ─────────────────────────────────────────────────────────────
console.log('\n[A] Traversal: off-screen left → right → flip → left, ×3 patterns → despawn');
{
  banners.length = 0;
  const g = makeGame();
  const mgr = new EasterEgg(g);
  switchEgg(g, 'ship');
  const ship = g.eggs.ship;
  check('spawned off-screen left', !!ship && ship.x < 0, `x=${ship && ship.x.toFixed(1)}`);
  check('starts flying right (dir=1)', !!ship && ship.dir === 1);
  check('hp = 30 / maxHp = 30', !!ship && ship.hp === 30 && ship.maxHp === 30);
  check('pass = 0', !!ship && ship.pass === 0);

  let t = 0, flipAt = null, doneAt = null, lastPass = 0, maxX = -1e9, minX = 1e9;
  while (g.eggs.ship && t < 60) {
    mgr.update(DT);
    t += DT;
    const s = g.eggs.ship;
    if (s) {
      maxX = Math.max(maxX, s.x); minX = Math.min(minX, s.x);
      if (s.dir === -1 && flipAt === null) flipAt = t;
      lastPass = s.pass;
    } else doneAt = t;
  }
  check('reached the right edge', maxX > g.W, `maxX=${maxX.toFixed(1)} (W=${g.W})`);
  check('flips to left after crossing right', flipAt !== null && flipAt < 6.5, `flipAt=${flipAt && flipAt.toFixed(2)}s`);
  // read pass from the captured ship reference — the manager frees the slot on the same frame pass hits 3
  check('completed 3 full patterns', ship.pass === 3, `passes=${ship.pass}`);
  check('despawns after 3rd pattern (~27s)', doneAt !== null && doneAt > 25 && doneAt < 30, `doneAt=${doneAt && doneAt.toFixed(2)}s`);
  check('manager freed the slot', g.eggs.ship === null);
  check('no power-up dropped on plain despawn', g.powerups.length === 0);
  check('no banner on plain despawn', banners.length === 0, banners.join(' | '));
}

// ── B) destruction ───────────────────────────────────────────────────────────
console.log('\n[B] Destruction: friendly bullets → hp 30→0 → explosion + robot drop');
{
  banners.length = 0;
  const g = makeGame();
  const mgr = new EasterEgg(g);
  switchEgg(g, 'ship');
  while (g.eggs.ship && g.eggs.ship.x < 100) mgr.update(DT); // fly until on-screen
  const ship = g.eggs.ship;
  check('ship on-screen', !!ship && ship.x > 0 && ship.x < g.W, `x=${ship && ship.x.toFixed(1)}`);

  const hit = (friendly = true, damage = 10) => {
    const s = g.eggs.ship;
    const w = 422 * s.scale, h = 159 * s.scale;
    g.bullets.push({ x: s.x + w / 2, y: s.y + h / 2, alive: true, friendly, radius: 4, damage });
    mgr.update(DT);
  };

  hit();
  check('hit 1: hp 30→20', !!g.eggs.ship && g.eggs.ship.hp === 20, `hp=${g.eggs.ship && g.eggs.ship.hp}`);
  check('bullet consumed', g.bullets[0].alive === false);
  hit();
  check('hit 2: hp 20→10', !!g.eggs.ship && g.eggs.ship.hp === 10, `hp=${g.eggs.ship && g.eggs.ship.hp}`);
  hit();
  check('hit 3: destroyed (hp<=0)', !g.eggs.ship || g.eggs.ship.hp <= 0);
  check('manager freed the slot', g.eggs.ship === null);
  check('explosion particles burst', g._bursts.length >= 2, `bursts=${g._bursts.length}`);
  check('screen shake applied', g.shake >= 10, `shake=${g.shake}`);
  check("banner: 'Bite My Shiney Metal Ass!'", banners.includes('Bite My Shiney Metal Ass!'), banners.join(' | '));
  check("robot power-up dropped", g.powerups.length === 1 && g.powerups[0].type === 'robot',
    `powerups=${g.powerups.map(p => p.type).join(',')}`);
  const pu = g.powerups[0];
  check('power-up near ship center', !!pu && Math.abs(pu.x - (ship.x + 422 * ship.scale / 2)) < 60,
    `pu.x=${pu && pu.x.toFixed(1)} shipX≈${(ship.x + 422 * ship.scale / 2).toFixed(1)}`);
  check('power-up alive', !!pu && pu.alive === true);
}

console.log('\n[B2] Enemy bullets must NOT damage the ship');
{
  banners.length = 0;
  const g = makeGame();
  const mgr = new EasterEgg(g);
  switchEgg(g, 'ship');
  while (g.eggs.ship && g.eggs.ship.x < 100) mgr.update(DT);
  const s = g.eggs.ship;
  const w = 422 * s.scale, h = 159 * s.scale;
  g.bullets.push({ x: s.x + w / 2, y: s.y + h / 2, alive: true, friendly: false, radius: 4, damage: 99 });
  mgr.update(DT);
  check('enemy bullet ignored (hp stays 30, bullet alive)',
    !!g.eggs.ship && g.eggs.ship.hp === 30 && g.bullets[0].alive === true,
    `hp=${g.eggs.ship && g.eggs.ship.hp} bulletAlive=${g.bullets[0].alive}`);
}

// ── C) Bender: kill-based dialogue (v3.29.0) ─────────────────────────────────
console.log('\n[C] Bender: kill-based dialogue (v3.29.0) — trigger/intro/kills/exit');
{
  banners.length = 0;
  const src = readFileSync(new URL('../Kitty Vs Everything/js/core/EasterEgg.js', import.meta.url), 'utf8');
  const combatSrc = readFileSync(new URL('../Kitty Vs Everything/js/combat/Combat.js', import.meta.url), 'utf8');
  check('BENDER_SCALE = 0.5', /const BENDER_SCALE = 0\.5;/.test(src));
  check('no armReach / ARM_REACH_MAX / ARM_EXTEND / BENDER_ARM_LEN refs',
    !/armReach|ARM_REACH_MAX|ARM_EXTEND|BENDER_ARM_LEN/.test(src));
  check('cigar arm drawn at uniform scale', /const aw = BENDER_ARM_W \* BENDER_SCALE;/.test(src));
  check('body drawn at uniform scale (no stretch factor)',
    /const h = BENDER_BODY_H \* BENDER_SCALE;/.test(src) && !/BENDER_SCALE \* this\.armReach/.test(src));
  // v3.29.0: kill-based constants, no timer remnants
  check('BENDER_KILLS = 4 (exported)', /export const BENDER_KILLS = 4;/.test(src));
  check('BENDER_INTRO_DELAY = 2 s', /const BENDER_INTRO_DELAY = 2;/.test(src));
  const dlgBlock = (src.split('BENDER_DIALOGUE = [')[1] || '').split('];')[0];
  const dlgLines = dlgBlock.split('\n').filter((l) => /^\s*["']/.test(l));
  check('BENDER_DIALOGUE: 6 lines, first + last correct',
    dlgLines.length === 6 &&
    dlgLines[0].includes('I\'m your Aimbot.') &&
    dlgLines[5].includes('go get drunk.'));
  check('no BENDER_TIME / PARTING_QUIPS / timeLeft (timer flow removed)',
    !/BENDER_TIME|PARTING_QUIPS|timeLeft/.test(src));
  check('Combat.js routes kills: game.aimbot?.onEnemyKilled?.(enemy, owner)',
    /game\.aimbot\?\.onEnemyKilled\?\.\(enemy, owner\)/.test(combatSrc));

  const g = makeGame();
  const mgr = new EasterEgg(g);
  const bender = () => g.eggs.bender;
  const step = (secs) => { for (let i = 0; i < Math.round(secs / DT) && bender(); i++) mgr.update(DT); };

  // trigger → line 0
  banners.length = 0;
  switchEgg(g, 'bender');
  check('trigger: on screen + aimbot active',
    !!bender() && bender().onScreen && bender().aimbotActive && bender().active);
  check('trigger: line 0 "I\'m your Aimbot."', banners.includes("I'm your Aimbot."), banners.join(' | '));
  check('trigger: killCount 0, dialogueStage 0',
    !!bender() && bender().killCount === 0 && bender().dialogueStage === 0);

  // intro delay (no kill first) → line 1
  banners.length = 0;
  step(1.5);
  check('1.5 s: still line 0 (intro not due yet)', bender().dialogueStage === 0 && banners.length === 0);
  step(0.6); // t ≈ 2.1 s ≥ BENDER_INTRO_DELAY
  check('2.1 s: line 1 "Shoot that guy!"',
    bender().dialogueStage === 1 && banners.includes('Shoot that guy!'), banners.join(' | '));

  // kills 1–4 advance the dialogue (kill k → line 1+k)
  const lines = ['Great, now shoot that guy!', 'Great, great, now aim a little to the left.',
    'Boom! Headshot!', "Ok that's enough, I have to go get drunk."];
  for (let k = 1; k <= 4; k++) {
    banners.length = 0;
    mgr.onEnemyKilled({ x: 100, y: 100 }, g.player);
    check(`kill ${k}: line ${1 + k} "${lines[k - 1]}"`,
      bender().killCount === k && bender().dialogueStage === 1 + k && banners.includes(lines[k - 1]),
      `killCount=${bender() && bender().killCount} stage=${bender() && bender().dialogueStage} [${banners.join(' | ')}]`);
  }
  check('kill 4: aimbot disabled (active + aimbotActive false)',
    !bender().active && !bender().aimbotActive);
  check('kill 4: still on screen (exit slide)', bender().onScreen);

  // draw smoke across the exit slide
  let threw = null;
  try {
    for (let i = 0; i < 120 && bender(); i++) { mgr.update(DT); mgr.draw(fakeCtx); } // 2 s ≥ BENDER_EXIT (1 s)
  } catch (e) { threw = e; }
  check('exit slide draw (headless) no-throw', threw === null, threw && String(threw));
  check('bender slot freed after exit slide', bender() === null);
}

// ── C2) No timer-based exit ──────────────────────────────────────────────────
console.log('\n[C2] No timer-based exit: 15 s idle keeps the egg active');
{
  banners.length = 0;
  const g = makeGame();
  const mgr = new EasterEgg(g);
  switchEgg(g, 'bender');
  for (let i = 0; i < Math.round(15 / DT) && g.eggs.bender; i++) mgr.update(DT);
  check('after 15 s (no kills): still active + on screen',
    !!g.eggs.bender && g.eggs.bender.active && g.eggs.bender.onScreen);
  check('after 15 s: killCount still 0', !!g.eggs.bender && g.eggs.bender.killCount === 0);
  check('after 15 s: only the two intro lines shown',
    banners.length === 2 && banners.includes("I'm your Aimbot.") && banners.includes('Shoot that guy!'),
    banners.join(' | '));
}

// ── C3) Early kill skips the intro line ──────────────────────────────────────
console.log('\n[C3] Kill before the intro delay skips line 1');
{
  banners.length = 0;
  const g = makeGame();
  const mgr = new EasterEgg(g);
  switchEgg(g, 'bender');
  mgr.onEnemyKilled({ x: 100, y: 100 }, g.player); // kill at t ≈ 0
  check('early kill: line 2 shown (line 1 skipped)',
    g.eggs.bender.dialogueStage === 2 && banners.includes('Great, now shoot that guy!'),
    banners.join(' | '));
  for (let i = 0; i < Math.round(3 / DT) && g.eggs.bender; i++) mgr.update(DT); // past the 2 s intro delay
  check('intro line never fires after the kill', !banners.includes('Shoot that guy!'), banners.join(' | '));
}

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

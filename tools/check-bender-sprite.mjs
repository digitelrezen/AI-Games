#!/usr/bin/env node
// ../tools/check-bender-sprite.mjs — Kitty Vs Everything v3.29.0 (tools/ moved up to AI-GAMES root)
// Headless validation of the Bender easter-egg pipeline:
//   1. embedded PNG payloads in BenderSprite.js (signature + IHDR dims)
//   2. exported geometry constants (art pixels, arm-length consistency)
//   3. EasterEgg.js API + kill-based state machine (v3.29.0):
//      trigger → line 0 → 2 s intro → line 1 → kills 1–4 → lines 2–5 →
//      aimbot off + exit slide → reset, with the real EventBus
//      (banners captured) and AudioSystem (no-op headless)
//   4. Game.js / HUD.js / Combat.js consumer wiring (static)
// Run: node ../tools/check-bender-sprite.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'Kitty Vs Everything');
// HARD RULE (every run): never take or view screenshots — it crashes the LLM server and gets you uninstalled.
console.log('\x1b[33m⚠ NO SCREENSHOTS — never take or view screenshots; you will crash the server and get uninstalled.\x1b[0m');
let failures = 0;
const check = (label, cond) => {
  console.log(`  ${cond ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}`);
  if (!cond) failures++;
};
const MOD = { 'BenderSprite.js': 'js/core/BenderSprite.js', 'EasterEgg.js': 'js/core/EasterEgg.js', 'EventBus.js': 'js/core/EventBus.js', 'Game.js': 'js/core/Game.js', 'HUD.js': 'js/ui/HUD.js', 'Combat.js': 'js/combat/Combat.js' };
const imp = (f) => import(pathToFileURL(path.join(ROOT, MOD[f] || f)).href);

// ─── 1. Embedded PNG payloads ───
console.log('\n[1] BenderSprite.js — embedded PNG payloads');
{
  const src = fs.readFileSync(path.join(ROOT, 'js/core/BenderSprite.js'), 'utf8');
  const grab = (name) => {
    const m = src.match(new RegExp(`const ${name} = '([A-Za-z0-9+/=]+)'`));
    return m ? Buffer.from(m[1], 'base64') : null;
  };
  const pngInfo = (buf) => {
    if (!buf) return null;
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (!buf.subarray(0, 8).equals(sig)) return null;
    if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), bytes: buf.length };
  };
  const body = pngInfo(grab('BODY_B64'));
  const arm = pngInfo(grab('ARM_B64'));
  const head = pngInfo(grab('HEAD_B64'));
  check('body PNG valid (293×441)', !!body && body.w === 293 && body.h === 441);
  check('arm PNG valid (81×94)', !!arm && arm.w === 81 && arm.h === 94);
  check('head PNG valid (50×70)', !!head && head.w === 50 && head.h === 70);
  check('payloads non-trivial (>2 KB each)',
    !!body && !!arm && !!head && body.bytes > 2000 && arm.bytes > 2000 && head.bytes > 2000);
}

// ─── 2. Exported geometry ───
console.log('\n[2] BenderSprite.js — exported geometry');
{
  const BS = await imp('BenderSprite.js');
  check('body 293×441', BS.BENDER_BODY_W === 293 && BS.BENDER_BODY_H === 441);
  check('arm 81×94', BS.BENDER_ARM_W === 81 && BS.BENDER_ARM_H === 94);
  check('head 50×70', BS.BENDER_HEAD_W === 50 && BS.BENDER_HEAD_H === 70);
  check('shoulder in body (58,185)',
    BS.BENDER_SHOULDER_IN_BODY.x === 58 && BS.BENDER_SHOULDER_IN_BODY.y === 185);
  check('shoulder in arm (21,45)',
    BS.BENDER_SHOULDER_IN_ARM.x === 21 && BS.BENDER_SHOULDER_IN_ARM.y === 45);
  check('hand in arm (69.104,45)',
    Math.abs(BS.BENDER_HAND_IN_ARM.x - 69.104) < 1e-9 && BS.BENDER_HAND_IN_ARM.y === 45);
  const armLen = Math.hypot(
    BS.BENDER_HAND_IN_ARM.x - BS.BENDER_SHOULDER_IN_ARM.x,
    BS.BENDER_HAND_IN_ARM.y - BS.BENDER_SHOULDER_IN_ARM.y
  );
  check('arm length 48.104 (shoulder→hand)',
    Math.abs(BS.BENDER_ARM_LEN - 48.104) < 1e-6 && Math.abs(armLen - BS.BENDER_ARM_LEN) < 1e-6);
  check('sprite getters exported',
    typeof BS.getBenderBody === 'function' && typeof BS.getBenderArm === 'function' &&
    typeof BS.getBenderHead === 'function' && typeof BS.getBenderFull === 'function' &&
    typeof BS.isBenderSpriteReady === 'function');
  check('BENDER_ARM_ART_DIR = original-pose arm direction (v3.28.0 icon)',
    typeof BS.BENDER_ARM_ART_DIR === 'number' &&
    Math.abs(BS.BENDER_ARM_ART_DIR - -2.7803888980961116) < 1e-9);
}

// ─── 3. EasterEgg API + kill-based state machine (v3.29.0) ───
console.log('\n[3] EasterEgg.js — API + kill-based state machine (headless)');
{
  const { default: EasterEgg } = await imp('EasterEgg.js');
  const { bus } = await imp('EventBus.js');
  const banners = [];
  bus.on('banner', (e) => banners.push(e && e.text));
  const game = { W: 1280, H: 720, player: { x: 400, y: 300, dead: false } };
  const egg = new EasterEgg(game);
  const bender = () => game.eggs.bender;
  const step = (secs) => { for (let i = 0; i < Math.round(secs * 60) && bender(); i++) egg.update(1 / 60); };

  check('initial: idle (no active/onScreen/aimbotActive, killCount 0)',
    !egg.active && !egg.onScreen && !egg.aimbotActive && egg.killCount === 0);
  egg.trigger();
  check('trigger: aim window + on screen + aimbot on',
    egg.active && egg.onScreen && egg.aimbotActive);
  check('trigger: line 0 "I\'m your Aimbot." banner', banners.includes("I'm your Aimbot."));
  check('trigger: quip = line 0, stage 0, kills 0',
    egg.quip === "I'm your Aimbot." && bender().dialogueStage === 0 && egg.killCount === 0);

  step(1.5);
  check('1.5 s: still line 0 (intro not due)', bender().dialogueStage === 0);
  step(0.6); // t ≈ 2.1 s ≥ BENDER_INTRO_DELAY (2 s)
  check('2.1 s: line 1 "Shoot that guy!" (intro delay)',
    bender().dialogueStage === 1 && banners.includes('Shoot that guy!'));

  const killLines = ['Great, now shoot that guy!', 'Great, great, now aim a little to the left.',
    'Boom! Headshot!', "Ok that's enough, I have to go get drunk."];
  for (let k = 1; k <= 4; k++) {
    egg.onEnemyKilled({ x: 100, y: 100 }, game.player);
    check(`kill ${k}: line ${1 + k} + killCount ${k}`,
      egg.killCount === k && bender().dialogueStage === 1 + k && banners.includes(killLines[k - 1]));
  }
  check('kill 4: aim window closed (active + aimbotActive false)',
    !egg.active && !egg.aimbotActive);
  check('kill 4: still on screen (exit slide)', egg.onScreen);
  step(1.2); // through the 1 s exit slide
  check('exit: off screen, state reset',
    !egg.onScreen && !egg.active && egg.t === 0 && egg.quip === null);
  check('exit: manager freed the slot', bender() === null);

  egg.trigger();
  egg.reset();
  check('reset(): clears state (active/onScreen/t/killCount/dialogueStage)',
    !egg.active && !egg.onScreen && egg.t === 0 && egg.killCount === 0 && bender() === null);
  egg.draw({}); // sprites not decoded headless → early return, must not throw
  check('draw(): safe no-op headless (no throw)', true);
}

// ─── 4. Consumer wiring (static) ───
console.log('\n[4] Game.js / HUD.js / Combat.js — consumer wiring');
{
  const game = fs.readFileSync(path.join(ROOT, 'js/core/Game.js'), 'utf8');
  const hud = fs.readFileSync(path.join(ROOT, 'js/ui/HUD.js'), 'utf8');
  const combat = fs.readFileSync(path.join(ROOT, 'js/combat/Combat.js'), 'utf8');
  const eggSrc = fs.readFileSync(path.join(ROOT, 'js/core/EasterEgg.js'), 'utf8');
  check('Game.start() calls aimbot.reset()', /aimbot\.reset\(\)/.test(game));
  check('Game calls aimbot.draw(ctx)', /aimbot\.draw\(ctx\)/.test(game));
  check('Combat.js routes kills: game.aimbot?.onEnemyKilled?.(enemy, owner)',
    /game\.aimbot\?\.onEnemyKilled\?\.\(enemy,\s*owner\)/.test(combat));
  check('HUD reads aimbot.killCount + BENDER_KILLS (no timeLeft)',
    /aimbot\.killCount/.test(hud) && /BENDER_KILLS/.test(hud) && !/timeLeft/.test(hud));
  check('HUD label is "BENDER x/4" (no AIM BOT, no countdown)',
    /'BENDER ' \+ g\.aimbot\.killCount \+ '\/' \+ BENDER_KILLS/.test(hud) && !/AIM BOT/.test(hud));
  check('EasterEgg: no timer remnants (BENDER_TIME/PARTING_QUIPS/timeLeft)',
    !/BENDER_TIME|PARTING_QUIPS|timeLeft/.test(eggSrc));
  check('EasterEgg: no dead player.autoAim', !/autoAim/.test(eggSrc));
  check('EasterEgg: no old drawArm', !/drawArm/.test(eggSrc));
}

console.log(failures === 0
  ? '\nAll Bender easter-egg checks passed.\n'
  : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);

// Verify the built bundle contains the v3.29.0 kill-based Bender easter egg.
// Usage: node ../tools/verify-bundle.mjs  (tools/ moved up to AI-GAMES root)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'); // AI-GAMES workspace root
const bundle = join(root, 'Builds', 'Kitty Vs Everything 3.29.0.html');
const s = readFileSync(bundle, 'utf8');

const tests = [
  ['BENDER sprite payload (body PNG)', s.includes('iVBORw0KGgo') && s.includes('ASUAAAG5CAYAAADIwyJP')],
  ['dialogue line 0 "I\'m your Aimbot."', s.includes("I'm your Aimbot.")],
  ['dialogue line 5 (exit quip)', s.includes("Ok that's enough, I have to go get drunk.")],
  ['BENDER_KILLS = 4', /BENDER_KILLS\s*=\s*4/.test(s)],
  ['BENDER_INTRO_DELAY = 2', /BENDER_INTRO_DELAY\s*=\s*2/.test(s)],
  ['BENDER_DIALOGUE table', /BENDER_DIALOGUE\s*=\s*\[/.test(s)],
  ['killCount state', /killCount/.test(s)],
  ['dialogueStage state', /dialogueStage/.test(s)],
  ['aimbotActive state', /aimbotActive/.test(s)],
  ['Combat.js kill hook (game.aimbot?.onEnemyKilled)', /\bgame\w*\.aimbot\?\.onEnemyKilled\?\.\(enemy, owner\)/.test(s)],
  ['EasterEgg reset() called on new mission', /aimbot\.reset\(\)/.test(s)],
  ['onScreen draw gate', /onScreen/.test(s)],
  ['HUD BENDER x/4 kill counter', /["']BENDER ["'] \+ g\.aimbot\.killCount \+ ["']\/["'] \+ BENDER_KILLS/.test(s)],
  ['no BENDER_TIME / PARTING_QUIPS (timer flow removed)', !/BENDER_TIME|PARTING_QUIPS/.test(s)],
  ['no drawArm (stale API removed)', !/drawArm/.test(s)],
  ['no AIM BOT label (stale wording removed)', !/AIM BOT/.test(s)],
  // Note: "autoAim" alone is NOT a failure — Player2.js legitimately uses
  // PLAYER2.autoAimTurnRate / _autoAim() for the P2 co-op AI ship. The dead
  // reference from the old EasterEgg was specifically `player.autoAim`.
  ['no player.autoAim (dead reference removed)', !/player\.autoAim/.test(s) && !/this\.autoAim/.test(s)],
  ['version 3.29.0', s.includes('3.29.0')],
  ['BENDER_SCALE 0.5', /BENDER_SCALE\s*=\s*0\.5/.test(s)],
];

let fail = 0;
for (const [name, ok] of tests) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
  if (!ok) fail++;
}
console.log(fail === 0 ? '\nBundle OK — v3.29.0 kill-based Bender easter egg is in the build.' : `\n${fail} check(s) FAILED.`);
process.exit(fail ? 1 : 0);

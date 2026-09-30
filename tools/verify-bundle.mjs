// Verify the built single-file bundle is valid and contains the current
// milestone's features. The version is read from package.json so this always
// checks the latest build. Usage: node ../tools/verify-bundle.mjs (tools/ at AI-GAMES root)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'); // AI-GAMES workspace root
const pkg = JSON.parse(readFileSync(join(root, 'Kitty Vs Everything', 'package.json'), 'utf8'));
const VER = String(pkg.version || '');
const bundle = join(root, 'Builds', `Kitty Vs Everything ${VER}.html`);
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
  ['BENDER_SCALE 0.5', /BENDER_SCALE\s*=\s*0\.5/.test(s)],
  // ── v3.45.0 clean catship (yellow shield bubble + purple Nova meter) ──
  ['v3.45.0: yellow shield bubble (SHIELD_BUBBLE_RADIUS=48)', /SHIELD_BUBBLE_RADIUS\s*=\s*48/.test(s) && s.includes('rgba(255, 213, 79')],
  ['v3.45.0: shield-break shatter burst', s.includes('const shieldBefore = this.shield') && s.includes('#ffd54f')],
  ['v3.45.0: Nova meter (superCharge + ultimateCooldown + nova-ready)', s.includes('p.superCharge') && s.includes('p.ultimateCooldown') && s.includes('nova-ready')],
  ['v3.45.0: purple Nova CSS (#7c4dff)', s.includes('#7c4dff')],
  [`version ${VER}`, s.includes(VER)],
];

let fail = 0;
for (const [name, ok] of tests) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
  if (!ok) fail++;
}
console.log(fail === 0 ? `\nBundle OK — v${VER} build verified (Bender easter egg + clean catship).` : `\n${fail} check(s) FAILED.`);
process.exit(fail ? 1 : 0);

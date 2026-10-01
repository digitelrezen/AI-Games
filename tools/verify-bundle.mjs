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
  // ── v3.47.0 key-triggered Synergy Explosion (T / - P1, , P2) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes, so every pattern below is quote-tolerant (['"]). KeyT stays in
  // the bundle legitimately (synergy's default bind) — only the old
  // TestAimbot `e.code !== 'KeyT'` hotkey must be gone.
  ['v3.47.0: synergy key gate in PlayerFleet (wasPressedAction)', /input\.wasPressedAction\(['"]synergy['"]\)/.test(s)],
  ['v3.47.0: no 10s auto-fire (in-charge superWeapon removed)', !/superCharge\s*>=\s*1\s*\)\s*\{\s*player\.superCharge\s*=\s*0;\s*player\.superWeapon\(\);/.test(s)],
  ['v3.47.0: Keybinds synergy action (KeyT / Minus)', /synergy:\s*\[\s*['"]KeyT['"]\s*,\s*['"]Minus['"]\s*\]/.test(s)],
  ['v3.47.0: P2 synergy default (Comma)', /synergy:\s*\[\s*['"]Comma['"]\s*\]/.test(s)],
  ['v3.47.0: TestAimbot on F8 (KeyT hotkey gone)', /e\.code\s*!==\s*['"]F8['"]/.test(s) && !/e\.code\s*!==\s*['"]KeyT['"]/.test(s) && s.includes('F8 to disengage')],
  ['v3.47.0: NOVA slot key label tracks synergy', /this\._slotLabel\(e\.novaSlot,\s*['"]synergy['"]\)/.test(s)],
  // ── v3.48.0 procedural aim reticle (Crosshair.js) ──
  ['v3.48.0: Crosshair reticle module (circles + dot + ticks)', /Crosshair\s*=\s*class/.test(s) && /R_OUTER\s*=\s*16/.test(s) && /DOT_R\s*=\s*2\.6/.test(s)],
  ['v3.48.0: crosshair defaults (on + 64px offset, 24–160 limits)', /crosshair:\s*true/.test(s) && /crosshairOffset:\s*\{\s*min:\s*24,\s*max:\s*160,\s*def:\s*64/.test(s)],
  ['v3.48.0: reticle drawn in Game render', s.includes('this.crosshair.draw(ctx)')],
  ['v3.48.0: settings toggle + dev slider wired', s.includes('set-crosshair') && s.includes('dev-crosshair-offset')],
  ['v3.49.0: butterfly top-down sprite registered (asset dims 128×83)', /butterfly:\s*\{\s*w:\s*128,\s*h:\s*83\s*\}/.test(s)],
  // ── v3.50.0 space shuttle enemy (17th species, regular waves only) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['"]).
  ['v3.50.0: shuttle sprite dims 128×60', /shuttle:\s*\{\s*w:\s*128,\s*h:\s*60\s*\}/.test(s)],
  ['v3.50.0: shuttle in ENEMY_TYPES (Space Shuttle, glide pattern)', /shuttle:\s*\{\s*name:\s*["']Space Shuttle["']/.test(s)],
  ['v3.50.0: WAVE.SPECIES_COUNT = 17', /SPECIES_COUNT:\s*17/.test(s)],
  ['v3.50.0: shuttle registered in EnemyFactory REGISTRY', /shuttle:\s*ShuttleEnemy/.test(s)],
  ['v3.50.0: WaveManager species pool = ENEMY_TYPES keys', s.includes('this.species = Object.keys(ENEMY_TYPES)')],
  ['v3.50.0: Bone Yard humanoid allowlist (["human"] only)', /BONE_YARD_HUMANOID_TYPES\s*=\s*\[\s*["']human["']\s*\]/.test(s)],
  // ── v3.51.0 jewel shading (frenzy / extra-life / shield drops) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['"]).
  ['v3.51.0: PowerUp VERSION = v3.51.0 (esbuild may suffix: VERSION3)', /VERSION\d*\s*=\s*['"]v3\.51\.0['"]/.test(s)],
  ['v3.51.0: drawJewelDrop gem pipeline (source-atop depth + lighter glow)', /function drawJewelDrop\(/.test(s) && s.includes('source-atop') && s.includes('lighter')],
  ['v3.51.0: jewel buffer is headless-guarded (no DOM → base only)', /typeof document\s*===\s*['"]undefined['"]/.test(s)],
  ['v3.51.0: life/shield/frenzy route through the jewel pass (def + 3 call sites)', (s.match(/drawJewelDrop\(/g) || []).length >= 4],
  [`version ${VER}`, s.includes(VER)],
];

let fail = 0;
for (const [name, ok] of tests) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
  if (!ok) fail++;
}
console.log(fail === 0 ? `\nBundle OK — v${VER} build verified (Bender easter egg + clean catship + shuttle species).` : `\n${fail} check(s) FAILED.`);
process.exit(fail ? 1 : 0);

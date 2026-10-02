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
  ['v3.56.0: shield ring clears the guns (SHIELD_BUBBLE_RADIUS=60, thin rim)', /SHIELD_BUBBLE_RADIUS\s*=\s*60/.test(s) && s.includes('rgba(255, 213, 79') && /ctx\.lineWidth\s*=\s*1\.5/.test(s)],
  ['v3.56.0: FC panel + minimized bar yellow theme (scoped amber borders)', s.includes('#fc-dashboard .fc-meter') && s.includes('#5c4a1e') && s.includes('#3d3218')],
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
  ['v3.55.0: crosshair defaults (on + 140px offset, 140–340 limits)', /crosshair:\s*true/.test(s) && /crosshairOffset:\s*\{\s*min:\s*140,\s*max:\s*340,\s*def:\s*140/.test(s)],
  ['v3.55.0: dev slider range 140–340 (index.html attributes)', /id=["']dev-crosshair-offset["']\s+min=["']140["']\s+max=["']340["']/.test(s)],
  ['v3.55.0: reticle offset clamped in Crosshair.draw (LIMITS)', /Math\.max\(\w+\.min,\s*Math\.min\(\w+\.max,\s*SETTINGS\.crosshairOffset\)\)/.test(s)],
  ['v3.48.0: reticle drawn in Game render', s.includes('this.crosshair.draw(ctx)')],
  ['v3.48.0: settings toggle + dev slider wired', s.includes('set-crosshair') && s.includes('dev-crosshair-offset')],
  ['v3.49.0: butterfly top-down sprite registered (asset dims 128×83)', /butterfly:\s*\{\s*w:\s*128,\s*h:\s*83\s*\}/.test(s)],
  // ── v3.50.0 space shuttle enemy (17th species, regular waves only) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['"]).
  ['v3.50.0: shuttle sprite dims 128×60', /shuttle:\s*\{\s*w:\s*128,\s*h:\s*60\s*\}/.test(s)],
  ['v3.50.0: shuttle in ENEMY_TYPES (Space Shuttle, glide pattern)', /shuttle:\s*\{\s*name:\s*["']Space Shuttle["']/.test(s)],
  ['v3.52.0: WAVE.SPECIES_COUNT = 18', /SPECIES_COUNT:\s*18/.test(s)],
  ['v3.50.0: shuttle registered in EnemyFactory REGISTRY', /shuttle:\s*ShuttleEnemy/.test(s)],
  ['v3.50.0: WaveManager species pool = ENEMY_TYPES keys', s.includes('this.species = Object.keys(ENEMY_TYPES)')],
  ['v3.50.0: Bone Yard humanoid allowlist (["human"] only)', /BONE_YARD_HUMANOID_TYPES\s*=\s*\[\s*["']human["']\s*\]/.test(s)],
  // ── v3.51.0 jewel shading (frenzy / extra-life / shield drops) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['"]).
  // Release-version pin: the IIFE emits Game.js's VERSION as
  // `var VERSION<n> = "vX.Y.Z"` (esbuild suffixes colliding top-level
  // constants; unused module VERSION exports are tree-shaken, so this
  // tracks the Game.js emission, not PowerUp's).
  [`v${VER}: release VERSION pin in bundle (Game.js emission)`,
    new RegExp(`VERSION\\d*\\s*=\\s*['"]v${VER.replace(/\./g, '\\.')}['"]`).test(s)],
  ['v3.51.0: drawJewelDrop gem pipeline (source-atop depth + lighter glow)', /function drawJewelDrop\(/.test(s) && s.includes('source-atop') && s.includes('lighter')],
  ['v3.51.0: jewel buffer is headless-guarded (no DOM → base only)', /typeof document\s*===\s*['"]undefined['"]/.test(s)],
  ['v3.58.0: all five drops route through the jewel pass (def + 5 call sites)', (s.match(/drawJewelDrop\(/g) || []).length >= 6],
  // ── v3.52.0 moth enemy (18th species, regular waves only) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['"]).
  ['v3.52.0: moth sprite dims 128×79', /moth:\s*\{\s*w:\s*128,\s*h:\s*79\s*\}/.test(s)],
  ['v3.52.0: moth in ENEMY_TYPES (Moth, erratic pattern)', /moth:\s*\{\s*name:\s*["']Moth["']/.test(s)],
  ['v3.52.0: moth registered in EnemyFactory REGISTRY', /moth:\s*MothEnemy/.test(s)],
  ['v3.52.0: MothEnemy class in bundle', /MothEnemy\s*=\s*class/.test(s)],
  ['v3.52.0: Bone Yard humanoid allowlist still ["human"] only', /BONE_YARD_HUMANOID_TYPES\s*=\s*\[\s*["']human["']\s*\]/.test(s)],
  // ── v3.53.0 beetle pixel-art sprite (armored tank) ──
  ['v3.53.0: beetle sprite dims 123×128', /beetle:\s*\{\s*w:\s*123,\s*h:\s*128\s*\}/.test(s)],
  ['v3.53.0: beetle sprite key in AssetSprites registry', s.includes('beetle: "iVBORw0KGgo')],
  ['v3.53.0: BeetleEnemy sprite + procedural fallback', /BEETLE_SPRITE_KEY/.test(s) && s.includes('this._drawProcedural(ctx, r)')],
  // ── v3.57.0 spider pixel-art sprite (web-spinner) + red hourglass mark ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['"]).
  ['v3.57.0: spider sprite dims 94×128', /spider:\s*\{\s*w:\s*94,\s*h:\s*128\s*\}/.test(s)],
  ['v3.57.0: spider sprite key in AssetSprites registry', s.includes('spider: "iVBORw0KGgo')],
  ['v3.57.0: SpiderEnemy sprite + procedural fallback', /SPIDER_SPRITE_KEY/.test(s) && s.includes('this._drawProcedural(ctx, r)')],
  ['v3.57.0: bright red hourglass dorsal mark', s.includes('_drawHourglassMark') && /rgba\(255,\s*34,\s*34/.test(s)],
  // ── v3.54.0 boneyard pixel-art environment (skeleton/skull/femur/profile bone) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['"]).
  ['v3.54.0: skeleton sprite dims 76×128', /skeleton:\s*\{\s*w:\s*76,\s*h:\s*128\s*\}/.test(s)],
  ['v3.54.0: skull sprite dims 104×128', /skull:\s*\{\s*w:\s*104,\s*h:\s*128\s*\}/.test(s)],
  ['v3.54.0: femur sprite dims 126×128', /femur:\s*\{\s*w:\s*126,\s*h:\s*128\s*\}/.test(s)],
  ['v3.54.0: profile_bone sprite dims 128×56', /profile_bone:\s*\{\s*w:\s*128,\s*h:\s*56\s*\}/.test(s)],
  ['v3.54.0: BoneYardBonus seeded backdrop (keys + mulberry32)', /BONEYARD_BG_KEYS/.test(s) && /mulberry32/.test(s)],
  ['v3.54.0: BonusLevel draw() delegates to the active bonus', s.includes('this.currentBonus.draw(ctx)')],
  ['v3.54.0: Game render draws the bonus backdrop', s.includes('this.bonus.draw(ctx)')],
  ['v3.54.0: BoneFragment femur/profile-bone sprite + procedural fallback', /BONE_FRAGMENT_SPRITE_KEYS/.test(s) && s.includes('getSprite(this.spriteKey)')],
  // ── v3.58.0 power-up pixel art (5 pill/poster assets + jewel pipeline) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['"]).
  ['v3.58.0: extralife sprite dims 128×46', /extralife:\s*\{\s*w:\s*128,\s*h:\s*46\s*\}/.test(s)],
  ['v3.58.0: health sprite dims 128×50', /health:\s*\{\s*w:\s*128,\s*h:\s*50\s*\}/.test(s)],
  ['v3.58.0: frenzy sprite dims 128×41', /frenzy:\s*\{\s*w:\s*128,\s*h:\s*41\s*\}/.test(s)],
  ['v3.58.0: shield sprite dims 128×50', /shield:\s*\{\s*w:\s*128,\s*h:\s*50\s*\}/.test(s)],
  ['v3.58.0: wanted sprite dims 78×128', /wanted:\s*\{\s*w:\s*78,\s*h:\s*128\s*\}/.test(s)],
  ['v3.58.0: POWERUP_ASSETS.mini → "wanted" (bounty poster)', /mini:\s*['"]wanted['"]/.test(s)],
  ['v3.58.0: wanted base64 sprite present in bundle', s.includes('wanted: "iVBORw0KGgo')],
  ['v3.58.1: mini drop draws the "wanted" sprite (old 28×28 poster is fallback only)', /drawSpriteIcon\(c,\s*['"]mini['"]\s*,\s*JEWEL_BOX\)/.test(s)],
  ['v3.58.0: 5-type jewel aura palette (blue/green/red/gold/bounty)',
    /aura:\s*['"]64, 140, 255['"]/.test(s) &&
    /aura:\s*['"]64, 220, 110['"]/.test(s) &&
    /aura:\s*['"]255, 64, 54['"]/.test(s) &&
    /aura:\s*['"]255, 205, 40['"]/.test(s) &&
    /aura:\s*['"]255, 220, 120['"]/.test(s)],
  ['v3.58.0: deterministic sparkle field (sparkleSeed sin-hash)', s.includes('sparkleSeed') && s.includes('43758.5453')],
  ['v3.58.0: pass-order fix — icon blit + depth + shine passes present', s.includes('drawImage(buf.c') && s.includes('source-atop') && s.includes('lighter')],
  [`version ${VER}`, s.includes(VER)],
];

let fail = 0;
for (const [name, ok] of tests) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
  if (!ok) fail++;
}
console.log(fail === 0 ? `\nBundle OK — v${VER} build verified (Bender easter egg + clean catship + shuttle + moth + beetle sprite + boneyard yard + crosshair 140–340 range + spider sprite w/ red hourglass + power-up pixel art w/ 5 jewel drops).` : `\n${fail} check(s) FAILED.`);
process.exit(fail ? 1 : 0);

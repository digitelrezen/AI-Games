// Verify the built single-file bundle is valid and contains the current
// milestone's features. The version is read from package.json so this always
// checks the latest build. Usage: node tools/verify-bundle.mjs (from the game folder)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'); // game root (Kitty Vs Everything)
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const VER = String(pkg.version || '');
const bundle = join(root, '..', 'Builds', `Kitty Vs Everything ${VER}.html`);
const s = readFileSync(bundle, 'utf8');

// ── v3.80.0: parse the drop tables numerically (esbuild may normalize
// 0.30 → 0.3 / .3, so string matching would be brittle; the readable
// bundle also keeps the inline // comments, so strip those first) ──
const parseDropTable = (src, re) => {
  const out = {};
  const m = src.match(re);
  if (m) for (const pair of m[1].replace(/\/\/[^\n]*/g, '').split(',')) {
    const [k, v] = pair.split(':').map((x) => x.trim().replace(/^["']|["']$/g, ''));
    if (k && v !== undefined) out[k] = parseFloat(v);
  }
  return out;
};
const powerupDrops = parseDropTable(s, /POWERUP_DROPS\s*=\s*\{([^}]*)\}/);
// v3.83.0: DROP_RARITY is gone — replaced by the nested DROP_POLICY table
// (per-source chance + maxDrops), checked structurally below.

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
  ['v3.47.0: shield is a soft yellow GLOW (SHIELD_BUBBLE_RADIUS=110, radial gradient, no hard rim)', /SHIELD_BUBBLE_RADIUS\s*=\s*110/.test(s) && s.includes('createRadialGradient') && s.includes('rgba(255, 213, 79')],
  ['v3.56.0: FC panel + minimized bar yellow theme (scoped amber borders)', s.includes('#fc-dashboard .fc-meter') && s.includes('#5c4a1e') && s.includes('#3d3218')],
  ['v3.45.0: shield-break shatter burst', s.includes('const shieldBefore = this.shield') && s.includes('#ffd54f')],
  ['v3.45.0: SUPER meter (superCharge + ultimateCooldown + super-ready, v4.2.0: F slot with cooldown timer)', s.includes('p.superCharge') && s.includes('p.ultimateCooldown') && s.includes('super-ready')],
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
  ['v4.2.0: ORBIT slot key label tracks synergy (undock/redock toggle)', /this\._slotLabel\(e\.orbitSlot,\s*['"]synergy['"]\)/.test(s)],
  ['v4.2.0: embedded radar scope canvas in the bundle', s.includes('fc-radar') && s.includes('_renderEmbedded') && s.includes('_fcPanelVisible')],
  // ── v3.48.0 procedural aim reticle (Crosshair.js) ──
  ['v3.48.0: Crosshair reticle module (circles + dot + ticks)', /Crosshair\s*=\s*class/.test(s) && /R_OUTER\s*=\s*16/.test(s) && /DOT_R\s*=\s*2\.6/.test(s)],
  ['v3.55.0: crosshair defaults (on + 140px offset, 140–340 limits)', /crosshair:\s*true/.test(s) && /crosshairOffset:\s*\{\s*min:\s*140,\s*max:\s*340,\s*def:\s*140/.test(s)],
  ['v3.55.0: dev slider range 140–340 (index.html attributes)', /id=["']dev-crosshair-offset["']\s+min=["']140["']\s+max=["']340["']/.test(s)],
  ['v3.55.0: reticle offset clamped in Crosshair.draw (LIMITS)', /Math\.max\(\w+\.min,\s*Math\.min\(\w+\.max,\s*SETTINGS\.crosshairOffset\)\)/.test(s)],
  ['v3.48.0: reticle drawn in Game render', s.includes('this.crosshair.draw(ctx)')],
  ['v3.48.0: settings toggle + dev slider wired', s.includes('set-crosshair') && s.includes('dev-crosshair-offset')],
  ['v3.49.0: butterfly top-down sprite registered (v3.94.0 asset dims 128×128)', /butterfly:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  // ── v3.50.0 space shuttle enemy (17th species, regular waves only) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['"]).
  ['v3.50.0: shuttle sprite dims 128×128', /shuttle:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.50.0: shuttle in ENEMY_TYPES (Space Shuttle, glide pattern)', /shuttle:\s*\{\s*name:\s*["']Space Shuttle["']/.test(s)],
  ['v3.67.0: WAVE.SPECIES_COUNT = 19', /SPECIES_COUNT:\s*19/.test(s)],
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
  ['v3.52.0: moth sprite dims 128×128', /moth:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.52.0: moth in ENEMY_TYPES (Moth, erratic pattern)', /moth:\s*\{\s*name:\s*["']Moth["']/.test(s)],
  ['v3.52.0: moth registered in EnemyFactory REGISTRY', /moth:\s*MothEnemy/.test(s)],
  ['v3.52.0: MothEnemy class in bundle', /MothEnemy\s*=\s*class/.test(s)],
  ['v3.52.0: Bone Yard humanoid allowlist still ["human"] only', /BONE_YARD_HUMANOID_TYPES\s*=\s*\[\s*["']human["']\s*\]/.test(s)],
  // ── v3.53.0 beetle pixel-art sprite (armored tank) ──
  ['v3.53.0: beetle sprite dims 128×128', /beetle:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.53.0: beetle sprite key in AssetSprites registry', s.includes('beetle: "iVBORw0KGgo')],
  ['v3.53.0: BeetleEnemy sprite + procedural fallback', /BEETLE_SPRITE_KEY/.test(s) && s.includes('this._drawProcedural(ctx, r)')],
  // ── v3.57.0 spider pixel-art sprite (web-spinner) + red hourglass mark ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['"]).
  ['v3.57.0: spider sprite dims 128×128', /spider:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.57.0: spider sprite key in AssetSprites registry', s.includes('spider: "iVBORw0KGgo')],
  ['v3.57.0: SpiderEnemy sprite + procedural fallback', /SPIDER_SPRITE_KEY/.test(s) && s.includes('this._drawProcedural(ctx, r)')],
  ['v3.57.0: bright red hourglass dorsal mark', s.includes('_drawHourglassMark') && /rgba\(255,\s*34,\s*34/.test(s)],
  // ── v3.54.0 boneyard pixel-art environment (skeleton/skull/femur/profile bone) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['"]).
  ['v3.54.0: skeleton sprite dims 85×128', /skeleton:\s*\{\s*w:\s*85,\s*h:\s*128\s*\}/.test(s)],
  ['v3.54.0: skull sprite dims 128×128', /skull:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.54.0: femur sprite dims 128×128', /femur:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.54.0: profile_bone sprite dims 128×128', /profile_bone:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.60.0: BoneYardBonus no-op draw hook (backdrop gone)', /draw\(ctx\)\s*\{\s*\}/.test(s) && !s.includes('BONEYARD_BG_KEYS')],
  ['v3.54.0: BonusLevel draw() delegates to the active bonus', s.includes('this.currentBonus.draw(ctx)')],
  ['v3.54.0: Game render draws the bonus backdrop', s.includes('this.bonus.draw(ctx)')],
  ['v3.60.0: BoneFragment per-key stats + weighted pool', /BONE_FRAGMENT_STATS/.test(s) && /BONE_FRAGMENT_POOL/.test(s) && /rollBoneFragmentKey/.test(s)],
  ['v3.60.0: BONUS.BONE_YARD_FIELD 10/10/6/3 seeded field', /BONE_YARD_FIELD:\s*\{\s*femur:\s*10,\s*profile_bone:\s*10,\s*skull:\s*6,\s*skeleton:\s*3\s*\}/.test(s) && /_seedYardField/.test(s)],
  ['v3.60.0: BoneFragment per-key score bands (500/1000/2000)', /score:\s*500/.test(s) && /score:\s*(?:1000|1e3)/.test(s) && /score:\s*(?:2000|2e3)/.test(s)],
  // ── v3.61.0 snake pixel-art sprite (slithering serpent) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['"]).
  ['v3.61.0: snake sprite dims 128×128', /snake:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.61.0: snake sprite key in AssetSprites registry', s.includes('snake: "iVBORw0KGgo')],
  ['v3.61.0: SnakeEnemy sprite + procedural fallback', /SNAKE_SPRITE_KEY/.test(s) && s.includes('this._drawProcedural(ctx, r)')],
  // ── v3.62.0 wolf pixel-art sprite (pack hunter) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['"]).
  ['v3.62.0: wolf sprite dims 128×128', /wolf:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.62.0: wolf sprite key in AssetSprites registry', s.includes('wolf: "iVBORw0KGgo')],
  ['v3.62.0: WolfEnemy sprite + procedural fallback', /WOLF_SPRITE_KEY/.test(s) && s.includes('this._drawProcedural(ctx, r)')],
  // ── v3.63.0 lizard pixel-art sprite (slow acid tank) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['"]).
  ['v3.63.0: lizard sprite dims 128×128', /lizard:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.63.0: lizard sprite key in AssetSprites registry', s.includes('lizard: "iVBORw0KGgo')],
  ['v3.63.0: LizardEnemy sprite + procedural fallback', /LIZARD_SPRITE_KEY/.test(s) && s.includes('this._drawProcedural(ctx, r)')],
  ['v3.63.0: tank gait phase-locked to hover bob', /sway\s*=\s*Math\.sin\(this\.t\)/.test(s)],
  // ── v3.64.0 dragon pixel-art sprite (heavy high-hover fire-breather) ──
  ['v3.64.0: dragon sprite dims 128×128', /dragon:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.64.0: dragon sprite key in AssetSprites registry', s.includes('dragon: "iVBORw0KGgo')],
  ['v3.64.0: DragonEnemy sprite + procedural fallback', /DRAGON_SPRITE_KEY/.test(s)],
  ['v3.64.0: dragon flight gait phase-locked to weave + wing-beat', /weave\s*=\s*Math\.sin\(this\.t\s*\*\s*0\.8\)/.test(s) && /flap\s*=\s*Math\.sin\(this\.t\s*\*\s*5\)/.test(s)],
  ['v3.64.0: dragon config entry intact', /dragon:\s*\{\s*name:\s*['"]Dragon['"]/.test(s) && s.includes('#d64545')],
  // ── v3.65.0 falcon pixel-art sprite (diving raptor) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['\"]).
  ['v3.65.0: falcon sprite dims 128×128', /falcon:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.65.0: falcon sprite key in AssetSprites registry', s.includes('falcon: "iVBORw0KGgo')],
  ['v3.65.0: FalconEnemy sprite + procedural fallback', /FALCON_SPRITE_KEY/.test(s) && s.includes('this._drawProcedural(ctx, r)')],
  ['v3.65.0: falcon beak-lead dive heading - PI blit rotation (v3.94.0 left-facing art)', /this\._heading\s*-\s*Math\.PI/.test(s)],
  ['v3.65.0: falcon wing-beat (t*6) + hover bob (t*3) phase-locked', /flap\s*=\s*Math\.sin\(this\.t\s*\*\s*6\)/.test(s) && /bob\s*=\s*Math\.sin\(this\.t\s*\*\s*3\)/.test(s)],
  ['v3.65.0: falcon config entry intact', /falcon:\s*\{\s*name:\s*['"]Falcon['"]/.test(s) && s.includes('#b0713a')],
  // ── v3.66.0 bat pixel-art sprite (erratic flutterer) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['\"]).
  ['v3.66.0: bat sprite dims 128×128', /bat:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.66.0: bat sprite key in AssetSprites registry', s.includes('bat: "iVBORw0KGgo')],
  ['v3.66.0: BatEnemy sprite + procedural fallback', /BAT_SPRITE_KEY/.test(s) && s.includes('this._drawProcedural(ctx, r)')],
  ['v3.66.0: bat wing-beat (t*14) + hover bob (t*3) phase-locked', /flap\s*=\s*Math\.sin\(this\.t\s*\*\s*14\)/.test(s) && /bob\s*=\s*Math\.sin\(this\.t\s*\*\s*3\)/.test(s)],
  ['v3.66.0: bat config entry intact', /bat:\s*\{\s*name:\s*['"]Bat['"]/.test(s) && s.includes('#5d5d7a')],
  // ── v3.67.0 squirrel enemy (19th species, fast erratic scurry) ──
  ['v3.67.0: squirrel sprite dims 128×128', /squirrel:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.67.0: squirrel sprite key in AssetSprites registry', s.includes('squirrel: "iVBORw0KGgo')],
  ['v3.67.0: SquirrelEnemy sprite + procedural fallback', /SQUIRREL_SPRITE_KEY/.test(s) && s.includes('this._drawProcedural(ctx, r)')],
  ['v3.67.0: squirrel scurry bounce (t*16) + twitchy wobble (t*4.2)', /bounce\s*=\s*Math\.sin\(this\.t\s*\*\s*16\)/.test(s) && /wobble\s*=\s*Math\.sin\(this\.t\s*\*\s*4\.2\)/.test(s)],
  ['v3.67.0: squirrel erratic hop + lateral sprints', s.includes('this._hopVy') && s.includes('this._sprintVx') && s.includes('this._sprintT')],
  ['v3.67.0: squirrel config entry intact', /squirrel:\s*\{\s*name:\s*['"]Squirrel['"]/.test(s) && s.includes('#a5622d')],
  ['v3.67.0: EnemyFactory registers squirrel', /squirrel:\s*SquirrelEnemy/.test(s)],
  // ── v3.68.0 modular weapon architecture (BaseWeapon + VulcanCannon) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes and default-exported classes as `var Name = class` — every
  // pattern below is quote-tolerant and name-suffix-tolerant. Note:
  // MiniShip.js keeps its OWN `case 'vulkan'` (mini volleys, no heat) —
  // the removed path is specifically firePrimary's inline heat buildup.
  ['v3.68.0: BaseWeapon class in bundle (shared weapon contract)', /BaseWeapon\d*\s*=\s*class/.test(s)],
  ['v3.68.0: VulcanCannon class in bundle (extends BaseWeapon, key "vulkan")', /VulcanCannon\d*\s*=\s*class/.test(s) && /super\(owner,\s*['"]vulkan['"]\)/.test(s)],
  ['v3.68.0: Player owns the weapons registry (vulkan → VulcanCannon)', /this\.weapons\s*=\s*\{\s*vulkan:\s*new\s+VulcanCannon\d*\s*\(this\)/.test(s)],
  ['v3.68.0: PlayerWeapons delegates volleys to p.weapons[p.weapon]', s.includes('p.weapons[p.weapon]') && /weapon\.fire\(aim,/.test(s)],
  ['v3.68.0: Vulcan thermal state stays on Player (owner-backed, FRENZY gate)', /this\.owner\.thermal/.test(s) && /this\.owner\.frenzyTime\s*>\s*0/.test(s)],
  ['v3.68.0: overheat floater + msglog live in VulcanCannon', s.includes('OVERHEAT!') && /VULKAN OVERHEAT (\u2014|\\u2014) LOCKOUT/.test(s)],
  ['v3.68.0: inline firePrimary vulkan heat path removed (now VulcanCannon)', !/p\.thermal\s*=\s*Math\.min\(w\.thermalMax,\s*p\.thermal\s*\+\s*w\.thermalPerShot\)/.test(s)],
  // ── v3.69.0 modular weapon architecture (Phase 2: PulseCannon + RailCannon) ──
  // All three primary weapons are now modular. MiniShip.js keeps its OWN
  // inline mini volleys (case 'plasma'/'rail', no heat) — the removed
  // paths are firePrimary's inline HULL volleys, identified by their
  // exact `p.`-prefixed statements (PulseCannon/RailCannon use
  // `this.owner.` / `this.game.` instead).
  ['v3.69.0: PulseCannon class in bundle (extends BaseWeapon, key "plasma")', /PulseCannon\d*\s*=\s*class/.test(s) && /super\(owner,\s*['"]plasma['"]\)/.test(s)],
  ['v3.69.0: RailCannon class in bundle (extends BaseWeapon, key "rail")', /RailCannon\d*\s*=\s*class/.test(s) && /super\(owner,\s*['"]rail['"]\)/.test(s)],
  ['v3.69.0: Player owns the full 3-weapon registry (vulkan/plasma/rail)', /this\.weapons\s*=\s*\{\s*vulkan:\s*new\s+VulcanCannon\d*\s*\(this\),\s*plasma:\s*new\s+PulseCannon\d*\s*\(this\),\s*rail:\s*new\s+RailCannon\d*\s*\(this\)\s*\}/.test(s)],
  ['v3.69.0: plasma twin-pod 3-bolt fan lives in PulseCannon (paw tips + 0.14 fan)', /for\s*\(const\s+paw\s+of\s+tips\)/.test(s) && /i\s*\*\s*0\.14/.test(s)],
  ['v3.69.0: rail charge-up visual lives in RailCannon.update (cooldown window)', /this\.cooldown\s*>\s*0\s*&&\s*this\.cooldown\s*<\s*w\.chargeTime/.test(s)],
  ['v3.69.0: inline firePrimary plasma flash path removed (now PulseCannon)', !/p\.pawFlashL\s*=\s*0\.12/.test(s)],
  ['v3.69.0: inline firePrimary rail shake path removed (now RailCannon)', !/p\.game\.shake\s*=\s*Math\.max\(p\.game\.shake,\s*5\)/.test(s)],
  // ── v3.58.0 power-up pixel art (5 pill/poster assets + jewel pipeline) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['"]).
  ['v3.92.0: extralife sprite dims 128×128 (uniform 256×256 art)', /extralife:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.92.0: health sprite dims 128×128 (uniform 256×256 art)', /health:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.92.0: frenzy sprite dims 128×128 (uniform 256×256 art)', /frenzy:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.92.0: shield sprite dims 128×128 (uniform 256×256 art)', /shield:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.92.0: wanted sprite dims 128×128 (uniform 256×256 art)', /wanted:\s*\{\s*w:\s*128,\s*h:\s*128\s*\}/.test(s)],
  ['v3.58.0: POWERUP_ASSETS.mini → "wanted" (bounty poster)', /mini:\s*['"]wanted['"]/.test(s)],
  ['v3.58.0: wanted base64 sprite present in bundle', s.includes('wanted: "iVBORw0KGgo')],
  ['v3.58.1: mini drop draws the "wanted" sprite (old 28×28 poster is fallback only)', /drawSpriteIcon\(c,\s*['"]mini['"]\s*,\s*JEWEL_BOX\)/.test(s)],
  // ── v3.59.0 double-sized power-up icons (2× the v3.58.x geometry) ──
  // esbuild (IIFE, non-minified) re-emits string literals with double
  // quotes — every pattern below is quote-tolerant (['"]).
  ['v3.59.0: JEWEL_BOX doubled 28 → 56', /JEWEL_BOX\s*=\s*56/.test(s)],
  ['v3.59.0: JEWEL_BUF doubled 40 → 80', /JEWEL_BUF\s*=\s*80/.test(s)],
  ['v3.59.0: pickup hitbox doubled (crate 36 / drop 28)', /this\.radius\s*=\s*type\s*===\s*['"]crate['"]\s*\?\s*36\s*:\s*28/.test(s)],
  ['v3.59.0: jewel aura radius doubled 22 → 44', /arc\(0,\s*0,\s*44,\s*0/.test(s)],
  ['v3.59.0: shimmer perimeter radius doubled 13.5 → 27', /arc\(0,\s*0,\s*27,\s*a0/.test(s)],
  ['v3.59.0: sparkle orbit doubled 10–18 → 20–36 px', /orbit\s*=\s*20\s*\+\s*16\s*\*\s*h1/.test(s)],
  ['v3.59.0: robot drop height doubled 28 → 56', /const h = 56;[\s\S]{0,80}BENDER_BODY_W/.test(s)],
  ['v3.59.0: crate sprite box doubled 28 → 56', /drawSpriteIcon\(ctx,\s*['"]crate['"]\s*,\s*56\)/.test(s)],
  ['v3.59.0: mini fallback poster doubled 28×28 → 56×56', /drawImage\(poster,\s*-28,\s*-28,\s*56,\s*56\)/.test(s)],
  ['v3.58.0: 5-type jewel aura palette (blue/green/red/gold/bounty)',
    /aura:\s*['"]64, 140, 255['"]/.test(s) &&
    /aura:\s*['"]64, 220, 110['"]/.test(s) &&
    /aura:\s*['"]255, 64, 54['"]/.test(s) &&
    /aura:\s*['"]255, 205, 40['"]/.test(s) &&
    /aura:\s*['"]255, 220, 120['"]/.test(s)],
  ['v3.58.0: deterministic sparkle field (sparkleSeed sin-hash)', s.includes('sparkleSeed') && s.includes('43758.5453')],
  ['v3.58.0: pass-order fix — icon blit + depth + shine passes present', s.includes('drawImage(buf.c') && s.includes('source-atop') && s.includes('lighter')],
  // ── v3.70.0 modular specialized rockets (BaseRocket + StunRockets + NapalmRockets) ──
  // esbuild (IIFE, non-minified) emits `var X = class ...` for class decls and
  // preserves the singleton var names (stunRockets / napalmRockets).
  ['v3.70.0: BaseRocket abstract base class present', /var BaseRocket = class \{/.test(s)],
  ['v3.70.0: StunRockets extends BaseRocket', /var StunRockets = class extends BaseRocket/.test(s)],
  ['v3.70.0: NapalmRockets extends BaseRocket', /var NapalmRockets = class extends BaseRocket/.test(s)],
  ['v3.70.0: stunRockets singleton instantiated', /var stunRockets = new StunRockets\(\)/.test(s)],
  ['v3.70.0: napalmRockets singleton instantiated', /var napalmRockets = new NapalmRockets\(\)/.test(s)],
  ['v3.70.0: Game ticks stunRockets.update', /stunRockets\.update\(this, dt\)/.test(s)],
  ['v3.70.0: Game ticks napalmRockets.update', /napalmRockets\.update\(this, dt\)/.test(s)],
  ['v3.70.0: PlayerWeapons delegates stunRockets.launch', /stunRockets\.launch\(p\.game, p\)/.test(s)],
  ['v3.70.0: PlayerWeapons delegates napalmRockets.launch', /napalmRockets\.launch\(p\.game, p\)/.test(s)],
  ['v3.70.0: no stale launchRockets (module removed)', !/launchRockets/.test(s)],
  ['v3.70.0: no stale updateRockets (module removed)', !/updateRockets/.test(s)],
  ['v3.70.0: no js/combat/Rockets.js import (deleted)', !/combat\/Rockets\.js/.test(s)],
  // ── v3.71.0 Phase 4 modular cat-ship combat (CatShipFactory + MiniShip + SuperNova) ──
  // CatShipFactory + MiniShip moved js/core/ → js/combat/; the base nova /
  // synergy super-weapon volleys extracted from Player.js into SuperNova.js.
  // esbuild (IIFE, non-minified) emits `var X = class` / `function f(` at the
  // IIFE top level and preserves call sites like fireNova(this).
  ['v3.71.0: SuperNova fireNova + fireSuperWeapon in bundle', /function fireNova\(/.test(s) && /function fireSuperWeapon\(/.test(s)],
  ['v3.71.0: Player delegates activateUltimate → fireNova(this)', s.includes('fireNova(this)')],
  ['v3.71.0: Player delegates superWeapon → fireSuperWeapon(this)', s.includes('fireSuperWeapon(this)')],
  ['v3.71.0: nova 16 ring + super-weapon 32 ring / 8 homing loops in bundle', /i < 16/.test(s) && /i < 32/.test(s) && /i < 8/.test(s)],
  ['v3.71.0: COLOR SYNERGY banner string in bundle', s.includes('COLOR SYNERGY! SUPER-WEAPON FIRED!')],
  ['v3.71.0: CatShipFactory createCatShip + createMiniShip in bundle', /function createCatShip\(/.test(s) && /function createMiniShip\(/.test(s)],
  ['v3.71.0: MiniShip class in bundle', /var MiniShip = class/.test(s)],
  ['v3.71.0: no stale js/core/CatShipFactory or js/core/MiniShip import path', !/core\/CatShipFactory|core\/MiniShip/.test(s)],
  // ── v3.80.0 drop rarity ladder + ships every level + ambient spawners ──
  // (POWERUP_DROPS / DROP_RARITY parsed numerically above — esbuild may
  // normalize 0.30 → 0.3 / .3, so string matching would be brittle.)
  ['v3.86.0: POWERUP_DROPS coin-first pool (coin .75 / health .07 / shield .06 / frenzy .05 / mini .03 / crate .02 / life .01 / robot .01)',
    Math.abs(powerupDrops.coin - 0.75) < 1e-9 && Math.abs(powerupDrops.health - 0.07) < 1e-9 &&
    Math.abs(powerupDrops.shield - 0.06) < 1e-9 && Math.abs(powerupDrops.frenzy - 0.05) < 1e-9 &&
    Math.abs(powerupDrops.mini - 0.03) < 1e-9 && Math.abs(powerupDrops.crate - 0.02) < 1e-9 &&
    Math.abs(powerupDrops.life - 0.01) < 1e-9 && Math.abs(powerupDrops.robot - 0.01) < 1e-9,
  ],
  ['v3.86.0: POWERUP_DROPS weights sum to 1.00',
    Math.abs(Object.values(powerupDrops).reduce((a, b) => a + b, 0) - 1) < 1e-9,
  ],
  ['v3.86.0: coin is the common drop (75%) + life/robot super-rare (1%)', powerupDrops.coin === 0.75 && powerupDrops.life === 0.01 && powerupDrops.robot === 0.01],
  ['v3.83.0: DROP_POLICY per-source drop table in bundle (mob/asteroid/crate/boss, chance + maxDrops)',
    /DROP_POLICY\s*=\s*\{/.test(s) && /maxDrops/.test(s) && /chance/.test(s),
  ],
  ['v3.83.0: DROP_RARITY gate is gone from the bundle (no definition, no .enemy/.special access)',
    !/DROP_RARITY\s*=\s*\{/.test(s) && !s.includes('DROP_RARITY.enemy') && !s.includes('DROP_RARITY.special'),
  ],
  ['v3.83.0: DropManager drop primitives in bundle (spawnSourceDrops/spawnGuaranteedDrop/spawnEventDrop/spawnDropAt)',
    s.includes('spawnSourceDrops') && s.includes('spawnGuaranteedDrop') && s.includes('spawnEventDrop') && s.includes('spawnDropAt'),
  ],
  ['v3.83.0: Combat.js routes kills through the DropManager (mob/boss + shuttle guaranteed)',
    /enemy\.special\s*\?\s*["']boss["']\s*:\s*["']mob["']/.test(s) && s.includes('spawnSourceDrops') && s.includes('spawnGuaranteedDrop'),
  ],
  ['v3.80.0: SHUTTLES_PER_WAVE = 2', /SHUTTLES_PER_WAVE\s*=\s*2\b/.test(s)],
  ['v3.80.0: ship egg starts unconditionally every level (old bonus skip gone)',
    /switchEgg\(this\.game,\s*["']ship["']\)/.test(s) && !s.includes('this.wave % this.bonusEvery !== 0'),
  ],
  ['v3.80.0: non-shuttle waves weave shuttles into the spawn queue',
    /if\s*\(type\s*!==\s*["']shuttle["']\)/.test(s),
  ],
  ['v3.80.0: ambient asteroid cadence 2–4s',
    /ASTEROID_AMBIENT_MIN\s*=\s*2\b/.test(s) && /ASTEROID_AMBIENT_MAX\s*=\s*4\b/.test(s),
  ],
  ['v3.80.0: ambient crate cadence 12–20s',
    /CRATE_AMBIENT_MIN\s*=\s*12\b/.test(s) && /CRATE_AMBIENT_MAX\s*=\s*20\b/.test(s),
  ],
  ['v3.80.0: ambient crate spawn (type "crate" power-up)', /type:\s*["']crate["']/.test(s)],
  // ── v4.13.0: weapon SFX balance + vulcan redesign ──
  ['v4.13.0: primary-weapon master bus (WEAPON_BUS_GAIN 0.65 → sfxBus)',
    /WEAPON_BUS_GAIN\s*=\s*0\.65/.test(s) && s.includes('this._wBus.connect(this.core.sfxBus)') && s.includes('this._wBusCtx')],
  ['v4.13.0: vulkan = low-mid click + punchy noise burst (dual-layer mechanical snap)',
    /freq:\s*180\s*\+\s*Math\.random\(\)\s*\*\s*90/.test(s) && /bp\.frequency\.value\s*=\s*480\s*\+\s*Math\.random\(\)\s*\*\s*340/.test(s)],
  ['v4.13.0: vulkan high-pitched screech/chirp is gone (1800–2700 / 1500–2000 voices removed)',
    !/1800\s*\+\s*Math\.random\(\)\s*\*\s*900/.test(s) && !/1500\s*\+\s*Math\.random\(\)\s*\*\s*500/.test(s)],
  ['v4.13.0: primary weapon voices route through the weapon bus',
    (s.match(/this\._weaponBus\(ctx\)/g) || []).length >= 3],
  // ── v4.22.0: crosshair customization + controller support ──
  ['v4.22.0: Gamepad module in bundle (Gamepad API polling + connect events)',
    s.includes('getGamepads') && s.includes('gamepadConnected') && s.includes('gamepadDisconnected')],
  ['v4.22.0: InputManager owns the gamepad layer (action OR)',
    s.includes('new Gamepad()') && s.includes('this.gamepad.isDown(action)') && s.includes('this.gamepad.wasPressed(action)')],
  ['v4.22.0: Game.loop polls the gamepad each frame + Start → pause',
    s.includes('this.input.gamepad.update()') && s.includes('this.input.gamepad.onPause')],
  ['v4.22.0: PlayerFlight analog stick flight (thrust/brake/strafe/spin)',
    s.includes('gp.thrust') && s.includes('gp.brake') && s.includes('GAMEPAD_SPIN_RATE')],
  ['v4.22.0: PLAYER.GAMEPAD_SPIN_RATE = 3.5', /GAMEPAD_SPIN_RATE:\s*3\.5/.test(s)],
  ['v4.22.0: shared drawReticle (in-game reticle + settings preview)',
    s.includes('drawReticle') && s.includes('CROSSHAIR_COLORS') && s.includes("CROSSHAIR_STYLES")],
  ['v4.22.0: crosshair settings (style/color/size/length) + gamepad toggle',
    s.includes('crosshairStyle') && s.includes('crosshairColor') && s.includes('crosshairLength') && s.includes('crosshairSize') && s.includes('SETTINGS.gamepad')],
  [`version ${VER}`, s.includes(VER)],
];

let fail = 0;
for (const [name, ok] of tests) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
  if (!ok) fail++;
}
console.log(fail === 0 ? `\nBundle OK — v${VER} build verified (Bender easter egg + clean catship + shuttle + moth + beetle sprite + destructible boneyard (29 seeded bones) + crosshair 140–340 range + spider sprite w/ red hourglass + snake pixel-art sprite + wolf pixel-art sprite + lizard pixel-art sprite + dragon pixel-art sprite + falcon pixel-art sprite + bat pixel-art sprite + squirrel enemy (19th species) + power-up pixel art w/ 5 jewel drops + modular cat-ship combat (CatShipFactory + MiniShip + SuperNova)).` : `\n${fail} check(s) FAILED.`);
process.exit(fail ? 1 : 0);

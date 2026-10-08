// ═══════════════════════════════════════════════════════════
//  [6y] v3.72.0 CATSHIP SPRITE THEMES — the player ship blits
//        one of nine cat-on-its-back PNGs (tools/asset-manifest.json
//        → js/core/AssetSprites.js) in place of the procedural hull.
//        PLAYER_THEME_SPRITES maps every PLAYER_THEMES key to a cat_*
//        sprite key; the theme color/accent still drive the cockpit,
//        weapons, thrusters, shields and HUD; themes without a sprite
//        fall back to the procedural hull.
//        v3.72.1: + transform fix gate (sprite blit must translate/rotate
//        to the ship — v3.72.0 drew at raw (0,0): hull off-screen, "floating
//        circle"), hardpoint FX re-layer gate, and the ship-select menu
//        gates (index.html no longer hardcodes cards; main.js generates all
//        9 from PLAYER_THEMES + re-renders after loadAssets()).
//        v3.85.0: the 9-thumbnail ship-select row is replaced by a HANGAR
//        CAROUSEL (single hero stage + ‹/› arrows + ←/→ keys + nameplate +
//        dots); the menu gates now verify the hangar stage is present in
//        index.html and that main.js drives it from PLAYER_THEMES.
//        v3.90.0: the 9 catship assets are the native 256×384 PNGs — the
//        importer's 128px cap no longer applies to cat_* keys (they use the
//        512px catship ceiling), so the registry carries full native dims
//        (w: 256, h: 384) and the manifest points at the *-256x384.png
//        files (hangar stage sizing in 06ag).
//        v3.95.0: the in-game sprite pipeline moved to
//        PlayerShipArt.drawSpriteShip (70px frame × MAIN_SHIP_SCALE, theme
//        glow, SHIP_GEOMETRY hardpoint FX) — PlayerRenderer delegates to it
//        and the hangar hero preview reuses the SAME pipeline (HANGAR_ZOOM),
//        so the selection screen renders the ship exactly as in-game.
//        v3.100.0: the hangar is now a HACKER TERMINAL — a ROSTER grid
//        (3×3, all 9 Catships by callsign) + a TACTICAL PREVIEW panel that
//        blits the selected cat_* art at NATIVE 1:1 (no downscale) on the
//        448×448 stage with a wireframe overlay + digital readouts. The
//        menu gates now verify the terminal structure (roster grid,
//        preview canvas, nameplate) and the native 1:1 blit.
// ═══════════════════════════════════════════════════════════

import { ROOT, TOOLS, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const ASSET_DIR = path.resolve(TOOLS, '..', '..', '.assets');
const MANIFEST = path.join(TOOLS, 'asset-manifest.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');

export default async function run() {
console.log('\n[6y] v3.72.0 catship sprite themes (9 cat-on-back PNGs) + v3.72.1 render/menu fixes + v3.90.0 native 256×384 art + v3.95.0 shared sprite pipeline');
{
  const { PLAYER_THEMES, PLAYER_THEME_SPRITES } = await mod('js/core/config.js');
  const prSrc = fs.readFileSync(path.join(ROOT, 'js/player/PlayerRenderer.js'), 'utf8');
  const psaSrc = fs.readFileSync(path.join(ROOT, 'js/player/PlayerShipArt.js'), 'utf8');
  const themeNames = Object.keys(PLAYER_THEMES);

  check('config: PLAYER_THEMES has all 9 themes', themeNames.length === 9, `got ${themeNames.length}: ${themeNames.join(', ')}`);
  check('config: PLAYER_THEME_SPRITES maps every theme to a cat_* sprite key',
    Object.keys(PLAYER_THEME_SPRITES).length === 9 && themeNames.every(t => typeof PLAYER_THEME_SPRITES[t] === 'string' && PLAYER_THEME_SPRITES[t].startsWith('cat_')),
    `got ${JSON.stringify(PLAYER_THEME_SPRITES)}`);
  for (const key of Object.values(PLAYER_THEME_SPRITES)) {
    check(`AssetSprites: ${key} registered with dims`, new RegExp(`${key}:\\s*\\{\\s*w:\\s*\\d+,\\s*h:\\s*\\d+\\s*\\}`).test(spritesSrc));
  }

  // v3.90.0: the catship art is native 256×384 — the registry must carry
  // the full native dims (the importer's 128px cap no longer applies to
  // cat_* keys) and the manifest must point at the *-256x384.png files.
  const isNative256x384 = k => new RegExp(`${k}:\\s*\\{\\s*w:\\s*256,\\s*h:\\s*384\\s*\\}`).test(spritesSrc);
  check('v3.90.0: all 9 cat_* assets are native 256×384 in the registry',
    Object.values(PLAYER_THEME_SPRITES).every(isNative256x384),
    `not native: ${Object.values(PLAYER_THEME_SPRITES).filter(k => !isNative256x384(k)).join(', ')}`);
  check('v3.90.0: manifest cat_* keys point at the *-256x384.png files',
    Object.values(PLAYER_THEME_SPRITES).every(k => typeof manifest.assets[k] === 'string' && manifest.assets[k].endsWith('-256x384.png')),
    `wrong file: ${Object.values(PLAYER_THEME_SPRITES).filter(k => !(typeof manifest.assets[k] === 'string' && manifest.assets[k].endsWith('-256x384.png'))).join(', ')}`);
  check('manifest: all 9 cat_* keys map to existing PNGs in .assets',
    Object.values(PLAYER_THEME_SPRITES).every(k => manifest.assets[k] && fs.existsSync(path.join(ASSET_DIR, manifest.assets[k]))),
    `missing: ${Object.values(PLAYER_THEME_SPRITES).filter(k => !manifest.assets[k] || !fs.existsSync(path.join(ASSET_DIR, manifest.assets[k]))).join(', ')}`);

  // v3.95.0: the sprite blit path moved to the shared PlayerShipArt.
  // drawSpriteShip pipeline - PlayerRenderer only resolves the sprite,
  // translates to the ship, and delegates; the hangar hero preview
  // reuses the same pipeline (HANGAR_ZOOM).
  check('PlayerRenderer: resolves the theme sprite (PLAYER_THEME_SPRITES + getSprite)', prSrc.includes('PLAYER_THEME_SPRITES[p.theme]') && prSrc.includes('getSprite('));
  check('drawSpriteShip: blits the sprite at a fixed 70px height (v3.95.0 shared pipeline)', psaSrc.includes('const drawH = 70') && psaSrc.includes('ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh)'));
  // v3.72.1: the blit must happen in the ship's LOCAL frame — the v3.72.0
  // build drew at raw (0,0) and the hull vanished off-screen while weapons
  // kept firing (the reported "circle floating in space" bug). v3.95.0:
  // the translate lives in PlayerRenderer, the rotate + blit in the shared
  // drawSpriteShip pipeline.
  check('PlayerRenderer: sprite branch delegates to the shared drawSpriteShip pipeline (v3.95.0)', prSrc.includes('ctx.translate(p.x, p.y)') && prSrc.includes('drawSpriteShip(ctx, sprite, th, p)'));
  check('drawSpriteShip: sprite blit rotated to the ship heading (v3.72.1 transform fix)', psaSrc.includes('ctx.rotate(p.angle + Math.PI / 2)'));
  check('drawSpriteShip: soft theme shadow-glow + blink alpha, no hard ellipse underlay (v3.72.1)', psaSrc.includes('ctx.shadowColor = th.accent') && psaSrc.includes('blink ? 0.35 : 1') && !psaSrc.includes('ctx.ellipse(0, 0, dw * 0.62'));
  check('drawSpriteShip: hardpoint FX re-layered on the sprite (paws/thrusters/muzzle at SHIP_GEOMETRY)', psaSrc.includes('drawWeaponPaw(ctx, SHIP_GEOMETRY.frontPawL.x') && psaSrc.includes('drawThrusterFlame(ctx, SHIP_GEOMETRY.thrusterL.x') && psaSrc.includes('drawMuzzleFlash(ctx, SHIP_GEOMETRY.muzzle.x'));
  check('PlayerRenderer: procedural fallback when no sprite (2x scale)', prSrc.includes('drawMainShip(ctx, p, th.color, th.accent, th.pattern, { scale: MAIN_SHIP_SCALE })'));
  check('PlayerRenderer: menu-icon compat path passes the theme sprite', prSrc.includes('drawMainShip(ctx, this.player, c, a, pattern, { x, y, scale: s }, sprite)'));

  // v3.100.0: hangar terminal — ROSTER grid + native 1:1 TACTICAL PREVIEW,
  // generated from config.js (replaces the v3.85.0 carousel).
  const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js/core/main.js'), 'utf8');
  check('index.html: hangar terminal present (roster grid + preview canvas + nameplate)', htmlSrc.includes('id="hangar-canvas"') && htmlSrc.includes('id="hangar-roster"') && htmlSrc.includes('id="hangar-nameplate"'));
  check('main.js: builds the roster from PLAYER_THEMES (all 9 themes)', mainSrc.includes('Object.keys(PLAYER_THEMES)') && mainSrc.includes('hangarIndex'));
  check('main.js: hero render carries the theme (sprite lookup works)', mainSrc.includes('const mockPlayer = {') && mainSrc.includes('theme: key'));
  check('main.js: re-renders the hero after loadAssets() resolves', mainSrc.includes('loadAssets().then(renderHangar)'));
  check('main.js: hangar preview blits the sprite at native 1:1 (v3.100.0)', mainSrc.includes('hangarCtx.drawImage(sprite, C - sprite.width / 2, C - sprite.height / 2, sprite.width, sprite.height)'));

  // PlayerShipArt: optional sprite parameter blits before the procedural hull
  check('PlayerShipArt: drawCatShip accepts an optional sprite parameter', psaSrc.includes('export function drawCatShip(ctx, p, c, a, pattern, opts = {}, sprite = null)'));
  check('PlayerShipArt: sprite blit at 70px height, early return skips the procedural hull', psaSrc.includes('const dh = 70') && psaSrc.includes('ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh)'));
}

}

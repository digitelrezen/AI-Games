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
//        gates (index.html no longer hardcodes 5 cards; main.js generates
//        all 9 from PLAYER_THEMES + re-renders icons after loadAssets()).
// ═══════════════════════════════════════════════════════════

import { ROOT, TOOLS, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';
const ASSET_DIR = path.resolve(TOOLS, '..', '.assets');
const MANIFEST = path.join(TOOLS, 'asset-manifest.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const spritesSrc = fs.readFileSync(path.join(ROOT, 'js/core/AssetSprites.js'), 'utf8');

export default async function run() {
console.log('\n[6y] v3.72.0 catship sprite themes (9 cat-on-back PNGs) + v3.72.1 render/menu fixes');
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
  check('manifest: all 9 cat_* keys map to existing PNGs in .assets',
    Object.values(PLAYER_THEME_SPRITES).every(k => manifest.assets[k] && fs.existsSync(path.join(ASSET_DIR, manifest.assets[k]))),
    `missing: ${Object.values(PLAYER_THEME_SPRITES).filter(k => !manifest.assets[k] || !fs.existsSync(path.join(ASSET_DIR, manifest.assets[k]))).join(', ')}`);

  // PlayerRenderer: sprite blit path + procedural fallback
  check('PlayerRenderer: resolves the theme sprite (PLAYER_THEME_SPRITES + getSprite)', prSrc.includes('PLAYER_THEME_SPRITES[p.theme]') && prSrc.includes('getSprite('));
  check('PlayerRenderer: blits the sprite at a fixed 70px height', prSrc.includes('const drawH = 70') && prSrc.includes('ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh)'));
  // v3.72.1: the blit must happen in the ship's LOCAL frame — the v3.72.0
  // build drew at raw (0,0) and the hull vanished off-screen while weapons
  // kept firing (the reported "circle floating in space" bug).
  check('PlayerRenderer: sprite blit translated + rotated to the ship (v3.72.1 transform fix)', prSrc.includes('ctx.translate(p.x, p.y)') && prSrc.includes('ctx.rotate(p.angle + Math.PI / 2)'));
  check('PlayerRenderer: soft theme shadow-glow + blink alpha, no hard ellipse underlay (v3.72.1)', prSrc.includes('ctx.shadowColor = th.accent') && prSrc.includes('blink ? 0.35 : 1') && !prSrc.includes('ctx.ellipse(0, 0, dw * 0.62'));
  check('PlayerRenderer: hardpoint FX re-layered on the sprite (paws/thrusters/muzzle at SHIP_GEOMETRY)', prSrc.includes('drawWeaponPaw(ctx, SHIP_GEOMETRY.frontPawL.x') && prSrc.includes('drawThrusterFlame(ctx, SHIP_GEOMETRY.thrusterL.x') && prSrc.includes('drawMuzzleFlash(ctx, SHIP_GEOMETRY.muzzle.x'));
  check('PlayerRenderer: procedural fallback when no sprite (2x scale)', prSrc.includes('drawMainShip(ctx, p, th.color, th.accent, th.pattern, { scale: MAIN_SHIP_SCALE })'));
  check('PlayerRenderer: menu-icon compat path passes the theme sprite', prSrc.includes('drawMainShip(ctx, this.player, c, a, pattern, { x, y, scale: s }, sprite)'));

  // v3.72.1: ship-select menu — all 9 themes, generated from config.js
  const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js/core/main.js'), 'utf8');
  check('index.html: no hardcoded ship-option cards (menu generated from PLAYER_THEMES)', !htmlSrc.includes('data-theme=') && htmlSrc.includes('class="menu-ship-select"'));
  check('main.js: generates one ship-option per PLAYER_THEMES key (all 9 cards)', mainSrc.includes('for (const key of Object.keys(PLAYER_THEMES))') && mainSrc.includes('btn.dataset.theme = key'));
  check('main.js: mock player carries the theme (menu-icon sprite lookup works)', mainSrc.includes('const mockPlayer = {') && mainSrc.includes('theme,'));
  check('main.js: re-renders menu icons after loadAssets() resolves', mainSrc.includes('loadAssets().then(renderAllShipIcons)'));

  // PlayerShipArt: optional sprite parameter blits before the procedural hull
  check('PlayerShipArt: drawCatShip accepts an optional sprite parameter', psaSrc.includes('export function drawCatShip(ctx, p, c, a, pattern, opts = {}, sprite = null)'));
  check('PlayerShipArt: sprite blit at 70px height, early return skips the procedural hull', psaSrc.includes('const dh = 70') && psaSrc.includes('ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh)'));
}

}

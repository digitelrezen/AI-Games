// ═══════════════════════════════════════════════════════════
//  [6au] v4.29.0 AD BANNER — Eridath's Mom Enterprises
//        (js/core/ui/AdBannerManager.js): module surface,
//        AD_CATALOG contents, 8–12 s rotation window, the
//        kitty_enable_ads localStorage contract, setEnabled
//        behavior, and the index.html / style.css / main.js /
//        SettingsScreen.js wiring.
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
  console.log('\n[6au] v4.29.0 ad banner (Eridath\'s Mom Enterprises)');
  const A = await mod('js/core/ui/AdBannerManager.js');
  check('AdBannerManager exports VERSION v4.29.0', A.VERSION === 'v4.29.0', `got ${A.VERSION}`);
  check('exports the AdBannerManager class + adBanner singleton',
    typeof A.AdBannerManager === 'function' && A.adBanner instanceof A.AdBannerManager);
  check('AD_CATALOG has the 4 initial ads',
    Array.isArray(A.AD_CATALOG) && A.AD_CATALOG.length === 4, `got ${A.AD_CATALOG.length}`);
  const FIELDS = ['id', 'title', 'subtitle', 'body', 'sprite', 'cta'];
  check('every ad carries id/title/subtitle/body/sprite/cta (non-empty strings)',
    A.AD_CATALOG.every((ad) => FIELDS.every((f) => typeof ad[f] === 'string' && ad[f].length > 0)));
  const ids = A.AD_CATALOG.map((a) => a.id);
  check('catalog ids: house / rhino-cat-9000 / only-eridaths-mom / boneyard',
    JSON.stringify(ids) === JSON.stringify(['eridaths_moms_house', 'rhino_cat_9000', 'only_eridaths_mom', 'boneyard_disposal']),
    `got ${ids.join(', ')}`);
  check('house ad references the eridath_moms_house 512×512 sprite key',
    A.AD_CATALOG[0].sprite === 'eridath_moms_house', `got ${A.AD_CATALOG[0].sprite}`);
  check('house ad copy carries the 1-976-PIPE-CLEANERS hotline',
    A.AD_CATALOG[0].body.includes('1-976-PIPE-CLEANERS') && A.AD_CATALOG[0].body.includes('$3.99/min'));
  check('rhino-cat ad copy carries 300% maximum cannon power',
    A.AD_CATALOG[1].body.includes('300% maximum cannon power'));
  check('only-eridaths-mom ad copy carries unlimited Frenzy power-ups',
    A.AD_CATALOG[2].body.includes('unlimited Frenzy power-ups'));
  check('boneyard ad copy carries "bury your problems fast"',
    A.AD_CATALOG[3].body.includes('bury your problems fast'));
  check('rotation window is 8–12 s', A.ROTATE_MIN_MS === 8000 && A.ROTATE_MAX_MS === 12000,
    `got ${A.ROTATE_MIN_MS}–${A.ROTATE_MAX_MS}`);
  check('localStorage key is kitty_enable_ads', A.AD_STORAGE_KEY === 'kitty_enable_ads', `got ${A.AD_STORAGE_KEY}`);

  // setEnabled contract — default ON, toggles + persists immediately
  const m = new A.AdBannerManager();
  check('ads default to ENABLED', m.enabled === true, `got ${m.enabled}`);
  m.setEnabled(false);
  check('setEnabled(false) disables + persists kitty_enable_ads=false',
    m.enabled === false && globalThis.localStorage.getItem('kitty_enable_ads') === 'false');
  m.setEnabled(true);
  check('setEnabled(true) re-enables + persists kitty_enable_ads=true',
    m.enabled === true && globalThis.localStorage.getItem('kitty_enable_ads') === 'true');
  m.toggle();
  check('toggle() flips the state', m.enabled === false, `got ${m.enabled}`);
  check('pause()/resume()/next() surface exists',
    typeof m.pause === 'function' && typeof m.resume === 'function' && typeof m.next === 'function');

  // DOM / CSS / boot wiring
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check('index.html: #set-ads toggle under a MONETIZATION / AD BANNERS section',
    html.includes('id="set-ads"') && /MONETIZATION\s*\/\s*AD BANNERS/i.test(html));
  const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  check('style.css: #ad-banner retro window (lower-left, pixelated sprite, neon cyan/magenta)',
    css.includes('#ad-banner') && css.includes('bottom: 205px') && css.includes('image-rendering: pixelated')
      && css.includes('#00e5ff') && css.includes('#ff4fd8'));
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js/core/main.js'), 'utf8');
  check('main.js imports the ad banner and calls adBanner.start()',
    mainSrc.includes("from './ui/AdBannerManager.js'") && mainSrc.includes('adBanner.start()'));
  const ssSrc = fs.readFileSync(path.join(ROOT, 'js/ui/SettingsScreen.js'), 'utf8');
  check('SettingsScreen binds #set-ads → adBanner.setEnabled',
    ssSrc.includes('set-ads') && ssSrc.includes('adBanner.setEnabled(toggle.checked)'));
}
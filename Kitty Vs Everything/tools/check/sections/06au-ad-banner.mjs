// ═══════════════════════════════════════════════════════════
//  [6au] v4.29.1 AD BANNER — Eridath's Mom Enterprises
//        (js/core/ui/AdBannerManager.js): module surface,
//        AD_CATALOG contents, the 30–60 s pop-up window + 12 s
//        on-screen time, the kitty_enable_ads localStorage
//        contract, the HIDDEN-START state model, the REAL
//        minimize → FC mini-bar dock, and the index.html /
//        style.css / main.js / SettingsScreen.js wiring.
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
  console.log('\n[6au] v4.29.1 ad banner (Eridath\'s Mom Enterprises — hidden start + 30–60 s pop-ups + FC-bar dock)');
  const A = await mod('js/core/ui/AdBannerManager.js');
  check('AdBannerManager exports VERSION v4.29.1', A.VERSION === 'v4.29.1', `got ${A.VERSION}`);
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
  check('pop-up window is 30–60 s (randomized) + 12 s on screen',
    A.POPUP_MIN_MS === 30000 && A.POPUP_MAX_MS === 60000 && A.VISIBLE_MS === 12000,
    `got ${A.POPUP_MIN_MS}–${A.POPUP_MAX_MS} / visible ${A.VISIBLE_MS}`);
  check('localStorage key is kitty_enable_ads', A.AD_STORAGE_KEY === 'kitty_enable_ads', `got ${A.AD_STORAGE_KEY}`);

  // State model — default ON but STARTS HIDDEN (v4.29.1)
  const m = new A.AdBannerManager();
  check('ads default to ENABLED', m.enabled === true, `got ${m.enabled}`);
  check('banner STARTS HIDDEN + undocked (no pop-up on boot)',
    m.visible === false && m.docked === false,
    `visible=${m.visible} docked=${m.docked}`);
  const src = fs.readFileSync(path.join(ROOT, 'js/core/ui/AdBannerManager.js'), 'utf8');
  check('_build() ALWAYS adds the hidden class (no blank window at boot)',
    /el\.classList\.add\('hidden'\);/.test(src)
      && !/if \(!this\.enabled\) el\.classList\.add\('hidden'\)/.test(src));
  m.setEnabled(false);
  check('setEnabled(false) disables + hides + undocks + persists kitty_enable_ads=false',
    m.enabled === false && m.visible === false && m.docked === false
      && globalThis.localStorage.getItem('kitty_enable_ads') === 'false');
  m.setEnabled(true);
  check('setEnabled(true) re-enables + persists kitty_enable_ads=true',
    m.enabled === true && globalThis.localStorage.getItem('kitty_enable_ads') === 'true');
  m.toggle();
  check('toggle() flips the state', m.enabled === false, `got ${m.enabled}`);
  check('pause()/resume()/next() surface exists',
    typeof m.pause === 'function' && typeof m.resume === 'function' && typeof m.next === 'function');
  check('minimize()/restore() surface exists (real minimize → FC mini-bar dock)',
    typeof m.minimize === 'function' && typeof m.restore === 'function');

  // DOM / CSS / boot wiring
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check('index.html: #set-ads toggle under a MONETIZATION / AD BANNERS section',
    html.includes('id="set-ads"') && /MONETIZATION\s*\/\s*AD BANNERS/i.test(html));
  check('index.html: ad hint describes hidden start + 30–60 s pop-ups + FC-bar dock',
    html.includes('kitty_enable_ads') && html.includes('starts hidden') && html.includes('pops up with a new ad every 30'));
  const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  check('style.css: #ad-banner retro window (TRUE lower-left corner, joke size, pixelated sprite)',
    css.includes('#ad-banner') && css.includes('bottom: 14px') && css.includes('width: 240px')
      && css.includes('image-rendering: pixelated') && css.includes('#00e5ff') && css.includes('#ff4fd8'));
  check('style.css: pop-in animation + #ad-dock chip (FC mini-bar dock)',
    css.includes('#ad-banner.ad-pop') && css.includes('#ad-dock'));
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js/core/main.js'), 'utf8');
  check('main.js imports the ad banner and calls adBanner.start()',
    mainSrc.includes("from './ui/AdBannerManager.js'") && mainSrc.includes('adBanner.start()'));
  const ssSrc = fs.readFileSync(path.join(ROOT, 'js/ui/SettingsScreen.js'), 'utf8');
  check('SettingsScreen binds #set-ads → adBanner.setEnabled',
    ssSrc.includes('set-ads') && ssSrc.includes('adBanner.setEnabled(toggle.checked)'));
}

// ═══════════════════════════════════════════════════════════
//  [6as] v4.27.0 EXPANDED MINIMIZED FIRE-CONTROL BAR — the M-key
//        collapsed strip (#fc-mini-bar) carries the FRENZY countdown
//        chip + WPN / SUPER / FLEET readouts besides HULL + SHIELD,
//        so the key combat readouts stay visible without expanding.
// ═══════════════════════════════════════════════════════════

import { ROOT, check } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
{
  console.log('\n[6as] v4.27.0 expanded minimized fire-control bar');
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const indexHtml = read('index.html');
  const styleCss = read('style.css');
  const fcSrc = read('js/ui/HUDFireControl.js');

  // ─── index.html: the mini-bar DOM ───
  check('index.html: #fc-mini-bar keeps the HULL + SHIELD meters',
    indexHtml.includes('id="fc-mini-bar"') && indexHtml.includes('id="fc-mini-hp-fill"') && indexHtml.includes('id="fc-mini-shield-fill"'));
  check('index.html: #fc-mini-frenzy chip uses the gold-pulse .frenzy-indicator class (hidden by default)',
    /id="fc-mini-frenzy"\s+class="frenzy-indicator hidden"/.test(indexHtml));
  check('index.html: mini-bar WPN readout (#fc-mini-weapon + #fc-mini-weapon-status)',
    indexHtml.includes('id="fc-mini-weapon"') && indexHtml.includes('id="fc-mini-weapon-status"'));
  check('index.html: mini-bar SUPER + FLEET readouts',
    indexHtml.includes('id="fc-mini-super"') && indexHtml.includes('id="fc-mini-fleet"'));
  check('index.html: mini-bar keeps the M: EXPAND hint',
    indexHtml.includes('M: EXPAND'));

  // ─── style.css: separators + SUPER state colors ───
  check('style.css: .fc-mini-sep separator styled',
    styleCss.includes('.fc-mini-sep'));
  check('style.css: #fc-mini-super ready/charging/cooldown colors',
    styleCss.includes('#fc-mini-super.ready') && styleCss.includes('#fc-mini-super.charging') && styleCss.includes('#fc-mini-super.cooldown'));

  // ─── HUDFireControl.js: registration + live updates ───
  for (const id of ['fc-mini-frenzy', 'fc-mini-weapon', 'fc-mini-weapon-status', 'fc-mini-super', 'fc-mini-fleet']) {
    check(`HUDFireControl.js registers #${id}`, fcSrc.includes(`byId('${id}')`));
  }
  check('HUDFireControl.js: mini frenzy chip mirrors player.frenzyTime',
    /e\.miniFrenzy\.textContent = '⚡ FRENZY ' \+ Math\.ceil\(p\.frenzyTime\) \+ 's'/.test(fcSrc));
  check('HUDFireControl.js: mini weapon status mirrors the weapon panel',
    fcSrc.includes('e.miniWeaponStatus.textContent = e.weaponStatus.textContent'));
  check('HUDFireControl.js: mini SUPER mirrors the ultimate cooldown/charge state',
    fcSrc.includes('e.miniSuper.textContent') && fcSrc.includes('e.miniSuper.className'));
  check('HUDFireControl.js: mini FLEET mirrors count + orbit state',
    /e\.miniFleet\.textContent = p\.minis\.length \+ '\/' \+ MINI_SHIP\.maxDocked/.test(fcSrc));
}

}
// ═══════════════════════════════════════════════════════════
//  [6aa] MILESTONE VERSION SYNC — the milestone version must
//        be consistent across package.json (build filename source of
//        truth), config.js (central config), main.js (project
//        manifest), Game.js (game orchestrator), HUD.js (in-game
//        #version-label) and index.html (browser tab title).
// ═══════════════════════════════════════════════════════════

import { ROOT, check } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
{
  console.log('\n[6aa] v4.24.0 version sync');
  const MILESTONE = 'v4.24.0';
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  check(`package.json version = ${MILESTONE.slice(1)} (build filename source of truth)`, pkg.version === MILESTONE.slice(1), `got ${pkg.version}`);
  const cfgSrc = fs.readFileSync(path.join(ROOT, 'js/core/config.js'), 'utf8');
  check(`config.js: VERSION = ${MILESTONE} (central config)`, cfgSrc.includes(`VERSION = '${MILESTONE}'`));
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js/core/main.js'), 'utf8');
  check(`main.js: VERSION = ${MILESTONE} (project manifest)`, mainSrc.includes(`VERSION = '${MILESTONE}'`));
  const gameSrc = fs.readFileSync(path.join(ROOT, 'js/core/Game.js'), 'utf8');
  check(`Game.js: VERSION = ${MILESTONE} (game orchestrator)`, gameSrc.includes(`VERSION = '${MILESTONE}'`));
  const hudSrc = fs.readFileSync(path.join(ROOT, 'js/ui/HUD.js'), 'utf8');
  check(`HUD.js: VERSION = ${MILESTONE} (in-game #version-label)`, hudSrc.includes(`VERSION = '${MILESTONE}'`));
  const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check(`index.html: tab title carries ${MILESTONE}`, htmlSrc.includes(`Kitty Vs Everything — ${MILESTONE}`));
}

}

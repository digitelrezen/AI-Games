// ═══════════════════════════════════════════════════════════
//  [6i] v3.55.0 CROSSHAIR OFFSET RANGE — reticle distance slider
//       widened to 140–340 logical px (was 24–160); Settings.js
//       LIMITS is the single source of truth, Crosshair.draw()
//       clamps defensively
// ═══════════════════════════════════════════════════════════

import { ROOT, check } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
console.log('\n[6i] v3.55.0 crosshair offset range (140–340 px)');
{
  const setSrc = fs.readFileSync(path.join(ROOT, 'js/ui/Settings.js'), 'utf8');
  const xhSrc = fs.readFileSync(path.join(ROOT, 'js/ui/Crosshair.js'), 'utf8');
  const devSrc = fs.readFileSync(path.join(ROOT, 'js/ui/DevPanel.js'), 'utf8');
  const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check('Settings: crosshairOffset LIMITS 140–340 (default 140)', /crosshairOffset:\s*\{\s*min:\s*140,\s*max:\s*340,\s*def:\s*140/.test(setSrc));
  check('Settings: LIMITS exported (shared clamp source)', setSrc.includes('export const LIMITS'));
  check('Crosshair: VERSION = v3.55.0', xhSrc.includes("VERSION = 'v3.55.0'"));
  check('Crosshair: draw() clamps offset to LIMITS range', xhSrc.includes('Math.max(lim.min, Math.min(lim.max, SETTINGS.crosshairOffset))'));
  check('DevPanel: slider → setSetting clamp path intact', devSrc.includes("setSetting('crosshairOffset', parseFloat(xhOffset.value))"));
  check('index.html: dev slider min=140 max=340 value=140', htmlSrc.includes('id="dev-crosshair-offset" min="140" max="340" step="1" value="140"'));
}

}

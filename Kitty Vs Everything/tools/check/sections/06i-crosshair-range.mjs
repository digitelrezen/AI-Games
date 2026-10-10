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
  check('Crosshair: VERSION = v4.22.0', xhSrc.includes("VERSION = 'v4.22.0'"));
  check('Crosshair: draw() clamps offset to LIMITS range', xhSrc.includes('Math.max(lim.min, Math.min(lim.max, SETTINGS.crosshairOffset))'));
  check('DevPanel: slider → setSetting clamp path intact', devSrc.includes("setSetting('crosshairOffset', parseFloat(xhOffset.value))"));
  check('index.html: dev slider min=140 max=340 value=140', htmlSrc.includes('id="dev-crosshair-offset" min="140" max="340" step="1" value="140"'));
  // ─── v4.22.0: crosshair customization (style/color/size/length) ───
  check('Crosshair: exports shared drawReticle (in-game + settings preview)', xhSrc.includes('export function drawReticle'));
  check('Crosshair: 4 styles (classic/brackets/diamond/dot)', xhSrc.includes("CROSSHAIR_STYLES = ['classic', 'brackets', 'diamond', 'dot']"));
  check('Crosshair: 5 colors (red/green/yellow/blue/white)', ['red', 'green', 'yellow', 'blue', 'white'].every(c => xhSrc.includes(`${c}:`)));
  check('Settings: crosshairLength LIMITS 0.5–2 (default 1)', /crosshairLength:\s*\{\s*min:\s*0\.5,\s*max:\s*2,\s*def:\s*1/.test(setSrc));
  check('Settings: crosshairSize LIMITS 0.5–2 (default 1)', /crosshairSize:\s*\{\s*min:\s*0\.5,\s*max:\s*2,\s*def:\s*1/.test(setSrc));
  check('Settings: crosshairColor enum (red default)', /crosshairColor:\s*\{[^}]*values:\s*\[[^\]]*\bred\b[^\]]*\][^}]*def:\s*'red'/.test(setSrc));
  check('Settings: crosshairStyle enum (classic default)', /crosshairStyle:\s*\{[^}]*values:\s*\[[^\]]*\bclassic\b[^\]]*\][^}]*def:\s*'classic'/.test(setSrc));
  check('Settings: gamepad boolean (default ON)', /gamepad:\s+saved\.gamepad !== false/.test(setSrc));
  check('index.html: crosshair preview canvas', htmlSrc.includes('id="set-crosshair-preview"'));
  check('index.html: crosshair style chips (4)', htmlSrc.includes('data-chstyle="classic"') && htmlSrc.includes('data-chstyle="brackets"') && htmlSrc.includes('data-chstyle="diamond"') && htmlSrc.includes('data-chstyle="dot"'));
  check('index.html: crosshair color chips (5)', ['red', 'green', 'yellow', 'blue', 'white'].every(c => htmlSrc.includes(`data-chcolor="${c}"`)));
  check('index.html: crosshair length/size sliders (0.5–2)', htmlSrc.includes('id="set-crosshair-length" min="0.5" max="2"') && htmlSrc.includes('id="set-crosshair-size" min="0.5" max="2"'));
  check('index.html: gamepad toggle + status line', htmlSrc.includes('id="set-gamepad"') && htmlSrc.includes('id="set-gamepad-status"'));
}

}

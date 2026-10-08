// ═══════════════════════════════════════════════════════════
//  [6ai] v3.98.0 ADMIN PASSPHRASE GATE — F9 / backquote no longer
//        opens the admin panel directly: a terminal-style overlay
//        (#admin-gate, DevPanel.js) asks "Who is always ready?" and
//        the typed answer is validated case-insensitively (trim +
//        lowercase) against ADMIN_PASSPHRASES:
//          "Eridaths Mom" / "Eridath mom" / "EM"
//        Correct → the panel opens normally; wrong → "That is
//        incorrect. your punishment is Back of the line!" and the
//        prompt stays up for a retry (no lockouts, no permanent
//        restrictions). Headless: verifyAdminPassphrase() is the
//        exported validator — behavior verified here.
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
{
  console.log('\n[6ai] v3.98.0 admin passphrase gate (terminal prompt, F9)');
  const devSrc = fs.readFileSync(path.join(ROOT, 'js/ui/DevPanel.js'), 'utf8');
  const cssSrc = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  const { verifyAdminPassphrase } = await mod('js/ui/DevPanel.js');

  // ── (1) headless validator behavior (case-insensitive + trimmed) ──
  check('DevPanel exports verifyAdminPassphrase (runtime)', typeof verifyAdminPassphrase === 'function');
  check('valid: "Eridaths Mom" (exact case)', verifyAdminPassphrase('Eridaths Mom') === true);
  check('valid: "eridaths mom" (lowercase)', verifyAdminPassphrase('eridaths mom') === true);
  check('valid: "ERIDATHS MOM" (uppercase)', verifyAdminPassphrase('ERIDATHS MOM') === true);
  check('valid: "Eridath mom" (no apostrophe)', verifyAdminPassphrase('Eridath mom') === true);
  check('valid: "eridath MOM" (mixed case)', verifyAdminPassphrase('eridath MOM') === true);
  check('valid: "em" (short form, lowercase)', verifyAdminPassphrase('em') === true);
  check('valid: "EM" (short form, uppercase)', verifyAdminPassphrase('EM') === true);
  check('valid: "eM" (short form, mixed case)', verifyAdminPassphrase('eM') === true);
  check('valid: surrounding whitespace is trimmed', verifyAdminPassphrase('  Eridaths Mom  ') === true);
  check('invalid: wrong answer rejected', verifyAdminPassphrase('nope') === false);
  check('invalid: empty answer rejected', verifyAdminPassphrase('') === false);
  check('invalid: null/undefined rejected', verifyAdminPassphrase(null) === false && verifyAdminPassphrase(undefined) === false);
  check('invalid: "Eridath\'s Mom" (apostrophe) rejected', verifyAdminPassphrase("Eridath's Mom") === false);
  check('invalid: "EMO" (near-miss) rejected', verifyAdminPassphrase('EMO') === false);
  check('invalid: "mom" (partial) rejected', verifyAdminPassphrase('mom') === false);

  // ── (2) source gates: prompt, punishment line, gate wiring ──
  check('DevPanel: terminal prompt asks "Who is always ready?"', devSrc.includes('Who is always ready?'));
  check('DevPanel: wrong answers show the punishment line',
    devSrc.includes('That is incorrect. your punishment is Back of the line!'));
  check('DevPanel: F9/backquote routes through the gate before the panel opens',
    devSrc.includes('this.openGate()') && devSrc.includes("e.code === 'F9'"));
  check('DevPanel: the gate is the #admin-gate terminal overlay', devSrc.includes("gate.id = 'admin-gate'"));
  check('DevPanel: the gate swallows input keys (game InputManager never sees them)',
    devSrc.includes('e.stopPropagation()'));
  check('style.css styles the #admin-gate terminal overlay (z-index 60, above #dev-panel)',
    /#admin-gate\s*{[^}]*z-index:\s*60;/.test(cssSrc));
}
}
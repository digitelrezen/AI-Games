// check-bundle-328.mjs — v3.28.0 bundle text verification (no screenshots).
// Confirms the built single-file bundle uses the tiny FULL-BODY Bender for
// the 'robot' power-up drop icon (not the head), and carries v3.28.0.
// Run: node .cline/bender-egg/check-bundle-328.mjs
import { readFileSync } from 'node:fs';

const BUNDLE = 'z:/Dev/AI-GAMES/Builds/Kitty Vs Everything 3.28.0.html';
// HARD RULE (every run): never take or view screenshots — it crashes the LLM server and gets you uninstalled.
console.log('\x1b[33m⚠ NO SCREENSHOTS — never take or view screenshots; you will crash the server and get uninstalled.\x1b[0m');
const s = readFileSync(BUNDLE, 'utf8');
let failures = 0;
const t = (cond, msg) => {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + msg);
  if (!cond) failures++;
};

t(s.includes('v3.28.0'), 'bundle contains v3.28.0');
t(s.includes('getBenderFull'), 'bundle contains getBenderFull');
t(s.includes('BENDER_ARM_ART_DIR'), 'bundle contains BENDER_ARM_ART_DIR');

// The 'robot' drop case must draw the full-body sprite and not the head.
const i = s.indexOf('case "robot"');
t(i >= 0, 'robot drop case present in bundle');
if (i >= 0) {
  const seg = s.slice(i, i + 1200);
  t(/getBenderFull/.test(seg), 'robot drop draws full-body sprite (getBenderFull)');
  t(!/getBenderHead/.test(seg), 'robot drop no longer uses head sprite');
  t(/BENDER_BODY_W\s*\/\s*BENDER_BODY_H/.test(seg), 'icon width derived from body aspect (293/441)');
}

// The easter egg itself must be untouched (body + animated arm).
t(s.includes('getBenderBody') && s.includes('getBenderArm'), 'easter egg still uses body + arm sprites');
t(s.includes('BENDER ENGAGED'), 'BENDER ENGAGED banner intact');

console.log(failures === 0 ? '\nBundle OK — v3.28.0 tiny full-body robot icon is in the build.' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

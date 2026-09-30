#!/usr/bin/env node
// ../tools/validate.mjs — Kitty Vs Everything v3.14.0 (tools/ moved up to AI-GAMES root)
// Static consistency validator (Node, no deps). Run: npm run validate (from the game folder)
// Checks:
//   1. every relative import in the game modules resolves to a real file
//   2. every getElementById('id') in the JS has a matching id="id" in index.html
//   3. every <script src> in index.html exists
//   4. config.js VERSION matches the index.html title
//   5. no leftover legacy settings: SETTINGS.spinSpeed / screenShake typos
//   6. no raw-key gameplay input: input.isDown/wasPressed('Key…'),
//      input.mouse.down/right (must use the isDownAction/wasPressedAction layer)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'Kitty Vs Everything');
function walkJs(dir, base) {
  const out = [];
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir, e);
    const st = fs.statSync(p);
    const rel = base ? base + '/' + e : e;
    if (st.isDirectory()) out.push(...walkJs(p, rel));
    else if (e.endsWith('.js') && !e.startsWith('_')) out.push(rel);
  }
  return out;
}
const files = [
  ...walkJs(path.join(ROOT, 'js'), 'js'),
  ...fs.readdirSync(path.join(ROOT, 'net')).filter((f) => f.endsWith('.js') && !f.startsWith('_')).map((f) => 'net/' + f),
];
const errors = [];
const warnings = [];
const ok = (msg) => console.log('  \x1b[32m✓\x1b[0m ' + msg);
const bad = (msg) => { errors.push(msg); console.log('  \x1b[31m✗\x1b[0m ' + msg); };

console.log('\n[1/6] import resolution');
{
  let checked = 0;
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const re = /(?:import|export)\s+[^'"]*?from\s+['"](\.[^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src))) {
      checked++;
      const target = path.join(ROOT, path.dirname(f), m[1]);
      if (!fs.existsSync(target)) bad(`${f}: missing import ${m[1]}`);
    }
  }
  ok(`${checked} import specifiers all resolve`);
}

console.log('[2/6] getElementById ↔ index.html ids');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  let checked = 0;
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/getElementById\(\s*'([^']+)'\s*\)/g)) {
      checked++;
      if (!htmlIds.has(m[1])) bad(`${f}: #${m[1]} not found in index.html`);
    }
  }
  ok(`${checked} DOM lookups all have matching ids`);
}

console.log('[3/6] index.html script tags');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    if (!fs.existsSync(path.join(ROOT, m[1]))) bad(`index.html: missing script ${m[1]}`);
  }
  ok('script tags resolve');
}

console.log('[4/6] version consistency');
{
  const config = fs.readFileSync(path.join(ROOT, 'js/core/config.js'), 'utf8');
  const ver = (config.match(/export const VERSION = '([^']+)'/) || [])[1];
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const titleVer = (title.match(/v\d+\.\d+\.\d+/) || [])[0];
  if (ver) ok(`config.js ${ver}`);
  if (ver && titleVer && titleVer !== ver) warnings.push(`index.html title version ${titleVer} ≠ config ${ver}`);
}

console.log('[5/6] legacy settings usage');
{
  const legacy = /SETTINGS\s*\.\s*spinSpeed\b(?!Keyboard|Mouse)/;
  for (const f of files) {
    if (f === 'Settings.js') continue;
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (legacy.test(src)) bad(`${f}: still uses legacy SETTINGS.spinSpeed`);
  }
  ok('no legacy spinSpeed references');
}

console.log('[6/6] raw-key gameplay input (must use action layer)');
{
  const patterns = [
    [/input\.isDown\(\s*'Key[^']*'/g, 'input.isDown(\'Key…\')'],
    [/input\.wasPressed\(\s*'Key[^']*'/g, 'input.wasPressed(\'Key…\')'],
    [/input\.mouse\.down\b/g, 'input.mouse.down'],
    [/input\.mouse\.right\b/g, 'input.mouse.right'],
  ];
  for (const f of files) {
    if (f === 'InputManager.js') continue; // owns the raw layer
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const [re, label] of patterns) {
      const m = re.exec(src);
      if (m) bad(`${f}: raw input ${label} (line ${src.slice(0, m.index).split('\n').length})`);
    }
  }
  ok('gameplay input goes through isDownAction/wasPressedAction');
}

console.log('');
if (errors.length || warnings.length) {
  console.log(`\x1b[31mFAILED\x1b[0m — ${errors.length} error(s), ${warnings.length} warning(s)`);
  for (const w of warnings) console.log('  \x1b[33m!\x1b[0m ' + w);
  process.exit(1);
} else {
  console.log('\x1b[32mPASSED\x1b[0m — all static checks clean');
}